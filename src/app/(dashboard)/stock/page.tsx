'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { SearchBar } from '@/components/ui/search-bar'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { KPICard } from '@/components/ui/kpi-card'
import { Package, AlertTriangle, XCircle, CheckCircle } from 'lucide-react'

const MOCK_STOCK = [
  { sku: 'ASM18-8', name: 'Atornillador FEIN ASM 18-8', brand: 'FEIN', warehouse: 'Buenos Aires', qty: 12, min: 5 },
  { sku: 'ASM18-12', name: 'Atornillador FEIN ASM 18-12', brand: 'FEIN', warehouse: 'Buenos Aires', qty: 3, min: 5 },
  { sku: 'QL100N4', name: 'Torquímetro Tohnichi QL100N4', brand: 'TOHNICHI', warehouse: 'Madrid', qty: 0, min: 2 },
  { sku: 'BL2000', name: 'Balanceador Tecna BL2000', brand: 'TECNA', warehouse: 'Buenos Aires', qty: 8, min: 3 },
  { sku: 'IR2135', name: 'Llave impacto IR 2135', brand: 'INGERSOLL RAND', warehouse: 'Miami', qty: 1, min: 3 },
  { sku: 'SD-PRO-16', name: 'Taladro SpeeDrill PRO 16mm', brand: 'SPEEDRILL', warehouse: 'Buenos Aires', qty: 15, min: 5 },
]

export default function StockPage() {
  const [search, setSearch] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')

  const warehouses = [...new Set(MOCK_STOCK.map(s => s.warehouse))]
  const brands = [...new Set(MOCK_STOCK.map(s => s.brand))]

  const filtered = MOCK_STOCK.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.sku.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.brand.toLowerCase().includes(q)
    const matchWH = !warehouseFilter || s.warehouse === warehouseFilter
    const matchBrand = !brandFilter || s.brand === brandFilter
    return matchSearch && matchWH && matchBrand
  })

  const totalItems = MOCK_STOCK.length
  const inStock = MOCK_STOCK.filter(s => s.qty > s.min).length
  const lowStock = MOCK_STOCK.filter(s => s.qty > 0 && s.qty <= s.min).length
  const outOfStock = MOCK_STOCK.filter(s => s.qty === 0).length

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F0F2F5]">Stock</h1>
        <p className="text-sm text-gray-400 mt-1">Control de inventario multi-almacén</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total productos" value={totalItems} icon={<Package size={20} />} />
        <KPICard label="En stock" value={inStock} icon={<CheckCircle size={20} />} color="#00C853" />
        <KPICard label="Stock bajo" value={lowStock} icon={<AlertTriangle size={20} />} color="#FFB300" />
        <KPICard label="Sin stock" value={outOfStock} icon={<XCircle size={20} />} color="#FF3D00" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle>Inventario</CardTitle>
            <div className="flex flex-wrap gap-2">
              <select
                value={warehouseFilter}
                onChange={e => setWarehouseFilter(e.target.value)}
                className="bg-[#1C2230] border border-[#2A3040] text-[#F0F2F5] text-sm rounded-lg px-3 py-2"
              >
                <option value="">Todos los almacenes</option>
                {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
              <select
                value={brandFilter}
                onChange={e => setBrandFilter(e.target.value)}
                className="bg-[#1C2230] border border-[#2A3040] text-[#F0F2F5] text-sm rounded-lg px-3 py-2"
              >
                <option value="">Todas las marcas</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar por SKU, nombre o marca..." />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.sku + s.warehouse}>
                  <TableCell className="font-mono text-sm">{s.sku}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell><Badge>{s.brand}</Badge></TableCell>
                  <TableCell className="text-gray-400">{s.warehouse}</TableCell>
                  <TableCell className={`text-right font-bold text-lg ${stockColor(s.qty, s.min)}`}>{s.qty}</TableCell>
                  <TableCell>{stockBadge(s.qty, s.min)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-8">
                    Sin resultados
                  </td>
                </tr>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
