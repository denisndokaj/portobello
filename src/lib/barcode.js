import JsBarcode from 'jsbarcode'
import { padCode } from './business'

/** Renders a CODE128 barcode for the article code onto an <svg> element. */
export function renderBarcode(svgEl, code, options = {}) {
  if (!svgEl) return
  try {
    JsBarcode(svgEl, padCode(code), {
      format: 'CODE128',
      displayValue: false,
      height: 32,
      margin: 0,
      ...options,
    })
  } catch {
    // Ignore render errors for transient/empty refs during unmount.
  }
}

export function barcodeDataUrl(code, options = {}) {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, padCode(code), { format: 'CODE128', displayValue: false, height: 40, margin: 0, ...options })
  return canvas.toDataURL('image/png')
}
