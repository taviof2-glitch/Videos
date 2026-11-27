// Bases: muebles con despiece automático en milímetros (piezas con cantos, herrajes, horas, acomodo en hojas y precio).
// Las fórmulas son reglas de taller redactadas con nuestras palabras; las medidas de los modelos son guía y se verifican en obra.
import { counterMeters, DEFAULT_KITCHEN, kitchenTitle, moduleState, modulesOf, type KitchenState } from './kitchen'
import type { QuoterConfig } from './quoter'

/** Canto de cada pieza en 4 letras: largo 1, largo 2, ancho 1, ancho 2. D = delgado, G = grueso (2 mm), - = sin canto. */
export type Edges = string

export type BPiece = {
  n: string
  /** Largo y ancho en mm (el largo siempre es el lado mayor). */
  l: number
  a: number
  q: number
  e: Edges
  /** De MDF de 3 mm (fondos); si no, del tablero. */
  mdf?: boolean
  /** Lleva ranura para el fondo del cajón (4 × 8 mm a 18 mm del borde). */
  ranura?: boolean
}

export type Hardware = {
  /** Bisagras de cazoleta de 35 mm. */
  bis: number
  /** Pares de correderas por largo en mm. */
  corr: Record<number, number>
  jal: number
  /** Patas niveladoras. */
  pata: number
  /** Soportes ocultos, colgadores o canoplas. */
  sop: number
  /** Tubo para colgar, en metros. */
  tubo: number
  /** Riel de puertas corredizas, en metros. */
  riel: number
  /** Pistones para puertas que abren hacia arriba. */
  piston: number
}

export type FondoTipo = 'embutido' | 'sobrepuesto'
export type Estilo = 'A' | 'B'

export type BaseOpts = {
  /** Espesor del tablero en mm. */
  esp: number
  /** Color con veta: las piezas no se giran en la hoja. */
  veta: boolean
  suave: boolean
  /** Lleva cubierta comprada (solo bajos de cocina y barra). */
  cubierta: boolean
  /** Cuántos muebles iguales. */
  iguales: number
  fondo: FondoTipo
  /** Roperos: A = laterales completos, B = techo encima. */
  estilo: Estilo
  /** Tipo de cubierta comprada: postformado, piedra o sólido. */
  cubiertaTipo?: CubiertaTipo
  /** Sin jaladeras: puertas y cajones con push-open. */
  pushOpen?: boolean
  /** Cómo se apoya en el piso: lo normal del mueble, patas de madera de 20 cm o ruedas. */
  apoyo?: Apoyo
}

export type Apoyo = 'normal' | 'madera' | 'ruedas'
export const APOYO_LABEL: Record<Apoyo, string> = { normal: 'Lo normal (niveladoras o deslizadores)', madera: 'Patas de madera de 20 cm', ruedas: 'Ruedas' }

export type CubiertaTipo = 'post' | 'piedra' | 'solido'
export const CUBIERTA_LABEL: Record<CubiertaTipo, string> = { post: 'Postformado', piedra: 'Piedra (cuarzo, granito, mármol)', solido: 'Superficie sólida' }

export type Field = { k: string; label: string; def: number; min?: number; max?: number; choices?: [number, string][] }
export type Built = { pieces: BPiece[]; hw: Hardware; puertas: number; cajones: number; notes: string[] }
export type Preset = { name: string; v: Record<string, number> }

export type Template = {
  key: string
  name: string
  group: string
  fields: Field[]
  /** Se puede marcar «Incluir cubierta». */
  cubierta?: boolean
  /** Muestra el selector de estilo A/B (roperos). */
  estilo?: boolean
  /** Va al piso sin patas: lleva deslizadores. */
  piso?: boolean
  /** Tipo de fondo por defecto. */
  fondo: FondoTipo
  /** Tu precio de venta de referencia ($), para ver si deja ganancia. */
  lista?: number
  tips: string[]
  presets?: Preset[]
  /** Medidas que salen en el título (ancho × alto × fondo). */
  dims: (v: Record<string, number>) => [number, number, number]
  build: (v: Record<string, number>, o: BaseOpts) => Built
}

export const GROUPS = ['Cocinas', 'Closets y roperos', 'Recámaras y burós', 'Repisas y libreros', 'Escritorios', 'Muebles de TV', 'Barras e islas', 'Mostradores', 'Mesas, sillas y bancos', 'Infantiles', 'Puertas', 'Personalizados'] as const

// ——— Reglas generales ———

const fl = Math.floor
const rd = Math.round
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const int = (x: number) => Math.max(0, Math.round(x || 0))

const noHw = (): Hardware => ({ bis: 0, corr: {}, jal: 0, pata: 0, sop: 0, tubo: 0, riel: 0, piston: 0 })

/** Ancho de cada puerta de cubrir: 3 mm de luz por fuera y 10 mm entre puertas. */
export const doorWidth = (W: number, n: number) => fl((W - 6 - 10 * (Math.max(1, n) - 1)) / Math.max(1, n))

/** Bisagras por puerta según su alto. */
export const hingesFor = (alto: number) => (alto <= 900 ? 2 : alto <= 1500 ? 3 : alto <= 2000 ? 4 : 5)

/** Largos comerciales de corredera. */
export const SLIDES = [250, 300, 350, 400, 450, 500, 550, 600]

/**
 * Corredera y lateral de cajón para un hueco de fondo libre `dint`: la corredera más larga que quepa dejando `holg` mm atrás,
 * y el lateral = mín(corredera + 30, fondo libre − holgura).
 */
export function slideFor(dint: number, holg = 20): { lc: number; lateral: number } {
  const room = dint - holg
  const lc = [...SLIDES].reverse().find((s) => s <= room) ?? SLIDES[0]
  return { lc, lateral: Math.min(lc + 30, room) }
}

/** Cajones de melamina: laterales, frente y contrafrente entre laterales, tapa con canto grueso y fondo de MDF. */
export function drawers(nc: number, o: { wh: number; dint: number; tapaW: number; tapaH: number; e: number; holg?: number; hw: Hardware; out: BPiece[] }) {
  if (nc <= 0) return
  const { lc, lateral } = slideFor(o.dint, o.holg)
  const hb = clamp(o.tapaH - 40, 80, 250)
  o.out.push(
    { n: 'Lateral de cajón', l: lateral, a: hb, q: 2 * nc, e: 'D---', ranura: true },
    { n: 'Frente y contrafrente de cajón', l: o.wh - 26 - 2 * o.e, a: hb, q: 2 * nc, e: 'D---', ranura: true },
    { n: 'Tapa de cajón', l: o.tapaW, a: o.tapaH, q: nc, e: 'GGGG' },
    { n: 'Fondo de cajón', l: lateral - 22, a: o.wh - 48, q: nc, e: '----', mdf: true },
  )
  o.hw.corr[lc] = (o.hw.corr[lc] ?? 0) + nc
  o.hw.jal += nc
}

/** Hoja de MDF de 3 mm para fondos. */
export const MDF_SHEET = { l: 2440, a: 1220 }

/** Fondo de MDF: embutido en ranura `(alto − 22) × (ancho − 22)` o sobrepuesto por detrás `alto × ancho`. Si no cabe en la hoja, va en 2. */
function backPanel(out: BPiece[], alto: number, ancho: number, tipo: FondoTipo, name = 'Fondo') {
  const h = tipo === 'embutido' ? alto - 22 : alto
  const w = tipo === 'embutido' ? ancho - 22 : ancho
  const big = Math.max(h, w)
  const small = Math.min(h, w)
  if (big <= MDF_SHEET.l && small <= MDF_SHEET.a) out.push({ n: name, l: h, a: w, q: 1, e: '----', mdf: true })
  else if (h >= w) out.push({ n: `${name} (en 2 partes)`, l: rd(h / 2), a: w, q: 2, e: '----', mdf: true })
  else out.push({ n: `${name} (en 2 partes)`, l: h, a: rd(w / 2), q: 2, e: '----', mdf: true })
}

const doors = (out: BPiece[], hw: Hardware, n: number, alto: number, ancho: number, name = 'Puerta') => {
  if (n <= 0) return 0
  out.push({ n: name, l: alto, a: ancho, q: n, e: 'GGGG' })
  hw.bis += n * hingesFor(alto)
  hw.jal += n
  return n
}

/** Dos hojas corredizas (sistema de riel arriba y abajo) para un frente de ancho W y alto H. */
const slidingDoors = (out: BPiece[], hw: Hardware, W: number, H: number) => {
  out.push({ n: 'Hoja corrediza', l: H - 178, a: fl(W / 2 - 8), q: 2, e: 'GGGG' })
  hw.riel += W / 1000
  hw.jal += 2
  return 2
}

// ——— Muebles ———

const f = (k: string, label: string, def: number, min = 0, max?: number): Field => ({ k, label, def, min, ...(max !== undefined && { max }) })
const WHD = (v: Record<string, number>): [number, number, number] => [v.ancho, v.alto, v.fondo]

/** Bajo de cocina (caja de 780 sin zoclo; el zoclo va aparte y la cubierta encima). */
function kitchenBase(v: Record<string, number>, o: BaseOpts, opt: { repisas: boolean; fondo: boolean }): Built {
  const e = o.esp
  const { ancho: W, alto: H, fondo: D } = v
  const Wi = W - 2 * e
  const out: BPiece[] = []
  const hw = noHw()
  out.push({ n: 'Lateral', l: H, a: D, q: 2, e: 'D---' }, { n: 'Base', l: Wi, a: D, q: 1, e: 'D---' }, { n: 'Amarre', l: Wi, a: 100, q: 2, e: 'D---' })
  const r = opt.repisas ? int(v.repisas) : 0
  if (r) out.push({ n: 'Repisa', l: Wi, a: D - 22, q: r, e: 'D---' })
  const n = int(v.puertas)
  const puertas = doors(out, hw, n, H - 4, doorWidth(W, n))
  out.push({ n: 'Zoclo', l: W, a: 100, q: 1, e: 'D---' })
  if (opt.fondo) backPanel(out, H, W, o.fondo)
  hw.pata += 4
  return { pieces: out, hw, puertas, cajones: 0, notes: [] }
}

export const TEMPLATES: Template[] = [
  {
    key: 'cocina', name: 'Cocina completa (asistente)', group: 'Cocinas', fondo: 'embutido', cubierta: true, fields: [],
    tips: ['Fregadero y estufa van completos dentro de un módulo, nunca entre dos.', 'Lo que sobra de cada pared se tapa con un panel de ajuste de 5 a 10 cm.'],
    dims: () => [0, 0, 0],
    build: () => ({ pieces: [], hw: noHw(), puertas: 0, cajones: 0, notes: [] }),
  },
  {
    key: 'coc_bajo', name: 'Cocina – bajo con puertas', group: 'Cocinas', fondo: 'embutido', cubierta: true,
    fields: [f('ancho', 'Ancho', 900, 200, 1200), f('alto', 'Alto de la caja (sin zoclo)', 780, 300), f('fondo', 'Fondo', 550, 200), f('puertas', 'Puertas', 2, 0, 4), f('repisas', 'Repisas', 1, 0, 4)],
    tips: ['Terminado mide 90 cm: caja de 78, zoclo de 10 y cubierta.', 'El zoclo va metido mínimo 7.5 cm detrás de la puerta y mejor de material resistente a la humedad.'],
    presets: [{ name: 'Botellero de 15 cm (sin puerta)', v: { ancho: 150, puertas: 0, repisas: 3 } }, { name: 'Bajo de 45', v: { ancho: 450, puertas: 1 } }, { name: 'Bajo de 60', v: { ancho: 600, puertas: 2 } }, { name: 'Bajo de 90', v: { ancho: 900, puertas: 2 } }, { name: 'Bajo de 100', v: { ancho: 1000, puertas: 2 } }],
    dims: WHD,
    build: (v, o) => kitchenBase(v, o, { repisas: true, fondo: true }),
  },
  {
    key: 'coc_caj', name: 'Cocina – cajonera baja', group: 'Cocinas', fondo: 'embutido', cubierta: true,
    fields: [f('ancho', 'Ancho', 500, 300, 1000), f('alto', 'Alto de la caja (sin zoclo)', 780, 300), f('fondo', 'Fondo', 550, 300), f('cajones', 'Cajones', 3, 1, 6)],
    tips: ['Deja mínimo 16 mm libres arriba de cada cajón.', 'Entre tapas van 3 mm; la corredera sale del fondo libre (holgura atrás en Mis costos).'],
    presets: [{ name: 'Cajonero de 2 cajones grandes', v: { ancho: 600, cajones: 2 } }, { name: 'Cajonero de 3 cajones', v: { ancho: 600, cajones: 3 } }, { name: 'Cajonero de 4 cajones', v: { ancho: 600, cajones: 4 } }, { name: 'Condimentero de 15 cm', v: { ancho: 150, cajones: 1 } }],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = [{ n: 'Lateral', l: H, a: D, q: 2, e: 'D---' }, { n: 'Base', l: Wi, a: D, q: 1, e: 'D---' }, { n: 'Amarre', l: Wi, a: 100, q: 2, e: 'D---' }, { n: 'Zoclo', l: W, a: 100, q: 1, e: 'D---' }]
      const hw = noHw()
      const n = Math.max(1, int(v.cajones))
      drawers(n, { wh: Wi, dint: D - (o.fondo === 'embutido' ? 22 : 0), tapaW: W - 6, tapaH: fl((H - 4 - 3 * (n - 1)) / n), e, holg: v.__holg, hw, out })
      backPanel(out, H, W, o.fondo)
      hw.pata += 4
      return { pieces: out, hw, puertas: 0, cajones: n, notes: [] }
    },
  },
  {
    key: 'coc_fregadero', name: 'Cocina – bajo fregadero', group: 'Cocinas', fondo: 'embutido', cubierta: true,
    fields: [f('ancho', 'Ancho', 900, 400, 1200), f('alto', 'Alto de la caja (sin zoclo)', 780, 300), f('fondo', 'Fondo', 550, 300), f('puertas', 'Puertas', 2, 0, 3)],
    tips: ['Sin repisa ni fondo trasero para que pase la tubería.', 'La tarja va completa dentro del módulo, nunca entre dos.'],
    dims: WHD,
    build: (v, o) => kitchenBase(v, o, { repisas: false, fondo: false }),
  },
  {
    key: 'alacena', name: 'Cocina – alacena', group: 'Cocinas', fondo: 'embutido',
    fields: [f('ancho', 'Ancho', 900, 200, 1200), f('alto', 'Alto', 700, 300, 1000), f('fondo', 'Fondo', 300, 200, 400), f('puertas', 'Puertas', 2, 0, 4), f('repisas', 'Repisas', 1, 0, 4)],
    tips: ['Va a 1.40–1.50 m del piso; entre menos fondo tenga el bajo, más alta la alacena.', 'Deja mínimo 30 cm de limpieza entre la cubierta y la alacena.'],
    presets: [{ name: 'Mueble de campana 600 × 400', v: { ancho: 600, alto: 400, fondo: 300, puertas: 2, repisas: 0 } }, { name: 'Mueble de campana 900 × 400', v: { ancho: 900, alto: 400, fondo: 300, puertas: 2, repisas: 0 } }, { name: 'Alacena 600 × 800', v: { ancho: 600, alto: 800, fondo: 300, puertas: 2, repisas: 2 } }, { name: 'Alacena 900 × 900', v: { ancho: 900, alto: 900, fondo: 300, puertas: 2, repisas: 2 } }],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = [{ n: 'Lateral', l: H, a: D, q: 2, e: 'D-DD' }, { n: 'Base y techo', l: Wi, a: D, q: 2, e: 'D---' }]
      const r = int(v.repisas)
      if (r) out.push({ n: 'Repisa', l: Wi, a: D - 22, q: r, e: 'D---' })
      out.push({ n: 'Amarre para colgar', l: Wi, a: 100, q: 1, e: '----' })
      const hw = noHw()
      const n = int(v.puertas)
      const puertas = doors(out, hw, n, H - 6, doorWidth(W, n))
      backPanel(out, H, W, o.fondo)
      hw.sop += 2
      return { pieces: out, hw, puertas, cajones: 0, notes: [] }
    },
  },
  {
    key: 'esquinero_L', name: 'Cocina – esquinero en L (bajo)', group: 'Cocinas', fondo: 'embutido', cubierta: true,
    fields: [f('ladoA', 'Lado A', 900, 600, 1200), f('ladoB', 'Lado B', 900, 600, 1200), f('alto', 'Alto de la caja (sin zoclo)', 780, 300), f('fondo', 'Fondo', 550, 300)],
    tips: ['Deja el esquinero 20 cm separado del muro para absorber errores de obra; lo tapa la cubierta.', 'La caja ciega entra a la esquina; la de puerta da el acceso y el panel de 10 cm evita que choquen las puertas.'],
    dims: (v) => [v.ladoA, v.alto, v.fondo],
    build: (v, o) => {
      const a = kitchenBase({ ancho: v.ladoA, alto: v.alto, fondo: v.fondo, puertas: 0, repisas: 1 }, o, { repisas: true, fondo: true })
      const b = kitchenBase({ ancho: Math.max(300, v.ladoB - v.fondo - 100), alto: v.alto, fondo: v.fondo, puertas: 1, repisas: 1 }, o, { repisas: true, fondo: true })
      const pieces = [...a.pieces.map((p) => ({ ...p, n: `${p.n} (caja ciega)` })), ...b.pieces.map((p) => ({ ...p, n: `${p.n} (caja con puerta)` })), { n: 'Panel de ajuste', l: v.alto - 4, a: 100, q: 1, e: 'GG--' }]
      const hw = sumHw(a.hw, b.hw)
      return { pieces, hw, puertas: b.puertas, cajones: 0, notes: [] }
    },
  },
  {
    key: 'closet', name: 'Closet por torres (60 × 60)', group: 'Closets y roperos', fondo: 'embutido',
    fields: [
      f('torres', 'Torres', 2, 1, 8), f('alto', 'Alto', 2200, 1500, 2700), f('cajones', 'Cajones por torre', 0, 0, 6), f('puertas', 'Puertas abatibles por torre (0 = sin puertas)', 2, 0, 2),
      { k: 'corrediza', label: 'Puertas corredizas para todo el frente', def: 0, choices: [[0, 'No'], [1, 'Sí']] }, { k: 'maletero', label: 'Maletero', def: 1, choices: [[1, 'Sí'], [0, 'No']] }, f('tubos', 'Tubos por torre', 1, 0, 2),
    ],
    tips: ['Cada torre mide 60 de ancho y 60 de fondo; el espacio que sobra al lado queda libre para colgar.', 'Con corredizas se descuentan 178 mm de alto por los rieles.'],
    dims: (v) => [int(v.torres) * TOWER, v.alto, TOWER],
    build: (v, o) => {
      const e = o.esp
      const W = TOWER
      const D = TOWER
      const H = v.alto
      const Wi = W - 2 * e
      const t = Math.max(1, int(v.torres))
      const tower: BPiece[] = [
        { n: 'Lateral', l: H, a: D, q: 2, e: 'D---' }, { n: 'Base y techo', l: Wi, a: D, q: 2, e: 'D---' }, { n: 'Zoclo y amarres', l: Wi, a: 100, q: 3, e: 'D---' },
      ]
      const hw = noHw()
      if (v.maletero) tower.push({ n: 'Maletero', l: Wi, a: D - 22, q: 1, e: 'D---' })
      const nc = int(v.cajones)
      if (nc) {
        drawers(nc, { wh: Wi, dint: D - 22, tapaW: Wi - 4, tapaH: 200, e, holg: v.__holg, hw, out: tower })
        tower.push({ n: 'Repisa sobre cajones', l: Wi, a: D - 22, q: 1, e: 'D---' })
      }
      backPanel(tower, H - 100, W, o.fondo)
      const tubos = int(v.tubos)
      hw.tubo += (tubos * Wi) / 1000
      hw.sop += tubos * 2
      let puertas = 0
      if (!v.corrediza) puertas = doors(tower, hw, int(v.puertas), H - 106, doorWidth(W, int(v.puertas)))
      // Una torre por pieza: todo se multiplica por el número de torres.
      const pieces = tower.map((p) => ({ ...p, q: p.q * t }))
      const all = scaleHw(hw, t)
      puertas *= t
      if (v.corrediza) puertas += slidingDoors(pieces, all, t * W, H)
      all.pata += 4 * t
      return { pieces, hw: all, puertas, cajones: nc * t, notes: [] }
    },
  },
  {
    key: 'closet_sencillo', name: 'Closet sencillo abierto (con tubos)', group: 'Closets y roperos', fondo: 'sobrepuesto', piso: true,
    fields: [f('ancho', 'Ancho', 900, 500, 1500), f('alto', 'Alto', 2100, 1500, 2400), f('fondo', 'Fondo', 500, 350, 650), f('tubos', 'Tubos para colgar', 2, 0, 3), f('repisas', 'Repisas', 0, 0, 6), f('puertas', 'Puertas (0 = abierto)', 0, 0, 2), f('zoclo', 'Zoclo', 50, 0, 120)],
    tips: ['Con 2 tubos: el de arriba a unos 1.95 m para blusas y camisas y el de abajo a 1 m para pantalones; abajo cabe el calzado.', 'Arriba del techo queda espacio para canastas.'],
    presets: [{ name: '2100 × 900 × 500 · 2 tubos', v: { alto: 2100, ancho: 900, fondo: 500, tubos: 2, repisas: 0 } }, { name: '2100 × 1200 × 500 · 2 tubos', v: { alto: 2100, ancho: 1200, fondo: 500, tubos: 2, repisas: 0 } }, { name: '1800 × 800 × 450 · 1 tubo y repisa', v: { alto: 1800, ancho: 800, fondo: 450, tubos: 1, repisas: 1 } }],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const z = int(v.zoclo)
      const out: BPiece[] = [{ n: 'Lateral', l: H, a: D, q: 2, e: 'D---' }, { n: 'Techo y base', l: Wi, a: D, q: 2, e: 'D---' }]
      if (z) out.push({ n: 'Zoclo', l: Wi, a: z, q: 1, e: 'D---' })
      const r = int(v.repisas)
      if (r) out.push({ n: 'Repisa', l: Wi, a: D - 20, q: r, e: 'D---' })
      const hw = noHw()
      const t = int(v.tubos)
      hw.tubo += (t * Wi) / 1000
      hw.sop += 2 * t
      const n = int(v.puertas)
      const puertas = doors(out, hw, n, H - z - 3, doorWidth(W, n))
      backPanel(out, H - z, W, o.fondo)
      return { pieces: out, hw, puertas, cajones: 0, notes: [] }
    },
  },
  {
    key: 'ropero', name: 'Ropero', group: 'Closets y roperos', fondo: 'sobrepuesto', estilo: true, piso: true,
    fields: [
      f('ancho', 'Ancho', 1200, 500, 2400), f('alto', 'Alto', 1800, 1200, 2400), f('fondo', 'Fondo', 500, 350, 650), f('secciones', 'Secciones', 2, 1, 4), f('puertas', 'Puertas abatibles', 2, 0, 8),
      { k: 'corrediza', label: 'Puertas corredizas', def: 0, choices: [[0, 'No'], [1, 'Sí']] }, f('cajones', 'Cajones (en la sección 1)', 2, 0, 8), f('zoclo', 'Zoclo', 80, 0, 150), f('tapeta', 'Tapeta arriba (0 = sin)', 0, 0, 100), f('tubos', 'Secciones con tubo', 1, 0, 4),
    ],
    tips: ['Estilo A: laterales completos y techo entre laterales. Estilo B: techo encima con canto al frente y costados.', 'Las puertas de cubrir dobles son aproximadas: verifica en obra antes de cortar.'],
    presets: [
      ['R1', 1800, 1080, 450, 1, 0, 0], ['R2', 1800, 1200, 500, 4, 2, 0], ['R3', 1900, 1500, 500, 2, 2, 0], ['R4', 1900, 2200, 500, 6, 6, 0], ['R5', 2100, 1900, 500, 7, 3, 0],
      ['R6', 1800, 1800, 500, 6, 4, 0], ['R7', 1750, 1400, 500, 6, 2, 0], ['R8', 1850, 1400, 500, 4, 2, 0], ['R9', 2300, 1700, 600, 0, 8, 1], ['R10', 2100, 2100, 600, 0, 6, 1],
      ['R11', 1800, 1300, 500, 2, 6, 0], ['R12', 2300, 2000, 550, 4, 8, 0], ['R13', 1900, 2000, 500, 4, 6, 0], ['R14', 2200, 2300, 500, 5, 2, 0], ['R15', 2200, 700, 450, 3, 3, 0], ['R16', 1800, 700, 450, 2, 2, 0], ['Armario placard', 2100, 1200, 550, 2, 0, 0],
    ].map(([name, alto, ancho, fondo, puertas, cajones, corrediza]) => ({
      name: `${name} · ${alto}×${ancho}×${fondo}`,
      v: { alto: +alto, ancho: +ancho, fondo: +fondo, puertas: +puertas, cajones: +cajones, corrediza: +corrediza, secciones: +ancho >= 1500 ? 3 : +ancho >= 900 ? 2 : 1 },
    })),
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const z = int(v.zoclo)
      const tp = int(v.tapeta)
      const Wi = W - 2 * e
      const out: BPiece[] = []
      const hw = noHw()
      if (o.estilo === 'A') out.push({ n: 'Lateral', l: H, a: D, q: 2, e: 'D---' }, { n: 'Techo y base', l: Wi, a: D, q: 2, e: 'D---' })
      else out.push({ n: 'Techo', l: W, a: D, q: 1, e: 'D-DD' }, { n: 'Lateral', l: H - e, a: D, q: 2, e: 'D---' }, { n: 'Base', l: Wi, a: D, q: 1, e: 'D---' })
      if (z) out.push({ n: 'Zoclo (frente y atrás)', l: Wi, a: z, q: 2, e: 'D---' })
      if (tp) out.push({ n: 'Tapeta', l: Wi, a: tp, q: 1, e: 'D---' })
      const s = Math.max(1, int(v.secciones))
      if (s > 1) out.push({ n: 'División vertical', l: H - 2 * e - z, a: D, q: s - 1, e: 'D---' })
      const Ws = rd((Wi - (s - 1) * e) / s)
      const nc = int(v.cajones)
      const dint = D - (o.fondo === 'embutido' ? 22 : 0)
      if (nc) {
        drawers(nc, { wh: Ws, dint, tapaW: Ws - 4, tapaH: 200, e, holg: v.__holg, hw, out })
        out.push({ n: 'Repisa sobre cajones', l: Ws, a: dint, q: 1, e: 'D---' })
      }
      const tubos = Math.min(s, int(v.tubos))
      hw.tubo += (tubos * Ws) / 1000
      hw.sop += tubos * 2
      let puertas = 0
      if (v.corrediza) puertas = slidingDoors(out, hw, W, H)
      else {
        const n = int(v.puertas)
        puertas = doors(out, hw, n, H - z - 3, doorWidth(W, n))
      }
      backPanel(out, H - z - tp, W, o.fondo)
      hw.pata += 4
      return { pieces: out, hw, puertas, cajones: nc, notes: ['Puertas de cubrir: verifica en obra.'] }
    },
  },
  {
    key: 'buro', name: 'Buró / mesa de noche', group: 'Recámaras y burós', fondo: 'sobrepuesto', piso: true,
    fields: [f('ancho', 'Ancho', 450, 300, 800), f('alto', 'Alto', 500, 300, 900), f('fondo', 'Fondo', 400, 250, 600), f('cajones', 'Cajones', 2, 1, 4)],
    tips: ['El techo vuela 20 mm al frente y lleva canto grueso en los 4 lados.', 'Altura cómoda: a ras del colchón o 5 cm arriba.'],
    presets: [[585, 400, 420, 1], [600, 400, 400, 2], [600, 400, 350, 2], [500, 500, 380, 2], [600, 500, 380, 2]].map(([alto, ancho, fondo, cajones]) => ({ name: `${alto}×${ancho}×${fondo} · ${cajones} cajón${cajones === 1 ? '' : 'es'}`, v: { alto, ancho, fondo, cajones } })),
    dims: WHD,
    build: (v, o) => dresser({ ...v, columnas: 1, porColumna: v.cajones }, o, 50),
  },
  {
    key: 'comoda', name: 'Cómoda', group: 'Recámaras y burós', fondo: 'sobrepuesto', piso: true,
    fields: [f('ancho', 'Ancho', 1200, 500, 2000), f('alto', 'Alto', 800, 500, 1300), f('fondo', 'Fondo', 500, 350, 600), f('porColumna', 'Cajones por columna', 4, 1, 8), f('columnas', 'Columnas de cajones', 2, 1, 3), f('puertas', 'Puertas (en una sección aparte)', 0, 0, 2)],
    tips: ['Techo con 20 mm de vuelo al frente y canto grueso en los 4 lados; zoclo de 80.', 'Con fondo de 450 la corredera es de 40 y el lateral de 430.'],
    presets: [[800, 1200, 450, 4, 2, 0], [918, 600, 450, 4, 1, 0], [900, 900, 450, 4, 1, 0], [900, 1000, 500, 3, 2, 0], [818, 1100, 450, 3, 1, 2], [1018, 1200, 450, 4, 1, 2], [1100, 1100, 450, 3, 2, 2], [1050, 1300, 500, 3, 1, 0]].map(([alto, ancho, fondo, porColumna, columnas, puertas]) => ({ name: `${alto}×${ancho}×${fondo} · ${porColumna * columnas} cajones${puertas ? ` + ${puertas} puertas` : ''}`, v: { alto, ancho, fondo, porColumna, columnas, puertas } })),
    dims: WHD,
    build: (v, o) => dresser(v, o, 80),
  },
  {
    key: 'cama', name: 'Base de cama', group: 'Recámaras y burós', fondo: 'sobrepuesto', piso: true,
    fields: [{ k: 'colchon', label: 'Colchón', def: 3, choices: [[1, 'Individual 90 × 190'], [2, 'Matrimonial 135 × 190'], [3, 'Queen 150 × 200'], [4, 'King 190 × 200']] }],
    tips: ['El interior mide lo del colchón más 20 mm para que entre sin forzar.', 'La placa de apoyo va en 2 piezas porque no cabe en una hoja.'],
    dims: (v) => { const m = MATTRESS[int(v.colchon)] ?? MATTRESS[3]; return [m.a + 172, 900, m.l + 118] },
    build: (v) => {
      const m = MATTRESS[int(v.colchon)] ?? MATTRESS[3]
      const L = m.l
      const A = m.a
      const div = Math.max(2, Math.ceil(L / 400))
      const out: BPiece[] = [
        { n: 'Lateral', l: L, a: 300, q: 2, e: 'D---' }, { n: 'División central', l: A - 100, a: 300, q: div, e: '----' },
        { n: 'Placa de cama (en 2 partes)', l: L + 100, a: rd((A + 136) / 2), q: 2, e: '----' }, { n: 'Lateral flotante', l: L + 118, a: 300, q: 2, e: 'D-DD' },
        { n: 'Frente', l: A + 136, a: 300, q: 1, e: 'D-DD' }, { n: 'Cabecera', l: A + 172, a: 900, q: 1, e: 'GGGG' }, { n: 'Parante de cabecera', l: 900, a: 300, q: 2, e: 'D---' },
      ]
      return { pieces: out, hw: { ...noHw(), sop: 20 }, puertas: 0, cajones: 0, notes: [] }
    },
  },
  {
    key: 'librero', name: 'Librero / estante', group: 'Repisas y libreros', fondo: 'embutido', piso: true,
    fields: [f('ancho', 'Ancho', 800, 300, 1500), f('alto', 'Alto', 1800, 500, 2400), f('fondo', 'Fondo', 300, 200, 450), f('repisas', 'Repisas', 4, 0, 10), f('puertas', 'Puertas abajo (0 = sin)', 0, 0, 4), f('cajones', 'Cajones abajo', 0, 0, 4)],
    tips: ['Repisas de más de 80 cm se pandean con libros: pon una división o usa tablero de 18.', 'Las repisas van 22 mm menos de fondo para librar el fondo.'],
    presets: [[1708, 750, 300, 4, 0, 0], [1800, 1450, 300, 4, 0, 0], [1840, 800, 300, 4, 0, 2], [1800, 750, 300, 3, 2, 0], [1370, 970, 300, 2, 0, 2], [1780, 1500, 282, 4, 0, 0], [1690, 400, 200, 4, 0, 0], [2260, 800, 300, 4, 2, 2]].map(([alto, ancho, fondo, repisas, puertas, cajones]) => ({ name: `${alto}×${ancho}×${fondo}${puertas ? ` · ${puertas} puertas` : ''}${cajones ? ` · ${cajones} cajones` : ''}`, v: { alto, ancho, fondo, repisas, puertas, cajones } })),
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = [{ n: 'Lateral', l: H, a: D, q: 2, e: 'D---' }, { n: 'Base y techo', l: Wi, a: D, q: 2, e: 'D---' }]
      const r = int(v.repisas)
      if (r) out.push({ n: 'Repisa', l: Wi, a: D - 22, q: r, e: 'D---' })
      out.push({ n: 'Zoclo', l: Wi, a: 100, q: 1, e: 'D---' })
      const hw = noHw()
      const nc = int(v.cajones)
      if (nc) drawers(nc, { wh: Wi, dint: D - (o.fondo === 'embutido' ? 22 : 0), tapaW: W - 6, tapaH: 180, e, holg: v.__holg, hw, out })
      const n = int(v.puertas)
      const puertas = doors(out, hw, n, 700, doorWidth(W, n))
      backPanel(out, H, W, o.fondo)
      return { pieces: out, hw, puertas, cajones: nc, notes: [] }
    },
  },
  {
    key: 'multiusos8', name: 'Multiusos 8 espacios', group: 'Repisas y libreros', fondo: 'embutido', lista: 1499, piso: true,
    fields: [f('ancho', 'Ancho', 600, 400, 1000), f('alto', 'Alto', 1800, 800, 2200), f('fondo', 'Fondo', 250, 200, 400), f('niveles', 'Niveles (2 columnas)', 4, 2, 8)],
    tips: ['Es tu producto gancho: revisa abajo si a ese precio te deja ganancia.'],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const niv = Math.max(2, int(v.niveles))
      const out: BPiece[] = [
        { n: 'Lateral', l: H, a: D, q: 2, e: 'D---' }, { n: 'Base y techo', l: Wi, a: D, q: 2, e: 'D---' }, { n: 'Vertical central', l: H - 2 * e, a: D, q: 1, e: 'D---' },
        { n: 'Repisa', l: rd((Wi - e) / 2), a: D, q: (niv - 1) * 2, e: 'D---' },
      ]
      backPanel(out, H, W, o.fondo)
      return { pieces: out, hw: noHw(), puertas: 0, cajones: 0, notes: [] }
    },
  },
  {
    key: 'repisa', name: 'Repisa flotante', group: 'Repisas y libreros', fondo: 'sobrepuesto',
    fields: [f('ancho', 'Largo', 800, 200, 2400), f('fondo', 'Fondo', 250, 100, 400), f('cantidad', 'Cantidad', 1, 1, 20)],
    tips: ['Cada repisa lleva 2 soportes ocultos (o 2 tornillos 6×70 con taquete de 10).'],
    dims: (v) => [v.ancho, 0, v.fondo],
    build: (v, o) => {
      const c = Math.max(1, int(v.cantidad))
      return { pieces: [{ n: 'Repisa', l: v.ancho, a: v.fondo, q: c, e: 'DDDD' }], hw: { ...noHw(), sop: 2 * c }, puertas: 0, cajones: 0, notes: [`Tablero de ${o.esp} mm.`] }
    },
  },
  {
    key: 'escritorio', name: 'Escritorio', group: 'Escritorios', fondo: 'sobrepuesto',
    fields: [f('ancho', 'Ancho', 1200, 600, 2400), f('alto', 'Alto total', 780, 600, 900), f('fondo', 'Fondo', 450, 350, 800), f('cajones', 'Cajones (cajonera de 40 cm)', 0, 0, 4), { k: 'doble', label: 'Tablero doble (2 tableros pegados)', def: 0, choices: [[0, 'No'], [1, 'Sí']] }],
    tips: ['Altura total de 780: laterales de alto − espesor y tablero encima con canto grueso.', 'El faldón de 15 cm atrás le quita el bamboleo.'],
    presets: [[1250, 450], [1350, 400], [1200, 450], [1000, 450], [1500, 600], [2004, 420]].map(([ancho, fondo]) => ({ name: `Tablero ${ancho}×${fondo}`, v: { ancho, fondo } })),
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const top = v.doble ? 2 : 1
      const out: BPiece[] = [
        { n: top === 2 ? 'Tablero (2 pegados)' : 'Tablero', l: W, a: D, q: top, e: 'GGGG' }, { n: 'Pata lateral', l: H - e * top, a: D - 20, q: 2, e: 'D-D-' },
        { n: 'Faldón', l: Wi, a: 150, q: 1, e: 'D---' }, { n: 'Amarre', l: Wi, a: 100, q: 1, e: '----' },
      ]
      const hw = noHw()
      const nc = int(v.cajones)
      if (nc) {
        out.push({ n: 'División de cajonera', l: H - e * top, a: D - 20, q: 1, e: 'D---' })
        drawers(nc, { wh: 400, dint: D - 20, tapaW: 396, tapaH: clamp(fl((H - e * top - 150 - 3 * (nc - 1)) / nc), 100, 250), e, holg: v.__holg, hw, out })
      }
      hw.pata += 4
      return { pieces: out, hw, puertas: 0, cajones: nc, notes: [] }
    },
  },
  {
    key: 'tv', name: 'Mueble de TV flotante', group: 'Muebles de TV', fondo: 'embutido', lista: 1999,
    fields: [f('ancho', 'Ancho', 1500, 600, 2400), f('alto', 'Alto', 350, 200, 600), f('fondo', 'Fondo', 400, 250, 500), f('puertas', 'Puertas', 2, 0, 4), f('divisiones', 'Divisiones', 1, 0, 4)],
    tips: ['Va atornillado al muro con 3 soportes ocultos y taquetes.', 'Compara con tu modelo más vendido (~$1,999) y el básico ($999).'],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = [{ n: 'Base y techo', l: W, a: D, q: 2, e: 'D-DD' }, { n: 'Lateral', l: H - 2 * e, a: D, q: 2, e: 'D---' }]
      const d = int(v.divisiones)
      if (d) out.push({ n: 'División', l: H - 2 * e, a: D - 22, q: d, e: 'D---' })
      const hw = noHw()
      const n = int(v.puertas)
      const puertas = n ? doors(out, hw, n, H - 2 * e - 4, fl((Wi - 4 - 3 * (n - 1)) / n)) : 0
      backPanel(out, H, W, o.fondo)
      hw.sop += 3
      return { pieces: out, hw, puertas, cajones: 0, notes: [] }
    },
  },
  {
    key: 'barra', name: 'Barra / desayunador', group: 'Barras e islas', fondo: 'sobrepuesto', cubierta: true,
    fields: [f('ancho', 'Ancho', 1200, 600, 3000), f('alto', 'Alto', 1050, 750, 1200), f('fondo', 'Fondo', 450, 300, 800), f('repisas', 'Repisas', 1, 0, 3)],
    tips: ['Con «Incluir cubierta» se cobra la cubierta comprada en lugar de la de melamina.', 'Tus barras arrancan en $1,800: compáralo con el precio sugerido.'],
    lista: 1800,
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = []
      if (!o.cubierta) out.push({ n: 'Cubierta', l: W, a: D, q: 1, e: 'GGGG' })
      out.push({ n: 'Frente', l: W, a: H - e, q: 1, e: 'D-DD' }, { n: 'Lateral', l: H - e, a: D - e, q: 2, e: 'D---' })
      const r = int(v.repisas)
      if (r) out.push({ n: 'Repisa', l: Wi, a: D - e - 22, q: r, e: 'D---' })
      return { pieces: out, hw: { ...noHw(), pata: 4 }, puertas: 0, cajones: 0, notes: [] }
    },
  },
  {
    key: 'torre', name: 'Cocina – torre / despensa', group: 'Cocinas', fondo: 'embutido',
    fields: [f('ancho', 'Ancho', 600, 300, 900), f('alto', 'Alto', 2100, 1500, 2500), f('fondo', 'Fondo', 600, 300, 650), f('repisas', 'Repisas', 4, 0, 8), f('puertas', 'Puertas (arriba y abajo)', 2, 0, 4)],
    tips: ['Con horno empotrado el fondo es de 60 exacto y deja 10 cm abiertos atrás hasta el techo para el calor.'],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = [{ n: 'Lateral', l: H, a: D, q: 2, e: 'D---' }, { n: 'Base y techo', l: Wi, a: D, q: 2, e: 'D---' }, { n: 'Zoclo', l: W, a: 100, q: 1, e: 'D---' }]
      const r = int(v.repisas)
      if (r) out.push({ n: 'Repisa', l: Wi, a: D - 22, q: r, e: 'D---' })
      const hw = noHw()
      const n = int(v.puertas)
      // Las puertas se reparten en dos alturas: abajo hasta 900 y arriba el resto.
      const filas = n >= 2 ? 2 : 1
      const porFila = Math.max(1, Math.round(n / filas))
      let puertas = 0
      if (n) {
        const abajo = filas === 2 ? 900 : H - 106
        puertas += doors(out, hw, porFila, abajo, doorWidth(W, porFila), filas === 2 ? 'Puerta de abajo' : 'Puerta')
        if (filas === 2) puertas += doors(out, hw, porFila, H - 100 - 900 - 9, doorWidth(W, porFila), 'Puerta de arriba')
      }
      backPanel(out, H - 100, W, o.fondo)
      hw.pata += 4
      return { pieces: out, hw, puertas, cajones: 0, notes: [] }
    },
  },
  {
    key: 'zapatera', name: 'Zapatera', group: 'Closets y roperos', fondo: 'sobrepuesto', piso: true,
    fields: [f('ancho', 'Ancho', 900, 400, 1600), f('alto', 'Alto', 1100, 600, 1800), f('fondo', 'Fondo', 300, 250, 400), f('repisas', 'Repisas', 4, 0, 10), f('puertas', 'Puertas abatibles al frente', 2, 0, 4), f('arriba', 'Puertas que abren hacia arriba (con pistón)', 0, 0, 4), f('cajones', 'Cajones', 1, 0, 3)],
    tips: ['Con 30 de fondo la corredera es de 25.', 'Las puertas que abren hacia arriba llevan pistón de 60 N.'],
    presets: [[1250, 900, 300, 4, 0, 0, 1], [1036, 1000, 300, 4, 2, 0, 0], [1100, 900, 300, 4, 2, 0, 0], [1550, 850, 330, 3, 0, 3, 0], [1660, 850, 312, 5, 2, 0, 0]].map(([alto, ancho, fondo, repisas, puertas, arriba, cajones]) => ({ name: `${alto}×${ancho}×${fondo}`, v: { alto, ancho, fondo, repisas, puertas, arriba, cajones } })),
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = [{ n: 'Lateral', l: H - e, a: D, q: 2, e: 'D---' }, { n: 'Techo', l: W, a: D, q: 1, e: 'D-DD' }, { n: 'Base', l: Wi, a: D, q: 1, e: 'D---' }, { n: 'Zoclo', l: Wi, a: 80, q: 1, e: 'D---' }]
      const r = int(v.repisas)
      if (r) out.push({ n: 'Repisa', l: Wi, a: D - 20, q: r, e: 'D---' })
      const hw = noHw()
      const nc = int(v.cajones)
      drawers(nc, { wh: Wi, dint: D, tapaW: W - 6, tapaH: 180, e, holg: v.__holg, hw, out })
      let puertas = doors(out, hw, int(v.puertas), Math.max(200, H - 80 - e - 4 - (nc ? 180 * nc : 0)), doorWidth(W, int(v.puertas)))
      const up = int(v.arriba)
      if (up) {
        const alto = fl((H - 80 - e - 4 - (nc ? 180 * nc : 0)) / up)
        out.push({ n: 'Puerta abatible hacia arriba', l: W - 6, a: alto - 3, q: up, e: 'GGGG' })
        hw.bis += up * 2
        hw.piston += up * 2
        hw.jal += up
        puertas += up
      }
      backPanel(out, H - 80, W, o.fondo)
      return { pieces: out, hw, puertas, cajones: nc, notes: [] }
    },
  },
  {
    key: 'cocinero', name: 'Cocinero compacto (bajo + alacena)', group: 'Cocinas', fondo: 'sobrepuesto', piso: true,
    fields: [f('ancho', 'Ancho', 1600, 800, 2200), f('alto', 'Alto total', 1900, 1500, 2200), f('fondo', 'Fondo', 468, 300, 600), f('hueco', 'Hueco de microondas (alto)', 450, 0, 600), f('puertasBajo', 'Puertas del bajo', 2, 0, 4), f('puertasArriba', 'Puertas de arriba', 2, 0, 4), f('cajones', 'Cajones del bajo', 0, 0, 4)],
    tips: ['El bajo mide 750 (lateral de 732 más la cubierta); patas niveladoras.', 'Deja el hueco del microondas con ventilación atrás.'],
    presets: [[1770, 915, 418], [1928, 1300, 418], [1850, 1600, 318], [1900, 1600, 468], [2100, 1800, 500], [1820, 1200, 518], [2000, 1600, 568], [1950, 1500, 518], [1950, 1900, 418], [1950, 1300, 368], [1900, 1200, 418], [1800, 1000, 418], [1100, 1200, 418]].map(([alto, ancho, fondo]) => ({ name: `${alto}×${ancho}×${fondo}${alto === 1100 ? ' (infantil)' : ''}`, v: { alto, ancho, fondo } })),
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const bajo = 750
      const arriba = Math.max(0, H - bajo - int(v.hueco))
      const out: BPiece[] = [
        { n: 'Lateral', l: H, a: D, q: 2, e: 'D---' }, { n: 'Base y techo', l: Wi, a: D, q: 2, e: 'D---' }, { n: 'Cubierta del bajo', l: Wi, a: D, q: 1, e: 'G---' },
        { n: 'Repisa del bajo', l: Wi, a: D - 20, q: 1, e: 'D---' }, { n: 'Repisa de arriba', l: Wi, a: D - 20, q: arriba > 500 ? 2 : 1, e: 'D---' }, { n: 'Base del hueco', l: Wi, a: D, q: int(v.hueco) ? 1 : 0, e: 'D---' },
      ]
      const hw = noHw()
      const nc = int(v.cajones)
      if (nc) drawers(nc, { wh: Wi, dint: D, tapaW: W - 6, tapaH: 150, e, holg: v.__holg, hw, out })
      const pb = int(v.puertasBajo)
      let puertas = doors(out, hw, pb, bajo - e - 4 - (nc ? 153 * nc : 0), doorWidth(W, pb), 'Puerta del bajo')
      const pa = int(v.puertasArriba)
      if (arriba > 0) puertas += doors(out, hw, pa, arriba - e - 4, doorWidth(W, pa), 'Puerta de arriba')
      backPanel(out, H, W, o.fondo)
      hw.pata += 4
      return { pieces: out, hw, puertas, cajones: nc, notes: [] }
    },
  },
  {
    key: 'portamicro', name: 'Portamicroondas', group: 'Cocinas', fondo: 'sobrepuesto', piso: true,
    fields: [f('ancho', 'Ancho', 600, 450, 900), f('alto', 'Alto', 920, 600, 1500), f('fondo', 'Fondo', 450, 350, 600), f('puertas', 'Puertas abajo', 1, 0, 2)],
    tips: ['El hueco del micro va arriba con base de 400 de fondo libre y ventilación atrás.'],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = [{ n: 'Lateral', l: H - e, a: D, q: 2, e: 'D---' }, { n: 'Techo', l: W, a: D, q: 1, e: 'D-DD' }, { n: 'Base y entrepaño del micro', l: Wi, a: D, q: 2, e: 'D---' }, { n: 'Repisa', l: Wi, a: D - 20, q: 1, e: 'D---' }, { n: 'Zoclo', l: Wi, a: 80, q: 1, e: 'D---' }]
      const hw = noHw()
      const n = int(v.puertas)
      const puertas = doors(out, hw, n, Math.max(200, H - 80 - 400 - e - 4), doorWidth(W, n))
      backPanel(out, H - 80, W, o.fondo)
      return { pieces: out, hw, puertas, cajones: 0, notes: [] }
    },
  },
  {
    key: 'tocador', name: 'Tocador con espejo', group: 'Recámaras y burós', fondo: 'sobrepuesto', piso: true,
    fields: [f('ancho', 'Ancho', 900, 600, 1600), f('alto', 'Alto', 750, 600, 900), f('fondo', 'Fondo', 450, 350, 500), f('porColumna', 'Cajones por columna', 4, 1, 6), f('columnas', 'Columnas de cajones', 1, 1, 2)],
    tips: ['El espejo cotízalo aparte con tu vidriero (por ejemplo 695 × 628).'],
    presets: [[750, 900, 450, 4, 1], [800, 950, 400, 3, 1], [750, 1300, 450, 4, 2]].map(([alto, ancho, fondo, porColumna, columnas]) => ({ name: `${alto}×${ancho}×${fondo}`, v: { alto, ancho, fondo, porColumna, columnas } })),
    dims: WHD,
    build: (v, o) => dresser(v, o, 50),
  },
  {
    key: 'cabecera_buros', name: 'Cabecera con burós integrados', group: 'Recámaras y burós', fondo: 'sobrepuesto', piso: true,
    fields: [f('cama', 'Ancho de la cama', 1350, 900, 2000), f('altoCab', 'Alto de la cabecera', 1150, 700, 1500), f('anchoBuro', 'Ancho de cada buró', 550, 400, 700), f('altoBuro', 'Alto del buró', 650, 400, 800), f('fondo', 'Fondo del buró', 450, 350, 500), f('cajones', 'Cajones por buró', 2, 1, 3)],
    tips: ['La cabecera va atornillada a los burós; los burós llevan corredera de 35.'],
    dims: (v) => [v.cama + 2 * v.anchoBuro, v.altoCab, v.fondo],
    build: (v, o) => {
      const b = dresser({ ancho: v.anchoBuro, alto: v.altoBuro, fondo: v.fondo, porColumna: v.cajones, columnas: 1, __holg: v.__holg }, o, 50)
      const pieces = [...b.pieces.map((p) => ({ ...p, n: `${p.n} (buró)`, q: p.q * 2 })), { n: 'Cabecera', l: v.cama + 100, a: v.altoCab, q: 1, e: 'GGGG' }]
      return { pieces, hw: scaleHw(b.hw, 2), puertas: 0, cajones: b.cajones * 2, notes: [] }
    },
  },
  {
    key: 'cama_alta', name: 'Cama alta con escalera-cajonera', group: 'Infantiles', fondo: 'sobrepuesto', piso: true,
    fields: [{ k: 'colchon', label: 'Colchón', def: 1, choices: [[1, 'Individual 90 × 190'], [2, 'Individual chico 80 × 190']] }, f('libre', 'Altura libre abajo', 1400, 900, 1600), f('baranda', 'Baranda arriba del colchón', 450, 300, 600), { k: 'abajo', label: 'Abajo de la cama', def: 0, choices: [[0, 'Nada'], [1, 'Escritorio'], [2, 'Clóset']] }],
    tips: ['Usa base de 25 mm o refuérzala: carga a un niño brincando.', 'La baranda debe quedar mínimo 30 cm arriba del colchón.'],
    dims: (v) => [(int(v.colchon) === 2 ? 800 : 900) + 100, v.libre + v.baranda + 200, 1964 + 1000],
    build: (v) => {
      const A = int(v.colchon) === 2 ? 800 : 900
      const L = 1900
      const out: BPiece[] = [
        { n: 'Base de la cama', l: L + 64, a: A + 100, q: 1, e: 'DDDD' }, { n: 'Baranda', l: L + 64, a: v.baranda, q: 2, e: 'GG--' },
        { n: 'Cabecera y piecera', l: A + 100, a: v.libre + v.baranda + 200, q: 2, e: 'GGGG' }, { n: 'Travesaño bajo la base', l: L + 64, a: 150, q: 2, e: '----' },
        { n: 'Lateral de la escalera', l: 1000, a: 1000, q: 2, e: 'GG--' }, { n: 'Paso de escalón', l: 464, a: 300, q: 4, e: 'G---' },
      ]
      const hw = { ...noHw(), corr: { 300: 3, 200: 1 }, jal: 4 }
      out.push({ n: 'Tapa de cajón de escalón', l: 458, a: 220, q: 4, e: 'GGGG' }, { n: 'Lateral de cajón', l: 280, a: 180, q: 8, e: 'D---' }, { n: 'Frente y contrafrente de cajón', l: 400, a: 180, q: 8, e: 'D---' }, { n: 'Fondo de cajón', l: 400, a: 258, q: 4, e: '----', mdf: true })
      let puertas = 0
      if (v.abajo === 1) out.push({ n: 'Tablero de escritorio', l: 1200, a: 500, q: 1, e: 'GGGG' }, { n: 'Pata de escritorio', l: 760, a: 480, q: 1, e: 'D-D-' })
      if (v.abajo === 2) {
        out.push({ n: 'Lateral de clóset', l: v.libre, a: 550, q: 1, e: 'D---' }, { n: 'Repisa de clóset', l: A + 64, a: 530, q: 1, e: 'D---' })
        hw.tubo += A / 1000
        hw.sop += 2
        puertas = doors(out, hw, 2, v.libre - 6, doorWidth(A + 100, 2))
      }
      return { pieces: out, hw, puertas, cajones: 4, notes: [`Altura libre abajo: ${v.libre} mm.`] }
    },
  },
  {
    key: 'mesa_centro', name: 'Mesa de centro', group: 'Mesas, sillas y bancos', fondo: 'sobrepuesto', piso: true,
    fields: [f('ancho', 'Largo', 800, 500, 1400), f('alto', 'Alto', 450, 300, 550), f('fondo', 'Fondo', 500, 350, 700), f('cajones', 'Cajones', 0, 0, 2)],
    tips: ['Tablero con canto grueso en los 4 lados; la repisa de abajo le da rigidez.'],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = [{ n: 'Tablero', l: W, a: D, q: 1, e: 'GGGG' }, { n: 'Lateral', l: H - e, a: D, q: 2, e: 'D-DD' }, { n: 'Repisa de abajo', l: Wi, a: D - 40, q: 1, e: 'D---' }, { n: 'Amarre', l: Wi, a: 100, q: 1, e: '----' }]
      const hw = noHw()
      const nc = int(v.cajones)
      drawers(nc, { wh: fl(Wi / Math.max(1, nc)), dint: D - 20, tapaW: fl((W - 6 - 3 * (nc - 1)) / Math.max(1, nc)), tapaH: 100, e, holg: v.__holg, hw, out })
      return { pieces: out, hw, puertas: 0, cajones: nc, notes: [] }
    },
  },
  {
    key: 'centro_tv', name: 'Centro de entretenimiento con panel', group: 'Muebles de TV', fondo: 'sobrepuesto', piso: true,
    fields: [f('ancho', 'Ancho', 1800, 1200, 2400), f('alto', 'Alto total', 1800, 1200, 2200), f('fondo', 'Fondo de la mesa', 400, 300, 500), f('altoMesa', 'Alto de la mesa', 500, 350, 600), f('repisas', 'Repisas flotantes', 2, 0, 4), f('puertas', 'Puertas de la mesa', 2, 0, 4)],
    tips: ['El panel va atornillado al muro con taquetes en las 4 esquinas y al centro.', 'El vidrio de las repisas (5 mm) cotízalo con tu vidriero.'],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const hm = v.altoMesa
      const Wi = W - 2 * e
      const out: BPiece[] = [
        { n: 'Panel trasero', l: W, a: H - hm, q: 1, e: 'DDDD' }, { n: 'Tablero de la mesa', l: W, a: D, q: 1, e: 'GGGG' }, { n: 'Lateral de la mesa', l: hm - e, a: D, q: 2, e: 'D-DD' },
        { n: 'Base de la mesa', l: Wi, a: D, q: 1, e: 'D---' }, { n: 'División de la mesa', l: hm - 2 * e, a: D - 20, q: 1, e: 'D---' },
      ]
      const r = int(v.repisas)
      if (r) out.push({ n: 'Repisa flotante', l: fl(W / 2), a: 250, q: r, e: 'DDDD' })
      const hw = { ...noHw(), sop: 2 * r + 5 }
      const n = int(v.puertas)
      const puertas = doors(out, hw, n, hm - 2 * e - 4, doorWidth(W, n))
      backPanel(out, hm, W, o.fondo)
      return { pieces: out, hw, puertas, cajones: 0, notes: [] }
    },
  },
  {
    key: 'mostrador', name: 'Mostrador', group: 'Mostradores', fondo: 'sobrepuesto', cubierta: true, piso: true,
    fields: [f('ancho', 'Ancho', 1500, 800, 3000), f('alto', 'Alto', 1000, 850, 1150), f('fondo', 'Fondo', 500, 350, 700), f('repisas', 'Repisas por dentro', 2, 0, 4), f('puertas', 'Puertas por dentro', 0, 0, 4)],
    tips: ['El frente va cerrado hacia el cliente y las repisas hacia ti.', 'Con «Incluir cubierta» se cobra la cubierta comprada en lugar de la de melamina.'],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = []
      if (!o.cubierta) out.push({ n: 'Cubierta', l: W + 40, a: D + 40, q: 1, e: 'GGGG' })
      out.push({ n: 'Frente', l: W, a: H - e, q: 1, e: 'D-DD' }, { n: 'Lateral', l: H - e, a: D - e, q: 2, e: 'D---' }, { n: 'Base', l: Wi, a: D - e, q: 1, e: 'D---' })
      const r = int(v.repisas)
      if (r) out.push({ n: 'Repisa', l: Wi, a: D - e - 20, q: r, e: 'D---' })
      const hw = noHw()
      const n = int(v.puertas)
      const puertas = doors(out, hw, n, H - 2 * e - 100, doorWidth(W, n))
      return { pieces: out, hw, puertas, cajones: 0, notes: [] }
    },
  },
  {
    key: 'esquinero_alto', name: 'Cocina – esquinero alto', group: 'Cocinas', fondo: 'embutido',
    fields: [{ k: 'tipo', label: 'Tipo', def: 2, choices: [[1, 'Diagonal (puerta a 45°)'], [2, 'En L (dos puertas)']] }, f('lado', 'Lado (cada pared)', 600, 500, 900), f('alto', 'Alto', 700, 300, 1000), f('fondo', 'Fondo', 300, 250, 400), f('repisas', 'Repisas', 1, 0, 3)],
    tips: ['Techo, base y repisas salen cuadrados: el corte en L o en diagonal se marca sobre la pieza.', 'En L va con bisagra de 180° y bisagra de doble giro; en diagonal, con bisagra de 45°.'],
    dims: (v) => [v.lado, v.alto, v.lado],
    build: (v, o) => {
      const e = o.esp
      const { lado: L, alto: H, fondo: D } = v
      const sq = L - e
      const out: BPiece[] = [{ n: 'Lateral', l: H, a: D, q: 2, e: 'D-DD' }, { n: 'Techo y base (cortar en ' + (v.tipo === 1 ? 'diagonal)' : 'L)'), l: sq, a: sq, q: 2, e: '----' }]
      const r = int(v.repisas)
      if (r) out.push({ n: 'Repisa (cortar igual)', l: sq - 22, a: sq - 22, q: r, e: '----' })
      backPanel(out, H, L, o.fondo, 'Fondo de un lado')
      backPanel(out, H, L - e, o.fondo, 'Fondo del otro lado')
      const hw = noHw()
      let puertas = 0
      if (v.tipo === 1) {
        puertas = doors(out, hw, 1, H - 6, fl(Math.SQRT2 * (L - D)) - 4, 'Puerta diagonal')
      } else {
        puertas = doors(out, hw, 2, H - 6, L - D - 4, 'Puerta (una por lado)')
      }
      hw.sop += 2
      return { pieces: out, hw, puertas, cajones: 0, notes: ['Verifica el ángulo del muro antes de cortar techo y base.'] }
    },
  },
  {
    key: 'columna_horno', name: 'Cocina – columna de horno', group: 'Cocinas', fondo: 'embutido',
    fields: [f('ancho', 'Ancho', 600, 600, 700), f('alto', 'Alto', 2100, 1800, 2400), f('fondo', 'Fondo', 570, 550, 600), f('nicho', 'Alto del nicho del horno', 585, 450, 700), f('base', 'Altura del piso al nicho', 800, 400, 1000), f('cajones', 'Cajones abajo', 2, 0, 3)],
    tips: ['Nicho de 560 × 585 para el horno, con rejilla de ventilación y 10 cm abiertos atrás hasta el techo.', 'El fondo de la columna es de 57 a 60: revisa la ficha del horno.'],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = [
        { n: 'Lateral', l: H, a: D, q: 2, e: 'D---' }, { n: 'Base y techo', l: Wi, a: D, q: 2, e: 'D---' }, { n: 'Zoclo', l: W, a: 100, q: 1, e: 'D---' },
        { n: 'Entrepaño bajo el horno', l: Wi, a: D, q: 1, e: 'D---' }, { n: 'Entrepaño sobre el horno', l: Wi, a: D - 100, q: 1, e: 'D---' }, { n: 'Rejilla de ventilación (frente)', l: Wi, a: 50, q: 1, e: 'D---' },
      ]
      const hw = noHw()
      const nc = int(v.cajones)
      const abajo = v.base - 100
      if (nc) drawers(nc, { wh: Wi, dint: D - 22, tapaW: W - 6, tapaH: fl((abajo - 4 - 3 * (nc - 1)) / nc), e, holg: v.__holg, hw, out })
      const arriba = H - v.base - v.nicho - 50
      const puertas = arriba > 200 ? doors(out, hw, 1, arriba - 4, W - 6, 'Puerta de arriba') : 0
      if (arriba > 500) out.push({ n: 'Repisa de arriba', l: Wi, a: D - 22, q: 1, e: 'D---' })
      // Sin fondo detrás del horno: solo en la parte de arriba y la de abajo.
      backPanel(out, abajo + 22, W, o.fondo, 'Fondo de abajo')
      if (arriba > 0) backPanel(out, arriba + 22, W, o.fondo, 'Fondo de arriba')
      hw.pata += 4
      return { pieces: out, hw, puertas, cajones: nc, notes: [`Nicho libre de ${Wi} × ${v.nicho} mm.`] }
    },
  },
  {
    key: 'cubo', name: 'Cubo / repisa cubo', group: 'Repisas y libreros', fondo: 'sobrepuesto',
    fields: [f('ancho', 'Ancho', 350, 200, 800), f('alto', 'Alto', 250, 150, 800), f('fondo', 'Fondo', 350, 150, 500), f('cantidad', 'Cantidad', 1, 1, 30)],
    tips: ['Cuatro piezas por cubo; con canto en el frente se ven igual de cualquier lado.'],
    presets: [{ name: 'Cubo 350 × 250 × 350', v: { ancho: 350, alto: 250, fondo: 350 } }, { name: 'Cubo-repisa 600 × 600 × 200', v: { ancho: 600, alto: 600, fondo: 200 } }],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const c = Math.max(1, int(v.cantidad))
      return { pieces: [{ n: 'Techo y base', l: v.ancho, a: v.fondo, q: 2 * c, e: 'D---' }, { n: 'Lateral', l: v.alto - 2 * e, a: v.fondo, q: 2 * c, e: 'D---' }], hw: { ...noHw(), sop: 2 * c }, puertas: 0, cajones: 0, notes: [] }
    },
  },
  {
    key: 'esquinero_repisas', name: 'Esquinero de repisas', group: 'Repisas y libreros', fondo: 'sobrepuesto',
    fields: [f('lado', 'Lado (cada pared)', 300, 200, 600), f('alto', 'Alto', 600, 300, 2000), f('repisas', 'Repisas', 3, 1, 8)],
    tips: ['Las repisas salen cuadradas y se cortan en diagonal: de cada cuadro salen dos.'],
    dims: (v) => [v.lado, v.alto, v.lado],
    build: (v, o) => {
      const e = o.esp
      const L = v.lado
      const r = Math.max(1, int(v.repisas))
      return { pieces: [{ n: 'Lateral', l: v.alto, a: L, q: 1, e: 'D---' }, { n: 'Lateral (el otro lado)', l: v.alto, a: L - e, q: 1, e: 'D---' }, { n: 'Repisa (cuadro para cortar en diagonal)', l: L - e, a: L - e, q: Math.ceil(r / 2), e: '----' }], hw: { ...noHw(), sop: 2 }, puertas: 0, cajones: 0, notes: [] }
    },
  },
  {
    key: 'panel_tv', name: 'Panel flotante de TV', group: 'Muebles de TV', fondo: 'sobrepuesto',
    fields: [f('ancho', 'Ancho', 1600, 800, 2400), f('alto', 'Alto', 1000, 500, 1800), f('repisas', 'Repisas flotantes', 2, 0, 6), f('fondoRepisa', 'Fondo de repisa', 250, 150, 400)],
    tips: ['Atornillado al muro con taquetes en las 4 esquinas y al centro; deja el paso de cables antes de colgarlo.'],
    dims: (v) => [v.ancho, v.alto, v.fondoRepisa],
    build: (v) => {
      const r = int(v.repisas)
      const out: BPiece[] = [{ n: 'Panel', l: v.ancho, a: v.alto, q: 1, e: 'DDDD' }]
      if (r) out.push({ n: 'Repisa flotante', l: fl(v.ancho / 2), a: v.fondoRepisa, q: r, e: 'DDDD' })
      return { pieces: out, hw: { ...noHw(), sop: 5 + 2 * r }, puertas: 0, cajones: 0, notes: [] }
    },
  },
  {
    key: 'cama_baja', name: 'Cama baja con cajones', group: 'Infantiles', fondo: 'sobrepuesto', piso: true,
    fields: [{ k: 'colchon', label: 'Colchón', def: 1, choices: [[1, 'Individual 90 × 190'], [2, 'Individual chico 80 × 190'], [3, 'Matrimonial 135 × 190']] }, f('cajones', 'Cajones abajo', 3, 0, 6), { k: 'cabecera', label: 'Cabecera y piecera', def: 1, choices: [[1, 'Sí'], [0, 'No']] }],
    tips: ['Cajones con corredera de 45 por el lado libre de la cama.', 'Con 6 cajones van 3 por lado (cama individual con cajones del Tomo I).'],
    dims: (v) => { const m = KID_MATTRESS[int(v.colchon)] ?? KID_MATTRESS[1]; return [m.a + 60, 450, m.l + 64] },
    build: (v, o) => lowBed(v, o),
  },
  {
    key: 'cama_sofa', name: 'Cama sofá', group: 'Infantiles', fondo: 'sobrepuesto', piso: true,
    fields: [{ k: 'colchon', label: 'Colchón', def: 1, choices: [[1, 'Individual 90 × 190'], [2, 'Individual chico 80 × 190']] }, f('cajones', 'Cajones abajo', 2, 0, 4), f('respaldo', 'Alto del respaldo', 400, 250, 600)],
    tips: ['De día es sillón: el respaldo va a lo largo y los brazos en las cabeceras.'],
    dims: (v) => { const m = KID_MATTRESS[int(v.colchon)] ?? KID_MATTRESS[1]; return [m.l + 64, 450 + v.respaldo, m.a + 60] },
    build: (v, o) => {
      const b = lowBed({ ...v, cabecera: 0 }, o)
      const m = KID_MATTRESS[int(v.colchon)] ?? KID_MATTRESS[1]
      b.pieces.push({ n: 'Respaldo', l: m.l + 64, a: v.respaldo, q: 1, e: 'GGGG' }, { n: 'Brazo', l: m.a + 60, a: 450 + v.respaldo - 100, q: 2, e: 'GGGG' })
      return b
    },
  },
  {
    key: 'litera', name: 'Litera', group: 'Infantiles', fondo: 'sobrepuesto', piso: true,
    fields: [{ k: 'colchon', label: 'Colchón', def: 1, choices: [[1, 'Individual 90 × 190'], [2, 'Individual chico 80 × 190']] }, f('alto', 'Alto total', 1600, 1400, 1900), f('peldanos', 'Peldaños de la escalera', 4, 3, 6)],
    tips: ['Deja 75 a 80 cm entre la cama de abajo y la de arriba para sentarse.', 'La baranda de arriba va mínimo 30 cm sobre el colchón.'],
    dims: (v) => { const m = KID_MATTRESS[int(v.colchon)] ?? KID_MATTRESS[1]; return [m.a + 100, v.alto, m.l + 200] },
    build: (v) => {
      const m = KID_MATTRESS[int(v.colchon)] ?? KID_MATTRESS[1]
      const L = m.l + 64
      const A = m.a + 100
      const out: BPiece[] = [
        { n: 'Base de cama', l: L, a: A, q: 2, e: 'DDDD' }, { n: 'Lateral de cama de abajo', l: L, a: 250, q: 2, e: 'GG--' }, { n: 'Baranda de arriba', l: L, a: 450, q: 2, e: 'GG--' },
        { n: 'Cabecera y piecera', l: v.alto, a: A, q: 2, e: 'GGGG' }, { n: 'Larguero de escalera', l: v.alto - 300, a: 80, q: 2, e: 'DDDD' }, { n: 'Peldaño', l: 400, a: 80, q: Math.max(3, int(v.peldanos)), e: 'DD--' },
      ]
      return { pieces: out, hw: noHw(), puertas: 0, cajones: 0, notes: ['Revisa que la escalera quede firme: atorníllala a la cabecera en tres puntos.'] }
    },
  },
  {
    key: 'puerta_mueble', name: 'Puertas sueltas de mueble', group: 'Puertas', fondo: 'sobrepuesto',
    fields: [f('ancho', 'Ancho de cada puerta', 450, 150, 1200), f('alto', 'Alto de cada puerta', 700, 150, 2400), f('cantidad', 'Cantidad', 2, 1, 20), { k: 'arriba', label: 'Abren hacia arriba (con pistón)', def: 0, choices: [[0, 'No'], [1, 'Sí']] }],
    tips: ['Para cambiar frentes de una cocina vieja: mide el hueco y descuenta 3 mm por lado.'],
    dims: (v) => [v.ancho, v.alto, 0],
    build: (v) => {
      const c = Math.max(1, int(v.cantidad))
      const hw = noHw()
      const out: BPiece[] = []
      const puertas = doors(out, hw, c, v.alto, v.ancho)
      if (v.arriba) {
        hw.bis = 2 * c
        hw.piston = 2 * c
      }
      return { pieces: out, hw, puertas, cajones: 0, notes: [] }
    },
  },
  {
    key: 'caja_libre', name: 'Mueble a la medida (caja libre)', group: 'Personalizados', fondo: 'embutido', piso: true,
    fields: [f('ancho', 'Ancho', 800, 200, 2400), f('alto', 'Alto', 900, 200, 2400), f('fondo', 'Fondo', 450, 150, 700), f('repisas', 'Repisas', 1, 0, 10), f('puertas', 'Puertas', 2, 0, 6), f('cajones', 'Cajones abajo', 0, 0, 6), f('divisiones', 'Divisiones verticales', 0, 0, 4)],
    tips: ['Para lo que no está en la lista: arma la caja y ajusta las piezas en SketchCut si hace falta.'],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = [{ n: 'Lateral', l: H, a: D, q: 2, e: 'D---' }, { n: 'Base y techo', l: Wi, a: D, q: 2, e: 'D---' }]
      const d = int(v.divisiones)
      if (d) out.push({ n: 'División vertical', l: H - 2 * e, a: D - 22, q: d, e: 'D---' })
      const r = int(v.repisas)
      if (r) out.push({ n: 'Repisa', l: rd((Wi - d * e) / (d + 1)), a: D - 22, q: r * (d + 1), e: 'D---' })
      const hw = noHw()
      const nc = int(v.cajones)
      if (nc) drawers(nc, { wh: Wi, dint: D - (o.fondo === 'embutido' ? 22 : 0), tapaW: W - 6, tapaH: 180, e, holg: v.__holg, hw, out })
      const n = int(v.puertas)
      const puertas = doors(out, hw, n, Math.max(150, H - 6 - nc * 183), doorWidth(W, n))
      backPanel(out, H, W, o.fondo)
      return { pieces: out, hw, puertas, cajones: nc, notes: [] }
    },
  },
  {
    key: 'planchador', name: 'Planchador', group: 'Personalizados', fondo: 'sobrepuesto',
    fields: [f('ancho', 'Ancho', 800, 500, 1200), f('alto', 'Alto', 930, 700, 1100), f('fondo', 'Fondo', 360, 300, 450), f('repisas', 'Repisas', 1, 0, 3)],
    tips: ['Lleva ruedas, tubo ovalado para colgar la ropa planchada y porta-planchador a un costado.'],
    presets: [{ name: '930 × 800 × 360', v: { alto: 930, ancho: 800, fondo: 360 } }, { name: '950 × 650 × 380', v: { alto: 950, ancho: 650, fondo: 380 } }],
    dims: WHD,
    build: (v, o) => {
      const e = o.esp
      const { ancho: W, alto: H, fondo: D } = v
      const Wi = W - 2 * e
      const out: BPiece[] = [{ n: 'Lateral', l: H - e, a: D, q: 2, e: 'D-DD' }, { n: 'Techo', l: W, a: D, q: 1, e: 'GGGG' }, { n: 'Base', l: Wi, a: D, q: 1, e: 'D---' }, { n: 'Porta-planchador', l: 400, a: 120, q: 1, e: 'DDDD' }]
      const r = int(v.repisas)
      if (r) out.push({ n: 'Repisa', l: Wi, a: D - 20, q: r, e: 'D---' })
      return { pieces: out, hw: { ...noHw(), tubo: Wi / 1000, sop: 2 }, puertas: 0, cajones: 0, notes: ['Ruedas: elige «Ruedas» en Apoyo.'] }
    },
  },
  {
    key: 'lavabo', name: 'Mueble de lavabo', group: 'Cocinas', fondo: 'embutido', cubierta: true,
    fields: [f('ancho', 'Ancho', 600, 400, 1200), f('alto', 'Alto de la caja', 550, 400, 900), f('fondo', 'Fondo', 450, 300, 600), f('puertas', 'Puertas', 2, 0, 3)],
    tips: ['Sin repisa ni fondo para la tubería; usa tablero resistente a la humedad.', 'La cubierta o el lavabo de sobreponer se cortan a plantilla.'],
    dims: WHD,
    build: (v, o) => kitchenBase(v, o, { repisas: false, fondo: false }),
  },
]

const TOWER = 600
/** Medidas de colchón en mm (México). */
/** Colchones de niño (mm). */
const KID_MATTRESS: Record<number, { l: number; a: number }> = { 1: { l: 1900, a: 900 }, 2: { l: 1900, a: 800 }, 3: { l: 1900, a: 1350 } }

/** Cama baja: base, laterales, cabecera y piecera opcionales y cajones abajo (corredera de 45). */
function lowBed(v: Record<string, number>, o: BaseOpts): Built {
  const e = o.esp
  const m = KID_MATTRESS[int(v.colchon)] ?? KID_MATTRESS[1]
  const L = m.l + 64
  const A = m.a + 60
  const out: BPiece[] = [{ n: 'Base', l: L - 4, a: A - 40, q: 1, e: '----' }, { n: 'Columna (lateral)', l: L, a: 300, q: 2, e: 'GG--' }, { n: 'Travesaño', l: A - 2 * e, a: 300, q: 2, e: 'D---' }]
  if (v.cabecera) out.push({ n: 'Cabecera y piecera', l: A + 40, a: 450, q: 2, e: 'GGGG' })
  const hw = noHw()
  const nc = int(v.cajones)
  if (nc) drawers(nc, { wh: fl(L / Math.max(1, Math.ceil(nc / (nc > 3 ? 2 : 1)))) - 40, dint: 500, tapaW: fl(L / Math.ceil(nc / (nc > 3 ? 2 : 1))) - 6, tapaH: 220, e, holg: v.__holg, hw, out })
  return { pieces: out, hw, puertas: 0, cajones: nc, notes: [] }
}

const MATTRESS: Record<number, { l: number; a: number }> = { 1: { l: 1900, a: 900 }, 2: { l: 1900, a: 1350 }, 3: { l: 2000, a: 1500 }, 4: { l: 2000, a: 1900 } }

/** Buró y cómoda: techo encima con vuelo, base, zoclo y amarre, verticales y columnas de cajones. */
function dresser(v: Record<string, number>, o: BaseOpts, zoclo: number): Built {
  const e = o.esp
  const { ancho: W, alto: H, fondo: D } = v
  const Wi = W - 2 * e
  const cols = Math.max(1, int(v.columnas))
  const per = Math.max(1, int(v.porColumna))
  const out: BPiece[] = [
    { n: 'Lateral', l: H - e, a: D, q: 2, e: 'D---' }, { n: 'Base', l: Wi, a: D, q: 1, e: 'D---' },
    { n: 'Zoclo y amarre', l: Wi, a: zoclo, q: 2, e: 'D---' }, { n: 'Techo', l: W, a: D + 20, q: 1, e: 'GGGG' },
  ]
  const np = int(v.puertas)
  // Las puertas van en una sección propia, al lado de las columnas de cajones.
  const sections = cols + (np ? 1 : 0)
  if (sections > 1) out.push({ n: 'Vertical', l: H - e - zoclo, a: D, q: sections - 1, e: 'D---' })
  const hw = noHw()
  const wc = rd((Wi - (sections - 1) * e) / sections)
  const tapaW = fl((W - 6 - 3 * (sections - 1)) / sections)
  const tapaH = fl((H - e - zoclo - 4 - 3 * (per - 1)) / per)
  for (let c = 0; c < cols; c++) drawers(per, { wh: wc, dint: D - (o.fondo === 'embutido' ? 22 : 0), tapaW, tapaH, e, holg: v.__holg, hw, out })
  const puertas = np ? doors(out, hw, np, H - e - zoclo - 4, fl((tapaW - 3 * (np - 1)) / np)) : 0
  backPanel(out, H - zoclo, W, o.fondo)
  return { pieces: mergePieces(out), hw, puertas, cajones: cols * per, notes: [] }
}

function sumHw(a: Hardware, b: Hardware): Hardware {
  const corr = { ...a.corr }
  for (const [k, n] of Object.entries(b.corr)) corr[+k] = (corr[+k] ?? 0) + n
  return { bis: a.bis + b.bis, corr, jal: a.jal + b.jal, pata: a.pata + b.pata, sop: a.sop + b.sop, tubo: a.tubo + b.tubo, riel: a.riel + b.riel, piston: a.piston + b.piston }
}

function scaleHw(h: Hardware, n: number): Hardware {
  return { bis: h.bis * n, corr: Object.fromEntries(Object.entries(h.corr).map(([k, q]) => [k, q * n])), jal: h.jal * n, pata: h.pata * n, sop: h.sop * n, tubo: h.tubo * n, riel: h.riel * n, piston: h.piston * n }
}

/** Junta piezas iguales (mismo nombre, medidas, cantos y material). */
function mergePieces(list: BPiece[]): BPiece[] {
  const out: BPiece[] = []
  for (const p of list) {
    const same = out.find((x) => x.n === p.n && x.l === p.l && x.a === p.a && x.e === p.e && !!x.mdf === !!p.mdf && !!x.ranura === !!p.ranura)
    if (same) same.q += p.q
    else out.push({ ...p })
  }
  return out
}

/** Largo siempre mayor que ancho; al girar, los cantos se reordenan con la pieza. */
function normalize(p: BPiece): BPiece {
  const l = rd(p.l)
  const a = rd(p.a)
  if (l >= a) return { ...p, l, a }
  const e = p.e.padEnd(4, '-')
  return { ...p, l: a, a: l, e: e[2] + e[3] + e[0] + e[1] }
}

export const templateOf = (key: string) => TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0]

export const defaultValues = (t: Template): Record<string, number> => Object.fromEntries(t.fields.map((x) => [x.k, x.def]))

export type BaseState = { key: string; values: Record<string, number>; opts: BaseOpts; /** Solo con key = 'cocina'. */ kitchen?: KitchenState }

export function defaultOpts(cfg: Pick<QuoterConfig, 'esp'>, t: Template): BaseOpts {
  return { esp: cfg.esp, veta: false, suave: true, cubierta: false, iguales: 1, fondo: t.fondo, estilo: 'A' }
}

/** Toda la cocina: el despiece de cada módulo junto. Los paneles de ajuste van como piezas sueltas. */
function kitchenBuild(k: KitchenState, o: BaseOpts, cfg: Pick<QuoterConfig, 'holgCajon'>): Built {
  const all: Built[] = []
  const loose: BPiece[] = []
  for (const m of modulesOf(k)) {
    if (m.kind === 'ajuste') {
      if (m.ancho > 0) loose.push({ n: 'Panel de ajuste', l: 776, a: m.ancho, q: 1, e: 'D---' })
      continue
    }
    const st = moduleState(m, o)
    if (st) all.push(buildBase(st, cfg))
  }
  return {
    pieces: [...all.flatMap((b) => b.pieces), ...loose],
    hw: all.reduce((a, b) => sumHw(a, b.hw), noHw()),
    puertas: all.reduce((a, b) => a + b.puertas, 0),
    cajones: all.reduce((a, b) => a + b.cajones, 0),
    notes: [],
  }
}

/** El mueble con que abre la pestaña. */
export function initialBase(cfg: Pick<QuoterConfig, 'esp'>): BaseState {
  const t = templateOf('coc_bajo')
  return { key: t.key, values: defaultValues(t), opts: defaultOpts(cfg, t) }
}

/** Arma el mueble: piezas (ya multiplicadas por «cuántos iguales»), herrajes y conteos. */
export function buildBase(s: BaseState, cfg: Pick<QuoterConfig, 'holgCajon'>): Built {
  const t = templateOf(s.key)
  const v = { ...defaultValues(t), ...s.values, __holg: cfg.holgCajon }
  const b = s.key === 'cocina' ? kitchenBuild(s.kitchen ?? DEFAULT_KITCHEN, s.opts, cfg) : t.build(v, s.opts)
  const n = Math.max(1, int(s.opts.iguales))
  return {
    pieces: mergePieces(b.pieces.filter((p) => p.q > 0 && p.l > 0 && p.a > 0).map(normalize)).map((p) => ({ ...p, q: p.q * n })),
    hw: scaleHw(b.hw, n), puertas: b.puertas * n, cajones: b.cajones * n, notes: b.notes,
  }
}

// ——— Acomodo en hojas ———

export type SheetSpec = { l: number; a: number; sierra: number; refile: number }
export type PlacedPiece = { i: number; x: number; y: number; w: number; h: number; rot: boolean }
/** `free`: los huecos que quedan sin usar en la hoja (mm, ya con el refilado), para guardarlos como retazos. */
export type Sheet = { placed: PlacedPiece[]; usedPct: number; free: { x: number; y: number; w: number; h: number }[] }
export type Layout = { sheets: Sheet[]; tooBig: number[] }

/**
 * Guillotina «mejor ajuste por el lado corto»: piezas de mayor a menor, cada una al hueco donde sobre menos por su lado corto,
 * y el hueco se parte por el eje que deja el sobrante más grande. `fixed` = no girar (veta). `idx` dice qué piezas acomodar.
 */
export function packSheets(pieces: BPiece[], idx: number[], sheet: SheetSpec, fixed: boolean): Layout {
  const W = sheet.l - 2 * sheet.refile
  const H = sheet.a - 2 * sheet.refile
  const k = sheet.sierra
  const items: { i: number; w: number; h: number }[] = []
  const tooBig: number[] = []
  for (const i of idx) {
    const p = pieces[i]
    const fits = (p.l <= W && p.a <= H) || (!fixed && p.a <= W && p.l <= H)
    if (!fits) tooBig.push(i)
    else for (let c = 0; c < p.q; c++) items.push({ i, w: p.l, h: p.a })
  }
  items.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h)
  type Free = { x: number; y: number; w: number; h: number }
  const sheets: { free: Free[]; placed: PlacedPiece[] }[] = []
  for (const it of items) {
    const opts: [number, number, boolean][] = [[it.w, it.h, false]]
    if (!fixed && it.w !== it.h) opts.push([it.h, it.w, true])
    let best: { s: number; f: number; w: number; h: number; rot: boolean; score: number } | undefined
    const tryIn = (s: number) =>
      sheets[s].free.forEach((fr, fi) => {
        for (const [w, h, rot] of opts) {
          if (w > fr.w || h > fr.h) continue
          const score = Math.min(fr.w - w, fr.h - h)
          if (!best || score < best.score) best = { s, f: fi, w, h, rot, score }
        }
      })
    for (let s = 0; s < sheets.length; s++) tryIn(s)
    if (!best) {
      sheets.push({ free: [{ x: 0, y: 0, w: W, h: H }], placed: [] })
      tryIn(sheets.length - 1)
    }
    if (!best) continue
    const sh = sheets[best.s]
    const fr = sh.free.splice(best.f, 1)[0]
    sh.placed.push({ i: it.i, x: fr.x + sheet.refile, y: fr.y + sheet.refile, w: best.w, h: best.h, rot: best.rot })
    const rw = fr.w - best.w - k
    const bh = fr.h - best.h - k
    // Corte a todo lo largo por el lado que deja el sobrante más grande.
    if (rw * fr.h >= bh * fr.w) {
      if (rw > 0) sh.free.push({ x: fr.x + best.w + k, y: fr.y, w: rw, h: fr.h })
      if (bh > 0) sh.free.push({ x: fr.x, y: fr.y + best.h + k, w: best.w, h: bh })
    } else {
      if (bh > 0) sh.free.push({ x: fr.x, y: fr.y + best.h + k, w: fr.w, h: bh })
      if (rw > 0) sh.free.push({ x: fr.x + best.w + k, y: fr.y, w: rw, h: best.h })
    }
  }
  const area = sheet.l * sheet.a
  return { sheets: sheets.map((s) => ({ placed: s.placed, usedPct: Math.round((s.placed.reduce((a, p) => a + p.w * p.h, 0) / area) * 100), free: s.free.map((f) => ({ ...f, x: f.x + sheet.refile, y: f.y + sheet.refile })) })), tooBig }
}

// ——— Resultado ———

/** Metros de canto delgado y grueso (sin desperdicio). */
export function edgeLength(pieces: BPiece[]): { d: number; g: number } {
  let d = 0
  let g = 0
  for (const p of pieces) {
    p.e.split('').forEach((c, i) => {
      const len = ((i < 2 ? p.l : p.a) * p.q) / 1000
      if (c === 'D') d += len
      if (c === 'G') g += len
    })
  }
  return { d, g }
}

export type BaseResult = {
  built: Built
  board: Layout
  mdf: Layout
  boardIdx: number[]
  mdfIdx: number[]
  /** Metros de canto ya con el 10 % de desperdicio. */
  edge: { d: number; g: number }
  tornillos: number
  screws: { t50: number; t30: number; t17: number }
  angulos: number
  tramos: number
  apoyo: { tipo: Apoyo; n: number }
  tapas: number
  clavos: number
  deslizadores: number
  /** Pesos. */
  material: number
  /** Desglose del material en pesos. */
  parts: [string, number][]
  hours: number
}

export function sheetOf(cfg: Pick<QuoterConfig, 'hojaL' | 'hojaA' | 'sierra' | 'refile'>): SheetSpec {
  return { l: cfg.hojaL, a: cfg.hojaA, sierra: cfg.sierra, refile: cfg.refile }
}

export function calcBase(s: BaseState, cfg: QuoterConfig): BaseResult {
  const built = buildBase(s, cfg)
  const t = templateOf(s.key)
  const boardIdx = built.pieces.flatMap((p, i) => (p.mdf ? [] : [i]))
  const mdfIdx = built.pieces.flatMap((p, i) => (p.mdf ? [i] : []))
  const board = packSheets(built.pieces, boardIdx, sheetOf(cfg), s.opts.veta)
  const mdf = packSheets(built.pieces, mdfIdx, { l: MDF_SHEET.l, a: MDF_SHEET.a, sierra: cfg.sierra, refile: 0 }, false)
  const raw = edgeLength(built.pieces)
  const edge = { d: raw.d * 1.1, g: raw.g * 1.1 }
  const count = built.pieces.reduce((a, p) => a + p.q, 0)
  const hw = built.hw
  const pares = Object.values(hw.corr).reduce((a, n) => a + n, 0)
  // Anexo A4, tornillos por tipo: 4×50 en la estructura (4 por pieza que se une, +10 %), 4×30 en correderas (6 por lado)
  // y jaladeras (2), 3.5×17 en bisagras (4) y fondos de cajón (6).
  const fronts = /^(Puerta|Tapa|Hoja|Cabecera|Panel)/
  const struct = built.pieces.filter((p) => !p.mdf && !fronts.test(p.n)).reduce((a, p) => a + p.q, 0)
  const drawerBacks = built.pieces.filter((p) => p.n.startsWith('Fondo de cajón')).reduce((a, p) => a + p.q, 0)
  const screws = { t50: Math.ceil(struct * 4 * 1.1), t30: 12 * pares + 2 * hw.jal, t17: 4 * hw.bis + 6 * drawerBacks }
  const tornillos = screws.t50 + screws.t30 + screws.t17
  // Ángulo de plástico doble 40×20: dos por cada repisa, base, techo o división.
  const angulos = 2 * built.pieces.filter((p) => /^(Repisa|Base|Techo|División|Vertical|Entrepaño|Maletero)/.test(p.n)).reduce((a, p) => a + p.q, 0)
  // Tubo ovalado de 1" en tramos de 3 m.
  const tramos = Math.ceil(hw.tubo / 3 - 1e-9)
  const n = Math.max(1, int(s.opts.iguales))
  const [W] = t.dims({ ...defaultValues(t), ...s.values })
  // Anexo A4: tapa tornillos en lo que queda a la vista (aprox. la mitad), un clavo cada 12 cm del perímetro de los fondos
  // (no en los fondos de cajón) y 4 deslizadores por mueble que va al piso sin patas.
  const tapas = Math.ceil(tornillos / 2)
  const clavos = Math.ceil(built.pieces.filter((p) => p.mdf && !p.n.startsWith('Fondo de cajón')).reduce((a, p) => a + (2 * (p.l + p.a) * p.q) / 120, 0))
  const apoyo = s.opts.apoyo ?? 'normal'
  const especiales = apoyo !== 'normal' ? 4 * n : 0
  const deslizadores = apoyo === 'normal' && t.piso && hw.pata === 0 ? 4 * n : 0
  const patas = apoyo === 'normal' ? hw.pata : 0
  const parts: [string, number][] = [
    ['Hojas de tablero', (board.sheets.length + board.tooBig.length) * cfg.hoja],
    ['Hojas de fondo', mdf.sheets.length * cfg.fondo],
    ['Canto delgado', edge.d * cfg.tcD],
    ['Canto grueso', edge.g * cfg.tcG],
    ['Bisagras', hw.bis * (s.opts.suave ? cfg.bisS : cfg.bisN)],
    ['Correderas', pares * cfg.corr],
    [s.opts.pushOpen ? 'Push-open' : 'Jaladeras', hw.jal * (s.opts.pushOpen ? cfg.push : cfg.jal)],
    ['Patas', patas * cfg.pata],
    [apoyo === 'ruedas' ? 'Ruedas' : 'Patas de madera', especiales * (apoyo === 'ruedas' ? cfg.rueda : cfg.pataMadera)],
    ['Soportes y colgadores', hw.sop * cfg.sop],
    ['Tubo (tramos de 3 m)', tramos * 3 * cfg.tuboML],
    ['Riel', hw.riel * cfg.rielML],
    ['Pistones', hw.piston * cfg.piston],
    ['Tornillos 4×50', screws.t50 * cfg.tor],
    ['Tornillos 4×30', screws.t30 * cfg.tor30],
    ['Tornillos 3.5×17', screws.t17 * cfg.tor17],
    ['Ángulos de plástico 40×20', angulos * cfg.angulo],
    ['Tapa tornillos', tapas * cfg.tapa],
    ['Clavos para fondos', clavos * cfg.clavo],
    ['Deslizadores', deslizadores * cfg.deslz],
    ['Cubierta', t.cubierta && s.opts.cubierta ? (s.key === 'cocina' ? counterMeters(modulesOf(s.kitchen ?? DEFAULT_KITCHEN)) : W / 1000) * cubPrice(cfg, s.opts.cubiertaTipo) * n : 0],
  ]
  const material = parts.reduce((a, [, v]) => a + v, 0)
  // Instalación: una vez por mueble; en la cocina, una por módulo.
  const installs = s.key === 'cocina' ? modulesOf(s.kitchen ?? DEFAULT_KITCHEN).filter((m) => moduleState(m, s.opts)).length : 1
  const hours = count * cfg.hPieza + built.cajones * cfg.hCajon + built.puertas * cfg.hPuerta + cfg.hInst * n * installs
  return { built, board, mdf, boardIdx, mdfIdx, edge, tornillos, screws, angulos, tramos, apoyo: { tipo: apoyo, n: especiales }, tapas, clavos, deslizadores, material, parts: parts.filter(([, v]) => v > 0), hours }
}

/** Precio por metro de la cubierta según su tipo. */
export const cubPrice = (cfg: Pick<QuoterConfig, 'cubML' | 'cubPiedra' | 'cubSolido'>, tipo: CubiertaTipo = 'post') => (tipo === 'piedra' ? cfg.cubPiedra : tipo === 'solido' ? cfg.cubSolido : cfg.cubML)

export function baseTitle(s: BaseState): string {
  if (s.key === 'cocina') return kitchenTitle(s.kitchen ?? DEFAULT_KITCHEN)
  const t = templateOf(s.key)
  const [w, h, d] = t.dims({ ...defaultValues(t), ...s.values })
  const n = Math.max(1, int(s.opts.iguales))
  return `${t.name} ${[w, h, d].filter((x) => x > 0).map(rd).join('×')} mm${n > 1 ? ` (×${n})` : ''}`
}

/** «1 largo», «2 largos y 1 ancho», «4 lados grueso»… */
export function edgeText(e: Edges): string {
  const parts: string[] = []
  for (const kind of ['D', 'G'] as const) {
    const l = [e[0], e[1]].filter((c) => c === kind).length
    const a = [e[2], e[3]].filter((c) => c === kind).length
    if (!l && !a) continue
    const word = kind === 'G' ? ' grueso' : ''
    if (l === 2 && a === 2) parts.push(`4 lados${word}`)
    else parts.push([l && `${l} largo${l > 1 ? 's' : ''}`, a && `${a} ancho${a > 1 ? 's' : ''}`].filter(Boolean).join(' y ') + word)
  }
  return parts.join(', ') || 'sin canto'
}

export function hardwareList(hw: Hardware, tornillos: number, suave: boolean, r?: Pick<BaseResult, 'screws' | 'angulos' | 'tramos' | 'apoyo'>, push = false): string[] {
  const out: string[] = []
  if (hw.bis) out.push(`${hw.bis} bisagras de cazoleta 35 mm${suave ? ' (cierre suave)' : ''}`)
  for (const [l, n] of Object.entries(hw.corr).sort((a, b) => +a[0] - +b[0])) out.push(`${n} par${n === 1 ? '' : 'es'} de correderas de ${+l / 10} cm`)
  if (hw.jal) out.push(push ? `${hw.jal} mecanismos push-open (sin jaladeras)` : `${hw.jal} jaladeras`)
  if (hw.pata && (!r || r.apoyo.tipo === 'normal')) out.push(`${hw.pata} patas niveladoras`)
  if (r?.apoyo.n) out.push(`${r.apoyo.n} ${r.apoyo.tipo === 'ruedas' ? 'ruedas' : 'patas de madera de 20 cm'}`)
  if (hw.sop) out.push(`${hw.sop} soportes, colgadores o canoplas`)
  if (hw.tubo) out.push(`${Math.round(hw.tubo * 100) / 100} m de tubo ovalado de 1"${r ? ` (${r.tramos} tramo${r.tramos === 1 ? '' : 's'} de 3 m)` : ''}`)
  if (hw.riel) out.push(`${Math.round(hw.riel * 100) / 100} m de riel para corredizas`)
  if (hw.piston) out.push(`${hw.piston} pistones`)
  if (r) {
    out.push(`Tornillos: ${r.screws.t50} de 4×50, ${r.screws.t30} de 4×30 y ${r.screws.t17} de 3.5×17 (aprox.)`)
    if (r.angulos) out.push(`${r.angulos} ángulos de plástico 40×20`)
  } else out.push(`${tornillos} tornillos (aprox.)`)
  return out
}

export function cutText(s: BaseState, r: BaseResult, cfg: Pick<QuoterConfig, 'hojaL' | 'hojaA'>): string {
  const lines = r.built.pieces.map((p, i) => `${i + 1}. ${p.n} — ${p.l} x ${p.a} mm — ${p.q} pza${p.q === 1 ? '' : 's'}${p.mdf ? ' — MDF 3 mm' : ` — canto: ${edgeText(p.e)}`}${p.ranura ? ' — ranura' : ''}`)
  return [
    `*Despiece: ${baseTitle(s)}*`,
    `Tablero de ${s.opts.esp} mm${s.opts.veta ? ', con veta (no girar)' : ''}`,
    '',
    ...lines,
    '',
    `Hojas de ${cfg.hojaL}×${cfg.hojaA}: ${r.board.sheets.length}`,
    r.mdf.sheets.length ? `Hojas de fondo 3 mm: ${r.mdf.sheets.length}` : '',
    `Canto delgado: ${r.edge.d.toFixed(1)} m · Canto grueso: ${r.edge.g.toFixed(1)} m`,
  ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n')
}

export function cutCsv(r: BaseResult, veta: boolean): string {
  const cell = (c: string) => (c === '-' ? '' : c)
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const rows = r.built.pieces.map((p) => [esc(p.mdf ? `${p.n} (MDF 3 mm)` : p.n), p.l, p.a, p.q, ...p.e.padEnd(4, '-').split('').map(cell), veta && !p.mdf ? 'Sí' : 'No'].join(','))
  return ['Pieza,Largo,Ancho,Cantidad,CantoL1,CantoL2,CantoA1,CantoA2,Veta', ...rows].join('\n')
}

/** Medidas de hoja que se usan en las madererías. */
export const SHEET_PRESETS: [number, number][] = [[2440, 1220], [2440, 1830], [2440, 2150], [2440, 2140]]

/**
 * Archivo para SketchCut PRO (.sct, versión 3.0), armado a partir del ejemplo de un proyecto real:
 * encabezado con la hoja, luego `<Parts>` con cada pieza (largo X ancho X cantidad) y la posición de cada copia en la hoja
 * (`1{girada}{hoja}_-1X{x}X{y}`, en mm desde la esquina). Solo el despiece: los cantos van vacíos (`0X0_0X0`) y se marcan en SketchCut.
 * Banderas: `10` si la pieza se puede girar, `00` con veta. Confirmado con dos archivos reales.
 */
export function sketchCutFile(r: BaseResult, cfg: Pick<QuoterConfig, 'hojaL' | 'hojaA' | 'refile'>, which: 'board' | 'mdf' = 'board', veta = false): string {
  const lay = which === 'board' ? r.board : r.mdf
  const sheet = which === 'board' ? { l: cfg.hojaL, a: cfg.hojaA } : MDF_SHEET
  const idx = which === 'board' ? r.boardIdx : r.mdfIdx
  // Nuestro acomodo deja la orilla refilada; SketchCut cuenta desde la esquina útil.
  return writeSct(r.built.pieces, lay, idx, sheet, which === 'board' ? cfg.refile : 0, veta)
}

/** El despiece del cotizador normal (medidas en cm, hojas de 244 × 122) para SketchCut PRO. */
export function sketchCutFromCm(pieces: { name: string; qty: number; largo: number; ancho: number; material: string }[], material: 'melamina' | 'fondo', girar: boolean): string {
  const list: BPiece[] = pieces
    .filter((p) => p.material === material && p.qty > 0)
    .map((p) => normalize({ n: p.name, l: Math.round(p.largo * 10), a: Math.round(p.ancho * 10), q: p.qty, e: '----', ...(material === 'fondo' && { mdf: true }) }))
  const idx = list.map((_, i) => i)
  const sheet = { l: 2440, a: 1220 }
  const lay = packSheets(list, idx, { ...sheet, sierra: 4, refile: 0 }, !girar)
  return writeSct(list, lay, idx, sheet, 0, !girar)
}

function writeSct(pieces: BPiece[], lay: Layout, idx: number[], sheet: { l: number; a: number }, refile: number, veta: boolean): string {
  const placements = new Map<number, string[]>()
  lay.sheets.forEach((s, si) => {
    for (const p of s.placed) {
      const list = placements.get(p.i) ?? []
      list.push(`1${p.rot ? 1 : 0}${si + 1}_-1X${Math.round(p.x - refile)}X${Math.round(p.y - refile)}`)
      placements.set(p.i, list)
    }
  })
  const parts = idx.filter((i) => placements.has(i))
  const body = parts.flatMap((i) => {
    const p = pieces[i]
    const pos = placements.get(i)!
    return [`${p.l}X${p.a}X${pos.length}`, '0X0_0X0', veta && !p.mdf ? '00' : '10', ...pos]
  })
  const head = ['<V3.0>', '1', `${sheet.l}X${sheet.a}_${Math.max(1, lay.sheets.length)}`, '2X2X0_True', '', '', '', '', '', '2', '', '0.4', '', '1', '', '', '', '', '', '', '', '', '', '']
  return [...head, `<Parts>${parts.length}`, ...body, '<USnips>0', '<NSnips>0', '8', '15', '4', ''].join('\n')
}
