'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { SearchBar } from '@/components/ui/search-bar'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { KPICard } from '@/components/ui/kpi-card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Stock, Warehouse } from '@/types'
import { Package, AlertTriangle, XCircle, CheckCircle, Loader2 } from 'lucide-react'

interface StockRow {
  id: string
  quantity: number
  reserved: number
  min_stock: number
  product_sku: string
  product_name: string
  product_brand: string
  warehouse_name: string
  warehouse_code: string
}

export default function StockPage() {
  const [stockItems, setStockItems] = useState<StockRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // KPIs
  const [kpis, setKpis] = useState({ total: 0, inStock: 0, lowStock: 0, outOfStock: 0 })

  useEffect(() => {
    loadWarehouses()
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadStock()
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, warehouseFilter, brandFilter])

  async function loadWarehouses() {
    const supabase = createClient()
    const { data } = await supabase
      .from('tt_warehouses')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setWarehouses((data || []) as Warehouse[])
  }

  const loadStock = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)

    try {
      // Stock join con productos y almacenes
      let query = supabase
        .from('tt_stock')
        .select(`
          id, quantity, reserved, min_stock,
          product:tt_products(sku, name, brand),
          warehouse:tt_warehouses(name, code)
        `)
        .order('quantity', { ascending: true })

      if (warehouseFilter) {
        query = query.eq('warehouse_id', warehouseFilter)
      }

      const { data } = await query

      if (!data || data.length === 0) {
        setStockItems([])
        setBrands([])
        setKpis({ total: 0, inStock: 0, lowStock: 0, outOfStock: 0 })
        setLoading(false)
        return
      }

      // Flatten joined data
      let items: StockRow[] = data.map((row: Record<string, unknown>) => {
        const product = row.product as Record<string, string> | null
        const warehouse = row.warehouse as Record<string, string> | null
        return {
          id: row.id as string,
          quantity: row.quantity as number,
          reserved: row.reserved as number,
          min_stock: row.min_stock as number,
          product_sku: product?.sku || '',
          product_name: product?.name || '',
          product_brand: product?.brand || '',
          warehouse_name: warehouse?.name || '',
          warehouse_code: warehouse?.code || '',
        }
      })

      // Unique brands
      const uniqueBrands = [...new Set(items.map((i) => i.product_brand).filter(Boolean))]
      uniqueBrands.sort()
      setBrands(uniqueBrands)

      // Brand filter
      if (brandFilter) {
        items = items.filter((i) => i.product_brand === brandFilter)
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase()
        items = items.filter(
          (i) =>
            i.product_sku.toLowerCase().includes(q) ||
            i.product_name.toLowerCase().includes(q) ||
            i.product_brand.toLowerCase().includes(q)
        )
      }

      // KPIs
      const total = items.length
      const inStock = items.filter((i) => i.quantity > i.min_stock).length
      const lowStock = items.filter((i) => i.quantity > 0 && i.quantity <= i.min_stock).length
      const outOfStock = items.filter((i) => i.quantity === 0).length
      setKpis({ total, inStock, lowStock, outOfStock })

      setStockItems(items)
    } catch (err) {
      console.error('Error cargando stock:', err)
    } finally {
      setLoading(false)
    }
  }, [search, warehouseFilter, brandFilter])

  function stockColor(qty: number, min: number) {
    if (qty === 0) return 'text-red-400'
    if (qty <= min) return 'text-yellow-400'
    return 'text-green-400'
  }

  function stockBadge(qty: number, min: number) {
    if (qty === 0) return <Badge variant="danger">Sin stock</Badge>
    if (qty <= min) return <Badge variant="warning">Stock bajo</Badge>
    return <Badge variant="success">OK</Badge>
  }

  const warehouseOptions = warehouses.map((w) => ({
    value: w.id,
    label: `${w.name} (${w.code})`,
  }))

  const brandOptions = brands.map((b) => ({ value: b, label: b }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F0F2F5]">Stock</h1>
        <p className="text-sm text-[#6B7280] mt-1">Control de inventario multi-almacen</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Total items"
          value={kpis.total}
          icon={<Package size={20} />}
        />
        <KPICard
          label="En stock"
          value={kpis.inStock}
          icon={<CheckCircle size={20} />}
          color="#00C853"
        />
        <KPICard
          label="Stock bajo"
          value={kpis.lowStock}
          icon={<AlertTriangle size={20} />}
          color="#FFB300"
        />
        <KPICard
          label="Sin stock"
          value={kpis.outOfStock}
          icon={<XCircle size={20} />}
          color="#FF3D00"
        />
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between w-full">
            <CardTitle>Inventario</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                options={warehouseOptions}
                placeholder="Todos los almacenes"
              />
              <Select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                options={brandOptions}
                placeholder="Todas las marcas"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por SKU, nombre o marca..."
          />

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={32} className="animate-spin text-[#FF6600]" />
            </div>
          ) : stockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#4B5563]">
              <Package size={48} className="mb-4" />
              <p className="text-lg font-medium">No hay datos de stock</p>
              <p className="text-sm mt-1">
                {warehouseFilter || brandFilter || search
                  ? 'Proba quitando filtros'
                  : 'La tabla tt_stock esta vacia. Los datos se cargan cuando se registren movimientos de stock.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Almacen</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockItems.map((s) => {
                  const available = s.quantity - s.reserved
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.product_sku}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{s.product_name}</TableCell>
                      <TableCell><Badge>{s.product_brand}</Badge></TableCell>
                      <TableCell className="text-[#9CA3AF]">{s.warehouse_name}</TableCell>
                      <TableCell className={`text-right font-bold text-lg ${stockColor(s.quantity, s.min_stock)}`}>
                        {s.quantity}
                      </TableCell>
                      <TableCell className="text-right text-[#6B7280]">{s.reserved}</TableCell>
                      <TableCell className={`text-right font-medium ${stockColor(available, s.min_stock)}`}>
                        {available}
                      </TableCell>
                      <TableCell>{stockBadge(s.quantity, s.min_stock)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Warehouses summary */}
      {warehouses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {warehouses.map((w) => (
            <Card key={w.id}>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#FF6600]/10 flex items-center justify-center">
                    <Package size={20} className="text-[#FF6600]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#F0F2F5]">{w.name}</p>
                    <p className="text-xs text-[#6B7280]">{w.code} - {w.city || w.country}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
