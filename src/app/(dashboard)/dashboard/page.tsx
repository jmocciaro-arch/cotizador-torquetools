'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import {
  FileText, Users, Package, TrendingUp, Plus,
  ArrowRight, Clock, Target, Activity
} from 'lucide-react'
import { formatCurrency, formatRelative } from '@/lib/utils'

interface DashboardKPIs {
  totalProducts: number
  totalClients: number
  quotesThisMonth: number
  pipelineValue: number
}

interface ActivityItem {
  id: string
  action: string
  description: string | null
  entity_type: string
  created_at: string
  user?: { full_name: string } | null
}

interface RecentQuote {
  id: string
  quote_number: string
  total: number
  currency: string
  created_at: string
  status: string
  client?: { company_name: string } | null
}

const typeColors: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange'> = {
  quote: 'orange',
  client: 'info',
  opportunity: 'success',
  product: 'warning',
  stock: 'default',
}

export default function DashboardPage() {
  const router = useRouter()
  const [kpis, setKpis] = useState<DashboardKPIs>({
    totalProducts: 0,
    totalClients: 0,
    quotesThisMonth: 0,
    pipelineValue: 0,
  })
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const supabase = createClient()
    setLoading(true)

    try {
      // Ejecutar todas las queries en paralelo
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [
        productsRes,
        clientsRes,
        quotesMonthRes,
        pipelineRes,
        activityRes,
        quotesRecentRes,
      ] = await Promise.all([
        // Total productos
        supabase.from('tt_products').select('*', { count: 'exact', head: true }),
        // Total clientes
        supabase.from('tt_clients').select('*', { count: 'exact', head: true }),
        // Cotizaciones este mes
        supabase
          .from('tt_quotes')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfMonth),
        // Valor pipeline CRM
        supabase
          .from('tt_opportunities')
          .select('value, probability')
          .neq('stage', 'perdido'),
        // Actividad reciente
        supabase
          .from('tt_activity_log')
          .select('id, action, description, entity_type, created_at, user:tt_users(full_name)')
          .order('created_at', { ascending: false })
          .limit(10),
        // Cotizaciones recientes
        supabase
          .from('tt_quotes')
          .select('id, quote_number, total, currency, created_at, status, client:tt_clients(company_name)')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      // Calcular pipeline ponderado
      const pipelineData = pipelineRes.data || []
      const pipelineTotal = pipelineData.reduce(
        (sum: number, o: { value: number; probability: number }) =>
          sum + o.value * (o.probability / 100),
        0
      )

      setKpis({
        totalProducts: productsRes.count || 0,
        totalClients: clientsRes.count || 0,
        quotesThisMonth: quotesMonthRes.count || 0,
        pipelineValue: pipelineTotal,
      })

      setActivity((activityRes.data as unknown as ActivityItem[]) || [])
      setRecentQuotes((quotesRecentRes.data as unknown as RecentQuote[]) || [])
    } catch (err) {
      console.error('Error cargando dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="h-8 w-64 bg-[#141820] rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-[#141820] rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-[#141820] rounded-xl border border-[#1E2330] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-64 bg-[#141820] rounded-xl border border-[#1E2330] animate-pulse" />
          <div className="lg:col-span-2 h-64 bg-[#141820] rounded-xl border border-[#1E2330] animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Bienvenida */}
      <div>
        <h1 className="text-2xl font-bold text-[#F0F2F5]">Buenos dias, Juan</h1>
        <p className="text-[#6B7280] mt-1">Resumen de tu actividad en TorqueTools</p>
      </div>

      {/* KPI Cards - datos reales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Productos en catalogo"
          value={kpis.totalProducts.toLocaleString('es-AR')}
          icon={<Package size={22} />}
          color="#10B981"
        />
        <KPICard
          label="Clientes registrados"
          value={kpis.totalClients.toLocaleString('es-AR')}
          icon={<Users size={22} />}
          color="#3B82F6"
        />
        <KPICard
          label="Cotizaciones este mes"
          value={kpis.quotesThisMonth.toString()}
          icon={<FileText size={22} />}
          color="#FF6600"
        />
        <KPICard
          label="Pipeline CRM"
          value={formatCurrency(kpis.pipelineValue, 'EUR')}
          icon={<Target size={22} />}
          color="#8B5CF6"
        />
      </div>

      {/* Acciones rapidas */}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" className="gap-2" onClick={() => router.push('/cotizador')}>
          <Plus size={16} /> Nueva Cotizacion
        </Button>
        <Button variant="secondary" className="gap-2" onClick={() => router.push('/clientes')}>
          <Users size={16} /> Nuevo Cliente
        </Button>
        <Button variant="secondary" className="gap-2" onClick={() => router.push('/crm')}>
          <Target size={16} /> Nueva Oportunidad
        </Button>
        <Button variant="secondary" className="gap-2" onClick={() => router.push('/catalogo')}>
          <Package size={16} /> Ver Catalogo
        </Button>
      </div>

      {/* Layout dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Actividad reciente */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity size={16} className="text-[#FF6600]" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#4B5563]">
                <Clock size={32} className="mb-3" />
                <p className="text-sm">No hay actividad registrada todavia</p>
                <p className="text-xs mt-1">Las acciones que realices se van a mostrar aca</p>
              </div>
            ) : (
              activity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#1A1F2E] transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#1E2330] flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={14} className="text-[#6B7280]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[#F0F2F5]">{item.action}</p>
                      <Badge variant={typeColors[item.entity_type] || 'default'}>
                        {item.entity_type}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-xs text-[#9CA3AF] mt-0.5">{item.description}</p>
                    )}
                    <p className="text-[10px] text-[#4B5563] mt-1">
                      {item.user?.full_name || 'Sistema'} &middot; {formatRelative(item.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Cotizaciones recientes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Cotizaciones Recientes</CardTitle>
            <Badge variant="orange">{recentQuotes.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentQuotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#4B5563]">
                <FileText size={32} className="mb-3" />
                <p className="text-sm">No hay cotizaciones todavia</p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push('/cotizador')}
                >
                  <Plus size={14} /> Crear primera cotizacion
                </Button>
              </div>
            ) : (
              recentQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330] hover:border-[#2A3040] transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono text-[#FF6600]">{quote.quote_number}</span>
                    <Badge variant={
                      quote.status === 'aceptada' ? 'success' :
                      quote.status === 'rechazada' ? 'danger' :
                      quote.status === 'enviada' ? 'info' : 'default'
                    }>
                      {quote.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-[#D1D5DB]">
                    {quote.client?.company_name || 'Sin cliente'}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-lg font-semibold text-[#F0F2F5]">
                      {formatCurrency(quote.total, (quote.currency || 'EUR') as 'EUR' | 'ARS' | 'USD')}
                    </p>
                    <span className="text-[10px] text-[#4B5563]">{formatRelative(quote.created_at)}</span>
                  </div>
                </div>
              ))
            )}
            {recentQuotes.length > 0 && (
              <Button
                variant="ghost"
                className="w-full text-[#FF6600] mt-2"
                onClick={() => router.push('/cotizador')}
              >
                Ver todas las cotizaciones <ArrowRight size={14} />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen general */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#FF6600]" />
            Resumen General
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-[#0F1218] border border-[#1E2330] text-center">
              <p className="text-2xl font-bold text-[#FF6600]">{kpis.totalProducts.toLocaleString('es-AR')}</p>
              <p className="text-xs text-[#6B7280] mt-1">Productos</p>
            </div>
            <div className="p-4 rounded-lg bg-[#0F1218] border border-[#1E2330] text-center">
              <p className="text-2xl font-bold text-[#3B82F6]">{kpis.totalClients.toLocaleString('es-AR')}</p>
              <p className="text-xs text-[#6B7280] mt-1">Clientes</p>
            </div>
            <div className="p-4 rounded-lg bg-[#0F1218] border border-[#1E2330] text-center">
              <p className="text-2xl font-bold text-[#10B981]">{kpis.quotesThisMonth}</p>
              <p className="text-xs text-[#6B7280] mt-1">Cotizaciones (mes)</p>
            </div>
            <div className="p-4 rounded-lg bg-[#0F1218] border border-[#1E2330] text-center">
              <p className="text-2xl font-bold text-[#8B5CF6]">{formatCurrency(kpis.pipelineValue, 'EUR')}</p>
              <p className="text-xs text-[#6B7280] mt-1">Pipeline</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
