import { useLiveQuery } from 'dexie-react-hooks'
import { hourProfitByType } from '../data/hourProfit'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { dayKey, formatDay } from '../data/dates'
import { formatMoney } from '../data/money'
import { formatQuantity } from '../data/quantity'
import { reportFileName, reportPdf, reportXlsx } from '../data/reports'
import { computeStats, shiftStatsAnchor, statsBuckets, statsLabel, type StatsPeriod } from '../data/stats'
import type { PersonTotal } from '../data/stats'
import type { Business } from '../data/types'
import BarChart from '../ui/BarChart'
import DonutChart from '../ui/DonutChart'
import { downloadBlob } from '../ui/share'
import { ChartLine, ChevronLeft, ChevronRight } from 'lucide-react'
import { listContacts } from '../data/contacts'
import { jobProfit, listJobs } from '../data/jobs'

const PERIODS: { value: StatsPeriod; param: string; label: string }[] = [
  { value: 'day', param: 'dia', label: 'Día' },
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
  const section: 'ventas' | 'gastos' = params.get('s') === 'gastos' ? 'gastos' : 'ventas'
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
    if (section === 'gastos') q.s = 'gastos'
    setParams(q, { replace: true })
    setMessage(undefined)
  }

  function pickSection(next: 'ventas' | 'gastos') {
    const q = new URLSearchParams(params)
    if (next === 'gastos') q.set('s', 'gastos')
    else q.delete('s')
    setParams(q, { replace: true })
  }

  /** Datos de la gráfica de barras: por hora en «Día», por día en semana y mes, por mes en el año. */
  const chartData = (pick: (b: NonNullable<typeof stats>['buckets'][number]) => number) =>
    (stats?.buckets ?? []).map((b) => ({
      key: b.key,
      label: period === 'day' ? `${b.key}:00 – ${b.key}:59` : period === 'year' ? `${b.label} ${b.start.slice(0, 4)}` : period === 'week' ? `${b.label} ${formatDay(b.start)}` : formatDay(b.start),
      short: b.label,
      value: pick(b),
    }))
  const unit = period === 'year' ? 'mes' : period === 'day' ? 'hora' : 'día'
  const labelEvery = period === 'month' ? 5 : period === 'day' ? 3 : 1

  const people = (list: PersonTotal[], noun: string) => {
    const max = Math.max(1, ...list.map((p) => p.totalCents))
    return (
      <ul className="ranking">
        {list.map((p) => (
          <li key={p.contactId ?? 'sin'}>
            <div className="row-between">
              <span>
                {p.name}
                <span className={`badge ${p.registered ? 'yes' : 'no'}`}>{p.registered ? 'Registrado' : 'Sin registrar'}</span>
              </span>
              <strong>{money(p.totalCents)}</strong>
            </div>
            <div className="meter" aria-hidden><span style={{ width: `${(p.totalCents / max) * 100}%` }} /></div>
            <small className="muted">{p.count === 1 ? `1 ${noun}` : `${p.count} ${noun}s`} · {Math.round(p.share * 100)} % del total</small>
          </li>
        ))}
      </ul>
    )
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
        <button type="button" className="icon-btn" aria-label="Periodo anterior" onClick={() => go(period, shiftStatsAnchor(period, anchor, -1))}><ChevronLeft aria-hidden /></button>
        <strong className="grow">{statsLabel(period, anchor)}</strong>
        <button type="button" className="icon-btn" aria-label="Periodo siguiente" disabled={!canGoForward} onClick={() => go(period, next)}><ChevronRight aria-hidden /></button>
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

          <div className="seg" role="tablist" aria-label="Qué ver">
            <button type="button" role="tab" className="sale" aria-selected={section === 'ventas'} onClick={() => pickSection('ventas')}>Ventas</button>
            <button type="button" role="tab" className="expense" aria-selected={section === 'gastos'} onClick={() => pickSection('gastos')}>Gastos</button>
          </div>

          {empty ? (
            <section className="card empty-state">
              <ChartLine aria-hidden strokeWidth={1.75} />
              <h2>Sin movimientos en este periodo</h2>
              <p className="muted">Cambia de periodo con las flechas o registra ventas y gastos para ver tus estadísticas.</p>
            </section>
          ) : section === 'ventas' ? (
            <>
              <section className="card">
                <h2>Ventas por {unit}</h2>
                <BarChart
                  title={`Ventas registradas por ${unit}, ${statsLabel(period, anchor)}`}
                  data={chartData((b) => b.salesCents)}
                  format={money}
                  formatTick={(v) => `$${compact.format(v / 100)}`}
                  labelEvery={labelEvery}
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
                <h2>Quién compró más</h2>
                {stats.topCustomers.length === 0 ? <p className="muted">Sin ventas en este periodo.</p> : people(stats.topCustomers, 'compra')}
                <p className="muted note">«Registrado» es un cliente que ya tienes en Clientes. Las ventas sin cliente se juntan en una sola fila.</p>
              </section>

              {stats.sellers.length > 0 && (
                <section className="card">
                  <h2>Quién vendió más</h2>
                  <ul className="ranking">
                    {stats.sellers.map((s) => (
                      <li key={s.employeeId ?? 'sin'}>
                        <div className="row-between">
                          <span>{s.name}{s.role === 'owner' && <span className="badge yes">Dueño</span>}</span>
                          <strong>{money(s.totalCents)}</strong>
                        </div>
                        <div className="meter" aria-hidden><span style={{ width: `${(s.totalCents / Math.max(1, stats.sellers[0].totalCents)) * 100}%` }} /></div>
                        <small className="muted">{s.count === 1 ? '1 venta' : `${s.count} ventas`} · {Math.round(s.share * 100)} % del total</small>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

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
          ) : (
            <>
              <section className="card kpi wide">
                <small>Gastos registrados</small>
                <strong className="neg">{money(stats.expensesCents)}</strong>
                <span className="muted">
                  {stats.expenses.length === 1 ? '1 gasto' : `${stats.expenses.length} gastos`}
                  {stats.expenses.length > 0 && ` · promedio ${money(Math.round(stats.expensesCents / stats.expenses.length))}`}
                </span>
              </section>

              <section className="card">
                <h2>Gastos por {unit}</h2>
                <BarChart
                  tone="expense"
                  title={`Gastos registrados por ${unit}, ${statsLabel(period, anchor)}`}
                  data={chartData((b) => b.expenseCents)}
                  format={money}
                  formatTick={(v) => `$${compact.format(v / 100)}`}
                  labelEvery={labelEvery}
                />
              </section>

              <section className="card">
                <h2>En qué se gastó</h2>
                {stats.expensesByCategory.length === 0 ? (
                  <p className="muted">Sin gastos registrados en este periodo.</p>
                ) : (
                  <DonutChart
                    title={`Gastos por categoría, ${statsLabel(period, anchor)}`}
                    totalLabel="Total gastado"
                    format={money}
                    data={stats.expensesByCategory.map((c) => ({ key: c.categoryId ?? 'sin', label: c.name, value: c.totalCents }))}
                  />
                )}
              </section>

              <section className="card">
                <h2>A quién se le pagó más</h2>
                {stats.topSuppliers.length === 0 ? <p className="muted">Sin gastos en este periodo.</p> : people(stats.topSuppliers, 'gasto')}
              </section>
            </>
          )}

          <JobsProfit business={business} />
          <HourProfit business={business} />

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

/** Rentabilidad por obra: lo cobrado contra lo que costó de verdad (gastos y compras de la obra, material y horas). */
function JobsProfit({ business }: { business: Business }) {
  const rows = useLiveQuery(async () => {
    const names = new Map((await listContacts(business.id, 'customer')).map((c) => [c.id, c.name]))
    return (await listJobs(business.id))
      .map((j) => ({ j, p: jobProfit(business, j), who: names.get(j.contactId ?? '') ?? '' }))
      .filter((x): x is typeof x & { p: NonNullable<typeof x.p> } => !!x.p)
      .sort((a, b) => (b.j.job.startedAt ?? '').localeCompare(a.j.job.startedAt ?? ''))
  }, [business])
  if (!rows) return null
  const money = (c: number) => formatMoney(c, business.currency)
  const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : '—')
  const total = rows.reduce((s, x) => ({ income: s.income + x.p.incomeCents, cost: s.cost + x.p.realCostCents }), { income: 0, cost: 0 })
  return (
    <section className="card">
      <h2>Ganancia por obra</h2>
      {rows.length === 0 ? (
        <p className="muted">Cuando registres gastos o compras «para la obra», o anotes material y horas en Obras, aquí verás cuánto dejó cada una.</p>
      ) : (
        <>
          <p className="muted">{rows.length === 1 ? '1 obra' : `${rows.length} obras`} con costos: cobraste {money(total.income)}, costaron {money(total.cost)} → ganancia <strong>{money(total.income - total.cost)}</strong> ({pct(total.income - total.cost, total.income)}).</p>
          <ul className="moves">
            {rows.map(({ j, p, who }) => (
              <li key={j.id}>
                <span>{[who, j.title].filter(Boolean).join(' · ')}<small className="muted"> · cobro {money(p.incomeCents)} · costó {money(p.realCostCents)}{p.estimatedCostCents !== undefined ? ` (cotizado ${money(p.estimatedCostCents)})` : ''}</small></span>
                <strong className={p.profitCents < 0 ? 'neg' : 'pos'}>{money(p.profitCents)} <small>({pct(p.profitCents, p.incomeCents)})</small></strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** Qué tipo de mueble deja más por cada hora de trabajo. */
function HourProfit({ business }: { business: Business }) {
  const rows = useLiveQuery(async () => hourProfitByType(business, await listJobs(business.id)), [business])
  if (!rows || !rows.length) return null
  const money = (c: number) => formatMoney(c, business.currency)
  const top = Math.max(...rows.map((r) => r.perHourCents), 1)
  return (
    <section className="card">
      <h2>Ganancia por hora por tipo de mueble</h2>
      <p className="muted">Lo cobrado (sin IVA) menos material y gastos de la obra, entre las horas de trabajo. Así ves qué muebles conviene más vender.</p>
      <ul className="moves">
        {rows.map((r) => (
          <li key={r.key} style={{ display: 'grid', gap: 4 }}>
            <div className="row-between"><span>{r.label}<small className="muted"> · {r.jobs} {r.jobs === 1 ? 'obra' : 'obras'} · {r.hours} h{r.estimated ? ' (algunas estimadas)' : ''}</small></span><strong className={r.perHourCents < 0 ? 'neg' : 'pos'}>{money(r.perHourCents)}/h</strong></div>
            <div className="goal-bar" aria-hidden><span style={{ width: `${Math.max(2, (Math.max(0, r.perHourCents) / top) * 100)}%` }} /></div>
          </li>
        ))}
      </ul>
      <small className="muted">Anota las horas reales en Obras para que sea más exacto.</small>
    </section>
  )
}
