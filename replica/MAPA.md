# Mapa rápido de Houselite (leer esto antes de explorar el código)

App de House Lite (carpintería, Tepatitlán). Usuarios: el dueño y su esposa (acceso total). Todo en español de México.
Código en `app/` (Vite + React + TS + Dexie, PWA local-first, sincroniza con Supabase). Dinero siempre en centavos.

## Cómo publicar (permiso total del dueño para desplegar)
1. `cd app && npx tsc -b && npx vitest run && npm run lint` (lint: solo importan los `error`).
2. Commit en la rama `ccr-7a4e6d58-c3itnk` y `git push origin ccr-7a4e6d58-c3itnk`.
3. Deploy: `POST https://api.vercel.com/v13/deployments?teamId=team_XJBTmEDSPoN4lS49XMb1d62O` con
   `{"name":"conta-app","project":"conta-app","target":"production","gitSource":{"type":"github","repoId":1468031099,"ref":"ccr-7a4e6d58-c3itnk","sha":"<HEAD>"}}`
   y esperar `readyState=READY` en `/v13/deployments/<id>`. Producción: https://conta-app-pi.vercel.app
4. Las notificaciones de Vercel en el PR #7 son rutina: contestar en una línea.

## Supabase (proyecto `opgiubxgxmzyjatexfzg`)
- SQL: `POST https://api.supabase.com/v1/projects/opgiubxgxmzyjatexfzg/database/query` con `{"query": "..."}` (el proxy pone la llave).
- Tras crear funciones RPC: `notify pgrst, 'reload schema';`.
- Datos de la app: tabla `sync_row (business_id, tbl, id, data jsonb, deleted_at)`. Una tabla nueva de Dexie debe ir en
  `sync_table_kind()` (última versión en `0009_appointments.sql`), en `src/sync/tables.ts` (ROW_TABLES) y en `BACKUP_TABLES`.
- Migraciones en `app/supabase/migrations/` (0001…0016; 0014 = cotizador en línea y respaldos `business_backup`; 0015 = txn de 8 días para el resumen del domingo; 0016 = galería con foto de antes). Aplicarlas a mano con la API de arriba.

## Secretos en Vercel (nunca pedirlos por chat; generarlos y subirlos con curl sin imprimirlos)
`ANTHROPIC_API_KEY`, `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` (avisos push), `DIGEST_KEY` (hash en tabla `digest_key`),
`CRON_SECRET` (cron 8:00 = `0 14 * * *` UTC en `vercel.json`), `FACTURAPI_KEY` (opcional, aún sin poner).
Node `fetch` no pasa por el proxy: para APIs externas usar `curl`.

## Funciones del servidor (`app/api/`, archivos con `_` no se publican; imports con `.js`)
- `assistant.ts` chat (Haiku 5.5, herramientas en `_tools.ts`; caché: punto en `system`, punto en el resumen y `cache_control` automático; el resumen se congela por conversación en `Assistant.tsx` — no meter nada que cambie en cada mensaje; `answer()` exportado para medir `usage`; el prompt trae el mapa de pantallas).
  Resumen: `src/data/assistant.ts` + `assistantMore.ts` (agenda, corte, meta, capacidad, impuestos, retacera, ganancias…).
  Ojo: las acciones originales (venta, gasto, abono, cotización, estado de cotización, pago del taller, producto, contacto) van en `strict`; obra y las nuevas no (con todas, la API da «compiled grammar is too large»); las demás las completa `fillDefaults`.
  Acciones en `src/data/actions.ts` (al agregar una sección nueva: sumarla al resumen y, si se puede hacer algo, una herramienta). `furniture.ts` foto→mueble y
  `ticket.ts` foto de ticket (Sonnet 5.5, salida JSON). La foto reconoce de todo: catálogo en `src/data/photoCatalog.ts` (Bases sin prefijo en mm, `cot_*` Cotizar en cm, `srv_*` servicios, `prod_*` inventario, `tabla_picar`) y `photoIntent` decide qué abrir; `analyze()` exportado para probar. `push.ts` avisos. `daily.ts` resumen 8:00 (`src/data/digest.ts`, sin Dexie).
- `seguimiento.ts` (/s/<token>, obra para el cliente), `galeria.ts` (/g/<token>), `cotizacion.ts` (/c/<token>), `cotiza.ts`
  (/cotiza/<leadToken>, cotizador en línea → pedido «web» + push), `factura.ts` (Facturapi CFDI 4.0). `daily.ts` también hace el respaldo semanal.
- Rewrites en `vercel.json`; rutas públicas también en `navigateFallbackDenylist` de `vite.config.ts`.

## Datos (`app/src/data/`) — las pantallas solo usan esta capa
ventas/gastos `transactions.ts` · abonos `debts.ts` (libro: editar = anular y reanotar) · cotizaciones `quotes.ts` +
seguimiento `followup.ts` · obras `jobs.ts` (etapas, fotos, costos reales, `materialUse.ts`, postventa `aftersale.ts`) ·
agenda `agenda.ts` · material del taller `materials.ts` (vive en `business.materials`) · tickets `ticket.ts` (+ precios al
cotizador `purchaseList.ts`) · pedido de material `purchaseList.ts` · retacera `offcuts.ts` (mm, en `business.offcuts`) ·
Bases `bases.ts` (mm; `opts.tablero` melamina/MDF/madera, precios `hojaMdf`/`hojaMadera`/`barnizM2`/`hBarniz`) y despiece `cutlist.ts` (cm) · cotizador `quoter.ts` (tablas de picar: `BOARD_KEY`, `boardUnitCents`, precio directo por cm²) · corte/meta `cashcut.ts` · galería `gallery.ts` +
`galleryCats.ts` · factura `invoicing.ts` · acciones del asistente `actions.ts`/`assistant.ts` · datos de pago `payinfo.ts` · opciones y enlace de cotización
`quoteOptions.ts` (pública en `api/cotizacion.ts`, /c/<token>) · capacidad del taller `capacity.ts` · impuestos `taxes.ts` · cotizador en línea `leads.ts`/`leadTypes.ts` ·
lista para instalar y ruta del día `fieldwork.ts` · favoritos de Bases `favorites.ts` · campañas `campaigns.ts` (/campanas) ·
ganancia por hora `hourProfit.ts` · respaldos de la nube `sync/cloudBackup.ts` (tarjeta en Más) · dinero de 4 semanas `forecast.ts` (Corte) ·
etiquetas de piezas `labels.ts` · plano acotado `ui/Plan2D.tsx` · muestrario `swatches.ts` (+ `Quote.color`) · maquinaria `machines.ts` ·
material automático al pasar a Corte `autoUseOnCut` en `materialUse.ts` · antes/después `QuoteJob.before` · resumen del domingo `buildWeekly` en `digest.ts`.
Material necesario `materialNeeds.ts` (/material-necesario: obras por cortar del Cotizador, Bases, estimado por metro (`est`) y `QuoteJob.extraMaterial` a mano — tarjeta `ui/JobMaterial.tsx` en cada obra contra Material del taller, reparto por fecha, pedido por proveedor) ·
Buscador general `search.ts` (/buscar, lupa en el encabezado) · plan de la semana `weekPlan.ts` (/plan, `QuoteJob.planDays`).
Barra de abajo: Inicio, Balance, asistente, Deudas, Cotizador, Más (el dueño pidió Cotizador en vez de Inventario).
Vista 3D: `ui/Furniture3D.tsx` (en Bases). Ficha del cliente: `ui/ClientHistory.tsx`. Historial de precios: `WorkMaterial.history` + `priceRises`.

## Pantallas (`app/src/pages/`) y piezas (`app/src/ui/`)
Inicio `Home.tsx` (avisos) · Obras `Jobs.tsx` · Agenda · Galería · Corte (`CashCut.tsx`) · Material (`Materials.tsx`:
ticket, pedido, retacera) · Asistente (voz `speech.ts`, dictado `dictation.ts`) · barra con botón central del asistente
`ui/Layout.tsx`. Avisos push: `sync/push.ts` + `ui/jobNotify.ts` (ventas y abonos también al que registra).

## Preferencias del dueño
- Quiere todo hecho y publicado; explicaciones cortas, en español sencillo.
- Trabaja melamina de 15 mm, nunca de 16 (lo de fábrica es 15; `quoterSettings` pasa un 16 guardado a 15).
- Los tickets se anotan con la fecha del ticket; el gasto va a la categoría «Material» con su proveedor.
- Nada de mensajes automáticos a clientes: los enlaces y mensajes solo se mandan cuando él toca el botón.
- No hay empleados (solo él y su esposa). WhatsApp Business (Meta) sigue pendiente de que cree la cuenta.

## Pruebas en navegador
`npm run build` y `npx vite preview --port 41xx`; Playwright con negocio nuevo (llenar «Nombre del negocio *» → «Empezar»).
Para APIs públicas se pueden insertar filas de prueba en `sync_row` con un `business_id` falso y borrarlas al final.
