import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: React.ReactNode
  color?: string
  className?: string
}

export function KPICard({ label, value, change, changeLabel, icon, color = '#FF6600', className }: KPICardProps) {
  const isPositive = change !== undefined && change >= 0

  return (
    <div
      className={cn(
        'rounded-xl bg-[#141820] border border-[#1E2330] p-5 hover:border-[#2A3040] transition-all duration-200',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-[#6B7280] mb-1">{label}</p>
          <p className="text-2xl font-bold text-[#F0F2F5]">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {isPositive ? (
                <TrendingUp size={14} className="text-emerald-400" />
              ) : (
                <TrendingDown size={14} className="text-red-400" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  isPositive ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {isPositive ? '+' : ''}
                {change}%
              </span>
              {changeLabel && (
                <span className="text-xs text-[#4B5563] ml-1">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        <div
          className="p-3 rounded-xl"
          style={{ backgroundColor: `${color}15` }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
    </div>
  )
}
