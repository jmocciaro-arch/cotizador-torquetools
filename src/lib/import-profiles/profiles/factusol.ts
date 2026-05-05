/**
 * Profile: Factusol (Sage) — ERP de gestión muy difundido en España.
 * TODO: validar con export real.
 */

import type { ImportProfile } from '../types'

const factusol: ImportProfile = {
  id: 'factusol',
  label: 'Factusol',
  description: 'Export de artículos de Factusol (ES).',
  origin: 'accounting',
  logo: 'FS',

  signature_columns: {
    tt_products: ['Codigo', 'Descripcion', 'Familia', 'PVP'],
  },
  signature_threshold: 3,

  upsertKeys: { tt_products: 'sku' },

  mappings: {
    tt_products: [
      { source: 'Codigo', target: 'sku', required: true },
      { source: 'Descripcion', target: 'name' },
      { source: 'Familia', target: 'category' },
      { source: 'Subfamilia', target: 'subcategory' },
      { source: 'Marca', target: 'brand' },
      { source: 'Modelo', target: 'modelo' },
      { source: 'Stock', target: 'specs.stock', validate: 'number' },
      { source: 'Precio Costo', target: 'cost_eur', validate: 'number' },
      { source: 'PVP', target: 'price_eur', validate: 'number' },
      { source: 'IVA', target: 'specs.vat_sale', validate: 'number' },
      { source: 'Codigo Barras', target: 'ean' },
      { source: 'Proveedor', target: 'specs.supplier_name' },
    ],
  },
}

export default factusol
