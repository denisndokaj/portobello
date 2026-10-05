import { useEffect, useRef, useState } from 'react'
import { ShoppingCart, Camera, X, Printer, Undo2, CheckCircle2 } from 'lucide-react'
import { getArticleByCode, sellArticle, cancelSale } from '../../services'
import { useSettingsStore } from '../../store/useSettingsStore'
import { toast } from '../../store/useToastStore'
import { useCartStore } from '../../store/useCartStore'
import Button from '../../components/ui/Button'
import Card, { CardHeader } from '../../components/ui/Card'
import { Input, Select } from '../../components/ui/Field'
import NumericKeypad from '../../components/NumericKeypad'
import BarcodeScannerModal from '../../components/BarcodeScannerModal'
import Receipt from './Receipt'
import { formatMoney, padCode, getArticleStatus, getCurrentPrice, PAYMENT_METHODS } from '../../lib/business'

export default function Pos() {
  const settings = useSettingsStore((s) => s.settings)
  const { lines, paymentMethod, addLine, updatePrice, removeLine, setPaymentMethod, clear, total } = useCartStore()
  const [code, setCode] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [session, setSession] = useState([])
  const [lastReceipt, setLastReceipt] = useState(null)
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
      await sellArticle(line.article.id, { price: Number(line.price), date, paymentMethod })
      sold.push({ article: line.article, price: Number(line.price) })
    }
    const sale = { date: new Date().toISOString(), method: paymentMethod, lines: sold, total: sold.reduce((s, l) => s + l.price, 0) }
    setSession((s) => [sale, ...s])
    setLastReceipt(sale)
    clear()
    toast('Vendita registrata', 'success')
  }

  async function undoSale(sale, saleIndex) {
    for (const line of sale.lines) await cancelSale(line.article.id)
    setSession((s) => s.filter((_, i) => i !== saleIndex))
    toast('Vendita annullata', 'success')
  }

  function printLast() {
    if (!lastReceipt) return toast('Nessuno scontrino da stampare', 'info')
    setTimeout(() => window.print(), 50)
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
          <ShoppingCart size={22} /> Cassa
        </h1>
        <Button variant="secondary" size="sm" onClick={printLast}>
          <Printer size={16} /> Ultimo scontrino
        </Button>
      </div>

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
          <NumericKeypad
            onDigit={(d) => setCode((c) => c + d)}
            onClear={() => setCode((c) => c.slice(0, -1))}
            onEnter={() => resolveCode(code)}
          />
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
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Metodo di pagamento</span>
            <Select className="w-40" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Totale</span>
            <span className="tabular-nums">{formatMoney(total())}</span>
          </div>
          <Button className="w-full" size="lg" onClick={handleCheckout} disabled={lines.length === 0}>
            <CheckCircle2 size={18} /> Conferma vendita
          </Button>
        </div>
      </Card>

      {session.length > 0 && (
        <Card>
          <CardHeader title="Vendite di questa sessione" />
          <div className="divide-y divide-slate-100">
            {session.map((sale, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-slate-700">{formatMoney(sale.total)}</p>
                  <p className="text-xs text-slate-400">{sale.lines.length} articoli · {new Date(sale.date).toLocaleTimeString('it-IT')}</p>
                </div>
                <button onClick={() => undoSale(sale, i)} className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  <Undo2 size={13} /> Annulla
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={resolveCode} />
      <Receipt sale={lastReceipt} settings={settings} />
    </div>
  )
}
