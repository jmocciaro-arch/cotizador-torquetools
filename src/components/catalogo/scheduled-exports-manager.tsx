'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Save, Trash2, Play, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  listScheduledExports,
  saveScheduledExport,
  deleteScheduledExport,
  runExportNow,
  type ScheduledExport,
  type ExportFormat,
  type DeliveryType,
} from '@/lib/scheduled-exports'

const TARGET_TABLES = [
  { value: 'tt_products', label: 'Productos' },
  { value: 'tt_clients', label: 'Clientes' },
  { value: 'tt_quotes', label: 'Cotizaciones' },
  { value: 'tt_invoices', label: 'Facturas' },
  { value: 'tt_purchase_orders', label: 'Órdenes de compra' },
]

const CRON_PRESETS = [
  { value: '0 6 * * *', label: 'Cada día a las 06:00' },
  { value: '0 6 * * 1', label: 'Cada lunes a las 06:00' },
  { value: '0 0 1 * *', label: 'El día 1 de cada mes' },
  { value: '0 */6 * * *', label: 'Cada 6 horas' },
]

export function ScheduledExportsManager() {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ScheduledExport[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Partial<ScheduledExport> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await listScheduledExports()
    setItems(list)
    setLoading(false)
  }, [])

  useEffect(() => { if (open) reload() }, [open, reload])

  const handleSave = useCallback(async () => {
    if (!editing?.name?.trim() || !editing.target_table || !editing.format || !editing.schedule_cron || !editing.delivery_type) {
      addToast({ type: 'warning', title: 'Completá todos los campos requeridos' })
      return
    }
    const id = await saveScheduledExport({
      ...(editing as Parameters<typeof saveScheduledExport>[0]),
      delivery_config: editing.delivery_config || {},
    })
    if (id) {
      addToast({ type: 'success', title: 'Export programado guardado' })
      setEditing(null)
      reload()
    } else {
      addToast({ type: 'error', title: 'No se pudo guardar' })
    }
  }, [editing, addToast, reload])

  const handleDelete = useCallback(async (id: string) => {
    await deleteScheduledExport(id)
    setConfirmDelete(null)
    reload()
  }, [reload])

  const handleRunNow = useCallback(async (id: string) => {
    addToast({ type: 'info', title: 'Ejecutando export...' })
    const r = await runExportNow(id)
    if (r.ok) {
      addToast({ type: 'success', title: 'Export ejecutado' })
      reload()
    } else {
      addToast({ type: 'error', title: 'Falló', message: r.error })
    }
  }, [addToast, reload])

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Clock size={14} /> Exports programados
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Exports programados" size="full">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#9CA3AF]">Programá envíos automáticos por email, webhook o storage.</p>
            <Button size="sm" variant="primary" onClick={() => setEditing({
              name: '', target_table: 'tt_products', format: 'csv',
              schedule_cron: '0 6 * * *', delivery_type: 'email', delivery_config: {}, is_active: true, filter: {},
            })}>
              <Plus size={14} /> Nuevo
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-[#9CA3AF] py-8 text-center">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1E2330] p-8 text-center text-sm text-[#6B7280]">
              No hay exports programados.
            </div>
          ) : (
            <div className="rounded-xl border border-[#1E2330] bg-[#0F1218] overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0A0D12] text-[#6B7280] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left">Tabla</th>
                    <th className="px-3 py-2 text-left">Formato</th>
                    <th className="px-3 py-2 text-left">Cron</th>
                    <th className="px-3 py-2 text-left">Delivery</th>
                    <th className="px-3 py-2 text-left">Próx. corrida</th>
                    <th className="px-3 py-2 text-left">Última</th>
                    <th className="px-3 py-2 w-48"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(e => (
                    <tr key={e.id} className="border-t border-[#1E2330] hover:bg-[#1A1F2E]">
                      <td className="px-3 py-2 font-medium text-[#F0F2F5]">{e.name}</td>
                      <td className="px-3 py-2 text-[#9CA3AF]">{e.target_table}</td>
                      <td className="px-3 py-2 text-[#9CA3AF]">{e.format.toUpperCase()}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-[#9CA3AF]">{e.schedule_cron}</td>
                      <td className="px-3 py-2 text-[#9CA3AF]">{e.delivery_type}</td>
                      <td className="px-3 py-2 text-[#9CA3AF]">{e.next_run_at ? new Date(e.next_run_at).toLocaleString('es-AR') : '—'}</td>
                      <td className="px-3 py-2">
                        {e.last_run_status ? <Badge variant={e.last_run_status === 'success' ? 'success' : e.last_run_status === 'failed' ? 'danger' : 'info'} size="sm">{e.last_run_status}</Badge> : '—'}
                      </td>
                      <td className="px-3 py-2 text-right space-x-1">
                        <button onClick={() => handleRunNow(e.id)} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-[#FF6600]/10 text-[#FF6600] hover:bg-[#FF6600]/20">
                          <Play size={10} /> Correr
                        </button>
                        <button onClick={() => setEditing(e)} className="text-[#FF6600] hover:underline text-xs ml-1">Editar</button>
                        {confirmDelete === e.id ? (
                          <button onClick={() => handleDelete(e.id)} className="ml-2 text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">Confirmá</button>
                        ) : (
                          <button onClick={() => setConfirmDelete(e.id)} className="ml-2 p-1 rounded hover:bg-red-500/10 text-[#6B7280] hover:text-red-400"><Trash2 size={12} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Editor */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar export' : 'Nuevo export'} size="lg">
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Nombre *</label>
                <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Tabla *</label>
                <select value={editing.target_table || ''} onChange={(e) => setEditing({ ...editing, target_table: e.target.value })} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]">
                  {TARGET_TABLES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Formato *</label>
                <select value={editing.format || 'csv'} onChange={(e) => setEditing({ ...editing, format: e.target.value as ExportFormat })} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]">
                  <option value="csv">CSV</option>
                  <option value="xlsx">XLSX</option>
                  <option value="json">JSON</option>
                  <option value="xml">XML</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Cron *</label>
                <Input value={editing.schedule_cron || ''} onChange={(e) => setEditing({ ...editing, schedule_cron: e.target.value })} placeholder="0 6 * * *" className="font-mono" />
                <div className="flex flex-wrap gap-1 mt-1">
                  {CRON_PRESETS.map(p => (
                    <button key={p.value} type="button" onClick={() => setEditing({ ...editing, schedule_cron: p.value })}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#1E2330] text-[#9CA3AF] hover:bg-[#2A3040]">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Delivery *</label>
              <select value={editing.delivery_type || 'email'} onChange={(e) => setEditing({ ...editing, delivery_type: e.target.value as DeliveryType, delivery_config: {} })} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]">
                <option value="email">Email (Resend)</option>
                <option value="webhook">Webhook (POST JSON)</option>
                <option value="storage">Supabase Storage</option>
              </select>
            </div>

            {editing.delivery_type === 'email' && (
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Destinatarios (separados por coma)</label>
                <Input
                  value={((editing.delivery_config?.recipients as string[]) || []).join(', ')}
                  onChange={(e) => setEditing({
                    ...editing,
                    delivery_config: {
                      ...editing.delivery_config,
                      recipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                    },
                  })}
                />
              </div>
            )}
            {editing.delivery_type === 'webhook' && (
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">URL del webhook</label>
                <Input value={(editing.delivery_config?.url as string) || ''} onChange={(e) => setEditing({ ...editing, delivery_config: { ...editing.delivery_config, url: e.target.value } })} />
              </div>
            )}
            {editing.delivery_type === 'storage' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">Bucket</label>
                  <Input value={(editing.delivery_config?.bucket as string) || 'scheduled-exports'} onChange={(e) => setEditing({ ...editing, delivery_config: { ...editing.delivery_config, bucket: e.target.value } })} />
                </div>
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">Path (opcional)</label>
                  <Input value={(editing.delivery_config?.path as string) || ''} onChange={(e) => setEditing({ ...editing, delivery_config: { ...editing.delivery_config, path: e.target.value } })} placeholder="auto-generado si vacío" />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Activo
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2330]">
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X size={14} /> Cancelar</Button>
              <Button size="sm" variant="primary" onClick={handleSave}><Save size={14} /> Guardar</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
