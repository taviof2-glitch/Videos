// Mantenimiento de la maquinaria del taller: cada máquina con sus tareas (cada cuántos días) y cuándo se hizo.
import { addDays } from './dates'
import { db } from './db'
import type { Business, Machine, MachineTask } from './types'

export const SUGGESTED_MACHINES: [string, [string, number][]][] = [
  ['Sierra / escuadradora', [['Cambiar o afilar disco', 60], ['Limpiar y lubricar guías', 30]]],
  ['Enchapadora de cantos', [['Limpiar crisol de cola', 15], ['Revisar cuchillas de refilado', 45]]],
  ['Compresor', [['Purgar tanque', 7], ['Cambiar aceite', 180]]],
  ['Router / CNC', [['Cambiar fresas', 60], ['Limpiar y engrasar', 30]]],
]

export const listMachines = (b: Pick<Business, 'machines'>): Machine[] => b.machines ?? []

async function write(businessId: string, fn: (l: Machine[]) => Machine[]) {
  await db.transaction('rw', db.business, async () => {
    const b = await db.business.get(businessId)
    if (!b) throw new Error('Negocio no encontrado')
    await db.business.update(businessId, { machines: fn(listMachines(b)), updatedAt: new Date().toISOString() })
  })
}

export async function addMachine(businessId: string, name: string, tasks: [string, number][], today: string): Promise<void> {
  const n = name.trim()
  if (!n) throw new Error('Escribe el nombre de la máquina')
  const m: Machine = { id: crypto.randomUUID(), name: n, tasks: tasks.filter(([t, d]) => t.trim() && d > 0).map(([t, d]) => ({ id: crypto.randomUUID(), name: t.trim(), everyDays: Math.round(d), lastDone: today })) }
  await write(businessId, (l) => [...l, m])
}

export const removeMachine = (businessId: string, id: string) => write(businessId, (l) => l.filter((m) => m.id !== id))

export async function addTask(businessId: string, machineId: string, name: string, everyDays: number, today: string): Promise<void> {
  if (!name.trim() || !(everyDays > 0)) throw new Error('Escribe la tarea y cada cuántos días')
  await write(businessId, (l) => l.map((m) => (m.id === machineId ? { ...m, tasks: [...m.tasks, { id: crypto.randomUUID(), name: name.trim(), everyDays: Math.round(everyDays), lastDone: today }] } : m)))
}

export const removeTask = (businessId: string, machineId: string, taskId: string) => write(businessId, (l) => l.map((m) => (m.id === machineId ? { ...m, tasks: m.tasks.filter((t) => t.id !== taskId) } : m)))

export const markDone = (businessId: string, machineId: string, taskId: string, today: string) =>
  write(businessId, (l) => l.map((m) => (m.id === machineId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, lastDone: today } : t)) } : m)))

export const nextDue = (t: MachineTask, today: string) => addDays(t.lastDone ?? today, t.everyDays)

/** Tareas que ya tocan (o tocan en los próximos `ahead` días). */
export function dueTasks(machines: Machine[], today: string, ahead = 0): { machine: Machine; task: MachineTask; due: string }[] {
  return machines.flatMap((m) => m.tasks.map((task) => ({ machine: m, task, due: nextDue(task, today) }))).filter((x) => x.due <= addDays(today, ahead)).sort((a, b) => a.due.localeCompare(b.due))
}
