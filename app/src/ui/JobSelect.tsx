import { useLiveQuery } from 'dexie-react-hooks'
import { listContacts } from '../data/contacts'
import { listJobs } from '../data/jobs'

/** «Para la obra»: elige a qué obra se carga un gasto o una compra (suma a su costo real). */
export default function JobSelect({ businessId, value, onChange }: { businessId: string; value: string; onChange: (v: string) => void }) {
  const jobs = useLiveQuery(async () => {
    const names = new Map((await listContacts(businessId, 'customer')).map((c) => [c.id, c.name]))
    // Las que siguen en el taller primero; las ya liquidadas solo si es la que ya estaba elegida.
    return (await listJobs(businessId))
      .filter((j) => j.job.stage !== 'liquidado' || j.id === value)
      .map((j) => ({ id: j.id, label: [names.get(j.contactId ?? ''), j.title, j.folio].filter(Boolean).join(' · ') }))
  }, [businessId, value]) ?? []
  if (!jobs.length && !value) return null
  return (
    <label>
      Para la obra <small className="muted">(opcional)</small>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No es de una obra</option>
        {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
      </select>
    </label>
  )
}
