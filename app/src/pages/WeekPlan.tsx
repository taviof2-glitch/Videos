import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Wand2 } from 'lucide-react'
import { jobLeftHours } from '../data/capacity'
import { listContacts } from '../data/contacts'
import { addDays, dayKey, formatDay, weekdayShort, weekStart } from '../data/dates'
import { isLate, listJobs, STAGE_LABEL } from '../data/jobs'
import type { Business } from '../data/types'
import { autoPlan, hoursPerDay, isPlannable, planByDay, planWeekDays, savePlan, togglePlanDay } from '../data/weekPlan'

/** Plan de la semana en el taller: qué obra se trabaja cada día, con aviso si un día queda sobrecargado. */
export default function WeekPlan({ business }: { business: Business }) {
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  const [anchor, setAnchor] = useState(today)
  const [msg, setMsg] = useState('')
  const days = planWeekDays(anchor)
  const data = useLiveQuery(async () => {
    const [jobs, customers] = await Promise.all([listJobs(business.id), listContacts(business.id, 'customer')])
    return { jobs: jobs.filter(isPlannable).sort((a, b) => (a.job.deliveryDate ?? '9999').localeCompare(b.job.deliveryDate ?? '9999')), names: new Map(customers.map((c) => [c.id, c.name])) }
  }, [business.id])
  if (!data) return <p className="loading">Cargando…</p>
  const { jobs, names } = data
  const plan = planByDay(business, jobs, days, today)
  const cap = hoursPerDay(business)
  const name = (j: (typeof jobs)[number]) => [names.get(j.contactId ?? ''), j.title].filter(Boolean).join(' · ')
  const unplanned = jobs.filter((j) => !(j.job.planDays ?? []).some((d) => d >= today))
  const thisWeek = weekStart(anchor) === weekStart(today)

  async function auto() {
    await savePlan(jobs, days, autoPlan(business, jobs, days, today))
    setMsg('Listo: acomodé las obras por fecha de entrega. Ajusta los días que quieras.')
  }

  return (
    <>
      <h1>Plan de la semana</h1>
      <p className="muted">Qué obra se trabaja cada día en el taller. Las horas que le faltan a cada obra se reparten entre sus días; el taller trabaja {cap} h al día (se cambia en el Cotizador).</p>
      <div className="row-between period-nav">
        <button type="button" className="btn ghost small" aria-label="Semana anterior" onClick={() => setAnchor(addDays(anchor, -7))}><ChevronLeft aria-hidden /></button>
        <strong className="grow">{thisWeek ? 'Esta semana' : `${formatDay(days[0])} – ${formatDay(days[5])}`}</strong>
        {!thisWeek && <button type="button" className="link" onClick={() => setAnchor(today)}>Hoy</button>}
        <button type="button" className="btn ghost small" aria-label="Semana siguiente" onClick={() => setAnchor(addDays(anchor, 7))}><ChevronRight aria-hidden /></button>
      </div>
      {jobs.length > 0 && days[5] >= today && <button type="button" className="btn primary" onClick={() => void auto()}><Wand2 aria-hidden /> Acomodar solo esta semana</button>}
      {msg && <p className="success" role="status">{msg}</p>}
      {plan.some((d) => d.over) && <p className="note-box bad">⚠️ {plan.filter((d) => d.over).map((d) => `${weekdayShort(d.day)} ${formatDay(d.day)}`).join(', ')}: más trabajo del que cabe en {cap} h. Mueve alguna obra a otro día o avisa al cliente.</p>}

      {plan.some((d) => d.day < today) && plan.some((d) => d.day >= today) && <small className="muted">Los días que ya pasaron no se muestran.</small>}
      {days[5] >= today && days[4] < today && <button type="button" className="btn ghost small" onClick={() => setAnchor(addDays(anchor, 7))}>Planear la próxima semana →</button>}
      {plan.filter((d) => d.day >= today || days[5] < today).map((d) => (
        <section key={d.day} className={`card plan-day ${d.over ? 'over' : ''} ${d.day === today ? 'today' : ''}`}>
          <div className="row-between">
            <h2>{d.day === today ? 'Hoy' : `${weekdayShort(d.day)} ${formatDay(d.day)}`}</h2>
            <small className={d.over ? 'neg' : 'muted'}>{d.hours} de {cap} h</small>
          </div>
          <div className="plan-bar" aria-hidden><span style={{ width: `${Math.min(100, (d.hours / cap) * 100)}%` }} /></div>
          {d.entries.length ? d.entries.map((e) => (
            <div key={e.job.id} className="plan-job">
              <span>{name(e.job)}<small className="muted"> · {STAGE_LABEL[e.job.job.stage]} · {e.hours} h</small></span>
              {d.day >= today && <button type="button" className="link danger-link" aria-label={`Quitar ${e.job.title} de este día`} onClick={() => void togglePlanDay(e.job, d.day)}>×</button>}
            </div>
          )) : <p className="muted">{d.day < today ? 'Ya pasó.' : 'Libre.'}</p>}
        </section>
      ))}

      <section className="card">
        <h2>Obras en el taller</h2>
        {jobs.length === 0 ? <p className="muted">No hay obras activas. Pasa una cotización a obra para planearla.</p> : (
          <ul className="moves">
            {jobs.map((j) => (
              <li key={j.id} style={{ display: 'grid', gap: 6 }}>
                <span>
                  <strong>{name(j)}</strong>
                  <small className="muted"> · {STAGE_LABEL[j.job.stage]} · faltan ~{Math.round(jobLeftHours(business, j))} h{j.job.deliveryDate ? ` · entrega ${formatDay(j.job.deliveryDate)}` : ' · sin fecha'}{isLate(j.job, today) ? ' · ATRASADA' : ''}</small>
                </span>
                <div className="day-chips" role="group" aria-label={`Días para ${j.title}`}>
                  {days.map((d) => {
                    const on = (j.job.planDays ?? []).includes(d)
                    return <button key={d} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} disabled={d < today} onClick={() => void togglePlanDay(j, d)}>{weekdayShort(d)} {formatDay(d).split(' ')[0]}</button>
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
        {unplanned.length > 0 && <small className="muted">{unplanned.length === 1 ? '1 obra sin días planeados' : `${unplanned.length} obras sin días planeados`}. Toca los días o usa «Acomodar solo».</small>}
        <Link to="/obras" className="btn ghost small">Ver obras</Link>
      </section>
    </>
  )
}
