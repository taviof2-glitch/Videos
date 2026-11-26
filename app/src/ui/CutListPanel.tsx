import { useMemo, useState } from 'react'
import { cutListText, DEFAULT_SPECS, furnitureLabels, KIND_LABEL, pack, projectPieces, SHEET, type CutSpec, type FurnitureKind, type Material, type Piece, type SheetLayout } from '../data/cutlist'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'
import MedFields, { medForm, medSpec, type MedForm } from './MedFields'
import Sketch from './Sketch'

const num = (s: string) => Math.max(0, parseFloat(s) || 0)
type Item = { kind: FurnitureKind; f: MedForm }
const toItem = (s: CutSpec): Item => ({ kind: s.kind, f: medForm(s) })
const toSpec = (it: Item, grosor: number): CutSpec => medSpec(it.kind, it.f, grosor)

const MATERIALS: [Material, (grosor: number) => string][] = [
  ['melamina', (g) => `Melamina de ${g} mm`],
  ['fondo', () => 'Fondo de 3 mm'],
]

/**
 * Despiece de un proyecto: uno o varios muebles, con las piezas por cortar y cómo acomodarlas
 * todas juntas en hojas de 2.44 × 1.22 m.
 */
export default function CutListPanel({ business, initial, initialMore, initialGirar, onSave }: {
  business: Business
  initial?: Partial<CutSpec>
  /** Los demás muebles del proyecto (de una cotización guardada). */
  initialMore?: CutSpec[]
  initialGirar?: boolean
  /** Si hay una cotización abierta: guarda este despiece en ella. */
  onSave?: (specs: CutSpec[], girar: boolean) => Promise<void>
}) {
  const [items, setItems] = useState<Item[]>(() => [toItem({ ...DEFAULT_SPECS[initial?.kind ?? 'escritorio'], ...initial }), ...(initialMore ?? []).map(toItem)])
  const [sel, setSel] = useState(0)
  const [grosor, setGrosor] = useState(String(initial?.grosor ?? 16))
  const [girar, setGirar] = useState(initialGirar ?? true)
  const [msg, setMsg] = useState('')

  const g = num(grosor) || 16
  const specs = useMemo(() => items.map((it) => toSpec(it, g)), [items, g])
  const labels = furnitureLabels(specs)
  const cur = items[Math.min(sel, items.length - 1)]
  const idx = items.indexOf(cur)
  const hasPieces = projectPieces(specs).length > 0
  const patch = (fn: (it: Item) => Item) => { setItems(items.map((it, i) => (i === idx ? fn(it) : it))); setMsg('') }

  return (
    <>
      <section className="card form">
        <div className="proj-chips" role="tablist" aria-label="Muebles del proyecto">
          {items.map((_, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === idx} className={`chip ${i === idx ? 'on' : ''}`} onClick={() => setSel(i)}>{i + 1}. {labels[i]}</button>
          ))}
          <button type="button" className="chip" onClick={() => { setItems([...items, toItem(DEFAULT_SPECS.bajo)]); setSel(items.length); setMsg('') }}>+ Agregar mueble</button>
        </div>
        {items.length > 1 && <p className="muted">Las piezas de los {items.length} muebles se acomodan juntas en las mismas hojas.</p>}
        <label>
          ¿Qué mueble es?
          <select value={cur.kind} onChange={(e) => { const k = e.target.value as FurnitureKind; patch(() => toItem(DEFAULT_SPECS[k])) }}>
            {(Object.keys(KIND_LABEL) as FurnitureKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <MedFields kind={cur.kind} form={cur.f} onChange={(f) => patch((it) => ({ ...it, f }))} />
        <Sketch spec={specs[idx]} />
        {items.length > 1 && (
          <button type="button" className="btn danger-text" onClick={() => { setItems(items.filter((_, i) => i !== idx)); setSel(Math.max(0, idx - 1)); setMsg('') }}>Quitar este mueble del proyecto</button>
        )}
        <div className="two">
          <label>
            Grosor de la melamina (mm)
            <input value={grosor} onChange={(e) => { setGrosor(e.target.value); setMsg('') }} inputMode="numeric" />
          </label>
        </div>
        <label className="check"><input type="checkbox" checked={!girar} onChange={(e) => { setGirar(!e.target.checked); setMsg('') }} /><span>Respetar la veta (no girar piezas)</span></label>
      </section>

      <CutListResults business={business} specs={specs} girar={girar} />
      {onSave && hasPieces && (
        <button type="button" className="btn primary" onClick={() => void onSave(specs, girar).then(() => setMsg(`Despiece guardado en la cotización${specs.length > 1 ? ` (${specs.length} muebles)` : ''}.`), (e) => setMsg(e instanceof Error ? e.message : 'No se pudo guardar'))}>Guardar despiece en la cotización</button>
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
export function CutListResults({ business, specs, girar, pieces: saved }: { business: Business; specs: CutSpec[]; girar: boolean; /** Piezas guardadas; si no, se calculan de las medidas. */ pieces?: Piece[] }) {
  const [msg, setMsg] = useState('')
  const pieces = useMemo(() => saved ?? projectPieces(specs), [saved, JSON.stringify(specs)]) // eslint-disable-line react-hooks/exhaustive-deps
  const text = cutListText(specs, girar, saved)
  const grosor = specs[0]?.grosor ?? 16

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
                <h2>{label(grosor)}</h2>
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

      {pieces.some((p) => p.material === 'tubo') && (
        <section className="card">
          <h2>Tubos</h2>
          <table className="cut-table">
            <thead><tr><th>Cant.</th><th>Pieza</th><th>Largo</th><th></th></tr></thead>
            <tbody>
              {pieces.filter((p) => p.material === 'tubo').map((p) => <tr key={p.name}><td>{p.qty}</td><td>{p.name}</td><td>{p.largo}</td><td></td></tr>)}
            </tbody>
          </table>
        </section>
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
