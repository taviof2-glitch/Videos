import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { listEmployees, login } from '../data/team'
import type { Business } from '../data/types'

/** Pantalla de entrada del aparato compartido: se elige quién es y se escribe su PIN (T13). */
export default function UserGate({ business }: { business: Business }) {
  const people = useLiveQuery(() => listEmployees(business.id, false), [business.id])
  const [chosen, setChosen] = useState<string>()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const who = people?.find((p) => p.id === chosen)

  async function enter(e: React.FormEvent) {
    e.preventDefault()
    if (!chosen) return
    setBusy(true)
    setError('')
    try {
      await login(business.id, chosen, pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar')
      setPin('')
    }
    setBusy(false)
  }

  return (
    <main className="welcome">
      <h1>{business.name}</h1>
      {!people ? (
        <p className="loading">Cargando…</p>
      ) : !who ? (
        <section className="card form">
          <h2>¿Quién eres?</h2>
          <div className="people">
            {people.map((p) => (
              <button key={p.id} type="button" className="btn ghost person" onClick={() => { setChosen(p.id); setPin(''); setError('') }}>
                <span className="avatar" aria-hidden>{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="grow">{p.name}</span>
                {p.role === 'owner' && p.name !== 'Dueño' && <small className="muted">Dueño</small>}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <form onSubmit={enter} className="card form">
          <h2>Hola, {who.name}</h2>
          <label>
            Tu PIN
            <input type="password" inputMode="numeric" autoComplete="off" autoFocus maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} aria-label="PIN" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy || pin.length < 4}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <button className="btn ghost" type="button" onClick={() => { setChosen(undefined); setError('') }}>Cambiar de persona</button>
        </form>
      )}
    </main>
  )
}
