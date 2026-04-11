'use client'

import { useState, useEffect } from 'react'
import { Banknote } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { WidgetSkeleton, WidgetError } from '../widget-wrapper'

export function KpiPendingCollection() {
  const [value, setValue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data, error: e } = await supabase
          .from('tt_quotes')
          .select('total')
          .in('status', ['accepted', 'aceptada'])

        if (e) throw e
        const pending = (data || []).reduce(
          (acc: number, q: { total: number }) => acc + (q.total || 0),
          0
        )
        setValue(pending)
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
        <p className="text-3xl font-bold text-[#F0F2F5]">
          {formatCurrency(value, 'EUR')}
        </p>
        <p className="text-xs text-[#6B7280] mt-1">pendiente de cobro</p>
      </div>
      <div className="p-3 rounded-xl bg-green-500/10">
        <Banknote size={22} className="text-green-400" />
      </div>
    </div>
  )
}
