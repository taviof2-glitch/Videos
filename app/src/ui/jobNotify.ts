// Avisar al equipo que una obra entró al taller (desde cualquier pantalla que la pase a obra).
import { listContacts } from '../data/contacts'
import { listJobs, STAGE_LABEL } from '../data/jobs'
import type { Actor } from '../data/team'
import { jobNotice, notifyTeam } from '../sync/push'

export async function notifyNewJob(businessId: string, jobId: string, actor: Actor): Promise<void> {
  const job = (await listJobs(businessId)).find((j) => j.id === jobId)
  if (!job) return
  const customer = job.contactId ? ((await listContacts(businessId, 'customer')).find((c) => c.id === job.contactId)?.name ?? '') : ''
  notifyTeam(businessId, jobNotice({ customer, title: job.title, stageLabel: STAGE_LABEL[job.job.stage], by: actor.name, isNew: true }), actor.id)
}
