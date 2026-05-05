/**
 * Profile: Odoo ERP — export estándar de Productos (product.template).
 * TODO: validar con export real (los headers exactos varían según versión y módulo).
 */

import type { ImportProfile } from '../types'

const odoo: ImportProfile = {
  id: 'odoo',
  label: 'Odoo',
  description: 'Export estándar product.template / res.partner de Odoo (EN).',
  origin: 'erp',
  logo: 'OD',

  signature_columns: {
    tt_products: ['Internal Reference', 'Name', 'Sales Price', 'Cost'],
    tt_clients: ['Name', 'VAT', 'Email', 'Customer'],
  },
  signature_threshold: 2,

  upsertKeys: { tt_products: 'sku', tt_clients: 'tax_id' },

  mappings: {
    tt_products: [
      { source: 'Internal Reference', target: 'sku', required: true },
      { source: 'Name', target: 'name' },
      { source: 'Sales Description', target: 'description' },
      { source: 'Internal Notes', target: 'specs.private_notes' },
      { source: 'Sales Price', target: 'price_eur', validate: 'number' },
      { source: 'Cost', target: 'cost_eur', validate: 'number' },
      { source: 'Type', target: 'specs.product_type' },
      { source: 'Categories', target: 'category' },
      { source: 'Barcode', target: 'ean' },
      { source: 'Weight', target: 'weight_kg', validate: 'number' },
      { source: 'Volume', target: 'specs.volume', validate: 'number' },
      { source: 'Active', target: 'active', validate: 'boolean' },
    ],
    tt_clients: [
      { source: 'Name', target: 'name', required: true },
      { source: 'VAT', target: 'tax_id' },
      { source: 'Email', target: 'email', validate: 'email' },
      { source: 'Phone', target: 'phone' },
      { source: 'Mobile', target: 'phone2' },
      { source: 'Street', target: 'address' },
      { source: 'City', target: 'city' },
      { source: 'State', target: 'state' },
      { source: 'Zip', target: 'postal_code' },
      { source: 'Country', target: 'country' },
      { source: 'Website', target: 'website' },
    ],
  },
}

export default odoo
