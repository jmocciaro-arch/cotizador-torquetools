/**
 * Helpers para `tt_scheduled_exports` (v50) — exports programados con cron.
 */

import { createClient } from '@/lib/supabase/client'

export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'xml'
export type DeliveryType = 'email' | 'webhook' | 'storage'

export interface ScheduledExport {
  id: string
  company_id: string | null
  name: string
  target_table: string
  format: ExportFormat
  template_id: string | null
  filter: Record<string, unknown> | null
  schedule_cron: string
  delivery_type: DeliveryType
  delivery_config: Record<string, unknown>
  is_active: boolean
  last_run_at: string | null
  last_run_status: 'success' | 'failed' | 'running' | null
  last_run_error?: string | null
  next_run_at: string | null
  created_at?: string
}

export type SaveScheduledExportArgs = Partial<ScheduledExport> & {
  name: string
  target_table: string
  format: ExportFormat
  schedule_cron: string
  delivery_type: DeliveryType
  delivery_config: Record<string, unknown>
}

export async function listScheduledExports(): Promise<ScheduledExport[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('tt_scheduled_exports')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('listScheduledExports falló:', error.message)
    return []
  }
  return (data || []) as ScheduledExport[]
}

export async function saveScheduledExport(s: SaveScheduledExportArgs): Promise<string | null> {
  const sb = createClient()
  const payload = {
    company_id: s.company_id ?? null,
    name: s.name,
    target_table: s.target_table,
    format: s.format,
    template_id: s.template_id ?? null,
    filter: s.filter ?? {},
    schedule_cron: s.schedule_cron,
    delivery_type: s.delivery_type,
    delivery_config: s.delivery_config,
    is_active: s.is_active ?? true,
  }
  if (s.id) {
    const { error } = await sb.from('tt_scheduled_exports').update(payload).eq('id', s.id)
    if (error) {
      console.warn('saveScheduledExport update falló:', error.message)
      return null
    }
    return s.id
  }
  const { data, error } = await sb.from('tt_scheduled_exports').insert(payload).select('id').single()
  if (error || !data) {
    console.warn('saveScheduledExport insert falló:', error?.message)
    return null
  }
  return (data as { id: string }).id
}

export async function deleteScheduledExport(id: string): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('tt_scheduled_exports').delete().eq('id', id)
  if (error) console.warn('deleteScheduledExport falló:', error.message)
}

/** Dispara una corrida manual del export (server-side). */
export async function runExportNow(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/cron/scheduled-exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exportId: id }),
    })
    const j = await res.json()
    if (!res.ok) return { ok: false, error: j.error || 'Falló' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
