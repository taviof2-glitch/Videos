import { createContext, useContext } from 'react'
import { can, type Actor, type Permission, SOLO_OWNER } from '../data/team'

/** Quién está usando la app ahora (T13). Fuera del control de usuarios es el dueño sin PIN. */
export const ActorContext = createContext<Actor>(SOLO_OWNER)
export const useActor = () => useContext(ActorContext)
/** `can('balance')`, etc., para la persona que está usando la app. */
export function useCan(): (permission: Permission) => boolean {
  const actor = useActor()
  return (p) => can(actor, p)
}
