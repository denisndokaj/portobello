import { Delete, CornerDownLeft } from 'lucide-react'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK']

/** Large touch-friendly keypad for fast barcode-less code entry at the
 * register, shown only on touch devices (a physical/Bluetooth scanner just
 * types into the text field directly and needs no keypad). */
export default function NumericKeypad({ onDigit, onClear, onEnter }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:hidden">
      {KEYS.map((k) => (
        <button
          key={k}
          onClick={() => {
            if (k === 'C') onClear()
            else if (k === 'OK') onEnter()
            else onDigit(k)
          }}
          className="flex h-14 items-center justify-center rounded-xl bg-slate-100 text-lg font-semibold text-slate-700 active:bg-slate-200"
        >
          {k === 'C' ? <Delete size={20} /> : k === 'OK' ? <CornerDownLeft size={20} /> : k}
        </button>
      ))}
    </div>
  )
}
