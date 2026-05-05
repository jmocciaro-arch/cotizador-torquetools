/**
 * Helper para gestionar `tt_import_templates` (plantillas de import guardables).
 *
 * Cada plantilla persiste: profile_id elegido + column_mapping + transforms +
 * options (modo, dry_run default, partial_fields, etc.). Se asocia al usuario
 * y opcionalmente se comparte con la empresa.
 */

import { createClient } from '@/lib/supabase/client'
import type { TransformStep } from './import-profiles/types'

export interface TemplateTransformBlock {
  column: string
  steps: TransformStep[]
}

export type ImportMode = 'insert' | 'update' | 'upsert' | 'sync' | 'partial'

export interface ImportTemplateOptions {
  mode: ImportMode
  key_column: string
  partial_fields?: string[]
  dry_run_default?: boolean
  sync_filter?: string
}

export interface ImportTemplate {
  id: string
  user_id: string | null
  company_id: string | null
  name: string
  description: string | null
  target_table: string
  profile_id: string | null
  column_mapping: Record<string, string>
  transforms: TemplateTransformBlock[]
  options: ImportTemplateOptions
  is_shared: boolean
  is_default: boolean
  use_count: number
  last_used_at: string | null
  created_at?: string
  updated_at?: string
}

export type CreateTemplateArgs = Omit<
  ImportTemplate,
  'id' | 'use_count' | 'last_used_at' | 'created_at' | 'updated_at' | 'user_id'
> & { company_id?: string | null }

export async function listTemplates(target_table: string): Promise<ImportTemplate[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('tt_import_templates')
    .select('*')
    .eq('target_table', target_table)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('use_count', { ascending: false })
  if (error) {
    console.warn('listTemplates falló:', error.message)
    return []
  }
  return (data || []) as ImportTemplate[]
}

export async function saveTemplate(t: CreateTemplateArgs): Promise<string | null> {
  const sb = createClient()
  const { data: userResult } = await sb.auth.getUser()
  const user = userResult.user
  if (!user) {
    console.warn('saveTemplate: usuario no autenticado')
    return null
  }
  const { data, error } = await sb
    .from('tt_import_templates')
    .insert({
      user_id: user.id,
      company_id: t.company_id ?? null,
      name: t.name,
      description: t.description,
      target_table: t.target_table,
      profile_id: t.profile_id,
      column_mapping: t.column_mapping,
      transforms: t.transforms,
      options: t.options,
      is_shared: t.is_shared,
      is_default: t.is_default,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.warn('saveTemplate falló:', error?.message)
    return null
  }
  return (data as { id: string }).id
}

export async function updateTemplate(
  id: string,
  patch: Partial<Omit<ImportTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('tt_import_templates').update(patch).eq('id', id)
  if (error) console.warn('updateTemplate falló:', error.message)
}

export async function deleteTemplate(id: string): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('tt_import_templates').delete().eq('id', id)
  if (error) console.warn('deleteTemplate falló:', error.message)
}

/** Incrementa use_count y refresca last_used_at. */
export async function bumpUsage(id: string): Promise<void> {
  const sb = createClient()
  // Leer el actual + escribir +1 (no hay RPC para increment atómico fácil acá).
  const { data, error } = await sb.from('tt_import_templates').select('use_count').eq('id', id).single()
  if (error || !data) return
  const cur = (data as { use_count: number }).use_count || 0
  await sb
    .from('tt_import_templates')
    .update({ use_count: cur + 1, last_used_at: new Date().toISOString() })
    .eq('id', id)
}
