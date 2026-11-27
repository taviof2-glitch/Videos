import { useState } from 'react'
import { addPayment } from '../data/debts'
import { formatMoney, parseMoney } from '../data/money'
import type { PaymentMethod } from '../data/types'
import { METHODS } from './forms'
import { halfOf, toInput } from './advance'


/**
 * Monto de un anticipo o abono: atajos (50 %, todo) y la opción de escribirlo a mano.
 * `value` es el texto del campo, como en los demás formularios.
 */
export function AdvanceField(props: {
  label: string
  totalCents: number
  /** Lo más que se puede abonar (lo que falta); por defecto el total. */
  maxCents?: number
  value: string
  onChange: (v: string) => void
  currency: string
  /** Mostrar «Sin anticipo» (al crear una venta o convertir una cotización). */
  allowNone?: boolean
}) {
  const max = props.maxCents ?? props.totalCents
  const money = (c: number) => formatMoney(c, props.currency)
  const half = halfOf(props.totalCents, max)
  const cents = props.value.trim() ? parseMoney(props.value) : 0
  const options = [
    ...(props.allowNone ? [{ label: 'Sin anticipo', cents: 0 }] : []),
    ...(half > 0 && half < max ? [{ label: `50 % · ${money(half)}`, cents: half }] : []),
    ...(max > 0 ? [{ label: `${max === props.totalCents ? 'Todo' : 'Liquidar'} · ${money(max)}`, cents: max }] : []),
  ]
  return (
    <fieldset className="advance-field">
      <legend>{props.label}</legend>
      <div className="chips wrap" role="group" aria-label={`Atajos: ${props.label}`}>
        {options.map((o) => (
          <button key={o.label} type="button" className={`chip ${cents === o.cents ? 'on' : ''}`} aria-pressed={cents === o.cents} onClick={() => props.onChange(toInput(o.cents))}>{o.label}</button>
        ))}
      </div>
      <label>
        Otra cantidad
        <input value={props.value} onChange={(e) => props.onChange(e.target.value)} inputMode="decimal" placeholder="0.00" />
      </label>
    </fieldset>
  )
}

/**
 * «Agregar abono» de una venta fiada: un toque abre el panel con el 50 % ya puesto (o lo que falte, si es menos),
 * se puede cambiar a mano, y solo se registra al confirmar.
 */
export function QuickPayment(props: { contactId: string; transactionId: string; totalCents: number; paidCents: number; remainingCents: number; currency: string; onDone?: (msg: string) => void }) {
  const first = props.paidCents === 0
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(() => toInput(halfOf(props.totalCents, props.remainingCents)))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const money = (c: number) => formatMoney(c, props.currency)
  const word = first ? 'anticipo' : 'abono'

  if (props.remainingCents <= 0) return done ? <p className="success" role="status">{done}</p> : null
  if (!open) {
    return (
      <>
        {done && <p className="success" role="status">{done}</p>}
        <button type="button" className="btn sale" onClick={() => { setOpen(true); setDone(''); setValue(toInput(halfOf(props.totalCents, props.remainingCents))) }}>
          {first ? 'Se recibió el anticipo' : 'Agregar abono'}
        </button>
      </>
    )
  }

  async function save() {
    setError('')
    const cents = parseMoney(value)
    if (!cents || cents <= 0) return setError('Escribe cuánto te pagaron')
    if (cents > props.remainingCents) return setError(`No puede pasar de lo que falta (${money(props.remainingCents)})`)
    setBusy(true)
    try {
      await addPayment(props.contactId, cents, { method, transactionId: props.transactionId })
      const msg = `✓ ${first ? 'Anticipo' : 'Abono'} de ${money(cents)} registrado${cents === props.remainingCents ? ': ya quedó liquidada.' : `. Falta ${money(props.remainingCents - cents)}.`}`
      setDone(msg)
      setOpen(false)
      props.onDone?.(msg)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card form" aria-label={`Registrar ${word}`}>
      <h2>Registrar {word}</h2>
      <p className="muted">Total {money(props.totalCents)}{props.paidCents > 0 ? ` · ya pagó ${money(props.paidCents)}` : ''} · falta {money(props.remainingCents)}</p>
      <AdvanceField label={`¿Cuánto dio de ${word}?`} totalCents={props.totalCents} maxCents={props.remainingCents} value={value} onChange={setValue} currency={props.currency} />
      <label>
        Método
        <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button>
        <button type="button" className="btn sale" disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : `Registrar ${word}`}</button>
      </div>
    </section>
  )
}
