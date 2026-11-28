// TEMPORAL: diagnóstico del asistente (se borra en cuanto se encuentre el error).
import Anthropic from '@anthropic-ai/sdk'
import { TOOLS } from './_tools.js'

export async function POST(request: Request): Promise<Response> {
  if (!process.env.DIAG_KEY || request.headers.get('x-diag') !== process.env.DIAG_KEY) return new Response('no', { status: 401 })
  const only = new URL(request.url).searchParams.get('n')
  const tools = only ? TOOLS.slice(0, Number(only)) : TOOLS
  try {
    const r = await new Anthropic().messages.create({ model: 'claude-haiku-5-5', max_tokens: 30, output_config: { effort: 'low' }, tools, messages: [{ role: 'user', content: 'hola' }] })
    return Response.json({ ok: true, stop: r.stop_reason, tools: tools.length })
  } catch (e) {
    return Response.json({ ok: false, tools: tools.length, status: (e as { status?: number }).status, message: e instanceof Error ? e.message : String(e) })
  }
}
