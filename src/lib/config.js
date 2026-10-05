// Single switch point for the storage backend. Today only "local" (IndexedDB
// via Dexie) is implemented; "remote" is reserved for a future Supabase/
// Postgres adapter that implements the same service interface (see
// src/services/index.js). Changing this constant (or the env var) is the
// only step required to move the whole app to a cloud backend, provided a
// matching services/remote/* adapter is supplied.
export const BACKEND = import.meta.env.VITE_BACKEND_MODE || 'local'

export const DEFAULT_SETTINGS = {
  shop: {
    name: 'Mercatino Portobello Clavesana',
    address: 'Via Rogno 3, Clavesana (CN)',
    phone: '351 909 0320',
    email: 'portobelloclavesana@gmail.com',
    vat: '',
    logoBase64: '',
  },
  business: {
    defaultCommissionPercent: 50,
    taxRatePercent: 11,
    taxRoundingStrategy: 'floor_euro', // 'floor_euro' | 'round_cent'
    mandateDurationMonths: 12,
    expiryWarningMonths: 1,
    discountSteps: [
      { days: 60, discountPercent: 30 },
      { days: 90, discountPercent: 50 },
    ],
    invoicePrefix: '',
    unnumberedDocPrefix: 'NN-',
    quickSellPriceMode: 'confirm', // 'confirm' | 'auto'
    backupReminderDays: 7,
    roundingMode: 'round_cent', // generic rounding for totals/shares
    contractTerms:
      "Gli articoli saranno esposti in vendita per un periodo massimo di {DURATA} mesi. {SCONTI} " +
      'La commissione del mercatino e’ del {COMMISSIONE}% sul prezzo di vendita. ' +
      'Al termine del periodo il venditore potrà ritirare gli articoli invenduti oppure devolverli a {NEGOZIO}.',
  },
  hardware: {
    labelPrinterFormat: 'DK-11201', // DK-11201 29x90mm | DK-22205 continuo 62mm
    showVendorOnLabel: false,
    barcodeType: 'CODE128',
    receiptWidth: '80mm', // '80mm' | '57mm'
  },
}
