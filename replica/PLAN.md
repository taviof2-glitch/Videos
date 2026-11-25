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
- **Compartir como PDF o imagen** (después de T7): el comprobante y la cotización se comparten como archivo PDF o imagen PNG (`app/src/ui/ShareFiles.tsx`, imagen dibujada en un canvas por `app/src/ui/ticketImage.ts` a partir de las mismas líneas del ticket, colores fijos). En teléfonos abre el menú nativo de compartir con el archivo adjunto (así llega a WhatsApp como archivo); donde no existe (computadora, versión publicada) se descarga y hay que adjuntarlo. El enlace `wa.me` solo puede llevar texto: WhatsApp no permite adjuntar un archivo desde un enlace.
- **Reenviar después**: el detalle de cualquier venta (desde Balance o desde la deuda del cliente) tiene el botón destacado «Enviar comprobante», que abre la misma pantalla de envío. El comprobante se arma con los datos actuales: si la venta es fiada, muestra lo abonado y el saldo a la fecha.
- No hecho: comprobante de abonos y de gastos; impresión Bluetooth (`could`).

## Copia de seguridad (hecha tras T7, parte de la tanda 1)

- `app/src/data/backup.ts` + pantalla **Más** (`/mas`): *Descargar copia* (un JSON con todas las tablas; fotos en base64) y *Restaurar una copia* (reemplaza **todo**, con confirmación). Se valida el archivo entero antes de tocar la base y la escritura es una sola transacción: un archivo dañado no cambia nada.
- Inicio avisa si hay datos y hace 7 días o más (o nunca) que no se descarga una copia. La fecha de la última copia viaja dentro del archivo.
- **Regla para tareas futuras:** toda tabla nueva de Dexie debe añadirse a `BACKUP_TABLES` (hay una prueba que falla si falta). Si cambia el formato de los datos, subir `BACKUP_VERSION` y migrar al importar.
- Trampa conocida de IndexedDB: dentro de una transacción de Dexie no se puede esperar nada que no sea de IndexedDB (p. ej. `Blob.arrayBuffer()`); la transacción se cierra sola en el navegador real aunque las pruebas en memoria pasen. Hay que leer primero y procesar después. Por eso las pruebas de flujos con fotos se completan con un recorrido en el navegador.
- Esta copia es manual. La copia automática en la nube llega con el servidor (T13/T15).

## Versión de prueba publicada

- `npm run build:artifact` (en `app/`) genera `dist-artifact/conta.html` y se publica como página privada en claude.ai para probar la app desde el teléfono sin desplegar nada. Diferencias respecto a la app instalable: sin service worker (no hay modo sin conexión), navegación en memoria (al recargar vuelve al inicio), sin cámara ni menú nativo de compartir, y las descargas (PDF y copia de seguridad) salen por la capacidad `downloads` con confirmación.
- **Los datos de esa versión viven en el navegador y dispositivo donde se abre** (IndexedDB del sitio de la página). Sobreviven a las actualizaciones de la misma página, pero no se comparten entre dispositivos: para pasarlos al despliegue definitivo (T16) se usa *Descargar copia* y *Restaurar una copia*.
- `StorageGate` muestra un aviso claro si el navegador no deja guardar datos (ventana privada o datos bloqueados) en lugar de quedarse en «Cargando…».

## Estado

**Tandas 1 y 2 completas** (T0–T12 + copia de seguridad, extras de cotizaciones, compartir PDF/imagen, estadísticas y reportes, variantes, catálogo y pedidos en su versión sencilla). Faltan solo la **tanda 3** (T13–T16) y lo opcional. `must` 20/21 (falta el registro con cuenta, que llega con T13/T15) y `should` 12/20.

**Páginas de prueba publicadas** (privadas, las abre solo la dueña): Conta https://claude.ai/artifact/M1PMa81y4rYmn7LCaUtoeL y catálogo público https://claude.ai/artifact/Nu8Pdv3Pgq1GuphFW4pZwx. Para actualizarlas: `cd app && npm run build:artifact` o `npm run build:catalog` y publicar `dist-artifact/conta.html` / `catalogo.html` en la misma dirección (con `url`, desde otro chat). El catálogo declara las capacidades `artifact` y `user`; Conta, `downloads`.

**Por probar por la dueña** (no se pudo hacer desde aquí): publicar el catálogo desde su panel *Administrar*, el menú nativo de compartir en un teléfono real, y el Excel en Microsoft Excel. Si algo falla, corregirlo antes de seguir.

**Siguiente paso:** la **T15 (servidor y sincronización)**. Es la más delicada y la que deja el catálogo en vivo y varios dispositivos: empezar por un diseño corto con Opus y construir después con Sonnet. Va antes que T13 y T14, que dependen de tener cuentas y servidor. Antes de construir, decidir con la dueña: dónde alojar el servidor (el plan propone Supabase + Vercel), si cada empleado tendrá su propio teléfono, y cómo se migran los datos que ya tiene en su navegador (hoy: *Descargar copia* y *Restaurar una copia*). Reglas de diseño que ya existen y no deben romperse: ids `uuid` generados en el cliente, dinero en centavos, borrado lógico, movimientos de stock que compensan, el balance de caja en `summarizeTransactions` y que toda tabla nueva entre en `BACKUP_TABLES`. Numeración consecutiva (cotizaciones, pedidos, compras) y folios: hoy se calculan en el dispositivo y con varios dispositivos pueden repetirse; hay que resolverlo ahí.

## Decisiones tomadas para T15 (diseño)

- Diseño en `replica/sync-design.md`: Dexie sigue mandando; outbox capturado por un middleware de Dexie en la misma transacción; libro (movimientos, abonos) se une por id, documentos (padre + líneas) y entidades: gana la última escritura que llega al servidor; el borrado gana; el stock se recalcula en el dispositivo; folios definitivos los asigna el servidor al subir (provisional "P-" sin red).
- Decisiones de la dueña: **Supabase + Vercel**; **un aparato compartido en el mostrador** (+ el teléfono de la dueña; empleados con PIN en T13); **subida automática** de los datos actuales al primer inicio de sesión.
- **Hecho (pasos 1 y 2 de 7):** servidor en `app/supabase/migrations/0001_sync.sql` (una tabla `sync_row` en jsonb) y en la app `src/sync/` (outbox automático, motor de subida/descarga, recálculo de stock, subida inicial reanudable). Dexie versión 10 añade `outbox` y `syncState` (tablas solo del dispositivo: `DEVICE_TABLES`, fuera de la copia de seguridad). `Quote`/`Order` tienen `numberPending`. Aún no hay nada visible para la dueña.
- **Proyecto Supabase:** `https://opgiubxgxmzyjatexfzg.supabase.co` (us-west-2, Postgres 17). Migración `0001_sync.sql` **aplicada** el 2026-11-25 y comprobada allí (permisos, reclamar negocio, folio del servidor, descarga, otro usuario rechazado; prueba en transacción sin dejar datos). El entorno de Claude «Videos» permite ese host y `api.supabase.com`, y guarda un token personal de Supabase como secreto de red (el proxy lo inyecta; nunca va al repositorio). Para aplicar migraciones nuevas: `POST https://api.supabase.com/v1/projects/opgiubxgxmzyjatexfzg/database/query` con `{"query": "<sql>"}`. La app usará la URL y la clave *publishable* (`sb_publishable_…`, pública por diseño).
- **Hecho (paso 3):** pantalla **Cuenta y nube** (`/cuenta`, `src/pages/Account.tsx`): crear cuenta con **confirmación de correo** (decisión de la dueña; contraseña mínima 8 en la app y en Supabase), entrar, reenviar el correo, «Subir mis datos» con progreso (reanudable), conectar, y en un aparato nuevo «Entra con tu cuenta» desde la bienvenida → descargar un negocio de la cuenta. `src/sync/runner.ts` sincroniza al abrir, al volver la red o la pestaña, cada 60 s y 2 s después de cada cambio; indicador en la cabecera (Al día · Sincronizando · Sin conexión · Error) que lleva a la cuenta. Con la cuenta conectada no se puede restaurar una copia. La sesión queda guardada en el aparato. Migración `0002_my_businesses.sql` aplicada en Supabase. La versión de claude.ai se compila sin servidor (`VITE_SYNC=off`) y la pantalla lo explica.
- **Límites conocidos:** el correo de Supabase permite 2 envíos por hora; el enlace del correo redirige a `localhost:3000` hasta el despliegue (T16: poner la dirección de Vercel en *Site URL* de Supabase). La dueña no puede probar la cuenta hasta tener la app desplegada (la versión de claude.ai no habla con servidores).
- **Hecho (paso 4):** con la cuenta conectada a ese negocio (`isLinked`, fila `link` de `syncState`), `createQuote`/`createOrder` guardan `numberPending: true` y la app muestra «P-» + 6 caracteres del id (`docNumber`, `src/data/folio.ts`) en listas, detalle, formularios, PDF/texto de la cotización (el archivo se llama `cotizacion-P-XXXXXX.pdf`) y en el concepto de la venta. El número local (último + 1) se conserva solo para ordenar hasta que `sync_push` asigna el definitivo y `applyAssigned` quita la marca. Sin cuenta nada cambia. Límite conocido: el concepto de una venta creada mientras el folio era provisional conserva el «P-…» (es texto guardado). Pruebas: `folio.test.ts` y un caso nuevo en `engine.pg.test.ts` (las 249 pasan con Postgres local).
- **Hecho (paso 5):** fotos en Supabase Storage. Bucket privado `product-photos` (solo JPEG, máx. 1 MB; migración `0003_photos.sql` **aplicada** el 2026-11-25, con políticas por miembro del negocio vía `sync_photo_access`). Ruta `{negocio}/{producto}/{huella}.jpg`, donde la huella es SHA-256 del contenido: subir lo mismo dos veces es inofensivo. El producto guarda `photoPaths` (viaja como cualquier campo); los `Blob` siguen en el aparato como caché. `src/sync/photos.ts` (`syncPhotos`) corre al final de cada vuelta de `syncOnce`: si las fotos de este aparato cambiaron desde la última vez suben y se vuelve a subir el producto; si no, se descargan las del servidor (sin pasar por el outbox). Si Storage falla, los datos ya quedaron al día y el error se muestra en el indicador. Las fotos quitadas se borran de Storage (si falla, quedan huérfanas, sin consecuencia). Pruebas: 3 casos nuevos (252 en total con Postgres local); el acceso real a Storage solo se comprobó en el servidor (bucket y políticas), no con una foto subida desde un navegador.
- **Hecho (paso 6):** catálogo en vivo y pedidos automáticos. Migración `0004_live_catalog.sql` **aplicada** el 2026-11-25 (comprobada también llamando a la API pública con la clave publishable). Servidor: tabla `catalog_page` (nombre/slug único por negocio, encendido o apagado) y funciones `sync_set_catalog`/`sync_get_catalog` (solo el dueño), `public_catalog(slug)` (anon; misma forma que `CatalogData`; nunca costos, existencias ni productos ocultos) y `place_order(slug, cliente, notas, [{p,v,q}])` (anon; los **precios y nombres los pone el servidor**, el folio es el consecutivo real, límite de 5 pedidos/10 min por IP y 200/día por negocio; reutiliza `sync_apply_row`/`sync_apply_children` y el mismo candado que `sync_push`). La primera foto de cada producto visible se puede bajar sin sesión (política `product_photos_public`). Cliente: sección **Catálogo en vivo** en `/catalogo` de Conta (con la cuenta conectada: elegir nombre, encender/apagar, enlace y compartir por WhatsApp); la página pública (`catalog/main.ts`) con `?c=nombre` lee en vivo y tiene botón **Enviar pedido** (pide nombre; el WhatsApp con código `CP1` queda como alternativa); sin `?c=` y con datos incrustados funciona como antes (versión de claude.ai). Los pedidos aparecen en Pedidos con la siguiente descarga (≤ 60 s) con `source: 'catalog'`. `src/data/catalogLive.ts` (solo `fetch`, sin supabase-js) y `src/sync/config.ts` (URL y clave públicas compartidas). `npm run build:web` compila la app y deja la página pública en `dist/catalogo/` (la app instalada no la intercepta: `navigateFallbackDenylist`). Variable opcional `VITE_CATALOG_URL` para el dominio de la página. Pruebas: 265 con Postgres local (7 del servidor del catálogo, 1 de extremo a extremo con dos dispositivos, 5 del cliente) y recorrido en Chromium real con la red simulada (cargar, foto, enviar pedido, nombre obligatorio, catálogo inexistente).
- **Límites conocidos:** no hay aviso al dueño cuando entra un pedido (aparece al sincronizar); el pedido no revisa existencias (el dueño confirma, como en el flujo de WhatsApp); la IP para el límite viene del encabezado `x-forwarded-for` de Supabase; solo se muestra la primera foto de cada producto. Pendiente de probar con la app desplegada (paso 7): el enlace `/catalogo/?c=…` real y una foto real subida desde un navegador.
- **Hecho (paso 7, parte de pruebas):** los escenarios de la red cortada del diseño ya están cubiertos contra Postgres real (`engine.pg.test.ts`: dos teléfonos venden sin red → el stock baja por los dos; borrar vs. editar → gana el borrado; dos cotizaciones sin red → números distintos; subida cortada a la mitad → no se duplica nada; fotos con descarga fallida). Nuevo recorrido en Chromium real, `npm run e2e` (`scripts/e2e-offline.mjs`, tras `npm run build`): crear negocio → entrar a la cuenta → «Subir mis datos» → `context.setOffline(true)` → crear un pedido (sale «P-XXXXXX», indicador «Sin conexión», nada llega al servidor) → volver la red → el pedido sube y el folio provisional pasa a «#1». El servidor de Supabase se simula en el navegador con las mismas reglas de folios; las reglas reales las prueban los `*.pg.test.ts`.
- **Preparado para desplegar:** `app/vercel.json` (build `npm run build:web`, salida `dist`, la app como SPA y la página pública en `/catalogo/`). En Vercel: importar el repositorio con **Root Directory = `app`**. **No se desplegó**: falta la cuenta de Vercel (la crea la dueña; el token llegaría por el formulario seguro de credenciales y hay que permitir `api.vercel.com` en la red del entorno «Videos»).
- **Pendiente tras el primer despliegue** (parte de T16): poner la dirección de Vercel en *Site URL* y *Redirect URLs* de Supabase Auth (hoy el correo de confirmación redirige a `localhost:3000`); probar a mano el enlace real `/catalogo/?c=nombre`, una foto subida desde el navegador y la instalación como app en el teléfono.
- **Desplegado (2026-11-25):** proyecto Vercel `conta-app` (equipo del usuario `taviof2-glitch`, plan Hobby), producción en **https://conta-app-pi.vercel.app** (subida directa con `npx vercel deploy --prod` desde `app/`, build en Vercel con `npm run build:web`; el token está como secreto de red del entorno «Videos» y el entorno permite `api.vercel.com` y ese dominio). `app/.vercel/` (enlace local al proyecto) está en `.gitignore`. Aún **no está conectado a Git**: cada cambio se publica con `cd app && npx vercel deploy --prod --yes --token proxyinjected` (el token real lo pone el proxy) o conectando el repositorio desde el panel de Vercel.
- **Pendiente para que lo use la dueña:** (1) ~~Deployment Protection~~: **desactivada** a petición del usuario (Vercel Authentication = Disabled); la app, `/pedidos` y `/catalogo/` responden 200 sin sesión. (2) Poner `https://conta-app-pi.vercel.app` en *Site URL* y *Redirect URLs* de Supabase Auth. (3) Probar a mano el enlace `/catalogo/?c=nombre`, una foto real y la instalación en el teléfono. (4) Opcional: activar la verificación en dos pasos de Vercel.
- **Siguiente:** cerrar los pendientes de arriba (T15 se da por hecha con la prueba real) y seguir con T16.

## Decisiones tomadas en T8

- **Se cotiza por pieza** (cantidad × precio unitario, con unidad; pieza por defecto). Como extra, una línea sin inventario puede cobrarse **por área** (ancho × alto × piezas, precio por m²); en líneas del inventario no se permite porque el stock se mide en las unidades del producto.
- **Composición fusionada desde la app de presupuestos del usuario** (ficha de Google Play; ver `replica/reference-presupuestos.md`): lista con pestañas y tarjetas, formulario con artículos del inventario o libres, IVA opcional con tasa editable, PDF compartible, y detalle de pago al convertir. Solo se copian funciones y composición, nunca marca, textos ni imágenes.
- `app/src/data/quotes.ts`: `createQuote`, `updateQuote`, `setQuoteStatus`, `deleteQuote`, `convertQuote`, `quoteState`, `quoteTotals`. Tablas `quote` y `quoteItem` (ya incluidas en la copia de seguridad).
- Número consecutivo por negocio que no se reutiliza al borrar. **Con varios dispositivos habrá que revisarlo en T15** (dos dispositivos sin internet podrían dar el mismo número).
- Totales guardados al guardar: subtotal, IVA (un solo redondeo sobre el subtotal, en puntos base) y total. Los precios no cambian aunque cambie el inventario.
- Vigencia con fecha (15 días por defecto). Estados `pending`, `accepted`, `rejected`, `converted`; "por vencer" (3 días o menos) y "vencida" se calculan con la fecha, no se guardan. Inicio y la lista avisan de las que necesitan atención.
- **Convertir en venta** (`convertQuote`): crea una venta con los mismos artículos y precios, el IVA como una línea más (con costo igual a su precio para que no cuente como ganancia), descuenta stock y deja la cotización `converted` con su `transactionId`. Contado, o fiado con **anticipo opcional** que entra como abono de esa venta (nuevo `transactionId` en `addPayment`, para que no se reparta entre deudas más viejas). Todo en una transacción: si algo falla no queda nada. Una cotización convertida no se edita ni se borra; si se borra la venta, la cotización sigue marcada como convertida (pendiente de decidir si debe reabrirse).
- Aviso al convertir si un producto no alcanza en inventario (se puede continuar; el stock queda negativo, igual que en una venta normal).
- Corregido de paso: `isValidDayKey` valida fechas reales (`2026-13-01` lanzaba "Invalid time value"); la fecha límite de fiados usa la misma función.
- No hecho: duplicar cotización, descuento global (solo hay por línea), firma del cliente.

## Extras de cotizaciones (tras T8)

- **Descuento por artículo** en % o en monto (`discountType`/`discountValue` en `quoteItem`); un solo redondeo por línea y nunca más que el importe. El IVA se calcula sobre el subtotal ya sin descuentos. La venta también admite descuento por línea (`TransactionItem.discountCents`, helper `lineNet`): así, al convertir, el total de la venta coincide con el de la cotización al centavo. En el formulario de venta el descuento se conserva y se puede quitar, pero todavía no se captura directamente allí.
- **Por área (m²)**: `billedQuantity` = ancho × alto × piezas redondeado a 3 decimales. En la venta, la línea pasa con sus m² como cantidad y las medidas en el nombre ("Puerta (3 pza de 0.9 × 2 m)").
- **Condiciones de pago en la cotización**: `advanceCents` (con atajos 30 % / 50 % del total) y `payBy` (fecha estimada de pago). No puede superar el total. Aparecen en el PDF y en el texto de WhatsApp (anticipo, saldo y fecha) y se proponen al convertir (fiado + anticipo como abono de esa venta + fecha límite).
- **PDF en hoja carta**: `LETTER_PAPER` en `app/src/data/pdf.ts` (612 × 792 pt, 80 columnas a 11 pt) con paginación y "Página i de n" cuando no cabe en una hoja. El comprobante sigue siendo un ticket de una página.

## Decisiones tomadas en T9

- `app/src/data/purchases.ts`: `createPurchase`, `voidPurchase`, `listPurchases`/`listPurchaseRows`, `weightedCost`. Tablas `purchase` y `purchaseItem` (ya en la copia de seguridad). Pantallas: `/compras` (lista), `/compras/nueva` (S28), `/compras/:id` (detalle y anular). Se llega desde Inventario ("Registrar compra" y "Ver compras") y desde Inicio.
- Una compra crea **un gasto** (`txn` con `purchaseId`) por el total, en la categoría "Compras de mercancía" (se crea sola): **al contado** cuenta como egreso el día de la compra; **a crédito** (exige proveedor) crea la deuda por pagar y solo cuenta cuando se paga, igual que cualquier gasto a crédito. Sube el stock con movimientos `purchase`.
- **Costo del producto = promedio ponderado** entre lo que hay y lo que entra (un solo redondeo); sin existencias, o en negativo, el costo es el de la compra. El precio de venta no cambia. Las ventas ya hechas conservan el costo con que se vendieron.
- Todo en una transacción: si un producto falla no queda compra, ni stock, ni gasto.
- **No se edita, se anula y se vuelve a registrar.** El gasto de una compra no se puede editar ni borrar directamente (ni por URL: el formulario muestra un aviso y los datos lo rechazan); se hace desde la compra.
- Anular: el stock baja con movimientos `void`, el costo del producto se restaura **solo si nadie lo ha cambiado desde entonces**, y se anula el gasto. Puede dejar el stock en negativo si ya se vendió lo comprado. Si es a crédito y ya tiene pagos, primero hay que anular los pagos.
- Solo se compran productos del inventario (sin líneas libres): lo que se compra y no es mercancía va como gasto normal.
- Pendiente: variantes de producto (T11) cuando existan; la compra deberá escoger variante.

## Decisiones tomadas en T10

- Pantalla `/estadisticas` (S15 y S16), con acceso desde Inicio, Balance y Más. Periodos **Semana, Mes y Año** con flechas (sin futuro); el día es el del negocio, como en el Balance.
- `app/src/data/stats.ts` (`computeStats`): dos miradas distintas y rotuladas. **Ventas registradas** = lo vendido en el periodo, incluidas las fiadas (con número de ventas y ticket promedio); **Cobrado / Pagado / Utilidad** = flujo de caja, idéntico al Balance. **Ganancia de productos** = precio − costo de las ventas con productos (las ventas rápidas no tienen costo y no cuentan). Más vendidos por importe (solo productos del inventario), gastos registrados por categoría con su porcentaje, y lo cobrado por método (ventas de contado + abonos).
- Gráfica: una sola serie (ventas por día, o por mes en el año), columnas de máx. 24 px con punta redondeada, escala redonda (`niceScale`), valor al tocar cada columna y "Ver como tabla". **No se compara ventas contra gastos en una misma gráfica con verde y rojo**: el validador de colores lo descarta porque con daltonismo deuteranope casi no se distinguen; esos totales van como cifras.
- **Reporte en Excel** (`app/src/data/xlsx.ts`, sin dependencias: ZIP sin comprimir + SpreadsheetML mínimo, CRC-32 propio) con hojas Resumen, Ventas, Productos vendidos, Gastos, Cobros y pagos, e Inventario (el de hoy); dinero con formato `#,##0.00`, encabezado fijo en negritas, fechas como texto `AAAA-MM-DD HH:mm` en la zona del negocio. Validado con `openpyxl` y convertido con LibreOffice. **Reporte en PDF** (hoja carta) con el resumen, ventas por día/mes, más vendidos, gastos por categoría y cobrado por método.
- Corregido de paso: el signo "−" ahora se escribe como "-" en los PDF (antes salía "?"), y los títulos de periodo ya no ponen mayúscula a cada palabra ("Noviembre de 2026", también en el Balance).
- No hecho: comparar contra el periodo anterior, rango libre de fechas, filtro por cliente o producto en estadísticas.

## Decisiones tomadas en T11

- Tabla `productVariant` (en la copia de seguridad): una fila por combinación de hasta **2 atributos** (p. ej. Acabado × Tamaño, máx. 60 combinaciones), con stock, mínimo, código de barras y precio/costo propios opcionales (vacío = los del producto). `app/src/data/variants.ts`: `setVariantAttributes`, `updateVariant`, `removeVariants`, `listVariants`.
- **Invariante de stock**: el `stock` del producto es la suma de todos sus movimientos y el de cada variante la suma de los movimientos con su `variantId`; por eso listas, alertas y valuaciones siguen usando el total del producto. `adjustStock` exige variante en productos con variantes.
- La primera vez que se crean variantes, el stock que tenía el producto pasa a la primera variante (con movimientos) y la pantalla pide repartirlo. Cambiar atributos conserva las combinaciones existentes (mismo id y stock), crea las nuevas en 0 y solo quita las que están en 0. Quitar todas las variantes exige que estén en 0.
- Las variantes se agregan a un producto ya guardado (pestaña «Variantes» de S12). Con variantes, el stock y el mínimo del producto no se editan en «Información general».
- Ventas, compras y cotizaciones exigen escoger variante: el buscador muestra cada variante como opción («Librero · Nogal / Grande») con su precio, costo y stock, y busca por palabras («nogal ch»); un lector de códigos encuentra la variante por su código. La línea guarda `variantId` y el nombre «Librero (Nogal / Grande)». Editar o anular una venta corrige la variante correcta.
- Compras: el costo promedio ponderado se lleva por variante (queda como costo propio de la variante); anular lo restaura si no cambió.
- Estado de stock con variantes: agotado si se acabaron todas; «stock bajo» si alguna está baja o agotada. Más vendidos agrupa por producto; el Excel lleva una fila por variante (productos vendidos e inventario).
- Corregido de paso: el atributo `hidden` ya no lo anula un `display` de clase (regla global), y el motivo «void» del historial se llama «Anulación» (sirve para ventas y compras).
- No hecho: crear variantes en el mismo paso que el producto, fotos por variante, más de 2 atributos.

## Decisiones tomadas en T12 (versión sencilla)

- **Por qué es una «foto» y no un catálogo en vivo:** los datos de Conta viven solo en el navegador del dueño, y un visitante no puede leerlos. El catálogo público es una página aparte con una **copia** de los productos visibles, metida dentro de ella. Hasta que haya servidor (T15), los precios y las existencias del catálogo solo cambian cuando el dueño lo vuelve a publicar.
- **Publicar sin pasar por Claude:** Conta → Catálogo → *Descargar catálogo* (JSON, fotos reducidas a 360 px) → abrir la página del catálogo → *Administrar* (solo lo ve quien puede publicar esa página) → elegir el archivo → *Publicar*. La página se republica a sí misma con la capacidad `artifact` (`renderDocument` en `app/catalog/main.ts` repite el formato exacto de la plataforma: `RESET` copiado de una página publicada). **Esa llamada real no se pudo probar fuera de claude.ai** (en las pruebas se simuló); si fallara, la alternativa es pedirle a Claude que publique el archivo descargado.
- **Compartir:** la página nace privada. Hay que abrir su menú *Compartir* y permitir verla con el enlace; eso no lo puede hacer Claude. El enlace se guarda en Conta (Catálogo) para mandarlo por WhatsApp.
- **Qué ve el cliente** (`app/src/data/catalogFormat.ts`): nombre, descripción, categoría, precio, foto y «Agotado». **Nunca** el costo ni el número de piezas. `parseCatalog` limpia el archivo antes de publicarlo (textos acotados, precios enteros, solo imágenes JPEG, ids válidos) y la página escapa todo lo que muestra.
- **Pedido del cliente:** carrito en la página (se recuerda en su navegador), nombre y notas, y un enlace `wa.me` al teléfono del negocio con el mensaje del pedido. El mensaje trae un **código** (`CP1.<datos>.<CRC>`, definido solo en `app/src/data/orderCode.ts`: ids cortos de 8 caracteres, productos en una cadena compacta; 40 productos caben en < 2 000 caracteres). Los agotados no se pueden pedir. Una variante sin opción elegida o un producto que ya no está en el catálogo se ignoran.
- **Pedidos en Conta** (`app/src/data/orders.ts`, pantallas `/pedidos`): *Pegar pedido de WhatsApp* lee el código (avisa si está cortado, dañado o no hay) y arma el pedido con los precios que vio el cliente (avisa si hoy cambiaron); también se captura a mano. Estados: pendiente, en proceso, pagado, cancelado. **Cobrar** crea una venta de contado con `orderId` (entra al balance y baja el inventario, por variante si la hay) y abre el comprobante; **cancelar un pedido pagado** anula esa venta y devuelve el inventario; un cancelado se puede reabrir. La venta de un pedido no se edita ni se borra por fuera (se hace desde el pedido, igual que las compras).
- Se agregaron al producto `description` y `visibleInCatalog` (casilla «Mostrar en el catálogo»).
- `npm run build:catalog` genera `dist-artifact/catalogo.html` (lleva su propia hoja de estilos con tema claro y oscuro; el script de compilación falla si falta). Sin Conta ni base de datos dentro (112 KB).
- No hecho: catálogo que se actualiza solo, vista en lista, «ordenar por», pago en línea, aviso al cliente de que su pedido cambió de estado, fotos por variante en el catálogo, varios catálogos.

## Decisiones aún pendientes

- Si al borrar la venta de una cotización convertida, la cotización debe volver a pendiente.
- Si se necesita numeración consecutiva fiable entre dispositivos (cotizaciones y comprobantes): se resuelve con la sincronización (T15).

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

- [x] **T8 Cotizaciones.** Lista por cliente, crear, vigencia, aviso de por vencer, compartir y convertir en venta. S26, S27.
- [x] **T9 Registrar compras.** Entrada de mercancía por proveedor con costo; sube stock y crea el egreso o la deuda. S28.
- [x] **T10 Estadísticas y reportes.** Ventas por periodo, más vendidos, gastos por categoría, descarga a Excel y PDF. S15, S16.
- [x] **T11 Variantes de producto.** Talla, color, tamaño, con stock por variante. Pestaña "Agregar variantes" de S12.
- [x] **T12 Catálogo público y pedidos** (versión sencilla; la automática llega con T15). Página pública del negocio, carrito, pedido por WhatsApp, gestión de pedidos con estados; un pedido pagado entra al balance y baja el stock. S17, S18, S19.

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
