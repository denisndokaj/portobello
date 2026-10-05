import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { BOTTOM_NAV_ITEMS, MORE_NAV_ITEMS } from '../../lib/nav'
import clsx from 'clsx'

export default function BottomNav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const moreActive = MORE_NAV_ITEMS.some((i) => i.to === location.pathname)

  return (
    <>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => clsx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-600' : 'text-slate-400')}
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
        <button onClick={() => setOpen(true)} className={clsx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', moreActive ? 'text-brand-600' : 'text-slate-400')}>
          <Menu size={20} />
          Altro
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="safe-bottom w-full rounded-t-2xl bg-white p-4 shadow-xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
            <div className="grid grid-cols-3 gap-3">
              {MORE_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    clsx('flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium', isActive ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-100 text-slate-600')
                  }
                >
                  <item.icon size={20} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
