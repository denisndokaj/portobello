import { newDoc, pdfHeader, pdfFooter, pdfSignatureArea, pdfSignatureImage, autoTable, MARGIN } from './pdf'
import { formatDate, formatMoney, padCode, invoiceLabel } from './business'

/** Draws one settlement onto whatever page of `doc` is currently active.
 * Shared by the single-document and the bulk ("all this month's
 * settlements in one PDF") generators below. */
function drawInvoiceOnPage(doc, invoice, vendor, articles, settings) {
  let y = pdfHeader(doc, settings, `DISTINTA DI VENDITA N. ${invoiceLabel(invoice, settings)}`, `${vendor.name} ${vendor.surname} – ${formatDate(invoice.from)} – ${formatDate(invoice.to)}`)

  autoTable(doc, {
    startY: y,
    head: [['Codice', 'Descrizione', 'Data vendita', 'Prezzo', 'Netto', 'Provvigione', 'Spettanza']],
    body: articles.map((a) => [
      padCode(a.code),
      a.description,
      formatDate(a.soldDate),
      formatMoney(a.soldPrice),
      formatMoney(a.soldNet),
      formatMoney(a.soldShopShare),
      formatMoney(a.soldVendorShare),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 163, 74] },
    margin: { left: MARGIN, right: MARGIN },
  })

  y = doc.lastAutoTable.finalY + 10
  const rows = [
    ['Totale lordo', formatMoney(invoice.totalGross)],
    ['Totale imposta', formatMoney(invoice.totalTax)],
    ['Totale netto', formatMoney(invoice.totalNet)],
    [`Quota ${settings.shop.name}`, formatMoney(invoice.shopShare)],
    ['Spettanza venditore', formatMoney(invoice.vendorShare)],
  ]
  doc.setFontSize(10)
  rows.forEach(([label, value], i) => {
    doc.setFont(undefined, i === rows.length - 1 ? 'bold' : 'normal')
    doc.text(label, MARGIN, y + i * 6)
    doc.text(value, 160, y + i * 6, { align: 'right' })
  })
  y += rows.length * 6 + 6

  doc.setFont(undefined, 'normal')
  doc.setFontSize(10)
  doc.text(`Stato: ${invoice.paid ? `PAGATA il ${formatDate(invoice.paidDate)} (${invoice.paidMethod})` : 'DA LIQUIDARE'}`, MARGIN, y)
  y += 10

  if (invoice.signature) {
    pdfSignatureImage(doc, y, invoice.signature, 'Firma per ricevuta')
  } else {
    pdfSignatureArea(doc, y, 'Firma per ricevuta')
  }
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

export function generateCashSummaryPdf(rows, totals, from, to, settings) {
  const doc = newDoc()
  let y = pdfHeader(doc, settings, 'RIEPILOGO DI CASSA', `${formatDate(from)} – ${formatDate(to)}`)

  autoTable(doc, {
    startY: y,
    head: [['Venditore', 'N. vendite', 'Lordo', 'Imposta', `Quota ${settings.shop.name}`, 'Spettanza venditori']],
    body: rows.map((r) => [r.vendorName, r.count, formatMoney(r.gross), formatMoney(r.tax), formatMoney(r.shopShare), formatMoney(r.vendorShare)]),
    foot: [['TOTALE', totals.count, formatMoney(totals.gross), formatMoney(totals.tax), formatMoney(totals.shopShare), formatMoney(totals.vendorShare)]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 163, 74] },
    footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
    margin: { left: MARGIN, right: MARGIN },
  })

  y = doc.lastAutoTable.finalY + 10
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.text(`Incasso mercatino (commissioni + imposta): ${formatMoney(totals.shopShare + totals.tax)}`, MARGIN, y)

  pdfFooter(doc, settings)
  return doc
}
