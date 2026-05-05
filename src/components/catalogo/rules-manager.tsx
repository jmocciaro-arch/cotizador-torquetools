'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Save, Trash2, X, Zap, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  listRules,
  saveRule,
  deleteRule,
  type CatalogRule,
  type RuleEvent,
  type RuleCondition,
  type RuleAction,
} from '@/lib/catalog-rules-engine'

const EVENT_LABEL: Record<RuleEvent, string> = {
  product_updated: 'Producto actualizado',
  product_created: 'Producto creado',
  lifecycle_changed: 'Cambio de ciclo de vida',
  lot_expiring: 'Lote por vencer',
  serial_calibration_due: 'Calibración próxima',
  scheduled_daily: 'Diario',
  scheduled_weekly: 'Semanal',
}

const OPS: RuleCondition['op'][] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with', 'changed']
const ACTION_TYPES: RuleAction['type'][] = ['notify_user', 'notify_email', 'create_oc_draft', 'update_field', 'log_to_audit', 'webhook']

export function RulesManager() {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [rules, setRules] = useState<CatalogRule[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Partial<CatalogRule> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setRules(await listRules())
    setLoading(false)
  }, [])

  useEffect(() => { if (open) reload() }, [open, reload])

  const handleSave = useCallback(async () => {
    if (!editing?.name?.trim() || !editing.trigger_event) {
      addToast({ type: 'warning', title: 'Nombre y trigger son obligatorios' })
      return
    }
    const id = await saveRule(editing as Parameters<typeof saveRule>[0])
    if (id) {
      addToast({ type: 'success', title: 'Regla guardada' })
      setEditing(null)
      reload()
    }
  }, [editing, addToast, reload])

  const handleDelete = useCallback(async (id: string) => {
    await deleteRule(id)
    setConfirmDelete(null)
    reload()
  }, [reload])

  const updateCondition = useCallback((idx: number, patch: Partial<RuleCondition>) => {
    if (!editing) return
    const conditions = [...(editing.conditions || [])]
    conditions[idx] = { ...conditions[idx], ...patch }
    setEditing({ ...editing, conditions })
  }, [editing])

  const updateAction = useCallback((idx: number, patch: Partial<RuleAction>) => {
    if (!editing) return
    const actions = [...(editing.actions || [])]
    actions[idx] = { ...actions[idx], ...patch }
    setEditing({ ...editing, actions })
  }, [editing])

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Zap size={14} /> Reglas automáticas
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Reglas automáticas" size="full">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#9CA3AF]">Disparadores que reaccionan a eventos del catálogo.</p>
            <Button size="sm" variant="primary" onClick={() => setEditing({
              name: '', trigger_event: 'product_updated', conditions: [], actions: [], is_active: true, priority: 100,
            })}>
              <Plus size={14} /> Nueva regla
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-[#9CA3AF] py-8 text-center">Cargando...</div>
          ) : rules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1E2330] p-8 text-center text-sm text-[#6B7280]">
              No hay reglas configuradas.
            </div>
          ) : (
            <div className="rounded-xl border border-[#1E2330] bg-[#0F1218] overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0A0D12] text-[#6B7280] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left">Trigger</th>
                    <th className="px-3 py-2 text-left">Condiciones</th>
                    <th className="px-3 py-2 text-left">Acciones</th>
                    <th className="px-3 py-2 text-right">Disparos</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(r => (
                    <tr key={r.id} className="border-t border-[#1E2330] hover:bg-[#1A1F2E]">
                      <td className="px-3 py-2 font-medium text-[#F0F2F5]">{r.name}</td>
                      <td className="px-3 py-2 text-[#9CA3AF]">{EVENT_LABEL[r.trigger_event] || r.trigger_event}</td>
                      <td className="px-3 py-2 text-[#9CA3AF]">{r.conditions?.length || 0}</td>
                      <td className="px-3 py-2 text-[#9CA3AF]">{r.actions?.length || 0}</td>
                      <td className="px-3 py-2 text-right text-[#9CA3AF]">{r.fire_count || 0}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.is_active ? 'success' : 'default'} size="sm">{r.is_active ? 'Activa' : 'Pausada'}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => setEditing(r)} className="text-[#FF6600] hover:underline text-xs">Editar</button>
                        {confirmDelete === r.id ? (
                          <button onClick={() => handleDelete(r.id)} className="ml-2 text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">Confirmá</button>
                        ) : (
                          <button onClick={() => setConfirmDelete(r.id)} className="ml-2 p-1 rounded hover:bg-red-500/10 text-[#6B7280] hover:text-red-400"><Trash2 size={12} /></button>
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
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar regla' : 'Nueva regla'} size="full">
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Nombre *</label>
                <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Trigger *</label>
                <select value={editing.trigger_event || ''} onChange={(e) => setEditing({ ...editing, trigger_event: e.target.value as RuleEvent })} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]">
                  {(Object.keys(EVENT_LABEL) as RuleEvent[]).map(e => <option key={e} value={e}>{EVENT_LABEL[e]}</option>)}
                </select>
              </div>
            </div>

            {/* Condiciones */}
            <div className="rounded-lg border border-[#1E2330] bg-[#0F1218] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#F0F2F5] uppercase tracking-wider">Condiciones</h4>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, conditions: [...(editing.conditions || []), { field: '', op: 'eq', value: '' }] })}>
                  <Plus size={12} /> Sumar
                </Button>
              </div>
              {(editing.conditions || []).length === 0 && <p className="text-xs text-[#6B7280]">Sin condiciones (siempre matchea).</p>}
              {(editing.conditions || []).map((c, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input value={c.field} onChange={(e) => updateCondition(idx, { field: e.target.value })} placeholder="ej: after.price_eur" className="col-span-5 h-8 text-xs" />
                  <select value={c.op} onChange={(e) => updateCondition(idx, { op: e.target.value as RuleCondition['op'] })} className="col-span-2 h-8 px-2 bg-[#0A0D12] border border-[#1E2330] rounded text-xs text-[#F0F2F5]">
                    {OPS.map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <Input value={String(c.value ?? '')} onChange={(e) => updateCondition(idx, { value: e.target.value })} placeholder="valor" className="col-span-4 h-8 text-xs" />
                  <button onClick={() => setEditing({ ...editing, conditions: (editing.conditions || []).filter((_, i) => i !== idx) })} className="col-span-1 p-1 text-red-400 hover:bg-red-500/10 rounded">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Acciones */}
            <div className="rounded-lg border border-[#1E2330] bg-[#0F1218] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#F0F2F5] uppercase tracking-wider">Acciones</h4>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, actions: [...(editing.actions || []), { type: 'log_to_audit', params: {} }] })}>
                  <Plus size={12} /> Sumar
                </Button>
              </div>
              {(editing.actions || []).length === 0 && <p className="text-xs text-[#6B7280]">Sin acciones.</p>}
              {(editing.actions || []).map((a, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <select value={a.type} onChange={(e) => updateAction(idx, { type: e.target.value as RuleAction['type'] })} className="col-span-3 h-8 px-2 bg-[#0A0D12] border border-[#1E2330] rounded text-xs text-[#F0F2F5]">
                    {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Input
                    value={JSON.stringify(a.params || {})}
                    onChange={(e) => {
                      try {
                        const params = JSON.parse(e.target.value || '{}')
                        updateAction(idx, { params })
                      } catch {/* dejarlo así hasta que sea JSON válido */}
                    }}
                    placeholder='{"key":"value"}'
                    className="col-span-8 h-8 text-xs font-mono"
                  />
                  <button onClick={() => setEditing({ ...editing, actions: (editing.actions || []).filter((_, i) => i !== idx) })} className="col-span-1 p-1 text-red-400 hover:bg-red-500/10 rounded">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Prioridad</label>
                <Input type="number" value={editing.priority ?? 100} onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-2 text-xs text-[#9CA3AF] mt-6">
                <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                <Activity size={12} /> Regla activa
              </label>
            </div>

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
