import { closetLayout, DEFAULT_SPECS, drawerModules, hasMaletero, MALETERO, outerSides, isKitchen, modulesSummary, PUERTA_LABEL, REPARTO_LABEL, towers, type CutSpec, type FurnitureKind, type PuertaTipo, type Reparto } from '../data/cutlist'

/** Lo que se captura de un mueble por medidas (como texto, tal cual se escribe). */
export type MedForm = Record<'largo' | 'alto' | 'fondo' | 'puertas' | 'cajones' | 'entrepanos' | 'divisiones' | 'torres' | 'modCajones' | 'tubos', string> & { reparto: Reparto; puertaTipo: PuertaTipo; maletero: boolean; costados: string }

const num = (s: string) => Math.max(0, parseFloat(s) || 0)
const int = (s: string) => Math.round(num(s))

export const medForm = (s: CutSpec): MedForm => ({
  largo: String(s.largo), alto: String(s.alto), fondo: String(s.fondo), puertas: String(s.puertas), cajones: String(isKitchen(s.kind) && !(s.cajones > 0) ? 3 : s.cajones), entrepanos: String(s.entrepanos),
  divisiones: String(s.divisiones), torres: String(towers(s)), modCajones: isKitchen(s.kind) ? (s.cajones > 0 ? String(s.modCajones ?? 1) : '0') : '1', tubos: String(s.tubos ?? 0), reparto: s.reparto ?? 'auto', puertaTipo: s.puertaTipo ?? 'abatible', maletero: hasMaletero(s), costados: String(outerSides(s)),
})
export const defaultMedForm = (kind: FurnitureKind) => medForm(DEFAULT_SPECS[kind])

/** Las medidas escritas, como las usa el despiece y el cotizador. */
export function medSpec(kind: FurnitureKind, f: MedForm, grosor = 15): CutSpec {
  const closet = kind === 'closet'
  const desk = kind === 'escritorio'
  return {
    // Las torres de closet son siempre de 60 de fondo.
    kind, largo: num(f.largo), alto: num(f.alto), fondo: closet ? 60 : num(f.fondo), grosor,
    // En cocina los cajones existen solo si hay módulos con cajones.
    puertas: desk ? 0 : int(f.puertas), cajones: isKitchen(kind) && int(f.modCajones) === 0 ? 0 : int(f.cajones), entrepanos: desk ? 0 : int(f.entrepanos),
    // En el closet se cuentan torres: una división menos.
    divisiones: desk ? 0 : closet ? Math.max(0, int(f.torres) - 1) : int(f.divisiones),
    ...(isKitchen(kind) && { reparto: f.reparto, modCajones: int(f.modCajones) }),
    ...(closet && { puertaTipo: f.puertaTipo, tubos: int(f.tubos), maletero: f.maletero, costados: Math.min(2, int(f.costados)) }),
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
  const conCajones = drawerModules(spec)
  const lay = closetLayout(spec)
  const field = (k: keyof Omit<MedForm, 'reparto' | 'puertaTipo' | 'maletero' | 'costados'>, label: string, mode: 'decimal' | 'numeric' = 'numeric') => (
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
          {closet ? <label>Fondo<input value="60" disabled aria-describedby="closet-nota" /></label> : field('fondo', 'Fondo', 'decimal')}
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
          <fieldset className="desk-box">
            <legend>Módulos con puertas <small className="muted">({nMods - conCajones} de {nMods})</small></legend>
            <div className="two">
              {field('puertas', 'Puertas por módulo')}
              {field('entrepanos', 'Entrepaños por módulo')}
            </div>
            {nMods - conCajones === 0 && <small className="muted">Todos los módulos son de cajones: no hay módulos con puertas.</small>}
          </fieldset>
          <fieldset className="desk-box">
            <legend>Módulos con cajones <small className="muted">({conCajones} de {nMods})</small></legend>
            <div className="two">
              {field('modCajones', '¿Cuántos módulos?')}
              {field('cajones', 'Cajones por módulo')}
            </div>
            <small className="muted">{conCajones === 0 ? 'Pon cuántos módulos llevan cajones (0 = ninguno).' : 'Un módulo con cajones lleva solo cajones, repartidos en todo su alto. Van en los módulos más largos.'}</small>
          </fieldset>
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
          <label>
            Costados exteriores
            <select value={form.costados} onChange={(e) => onChange({ ...form, costados: e.target.value })}>
              <option value="0">Ninguno (empotrado entre muros)</option>
              <option value="1">1 costado</option>
              <option value="2">2 costados</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={form.maletero} onChange={(e) => onChange({ ...form, maletero: e.target.checked })} /><span>Lleva maletero (entrepaño corrido arriba, de {MALETERO} cm de alto)</span></label>
          <p className="note-box" id="closet-nota" aria-live="polite">
            {lay.n === 1 ? '1 torre' : `${lay.n} torres`} de 60 cm de ancho × 60 de fondo
            {lay.libre > 0 ? `; quedan ${lay.libre} cm libres para colgar${lay.espacios > 1 ? ` (${lay.espacios} espacios de ${lay.espacio} cm)` : ''}.` : '; no queda espacio libre.'}
            {lay.n < towers(spec) ? ` En ${spec.largo} cm solo caben ${lay.n}.` : ''}
          </p>
          <p className="muted">
            Los cajones y entrepaños son por torre{spec.tubos ? '; cada tubo va al ancho de un espacio libre' : ''}.
            {spec.puertas > 0 ? (form.puertaTipo === 'corrediza' ? ' Las puertas corredizas cubren todo el largo, van en riel (mínimo 2) y se enciman 3 cm.' : ' Las puertas cubren todo el largo.') : ''}
          </p>
        </>
      )}

      {!kitchen && !closet && !desk && (
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
