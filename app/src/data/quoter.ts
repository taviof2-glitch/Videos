// Cotizador rápido: del costo real del trabajo (material, horas, sueldo, gastos del taller) al precio que conviene cobrar.
// Viene del «Cotizador Houselite» que se hizo como página en claude.ai; aquí cada cotización se guarda como una Cotización de Conta.
import { createContact, listContacts } from './contacts'
import { closetLayout, cutList, edgeMeters, drawerModules, hasMaletero, outerSides, isKitchen, KIND_LABEL, modules, modulesSummary, projectPieces, type CutSpec, type FurnitureKind } from './cutlist'
import { calcBase, defaultOpts, defaultValues, templateOf } from './bases'
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
  /** Escritorio a la medida */
  deskHBase: number
  deskHCajon: number
  deskFaldon: number
  deskCajonM2: number
  deskExtra: number
  deskLista: number
  /** Muebles por medidas (cocina, closet, TV) */
  medHBase: number
  medHM2: number
  medHPuerta: number
  /** Cocina por módulos */
  medHModulo: number
  medModuloExtra: number
  /** Closet */
  tuboML: number
  rielML: number
  cantoML: number
  /** Bases: despiece en mm */
  esp: number
  hojaL: number
  hojaA: number
  sierra: number
  refile: number
  tcD: number
  tcG: number
  pata: number
  sop: number
  tor: number
  piston: number
  hPieza: number
  hCajon: number
  hPuerta: number
  hInst: number
  holgCajon: number
  tapa: number
  clavo: number
  deslz: number
  cubPiedra: number
  cubSolido: number
  tor30: number
  tor17: number
  angulo: number
  push: number
  pataMadera: number
  rueda: number
}

export const DEFAULT_CONFIG: QuoterConfig = {
  hoja: 1100, fondo: 380, bisS: 32, bisN: 12, corr: 220, jal: 40, pintM2: 220, hPint: 0.8, cubML: 950, desp: 15,
  sueldo: 20000, gastos: 8000, dias: 24, hDia: 9, margen: 30, anticipo: 50, km: 3.5,
  deskHBase: 4, deskHCajon: 1.5, deskFaldon: 35, deskCajonM2: 0.45, deskExtra: 0, deskLista: 0,
  medHBase: 2, medHM2: 1.2, medHPuerta: 0.5, medHModulo: 0.5, medModuloExtra: 0, tuboML: 120, rielML: 350, cantoML: 8,
  esp: 16, hojaL: 2440, hojaA: 1220, sierra: 4, refile: 10, tcD: 6, tcG: 18, pata: 15, sop: 25, tor: 0.6, piston: 180, hPieza: 0.15, hCajon: 0.6, hPuerta: 0.3, hInst: 1.5, holgCajon: 20, tapa: 0.4, clavo: 0.15, deslz: 4, cubPiedra: 2800, cubSolido: 3500, tor30: 0.4, tor17: 0.25, angulo: 1.5, push: 45, pataMadera: 60, rueda: 35,
}

export const CONFIG_LABELS: Record<keyof QuoterConfig, string> = {
  hoja: 'Hoja de melamina ($)', fondo: 'Hoja de fondo 3 mm ($)', bisS: 'Bisagra de cierre suave, c/u ($)', bisN: 'Bisagra normal, c/u ($)',
  corr: 'Par de correderas ($)', jal: 'Jaladera, c/u ($)', pintM2: 'Pintura y sellador por m² ($)', hPint: 'Horas de pintura por m²',
  cubML: 'Cubierta postformada por metro ($)', desp: 'Desperdicio de material (%)', sueldo: 'Sueldo que quieres ganar al mes ($)',
  gastos: 'Gastos fijos del taller al mes ($)', dias: 'Días que trabajas al mes', hDia: 'Horas por día', margen: 'Ganancia del negocio (%)',
  anticipo: 'Anticipo (%)', km: 'Gasolina por km ($)',
  deskHBase: 'Horas base del escritorio (sin cajones)', deskHCajon: 'Horas por cada cajón (en cualquier mueble)', deskFaldon: 'Alto del faldón trasero (cm)',
  deskCajonM2: 'Melamina por cajón (m²)', deskExtra: 'Material extra por escritorio ($): tornillos, canto, etc.', deskLista: 'Tu precio de lista por escritorio ($, 0 si no tienes)',
  medHBase: 'Horas base por mueble (trazar, armar, instalar)', medHM2: 'Horas por cada m² de melamina', medHPuerta: 'Horas por cada puerta',
  medHModulo: 'Cocina: horas por cada módulo (armar y unir)', medModuloExtra: 'Cocina: material extra por módulo ($): patas, tornillos, uniones',
  tuboML: 'Closet: tubo para colgar, por metro ($, con soportes)', rielML: 'Closet: riel de puertas corredizas, por metro ($)', cantoML: 'Cubrecanto, por metro ($)',
  esp: 'Espesor del tablero (mm)', hojaL: 'Largo de la hoja (mm)', hojaA: 'Ancho de la hoja (mm)', sierra: 'Corte de sierra (mm)', refile: 'Orilla que se refila (mm)',
  tcD: 'Canto delgado, por metro ($)', tcG: 'Canto grueso 2 mm, por metro ($)', pata: 'Pata niveladora, c/u ($)', sop: 'Soporte oculto o colgador, c/u ($)', tor: 'Tornillo 4×50 (estructura), c/u ($)', piston: 'Pistón, c/u ($)',
  hPieza: 'Horas por pieza (cortar, cantear, barrenar)', hCajon: 'Horas por cajón (armar y ajustar)', hPuerta: 'Horas por puerta (bisagras y ajuste)', hInst: 'Horas de instalación por mueble', holgCajon: 'Holgura atrás del cajón (mm)',
  tapa: 'Tapa tornillo, c/u ($)', clavo: 'Clavo de 1" para fondos, c/u ($)', deslz: 'Deslizador 3/4", c/u ($)', cubPiedra: 'Cubierta de piedra por metro ($)', cubSolido: 'Cubierta de superficie sólida por metro ($)',
  tor30: 'Tornillo 4×30 (correderas y jaladeras), c/u ($)', tor17: 'Tornillo 3.5×17 (bisagras y fondos de cajón), c/u ($)', angulo: 'Ángulo de plástico 40×20, c/u ($)', push: 'Push-open, c/u ($)', pataMadera: 'Pata de madera de 20 cm, c/u ($)', rueda: 'Rueda, c/u ($)',
}

/** Los costos de los muebles que se cotizan por medidas. */
export const MEASURED_COST_KEYS = ['medHBase', 'medHM2', 'medHPuerta', 'medHModulo', 'medModuloExtra', 'tuboML', 'rielML', 'cantoML'] as const satisfies readonly (keyof QuoterConfig)[]

/** Los costos de la pestaña Bases (despiece en milímetros). */
export const BASE_COST_KEYS = ['esp', 'hojaL', 'hojaA', 'sierra', 'refile', 'tcD', 'tcG', 'pata', 'sop', 'tor', 'piston', 'hPieza', 'hCajon', 'hPuerta', 'hInst', 'holgCajon', 'tapa', 'clavo', 'deslz', 'cubPiedra', 'cubSolido', 'tor30', 'tor17', 'angulo', 'push', 'pataMadera', 'rueda'] as const satisfies readonly (keyof QuoterConfig)[]

/** Los costos que son del escritorio (van en su propia sección de «Mis costos»). */
export const DESK_COST_KEYS = ['deskHBase', 'deskHCajon', 'deskFaldon', 'deskCajonM2', 'deskExtra', 'deskLista'] as const satisfies readonly (keyof QuoterConfig)[]

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
  /** metros de cubierta por unidad (1 si no se indica) */ cubM?: number
}

export const JOB_FIELDS: Record<Exclude<keyof JobType, 'n' | 'u' | 'cub' | 'pint' | 'cubM'>, string> = {
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
/** Un material con su precio por hoja (melamina de color, MDF…). El de siempre es la «hoja de melamina» de los costos. */
export type Mat = { n: string; hoja: number }

export function quoterSettings(business: Pick<Business, 'quoter'>): { cfg: QuoterConfig; types: Record<string, JobType>; mats: Mat[]; serv: import('./services').ServConfig } {
  const saved = business.quoter
  const types = saved?.types && Object.keys(saved.types).length ? saved.types : structuredClone(DEFAULT_TYPES)
  // «Otro a la medida» siempre existe: ahí llegan los muebles de Bases (material y horas ya calculados).
  return { cfg: { ...DEFAULT_CONFIG, ...saved?.cfg }, types: 'otro' in types ? types : { ...types, otro: DEFAULT_TYPES.otro }, mats: saved?.mats ?? [], serv: saved?.serv ?? {} }
}

export async function saveQuoterSettings(businessId: string, cfg: QuoterConfig, types: Record<string, JobType>, mats?: Mat[], serv?: import('./services').ServConfig): Promise<void> {
  const old = (await db.business.get(businessId))?.quoter
  const list = (mats ?? old?.mats ?? []).filter((m) => m.n.trim() && m.hoja > 0).map((m) => ({ n: m.n.trim(), hoja: m.hoja }))
  const services = serv ?? old?.serv
  await db.business.update(businessId, { quoter: { cfg, types, ...(list.length && { mats: list }), ...(services && { serv: services }) }, updatedAt: new Date().toISOString() })
}

/** Closet sencillo abierto con tubos (medidas en cm); el material y las horas salen del despiece de Bases. */
export type SimpleCloset = { ancho: number; alto: number; fondo: number; tubos: number; repisas: number }
export const SIMPLE_KEY = 'closet_sencillo'
export const DEFAULT_SIMPLE: SimpleCloset = { ancho: 90, alto: 210, fondo: 50, tubos: 2, repisas: 0 }
export const simpleSummary = (s: SimpleCloset) => `${s.ancho} × ${s.alto} × ${s.fondo} cm, ${s.tubos === 1 ? '1 tubo' : `${s.tubos} tubos`}${s.repisas ? `, ${s.repisas === 1 ? '1 repisa' : `${s.repisas} repisas`}` : ''}`

export function simpleJob(s: SimpleCloset, cfg: QuoterConfig = DEFAULT_CONFIG): JobType {
  const t = templateOf(SIMPLE_KEY)
  const r = calcBase({ key: SIMPLE_KEY, values: { ...defaultValues(t), ancho: s.ancho * 10, alto: s.alto * 10, fondo: s.fondo * 10, tubos: s.tubos, repisas: s.repisas }, opts: defaultOpts(cfg, t) }, cfg)
  return { n: 'Closet sencillo abierto', u: 'piezas', h: 0, f: 0, b: 0, c: 0, j: 0, m: r.material, hr: r.hours, fr: 0, cub: 0, lista: 0 }
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
export function deskJob(d: DeskSpec, cfg: QuoterConfig = DEFAULT_CONFIG): JobType {
  const l = Math.max(0, d.largo) / 100
  const f = Math.max(0, d.fondo) / 100
  const a = Math.max(0, d.alto) / 100
  const n = Math.max(0, Math.round(d.cajones))
  const body = l * f + 2 * f * a + l * (Math.max(0, cfg.deskFaldon) / 100)
  const drawers = n * Math.max(0, cfg.deskCajonM2)
  return {
    n: 'Escritorio', u: 'piezas',
    h: (body + drawers) / SHEET_M2, f: (n * 0.4 * f) / SHEET_M2, b: 0, c: n, j: n, m: Math.max(0, cfg.deskExtra),
    hr: Math.max(0, cfg.deskHBase) + Math.max(0, cfg.deskHCajon) * n, fr: l * f + 2 * f * a + n * 0.08, cub: 0, lista: Math.max(0, cfg.deskLista),
  }
}

export const deskSummary = (d: DeskSpec) => `${d.largo} × ${d.fondo} × ${d.alto} cm, ${d.cajones === 0 ? 'sin cajones' : d.cajones === 1 ? '1 cajón' : `${d.cajones} cajones`}`

/** Los trabajos de la lista que también se pueden cotizar por medidas, y qué mueble del despiece les toca. */
export const MEASURED_KIND: Record<string, FurnitureKind> = { cocina_inf: 'bajo', cocina_sup: 'alacena', closet: 'closet', tv: 'tv', barra: 'barra', librero: 'librero', bano: 'bano' }
/** Muebles por medidas que siempre están en la lista aunque el negocio no tenga un trabajo con esa clave (como el escritorio). */
export const BUILTIN_MEASURED: Record<string, string> = { librero: 'Librero a la medida', bano: 'Mueble de baño a la medida' }

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)

/** «180 × 45 × 40 cm, 2 puertas, 1 entrepaño» (lo que es cero no se menciona). */
export function medSummary(s: CutSpec): string {
  const parts = [`${s.largo} × ${s.alto} × ${s.fondo} cm`]
  const mods = modulesSummary(s)
  if (mods) parts.push(mods)
  if (s.kind === 'closet') {
    // En el closet cajones y entrepaños son por torre.
    const { n, libre } = closetLayout(s)
    parts.push(`${plural(n, 'torre', 'torres')} de 60 cm${libre > 0 ? ` y ${libre} cm libres` : ''}`)
    const each = n > 1 ? ' por torre' : ''
    if (s.puertas > 0) parts.push(`${plural(s.puertaTipo === 'corrediza' ? Math.max(2, s.puertas) : s.puertas, 'puerta', 'puertas')} ${s.puertaTipo === 'corrediza' ? 'corredizas' : 'abatibles'}`)
    if (s.cajones > 0) parts.push(plural(s.cajones, 'cajón', 'cajones') + each)
    if (s.entrepanos > 0) parts.push(plural(s.entrepanos, 'entrepaño', 'entrepaños') + each)
    if ((s.tubos ?? 0) > 0) parts.push(plural(s.tubos!, 'tubo', 'tubos'))
    parts.push(hasMaletero(s) ? 'con maletero' : 'sin maletero')
    parts.push(outerSides(s) === 0 ? 'empotrado' : plural(outerSides(s), 'costado exterior', 'costados exteriores'))
    return parts.join(', ')
  }
  // En cocina por módulos las cantidades son por módulo, y los cajones van solo en algunos.
  const each = mods ? ' por módulo' : ''
  if (s.puertas > 0) parts.push(plural(s.puertas, 'puerta', 'puertas') + each)
  if (s.cajones > 0) parts.push(plural(s.cajones, 'cajón', 'cajones') + (mods ? ` en ${plural(drawerModules(s), 'módulo', 'módulos')}` : ''))
  if (s.entrepanos > 0) parts.push(plural(s.entrepanos, 'entrepaño', 'entrepaños') + each)
  if (s.divisiones > 0) parts.push(plural(s.divisiones, 'división', 'divisiones') + each)
  return parts.join(', ')
}

/**
 * Lo que lleva un mueble según sus medidas (por pieza). El material sale del mismo despiece que se corta:
 * m² de melamina y de fondo, bisagras por puerta según su alto, una corredera por cajón y una jaladera por puerta y cajón.
 */
export function measuredJob(spec: CutSpec, cfg: QuoterConfig = DEFAULT_CONFIG, base?: JobType): JobType {
  const pieces = cutList(spec)
  const m2 = (pick: (name: string, material: string) => boolean) => pieces.filter((p) => pick(p.name, p.material)).reduce((a, p) => a + p.qty * p.largo * p.ancho, 0) / 10_000
  const area = m2((_, material) => material === 'melamina')
  // Se cuentan del despiece: en cocina hay puertas y cajones en cada módulo.
  const count = (prefix: string) => pieces.filter((p) => p.name.startsWith(prefix)).reduce((a, p) => a + p.qty, 0)
  const puertas = count('Puerta')
  const cajones = count('Frente de cajón')
  const door = pieces.find((p) => p.name.startsWith('Puerta'))
  // Las corredizas van en riel, sin bisagras.
  const sliding = pieces.some((p) => p.name.startsWith('Puerta corrediza'))
  const hinges = door && !sliding ? (door.largo <= 100 ? 2 : door.largo <= 160 ? 3 : 4) : 0
  const tubeMeters = pieces.filter((p) => p.material === 'tubo').reduce((a, p) => a + (p.qty * p.largo) / 100, 0)
  const fronts = m2((name) => name.startsWith('Puerta') || name.startsWith('Frente de cajón'))
  const mods = isKitchen(spec.kind) ? modules(spec).length : 0
  const metros = Math.max(0, spec.largo) / 100
  return {
    n: base?.n ?? KIND_LABEL[spec.kind], u: 'piezas',
    h: area / SHEET_M2, f: m2((_, material) => material === 'fondo') / SHEET_M2, b: puertas * hinges, c: cajones, j: puertas + cajones, m: edgeMeters(pieces) * Math.max(0, cfg.cantoML) + mods * Math.max(0, cfg.medModuloExtra) + tubeMeters * Math.max(0, cfg.tuboML) + (sliding ? metros * Math.max(0, cfg.rielML) : 0),
    hr: Math.max(0, cfg.medHBase) + area * Math.max(0, cfg.medHM2) + puertas * Math.max(0, cfg.medHPuerta) + cajones * Math.max(0, cfg.deskHCajon) + mods * Math.max(0, cfg.medHModulo),
    fr: fronts || (metros * Math.max(0, spec.alto)) / 100, cub: base?.cub ?? (spec.kind === 'bajo' ? 1 : 0), cubM: metros,
    // El precio de lista de estos trabajos es por metro lineal.
    lista: (base?.lista ?? 0) * metros,
  }
}

/** El trabajo que se cotiza: uno de la lista (por metro o por medidas) o el escritorio a la medida. */
export function jobOf(types: Record<string, JobType>, f: Pick<QuoterForm, 'type' | 'desk' | 'med' | 'simple'>, cfg: QuoterConfig = DEFAULT_CONFIG): JobType | undefined {
  if (f.type === DESK_KEY && !types[DESK_KEY]) return deskJob(f.desk ?? DEFAULT_DESK, cfg)
  if (f.type === SIMPLE_KEY && !types[SIMPLE_KEY]) return simpleJob(f.simple ?? DEFAULT_SIMPLE, cfg)
  if (isMeasured(types, f)) return measuredJob(f.med!, cfg, types[f.type])
  return types[f.type]
}

/** Si ese trabajo se está cotizando por medidas. */
export const isMeasured = (types: Record<string, JobType>, f: Pick<QuoterForm, 'type' | 'med'>) => !!f.med && f.type in MEASURED_KIND && (f.type in types || f.type in BUILTIN_MEASURED)

export type QuoterForm = {
  /** Material elegido (nombre en la lista de materiales). */
  mat?: string
  desk?: DeskSpec
  /** Medidas del mueble, si se cotiza por medidas. */
  med?: CutSpec
  /** Mueble de la pestaña Bases que se pasó al cotizador. */
  base?: import('./bases').BaseState
  /** Closet sencillo abierto (cm). */
  simple?: SimpleCloset
  serv?: import('./services').ServState
  parts?: import('./services').Part[]
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
export function calcQuote(cfg: QuoterConfig, types: Record<string, JobType>, f: QuoterForm, mats: Mat[] = []): QuoterResult {
  return calcJob(cfg, jobOf(types, f, cfg) ?? Object.values(types)[0], f, mats)
}

/** El precio de un trabajo del que ya se sabe el material y las horas: igual que «Otro a la medida» en Cotizar. */
export function priceFromCost(cfg: QuoterConfig, materialPesos: number, hours: number, km = 0, suave = true): QuoterResult {
  return calcJob(cfg, DEFAULT_TYPES.otro, { type: 'otro', q: 1, km, suave, pint: false, cub: false, xmat: materialPesos, xhrs: hours }, [])
}

/** El precio de un trabajo ya resuelto (lo que lleva por unidad). */
function calcJob(cfg0: QuoterConfig, t: JobType, f: QuoterForm, mats: Mat[]): QuoterResult {
  // Con otro material cambia el precio de la hoja.
  const hoja = (f.mat && mats.find((m) => m.n === f.mat)?.hoja) || cfg0.hoja
  const cfg = hoja === cfg0.hoja ? cfg0 : { ...cfg0, hoja }
  const q = Math.max(0, f.q || 0)
  const withPaint = !!t.pint || f.pint
  const withTop = !!t.cub && f.cub
  const hMes = cfg.dias * cfg.hDia || 1
  let mat = q * (t.h * cfg.hoja * (1 + cfg.desp / 100) + t.f * cfg.fondo + t.b * (f.suave ? cfg.bisS : cfg.bisN) + t.c * cfg.corr + t.j * cfg.jal + t.m)
  if (withPaint) mat += q * t.fr * cfg.pintM2
  if (withTop) mat += q * cfg.cubML * (t.cubM ?? 1)
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

/** A qué trabajo de la lista corresponde cada mueble del despiece (para su nombre, precio de lista y cubierta). */
const KIND_TYPE: Record<string, string> = { bajo: 'cocina_inf', alacena: 'cocina_sup', closet: 'closet', tv: 'tv', barra: 'barra' }

export type ProjectExtra = { spec: CutSpec; name: string; summary: string; result: QuoterResult }

/**
 * Los demás muebles del proyecto (los que se agregan en el despiece), cada uno con su precio:
 * mismas opciones que el principal (herrajes, pintura, cubierta, material) y sin gasolina, que ya va en el principal.
 */
export function projectExtras(cfg: QuoterConfig, types: Record<string, JobType>, f: QuoterForm, more: CutSpec[] = [], mats: Mat[] = []): ProjectExtra[] {
  return more.map((spec) => {
    const desk = spec.kind === 'escritorio'
    const deskSpec = { largo: spec.largo, fondo: spec.fondo, alto: spec.alto, cajones: spec.cajones }
    const t = desk ? deskJob(deskSpec, cfg) : measuredJob(spec, cfg, types[KIND_TYPE[spec.kind]])
    const result = calcJob(cfg, t, { type: '', q: 1, km: 0, suave: f.suave, pint: f.pint, cub: f.cub, xmat: 0, xhrs: 0, mat: f.mat }, mats)
    return { spec, name: t.n, summary: desk ? deskSummary(deskSpec) : medSummary(spec), result }
  })
}

const UNIT_SINGULAR: Record<string, string> = { 'metros lineales': 'metro', piezas: 'pieza' }
export const unitName = (u: string) => UNIT_SINGULAR[u] ?? u

export type MessageExtras = { customer: string; description: string; delivery: string; iva: boolean; ivaRate: number; /** Los demás muebles del proyecto, si se suman al precio. */ project?: ProjectExtra[] }

/** El texto de la cotización para mandar por WhatsApp. */
export function quoteMessage(business: Pick<Business, 'name' | 'currency'>, cfg: QuoterConfig, types: Record<string, JobType>, f: QuoterForm, r: QuoterResult, x: MessageExtras): string {
  const t = jobOf(types, f, cfg) ?? Object.values(types)[0]
  const desk = f.type === DESK_KEY && f.desk ? `medidas ${deskSummary(f.desk)}` : f.type === SIMPLE_KEY && f.simple ? `medidas ${simpleSummary(f.simple)}` : isMeasured(types, f) ? `medidas ${medSummary(f.med!)}` : ''
  const money = (c: number) => formatMoney(c, business.currency)
  const extras = [desk, f.mat ?? '', r.withPaint && !t.pint ? 'acabado pintado' : '', r.withTop ? 'con cubierta' : '', f.suave && (t.b || t.c) ? 'herrajes de cierre suave' : ''].filter(Boolean).join(', ')
  const project = x.project ?? []
  const price = r.priceCents + project.reduce((a, e) => a + e.result.priceCents, 0)
  const total = x.iva ? Math.round(price * (1 + x.ivaRate / 100)) : price
  const advance = Math.round((total * cfg.anticipo) / 100)
  return [
    `Hola${x.customer ? ` ${x.customer}` : ''}, te comparto la cotización de ${business.name}:`,
    '',
    `*${t.n}*: ${f.q} ${f.q === 1 ? unitName(t.u) : t.u}${extras ? ` (${extras})` : ''}${project.length ? ` — ${money(r.priceCents)}` : ''}${x.description ? `\n${x.description}` : ''}`,
    ...project.map((e) => `*${e.name}*: 1 pieza (medidas ${e.summary}) — ${money(e.result.priceCents)}`),
    '',
    x.iva ? `Precio: ${money(price)} + IVA ${x.ivaRate} %\nTotal: *${money(total)}*` : `Precio: *${money(total)}*`,
    'Incluye material, fabricación e instalación.',
    `Anticipo para iniciar: ${money(advance)}, el resto al instalar.`,
    `Entrega aprox.: ${x.delivery.trim() || 'por confirmar'}`,
    `Vigencia de la cotización: ${DEFAULT_VALIDITY_DAYS} días.`,
    '',
    `Cualquier duda aquí estoy. ${business.name}`,
  ].join('\n')
}

export type SaveExtras = MessageExtras & { phone: string; quoteId?: string; /** Grosor y veta elegidos en el despiece. */ cutPrefs?: { grosor: number; girar: boolean; more?: CutSpec[] }; /** Incluir el boceto en la cotización del cliente. */ sketch?: boolean; /** false = los demás muebles del proyecto no se suman al precio. */ sumMore?: boolean }

/** Las medidas para el despiece de lo que se cotiza (solo muebles cotizados por medidas). */
export function cutSpecOf(types: Record<string, JobType>, f: QuoterForm, grosor = 16): CutSpec | undefined {
  if (f.type === DESK_KEY && !types[DESK_KEY] && f.desk) return { kind: 'escritorio', largo: f.desk.largo, alto: f.desk.alto, fondo: f.desk.fondo, cajones: f.desk.cajones, puertas: 0, entrepanos: 0, divisiones: 0, grosor }
  if (isMeasured(types, f)) return { ...f.med!, grosor }
  return undefined
}

const buildCut = (specs: CutSpec[], girar: boolean): NonNullable<QuoterSnapshot['cut']> => ({ spec: specs[0], ...(specs.length > 1 && { more: specs.slice(1) }), girar, pieces: projectPieces(specs) })

/** Pone o quita el boceto en la cotización que recibe el cliente. */
export async function setQuoteSketch(quoteId: string, on: boolean): Promise<void> {
  const q = await db.quote.get(quoteId)
  if (!q?.quoter?.cut) throw new Error('Esa cotización no tiene medidas para dibujar el boceto')
  const { sketch: _old, ...rest } = q.quoter
  await db.quote.update(quoteId, { quoter: { ...rest, ...(on && { sketch: true }) }, updatedAt: new Date().toISOString() })
}

/** Guarda (o cambia) el despiece de una cotización del cotizador. */
export async function saveQuoteCut(quoteId: string, specs: CutSpec | CutSpec[], girar: boolean): Promise<void> {
  const q = await db.quote.get(quoteId)
  if (!q?.quoter) throw new Error('Esa cotización no salió del cotizador rápido')
  await db.quote.update(quoteId, { quoter: { ...q.quoter, cut: buildCut(Array.isArray(specs) ? specs : [specs], girar) }, updatedAt: new Date().toISOString() })
}

/**
 * Guarda el trabajo como una Cotización de Conta (con el cliente: si no existe se crea). Con `quoteId` actualiza esa cotización.
 * La cotización conserva los datos del cotizador para poder abrirla y cambiarla después.
 */
export async function saveQuoterQuote(business: Business, f: QuoterForm, x: SaveExtras): Promise<Quote> {
  const { cfg, types, mats } = quoterSettings(business)
  const t = jobOf(types, f, cfg)
  if (!t) throw new Error('Ese tipo de trabajo ya no existe')
  const name = x.customer.trim()
  if (!name) throw new Error('Escribe el nombre del cliente para guardar la cotización')
  if (!(f.q > 0)) throw new Error('La cantidad debe ser mayor que cero')
  const r = calcQuote(cfg, types, f, mats)
  if (r.priceCents <= 0) throw new Error('El precio es cero: revisa los costos del trabajo')

  const existing = (await listContacts(business.id, 'customer')).find((c) => c.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0)
  const contact = existing ?? (await createContact(business.id, 'customer', { name, phone: x.phone.trim() }))
  const cutSpec = cutSpecOf(types, f, x.cutPrefs?.grosor)
  // Los demás muebles del proyecto se cobran en su propia línea (salvo que se pida no sumarlos).
  const extras = cutSpec && x.sumMore !== false ? projectExtras(cfg, types, f, x.cutPrefs?.more, mats) : []
  const price = r.priceCents + extras.reduce((a, e) => a + e.result.priceCents, 0)
  const taxRate = x.iva ? x.ivaRate : 0
  const total = Math.round(price * (1 + taxRate / 100))
  const snapshot: QuoterSnapshot = { type: f.type, q: f.q, suave: f.suave, pint: f.pint, cub: f.cub, km: f.km, xmat: f.xmat, xhrs: f.xhrs, desc: x.description.trim(), delivery: x.delivery.trim(), iva: x.iva, costCents: r.costCents + extras.reduce((a, e) => a + e.result.costCents, 0), ...(f.mat && { mat: f.mat }), ...(f.base && { base: f.base }), ...(f.serv && { serv: f.serv }), ...(f.parts?.length && { parts: f.parts }), ...(x.sumMore === false && { sumMore: false }), ...(f.type === DESK_KEY && f.desk && { desk: f.desk }), ...(f.type === SIMPLE_KEY && f.simple && { simple: f.simple }), ...(isMeasured(types, f) && { med: f.med }), ...(cutSpec && x.sketch && { sketch: true }), ...(cutSpec && { cut: buildCut([cutSpec, ...(x.cutPrefs?.more ?? [])], x.cutPrefs?.girar ?? true) }) }
  const input = {
    title: extras.length ? `${t.n} y ${extras.length === 1 ? extras[0].name.toLowerCase() : `${extras.length} muebles más`}` : t.n,
    contactId: contact.id,
    validUntil: addDays(dayKey(Date.now(), business.timezone), DEFAULT_VALIDITY_DAYS),
    taxRate,
    advanceCents: Math.round((total * cfg.anticipo) / 100),
    notes: [x.delivery.trim() && `Entrega aprox.: ${x.delivery.trim()}`].filter(Boolean).join('\n'),
    items: [{ name: `${t.n} · ${f.q} ${f.q === 1 ? unitName(t.u) : t.u}${f.type === DESK_KEY && f.desk ? ` · ${deskSummary(f.desk)}` : f.type === SIMPLE_KEY && f.simple ? ` · ${simpleSummary(f.simple)}` : isMeasured(types, f) ? ` · ${medSummary(f.med!)}` : ''}${f.mat ? ` · ${f.mat}` : ''}${x.description.trim() ? ` · ${x.description.trim()}` : ''}`, quantity: 1, unitPriceCents: r.priceCents }, ...extras.map((e) => ({ name: `${e.name} · 1 pieza · ${e.summary}${f.mat ? ` · ${f.mat}` : ''}`, quantity: 1, unitPriceCents: e.result.priceCents }))],
    quoter: snapshot,
  }
  return x.quoteId ? updateQuote(x.quoteId, input) : createQuote(business.id, input)
}
