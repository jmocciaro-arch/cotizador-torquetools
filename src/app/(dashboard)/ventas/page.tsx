'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Receipt, Plus } from 'lucide-react'

const demoSOs = [
  { id: '1', number: 'SO-2604-0001', client: 'Seat Martorell', status: 'confirmado', total: 45230, currency: 'EUR' as const, date: '2026-04-02' },
  { id: '2', number: 'SO-2604-0002', client: 'Airbus Getafe', status: 'enviado', total: 128500, currency: 'EUR' as const, date: '2026-04-04' },
  { id: '3', number: 'SO-2604-0003', client: 'Boeing Houston', status: 'borrador', total: 89000, currency: 'USD' as const, date: '2026-04-09' },
]

const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'info' | 'orange'; label: string }> = {
  borrador: { variant: 'default', label: 'Borrador' },
  confirmado: { variant: 'info', label: 'Confirmado' },
  enviado: { variant: 'warning', label: 'Enviado' },
  entregado: { variant: 'success', label: 'Entregado' },
  facturado: { variant: 'success', label: 'Facturado' },
}

export default function VentasPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Pedidos de Venta</h1>
          <p className="text-[#6B7280] mt-1">{demoSOs.length} pedidos</p>
        </div>
        <Button variant="primary"><Plus size={16} /> Nuevo Pedido</Button>
      </div>

      <Table>
        <TableHeader>
          <tr>
            <TableHead>Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Fecha</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {demoSOs.map(so => (
            <TableRow key={so.id}>
              <TableCell><span className="font-mono text-xs text-[#FF6600]">{so.number}</span></TableCell>
              <TableCell><span className="text-sm text-[#F0F2F5]">{so.client}</span></TableCell>
              <TableCell><Badge variant={statusConfig[so.status]?.variant || 'default'}>{statusConfig[so.status]?.label}</Badge></TableCell>
              <TableCell><span className="text-sm font-semibold text-[#F0F2F5]">{formatCurrency(so.total, so.currency)}</span></TableCell>
              <TableCell><span className="text-sm text-[#9CA3AF]">{formatDate(so.date)}</span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
