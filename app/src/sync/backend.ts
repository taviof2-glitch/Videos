// Lo que la app necesita del servidor: cuenta y funciones de sincronización.
// En producción lo da Supabase (supabase.ts); en las pruebas, un Postgres local.
import type { SyncTransport } from './engine'

export type BusinessStatus = 'member' | 'unclaimed' | 'forbidden'

export interface Session {
  userId: string
  email: string
}

export interface SyncBackend extends SyncTransport {
  getSession(): Promise<Session | null>
  /** Credencial de la sesión para llamar a funciones propias del servidor (el asistente). */
  accessToken?(): Promise<string | undefined>
  /** Avisa cuando la sesión cambia (entra, sale o caduca). */
  onSessionChange(cb: (s: Session | null) => void): void
  signIn(email: string, password: string): Promise<Session>
  /** Crea la cuenta; hay que confirmar el correo antes de poder entrar. */
  signUp(email: string, password: string): Promise<void>
  resendConfirmation(email: string): Promise<void>
  signOut(): Promise<void>
  businessStatus(businessId: string): Promise<BusinessStatus>
  claimBusiness(businessId: string): Promise<void>
  myBusinesses(): Promise<{ businessId: string; name: string }[]>
  /** Página pública del catálogo en vivo (null si aún no se eligió nombre). */
  getCatalogPage(businessId: string): Promise<CatalogPage | null>
  setCatalogPage(businessId: string, slug: string, enabled: boolean): Promise<CatalogPage>
}

export interface CatalogPage {
  slug: string
  enabled: boolean
}

/** Errores de la cuenta en palabras de la dueña. */
export function accountError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(msg)) return 'Aún no confirmas tu correo. Abre el enlace que te enviamos y vuelve a intentarlo.'
  if (/already registered|already been registered/i.test(msg)) return 'Ya existe una cuenta con ese correo. Entra con tu contraseña.'
  if (/rate limit|too many/i.test(msg)) return 'Se enviaron demasiados correos. Espera una hora y vuelve a intentarlo.'
  if (/password.*(at least|characters)/i.test(msg)) return 'La contraseña debe tener al menos 8 caracteres.'
  if (/invalid.*email|email.*invalid/i.test(msg)) return 'El correo no es válido.'
  if (/slug_taken/.test(msg)) return 'Ese nombre ya lo usa otro negocio. Elige uno distinto.'
  if (/bad_slug/.test(msg)) return 'El nombre debe tener de 3 a 40 letras minúsculas, números o guiones, sin espacios ni acentos.'
  if (/forbidden/i.test(msg)) return 'Este negocio pertenece a otra cuenta.'
  if (/timeout|aborted|timed out/i.test(msg)) return 'La conexión tardó demasiado. Se volverá a intentar sola.'
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Sin conexión con el servidor. Revisa tu internet.'
  return msg
}

/** Fallos de red o de tiempo: se reintenta solo, sin mostrar «Error». */
export const isNetworkError = (e: unknown) =>
  /failed to fetch|networkerror|load failed|network request failed|timeout|timed out|aborted|aborterror/i.test(e instanceof Error ? `${e.name} ${e.message}` : String(e))
