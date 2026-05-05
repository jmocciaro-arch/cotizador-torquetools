/**
 * Profile: Sage 50 (España).
 * TODO: validar con export real — Sage 50 admite múltiples layouts de export.
 */

import type { ImportProfile } from '../types'

const sage50: ImportProfile = {
  id: 'sage50',
  label: 'Sage 50',
  description: 'Export de artículos de Sage 50 (ES).',
  origin: 'accounting',
  logo: 'S5',

  signature_columns: {
    tt_products: ['Codigo Articulo', 'Descripcion Articulo', 'Familia', 'Precio Venta'],
  },
  signature_threshold: 2,

  upsertKeys: { tt_products: 'sku' },

  mappings: {
    tt_products: [
      { source: 'Codigo Articulo', target: 'sku', required: true },
      { source: 'Descripcion Articulo', target: 'name' },
      { source: 'Familia', target: 'category' },
      { source: 'Subfamilia', target: 'subcategory' },
      { source: 'Marca', target: 'brand' },
      { source: 'Precio Coste', target: 'cost_eur', validate: 'number' },
      { source: 'Precio Venta', target: 'price_eur', validate: 'number' },
      { source: 'Tipo IVA', target: 'specs.vat_sale', validate: 'number' },
      { source: 'Stock', target: 'specs.stock', validate: 'number' },
      { source: 'Codigo Barras', target: 'ean' },
      { source: 'Proveedor', target: 'specs.supplier_name' },
    ],
  },
}

export default sage50
