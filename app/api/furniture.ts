// Mueble desde una foto: Claude mira la foto y las medidas que da el carpintero, elige el mueble de la lista de Bases
// que más se parece y llena sus campos. El despiece, el acomodo y el precio los calcula la app con los costos del negocio.
import Anthropic from '@anthropic-ai/sdk'
import { allowed } from './_auth.js'

export const config = { maxDuration: 60 }

const MAX_IMAGE = 4_000_000
const MAX_CATALOG = 300

type CatalogItem = { key: string; name: string; group?: string; fields: { k: string; label: string; def: number; choices?: [number, string][] }[] }

const SYSTEM = `Eres el ayudante de cotización de una carpintería en Tepatitlán, Jalisco: hace muebles de melamina, closets, cocinas, escritorios, piezas de madera maciza (como tablas de picar), trabajos de obra (drywall, etc.) y vende productos de su inventario. Te mandan una foto (de internet, de un cliente o de algo ya hecho) y, a veces, medidas y detalles.

Tu trabajo: elegir de la lista lo que mejor corresponde a la foto o a lo que piden, y llenar sus campos para que la app saque el precio.

Cómo elegir:
- Usa solo una clave de la lista. Las claves dicen de dónde son: sin prefijo = mueble de Bases (despiece exacto); "cot_…" = trabajo de Cotizar (closet, cocina, mueble de TV, escritorio, librero, baño, closet sencillo…); "srv_…" = servicio de obra; "prod_…" = un producto que el negocio ya vende; "tabla_picar" = tabla de picar.
- Si la foto es claramente uno de los productos del inventario (mismo tipo de pieza), elige ese "prod_…".
- Para closets, cocinas, muebles de TV, libreros y muebles de baño completos prefiere su "cot_…" (se cotizan por medidas). Usa un mueble de Bases cuando es un mueble suelto que está en Bases (cajonera, repisa, buró, ropero por torres, etc.).
- Para trabajos de construcción (muros o plafones de tablaroca y similares) usa el "srv_…" que corresponda.
- Si nada se parece, usa "caja_libre" (si está) o lo más parecido.

Medidas:
- Cada campo dice su unidad en la etiqueta: respétala. Los muebles de Bases (sin prefijo) van en milímetros; los de Cotizar en centímetros; los servicios en la unidad que diga (m, m², piezas).
- Convierte lo que te den (90 cm = 900 mm = 0.9 m; 2.10 m = 210 cm).
- Las medidas que te den mandan sobre lo que veas. Si falta una, estímala por proporción o con medidas estándar y dilo en "supuestos".
- Cuenta en la foto puertas, cajones, repisas, divisiones, tubos y torres; si no se ve bien, pon lo más probable y dilo en "supuestos".
- En campos con opciones usa uno de los números de esas opciones. Solo llena los campos que tiene lo que elegiste.
- "explicacion": una o dos frases en español de México, directas, sobre qué elegiste y por qué.
- "confianza": "alta" si la foto y las medidas son claras, "media" si estimaste algo, "baja" si casi todo es estimado.

Tablas de picar (clave "tabla_picar", si está en la lista): úsala para tablas de picar, de quesos, de servir o charcuteras de madera, aunque sean redondas o tengan mango. Nunca uses un mueble de melamina para eso.
- madera: 1 = pino (clara, amarillenta, con nudos y vetas marcadas), 2 = parota (café medio con contraste fuerte de vetas claras y oscuras), 3 = cedro (rojizo o rosado, uniforme). Si te dicen la madera, manda la que dicen; si no se distingue, pino y dilo en "supuestos".
- ancho y largo: del cuerpo de la tabla SIN el mango, en milímetros (el largo es el lado mayor). Si es redonda, ancho = largo = diámetro.
- redonda: 1 si es redonda u ovalada, 0 si es rectangular (esquinas redondeadas sigue siendo 0).
- mango: 1 si tiene mango o agarradera que sobresale; mangoLargo = lo que sobresale el mango, en mm (si no se ve la medida, estima unos 100 a 150 mm por proporción).
- piezas: cuántas tablas piden (si no dicen, 1). Medidas típicas si no dan ninguna: 250 × 350 mm.`

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!token) return json({ error: 'sin_sesion', message: 'Entra a tu cuenta en «Cuenta y nube» para usar el asistente.' }, 401)
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'sin_llave', message: 'El asistente todavía no está activado: falta la llave de Anthropic en el servidor.' }, 503)

  let body: AnalyzeBody
  try {
    body = ((await request.json()) ?? {}) as AnalyzeBody
  } catch {
    return json({ error: 'peticion', message: 'La petición no es válida.' }, 400)
  }
  try {
    if (!(await allowed(token))) return json({ error: 'sin_permiso', message: 'Tu sesión no tiene un negocio en la cuenta. Entra de nuevo en «Cuenta y nube».' }, 403)
  } catch {
    return json({ error: 'servidor', message: 'No se pudo comprobar tu sesión. Intenta de nuevo.' }, 502)
  }

  return analyze(body)

}

export type AnalyzeBody = { image?: string; mediaType?: string; text?: string; catalog?: CatalogItem[] }

/** Lo que hace la función ya con la sesión comprobada (se puede probar aparte). */
export async function analyze(body: AnalyzeBody): Promise<Response> {
  const image = typeof body.image === 'string' ? body.image : ''
  const mediaType = body.mediaType === 'image/png' ? 'image/png' : 'image/jpeg'
  const text = typeof body.text === 'string' ? body.text.slice(0, 1500) : ''
  const catalog = (Array.isArray(body.catalog) ? body.catalog : []).filter((c) => c && /^[A-Za-z0-9_]{2,40}$/.test(c.key) && Array.isArray(c.fields)).slice(0, MAX_CATALOG)
  if (!image && !text.trim()) return json({ error: 'peticion', message: 'Manda una foto o describe el mueble.' }, 400)
  if (image.length > MAX_IMAGE) return json({ error: 'largo', message: 'La foto pesa demasiado. Toma otra o recórtala.' }, 413)
  if (!catalog.length) return json({ error: 'peticion', message: 'Falta la lista de muebles.' }, 400)

  // La lista de muebles va en el mensaje (como datos), con sus campos y valores normales.
  const list = catalog.map((c) => `- ${c.key}: ${c.name}${c.group ? ` (${c.group})` : ''}. Campos: ${c.fields.map((f) => `${f.k} = ${f.label}${f.choices ? ` [opciones: ${f.choices.map(([v, l]) => `${v} ${l}`).join(', ')}]` : ''} (normal ${f.def})`).join('; ')}`).join('\n')
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: image } })
  content.push({ type: 'text', text: `<muebles>\n${list}\n</muebles>\n\nMedidas y detalles que da el carpintero: ${text.trim() || '(no dio medidas)'}` })

  const schema = {
    type: 'object',
    properties: {
      clave: { type: 'string', enum: catalog.map((c) => c.key) },
      campos: { type: 'array', items: { type: 'object', properties: { campo: { type: 'string' }, valor: { type: 'number' } }, required: ['campo', 'valor'], additionalProperties: false } },
      explicacion: { type: 'string' },
      supuestos: { type: 'array', items: { type: 'string' } },
      confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    },
    required: ['clave', 'campos', 'explicacion', 'supuestos', 'confianza'],
    additionalProperties: false,
  }

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      // Fotos: Claude Sonnet 5.5, que ve bien las imágenes a menor costo que Opus. Si declina, la API reintenta con su respaldo.
      model: 'claude-sonnet-5-5',
      max_tokens: 4000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })
    if (response.stop_reason === 'refusal') return json({ error: 'rechazo', message: 'No pude analizar esa foto. Prueba con otra.' }, 200)
    if (response.stop_reason === 'max_tokens') return json({ error: 'corte', message: 'La respuesta salió incompleta. Intenta de nuevo.' }, 502)
    const raw = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const out = JSON.parse(raw) as { clave: string; campos: { campo: string; valor: number }[]; explicacion: string; supuestos: string[]; confianza: string }
    const item = catalog.find((c) => c.key === out.clave)
    if (!item) return json({ error: 'api', message: 'El asistente eligió un mueble que no está en la lista. Intenta de nuevo.' }, 502)
    const known = new Set(item.fields.map((f) => f.k))
    const values = Object.fromEntries(out.campos.filter((c) => known.has(c.campo) && Number.isFinite(c.valor) && c.valor >= 0 && c.valor < 100_000).map((c) => [c.campo, Math.round(c.valor * 100) / 100]))
    // Si mandan una tabla de picar, la app la cotiza aparte (Cotizar → Tabla de picar).
    return json({ key: item.key, values, explanation: out.explicacion, assumptions: out.supuestos.slice(0, 8), confidence: out.confianza })
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'api', message: 'No se entendió la respuesta del asistente. Intenta de nuevo.' }, 502)
    if (error instanceof Anthropic.AuthenticationError) return json({ error: 'llave', message: 'La llave de Anthropic del servidor no es válida. Revísala en Vercel.' }, 503)
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'limite', message: 'Hay muchas peticiones a la vez. Espera un momento e intenta de nuevo.' }, 429)
    if (error instanceof Anthropic.APIError) return json({ error: 'api', message: 'El asistente no pudo analizar la foto. Intenta de nuevo en un momento.' }, 502)
    return json({ error: 'conexion', message: 'No se pudo conectar con el asistente. Intenta de nuevo.' }, 502)
  }
}
