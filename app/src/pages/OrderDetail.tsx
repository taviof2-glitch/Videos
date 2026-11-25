import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { docNumber } from '../data/folio'
import { formatMoney } from '../data/money'
import { cancelOrder, getOrder, getOrderItems, payOrder, reopenOrder, setOrderStatus } from '../data/orders'
import { formatQuantity } from '../data/quantity'
import { lineTotal } from '../data/transactions'
import type { Business, PaymentMethod } from '../data/types'
import ContactSelect from '../ui/ContactSelect'
import { METHODS, NEW_OPTION, formatDateTime, resolveContactId } from '../ui/forms'
import OrderBadge from '../ui/OrderBadge'

/** Detalle de un pedido: estado, cobrar (crea la venta), editar y cancelar. */
export default function OrderDetail({ business }: { business: Business }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const isNew = (useLocation().state as { nuevo?: boolean } | null)?.nuevo === true
  const [paying, setPaying] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState('')
  const data = useLiveQuery(async () => {
    const order = await getOrder(id)
    return order ? { order, items: await getOrderItems(id) } : null
  }, [id])
  const money = (c: number) => formatMoney(c, business.currency)

  if (data === undefined) return <p className="loading">Cargando…</p>
  if (data === null) {
    return (
      <section className="card">
        <h1>Pedido no encontrado</h1>
        <Link to="/pedidos" className="btn primary">Volver a pedidos</Link>
      </section>
    )
  }
  const { order, items } = data
  const open = order.status === 'pending' || order.status === 'processing'

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción')
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to="/pedidos" className="back" aria-label="Volver a pedidos">←</Link>
        <h1 className="grow">Pedido {docNumber(order)}</h1>
        <OrderBadge status={order.status} />
      </section>
      {isNew && <p className="success">✓ Pedido creado.</p>}

      <section className="card detail">
        <dl>
          <dt>Cliente</dt><dd>{order.customerName || 'Sin nombre'}</dd>
          <dt>Recibido</dt><dd>{formatDateTime(order.createdAt)}</dd>
          <dt>Origen</dt><dd>{order.source === 'catalog' ? 'Catálogo (WhatsApp)' : 'Capturado a mano'}</dd>
        </dl>
        {order.notes && <p className="muted notes">Notas: {order.notes}</p>}
      </section>

      <section className="card">
        <h2>Productos</h2>
        <ul className="moves">
          {items.map((i) => (
            <li key={i.id}>
              <span>{formatQuantity(i.quantity)} × {i.name}<small className="muted"> · {money(i.unitPriceCents)} c/u</small></span>
              <strong>{money(lineTotal(i.quantity, i.unitPriceCents))}</strong>
            </li>
          ))}
        </ul>
        <p className="total-line"><span>Total</span><strong>{money(order.totalCents)}</strong></p>
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      {open && (
        <>
          {paying ? (
            <PayPanel
              business={business} total={order.totalCents} customerName={order.customerName} onCancel={() => setPaying(false)}
              onConfirm={(o) => run(async () => {
                const { sale } = await payOrder(order.id, o)
                navigate(`/venta/${sale.id}/comprobante`, { replace: true, state: { nueva: true } })
              })}
            />
          ) : (
            <button type="button" className="btn sale" onClick={() => setPaying(true)}>Cobrar y registrar venta</button>
          )}
          {order.status === 'pending' ? (
            <button type="button" className="btn ghost" onClick={() => void run(() => setOrderStatus(order.id, 'processing'))}>Marcar en proceso</button>
          ) : (
            <button type="button" className="btn ghost" onClick={() => void run(() => setOrderStatus(order.id, 'pending'))}>Volver a pendiente</button>
          )}
          <Link to={`/pedidos/${order.id}/editar`} className="btn ghost">Editar</Link>
        </>
      )}

      {order.status === 'paid' && order.transactionId && (
        <>
          <Link to={`/venta/${order.transactionId}`} className="btn primary">Ver la venta</Link>
          <Link to={`/venta/${order.transactionId}/comprobante`} className="btn ghost">Enviar comprobante</Link>
        </>
      )}
      {order.status === 'cancelled' && <button type="button" className="btn ghost" onClick={() => void run(() => reopenOrder(order.id))}>Reabrir pedido</button>}

      {order.status !== 'cancelled' &&
        (confirmCancel ? (
          <section className="card confirm">
            <p>¿Cancelar el pedido {docNumber(order)}?{order.status === 'paid' ? ' Se anula la venta: el inventario vuelve y el dinero sale del balance.' : ''}</p>
            <div className="quick">
              <button type="button" className="btn ghost" onClick={() => setConfirmCancel(false)}>No</button>
              <button type="button" className="btn expense" onClick={() => void run(async () => { await cancelOrder(order.id); setConfirmCancel(false) })}>Sí, cancelar</button>
            </div>
          </section>
        ) : (
          <button type="button" className="btn danger-text" onClick={() => setConfirmCancel(true)}>Cancelar pedido</button>
        ))}
    </>
  )
}

function PayPanel(props: { business: Business; total: number; customerName: string; onCancel: () => void; onConfirm: (o: { method: PaymentMethod; contactId?: string }) => Promise<void> }) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [contactId, setContactId] = useState('')
  const [newName, setNewName] = useState(props.customerName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const customer = await resolveContactId(props.business.id, 'customer', contactId, newName, setContactId)
      await props.onConfirm({ method, contactId: customer || undefined })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cobrar')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={confirm} className="card form" aria-label="Cobrar pedido">
      <h2>Cobrar {formatMoney(props.total, props.business.currency)}</h2>
      <p className="muted">Se crea una venta con estos productos: entra al balance y baja el inventario.</p>
      <label>
        Método de pago
        <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      <ContactSelect businessId={props.business.id} type="customer" value={contactId} onChange={setContactId} newName={newName} onNewName={setNewName} />
      {props.customerName && contactId === '' && (
        <button type="button" className="link" onClick={() => setContactId(NEW_OPTION)}>Guardar «{props.customerName}» como cliente nuevo</button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" onClick={props.onCancel}>Cancelar</button>
        <button type="submit" className="btn sale" disabled={busy}>{busy ? 'Cobrando…' : 'Cobrar'}</button>
      </div>
    </form>
  )
}
