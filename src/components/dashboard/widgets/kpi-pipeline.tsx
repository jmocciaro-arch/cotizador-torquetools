'use client'

import { useState, useEffect } from 'react'
import { Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCompanyFilter } from '@/hooks/use-company-filter'
import { formatCurrency } from '@/lib/utils'
import { WidgetSkeleton, WidgetError } from '../widget-wrapper'

export function KpiPipeline() {
  const [value, setValue] = useState(0)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { filterByCompany, companyKey } = useCompanyFilter()

  useEffect(() => {
    async function load() {
      try {
        const sb = createClient()
        let q = sb.from('tt_opportunities').select('expected_value, probability').neq('stage', 'perdido')
        q = filterByCompany(q)
        const { data, error: e } = await q

        if (e) throw e
        const ops = data || []
        setCount(ops.length)
        const weighted = ops.reduce(
          (sum: number, o: { expected_value: number; probability: number }) =>
            sum + (o.expected_value || 0) * ((o.probability || 0) / 100),
          0
        )
        setValue(weighted)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [companyKey])

  if (loading) return <WidgetSkeleton />
  if (error) return <WidgetError />

  return (
    <div className="flex items-start justify-between h-full">
      <div>
        <p className="text-3xl font-bold text-[#F0F2F5]">
          {formatCurrency(value, 'EUR')}
        </p>
        <p className="text-xs text-[#6B7280] mt-1">{count} oportunidades</p>
      </div>
      <div className="p-3 rounded-xl bg-purple-500/10">
        <Target size={22} className="text-purple-400" />
      </div>
    </div>
  )
}
