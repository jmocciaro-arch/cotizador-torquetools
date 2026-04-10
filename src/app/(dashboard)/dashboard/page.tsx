'use client'

import { KPICard } from '@/components/ui/kpi-card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText, Users, Package, Mail, TrendingUp, Plus,
  ArrowRight, Clock, DollarSign, Target
} from 'lucide-react'
import { formatCurrency, formatRelative } from '@/lib/utils'

// Mock data for demo
const recentActivity = [
  { id: '1', action: 'Cotización creada', detail: 'TT-2604-0012 para Seat Martorell', user: 'Juan', time: '2026-04-10T10:30:00Z', type: 'quote' },
  { id: '2', action: 'Cliente actualizado', detail: 'Volkswagen Navarra - nuevo contacto', user: 'Facu', time: '2026-04-10T09:15:00Z', type: 'client' },
  { id: '3', action: 'Oportunidad ganada', detail: 'FEIN Tools para Airbus', user: 'Juan', time: '2026-04-09T16:45:00Z', type: 'crm' },
  { id: '4', action: 'Pedido confirmado', detail: 'PO-2604-0003 Tohnichi wrenches', user: 'Norber', time: '2026-04-09T14:20:00Z', type: 'order' },
  { id: '5', action: 'Stock actualizado', detail: 'Recepción almacén BCN - 45 unidades', user: 'Jano', time: '2026-04-09T11:00:00Z', type: 'stock' },
]

const pendingQuotes = [
  { id: '1', number: 'TT-2604-0012', client: 'Seat Martorell', total: 45230.00, days: 2 },
  { id: '2', number: 'TT-2604-0010', client: 'Airbus Getafe', total: 128500.00, days: 5 },
  { id: '3', number: 'BT-2604-0008', client: 'Toyota Argentina', total: 32100.00, days: 7 },
]

const typeColors: Record<string, string> = {
  quote: 'orange',
  client: 'info',
  crm: 'success',
  order: 'warning',
  stock: 'default',
}

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-[#F0F2F5]">Buenos días, Juan</h1>
        <p className="text-[#6B7280] mt-1">Resumen de tu actividad en TorqueTools</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Cotizaciones este mes"
          value="24"
          change={12}
          changeLabel="vs mes anterior"
          icon={<FileText size={22} />}
          color="#FF6600"
        />
        <KPICard
          label="Clientes activos"
          value="986"
          change={3.2}
          changeLabel="nuevos"
          icon={<Users size={22} />}
          color="#3B82F6"
        />
        <KPICard
          label="Productos en catálogo"
          value="15.509"
          change={0.5}
          changeLabel="nuevos"
          icon={<Package size={22} />}
          color="#10B981"
        />
        <KPICard
          label="Pipeline CRM"
          value={formatCurrency(342500, 'EUR')}
          change={18}
          changeLabel="vs mes anterior"
          icon={<Target size={22} />}
          color="#8B5CF6"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" className="gap-2">
          <Plus size={16} /> Nueva Cotización
        </Button>
        <Button variant="secondary" className="gap-2">
          <Users size={16} /> Nuevo Cliente
        </Button>
        <Button variant="secondary" className="gap-2">
          <Target size={16} /> Nueva Oportunidad
        </Button>
        <Button variant="secondary" className="gap-2">
          <Mail size={16} /> Revisar Mails
        </Button>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <Button variant="ghost" size="sm" className="text-[#FF6600]">
              Ver todo <ArrowRight size={14} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((item) => (
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
                    <Badge variant={typeColors[item.type] as 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange'}>
                      {item.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{item.detail}</p>
                  <p className="text-[10px] text-[#4B5563] mt-1">
                    {item.user} &middot; {formatRelative(item.time)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pending Quotes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cotizaciones Pendientes</CardTitle>
            <Badge variant="orange">{pendingQuotes.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingQuotes.map((quote) => (
              <div
                key={quote.id}
                className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330] hover:border-[#2A3040] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-mono text-[#FF6600]">{quote.number}</span>
                  <span className="text-xs text-[#6B7280]">{quote.days}d</span>
                </div>
                <p className="text-sm text-[#D1D5DB]">{quote.client}</p>
                <p className="text-lg font-semibold text-[#F0F2F5] mt-1">
                  {formatCurrency(quote.total, 'EUR')}
                </p>
              </div>
            ))}
            <Button variant="ghost" className="w-full text-[#FF6600] mt-2">
              Ver todas las cotizaciones <ArrowRight size={14} />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#FF6600]" />
            Facturación Mensual 2026
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-[#4B5563] border border-dashed border-[#1E2330] rounded-lg">
            <div className="text-center">
              <DollarSign size={32} className="mx-auto mb-2 text-[#2A3040]" />
              <p className="text-sm">Gráfico de facturación</p>
              <p className="text-xs mt-1">Se activará con datos reales</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
