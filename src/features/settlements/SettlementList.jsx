import { useEffect, useMemo, useState } from 'react'
import { FileText, Plus, Download, FileDown, Wallet, Ban, Printer } from 'lucide-react'
import { listInvoices, listVendors, getOrCreateInvoice, getInvoiceArticles, cancelPayment, vendorsWithSalesInPeriod, generateMonthlyInvoices } from '../../services'
import { useSettingsStore } from '../../store/useSettingsStore'
import { toast } from '../../store/useToastStore'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Stat from '../../components/ui/Stat'
import Modal from '../../components/ui/Modal'
import { Field, Input } from '../../components/ui/Field'
import VendorPicker from '../../components/VendorPicker'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import PayModal from './PayModal'
import { formatMoney, formatDate, invoiceLabel, round2 } from '../../lib/business'
import { generateInvoicePdf, generateBulkInvoicePdf } from '../../lib/invoicePdf'
import { downloadCSV } from '../../lib/exportUtils'

function monthBounds(monthStr) {
  const [year, month] = monthStr.split('-').map(Number)
  const from = `${monthStr}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const to = `${monthStr}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

export default function SettlementList() {
  const settings = useSettingsStore((s) => s.settings)
  const [invoices, setInvoices] = useState([])
  const [vendors, setVendors] = useState([])
  const [filter, setFilter] = useState('da_liquidare')
  const [newOpen, setNewOpen] = useState(false)
  const [payTarget, setPayTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [bulkMonth, setBulkMonth] = useState(new Date().toISOString().slice(0, 7))
  const [bulkBusy, setBulkBusy] = useState(false)

  async function reload() {
    setInvoices(await listInvoices())
    setVendors(await listVendors())
  }
  useEffect(() => {
    reload()
  }, [])

  const vendorMap = useMemo(() => Object.fromEntries(vendors.map((v) => [v.id, v])), [vendors])

  const filtered = invoices.filter((i) => (filter === 'da_liquidare' ? !i.paid : filter === 'pagate' ? i.paid : true))

  const totals = useMemo(
    () => ({
      due: round2(invoices.filter((i) => !i.paid).reduce((s, i) => s + i.vendorShare, 0)),
      paid: round2(invoices.filter((i) => i.paid).reduce((s, i) => s + i.vendorShare, 0)),
      openCount: invoices.filter((i) => !i.paid).length,
    }),
    [invoices],
  )

  async function printInvoice(invoice) {
    const vendor = vendorMap[invoice.vendorId]
    const articles = await getInvoiceArticles(invoice)
    const doc = generateInvoicePdf(invoice, vendor, articles, settings)
    doc.save(`distinta-${invoiceLabel(invoice, settings)}.pdf`)
  }

  const [bulkCount, setBulkCount] = useState(0)
  useEffect(() => {
    const { from, to } = monthBounds(bulkMonth)
    vendorsWithSalesInPeriod(from, to).then((ids) => setBulkCount(ids.length))
  }, [bulkMonth, invoices])

  async function handleBulkGenerate() {
    const { from, to } = monthBounds(bulkMonth)
    setBulkBusy(true)
    try {
      const monthInvoices = await generateMonthlyInvoices(from, to)
      if (monthInvoices.length === 0) {
        toast('Nessuna vendita in questo mese', 'info')
        return
      }
      const allVendors = await listVendors()
      const freshVendorMap = Object.fromEntries(allVendors.map((v) => [v.id, v]))
      const items = []
      for (const invoice of monthInvoices) {
        const articles = await getInvoiceArticles(invoice)
        items.push({ invoice, vendor: freshVendorMap[invoice.vendorId], articles })
      }
      const doc = generateBulkInvoicePdf(items, settings)
      doc.save(`distinte-${bulkMonth}.pdf`)
      toast(`${items.length} distinte generate e pronte per la stampa`, 'success')
      reload()
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleCancelPayment() {
    await cancelPayment(cancelTarget.id)
    toast('Pagamento annullato', 'success')
    setCancelTarget(null)
    reload()
  }

  function exportCSV() {
    downloadCSV('distinte.csv', filtered, [
      { header: 'Numero', value: (i) => invoiceLabel(i, settings) },
      { header: 'Venditore', value: (i) => (vendorMap[i.vendorId] ? `${vendorMap[i.vendorId].name} ${vendorMap[i.vendorId].surname}` : '') },
      { header: 'Dal', value: (i) => i.from },
      { header: 'Al', value: (i) => i.to },
      { header: 'Lordo', value: (i) => i.totalGross },
      { header: 'Netto', value: (i) => i.totalNet },
      { header: 'Spettanza venditore', value: (i) => i.vendorShare },
      { header: 'Stato', value: (i) => (i.paid ? 'Pagata' : 'Da liquidare') },
    ])
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
          <FileText size={22} /> Distinte & Pagamenti
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCSV}>
            <Download size={16} /> CSV
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus size={16} /> Nuova distinta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Da liquidare" value={formatMoney(totals.due)} tone="text-amber-600" />
        <Stat label="Liquidato storico" value={formatMoney(totals.paid)} tone="text-brand-700" />
        <Stat label="Distinte aperte" value={totals.openCount} />
      </div>

      <Card>
        <CardHeader title="Distinte del mese" subtitle="Genera e stampa in un colpo solo tutte le distinte dei venditori che hanno venduto qualcosa nel mese scelto" />
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Input type="month" className="w-44" value={bulkMonth} onChange={(e) => setBulkMonth(e.target.value)} />
          <span className="text-sm text-slate-500">{bulkCount} venditori con vendite nel mese</span>
          <Button className="ml-auto" onClick={handleBulkGenerate} disabled={bulkBusy || bulkCount === 0}>
            <Printer size={16} /> Genera e stampa tutte
          </Button>
        </div>
      </Card>

      <div className="flex gap-1 border-b border-slate-200">
        {[
          ['da_liquidare', 'Da liquidare'],
          ['pagate', 'Pagate'],
          ['tutte', 'Tutte'],
        ].map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)} className={`px-3 py-2 text-sm font-medium border-b-2 ${filter === v ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      <Card className="divide-y divide-slate-100 overflow-hidden">
        {filtered.length === 0 && <p className="p-4 text-sm text-slate-400">Nessuna distinta.</p>}
        {filtered.map((inv) => {
          const vendor = vendorMap[inv.vendorId]
          return (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {invoiceLabel(inv, settings)} – {vendor ? `${vendor.name} ${vendor.surname}` : 'Venditore eliminato'}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDate(inv.from)} – {formatDate(inv.to)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={inv.paid ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-800'}>{inv.paid ? 'Pagata' : 'Da liquidare'}</Badge>
                <span className="w-20 text-right text-sm font-semibold tabular-nums">{formatMoney(inv.vendorShare)}</span>
                <Button size="sm" variant="secondary" onClick={() => printInvoice(inv)}>
                  <FileDown size={14} />
                </Button>
                {inv.paid ? (
                  <Button size="sm" variant="ghost" onClick={() => setCancelTarget(inv)}>
                    <Ban size={14} />
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setPayTarget(inv)}>
                    <Wallet size={14} /> Paga
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </Card>

      <NewSettlementModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={async () => {
          await reload()
        }}
      />
      <PayModal open={!!payTarget} invoice={payTarget} onClose={() => setPayTarget(null)} onPaid={reload} />
      <ConfirmDialog
        open={!!cancelTarget}
        title="Annulla pagamento"
        danger
        message="La distinta tornerà nello stato 'da liquidare'."
        onCancel={() => setCancelTarget(null)}
        onConfirm={handleCancelPayment}
      />
    </div>
  )
}

function NewSettlementModal({ open, onClose, onCreated }) {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 8) + '01'
  const [vendorId, setVendorId] = useState(null)
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)

  async function handleCreate() {
    if (!vendorId) return toast('Seleziona un venditore', 'error')
    await getOrCreateInvoice(vendorId, from, to)
    toast('Distinta generata', 'success')
    onCreated()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuova distinta"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleCreate}>Genera</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Venditore">
          <VendorPicker value={vendorId} onChange={setVendorId} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dal">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Al">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
