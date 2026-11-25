# Referencia: app de presupuestos (Google Play) → módulo Cotizaciones de Conta

Fuente: ficha pública de Google Play `com.francelsanchez.generadorpresupuesto` («Plantilla Presupuesto Clientes»; descripción corta: «Crea presupuestos, cotizaciones y compártelas con tus clientes»). Solo se vio la ficha (descripción y capturas, guardadas en `replica/screens/`, que no se sube a git); no se tiene acceso a su código.

**Clean-room:** se reproducen funciones, flujos y composición de pantallas. No se copian marca, textos, logos, colores exactos ni ilustraciones. Conta usa sus propios nombres y su propio diseño.

## Composición observada (y cómo se fusiona en Conta)

| Pantalla de la referencia | Qué muestra | En Conta (T8) |
| --- | --- | --- |
| Lista de presupuestos | pestañas *Completados / Todos / Pendientes*; tarjeta con nombre, cliente, total bruto, impuesto y total neto; búsqueda; botón flotante «+» | `/cotizaciones`: pestañas *Pendientes / Cerradas / Todas*, tarjetas con cliente, vigencia y total, búsqueda por cliente (como Treinta), botón «+ Cotización» |
| Menú por tarjeta | Completar · Ver detalle · Generar factura · Eliminar | detalle con *Aceptada / Rechazada*, **Convertir en venta** (en lugar de factura), Editar, Borrar |
| Nuevo presupuesto | nombre autonumerado, cliente, lista de artículos, subtotal, impuesto, ✓ guardar, ícono PDF | `/cotizaciones/nueva`: número consecutivo, título opcional, cliente (existente o nuevo), líneas, subtotal, IVA opcional, vigencia, notas |
| Agregar artículo | «Seleccionar de inventario», nombre, **cantidad × precio**, unidad, descuento; también modo área (ancho × alto) | por **pieza** (decidido): del inventario o línea libre, cantidad × precio, unidad (pieza por defecto). Sin modo por área; el descuento es editar el precio de la línea |
| Diálogo de impuesto | «¿Deseas calcular con el impuesto?» + tasa (0.18) | interruptor «Agregar IVA» con tasa editable (16 % por defecto) |
| Vista PDF + compartir | documento con emisor, fecha, «Para:» cliente, tabla de artículos, subtotal, impuesto, total | PDF propio (mismo generador que el comprobante, formato ancho) + WhatsApp + compartir |
| Detalle de pago | contado / crédito, método, saldo pendiente, monto a pagar, fecha estimada de pago | al **convertir en venta**: contado o fiado con fecha límite y **anticipo opcional** (entra como abono de esa venta) |

## Reglas de negocio de Conta para las cotizaciones

- Se cotiza por pieza: cada línea es cantidad × precio unitario (el precio se queda «congelado» en la cotización aunque cambie en el inventario).
- Número consecutivo por negocio; no se reutiliza al borrar. (Con varios dispositivos habrá que revisarlo en T15.)
- Vigencia con fecha (15 días por defecto). Estados: pendiente, aceptada, rechazada, convertida; «por vencer» (3 días o menos) y «vencida» se calculan a partir de la fecha.
- Convertir en venta descuenta el stock de los productos del inventario; el IVA entra como una línea más. Todo o nada: si algo falla no queda venta ni cambio de estado.
