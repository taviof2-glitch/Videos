// Salir a instalar: lista de lo que hay que llevar a cada instalación y la ruta del día en Google Maps.
import type { JobItem } from './jobs'
import { shoppingList } from './jobs'
import type { QuoterConfig } from './quoter'
import type { Appointment } from './types'

/** Herramienta que siempre se lleva a instalar. */
export const TOOLS = ['Taladro y atornillador con baterías cargadas', 'Brocas y puntas', 'Nivel y flexómetro', 'Pijas y taquetes', 'Silicón y pistola', 'Escalera', 'Cobijas para no rayar', 'Bolsa para la basura']

export type CheckItem = { key: string; label: string; group: 'herrajes' | 'herramienta' | 'cobro' }

/** Lista para salir a instalar: herrajes de la obra (sin las hojas, que ya van en el mueble), herramienta y saldo por cobrar. */
export function installChecklist(job: JobItem | undefined, cfg: QuoterConfig, money: (c: number) => string): CheckItem[] {
  const out: CheckItem[] = []
  if (job?.quote) {
    for (const i of shoppingList(job.quote, cfg)) if (!/^Hoja/.test(i.name) && i.name !== 'Cubrecanto') out.push({ key: `h:${i.name}`, label: `${i.qty} ${i.unit} — ${i.name}`, group: 'herrajes' })
  }
  for (const t of TOOLS) out.push({ key: `t:${t}`, label: t, group: 'herramienta' })
  if (job && job.balanceCents > 0) out.push({ key: 'cobro', label: `Cobrar el saldo: ${money(job.balanceCents)} (llevar la terminal o los datos para transferencia)`, group: 'cobro' })
  return out
}

/** Ruta del día: las citas pendientes con dirección, en orden de hora, y el enlace de Google Maps que sale desde donde estás. */
export function dayRoute(list: Appointment[]): { stops: Appointment[]; url: string } | undefined {
  const stops = list.filter((a) => !a.done && a.address.trim()).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
  if (!stops.length) return undefined
  const enc = (a: Appointment) => encodeURIComponent(a.address.trim())
  const last = stops[stops.length - 1]
  const mid = stops.slice(0, -1).slice(0, 9) // Google Maps acepta hasta 9 paradas intermedias en el teléfono
  const url = `https://www.google.com/maps/dir/?api=1&destination=${enc(last)}${mid.length ? `&waypoints=${mid.map(enc).join('%7C')}` : ''}&travelmode=driving`
  return { stops, url }
}
