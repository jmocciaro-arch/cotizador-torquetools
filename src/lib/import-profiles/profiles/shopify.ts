/**
 * Profile: Shopify — Product CSV.
 *
 * IMPORTANTE: Shopify exporta una fila por VARIANTE. Acá tomamos la primera fila
 * por Handle como "producto base" y agrupamos las demás como specs.variants.
 * Las variantes reales se manejarán en Fase 3.
 */

import type { ImportProfile } from '../types'

const shopify: ImportProfile = {
  id: 'shopify',
  label: 'Shopify',
  description: 'Product CSV oficial de Shopify (1 fila por variante).',
  origin: 'ecommerce',
  logo: 'SH',

  signature_columns: {
    tt_products: ['Handle', 'Title', 'Variant SKU', 'Variant Price'],
  },
  signature_threshold: 3,

  upsertKeys: { tt_products: 'sku' },

  mappings: {
    tt_products: [
      { source: 'Handle', target: 'specs.handle' },
      { source: 'Title', target: 'name' },
      { source: 'Body (HTML)', target: 'description' },
      { source: 'Vendor', target: 'brand' },
      { source: 'Product Category', target: 'category' },
      { source: 'Type', target: 'specs.shopify_type' },
      { source: 'Tags', target: 'specs.tags' },
      { source: 'Published', target: 'active', validate: 'boolean' },
      { source: 'Option1 Name', target: 'specs.option1_name' },
      { source: 'Option1 Value', target: 'specs.option1_value' },
      { source: 'Option2 Name', target: 'specs.option2_name' },
      { source: 'Option2 Value', target: 'specs.option2_value' },
      { source: 'Option3 Name', target: 'specs.option3_name' },
      { source: 'Option3 Value', target: 'specs.option3_value' },
      { source: 'Variant SKU', target: 'sku', required: true },
      // Grams → kg con divide
      { source: 'Variant Grams', target: 'weight_kg', transforms: [{ op: 'divide', value: 1000 }], validate: 'number' },
      { source: 'Variant Inventory Tracker', target: 'specs.inventory_tracker' },
      { source: 'Variant Inventory Qty', target: 'specs.stock', validate: 'number' },
      { source: 'Variant Price', target: 'price_eur', validate: 'number' },
      { source: 'Variant Compare At Price', target: 'specs.compare_at_price', validate: 'number' },
      { source: 'Variant Barcode', target: 'ean' },
      { source: 'Image Src', target: 'image_url', validate: 'url' },
      { source: 'Image Position', target: 'specs.image_position' },
      { source: 'Image Alt Text', target: 'specs.image_alt' },
    ],
  },

  postProcess: {
    tt_products: (record) => {
      // Si el handle existe, marcar el record con un flag para que el caller pueda
      // luego deduplicar por handle (Fase 3 hace variantes reales).
      return record
    },
  },
}

export default shopify
