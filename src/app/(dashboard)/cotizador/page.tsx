'use client'

import { useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SearchBar } from '@/components/ui/search-bar'
import { Modal } from '@/components/ui/modal'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatCurrency, INCOTERMS, generateQuoteNumber } from '@/lib/utils'
import {
  Plus, Trash2, Save, Send, FileText, Download,
  MessageSquare, Mail, Building2, User, Search, X
} from 'lucide-react'

interface QuoteLineItem {
  id: string
  sku: string
  description: string
  quantity: number
  unitPrice: number
  discount: number
  notes: string
}

const companyOptions = [
  { value: 'tt-sl', label: 'TorqueTools SL (España - EUR)' },
  { value: 'bt-sa', label: 'BuscaTools SA (Argentina - ARS)' },
  { value: 'tq-sa', label: 'Torquear SA (Argentina - ARS)' },
  { value: 'gas-llc', label: 'Global Assembly Solutions LLC (USA - USD)' },
]

const prefixMap: Record<string, string> = {
  'tt-sl': 'TT', 'bt-sa': 'BT', 'tq-sa': 'TQ', 'gas-llc': 'GAS',
}

const currencyMap: Record<string, 'EUR' | 'ARS' | 'USD'> = {
  'tt-sl': 'EUR', 'bt-sa': 'ARS', 'tq-sa': 'ARS', 'gas-llc': 'USD',
}

const demoClients = [
  { id: '1', company_name: 'Seat Martorell', tax_id: 'B12345678' },
  { id: '2', company_name: 'Volkswagen Navarra', tax_id: 'A87654321' },
  { id: '3', company_name: 'Airbus Getafe', tax_id: 'B11223344' },
  { id: '4', company_name: 'Toyota Argentina', tax_id: '30-12345678-9' },
  { id: '5', company_name: 'Renault Argentina', tax_id: '30-98765432-1' },
]

export default function CotizadorPage() {
  const [company, setCompany] = useState('tt-sl')
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<typeof demoClients[0] | null>(null)
  const [showClientSearch, setShowClientSearch] = useState(false)
  const [quoteNumber] = useState(() => generateQuoteNumber('TT'))
  const [items, setItems] = useState<QuoteLineItem[]>([])
  const [notes, setNotes] = useState('')
  const [incoterm, setIncoterm] = useState('')
  const [taxRate, setTaxRate] = useState(21)
  const [showProductSearch, setShowProductSearch] = useState(false)

  const currency = currencyMap[company] || 'EUR'

  const addItem = useCallback(() => {
    setItems(prev => [...prev, {
      id: Math.random().toString(36).slice(2),
      sku: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      notes: '',
    }])
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const updateItem = useCallback((id: string, field: keyof QuoteLineItem, value: string | number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }, [])

  const subtotal = items.reduce((sum, i) => {
    const lineTotal = i.quantity * i.unitPrice * (1 - i.discount / 100)
    return sum + lineTotal
  }, 0)

  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  const filteredClients = demoClients.filter(c =>
    c.company_name.toLowerCase().includes(clientSearch.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Nueva Cotización</h1>
          <p className="text-[#6B7280] mt-1 font-mono">{quoteNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary">
            <Save size={16} /> Guardar borrador
          </Button>
          <Button variant="primary">
            <Send size={16} /> Enviar
          </Button>
        </div>
      </div>

      {/* Company & Client Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 size={16} className="text-[#FF6600]" /> Empresa emisora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              options={companyOptions}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <User size={16} className="text-[#FF6600]" /> Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedClient ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                <div>
                  <p className="text-sm font-medium text-[#F0F2F5]">{selectedClient.company_name}</p>
                  <p className="text-xs text-[#6B7280]">{selectedClient.tax_id}</p>
                </div>
                <button onClick={() => setSelectedClient(null)} className="text-[#6B7280] hover:text-red-400">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchBar
                  placeholder="Buscar cliente..."
                  value={clientSearch}
                  onChange={setClientSearch}
                  onSearch={() => setShowClientSearch(true)}
                />
                {clientSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#141820] border border-[#1E2330] rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                    {filteredClients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => { setSelectedClient(client); setClientSearch('') }}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#1E2330] transition-colors"
                      >
                        <p className="text-sm text-[#F0F2F5]">{client.company_name}</p>
                        <p className="text-xs text-[#6B7280]">{client.tax_id}</p>
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <p className="px-4 py-3 text-sm text-[#4B5563]">No se encontraron clientes</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Items de la cotización</CardTitle>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowProductSearch(true)}>
              <Search size={14} /> Buscar producto
            </Button>
            <Button variant="primary" size="sm" onClick={addItem}>
              <Plus size={14} /> Agregar línea
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#4B5563] border border-dashed border-[#1E2330] rounded-lg">
              <FileText size={36} className="mb-3" />
              <p className="text-sm">No hay items todavía</p>
              <p className="text-xs mt-1">Agregá productos a tu cotización</p>
              <Button variant="primary" size="sm" className="mt-4" onClick={addItem}>
                <Plus size={14} /> Agregar primer item
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2330]">
                    <th className="text-left py-2 px-2 text-xs text-[#6B7280] font-medium w-24">SKU</th>
                    <th className="text-left py-2 px-2 text-xs text-[#6B7280] font-medium">Descripción</th>
                    <th className="text-center py-2 px-2 text-xs text-[#6B7280] font-medium w-20">Cant.</th>
                    <th className="text-right py-2 px-2 text-xs text-[#6B7280] font-medium w-28">P. Unitario</th>
                    <th className="text-center py-2 px-2 text-xs text-[#6B7280] font-medium w-20">Dto %</th>
                    <th className="text-right py-2 px-2 text-xs text-[#6B7280] font-medium w-28">Subtotal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const lineTotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
                    return (
                      <tr key={item.id} className="border-b border-[#1E2330]/50">
                        <td className="py-2 px-2">
                          <input
                            value={item.sku}
                            onChange={(e) => updateItem(item.id, 'sku', e.target.value)}
                            className="w-full bg-transparent text-xs font-mono text-[#9CA3AF] outline-none"
                            placeholder="SKU"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            className="w-full bg-transparent text-sm text-[#F0F2F5] outline-none"
                            placeholder="Descripción del producto"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                            className="w-full bg-[#0F1218] border border-[#1E2330] rounded px-2 py-1 text-center text-sm text-[#F0F2F5] outline-none focus:border-[#FF6600]"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                            className="w-full bg-[#0F1218] border border-[#1E2330] rounded px-2 py-1 text-right text-sm text-[#F0F2F5] outline-none focus:border-[#FF6600]"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount}
                            onChange={(e) => updateItem(item.id, 'discount', Number(e.target.value))}
                            className="w-full bg-[#0F1218] border border-[#1E2330] rounded px-2 py-1 text-center text-sm text-[#F0F2F5] outline-none focus:border-[#FF6600]"
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-sm font-medium text-[#F0F2F5]">
                          {formatCurrency(lineTotal, currency)}
                        </td>
                        <td className="py-2 px-1">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-[#4B5563] hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom section: Notes + Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Notes & Incoterms */}
        <Card>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg bg-[#1E2330] border border-[#2A3040] px-3 py-2 text-sm text-[#F0F2F5] placeholder:text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                placeholder="Notas para el cliente..."
              />
            </div>
            <Select
              label="Incoterm"
              options={INCOTERMS.map(i => ({ value: i, label: i }))}
              value={incoterm}
              onChange={(e) => setIncoterm(e.target.value)}
              placeholder="Seleccionar incoterm..."
            />
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Subtotal</span>
              <span className="text-[#D1D5DB]">{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[#6B7280]">IVA</span>
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-14 bg-[#0F1218] border border-[#1E2330] rounded px-2 py-0.5 text-center text-xs text-[#F0F2F5]"
                />
                <span className="text-xs text-[#6B7280]">%</span>
              </div>
              <span className="text-[#D1D5DB]">{formatCurrency(taxAmount, currency)}</span>
            </div>
            <div className="border-t border-[#1E2330] pt-3 flex justify-between">
              <span className="text-lg font-semibold text-[#F0F2F5]">Total</span>
              <span className="text-2xl font-bold text-[#FF6600]">{formatCurrency(total, currency)}</span>
            </div>

            {/* Share actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" size="sm" className="flex-1">
                <Download size={14} /> PDF
              </Button>
              <Button variant="secondary" size="sm" className="flex-1">
                <Mail size={14} /> Email
              </Button>
              <Button variant="secondary" size="sm" className="flex-1">
                <MessageSquare size={14} /> WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Search Modal */}
      <Modal
        isOpen={showProductSearch}
        onClose={() => setShowProductSearch(false)}
        title="Buscar Producto"
        size="lg"
      >
        <SearchBar placeholder="Buscar por SKU, nombre, marca..." className="mb-4" />
        <div className="space-y-2">
          {[
            { sku: 'FEIN-72227760000', name: 'Multimaster AMM 700 Max Top', price: 589 },
            { sku: 'TOH-CL50NX15D', name: 'Torquímetro CL50Nx15D', price: 1250 },
            { sku: 'TECNA-3664', name: 'Soldadora de puntos TECNA 3664', price: 4200 },
          ].map(p => (
            <button
              key={p.sku}
              onClick={() => {
                setItems(prev => [...prev, {
                  id: Math.random().toString(36).slice(2),
                  sku: p.sku,
                  description: p.name,
                  quantity: 1,
                  unitPrice: p.price,
                  discount: 0,
                  notes: '',
                }])
                setShowProductSearch(false)
              }}
              className="w-full text-left flex items-center justify-between p-3 rounded-lg hover:bg-[#1E2330] transition-colors"
            >
              <div>
                <p className="text-xs font-mono text-[#6B7280]">{p.sku}</p>
                <p className="text-sm text-[#F0F2F5]">{p.name}</p>
              </div>
              <span className="text-sm font-bold text-[#FF6600]">{formatCurrency(p.price, currency)}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
