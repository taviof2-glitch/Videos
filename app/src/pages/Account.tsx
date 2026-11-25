import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Business } from '../data/types'
import { accountError, type BusinessStatus } from '../sync/backend'
import { businessStatus, connectBusiness, PHASE_TEXT, deviceIsEmpty, downloadBusiness, myBusinesses, resendConfirmation, signIn, signOut, signUp, syncNow, useSyncStatus } from '../sync/runner'
import { formatDateTime } from '../ui/forms'

const MIN_PASSWORD = 8

/** Cuenta y sincronización (/cuenta). También se abre sin negocio, desde la bienvenida, en un aparato nuevo. */
export default function Account({ business }: { business: Business | null }) {
  const st = useSyncStatus()
  const back = business ? '/mas' : '/bienvenida'

  return (
    <>
      <div className="row-between">
        <Link to={back} className="back" aria-label="Volver">←</Link>
        <h1>Cuenta y nube</h1>
        <span />
      </div>
      {!st.available ? (
        <section className="card">
          <p>Esta versión de prueba no se conecta al servidor. Tus datos se quedan solo en este navegador.</p>
          <p className="muted">La cuenta y la sincronización funcionan en la app instalada.</p>
        </section>
      ) : !st.session ? (
        <SignInForm />
      ) : st.link ? (
        <Linked business={business} />
      ) : (
        <NotLinked business={business} />
      )}
    </>
  )
}

function SignInForm() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [info, setInfo] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setUnconfirmed(false)
    if (!email.trim()) return setError('Escribe tu correo.')
    if (mode === 'up') {
      if (password.length < MIN_PASSWORD) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)
      if (password !== password2) return setError('Las contraseñas no coinciden.')
    }
    setBusy(true)
    try {
      if (mode === 'in') await signIn(email, password)
      else {
        await signUp(email, password)
        setSentTo(email.trim())
      }
    } catch (err) {
      setError(accountError(err))
      if (/email not confirmed/i.test(err instanceof Error ? err.message : '')) setUnconfirmed(true)
    }
    setBusy(false)
  }

  async function resend(to: string) {
    setError('')
    try {
      await resendConfirmation(to)
      setInfo(`Te reenviamos el correo a ${to}.`)
    } catch (err) {
      setError(accountError(err))
    }
  }

  if (sentTo) {
    return (
      <section className="card form">
        <h2>Revisa tu correo</h2>
        <p>
          Te enviamos un enlace a <strong>{sentTo}</strong>. Ábrelo para confirmar tu cuenta. Si después ves una página que no carga, no pasa nada: la cuenta ya quedó confirmada.
        </p>
        <p className="muted">Luego vuelve aquí y entra con tu correo y contraseña. Si no llega en unos minutos, revisa la carpeta de spam.</p>
        {info && <p className="success-text" role="status">{info}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="btn primary" onClick={() => { setSentTo(''); setMode('in'); setPassword(''); setPassword2('') }}>Ya lo confirmé, entrar</button>
        <button type="button" className="btn ghost" onClick={() => void resend(sentTo)}>Reenviar correo</button>
      </section>
    )
  }

  return (
    <form className="card form" onSubmit={submit}>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'in'} className={`tab-btn ${mode === 'in' ? 'on' : ''}`} onClick={() => { setMode('in'); setError('') }}>Entrar</button>
        <button type="button" role="tab" aria-selected={mode === 'up'} className={`tab-btn ${mode === 'up' ? 'on' : ''}`} onClick={() => { setMode('up'); setError('') }}>Crear cuenta</button>
      </div>
      <p className="muted">
        {mode === 'in'
          ? 'Con tu cuenta, los datos se guardan también en la nube y se comparten con el aparato del mostrador.'
          : 'Crea la cuenta del negocio. Te pediremos confirmar el correo.'}
      </p>
      <label>
        Correo
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
      </label>
      <label>
        Contraseña
        <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        {mode === 'up' && <span className="hint">Al menos {MIN_PASSWORD} caracteres.</span>}
      </label>
      {mode === 'up' && (
        <label>
          Repite la contraseña
          <input type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
        </label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {info && <p className="success-text" role="status">{info}</p>}
      {unconfirmed && <button type="button" className="btn ghost" onClick={() => void resend(email)}>Reenviar correo de confirmación</button>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}</button>
    </form>
  )
}

function NotLinked({ business }: { business: Business | null }) {
  const st = useSyncStatus()
  const [state, setState] = useState<BusinessStatus>()
  const [others, setOthers] = useState<{ businessId: string; name: string }[]>()
  const [empty, setEmpty] = useState<boolean>()
  const [progress, setProgress] = useState<{ done: number; total: number }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [s, mine, e] = await Promise.all([business ? businessStatus(business.id) : Promise.resolve(undefined), myBusinesses(), deviceIsEmpty()])
        if (!alive) return
        setState(s)
        setOthers(mine.filter((b) => b.businessId !== business?.id))
        setEmpty(e)
      } catch (err) {
        if (alive) setError(accountError(err))
      }
    })()
    return () => {
      alive = false
    }
  }, [business])

  async function upload() {
    if (!business) return
    setBusy(true)
    setError('')
    try {
      await connectBusiness(business.id, (done, total) => setProgress({ done, total }))
    } catch (err) {
      setError(accountError(err))
    }
    setBusy(false)
  }

  async function download(id: string) {
    setBusy(true)
    setError('')
    try {
      await downloadBusiness(id)
    } catch (err) {
      setError(accountError(err))
      setBusy(false)
    }
  }

  const loading = others === undefined && !error

  return (
    <>
      <section className="card form">
        <p>
          Sesión iniciada como <strong>{st.session?.email}</strong>.
        </p>
        {loading && <p className="muted">Consultando tu cuenta…</p>}
        {business && state === 'unclaimed' && (
          <>
            <h2>Subir mis datos</h2>
            <p>Se suben a tu cuenta todos los datos de <strong>{business.name}</strong> que hay en este aparato. Después se mantienen al día solos.</p>
            <p className="muted">Puede tardar un poco la primera vez. Si se corta, vuelve a tocar el botón: sigue donde se quedó.</p>
          </>
        )}
        {business && state === 'member' && (
          <>
            <h2>{business.name} ya está en tu cuenta</h2>
            <p className="muted">Se sube lo que falte de este aparato y queda conectado.</p>
          </>
        )}
        {business && state === 'forbidden' && <p className="error" role="alert">Este negocio pertenece a otra cuenta. Entra con la cuenta con la que lo subiste.</p>}
        {business && (state === 'unclaimed' || state === 'member') && (
          <button type="button" className="btn primary" disabled={busy} onClick={() => void upload()}>
            {busy ? (progress ? `Subiendo ${progress.done} de ${progress.total}…` : 'Subiendo…') : state === 'unclaimed' ? 'Subir mis datos' : 'Conectar este aparato'}
          </button>
        )}
        {busy && progress && progress.total > 0 && <progress max={progress.total} value={progress.done} />}
        {!business && others?.length === 0 && (
          <p>Tu cuenta aún no tiene negocios. Vuelve a la bienvenida, crea tu negocio y súbelo desde <strong>Más → Cuenta y nube</strong>.</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {others && others.length > 0 && (
        <section className="card form">
          <h2>Negocios de tu cuenta</h2>
          {empty ? (
            <p className="muted">Descarga uno para usarlo en este aparato (por ejemplo, el del mostrador).</p>
          ) : (
            <p className="muted">Este aparato ya tiene datos propios, así que no se pueden reemplazar desde aquí.</p>
          )}
          {others.map((b) => (
            <button key={b.businessId} type="button" className="btn ghost" disabled={busy || !empty} onClick={() => void download(b.businessId)}>
              Descargar {b.name || 'negocio sin nombre'}
            </button>
          ))}
        </section>
      )}

      <button type="button" className="btn danger-text" disabled={busy} onClick={() => void signOut()}>Cerrar sesión</button>
    </>
  )
}

function Linked({ business }: { business: Business | null }) {
  const st = useSyncStatus()
  const [confirmOut, setConfirmOut] = useState(false)

  return (
    <>
      <section className="card form">
        <p>
          <strong>{business?.name}</strong> está conectado a la cuenta <strong>{st.link?.email}</strong>.
        </p>
        <p>
          Estado: <strong>{PHASE_TEXT[st.phase] ?? '…'}</strong>
          {st.pending > 0 && <> · {st.pending === 1 ? '1 cambio sin subir' : `${st.pending} cambios sin subir`}</>}
        </p>
        <p className="muted">Última sincronización: {st.lastSyncAt ? formatDateTime(st.lastSyncAt) : 'nunca'}</p>
        {st.phase === 'offline' && <p className="muted">Puedes seguir vendiendo: los cambios se suben solos cuando vuelva el internet.</p>}
        {st.phase === 'error' && st.error && <p className="error" role="alert">{st.error}</p>}
        <button type="button" className="btn primary" disabled={st.phase === 'syncing'} onClick={() => void syncNow()}>Sincronizar ahora</button>
      </section>
      {confirmOut ? (
        <section className="card confirm">
          <p>
            {st.pending > 0 ? `Hay ${st.pending} cambios sin subir: se quedan en este aparato y se suben cuando vuelvas a entrar. ` : ''}
            Mientras no entres, este aparato no se sincroniza. ¿Cerrar sesión?
          </p>
          <div className="quick">
            <button type="button" className="btn ghost" onClick={() => setConfirmOut(false)}>Cancelar</button>
            <button type="button" className="btn expense" onClick={() => void signOut()}>Cerrar sesión</button>
          </div>
        </section>
      ) : (
        <button type="button" className="btn danger-text" onClick={() => setConfirmOut(true)}>Cerrar sesión</button>
      )}
    </>
  )
}
