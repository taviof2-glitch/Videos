# T15: diseño corto de servidor y sincronización

Lee antes `PLAN.md` (Estado y decisiones T0–T12) y `architecture.md`. Este documento fija **cómo** se sincroniza; las tres decisiones de la dueña están al final y se rellenan antes de construir.

## Objetivo y límites

- Conta sigue siendo **local-first**: todo se escribe primero en Dexie y la app funciona igual sin red. El servidor es una réplica que une dispositivos, guarda copia en la nube y sirve el catálogo en vivo.
- Cubre: cuenta del dueño, subida de los datos actuales, varios dispositivos del mismo negocio, fotos en la nube, catálogo público leído del servidor y pedidos que llegan solos.
- **No** cubre (quedan para T13/T14): invitar empleados, roles y permisos por pantalla, varios negocios por cuenta. El esquema ya deja sitio para ellos (`business_member` con rol).
- La versión de prueba en claude.ai sigue siendo solo local (no puede hablar con un servidor externo).

## Reglas que no se rompen

ids `uuid` del cliente · dinero en centavos · borrado lógico · stock = suma de movimientos (compensatorios, nunca se reescriben) · el balance solo en `summarizeTransactions` · toda tabla nueva de Dexie entra en `BACKUP_TABLES`.

## Modelo: tres clases de datos

| clase | tablas | cómo se une | conflicto posible |
| --- | --- | --- | --- |
| **Libro** (solo se añade) | `stockMovement`, `payment` (anular = `deletedAt`, que solo puede ponerse) | unión por id | ninguno: dos dispositivos suman, no se pisan |
| **Documento** (padre + líneas) | `txn`+`txnItem`, `quote`+`quoteItem`, `order`+`orderItem`, `purchase`+`purchaseItem` | el padre viaja con **todas** sus líneas; el servidor reemplaza el juego de líneas entero | dos ediciones del mismo documento: gana la última que llega al servidor |
| **Entidad** | `business`, `contact`, `category`, `product`, `productVariant` | fila completa | igual: gana la última que llega |

- **El borrado gana**: una fila con `deletedAt` en el servidor no se "revive" por una edición que llega después; esa edición se descarta y el dispositivo recibe la fila borrada.
- **Cachés derivadas no mandan**: `product.stock` y `productVariant.stock` se **recalculan en el dispositivo** a partir de los movimientos tras cada descarga (el valor del servidor se ignora). Así, dos ventas sin internet en dos teléfonos descuentan las dos.
- **Costo promedio ponderado** (T9): si dos teléfonos registran compras del mismo producto sin internet, gana el último costo que llega (diferencia de centavos, aceptable). Lo dejo anotado; no merece más maquinaria.
- **Abonos sin red**: dos teléfonos pueden abonar a la misma deuda y pasar del saldo. No se bloquea (no se puede sin red): la deuda muestra **saldo a favor** y aviso. Pasa muy poco en una sola tienda.
- Por qué "última que llega" y no "última hora del teléfono": los relojes de los teléfonos mienten; el orden de llegada al servidor es único y verificable. Por campo (lo que decía `architecture.md`) es más fino pero complica mucho y no se justifica con un solo negocio.

## Cómo viajan los cambios

**En el dispositivo** — un *middleware* de Dexie (DBCore) envuelve cada transacción de escritura:
1. añade la tabla `outbox` al alcance de la transacción y anota en ella qué filas cambiaron (tabla + id), **en la misma transacción** (si la escritura falla, no queda nada en la cola);
2. no hay que tocar las ~60 escrituras existentes en `src/data/`: la captura es automática. Los documentos se resuelven al subir (se lee el padre y sus líneas actuales).
3. tablas nuevas: `outbox` (`++seq, table, rowId, txGroup`) y `syncState` (cursor de descarga, cuenta, último envío). `outbox` y `syncState` **no** van en la copia de seguridad (se añaden a una lista de exclusión explícita que la prueba de `BACKUP_TABLES` respeta).

**Subida** (`push`): agrupa lo pendiente por transacción local y llama una función de Postgres `push_changes(batch jsonb)` que lo aplica **todo o nada** en una transacción, con las reglas de arriba, y devuelve lo que el servidor asignó (folios). Se borra de `outbox` solo lo confirmado.

**Descarga** (`pull`): cada fila del servidor lleva `rev bigint` (secuencia global puesta por un *trigger* en cada escritura). El dispositivo pide `rev > cursor` por tabla del negocio, en páginas de 500, y lo escribe en Dexie **sin pasar por el outbox**. Al final recalcula stock de los productos tocados. Si una fila tiene cambios propios aún sin subir, primero se sube y luego se descarga.

**Cuándo**: al abrir la app, al volver la conexión (`online`), cada 60 s con la app abierta y justo después de cada escritura (con 2 s de espera para agrupar). Sin red no pasa nada: la cola crece y se vacía después.

**Indicador**: un punto en la cabecera — al día · N cambios sin subir · sin conexión · error (tocar para ver el motivo y reintentar).

## Folios y números consecutivos

Cotizaciones, pedidos y (si se quiere) comprobantes tienen número por negocio. Sin red dos teléfonos darían el mismo.
- **Sin red** el documento se guarda con número **provisional** ("P-" + código corto del id). Se puede compartir igual; el PDF lleva ese código.
- **Al subir**, `push_changes` asigna el siguiente número real con un contador por negocio y tipo (`business_counter`, con bloqueo de fila) y lo devuelve; el dispositivo lo guarda.
- Con red el número aparece en uno o dos segundos, así que en el uso normal nadie ve el provisional.
- Los números ya existentes se conservan al subir por primera vez; el contador arranca en el máximo + 1.

## Servidor (Supabase, si se confirma la decisión 1)

- **Postgres** (`app/supabase/migrations/0001_sync.sql`): **una sola tabla `sync_row`** con las filas de Dexie tal cual en `data jsonb` (más `business_id`, `tbl`, `id`, `parent_id`, `deleted_at`, `rev`). Cambio respecto a `schema.sql`: así un campo nuevo en la app no exige migrar el servidor y la réplica no puede desalinearse de `types.ts`. `schema.sql` queda como referencia histórica.
- **Funciones**: `sync_push(negocio, cambios)` (todo o nada; un envío a la vez por negocio con un candado, para que los `rev` sigan el orden de confirmación), `sync_pull(negocio, cursor, límite)`, `sync_business_status` y `sync_claim_business`. Si el servidor descarta un cambio (fila borrada, o libro ya anulado) vuelve a emitir la fila para que el dispositivo se corrija.
- **Acceso (RLS)**: `business_member(business_id, user_id, role)`. El navegador **nunca** lee ni escribe las tablas directamente: solo vía esas funciones (que validan pertenencia y reglas). En T15 el único rol es `owner`.
- **Cuenta**: Supabase Auth con correo y contraseña (o enlace mágico). Sin SMS (cuesta).
- **Fotos**: bucket privado `product-photos/{businessId}/{productId}/{n}.jpg`; se suben aparte de los datos (cola propia, reintento) y el producto guarda `photoPaths`. En el dispositivo se conservan los `Blob` como caché, así que todo sigue funcionando sin red.
- **Catálogo en vivo**: una función pública `public_catalog(slug)` devuelve solo nombre, descripción, precio, foto y agotado (nunca costo ni piezas: misma regla que `catalogFormat.ts`). Los pedidos entran con `place_order(slug, …)` (con límite por IP) y aparecen solos en Conta en la siguiente descarga. El enlace de WhatsApp con código `CP1` se mantiene como alternativa.
- **Copia automática**: la propia réplica en el servidor + copias diarias de Supabase. *Descargar copia* sigue disponible.

## Primera conexión (migración de los datos actuales)

Depende de la decisión 3. Propuesta: al iniciar sesión por primera vez en un dispositivo con datos,
- si el negocio aún no existe en el servidor → "Subir mis datos" sube todo (los ids ya son `uuid`, no hay que traducir nada) en lotes, con barra de progreso y reanudable;
- si ya existe y este dispositivo está vacío → descarga todo;
- si ya existe **y** este dispositivo tiene otros datos → no se mezclan a ciegas: se ofrece descargar una copia de lo local y reemplazarlo por lo del servidor.

## Cómo correr las pruebas del servidor

Las pruebas `*.pg.test.ts` necesitan un Postgres 16 y se saltan sin él. En el contenedor:
`D=/var/lib/postgresql/conta; su postgres -s /bin/sh -c "/usr/lib/postgresql/16/bin/initdb -D $D/data -A trust -U postgres && /usr/lib/postgresql/16/bin/pg_ctl -D $D/data -o '-p 54329 -k $D' -l $D/log start"` (la primera vez; después solo `pg_ctl … start`) y luego `SYNC_PG_URL=postgresql://postgres@localhost:54329/postgres npm test` en `app/`. Cada archivo crea y borra su propia base.

## Pruebas (lo que tiene que pasar antes de dar T15 por hecha)

- Unitarias (Vitest + `fake-indexeddb`): captura en el outbox dentro de la misma transacción y nada si la transacción falla; reglas de unión (borrado gana, documento con líneas reemplazadas, recalcular stock).
- Contra un **Postgres real** (en el contenedor hay `psql`/`docker`): `push_changes` y `pull` con dos "dispositivos" simulados.
- Escenarios con la red cortada: 2 teléfonos venden el mismo producto sin red → stock baja por las dos; uno borra un cliente y el otro lo edita → queda borrado; dos cotizaciones sin red → números distintos al subir; subida cortada a la mitad → al reintentar no se duplica nada (todo es idempotente por id).
- Recorrido en el navegador (Playwright) con `context.setOffline(true)`.

## Orden de construcción (sesiones con Sonnet)

1. ✅ Esquema SQL + RLS + `sync_push`/`sync_pull` y pruebas contra Postgres local (`src/sync/server.pg.test.ts`).
2. ✅ Outbox (`src/sync/outbox.ts`, middleware de Dexie a nivel -2, por debajo de los de Dexie), motor (`src/sync/engine.ts`: `push`, `pull`, `syncOnce`, `uploadAll`) y recálculo de stock; pruebas con dos dispositivos contra Postgres (`engine.pg.test.ts`) y recorrido en Chromium real.
3. ✅ Cuenta (inicio de sesión con confirmación de correo), primera conexión/migración, aparato nuevo e indicador de estado (`src/sync/runner.ts`, `src/sync/supabase.ts`, `src/pages/Account.tsx`).
4. ✅ Folios definitivos: provisionales «P-…» con la cuenta conectada (`src/data/folio.ts`), número real del servidor al subir.
5. ✅ Fotos en Storage (`src/sync/photos.ts`, migración `0003_photos.sql`; ruta por huella del contenido en lugar de `{n}.jpg`).
6. ✅ Catálogo en vivo y pedidos automáticos (`0004_live_catalog.sql`, `src/data/catalogLive.ts`, `catalog/main.ts`). El nombre de la página es un `slug` en `catalog_page`; los precios de un pedido los fija el servidor.
7. ◐ Pruebas con la red cortada ✅ (`npm run e2e` y los `*.pg.test.ts`); desplegado en https://conta-app-pi.vercel.app (ver `PLAN.md`: falta desactivar Deployment Protection y configurar Supabase Auth).

Cada paso deja la app usable; hasta el 3 nadie ve cambios.

## Decisiones de la dueña (2026-11-25)

1. **Servidor: Supabase + Vercel.** La dueña crea las cuentas; las claves llegan por el formulario seguro de credenciales, nunca por el chat ni en el repositorio. Mientras tanto se construye y prueba contra un Postgres local.
2. **Un aparato compartido en el mostrador** (más el teléfono de la dueña). Lo normal son 2 dispositivos, rara vez a la vez sin red: el modelo de arriba basta y no hace falta unión por campo. Consecuencias: la sesión del aparato compartido queda abierta (no se pide contraseña cada vez); en T13 los empleados se identificarán con **PIN en el mismo aparato** (cada movimiento guardará quién lo registró), no con cuentas propias.
3. **Migración: subida automática.** «Subir mis datos» al iniciar sesión por primera vez en el aparato que tiene los datos (ver *Primera conexión*). Desde la versión de claude.ai: *Descargar copia* → *Restaurar una copia* en la app desplegada → subir.
