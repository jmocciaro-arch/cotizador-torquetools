'use client'

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SearchBar } from '@/components/ui/search-bar'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CRM_STAGES } from '@/lib/utils'
import type { Opportunity, Client, User } from '@/types'
import {
  Plus, Target, Calendar, User as UserIcon, GripVertical,
  Save, Loader2
} from 'lucide-react'

export default function CRMPage() {
  const { addToast } = useToast()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [users, setUsers] = useState<User[]>([])

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null)

  // New opportunity form
  const [newOpp, setNewOpp] = useState({
    title: '', client_name: '', client_id: '', value: 0,
    currency: 'EUR', probability: 50, stage: 'lead' as string,
    assigned_to: '', expected_close_date: '', notes: '',
  })
  const [savingNew, setSavingNew] = useState(false)
  const [clientSearchResults, setClientSearchResults] = useState<Client[]>([])
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const clientDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Edit
  const [editStage, setEditStage] = useState('')
  const [editProbability, setEditProbability] = useState(0)
  const [editNotes, setEditNotes] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    setLoading(true)

    const [oppsRes, usersRes] = await Promise.all([
      supabase
        .from('tt_opportunities')
        .select('*, client:tt_clients(company_name), assignee:tt_users(full_name)')
        .order('sort_order', { ascending: true }),
      supabase
        .from('tt_users')
        .select('*')
        .eq('is_active', true),
    ])

    setOpportunities((oppsRes.data as unknown as Opportunity[]) || [])
    setUsers((usersRes.data as User[]) || [])
    setLoading(false)
  }

  // Search clients for new opportunity
  function handleClientSearch(query: string) {
    setNewOpp((prev) => ({ ...prev, client_name: query }))
    if (!query.trim()) {
      setClientSearchResults([])
      setShowClientDropdown(false)
      return
    }
    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current)
    clientDebounceRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('tt_clients')
        .select('id, company_name')
        .ilike('company_name', `%${query}%`)
        .limit(10)
      setClientSearchResults((data || []) as Client[])
      setShowClientDropdown(true)
    }, 300)
  }

  // Drag and Drop
  function handleDragStart(e: React.DragEvent, oppId: string) {
    setDragId(oppId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, targetStage: string) {
    e.preventDefault()
    if (!dragId) return

    const opp = opportunities.find((o) => o.id === dragId)
    if (!opp || opp.stage === targetStage) {
      setDragId(null)
      return
    }

    // Optimistic update
    setOpportunities((prev) =>
      prev.map((o) => (o.id === dragId ? { ...o, stage: targetStage as Opportunity['stage'] } : o))
    )
    setDragId(null)

    // Save to Supabase
    const supabase = createClient()
    const { error } = await supabase
      .from('tt_opportunities')
      .update({ stage: targetStage, updated_at: new Date().toISOString() })
      .eq('id', opp.id)

    if (error) {
      console.error('Error moviendo oportunidad:', error)
      // Revert
      setOpportunities((prev) =>
        prev.map((o) => (o.id === opp.id ? { ...o, stage: opp.stage } : o))
      )
      addToast({ type: 'error', title: 'Error al mover oportunidad' })
    } else {
      const stageLabel = CRM_STAGES.find((s) => s.id === targetStage)?.label || targetStage
      addToast({ type: 'success', title: `Movido a ${stageLabel}` })

      await supabase.from('tt_activity_log').insert({
        entity_type: 'opportunity',
        entity_id: opp.id,
        action: 'Oportunidad movida',
        description: `${opp.title} -> ${stageLabel}`,
      })
    }
  }

  // Open detail
  function openDetail(opp: Opportunity) {
    setSelectedOpp(opp)
    setEditStage(opp.stage)
    setEditProbability(opp.probability)
    setEditNotes(opp.notes || '')
  }

  // Save edit
  async function saveOppEdit() {
    if (!selectedOpp) return
    setSavingEdit(true)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('tt_opportunities')
        .update({
          stage: editStage,
          probability: editProbability,
          notes: editNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOpp.id)

      if (error) throw error

      setOpportunities((prev) =>
        prev.map((o) =>
          o.id === selectedOpp.id
            ? { ...o, stage: editStage as Opportunity['stage'], probability: editProbability, notes: editNotes }
            : o
        )
      )
      setSelectedOpp(null)
      addToast({ type: 'success', title: 'Oportunidad actualizada' })
    } catch (err) {
      addToast({ type: 'error', title: 'Error al actualizar' })
    } finally {
      setSavingEdit(false)
    }
  }

  // Create new
  async function createOpportunity() {
    if (!newOpp.title.trim()) {
      addToast({ type: 'error', title: 'El titulo es obligatorio' })
      return
    }

    setSavingNew(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from('tt_opportunities').insert({
        title: newOpp.title,
        client_id: newOpp.client_id || null,
        stage: newOpp.stage,
        value: newOpp.value,
        currency: newOpp.currency,
        probability: newOpp.probability,
        assigned_to: newOpp.assigned_to || null,
        expected_close_date: newOpp.expected_close_date || null,
        notes: newOpp.notes || null,
        tags: [],
        sort_order: 0,
      })

      if (error) throw error

      addToast({ type: 'success', title: 'Oportunidad creada', message: newOpp.title })
      setShowNew(false)
      setNewOpp({
        title: '', client_name: '', client_id: '', value: 0,
        currency: 'EUR', probability: 50, stage: 'lead',
        assigned_to: '', expected_close_date: '', notes: '',
      })
      loadData()
    } catch (err) {
      console.error('Error creando oportunidad:', err)
      addToast({ type: 'error', title: 'Error al crear oportunidad' })
    } finally {
      setSavingNew(false)
    }
  }

  // Pipeline calculation
  const pipelineTotal = opportunities
    .filter((o) => o.stage !== 'perdido')
    .reduce((sum, o) => sum + o.value * (o.probability / 100), 0)

  const stageValues = CRM_STAGES.map((stage) => {
    const stageOpps = opportunities.filter((o) => o.stage === stage.id)
    const totalValue = stageOpps.reduce((sum, o) => sum + o.value, 0)
    return { ...stage, opps: stageOpps, totalValue, count: stageOpps.length }
  })

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-[#141820] rounded-lg animate-pulse" />
        <div className="flex gap-4 overflow-x-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-shrink-0 w-[300px]">
              <div className="h-6 w-24 bg-[#141820] rounded mb-3 animate-pulse" />
              <div className="h-48 bg-[#0F1218] border border-[#1E2330] rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Pipeline CRM</h1>
          <p className="text-[#6B7280] mt-1">
            {opportunities.length} oportunidades - Valor ponderado:{' '}
            <span className="text-[#FF6600] font-semibold">{formatCurrency(pipelineTotal, 'EUR')}</span>
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> Nueva Oportunidad
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:-mx-6 lg:px-6">
        {stageValues.map((stage) => (
          <div
            key={stage.id}
            className="flex-shrink-0 w-[300px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                <h3 className="text-sm font-semibold text-[#F0F2F5]">{stage.label}</h3>
                <span className="text-xs text-[#6B7280] bg-[#1E2330] px-1.5 py-0.5 rounded-full">
                  {stage.count}
                </span>
              </div>
              <span className="text-xs text-[#6B7280]">{formatCurrency(stage.totalValue, 'EUR')}</span>
            </div>

            {/* Column Body */}
            <div className="space-y-2 min-h-[200px] p-2 rounded-xl bg-[#0F1218] border border-[#1E2330]">
              {stage.opps.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-[#2A3040]">
                  <p className="text-xs">Sin oportunidades</p>
                </div>
              ) : (
                stage.opps.map((opp) => (
                  <div
                    key={opp.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, opp.id)}
                    onClick={() => openDetail(opp)}
                    className={`p-3 rounded-lg bg-[#141820] border border-[#1E2330] hover:border-[#2A3040] transition-all cursor-pointer group ${
                      dragId === opp.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-[#F0F2F5] line-clamp-2 flex-1">{opp.title}</h4>
                      <GripVertical size={14} className="text-[#2A3040] group-hover:text-[#4B5563] shrink-0 ml-2 cursor-grab" />
                    </div>
                    <p className="text-xs text-[#6B7280] mb-2">
                      {(opp.client as unknown as { company_name: string })?.company_name || 'Sin cliente'}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#FF6600]">
                        {formatCurrency(opp.value, (opp.currency || 'EUR') as 'EUR' | 'ARS' | 'USD')}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1.5 rounded-full bg-[#1E2330] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${opp.probability}%`,
                              backgroundColor:
                                opp.probability >= 70 ? '#10B981' : opp.probability >= 40 ? '#F59E0B' : '#6B7280',
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[#6B7280]">{opp.probability}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1E2330]/50">
                      <div className="flex items-center gap-1 text-[10px] text-[#4B5563]">
                        <UserIcon size={10} />
                        {(opp.assignee as unknown as { full_name: string })?.full_name || '-'}
                      </div>
                      {opp.expected_close_date && (
                        <div className="flex items-center gap-1 text-[10px] text-[#4B5563]">
                          <Calendar size={10} /> {opp.expected_close_date}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Opportunity Detail Modal */}
      <Modal
        isOpen={!!selectedOpp}
        onClose={() => setSelectedOpp(null)}
        title={selectedOpp?.title || ''}
        size="md"
      >
        {selectedOpp && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Cliente</p>
                <p className="text-sm font-medium text-[#F0F2F5]">
                  {(selectedOpp.client as unknown as { company_name: string })?.company_name || '-'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Valor</p>
                <p className="text-sm font-bold text-[#FF6600]">
                  {formatCurrency(selectedOpp.value, (selectedOpp.currency || 'EUR') as 'EUR' | 'ARS' | 'USD')}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Asignado a</p>
                <p className="text-sm text-[#F0F2F5]">
                  {(selectedOpp.assignee as unknown as { full_name: string })?.full_name || '-'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Cierre esperado</p>
                <p className="text-sm text-[#F0F2F5]">{selectedOpp.expected_close_date || '-'}</p>
              </div>
            </div>

            <Select
              label="Etapa"
              options={CRM_STAGES.map((s) => ({ value: s.id, label: s.label }))}
              value={editStage}
              onChange={(e) => setEditStage(e.target.value)}
            />

            <Input
              label="Probabilidad (%)"
              type="number"
              min={0}
              max={100}
              value={editProbability}
              onChange={(e) => setEditProbability(Number(e.target.value))}
            />

            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">Notas</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg bg-[#1E2330] border border-[#2A3040] px-3 py-2 text-sm text-[#F0F2F5] placeholder:text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                placeholder="Notas sobre la oportunidad..."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1" onClick={saveOppEdit} loading={savingEdit}>
                <Save size={14} /> Guardar cambios
              </Button>
              <Button variant="secondary" onClick={() => setSelectedOpp(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Opportunity Modal */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Nueva Oportunidad" size="md">
        <div className="space-y-4">
          <Input
            label="Titulo *"
            placeholder="Ej: FEIN Tools para linea de ensamblaje"
            value={newOpp.title}
            onChange={(e) => setNewOpp({ ...newOpp, title: e.target.value })}
          />

          <div className="relative">
            <Input
              label="Cliente"
              placeholder="Buscar cliente..."
              value={newOpp.client_name}
              onChange={(e) => handleClientSearch(e.target.value)}
            />
            {showClientDropdown && clientSearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#141820] border border-[#1E2330] rounded-lg shadow-xl z-10 max-h-36 overflow-y-auto">
                {clientSearchResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setNewOpp({ ...newOpp, client_id: c.id, client_name: c.company_name })
                      setShowClientDropdown(false)
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#1E2330] text-sm text-[#F0F2F5]"
                  >
                    {c.company_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valor estimado"
              type="number"
              placeholder="45000"
              value={newOpp.value || ''}
              onChange={(e) => setNewOpp({ ...newOpp, value: Number(e.target.value) })}
            />
            <Select
              label="Moneda"
              value={newOpp.currency}
              onChange={(e) => setNewOpp({ ...newOpp, currency: e.target.value })}
              options={[
                { value: 'EUR', label: 'EUR' },
                { value: 'USD', label: 'USD' },
                { value: 'ARS', label: 'ARS' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Probabilidad (%)"
              type="number"
              min={0}
              max={100}
              placeholder="50"
              value={newOpp.probability || ''}
              onChange={(e) => setNewOpp({ ...newOpp, probability: Number(e.target.value) })}
            />
            <Input
              label="Fecha cierre esperado"
              type="date"
              value={newOpp.expected_close_date}
              onChange={(e) => setNewOpp({ ...newOpp, expected_close_date: e.target.value })}
            />
          </div>

          <Select
            label="Asignar a"
            value={newOpp.assigned_to}
            onChange={(e) => setNewOpp({ ...newOpp, assigned_to: e.target.value })}
            options={users.map((u) => ({ value: u.id, label: u.full_name }))}
            placeholder="Seleccionar..."
          />

          <Select
            label="Etapa inicial"
            value={newOpp.stage}
            onChange={(e) => setNewOpp({ ...newOpp, stage: e.target.value })}
            options={CRM_STAGES.map((s) => ({ value: s.id, label: s.label }))}
          />

          <div>
            <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">Notas</label>
            <textarea
              value={newOpp.notes}
              onChange={(e) => setNewOpp({ ...newOpp, notes: e.target.value })}
              rows={2}
              className="w-full rounded-lg bg-[#1E2330] border border-[#2A3040] px-3 py-2 text-sm text-[#F0F2F5] placeholder:text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
              placeholder="Notas..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button variant="primary" onClick={createOpportunity} loading={savingNew}>
              <Save size={14} /> Crear Oportunidad
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
