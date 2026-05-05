/**
 * Profile: Holded — export de Productos.
 * TODO: validar con export real.
 */

import type { ImportProfile } from '../types'

const holded: ImportProfile = {
  id: 'holded',
  label: 'Holded',
  description: 'Export de productos de Holded (ES/EN).',
  origin: 'accounting',
  logo: 'HD',

  signature_columns: {
    tt_products: ['SKU', 'Name', 'Sale Price', 'Family'],
  },
  signature_threshold: 2,

  upsertKeys: { tt_products: 'sku' },

  mappings: {
    tt_products: [
      { source: 'SKU', target: 'sku', required: true },
      { source: 'Name', target: 'name' },
      { source: 'Description', target: 'description' },
      { source: 'Type', target: 'specs.product_type' },
      { source: 'Family', target: 'category' },
      { source: 'Tags', target: 'specs.tags' },
      { source: 'Cost', target: 'cost_eur', validate: 'number' },
      { source: 'Sale Price', target: 'price_eur', validate: 'number' },
      { source: 'Tax Sales (%)', target: 'specs.vat_sale', validate: 'number' },
      { source: 'Tax Purchases (%)', target: 'specs.vat_purchase', validate: 'number' },
      { source: 'Stock', target: 'specs.stock', validate: 'number' },
      { source: 'Barcode', target: 'ean' },
      { source: 'Weight', target: 'weight_kg', validate: 'number' },
      { source: 'Image URL', target: 'image_url', validate: 'url' },
    ],
  },
}

export default holded
