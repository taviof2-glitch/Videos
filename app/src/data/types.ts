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
}

export type StockReason = 'sale' | 'purchase' | 'adjust' | 'order' | 'void'

export interface StockMovement {
  id: string
  businessId: string
  productId: string
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
}

/** Línea de una venta, con precio y costo "congelados" al momento de vender. */
export interface TransactionItem {
  id: string
  transactionId: string
  productId?: string
  name: string
  quantity: number
  unitPriceCents: number
  unitCostCents: number
  /** Orden de la línea dentro de la venta (0, 1, 2…). Las filas anteriores a T7 no lo tienen. */
  position?: number
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
  subtotalCents: number
  taxCents: number
  totalCents: number
  notes: string
  /** Venta en que se convirtió. */
  transactionId?: string
}

export interface QuoteItem {
  id: string
  quoteId: string
  position: number
  productId?: string
  name: string
  unit: string
  quantity: number
  unitPriceCents: number
}
