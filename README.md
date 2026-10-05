# Portobello Gestionale

Gestionale web & mobile per il conto vendita del Mercatino Portobello Clavesana. React + Vite + Tailwind CSS, local-first su IndexedDB (Dexie), installabile come PWA.

## Stack

- **UI**: React 19, React Router, Tailwind CSS v4, componenti propri in `src/components/ui`
- **Dati**: Dexie.js (IndexedDB) tramite un layer di servizi in `src/services`, pensato per essere sostituito con un backend cloud cambiando un solo file (`src/lib/config.js`, variabile `BACKEND` / `VITE_BACKEND_MODE`) senza toccare le viste
- **PWA**: `vite-plugin-pwa`, manifest + service worker con cache offline
- **Documenti**: jsPDF (mandati, distinte, riepiloghi), JsBarcode (etichette CODE128), html5-qrcode (scansione da fotocamera), ExcelJS (export XLSX)

## Avvio

```bash
npm install
npm run dev       # sviluppo
npm run build     # build di produzione in dist/
npm run preview   # serve la build di produzione
npm run lint      # oxlint
```

## Struttura

```
src/
  lib/            logica di business pura (sconti, provvigioni, numerazione), PDF, backup, export
  services/       layer di accesso dati (services/local = IndexedDB; services/index.js = switch backend)
  store/          stato globale (zustand): impostazioni, carrello cassa, toast
  components/     componenti UI condivisi (layout, form, modali, scanner, firma...)
  features/       una cartella per modulo applicativo (venditori, articoli, cassa, distinte, etichette, report, impostazioni)
```

## Logica di business

Le regole (codifica articoli, sconto progressivo, calcolo netto/provvigione, numerazione distinte su due serie indipendenti, scadenza mandato) sono centralizzate in `src/lib/business.js` e configurabili dalla pagina Impostazioni, senza modificare il codice.
