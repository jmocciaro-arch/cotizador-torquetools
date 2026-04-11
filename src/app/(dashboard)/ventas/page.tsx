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
  Receipt, Plus, Eye, Loader2, FileText, Truck, CreditCard,
  Package, Clock, CheckCircle, ArrowRight, X
} from 'lucide-react'

type SO = Record<string, unknown>
type SOItem = Record<string, unknown>

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange' }> = {
  open: { label: 'Abierto', variant: 'info' },
  partially_delivered: { label: 'Entrega parcial', variant: 'warning' },
  fully_delivered: { label: 'Entregado', variant: 'success' },
  partially_invoiced: { label: 'Facturación parcial', variant: 'orange' },
  fully_invoiced: { label: 'Facturado', variant: 'success' },
  closed: { label: 'Cerrado', variant: 'default' },
}

export default function VentasPage() {
  const supabase = createClient()
  const { addToast } = useToast()

  const [orders, setOrders] = useState<SO[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [showDetail, setShowDetail] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showDelivery, setShowDelivery] = useState(false)

  const [selectedSO, setSelectedSO] = useState<SO | null>(null)
  const [soItems, setSOItems] = useState<SOItem[]>([])

  // Create form
  const [clients, setClients] = useState<Array<Record<string, unknown>>>([])
  const [quotes, setQuotes] = useState<Array<Record<string, unknown>>>([])
  const [selectedQuote, setSelectedQuote] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [products, setProducts] = useState<Array<Record<string, unknown>>>([])
  const [newLines, setNewLines] = useState<Array<{ product_id: string; name: string; qty: number; price: number }>>([])
  const [saving, setSaving] = useState(false)

  // Delivery form
  const [deliveryLines, setDeliveryLines] = useState<Array<{ id: string; desc: string; ordered: number; delivered: number; toDeliver: number }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('tt_sales_orders').select('*, tt_clients(name)').order('created_at', { ascending: false })
    if (statusFilter) q = q.eq('status', statusFilter)
    if (search) q = q.ilike('doc_number', `%${search}%`)
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }, [supabase, statusFilter, search])

  useEffect(() => { load() }, [load])

  const loadCreateData = async () => {
    const [{ data: cl }, { data: qt }, { data: pr }] = await Promise.all([
      supabase.from('tt_clients').select('id, name').order('name').limit(500),
      supabase.from('tt_quotes').select('id, doc_number, client_id, total').eq('status', 'draft').order('created_at', { ascending: false }),
      supabase.from('tt_products').select('id, sku, name, sell_price').order('name').limit(500),
    ])
    setClients(cl || [])
    setQuotes(qt || [])
    setProducts(pr || [])
  }

  const handleCreateFromQuote = async () => {
    if (!selectedQuote) return
    setSaving(true)

    const { data: quote } = await supabase
      .from('tt_quotes')
      .select('*, tt_quote_items(*)')
      .eq('id', selectedQuote).single()

    if (!quote) { addToast({ type: 'error', title: 'Error', message: 'Cotización no encontrada' }); setSaving(false); return }

    const yr = new Date().getFullYear().toString().slice(-2)
    const mo = (new Date().getMonth() + 1).toString().padStart(2, '0')
    const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    const docNum = `PED-${yr}${mo}-${seq}`

    const { data: so, error } = await supabase.from('tt_sales_orders').insert({
      company_id: quote.company_id,
      client_id: quote.client_id,
      quote_id: selectedQuote,
      doc_number: docNum,
      currency: quote.currency || 'EUR',
      status: 'open',
      subtotal: quote.subtotal || 0,
      tax_amount: quote.tax_amount || 0,
      total: quote.total || 0,
      notes: quote.notes || '',
    }).select().single()

    if (error || !so) { addToast({ type: 'error', title: 'Error', message: error?.message }); setSaving(false); return }

    const items = (quote.tt_quote_items || []).map((it: Record<string, unknown>, i: number) => ({
      sales_order_id: so.id,
      product_id: it.product_id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_pct: it.discount_pct || 0,
      line_total: it.line_total,
      qty_ordered: it.quantity,
      qty_reserved: 0,
      qty_delivered: 0,
      qty_invoiced: 0,
      sort_order: i,
    }))

    await supabase.from('tt_so_items').insert(items)
    await supabase.from('tt_quotes').update({ status: 'accepted' }).eq('id', selectedQuote)
    await supabase.from('tt_activity_log').insert({ entity_type: 'sales_order', entity_id: so.id, action: 'created', detail: `Pedido ${docNum} desde cotización` })

    addToast({ type: 'success', title: 'Pedido creado', message: docNum })
    setShowCreate(false)
    setSelectedQuote('')
    load()
    setSaving(false)
  }

  const handleCreateFromScratch = async () => {
    if (!selectedClient || newLines.length === 0) {
      addToast({ type: 'warning', title: 'Completá los datos' })
      return
    }
    setSaving(true)
    const total = newLines.reduce((s, l) => s + l.qty * l.price, 0)
    const yr = new Date().getFullYear().toString().slice(-2)
    const mo = (new Date().getMonth() + 1).toString().padStart(2, '0')
    const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    const docNum = `PED-${yr}${mo}-${seq}`

    const { data: so, error } = await supabase.from('tt_sales_orders').insert({
      client_id: selectedClient,
      doc_number: docNum,
      currency: 'EUR',
      status: 'open',
      subtotal: total,
      tax_amount: 0,
      total,
    }).select().single()

    if (error || !so) { addToast({ type: 'error', title: 'Error', message: error?.message }); setSaving(false); return }

    const items = newLines.map((l, i) => ({
      sales_order_id: so.id,
      product_id: l.product_id || null,
      description: l.name,
      quantity: l.qty,
      unit_price: l.price,
      line_total: l.qty * l.price,
      qty_ordered: l.qty,
      qty_reserved: 0,
      qty_delivered: 0,
      qty_invoiced: 0,
      sort_order: i,
    }))

    await supabase.from('tt_so_items').insert(items)
    await supabase.from('tt_activity_log').insert({ entity_type: 'sales_order', entity_id: so.id, action: 'created', detail: `Pedido ${docNum} creado` })

    addToast({ type: 'success', title: 'Pedido creado', message: docNum })
    setShowCreate(false)
    setSelectedClient(''); setNewLines([])
    load()
    setSaving(false)
  }

  const openDetail = async (so: SO) => {
    setSelectedSO(so)
    const { data } = await supabase.from('tt_so_items').select('*').eq('sales_order_id', so.id).order('sort_order')
    setSOItems(data || [])
    setShowDetail(true)
  }

  const openDelivery = async (so: SO) => {
    setSelectedSO(so)
    const { data } = await supabase.from('tt_so_items').select('*').eq('sales_order_id', so.id).order('sort_order')
    setDeliveryLines((data || []).map((it: Record<string, unknown>) => ({
      id: it.id as string,
      desc: (it.description || '') as string,
      ordered: (it.qty_ordered || it.quantity || 0) as number,
      delivered: (it.qty_delivered || 0) as number,
      toDeliver: 0,
    })))
    setShowDelivery(true)
  }

  const handleDelivery = async () => {
    if (!selectedSO) return
    const yr = new Date().getFullYear().toString().slice(-2)
    const mo = (new Date().getMonth() + 1).toString().padStart(2, '0')
    const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    const docNum = `REM-${yr}${mo}-${seq}`

    const { data: dn, error } = await supabase.from('tt_delivery_notes').insert({
      company_id: selectedSO.company_id || null,
      client_id: selectedSO.client_id,
      sales_order_id: selectedSO.id,
      doc_number: docNum,
      status: 'pending',
    }).select().single()

    if (error || !dn) { addToast({ type: 'error', title: 'Error', message: error?.message }); return }

    for (const l of deliveryLines) {
      if (l.toDeliver > 0) {
        await supabase.from('tt_dn_items').insert({ delivery_note_id: dn.id, so_item_id: l.id, quantity: l.toDeliver })
        await supabase.from('tt_so_items').update({ qty_delivered: l.delivered + l.toDeliver }).eq('id', l.id)
      }
    }

    // Check if fully delivered
    const { data: items } = await supabase.from('tt_so_items').select('qty_ordered, quantity, qty_delivered').eq('sales_order_id', selectedSO.id)
    const allDelivered = (items || []).every((it: Record<string, unknown>) => ((it.qty_delivered as number) || 0) >= ((it.qty_ordered as number) || (it.quantity as number) || 0))
    const st = allDelivered ? 'fully_delivered' : 'partially_delivered'

    await supabase.from('tt_sales_orders').update({ status: st }).eq('id', selectedSO.id)
    await supabase.from('tt_activity_log').insert({ entity_type: 'delivery_note', entity_id: dn.id, action: 'created', detail: `Remito ${docNum} creado` })

    addToast({ type: 'success', title: 'Remito generado', message: docNum })
    setShowDelivery(false)
    load()
  }

  const handleInvoice = async (so: SO) => {
    const yr = new Date().getFullYear().toString().slice(-2)
    const mo = (new Date().getMonth() + 1).toString().padStart(2, '0')
    const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    const docNum = `FAC-${yr}${mo}-${seq}`

    const { data: inv, error } = await supabase.from('tt_invoices').insert({
      company_id: so.company_id || null,
      client_id: so.client_id,
      sales_order_id: so.id,
      doc_number: docNum,
      status: 'draft',
      currency: so.currency || 'EUR',
      subtotal: so.subtotal || 0,
      tax_amount: so.tax_amount || 0,
      total: so.total || 0,
    }).select().single()

    if (error) { addToast({ type: 'error', title: 'Error', message: error.message }); return }

    await supabase.from('tt_sales_orders').update({ status: 'fully_invoiced' }).eq('id', so.id)
    await supabase.from('tt_activity_log').insert({ entity_type: 'invoice', entity_id: inv?.id, action: 'created', detail: `Factura ${docNum} creada` })

    addToast({ type: 'success', title: 'Factura generada', message: docNum })
    setShowDetail(false)
    load()
  }

  const totalSOs = orders.length
  const openCount = orders.filter(o => o.status === 'open').length
  const deliveredCount = orders.filter(o => ((o.status as string) || '').includes('deliver')).length
  const totalVal = orders.reduce((s, o) => s + ((o.total as number) || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Ventas</h1>
          <p className="text-sm text-[#6B7280] mt-1">Pedidos de venta y documentos asociados</p>
        </div>
        <Button onClick={() => { setShowCreate(true); loadCreateData() }}><Plus size={16} /> Nuevo Pedido</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total pedidos" value={totalSOs} icon={<Receipt size={22} />} />
        <KPICard label="Abiertos" value={openCount} icon={<Clock size={22} />} color="#3B82F6" />
        <KPICard label="Entregados" value={deliveredCount} icon={<Truck size={22} />} color="#10B981" />
        <KPICard label="Valor total" value={formatCurrency(totalVal)} icon={<CreditCard size={22} />} color="#F59E0B" />
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar placeholder="Buscar por nro de pedido..." value={search} onChange={setSearch} className="flex-1" />
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
            <Receipt size={48} className="mx-auto mb-3 opacity-30" />
            <p>No hay pedidos de venta</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nro</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((so) => {
                const cfg = STATUS_MAP[(so.status as string) || 'open']
                const clientName = (so.tt_clients as Record<string, unknown>)?.name as string || '-'
                return (
                  <TableRow key={so.id as string}>
                    <TableCell><span className="font-mono text-xs text-[#FF6600]">{so.doc_number as string}</span></TableCell>
                    <TableCell><span className="text-[#F0F2F5]">{clientName}</span></TableCell>
                    <TableCell><Badge variant={cfg?.variant || 'default'}>{cfg?.label || (so.status as string)}</Badge></TableCell>
                    <TableCell>{formatCurrency((so.total as number) || 0)}</TableCell>
                    <TableCell className="text-sm">{so.created_at ? formatDate(so.created_at as string) : '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(so)}><Eye size={14} /></Button>
                        {(so.status === 'open' || so.status === 'partially_delivered') && (
                          <Button variant="ghost" size="sm" onClick={() => openDelivery(so)} title="Generar remito"><Truck size={14} /></Button>
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
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Pedido de Venta" size="xl">
        <div className="space-y-6">
          {/* From quote */}
          <div className="p-4 rounded-lg bg-[#0F1218] border border-[#1E2330]">
            <h3 className="text-sm font-semibold text-[#F0F2F5] mb-3">Desde cotización existente</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Select
                  label="Cotización"
                  options={quotes.map(q => ({ value: q.id as string, label: `${q.doc_number || q.id} - $${q.total}` }))}
                  value={selectedQuote}
                  onChange={(e) => setSelectedQuote(e.target.value)}
                  placeholder="Seleccioná una cotización"
                />
              </div>
              <Button onClick={handleCreateFromQuote} loading={saving} disabled={!selectedQuote}>
                <ArrowRight size={14} /> Crear desde COT
              </Button>
            </div>
          </div>

          <div className="relative text-center"><span className="text-xs text-[#4B5563] bg-[#141820] px-3 relative z-10">o crear desde cero</span><div className="absolute top-1/2 left-0 right-0 h-px bg-[#1E2330]" /></div>

          {/* From scratch */}
          <div className="space-y-4">
            <Select
              label="Cliente"
              options={clients.map(c => ({ value: c.id as string, label: c.name as string }))}
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              placeholder="Seleccioná un cliente"
            />
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#9CA3AF]">Items</span>
                <Button variant="ghost" size="sm" onClick={() => setNewLines([...newLines, { product_id: '', name: '', qty: 1, price: 0 }])}><Plus size={14} /> Agregar</Button>
              </div>
              {newLines.map((l, i) => (
                <div key={i} className="flex gap-2 mb-2 items-end">
                  <div className="flex-1">
                    <Select
                      options={products.map(p => ({ value: p.id as string, label: `${p.sku || ''} - ${p.name}` }))}
                      value={l.product_id}
                      onChange={(e) => {
                        const u = [...newLines]
                        const p = products.find(pr => pr.id === e.target.value)
                        if (p) u[i] = { ...u[i], product_id: p.id as string, name: (p.name || '') as string, price: (p.sell_price || 0) as number }
                        setNewLines(u)
                      }}
                      placeholder="Producto"
                    />
                  </div>
                  <Input type="number" value={l.qty} onChange={(e) => { const u = [...newLines]; u[i].qty = Number(e.target.value); setNewLines(u) }} className="w-20" />
                  <Input type="number" value={l.price} onChange={(e) => { const u = [...newLines]; u[i].price = Number(e.target.value); setNewLines(u) }} className="w-28" />
                  <Button variant="ghost" size="sm" onClick={() => setNewLines(newLines.filter((_, idx) => idx !== i))}><X size={14} /></Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2330]">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreateFromScratch} loading={saving}>Crear Pedido</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── DETAIL ─── */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={`Pedido ${(selectedSO?.doc_number as string) || ''}`} size="lg">
        {selectedSO && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={STATUS_MAP[(selectedSO.status as string) || 'open']?.variant || 'default'}>
                {STATUS_MAP[(selectedSO.status as string) || 'open']?.label || (selectedSO.status as string)}
              </Badge>
              {selectedSO.quote_id ? <Badge variant="info">Desde cotizacion</Badge> : null}
              <span className="text-sm text-[#6B7280]">{selectedSO.created_at ? formatDate(selectedSO.created_at as string) : ''}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Entregado</TableHead>
                  <TableHead>Facturado</TableHead>
                  <TableHead>Pendiente</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soItems.map((it) => {
                  const ordered = (it.qty_ordered || it.quantity || 0) as number
                  const delivered = (it.qty_delivered || 0) as number
                  const invoiced = (it.qty_invoiced || 0) as number
                  return (
                    <TableRow key={it.id as string}>
                      <TableCell>{it.description as string}</TableCell>
                      <TableCell>{ordered}</TableCell>
                      <TableCell><span className={delivered >= ordered ? 'text-emerald-400' : 'text-amber-400'}>{delivered}</span></TableCell>
                      <TableCell>{invoiced}</TableCell>
                      <TableCell>{Math.max(0, ordered - delivered)}</TableCell>
                      <TableCell>{formatCurrency((it.line_total as number) || 0)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <p className="text-right text-lg font-bold text-[#FF6600]">Total: {formatCurrency((selectedSO.total as number) || 0)}</p>
            <div className="flex justify-end gap-2 pt-4 border-t border-[#1E2330]">
              {(selectedSO.status === 'open' || selectedSO.status === 'partially_delivered') && (
                <Button variant="secondary" onClick={() => { setShowDetail(false); openDelivery(selectedSO) }}><Truck size={14} /> Generar Remito</Button>
              )}
              {(selectedSO.status === 'fully_delivered' || selectedSO.status === 'partially_invoiced') && (
                <Button onClick={() => handleInvoice(selectedSO)}><CreditCard size={14} /> Generar Factura</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ─── DELIVERY NOTE ─── */}
      <Modal isOpen={showDelivery} onClose={() => setShowDelivery(false)} title="Generar Remito" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-[#6B7280]">Indicá las cantidades a entregar para cada item</p>
          {deliveryLines.map((l, i) => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0F1218]">
              <div className="flex-1">
                <p className="text-sm text-[#F0F2F5]">{l.desc}</p>
                <p className="text-xs text-[#6B7280]">Pedido: {l.ordered} | Entregado: {l.delivered} | Pend: {l.ordered - l.delivered}</p>
              </div>
              <Input
                type="number"
                value={l.toDeliver}
                onChange={(e) => {
                  const u = [...deliveryLines]
                  u[i].toDeliver = Math.max(0, Math.min(Number(e.target.value), l.ordered - l.delivered))
                  setDeliveryLines(u)
                }}
                className="w-24"
              />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2330]">
            <Button variant="secondary" onClick={() => setShowDelivery(false)}>Cancelar</Button>
            <Button onClick={handleDelivery}><Truck size={16} /> Confirmar Remito</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
