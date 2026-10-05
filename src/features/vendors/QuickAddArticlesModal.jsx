import { useState } from 'react'
import { Plus, Trash2, Printer, FileDown } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Checkbox } from '../../components/ui/Field'
import { createArticle, getArticle, deleteArticle, markLabelPrinted } from '../../services'
import { toast } from '../../store/useToastStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { padCode, formatMoney } from '../../lib/business'
import { generateReceiptPdf } from '../../lib/invoicePdf'
import LabelSheet from '../labels/LabelSheet'

const emptyForm = { category: '', loadDate: new Date().toISOString().slice(0, 10), description: '', originalPrice: '', noDiscount: false }

/** Fast multi-item intake for one vendor: the vendor is fixed by the page
 * we're already on, so the operator never re-searches it per article - add,
 * add, add, then print every label from the session in one shot. */
export default function QuickAddArticlesModal({ open, onClose, vendor, onDone }) {
  const settings = useSettingsStore((s) => s.settings)
  const [form, setForm] = useState(emptyForm)
  const [session, setSession] = useState([])
  const [saving, setSaving] = useState(false)

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const today = new Date().toISOString().slice(0, 10)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.description.trim()) return toast('La descrizione è obbligatoria', 'error')
    if (!(Number(form.originalPrice) > 0)) return toast('Il prezzo deve essere maggiore di zero', 'error')
    if (form.loadDate > today) return toast('La data di carico non può essere futura', 'error')

    setSaving(true)
    try {
      const id = await createArticle({
        vendorId: vendor.id,
        description: form.description.trim(),
        category: form.category,
        originalPrice: Number(form.originalPrice),
        loadDate: form.loadDate,
        noDiscount: form.noDiscount,
      })
      const article = await getArticle(id)
      setSession((s) => [...s, article])
      // Keep category/date/noDiscount (usually shared across a batch), clear what varies per item.
      setForm((f) => ({ ...f, description: '', originalPrice: '' }))
      toast('Articolo aggiunto', 'success')
      onDone?.()
      document.getElementById('quick-add-description')?.focus()
    } finally {
      setSaving(false)
    }
  }

  async function removeFromSession(item) {
    await deleteArticle(item.id)
    setSession((s) => s.filter((x) => x.id !== item.id))
    onDone?.()
    toast('Articolo rimosso', 'success')
  }

  async function handlePrintAll() {
    if (session.length === 0) return
    setTimeout(async () => {
      window.print()
      await markLabelPrinted(session.map((a) => a.id))
    }, 50)
  }

  function handleClose() {
    setForm(emptyForm)
    setSession([])
    onClose()
  }

  function handlePrintReceipt() {
    if (session.length === 0) return
    const doc = generateReceiptPdf(vendor, session, settings)
    doc.save(`distinta-ricevimento-${vendor.surname}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  const elements = { barcode: true, code: true, description: true, price: true, date: true, vendor: settings.hardware.showVendorOnLabel }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Aggiungi articoli: ${vendor?.name} ${vendor?.surname}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Chiudi
          </Button>
          <Button variant="secondary" onClick={handlePrintReceipt} disabled={session.length === 0}>
            <FileDown size={16} /> Distinta di ricevimento
          </Button>
          <Button onClick={handlePrintAll} disabled={session.length === 0}>
            <Printer size={16} /> Stampa {session.length || ''} etichette
          </Button>
        </>
      }
    >
      <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
        <Field label="Descrizione *" className="sm:col-span-2">
          <Input id="quick-add-description" autoFocus value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Prezzo originale (€) *">
          <Input type="number" step="0.01" min={0} value={form.originalPrice} onChange={(e) => set('originalPrice', e.target.value)} />
        </Field>
        <Field label="Categoria">
          <Input value={form.category} onChange={(e) => set('category', e.target.value)} />
        </Field>
        <Field label="Data di carico">
          <Input type="date" max={today} value={form.loadDate} onChange={(e) => set('loadDate', e.target.value)} />
        </Field>
        <div className="flex items-center">
          <Checkbox label="Prezzo fisso" checked={form.noDiscount} onChange={(e) => set('noDiscount', e.target.checked)} />
        </div>
        <Button type="submit" disabled={saving} className="sm:col-span-2">
          <Plus size={16} /> Aggiungi e continua
        </Button>
      </form>

      {session.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Aggiunti in questa sessione ({session.length})</p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
            {session.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="mr-1.5 font-mono text-xs text-slate-400">{padCode(item.code)}</span>
                  {item.description}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{formatMoney(item.originalPrice)}</span>
                <button onClick={() => removeFromSession(item)} className="shrink-0 text-slate-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <LabelSheet articles={session} vendorMap={{ [vendor?.id]: vendor }} settings={settings} elements={elements} />
    </Modal>
  )
}
