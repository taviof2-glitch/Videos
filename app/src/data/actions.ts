// Acciones que prepara el asistente (además de la venta, ver assistant.ts): se describen para confirmarlas y solo se hacen al confirmar.
import { ensureCategory, listCategories } from './categories'
import { createContact, listContacts, updateContact } from './contacts'
import { addDays, dayKey } from './dates'
import { addPayment } from './debts'
import { listFixed, payFixed } from './fixed'
import { listJobs, setJobPaid, setJobStage, STAGE_LABEL, startJob, updateJob } from './jobs'
import { formatMoney } from './money'
import { createProduct, listProducts, updateProduct } from './products'
import { createQuote, listQuotes, setQuoteStatus } from './quotes'
import { createExpense } from './transactions'
import type { AppointmentKind, Business, Contact, JobStage, PaymentMethod } from './types'
import { createAppointment, formatTime, KIND_LABEL, setAppointmentDone } from './agenda'
import { db } from './db'
import { adjustMaterial, listMaterials, saveMaterial, UNITS } from './materials'
import { addOffcut } from './offcuts'
import { saveMonthGoal } from './cashcut'
import { LEAD_TYPES, leadPricesOf, saveLeadPrices } from './leads'
import { whatsappLink } from './reminder'
import { autoUseOnCut } from './materialUse'

type Metodo = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro'
const METHOD: Record<Metodo, PaymentMethod> = { efectivo: 'cash', transferencia: 'transfer', tarjeta: 'card', otro: 'other' }

export type AppAction =
  | { type: 'gasto'; concepto: string; monto: number; categoria: string; proveedor: string; proveedor_id: string; pago: 'contado' | 'credito'; metodo: Metodo }
  | { type: 'abono'; nombre: string; contacto_id: string; de: 'cliente' | 'proveedor'; monto: number; metodo: Metodo }
  | { type: 'cotizacion'; cliente: string; cliente_id: string; telefono: string; titulo: string; lineas: { nombre: string; producto_id: string; cantidad: number; precio: number }[]; anticipo: number; iva: boolean; vigencia_dias: number }
  | { type: 'estado_cotizacion'; numero: number; estado: 'aceptada' | 'rechazada' | 'obra' }
  | { type: 'obra'; referencia: string; etapa: '' | JobStage; fecha_entrega: string; nota: string; liquidado: '' | 'si' | 'no'; horas_reales?: number; material_real?: number }
  | { type: 'cita'; tipo: AppointmentKind; fecha: string; hora: string; cliente: string; cliente_id: string; titulo: string; direccion: string; nota: string }
  | { type: 'estado_cita'; cita_id: string; hecha: boolean }
  | { type: 'material'; nombre: string; cambio: number; existencia: number; minimo: number; unidad: string }
  | { type: 'retazo'; largo_mm: number; ancho_mm: number; grosor_mm: number; color: string; tipo: 'tablero' | 'fondo' }
  | { type: 'mensaje'; nombre: string; contacto_id: string; telefono: string; texto: string }
  | { type: 'abrir_pantalla'; pantalla: string; motivo: string }
  | { type: 'meta_mes'; monto: number }
  | { type: 'precio_linea'; tipo: string; precio_por_metro: number }
  | { type: 'pago_taller'; nombre: string; monto: number; metodo: Metodo }
  | { type: 'producto'; nombre: string; producto_id: string; precio: number; costo: number; existencias: number; sobre_pedido: '' | 'si' | 'no'; descripcion: string }
  | { type: 'contacto'; nombre: string; contacto_id: string; tipo: 'cliente' | 'proveedor'; telefono: string }

export const ACTION_TYPES = ['gasto', 'abono', 'cotizacion', 'estado_cotizacion', 'obra', 'pago_taller', 'producto', 'contacto', 'cita', 'estado_cita', 'material', 'retazo', 'mensaje', 'abrir_pantalla', 'meta_mes', 'precio_linea']

/** Pantallas a las que el asistente puede llevar. */
export const SCREENS: Record<string, [string, string]> = { inicio: ['/', 'Inicio'], agenda: ['/agenda', 'Agenda'], obras: ['/obras', 'Obras'], cotizaciones: ['/cotizaciones', 'Cotizaciones'], cotizador: ['/cotizador', 'Cotizador'], material: ['/material', 'Material del taller'], campanas: ['/campanas', 'Campañas'], galeria: ['/galeria', 'Galería'], corte: ['/corte', 'Corte y meta'], estadisticas: ['/estadisticas', 'Estadísticas'], pedidos: ['/pedidos', 'Pedidos'], clientes: ['/clientes', 'Clientes'], proveedores: ['/proveedores', 'Proveedores'], inventario: ['/inventario', 'Inventario'], compras: ['/compras', 'Compras'], pagos: ['/pagos', 'Pagos del taller'], deudas: ['/deudas', 'Deudas'], negocio: ['/negocio', 'Datos del negocio'], mas: ['/mas', 'Más'], catalogo: ['/catalogo', 'Catálogo'], balance: ['/balance', 'Balance'], cuenta: ['/cuenta', 'Cuenta y nube'], plan: ['/plan', 'Plan de la semana'], buscar: ['/buscar', 'Buscar'] }

/** Lo que se muestra para confirmar y la función que lo hace. */
/** `job`: la obra que se movió o entró al taller, para avisar al equipo. */
export type JobChange = { customer: string; title: string; stageLabel: string; isNew?: boolean }
/** `open`: en vez de confirmar, un botón que abre WhatsApp o una pantalla. */
export type Prepared = { title: string; lines: string[]; open?: { href: string; label: string; external: boolean }; run: () => Promise<{ message: string; link?: string; job?: JobChange; payment?: { contactId: string; cents: number } }> }

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
const cents = (pesos: number) => Math.round(Math.max(0, pesos) * 100)
const phone = (s: string) => s.replace(/[^\d+]/g, '')

async function findContact(business: Business, type: 'customer' | 'supplier', id: string, name: string): Promise<Contact | undefined> {
  const list = await listContacts(business.id, type)
  return (id && list.find((c) => c.id.startsWith(id))) || (name.trim() ? list.find((c) => norm(c.name) === norm(name)) : undefined)
}

export async function prepareAction(business: Business, a: AppAction): Promise<Prepared> {
  const money = (c: number) => formatMoney(c, business.currency)
  const today = dayKey(Date.now(), business.timezone)
  switch (a.type) {
    case 'gasto': {
      const amount = cents(a.monto)
      if (!amount) throw new Error('El gasto no trae monto.')
      const supplier = await findContact(business, 'supplier', a.proveedor_id, a.proveedor)
      const credit = a.pago === 'credito'
      if (credit && !supplier && !a.proveedor.trim()) throw new Error('Un gasto a crédito necesita proveedor.')
      const cats = await listCategories(business.id, 'expense')
      const cat = a.categoria.trim() ? cats.find((c) => norm(c.name) === norm(a.categoria)) : undefined
      return {
        title: 'Gasto por confirmar',
        lines: [`${a.concepto || 'Gasto'}: ${money(amount)}`, a.categoria.trim() ? `Categoría: ${cat?.name ?? `${a.categoria.trim()} (nueva)`}` : '', supplier ? `Proveedor: ${supplier.name}` : a.proveedor.trim() ? `Proveedor: ${a.proveedor.trim()} (nuevo)` : '', credit ? 'A crédito' : `De contado (${a.metodo})`].filter(Boolean),
        run: async () => {
          const contact = supplier ?? (a.proveedor.trim() ? await createContact(business.id, 'supplier', { name: a.proveedor.trim() }) : undefined)
          const category = a.categoria.trim() ? await ensureCategory(business.id, 'expense', a.categoria) : undefined
          const t = await createExpense(business.id, { amountCents: amount, concept: a.concepto, categoryId: category?.id, contactId: contact?.id, credit, paymentMethod: METHOD[a.metodo] })
          return { message: `Gasto registrado: ${money(amount)}.`, link: `/gasto/${t.id}` }
        },
      }
    }
    case 'abono': {
      const amount = cents(a.monto)
      const type = a.de === 'proveedor' ? 'supplier' : 'customer'
      const contact = await findContact(business, type, a.contacto_id, a.nombre)
      if (!contact) throw new Error(`No encontré a ${a.nombre || 'ese contacto'} entre tus ${a.de === 'proveedor' ? 'proveedores' : 'clientes'}.`)
      if (!amount) throw new Error('El abono no trae monto.')
      return {
        title: 'Abono por confirmar',
        lines: [`${a.de === 'proveedor' ? 'Pago a' : 'Abono de'} ${contact.name}: ${money(amount)} (${a.metodo})`, 'Se aplica a sus deudas más antiguas primero.'],
        run: async () => {
          await addPayment(contact.id, amount, { method: METHOD[a.metodo] })
          return { message: `Abono registrado: ${money(amount)}.`, link: `/deudas/${contact.id}`, payment: { contactId: contact.id, cents: amount } }
        },
      }
    }
    case 'cotizacion': {
      const contact = await findContact(business, 'customer', a.cliente_id, a.cliente)
      if (!contact && !a.cliente.trim()) throw new Error('La cotización necesita cliente.')
      const products = await listProducts(business.id)
      const lines = a.lineas.filter((l) => l.cantidad > 0).map((l) => ({ ...l, product: (l.producto_id && products.find((p) => p.id.startsWith(l.producto_id))) || undefined }))
      if (!lines.length) throw new Error('La cotización no trae artículos.')
      const subtotal = lines.reduce((s, l) => s + Math.round(l.cantidad * cents(l.precio)), 0)
      const total = a.iva ? Math.round(subtotal * 1.16) : subtotal
      const days = a.vigencia_dias > 0 ? Math.round(a.vigencia_dias) : 15
      return {
        title: 'Cotización por confirmar',
        lines: [`Cliente: ${contact?.name ?? `${a.cliente.trim()} (nuevo)`}`, ...(a.titulo ? [`Título: ${a.titulo}`] : []), ...lines.map((l) => `${l.cantidad} × ${l.product?.name ?? l.nombre} — ${money(Math.round(l.cantidad * cents(l.precio)))}`), `Total: ${money(total)}${a.iva ? ' con IVA' : ''}`, ...(a.anticipo > 0 ? [`Anticipo: ${money(cents(a.anticipo))}`] : []), `Vigencia: ${days} días`],
        run: async () => {
          const c = contact ?? (await createContact(business.id, 'customer', { name: a.cliente.trim(), phone: phone(a.telefono) }))
          const q = await createQuote(business.id, {
            title: a.titulo, contactId: c.id, validUntil: addDays(today, days), taxRate: a.iva ? 16 : 0, advanceCents: Math.min(total, cents(a.anticipo)),
            items: lines.map((l) => (l.product ? { productId: l.product.id, quantity: l.cantidad, unitPriceCents: cents(l.precio) } : { name: l.nombre, quantity: l.cantidad, unitPriceCents: cents(l.precio) })),
          })
          return { message: 'Cotización guardada.', link: `/cotizaciones/${q.id}` }
        },
      }
    }
    case 'estado_cotizacion': {
      const q = (await listQuotes(business.id)).find((x) => x.number === Math.round(a.numero))
      if (!q) throw new Error(`No encontré la cotización #${a.numero}.`)
      const label = a.estado === 'obra' ? 'Pasarla a obra' : a.estado === 'aceptada' ? 'Marcarla aceptada' : 'Marcarla rechazada'
      return {
        title: `Cotización #${q.number}`,
        lines: [`${q.title || 'Cotización'} · ${money(q.totalCents)}`, label],
        run: async () => {
          if (a.estado === 'obra') await startJob(q.id)
          else await setQuoteStatus(q.id, a.estado === 'aceptada' ? 'accepted' : 'rejected')
          return { message: `Listo: ${label.toLowerCase()}.`, link: a.estado === 'obra' ? '/obras' : `/cotizaciones/${q.id}`, ...(a.estado === 'obra' && { job: { customer: q.contactId ? ((await listContacts(business.id, 'customer')).find((c) => c.id === q.contactId)?.name ?? '') : '', title: q.title || `Cotización #${q.number}`, stageLabel: STAGE_LABEL.anticipo, isNew: true } }) }
        },
      }
    }
    case 'obra': {
      const jobs = await listJobs(business.id)
      const names = new Map((await listContacts(business.id, 'customer')).map((c) => [c.id, c.name]))
      const ref = norm(a.referencia)
      const job = jobs.find((j) => norm(j.folio) === ref || norm(j.folio).includes(ref)) ?? jobs.find((j) => norm(`${names.get(j.contactId ?? '') ?? ''} ${j.title}`).includes(ref))
      if (!job) throw new Error(`No encontré la obra «${a.referencia}».`)
      const changes = [a.etapa && `Etapa: ${STAGE_LABEL[a.etapa]}`, a.fecha_entrega && `Entrega: ${a.fecha_entrega}`, a.nota && `Nota: ${a.nota}`, a.liquidado === 'si' && 'Ya está liquidada', a.liquidado === 'no' && 'Quitar «liquidada»', (a.horas_reales ?? -1) >= 0 && `Horas reales: ${a.horas_reales}`, (a.material_real ?? -1) >= 0 && `Material real: ${money(cents(a.material_real!))}`].filter(Boolean) as string[]
      if (!changes.length) throw new Error('No dijiste qué cambiar de la obra.')
      return {
        title: 'Cambio de obra por confirmar',
        lines: [`${names.get(job.contactId ?? '') ?? 'Cliente'} · ${job.title} · ${job.folio}`, ...changes],
        run: async () => {
          if (a.etapa) await setJobStage(job.id, a.etapa, today)
          if (a.etapa === 'corte') await autoUseOnCut(business.id, job.id).catch(() => undefined)
          const patch = { ...(a.fecha_entrega && /^\d{4}-\d{2}-\d{2}$/.test(a.fecha_entrega) && { deliveryDate: a.fecha_entrega }), ...(a.nota && { note: a.nota }), ...((a.horas_reales ?? -1) >= 0 && { realHours: a.horas_reales }), ...((a.material_real ?? -1) >= 0 && { realMaterialCents: cents(a.material_real!) }) }
          if (Object.keys(patch).length) await updateJob(job.id, patch)
          if (a.liquidado) await setJobPaid(job.id, a.liquidado === 'si')
          return { message: 'Obra actualizada.', link: '/obras', ...(a.etapa && { job: { customer: names.get(job.contactId ?? '') ?? '', title: job.title, stageLabel: STAGE_LABEL[a.etapa] } }) }
        },
      }
    }
    case 'pago_taller': {
      const p = listFixed(business).find((x) => norm(x.name) === norm(a.nombre)) ?? listFixed(business).find((x) => norm(x.name).includes(norm(a.nombre)))
      if (!p) throw new Error(`No encontré el pago «${a.nombre}» en tus pagos del taller.`)
      const amount = cents(a.monto) || p.amountCents
      return {
        title: 'Pago del taller por confirmar',
        lines: [`${p.name}: ${money(amount)} (${a.metodo})`, 'Se registra como gasto.'],
        run: async () => {
          await payFixed(business.id, p, { amountCents: amount, paymentMethod: METHOD[a.metodo] })
          return { message: `Pago registrado: ${p.name}.`, link: '/pagos' }
        },
      }
    }
    case 'producto': {
      const products = await listProducts(business.id)
      const found = (a.producto_id && products.find((p) => p.id.startsWith(a.producto_id))) || products.find((p) => norm(p.name) === norm(a.nombre))
      const changes = { ...(a.precio >= 0 && { priceCents: cents(a.precio) }), ...(a.costo >= 0 && { costCents: cents(a.costo) }), ...(a.existencias >= 0 && a.sobre_pedido !== 'si' && !found?.hasVariants && { stock: a.existencias }), ...(a.sobre_pedido && { madeToOrder: a.sobre_pedido === 'si' }), ...(a.descripcion && { description: a.descripcion }) }
      const lines = [a.precio >= 0 && `Precio: ${money(cents(a.precio))}`, a.costo >= 0 && `Costo: ${money(cents(a.costo))}`, a.existencias >= 0 && a.sobre_pedido !== 'si' && `Existencias: ${a.existencias}`, a.sobre_pedido === 'si' && 'Sobre pedido', a.sobre_pedido === 'no' && 'Con existencias (no sobre pedido)', a.descripcion && `Descripción: ${a.descripcion}`].filter(Boolean) as string[]
      return {
        title: found ? `Cambiar «${found.name}»` : 'Producto nuevo',
        lines: [...(found ? [] : [a.nombre]), ...lines],
        run: async () => {
          const p = found ? await updateProduct(found.id, changes) : await createProduct(business.id, { name: a.nombre.trim(), ...changes })
          return { message: found ? 'Producto actualizado.' : 'Producto creado.', link: `/inventario/${p.id}` }
        },
      }
    }
    case 'contacto': {
      const type = a.tipo === 'proveedor' ? 'supplier' : 'customer'
      const found = await findContact(business, type, a.contacto_id, a.nombre)
      if (found && !a.telefono.trim()) throw new Error(`${found.name} ya existe.`)
      return {
        title: found ? `Cambiar a ${found.name}` : `${a.tipo === 'proveedor' ? 'Proveedor' : 'Cliente'} nuevo`,
        lines: [found ? found.name : a.nombre.trim(), ...(a.telefono.trim() ? [`Teléfono: ${a.telefono.trim()}`] : [])],
        run: async () => {
          const c = found ? await updateContact(found.id, { name: found.name, phone: phone(a.telefono), documentId: found.documentId, notes: found.notes }) : await createContact(business.id, type, { name: a.nombre.trim(), phone: phone(a.telefono) })
          return { message: found ? 'Contacto actualizado.' : 'Contacto creado.', link: `/${a.tipo === 'proveedor' ? 'proveedores' : 'clientes'}/${c.id}` }
        },
      }
    }
    case 'cita': {
      const contact = await findContact(business, 'customer', a.cliente_id, a.cliente)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.fecha)) throw new Error('Falta el día de la cita.')
      const address = a.direccion.trim() || contact?.address || ''
      return {
        title: 'Cita por confirmar',
        lines: [`${KIND_LABEL[a.tipo]} · ${a.fecha} ${formatTime(a.hora || undefined)}`, contact ? `Cliente: ${contact.name}` : a.cliente.trim() ? `Cliente: ${a.cliente.trim()} (nuevo)` : '', a.titulo, address && `Dirección: ${address}`, a.nota].filter(Boolean),
        run: async () => {
          const c = contact ?? (a.cliente.trim() ? await createContact(business.id, 'customer', { name: a.cliente.trim() }) : undefined)
          await createAppointment(business.id, { kind: a.tipo, date: a.fecha, time: a.hora, contactId: c?.id, title: a.titulo || (c ? '' : a.cliente), address, note: a.nota })
          return { message: 'Cita agendada.', link: '/agenda' }
        },
      }
    }
    case 'estado_cita': {
      const id = a.cita_id.trim()
      const ap = id.length >= 4 ? (await db.appointment.where('businessId').equals(business.id).filter((x) => !x.deletedAt && x.id.startsWith(id)).first()) : undefined
      if (!ap) throw new Error('No encontré esa cita en la agenda.')
      return {
        title: a.hecha ? 'Marcar cita como hecha' : 'Desmarcar cita',
        lines: [`${KIND_LABEL[ap.kind]} · ${ap.date} ${formatTime(ap.time)}`, ap.title].filter(Boolean),
        run: async () => { await setAppointmentDone(ap.id, a.hecha); return { message: a.hecha ? 'Cita marcada como hecha.' : 'Cita desmarcada.', link: '/agenda' } },
      }
    }
    case 'material': {
      const list = listMaterials(business)
      const m = list.find((x) => norm(x.name) === norm(a.nombre)) ?? list.find((x) => norm(x.name).includes(norm(a.nombre)) && a.nombre.trim().length >= 3)
      const unit = UNITS.includes(a.unidad) ? a.unidad : ''
      const lines = [a.cambio ? `${a.cambio > 0 ? 'Sumar' : 'Restar'} ${Math.abs(a.cambio)}${m ? ` (queda ${Math.max(0, m.stock + a.cambio)})` : ''}` : '', a.existencia >= 0 ? `Existencia: ${a.existencia}` : '', a.minimo >= 0 ? `Mínimo: ${a.minimo}` : '', unit && `Unidad: ${unit}`].filter(Boolean)
      if (!lines.length) throw new Error('No dijiste qué cambiar del material.')
      return {
        title: m ? `Material: ${m.name}` : `Material nuevo: ${a.nombre.trim()}`,
        lines,
        run: async () => {
          if (m && a.existencia < 0 && a.minimo < 0 && !unit) await adjustMaterial(business.id, m.id, a.cambio)
          else await saveMaterial(business.id, { id: m?.id, name: m?.name ?? a.nombre, unit: unit || m?.unit || 'piezas', stock: Math.max(0, (a.existencia >= 0 ? a.existencia : (m?.stock ?? 0)) + (a.existencia >= 0 ? 0 : a.cambio)), min: a.minimo >= 0 ? a.minimo : m?.min, prices: m?.prices })
          return { message: 'Material actualizado.', link: '/material' }
        },
      }
    }
    case 'retazo': {
      const l = Math.round(Math.max(a.largo_mm, a.ancho_mm)), w = Math.round(Math.min(a.largo_mm, a.ancho_mm))
      if (!(l > 0 && w > 0 && a.grosor_mm > 0)) throw new Error('Faltan las medidas del retazo.')
      return {
        title: 'Retazo para la retacera',
        lines: [`${l} × ${w} mm · ${a.tipo} de ${a.grosor_mm} mm · ${a.color || 'sin color'}`],
        run: async () => { await addOffcut(business.id, { l, a: w, esp: a.grosor_mm, color: a.color.trim(), kind: a.tipo }); return { message: 'Retazo guardado.', link: '/material' } },
      }
    }
    case 'mensaje': {
      const c = (await findContact(business, 'customer', a.contacto_id, a.nombre)) ?? (await findContact(business, 'supplier', a.contacto_id, a.nombre))
      const tel = phone(a.telefono) || c?.phone || ''
      return {
        title: `Mensaje para ${c?.name ?? a.nombre}`,
        lines: [a.texto, ...(tel ? [] : ['(Sin teléfono guardado: WhatsApp te pedirá elegir el contacto.)'])],
        open: { href: whatsappLink(a.texto, tel, business.country), label: 'Abrir en WhatsApp', external: true },
        run: async () => ({ message: 'Mensaje listo.' }),
      }
    }
    case 'abrir_pantalla': {
      const [to, label] = SCREENS[a.pantalla] ?? SCREENS.inicio
      return { title: label, lines: [a.motivo], open: { href: to, label: `Ir a ${label}`, external: false }, run: async () => ({ message: '' }) }
    }
    case 'meta_mes': {
      const amount = cents(a.monto)
      return {
        title: 'Meta de ventas del mes',
        lines: [amount ? `Nueva meta: ${money(amount)}` : 'Quitar la meta'],
        run: async () => { await saveMonthGoal(business.id, amount || undefined); return { message: amount ? `Meta puesta: ${money(amount)}.` : 'Meta quitada.', link: '/corte' } },
      }
    }
    case 'precio_linea': {
      const t = LEAD_TYPES.find(([k]) => k === a.tipo)
      if (!t || !(a.precio_por_metro > 0)) throw new Error('Falta el mueble o el precio.')
      return {
        title: 'Precio del cotizador en línea',
        lines: [`${t[1]}: ${money(cents(a.precio_por_metro))} por metro`],
        run: async () => { await saveLeadPrices(business.id, { ...leadPricesOf(business), [t[0]]: cents(a.precio_por_metro) }); return { message: 'Precio actualizado.', link: '/negocio' } },
      }
    }
  }
}
