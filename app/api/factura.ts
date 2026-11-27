// Factura electrónica (CFDI 4.0) con Facturapi. Opcional: solo funciona si el negocio guardó su llave de Facturapi
// en Vercel (FACTURAPI_KEY) y subió ahí su e.firma/CSD. La app arma los datos de la venta; aquí solo se timbran.
import { allowed } from './_auth.js'

export const config = { maxDuration: 60 }

const BASE = 'https://www.facturapi.io/v2'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

type Customer = { legalName: string; rfc: string; taxSystem: string; zip: string; email?: string }
type Item = { description: string; quantity: number; unitPrice: number; productKey?: string }
type Body =
  | { action: 'create'; customer?: Customer; publicGeneral?: boolean; use?: string; paymentForm?: string; paymentMethod?: 'PUE' | 'PPD'; items?: Item[]; taxIncluded?: boolean; productKey?: string; externalId?: string; sendTo?: string }
  | { action: 'email'; id: string; email?: string }
  | { action: 'cancel'; id: string; motive?: string }

const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
const PUBLIC_RFC = 'XAXX010101000'

async function fapi(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${process.env.FACTURAPI_KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
}

async function apiError(r: Response): Promise<string> {
  const b = (await r.json().catch(() => null)) as { message?: string } | null
  return b?.message ? `Facturapi: ${b.message}` : `Facturapi respondió con error (${r.status}).`
}

async function gate(request: Request): Promise<Response | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!token) return json({ message: 'Entra a tu cuenta en «Cuenta y nube» para facturar.' }, 401)
  if (!process.env.FACTURAPI_KEY) return json({ error: 'sin_llave', message: 'La factura electrónica no está activada: falta la llave de Facturapi en Vercel (FACTURAPI_KEY).' }, 503)
  try {
    if (!(await allowed(token))) return json({ message: 'Tu sesión no tiene un negocio en la cuenta.' }, 403)
  } catch {
    return json({ message: 'No se pudo comprobar tu sesión. Intenta de nuevo.' }, 502)
  }
  return null
}

/** Descargar el PDF o XML de una factura: GET /api/factura?id=...&f=pdf|xml */
export async function GET(request: Request): Promise<Response> {
  const denied = await gate(request)
  if (denied) return denied
  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? ''
  const f = url.searchParams.get('f') === 'xml' ? 'xml' : 'pdf'
  if (!/^[a-zA-Z0-9]{8,40}$/.test(id)) return json({ message: 'Factura no válida.' }, 400)
  const r = await fapi(`/invoices/${id}/${f}`)
  if (!r.ok) return json({ message: await apiError(r) }, 502)
  return new Response(await r.arrayBuffer(), { headers: { 'content-type': f === 'pdf' ? 'application/pdf' : 'application/xml', 'cache-control': 'no-store' } })
}

export async function POST(request: Request): Promise<Response> {
  const denied = await gate(request)
  if (denied) return denied
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return json({ message: 'La petición no es válida.' }, 400)
  }

  if (body.action === 'email') {
    if (!/^[a-zA-Z0-9]{8,40}$/.test(body.id)) return json({ message: 'Factura no válida.' }, 400)
    const r = await fapi(`/invoices/${body.id}/email`, { method: 'POST', body: JSON.stringify(body.email ? { email: body.email } : {}) })
    return r.ok ? json({ ok: true }) : json({ message: await apiError(r) }, 502)
  }

  if (body.action === 'cancel') {
    if (!/^[a-zA-Z0-9]{8,40}$/.test(body.id)) return json({ message: 'Factura no válida.' }, 400)
    const motive = ['01', '02', '03', '04'].includes(body.motive ?? '') ? body.motive : '02'
    const r = await fapi(`/invoices/${body.id}?motive=${motive}`, { method: 'DELETE' })
    if (!r.ok) return json({ message: await apiError(r) }, 502)
    const inv = (await r.json()) as { status: string; cancellation_status?: string }
    return json({ status: inv.status, cancellation: inv.cancellation_status ?? '' })
  }

  if (body.action !== 'create') return json({ message: 'Acción no válida.' }, 400)
  const items = (body.items ?? []).filter((i) => i && i.description && i.quantity > 0 && i.unitPrice >= 0).slice(0, 200)
  if (!items.length) return json({ message: 'La venta no tiene conceptos para facturar.' }, 400)
  const productKey = /^\d{8}$/.test(body.productKey ?? '') ? body.productKey! : '01010101'

  let customer: Record<string, unknown>
  let use = /^[A-Z]\d{2}$/.test(body.use ?? '') ? body.use! : 'G03'
  const now = new Date()
  let global: Record<string, unknown> | undefined
  if (body.publicGeneral) {
    // Público en general: RFC genérico, sin efectos fiscales y con la información global del CFDI 4.0.
    customer = { legal_name: 'PUBLICO EN GENERAL', tax_id: PUBLIC_RFC, tax_system: '616', address: { zip: body.customer?.zip || '' } }
    use = 'S01'
    global = { periodicity: 'day', months: String(now.getMonth() + 1).padStart(2, '0'), year: now.getFullYear() }
  } else {
    const c = body.customer
    const rfc = (c?.rfc ?? '').trim().toUpperCase()
    if (!c || !RFC.test(rfc)) return json({ message: 'El RFC del cliente no es válido.' }, 400)
    if (!c.legalName?.trim()) return json({ message: 'Falta la razón social (el nombre exacto como aparece en la constancia fiscal).' }, 400)
    if (!/^\d{3}$/.test(c.taxSystem ?? '')) return json({ message: 'Falta el régimen fiscal del cliente.' }, 400)
    if (!/^\d{5}$/.test(c.zip ?? '')) return json({ message: 'Falta el código postal fiscal del cliente (5 números).' }, 400)
    customer = { legal_name: c.legalName.trim().toUpperCase(), tax_id: rfc, tax_system: c.taxSystem, address: { zip: c.zip }, ...(c.email && { email: c.email }) }
  }
  if (body.publicGeneral && !/^\d{5}$/.test(String((customer.address as { zip: string }).zip))) delete (customer as { address?: unknown }).address

  const ppd = body.paymentMethod === 'PPD'
  const payload = {
    type: 'I',
    customer,
    use,
    payment_form: ppd ? '99' : /^\d{2}$/.test(body.paymentForm ?? '') ? body.paymentForm : '01',
    payment_method: ppd ? 'PPD' : 'PUE',
    items: items.map((i) => ({
      quantity: Math.round(i.quantity * 1000) / 1000,
      product: { description: i.description.slice(0, 1000), product_key: /^\d{8}$/.test(i.productKey ?? '') ? i.productKey : productKey, unit_key: 'H87', unit_name: 'Pieza', price: Math.round(i.unitPrice * 100) / 100, tax_included: body.taxIncluded !== false },
    })),
    ...(global && { global }),
    ...(body.externalId && { external_id: String(body.externalId).slice(0, 60) }),
  }
  const r = await fapi('/invoices', { method: 'POST', body: JSON.stringify(payload) })
  if (!r.ok) return json({ message: await apiError(r) }, 502)
  const inv = (await r.json()) as { id: string; uuid: string; series?: string; folio_number?: number | string; total: number; status: string; livemode?: boolean }
  if (body.sendTo) await fapi(`/invoices/${inv.id}/email`, { method: 'POST', body: JSON.stringify({ email: body.sendTo }) }).catch(() => undefined)
  return json({ id: inv.id, uuid: inv.uuid, series: inv.series ?? '', folio: String(inv.folio_number ?? ''), total: inv.total, status: inv.status, test: inv.livemode === false })
}
