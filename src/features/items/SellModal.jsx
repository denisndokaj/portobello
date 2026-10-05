import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { sellArticle } from '../../services'
import { toast } from '../../store/useToastStore'
import { getCurrentPrice, formatMoney } from '../../lib/business'
import { useSettingsStore } from '../../store/useSettingsStore'

export default function SellModal({ open, onClose, article, onSold }) {
  const settings = useSettingsStore((s) => s.settings)
  const [price, setPrice] = useState(0)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    if (open && article) setPrice(getCurrentPrice(article, settings))
  }, [open, article])

  if (!article) return null

  const hasDeposit = article.depositAmount > 0
  const dueNow = hasDeposit ? Math.max(0, Number(price) - article.depositAmount) : null

  async function handleConfirm() {
    const result = await sellArticle(article.id, { price: Number(price), date })
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
        <Field label="Data vendita">
          <Input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      {hasDeposit && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Acconto già versato: {formatMoney(article.depositAmount)} — da incassare ora: <strong>{formatMoney(dueNow)}</strong>
        </div>
      )}
    </Modal>
  )
}
