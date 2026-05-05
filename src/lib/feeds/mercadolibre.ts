/**
 * Feed Mercado Libre — JSON con la estructura de items.
 * Formato simplificado para listing posterior por API.
 */

import { type FeedProduct, type FeedOptions, productLink } from './types'

export function generateMercadoLibre(products: FeedProduct[], opts: FeedOptions = {}): string {
  const currency = opts.currency || 'ARS'
  const items = products.map(p => ({
    id: p.sku,
    title: p.name.slice(0, 60),
    category_id: p.category || null,
    price: p.price_eur ?? 0,
    currency_id: currency,
    available_quantity: 1,
    buying_mode: 'buy_it_now',
    listing_type_id: 'gold_special',
    condition: 'new',
    description: p.description || '',
    pictures: [
      ...(p.image_url ? [{ source: p.image_url }] : []),
      ...((p.gallery_urls || []).slice(0, 11).map(g => ({ source: g.url }))),
    ],
    attributes: [
      { id: 'BRAND', value_name: p.brand || '' },
      ...(p.ean ? [{ id: 'GTIN', value_name: p.ean }] : []),
      ...(p.manufacturer_code ? [{ id: 'MPN', value_name: p.manufacturer_code }] : []),
    ],
    permalink: productLink(p, opts.baseUrl),
  }))
  return JSON.stringify({ items }, null, 2)
}
