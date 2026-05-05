/**
 * Punto de entrada de los generadores de feeds.
 */

import { generateGoogleShopping } from './google-shopping'
import { generateMetaCatalog } from './meta-catalog'
import { generateMercadoLibre } from './mercadolibre'
import { generateAmazon } from './amazon'
import type { FeedProduct, FeedOptions } from './types'

export type FeedType =
  | 'google_shopping'
  | 'meta_catalog'
  | 'mercadolibre'
  | 'amazon'
  | 'custom_xml'
  | 'custom_csv'

export interface FeedRecord {
  id: string
  company_id: string | null
  name: string
  feed_type: FeedType
  filter: Record<string, unknown> | null
  field_mapping: Record<string, string> | null
  options: FeedOptions | null
  public_token: string | null
  is_public: boolean
  last_generated_at: string | null
  last_item_count: number | null
}

export function generateFeed(
  type: FeedType,
  products: FeedProduct[],
  opts: FeedOptions = {}
): { content: string; contentType: string } {
  switch (type) {
    case 'google_shopping':
      return { content: generateGoogleShopping(products, opts), contentType: 'application/xml; charset=utf-8' }
    case 'meta_catalog':
      return { content: generateMetaCatalog(products, opts), contentType: 'text/csv; charset=utf-8' }
    case 'mercadolibre':
      return { content: generateMercadoLibre(products, opts), contentType: 'application/json; charset=utf-8' }
    case 'amazon':
      return { content: generateAmazon(products, opts), contentType: 'text/tab-separated-values; charset=utf-8' }
    case 'custom_xml':
    case 'custom_csv':
      // Por defecto delegamos a Google Shopping para xml y Meta para csv
      return type === 'custom_xml'
        ? { content: generateGoogleShopping(products, opts), contentType: 'application/xml; charset=utf-8' }
        : { content: generateMetaCatalog(products, opts), contentType: 'text/csv; charset=utf-8' }
  }
}

export type { FeedProduct, FeedOptions } from './types'
