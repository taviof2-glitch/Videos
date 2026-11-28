// Galería de trabajos terminados: las fotos de las obras, por tipo de mueble, para mostrarlas a clientes y en redes.
import { db } from './db'
import { listJobs, newTrackToken, type JobItem } from './jobs'
import type { Business } from './types'
import { categoryOf } from './galleryCats'

export { CATEGORIES, categoryLabel, categoryOf, socialText } from './galleryCats'

/** Obras con fotos (las más recientes primero), con su tipo de mueble. */
export async function galleryJobs(businessId: string): Promise<(JobItem & { category: string })[]> {
  return (await listJobs(businessId))
    .filter((j) => (j.job.photos?.length ?? 0) > 0)
    .map((j) => ({ ...j, category: categoryOf(j.title) }))
    .sort((a, b) => (b.job.deliveredAt ?? b.job.startedAt).localeCompare(a.job.deliveredAt ?? a.job.startedAt))
}

export async function ensureGalleryToken(business: Business): Promise<string> {
  if (business.galleryToken) return business.galleryToken
  const token = newTrackToken()
  await db.business.update(business.id, { galleryToken: token, updatedAt: new Date().toISOString() })
  return token
}

export const galleryUrl = (token: string, category?: string, origin = location.origin) => `${origin}/g/${token}${category ? `?c=${category}` : ''}`
