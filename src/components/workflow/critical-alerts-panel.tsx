'use client'

import { cn } from '@/lib/utils'
import { AlertTriangle, X, Clock, ChevronRight } from 'lucide-react'

export interface Alert {
  id: string
  type: string
  severity: 'info' | 'warning' | 'urgent' | 'critical'
  title: string
  description?: string
  documentRef?: string
  dueDate?: string
  status: string
}

interface CriticalAlertsPanelProps {
  alerts: Alert[]
  onAlertClick?: (alert: Alert) => void
  onDismiss?: (alertId: string) => void
}

const severityConfig = {
  critical: { bg: 'rgba(255,61,0,0.12)', border: '#FF3D00', text: '#FF3D00', icon: '\u26A0\uFE0F' },
  urgent: { bg: 'rgba(255,61,0,0.08)', border: '#FF6B35', text: '#FF6B35', icon: '\u26A0\uFE0F' },
  warning: { bg: 'rgba(255,179,0,0.08)', border: '#FFB300', text: '#FFB300', icon: '\u26A0' },
  info: { bg: 'rgba(66,133,244,0.08)', border: '#4285F4', text: '#4285F4', icon: '\u2139\uFE0F' },
}

export function CriticalAlertsPanel({ alerts, onAlertClick, onDismiss }: CriticalAlertsPanelProps) {
  const activeAlerts = alerts.filter((a) => a.status === 'active')

  if (activeAlerts.length === 0) return null

  return (
    <div className="bg-[#141820] rounded-xl border border-[#2A3040] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A3040]">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#FF3D00]" />
          <h3 className="text-xs font-bold text-[#F0F2F5] uppercase tracking-wide">
            Alertas
          </h3>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#FF3D00] text-white min-w-[18px] text-center">
            {activeAlerts.length}
          </span>
        </div>
      </div>

      {/* Alert list */}
      <div className="divide-y divide-[#1E2330]">
        {activeAlerts.map((alert) => {
          const config = severityConfig[alert.severity]
          return (
            <div
              key={alert.id}
              className="group flex items-start gap-3 px-4 py-3 hover:bg-[#1C2230] transition-colors cursor-pointer"
              onClick={() => onAlertClick?.(alert)}
              style={{ borderLeft: `3px solid ${config.border}` }}
            >
              <span className="text-sm mt-0.5 shrink-0">{config.icon}</span>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#F0F2F5] truncate">
                  {alert.title}
                </p>
                {alert.description && (
                  <p className="text-[10px] text-[#6B7280] mt-0.5 line-clamp-2">
                    {alert.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {alert.documentRef && (
                    <span className="text-[10px] text-[#9CA3AF] font-mono">
                      {alert.documentRef}
                    </span>
                  )}
                  {alert.dueDate && (
                    <span className="flex items-center gap-0.5 text-[10px]" style={{ color: config.text }}>
                      <Clock size={9} />
                      {alert.dueDate}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <ChevronRight
                  size={12}
                  className="text-[#6B7280] opacity-0 group-hover:opacity-100 transition-opacity"
                />
                {onDismiss && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDismiss(alert.id)
                    }}
                    className="p-1 rounded hover:bg-[#2A3040] text-[#6B7280] hover:text-[#F0F2F5] opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
