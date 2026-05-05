'use client'

import { useCallback, useState } from 'react'
import { FileDown, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { generateCatalogPDF, type CatalogTemplate, type CatalogPDFProduct } from '@/lib/catalog-pdf'
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/product-translations'

interface Props {
  products: CatalogPDFProduct[]
  selectedProducts?: CatalogPDFProduct[]
  companyName?: string
  disabled?: boolean
}

export function CatalogPDFButton({ products, selectedProducts, companyName, disabled }: Props) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [locale, setLocale] = useState<Locale>('es')
  const [template, setTemplate] = useState<CatalogTemplate>('classic')
  const [includePrices, setIncludePrices] = useState(true)
  const [includeImages, setIncludeImages] = useState(true)
  const [includeDiagrams, setIncludeDiagrams] = useState(false)
  const [onlySelected, setOnlySelected] = useState(false)

  const handleGenerate = useCallback(async () => {
    const list = onlySelected && selectedProducts && selectedProducts.length > 0 ? selectedProducts : products
    if (list.length === 0) {
      addToast({ type: 'warning', title: 'No hay productos para generar' })
      return
    }
    setLoading(true)
    try {
      const blob = await generateCatalogPDF({
        products: list,
        companyName,
        locale,
        template,
        includePrices,
        includeImages,
        includeDiagrams,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `catalogo_${locale}_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      addToast({ type: 'success', title: `Catálogo PDF generado (${list.length} productos)` })
      setOpen(false)
    } catch (e) {
      addToast({ type: 'error', title: 'Error generando PDF', message: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [products, selectedProducts, onlySelected, locale, template, includePrices, includeImages, includeDiagrams, companyName, addToast])

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={disabled || products.length === 0}>
        <FileDown size={14} /> Catálogo PDF
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Generar catálogo PDF" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Idioma</label>
              <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]">
                {SUPPORTED_LOCALES.map(l => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Template</label>
              <select value={template} onChange={(e) => setTemplate(e.target.value as CatalogTemplate)} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]">
                <option value="compact">Compacto (1 fila por producto)</option>
                <option value="classic">Clásico (1 ficha por página)</option>
                <option value="visual">Visual (2 fichas por página)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 p-3 rounded-lg bg-[#0F1218] border border-[#1E2330]">
            <label className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              <input type="checkbox" checked={includePrices} onChange={(e) => setIncludePrices(e.target.checked)} />
              Incluir precios
            </label>
            <label className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} />
              Incluir imágenes principales
            </label>
            <label className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              <input type="checkbox" checked={includeDiagrams} onChange={(e) => setIncludeDiagrams(e.target.checked)} />
              Incluir diagramas técnicos (template clásico)
            </label>
            {selectedProducts && selectedProducts.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
                Solo productos seleccionados ({selectedProducts.length})
              </label>
            )}
          </div>

          <p className="text-xs text-[#6B7280]">
            Total a procesar: <strong className="text-[#F0F2F5]">{onlySelected && selectedProducts ? selectedProducts.length : products.length}</strong> productos.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2330]">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}><X size={14} /> Cancelar</Button>
            <Button size="sm" variant="primary" onClick={handleGenerate} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              {loading ? 'Generando...' : 'Generar'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
