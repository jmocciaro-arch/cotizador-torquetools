'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface WorkflowStep {
  key: string
  label: string
  icon: string
  status: 'completed' | 'current' | 'partial' | 'blocked' | 'pending'
  documentRef?: string
  documentId?: string
  date?: string
  tooltip?: string
}

interface WorkflowArrowBarProps {
  steps: WorkflowStep[]
  onStepClick?: (step: WorkflowStep) => void
}

const statusConfig = {
  completed: { bg: '#00C853', bgLight: 'rgba(0,200,83,0.15)', text: '#00C853', indicator: '\u2713', border: '#00C853' },
  current: { bg: '#4285F4', bgLight: 'rgba(66,133,244,0.15)', text: '#4285F4', indicator: '\u25CF', border: '#4285F4' },
  partial: { bg: '#FFB300', bgLight: 'rgba(255,179,0,0.15)', text: '#FFB300', indicator: '\u25D0', border: '#FFB300' },
  blocked: { bg: '#FF3D00', bgLight: 'rgba(255,61,0,0.15)', text: '#FF3D00', indicator: '\u26A0', border: '#FF3D00' },
  pending: { bg: '#2A3040', bgLight: 'rgba(42,48,64,0.4)', text: '#6B7280', indicator: '\u25CB', border: '#2A3040' },
}

export function WorkflowArrowBar({ steps, onStepClick }: WorkflowArrowBarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center gap-0 min-w-max px-2 py-3">
        {steps.map((step, index) => {
          const config = statusConfig[step.status]
          const isHovered = hoveredIndex === index
          const isLast = index === steps.length - 1

          return (
            <div key={step.key} className="flex items-center">
              {/* Arrow step */}
              <div
                className="relative group cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onStepClick?.(step)}
              >
                {/* Arrow shape using clip-path */}
                <div
                  className={cn(
                    'relative flex items-center gap-2 px-5 py-3 transition-all duration-200',
                    isHovered && 'scale-[1.03]'
                  )}
                  style={{
                    background: isHovered ? config.bg : config.bgLight,
                    clipPath: index === 0
                      ? 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)'
                      : 'polygon(14px 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)',
                    minWidth: '140px',
                    borderTop: `2px solid ${config.border}`,
                    borderBottom: `2px solid ${config.border}`,
                  }}
                >
                  {/* Icon + indicator */}
                  <div className="flex items-center gap-2 pl-1">
                    <span className="text-lg">{step.icon}</span>
                    <span
                      className={cn(
                        'text-xs font-bold',
                        step.status === 'current' && 'animate-pulse'
                      )}
                      style={{ color: isHovered ? '#fff' : config.text }}
                    >
                      {config.indicator}
                    </span>
                  </div>

                  {/* Label */}
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-xs font-semibold truncate"
                      style={{ color: isHovered ? '#fff' : config.text }}
                    >
                      {step.label}
                    </span>
                    {step.documentRef && (
                      <span
                        className="text-[10px] truncate opacity-70"
                        style={{ color: isHovered ? '#fff' : config.text }}
                      >
                        {step.documentRef}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tooltip */}
                {isHovered && (step.tooltip || step.date) && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-fade-in">
                    <div className="bg-[#1C2230] border border-[#2A3040] rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
                      {step.tooltip && (
                        <p className="text-xs text-[#F0F2F5]">{step.tooltip}</p>
                      )}
                      {step.documentRef && (
                        <p className="text-[10px] text-[#6B7280] mt-1">
                          Ref: {step.documentRef}
                        </p>
                      )}
                      {step.date && (
                        <p className="text-[10px] text-[#6B7280]">
                          Fecha: {step.date}
                        </p>
                      )}
                      <p className="text-[10px] mt-1 font-medium" style={{ color: config.text }}>
                        {step.status === 'completed' && 'Completado'}
                        {step.status === 'current' && 'En proceso'}
                        {step.status === 'partial' && 'Parcial'}
                        {step.status === 'blocked' && 'Bloqueado'}
                        {step.status === 'pending' && 'Pendiente'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="w-2 h-[2px] bg-[#2A3040] shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
