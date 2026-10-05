import { forwardRef } from 'react'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

const baseInput =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition disabled:bg-slate-50 disabled:text-slate-400'

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={clsx('block space-y-1', className)}>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-slate-400">{hint}</span>}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  )
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={twMerge(baseInput, className)} {...props} />
})

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={twMerge(baseInput, 'min-h-20', className)} {...props} />
})

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={twMerge(baseInput, 'pr-8', className)} {...props}>
      {children}
    </select>
  )
})

export function Checkbox({ label, className, ...props }) {
  return (
    <label className={clsx('flex items-center gap-2 text-sm text-slate-700 select-none', className)}>
      <input type="checkbox" className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...props} />
      {label}
    </label>
  )
}
