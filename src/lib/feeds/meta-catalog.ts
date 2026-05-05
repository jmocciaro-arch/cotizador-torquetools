/**
 * Feed Meta Catalog (Facebook/Instagram) — CSV.
 * https://www.facebook.com/business/help/120325381656392
 */

import { type FeedProduct, type FeedOptions, escapeCsv, productLink } from './types'

const HEADERS = [
  'id', 'title', 'description', 'availability', 'condition', 'price',
  'link', 'image_link', 'brand', 'gtin', 'mpn', 'google_product_category',
  'item_group_id', 'additional_image_link',
]

export function generateMetaCatalog(products: FeedProduct[], opts: FeedOptions = {}): string {
  const currency = opts.currency || 'EUR'
  const condition = opts.defaultCondition || 'new'
  const availability = opts.defaultAvailability || 'in stock'

  const rows = products.map(p => {
    const price = p.price_eur != null ? `${p.price_eur.toFixed(2)} ${currency}` : ''
    const additional = (p.gallery_urls || []).slice(0, 10).map(g => g.url).filter(Boolean).join(',')
    const cells = [
      p.sku,
      p.name,
      p.description || '',
      availability,
      condition,
      price,
      productLink(p, opts.baseUrl),
      p.image_url || '',
      p.brand || '',
      p.ean || '',
      p.manufacturer_code || '',
      p.category || '',
      p.parent_product_id || '',
      additional,
    ].map(c => escapeCsv(String(c ?? '')))
    return cells.join(',')
  })

  return [HEADERS.join(','), ...rows].join('\n')
}
