/**
 * Registro central de Import Profiles.
 *
 * Funciones públicas:
 *  - PROFILES: array de todos los profiles registrados.
 *  - getProfile(id): obtiene un profile por id.
 *  - detectProfile(headers, target): auto-detecta el profile que mejor matchea.
 *  - applyProfile(profile, target, row, ctx): aplica mapeo + transforms + postprocess.
 */

import type { ImportProfile, TargetTable, ApplyContext } from './types'
import { applyTransformsWithErrors } from './transforms'
import { expandDotNotation } from '@/lib/stelorder-mappings'

import stelorder from './profiles/stelorder'
import woocommerce from './profiles/woocommerce'
import odoo from './profiles/odoo'
import holded from './profiles/holded'
import factusol from './profiles/factusol'
import sage50 from './profiles/sage50'
import a3 from './profiles/a3'
import prestashop from './profiles/prestashop'
import shopify from './profiles/shopify'
import mercadolibre from './profiles/mercadolibre'
import amazon from './profiles/amazon'

export const PROFILES: ImportProfile[] = [
  stelorder,
  woocommerce,
  odoo,
  holded,
  factusol,
  sage50,
  a3,
  prestashop,
  shopify,
  mercadolibre,
  amazon,
]

export function getProfile(id: string): ImportProfile | null {
  return PROFILES.find(p => p.id === id) ?? null
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

export interface ProfileDetection {
  profile: ImportProfile
  matchCount: number
  confidence: number
  totalSignatureCols: number
}

/**
 * Recorre todos los profiles, calcula match_count contra signature_columns[target]
 * y devuelve el de mayor confianza si supera el threshold.
 */
export function detectProfile(
  headers: string[],
  target: TargetTable
): ProfileDetection | null {
  const normalizedHeaders = new Set(headers.map(normalize))
  let best: ProfileDetection | null = null

  for (const profile of PROFILES) {
    const sig = profile.signature_columns[target]
    if (!sig || sig.length === 0) continue
    const threshold = profile.signature_threshold ?? 2

    const matches = sig.filter(col => normalizedHeaders.has(normalize(col)))
    const matchCount = matches.length
    if (matchCount < threshold) continue

    const confidence = matchCount / sig.length
    if (!best || confidence > best.confidence || (confidence === best.confidence && matchCount > best.matchCount)) {
      best = { profile, matchCount, confidence, totalSignatureCols: sig.length }
    }
  }

  return best
}

export interface ApplyProfileResult {
  record: Record<string, unknown>
  errors: string[]
}

/**
 * Aplica el profile a una fila ya parseada del CSV (header → value).
 * 1. Para cada FieldMapping: toma el valor del header, aplica transforms.
 * 2. Acumula en un record plano (con dot-notation).
 * 3. Expande dot-notation a objetos anidados.
 * 4. Si hay postProcess[target], lo ejecuta sobre el record final.
 */
export function applyProfile(
  profile: ImportProfile,
  target: TargetTable,
  row: Record<string, string>,
  context?: ApplyContext
): ApplyProfileResult {
  const fields = profile.mappings[target]
  const errors: string[] = []
  const flat: Record<string, unknown> = {}

  if (!fields || fields.length === 0) {
    return { record: {}, errors: [`Profile ${profile.id} no tiene mapping para ${target}`] }
  }

  for (const fm of fields) {
    const raw = row[fm.source]
    if (raw === undefined || raw === null || raw === '') {
      if (fm.required) errors.push(`Campo requerido vacío: ${fm.source}`)
      continue
    }
    let value: unknown = raw
    if (fm.transforms && fm.transforms.length > 0) {
      const [out, errs] = applyTransformsWithErrors(value, fm.transforms, context)
      value = out
      for (const e of errs) errors.push(`${fm.source}→${fm.target}: ${e}`)
    }
    flat[fm.target] = value
  }

  let record = expandDotNotation(flat)
  const post = profile.postProcess?.[target]
  if (post) {
    try {
      record = post(record)
    } catch (e) {
      errors.push(`postProcess: ${(e as Error).message}`)
    }
  }
  return { record, errors }
}
