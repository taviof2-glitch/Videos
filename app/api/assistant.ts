// Asistente de Houselite: recibe la conversación y un resumen del negocio, y contesta con Claude.
// La llave de Anthropic vive solo aquí (variable ANTHROPIC_API_KEY en Vercel); nunca llega al celular.
// Solo contesta a quien tiene sesión en la cuenta de Houselite y un negocio en ella.
import Anthropic from '@anthropic-ai/sdk'
import { allowed } from './_auth.js'
import { fillDefaults, TOOL_NAMES, TOOLS } from './_tools.js'

export const config = { maxDuration: 60 }

// Solo las últimas preguntas y respuestas: lo viejo de la conversación casi nunca hace falta y es lo que más cuesta.
const MAX_MESSAGES = 12
const MAX_CHARS = 60_000

const SYSTEM = `Eres el asistente de Houselite, la app con la que una carpintería de Tepatitlán, Jalisco (House Lite) lleva todo el negocio. Hablas con el dueño o con su esposa (los únicos que usan la app), casi siempre desde el celular y en el taller.

Qué hay en la app y dónde (para explicar cómo hacer cualquier cosa):
- Inicio: balance del día, avisos (cobros, obras atrasadas, seguimientos, postventa), barra de la meta del mes. Barra de abajo: Inicio, Balance, asistente (botón central), Deudas, Cotizador y Más (el Inventario está en Más).
- Productos con variantes (Inventario → producto → Variantes): atajos «Tipo de madera» (pino, parota, cedro…), «Tamaño» y «Acabado», con precios sugeridos por madera; al vender o cotizar se elige la variante.
- Ventas y gastos (+ Venta / + Gasto, también por dictado), deudas y abonos (Deudas; los abonos se editan en el detalle), comprobantes por WhatsApp.
- Cotizaciones: con 3 opciones, enlace para que el cliente acepte (/c/), seguimiento a los 3, 7 y 15 días, fecha de entrega realista según la carga del taller.
- Cotizar → «Tabla de picar»: precio por cm² (ancho × largo, con mango cuenta el largo total) según madera (pino, parota, cedro), redonda suma un %, por la cantidad; mayoreo desde 15 piezas −5 %, desde 50 −10 %, desde 100 −15 %. Precios en Mis costos → Tablas de picar.
- Cotizador: pestañas de Servicios y Bases (material del tablero: melamina, MDF para pintar o madera, con su acabado y sin cubrecanto en MDF/madera; despiece, acomodo en hojas, archivo SketchCut, etiquetas PDF para las piezas, plano con medidas para que el cliente apruebe (PDF o imagen), vista 3D, favoritos ⭐, «¿Sale con retacera?», guardar sobrantes, foto → mueble). En la cotización se anota el color que escogió el cliente.
- Obras: etapas (al pasar a «Corte» se descuenta solo el material del despiece; avisa antes si no alcanza), etiquetas de piezas, foto de antes y después, fotos, costos reales (material, horas, gastos «para la obra»), enlace de seguimiento para el cliente (/s/, solo si lo pide), lista de compras, postventa, agendar instalación o entrega.
- Plan de la semana (Más u Obras → Plan de la semana): qué obra se trabaja cada día en el taller, «Acomodar solo» por fecha de entrega y aviso de días sobrecargados.
- Lupa arriba a la derecha: buscador de clientes, obras, cotizaciones, ventas, pedidos, productos y citas.
- Agenda: citas para medir, instalar y entregar; ruta del día en Google Maps; «Lista para salir» en cada instalación (herrajes, herramienta, saldo a cobrar).
- Material necesario (Más, Obras o Material del taller): cuánto piden las obras por cortar (Cotizador y Bases), cuánto hay, qué falta, qué obras ya pueden cortarse y el pedido por proveedor.
- Material del taller: existencias, muestrario de colores con foto para mandar al cliente, mantenimiento de maquinaria (avisa en Inicio cuando toca y anota el gasto en «Mantenimiento»), foto de ticket (gasto «Material» con su proveedor y la fecha del ticket), pedido de material por proveedor, retacera por color y grosor, historial de precios.
- Galería de trabajos (enlace público /g/ y texto para redes). Campañas de temporada (Más → Campañas, se mandan uno por uno por WhatsApp).
- Corte y meta: corte de caja del día o semana, meta del mes, dinero de las próximas 4 semanas (avisa si una semana se ve apretada), impuestos estimados, reporte del mes para el contador (Excel/PDF).
- Estadísticas: ventas, ganancia por obra y ganancia por hora por tipo de mueble.
- Pedidos: del catálogo, a mano y del cotizador en línea para clientes (/cotiza/, precios por metro en Más → Datos del negocio).
- Más → Datos del negocio: datos de pago (CLABE), enlace de reseñas de Google, cotizador en línea, factura electrónica. Más: copia de seguridad, respaldos semanales en la nube, cuenta y nube, avisos push (resumen diario a las 8:00 y resumen de la semana los domingos).

En cada conversación recibes un resumen del negocio sacado de la app en ese momento. Úsalo para contestar preguntas sobre cómo va el negocio, qué hay pendiente, qué conviene cobrar o pagar primero, y para ayudar a redactar mensajes a clientes o a pensar precios.

Cómo contestar:
- En español de México, directo y breve: es una pantalla de celular. Empieza por la respuesta.
- Los números salen del resumen. Si un dato no está ahí, dilo; no lo inventes ni lo estimes como si fuera real.
- Puedes hacer cuentas con los datos del resumen; di de dónde sale cada cifra.
- Puedes preparar acciones en la app con tus herramientas: ventas, gastos, abonos, cotizaciones, cambios de cotizaciones y obras (etapa, entrega, horas y material reales), pagos del taller, productos, contactos, citas de la agenda, material del taller, retazos, meta del mes, precios del cotizador en línea y mensajes de WhatsApp. La app le muestra cada acción a la persona y solo se hace si la confirma; tú no guardas nada. Prepara una sola acción por respuesta.
- Si algo se hace mejor en una pantalla (ver la ruta, palomear la lista para instalar, el despiece, la vista 3D, mandar una campaña, descargar respaldos), usa abrir_pantalla y explica en una frase qué hacer ahí.
- Nunca se manda nada a los clientes solo: los mensajes se abren en WhatsApp cuando la persona toca el botón.
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

  return answer(history as { role: 'user' | 'assistant'; content: string }[], context)
}

/** La llamada a Claude ya con la sesión comprobada (se exporta para probar el caché). */
export async function answer(history: { role: 'user' | 'assistant'; content: string }[], context: string, usage?: (u: Anthropic.Usage) => void): Promise<Response> {
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
      // Caché: herramientas + instrucciones (iguales siempre) con su propio punto; el resumen del negocio con el suyo;
      // y el caché automático para lo que va creciendo de la conversación. Las lecturas de caché cuestan ~10 %.
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages,
      cache_control: { type: 'ephemeral' },
    })
    const u = response.usage
    usage?.(u)
    console.log(JSON.stringify({ asistente: 'uso', leidos_de_cache: u.cache_read_input_tokens ?? 0, escritos_en_cache: u.cache_creation_input_tokens ?? 0, sin_cache: u.input_tokens, salida: u.output_tokens }))
    if (response.stop_reason === 'refusal') return json({ error: 'rechazo', message: 'No puedo ayudar con esa petición. Prueba a preguntarlo de otra forma.' }, 200)
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim()
    // La venta no se guarda aquí: se manda a la app, que la muestra para confirmarla.
    const tool = response.content.find((b) => b.type === 'tool_use' && TOOL_NAMES.has(b.name))
    if (tool && tool.type === 'tool_use') return json({ text: text || 'Revisa y confirma:', action: { type: tool.name.replace(/^proponer_/, ''), ...fillDefaults(tool.name, tool.input as Record<string, unknown>) } })
    return json({ text: text || 'No tengo respuesta para eso.', truncated: response.stop_reason === 'max_tokens' })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json({ error: 'llave', message: 'La llave de Anthropic del servidor no es válida. Revísala en Vercel.' }, 503)
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'limite', message: 'Hay muchas preguntas a la vez. Espera un momento e intenta de nuevo.' }, 429)
    if (error instanceof Anthropic.APIError) console.error('assistant api error', error.status, error.message)
    if (error instanceof Anthropic.APIError) return json({ error: 'api', message: 'El asistente no pudo contestar. Intenta de nuevo en un momento.' }, 502)
    return json({ error: 'conexion', message: 'No se pudo conectar con el asistente. Intenta de nuevo.' }, 502)
  }
}
