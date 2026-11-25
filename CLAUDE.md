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

## Comandos

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

## Skills de Emil Kowalski

Las 20 skills de [emilkowalski/skills](https://github.com/emilkowalski/skills) (animación, gestos, pulido de UI) están en `.claude/skills/` y fijadas en `skills-lock.json`.
Se instalaron con `npx -y skills add emilkowalski/skills --agent claude-code`. Actualizar: `npx skills update`.

## Skill Impeccable

La skill `impeccable` de [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (diseño y pulido de interfaces: jerarquía, tipografía, color, motion, accesibilidad, design systems) está en `.claude/skills/impeccable` y fijada en `skills-lock.json`.
Se instaló con `npx -y skills add pbakaus/impeccable --agent claude-code`. Actualizar: `npx skills update`.

## Skill Taste

La skill `design-taste-frontend` de [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) (criterio de diseño para interfaces frontend) está en `.claude/skills/design-taste-frontend` y fijada en `skills-lock.json`.
Se instaló con `npx -y skills add leonxlnx/taste-skill --agent claude-code`. Actualizar: `npx skills update`.

## Marketing Skills (Corey Haines)

Las 53 skills de [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (copywriting, CRO, SEO, ads, emails, pricing, lanzamientos, analítica, etc.) están en `.claude/skills/` y fijadas en `skills-lock.json`.
Empieza por `product-marketing` (crea `.agents/product-marketing.md`, el contexto que leen las demás).
Se instalaron con `npx -y skills add coreyhaines31/marketingskills --agent claude-code -y`. Actualizar: `npx skills update`.

## Skill Stop Slop

La skill `stop-slop` de [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) (quita patrones de escritura típicos de IA al redactar o revisar textos) está en `.claude/skills/stop-slop` y fijada en `skills-lock.json`.
Se instaló con `npx -y skills add hardikpandya/stop-slop --agent claude-code -y`. Actualizar: `npx skills update`.
