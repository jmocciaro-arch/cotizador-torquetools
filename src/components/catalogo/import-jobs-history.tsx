'use client'

/**
 * Modal de historial de imports.
 * Lista los últimos 50 jobs del usuario con detalle expandible y botón de reversión.
 */

import { useEffect, useState, useCallback } from 'react'
import { History, RotateCcw, Eye, X, Loader2, CheckCircle, AlertTriangle, XCircle, Undo2 } from 'lucide-react'
import {
  listImportJobs,
  revertImportJob,
  type ImportJob,
  type ImportJobRow,
} from '@/lib/import-jobs'
import { useToast } from '@/components/ui/toast'

interface Props {
  /** Si solo querés mostrar jobs de una tabla específica. Si null, todas. */
  targetTable?: string | null
}

export function ImportJobsHistory({ targetTable = null }: Props) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [detailJob, setDetailJob] = useState<ImportJob | null>(null)
  const [reverting, setReverting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listImportJobs(50)
    setJobs(targetTable ? data.filter(j => j.target_table === targetTable) : data)
    setLoading(false)
  }, [targetTable])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const handleRevert = async (job: ImportJob) => {
    if (!confirm(`¿Revertir esta importación? Se intentarán deshacer ${job.row_log?.length || 0} cambios.`)) return
    setReverting(job.id)
    try {
      const res = await revertImportJob(job.id)
      addToast({
        type: res.failed > 0 ? 'warning' : 'success',
        title: `Reversión: ${res.reverted} ok${res.failed > 0 ? `, ${res.failed} fallaron` : ''}`,
      })
      void load()
    } catch (e) {
      addToast({ type: 'error', title: 'Error revirtiendo', message: (e as Error).message })
    } finally {
      setReverting(null)
    }
  }

  const statusBadge = (s: ImportJob['status']) => {
    switch (s) {
      case 'running':   return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400">CORRIENDO</span>
      case 'completed': return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400">OK</span>
      case 'failed':    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400">FALLÓ</span>
      case 'reverted':  return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400">REVERTIDO</span>
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#9CA3AF] bg-[#141820] border border-[#2A3040] rounded-lg hover:bg-[#1C2230] hover:text-[#FF6600] transition-all"
      >
        <History size={16} />
        Historial de imports
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!reverting) setOpen(false) }} />
          <div className="relative w-full mx-4 max-w-5xl bg-[#141820] border border-[#1E2330] rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2330]">
              <div className="flex items-center gap-2">
                <History size={18} className="text-[#FF6600]" />
                <h2 className="text-lg font-semibold text-[#F0F2F5]">Historial de importaciones</h2>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-[#1E2330] text-[#6B7280] hover:text-[#F0F2F5]">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-[#FF6600]" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12 text-sm text-[#6B7280]">
                  No hay importaciones registradas todavía.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[#0A0D12] sticky top-0">
                    <tr className="text-left">
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Fecha</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Archivo</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Tabla</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Modo</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-right">Insert</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-right">Update</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-right">Fail</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Estado</th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280] text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2330]">
                    {jobs.map(job => (
                      <tr key={job.id} className="hover:bg-[#1A1F2E]">
                        <td className="px-4 py-2 text-xs text-[#9CA3AF] whitespace-nowrap">
                          {new Date(job.created_at).toLocaleString('es-AR')}
                        </td>
                        <td className="px-4 py-2 text-xs text-[#F0F2F5] truncate max-w-[200px]">{job.file_name || '—'}</td>
                        <td className="px-4 py-2 text-xs font-mono text-[#6B7280]">{job.target_table}</td>
                        <td className="px-4 py-2 text-xs text-[#9CA3AF]">
                          {job.mode === 'revert' ? 'reversión' : (job.upsert_mode ? 'upsert' : 'insert')}
                        </td>
                        <td className="px-4 py-2 text-xs text-emerald-400 text-right">{job.inserted}</td>
                        <td className="px-4 py-2 text-xs text-blue-400 text-right">{job.updated}</td>
                        <td className="px-4 py-2 text-xs text-red-400 text-right">{job.failed}</td>
                        <td className="px-4 py-2">{statusBadge(job.status)}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              onClick={() => setDetailJob(job)}
                              className="p-1.5 rounded hover:bg-[#1E2330] text-[#9CA3AF] hover:text-[#FF6600]"
                              title="Ver detalle"
                            >
                              <Eye size={13} />
                            </button>
                            {job.mode === 'import' && job.status === 'completed' && (
                              <button
                                onClick={() => handleRevert(job)}
                                disabled={reverting === job.id}
                                className="p-1.5 rounded hover:bg-amber-500/10 text-amber-400 disabled:opacity-50"
                                title="Revertir esta importación"
                              >
                                {reverting === job.id ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Detail modal */}
          {detailJob && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setDetailJob(null)}>
              <div onClick={e => e.stopPropagation()} className="w-[min(92vw,900px)] max-h-[85vh] rounded-xl bg-[#0F1218] border border-[#1E2330] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E2330]">
                  <strong className="text-sm text-[#F0F2F5]">Detalle del job — {detailJob.id.slice(0, 8)}</strong>
                  <button onClick={() => setDetailJob(null)} className="text-[#6B7280] hover:text-[#F0F2F5]">
                    <X size={16} />
                  </button>
                </div>
                <div className="overflow-y-auto p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#0A0D12]">
                        <th className="px-2 py-1.5 text-left text-[#6B7280]">#</th>
                        <th className="px-2 py-1.5 text-left text-[#6B7280]">Acción</th>
                        <th className="px-2 py-1.5 text-left text-[#6B7280]">Entity ID</th>
                        <th className="px-2 py-1.5 text-left text-[#6B7280]">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailJob.row_log || []).slice(0, 500).map((r: ImportJobRow, i) => (
                        <tr key={i} className="border-t border-[#1E2330]">
                          <td className="px-2 py-1 text-[#6B7280]">{r.row_index}</td>
                          <td className="px-2 py-1">
                            {r.action === 'insert' && <CheckCircle size={11} className="inline text-emerald-400" />}
                            {r.action === 'update' && <RotateCcw size={11} className="inline text-blue-400" />}
                            {r.action === 'skip'   && <AlertTriangle size={11} className="inline text-amber-400" />}
                            {r.action === 'fail'   && <XCircle size={11} className="inline text-red-400" />}
                            <span className="ml-1 text-[#F0F2F5]">{r.action}</span>
                          </td>
                          <td className="px-2 py-1 font-mono text-[#9CA3AF] truncate max-w-[160px]">{r.entity_id || '—'}</td>
                          <td className="px-2 py-1 text-red-400 truncate max-w-[300px]">{r.error || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(detailJob.row_log?.length || 0) > 500 && (
                    <p className="text-center text-[10px] text-[#6B7280] mt-2">
                      Mostrando las primeras 500 filas de {detailJob.row_log.length}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
