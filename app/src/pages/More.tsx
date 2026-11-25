import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { backupFileName, exportBackup, importBackup, lastBackupAt } from '../data/backup'
import type { Business } from '../data/types'
import { formatDateTime } from '../ui/forms'
import { downloadBlob } from '../ui/share'

/** Más: accesos y copia de seguridad (exportar / importar). */
export default function More({ business }: { business: Business }) {
  const last = useLiveQuery(async () => (await lastBackupAt()) ?? null, [])
  const persisted = useLiveQuery(async () => (await navigator.storage?.persisted?.()) ?? null, [])
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const [pending, setPending] = useState<{ name: string; text: string }>()
  const [busy, setBusy] = useState(false)

  async function exportNow() {
    setBusy(true)
    setMessage(undefined)
    try {
      const file = await exportBackup()
      downloadBlob(new Blob([JSON.stringify(file)], { type: 'application/json' }), backupFileName(file.exportedAt))
      setMessage({ ok: true, text: 'Copia descargada. Guárdala en un lugar seguro (tu correo, Drive o la computadora).' })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudo crear la copia' })
    }
    setBusy(false)
  }

  async function pick(file: File | undefined) {
    setMessage(undefined)
    if (!file) return
    setPending({ name: file.name, text: await file.text() })
  }

  async function confirmImport() {
    if (!pending) return
    setBusy(true)
    try {
      const s = await importBackup(pending.text)
      const n = (c: number, one: string, many: string) => `${c} ${c === 1 ? one : many}`
      setMessage({ ok: true, text: `Copia restaurada: ${n(s.products, 'producto', 'productos')}, ${n(s.contacts, 'contacto', 'contactos')} y ${n(s.movements, 'movimiento', 'movimientos')}.` })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudo restaurar la copia' })
    }
    setPending(undefined)
    setBusy(false)
  }

  return (
    <>
      <h1>Más</h1>

      <section className="card">
        <h2>{business.name}</h2>
        <div className="grid">
          <Link to="/clientes" className="module"><span aria-hidden>👥</span>Clientes</Link>
          <Link to="/proveedores" className="module"><span aria-hidden>🚚</span>Proveedores</Link>
          <Link to="/inventario" className="module"><span aria-hidden>📦</span>Inventario</Link>
        </div>
      </section>

      <section className="card">
        <h2>Copia de seguridad</h2>
        <p className="muted">
          Tus datos viven solo en este dispositivo. Si borras los datos del navegador o cambias de teléfono, se pierden: descarga una copia con frecuencia.
        </p>
        <p>
          Última copia: <strong>{last === undefined ? '…' : last ? formatDateTime(last) : 'nunca'}</strong>
          {persisted === false && <small className="muted"> · El navegador podría borrar los datos si falta espacio.</small>}
        </p>
        <button type="button" className="btn primary" disabled={busy} onClick={() => void exportNow()}>Descargar copia</button>
      </section>

      <section className="card form">
        <h2>Restaurar una copia</h2>
        <p className="muted">Reemplaza <strong>todo</strong> lo que hay ahora en este dispositivo por el contenido de la copia.</p>
        {pending ? (
          <div className="confirm">
            <p>¿Restaurar <strong>{pending.name}</strong>? Se borrarán los datos actuales. Si dudas, cancela y descarga primero una copia de lo de hoy.</p>
            <div className="quick">
              <button type="button" className="btn ghost" onClick={() => setPending(undefined)}>Cancelar</button>
              <button type="button" className="btn expense" disabled={busy} onClick={() => void confirmImport()}>Sí, restaurar</button>
            </div>
          </div>
        ) : (
          <label className="btn ghost file-btn">
            Elegir archivo de copia…
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        )}
      </section>

      {message && <p className={message.ok ? 'success' : 'error'} role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
    </>
  )
}
