# Arquitectura: clon de Treinta (uso interno)

Lee `recon.md` y `features.csv`. Plan de tareas en `PLAN.md`.

## Decisión clave: local-first

La app guarda los datos **en el dispositivo** (IndexedDB) y funciona sin internet desde el primer día. La sincronización con un servidor (varios dispositivos, empleados) se añade después (T13 y T15) sin reescribir pantallas, porque todo el acceso a datos pasa por una capa de repositorios.

Por qué: un tendero vende sin internet, no necesita cuentas en servicios externos para empezar y el núcleo se puede usar y probar de inmediato. Coste: copias de seguridad y varios dispositivos quedan para la tanda 3. Mientras tanto, T5/T7 incluyen **exportar/importar copia de seguridad** para no perder datos.

## Stack

| capa | elección | por qué |
| --- | --- | --- |
| app | Vite + React + TypeScript | sencillo, rápido, sin servidor |
| instalable | PWA (`vite-plugin-pwa`) | un solo código para móvil y ordenador; funciona sin conexión |
| rutas | `react-router` | navegación inferior y detalle |
| datos locales | Dexie (IndexedDB) | consultas por índice, transacciones, `liveQuery` para pantallas reactivas |
| estilos | CSS propio con variables | sin dependencias; tokens de color y espaciado propios (no los de Treinta) |
| pruebas | Vitest + `fake-indexeddb` | lógica de saldos y stock probada sin navegador |
| servidor (T13/T15) | Supabase (Postgres + Auth + Storage) | sincronización, empleados, copia en la nube |
| hosting | Vercel (estático) | despliegue gratis de la PWA |

Sin ORM, sin microservicios, sin backend propio en la tanda 1.

## Reglas de datos

- IDs `uuid` generados en el cliente (`crypto.randomUUID()`), para poder sincronizar luego sin choques.
- Dinero como **entero en centavos** + código de moneda del negocio. Nunca decimales.
- Fechas como ISO UTC (`string`); día de negocio calculado en la zona horaria del negocio.
- Cada fila lleva `createdAt`, `updatedAt`, `deletedAt?` (borrado lógico) y `businessId`: así sirve para sincronizar y para varios negocios (T14).
- **Saldos y stock se derivan de movimientos**, no se guardan sueltos: saldo de un contacto = fiados − abonos; stock = suma de `StockMovement`. El campo `stock` del producto es una caché que solo cambia dentro de la misma transacción que crea el movimiento.
- Editar o borrar una venta genera movimientos compensatorios; nunca se reescribe el historial de stock.

## Tablas (Dexie) y equivalente SQL

Esquema SQL para el servidor futuro en `replica/schema.sql`. Tablas locales (índices entre corchetes):

| tabla | índices | notas |
| --- | --- | --- |
| business | id | nombre, categoría, país, moneda, zona horaria, teléfono, horario, dirección |
| contact | id, [businessId+type], name, phone | `type` = customer \| supplier |
| category | id, [businessId+kind] | `kind` = product \| expense |
| product | id, [businessId+name], barcode, categoryId | precio y costo en centavos, `stock`, `minStock`, fotos (blobs) |
| productVariant | id, productId | T11 |
| transaction | id, [businessId+date], [businessId+type], contactId, status | `type` = sale \| expense; `status` = paid \| credit; `dueDate?` |
| transactionItem | id, transactionId, productId | cantidad, precio y costo unitarios al momento de vender |
| payment | id, transactionId, contactId, date | abonos |
| stockMovement | id, productId, transactionId | `delta`, `reason` = sale \| purchase \| adjust \| order \| void |
| quote, quoteItem | id, [businessId+status], contactId | T8 |
| purchase | id, supplierId | T9 |
| order | id, [businessId+status] | T12 |
| syncQueue | id++ | T15: operaciones pendientes |

Restricciones que se comprueban en la capa de repositorio (dentro de una transacción Dexie):

- No se vende más del stock disponible salvo que el negocio lo permita (ajuste de negocio, por defecto sí avisa y deja continuar).
- Un abono no puede superar el saldo pendiente.
- Borrar un producto con movimientos lo archiva (`deletedAt`), no lo elimina.

## Capa de repositorios (la interfaz que no cambia al añadir servidor)

`src/data/` expone funciones puras sobre Dexie: `sales.create`, `sales.void`, `expenses.create`, `contacts.*`, `products.*`, `payments.add`, `balance.forRange`, `debts.byContact`, `backup.export/import`. Las pantallas **solo** usan esta capa. En T15 se añade `syncQueue` dentro de cada escritura.

## Rutas (pantallas del recon)

| ruta | pantalla | flujo | tarea |
| --- | --- | --- | --- |
| `/bienvenida`, `/negocio/nuevo` | S01, S02 | F10 | T1 |
| `/` | S03b inicio con accesos | F10 | T1 |
| `/balance` | S03 | F07 | T5 |
| `/venta/nueva`, `/venta/:id` | S04, S05, S07 | F01, F02 | T4 |
| `/gasto/nuevo` | S06 | F05 | T4 |
| `/deudas`, `/deudas/:contactId`, `/deudas/:contactId/abono` | S08, S09, S10 | F03, F04 | T6 |
| `/inventario`, `/inventario/nuevo`, `/inventario/:id` | S11, S12 | F06 | T2 |
| `/clientes`, `/proveedores` | S13, S14 | | T3 |
| `/cotizaciones`, `/cotizaciones/nueva` | S26, S27 | F11 | T8 |
| `/compras/nueva` | S28 | F12 | T9 |
| `/estadisticas`, `/reportes` | S15, S16 | F07 | T10 |
| `/ajustes` | S21 | | T1 y T14 |

Navegación inferior: Inicio, Balance, Deudas, Inventario, Más.

## Lo que muerde (y cómo se maneja)

1. **Cuadrar saldos y stock al editar o borrar**: movimientos compensatorios + pruebas automáticas con casos de edición, borrado y abono (Vitest).
2. **Redondeo de dinero**: enteros en centavos; los porcentajes de descuento se redondean una sola vez, al total.
3. **Zona horaria**: el "día" del balance usa la zona del negocio; se prueba con ventas cerca de medianoche.
4. **Copia de seguridad**: IndexedDB puede borrarse (limpieza del navegador). Exportar/importar JSON desde la tanda 1 y pedir almacenamiento persistente (`navigator.storage.persist()`).
5. **WhatsApp**: solo enlaces `https://wa.me/<tel>?text=...`; sin API de pago. Los recordatorios automáticos programados quedan como opcionales.
6. **Sincronización (T15)**: cola de operaciones + "última escritura gana" por campo, con marca `updatedAt`; el diseño se hace primero con Opus.
7. **Fotos**: se reducen a 500×500 antes de guardarlas (como en el original: máx. 2 MB por imagen, hasta 3).

## Orden de construcción

Sigue `PLAN.md`: T1 esqueleto → T2 inventario → T3 contactos → T4 ventas/gastos → T5 balance → T6 fiados → T7 comprobante. Rebanada vertical inicial (al final de T4): registrar un producto, venderlo y ver el stock bajar.

## Diseño visual propio

Se mantiene la idea de interfaz móvil con cabecera de color, botones verde "Nueva venta" y rojo "Nuevo gasto", pero con **paleta, tipografía e iconos propios**. Nada de la marca de Treinta (amarillo/azul marino exacto, logo, ilustraciones 3D, textos).
