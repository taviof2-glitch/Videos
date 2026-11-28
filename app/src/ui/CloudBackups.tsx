import { useEffect, useState } from 'react'
import { backupFileName } from '../data/backup'
import { downloadCloudBackup, listCloudBackups, type CloudBackup } from '../sync/cloudBackup'
import { formatDateTime } from './forms'
import { downloadBlob } from './share'

/** Respaldos automáticos de cada semana en la nube (los últimos 8), para bajarlos como archivo de copia. */
export default function CloudBackups({ businessId }: { businessId: string }) {
  const [list, setList] = useState<CloudBackup[]>()
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { listCloudBackups(businessId).then(setList, (e) => setErr(e instanceof Error ? e.message : 'No se pudieron leer')) }, [businessId])
  async function get(b: CloudBackup) {
    setMsg('')
    try {
      const file = await downloadCloudBackup(businessId, b)
      if (await downloadBlob(new Blob([JSON.stringify(file)], { type: 'application/json' }), backupFileName(b.created_at))) setMsg('Copia descargada.')
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo descargar') }
  }
  return (
    <section className="card">
      <h2>Respaldos semanales en la nube</h2>
      <p className="muted">Cada semana se guarda solo una copia de todo el negocio (se conservan las últimas 8). Sirve si algo se borra por error.</p>
      {list === undefined && !err && <p className="muted">Cargando…</p>}
      {list && list.length === 0 && <p className="muted">Todavía no hay respaldos: el primero se hace mañana a las 8:00.</p>}
      {list && list.length > 0 && <ul className="moves">{list.map((b) => <li key={b.id}><span className="grow">{formatDateTime(b.created_at)}<small className="muted"> · {b.rows} registros</small></span><button type="button" className="btn ghost small" onClick={() => void get(b)}>Descargar</button></li>)}</ul>}
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
    </section>
  )
}
