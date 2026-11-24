# Mapa de reconocimiento: Treinta (Android; también iOS y web)

Alcance: la app completa, priorizada. Primero el núcleo (ventas, gastos, deudas, inventario, balance) y después el resto como should/could.
Para: uso interno en el negocio del usuario (no para revender).
Fecha: 2026-11-24

> **Confianza.** Actualizado con la ficha de Play (leída el 2026-11-24, ya con la red abierta), sus 7 capturas (en `replica/screens/play-01..07.png`, solo referencia y fuera de git) y la página oficial de precios de México. Las pantallas que aparecen en esas capturas tienen confianza **alta**; el resto sigue **inferido**. Para completarlo, lo mejor son capturas de tu propia cuenta de Treinta.

Ficha de Play: 4,2★ con 106.822 reseñas, más de 10 M descargas, "más de 7 millones de negocios en México y Latinoamérica".

## Fuentes

| # | fuente | URL | notas |
| --- | --- | --- | --- |
| 1 | ficha Play Store | https://play.google.com/store/apps/details?id=com.treintaapp | descripción, 4,2★ (106.822), 10 M+, 7 capturas: inicio, balance, catálogo, cotizaciones, variantes, crear producto |
| 1b | precios (MX) | https://treinta.co/mx/planes-y-precios/ | Esencial $299/mes, Pro $399/mes (anual −25 %); Pro anual = facturación SAT ilimitada |
| 2 | ficha App Store | https://apps.apple.com/app/id1644703591 | precios de planes por país (US, MX, PE) |
| 3 | precios (CO) | https://treinta.co/planes-y-precios/ | Esencial (solo app) vs Pro (app + web, recetas, factura electrónica) |
| 4 | precios (EC) | https://www.treinta.co/ec/planes-y-precios/ | Esencial US$9,99, Pro US$19,99 |
| 5 | funcionalidades | https://treinta.co/pe/funcionalidades | lista de módulos por plan |
| 6 | comercios | https://treinta.co/comercios/ | ventas, inventario, clientes, proveedores, empleados |
| 7 | inventario y ventas | https://treinta.co/software-inventario-ventas/ | stock en tiempo real, descuento automático con cada venta, variaciones en Pro |
| 8 | reportes | https://www.treinta.co/app-para-reportes-de-ventas-y-estadisticas-de-tu-negocio/ | Movimientos → descargar reporte; módulo Estadísticas |
| 9 | catálogo virtual | https://www.treinta.app/catalogo-virtual | tienda en línea, pedidos con estado, pagados → Balance |
| 10 | blog: fiado | https://treinta.co/blog/aprovechar-fiado | datos de un fiado, recordatorio por WhatsApp |
| 11 | blog: ventas a crédito | https://treinta.co/blog/como-gestionar-ventas-a-credito-sin-perder-dinero | abonos parciales |
| 12 | servicios | https://treinta.co/software-para-negocios-de-servicios-treinta/ | módulo Cuentas por Cobrar con abonos |
| 13 | blog: llevar cuentas | https://treinta.co/blog/app-para-llevar-cuentas-de-una-tienda/ | factura electrónica solo MX y CO |
| 14 | reseña restaurantes | https://foodapos.com/blog/treinta-para-restaurantes-opiniones | límites del producto, Pro = factura electrónica |
| 15 | reseña Whaticket | https://whaticket.com/blog/treinta-app-como-funciona/ | flujo de deudas (más de 3 años, puede estar desfasado) |
| 16 | Portafolio | https://www.portafolio.co/negocios/empresas/treinta-opciones-que-ofrece-para-ayudar-a-digitalizar-a-los-microcomercios-568510 | Treinta Shop gratis por WhatsApp |

## Ciclo principal

Anotar cada venta y gasto desde el móvil en segundos (de contado o fiado) y ver en todo momento cuánto entra, cuánto sale y quién debe, con el inventario que se descuenta solo.

## Pantallas

Visto en capturas (confianza alta): S03, S03b, S04 (botones), S11, S12, S18, S26 y el selector de negocio (S21).

| ID | pantalla | ruta / cómo llegar | propósito | componentes clave | estados |
| --- | --- | --- | --- | --- | --- |
| S01 | Bienvenida / registro | primer arranque | crear cuenta (teléfono con OTP o email/Google) | campo de teléfono, OTP, botones sociales | vacío, error de código |
| S02 | Datos del negocio | tras el registro | nombre, tipo de negocio, país/moneda | formulario, selector de categoría | vacío, filled |
| S03 | Balance / Movimientos | pestaña principal | **visto**: tira de días (06 oct, 07 oct, 08 oct…) + calendario; tarjeta "Balance" con Ingresos (verde, ↗) y Egresos (rojo, ↙); enlaces "Descargar reportes" y "Ver balance"; pestañas (ingresos/egresos); lista agrupada por mes con producto × cantidad, método (Tarjeta, Efectivo, Catálogo virtual), fecha y hora, monto y estado "Pagada"; botones fijos verde "Nueva venta" y rojo "Nuevo gasto" | cabecera con negocio + rol, búsqueda, filtros | vacío, filled |
| S03b | Inicio (accesos) | pestaña inicio | **visto**: cabecera amarilla con negocio ("Tiendita don pepe ▾") y rol "Propietario", ayuda y notificaciones; "Accesos rápidos" (Registrar venta, …); "Sugeridos para ti": Catálogo virtual, Estadísticas, Cotizaciones, Inventario, Clientes, Empleados | tarjetas de acceso, cuadrícula de módulos | — |
| S04 | Nueva venta | FAB en S03 | registrar venta: rápida (monto + concepto) o con productos del inventario | toggle venta libre / con productos, buscador de producto, carrito, total, método de pago, contado/fiado, cliente | vacío, carrito con items, sin stock, error |
| S05 | Venta registrada / recibo | tras guardar S04 | confirmar y compartir comprobante | resumen, botón compartir por WhatsApp/PDF, nueva venta | filled |
| S06 | Nuevo gasto | FAB en S03 | registrar gasto con categoría, proveedor, método de pago, contado/a crédito | monto, categoría, proveedor, nota, fecha | vacío, error |
| S07 | Detalle de movimiento | tocar fila en S03 | ver, editar o borrar una venta o gasto | resumen, items, acciones | filled, confirmar borrado |
| S08 | Deudas (Cuentas por cobrar / por pagar) | pestaña | lista de clientes que deben y de proveedores a quienes se debe | tabs cobrar/pagar, totales, lista ordenada por monto o vencimiento | vacío, filled |
| S09 | Detalle de deuda de un contacto | tocar fila en S08 | historial de fiados y abonos, saldo | saldo, lista, "Registrar abono", "Enviar recordatorio" | saldo 0, filled, vencida |
| S10 | Registrar abono | S09 | pago parcial o total de una deuda | monto, método, fecha | error (abono > saldo) |
| S11 | Inventario | pestaña | lista de productos con stock y precio; **visto**: botón "Registrar compras" arriba | buscador, filtros por categoría, lista, alerta stock bajo, "+ Producto", "Registrar compras" | vacío, filled, stock bajo |
| S12 | Crear / editar producto | S11 | **visto**: pestañas "Información general" / "Agregar variantes"; hasta 3 imágenes (500×500, PNG, máx. 2 MB); código de barras; nombre*; cantidad disponible*; cantidad mínima (ⓘ); más abajo, precio y costo (inferido) | subida de imágenes, escáner, campos obligatorios con *, pestaña de variantes (talla, color, tamaño…) | vacío, error, filled |
| S13 | Clientes | menú / S04 | agenda de clientes | lista, buscador, "+ Cliente", importar contactos | vacío, filled |
| S14 | Proveedores | menú / S06 | agenda de proveedores | lista, buscador, "+ Proveedor" | vacío, filled |
| S15 | Estadísticas | pestaña o menú | ventas por periodo, productos más vendidos, gastos por categoría, métodos de pago | gráficas, selector de periodo | vacío, filled, bloqueado por plan |
| S16 | Reportes / descargar | Movimientos → descargar | exportar ventas, gastos e inventario a Excel/PDF | selector de periodo y tipo, botón descargar | generando, listo, error |
| S17 | Catálogo virtual: configuración | menú → Tienda | activar tienda, link, logo, WhatsApp, productos visibles | toggle, link compartible, lista de productos | sin activar, activa |
| S18 | Catálogo virtual: página pública | `treinta.shop/menu/<negocio>` | **visto**: logo y nombre, "Abierto · 08:00 AM – 5:00 PM", dirección, buscador, chips de categoría ("Ver todos" + categorías), "Ordenar por", vista cuadrícula/lista, tarjetas con foto, nombre, descripción y precio; botón flotante verde (WhatsApp/carrito) | carrito, "Pedir por WhatsApp" (inferido) | vacío, carrito, enviado |
| S19 | Pedidos | menú → Pedidos | gestionar pedidos del catálogo | lista con estado (pendiente, en proceso, pagado, eliminado), detalle | vacío, filled |
| S20 | Empleados | menú → Configuración | invitar empleados y limitar lo que ven | lista, invitar por teléfono, roles/permisos | vacío, filled (detalle **guess**) |
| S21 | Configuración / perfil del negocio | menú; **selector de negocio** en la cabecera (▾) | datos del negocio, horario y dirección (salen en el catálogo), moneda, categorías de gasto, plan; cambiar entre varios negocios | lista de ajustes, selector de negocio | — |
| S22 | Planes / suscripción | menú o paywall | Esencial vs Pro, pago | tarjetas de plan, comparación | gratis, prueba, activo |
| S23 | Recetas / insumos (Pro) | inventario | producto compuesto que descuenta insumos al venderse | lista de insumos con cantidades | vacío, filled (detalle **guess**) |
| S24 | Factura electrónica (Pro, CO/MX) | desde S05 | emitir factura ante el fisco | datos fiscales del cliente, emitir | **skip** fuera de CO/MX |
| S25 | Versión web | navegador (Pro) | mismas funciones en pantalla grande, tipo POS | layout de escritorio | — |
| S26 | Cotizaciones | Inicio → Cotizaciones | **visto**: lista agrupada por cliente ("Olga Acevedo · 1 cotización"), buscador por cliente, "Historial", ajustes ⚙, aviso con punto rojo "El cliente tiene cotizaciones próximas a vencer"; al crear: modal "¡Creaste una cotización!" + "Compartir cotización" | lista, punto de alerta, modal de éxito | vacío, filled, por vencer |
| S27 | Crear cotización | S26 → nueva | cliente, productos o conceptos, cantidades, precios, vigencia; compartir PDF/WhatsApp; convertir en venta (inferido) | selector de cliente, items, fecha de vencimiento | — |
| S28 | Registrar compras | S11 → "Registrar compras" | entrada de mercancía: proveedor, productos, cantidades, costo; sube stock y crea un gasto (inferido) | selector de proveedor, items, total | — |

## Flujos

```
F01 Registrar una venta rápida de contado
    S03 -> S04 (monto, concepto, método) -> S05
    happy path clicks: ~4
    edge: monto 0, sin conexión (¿offline?), fecha pasada

F02 Registrar una venta con productos del inventario
    S03 -> S04 (buscar, agregar items, cantidades) -> S05; el stock baja
    happy path clicks: ~6
    edge: producto sin stock, precio editado en la venta, descuento, variación

F03 Vender fiado y cobrar después
    S04 (fiado + cliente + fecha límite) -> S05 ... S08 -> S09 -> S10 (abono) -> saldo 0
    happy path clicks: ~7 venta + ~4 abono
    edge: cliente nuevo desde la venta, abono parcial, abono mayor al saldo, deuda vencida

F04 Recordar una deuda por WhatsApp
    S08 -> S09 -> "Enviar recordatorio" -> WhatsApp con mensaje prellenado (saldo, link)
    happy path clicks: 3
    edge: cliente sin teléfono

F05 Registrar un gasto (contado o a crédito con proveedor)
    S03 -> S06 -> guardado; si es a crédito, aparece en "por pagar" de S08
    happy path clicks: ~4

F06 Alta de producto e inventario
    S11 -> S12 (foto, precio, costo, stock) -> S11
    edge: código de barras repetido, stock negativo, alerta de stock bajo

F07 Ver cómo va el negocio
    S03 (cambiar periodo) -> S15 -> S16 descargar reporte

F08 Vender por catálogo
    S17 activar -> compartir link -> cliente en S18 hace pedido -> S19 marca "pagado" -> entra al Balance (S03) y baja stock
    edge: producto agotado mientras el cliente pide, pedido cancelado

F09 Dar acceso a un empleado
    S20 invitar -> el empleado registra ventas -> el dueño ve quién vendió (detalle guess)

F11 Cotizar y convertir en venta
    S03b -> S26 -> S27 (cliente, items, vigencia) -> "Compartir cotización" (WhatsApp/PDF) -> aceptada -> venta (S04 prellenada)
    happy path clicks: ~7
    edge: cotización vencida, precios cambiados desde que se cotizó, aceptación parcial

F12 Registrar una compra a proveedor
    S11 -> S28 (proveedor, items, costo) -> stock sube y se registra el egreso (o la deuda por pagar)

F10 Primer uso
    S01 -> S02 -> S03 vacío con CTA "Registra tu primera venta"
```

## Componentes

| componente | variantes | estados | usado en |
| --- | --- | --- | --- |
| Botón | primario, secundario, texto, peligro | default, pressed, disabled, loading | todas |
| FAB / acción rápida | venta, gasto | abierto, cerrado | S03 |
| Campo de monto | grande con teclado numérico y moneda | vacío, filled, error | S04, S06, S10 |
| Selector de periodo | día, semana, mes, rango | — | S03, S15, S16 |
| Tarjeta de total | ingresos, egresos, utilidad, por cobrar | positivo, negativo | S03, S08, S15 |
| Fila de movimiento | venta, gasto, abono; contado/fiado | pagado, pendiente | S03, S09 |
| Fila de producto | con foto, sin foto | stock ok, bajo, agotado | S04, S11, S18 |
| Carrito / resumen | — | vacío, con items | S04, S18 |
| Toggle contado / fiado | — | — | S04, S06 |
| Selector de contacto | cliente, proveedor, crear nuevo | — | S04, S06 |
| Selector de método de pago | efectivo, transferencia, tarjeta, otro | — | S04, S06, S10 |
| Chip de estado | pendiente, en proceso, pagado, vencida | — | S08, S19 |
| Gráfica | barras, dona | vacío, filled | S15 |
| Bottom sheet / modal | confirmación, filtros | — | varias |
| Toast | éxito, error | — | todas |
| Estado vacío | ilustración + CTA | — | S03, S08, S11, S19 |
| Paywall | función Pro bloqueada | — | S15, S12 (variaciones), S25 |
| Barra de navegación inferior | Balance, Deudas, Inventario, Más | activo | app |

## Modelo de datos inferido

```
Business     id, name, category, country, currency, logo_url, phone, plan (free|esencial|pro), created_at
             evidencia: S02, páginas de precios. confianza: alta

User         id, phone, email, name
Membership   user_id, business_id, role (owner|employee), permissions (json)
             evidencia: "empleados" en comercios. confianza: guess en permisos

Contact      id, business_id, type (customer|supplier), name, phone, document_id, notes
             evidencia: S13, S14, blog de fiado. confianza: alta

Product      id, business_id, name, sku/barcode, photo_url, price, cost, stock, min_stock,
             category_id, is_visible_in_catalog, is_recipe
             evidencia: páginas de inventario y catálogo. confianza: alta
ProductVariant id, product_id, name (talla/color), price, stock        confianza: media (Pro)
RecipeItem   product_id, ingredient_product_id, quantity            confianza: guess (Pro)
Category     id, business_id, kind (product|expense), name

Transaction  id, business_id, type (sale|expense), amount, concept, date, payment_method,
             status (paid|credit), contact_id, due_date, created_by, source (app|web|catalog)
             evidencia: S03, S04, S06, blog de fiado. confianza: alta
TransactionItem transaction_id, product_id, variant_id, quantity, unit_price, unit_cost
StockMovement product_id, delta, reason (sale|purchase|adjust|order), transaction_id

Payment (abono) id, transaction_id o contact_id, amount, method, date
             evidencia: "abonos parciales" en cuentas por cobrar. confianza: alta

Quote        id, business_id, contact_id, number, items (json o QuoteItem), total, valid_until,
             status (draft|sent|accepted|expired|converted), transaction_id
             evidencia: captura de Cotizaciones (por cliente, "próximas a vencer"). confianza: alta en lista, media en campos
Purchase     id, business_id, supplier_id, items, total, status (paid|credit), date
             evidencia: botón "Registrar compras". confianza: media

Order        id, business_id, customer_name, phone, items (json), total,
             status (pending|in_progress|paid|deleted), transaction_id
             evidencia: página de catálogo virtual. confianza: alta
Reminder     id, contact_id, scheduled_at, channel (whatsapp), sent_at   confianza: media
Subscription business_id, plan, period, status, renews_at                 confianza: alta
```

Relaciones: Business 1-n Membership n-1 User (un usuario puede tener varios negocios); Business 1-n Contact, Product, Transaction, Order, Quote, Purchase; Quote 0-1 Transaction; Transaction 1-n TransactionItem; Transaction n-1 Contact; Transaction 1-n Payment; Product 1-n ProductVariant; Order 0-1 Transaction.

Saldo de un contacto = suma(transacciones a crédito) − suma(abonos). Se calcula; no se guarda.

## Matriz de funciones

Ver `features.csv`. Must: 21, should: 20, could: 8, skip: 4.

## Fuera de alcance (no se puede o no se debe clonar)

- Marca, logo, nombre, textos e ilustraciones de Treinta.
- Factura electrónica certificada (requiere habilitación como proveedor tecnológico ante DIAN/SAT); si hace falta, integrar un proveedor autorizado.
- Pagos y datáfono propios de Treinta y sus acuerdos con bancos o pasarelas.
- La base de usuarios y la red de Treinta, y cualquier dato de sus clientes.
- Cursos, comunidad y contenidos de su blog.

## Tamaño

Pantallas 28, flujos 12, entidades 16.
Partes difíciles: (1) funcionar sin conexión y sincronizar (los tenderos venden sin internet), (2) cuadrar inventario, deudas y balance cuando se editan o borran movimientos, (3) catálogo web público con pedidos y WhatsApp, más empleados con permisos.

Tamaño: **L** (un trimestre) para la app completa. El núcleo (F01–F07, sin catálogo, empleados ni web) es **M** (unas semanas).

Recomendación, ya que es para tu propio negocio: construir primero el núcleo como web app instalable (PWA). Se usa desde el móvil y desde el ordenador con el mismo código, y así la "versión web" de Pro sale gratis.
