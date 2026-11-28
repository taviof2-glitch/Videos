import { useState } from 'react'
import { Link2, ListChecks } from 'lucide-react'
import { formatMoney, parseMoney } from '../data/money'
import { chooseOption, defaultOptions, ensureShareToken, quoteLink, saveOptions } from '../data/quoteOptions'
import { whatsappLink } from '../data/reminder'
import type { Business, Contact, Quote } from '../data/types'

const toInput = (c: number) => (c / 100).toFixed(2)

/** Opciones para el cliente (Básica, Media, Premium) y el enlace para que vea y acepte la cotización. */
export default function QuoteExtras({ business, quote, contact }: { business: Business; quote: Quote; contact?: Contact }) {
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState(() => (quote.options ?? defaultOptions(quote.totalCents)).map((o) => ({ ...o, price: toInput(o.priceCents) })))
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const money = (c: number) => formatMoney(c, business.currency)
  const open = quote.status === 'pending' || quote.status === 'accepted'
  const chosen = quote.chosenOption !== undefined ? quote.options?.[quote.chosenOption] : undefined
  const run = (p: Promise<unknown>, ok: string) => { setErr(''); setMsg(''); void p.then(() => setMsg(ok), (e) => setErr(e instanceof Error ? e.message : 'No se pudo')) }

  async function share() {
    const token = await ensureShareToken(quote)
    const url = quoteLink(token)
    const name = contact?.name.split(' ')[0] ?? ''
    const text = `Hola${name ? ` ${name}` : ''}, aquí está su cotización de ${business.name}${quote.options?.length ? ' con las opciones' : ''}. Desde el enlace puede aceptarla y ver los datos para el anticipo: ${url}`
    window.open(whatsappLink(text, contact?.phone ?? '', business.country), '_blank', 'noopener')
    setMsg(`Enlace: ${url}`)
  }

  return (
    <>
      {chosen && (
        <section className="note-box">
          ✅ {quote.acceptedOnline ? 'El cliente aceptó desde el enlace' : 'El cliente eligió'}: <strong>{chosen.name} · {money(chosen.priceCents)}</strong>.
          {!quote.optionApplied && open && <> <button type="button" className="link" onClick={() => run(chooseOption(quote.id, quote.chosenOption!), 'Listo: la cotización ya tiene el precio de esa opción.')}>Poner ese precio en la cotización</button></>}
        </section>
      )}
      {open && (
        <section className="card form">
          <h2><ListChecks className="i-inline" aria-hidden /> Opciones para el cliente</h2>
          {!editing && !quote.options?.length && <p className="muted">Ofrece 3 opciones (básica, media y premium): el cliente escoge y casi siempre se va por la de en medio.</p>}
          {!editing && quote.options?.length ? (
            <ul className="moves">
              {quote.options.map((o, i) => (
                <li key={i}>
                  <span><strong>{o.name}</strong> · {money(o.priceCents)}<small className="muted"> · {o.desc}</small></span>
                  <button type="button" className={`btn small ${quote.chosenOption === i ? 'primary' : 'ghost'}`} onClick={() => run(chooseOption(quote.id, i), `Listo: eligió ${o.name}; la cotización quedó en ${money(o.priceCents)}.`)}>{quote.chosenOption === i ? 'Elegida' : 'Eligió esta'}</button>
                </li>
              ))}
            </ul>
          ) : null}
          {editing ? (
            <>
              {rows.map((r, i) => (
                <div key={i} className="option-row">
                  <div className="two">
                    <label>Nombre<input value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></label>
                    <label>Precio total<input value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} inputMode="decimal" /></label>
                  </div>
                  <label>Qué incluye<input value={r.desc} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} /></label>
                </div>
              ))}
              <div className="quick">
                <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancelar</button>
                <button type="button" className="btn primary" onClick={() => { run(saveOptions(quote.id, rows.map((r) => ({ name: r.name, desc: r.desc, priceCents: parseMoney(r.price) ?? 0 }))), 'Opciones guardadas: ya salen en la cotización que mandas.'); setEditing(false) }}>Guardar opciones</button>
              </div>
            </>
          ) : (
            <div className="quick">
              <button type="button" className="btn ghost" onClick={() => setEditing(true)}>{quote.options?.length ? 'Cambiar opciones' : 'Agregar 3 opciones'}</button>
              {quote.options?.length ? <button type="button" className="btn ghost" onClick={() => run(saveOptions(quote.id, undefined), 'Opciones quitadas.')}>Quitar opciones</button> : null}
            </div>
          )}
        </section>
      )}
      {quote.status === 'pending' && (
        <section className="card form">
          <h2><Link2 className="i-inline" aria-hidden /> Enlace para aceptar</h2>
          <p className="muted">El cliente ve la cotización{quote.options?.length ? ', escoge su opción' : ''} y toca «Acepto»; también ve tus datos de pago. Te llega un aviso y aquí queda «Aceptada». Solo se manda cuando tú lo compartes.</p>
          <button type="button" className="btn sale" onClick={() => void share()}>Mandar enlace por WhatsApp</button>
          {!business.payInfo?.clabe && <small className="muted">Pon tu CLABE en «Datos del negocio» para que salga en el enlace y en la cotización.</small>}
        </section>
      )}
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
    </>
  )
}
