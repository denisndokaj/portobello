import { useEffect, useMemo, useState } from 'react'
import { CheckSquare, Search, Undo2 } from 'lucide-react'
import { listArticles, sellArticle, cancelSale } from '../../services'
import { useSettingsStore } from '../../store/useSettingsStore'
import { toast } from '../../store/useToastStore'
import { Input, Checkbox } from '../../components/ui/Field'
import Button from '../../components/ui/Button'
import Card, { CardHeader } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import VendorPicker from '../../components/VendorPicker'
import { formatMoney, padCode, getArticleStatus, getCurrentPrice, ARTICLE_STATUS_COLORS } from '../../lib/business'

const RESULT_LIMIT = 200

export default function SalesSearch() {
  const settings = useSettingsStore((s) => s.settings)
  const [query, setQuery] = useState('')
  const [vendorId, setVendorId] = useState(null)
  const [showSold, setShowSold] = useState(false)
  const [articles, setArticles] = useState([])
  const [selected, setSelected] = useState({})
  const [prices, setPrices] = useState({})
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10))
  const [session, setSession] = useState([])

  async function reload() {
    setArticles(await listArticles({}))
  }
  useEffect(() => {
    reload()
  }, [])

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
    setSelected((s) => {
      const next = { ...s, [article.id]: !s[article.id] }
      return next
    })
    setPrices((p) => (p[article.id] !== undefined ? p : { ...p, [article.id]: getCurrentPrice(article, settings) }))
  }

  const selectedIds = Object.keys(selected).filter((id) => selected[id])

  async function confirmSelected() {
    if (selectedIds.length === 0) return
    const sold = []
    for (const id of selectedIds) {
      const article = articles.find((a) => a.id === Number(id))
      const price = Number(prices[id] ?? getCurrentPrice(article, settings))
      await sellArticle(article.id, { price, date: saleDate })
      sold.push({ article, price })
    }
    setSession((s) => [{ date: new Date().toISOString(), lines: sold }, ...s])
    toast(`${sold.length} articoli venduti`, 'success')
    setSelected({})
    setPrices({})
    reload()
  }

  async function sellOne(article) {
    const price = prices[article.id] ?? getCurrentPrice(article, settings)
    await sellArticle(article.id, { price: Number(price), date: saleDate })
    setSession((s) => [{ date: new Date().toISOString(), lines: [{ article, price: Number(price) }] }, ...s])
    toast('Articolo venduto', 'success')
    reload()
  }

  async function undoSale(sale, i) {
    for (const line of sale.lines) await cancelSale(line.article.id)
    setSession((s) => s.filter((_, idx) => idx !== i))
    reload()
    toast('Vendita annullata', 'success')
  }

  return (
    <div className="space-y-4 pb-10">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
        <CheckSquare size={22} /> Segna Venduti
      </h1>

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
          return (
            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
              {!sold && <input type="checkbox" className="size-4 rounded border-slate-300 text-brand-600" checked={!!selected[a.id]} onChange={() => toggleSelect(a)} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  <span className="mr-1.5 font-mono text-xs text-slate-400">{padCode(a.code)}</span>
                  {a.description}
                </p>
                <Badge tone={ARTICLE_STATUS_COLORS[st.status]} className="mt-0.5">
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

      {session.length > 0 && (
        <Card>
          <CardHeader title="Vendite di questa sessione" />
          <div className="divide-y divide-slate-100">
            {session.map((sale, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-600">
                  {sale.lines.length} articoli – {formatMoney(sale.lines.reduce((s, l) => s + l.price, 0))}
                </span>
                <button onClick={() => undoSale(sale, i)} className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  <Undo2 size={13} /> Annulla
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
