// Atajos para productos de madera (tablas de picar, charolas, repisas…): tipos de madera con cuánto suben el precio
// respecto al pino, tamaños y acabados. Se usan para armar las variantes del producto y sugerir sus precios.
export const WOODS: [string, number][] = [['Pino', 1], ['Cedro', 1.4], ['Parota', 1.6], ['Encino', 1.5], ['Tzalam', 1.8], ['Nogal', 2], ['Caoba', 2.2], ['Rosa morada', 2]]
export const SIZES: [string, number][] = [['Chica', 0.75], ['Mediana', 1], ['Grande', 1.35], ['Extra grande', 1.7]]

export const ATTR_PRESETS: { label: string; name: string; values: string[] }[] = [
  { label: 'Tipo de madera', name: 'Madera', values: ['Pino', 'Parota', 'Cedro'] },
  { label: 'Tamaño', name: 'Tamaño', values: ['Chica', 'Mediana', 'Grande'] },
  { label: 'Acabado', name: 'Acabado', values: ['Natural', 'Aceite mineral', 'Barniz'] },
]

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
const factorOf = (list: [string, number][], v: string) => list.find(([n]) => norm(n) === norm(v))?.[1]

/** Cuánto vale una variante comparada con el precio base (pino, mediana): multiplica madera × tamaño. */
export function variantFactor(values: string[]): number {
  return values.reduce((f, v) => f * (factorOf(WOODS, v) ?? factorOf(SIZES, v) ?? 1), 1)
}

/** Precio sugerido redondeado a $10. */
export const suggestedPrice = (baseCents: number, values: string[]) => Math.round((baseCents * variantFactor(values)) / 1000) * 1000

/** ¿Alguno de los valores es una madera o tamaño conocido? (para mostrar el botón de precios sugeridos). */
export const hasKnownFactors = (values: string[]) => values.some((v) => factorOf(WOODS, v) !== undefined || factorOf(SIZES, v) !== undefined)
