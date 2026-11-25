# Plan de construcción: clon de Treinta para uso interno

Referencia: `replica/recon.md` (qué hay que construir) y `replica/features.csv` (matriz; poner `clone=yes` al terminar cada función).

## Reglas para cada sesión

- **Una tarea por sesión.** Terminar, probar, commit, y abrir sesión nueva para la siguiente. Las conversaciones largas gastan mucho más.
- **Modelo:** Sonnet para construir. Opus solo para decisiones difíciles (por ejemplo, la sincronización sin internet).
- **Al empezar:** leer este archivo, `recon.md` y `features.csv`. No releer todo el repo.
- **Al terminar:** marcar la tarea abajo con `[x]`, actualizar `features.csv`, commit y push.
- **Clean-room:** reconstruir funciones y flujos, nunca la marca, textos, logos ni ilustraciones de Treinta. Las capturas de `replica/screens/` son solo referencia y no se suben a git.
- **Saltar lo opcional:** no hacen falta `/replica-design`, `/replica-brand` ni `/replica-launch` para uso interno.

## Decisiones tomadas en T0 (cambiar solo si el usuario lo pide)

- **Local-first:** la app guarda los datos en el dispositivo (Dexie/IndexedDB) y funciona sin internet desde el principio; el servidor (Supabase) llega con T13/T15. Detalle en `replica/architecture.md`. Por eso no hay registro con cuenta en la tanda 1.
- App en `app/` (Vite + React + TypeScript + PWA). Pruebas con `npm test` dentro de `app/`.
- Nombre definitivo: **Conta** (título, manifest de la PWA y bienvenida). Los identificadores internos `mi-negocio` (base IndexedDB y marcador de las copias de seguridad) se conservan a propósito para no perder datos ni invalidar copias. País y moneda por defecto: México (MXN).

## Decisiones tomadas en T2

- Fotos guardadas en el propio producto (`photos: Blob[]`, máx. 3), recortadas a 500×500 JPEG en el dispositivo. En T15 pasan a Supabase Storage (`product.photo_paths`).
- Cantidades con hasta 3 decimales (piezas, kg, metros). El stock puede quedar negativo por ventas sin existencias; editar el producto lo conserva, pero no se puede escribir un valor negativo a mano.
- Borrar producto = borrado lógico; su código de barras queda libre.
- Escáner con la cámara solo donde existe `BarcodeDetector` (Chrome/Edge Android); en el resto se escribe el código o se usa un lector USB/Bluetooth.
- `adjustStock(productId, delta, reason, transactionId)` en `app/src/data/products.ts` es la única vía para mover stock: la usan T4 (ventas), T9 (compras) y T12 (pedidos).

## Decisiones tomadas en T3

- Cliente y proveedor comparten tabla (`contact.type`), pantallas y rutas (`/clientes`, `/proveedores`); los textos viven en `app/src/pages/contactKinds.ts`.
- Datos: nombre (obligatorio), teléfono (opcional, al menos 7 dígitos), RFC/documento y notas. Borrado lógico: ventas y deudas futuras conservan su historial.
- Teléfono guardado tal como se escribe; T6 lo normaliza para `wa.me`.
- API para T4/T6/T8: `listContacts(businessId, type, search)`, `createContact` (permite crear un cliente al vender) y `getContact` en `app/src/data/contacts.ts`. El selector de contacto dentro de la venta se construye en T4.
- Importar contactos del teléfono queda pendiente (`should`, sin soporte fiable en navegadores; ver features.csv).

## Decisiones tomadas en T4

- Las tablas Dexie son `txn` y `txnItem` (no `transaction`: Dexie ya tiene `db.transaction()`). Mismo contenido que `transaction_` / `transaction_item` del SQL.
- `app/src/data/transactions.ts`: `createSale`, `updateSale`, `createExpense`, `updateExpense`, `voidTransaction`, `listTransactions`, `getItems`, `saleProfit`. Todo lo que toca stock ocurre en una sola transacción de Dexie (si algo falla no queda nada a medias).
- Vender más de lo que hay no se bloquea: el stock queda negativo y la pantalla avisa. Al editar, lo que ya se había descontado cuenta como disponible.
- Editar una venta corrige el stock con un movimiento por la diferencia de cada producto (reason `sale`); borrarla devuelve todo con movimientos `void`. Las líneas de una venta borrada se conservan.
- Precio y costo de cada línea se congelan al vender; cambiar el precio en la venta no cambia el del producto. Cada línea se redondea una sola vez al centavo.
- Un cliente o proveedor y una categoría de gasto se pueden crear desde el propio formulario.
- Los campos `status`, `contactId` y `dueDate` ya existen en `Transaction`, pero `status` siempre es `paid`: T6 añade fiado, abonos y cuentas por pagar (hay que validar contacto obligatorio al fiar).
- `/balance` ahora es una lista simple de movimientos (S07 es `/venta/:id` y `/gasto/:id`). T5 añade tira de días, totales y filtros sobre esa misma pantalla (`Movements.tsx`).
- No hecho: descuento en la venta (`should`, sin evidencia clara en el original) ni pantalla S05 de recibo (T7); tras guardar se abre el detalle.

## Decisiones tomadas en T5

- El "día" es de medianoche a medianoche en la zona del negocio (`business.timezone`), no en la del dispositivo ni UTC. `app/src/data/dates.ts` (`dayKey`, `dayRange`, `periodRange`) lo resuelve, incluidos días de 23 y 25 horas por cambio de horario; probado con ventas a las 23:30, 00:10 y en los extremos del día.
- `app/src/data/balance.ts`: `summarizeTransactions` es el **único** lugar que define qué es ingreso. **T6 debe cambiarlo** para que una venta fiada cuente como ingreso cuando se cobra (abonos) y no al venderse, y que los gastos a crédito cuenten al pagarse.
- Utilidad = ingresos − egresos (flujo de caja). La ganancia por producto (precio − costo) sigue viéndose en el detalle de cada venta.
- Periodos: Día (con tira de la semana), Semana (lunes a domingo), Mes e Historial; el periodo y el día elegidos viven en la URL (`/balance?p=mes&d=2026-11-24`). No se navega al futuro.
- El balance siempre refleja todo el periodo; el filtro por tipo y la búsqueda solo afectan a la lista.
- No hecho: "Descargar reportes" (T10) y el rango libre de fechas (se cubre con las flechas ‹ ›).

## Decisiones tomadas en T6

- Fiado = `Transaction.status === 'credit'` (venta con cliente; gasto con proveedor), siempre con contacto obligatorio y fecha límite opcional (`YYYY-MM-DD`). El saldo no se guarda: es monto − abonos vivos (`app/src/data/debts.ts`).
- Un abono es una fila `payment` por deuda cubierta, agrupadas por `batchId`. Un abono grande se reparte entre las deudas abiertas del contacto de **la más antigua a la más reciente**. No puede superar el saldo. Anular un abono anula su `batchId` completo.
- **Balance de caja** (`summarizeTransactions`): contado cuenta el día que ocurre; fiado y gasto a crédito cuentan **solo por sus abonos/pagos**, el día en que se registran. La utilidad sigue siendo ingresos − egresos.
- Con abonos registrados: no se borra la deuda (hay que anular los abonos primero), no se baja el monto por debajo de lo abonado, ni se cambia entre contado y fiado ni de contacto. Sin abonos se puede pasar de una forma a otra. Un contacto con saldo pendiente no se puede borrar.
- "Vencida" = saldo > 0 y fecha límite anterior al día de hoy del negocio (vence hoy = aún no vencida).
- Recordatorio por WhatsApp: enlace `wa.me` (`app/src/data/reminder.ts`). México: acepta 10 dígitos, 52+10 y el antiguo 521+10; otro país necesita su prefijo en `CALLING_CODE`. Sin teléfono se abre WhatsApp para elegir el chat. Solo para clientes (por cobrar).
- Corregido de paso: las marcas de tiempo de los movimientos de stock son estrictamente crecientes (antes dos movimientos en el mismo milisegundo se ordenaban al azar en el historial).
- `/balance` muestra también los abonos y pagos como filas, y las ventas fiadas con la etiqueta "Fiada" (cantidad en gris: aún no es dinero).
- No hecho: recordatorios automáticos programados (`could`, requiere WhatsApp Business API).

## Decisiones tomadas en T7

- Tras guardar una venta **nueva** se abre el comprobante (`/venta/:id/comprobante`, S05); al editar se vuelve al detalle. El comprobante también se abre desde el detalle de cualquier venta.
- PDF generado en el propio dispositivo, sin dependencias (`app/src/data/pdf.ts`): una página tipo ticket en Courier (ancho fijo de 44 caracteres, así el ajuste de línea y las columnas a la derecha son exactos). Solo dibuja Latin-1 (acentos, ñ, ¿, ¡, ×); lo demás (emoji, otros alfabetos) sale como `?`. Validado con `pypdf` y `pdftotext` además de pruebas de estructura (desfases del xref, longitud del flujo).
- `app/src/data/receipt.ts` construye el comprobante (`buildReceipt`), el texto de WhatsApp (`receiptText`) y las líneas del ticket (`receiptLines`, mismas para la vista previa y el PDF). Una venta fiada muestra abonado y saldo pendiente.
- WhatsApp: enlace `wa.me` con el teléfono del cliente si lo tiene; si no, WhatsApp pregunta a quién enviarlo. El botón "Compartir…" (menú nativo con el PDF adjunto) solo aparece donde el navegador lo permite (móviles); en escritorio quedan WhatsApp y "Descargar PDF".
- El folio es un código corto del id de la venta (8 caracteres); no hay numeración consecutiva porque cada dispositivo puede vender sin internet. Si hace falta numeración fiscal, va con facturación electrónica (opcional).
- Corregido de paso: las líneas de una venta se guardaban sin orden (se leían por id aleatorio); ahora llevan `position` y se muestran en el orden capturado.
- No hecho: comprobante de abonos y de gastos; impresión Bluetooth (`could`).

## Copia de seguridad (hecha tras T7, parte de la tanda 1)

- `app/src/data/backup.ts` + pantalla **Más** (`/mas`): *Descargar copia* (un JSON con todas las tablas; fotos en base64) y *Restaurar una copia* (reemplaza **todo**, con confirmación). Se valida el archivo entero antes de tocar la base y la escritura es una sola transacción: un archivo dañado no cambia nada.
- Inicio avisa si hay datos y hace 7 días o más (o nunca) que no se descarga una copia. La fecha de la última copia viaja dentro del archivo.
- **Regla para tareas futuras:** toda tabla nueva de Dexie debe añadirse a `BACKUP_TABLES` (hay una prueba que falla si falta). Si cambia el formato de los datos, subir `BACKUP_VERSION` y migrar al importar.
- Trampa conocida de IndexedDB: dentro de una transacción de Dexie no se puede esperar nada que no sea de IndexedDB (p. ej. `Blob.arrayBuffer()`); la transacción se cierra sola en el navegador real aunque las pruebas en memoria pasen. Hay que leer primero y procesar después. Por eso las pruebas de flujos con fotos se completan con un recorrido en el navegador.
- Esta copia es manual. La copia automática en la nube llega con el servidor (T13/T15).

## Estado

**Tanda 1 completa** (T0–T7 + copia de seguridad). Falta solo el registro con cuenta (OTP/email/Google), que por la decisión local-first llega con T13/T15. Siguiente paso: **usar la app una semana en el negocio** y anotar qué falta o no cuadra antes de empezar T8.

## Decisiones aún pendientes

- Cotizaciones (T8): **se cotiza por pieza** (decidido). Falta saber si lleva anticipo y qué datos del cliente. Además, el usuario tiene una app de presupuestos propia cuya composición quiere fusionar dentro de Conta: hay que localizarla (no está en este GitHub ni en Drive; en Floot solo existe «Panel de Ventas»).

## (histórico) Decisiones que se plantearon en T0

Proponer una opción por defecto y confirmar con el usuario:

- Nombre de la app.
- Stack. Propuesta: app web instalable (PWA), TypeScript + React (Vite), Supabase (Postgres + autenticación), alojada en Vercel. Una sola base de código para móvil y ordenador.
- País y moneda por defecto: México (MXN).
- Cómo cotiza el usuario (por pieza, por medidas, con anticipo) y qué datos lleva de cada cliente.
- Si necesita funcionar sin internet desde el principio (afecta a la arquitectura).

## Tareas

Orden de construcción: primero lo que da valor en el negocio, y cada tarea deja la app usable.

### Tanda 1: núcleo

- [x] **T0 Arquitectura** (`/replica-architect`, versión corta). Resolver las decisiones pendientes, esquema SQL con índices y reglas de acceso, lista de rutas y estructura de carpetas. Salida: `replica/architecture.md`.
- [x] **T1 Esqueleto y acceso.** Proyecto, rutas, navegación inferior, registro e inicio de sesión, datos del negocio. Pantallas S01, S02, S03b.
- [x] **T2 Productos e inventario.** Alta, edición y borrado de productos, fotos, código de barras, stock y cantidad mínima, alerta de stock bajo. S11, S12.
- [x] **T3 Clientes y proveedores.** Agenda con alta, búsqueda y edición. S13, S14.
- [x] **T4 Ventas y gastos.** Venta rápida y con productos, método de pago, gasto con categoría, descuento automático de stock, edición y borrado con efecto en stock. S04, S06, S07.
- [x] **T5 Balance y movimientos.** Tira de días, ingresos, egresos y utilidad, lista de movimientos con filtros. S03.
- [x] **T6 Fiados, abonos y recordatorio.** Venta fiada con cliente y fecha límite, cuentas por cobrar y por pagar, abonos parciales, recordatorio por WhatsApp (enlace `wa.me` con mensaje prellenado). S08, S09, S10.
- [x] **T7 Comprobante.** Compartir comprobante de venta por WhatsApp o PDF. S05.

Al terminar la tanda 1: **usarla una semana en el negocio** y anotar qué falta o qué no cuadra antes de seguir.

### Tanda 2: ampliaciones

- [ ] **T8 Cotizaciones.** Lista por cliente, crear, vigencia, aviso de por vencer, compartir y convertir en venta. S26, S27.
- [ ] **T9 Registrar compras.** Entrada de mercancía por proveedor con costo; sube stock y crea el egreso o la deuda. S28.
- [ ] **T10 Estadísticas y reportes.** Ventas por periodo, más vendidos, gastos por categoría, descarga a Excel y PDF. S15, S16.
- [ ] **T11 Variantes de producto.** Talla, color, tamaño, con stock por variante. Pestaña "Agregar variantes" de S12.
- [ ] **T12 Catálogo público y pedidos.** Página pública del negocio, carrito, pedido por WhatsApp, gestión de pedidos con estados; un pedido pagado entra al balance y baja el stock. S17, S18, S19.

### Tanda 3: equipo y robustez

- [ ] **T13 Empleados y permisos.** Invitar, roles, qué ve cada uno, quién registró cada movimiento. S20.
- [ ] **T14 Varios negocios.** Selector de negocio en la cabecera. S21.
- [ ] **T15 Sin internet y sincronización.** Cola local de movimientos, resolución de conflictos, pruebas con la red cortada. Es la tarea más delicada: hacer primero un diseño corto (con Opus) y luego implementar.
- [ ] **T16 Pruebas y despliegue.** `/replica-test` sobre los flujos F01–F12, corregir lo que salga, publicar en el hosting y conectar el dominio.

### Opcionales (solo si hacen falta)

- Recetas e insumos, cierre de caja, impresión de tickets, importar productos desde Excel, modo oscuro, factura electrónica con un proveedor autorizado.

## Cómo medir el avance

`python3 -I -c "import csv;r=list(csv.DictReader(open('replica/features.csv',encoding='utf-8')));[print(p,sum(1 for x in r if x['priority']==p and x['clone']=='yes'),'/',sum(1 for x in r if x['priority']==p and x['clone']!='skip')) for p in ('must','should','could')]"`

Meta realista: todas las `must` en la tanda 1 y las `should` en las tandas 2 y 3.
