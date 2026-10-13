import { db } from '../../lib/db'
import { addLog } from './logService'
import { getSettings } from './settingsService'
import { calcNet, calcTax, splitNet, round2 } from '../../lib/business'

const STAGING_VERSION = 1
const RECONSTRUCTED_NOTE = 'Liquidazione storica ricostruita in sede di importazione dal vecchio gestionale.'

export function parseStaging(jsonText) {
  const staging = JSON.parse(jsonText)
  if (staging?.stagingVersion && staging.stagingVersion !== STAGING_VERSION) {
    throw new Error(`Formato di importazione non riconosciuto (versione ${staging.stagingVersion}).`)
  }
  if (!Array.isArray(staging?.vendors) || !Array.isArray(staging?.articles) || !staging?.cutoffDate) {
    throw new Error('File di importazione non valido: mancano venditori, articoli o data di cutoff.')
  }
  return staging
}

/** Preview counts shown before the destructive write - everything here is
 * read-only, derived straight from the staging payload. */
export function summarizeStaging(staging) {
  const { vendors, articles, cutoffDate } = staging
  const stubVendors = vendors.filter((v) => v.stub).length
  const ambiguousVendors = vendors.filter((v) => v.ambiguousNameSplit).length
  const byStatus = { disponibile: 0, venduto: 0, ritirato: 0 }
  let soldPreCutoff = 0
  let soldPostCutoff = 0
  for (const a of articles) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1
    if (a.status === 'venduto') {
      if (a.soldDate && a.soldDate <= cutoffDate) soldPreCutoff++
      else soldPostCutoff++
    }
  }
  return {
    cutoffDate,
    vendorsTotal: vendors.length,
    stubVendors,
    ambiguousVendors,
    articlesTotal: articles.length,
    byStatus,
    soldPreCutoff,
    soldPostCutoff,
  }
}

/** Last calendar day of a "YYYY-MM" month, as an ISO date string. Computed
 * entirely in UTC (Date.UTC + getUTCDate, no toISOString() on a
 * locally-constructed Date) because that conversion is timezone-sensitive:
 * in any zone ahead of UTC, local midnight on the last day shifts back into
 * the previous day once converted, silently cutting the month one day
 * short for every settlement built from it. */
function lastDayOfMonth(isoYearMonth) {
  const [y, m] = isoYearMonth.split('-').map(Number)
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${isoYearMonth}-${String(day).padStart(2, '0')}`
}

/** Writes the staging payload into the live database: vendors, articles
 * (with sold-article financials computed via the same calcNet/calcTax/
 * splitNet the normal sale flow uses, but using each row's historical
 * commission % instead of today's default), and one reconstructed,
 * already-paid settlement per vendor per calendar month for everything
 * sold at or before the cutoff date - so only sales after cutoff show up
 * as "da liquidare" once this finishes. Runs as bulk writes with a single
 * consolidated log entry instead of replaying every individual service
 * call, since that would mean tens of thousands of transactions. */
export async function applyLegacyImport(staging) {
  const settings = await getSettings()
  const { vendors: stagingVendors, articles: stagingArticles, cutoffDate } = staging
  const taxStubVendor = { applyTax: true }

  const vendorRows = stagingVendors.map((v) => ({
    name: v.name || '',
    surname: v.surname || '',
    phone: v.phone || '',
    email: v.email || '',
    address: v.address || '',
    birthDate: v.birthDate || null,
    birthPlace: v.birthPlace || '',
    cf: v.cf || '',
    docType: v.docType || null,
    docNumber: v.docNumber || '',
    iban: '',
    commission: null,
    applyTax: true,
    countInNumbering: true,
    notes: v.notes || '',
    createdAt: new Date().toISOString(),
  }))

  const vendorIdMap = {}
  await db.transaction('rw', db.vendors, async () => {
    const newIds = await db.vendors.bulkAdd(vendorRows, { allKeys: true })
    stagingVendors.forEach((v, i) => {
      vendorIdMap[v.legacyId] = newIds[i]
    })
  })

  const today = new Date().toISOString().slice(0, 10)
  let maxCode = 0
  const articleRows = stagingArticles.map((a) => {
    maxCode = Math.max(maxCode, a.code)
    const vendorId = a.vendorLegacyId ? (vendorIdMap[a.vendorLegacyId] ?? null) : null
    const row = {
      code: a.code,
      description: a.description || '(senza descrizione)',
      originalPrice: round2(a.originalPrice || 0),
      vendorId,
      loadDate: a.loadDate || a.soldDate || a.ritiroDate || today,
      category: '',
      priceOverride: null,
      noDiscount: false,
      status: a.status,
      soldDate: null,
      soldPrice: null,
      soldNet: null,
      soldTax: null,
      soldCommissionPercent: null,
      soldShopShare: null,
      soldVendorShare: null,
      ritiroDate: null,
      ritiroMotivo: null,
      notes: a.loadDateGuessed ? 'Importato dal vecchio gestionale (data di carico stimata dalla vendita/ritiro, non disponibile nell\'originale).' : 'Importato dal vecchio gestionale.',
      labelPrintedAt: null,
      depositAmount: null,
      depositDate: null,
      depositNote: '',
      mandateExtendedDays: 0,
    }
    if (a.status === 'venduto') {
      const gross = round2(a.soldPrice || 0)
      const net = calcNet(gross, taxStubVendor, settings)
      const tax = calcTax(gross, taxStubVendor, settings)
      const commission = a.commissionPercent ?? Number(settings.business.defaultCommissionPercent || 0)
      const { shopShare, vendorShare } = splitNet(net, commission)
      row.soldDate = a.soldDate
      row.soldPrice = gross
      row.soldNet = net
      row.soldTax = tax
      row.soldCommissionPercent = commission
      row.soldShopShare = shopShare
      row.soldVendorShare = vendorShare
    } else if (a.status === 'ritirato') {
      row.ritiroDate = a.ritiroDate
      row.ritiroMotivo = a.ritiroMotivo || 'ritiro'
    }
    return row
  })

  const CHUNK = 2000
  const articlesWithId = []
  await db.transaction('rw', db.articles, async () => {
    for (let i = 0; i < articleRows.length; i += CHUNK) {
      const chunk = articleRows.slice(i, i + CHUNK)
      const ids = await db.articles.bulkAdd(chunk, { allKeys: true })
      chunk.forEach((row, j) => articlesWithId.push({ ...row, id: ids[j] }))
    }
  })

  await db.transaction('rw', db.counters, async () => {
    const counters = await db.counters.get(1)
    if (maxCode >= counters.nextArticleCode) {
      await db.counters.update(1, { nextArticleCode: maxCode + 1 })
    }
  })

  const groups = new Map()
  for (const a of articlesWithId) {
    if (a.status !== 'venduto' || !a.vendorId || !a.soldDate || a.soldDate > cutoffDate) continue
    const ym = a.soldDate.slice(0, 7)
    const key = `${a.vendorId}|${ym}`
    if (!groups.has(key)) {
      groups.set(key, { vendorId: a.vendorId, from: `${ym}-01`, to: lastDayOfMonth(ym), articles: [] })
    }
    groups.get(key).articles.push(a)
  }

  let invoicesCreated = 0
  await db.transaction('rw', db.invoices, db.counters, async () => {
    const counters = await db.counters.get(1)
    let nextInvoiceNumber = counters.nextInvoiceNumber
    const invoiceRows = []
    for (const g of groups.values()) {
      const totals = {
        articleIds: g.articles.map((a) => a.id),
        totalGross: round2(g.articles.reduce((s, a) => s + (a.soldPrice || 0), 0)),
        totalNet: round2(g.articles.reduce((s, a) => s + (a.soldNet || 0), 0)),
        totalTax: round2(g.articles.reduce((s, a) => s + (a.soldTax || 0), 0)),
        shopShare: round2(g.articles.reduce((s, a) => s + (a.soldShopShare || 0), 0)),
        vendorShare: round2(g.articles.reduce((s, a) => s + (a.soldVendorShare || 0), 0)),
      }
      invoiceRows.push({
        vendorId: g.vendorId,
        from: g.from,
        to: g.to,
        numbered: true,
        number: nextInvoiceNumber++,
        issuedAt: new Date(g.to + 'T12:00:00').toISOString(),
        paid: true,
        paidDate: cutoffDate,
        paidMethod: 'altro',
        paidNote: RECONSTRUCTED_NOTE,
        signature: null,
        ...totals,
      })
    }
    if (invoiceRows.length) await db.invoices.bulkAdd(invoiceRows)
    await db.counters.update(1, { nextInvoiceNumber })
    invoicesCreated = invoiceRows.length
  })

  await addLog(
    'dati_importati',
    `Importazione dal vecchio gestionale: ${stagingVendors.length} venditori, ${stagingArticles.length} articoli, ${invoicesCreated} fatture storiche ricostruite e liquidate fino al ${cutoffDate}.`,
    {},
  )

  return {
    vendorsImported: stagingVendors.length,
    articlesImported: stagingArticles.length,
    invoicesReconstructed: invoicesCreated,
  }
}

/** One-time repair for fatture this importer itself created before the
 * timezone bug in `lastDayOfMonth` was fixed: in any zone ahead of UTC it
 * stored "to" one day short of the real month-end (e.g. 29/09 instead of
 * 30/09), even though the articles attached were already grouped correctly
 * by sale month - only the printed/displayed period was wrong, totals are
 * untouched here. Scoped strictly to rows carrying this importer's own
 * paidNote marker, so a manually created or normally-generated fattura
 * with a deliberately partial period is never touched. */
export async function repairReconstructedInvoiceDates() {
  const invoices = await db.invoices.toArray()
  const candidates = invoices.filter((inv) => inv.paidNote === RECONSTRUCTED_NOTE)
  const fixes = []
  for (const inv of candidates) {
    if (!inv.from) continue
    const ym = inv.from.slice(0, 7)
    const correctTo = lastDayOfMonth(ym)
    if (inv.to !== correctTo) fixes.push({ id: inv.id, from: inv.from, oldTo: inv.to, newTo: correctTo })
  }
  if (fixes.length) {
    await db.transaction('rw', db.invoices, async () => {
      for (const f of fixes) await db.invoices.update(f.id, { to: f.newTo })
    })
    await addLog('dati_importati', `Corretta la data di fine periodo su ${fixes.length} fatture storiche ricostruite dall'importazione.`, {})
  }
  return fixes
}
