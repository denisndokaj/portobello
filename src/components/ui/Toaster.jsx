import { useToastStore } from '../../store/useToastStore'
import { CheckCircle2, XCircle, Info } from 'lucide-react'
import clsx from 'clsx'

const icons = { success: CheckCircle2, error: XCircle, info: Info }
const tones = {
  success: 'bg-brand-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-800 text-white',
}

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((t) => {
        const Icon = icons[t.type] || Info
        return (
          <div key={t.id} className={clsx('pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-lg', tones[t.type] || tones.info)}>
            <Icon size={16} />
            {t.message}
          </div>
        )
      })}
    </div>
  )
}
