// Servicios extra (trabajos de obra): cada uno calcula su material con factores editables, las horas y el precio
// con la misma fórmula del cotizador. Los precios unitarios son estimados: cada taller pone los suyos en Mis costos.
import type { QuoterConfig } from './quoter'

export type SField = { k: string; label: string; def: number; unit?: string; choices?: [number, string][] }
export type SPrice = { k: string; label: string; def: number }
/** Una línea de material: cantidad × precio unitario (pesos). */
export type SLine = { n: string; qty: number; unit: string; price: number }
export type SCalc = { lines: SLine[]; hours: number; /** Días de curado o secado (no son horas de trabajo, pero mueven la entrega). */ days?: number; notes: string[] }
export type Service = { key: string; name: string; desc: string; fields: SField[]; prices: SPrice[]; warning?: string; calc: (v: Record<string, number>, p: Record<string, number>, cfg: QuoterConfig) => SCalc }

/** Encendidos y precios propios de cada servicio (se guardan con el negocio). */
export type ServConfig = { on?: string[]; p?: Record<string, Record<string, number>> }
export type ServState = { key: string; values: Record<string, number> }
/** Una partida de una cotización que junta varios trabajos (un mueble de Bases o un servicio). */
export type Part = { id: string; name: string; material: number; hours: number; base?: import('./bases').BaseState; serv?: ServState }

const up = Math.ceil
const r2 = (x: number) => Math.round(x * 100) / 100
const fld = (k: string, label: string, def: number, unit?: string): SField => ({ k, label, def, ...(unit && { unit }) })
const pr = (k: string, label: string, def: number): SPrice => ({ k, label, def })
const line = (n: string, qty: number, unit: string, price: number): SLine => ({ n, qty: r2(qty), unit, price })

const PLACA_M2 = 1.22 * 2.44

export const SERVICES: Service[] = [
  {
    key: 'drywall', name: 'Drywall', desc: 'Muro, plafón o revestimiento de tablaroca.',
    fields: [
      { k: 'tipo', label: 'Tipo', def: 1, choices: [[1, 'Muro sencillo'], [2, 'Muro doble'], [3, 'Medio muro / revestimiento'], [4, 'Plafón corrido'], [5, 'Plafón reticulado']] },
      fld('largo', 'Largo', 4, 'm'), fld('alto', 'Alto (o ancho en plafón)', 2.44, 'm'), fld('caras', 'Caras con placa', 1),
      { k: 'sep', label: 'Separación de postes', def: 0.61, choices: [[0.406, '40.6 cm'], [0.61, '61 cm']] },
      { k: 'poste', label: 'Poste', def: 64, choices: [[64, '64 mm'], [89, '89 mm']] },
      { k: 'placa', label: 'Placa', def: 1, choices: [[1, '1/2" normal'], [2, '1/2" verde (baño)'], [3, '5/8" contra fuego'], [4, '3/8" para plafón']] },
      fld('vanos', 'Vanos de puerta o ventana', 0), fld('vanoA', 'Ancho del vano', 0.9, 'm'), fld('vanoH', 'Alto del vano', 2.1, 'm'), fld('esquinas', 'Esquinas exteriores', 0, 'm'),
      { k: 'colchoneta', label: 'Colchoneta acústica', def: 0, choices: [[0, 'No'], [1, 'Sí']] },
    ],
    prices: [
      pr('canal', 'Canal de 3.05 m', 65), pr('poste', 'Poste de 2.44 m', 75), pr('poste305', 'Poste de 3.05 m', 95), pr('poste366', 'Poste de 3.66 m', 115),
      pr('placa1', 'Placa 1/2" normal', 230), pr('placa2', 'Placa 1/2" verde', 330), pr('placa3', 'Placa 5/8" contra fuego', 360), pr('placa4', 'Placa 3/8"', 210),
      pr('tornillo', 'Tornillo para placa', 0.35), pr('wafer', 'Tornillo wafer', 0.35), pr('cinta', 'Cinta de papel (m)', 1.2), pr('redimix', 'Redimix (kg)', 18),
      pr('esquinero', 'Esquinero metálico 3.05 m', 55), pr('taquete', 'Taquete o clavo de pistola', 1.5), pr('canaleta', 'Canaleta 3.05 m', 70), pr('liston', 'Canal listón 3.05 m', 80),
      pr('colgante', 'Colgante', 6), pr('angulo', 'Ángulo perimetral 3.05 m', 45), pr('principal', 'Principal 3.66 m', 95), pr('sec122', 'Secundario 1.22 m', 35), pr('sec61', 'Secundario 0.61 m', 20),
      pr('loseta', 'Loseta de plafón 61×61', 45), pr('colchoneta', 'Colchoneta (m²)', 60), pr('horas', 'Horas por m² de cara', 0.35),
    ],
    calc: (v, p) => {
      const L = Math.max(0, v.largo)
      const H = Math.max(0, v.alto)
      const tipo = v.tipo
      const lines: SLine[] = []
      const notes: string[] = []
      const placaKey = `placa${v.placa}` as const
      if (tipo <= 3) {
        const filas = tipo === 2 ? 2 : 1
        const caras = Math.max(1, v.caras)
        const area = Math.max(0, L * H - v.vanos * v.vanoA * v.vanoH)
        const postes = (up(L / v.sep) + 1 + 2 * v.vanos) * filas
        const largoPoste = H <= 2.44 ? 2.44 : H <= 3.05 ? 3.05 : 3.66
        lines.push(line('Canal de 3.05 m', up(((2 * L) / 3) * 1.05) * filas, 'pzas', p.canal))
        lines.push(line(`Poste de ${largoPoste} m (${v.poste} mm)`, postes, 'pzas', largoPoste === 2.44 ? p.poste : largoPoste === 3.05 ? p.poste305 : p.poste366))
        if (H > 3.66) notes.push('El alto pasa del poste más largo: empalma con un pedazo de canal de 20 cm.')
        const placas = up(((area * caras) / PLACA_M2) * 1.1)
        lines.push(line('Placa de 1.22 × 2.44', placas, 'pzas', p[placaKey]))
        lines.push(line(`Tornillo ${caras > 1 && tipo === 2 ? '1⅝"' : '1¼"'}`, placas * 25, 'pzas', p.tornillo))
        lines.push(line('Tornillo wafer 8×13', postes * 4, 'pzas', p.wafer))
        lines.push(line('Cinta de papel', area * caras * 3, 'm', p.cinta))
        lines.push(line('Redimix', area * caras * 0.7, 'kg', p.redimix))
        if (v.esquinas > 0) lines.push(line('Esquinero metálico 3.05 m', up(v.esquinas / 3.05), 'pzas', p.esquinero))
        lines.push(line('Taquete o clavo de pistola', up((2 * L) / 0.6), 'pzas', p.taquete))
        if (v.colchoneta) lines.push(line('Colchoneta de fibra de vidrio', area, 'm²', p.colchoneta))
        const espesor = tipo === 2 ? (v.poste === 64 ? 11.5 : 14.4) : v.poste === 64 ? 8.9 : 12
        notes.push(`Espesor terminado aprox. ${espesor} cm.`, 'Deja 10–15 mm libres del piso.', 'Las juntas no caen en la orilla de puertas ni ventanas (corta la placa en L).', 'Pasa las tuberías y el cableado antes de cerrar.')
        return { lines, hours: area * caras * p.horas, notes }
      }
      const area = L * H
      lines.push(line('Ángulo perimetral 3.05 m', up((2 * (L + H)) / 3.05), 'pzas', p.angulo))
      if (tipo === 4) {
        const placas = up((area / PLACA_M2) * 1.1)
        const canaletas = up(H / 0.406) + 1
        const listones = up(L / 1.22) + 1
        lines.push(line('Placa de 1.22 × 2.44', placas, 'pzas', p[placaKey]))
        lines.push(line('Canaleta 3.05 m (cada 40.6 cm)', up((canaletas * L) / 3.05), 'pzas', p.canaleta))
        lines.push(line('Canal listón 3.05 m (cada 1.22 m)', up((listones * H) / 3.05), 'pzas', p.liston))
        lines.push(line('Colgante (cada 1 m)', listones * (up(H) + 1), 'pzas', p.colgante))
        lines.push(line('Tornillo 1¼"', placas * 25, 'pzas', p.tornillo))
        lines.push(line('Cinta de papel', area * 3, 'm', p.cinta))
        lines.push(line('Redimix', area * 0.7, 'kg', p.redimix))
      } else {
        lines.push(line('Loseta 61 × 61', up((area / 0.372) * 1.05), 'pzas', p.loseta))
        lines.push(line('Principal 3.66 m (cada 1.22 m)', up(((up(H / 1.22) + 1) * L) / 3.66), 'pzas', p.principal))
        lines.push(line('Secundario 1.22 m', up(area / 0.744), 'pzas', p.sec122))
        lines.push(line('Secundario 0.61 m', up(area / 0.744), 'pzas', p.sec61))
        lines.push(line('Colgante de alambre', up(area / 1.5), 'pzas', p.colgante))
      }
      return { lines, hours: area * p.horas, notes: ['Revisa la modulación contra las lámparas y difusores antes de colgar.'] }
    },
  },
  {
    key: 'resina', name: 'Mesa de resina / río', desc: 'Tabla de madera con río, cubierta de resina o relleno de grietas.',
    fields: [
      { k: 'tipo', label: 'Tipo', def: 1, choices: [[1, 'Mesa de río'], [2, 'Cubierta completa'], [3, 'Solo relleno de grietas']] },
      fld('largo', 'Largo', 180, 'cm'), fld('ancho', 'Ancho', 90, 'cm'), fld('espesor', 'Espesor', 4, 'cm'), fld('rio', 'Ancho promedio del río', 20, 'cm'),
      fld('madera', 'Madera (lo que te cuesta la tabla)', 0, '$'), { k: 'base', label: 'Base', def: 0, choices: [[0, 'Sin base'], [1, 'Madera'], [2, 'Metal']] },
    ],
    prices: [
      pr('resina', 'Resina epóxica (litro)', 450), pr('pigmento', 'Pigmento (gramo)', 2), pr('molde', 'Molde y cinta (por mesa)', 350), pr('lijas', 'Lijas (juego por grano)', 250),
      pr('acabado', 'Aceite o barniz final', 300), pr('baseMadera', 'Base de madera', 1500), pr('baseMetal', 'Base de metal', 2500), pr('capa', 'Grosor máximo por capa (cm)', 5),
    ],
    calc: (v, p) => {
      const area = (v.largo * v.ancho) / 10000
      let litros = v.tipo === 1 ? (v.largo * v.rio * v.espesor) / 1000 : v.tipo === 3 ? area * 0.5 : 0
      if (v.tipo === 2) litros += area * 0.3 * 2
      litros *= 1.1
      const capas = v.tipo === 1 ? Math.max(1, up(v.espesor / Math.max(0.5, p.capa))) : 1
      const lines = [line('Resina epóxica', litros, 'L', p.resina), line('Pigmento', litros * 20, 'g', p.pigmento), line('Molde de melamina y cinta', 1, 'mesa', p.molde), line('Lijas', 1, 'juego', p.lijas), line('Aceite o barniz', 1, 'mesa', p.acabado)]
      if (v.madera > 0) lines.push(line('Madera', 1, 'tabla', v.madera))
      if (v.base === 1) lines.push(line('Base de madera', 1, 'pza', p.baseMadera))
      if (v.base === 2) lines.push(line('Base de metal', 1, 'pza', p.baseMetal))
      return {
        lines, hours: 3 + capas * 1.5 + 2 + area * 3 + 2, days: capas * 3 + 4,
        notes: [`Va en ${capas} capa${capas === 1 ? '' : 's'}: ninguna más gruesa de lo que indica tu resina.`, 'Los días de curado no son horas de trabajo, pero mueven la entrega.'],
      }
    },
  },
  {
    key: 'epoxico', name: 'Piso epóxico', desc: 'Primario, color y barniz, o autonivelante.',
    fields: [
      fld('m2', 'Superficie', 20, 'm²'), { k: 'estado', label: 'Estado del piso', def: 1, choices: [[1, 'Nuevo'], [2, 'Con pintura'], [3, 'Con grietas']] },
      { k: 'sistema', label: 'Sistema', def: 1, choices: [[1, 'Primario + color + barniz'], [2, 'Autonivelante']] }, fld('capas', 'Capas de color', 2), fld('espesor', 'Espesor del autonivelante', 2, 'mm'),
      { k: 'hojuela', label: 'Hojuela decorativa', def: 0, choices: [[0, 'No'], [1, 'Sí']] }, fld('grietas', 'Grietas a resanar', 0, 'm'),
    ],
    prices: [pr('primario', 'Primario (L)', 220), pr('color', 'Epóxico de color (L)', 380), pr('barniz', 'Barniz (L)', 320), pr('auto', 'Autonivelante (L)', 420), pr('desbaste', 'Desbaste o lijado (m²)', 25), pr('resanador', 'Resanador (m)', 30), pr('hojuela', 'Hojuela (m²)', 35)],
    calc: (v, p) => {
      const m = Math.max(0, v.m2)
      const lines = [line('Primario', m * 0.15 * 1.1, 'L', p.primario)]
      if (v.sistema === 1) lines.push(line('Epóxico de color', m * 0.25 * Math.max(1, v.capas) * 1.1, 'L', p.color), line('Barniz', m * 0.12 * 1.1, 'L', p.barniz))
      else lines.push(line('Autonivelante', m * Math.max(1, v.espesor) * 1.1, 'L', p.auto))
      lines.push(line('Desbaste o lijado', m, 'm²', p.desbaste * (v.estado === 2 ? 1.5 : 1)))
      if (v.grietas > 0) lines.push(line('Resanador de grietas', v.grietas, 'm', p.resanador))
      if (v.hojuela) lines.push(line('Hojuela decorativa', m, 'm²', p.hojuela))
      const capas = v.sistema === 1 ? Math.max(1, v.capas) + 2 : 2
      return { lines, hours: m * 0.25 + m * (v.estado === 2 ? 0.2 : 0.1), days: capas, notes: ['Entre capa y capa hay que esperar el curado: cuéntalo en la entrega.'] }
    },
  },
  {
    key: 'pintura', name: 'Pintura y barniz', desc: 'Pintar o laquear muebles y puertas con pistola HVLP.',
    fields: [
      { k: 'tipo', label: 'Trabajo', def: 1, choices: [[1, 'Pintar mueble'], [2, 'Laquear melamina'], [3, 'Barnizar madera'], [4, 'Pintar puertas o ventanas']] },
      fld('m2', 'Superficie', 10, 'm²'), fld('manos', 'Manos', 2), { k: 'sellador', label: 'Sellador o fondo', def: 1, choices: [[1, 'Sí'], [0, 'No']] },
    ],
    prices: [pr('pintura', 'Pintura, laca o barniz (L)', 280), pr('sellador', 'Sellador (L)', 220), pr('thinner', 'Thinner (L)', 60), pr('lija', 'Lija (pliego)', 12), pr('cinta', 'Cinta (rollo)', 45), pr('rend', 'Rendimiento (m² por litro)', 9), pr('perdida', 'Pérdida por rocío HVLP (%)', 25)],
    calc: (v, p) => {
      const m = Math.max(0, v.m2)
      const k = 1 + p.perdida / 100
      const litros = ((m * Math.max(1, v.manos)) / Math.max(1, p.rend)) * k
      const lines = [line('Pintura, laca o barniz', litros, 'L', p.pintura)]
      if (v.sellador) lines.push(line('Sellador', (m / Math.max(1, p.rend)) * k, 'L', p.sellador))
      lines.push(line('Thinner', litros * 0.5, 'L', p.thinner), line('Lija', up(m / 2), 'pliegos', p.lija), line('Cinta', up(m / 10), 'rollos', p.cinta))
      return { lines, hours: m * 0.3 + m * 0.2 * Math.max(1, v.manos), days: 1, notes: [] }
    },
  },
  {
    key: 'herreria', name: 'Herrería y mueble industrial', desc: 'Estructura de tubo con repisas de madera o melamina.',
    fields: [fld('m20', 'Tubo 20×20', 9.6, 'm'), fld('m25', 'Tubo 1" (25×25)', 0, 'm'), fld('m40', 'Tubo 40×20', 0, 'm'), fld('repisas', 'Repisas o cubiertas', 4), fld('repL', 'Largo de repisa', 600, 'mm'), fld('repA', 'Ancho de repisa', 300, 'mm'), fld('tornillos', 'Tornillos', 20), { k: 'pintar', label: 'Pintar el metal', def: 1, choices: [[1, 'Sí'], [0, 'No']] }],
    prices: [pr('t20', 'Tubo 20×20 (tramo de 6 m)', 180), pr('t25', 'Tubo 1" (tramo de 6 m)', 230), pr('t40', 'Tubo 40×20 (tramo de 6 m)', 260), pr('pintura', 'Pintura para metal (L)', 220), pr('soldadura', 'Soldadura (por m de tubo)', 4), pr('discos', 'Discos (por m de tubo)', 3), pr('tornillo', 'Tornillo', 1.5)],
    calc: (v, p, cfg) => {
      const lines: SLine[] = []
      const tubes: [string, number, number, number][] = [['Tubo 20×20', v.m20, p.t20, 0.08], ['Tubo 1"', v.m25, p.t25, 0.1], ['Tubo 40×20', v.m40, p.t40, 0.12]]
      let metros = 0
      let area = 0
      for (const [n, m, price, perim] of tubes) {
        if (!(m > 0)) continue
        metros += m
        area += m * perim
        lines.push(line(`${n} (tramos de 6 m)`, up((m / 6) * 1.1), 'tramos', price))
      }
      const m2 = (v.repisas * v.repL * v.repA) / 1e6
      if (m2 > 0) lines.push(line('Melamina o madera de repisas', m2 * 1.1, 'm²', cfg.hoja / PLACA_M2))
      if (v.pintar && area > 0) lines.push(line('Pintura para metal', Math.max(0.25, (area / 9) * 1.1), 'L', p.pintura))
      lines.push(line('Soldadura', metros, 'm', p.soldadura), line('Discos de corte y desbaste', metros, 'm', p.discos), line('Tornillos', up(v.tornillos * 1.1), 'pzas', p.tornillo))
      return { lines, hours: metros * 0.4 + v.repisas * 0.5, notes: m2 > 0 ? ['Las repisas también las puedes armar en Bases para acomodarlas en hojas.'] : [] }
    },
  },
  {
    key: 'aluminio', name: 'Cancelería de aluminio', desc: 'Ventanas, puertas, canceles de baño y mosquiteros.',
    fields: [
      { k: 'tipo', label: 'Tipo', def: 1, choices: [[1, 'Ventana corrediza'], [2, 'Fija'], [3, 'Puerta'], [4, 'Cancel de baño'], [5, 'Mosquitero']] },
      fld('ancho', 'Ancho', 1.2, 'm'), fld('alto', 'Alto', 1.2, 'm'), fld('hojas', 'Hojas', 2),
      { k: 'vidrio', label: 'Vidrio', def: 1, choices: [[1, 'Claro'], [2, 'Filtrasol'], [3, 'Templado'], [0, 'Sin vidrio (mosquitero)']] }, fld('cantidad', 'Piezas iguales', 1),
    ],
    prices: [pr('perfil', 'Perfil (tramo de 6.10 m)', 650), pr('v1', 'Vidrio claro (m²)', 450), pr('v2', 'Vidrio filtrasol (m²)', 650), pr('v3', 'Vidrio templado (m²)', 1200), pr('malla', 'Malla de mosquitero (m²)', 120), pr('felpa', 'Felpa (m)', 8), pr('vinil', 'Vinil (m)', 6), pr('jaladera', 'Jaladera', 60), pr('chapa', 'Chapa', 180), pr('carretilla', 'Carretilla', 45), pr('sellador', 'Sellador (tubo)', 90)],
    calc: (v, p) => {
      const n = Math.max(1, v.cantidad)
      const hojas = v.tipo === 2 ? 1 : Math.max(1, v.hojas)
      const marco = 2 * (v.ancho + v.alto)
      const hojaPerim = hojas * 2 * (v.ancho / hojas + v.alto)
      const vidrio = hojas * Math.max(0, v.ancho / hojas - 0.006) * Math.max(0, v.alto - 0.006)
      const lines = [line('Perfil (tramos de 6.10 m)', up(((marco + (v.tipo === 2 ? 0 : hojaPerim)) * n) / 6.1), 'tramos', p.perfil)]
      if (v.vidrio > 0 && v.tipo !== 5) lines.push(line('Vidrio', vidrio * n, 'm²', p[`v${v.vidrio}`]))
      if (v.tipo === 5) lines.push(line('Malla', vidrio * n, 'm²', p.malla))
      if (v.tipo !== 2) lines.push(line('Felpa', hojaPerim * n, 'm', p.felpa))
      lines.push(line('Vinil', hojaPerim * n, 'm', p.vinil))
      if (v.tipo === 1 || v.tipo === 3 || v.tipo === 4) lines.push(line('Jaladera', hojas * n, 'pzas', p.jaladera))
      if (v.tipo === 3) lines.push(line('Chapa', n, 'pzas', p.chapa))
      if (v.tipo === 1 || v.tipo === 4) lines.push(line('Carretillas', 2 * hojas * n, 'pzas', p.carretilla))
      lines.push(line('Sellador', up((marco * n) / 6), 'tubos', p.sellador))
      return { lines, hours: (2 + hojas) * n, notes: [`Son ${r2(v.ancho * v.alto * n)} m²: si cobras por m², divide el precio entre eso.`] }
    },
  },
  {
    key: 'madera', name: 'Puertas y ventanas de madera', desc: 'Puertas de tambor o entableradas, marcos de puerta y de ventana.',
    fields: [
      { k: 'tipo', label: 'Tipo', def: 1, choices: [[1, 'Puerta de tambor'], [2, 'Puerta entablerada'], [3, 'Marco de ventana con divisiones'], [4, 'Marco de puerta']] },
      fld('ancho', 'Ancho', 0.9, 'm'), fld('alto', 'Alto', 2.1, 'm'), fld('div', 'Divisiones o tableros', 0),
      { k: 'madera', label: 'Madera', def: 1, choices: [[1, 'Pino'], [2, 'Cedro'], [3, 'Parota']] }, fld('cantidad', 'Piezas iguales', 1),
    ],
    prices: [pr('pt1', 'Pino (pie tablar)', 28), pr('pt2', 'Cedro (pie tablar)', 75), pr('pt3', 'Parota (pie tablar)', 65), pr('triplay', 'Triplay o tablero (hoja)', 480), pr('vidrio', 'Vidrio (m²)', 450), pr('bisagra', 'Bisagra', 45), pr('chapa', 'Chapa', 350), pr('consumibles', 'Pegamento y clavos (por pieza)', 80)],
    calc: (v, p) => {
      const n = Math.max(1, v.cantidad)
      const ml = 2 * v.alto + (2 + Math.max(0, v.div)) * v.ancho
      const lines = [line('Madera de largueros y travesaños', ml * 1.4 * 1.15 * n, 'pies tablares', p[`pt${v.madera}`])]
      const area = v.ancho * v.alto
      if (v.tipo === 1) lines.push(line('Triplay para las dos caras', up((area * 2) / PLACA_M2) * n, 'hojas', p.triplay))
      if (v.tipo === 2) lines.push(line('Tableros', up(area / PLACA_M2) * n, 'hojas', p.triplay))
      if (v.tipo === 3) lines.push(line('Vidrio', area * 0.8 * n, 'm²', p.vidrio))
      if (v.tipo <= 2) lines.push(line('Bisagras', 3 * n, 'pzas', p.bisagra), line('Chapa', n, 'pzas', p.chapa))
      lines.push(line('Pegamento y clavos', n, 'pzas', p.consumibles))
      const h = v.tipo === 1 ? 6 : v.tipo === 2 ? 12 : v.tipo === 3 ? 4 + 0.5 * v.div : 3
      return { lines, hours: h * n, notes: ['El acabado (pintura o barniz) agrégalo con el servicio de Pintura.'] }
    },
  },
  {
    key: 'cabana', name: 'Cabañas, casetas y divisiones', desc: 'Bastidor de madera, forro, techo e interior (estimado general).',
    fields: [
      fld('largo', 'Largo', 3, 'm'), fld('ancho', 'Ancho', 2.4, 'm'), fld('alto', 'Alto de muros', 2.4, 'm'), { k: 'techo', label: 'Techo', def: 2, choices: [[1, 'Una agua'], [2, 'Dos aguas']] },
      { k: 'forro', label: 'Forro exterior', def: 1, choices: [[1, 'Duela'], [2, 'Tabla'], [3, 'Triplay']] }, { k: 'interior', label: 'Interior', def: 1, choices: [[0, 'Nada'], [1, 'Drywall'], [2, 'Triplay']] },
      { k: 'piso', label: 'Piso de triplay', def: 1, choices: [[1, 'Sí'], [0, 'No']] }, fld('puertas', 'Puertas', 1), fld('ventanas', 'Ventanas', 1),
    ],
    prices: [pr('barrote', 'Barrote 2×4 (m)', 35), pr('duela', 'Duela (m²)', 380), pr('tabla', 'Tabla (m²)', 300), pr('triplay', 'Triplay (m²)', 165), pr('drywall', 'Drywall interior (m²)', 120), pr('teja', 'Teja asfáltica o lámina (m²)', 180), pr('imper', 'Impermeabilizante (m²)', 45), pr('tornilleria', 'Tornillería (por m²)', 10), pr('barniz', 'Barniz exterior (m²)', 35)],
    calc: (v, p) => {
      const per = 2 * (v.largo + v.ancho)
      const muros = Math.max(0, per * v.alto - v.puertas * 0.9 * 2.1 - v.ventanas * 1)
      const techo = v.largo * v.ancho * (v.techo === 2 ? 1.2 : 1.15)
      const barrotes = (up(per / 0.5) + 4) * v.alto + 2 * per + (up(v.largo / 0.6) + 1) * v.ancho * 1.1 + (v.piso ? (up(v.largo / 0.4) + 1) * v.ancho : 0)
      const forro = v.forro === 1 ? p.duela : v.forro === 2 ? p.tabla : p.triplay
      const lines = [line('Barrote 2×4', barrotes * 1.1, 'm', p.barrote), line('Forro exterior', muros * 1.1, 'm²', forro), line('Triplay de techo', techo, 'm²', p.triplay), line('Teja o lámina', techo, 'm²', p.teja), line('Impermeabilizante', techo, 'm²', p.imper)]
      if (v.interior === 1) lines.push(line('Drywall interior', muros, 'm²', p.drywall))
      if (v.interior === 2) lines.push(line('Triplay interior', muros, 'm²', p.triplay))
      if (v.piso) lines.push(line('Triplay de piso', v.largo * v.ancho * 1.1, 'm²', p.triplay))
      lines.push(line('Tornillería', muros + techo, 'm²', p.tornilleria), line('Barniz exterior', muros, 'm²', p.barniz))
      return { lines, hours: (muros + techo) * 0.8, notes: ['Es un estimado general: las puertas y ventanas cotízalas con sus servicios y ajusta el detalle a mano.'] }
    },
  },
  {
    key: 'electrica', name: 'Instalación eléctrica sencilla', desc: 'Contactos, apagadores y luces LED en un mueble o cuarto.',
    warning: 'Los trabajos mayores o las acometidas los hace un electricista con permiso; esto es para instalaciones ligeras dentro de un mueble o cuarto.',
    fields: [fld('contactos', 'Contactos', 4), fld('apagadores', 'Apagadores', 2), fld('lamparas', 'Lámparas', 2), fld('led', 'Tira LED', 0, 'm'), fld('cable', 'Cable', 30, 'm'), fld('poliducto', 'Poliducto', 20, 'm'), { k: 'centro', label: 'Centro de carga', def: 0, choices: [[0, 'No'], [1, 'Sí']] }],
    prices: [pr('caja', 'Caja o chalupa', 15), pr('placa', 'Placa', 35), pr('contacto', 'Contacto', 45), pr('apagador', 'Apagador', 40), pr('socket', 'Socket o base de lámpara', 60), pr('cable', 'Cable (m)', 12), pr('poliducto', 'Poliducto (m)', 6), pr('led', 'Tira LED (m)', 80), pr('fuente', 'Fuente para LED (cada 5 m)', 250), pr('centro', 'Centro de carga', 650)],
    calc: (v, p) => {
      const salidas = v.contactos + v.apagadores + v.lamparas
      const lines = [line('Caja o chalupa', salidas, 'pzas', p.caja), line('Placa', v.contactos + v.apagadores, 'pzas', p.placa), line('Contacto', v.contactos, 'pzas', p.contacto), line('Apagador', v.apagadores, 'pzas', p.apagador), line('Socket o base', v.lamparas, 'pzas', p.socket), line('Cable', v.cable, 'm', p.cable), line('Poliducto', v.poliducto, 'm', p.poliducto)]
      if (v.led > 0) lines.push(line('Tira LED', v.led, 'm', p.led), line('Fuente para LED', up(v.led / 5), 'pzas', p.fuente))
      if (v.centro) lines.push(line('Centro de carga', 1, 'pza', p.centro))
      return { lines: lines.filter((l) => l.qty > 0), hours: salidas * 0.6 + v.cable * 0.05 + v.led * 0.1, notes: [] }
    },
  },
  {
    key: 'instalacion', name: 'Instalación y flete', desc: 'Instalar, llevar y retirar muebles viejos; se suma a cualquier trabajo.',
    fields: [fld('piezas', 'Muebles a instalar', 1), fld('km', 'Distancia del flete', 10, 'km'), { k: 'retirar', label: 'Desinstalar y retirar uno viejo', def: 0, choices: [[0, 'No'], [1, 'Sí']] }],
    prices: [pr('flete', 'Flete por km (ida y vuelta)', 7), pr('retiro', 'Horas por retirar un mueble viejo', 2)],
    calc: (v, p, cfg) => ({
      lines: [line('Flete', v.km, 'km', p.flete)].filter((l) => l.qty > 0),
      hours: v.piezas * cfg.hInst + (v.retirar ? p.retiro : 0),
      notes: ['Las horas de instalación por mueble salen de Mis costos → Bases.'],
    }),
  },
]

export const serviceOf = (key: string) => SERVICES.find((s) => s.key === key) ?? SERVICES[0]
export const serviceDefaults = (s: Service) => Object.fromEntries(s.fields.map((f) => [f.k, f.def]))
export const servicePrices = (s: Service, conf?: ServConfig) => ({ ...Object.fromEntries(s.prices.map((p) => [p.k, p.def])), ...conf?.p?.[s.key] })
export const isOn = (key: string, conf?: ServConfig) => !!conf?.on?.includes(key)

export type ServResult = SCalc & { material: number }

export function calcService(st: ServState, cfg: QuoterConfig, conf?: ServConfig): ServResult {
  const s = serviceOf(st.key)
  const c = s.calc({ ...serviceDefaults(s), ...st.values }, servicePrices(s, conf), cfg)
  return { ...c, material: c.lines.reduce((a, l) => a + l.qty * l.price, 0) }
}

export function serviceTitle(st: ServState): string {
  const s = serviceOf(st.key)
  const v = { ...serviceDefaults(s), ...st.values }
  const tipo = s.fields.find((f) => f.k === 'tipo')?.choices?.find(([n]) => n === v.tipo)?.[1]
  const main = s.fields.filter((f) => f.unit && f.unit !== '$' && v[f.k] > 0).slice(0, 2).map((f) => `${v[f.k]} ${f.unit}`).join(' × ')
  return [tipo ?? s.name, main].filter(Boolean).join(' · ')
}

export function materialText(st: ServState, r: ServResult): string {
  return [`*Material: ${serviceTitle(st)}*`, ...r.lines.map((l) => `• ${l.qty} ${l.unit} — ${l.n}`), ...(r.days ? [`Curado o secado: ~${r.days} días`] : [])].join('\n')
}
