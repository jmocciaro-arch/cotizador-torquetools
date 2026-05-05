'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save, Sparkles, Trash2, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  listTranslations,
  upsertTranslation,
  deleteTranslation,
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  type Locale,
  type ProductTranslation,
} from '@/lib/product-translations'

interface Props {
  productId: string
  baseFields: {
    name: string
    description: string | null
    short_description?: string | null
  }
}

export function ProductTranslationsTab({ productId, baseFields }: Props) {
  const { addToast } = useToast()
  const [activeLocale, setActiveLocale] = useState<Locale>('en')
  const [translations, setTranslations] = useState<Record<Locale, ProductTranslation | null>>({
    es: null, en: null, pt: null, fr: null, it: null,
  })
  const [draft, setDraft] = useState<ProductTranslation>({
    product_id: productId,
    locale: 'en',
    name: '',
    description: '',
    short_description: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const list = await listTranslations(productId)
    const map: Record<Locale, ProductTranslation | null> = { es: null, en: null, pt: null, fr: null, it: null }
    for (const t of list) {
      if ((SUPPORTED_LOCALES as readonly string[]).includes(t.locale)) {
        map[t.locale as Locale] = t
      }
    }
    setTranslations(map)
    setLoading(false)
  }, [productId])

  useEffect(() => { reload() }, [reload])

  // Cuando cambia el locale activo, cargar el draft
  useEffect(() => {
    const t = translations[activeLocale]
    setDraft({
      product_id: productId,
      locale: activeLocale,
      name: t?.name ?? '',
      description: t?.description ?? '',
      short_description: t?.short_description ?? '',
      seo_title: t?.seo_title ?? '',
      seo_description: t?.seo_description ?? '',
      seo_keywords: t?.seo_keywords ?? '',
    })
  }, [activeLocale, translations, productId])

  const handleSave = useCallback(async () => {
    setSaving(true)
    await upsertTranslation(draft)
    setSaving(false)
    addToast({ type: 'success', title: 'Traducción guardada', message: LOCALE_LABELS[activeLocale] })
    reload()
  }, [draft, activeLocale, addToast, reload])

  const handleDelete = useCallback(async () => {
    await deleteTranslation(productId, activeLocale)
    addToast({ type: 'success', title: 'Traducción eliminada' })
    reload()
  }, [productId, activeLocale, addToast, reload])

  // Stub IA — sólo deshabilitado, deja TODO claro
  const aiAvailable = false  // setear true cuando se exponga endpoint /api/ai/translate-product

  if (loading) {
    return <div className="text-sm text-[#9CA3AF] py-8 text-center">Cargando traducciones...</div>
  }

  return (
    <div className="space-y-4">
      {/* Selector de idioma */}
      <div className="flex items-center gap-1 bg-[#0A0D12] rounded-xl p-1 border border-[#1E2330]">
        {SUPPORTED_LOCALES.map(loc => {
          const has = !!translations[loc]
          const isEs = loc === 'es'
          return (
            <button
              key={loc}
              onClick={() => !isEs && setActiveLocale(loc)}
              disabled={isEs}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                isEs
                  ? 'bg-[#1E2330] text-[#6B7280] cursor-not-allowed'
                  : activeLocale === loc
                    ? 'bg-[#FF6600] text-white shadow-lg shadow-orange-500/20'
                    : 'text-[#9CA3AF] hover:text-[#F0F2F5] hover:bg-[#1E2330]'
              }`}
            >
              {LOCALE_LABELS[loc]} {has && !isEs && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              {isEs && <span className="text-[10px] opacity-70">(base)</span>}
            </button>
          )
        })}
      </div>

      {activeLocale === 'es' ? (
        <div className="space-y-3 p-4 rounded-xl border border-[#1E2330] bg-[#0F1218]">
          <p className="text-xs text-[#9CA3AF] flex items-center gap-2">
            <Globe size={13} className="text-[#FF6600]" />
            El idioma <strong>Español</strong> se edita desde la pestaña General — es la fuente de verdad.
          </p>
          <div className="text-xs text-[#6B7280] space-y-1">
            <div><strong className="text-[#9CA3AF]">Nombre actual:</strong> {baseFields.name}</div>
            {baseFields.description && <div><strong className="text-[#9CA3AF]">Descripción:</strong> {baseFields.description.slice(0, 200)}…</div>}
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-4 rounded-xl border border-[#1E2330] bg-[#0F1218]">
          <div>
            <label className="text-xs text-[#9CA3AF] mb-1 block">Nombre</label>
            <Input value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={baseFields.name} />
          </div>
          <div>
            <label className="text-xs text-[#9CA3AF] mb-1 block">Descripción corta</label>
            <Input value={draft.short_description || ''} onChange={(e) => setDraft({ ...draft, short_description: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-[#9CA3AF] mb-1 block">Descripción</label>
            <textarea
              rows={5}
              value={draft.description || ''}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder={baseFields.description || ''}
              className="w-full px-3 py-2 bg-[#0A0D12] border border-[#1E2330] rounded-lg text-sm text-[#F0F2F5]"
            />
          </div>

          <div className="pt-3 border-t border-[#1E2330] space-y-3">
            <h4 className="text-xs font-bold text-[#F0F2F5] uppercase tracking-wider">SEO</h4>
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Title</label>
              <Input value={draft.seo_title || ''} onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Description</label>
              <Input value={draft.seo_description || ''} onChange={(e) => setDraft({ ...draft, seo_description: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Keywords</label>
              <Input value={draft.seo_keywords || ''} onChange={(e) => setDraft({ ...draft, seo_keywords: e.target.value })} placeholder="separadas, por, comas" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#1E2330]">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!aiAvailable}
                title={aiAvailable ? 'Generar con IA' : 'Pendiente: endpoint /api/ai/translate-product'}
              >
                <Sparkles size={14} /> Generar con IA
              </Button>
              {translations[activeLocale] && (
                <Button size="sm" variant="ghost" onClick={handleDelete}>
                  <Trash2 size={14} /> Borrar traducción
                </Button>
              )}
            </div>
            <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
              <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
