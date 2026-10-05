import { newDoc, pdfLetterhead, pdfMetaRow, pdfLabeledParagraph, pdfSingleSignature, pdfFooter } from './pdf'
import { formatDate } from './business'

/** Builds the vendor's consignment mandate as a downloadable PDF. `params`
 * overrides the shop defaults for this specific mandate (duration, default
 * commission, withdrawal clause) without touching global settings. */
export function generateMandatePdf(vendor, settings, params) {
  const doc = newDoc()
  const today = new Date().toISOString().slice(0, 10)

  let y = pdfLetterhead(doc, settings, 'Mandato di vendita', 'Conto vendita')

  y = pdfMetaRow(doc, y, {
    left: ['Venditore', `${vendor.name} ${vendor.surname}`],
    rightLines: [
      ['Data', formatDate(today)],
      ['Durata', `${params.months} mesi`],
      ['Commissione', `${params.commissionPercent}%`],
    ],
  })

  const bodyText =
    `Il venditore affida al mercatino, a titolo di conto vendita, gli articoli elencati in allegato per un periodo massimo di ${params.months} mesi dalla data di carico. ` +
    `${settings.business.discountSteps.length ? 'Sono previsti sconti progressivi secondo lo scadenzario configurato dal negozio. ' : ''}` +
    `Al venditore spetta il prezzo di vendita al netto della commissione del ${params.commissionPercent}% trattenuta da ${settings.shop.name} e dell'eventuale imposta di legge. ` +
    `${params.recessoClause}`
  y = pdfLabeledParagraph(doc, y, 'Condizioni generali:', bodyText)

  y += 10
  pdfSingleSignature(doc, y, 'Firma del Venditore per accettazione')

  pdfFooter(doc, settings)
  return doc
}

export const DEFAULT_RECESSO_CLAUSE =
  'Il venditore può richiedere il ritiro anticipato degli articoli invenduti in qualsiasi momento, durante gli orari di apertura. ' +
  'Alla scadenza del mandato, gli articoli non ritirati entro 30 giorni si intendono devoluti a titolo gratuito al mercatino.'
