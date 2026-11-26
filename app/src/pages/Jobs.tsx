import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listContacts } from '../data/contacts'
import { addDays, addMonths, dayKey, dayNumber, formatDay, monthStart, periodLabel, weekStart } from '../data/dates'
import { docNumber } from '../data/folio'
import { addJobPhoto, awaitingPayment, balanceDue, balanceReminder, dueThisWeek, isDelivered, isLate, jobProfit, listJobs, MAX_JOB_PHOTOS, removeJob, removeJobPhoto, setJobStage, shoppingList, shoppingText, STAGE_LABEL, STAGES, startJob, updateJob, warrantyUntil } from '../data/jobs'
import { formatMoney, parseMoney } from '../data/money'
import { quoterSettings } from '../data/quoter'
import { listQuotes } from '../data/quotes'
import { whatsappLink } from '../data/reminder'
import type { Business, JobStage, Quote } from '../data/types'
import { useCan } from '../ui/actor'
import { preparePhoto } from '../ui/logo'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Obras del taller: en qué etapa va cada trabajo, cuándo se entrega y cuánto dejó. */
export default function Jobs({ business }: { business: Business }) {
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  const [open, setOpen] = useState<string>()
  const [adding, setAdding] = useState(false)
  const jobs = useLiveQuery(() => listJobs(business.id), [business.id])
  const contacts = useLiveQuery(async () => new Map((await listContacts(business.id, 'customer')).map((c) => [c.id, c])), [business.id])
  const names = useMemo(() => new Map([...(contacts ?? [])].map(([id, c]) => [id, c.name])), [contacts])
  const [month, setMonth] = useState(() => monthStart(today))
  const [day, setDay] = useState<string>()
  const money = (c: number) => formatMoney(c, business.currency)
  if (!jobs) return <p className="loading">Cargando…</p>

  const late = jobs.filter((q) => isLate(q.job!, today))
  const week = jobs.filter((q) => dueThisWeek(q.job!, today))
  const active = jobs.filter((q) => q.job!.stage !== 'liquidado')
  const upcoming = jobs.filter((q) => q.job!.deliveryDate && !isDelivered(q.job!)).sort((a, b) => a.job!.deliveryDate!.localeCompare(b.job!.deliveryDate!))

  return (
    <>
      <section className="row-between">
        <h1>Obras</h1>
        <Link to="/mas" className="btn ghost small">Más</Link>
      </section>
      <p className="muted">Los trabajos que ya te aceptaron: en qué etapa van, cuándo se entregan y cuánto dejaron.</p>

      {jobs.length > 0 && (
        <section className="card">
          <div className="fixed-totals">
            <div><small className="muted">En proceso</small><strong>{active.length}</strong></div>
            <div><small className="muted">Esta semana</small><strong>{week.length}</strong></div>
            <div><small className="muted">Atrasadas</small><strong className={late.length ? 'amount expense' : ''}>{late.length}</strong></div>
          </div>
          {upcoming.length > 0 && (
            <>
              <h2>Próximas entregas</h2>
              <ul className="fixed-paid">
                {upcoming.slice(0, 6).map((q) => (
                  <li key={q.id}>
                    <button type="button" className="link" onClick={() => setOpen(q.id)}>{formatDay(q.job!.deliveryDate!)} · {names.get(q.contactId) ?? 'Cliente'} · {q.title}</button>
                    {isLate(q.job!, today) && <span className="badge out">Atrasada</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {jobs.some((q) => q.job!.deliveryDate) && (
        <section className="card">
          <div className="period-nav">
            <button type="button" className="icon-btn" aria-label="Mes anterior" onClick={() => { setMonth(addMonths(month, -1)); setDay(undefined) }}><ChevronLeft aria-hidden /></button>
            <strong className="grow">{periodLabel('month', month)}</strong>
            <button type="button" className="icon-btn" aria-label="Mes siguiente" onClick={() => { setMonth(addMonths(month, 1)); setDay(undefined) }}><ChevronRight aria-hidden /></button>
          </div>
          <div className="cal" role="grid" aria-label="Calendario de entregas">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} className="cal-head" aria-hidden>{d}</span>)}
            {Array.from({ length: 42 }, (_, i) => addDays(weekStart(month), i)).map((d) => {
              const here = jobs.filter((q) => q.job!.deliveryDate === d)
              const inMonth = d.slice(0, 7) === month.slice(0, 7)
              const lateHere = here.some((q) => isLate(q.job!, today))
              return (
                <button key={d} type="button" role="gridcell" disabled={!here.length} aria-pressed={day === d} aria-label={`${formatDay(d)}${here.length ? `: ${here.length === 1 ? '1 entrega' : `${here.length} entregas`}` : ''}`}
                  className={`cal-day${inMonth ? '' : ' out'}${d === today ? ' today' : ''}${here.length ? ' has' : ''}${lateHere ? ' late' : ''}${day === d ? ' on' : ''}`} onClick={() => setDay(day === d ? undefined : d)}>
                  {dayNumber(d)}
                  {here.length > 0 && <span className="cal-dot" aria-hidden>{here.length}</span>}
                </button>
              )
            })}
          </div>
          {day && (
            <ul className="fixed-paid">
              {jobs.filter((q) => q.job!.deliveryDate === day).map((q) => (
                <li key={q.id}><button type="button" className="link" onClick={() => setOpen(q.id)}>{names.get(q.contactId) ?? 'Cliente'} · {q.title} · {STAGE_LABEL[q.job!.stage]}</button></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {jobs.length === 0 && !adding && (
        <section className="card empty-state">
          <p>Todavía no tienes obras. Cuando un cliente acepte una cotización, pásala a obra para seguirla hasta entregarla y cobrarla.</p>
        </section>
      )}

      {STAGES.map((stage) => {
        const here = jobs.filter((q) => q.job!.stage === stage)
        if (!here.length) return null
        return (
          <section key={stage} className="job-stage">
            <h2>{STAGE_LABEL[stage]} <small className="muted">({here.length})</small></h2>
            <ul className="fixed-list">
              {here.map((q) => (
                <JobCard key={q.id} business={business} quote={q} phone={contacts?.get(q.contactId)?.phone ?? ''} customer={names.get(q.contactId) ?? 'Cliente'} today={today} open={open === q.id} onToggle={() => setOpen(open === q.id ? undefined : q.id)} money={money} />
              ))}
            </ul>
          </section>
        )
      })}

      {adding ? <AddJob business={business} names={names} onDone={() => setAdding(false)} /> : <button type="button" className="btn primary" onClick={() => setAdding(true)}>Agregar obra</button>}
    </>
  )
}

function JobCard({ business, quote, customer, phone, today, open, onToggle, money }: { business: Business; quote: Quote; customer: string; phone: string; today: string; open: boolean; onToggle: () => void; money: (c: number) => string }) {
  const job = quote.job!
  const can = useCan()
  const i = STAGES.indexOf(job.stage)
  const [error, setError] = useState('')
  const run = (p: Promise<unknown>) => void p.catch((e) => setError(e instanceof Error ? e.message : 'No se pudo guardar'))
  const go = (stage: JobStage) => run(setJobStage(quote.id, stage, today))
  return (
    <li className="card">
      <div className="row-between">
        <strong>{customer}</strong>
        <strong>{money(quote.totalCents)}</strong>
      </div>
      <div className="row-between">
        <small className="muted">{quote.title} · {docNumber(quote)}</small>
        {job.deliveryDate && <span className={`badge ${isLate(job, today) ? 'out' : isDelivered(job) ? 'ok' : 'muted'}`}>{isLate(job, today) ? 'Atrasada · ' : isDelivered(job) ? 'Entregada · ' : 'Entrega '}{formatDay(isDelivered(job) && job.deliveredAt ? job.deliveredAt : job.deliveryDate)}</span>}
      </div>
      <div className="meter" aria-hidden><span style={{ width: `${((i + 1) / STAGES.length) * 100}%` }} /></div>
      <div className="quick">
        {i > 0 && <button type="button" className="btn ghost" onClick={() => go(STAGES[i - 1])}>← Regresar</button>}
        {i < STAGES.length - 1 && <button type="button" className="btn primary" onClick={() => go(STAGES[i + 1])}>{STAGE_LABEL[STAGES[i + 1]]} →</button>}
      </div>
      {awaitingPayment(job) && balanceDue(quote) > 0 && (
        <a className="btn sale" href={whatsappLink(balanceReminder({ customer, businessName: business.name, title: quote.title, balanceCents: balanceDue(quote), currency: business.currency }), phone, business.country)} target="_blank" rel="noopener noreferrer">Recordar saldo de {money(balanceDue(quote))} por WhatsApp</a>
      )}
      <button type="button" className="btn ghost" aria-expanded={open} onClick={onToggle}>{open ? 'Ocultar detalles' : 'Detalles'}</button>
      {error && <p className="error" role="alert">{error}</p>}
      {open && <JobDetails business={business} quote={quote} customer={customer} money={money} showCosts={can('balance')} onError={setError} />}
    </li>
  )
}

function JobDetails({ business, quote, customer, money, showCosts, onError }: { business: Business; quote: Quote; customer: string; money: (c: number) => string; showCosts: boolean; onError: (m: string) => void }) {
  const job = quote.job!
  const [material, setMaterial] = useState(job.realMaterialCents !== undefined ? (job.realMaterialCents / 100).toFixed(2) : '')
  const [hours, setHours] = useState(job.realHours !== undefined ? String(job.realHours) : '')
  const [note, setNote] = useState(job.note ?? '')
  const [warranty, setWarranty] = useState(job.warrantyMonths ? String(job.warrantyMonths) : '')
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState('')
  const { cfg } = quoterSettings(business)
  const list = shoppingList(quote, cfg)
  const text = shoppingText(quote, cfg, customer)
  const profit = jobProfit(business, quote)
  const until = warrantyUntil(job)
  const save = (patch: Parameters<typeof updateJob>[1]) => void updateJob(quote.id, patch).then(() => setMsg('Guardado.'), (e) => onError(e instanceof Error ? e.message : 'No se pudo guardar'))

  return (
    <div className="form fixed-form">
      <div className="two">
        <label>Fecha de entrega<input type="date" value={job.deliveryDate ?? ''} onChange={(e) => save({ deliveryDate: e.target.value || undefined })} /></label>
        <label>Garantía <small className="muted">(meses)</small><input value={warranty} onChange={(e) => setWarranty(e.target.value)} onBlur={() => save({ warrantyMonths: parseInt(warranty) || undefined })} inputMode="numeric" placeholder="Ej. 12" /></label>
      </div>
      {until && <p className="note-box">Entregada el {formatDay(job.deliveredAt!)}. La garantía cubre hasta el <strong>{formatDay(until)}</strong>.</p>}
      <label>Notas de la obra<input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => save({ note: note.trim() || undefined })} placeholder="Ej. color nogal, instalar por la tarde" /></label>

      {showCosts && (
        <>
          <h3>Lo que costó de verdad</h3>
          <div className="two">
            <label>Material gastado <small className="muted">($)</small><input value={material} onChange={(e) => setMaterial(e.target.value)} onBlur={() => save({ realMaterialCents: material.trim() ? (parseMoney(material) ?? undefined) : undefined })} inputMode="decimal" placeholder="0.00" /></label>
            <label>Horas trabajadas<input value={hours} onChange={(e) => setHours(e.target.value)} onBlur={() => save({ realHours: hours.trim() ? Math.max(0, parseFloat(hours) || 0) : undefined })} inputMode="decimal" placeholder="0" /></label>
          </div>
          {profit ? (
            <p className={`note-box ${profit.profitCents < 0 ? 'bad' : ''}`}>
              Cobras {money(profit.incomeCents)} y costó {money(profit.realCostCents)} (material más tus horas y las del taller): {profit.profitCents >= 0 ? 'te quedan' : 'pierdes'} <strong>{money(Math.abs(profit.profitCents))}</strong>.
              {profit.overCents !== undefined && (profit.overCents > 0 ? ` Costó ${money(profit.overCents)} más de lo que calculó el cotizador.` : profit.overCents < 0 ? ` Costó ${money(-profit.overCents)} menos de lo que calculó el cotizador.` : '')}
            </p>
          ) : (
            <p className="muted">Anota el material y las horas reales para ver cuánto dejó esta obra y si tus costos del cotizador están bien.</p>
          )}
        </>
      )}

      <h3>Fotos de la obra <small className="muted">({job.photos?.length ?? 0} de {MAX_JOB_PHOTOS})</small></h3>
      {(job.photos?.length ?? 0) > 0 && (
        <div className="job-photos">
          {job.photos!.map((src, i) => (
            <figure key={i}>
              <a href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={`Foto ${i + 1} de la obra`} /></a>
              <button type="button" className="btn small ghost" onClick={() => void removeJobPhoto(quote.id, i).catch((e) => onError(e instanceof Error ? e.message : 'No se pudo quitar'))}>Quitar</button>
            </figure>
          ))}
        </div>
      )}
      {(job.photos?.length ?? 0) < MAX_JOB_PHOTOS && (
        <label className="btn ghost photo-add">
          Agregar foto
          <input type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void preparePhoto(file).then((uri) => addJobPhoto(quote.id, uri)).then(() => setMsg('Foto guardada.'), (err) => onError(err instanceof Error ? err.message : 'No se pudo guardar la foto')) }} />
        </label>
      )}

      {list.length > 0 && (
        <>
          <h3>Lista de compras</h3>
          <table className="cut-table">
            <tbody>{list.map((it) => <tr key={it.name}><td>{it.qty}</td><td>{it.name}</td><td>{it.unit}</td></tr>)}</tbody>
          </table>
          <div className="quick">
            <a className="btn sale" href={whatsappLink(text, '', business.country)} target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>
            <button type="button" className="btn ghost" onClick={() => void navigator.clipboard.writeText(text).then(() => setMsg('Lista copiada.'), () => setMsg('No se pudo copiar.'))}>Copiar</button>
          </div>
        </>
      )}
      {msg && <p className="success" role="status">{msg}</p>}
      <Link to={`/cotizaciones/${quote.id}`} className="btn ghost">Ver la cotización</Link>
      {confirm ? (
        <div className="card confirm">
          <p>¿Quitar esta obra del tablero? La cotización se queda.</p>
          <div className="quick">
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Cancelar</button>
            <button type="button" className="btn expense" onClick={() => void removeJob(quote.id)}>Sí, quitar</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn danger-text" onClick={() => setConfirm(true)}>Quitar del tablero</button>
      )}
    </div>
  )
}

function AddJob({ business, names, onDone }: { business: Business; names: Map<string, string>; onDone: () => void }) {
  const quotes = useLiveQuery(async () => (await listQuotes(business.id)).filter((q) => !q.job && q.status !== 'rejected'), [business.id]) ?? []
  const [id, setId] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  return (
    <section className="card form">
      <h2>Pasar una cotización a obra</h2>
      {quotes.length === 0 ? (
        <p className="muted">No hay cotizaciones disponibles. Crea una en el Cotizador o en Cotizaciones.</p>
      ) : (
        <>
          <label>
            Cotización
            <select value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">Elige una…</option>
              {quotes.map((q) => <option key={q.id} value={q.id}>{docNumber(q)} · {names.get(q.contactId) ?? 'Cliente'} · {q.title} · {formatMoney(q.totalCents, business.currency)}</option>)}
            </select>
          </label>
          <label>Fecha de entrega <small className="muted">(opcional)</small><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" onClick={onDone}>Cancelar</button>
        {quotes.length > 0 && <button type="button" className="btn primary" disabled={!id} onClick={() => void startJob(id, { deliveryDate: date || undefined }).then(onDone, (e) => setError(e instanceof Error ? e.message : 'No se pudo guardar'))}>Pasar a obra</button>}
      </div>
    </section>
  )
}
