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
  // Logging happens *outside* the transaction below: addLog() writes to
  // db.logs, a table this transaction never declares, so calling it from
  // inside used to throw (Dexie scopes a transaction strictly to the
  // tables it's given - touching any other table from inside it fails
  // with "the specified object store was not found").
  const { invoice, created } = await db.transaction('rw', db.invoices, db.vendors, db.counters, db.articles, async () => {
    const articles = await soldArticlesInPeriod(vendorId, from, to)
    const totals = totalsFor(articles)
    const existing = await db.invoices.where({ vendorId: Number(vendorId) }).and((i) => i.from === from && i.to === to).first()

    if (existing) {
      if (existing.paid) return { invoice: existing, created: false }
      await db.invoices.update(existing.id, totals)
      return { invoice: { ...existing, ...totals }, created: false }
    }

    const vendor = await db.vendors.get(Number(vendorId))
    const numbered = vendor?.countInNumbering !== false
    const counters = await db.counters.get(1)
    const number = numbered ? counters.nextInvoiceNumber : counters.nextUnnumberedNumber
    await db.counters.update(1, numbered ? { nextInvoiceNumber: number + 1 } : { nextUnnumberedNumber: number + 1 })

    const newInvoice = {
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
    const id = await db.invoices.add(newInvoice)
    return { invoice: { id, ...newInvoice }, created: true }
  })

  if (created) {
    await addLog('distinta_emessa', `Distinta emessa per venditore #${vendorId} (${from} – ${to})`, { vendorId: Number(vendorId) })
  }
  return invoice
}

/** Vendor ids with at least one sale in the period - the set a "generate
 * this month's settlements" bulk action should cover, no more. */
export async function vendorsWithSalesInPeriod(from, to) {
  const sold = await db.articles.where('status').equals('venduto').toArray()
  const ids = sold.filter((a) => a.vendorId && a.soldDate >= from && a.soldDate <= to).map((a) => a.vendorId)
  return [...new Set(ids)]
}

/** Generates/refreshes the settlement for every vendor who sold something
 * in the period, skipping anyone with nothing to settle. */
export async function generateMonthlyInvoices(from, to) {
  const vendorIds = await vendorsWithSalesInPeriod(from, to)
  const invoices = []
  for (const vendorId of vendorIds) {
    invoices.push(await getOrCreateInvoice(vendorId, from, to))
  }
  return invoices
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
