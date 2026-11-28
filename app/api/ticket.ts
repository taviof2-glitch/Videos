// Ticket de compra: Claude lee la foto del ticket (maderería, ferretería…) y saca proveedor, fecha, total y artículos.
// Cada artículo se relaciona con el «Material del taller» que ya existe, si se parece. Nada se guarda aquí:
// la app muestra lo leído para revisarlo y solo lo registra si la persona confirma.
import Anthropic from '@anthropic-ai/sdk'
import { allowed } from './_auth.js'

export const config = { maxDuration: 60 }

const MAX_IMAGE = 4_000_000
const MAX_MATERIALS = 200

type Material = { id: string; name: string; unit: string }

const SYSTEM = `Eres el ayudante de una carpintería de muebles de melamina en Tepatitlán, Jalisco. Te mandan la foto de un ticket o nota de compra (maderería, ferretería, tlapalería, herrajes) y la lista del material que el taller lleva en existencia.

Tu trabajo: leer el ticket y regresar sus datos.

Reglas:
- Copia lo que dice el ticket; no inventes artículos ni precios. Si algo no se lee, ponlo lo más probable y dilo en "dudas".
- "proveedor": el nombre de la tienda (sin RFC, dirección ni «S.A. de C.V.»). Si es uno de la lista de proveedores del taller, usa exactamente ese nombre (p. ej. «MAXIMADERAS SA DE CV» es «Maximaderas»). Vacío si no se ve.
- "fecha": AAAA-MM-DD si se ve; vacío si no.
- Precios en pesos mexicanos. "precio_unitario" es por pieza/hoja/metro; si el ticket solo trae el importe de la línea, divídelo entre la cantidad.
- "total": el total a pagar del ticket (con IVA si lo trae).
- "material_id": el id de la lista de material del taller que es el mismo artículo (p. ej. «MELAMINA BCO 15MM 1.22X2.44» es «Hoja de melamina 15 mm»). Vacío si no hay uno igual.
- "nombre": un nombre corto y claro en español para el artículo, como lo diría un carpintero (p. ej. «Hoja de melamina blanca 15 mm», «Bisagra cierre suave»).
- "unidad": hojas, piezas, pares, metros, litros o cajas.
- "es_material": false para cosas que no son material del taller (refrescos, gasolina, comisiones, envío).`

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!token) return json({ error: 'sin_sesion', message: 'Entra a tu cuenta en «Cuenta y nube» para usar el asistente.' }, 401)
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'sin_llave', message: 'El asistente todavía no está activado: falta la llave de Anthropic en el servidor.' }, 503)

  let body: { image?: string; mediaType?: string; materials?: Material[]; suppliers?: string[] }
  try {
    body = ((await request.json()) ?? {}) as typeof body
  } catch {
    return json({ error: 'peticion', message: 'La petición no es válida.' }, 400)
  }
  const image = typeof body.image === 'string' ? body.image : ''
  const mediaType = body.mediaType === 'image/png' ? 'image/png' : 'image/jpeg'
  const materials = (Array.isArray(body.materials) ? body.materials : []).filter((m) => m && typeof m.id === 'string' && typeof m.name === 'string').slice(0, MAX_MATERIALS)
  if (!image) return json({ error: 'peticion', message: 'Manda la foto del ticket.' }, 400)
  if (image.length > MAX_IMAGE) return json({ error: 'largo', message: 'La foto pesa demasiado. Toma otra o recórtala.' }, 413)

  try {
    if (!(await allowed(token))) return json({ error: 'sin_permiso', message: 'Tu sesión no tiene un negocio en la cuenta. Entra de nuevo en «Cuenta y nube».' }, 403)
  } catch {
    return json({ error: 'servidor', message: 'No se pudo comprobar tu sesión. Intenta de nuevo.' }, 502)
  }

  const suppliers = (Array.isArray(body.suppliers) ? body.suppliers : []).filter((s) => typeof s === 'string').map((s) => s.slice(0, 80)).slice(0, 100)
  const ids = materials.map((m) => m.id)
  const list = materials.map((m) => `- ${m.id}: ${m.name.slice(0, 80)} (${m.unit.slice(0, 20)})`).join('\n') || '(todavía no hay material registrado)'
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
    { type: 'text', text: `<material_del_taller>\n${list}\n</material_del_taller>\n<proveedores_del_taller>\n${suppliers.join('\n') || '(ninguno)'}\n</proveedores_del_taller>\n\nLee el ticket de la foto.` },
  ]
  const schema = {
    type: 'object',
    properties: {
      proveedor: { type: 'string' },
      fecha: { type: 'string' },
      total: { type: 'number' },
      lineas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            texto_ticket: { type: 'string' },
            nombre: { type: 'string' },
            cantidad: { type: 'number' },
            unidad: { type: 'string', enum: ['hojas', 'piezas', 'pares', 'metros', 'litros', 'cajas'] },
            precio_unitario: { type: 'number' },
            material_id: { type: 'string' },
            es_material: { type: 'boolean' },
          },
          required: ['texto_ticket', 'nombre', 'cantidad', 'unidad', 'precio_unitario', 'material_id', 'es_material'],
          additionalProperties: false,
        },
      },
      dudas: { type: 'array', items: { type: 'string' } },
    },
    required: ['proveedor', 'fecha', 'total', 'lineas', 'dudas'],
    additionalProperties: false,
  }

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.create({
      // Fotos: Claude Sonnet 5.5. Si declina, la API reintenta con su respaldo.
      model: 'claude-sonnet-5-5',
      max_tokens: 6000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })
    if (response.stop_reason === 'refusal') return json({ error: 'rechazo', message: 'No pude leer esa foto. Prueba con otra.' }, 200)
    if (response.stop_reason === 'max_tokens') return json({ error: 'corte', message: 'El ticket es muy largo. Toma la foto en dos partes.' }, 502)
    const raw = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const out = JSON.parse(raw) as { proveedor: string; fecha: string; total: number; lineas: { texto_ticket: string; nombre: string; cantidad: number; unidad: string; precio_unitario: number; material_id: string; es_material: boolean }[]; dudas: string[] }
    const lines = out.lineas.slice(0, 60).map((l) => ({
      text: l.texto_ticket.slice(0, 120), name: l.nombre.slice(0, 80) || l.texto_ticket.slice(0, 80), quantity: Math.max(0, Math.round(l.cantidad * 100) / 100), unit: l.unidad,
      unitCents: Math.max(0, Math.round(l.precio_unitario * 100)), materialId: ids.includes(l.material_id) ? l.material_id : '', isMaterial: l.es_material,
    }))
    return json({ supplier: out.proveedor.slice(0, 80), date: /^\d{4}-\d{2}-\d{2}$/.test(out.fecha) ? out.fecha : '', totalCents: Math.max(0, Math.round(out.total * 100)), lines, doubts: out.dudas.slice(0, 6) })
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'api', message: 'No se entendió la respuesta del asistente. Intenta de nuevo.' }, 502)
    if (error instanceof Anthropic.AuthenticationError) return json({ error: 'llave', message: 'La llave de Anthropic del servidor no es válida. Revísala en Vercel.' }, 503)
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'limite', message: 'Hay muchas peticiones a la vez. Espera un momento e intenta de nuevo.' }, 429)
    if (error instanceof Anthropic.APIError) return json({ error: 'api', message: 'El asistente no pudo leer el ticket. Intenta de nuevo en un momento.' }, 502)
    return json({ error: 'conexion', message: 'No se pudo conectar con el asistente. Intenta de nuevo.' }, 502)
  }
}
