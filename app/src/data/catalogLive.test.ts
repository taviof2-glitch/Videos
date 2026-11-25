import { describe, expect, it } from 'vitest'
import { parseCatalog } from './catalogFormat'
import { loadLiveCatalog, loadLivePhoto, orderErrorMessage, placeLiveOrder, slugFromSearch } from './catalogLive'

const biz = '11111111-1111-4111-8111-111111111111'
const prod = '22222222-2222-4222-8222-222222222222'
const path = `${biz}/${prod}/aaaaaaaaaaaaaaaa.jpg`
const catalog = {
  v: 1, generatedAt: '2026-11-25T10:00:00.000Z',
  business: { name: 'Taller', phone: '33 1', country: 'MX', address: '', openingHours: '', currency: 'MXN', note: '' },
  categories: [], products: [{ id: '22222222', name: 'Silla', description: '', category: '', priceCents: 1000, photoPath: path, soldOut: false }],
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('catálogo en vivo (cliente)', () => {
  it('lee el nombre de la página del enlace', () => {
    expect(slugFromSearch('?c=Taller-Lopez')).toBe('taller-lopez')
    expect(slugFromSearch('?c=a')).toBeUndefined()
    expect(slugFromSearch('?c=con espacios')).toBeUndefined()
    expect(slugFromSearch('')).toBeUndefined()
  })

  it('solo acepta rutas de foto con la forma esperada', () => {
    const ok = parseCatalog(JSON.stringify(catalog))
    expect(ok.ok && ok.data.products[0].photoPath).toBe(path)
    const bad = parseCatalog(JSON.stringify({ ...catalog, products: [{ ...catalog.products[0], photoPath: '../../etc/passwd' }] }))
    expect(bad.ok && bad.data.products[0].photoPath).toBeUndefined()
  })

  it('carga el catálogo con la clave pública y lo limpia; null si no existe', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const f = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return json(calls.length === 1 ? catalog : null)
    }) as unknown as typeof fetch
    const d = await loadLiveCatalog('taller', f)
    expect(d?.products[0].name).toBe('Silla')
    expect(calls[0].url).toMatch(/\/rest\/v1\/rpc\/public_catalog$/)
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ p_slug: 'taller' })
    expect((calls[0].init!.headers as Record<string, string>).apikey).toMatch(/^sb_publishable_/)
    expect(await loadLiveCatalog('nada', f)).toBeNull()
  })

  it('manda el pedido sin precios (los pone el servidor) y traduce los errores', async () => {
    let sent: Record<string, unknown> = {}
    const f = (async (_u: string, init?: RequestInit) => {
      sent = JSON.parse(init!.body as string)
      return json({ number: 7, totalCents: 2000 })
    }) as unknown as typeof fetch
    const r = await placeLiveOrder('taller', ' Olga ', ' Sábado ', [{ productId: '22222222', quantity: 2 }, { productId: 'aaaaaaaa', variantId: 'bbbbbbbb', quantity: 1 }], f)
    expect(r).toEqual({ number: 7, totalCents: 2000 })
    expect(sent).toEqual({ p_slug: 'taller', p_customer: 'Olga', p_notes: 'Sábado', p_items: [{ p: '22222222', q: 2 }, { p: 'aaaaaaaa', v: 'bbbbbbbb', q: 1 }] })
    const fail = (async () => json({ message: 'rate_limited' }, 400)) as unknown as typeof fetch
    await expect(placeLiveOrder('taller', 'x', '', [{ productId: 'a', quantity: 1 }], fail)).rejects.toThrow('rate_limited')
    expect(orderErrorMessage(new Error('rate_limited'))).toMatch(/varios pedidos/)
    expect(orderErrorMessage(new Error('product_unavailable'))).toMatch(/ya no está disponible/)
    expect(orderErrorMessage(new Error('Failed to fetch'))).toMatch(/Sin conexión/)
  })

  it('una foto que no se puede bajar no rompe nada', async () => {
    expect(await loadLivePhoto(path, (async () => new Response('', { status: 400 })) as unknown as typeof fetch)).toBeUndefined()
    expect(await loadLivePhoto(path, (async () => Promise.reject(new Error('x'))) as unknown as typeof fetch)).toBeUndefined()
  })
})
