/**
 * Helper para gestionar `tt_import_jobs` (log persistente de imports + reversión).
 *
 * Estructura esperada de la tabla (creada por la migración v48):
 *   id              uuid primary key
 *   user_id         uuid
 *   target_table    text
 *   file_name       text
 *   mode            text          -- 'import' | 'revert'
 *   upsert_mode     boolean
 *   total_rows      int
 *   inserted        int
 *   updated         int
 *   skipped         int
 *   failed          int
 *   status          text          -- 'running' | 'completed' | 'failed' | 'reverted'
 *   row_log         jsonb         -- ImportJobRow[]
 *   created_at      timestamptz
 *   completed_at    timestamptz
 *   reverted_at     timestamptz
 *   reverted_by     uuid
 *   revert_job_id   uuid          -- referencia al job de reversión
 */

import { createClient } from '@/lib/supabase/client'

export interface ImportJobRow {
  row_index: number
  action: 'insert' | 'update' | 'skip' | 'fail'
  entity_id: string | null
  /** Snapshot ANTES del cambio (para rollback). null en inserts. */
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  error: string | null
}

export interface ImportJob {
  id: string
  user_id: string | null
  target_table: string
  file_name: string | null
  mode: 'import' | 'revert'
  upsert_mode: boolean
  total_rows: number
  inserted: number
  updated: number
  skipped: number
  failed: number
  status: 'running' | 'completed' | 'failed' | 'reverted'
  row_log: ImportJobRow[]
  created_at: string
  completed_at: string | null
  reverted_at: string | null
  reverted_by: string | null
  revert_job_id: string | null
}

export interface CreateImportJobArgs {
  target_table: string
  file_name?: string | null
  mode?: 'import' | 'revert'
  upsert_mode?: boolean
  total_rows?: number
}

/** Crea un nuevo job en estado `running` y devuelve su id. */
export async function createImportJob(args: CreateImportJobArgs): Promise<string | null> {
  const sb = createClient()
  const { data: userResult } = await sb.auth.getUser()
  const user = userResult.user

  const { data, error } = await sb
    .from('tt_import_jobs')
    .insert({
      user_id: user?.id ?? null,
      target_table: args.target_table,
      file_name: args.file_name ?? null,
      mode: args.mode ?? 'import',
      upsert_mode: args.upsert_mode ?? false,
      total_rows: args.total_rows ?? 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      status: 'running',
      row_log: [],
    })
    .select('id')
    .single()

  if (error || !data) {
    // Logueamos pero no hacemos throw — el import debe poder continuar sin job.
    console.warn('createImportJob falló (continúa sin log persistente):', error?.message)
    return null
  }
  return (data as { id: string }).id
}

/** Actualiza campos de un job. */
export async function updateImportJob(
  id: string,
  patch: Partial<Pick<ImportJob, 'inserted' | 'updated' | 'skipped' | 'failed' | 'status' | 'row_log' | 'completed_at'>>
): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('tt_import_jobs').update(patch).eq('id', id)
  if (error) console.warn('updateImportJob falló:', error.message)
}

/**
 * Revierte un import: por cada fila del row_log:
 *   - action='insert' → DELETE entity_id
 *   - action='update' → UPDATE entity_id SET (campos de `before`)
 *   - action='skip' / 'fail' → ignorar
 *
 * Marca el job original con status='reverted' y crea un job nuevo de modo 'revert'
 * con `revert_job_id` apuntando al original.
 */
export async function revertImportJob(jobId: string): Promise<{ reverted: number; failed: number }> {
  const sb = createClient()
  const { data: jobData, error: readErr } = await sb
    .from('tt_import_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (readErr || !jobData) {
    throw new Error(readErr?.message || 'Job no encontrado')
  }
  const job = jobData as ImportJob
  if (job.status === 'reverted') {
    throw new Error('Este job ya fue revertido.')
  }

  const revertJobId = await createImportJob({
    target_table: job.target_table,
    file_name: `revert-of-${job.id}`,
    mode: 'revert',
    upsert_mode: false,
    total_rows: job.row_log.length,
  })

  let reverted = 0
  let failed = 0
  const log: ImportJobRow[] = []

  for (const row of job.row_log || []) {
    if (!row.entity_id || (row.action !== 'insert' && row.action !== 'update')) {
      log.push({ ...row, error: 'Skipped (no aplicable a revert)' })
      continue
    }

    try {
      if (row.action === 'insert') {
        const { error: delErr } = await sb.from(job.target_table).delete().eq('id', row.entity_id)
        if (delErr) throw new Error(delErr.message)
        reverted++
        log.push({ row_index: row.row_index, action: 'insert', entity_id: row.entity_id, before: row.after, after: null, error: null })
      } else {
        // update — restauramos el `before`
        if (!row.before) throw new Error('No hay snapshot before para restaurar')
        const { error: upErr } = await sb.from(job.target_table).update(row.before).eq('id', row.entity_id)
        if (upErr) throw new Error(upErr.message)
        reverted++
        log.push({ row_index: row.row_index, action: 'update', entity_id: row.entity_id, before: row.after, after: row.before, error: null })
      }
    } catch (e) {
      failed++
      log.push({ ...row, error: (e as Error).message })
    }
  }

  // Actualizar el job de revert con resultados
  if (revertJobId) {
    await updateImportJob(revertJobId, {
      status: failed > 0 && reverted === 0 ? 'failed' : 'completed',
      inserted: 0,
      updated: reverted,
      skipped: 0,
      failed,
      row_log: log,
      completed_at: new Date().toISOString(),
    })
  }

  // Marcar el job original como revertido
  const { data: userResult } = await sb.auth.getUser()
  await sb.from('tt_import_jobs').update({
    status: 'reverted',
    reverted_at: new Date().toISOString(),
    reverted_by: userResult.user?.id ?? null,
    revert_job_id: revertJobId,
  }).eq('id', job.id)

  return { reverted, failed }
}

/** Lista los últimos N jobs del usuario actual. */
export async function listImportJobs(limit = 50): Promise<ImportJob[]> {
  const sb = createClient()
  const { data: userResult } = await sb.auth.getUser()
  const user = userResult.user
  if (!user) return []
  const { data, error } = await sb
    .from('tt_import_jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('listImportJobs falló:', error.message)
    return []
  }
  return (data || []) as ImportJob[]
}
