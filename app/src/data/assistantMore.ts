// Más resumen para el asistente: agenda, corte, meta, capacidad, impuestos, seguimientos, postventa, retacera,
// material, ganancias, pedidos del cotizador en línea, galería, favoritos y respaldos. Así puede contestar de toda la app.
import { listAppointments, overdueAppointments, KIND_LABEL } from './agenda'
import { afterSaleDue } from './aftersale'
import { lastBackupAt } from './backup'
import { CAMPAIGNS } from './campaigns'
import { capacity } from './capacity'
import { cashCut, monthGoal } from './cashcut'
import { addDays } from './dates'
import { db } from './db'
import { followUpDue } from './followup'
import { materialNeeds } from './materialNeeds'
import { planByDay, planWeekDays } from './weekPlan'
import { loadForecast } from './forecast'
import { dueTasks, listMachines } from './machines'
import { listSwatches } from './swatches'
import { hourProfitByType } from './hourProfit'
import { jobProfit, type JobItem } from './jobs'
import { LEAD_TYPES, leadPricesOf } from './leads'
import { bestPrice, listMaterials, priceRises } from './materials'
import { formatMoney } from './money'
import { groupOffcuts, listOffcuts } from './offcuts'
import { estimateTaxes, monthMoney, taxOf } from './taxes'
import type { Business, Contact, Order, Quote } from './types'

const MAX = 15
function rows(title: string, items: string[]): string[] {
  if (!items.length) return [`${title}: ninguno.`]
  return [`${title} (${items.length}):`, ...items.slice(0, MAX).map((i) => `  - ${i}`), ...(items.length > MAX ? [`  (y ${items.length - MAX} más)`] : [])]
}

export async function moreContext(business: Business, today: string, o: { jobs: JobItem[]; quotes: Quote[]; orders: Order[]; customers: Contact[] }): Promise<string[]> {
  const money = (c: number) => formatMoney(c, business.currency)
  const tz = business.timezone
  const name = new Map(o.customers.map((c) => [c.id, c.name]))
  const who = (id?: string) => (id && name.get(id)) || ''
  const pendingOrders = o.orders.filter((x) => x.status === 'pending')
  const [week, late, cut, goal, mm, items, lastBackup] = await Promise.all([
    listAppointments(business.id, today, addDays(today, 7)),
    overdueAppointments(business.id, today),
    cashCut(business.id, 'day', today, tz),
    business.monthGoalCents ? monthGoal(business.id, business.monthGoalCents, today, tz) : Promise.resolve(undefined),
    monthMoney(business.id, today, tz),
    pendingOrders.length ? db.orderItem.where('orderId').anyOf(pendingOrders.map((x) => x.id)).toArray() : Promise.resolve([]),
    lastBackupAt(),
  ])
  const fc = await loadForecast(business, today)
  const needs = await materialNeeds(business)
  const appt = (a: (typeof week)[number]) => `[cita ${a.id.slice(0, 8)}] ${a.date} ${a.time ?? 'sin hora'} ${KIND_LABEL[a.kind]} — ${[who(a.contactId), a.title].filter(Boolean).join(' · ')}${a.address ? ` · ${a.address}` : ''}${a.done ? ' [hecha]' : ''}`
  const active = o.jobs.filter((j) => j.job.stage !== 'liquidado')
  const cap = capacity(business, active.filter((j) => !['instalado', 'liquidado'].includes(j.job.stage)), today)
  const tax = estimateTaxes(taxOf(business), mm.incomeCents, mm.expenseCents)
  const follow = o.quotes.filter((q) => !q.job && followUpDue(q, today) !== undefined)
  const after = afterSaleDue(o.jobs, today)
  const profits = o.jobs.map((j) => jobProfit(business, j)).filter((p): p is NonNullable<typeof p> => !!p)
  const perHour = hourProfitByType(business, o.jobs)
  const mats = listMaterials(business)
  const rises = priceRises(mats)
  const offcuts = groupOffcuts(listOffcuts(business))
  const lead = leadPricesOf(business)
  const itemsBy = new Map<string, string[]>()
  for (const i of items) itemsBy.set(i.orderId, [...(itemsBy.get(i.orderId) ?? []), `${i.quantity > 1 ? `${i.quantity} × ` : ''}${i.name ?? 'artículo'}`])
  const SRC = { web: 'cotizador en línea', catalog: 'catálogo', manual: 'a mano' } as const

  return [
    '',
    ...rows('Agenda de hoy y los próximos 7 días', week.map(appt)),
    ...rows('Citas de días pasados sin marcar como hechas', late.map(appt)),
    '',
    `Corte de caja de hoy: entró ${money(cut.inCents)}, salió ${money(cut.outCents)}, queda ${money(cut.netCents)}; efectivo que debe haber ${money(cut.cashCents)}.`,
    goal ? `Meta de ventas del mes: ${money(goal.goalCents)}; vendido ${money(goal.soldCents)} (${goal.pct} %), ${goal.soldCents >= goal.expectedCents ? 'va adelantado' : 'va atrasado'}; faltan ${goal.daysLeft} días, unos ${money(goal.perDayCents)} por día.` : 'Meta de ventas del mes: no hay meta puesta (se pone en Corte y meta).',
    ...rows('Plan del taller esta semana (lunes a sábado)', planByDay(business, o.jobs, planWeekDays(today), today).filter((d) => d.day >= today).map((d) => `${d.day}: ${d.entries.map((e) => `${e.job.title} ${e.hours} h`).join(', ') || 'libre'} (${d.hours} h${d.over ? ', SOBRECARGADO' : ''})`)),
    `Capacidad del taller: quedan unas ${cap.backlogHours} h de trabajo (${cap.backlogDays} días de ${cap.hoursPerDay} h); una obra nueva de 2 días se podría entregar hacia el ${cap.nextDelivery}.`,
    `Impuestos estimados del mes (${taxOf(business).regime === 'resico' ? 'RESICO' : 'actividad empresarial'}, aproximado): ingresos ${money(tax.incomeCents)}, ISR ${money(tax.isrCents)}, IVA ${money(tax.ivaCents)}, total ${money(tax.totalCents)}. Lo confirma el contador.`,
    ...rows('Dinero de las próximas 4 semanas (entra saldos de obras y fiados con fecha; sale pagos del taller y proveedores)', fc.weeks.map((w, i) => `${i === 0 ? 'Esta semana' : `Semana del ${w.from}`}: entra ${money(w.inCents)}, sale ${money(w.outCents)}, neto ${money(w.netCents)}, acumulado ${money(w.runningCents)}`)),
    fc.tight ? `OJO: la semana del ${fc.tight.from} se ve apretada.` : 'Ninguna semana se ve apretada.',
    ...rows('Mantenimiento de maquinaria que toca en 7 días', dueTasks(listMachines(business), today, 7).map((x) => `${x.machine.name}: ${x.task.name} (toca ${x.due})`)),
    `Muestrario de colores: ${listSwatches(business).map((x) => x.name).join(', ') || 'vacío'}.`,
    '',
    ...rows('Cotizaciones a las que toca dar seguimiento hoy', follow.map((q) => `#${q.number} ${q.title} — ${who(q.contactId)}: ${money(q.totalCents)}`)),
    ...rows('Postventa pendiente (pedir reseña o revisar ajuste)', after.map((a) => `${who(a.item.contactId)} · ${a.item.title}: ${a.kind === 'review' ? 'pedir reseña' : 'ofrecer ajuste de 6 meses'} (entregada hace ${a.days} días)`)),
    '',
    profits.length ? `Ganancia de obras con costos anotados (${profits.length}): cobrado ${money(profits.reduce((s, p) => s + p.incomeCents, 0))}, costó ${money(profits.reduce((s, p) => s + p.realCostCents, 0))}, ganancia ${money(profits.reduce((s, p) => s + p.profitCents, 0))}.` : 'Ganancia por obra: aún no hay obras con costos anotados.',
    ...rows('Ganancia por hora por tipo de mueble', perHour.map((r) => `${r.label}: ${money(r.perHourCents)}/h (${r.jobs} obras, ${r.hours} h${r.estimated ? ', horas en parte estimadas' : ''})`)),
    '',
    ...rows('Material que falta comprar para las obras por cortar (se necesita / hay / falta)', needs.lines.filter((l) => l.short > 0).map((l) => `${l.name}: ${l.need} / ${l.have} / faltan ${l.short} ${l.unit}${l.supplier ? `, con ${l.supplier}` : ''}`)),
    `Obras listas para cortar (con todo el material): ${needs.jobs.filter((j) => j.ready).map((j) => j.label).join('; ') || 'ninguna'}.`,
    ...rows('Material del taller (existencias)', mats.map((m) => `${m.name}: ${m.stock} ${m.unit}${m.min !== undefined ? ` (mínimo ${m.min})` : ''}${bestPrice(m) ? `, mejor precio ${money(bestPrice(m)!.priceCents)} con ${bestPrice(m)!.supplier}` : ''}`)),
    ...rows('Subidas de precio recientes del material', rises.map((r) => `${r.material.name} con ${r.supplier}: de ${money(r.fromCents)} a ${money(r.toCents)} (+${r.pct} %)`)),
    ...rows('Retacera (sobrantes guardados)', offcuts.map((g) => `${g.key}: ${g.items.length} retazos, ${g.areaM2.toFixed(2)} m² (el mayor ${Math.max(...g.items.map((x) => x.l))}×${Math.max(...g.items.map((x) => x.a))} mm)`)),
    '',
    ...rows('Pedidos pendientes', pendingOrders.map((x) => `#${x.number} ${x.customerName || 'sin nombre'} (${SRC[x.source] ?? x.source}): ${(itemsBy.get(x.id) ?? []).join(', ') || 'sin artículos'}${x.totalCents ? `, ${money(x.totalCents)}` : ''}${x.notes ? `. Nota: ${x.notes.slice(0, 100)}` : ''}`)),
    `Cotizador en línea para clientes: ${business.leadToken ? 'enlace activo' : 'aún sin enlace (se crea en Datos del negocio)'}; precios por metro: ${LEAD_TYPES.map(([k, l]) => `${l.replace(/ \(.*\)/, '')} ${money(lead[k])}`).join(', ')}.`,
    `Galería pública: ${business.galleryToken ? 'enlace activo' : 'sin enlace todavía'}. Obras marcadas para la galería: ${o.jobs.filter((j) => j.job.gallery).length}.`,
    `Favoritos de Bases: ${business.favorites?.map((f) => f.name).join(', ') || 'ninguno'}.`,
    `Campañas disponibles: ${CAMPAIGNS.map((c) => c.name).join(', ')}.`,
    `Datos para que paguen: ${business.payInfo?.clabe ? 'CLABE guardada' : 'sin CLABE guardada'}. Enlace de reseñas de Google: ${business.reviewUrl ? 'guardado' : 'no guardado'}.`,
    `Última copia descargada en este aparato: ${lastBackup ? lastBackup.slice(0, 10) : 'nunca'}. Respaldos semanales en la nube: automáticos (Más → Respaldos semanales).`,
  ]
}
