'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SearchBar } from '@/components/ui/search-bar'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, INCOTERMS } from '@/lib/utils'
import type { Company, Client } from '@/types'
import {
  Plus, Minus, Trash2, Save, Send, FileText, Download,
  MessageSquare, Building2, User, Search, X, Loader2, Printer, List
} from 'lucide-react'

interface QuoteLineItem {
  id: string
  product_id: string | null
  sku: string
  description: string
  quantity: number
  unitPrice: number
  discount: number
  notes: string
}

interface ProductSearchResult {
  id: string
  sku: string
  name: string
  brand: string
  price_list: number
  price_currency: string
  image_url: string | null
}

interface SavedQuote {
  id: string
  quote_number: string
  status: string
  total: number
  currency: string
  created_at: string
  client?: { company_name: string } | null
}

export default function CotizadorPage() {
  const { addToast } = useToast()

  // Companies from Supabase
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [currency, setCurrency] = useState<'EUR' | 'ARS' | 'USD'>('EUR')

  // Client
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const clientDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Quote
  const [quoteNumber, setQuoteNumber] = useState('')
  const [items, setItems] = useState<QuoteLineItem[]>([])
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [incoterm, setIncoterm] = useState('')
  const [taxRate, setTaxRate] = useState(21)
  const [validUntil, setValidUntil] = useState('')
  const [saving, setSaving] = useState(false)

  // Product search modal
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const productDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Saved quotes
  const [showSavedQuotes, setShowSavedQuotes] = useState(false)
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([])
  const [loadingQuotes, setLoadingQuotes] = useState(false)

  // Load companies on mount
  useEffect(() => {
    loadCompanies()
    generateQuoteNumber()
    // Default validity: 30 days
    const d = new Date()
    d.setDate(d.getDate() + 30)
    setValidUntil(d.toISOString().split('T')[0])
  }, [])

  // Update currency when company changes
  useEffect(() => {
    const comp = companies.find((c) => c.id === selectedCompanyId)
    if (comp) {
      setCurrency(comp.currency)
      setTaxRate(comp.default_tax_rate || 21)
    }
  }, [selectedCompanyId, companies])

  // Client search with debounce
  useEffect(() => {
    if (!clientSearch.trim()) {
      setClientResults([])
      setShowClientDropdown(false)
      return
    }
    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current)
    clientDebounceRef.current = setTimeout(() => searchClients(clientSearch), 300)
    return () => {
      if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current)
    }
  }, [clientSearch])

  // Product search with debounce
  useEffect(() => {
    if (!productSearch.trim()) {
      setProductResults([])
      return
    }
    if (productDebounceRef.current) clearTimeout(productDebounceRef.current)
    productDebounceRef.current = setTimeout(() => searchProducts(productSearch), 300)
    return () => {
      if (productDebounceRef.current) clearTimeout(productDebounceRef.current)
    }
  }, [productSearch])

  async function loadCompanies() {
    const supabase = createClient()
    const { data } = await supabase.from('tt_companies').select('*').eq('is_active', true).order('name')
    if (data) {
      setCompanies(data as Company[])
      if (data.length > 0) setSelectedCompanyId(data[0].id)
    }
  }

  async function generateQuoteNumber() {
    const supabase = createClient()
    const year = new Date().getFullYear()
    // Buscar la ultima cotizacion de este anio
    const { data } = await supabase
      .from('tt_quotes')
      .select('quote_number')
      .ilike('quote_number', `COT-${year}-%`)
      .order('quote_number', { ascending: false })
      .limit(1)

    let nextNum = 1
    if (data && data.length > 0) {
      const lastNum = data[0].quote_number.split('-').pop()
      nextNum = (parseInt(lastNum || '0', 10) || 0) + 1
    }
    setQuoteNumber(`COT-${year}-${nextNum.toString().padStart(4, '0')}`)
  }

  async function searchClients(query: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('tt_clients')
      .select('*')
      .or(`company_name.ilike.%${query}%,legal_name.ilike.%${query}%,tax_id.ilike.%${query}%,email.ilike.%${query}%`)
      .eq('is_active', true)
      .limit(10)
    setClientResults((data || []) as Client[])
    setShowClientDropdown(true)
  }

  async function searchProducts(query: string) {
    setSearchingProducts(true)
    const supabase = createClient()
    const tokens = query.trim().toLowerCase().split(/\s+/)
    let q = supabase
      .from('tt_products')
      .select('id, sku, name, brand, price_list, price_currency, image_url')
      .eq('is_active', true)
      .limit(20)

    for (const token of tokens) {
      q = q.or(`name.ilike.%${token}%,sku.ilike.%${token}%,brand.ilike.%${token}%`)
    }

    const { data } = await q
    setProductResults((data || []) as ProductSearchResult[])
    setSearchingProducts(false)
  }

  function addProductAsItem(product: ProductSearchResult) {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        product_id: product.id,
        sku: product.sku,
        description: product.name,
        quantity: 1,
        unitPrice: product.price_list,
        discount: 0,
        notes: '',
      },
    ])
    setShowProductSearch(false)
    setProductSearch('')
    addToast({ type: 'success', title: 'Producto agregado', message: product.sku })
  }

  function addEmptyItem() {
    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        product_id: null,
        sku: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        notes: '',
      },
    ])
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function updateItem(id: string, field: keyof QuoteLineItem, value: string | number) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)))
  }

  function updateQuantity(id: string, delta: number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i))
    )
  }

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (1 - i.discount / 100), 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  async function saveQuote() {
    if (!selectedCompanyId) {
      addToast({ type: 'error', title: 'Selecciona una empresa emisora' })
      return
    }
    if (items.length === 0) {
      addToast({ type: 'error', title: 'Agrega al menos un item' })
      return
    }

    setSaving(true)
    const supabase = createClient()

    try {
      // Insertar cotizacion
      const { data: quoteData, error: quoteError } = await supabase
        .from('tt_quotes')
        .insert({
          quote_number: quoteNumber,
          company_id: selectedCompanyId,
          client_id: selectedClient?.id || null,
          created_by: (await supabase.from('tt_users').select('id').eq('role', 'admin').limit(1).single()).data?.id || null,
          status: 'borrador',
          notes,
          internal_notes: internalNotes,
          incoterm: incoterm || null,
          currency,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          validity_days: 30,
          expires_at: validUntil ? new Date(validUntil).toISOString() : null,
        })
        .select('id')
        .single()

      if (quoteError) throw quoteError

      // Insertar items
      const quoteItems = items.map((item, idx) => ({
        quote_id: quoteData.id,
        product_id: item.product_id,
        sort_order: idx + 1,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_percent: item.discount,
        subtotal: item.quantity * item.unitPrice * (1 - item.discount / 100),
        notes: item.notes || null,
      }))

      const { error: itemsError } = await supabase.from('tt_quote_items').insert(quoteItems)
      if (itemsError) throw itemsError

      // Log de actividad
      await supabase.from('tt_activity_log').insert({
        entity_type: 'quote',
        entity_id: quoteData.id,
        action: 'Cotizacion creada',
        description: `${quoteNumber} - ${selectedClient?.company_name || 'Sin cliente'} - ${formatCurrency(total, currency)}`,
      })

      addToast({ type: 'success', title: 'Cotizacion guardada', message: quoteNumber })

      // Reset para nueva cotizacion
      setItems([])
      setNotes('')
      setInternalNotes('')
      setSelectedClient(null)
      generateQuoteNumber()
    } catch (err) {
      console.error('Error guardando cotizacion:', err)
      addToast({ type: 'error', title: 'Error al guardar', message: 'Revisa los datos e intenta de nuevo' })
    } finally {
      setSaving(false)
    }
  }

  async function loadSavedQuotes() {
    setLoadingQuotes(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('tt_quotes')
      .select('id, quote_number, status, total, currency, created_at, client:tt_clients(company_name)')
      .order('created_at', { ascending: false })
      .limit(20)

    setSavedQuotes((data as unknown as SavedQuote[]) || [])
    setLoadingQuotes(false)
    setShowSavedQuotes(true)
  }

  function shareWhatsApp() {
    const text = `Cotizacion ${quoteNumber}\nCliente: ${selectedClient?.company_name || '-'}\nTotal: ${formatCurrency(total, currency)}\nItems: ${items.length}`
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  function handlePrint() {
    window.print()
  }

  const companyOptions = companies.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.currency})`,
  }))

  return (
    <div className="space-y-6 animate-fade-in print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Cotizador</h1>
          <p className="text-[#6B7280] mt-1 font-mono">{quoteNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadSavedQuotes}>
            <List size={14} /> Cotizaciones guardadas
          </Button>
          <Button variant="secondary" onClick={saveQuote} loading={saving}>
            <Save size={16} /> Guardar
          </Button>
        </div>
      </div>

      {/* Empresa & Cliente */}
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
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              placeholder="Seleccionar empresa..."
            />
            {selectedCompanyId && (
              <p className="text-xs text-[#4B5563] mt-2">
                Moneda: <span className="text-[#FF6600] font-medium">{currency}</span>
              </p>
            )}
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
                  <p className="text-xs text-[#6B7280]">{selectedClient.tax_id} - {selectedClient.email}</p>
                </div>
                <button onClick={() => setSelectedClient(null)} className="text-[#6B7280] hover:text-red-400">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchBar
                  placeholder="Buscar cliente por nombre, CUIT, email..."
                  value={clientSearch}
                  onChange={setClientSearch}
                />
                {showClientDropdown && clientResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#141820] border border-[#1E2330] rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                    {clientResults.map((client) => (
                      <button
                        key={client.id}
                        onClick={() => {
                          setSelectedClient(client)
                          setClientSearch('')
                          setShowClientDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#1E2330] transition-colors"
                      >
                        <p className="text-sm text-[#F0F2F5]">{client.company_name}</p>
                        <p className="text-xs text-[#6B7280]">{client.tax_id} - {client.email}</p>
                      </button>
                    ))}
                  </div>
                )}
                {showClientDropdown && clientSearch && clientResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#141820] border border-[#1E2330] rounded-lg shadow-xl z-10">
                    <p className="px-4 py-3 text-sm text-[#4B5563]">No se encontraron clientes</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Items de la cotizacion</CardTitle>
          <div className="flex gap-2 print:hidden">
            <Button variant="secondary" size="sm" onClick={() => setShowProductSearch(true)}>
              <Search size={14} /> Buscar producto
            </Button>
            <Button variant="primary" size="sm" onClick={addEmptyItem}>
              <Plus size={14} /> Linea manual
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#4B5563] border border-dashed border-[#1E2330] rounded-lg">
              <FileText size={36} className="mb-3" />
              <p className="text-sm">No hay items todavia</p>
              <p className="text-xs mt-1">Agrega productos desde el buscador o con linea manual</p>
              <div className="flex gap-2 mt-4">
                <Button variant="primary" size="sm" onClick={() => setShowProductSearch(true)}>
                  <Search size={14} /> Buscar producto
                </Button>
                <Button variant="secondary" size="sm" onClick={addEmptyItem}>
                  <Plus size={14} /> Linea manual
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2330]">
                    <th className="text-left py-2 px-2 text-xs text-[#6B7280] font-medium w-8">#</th>
                    <th className="text-left py-2 px-2 text-xs text-[#6B7280] font-medium w-28">SKU</th>
                    <th className="text-left py-2 px-2 text-xs text-[#6B7280] font-medium">Descripcion</th>
                    <th className="text-center py-2 px-2 text-xs text-[#6B7280] font-medium w-28">Cant.</th>
                    <th className="text-right py-2 px-2 text-xs text-[#6B7280] font-medium w-28">P. Unit.</th>
                    <th className="text-center py-2 px-2 text-xs text-[#6B7280] font-medium w-20">Dto %</th>
                    <th className="text-right py-2 px-2 text-xs text-[#6B7280] font-medium w-28">Subtotal</th>
                    <th className="text-left py-2 px-2 text-xs text-[#6B7280] font-medium w-32">Notas</th>
                    <th className="w-10 print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const lineTotal = item.quantity * item.unitPrice * (1 - item.discount / 100)
                    return (
                      <tr key={item.id} className="border-b border-[#1E2330]/50">
                        <td className="py-2 px-2 text-xs text-[#4B5563]">{idx + 1}</td>
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
                            placeholder="Descripcion del producto"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="p-0.5 rounded hover:bg-[#1E2330] text-[#6B7280] print:hidden"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, Number(e.target.value)))}
                              className="w-12 bg-[#0F1218] border border-[#1E2330] rounded px-1 py-1 text-center text-sm text-[#F0F2F5] outline-none focus:border-[#FF6600]"
                            />
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="p-0.5 rounded hover:bg-[#1E2330] text-[#6B7280] print:hidden"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
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
                        <td className="py-2 px-2">
                          <input
                            value={item.notes}
                            onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                            className="w-full bg-transparent text-xs text-[#6B7280] outline-none"
                            placeholder="Notas"
                          />
                        </td>
                        <td className="py-2 px-1 print:hidden">
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

      {/* Bottom: Notes + Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Notes & Config */}
        <Card>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">Notas (visible al cliente)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg bg-[#1E2330] border border-[#2A3040] px-3 py-2 text-sm text-[#F0F2F5] placeholder:text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                placeholder="Notas para el cliente..."
              />
            </div>
            <div className="print:hidden">
              <label className="block text-sm font-medium text-[#9CA3AF] mb-1.5">Notas internas (solo admin)</label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg bg-[#1E2330] border border-[#2A3040] px-3 py-2 text-sm text-[#F0F2F5] placeholder:text-[#4B5563] focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                placeholder="Notas internas..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Incoterm"
                options={INCOTERMS.map((i) => ({ value: i, label: i }))}
                value={incoterm}
                onChange={(e) => setIncoterm(e.target.value)}
                placeholder="Seleccionar..."
              />
              <Input
                label="Valido hasta"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#6B7280]">Subtotal ({items.length} items)</span>
              <span className="text-[#D1D5DB]">{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[#6B7280]">IVA</span>
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-14 bg-[#0F1218] border border-[#1E2330] rounded px-2 py-0.5 text-center text-xs text-[#F0F2F5] print:border-none"
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
            <div className="flex gap-2 pt-2 print:hidden">
              <Button variant="secondary" size="sm" className="flex-1" onClick={handlePrint}>
                <Printer size={14} /> PDF / Imprimir
              </Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={shareWhatsApp}>
                <MessageSquare size={14} /> WhatsApp
              </Button>
            </div>

            <Button
              variant="primary"
              className="w-full mt-2 print:hidden"
              onClick={saveQuote}
              loading={saving}
            >
              <Save size={16} /> Guardar cotizacion
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Product Search Modal */}
      <Modal
        isOpen={showProductSearch}
        onClose={() => { setShowProductSearch(false); setProductSearch(''); setProductResults([]) }}
        title="Buscar Producto"
        size="lg"
      >
        <SearchBar
          placeholder="Buscar por SKU, nombre, marca..."
          value={productSearch}
          onChange={setProductSearch}
          autoFocus
          className="mb-4"
        />
        {searchingProducts && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-[#FF6600]" />
          </div>
        )}
        {!searchingProducts && productResults.length === 0 && productSearch && (
          <p className="text-sm text-[#4B5563] text-center py-8">No se encontraron productos</p>
        )}
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {productResults.map((p) => (
            <button
              key={p.id}
              onClick={() => addProductAsItem(p)}
              className="w-full text-left flex items-center justify-between p-3 rounded-lg hover:bg-[#1E2330] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-[#0F1218] border border-[#1E2330] flex items-center justify-center shrink-0 overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                  ) : (
                    <FileText size={14} className="text-[#2A3040]" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-mono text-[#6B7280]">{p.sku}</p>
                  <p className="text-sm text-[#F0F2F5]">{p.name}</p>
                  <Badge variant="default" className="mt-0.5">{p.brand}</Badge>
                </div>
              </div>
              <span className="text-sm font-bold text-[#FF6600] shrink-0 ml-3">
                {p.price_list > 0 ? formatCurrency(p.price_list, (p.price_currency || 'EUR') as 'EUR' | 'ARS' | 'USD') : 'Consultar'}
              </span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Saved Quotes Modal */}
      <Modal
        isOpen={showSavedQuotes}
        onClose={() => setShowSavedQuotes(false)}
        title="Cotizaciones Guardadas"
        size="lg"
      >
        {loadingQuotes ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-[#FF6600]" />
          </div>
        ) : savedQuotes.length === 0 ? (
          <p className="text-sm text-[#4B5563] text-center py-8">No hay cotizaciones guardadas</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {savedQuotes.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#0F1218] border border-[#1E2330] hover:border-[#2A3040] transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-[#FF6600]">{q.quote_number}</span>
                    <Badge variant={
                      q.status === 'aceptada' ? 'success' :
                      q.status === 'rechazada' ? 'danger' :
                      q.status === 'enviada' ? 'info' : 'default'
                    }>
                      {q.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {q.client?.company_name || 'Sin cliente'} - {new Date(q.created_at).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <span className="text-sm font-bold text-[#F0F2F5]">
                  {formatCurrency(q.total, (q.currency || 'EUR') as 'EUR' | 'ARS' | 'USD')}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
