// Datos de pago del negocio (CLABE, banco, titular y enlace de pago) para cotizaciones, comprobantes y enlaces.
import { db } from './db'
import type { Business, PayInfo } from './types'

export const CLABE_RE = /^\d{18}$/

export async function savePayInfo(businessId: string, p: PayInfo | undefined): Promise<void> {
  if (p) {
    const clabe = p.clabe.replace(/\s/g, '')
    if (clabe && !CLABE_RE.test(clabe)) throw new Error('La CLABE debe tener 18 números')
    if (p.link && !/^https:\/\//.test(p.link.trim())) throw new Error('El enlace de pago debe empezar con https://')
    p = { bank: p.bank.trim(), clabe, holder: p.holder.trim(), ...(p.link?.trim() && { link: p.link.trim() }) }
    if (!p.bank && !p.clabe && !p.holder && !p.link) p = undefined
  }
  await db.business.update(businessId, { payInfo: p, updatedAt: new Date().toISOString() })
}

/** «1234 5678 …» en grupos de 4 para leerla fácil. */
export const prettyClabe = (c: string) => c.replace(/(\d{4})(?=\d)/g, '$1 ')

/** Las líneas de «Datos para tu pago» (vacío si no hay datos). */
export function payLines(b: Pick<Business, 'payInfo'>): string[] {
  const p = b.payInfo
  if (!p || (!p.clabe && !p.link)) return []
  return [
    'Datos para tu pago:',
    ...(p.bank ? [`Banco: ${p.bank}`] : []),
    ...(p.clabe ? [`CLABE: ${prettyClabe(p.clabe)}`] : []),
    ...(p.holder ? [`A nombre de: ${p.holder}`] : []),
    ...(p.link ? [`Pago con tarjeta: ${p.link}`] : []),
  ]
}
