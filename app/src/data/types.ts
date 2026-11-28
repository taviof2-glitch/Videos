/** Todos los importes son enteros en centavos. Las fechas son ISO UTC. */
export interface Business {
  id: string
  name: string
  category: string
  country: string
  currency: string
  timezone: string
  phone: string
  address: string
  openingHours: string
  /** Logo del negocio como data URI (PNG o JPEG, ≤ 320 px). Sale en comprobantes y cotizaciones; viaja con la fila. */
  logo?: string
  /** Mensaje de bienvenida en el catálogo público. */
  catalogNote?: string
  /** Enlace de la página pública del catálogo, para compartirlo. */
  catalogUrl?: string
  /** Costos y tipos de trabajo del cotizador rápido (ver quoter.ts); lo que falta usa los valores iniciales. */
  quoter?: { cfg?: Partial<import('./quoter').QuoterConfig>; types?: Record<string, import('./quoter').JobType>; /** Materiales con su precio por hoja. */ mats?: import('./quoter').Mat[]; /** Servicios extra encendidos y sus precios. */ serv?: import('./services').ServConfig; /** Costos propios de cada trabajo (lo que falta usa el general). */ over?: import('./quoter').JobOverrides }
  /** Pagos habituales del taller (renta, luz, sueldos…); cada pago hecho es un gasto normal enlazado por `fixedId`. */
  fixedPayments?: FixedPayment[]
  /** Material del taller (hojas, herrajes, retazos) con existencias y precios por proveedor (ver materials.ts). */
  materials?: WorkMaterial[]
  /** Factura electrónica (opcional, con Facturapi): si está activa, sus datos para timbrar. */
  invoicing?: InvoicingSettings
  /** Retazos de hoja en el taller (ver materialUse.ts). */
  offcuts?: Offcut[]
  /** Muestrario de colores de melamina con foto. */
  swatches?: Swatch[]
  /** Maquinaria del taller y su mantenimiento. */
  machines?: Machine[]
  /** Código del enlace público de la galería de trabajos (/g/<código>). */
  galleryToken?: string
  /** Enlace para dejar reseña en Google (se manda a los clientes después de entregar). */
  reviewUrl?: string
  /** Meta de ventas del mes (centavos). */
  monthGoalCents?: number
  /** Datos para que los clientes paguen (salen en cotizaciones, comprobantes y enlaces). */
  payInfo?: PayInfo
  /** Cotizador en línea para clientes (/cotiza/<código>): precio por metro de cada tipo de mueble (centavos). */
  leadToken?: string
  leadPrices?: Record<string, number>
  /** Muebles favoritos de Bases para cotizar con un toque. */
  favorites?: { name: string; state: unknown }[]
  /** Para estimar impuestos del mes (aproximado; no sustituye al contador). */
  tax?: { regime: 'resico' | 'actividad' | 'ninguno'; chargesIva: boolean; /** % de los gastos que tienen factura. */ invoicedPct: number }
  createdAt: string
  updatedAt: string
}

export interface InvoicingSettings {
  enabled: boolean
  /** Código postal del domicilio fiscal del negocio (se usa en facturas a público en general). */
  zip: string
  /** Clave de producto o servicio del SAT para los conceptos (01010101 si no se eligió). */
  productKey: string
  /** Los precios de las ventas ya traen IVA (lo normal). */
  taxIncluded: boolean
}

/** Datos fiscales de un cliente para facturarle (el RFC va en `documentId`). */
export interface FiscalData {
  /** Razón social exacta, como en su constancia de situación fiscal. */
  legalName: string
  taxSystem: string
  zip: string
  email?: string
  use?: string
}

/** Factura timbrada de una venta. */
export interface SaleInvoice {
  id: string
  uuid: string
  series: string
  folio: string
  at: string
  test?: boolean
  canceled?: boolean
}

/** Un material del taller. */
export interface WorkMaterial {
  id: string
  name: string
  /** hojas, piezas, pares, metros… */
  unit: string
  stock: number
  /** Si baja de aquí, hay que comprar. */
  min?: number
  /** A cuánto lo vende cada proveedor (centavos por unidad). */
  prices: { supplier: string; priceCents: number }[]
  /** Precios de cada compra (de los tickets), para ver cómo han subido. Los últimos 24. */
  history?: { supplier: string; priceCents: number; date: string }[]
}

export type FixedFreq = 'semanal' | 'quincenal' | 'mensual' | 'bimestral' | 'anual'

/** Un pago habitual del taller. */
export interface FixedPayment {
  id: string
  name: string
  /** Lo que se paga cada vez (aproximado: al registrar el pago se pone lo real). */
  amountCents: number
  freq: FixedFreq
  /** Día del mes en que vence (mensual, bimestral, anual). */
  day?: number
  /** Mes (1–12) en que toca: el anual, ese mes; el bimestral, ese y cada dos meses. */
  month?: number
}

export interface Meta {
  key: string
  value: string
}

/** Campos comunes a las filas que se sincronizarán (T15). */
interface Row {
  id: string
  businessId: string
  createdAt: string
  updatedAt: string
  /** Borrado lógico: la fila se oculta pero se conserva para el historial y la sincronización. */
  deletedAt?: string
  /** T13: empleado (o dueño con PIN) que lo registró; falta si no había control de usuarios o vino del catálogo. */
  createdBy?: string
}

export interface Category extends Row {
  kind: 'product' | 'expense'
  name: string
}

export interface Product extends Row {
  name: string
  /** '' si no tiene. Único por negocio entre los productos no borrados. */
  barcode: string
  categoryId?: string
  priceCents: number
  costCents: number
  /** Caché de la suma de StockMovement.delta; solo cambia junto con un movimiento. Admite decimales (kg, m). */
  stock: number
  /** 0 = sin alerta de stock bajo. */
  minStock: number
  /** Hasta 3 imágenes ya reducidas a 500×500. */
  photos: Blob[]
  /** T15: rutas de las fotos en Storage (viajan con el producto; los Blob de `photos` quedan en el dispositivo). */
  photoPaths?: string[]
  /** Texto que se muestra en el catálogo público. */
  description?: string
  /** Si el producto sale en el catálogo público. */
  visibleInCatalog?: boolean
  /** Sobre pedido: se fabrica al venderlo. No lleva stock, nunca sale agotado ni pide reabastecer. */
  madeToOrder?: boolean
  /** Con variantes, `stock` es la suma de todas y cada variante lleva su propio stock (ver variants.ts). */
  hasVariants?: boolean
  /** Atributos que generan las variantes, p. ej. [{ name: 'Color', values: ['Natural', 'Nogal'] }]. Hasta 2. */
  variantAttributes?: { name: string; values: string[] }[]
}

/** Una combinación de atributos de un producto (p. ej. "Nogal / Grande") con su propio stock. */
export interface ProductVariant extends Row {
  productId: string
  /** Un valor por atributo, en el mismo orden que `variantAttributes`. */
  values: string[]
  /** Los valores unidos: "Nogal / Grande". */
  name: string
  barcode: string
  /** Si falta, se usa el precio o el costo del producto. */
  priceCents?: number
  costCents?: number
  stock: number
  minStock: number
  position: number
}

export type StockReason = 'sale' | 'purchase' | 'adjust' | 'order' | 'void'

export interface StockMovement {
  id: string
  businessId: string
  productId: string
  /** En productos con variantes, a qué variante corresponde. */
  variantId?: string
  transactionId?: string
  delta: number
  reason: StockReason
  createdAt: string
}

export type ContactType = 'customer' | 'supplier'

export interface Contact extends Row {
  type: ContactType
  name: string
  /** '' si no tiene. Se guarda como lo escribió el usuario; los enlaces de WhatsApp lo normalizan (T6). */
  phone: string
  /** RFC, CURP u otro documento. */
  documentId: string
  notes: string
  /** Dirección (para ir a medir, instalar o entregar); falta en contactos viejos. */
  address?: string
  /** Datos fiscales para facturarle (solo si se ha facturado). */
  fiscal?: FiscalData
}

export type AppointmentKind = 'medir' | 'instalar' | 'entregar' | 'otro'

/** Cita de la agenda: ir a medir, instalar, entregar u otra. */
export interface Appointment extends Row {
  kind: AppointmentKind
  /** Día (AAAA-MM-DD) y hora opcional (HH:MM), en la hora del negocio. */
  date: string
  time?: string
  contactId?: string
  /** A quién se visita si no es un cliente guardado, o qué se va a hacer. */
  title: string
  address: string
  note: string
  /** Obra, cotización o venta relacionada (id). */
  linkId?: string
  done?: boolean
  /** Cosas ya revisadas de la lista para salir a instalar. */
  checked?: string[]
}

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'other'

/** Venta o gasto. Los importes son centavos. `status` siempre es 'paid' hasta T6 (fiados). */
export interface Transaction extends Row {
  type: 'sale' | 'expense'
  amountCents: number
  /** Texto libre; en ventas con productos se genera a partir de los productos si no se escribe. */
  concept: string
  /** Cuándo ocurrió (ISO UTC); se puede registrar con fecha pasada. */
  date: string
  paymentMethod: PaymentMethod
  status: 'paid' | 'credit'
  /** Cliente (venta) o proveedor (gasto). */
  contactId?: string
  /** Solo gastos. */
  categoryId?: string
  dueDate?: string
  /** Si este gasto lo originó una compra (ver purchases.ts); solo se edita o anula desde la compra. */
  purchaseId?: string
  /** Si este gasto es un pago habitual del taller (ver fixed.ts). */
  fixedId?: string
  /** Solo gastos: la obra para la que se compró (id de la cotización o venta que es obra); suma a su costo real. */
  jobId?: string
  /** Si esta venta la originó un pedido (ver orders.ts); solo se edita o anula desde el pedido. */
  orderId?: string
  /** Solo ventas: si es un encargo que se sigue en Obras (ver jobs.ts). */
  job?: QuoteJob
  /** Solo ventas: factura electrónica timbrada. */
  invoice?: SaleInvoice
}

/** Línea de una venta, con precio y costo "congelados" al momento de vender. */
export interface TransactionItem {
  id: string
  transactionId: string
  productId?: string
  variantId?: string
  name: string
  quantity: number
  unitPriceCents: number
  unitCostCents: number
  /** Orden de la línea dentro de la venta (0, 1, 2…). Las filas anteriores a T7 no lo tienen. */
  position?: number
  /** Descuento de la línea en centavos (el importe es cantidad × precio − descuento). Falta = sin descuento. */
  discountCents?: number
}

/**
 * Abono de un cliente (entra dinero) o pago a un proveedor (sale dinero) contra una venta o gasto a crédito.
 * Un abono grande se reparte entre las deudas más antiguas: una fila por deuda, todas con el mismo `batchId`.
 */
export interface Payment extends Row {
  transactionId: string
  contactId: string
  batchId: string
  direction: 'in' | 'out'
  amountCents: number
  method: PaymentMethod
  date: string
}

export type QuoteStatus = 'pending' | 'accepted' | 'rejected' | 'converted'

/** Cotización por pieza. Los totales se guardan al guardar (los precios no cambian aunque cambie el inventario). */
export interface Quote extends Row {
  /** Color o acabado que escogió el cliente (del muestrario). */
  color?: string
  /** Consecutivo por negocio; no se reutiliza al borrar. */
  number: number
  /** T15: número provisional (creada sin conexión); el servidor asigna el definitivo al subirla. */
  numberPending?: boolean
  title: string
  contactId: string
  /** Última fecha de vigencia, 'YYYY-MM-DD'. */
  validUntil: string
  status: QuoteStatus
  /** Porcentaje de IVA (16 = 16 %); 0 = sin IVA. */
  taxRate: number
  /** Suma de los descuentos de las líneas (ya restada del subtotal). */
  discountCents: number
  subtotalCents: number
  taxCents: number
  totalCents: number
  /** Anticipo que se pide, en centavos (0 = sin anticipo). Al convertir en venta se propone como abono. */
  advanceCents: number
  /** Fecha estimada de pago del resto, 'YYYY-MM-DD'. */
  payBy?: string
  notes: string
  /** Venta en que se convirtió. */
  transactionId?: string
  /** Si salió del cotizador rápido: los datos para volver a abrirla y cambiarla. */
  quoter?: QuoterSnapshot
  /** Si ya es una obra del taller: en qué etapa va, cuándo se entrega y lo que costó de verdad (ver jobs.ts). */
  job?: QuoteJob
  /** Hasta qué día se conserva aunque no se concrete ('YYYY-MM-DD'); sin esto, 30 días desde que se hizo. */
  keepUntil?: string
  /** Días en que se le dio seguimiento al cliente ('YYYY-MM-DD'). */
  followUps?: string[]
  /** Opciones para el cliente (Básica, Media, Premium…): precio total de cada una. */
  options?: QuoteOption[]
  /** La opción que eligió el cliente (índice en `options`). */
  chosenOption?: number
  /** Ya se agregó a la cotización la diferencia de la opción elegida. */
  optionApplied?: boolean
  /** Código del enlace para que el cliente la vea y la acepte (/c/<código>); solo si se compartió. */
  shareToken?: string
  /** Cuándo la aceptó el cliente desde el enlace. */
  acceptedOnline?: string
}

export interface QuoteOption {
  name: string
  priceCents: number
  desc: string
}

export interface PayInfo {
  bank: string
  clabe: string
  holder: string
  /** Enlace de pago con tarjeta (Mercado Pago, etc.), opcional. */
  link?: string
}

export type JobStage = 'anticipo' | 'material' | 'corte' | 'armado' | 'listo' | 'instalado' | 'liquidado'

/** El seguimiento de una obra. */
export interface QuoteJob {
  stage: JobStage
  startedAt: string
  /** Fecha prometida de entrega o instalación, 'YYYY-MM-DD'. */
  deliveryDate?: string
  note?: string
  /** Lo que de verdad se gastó en material (centavos) y las horas que de verdad llevó. */
  realMaterialCents?: number
  realHours?: number
  /** Día en que se entregó o instaló, 'YYYY-MM-DD' (se pone solo al llegar a «instalado»). */
  deliveredAt?: string
  /** Meses de garantía desde la entrega. */
  warrantyMonths?: number
  /** Fotos de la obra (JPEG reducido como data URI; máximo 4 para que la fila viaje ligera). */
  photos?: string[]
  /** Ya lo liquidaron (pagó todo) aunque no se haya entregado. Se marca a mano cuando no hay abonos registrados. */
  paid?: boolean
  /** Código del enlace público de seguimiento (/s/<código>); solo existe si se compartió. */
  trackToken?: string
  /** Material del taller que ya se descontó por esta obra (para no descontarlo dos veces y poder deshacerlo). */
  materialUse?: MaterialUse
  /** Sale en la galería pública de trabajos (solo si se marca; son fotos de casas de clientes). */
  gallery?: boolean
  /** Foto del espacio antes de hacer el mueble (para el antes y después). */
  before?: string
  /** Días (AAAA-MM-DD) en que se planeó trabajar esta obra en el taller. */
  planDays?: string[]
  /** Material agregado a mano a la obra (además del que sale de su cotización). */
  extraMaterial?: { name: string; qty: number; unit: string }[]
  /** Lista de material editada a mano: si existe, manda sobre el cálculo (cada renglón puede apuntar a un material del taller). */
  materialList?: { name: string; qty: number; unit: string; materialId?: string }[]
  /** Postventa: día en que se le pidió reseña y en que se le ofreció el ajuste de los 6 meses. */
  reviewAsked?: string
  adjustOffered?: string
}

export interface MaterialUse {
  at: string
  lines: { materialId: string; name: string; qty: number; unit: string; costCents: number }[]
  /** Retazos que dejó la obra (ids en `Business.offcuts`). */
  offcutIds: string[]
}

/** Retazo (pedacera) de tablero o fondo que sobró de un mueble y se puede aprovechar en otro. Medidas en mm. */
export interface Offcut {
  id: string
  /** Largo y ancho en mm (el largo es el lado mayor). */
  l: number
  a: number
  /** Grosor en mm (15, 16, 18, 3…). */
  esp: number
  /** Color o acabado, p. ej. «Blanco», «Nogal Tzalam». */
  color: string
  kind: 'tablero' | 'fondo'
  /** De qué mueble u obra salió, y de qué hoja. */
  from?: string
  sheet?: number
  at: string
}

/** Lo que se capturó en el cotizador rápido (el costo es el mínimo para no perder; no se muestra al cliente). */
export interface QuoterSnapshot {
  /** Tabla de picar (cm). */
  board?: import('./quoter').BoardSpec
  type: string
  q: number
  suave: boolean
  pint: boolean
  cub: boolean
  km: number
  xmat: number
  xhrs: number
  desc: string
  delivery: string
  iva: boolean
  costCents: number
  /** Escritorio a la medida: medidas en cm y cajones. */
  desk?: { largo: number; fondo: number; alto: number; cajones: number }
  /** Closet sencillo abierto (cm). */
  simple?: import('./quoter').SimpleCloset
  /** Mueble cotizado por medidas (cocina, closet, TV): lo mismo que usa el despiece. */
  med?: import('./cutlist').CutSpec
  /** El despiece guardado con la cotización: las medidas con que se hizo y sus piezas (no se manda al cliente). */
  /** Material elegido (nombre de la lista de materiales); falta = el de siempre. */
  mat?: string
  /** false si los demás muebles del proyecto no se suman al precio. */
  sumMore?: boolean
  /** Si el boceto del mueble va dentro de la cotización que recibe el cliente (imagen y PDF). */
  sketch?: boolean
  /** Si salió de la pestaña Bases: el mueble, sus medidas y opciones (para volver a abrirlo ahí). */
  base?: import('./bases').BaseState
  /** Si salió de la pestaña Servicios: el servicio y sus valores. */
  serv?: import('./services').ServState
  /** Si junta varias partidas (muebles de Bases y servicios). */
  parts?: import('./services').Part[]
  cut?: { spec: import('./cutlist').CutSpec; /** Los demás muebles del proyecto, acomodados en las mismas hojas. */ more?: import('./cutlist').CutSpec[]; girar: boolean; pieces: import('./cutlist').Piece[] }
}

export interface QuoteItem {
  id: string
  quoteId: string
  position: number
  productId?: string
  variantId?: string
  name: string
  unit: string
  /** Piezas. En un artículo por área, la cantidad cobrada son m² = ancho × alto × piezas. */
  quantity: number
  unitPriceCents: number
  /** Descuento de la línea: porcentaje (0-100) o monto en centavos. */
  discountType?: 'percent' | 'amount'
  discountValue?: number
  /** Medidas en metros; solo en artículos por área (sin inventario). */
  width?: number
  height?: number
}

/** Entrada de mercancía de un proveedor. Crea un gasto (`transactionId`) que es el que cuenta en el balance o en las deudas. */
export interface Purchase extends Row {
  supplierId?: string
  date: string
  totalCents: number
  /** Gasto que originó esta compra (contado o a crédito). */
  transactionId: string
  notes: string
}

export interface PurchaseItem {
  id: string
  purchaseId: string
  position: number
  productId: string
  variantId?: string
  name: string
  quantity: number
  unitCostCents: number
  /** Costo del producto justo antes y después de esta compra, para poder revertirlo al anularla. */
  costBeforeCents: number
  costAfterCents: number
}

export type OrderStatus = 'pending' | 'processing' | 'paid' | 'cancelled'

/** Pedido de un cliente (casi siempre llegado por el catálogo y WhatsApp). Al cobrarse crea una venta. */
export interface Order extends Row {
  /** Consecutivo por negocio; no se reutiliza. */
  number: number
  /** T15: número provisional (creado sin conexión); el servidor asigna el definitivo al subirlo. */
  numberPending?: boolean
  customerName: string
  notes: string
  status: OrderStatus
  totalCents: number
  source: 'catalog' | 'manual' | 'web'
  /** Venta creada al cobrarlo. */
  transactionId?: string
}

export interface OrderItem {
  id: string
  orderId: string
  position: number
  productId: string
  variantId?: string
  name: string
  quantity: number
  /** El precio que vio el cliente al pedir. */
  unitPriceCents: number
}

/** T13: persona que usa la app en el aparato. El dueño también tiene una fila (con su PIN) cuando se enciende el control de usuarios. */
export interface Employee extends Row {
  name: string
  role: 'owner' | 'employee'
  /** Qué puede hacer además de vender, cobrar y ver clientes (el dueño siempre puede todo). */
  permissions: ('balance' | 'expenses' | 'inventory' | 'void')[]
  active: boolean
  /** PBKDF2-SHA256 del PIN con su sal; el PIN nunca se guarda. */
  pinSalt: string
  pinHash: string
}

export interface Swatch {
  id: string
  name: string
  supplier: string
  /** Grosores en que se consigue (mm), p. ej. [16, 15]. */
  esp: number[]
  /** Foto (data URI, chica). */
  photo?: string
}

export interface MachineTask {
  id: string
  name: string
  everyDays: number
  lastDone?: string
}

export interface Machine {
  id: string
  name: string
  tasks: MachineTask[]
}
