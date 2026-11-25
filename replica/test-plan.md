# Plan de pruebas: Conta

Build: ver `git log` de la rama `ccr-0256ab58-cv2fdi` · Fecha: 2026-11-25 · Entorno: app compilada (`npm run build`) servida con `vite preview`, Chromium real a 390×800 (y 360 px de ancho para el desborde), IndexedDB limpia por flujo.

Cómo correrlo: `cd app && npm run build && npm run e2e:flujos` (todos) o `node scripts/e2e-flows.mjs F03 F05` (algunos). `npm run e2e` prueba el modo sin conexión con la cuenta conectada. Las reglas del servidor, la sincronización y los folios se prueban contra Postgres real con `SYNC_PG_URL=… npm test` (ver `replica/sync-design.md`).

Cada flujo falla además si hay un error de consola, una excepción de la página o una respuesta 5xx (casos `-CONSOLA`).

| caso | flujo | tipo | qué se hace | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- | --- |
| F10-E1 | primer uso | borde | «Empezar» sin nombre | aviso de que el nombre es obligatorio | e2e | ✓ |
| F10-H1 | primer uso | feliz | crear negocio | inicio con $0.00 y botón de venta | e2e | ✓ |
| F10-H2 | primer uso | feliz | abrir «Nuevo gasto» | categorías de fábrica (Transporte, Materiales, Insumos, Nómina, Gastos administrativos, Luz) | e2e | ✓ |
| F01-H1 | venta rápida | feliz | vender $1,500 | entra a «Vendido» del inicio | e2e | ✓ |
| F01-E1 | venta rápida | borde | monto 0 | aviso y no se registra | e2e | ✓ |
| F01-E2 | venta rápida | borde | concepto de 300 caracteres con acentos y emoji | se guarda y se ve | e2e | ✓ |
| F01-E3 | venta rápida | borde | doble clic en guardar | una sola venta | e2e | ✓ |
| F01-E4 / X-E1 | venta rápida | borde | dos pestañas a la vez | la otra pestaña ve la venta sin recargar | e2e | ✓ |
| F02-H1/H2 | venta con productos | feliz | vender 2 sillas de 10 | stock 8 y total $1,700 | e2e | ✓ |
| F02-E1 | venta con productos | borde | cambiar el precio en la venta | usa el precio editado | e2e | ✓ |
| F02-E2 | venta con productos | borde | pedir 50 de 8 | avisa «Solo hay 8 en inventario»; se puede guardar (stock negativo, decisión de T2) | e2e | ✓ |
| F03-H0 | fiado | feliz | vender fiado a cliente nuevo | «Te deben» $1,000; no suma al efectivo | e2e | ✓ |
| F03-H1 | fiado | feliz | abono de $400 | saldo $600 | e2e | ✓ |
| F03-E1 | fiado | borde | abono mayor al saldo | se rechaza | e2e | ✓ |
| F03-H2 | fiado | feliz | liquidar | cobrado $1,000 y sin deuda | e2e | ✓ |
| F04-H1 | recordatorio | feliz | «recordatorio» de una deuda | enlace wa.me con el número y el saldo | e2e | ✓ |
| F04-E1 | recordatorio | borde | cliente sin teléfono | no hay enlace roto | e2e | ✓ |
| F05-H1 | gastos | feliz | gasto al contado en «Transporte» | entra a «Gastado» | e2e | ✓ |
| F05-H2 | gastos | feliz | gasto a crédito con proveedor | aparece en «Debes», no sale de caja | e2e | ✓ |
| F06-H1 | inventario | feliz | producto con stock bajo | aviso en el inicio | e2e | ✓ |
| F06-E1 | inventario | borde | código de barras repetido | se rechaza | e2e | ✓ |
| F06-E2 | inventario | borde | stock negativo | se rechaza | e2e | ✓ |
| F07-H1…H3 | estadísticas | feliz | Día / Semana / Mes / Año, pestaña Gastos | muestran la venta | e2e | ✓ |
| F07-H4 | reportes | feliz | descargar Excel y PDF | se descargan `reporte-….xlsx` y `.pdf` | e2e | ✓ |
| F08-H1/H2 | pedidos | feliz | crear un pedido y cobrarlo | entra al balance y baja el stock | e2e | ✓ |
| F08-E1/E2 | pedidos | borde | cancelar un pedido pagado | se anula la venta y vuelve el stock | e2e | ✓ |
| F08-live | catálogo en vivo | feliz | cliente pide por `/catalogo/?c=…` | llega a Pedidos con precios del servidor | pg + Chromium (simulado) | ✓ (`catalogLive.pg.test.ts`, `engine.pg.test.ts`) |
| F09-H1/H2 | empleados | feliz | Rosa vende; no abre el balance; el dueño ve «Quién vendió más» | se cumple | e2e | ✓ |
| F11-H1/H2 | cotización | feliz | crear, aceptar y convertir en venta | entra al balance | e2e | ✓ |
| F12-H1/H2 | compras | feliz | comprar 10 tablones a $100 | stock +10 y egreso $1,000 | e2e | ✓ |
| Q-H1/H2/E1 | cotizador | feliz/borde | cotizar, guardar, sin cliente | $16,500; aparece en Cotizaciones; no guarda sin cliente | e2e | ✓ |
| OFF-1…4 | sin internet | feliz | crear un pedido sin red con la cuenta conectada | folio «P-…», «Sin conexión», y al volver la red sube con su número | e2e (`npm run e2e`) | ✓ |
| OFF-SW | sin internet | feliz | recargar y abrir `/estadisticas` sin red (service worker) | abre | manual con Chromium | ✓ |
| X-A1 | transversal | borde | 22 pantallas a 360 px | sin desborde horizontal | e2e | ✓ (tras BUG-001) |
| X-A2 | transversal | a11y | todos los campos | tienen nombre accesible | e2e | ✓ |
| X-P1 | transversal | rendimiento | 3,000 movimientos | estadísticas del año < 5 s (≈ 0.8 s) | e2e | ✓ |

## Lo que no se pudo automatizar (lista para la prueba a mano de la dueña)

- [ ] Instalar la app en el teléfono (Chrome en Android / Safari en iPhone) y abrirla sin internet.
- [ ] Crear la cuenta con un correo real, confirmar el correo y entrar (el correo ahora redirige a `https://conta-app-pi.vercel.app`; límite de 2 correos por hora de Supabase).
- [ ] «Subir mis datos» y bajarlos en un segundo aparato.
- [ ] Encender el catálogo en vivo, abrir `…/catalogo/?c=tu-nombre` desde otro teléfono, hacer un pedido y ver que llega a Pedidos.
- [ ] Subir una foto de producto desde el teléfono y verla en el catálogo en vivo y en el segundo aparato (Storage real).
- [ ] Menú nativo de compartir PDF/imagen en el teléfono y abrir el Excel en Microsoft Excel.
- [ ] Enviar un recordatorio y una cotización por WhatsApp desde el teléfono (el texto sale; el envío lo hace WhatsApp).
