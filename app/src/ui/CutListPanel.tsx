import { useMemo, useState } from 'react'
import { cutList, cutListText, DEFAULT_SPECS, KIND_LABEL, pack, SHEET, type CutSpec, type FurnitureKind, type Material, type Piece, type SheetLayout } from '../data/cutlist'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'

const num = (s: string) => Math.max(0, parseFloat(s) || 0)
type Form = Record<'largo' | 'alto' | 'fondo' | 'puertas' | 'cajones' | 'entrepanos' | 'divisiones' | 'grosor', string>
const toForm = (s: CutSpec): Form => ({ largo: String(s.largo), alto: String(s.alto), fondo: String(s.fondo), puertas: String(s.puertas), cajones: String(s.cajones), entrepanos: String(s.entrepanos), divisiones: String(s.divisiones), grosor: String(s.grosor) })

const MATERIALS: [Material, (grosor: number) => string][] = [
  ['melamina', (g) => `Melamina de ${g} mm`],
  ['fondo', () => 'Fondo de 3 mm'],
]

/** Despiece de un mueble: piezas por cortar y cómo acomodarlas en hojas de 2.44 × 1.22 m. */
export default function CutListPanel({ business, initial, initialGirar, onSave }: { business: Business; initial?: Partial<CutSpec>; initialGirar?: boolean; /** Si hay una cotización abierta: guarda este despiece en ella. */ onSave?: (spec: CutSpec, girar: boolean) => Promise<void> }) {
  const [kind, setKind] = useState<FurnitureKind>(initial?.kind ?? 'escritorio')
  const [f, setF] = useState<Form>(() => toForm({ ...DEFAULT_SPECS[initial?.kind ?? 'escritorio'], ...initial }))
  const [girar, setGirar] = useState(initialGirar ?? true)
  const [msg, setMsg] = useState('')

  const spec: CutSpec = { kind, largo: num(f.largo), alto: num(f.alto), fondo: num(f.fondo), puertas: num(f.puertas), cajones: num(f.cajones), entrepanos: num(f.entrepanos), divisiones: num(f.divisiones), grosor: num(f.grosor) || 16 }
  const pieces = useMemo(() => cutList(spec), [kind, f]) // eslint-disable-line react-hooks/exhaustive-deps
  const desk = kind === 'escritorio'
  const field = (k: keyof Form, label: string, mode: 'decimal' | 'numeric' = 'numeric') => (
    <label>
      {label}
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} inputMode={mode} />
    </label>
  )

  return (
    <>
      <section className="card form">
        <label>
          ¿Qué mueble es?
          <select value={kind} onChange={(e) => { const k = e.target.value as FurnitureKind; setKind(k); setF(toForm(DEFAULT_SPECS[k])); setMsg('') }}>
            {(Object.keys(KIND_LABEL) as FurnitureKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <fieldset className="desk-box">
          <legend>Medidas <small className="muted">(cm)</small></legend>
          <div className="three">
            {field('largo', 'Largo', 'decimal')}
            {field('alto', 'Alto', 'decimal')}
            {field('fondo', 'Fondo', 'decimal')}
          </div>
        </fieldset>
        <div className="two">
          {!desk && field('puertas', 'Puertas')}
          {field('cajones', 'Cajones')}
          {!desk && field('entrepanos', 'Entrepaños')}
          {!desk && field('divisiones', 'Divisiones verticales')}
          {field('grosor', 'Grosor de la melamina (mm)')}
        </div>
        <label className="check"><input type="checkbox" checked={!girar} onChange={(e) => setGirar(!e.target.checked)} /><span>Respetar la veta (no girar piezas)</span></label>
      </section>

      <CutListResults business={business} spec={spec} girar={girar} />
      {onSave && pieces.length > 0 && (
        <>
          <button type="button" className="btn primary" onClick={() => void onSave(spec, girar).then(() => setMsg('Despiece guardado en la cotización.'), (e) => setMsg(e instanceof Error ? e.message : 'No se pudo guardar'))}>Guardar despiece en la cotización</button>
        </>
      )}
      {msg && <p className="success" role="status">{msg}</p>}
    </>
  )
}

/** El dibujo de una hoja con sus piezas. Las piezas se numeran y la lista de abajo dice cuál es cuál. */
function Sheet({ layout, index, total }: { layout: SheetLayout; index: number; total: number }) {
  return (
    <figure className="cut-sheet">
      <figcaption>Hoja {index} de {total} · {layout.usedPct} % aprovechado</figcaption>
      <svg viewBox={`-1 -1 ${SHEET.largo + 2} ${SHEET.ancho + 2}`} role="img" aria-label={`Acomodo de la hoja ${index}: ${layout.pieces.length} piezas`}>
        <rect x="0" y="0" width={SHEET.largo} height={SHEET.ancho} className="cut-board" />
        {layout.pieces.map((p, i) => {
          const small = Math.min(p.w, p.h) < 16 || Math.max(p.w, p.h) < 40
          return (
            <g key={i}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} className="cut-piece" />
              <text x={p.x + p.w / 2} y={p.y + p.h / 2} className={small ? 'cut-label small' : 'cut-label'} textAnchor="middle" dominantBaseline="central">
                {small ? i + 1 : `${i + 1} · ${p.w}×${p.h}`}
              </text>
            </g>
          )
        })}
      </svg>
      <ol className="cut-legend">
        {layout.pieces.map((p, i) => <li key={i}>{p.name} <small className="muted">{p.w} × {p.h}</small></li>)}
      </ol>
    </figure>
  )
}

/** La lista de piezas y el acomodo en hojas (también se usa para ver el despiece guardado en una cotización). */
export function CutListResults({ business, spec, girar, pieces: saved }: { business: Business; spec: CutSpec; girar: boolean; /** Piezas guardadas; si no, se calculan de las medidas. */ pieces?: Piece[] }) {
  const [msg, setMsg] = useState('')
  const pieces = useMemo(() => saved ?? cutList(spec), [saved, JSON.stringify(spec)]) // eslint-disable-line react-hooks/exhaustive-deps
  const text = cutListText(spec, girar, saved)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setMsg('Lista copiada.')
    } catch {
      setMsg('No se pudo copiar. Usa el botón de WhatsApp.')
    }
  }

  return (
    <>
      {pieces.length === 0 ? (
        <p className="muted">Escribe las medidas del mueble para ver sus piezas.</p>
      ) : (
        MATERIALS.map(([material, label]) => {
          const mine = pieces.filter((p) => p.material === material)
          if (!mine.length) return null
          const { sheets, tooBig } = pack(pieces, material, girar)
          return (
            <section className="card" key={material}>
              <div className="row-between">
                <h2>{label(spec.grosor)}</h2>
                <strong>{sheets.length} {sheets.length === 1 ? 'hoja' : 'hojas'}</strong>
              </div>
              <table className="cut-table">
                <thead><tr><th>Cant.</th><th>Pieza</th><th>Largo</th><th>Ancho</th></tr></thead>
                <tbody>
                  {mine.map((p) => (
                    <tr key={p.name}><td>{p.qty}</td><td>{p.name}</td><td>{p.largo}</td><td>{p.ancho}</td></tr>
                  ))}
                </tbody>
              </table>
              {tooBig.map((p) => <p className="note-box bad" key={p.name}>{p.name} ({p.largo} × {p.ancho} cm) no cabe en una hoja de 244 × 122: hay que unir dos piezas.</p>)}
              {sheets.map((s, i) => <Sheet key={i} layout={s} index={i + 1} total={sheets.length} />)}
            </section>
          )
        })
      )}

      {pieces.length > 0 && (
        <>
          <p className="muted">Medidas en centímetros, hojas de 244 × 122 cm y 4 mm de disco entre cortes. Es una guía: revisa las medidas contra tu herraje (correderas, bisagras) antes de cortar.</p>
          <div className="quoter-actions">
            <a className="btn sale" href={whatsappLink(text, '', business.country)} target="_blank" rel="noopener noreferrer">Enviar lista por WhatsApp</a>
            <button type="button" className="btn ghost" onClick={() => void copy()}>Copiar lista</button>
          </div>
          {msg && <p className="success" role="status">{msg}</p>}
        </>
      )}
    </>
  )
}
