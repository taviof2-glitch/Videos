import { useSyncExternalStore } from 'react'
import { Smartphone, X } from 'lucide-react'

/** Evento de Chrome/Edge en Android y escritorio que permite instalar la app con un botón propio. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const listeners = new Set<() => void>()
let deferred: InstallEvent | null = null
let installed = false
const emit = () => listeners.forEach((l) => l())

// En la versión publicada como página de claude.ai no hay service worker: no se puede instalar.
const available = typeof window !== 'undefined' && import.meta.env.VITE_ROUTER !== 'memory'

if (available) {
  // Se escucha desde que carga el código: el navegador lanza el evento una sola vez, a veces antes de que se abra una pantalla.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
}

const standalone = () => available && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
const isIos = () => available && /iphone|ipad|ipod/i.test(navigator.userAgent)

export type InstallState = { kind: 'hidden' } | { kind: 'prompt' } | { kind: 'ios' } | { kind: 'manual' }

/** Qué mostrar para instalar: botón (Android/Chrome), pasos de «Compartir» (iPhone), o pasos del menú (otros navegadores). */
function snapshot(): string {
  if (!available || installed || standalone()) return 'hidden'
  if (deferred) return 'prompt'
  return isIos() ? 'ios' : 'manual'
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

export function useInstall(): { state: InstallState['kind']; install: () => Promise<void> } {
  const state = useSyncExternalStore(subscribe, snapshot, () => 'hidden') as InstallState['kind']
  async function install() {
    if (!deferred) return
    const ev = deferred
    await ev.prompt()
    await ev.userChoice
    deferred = null // el navegador solo deja usarlo una vez
    emit()
  }
  return { state, install }
}

/** Tarjeta con lo necesario para instalar Houselite en el celular. */
export function InstallCard() {
  const { state, install } = useInstall()
  if (state === 'hidden') return null
  return (
    <section className="card">
      <h2>Instalar en el celular</h2>
      <p className="muted">Ábrela desde un ícono en tu pantalla de inicio, como cualquier app, y úsala aun sin internet.</p>
      {state === 'prompt' && <button type="button" className="btn primary" onClick={() => void install()}>Instalar Houselite</button>}
      {state === 'ios' && (
        <ol className="steps">
          <li>Abre esta página en <strong>Safari</strong>.</li>
          <li>Toca el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li>
          <li>Elige <strong>Añadir a pantalla de inicio</strong> y confirma.</li>
        </ol>
      )}
      {state === 'manual' && (
        <ol className="steps">
          <li>Abre el menú del navegador (los tres puntos ⋮).</li>
          <li>Elige <strong>Instalar app</strong> o <strong>Añadir a pantalla de inicio</strong>.</li>
        </ol>
      )}
    </section>
  )
}

const DISMISSED = 'installBannerDismissed'

/** Aviso corto en Inicio, solo cuando se puede instalar con un toque o en iPhone; se puede cerrar. */
export function InstallBanner() {
  const { state, install } = useInstall()
  let dismissed = false
  try {
    dismissed = localStorage.getItem(DISMISSED) === '1'
  } catch {
    // sin almacenamiento: se muestra siempre
  }
  const close = () => {
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      // nada que guardar
    }
    emit()
  }
  if (dismissed || (state !== 'prompt' && state !== 'ios')) return null
  return state === 'prompt' ? (
    <div className="alert static">
      <div><Smartphone className="i-inline" aria-hidden /> Instala Houselite en tu celular</div>
      <div>
        <button type="button" className="chip on" onClick={() => void install()}>Instalar</button>
        <button type="button" className="chip" aria-label="Cerrar aviso" onClick={close}><X aria-hidden size={16} /></button>
      </div>
    </div>
  ) : (
    <div className="alert static">
      <div><Smartphone className="i-inline" aria-hidden /> Para instalar: toca Compartir y luego «Añadir a pantalla de inicio»</div>
      <button type="button" className="chip" aria-label="Cerrar aviso" onClick={close}><X aria-hidden size={16} /></button>
    </div>
  )
}
