/**
 * Feed Amazon — TSV flat-file básico (Inventory Loader / Category Listings Report).
 */

import { type FeedProduct, type FeedOptions } from './types'

const HEADERS = [
  'sku', 'product-id', 'product-id-type', 'price', 'item-condition',
  'quantity', 'add-delete', 'will-ship-internationally', 'expedited-shipping',
  'standard-plus', 'item-note', 'fulfillment-channel',
]

function escapeTsv(s: string): string {
  return s.replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
}

export function generateAmazon(products: FeedProduct[], opts: FeedOptions = {}): string {
  const currency = opts.currency || 'EUR'
  void currency
  const rows = products.map(p => {
    const cells = [
      p.sku,
      p.ean || '',
      p.ean ? 'EAN' : '',
      p.price_eur != null ? p.price_eur.toFixed(2) : '',
      '11',  // 11 = New
      '1',   // quantity default
      'a',   // add
      'n',
      'n',
      'n',
      p.description ? p.description.slice(0, 200) : '',
      'DEFAULT',
    ].map(c => escapeTsv(String(c ?? '')))
    return cells.join('\t')
  })
  return [HEADERS.join('\t'), ...rows].join('\n')
}
