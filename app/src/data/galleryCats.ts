// Tipos de mueble de la galería y el texto para redes. Sin nada del navegador (lo usa también api/galeria.ts).

export const CATEGORIES: [string, string, RegExp][] = [
  ['closet', 'Closets', /cl[oó]set|vestidor|ropero/i],
  ['cocina', 'Cocinas', /cocina|alacena|barra|isla/i],
  ['tv', 'Muebles de TV', /\btv\b|televis|centro de entretenimiento/i],
  ['bano', 'Baños', /ba[nñ]o|lavabo|vanity/i],
  ['escritorio', 'Escritorios y oficina', /escritorio|oficina|librero/i],
  ['recamara', 'Recámaras', /cama|cabecera|bur[oó]|litera|c[oó]moda/i],
  ['puerta', 'Puertas', /puerta/i],
  ['otro', 'Otros muebles', /./],
]

export const categoryOf = (title: string) => CATEGORIES.find(([, , re]) => re.test(title))![0]
export const categoryLabel = (key: string) => CATEGORIES.find(([k]) => k === key)?.[1] ?? 'Otros muebles'

/** Texto para Facebook, Instagram o Marketplace con la foto de una obra. */
export function socialText(o: { title: string; category: string; business: string; phone?: string }): string {
  const tags: Record<string, string> = { closet: '#closet #vestidor', cocina: '#cocinaintegral #cocina', tv: '#muebledetv #sala', bano: '#baño #muebledebaño', escritorio: '#escritorio #homeoffice', recamara: '#recamara #cabecera', puerta: '#puertas', otro: '#muebles' }
  return [
    `✨ ${o.title || categoryLabel(o.category).replace(/s$/, '')} a la medida, hecho en nuestro taller.`,
    'Diseñamos y fabricamos tus muebles con las medidas exactas de tu espacio: melamina de calidad, herrajes de cierre suave e instalación incluida.',
    `📍 Tepatitlán y alrededores${o.phone ? ` · 📲 ${o.phone}` : ''}`,
    `Pide tu cotización sin compromiso por WhatsApp. — ${o.business}`,
    `${tags[o.category] ?? '#muebles'} #carpinteria #mueblesalamedida #tepatitlan #houselite`,
  ].join('\n\n')
}
