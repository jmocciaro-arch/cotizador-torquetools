/**
 * Helpers para `tt_product_lots` (v50) — trazabilidad por lote.
 * Defensivo: warning + return [] / null si la tabla no existe.
 */

import { createClient } from '@/lib/supabase/client'

export interface ProductLot {
  id: string
  product_id: string
  variant_id: string | null
  warehouse_id: string | null
  supplier_id: string | null
  lot_number: string
  manufacture_date: string | null
  expiry_date: string | null
  received_date: string | null
  qty_in: number
  qty_remaining: number
  cost_per_unit: number | null
  status: 'activo' | 'agotado' | 'vencido' | 'bloqueado'
  notes?: string | null
  created_at?: string
}

export type SaveLotArgs = Partial<ProductLot> & {
  product_id: string
  lot_number: string
  qty_in: number
}

export async function listLots(productId: string): Promise<ProductLot[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('tt_product_lots')
    .select('*')
    .eq('product_id', productId)
    .order('received_date', { ascending: false, nullsFirst: false })
  if (error) {
    console.warn('listLots falló:', error.message)
    return []
  }
  return (data || []) as ProductLot[]
}

export async function saveLot(lot: SaveLotArgs): Promise<string | null> {
  const sb = createClient()
  const payload = {
    product_id: lot.product_id,
    variant_id: lot.variant_id ?? null,
    warehouse_id: lot.warehouse_id ?? null,
    supplier_id: lot.supplier_id ?? null,
    lot_number: lot.lot_number.trim(),
    manufacture_date: lot.manufacture_date ?? null,
    expiry_date: lot.expiry_date ?? null,
    received_date: lot.received_date ?? new Date().toISOString().slice(0, 10),
    qty_in: lot.qty_in,
    qty_remaining: lot.qty_remaining ?? lot.qty_in,
    cost_per_unit: lot.cost_per_unit ?? null,
    status: lot.status ?? 'activo',
    notes: lot.notes ?? null,
  }

  if (lot.id) {
    const { error } = await sb.from('tt_product_lots').update(payload).eq('id', lot.id)
    if (error) {
      console.warn('saveLot update falló:', error.message)
      return null
    }
    return lot.id
  }
  const { data, error } = await sb.from('tt_product_lots').insert(payload).select('id').single()
  if (error || !data) {
    console.warn('saveLot insert falló:', error?.message)
    return null
  }
  return (data as { id: string }).id
}

export async function deleteLot(id: string): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('tt_product_lots').delete().eq('id', id)
  if (error) console.warn('deleteLot falló:', error.message)
}

/** Resta qty al qty_remaining del lote (para consumos de stock por lote). */
export async function consumeFromLot(lotId: string, qty: number): Promise<void> {
  const sb = createClient()
  const { data, error } = await sb.from('tt_product_lots').select('qty_remaining').eq('id', lotId).single()
  if (error || !data) {
    console.warn('consumeFromLot lookup falló:', error?.message)
    return
  }
  const current = (data as { qty_remaining: number }).qty_remaining
  const next = Math.max(0, current - qty)
  const { error: upErr } = await sb
    .from('tt_product_lots')
    .update({ qty_remaining: next, status: next === 0 ? 'agotado' : 'activo' })
    .eq('id', lotId)
  if (upErr) console.warn('consumeFromLot update falló:', upErr.message)
}

export interface ExpiringLot {
  lot_id: string
  product_id: string
  product_sku: string
  product_name: string
  lot_number: string
  expiry_date: string
  days_until_expiry: number
  qty_remaining: number
}

export async function listExpiringSoon(daysAhead: number = 30): Promise<ExpiringLot[]> {
  const sb = createClient()
  const { data, error } = await sb.rpc('list_lots_expiring_soon', { p_days_ahead: daysAhead })
  if (error) {
    console.warn('listExpiringSoon falló:', error.message)
    return []
  }
  return (data || []) as ExpiringLot[]
}
