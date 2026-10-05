import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate, formatMoney } from './business'

export const PAGE_WIDTH = 210
export const PAGE_HEIGHT = 297
export const MARGIN = 16

// Monochrome, classic document palette - ink and two greys, no colour
// accents. Matches the shop's existing print style (a centred letterhead,
// plain ruled table, a single bold total line) rather than a "modern SaaS
// invoice" look.
export const INK = [20, 21, 24]
export const MUTED = [100, 104, 110]
export const FAINT_RULE = [205, 207, 211]

export function newDoc() {
  return new jsPDF({ unit: 'mm', format: 'a4' })
}

function setInk(doc) {
  doc.setTextColor(...INK)
}

const CENTER_X = PAGE_WIDTH / 2

/** Centred letterhead: shop name, contact line, document title and
 * subtitle, closed off by a plain rule - the one header every generated
 * document shares. Returns the y position where the caller continues. */
export function pdfLetterhead(doc, settings, title, subtitle) {
  let y = 20

  if (settings.shop.logoBase64) {
    try {
      doc.addImage(settings.shop.logoBase64, 'PNG', MARGIN, 12, 16, 16)
    } catch {
      // Unsupported image format for this user-provided logo; skip silently.
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  setInk(doc)
  doc.text(settings.shop.name, CENTER_X, y, { align: 'center' })
  y += 6.5

  const contact = [settings.shop.address, [settings.shop.phone, settings.shop.email].filter(Boolean).join('  —  ')].filter(Boolean).join('  —  ')
  if (contact) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(contact, CENTER_X, y, { align: 'center' })
    y += 8
  } else {
    y += 3
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  setInk(doc)
  doc.text(title.toUpperCase(), CENTER_X, y, { align: 'center' })
  y += 6

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(subtitle, CENTER_X, y, { align: 'center' })
    y += 6
  }

  y += 3
  doc.setDrawColor(...FAINT_RULE)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
  setInk(doc)
  return y + 10
}

/** A left "Label: value" plus a stack of right-aligned "Label: value"
 * lines - the plain identification block every document uses instead of
 * a boxed "recipient card". */
export function pdfMetaRow(doc, y, { left, rightLines = [] }) {
  doc.setFontSize(9.5)
  if (left) {
    doc.setFont('helvetica', 'bold')
    setInk(doc)
    const labelText = `${left[0]}: `
    doc.text(labelText, MARGIN, y)
    const labelW = doc.getTextWidth(labelText)
    doc.setFont('helvetica', 'normal')
    doc.text(String(left[1]), MARGIN + labelW, y)
  }

  const rightX = PAGE_WIDTH - MARGIN
  rightLines.forEach(([label, value], i) => {
    const ly = y + i * 5
    doc.setFont('helvetica', 'normal')
    setInk(doc)
    const valueText = String(value)
    doc.text(valueText, rightX, ly, { align: 'right' })
    const valueW = doc.getTextWidth(valueText)
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}: `, rightX - valueW, ly, { align: 'right' })
  })

  setInk(doc)
  const rows = Math.max(left ? 1 : 0, rightLines.length)
  return y + rows * 5 + 9
}

/** Bold "Label:" followed by a wrapped paragraph in normal weight - used
 * for the mandate terms / consignment conditions block. */
export function pdfLabeledParagraph(doc, y, label, text) {
  doc.setFontSize(9.3)
  const maxWidth = PAGE_WIDTH - MARGIN * 2
  const lines = doc.splitTextToSize(text, maxWidth)

  doc.setFont('helvetica', 'bold')
  setInk(doc)
  doc.text(label, MARGIN, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text(lines, MARGIN, y)
  return y + lines.length * 4.6 + 8
}

/** Stacked right-aligned "Label: value" total lines, the last one (or any
 * flagged `emphasis`) set larger and bold - there is no boxed highlight,
 * just type weight, matching the shop's own print style. */
export function pdfTotals(doc, y, lines) {
  const rightX = PAGE_WIDTH - MARGIN
  lines.forEach((line) => {
    const size = line.emphasis ? 11.5 : 9.5
    doc.setFontSize(size)
    doc.setFont('helvetica', 'normal')
    setInk(doc)
    doc.text(line.value, rightX, y, { align: 'right' })
    const valueW = doc.getTextWidth(line.value)
    doc.setFont('helvetica', 'bold')
    doc.text(`${line.label}: `, rightX - valueW, y, { align: 'right' })
    y += line.emphasis ? 7.5 : 5.6
  })
  setInk(doc)
  return y + 6
}

/** One left-aligned signature line, the convention the shop's own
 * documents use (no "two parties side by side" layout). */
export function pdfSingleSignature(doc, y, label, image) {
  if (image) {
    try {
      doc.addImage(image, 'PNG', MARGIN, y - 20, 50, 18)
    } catch {
      // Ignore malformed signature image.
    }
  }
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.25)
  doc.line(MARGIN, y, MARGIN + 75, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(label, MARGIN, y + 5)
  setInk(doc)
  return y + 12
}

/** Plain footer pinned to the bottom of every page: shop name, the
 * generation date, and a page count only when the document actually has
 * more than one page (bulk settlements). */
export function pdfFooter(doc, settings) {
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...FAINT_RULE)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, 281, PAGE_WIDTH - MARGIN, 281)
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(settings.shop.name, MARGIN, 287)
    doc.text(`Documento generato il ${formatDate(new Date().toISOString().slice(0, 10))}`, PAGE_WIDTH - MARGIN, 287, { align: 'right' })
    if (pageCount > 1) doc.text(`${i}/${pageCount}`, CENTER_X, 287, { align: 'center' })
    setInk(doc)
  }
}

/** Shared table look: thin grey rules on white, bold header with no fill -
 * a plain ruled table rather than a dark-banded one. */
export const TABLE_STYLE = {
  styles: { fontSize: 8.6, textColor: INK, lineColor: FAINT_RULE, lineWidth: 0.25, cellPadding: 2.3 },
  headStyles: { fillColor: 255, textColor: INK, fontStyle: 'bold', lineColor: INK, lineWidth: 0.3 },
  alternateRowStyles: { fillColor: 255 },
}

export { autoTable }
export { formatMoney, formatDate }
