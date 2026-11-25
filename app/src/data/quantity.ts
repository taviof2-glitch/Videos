/** "3", "2.5" o "0,250" -> número con hasta 3 decimales (piezas, kg, metros). null si no es válido. */
export function parseQuantity(input: string): number | null {
  const clean = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,3})?$/.test(clean)) return null
  return roundQty(Number(clean))
}

/** Evita errores de coma flotante al sumar cantidades (0.1 + 0.2). */
export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function formatQuantity(n: number, locale = 'es-MX'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(n)
}
