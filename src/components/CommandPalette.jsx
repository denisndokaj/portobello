import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight } from 'lucide-react'
import { listArticles, searchVendors } from '../services'
import { padCode } from '../lib/business'
import { NAV_ITEMS } from '../lib/nav'
import { Plus, Users, Tag } from 'lucide-react'

const STATIC_ACTIONS = [
  ...NAV_ITEMS.map((n) => ({ id: `nav-${n.to}`, label: `Vai a ${n.label}`, icon: n.icon, go: n.to })),
  { id: 'new-article', label: 'Nuovo articolo', icon: Plus, go: '/articoli?new=1' },
  { id: 'new-vendor', label: 'Nuovo venditore', icon: Users, go: '/venditori?new=1' },
  { id: 'export-labels', label: 'Esporta etichette', icon: Tag, go: '/etichette' },
]

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [articles, setArticles] = useState([])
  const [vendors, setVendors] = useState([])
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!query.trim()) {
        setArticles([])
        setVendors([])
        return
      }
      const [a, v] = await Promise.all([
        listArticles({ code: /^\d+$/.test(query) ? query : undefined, text: /^\d+$/.test(query) ? undefined : query }),
        searchVendors(query),
      ])
      setArticles(a.slice(0, 8))
      setVendors(v.slice(0, 6))
    }, 150)
    return () => clearTimeout(t)
  }, [query])

  const actions = query.trim() ? STATIC_ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase())) : STATIC_ACTIONS.slice(0, 9)

  const results = [
    ...actions.map((a) => ({ type: 'action', key: a.id, label: a.label, icon: a.icon, onSelect: () => navigate(a.go) })),
    ...vendors.map((v) => ({ type: 'vendor', key: `v${v.id}`, label: `${v.name} ${v.surname}`, hint: v.cf, onSelect: () => navigate(`/venditori/${v.id}`) })),
    ...articles.map((a) => ({ type: 'article', key: `a${a.id}`, label: `${padCode(a.code)} – ${a.description}`, hint: `€ ${a.originalPrice}`, onSelect: () => navigate(`/articoli?focus=${a.id}`) })),
  ].slice(0, 40)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => Math.min(i + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        results[active]?.onSelect()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, results, active, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 pt-20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder="Cerca codice, descrizione, venditore o pagina..."
            className="flex-1 text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400">Esc</kbd>
        </div>
        <div className="max-h-96 overflow-y-auto py-2">
          {results.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">Nessun risultato</p>}
          {results.map((r, i) => (
            <button
              key={r.key}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                r.onSelect()
                onClose()
              }}
              className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm ${i === active ? 'bg-brand-50 text-brand-700' : 'text-slate-700'}`}
            >
              <span className="flex items-center gap-2 truncate">
                {r.icon && <r.icon size={15} className="shrink-0 text-slate-400" />}
                <span className="truncate">{r.label}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-400">
                {r.hint}
                {i === active && <ArrowRight size={13} />}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
