import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate, formatMoney } from './business'

export const PAGE_WIDTH = 210
export const PAGE_HEIGHT = 297
export const MARGIN = 16

// Shared palette for every generated document - a single conservative accent
// (the shop's own brand green) plus a scale of greys, used consistently so
// a mandate, a settlement and a receipt all read as the same institution's
// paperwork rather than three different templates.
export const INK = [30, 32, 36]
export const MUTED = [110, 115, 122]
export const FAINT_RULE = [222, 224, 227]
export const ACCENT = [21, 128, 61]
export const ACCENT_SOFT = [240, 247, 242]

export function newDoc() {
  return new jsPDF({ unit: 'mm', format: 'a4' })
}

function setInk(doc) {
  doc.setTextColor(...INK)
}

/** Formal letterhead: logo + shop identity on the left, a bordered document
 * badge (type, number, date, any extra meta lines) on the right, closed off
 * by a heavier accent rule. This is the one header every generated document
 * shares, so the mandate, the settlement and the goods-received receipt all
 * read as paperwork from the same, serious institution. Returns the y
 * position where the caller should continue drawing. */
export function pdfHeader(doc, settings, docType, opts = {}) {
  const { number, date, meta = [] } = opts
  const hasLogo = !!settings.shop.logoBase64
  const textX = hasLogo ? MARGIN + 20 : MARGIN

  if (hasLogo) {
    try {
      doc.addImage(settings.shop.logoBase64, 'PNG', MARGIN, 10, 16, 16)
    } catch {
      // Unsupported image format for this user-provided logo; skip silently.
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  setInk(doc)
  doc.text(settings.shop.name, textX, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.3)
  doc.setTextColor(...MUTED)
  const infoLines = [settings.shop.address, [settings.shop.phone, settings.shop.email].filter(Boolean).join('   ·   '), settings.shop.vat ? `P.IVA/C.F. ${settings.shop.vat}` : '']
    .filter(Boolean)
  infoLines.forEach((line, i) => doc.text(line, textX, 21 + i * 3.8))

  // Document badge, top right.
  const boxW = 62
  const boxX = PAGE_WIDTH - MARGIN - boxW
  const boxLines = 1 + (number ? 1 : 0) + (date ? 1 : 0) + meta.length
  const boxH = 6 + boxLines * 4.6
  doc.setDrawColor(...FAINT_RULE)
  doc.setLineWidth(0.35)
  doc.roundedRect(boxX, 9, boxW, boxH, 1, 1)

  let by = 14.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setInk(doc)
  doc.text(docType, boxX + boxW / 2, by, { align: 'center', maxWidth: boxW - 6 })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  if (number) {
    by += 5
    doc.text(number, boxX + boxW / 2, by, { align: 'center' })
  }
  if (date) {
    by += 4.6
    doc.text(date, boxX + boxW / 2, by, { align: 'center' })
  }
  meta.forEach((line) => {
    by += 4.6
    doc.text(line, boxX + boxW / 2, by, { align: 'center' })
  })

  const y = Math.max(34, 11 + boxH + 4)
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.7)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  doc.setDrawColor(...FAINT_RULE)
  doc.setLineWidth(0.2)
  setInk(doc)
  return y + 9
}

/** "Spett.le" recipient block, the convention any formal Italian commercial
 * document uses to identify who it's addressed to. `lines` are rendered
 * below the name in muted text (CF, address, ...). */
export function pdfRecipientBlock(doc, y, { name, lines = [] }) {
  const boxW = 90
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  const nameLines = doc.splitTextToSize(name, boxW - 8)
  const boxH = 8 + nameLines.length * 5 + lines.length * 4.3

  doc.setDrawColor(...FAINT_RULE)
  doc.setFillColor(...ACCENT_SOFT)
  doc.roundedRect(MARGIN, y, boxW, boxH, 1, 1, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text('SPETT.LE', MARGIN + 4, y + 5.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  setInk(doc)
  doc.text(nameLines, MARGIN + 4, y + 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.3)
  doc.setTextColor(...MUTED)
  const linesY = y + 10 + nameLines.length * 5
  lines.forEach((line, i) => doc.text(line, MARGIN + 4, linesY + i * 4.3))

  setInk(doc)
  return y + boxH + 8
}

/** Truncates with an ellipsis if `text` would overflow `maxWidth` at the
 * doc's current font - a label built from a user-editable shop name must
 * never be allowed to run into the value column next to it. */
function fitText(doc, text, maxWidth) {
  if (doc.getTextWidth(text) <= maxWidth) return text
  let truncated = text
  while (truncated.length > 1 && doc.getTextWidth(truncated + '…') > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '…'
}

/** Right-aligned summary rows (label/value pairs) ending in one visually
 * dominant boxed total - the number the reader actually came for. */
export function pdfSummary(doc, y, rows, { highlightLabel, highlightValue }) {
  const right = PAGE_WIDTH - MARGIN
  const labelX = right - 78
  const labelMaxWidth = right - labelX - 24
  doc.setFontSize(9.3)
  rows.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    doc.text(fitText(doc, label, labelMaxWidth), labelX, y + i * 5.6)
    doc.setFont('helvetica', 'normal')
    setInk(doc)
    doc.text(value, right, y + i * 5.6, { align: 'right' })
  })
  y += rows.length * 5.6 + 4

  if (highlightLabel) {
    const boxH = 13
    const boxW = 78
    const boxX = right - boxW
    doc.setFillColor(...ACCENT)
    doc.roundedRect(boxX, y, boxW, boxH, 1.2, 1.2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(fitText(doc, highlightLabel.toUpperCase(), boxW - 10), boxX + 5, y + 5.3)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(highlightValue, boxX + boxW - 5, y + 10.3, { align: 'right' })
    setInk(doc)
    y += boxH
  }
  return y + 8
}

export function pdfFooter(doc, settings, note) {
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...FAINT_RULE)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, 283, PAGE_WIDTH - MARGIN, 283)
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(settings.shop.name, MARGIN, 288)
    if (note) doc.text(note, PAGE_WIDTH / 2, 288, { align: 'center' })
    doc.text(`Pagina ${i} di ${pageCount}`, PAGE_WIDTH - MARGIN, 288, { align: 'right' })
    setInk(doc)
  }
}

/** Two signature lines side by side (mercatino / controparte), the layout
 * every settlement and receipt ends on. */
export function pdfSignatureRow(doc, y, left, right) {
  const colW = (PAGE_WIDTH - MARGIN * 2 - 10) / 2
  const draw = (x, spec) => {
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(spec.label, x, y)
    if (spec.image) {
      try {
        doc.addImage(spec.image, 'PNG', x, y + 2, Math.min(colW, 55), 20)
      } catch {
        // Ignore malformed signature image.
      }
    }
    doc.setDrawColor(...INK)
    doc.setLineWidth(0.2)
    doc.line(x, y + 24, x + colW, y + 24)
    doc.setFontSize(7.5)
    doc.text(spec.sublabel || 'Firma', x, y + 28)
  }
  draw(MARGIN, left)
  draw(MARGIN + colW + 10, right)
  setInk(doc)
  doc.setDrawColor(...FAINT_RULE)
  return y + 32
}

export { autoTable }
export { formatMoney, formatDate }
