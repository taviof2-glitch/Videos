// Empleados con PIN en el aparato compartido (T13). El PIN identifica a quien está usando la app y limita lo que ve;
// no es seguridad contra alguien con acceso al aparato o a la cuenta (eso lo da la sesión de la cuenta, ver replica/sync-design.md).
import { db } from './db'
import type { Employee } from './types'

export type Permission = 'balance' | 'expenses' | 'inventory' | 'void'

export const PERMISSIONS: { key: Permission; label: string; hint: string }[] = [
  { key: 'balance', label: 'Ver balance y estadísticas', hint: 'Cuánto se ha vendido, gastado y ganado.' },
  { key: 'expenses', label: 'Registrar gastos y compras', hint: 'Gastos, compras y proveedores.' },
  { key: 'inventory', label: 'Editar el inventario', hint: 'Crear y cambiar productos, y ver sus costos.' },
  { key: 'void', label: 'Editar o borrar movimientos', hint: 'Cambiar o anular ventas y gastos ya registrados.' },
]
const ALL: Permission[] = PERMISSIONS.map((p) => p.key)

/** Quien está usando la app. Sin empleados configurados, es el dueño sin PIN (`id` vacío). */
export interface Actor {
  id?: string
  name: string
  role: 'owner' | 'employee'
  permissions: Permission[]
}

export const SOLO_OWNER: Actor = { name: 'Dueño', role: 'owner', permissions: ALL }
export const can = (actor: Actor, permission: Permission) => actor.role === 'owner' || actor.permissions.includes(permission)

const activeKey = (businessId: string) => `activeUser:${businessId}`
const PIN = /^\d{4,6}$/
export const PIN_HELP = 'El PIN debe tener de 4 a 6 números.'

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256)
  return hex(new Uint8Array(bits))
}

async function pinFields(pin: string) {
  if (!PIN.test(pin)) throw new Error(PIN_HELP)
  const pinSalt = hex(crypto.getRandomValues(new Uint8Array(16)))
  return { pinSalt, pinHash: await hashPin(pin, pinSalt) }
}

export async function listEmployees(businessId: string, includeInactive = true): Promise<Employee[]> {
  const rows = await db.employee.where('businessId').equals(businessId).toArray()
  return rows
    .filter((e) => !e.deletedAt && (includeInactive || e.active))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, 'es') : a.role === 'owner' ? -1 : 1))
}

export async function getOwner(businessId: string): Promise<Employee | undefined> {
  return (await listEmployees(businessId)).find((e) => e.role === 'owner')
}

/** El control de usuarios está encendido cuando el dueño ya puso su PIN. */
export async function teamEnabled(businessId: string): Promise<boolean> {
  return !!(await getOwner(businessId))
}

const setActive = (businessId: string, id: string) => db.meta.put({ key: activeKey(businessId), value: id })

/** El dueño pone o cambia su PIN. La primera vez enciende el control de usuarios y deja al dueño dentro. */
export async function setOwnerPin(businessId: string, pin: string): Promise<Employee> {
  const fields = await pinFields(pin)
  const now = new Date().toISOString()
  const existing = await getOwner(businessId)
  if (existing) {
    await db.employee.update(existing.id, { ...fields, updatedAt: now })
    return (await db.employee.get(existing.id))!
  }
  const owner: Employee = { id: crypto.randomUUID(), businessId, name: 'Dueño', role: 'owner', permissions: ALL, active: true, ...fields, createdAt: now, updatedAt: now }
  await db.transaction('rw', db.employee, db.meta, async () => {
    await db.employee.add(owner)
    await setActive(businessId, owner.id)
  })
  return owner
}

export type EmployeeInput = { name: string; pin: string; permissions: Permission[] }

export async function createEmployee(businessId: string, input: EmployeeInput): Promise<Employee> {
  const name = input.name.trim()
  if (!name) throw new Error('El nombre es obligatorio')
  if (!(await getOwner(businessId))) throw new Error('Primero pon tu PIN de dueño')
  const clash = (await listEmployees(businessId)).find((e) => e.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0)
  if (clash) throw new Error(`Ya hay alguien llamado "${clash.name}"`)
  const fields = await pinFields(input.pin)
  const now = new Date().toISOString()
  const employee: Employee = {
    id: crypto.randomUUID(), businessId, name, role: 'employee', permissions: input.permissions.filter((p) => ALL.includes(p)), active: true, ...fields, createdAt: now, updatedAt: now,
  }
  await db.employee.add(employee)
  return employee
}

export async function updateEmployee(id: string, changes: Partial<EmployeeInput> & { active?: boolean }): Promise<void> {
  const current = await db.employee.get(id)
  if (!current || current.deletedAt) throw new Error('Ese empleado ya no existe')
  const patch: Partial<Employee> = { updatedAt: new Date().toISOString() }
  if (changes.name !== undefined) {
    const name = changes.name.trim()
    if (!name) throw new Error('El nombre es obligatorio')
    const clash = (await listEmployees(current.businessId)).find((e) => e.id !== id && e.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0)
    if (clash) throw new Error(`Ya hay alguien llamado "${clash.name}"`)
    patch.name = name
  }
  if (changes.pin !== undefined) Object.assign(patch, await pinFields(changes.pin))
  if (changes.permissions && current.role === 'employee') patch.permissions = changes.permissions.filter((p) => ALL.includes(p))
  if (changes.active !== undefined && current.role === 'employee') patch.active = changes.active
  await db.employee.update(id, patch)
}

/** Quita al empleado de la lista (sus ventas conservan su nombre en el historial). */
export async function removeEmployee(id: string): Promise<void> {
  const e = await db.employee.get(id)
  if (!e || e.deletedAt) return
  if (e.role === 'owner') throw new Error('No se puede quitar al dueño')
  const now = new Date().toISOString()
  await db.employee.update(id, { deletedAt: now, active: false, updatedAt: now })
}

// ── Sesión de este aparato ──────────────────────────────────────────────────────

const MAX_TRIES = 5
const LOCK_MS = 30_000
const tries = new Map<string, { count: number; until: number }>()

/** Entra con el PIN. Tras 5 intentos fallidos seguidos espera 30 segundos. */
export async function login(businessId: string, employeeId: string, pin: string): Promise<Actor> {
  const t = tries.get(employeeId)
  if (t && t.until > Date.now()) throw new Error(`Demasiados intentos. Espera ${Math.ceil((t.until - Date.now()) / 1000)} segundos.`)
  const e = await db.employee.get(employeeId)
  if (!e || e.deletedAt || !e.active || e.businessId !== businessId) throw new Error('Ese usuario ya no puede entrar')
  if ((await hashPin(pin, e.pinSalt)) !== e.pinHash) {
    const count = (t?.count ?? 0) + 1
    tries.set(employeeId, count >= MAX_TRIES ? { count: 0, until: Date.now() + LOCK_MS } : { count, until: 0 })
    throw new Error(count >= MAX_TRIES ? 'Demasiados intentos. Espera 30 segundos.' : 'PIN incorrecto')
  }
  tries.delete(employeeId)
  await setActive(businessId, e.id)
  return toActor(e)
}

export async function lock(businessId: string): Promise<void> {
  await db.meta.delete(activeKey(businessId))
}

const toActor = (e: Employee): Actor => ({ id: e.id, name: e.name, role: e.role, permissions: e.role === 'owner' ? ALL : e.permissions })

/** Quién está usando la app: `SOLO_OWNER` si no hay control de usuarios, `null` si hay que escribir un PIN. */
export async function currentActor(businessId: string): Promise<Actor | null> {
  if (!(await teamEnabled(businessId))) return SOLO_OWNER
  const id = (await db.meta.get(activeKey(businessId)))?.value
  const e = id ? await db.employee.get(id) : undefined
  return e && !e.deletedAt && e.active && e.businessId === businessId ? toActor(e) : null
}

/** A quién se le atribuye lo que se registre ahora (undefined si nadie ha entrado o no hay control de usuarios). */
export async function actorId(businessId: string): Promise<string | undefined> {
  const id = (await db.meta.get(activeKey(businessId)))?.value
  return id || undefined
}
