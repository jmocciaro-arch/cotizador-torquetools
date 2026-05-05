/**
 * Encoder EAN13 a patrón de bits.
 *
 * EAN13 = 1 dígito implícito (estructura) + 6 dígitos lado izq + 6 dígitos lado der.
 * El dígito implícito determina la combinación de paridades (L/G) del lado izquierdo.
 *
 * Output: array de 95 bools donde true = barra negra, false = espacio.
 * Estructura:
 *   guard inicio (3) + lado izq (6 dígitos × 7 = 42) + center (5) +
 *   lado der (6 dígitos × 7 = 42) + guard fin (3) = 95 módulos
 */

const L_CODES: Record<string, string> = {
  '0': '0001101', '1': '0011001', '2': '0010011', '3': '0111101',
  '4': '0100011', '5': '0110001', '6': '0101111', '7': '0111011',
  '8': '0110111', '9': '0001011',
}

const G_CODES: Record<string, string> = {
  '0': '0100111', '1': '0110011', '2': '0011011', '3': '0100001',
  '4': '0011101', '5': '0111001', '6': '0000101', '7': '0010001',
  '8': '0001001', '9': '0010111',
}

const R_CODES: Record<string, string> = {
  '0': '1110010', '1': '1100110', '2': '1101100', '3': '1000010',
  '4': '1011100', '5': '1001110', '6': '1010000', '7': '1000100',
  '8': '1001000', '9': '1110100',
}

/** Tabla de paridades del lado izquierdo según el primer dígito. L=0, G=1. */
const PARITY_TABLE: Record<string, string> = {
  '0': 'LLLLLL', '1': 'LLGLGG', '2': 'LLGGLG', '3': 'LLGGGL',
  '4': 'LGLLGG', '5': 'LGGLLG', '6': 'LGGGLL', '7': 'LGLGLG',
  '8': 'LGLGGL', '9': 'LGGLGL',
}

/** Genera el patrón de 95 módulos de un EAN13. Lanza si el código es inválido. */
export function encodeEan13(code: string): boolean[] {
  const c = code.trim()
  if (!/^\d{13}$/.test(c)) throw new Error('EAN13 requiere 13 dígitos numéricos')

  const first = c[0]
  const left = c.slice(1, 7)
  const right = c.slice(7, 13)
  const parity = PARITY_TABLE[first]
  if (!parity) throw new Error(`Primer dígito inválido: ${first}`)

  let bits = ''
  bits += '101' // guard inicio
  for (let i = 0; i < 6; i++) {
    const codes = parity[i] === 'L' ? L_CODES : G_CODES
    bits += codes[left[i]]
  }
  bits += '01010' // center
  for (let i = 0; i < 6; i++) {
    bits += R_CODES[right[i]]
  }
  bits += '101' // guard fin

  return Array.from(bits).map(b => b === '1')
}

/**
 * Genera SVG para un EAN13.
 * @param code código de 13 dígitos
 * @param opts width/height en px del SVG total. moduleWidth = ancho de cada barra.
 */
export function ean13ToSVG(
  code: string,
  opts: { width?: number; height?: number; moduleWidth?: number; showText?: boolean } = {}
): string {
  const bits = encodeEan13(code)
  const moduleWidth = opts.moduleWidth ?? 2
  const barHeight = (opts.height ?? 70) - (opts.showText !== false ? 14 : 0)
  const totalWidth = bits.length * moduleWidth
  const width = opts.width ?? totalWidth + 20
  const height = opts.height ?? 80
  const offsetX = (width - totalWidth) / 2

  let bars = ''
  for (let i = 0; i < bits.length; i++) {
    if (!bits[i]) continue
    const x = offsetX + i * moduleWidth
    bars += `<rect x="${x}" y="0" width="${moduleWidth}" height="${barHeight}" fill="black"/>`
  }

  let text = ''
  if (opts.showText !== false) {
    const fontSize = 12
    const y = barHeight + 12
    text = `<text x="${width / 2}" y="${y}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="black">${code}</text>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bars}${text}</svg>`
}
