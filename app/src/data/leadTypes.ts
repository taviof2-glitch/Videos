// Tipos de mueble del cotizador en línea y el rango de precio. Sin nada del navegador (lo usa api/cotiza.ts).

export const LEAD_TYPES: [string, string, number][] = [
  ['closet', 'Closet', 650000],
  ['cocina', 'Cocina integral (por metro lineal)', 900000],
  ['tv', 'Mueble de TV', 450000],
  ['librero', 'Librero o repisero', 350000],
  ['bano', 'Mueble de baño', 400000],
  ['escritorio', 'Escritorio', 300000],
]

/** Rango que ve el cliente: ±15 % del precio por metro × metros (redondeado a cientos). */
export function estimateRange(perMeterCents: number, meters: number): [number, number] {
  const mid = perMeterCents * Math.max(0.3, meters)
  const r = (c: number) => Math.round(c / 10000) * 10000
  return [r(mid * 0.85), r(mid * 1.15)]
}
