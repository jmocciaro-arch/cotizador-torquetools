'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { SearchBar } from '@/components/ui/search-bar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Package, Grid3X3, List, Loader2, ShoppingCart } from 'lucide-react'

const BRANDS = ['FEIN', 'TOHNICHI', 'TECNA', 'INGERSOLL RAND', 'SPEEDRILL', 'FIAM', 'APEX', 'URYU']
const PAGE_SIZE = 50

interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  brand: string
  category_name: string | null
  price_list: number
  price_currency: string
  image_url: string | null
  specs: Record<string, string> | null
  is_active: boolean
  torque_min: number | null
  torque_max: number | null
  rpm: number | null
  encastre: string | null
}

export default function CatalogoPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Cargar categorias al montar
  useEffect(() => {
    loadCategories()
  }, [])

  // Busqueda con debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setOffset(0)
      setProducts([])
      setHasMore(true)
      loadProducts(0, true)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, selectedBrand, selectedCategory])

  async function loadCategories() {
    const supabase = createClient()
    const { data } = await supabase
      .from('tt_products')
      .select('category_name')
      .not('category_name', 'is', null)
      .limit(1000)

    if (data) {
      const unique = [...new Set(data.map((d: { category_name: string | null }) => d.category_name).filter(Boolean) as string[])]
      unique.sort()
      setCategories(unique)
    }
  }

  const loadProducts = useCallback(async (fromOffset: number, reset: boolean = false) => {
    const supabase = createClient()
    if (reset) setLoading(true)
    else setLoadingMore(true)

    try {
      let query = supabase
        .from('tt_products')
        .select('id, sku, name, description, brand, category_name, price_list, price_currency, image_url, specs, is_active, torque_min, torque_max, rpm, encastre', { count: 'exact' })
        .eq('is_active', true)
        .order('name', { ascending: true })
        .range(fromOffset, fromOffset + PAGE_SIZE - 1)

      // Filtro por marca (case insensitive)
      if (selectedBrand) {
        query = query.ilike('brand', selectedBrand)
      }

      // Filtro por categoria
      if (selectedCategory) {
        query = query.eq('category_name', selectedCategory)
      }

      // Busqueda multi-token: dividir en tokens y buscar que TODOS esten presentes
      // Supabase no soporta AND nativo para ilike multi-token, asi que usamos textSearch o
      // hacemos multiples .ilike encadenados sobre un campo concatenado.
      // Mejor approach: filtrar con .or() sobre nombre+sku+brand para cada token
      if (search.trim()) {
        const tokens = search.trim().toLowerCase().split(/\s+/)
        for (const token of tokens) {
          // Cada token debe matchear en alguno de estos campos
          query = query.or(
            `name.ilike.%${token}%,sku.ilike.%${token}%,brand.ilike.%${token}%,category_name.ilike.%${token}%`
          )
        }
      }

      const { data, count, error } = await query

      if (error) {
        console.error('Error buscando productos:', error)
        return
      }

      const newProducts = (data || []) as Product[]
      if (reset) {
        setProducts(newProducts)
      } else {
        setProducts((prev) => [...prev, ...newProducts])
      }
      setTotalCount(count || 0)
      setOffset(fromOffset + PAGE_SIZE)
      setHasMore(newProducts.length === PAGE_SIZE)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [search, selectedBrand, selectedCategory])

  function handleLoadMore() {
    loadProducts(offset, false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F2F5]">Catalogo de Productos</h1>
          <p className="text-[#6B7280] mt-1">
            {loading ? 'Buscando...' : `${totalCount.toLocaleString('es-AR')} productos encontrados`}
          </p>
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

      {/* Barra de busqueda */}
      <SearchBar
        placeholder="Buscar por SKU, nombre, marca... (ej: fein amoladora 18v)"
        value={search}
        onChange={setSearch}
        className="max-w-2xl"
      />

      {/* Filtros de marca */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedBrand(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            !selectedBrand
              ? 'bg-[#FF6600] text-white'
              : 'bg-[#1E2330] text-[#9CA3AF] hover:bg-[#2A3040]'
          }`}
        >
          Todas
        </button>
        {BRANDS.map((brand) => (
          <button
            key={brand}
            onClick={() => setSelectedBrand(selectedBrand === brand ? null : brand)}
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

      {/* Filtros de categoria (dinamicos) */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-[#4B5563] self-center mr-1">Categoria:</span>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
              !selectedCategory
                ? 'bg-[#3B82F6] text-white'
                : 'bg-[#1E2330] text-[#6B7280] hover:bg-[#2A3040]'
            }`}
          >
            Todas
          </button>
          {categories.slice(0, 15).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#1E2330] text-[#6B7280] hover:bg-[#2A3040]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[#141820] border border-[#1E2330] p-5 animate-pulse">
              <div className="aspect-square rounded-lg bg-[#0F1218] mb-3" />
              <div className="h-4 bg-[#1E2330] rounded w-16 mb-2" />
              <div className="h-3 bg-[#1E2330] rounded w-24 mb-1" />
              <div className="h-4 bg-[#1E2330] rounded w-full mb-2" />
              <div className="h-6 bg-[#1E2330] rounded w-20 mt-2" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-[#4B5563]">
          <Package size={48} className="mb-4" />
          <p className="text-lg font-medium">No se encontraron productos</p>
          <p className="text-sm mt-1">Proba con otros terminos de busqueda o quitando filtros</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <Card key={product.id} hover onClick={() => setSelectedProduct(product)} className="flex flex-col">
              {/* Imagen */}
              <div className="aspect-square rounded-lg bg-[#0F1218] border border-[#1E2330] flex items-center justify-center mb-3 overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-2"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                      ;(e.target as HTMLImageElement).parentElement!.innerHTML =
                        '<div class="flex items-center justify-center w-full h-full"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2A3040" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg></div>'
                    }}
                  />
                ) : (
                  <Package size={40} className="text-[#2A3040]" />
                )}
              </div>
              <Badge variant="default" className="w-fit mb-2">{product.brand}</Badge>
              <p className="text-xs font-mono text-[#6B7280] mb-1">{product.sku}</p>
              <h3 className="text-sm font-medium text-[#F0F2F5] line-clamp-2 flex-1">{product.name}</h3>
              {product.category_name && (
                <p className="text-xs text-[#4B5563] mt-1">{product.category_name}</p>
              )}
              {/* Specs inline */}
              <div className="flex flex-wrap gap-1 mt-2">
                {product.torque_min != null && product.torque_max != null && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E2330] text-[#9CA3AF]">
                    {product.torque_min}-{product.torque_max} Nm
                  </span>
                )}
                {product.rpm != null && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E2330] text-[#9CA3AF]">
                    {product.rpm} RPM
                  </span>
                )}
                {product.encastre && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E2330] text-[#9CA3AF]">
                    {product.encastre}
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-[#FF6600] mt-2">
                {product.price_list > 0
                  ? formatCurrency(product.price_list, (product.price_currency || 'EUR') as 'EUR' | 'ARS' | 'USD')
                  : 'Consultar'}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#141820] border border-[#1E2330] hover:border-[#2A3040] transition-all cursor-pointer"
            >
              <div className="w-16 h-16 rounded-lg bg-[#0F1218] border border-[#1E2330] flex items-center justify-center shrink-0 overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <Package size={24} className="text-[#2A3040]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="default">{product.brand}</Badge>
                  <span className="text-xs font-mono text-[#6B7280]">{product.sku}</span>
                </div>
                <h3 className="text-sm font-medium text-[#F0F2F5] mt-1 truncate">{product.name}</h3>
                <div className="flex flex-wrap gap-1 mt-1">
                  {product.category_name && (
                    <span className="text-[10px] text-[#4B5563]">{product.category_name}</span>
                  )}
                  {product.torque_min != null && product.torque_max != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E2330] text-[#9CA3AF]">
                      {product.torque_min}-{product.torque_max} Nm
                    </span>
                  )}
                  {product.rpm != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E2330] text-[#9CA3AF]">
                      {product.rpm} RPM
                    </span>
                  )}
                </div>
              </div>
              <p className="text-lg font-bold text-[#FF6600] shrink-0">
                {product.price_list > 0
                  ? formatCurrency(product.price_list, (product.price_currency || 'EUR') as 'EUR' | 'ARS' | 'USD')
                  : 'Consultar'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Cargar mas */}
      {!loading && hasMore && products.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button variant="secondary" onClick={handleLoadMore} loading={loadingMore}>
            {loadingMore ? 'Cargando...' : `Cargar mas (mostrando ${products.length} de ${totalCount.toLocaleString('es-AR')})`}
          </Button>
        </div>
      )}

      {/* Modal de detalle del producto */}
      <Modal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.name || ''}
        size="lg"
      >
        {selectedProduct && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Imagen */}
              <div className="w-full sm:w-56 aspect-square rounded-lg bg-[#0F1218] border border-[#1E2330] flex items-center justify-center shrink-0 overflow-hidden">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-3"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <Package size={48} className="text-[#2A3040]" />
                )}
              </div>
              {/* Info */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="orange">{selectedProduct.brand}</Badge>
                  {selectedProduct.category_name && (
                    <Badge variant="default">{selectedProduct.category_name}</Badge>
                  )}
                </div>
                <p className="text-sm font-mono text-[#6B7280]">{selectedProduct.sku}</p>
                {selectedProduct.description && (
                  <p className="text-sm text-[#D1D5DB]">{selectedProduct.description}</p>
                )}

                {/* Key specs */}
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.torque_min != null && selectedProduct.torque_max != null && (
                    <div className="px-3 py-1.5 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                      <p className="text-[10px] text-[#4B5563]">Torque</p>
                      <p className="text-xs font-medium text-[#F0F2F5]">{selectedProduct.torque_min} - {selectedProduct.torque_max} Nm</p>
                    </div>
                  )}
                  {selectedProduct.rpm != null && (
                    <div className="px-3 py-1.5 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                      <p className="text-[10px] text-[#4B5563]">RPM</p>
                      <p className="text-xs font-medium text-[#F0F2F5]">{selectedProduct.rpm}</p>
                    </div>
                  )}
                  {selectedProduct.encastre && (
                    <div className="px-3 py-1.5 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                      <p className="text-[10px] text-[#4B5563]">Encastre</p>
                      <p className="text-xs font-medium text-[#F0F2F5]">{selectedProduct.encastre}</p>
                    </div>
                  )}
                </div>

                <p className="text-2xl font-bold text-[#FF6600]">
                  {selectedProduct.price_list > 0
                    ? formatCurrency(selectedProduct.price_list, (selectedProduct.price_currency || 'EUR') as 'EUR' | 'ARS' | 'USD')
                    : 'Consultar precio'}
                </p>
              </div>
            </div>

            {/* Specs JSONB */}
            {selectedProduct.specs && Object.keys(selectedProduct.specs).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-[#F0F2F5] mb-3">Especificaciones</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedProduct.specs).map(([key, value]) => (
                    <div key={key} className="flex justify-between p-2.5 rounded-lg bg-[#0F1218] border border-[#1E2330]">
                      <span className="text-xs text-[#6B7280]">{key}</span>
                      <span className="text-xs font-medium text-[#F0F2F5]">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-3 pt-2">
              <Button variant="primary" className="flex-1 gap-2">
                <ShoppingCart size={16} /> Agregar a cotizacion
              </Button>
              <Button variant="secondary">Ver stock</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
