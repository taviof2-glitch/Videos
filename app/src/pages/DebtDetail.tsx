import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getContact } from '../data/contacts'
import { dayKey, formatDay } from '../data/dates'
import { contactDebts, editPayment, groupPayments, isOverdue, sumRemaining, voidPayment } from '../data/debts'
import { formatMoney } from '../data/money'
import { reminderMessage, whatsappLink, whatsappNumber } from '../data/reminder'
import type { Business } from '../data/types'
import { METHOD_LABEL, METHODS, formatDateTime, fromLocalInput, movementTitle, toLocalInput } from '../ui/forms'
import type { PaymentMethod } from '../data/types'
import { ChevronLeft, TriangleAlert } from 'lucide-react'

/** S09: saldo de un cliente o proveedor, sus fiados y abonos, con registrar abono y recordatorio. */
export default function DebtDetail({ business }: { business: Business }) {
  const { contactId = '' } = useParams()
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  const [confirmBatch, setConfirmBatch] = useState<string>()
  const [editing, setEditing] = useState<{ batchId: string; date: string; method: PaymentMethod }>()
  const [error, setError] = useState('')
  // undefined = cargando, null = no existe
  const contact = useLiveQuery(async () => (await getContact(contactId)) ?? null, [contactId])
  const items = useLiveQuery(() => contactDebts(contactId), [contactId])

  if (contact === undefined || !items) return <p className="loading">Cargando…</p>
  if (contact === null) {
    return (
      <section className="card">
        <h1>No encontrado</h1>
        <Link to="/deudas" className="btn primary">Volver a deudas</Link>
      </section>
    )
  }

  const receivable = contact.type === 'customer'
  const money = (c: number) => formatMoney(c, business.currency)
  const balance = sumRemaining(items)
  const open = items.filter((i) => i.remainingCents > 0)
  const overdue = open.some((i) => isOverdue(i, today))
  const nextDue = open.map((i) => i.txn.dueDate).filter((d): d is string => !!d).sort()[0]
  const batches = groupPayments(items.flatMap((i) => i.payments))
  const reminder =
    receivable && balance > 0
      ? whatsappLink(reminderMessage({ name: contact.name, businessName: business.name, balanceCents: balance, currency: business.currency, dueDate: nextDue, overdue }), contact.phone, business.country)
      : undefined
  const hasPhone = !!whatsappNumber(contact.phone, business.country)

  async function undo(batchId: string) {
    try {
      await voidPayment(batchId)
      setConfirmBatch(undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular')
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to={receivable ? '/deudas' : '/deudas?t=pagar'} className="back" aria-label="Volver a deudas"><ChevronLeft size={24} strokeWidth={2} aria-hidden /></Link>
        <h1 className="grow">{contact.name}</h1>
      </section>

      <section className="card detail">
        <p className="muted">{receivable ? 'Te debe' : 'Le debes'}</p>
        <p className={`total ${balance === 0 ? '' : receivable ? 'pos' : 'neg'}`}>{money(balance)}</p>
        {overdue && <p className="warn"><TriangleAlert className="i-inline" aria-hidden /> Tiene deuda vencida</p>}
        {balance === 0 && <p className="muted">Sin saldo pendiente.</p>}
      </section>

      {balance > 0 && (
        <Link to={`/deudas/${contact.id}/abono`} className="btn sale">{receivable ? 'Registrar abono' : 'Registrar pago'}</Link>
      )}
      {reminder && (
        <>
          <a href={reminder} target="_blank" rel="noopener noreferrer" className="btn ghost">Enviar recordatorio por WhatsApp</a>
          {!hasPhone && <p className="muted">Este cliente no tiene teléfono: en WhatsApp elegirás a quién enviarlo. <Link to={`/clientes/${contact.id}`}>Agregar teléfono</Link></p>}
        </>
      )}

      <section className="card">
        <h2>{receivable ? 'Fiados' : 'Compras a crédito'}</h2>
        {items.length === 0 ? (
          <p className="muted">Todavía no tiene {receivable ? 'ventas fiadas' : 'gastos a crédito'}.</p>
        ) : (
          <ul className="moves">
            {[...items].reverse().map((i) => (
              <li key={i.txn.id}>
                <Link to={`/${receivable ? 'venta' : 'gasto'}/${i.txn.id}`} className="grow plain">
                  <span>{movementTitle(i.txn)}</span>
                  <small className="muted"> · {formatDay(dayKey(i.txn.date, business.timezone))}{i.txn.dueDate ? ` · límite ${formatDay(i.txn.dueDate)}` : ''}</small>
                </Link>
                <span className="stock">
                  <strong>{money(i.txn.amountCents)}</strong>
                  {i.remainingCents === 0 ? <span className="badge ok">Pagada</span> : isOverdue(i, today) ? <span className="badge out">Vencida · {money(i.remainingCents)}</span> : <span className="badge low">Debe {money(i.remainingCents)}</span>}
                  {receivable && <Link to={`/venta/${i.txn.id}/comprobante`} className="small-link">Reenviar comprobante</Link>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {batches.length > 0 && (
        <section className="card">
          <h2>{receivable ? 'Abonos' : 'Pagos'}</h2>
          {error && <p className="error" role="alert">{error}</p>}
          <ul className="moves">
            {batches.map((b) => (
              <li key={b.batchId}>
                <span className="grow">
                  {formatDateTime(b.date)}
                  <small className="muted"> · {METHOD_LABEL[b.method]}</small>
                </span>
                <strong className="pos">{money(b.amountCents)}</strong>
                {editing?.batchId === b.batchId ? null : <button type="button" className="chip" onClick={() => { setConfirmBatch(undefined); setEditing({ batchId: b.batchId, date: toLocalInput(b.date), method: b.method }) }}>Editar</button>}
                {confirmBatch === b.batchId ? (
                  <span className="inline-actions">
                    <button type="button" className="chip" onClick={() => setConfirmBatch(undefined)}>No</button>
                    <button type="button" className="chip on" onClick={() => void undo(b.batchId)}>Sí, anular</button>
                  </span>
                ) : (
                  <button type="button" className="chip" aria-label={`Anular abono de ${money(b.amountCents)}`} onClick={() => setConfirmBatch(b.batchId)}>Anular</button>
                )}
                {editing?.batchId === b.batchId && (
                  <div className="form payment-edit">
                    <div className="two">
                      <label>Fecha y hora<input type="datetime-local" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></label>
                      <label>Forma de pago<select value={editing.method} onChange={(e) => setEditing({ ...editing, method: e.target.value as PaymentMethod })}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
                    </div>
                    <div className="quick">
                      <button type="button" className="btn ghost small" onClick={() => setEditing(undefined)}>Cancelar</button>
                      <button type="button" className="btn primary small" onClick={() => {
                        const when = fromLocalInput(editing.date)
                        if (!when) return setError('La fecha no es válida')
                        void editPayment(b.batchId, { date: when, method: editing.method }).then(() => { setEditing(undefined); setError('') }, (e) => setError(e instanceof Error ? e.message : 'No se pudo guardar'))
                      }}>Guardar</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
