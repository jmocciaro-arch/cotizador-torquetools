'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { SearchBar } from '@/components/ui/search-bar'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { KPICard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  ShoppingCart, Plus, Package, Truck, CheckCircle, Clock,
  Eye, FileText, Loader2, X, Send
} from 'lucide-react'

type PO = Record<string, unknown>
type POItem = Record<string, unknown>

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange' }> = {
  draft: { label: 'Borrador', variant: 'default' },
  sent: { label: 'Enviada', variant: 'info' },
  partial: { label: 'Parcial', variant: 'warning' },
  received: { label: 'Recibida', variant: 'success' },
  closed: { label: 'Cerrada', variant: 'danger' },
}

export default function ComprasPage() {
  const supabase = createClient()
  const { addToast } = useToast()

  const [orders, setOrders] = useState<PO[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showReceive, setShowReceive] = useState(false)

  const [selectedPO, setSelectedPO] = useState<PO | null>(null)
  const [poItems, setPOItems] = useState<POItem[]>([])

  // Create form
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ product_id: string; name: string; quantity: number; unit_cost: number }>>([])
  const [products, setProducts] = useState<Array<Record<string, unknown>>>([])
  const [saving, setSaving] = useState(false)

  // Receive form
  const [rcvLines, setRcvLines] = useState<Array<{ id: string; desc: string; ordered: number; received: number; toReceive: number }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('tt_purchase_orders').select('*').order('created_at', { ascending: false })
    if (statusFilter) q = q.eq('status', statusFilter)
    if (search) q = q.ilike('supplier_name', `%${search}%`)
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }, [supabase, statusFilter, search])

  useEffect(() => { load() }, [load])

  const loadProducts = async () => {
    const { data } = await supabase.from('tt_products').select('id, sku, name, cost_price').order('name').limit(500)
    setProducts(data || [])
  }

  // ─── Create OC ───
  const handleCreate = async () => {
    if (!supplier.trim() || lines.length === 0) {
      addToast({ type: 'warning', title: 'Completá los datos', message: 'Necesitás proveedor y al menos un producto' })
      return
    }
    setSaving(true)
    const total = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0)

    const { data: po, error } = await supabase
      .from('tt_purchase_orders')
      .insert({ supplier_name: supplier, status: 'draft', total, notes })
      .select().single()

    if (error || !po) {
      addToast({ type: 'error', title: 'Error', message: error?.message || 'No se pudo crear' })
      setSaving(false)
      return
    }

    const items = lines.map((l, i) => ({
      purchase_order_id: po.id,
      product_id: l.product_id || null,
      description: l.name,
      quantity: l.quantity,
      unit_cost: l.unit_cost,
      qty_received: 0,
      line_total: l.quantity * l.unit_cost,
      sort_order: i,
    }))
    await supabase.from('tt_po_items').insert(items)
    await supabase.from('tt_activity_log').insert({ entity_type: 'purchase_order', entity_id: po.id, action: 'created', detail: `OC creada para ${supplier}` })

    addToast({ type: 'success', title: 'OC creada' })
    setShowCreate(false)
    setSupplier(''); setNotes(''); setLines([])
    load()
    setSaving(false)
  }

  // ─── View detail ───
  const openDetail = async (po: PO) => {
    setSelectedPO(po)
    const { data } = await supabase.from('tt_po_items').select('*').eq('purchase_order_id', po.id).order('sort_order')
    setPOItems(data || [])
    setShowDetail(true)
  }

  // ─── Receive goods ───
  const openReceive = async (po: PO) => {
    setSelectedPO(po)
    const { data } = await supabase.from('tt_po_items').select('*').eq('purchase_order_id', po.id).order('sort_order')
    setRcvLines((data || []).map((it: Record<string, unknown>) => ({
      id: it.id as string,
      desc: (it.description || '') as string,
      ordered: (it.quantity || 0) as number,
      received: (it.qty_received || 0) as number,
      toReceive: 0,
    })))
    setShowReceive(true)
  }

  const handleReceive = async () => {
    if (!selectedPO) return
    for (const l of rcvLines) {
      if (l.toReceive > 0) {
        await supabase.from('tt_po_items').update({ qty_received: l.received + l.toReceive }).eq('id', l.id)
      }
    }
    const { data: items } = await supabase.from('tt_po_items').select('quantity, qty_received').eq('purchase_order_id', selectedPO.id)
    const allDone = (items || []).every((i: Record<string, unknown>) => (i.qty_received as number) >= (i.quantity as number))
    const someDone = (items || []).some((i: Record<string, unknown>) => (i.qty_received as number) > 0)
    const st = allDone ? 'received' : someDone ? 'partial' : (selectedPO.status as string)

    await supabase.from('tt_purchase_orders').update({ status: st }).eq('id', selectedPO.id)
    await supabase.from('tt_activity_log').insert({ entity_type: 'purchase_order', entity_id: selectedPO.id as string, action: 'received', detail: `Recepción. Estado: ${st}` })

    addToast({ type: 'success', title: 'Recepción registrada' })
    setShowReceive(false)
    load()
  }

  const changeStatus = async (id: string, st: string) => {
    await supabase.from('tt_purchase_orders').update({ status: st }).eq('id', id)
    await supabase.from('tt_activity_log').insert({ entity_type: 'purchase_order', entity_id: id, action: 'status_changed', detail: `Estado → ${st}` })
    addToast({ type: 'success', title: 'Estado actualizado' })
    setShowDetail(false)
    load()
  }

  const addLine = () => setLines([...lines, { product_id: '', name: '', quantity: 1, unit_cost: 0 }])
  const rmLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))
  const setLine = (i: number, field: string, val: unknown) => {
    const u = [...lines]
    if (field === 'product_id') {
      const p = products.find(pr => pr.id === val)
      if (p) { u[i] = { ...u[i], product_id: p.id as string, name: (p.name || '') as string, unit_cost: (p.cost_price || 0) as number } }
    } else {
      (u[i] as Record<string, unknown>)[field] = val
    }
    setLines(u)
  }

  const totalPOs = orders.length
  const draftCount = orders.filter(o => o.status === 'draft').length
  const pendingCount = orders.filter(o => o.status === 'sent' || o.status === 'partial').length
  const totalVal = orders.reduce((s, o) => s + ((o.total as number) || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Compras</h1>
          <p className="text-sm text-[#6B7280] mt-1">Ordenes de compra a proveedores</p>
        </div>
        <Button onClick={() => { setShowCreate(true); loadProducts() }}><Plus size={16} /> Nueva OC</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total OCs" value={totalPOs} icon={<ShoppingCart size={22} />} />
        <KPICard label="Borradores" value={draftCount} icon={<FileText size={22} />} color="#6B7280" />
        <KPICard label="Pendientes" value={pendingCount} icon={<Clock size={22} />} color="#F59E0B" />
        <KPICard label="Valor total" value={formatCurrency(totalVal)} icon={<Package size={22} />} color="#10B981" />
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar placeholder="Buscar proveedor..." value={search} onChange={setSearch} className="flex-1" />
          <Select
            options={[{ value: '', label: 'Todos' }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[#FF6600]" size={32} /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-[#6B7280]">
            <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
            <p>No hay órdenes de compra</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((po) => {
                const cfg = STATUS_MAP[(po.status as string) || 'draft']
                return (
                  <TableRow key={po.id as string}>
                    <TableCell><span className="font-medium text-[#F0F2F5]">{(po.supplier_name as string) || '-'}</span></TableCell>
                    <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                    <TableCell>{formatCurrency((po.total as number) || 0)}</TableCell>
                    <TableCell className="text-sm">{po.created_at ? formatDate(po.created_at as string) : '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(po)}><Eye size={14} /></Button>
                        {((po.status as string) === 'sent' || (po.status as string) === 'partial') && (
                          <Button variant="ghost" size="sm" onClick={() => openReceive(po)}><Truck size={14} /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ─── CREATE ─── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nueva Orden de Compra" size="xl">
        <div className="space-y-4">
          <Input label="Proveedor" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Nombre del proveedor" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#9CA3AF]">Productos</span>
              <Button variant="ghost" size="sm" onClick={addLine}><Plus size={14} /> Agregar</Button>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2 mb-2 items-end">
                <div className="flex-1">
                  <Select
                    options={products.map(p => ({ value: p.id as string, label: `${p.sku || ''} - ${p.name}` }))}
                    value={l.product_id}
                    onChange={(e) => setLine(i, 'product_id', e.target.value)}
                    placeholder="Producto"
                  />
                </div>
                <Input type="number" value={l.quantity} onChange={(e) => setLine(i, 'quantity', Number(e.target.value))} className="w-20" />
                <Input type="number" value={l.unit_cost} onChange={(e) => setLine(i, 'unit_cost', Number(e.target.value))} className="w-28" />
                <span className="text-xs text-[#6B7280] w-20 text-right whitespace-nowrap">{formatCurrency(l.quantity * l.unit_cost)}</span>
                <Button variant="ghost" size="sm" onClick={() => rmLine(i)}><X size={14} /></Button>
              </div>
            ))}
            {lines.length > 0 && (
              <p className="text-right text-sm font-bold text-[#FF6600]">Total: {formatCurrency(lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0))}</p>
            )}
          </div>
          <Input label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones..." />
          <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2330]">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Crear OC</Button>
          </div>
        </div>
      </Modal>

      {/* ─── DETAIL ─── */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={`OC - ${(selectedPO?.supplier_name as string) || ''}`} size="lg">
        {selectedPO && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={STATUS_MAP[(selectedPO.status as string) || 'draft'].variant}>
                {STATUS_MAP[(selectedPO.status as string) || 'draft'].label}
              </Badge>
              <span className="text-sm text-[#6B7280]">{selectedPO.created_at ? formatDate(selectedPO.created_at as string) : ''}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cant.</TableHead>
                  <TableHead>Recibido</TableHead>
                  <TableHead>Costo u.</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poItems.map((it) => (
                  <TableRow key={it.id as string}>
                    <TableCell>{it.description as string}</TableCell>
                    <TableCell>{it.quantity as number}</TableCell>
                    <TableCell>
                      <span className={(it.qty_received as number) >= (it.quantity as number) ? 'text-emerald-400' : 'text-amber-400'}>
                        {(it.qty_received as number) || 0}
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency((it.unit_cost as number) || 0)}</TableCell>
                    <TableCell>{formatCurrency((it.line_total as number) || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-right text-lg font-bold text-[#FF6600]">Total: {formatCurrency((selectedPO.total as number) || 0)}</p>
            {selectedPO.notes ? <p className="text-sm text-[#6B7280]">Notas: {String(selectedPO.notes)}</p> : null}
            <div className="flex justify-end gap-2 pt-4 border-t border-[#1E2330]">
              {(selectedPO.status as string) === 'draft' && (
                <Button variant="secondary" onClick={() => changeStatus(selectedPO.id as string, 'sent')}><Send size={14} /> Marcar Enviada</Button>
              )}
              {(selectedPO.status as string) === 'received' && (
                <Button variant="secondary" onClick={() => changeStatus(selectedPO.id as string, 'closed')}><CheckCircle size={14} /> Cerrar OC</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ─── RECEIVE ─── */}
      <Modal isOpen={showReceive} onClose={() => setShowReceive(false)} title="Recepción de Mercadería" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-[#6B7280]">Ingresá las cantidades recibidas para cada producto</p>
          {rcvLines.map((l, i) => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0F1218]">
              <div className="flex-1">
                <p className="text-sm text-[#F0F2F5]">{l.desc}</p>
                <p className="text-xs text-[#6B7280]">Pedido: {l.ordered} | Recibido: {l.received} | Pend: {l.ordered - l.received}</p>
              </div>
              <Input
                type="number"
                value={l.toReceive}
                onChange={(e) => {
                  const u = [...rcvLines]
                  u[i].toReceive = Math.max(0, Math.min(Number(e.target.value), l.ordered - l.received))
                  setRcvLines(u)
                }}
                className="w-24"
              />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2330]">
            <Button variant="secondary" onClick={() => setShowReceive(false)}>Cancelar</Button>
            <Button onClick={handleReceive}><CheckCircle size={16} /> Confirmar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
