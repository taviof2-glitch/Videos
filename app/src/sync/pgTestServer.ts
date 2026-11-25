// Solo para pruebas: un Postgres real con la migración de app/supabase/migrations aplicada.
// Las pruebas que lo usan se saltan si no hay SYNC_PG_URL (p. ej. postgresql://postgres@localhost:54329/postgres).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

export const PG_URL = process.env.SYNC_PG_URL ?? ''

const file = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

export interface TestServer {
  /** Llama una función como el usuario dado (null = sin sesión, rol anon). */
  rpc<T = unknown>(user: string | null, fn: string, args: unknown[]): Promise<T>
  /** Consulta directa como el usuario dado (para comprobar que no puede leer las tablas). */
  queryAs(user: string | null, sql: string): Promise<unknown[]>
  /** Consulta como administrador. */
  admin(sql: string, args?: unknown[]): Promise<Record<string, unknown>[]>
  close(): Promise<void>
}

export async function createTestServer(): Promise<TestServer> {
  const name = `conta_t_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  const root = new pg.Client({ connectionString: PG_URL })
  await root.connect()
  await root.query(`create database ${name}`)
  await root.end()
  const url = new URL(PG_URL)
  url.pathname = `/${name}`
  const client = new pg.Client({ connectionString: url.toString() })
  await client.connect()
  await client.query(file('../../supabase/tests/auth-stub.sql'))
  for (const m of ['0001_sync.sql', '0002_my_businesses.sql', '0003_photos.sql']) await client.query(file(`../../supabase/migrations/${m}`))

  async function asUser<T>(user: string | null, run: () => Promise<T>): Promise<T> {
    await client.query('begin')
    try {
      await client.query(`set local role ${user ? 'authenticated' : 'anon'}`)
      await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user ?? ''])
      const out = await run()
      await client.query('commit')
      return out
    } catch (e) {
      await client.query('rollback')
      throw e
    }
  }

  return {
    rpc: (user, fn, args) =>
      asUser(user, async () => {
        const params = args.map((_, i) => `$${i + 1}`).join(', ')
        const res = await client.query(`select * from ${fn}(${params})`, args.map((a) => (a !== null && typeof a === 'object' ? JSON.stringify(a) : a)))
        // Las funciones escalares devuelven una columna con su nombre; las de tabla, filas.
        if (res.fields.length === 1 && res.fields[0].name === fn) return res.rows[0]?.[fn]
        return res.rows as never
      }),
    queryAs: (user, sql) => asUser(user, async () => (await client.query(sql)).rows),
    admin: async (sql, args) => (await client.query(sql, args)).rows,
    close: async () => {
      await client.end()
      const r = new pg.Client({ connectionString: PG_URL })
      await r.connect()
      await r.query(`drop database if exists ${name}`)
      await r.end()
    },
  }
}
