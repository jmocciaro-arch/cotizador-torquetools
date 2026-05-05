'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Layers, Wand2, X, Save, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  listVariants,
  saveVariant,
  deleteVariant,
  generateVariantMatrix,
  type ProductVariant,
} from '@/lib/product-variants'
import { isValidEan13 } from '@/lib/validators'

interface Props {
  productId: string
  productSku: string
}

interface Axis {
  attribute: string
  values: string[]
}

export function ProductVariantsTab({ productId, productSku }: Props) {
  const { addToast } = useToast()
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [axes, setAxes] = useState<Axis[]>([])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await listVariants(productId)
    setVariants(list)
    // Reconstruir axes a partir de las variantes existentes
    const attrMap = new Map<string, Set<string>>()
    for (const v of list) {
      for (const [k, val] of Object.entries(v.attributes)) {
        if (!attrMap.has(k)) attrMap.set(k, new Set())
        attrMap.get(k)!.add(val)
      }
    }
    if (attrMap.size > 0) {
      setAxes(Array.from(attrMap.entries()).map(([attribute, vals]) => ({
        attribute,
        values: Array.from(vals).sort(),
      })))
    }
    setLoading(false)
  }, [productId])

  useEffect(() => { reload() }, [reload])

  const addAxis = useCallback(() => {
    setAxes(prev => [...prev, { attribute: '', values: [] }])
  }, [])

  const updateAxis = useCallback((idx: number, patch: Partial<Axis>) => {
    setAxes(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a))
  }, [])

  const removeAxis = useCallback((idx: number) => {
    setAxes(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const addAxisValue = useCallback((idx: number, value: string) => {
    const v = value.trim()
    if (!v) return
    setAxes(prev => prev.map((a, i) =>
      i === idx ? { ...a, values: a.values.includes(v) ? a.values : [...a.values, v] } : a
    ))
  }, [])

  const removeAxisValue = useCallback((axisIdx: number, val: string) => {
    setAxes(prev => prev.map((a, i) =>
      i === axisIdx ? { ...a, values: a.values.filter(v => v !== val) } : a
    ))
  }, [])

  const handleGenerate = useCallback(async () => {
    const valid = axes.filter(a => a.attribute.trim() && a.values.length > 0)
    if (valid.length === 0) {
      addToast({ type: 'warning', title: 'Definí al menos un eje con valores' })
      return
    }
    setGenerating(true)
    const r = await generateVariantMatrix(productId, valid)
    setGenerating(false)
    addToast({
      type: 'success',
      title: `Generadas ${r.created} variantes`,
      message: r.skipped > 0 ? `${r.skipped} ya existían` : undefined,
    })
    await reload()
  }, [axes, productId, addToast, reload])

  const handleUpdateField = useCallback(async (id: string, patch: Partial<ProductVariant>) => {
    const variant = variants.find(v => v.id === id)
    if (!variant) return
    const next = { ...variant, ...patch }
    // Actualización optimista
    setVariants(prev => prev.map(v => v.id === id ? next : v))
    await saveVariant({ ...next, attributes: next.attributes })
  }, [variants])

  const handleDelete = useCallback(async (id: string) => {
    await deleteVariant(id)
    setConfirmDelete(null)
    setVariants(prev => prev.filter(v => v.id !== id))
    addToast({ type: 'success', title: 'Variante eliminada' })
  }, [addToast])

  const skuClash = useMemo(() => {
    const counts = new Map<string, number>()
    for (const v of variants) {
      const k = (v.sku || '').trim().toLowerCase()
      if (!k) continue
      counts.set(k, (counts.get(k) || 0) + 1)
    }
    return new Set(Array.from(counts.entries()).filter(([, n]) => n > 1).map(([k]) => k))
  }, [variants])

  if (loading) {
    return <div className="text-sm text-[#9CA3AF] py-8 text-center">Cargando variantes...</div>
  }

  return (
    <div className="space-y-6">
      {/* Sección 1: Definir ejes */}
      <div className="rounded-xl border border-[#1E2330] bg-[#0F1218] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#FF6600]" />
            <h3 className="text-sm font-bold text-[#F0F2F5] uppercase tracking-wider">Definí los ejes</h3>
          </div>
          <Button size="sm" variant="ghost" onClick={addAxis}>
            <Plus size={14} /> Sumar eje
          </Button>
        </div>

        {axes.length === 0 && (
          <p className="text-xs text-[#6B7280]">Por ejemplo: <span className="text-[#9CA3AF]">talle (S/M/L)</span>, <span className="text-[#9CA3AF]">color (rojo/azul)</span>.</p>
        )}

        {axes.map((axis, idx) => (
          <AxisEditor
            key={idx}
            axis={axis}
            onChangeAttribute={(v) => updateAxis(idx, { attribute: v })}
            onAddValue={(v) => addAxisValue(idx, v)}
            onRemoveValue={(v) => removeAxisValue(idx, v)}
            onRemove={() => removeAxis(idx)}
          />
        ))}

        {axes.length > 0 && (
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#1E2330]">
            <p className="text-xs text-[#6B7280]">
              Generaría hasta <strong className="text-[#F0F2F5]">{axes.reduce((acc, a) => acc * Math.max(a.values.length, 1), 1)}</strong> combinaciones.
            </p>
            <Button size="sm" variant="primary" onClick={handleGenerate} disabled={generating}>
              <Wand2 size={14} /> {generating ? 'Generando...' : 'Generá la matriz'}
            </Button>
          </div>
        )}
      </div>

      {/* Sección 2: Tabla de variantes */}
      <div className="rounded-xl border border-[#1E2330] bg-[#0F1218] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E2330] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#F0F2F5] uppercase tracking-wider">Variantes ({variants.length})</h3>
          <span className="text-xs text-[#6B7280]">Base: {productSku}</span>
        </div>

        {variants.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#6B7280]">
            Todavía no hay variantes. Definí ejes y generá la matriz.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0A0D12] text-[#6B7280] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Combo</th>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-left">EAN13</th>
                  <th className="px-3 py-2 text-right">EUR</th>
                  <th className="px-3 py-2 text-right">USD</th>
                  <th className="px-3 py-2 text-right">Peso (kg)</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map(v => {
                  const dupSku = skuClash.has((v.sku || '').toLowerCase())
                  const eanInvalid = v.ean ? !isValidEan13(v.ean) : false
                  return (
                    <tr key={v.id} className="border-t border-[#1E2330] hover:bg-[#1A1F2E]">
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(v.attributes).map(([k, val]) => (
                            <Badge key={k} variant="default" size="sm">{k}: {val}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={v.sku}
                          onChange={(e) => handleUpdateField(v.id, { sku: e.target.value })}
                          className={`h-7 text-xs ${dupSku ? 'border-red-500/40' : ''}`}
                        />
                        {dupSku && <span className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5"><AlertCircle size={10} /> SKU duplicado</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={v.ean || ''}
                          onChange={(e) => handleUpdateField(v.id, { ean: e.target.value || null })}
                          className={`h-7 text-xs ${eanInvalid ? 'border-amber-500/40' : ''}`}
                          placeholder="13 dígitos"
                        />
                        {eanInvalid && <span className="text-[10px] text-amber-400">EAN13 inválido</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={v.price_eur ?? ''}
                          onChange={(e) => handleUpdateField(v.id, { price_eur: e.target.value === '' ? null : Number(e.target.value) })}
                          className="h-7 text-xs text-right w-24"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={v.price_usd ?? ''}
                          onChange={(e) => handleUpdateField(v.id, { price_usd: e.target.value === '' ? null : Number(e.target.value) })}
                          className="h-7 text-xs text-right w-24"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.001"
                          value={v.weight_kg ?? ''}
                          onChange={(e) => handleUpdateField(v.id, { weight_kg: e.target.value === '' ? null : Number(e.target.value) })}
                          className="h-7 text-xs text-right w-20"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={v.lifecycle_status || 'activo'}
                          onChange={(e) => handleUpdateField(v.id, { lifecycle_status: e.target.value })}
                          className="h-7 text-xs bg-[#0A0D12] border border-[#1E2330] rounded px-2 text-[#F0F2F5]"
                        >
                          <option value="borrador">Borrador</option>
                          <option value="activo">Activo</option>
                          <option value="descatalogado">Descatalogado</option>
                          <option value="obsoleto">Obsoleto</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {confirmDelete === v.id ? (
                          <button
                            onClick={() => handleDelete(v.id)}
                            className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium uppercase tracking-wider"
                            title="Confirmá eliminación"
                          >
                            Confirmá
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(v.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-[#6B7280] hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-[#6B7280] flex items-center gap-2">
        <Save size={12} /> Los cambios se guardan automáticamente al editar.
      </div>
    </div>
  )
}

interface AxisEditorProps {
  axis: Axis
  onChangeAttribute: (v: string) => void
  onAddValue: (v: string) => void
  onRemoveValue: (v: string) => void
  onRemove: () => void
}

function AxisEditor({ axis, onChangeAttribute, onAddValue, onRemoveValue, onRemove }: AxisEditorProps) {
  const [newVal, setNewVal] = useState('')
  return (
    <div className="rounded-lg border border-[#1E2330] bg-[#141820] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={axis.attribute}
          onChange={(e) => onChangeAttribute(e.target.value)}
          placeholder="Atributo (ej: talle, color, voltaje)"
          className="h-8 text-xs flex-1"
        />
        <button onClick={onRemove} className="p-1.5 rounded hover:bg-red-500/10 text-[#6B7280] hover:text-red-400">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {axis.values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#FF6600]/10 text-[#FF6600] text-xs border border-[#FF6600]/20">
            {v}
            <button onClick={() => onRemoveValue(v)}><X size={11} /></button>
          </span>
        ))}
        <input
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newVal.trim()) {
              e.preventDefault()
              onAddValue(newVal)
              setNewVal('')
            }
          }}
          placeholder="Agregá un valor y dale Enter"
          className="bg-[#0A0D12] border border-[#1E2330] rounded-full px-3 py-1 text-xs text-[#F0F2F5] placeholder-[#6B7280] focus:outline-none focus:border-[#FF6600]/40 min-w-[160px]"
        />
      </div>
    </div>
  )
}
