/**
 * Engine puro de transformaciones por columna.
 *
 * Pipelines: ordered list de TransformStep que se aplican secuencialmente al
 * valor de una celda. Si una step falla, se captura el error y se devuelve el
 * valor previo — el pipeline NO se interrumpe. Los errores quedan en la lista
 * que devuelve `applyTransformsWithErrors`.
 */

import type { TransformStep, ApplyContext } from './types'

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return typeof v === 'string' ? v : String(v)
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function applyStep(value: unknown, step: TransformStep, ctx?: ApplyContext): unknown {
  switch (step.op) {
    case 'trim':
      return toStr(value).trim()

    case 'upper':
      return toStr(value).toUpperCase()

    case 'lower':
      return toStr(value).toLowerCase()

    case 'slugify':
      return slugify(toStr(value))

    case 'regex_replace': {
      if (!step.pattern) return value
      const re = new RegExp(step.pattern, step.flags || '')
      return toStr(value).replace(re, step.replacement ?? '')
    }

    case 'replace': {
      if (step.find == null) return value
      // String.replaceAll necesita lib es2021; usamos split+join para compat.
      return toStr(value).split(step.find).join(step.replace ?? '')
    }

    case 'multiply': {
      const n = toNumber(value)
      const m = toNumber(step.value)
      if (n === null || m === null) return value
      return n * m
    }

    case 'divide': {
      const n = toNumber(value)
      const d = toNumber(step.value)
      if (n === null || d === null || d === 0) return value
      return n / d
    }

    case 'add': {
      const n = toNumber(value)
      const a = toNumber(step.value)
      if (n === null || a === null) return value
      return n + a
    }

    case 'subtract': {
      const n = toNumber(value)
      const s = toNumber(step.value)
      if (n === null || s === null) return value
      return n - s
    }

    case 'add_pct': {
      const n = toNumber(value)
      const p = toNumber(step.value)
      if (n === null || p === null) return value
      return n * (1 + p / 100)
    }

    case 'round': {
      const n = toNumber(value)
      const d = toNumber(step.value) ?? 0
      if (n === null) return value
      const f = Math.pow(10, d)
      return Math.round(n * f) / f
    }

    case 'prefix':
      return `${toStr(step.value ?? '')}${toStr(value)}`

    case 'suffix':
      return `${toStr(value)}${toStr(step.value ?? '')}`

    case 'concat':
      return `${toStr(value)}${toStr(step.value ?? '')}`

    case 'split': {
      const sep = step.separator ?? ','
      const idx = step.index ?? 0
      const parts = toStr(value).split(sep)
      return parts[idx] ?? ''
    }

    case 'fx_convert': {
      const n = toNumber(value)
      if (n === null) return value
      const rates = ctx?.exchangeRates
      if (!rates || !step.from || !step.to) {
        // Sin contexto, dejamos el valor original. Caller ve esto como warning.
        throw new Error(`fx_convert: faltan rates o from/to (${step.from}->${step.to})`)
      }
      const fromRate = rates[step.from]
      const toRate = rates[step.to]
      if (!fromRate || !toRate) {
        throw new Error(`fx_convert: tasa no encontrada (${step.from}=${fromRate}, ${step.to}=${toRate})`)
      }
      // Asumimos rates expresadas vs misma base (ej. EUR=1, USD=1.08, ARS=1100).
      // Convertir: from_amount * (toRate / fromRate)
      return (n * toRate) / fromRate
    }

    case 'truthy_to': {
      const s = toStr(value).trim().toLowerCase()
      const truthy = ['true', '1', 'si', 'sí', 'yes', 'y', 'verdadero', 'v', 'on']
      if (truthy.includes(s)) return step.true_val ?? true
      return step.false_val ?? false
    }

    case 'empty_to': {
      const s = toStr(value).trim()
      if (s === '') return step.value ?? ''
      return value
    }

    default:
      return value
  }
}

export function applyTransforms(
  value: unknown,
  steps: TransformStep[],
  context?: ApplyContext
): unknown {
  const [out] = applyTransformsWithErrors(value, steps, context)
  return out
}

export function applyTransformsWithErrors(
  value: unknown,
  steps: TransformStep[],
  context?: ApplyContext
): [unknown, string[]] {
  const errors: string[] = []
  let cur = value
  for (const step of steps) {
    try {
      cur = applyStep(cur, step, context)
    } catch (e) {
      errors.push(`${step.op}: ${(e as Error).message}`)
      // Mantener `cur` previo — no romper pipeline.
    }
  }
  return [cur, errors]
}
