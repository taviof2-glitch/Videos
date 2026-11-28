// Cotizador en línea para clientes (/cotiza/<código>): eligen el mueble y sus metros, ven un precio aproximado y
// dejan su nombre y teléfono. Llega al negocio como pedido «cotizador en línea» con aviso al teléfono.
import webpush from 'web-push'
import { estimateRange, LEAD_TYPES } from '../src/data/leadTypes.js'
import { SUPABASE_KEY, SUPABASE_URL } from './_auth.js'

type Req = { method?: string; query?: Record<string, string | string[] | undefined>; body?: unknown }
type Res = { status: (n: number) => Res; setHeader: (k: string, v: string) => void; send: (b: string) => void }
type Est = { name?: string; phone?: string; logo?: string; currency: string; prices?: Record<string, number>; galleryToken?: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
const rpc = (fn: string, body: unknown) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) }).catch(() => null)

function page(title: string, body: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
:root{--bg:#f4f5f3;--card:#fff;--ink:#141414;--muted:#6b6f6a;--brand:#2f4d40;--line:#e3e5e1}
@media (prefers-color-scheme:dark){:root{--bg:#121412;--card:#1c1f1c;--ink:#f1f2ef;--muted:#a3a8a1;--line:#2c302c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:520px;margin:0 auto;padding:16px;display:grid;gap:14px}.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;display:grid;gap:10px}
header{display:flex;gap:12px;align-items:center}header img{width:56px;height:56px;border-radius:12px;object-fit:cover}h1{margin:0;font-size:1.3rem}h2{margin:0;font-size:1.05rem}
label{display:grid;gap:4px;font-weight:600;font-size:.95rem}input,select,textarea{font:inherit;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
.muted{color:var(--muted);font-weight:400}.big{font-size:1.6rem;font-weight:800}.btn{display:block;text-align:center;border:0;background:var(--brand);color:#fff;font:inherit;font-weight:700;padding:15px;border-radius:14px;cursor:pointer;text-decoration:none}
.ok{background:#e9f5ee;color:#1f6b41;border-radius:14px;padding:14px;font-weight:600}.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
</style></head><body><main>${body}</main></body></html>`
}

async function notifyOwner(business: string, text: string) {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY, key = process.env.DIGEST_KEY
  if (!pub || !priv || !key) return
  const r = await rpc('push_subs_for_business', { p_key: key, p_business: business })
  if (!r || !r.ok) return
  const subs = (await r.json()) as { endpoint: string; p256dh: string; auth: string }[]
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:avisos@houselite.app', pub, priv)
  const payload = JSON.stringify({ title: '📩 Nueva solicitud de cotización', body: text, url: '/pedidos' })
  await Promise.all(subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86_400 }).catch(() => undefined)))
}

export default async function handler(req: Req, res: Res) {
  const token = one(req.query?.t)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  const notFound = () => res.status(404).send(page('Cotizador', '<section class="card"><h1>Página no disponible</h1></section>'))
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return notFound()
  const r = await rpc('public_estimator', { p_token: token })
  const b = r && r.ok ? ((await r.json()) as Est | null) : null
  if (!b) return notFound()
  const prices = Object.fromEntries(LEAD_TYPES.map(([k, , def]) => [k, b.prices?.[k] ?? def]))
  const money = (c: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: b.currency || 'MXN', maximumFractionDigits: 0 }).format(c / 100)
  const name = b.name || 'Muebles a la medida'
  const logo = b.logo && /^data:image\/(png|jpeg|webp);base64,/.test(b.logo) ? `<img src="${b.logo}" alt="">` : ''
  const head = `<header>${logo}<div><h1>${esc(name)}</h1><div class="muted">Cotiza tu mueble a la medida</div></div></header>`

  if (req.method === 'POST') {
    const f = (typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : (req.body as Record<string, string>)) ?? {}
    const type = LEAD_TYPES.find(([k]) => k === f.tipo) ?? LEAD_TYPES[0]
    const meters = Math.min(20, Math.max(0.3, parseFloat(String(f.metros).replace(',', '.')) || 1))
    const [lo, hi] = estimateRange(prices[type[0]], meters)
    const what = `${type[1].replace(/ \(.*\)/, '')} de ${meters} m${f.alto ? ` × ${String(f.alto).slice(0, 6)} m de alto` : ''} (estimado ${money(lo)}–${money(hi)})`
    const out = await rpc('public_lead', { p_token: token, p_name: String(f.nombre ?? ''), p_phone: String(f.telefono ?? ''), p_what: what, p_notes: String(f.notas ?? '').slice(0, 300), p_estimate: Math.round((lo + hi) / 2) })
    if (!out || !out.ok) return res.status(400).send(page('Cotizador', `${head}<section class="card"><h2>No se pudo enviar</h2><p class="muted">Revisa tu nombre y un teléfono de 10 números, o intenta en unos minutos.</p><a class="btn" href="">Volver</a></section>`))
    const ok = (await out.json()) as { business?: string }
    if (ok.business) await notifyOwner(ok.business, `${String(f.nombre).slice(0, 40)} · ${what}`).catch(() => undefined)
    return res.status(200).send(page('¡Listo!', `${head}<p class="ok">✓ ¡Gracias, ${esc(String(f.nombre).split(' ')[0])}! Recibimos tu solicitud. Te escribimos por WhatsApp con tu cotización formal.</p>${b.galleryToken ? `<a class="btn" href="/g/${esc(b.galleryToken)}">Ver nuestros trabajos</a>` : ''}`))
  }

  const opts = LEAD_TYPES.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')
  const body = `${head}
<form method="post" class="card" id="f">
  <label>¿Qué mueble necesitas?<select name="tipo" id="tipo">${opts}</select></label>
  <div class="two"><label>Ancho (metros)<input name="metros" id="metros" inputmode="decimal" value="2" required></label><label>Alto (metros) <span class="muted">opcional</span><input name="alto" inputmode="decimal"></label></div>
  <div><div class="muted">Precio aproximado</div><div class="big" id="precio">—</div><div class="muted" style="font-size:.85rem">El precio final depende de materiales, herrajes e instalación. Te mandamos la cotización formal sin compromiso.</div></div>
  <label>Detalles <span class="muted">(color, puertas, cajones…)</span><textarea name="notas" rows="2"></textarea></label>
  <label>Tu nombre<input name="nombre" required minlength="2"></label>
  <label>WhatsApp<input name="telefono" inputmode="tel" required placeholder="10 números"></label>
  <button class="btn" type="submit">Quiero mi cotización</button>
</form>
${b.galleryToken ? `<a class="btn" style="background:transparent;color:inherit;border:1px solid var(--line)" href="/g/${esc(b.galleryToken)}">Ver trabajos que hemos hecho</a>` : ''}
<script>
const P=${JSON.stringify(prices)};const fmt=c=>new Intl.NumberFormat('es-MX',{style:'currency',currency:${JSON.stringify(b.currency || 'MXN')},maximumFractionDigits:0}).format(c/100);
const r=c=>Math.round(c/10000)*10000;function up(){const m=Math.max(.3,parseFloat((document.getElementById('metros').value||'1').replace(',','.'))||1);const mid=P[document.getElementById('tipo').value]*m;document.getElementById('precio').textContent=fmt(r(mid*.85))+' – '+fmt(r(mid*1.15))}
document.getElementById('f').addEventListener('input',up);up();
</script>`
  return res.status(200).send(page(`Cotiza · ${name}`, body))
}
