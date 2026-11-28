// Cotización por enlace (/c/<código>): el cliente la ve con sus opciones y los datos de pago, y puede aceptarla.
// Al aceptar, la cotización queda «Aceptada» (con la opción elegida) y le llega un aviso al negocio.
import webpush from 'web-push'
import { SUPABASE_KEY, SUPABASE_URL } from './_auth.js'

type Req = { method?: string; query?: Record<string, string | string[] | undefined>; body?: unknown }
type Res = { status: (n: number) => Res; setHeader: (k: string, v: string) => void; send: (b: string) => void }
type Q = {
  business: { name?: string; phone?: string; country?: string; logo?: string; currency: string; payInfo?: { bank?: string; clabe?: string; holder?: string; link?: string } }
  customer?: string; number?: number; title?: string; status: string; validUntil?: string; totalCents: number; taxCents?: number; taxRate?: number
  advanceCents?: number; notes?: string; options?: { name: string; priceCents: number; desc: string }[]; chosenOption?: number; acceptedOnline?: string
  items: { name: string; quantity: number; unit?: string; unitPriceCents: number }[]
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
const rpc = (fn: string, body: unknown) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) }).catch(() => null)

function page(title: string, body: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>
:root{--bg:#f4f5f3;--card:#fff;--ink:#141414;--muted:#6b6f6a;--brand:#2f4d40;--gold:#c9a24a;--line:#e3e5e1}
@media (prefers-color-scheme:dark){:root{--bg:#121412;--card:#1c1f1c;--ink:#f1f2ef;--muted:#a3a8a1;--line:#2c302c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:560px;margin:0 auto;padding:16px;display:grid;gap:14px}.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px}
header{display:flex;gap:12px;align-items:center}header img{width:56px;height:56px;border-radius:12px;object-fit:cover}h1{margin:0;font-size:1.3rem}h2{margin:0 0 10px;font-size:1.05rem}
.muted{color:var(--muted)}.row{display:flex;justify-content:space-between;gap:10px;padding:4px 0}.total{font-size:1.4rem;font-weight:800}
.opt{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:14px;padding:12px;margin:8px 0;cursor:pointer}.opt input{margin-top:4px;accent-color:var(--brand)}
.btn{display:block;width:100%;text-align:center;border:0;background:var(--brand);color:#fff;font:inherit;font-weight:700;padding:15px;border-radius:14px;cursor:pointer;text-decoration:none}
.btn.wa{background:#1f8f4e}.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}.ok{background:#e9f5ee;color:#1f6b41;border-radius:14px;padding:14px;font-weight:600}
code{font-size:1.05rem;letter-spacing:.04em}
</style></head><body><main>${body}</main></body></html>`
}

async function notifyOwner(business: string, title: string) {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY, key = process.env.DIGEST_KEY
  if (!pub || !priv || !key) return
  const r = await rpc('push_subs_for_business', { p_key: key, p_business: business })
  if (!r || !r.ok) return
  const subs = (await r.json()) as { endpoint: string; p256dh: string; auth: string }[]
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:avisos@houselite.app', pub, priv)
  const payload = JSON.stringify({ title: '✅ Cotización aceptada', body: title, url: '/cotizaciones', tag: `acepta-${title}`.slice(0, 80) })
  await Promise.all(subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86_400 }).catch(() => undefined)))
}

export default async function handler(req: Req, res: Res) {
  const token = one(req.query?.t)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  const notFound = () => res.status(404).send(page('Cotización', '<section class="card"><h1>Enlace no válido</h1><p class="muted">Esta cotización ya no está disponible. Pide una nueva a quien te la mandó.</p></section>'))
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return notFound()

  let justAccepted = false
  if (req.method === 'POST') {
    const body = (typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : (req.body as Record<string, string>)) ?? {}
    const opt = body.o !== undefined && body.o !== '' ? Number(body.o) : null
    const r = await rpc('public_accept_quote', { p_token: token, p_option: Number.isInteger(opt) ? opt : null })
    const out = r && r.ok ? ((await r.json()) as { ok: boolean; business?: string; title?: string; number?: number } | null) : null
    if (out?.ok && out.business) {
      justAccepted = true
      await notifyOwner(out.business, `${out.title || 'Cotización'}${out.number ? ` #${out.number}` : ''}`).catch(() => undefined)
    }
  }

  const r = await rpc('public_quote', { p_token: token })
  const q = r && r.ok ? ((await r.json()) as Q | null) : null
  if (!q) return notFound()
  const money = (c: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: q.business.currency || 'MXN' }).format(c / 100)
  const name = q.business.name || 'Tu carpintería'
  const logo = q.business.logo && /^data:image\/(png|jpeg|webp);base64,/.test(q.business.logo) ? `<img src="${q.business.logo}" alt="">` : ''
  const phone = (q.business.phone ?? '').replace(/\D/g, '')
  const wa = (text: string) => (phone ? `https://wa.me/${phone.length === 10 ? `52${phone}` : phone}?text=${encodeURIComponent(text)}` : '')
  const p = q.business.payInfo
  const accepted = q.status === 'accepted' || q.status === 'converted'
  const chosen = q.chosenOption !== undefined ? q.options?.[q.chosenOption] : undefined
  const valid = q.validUntil ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${q.validUntil}T12:00:00Z`)) : ''

  const body = `<header>${logo}<div><h1>${esc(name)}</h1><div class="muted">Cotización${q.number ? ` #${q.number}` : ''}${q.customer ? ` para ${esc(q.customer)}` : ''}</div></div></header>
${justAccepted || (accepted && q.acceptedOnline) ? `<p class="ok">✓ ¡Gracias! Recibimos tu aceptación${chosen ? ` (opción ${esc(chosen.name)})` : ''}. Te contactamos para el anticipo y la fecha.</p>` : ''}
<section class="card"><h2>${esc(q.title || 'Tu cotización')}</h2>
${q.items.map((i) => `<div class="row"><span>${i.quantity} × ${esc(i.name)}</span><span>${money(Math.round(i.quantity * i.unitPriceCents))}</span></div>`).join('')}
${q.taxCents ? `<div class="row muted"><span>IVA ${q.taxRate}%</span><span>${money(q.taxCents)}</span></div>` : ''}
<div class="row"><strong>Total</strong><span class="total">${money(q.totalCents)}</span></div>
${q.advanceCents ? `<div class="row muted"><span>Anticipo</span><span>${money(q.advanceCents)}</span></div>` : ''}
${q.notes ? `<p class="muted">${esc(q.notes)}</p>` : ''}${valid ? `<p class="muted">Vigente hasta el ${esc(valid)}.</p>` : ''}</section>
${!accepted && q.status === 'pending' ? `<form method="post" class="card"><h2>${q.options?.length ? 'Elige tu opción' : '¿Te gusta?'}</h2>
${(q.options ?? []).map((o, i) => `<label class="opt"><input type="radio" name="o" value="${i}" ${i === 1 || (q.options!.length === 1 && i === 0) ? 'checked' : ''}><span><strong>${esc(o.name)} · ${money(o.priceCents)}</strong><br><span class="muted">${esc(o.desc)}</span></span></label>`).join('')}
<button class="btn" type="submit">Acepto la cotización</button></form>` : ''}
${p && (p.clabe || p.link) ? `<section class="card"><h2>Datos para tu pago</h2>${p.bank ? `<div class="row"><span>Banco</span><strong>${esc(p.bank)}</strong></div>` : ''}${p.clabe ? `<div class="row"><span>CLABE</span><code id="clabe">${esc(p.clabe)}</code></div><button class="btn ghost" type="button" onclick="navigator.clipboard.writeText('${esc(p.clabe)}').then(()=>this.textContent='CLABE copiada ✓')">Copiar CLABE</button>` : ''}${p.holder ? `<div class="row"><span>A nombre de</span><strong>${esc(p.holder)}</strong></div>` : ''}${p.link ? `<p><a class="btn" href="${esc(p.link)}">Pagar con tarjeta</a></p>` : ''}</section>` : ''}
${phone ? `<a class="btn wa" href="${wa(`Hola, tengo una duda sobre la cotización${q.number ? ` #${q.number}` : ''}.`)}">Preguntar por WhatsApp</a>` : ''}`
  return res.status(200).send(page(`${q.title || 'Cotización'} · ${name}`, body))
}
