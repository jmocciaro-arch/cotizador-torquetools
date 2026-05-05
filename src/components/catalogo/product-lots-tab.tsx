'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, AlertTriangle, Calendar, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { listLots, saveLot, deleteLot, type ProductLot } from '@/lib/product-lots'

interface Props {
  productId: string
}

const EMPTY_LOT: Partial<ProductLot> = {
  lot_number: '',
  manufacture_date: null,
  expiry_date: null,
  received_date: new Date().toISOString().slice(0, 10),
  qty_in: 0,
  qty_remaining: 0,
  cost_per_unit: null,
  status: 'activo',
}

export function ProductLotsTab({ productId }: Props) {
  const { addToast } = useToast()
  const [lots, setLots] = useState<ProductLot[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Partial<ProductLot> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await listLots(productId)
    setLots(list)
    setLoading(false)
  }, [productId])

  useEffect(() => { reload() }, [reload])

  const handleSave = useCallback(async () => {
    if (!editing) return
    if (!editing.lot_number?.trim()) {
      addToast({ type: 'warning', title: 'El número de lote es obligatorio' })
      return
    }
    const id = await saveLot({
      ...editing,
      product_id: productId,
      lot_number: editing.lot_number,
      qty_in: editing.qty_in ?? 0,
    } as Parameters<typeof saveLot>[0])
    if (id) {
      addToast({ type: 'success', title: editing.id ? 'Lote actualizado' : 'Lote creado' })
      setShowForm(false)
      setEditing(null)
      reload()
    } else {
      addToast({ type: 'error', title: 'No se pudo guardar' })
    }
  }, [editing, productId, addToast, reload])

  const handleDelete = useCallback(async (id: string) => {
    await deleteLot(id)
    setConfirmDelete(null)
    addToast({ type: 'success', title: 'Lote eliminado' })
    reload()
  }, [addToast, reload])

  const { today, nowMs } = useMemo(() => {
    const now = new Date()
    return { today: now.toISOString().slice(0, 10), nowMs: now.getTime() }
  }, [])

  const expiryStatus = (lot: ProductLot): { variant: 'default' | 'warning' | 'danger'; label: string } | null => {
    if (!lot.expiry_date) return null
    if (lot.expiry_date < today) return { variant: 'danger', label: 'Vencido' }
    const diff = (new Date(lot.expiry_date).getTime() - nowMs) / (24 * 60 * 60 * 1000)
    if (diff <= 30) return { variant: 'warning', label: `Vence en ${Math.ceil(diff)}d` }
    return null
  }

  if (loading) {
    return <div className="text-sm text-[#9CA3AF] py-8 text-center">Cargando lotes...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#F0F2F5] uppercase tracking-wider">Lotes ({lots.length})</h3>
        <Button size="sm" variant="primary" onClick={() => { setEditing({ ...EMPTY_LOT }); setShowForm(true) }}>
          <Plus size={14} /> Nuevo lote
        </Button>
      </div>

      {lots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1E2330] p-8 text-center text-sm text-[#6B7280]">
          Todavía no hay lotes. Sumá uno desde el botón de arriba.
        </div>
      ) : (
        <div className="rounded-xl border border-[#1E2330] bg-[#0F1218] overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#0A0D12] text-[#6B7280] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Lote</th>
                <th className="px-3 py-2 text-left">Recibido</th>
                <th className="px-3 py-2 text-left">Vence</th>
                <th className="px-3 py-2 text-right">Inicial</th>
                <th className="px-3 py-2 text-right">Restante</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-right">Costo unit.</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {lots.map(l => {
                const expStatus = expiryStatus(l)
                return (
                  <tr key={l.id} className="border-t border-[#1E2330] hover:bg-[#1A1F2E]">
                    <td className="px-3 py-2 font-medium text-[#F0F2F5]">{l.lot_number}</td>
                    <td className="px-3 py-2 text-[#9CA3AF]">{l.received_date || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[#9CA3AF]">{l.expiry_date || '—'}</span>
                        {expStatus && (
                          <Badge variant={expStatus.variant === 'danger' ? 'danger' : 'warning'} size="sm">
                            {expStatus.label}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-[#9CA3AF]">{l.qty_in}</td>
                    <td className="px-3 py-2 text-right text-[#F0F2F5] font-medium">{l.qty_remaining}</td>
                    <td className="px-3 py-2">
                      <Badge variant={l.status === 'activo' ? 'success' : l.status === 'vencido' ? 'danger' : 'default'} size="sm">
                        {l.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right text-[#9CA3AF]">{l.cost_per_unit?.toFixed(2) ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => { setEditing(l); setShowForm(true) }}
                        className="text-[#FF6600] hover:underline text-xs"
                      >Editar</button>
                      {confirmDelete === l.id ? (
                        <button
                          onClick={() => handleDelete(l.id)}
                          className="ml-2 text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        >Confirmá</button>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(l.id)}
                          className="ml-2 p-1 rounded hover:bg-red-500/10 text-[#6B7280] hover:text-red-400"
                        ><Trash2 size={12} /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        title={editing?.id ? 'Editar lote' : 'Nuevo lote'}
        size="lg"
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Número de lote *</label>
                <Input value={editing.lot_number || ''} onChange={(e) => setEditing({ ...editing, lot_number: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Estado</label>
                <select
                  value={editing.status || 'activo'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as ProductLot['status'] })}
                  className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]"
                >
                  <option value="activo">Activo</option>
                  <option value="agotado">Agotado</option>
                  <option value="vencido">Vencido</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block flex items-center gap-1"><Calendar size={11} /> Fabricación</label>
                <Input type="date" value={editing.manufacture_date || ''} onChange={(e) => setEditing({ ...editing, manufacture_date: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block flex items-center gap-1"><Calendar size={11} /> Vencimiento</label>
                <Input type="date" value={editing.expiry_date || ''} onChange={(e) => setEditing({ ...editing, expiry_date: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Recibido</label>
                <Input type="date" value={editing.received_date || ''} onChange={(e) => setEditing({ ...editing, received_date: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Cantidad inicial</label>
                <Input type="number" value={editing.qty_in ?? 0} onChange={(e) => setEditing({ ...editing, qty_in: Number(e.target.value), qty_remaining: editing.id ? editing.qty_remaining : Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Cantidad restante</label>
                <Input type="number" value={editing.qty_remaining ?? 0} onChange={(e) => setEditing({ ...editing, qty_remaining: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Costo por unidad</label>
                <Input type="number" step="0.01" value={editing.cost_per_unit ?? ''} onChange={(e) => setEditing({ ...editing, cost_per_unit: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            </div>

            {editing.expiry_date && editing.expiry_date < today && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                <AlertTriangle size={14} /> Este lote ya está vencido.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2330]">
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditing(null) }}>
                <X size={14} /> Cancelar
              </Button>
              <Button size="sm" variant="primary" onClick={handleSave}>
                <Save size={14} /> Guardar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
