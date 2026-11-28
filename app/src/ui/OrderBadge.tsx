import type { OrderStatus } from '../data/types'

const LABEL: Record<OrderStatus, string> = { pending: 'Pendiente', processing: 'En proceso', paid: 'Pagado', cancelled: 'Cancelado' }
const TONE: Record<OrderStatus, string> = { pending: 'low', processing: 'proc', paid: 'ok', cancelled: 'muted' }

export default function OrderBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${TONE[status]}`}>{LABEL[status]}</span>
}
