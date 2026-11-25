import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { summarizeTransactions } from '../data/balance'
import { listCategories } from '../data/categories'
import { listContacts } from '../data/contacts'
import { groupPayments, listPayments } from '../data/debts'
import {
  addDays, dayKey, dayNumber, formatDay, monthStart, periodDays, periodLabel, periodRange, shiftAnchor, weekdayShort, weekStart,
  type Period,
} from '../data/dates'
import { formatMoney } from '../data/money'
import { listTransactions } from '../data/transactions'
import type { Business, Transaction } from '../data/types'
import { METHOD_LABEL, movementTitle } from '../ui/forms'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'all', label: 'Historial' },
]
type TypeFilter = 'all' | Transaction['type']

/** Una fila de la lista: venta, gasto o abono/pago de deuda. */
type Entry = {
  key: string
  date: string
  type: Transaction['type'] // dirección del dinero: sale = entra, expense = sale
  title: string
  sub: string
  amountCents: number
  href: string
  /** Fiada o a crédito: todavía no entra ni sale dinero. */
  pending: boolean
  search: string
}
const TYPES: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'sale', label: 'Ingresos' },
  { value: 'expense', label: 'Egresos' },
]

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const isDayKey = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
const timeOnly = (iso: string, timeZone: string) => new Date(iso).toLocaleTimeString('es-MX', { timeZone, hour: 'numeric', minute: '2-digit' })

/** S03: balance del periodo (ingresos, egresos, utilidad) y lista de movimientos con filtros. */
export default function Movements({ business }: { business: Business }) {
  const tz = business.timezone
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  // "Hoy" se recalcula al montar; la pantalla se vuelve a abrir cada día en la práctica.
  const [today] = useState(() => dayKey(Date.now(), tz))

  const periodParam = params.get('p')
  const period: Period = PERIODS.some((p) => p.value === periodParam) ? (periodParam as Period) : 'day'
  const dayParam = params.get('d')
  const anchor = isDayKey(dayParam) && dayParam <= today ? dayParam : today
  const typeParam = params.get('t')
  const type: TypeFilter = TYPES.some((t) => t.value === typeParam) ? (typeParam as TypeFilter) : 'all'

  function update(next: { p?: Period; d?: string; t?: TypeFilter }) {
    const q = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      // los valores por defecto no se escriben en la URL
      if (v === undefined || (k === 'p' && v === 'day') || (k === 't' && v === 'all') || (k === 'd' && v === today)) q.delete(k)
      else q.set(k, v)
    }
    setParams(q, { replace: true })
  }

  const range = useMemo(() => periodRange(period, anchor, tz), [period, anchor, tz])
  const rows = useLiveQuery(() => listTransactions(business.id, range), [business.id, range.from, range.to])
  const paymentRows = useLiveQuery(() => listPayments(business.id, range), [business.id, range.from, range.to])
  const categories = useLiveQuery(() => listCategories(business.id, 'expense'), [business.id])
  const customers = useLiveQuery(() => listContacts(business.id, 'customer'), [business.id])
  const suppliers = useLiveQuery(() => listContacts(business.id, 'supplier'), [business.id])

  const money = (c: number) => formatMoney(c, business.currency)
  const days = periodDays(period, anchor)
  const canGoForward = !!days && days.end < today
  const strip = period === 'day' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(anchor), i)) : []

  const view = useMemo(() => {
    if (!rows || !paymentRows) return undefined
    const names = new Map([...(customers ?? []), ...(suppliers ?? [])].map((c) => [c.id, c.name]))
    const catNames = new Map((categories ?? []).map((c) => [c.id, c.name]))
    const time = (iso: string) => timeOnly(iso, tz)
    const entries: Entry[] = [
      ...rows.map((t): Entry => {
        const title = movementTitle(t, t.categoryId ? catNames.get(t.categoryId) : undefined)
        const who = t.contactId ? (names.get(t.contactId) ?? '') : ''
        const how = t.status === 'credit' ? (t.type === 'sale' ? 'Fiada' : 'A crédito') : METHOD_LABEL[t.paymentMethod]
        return {
          key: t.id, date: t.date, type: t.type, title, sub: `${how} · ${time(t.date)}`, amountCents: t.amountCents,
          href: `/${t.type === 'sale' ? 'venta' : 'gasto'}/${t.id}`, pending: t.status === 'credit', search: `${title} ${who} ${how}`,
        }
      }),
      ...groupPayments(paymentRows).map((b): Entry => {
        const who = names.get(b.contactId) ?? ''
        const title = b.direction === 'in' ? `Abono de ${who}` : `Pago a ${who}`
        return {
          key: b.batchId, date: b.date, type: b.direction === 'in' ? 'sale' : 'expense', title, sub: `${METHOD_LABEL[b.method]} · ${time(b.date)}`,
          amountCents: b.amountCents, href: `/deudas/${b.contactId}`, pending: false, search: `${title} ${METHOD_LABEL[b.method]}`,
        }
      }),
    ].sort((a, b) => b.date.localeCompare(a.date))
    const q = normalize(search.trim())
    const shown = entries.filter((e) => (type === 'all' || e.type === type) && (!q || normalize(e.search).includes(q)))
    const groups: { key: string; entries: Entry[] }[] = []
    for (const e of shown) {
      const key = period === 'all' ? monthStart(dayKey(e.date, tz)) : dayKey(e.date, tz)
      const last = groups[groups.length - 1]
      if (last?.key === key) last.entries.push(e)
      else groups.push({ key, entries: [e] })
    }
    return { balance: summarizeTransactions(rows, paymentRows), groups, empty: entries.length === 0 }
  }, [rows, paymentRows, search, type, period, tz, customers, suppliers, categories])

  const groupLabel = (key: string) =>
    period === 'all'
      ? periodLabel('month', key)
      : key === today ? 'Hoy' : key === addDays(today, -1) ? 'Ayer' : formatDay(key)

  return (
    <>
      <section className="row-between">
        <h1>Balance</h1>
        <Link to="/estadisticas" className="btn ghost small">Estadísticas y reportes</Link>
      </section>

      <div className="tabs" role="tablist" aria-label="Periodo">
        {PERIODS.map((p) => (
          <button key={p.value} type="button" role="tab" aria-selected={period === p.value} className={`tab-btn ${period === p.value ? 'on' : ''}`} onClick={() => update({ p: p.value, d: anchor })}>
            {p.label}
          </button>
        ))}
      </div>

      {period !== 'all' && (
        <div className="period-nav">
          <button type="button" className="icon-btn" aria-label="Periodo anterior" onClick={() => update({ d: shiftAnchor(period, anchor, -1) })}>‹</button>
          <strong className="grow">{periodLabel(period, anchor)}</strong>
          <button type="button" className="icon-btn" aria-label="Periodo siguiente" disabled={!canGoForward} onClick={() => update({ d: shiftAnchor(period, anchor, 1) })}>›</button>
        </div>
      )}

      {period === 'day' && (
        <div className="day-strip" role="group" aria-label="Días de la semana">
          {strip.map((k) => (
            <button key={k} type="button" disabled={k > today} className={`day ${k === anchor ? 'on' : ''}`} aria-pressed={k === anchor} aria-label={formatDay(k)} onClick={() => update({ d: k })}>
              <small>{weekdayShort(k)}</small>
              <strong>{dayNumber(k)}</strong>
            </button>
          ))}
        </div>
      )}

      <section className="card balance" aria-label="Resumen del periodo">
        <div className="balance-cols">
          <div><small>Ingresos ↗</small><strong className="pos">{money(view?.balance.incomeCents ?? 0)}</strong></div>
          <div><small>Egresos ↙</small><strong className="neg">{money(view?.balance.expenseCents ?? 0)}</strong></div>
        </div>
        <div className="balance-total">
          <span>Utilidad</span>
          <strong className={(view?.balance.profitCents ?? 0) < 0 ? 'neg' : ''}>{money(view?.balance.profitCents ?? 0)}</strong>
        </div>
      </section>

      <div className="quick">
        <Link to="/venta/nueva" className="btn sale">+ Nueva venta</Link>
        <Link to="/gasto/nuevo" className="btn expense">− Nuevo gasto</Link>
      </div>

      <div className="tabs" role="tablist" aria-label="Tipo de movimiento">
        {TYPES.map((t) => (
          <button key={t.value} type="button" role="tab" aria-selected={type === t.value} className={`tab-btn ${type === t.value ? 'on' : ''}`} onClick={() => update({ t: t.value })}>
            {t.label}
          </button>
        ))}
      </div>
      <input type="search" placeholder="Buscar por concepto, cliente o categoría" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar movimiento" />

      {!view ? (
        <p className="loading">Cargando…</p>
      ) : view.groups.length === 0 ? (
        <section className="card empty-state">
          <span aria-hidden>🧾</span>
          {view?.empty ? (
            <>
              <h2>{period === 'all' ? 'Todavía no hay movimientos' : 'Sin movimientos en este periodo'}</h2>
              <p className="muted">{period === 'all' ? 'Registra tu primera venta para empezar a ver cómo va tu negocio.' : 'Cambia de día o de periodo, o registra una venta.'}</p>
              {period === 'all' && <Link to="/venta/nueva" className="btn primary">Registrar mi primera venta</Link>}
            </>
          ) : (
            <h2>Ningún movimiento coincide</h2>
          )}
        </section>
      ) : (
        view.groups.map((g) => (
          <section key={g.key} aria-label={groupLabel(g.key)}>
            <h2 className="group-title">{groupLabel(g.key)}</h2>
            <div className="card list">
              {g.entries.map((e) => (
                <Link key={e.key} to={e.href} className="product-row">
                  <div className={`dot ${e.type}`} aria-hidden>{e.type === 'sale' ? '↗' : '↙'}</div>
                  <div className="grow">
                    <strong>{e.title}</strong>
                    <small className="muted">{e.sub}</small>
                  </div>
                  <strong className={e.pending ? 'muted' : e.type === 'sale' ? 'pos' : 'neg'}>{e.type === 'sale' ? '+' : '−'}{money(e.amountCents)}</strong>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}
