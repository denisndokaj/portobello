import { db } from './db'

const TABLES = ['vendors', 'articles', 'invoices', 'logs', 'settings', 'counters', 'cashMovements']
export const BACKUP_SNAPSHOT_KEY = 'portobello_backup_snapshots'
export const MAX_SNAPSHOTS = 5

export async function dumpDatabase() {
  const data = {}
  for (const table of TABLES) {
    data[table] = await db[table].toArray()
  }
  return { version: 1, exportedAt: new Date().toISOString(), data }
}

export async function restoreDatabase(payload) {
  if (!payload?.data) throw new Error('File di backup non valido.')
  await db.transaction('rw', TABLES.map((t) => db[t]), async () => {
    for (const table of TABLES) {
      await db[table].clear()
      const rows = payload.data[table]
      if (Array.isArray(rows) && rows.length) await db[table].bulkAdd(rows)
    }
  })
}

export function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  triggerDownload(blob, filename)
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Keeps a rotating window of automatic snapshots in localStorage, taken
 * before destructive operations (bulk delete, import, reset). */
export async function autoBackup(reason) {
  try {
    const dump = await dumpDatabase()
    const raw = localStorage.getItem(BACKUP_SNAPSHOT_KEY)
    const list = raw ? JSON.parse(raw) : []
    list.unshift({ at: new Date().toISOString(), reason, data: dump })
    localStorage.setItem(BACKUP_SNAPSHOT_KEY, JSON.stringify(list.slice(0, MAX_SNAPSHOTS)))
  } catch {
    // Best-effort safety net; never block the operation that triggered it.
  }
}

export function listSnapshots() {
  const raw = localStorage.getItem(BACKUP_SNAPSHOT_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function restoreSnapshot(index) {
  const list = listSnapshots()
  const snap = list[index]
  if (!snap) throw new Error('Istantanea non trovata.')
  await restoreDatabase(snap.data)
}

export function lastBackupDate() {
  const list = listSnapshots()
  return list[0]?.at || null
}
