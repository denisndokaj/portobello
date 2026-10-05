import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate, formatMoney } from './business'

export const PAGE_WIDTH = 210
export const MARGIN = 14

export function newDoc() {
  return new jsPDF({ unit: 'mm', format: 'a4' })
}

/** Shared document header: shop logo + identity, title, subtitle. Returns
 * the y position where the caller should continue drawing. */
export function pdfHeader(doc, settings, title, subtitle) {
  let y = 16
  if (settings.shop.logoBase64) {
    try {
      doc.addImage(settings.shop.logoBase64, 'PNG', MARGIN, 10, 18, 18)
    } catch {
      // Unsupported image format for this user-provided logo; skip silently.
    }
  }
  const textX = settings.shop.logoBase64 ? MARGIN + 22 : MARGIN
  doc.setFontSize(13)
  doc.setFont(undefined, 'bold')
  doc.text(settings.shop.name, textX, y)
  doc.setFont(undefined, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100)
  const infoLines = [settings.shop.address, [settings.shop.phone, settings.shop.email].filter(Boolean).join(' · '), settings.shop.vat ? `P.IVA/CF ${settings.shop.vat}` : '']
    .filter(Boolean)
  infoLines.forEach((line, i) => doc.text(line, textX, y + 5 + i * 4))
  doc.setTextColor(0)

  y = 34
  doc.setDrawColor(220)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  y += 8
  doc.setFontSize(15)
  doc.setFont(undefined, 'bold')
  doc.text(title, MARGIN, y)
  if (subtitle) {
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(100)
    doc.text(subtitle, MARGIN, y + 6)
    doc.setTextColor(0)
    y += 6
  }
  return y + 8
}

export function pdfFooter(doc, settings) {
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`${settings.shop.name} – generato il ${formatDate(new Date().toISOString().slice(0, 10))}`, MARGIN, 290)
    doc.setTextColor(0)
  }
}

export function pdfSignatureArea(doc, y, label) {
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(label, MARGIN, y)
  doc.line(MARGIN, y + 14, MARGIN + 70, y + 14)
  doc.text('Firma', MARGIN, y + 18)
  doc.setTextColor(0)
  return y + 24
}

export function pdfSignatureImage(doc, y, dataUrl, label) {
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(label, MARGIN, y)
  try {
    doc.addImage(dataUrl, 'PNG', MARGIN, y + 2, 60, 24)
  } catch {
    // Ignore malformed signature image.
  }
  doc.setTextColor(0)
  return y + 30
}

export { autoTable }
export { formatMoney, formatDate }
