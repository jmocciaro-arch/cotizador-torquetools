'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Inbox, Send, Clock, Star, Search } from 'lucide-react'
import { SearchBar } from '@/components/ui/search-bar'

const demoMails = [
  { id: '1', from: 'compras@seat.es', subject: 'Re: Cotización FEIN AMM 700', preview: 'Buenos días Juan, te confirmo que estamos interesados en la propuesta...', time: '10:30', unread: true, starred: true },
  { id: '2', from: 'procurement@airbus.com', subject: 'Pedido torquímetros Tohnichi', preview: 'Hi Juan, we need to update the order quantities for...', time: '09:15', unread: true, starred: false },
  { id: '3', from: 'info@fein.de', subject: 'Preisliste Update Q2 2026', preview: 'Sehr geehrter Herr Mocciaro, anbei die aktualisierte...', time: 'Ayer', unread: false, starred: false },
  { id: '4', from: 'compras@toyota.com.ar', subject: 'Consulta atornilladores FIAM', preview: 'Hola Juan, necesitamos cotización para 20 unidades del...', time: 'Ayer', unread: false, starred: true },
]

export default function MailPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Bandeja de Mail</h1>
          <p className="text-[#6B7280] mt-1">2 sin leer</p>
        </div>
        <Button variant="primary"><Send size={16} /> Nuevo Email</Button>
      </div>

      <SearchBar placeholder="Buscar emails..." className="max-w-xl" />

      <Card>
        <CardContent className="divide-y divide-[#1E2330]">
          {demoMails.map(mail => (
            <div
              key={mail.id}
              className="flex items-start gap-3 py-4 first:pt-0 last:pb-0 cursor-pointer hover:bg-[#1A1F2E] -mx-5 px-5 transition-colors"
            >
              {mail.starred ? (
                <Star size={16} className="text-amber-400 fill-amber-400 shrink-0 mt-1" />
              ) : (
                <Star size={16} className="text-[#2A3040] shrink-0 mt-1" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${mail.unread ? 'font-semibold text-[#F0F2F5]' : 'text-[#9CA3AF]'}`}>
                    {mail.from}
                  </span>
                  <span className="text-xs text-[#6B7280] shrink-0">{mail.time}</span>
                </div>
                <p className={`text-sm truncate mt-0.5 ${mail.unread ? 'text-[#F0F2F5] font-medium' : 'text-[#9CA3AF]'}`}>
                  {mail.subject}
                </p>
                <p className="text-xs text-[#4B5563] truncate mt-0.5">{mail.preview}</p>
              </div>
              {mail.unread && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF6600] shrink-0 mt-2" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-center py-8 text-[#4B5563]">
        <div className="text-center">
          <Mail size={32} className="mx-auto mb-2 text-[#2A3040]" />
          <p className="text-sm">Integración completa con Gmail próximamente</p>
        </div>
      </div>
    </div>
  )
}
