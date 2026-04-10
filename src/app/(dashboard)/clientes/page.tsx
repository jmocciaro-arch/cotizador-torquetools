'use client'

import { useState, useMemo } from 'react'
import { SearchBar } from '@/components/ui/search-bar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import {
  Users, Plus, Phone, Mail, MessageSquare, MapPin,
  Building2, ExternalLink, FileText, TrendingUp
} from 'lucide-react'

const demoClients = [
  { id: '1', code: 'C-0001', company_name: 'Seat Martorell', type: 'empresa', country: 'ES', city: 'Martorell', email: 'compras@seat.es', phone: '+34 937 001 234', total_revenue: 245000, tags: ['Automotive', 'VIP'], is_active: true },
  { id: '2', code: 'C-0002', company_name: 'Volkswagen Navarra', type: 'empresa', country: 'ES', city: 'Pamplona', email: 'purchasing@vw-navarra.es', phone: '+34 948 001 234', total_revenue: 189000, tags: ['Automotive'], is_active: true },
  { id: '3', code: 'C-0003', company_name: 'Airbus Getafe', type: 'empresa', country: 'ES', city: 'Getafe', email: 'procurement@airbus.com', phone: '+34 91 001 2345', total_revenue: 456000, tags: ['Aeronáutica', 'VIP'], is_active: true },
  { id: '4', code: 'C-0004', company_name: 'Toyota Argentina', type: 'empresa', country: 'AR', city: 'Zárate', email: 'compras@toyota.com.ar', phone: '+54 3487 001234', total_revenue: 98000, tags: ['Automotive'], is_active: true },
  { id: '5', code: 'C-0005', company_name: 'Renault Argentina', type: 'empresa', country: 'AR', city: 'Córdoba', email: 'compras@renault.com.ar', phone: '+54 351 001234', total_revenue: 76000, tags: ['Automotive'], is_active: true },
  { id: '6', code: 'C-0006', company_name: 'John Deere Ibérica', type: 'empresa', country: 'ES', city: 'Getafe', email: 'tools@deere.com', phone: '+34 91 002 3456', total_revenue: 167000, tags: ['Maquinaria'], is_active: true },
  { id: '7', code: 'C-0007', company_name: 'Taller Mecánico Rosario', type: 'autonomo', country: 'AR', city: 'Rosario', email: 'info@tallerrosario.com.ar', phone: '+54 341 001234', total_revenue: 12000, tags: ['Taller'], is_active: true },
  { id: '8', code: 'C-0008', company_name: 'Boeing Houston Division', type: 'empresa', country: 'US', city: 'Houston', email: 'procurement@boeing.com', phone: '+1 713 555 0200', total_revenue: 320000, tags: ['Aeronáutica', 'VIP'], is_active: true },
]

type ClientType = typeof demoClients[number]

const countryFlags: Record<string, string> = {
  ES: '\ud83c\uddea\ud83c\uddf8',
  AR: '\ud83c\udde6\ud83c\uddf7',
  US: '\ud83c\uddfa\ud83c\uddf8',
}

export default function ClientesPage() {
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState<string>('')
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null)
  const [showNew, setShowNew] = useState(false)

  const filtered = useMemo(() => {
    let result = demoClients
    if (filterCountry) result = result.filter(c => c.country === filterCountry)
    if (search) {
      const tokens = search.toLowerCase().split(/\s+/)
      result = result.filter(c => {
        const hay = `${c.code} ${c.company_name} ${c.city} ${c.email}`.toLowerCase()
        return tokens.every(t => hay.includes(t))
      })
    }
    return result
  }, [search, filterCountry])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Clientes</h1>
          <p className="text-[#6B7280] mt-1">{filtered.length} clientes</p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> Nuevo Cliente
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          placeholder="Buscar por nombre, código, email..."
          value={search}
          onChange={setSearch}
          className="flex-1 max-w-lg"
        />
        <div className="flex gap-2">
          {['', 'ES', 'AR', 'US'].map(country => (
            <button
              key={country}
              onClick={() => setFilterCountry(country)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filterCountry === country
                  ? 'bg-[#FF6600] text-white'
                  : 'bg-[#1E2330] text-[#9CA3AF] hover:bg-[#2A3040]'
              }`}
            >
              {country ? `${countryFlags[country]} ${country}` : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* Client Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#4B5563]">
          <Users size={48} className="mb-4" />
          <p className="text-lg font-medium">No se encontraron clientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => (
            <Card key={client.id} hover onClick={() => setSelectedClient(client)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-[#1E2330] flex items-center justify-center text-sm font-bold text-[#FF6600]">
                    {client.company_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F0F2F5]">{client.company_name}</h3>
                    <p className="text-[10px] font-mono text-[#6B7280]">{client.code}</p>
                  </div>
                </div>
                <span className="text-lg">{countryFlags[client.country]}</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                  <MapPin size={12} /> {client.city}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                  <Mail size={12} /> {client.email}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                  <Phone size={12} /> {client.phone}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1E2330]">
                <div className="flex gap-1 flex-wrap">
                  {client.tags.map(tag => (
                    <Badge key={tag} variant={tag === 'VIP' ? 'orange' : 'default'} size="sm">{tag}</Badge>
                  ))}
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#6B7280]">Revenue</p>
                  <p className="text-sm font-semibold text-[#FF6600]">{formatCurrency(client.total_revenue, 'EUR')}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Client Detail Modal */}
      <Modal
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title={selectedClient?.company_name || ''}
        size="lg"
      >
        {selectedClient && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">País</p>
                <p className="text-sm text-[#F0F2F5]">{countryFlags[selectedClient.country]} {selectedClient.country}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Tipo</p>
                <p className="text-sm text-[#F0F2F5] capitalize">{selectedClient.type}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Ciudad</p>
                <p className="text-sm text-[#F0F2F5]">{selectedClient.city}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <p className="text-xs text-[#6B7280]">Revenue total</p>
                <p className="text-sm font-semibold text-[#FF6600]">{formatCurrency(selectedClient.total_revenue, 'EUR')}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm"><FileText size={14} /> Nueva Cotización</Button>
              <Button variant="secondary" size="sm"><Phone size={14} /> Llamar</Button>
              <Button variant="secondary" size="sm"><Mail size={14} /> Email</Button>
              <Button variant="secondary" size="sm"><MessageSquare size={14} /> WhatsApp</Button>
            </div>

            {/* History placeholder */}
            <div>
              <h4 className="text-sm font-semibold text-[#F0F2F5] mb-3">Historial</h4>
              <div className="flex items-center justify-center py-8 text-[#4B5563] border border-dashed border-[#1E2330] rounded-lg">
                <p className="text-sm">El historial se cargará con datos reales</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* New Client Modal */}
      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="Nuevo Cliente" size="lg">
        <div className="space-y-4">
          <Input label="Nombre de empresa" placeholder="Ej: Seat Martorell" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="CIF / CUIT" placeholder="B12345678" />
            <Select
              label="Tipo"
              options={[
                { value: 'empresa', label: 'Empresa' },
                { value: 'autonomo', label: 'Autónomo' },
                { value: 'particular', label: 'Particular' },
                { value: 'distribuidor', label: 'Distribuidor' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="País"
              options={[
                { value: 'ES', label: 'España' },
                { value: 'AR', label: 'Argentina' },
                { value: 'US', label: 'Estados Unidos' },
              ]}
            />
            <Input label="Ciudad" placeholder="Barcelona" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" placeholder="compras@empresa.com" />
            <Input label="Teléfono" placeholder="+34 93 123 4567" />
          </div>
          <Input label="Dirección" placeholder="Calle Industrial 15" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button variant="primary">Guardar Cliente</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
