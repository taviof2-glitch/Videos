import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatMoney } from '../data/money'
import { createOrder, orderDraftFromMessage, type OrderDraft } from '../data/orders'
import { listProducts, unitPrice } from '../data/products'
import { formatQuantity } from '../data/quantity'
import { lineTotal } from '../data/transactions'
import type { Business } from '../data/types'

/** Pegar el mensaje que mandó el cliente desde el catálogo y convertirlo en pedido. */
export default function OrderPaste({ business }: { business: Business }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<OrderDraft>()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const products = useLiveQuery(() => listProducts(business.id), [business.id])
  const money = (c: number) => formatMoney(c, business.currency)

  async function read() {
    setError('')
    setDraft(undefined)
    try {
      setDraft(await orderDraftFromMessage(business.id, text))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el pedido')
    }
  }

  async function create() {
    if (!draft) return
    setSaving(true)
    try {
      const o = await createOrder(business.id, draft.input)
      navigate(`/pedidos/${o.id}`, { replace: true, state: { nuevo: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el pedido')
      setSaving(false)
    }
  }

  const total = draft?.input.items.reduce((s, i) => s + lineTotal(i.quantity, i.unitPriceCents), 0) ?? 0

  return (
    <>
      <section className="row-between">
        <Link to="/pedidos" className="back" aria-label="Volver a pedidos">←</Link>
        <h1 className="grow">Pedido de WhatsApp</h1>
      </section>
      <section className="card form">
        <label>
          Mensaje del cliente
          <textarea value={text} onChange={(e) => { setText(e.target.value); setDraft(undefined); setError('') }} rows={7} placeholder="Copia el mensaje completo que te mandó el cliente y pégalo aquí" />
        </label>
        <p className="muted">Debe incluir el «Código del pedido» del final. Si el cliente escribió el pedido a mano, usa <Link to="/pedidos/nuevo">Nuevo pedido</Link>.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="btn primary" disabled={!text.trim()} onClick={() => void read()}>Leer pedido</button>
      </section>

      {draft && (
        <section className="card">
          <h2>Esto pidió{draft.input.customerName ? ` ${draft.input.customerName}` : ''}</h2>
          <ul className="moves">
            {draft.input.items.map((i, k) => {
              const p = products?.find((x) => x.id === i.productId)
              const today = p ? unitPrice(p, p.variants?.find((v) => v.id === i.variantId)) : undefined
              return (
                <li key={k}>
                  <span>
                    {formatQuantity(i.quantity)} × {i.name}
                    <small className="muted"> · {money(i.unitPriceCents)} c/u</small>
                    {today !== undefined && today !== i.unitPriceCents && <small className="warn" style={{ display: 'block' }}>⚠️ Cambió de precio: hoy cuesta {money(today)}</small>}
                  </span>
                  <strong>{money(lineTotal(i.quantity, i.unitPriceCents))}</strong>
                </li>
              )
            })}
          </ul>
          <p className="total-line"><span>Total</span><strong>{money(total)}</strong></p>
          {draft.input.notes && <p className="muted notes">Notas: {draft.input.notes}</p>}
          {draft.unmatched.map((u) => <p key={u} className="warn">⚠️ {u}</p>)}
          <p className="muted">Los precios son los que vio el cliente. Los puedes cambiar editando el pedido.</p>
          <button type="button" className="btn sale" disabled={saving} onClick={() => void create()}>{saving ? 'Creando…' : 'Crear pedido'}</button>
        </section>
      )}
    </>
  )
}
