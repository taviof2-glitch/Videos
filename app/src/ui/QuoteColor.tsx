import { useState } from 'react'
import { listSwatches, setQuoteColor } from '../data/swatches'
import type { Business, Quote } from '../data/types'

/** Color o acabado que escogió el cliente (del muestrario o escrito). Sale también en la obra. */
export default function QuoteColor({ business, quote }: { business: Business; quote: Quote }) {
  const list = listSwatches(business)
  const [text, setText] = useState(quote.color ?? '')
  return (
    <section className="card form">
      <h2>Color que escogió</h2>
      {list.length > 0 && (
        <div className="chips wrap" role="group" aria-label="Color del muestrario">
          {list.map((s) => <button key={s.id} type="button" className={`chip ${quote.color === s.name ? 'on' : ''}`} aria-pressed={quote.color === s.name} onClick={() => { setText(s.name); void setQuoteColor(quote.id, quote.color === s.name ? '' : s.name) }}>{s.photo && <img src={s.photo} alt="" className="swatch" style={{ objectFit: 'cover' }} />}{s.name}</button>)}
        </div>
      )}
      <label>Color o acabado<input value={text} onChange={(e) => setText(e.target.value)} onBlur={() => void setQuoteColor(quote.id, text)} placeholder={list.length ? 'O escríbelo' : 'Ej. Nogal Tzalam (agrega fotos en Material → Muestrario)'} /></label>
    </section>
  )
}
