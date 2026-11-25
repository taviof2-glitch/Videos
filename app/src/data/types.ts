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
  /** Mensaje de bienvenida en el catálogo público. */
  catalogNote?: string
  /** Enlace de la página pública del catálogo, para compartirlo. */
  catalogUrl?: string
  createdAt: string
  updatedAt: string
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
  /** Texto que se muestra en el catálogo público. */
  description?: string
  /** Si el producto sale en el catálogo público. */
  visibleInCatalog?: boolean
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
  /** Si esta venta la originó un pedido (ver orders.ts); solo se edita o anula desde el pedido. */
  orderId?: string
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
  /** Consecutivo por negocio; no se reutiliza al borrar. */
  number: number
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
  customerName: string
  notes: string
  status: OrderStatus
  totalCents: number
  source: 'catalog' | 'manual'
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
