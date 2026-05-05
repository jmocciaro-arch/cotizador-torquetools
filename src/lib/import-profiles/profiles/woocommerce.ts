/**
 * Profile: WooCommerce (export CSV en español)
 *
 * Headers típicos del Product CSV Import Suite oficial de WooCommerce.
 */

import type { ImportProfile } from '../types'

const woocommerce: ImportProfile = {
  id: 'woocommerce',
  label: 'WooCommerce',
  description: 'Export del plugin oficial Product CSV Import Suite (ES).',
  origin: 'ecommerce',
  logo: 'WC',

  signature_columns: {
    tt_products: ['SKU', 'Nombre', 'Precio normal', 'Categorías', 'Imágenes'],
  },
  signature_threshold: 3,

  upsertKeys: { tt_products: 'sku' },

  mappings: {
    tt_products: [
      { source: 'SKU', target: 'sku', required: true },
      { source: 'Nombre', target: 'name' },
      { source: 'Descripción corta', target: 'description' },
      { source: 'Descripción', target: 'specs.long_description' },
      { source: 'Precio normal', target: 'price_eur', validate: 'number' },
      { source: 'Precio rebajado', target: 'specs.sale_price', validate: 'number' },
      // Categorías: tomamos la 1ra parte como category (split por coma); subcat se postprocesa.
      { source: 'Categorías', target: 'category', transforms: [{ op: 'split', separator: ',', index: 0 }, { op: 'trim' }] },
      { source: 'Etiquetas', target: 'specs.tags' },
      { source: 'Marcas', target: 'brand' },
      { source: 'Imágenes', target: 'image_urls', transforms: [{ op: 'replace', find: ',', replace: '|' }] },
      { source: 'Peso (kg)', target: 'weight_kg', validate: 'number' },
      { source: 'Longitud (cm)', target: 'specs.length_cm', validate: 'number' },
      { source: 'Anchura (cm)', target: 'specs.width_cm', validate: 'number' },
      { source: 'Altura (cm)', target: 'specs.height_cm', validate: 'number' },
      { source: 'Inventario', target: 'specs.stock', validate: 'number' },
      { source: 'Visible en el catálogo', target: 'active', validate: 'boolean' },
      // Atributos genéricos 1-6 — se mapean a specs.attribute_N_*
      { source: 'Atributo 1 nombre', target: 'specs.attr_1_name' },
      { source: 'Atributo 1 valor(es)', target: 'specs.attr_1_value' },
      { source: 'Atributo 2 nombre', target: 'specs.attr_2_name' },
      { source: 'Atributo 2 valor(es)', target: 'specs.attr_2_value' },
      { source: 'Atributo 3 nombre', target: 'specs.attr_3_name' },
      { source: 'Atributo 3 valor(es)', target: 'specs.attr_3_value' },
      { source: 'Atributo 4 nombre', target: 'specs.attr_4_name' },
      { source: 'Atributo 4 valor(es)', target: 'specs.attr_4_value' },
      { source: 'Atributo 5 nombre', target: 'specs.attr_5_name' },
      { source: 'Atributo 5 valor(es)', target: 'specs.attr_5_value' },
      { source: 'Atributo 6 nombre', target: 'specs.attr_6_name' },
      { source: 'Atributo 6 valor(es)', target: 'specs.attr_6_value' },
    ],
  },

  postProcess: {
    tt_products: (record) => {
      // Si Categorías traía "Padre, Hijo" — el target=category ya tiene "Padre"
      // El raw original se perdió en el split. Si necesitamos subcategory, la fila
      // original debería tener 2do índice. TODO: postprocess avanzado para subcat.
      return record
    },
  },
}

export default woocommerce
