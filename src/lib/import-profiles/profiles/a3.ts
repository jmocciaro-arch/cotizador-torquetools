/**
 * Profile: A3 ERP (Wolters Kluwer).
 * TODO: validar con export real.
 */

import type { ImportProfile } from '../types'

const a3: ImportProfile = {
  id: 'a3',
  label: 'A3 ERP',
  description: 'Export de artículos de A3 ERP (ES).',
  origin: 'accounting',
  logo: 'A3',

  signature_columns: {
    tt_products: ['Codigo', 'Descripcion', 'Codigo Familia', 'Precio Venta'],
  },
  signature_threshold: 2,

  upsertKeys: { tt_products: 'sku' },

  mappings: {
    tt_products: [
      { source: 'Codigo', target: 'sku', required: true },
      { source: 'Descripcion', target: 'name' },
      { source: 'Codigo Familia', target: 'category' },
      { source: 'Codigo Subfamilia', target: 'subcategory' },
      { source: 'Precio Coste', target: 'cost_eur', validate: 'number' },
      { source: 'Precio Venta', target: 'price_eur', validate: 'number' },
      { source: 'IVA', target: 'specs.vat_sale', validate: 'number' },
      { source: 'Stock', target: 'specs.stock', validate: 'number' },
      { source: 'EAN', target: 'ean' },
    ],
  },
}

export default a3
