import { newDoc, pdfHeader, pdfFooter, pdfSignatureArea, MARGIN } from './pdf'
import { formatDate } from './business'

/** Builds the vendor's consignment mandate as a downloadable PDF. `params`
 * overrides the shop defaults for this specific mandate (duration, default
 * commission, withdrawal clause) without touching global settings. */
export function generateMandatePdf(vendor, settings, params) {
  const doc = newDoc()
  let y = pdfHeader(doc, settings, 'MANDATO DI VENDITA IN CONTO VENDITA', `${vendor.name} ${vendor.surname}`)

  doc.setFontSize(10)
  const info = [
    ['Venditore', `${vendor.name} ${vendor.surname}`],
    ['Codice fiscale', vendor.cf || '–'],
    ['Telefono', vendor.phone || '–'],
    ['Indirizzo', vendor.address || '–'],
    ['Data mandato', formatDate(new Date().toISOString().slice(0, 10))],
    ['Durata', `${params.months} mesi`],
    ['Commissione mercatino', `${params.commissionPercent}%`],
  ]
  info.forEach(([label, value], i) => {
    doc.setFont(undefined, 'bold')
    doc.text(label + ':', MARGIN, y + i * 6)
    doc.setFont(undefined, 'normal')
    doc.text(String(value), MARGIN + 50, y + i * 6)
  })
  y += info.length * 6 + 8

  doc.setFont(undefined, 'bold')
  doc.text('Condizioni generali', MARGIN, y)
  y += 6
  doc.setFont(undefined, 'normal')
  const bodyText =
    `Il venditore affida al mercatino, a titolo di conto vendita, gli articoli elencati in allegato per un periodo massimo di ${params.months} mesi dalla data di carico. ` +
    `${settings.business.discountSteps.length ? 'Sono previsti sconti progressivi secondo lo scadenzario configurato dal negozio. ' : ''}` +
    `Al venditore spetta il prezzo di vendita al netto della commissione del ${params.commissionPercent}% trattenuta da ${settings.shop.name} e dell'eventuale imposta di legge. ` +
    `${params.recessoClause}`
  const lines = doc.splitTextToSize(bodyText, 210 - MARGIN * 2)
  doc.text(lines, MARGIN, y)
  y += lines.length * 5 + 10

  y = pdfSignatureArea(doc, y, `${settings.shop.name} (per accettazione)`)
  y = pdfSignatureArea(doc, y + 4, 'Il venditore (per accettazione)')

  pdfFooter(doc, settings)
  return doc
}

export const DEFAULT_RECESSO_CLAUSE =
  'Il venditore può richiedere il ritiro anticipato degli articoli invenduti in qualsiasi momento, durante gli orari di apertura. ' +
  'Alla scadenza del mandato, gli articoli non ritirati entro 30 giorni si intendono devoluti a titolo gratuito al mercatino.'
