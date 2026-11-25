import { useEffect, useState } from 'react'
import { db } from '../data/db'

/** Abre la base local antes de mostrar la app. Si el navegador no deja guardar datos, lo dice en vez de quedarse cargando. */
export default function StorageGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'opening' | 'ok' | 'error'>('opening')

  useEffect(() => {
    let alive = true
    db.open().then(
      () => alive && setState('ok'),
      () => alive && setState('error'),
    )
    return () => {
      alive = false
    }
  }, [])

  if (state === 'opening') return <p className="loading">Cargando…</p>
  if (state === 'error') {
    return (
      <main className="welcome">
        <h1>No se pueden guardar datos aquí</h1>
        <p className="muted">
          Houselite guarda todo en este navegador y no tiene permiso para hacerlo. Pasa si usas una ventana privada o si bloqueaste los datos del sitio. Prueba en una ventana normal o permite los datos del sitio, y vuelve a abrirla.
        </p>
      </main>
    )
  }
  return <>{children}</>
}
