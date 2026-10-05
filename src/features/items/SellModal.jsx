import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { sellArticle } from '../../services'
import { toast } from '../../store/useToastStore'
import { getCurrentPrice, formatMoney, PAYMENT_METHODS } from '../../lib/business'
import { useSettingsStore } from '../../store/useSettingsStore'

export default function SellModal({ open, onClose, article, onSold }) {
  const settings = useSettingsStore((s) => s.settings)
  const [price, setPrice] = useState(0)
  const [method, setMethod] = useState('contanti')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (open && article) setPrice(getCurrentPrice(article, settings))
  }, [open, article])

  if (!article) return null

  async function handleConfirm() {
    const result = await sellArticle(article.id, { price: Number(price), date, paymentMethod: method })
    toast(`Venduto a ${formatMoney(result.gross)}`, 'success')
    onSold?.(result)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Vendi: ${article.description}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleConfirm}>Conferma vendita</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prezzo di vendita (€)">
          <Input type="number" step="0.01" min={0} value={price} onChange={(e) => setPrice(e.target.value)} autoFocus />
        </Field>
        <Field label="Metodo di pagamento">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Data vendita" className="sm:col-span-2">
          <Input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
