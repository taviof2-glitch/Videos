import { useState } from 'react'
import { ensureLeadToken, estimateRange, LEAD_TYPES, leadPricesOf, leadUrl, saveLeadPrices } from '../data/leads'
import { formatMoney, parseMoney } from '../data/money'
import type { Business } from '../data/types'

/** Cotizador en línea: precio por metro de cada tipo de mueble y el enlace para poner en Facebook, Instagram o WhatsApp. */
export default function LeadCard({ business }: { business: Business }) {
  const prices = leadPricesOf(business)
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(LEAD_TYPES.map(([k]) => [k, String(prices[k] / 100)])))
  const [url, setUrl] = useState(business.leadToken ? leadUrl(business.leadToken) : '')
  const [msg, setMsg] = useState('')
  const save = () => void saveLeadPrices(business.id, Object.fromEntries(LEAD_TYPES.map(([k]) => [k, parseMoney(text[k]) ?? prices[k]])))
  async function link(action: 'copy' | 'share') {
    const u = url || leadUrl(await ensureLeadToken(business))
    setUrl(u)
    if (action === 'share' && navigator.share) await navigator.share({ title: `Cotiza con ${business.name}`, text: `Cotiza tu mueble a la medida con ${business.name}:`, url: u }).catch(() => undefined)
    else { await navigator.clipboard?.writeText(u).catch(() => undefined); setMsg('Enlace copiado.') }
  }
  return (
    <section className="card form">
      <h2>Cotizador en línea para clientes</h2>
      <p className="muted">El cliente elige el mueble y los metros, ve un precio aproximado (±15 %) y te deja su nombre y WhatsApp. Te llega a Pedidos con aviso al teléfono.</p>
      {LEAD_TYPES.map(([k, label]) => (
        <label key={k}>{label} <small className="muted">por metro</small><input value={text[k]} onChange={(e) => setText({ ...text, [k]: e.target.value })} onBlur={save} inputMode="decimal" /></label>
      ))}
      <small className="muted">Ej.: closet de 2 m a {formatMoney(prices.closet * 2, business.currency)} → el cliente ve de {formatMoney(estimateRange(prices.closet, 2)[0], business.currency)} a {formatMoney(estimateRange(prices.closet, 2)[1], business.currency)}.</small>
      {url && <p className="note-box" style={{ wordBreak: 'break-all' }}>{url}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" onClick={() => void link('copy')}>Copiar enlace</button>
        <button type="button" className="btn primary" onClick={() => void link('share')}>Compartir</button>
      </div>
      {msg && <p className="success" role="status">{msg}</p>}
    </section>
  )
}
