/**
 * Tipos centrales del sistema de Import Profiles (Fase 2).
 *
 * Cada profile representa el formato de export de un ERP/eCommerce conocido
 * (StelOrder, Odoo, Shopify, etc.) y mapea sus headers a campos internos
 * de Mocciaro Soft con transformaciones opcionales.
 */

export type TargetTable = 'tt_products' | 'tt_clients' | 'tt_suppliers'

export type TransformOp =
  | 'trim'
  | 'upper'
  | 'lower'
  | 'slugify'
  | 'regex_replace'
  | 'replace'
  | 'multiply'
  | 'divide'
  | 'add'
  | 'subtract'
  | 'add_pct'
  | 'round'
  | 'prefix'
  | 'suffix'
  | 'concat'
  | 'split'
  | 'fx_convert'
  | 'truthy_to'
  | 'empty_to'

export interface TransformStep {
  op: TransformOp
  value?: string | number
  // regex_replace
  pattern?: string
  replacement?: string
  flags?: string
  // split
  separator?: string
  index?: number
  // fx_convert
  from?: string
  to?: string
  // replace literal
  find?: string
  replace?: string
  // truthy_to
  true_val?: string | number
  false_val?: string | number
}

export type ValidatorKind =
  | 'number'
  | 'integer'
  | 'date'
  | 'boolean'
  | 'email'
  | 'url'
  | 'ean13'

export interface FieldMapping {
  source: string                    // Header tal cual aparece en el CSV
  target: string                    // Campo destino en DB (puede ser dot-notation: specs.foo)
  transforms?: TransformStep[]      // Transformaciones específicas para esta columna
  required?: boolean
  validate?: ValidatorKind
}

export type PostProcessFn = (record: Record<string, unknown>) => Record<string, unknown>

export interface ImportProfile {
  id: string                        // 'stelorder', 'odoo', 'holded', 'shopify', etc.
  label: string                     // "StelOrder" — visible al usuario
  description: string
  origin: 'erp' | 'ecommerce' | 'accounting' | 'marketplace' | 'generic'
  logo?: string                     // emoji o iniciales

  /** Si el CSV tiene >= signature_threshold de estas columnas (por target), sugerir este profile. */
  signature_columns: Partial<Record<TargetTable, string[]>>
  signature_threshold?: number      // default 2

  /** Mapeos por tabla destino. */
  mappings: Partial<Record<TargetTable, FieldMapping[]>>

  /** Post-procesado por fila (opcional). Recibe el record post-mapeo y lo modifica. */
  postProcess?: Partial<Record<TargetTable, PostProcessFn>>

  /** Upsert key por tabla. */
  upsertKeys?: Partial<Record<TargetTable, string>>
}

export interface ApplyContext {
  exchangeRates?: Record<string, number>
}
