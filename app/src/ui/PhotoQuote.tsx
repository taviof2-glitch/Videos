import { useState } from 'react'
import { Camera, Sparkles } from 'lucide-react'
import type { BaseOpts } from '../data/bases'
import { photoCatalog, photoIntent, type PhotoIntent } from '../data/photoCatalog'
import type { Business, Product } from '../data/types'
import { analyzeFurniture, type FurnitureGuess } from '../sync/assistant'
import { shrinkPhoto } from './photoShrink'

const CONF: Record<FurnitureGuess['confidence'], string> = { alta: 'Confianza alta', media: 'Confianza media: revisa las medidas', baja: 'Confianza baja: casi todo es estimado, revisa todo' }
const WHERE: Record<PhotoIntent['kind'], string> = { base: 'ya está en Bases', board: 'ya está en Cotizar', cotizar: 'ya está en Cotizar', serv: 'ya está en Servicios', product: 'producto de tu inventario' }

/**
 * Cotizar desde una foto, de todo: el asistente reconoce si es un mueble de Bases, una tabla de picar, un trabajo de
 * Cotizar (closet, cocina, escritorio…), un servicio de obra o un producto del inventario, y la app abre lo que corresponde.
 */
export default function PhotoQuote({ business, products, baseOpts, onIntent }: { business: Business; products: Product[]; baseOpts: BaseOpts; onIntent: (i: PhotoIntent) => void }) {
  const [photo, setPhoto] = useState<{ data: string; preview: string }>()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [guess, setGuess] = useState<FurnitureGuess & { intent: PhotoIntent }>()

  async function analyze() {
    setBusy(true)
    setError('')
    setGuess(undefined)
    try {
      const g = await analyzeFurniture({ ...(photo && { image: photo.data, mediaType: 'image/jpeg' }), text, catalog: photoCatalog(business, products) })
      const intent = photoIntent(g, business, products, baseOpts)
      if (!intent) throw new Error('El asistente eligió algo que ya no está en la lista. Intenta de nuevo.')
      onIntent(intent)
      setGuess({ ...g, intent })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo analizar la foto')
    }
    setBusy(false)
  }

  return (
    <details className="card photo-quote">
      <summary><Sparkles className="i-inline" aria-hidden /> <strong>Cotizar desde una foto</strong> <small className="muted">· con el asistente</small></summary>
      <div className="form">
        <p className="muted">Toma o elige la foto y escribe las medidas o detalles que tengas. El asistente reconoce qué es (mueble, closet, cocina, escritorio, tabla de picar, trabajo de obra o un producto tuyo) y abre su cotización ya llena.</p>
        <label className="btn ghost photo-add">
          <Camera className="i-inline" aria-hidden /> {photo ? 'Cambiar foto' : 'Tomar o elegir foto'}
          <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void shrinkPhoto(f).then(setPhoto, (err) => setError(err instanceof Error ? err.message : 'No se pudo leer la foto')) }} />
        </label>
        {photo && <img src={photo.preview} alt="Foto para cotizar" className="photo-quote-img" />}
        <label>
          Medidas y detalles
          <textarea rows={3} value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} placeholder="Ej. closet de 2.40 de ancho con corredizas · 20 tablas de parota de 30 × 45 · muro de tablaroca de 4 × 2.40" />
        </label>
        <button type="button" className="btn primary" disabled={busy || (!photo && !text.trim())} onClick={() => void analyze()}>{busy ? 'Analizando…' : 'Analizar y cotizar'}</button>
        {error && <p className="error" role="alert">{error}</p>}
        {guess && (
          <div className="note-box" role="status">
            <strong>{guess.intent.label} ({WHERE[guess.intent.kind]}).</strong> {guess.explanation}
            {guess.assumptions.length > 0 && <ul>{guess.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>}
            <small className="muted">{CONF[guess.confidence]}. Puedes corregir cualquier dato.</small>
          </div>
        )}
      </div>
    </details>
  )
}
