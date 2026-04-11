'use client'

import { cn } from '@/lib/utils'
import { CheckSquare, Square, Clock, AlertTriangle } from 'lucide-react'

export interface PendingTask {
  id: string
  title: string
  type: 'delivery' | 'invoice' | 'purchase' | 'collection' | 'stock' | 'custom'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  dueDate?: string
  assignedTo?: string
  completed: boolean
  documentRef?: string
}

interface PendingTasksCardProps {
  tasks: PendingTask[]
  onToggle?: (taskId: string) => void
  onTaskClick?: (task: PendingTask) => void
}

const priorityColors = {
  urgent: '#FF3D00',
  high: '#FF6600',
  normal: '#4285F4',
  low: '#6B7280',
}

const typeEmoji: Record<string, string> = {
  delivery: '\uD83D\uDE9A',
  invoice: '\uD83D\uDCCB',
  purchase: '\uD83D\uDED2',
  collection: '\uD83D\uDCB0',
  stock: '\uD83D\uDCE6',
  custom: '\u2699\uFE0F',
}

export function PendingTasksCard({ tasks, onToggle, onTaskClick }: PendingTasksCardProps) {
  const pendingCount = tasks.filter((t) => !t.completed).length
  const urgentCount = tasks.filter((t) => !t.completed && (t.priority === 'urgent' || t.priority === 'high')).length

  return (
    <div className="bg-[#141820] rounded-xl border border-[#2A3040] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A3040]">
        <div className="flex items-center gap-2">
          <CheckSquare size={14} className="text-[#FF6600]" />
          <h3 className="text-xs font-bold text-[#F0F2F5] uppercase tracking-wide">
            Tareas pendientes
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {urgentCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#FF3D00]/20 text-[#FF3D00] flex items-center gap-0.5">
              <AlertTriangle size={8} />
              {urgentCount}
            </span>
          )}
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#FF6600]/20 text-[#FF6600] min-w-[18px] text-center">
            {pendingCount}
          </span>
        </div>
      </div>

      {/* Task list */}
      <div className="divide-y divide-[#1E2330]">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              'group flex items-start gap-2.5 px-4 py-2.5 hover:bg-[#1C2230] transition-colors',
              task.completed && 'opacity-50'
            )}
          >
            {/* Checkbox */}
            <button
              className="mt-0.5 shrink-0 text-[#6B7280] hover:text-[#FF6600] transition-colors"
              onClick={() => onToggle?.(task.id)}
            >
              {task.completed ? (
                <CheckSquare size={14} className="text-[#00C853]" />
              ) : (
                <Square size={14} />
              )}
            </button>

            {/* Content */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => onTaskClick?.(task)}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{typeEmoji[task.type]}</span>
                <span
                  className={cn(
                    'text-xs text-[#F0F2F5] truncate',
                    task.completed && 'line-through text-[#6B7280]'
                  )}
                >
                  {task.title}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {task.documentRef && (
                  <span className="text-[9px] text-[#6B7280] font-mono">
                    {task.documentRef}
                  </span>
                )}
                {task.dueDate && (
                  <span className="flex items-center gap-0.5 text-[9px] text-[#6B7280]">
                    <Clock size={8} />
                    {task.dueDate}
                  </span>
                )}
              </div>
            </div>

            {/* Priority indicator */}
            <div
              className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
              style={{ background: priorityColors[task.priority] }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
