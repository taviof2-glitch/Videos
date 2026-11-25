export type DonutSlice = { key: string; label: string; value: number }

/** Colores distintos y legibles sobre blanco; las categorías de más allá de la sexta se juntan en «Otras». */
export const DONUT_COLORS = ['#0f766e', '#c2410c', '#1d4ed8', '#a21caf', '#a16207', '#be123c', '#64748b']

export function donutSlices(items: DonutSlice[]): DonutSlice[] {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  if (sorted.length <= DONUT_COLORS.length) return sorted
  const keep = DONUT_COLORS.length - 1
  const rest = sorted.slice(keep).reduce((s, i) => s + i.value, 0)
  return [...sorted.slice(0, keep), { key: 'otras', label: 'Otras', value: rest }]
}

/** Dónde empieza cada porción (en % de la vuelta). */
export const donutOffsets = (slices: DonutSlice[]): number[] => {
  const total = slices.reduce((s, i) => s + i.value, 0)
  let acc = 0
  return slices.map((s) => {
    const start = acc
    acc += (s.value / total) * 100
    return start
  })
}
