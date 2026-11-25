import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getContact } from '../data/contacts'
import { dayKey, formatDay } from '../data/dates'
import { contactDebts, isOverdue } from '../data/debts'
import { formatMoney } from '../data/money'
import { getPurchase, getPurchaseItems, voidPurchase } from '../data/purchases'
import { formatQuantity } from '../data/quantity'
import { getTransaction, lineTotal } from '../data/transactions'
import type { Business } from '../data/types'
import { METHOD_LABEL, formatDateTime } from '../ui/forms'

/** Detalle de una compra, con anular. */
export default function PurchaseDetail({ business }: { business: Business }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const fresh = (useLocation().state as { nueva?: boolean } | null)?.nueva === true
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  // undefined = cargando, null = no existe
  const data = useLiveQuery(async () => {
    const purchase = await getPurchase(id)
    if (!purchase) return null
    const txn = await getTransaction(purchase.transactionId)
    const supplier = purchase.supplierId ? await getContact(purchase.supplierId) : undefined
    const debt = txn?.status === 'credit' && purchase.supplierId ? (await contactDebts(purchase.supplierId)).find((d) => d.txn.id === txn.id) : undefined
    return { purchase, txn, supplier, debt, items: await getPurchaseItems(id) }
  }, [id])

  if (data === undefined) return <p className="loading">Cargando…</p>
  if (data === null) {
    return (
      <section className="card">
        <h1>Compra no encontrada</h1>
        <p className="muted">Puede que se haya anulado.</p>
        <Link to="/compras" className="btn primary">Volver a compras</Link>
      </section>
    )
  }
  const { purchase, txn, supplier, debt, items } = data
  const money = (c: number) => formatMoney(c, business.currency)

  async function remove() {
    try {
      await voidPurchase(id)
      navigate('/compras', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular')
      setConfirm(false)
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to="/compras" className="back" aria-label="Volver a compras">←</Link>
        <h1 className="grow">Compra</h1>
      </section>
      {fresh && <p className="success">✓ Compra registrada: el inventario ya se actualizó.</p>}

      <section className="card detail">
        <p className="total neg">−{money(purchase.totalCents)}</p>
        <dl>
          <dt>Fecha</dt><dd>{formatDateTime(purchase.date)}</dd>
          <dt>Proveedor</dt><dd>{supplier?.name ?? 'Sin proveedor'}</dd>
          {txn?.status === 'paid' && (<><dt>Método de pago</dt><dd>{METHOD_LABEL[txn.paymentMethod]}</dd></>)}
          {txn?.status === 'credit' && (<><dt>Pago</dt><dd>A crédito</dd></>)}
          {debt && (
            <>
              <dt>Pagado</dt><dd>{money(debt.paidCents)}</dd>
              <dt>Saldo por pagar</dt><dd><strong className={debt.remainingCents > 0 ? 'neg' : 'pos'}>{debt.remainingCents > 0 ? money(debt.remainingCents) : 'Saldada'}</strong></dd>
              {txn?.dueDate && (<><dt>Fecha límite</dt><dd>{formatDay(txn.dueDate)}{isOverdue(debt, today) && <span className="badge out"> Vencida</span>}</dd></>)}
            </>
          )}
        </dl>
      </section>

      <section className="card">
        <h2>Productos</h2>
        <ul className="moves">
          {items.map((i) => (
            <li key={i.id}>
              <span>
                {formatQuantity(i.quantity)} × {i.name}
                <small className="muted"> · {money(i.unitCostCents)} c/u{i.costBeforeCents !== i.costAfterCents ? ` · costo ${money(i.costBeforeCents)} → ${money(i.costAfterCents)}` : ''}</small>
              </span>
              <strong>{money(lineTotal(i.quantity, i.unitCostCents))}</strong>
            </li>
          ))}
        </ul>
        {purchase.notes && <p className="muted notes">{purchase.notes}</p>}
      </section>

      {debt && purchase.supplierId && <Link to={`/deudas/${purchase.supplierId}`} className="btn primary">{debt.remainingCents > 0 ? 'Registrar pago al proveedor' : 'Ver deuda con el proveedor'}</Link>}
      {error && <p className="error" role="alert">{error}</p>}
      {confirm ? (
        <section className="card confirm">
          <p>¿Anular esta compra? El inventario vuelve a bajar y se anula el gasto; el costo de los productos se restaura si no ha cambiado.</p>
          <div className="quick">
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Cancelar</button>
            <button type="button" className="btn expense" onClick={() => void remove()}>Sí, anular</button>
          </div>
        </section>
      ) : (
        <button type="button" className="btn danger-text" onClick={() => setConfirm(true)}>Anular compra</button>
      )}
    </>
  )
}
