/** "12.50" o "12,50" -> 1250. Devuelve null si no es un importe válido. */
export function parseMoney(input: string): number | null {
  const clean = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null
  const [whole, frac = ''] = clean.split('.')
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'))
}

export function formatMoney(cents: number, currency = 'MXN', locale = 'es-MX'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}
