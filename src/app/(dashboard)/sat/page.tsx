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
import { formatDate, formatRelative } from '@/lib/utils'
import {
  Wrench, Plus, Eye, Loader2, AlertTriangle, Clock,
  CheckCircle, User, MapPin, Package
} from 'lucide-react'

type Ticket = Record<string, unknown>
type Activity = Record<string, unknown>

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange' }> = {
  open: { label: 'Abierto', variant: 'info' },
  in_progress: { label: 'En progreso', variant: 'warning' },
  waiting_parts: { label: 'Esperando repuestos', variant: 'orange' },
  resolved: { label: 'Resuelto', variant: 'success' },
  closed: { label: 'Cerrado', variant: 'default' },
}

const PRIORITY_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger'; color: string }> = {
  low: { label: 'Baja', variant: 'default', color: '#6B7280' },
  normal: { label: 'Normal', variant: 'success', color: '#10B981' },
  high: { label: 'Alta', variant: 'warning', color: '#F59E0B' },
  urgent: { label: 'Urgente', variant: 'danger', color: '#EF4444' },
}

export default function SATPage() {
  const supabase = createClient()
  const { addToast } = useToast()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [activityLog, setActivityLog] = useState<Activity[]>([])

  // Create form
  const [clients, setClients] = useState<Array<Record<string, unknown>>>([])
  const [allProducts, setAllProducts] = useState<Array<Record<string, unknown>>>([])
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([])
  const [form, setForm] = useState({
    client_id: '', product_id: '', assigned_to: '',
    priority: 'normal', description: '', serial_number: '', work_address: '',
  })
  const [saving, setSaving] = useState(false)

  // Edit fields
  const [diagnosis, setDiagnosis] = useState('')
  const [resolution, setResolution] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('tt_sat_tickets').select('*, tt_clients(name)').order('created_at', { ascending: false })
    if (statusFilter) q = q.eq('status', statusFilter)
    if (priorityFilter) q = q.eq('priority', priorityFilter)
    if (search) q = q.ilike('description', `%${search}%`)
    const { data } = await q
    setTickets(data || [])
    setLoading(false)
  }, [supabase, statusFilter, priorityFilter, search])

  useEffect(() => { load() }, [load])

  const loadFormData = async () => {
    const [{ data: cl }, { data: pr }, { data: us }] = await Promise.all([
      supabase.from('tt_clients').select('id, name').order('name').limit(500),
      supabase.from('tt_products').select('id, sku, name').order('name').limit(500),
      supabase.from('tt_users').select('id, name, email').order('name'),
    ])
    setClients(cl || [])
    setAllProducts(pr || [])
    setUsers(us || [])
  }

  const handleCreate = async () => {
    if (!form.client_id || !form.description.trim()) {
      addToast({ type: 'warning', title: 'Completá los datos', message: 'Cliente y descripción son obligatorios' })
      return
    }
    setSaving(true)

    const yr = new Date().getFullYear().toString().slice(-2)
    const mo = (new Date().getMonth() + 1).toString().padStart(2, '0')
    const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    const ticketNum = `SAT-${yr}${mo}-${seq}`

    const { data: ticket, error } = await supabase.from('tt_sat_tickets').insert({
      ticket_number: ticketNum,
      client_id: form.client_id,
      product_id: form.product_id || null,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      status: 'open',
      description: form.description,
      serial_number: form.serial_number || null,
      work_address: form.work_address || null,
      diagnosis: null,
      resolution: null,
    }).select().single()

    if (error || !ticket) {
      addToast({ type: 'error', title: 'Error', message: error?.message })
      setSaving(false)
      return
    }

    await supabase.from('tt_activity_log').insert({
      entity_type: 'sat_ticket', entity_id: ticket.id, action: 'created',
      detail: `Ticket ${ticketNum} creado. Prioridad: ${form.priority}`,
    })

    addToast({ type: 'success', title: 'Ticket creado', message: ticketNum })
    setShowCreate(false)
    setForm({ client_id: '', product_id: '', assigned_to: '', priority: 'normal', description: '', serial_number: '', work_address: '' })
    load()
    setSaving(false)
  }

  const openDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setDiagnosis((ticket.diagnosis as string) || '')
    setResolution((ticket.resolution as string) || '')

    const { data } = await supabase
      .from('tt_activity_log')
      .select('*')
      .eq('entity_type', 'sat_ticket')
      .eq('entity_id', ticket.id)
      .order('created_at', { ascending: false })

    setActivityLog(data || [])
    setShowDetail(true)
  }

  const updateTicketField = async (field: string, value: string) => {
    if (!selectedTicket) return
    await supabase.from('tt_sat_tickets').update({ [field]: value }).eq('id', selectedTicket.id)
    await supabase.from('tt_activity_log').insert({
      entity_type: 'sat_ticket', entity_id: selectedTicket.id as string,
      action: 'updated', detail: `Campo ${field} actualizado`,
    })
    addToast({ type: 'success', title: 'Actualizado' })
  }

  const changeStatus = async (newStatus: string) => {
    if (!selectedTicket) return
    await supabase.from('tt_sat_tickets').update({ status: newStatus }).eq('id', selectedTicket.id)
    await supabase.from('tt_activity_log').insert({
      entity_type: 'sat_ticket', entity_id: selectedTicket.id as string,
      action: 'status_changed', detail: `Estado cambiado a ${newStatus}`,
    })
    addToast({ type: 'success', title: 'Estado actualizado' })
    setShowDetail(false)
    load()
  }

  const openCount = tickets.filter(t => t.status === 'open').length
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length
  const urgentCount = tickets.filter(t => t.priority === 'urgent' || t.priority === 'high').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">SAT - Servicio Técnico</h1>
          <p className="text-sm text-[#6B7280] mt-1">Gestión de tickets de servicio y reparación</p>
        </div>
        <Button onClick={() => { setShowCreate(true); loadFormData() }}><Plus size={16} /> Nuevo Ticket</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total tickets" value={tickets.length} icon={<Wrench size={22} />} />
        <KPICard label="Abiertos" value={openCount} icon={<Clock size={22} />} color="#3B82F6" />
        <KPICard label="En progreso" value={inProgressCount} icon={<Wrench size={22} />} color="#F59E0B" />
        <KPICard label="Urgentes/Altos" value={urgentCount} icon={<AlertTriangle size={22} />} color="#EF4444" />
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar placeholder="Buscar tickets..." value={search} onChange={setSearch} className="flex-1" />
          <Select
            options={[{ value: '', label: 'Estado' }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Select
            options={[{ value: '', label: 'Prioridad' }, ...Object.entries(PRIORITY_MAP).map(([k, v]) => ({ value: k, label: v.label }))]}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[#FF6600]" size={32} /></div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 text-[#6B7280]">
            <Wrench size={48} className="mx-auto mb-3 opacity-30" />
            <p>No hay tickets de servicio</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nro</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => {
                const st = STATUS_MAP[(t.status as string) || 'open']
                const pr = PRIORITY_MAP[(t.priority as string) || 'normal']
                const clientName = (t.tt_clients as Record<string, unknown>)?.name as string || '-'
                return (
                  <TableRow key={t.id as string}>
                    <TableCell><span className="font-mono text-xs text-[#FF6600]">{(t.ticket_number as string) || ''}</span></TableCell>
                    <TableCell><span className="text-[#F0F2F5]">{clientName}</span></TableCell>
                    <TableCell><span className="text-sm text-[#9CA3AF] truncate block max-w-[200px]">{(t.description as string) || ''}</span></TableCell>
                    <TableCell><Badge variant={pr.variant}>{pr.label}</Badge></TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell className="text-sm">{t.created_at ? formatDate(t.created_at as string) : '-'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(t)}><Eye size={14} /></Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ─── CREATE ─── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Ticket SAT" size="lg">
        <div className="space-y-4">
          <Select
            label="Cliente *"
            options={clients.map(c => ({ value: c.id as string, label: c.name as string }))}
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            placeholder="Seleccioná un cliente"
          />
          <Select
            label="Producto / Equipo"
            options={allProducts.map(p => ({ value: p.id as string, label: `${p.sku || ''} - ${p.name}` }))}
            value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            placeholder="Opcional"
          />
          <Input label="Nro de serie" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="Número de serie del equipo" />
          <Select
            label="Técnico asignado"
            options={users.map(u => ({ value: u.id as string, label: `${u.name} (${u.email})` }))}
            value={form.assigned_to}
            onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            placeholder="Sin asignar"
          />
          <Select
            label="Prioridad"
            options={Object.entries(PRIORITY_MAP).map(([k, v]) => ({ value: k, label: v.label }))}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          />
          <Input label="Dirección de trabajo" value={form.work_address} onChange={(e) => setForm({ ...form, work_address: e.target.value })} placeholder="Dirección donde se realiza el servicio" />
          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">Descripción del problema *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full h-24 rounded-lg bg-[#1E2330] border border-[#2A3040] px-3 py-2 text-sm text-[#F0F2F5] placeholder:text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
              placeholder="Describí el problema o servicio requerido..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2330]">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Crear Ticket</Button>
          </div>
        </div>
      </Modal>

      {/* ─── DETAIL ─── */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={`Ticket ${(selectedTicket?.ticket_number as string) || ''}`} size="xl">
        {selectedTicket && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={STATUS_MAP[(selectedTicket.status as string) || 'open'].variant} size="md">
                {STATUS_MAP[(selectedTicket.status as string) || 'open'].label}
              </Badge>
              <Badge variant={PRIORITY_MAP[(selectedTicket.priority as string) || 'normal'].variant} size="md">
                {PRIORITY_MAP[(selectedTicket.priority as string) || 'normal'].label}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-[#0F1218] space-y-2">
                <div className="flex items-center gap-2 text-sm text-[#6B7280]"><User size={14} /> Cliente</div>
                <p className="text-sm text-[#F0F2F5]">{((selectedTicket.tt_clients as Record<string, unknown>)?.name as string) || '-'}</p>
              </div>
              {selectedTicket.serial_number ? (
                <div className="p-3 rounded-lg bg-[#0F1218] space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[#6B7280]"><Package size={14} /> Nro de serie</div>
                  <p className="text-sm text-[#F0F2F5] font-mono">{String(selectedTicket.serial_number)}</p>
                </div>
              ) : null}
              {selectedTicket.work_address ? (
                <div className="p-3 rounded-lg bg-[#0F1218] space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[#6B7280]"><MapPin size={14} /> Dirección</div>
                  <p className="text-sm text-[#F0F2F5]">{String(selectedTicket.work_address)}</p>
                </div>
              ) : null}
            </div>

            <div>
              <p className="text-sm font-medium text-[#9CA3AF] mb-1">Descripción</p>
              <p className="text-sm text-[#D1D5DB] whitespace-pre-wrap">{selectedTicket.description as string}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">Diagnóstico</label>
                <textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  onBlur={() => updateTicketField('diagnosis', diagnosis)}
                  className="w-full h-20 rounded-lg bg-[#1E2330] border border-[#2A3040] px-3 py-2 text-sm text-[#F0F2F5] focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                  placeholder="Diagnóstico del técnico..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">Resolución</label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  onBlur={() => updateTicketField('resolution', resolution)}
                  className="w-full h-20 rounded-lg bg-[#1E2330] border border-[#2A3040] px-3 py-2 text-sm text-[#F0F2F5] focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                  placeholder="Resolución aplicada..."
                />
              </div>
            </div>

            {/* Activity Timeline */}
            {activityLog.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[#9CA3AF] mb-3">Historial de actividad</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activityLog.map((a) => (
                    <div key={a.id as string} className="flex items-start gap-3 p-2 rounded-lg bg-[#0F1218]">
                      <div className="w-2 h-2 rounded-full bg-[#FF6600] mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#D1D5DB]">{a.detail as string}</p>
                        <p className="text-[10px] text-[#4B5563]">{a.created_at ? formatRelative(a.created_at as string) : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status actions */}
            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-[#1E2330]">
              {(selectedTicket.status as string) === 'open' && (
                <Button variant="secondary" onClick={() => changeStatus('in_progress')}>Iniciar Trabajo</Button>
              )}
              {(selectedTicket.status as string) === 'in_progress' && (
                <>
                  <Button variant="secondary" onClick={() => changeStatus('waiting_parts')}>Esperando Repuestos</Button>
                  <Button onClick={() => changeStatus('resolved')}><CheckCircle size={14} /> Marcar Resuelto</Button>
                </>
              )}
              {(selectedTicket.status as string) === 'waiting_parts' && (
                <Button variant="secondary" onClick={() => changeStatus('in_progress')}>Retomar Trabajo</Button>
              )}
              {(selectedTicket.status as string) === 'resolved' && (
                <Button onClick={() => changeStatus('closed')}>Cerrar Ticket</Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
