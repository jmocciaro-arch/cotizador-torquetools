/**
 * StelOrder Import/Export Mappings
 *
 * Mapeo de columnas entre el formato de exportacion de StelOrder
 * y las tablas internas de Mocciaro Soft ERP.
 *
 * Cada key del objeto principal es el nombre de una tabla Supabase.
 * Cada sub-objeto mapea: "Columna StelOrder" -> "campo_interno"
 *
 * Fase 2: la lógica nueva vive en `src/lib/import-profiles/`. Este archivo se
 * mantiene como retro-compatibilidad y como source-of-truth de los headers
 * StelOrder, ya que el nuevo profile lo re-usa para postProcessProductRecord.
 */

// ═══════════════════════════════════════════════════════
// STELORDER -> INTERNAL  (import direction)
// ═══════════════════════════════════════════════════════

export const STELORDER_MAPPINGS: Record<string, Record<string, string>> = {
  tt_clients: {
    'Referencia': 'stelorder_id',
    'Nombre jurídico': 'legal_name',
    'Nombre': 'name',
    'CifNif': 'tax_id',
    'Email': 'email',
    'Teléfono 1': 'phone',
    'Teléfono 2': 'phone2',
    'Dirección': 'address',
    'Localidad': 'city',
    'Provincia': 'state',
    'Código postal': 'postal_code',
    'País': 'country',
    'Forma de pago': 'payment_terms',
    'Observaciones': 'notes',
    'Familia de clientes': 'category',
    'Web': 'whatsapp',
    'Descuento': 'credit_limit',
    'Activa': 'active',
    'Fax': 'fax',
    'Agente': 'agent',
    'Moneda': 'currency',
    'Zona': 'zone',
    'IBAN': 'iban',
    'Régimen fiscal': 'tax_regime',
    'Referencia contable': 'accounting_ref',
    'Tarifa': 'price_list',
    'Etiquetas': 'tags',
    'Recargo de equivalencia': 'surcharge',
    'Código de barras': 'barcode',
  },
  tt_products: {
    'Referencia': 'sku',
    'Nombre': 'name',
    'Descripción': 'description',
    'Precio base de venta': 'price_eur',
    'Precio base de compra': 'cost_eur',
    'Peso': 'weight_kg',
    'Stock': 'specs.stock',
    'Stock mínimo': 'specs.stock_min',
    'Stock máximo': 'specs.stock_max',
    'Categoría': 'category',
    'Activa': 'active',
    'Observaciones privadas': 'specs.private_notes',
    // v48: EAN va a su propia columna; mantenemos backward compat por validador (si no es EAN-13, queda en barcode legacy)
    'Código de barras': 'ean',
    // v48: multi-código
    'Referencia del fabricante': 'manufacturer_code',
    'Referencia del proveedor': 'supplier_code',
    'Galería de imágenes (URLs separadas por |)': 'image_urls',
    'Ubicación': 'specs.location',
    'Unidad de medida': 'specs.unit',
    'Tipo impuesto venta': 'specs.tax_type_sale',
    'IVA de venta': 'specs.vat_sale',
    'Precio mínimo de venta': 'specs.min_sale_price',
    'Precio venta 1': 'specs.price_list_1',
    'Precio venta 2': 'specs.price_list_2',
    'Precio venta 3': 'specs.price_list_3',
    'Precio venta 4': 'specs.price_list_4',
    'Precio venta 5': 'specs.price_list_5',
  },
  tt_suppliers: {
    'Referencia': 'reference',
    'Nombre jurídico': 'legal_name',
    'Nombre': 'name',
    'CifNif': 'tax_id',
    'Email': 'email',
    'Teléfono 1': 'phone',
    'Teléfono 2': 'phone2',
    'Dirección': 'address',
    'Localidad': 'city',
    'Provincia': 'state',
    'Código postal': 'postal_code',
    'País': 'country',
    'Forma de pago': 'payment_terms',
    'Observaciones': 'notes',
    'Familia de clientes': 'category',
    'Activa': 'active',
    'Web': 'website',
    'Fax': 'fax',
    'Agente': 'agent',
    'Moneda': 'currency',
    'IBAN': 'iban',
    'Régimen fiscal': 'tax_regime',
    'Referencia contable': 'accounting_ref',
  },
  tt_leads: {
    'Referencia': 'stelorder_id',
    'Nombre jurídico': 'legal_name',
    'Nombre': 'name',
    'CifNif': 'tax_id',
    'Email': 'email',
    'Teléfono 1': 'phone',
    'Teléfono 2': 'phone2',
    'Dirección': 'address',
    'Localidad': 'city',
    'Provincia': 'state',
    'Código postal': 'postal_code',
    'País': 'country',
    'Forma de pago': 'payment_terms',
    'Observaciones': 'notes',
    'Familia de clientes': 'category',
    'Activa': 'active',
    'Web': 'website',
  },
  tt_contacts: {
    'Referencia': 'reference',
    'Nombre': 'name',
    'Email': 'email',
    'Teléfono 1': 'phone',
    'Teléfono 2': 'phone2',
    'Dirección': 'address',
    'Localidad': 'city',
    'País': 'country',
    'Observaciones': 'notes',
    'Cargo contacto': 'position',
  },
}

// ═══════════════════════════════════════════════════════
// INTERNAL -> STELORDER  (export direction)
// ═══════════════════════════════════════════════════════

/** Invierte un mapping: campo_interno -> Columna StelOrder */
function invertMapping(mapping: Record<string, string>): Record<string, string> {
  const inverted: Record<string, string> = {}
  for (const [stelCol, internalField] of Object.entries(mapping)) {
    // Si hay campos con dots (specs.stock), usar solo el campo completo
    inverted[internalField] = stelCol
  }
  return inverted
}

export const STELORDER_EXPORT_MAPPINGS: Record<string, Record<string, string>> = {
  tt_clients: invertMapping(STELORDER_MAPPINGS.tt_clients),
  tt_products: invertMapping(STELORDER_MAPPINGS.tt_products),
  tt_suppliers: invertMapping(STELORDER_MAPPINGS.tt_suppliers),
  tt_leads: invertMapping(STELORDER_MAPPINGS.tt_leads),
  tt_contacts: invertMapping(STELORDER_MAPPINGS.tt_contacts),
}

// ═══════════════════════════════════════════════════════
// DETECTION: Chequea si los headers son de StelOrder
// ═══════════════════════════════════════════════════════

/** Headers "firma" de cada tipo de export de StelOrder */
const STELORDER_SIGNATURES: Record<string, string[]> = {
  tt_clients: ['Referencia', 'Nombre jurídico', 'CifNif', 'Familia de clientes'],
  tt_products: ['Referencia', 'Precio base de venta', 'Precio base de compra', 'Categoría'],
  tt_suppliers: ['Referencia', 'Nombre jurídico', 'CifNif'],
  tt_leads: ['Referencia', 'Nombre jurídico', 'CifNif'],
  tt_contacts: ['Referencia', 'Cargo contacto'],
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export interface StelOrderDetection {
  isStelOrder: boolean
  detectedTable: string | null
  mapping: Record<number, string> // csv col index -> internal field key
  matchedColumns: number
  totalStelColumns: number
}

/**
 * Detecta si un set de headers CSV/XLSX corresponde a un export de StelOrder
 * y retorna el mapping automatico.
 */
export function detectStelOrderFormat(
  headers: string[],
  targetTable: string
): StelOrderDetection {
  const tableMapping = STELORDER_MAPPINGS[targetTable]
  if (!tableMapping) {
    return { isStelOrder: false, detectedTable: null, mapping: {}, matchedColumns: 0, totalStelColumns: 0 }
  }

  const stelColumns = Object.keys(tableMapping)
  const normalizedStelCols = stelColumns.map(normalizeForCompare)
  const normalizedHeaders = headers.map(normalizeForCompare)

  const mapping: Record<number, string> = {}
  let matchedColumns = 0

  headers.forEach((header, idx) => {
    const normalizedHeader = normalizeForCompare(header)
    const stelIdx = normalizedStelCols.findIndex(sc => sc === normalizedHeader)
    if (stelIdx !== -1) {
      const stelCol = stelColumns[stelIdx]
      const internalField = tableMapping[stelCol]
      mapping[idx] = internalField
      matchedColumns++
    }
  })

  // Necesitamos al menos 3 columnas signature para considerar que es StelOrder
  const signatures = STELORDER_SIGNATURES[targetTable] || []
  const normalizedSigs = signatures.map(normalizeForCompare)
  const sigMatches = normalizedSigs.filter(sig => normalizedHeaders.includes(sig)).length
  const isStelOrder = sigMatches >= Math.min(2, signatures.length)

  return {
    isStelOrder,
    detectedTable: isStelOrder ? targetTable : null,
    mapping,
    matchedColumns,
    totalStelColumns: stelColumns.length,
  }
}

// ═══════════════════════════════════════════════════════
// UPSERT KEY: Que campo usar para detectar duplicados
// ═══════════════════════════════════════════════════════

export const UPSERT_KEYS: Record<string, string> = {
  tt_clients: 'stelorder_id',
  tt_products: 'sku',
  tt_suppliers: 'reference',
  tt_leads: 'stelorder_id',
  tt_contacts: 'reference',
  tt_stock: 'product_id',
}

/**
 * Dado un record con campos potencialmente con "dots" (specs.stock),
 * lo transforma en un record anidado correcto para Supabase.
 *
 * Ej: { 'specs.stock': '100', 'name': 'Llave' }
 *  -> { specs: { stock: '100' }, name: 'Llave' }
 */
export function expandDotNotation(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(record)) {
    if (key.includes('.')) {
      const [parent, child] = key.split('.')
      if (!result[parent] || typeof result[parent] !== 'object') {
        result[parent] = {}
      }
      ;(result[parent] as Record<string, unknown>)[child] = value
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Valida si un string parece un EAN-13 (13 dígitos numéricos).
 * No verifica el dígito de control — solo el formato.
 */
export function isLikelyEAN13(value: string): boolean {
  return /^\d{13}$/.test(value.trim())
}

/**
 * Post-procesa un record importado para v48:
 *  - Si `ean` no es EAN-13 válido, lo mueve a `barcode` (legacy) y limpia ean.
 *  - Si hay `image_urls` (string separado por `|`), lo expande a `gallery_urls` JSON
 *    y completa `image_url` con la primera URL si está vacío.
 * Mutación in-place sobre el record para simplicidad.
 */
export function postProcessProductRecord(record: Record<string, unknown>): Record<string, unknown> {
  // EAN: solo acepta 13 dígitos. Cualquier otro código va a barcode.
  if (typeof record.ean === 'string' && record.ean.trim() !== '' && !isLikelyEAN13(record.ean)) {
    if (record.barcode == null || record.barcode === '') {
      record.barcode = record.ean
    }
    record.ean = null
  }

  // Galería virtual desde image_urls (split por |)
  if (typeof record.image_urls === 'string' && record.image_urls.trim()) {
    const urls = (record.image_urls as string)
      .split('|')
      .map(u => u.trim())
      .filter(u => /^https?:\/\//i.test(u))
    if (urls.length > 0) {
      record.gallery_urls = urls.map((url, i) => ({ url, sort_order: i }))
      if (!record.image_url || record.image_url === '') {
        record.image_url = urls[0]
      }
    }
    // image_urls es un campo "virtual"; no existe en la tabla, lo eliminamos antes del INSERT/UPDATE
    delete record.image_urls
  }

  return record
}

/**
 * Aplana un record con objetos anidados (specs) para exportar.
 * Ej: { specs: { stock: 100 }, name: 'Llave' }
 *  -> { 'specs.stock': 100, name: 'Llave' }
 */
export function flattenForExport(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(record)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
        result[`${key}.${subKey}`] = subVal
      }
    } else {
      result[key] = value
    }
  }

  return result
}
