import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CalendarPlus, Check, ChevronLeft, ChevronRight, MapPin, Phone } from 'lucide-react'
import { createAppointment, formatTime, KIND_LABEL, KINDS, listAppointments, mapsLink, overdueAppointments, removeAppointment, setAppointmentDone, updateAppointment, type AppointmentInput } from '../data/agenda'
import { getContact, listContacts, updateContact } from '../data/contacts'
import { addDays, dayKey, formatDay, weekdayShort, weekStart } from '../data/dates'
import { whatsappLink } from '../data/reminder'
import type { Appointment, AppointmentKind, Business, Contact } from '../data/types'
import { notifyTeam } from '../sync/push'
import { useActor } from '../ui/actor'
import ContactSelect from '../ui/ContactSelect'
import { resolveContactId } from '../ui/forms'

/** Lo que otra pantalla (Obras, Cotización) manda para abrir el formulario ya lleno. */
export type AgendaDraft = Partial<AppointmentInput>

const dayTitle = (d: string, today: string) => (d === today ? 'Hoy' : d === addDays(today, 1) ? 'Mañana' : `${weekdayShort(d)} ${formatDay(d)}`)

/** Agenda: visitas para medir, instalaciones y entregas, por semana. */
export default function Agenda({ business }: { business: Business }) {
  const navigate = useNavigate()
  const draft = (useLocation().state as { cita?: AgendaDraft } | null)?.cita
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  const [week, setWeek] = useState(() => weekStart(draft?.date ?? today))
  const [editing, setEditing] = useState<Appointment | 'new' | undefined>(draft ? 'new' : undefined)
  const end = addDays(week, 6)
  const list = useLiveQuery(() => listAppointments(business.id, week, end), [business.id, week, end])
  const late = useLiveQuery(() => overdueAppointments(business.id, today), [business.id, today]) ?? []
  const contacts = useLiveQuery(async () => new Map((await listContacts(business.id, 'customer')).map((c) => [c.id, c])), [business.id])
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))

  return (
    <>
      <section className="row-between">
        <h1>Agenda</h1>
        {!editing && <button type="button" className="btn primary small" onClick={() => setEditing('new')}><CalendarPlus aria-hidden /> Nueva cita</button>}
      </section>
      <p className="muted">Visitas para medir, instalaciones y entregas. Toca la dirección para abrir el mapa.</p>

      {editing && (
        <AppointmentForm
          business={business} today={today} current={editing === 'new' ? undefined : editing} draft={editing === 'new' ? draft : undefined}
          onDone={(a) => {
            setEditing(undefined)
            if (draft) navigate('.', { replace: true, state: null })
            if (a) setWeek(weekStart(a.date))
          }}
        />
      )}

      {late.length > 0 && (
        <section className="card">
          <h2>Pendientes de días pasados</h2>
          <ul className="agenda-list">{late.map((a) => <Item key={a.id} a={a} contact={contacts?.get(a.contactId ?? '')} business={business} today={today} showDay onEdit={() => setEditing(a)} />)}</ul>
        </section>
      )}

      <div className="row-between period-nav">
        <button type="button" className="btn ghost small" aria-label="Semana anterior" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft aria-hidden /></button>
        <strong className="grow">{week === weekStart(today) ? 'Esta semana' : `${formatDay(week)} – ${formatDay(end)}`}</strong>
        {week !== weekStart(today) && <button type="button" className="link" onClick={() => setWeek(weekStart(today))}>Hoy</button>}
        <button type="button" className="btn ghost small" aria-label="Semana siguiente" onClick={() => setWeek(addDays(week, 7))}><ChevronRight aria-hidden /></button>
      </div>

      {list === undefined ? <p className="loading">Cargando…</p> : (
        days.map((d) => {
          const here = list.filter((a) => a.date === d)
          if (!here.length && d !== today) return null
          return (
            <section key={d} className={`agenda-day ${d === today ? 'today' : ''}`}>
              <h2>{dayTitle(d, today)}</h2>
              {here.length ? <ul className="agenda-list">{here.map((a) => <Item key={a.id} a={a} contact={contacts?.get(a.contactId ?? '')} business={business} today={today} onEdit={() => setEditing(a)} />)}</ul> : <p className="muted">Nada agendado hoy.</p>}
            </section>
          )
        })
      )}
      {list && list.length === 0 && <p className="muted">No hay citas esta semana.</p>}
    </>
  )
}

function Item({ a, contact, business, today, showDay, onEdit }: { a: Appointment; contact?: Contact; business: Business; today: string; showDay?: boolean; onEdit: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const who = [contact?.name, a.title].filter(Boolean).join(' · ')
  const phone = contact?.phone ?? ''
  return (
    <li className={`card agenda-item ${a.done ? 'done' : ''}`}>
      <div className="row-between">
        <span>
          <strong>{showDay ? `${dayTitle(a.date, today)}, ` : ''}{formatTime(a.time)}</strong>
          <span className={`badge kind-${a.kind}`}>{KIND_LABEL[a.kind]}</span>
          {a.done && <span className="badge ok">Hecha</span>}
        </span>
        <button type="button" className={`btn small ${a.done ? 'ghost' : 'ghost'}`} onClick={() => void setAppointmentDone(a.id, !a.done)} aria-pressed={!!a.done}>
          <Check aria-hidden /> {a.done ? 'Deshacer' : 'Marcar hecha'}
        </button>
      </div>
      <p>{who}</p>
      {a.address && <a className="agenda-map" href={mapsLink(a.address)} target="_blank" rel="noopener noreferrer"><MapPin className="i-inline" aria-hidden /> {a.address}</a>}
      {a.note && <p className="muted">{a.note}</p>}
      <div className="quick">
        {phone && <a className="btn ghost small" href={`tel:${phone.replace(/[^\d+]/g, '')}`}><Phone aria-hidden /> Llamar</a>}
        {phone && <a className="btn ghost small" href={whatsappLink(`Hola ${contact?.name ?? ''}, le escribo de ${business.name} para confirmar la cita: ${KIND_LABEL[a.kind].toLowerCase()} el ${dayTitle(a.date, today).toLowerCase()}${a.time ? ` a las ${formatTime(a.time)}` : ''}.`, phone, business.country)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
        {a.linkId && <Link className="btn ghost small" to="/obras">Ver obra</Link>}
        <button type="button" className="btn ghost small" onClick={onEdit}>Editar</button>
      </div>
      {confirm ? (
        <div className="quick">
          <button type="button" className="btn ghost small" onClick={() => setConfirm(false)}>No</button>
          <button type="button" className="btn small expense" onClick={() => void removeAppointment(a.id)}>Sí, borrar cita</button>
        </div>
      ) : <button type="button" className="link danger-link" onClick={() => setConfirm(true)}>Borrar</button>}
    </li>
  )
}

function AppointmentForm({ business, today, current, draft, onDone }: { business: Business; today: string; current?: Appointment; draft?: AgendaDraft; onDone: (a?: Appointment) => void }) {
  const actor = useActor()
  const init = current ?? draft
  const [kind, setKind] = useState<AppointmentKind>(init?.kind ?? 'medir')
  const [date, setDate] = useState(init?.date ?? today)
  const [time, setTime] = useState(init?.time ?? '')
  const [contactId, setContactId] = useState(init?.contactId ?? '')
  const [newContact, setNewContact] = useState('')
  const [title, setTitle] = useState(init?.title ?? '')
  const [address, setAddress] = useState(init?.address ?? '')
  const [note, setNote] = useState(init?.note ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Al elegir un cliente con dirección guardada, se pone sola (si no se escribió otra).
  async function pickContact(id: string) {
    setContactId(id)
    const c = id ? await getContact(id) : undefined
    if (c?.address && !address.trim()) setAddress(c.address)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const customer = await resolveContactId(business.id, 'customer', contactId, newContact, setContactId)
      const input: AppointmentInput = { kind, date, time, contactId: customer, title, address, note, linkId: init?.linkId }
      const saved = current ? await updateAppointment(current.id, input) : await createAppointment(business.id, input)
      // La dirección se guarda también en el cliente para la próxima vez.
      if (customer && address.trim()) {
        const c = await getContact(customer)
        if (c && !c.address) await updateContact(c.id, { ...c, address })
      }
      if (!current) {
        const name = customer ? (await getContact(customer))?.name : ''
        notifyTeam(business.id, {
          title: `Nueva cita: ${KIND_LABEL[kind]}${name || title ? ` · ${name || title}` : ''}`,
          body: `${dayTitle(date, today)}, ${formatTime(time || undefined).toLowerCase()}${address ? ` · ${address}` : ''} · agendó ${actor.name}`,
          url: '/agenda',
        }, actor.id)
      }
      onDone(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setBusy(false)
    }
  }

  return (
    <form className="card form" onSubmit={save} aria-label={current ? 'Editar cita' : 'Nueva cita'}>
      <h2>{current ? 'Editar cita' : 'Nueva cita'}</h2>
      <div className="chips wrap" role="group" aria-label="Tipo de cita">
        {KINDS.map((k) => <button key={k} type="button" className={`chip ${kind === k ? 'on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>)}
      </div>
      <div className="two">
        <label>Día<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label>Hora <small className="muted">(opcional)</small><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <ContactSelect businessId={business.id} type="customer" value={contactId} onChange={(id) => void pickContact(id)} newName={newContact} onNewName={setNewContact} />
      <label>Qué se va a hacer <small className="muted">(o a quién, si no es cliente guardado)</small><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Closet de recámara, cocina" /></label>
      <label>Dirección<input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, número, colonia" autoComplete="street-address" /></label>
      <label>Nota <small className="muted">(opcional)</small><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. llevar muestras de color, tocar en la casa azul" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" disabled={busy} onClick={() => onDone()}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cita'}</button>
      </div>
    </form>
  )
}
