import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Phone, ChevronRight, Users } from 'lucide-react'
import { searchVendors } from '../../services'
import { Input, Checkbox } from '../../components/ui/Field'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import VendorForm from './VendorForm'
import { vendorNeedsReview } from '../../lib/business'

const PAGE_SIZE = 150

export default function VendorList() {
  const [query, setQuery] = useState('')
  const [vendors, setVendors] = useState([])
  const [onlyReview, setOnlyReview] = useState(false)
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  async function reload() {
    setVendors(await searchVendors(query))
  }

  useEffect(() => {
    const t = setTimeout(reload, 150)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => setPage(1), [query, onlyReview])

  useEffect(() => {
    if (params.get('new')) {
      setFormOpen(true)
      setParams({}, { replace: true })
    }
  }, [params])

  const reviewCount = useMemo(() => vendors.filter(vendorNeedsReview).length, [vendors])
  const rows = onlyReview ? vendors.filter(vendorNeedsReview) : vendors
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">Venditori</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus size={16} /> Nuovo
        </Button>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Cerca per nome, telefono o codice fiscale..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {reviewCount > 0 && (
        <Checkbox
          label={`Mostra solo i ${reviewCount} venditori da rivedere`}
          checked={onlyReview}
          onChange={(e) => setOnlyReview(e.target.checked)}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="Nessun venditore trovato" hint="Aggiungi il primo venditore per iniziare." />
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {pageRows.map((v) => (
            <button key={v.id} onClick={() => navigate(`/venditori/${v.id}`)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                  <span className="truncate">
                    {v.name} {v.surname}
                  </span>
                  {vendorNeedsReview(v) && <Badge tone="bg-amber-100 text-amber-800">Da rivedere</Badge>}
                </p>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  {v.phone && (
                    <>
                      <Phone size={11} /> {v.phone}
                    </>
                  )}
                  {v.cf && <span className="ml-1">{v.cf}</span>}
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-slate-300" />
            </button>
          ))}
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Precedente
          </Button>
          <span className="text-slate-500">
            Pagina {page} di {totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Successiva
          </Button>
        </div>
      )}

      <VendorForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} />
    </div>
  )
}
