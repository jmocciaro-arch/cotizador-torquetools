/**
 * Detección fuzzy de duplicados pre-import.
 *
 * Para cada fila incoming computa un set de candidatos en DB que podrían ser el
 * mismo producto: matches exactos por EAN/manufacturer_code, matches cercanos por
 * SKU (Levenshtein), matches fuzzy de nombre (RPC search_products_fuzzy si existe).
 *
 * Implementación naive de Levenshtein — el set se ejecuta sobre filas chicas
 * (cientos, no decenas de miles), no necesita lib externa.
 */

import { createClient } from '@/lib/supabase/client'

export interface DuplicateMatch {
  product_id: string
  product_sku: string
  product_name: string
  similarity: number
  reason: 'sku_close' | 'name_close' | 'ean_match' | 'manufacturer_code_match'
}

export interface DuplicateCandidate {
  rowIndex: number
  incoming: { sku?: string; name?: string; ean?: string; manufacturer_code?: string }
  matches: DuplicateMatch[]
}

interface FindOptions {
  threshold?: number
  max_per_row?: number
}

interface ProductLite {
  id: string
  sku: string
  name: string
  ean: string | null
  manufacturer_code: string | null
}

// ─── Levenshtein distance (iterative DP) ───
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const m = a.length
  const n = b.length
  const prev = new Array<number>(n + 1)
  const cur = new Array<number>(n + 1)

  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      cur[j] = Math.min(
        cur[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      )
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j]
  }
  return prev[n]
}

export function similarity(a: string, b: string): number {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const aN = a.trim().toLowerCase()
  const bN = b.trim().toLowerCase()
  if (aN === bN) return 1
  const maxLen = Math.max(aN.length, bN.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(aN, bN) / maxLen
}

function pick<T extends Record<string, string>>(row: T, mapping: Record<string, string>, target: string): string | undefined {
  for (const [csvCol, tgt] of Object.entries(mapping)) {
    if (tgt === target) {
      const v = row[csvCol]
      if (v && v.trim()) return v.trim()
    }
  }
  return undefined
}

export async function findDuplicateCandidates(
  rows: Array<Record<string, string>>,
  mapping: Record<string, string>,
  options?: FindOptions
): Promise<DuplicateCandidate[]> {
  const threshold = options?.threshold ?? 0.75
  const maxPerRow = options?.max_per_row ?? 3

  const sb = createClient()

  // Cargar set chico de productos en memoria para hacer Levenshtein local.
  // Limitamos a 5000 — más que eso, este algoritmo no escala (Fase 3: trgm en DB).
  const { data: dbProductsRaw } = await sb
    .from('tt_products')
    .select('id, sku, name, ean, manufacturer_code')
    .limit(5000)
  const dbProducts: ProductLite[] = ((dbProductsRaw as ProductLite[] | null) ?? [])

  const skuIndex = new Map<string, ProductLite>()
  const eanIndex = new Map<string, ProductLite>()
  const mcIndex = new Map<string, ProductLite>()
  for (const p of dbProducts) {
    if (p.sku) skuIndex.set(p.sku.trim().toLowerCase(), p)
    if (p.ean) eanIndex.set(p.ean.trim().toLowerCase(), p)
    if (p.manufacturer_code) mcIndex.set(p.manufacturer_code.trim().toLowerCase(), p)
  }

  const out: DuplicateCandidate[] = []

  rows.forEach((row, rowIndex) => {
    const incomingSku = pick(row, mapping, 'sku')
    const incomingName = pick(row, mapping, 'name')
    const incomingEan = pick(row, mapping, 'ean')
    const incomingMc = pick(row, mapping, 'manufacturer_code')

    const matches: DuplicateMatch[] = []
    const seen = new Set<string>()
    const push = (m: DuplicateMatch) => {
      if (seen.has(m.product_id)) return
      seen.add(m.product_id)
      matches.push(m)
    }

    // 1) Match exacto por EAN
    if (incomingEan) {
      const hit = eanIndex.get(incomingEan.toLowerCase())
      if (hit) push({ product_id: hit.id, product_sku: hit.sku, product_name: hit.name, similarity: 1, reason: 'ean_match' })
    }

    // 2) Match exacto por manufacturer_code
    if (incomingMc) {
      const hit = mcIndex.get(incomingMc.toLowerCase())
      if (hit) push({ product_id: hit.id, product_sku: hit.sku, product_name: hit.name, similarity: 1, reason: 'manufacturer_code_match' })
    }

    // 3) SKU cercano por Levenshtein
    if (incomingSku) {
      const exactSku = skuIndex.get(incomingSku.toLowerCase())
      if (exactSku) {
        // El SKU es el upsert key; si ya hay match exacto NO lo reportamos como dup
        // (eso es upsert normal). Solo reportamos cercanos.
      } else {
        for (const p of dbProducts) {
          if (!p.sku) continue
          const sim = similarity(incomingSku, p.sku)
          if (sim >= threshold && sim < 1) {
            push({ product_id: p.id, product_sku: p.sku, product_name: p.name, similarity: sim, reason: 'sku_close' })
          }
          if (matches.length >= maxPerRow * 2) break
        }
      }
    }

    // 4) Nombre cercano
    if (incomingName && matches.length < maxPerRow) {
      for (const p of dbProducts) {
        if (!p.name) continue
        const sim = similarity(incomingName, p.name)
        if (sim >= threshold && sim < 1) {
          push({ product_id: p.id, product_sku: p.sku, product_name: p.name, similarity: sim, reason: 'name_close' })
        }
        if (matches.length >= maxPerRow * 2) break
      }
    }

    if (matches.length === 0) return
    matches.sort((a, b) => b.similarity - a.similarity)
    out.push({
      rowIndex,
      incoming: { sku: incomingSku, name: incomingName, ean: incomingEan, manufacturer_code: incomingMc },
      matches: matches.slice(0, maxPerRow),
    })
  })

  return out
}
