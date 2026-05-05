/**
 * Tipos compartidos para los feeds de productos a marketplaces.
 */

export interface FeedProduct {
  id: string
  sku: string
  name: string
  description?: string | null
  brand?: string | null
  category?: string | null
  subcategory?: string | null
  price_eur?: number | null
  cost_eur?: number | null
  image_url?: string | null
  gallery_urls?: Array<{ url: string; alt?: string }> | null
  ean?: string | null
  manufacturer_code?: string | null
  weight_kg?: number | null
  active?: boolean
  lifecycle_status?: string | null
  // Para variantes:
  parent_product_id?: string | null
}

export interface FeedOptions {
  baseUrl?: string                  // URL pública del sitio para construir links
  currency?: string                 // ISO currency code
  defaultCondition?: 'new' | 'used' | 'refurbished'
  defaultAvailability?: 'in stock' | 'out of stock' | 'preorder'
  fieldMapping?: Record<string, string>
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function escapeCsv(s: string): string {
  const needsQuotes = /[",\n;]/.test(s)
  const escaped = s.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

export function productLink(p: FeedProduct, baseUrl?: string): string {
  if (!baseUrl) return `https://example.com/p/${encodeURIComponent(p.sku)}`
  return `${baseUrl.replace(/\/$/, '')}/p/${encodeURIComponent(p.sku)}`
}
