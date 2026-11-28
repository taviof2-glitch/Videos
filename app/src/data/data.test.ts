import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createBusiness, getCurrentBusiness, updateBusiness } from './business'
import { formatMoney, parseMoney } from './money'

describe('money', () => {
  it('convierte texto a centavos sin errores de redondeo', () => {
    expect(parseMoney('12.50')).toBe(1250)
    expect(parseMoney('12,5')).toBe(1250)
    expect(parseMoney('0.10')).toBe(10)
    expect(parseMoney('19.99')).toBe(1999)
    expect(parseMoney('7')).toBe(700)
  })
  it('rechaza importes inválidos', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('-3')).toBeNull()
    expect(parseMoney('1.234')).toBeNull()
  })
  it('da formato de moneda', () => {
    expect(formatMoney(1250, 'MXN')).toContain('12.50')
  })
})

describe('business', () => {
  beforeEach(async () => {
    await db.business.clear()
    await db.meta.clear()
  })
  it('no hay negocio al empezar', async () => {
    expect(await getCurrentBusiness()).toBeUndefined()
  })
  it('crea un negocio y lo deja como actual', async () => {
    const b = await createBusiness({ name: '  Carpintería López ' })
    expect(b.name).toBe('Carpintería López')
    expect(b.currency).toBe('MXN')
    expect((await getCurrentBusiness())?.id).toBe(b.id)
  })
  it('exige nombre', async () => {
    await expect(createBusiness({ name: '   ' })).rejects.toThrow()
  })
  it('actualiza datos', async () => {
    const b = await createBusiness({ name: 'Tienda' })
    await updateBusiness(b.id, { phone: '3331234567' })
    expect((await getCurrentBusiness())?.phone).toBe('3331234567')
  })
})
