/**
 * Helpers para `tt_product_translations` (v50) — multi-idioma sobre tt_products.
 *
 * El idioma `es` es el "principal" y vive directamente en tt_products. Los
 * demás (`en`, `pt`, `fr`, `it`) van en tt_product_translations.
 *
 * RPC `get_product_text(product_id, locale, field)` hace fallback automático
 * si no hay traducción para ese locale.
 */

import { createClient } from '@/lib/supabase/client'

export const SUPPORTED_LOCALES = ['es', 'en', 'pt', 'fr', 'it'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  fr: 'Français',
  it: 'Italiano',
}

export interface ProductTranslation {
  id?: string
  product_id: string
  locale: Locale
  name: string | null
  description: string | null
  short_description: string | null
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string | null
  updated_at?: string
}

export async function listTranslations(productId: string): Promise<ProductTranslation[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('tt_product_translations')
    .select('*')
    .eq('product_id', productId)
  if (error) {
    console.warn('listTranslations falló:', error.message)
    return []
  }
  return (data || []) as ProductTranslation[]
}

export async function upsertTranslation(t: ProductTranslation): Promise<void> {
  const sb = createClient()
  const payload = {
    product_id: t.product_id,
    locale: t.locale,
    name: t.name?.trim() || null,
    description: t.description?.trim() || null,
    short_description: t.short_description?.trim() || null,
    seo_title: t.seo_title?.trim() || null,
    seo_description: t.seo_description?.trim() || null,
    seo_keywords: t.seo_keywords?.trim() || null,
  }
  const { error } = await sb
    .from('tt_product_translations')
    .upsert(payload, { onConflict: 'product_id,locale' })
  if (error) console.warn('upsertTranslation falló:', error.message)
}

export async function deleteTranslation(productId: string, locale: Locale): Promise<void> {
  const sb = createClient()
  const { error } = await sb
    .from('tt_product_translations')
    .delete()
    .eq('product_id', productId)
    .eq('locale', locale)
  if (error) console.warn('deleteTranslation falló:', error.message)
}

/**
 * Lee un campo del producto en el locale dado, con fallback al de tt_products.
 * Usa la RPC `get_product_text` que ya implementa el fallback en el server.
 */
export async function getProductText(
  productId: string,
  locale: Locale,
  field: 'name' | 'description' | 'short_description' | 'seo_title' | 'seo_description' | 'seo_keywords'
): Promise<string | null> {
  const sb = createClient()
  const { data, error } = await sb.rpc('get_product_text', {
    p_product_id: productId,
    p_locale: locale,
    p_field: field,
  })
  if (error) {
    console.warn('getProductText falló:', error.message)
    return null
  }
  return (data as string | null) ?? null
}
