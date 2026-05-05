'use client'

/**
 * Modal de gestión de plantillas de import (Fase 2).
 * Lista las plantillas del usuario para una tabla destino, con acciones:
 * editar (toggles), eliminar (doble-click), compartir/privada.
 */

import { useEffect, useState, useCallback } from 'react'
import { FileSpreadsheet, X, Loader2, Trash2, Star, Users, Lock, RefreshCw, Plus, Tag } from 'lucide-react'
import {
  listTemplates,
  updateTemplate,
  deleteTemplate,
  type ImportTemplate,
} from '@/lib/import-templates'
import { useToast } from '@/components/ui/toast'

interface Props {
  /** Tabla destino. Default = tt_products. */
  targetTable?: string
  /** Etiqueta del botón. */
  label?: string
}

export function ImportTemplatesManager({ targetTable = 'tt_products', label = 'Plantillas' }: Props) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<ImportTemplate[]>([])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await listTemplates(targetTable)
    setTemplates(data)
    setLoading(false)
  }, [targetTable])

  useEffect(() => {
    if (!open) return
    let active = true
    void (async () => {
      const data = await listTemplates(targetTable)
      if (active) {
        setTemplates(data)
        setLoading(false)
      }
    })()
    return () => { active = false }
  }, [open, targetTable])

  const handleToggleShared = async (t: ImportTemplate) => {
    await updateTemplate(t.id, { is_shared: !t.is_shared })
    addToast({ type: 'success', title: t.is_shared ? 'Ahora es privada' : 'Compartida con la empresa' })
    void load()
  }

  const handleToggleDefault = async (t: ImportTemplate) => {
    await updateTemplate(t.id, { is_default: !t.is_default })
    void load()
  }

  const handleDelete = async (t: ImportTemplate) => {
    if (confirmDelete !== t.id) {
      setConfirmDelete(t.id)
      // Auto-reset del confirm visual a los 4s
      setTimeout(() => setConfirmDelete(prev => prev === t.id ? null : prev), 4000)
      return
    }
    await deleteTemplate(t.id)
    addToast({ type: 'success', title: `Plantilla "${t.name}" eliminada` })
    setConfirmDelete(null)
    void load()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#141820] border border-[#2A3040] text-[#9CA3AF] hover:bg-[#1C2230] hover:text-[#FF6600]"
        title="Plantillas guardadas"
      >
        <FileSpreadsheet size={14} />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-[min(95vw,920px)] bg-[#141820] border border-[#1E2330] rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2330]">
              <div>
                <h2 className="text-lg font-semibold text-[#F0F2F5] flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-[#FF6600]" />
                  Plantillas de import
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">Plantillas guardadas para <span className="font-mono">{targetTable}</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void load()} className="p-2 rounded-lg hover:bg-[#1E2330] text-[#9CA3AF] hover:text-[#FF6600]" title="Recargar">
                  <RefreshCw size={14} />
                </button>
                <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-[#1E2330] text-[#6B7280] hover:text-[#F0F2F5]">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-[#FF6600]" />
                </div>
              )}

              {!loading && templates.length === 0 && (
                <div className="text-center py-12 text-[#6B7280]">
                  <FileSpreadsheet size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Aún no hay plantillas guardadas para esta tabla.</p>
                  <p className="text-xs mt-2">
                    Importá un archivo y usá <strong className="text-[#FF6600]">Guardar como plantilla</strong> para crear una.
                  </p>
                </div>
              )}

              {!loading && templates.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-[#1E2330]">
                  <table className="w-full text-xs">
                    <thead className="bg-[#1C2230]">
                      <tr>
                        <th className="px-3 py-2 text-left text-[#6B7280] font-medium">Nombre</th>
                        <th className="px-3 py-2 text-left text-[#6B7280] font-medium">Descripción</th>
                        <th className="px-3 py-2 text-left text-[#6B7280] font-medium">Profile</th>
                        <th className="px-3 py-2 text-left text-[#6B7280] font-medium">Modo</th>
                        <th className="px-3 py-2 text-center text-[#6B7280] font-medium">Usos</th>
                        <th className="px-3 py-2 text-left text-[#6B7280] font-medium">Último uso</th>
                        <th className="px-3 py-2 text-center text-[#6B7280] font-medium">Acceso</th>
                        <th className="px-3 py-2 text-center text-[#6B7280] font-medium">Default</th>
                        <th className="px-3 py-2 text-right text-[#6B7280] font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map(t => (
                        <tr key={t.id} className="border-t border-[#1E2330] hover:bg-[#1C2230]/40">
                          <td className="px-3 py-2 text-[#F0F2F5] font-medium">{t.name}</td>
                          <td className="px-3 py-2 text-[#9CA3AF] truncate max-w-[200px]" title={t.description || ''}>{t.description || '—'}</td>
                          <td className="px-3 py-2 text-[#9CA3AF]">
                            {t.profile_id ? <span className="px-2 py-0.5 rounded bg-[#1C2230] text-[10px]">{t.profile_id}</span> : <span className="text-[#4B5563]">custom</span>}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1C2230] text-[10px] text-[#9CA3AF]">
                              <Tag size={9} />{t.options?.mode || 'upsert'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-[#FF6600] font-bold">{t.use_count}</td>
                          <td className="px-3 py-2 text-[#6B7280]">{t.last_used_at ? new Date(t.last_used_at).toLocaleString('es-AR') : '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => void handleToggleShared(t)} title={t.is_shared ? 'Compartida — clic para hacerla privada' : 'Privada — clic para compartir'}>
                              {t.is_shared ? <Users size={14} className="text-emerald-400" /> : <Lock size={14} className="text-[#6B7280]" />}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => void handleToggleDefault(t)}>
                              <Star size={14} className={t.is_default ? 'text-amber-400 fill-amber-400' : 'text-[#4B5563]'} />
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => void handleDelete(t)}
                              className={`p-1.5 rounded ${confirmDelete === t.id ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'text-[#6B7280] hover:text-red-400 hover:bg-red-500/10'}`}
                              title={confirmDelete === t.id ? 'Hacé clic de nuevo para confirmar' : 'Eliminar'}
                            >
                              <Trash2 size={12} />
                              {confirmDelete === t.id && <span className="ml-1 text-[10px] font-bold">¿Seguro?</span>}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t border-[#1E2330] px-6 py-3 bg-[#0F1318] flex items-center justify-between">
              <p className="text-[10px] text-[#6B7280]">
                Las plantillas se aplican desde el <strong>botón Importar</strong> &rarr; selector &laquo;Cargar plantilla&raquo;.
              </p>
              <p className="text-[10px] text-[#6B7280] flex items-center gap-2">
                <Plus size={11} /> Para crear una nueva, importá un archivo y usá &laquo;Guardar como plantilla&raquo;.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
