// Avisos push del equipo: este teléfono se suscribe (Web Push) y la app avisa a los demás teléfonos del negocio
// cuando alguien mueve una obra de etapa. El envío lo hace api/push.ts; aquí solo se suscribe y se pide el envío.
import { SUPABASE_KEY, SUPABASE_URL } from './config'
import { sessionToken } from './runner'

export type PushState = 'unsupported' | 'denied' | 'on' | 'off'

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** En iPhone los avisos solo funcionan con la app instalada en la pantalla de inicio. */
export const needsInstall = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone)

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!pushSupported()) return undefined
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<undefined>((r) => setTimeout(() => r(undefined), 4000))])
  return reg ?? undefined
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  if (!reg) return 'unsupported'
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off'
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const token = await sessionToken().catch(() => undefined)
  if (!token) throw new Error('Entra a tu cuenta en «Cuenta y nube» para recibir avisos.')
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!r.ok) throw new Error('No se pudo guardar en la nube. Revisa que este negocio esté conectado a tu cuenta.')
}

/** Pide permiso y suscribe este teléfono a los avisos del negocio. */
export async function enablePush(businessId: string, employeeId?: string): Promise<void> {
  if (!pushSupported()) throw new Error('Este navegador no permite avisos.')
  if (needsInstall()) throw new Error('En iPhone primero instala la app: Compartir → «Agregar a inicio», ábrela desde ahí y activa los avisos.')
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('No diste permiso de avisos. Actívalo en los ajustes del navegador para esta página.')
  const reg = await registration()
  if (!reg) throw new Error('La app todavía se está instalando. Cierra y vuelve a abrir, e intenta otra vez.')
  const res = await fetch('/api/push')
  const { key } = ((await res.json().catch(() => ({}))) as { key?: string })
  if (!key) throw new Error('Los avisos todavía no están configurados en el servidor.')
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }))
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  await rpc('push_subscribe', { p_business: businessId, p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth, p_employee: employeeId ?? '' })
}

export async function disablePush(): Promise<void> {
  const sub = await (await registration())?.pushManager.getSubscription()
  if (!sub) return
  await rpc('push_unsubscribe', { p_endpoint: sub.endpoint }).catch(() => undefined)
  await sub.unsubscribe()
}

/** Avisa a los demás teléfonos del equipo. No espera ni falla: si no hay internet o sesión, simplemente no se manda. */
export function notifyTeam(businessId: string, msg: { title: string; body?: string; url?: string; tag?: string }, employeeId?: string, includeSelf = false): void {
  void (async () => {
    if (!navigator.onLine) return
    const token = await sessionToken().catch(() => undefined)
    if (!token) return
    const except = includeSelf ? '' : (await (await registration())?.pushManager.getSubscription().catch(() => null))?.endpoint ?? ''
    await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ businessId, ...msg, except, employeeId: includeSelf ? '' : (employeeId ?? '') }),
      keepalive: true,
    })
  })().catch(() => undefined)
}

/** Texto del aviso cuando una obra cambia de etapa (o entra al taller). */
export function jobNotice(o: { customer: string; title: string; stageLabel: string; by?: string; isNew?: boolean }) {
  const what = [o.title, o.customer].filter(Boolean).join(' · ') || 'Obra'
  return {
    title: o.isNew ? `Nueva obra: ${what}` : `${what}: ${o.stageLabel}`,
    body: `${o.isNew ? `Entró al taller (${o.stageLabel})` : `Pasó a «${o.stageLabel}»`}${o.by ? ` · lo marcó ${o.by}` : ''}`,
    url: '/obras',
    tag: `obra-${what}`.slice(0, 80),
  }
}
