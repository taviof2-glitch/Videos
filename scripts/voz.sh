#!/usr/bin/env bash
# Genera una voz en off con edge-tts y la guarda en public/voz/ para usarla en Remotion.
#
# Uso:
#   npm run voz -- <nombre> "<texto>" [voz]
#   npm run voz -- <nombre> -f guion.txt [voz]
#
# Ejemplos:
#   npm run voz -- promo "¿Buscas muebles a medida en Tepatitlán?"
#   npm run voz -- promo -f guiones/promo.txt es-MX-DaliaNeural
#
# Variables opcionales: RATE (p. ej. "+10%"), PITCH (p. ej. "-5Hz").
# Resultado: public/voz/<nombre>.mp3 y public/voz/<nombre>.srt (subtítulos con tiempos).
# En Remotion: <Audio src={staticFile("voz/<nombre>.mp3")} />
set -euo pipefail

if [ $# -lt 2 ]; then
  sed -n '2,15p' "$0"
  exit 1
fi

name="$1"
shift
if [ "$1" = "-f" ]; then
  text_args=(--file "$2")
  shift 2
else
  text_args=(--text "$1")
  shift
fi
voice="${1:-es-MX-JorgeNeural}"

root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/public/voz"
mkdir -p "$out"

# edge-tts no usa HTTPS_PROXY por sí solo; se lo pasamos si existe.
proxy_args=()
if [ -n "${HTTPS_PROXY:-}" ]; then
  proxy_args=(--proxy "$HTTPS_PROXY")
fi

edge-tts "${proxy_args[@]}" \
  --voice "$voice" \
  --rate="${RATE:-+0%}" \
  --pitch="${PITCH:-+0Hz}" \
  "${text_args[@]}" \
  --write-media "$out/$name.mp3" \
  --write-subtitles "$out/$name.srt"

duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$name.mp3")"
echo "Listo: public/voz/$name.mp3 (${duration}s) y public/voz/$name.srt"
