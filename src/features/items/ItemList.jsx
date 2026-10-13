import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  Camera,
  ShoppingCart,
  Undo2,
  RotateCcw,
  Pencil,
  Trash2,
  Tag,
  CalendarClock,
  Package,
  AlertTriangle,
  Coins,
  CalendarRange,
  LogIn,
  LogOut,
} from 'lucide-react'
import { listArticles, listCategories, cancelSale, revertRitiro, deleteArticle, extendMandate, getArticleByCode, bulkSetCategory } from '../../services'
import { useSettingsStore } from '../../store/useSettingsStore'
import { toast } from '../../store/useToastStore'
import { Field, Input, Select } from '../../components/ui/Field'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import VendorPicker from '../../components/VendorPicker'
import BarcodeScannerModal from '../../components/BarcodeScannerModal'
import ItemForm from './ItemForm'
import SellModal from './SellModal'
import RitiroModal from './RitiroModal'
import DepositModal from './DepositModal'
import { formatMoney, formatDate, padCode, getArticleStatus, getCurrentPrice, ARTICLE_STATUS_COLORS, ARTICLE_STATUS_LABELS, getExpiringArticles } from '../../lib/business'

const PAGE_SIZE = 150

export default function ItemList() {
  const settings = useSettingsStore((s) => s.settings)
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ code: '', text: '', vendorId: null, status: '', category: '' })
  const [page, setPage] = useState(1)
  const [view, setView] = useState('tutti') // 'tutti' | 'scadenze' | 'movimenti'
  const todayIso = new Date().toISOString().slice(0, 10)
  const [movFrom, setMovFrom] = useState(todayIso)
  const [movTo, setMovTo] = useState(todayIso)
  const [movFilter, setMovFilter] = useState('entrambi') // 'entrambi' | 'entrati' | 'venduti'
  const [expiringFilter, setExpiringFilter] = useState('in_scadenza') // 'in_scadenza' | 'scaduti' | 'tutti'
  const [formOpen, setFormOpen] = useState(false)
  const [editArticle, setEditArticle] = useState(null)
  const [sellArticleTarget, setSellArticleTarget] = useState(null)
  const [ritiroTarget, setRitiroTarget] = useState(null)
  const [depositTarget, setDepositTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [selected, setSelected] = useState({})
  const [bulkCategory, setBulkCategory] = useState('')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  async function reload() {
    setArticles(await listArticles({}))
    setCategories(await listCategories())
  }

  useEffect(() => {
    reload()
  }, [])

  useEffect(() => {
    if (params.get('new')) {
      setFormOpen(true)
      setParams({}, { replace: true })
    }
    if (params.get('view') === 'scadenze') {
      setView('scadenze')
      setParams({}, { replace: true })
    }
  }, [params])

  useEffect(() => setPage(1), [view, filters, expiringFilter])

  const filtered = useMemo(() => {
    let rows = articles
    if (filters.code) rows = rows.filter((a) => padCode(a.code).includes(filters.code.trim()))
    if (filters.text) {
      const q = filters.text.toLowerCase()
      rows = rows.filter((a) => a.description.toLowerCase().includes(q) || (a.category || '').toLowerCase().includes(q))
    }
    if (filters.vendorId) rows = rows.filter((a) => a.vendorId === filters.vendorId)
    if (filters.category) rows = rows.filter((a) => a.category === filters.category)
    if (filters.status) rows = rows.filter((a) => getArticleStatus(a, settings).status === filters.status)
    return rows.sort((a, b) => b.code - a.code)
  }, [articles, filters, settings])

  const expiring = useMemo(() => getExpiringArticles(articles, settings), [articles, settings])
  const expiringInWarning = useMemo(() => expiring.filter((x) => !x.isExpired), [expiring])
  const expiringExpired = useMemo(() => expiring.filter((x) => x.isExpired), [expiring])
  const expiringRows = useMemo(() => {
    if (expiringFilter === 'in_scadenza') return expiringInWarning
    if (expiringFilter === 'scaduti') return expiringExpired
    return expiring
  }, [expiringFilter, expiring, expiringInWarning, expiringExpired])

  const movEntrati = useMemo(
    () => articles.filter((a) => a.loadDate >= movFrom && a.loadDate <= movTo).sort((a, b) => b.loadDate.localeCompare(a.loadDate)),
    [articles, movFrom, movTo],
  )
  const movVenduti = useMemo(
    () =>
      articles
        .filter((a) => a.status === 'venduto' && a.soldDate && a.soldDate >= movFrom && a.soldDate <= movTo)
        .sort((a, b) => b.soldDate.localeCompare(a.soldDate)),
    [articles, movFrom, movTo],
  )

  const rows = view === 'scadenze' ? expiringRows.map((x) => x.article) : filtered
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const summary = useMemo(() => {
    const listValue = (r) => r.reduce((s, a) => s + a.originalPrice, 0)
    const currentValue = (r) => r.reduce((s, a) => s + getCurrentPrice(a, settings), 0)
    const soldValue = (r) => r.filter((a) => a.status === 'venduto').reduce((s, a) => s + (a.soldPrice || 0), 0)
    return { listValue: listValue(rows), currentValue: currentValue(rows), soldValue: soldValue(rows), count: rows.length }
  }, [rows, settings])

  async function handleScan(code) {
    const article = await getArticleByCode(Number(code))
    if (!article) return toast(`Nessun articolo con codice ${code}`, 'error')
    const status = getArticleStatus(article, settings).status
    if (status === 'venduto') return toast('Articolo già venduto', 'info')
    setSellArticleTarget(article)
  }

  async function handleCancelSale(article) {
    await cancelSale(article.id)
    toast('Vendita annullata', 'success')
    reload()
  }

  async function handleRevert(article) {
    await revertRitiro(article.id)
    toast('Ripristinato come disponibile', 'success')
    reload()
  }

  async function handleExtend(article) {
    await extendMandate(article.id, 30)
    toast('Mandato prorogato di 30 giorni', 'success')
    reload()
  }

  async function handleDelete() {
    await deleteArticle(deleteTarget.id)
    toast('Articolo eliminato', 'success')
    setDeleteTarget(null)
    reload()
  }

  function toggleSelect(id) {
    setSelected((s) => ({ ...s, [id]: !s[id] }))
  }

  function selectAllFiltered() {
    setSelected(Object.fromEntries(rows.map((a) => [a.id, true])))
  }

  function clearSelection() {
    setSelected({})
  }

  const selectedIds = Object.keys(selected).filter((id) => selected[id])

  async function handleApplyBulkCategory() {
    const category = bulkCategory.trim()
    if (!category || selectedIds.length === 0) return
    await bulkSetCategory(selectedIds, category)
    toast(`Categoria assegnata a ${selectedIds.length} articoli`, 'success')
    clearSelection()
    setBulkCategory('')
    reload()
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-800">Articoli</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setScannerOpen(true)}>
            <Camera size={16} /> Scansiona
          </Button>
          <Button
            onClick={() => {
              setEditArticle(null)
              setFormOpen(true)
            }}
          >
            <Plus size={16} /> Nuovo
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <button onClick={() => setView('tutti')} className={`px-3 py-2 text-sm font-medium border-b-2 ${view === 'tutti' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}>
          Tutti gli articoli
        </button>
        <button
          onClick={() => setView('scadenze')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 ${view === 'scadenze' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}
        >
          <AlertTriangle size={14} /> Scadenze ({expiring.length})
        </button>
        <button
          onClick={() => setView('movimenti')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 ${view === 'movimenti' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}
        >
          <CalendarRange size={14} /> Entrate e vendite
        </button>
      </div>

      {view === 'tutti' && (
        <Card className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-8" placeholder="Codice" value={filters.code} onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))} />
          </div>
          <Input placeholder="Descrizione / categoria" value={filters.text} onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))} />
          <VendorPicker value={filters.vendorId} onChange={(id) => setFilters((f) => ({ ...f, vendorId: id }))} />
          <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">Tutti gli stati</option>
            {Object.entries(ARTICLE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">Tutte le categorie</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {view === 'scadenze' && (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <p className="text-xs text-slate-500">
            "In scadenza" = non ancora scaduti ma entro la finestra di preavviso. "Scaduti" = oltre la durata del mandato.
          </p>
          <div className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-1">
            {[
              { value: 'in_scadenza', label: `In scadenza (${expiringInWarning.length})` },
              { value: 'scaduti', label: `Scaduti (${expiringExpired.length})` },
              { value: 'tutti', label: `Tutti (${expiring.length})` },
            ].map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setExpiringFilter(f.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${expiringFilter === f.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {view === 'movimenti' && (
        <MovementsView
          movFrom={movFrom}
          movTo={movTo}
          setMovFrom={setMovFrom}
          setMovTo={setMovTo}
          movFilter={movFilter}
          setMovFilter={setMovFilter}
          entrati={movEntrati}
          venduti={movVenduti}
          onCancelSale={handleCancelSale}
          onDelete={setDeleteTarget}
        />
      )}

      {view !== 'movimenti' && (
      <>
      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div className="rounded-lg bg-slate-100 p-2">
          <div className="font-semibold text-slate-700">{summary.count}</div>
          <div className="text-slate-400">articoli</div>
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <div className="font-semibold text-slate-700">{formatMoney(summary.listValue)}</div>
          <div className="text-slate-400">valore a listino</div>
        </div>
        <div className="rounded-lg bg-slate-100 p-2">
          <div className="font-semibold text-slate-700">{formatMoney(summary.currentValue)}</div>
          <div className="text-slate-400">valore attuale</div>
        </div>
      </div>

      {rows.length > 0 && (
        <Card className="space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button className="font-medium text-brand-700 hover:underline" onClick={selectAllFiltered} type="button">
              Seleziona tutti i {rows.length} risultati
            </button>
            {selectedIds.length > 0 && (
              <button className="text-slate-500 hover:underline" onClick={clearSelection} type="button">
                Deseleziona ({selectedIds.length})
              </button>
            )}
          </div>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                list="category-options"
                placeholder="Categoria da assegnare..."
                className="w-56"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
              />
              <datalist id="category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <Button size="sm" disabled={!bulkCategory.trim()} onClick={handleApplyBulkCategory}>
                Applica a {selectedIds.length} articoli
              </Button>
            </div>
          )}
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Package} title="Nessun articolo trovato" />
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {pageRows.map((a) => {
            const st = getArticleStatus(a, settings)
            return (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 rounded border-slate-300 text-brand-600"
                    checked={!!selected[a.id]}
                    onChange={() => toggleSelect(a.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      <span className="mr-1.5 font-mono text-xs text-slate-400">{padCode(a.code)}</span>
                      {a.description}
                    </p>
                    <p className="text-xs text-slate-400">
                      {a.category && <span className="mr-2">{a.category}</span>}
                      Carico {formatDate(a.loadDate)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {a.depositAmount > 0 && <Badge tone="bg-purple-100 text-purple-700">Acconto {formatMoney(a.depositAmount)}</Badge>}
                      <Badge tone={ARTICLE_STATUS_COLORS[st.status]}>{st.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{formatMoney(getCurrentPrice(a, settings))}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(st.status === 'disponibile' || st.status === 'sconto' || st.status === 'scaduto') && (
                    <RowAction icon={ShoppingCart} label="Vendi" onClick={() => setSellArticleTarget(a)} />
                  )}
                  {st.status === 'venduto' && <RowAction icon={Undo2} label="Annulla vendita" onClick={() => handleCancelSale(a)} />}
                  {(st.status === 'disponibile' || st.status === 'sconto' || st.status === 'scaduto') && (
                    <RowAction icon={RotateCcw} label="Ritira/Rendi" onClick={() => setRitiroTarget(a)} />
                  )}
                  {(st.status === 'disponibile' || st.status === 'sconto' || st.status === 'scaduto') && (
                    <RowAction icon={Coins} label={a.depositAmount > 0 ? `Acconto ${formatMoney(a.depositAmount)}` : 'Acconto'} onClick={() => setDepositTarget(a)} />
                  )}
                  {st.status === 'scaduto' && <RowAction icon={CalendarClock} label="Proroga 30gg" onClick={() => handleExtend(a)} />}
                  {(st.status === 'ritirato' || st.status === 'reso' || st.status === 'devoluto') && (
                    <RowAction icon={RotateCcw} label="Ripristina" onClick={() => handleRevert(a)} />
                  )}
                  <RowAction icon={Tag} label="Etichetta" onClick={() => navigate(`/etichette?code=${a.code}`)} />
                  <RowAction
                    icon={Pencil}
                    label="Modifica"
                    onClick={() => {
                      setEditArticle(a)
                      setFormOpen(true)
                    }}
                  />
                  <RowAction icon={Trash2} label="Elimina" onClick={() => setDeleteTarget(a)} danger />
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Precedente
          </Button>
          <span className="text-slate-500">
            Pagina {page} di {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Successiva
          </Button>
        </div>
      )}
      </>
      )}

      <ItemForm open={formOpen} onClose={() => setFormOpen(false)} article={editArticle} onSaved={reload} />
      <SellModal open={!!sellArticleTarget} article={sellArticleTarget} onClose={() => setSellArticleTarget(null)} onSold={reload} />
      <RitiroModal open={!!ritiroTarget} article={ritiroTarget} onClose={() => setRitiroTarget(null)} onDone={reload} />
      <DepositModal open={!!depositTarget} article={depositTarget} onClose={() => setDepositTarget(null)} onSaved={reload} />
      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={handleScan} />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Elimina articolo"
        danger
        message="L'articolo verrà eliminato definitivamente dall'archivio."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function RowAction({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
        danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

const MOVEMENTS_LIMIT = 300

/** "What came in / what went out" for a chosen day or range, straight from
 * loadDate/soldDate on the articles themselves - a stock-movement view, not
 * a log. Registro answers "what happened in the cash register"; this
 * answers "what physically moved" and needs no cash-register entry to show
 * up (a returned/withdrawn item never appears here as a sale). */
const MOVEMENT_FILTERS = [
  { value: 'entrambi', label: 'Entrambi' },
  { value: 'entrati', label: 'Solo entrati' },
  { value: 'venduti', label: 'Solo venduti' },
]

function MovementsView({ movFrom, movTo, setMovFrom, setMovTo, movFilter, setMovFilter, entrati, venduti, onCancelSale, onDelete }) {
  const todayIso = new Date().toISOString().slice(0, 10)
  const entrantiValue = entrati.reduce((s, a) => s + (a.originalPrice || 0), 0)
  const vendutiValue = venduti.reduce((s, a) => s + (a.soldPrice || 0), 0)

  function setToday() {
    setMovFrom(todayIso)
    setMovTo(todayIso)
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-3">
        <Field label="Dal">
          <Input type="date" value={movFrom} max={movTo} onChange={(e) => setMovFrom(e.target.value)} />
        </Field>
        <Field label="Al">
          <Input type="date" value={movTo} min={movFrom} max={todayIso} onChange={(e) => setMovTo(e.target.value)} />
        </Field>
        <Button variant="secondary" size="sm" onClick={setToday} type="button">
          Oggi
        </Button>
        <div className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-1">
          {MOVEMENT_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setMovFilter(f.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${movFilter === f.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {movFilter !== 'venduti' && (
        <MovementSection
          icon={LogIn}
          title="Entrati"
          tone="text-brand-700"
          count={entrati.length}
          value={entrantiValue}
          valueLabel="valore a listino"
          rows={entrati}
          dateField="loadDate"
          priceField="originalPrice"
          actionLabel="Elimina"
          onAction={onDelete}
        />
      )}
      {movFilter !== 'entrati' && (
        <MovementSection
          icon={LogOut}
          title="Venduti"
          tone="text-amber-700"
          count={venduti.length}
          value={vendutiValue}
          valueLabel="incassato"
          rows={venduti}
          dateField="soldDate"
          priceField="soldPrice"
          actionLabel="Annulla vendita"
          onAction={onCancelSale}
        />
      )}
    </div>
  )
}

function MovementSection({ icon: Icon, title, tone, count, value, valueLabel, rows, dateField, priceField, actionLabel, onAction }) {
  const shown = rows.slice(0, MOVEMENTS_LIMIT)
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <p className={`flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
          <Icon size={15} /> {title} ({count})
        </p>
        <p className="text-sm font-medium text-slate-600">
          {formatMoney(value)} <span className="text-xs font-normal text-slate-400">{valueLabel}</span>
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">Nessun articolo in questo periodo.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {shown.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">
                  <span className="mr-1.5 font-mono text-xs text-slate-400">{padCode(a.code)}</span>
                  {a.description}
                </p>
                <p className="text-xs text-slate-400">{formatDate(a[dateField])}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold tabular-nums text-slate-800">{formatMoney(a[priceField])}</span>
                <RowAction icon={Undo2} label={actionLabel} onClick={() => onAction(a)} danger={actionLabel === 'Elimina'} />
              </div>
            </div>
          ))}
          {rows.length > MOVEMENTS_LIMIT && (
            <p className="p-3 text-center text-xs text-amber-600">Mostrati i primi {MOVEMENTS_LIMIT} di {rows.length}: restringi il periodo per vederli tutti.</p>
          )}
        </div>
      )}
    </Card>
  )
}
