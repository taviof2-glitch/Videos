// Página pública de seguimiento de una obra (/s/<código>): el cliente ve en qué etapa va su mueble,
// la fecha de entrega, fotos del avance y cuánto le falta pagar. Solo existe si el negocio compartió el enlace.
import { SUPABASE_KEY, SUPABASE_URL } from './_auth.js'

type Req = { query?: Record<string, string | string[] | undefined>; url?: string }
type Res = { status: (n: number) => Res; setHeader: (k: string, v: string) => void; send: (b: string) => void }
type Status = {
  business: { name?: string; phone?: string; country?: string; logo?: string; currency: string }
  customer?: string
  title: string
  stage: string
  deliveryDate?: string
  deliveredAt?: string
  photos: string[]
  totalCents: number
  paidCents: number
}

const STAGES = ['anticipo', 'material', 'corte', 'armado', 'listo', 'instalado', 'liquidado']
const LABEL: Record<string, string> = { anticipo: 'Pedido recibido', material: 'Material comprado', corte: 'En corte', armado: 'En armado', listo: 'Listo para entregar', instalado: 'Entregado', liquidado: 'Terminado' }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const day = (k: string) => new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${k}T12:00:00Z`))

function page(title: string, body: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title><style>
:root{--bg:#f4f5f3;--card:#fff;--ink:#141414;--muted:#6b6f6a;--brand:#2f4d40;--gold:#c9a24a;--line:#e3e5e1}
@media (prefers-color-scheme:dark){:root{--bg:#121412;--card:#1c1f1c;--ink:#f1f2ef;--muted:#a3a8a1;--line:#2c302c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:520px;margin:0 auto;padding:16px;display:grid;gap:14px}.card{background:var(--card);border-radius:18px;padding:18px;border:1px solid var(--line)}
header{display:flex;align-items:center;gap:12px}header img{width:56px;height:56px;border-radius:12px;object-fit:cover}h1{font-size:1.35rem;margin:0}h2{font-size:1.05rem;margin:0 0 10px}
.muted{color:var(--muted)}.steps{list-style:none;margin:0;padding:0;display:grid;gap:8px}.steps li{display:flex;gap:10px;align-items:center}
.dot{width:22px;height:22px;border-radius:50%;border:2px solid var(--line);flex:none;display:grid;place-items:center;font-size:12px}
.done .dot{background:var(--brand);border-color:var(--brand);color:#fff}.now{font-weight:700}.now .dot{border-color:var(--gold);box-shadow:0 0 0 4px rgb(201 162 74 / .25)}
.big{font-size:1.6rem;font-weight:800;margin:4px 0}.photos{display:grid;grid-template-columns:1fr 1fr;gap:8px}.photos img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}
.row{display:flex;justify-content:space-between;gap:8px}.btn{display:block;text-align:center;background:#1f8f4e;color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:14px}
</style></head><body><main>${body}</main></body></html>`
}

export default async function handler(req: Req, res: Res) {
  const raw = req.query?.t
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? ''
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  const notFound = () => res.status(404).send(page('Seguimiento', '<section class="card"><h1>Enlace no válido</h1><p class="muted">Este enlace de seguimiento ya no existe. Pide uno nuevo a quien te lo mandó.</p></section>'))
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return notFound()

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_job_status`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: token }),
  }).catch(() => null)
  const s = r && r.ok ? ((await r.json()) as Status | null) : null
  if (!s) return notFound()

  const money = (c: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: s.business.currency || 'MXN' }).format(c / 100)
  const at = Math.max(0, STAGES.indexOf(s.stage))
  const left = Math.max(0, s.totalCents - s.paidCents)
  const name = s.business.name || 'Tu carpintería'
  const logo = s.business.logo && /^data:image\/(png|jpeg|webp);base64,/.test(s.business.logo) ? `<img src="${s.business.logo}" alt="">` : ''
  const phone = (s.business.phone ?? '').replace(/\D/g, '')
  const wa = phone ? `https://wa.me/${phone.length === 10 && (s.business.country ?? 'MX') === 'MX' ? `52${phone}` : phone}?text=${encodeURIComponent(`Hola, pregunto por mi pedido: ${s.title}`)}` : ''
  const photos = (s.photos ?? []).filter((p) => /^data:image\/jpeg;base64,/.test(p)).slice(0, 4)

  const body = `
<header>${logo}<div><h1>${esc(name)}</h1><div class="muted">Seguimiento de tu pedido</div></div></header>
<section class="card"><div class="muted">${s.customer ? `Hola ${esc(s.customer)}, así va` : 'Así va'}:</div><div class="big">${esc(s.title)}</div>
<div>Ahora: <strong>${esc(LABEL[s.stage] ?? s.stage)}</strong></div>
${s.deliveredAt ? `<div class="muted">Entregado el ${esc(day(s.deliveredAt))}.</div>` : s.deliveryDate ? `<div class="muted">Entrega estimada: <strong>${esc(day(s.deliveryDate))}</strong></div>` : ''}</section>
<section class="card"><h2>Avance</h2><ol class="steps">${STAGES.slice(0, 6).map((k, i) => `<li class="${i < at || s.stage === 'liquidado' ? 'done' : i === at ? 'now' : ''}"><span class="dot">${i < at || s.stage === 'liquidado' ? '✓' : ''}</span>${esc(LABEL[k])}</li>`).join('')}</ol></section>
${photos.length ? `<section class="card"><h2>Fotos del avance</h2><div class="photos">${photos.map((p) => `<img src="${p}" alt="Foto del avance" loading="lazy">`).join('')}</div></section>` : ''}
${s.totalCents > 0 ? `<section class="card"><h2>Pagos</h2><div class="row"><span>Total</span><strong>${money(s.totalCents)}</strong></div><div class="row"><span>Pagado</span><span>${money(s.paidCents)}</span></div><div class="row"><span>${left > 0 ? 'Falta' : 'Saldo'}</span><strong>${left > 0 ? money(left) : 'Liquidado ✓'}</strong></div></section>` : ''}
${wa ? `<a class="btn" href="${wa}">Escribir por WhatsApp</a>` : ''}
<p class="muted" style="text-align:center;font-size:.85rem">Esta página se actualiza sola cuando avanzamos tu pedido.</p>`
  return res.status(200).send(page(`${s.title} · ${name}`, body))
}
