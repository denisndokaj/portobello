import clsx from 'clsx'

export default function Badge({ className, children, tone = 'bg-slate-100 text-slate-600' }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tone, className)}>{children}</span>
}
