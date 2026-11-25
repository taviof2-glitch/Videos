import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { backupFileName, exportBackup, importBackup, lastBackupAt } from '../data/backup'
import type { Business } from '../data/types'
import { restoreBlocked, useSyncStatus } from '../sync/runner'
import { formatDateTime } from '../ui/forms'
import { useActor, useCan } from '../ui/actor'
import { downloadBlob } from '../ui/share'

/** Más: accesos y copia de seguridad (exportar / importar). */
export default function More({ business }: { business: Business }) {
  const last = useLiveQuery(async () => (await lastBackupAt()) ?? null, [])
  const persisted = useLiveQuery(async () => (await navigator.storage?.persisted?.()) ?? null, [])
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const [pending, setPending] = useState<{ name: string; text: string }>()
  const [busy, setBusy] = useState(false)
  const sync = useSyncStatus()
  const isOwner = useActor().role === 'owner'
  const can = useCan()

  async function exportNow() {
    setBusy(true)
    setMessage(undefined)
    try {
      const file = await exportBackup()
      const saved = await downloadBlob(new Blob([JSON.stringify(file)], { type: 'application/json' }), backupFileName(file.exportedAt))
      setMessage(saved ? { ok: true, text: 'Copia descargada. Guárdala en un lugar seguro (tu correo, Drive o la computadora).' } : { ok: false, text: 'No se guardó el archivo. Cuando quieras, vuelve a intentarlo.' })
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
          <Link to="/negocios" className="module"><span aria-hidden>🏪</span>Mis negocios</Link>
          <Link to="/clientes" className="module"><span aria-hidden>👥</span>Clientes</Link>
          {can('expenses') && <Link to="/proveedores" className="module"><span aria-hidden>🚚</span>Proveedores</Link>}
          <Link to="/inventario" className="module"><span aria-hidden>📦</span>Inventario</Link>
          {can('expenses') && <Link to="/compras" className="module"><span aria-hidden>🛒</span>Compras</Link>}
          <Link to="/cotizaciones" className="module"><span aria-hidden>📝</span>Cotizaciones</Link>
          <Link to="/cotizador" className="module"><span aria-hidden>⚡</span>Cotizador</Link>
          {can('balance') && <Link to="/estadisticas" className="module"><span aria-hidden>📈</span>Estadísticas</Link>}
          {isOwner && <Link to="/catalogo" className="module"><span aria-hidden>🛍️</span>Catálogo</Link>}
          {isOwner && <Link to="/empleados" className="module"><span aria-hidden>🧑‍🤝‍🧑</span>Empleados</Link>}
          <Link to="/pedidos" className="module"><span aria-hidden>📥</span>Pedidos</Link>
        </div>
      </section>

      {isOwner && sync.available && (
        <section className="card">
          <h2>Cuenta y nube</h2>
          <p className="muted">
            {sync.link ? `Conectado a ${sync.link.email}. Tus datos se guardan también en la nube.` : 'Crea una cuenta para guardar tus datos en la nube y usarlos en el aparato del mostrador.'}
          </p>
          <Link to="/cuenta" className="btn ghost">{sync.link ? 'Ver cuenta' : 'Entrar o crear cuenta'}</Link>
        </section>
      )}

      {isOwner && (
        <>
      <section className="card">
        <h2>Copia de seguridad</h2>
        <p className="muted">
          {sync.link
            ? 'Además de la nube, puedes descargar una copia para guardarla tú.'
            : 'Tus datos viven solo en este dispositivo. Si borras los datos del navegador o cambias de teléfono, se pierden: descarga una copia con frecuencia.'}
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
        {restoreBlocked() ? (
          <p className="warn">Con la cuenta conectada no se puede restaurar una copia (borraría datos que ya están en la nube). Si de verdad lo necesitas, cierra sesión primero.</p>
        ) : pending ? (
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

        </>
      )}

      {message && <p className={message.ok ? 'success' : 'error'} role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
    </>
  )
}
