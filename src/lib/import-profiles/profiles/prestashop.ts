/**
 * Profile: PrestaShop — export de productos.
 */

import type { ImportProfile } from '../types'

const prestashop: ImportProfile = {
  id: 'prestashop',
  label: 'PrestaShop',
  description: 'Export CSV de productos de PrestaShop.',
  origin: 'ecommerce',
  logo: 'PS',

  signature_columns: {
    tt_products: ['Reference', 'Name', 'Categories (x,y,z)', 'Price tax excluded'],
  },
  signature_threshold: 2,

  upsertKeys: { tt_products: 'sku' },

  mappings: {
    tt_products: [
      { source: 'ID', target: 'specs.prestashop_id' },
      { source: 'Active', target: 'active', validate: 'boolean' },
      { source: 'Name', target: 'name' },
      { source: 'Categories (x,y,z)', target: 'category', transforms: [{ op: 'split', separator: ',', index: 0 }, { op: 'trim' }] },
      { source: 'Price tax excluded', target: 'price_eur', validate: 'number' },
      { source: 'Tax rules ID', target: 'specs.tax_rules_id' },
      { source: 'Wholesale price', target: 'cost_eur', validate: 'number' },
      { source: 'On sale (0/1)', target: 'specs.on_sale', validate: 'boolean' },
      { source: 'Discount amount', target: 'specs.discount_amount', validate: 'number' },
      { source: 'Reference', target: 'sku', required: true },
      { source: 'Supplier reference', target: 'supplier_code' },
      { source: 'Supplier', target: 'specs.supplier_name' },
      { source: 'Manufacturer', target: 'brand' },
      { source: 'EAN13', target: 'ean' },
      { source: 'UPC', target: 'specs.upc' },
      { source: 'MPN', target: 'manufacturer_code' },
      { source: 'Ecotax', target: 'specs.ecotax', validate: 'number' },
      { source: 'Width', target: 'specs.width_cm', validate: 'number' },
      { source: 'Height', target: 'specs.height_cm', validate: 'number' },
      { source: 'Depth', target: 'specs.depth_cm', validate: 'number' },
      { source: 'Weight', target: 'weight_kg', validate: 'number' },
      { source: 'Quantity', target: 'specs.stock', validate: 'number' },
      { source: 'Image URLs (x,y,z)', target: 'image_urls', transforms: [{ op: 'replace', find: ',', replace: '|' }] },
      { source: 'Tags', target: 'specs.tags' },
      { source: 'Description short', target: 'description' },
      { source: 'Description', target: 'specs.long_description' },
      { source: 'Available for order (0/1)', target: 'specs.available_for_order', validate: 'boolean' },
    ],
  },
}

export default prestashop
