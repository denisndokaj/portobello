import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, FileDown, MessageCircle, Mail, Wallet, Plus } from 'lucide-react'
import { getVendor, vendorStats, deleteVendor, listArticles, listInvoices, getOrCreateInvoice } from '../../services'
import { useSettingsStore } from '../../store/useSettingsStore'
import { toast } from '../../store/useToastStore'
import Stat from '../../components/ui/Stat'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Field, Input, Textarea } from '../../components/ui/Field'
import VendorForm from './VendorForm'
import QuickAddArticlesModal from './QuickAddArticlesModal'
import { formatMoney, formatDate, padCode, getArticleStatus, getCurrentPrice, ARTICLE_STATUS_COLORS, ARTICLE_STATUS_LABELS, invoiceLabel } from '../../lib/business'
import { generateMandatePdf, DEFAULT_RECESSO_CLAUSE } from '../../lib/mandatePdf'
import { generateReceiptPdf } from '../../lib/invoicePdf'
import { buildWhatsAppLink, buildMailtoLink, vendorStatementMessage } from '../../lib/share'

const TABS = ['Articoli', 'Mandato', 'Distinte', 'Contatta']

export default function VendorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const settings = useSettingsStore((s) => s.settings)
  const [vendor, setVendor] = useState(null)
  const [stats, setStats] = useState(null)
  const [articles, setArticles] = useState([])
  const [invoices, setInvoices] = useState([])
  const [tab, setTab] = useState('Articoli')
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  async function reload() {
    const [v, s, a, inv] = await Promise.all([getVendor(id), vendorStats(id), listArticles({ vendorId: id }), listInvoices({ vendorId: id })])
    setVendor(v)
    setStats(s)
    setArticles(a)
    setInvoices(inv)
  }

  useEffect(() => {
    reload()
  }, [id])

  async function handleDelete() {
    try {
      await deleteVendor(id)
      toast('Venditore eliminato', 'success')
      navigate('/venditori')
    } catch (e) {
      toast(e.message, 'error')
      setConfirmDelete(false)
    }
  }

  if (!vendor || !stats) return <p className="text-sm text-slate-400">Caricamento...</p>

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/venditori')} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <h1 className="flex-1 truncate text-xl font-semibold text-slate-800">
          {vendor.name} {vendor.surname}
        </h1>
        <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil size={14} /> Modifica
        </Button>
        <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={14} />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Totale venduto" value={formatMoney(stats.totalSold)} />
        <Stat label="Provvigione spettante" value={formatMoney(stats.vendorShareTotal)} />
        <Stat label="Già liquidato" value={formatMoney(stats.alreadyPaid)} />
        <Stat label="Saldo da liquidare" value={formatMoney(stats.balanceDue)} tone={stats.balanceDue > 0 ? 'text-amber-600' : 'text-brand-700'} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Articoli' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReceiptButton vendor={vendor} settings={settings} />
            <Button size="sm" onClick={() => setQuickAddOpen(true)}>
              <Plus size={14} /> Aggiungi articoli
            </Button>
          </div>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {articles.length === 0 && <p className="p-4 text-sm text-slate-400">Nessun articolo per questo venditore.</p>}
          {articles.map((a) => {
            const st = getArticleStatus(a, settings)
            return (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">
                    <span className="font-mono text-xs text-slate-400">{padCode(a.code)}</span> {a.description}
                  </p>
                  <p className="text-xs text-slate-400">Carico {formatDate(a.loadDate)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={ARTICLE_STATUS_COLORS[st.status]}>{ARTICLE_STATUS_LABELS[st.status]}</Badge>
                  <span className="w-16 text-right text-sm font-medium tabular-nums">{formatMoney(getCurrentPrice(a, settings))}</span>
                </div>
              </div>
            )
          })}
          </Card>
        </div>
      )}

      {tab === 'Mandato' && <MandateTab vendor={vendor} settings={settings} />}

      {tab === 'Distinte' && <SettlementsTab vendorId={vendor.id} invoices={invoices} settings={settings} reload={reload} />}

      {tab === 'Contatta' && <ContactTab vendor={vendor} stats={stats} settings={settings} />}

      <VendorForm open={editOpen} onClose={() => setEditOpen(false)} vendor={vendor} onSaved={reload} />
      <QuickAddArticlesModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} vendor={vendor} onDone={reload} />
      <ConfirmDialog
        open={confirmDelete}
        title="Elimina venditore"
        danger
        message="Il venditore verrà eliminato definitivamente. Non è possibile se ha ancora articoli associati."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function ReceiptButton({ vendor, settings }) {
  const today = new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  async function handleGenerate() {
    const articles = await listArticles({ vendorId: vendor.id })
    const loaded = articles.filter((a) => a.loadDate >= from && a.loadDate <= to)
    if (loaded.length === 0) return toast('Nessun articolo caricato in questo periodo', 'info')
    const doc = generateReceiptPdf(vendor, loaded, settings, { from, to })
    doc.save(`distinta-ricevimento-${vendor.surname}-${from}-${to}.pdf`)
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <FileDown size={14} /> Distinta di ricevimento
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Distinta di ricevimento merce"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleGenerate}>Genera PDF</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Carico dal">
            <Input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Al">
            <Input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-slate-400">Elenca gli articoli caricati in questo periodo, con il netto stimato alle condizioni attuali.</p>
      </Modal>
    </>
  )
}

function MandateTab({ vendor, settings }) {
  const [months, setMonths] = useState(settings.business.mandateDurationMonths)
  const [commissionPercent, setCommissionPercent] = useState(vendor.commission ?? settings.business.defaultCommissionPercent)
  const [recessoClause, setRecessoClause] = useState(DEFAULT_RECESSO_CLAUSE)

  function handleGenerate() {
    const doc = generateMandatePdf(vendor, settings, { months, commissionPercent, recessoClause })
    doc.save(`mandato-${vendor.surname}-${vendor.name}.pdf`)
  }

  return (
    <Card>
      <CardHeader title="Genera mandato di vendita" subtitle="Parametri specifici per questo documento" />
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Durata (mesi)">
          <Input type="number" min={1} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
        </Field>
        <Field label="Commissione mercatino (%)">
          <Input type="number" min={0} max={100} value={commissionPercent} onChange={(e) => setCommissionPercent(Number(e.target.value))} />
        </Field>
        <Field label="Clausola di recesso" className="sm:col-span-2">
          <Textarea rows={3} value={recessoClause} onChange={(e) => setRecessoClause(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end border-t border-slate-100 p-4">
        <Button onClick={handleGenerate}>
          <FileDown size={16} /> Genera PDF
        </Button>
      </div>
    </Card>
  )
}

function SettlementsTab({ vendorId, invoices, settings, reload }) {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date().toISOString().slice(0, 8) + '01'
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)

  async function handleGenerate() {
    await getOrCreateInvoice(vendorId, from, to)
    toast('Distinta generata/aggiornata', 'success')
    reload()
  }

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Dal">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Al">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button onClick={handleGenerate}>
            <Wallet size={16} /> Genera distinta periodo
          </Button>
        </div>
      </Card>
      <Card className="divide-y divide-slate-100 overflow-hidden">
        {invoices.length === 0 && <p className="p-4 text-sm text-slate-400">Nessuna distinta emessa.</p>}
        {invoices.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-700">{invoiceLabel(inv, settings)}</p>
              <p className="text-xs text-slate-400">
                {formatDate(inv.from)} – {formatDate(inv.to)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={inv.paid ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-800'}>{inv.paid ? 'Pagata' : 'Da liquidare'}</Badge>
              <span className="w-20 text-right text-sm font-medium tabular-nums">{formatMoney(inv.vendorShare)}</span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}

function ContactTab({ vendor, stats, settings }) {
  const message = vendorStatementMessage(vendor, stats, settings)
  return (
    <Card className="p-4">
      <p className="mb-3 text-sm text-slate-500">Invia l'estratto conto aggiornato al venditore.</p>
      <div className="mb-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{message}</div>
      <div className="flex flex-wrap gap-2">
        {vendor.phone ? (
          <Button as="a" href={buildWhatsAppLink(vendor.phone, message)} target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> WhatsApp
          </Button>
        ) : (
          <Button disabled>
            <MessageCircle size={16} /> WhatsApp (nessun numero)
          </Button>
        )}
        {vendor.email ? (
          <Button as="a" variant="secondary" href={buildMailtoLink(vendor.email, `Estratto conto ${settings.shop.name}`, message)}>
            <Mail size={16} /> Email
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            <Mail size={16} /> Email (nessun indirizzo)
          </Button>
        )}
      </div>
    </Card>
  )
}
