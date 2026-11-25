import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { dayKey, formatDay } from '../data/dates'
import { formatMoney } from '../data/money'
import { formatQuantity } from '../data/quantity'
import { reportFileName, reportPdf, reportXlsx } from '../data/reports'
import { computeStats, shiftStatsAnchor, statsBuckets, statsLabel, type StatsPeriod } from '../data/stats'
import type { Business } from '../data/types'
import BarChart from '../ui/BarChart'
import { downloadBlob } from '../ui/share'

const PERIODS: { value: StatsPeriod; param: string; label: string }[] = [
  { value: 'week', param: 'semana', label: 'Semana' },
  { value: 'month', param: 'mes', label: 'Mes' },
  { value: 'year', param: 'anio', label: 'Año' },
]
const isDayKey = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
const compact = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 })

/** S15 y S16: cómo va el negocio en el periodo, y su reporte en Excel o PDF. */
export default function Stats({ business }: { business: Business }) {
  const [params, setParams] = useSearchParams()
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const [busy, setBusy] = useState(false)
  const period = PERIODS.find((p) => p.param === params.get('p'))?.value ?? 'month'
  const d = params.get('d')
  const anchor = isDayKey(d) && d <= today ? d : today
  const stats = useLiveQuery(() => computeStats(business.id, period, anchor, business.timezone), [business.id, period, anchor, business.timezone])
  const money = (c: number) => formatMoney(c, business.currency)
  const next = shiftStatsAnchor(period, anchor, 1)
  const canGoForward = statsBuckets(period, next)[0].start <= today

  function go(p: StatsPeriod, a: string) {
    const q: Record<string, string> = {}
    if (p !== 'month') q.p = PERIODS.find((x) => x.value === p)!.param
    if (a !== today) q.d = a
    setParams(q, { replace: true })
    setMessage(undefined)
  }

  async function download(kind: 'xlsx' | 'pdf') {
    if (!stats) return
    setBusy(true)
    setMessage(undefined)
    try {
      const bytes = kind === 'xlsx' ? await reportXlsx(business, period, anchor, stats) : reportPdf(business, period, anchor, stats)
      const type = kind === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'
      const name = reportFileName(business, period, anchor, kind)
      if (await downloadBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }), name)) setMessage({ ok: true, text: `Se guardó ${name}.` })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudo crear el reporte' })
    }
    setBusy(false)
  }

  const empty = stats && stats.salesCount === 0 && stats.expenses.length === 0 && stats.cash.incomeCents === 0 && stats.cash.expenseCents === 0
  const maxProduct = Math.max(1, ...(stats?.topProducts.map((p) => p.revenueCents) ?? []))
  const maxMethod = Math.max(1, ...(stats?.incomeByMethod.map((m) => m.totalCents) ?? []))

  return (
    <>
      <section className="row-between">
        <h1>Estadísticas</h1>
        <Link to="/balance" className="btn ghost small">Balance</Link>
      </section>
      <div className="tabs" role="tablist" aria-label="Periodo">
        {PERIODS.map((p) => (
          <button key={p.value} type="button" role="tab" aria-selected={period === p.value} className={`tab-btn ${period === p.value ? 'on' : ''}`} onClick={() => go(p.value, anchor)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="period-nav">
        <button type="button" className="icon-btn" aria-label="Periodo anterior" onClick={() => go(period, shiftStatsAnchor(period, anchor, -1))}>‹</button>
        <strong className="grow">{statsLabel(period, anchor)}</strong>
        <button type="button" className="icon-btn" aria-label="Periodo siguiente" disabled={!canGoForward} onClick={() => go(period, next)}>›</button>
      </div>

      {!stats ? (
        <p className="loading">Calculando…</p>
      ) : (
        <>
          <section className="kpis" aria-label="Resumen del periodo">
            <div className="card kpi wide">
              <small>Ventas registradas</small>
              <strong>{money(stats.salesCents)}</strong>
              <span className="muted">{stats.salesCount === 1 ? '1 venta' : `${stats.salesCount} ventas`}{stats.salesCount > 0 && ` · ticket promedio ${money(stats.avgTicketCents)}`}</span>
            </div>
            <div className="card kpi"><small>Cobrado</small><strong>{money(stats.cash.incomeCents)}</strong></div>
            <div className="card kpi"><small>Pagado</small><strong>{money(stats.cash.expenseCents)}</strong></div>
            <div className="card kpi"><small>Utilidad</small><strong className={stats.cash.profitCents < 0 ? 'neg' : ''}>{money(stats.cash.profitCents)}</strong></div>
            <div className="card kpi"><small>Ganancia de productos</small><strong>{money(stats.productProfitCents)}</strong></div>
          </section>
          <p className="muted note">«Ventas registradas» incluye lo vendido fiado; «Cobrado» y «Pagado» son el dinero que entró y salió, como en el Balance.</p>

          {empty ? (
            <section className="card empty-state">
              <span aria-hidden>📈</span>
              <h2>Sin movimientos en este periodo</h2>
              <p className="muted">Cambia de periodo con las flechas o registra ventas y gastos para ver tus estadísticas.</p>
            </section>
          ) : (
            <>
              <section className="card">
                <h2>{period === 'year' ? 'Ventas por mes' : 'Ventas por día'}</h2>
                <BarChart
                  title={`Ventas registradas por ${period === 'year' ? 'mes' : 'día'}, ${statsLabel(period, anchor)}`}
                  data={stats.buckets.map((b) => ({ key: b.key, label: period === 'year' ? `${b.label} ${b.start.slice(0, 4)}` : period === 'week' ? `${b.label} ${formatDay(b.start)}` : formatDay(b.start), value: b.salesCents }))}
                  format={money}
                  formatTick={(v) => `$${compact.format(v / 100)}`}
                  labelEvery={period === 'month' ? 5 : 1}
                />
              </section>

              <section className="card">
                <h2>Más vendidos</h2>
                {stats.topProducts.length === 0 ? (
                  <p className="muted">Aún no hay ventas de productos del inventario en este periodo.</p>
                ) : (
                  <ul className="ranking">
                    {stats.topProducts.map((p) => (
                      <li key={p.productId}>
                        <div className="row-between"><span>{p.name}</span><strong>{money(p.revenueCents)}</strong></div>
                        <div className="meter" aria-hidden><span style={{ width: `${(p.revenueCents / maxProduct) * 100}%` }} /></div>
                        <small className="muted">{formatQuantity(p.quantity)} {p.quantity === 1 ? 'vendido' : 'vendidos'} · ganancia {money(p.profitCents)}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card">
                <h2>Gastos por categoría</h2>
                {stats.expensesByCategory.length === 0 ? (
                  <p className="muted">Sin gastos registrados en este periodo.</p>
                ) : (
                  <ul className="ranking">
                    {stats.expensesByCategory.map((c) => (
                      <li key={c.categoryId ?? 'sin'}>
                        <div className="row-between"><span>{c.name}</span><strong>{money(c.totalCents)}</strong></div>
                        <div className="meter" aria-hidden><span style={{ width: `${c.share * 100}%` }} /></div>
                        <small className="muted">{Math.round(c.share * 100)} % de los gastos</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card">
                <h2>Cobrado por método</h2>
                {stats.incomeByMethod.length === 0 ? (
                  <p className="muted">Sin cobros en este periodo.</p>
                ) : (
                  <ul className="ranking">
                    {stats.incomeByMethod.map((m) => (
                      <li key={m.method}>
                        <div className="row-between"><span>{m.label}</span><strong>{money(m.totalCents)}</strong></div>
                        <div className="meter" aria-hidden><span style={{ width: `${(m.totalCents / maxMethod) * 100}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          <section className="card">
            <h2>Descargar reporte</h2>
            <p className="muted">Excel con hojas de resumen, ventas, productos vendidos, gastos, cobros y pagos e inventario; o un resumen en PDF.</p>
            <div className="quick">
              <button type="button" className="btn ghost" disabled={busy} onClick={() => void download('xlsx')}>Excel</button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => void download('pdf')}>PDF</button>
            </div>
            {message && <p className={message.ok ? 'muted' : 'error'} role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
          </section>
        </>
      )}
    </>
  )
}
