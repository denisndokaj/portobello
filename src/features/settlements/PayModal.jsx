import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Field'
import SignaturePad from '../../components/SignaturePad'
import { payInvoice } from '../../services'
import { toast } from '../../store/useToastStore'
import { formatMoney, PAYMENT_METHODS } from '../../lib/business'

export default function PayModal({ open, onClose, invoice, onPaid }) {
  const [method, setMethod] = useState('contanti')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [signature, setSignature] = useState(null)

  if (!invoice) return null

  async function handleConfirm() {
    await payInvoice(invoice.id, { date, method, note, signature })
    toast('Pagamento registrato', 'success')
    onPaid?.()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Registra pagamento – ${formatMoney(invoice.vendorShare)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleConfirm}>Conferma pagamento</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Metodo">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.filter((m) => m.value !== 'buono').map((m) => (
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
        <Field label="Note">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Firma per quietanza (opzionale)">
          <SignaturePad onChange={setSignature} />
        </Field>
      </div>
    </Modal>
  )
}
