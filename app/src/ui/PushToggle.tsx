import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import type { Business } from '../data/types'
import { disablePush, enablePush, needsInstall, notifyTeam, pushState, type PushState } from '../sync/push'
import { useSyncStatus } from '../sync/runner'
import { useActor } from './actor'

/** Activar en este teléfono los avisos del equipo (cada paso de una obra). */
export default function PushToggle({ business }: { business: Business }) {
  const st = useSyncStatus()
  const actor = useActor()
  const [state, setState] = useState<PushState>()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    void pushState().then(setState)
  }, [])

  if (state === undefined) return null
  if (state === 'unsupported') {
    return needsInstall()
      ? <p className="note-box"><Bell className="i-inline" aria-hidden /> Para recibir avisos de obras en iPhone, instala la app: Compartir → «Agregar a inicio», y ábrela desde ahí.</p>
      : null
  }

  async function toggle() {
    setBusy(true)
    setError('')
    setMsg('')
    try {
      if (state === 'on') {
        await disablePush()
        setMsg('Listo: este teléfono ya no recibe avisos.')
      } else {
        await enablePush(business.id, actor.id)
        setMsg('✓ Avisos activados. Cada que alguien mueva una obra de etapa te llegará una notificación.')
      }
      setState(await pushState())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo')
      setState(await pushState())
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card push-card">
      <div className="row-between">
        <span>
          <strong>{state === 'on' ? 'Avisos activados en este teléfono' : 'Avisos de obras'}</strong>
          <small className="muted"> · {state === 'on' ? 'te llega una notificación en cada paso que marque el equipo' : 'recibe una notificación cada que alguien avance una obra'}</small>
        </span>
        {state === 'denied' ? null : (
          <button type="button" className={`btn small ${state === 'on' ? 'ghost' : 'primary'}`} disabled={busy || (state !== 'on' && !st.session)} onClick={() => void toggle()}>
            {state === 'on' ? <><BellOff aria-hidden /> Quitar</> : <><Bell aria-hidden /> Activar</>}
          </button>
        )}
      </div>
      {state === 'denied' && <p className="muted">Bloqueaste los avisos para esta app. Actívalos en los ajustes del navegador (o del teléfono) y vuelve a abrirla.</p>}
      {state !== 'on' && !st.session && state !== 'denied' && <p className="muted">Primero entra a tu cuenta en «Cuenta y nube» en este teléfono.</p>}
      {state === 'on' && (
        <button type="button" className="link" onClick={() => { notifyTeam(business.id, { title: 'Prueba de avisos', body: `${actor.name} mandó una prueba desde Houselite`, url: '/obras' }, undefined, true); setMsg('Prueba enviada: debe llegarte a ti y a los demás teléfonos con avisos activados.') }}>
          Mandar una prueba
        </button>
      )}
      {msg && <p className="success" role="status">{msg}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
