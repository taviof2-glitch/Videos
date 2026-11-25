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

## graphify

[graphify](https://github.com/safishamsi/graphify) (`pip install graphifyy`, v0.9.119) está instalado: skill en `.claude/skills/graphify/`, hooks en `.claude/settings.json` (se saltan si `graphify` no está instalado) y esta sección vía `graphify claude install`.
En la nube, el script de inicio del entorno «Videos» instala graphify y genera `graphify-out/` (ignorada por git) automáticamente. A mano: `pip install graphifyy && graphify update .`.

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
