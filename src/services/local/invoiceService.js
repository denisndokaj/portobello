import { db } from '../../lib/db'
import { addLog } from './logService'
import { getSettings } from './settingsService'
import { round2 } from '../../lib/business'

async function soldArticlesInPeriod(vendorId, from, to) {
  const rows = await db.articles.where('vendorId').equals(Number(vendorId)).toArray()
  return rows.filter((a) => a.status === 'venduto' && a.soldDate >= from && a.soldDate <= to)
}

function totalsFor(articles) {
  return {
    articleIds: articles.map((a) => a.id),
    totalGross: round2(articles.reduce((s, a) => s + (a.soldPrice || 0), 0)),
    totalNet: round2(articles.reduce((s, a) => s + (a.soldNet || 0), 0)),
    totalTax: round2(articles.reduce((s, a) => s + (a.soldTax || 0), 0)),
    shopShare: round2(articles.reduce((s, a) => s + (a.soldShopShare || 0), 0)),
    vendorShare: round2(articles.reduce((s, a) => s + (a.soldVendorShare || 0), 0)),
  }
}

/** A settlement document is uniquely keyed by (vendorId, from, to). Creating
 * it the first time assigns a number from one of two independent series
 * (numbered/un-numbered) based on the vendor's countInNumbering flag at that
 * moment; that choice is then frozen on the document forever. Reopening an
 * unpaid settlement recomputes totals (new sales in the same range are
 * picked up); a paid settlement is immutable. */
export async function getOrCreateInvoice(vendorId, from, to) {
  return db.transaction('rw', db.invoices, db.vendors, db.counters, async () => {
    const articles = await soldArticlesInPeriod(vendorId, from, to)
    const totals = totalsFor(articles)
    const existing = await db.invoices.where({ vendorId: Number(vendorId) }).and((i) => i.from === from && i.to === to).first()

    if (existing) {
      if (existing.paid) return existing
      await db.invoices.update(existing.id, totals)
      return { ...existing, ...totals }
    }

    const vendor = await db.vendors.get(Number(vendorId))
    const numbered = vendor?.countInNumbering !== false
    const counters = await db.counters.get(1)
    const number = numbered ? counters.nextInvoiceNumber : counters.nextUnnumberedNumber
    await db.counters.update(1, numbered ? { nextInvoiceNumber: number + 1 } : { nextUnnumberedNumber: number + 1 })

    const invoice = {
      vendorId: Number(vendorId),
      from,
      to,
      numbered,
      number,
      issuedAt: new Date().toISOString(),
      paid: false,
      paidDate: null,
      paidMethod: null,
      paidNote: null,
      ...totals,
    }
    const id = await db.invoices.add(invoice)
    await addLog('distinta_emessa', `Distinta emessa per venditore #${vendorId} (${from} – ${to})`, { vendorId: Number(vendorId) })
    return { id, ...invoice }
  })
}

export async function listInvoices(filters = {}) {
  let rows = await db.invoices.toArray()
  if (filters.vendorId) rows = rows.filter((i) => i.vendorId === Number(filters.vendorId))
  if (filters.paid === true) rows = rows.filter((i) => i.paid)
  if (filters.paid === false) rows = rows.filter((i) => !i.paid)
  return rows.sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
}

export async function getInvoice(id) {
  return db.invoices.get(Number(id))
}

export async function getInvoiceArticles(invoice) {
  const rows = await db.articles.bulkGet(invoice.articleIds)
  return rows.filter(Boolean).sort((a, b) => (a.soldDate || '').localeCompare(b.soldDate || ''))
}

export async function payInvoice(id, { date, method = 'contanti', note = '', signature = null } = {}) {
  await db.invoices.update(Number(id), {
    paid: true,
    paidDate: date || new Date().toISOString().slice(0, 10),
    paidMethod: method,
    paidNote: note,
    signature,
  })
  const inv = await db.invoices.get(Number(id))
  await addLog('pagamento_registrato', `Pagamento registrato: distinta #${inv.number} (€ ${inv.vendorShare.toFixed(2)})`, {
    vendorId: inv.vendorId,
    amount: inv.vendorShare,
  })
}

export async function cancelPayment(id) {
  const inv = await db.invoices.get(Number(id))
  await db.invoices.update(Number(id), { paid: false, paidDate: null, paidMethod: null, paidNote: null, signature: null })
  await addLog('pagamento_annullato', `Pagamento annullato: distinta #${inv.number}`, { vendorId: inv.vendorId })
}

export function invoiceNumberLabel(invoice, settings) {
  const prefix = invoice.numbered ? settings.business.invoicePrefix || '' : settings.business.unnumberedDocPrefix || 'NN-'
  return `${prefix}${invoice.number}`
}

export async function nextSettlementDefaults() {
  const settings = await getSettings()
  const today = new Date()
  const to = today.toISOString().slice(0, 10)
  const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  return { from, to, settings }
}
