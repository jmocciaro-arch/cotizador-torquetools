'use client'

/**
 * Filtros facetados dinámicos por atributo de categoría.
 *
 * Lee `is_filter=true` de tt_catalog_category_attributes (vía useCatalogPresets)
 * y renderiza un grupo de chips por cada atributo con sus valores predefinidos.
 * Soporta multi-select. Los valores se aplican sobre tt_products.specs->>{code}.
 */

import { useMemo } from 'react'
import type {
  CatalogAttribute,
  CatalogAttributeValue,
} from '@/hooks/use-catalog-presets'

export interface DynamicFacetFiltersProps {
  /** Slug de la categoría activa */
  category: string | null
  /** Atributos para esta categoría con flag is_filter */
  attributes: Array<CatalogAttribute & { is_filter: boolean; is_required: boolean }>
  /** Función que devuelve los valores predefinidos para un atributo (por code) */
  getValuesForAttribute: (code: string) => CatalogAttributeValue[]
  /** Estado actual de filtros { attributeCode: [selectedValues] } */
  values: Record<string, string[]>
  /** Callback cuando cambia un filtro */
  onChange: (values: Record<string, string[]>) => void
}

export function DynamicFacetFilters({
  category,
  attributes,
  getValuesForAttribute,
  values,
  onChange,
}: DynamicFacetFiltersProps) {
  // Solo atributos con is_filter=true y que tengan valores predefinidos
  const filterableAttrs = useMemo(() => {
    return attributes
      .filter(a => a.is_filter)
      .map(a => ({ attr: a, options: getValuesForAttribute(a.code) }))
      .filter(({ options }) => options.length > 0)
  }, [attributes, getValuesForAttribute])

  if (!category || filterableAttrs.length === 0) return null

  const toggleValue = (attrCode: string, val: string) => {
    const current = values[attrCode] || []
    const next = current.includes(val)
      ? current.filter(v => v !== val)
      : [...current, val]
    const updated = { ...values }
    if (next.length === 0) delete updated[attrCode]
    else updated[attrCode] = next
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      {filterableAttrs.map(({ attr, options }) => {
        const selected = values[attr.code] || []
        return (
          <div key={attr.id}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4B5563] mb-2">
              {attr.name}{attr.unit ? ` (${attr.unit})` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {options.map(opt => {
                const isSelected = selected.includes(opt.value)
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleValue(attr.code, opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 ${
                      isSelected
                        ? 'border-[#FF6600] bg-[#FF6600]/15 text-[#FF6600]'
                        : 'border-[#2A3040] bg-[#0F1218] text-[#9CA3AF] hover:border-[#3A4050] hover:text-[#F0F2F5]'
                    }`}
                  >
                    {opt.label || opt.value}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
