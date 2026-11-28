// Asistente de Houselite: recibe la conversación y un resumen del negocio, y contesta con Claude.
// La llave de Anthropic vive solo aquí (variable ANTHROPIC_API_KEY en Vercel); nunca llega al celular.
// Solo contesta a quien tiene sesión en la cuenta de Houselite y un negocio en ella.
import Anthropic from '@anthropic-ai/sdk'
import { allowed } from './_auth.js'
import { TOOL_NAMES, TOOLS } from './_tools.js'

export const config = { maxDuration: 60 }

// Solo las últimas preguntas y respuestas: lo viejo de la conversación casi nunca hace falta y es lo que más cuesta.
const MAX_MESSAGES = 12
const MAX_CHARS = 60_000

const SYSTEM = `Eres el asistente de Houselite, la app con la que una carpintería de Tepatitlán, Jalisco (House Lite) lleva sus ventas, gastos, cotizaciones, obras y pagos del taller. Hablas con la dueña o con alguien de su equipo, casi siempre desde el celular y en el taller.

En cada conversación recibes un resumen del negocio sacado de la app en ese momento. Úsalo para contestar preguntas sobre cómo va el negocio, qué hay pendiente, qué conviene cobrar o pagar primero, y para ayudar a redactar mensajes a clientes o a pensar precios.

Cómo contestar:
- En español de México, directo y breve: es una pantalla de celular. Empieza por la respuesta.
- Los números salen del resumen. Si un dato no está ahí, dilo; no lo inventes ni lo estimes como si fuera real.
- Puedes hacer cuentas con los datos del resumen; di de dónde sale cada cifra.
- Puedes preparar acciones en la app con tus herramientas (ventas, gastos, abonos, cotizaciones, cambios de cotizaciones y obras, pagos del taller, productos y contactos). La app le muestra cada acción a la persona y solo se hace si ella la confirma; tú no guardas nada. Prepara una sola acción por respuesta.
- Usa los nombres e ids cortos del resumen cuando ya existen; si no existen, deja el id vacío y la app los crea. Si falta un dato indispensable (monto, precio, a quién), pregúntalo antes de preparar la acción. No inventes montos.
- Borrar cosas no lo puedes hacer: di que se hace desde la pantalla de ese registro.
- Si te piden un mensaje para un cliente, escríbelo listo para copiar, cordial y corto.`

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!token) return json({ error: 'sin_sesion', message: 'Entra a tu cuenta en «Cuenta y nube» para usar el asistente.' }, 401)
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'sin_llave', message: 'El asistente todavía no está activado: falta la llave de Anthropic en el servidor.' }, 503)

  let body: { messages?: { role?: string; content?: string }[]; context?: string }
  try {
    body = ((await request.json()) ?? {}) as typeof body
  } catch {
    return json({ error: 'peticion', message: 'La petición no es válida.' }, 400)
  }
  const history = (body.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()).slice(-MAX_MESSAGES)
  const context = typeof body.context === 'string' ? body.context : ''
  if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'peticion', message: 'Escribe tu pregunta.' }, 400)
  if (context.length + history.reduce((a, m) => a + m.content!.length, 0) > MAX_CHARS) return json({ error: 'largo', message: 'La conversación ya es muy larga. Empieza una nueva.' }, 413)

  try {
    if (!(await allowed(token))) return json({ error: 'sin_permiso', message: 'Tu sesión no tiene un negocio en la cuenta. Entra de nuevo en «Cuenta y nube».' }, 403)
  } catch {
    return json({ error: 'servidor', message: 'No se pudo comprobar tu sesión. Intenta de nuevo.' }, 502)
  }

  // El resumen del negocio va en el primer mensaje, como datos: así las instrucciones del sistema no cambian entre peticiones.
  // Caché: herramientas + instrucciones + resumen del negocio son iguales en toda la conversación, así que se marcan
  // para guardarse; cada pregunta siguiente los lee de caché (cuesta ~10 % y responde más rápido).
  const messages: Anthropic.MessageParam[] = history.map((m, i) => ({
    role: m.role as 'user' | 'assistant',
    content: i === 0 && context
      ? [
          { type: 'text' as const, text: `<resumen_del_negocio>\n${context}\n</resumen_del_negocio>`, cache_control: { type: 'ephemeral' as const } },
          { type: 'text' as const, text: m.content! },
        ]
      : m.content!,
  }))

  const client = new Anthropic()
  try {
    // Preguntas del día a día: Claude Haiku 5.5, el más rápido y barato, con poco esfuerzo para contestar al momento.
    const response = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system: SYSTEM,
      tools: TOOLS,
      messages,
    })
    if (response.stop_reason === 'refusal') return json({ error: 'rechazo', message: 'No puedo ayudar con esa petición. Prueba a preguntarlo de otra forma.' }, 200)
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim()
    // La venta no se guarda aquí: se manda a la app, que la muestra para confirmarla.
    const tool = response.content.find((b) => b.type === 'tool_use' && TOOL_NAMES.has(b.name))
    if (tool && tool.type === 'tool_use') return json({ text: text || 'Revisa y confirma:', action: { type: tool.name.replace(/^proponer_/, ''), ...(tool.input as object) } })
    return json({ text: text || 'No tengo respuesta para eso.', truncated: response.stop_reason === 'max_tokens' })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json({ error: 'llave', message: 'La llave de Anthropic del servidor no es válida. Revísala en Vercel.' }, 503)
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'limite', message: 'Hay muchas preguntas a la vez. Espera un momento e intenta de nuevo.' }, 429)
    if (error instanceof Anthropic.APIError) return json({ error: 'api', message: 'El asistente no pudo contestar. Intenta de nuevo en un momento.' }, 502)
    return json({ error: 'conexion', message: 'No se pudo conectar con el asistente. Intenta de nuevo.' }, 502)
  }
}
