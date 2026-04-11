'use client'

import { cn } from '@/lib/utils'
import { Truck, FileText, Banknote, CheckCircle2 } from 'lucide-react'

interface ItemStatus {
  label: string
  color: string
}

interface DeliveryProgressCardProps {
  clientName: string
  deliveredPct: number
  invoicedPct: number
  collectedPct: number
  itemStatuses: ItemStatus[]
  ocRef?: string
}

function ProgressBar({ label, pct, color, icon }: { label: string; pct: number; color: string; icon: React.ReactNode }) {
  const totalBlocks = 10
  const filledBlocks = Math.round((pct / 100) * totalBlocks)
  const isComplete = pct >= 100

  return (
    <div className="flex items-center gap-2">
      <div className="text-[#6B7280] shrink-0">{icon}</div>
      <span className="text-[10px] text-[#9CA3AF] w-[65px] shrink-0">{label}</span>
      <div className="flex gap-[2px] flex-1">
        {Array.from({ length: totalBlocks }).map((_, i) => (
          <div
            key={i}
            className="h-3 flex-1 rounded-sm transition-all duration-300"
            style={{
              background: i < filledBlocks ? color : '#1E2330',
              opacity: i < filledBlocks ? 1 : 0.5,
            }}
          />
        ))}
      </div>
      <span
        className="text-xs font-bold w-[42px] text-right shrink-0"
        style={{ color: isComplete ? '#00C853' : color }}
      >
        {isComplete ? (
          <CheckCircle2 size={14} className="inline text-[#00C853]" />
        ) : (
          `${pct}%`
        )}
      </span>
    </div>
  )
}

export function DeliveryProgressCard({
  clientName,
  deliveredPct,
  invoicedPct,
  collectedPct,
  itemStatuses,
  ocRef,
}: DeliveryProgressCardProps) {
  return (
    <div className="bg-[#141820] rounded-xl border border-[#2A3040] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-[#F0F2F5] uppercase tracking-wide">
          Entregas en curso
        </h3>
        {ocRef && (
          <span className="text-[10px] text-[#6B7280] font-mono">{ocRef}</span>
        )}
      </div>

      {/* Client name */}
      <p className="text-sm font-semibold text-[#F0F2F5] mb-3">{clientName}</p>

      {/* Progress bars */}
      <div className="space-y-2">
        <ProgressBar
          label="Entregado"
          pct={deliveredPct}
          color="#00C853"
          icon={<Truck size={12} />}
        />
        <ProgressBar
          label="Facturado"
          pct={invoicedPct}
          color="#EC4899"
          icon={<FileText size={12} />}
        />
        <ProgressBar
          label="Cobrado"
          pct={collectedPct}
          color="#10B981"
          icon={<Banknote size={12} />}
        />
      </div>

      {/* Item status pills */}
      {itemStatuses.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#1E2330]">
          {itemStatuses.map((item, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: `${item.color}20`,
                color: item.color,
              }}
            >
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
