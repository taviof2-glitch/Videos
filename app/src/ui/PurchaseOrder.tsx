import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { listContacts } from '../data/contacts'
import { formatMoney } from '../data/money'
import { bySupplier, orderMessage, purchaseList } from '../data/purchaseList'
import { whatsappLink } from '../data/reminder'
import { matchSupplier } from '../data/ticket'
import type { Business } from '../data/types'

/** Pedido de material: lo que falta para las obras por arrancar y lo que está bajo el mínimo, por proveedor. */
export default function PurchaseOrder({ business }: { business: Business }) {
  const [open, setOpen] = useState(false)
  const lines = useLiveQuery(() => (open ? purchaseList(business) : Promise.resolve(undefined)), [business, open])
  const suppliers = useLiveQuery(() => listContacts(business.id, 'supplier'), [business.id]) ?? []
  const money = (c: number) => formatMoney(c, business.currency)

  if (!open) return <button type="button" className="btn ghost" onClick={() => setOpen(true)}><ShoppingCart aria-hidden /> Pedido de material para las obras</button>
  return (
    <section className="card">
      <div className="row-between">
        <h2><ShoppingCart className="i-inline" aria-hidden /> Pedido de material</h2>
        <button type="button" className="link" onClick={() => setOpen(false)}>Cerrar</button>
      </div>
      <p className="muted">Lo que piden las obras en «Pedido recibido» y «Material comprado» (según su despiece), menos lo que ya tienes, más lo que está bajo el mínimo. Cada cosa va con el proveedor que te la da más barato.</p>
      {lines === undefined ? <p className="loading">Calculando…</p> : lines.length === 0 ? (
        <p className="note-box">✓ No falta nada: con lo que hay en el taller alcanza para las obras por arrancar.</p>
      ) : (
        bySupplier(lines).map((g) => {
          const contact = g.supplier ? matchSupplier(g.supplier, suppliers) : undefined
          return (
            <div key={g.supplier || 'sin'} className="order-group">
              <div className="row-between">
                <h3>{g.supplier || 'Sin proveedor con precio'}</h3>
                {g.totalCents > 0 && <strong>≈ {money(g.totalCents)}</strong>}
              </div>
              <ul className="moves">
                {g.lines.map((l) => (
                  <li key={l.name}>
                    <span><strong>{l.buy} {l.unit}</strong> · {l.name}<small className="muted"> · {l.need > 0 ? `piden ${l.need}` : 'bajo el mínimo'}, hay {l.have}{l.jobs.length ? ` · ${l.jobs.join(', ')}` : ''}</small></span>
                    {l.priceCents > 0 && <small className="muted">{money(l.priceCents)} c/u</small>}
                  </li>
                ))}
              </ul>
              <a className="btn sale" href={whatsappLink(orderMessage(business.name, g.lines), contact?.phone ?? '', business.country)} target="_blank" rel="noopener noreferrer">
                Mandar pedido por WhatsApp{g.supplier ? ` a ${g.supplier}` : ''}
              </a>
              {g.supplier && !contact?.phone && <small className="muted">{g.supplier} no tiene teléfono guardado: en WhatsApp eliges a quién mandarlo.</small>}
            </div>
          )
        })
      )}
    </section>
  )
}
