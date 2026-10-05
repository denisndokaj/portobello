import { db } from '../../lib/db'

export async function addLog(type, description, details = {}) {
  return db.logs.add({
    date: new Date().toISOString(),
    type,
    description,
    details,
    vendorId: details.vendorId ?? null,
    articleId: details.articleId ?? null,
  })
}

export async function listLogs({ from, to, type, vendorId, articleCode, text } = {}) {
  let rows = await db.logs.orderBy('date').reverse().toArray()
  if (from) rows = rows.filter((l) => l.date >= from)
  if (to) rows = rows.filter((l) => l.date <= to + 'T23:59:59')
  if (type) rows = rows.filter((l) => l.type === type)
  if (vendorId) rows = rows.filter((l) => l.vendorId === Number(vendorId))
  if (articleCode) rows = rows.filter((l) => String(l.details?.articleCode || '').includes(String(articleCode)))
  if (text) {
    const q = text.toLowerCase()
    rows = rows.filter((l) => l.description.toLowerCase().includes(q))
  }
  return rows
}

export async function updateLog(id, patch) {
  await db.logs.update(id, { ...patch, editedAt: new Date().toISOString(), manual: true })
}

export async function deleteLog(id) {
  await db.logs.delete(id)
}

export async function deleteFilteredLogs(filters) {
  const rows = await listLogs(filters)
  await db.logs.bulkDelete(rows.map((r) => r.id))
  return rows.length
}
