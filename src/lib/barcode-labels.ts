/**
 * Generador de hojas de etiquetas EAN13 en PDF (pdf-lib).
 * Soporta A4 / letter, columnas/filas configurables y 3 formatos:
 *   - standard: SKU + nombre + barcode
 *   - price: SKU + nombre + precio + barcode
 *   - compact: solo barcode + SKU
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { encodeEan13 } from './barcode-ean13'
import { isValidEan13 } from './validators'

export interface LabelProduct {
  sku: string
  name: string
  ean: string | null | undefined
  price?: number | null
}

export interface LabelOptions {
  sheetSize?: 'A4' | 'letter'
  columns?: number
  rows?: number
  format?: 'standard' | 'price' | 'compact'
  marginPt?: number  // margen exterior de la hoja en puntos
  gapPt?: number     // separación entre etiquetas
}

const SHEETS_PT = {
  A4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
}

export async function generateLabelsPDF(
  products: LabelProduct[],
  options: LabelOptions = {}
): Promise<Blob> {
  const sheetSize = options.sheetSize ?? 'A4'
  const cols = options.columns ?? 3
  const rows = options.rows ?? 8
  const format = options.format ?? 'standard'
  const margin = options.marginPt ?? 28
  const gap = options.gapPt ?? 6

  const sheet = SHEETS_PT[sheetSize]
  const labelW = (sheet.w - margin * 2 - gap * (cols - 1)) / cols
  const labelH = (sheet.h - margin * 2 - gap * (rows - 1)) / rows
  const perPage = cols * rows

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const mono = await pdf.embedFont(StandardFonts.Courier)

  let page = pdf.addPage([sheet.w, sheet.h])
  let idx = 0

  for (const p of products) {
    if (idx > 0 && idx % perPage === 0) {
      page = pdf.addPage([sheet.w, sheet.h])
    }
    const slot = idx % perPage
    const col = slot % cols
    const row = Math.floor(slot / cols)
    const x = margin + col * (labelW + gap)
    // pdf-lib origin is bottom-left
    const y = sheet.h - margin - (row + 1) * labelH - row * gap

    drawLabel(page, x, y, labelW, labelH, p, format, { font, fontBold, mono })
    idx++
  }

  const bytes = await pdf.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

interface FontSet {
  font: import('pdf-lib').PDFFont
  fontBold: import('pdf-lib').PDFFont
  mono: import('pdf-lib').PDFFont
}

function drawLabel(
  page: import('pdf-lib').PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  p: LabelProduct,
  format: 'standard' | 'price' | 'compact',
  fonts: FontSet
) {
  // Borde sutil para reférenciar el corte
  page.drawRectangle({
    x, y, width: w, height: h,
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
  })

  const padding = 6
  const contentW = w - padding * 2
  const contentX = x + padding

  // SKU header
  if (format !== 'compact') {
    const skuSize = Math.min(10, contentW / Math.max(p.sku.length * 0.6, 6))
    page.drawText(p.sku, {
      x: contentX,
      y: y + h - padding - skuSize,
      size: skuSize,
      font: fonts.fontBold,
      color: rgb(0, 0, 0),
    })
    // Nombre (truncado)
    const maxNameLen = Math.floor(contentW / 4)
    const name = p.name.length > maxNameLen ? p.name.slice(0, maxNameLen - 1) + '…' : p.name
    page.drawText(name, {
      x: contentX,
      y: y + h - padding - skuSize - 10,
      size: 7,
      font: fonts.font,
      color: rgb(0.2, 0.2, 0.2),
    })
  }

  if (format === 'price' && p.price != null) {
    const priceText = `EUR ${p.price.toFixed(2)}`
    page.drawText(priceText, {
      x: contentX + contentW - priceText.length * 5,
      y: y + h - padding - 9,
      size: 9,
      font: fonts.fontBold,
      color: rgb(0, 0, 0),
    })
  }

  // Barcode
  const ean = (p.ean || '').trim()
  if (ean && isValidEan13(ean)) {
    drawEan13(page, ean, contentX, y + padding, contentW, format === 'compact' ? h - padding * 2 : h * 0.55, fonts.mono)
  } else {
    page.drawText(ean || '(sin EAN)', {
      x: contentX,
      y: y + padding + 4,
      size: 7,
      font: fonts.mono,
      color: rgb(0.6, 0.2, 0.2),
    })
  }
}

function drawEan13(
  page: import('pdf-lib').PDFPage,
  code: string,
  x: number,
  y: number,
  w: number,
  h: number,
  monoFont: import('pdf-lib').PDFFont
) {
  const bits = encodeEan13(code)
  const textHeight = 8
  const barH = h - textHeight - 2
  const moduleW = w / bits.length

  for (let i = 0; i < bits.length; i++) {
    if (!bits[i]) continue
    page.drawRectangle({
      x: x + i * moduleW,
      y: y + textHeight + 2,
      width: moduleW,
      height: barH,
      color: rgb(0, 0, 0),
    })
  }

  // Texto del código debajo
  const fontSize = Math.min(8, w / 12)
  const textW = monoFont.widthOfTextAtSize(code, fontSize)
  page.drawText(code, {
    x: x + (w - textW) / 2,
    y: y + 1,
    size: fontSize,
    font: monoFont,
    color: rgb(0, 0, 0),
  })
}
