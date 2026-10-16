import { db } from '../../lib/db'

export const NOTE_SECTIONS = ['prenotati', 'fotografare', 'caricare', 'varie']

export async function listNotes() {
  const rows = await db.notes.toArray()
  return rows.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export async function addNote(section, text, vendorId = null) {
  const trimmed = (text || '').trim()
  if (!trimmed) return
  return db.notes.add({ section, text: trimmed, vendorId: vendorId || null, done: false, createdAt: new Date().toISOString() })
}

export async function toggleNoteDone(id) {
  const note = await db.notes.get(id)
  if (!note) return
  await db.notes.update(id, { done: !note.done, doneAt: !note.done ? new Date().toISOString() : null })
}

export async function deleteNote(id) {
  await db.notes.delete(id)
}
