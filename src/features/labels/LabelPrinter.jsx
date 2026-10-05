import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tag, Printer, Download, Search } from 'lucide-react'
import { listArticles, listVendors, markLabelPrinted } from '../../services'
import { useSettingsStore } from '../../store/useSettingsStore'
import { toast } from '../../store/useToastStore'
import { Input, Select, Checkbox } from '../../components/ui/Field'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import VendorPicker from '../../components/VendorPicker'
import LabelSheet from './LabelSheet'
import { padCode, formatMoney, formatDate, getCurrentPrice, LABEL_PRESETS } from '../../lib/business'
import { downloadCSV } from '../../lib/exportUtils'

const DEFAULT_ELEMENTS = { barcode: true, code: true, description: true, price: true, date: false, vendor: false }

export default function LabelPrinter() {
  const settings = useSettingsStore((s) => s.settings)
  const [articles, setArticles] = useState([])
  const [vendors, setVendors] = useState([])
  const [filters, setFilters] = useState({ code: '', text: '', vendorId: null, onlyUnprinted: false })
  const [selected, setSelected] = useState({})
  const [elements, setElements] = useState({ ...DEFAULT_ELEMENTS, vendor: settings.hardware.showVendorOnLabel })
  const [format, setFormat] = useState(settings.hardware.labelPrinterFormat)
  const [params] = useSearchParams()

  async function reload() {
    setArticles((await listArticles({})).filter((a) => a.status !== 'venduto' && a.status !== 'ritirato'))
    setVendors(await listVendors())
  }
  useEffect(() => {
    reload()
  }, [])

  useEffect(() => {
    const code = params.get('code')
    if (code) setFilters((f) => ({ ...f, code }))
  }, [params])

  const vendorMap = useMemo(() => Object.fromEntries(vendors.map((v) => [v.id, v])), [vendors])

  const filtered = useMemo(() => {
    let rows = articles
    if (filters.code) rows = rows.filter((a) => padCode(a.code).includes(filters.code.trim()))
    if (filters.text) rows = rows.filter((a) => a.description.toLowerCase().includes(filters.text.toLowerCase()))
    if (filters.vendorId) rows = rows.filter((a) => a.vendorId === filters.vendorId)
    if (filters.onlyUnprinted) rows = rows.filter((a) => !a.labelPrintedAt)
    return rows.sort((a, b) => b.code - a.code)
  }, [articles, filters])

  useEffect(() => {
    if (filters.code && filtered.length) {
      setSelected(Object.fromEntries(filtered.map((a) => [a.id, true])))
    }
  }, [filtered.length])

  const selectedArticles = filtered.filter((a) => selected[a.id])

  function toggleAll(value) {
    setSelected(Object.fromEntries(filtered.map((a) => [a.id, value])))
  }

  async function handlePrint() {
    if (selectedArticles.length === 0) return toast('Seleziona almeno un articolo', 'error')
    setTimeout(async () => {
      window.print()
      await markLabelPrinted(selectedArticles.map((a) => a.id))
      reload()
    }, 50)
  }

  function exportForExternalSoftware() {
    downloadCSV('etichette-export.csv', selectedArticles.length ? selectedArticles : filtered, [
      { header: 'code', value: (a) => padCode(a.code) },
      { header: 'description', value: (a) => a.description },
      { header: 'category', value: (a) => a.category },
      { header: 'price', value: (a) => getCurrentPrice(a, settings) },
      { header: 'originalPrice', value: (a) => a.originalPrice },
      { header: 'vendorName', value: (a) => (vendorMap[a.vendorId] ? `${vendorMap[a.vendorId].name} ${vendorMap[a.vendorId].surname}` : '') },
      { header: 'loadDate', value: (a) => formatDate(a.loadDate) },
      { header: 'shopName', value: () => settings.shop.name },
    ])
  }

  return (
    <div className="space-y-4 pb-10">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
        <Tag size={22} /> Etichette
      </h1>

      <Card className="space-y-3 p-4 no-print">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-8" placeholder="Codice" value={filters.code} onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))} />
          </div>
          <Input placeholder="Descrizione" value={filters.text} onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))} />
          <VendorPicker value={filters.vendorId} onChange={(id) => setFilters((f) => ({ ...f, vendorId: id }))} />
          <Checkbox label="Solo mai stampate" checked={filters.onlyUnprinted} onChange={(e) => setFilters((f) => ({ ...f, onlyUnprinted: e.target.checked }))} />
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3">
          <Select className="w-56" value={format} onChange={(e) => setFormat(e.target.value)}>
            {Object.entries(LABEL_PRESETS).map(([key, p]) => (
              <option key={key} value={key}>
                {p.name}
              </option>
            ))}
          </Select>
          {Object.entries({ barcode: 'Codice a barre', code: 'Codice', description: 'Descrizione', price: 'Prezzo', date: 'Data carico', vendor: 'Venditore' }).map(([key, label]) => (
            <Checkbox key={key} label={label} checked={elements[key]} onChange={(e) => setElements((el) => ({ ...el, [key]: e.target.checked }))} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" size="sm" onClick={() => toggleAll(true)}>
            Seleziona tutti ({filtered.length})
          </Button>
          <Button variant="secondary" size="sm" onClick={() => toggleAll(false)}>
            Deseleziona
          </Button>
          <Button variant="secondary" size="sm" onClick={exportForExternalSoftware}>
            <Download size={14} /> Esporta CSV
          </Button>
          <Button size="sm" className="ml-auto" onClick={handlePrint}>
            <Printer size={14} /> Stampa {selectedArticles.length} etichette
          </Button>
        </div>
      </Card>

      <Card className="divide-y divide-slate-100 overflow-hidden no-print">
        {filtered.length === 0 && <p className="p-4 text-sm text-slate-400">Nessun articolo trovato.</p>}
        {filtered.map((a) => (
          <label key={a.id} className="flex items-center gap-3 px-4 py-2 text-sm">
            <input type="checkbox" className="size-4 rounded border-slate-300 text-brand-600" checked={!!selected[a.id]} onChange={(e) => setSelected((s) => ({ ...s, [a.id]: e.target.checked }))} />
            <span className="font-mono text-xs text-slate-400">{padCode(a.code)}</span>
            <span className="flex-1 truncate">{a.description}</span>
            {!a.labelPrintedAt && <span className="text-xs text-amber-600">mai stampata</span>}
            <span className="font-medium tabular-nums">{formatMoney(getCurrentPrice(a, settings))}</span>
          </label>
        ))}
      </Card>

      <LabelSheet articles={selectedArticles} vendorMap={vendorMap} settings={{ ...settings, hardware: { ...settings.hardware, labelPrinterFormat: format } }} elements={elements} />
    </div>
  )
}
