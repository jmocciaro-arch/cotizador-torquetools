'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ShoppingCart, Plus, Truck, Clock, CheckCircle } from 'lucide-react'

const demoPOs = [
  { id: '1', number: 'PO-2604-0001', supplier: 'FEIN GmbH', status: 'confirmada', total: 12500, currency: 'EUR' as const, date: '2026-04-01', delivery: '2026-04-25' },
  { id: '2', number: 'PO-2604-0002', supplier: 'Tohnichi Mfg.', status: 'enviada', total: 34200, currency: 'EUR' as const, date: '2026-04-05', delivery: '2026-05-10' },
  { id: '3', number: 'PO-2604-0003', supplier: 'Ingersoll Rand', status: 'borrador', total: 8900, currency: 'USD' as const, date: '2026-04-09', delivery: null },
]

const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'info' | 'orange'; label: string }> = {
  borrador: { variant: 'default', label: 'Borrador' },
  enviada: { variant: 'info', label: 'Enviada' },
  confirmada: { variant: 'success', label: 'Confirmada' },
  recibida: { variant: 'success', label: 'Recibida' },
}

export default function ComprasPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Ordenes de Compra</h1>
          <p className="text-[#6B7280] mt-1">{demoPOs.length} ordenes</p>
        </div>
        <Button variant="primary"><Plus size={16} /> Nueva OC</Button>
      </div>

      <Table>
        <TableHeader>
          <tr>
            <TableHead>Número</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Entrega est.</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {demoPOs.map(po => (
            <TableRow key={po.id}>
              <TableCell><span className="font-mono text-xs text-[#FF6600]">{po.number}</span></TableCell>
              <TableCell><span className="text-sm text-[#F0F2F5]">{po.supplier}</span></TableCell>
              <TableCell><Badge variant={statusConfig[po.status]?.variant || 'default'}>{statusConfig[po.status]?.label}</Badge></TableCell>
              <TableCell><span className="text-sm font-semibold text-[#F0F2F5]">{formatCurrency(po.total, po.currency)}</span></TableCell>
              <TableCell><span className="text-sm text-[#9CA3AF]">{formatDate(po.date)}</span></TableCell>
              <TableCell><span className="text-sm text-[#9CA3AF]">{po.delivery ? formatDate(po.delivery) : '-'}</span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
