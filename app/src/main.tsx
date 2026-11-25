import '@fontsource-variable/figtree'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import App from './App'
import StorageGate from './ui/StorageGate'
import './index.css'

// Pide que el navegador no borre los datos locales por falta de espacio.
void navigator.storage?.persist?.()

// Sincronización con el servidor (T15). La versión de claude.ai se compila sin ella (VITE_SYNC=off).
if (import.meta.env.VITE_SYNC !== 'off') {
  // Diagnóstico: qué versión corre este aparato y cómo va la sincronización a los 25 s de abrir.
  void import('./sync/diag').then(({ diag }) => {
    diag('arranque')
    const loaded = Promise.all([import('./sync/supabase'), import('./sync/runner')])
    loaded.then(([s, r]) => r.initSync(s.supabaseBackend)).catch((e) => diag('no-inicia', { problem: String(e).slice(0, 200) }))
    setTimeout(() => {
      void loaded
        .then(([, r]) => {
          const st = r.getSyncStatus()
          diag('estado', { phase: st.phase, step: st.step, detail: st.detail, pending: st.pending, linked: !!st.link, session: !!st.session, lastSyncAt: st.lastSyncAt, lastProblem: st.lastProblem })
        })
        .catch(() => undefined)
    }, 25_000)
  })
}

// Actualizaciones: al volver a la app se busca versión nueva y, cuando llega, la página se recarga sola
// (sin esto había que cerrar la app por completo dos veces para ver los cambios).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const hadController = !!navigator.serviceWorker.controller
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return
    reloaded = true
    location.reload()
  })
  const check = () => void navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => undefined)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
  setInterval(check, 30 * 60_000)
}

// La versión publicada en claude.ai (npm run build:artifact) no mantiene rutas en la dirección: navega en memoria.
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <StorageGate>
        <App />
      </StorageGate>
    </Router>
  </StrictMode>,
)
