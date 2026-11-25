import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createEmployee, listEmployees, PERMISSIONS, PIN_HELP, removeEmployee, setOwnerPin, updateEmployee, type Permission } from '../data/team'
import type { Business, Employee } from '../data/types'

function Permissions({ value, onChange }: { value: Permission[]; onChange: (v: Permission[]) => void }) {
  return (
    <fieldset className="perms">
      <legend>Además de vender, cobrar y atender clientes, puede:</legend>
      {PERMISSIONS.map((p) => (
        <label key={p.key} className="check">
          <input type="checkbox" checked={value.includes(p.key)} onChange={(e) => onChange(e.target.checked ? [...value, p.key] : value.filter((x) => x !== p.key))} />
          <span className="grow">{p.label}<small className="muted"> · {p.hint}</small></span>
        </label>
      ))}
    </fieldset>
  )
}

const pinInput = (value: string, set: (v: string) => void, label: string) => (
  <label>
    {label}
    <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={value} onChange={(e) => set(e.target.value.replace(/\D/g, ''))} placeholder="4 a 6 números" />
  </label>
)

/** S20: empleados con PIN y lo que puede hacer cada uno. Solo para el dueño. */
export default function Team({ business }: { business: Business }) {
  const people = useLiveQuery(() => listEmployees(business.id), [business.id])
  const owner = people?.find((p) => p.role === 'owner')
  const staff = people?.filter((p) => p.role === 'employee') ?? []
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  const [ownerPin, setOwner] = useState('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [perms, setPerms] = useState<Permission[]>([])
  const [editing, setEditing] = useState<string>()

  const run = async (fn: () => Promise<void>, ok: string) => {
    setMsg(undefined)
    try {
      await fn()
      setMsg({ ok: true, text: ok })
      return true
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'No se pudo guardar' })
      return false
    }
  }

  return (
    <>
      <section className="row-between">
        <h1>Empleados</h1>
        <Link to="/mas" className="btn ghost small">Más</Link>
      </section>
      <p className="muted">Cada persona entra con su PIN y ve solo lo que le permitas. Cada venta y gasto queda con el nombre de quien lo registró.</p>

      <section className="card form">
        <h2>{owner ? 'Tu PIN de dueño' : 'Primero, tu PIN de dueño'}</h2>
        {!owner && <p className="muted">Con tu PIN podrás volver a entrar a todo cuando un empleado use la app. Al activarlo, la app te pedirá el PIN cada vez que alguien cambie de usuario.</p>}
        {pinInput(ownerPin, setOwner, owner ? 'Nuevo PIN' : 'PIN')}
        <button type="button" className="btn primary" disabled={ownerPin.length < 4} onClick={() => void run(async () => { await setOwnerPin(business.id, ownerPin); setOwner('') }, owner ? 'PIN cambiado.' : 'Listo: ya puedes agregar empleados.')}>
          {owner ? 'Cambiar mi PIN' : 'Activar PINs'}
        </button>
        {!owner && <small className="muted">{PIN_HELP}</small>}
      </section>

      {owner && (
        <>
          <section className="card">
            <h2>Tu equipo</h2>
            {staff.length === 0 && <p className="muted">Aún no tienes empleados. Agrégalos abajo.</p>}
            <ul className="team">
              {staff.map((e) => (
                <EmployeeRow key={e.id} e={e} open={editing === e.id} onOpen={() => setEditing(editing === e.id ? undefined : e.id)} run={run} />
              ))}
            </ul>
          </section>

          <section className="card form">
            <h2>Agregar empleado</h2>
            <label>
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Rosa" />
            </label>
            {pinInput(pin, setPin, 'PIN del empleado')}
            <Permissions value={perms} onChange={setPerms} />
            <button type="button" className="btn primary" disabled={!name.trim() || pin.length < 4} onClick={() => void run(async () => { await createEmployee(business.id, { name, pin, permissions: perms }); setName(''); setPin(''); setPerms([]) }, 'Empleado agregado.')}>
              Agregar
            </button>
          </section>
        </>
      )}

      {msg && <p className={msg.ok ? 'success' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <p className="muted note">Los PIN identifican a quien usa el aparato y limitan lo que ve; no sustituyen la contraseña de la cuenta. Quien tenga acceso a la cuenta puede ver todo.</p>
    </>
  )
}

function EmployeeRow({ e, open, onOpen, run }: { e: Employee; open: boolean; onOpen: () => void; run: (fn: () => Promise<void>, ok: string) => Promise<boolean> }) {
  const [name, setName] = useState(e.name)
  const [pin, setPin] = useState('')
  const [perms, setPerms] = useState<Permission[]>(e.permissions)
  const [confirm, setConfirm] = useState(false)
  const summary = e.permissions.length ? PERMISSIONS.filter((p) => e.permissions.includes(p.key)).map((p) => p.label.toLowerCase()).join(', ') : 'solo vender, cobrar y atender clientes'
  return (
    <li>
      <button type="button" className="team-head" onClick={onOpen} aria-expanded={open}>
        <span className="avatar" aria-hidden>{e.name.slice(0, 1).toUpperCase()}</span>
        <span className="grow">
          <strong>{e.name}{!e.active && <span className="badge no">Desactivado</span>}</strong>
          <small className="muted">Puede: {summary}</small>
        </span>
        <span aria-hidden>{open ? '▾' : '›'}</span>
      </button>
      {open && (
        <div className="form team-edit">
          <label>
            Nombre
            <input value={name} onChange={(x) => setName(x.target.value)} />
          </label>
          {pinInput(pin, setPin, 'Cambiar PIN (déjalo vacío para conservarlo)')}
          <Permissions value={perms} onChange={setPerms} />
          <button type="button" className="btn primary" disabled={!name.trim() || (pin.length > 0 && pin.length < 4)} onClick={() => void run(async () => { await updateEmployee(e.id, { name, permissions: perms, ...(pin && { pin }) }); setPin('') }, 'Cambios guardados.')}>Guardar cambios</button>
          <button type="button" className="btn ghost" onClick={() => void run(() => updateEmployee(e.id, { active: !e.active }), e.active ? 'Desactivado: ya no puede entrar.' : 'Activado.')}>{e.active ? 'Desactivar' : 'Activar'}</button>
          {confirm ? (
            <div className="confirm">
              <p>¿Quitar a {e.name}? Sus ventas y gastos se conservan con su nombre.</p>
              <div className="quick">
                <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Cancelar</button>
                <button type="button" className="btn expense" onClick={() => void run(() => removeEmployee(e.id), 'Empleado quitado.')}>Sí, quitar</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn danger-text" onClick={() => setConfirm(true)}>Quitar empleado</button>
          )}
        </div>
      )}
    </li>
  )
}
