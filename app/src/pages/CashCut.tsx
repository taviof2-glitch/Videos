import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cashCut, lastMonthAnchor, monthGoal, saveMonthGoal } from '../data/cashcut'
import { addDays, dayKey, formatDay } from '../data/dates'
import { formatMoney, parseMoney } from '../data/money'
import { reportFileName, reportPdf, reportXlsx } from '../data/reports'
import { computeStats, statsLabel } from '../data/stats'
import type { Business } from '../data/types'
import { downloadBlob } from '../ui/share'
import ForecastCard from '../ui/ForecastCard'
import TaxCard from '../ui/TaxCard'

/** Corte de caja del día o de la semana, meta de ventas del mes y reporte del mes pasado para el contador. */
export default function CashCut({ business }: { business: Business }) {
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  const [period, setPeriod] = useState<'day' | 'week'>('day')
  const [anchor, setAnchor] = useState(today)
  const cut = useLiveQuery(() => cashCut(business.id, period, anchor, business.timezone), [business.id, period, anchor, business.timezone])
  const goal = useLiveQuery(() => (business.monthGoalCents ? monthGoal(business.id, business.monthGoalCents, today, business.timezone) : Promise.resolve(undefined)), [business.id, business.monthGoalCents, today])
  const [goalText, setGoalText] = useState(business.monthGoalCents ? String(business.monthGoalCents / 100) : '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const money = (c: number) => formatMoney(c, business.currency)
  const step = period === 'day' ? 1 : 7
  const last = lastMonthAnchor(today)

  async function report(kind: 'xlsx' | 'pdf') {
    setBusy(true)
    setMsg('')
    try {
      const stats = await computeStats(business.id, 'month', last, business.timezone)
      const bytes = kind === 'xlsx' ? await reportXlsx(business, 'month', last, stats) : reportPdf(business, 'month', last, stats)
      const name = reportFileName(business, 'month', last, kind)
      const type = kind === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'
      if (await downloadBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }), name)) setMsg(`Se guardó ${name}.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo crear el reporte')
    }
    setBusy(false)
  }

  return (
    <>
      <h1>Corte de caja</h1>
      <div className="tabs" role="tablist">
        {(['day', 'week'] as const).map((p) => <button key={p} type="button" role="tab" aria-selected={period === p} className={`tab-btn ${period === p ? 'on' : ''}`} onClick={() => { setPeriod(p); setAnchor(today) }}>{p === 'day' ? 'Día' : 'Semana'}</button>)}
      </div>
      <div className="row-between period-nav">
        <button type="button" className="btn ghost small" aria-label="Anterior" onClick={() => setAnchor(addDays(anchor, -step))}><ChevronLeft aria-hidden /></button>
        <strong className="grow">{cut ? (period === 'day' ? (cut.from === today ? 'Hoy' : formatDay(cut.from)) : `${formatDay(cut.from)} – ${formatDay(cut.to)}`) : '…'}</strong>
        <button type="button" className="btn ghost small" aria-label="Siguiente" disabled={anchor >= today} onClick={() => setAnchor(addDays(anchor, step))}><ChevronRight aria-hidden /></button>
      </div>

      {cut && (
        <section className="card">
          <div className="fixed-totals">
            <div><small className="muted">Entró</small><strong className="amount sale">{money(cut.inCents)}</strong></div>
            <div><small className="muted">Salió</small><strong className="amount expense">{money(cut.outCents)}</strong></div>
            <div><small className="muted">Queda</small><strong>{money(cut.netCents)}</strong></div>
          </div>
          {cut.rows.length === 0 ? <p className="muted">No hubo movimientos de dinero.</p> : (
            <table className="cut-table">
              <thead><tr><th>Forma de pago</th><th>Entró</th><th>Salió</th><th>Neto</th></tr></thead>
              <tbody>{cut.rows.map((r) => <tr key={r.method}><td>{r.label}</td><td>{money(r.inCents)}</td><td>{money(r.outCents)}</td><td><strong>{money(r.netCents)}</strong></td></tr>)}</tbody>
            </table>
          )}
          <p className="note-box">💵 Efectivo que debe haber de {period === 'day' ? 'este día' : 'esta semana'}: <strong>{money(cut.cashCents)}</strong>{cut.rows.some((r) => r.method !== 'cash' && r.netCents) ? ` · en banco (transferencia y tarjeta): ${money(cut.rows.filter((r) => r.method === 'transfer' || r.method === 'card').reduce((s, r) => s + r.netCents, 0))}` : ''}</p>
          <small className="muted">Cuenta ventas de contado, abonos, gastos pagados y pagos a proveedores. Lo fiado cuenta cuando te lo pagan. {cut.salesCount} {cut.salesCount === 1 ? 'venta de contado' : 'ventas de contado'}.</small>
        </section>
      )}

      <section className="card form">
        <h2>Meta de ventas del mes</h2>
        <label>Meta ($)<input value={goalText} onChange={(e) => setGoalText(e.target.value)} onBlur={() => void saveMonthGoal(business.id, goalText.trim() ? (parseMoney(goalText) ?? undefined) : undefined)} inputMode="decimal" placeholder="Ej. 80000" /></label>
        {goal && (
          <>
            <div className="goal-bar" role="progressbar" aria-valuenow={goal.pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${goal.pct}%` }} /><i style={{ left: `${Math.min(100, (goal.expectedCents / goal.goalCents) * 100)}%` }} /></div>
            <p className="muted">Vendido {money(goal.soldCents)} de {money(goal.goalCents)} ({goal.pct} %). {goal.soldCents >= goal.goalCents ? '¡Meta cumplida! 🎉' : `${goal.soldCents >= goal.expectedCents ? 'Vas adelantado' : 'Vas atrasado'}: faltan ${money(goal.goalCents - goal.soldCents)}${goal.daysLeft ? `, unos ${money(goal.perDayCents)} por día en los ${goal.daysLeft} días que quedan` : ''}.`}</p>
          </>
        )}
      </section>

      <ForecastCard business={business} today={today} />

      <TaxCard business={business} today={today} />

      <section className="card form">
        <h2>Reporte para el contador</h2>
        <p className="muted">Todo {statsLabel('month', last)}: ventas, gastos, cobros, pagos e inventario.</p>
        <div className="quick">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void report('xlsx')}>Excel</button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void report('pdf')}>PDF</button>
        </div>
        {msg && <p className="muted" role="status">{msg}</p>}
      </section>
    </>
  )
}
