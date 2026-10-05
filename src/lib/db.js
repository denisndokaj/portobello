import Dexie from 'dexie'
import { DEFAULT_SETTINGS } from './config'

export const db = new Dexie('portobello_gestionale')

// Primary keys are Dexie auto-increment ids (internal). Business-facing
// numbering (article code, invoice numbers) lives in the `counters`
// singleton row and is incremented inside a transaction so it stays
// monotonic even if a record is later deleted.
db.version(1).stores({
  vendors: '++id, surname, name, cf, phone, createdAt',
  articles: '++id, code, vendorId, status, category, loadDate',
  invoices: '++id, vendorId, [vendorId+from+to]',
  logs: '++id, date, type, vendorId, articleId',
  settings: 'id',
  counters: 'id',
  cashMovements: '++id, date, type',
})

db.on('populate', async () => {
  await db.settings.put({ id: 1, ...DEFAULT_SETTINGS })
  await db.counters.put({
    id: 1,
    nextArticleCode: 1,
    nextInvoiceNumber: 1,
    nextUnnumberedNumber: 1,
  })
})

/** Ensures the singleton rows exist even on a DB created before this schema
 * (e.g. during development) so every service call can rely on them. */
export async function ensureBootstrapped() {
  const settings = await db.settings.get(1)
  if (!settings) await db.settings.put({ id: 1, ...DEFAULT_SETTINGS })
  const counters = await db.counters.get(1)
  if (!counters) {
    await db.counters.put({ id: 1, nextArticleCode: 1, nextInvoiceNumber: 1, nextUnnumberedNumber: 1 })
  }
}
