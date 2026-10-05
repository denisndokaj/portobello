import { useEffect, useState } from 'react'
import { Search, AlertTriangle } from 'lucide-react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { lastBackupDate } from '../../lib/backup'
import { Link } from 'react-router-dom'

export default function TopBar({ onOpenPalette }) {
  const [now, setNow] = useState(new Date())
  const settings = useSettingsStore((s) => s.settings)
  const [lastBackup, setLastBackup] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    setLastBackup(lastBackupDate())
  }, [])

  const daysSinceBackup = lastBackup ? Math.floor((Date.now() - new Date(lastBackup)) / 86400000) : null
  const backupDue = daysSinceBackup === null || daysSinceBackup >= Number(settings.business.backupReminderDays || 7)

  return (
    <header className="safe-top sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
      <button
        onClick={onOpenPalette}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-100 sm:max-w-sm"
      >
        <Search size={16} />
        <span className="truncate">Cerca articoli, venditori, pagine...</span>
        <kbd className="ml-auto hidden rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">Ctrl K</kbd>
      </button>

      <div className="flex items-center gap-3">
        {backupDue && (
          <Link to="/impostazioni" className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 sm:flex">
            <AlertTriangle size={14} />
            Backup consigliato
          </Link>
        )}
        <span className="hidden text-sm tabular-nums text-slate-400 md:inline">
          {now.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })} · {now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </header>
  )
}
