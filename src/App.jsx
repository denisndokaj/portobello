import { Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import { useSettingsStore } from './store/useSettingsStore'

const Dashboard = lazy(() => import('./features/dashboard/Dashboard'))
const VendorList = lazy(() => import('./features/vendors/VendorList'))
const VendorDetail = lazy(() => import('./features/vendors/VendorDetail'))
const ItemList = lazy(() => import('./features/items/ItemList'))
const SellPage = lazy(() => import('./features/sell/SellPage'))
const SettlementList = lazy(() => import('./features/settlements/SettlementList'))
const LabelPrinter = lazy(() => import('./features/labels/LabelPrinter'))
const Registro = lazy(() => import('./features/reports/Registro'))
const NotesPage = lazy(() => import('./features/notes/NotesPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))

function PageFallback() {
  return <p className="p-6 text-sm text-slate-400">Caricamento...</p>
}

export default function App() {
  const load = useSettingsStore((s) => s.load)
  const loaded = useSettingsStore((s) => s.loaded)
  const [error, setError] = useState(null)

  useEffect(() => {
    load().catch((e) => setError(e))
  }, [load])

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center p-6 text-center text-sm text-red-600">
        Errore nell'avvio dell'app: {error.message}
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-slate-400">
        Caricamento...
      </div>
    )
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/venditori" element={<VendorList />} />
          <Route path="/venditori/:id" element={<VendorDetail />} />
          <Route path="/articoli" element={<ItemList />} />
          <Route path="/vendi" element={<SellPage />} />
          <Route path="/cassa" element={<Navigate to="/vendi" replace />} />
          <Route path="/segna-venduti" element={<Navigate to="/vendi?modo=ricerca" replace />} />
          <Route path="/distinte" element={<SettlementList />} />
          <Route path="/etichette" element={<LabelPrinter />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/note" element={<NotesPage />} />
          <Route path="/impostazioni" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
