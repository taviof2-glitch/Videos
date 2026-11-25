// Cotizador rápido: del costo real del trabajo (material, horas, sueldo, gastos del taller) al precio que conviene cobrar.
// Viene del «Cotizador Houselite» que se hizo como página en claude.ai; aquí cada cotización se guarda como una Cotización de Conta.
import { createContact, listContacts } from './contacts'
import { addDays, dayKey } from './dates'
import { db } from './db'
import { formatMoney } from './money'
import { createQuote, DEFAULT_VALIDITY_DAYS, updateQuote } from './quotes'
import type { Business, Quote, QuoterSnapshot } from './types'

/** Lo que cuesta producir y lo que se quiere ganar. Las cantidades en pesos son pesos, no centavos. */
export type QuoterConfig = {
  hoja: number
  fondo: number
  bisS: number
  bisN: number
  corr: number
  jal: number
  pintM2: number
  hPint: number
  cubML: number
  desp: number
  sueldo: number
  gastos: number
  dias: number
  hDia: number
  margen: number
  anticipo: number
  km: number
}

export const DEFAULT_CONFIG: QuoterConfig = {
  hoja: 1100, fondo: 380, bisS: 32, bisN: 12, corr: 220, jal: 40, pintM2: 220, hPint: 0.8, cubML: 950, desp: 15,
  sueldo: 20000, gastos: 8000, dias: 24, hDia: 9, margen: 30, anticipo: 50, km: 3.5,
}

export const CONFIG_LABELS: Record<keyof QuoterConfig, string> = {
  hoja: 'Hoja de melamina 16 mm ($)', fondo: 'Hoja de fondo 3 mm ($)', bisS: 'Bisagra de cierre suave, c/u ($)', bisN: 'Bisagra normal, c/u ($)',
  corr: 'Par de correderas ($)', jal: 'Jaladera, c/u ($)', pintM2: 'Pintura y sellador por m² ($)', hPint: 'Horas de pintura por m²',
  cubML: 'Cubierta por metro ($)', desp: 'Desperdicio de material (%)', sueldo: 'Sueldo que quieres ganar al mes ($)',
  gastos: 'Gastos fijos del taller al mes ($)', dias: 'Días que trabajas al mes', hDia: 'Horas por día', margen: 'Ganancia del negocio (%)',
  anticipo: 'Anticipo (%)', km: 'Gasolina por km ($)',
}

/** Lo que lleva cada trabajo por unidad (metro, pieza o m²). */
export type JobType = {
  n: string
  u: string
  /** hojas de melamina */ h: number
  /** hojas de fondo */ f: number
  /** bisagras */ b: number
  /** pares de correderas */ c: number
  /** jaladeras */ j: number
  /** material directo ($) */ m: number
  /** horas de trabajo */ hr: number
  /** m² de frente (para la pintura) */ fr: number
  /** 1 si lleva cubierta */ cub: number
  /** tu precio de lista por unidad ($), 0 si no tienes */ lista: number
  /** 1 si el trabajo ya es de pintura */ pint?: number
}

export const JOB_FIELDS: Record<Exclude<keyof JobType, 'n' | 'u' | 'cub' | 'pint'>, string> = {
  h: 'Hojas melamina', f: 'Hojas fondo', b: 'Bisagras', c: 'Pares correderas', j: 'Jaladeras', m: 'Material directo $', hr: 'Horas', fr: 'm² de frente', lista: 'Tu precio lista $',
}

export const DEFAULT_TYPES: Record<string, JobType> = {
  cocina_inf: { n: 'Cocina – muebles bajos', u: 'metros lineales', h: 1.3, f: 0.4, b: 4, c: 1, j: 2, m: 0, hr: 8, fr: 0.75, cub: 1, lista: 6000 },
  cocina_sup: { n: 'Cocina – alacenas', u: 'metros lineales', h: 0.9, f: 0.4, b: 4, c: 0, j: 2, m: 0, hr: 6, fr: 0.6, cub: 0, lista: 6000 },
  closet: { n: 'Closet', u: 'metros lineales', h: 1.7, f: 1, b: 6, c: 1, j: 2, m: 0, hr: 9, fr: 2.2, cub: 0, lista: 6000 },
  tv: { n: 'Mueble de TV', u: 'metros lineales', h: 0.8, f: 0.3, b: 2, c: 1, j: 2, m: 0, hr: 6, fr: 0.5, cub: 0, lista: 0 },
  barra: { n: 'Barra / mostrador', u: 'metros lineales', h: 1.1, f: 0.3, b: 2, c: 0, j: 0, m: 0, hr: 6, fr: 1, cub: 1, lista: 0 },
  puerta: { n: 'Puerta', u: 'piezas', h: 0, f: 0, b: 0, c: 0, j: 0, m: 2200, hr: 10, fr: 4, cub: 0, lista: 4800 },
  rest: { n: 'Pintura / restauración', u: 'm²', h: 0, f: 0, b: 0, c: 0, j: 0, m: 60, hr: 1.5, fr: 1, cub: 0, lista: 0, pint: 1 },
  otro: { n: 'Otro a la medida', u: 'piezas', h: 0, f: 0, b: 0, c: 0, j: 0, m: 0, hr: 0, fr: 0, cub: 0, lista: 0 },
}

/** Los costos del negocio con los valores iniciales de lo que no se ha cambiado. */
export function quoterSettings(business: Pick<Business, 'quoter'>): { cfg: QuoterConfig; types: Record<string, JobType> } {
  const saved = business.quoter
  return { cfg: { ...DEFAULT_CONFIG, ...saved?.cfg }, types: saved?.types && Object.keys(saved.types).length ? saved.types : structuredClone(DEFAULT_TYPES) }
}

export async function saveQuoterSettings(businessId: string, cfg: QuoterConfig, types: Record<string, JobType>): Promise<void> {
  await db.business.update(businessId, { quoter: { cfg, types }, updatedAt: new Date().toISOString() })
}

/** Escritorio a la medida (medidas en cm). */
export type DeskSpec = { largo: number; fondo: number; alto: number; cajones: number }
export const DESK_KEY = 'escritorio'
export const DEFAULT_DESK: DeskSpec = { largo: 120, fondo: 60, alto: 75, cajones: 2 }

/** m² que rinde una hoja de 1.22 × 2.44 m. */
const SHEET_M2 = 2.98

/**
 * Lo que lleva un escritorio según sus medidas y cajones (por pieza):
 * cubierta, dos costados y faldón trasero de melamina; cada cajón suma su caja y frente, un fondo, un par de correderas y una jaladera.
 */
export function deskJob(d: DeskSpec): JobType {
  const l = Math.max(0, d.largo) / 100
  const f = Math.max(0, d.fondo) / 100
  const a = Math.max(0, d.alto) / 100
  const n = Math.max(0, Math.round(d.cajones))
  const body = l * f + 2 * f * a + l * 0.35
  const drawers = n * 0.45
  return {
    n: 'Escritorio', u: 'piezas',
    h: (body + drawers) / SHEET_M2, f: (n * 0.4 * f) / SHEET_M2, b: 0, c: n, j: n, m: 0,
    hr: 4 + 1.5 * n, fr: l * f + 2 * f * a + n * 0.08, cub: 0, lista: 0,
  }
}

export const deskSummary = (d: DeskSpec) => `${d.largo} × ${d.fondo} × ${d.alto} cm, ${d.cajones === 0 ? 'sin cajones' : d.cajones === 1 ? '1 cajón' : `${d.cajones} cajones`}`

/** El trabajo que se cotiza: uno de la lista o el escritorio a la medida. */
export function jobOf(types: Record<string, JobType>, f: Pick<QuoterForm, 'type' | 'desk'>): JobType | undefined {
  if (f.type === DESK_KEY && !types[DESK_KEY]) return deskJob(f.desk ?? DEFAULT_DESK)
  return types[f.type]
}

export type QuoterForm = {
  desk?: DeskSpec
  type: string
  q: number
  km: number
  suave: boolean
  pint: boolean
  cub: boolean
  xmat: number
  xhrs: number
}

export const DEFAULT_FORM: QuoterForm = { type: 'cocina_inf', q: 3, km: 5, suave: true, pint: false, cub: true, xmat: 0, xhrs: 0 }

const cents = (pesos: number) => Math.round(pesos * 100)

export type QuoterResult = {
  priceCents: number
  costCents: number
  materialCents: number
  /** Tu sueldo por las horas del trabajo. */
  laborCents: number
  /** Gastos fijos del taller por esas horas, más la gasolina. */
  shopCents: number
  profitCents: number
  hours: number
  perUnitCents: number
  advanceCents: number
  withPaint: boolean
  withTop: boolean
  /** Contra tu precio de lista: lo que cobrarías y lo que te quedaría (negativo = pérdida). */
  list?: { totalCents: number; diffCents: number }
}

/** El precio sale de lo que cuesta (material + sueldo + taller + gasolina) más el margen, redondeado hacia arriba a $50. */
export function calcQuote(cfg: QuoterConfig, types: Record<string, JobType>, f: QuoterForm): QuoterResult {
  const t = jobOf(types, f) ?? Object.values(types)[0]
  const q = Math.max(0, f.q || 0)
  const withPaint = !!t.pint || f.pint
  const withTop = !!t.cub && f.cub
  const hMes = cfg.dias * cfg.hDia || 1
  let mat = q * (t.h * cfg.hoja * (1 + cfg.desp / 100) + t.f * cfg.fondo + t.b * (f.suave ? cfg.bisS : cfg.bisN) + t.c * cfg.corr + t.j * cfg.jal + t.m)
  if (withPaint) mat += q * t.fr * cfg.pintM2
  if (withTop) mat += q * cfg.cubML
  mat += Math.max(0, f.xmat || 0)
  const hours = q * t.hr + (withPaint ? q * t.fr * cfg.hPint : 0) + Math.max(0, f.xhrs || 0)
  const labor = (hours * cfg.sueldo) / hMes
  const shop = (hours * cfg.gastos) / hMes + Math.max(0, f.km || 0) * 2 * cfg.km
  const cost = mat + labor + shop
  const price = Math.ceil((cost * (1 + cfg.margen / 100)) / 50) * 50
  const out: QuoterResult = {
    priceCents: cents(price), costCents: cents(cost), materialCents: cents(mat), laborCents: cents(labor), shopCents: cents(shop), profitCents: cents(price - cost),
    hours, perUnitCents: q ? Math.round(cents(price) / q) : 0, advanceCents: cents((price * cfg.anticipo) / 100), withPaint, withTop,
  }
  if (t.lista && q) out.list = { totalCents: cents(t.lista * q), diffCents: cents(t.lista * q - cost) }
  return out
}

const UNIT_SINGULAR: Record<string, string> = { 'metros lineales': 'metro', piezas: 'pieza' }
export const unitName = (u: string) => UNIT_SINGULAR[u] ?? u

export type MessageExtras = { customer: string; description: string; delivery: string; iva: boolean; ivaRate: number }

/** El texto de la cotización para mandar por WhatsApp. */
export function quoteMessage(business: Pick<Business, 'name' | 'currency'>, cfg: QuoterConfig, types: Record<string, JobType>, f: QuoterForm, r: QuoterResult, x: MessageExtras): string {
  const t = jobOf(types, f) ?? Object.values(types)[0]
  const desk = f.type === DESK_KEY && f.desk ? `medidas ${deskSummary(f.desk)}` : ''
  const money = (c: number) => formatMoney(c, business.currency)
  const extras = [desk, r.withPaint && !t.pint ? 'acabado pintado' : '', r.withTop ? 'con cubierta' : '', f.suave && (t.b || t.c) ? 'herrajes de cierre suave' : ''].filter(Boolean).join(', ')
  const total = x.iva ? Math.round(r.priceCents * (1 + x.ivaRate / 100)) : r.priceCents
  const advance = Math.round((total * cfg.anticipo) / 100)
  return [
    `Hola${x.customer ? ` ${x.customer}` : ''}, te comparto la cotización de ${business.name}:`,
    '',
    `*${t.n}*: ${f.q} ${t.u}${extras ? ` (${extras})` : ''}${x.description ? `\n${x.description}` : ''}`,
    '',
    x.iva ? `Precio: ${money(r.priceCents)} + IVA ${x.ivaRate} %\nTotal: *${money(total)}*` : `Precio: *${money(total)}*`,
    'Incluye material, fabricación e instalación.',
    `Anticipo para iniciar: ${money(advance)}, el resto al instalar.`,
    `Entrega aprox.: ${x.delivery.trim() || 'por confirmar'}`,
    `Vigencia de la cotización: ${DEFAULT_VALIDITY_DAYS} días.`,
    '',
    `Cualquier duda aquí estoy. ${business.name}`,
  ].join('\n')
}

export type SaveExtras = MessageExtras & { phone: string; quoteId?: string }

/**
 * Guarda el trabajo como una Cotización de Conta (con el cliente: si no existe se crea). Con `quoteId` actualiza esa cotización.
 * La cotización conserva los datos del cotizador para poder abrirla y cambiarla después.
 */
export async function saveQuoterQuote(business: Business, f: QuoterForm, x: SaveExtras): Promise<Quote> {
  const { cfg, types } = quoterSettings(business)
  const t = jobOf(types, f)
  if (!t) throw new Error('Ese tipo de trabajo ya no existe')
  const name = x.customer.trim()
  if (!name) throw new Error('Escribe el nombre del cliente para guardar la cotización')
  if (!(f.q > 0)) throw new Error('La cantidad debe ser mayor que cero')
  const r = calcQuote(cfg, types, f)
  if (r.priceCents <= 0) throw new Error('El precio es cero: revisa los costos del trabajo')

  const existing = (await listContacts(business.id, 'customer')).find((c) => c.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0)
  const contact = existing ?? (await createContact(business.id, 'customer', { name, phone: x.phone.trim() }))
  const taxRate = x.iva ? x.ivaRate : 0
  const total = Math.round(r.priceCents * (1 + taxRate / 100))
  const snapshot: QuoterSnapshot = { type: f.type, q: f.q, suave: f.suave, pint: f.pint, cub: f.cub, km: f.km, xmat: f.xmat, xhrs: f.xhrs, desc: x.description.trim(), delivery: x.delivery.trim(), iva: x.iva, costCents: r.costCents, ...(f.type === DESK_KEY && f.desk && { desk: f.desk }) }
  const input = {
    title: t.n,
    contactId: contact.id,
    validUntil: addDays(dayKey(Date.now(), business.timezone), DEFAULT_VALIDITY_DAYS),
    taxRate,
    advanceCents: Math.round((total * cfg.anticipo) / 100),
    notes: [x.delivery.trim() && `Entrega aprox.: ${x.delivery.trim()}`].filter(Boolean).join('\n'),
    items: [{ name: `${t.n} · ${f.q} ${t.u}${f.type === DESK_KEY && f.desk ? ` · ${deskSummary(f.desk)}` : ''}${x.description.trim() ? ` · ${x.description.trim()}` : ''}`, quantity: 1, unitPriceCents: r.priceCents }],
    quoter: snapshot,
  }
  return x.quoteId ? updateQuote(x.quoteId, input) : createQuote(business.id, input)
}
