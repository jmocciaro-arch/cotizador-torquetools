'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Calendar, Clock } from 'lucide-react'

export default function CalendarioPage() {
  const today = new Date()
  const events = [
    { time: '09:00', title: 'Llamada con Seat Martorell', type: 'call' },
    { time: '11:00', title: 'Demo FEIN para Airbus', type: 'meeting' },
    { time: '14:30', title: 'Revisión cotización Boeing', type: 'task' },
    { time: '16:00', title: 'Follow-up Toyota Argentina', type: 'call' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[#F0F2F5]">Calendario</h1>
        <p className="text-[#6B7280] mt-1">
          {today.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's events */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Eventos de hoy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.map((event, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <div className="flex items-center gap-1 text-xs text-[#FF6600] font-mono shrink-0 mt-0.5">
                  <Clock size={12} />
                  {event.time}
                </div>
                <p className="text-sm text-[#F0F2F5]">{event.title}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Calendar placeholder */}
        <Card className="lg:col-span-2">
          <CardContent className="flex items-center justify-center py-20">
            <div className="text-center text-[#4B5563]">
              <Calendar size={48} className="mx-auto mb-4 text-[#2A3040]" />
              <p className="text-lg font-medium">Vista de calendario</p>
              <p className="text-sm mt-1">Integración con Google Calendar próximamente</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
