/**
 * Export utilities — CSV and Excel export for any data table
 * Con soporte para formato StelOrder
 */

import * as XLSX from 'xlsx'
import {
  STELORDER_EXPORT_MAPPINGS,
  flattenForExport,
} from '@/lib/stelorder-mappings'

export interface ExportColumn {
  key: string
  label: string
}

// ═══════════════════════════════════════════════════════
// STANDARD EXPORT (internal column names)
// ═══════════════════════════════════════════════════════

export function exportToCSV(data: Record<string, unknown>[], filename: string, columns?: ExportColumn[]) {
  if (!data.length) return

  const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }))
  const header = cols.map(c => `"${c.label}"`).join(',')
  const rows = data.map(row =>
    cols.map(c => {
      const val = row[c.key]
      if (val === null || val === undefined) return '""'
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  )

  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

export function exportToExcel(data: Record<string, unknown>[], filename: string, columns?: ExportColumn[]) {
  if (!data.length) return

  const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }))

  // Build array of arrays for xlsx
  const header = cols.map(c => c.label)
  const rows = data.map(row =>
    cols.map(c => {
      const val = row[c.key]
      if (val === null || val === undefined) return ''
      if (typeof val === 'object') return JSON.stringify(val)
      return val
    })
  )

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])

  // Auto-size columns
  const colWidths = cols.map((c, i) => {
    const maxLen = Math.max(
      c.label.length,
      ...rows.map(r => String(r[i] || '').length)
    )
    return { wch: Math.min(Math.max(maxLen, 10), 50) }
  })
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, filename.substring(0, 30))

  // Write as real XLSX file
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ═══════════════════════════════════════════════════════
// STELORDER FORMAT EXPORT
// ═══════════════════════════════════════════════════════

/**
 * Exporta datos en formato compatible con StelOrder.
 * Los headers usan los nombres de columna de StelOrder en vez de los internos.
 */
export function exportToCSVStelOrder(
  data: Record<string, unknown>[],
  filename: string,
  targetTable: string
) {
  if (!data.length) return

  const exportMapping = STELORDER_EXPORT_MAPPINGS[targetTable]
  if (!exportMapping) {
    // Fallback: exportar con nombres internos
    exportToCSV(data, filename)
    return
  }

  // Aplanar datos con objetos anidados (specs)
  const flatData = data.map(row => flattenForExport(row))

  // Construir columnas: solo las que tienen mapping a StelOrder
  const cols: ExportColumn[] = []
  for (const [internalKey, stelHeader] of Object.entries(exportMapping)) {
    cols.push({ key: internalKey, label: stelHeader })
  }

  const header = cols.map(c => `"${c.label}"`).join(';') // StelOrder usa punto y coma
  const rows = flatData.map(row =>
    cols.map(c => {
      const val = row[c.key]
      if (val === null || val === undefined) return '""'
      if (typeof val === 'boolean') return val ? '"Sí"' : '"No"'
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(';')
  )

  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}_stelorder.csv`)
}

export function exportToExcelStelOrder(
  data: Record<string, unknown>[],
  filename: string,
  targetTable: string
) {
  if (!data.length) return

  const exportMapping = STELORDER_EXPORT_MAPPINGS[targetTable]
  if (!exportMapping) {
    exportToExcel(data, filename)
    return
  }

  const flatData = data.map(row => flattenForExport(row))

  const cols: ExportColumn[] = []
  for (const [internalKey, stelHeader] of Object.entries(exportMapping)) {
    cols.push({ key: internalKey, label: stelHeader })
  }

  const header = cols.map(c => c.label)
  const rows = flatData.map(row =>
    cols.map(c => {
      const val = row[c.key]
      if (val === null || val === undefined) return ''
      if (typeof val === 'boolean') return val ? 'Sí' : 'No'
      if (typeof val === 'object') return JSON.stringify(val)
      return val
    })
  )

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])

  const colWidths = cols.map((c, i) => {
    const maxLen = Math.max(
      c.label.length,
      ...rows.map(r => String(r[i] || '').length)
    )
    return { wch: Math.min(Math.max(maxLen, 10), 50) }
  })
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'StelOrder')

  XLSX.writeFile(wb, `${filename}_stelorder.xlsx`)
}

// ═══════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

