import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotebookPen, Plus, Trash2 } from 'lucide-react'
import { listNotes, addNote, toggleNoteDone, deleteNote, listVendors, listArticles } from '../../services'
import { toast } from '../../store/useToastStore'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import VendorPicker from '../../components/VendorPicker'
import ItemForm from '../items/ItemForm'
import { formatDate } from '../../lib/business'

const SECTIONS = [
  { key: 'prenotati', title: 'Articoli prenotati', placeholder: 'Es. giacca blu cod. 1234, ritiro venerdì - Maria' },
  { key: 'fotografare', title: 'Articoli da fotografare', placeholder: 'Es. cod. 5678 per il sito' },
  { key: 'caricare', title: 'Articoli da caricare', placeholder: 'Es. scatola di libri', withVendor: true },
  { key: 'varie', title: 'Note varie e promemoria', placeholder: 'Scrivi una nota...' },
]

export default function NotesPage() {
  const [notes, setNotes] = useState([])
  const [vendors, setVendors] = useState([])
  const [articles, setArticles] = useState([])
  const [editArticle, setEditArticle] = useState(null)
  const [itemFormOpen, setItemFormOpen] = useState(false)

  async function reload() {
    setNotes(await listNotes())
    setVendors(await listVendors())
    setArticles(await listArticles({}))
  }
  useEffect(() => {
    reload()
  }, [])

  const vendorMap = useMemo(() => Object.fromEntries(vendors.map((v) => [v.id, v])), [vendors])
  const articleMap = useMemo(() => Object.fromEntries(articles.map((a) => [a.id, a])), [articles])

  function openArticle(article) {
    setEditArticle(article)
    setItemFormOpen(true)
  }

  return (
    <div className="space-y-4 pb-10">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
        <NotebookPen size={22} /> Note
      </h1>
      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((s) => (
          <NoteSection key={s.key} section={s} notes={notes.filter((n) => n.section === s.key)} vendorMap={vendorMap} articleMap={articleMap} onChange={reload} onOpenArticle={openArticle} />
        ))}
      </div>
      <ItemForm open={itemFormOpen} onClose={() => setItemFormOpen(false)} article={editArticle} onSaved={reload} />
    </div>
  )
}

function NoteSection({ section, notes, vendorMap, articleMap, onChange, onOpenArticle }) {
  const [text, setText] = useState('')
  const [vendorId, setVendorId] = useState(null)
  const openCount = notes.filter((n) => !n.done).length

  async function handleAdd() {
    if (!text.trim()) return
    await addNote(section.key, text, vendorId)
    setText('')
    setVendorId(null)
    onChange()
  }

  async function handleToggle(id) {
    await toggleNoteDone(id)
    onChange()
  }

  async function handleDelete(id) {
    await deleteNote(id)
    toast('Nota eliminata', 'success')
    onChange()
  }

  return (
    <Card className="flex flex-col">
      <CardHeader title={section.title} subtitle={openCount > 0 ? `${openCount} da fare` : 'Tutto fatto'} />
      <div className="space-y-2 border-b border-slate-100 p-3">
        <div className="flex gap-2">
          <Input
            placeholder={section.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button size="sm" onClick={handleAdd} disabled={!text.trim()} type="button">
            <Plus size={16} />
          </Button>
        </div>
        {section.withVendor && (
          <div className="w-full sm:w-56">
            <VendorPicker value={vendorId} onChange={setVendorId} placeholder="Venditore (opzionale)..." />
          </div>
        )}
      </div>
      {notes.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">Nessuna nota.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {notes.map((n) => {
            const vendor = n.vendorId ? vendorMap[n.vendorId] : null
            const article = n.articleId ? articleMap[n.articleId] : null
            return (
              <div key={n.id} className="flex items-start gap-2 px-3 py-2">
                <input type="checkbox" className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-brand-600" checked={!!n.done} onChange={() => handleToggle(n.id)} />
                <div className="min-w-0 flex-1">
                  {article ? (
                    <button type="button" onClick={() => onOpenArticle(article)} className={`text-left text-sm hover:underline ${n.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {n.text}
                    </button>
                  ) : (
                    <p className={`text-sm ${n.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{n.text}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    {formatDate(n.createdAt.slice(0, 10))}
                    {vendor && (
                      <>
                        {' · '}
                        <Link to={`/venditori/${vendor.id}`} className="text-brand-700 hover:underline">
                          {vendor.name} {vendor.surname}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <button onClick={() => handleDelete(n.id)} className="shrink-0 rounded-full p-1 text-slate-300 hover:bg-red-50 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
