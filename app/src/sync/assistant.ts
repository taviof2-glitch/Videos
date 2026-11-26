// Asistente: manda la conversación y el resumen del negocio a la función del servidor (api/assistant.ts), que es la que habla con Claude.
import { sessionToken } from './runner'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/** Lo que se le muestra a la persona cuando el asistente no puede contestar. */
export class AssistantError extends Error {}

const TIMEOUT_MS = 70_000

export async function askAssistant(messages: ChatMessage[], context: string): Promise<string> {
  if (!navigator.onLine) throw new AssistantError('Sin conexión. El asistente necesita internet.')
  const token = await sessionToken().catch(() => undefined)
  if (!token) throw new AssistantError('Entra a tu cuenta en «Cuenta y nube» para usar el asistente.')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages, context }),
      signal: ctrl.signal,
    })
    const body = (await res.json().catch(() => null)) as { text?: string; message?: string } | null
    if (body?.text) return body.text
    throw new AssistantError(body?.message ?? 'El asistente no pudo contestar. Intenta de nuevo.')
  } catch (e) {
    if (e instanceof AssistantError) throw e
    throw new AssistantError(ctrl.signal.aborted ? 'El asistente tardó demasiado. Intenta de nuevo.' : 'No se pudo conectar con el asistente. Revisa tu internet.')
  } finally {
    clearTimeout(timer)
  }
}
