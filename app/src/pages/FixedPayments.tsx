import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dayKey, monthStart, periodLabel, shiftAnchor } from '../data/dates'
import { deleteFixed, fixedMonth, FREQ_LABEL, listFixed, MONTHS, payFixed, saveFixed, SUGGESTED, type FixedRow, type FixedState } from '../data/fixed'
import { formatMoney, parseMoney } from '../data/money'
import type { Business, FixedFreq, FixedPayment, PaymentMethod } from '../data/types'
import { METHOD_LABEL, METHODS } from '../ui/forms'

const STATE: Record<FixedState, { text: string; cls: string }> = {
  vencido: { text: 'Vencido', cls: 'out' },
  pendiente: { text: 'Pendiente', cls: 'low' },
  pagado: { text: 'Pagado', cls: 'ok' },
  'no-toca': { text: 'No toca este mes', cls: 'muted' },
}

/** Cuándo se paga, en palabras. */
function when(p: FixedPayment): string {
  if (p.freq === 'mensual') return p.day ? `Cada mes, el día ${p.day}` : 'Cada mes'
  if (p.freq === 'bimestral') return `Cada dos meses${p.day ? `, el día ${p.day}` : ''} (desde ${MONTHS[(p.month ?? 1) - 1]})`
  if (p.freq === 'anual') return `Cada año, ${p.day ? `el ${p.day} de` : 'en'} ${MONTHS[(p.month ?? 1) - 1]}`
  return FREQ_LABEL[p.freq]
}

/** Pagos habituales del taller: qué toca pagar este mes, qué ya se pagó y cuánto falta. */
export default function FixedPayments({ business }: { business: Business }) {
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  const [anchor, setAnchor] = useState(() => monthStart(today))
  const [editing, setEditing] = useState<FixedPayment | 'new'>()
  const [paying, setPaying] = useState<string>()
  const month = useLiveQuery(() => fixedMonth(business, anchor, today), [business, anchor, today])
  const money = (c: number) => formatMoney(c, business.currency)
  const list = listFixed(business)

  return (
    <>
      <section className="row-between">
        <h1>Pagos del taller</h1>
        <Link to="/mas" className="btn ghost small">Más</Link>
      </section>
      <p className="muted">Los pagos indispensables del taller (renta, luz, sueldos…). Cada pago que registras aquí queda como un gasto y sale en tu balance.</p>

      {list.length > 0 && month && (
        <>
          <section className="card">
            <div className="period-nav">
              <button type="button" className="icon-btn" aria-label="Mes anterior" onClick={() => setAnchor(shiftAnchor('month', anchor, -1))}><ChevronLeft aria-hidden /></button>
              <strong className="grow">{periodLabel('month', anchor)}</strong>
              <button type="button" className="icon-btn" aria-label="Mes siguiente" onClick={() => setAnchor(shiftAnchor('month', anchor, 1))}><ChevronRight aria-hidden /></button>
            </div>
            <div className="fixed-totals">
              <div><small className="muted">Toca pagar</small><strong>{money(month.expectedCents)}</strong></div>
              <div><small className="muted">Pagado</small><strong className="amount sale">{money(month.paidCents)}</strong></div>
              <div><small className="muted">Falta</small><strong className={month.remainingCents > 0 ? 'amount expense' : ''}>{money(month.remainingCents)}</strong></div>
            </div>
            <div className="meter" aria-hidden><span style={{ width: `${month.expectedCents ? Math.min(100, (month.paidCents / month.expectedCents) * 100) : 0}%` }} /></div>
            <p className="muted">En promedio, el taller necesita <strong>{money(month.averageCents)}</strong> al mes para sus pagos habituales.</p>
          </section>

          <ul className="fixed-list">
            {month.rows.map((r) => (
              <li key={r.payment.id} className="card">
                <div className="row-between">
                  <strong>{r.payment.name}</strong>
                  <span className={`badge ${STATE[r.state].cls}`}>{STATE[r.state].text}{r.expected > 1 ? ` · ${r.paid.length} de ${r.expected}` : ''}</span>
                </div>
                <div className="row-between">
                  <small className="muted">{when(r.payment)}</small>
                  <strong>{money(r.payment.amountCents)}</strong>
                </div>
                {r.paid.length > 0 && (
                  <ul className="fixed-paid">
                    {r.paid.map((t) => (
                      <li key={t.id}><Link to={`/gasto/${t.id}`}>Pagado el {new Date(t.date).toLocaleDateString('es-MX', { timeZone: business.timezone, day: 'numeric', month: 'short' })} · {money(t.amountCents)} · {METHOD_LABEL[t.paymentMethod]}</Link></li>
                    ))}
                  </ul>
                )}
                {paying === r.payment.id ? (
                  <PayForm business={business} row={r} anchor={anchor} today={today} onDone={() => setPaying(undefined)} />
                ) : (
                  <div className="quick">
                    {r.state !== 'pagado' && <button type="button" className="btn primary" onClick={() => { setPaying(r.payment.id); setEditing(undefined) }}>Registrar pago</button>}
                    {r.state === 'pagado' && <button type="button" className="btn ghost" onClick={() => { setPaying(r.payment.id); setEditing(undefined) }}>Registrar otro pago</button>}
                    <button type="button" className="btn ghost" onClick={() => { setEditing(r.payment); setPaying(undefined) }}>Cambiar</button>
                  </div>
                )}
                {editing !== 'new' && editing?.id === r.payment.id && <FixedForm business={business} payment={r.payment} onDone={() => setEditing(undefined)} />}
              </li>
            ))}
          </ul>
        </>
      )}

      {list.length === 0 && editing !== 'new' && (
        <section className="card empty-state">
          <p>Todavía no tienes pagos habituales. Agrega la renta, la luz, los sueldos y lo que el taller paga siempre, para saber cada mes qué falta.</p>
        </section>
      )}

      {editing === 'new' ? (
        <section className="card"><FixedForm business={business} onDone={() => setEditing(undefined)} /></section>
      ) : (
        <button type="button" className="btn primary" onClick={() => { setEditing('new'); setPaying(undefined) }}>Agregar pago habitual</button>
      )}
    </>
  )
}

function PayForm({ business, row, anchor, today, onDone }: { business: Business; row: FixedRow; anchor: string; today: string; onDone: () => void }) {
  const [amount, setAmount] = useState((row.payment.amountCents / 100).toFixed(2))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  // En el mes de hoy, la fecha es hoy; viendo otro mes, el día de pago de ese mes.
  const sameMonth = anchor.slice(0, 7) === today.slice(0, 7)
  const [date, setDate] = useState(sameMonth ? today : `${anchor.slice(0, 8)}${String(Math.min(28, row.payment.day ?? 1)).padStart(2, '0')}`)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = parseMoney(amount)
    if (!cents) return setError('Escribe cuánto pagaste')
    setBusy(true)
    setError('')
    try {
      // Mediodía local del día elegido: cae en ese día en cualquier zona horaria de México.
      await payFixed(business.id, row.payment, { amountCents: cents, paymentMethod: method, date: date === today ? undefined : new Date(`${date}T12:00:00`).toISOString() })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar')
      setBusy(false)
    }
  }

  return (
    <form className="form fixed-form" onSubmit={(e) => void submit(e)}>
      <div className="two">
        <label>Cuánto pagaste<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus /></label>
        <label>Fecha<input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <label>
        Forma de pago
        <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" onClick={onDone}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={busy}>Guardar pago</button>
      </div>
    </form>
  )
}

function FixedForm({ business, payment, onDone }: { business: Business; payment?: FixedPayment; onDone: () => void }) {
  const [name, setName] = useState(payment?.name ?? '')
  const [amount, setAmount] = useState(payment ? (payment.amountCents / 100).toFixed(2) : '')
  const [freq, setFreq] = useState<FixedFreq>(payment?.freq ?? 'mensual')
  const [day, setDay] = useState(payment?.day ? String(payment.day) : '')
  const [month, setMonth] = useState(String(payment?.month ?? new Date().getMonth() + 1))
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const withDay = freq === 'mensual' || freq === 'bimestral' || freq === 'anual'
  const withMonth = freq === 'bimestral' || freq === 'anual'
  const used = new Set(listFixed(business).map((p) => p.name.toLowerCase()))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cents = parseMoney(amount)
    if (!cents) return setError('Escribe cuánto se paga cada vez')
    try {
      await saveFixed(business.id, { id: payment?.id, name, amountCents: cents, freq, day: parseInt(day) || undefined, month: parseInt(month) || undefined })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  return (
    <form className="form fixed-form" onSubmit={(e) => void submit(e)}>
      <h2>{payment ? `Cambiar «${payment.name}»` : 'Nuevo pago habitual'}</h2>
      {!payment && (
        <div className="proj-chips" aria-label="Sugerencias">
          {SUGGESTED.filter((s) => !used.has(s.toLowerCase())).map((s) => <button key={s} type="button" className={`chip ${name === s ? 'on' : ''}`} onClick={() => setName(s)}>{s}</button>)}
        </div>
      )}
      <div className="two">
        <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Renta" /></label>
        <label>Cuánto se paga cada vez<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" /></label>
      </div>
      <div className="two">
        <label>
          ¿Cada cuánto?
          <select value={freq} onChange={(e) => setFreq(e.target.value as FixedFreq)}>
            {(Object.keys(FREQ_LABEL) as FixedFreq[]).map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
          </select>
        </label>
        {withDay && <label>Día del mes en que vence <small className="muted">(opcional)</small><input value={day} onChange={(e) => setDay(e.target.value)} inputMode="numeric" placeholder="Ej. 5" /></label>}
        {withMonth && (
          <label>
            {freq === 'anual' ? 'Mes en que toca' : 'Un mes en que toca'}
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" onClick={onDone}>Cancelar</button>
        <button type="submit" className="btn primary">Guardar</button>
      </div>
      {payment && (confirm ? (
        <div className="card confirm">
          <p>¿Quitar «{payment.name}» de tus pagos habituales? Los gastos que ya registraste se quedan.</p>
          <div className="quick">
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Cancelar</button>
            <button type="button" className="btn expense" onClick={() => void deleteFixed(business.id, payment.id).then(onDone)}>Sí, quitar</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn danger-text" onClick={() => setConfirm(true)}>Quitar este pago</button>
      ))}
    </form>
  )
}
