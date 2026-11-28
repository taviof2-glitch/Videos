import { normalizeNumber } from './number'

/** "3", "2.5", "0,250" o "1,500" -> número con hasta 3 decimales (piezas, kg, metros). null si no es válido. */
export function parseQuantity(input: string): number | null {
  const clean = normalizeNumber(input)
  if (clean === null || !/^\d+(\.\d{0,3})?$/.test(clean)) return null
  return roundQty(Number(clean))
}

/** Evita errores de coma flotante al sumar cantidades (0.1 + 0.2). */
export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function formatQuantity(n: number, locale = 'es-MX'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(n)
}
