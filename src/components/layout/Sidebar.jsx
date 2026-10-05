import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../../lib/nav'
import logo from '../../assets/logo.png'
import { useSettingsStore } from '../../store/useSettingsStore'
import clsx from 'clsx'

export default function Sidebar() {
  const shopName = useSettingsStore((s) => s.settings.shop.name)
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src={logo} alt="" className="size-10 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{shopName}</p>
          <p className="text-xs text-slate-400">Gestionale conto vendita</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50',
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 text-xs text-slate-300">
        <kbd className="rounded border border-slate-200 px-1.5 py-0.5">Ctrl</kbd> + <kbd className="rounded border border-slate-200 px-1.5 py-0.5">K</kbd> per la ricerca globale
      </div>
    </aside>
  )
}
