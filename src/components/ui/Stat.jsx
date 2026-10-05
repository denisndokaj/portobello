import clsx from 'clsx'

export default function Stat({ label, value, sub, tone = 'text-slate-800', icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        {Icon && <Icon size={16} className="text-slate-300" />}
      </div>
      <div className={clsx('mt-1 text-2xl font-semibold tabular-nums', tone)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
