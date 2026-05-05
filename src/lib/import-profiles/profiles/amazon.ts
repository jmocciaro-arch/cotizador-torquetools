/**
 * Profile: Amazon Seller — flat file (subset común multi-categoría).
 * TODO: validar con plantilla real por categoría (Tools & Industrial, Auto, etc.).
 */

import type { ImportProfile } from '../types'

const amazon: ImportProfile = {
  id: 'amazon',
  label: 'Amazon Seller',
  description: 'Flat-file de Amazon Seller Central (subset común).',
  origin: 'marketplace',
  logo: 'AZ',

  signature_columns: {
    tt_products: ['sku', 'item-name', 'price', 'product-id'],
  },
  signature_threshold: 2,

  upsertKeys: { tt_products: 'sku' },

  mappings: {
    tt_products: [
      { source: 'sku', target: 'sku', required: true },
      { source: 'product-id', target: 'ean' },
      { source: 'product-id-type', target: 'specs.product_id_type' },
      { source: 'price', target: 'price_eur', validate: 'number' },
      { source: 'item-name', target: 'name' },
      { source: 'brand_name', target: 'brand' },
      { source: 'manufacturer', target: 'specs.manufacturer' },
      { source: 'part_number', target: 'manufacturer_code' },
      { source: 'item_weight', target: 'weight_kg', validate: 'number' },
      { source: 'item_weight_unit', target: 'specs.weight_unit' },
      { source: 'main_image_url', target: 'image_url', validate: 'url' },
      { source: 'other_image_url1', target: 'specs.image_1' },
      { source: 'other_image_url2', target: 'specs.image_2' },
      { source: 'other_image_url3', target: 'specs.image_3' },
      { source: 'other_image_url4', target: 'specs.image_4' },
      { source: 'other_image_url5', target: 'specs.image_5' },
      { source: 'other_image_url6', target: 'specs.image_6' },
      { source: 'other_image_url7', target: 'specs.image_7' },
      { source: 'other_image_url8', target: 'specs.image_8' },
      { source: 'bullet_point1', target: 'specs.bullet_1' },
      { source: 'bullet_point2', target: 'specs.bullet_2' },
      { source: 'bullet_point3', target: 'specs.bullet_3' },
      { source: 'bullet_point4', target: 'specs.bullet_4' },
      { source: 'bullet_point5', target: 'specs.bullet_5' },
      { source: 'product_description', target: 'description' },
      { source: 'item_type_keyword', target: 'category' },
    ],
  },

  postProcess: {
    tt_products: (record) => {
      // Construir image_urls (pipe-separated) desde main + others si los hay
      const main = record.image_url
      const others: string[] = []
      for (let i = 1; i <= 8; i++) {
        const sp = record.specs as Record<string, unknown> | undefined
        const v = sp?.[`image_${i}`]
        if (typeof v === 'string' && v.trim()) others.push(v.trim())
      }
      const all = [typeof main === 'string' ? main : null, ...others].filter((u): u is string => !!u)
      if (all.length > 1 && !record.image_urls) {
        record.image_urls = all.join('|')
      }
      return record
    },
  },
}

export default amazon
