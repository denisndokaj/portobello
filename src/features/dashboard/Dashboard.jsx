import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { AlertTriangle, PackageX, Wallet, Tag as TagIcon, Save, UserX, ArrowRight } from 'lucide-react'
import { dashboardSummary, salesByMonth, topVendorsBySales, pendingSettlementByVendor, recentSales, listArticles, listVendors } from '../../services'
import { useSettingsStore } from '../../store/useSettingsStore'
import { lastBackupDate } from '../../lib/backup'
import Stat from '../../components/ui/Stat'
import Card, { CardHeader } from '../../components/ui/Card'
import ItemForm from '../items/ItemForm'
import { formatMoney, formatDate, padCode, getExpiringArticles } from '../../lib/business'

export default function Dashboard() {
  const settings = useSettingsStore((s) => s.settings)
  const [summary, setSummary] = useState(null)
  const [chart, setChart] = useState([])
  const [editArticle, setEditArticle] = useState(null)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [topVendors, setTopVendors] = useState([])
  const [pending, setPending] = useState([])
  const [latest, setLatest] = useState([])
  const [expiring, setExpiring] = useState([])
  const [expiringCount, setExpiringCount] = useState(0)
  const [vendorCount, setVendorCount] = useState(0)
  const [unlabeledCount, setUnlabeledCount] = useState(0)

  async function reload() {
    const [s, c, tv, p, r, articles, vendors] = await Promise.all([
      dashboardSummary(),
      salesByMonth(12),
      topVendorsBySales(8),
      pendingSettlementByVendor(),
      recentSales(8),
      listArticles({}),
      listVendors(),
    ])
    setSummary(s)
    setChart(c)
    setTopVendors(tv)
    setPending(p.slice(0, 8))
    setLatest(r)
    // Not-yet-expired items are the time-sensitive ones (there's still a
    // window to act), so the preview leads with those; already-expired
    // stock only fills remaining slots. The full count (not the 8-item
    // preview) is what the "N in scadenza o scaduti" action line uses.
    const allExpiring = getExpiringArticles(articles, settings)
    setExpiring([...allExpiring].sort((a, b) => Number(a.isExpired) - Number(b.isExpired)).slice(0, 8))
    setExpiringCount(allExpiring.length)
    setVendorCount(vendors.length)
    setUnlabeledCount(articles.filter((a) => a.status === 'disponibile' && !a.labelPrintedAt).length)
  }

  useEffect(() => {
    reload()
  }, [settings])

  function openArticle(article) {
    setEditArticle(article)
    setItemFormOpen(true)
  }

  if (!summary) return <p className="text-sm text-slate-400">Caricamento...</p>

  const daysSinceBackup = lastBackupDate() ? Math.floor((Date.now() - new Date(lastBackupDate())) / 86400000) : null
  const backupDue = daysSinceBackup === null || daysSinceBackup >= Number(settings.business.backupReminderDays || 7)

  const actions = [
    expiringCount > 0 && { icon: AlertTriangle, text: `${expiringCount} articoli in scadenza o scaduti`, to: '/articoli?view=scadenze', tone: 'text-amber-600' },
    summary.dueToVendors > 0 && { icon: Wallet, text: `${formatMoney(summary.dueToVendors)} da liquidare ai venditori`, to: '/distinte', tone: 'text-red-600' },
    unlabeledCount > 0 && { icon: TagIcon, text: `${unlabeledCount} articoli senza etichetta stampata`, to: '/etichette', tone: 'text-slate-600' },
    backupDue && { icon: Save, text: daysSinceBackup === null ? 'Nessun backup eseguito finora' : `Backup non eseguito da ${daysSinceBackup} giorni`, to: '/impostazioni', tone: 'text-slate-600' },
    vendorCount === 0 && { icon: UserX, text: 'Nessun venditore registrato', to: '/venditori', tone: 'text-slate-600' },
  ].filter(Boolean)

  return (
    <div className="space-y-5 pb-10">
      <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Venditori" value={summary.vendorCount} />
        <Stat label="In vendita" value={summary.activeCount} sub={formatMoney(summary.activeValue)} />
        <Stat
          label="Venduto questo mese"
          value={formatMoney(summary.totalThisMonth)}
          sub={summary.deltaPercent === null ? `${summary.soldThisMonthCount} articoli` : `${summary.deltaPercent >= 0 ? '+' : ''}${summary.deltaPercent}% vs mese prec.`}
          tone={summary.deltaPercent > 0 ? 'text-brand-700' : summary.deltaPercent < 0 ? 'text-red-600' : 'text-slate-800'}
        />
        <Stat label="Da liquidare" value={formatMoney(summary.dueToVendors)} tone="text-amber-600" />
      </div>

      {actions.length > 0 && (
        <Card>
          <CardHeader title="Azioni consigliate" />
          <div className="divide-y divide-slate-100">
            {actions.map((a, i) => (
              <Link key={i} to={a.to} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                <span className={`flex items-center gap-2 ${a.tone}`}>
                  <a.icon size={15} /> {a.text}
                </span>
                <ArrowRight size={14} className="text-slate-300" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Vendite ultimi 12 mesi" />
        <div className="h-56 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => formatMoney(v)} labelFormatter={(l) => l} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Da liquidare per venditore" />
          <div className="divide-y divide-slate-100">
            {pending.length === 0 && <p className="p-4 text-sm text-slate-400">Nessun saldo da liquidare.</p>}
            {pending.map((p) => (
              <Link key={p.vendorId} to={`/venditori/${p.vendorId}`} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-50">
                <span>{p.vendor ? `${p.vendor.name} ${p.vendor.surname}` : '–'}</span>
                <span className="font-medium tabular-nums">{formatMoney(p.total)}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Top venditori" />
          <div className="divide-y divide-slate-100">
            {topVendors.length === 0 && <p className="p-4 text-sm text-slate-400">Nessuna vendita ancora.</p>}
            {topVendors.map((p) => (
              <Link key={p.vendorId} to={`/venditori/${p.vendorId}`} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-50">
                <span>{p.vendor ? `${p.vendor.name} ${p.vendor.surname}` : '–'}</span>
                <span className="font-medium tabular-nums">{formatMoney(p.total)}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Ultime vendite" />
          <div className="divide-y divide-slate-100">
            {latest.length === 0 && <p className="p-4 text-sm text-slate-400">Nessuna vendita ancora.</p>}
            {latest.map((a) => (
              <button key={a.id} onClick={() => openArticle(a)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50">
                <span className="truncate">
                  <span className="mr-1.5 font-mono text-xs text-slate-400">{padCode(a.code)}</span>
                  {a.description}
                </span>
                <span className="shrink-0 font-medium tabular-nums">{formatMoney(a.soldPrice)}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Articoli in scadenza" action={<PackageX size={16} className="text-slate-300" />} />
          <div className="divide-y divide-slate-100">
            {expiring.length === 0 && <p className="p-4 text-sm text-slate-400">Nessun articolo in scadenza.</p>}
            {expiring.map(({ article, isExpired }) => (
              <button key={article.id} onClick={() => openArticle(article)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50">
                <span className="min-w-0 truncate">
                  <span className="mr-1.5 font-mono text-xs text-slate-400">{padCode(article.code)}</span>
                  {article.description}
                  {isExpired ? (
                    <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">scaduto</span>
                  ) : (
                    <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">in scadenza</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-slate-400">carico {formatDate(article.loadDate)}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <ItemForm open={itemFormOpen} onClose={() => setItemFormOpen(false)} article={editArticle} onSaved={reload} />
    </div>
  )
}
