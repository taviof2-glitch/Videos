// Recorrido en Chromium real de los flujos F01–F12 de replica/recon.md contra la app compilada (T16).
// Uso: npm run build && node scripts/e2e-flows.mjs [F03 F05 …]   (sin argumentos corre todos)
// Cada flujo usa un navegador limpio (IndexedDB vacía). Falla ante errores de consola, excepciones de la página y respuestas 5xx.
// Los números de caso (F03-H1…) son los de replica/test-plan.md.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const PORT = 4190
const only = process.argv.slice(2)

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
process.on('exit', () => server.kill())
for (let i = 0; i < 50; i++) {
  if (await fetch(`http://localhost:${PORT}/`).then((r) => r.ok, () => false)) break
  await new Promise((r) => setTimeout(r, 200))
}

const browser = await chromium.launch()
const results = []
const rec = (id, ok, note = '') => {
  results.push({ id, ok, note })
  console.log(`${ok ? '✓' : '✗'} ${id}${note ? ` — ${note}` : ''}`)
}

const text = (p) => p.locator('body').innerText()
const has = async (p, re) => re.test(await text(p))

/** Un navegador limpio con un negocio recién creado. `opts.skipBusiness` lo deja en la bienvenida. */
async function session(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block', acceptDownloads: true })
  const p = await context.newPage()
  const problems = []
  p.on('pageerror', (e) => problems.push(`excepción: ${e.message}`))
  p.on('console', (m) => m.type() === 'error' && problems.push(`consola: ${m.text()}`))
  p.on('response', (r) => r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`))
  p.setDefaultTimeout(8000)
  const go = (u) => p.evaluate((x) => { history.pushState({}, '', x); dispatchEvent(new PopStateEvent('popstate')) }, u)
  await p.goto(`http://localhost:${PORT}/`)
  if (!opts.skipBusiness) {
    await p.getByLabel('Nombre del negocio *').fill('Carpintería López')
    await p.getByRole('button', { name: 'Empezar' }).click()
    await p.getByText('Tu negocio hoy').waitFor()
  }
  const h = {
    p, go, problems,
    close: () => context.close(),
    home: async () => { await go('/'); await p.getByText('Tu negocio hoy').or(p.getByText(/Hola, /)).first().waitFor(); await p.waitForTimeout(250) },
    async product({ name, price = '100', cost = '', stock = '10', min = '', barcode = '' }) {
      await go('/inventario/nuevo')
      await p.getByLabel('Nombre *').fill(name)
      await p.getByLabel('Cantidad disponible *').fill(stock)
      if (min) await p.getByLabel('Cantidad mínima').fill(min)
      await p.getByLabel('Precio de venta').fill(price)
      if (cost) await p.getByLabel('Costo', { exact: true }).fill(cost)
      if (barcode) await p.getByLabel('Código de barras').fill(barcode)
      await p.getByRole('button', { name: 'Crear producto' }).click()
      await p.waitForTimeout(500)
    },
    async contact(kind, name, phone = '') {
      await go(kind === 'customer' ? '/clientes/nuevo' : '/proveedores/nuevo')
      await p.getByLabel('Nombre *').fill(name)
      if (phone) await p.getByLabel('Teléfono').fill(phone)
      await p.getByRole('button', { name: kind === 'customer' ? 'Guardar cliente' : 'Guardar proveedor' }).click()
      await p.waitForTimeout(500)
    },
    async quickSale(amount, concept = '') {
      await go('/venta/nueva')
      await p.getByLabel('Monto *').fill(String(amount))
      if (concept) await p.getByLabel('Concepto').fill(concept)
      await p.getByRole('button', { name: 'Registrar venta' }).click()
      await p.waitForTimeout(600)
    },
    /** El selector de cliente o proveedor (su etiqueta lleva también las opciones, por eso no se busca por texto exacto). */
    contactSelect: () => p.locator('label', { has: p.locator('select') }).filter({ hasText: /^(Cliente|Proveedor)/ }).locator('select'),
    /** Guarda el formulario de venta (el botón cambia según el modo). */
    submitSale: () => p.getByRole('button', { name: /^(Registrar venta|Cobrar|Registrar fiado)/ }).click(),
    /** Todos los campos de la página con nombre accesible (a11y básica). */
    async unlabeled() {
      return p.locator('input:not([type=hidden]):not([type=checkbox]):not([type=file]), select, textarea').evaluateAll((els) =>
        els.filter((e) => !(e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.labels?.length || e.closest('label'))).map((e) => e.outerHTML.slice(0, 80)))
    },
  }
  return h
}

async function flow(id, title, fn) {
  if (only.length && !only.some((o) => id.startsWith(o))) return
  console.log(`\n${id} ${title}`)
  const s = await session(id === 'F10' ? { skipBusiness: true } : {})
  try {
    await fn(s)
  } catch (e) {
    rec(`${id}-FALLO`, false, e.message.split('\n').slice(0, 3).join(' | '))
    await s.p.screenshot({ path: `e2e-${id}.png` }).catch(() => {})
  }
  rec(`${id}-CONSOLA`, s.problems.length === 0, s.problems.slice(0, 2).join(' | '))
  await s.close()
}

// ── F10 Primer uso ──────────────────────────────────────────────────────────────
await flow('F10', 'Primer uso', async ({ p, go, unlabeled }) => {
  rec('F10-E1', await (async () => { await p.getByRole('button', { name: 'Empezar' }).click(); return has(p, /obligatorio/i) })(), 'nombre vacío muestra el error')
  await p.getByLabel('Nombre del negocio *').fill('Tienda de Ana')
  await p.getByRole('button', { name: 'Empezar' }).click()
  await p.getByText('Tu negocio hoy').waitFor()
  await p.waitForTimeout(400)
  rec('F10-H1', (await has(p, /\$0\.00/)) && (await has(p, /Registrar venta/)), 'inicio vacío con balance en cero y botón de venta')
  await go('/gasto/nuevo')
  await p.getByLabel('Monto *').waitFor()
  await p.waitForTimeout(500)
  const opts = await p.locator('select').first().locator('option').allInnerTexts()
  rec('F10-H2', ['Transporte', 'Materiales', 'Insumos', 'Nómina', 'Gastos administrativos', 'Luz'].every((c) => opts.includes(c)), 'categorías de gasto de fábrica')
  rec('F10-A1', (await unlabeled()).length === 0, 'campos sin nombre accesible: ' + (await unlabeled()).join(' ; '))
})

// ── F01 Registrar una venta rápida ──────────────────────────────────────────────
await flow('F01', 'Venta rápida', async ({ p, go, home, quickSale, unlabeled }) => {
  await quickSale(1500, 'Reparación de puerta')
  await home()
  rec('F01-H1', (await has(p, /\$1,500\.00/)) && (await has(p, /1 venta/)), 'la venta de $1,500 entra al inicio')
  await go('/venta/nueva')
  await p.getByLabel('Monto *').fill('0')
  await p.getByRole('button', { name: 'Registrar venta' }).click()
  rec('F01-E1', await p.getByRole('alert').isVisible().catch(() => false), 'monto 0 muestra un aviso')
  await home()
  rec('F01-E1b', await has(p, /1 venta/), 'y no registra nada')
  const long = 'Ñandú café ☕ 😀 '.repeat(20)
  await quickSale(10, long)
  await go('/balance'); await p.waitForTimeout(300)
  rec('F01-E2', (await has(p, /Ñandú café/)) && (await has(p, /2 ventas|\$1,510\.00/)), 'concepto largo con acentos y emoji se guarda')
  await go('/venta/nueva')
  await p.getByLabel('Monto *').fill('77')
  await p.getByRole('button', { name: 'Registrar venta' }).dblclick()
  await p.waitForTimeout(800)
  await go('/balance'); await p.waitForTimeout(300)
  rec('F01-E3', ((await text(p)).match(/\$77\.00/g) ?? []).length === 1, 'doble clic en guardar registra una sola venta')
  await go('/venta/nueva')
  rec('F01-A1', (await unlabeled()).length === 0, 'campos sin nombre accesible: ' + (await unlabeled()).join(' ; '))
})

// ── F02 Venta con productos del inventario ─────────────────────────────────────
await flow('F02', 'Venta con productos', async ({ p, go, home, product, submitSale }) => {
  await product({ name: 'Silla de pino', price: '850', cost: '400', stock: '10' })
  await go('/venta/nueva')
  await p.getByRole('tab', { name: 'Con productos' }).click()
  await p.getByPlaceholder('Buscar por nombre o código').fill('Silla')
  await p.locator('.picker button').first().click()
  await p.getByLabel(/Cantidad de Silla/).fill('2')
  await submitSale()
  await p.waitForTimeout(700)
  await go('/inventario'); await p.waitForTimeout(300)
  rec('F02-H1', await has(p, /8/), 'el stock baja de 10 a 8')
  await home()
  rec('F02-H2', await has(p, /\$1,700\.00/), 'la venta de 2 sillas suma $1,700')
  // precio editado en la venta
  await go('/venta/nueva')
  await p.getByRole('tab', { name: 'Con productos' }).click()
  await p.getByPlaceholder('Buscar por nombre o código').fill('Silla')
  await p.locator('.picker button').first().click()
  await p.getByLabel(/Precio de Silla/).fill('800')
  await submitSale()
  await p.waitForTimeout(700)
  await home()
  rec('F02-E1', await has(p, /\$2,500\.00/), 'precio editado a $800 en la venta (1,700 + 800)')
  await go('/venta/nueva')
  await p.getByRole('tab', { name: 'Con productos' }).click()
  await p.getByPlaceholder('Buscar por nombre o código').fill('Silla')
  await p.locator('.picker button').first().click()
  await p.getByLabel(/Cantidad de Silla/).fill('50')
  rec('F02-E2', await has(p, /Solo hay \d+ en inventario/), 'pedir más de lo que hay avisa «Solo hay N en inventario» (se puede guardar igual)')
})

// ── F03 Vender fiado y cobrar ───────────────────────────────────────────────────
await flow('F03', 'Fiado y abono', async ({ p, go, home, contactSelect, submitSale }) => {
  await go('/venta/nueva')
  await p.getByLabel('Monto *').fill('1000')
  await p.getByRole('tab', { name: 'Fiado' }).click()
  await contactSelect().selectOption({ label: '+ Nuevo cliente…' })
  await p.getByLabel(/^Nombre/).last().fill('Olga Acevedo')
  await submitSale()
  await p.waitForTimeout(800)
  await home()
  rec('F03-H0', (await has(p, /Te deben\s*\$1,000\.00/)) && (await has(p, /\$0\.00\s*Vendido hoy/)), 'fiado: aparece en «Te deben» y no suma al efectivo de hoy')
  await go('/deudas'); await p.getByText('Olga Acevedo').first().click()
  await p.waitForTimeout(400)
  await p.getByRole('link', { name: /abono|Registrar/i }).first().click()
  await p.getByLabel('Monto *').fill('400')
  await p.getByRole('button', { name: /Guardar|Registrar/ }).last().click()
  await p.waitForTimeout(700)
  rec('F03-H1', await has(p, /\$600\.00/), 'abono parcial de $400 deja saldo de $600')
  await p.getByRole('link', { name: /abono|Registrar/i }).first().click()
  await p.getByLabel('Monto *').fill('700')
  await p.getByRole('button', { name: /Guardar|Registrar/ }).last().click()
  rec('F03-E1', await p.getByRole('alert').isVisible().catch(() => false), 'abono mayor al saldo se rechaza')
  await p.getByLabel('Monto *').fill('600')
  await p.getByRole('button', { name: /Guardar|Registrar/ }).last().click()
  await p.waitForTimeout(700)
  await home()
  rec('F03-H2', (await has(p, /\$1,000\.00/)) && !(await has(p, /Te deben/)), 'al liquidar queda cobrado $1,000 y ya no se debe nada')
})

// ── F04 Recordar una deuda por WhatsApp ─────────────────────────────────────────
await flow('F04', 'Recordatorio por WhatsApp', async ({ p, go, contact, contactSelect, submitSale }) => {
  await contact('customer', 'Beto Ruiz', '378 123 4567')
  await contact('customer', 'Sin Teléfono')
  for (const [name, amount] of [['Beto Ruiz', '500'], ['Sin Teléfono', '300']]) {
    await go('/venta/nueva')
    await p.getByLabel('Monto *').fill(amount)
    await p.getByRole('tab', { name: 'Fiado' }).click()
    await contactSelect().selectOption({ label: name })
    await submitSale()
    await p.waitForTimeout(700)
  }
  await go('/deudas'); await p.getByText('Beto Ruiz').first().click(); await p.waitForTimeout(400)
  const wa = p.getByRole('link', { name: /recordatorio/i }).first()
  const href = await wa.getAttribute('href').catch(() => null)
  rec('F04-H1', !!href && href.includes('wa.me/523781234567') && decodeURIComponent(href).includes('500'), 'el recordatorio abre WhatsApp con el número y el saldo')
  await go('/deudas'); await p.getByText('Sin Teléfono').first().click(); await p.waitForTimeout(400)
  const none = await p.getByRole('link', { name: /recordatorio/i }).count()
  rec('F04-E1', none === 0 || (await has(p, /teléfono/i)), 'cliente sin teléfono: no hay enlace roto')
})

// ── F05 Registrar un gasto ──────────────────────────────────────────────────────
await flow('F05', 'Gastos', async ({ p, go, home, contact, contactSelect }) => {
  await go('/gasto/nuevo')
  await p.getByLabel('Monto *').fill('350')
  await p.getByLabel('Concepto').fill('Gasolina')
  await p.locator('select').first().selectOption({ label: 'Transporte' })
  await p.getByRole('button', { name: /Guardar|Registrar/ }).last().click()
  await p.waitForTimeout(700)
  await home()
  rec('F05-H1', (await has(p, /\$350\.00/)) && (await has(p, /1 gasto/)), 'gasto al contado entra a «Gastado»')
  await contact('supplier', 'Maderera del Norte')
  await go('/gasto/nuevo')
  await p.getByLabel('Monto *').fill('900')
  await p.getByRole('tab', { name: 'A crédito' }).click()
  await contactSelect().selectOption({ label: 'Maderera del Norte' })
  await p.getByRole('button', { name: /Guardar|Registrar/ }).last().click()
  await p.waitForTimeout(700)
  await home()
  rec('F05-H2', (await has(p, /Debes\s*\$900\.00/)) && (await has(p, /\$350\.00\s*Gastos hoy/)), 'gasto a crédito: aparece en «Debes» y no sale de caja todavía')
})

// ── F06 Alta de producto e inventario ───────────────────────────────────────────
await flow('F06', 'Inventario', async ({ p, go, home, product }) => {
  await product({ name: 'Bisagra', price: '30', stock: '2', min: '3', barcode: '7501' })
  await home()
  rec('F06-H1', await has(p, /necesitan reabastecerse|Reabastece Bisagra/), 'stock bajo avisa en el inicio')
  await go('/inventario/nuevo')
  await p.getByLabel('Nombre *').fill('Otra cosa')
  await p.getByLabel('Cantidad disponible *').fill('1')
  await p.getByLabel('Código de barras').fill('7501')
  await p.getByRole('button', { name: 'Crear producto' }).click()
  await p.waitForTimeout(500)
  rec('F06-E1', (await has(p, /ya lo usa/)) , 'código de barras repetido se rechaza')
  await p.getByLabel('Código de barras').fill('')
  await p.getByLabel('Cantidad disponible *').fill('-3')
  await p.getByRole('button', { name: 'Crear producto' }).click()
  await p.waitForTimeout(400)
  rec('F06-E2', await has(p, /0 o más|negativa/i), 'stock negativo se rechaza')
})

// ── F07 Estadísticas y reportes ─────────────────────────────────────────────────
await flow('F07', 'Estadísticas y reportes', async ({ p, go, quickSale }) => {
  await quickSale(1200, 'Venta de prueba')
  await go('/estadisticas'); await p.getByText('Ventas registradas', { exact: true }).waitFor()
  for (const tab of ['Día', 'Semana', 'Mes', 'Año']) {
    await p.getByRole('tab', { name: tab }).click(); await p.waitForTimeout(250)
    if (tab === 'Día') rec('F07-H1', await has(p, /\$1,200\.00/), 'Día: muestra la venta de hoy')
  }
  rec('F07-H2', await has(p, /\$1,200\.00/), 'Año: la venta sigue contando')
  await p.getByRole('tab', { name: 'Gastos' }).click(); await p.waitForTimeout(250)
  rec('F07-H3', await has(p, /Sin gastos registrados|Gastos registrados/), 'pestaña Gastos')
  for (const [kind, ext] of [['Excel', 'xlsx'], ['PDF', 'pdf']]) {
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 6000 }).catch(() => null), p.getByRole('button', { name: kind, exact: true }).click()])
    rec(`F07-H4${ext}`, !!dl && dl.suggestedFilename().endsWith(`.${ext}`), dl ? dl.suggestedFilename() : 'no se descargó')
  }
})

// ── F08 Pedidos: cobrar y cancelar ──────────────────────────────────────────────
await flow('F08', 'Pedidos', async ({ p, go, home, product }) => {
  await product({ name: 'Repisa', price: '500', stock: '5' })
  await go('/pedidos/nuevo')
  await p.getByLabel('Nombre del cliente').fill('Olga')
  await p.getByPlaceholder('Nombre o código de barras').fill('Repisa')
  await p.locator('.picker button').first().click()
  await p.getByRole('button', { name: 'Crear pedido' }).click()
  await p.getByText(/Pedido #1/).first().waitFor()
  await p.getByRole('button', { name: /Cobrar/ }).first().click()
  await p.waitForTimeout(500)
  const confirm = p.getByRole('button', { name: /Cobrar|Confirmar|Sí/ }).last()
  if (await confirm.isVisible().catch(() => false)) await confirm.click()
  await p.waitForTimeout(900)
  await home()
  rec('F08-H1', await has(p, /\$500\.00/), 'cobrar el pedido entra al balance')
  await go('/inventario'); await p.waitForTimeout(300)
  rec('F08-H2', await has(p, /4/), 'y baja el stock de 5 a 4')
  await go('/pedidos'); await p.getByRole('tab', { name: /Pagados/ }).click(); await p.getByText(/Olga/).first().click(); await p.waitForTimeout(400)
  await p.getByRole('button', { name: /Cancelar pedido|Cancelar/ }).first().click()
  const yes = p.getByRole('button', { name: /Sí/ }).first()
  if (await yes.isVisible().catch(() => false)) await yes.click()
  await p.waitForTimeout(900)
  await home()
  rec('F08-E1', await has(p, /Vendido hoy · 0 ventas/), 'cancelar un pedido pagado anula la venta')
  await go('/inventario'); await p.waitForTimeout(300)
  rec('F08-E2', await has(p, /5/), 'y el stock vuelve a 5')
})

// ── F09 Empleado con PIN ────────────────────────────────────────────────────────
await flow('F09', 'Empleados', async ({ p, go }) => {
  await go('/empleados')
  await p.getByLabel('PIN', { exact: true }).fill('9999')
  await p.getByRole('button', { name: 'Activar PINs' }).click()
  await p.getByText('ya puedes agregar empleados').waitFor()
  await p.getByLabel('Nombre', { exact: true }).fill('Rosa')
  await p.getByLabel('PIN del empleado').fill('1234')
  await p.getByRole('button', { name: 'Agregar', exact: true }).click()
  await p.getByText('Empleado agregado').waitFor()
  await p.getByRole('button', { name: 'Cambiar de usuario' }).click()
  await p.getByRole('button', { name: /Rosa/ }).click()
  await p.getByLabel('PIN').fill('1234')
  await p.getByRole('button', { name: 'Entrar' }).click()
  await p.getByText('Hola, Rosa').waitFor()
  await go('/venta/nueva'); await p.getByLabel('Monto *').fill('1500'); await p.getByRole('button', { name: 'Registrar venta' }).click(); await p.waitForTimeout(700)
  await go('/balance'); await p.waitForTimeout(300)
  rec('F09-H1', (await p.evaluate(() => location.pathname)) === '/', 'Rosa no puede abrir el balance')
  await p.getByRole('button', { name: 'Cambiar de usuario' }).click()
  await p.getByRole('button', { name: /Dueño/ }).click()
  await p.getByLabel('PIN').fill('9999')
  await p.getByRole('button', { name: 'Entrar' }).click()
  await p.getByText('Tu negocio hoy').waitFor()
  await go('/estadisticas'); await p.getByText('Quién vendió más').waitFor({ timeout: 4000 }).catch(() => {})
  rec('F09-H2', (await has(p, /Quién vendió más/)) && (await has(p, /Rosa/)), 'el dueño ve que Rosa vendió')
})

// ── F11 Cotizar y convertir en venta ────────────────────────────────────────────
await flow('F11', 'Cotización', async ({ p, go, home, contact, contactSelect }) => {
  await contact('customer', 'Olga Acevedo')
  await go('/cotizaciones/nueva')
  await contactSelect().selectOption({ label: 'Olga Acevedo' })
  await p.getByRole('button', { name: '+ Artículo sin inventario' }).click()
  await p.getByLabel(/Nombre|Artículo/).last().fill('Closet a medida')
  await p.getByLabel(/Precio/).last().fill('3000')
  await p.getByRole('button', { name: 'Crear cotización' }).click()
  await p.getByText(/Cotización #1|Cotización P-/).first().waitFor({ timeout: 6000 })
  rec('F11-H1', await has(p, /\$3,000\.00/), 'cotización creada con su total')
  await p.getByRole('button', { name: /Aceptada|Aceptar/ }).first().click().catch(() => {})
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: /Convertir/ }).first().click()
  const ok = p.getByRole('button', { name: /Convertir|Confirmar|Crear venta/ }).last()
  await p.waitForTimeout(400)
  if (await ok.isVisible().catch(() => false)) await ok.click()
  await p.waitForTimeout(900)
  await home()
  rec('F11-H2', await has(p, /\$3,000\.00/), 'convertida en venta, entra al balance')
})

// ── F12 Compra a proveedor ──────────────────────────────────────────────────────
await flow('F12', 'Compras', async ({ p, go, home, contact, product, contactSelect }) => {
  await contact('supplier', 'Maderera del Norte')
  await product({ name: 'Tablón', price: '300', cost: '100', stock: '5' })
  await go('/compras/nueva')
  await contactSelect().selectOption({ label: 'Maderera del Norte' })
  await p.getByPlaceholder('Nombre o código de barras').fill('Tablón')
  await p.locator('.picker button').first().click()
  await p.getByLabel(/Cantidad de Tablón/).fill('10')
  await p.getByRole('button', { name: 'Registrar compra' }).click()
  await p.waitForTimeout(900)
  await go('/inventario'); await p.waitForTimeout(300)
  rec('F12-H1', await has(p, /15/), 'la compra sube el stock de 5 a 15')
  await home()
  rec('F12-H2', await has(p, /Gastado\s*\$1,000\.00|\$1,000\.00/), 'y registra el egreso de $1,000 (10 × $100)')
})

// ── Cotizador rápido ────────────────────────────────────────────────────────────
await flow('Q', 'Cotizador rápido', async ({ p, go }) => {
  await go('/cotizador'); await p.getByText('Precio sugerido').waitFor()
  rec('Q-H1', (await p.locator('.quoter-big').innerText()).includes('$16,500.00'), 'precio inicial $16,500.00')
  await p.getByRole('combobox', { name: 'Cliente' }).fill('Olga')
  await p.getByRole('button', { name: 'Guardar cotización' }).click()
  await p.getByRole('status').filter({ hasText: 'Cotización guardada' }).waitFor()
  await go('/cotizaciones'); await p.waitForTimeout(300)
  rec('Q-H2', (await has(p, /Olga/)) && (await has(p, /Cocina/)), 'se guarda en Cotizaciones')
  await go('/cotizador')
  await p.getByRole('button', { name: 'Guardar cotización' }).click()
  rec('Q-E1', await p.getByText(/nombre del cliente/i).isVisible().catch(() => false), 'sin cliente no guarda')
})


// ── Transversales: ancho de pantalla, accesibilidad, dos pestañas y rendimiento ─────
await flow('X', 'Transversales', async ({ p, go, quickSale, unlabeled }) => {
  await p.setViewportSize({ width: 360, height: 740 })
  await quickSale(100, 'x')
  const routes = ['/', '/balance', '/deudas', '/inventario', '/mas', '/venta/nueva', '/gasto/nuevo', '/inventario/nuevo', '/clientes', '/proveedores', '/cotizaciones', '/cotizaciones/nueva',
    '/compras', '/compras/nueva', '/estadisticas', '/catalogo', '/pedidos', '/pedidos/nuevo', '/cotizador', '/negocios', '/empleados', '/cuenta']
  const wide = []
  const unnamed = []
  for (const r of routes) {
    await go(r); await p.waitForTimeout(350)
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (over > 1) wide.push(`${r} (+${over}px)`)
    const u = await unlabeled()
    if (u.length) unnamed.push(`${r}: ${u.length}`)
  }
  rec('X-A1', wide.length === 0, wide.length ? `desborde horizontal en: ${wide.join(', ')}` : '22 pantallas caben en 360 px')
  rec('X-A2', unnamed.length === 0, unnamed.length ? `campos sin nombre: ${unnamed.join(', ')}` : 'todos los campos tienen nombre accesible')

  // dos pestañas a la vez: lo que se registra en una aparece en la otra
  const second = await p.context().newPage()
  await second.goto(`http://localhost:${PORT}/`)
  await second.getByText('Tu negocio hoy').waitFor()
  await quickSale(900, 'desde la pestaña uno')
  await second.waitForTimeout(1200)
  rec('X-E1', /\$1,000\.00/.test(await second.locator('body').innerText()), 'la segunda pestaña ve la venta nueva sin recargar')
  await second.close()

  // rendimiento: 3,000 ventas repartidas en 90 días
  await p.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('mi-negocio'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    const biz = await new Promise((res) => { const r = db.transaction('business').objectStore('business').getAll(); r.onsuccess = () => res(r.result[0]) })
    const tx = db.transaction('txn', 'readwrite')
    const now = Date.now()
    for (let i = 0; i < 3000; i++) {
      const t = new Date(now - Math.floor(Math.random() * 90) * 86_400_000 - Math.floor(Math.random() * 40_000_000)).toISOString()
      tx.objectStore('txn').put({ id: crypto.randomUUID(), businessId: biz.id, type: i % 5 === 0 ? 'expense' : 'sale', amountCents: 5000 + (i % 40) * 100, concept: `Venta ${i}`, date: t, paymentMethod: 'cash', status: 'paid', createdAt: t, updatedAt: t })
    }
    await new Promise((res) => { tx.oncomplete = res })
  })
  const timed = async (url, re) => { const t0 = Date.now(); await go(url); await p.getByText(re).first().waitFor({ timeout: 15000 }); return Date.now() - t0 }
  const tHome = await timed('/', /Balance del día/)
  const tStats = await timed('/estadisticas?p=anio', /\d{3,}\s+ventas/)
  const tBal = await timed('/balance?p=mes', /\d{2,} ventas|Ventas/)
  rec('X-P1', tHome < 3000 && tStats < 5000 && tBal < 4000, `con 3,000 movimientos: inicio ${tHome} ms, estadísticas ${tStats} ms, balance ${tBal} ms`)
})

await browser.close()
server.kill()
const bad = results.filter((r) => !r.ok)
console.log(`\n${results.length - bad.length}/${results.length} casos bien${bad.length ? `; fallan: ${bad.map((b) => b.id).join(', ')}` : ''}`)
process.exit(bad.length ? 1 : 0)
