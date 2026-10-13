import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettingsStore } from '../../store/useSettingsStore'
import { toast } from '../../store/useToastStore'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Field, Input, Select, Textarea, Checkbox } from '../../components/ui/Field'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Plus, Trash2, Download, Upload, RotateCcw, ImagePlus, FileUp, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react'
import { contractText, formatMoney, getCurrentPrice, round2 } from '../../lib/business'
import { LABEL_PRESETS } from '../../lib/business'
import { dumpDatabase, downloadJSON, restoreDatabase, listSnapshots, restoreSnapshot, autoBackup } from '../../lib/backup'
import { downloadCSV } from '../../lib/exportUtils'
import { db } from '../../lib/db'
import { runDataIntegrityChecks } from '../../lib/dataIntegrity'
import { resetAllData, setNextArticleCode, setNextInvoiceNumber, setNextUnnumberedNumber, getCounters } from '../../services'
import { parseStaging, summarizeStaging, applyLegacyImport, repairReconstructedInvoiceDates } from '../../services/local/legacyImportService'

export default function SettingsPage() {
  const storeSettings = useSettingsStore((s) => s.settings)
  const save = useSettingsStore((s) => s.save)
  const [form, setForm] = useState(storeSettings)
  const [counters, setCounters] = useState(null)
  const [snapshots, setSnapshots] = useState([])
  const [confirmReset, setConfirmReset] = useState(false)
  const fileInputRef = useRef(null)
  const logoInputRef = useRef(null)
  const legacyFileInputRef = useRef(null)
  const [legacyStaging, setLegacyStaging] = useState(null)
  const [legacySummary, setLegacySummary] = useState(null)
  const [confirmLegacyImport, setConfirmLegacyImport] = useState(false)
  const [legacyImporting, setLegacyImporting] = useState(false)
  const [legacyResult, setLegacyResult] = useState(null)
  const [repairBusy, setRepairBusy] = useState(false)
  const [repairResult, setRepairResult] = useState(null)
  const [integrityBusy, setIntegrityBusy] = useState(false)
  const [integrityReport, setIntegrityReport] = useState(null)
  const [expandedCheck, setExpandedCheck] = useState(null)

  useEffect(() => setForm(storeSettings), [storeSettings])
  useEffect(() => {
    getCounters().then(setCounters)
    setSnapshots(listSnapshots())
  }, [])

  const set = (path, value) => {
    setForm((f) => {
      const next = structuredClone(f)
      let cur = next
      const parts = path.split('.')
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]]
      cur[parts.at(-1)] = value
      return next
    })
  }

  async function handleSave() {
    await save(form)
    toast('Impostazioni salvate', 'success')
  }

  function addDiscountStep() {
    set('business.discountSteps', [...form.business.discountSteps, { days: 30, discountPercent: 10 }])
  }
  function removeDiscountStep(i) {
    set(
      'business.discountSteps',
      form.business.discountSteps.filter((_, idx) => idx !== i),
    )
  }
  function updateDiscountStep(i, key, value) {
    const steps = form.business.discountSteps.map((s, idx) => (idx === i ? { ...s, [key]: Number(value) } : s))
    set('business.discountSteps', steps)
  }

  function onLogoFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('shop.logoBase64', reader.result)
    reader.readAsDataURL(file)
  }

  async function handleExportBackup() {
    const dump = await dumpDatabase()
    downloadJSON(`portobello-backup-${new Date().toISOString().slice(0, 10)}.json`, dump)
    toast('Backup esportato', 'success')
  }

  async function handleImportBackup(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    await autoBackup('prima di un import')
    await restoreDatabase(JSON.parse(text))
    toast('Dati importati. Ricarico la pagina...', 'success')
    setTimeout(() => window.location.reload(), 800)
  }

  async function handleExportArchiveCSV() {
    const articles = await db.articles.toArray()
    const vendors = Object.fromEntries((await db.vendors.toArray()).map((v) => [v.id, v]))
    downloadCSV(
      `archivio-articoli-${new Date().toISOString().slice(0, 10)}.csv`,
      articles,
      [
        { header: 'Codice', value: (a) => String(a.code).padStart(6, '0') },
        { header: 'Descrizione', value: (a) => a.description },
        { header: 'Categoria', value: (a) => a.category },
        { header: 'Venditore', value: (a) => (vendors[a.vendorId] ? `${vendors[a.vendorId].name} ${vendors[a.vendorId].surname}` : '') },
        { header: 'Prezzo originale', value: (a) => a.originalPrice },
        { header: 'Prezzo attuale', value: (a) => getCurrentPrice(a, form) },
        { header: 'Stato', value: (a) => a.status },
        { header: 'Data carico', value: (a) => a.loadDate },
        { header: 'Data vendita', value: (a) => a.soldDate || '' },
      ],
    )
  }

  async function handleLegacyFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const staging = parseStaging(text)
      setLegacyStaging(staging)
      setLegacySummary(summarizeStaging(staging))
      setLegacyResult(null)
    } catch (err) {
      toast(err.message || 'File non valido', 'error')
    }
  }

  async function handleConfirmLegacyImport() {
    setLegacyImporting(true)
    try {
      await autoBackup('prima di importare dati dal vecchio gestionale')
      const result = await applyLegacyImport(legacyStaging)
      setLegacyResult(result)
      setLegacyStaging(null)
      setLegacySummary(null)
      toast('Importazione completata', 'success')
    } catch (err) {
      toast(err.message || "Errore durante l'importazione", 'error')
    } finally {
      setLegacyImporting(false)
      setConfirmLegacyImport(false)
    }
  }

  async function handleRepairInvoiceDates() {
    setRepairBusy(true)
    try {
      await autoBackup('prima di correggere le date di fine periodo delle fatture storiche')
      const fixes = await repairReconstructedInvoiceDates()
      setRepairResult(fixes.length)
      toast(fixes.length ? `Corrette ${fixes.length} fatture` : 'Nessuna fattura da correggere', 'success')
    } catch (err) {
      toast(err.message || 'Errore durante la correzione', 'error')
    } finally {
      setRepairBusy(false)
    }
  }

  async function handleRunIntegrityCheck() {
    setIntegrityBusy(true)
    try {
      const report = await runDataIntegrityChecks()
      setIntegrityReport(report)
      setExpandedCheck(null)
      toast(report.problemCount ? `Trovate ${report.problemCount} anomalie` : 'Nessuna anomalia trovata', report.problemCount ? 'info' : 'success')
    } finally {
      setIntegrityBusy(false)
    }
  }

  async function handleReset() {
    await autoBackup('prima del reset totale')
    await resetAllData()
    toast('Archivio azzerato', 'success')
    setConfirmReset(false)
    setTimeout(() => window.location.reload(), 600)
  }

  if (!form) return null

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Impostazioni</h1>
        <Button onClick={handleSave}>Salva impostazioni</Button>
      </div>

      <Card>
        <CardHeader title="Dati negozio" subtitle="Compaiono su tutti i documenti stampati" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Nome negozio">
            <Input value={form.shop.name} onChange={(e) => set('shop.name', e.target.value)} />
          </Field>
          <Field label="P.IVA / Codice fiscale">
            <Input value={form.shop.vat} onChange={(e) => set('shop.vat', e.target.value)} />
          </Field>
          <Field label="Indirizzo" className="sm:col-span-2">
            <Input value={form.shop.address} onChange={(e) => set('shop.address', e.target.value)} />
          </Field>
          <Field label="Telefono">
            <Input value={form.shop.phone} onChange={(e) => set('shop.phone', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={form.shop.email} onChange={(e) => set('shop.email', e.target.value)} />
          </Field>
          <Field label="Logo">
            <div className="flex items-center gap-3">
              {form.shop.logoBase64 && <img src={form.shop.logoBase64} alt="" className="size-12 rounded border border-slate-200 object-contain" />}
              <Button variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()} type="button">
                <ImagePlus size={14} /> Carica logo
              </Button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Commissioni e imposta" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Commissione predefinita (%)">
            <Input type="number" min={0} max={100} value={form.business.defaultCommissionPercent} onChange={(e) => set('business.defaultCommissionPercent', Number(e.target.value))} />
          </Field>
          <Field label="Aliquota imposta (%)">
            <Input type="number" min={0} max={100} value={form.business.taxRatePercent} onChange={(e) => set('business.taxRatePercent', Number(e.target.value))} />
          </Field>
          <Field label="Arrotondamento netto" className="sm:col-span-2">
            <Select value={form.business.taxRoundingStrategy} onChange={(e) => set('business.taxRoundingStrategy', e.target.value)}>
              <option value="floor_euro">Tronca all'euro intero</option>
              <option value="round_cent">Arrotonda al centesimo</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-4 sm:grid-cols-4">
          {[20, 50, 100, 200].map((price) => {
            const net =
              form.business.taxRoundingStrategy === 'round_cent'
                ? round2(price * (1 - form.business.taxRatePercent / 100))
                : Math.floor(price * (1 - form.business.taxRatePercent / 100))
            return (
              <div key={price} className="rounded-lg bg-slate-50 p-2 text-center text-xs">
                <div className="text-slate-400">Vendita {formatMoney(price)}</div>
                <div className="font-semibold text-slate-700">Netto {formatMoney(net)}</div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Sconti progressivi e mandato"
          action={
            <Button size="sm" variant="secondary" onClick={addDiscountStep} type="button">
              <Plus size={14} /> Scaglione
            </Button>
          }
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Durata mandato (mesi)">
            <Input type="number" min={1} value={form.business.mandateDurationMonths} onChange={(e) => set('business.mandateDurationMonths', Number(e.target.value))} />
          </Field>
          <Field label="Preavviso scadenza (mesi)">
            <Input type="number" min={0} value={form.business.expiryWarningMonths} onChange={(e) => set('business.expiryWarningMonths', Number(e.target.value))} />
          </Field>
        </div>
        <div className="space-y-2 border-t border-slate-100 p-4">
          {form.business.discountSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Dopo</span>
              <Input type="number" className="w-24" value={step.days} onChange={(e) => updateDiscountStep(i, 'days', e.target.value)} />
              <span className="text-sm text-slate-500">giorni, sconto</span>
              <Input type="number" className="w-24" value={step.discountPercent} onChange={(e) => updateDiscountStep(i, 'discountPercent', e.target.value)} />
              <span className="text-sm text-slate-500">%</span>
              <button onClick={() => removeDiscountStep(i)} className="ml-auto text-slate-400 hover:text-red-500" type="button">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {form.business.discountSteps.length === 0 && <p className="text-sm text-slate-400">Nessuno scaglione configurato.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Operatività" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Modalità prezzo vendita rapida">
            <Select value={form.business.quickSellPriceMode} onChange={(e) => set('business.quickSellPriceMode', e.target.value)}>
              <option value="confirm">Conferma prezzo prima di vendere</option>
              <option value="auto">Vendi subito al prezzo corrente</option>
            </Select>
          </Field>
          <Field label="Promemoria backup (giorni)">
            <Input type="number" min={1} value={form.business.backupReminderDays} onChange={(e) => set('business.backupReminderDays', Number(e.target.value))} />
          </Field>
          <Field label="Prefisso fatture numerate">
            <Input value={form.business.invoicePrefix} onChange={(e) => set('business.invoicePrefix', e.target.value)} />
          </Field>
          <Field label="Prefisso fatture fuori numerazione">
            <Input value={form.business.unnumberedDocPrefix} onChange={(e) => set('business.unnumberedDocPrefix', e.target.value)} />
          </Field>
        </div>
        {counters && (
          <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-3">
            <Field label="Prossimo codice articolo" hint={`attuale: ${counters.nextArticleCode}`}>
              <Input type="number" defaultValue={counters.nextArticleCode} onBlur={async (e) => setCounters(await setNextArticleCode(e.target.value).then(getCounters))} />
            </Field>
            <Field label="Prossimo n. fattura" hint={`attuale: ${counters.nextInvoiceNumber}`}>
              <Input type="number" defaultValue={counters.nextInvoiceNumber} onBlur={async (e) => setCounters(await setNextInvoiceNumber(e.target.value).then(getCounters))} />
            </Field>
            <Field label="Prossimo n. fuori numerazione" hint={`attuale: ${counters.nextUnnumberedNumber}`}>
              <Input type="number" defaultValue={counters.nextUnnumberedNumber} onBlur={async (e) => setCounters(await setNextUnnumberedNumber(e.target.value).then(getCounters))} />
            </Field>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Hardware" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Formato etichette">
            <Select value={form.hardware.labelPrinterFormat} onChange={(e) => set('hardware.labelPrinterFormat', e.target.value)}>
              {Object.entries(LABEL_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Larghezza scontrino">
            <Select value={form.hardware.receiptWidth} onChange={(e) => set('hardware.receiptWidth', e.target.value)}>
              <option value="80mm">80mm</option>
              <option value="57mm">57mm</option>
            </Select>
          </Field>
          <Checkbox label="Mostra venditore sull'etichetta" checked={form.hardware.showVendorOnLabel} onChange={(e) => set('hardware.showVendorOnLabel', e.target.checked)} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Condizioni contrattuali" subtitle="Usate nel mandato di vendita e nella distinta di ricevimento" />
        <div className="space-y-2 p-4">
          <Textarea rows={5} value={form.business.contractTerms} onChange={(e) => set('business.contractTerms', e.target.value)} />
          <p className="text-xs text-slate-400">Segnaposto disponibili: {'{DURATA}'}, {'{COMMISSIONE}'}, {'{SCONTI}'}, {'{NEGOZIO}'}</p>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{contractText(form)}</div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Importazione dal vecchio gestionale" subtitle="Carica il file di importazione preparato in chat (venditori e articoli convertiti dal vecchio archivio)" />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => legacyFileInputRef.current?.click()} type="button">
              <FileUp size={14} /> Scegli file di importazione
            </Button>
            <input ref={legacyFileInputRef} type="file" accept="application/json" className="hidden" onChange={handleLegacyFile} />
          </div>

          {legacySummary && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-400">Venditori</p>
                  <p className="font-semibold text-slate-800">{legacySummary.vendorsTotal}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Articoli</p>
                  <p className="font-semibold text-slate-800">{legacySummary.articlesTotal}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Disponibili / Venduti / Ritirati</p>
                  <p className="font-semibold text-slate-800">
                    {legacySummary.byStatus.disponibile || 0} / {legacySummary.byStatus.venduto || 0} / {legacySummary.byStatus.ritirato || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Venduto da liquidare dopo l'import</p>
                  <p className="font-semibold text-slate-800">{legacySummary.soldPostCutoff}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Cutoff liquidazioni: <strong>{legacySummary.cutoffDate}</strong> — {legacySummary.soldPreCutoff} vendite fino a questa data saranno marcate come già liquidate,{' '}
                {legacySummary.soldPostCutoff} resteranno da liquidare normalmente.
                {legacySummary.stubVendors > 0 && (
                  <>
                    {' '}
                    <strong>{legacySummary.stubVendors}</strong> venditori sono stati ricostruiti solo dal nome (riferimento originale mancante) — verificali dopo l'import.
                  </>
                )}
                {legacySummary.ambiguousVendors > 0 && (
                  <>
                    {' '}
                    <strong>{legacySummary.ambiguousVendors}</strong> hanno un nome/cognome separato automaticamente da un nome composto — controllali in Venditori.
                  </>
                )}
              </p>
              <Button size="sm" onClick={() => setConfirmLegacyImport(true)} type="button">
                Importa questi dati
              </Button>
            </div>
          )}

          {legacyResult && (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              Importati {legacyResult.vendorsImported} venditori, {legacyResult.articlesImported} articoli e ricostruite {legacyResult.invoicesReconstructed} fatture storiche già liquidate.
            </div>
          )}

          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs text-slate-500">
              Le fatture storiche ricostruite da un'importazione fatta prima del 13/10/2026 possono avere la data di fine periodo sbagliata di un giorno
              (es. "al 29/09" invece di "al 30/09"). I totali non sono interessati, solo il periodo mostrato in stampa. Questo pulsante corregge solo
              quelle, senza toccare nient'altro.
            </p>
            <Button variant="secondary" size="sm" onClick={handleRepairInvoiceDates} disabled={repairBusy} type="button">
              {repairBusy ? 'Correzione in corso...' : 'Correggi date di fine periodo'}
            </Button>
            {repairResult !== null && (
              <span className="ml-2 text-xs text-slate-500">{repairResult > 0 ? `${repairResult} fatture corrette.` : 'Nessuna correzione necessaria.'}</span>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmLegacyImport}
        title="Importa dati dal vecchio gestionale"
        danger
        requireText="IMPORTA"
        message={`Verranno aggiunti ${legacySummary?.vendorsTotal ?? 0} venditori e ${legacySummary?.articlesTotal ?? 0} articoli ai dati già presenti. Verrà creata un'istantanea di sicurezza prima di procedere. L'operazione non è reversibile da qui (ma puoi ripristinare l'istantanea).`}
        confirmLabel={legacyImporting ? 'Importazione in corso...' : 'Importa'}
        onCancel={() => setConfirmLegacyImport(false)}
        onConfirm={handleConfirmLegacyImport}
      />

      <Card>
        <CardHeader
          title="Diagnostica dati"
          subtitle="Controlla l'archivio alla ricerca di incongruenze: date impossibili, record collegati a venditori inesistenti, prezzi mancanti, duplicati"
          action={
            <Button size="sm" variant="secondary" onClick={handleRunIntegrityCheck} disabled={integrityBusy} type="button">
              <ShieldCheck size={14} /> {integrityBusy ? 'Verifica in corso...' : 'Esegui verifica'}
            </Button>
          }
        />
        {integrityReport && (
          <div className="divide-y divide-slate-100">
            <p className="px-4 py-2 text-xs text-slate-400">
              Verificato il {new Date(integrityReport.ranAt).toLocaleString('it-IT')} — {integrityReport.totals.vendors} venditori, {integrityReport.totals.articles} articoli,{' '}
              {integrityReport.totals.invoices} fatture.
            </p>
            {integrityReport.checks.map((c) => (
              <div key={c.key}>
                <button
                  type="button"
                  onClick={() => c.count > 0 && setExpandedCheck((k) => (k === c.key ? null : c.key))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
                >
                  <span className="flex items-center gap-1.5 text-sm text-slate-700">
                    {c.count > 0 && (expandedCheck === c.key ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />)}
                    {c.title}
                  </span>
                  <Badge tone={c.severity === 'ok' ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-800'}>{c.count}</Badge>
                </button>
                {expandedCheck === c.key && c.count > 0 && (
                  <div className="space-y-1 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    <p className="mb-2 text-slate-400">{c.detail}</p>
                    {c.items.slice(0, 50).map((item, i) =>
                      item.to ? (
                        <Link key={i} to={item.to} className="block text-brand-700 hover:underline">
                          {item.label}
                        </Link>
                      ) : (
                        <p key={i}>{item.label}</p>
                      ),
                    )}
                    {c.count > 50 && <p className="text-slate-400">... e altri {c.count - 50}.</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Dati e backup" />
        <div className="flex flex-wrap gap-2 p-4">
          <Button variant="secondary" size="sm" onClick={handleExportBackup} type="button">
            <Download size={14} /> Esporta backup JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} type="button">
            <Upload size={14} /> Importa backup JSON
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportBackup} />
          <Button variant="secondary" size="sm" onClick={handleExportArchiveCSV} type="button">
            <Download size={14} /> Esporta archivio CSV
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)} type="button" className="ml-auto">
            <RotateCcw size={14} /> Azzera tutti i dati
          </Button>
        </div>
        {snapshots.length > 0 && (
          <div className="border-t border-slate-100 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Istantanee automatiche</p>
            <ul className="space-y-1 text-sm">
              {snapshots.map((s, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-slate-600">
                    {new Date(s.at).toLocaleString('it-IT')} – <span className="text-slate-400">{s.reason}</span>
                  </span>
                  <button
                    className="text-xs font-medium text-brand-700 hover:underline"
                    onClick={async () => {
                      await restoreSnapshot(i)
                      toast('Istantanea ripristinata. Ricarico...', 'success')
                      setTimeout(() => window.location.reload(), 600)
                    }}
                  >
                    Ripristina
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="Azzera tutti i dati"
        danger
        requireText="CANCELLA"
        message="Questa operazione elimina definitivamente venditori, articoli, fatture e registro. Verrà creata un'istantanea di sicurezza prima di procedere."
        confirmLabel="Azzera tutto"
        onCancel={() => setConfirmReset(false)}
        onConfirm={handleReset}
      />
    </div>
  )
}
