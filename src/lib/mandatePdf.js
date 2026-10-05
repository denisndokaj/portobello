import { newDoc, pdfHeader, pdfRecipientBlock, pdfFooter, pdfSignatureRow, MARGIN, MUTED, INK } from './pdf'
import { formatDate } from './business'

/** Builds the vendor's consignment mandate as a downloadable PDF. `params`
 * overrides the shop defaults for this specific mandate (duration, default
 * commission, withdrawal clause) without touching global settings. */
export function generateMandatePdf(vendor, settings, params) {
  const doc = newDoc()
  const today = formatDate(new Date().toISOString().slice(0, 10))
  let y = pdfHeader(doc, settings, 'MANDATO DI VENDITA', { date: today, meta: ['Conto vendita'] })

  y = pdfRecipientBlock(doc, y, {
    name: `${vendor.name} ${vendor.surname}`,
    lines: [vendor.cf ? `Codice fiscale: ${vendor.cf}` : null, vendor.phone ? `Telefono: ${vendor.phone}` : null, vendor.address || null].filter(Boolean),
  })

  const info = [
    ['Durata mandato', `${params.months} mesi dalla data di carico`],
    ['Commissione mercatino', `${params.commissionPercent}% sul prezzo di vendita`],
  ]
  doc.setFontSize(9.3)
  info.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    doc.text(label, MARGIN, y + i * 6)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...INK)
    doc.text(value, MARGIN + 55, y + i * 6)
  })
  y += info.length * 6 + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text('Condizioni generali', MARGIN, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.3)
  const bodyText =
    `Il venditore affida al mercatino, a titolo di conto vendita, gli articoli elencati in allegato per un periodo massimo di ${params.months} mesi dalla data di carico. ` +
    `${settings.business.discountSteps.length ? 'Sono previsti sconti progressivi secondo lo scadenzario configurato dal negozio. ' : ''}` +
    `Al venditore spetta il prezzo di vendita al netto della commissione del ${params.commissionPercent}% trattenuta da ${settings.shop.name} e dell'eventuale imposta di legge. ` +
    `${params.recessoClause}`
  const lines = doc.splitTextToSize(bodyText, 210 - MARGIN * 2)
  doc.text(lines, MARGIN, y)
  y += lines.length * 4.8 + 14

  pdfSignatureRow(doc, y, { label: settings.shop.name, sublabel: 'Per accettazione' }, { label: `${vendor.name} ${vendor.surname}`, sublabel: 'Per accettazione' })

  pdfFooter(doc, settings)
  return doc
}

export const DEFAULT_RECESSO_CLAUSE =
  'Il venditore può richiedere il ritiro anticipato degli articoli invenduti in qualsiasi momento, durante gli orari di apertura. ' +
  'Alla scadenza del mandato, gli articoli non ritirati entro 30 giorni si intendono devoluti a titolo gratuito al mercatino.'
