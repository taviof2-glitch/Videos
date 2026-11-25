/** Escala "bonita": tope y paso redondos (1, 2 o 5 × 10ⁿ) con 4 divisiones. */
export function niceScale(max: number, ticks = 4): { top: number; step: number } {
  if (max <= 0) return { top: ticks, step: 1 }
  const raw = max / ticks
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!
  return { top: step * Math.ceil(max / step), step }
}
