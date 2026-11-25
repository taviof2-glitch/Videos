import { crc32 } from './xlsx'

/**
 * Código de pedido: va dentro del mensaje de WhatsApp que manda el cliente desde el catálogo y permite que Conta
 * arme el pedido sin teclear. Formato: `CP1.<datos en base64url>.<CRC-32 de los datos, 8 dígitos hex>`.
 * Lo usan la página del catálogo (para escribirlo) y Conta (para leerlo): este archivo es la única definición.
 */
export const ORDER_CODE_VERSION = 'CP1'

// Los productos viajan como una cadena corta «p,v,q,c;p,v,q,c» (no como objetos JSON) para que un pedido de 40 productos
// siga cabiendo en un enlace de WhatsApp. Los ids cortos son hexadecimales: no llevan «,» ni «;».

/** p = id corto del producto, v = id corto de la variante, q = cantidad, c = precio unitario en centavos que vio el cliente. */
export type OrderCodeItem = { p: string; v?: string; q: number; c: number }
export type OrderCodePayload = { n?: string; m?: string; i: OrderCodeItem[] }

const MAX_ITEMS = 100

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(data: string): string {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (data.length % 4)) % 4))
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

const checksum = (data: string) => crc32(new TextEncoder().encode(data)).toString(16).padStart(8, '0')

const packItems = (items: OrderCodeItem[]) => items.map((it) => `${it.p},${it.v ?? ''},${it.q},${it.c}`).join(';')

export function encodeOrderCode(payload: OrderCodePayload): string {
  const data = toBase64Url(JSON.stringify({ n: payload.n, m: payload.m, i: packItems(payload.i ?? []) }))
  return `${ORDER_CODE_VERSION}.${data}.${checksum(data)}`
}

const CODE = new RegExp(`${ORDER_CODE_VERSION}\\.[A-Za-z0-9_-]+\\.[0-9a-f]{8}`)

/** El código dentro de un mensaje pegado, o undefined si no hay. */
export const findOrderCode = (text: string): string | undefined => text.match(CODE)?.[0]

export type DecodedOrder = { ok: true; payload: OrderCodePayload } | { ok: false; error: string }

/** Lee el código (o un mensaje que lo contiene). Valida el CRC y la forma de los datos: lo que llega por WhatsApp no es de fiar. */
export function decodeOrderCode(text: string): DecodedOrder {
  const found = findOrderCode(text)
  if (!found) {
    return /CP\d?\.[A-Za-z0-9_-]{6,}/.test(text)
      ? { ok: false, error: 'El código del pedido está incompleto. Copia el mensaje completo, hasta el final.' }
      : { ok: false, error: 'No encontré un código de pedido en ese texto. Pega el mensaje completo que te mandó el cliente.' }
  }
  const [, data, crc] = found.split('.')
  if (checksum(data) !== crc) return { ok: false, error: 'El código del pedido está dañado o incompleto. Pídele al cliente que lo mande de nuevo.' }
  let raw: unknown
  try {
    raw = JSON.parse(fromBase64Url(data))
  } catch {
    return { ok: false, error: 'No se pudo leer el código del pedido.' }
  }
  const o = raw as { n?: unknown; m?: unknown; i?: unknown } | null
  const rows = o && typeof o === 'object' && typeof o.i === 'string' && o.i ? o.i.split(';') : []
  if (rows.length === 0 || rows.length > MAX_ITEMS) return { ok: false, error: 'El pedido no trae productos.' }
  const items: OrderCodeItem[] = []
  for (const row of rows) {
    const [p, v, qs, cs, ...extra] = row.split(',')
    const q = Number(qs)
    const c = Number(cs)
    const ok =
      extra.length === 0 && /^[A-Za-z0-9-]{1,16}$/.test(p ?? '') && (!v || /^[A-Za-z0-9-]{1,16}$/.test(v)) &&
      qs !== undefined && qs !== '' && Number.isFinite(q) && q > 0 && q <= 100_000 && cs !== undefined && cs !== '' && Number.isInteger(c) && c >= 0 && c <= 1_000_000_000
    if (!ok) return { ok: false, error: 'Uno de los productos del pedido no es válido.' }
    items.push({ p, ...(v && { v }), q: Math.round(q * 1000) / 1000, c })
  }
  const text2 = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  return { ok: true, payload: { n: text2(o?.n, 80), m: text2(o?.m, 300), i: items } }
}

export type OrderMessageLine = { quantity: number; name: string; totalCents: number }

/** El mensaje que se manda por WhatsApp: legible para el negocio, con el código al final para que Conta lo lea. */
export function buildOrderMessage(o: { businessName: string; lines: OrderMessageLine[]; totalCents: number; customer: string; notes: string; code: string; money: (cents: number) => string }): string {
  const out = [`Hola, quiero hacer un pedido en ${o.businessName}:`, '']
  for (const l of o.lines) out.push(`${l.quantity} × ${l.name} — ${o.money(l.totalCents)}`)
  out.push('', `Total: ${o.money(o.totalCents)}`)
  if (o.customer.trim()) out.push(`Nombre: ${o.customer.trim()}`)
  if (o.notes.trim()) out.push(`Notas: ${o.notes.trim()}`)
  out.push('', `Código del pedido (no lo borres): ${o.code}`)
  return out.join('\n')
}
