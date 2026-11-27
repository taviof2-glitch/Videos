// Resumen del día: lo llama el cron de Vercel a las 8:00 (hora de Tepatitlán) y manda un aviso push
// a los teléfonos de cada negocio con lo que hay hoy (citas, entregas, cotizaciones sin respuesta, cobros vencidos).
import webpush from 'web-push'
import { buildDigest, type DigestRow } from '../src/data/digest.js'
import { SUPABASE_KEY, SUPABASE_URL } from './_auth.js'

type Req = { method?: string; headers: Record<string, string | string[] | undefined> }
type Res = { status: (n: number) => Res; json: (b: unknown) => void }
type Biz = { businessId: string; subs: { endpoint: string; p256dh: string; auth: string }[] | null; rows: DigestRow[] }

export default async function handler(req: Req, res: Res) {
  const secret = process.env.CRON_SECRET
  if (!secret || String(req.headers.authorization ?? '') !== `Bearer ${secret}`) return res.status(401).json({ message: 'sin_permiso' })
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv || !process.env.DIGEST_KEY) return res.status(503).json({ message: 'Falta configurar los avisos' })

  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_digest_data`, { method: 'POST', headers, body: JSON.stringify({ p_key: process.env.DIGEST_KEY }) })
  if (!r.ok) return res.status(502).json({ message: 'No se pudieron leer los datos' })
  const list = (await r.json()) as Biz[]

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:avisos@houselite.app', pub, priv)
  let sent = 0
  for (const b of list) {
    const d = buildDigest(b.rows ?? [])
    const payload = JSON.stringify({ title: d.title, body: d.body, url: '/agenda', tag: 'resumen-del-dia' })
    await Promise.all((b.subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 6 })
        sent++
      } catch {
        // Suscripciones vencidas se limpian cuando alguien manda un aviso desde la app (api/push.ts).
      }
    }))
  }
  return res.json({ businesses: list.length, sent })
}
