import { db } from './db'
import { vendorNeedsReview } from './business'

function normName(v) {
  return `${(v.name || '').trim().toLowerCase()} ${(v.surname || '').trim().toLowerCase()}`.trim()
}

function severityOf(count) {
  return count > 0 ? 'warn' : 'ok'
}

/** Structural data-quality audit, independent from the legacy-import repair
 * tools: those fix one known historical bug, this looks for anything that
 * doesn't hold together regardless of how it got there (manual entry,
 * import, or a future bug). Read-only - never changes data. */
export async function runDataIntegrityChecks() {
  const [vendors, articles, invoices] = await Promise.all([db.vendors.toArray(), db.articles.toArray(), db.invoices.toArray()])
  const vendorIds = new Set(vendors.map((v) => v.id))
  const today = new Date().toISOString().slice(0, 10)
  const checks = []

  const needReview = vendors.filter(vendorNeedsReview)
  checks.push({
    key: 'vendors_review',
    title: 'Venditori da rivedere',
    detail: "Dati incompleti o ricostruiti automaticamente in un'importazione passata.",
    severity: severityOf(needReview.length),
    count: needReview.length,
    items: needReview.map((v) => ({ label: `${v.name} ${v.surname}`.trim() || `Venditore #${v.id}`, to: `/venditori/${v.id}` })),
  })

  const byName = new Map()
  for (const v of vendors) {
    const key = normName(v)
    if (!key) continue
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key).push(v)
  }
  const dupVendorGroups = [...byName.values()].filter((g) => g.length > 1)
  checks.push({
    key: 'vendors_duplicate',
    title: 'Possibili venditori duplicati',
    detail: 'Stesso nome e cognome su più schede: potrebbero essere la stessa persona inserita due volte.',
    severity: severityOf(dupVendorGroups.length),
    count: dupVendorGroups.length,
    items: dupVendorGroups.map((g) => ({ label: `${g[0].name} ${g[0].surname} (${g.length} schede)`, to: `/venditori/${g[0].id}` })),
  })

  const badDate = articles.filter((a) => !a.loadDate || a.loadDate < '2000-01-01' || a.loadDate > today)
  checks.push({
    key: 'articles_bad_loaddate',
    title: 'Articoli con data di carico assente o implausibile',
    detail: 'Mancante, prima del 2000 o nel futuro.',
    severity: severityOf(badDate.length),
    count: badDate.length,
    items: badDate.map((a) => ({ label: `#${a.code} ${a.description} — carico: ${a.loadDate || '(assente)'}`, to: a.vendorId ? `/venditori/${a.vendorId}` : null })),
  })

  const byCode = new Map()
  for (const a of articles) {
    if (!byCode.has(a.code)) byCode.set(a.code, [])
    byCode.get(a.code).push(a)
  }
  const dupCodes = [...byCode.values()].filter((g) => g.length > 1)
  checks.push({
    key: 'articles_duplicate_code',
    title: 'Codici articolo duplicati',
    detail: 'Due o più articoli con lo stesso numero di codice: uno dei due non è etichettabile correttamente.',
    severity: severityOf(dupCodes.length),
    count: dupCodes.length,
    items: dupCodes.map((g) => ({ label: `Codice ${g[0].code} (${g.length}×): ${g.map((a) => a.description).join(' · ')}`, to: g[0].vendorId ? `/venditori/${g[0].vendorId}` : null })),
  })

  const orphanArticles = articles.filter((a) => a.vendorId && !vendorIds.has(a.vendorId))
  checks.push({
    key: 'articles_orphan',
    title: 'Articoli collegati a un venditore inesistente',
    detail: 'Il venditore originale è stato eliminato ma l\'articolo è rimasto.',
    severity: severityOf(orphanArticles.length),
    count: orphanArticles.length,
    items: orphanArticles.map((a) => ({ label: `#${a.code} ${a.description}`, to: null })),
  })

  const badSold = articles.filter((a) => a.status === 'venduto' && (!a.soldDate || a.soldPrice == null))
  checks.push({
    key: 'articles_bad_sold',
    title: 'Articoli venduti senza data o prezzo di vendita',
    detail: 'Segnati come venduti ma senza uno dei due dati necessari per la fattura.',
    severity: severityOf(badSold.length),
    count: badSold.length,
    items: badSold.map((a) => ({ label: `#${a.code} ${a.description}`, to: a.vendorId ? `/venditori/${a.vendorId}` : null })),
  })

  const inverted = articles.filter((a) => a.soldDate && a.loadDate && a.soldDate < a.loadDate)
  checks.push({
    key: 'articles_sold_before_load',
    title: 'Articoli venduti prima della data di carico',
    detail: 'La data di vendita precede quella di carico: una delle due è sbagliata.',
    severity: severityOf(inverted.length),
    count: inverted.length,
    items: inverted.map((a) => ({ label: `#${a.code} ${a.description} — carico ${a.loadDate}, vendita ${a.soldDate}`, to: a.vendorId ? `/venditori/${a.vendorId}` : null })),
  })

  const badPrice = articles.filter((a) => !(Number(a.originalPrice) > 0))
  checks.push({
    key: 'articles_bad_price',
    title: 'Articoli con prezzo di listino assente o non positivo',
    detail: 'Prezzo a zero, negativo o non numerico.',
    severity: severityOf(badPrice.length),
    count: badPrice.length,
    items: badPrice.map((a) => ({ label: `#${a.code} ${a.description} — ${a.originalPrice}`, to: a.vendorId ? `/venditori/${a.vendorId}` : null })),
  })

  const orphanInvoices = invoices.filter((i) => i.vendorId && !vendorIds.has(i.vendorId))
  checks.push({
    key: 'invoices_orphan',
    title: 'Fatture collegate a un venditore inesistente',
    detail: 'Il venditore originale è stato eliminato ma la fattura è rimasta nel conto.',
    severity: severityOf(orphanInvoices.length),
    count: orphanInvoices.length,
    items: orphanInvoices.map((i) => ({ label: `Fattura ${i.from} – ${i.to}`, to: null })),
  })

  const invertedInvoices = invoices.filter((i) => i.from && i.to && i.to < i.from)
  checks.push({
    key: 'invoices_inverted_period',
    title: 'Fatture con periodo invertito',
    detail: 'La data di fine è prima della data di inizio.',
    severity: severityOf(invertedInvoices.length),
    count: invertedInvoices.length,
    items: invertedInvoices.map((i) => ({ label: `Fattura ${i.from} – ${i.to}`, to: i.vendorId ? `/venditori/${i.vendorId}` : null })),
  })

  return {
    ranAt: new Date().toISOString(),
    totals: { vendors: vendors.length, articles: articles.length, invoices: invoices.length },
    checks,
    problemCount: checks.reduce((s, c) => s + c.count, 0),
  }
}
