import { db, ensureBootstrapped } from '../../lib/db'
import { DEFAULT_SETTINGS } from '../../lib/config'
import { addLog } from './logService'

function deepMerge(base, patch) {
  const out = { ...base }
  for (const key of Object.keys(patch || {})) {
    const value = patch[key]
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object'
        ? deepMerge(base[key], value)
        : value
  }
  return out
}

export async function getSettings() {
  await ensureBootstrapped()
  const row = await db.settings.get(1)
  const { id: _id, ...settings } = row || DEFAULT_SETTINGS
  return deepMerge(DEFAULT_SETTINGS, settings)
}

export async function updateSettings(patch) {
  const current = await getSettings()
  const next = deepMerge(current, patch)
  await db.settings.put({ id: 1, ...next })
  await addLog('impostazioni_modificate', 'Impostazioni aggiornate', {})
  return next
}

export async function resetAllData() {
  await db.transaction('rw', db.vendors, db.articles, db.invoices, db.logs, db.counters, db.cashMovements, async () => {
    await Promise.all([
      db.vendors.clear(),
      db.articles.clear(),
      db.invoices.clear(),
      db.logs.clear(),
      db.cashMovements.clear(),
      db.counters.put({ id: 1, nextArticleCode: 1, nextInvoiceNumber: 1, nextUnnumberedNumber: 1 }),
    ])
  })
}
