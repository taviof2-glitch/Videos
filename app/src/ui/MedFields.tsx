import { DEFAULT_SPECS, drawerModules, isKitchen, modulesSummary, PUERTA_LABEL, REPARTO_LABEL, towers, type CutSpec, type FurnitureKind, type PuertaTipo, type Reparto } from '../data/cutlist'

/** Lo que se captura de un mueble por medidas (como texto, tal cual se escribe). */
export type MedForm = Record<'largo' | 'alto' | 'fondo' | 'puertas' | 'cajones' | 'entrepanos' | 'divisiones' | 'torres' | 'modCajones' | 'tubos', string> & { reparto: Reparto; puertaTipo: PuertaTipo }

const num = (s: string) => Math.max(0, parseFloat(s) || 0)
const int = (s: string) => Math.round(num(s))

export const medForm = (s: CutSpec): MedForm => ({
  largo: String(s.largo), alto: String(s.alto), fondo: String(s.fondo), puertas: String(s.puertas), cajones: String(s.cajones), entrepanos: String(s.entrepanos),
  divisiones: String(s.divisiones), torres: String(towers(s)), modCajones: String(s.modCajones ?? 1), tubos: String(s.tubos ?? 0), reparto: s.reparto ?? 'auto', puertaTipo: s.puertaTipo ?? 'abatible',
})
export const defaultMedForm = (kind: FurnitureKind) => medForm(DEFAULT_SPECS[kind])

/** Las medidas escritas, como las usa el despiece y el cotizador. */
export function medSpec(kind: FurnitureKind, f: MedForm, grosor = 16): CutSpec {
  const closet = kind === 'closet'
  const desk = kind === 'escritorio'
  return {
    kind, largo: num(f.largo), alto: num(f.alto), fondo: num(f.fondo), grosor,
    puertas: desk ? 0 : int(f.puertas), cajones: int(f.cajones), entrepanos: desk ? 0 : int(f.entrepanos),
    // En el closet se cuentan torres: una división menos.
    divisiones: desk ? 0 : closet ? Math.max(0, int(f.torres) - 1) : int(f.divisiones),
    ...(isKitchen(kind) && { reparto: f.reparto, modCajones: Math.max(1, int(f.modCajones)) }),
    ...(closet && { puertaTipo: f.puertaTipo, tubos: int(f.tubos) }),
  }
}

/** Los campos de medidas de un mueble, con lo propio de cada tipo: módulos en cocina, torres, puertas y tubos en closet. */
export default function MedFields({ kind, form, onChange, legend = 'Medidas' }: { kind: FurnitureKind; form: MedForm; onChange: (f: MedForm) => void; legend?: string }) {
  const spec = medSpec(kind, form)
  const kitchen = isKitchen(kind)
  const closet = kind === 'closet'
  const desk = kind === 'escritorio'
  const mods = modulesSummary(spec)
  const nMods = mods ? Number(mods.split(' ')[0]) : 1
  const field = (k: keyof Omit<MedForm, 'reparto' | 'puertaTipo'>, label: string, mode: 'decimal' | 'numeric' = 'numeric') => (
    <label>
      {label}
      <input value={form[k]} onChange={(e) => onChange({ ...form, [k]: e.target.value })} inputMode={mode} />
    </label>
  )
  return (
    <>
      <fieldset className="desk-box">
        <legend>{legend} <small className="muted">(cm)</small></legend>
        <div className="three">
          {field('largo', 'Largo', 'decimal')}
          {field('alto', 'Alto', 'decimal')}
          {field('fondo', 'Fondo', 'decimal')}
        </div>
      </fieldset>

      {kitchen && (
        <>
          <label>
            Módulos <small className="muted">(de 1 m como máximo)</small>
            <select value={form.reparto} onChange={(e) => onChange({ ...form, reparto: e.target.value as Reparto })}>
              {(Object.keys(REPARTO_LABEL) as Reparto[]).map((r) => <option key={r} value={r}>{REPARTO_LABEL[r]}</option>)}
            </select>
          </label>
          <p className="note-box" aria-live="polite">{mods ? `Se arma en ${mods}.` : 'Va en un solo módulo.'}</p>
          <div className="two">
            {field('puertas', mods ? 'Puertas por módulo' : 'Puertas')}
            {field('entrepanos', mods ? 'Entrepaños por módulo' : 'Entrepaños')}
            {field('cajones', mods ? 'Cajones (en cada módulo con cajones)' : 'Cajones')}
            {mods && spec.cajones > 0 && field('modCajones', `Módulos con cajones (de ${nMods})`)}
            {field('divisiones', mods ? 'Divisiones por módulo' : 'Divisiones verticales')}
          </div>
          {spec.cajones > 0 && (
            <p className="muted">
              {mods ? `${drawerModules(spec) === 1 ? '1 módulo lleva' : `${drawerModules(spec)} módulos llevan`} cajones; los demás, puertas. ` : ''}
              {spec.cajones >= 3 ? 'Con 3 cajones o más el módulo es una cajonera completa, sin puertas.' : 'Con 1 o 2 cajones, van arriba y las puertas debajo.'}
            </p>
          )}
        </>
      )}

      {closet && (
        <>
          <div className="two">
            {field('torres', 'Torres')}
            {field('cajones', 'Cajones por torre')}
            {field('entrepanos', 'Entrepaños por torre')}
            {field('tubos', 'Tubos para colgar')}
            {field('puertas', 'Puertas')}
            <label>
              Tipo de puertas
              <select value={form.puertaTipo} onChange={(e) => onChange({ ...form, puertaTipo: e.target.value as PuertaTipo })}>
                {(Object.keys(PUERTA_LABEL) as PuertaTipo[]).map((t) => <option key={t} value={t}>{PUERTA_LABEL[t]}</option>)}
              </select>
            </label>
          </div>
          <p className="muted">
            {towers(spec) === 1 ? 'Una torre' : `${towers(spec)} torres`}: los cajones y entrepaños son por torre{spec.tubos ? `, y cada tubo va al ancho de una torre` : ''}.
            {spec.puertas > 0 && form.puertaTipo === 'corrediza' ? ' Las corredizas van en riel (mínimo 2) y se enciman 3 cm.' : ''}
          </p>
        </>
      )}

      {kind === 'tv' && (
        <div className="two">
          {field('puertas', 'Puertas')}
          {field('cajones', 'Cajones')}
          {field('entrepanos', 'Entrepaños')}
          {field('divisiones', 'Divisiones verticales')}
        </div>
      )}

      {desk && <div className="two">{field('cajones', 'Cajones')}</div>}
    </>
  )
}
