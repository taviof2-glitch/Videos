/**
 * Días de negocio. Un "día" es de medianoche a medianoche en la zona horaria del negocio,
 * no la del dispositivo ni UTC. Las claves de día son 'YYYY-MM-DD'.
 */
export type Period = 'day' | 'week' | 'month' | 'all'
export type Range = { from?: string; to?: string }

const partsFormat = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string) {
  let f = partsFormat.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    partsFormat.set(timeZone, f)
  }
  return f
}

function parts(ms: number, timeZone: string) {
  const o: Record<string, number> = {}
  for (const p of formatter(timeZone).formatToParts(ms)) if (p.type !== 'literal') o[p.type] = Number(p.value)
  return o
}

/** Clave del día en que cae un instante, según la zona horaria. */
export function dayKey(instant: string | number | Date, timeZone: string): string {
  const p = parts(new Date(instant).getTime(), timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

const utcMs = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const fromUtcMs = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const addDays = (key: string, n: number) => fromUtcMs(utcMs(key) + n * 86_400_000)
export const monthStart = (key: string) => `${key.slice(0, 7)}-01`

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}

/** Lunes de la semana de ese día. */
export function weekStart(key: string): string {
  const dow = new Date(utcMs(key)).getUTCDay() // 0 = domingo
  return addDays(key, -((dow + 6) % 7))
}

/** Desfase (ms) de la zona respecto a UTC en un instante. */
function offsetMs(ms: number, timeZone: string): number {
  const p = parts(ms, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000
}

/** Primer instante (ms) del día en la zona, correcto también en días con cambio de horario. */
function startOfDayMs(key: string, timeZone: string): number {
  const mid = utcMs(key)
  const guess = mid - offsetMs(mid, timeZone)
  return mid - offsetMs(guess, timeZone)
}

/** Instantes ISO inclusivos que cubren el día completo. */
export function dayRange(key: string, timeZone: string): { from: string; to: string } {
  return {
    from: new Date(startOfDayMs(key, timeZone)).toISOString(),
    to: new Date(startOfDayMs(addDays(key, 1), timeZone) - 1).toISOString(),
  }
}

/** Primer y último día (claves) del periodo que contiene `anchor`. */
export function periodDays(period: Period, anchor: string): { start: string; end: string } | undefined {
  switch (period) {
    case 'day':
      return { start: anchor, end: anchor }
    case 'week': {
      const start = weekStart(anchor)
      return { start, end: addDays(start, 6) }
    }
    case 'month': {
      const start = monthStart(anchor)
      return { start, end: addDays(addMonths(start, 1), -1) }
    }
    case 'all':
      return undefined
  }
}

export function periodRange(period: Period, anchor: string, timeZone: string): Range {
  const days = periodDays(period, anchor)
  if (!days) return {}
  return { from: dayRange(days.start, timeZone).from, to: dayRange(days.end, timeZone).to }
}

/** Mueve el ancla un periodo hacia atrás (-1) o adelante (+1). */
export function shiftAnchor(period: Period, anchor: string, dir: -1 | 1): string {
  if (period === 'day') return addDays(anchor, dir)
  if (period === 'week') return addDays(anchor, 7 * dir)
  if (period === 'month') return addMonths(anchor, dir)
  return anchor
}

const label = (key: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', ...opts }).format(utcMs(key) + 12 * 3_600_000)

export const formatDay = (key: string) => label(key, { day: 'numeric', month: 'short', year: 'numeric' })
export const weekdayShort = (key: string) => label(key, { weekday: 'short' }).replace('.', '')
export const dayNumber = (key: string) => label(key, { day: 'numeric' })

export function periodLabel(period: Period, anchor: string): string {
  const days = periodDays(period, anchor)
  if (!days) return 'Todo el historial'
  if (period === 'day') return formatDay(anchor)
  if (period === 'month') return label(days.start, { month: 'long', year: 'numeric' })
  return `${label(days.start, { day: 'numeric', month: 'short' })} – ${formatDay(days.end)}`
}

/** ¿Es una clave de día real ('YYYY-MM-DD')? new Date('2026-02-31') no falla (se desborda a marzo), por eso se comprueba que vuelva igual. */
export function isValidDayKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  // toISOString() lanza con fechas imposibles como 2026-13-01, por eso se comprueba antes.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Días de `a` a `b` (positivo si `b` es posterior). */
export const daysBetween = (a: string, b: string) => Math.round((utcMs(b) - utcMs(a)) / 86_400_000)
