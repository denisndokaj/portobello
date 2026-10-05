import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import Modal from './ui/Modal'
import { toast } from '../store/useToastStore'

const REGION_ID = 'barcode-scanner-region'

/** Camera-based barcode/QR scanner for smartphones and tablets, used
 * wherever a USB/Bluetooth scanner (which just types + Enter) isn't
 * available. Scans CODE128 article codes. */
export default function BarcodeScannerModal({ open, onClose, onResult }) {
  const scannerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const scanner = new Html5Qrcode(REGION_ID)
    scannerRef.current = scanner
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 140 } },
        (text) => {
          onResult(text.replace(/\D/g, ''))
          onClose()
        },
        () => {},
      )
      .catch(() => toast('Impossibile accedere alla fotocamera', 'error'))

    return () => {
      scanner.stop().then(() => scanner.clear()).catch(() => {})
    }
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="Scansiona codice a barre" size="sm">
      <div id={REGION_ID} className="overflow-hidden rounded-lg bg-black" />
      <p className="mt-3 text-center text-xs text-slate-400">Inquadra il codice a barre dell'articolo</p>
    </Modal>
  )
}
