import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from '../data/business'
import { listContacts } from '../data/contacts'
import { db } from '../data/db'
import { NEW_OPTION, resolveContactId } from './forms'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('resolveContactId', () => {
  it('avisa del contacto creado para que un reintento no lo duplique', async () => {
    const b = await createBusiness({ name: 'Muebles' })
    let selected = NEW_OPTION
    const first = await resolveContactId(b.id, 'customer', selected, 'María López', (id) => (selected = id))
    expect(selected).toBe(first)
    // El formulario falló después y la persona reintenta: ahora el select ya apunta al contacto creado.
    const second = await resolveContactId(b.id, 'customer', selected, 'María López', (id) => (selected = id))
    expect(second).toBe(first)
    expect(await listContacts(b.id, 'customer')).toHaveLength(1)
  })
  it('sin nombre no crea nada y un id existente pasa tal cual', async () => {
    const b = await createBusiness({ name: 'Muebles' })
    expect(await resolveContactId(b.id, 'supplier', NEW_OPTION, '  ')).toBe('')
    expect(await resolveContactId(b.id, 'supplier', 'abc', 'x')).toBe('abc')
    expect(await listContacts(b.id, 'supplier')).toHaveLength(0)
  })
})
