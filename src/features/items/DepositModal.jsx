import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Textarea } from '../../components/ui/Field'
import { setDeposit, clearDeposit } from '../../services'
import { toast } from '../../store/useToastStore'
import { getCurrentPrice } from '../../lib/business'
import { useSettingsStore } from '../../store/useSettingsStore'

export default function DepositModal({ open, onClose, article, onSaved }) {
  const settings = useSettingsStore((s) => s.settings)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open && article) {
      setAmount(article.depositAmount || '')
      setDate(article.depositDate || new Date().toISOString().slice(0, 10))
      setNote(article.depositNote || '')
    }
  }, [open, article])

  if (!article) return null

  const price = getCurrentPrice(article, settings)

  async function handleSave() {
    if (!(Number(amount) > 0)) return toast('Inserisci un importo valido', 'error')
    if (Number(amount) >= price) return toast("L'acconto non può superare il prezzo dell'articolo", 'error')
    await setDeposit(article.id, { amount: Number(amount), date, note })
    toast('Acconto registrato', 'success')
    onSaved?.()
    onClose()
  }

  async function handleClear() {
    await clearDeposit(article.id)
    toast('Acconto annullato', 'success')
    onSaved?.()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Acconto: ${article.description}`}
      footer={
        <>
          {article.depositAmount > 0 && (
            <Button variant="ghost" onClick={handleClear}>
              Annulla acconto
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Chiudi
          </Button>
          <Button onClick={handleSave}>Salva</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Importo acconto (€)" hint={`Prezzo articolo: € ${price.toFixed(2)}`}>
          <Input type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Data">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Note (es. nome cliente)" className="sm:col-span-2">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
