import ExcelJS from 'exceljs'
import { triggerDownload } from './backup'

/** Legacy-compatible CSV: `;` separator, UTF-8 BOM, always-quoted fields,
 * comma as decimal separator (Italian locale conventions). */
export function downloadCSV(filename, rows, columns) {
  const lines = []
  lines.push(columns.map((c) => csvCell(c.header)).join(';'))
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(formatCell(c.value(row)))).join(';'))
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, filename)
}

function formatCell(value) {
  if (typeof value === 'number') return value.toFixed(2).replace('.', ',')
  return value ?? ''
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

export async function downloadXLSX(filename, rows, columns, sheetName = 'Dati') {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.header, width: c.width || 18 }))
  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map((c) => [c.header, c.value(row)])))
  }
  sheet.getRow(1).font = { bold: true }
  const buffer = await workbook.xlsx.writeBuffer()
  triggerDownload(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}
