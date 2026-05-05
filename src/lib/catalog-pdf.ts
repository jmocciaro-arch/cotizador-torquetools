/**
 * Generador de catálogo PDF (pdf-lib).
 *
 * Templates:
 *   - compact:  1 fila por producto (densa). Útil para tarifas.
 *   - classic:  1 ficha por página con todos los specs.
 *   - visual:   2 fichas por página con foto grande.
 *
 * Soporta multi-idioma vía RPC `get_product_text` (lib/product-translations).
 */

import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib'
import type { Locale } from './product-translations'
import { getProductText } from './product-translations'

export interface CatalogPDFProduct {
  id: string
  sku: string
  name: string
  description?: string | null
  brand?: string | null
  category?: string | null
  price_eur?: number | null
  price_usd?: number | null
  ean?: string | null
  image_url?: string | null
  diagram_url?: string | null
  gallery_urls?: Array<{ url: string; alt?: string }> | null
  specs?: Record<string, string> | null
}

export type CatalogTemplate = 'compact' | 'classic' | 'visual'

export interface CatalogPDFOptions {
  products: CatalogPDFProduct[]
  companyName?: string
  companyId?: string
  locale?: Locale
  template?: CatalogTemplate
  includeImages?: boolean
  includeDiagrams?: boolean
  includePrices?: boolean
  title?: string
}

const PAGE = { w: 595.28, h: 841.89 } // A4 portrait

export async function generateCatalogPDF(opts: CatalogPDFOptions): Promise<Blob> {
  const products = opts.products
  const template = opts.template ?? 'classic'
  const includeImages = opts.includeImages ?? true
  const includeDiagrams = opts.includeDiagrams ?? false
  const includePrices = opts.includePrices ?? true
  const locale: Locale = opts.locale ?? 'es'

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Si locale != es, preprocesar traducciones
  const localized = await Promise.all(products.map(async (p) => {
    if (locale === 'es') return p
    try {
      const [name, description] = await Promise.all([
        getProductText(p.id, locale, 'name'),
        getProductText(p.id, locale, 'description'),
      ])
      return {
        ...p,
        name: name || p.name,
        description: description || p.description,
      }
    } catch {
      return p
    }
  }))

  // Cover
  drawCover(pdf.addPage([PAGE.w, PAGE.h]), {
    title: opts.title || 'Catálogo de productos',
    company: opts.companyName || 'Torquetools',
    count: localized.length,
    locale,
    font,
    fontBold,
  })

  // Index by category
  const byCat = new Map<string, CatalogPDFProduct[]>()
  for (const p of localized) {
    const cat = p.category || 'Sin categoría'
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat)!.push(p)
  }

  // Index page
  drawIndex(pdf.addPage([PAGE.w, PAGE.h]), byCat, font, fontBold)

  // Product pages — agrupados por categoría
  for (const [cat, items] of byCat.entries()) {
    if (template === 'compact') {
      await drawCompactSection(pdf, cat, items, font, fontBold, includePrices)
    } else if (template === 'visual') {
      await drawVisualSection(pdf, cat, items, font, fontBold, includePrices, includeImages)
    } else {
      await drawClassicSection(pdf, cat, items, font, fontBold, includePrices, includeImages, includeDiagrams)
    }
  }

  const bytes = await pdf.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

// -- Cover ----------------------------------------------------------------

interface CoverArgs {
  title: string
  company: string
  count: number
  locale: Locale
  font: PDFFont
  fontBold: PDFFont
}

function drawCover(page: PDFPage, a: CoverArgs) {
  const accent = rgb(1, 0.4, 0)  // #FF6600
  page.drawRectangle({ x: 0, y: PAGE.h - 8, width: PAGE.w, height: 8, color: accent })
  page.drawRectangle({ x: 0, y: 0, width: PAGE.w, height: 8, color: accent })

  page.drawText(a.company, {
    x: 60,
    y: PAGE.h - 200,
    size: 32,
    font: a.fontBold,
    color: rgb(0.1, 0.1, 0.15),
  })

  page.drawText(a.title, {
    x: 60,
    y: PAGE.h - 250,
    size: 22,
    font: a.font,
    color: rgb(0.2, 0.2, 0.25),
  })

  const today = new Date().toLocaleDateString('es-AR')
  page.drawText(`${a.count} productos — ${today}`, {
    x: 60,
    y: 90,
    size: 11,
    font: a.font,
    color: rgb(0.4, 0.4, 0.4),
  })

  page.drawText(`Idioma: ${a.locale.toUpperCase()}`, {
    x: 60,
    y: 70,
    size: 10,
    font: a.font,
    color: rgb(0.5, 0.5, 0.5),
  })
}

// -- Index -----------------------------------------------------------------

function drawIndex(
  page: PDFPage,
  byCat: Map<string, CatalogPDFProduct[]>,
  font: PDFFont,
  fontBold: PDFFont
) {
  page.drawText('Índice', { x: 60, y: PAGE.h - 80, size: 20, font: fontBold, color: rgb(0.1, 0.1, 0.15) })

  let y = PAGE.h - 120
  for (const [cat, items] of byCat.entries()) {
    if (y < 80) break  // si se llena, cortamos (TODO multi-página)
    page.drawText(`${cat}`, { x: 60, y, size: 12, font: fontBold, color: rgb(0.15, 0.15, 0.2) })
    page.drawText(`${items.length} productos`, { x: PAGE.w - 160, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) })
    y -= 22
  }
}

// -- Compact ---------------------------------------------------------------

async function drawCompactSection(
  pdf: PDFDocument,
  category: string,
  items: CatalogPDFProduct[],
  font: PDFFont,
  fontBold: PDFFont,
  includePrices: boolean
) {
  let page = pdf.addPage([PAGE.w, PAGE.h])
  drawCategoryHeader(page, category, fontBold)
  let y = PAGE.h - 120

  for (const p of items) {
    if (y < 60) {
      page = pdf.addPage([PAGE.w, PAGE.h])
      drawCategoryHeader(page, category, fontBold)
      y = PAGE.h - 120
    }
    page.drawText(p.sku, { x: 50, y, size: 9, font: fontBold, color: rgb(0, 0, 0) })
    page.drawText(truncate(p.name, 60), { x: 150, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
    if (includePrices && p.price_eur != null) {
      const txt = `${p.price_eur.toFixed(2)} EUR`
      const w = font.widthOfTextAtSize(txt, 9)
      page.drawText(txt, { x: PAGE.w - 60 - w, y, size: 9, font: fontBold })
    }
    y -= 18
  }
}

// -- Classic ---------------------------------------------------------------

async function drawClassicSection(
  pdf: PDFDocument,
  category: string,
  items: CatalogPDFProduct[],
  font: PDFFont,
  fontBold: PDFFont,
  includePrices: boolean,
  includeImages: boolean,
  includeDiagrams: boolean
) {
  for (const p of items) {
    const page = pdf.addPage([PAGE.w, PAGE.h])
    drawCategoryHeader(page, category, fontBold)

    page.drawText(p.sku, { x: 50, y: PAGE.h - 130, size: 11, font: fontBold, color: rgb(1, 0.4, 0) })
    page.drawText(truncate(p.name, 60), { x: 50, y: PAGE.h - 155, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.15) })
    if (p.brand) {
      page.drawText(p.brand, { x: 50, y: PAGE.h - 180, size: 11, font, color: rgb(0.4, 0.4, 0.4) })
    }

    const topY = PAGE.h - 220

    // Imagen
    if (includeImages && p.image_url) {
      try {
        const img = await embedImage(pdf, p.image_url)
        if (img) {
          const dims = img.scaleToFit(220, 220)
          page.drawImage(img, { x: 50, y: topY - dims.height, width: dims.width, height: dims.height })
        }
      } catch (e) {
        console.warn('Catálogo PDF: no pude embeber imagen', p.sku, (e as Error).message)
      }
    }

    // Description right side
    if (p.description) {
      drawWrappedText(page, p.description, {
        x: 290, y: topY, width: 250, fontSize: 10, font, lineHeight: 13, maxLines: 12,
      })
    }

    // Specs
    let specY = topY - 240
    if (p.specs) {
      page.drawText('Especificaciones', { x: 50, y: specY, size: 11, font: fontBold })
      specY -= 18
      for (const [k, v] of Object.entries(p.specs)) {
        if (specY < 100) break
        page.drawText(`${k}:`, { x: 50, y: specY, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
        page.drawText(String(v), { x: 180, y: specY, size: 9, font, color: rgb(0.1, 0.1, 0.1) })
        specY -= 14
      }
    }

    // Diagrama (si está habilitado)
    if (includeDiagrams && p.diagram_url && specY > 120) {
      try {
        const img = await embedImage(pdf, p.diagram_url)
        if (img) {
          const dims = img.scaleToFit(150, Math.max(60, specY - 80))
          page.drawImage(img, { x: 290, y: 80, width: dims.width, height: dims.height })
        }
      } catch {/* ignore */}
    }

    // Footer: precio + EAN
    if (includePrices && p.price_eur != null) {
      page.drawText(`${p.price_eur.toFixed(2)} EUR`, {
        x: PAGE.w - 150, y: 50, size: 14, font: fontBold, color: rgb(1, 0.4, 0),
      })
    }
    if (p.ean) {
      page.drawText(`EAN: ${p.ean}`, { x: 50, y: 50, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
    }
  }
}

// -- Visual ---------------------------------------------------------------

async function drawVisualSection(
  pdf: PDFDocument,
  category: string,
  items: CatalogPDFProduct[],
  font: PDFFont,
  fontBold: PDFFont,
  includePrices: boolean,
  includeImages: boolean
) {
  // 2 productos por página verticalmente
  for (let i = 0; i < items.length; i += 2) {
    const page = pdf.addPage([PAGE.w, PAGE.h])
    drawCategoryHeader(page, category, fontBold)

    for (let slot = 0; slot < 2; slot++) {
      const p = items[i + slot]
      if (!p) break
      const yTop = slot === 0 ? PAGE.h - 130 : PAGE.h / 2 - 30
      const yBottom = slot === 0 ? PAGE.h / 2 + 10 : 60

      if (includeImages && p.image_url) {
        try {
          const img = await embedImage(pdf, p.image_url)
          if (img) {
            const maxH = yTop - yBottom - 60
            const dims = img.scaleToFit(220, Math.max(60, maxH))
            page.drawImage(img, { x: 50, y: yBottom + 50, width: dims.width, height: dims.height })
          }
        } catch {/* ignore */}
      }

      page.drawText(truncate(p.name, 55), {
        x: 290, y: yTop - 20, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.15),
      })
      page.drawText(p.sku, {
        x: 290, y: yTop - 40, size: 10, font, color: rgb(1, 0.4, 0),
      })
      if (p.description) {
        drawWrappedText(page, p.description, {
          x: 290, y: yTop - 60, width: 250, fontSize: 9, font, lineHeight: 12, maxLines: 8,
        })
      }
      if (includePrices && p.price_eur != null) {
        page.drawText(`${p.price_eur.toFixed(2)} EUR`, {
          x: 290, y: yBottom + 60, size: 16, font: fontBold, color: rgb(1, 0.4, 0),
        })
      }
    }
  }
}

// -- Utils -----------------------------------------------------------------

function drawCategoryHeader(page: PDFPage, category: string, fontBold: PDFFont) {
  page.drawRectangle({ x: 0, y: PAGE.h - 60, width: PAGE.w, height: 4, color: rgb(1, 0.4, 0) })
  page.drawText(category, { x: 50, y: PAGE.h - 95, size: 14, font: fontBold, color: rgb(0.15, 0.15, 0.2) })
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  o: { x: number; y: number; width: number; fontSize: number; font: PDFFont; lineHeight: number; maxLines: number }
) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? line + ' ' + w : w
    const ww = o.font.widthOfTextAtSize(candidate, o.fontSize)
    if (ww > o.width && line) {
      lines.push(line)
      line = w
    } else {
      line = candidate
    }
    if (lines.length >= o.maxLines) break
  }
  if (line && lines.length < o.maxLines) lines.push(line)

  for (let i = 0; i < lines.length; i++) {
    page.drawText(lines[i], {
      x: o.x,
      y: o.y - i * o.lineHeight,
      size: o.fontSize,
      font: o.font,
      color: rgb(0.2, 0.2, 0.2),
    })
  }
}

async function embedImage(pdf: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('jpeg') || ct.includes('jpg') || url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.jpeg')) {
      return await pdf.embedJpg(buf)
    }
    if (ct.includes('png') || url.toLowerCase().endsWith('.png')) {
      return await pdf.embedPng(buf)
    }
    // Intento JPG por default
    try { return await pdf.embedJpg(buf) } catch { return await pdf.embedPng(buf) }
  } catch {
    return null
  }
}
