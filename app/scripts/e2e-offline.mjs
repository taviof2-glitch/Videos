// Recorrido en Chromium real con la red cortada (T15 paso 7). Uso: npm run build && node scripts/e2e-offline.mjs
// El servidor de Supabase se simula en el propio navegador (page.route) con las mismas reglas de folios que el real
// (las reglas reales se prueban contra Postgres en src/sync/*.pg.test.ts). Necesita `playwright` (ya viene en el entorno).
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const PORT = 4178
const SUPABASE = 'opgiubxgxmzyjatexfzg.supabase.co'

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const stop = () => server.kill()
process.on('exit', stop)
for (let i = 0; i < 50; i++) {
  if (await fetch(`http://localhost:${PORT}/`).then((r) => r.ok, () => false)) break
  await new Promise((r) => setTimeout(r, 200))
}

// ── Servidor simulado ───────────────────────────────────────────────────────────
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const uid = '00000000-0000-4000-8000-000000000001'
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'duena@taller.mx', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const rows = new Map()
const counters = { quote: 0, order: 0 }
let rev = 0
let owner = false
let offline = false
const CHILD_PARENT = { orderItem: 'order', quoteItem: 'quote', txnItem: 'txn', purchaseItem: 'purchase' }

function push(changes) {
  const assigned = []
  for (const c of changes) {
    if (c.rows) {
      for (const r of c.rows) rows.set(`${c.tbl}:${r.id}`, { tbl: c.tbl, id: r.id, parent_id: c.parentId, data: r, deleted_at: null, rev: ++rev })
      continue
    }
    const data = { ...c.row }
    const old = rows.get(`${c.tbl}:${data.id}`)
    if ((c.tbl === 'order' || c.tbl === 'quote') && data.numberPending && !(old && !old.data.numberPending)) {
      data.number = ++counters[c.tbl]
      assigned.push({ tbl: c.tbl, id: data.id, number: data.number })
    }
    delete data.numberPending
    rows.set(`${c.tbl}:${data.id}`, { tbl: c.tbl, id: data.id, parent_id: null, data, deleted_at: data.deletedAt ?? null, rev: ++rev })
  }
  return assigned
}

async function fakeSupabase(route) {
  const req = route.request()
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': req.headers()['access-control-request-headers'] ?? '*', 'access-control-allow-methods': '*' }
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (offline) return route.abort('connectionfailed')
  const url = new URL(req.url())
  const body = req.postData() ? JSON.parse(req.postData()) : {}
  const json = (data, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) })
  if (url.pathname === '/auth/v1/token') {
    const exp = Math.floor(Date.now() / 1000) + 3600
    return json({ access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, exp, aud: 'authenticated', role: 'authenticated' })}.firma`, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresco', user })
  }
  if (url.pathname === '/auth/v1/user') return json(user)
  if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors })
  const fn = url.pathname.replace('/rest/v1/rpc/', '')
  switch (fn) {
    case 'sync_business_status': return json(owner ? 'member' : 'unclaimed')
    case 'sync_claim_business': owner = true; return json('member')
    case 'sync_my_businesses': return json([])
    case 'sync_get_catalog': return json(null)
    case 'sync_push': return json(push(body.p_changes))
    case 'sync_pull': return json([...rows.values()].filter((r) => r.rev > body.p_after).sort((a, b) => a.rev - b.rev).slice(0, body.p_limit))
    default: return json({ message: `función no simulada: ${fn}` }, 404)
  }
}

// ── Recorrido ───────────────────────────────────────────────────────────────────
let failed = 0
const check = (ok, text) => {
  console.log(`${ok ? '✓' : '✗'} ${text}`)
  if (!ok) failed++
}
const goto = (page, path) => page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')) }, path)

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' })
await context.route(`https://${SUPABASE}/**`, fakeSupabase)
const page = await context.newPage()
page.on('pageerror', (e) => { console.log('✗ error de página:', e.message); failed++ })

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.getByLabel('Nombre del negocio *').fill('Carpintería López')
  await page.getByRole('button', { name: 'Empezar' }).click()
  await page.getByText('Carpintería López').first().waitFor()

  await goto(page, '/cuenta')
  await page.getByLabel('Correo').fill('duena@taller.mx')
  await page.getByLabel('Contraseña').fill('secreta123')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByRole('button', { name: 'Subir mis datos' }).click()
  await page.getByText('Al día').first().waitFor({ timeout: 10000 })
  check(true, 'cuenta conectada y datos subidos (indicador «Al día»)')

  await goto(page, '/inventario/nuevo')
  await page.getByLabel('Nombre', { exact: false }).first().fill('Banca')
  await page.getByLabel('Cantidad disponible *').fill('5')
  await page.getByLabel('Precio de venta').fill('700')
  await page.getByRole('button', { name: /Guardar|Crear|Agregar/ }).last().click()
  await page.waitForTimeout(500)

  // ── Sin red ──
  offline = true
  await context.setOffline(true)
  await page.evaluate(() => dispatchEvent(new Event('offline')))
  await goto(page, '/pedidos/nuevo')
  await page.getByLabel('Nombre del cliente', { exact: false }).fill('Olga')
  await page.getByPlaceholder('Nombre o código de barras').fill('Banca')
  await page.locator('.picker button').first().click()
  await page.getByRole('button', { name: 'Crear pedido' }).click()
  await page.getByText(/Pedido P-[0-9A-F]{6}/).first().waitFor({ timeout: 5000 })
  check(true, 'sin red: el pedido se crea con folio provisional «P-…»')
  await goto(page, '/pedidos')
  await page.getByText('Olga').first().waitFor()
  const list = await page.locator('body').innerText()
  console.log('  lista:', JSON.stringify(list.replace(/\s+/g, ' ').slice(0, 200)))
  check(/P-[0-9A-F]{6}/.test(list), 'sin red: la lista muestra el folio provisional')
  await page.waitForTimeout(2500)
  check((await page.getByText(/Sin conexión/).count()) > 0, 'sin red: el indicador dice «Sin conexión»')
  check(rows.size > 0 && ![...rows.values()].some((r) => r.tbl === 'order'), 'sin red: el pedido no llegó al servidor')

  // ── Vuelve la red ──
  offline = false
  await context.setOffline(false)
  await page.evaluate(() => dispatchEvent(new Event('online')))
  await page.getByText('#1', { exact: false }).first().waitFor({ timeout: 10000 })
  const after = await page.locator('body').first().innerText()
  check(!/P-[0-9A-F]{6}/.test(after), 'con red: el folio provisional se reemplaza por el número real')
  check(/#1\b/.test(after), 'con red: el servidor asignó el número 1')
  check([...rows.values()].some((r) => r.tbl === 'order' && r.data.number === 1 && r.data.customerName === 'Olga'), 'con red: el pedido llegó al servidor con su número')
  check(await page.getByText('Al día').first().waitFor({ timeout: 10000 }).then(() => true, () => false), 'con red: el indicador vuelve a «Al día»')
} catch (e) {
  console.log('✗ el recorrido se detuvo:', e.message.split('\n')[0])
  await page.screenshot({ path: process.env.E2E_SHOT ?? 'e2e-fallo.png' })
  failed++
}
await browser.close()
stop()
console.log(failed ? `\n${failed} fallo(s)` : '\nTodo bien')
process.exit(failed ? 1 : 0)
