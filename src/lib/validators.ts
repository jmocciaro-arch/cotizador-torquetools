/**
 * Validadores compartidos.
 */

/** Calcula el dígito verificador de un EAN13 dado los primeros 12 dígitos. */
export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) throw new Error('EAN13 requiere 12 dígitos numéricos')
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = parseInt(first12[i], 10)
    sum += i % 2 === 0 ? d : d * 3
  }
  return (10 - (sum % 10)) % 10
}

/** Valida un EAN13 completo (13 dígitos, último es verificador). */
export function isValidEan13(code: string): boolean {
  const c = (code || '').trim()
  if (!/^\d{13}$/.test(c)) return false
  const expected = ean13CheckDigit(c.slice(0, 12))
  return expected === parseInt(c[12], 10)
}

/** Genera un EAN13 válido completando el dígito verificador. */
export function makeEan13(prefix12: string): string {
  const padded = prefix12.padStart(12, '0').slice(0, 12)
  return padded + ean13CheckDigit(padded).toString()
}

/** Valida que un SKU sea único en una colección dada. */
export function isUniqueSku(sku: string, existing: { sku: string; id?: string }[], excludeId?: string): boolean {
  const s = sku.trim().toLowerCase()
  if (!s) return false
  return !existing.some(e => e.sku.trim().toLowerCase() === s && e.id !== excludeId)
}
