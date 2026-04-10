'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency, CRM_STAGES } from '@/lib/utils'
import { Plus, Target, DollarSign, Calendar, User, GripVertical } from 'lucide-react'

interface Opportunity {
  id: string
  title: string
  client: string
  value: number
  currency: 'EUR' | 'ARS' | 'USD'
  probability: number
  stage: string
  assignee: string
  expectedClose: string
}

const demoOpportunities: Opportunity[] = [
  { id: '1', title: 'FEIN Tools para línea de ensamblaje', client: 'Seat Martorell', value: 45000, currency: 'EUR', probability: 60, stage: 'propuesta', assignee: 'Juan', expectedClose: '2026-05-15' },
  { id: '2', title: 'Torquímetros Tohnichi - calibración', client: 'Airbus Getafe', value: 128000, currency: 'EUR', probability: 80, stage: 'negociacion', assignee: 'Juan', expectedClose: '2026-04-30' },
  { id: '3', title: 'Taladros magnéticos SpeeDrill', client: 'John Deere Ibérica', value: 32000, currency: 'EUR', probability: 40, stage: 'lead', assignee: 'Facu', expectedClose: '2026-06-01' },
  { id: '4', title: 'Soldadoras Tecna x5', client: 'Volkswagen Navarra', value: 21000, currency: 'EUR', probability: 90, stage: 'ganado', assignee: 'Norber', expectedClose: '2026-04-10' },
  { id: '5', title: 'Kit de atornilladores FIAM', client: 'Toyota Argentina', value: 18500, currency: 'USD', probability: 30, stage: 'lead', assignee: 'Jano', expectedClose: '2026-07-01' },
  { id: '6', title: 'Ingersoll Rand impact wrenches', client: 'Boeing Houston Division', value: 89000, currency: 'USD', probability: 50, stage: 'propuesta', assignee: 'Juan', expectedClose: '2026-05-20' },
  { id: '7', title: 'Renovación contrato herramientas', client: 'Renault Argentina', value: 15000, currency: 'USD', probability: 10, stage: 'perdido', assignee: 'Facu', expectedClose: '2026-03-15' },
]

export default function CRMPage() {
  const [opportunities, setOpportunities] = useState(demoOpportunities)
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)
  const [showNew, setShowNew] = useState(false)

  const stageValues = CRM_STAGES.map(stage => {
    const stageOpps = opportunities.filter(o => o.stage === stage.id)
    const totalValue = stageOpps.reduce((sum, o) => sum + o.value, 0)
    return { ...stage, opps: stageOpps, totalValue, count: stageOpps.length }
  })

  const pipelineTotal = opportunities
    .filter(o => o.stage !== 'perdido')
    .reduce((sum, o) => sum + o.value * (o.probability / 100), 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Pipeline CRM</h1>
          <p className="text-[#6B7280] mt-1">
            Valor ponderado: <span className="text-[#FF6600] font-semibold">{formatCurrency(pipelineTotal, 'EUR')}</span>
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> Nueva Oportunidad
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:-mx-6 lg:px-6">
        {stageValues.map(stage => (
          <div key={stage.id} className="flex-shrink-0 w-[300px]">
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                <h3 className="text-sm font-semibold text-[#F0F2F5]">{stage.label}</h3>
                <span className="text-xs text-[#6B7280] bg-[#1E2330] px-1.5 py-0.5 rounded-full">{stage.count}</span>
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
                stage.opps.map(opp => (
                  <div
                    key={opp.id}
                    onClick={() => setSelectedOpp(opp)}
                    className="kanban-card p-3 rounded-lg bg-[#141820] border border-[#1E2330] hover:border-[#2A3040] transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-[#F0F2F5] line-clamp-2 flex-1">{opp.title}</h4>
                      <GripVertical size={14} className="text-[#2A3040] group-hover:text-[#4B5563] shrink-0 ml-2" />
                    </div>
                    <p className="text-xs text-[#6B7280] mb-2">{opp.client}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#FF6600]">
                        {formatCurrency(opp.value, opp.currency)}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1.5 rounded-full bg-[#1E2330] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${opp.probability}%`,
                              backgroundColor: opp.probability >= 70 ? '#10B981' : opp.probability >= 40 ? '#F59E0B' : '#6B7280',
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[#6B7280]">{opp.probability}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1E2330]/50">
                      <div className="flex items-center gap-1 text-[10px] text-[#4B5563]">
                        <User size={10} /> {opp.assignee}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-[#4B5563]">
                        <Calendar size={10} /> {opp.expectedClose}
                      </div>
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
                <p className="text-sm font-medium text-[#F0F2F5]">{selectedOpp.client}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Valor</p>
                <p className="text-sm font-bold text-[#FF6600]">{formatCurrency(selectedOpp.value, selectedOpp.currency)}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Probabilidad</p>
                <p className="text-sm text-[#F0F2F5]">{selectedOpp.probability}%</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Cierre esperado</p>
                <p className="text-sm text-[#F0F2F5]">{selectedOpp.expectedClose}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Asignado a</p>
                <p className="text-sm text-[#F0F2F5]">{selectedOpp.assignee}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Etapa</p>
                <Badge variant="orange">{CRM_STAGES.find(s => s.id === selectedOpp.stage)?.label}</Badge>
              </div>
            </div>

            <Select
              label="Mover a etapa"
              options={CRM_STAGES.map(s => ({ value: s.id, label: s.label }))}
              value={selectedOpp.stage}
              onChange={(e) => {
                const newStage = e.target.value
                setOpportunities(prev => prev.map(o => o.id === selectedOpp.id ? { ...o, stage: newStage } : o))
                setSelectedOpp({ ...selectedOpp, stage: newStage })
              }}
            />

            <div className="flex gap-2 pt-2">
              <Button variant="primary" className="flex-1">Crear Cotización</Button>
              <Button variant="secondary">Editar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Opportunity Modal */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Nueva Oportunidad" size="md">
        <div className="space-y-4">
          <Input label="Título" placeholder="Ej: FEIN Tools para línea de ensamblaje" />
          <Input label="Cliente" placeholder="Buscar cliente..." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor estimado" type="number" placeholder="45000" />
            <Select
              label="Moneda"
              options={[
                { value: 'EUR', label: 'EUR' },
                { value: 'USD', label: 'USD' },
                { value: 'ARS', label: 'ARS' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Probabilidad (%)" type="number" placeholder="50" />
            <Input label="Fecha cierre esperado" type="date" />
          </div>
          <Select
            label="Asignar a"
            options={[
              { value: 'juan', label: 'Juan' },
              { value: 'facu', label: 'Facu' },
              { value: 'norber', label: 'Norber' },
              { value: 'jano', label: 'Jano' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button variant="primary">Crear Oportunidad</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
