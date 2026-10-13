import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ShoppingCart, Search, Camera, X, Printer, CheckCircle2 } from 'lucide-react'
import { getArticleByCode, listArticles, listVendors, sellArticle, cancelSale } from '../../services'
import { useSettingsStore } from '../../store/useSettingsStore'
import { toast } from '../../store/useToastStore'
import { useCartStore } from '../../store/useCartStore'
import Button from '../../components/ui/Button'
import Card, { CardHeader } from '../../components/ui/Card'
import { Input, Checkbox } from '../../components/ui/Field'
import Badge from '../../components/ui/Badge'
import NumericKeypad from '../../components/NumericKeypad'
import BarcodeScannerModal from '../../components/BarcodeScannerModal'
import VendorPicker from '../../components/VendorPicker'
import MovementsPanel from '../items/MovementsPanel'
import ItemForm from '../items/ItemForm'
import Receipt from './Receipt'
import { formatMoney, formatDate, padCode, getArticleStatus, getCurrentPrice, ARTICLE_STATUS_COLORS } from '../../lib/business'

const RESULT_LIMIT = 200

const MODES = [
  { value: 'scansione', label: 'Scansione rapida' },
  { value: 'ricerca', label: 'Ricerca e selezione' },
]

export default function SellPage() {
  const settings = useSettingsStore((s) => s.settings)
  const [params] = useSearchParams()
  const [mode, setMode] = useState(params.get('modo') === 'ricerca' ? 'ricerca' : 'scansione')
  const [articles, setArticles] = useState([])
  const [vendors, setVendors] = useState([])
  const [lastReceipt, setLastReceipt] = useState(null)
  const [editArticle, setEditArticle] = useState(null)
  const [itemFormOpen, setItemFormOpen] = useState(false)

  async function reload() {
    setArticles(await listArticles({}))
    setVendors(await listVendors())
  }
  useEffect(() => {
    reload()
  }, [])

  function openArticle(article) {
    setEditArticle(article)
    setItemFormOpen(true)
  }

  async function handleCancelSale(article) {
    await cancelSale(article.id)
    toast('Vendita annullata', 'success')
    reload()
  }

  function printLast() {
    if (!lastReceipt) return toast('Nessuno scontrino da stampare', 'info')
    setTimeout(() => window.print(), 50)
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
          <ShoppingCart size={22} /> Vendi
        </h1>
        {mode === 'scansione' && (
          <Button variant="secondary" size="sm" onClick={printLast}>
            <Printer size={16} /> Ultimo scontrino
          </Button>
        )}
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === m.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'scansione' ? (
        <ScanMode settings={settings} onSold={reload} onReceipt={setLastReceipt} />
      ) : (
        <SearchMode settings={settings} articles={articles} vendors={vendors} onSold={reload} onEditArticle={openArticle} />
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Vendite di oggi</h2>
        <MovementsPanel
          articles={articles}
          vendors={vendors}
          lockFilter="venduti"
          hideRangePicker
          onCancelSale={handleCancelSale}
          onDelete={() => {}}
          onEdit={openArticle}
        />
      </div>

      <ItemForm open={itemFormOpen} onClose={() => setItemFormOpen(false)} article={editArticle} onSaved={reload} />
      <Receipt sale={lastReceipt} settings={settings} />
    </div>
  )
}

function ScanMode({ settings, onSold, onReceipt }) {
  const { lines, addLine, updatePrice, removeLine, clear, total } = useCartStore()
  const [code, setCode] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const inputRef = useRef(null)
  const autoMode = settings.business.quickSellPriceMode === 'auto'

  useEffect(() => inputRef.current?.focus(), [])

  async function resolveCode(raw) {
    const n = Number(String(raw).replace(/\D/g, ''))
    if (!n) return
    const article = await getArticleByCode(n)
    setCode('')
    if (!article) return toast(`Nessun articolo con codice ${raw}`, 'error')
    const status = getArticleStatus(article, settings).status
    if (status === 'venduto') return toast('Articolo già venduto', 'error')
    if (status === 'ritirato' || status === 'reso' || status === 'devoluto') return toast('Articolo non disponibile (ritirato)', 'error')
    const price = getCurrentPrice(article, settings)
    addLine(article, price)
    toast(`Aggiunto: ${article.description}`, 'success')
  }

  async function handleCheckout() {
    if (lines.length === 0) return
    const date = new Date().toISOString().slice(0, 10)
    const sold = []
    for (const line of lines) {
      await sellArticle(line.article.id, { price: Number(line.price), date })
      sold.push({ article: line.article, price: Number(line.price) })
    }
    onReceipt({ date: new Date().toISOString(), lines: sold, total: sold.reduce((s, l) => s + l.price, 0) })
    clear()
    toast('Vendita registrata', 'success')
    onSold()
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && resolveCode(code)}
            placeholder="Codice articolo (scanner o digitazione)"
            inputMode="numeric"
            className="text-lg"
          />
          <Button variant="secondary" onClick={() => setScannerOpen(true)}>
            <Camera size={18} />
          </Button>
        </div>
        <div className="mt-3">
          <NumericKeypad onDigit={(d) => setCode((c) => c + d)} onClear={() => setCode((c) => c.slice(0, -1))} onEnter={() => resolveCode(code)} />
        </div>
      </Card>

      <Card>
        <CardHeader title={`Carrello (${lines.length})`} />
        {lines.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">Nessun articolo nel carrello.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {lines.map((l) => (
              <div key={l.article.id} className="flex items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    <span className="mr-1 font-mono text-xs text-slate-400">{padCode(l.article.code)}</span>
                    {l.article.description}
                  </p>
                </div>
                <Input type="number" step="0.01" className="w-24 text-right" value={l.price} onChange={(e) => updatePrice(l.article.id, e.target.value)} disabled={autoMode} />
                <button onClick={() => removeLine(l.article.id)} className="text-slate-400 hover:text-red-500">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-3 border-t border-slate-100 p-4">
          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Totale</span>
            <span className="tabular-nums">{formatMoney(total())}</span>
          </div>
          <Button className="w-full" size="lg" onClick={handleCheckout} disabled={lines.length === 0}>
            <CheckCircle2 size={18} /> Conferma vendita
          </Button>
        </div>
      </Card>

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={resolveCode} />
    </>
  )
}

function SearchMode({ settings, articles, vendors, onSold, onEditArticle }) {
  const [query, setQuery] = useState('')
  const [vendorId, setVendorId] = useState(null)
  const [showSold, setShowSold] = useState(false)
  const [selected, setSelected] = useState({})
  const [prices, setPrices] = useState({})
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10))

  const vendorMap = useMemo(() => Object.fromEntries(vendors.map((v) => [v.id, v])), [vendors])

  const results = useMemo(() => {
    let rows = articles
    if (!showSold) rows = rows.filter((a) => a.status !== 'venduto' && a.status !== 'ritirato')
    if (vendorId) rows = rows.filter((a) => a.vendorId === vendorId)
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length) {
      rows = rows.filter((a) => {
        const codeStr = padCode(a.code)
        const haystack = `${codeStr} ${a.description} ${a.category || ''}`.toLowerCase()
        return terms.every((t) => (/^\d+$/.test(t) ? codeStr.includes(t) : haystack.includes(t)))
      })
    }
    return rows.sort((a, b) => b.code - a.code).slice(0, RESULT_LIMIT)
  }, [articles, query, vendorId, showSold])

  function toggleSelect(article) {
    setSelected((s) => ({ ...s, [article.id]: !s[article.id] }))
    setPrices((p) => (p[article.id] !== undefined ? p : { ...p, [article.id]: getCurrentPrice(article, settings) }))
  }

  const selectedIds = Object.keys(selected).filter((id) => selected[id])

  async function confirmSelected() {
    if (selectedIds.length === 0) return
    for (const id of selectedIds) {
      const article = articles.find((a) => a.id === Number(id))
      const price = Number(prices[id] ?? getCurrentPrice(article, settings))
      await sellArticle(article.id, { price, date: saleDate })
    }
    toast(`${selectedIds.length} articoli venduti`, 'success')
    setSelected({})
    setPrices({})
    onSold()
  }

  async function sellOne(article) {
    const price = prices[article.id] ?? getCurrentPrice(article, settings)
    await sellArticle(article.id, { price: Number(price), date: saleDate })
    toast('Articolo venduto', 'success')
    onSold()
  }

  return (
    <>
      <Card className="space-y-3 p-4">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-8" placeholder="Codice parziale o testo (descrizione, categoria, venditore)..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <VendorPicker value={vendorId} onChange={setVendorId} />
          </div>
          <Input type="date" className="w-40" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          <Checkbox label="Mostra anche i già venduti" checked={showSold} onChange={(e) => setShowSold(e.target.checked)} />
          {selectedIds.length > 0 && (
            <Button size="sm" className="ml-auto" onClick={confirmSelected}>
              Vendi {selectedIds.length} selezionati
            </Button>
          )}
        </div>
        {results.length >= RESULT_LIMIT && <p className="text-xs text-amber-600">Troppi risultati: restringi la ricerca per vederli tutti.</p>}
      </Card>

      <Card className="divide-y divide-slate-100 overflow-hidden">
        {results.length === 0 && <p className="p-4 text-sm text-slate-400">Nessun articolo trovato.</p>}
        {results.map((a) => {
          const st = getArticleStatus(a, settings)
          const sold = a.status === 'venduto'
          const vendor = vendorMap[a.vendorId]
          return (
            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
              {!sold && <input type="checkbox" className="size-4 rounded border-slate-300 text-brand-600" checked={!!selected[a.id]} onChange={() => toggleSelect(a)} />}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onEditArticle(a)}
                onKeyDown={(e) => e.key === 'Enter' && onEditArticle(a)}
                className="min-w-0 flex-1 cursor-pointer text-left"
              >
                <p className="truncate text-sm font-medium text-slate-800">
                  <span className="mr-1.5 font-mono text-xs text-slate-400">{padCode(a.code)}</span>
                  {a.description}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  Carico {formatDate(a.loadDate)}
                  {vendor && (
                    <>
                      {' · '}
                      <Link to={`/venditori/${vendor.id}`} className="text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {vendor.name} {vendor.surname}
                      </Link>
                    </>
                  )}
                </p>
                <Badge tone={ARTICLE_STATUS_COLORS[st.status]} className="mt-1">
                  {st.label}
                </Badge>
              </div>
              {!sold ? (
                <>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-24 text-right"
                    value={prices[a.id] ?? getCurrentPrice(a, settings)}
                    onChange={(e) => setPrices((p) => ({ ...p, [a.id]: e.target.value }))}
                  />
                  <Button size="sm" variant="secondary" onClick={() => sellOne(a)}>
                    Vendi
                  </Button>
                </>
              ) : (
                <span className="w-24 text-right text-sm font-medium tabular-nums">{formatMoney(a.soldPrice)}</span>
              )}
            </div>
          )
        })}
      </Card>
    </>
  )
}
