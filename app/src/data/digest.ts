// Resumen del día (lo arma la función programada api/daily.ts con las filas que guarda la nube).
// Sin Dexie ni nada del navegador: recibe las filas tal cual y regresa el texto del aviso.
// Solo los campos que se usan (así la función del servidor no necesita el resto de la app).
type Job = { stage: string; deliveryDate?: string; deliveredAt?: string; reviewAsked?: string; adjustOffered?: string }
type Business = { name?: string; timezone?: string; currency?: string }
type Contact = { id: string; name: string }
type Appointment = { kind: string; date: string; time?: string; contactId?: string; title: string; done?: boolean; deletedAt?: string }
type Quote = { id: string; status: string; contactId: string; title?: string; createdAt: string; validUntil?: string; job?: Job; deletedAt?: string }
type Transaction = { id: string; type: string; status: string; contactId?: string; amountCents: number; dueDate?: string; concept?: string; date?: string; job?: Job; deletedAt?: string }
type Payment = { transactionId: string; amountCents: number; deletedAt?: string }

export type DigestRow = { tbl: string; data: unknown }
export type Digest = { title: string; body: string; empty: boolean }

const KIND: Record<string, string> = { medir: 'medir', instalar: 'instalar', entregar: 'entregar', otro: 'cita' }
const DELIVERED = ['instalado', 'liquidado']

export function todayIn(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const hour = (t?: string) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return ` ${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`
}

export function buildDigest(rows: DigestRow[], now = new Date()): Digest {
  const of = <T>(tbl: string) => rows.filter((r) => r.tbl === tbl).map((r) => r.data as T)
  const business = of<Business>('business')[0]
  const tz = business?.timezone || 'America/Mexico_City'
  const today = todayIn(tz, now)
  const money = (c: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: business?.currency || 'MXN', maximumFractionDigits: 0 }).format(c / 100)
  const names = new Map(of<Contact>('contact').map((c) => [c.id, c.name]))
  const lines: string[] = []

  // Citas de hoy y mañana.
  const visits = of<Appointment>('appointment').filter((a) => !a.deletedAt && !a.done)
  const todays = visits.filter((a) => a.date === today).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
  if (todays.length) lines.push(`📅 Hoy: ${todays.map((a) => `${KIND[a.kind] ?? 'cita'}${hour(a.time)} ${names.get(a.contactId ?? '') ?? a.title}`.trim()).join(', ')}`)
  const tomorrow = visits.filter((a) => a.date === addDays(today, 1)).length
  if (tomorrow) lines.push(`Mañana: ${tomorrow === 1 ? '1 cita' : `${tomorrow} citas`}`)

  // Obras: entregas de hoy y atrasadas.
  const jobs = [...of<Quote>('quote'), ...of<Transaction>('txn')].filter((x) => x.job && !x.deletedAt)
  const label = (x: Quote | Transaction) => ('title' in x && x.title) || ('concept' in x && x.concept) || names.get(x.contactId ?? '') || 'obra'
  const due = jobs.filter((x) => x.job!.deliveryDate === today && !DELIVERED.includes(x.job!.stage))
  if (due.length) lines.push(`🔨 Se entrega hoy: ${due.map(label).join(', ')}`)
  const late = jobs.filter((x) => x.job!.deliveryDate && x.job!.deliveryDate < today && !DELIVERED.includes(x.job!.stage))
  if (late.length) lines.push(`⚠️ ${late.length === 1 ? `1 obra atrasada (${label(late[0])})` : `${late.length} obras atrasadas`}`)

  // Postventa: reseña a los 2–14 días de entregar; ajuste a los 6–8 meses.
  const since = (d: string) => Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86_400_000)
  const reviews = jobs.filter((x) => x.job!.deliveredAt && !x.job!.reviewAsked && since(x.job!.deliveredAt) >= 2 && since(x.job!.deliveredAt) <= 14).length
  const adjusts = jobs.filter((x) => x.job!.deliveredAt && !x.job!.adjustOffered && since(x.job!.deliveredAt) >= 180 && since(x.job!.deliveredAt) <= 240).length
  if (reviews + adjusts) lines.push(`⭐ Postventa: ${[reviews && `${reviews} para pedir reseña`, adjusts && `${adjusts} para ofrecer ajuste`].filter(Boolean).join(', ')}`)

  // Cotizaciones sin respuesta desde hace 3 días o más (y todavía vigentes).
  const waiting = of<Quote>('quote').filter((q) => !q.deletedAt && q.status === 'pending' && q.createdAt.slice(0, 10) <= addDays(today, -3) && (!q.validUntil || q.validUntil >= today))
  if (waiting.length) lines.push(`📄 ${waiting.length === 1 ? `1 cotización sin respuesta (${names.get(waiting[0].contactId) ?? waiting[0].title})` : `${waiting.length} cotizaciones sin respuesta`}: vale la pena escribirles`)

  // Saldos vencidos.
  const paid = new Map<string, number>()
  for (const p of of<Payment>('payment')) if (!p.deletedAt) paid.set(p.transactionId, (paid.get(p.transactionId) ?? 0) + p.amountCents)
  const overdue = of<Transaction>('txn')
    .filter((t) => !t.deletedAt && t.type === 'sale' && t.status === 'credit' && t.dueDate && t.dueDate < today)
    .map((t) => ({ t, left: t.amountCents - (paid.get(t.id) ?? 0) }))
    .filter((x) => x.left > 0)
  if (overdue.length) {
    const total = overdue.reduce((s, x) => s + x.left, 0)
    lines.push(`💰 Cobros vencidos: ${overdue.length === 1 ? `${names.get(overdue[0].t.contactId ?? '') ?? 'un cliente'} debe ${money(total)}` : `${overdue.length} clientes, ${money(total)}`}`)
  }

  if (today.endsWith('-01')) {
    const prev = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' }).format(new Date(`${addDays(today, -1)}T12:00:00Z`))
    lines.push(`📊 Ya puedes bajar el reporte de ${prev} para tu contador (Más → Corte y meta)`)
  }

  return { title: `Buenos días · tu día en ${business?.name || 'el taller'}`, body: lines.join('\n') || 'Hoy no hay citas, entregas ni cobros vencidos.', empty: lines.length === 0 }
}

/** ¿Es domingo en la zona del negocio? (el resumen de la semana se manda el domingo). */
export function isSunday(timeZone: string, now = new Date()): boolean {
  return new Date(`${todayIn(timeZone, now)}T12:00:00Z`).getUTCDay() === 0
}

/** Resumen de la semana (lunes a domingo): vendido, gastado, ganancia, entregas, lo que viene y quién debe. */
export function buildWeekly(rows: DigestRow[], now = new Date()): Digest {
  const of = <T>(tbl: string) => rows.filter((r) => r.tbl === tbl).map((r) => r.data as T)
  const business = of<Business>('business')[0]
  const tz = business?.timezone || 'America/Mexico_City'
  const today = todayIn(tz, now)
  const from = addDays(today, -6)
  const money = (c: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: business?.currency || 'MXN', maximumFractionDigits: 0 }).format(c / 100)
  const names = new Map(of<Contact>('contact').map((c) => [c.id, c.name]))
  const seen = new Set<string>()
  const week = of<Transaction>('txn').filter((t) => {
    const d = (t.date ?? '').slice(0, 10)
    if (t.deletedAt || seen.has(t.id) || d < from || d > today) return false
    seen.add(t.id)
    return true
  })
  const sales = week.filter((t) => t.type === 'sale')
  const sold = sales.reduce((a, t) => a + t.amountCents, 0)
  const spent = week.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amountCents, 0)
  const lines = [`💵 Vendiste ${money(sold)} (${sales.length} ${sales.length === 1 ? 'venta' : 'ventas'}) y gastaste ${money(spent)} → quedan ${money(sold - spent)}`]
  const jobs = [...of<Quote>('quote'), ...of<Transaction>('txn')].filter((x) => x.job && !x.deletedAt)
  const delivered = jobs.filter((x) => x.job!.deliveredAt && x.job!.deliveredAt >= from && x.job!.deliveredAt <= today)
  if (delivered.length) lines.push(`🔨 Entregaste ${delivered.length === 1 ? '1 obra' : `${delivered.length} obras`}`)
  const next = of<Appointment>('appointment').filter((a) => !a.deletedAt && !a.done && a.date > today && a.date <= addDays(today, 7))
  if (next.length) lines.push(`📅 La próxima semana: ${next.length === 1 ? '1 cita' : `${next.length} citas`}`)
  const paid = new Map<string, number>()
  for (const p of of<Payment>('payment')) if (!p.deletedAt) paid.set(p.transactionId, (paid.get(p.transactionId) ?? 0) + p.amountCents)
  const owed = new Map<string, number>()
  const credit = new Set<string>()
  for (const t of of<Transaction>('txn')) {
    if (t.deletedAt || t.type !== 'sale' || t.status !== 'credit' || credit.has(t.id)) continue
    credit.add(t.id)
    const left = t.amountCents - (paid.get(t.id) ?? 0)
    if (left > 0) owed.set(t.contactId ?? '', (owed.get(t.contactId ?? '') ?? 0) + left)
  }
  if (owed.size) {
    const top = [...owed].sort((a, b) => b[1] - a[1])
    lines.push(`💰 Te deben ${money(top.reduce((a, [, v]) => a + v, 0))}: ${top.slice(0, 3).map(([id, v]) => `${names.get(id) ?? 'cliente'} ${money(v)}`).join(', ')}${top.length > 3 ? '…' : ''}`)
  }
  return { title: `Tu semana en ${business?.name || 'el taller'}`, body: lines.join('\n'), empty: !sales.length && !spent }
}
