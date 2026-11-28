// Dictado: convierte la voz en texto con el reconocimiento de voz del propio navegador (gratis, sin enviar audio a nuestro servidor).
import { useEffect, useRef, useState } from 'react'

interface Alternative { transcript: string }
interface Result { isFinal: boolean; 0: Alternative; length: number }
interface ResultEvent { resultIndex: number; results: { length: number; [i: number]: Result } }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: ResultEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | undefined {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const canDictate = () => !!ctor()

/**
 * Junta los resultados en un solo texto. En Chrome de Android cada resultado final a veces trae todo lo dicho hasta ahí;
 * si el nuevo empieza con lo que ya se tenía, lo reemplaza en vez de repetirlo.
 */
export function joinResults(parts: { text: string; final: boolean }[]): string {
  let done = ''
  let live = ''
  for (const p of parts) {
    const t = p.text.trim()
    if (!t) continue
    if (p.final) {
      if (done && t.toLowerCase().startsWith(done.toLowerCase())) done = t
      else if (!done.toLowerCase().endsWith(t.toLowerCase())) done = done ? `${done} ${t}` : t
    } else live = live ? `${live} ${t}` : t
  }
  if (live && done && live.toLowerCase().startsWith(done.toLowerCase())) return live
  return [done, live].filter(Boolean).join(' ')
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Da permiso de usar el micrófono para dictar (en los ajustes del navegador).',
  'service-not-allowed': 'Este navegador no deja dictar aquí. Usa el micrófono del teclado.',
  'audio-capture': 'No se encontró el micrófono.',
  network: 'Para dictar se necesita internet.',
}

/**
 * Dictar en un campo de texto. `onText` recibe el texto mientras se habla; `onDone` el texto final cuando se termina
 * (al tocar otra vez el botón o al dejar de hablar).
 */
export function useDictation(onText: (t: string) => void, onDone: (t: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const rec = useRef<Recognition | null>(null)
  const text = useRef('')
  const cancelled = useRef(false)
  const cbs = useRef({ onText, onDone })
  useEffect(() => {
    cbs.current = { onText, onDone }
  })
  useEffect(() => () => rec.current?.abort(), [])

  function start(prefix = '') {
    const C = ctor()
    setError('')
    if (!C) {
      setError('Este navegador no deja dictar aquí. Usa el micrófono del teclado.')
      return
    }
    const r = new C()
    r.lang = 'es-MX'
    r.continuous = true
    r.interimResults = true
    const base = prefix.trim()
    text.current = base
    cancelled.current = false
    r.onresult = (e) => {
      const parts: { text: string; final: boolean }[] = []
      for (let i = 0; i < e.results.length; i++) parts.push({ text: e.results[i][0].transcript, final: e.results[i].isFinal })
      const said = joinResults(parts)
      text.current = [base, said].filter(Boolean).join(' ')
      cbs.current.onText(text.current)
    }
    r.onerror = (e) => {
      if (e.error === 'aborted') cancelled.current = true
      else if (e.error !== 'no-speech') setError(ERRORS[e.error] ?? 'No se pudo dictar. Intenta otra vez.')
    }
    r.onend = () => {
      rec.current = null
      setListening(false)
      if (!cancelled.current && text.current.trim() && text.current.trim() !== base) cbs.current.onDone(text.current.trim())
    }
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      rec.current = null
      setError('No se pudo dictar. Intenta otra vez.')
    }
  }

  return {
    listening,
    error,
    /** Empieza a escuchar, o termina (y manda) si ya estaba escuchando. */
    toggle: (prefix?: string) => (rec.current ? rec.current.stop() : start(prefix)),
    /** Deja de escuchar sin mandar nada. */
    cancel: () => {
      cancelled.current = true
      rec.current?.abort()
    },
  }
}
