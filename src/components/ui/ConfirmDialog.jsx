import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { Input } from './Field'

/** Generic confirmation modal. Pass `requireText` (e.g. "CANCELLA") to force
 * the user to type it before the confirm button unlocks, for irreversible
 * operations (legacy used a native prompt() for this; same friction, nicer UI). */
export default function ConfirmDialog({ open, title = 'Conferma', message, danger, requireText, confirmLabel = 'Conferma', onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  const locked = requireText && typed !== requireText

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Annulla
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={locked}
            onClick={() => {
              setTyped('')
              onConfirm()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
      {requireText && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-slate-400">
            Digita <span className="font-mono font-semibold text-slate-600">{requireText}</span> per confermare
          </p>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </div>
      )}
    </Modal>
  )
}
