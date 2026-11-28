import { useState } from 'react'
import { Wrench } from 'lucide-react'
import { ensureCategory } from '../data/categories'
import { formatDay } from '../data/dates'
import { addMachine, addTask, listMachines, markDone, nextDue, removeMachine, removeTask, SUGGESTED_MACHINES } from '../data/machines'
import { parseMoney } from '../data/money'
import { createExpense } from '../data/transactions'
import type { Business, Machine, MachineTask } from '../data/types'

/** Maquinaria del taller: tareas de mantenimiento con aviso cuando tocan, y su gasto (categoría «Mantenimiento»). */
export default function Machines({ business, today }: { business: Business; today: string }) {
  const list = listMachines(business)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const missing = SUGGESTED_MACHINES.filter(([n]) => !list.some((m) => m.name === n))
  return (
    <section className="card form">
      <h2><Wrench className="i-inline" aria-hidden /> Mantenimiento de maquinaria</h2>
      {list.length === 0 && <p className="muted">Agrega tus máquinas y cada cuánto hay que darles mantenimiento. Te aviso en Inicio cuando toque.</p>}
      {list.map((m) => <MachineRow key={m.id} business={business} m={m} today={today} onMsg={setMsg} onErr={setErr} />)}
      {missing.length > 0 && (
        <div className="chips wrap">{missing.map(([n, tasks]) => <button key={n} type="button" className="chip" onClick={() => void addMachine(business.id, n, tasks, today).catch((e) => setErr(e instanceof Error ? e.message : 'No se pudo'))}>+ {n}</button>)}</div>
      )}
      {adding ? (
        <div className="fav-row">
          <input aria-label="Nombre de la máquina" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Lijadora" style={{ flex: 1, minWidth: 0 }} />
          <button type="button" className="btn primary small" onClick={() => void addMachine(business.id, name, [], today).then(() => { setAdding(false); setName('') }, (e) => setErr(e instanceof Error ? e.message : 'No se pudo'))}>Agregar</button>
        </div>
      ) : <button type="button" className="btn ghost small" onClick={() => setAdding(true)}>Otra máquina</button>}
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
    </section>
  )
}

function MachineRow({ business, m, today, onMsg, onErr }: { business: Business; m: Machine; today: string; onMsg: (s: string) => void; onErr: (s: string) => void }) {
  const [task, setTask] = useState('')
  const [days, setDays] = useState('30')
  const [doing, setDoing] = useState<MachineTask>()
  const [cost, setCost] = useState('')
  async function done(t: MachineTask) {
    await markDone(business.id, m.id, t.id, today)
    const cents = parseMoney(cost) ?? 0
    if (cents > 0) {
      const cat = await ensureCategory(business.id, 'expense', 'Mantenimiento')
      await createExpense(business.id, { amountCents: cents, concept: `${m.name}: ${t.name}`, categoryId: cat.id })
    }
    setDoing(undefined); setCost('')
    onMsg(`Listo: ${t.name}${cents > 0 ? ' (gasto anotado en Mantenimiento)' : ''}.`)
  }
  return (
    <fieldset className="checks">
      <legend>{m.name}</legend>
      {m.tasks.map((t) => {
        const due = nextDue(t, today)
        return (
          <div key={t.id} style={{ display: 'grid', gap: 4 }}>
            <div className="row-between">
              <span>{t.name}<small className="muted"> · cada {t.everyDays} días · {due <= today ? <strong className="neg">toca ya</strong> : `toca el ${formatDay(due)}`}</small></span>
              <span>
                <button type="button" className="btn ghost small" onClick={() => setDoing(doing?.id === t.id ? undefined : t)}>Hecho</button>
                <button type="button" className="link danger-link" aria-label={`Quitar ${t.name}`} onClick={() => void removeTask(business.id, m.id, t.id)}>×</button>
              </span>
            </div>
            {doing?.id === t.id && (
              <div className="fav-row">
                <input aria-label="Cuánto costó" value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="¿Costó algo? $ (opcional)" style={{ flex: 1, minWidth: 0 }} />
                <button type="button" className="btn primary small" onClick={() => void done(t).catch((e) => onErr(e instanceof Error ? e.message : 'No se pudo'))}>Guardar</button>
              </div>
            )}
          </div>
        )
      })}
      <div className="fav-row">
        <input aria-label="Nueva tarea" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Nueva tarea" style={{ flex: 2, minWidth: 0 }} />
        <input aria-label="Cada cuántos días" value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" style={{ width: 60 }} />
        <button type="button" className="btn ghost small" onClick={() => void addTask(business.id, m.id, task, Number(days), today).then(() => setTask(''), (e) => onErr(e instanceof Error ? e.message : 'No se pudo'))}>+</button>
      </div>
      <button type="button" className="link danger-link" onClick={() => void removeMachine(business.id, m.id)}>Quitar máquina</button>
    </fieldset>
  )
}
