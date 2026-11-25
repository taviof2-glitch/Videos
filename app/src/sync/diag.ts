// Diagnóstico: avisa al servidor qué versión corre este aparato y en qué paso falla la sincronización.
// Va con `fetch` directo (sin la librería de Supabase) para que funcione aunque lo demás esté atorado. Nunca lanza.
import { SUPABASE_KEY, SUPABASE_URL } from './config'

const DEVICE_KEY = 'houselite-device'
const sent = new Map<string, number>()

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = Math.random().toString(36).slice(2, 10)
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'sin-almacenamiento'
  }
}

/** Manda un aviso (como mucho uno igual cada 5 minutos). */
export function diag(event: string, extra: Record<string, unknown> = {}): void {
  try {
    if (import.meta.env.MODE === 'test' || typeof fetch === 'undefined') return
    const key = `${event}:${JSON.stringify(extra).slice(0, 200)}`
    const last = sent.get(key)
    if (last && Date.now() - last < 5 * 60_000) return
    sent.set(key, Date.now())
    const info = {
      event,
      device: deviceId(),
      ua: navigator.userAgent.slice(0, 160),
      standalone: typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches,
      sw: !!navigator.serviceWorker?.controller,
      online: navigator.onLine,
      ...extra,
    }
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 15_000)
    void fetch(`${SUPABASE_URL}/rest/v1/rpc/app_diag_report`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_build: __APP_BUILD__, p_origin: location.origin, p_info: info }),
      signal: ctrl.signal,
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // el diagnóstico nunca debe romper la app
  }
}
