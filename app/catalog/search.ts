const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Todas las palabras de la búsqueda aparecen en el texto, sin acentos ni mayúsculas. */
export function matchesText(text: string, search: string): boolean {
  const hay = normalize(text)
  return normalize(search).split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
}
