'use client'

import { useCallback, useState } from 'react'
import { Tag, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { generateLabelsPDF, type LabelProduct } from '@/lib/barcode-labels'

interface Props {
  products: LabelProduct[]
  disabled?: boolean
  asMenuItem?: boolean
}

export function LabelsButton({ products, disabled }: Props) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sheetSize, setSheetSize] = useState<'A4' | 'letter'>('A4')
  const [columns, setColumns] = useState(3)
  const [rows, setRows] = useState(8)
  const [format, setFormat] = useState<'standard' | 'price' | 'compact'>('standard')

  const handleGenerate = useCallback(async () => {
    if (products.length === 0) {
      addToast({ type: 'warning', title: 'No hay productos seleccionados' })
      return
    }
    setLoading(true)
    try {
      const blob = await generateLabelsPDF(products, { sheetSize, columns, rows, format })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `etiquetas_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      addToast({ type: 'success', title: `${products.length} etiquetas generadas` })
      setOpen(false)
    } catch (e) {
      addToast({ type: 'error', title: 'Error generando PDF', message: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [products, sheetSize, columns, rows, format, addToast])

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={disabled}>
        <Tag size={14} /> Etiquetas
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Generar etiquetas EAN13" size="lg">
        <div className="space-y-4">
          <p className="text-xs text-[#9CA3AF]">
            Generar etiquetas para <strong className="text-[#F0F2F5]">{products.length}</strong> productos.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Tamaño hoja</label>
              <select value={sheetSize} onChange={(e) => setSheetSize(e.target.value as 'A4' | 'letter')} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]">
                <option value="A4">A4</option>
                <option value="letter">Letter</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Formato</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as 'standard' | 'price' | 'compact')} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]">
                <option value="standard">Estándar (SKU + nombre + barcode)</option>
                <option value="price">Con precio</option>
                <option value="compact">Compacto (solo barcode)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Columnas</label>
              <input type="number" min={1} max={10} value={columns} onChange={(e) => setColumns(Number(e.target.value))} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]" />
            </div>
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Filas</label>
              <input type="number" min={1} max={20} value={rows} onChange={(e) => setRows(Number(e.target.value))} className="w-full h-10 px-3 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]" />
            </div>
          </div>

          <p className="text-xs text-[#6B7280]">
            {columns * rows} etiquetas por hoja → <strong className="text-[#F0F2F5]">{Math.ceil(products.length / (columns * rows))}</strong> hojas en total.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#1E2330]">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}><X size={14} /> Cancelar</Button>
            <Button size="sm" variant="primary" onClick={handleGenerate} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Tag size={14} />}
              {loading ? 'Generando...' : 'Generar PDF'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
