import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { markRitiro } from '../../services'
import { toast } from '../../store/useToastStore'

const MOTIVI = [
  { value: 'ritiro', label: 'Ritiro anticipato da parte del venditore' },
  { value: 'reso', label: 'Reso (merce scaduta/invenduta)' },
  { value: 'devoluto', label: 'Devoluzione al mercatino' },
]

export default function RitiroModal({ open, onClose, article, onDone }) {
  const [motivo, setMotivo] = useState('ritiro')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  if (!article) return null

  async function handleConfirm() {
    await markRitiro(article.id, { motivo, date })
    toast('Articolo aggiornato', 'success')
    onDone?.()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ritira/rendi: ${article.description}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleConfirm}>Conferma</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Motivo">
          <Select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVI.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
