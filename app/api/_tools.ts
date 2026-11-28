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
    horas_reales: num('Horas de trabajo reales que llevó la obra; -1 para no cambiarlas.'),
    material_real: num('Lo que costó de verdad el material en pesos; -1 para no cambiarlo.'),
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
  tool('proponer_cita', 'Agenda una cita: ir a medir, instalar, entregar u otra.', {
    tipo: { type: 'string', enum: ['medir', 'instalar', 'entregar', 'otro'] },
    fecha: str('Día AAAA-MM-DD (calcula «mañana», «el jueves», etc. con la fecha de hoy del resumen).'),
    hora: str('Hora HH:MM en 24 h; vacío si no dijeron.'),
    cliente: str('Nombre del cliente; vacío si no es un cliente.'),
    cliente_id: str('Id corto si ya existe; vacío si no.'),
    titulo: str('Qué se va a hacer, p. ej. «Closet de recámara».'),
    direccion: str('Dirección; vacío si no la dieron (se usa la del cliente si la tiene).'),
    nota: str('Nota; vacío si no hay.'),
  }),
  tool('proponer_estado_cita', 'Marca una cita de la agenda como hecha o la desmarca.', {
    cita_id: str('El id corto de la cita del resumen (lo que va después de «cita»).'),
    hecha: { type: 'boolean' },
  }),
  tool('proponer_material', 'Cambia el material del taller (hojas, bisagras, correderas…): sumar o restar existencias, fijar existencia o mínimo, o darlo de alta.', {
    nombre: str('Nombre del material tal como viene en el resumen, o el nuevo.'),
    cambio: num('Cuánto sumar (positivo) o restar (negativo) a la existencia; 0 si no.'),
    existencia: num('Existencia exacta a poner; -1 para no fijarla.'),
    minimo: num('Mínimo para avisar que hay que comprar; -1 para no cambiarlo.'),
    unidad: str('hojas, piezas, pares, metros, litros o cajas; vacío para no cambiarla.'),
  }),
  tool('proponer_retazo', 'Guarda un sobrante (retazo) en la retacera.', {
    largo_mm: num('Largo en milímetros.'),
    ancho_mm: num('Ancho en milímetros.'),
    grosor_mm: num('Grosor en mm (16, 15, 18, 3…).'),
    color: str('Color o acabado, p. ej. «Blanco».'),
    tipo: { type: 'string', enum: ['tablero', 'fondo'] },
  }),
  tool('proponer_mensaje', 'Prepara un mensaje de WhatsApp para un cliente o proveedor (recordar saldo, confirmar cita, seguimiento de cotización, pedir reseña, campaña…). Se abre WhatsApp con el texto solo cuando la persona toca el botón.', {
    nombre: str('A quién va.'),
    contacto_id: str('Id corto si está en el resumen; vacío si no.'),
    telefono: str('Teléfono si lo dieron y no está guardado; vacío si no.'),
    texto: str('El mensaje completo, cordial y corto.'),
  }),
  tool('abrir_pantalla', 'Lleva a una pantalla de la app cuando lo que piden se hace mejor ahí (ver la ruta del día, lista para instalar, campañas, Bases y despiece, retacera, vista 3D, galería, corte, estadísticas, respaldos, datos del negocio, etc.).', {
    pantalla: { type: 'string', enum: ['inicio', 'agenda', 'obras', 'cotizaciones', 'cotizador', 'material', 'campanas', 'galeria', 'corte', 'estadisticas', 'pedidos', 'clientes', 'proveedores', 'inventario', 'compras', 'pagos', 'deudas', 'negocio', 'mas', 'catalogo', 'balance', 'cuenta'] },
    motivo: str('Qué va a encontrar ahí, en una frase.'),
  }),
  tool('proponer_meta_mes', 'Pone o cambia la meta de ventas del mes.', { monto: num('Meta en pesos; 0 para quitarla.') }),
  tool('proponer_precio_linea', 'Cambia el precio por metro de un mueble en el cotizador en línea para clientes.', {
    tipo: { type: 'string', enum: ['closet', 'cocina', 'tv', 'librero', 'bano', 'escritorio'] },
    precio_por_metro: num('Precio por metro en pesos.'),
  }),
]

export const TOOL_NAMES = new Set(TOOLS.map((t) => t.name))
