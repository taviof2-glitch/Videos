import { useLiveQuery } from 'dexie-react-hooks'
import { useActor } from '../ui/actor'
import { notifyPayment } from '../ui/jobNotify'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getContact } from '../data/contacts'
import { addPayment, contactDebts, sumRemaining } from '../data/debts'
import { formatMoney, parseMoney } from '../data/money'
import type { Business, PaymentMethod } from '../data/types'
import { METHODS, fromLocalInput, toLocalInput } from '../ui/forms'
import { ChevronLeft } from 'lucide-react'

/** S10: registrar un abono (cliente) o un pago (proveedor). */
export default function PaymentForm({ business }: { business: Business }) {
  const actor = useActor()
  const { contactId = '' } = useParams()
  const navigate = useNavigate()
  const contact = useLiveQuery(async () => (await getContact(contactId)) ?? null, [contactId])
  const balance = useLiveQuery(async () => sumRemaining(await contactDebts(contactId)), [contactId])
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [date, setDate] = useState(() => toLocalInput(new Date().toISOString()))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (contact === undefined || balance === undefined) return <p className="loading">Cargando…</p>
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const cents = parseMoney(amount)
    if (!cents) return setError('Escribe el monto')
    if (cents > balance!) return setError(`El abono no puede superar el saldo pendiente (${money(balance!)})`)
    const when = fromLocalInput(date)
    if (!when) return setError('La fecha no es válida')
    setSaving(true)
    try {
      await addPayment(contactId, cents, { method, date: when })
      void notifyPayment(business, contactId, cents, actor)
      navigate(`/deudas/${contactId}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to={`/deudas/${contactId}`} className="back" aria-label="Volver"><ChevronLeft size={24} strokeWidth={2} aria-hidden /></Link>
        <h1 className="grow">{receivable ? 'Registrar abono' : 'Registrar pago'}</h1>
      </section>
      <section className="card">
        <p className="muted">{contact.name} {receivable ? 'te debe' : '— le debes'}</p>
        <p className="total-line"><span>Saldo pendiente</span><strong>{money(balance)}</strong></p>
      </section>
      <form onSubmit={submit} className="card form" noValidate>
        <label>
          Monto *
          <input className="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus />
        </label>
        <button type="button" className="btn ghost small" onClick={() => setAmount((balance / 100).toFixed(2))}>Saldar todo ({money(balance)})</button>
        <label>
          Método de pago
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <label>
          Fecha y hora
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn sale" type="submit" disabled={saving || balance === 0}>{saving ? 'Guardando…' : receivable ? 'Registrar abono' : 'Registrar pago'}</button>
      </form>
    </>
  )
}
