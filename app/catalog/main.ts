import { cartKey, cartTotal, orderLink, orderMessage, priceCart, type CartLine } from '../src/data/catalogOrder'
import { parseCatalog, type CatalogData, type CatalogProduct } from '../src/data/catalogFormat'
import { loadLiveCatalog, loadLivePhoto, orderErrorMessage, placeLiveOrder, slugFromSearch } from '../src/data/catalogLive'
import { formatMoney } from '../src/data/money'
import { matchesText } from './search'
import './catalog.css'

/** Catálogo público. Los datos van dentro de la página (`#catalog-data`); el dueño los cambia cargando un archivo y publicando. */

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const $ = (sel: string) => document.querySelector(sel) as HTMLElement | null

// ── Datos incrustados ─────────────────────────────────────────────────────────
function embedded(): CatalogData | null {
  const raw = document.getElementById('catalog-data')?.textContent?.trim()
  if (!raw || raw === 'null') return null
  const r = parseCatalog(raw)
  return r.ok ? r.data : null
}

// Sin datos incrustados y con `?c=nombre` en el enlace, el catálogo se lee en vivo del servidor.
let data = embedded()
const liveSlug = data ? undefined : slugFromSearch(location.search)
const state = {
  category: '', query: '', cartOpen: false, customer: '', notes: '', cart: new Map<string, CartLine>(), variant: new Map<string, string>(),
  live: liveSlug ? ('loading' as 'loading' | 'ready' | 'missing' | 'error') : undefined,
  sending: false, sendError: '', sent: undefined as { number: number; totalCents: number } | undefined,
}
const money = (c: number) => formatMoney(c, data?.business.currency ?? 'MXN')

// ── Carrito (se recuerda en este navegador) ───────────────────────────────────
const STORE = 'catalogo-carrito'
// En vivo el catálogo cambia solo, así que el carrito se recuerda por nombre de página y no por versión.
const storeKey = () => (liveSlug ? `${STORE}:live:${liveSlug}` : `${STORE}:${data?.business.name}:${data?.generatedAt}`)
function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey()) ?? '[]') as CartLine[]
    for (const l of saved) if (l && typeof l.productId === 'string' && l.quantity > 0) state.cart.set(cartKey(l.productId, l.variantId), l)
  } catch { /* sin almacenamiento: el carrito vive solo mientras la página está abierta */ }
}
function saveCart() {
  try { localStorage.setItem(storeKey(), JSON.stringify([...state.cart.values()])) } catch { /* igual */ }
}

// ── Pantalla ──────────────────────────────────────────────────────────────────
function priceOf(p: CatalogProduct): string {
  if (!p.variants?.length) return money(p.priceCents)
  const prices = p.variants.map((v) => v.priceCents)
  const min = Math.min(...prices)
  return min === Math.max(...prices) ? money(min) : `<small>Desde</small> ${money(min)}`
}

function card(p: CatalogProduct): string {
  const chosen = state.variant.get(p.id) ?? p.variants?.find((v) => !v.soldOut)?.id ?? p.variants?.[0]?.id
  const v = p.variants?.find((x) => x.id === chosen)
  const out = p.soldOut || (!!p.variants?.length && !!v?.soldOut)
  const img = p.photo ? `<img class="photo" src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="noimg" aria-hidden="true">${esc(p.name.slice(0, 1).toUpperCase())}</div>`
  const variants = p.variants?.length
    ? `<label>Opción<select data-variant="${esc(p.id)}" aria-label="Opción de ${esc(p.name)}">${p.variants.map((x) => `<option value="${esc(x.id)}"${x.id === chosen ? ' selected' : ''}>${esc(x.name)}${x.soldOut ? ' (agotado)' : ` · ${money(x.priceCents)}`}</option>`).join('')}</select></label>`
    : ''
  return `<li class="item">${img}<div class="body">
    <div class="name">${esc(p.name)}</div>
    ${p.description ? `<div class="desc">${esc(p.description)}</div>` : ''}
    <div class="price">${v ? money(v.priceCents) : priceOf(p)}</div>
    ${out ? '<span class="out">Agotado</span>' : ''}
    ${variants}
    <button class="btn" type="button" data-add="${esc(p.id)}" ${out ? 'disabled' : ''}>${out ? 'No disponible' : 'Agregar'}</button>
  </div></li>`
}

function cartSheet(d: CatalogData): string {
  const lines = priceCart(d, [...state.cart.values()])
  const total = cartTotal(lines)
  const msg = orderMessage(d, [...state.cart.values()], state.customer, state.notes)
  const link = lines.length ? orderLink(d, msg.text) : undefined
  return `<div class="sheet-bg" data-close-sheet><div class="sheet" role="dialog" aria-modal="true" aria-label="Tu pedido">
    <div class="row"><h2>Tu pedido</h2><button class="x" type="button" data-close aria-label="Cerrar">×</button></div>
    ${lines.length === 0 ? '<p class="muted">Aún no agregas nada.</p>' : `<ul class="lines">${lines.map((l) => `<li>
      <div class="row"><span class="name">${esc(l.name)}</span><strong>${money(l.totalCents)}</strong></div>
      <div class="row"><span class="qty"><button type="button" data-dec="${esc(cartKey(l.product.id, l.variant?.id))}" aria-label="Quitar uno de ${esc(l.name)}">−</button><span aria-live="polite">${l.quantity}</span><button type="button" data-inc="${esc(cartKey(l.product.id, l.variant?.id))}" aria-label="Agregar uno de ${esc(l.name)}">+</button></span><span class="muted">${money(l.unitPriceCents)} c/u</span></div>
    </li>`).join('')}</ul>`}
    <div class="row"><span>Total</span><span class="total">${money(total)}</span></div>
    <label>Tu nombre<input id="customer" value="${esc(state.customer)}" autocomplete="name" placeholder="Para que te identifiquen"></label>
    <label>Notas (opcional)<textarea id="notes" rows="2" placeholder="Ej. Entregar el sábado en la tarde">${esc(state.notes)}</textarea></label>
    ${state.sent ? `<p class="msg-ok" role="status"><strong>¡Pedido ${esc(`#${state.sent.number}`)} enviado!</strong> Total ${money(state.sent.totalCents)}. El negocio lo recibió y te confirmará el pago y la entrega.</p><button class="btn" type="button" data-close>Listo</button>`
    : liveSlug ? `<button class="btn" type="button" data-send ${lines.length && state.customer.trim() && !state.sending ? '' : 'disabled'}>${state.sending ? 'Enviando…' : 'Enviar pedido'}</button>${!state.customer.trim() && lines.length ? '<p class="muted">Escribe tu nombre para poder enviar el pedido.</p>' : ''}${state.sendError ? `<p class="msg-err" role="alert">${esc(state.sendError)}</p>` : ''}${link ? `<a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener noreferrer">O pedir por WhatsApp</a>` : ''}`
    : link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Pedir por WhatsApp</a><p class="muted">Se abre WhatsApp con tu pedido listo. Tú lo envías al negocio y ellos te confirman el pago y la entrega.</p>`
      : `<button class="btn" type="button" disabled>Pedir por WhatsApp</button>${lines.length && !d.business.phone.replace(/\D/g, '') ? '<p class="muted">Este negocio aún no tiene un WhatsApp para recibir pedidos.</p>' : ''}`}
  </div></div>`
}

function render() {
  const app = $('#app')!
  if (!data && state.live) {
    const text = { loading: 'Cargando el catálogo…', missing: 'Este catálogo no existe o está apagado. Pide al negocio su enlace actualizado.', error: 'No se pudo cargar el catálogo. Revisa tu internet y recarga la página.', ready: '' }[state.live]
    app.innerHTML = `<div class="wrap"><div class="empty"><h1>${state.live === 'loading' ? 'Un momento' : 'Catálogo no disponible'}</h1><p class="muted" role="status">${esc(text)}</p></div></div>`
    return
  }
  if (!data) {
    app.innerHTML = `<div class="wrap"><div class="empty"><h1>Catálogo en preparación</h1><p class="muted">Este catálogo todavía no tiene productos. Vuelve en un rato.</p></div>${adminHtml()}</div>`
    void setupAdmin()
    return
  }
  const d = data
  const q = state.query
  const shown = d.products.filter((p) => (!state.category || p.category === state.category) && (!q.trim() || matchesText(`${p.name} ${p.description} ${p.category} ${p.variants?.map((v) => v.name).join(' ') ?? ''}`, q)))
  const count = [...state.cart.values()].reduce((n, l) => n + l.quantity, 0)
  const total = cartTotal(priceCart(d, [...state.cart.values()]))
  const info = [d.business.openingHours && `🕒 ${esc(d.business.openingHours)}`, d.business.address && `📍 ${esc(d.business.address)}`].filter(Boolean)
  app.innerHTML = `<div class="wrap">
    <header class="head"><h1>${esc(d.business.name)}</h1>
      ${d.business.note ? `<p class="note">${esc(d.business.note)}</p>` : ''}
      ${info.length ? `<div class="info">${info.map((i) => `<span>${i}</span>`).join('')}</div>` : ''}
    </header>
    <input id="q" type="search" placeholder="Buscar en el catálogo" value="${esc(q)}" aria-label="Buscar en el catálogo">
    ${d.categories.length ? `<div class="chips" role="group" aria-label="Categorías"><button type="button" class="chip" data-cat="" aria-pressed="${state.category === ''}">Todo</button>${d.categories.map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${state.category === c}">${esc(c)}</button>`).join('')}</div>` : ''}
    ${shown.length ? `<ul class="grid" style="list-style:none;margin:0;padding:0">${shown.map(card).join('')}</ul>` : '<div class="empty"><p>Ningún producto coincide con tu búsqueda.</p></div>'}
    <p class="muted">Precios al ${new Date(d.generatedAt).toLocaleDateString('es-MX', { dateStyle: 'long' })}. Pueden cambiar; el negocio confirma tu pedido.</p>
    ${adminHtml()}
  </div>
  ${count > 0 ? `<div class="bar"><button class="btn" type="button" data-open><span>Ver mi pedido (${count})</span><span>${money(total)}</span></button></div>` : ''}
  ${state.cartOpen ? cartSheet(d) : ''}`
  void setupAdmin()
}

// ── Interacción ───────────────────────────────────────────────────────────────
function refocus(id: string, pos?: number) {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null
  if (!el) return
  el.focus()
  if (pos !== undefined) el.setSelectionRange(pos, pos)
}

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-add],[data-open],[data-close],[data-close-sheet],[data-inc],[data-dec],[data-cat],[data-send]')
  if (!t || !data) return
  if (t.hasAttribute('data-close-sheet') && e.target !== t) return // un clic dentro de la hoja no la cierra
  if (t.hasAttribute('data-send')) {
    void sendOrder()
    return
  }
  if (t.dataset.add !== undefined) {
    const p = data.products.find((x) => x.id === t.dataset.add)
    if (!p) return
    const variantId = p.variants?.length ? (state.variant.get(p.id) ?? p.variants.find((v) => !v.soldOut)?.id ?? p.variants[0].id) : undefined
    const k = cartKey(p.id, variantId)
    const cur = state.cart.get(k)
    state.cart.set(k, { productId: p.id, variantId, quantity: (cur?.quantity ?? 0) + 1 })
  } else if (t.dataset.inc !== undefined || t.dataset.dec !== undefined) {
    const k = (t.dataset.inc ?? t.dataset.dec)!
    const cur = state.cart.get(k)
    if (cur) {
      const q = cur.quantity + (t.dataset.inc !== undefined ? 1 : -1)
      if (q <= 0) state.cart.delete(k)
      else state.cart.set(k, { ...cur, quantity: q })
    }
  } else if (t.dataset.cat !== undefined) state.category = t.dataset.cat
  else if (t.hasAttribute('data-open')) state.cartOpen = true
  else if (t.hasAttribute('data-close') || t.hasAttribute('data-close-sheet')) {
    state.cartOpen = false
    state.sent = undefined
  }
  if (state.sent && t.dataset.open !== undefined) state.sent = undefined
  saveCart()
  render()
})

document.addEventListener('change', (e) => {
  const el = e.target as HTMLElement
  if (el instanceof HTMLSelectElement && el.dataset.variant) {
    state.variant.set(el.dataset.variant, el.value)
    render()
  }
})

document.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement
  if (el.id === 'q') {
    state.query = el.value
    const pos = el.selectionStart ?? el.value.length
    render()
    refocus('q', pos)
  } else if (el.id === 'customer' || el.id === 'notes') {
    // el nombre y las notas se guardan al escribir, sin volver a dibujar (no se pierde el foco) salvo el enlace de WhatsApp
    if (el.id === 'customer') state.customer = el.value
    else state.notes = el.value
    const send = document.querySelector<HTMLButtonElement>('[data-send]')
    if (send) send.disabled = state.sending || !state.customer.trim() || state.cart.size === 0
    const link = document.querySelector<HTMLAnchorElement>('.sheet a.btn')
    if (link && data) {
      const next = orderLink(data, orderMessage(data, [...state.cart.values()], state.customer, state.notes).text)
      if (next) link.href = next
    }
  }
})

// ── Catálogo en vivo ──────────────────────────────────────────────────────────
async function sendOrder() {
  if (!liveSlug || !data || state.sending) return
  const cart = [...state.cart.values()].filter((l) => priceCart(data!, [l]).length > 0)
  if (!cart.length || !state.customer.trim()) return
  state.sending = true
  state.sendError = ''
  render()
  try {
    state.sent = await placeLiveOrder(liveSlug, state.customer, state.notes, cart)
    state.cart.clear()
    state.notes = ''
    saveCart()
  } catch (err) {
    state.sendError = orderErrorMessage(err)
  }
  state.sending = false
  render()
  refocus('customer')
}

async function loadLive(slug: string) {
  try {
    const d = await loadLiveCatalog(slug)
    if (!d) {
      state.live = 'missing'
      return render()
    }
    data = d
    state.live = 'ready'
    loadCart()
    render()
    let queued = false
    const later = () => {
      if (queued) return
      queued = true
      const tick = () => {
        // No se redibuja mientras el cliente escribe: se pierde el foco.
        if (document.activeElement?.matches('input,textarea,select')) return setTimeout(tick, 400)
        queued = false
        render()
      }
      setTimeout(tick, 150)
    }
    // Las fotos llegan aparte, de 4 en 4, y se van mostrando conforme llegan.
    const todo = d.products.filter((p) => p.photoPath)
    const worker = async () => {
      for (let p = todo.shift(); p; p = todo.shift()) {
        const url = await loadLivePhoto(p.photoPath!)
        if (url) { p.photo = url; later() }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
  } catch {
    state.live = 'error'
    render()
  }
}

// ── Administrar (solo para quien puede publicar la página) ─────────────────────
const RESET =
  ':root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}'

/** El documento completo de la página con otros datos, con la misma forma que la plataforma publica. */
export function renderDocument(next: CatalogData): string {
  const style = document.getElementById('catalog-style')?.textContent ?? ''
  const script = document.getElementById('catalog-script')?.textContent ?? ''
  const json = JSON.stringify(next).replace(/</g, '\\u003c')
  const title = `Catálogo ${next.business.name}`.slice(0, 60)
  return `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${RESET}</style></head><body><title>${esc(title)}</title><style id="catalog-style">${style}</style><div id="app"></div><script type="application/json" id="catalog-data">${json}</script><script type="module" id="catalog-script">${script}</script></body></html>`
}

type Claude = { use(name: string): Promise<unknown> }
let pending: CatalogData | undefined

function adminHtml(): string {
  return `<details class="admin" id="admin" hidden><summary>Administrar este catálogo</summary><div>
    <p class="muted">Descarga el catálogo desde Conta (Catálogo → Descargar catálogo), elige el archivo aquí y publícalo.</p>
    <input id="file" type="file" accept="application/json,.json" aria-label="Archivo del catálogo">
    <p id="admin-msg" class="muted" role="status"></p>
    <button class="btn" type="button" id="publish" disabled>Publicar catálogo</button>
  </div></details>`
}

async function setupAdmin() {
  const host = (window as unknown as { claude?: Claude }).claude
  const panel = document.getElementById('admin') as HTMLDetailsElement | null
  if (!host?.use || !panel) return
  try {
    const [user, artifact] = (await Promise.all([host.use('user'), host.use('artifact')])) as [{ canEdit(): Promise<boolean> } | null, { publish(html: string): Promise<unknown> } | null]
    if (!user || !artifact || !(await user.canEdit())) return
    panel.hidden = false
    if (!data) panel.open = true
    const msg = document.getElementById('admin-msg')!
    const btn = document.getElementById('publish') as HTMLButtonElement
    const file = document.getElementById('file') as HTMLInputElement
    const say = (text: string, ok = false) => { msg.textContent = text; msg.className = ok ? 'msg-ok' : 'msg-err' }
    file.onchange = async () => {
      pending = undefined
      btn.disabled = true
      const f = file.files?.[0]
      if (!f) return
      const r = parseCatalog(await f.text())
      if (!r.ok) return say(r.error)
      pending = r.data
      btn.disabled = false
      say(`Listo para publicar: ${r.data.products.length} productos de ${r.data.business.name} (generado el ${new Date(r.data.generatedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })})`, true)
    }
    btn.onclick = async () => {
      if (!pending) return
      btn.disabled = true
      say('Publicando…', true)
      try {
        await artifact.publish(renderDocument(pending)) // la página se vuelve a cargar con el catálogo nuevo
      } catch (err) {
        const code = (err as { code?: string })?.code
        say(code === 'conflict' ? 'Alguien más publicó antes. Recarga la página e inténtalo de nuevo.' : code === 'not_granted' || code === 'not_writer' ? 'No tienes permiso para publicar esta página.' : 'No se pudo publicar. Inténtalo de nuevo.')
        btn.disabled = false
      }
    }
  } catch { /* sin permisos de publicación: el panel queda oculto */ }
}

loadCart()
render()
if (liveSlug) void loadLive(liveSlug)
