# Errores encontrados en las pruebas

Formato de `.claude/skills/replica-test/bug-report.md`. Severidad: S1 pérdida de datos o flujo principal bloqueado, S2 función rota sin remedio, S3 roto con remedio o visiblemente mal, S4 estético.

### BUG-001: la pantalla de Cotizaciones se ensancha más que el teléfono

- Severidad: S3
- Flujo / caso: transversal / X-A1
- Pantalla: Cotizaciones (`/cotizaciones`)
- Build: rama `ccr-0256ab58-cv2fdi` · Chromium, 360 px de ancho

Pasos
1. Abrir `/cotizaciones` en un teléfono de 360 px de ancho.

Esperado: la página cabe y no hay desplazamiento horizontal.
Actual: 20 px de desborde: el botón nuevo «⚡ Cotizador» junto a «+ Cotización» no cabía al lado del título.
Evidencia: `scripts/e2e-flows.mjs` caso X-A1.
Causa: `.row-between` no permitía que sus hijos pasaran a otra línea.
Status: corregido (`.row-between { flex-wrap: wrap }`); lo cubre X-A1.

### BUG-002: los formularios con dos columnas se salían de la pantalla del teléfono y las casillas se apilaban

- Severidad: S3
- Flujo / caso: cotizador / revisión visual (390 px)
- Pantalla: Cotizador rápido

Pasos
1. Abrir `/cotizador` a 390 px de ancho.

Esperado: los campos en dos columnas caben en la pantalla; las casillas van en una fila con su texto.
Actual: la página medía unos 570 px (los campos no podían encogerse) y cada casilla quedaba encima de su texto.
Evidencia: captura de pantalla durante el desarrollo; X-A1 ahora lo vigila en 22 pantallas.
Causa: `.two` usaba `1fr 1fr` (sin `minmax(0, …)`), los campos no tenían `min-width: 0` y `.form label` (grid) pisaba el estilo de `.check`.
Status: corregido (`.two`, `input`, `label.check` en `index.css`).

## Para revisar (no se reprodujo como error, pero conviene decidir)

- **Venta fiada en «Tu negocio hoy»:** muestra «$0.00 Vendido hoy · 1 venta» (cuenta la venta, no el efectivo). La tarjeta lo explica en una línea, pero puede confundir.
- **Foto real en el catálogo en vivo:** el bucket y las políticas están comprobados en Supabase, pero no se ha subido una foto desde un navegador contra Storage real.
- **Correo de confirmación:** el límite de Supabase (2 por hora) puede frenar las pruebas; para producción conviene un SMTP propio.
- **Permisos de empleado:** son de pantalla, no de datos (ver `PLAN.md`, límite de T13).
