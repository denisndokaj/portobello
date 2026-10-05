// Domain rules for the consignment-shop ledger: article lifecycle, discount
// schedule, tax/commission split, settlement numbering. Kept framework-free
// and pure so it can be unit-tested and reused by both UI and PDF/export code.

export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

export function padCode(n, len = 6) {
  return String(n).padStart(len, '0')
}

/** Calendar days elapsed between an ISO date string and a reference Date. */
export function daysBetween(fromIso, ref = new Date()) {
  const from = new Date(fromIso + 'T00:00:00')
  const to = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const fromMid = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.floor((to - fromMid) / 86400000)
}

/** Calendar months elapsed (year/month arithmetic, ignores day-of-month). */
export function monthsBetween(fromIso, ref = new Date()) {
  const from = new Date(fromIso + 'T00:00:00')
  return (ref.getFullYear() - from.getFullYear()) * 12 + (ref.getMonth() - from.getMonth())
}

function sortedDiscountSteps(settings) {
  return [...(settings.business.discountSteps || [])].sort((a, b) => a.days - b.days)
}

/**
 * Derives the article's live status from its stored fields plus the current
 * date. Sold/withdrawn/returned are terminal states stored on the record;
 * expired/discounted/available are always computed, never persisted, so
 * changing the discount schedule retroactively re-prices the whole catalog.
 */
/** The load date used for mandate/discount math, shifted forward by any
 * granted extension ("proroga") without mutating the original load date. */
export function effectiveLoadDate(article) {
  if (!article.mandateExtendedDays) return article.loadDate
  const d = new Date(article.loadDate + 'T00:00:00')
  d.setDate(d.getDate() + article.mandateExtendedDays)
  return d.toISOString().slice(0, 10)
}

export function getArticleStatus(article, settings) {
  if (article.status === 'venduto') return { status: 'venduto', label: 'Venduto', discount: 0 }
  if (article.status === 'ritirato') {
    if (article.ritiroMotivo === 'reso') return { status: 'reso', label: 'Reso', discount: 0 }
    if (article.ritiroMotivo === 'devoluto') return { status: 'devoluto', label: 'Devoluto', discount: 0 }
    return { status: 'ritirato', label: 'Ritirato', discount: 0 }
  }

  const loadDate = effectiveLoadDate(article)
  const months = monthsBetween(loadDate)
  if (months >= Number(settings.business.mandateDurationMonths || 12)) {
    return { status: 'scaduto', label: 'Scaduto', discount: 0 }
  }
  if (article.noDiscount) {
    return { status: 'disponibile', label: 'Prezzo fisso', discount: 0 }
  }

  const days = daysBetween(loadDate)
  let applied = null
  for (const step of sortedDiscountSteps(settings)) {
    if (days >= step.days) applied = step
  }
  if (applied) {
    return { status: 'sconto', label: `In sconto -${applied.discountPercent}%`, discount: applied.discountPercent }
  }
  return { status: 'disponibile', label: 'Disponibile', discount: 0 }
}

/** Current sale price: sold price if sold, else manual override, else the
 * discount-adjusted list price (full price if no discount/expiry applies). */
export function getCurrentPrice(article, settings) {
  if (article.status === 'venduto' && article.soldPrice != null) return article.soldPrice
  if (article.priceOverride !== null && article.priceOverride !== undefined && article.priceOverride !== '') {
    return round2(Number(article.priceOverride))
  }
  const { discount } = getArticleStatus(article, settings)
  if (!discount) return round2(article.originalPrice)
  return round2((article.originalPrice * (100 - discount)) / 100)
}

/** Net amount after the shop's withholding tax, before the vendor/shop commission split. */
export function calcNet(grossPrice, vendor, settings) {
  if (vendor && vendor.applyTax === false) return round2(grossPrice)
  const rate = Number(settings.business.taxRatePercent || 0) / 100
  const net = grossPrice * (1 - rate)
  return settings.business.taxRoundingStrategy === 'round_cent' ? round2(net) : Math.floor(net)
}

export function calcTax(grossPrice, vendor, settings) {
  return round2(grossPrice - calcNet(grossPrice, vendor, settings))
}

export function commissionOf(vendor, settings) {
  const c = vendor?.commission
  if (c === null || c === undefined || c === '') return Number(settings.business.defaultCommissionPercent || 0)
  return Number(c)
}

/** Splits the post-tax net amount between shop and vendor by commission %. */
export function splitNet(totalNet, commissionPercent) {
  const shopShare = round2((totalNet * commissionPercent) / 100)
  return { shopShare, vendorShare: round2(totalNet - shopShare) }
}

export function formatMoney(n) {
  return (Number(n) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

export function formatDate(d) {
  if (!d) return ''
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('it-IT')
}

export function formatDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('it-IT')
}

export function invoiceLabel(invoice, settings) {
  const prefix = invoice.numbered ? settings.business.invoicePrefix || '' : settings.business.unnumberedDocPrefix || 'NN-'
  return `${prefix}${invoice.number}`
}

export function contractText(settings) {
  const s = settings.business
  const steps = sortedDiscountSteps(settings)
  const sconti = steps.length
    ? 'Sono previsti sconti progressivi: ' +
      steps.map((st) => `-${st.discountPercent}% dopo ${st.days} giorni`).join(', ') +
      '.'
    : ''
  return (s.contractTerms || '')
    .replaceAll('{DURATA}', String(s.mandateDurationMonths))
    .replaceAll('{COMMISSIONE}', String(s.defaultCommissionPercent))
    .replaceAll('{SCONTI}', sconti)
    .replaceAll('{NEGOZIO}', settings.shop.name)
}

/** Active (not sold/withdrawn) articles within the expiry-warning window,
 * sorted by most urgent first. Shared by the Dashboard and the Articoli
 * "Scadenze" tab so both apply the exact same rule. */
export function getExpiringArticles(articles, settings) {
  const warnMonths = Number(settings.business.expiryWarningMonths || 0)
  const mandateMonths = Number(settings.business.mandateDurationMonths || 12)
  return articles
    .filter((a) => a.status !== 'venduto' && a.status !== 'ritirato')
    .map((a) => ({ article: a, monthsElapsed: monthsBetween(effectiveLoadDate(a)) }))
    .filter((x) => x.monthsElapsed >= mandateMonths - warnMonths)
    .sort((a, b) => b.monthsElapsed - a.monthsElapsed)
}

export const ARTICLE_STATUS_LABELS = {
  disponibile: 'Disponibile',
  sconto: 'In sconto',
  scaduto: 'Scaduto',
  venduto: 'Venduto',
  ritirato: 'Ritirato',
  reso: 'Reso',
  devoluto: 'Devoluto',
}

export const ARTICLE_STATUS_COLORS = {
  disponibile: 'bg-brand-100 text-brand-800',
  sconto: 'bg-amber-100 text-amber-800',
  scaduto: 'bg-red-100 text-red-800',
  venduto: 'bg-slate-200 text-slate-600',
  ritirato: 'bg-slate-200 text-slate-600',
  reso: 'bg-orange-100 text-orange-800',
  devoluto: 'bg-purple-100 text-purple-700',
}

export const LOG_TYPE_LABELS = {
  articolo_aggiunto: 'Articolo aggiunto',
  articolo_venduto: 'Articolo venduto',
  articolo_modificato: 'Articolo modificato',
  articolo_eliminato: 'Articolo eliminato',
  articolo_ritirato: 'Articolo ritirato/reso',
  vendita_annullata: 'Vendita annullata',
  venditore_aggiunto: 'Venditore aggiunto',
  venditore_modificato: 'Venditore modificato',
  venditore_eliminato: 'Venditore eliminato',
  distinta_emessa: 'Distinta emessa',
  pagamento_registrato: 'Pagamento registrato',
  pagamento_annullato: 'Pagamento annullato',
  impostazioni_modificate: 'Impostazioni modificate',
  dati_importati: 'Dati importati',
  cassa_chiusura: 'Chiusura cassa',
}

export const PAYMENT_METHODS = [
  { value: 'contanti', label: 'Contanti' },
  { value: 'pos', label: 'POS / Carta' },
  { value: 'satispay', label: 'Satispay' },
  { value: 'bonifico', label: 'Bonifico' },
  { value: 'assegno', label: 'Assegno' },
  { value: 'buono', label: 'Buono / Reso' },
  { value: 'altro', label: 'Altro' },
]

export const LABEL_PRESETS = {
  'DK-11201': { name: 'Brother DK-11201 (29×90mm)', widthMm: 90, heightMm: 29, continuous: false },
  'DK-22205': { name: 'Brother DK-22205 continuo (62mm)', widthMm: 62, heightMm: 30, continuous: true },
  'ZEBRA-57x32': { name: 'Zebra 57×32mm', widthMm: 57, heightMm: 32, continuous: false },
  'DYMO-89x28': { name: 'Dymo 89×28mm', widthMm: 89, heightMm: 28, continuous: false },
}
