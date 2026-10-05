import { db } from '../../lib/db'
import { addLog } from './logService'
import { getSettings } from './settingsService'
import { padCode, calcNet, calcTax, commissionOf, splitNet, round2 } from '../../lib/business'

async function nextArticleCode() {
  return db.transaction('rw', db.counters, async () => {
    const counters = await db.counters.get(1)
    const code = counters.nextArticleCode
    await db.counters.update(1, { nextArticleCode: code + 1 })
    return code
  })
}

export async function listArticles(filters = {}) {
  let rows = await db.articles.toArray()
  const { code, text, vendorId, status, category, dateFrom, dateTo, excludeSold } = filters
  if (code) rows = rows.filter((a) => padCode(a.code).includes(String(code).trim()))
  if (text) {
    const q = text.toLowerCase()
    rows = rows.filter((a) => a.description.toLowerCase().includes(q) || (a.category || '').toLowerCase().includes(q))
  }
  if (vendorId) rows = rows.filter((a) => a.vendorId === Number(vendorId))
  if (status) rows = rows.filter((a) => a.status === status)
  if (category) rows = rows.filter((a) => a.category === category)
  if (dateFrom) rows = rows.filter((a) => a.loadDate >= dateFrom)
  if (dateTo) rows = rows.filter((a) => a.loadDate <= dateTo)
  if (excludeSold) rows = rows.filter((a) => a.status !== 'venduto')
  return rows.sort((a, b) => b.code - a.code)
}

export async function getArticle(id) {
  return db.articles.get(Number(id))
}

export async function getArticleByCode(code) {
  return db.articles.where('code').equals(Number(code)).first()
}

export async function listCategories() {
  const rows = await db.articles.toArray()
  return [...new Set(rows.map((a) => a.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'))
}

export async function createArticle(data) {
  const code = await nextArticleCode()
  const id = await db.articles.add({
    code,
    description: '',
    originalPrice: 0,
    vendorId: null,
    loadDate: new Date().toISOString().slice(0, 10),
    category: '',
    priceOverride: null,
    noDiscount: false,
    status: 'disponibile',
    soldDate: null,
    soldPrice: null,
    ritiroDate: null,
    ritiroMotivo: null,
    notes: '',
    labelPrintedAt: null,
    ...data,
  })
  await addLog('articolo_aggiunto', `Articolo aggiunto: ${padCode(code)} - ${data.description || ''}`, {
    articleId: id,
    articleCode: padCode(code),
    vendorId: data.vendorId,
  })
  return id
}

export async function updateArticle(id, data) {
  await db.articles.update(Number(id), data)
  const art = await db.articles.get(Number(id))
  await addLog('articolo_modificato', `Articolo modificato: ${padCode(art.code)}`, {
    articleId: art.id,
    articleCode: padCode(art.code),
    vendorId: art.vendorId,
  })
}

export async function deleteArticle(id) {
  const art = await db.articles.get(Number(id))
  await db.articles.delete(Number(id))
  await addLog('articolo_eliminato', `Articolo eliminato: ${padCode(art.code)} - ${art.description}`, {
    articleId: art.id,
    articleCode: padCode(art.code),
    vendorId: art.vendorId,
  })
}

/** Sells an article at `price`, freezing tax/commission math as of today's
 * settings so later schedule changes never retroactively alter past sales. */
export async function sellArticle(id, { price, date, paymentMethod = 'contanti' } = {}) {
  const settings = await getSettings()
  const art = await db.articles.get(Number(id))
  const vendor = art.vendorId ? await db.vendors.get(art.vendorId) : null
  const gross = round2(price)
  const net = calcNet(gross, vendor, settings)
  const tax = calcTax(gross, vendor, settings)
  const commission = commissionOf(vendor, settings)
  const { shopShare, vendorShare } = splitNet(net, commission)

  await db.articles.update(Number(id), {
    status: 'venduto',
    soldDate: date || new Date().toISOString().slice(0, 10),
    soldPrice: gross,
    soldNet: net,
    soldTax: tax,
    soldCommissionPercent: commission,
    soldShopShare: shopShare,
    soldVendorShare: vendorShare,
    paymentMethod,
  })
  await addLog('articolo_venduto', `Articolo venduto: ${padCode(art.code)} - ${art.description} a € ${gross.toFixed(2)}`, {
    articleId: art.id,
    articleCode: padCode(art.code),
    vendorId: art.vendorId,
    amount: gross,
  })
  return { gross, net, tax, shopShare, vendorShare }
}

export async function cancelSale(id) {
  const art = await db.articles.get(Number(id))
  await db.articles.update(Number(id), {
    status: 'disponibile',
    soldDate: null,
    soldPrice: null,
    soldNet: null,
    soldTax: null,
    soldCommissionPercent: null,
    soldShopShare: null,
    soldVendorShare: null,
    paymentMethod: null,
  })
  await addLog('vendita_annullata', `Vendita annullata: ${padCode(art.code)} - ${art.description}`, {
    articleId: art.id,
    articleCode: padCode(art.code),
    vendorId: art.vendorId,
  })
}

export async function markRitiro(id, { motivo = 'ritiro', date } = {}) {
  const art = await db.articles.get(Number(id))
  await db.articles.update(Number(id), {
    status: 'ritirato',
    ritiroDate: date || new Date().toISOString().slice(0, 10),
    ritiroMotivo: motivo,
  })
  await addLog('articolo_ritirato', `Articolo ${motivo === 'reso' ? 'reso' : 'ritirato'}: ${padCode(art.code)} - ${art.description}`, {
    articleId: art.id,
    articleCode: padCode(art.code),
    vendorId: art.vendorId,
  })
}

export async function revertRitiro(id) {
  const art = await db.articles.get(Number(id))
  await db.articles.update(Number(id), { status: 'disponibile', ritiroDate: null, ritiroMotivo: null })
  await addLog('articolo_modificato', `Ritiro annullato: ${padCode(art.code)} - ${art.description}`, {
    articleId: art.id,
    articleCode: padCode(art.code),
    vendorId: art.vendorId,
  })
}

export async function extendMandate(id, days) {
  const art = await db.articles.get(Number(id))
  const extended = (art.mandateExtendedDays || 0) + Number(days)
  await db.articles.update(Number(id), { mandateExtendedDays: extended })
  await addLog('articolo_modificato', `Mandato prorogato di ${days} giorni: ${padCode(art.code)} - ${art.description}`, {
    articleId: art.id,
    articleCode: padCode(art.code),
    vendorId: art.vendorId,
  })
}

export async function markLabelPrinted(ids) {
  const now = new Date().toISOString()
  await db.articles.bulkUpdate(ids.map((id) => ({ key: Number(id), changes: { labelPrintedAt: now } })))
}
