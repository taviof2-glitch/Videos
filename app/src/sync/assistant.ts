// Asistente: manda la conversación y el resumen del negocio a la función del servidor (api/assistant.ts), que es la que habla con Claude.
import { sessionToken } from './runner'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/** Lo que se le muestra a la persona cuando el asistente no puede contestar. */
export class AssistantError extends Error {}

const TIMEOUT_MS = 70_000

export async function askAssistant(messages: ChatMessage[], context: string): Promise<{ text: string; action?: import('../data/assistant').SaleAction | import('../data/actions').AppAction }> {
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
    const body = (await res.json().catch(() => null)) as { text?: string; message?: string; action?: import('../data/assistant').SaleAction | import('../data/actions').AppAction } | null
    if (body?.text) return { text: body.text, ...(body.action && typeof body.action === 'object' && typeof body.action.type === 'string' && { action: body.action }) }
    throw new AssistantError(body?.message ?? 'El asistente no pudo contestar. Intenta de nuevo.')
  } catch (e) {
    if (e instanceof AssistantError) throw e
    throw new AssistantError(ctrl.signal.aborted ? 'El asistente tardó demasiado. Intenta de nuevo.' : 'No se pudo conectar con el asistente. Revisa tu internet.')
  } finally {
    clearTimeout(timer)
  }
}

export type FurnitureGuess = { key: string; values: Record<string, number>; explanation: string; assumptions: string[]; confidence: 'alta' | 'media' | 'baja' }
export type CatalogItem = { key: string; name: string; group?: string; fields: { k: string; label: string; def: number; choices?: [number, string][] }[] }

/** Manda la foto (base64 sin encabezado) y las medidas; regresa qué mueble de Bases es y cómo llenarlo. */
export async function analyzeFurniture(input: { image?: string; mediaType?: string; text: string; catalog: CatalogItem[] }): Promise<FurnitureGuess> {
  if (!navigator.onLine) throw new AssistantError('Sin conexión. El asistente necesita internet.')
  const token = await sessionToken().catch(() => undefined)
  if (!token) throw new AssistantError('Entra a tu cuenta en «Cuenta y nube» para usar el asistente.')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('/api/furniture', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(input), signal: ctrl.signal })
    const body = (await res.json().catch(() => null)) as (FurnitureGuess & { message?: string }) | null
    if (body?.key) return body
    throw new AssistantError(body?.message ?? 'El asistente no pudo analizar la foto. Intenta de nuevo.')
  } catch (e) {
    if (e instanceof AssistantError) throw e
    throw new AssistantError(ctrl.signal.aborted ? 'El asistente tardó demasiado. Intenta de nuevo.' : 'No se pudo conectar con el asistente. Revisa tu internet.')
  } finally {
    clearTimeout(timer)
  }
}

export type TicketLine = { text: string; name: string; quantity: number; unit: string; unitCents: number; materialId: string; isMaterial: boolean }
export type TicketRead = { supplier: string; date: string; totalCents: number; lines: TicketLine[]; doubts: string[] }

/** Manda la foto del ticket (base64 sin encabezado) y la lista del material del taller; regresa lo leído para revisarlo. */
export async function readTicket(input: { image: string; mediaType?: string; materials: { id: string; name: string; unit: string }[] }): Promise<TicketRead> {
  if (!navigator.onLine) throw new AssistantError('Sin conexión. El asistente necesita internet.')
  const token = await sessionToken().catch(() => undefined)
  if (!token) throw new AssistantError('Entra a tu cuenta en «Cuenta y nube» para usar el asistente.')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('/api/ticket', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(input), signal: ctrl.signal })
    const body = (await res.json().catch(() => null)) as (TicketRead & { message?: string }) | null
    if (body && Array.isArray(body.lines)) return body
    throw new AssistantError(body?.message ?? 'El asistente no pudo leer el ticket. Intenta de nuevo.')
  } catch (e) {
    if (e instanceof AssistantError) throw e
    throw new AssistantError(ctrl.signal.aborted ? 'El asistente tardó demasiado. Intenta de nuevo.' : 'No se pudo conectar con el asistente. Revisa tu internet.')
  } finally {
    clearTimeout(timer)
  }
}
