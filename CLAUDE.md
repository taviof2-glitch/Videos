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
