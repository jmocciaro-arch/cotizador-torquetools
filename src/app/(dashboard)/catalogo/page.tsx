'use client'

import { useState, useMemo } from 'react'
import { SearchBar } from '@/components/ui/search-bar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { BRANDS, formatCurrency } from '@/lib/utils'
import { Package, Filter, Grid3X3, List, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'

// Demo products
const demoProducts = [
  { id: '1', sku: 'FEIN-72227760000', name: 'Multimaster AMM 700 Max Top', brand: 'FEIN', category_name: 'Herramientas Eléctricas', price_list: 589.00, price_currency: 'EUR', image_url: null, description: 'Herramienta oscilante inalámbrica 18V con sistema StarLock Max', specs: { 'Voltaje': '18V', 'Oscilación': '11.000-18.000 opm', 'Peso': '1.8 kg' } },
  { id: '2', sku: 'TOH-CL50NX15D', name: 'Torquímetro CL50Nx15D', brand: 'Tohnichi', category_name: 'Torquímetros', price_list: 1250.00, price_currency: 'EUR', image_url: null, description: 'Torquímetro tipo click con cabeza intercambiable', specs: { 'Rango': '10-50 Nm', 'Precisión': '±3%', 'Largo': '285 mm' } },
  { id: '3', sku: 'TECNA-3664', name: 'Soldadora de puntos TECNA 3664', brand: 'Tecna', category_name: 'Soldadura por Puntos', price_list: 4200.00, price_currency: 'EUR', image_url: null, description: 'Soldadora de puntos portátil para chapas de acero', specs: { 'Potencia': '50 kVA', 'Espesor max': '4+4 mm', 'Refrigeración': 'Agua' } },
  { id: '4', sku: 'IR-2145QIMAX', name: 'Llave de impacto 2145QiMAX', brand: 'Ingersoll Rand', category_name: 'Herramientas Neumáticas', price_list: 890.00, price_currency: 'EUR', image_url: null, description: 'Llave de impacto neumática de 3/4"', specs: { 'Torque': '2.170 Nm', 'Cuadrado': '3/4"', 'Peso': '3.4 kg' } },
  { id: '5', sku: 'SD-MSD1200', name: 'Taladro magnético MSD1200', brand: 'SpeeDrill', category_name: 'Taladros', price_list: 2100.00, price_currency: 'EUR', image_url: null, description: 'Taladro magnético con base giratoria 360°', specs: { 'Motor': '1200W', 'Broca max': '50 mm', 'Profundidad': '50 mm' } },
  { id: '6', sku: 'FIAM-26BAR', name: 'Atornillador neumático 26BAR', brand: 'FIAM', category_name: 'Atornilladores', price_list: 560.00, price_currency: 'EUR', image_url: null, description: 'Atornillador neumático recto con embrague de desconexón', specs: { 'Torque': '4-26 Nm', 'RPM': '800', 'Peso': '0.9 kg' } },
  { id: '7', sku: 'FEIN-63502236210', name: 'Amoladora CCG 18-125 BL', brand: 'FEIN', category_name: 'Amoladoras', price_list: 425.00, price_currency: 'EUR', image_url: null, description: 'Amoladora angular inalámbrica 18V sin escobillas', specs: { 'Disco': '125 mm', 'Voltaje': '18V', 'RPM': '2.500-8.500' } },
  { id: '8', sku: 'APEX-EX-376-4', name: 'Vaso de impacto largo 3/8"', brand: 'Apex', category_name: 'Accesorios', price_list: 18.50, price_currency: 'EUR', image_url: null, description: 'Vaso de impacto serie larga hexagonal', specs: { 'Cuadrado': '3/8"', 'Medida': '10 mm', 'Material': 'Cr-Mo' } },
]

type ProductType = typeof demoProducts[number]

export default function CatalogoPage() {
  const [search, setSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null)
  const [page, setPage] = useState(1)
  const perPage = 12

  const filtered = useMemo(() => {
    let result = demoProducts
    if (selectedBrand) {
      result = result.filter(p => p.brand === selectedBrand)
    }
    if (search) {
      const tokens = search.toLowerCase().split(/\s+/)
      result = result.filter(p => {
        const haystack = `${p.sku} ${p.name} ${p.brand} ${p.category_name}`.toLowerCase()
        return tokens.every(t => haystack.includes(t))
      })
    }
    return result
  }, [search, selectedBrand])

  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Catálogo de Productos</h1>
          <p className="text-[#6B7280] mt-1">{filtered.length.toLocaleString()} productos encontrados</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'secondary'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 size={16} />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'secondary'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List size={16} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <SearchBar
        placeholder="Buscar por SKU, nombre, marca..."
        value={search}
        onChange={(v) => { setSearch(v); setPage(1) }}
        className="max-w-2xl"
      />

      {/* Brand filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setSelectedBrand(null); setPage(1) }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            !selectedBrand
              ? 'bg-[#FF6600] text-white'
              : 'bg-[#1E2330] text-[#9CA3AF] hover:bg-[#2A3040]'
          }`}
        >
          Todas
        </button>
        {BRANDS.map(brand => (
          <button
            key={brand}
            onClick={() => { setSelectedBrand(selectedBrand === brand ? null : brand); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedBrand === brand
                ? 'bg-[#FF6600] text-white'
                : 'bg-[#1E2330] text-[#9CA3AF] hover:bg-[#2A3040]'
            }`}
          >
            {brand}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#4B5563]">
          <Package size={48} className="mb-4" />
          <p className="text-lg font-medium">No se encontraron productos</p>
          <p className="text-sm mt-1">Probá con otros términos de búsqueda</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginated.map(product => (
            <Card
              key={product.id}
              hover
              onClick={() => setSelectedProduct(product)}
              className="flex flex-col"
            >
              {/* Image placeholder */}
              <div className="aspect-square rounded-lg bg-[#0F1218] border border-[#1E2330] flex items-center justify-center mb-3">
                <Package size={40} className="text-[#2A3040]" />
              </div>
              <Badge variant="default" className="w-fit mb-2">{product.brand}</Badge>
              <p className="text-xs font-mono text-[#6B7280] mb-1">{product.sku}</p>
              <h3 className="text-sm font-medium text-[#F0F2F5] line-clamp-2 flex-1">{product.name}</h3>
              <p className="text-xs text-[#4B5563] mt-1">{product.category_name}</p>
              <p className="text-lg font-bold text-[#FF6600] mt-2">
                {formatCurrency(product.price_list, product.price_currency as 'EUR' | 'ARS' | 'USD')}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map(product => (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#141820] border border-[#1E2330] hover:border-[#2A3040] transition-all cursor-pointer"
            >
              <div className="w-16 h-16 rounded-lg bg-[#0F1218] border border-[#1E2330] flex items-center justify-center shrink-0">
                <Package size={24} className="text-[#2A3040]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="default">{product.brand}</Badge>
                  <span className="text-xs font-mono text-[#6B7280]">{product.sku}</span>
                </div>
                <h3 className="text-sm font-medium text-[#F0F2F5] mt-1 truncate">{product.name}</h3>
                <p className="text-xs text-[#4B5563]">{product.category_name}</p>
              </div>
              <p className="text-lg font-bold text-[#FF6600] shrink-0">
                {formatCurrency(product.price_list, product.price_currency as 'EUR' | 'ARS' | 'USD')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-[#6B7280] px-4">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}

      {/* Product Detail Modal */}
      <Modal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.name || ''}
        size="lg"
      >
        {selectedProduct && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Image */}
              <div className="w-full sm:w-48 aspect-square rounded-lg bg-[#0F1218] border border-[#1E2330] flex items-center justify-center shrink-0">
                <Package size={48} className="text-[#2A3040]" />
              </div>
              {/* Info */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="orange">{selectedProduct.brand}</Badge>
                  <Badge variant="default">{selectedProduct.category_name}</Badge>
                </div>
                <p className="text-sm font-mono text-[#6B7280]">{selectedProduct.sku}</p>
                <p className="text-sm text-[#D1D5DB]">{selectedProduct.description}</p>
                <p className="text-2xl font-bold text-[#FF6600]">
                  {formatCurrency(selectedProduct.price_list, selectedProduct.price_currency as 'EUR' | 'ARS' | 'USD')}
                </p>
              </div>
            </div>

            {/* Specs */}
            {selectedProduct.specs && Object.keys(selectedProduct.specs).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#F0F2F5] mb-3">Especificaciones</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedProduct.specs).map(([key, value]) => (
                    <div key={key} className="flex justify-between p-2.5 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                      <span className="text-xs text-[#6B7280]">{key}</span>
                      <span className="text-xs font-medium text-[#F0F2F5]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="primary" className="flex-1">Agregar a cotización</Button>
              <Button variant="secondary">Ver stock</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
