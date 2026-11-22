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

### Buscar más skills (`find-skills`)

La skill `find-skills` (de `vercel-labs/skills`) ayuda a encontrar e instalar skills del catálogo de https://skills.sh:

- Buscar: `npx skills find <palabras>` (en sesiones en la nube: `NODE_USE_ENV_PROXY=1 npx skills find <palabras>`, porque Node no usa el proxy por sí solo).
- Instalar en este proyecto: `npx skills add <owner/repo> --skill <nombre> --agent claude-code -y`.
- Antes de recomendar una skill revisa instalaciones (mejor 1K+), autor y el contenido de su `SKILL.md`.

## Comandos

- `npm run dev`: abre Remotion Studio.
- `npm run render -- <CompositionId> out/video.mp4`: renderiza un vídeo (la salida va a `out/`, ignorada por git).
- `npm run lint`: ESLint + `tsc`.
- `npm run upgrade`: actualiza los paquetes de Remotion (mantén todas las versiones `remotion`/`@remotion/*` iguales).

## Voz en off (edge-tts + ffmpeg)

- `npm run voz -- <nombre> "<texto>" [voz]` o `npm run voz -- <nombre> -f guion.txt [voz]` genera `public/voz/<nombre>.mp3` y `public/voz/<nombre>.srt` (subtítulos con tiempos).
- Voces de México: `es-MX-JorgeNeural` (hombre, predeterminada) y `es-MX-DaliaNeural` (mujer). Velocidad/tono: `RATE=+10% PITCH=-5Hz npm run voz -- ...`.
- Usar en Remotion con `<Audio src={staticFile("voz/<nombre>.mp3")} />` de `@remotion/media`; mide la duración con `ffprobe` para ajustar las escenas.
- Escribe los números de teléfono como se dicen ("tres siete ocho...") para que la voz los lea bien.
- Requisitos: `pip install edge-tts` y `ffmpeg`. edge-tts necesita acceso a `speech.platform.bing.com`.

## Estructura

- `src/index.ts`: registra la raíz (`registerRoot`).
- `src/Root.tsx`: lista las composiciones.
- `src/HouseLite/`: video promocional `HouseLitePromo` (1080x1920, 30 fps) y sus escenas en `scenes/`.
- `scripts/voz.sh`: generador de voz en off (`npm run voz`).
- `public/`: assets estáticos (usar con `staticFile()`).
- `remotion.config.ts`: configuración de la CLI.

## Sesiones en la nube de Claude Code

El entorno "Videos" permite `speech.platform.bing.com` (edge-tts), `remotion.media` (navegador de Remotion y efectos de sonido) y `skills.sh` (búsqueda de skills), e instala edge-tts y las dependencias al iniciar.
Si aun así falla la descarga del navegador headless, usa el Chromium preinstalado:
`npx remotion render <id> out/video.mp4 --browser-executable=/opt/pw-browsers/chromium`
