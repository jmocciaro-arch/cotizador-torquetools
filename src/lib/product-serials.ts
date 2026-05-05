/**
 * Helpers para `tt_product_serials` (v50) — trazabilidad por número de serie.
 */

import { createClient } from '@/lib/supabase/client'

export type SerialStatus =
  | 'en_stock'
  | 'reservado'
  | 'vendido'
  | 'en_servicio'
  | 'en_calibracion'
  | 'baja'
  | 'garantia'

export interface ProductSerial {
  id: string
  product_id: string
  variant_id: string | null
  lot_id: string | null
  warehouse_id: string | null
  serial_number: string
  status: SerialStatus
  current_owner_type: 'cliente' | 'proveedor' | 'interno' | null
  current_owner_id: string | null
  next_calibration_date: string | null
  last_calibration_date: string | null
  warranty_until: string | null
  notes?: string | null
  created_at?: string
}

export interface ListSerialsOptions {
  status?: SerialStatus
  search?: string
  limit?: number
}

export async function listSerials(
  productId: string,
  options: ListSerialsOptions = {}
): Promise<ProductSerial[]> {
  const sb = createClient()
  let q = sb.from('tt_product_serials').select('*').eq('product_id', productId)
  if (options.status) q = q.eq('status', options.status)
  if (options.search?.trim()) q = q.ilike('serial_number', `%${options.search.trim()}%`)
  q = q.order('created_at', { ascending: false }).limit(options.limit ?? 500)

  const { data, error } = await q
  if (error) {
    console.warn('listSerials falló:', error.message)
    return []
  }
  return (data || []) as ProductSerial[]
}

export type SaveSerialArgs = Partial<ProductSerial> & {
  product_id: string
  serial_number: string
}

export async function saveSerial(s: SaveSerialArgs): Promise<string | null> {
  const sb = createClient()
  const payload = {
    product_id: s.product_id,
    variant_id: s.variant_id ?? null,
    lot_id: s.lot_id ?? null,
    warehouse_id: s.warehouse_id ?? null,
    serial_number: s.serial_number.trim(),
    status: s.status ?? 'en_stock',
    current_owner_type: s.current_owner_type ?? null,
    current_owner_id: s.current_owner_id ?? null,
    next_calibration_date: s.next_calibration_date ?? null,
    last_calibration_date: s.last_calibration_date ?? null,
    warranty_until: s.warranty_until ?? null,
    notes: s.notes ?? null,
  }
  if (s.id) {
    const { error } = await sb.from('tt_product_serials').update(payload).eq('id', s.id)
    if (error) {
      console.warn('saveSerial update falló:', error.message)
      return null
    }
    return s.id
  }
  const { data, error } = await sb.from('tt_product_serials').insert(payload).select('id').single()
  if (error || !data) {
    console.warn('saveSerial insert falló:', error?.message)
    return null
  }
  return (data as { id: string }).id
}

export async function deleteSerial(id: string): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('tt_product_serials').delete().eq('id', id)
  if (error) console.warn('deleteSerial falló:', error.message)
}

export async function changeStatus(
  serialId: string,
  status: SerialStatus,
  owner?: { type: 'cliente' | 'proveedor' | 'interno'; id: string | null }
): Promise<void> {
  const sb = createClient()
  const patch: Record<string, unknown> = { status }
  if (owner) {
    patch.current_owner_type = owner.type
    patch.current_owner_id = owner.id
  }
  const { error } = await sb.from('tt_product_serials').update(patch).eq('id', serialId)
  if (error) console.warn('changeStatus falló:', error.message)
}

/** Bulk import: array de serial_number → crea N registros en estado en_stock. */
export async function bulkCreateSerials(
  productId: string,
  serials: string[],
  base?: Partial<ProductSerial>
): Promise<{ created: number; skipped: number }> {
  const sb = createClient()
  const clean = Array.from(new Set(serials.map(s => s.trim()).filter(Boolean)))
  if (clean.length === 0) return { created: 0, skipped: 0 }

  // Filtrar los que ya existen
  const { data: existing } = await sb
    .from('tt_product_serials')
    .select('serial_number')
    .eq('product_id', productId)
    .in('serial_number', clean)
  const existingSet = new Set(((existing || []) as { serial_number: string }[]).map(r => r.serial_number))

  const toInsert = clean
    .filter(sn => !existingSet.has(sn))
    .map(sn => ({
      product_id: productId,
      variant_id: base?.variant_id ?? null,
      lot_id: base?.lot_id ?? null,
      warehouse_id: base?.warehouse_id ?? null,
      serial_number: sn,
      status: base?.status ?? 'en_stock',
      next_calibration_date: base?.next_calibration_date ?? null,
      warranty_until: base?.warranty_until ?? null,
    }))

  if (toInsert.length === 0) return { created: 0, skipped: clean.length }

  const { error } = await sb.from('tt_product_serials').insert(toInsert)
  if (error) {
    console.warn('bulkCreateSerials falló:', error.message)
    return { created: 0, skipped: clean.length }
  }
  return { created: toInsert.length, skipped: clean.length - toInsert.length }
}

export interface CalibrationDueSerial {
  serial_id: string
  product_id: string
  product_sku: string
  product_name: string
  serial_number: string
  next_calibration_date: string
  days_until: number
  current_owner_type: string | null
  current_owner_id: string | null
}

export async function listCalibrationDue(daysAhead: number = 30): Promise<CalibrationDueSerial[]> {
  const sb = createClient()
  const { data, error } = await sb.rpc('list_serials_calibration_due', { p_days_ahead: daysAhead })
  if (error) {
    console.warn('listCalibrationDue falló:', error.message)
    return []
  }
  return (data || []) as CalibrationDueSerial[]
}
