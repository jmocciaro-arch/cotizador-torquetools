'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Upload, Save, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  listSerials,
  saveSerial,
  deleteSerial,
  bulkCreateSerials,
  type ProductSerial,
  type SerialStatus,
} from '@/lib/product-serials'

interface Props {
  productId: string
}

const STATUS_OPTIONS: SerialStatus[] = [
  'en_stock', 'reservado', 'vendido', 'en_servicio', 'en_calibracion', 'baja', 'garantia',
]

const STATUS_LABEL: Record<SerialStatus, string> = {
  en_stock: 'En stock',
  reservado: 'Reservado',
  vendido: 'Vendido',
  en_servicio: 'En servicio',
  en_calibracion: 'En calibración',
  baja: 'Baja',
  garantia: 'Garantía',
}

const STATUS_VARIANT: Record<SerialStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange'> = {
  en_stock: 'success',
  reservado: 'info',
  vendido: 'default',
  en_servicio: 'orange',
  en_calibracion: 'warning',
  baja: 'danger',
  garantia: 'info',
}

export function ProductSerialsTab({ productId }: Props) {
  const { addToast } = useToast()
  const [serials, setSerials] = useState<ProductSerial[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SerialStatus | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Partial<ProductSerial> | null>(null)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await listSerials(productId, {
      search: search || undefined,
      status: statusFilter || undefined,
    })
    setSerials(list)
    setLoading(false)
  }, [productId, search, statusFilter])

  useEffect(() => { reload() }, [reload])

  const handleSave = useCallback(async () => {
    if (!editing) return
    if (!editing.serial_number?.trim()) {
      addToast({ type: 'warning', title: 'El número de serie es obligatorio' })
      return
    }
    const id = await saveSerial({
      ...editing,
      product_id: productId,
      serial_number: editing.serial_number,
    } as Parameters<typeof saveSerial>[0])
    if (id) {
      addToast({ type: 'success', title: editing.id ? 'Serie actualizada' : 'Serie creada' })
      setShowForm(false)
      setEditing(null)
      reload()
    }
  }, [editing, productId, addToast, reload])

  const handleBulk = useCallback(async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      addToast({ type: 'warning', title: 'Pegá al menos un número de serie' })
      return
    }
    const r = await bulkCreateSerials(productId, lines)
    addToast({
      type: 'success',
      title: `${r.created} series creadas`,
      message: r.skipped > 0 ? `${r.skipped} ya existían` : undefined,
    })
    setShowBulk(false)
    setBulkText('')
    reload()
  }, [bulkText, productId, addToast, reload])

  const handleDelete = useCallback(async (id: string) => {
    await deleteSerial(id)
    setConfirmDelete(null)
    addToast({ type: 'success', title: 'Serie eliminada' })
    reload()
  }, [addToast, reload])

  if (loading) {
    return <div className="text-sm text-[#9CA3AF] py-8 text-center">Cargando series...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-[#F0F2F5] uppercase tracking-wider">Series ({serials.length})</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowBulk(true)}>
            <Upload size={14} /> Importar bulk
          </Button>
          <Button size="sm" variant="primary" onClick={() => { setEditing({ status: 'en_stock' }); setShowForm(true) }}>
            <Plus size={14} /> Nueva serie
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número de serie" className="pl-9 h-9 text-xs" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SerialStatus | '')}
          className="h-9 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-xs text-[#F0F2F5]"
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {serials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1E2330] p-8 text-center text-sm text-[#6B7280]">
          No hay series cargadas todavía.
        </div>
      ) : (
        <div className="rounded-xl border border-[#1E2330] bg-[#0F1218] overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#0A0D12] text-[#6B7280] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Serie</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Próx. calibración</th>
                <th className="px-3 py-2 text-left">Garantía hasta</th>
                <th className="px-3 py-2 text-left">Owner</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {serials.map(s => (
                <tr key={s.id} className="border-t border-[#1E2330] hover:bg-[#1A1F2E]">
                  <td className="px-3 py-2 font-mono text-[#F0F2F5]">{s.serial_number}</td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[s.status]} size="sm">{STATUS_LABEL[s.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-[#9CA3AF]">{s.next_calibration_date || '—'}</td>
                  <td className="px-3 py-2 text-[#9CA3AF]">{s.warranty_until || '—'}</td>
                  <td className="px-3 py-2 text-[#9CA3AF]">
                    {s.current_owner_type ? `${s.current_owner_type}${s.current_owner_id ? ` (${s.current_owner_id.slice(0, 8)})` : ''}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => { setEditing(s); setShowForm(true) }} className="text-[#FF6600] hover:underline text-xs">Editar</button>
                    {confirmDelete === s.id ? (
                      <button onClick={() => handleDelete(s.id)} className="ml-2 text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">Confirmá</button>
                    ) : (
                      <button onClick={() => setConfirmDelete(s.id)} className="ml-2 p-1 rounded hover:bg-red-500/10 text-[#6B7280] hover:text-red-400"><Trash2 size={12} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal individual */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing?.id ? 'Editar serie' : 'Nueva serie'} size="lg">
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Número de serie *</label>
                <Input value={editing.serial_number || ''} onChange={(e) => setEditing({ ...editing, serial_number: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Estado</label>
                <select
                  value={editing.status || 'en_stock'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as SerialStatus })}
                  className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]"
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Última calibración</label>
                <Input type="date" value={editing.last_calibration_date || ''} onChange={(e) => setEditing({ ...editing, last_calibration_date: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Próxima calibración</label>
                <Input type="date" value={editing.next_calibration_date || ''} onChange={(e) => setEditing({ ...editing, next_calibration_date: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Garantía hasta</label>
                <Input type="date" value={editing.warranty_until || ''} onChange={(e) => setEditing({ ...editing, warranty_until: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Tipo de owner</label>
                <select
                  value={editing.current_owner_type || ''}
                  onChange={(e) => setEditing({ ...editing, current_owner_type: (e.target.value || null) as 'cliente' | 'proveedor' | 'interno' | null })}
                  className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]"
                >
                  <option value="">—</option>
                  <option value="cliente">Cliente</option>
                  <option value="proveedor">Proveedor</option>
                  <option value="interno">Interno</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[#9CA3AF] mb-1 block">ID del owner (opcional)</label>
                <Input value={editing.current_owner_id || ''} onChange={(e) => setEditing({ ...editing, current_owner_id: e.target.value || null })} placeholder="UUID del cliente / proveedor" />
              </div>
            </div>

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

      {/* Modal bulk */}
      <Modal isOpen={showBulk} onClose={() => { setShowBulk(false); setBulkText('') }} title="Importar series en bloque" size="lg">
        <div className="space-y-3">
          <p className="text-xs text-[#9CA3AF]">Pegá un número de serie por línea. Se crearán todos en estado &quot;En stock&quot;.</p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-xs font-mono text-[#F0F2F5]"
            placeholder="SN-0001&#10;SN-0002&#10;SN-0003"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setShowBulk(false); setBulkText('') }}>Cancelar</Button>
            <Button size="sm" variant="primary" onClick={handleBulk}>
              <Upload size={14} /> Importar {bulkText.split('\n').filter(l => l.trim()).length} series
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
