# Videos — proyecto Remotion

Proyecto de vídeos hecho con [Remotion](https://www.remotion.dev) (React + TypeScript).

## Skills de Remotion

Las skills oficiales de Remotion están instaladas en `.claude/skills/` (fuente: `remotion-dev/skills`, versión fijada en `skills-lock.json`).
Úsalas siempre antes de escribir código de Remotion:

- `remotion-best-practices`: punto de entrada para cualquier tarea de Remotion.
- `remotion-create`: crear un vídeo o composición nueva (el proyecto ya está creado: no vuelvas a ejecutar `create-video`).
- `remotion-markup`: animación, timing, secuencias, transiciones, fuentes, audio, imágenes.
- `remotion-studio` / `remotion-render`: previsualizar y renderizar.
- Otras: `remotion-captions`, `remotion-multimedia`, `remotion-interactivity`, `remotion-maps`, `remotion-docs`, `remotion-upgrade`, `remotion-license`, `remotion-saas`.

Actualizar skills: `npx skills update`.

## Skills de Replica

Las 11 skills de [Jakeschincariol/replica-skill](https://github.com/Jakeschincariol/replica-skill) (MIT, commit `77c9436`) están copiadas en `.claude/skills/replica-*`.
Se ejecutan en orden y cada una lee lo que escribió la anterior en la carpeta `replica/`:
`/replica-recon` → `/replica-architect` → `/replica-design` → `/replica-build` → `/replica-backend` → `/replica-test` → `/replica-diff` → `/replica-entrepreneur` → `/replica-brand` → `/replica-launch` → `/replica-deploy`.
Las herramientas Python necesitan Python 3.8+ (sin dependencias). Para actualizar: volver a clonar el repo y copiar `replica-*` encima.

## App del negocio: Houselite (antes «Conta»; clon de Treinta + presupuestos, uso interno)

Vive en `app/` (Vite + React + TypeScript + Dexie, PWA, local-first). Plan y estado en `replica/PLAN.md`; qué construir en `replica/recon.md` y `replica/features.csv`; diseño técnico en `replica/architecture.md`; cotizaciones basadas en la app de presupuestos de referencia (`replica/reference-presupuestos.md`).

- `cd app && npm run dev`: servidor de desarrollo. `npm test`: pruebas (Vitest). `npm run build`: compilar. `npm run lint`: oxlint.
- `cd app && npm run build:artifact`: genera `app/dist-artifact/conta.html` (toda la app en un archivo, sin service worker y con rutas en memoria) para publicarla como página privada en claude.ai y probarla desde el teléfono. Allí las descargas pasan por la capacidad `downloads` (`app/src/ui/share.ts`). Los datos viven en el navegador de quien la abre, no en el repositorio.
- `cd app && npm run build:catalog`: genera `app/dist-artifact/catalogo.html`, la página pública del catálogo (aparte de la app, ver `replica/PLAN.md`, T12). Se publica como página en claude.ai con las capacidades `artifact` y `user`.
- Dinero siempre en centavos (enteros). Pantallas solo usan la capa `app/src/data/`. No copiar marca, textos ni imágenes de Treinta.

## Comandos (Remotion, raíz)

- `npm run dev`: abre Remotion Studio.
- `npm run render -- <CompositionId> out/video.mp4`: renderiza un vídeo (la salida va a `out/`, ignorada por git).
- `npm run lint`: ESLint + `tsc`.
- `npm run upgrade`: actualiza los paquetes de Remotion (mantén todas las versiones `remotion`/`@remotion/*` iguales).

## Estructura

- `src/index.ts`: registra la raíz (`registerRoot`).
- `src/Root.tsx`: lista las composiciones.
- `src/Composition.tsx`: composición de ejemplo `MyComp` (1280x720, 30 fps).
- `public/`: assets estáticos (usar con `staticFile()`).
- `remotion.config.ts`: configuración de la CLI.

## Sesiones en la nube de Claude Code

Si la descarga del navegador headless falla (`remotion.media` no accesible), usa el Chromium preinstalado:
`npx remotion render <id> out/video.mp4 --browser-executable=/opt/pw-browsers/chromium`

## ECC (Everything Claude Code)

El plugin `ecc@ecc` (v2.2.3, marketplace `affaan-m/ECC`) está habilitado a nivel de proyecto en `.claude/settings.json`.
Se instaló con `npx ecc-universal@2.2.3 setup --mode claude-plugin --scope project --hooks standard --yes`.
Vuelve a ejecutar ese comando para actualizar; `npx ecc-universal@2.2.3 doctor` para diagnosticar.
