import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import { CAMPAIGNS, campaignSent, campaignTargets, fillCampaign, markCampaignSent } from '../data/campaigns'
import { listContacts } from '../data/contacts'
import { formatMoney } from '../data/money'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'
import { formatDateTime } from '../ui/forms'

/** Campañas de temporada: un mensaje para los clientes que ya compraron; se manda uno por uno al tocar «WhatsApp». */
export default function Campaigns({ business }: { business: Business }) {
  const [key, setKey] = useState(CAMPAIGNS[0].key)
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(CAMPAIGNS.map((c) => [c.key, c.text])))
  const [months, setMonths] = useState<number | undefined>(24)
  const targets = useLiveQuery(async () => campaignTargets(business.id, await listContacts(business.id, 'customer'), months), [business.id, months])
  const sent = useLiveQuery(() => campaignSent(key), [key]) ?? []
  const text = texts[key]
  const left = targets?.filter((t) => !sent.includes(t.contact.id)).length ?? 0

  return (
    <>
      <h1><Megaphone className="i-inline" aria-hidden /> Campañas</h1>
      <p className="muted">Manda un mensaje de temporada a clientes que ya te compraron. Nada se envía solo: tocas «WhatsApp» con cada uno y se abre el mensaje listo.</p>

      <section className="card form">
        <div className="chips wrap" role="group" aria-label="Campaña">
          {CAMPAIGNS.map((c) => <button key={c.key} type="button" className={`chip ${key === c.key ? 'on' : ''}`} aria-pressed={key === c.key} onClick={() => setKey(c.key)}>{c.name}</button>)}
        </div>
        <label>Mensaje <small className="muted">({'{nombre}'} se cambia por el nombre de cada cliente)</small><textarea rows={5} value={text} onChange={(e) => setTexts({ ...texts, [key]: e.target.value })} /></label>
        <label>Clientes que compraron
          <select value={months ?? 0} onChange={(e) => setMonths(Number(e.target.value) || undefined)}>
            <option value={6}>en los últimos 6 meses</option>
            <option value={12}>en el último año</option>
            <option value={24}>en los últimos 2 años</option>
            <option value={0}>alguna vez</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h2>{targets ? `${targets.length} clientes · faltan ${left}` : 'Clientes'}</h2>
        {targets && targets.length === 0 && <p className="muted">No hay clientes con teléfono y compras en ese tiempo. Guarda el teléfono de tus clientes al vender.</p>}
        <ul className="moves campaign-list">
          {targets?.map(({ contact, lastBuy, total }) => {
            const done = sent.includes(contact.id)
            return (
              <li key={contact.id} className={done ? 'sent' : ''}>
                <span className="grow">{contact.name}<small className="muted"> · última compra {formatDateTime(lastBuy)} · {formatMoney(total, business.currency)}</small></span>
                <a className={`btn small ${done ? 'ghost' : 'primary'}`} href={whatsappLink(fillCampaign(text, { name: contact.name, business: business.name }), contact.phone, business.country)} target="_blank" rel="noopener noreferrer" onClick={() => void markCampaignSent(key, contact.id)}>{done ? 'Enviado ✓' : 'WhatsApp'}</a>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
