// Avisos push a los teléfonos del equipo (p. ej. «Closet de Marta: en armado»).
// GET: la clave pública para suscribirse. POST: manda un aviso a los teléfonos suscritos del negocio, menos el de quien lo manda.
import webpush from 'web-push'
import { SUPABASE_KEY, SUPABASE_URL } from './_auth.js'

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
type Res = { status: (n: number) => Res; json: (b: unknown) => void; setHeader: (k: string, v: string) => void }

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '')

export default async function handler(req: Req, res: Res) {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return res.status(503).json({ message: 'Los avisos todavía no están configurados.' })
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.json({ key: pub })
  }
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método no permitido' })

  const auth = String(req.headers.authorization ?? '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return res.status(401).json({ message: 'sin_permiso' })
  const b = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown> | undefined
  const businessId = clip(b?.businessId, 64)
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) return res.status(400).json({ message: 'Negocio no válido' })
  const payload = JSON.stringify({ title: clip(b?.title, 120), body: clip(b?.body, 300), url: clip(b?.url, 200).startsWith('/') ? clip(b?.url, 200) : '/', tag: clip(b?.tag, 80) })
  const except = clip(b?.except, 1000)
  const exceptEmployee = clip(b?.employeeId, 64)

  // Las suscripciones se leen con la sesión de quien manda: la función de la base revisa que sea del negocio.
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_targets`, { method: 'POST', headers, body: JSON.stringify({ p_business: businessId }) })
  if (!r.ok) return res.status(403).json({ message: 'sin_permiso' })
  const targets = (await r.json()) as { endpoint: string; p256dh: string; auth: string; employee_id: string | null }[]

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:avisos@houselite.app', pub, priv)
  let sent = 0
  await Promise.all(
    targets
      .filter((t) => t.endpoint !== except && !(exceptEmployee && t.employee_id === exceptEmployee))
      .map(async (t) => {
        try {
          await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 60 * 60 * 24 })
          sent++
        } catch (e) {
          // El teléfono ya no acepta avisos (se desinstaló o se quitó el permiso): se olvida.
          const code = (e as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_unsubscribe`, { method: 'POST', headers, body: JSON.stringify({ p_endpoint: t.endpoint }) }).catch(() => undefined)
        }
      }),
  )
  return res.json({ sent })
}
