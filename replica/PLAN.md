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
- Nombre provisional "Mi Negocio" (cambiar en `app/vite.config.ts`, `app/index.html` y `Layout.tsx`). País y moneda por defecto: México (MXN).

## Decisiones aún pendientes

- Nombre definitivo de la app.
- Cómo cotiza el usuario (por pieza, por medidas, con anticipo) y qué datos lleva de cada cliente (antes de T8).

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
- [ ] **T2 Productos e inventario.** Alta, edición y borrado de productos, fotos, código de barras, stock y cantidad mínima, alerta de stock bajo. S11, S12.
- [ ] **T3 Clientes y proveedores.** Agenda con alta, búsqueda y edición. S13, S14.
- [ ] **T4 Ventas y gastos.** Venta rápida y con productos, método de pago, gasto con categoría, descuento automático de stock, edición y borrado con efecto en stock. S04, S06, S07.
- [ ] **T5 Balance y movimientos.** Tira de días, ingresos, egresos y utilidad, lista de movimientos con filtros. S03.
- [ ] **T6 Fiados, abonos y recordatorio.** Venta fiada con cliente y fecha límite, cuentas por cobrar y por pagar, abonos parciales, recordatorio por WhatsApp (enlace `wa.me` con mensaje prellenado). S08, S09, S10.
- [ ] **T7 Comprobante.** Compartir comprobante de venta por WhatsApp o PDF. S05.

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
