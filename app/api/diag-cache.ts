// TEMPORAL: comprobar que el caché de la API se lee (se borra al terminar).
import type Anthropic from '@anthropic-ai/sdk'
import { answer } from './assistant.js'

export async function POST(request: Request): Promise<Response> {
  if (!process.env.DIAG_KEY || request.headers.get('x-diag') !== process.env.DIAG_KEY) return new Response('no', { status: 401 })
  const b = (await request.json()) as { messages: { role: 'user' | 'assistant'; content: string }[]; context: string }
  let usage: Anthropic.Usage | undefined
  const r = await answer(b.messages, b.context, (u) => { usage = u })
  return Response.json({ usage, reply: await r.json() })
}
