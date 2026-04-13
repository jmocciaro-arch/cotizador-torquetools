'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { WorkflowArrowBar, type WorkflowStep } from './workflow-arrow-bar'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronRight, MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { ProcessInstance, ProcessStage } from '@/types/process'
import { useRouter } from 'next/navigation'

// Icon map: stage definition icon name → emoji/unicode
const ICON_MAP: Record<string, string> = {
  UserPlus: '👤', Search: '🔍', FileText: '📄', Send: '📤',
  MessageSquare: '💬', ShoppingCart: '🛒', Truck: '🚚', CreditCard: '💳',
  DollarSign: '💰', CheckCircle: '✅', ClipboardList: '📋', Package: '📦',
  Receipt: '🧾', Calendar: '📅', Shield: '🛡️', Globe: '🌍',
  Anchor: '⚓', Warehouse: '🏭', Calculator: '🧮', Wrench: '🔧',
  Gauge: '⚙️', Cog: '⚙️', Bell: '🔔',
}

interface ProcessLineProps {
  /** Process instance ID to display */
  processId: string
  /** Called when user clicks a stage with a linked document */
  onNavigateToDocument?: (documentId: string) => void
  /** Show advance button */
  showAdvanceButton?: boolean
  /** Compact mode (smaller) */
  compact?: boolean
}

export function ProcessLine({ processId, onNavigateToDocument, showAdvanceButton = true, compact = false }: ProcessLineProps) {
  const { addToast } = useToast()
  const router = useRouter()
  const [process, setProcess] = useState<ProcessInstance | null>(null)
  const [stages, setStages] = useState<ProcessStage[]>([])
  const [documents, setDocuments] = useState<Array<{ document_id: string; stage_code: string | null; role: string }>>([])
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [docRefs, setDocRefs] = useState<Record<string, { ref: string; date: string }>>({})

  const loadProcess = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/processes/${processId}`)
      if (!res.ok) throw new Error('Failed to load process')
      const data = await res.json()
      setProcess(data.process)
      setStages(data.stages || [])
      setDocuments(data.documents || [])

      // Load document references for stages that have linked docs
      const docIds = (data.documents || []).map((d: { document_id: string }) => d.document_id).filter(Boolean)
      if (docIds.length > 0) {
        const sb = createClient()
        const { data: docs } = await sb.from('tt_documents').select('id, display_ref, system_code, created_at').in('id', docIds)
        const refs: Record<string, { ref: string; date: string }> = {}
        for (const doc of (docs || [])) {
          refs[doc.id as string] = {
            ref: (doc.display_ref as string) || (doc.system_code as string) || '-',
            date: doc.created_at as string,
          }
        }
        setDocRefs(refs)
      }
    } catch {
      // Silent fail — process might not exist yet
    } finally {
      setLoading(false)
    }
  }, [processId])

  useEffect(() => { loadProcess() }, [loadProcess])

  const handleAdvance = async () => {
    setAdvancing(true)
    try {
      const res = await fetch(`/api/processes/${processId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance_stage' }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error advancing stage')
      }
      addToast({ type: 'success', title: 'Etapa avanzada' })
      loadProcess()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: (err as Error).message })
    } finally {
      setAdvancing(false)
    }
  }

  const handleStepClick = (step: WorkflowStep) => {
    // Find document linked to this stage
    const doc = documents.find(d => d.stage_code === step.key)
    if (doc && onNavigateToDocument) {
      onNavigateToDocument(doc.document_id)
    } else if (doc) {
      router.push(`/documentos/${doc.document_id}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={20} className="animate-spin text-[#FF6600]" />
        <span className="ml-2 text-xs text-[#6B7280]">Cargando proceso...</span>
      </div>
    )
  }

  if (!process || stages.length === 0) return null

  // Map stages to WorkflowStep format
  const steps: WorkflowStep[] = stages.map(stage => {
    const doc = documents.find(d => d.stage_code === stage.code)
    const docRef = doc ? docRefs[doc.document_id] : null

    // Map ProcessStage status to WorkflowStep status
    let stepStatus: WorkflowStep['status'] = 'pending'
    if (stage.status === 'completed') stepStatus = 'completed'
    else if (stage.status === 'in_progress') stepStatus = 'current'
    else if (stage.status === 'blocked') stepStatus = 'blocked'
    else if (stage.status === 'skipped') stepStatus = 'completed' // treat skipped as done visually

    return {
      key: stage.code,
      label: stage.name,
      icon: ICON_MAP[stage.stage_data?.icon as string || ''] || ICON_MAP[stage.code] || '📌',
      status: stepStatus,
      documentRef: docRef?.ref,
      documentId: doc?.document_id,
      date: docRef ? formatDate(docRef.date) : stage.completed_at ? formatDate(stage.completed_at) : undefined,
      tooltip: stage.notes || undefined,
    }
  })

  // Find current stage
  const currentStage = stages.find(s => s.status === 'in_progress')

  return (
    <div className="space-y-2">
      {/* Process header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: process.color_code }} />
          <span className="text-xs font-semibold text-[#9CA3AF]">{process.process_type.replace(/_/g, ' ')}</span>
          <span className="text-xs text-[#4B5563]">—</span>
          <span className="text-xs text-[#F0F2F5]">{process.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#6B7280]">{Math.round(process.progress_percent)}%</span>
          <div className="w-20 h-1.5 rounded-full bg-[#1E2330] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${process.progress_percent}%`, backgroundColor: process.color_code }} />
          </div>
        </div>
      </div>

      {/* Arrow bar */}
      <WorkflowArrowBar steps={steps} onStepClick={handleStepClick} />

      {/* Actions */}
      {showAdvanceButton && currentStage && process.current_status === 'active' && (
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-[#6B7280]">
            Etapa actual: <span className="text-[#FF6600] font-medium">{currentStage.name}</span>
          </span>
          <Button variant="primary" size="sm" onClick={handleAdvance} loading={advancing}>
            <ChevronRight size={14} /> Avanzar etapa
          </Button>
        </div>
      )}

      {process.current_status === 'completed' && (
        <div className="px-2">
          <span className="text-xs text-[#10B981] font-medium">✅ Proceso completado</span>
        </div>
      )}
    </div>
  )
}

// =====================================================
// Helper: Create process for a document if not exists
// =====================================================
export async function ensureProcessForDocument(
  documentId: string,
  processType: string,
  name: string,
  options?: { customer_id?: string; supplier_id?: string; company_id?: string; user_id?: string }
): Promise<string> {
  // Check if document already has a process
  const sb = createClient()
  const { data: doc } = await sb.from('tt_documents').select('process_instance_id').eq('id', documentId).single()

  if (doc?.process_instance_id) return doc.process_instance_id as string

  // Create new process
  const res = await fetch('/api/processes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      process_type: processType,
      name,
      origin_document_id: documentId,
      customer_id: options?.customer_id,
      supplier_id: options?.supplier_id,
      company_id: options?.company_id,
      created_by_user_id: options?.user_id,
    }),
  })

  if (!res.ok) throw new Error('Failed to create process')
  const process = await res.json()
  return process.id
}
