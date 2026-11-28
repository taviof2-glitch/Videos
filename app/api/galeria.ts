// Galería pública de trabajos terminados (/g/<código>?c=<tipo>): fotos de las obras que el negocio marcó para mostrar.
import { CATEGORIES, categoryOf } from '../src/data/galleryCats.js'
import { SUPABASE_KEY, SUPABASE_URL } from './_auth.js'

type Req = { query?: Record<string, string | string[] | undefined> }
type Res = { status: (n: number) => Res; setHeader: (k: string, v: string) => void; send: (b: string) => void }
type Data = { business: { name?: string; phone?: string; country?: string; logo?: string }; items: { title: string; photos: string[]; before?: string; date?: string }[] }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

function page(title: string, body: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>
:root{--bg:#f4f5f3;--card:#fff;--ink:#141414;--muted:#6b6f6a;--brand:#2f4d40;--line:#e3e5e1}
@media (prefers-color-scheme:dark){:root{--bg:#121412;--card:#1c1f1c;--ink:#f1f2ef;--muted:#a3a8a1;--line:#2c302c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:16px;display:grid;gap:14px}header{display:flex;gap:12px;align-items:center}header img{width:56px;height:56px;border-radius:12px;object-fit:cover}h1{margin:0;font-size:1.35rem}
.chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}.chip{flex:none;padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink);text-decoration:none;font-weight:600;font-size:.9rem}.chip.on{background:var(--brand);color:#fff;border-color:var(--brand)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.item{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden}.item img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:2px}.ba figure{margin:0;position:relative}.ba img{aspect-ratio:1;width:100%;object-fit:cover;display:block}.ba figcaption{position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.6);color:#fff;font-size:.75rem;padding:2px 8px;border-radius:99px}
.item .more{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}.item .more img{aspect-ratio:1}.item p{margin:0;padding:10px 12px;font-weight:600}.muted{color:var(--muted)}
.btn{display:block;text-align:center;background:#1f8f4e;color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:14px}
</style></head><body><main>${body}</main></body></html>`
}

export default async function handler(req: Req, res: Res) {
  const token = one(req.query?.t)
  const cat = one(req.query?.c)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300')
  const notFound = () => res.status(404).send(page('Galería', '<p>Esta galería no existe.</p>'))
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return notFound()
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_gallery`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: token }) }).catch(() => null)
  const d = r && r.ok ? ((await r.json()) as Data | null) : null
  if (!d) return notFound()
  const name = d.business.name || 'Nuestros trabajos'
  const items = d.items.map((i) => ({ ...i, category: categoryOf(i.title), photos: (i.photos ?? []).filter((p) => /^data:image\/jpeg;base64,/.test(p)), before: i.before && /^data:image\/jpeg;base64,/.test(i.before) ? i.before : undefined })).filter((i) => i.photos.length)
  const present = CATEGORIES.filter(([k]) => items.some((i) => i.category === k))
  const shown = cat ? items.filter((i) => i.category === cat) : items
  const logo = d.business.logo && /^data:image\/(png|jpeg|webp);base64,/.test(d.business.logo) ? `<img src="${d.business.logo}" alt="">` : ''
  const phone = (d.business.phone ?? '').replace(/\D/g, '')
  const wa = phone ? `https://wa.me/${phone.length === 10 ? `52${phone}` : phone}?text=${encodeURIComponent('Hola, vi sus trabajos y quiero cotizar un mueble.')}` : ''
  const body = `<header>${logo}<div><h1>${esc(name)}</h1><div class="muted">Trabajos terminados · muebles a la medida</div></div></header>
${present.length > 1 ? `<nav class="chips"><a class="chip ${cat ? '' : 'on'}" href="?">Todos</a>${present.map(([k, l]) => `<a class="chip ${cat === k ? 'on' : ''}" href="?c=${k}">${esc(l)}</a>`).join('')}</nav>` : ''}
${shown.length ? `<section class="grid">${shown.map((i) => `<article class="item">${i.before ? `<div class="ba"><figure><img src="${i.before}" alt="Antes" loading="lazy"><figcaption>Antes</figcaption></figure><figure><img src="${i.photos[i.photos.length - 1]}" alt="Después" loading="lazy"><figcaption>Después</figcaption></figure></div>` : ''}<img src="${i.photos[0]}" alt="${esc(i.title)}" loading="lazy">${i.photos.length > 1 ? `<div class="more">${i.photos.slice(1, 4).map((p) => `<img src="${p}" alt="" loading="lazy">`).join('')}</div>` : ''}<p>${esc(i.title)}</p></article>`).join('')}</section>` : '<p class="muted">Pronto subiremos trabajos de este tipo.</p>'}
${wa ? `<a class="btn" href="${wa}">Cotizar por WhatsApp</a>` : ''}`
  return res.status(200).send(page(`${name} · trabajos`, body))
}
