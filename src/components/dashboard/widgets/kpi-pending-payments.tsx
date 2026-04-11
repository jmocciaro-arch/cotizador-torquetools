'use client'

import { useState, useEffect } from 'react'
import { CreditCard, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { WidgetSkeleton, WidgetError } from '../widget-wrapper'

export function KpiPendingPayments() {
  const [totalPending, setTotalPending] = useState(0)
  const [dueThisWeek, setDueThisWeek] = useState(0)
  const [hasOverdue, setHasOverdue] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const today = new Date().toISOString().split('T')[0]
        const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

        // Total pending
        const { data: pending } = await supabase
          .from('tt_purchase_invoices')
          .select('total, due_date')
          .neq('status', 'paid')

        const pendingInvs = pending || []
        setTotalPending(pendingInvs.reduce((s: number, i: { total: number }) => s + (i.total || 0), 0))

        // Due this week
        const dueWeek = pendingInvs.filter((i: { due_date: string | null }) =>
          i.due_date && i.due_date >= today && i.due_date <= in7days
        )
        setDueThisWeek(dueWeek.length)

        // Any overdue
        const overdue = pendingInvs.some((i: { due_date: string | null }) =>
          i.due_date && i.due_date < today
        )
        setHasOverdue(overdue)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <WidgetSkeleton />
  if (error) return <WidgetError />

  return (
    <div className="flex items-start justify-between h-full">
      <div>
        <p className={`text-3xl font-bold ${hasOverdue ? 'text-red-400' : 'text-amber-400'}`}>
          {formatCurrency(totalPending)}
        </p>
        <p className="text-xs text-[#6B7280] mt-1">
          {dueThisWeek} vencen esta semana
        </p>
        {hasOverdue && (
          <div className="flex items-center gap-1 mt-1">
            <AlertTriangle size={12} className="text-red-400" />
            <span className="text-[10px] text-red-400 font-medium">Hay facturas vencidas</span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${hasOverdue ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
        <CreditCard size={22} className={hasOverdue ? 'text-red-400' : 'text-amber-400'} />
      </div>
    </div>
  )
}
