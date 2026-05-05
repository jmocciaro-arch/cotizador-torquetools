'use client'

/**
 * Vistas guardadas para el catálogo de productos.
 *
 * Persiste en localStorage (clave `mocciaro:catalog:saved-views:v1`).
 * Soporta:
 *   - Vistas predefinidas no borrables (Sin imagen, Stock bajo, Sin coste actualizado).
 *   - Vistas custom del usuario (guardar / aplicar / borrar).
 *
 * UI: dropdown con lista + botón "Guardar vista actual".
 */

import { useEffect, useRef, useState } from 'react'
import { Bookmark, Plus, Trash2, ChevronDown, Lock } from 'lucide-react'

export interface SavedView {
  id: string
  name: string
  category: string | null
  subcategory: string | null
  filterBrands: string[]
  filterEncastres: string[]
  dynamicFilters: Record<string, string[]>
  lifecycleFilter: string[]
  sortBy: string
  viewMode: 'grid' | 'list'
  searchQuery: string
  /** Cuando es true, no se puede borrar y no se persiste */
  predefined?: boolean
}

const STORAGE_KEY = 'mocciaro:catalog:saved-views:v1'

/** Vistas predefinidas (no borrables, no se guardan en localStorage). */
export const PREDEFINED_VIEWS: SavedView[] = [
  {
    id: 'predef:no-image',
    name: 'Sin imagen',
    category: null,
    subcategory: null,
    filterBrands: [],
    filterEncastres: [],
    dynamicFilters: {},
    lifecycleFilter: ['activo'],
    sortBy: 'name_asc',
    viewMode: 'list',
    searchQuery: '',
    predefined: true,
  },
  {
    id: 'predef:low-stock',
    name: 'Stock bajo',
    category: null,
    subcategory: null,
    filterBrands: [],
    filterEncastres: [],
    dynamicFilters: {},
    lifecycleFilter: ['activo'],
    sortBy: 'name_asc',
    viewMode: 'list',
    searchQuery: '',
    predefined: true,
  },
  {
    id: 'predef:no-cost',
    name: 'Sin coste actualizado',
    category: null,
    subcategory: null,
    filterBrands: [],
    filterEncastres: [],
    dynamicFilters: {},
    lifecycleFilter: ['activo'],
    sortBy: 'name_asc',
    viewMode: 'list',
    searchQuery: '',
    predefined: true,
  },
]

export interface ProductSavedViewsProps {
  current: Omit<SavedView, 'id' | 'name' | 'predefined'>
  onApply: (view: SavedView) => void
}

export function ProductSavedViews({ current, onApply }: ProductSavedViewsProps) {
  const [views, setViews] = useState<SavedView[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as SavedView[]) : []
    } catch {
      return []
    }
  })
  const [open, setOpen] = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [newName, setNewName] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const persist = (next: SavedView[]) => {
    setViews(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // localStorage podría estar lleno o deshabilitado
    }
  }

  const saveCurrent = () => {
    const name = newName.trim()
    if (!name) return
    const view: SavedView = {
      id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      ...current,
    }
    persist([...views, view])
    setNewName('')
    setShowSave(false)
  }

  const deleteView = (id: string) => {
    persist(views.filter(v => v.id !== id))
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg border border-[#2A3040] bg-[#0F1218] text-[#9CA3AF] hover:text-[#F0F2F5] text-xs font-medium"
          title="Vistas guardadas"
        >
          <Bookmark size={13} />
          Vistas
          <ChevronDown size={11} className={open ? 'rotate-180' : ''} />
        </button>
        <button
          onClick={() => setShowSave(true)}
          className="flex items-center gap-1 px-2 h-9 rounded-lg border border-dashed border-[#2A3040] bg-[#0F1218] text-[#6B7280] hover:text-[#FF6600] hover:border-[#FF6600]/40 text-xs font-medium"
          title="Guardar la vista actual"
        >
          <Plus size={11} />
        </button>
      </div>

      {open && (
        <div className="absolute z-40 mt-1 right-0 w-64 rounded-xl bg-[#0F1218] border border-[#1E2330] shadow-2xl shadow-black/60 overflow-hidden">
          <div className="p-2 border-b border-[#1E2330] text-[10px] uppercase font-bold text-[#6B7280]">
            Predefinidas
          </div>
          <div className="max-h-[280px] overflow-y-auto py-1">
            {PREDEFINED_VIEWS.map(v => (
              <div key={v.id} className="flex items-center group hover:bg-[#1E2330]">
                <button
                  onClick={() => { onApply(v); setOpen(false) }}
                  className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left"
                >
                  <Lock size={11} className="text-[#4B5563]" />
                  <span className="text-[#F0F2F5] truncate">{v.name}</span>
                </button>
              </div>
            ))}

            <div className="px-2 py-1 mt-1 border-t border-[#1E2330] text-[10px] uppercase font-bold text-[#6B7280]">
              Mis vistas
            </div>
            {views.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[#6B7280] text-center">Sin vistas guardadas</p>
            ) : views.map(v => (
              <div key={v.id} className="flex items-center group hover:bg-[#1E2330]">
                <button
                  onClick={() => { onApply(v); setOpen(false) }}
                  className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left"
                >
                  <Bookmark size={11} className="text-[#FF6600]" />
                  <span className="text-[#F0F2F5] truncate">{v.name}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteView(v.id) }}
                  className="p-1.5 text-[#6B7280] hover:text-red-400 opacity-0 group-hover:opacity-100"
                  title="Eliminar"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSave && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSave(false)}>
          <div onClick={e => e.stopPropagation()} className="w-[420px] rounded-xl bg-[#0F1218] border border-[#1E2330] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bookmark size={14} className="text-[#FF6600]" />
              <strong className="text-sm text-[#F0F2F5]">Guardar vista actual</strong>
            </div>
            <p className="text-xs text-[#6B7280]">
              Se guardan los filtros, orden y modo de vista actuales.
            </p>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveCurrent() }}
              placeholder="Nombre (ej: Stock crítico AR)"
              className="w-full h-9 rounded-lg bg-[#1E2330] border border-[#2A3040] px-3 text-sm text-[#F0F2F5]"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowSave(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#9CA3AF] hover:text-[#F0F2F5]"
              >
                Cancelar
              </button>
              <button
                onClick={saveCurrent}
                disabled={!newName.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FF6600] text-white disabled:opacity-50 hover:bg-[#FF8833]"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
