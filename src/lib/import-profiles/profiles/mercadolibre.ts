/**
 * Profile: MercadoLibre — Catálogo de publicaciones (export CSV).
 * TODO: validar con export real (los headers cambian según país y plantilla).
 */

import type { ImportProfile } from '../types'

const mercadolibre: ImportProfile = {
  id: 'mercadolibre',
  label: 'MercadoLibre',
  description: 'Export de catálogo MercadoLibre (AR/MX/CL). Imágenes separadas con "|".',
  origin: 'marketplace',
  logo: 'ML',

  signature_columns: {
    tt_products: ['SKU', 'Título', 'Precio', 'Categoría ML'],
  },
  signature_threshold: 2,

  upsertKeys: { tt_products: 'sku' },

  mappings: {
    tt_products: [
      { source: 'SKU', target: 'sku', required: true },
      { source: 'Título', target: 'name' },
      { source: 'Descripción', target: 'description' },
      { source: 'Categoría ML', target: 'category' },
      { source: 'Precio', target: 'price_eur', validate: 'number' },
      { source: 'Stock', target: 'specs.stock', validate: 'number' },
      { source: 'Marca', target: 'brand' },
      { source: 'Modelo', target: 'modelo' },
      { source: 'Condición', target: 'specs.condition' },
      { source: 'Imagenes (URL separadas con |)', target: 'image_urls' },
      { source: 'EAN/GTIN', target: 'ean' },
      // Peso (g) → kg
      { source: 'Peso (g)', target: 'weight_kg', transforms: [{ op: 'divide', value: 1000 }], validate: 'number' },
      { source: 'Altura (cm)', target: 'specs.height_cm', validate: 'number' },
      { source: 'Ancho (cm)', target: 'specs.width_cm', validate: 'number' },
      { source: 'Largo (cm)', target: 'specs.length_cm', validate: 'number' },
    ],
  },
}

export default mercadolibre
