import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Phone, ChevronRight, Users } from 'lucide-react'
import { searchVendors } from '../../services'
import { Input } from '../../components/ui/Field'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import VendorForm from './VendorForm'

export default function VendorList() {
  const [query, setQuery] = useState('')
  const [vendors, setVendors] = useState([])
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

  useEffect(() => {
    if (params.get('new')) {
      setFormOpen(true)
      setParams({}, { replace: true })
    }
  }, [params])

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

      {vendors.length === 0 ? (
        <EmptyState icon={Users} title="Nessun venditore trovato" hint="Aggiungi il primo venditore per iniziare." />
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {vendors.map((v) => (
            <button key={v.id} onClick={() => navigate(`/venditori/${v.id}`)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {v.name} {v.surname}
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

      <VendorForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} />
    </div>
  )
}
