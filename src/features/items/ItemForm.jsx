import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Textarea, Checkbox } from '../../components/ui/Field'
import VendorPicker from '../../components/VendorPicker'
import { createArticle, updateArticle, listCategories } from '../../services'
import { toast } from '../../store/useToastStore'
import { padCode } from '../../lib/business'

const empty = {
  vendorId: null,
  description: '',
  category: '',
  originalPrice: '',
  loadDate: new Date().toISOString().slice(0, 10),
  priceOverride: '',
  noDiscount: false,
  notes: '',
}

export default function ItemForm({ open, onClose, article, defaultVendorId, onSaved }) {
  const [form, setForm] = useState(empty)
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(article ? { ...empty, ...article, originalPrice: article.originalPrice, priceOverride: article.priceOverride ?? '' } : { ...empty, vendorId: defaultVendorId || null })
      listCategories().then(setCategories)
    }
  }, [article, open, defaultVendorId])

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const today = new Date().toISOString().slice(0, 10)

  async function handleSave() {
    if (!form.vendorId) return toast('Seleziona un venditore', 'error')
    if (!form.description.trim()) return toast('La descrizione è obbligatoria', 'error')
    if (!(Number(form.originalPrice) > 0)) return toast('Il prezzo deve essere maggiore di zero', 'error')
    if (form.loadDate > today) return toast('La data di carico non può essere futura', 'error')

    setSaving(true)
    try {
      const payload = {
        ...form,
        originalPrice: Number(form.originalPrice),
        priceOverride: form.priceOverride === '' ? null : Number(form.priceOverride),
      }
      if (article) {
        await updateArticle(article.id, payload)
        toast('Articolo aggiornato', 'success')
      } else {
        await createArticle(payload)
        toast('Articolo aggiunto', 'success')
      }
      onSaved?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={article ? `Modifica articolo ${padCode(article.code)}` : 'Nuovo articolo'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Salva
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Venditore *" className="sm:col-span-2">
          <VendorPicker value={form.vendorId} onChange={(id) => set('vendorId', id)} />
        </Field>
        <Field label="Descrizione *" className="sm:col-span-2">
          <Input value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Categoria">
          <Input list="categories" value={form.category} onChange={(e) => set('category', e.target.value)} />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Prezzo originale (€) *">
          <Input type="number" step="0.01" min={0} value={form.originalPrice} onChange={(e) => set('originalPrice', e.target.value)} />
        </Field>
        <Field label="Data di carico">
          <Input type="date" max={today} value={form.loadDate} onChange={(e) => set('loadDate', e.target.value)} />
        </Field>
        <Field label="Prezzo forzato (€)" hint="Vince su sconti e scadenza">
          <Input type="number" step="0.01" min={0} value={form.priceOverride} onChange={(e) => set('priceOverride', e.target.value)} />
        </Field>
        <div className="flex items-center pt-5">
          <Checkbox label="Prezzo fisso (escludi da sconti automatici)" checked={form.noDiscount} onChange={(e) => set('noDiscount', e.target.checked)} />
        </div>
        <Field label="Note" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
