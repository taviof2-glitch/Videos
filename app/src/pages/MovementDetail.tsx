import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listCategories } from '../data/categories'
import { getContact } from '../data/contacts'
import { contactDebts, isOverdue } from '../data/debts'
import { dayKey, formatDay } from '../data/dates'
import { formatMoney } from '../data/money'
import { formatQuantity } from '../data/quantity'
import { getItems, getTransaction, lineNet, saleProfit, voidTransaction } from '../data/transactions'
import type { Business, Transaction } from '../data/types'
import { METHOD_LABEL, formatDateTime, movementTitle } from '../ui/forms'

/** S07: detalle de una venta o gasto, con editar y borrar. */
export default function MovementDetail({ business, type }: { business: Business; type: Transaction['type'] }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  // undefined = cargando, null = no existe
  const t = useLiveQuery(async () => {
    const x = await getTransaction(id)
    return x && x.type === type ? x : null
  }, [id, type])
  const items = useLiveQuery(() => getItems(id), [id]) ?? []
  const contact = useLiveQuery(async () => (t?.contactId ? ((await getContact(t.contactId)) ?? null) : null), [t?.contactId])
  const categories = useLiveQuery(() => listCategories(business.id, 'expense'), [business.id]) ?? []
  const debt = useLiveQuery(async () => {
    if (!t || t.status !== 'credit' || !t.contactId) return null
    return (await contactDebts(t.contactId)).find((i) => i.txn.id === t.id) ?? null
  }, [t?.id, t?.status, t?.contactId])

  if (t === undefined) return <p className="loading">Cargando…</p>
  if (t === null) {
    return (
      <section className="card">
        <h1>Movimiento no encontrado</h1>
        <p className="muted">Puede que se haya borrado.</p>
        <Link to="/balance" className="btn primary">Volver a movimientos</Link>
      </section>
    )
  }

  const isSale = t.type === 'sale'
  const category = categories.find((c) => c.id === t.categoryId)
  const productCount = items.filter((i) => i.productId).length
  const money = (c: number) => formatMoney(c, business.currency)

  async function remove() {
    try {
      await voidTransaction(id)
      navigate('/balance', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar')
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to="/balance" className="back" aria-label="Volver a movimientos">←</Link>
        <h1 className="grow">{isSale ? 'Venta' : 'Gasto'}</h1>
      </section>

      <section className="card detail">
        <p className="muted">{movementTitle(t, category?.name)}</p>
        <p className={`total ${isSale ? 'pos' : 'neg'}`}>{isSale ? '+' : '−'}{money(t.amountCents)}</p>
        <dl>
          <dt>Fecha</dt><dd>{formatDateTime(t.date)}</dd>
          {t.status === 'paid' && (<><dt>Método de pago</dt><dd>{METHOD_LABEL[t.paymentMethod]}</dd></>)}
          {t.status === 'credit' && (<><dt>Pago</dt><dd>{isSale ? 'Fiado' : 'A crédito'}</dd></>)}
          {debt && (
            <>
              <dt>{isSale ? 'Abonado' : 'Pagado'}</dt><dd>{money(debt.paidCents)}</dd>
              <dt>Saldo pendiente</dt><dd><strong className={debt.remainingCents > 0 ? 'neg' : 'pos'}>{debt.remainingCents > 0 ? money(debt.remainingCents) : 'Saldada'}</strong></dd>
              {t.dueDate && (<><dt>Fecha límite</dt><dd>{formatDay(t.dueDate)}{isOverdue(debt, today) && <span className="badge out"> Vencida</span>}</dd></>)}
            </>
          )}
          {contact && (<><dt>{isSale ? 'Cliente' : 'Proveedor'}</dt><dd>{contact.name}</dd></>)}
          {category && (<><dt>Categoría</dt><dd>{category.name}</dd></>)}
          {isSale && items.length > 0 && (<><dt>Ganancia</dt><dd>{money(saleProfit(items))}</dd></>)}
        </dl>
      </section>

      {items.length > 0 && (
        <section className="card">
          <h2>Productos</h2>
          <ul className="moves">
            {items.map((i) => (
              <li key={i.id}>
                <span>{formatQuantity(i.quantity)} × {i.name}<small className="muted"> · {money(i.unitPriceCents)}{i.discountCents ? ` · desc. −${money(i.discountCents)}` : ''}</small></span>
                <strong>{money(lineNet(i))}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {t.status === 'credit' && t.contactId && (
        <Link to={`/deudas/${t.contactId}`} className="btn primary">Ver deuda de {contact?.name ?? (isSale ? 'cliente' : 'proveedor')}</Link>
      )}
      {isSale && <Link to={`/venta/${t.id}/comprobante`} className="btn ghost">Comprobante</Link>}
      <Link to={`/${isSale ? 'venta' : 'gasto'}/${t.id}/editar`} className="btn ghost">Editar</Link>
      {error && <p className="error" role="alert">{error}</p>}
      {confirm ? (
        <section className="card confirm">
          <p>
            ¿Borrar {isSale ? 'esta venta' : 'este gasto'}?
            {productCount > 0 && ' Los productos vuelven al inventario.'}
          </p>
          <div className="quick">
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Cancelar</button>
            <button type="button" className="btn expense" onClick={() => void remove()}>Sí, borrar</button>
          </div>
        </section>
      ) : (
        <button type="button" className="btn danger-text" onClick={() => setConfirm(true)}>Borrar {isSale ? 'venta' : 'gasto'}</button>
      )}
    </>
  )
}
