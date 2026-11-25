// La URL y la clave «publishable» de Supabase son públicas por diseño: el acceso lo controlan las funciones y políticas del servidor.
// Archivo sin dependencias para que también lo use la página pública del catálogo (que no lleva supabase-js).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://opgiubxgxmzyjatexfzg.supabase.co'
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_8pL8BLHSdgbhIdqhmeZBgg_JMZelR-U'
