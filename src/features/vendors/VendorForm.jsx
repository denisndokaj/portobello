import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Select, Textarea, Checkbox } from '../../components/ui/Field'
import { createVendor, updateVendor, findHomonyms } from '../../services'
import { toast } from '../../store/useToastStore'

const DOC_TYPES = [
  { value: '', label: 'Nessuno' },
  { value: 'carta_identita', label: "Carta d'identità" },
  { value: 'patente', label: 'Patente' },
  { value: 'passaporto', label: 'Passaporto' },
  { value: 'altro', label: 'Altro' },
]

const empty = {
  name: '',
  surname: '',
  phone: '',
  email: '',
  address: '',
  birthDate: '',
  birthPlace: '',
  cf: '',
  docType: '',
  docNumber: '',
  iban: '',
  commission: '',
  applyTax: true,
  countInNumbering: true,
  notes: '',
}

export default function VendorForm({ open, onClose, vendor, onSaved }) {
  const [form, setForm] = useState(empty)
  const [homonymWarning, setHomonymWarning] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(vendor ? { ...empty, ...vendor, commission: vendor.commission ?? '' } : empty)
    setHomonymWarning(null)
  }, [vendor, open])

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  async function checkHomonyms() {
    if (!form.name || !form.surname) return
    const matches = await findHomonyms(form.name, form.surname, vendor?.id)
    setHomonymWarning(matches.length ? `Attenzione: esiste già un venditore con questo nome (#${matches[0].id}).` : null)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.surname.trim()) {
      toast('Nome e cognome sono obbligatori', 'error')
      return
    }
    if (form.cf && form.cf.length !== 16) {
      toast('Il codice fiscale dovrebbe avere 16 caratteri (verifica)', 'info')
    }
    setSaving(true)
    try {
      const payload = { ...form, cf: form.cf.toUpperCase(), commission: form.commission === '' ? null : Number(form.commission) }
      if (vendor) {
        await updateVendor(vendor.id, payload)
        toast('Venditore aggiornato', 'success')
      } else {
        await createVendor(payload)
        toast('Venditore creato', 'success')
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
      title={vendor ? 'Modifica venditore' : 'Nuovo venditore'}
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
      {homonymWarning && <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{homonymWarning}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} onBlur={checkHomonyms} />
        </Field>
        <Field label="Cognome *">
          <Input value={form.surname} onChange={(e) => set('surname', e.target.value)} onBlur={checkHomonyms} />
        </Field>
        <Field label="Telefono">
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Indirizzo" className="sm:col-span-2">
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="Data di nascita">
          <Input type="date" value={form.birthDate || ''} onChange={(e) => set('birthDate', e.target.value)} />
        </Field>
        <Field label="Luogo di nascita">
          <Input value={form.birthPlace} onChange={(e) => set('birthPlace', e.target.value)} />
        </Field>
        <Field label="Codice fiscale / P.IVA">
          <Input value={form.cf} onChange={(e) => set('cf', e.target.value.toUpperCase())} />
        </Field>
        <Field label="IBAN (per bonifici)">
          <Input value={form.iban} onChange={(e) => set('iban', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Tipo documento">
          <Select value={form.docType || ''} onChange={(e) => set('docType', e.target.value)}>
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Numero documento">
          <Input value={form.docNumber} onChange={(e) => set('docNumber', e.target.value)} />
        </Field>
        <Field label="Commissione personalizzata (%)" hint="Lascia vuoto per usare quella predefinita">
          <Input type="number" min={0} max={100} value={form.commission} onChange={(e) => set('commission', e.target.value)} />
        </Field>
        <div className="flex flex-col justify-center gap-2 pt-5">
          <Checkbox label="Soggetto a ritenuta/imposta" checked={form.applyTax} onChange={(e) => set('applyTax', e.target.checked)} />
          <Checkbox label="Incluso nella numerazione ufficiale distinte" checked={form.countInNumbering} onChange={(e) => set('countInNumbering', e.target.checked)} />
        </div>
        <Field label="Note riservate" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
