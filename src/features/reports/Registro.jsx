import { useEffect, useState } from 'react'
import { ScrollText, Download, Trash2, Pencil, FileDown } from 'lucide-react'
import { listLogs, updateLog, deleteLog, deleteFilteredLogs, cashRegisterTotals, cashRegisterByVendor } from '../../services'
import { useSettingsStore } from '../../store/useSettingsStore'
import { toast } from '../../store/useToastStore'
import { Input, Select, Textarea } from '../../components/ui/Field'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Stat from '../../components/ui/Stat'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import VendorPicker from '../../components/VendorPicker'
import { formatMoney, formatDateTime, LOG_TYPE_LABELS } from '../../lib/business'
import { downloadCSV, downloadXLSX } from '../../lib/exportUtils'
import { generateCashSummaryPdf } from '../../lib/invoicePdf'
import { autoBackup } from '../../lib/backup'

export default function Registro() {
  const settings = useSettingsStore((s) => s.settings)
  const [logs, setLogs] = useState([])
  const [filters, setFilters] = useState({ from: '', to: '', type: '', vendorId: null, text: '' })
  const [totals, setTotals] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  async function reload() {
    setLogs(await listLogs(filters))
    setTotals(await cashRegisterTotals({ from: filters.from || undefined, to: filters.to || undefined }))
  }
  useEffect(() => {
    reload()
  }, [filters])

  async function handleDelete(id) {
    await deleteLog(id)
    toast('Voce eliminata', 'success')
    reload()
  }

  async function handleBulkDelete() {
    await autoBackup('prima di eliminare voci di registro filtrate')
    const n = await deleteFilteredLogs(filters)
    toast(`${n} voci eliminate`, 'success')
    setConfirmBulkDelete(false)
    reload()
  }

  function exportCSV() {
    downloadCSV('registro.csv', logs, [
      { header: 'Data', value: (l) => formatDateTime(l.date) },
      { header: 'Tipo', value: (l) => LOG_TYPE_LABELS[l.type] || l.type },
      { header: 'Descrizione', value: (l) => l.description },
    ])
  }

  function exportXLSX() {
    downloadXLSX('registro.xlsx', logs, [
      { header: 'Data', value: (l) => formatDateTime(l.date) },
      { header: 'Tipo', value: (l) => LOG_TYPE_LABELS[l.type] || l.type },
      { header: 'Descrizione', value: (l) => l.description },
    ])
  }

  async function exportPDF() {
    const rows = await cashRegisterByVendor({ from: filters.from || undefined, to: filters.to || undefined })
    const doc = generateCashSummaryPdf(rows, totals, filters.from || null, filters.to || null, settings)
    doc.save('riepilogo-cassa.pdf')
  }

  return (
    <div className="space-y-4 pb-10">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
        <ScrollText size={22} /> Registro di Cassa
      </h1>

      {totals && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Vendite" value={totals.count} />
          <Stat label="Incassato" value={formatMoney(totals.gross)} />
          <Stat label="Imposta trattenuta" value={formatMoney(totals.tax)} />
          <Stat label="Provvigioni mercatino" value={formatMoney(totals.shopShare)} />
          <Stat label="Incasso mercatino" value={formatMoney(totals.shopIncome)} tone="text-brand-700" />
        </div>
      )}

      <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
        <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        <Select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">Tutti i tipi</option>
          {Object.entries(LOG_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <VendorPicker value={filters.vendorId} onChange={(id) => setFilters((f) => ({ ...f, vendorId: id }))} />
        <Input placeholder="Cerca nel testo..." value={filters.text} onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))} />
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={exportCSV}>
          <Download size={14} /> CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={exportXLSX}>
          <Download size={14} /> Excel
        </Button>
        <Button variant="secondary" size="sm" onClick={exportPDF}>
          <FileDown size={14} /> Riepilogo PDF
        </Button>
        <Button variant="danger" size="sm" className="ml-auto" onClick={() => setConfirmBulkDelete(true)}>
          <Trash2 size={14} /> Elimina voci filtrate
        </Button>
      </div>

      <Card className="divide-y divide-slate-100 overflow-hidden">
        {logs.length === 0 && <p className="p-4 text-sm text-slate-400">Nessuna voce di registro.</p>}
        {logs.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate text-slate-700">{l.description}</p>
              <p className="text-xs text-slate-400">
                {formatDateTime(l.date)} · {LOG_TYPE_LABELS[l.type] || l.type}
                {l.manual && ' · modificata'}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => setEditTarget(l)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(l.id)} className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </Card>

      <LogEditModal
        log={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null)
          reload()
        }}
      />
      <ConfirmDialog
        open={confirmBulkDelete}
        title="Elimina voci filtrate"
        danger
        message={`Verranno eliminate ${logs.length} voci corrispondenti ai filtri attuali. Verrà creata un'istantanea di sicurezza.`}
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
      />
    </div>
  )
}

function LogEditModal({ log, onClose, onSaved }) {
  const [description, setDescription] = useState('')
  const [type, setType] = useState('')

  useEffect(() => {
    if (log) {
      setDescription(log.description)
      setType(log.type)
    }
  }, [log])

  if (!log) return null

  async function handleSave() {
    await updateLog(log.id, { description, type })
    onSaved()
  }

  return (
    <Modal
      open={!!log}
      onClose={onClose}
      title="Modifica voce di registro"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleSave}>Salva</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(LOG_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </Modal>
  )
}
