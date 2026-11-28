// Cotizar desde una foto, de todo: muebles de Bases, tablas de picar, trabajos de Cotizar (closets, cocinas, escritorio…),
// servicios de obra y productos del inventario. Arma la lista que ve el asistente y convierte su respuesta en qué abrir.
import { defaultValues, templateOf, TEMPLATES, type BaseOpts, type BaseState } from './bases'
import { DEFAULT_SPECS, type CutSpec } from './cutlist'
import { BOARD_KEY, BUILTIN_MEASURED, DEFAULT_DESK, DEFAULT_SIMPLE, DESK_KEY, MEASURED_KIND, SIMPLE_KEY, quoterSettings, type BoardSpec, type DeskSpec, type SimpleCloset } from './quoter'
import { isOn, serviceDefaults, SERVICES, type ServState } from './services'
import type { Business, Product } from './types'

type Field = { k: string; label: string; def: number; choices?: [number, string][] }
export type PhotoItem = { key: string; name: string; group?: string; fields: Field[] }
export type PhotoGuess = { key: string; values: Record<string, number> }

export type PhotoIntent =
  | { kind: 'base'; state: BaseState; label: string }
  | { kind: 'board'; board: BoardSpec; q: number; label: string }
  | { kind: 'cotizar'; type: string; q: number; med?: CutSpec; desk?: DeskSpec; simple?: SimpleCloset; label: string }
  | { kind: 'serv'; serv: ServState; label: string }
  | { kind: 'product'; product: Product; q: number; label: string }

const YESNO: [number, string][] = [[0, 'no'], [1, 'sí']]
const safe = (k: string) => k.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30)

export const BOARD_ITEM: PhotoItem = {
  key: BOARD_KEY, name: 'Tabla de picar de madera maciza (también redonda o con mango, de quesos o de servir)', group: 'Madera', fields: [
    { k: 'madera', label: 'Madera', def: 1, choices: [[1, 'pino'], [2, 'parota'], [3, 'cedro']] },
    { k: 'ancho', label: 'Ancho del cuerpo (mm)', def: 250 }, { k: 'largo', label: 'Largo del cuerpo sin mango (mm)', def: 350 },
    { k: 'redonda', label: 'Redonda u ovalada', def: 0, choices: YESNO }, { k: 'mango', label: 'Con mango', def: 0, choices: YESNO },
    { k: 'mangoLargo', label: 'Largo del mango (mm)', def: 120 }, { k: 'piezas', label: 'Cuántas piezas', def: 1 },
  ],
}

/** De lo que regresa el asistente (mm) a la tabla del cotizador (cm). */
export function boardFromGuess(v: Record<string, number>): { board: BoardSpec; q: number } {
  const cm = (mm: number | undefined, def: number) => (mm && mm > 0 ? Math.round(mm) / 10 : def)
  const madera = v.madera === 2 ? 'parota' : v.madera === 3 ? 'cedro' : 'pino'
  const a = cm(v.ancho, 25), l = cm(v.largo, 35)
  return { board: { madera, ancho: Math.min(a, l), largo: Math.max(a, l), redonda: v.redonda === 1, mango: v.mango === 1, mangoLargo: cm(v.mangoLargo, 12) }, q: Math.max(1, Math.round(v.piezas || 1)) }
}

const MED_FIELDS = (s: CutSpec): Field[] => [
  { k: 'largo', label: 'Largo o ancho del frente (cm)', def: s.largo }, { k: 'alto', label: 'Alto (cm)', def: s.alto }, { k: 'fondo', label: 'Fondo (cm)', def: s.fondo },
  { k: 'puertas', label: 'Puertas', def: s.puertas }, { k: 'cajones', label: 'Cajones', def: s.cajones }, { k: 'entrepanos', label: 'Entrepaños o repisas', def: s.entrepanos },
]

/** Todo lo que el negocio cotiza, como lista para el asistente. */
export function photoCatalog(business: Business, products: Product[] = []): PhotoItem[] {
  const { types, serv } = quoterSettings(business)
  const bases: PhotoItem[] = TEMPLATES.filter((t) => t.key !== 'cocina').map((t) => ({ key: t.key, name: `${t.name} (Bases, despiece en mm)`, group: t.group, fields: t.fields.map((f) => ({ k: f.k, label: f.label, def: f.def, ...(f.choices && { choices: f.choices }) })) }))
  const cot: PhotoItem[] = []
  for (const [k, t] of Object.entries(types)) {
    if (k === 'otro' || safe(k) !== k) continue
    const kind = MEASURED_KIND[k]
    cot.push({ key: `cot_${k}`, name: `${t.n} (Cotizar${kind ? ', por medidas' : `, por ${t.u}`})`, group: 'Cotizar', fields: kind ? MED_FIELDS(DEFAULT_SPECS[kind]) : [{ k: 'cantidad', label: `Cantidad en ${t.u}`, def: 1 }] })
  }
  for (const [k, label] of Object.entries(BUILTIN_MEASURED)) if (!(k in types)) cot.push({ key: `cot_${k}`, name: `${label} (Cotizar, por medidas)`, group: 'Cotizar', fields: MED_FIELDS(DEFAULT_SPECS[MEASURED_KIND[k]]) })
  if (!(DESK_KEY in types)) cot.push({ key: `cot_${DESK_KEY}`, name: 'Escritorio a la medida (Cotizar)', group: 'Cotizar', fields: [{ k: 'largo', label: 'Largo (cm)', def: DEFAULT_DESK.largo }, { k: 'fondo', label: 'Fondo (cm)', def: DEFAULT_DESK.fondo }, { k: 'alto', label: 'Alto (cm)', def: DEFAULT_DESK.alto }, { k: 'cajones', label: 'Cajones', def: DEFAULT_DESK.cajones }] })
  if (!(SIMPLE_KEY in types)) cot.push({ key: `cot_${SIMPLE_KEY}`, name: 'Closet sencillo abierto con tubos, sin puertas (Cotizar)', group: 'Cotizar', fields: [{ k: 'ancho', label: 'Ancho (cm)', def: DEFAULT_SIMPLE.ancho }, { k: 'alto', label: 'Alto (cm)', def: DEFAULT_SIMPLE.alto }, { k: 'fondo', label: 'Fondo (cm)', def: DEFAULT_SIMPLE.fondo }, { k: 'tubos', label: 'Tubos', def: DEFAULT_SIMPLE.tubos }, { k: 'repisas', label: 'Repisas', def: DEFAULT_SIMPLE.repisas }] })
  const srv: PhotoItem[] = SERVICES.filter((s) => isOn(s.key, serv)).map((s) => ({ key: `srv_${safe(s.key)}`, name: `${s.name}: ${s.desc} (servicio de obra)`, group: 'Servicios', fields: s.fields.map((f) => ({ k: f.k, label: `${f.label}${f.unit ? ` (${f.unit})` : ''}`, def: f.def, ...(f.choices && { choices: f.choices }) })) }))
  const prods: PhotoItem[] = products.filter((p) => !p.deletedAt).slice(0, 60).map((p) => ({ key: `prod_${p.id.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}`, name: `${p.name}${p.description ? ` — ${p.description.slice(0, 60)}` : ''} (producto del inventario, $${(p.priceCents / 100).toFixed(0)})`, group: 'Productos', fields: [{ k: 'piezas', label: 'Cuántas piezas', def: 1 }] }))
  return [...bases, BOARD_ITEM, ...cot, ...srv, ...prods]
}

/** Qué abrir con la respuesta del asistente. */
export function photoIntent(g: PhotoGuess, business: Business, products: Product[], baseOpts: BaseOpts): PhotoIntent | undefined {
  const v = g.values
  const n = (k: string, def: number) => (Number.isFinite(v[k]) && v[k] > 0 ? v[k] : def)
  if (g.key === BOARD_KEY) {
    const { board, q } = boardFromGuess(v)
    return { kind: 'board', board, q, label: 'Tabla de picar' }
  }
  if (g.key.startsWith('prod_')) {
    const id = g.key.slice(5)
    const product = products.find((p) => p.id.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase() === id)
    return product && { kind: 'product', product, q: Math.max(1, Math.round(n('piezas', 1))), label: product.name }
  }
  if (g.key.startsWith('srv_')) {
    const s = SERVICES.find((x) => `srv_${safe(x.key)}` === g.key)
    return s && { kind: 'serv', serv: { key: s.key, values: { ...serviceDefaults(s), ...v } }, label: s.name }
  }
  if (g.key.startsWith('cot_')) {
    const type = g.key.slice(4)
    const { types } = quoterSettings(business)
    if (type === DESK_KEY && !(type in types)) return { kind: 'cotizar', type, q: 1, desk: { largo: n('largo', DEFAULT_DESK.largo), fondo: n('fondo', DEFAULT_DESK.fondo), alto: n('alto', DEFAULT_DESK.alto), cajones: Math.round(v.cajones ?? DEFAULT_DESK.cajones) }, label: 'Escritorio a la medida' }
    if (type === SIMPLE_KEY && !(type in types)) return { kind: 'cotizar', type, q: 1, simple: { ancho: n('ancho', DEFAULT_SIMPLE.ancho), alto: n('alto', DEFAULT_SIMPLE.alto), fondo: n('fondo', DEFAULT_SIMPLE.fondo), tubos: Math.round(v.tubos ?? DEFAULT_SIMPLE.tubos), repisas: Math.round(v.repisas ?? DEFAULT_SIMPLE.repisas) }, label: 'Closet sencillo abierto' }
    const kind = MEASURED_KIND[type]
    const label = types[type]?.n ?? BUILTIN_MEASURED[type] ?? type
    if (kind) {
      const d = DEFAULT_SPECS[kind]
      return { kind: 'cotizar', type, q: 1, med: { ...d, largo: n('largo', d.largo), alto: n('alto', d.alto), fondo: n('fondo', d.fondo), puertas: Math.round(v.puertas ?? d.puertas), cajones: Math.round(v.cajones ?? d.cajones), entrepanos: Math.round(v.entrepanos ?? d.entrepanos) }, label }
    }
    if (type in types) return { kind: 'cotizar', type, q: n('cantidad', 1), label }
    return undefined
  }
  const t = TEMPLATES.find((x) => x.key === g.key)
  if (!t) return undefined
  const tt = templateOf(t.key)
  return { kind: 'base', state: { key: tt.key, values: { ...defaultValues(tt), ...v }, opts: { ...baseOpts, fondo: tt.fondo, cubierta: false } }, label: tt.name }
}
