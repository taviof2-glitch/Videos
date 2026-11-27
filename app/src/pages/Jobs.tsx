import { useLiveQuery } from 'dexie-react-hooks'
import { QuickPayment } from '../ui/AdvanceField'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getContact, listContacts } from '../data/contacts'
import { addDays, addMonths, dayKey, dayNumber, formatDay, monthStart, periodLabel, weekStart } from '../data/dates'
import { docNumber } from '../data/folio'
import { addJobPhoto, awaitingPayment, balanceReminder, dueThisWeek, isDelivered, isLate, jobProfit, listJobs, MAX_JOB_PHOTOS, newTrackToken, removeJob, removeJobPhoto, salesForJobs, trackUrl, setJobPaid, setJobStage, shoppingList, shoppingText, STAGE_LABEL, STAGES, startJob, updateJob, warrantyUntil, type JobItem } from '../data/jobs'
import { formatMoney, parseMoney } from '../data/money'
import { quoterSettings } from '../data/quoter'
import { listQuotes } from '../data/quotes'
import { whatsappLink } from '../data/reminder'
import type { Business, JobStage } from '../data/types'
import { useActor, useCan } from '../ui/actor'
import { jobNotice, notifyTeam } from '../sync/push'
import PushToggle from '../ui/PushToggle'
import AfterSaleCard from '../ui/AfterSaleCard'
import { notifyNewJob } from '../ui/jobNotify'
import MaterialUseCard from '../ui/MaterialUseCard'
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

  const late = jobs.filter((q) => isLate(q.job, today))
  const week = jobs.filter((q) => dueThisWeek(q.job, today))
  const active = jobs.filter((q) => q.job.stage !== 'liquidado')
  const upcoming = jobs.filter((q) => q.job.deliveryDate && !isDelivered(q.job)).sort((a, b) => a.job!.deliveryDate!.localeCompare(b.job!.deliveryDate!))

  return (
    <>
      <section className="row-between">
        <h1>Obras</h1>
        <Link to="/mas" className="btn ghost small">Más</Link>
      </section>
      <p className="muted">Los trabajos que ya te aceptaron (cotizaciones o ventas fiadas): en qué etapa van, cuándo se entregan y cuánto falta cobrar.</p>
      <PushToggle business={business} />
      <AfterSaleCard business={business} today={today} />

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
                    <button type="button" className="link" onClick={() => setOpen(q.id)}>{formatDay(q.job.deliveryDate!)} · {names.get(q.contactId ?? '') ?? 'Cliente'} · {q.title}</button>
                    {isLate(q.job, today) && <span className="badge out">Atrasada</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {jobs.some((q) => q.job.deliveryDate) && (
        <section className="card">
          <div className="period-nav">
            <button type="button" className="icon-btn" aria-label="Mes anterior" onClick={() => { setMonth(addMonths(month, -1)); setDay(undefined) }}><ChevronLeft aria-hidden /></button>
            <strong className="grow">{periodLabel('month', month)}</strong>
            <button type="button" className="icon-btn" aria-label="Mes siguiente" onClick={() => { setMonth(addMonths(month, 1)); setDay(undefined) }}><ChevronRight aria-hidden /></button>
          </div>
          <div className="cal" role="grid" aria-label="Calendario de entregas">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} className="cal-head" aria-hidden>{d}</span>)}
            {Array.from({ length: 42 }, (_, i) => addDays(weekStart(month), i)).map((d) => {
              const here = jobs.filter((q) => q.job.deliveryDate === d)
              const inMonth = d.slice(0, 7) === month.slice(0, 7)
              const lateHere = here.some((q) => isLate(q.job, today))
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
              {jobs.filter((q) => q.job.deliveryDate === day).map((q) => (
                <li key={q.id}><button type="button" className="link" onClick={() => setOpen(q.id)}>{names.get(q.contactId ?? '') ?? 'Cliente'} · {q.title} · {STAGE_LABEL[q.job.stage]}</button></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {jobs.length === 0 && !adding && (
        <section className="card empty-state">
          <p>Todavía no tienes obras. Cuando un cliente acepte una cotización o te deje un encargo fiado, pásalo a obra para seguirlo hasta entregarlo y cobrarlo.</p>
        </section>
      )}

      {STAGES.map((stage) => {
        const here = jobs.filter((q) => q.job.stage === stage)
        if (!here.length) return null
        return (
          <section key={stage} className="job-stage">
            <h2>{STAGE_LABEL[stage]} <small className="muted">({here.length})</small></h2>
            <ul className="fixed-list">
              {here.map((q) => (
                <JobCard key={q.id} business={business} item={q} phone={contacts?.get(q.contactId ?? '')?.phone ?? ''} customer={names.get(q.contactId ?? '') ?? 'Cliente'} today={today} open={open === q.id} onToggle={() => setOpen(open === q.id ? undefined : q.id)} money={money} />
              ))}
            </ul>
          </section>
        )
      })}

      {adding ? <AddJob business={business} names={names} onDone={() => setAdding(false)} /> : <button type="button" className="btn primary" onClick={() => setAdding(true)}>Agregar obra</button>}
    </>
  )
}

function JobCard({ business, item, customer, phone, today, open, onToggle, money }: { business: Business; item: JobItem; customer: string; phone: string; today: string; open: boolean; onToggle: () => void; money: (c: number) => string }) {
  const { job } = item
  const can = useCan()
  const i = STAGES.indexOf(job.stage)
  const [error, setError] = useState('')
  const run = (p: Promise<unknown>) => void p.catch((e) => setError(e instanceof Error ? e.message : 'No se pudo guardar'))
  const actor = useActor()
  // Cada paso avisa a los demás teléfonos del equipo que tengan los avisos activados.
  const go = (stage: JobStage) => run(setJobStage(item.id, stage, today).then(() => notifyTeam(business.id, jobNotice({ customer, title: item.title, stageLabel: STAGE_LABEL[stage], by: actor.name }), actor.id)))
  return (
    <li className="card">
      <div className="row-between">
        <strong>{customer}</strong>
        <strong>{money(item.totalCents)}</strong>
      </div>
      <div className="row-between">
        <small className="muted">{item.title} · {item.folio}</small>
        {job.deliveryDate && <span className={`badge ${isLate(job, today) ? 'out' : isDelivered(job) ? 'ok' : 'muted'}`}>{isLate(job, today) ? 'Atrasada · ' : isDelivered(job) ? 'Entregada · ' : 'Entrega '}{formatDay(isDelivered(job) && job.deliveredAt ? job.deliveredAt : job.deliveryDate)}</span>}
      </div>
      <div className="meter" aria-hidden><span style={{ width: `${((i + 1) / STAGES.length) * 100}%` }} /></div>
      {i >= STAGES.indexOf('corte') && !isDelivered(job) && !job.materialUse && !!item.quote?.quoter?.cut && !open && (
        <button type="button" className="link" onClick={onToggle}>¿Ya cortaste? Descuenta el material del taller →</button>
      )}
      <div className="quick">
        {i > 0 && <button type="button" className="btn ghost" onClick={() => go(STAGES[i - 1])}>← Regresar</button>}
        {i < STAGES.length - 1 && <button type="button" className="btn primary" onClick={() => go(STAGES[i + 1])}>{STAGE_LABEL[STAGES[i + 1]]} →</button>}
      </div>
      {item.balanceCents > 0 ? <small className="muted">Falta cobrar {money(item.balanceCents)}</small> : (
        <p className="note-box">✓ Ya está <strong>liquidado</strong>{isDelivered(job) ? '.' : ': solo falta entregarlo.'}</p>
      )}
      {awaitingPayment(job) && item.balanceCents > 0 && (
        <a className="btn sale" href={whatsappLink(balanceReminder({ customer, businessName: business.name, title: item.title, balanceCents: item.balanceCents, currency: business.currency }), phone, business.country)} target="_blank" rel="noopener noreferrer">Recordar saldo de {money(item.balanceCents)} por WhatsApp</a>
      )}
      {item.sale?.status === 'credit' && item.sale.contactId && item.balanceCents > 0 && (
        <QuickPayment business={business} contactId={item.sale.contactId} transactionId={item.sale.id} totalCents={item.sale.amountCents} paidCents={item.sale.amountCents - item.balanceCents} remainingCents={item.balanceCents} currency={business.currency} />
      )}
      {/* Cotización que aún no es venta: el anticipo se registra al convertirla en venta fiada. */}
      {item.quote && !item.sale && item.quote.status !== 'converted' && item.balanceCents > 0 && (
        <Link to={`/cotizaciones/${item.quote.id}`} state={{ convertir: true }} className="btn sale">Se recibió el anticipo</Link>
      )}
      {/* Sin venta fiada con abonos: se marca a mano que ya pagó todo, aunque no se haya entregado. */}
      {!(item.sale?.status === 'credit') && job.stage !== 'liquidado' && (
        job.paid
          ? <button type="button" className="btn ghost" onClick={() => run(setJobPaid(item.id, false))}>Quitar «liquidado»</button>
          : item.balanceCents > 0 && <button type="button" className="btn ghost" onClick={() => run(setJobPaid(item.id, true))}>Ya lo liquidaron (falta entregar)</button>
      )}
      <button type="button" className="btn ghost" aria-expanded={open} onClick={onToggle}>{open ? 'Ocultar detalles' : 'Detalles'}</button>
      {error && <p className="error" role="alert">{error}</p>}
      {open && <JobDetails business={business} item={item} customer={customer} money={money} showCosts={can('balance')} onError={setError} />}
    </li>
  )
}

function JobDetails({ business, item, customer, money, showCosts, onError }: { business: Business; item: JobItem; customer: string; money: (c: number) => string; showCosts: boolean; onError: (m: string) => void }) {
  const { job, quote } = item
  const [material, setMaterial] = useState(job.realMaterialCents !== undefined ? (job.realMaterialCents / 100).toFixed(2) : '')
  const [hours, setHours] = useState(job.realHours !== undefined ? String(job.realHours) : '')
  const [note, setNote] = useState(job.note ?? '')
  const [warranty, setWarranty] = useState(job.warrantyMonths ? String(job.warrantyMonths) : '')
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState('')
  const { cfg } = quoterSettings(business)
  const list = quote ? shoppingList(quote, cfg) : []
  const text = quote ? shoppingText(quote, cfg, customer) : ''
  const profit = jobProfit(business, item)
  const until = warrantyUntil(job)
  const save = (patch: Parameters<typeof updateJob>[1]) => void updateJob(item.id, patch).then(() => setMsg('Guardado.'), (e) => onError(e instanceof Error ? e.message : 'No se pudo guardar'))

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
          {item.spentCents ? <p className="muted">Gastos y compras registrados para esta obra: <strong>{money(item.spentCents)}</strong> (ya se suman).</p> : <p className="muted">Al registrar un gasto o una compra, elige «Para la obra» y se suma aquí solo.</p>}
          <div className="two">
            <label>{item.spentCents ? 'Otro material' : 'Material gastado'} <small className="muted">($, sin ticket)</small><input value={material} onChange={(e) => setMaterial(e.target.value)} onBlur={() => save({ realMaterialCents: material.trim() ? (parseMoney(material) ?? undefined) : undefined })} inputMode="decimal" placeholder="0.00" /></label>
            <label>Horas trabajadas<input value={hours} onChange={(e) => setHours(e.target.value)} onBlur={() => save({ realHours: hours.trim() ? Math.max(0, parseFloat(hours) || 0) : undefined })} inputMode="decimal" placeholder="0" /></label>
          </div>
          {profit ? (
            <p className={`note-box ${profit.profitCents < 0 ? 'bad' : ''}`}>
              Cobras {money(profit.incomeCents)} y costó {money(profit.realCostCents)} (material, compras y tus horas con las del taller): {profit.profitCents >= 0 ? 'te quedan' : 'pierdes'} <strong>{money(Math.abs(profit.profitCents))}</strong>.
              {profit.overCents !== undefined && (profit.overCents > 0 ? ` Costó ${money(profit.overCents)} más de lo que calculó el cotizador.` : profit.overCents < 0 ? ` Costó ${money(-profit.overCents)} menos de lo que calculó el cotizador.` : '')}
            </p>
          ) : (
            <p className="muted">Anota el material y las horas reales para ver cuánto dejó esta obra y si tus costos del cotizador están bien.</p>
          )}
          {showCosts && (
            <Link to="/gasto/nuevo" state={{ obra: item.id }} className="btn ghost small">Registrar gasto para esta obra</Link>
          )}
        </>
      )}

      <h3>Material de la obra</h3>
      <MaterialUseCard business={business} item={item} />

      <h3>Fotos de la obra <small className="muted">({job.photos?.length ?? 0} de {MAX_JOB_PHOTOS})</small></h3>
      {(job.photos?.length ?? 0) > 0 && (
        <div className="job-photos">
          {job.photos!.map((src, i) => (
            <figure key={i}>
              <a href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={`Foto ${i + 1} de la obra`} /></a>
              <button type="button" className="btn small ghost" onClick={() => void removeJobPhoto(item.id, i).catch((e) => onError(e instanceof Error ? e.message : 'No se pudo quitar'))}>Quitar</button>
            </figure>
          ))}
        </div>
      )}
      {(job.photos?.length ?? 0) < MAX_JOB_PHOTOS && (
        <label className="btn ghost photo-add">
          Agregar foto
          <input type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void preparePhoto(file).then((uri) => addJobPhoto(item.id, uri)).then(() => setMsg('Foto guardada.'), (err) => onError(err instanceof Error ? err.message : 'No se pudo guardar la foto')) }} />
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
      <div className="quick">
        <Link to="/agenda" state={{ cita: { kind: 'instalar', contactId: item.contactId, title: item.title, linkId: item.id, date: job.deliveryDate } }} className="btn ghost">Agendar instalación</Link>
        <Link to="/agenda" state={{ cita: { kind: 'entregar', contactId: item.contactId, title: item.title, linkId: item.id, date: job.deliveryDate } }} className="btn ghost">Agendar entrega</Link>
      </div>
      <TrackShare business={business} item={item} customer={customer} />
      {quote && <Link to={`/cotizaciones/${quote.id}`} className="btn ghost">Ver la cotización</Link>}
      {item.sale && (
        <div className="quick">
          <Link to={`/venta/${item.sale.id}/comprobante`} className="btn sale">Reenviar comprobante</Link>
          <Link to={`/venta/${item.sale.id}`} className="btn ghost">Ver la venta</Link>
        </div>
      )}
      {confirm ? (
        <div className="card confirm">
          <p>¿Quitar esta obra del tablero? {quote ? 'La cotización' : 'La venta'} se queda.</p>
          <div className="quick">
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Cancelar</button>
            <button type="button" className="btn expense" onClick={() => void removeJob(item.id)}>Sí, quitar</button>
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
  const actor = useActor()
  const [withPaid, setWithPaid] = useState(false)
  const sales = useLiveQuery(() => salesForJobs(business.id, withPaid), [business.id, withPaid]) ?? []
  const [from, setFrom] = useState<'sale' | 'quote'>('sale')
  const [id, setId] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const money = (c: number) => formatMoney(c, business.currency)
  const empty = from === 'sale' ? sales.length === 0 : quotes.length === 0
  return (
    <section className="card form">
      <h2>Agregar obra</h2>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={from === 'sale'} className={`tab-btn ${from === 'sale' ? 'on' : ''}`} onClick={() => { setFrom('sale'); setId('') }}>Venta fiada</button>
        <button type="button" role="tab" aria-selected={from === 'quote'} className={`tab-btn ${from === 'quote' ? 'on' : ''}`} onClick={() => { setFrom('quote'); setId('') }}>Cotización</button>
      </div>
      {from === 'sale' && <label className="check"><input type="checkbox" checked={withPaid} onChange={(e) => { setWithPaid(e.target.checked); setId('') }} /><span>Mostrar también ventas ya pagadas (que aún no entregas)</span></label>}
      {empty ? (
        <p className="muted">{from === 'sale' ? withPaid ? 'No hay ventas de los últimos 6 meses sin obra.' : 'No hay ventas fiadas con saldo pendiente. Si ya te pagaron todo, marca «Mostrar también ventas ya pagadas».' : 'No hay cotizaciones disponibles. Crea una en el Cotizador o en Cotizaciones.'}</p>
      ) : (
        <>
          <label>
            {from === 'sale' ? 'Venta fiada' : 'Cotización'}
            <select value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">Elige una…</option>
              {from === 'sale'
                ? sales.map(({ sale, balanceCents }) => <option key={sale.id} value={sale.id}>{formatDay(sale.date.slice(0, 10))} · {names.get(sale.contactId ?? '') ?? 'Cliente'} · {sale.concept || 'Venta'} · {balanceCents > 0 ? `debe ${money(balanceCents)}` : 'ya pagado'}</option>)
                : quotes.map((q) => <option key={q.id} value={q.id}>{docNumber(q)} · {names.get(q.contactId) ?? 'Cliente'} · {q.title} · {money(q.totalCents)}</option>)}
            </select>
          </label>
          <label>Fecha de entrega <small className="muted">(opcional)</small><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" onClick={onDone}>Cancelar</button>
        {!empty && <button type="button" className="btn primary" disabled={!id} onClick={() => void startJob(id, { deliveryDate: date || undefined }).then(() => { void notifyNewJob(business.id, id, actor); onDone() }, (e) => setError(e instanceof Error ? e.message : 'No se pudo guardar'))}>Pasar a obra</button>}
      </div>
    </section>
  )
}

/** Enlace de seguimiento para el cliente: solo se crea y se manda cuando tú lo decides (p. ej. si el cliente lo pide). */
function TrackShare({ business, item, customer }: { business: Business; item: JobItem; customer: string }) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const phone = useLiveQuery(async () => (item.contactId ? ((await getContact(item.contactId))?.phone ?? '') : ''), [item.contactId]) ?? ''
  const token = item.job.trackToken
  if (!open) return <button type="button" className="link" onClick={() => setOpen(true)}>Enlace de seguimiento para el cliente…</button>
  const url = token ? trackUrl(token) : ''
  const text = `Hola ${customer.split(' ')[0]}, aquí puedes ver cómo va tu pedido (${item.title}) de ${business.name}: ${url}`
  return (
    <section className="card form">
      <h3>Enlace de seguimiento</h3>
      <p className="muted">Una página donde el cliente ve la etapa, la fecha de entrega, las fotos y su saldo. No se manda sola: solo cuando tú la compartes.</p>
      {!token ? (
        <button type="button" className="btn primary" onClick={() => void updateJob(item.id, { trackToken: newTrackToken() }).catch((e) => setMsg(e instanceof Error ? e.message : 'No se pudo'))}>Crear enlace</button>
      ) : (
        <>
          <p className="track-url">{url}</p>
          <div className="quick">
            <a className="btn sale" href={whatsappLink(text, phone, business.country)} target="_blank" rel="noopener noreferrer">Mandar por WhatsApp</a>
            <button type="button" className="btn ghost" onClick={() => void navigator.clipboard.writeText(url).then(() => setMsg('Enlace copiado.'), () => setMsg('No se pudo copiar.'))}>Copiar</button>
          </div>
          <p className="muted">Se ve una vez que este teléfono suba los cambios a la nube (con la sesión iniciada).</p>
          <button type="button" className="link danger-link" onClick={() => void updateJob(item.id, { trackToken: undefined }).then(() => setMsg('Enlace desactivado: el anterior ya no funciona.'))}>Desactivar enlace</button>
        </>
      )}
      {msg && <p className="success" role="status">{msg}</p>}
    </section>
  )
}
