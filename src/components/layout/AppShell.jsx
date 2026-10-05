import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import TopBar from './TopBar'
import CommandPalette from '../CommandPalette'
import Toaster from '../ui/Toaster'
import { NAV_ITEMS } from '../../lib/nav'

export default function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const navigate = useNavigate()

  const onKeyDown = useCallback(
    (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (!typing && e.key === '/') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        navigate('/cassa')
      }
      if (e.key === 'F3') {
        e.preventDefault()
        navigate('/segna-venduti')
      }
      if (!typing && e.altKey) {
        const item = NAV_ITEMS.find((n) => n.shortcut === e.key)
        if (item) {
          e.preventDefault()
          navigate(item.to)
        }
      }
    },
    [navigate],
  )

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  return (
    <div className="flex h-dvh bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
          <div className="mx-auto w-full max-w-6xl px-4 py-5">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
    </div>
  )
}
