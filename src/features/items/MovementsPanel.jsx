import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, LogOut, Pencil, Undo2 } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { formatMoney, formatDate, padCode } from '../../lib/business'

const MOVEMENTS_LIMIT = 300

const MOVEMENT_FILTERS = [
  { value: 'entrambi', label: 'Entrambi' },
  { value: 'entrati', label: 'Solo entrati' },
  { value: 'venduti', label: 'Solo venduti' },
]

/** "What came in / what went out" for a chosen day or range, straight from
 * loadDate/soldDate on the articles themselves - a stock-movement view, not
 * a log. Registro answers "what happened in the cash register"; this
 * answers "what physically moved" and needs no cash-register entry to show
 * up (a returned/withdrawn item never appears here as a sale). Shared by
 * the global Articoli page and a single vendor's page - the caller just
 * hands it the article set to work from (everything, or one vendor's). */
export default function MovementsPanel({ articles, vendors = [], onCancelSale, onDelete, onEdit }) {
  const todayIso = new Date().toISOString().slice(0, 10)
  const [movFrom, setMovFrom] = useState(todayIso)
  const [movTo, setMovTo] = useState(todayIso)
  const [movFilter, setMovFilter] = useState('entrambi')
  const vendorMap = useMemo(() => Object.fromEntries(vendors.filter(Boolean).map((v) => [v.id, v])), [vendors])

  const entrati = useMemo(
    () => articles.filter((a) => a.loadDate >= movFrom && a.loadDate <= movTo).sort((a, b) => b.loadDate.localeCompare(a.loadDate)),
    [articles, movFrom, movTo],
  )
  const venduti = useMemo(
    () =>
      articles
        .filter((a) => a.status === 'venduto' && a.soldDate && a.soldDate >= movFrom && a.soldDate <= movTo)
        .sort((a, b) => b.soldDate.localeCompare(a.soldDate)),
    [articles, movFrom, movTo],
  )

  const entrantiValue = entrati.reduce((s, a) => s + (a.originalPrice || 0), 0)
  const vendutiValue = venduti.reduce((s, a) => s + (a.soldPrice || 0), 0)

  function setToday() {
    setMovFrom(todayIso)
    setMovTo(todayIso)
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-3">
        <Field label="Dal">
          <Input type="date" value={movFrom} max={movTo} onChange={(e) => setMovFrom(e.target.value)} />
        </Field>
        <Field label="Al">
          <Input type="date" value={movTo} min={movFrom} max={todayIso} onChange={(e) => setMovTo(e.target.value)} />
        </Field>
        <Button variant="secondary" size="sm" onClick={setToday} type="button">
          Oggi
        </Button>
        <div className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-1">
          {MOVEMENT_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setMovFilter(f.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${movFilter === f.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {movFilter !== 'venduti' && (
        <MovementSection
          icon={LogIn}
          title="Entrati"
          tone="text-brand-700"
          count={entrati.length}
          value={entrantiValue}
          valueLabel="valore a listino"
          rows={entrati}
          dateField="loadDate"
          priceField="originalPrice"
          actionLabel="Elimina"
          onAction={onDelete}
          onEdit={onEdit}
          vendorMap={vendorMap}
        />
      )}
      {movFilter !== 'entrati' && (
        <MovementSection
          icon={LogOut}
          title="Venduti"
          tone="text-amber-700"
          count={venduti.length}
          value={vendutiValue}
          valueLabel="incassato"
          rows={venduti}
          dateField="soldDate"
          priceField="soldPrice"
          actionLabel="Annulla vendita"
          onAction={onCancelSale}
          onEdit={onEdit}
          vendorMap={vendorMap}
        />
      )}
    </div>
  )
}

function MovementSection({ icon: Icon, title, tone, count, value, valueLabel, rows, dateField, priceField, actionLabel, onAction, onEdit, vendorMap = {} }) {
  const shown = rows.slice(0, MOVEMENTS_LIMIT)
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <p className={`flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
          <Icon size={15} /> {title} ({count})
        </p>
        <p className="text-sm font-medium text-slate-600">
          {formatMoney(value)} <span className="text-xs font-normal text-slate-400">{valueLabel}</span>
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">Nessun articolo in questo periodo.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {shown.map((a) => {
            const vendor = vendorMap[a.vendorId]
            return (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => onEdit(a)}
                onKeyDown={(e) => e.key === 'Enter' && onEdit(a)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    <span className="mr-1.5 font-mono text-xs text-slate-400">{padCode(a.code)}</span>
                    {a.description}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(a[dateField])}
                    {vendor && (
                      <>
                        {' · '}
                        <Link to={`/venditori/${vendor.id}`} className="text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                          {vendor.name} {vendor.surname}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold tabular-nums text-slate-800">{formatMoney(a[priceField])}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      onAction(a)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation()
                        onAction(a)
                      }
                    }}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      actionLabel === 'Elimina' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Undo2 size={13} />
                    {actionLabel}
                  </span>
                  <Pencil size={14} className="text-slate-300" />
                </div>
              </div>
            )
          })}
          {rows.length > MOVEMENTS_LIMIT && (
            <p className="p-3 text-center text-xs text-amber-600">
              Mostrati i primi {MOVEMENTS_LIMIT} di {rows.length}: restringi il periodo per vederli tutti.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
