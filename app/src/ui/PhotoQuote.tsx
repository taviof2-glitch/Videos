import { useState } from 'react'
import { Camera, Sparkles } from 'lucide-react'
import { defaultValues, templateOf, TEMPLATES, type BaseState } from '../data/bases'
import { analyzeFurniture, type FurnitureGuess } from '../sync/assistant'

/** Reduce la foto a 1280 px por lado y la pasa a JPEG (base64 sin encabezado) para mandarla ligera. */
async function shrink(file: File): Promise<{ data: string; preview: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('No se pudo leer la foto')); img.src = url })
    const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * k)
    canvas.height = Math.round(img.naturalHeight * k)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const preview = canvas.toDataURL('image/jpeg', 0.82)
    return { data: preview.split(',')[1], preview }
  } finally {
    URL.revokeObjectURL(url)
  }
}

const CONF: Record<FurnitureGuess['confidence'], string> = { alta: 'Confianza alta', media: 'Confianza media: revisa las medidas', baja: 'Confianza baja: casi todo es estimado, revisa todo' }

/** Cotizar desde una foto: el asistente elige el mueble de Bases y llena sus medidas; la app saca despiece y precio. */
export default function PhotoQuote({ state, onApply }: { state: BaseState; onApply: (s: BaseState) => void }) {
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
      const catalog = TEMPLATES.filter((t) => t.key !== 'cocina').map((t) => ({ key: t.key, name: t.name, group: t.group, fields: t.fields.map((f) => ({ k: f.k, label: f.label, def: f.def, ...(f.choices && { choices: f.choices }) })) }))
      const g = await analyzeFurniture({ ...(photo && { image: photo.data, mediaType: 'image/jpeg' }), text, catalog })
      const t = templateOf(g.key)
      onApply({ key: t.key, values: { ...defaultValues(t), ...g.values }, opts: { ...state.opts, fondo: t.fondo, cubierta: false } })
      setGuess(g)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo analizar la foto')
    }
    setBusy(false)
  }

  return (
    <details className="card photo-quote">
      <summary><Sparkles className="i-inline" aria-hidden /> <strong>Cotizar desde una foto</strong> <small className="muted">· con el asistente</small></summary>
      <div className="form">
        <p className="muted">Toma o elige la foto del mueble y escribe las medidas que tengas. El asistente elige el mueble más parecido y llena sus medidas; abajo salen el despiece, el acomodo y el precio con tus costos.</p>
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
            <strong>{templateOf(guess.key).name}.</strong> {guess.explanation}
            {guess.assumptions.length > 0 && <ul>{guess.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>}
            <small className="muted">{CONF[guess.confidence]}. Puedes corregir cualquier medida abajo.</small>
          </div>
        )}
      </div>
    </details>
  )
}
