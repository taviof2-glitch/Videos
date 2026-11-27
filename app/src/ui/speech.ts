// Leer en voz alta las respuestas del asistente (voz del propio teléfono, gratis). Para usarlo con las manos ocupadas.

const KEY = 'assistant:voice'

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function voiceOn(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}
export function setVoiceOn(on: boolean): void {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* sin almacenamiento: solo dura esta vez */ }
  if (!on) stopSpeaking()
}

/** Quita lo que no se lee bien en voz alta: asteriscos, viñetas, enlaces y lo que va entre corchetes. */
export function speakable(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, '')
    .replace(/https?:\/\/\S+/g, 'el enlace')
    .replace(/[*_#`>•]/g, '')
    .replace(/\$([\d,]+(?:\.\d+)?)/g, '$1 pesos')
    .replace(/\s+/g, ' ')
    .trim()
}

export function speak(text: string): void {
  if (!canSpeak()) return
  const t = speakable(text)
  if (!t) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(t)
  u.lang = 'es-MX'
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === 'es-MX') ?? window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'))
  if (voice) u.voice = voice
  u.rate = 1.05
  window.speechSynthesis.speak(u)
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel()
}
