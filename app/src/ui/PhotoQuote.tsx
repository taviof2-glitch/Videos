import { useState } from 'react'
import { Camera, Sparkles } from 'lucide-react'
import { defaultValues, templateOf, TEMPLATES, type BaseState } from '../data/bases'
import { analyzeFurniture, type FurnitureGuess } from '../sync/assistant'
import { BOARD_WOOD_LABEL, type BoardSpec } from '../data/quoter'

/** La tabla de picar va en la lista del asistente como un «mueble» más; su respuesta se pasa a Cotizar → Tabla de picar. */
const BOARD_ITEM = { key: 'tabla_picar', name: 'Tabla de picar de madera maciza (también redonda o con mango)', group: 'Madera', fields: [
  { k: 'madera', label: 'Madera', def: 1, choices: [[1, 'pino'], [2, 'parota'], [3, 'cedro']] as [number, string][] },
  { k: 'ancho', label: 'Ancho del cuerpo (mm)', def: 250 }, { k: 'largo', label: 'Largo del cuerpo sin mango (mm)', def: 350 },
  { k: 'redonda', label: 'Redonda u ovalada', def: 0, choices: [[0, 'no'], [1, 'sí']] as [number, string][] },
  { k: 'mango', label: 'Con mango', def: 0, choices: [[0, 'no'], [1, 'sí']] as [number, string][] },
  { k: 'mangoLargo', label: 'Largo del mango (mm)', def: 120 }, { k: 'piezas', label: 'Cuántas piezas', def: 1 },
] }

/** De lo que regresa el asistente (mm) a la tabla del cotizador (cm). */
export function boardFromGuess(v: Record<string, number>): { board: BoardSpec; q: number } {
  const cm = (mm: number | undefined, def: number) => (mm && mm > 0 ? Math.round(mm) / 10 : def)
  const madera = v.madera === 2 ? 'parota' : v.madera === 3 ? 'cedro' : 'pino'
  const a = cm(v.ancho, 25), l = cm(v.largo, 35)
  return { board: { madera, ancho: Math.min(a, l), largo: Math.max(a, l), redonda: v.redonda === 1, mango: v.mango === 1, mangoLargo: cm(v.mangoLargo, 12) }, q: Math.max(1, Math.round(v.piezas || 1)) }
}
import { shrinkPhoto } from './photoShrink'

const shrink = (file: File) => shrinkPhoto(file)

const CONF: Record<FurnitureGuess['confidence'], string> = { alta: 'Confianza alta', media: 'Confianza media: revisa las medidas', baja: 'Confianza baja: casi todo es estimado, revisa todo' }

/** Cotizar desde una foto: el asistente elige el mueble de Bases y llena sus medidas; la app saca despiece y precio. */
export default function PhotoQuote({ state, onApply, onBoard, onlyBoards }: { state?: BaseState; onApply?: (s: BaseState) => void; onBoard?: (b: BoardSpec, q: number) => void; onlyBoards?: boolean }) {
  const [photo, setPhoto] = useState<{ data: string; preview: string }>()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [guess, setGuess] = useState<FurnitureGuess>()

  async function analyze() {
    setBusy(true)
    setError('')
    setGuess(undefined)
    try {
      const furniture = onlyBoards ? [] : TEMPLATES.filter((t) => t.key !== 'cocina').map((t) => ({ key: t.key, name: t.name, group: t.group, fields: t.fields.map((f) => ({ k: f.k, label: f.label, def: f.def, ...(f.choices && { choices: f.choices }) })) }))
      const catalog = onBoard ? [...furniture, BOARD_ITEM] : furniture
      const g = await analyzeFurniture({ ...(photo && { image: photo.data, mediaType: 'image/jpeg' }), text, catalog })
      if (g.key === BOARD_ITEM.key && onBoard) {
        const { board, q } = boardFromGuess(g.values)
        onBoard(board, q)
        setGuess({ ...g, explanation: `${BOARD_WOOD_LABEL[board.madera]}, ${board.ancho} × ${board.largo} cm${board.mango ? ` + mango de ${board.mangoLargo} cm` : ''}${board.redonda ? ', redonda' : ''}${q > 1 ? `, ${q} piezas` : ''}. ${g.explanation}` })
      } else if (state && onApply) {
        const t = templateOf(g.key)
        onApply({ key: t.key, values: { ...defaultValues(t), ...g.values }, opts: { ...state.opts, fondo: t.fondo, cubierta: false } })
        setGuess(g)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo analizar la foto')
    }
    setBusy(false)
  }

  return (
    <details className="card photo-quote">
      <summary><Sparkles className="i-inline" aria-hidden /> <strong>Cotizar desde una foto</strong> <small className="muted">· con el asistente</small></summary>
      <div className="form">
        <p className="muted">{onlyBoards ? 'Toma o elige la foto de la tabla y escribe las medidas o la madera si las sabes. El asistente reconoce la madera, si es redonda y si lleva mango, y llena la tabla.' : 'Toma o elige la foto del mueble (o de una tabla de picar) y escribe las medidas que tengas.'}</p>
        <label className="btn ghost photo-add">
          <Camera className="i-inline" aria-hidden /> {photo ? 'Cambiar foto' : 'Tomar o elegir foto'}
          <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void shrink(f).then(setPhoto, (err) => setError(err instanceof Error ? err.message : 'No se pudo leer la foto')) }} />
        </label>
        {photo && <img src={photo.preview} alt="Foto del mueble" className="photo-quote-img" />}
        <label>
          Medidas y detalles
          <textarea rows={3} value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} placeholder="Ej. 90 de ancho, 2.10 de alto, 50 de fondo, sin puertas, 2 tubos" />
        </label>
        <button type="button" className="btn primary" disabled={busy || (!photo && !text.trim())} onClick={() => void analyze()}>{busy ? 'Analizando…' : 'Analizar y cotizar'}</button>
        {error && <p className="error" role="alert">{error}</p>}
        {guess && (
          <div className="note-box" role="status">
            <strong>{guess.key === BOARD_ITEM.key ? 'Tabla de picar (ya está en Cotizar)' : templateOf(guess.key).name}.</strong> {guess.explanation}
            {guess.assumptions.length > 0 && <ul>{guess.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>}
            <small className="muted">{CONF[guess.confidence]}. Puedes corregir cualquier medida abajo.</small>
          </div>
        )}
      </div>
    </details>
  )
}
