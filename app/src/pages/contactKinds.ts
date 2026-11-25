import type { ContactType } from '../data/types'

/** Textos y rutas de cada tipo de contacto: las mismas pantallas sirven para clientes (S13) y proveedores (S14). */
export const KINDS: Record<ContactType, { base: string; title: string; one: string; icon: string; newLabel: string; empty: string }> = {
  customer: {
    base: '/clientes',
    title: 'Clientes',
    one: 'cliente',
    icon: '👥',
    newLabel: '+ Cliente',
    empty: 'Guarda a quienes te compran para venderles fiado, cotizarles y recordarles sus pagos.',
  },
  supplier: {
    base: '/proveedores',
    title: 'Proveedores',
    one: 'proveedor',
    icon: '🚚',
    newLabel: '+ Proveedor',
    empty: 'Guarda a quienes te surten para registrar compras y saber cuánto les debes.',
  },
}
