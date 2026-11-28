// Cotizador en línea para clientes: tipos de mueble con su precio por metro lineal (el cliente ve un rango aproximado).
import { db } from './db'
import { newTrackToken } from './jobs'
import type { Business } from './types'
import { LEAD_TYPES } from './leadTypes'

export { LEAD_TYPES, estimateRange } from './leadTypes'

export const leadPricesOf = (b: Pick<Business, 'leadPrices'>): Record<string, number> => Object.fromEntries(LEAD_TYPES.map(([k, , def]) => [k, b.leadPrices?.[k] ?? def]))

export async function saveLeadPrices(businessId: string, prices: Record<string, number>): Promise<void> {
  const clean = Object.fromEntries(Object.entries(prices).filter(([, v]) => Number.isFinite(v) && v >= 0).map(([k, v]) => [k, Math.round(v)]))
  await db.business.update(businessId, { leadPrices: clean, updatedAt: new Date().toISOString() })
}

export async function ensureLeadToken(business: Business): Promise<string> {
  if (business.leadToken) return business.leadToken
  const token = newTrackToken()
  await db.business.update(business.id, { leadToken: token, updatedAt: new Date().toISOString() })
  return token
}

export const leadUrl = (token: string, origin = location.origin) => `${origin}/cotiza/${token}`
