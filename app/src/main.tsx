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
  void Promise.all([import('./sync/supabase'), import('./sync/runner')]).then(([s, r]) => r.initSync(s.supabaseBackend))
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
