import { newDoc, pdfLetterhead, pdfMetaRow, pdfTotals, pdfLabeledParagraph, pdfSingleSignature, pdfFooter, autoTable, MARGIN, PAGE_WIDTH, TABLE_STYLE } from './pdf'
import { formatDate, formatMoney, padCode, invoiceLabel, calcNet, commissionOf, round2, contractText } from './business'

/** Draws one sales settlement onto whatever page of `doc` is currently
 * active. Shared by the single-document and the bulk ("all this month's
 * settlements in one PDF") generators below. The price column is always
 * the net, already-taxed figure - the vendor never needs to see the gross
 * price, only what the shop actually owes them before the commission
 * split, which is why "netto tassato" per line plus the three totals below
 * (netto, provvigione, spettanza) are the whole story. */
function drawInvoiceOnPage(doc, invoice, vendor, articles, settings) {
  let y = pdfLetterhead(doc, settings, 'Distinta di vendita', `Periodo dal ${formatDate(invoice.from)} al ${formatDate(invoice.to)}`)

  y = pdfMetaRow(doc, y, {
    left: ['Venditore', `${vendor.name} ${vendor.surname}`],
    rightLines: [
      ['Numero', invoiceLabel(invoice, settings)],
      ['Data', formatDate((invoice.issuedAt || '').slice(0, 10))],
      ['Stato', invoice.paid ? `Pagata il ${formatDate(invoice.paidDate)}` : 'Da liquidare'],
    ],
  })

  doc.setFontSize(9.3)
  const introLines = doc.splitTextToSize("Con la presente si rendiconta la vendita dei seguenti articoli, a prezzi già al netto dell'imposta:", PAGE_WIDTH - MARGIN * 2)
  doc.text(introLines, MARGIN, y)
  y += introLines.length * 4.6 + 6

  autoTable(doc, {
    startY: y,
    head: [['N.', 'Codice', 'Descrizione', 'Data vendita', 'Prezzo netto']],
    body: articles.map((a, i) => [String(i + 1), padCode(a.code), a.description, formatDate(a.soldDate), formatMoney(a.soldNet)]),
    columnStyles: { 0: { cellWidth: 10 }, 4: { halign: 'right' } },
    margin: { left: MARGIN, right: MARGIN },
    ...TABLE_STYLE,
  })
  y = doc.lastAutoTable.finalY + 10

  y = pdfTotals(doc, y, [
    { label: 'Totale netto tassato', value: formatMoney(invoice.totalNet) },
    { label: 'Provvigione mercatino', value: formatMoney(invoice.shopShare) },
    { label: 'Spettanza netta venditore', value: formatMoney(invoice.vendorShare), emphasis: true },
  ])

  y += 6
  pdfSingleSignature(doc, y, 'Firma del Venditore per ricevuta', invoice.signature)
}

export function generateInvoicePdf(invoice, vendor, articles, settings) {
  const doc = newDoc()
  drawInvoiceOnPage(doc, invoice, vendor, articles, settings)
  pdfFooter(doc, settings)
  return doc
}

/** One combined PDF with every settlement, one per page - for "print all
 * of this month's distinte at once". `items` is [{ invoice, vendor, articles }]. */
export function generateBulkInvoicePdf(items, settings) {
  const doc = newDoc()
  items.forEach((item, i) => {
    if (i > 0) doc.addPage()
    drawInvoiceOnPage(doc, item.invoice, item.vendor, item.articles, settings)
  })
  pdfFooter(doc, settings)
  return doc
}

/** "Distinta di ricevimento merce": issued to whoever just dropped off
 * items, listing what was loaded with its already-taxed net value at
 * today's settings - a projection, since discounts, a price override or a
 * later mandate change can still move it before the actual sale. Never
 * persisted as a ledger document the way a sales settlement is: it's a
 * point-in-time printout of already-stored articles. */
export function generateReceiptPdf(vendor, articles, settings, period) {
  const doc = newDoc()
  const commission = commissionOf(vendor, settings)
  const rows = articles.map((a) => ({ a, net: calcNet(a.originalPrice, vendor, settings) }))
  const totalNet = round2(rows.reduce((s, r) => s + r.net, 0))

  const dateLabel = period ? `dal ${formatDate(period.from)} al ${formatDate(period.to)}` : `in data ${formatDate(new Date().toISOString().slice(0, 10))}`
  let y = pdfLetterhead(doc, settings, 'Distinta di ricevimento merce', `Articoli ricevuti ${dateLabel}`)

  y = pdfMetaRow(doc, y, {
    left: ['Venditore', `${vendor.name} ${vendor.surname}`],
    rightLines: [
      ['Data', formatDate(new Date().toISOString().slice(0, 10))],
      ['Commissione', `${commission}%`],
      ['N. articoli', String(articles.length)],
    ],
  })

  doc.setFontSize(9.3)
  const introLines = doc.splitTextToSize(
    "Con la presente si dichiara di aver ricevuto in conto vendita i seguenti articoli, a prezzi già al netto dell'imposta:",
    PAGE_WIDTH - MARGIN * 2,
  )
  doc.text(introLines, MARGIN, y)
  y += introLines.length * 4.6 + 6

  autoTable(doc, {
    startY: y,
    head: [['N.', 'Codice', 'Descrizione', 'Data carico', 'Prezzo netto']],
    body: rows.map((r, i) => [String(i + 1), padCode(r.a.code), r.a.description, formatDate(r.a.loadDate), formatMoney(r.net)]),
    columnStyles: { 0: { cellWidth: 10 }, 4: { halign: 'right' } },
    margin: { left: MARGIN, right: MARGIN },
    ...TABLE_STYLE,
  })
  y = doc.lastAutoTable.finalY + 10

  y = pdfTotals(doc, y, [{ label: 'Totale netto merce', value: formatMoney(totalNet), emphasis: true }])

  if (settings.business.contractTerms) {
    y = pdfLabeledParagraph(doc, y, 'Condizioni:', contractText(settings))
  }

  y += 6
  pdfSingleSignature(doc, y, 'Firma del Venditore')

  pdfFooter(doc, settings)
  return doc
}

export function generateCashSummaryPdf(rows, totals, from, to, settings) {
  const doc = newDoc()
  const period = from && to ? `Periodo dal ${formatDate(from)} al ${formatDate(to)}` : 'Tutto lo storico'
  let y = pdfLetterhead(doc, settings, 'Riepilogo di cassa', period)

  autoTable(doc, {
    startY: y,
    head: [['Venditore', 'N. vendite', 'Lordo', 'Imposta', 'Provvigione mercatino', 'Spettanza venditori']],
    body: rows.map((r) => [r.vendorName, r.count, formatMoney(r.gross), formatMoney(r.tax), formatMoney(r.shopShare), formatMoney(r.vendorShare)]),
    foot: [['TOTALE', totals.count, formatMoney(totals.gross), formatMoney(totals.tax), formatMoney(totals.shopShare), formatMoney(totals.vendorShare)]],
    footStyles: { fillColor: 255, textColor: [20, 21, 24], fontStyle: 'bold', lineColor: [20, 21, 24], lineWidth: 0.3 },
    margin: { left: MARGIN, right: MARGIN },
    ...TABLE_STYLE,
  })

  y = doc.lastAutoTable.finalY + 10
  pdfTotals(doc, y, [
    { label: 'di cui imposta trattenuta', value: formatMoney(totals.tax) },
    { label: 'Incasso totale mercatino', value: formatMoney(totals.shopShare + totals.tax), emphasis: true },
  ])

  pdfFooter(doc, settings)
  return doc
}
