// Acciones que el asistente puede preparar. Ninguna se guarda en el servidor: la app las muestra y solo las hace si la persona confirma.
import type Anthropic from '@anthropic-ai/sdk'

const str = (description: string) => ({ type: 'string', description })
const num = (description: string) => ({ type: 'number', description })
const metodo = { type: 'string', enum: ['efectivo', 'transferencia', 'tarjeta', 'otro'] }

function tool(name: string, description: string, properties: Record<string, unknown>): Anthropic.Tool {
  return { name, description, strict: true, input_schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false } }
}

export const TOOLS: Anthropic.Tool[] = [
  tool('proponer_venta', 'Prepara una venta. Úsala cuando pidan registrar o agregar una venta y ya sepas cliente (o que es sin cliente), qué se vendió, cantidad y precio. Las ventas fiadas necesitan cliente.', {
    cliente: str('Nombre del cliente; vacío si es venta de mostrador sin cliente.'),
    cliente_id: str('El id corto del cliente si ya existe en el resumen; vacío si es nuevo.'),
    telefono: str('Teléfono del cliente nuevo si lo dieron; vacío si no.'),
    productos: {
      type: 'array',
      items: {
        type: 'object',
        properties: { nombre: { type: 'string' }, producto_id: str('Id corto si ya existe; vacío si es nuevo.'), cantidad: { type: 'number' }, precio: num('Precio por pieza en pesos.'), medidas: str('Medidas o detalles; vacío si no.') },
        required: ['nombre', 'producto_id', 'cantidad', 'precio', 'medidas'],
        additionalProperties: false,
      },
    },
    pago: { type: 'string', enum: ['contado', 'fiado'] },
    metodo,
    anticipo: num('Anticipo en pesos si es fiado; 0 si no.'),
    encargo: { type: 'boolean', description: 'true si es un trabajo por encargo que falta hacer o entregar (se sigue en Obras).' },
  }),
  tool('proponer_gasto', 'Prepara un gasto del negocio (material, renta, gasolina, sueldo, etc.).', {
    concepto: str('Qué se pagó.'),
    monto: num('Monto en pesos.'),
    categoria: str('Categoría del gasto (de la lista del resumen si cabe); vacío si no aplica.'),
    proveedor: str('Proveedor; vacío si no hay.'),
    proveedor_id: str('Id corto del proveedor si ya existe; vacío si es nuevo o no hay.'),
    pago: { type: 'string', enum: ['contado', 'credito'] },
    metodo,
  }),
  tool('proponer_abono', 'Prepara un abono: lo que pagó un cliente de lo que debe, o lo que se le pagó a un proveedor.', {
    nombre: str('Nombre del cliente o proveedor.'),
    contacto_id: str('Id corto si está en el resumen; vacío si no.'),
    de: { type: 'string', enum: ['cliente', 'proveedor'] },
    monto: num('Monto en pesos.'),
    metodo,
  }),
  tool('proponer_cotizacion', 'Prepara una cotización nueva para un cliente.', {
    cliente: str('Nombre del cliente.'),
    cliente_id: str('Id corto si ya existe; vacío si es nuevo.'),
    telefono: str('Teléfono del cliente nuevo; vacío si no.'),
    titulo: str('Título corto, p. ej. «Cocina integral».'),
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { nombre: { type: 'string' }, producto_id: str('Id corto si es un producto del inventario; vacío si no.'), cantidad: { type: 'number' }, precio: num('Precio por pieza en pesos.') },
        required: ['nombre', 'producto_id', 'cantidad', 'precio'],
        additionalProperties: false,
      },
    },
    anticipo: num('Anticipo que se pide en pesos; 0 si no.'),
    iva: { type: 'boolean', description: 'true si lleva IVA.' },
    vigencia_dias: num('Días de vigencia; 15 si no dicen.'),
  }),
  tool('proponer_estado_cotizacion', 'Cambia una cotización existente: marcarla aceptada o rechazada, o pasarla a obra.', {
    numero: num('El número de la cotización (#n del resumen).'),
    estado: { type: 'string', enum: ['aceptada', 'rechazada', 'obra'] },
  }),
  tool('proponer_obra', 'Cambia una obra del taller: su etapa, fecha de entrega, nota, o marcar que ya la liquidaron.', {
    referencia: str('Cómo identificarla: folio (#n), cliente o título, tal como viene en el resumen.'),
    etapa: { type: 'string', enum: ['', 'anticipo', 'material', 'corte', 'armado', 'listo', 'instalado', 'liquidado'], description: 'Nueva etapa; vacío para no cambiarla. anticipo = pedido recibido.' },
    fecha_entrega: str('Nueva fecha AAAA-MM-DD; vacío para no cambiarla.'),
    nota: str('Nota nueva; vacío para no cambiarla.'),
    liquidado: { type: 'string', enum: ['', 'si', 'no'], description: 'si = ya pagó todo; vacío para no cambiarlo.' },
  }),
  tool('proponer_pago_taller', 'Registra un pago habitual del taller (renta, luz, sueldos…) de la lista del resumen.', {
    nombre: str('Nombre del pago habitual tal como viene en el resumen.'),
    monto: num('Monto pagado en pesos.'),
    metodo,
  }),
  tool('proponer_producto', 'Crea un producto del inventario o cambia uno existente (precio, costo, existencias, sobre pedido).', {
    nombre: { type: 'string' },
    producto_id: str('Id corto si ya existe; vacío si es nuevo.'),
    precio: num('Precio de venta en pesos; -1 para no cambiarlo.'),
    costo: num('Costo en pesos; -1 para no cambiarlo.'),
    existencias: num('Cantidad disponible; -1 para no cambiarla.'),
    sobre_pedido: { type: 'string', enum: ['', 'si', 'no'], description: 'si = se fabrica sobre pedido (sin existencias); vacío para no cambiarlo.' },
    descripcion: str('Medidas o descripción; vacío para no cambiarla.'),
  }),
  tool('proponer_contacto', 'Crea un cliente o proveedor, o cambia su teléfono.', {
    nombre: { type: 'string' },
    contacto_id: str('Id corto si ya existe; vacío si es nuevo.'),
    tipo: { type: 'string', enum: ['cliente', 'proveedor'] },
    telefono: str('Teléfono; vacío para no cambiarlo.'),
  }),
]

export const TOOL_NAMES = new Set(TOOLS.map((t) => t.name))
