import { db } from '../../lib/db'
import { round2 } from '../../lib/business'

export async function salesByMonth(monthsBack = 12) {
  const articles = await db.articles.where('status').equals('venduto').toArray()
  const now = new Date()
  const buckets = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }), total: 0, count: 0 })
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]))
  for (const a of articles) {
    const key = (a.soldDate || '').slice(0, 7)
    if (byKey[key]) {
      byKey[key].total = round2(byKey[key].total + (a.soldPrice || 0))
      byKey[key].count += 1
    }
  }
  return buckets
}

export async function topVendorsBySales(limit = 8) {
  const [articles, vendors] = await Promise.all([db.articles.where('status').equals('venduto').toArray(), db.vendors.toArray()])
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]))
  const totals = {}
  for (const a of articles) {
    if (!a.vendorId) continue
    totals[a.vendorId] = round2((totals[a.vendorId] || 0) + (a.soldPrice || 0))
  }
  return Object.entries(totals)
    .map(([vendorId, total]) => ({ vendorId: Number(vendorId), vendor: vendorMap[vendorId], total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export async function pendingSettlementByVendor() {
  const [vendors, articles, allInvoices] = await Promise.all([db.vendors.toArray(), db.articles.where('status').equals('venduto').toArray(), db.invoices.toArray()])
  const invoices = allInvoices.filter((i) => i.paid)
  const paidArticleIds = new Set(invoices.flatMap((i) => i.articleIds))
  const totals = {}
  for (const a of articles) {
    if (!a.vendorId || paidArticleIds.has(a.id)) continue
    totals[a.vendorId] = round2((totals[a.vendorId] || 0) + (a.soldVendorShare || 0))
  }
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]))
  return Object.entries(totals)
    .map(([vendorId, total]) => ({ vendorId: Number(vendorId), vendor: vendorMap[vendorId], total }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
}

export async function recentSales(limit = 8) {
  const [articles, vendors] = await Promise.all([db.articles.where('status').equals('venduto').toArray(), db.vendors.toArray()])
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]))
  return articles
    .sort((a, b) => (b.soldDate || '').localeCompare(a.soldDate || ''))
    .slice(0, limit)
    .map((a) => ({ ...a, vendor: vendorMap[a.vendorId] }))
}

export async function dashboardSummary() {
  const [vendors, articles, invoices] = await Promise.all([db.vendors.toArray(), db.articles.toArray(), db.invoices.toArray()])
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)

  const sold = articles.filter((a) => a.status === 'venduto')
  const soldThisMonth = sold.filter((a) => a.soldDate >= monthStart)
  const soldPrevMonth = sold.filter((a) => a.soldDate >= prevMonthStart && a.soldDate <= prevMonthEnd)
  const active = articles.filter((a) => a.status === 'disponibile')

  const totalThisMonth = round2(soldThisMonth.reduce((s, a) => s + (a.soldPrice || 0), 0))
  const totalPrevMonth = round2(soldPrevMonth.reduce((s, a) => s + (a.soldPrice || 0), 0))
  const deltaPercent = totalPrevMonth > 0 ? round2(((totalThisMonth - totalPrevMonth) / totalPrevMonth) * 100) : null

  const paidArticleIds = new Set(invoices.filter((i) => i.paid).flatMap((i) => i.articleIds))
  const dueToVendors = round2(sold.filter((a) => !paidArticleIds.has(a.id)).reduce((s, a) => s + (a.soldVendorShare || 0), 0))

  return {
    vendorCount: vendors.length,
    activeCount: active.length,
    activeValue: round2(active.reduce((s, a) => s + (a.originalPrice || 0), 0)),
    soldThisMonthCount: soldThisMonth.length,
    totalThisMonth,
    deltaPercent,
    dueToVendors,
    soldTotalCount: sold.length,
    archiveTotal: articles.length,
  }
}

export async function cashRegisterByVendor({ from, to } = {}) {
  const [vendors, allArticles] = await Promise.all([db.vendors.toArray(), db.articles.where('status').equals('venduto').toArray()])
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]))
  let sold = allArticles
  if (from) sold = sold.filter((a) => a.soldDate >= from)
  if (to) sold = sold.filter((a) => a.soldDate <= to)
  const byVendor = {}
  for (const a of sold) {
    const key = a.vendorId || 0
    byVendor[key] = byVendor[key] || { vendorName: vendorMap[a.vendorId] ? `${vendorMap[a.vendorId].name} ${vendorMap[a.vendorId].surname}` : '–', count: 0, gross: 0, tax: 0, shopShare: 0, vendorShare: 0 }
    byVendor[key].count += 1
    byVendor[key].gross = round2(byVendor[key].gross + (a.soldPrice || 0))
    byVendor[key].tax = round2(byVendor[key].tax + (a.soldTax || 0))
    byVendor[key].shopShare = round2(byVendor[key].shopShare + (a.soldShopShare || 0))
    byVendor[key].vendorShare = round2(byVendor[key].vendorShare + (a.soldVendorShare || 0))
  }
  return Object.values(byVendor).sort((a, b) => b.gross - a.gross)
}

export async function cashRegisterTotals({ from, to } = {}) {
  let sold = await db.articles.where('status').equals('venduto').toArray()
  if (from) sold = sold.filter((a) => a.soldDate >= from)
  if (to) sold = sold.filter((a) => a.soldDate <= to)
  const gross = round2(sold.reduce((s, a) => s + (a.soldPrice || 0), 0))
  const tax = round2(sold.reduce((s, a) => s + (a.soldTax || 0), 0))
  const shopShare = round2(sold.reduce((s, a) => s + (a.soldShopShare || 0), 0))
  const vendorShare = round2(sold.reduce((s, a) => s + (a.soldVendorShare || 0), 0))
  const byMethod = {}
  for (const a of sold) {
    const m = a.paymentMethod || 'contanti'
    byMethod[m] = round2((byMethod[m] || 0) + (a.soldPrice || 0))
  }
  return { count: sold.length, gross, tax, shopShare, vendorShare, shopIncome: round2(shopShare + tax), byMethod }
}
