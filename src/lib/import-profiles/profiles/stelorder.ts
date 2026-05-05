/**
 * Profile: StelOrder ERP/CRM
 *
 * Refactor del antiguo `src/lib/stelorder-mappings.ts` al formato ImportProfile.
 * Mantiene los mismos headers que la versión legacy.
 */

import type { ImportProfile } from '../types'
import { postProcessProductRecord } from '@/lib/stelorder-mappings'

const stelorder: ImportProfile = {
  id: 'stelorder',
  label: 'StelOrder',
  description: 'Export estándar de StelOrder ERP/CRM (ES).',
  origin: 'erp',
  logo: 'SO',

  signature_columns: {
    tt_clients: ['Referencia', 'Nombre jurídico', 'CifNif', 'Familia de clientes'],
    tt_products: ['Referencia', 'Precio base de venta', 'Precio base de compra', 'Categoría'],
    tt_suppliers: ['Referencia', 'Nombre jurídico', 'CifNif'],
  },
  signature_threshold: 2,

  upsertKeys: {
    tt_products: 'sku',
    tt_clients: 'stelorder_id',
    tt_suppliers: 'reference',
  },

  mappings: {
    tt_products: [
      { source: 'Referencia', target: 'sku', required: true },
      { source: 'Nombre', target: 'name' },
      { source: 'Descripción', target: 'description' },
      { source: 'Precio base de venta', target: 'price_eur', validate: 'number' },
      { source: 'Precio base de compra', target: 'cost_eur', validate: 'number' },
      { source: 'Peso', target: 'weight_kg', validate: 'number' },
      { source: 'Stock', target: 'specs.stock', validate: 'number' },
      { source: 'Stock mínimo', target: 'specs.stock_min', validate: 'number' },
      { source: 'Stock máximo', target: 'specs.stock_max', validate: 'number' },
      { source: 'Categoría', target: 'category' },
      { source: 'Activa', target: 'active', validate: 'boolean' },
      { source: 'Observaciones privadas', target: 'specs.private_notes' },
      { source: 'Código de barras', target: 'ean' },
      { source: 'Referencia del fabricante', target: 'manufacturer_code' },
      { source: 'Referencia del proveedor', target: 'supplier_code' },
      { source: 'Galería de imágenes (URLs separadas por |)', target: 'image_urls' },
      { source: 'Ubicación', target: 'specs.location' },
      { source: 'Unidad de medida', target: 'specs.unit' },
      { source: 'Tipo impuesto venta', target: 'specs.tax_type_sale' },
      { source: 'IVA de venta', target: 'specs.vat_sale', validate: 'number' },
      { source: 'Precio mínimo de venta', target: 'specs.min_sale_price', validate: 'number' },
      { source: 'Precio venta 1', target: 'specs.price_list_1', validate: 'number' },
      { source: 'Precio venta 2', target: 'specs.price_list_2', validate: 'number' },
      { source: 'Precio venta 3', target: 'specs.price_list_3', validate: 'number' },
      { source: 'Precio venta 4', target: 'specs.price_list_4', validate: 'number' },
      { source: 'Precio venta 5', target: 'specs.price_list_5', validate: 'number' },
    ],
    tt_clients: [
      { source: 'Referencia', target: 'stelorder_id' },
      { source: 'Nombre jurídico', target: 'legal_name' },
      { source: 'Nombre', target: 'name', required: true },
      { source: 'CifNif', target: 'tax_id' },
      { source: 'Email', target: 'email', validate: 'email' },
      { source: 'Teléfono 1', target: 'phone' },
      { source: 'Teléfono 2', target: 'phone2' },
      { source: 'Dirección', target: 'address' },
      { source: 'Localidad', target: 'city' },
      { source: 'Provincia', target: 'state' },
      { source: 'Código postal', target: 'postal_code' },
      { source: 'País', target: 'country' },
      { source: 'Forma de pago', target: 'payment_terms' },
      { source: 'Observaciones', target: 'notes' },
      { source: 'Familia de clientes', target: 'category' },
      { source: 'Activa', target: 'active', validate: 'boolean' },
    ],
    tt_suppliers: [
      { source: 'Referencia', target: 'reference' },
      { source: 'Nombre jurídico', target: 'legal_name' },
      { source: 'Nombre', target: 'name', required: true },
      { source: 'CifNif', target: 'tax_id' },
      { source: 'Email', target: 'email', validate: 'email' },
      { source: 'Teléfono 1', target: 'phone' },
      { source: 'Dirección', target: 'address' },
      { source: 'Localidad', target: 'city' },
      { source: 'País', target: 'country' },
      { source: 'Forma de pago', target: 'payment_terms' },
      { source: 'Observaciones', target: 'notes' },
      { source: 'Activa', target: 'active', validate: 'boolean' },
    ],
  },

  postProcess: {
    tt_products: postProcessProductRecord,
  },
}

export default stelorder
