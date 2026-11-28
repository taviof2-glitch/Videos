// TEMPORAL: prueba del cotizador por foto (se borra al terminar).
import { analyze, type AnalyzeBody } from './furniture.js'

export async function POST(request: Request): Promise<Response> {
  if (!process.env.DIAG_KEY || request.headers.get('x-diag') !== process.env.DIAG_KEY) return new Response('no', { status: 401 })
  return analyze((await request.json()) as AnalyzeBody)
}
