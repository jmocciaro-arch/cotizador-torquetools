'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Wrench, Plus } from 'lucide-react'

const demoTickets = [
  { id: '1', number: 'SAT-0001', title: 'Reparación Multimaster AMM 700', client: 'Seat Martorell', type: 'reparacion', priority: 'alta', status: 'en_proceso' },
  { id: '2', number: 'SAT-0002', title: 'Calibración torquímetros Tohnichi x3', client: 'Airbus Getafe', type: 'calibracion', priority: 'normal', status: 'abierto' },
  { id: '3', number: 'SAT-0003', title: 'Garantía soldadora Tecna', client: 'Volkswagen Navarra', type: 'garantia', priority: 'urgente', status: 'esperando_repuesto' },
]

const priorityConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger'; label: string }> = {
  baja: { variant: 'default', label: 'Baja' },
  normal: { variant: 'success', label: 'Normal' },
  alta: { variant: 'warning', label: 'Alta' },
  urgente: { variant: 'danger', label: 'Urgente' },
}

const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'info' | 'orange'; label: string }> = {
  abierto: { variant: 'info', label: 'Abierto' },
  en_proceso: { variant: 'warning', label: 'En proceso' },
  esperando_repuesto: { variant: 'orange', label: 'Esperando repuesto' },
  resuelto: { variant: 'success', label: 'Resuelto' },
  cerrado: { variant: 'default', label: 'Cerrado' },
}

export default function SATPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">SAT - Servicio Técnico</h1>
          <p className="text-[#6B7280] mt-1">{demoTickets.length} tickets</p>
        </div>
        <Button variant="primary"><Plus size={16} /> Nuevo Ticket</Button>
      </div>

      <Table>
        <TableHeader>
          <tr>
            <TableHead>Número</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Estado</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {demoTickets.map(ticket => (
            <TableRow key={ticket.id}>
              <TableCell><span className="font-mono text-xs text-[#FF6600]">{ticket.number}</span></TableCell>
              <TableCell><span className="text-sm text-[#F0F2F5]">{ticket.title}</span></TableCell>
              <TableCell><span className="text-sm text-[#9CA3AF]">{ticket.client}</span></TableCell>
              <TableCell><Badge variant="default">{ticket.type}</Badge></TableCell>
              <TableCell><Badge variant={priorityConfig[ticket.priority]?.variant || 'default'}>{priorityConfig[ticket.priority]?.label}</Badge></TableCell>
              <TableCell><Badge variant={statusConfig[ticket.status]?.variant || 'default'}>{statusConfig[ticket.status]?.label}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
