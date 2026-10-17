import { db } from '../../lib/db'

export const NOTE_SECTIONS = ['prenotati', 'fotografare', 'caricare', 'varie']

export async function listNotes() {
  const rows = await db.notes.toArray()
  return rows.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export async function addNote(section, text, vendorId = null, articleId = null) {
  const trimmed = (text || '').trim()
  if (!trimmed) return
  return db.notes.add({ section, text: trimmed, vendorId: vendorId || null, articleId: articleId || null, done: false, createdAt: new Date().toISOString() })
}

export async function toggleNoteDone(id) {
  const note = await db.notes.get(id)
  if (!note) return
  await db.notes.update(id, { done: !note.done, doneAt: !note.done ? new Date().toISOString() : null })
}

export async function deleteNote(id) {
  await db.notes.delete(id)
}

/** Add-or-remove toggle used by the quick-action button on an article row:
 * one click files it under a note section, a second click (while the note
 * is still open) takes it back out. Returns true if it ended up added. */
export async function toggleArticleNote(section, articleId, text) {
  const inSection = await db.notes.where('section').equals(section).toArray()
  const existing = inSection.find((n) => n.articleId === articleId && !n.done)
  if (existing) {
    await db.notes.delete(existing.id)
    return false
  }
  await addNote(section, text, null, articleId)
  return true
}
