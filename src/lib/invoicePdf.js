import { newDoc, pdfHeader, pdfRecipientBlock, pdfSummary, pdfFooter, pdfSignatureRow, autoTable, MARGIN, INK, MUTED, FAINT_RULE, ACCENT } from './pdf'
import { formatDate, formatMoney, padCode, invoiceLabel, calcNet, calcTax, commissionOf, splitNet, round2, contractText, PAYMENT_METHODS } from './business'

/** Draws one sales settlement onto whatever page of `doc` is currently
 * active. Shared by the single-document and the bulk ("all this month's
 * settlements in one PDF") generators below. All the figures a vendor sees
 * here are already net of the shop's withholding tax - that's the whole
 * point of this document (contrast with the receipt below, which only
 * ever shows a pre-sale estimate). */
function drawInvoiceOnPage(doc, invoice, vendor, articles, settings) {
  const methodLabel = PAYMENT_METHODS.find((m) => m.value === invoice.paidMethod)?.label

  let y = pdfHeader(doc, settings, 'DISTINTA DI VENDITA', {
    number: invoiceLabel(invoice, settings),
    date: formatDate((invoice.issuedAt || '').slice(0, 10)),
    meta: [`Periodo: ${formatDate(invoice.from)} – ${formatDate(invoice.to)}`],
  })

  y = pdfRecipientBlock(doc, y, {
    name: `${vendor.name} ${vendor.surname}`,
    lines: [vendor.cf ? `Codice fiscale: ${vendor.cf}` : null, vendor.iban ? `IBAN: ${vendor.iban}` : null].filter(Boolean),
  })

  autoTable(doc, {
    startY: y,
    head: [['Codice', 'Descrizione', 'Data vendita', 'Prezzo lordo', 'Netto tassato', 'Spettanza']],
    body: articles.map((a) => [padCode(a.code), a.description, formatDate(a.soldDate), formatMoney(a.soldPrice), formatMoney(a.soldNet), formatMoney(a.soldVendorShare)]),
    styles: { fontSize: 8.2, textColor: INK, lineColor: FAINT_RULE, lineWidth: 0.2 },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: MARGIN, right: MARGIN },
  })
  y = doc.lastAutoTable.finalY + 8

  y = pdfSummary(
    doc,
    y,
    [
      ['Totale lordo', formatMoney(invoice.totalGross)],
      ['Imposta trattenuta', formatMoney(invoice.totalTax)],
      ['Totale netto tassato', formatMoney(invoice.totalNet)],
      ['Quota mercatino', formatMoney(invoice.shopShare)],
    ],
    { highlightLabel: 'Spettanza netta venditore', highlightValue: formatMoney(invoice.vendorShare) },
  )

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...(invoice.paid ? ACCENT : [180, 83, 9]))
  doc.text(invoice.paid ? `PAGATA il ${formatDate(invoice.paidDate)}${methodLabel ? ` · ${methodLabel}` : ''}` : 'DA LIQUIDARE', MARGIN, y)
  doc.setTextColor(...INK)
  y += 10

  pdfSignatureRow(
    doc,
    y,
    { label: settings.shop.name, sublabel: 'Per quietanza' },
    { label: `${vendor.name} ${vendor.surname}`, sublabel: 'Per ricevuta', image: invoice.signature || null },
  )
}

export function generateInvoicePdf(invoice, vendor, articles, settings) {
  const doc = newDoc()
  drawInvoiceOnPage(doc, invoice, vendor, articles, settings)
  pdfFooter(doc, settings)
  return doc
}

/** One combined PDF with every settlement, one per page (or more if a
 * vendor's table overflows) - for "print all of this month's distinte at
 * once". `items` is [{ invoice, vendor, articles }]. */
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
 * items, listing what was loaded at listino price plus a *projected*
 * net/commission split computed from current settings - clearly labelled
 * as an estimate, since the real figures are only fixed at actual sale
 * time (discounts, price overrides, a later mandate change can all move
 * them). This is never persisted as a ledger document the way a sales
 * settlement is: it's a point-in-time printout of already-stored articles. */
export function generateReceiptPdf(vendor, articles, settings, period) {
  const doc = newDoc()
  const commission = commissionOf(vendor, settings)
  const rows = articles.map((a) => {
    const net = calcNet(a.originalPrice, vendor, settings)
    const tax = calcTax(a.originalPrice, vendor, settings)
    const { vendorShare } = splitNet(net, commission)
    return { a, net, tax, vendorShare }
  })
  const totals = rows.reduce(
    (acc, r) => ({
      listino: round2(acc.listino + r.a.originalPrice),
      netto: round2(acc.netto + r.net),
      tax: round2(acc.tax + r.tax),
      spettanza: round2(acc.spettanza + r.vendorShare),
    }),
    { listino: 0, netto: 0, tax: 0, spettanza: 0 },
  )

  let y = pdfHeader(doc, settings, 'DISTINTA DI RICEVIMENTO', {
    date: formatDate(new Date().toISOString().slice(0, 10)),
    meta: period ? [`Carico: ${formatDate(period.from)} – ${formatDate(period.to)}`] : undefined,
  })

  y = pdfRecipientBlock(doc, y, {
    name: `${vendor.name} ${vendor.surname}`,
    lines: [vendor.cf ? `Codice fiscale: ${vendor.cf}` : null, vendor.phone ? `Telefono: ${vendor.phone}` : null].filter(Boolean),
  })

  autoTable(doc, {
    startY: y,
    head: [['Codice', 'Descrizione', 'Data carico', 'Prezzo listino', 'Netto tassato stimato', 'Spettanza stimata']],
    body: rows.map((r) => [padCode(r.a.code), r.a.description, formatDate(r.a.loadDate), formatMoney(r.a.originalPrice), formatMoney(r.net), formatMoney(r.vendorShare)]),
    styles: { fontSize: 8.2, textColor: INK, lineColor: FAINT_RULE, lineWidth: 0.2 },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: MARGIN, right: MARGIN },
  })
  y = doc.lastAutoTable.finalY + 8

  y = pdfSummary(
    doc,
    y,
    [
      ['Totale a listino', formatMoney(totals.listino)],
      ['Imposta stimata', formatMoney(totals.tax)],
      [`Quota mercatino stimata (${commission}%)`, formatMoney(round2(totals.netto - totals.spettanza))],
    ],
    { highlightLabel: 'Spettanza stimata venditore', highlightValue: formatMoney(totals.spettanza) },
  )

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.8)
  doc.setTextColor(...MUTED)
  const disclaimer = doc.splitTextToSize(
    'Gli importi di netto e spettanza indicati sono una stima calcolata sul prezzo di listino alle condizioni attuali (provvigione e imposta). ' +
      'Gli importi effettivi saranno definiti al momento della vendita e potranno variare per sconti progressivi, rettifiche di prezzo o modifiche del mandato.',
    210 - MARGIN * 2,
  )
  doc.text(disclaimer, MARGIN, y)
  y += disclaimer.length * 3.6 + 8
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...INK)

  if (settings.business.contractTerms) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text('Condizioni di conferimento', MARGIN, y)
    y += 5.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.3)
    doc.setTextColor(...MUTED)
    const terms = doc.splitTextToSize(contractText(settings), 210 - MARGIN * 2)
    doc.text(terms, MARGIN, y)
    y += terms.length * 4.2 + 10
    doc.setTextColor(...INK)
  }

  pdfSignatureRow(doc, y, { label: settings.shop.name, sublabel: 'Per ricevuta merce' }, { label: `${vendor.name} ${vendor.surname}`, sublabel: 'Il conferente' })

  pdfFooter(doc, settings)
  return doc
}

export function generateCashSummaryPdf(rows, totals, from, to, settings) {
  const doc = newDoc()
  const periodMeta = from && to ? [`Periodo: ${formatDate(from)} – ${formatDate(to)}`] : ['Tutto lo storico']
  let y = pdfHeader(doc, settings, 'RIEPILOGO DI CASSA', { date: formatDate(new Date().toISOString().slice(0, 10)), meta: periodMeta })

  autoTable(doc, {
    startY: y,
    head: [['Venditore', 'N. vendite', 'Lordo', 'Imposta', 'Quota mercatino', 'Spettanza venditori']],
    body: rows.map((r) => [r.vendorName, r.count, formatMoney(r.gross), formatMoney(r.tax), formatMoney(r.shopShare), formatMoney(r.vendorShare)]),
    foot: [['TOTALE', totals.count, formatMoney(totals.gross), formatMoney(totals.tax), formatMoney(totals.shopShare), formatMoney(totals.vendorShare)]],
    styles: { fontSize: 8.2, textColor: INK, lineColor: FAINT_RULE, lineWidth: 0.2 },
    headStyles: { fillColor: INK, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], textColor: INK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    margin: { left: MARGIN, right: MARGIN },
  })

  y = doc.lastAutoTable.finalY + 10
  pdfSummary(doc, y, [['di cui imposta trattenuta', formatMoney(totals.tax)]], { highlightLabel: 'Incasso totale mercatino', highlightValue: formatMoney(totals.shopShare + totals.tax) })

  pdfFooter(doc, settings)
  return doc
}
