/**
 * Normaliza lo que escribe la persona a un número con punto decimal ("1,250.50" -> "1250.50").
 * - Quita espacios y el signo $.
 * - Si hay coma y punto, el último es el decimal y el otro separa miles ("1,250.50", "1.250,50").
 * - Una coma sola es de miles solo si agrupa de tres en tres sin empezar en 0 ("1,500", "12,345,678");
 *   en cualquier otro caso es decimal ("12,5", "0,250").
 * Devuelve null si queda algo que no es un número sin signo.
 */
export function normalizeNumber(input: string): string | null {
  let s = input.trim().replace(/[\s$]/g, '')
  if (!s) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    s = s.split(thousands).join('').replace(decimal, '.')
  } else if (lastComma >= 0) {
    s = /^[1-9]\d{0,2}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  }
  return /^\d+(\.\d*)?$/.test(s) ? s : null
}
