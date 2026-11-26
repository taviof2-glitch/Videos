import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getContact, listContacts } from '../data/contacts'
import { DEFAULT_SPECS, modulesSummary, type CutSpec } from '../data/cutlist'
import { dayKey } from '../data/dates'
import { formatMoney } from '../data/money'
import {
  CONFIG_LABELS, DEFAULT_CONFIG, DESK_COST_KEYS, MEASURED_COST_KEYS, MEASURED_KIND, medSummary, DEFAULT_DESK, DEFAULT_FORM, DESK_KEY, deskSummary, jobOf, DEFAULT_TYPES, JOB_FIELDS, calcQuote, quoteMessage, quoterSettings, saveQuoteCut, saveQuoterQuote, saveQuoterSettings, unitName,
  type JobType, type QuoterConfig, type QuoterForm,
} from '../data/quoter'
import { getQuote, listQuotes } from '../data/quotes'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'
import { useCan } from '../ui/actor'
import CutListPanel from '../ui/CutListPanel'
import Sketch from '../ui/Sketch'
import MedFields, { medForm, medSpec as toMedSpec, type MedForm } from '../ui/MedFields'
import QuoteBadge from '../ui/QuoteBadge'

const IVA_RATE = 16
const UNITS = ['metros lineales', 'piezas', 'm²']
const num = (s: string) => Math.max(0, parseFloat(s) || 0)
type Tab = 'cotizar' | 'despiece' | 'costos' | 'guardadas'

/** Cotizador rápido: del costo real del trabajo al precio que conviene cobrar; cada cotización se guarda en Cotizaciones. */
export default function Quoter({ business }: { business: Business }) {
  const can = useCan()
  const canSeeCosts = can('balance')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { cfg, types } = useMemo(() => quoterSettings(business), [business])
  const money = (c: number) => formatMoney(c, business.currency)
  const [tab, setTab] = useState<Tab>('cotizar')

  const [f, setF] = useState({ type: DEFAULT_FORM.type, q: '1', km: String(DEFAULT_FORM.km), suave: true, pint: false, cub: true, xmat: '0', xhrs: '0' })
  const [desk, setDesk] = useState({ largo: String(DEFAULT_DESK.largo), fondo: String(DEFAULT_DESK.fondo), alto: String(DEFAULT_DESK.alto), cajones: String(DEFAULT_DESK.cajones) })
  // Cocina, closet y mueble de TV se cotizan por medidas (o por metro lineal, como antes).
  const [byMed, setByMed] = useState(true)
  const [med, setMed] = useState<MedForm>(() => medForm(DEFAULT_SPECS[MEASURED_KIND[DEFAULT_FORM.type] ?? 'bajo']))
  // Grosor y veta del despiece guardado con la cotización.
  const [cutPrefs, setCutPrefs] = useState<{ grosor: number; girar: boolean; more?: CutSpec[] }>()
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [desc, setDesc] = useState('')
  const [delivery, setDelivery] = useState('2 a 3 semanas')
  const [iva, setIva] = useState(false)
  const [quoteId, setQuoteId] = useState<string>()
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  const [busy, setBusy] = useState(false)

  const customers = useLiveQuery(() => listContacts(business.id, 'customer'), [business.id]) ?? []
  const saved = useLiveQuery(async () => (await listQuotes(business.id)).filter((q) => q.quoter), [business.id]) ?? []
  const names = useLiveQuery(async () => new Map((await listContacts(business.id, 'customer')).map((c) => [c.id, c.name])), [business.id])
  const [today] = useState(() => dayKey(Date.now(), business.timezone))

  // El escritorio a la medida siempre está en la lista (salvo que el negocio ya tenga un trabajo propio con esa clave).
  const hasDesk = !(DESK_KEY in types)
  const isDesk = hasDesk && f.type === DESK_KEY
  const deskSpec = { largo: num(desk.largo), fondo: num(desk.fondo), alto: num(desk.alto), cajones: Math.round(num(desk.cajones)) }
  const medKind = f.type in types ? MEASURED_KIND[f.type] : undefined
  const isMed = !!medKind && byMed
  const medSpec: CutSpec | undefined = medKind && toMedSpec(medKind, med)
  const form: QuoterForm = { type: f.type in types || isDesk ? f.type : Object.keys(types)[0], q: num(f.q), km: num(f.km), suave: f.suave, pint: f.pint, cub: f.cub, xmat: num(f.xmat), xhrs: num(f.xhrs), ...(isDesk && { desk: deskSpec }), ...(isMed && { med: medSpec }) }
  const cutSpecNow: CutSpec | undefined = isDesk ? { kind: 'escritorio', largo: deskSpec.largo, alto: deskSpec.alto, fondo: deskSpec.fondo, cajones: deskSpec.cajones, puertas: 0, entrepanos: 0, divisiones: 0, grosor: 16 } : isMed ? medSpec : undefined
  const type = jobOf(types, form, cfg) ?? Object.values(types)[0]
  const r = useMemo(() => calcQuote(cfg, types, form), [cfg, types, f, desk, med, byMed]) // eslint-disable-line react-hooks/exhaustive-deps
  const extras = { customer, description: desc, delivery, iva, ivaRate: IVA_RATE }
  const text = quoteMessage(business, cfg, types, form, r, extras)
  const total = iva ? Math.round(r.priceCents * (1 + IVA_RATE / 100)) : r.priceCents
  const advance = Math.round((total * cfg.anticipo) / 100)

  // Abrir una cotización guardada (?q=id) para verla o cambiarla.
  const openId = params.get('q')
  useEffect(() => {
    if (!openId) return
    void (async () => {
      const q = await getQuote(openId)
      if (!q?.quoter) return
      const s = q.quoter
      setF({ type: s.type, q: String(s.q), km: String(s.km), suave: s.suave, pint: s.pint, cub: s.cub, xmat: String(s.xmat), xhrs: String(s.xhrs) })
      setCutPrefs(s.cut ? { grosor: s.cut.spec.grosor, girar: s.cut.girar, more: s.cut.more } : undefined)
      if (s.med) setMed(medForm(s.med))
      setByMed(!!s.med || !(s.type in MEASURED_KIND))
      if (s.desk) setDesk({ largo: String(s.desk.largo), fondo: String(s.desk.fondo), alto: String(s.desk.alto), cajones: String(s.desk.cajones) })
      const c = await getContact(q.contactId)
      setCustomer(c?.name ?? '')
      setPhone(c?.phone ?? '')
      setDesc(s.desc)
      setDelivery(s.delivery)
      setIva(s.iva)
      setQuoteId(q.id)
      setMsg(undefined)
      setTab('cotizar')
    })()
  }, [openId])

  function newQuote() {
    setF({ type: DEFAULT_FORM.type, q: '1', km: String(DEFAULT_FORM.km), suave: true, pint: false, cub: true, xmat: '0', xhrs: '0' })
    setCutPrefs(undefined)
    setByMed(true)
    setMed(medForm(DEFAULT_SPECS[MEASURED_KIND[DEFAULT_FORM.type] ?? 'bajo']))
    setCustomer('')
    setPhone('')
    setDesc('')
    setIva(false)
    setQuoteId(undefined)
    setMsg(undefined)
    if (openId) setParams({}, { replace: true })
  }

  async function save() {
    setBusy(true)
    setMsg(undefined)
    try {
      const q = await saveQuoterQuote(business, form, { ...extras, phone, quoteId, cutPrefs })
      setQuoteId(q.id)
      setMsg({ ok: true, text: `${quoteId ? 'Cotización actualizada.' : 'Cotización guardada en Cotizaciones.'}${q.quoter?.cut ? ' Lleva su despiece.' : ''}` })
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'No se pudo guardar' })
    }
    setBusy(false)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setMsg({ ok: true, text: 'Texto copiado.' })
    } catch {
      setMsg({ ok: false, text: 'No se pudo copiar. Usa el botón de WhatsApp.' })
    }
  }

  const bars: [string, number][] = [['Material', r.materialCents], ['Tu sueldo', r.laborCents], ['Taller y gasolina', r.shopCents], ['Ganancia', r.profitCents]]
  const topBar = Math.max(1, ...bars.map(([, v]) => v))

  return (
    <>
      <section className="row-between">
        <h1>Cotizador rápido</h1>
        <Link to="/cotizaciones" className="btn ghost small">Cotizaciones</Link>
      </section>
      <div className="tabs" role="tablist" aria-label="Cotizador">
        <button type="button" role="tab" aria-selected={tab === 'cotizar'} className={`tab-btn ${tab === 'cotizar' ? 'on' : ''}`} onClick={() => setTab('cotizar')}>Cotizar</button>
        <button type="button" role="tab" aria-selected={tab === 'despiece'} className={`tab-btn ${tab === 'despiece' ? 'on' : ''}`} onClick={() => setTab('despiece')}>Despiece</button>
        {canSeeCosts && <button type="button" role="tab" aria-selected={tab === 'costos'} className={`tab-btn ${tab === 'costos' ? 'on' : ''}`} onClick={() => setTab('costos')}>Mis costos</button>}
        <button type="button" role="tab" aria-selected={tab === 'guardadas'} className={`tab-btn ${tab === 'guardadas' ? 'on' : ''}`} onClick={() => setTab('guardadas')}>Guardadas ({saved.length})</button>
      </div>

      {tab === 'cotizar' && (
        <>
          <section className="card quoter-price" aria-live="polite">
            <small className="muted">{quoteId ? 'Cotización guardada · precio sugerido' : 'Precio sugerido'}</small>
            <strong className="quoter-big">{money(total)}</strong>
            <small className="muted">
              {iva ? `${money(r.priceCents)} + IVA ${IVA_RATE} % · ` : ''}
              {form.q > 0 ? `${money(Math.round(r.priceCents / form.q))} por ${unitName(type.u)} · ` : ''}{Math.round(r.hours)} h de trabajo
            </small>
          </section>

          <section className="card form">
            <div className="two">
              <label>
                Cliente
                <input list="quoter-customers" value={customer} onChange={(e) => { setCustomer(e.target.value); const c = customers.find((x) => x.name.localeCompare(e.target.value.trim(), 'es', { sensitivity: 'base' }) === 0); if (c) setPhone(c.phone) }} placeholder="Nombre" autoComplete="off" />
                <datalist id="quoter-customers">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </label>
              <label>
                WhatsApp <small className="muted">(opcional)</small>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="378 123 4567" />
              </label>
            </div>
            <label>
              ¿Qué se va a hacer?
              <select value={form.type} onChange={(e) => { const desk = hasDesk && e.target.value === DESK_KEY; const kind = desk ? undefined : MEASURED_KIND[e.target.value]; const t = desk ? { u: 'piezas' } : types[e.target.value]; setF({ ...f, type: e.target.value, ...((desk || (kind && byMed)) && { q: '1' }) }); if (kind) setMed(medForm(DEFAULT_SPECS[kind])); setDelivery(t.u === 'm²' ? '1 semana' : t.u === 'piezas' ? '1 a 2 semanas' : '2 a 3 semanas') }}>
                {Object.entries(types).map(([k, t]) => <option key={k} value={k}>{t.n}</option>)}
                {hasDesk && <option value={DESK_KEY}>Escritorio a la medida</option>}
              </select>
            </label>
            {medKind && (
              <div className="seg" role="group" aria-label="Cómo cotizar">
                <button type="button" className={byMed ? 'on' : ''} aria-pressed={byMed} onClick={() => { setByMed(true); setF({ ...f, q: '1' }) }}>Por medidas</button>
                <button type="button" className={byMed ? '' : 'on'} aria-pressed={!byMed} onClick={() => { setByMed(false); setF({ ...f, q: String(Math.max(0.1, num(med.largo) / 100)) }) }}>Por metro lineal</button>
              </div>
            )}
            {isMed && medKind && (
              <>
                <MedFields kind={medKind} form={med} onChange={setMed} legend="Medidas del mueble" />
                <small className="muted">El material sale del despiece de estas medidas: melamina, fondo, bisagras o riel, correderas, jaladeras y tubos. Las piezas las ves en la pestaña «Despiece».</small>
              </>
            )}
            {isDesk && (
              <fieldset className="desk-box">
                <legend>Medidas del escritorio <small className="muted">(cm)</small></legend>
                <div className="three">
                  <label>Largo<input value={desk.largo} onChange={(e) => setDesk({ ...desk, largo: e.target.value })} inputMode="decimal" /></label>
                  <label>Fondo<input value={desk.fondo} onChange={(e) => setDesk({ ...desk, fondo: e.target.value })} inputMode="decimal" /></label>
                  <label>Alto<input value={desk.alto} onChange={(e) => setDesk({ ...desk, alto: e.target.value })} inputMode="decimal" /></label>
                </div>
                <label>
                  ¿Cuántos cajones?
                  <div className="stepper">
                    <button type="button" className="btn ghost" aria-label="Quitar un cajón" onClick={() => setDesk({ ...desk, cajones: String(Math.max(0, deskSpec.cajones - 1)) })}>−</button>
                    <input value={desk.cajones} onChange={(e) => setDesk({ ...desk, cajones: e.target.value })} inputMode="numeric" aria-label="Cajones" />
                    <button type="button" className="btn ghost" aria-label="Agregar un cajón" onClick={() => setDesk({ ...desk, cajones: String(deskSpec.cajones + 1) })}>+</button>
                  </div>
                </label>
                <small className="muted">Calcula la melamina de cubierta, costados y faldón; cada cajón suma su caja, correderas y jaladera.</small>
              </fieldset>
            )}
            {cutSpecNow && <Sketch spec={cutSpecNow} />}
            <div className="two">
              <label>
                Cantidad <small className="muted">({type.u})</small>
                <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} inputMode="decimal" />
              </label>
              <label>
                Distancia a la obra <small className="muted">(km, ida)</small>
                <input value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} inputMode="decimal" />
              </label>
            </div>
            <label className="check"><input type="checkbox" checked={f.suave} onChange={(e) => setF({ ...f, suave: e.target.checked })} /><span>Herrajes de cierre suave</span></label>
            {!type.pint && <label className="check"><input type="checkbox" checked={f.pint} onChange={(e) => setF({ ...f, pint: e.target.checked })} /><span>Acabado pintado (laca con pistola)</span></label>}
            {type.cub ? <label className="check"><input type="checkbox" checked={f.cub} onChange={(e) => setF({ ...f, cub: e.target.checked })} /><span>Incluye cubierta</span></label> : null}
            <div className="two">
              <label>
                Material extra <small className="muted">($)</small>
                <input value={f.xmat} onChange={(e) => setF({ ...f, xmat: e.target.value })} inputMode="decimal" />
              </label>
              <label>
                Horas extra
                <input value={f.xhrs} onChange={(e) => setF({ ...f, xhrs: e.target.value })} inputMode="decimal" />
              </label>
            </div>
            <div className="two">
              <label>
                Entrega aprox.
                <input value={delivery} onChange={(e) => setDelivery(e.target.value)} />
              </label>
              <label>
                Descripción para el cliente
                <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej. color nogal, 6 puertas" />
              </label>
            </div>
            <label className="check"><input type="checkbox" checked={iva} onChange={(e) => setIva(e.target.checked)} /><span>Sumar IVA ({IVA_RATE} %) al precio</span></label>
          </section>

          <section className="card">
            <div className="kv"><span>Anticipo para iniciar ({cfg.anticipo} %)</span><strong>{money(advance)}</strong></div>
            {canSeeCosts && (
              <>
                <ul className="ranking quoter-bars" aria-label="De qué se compone el precio">
                  {bars.map(([n, v]) => (
                    <li key={n}>
                      <div className="row-between"><span>{n}</span><strong>{money(v)}</strong></div>
                      <div className="meter" aria-hidden><span style={{ width: `${Math.max(2, (v / topBar) * 100)}%` }} /></div>
                    </li>
                  ))}
                </ul>
                <div className="kv"><span>No bajes de</span><strong>{money(r.costCents)}</strong></div>
                {r.list && (
                  <p className={`note-box ${r.list.diffCents < 0 ? 'bad' : ''}`}>
                    {r.list.diffCents < 0
                      ? `Con tu precio de lista (${money(type.lista * 100)} por ${unitName(type.u)}) cobrarías ${money(r.list.totalCents)}: perderías ${money(-r.list.diffCents)} contando tu sueldo.`
                      : `Con tu precio de lista cobrarías ${money(r.list.totalCents)}; te quedaría ${money(r.list.diffCents)} además de tu sueldo.`}
                  </p>
                )}
              </>
            )}
          </section>

          <div className="quoter-actions">
            <button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>{quoteId ? 'Actualizar cotización' : 'Guardar cotización'}</button>
            <a className="btn sale" href={whatsappLink(text, phone, business.country)} target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>
            <button type="button" className="btn ghost" onClick={() => void copy()}>Copiar texto</button>
          </div>
          {msg && <p className={msg.ok ? 'success' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
          {quoteId && (
            <div className="quick">
              <button type="button" className="btn ghost" onClick={() => navigate(`/cotizaciones/${quoteId}`)}>Ver la cotización</button>
              <button type="button" className="btn ghost" onClick={newQuote}>Nueva cotización</button>
            </div>
          )}
        </>
      )}

      {tab === 'despiece' && (
        <>
          {quoteId && cutSpecNow && <p className="muted">Este despiece se guarda con la cotización de {customer || 'este cliente'}. Si cambias el grosor, la veta o alguna medida aquí, toca «Guardar despiece en la cotización».</p>}
          <CutListPanel
            business={business}
            initial={cutSpecNow ? { ...cutSpecNow, ...(cutPrefs && { grosor: cutPrefs.grosor }) } : undefined}
            initialMore={cutPrefs?.more}
            initialGirar={cutPrefs?.girar}
            onSave={quoteId ? async (specs, girar) => { await saveQuoteCut(quoteId, specs, girar); setCutPrefs({ grosor: specs[0].grosor, girar, more: specs.slice(1) }) } : undefined}
          />
        </>
      )}

      {tab === 'costos' && canSeeCosts && <Costs business={business} />}

      {tab === 'guardadas' && (
        <section className="card">
          <h2>Cotizaciones del cotizador</h2>
          {saved.length === 0 ? (
            <p className="muted">Todavía no guardas ninguna. Cuando cotices, toca «Guardar cotización»: también aparece en Cotizaciones.</p>
          ) : (
            <ul className="quoter-saved">
              {saved.map((q) => (
                <li key={q.id}>
                  <div className="row-between">
                    <strong>{names?.get(q.contactId) ?? 'Cliente'}</strong>
                    <strong>{money(q.totalCents)}</strong>
                  </div>
                  <small className="muted">{q.title} · {q.quoter!.desk ? deskSummary(q.quoter!.desk) : q.quoter!.med ? medSummary(q.quoter!.med) : `${q.quoter!.q} ${types[q.quoter!.type]?.u ?? ''}`}</small>
                  <div className="row-between">
                    <QuoteBadge quote={q} today={today} />
                    <span className="quick">
                      <button type="button" className="btn small ghost" onClick={() => { setParams({ q: q.id }, { replace: true }) }}>Abrir</button>
                      <Link to={`/cotizaciones/${q.id}`} className="btn small ghost">Ver</Link>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

/** Los costos y los tipos de trabajo (solo quien puede ver el balance). */
function Costs({ business }: { business: Business }) {
  const initial = useMemo(() => quoterSettings(business), [business])
  const [cfg, setCfg] = useState<Record<keyof QuoterConfig, string>>(() => Object.fromEntries(Object.entries(initial.cfg).map(([k, v]) => [k, String(v)])) as Record<keyof QuoterConfig, string>)
  const [types, setTypes] = useState<Record<string, JobType>>(() => structuredClone(initial.types))
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState(UNITS[0])
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()

  const liveCfg = Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, num(v)])) as unknown as QuoterConfig
  const deskPreview = calcQuote(liveCfg, types, { type: DESK_KEY, q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, desk: DEFAULT_DESK })

  const tvPreview = calcQuote(liveCfg, types, { type: 'tv' in types ? 'tv' : Object.keys(types)[0], q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, med: DEFAULT_SPECS.tv })

  const kitchenSample: CutSpec = { ...DEFAULT_SPECS.bajo, largo: 250 }
  const kitchenPreview = calcQuote(liveCfg, types, { type: 'cocina_inf' in types ? 'cocina_inf' : Object.keys(types)[0], q: 1, km: 0, suave: true, pint: false, cub: true, xmat: 0, xhrs: 0, med: kitchenSample })

  const setField = (k: string, field: keyof JobType, v: string) => setTypes({ ...types, [k]: { ...types[k], [field]: num(v) } })

  async function save() {
    await saveQuoterSettings(business.id, Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, num(v)])) as unknown as QuoterConfig, types)
    setMsg({ ok: true, text: 'Costos guardados.' })
  }
  function reset() {
    setCfg(Object.fromEntries(Object.entries(DEFAULT_CONFIG).map(([k, v]) => [k, String(v)])) as Record<keyof QuoterConfig, string>)
    setTypes(structuredClone(DEFAULT_TYPES))
    setMsg({ ok: true, text: 'Valores iniciales puestos. Toca «Guardar costos» para conservarlos.' })
  }
  function add() {
    const name = newName.trim()
    if (!name) return setMsg({ ok: false, text: 'Escribe el nombre del trabajo.' })
    setTypes({ ...types, [`t${Date.now().toString(36)}`]: { n: name, u: newUnit, h: 0, f: 0, b: 0, c: 0, j: 0, m: 0, hr: 0, fr: 0, cub: 0, lista: 0 } })
    setNewName('')
    setMsg(undefined)
  }

  return (
    <>
      <p className="muted">Los valores iniciales son aproximados. Cámbialos por los precios de tu proveedor y lo que de verdad quieres ganar; se guardan con tu negocio y se comparten entre tus aparatos.</p>
      <section className="card form">
        <h2>Tus costos</h2>
        <div className="two">
          {(Object.keys(CONFIG_LABELS) as (keyof QuoterConfig)[]).filter((k) => !([...DESK_COST_KEYS, ...MEASURED_COST_KEYS] as readonly string[]).includes(k)).map((k) => (
            <label key={k}>
              {CONFIG_LABELS[k]}
              <input value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} inputMode="decimal" />
            </label>
          ))}
        </div>
      </section>
      <section className="card form">
        <h2>Muebles por medidas</h2>
        <p className="muted">Cocina, closet y mueble de TV cotizados por medidas: el material sale del despiece y las horas de estos valores (los cajones usan las «horas por cada cajón» de abajo). La cocina se arma en módulos de 1 m como máximo: cada módulo suma sus horas y su material extra.</p>
        <div className="two">
          {MEASURED_COST_KEYS.map((k) => (
            <label key={k}>
              {CONFIG_LABELS[k]}
              <input value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} inputMode="decimal" />
            </label>
          ))}
        </div>
        <p className="note-box" aria-live="polite">
          Una cocina de muebles bajos de 2.5 m ({modulesSummary(kitchenSample)}) se cobra en <strong>{formatMoney(kitchenPreview.priceCents, business.currency)}</strong> ({Math.round(kitchenPreview.hours * 10) / 10} h de trabajo, con cubierta).
        </p>
        <p className="note-box" aria-live="polite">
          Con estos valores, un mueble de TV de {medSummary(DEFAULT_SPECS.tv)} se cobra en <strong>{formatMoney(tvPreview.priceCents, business.currency)}</strong> (no bajes de {formatMoney(tvPreview.costCents, business.currency)}; {Math.round(tvPreview.hours * 10) / 10} h de trabajo).
        </p>
      </section>
      <section className="card form">
        <h2>Escritorio a la medida</h2>
        <p className="muted">El escritorio usa tus costos de arriba (melamina, correderas, jaladeras, sueldo y taller). Aquí ajustas lo que es propio del escritorio; baja las horas o el material si te salen muy altos.</p>
        <div className="two">
          {DESK_COST_KEYS.map((k) => (
            <label key={k}>
              {CONFIG_LABELS[k]}
              <input value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} inputMode="decimal" />
            </label>
          ))}
        </div>
        <p className="note-box" aria-live="polite">
          Con estos valores, un escritorio de {DEFAULT_DESK.largo} × {DEFAULT_DESK.fondo} × {DEFAULT_DESK.alto} cm con {DEFAULT_DESK.cajones} cajones se cobra en <strong>{formatMoney(deskPreview.priceCents, business.currency)}</strong> (no bajes de {formatMoney(deskPreview.costCents, business.currency)}; {Math.round(deskPreview.hours * 10) / 10} h de trabajo).
        </p>
      </section>
      <section className="card">
        <h2>Lo que lleva cada trabajo</h2>
        <p className="muted">Por cada metro lineal, pieza o m². Ajusta según tus trabajos reales.</p>
        <ul className="quoter-types">
          {Object.entries(types).map(([k, t]) => (
            <li key={k}>
              <details>
                <summary><strong>{t.n}</strong> <small className="muted">por {unitName(t.u)}</small></summary>
                <div className="form">
                  <label>Nombre<input value={t.n} onChange={(e) => setTypes({ ...types, [k]: { ...t, n: e.target.value } })} /></label>
                  <div className="two">
                    {(Object.keys(JOB_FIELDS) as (keyof typeof JOB_FIELDS)[]).map((field) => (
                      <label key={field}>{JOB_FIELDS[field]}<input value={t[field]} onChange={(e) => setField(k, field, e.target.value)} inputMode="decimal" /></label>
                    ))}
                  </div>
                  <label className="check"><input type="checkbox" checked={!!t.cub} onChange={(e) => setTypes({ ...types, [k]: { ...t, cub: e.target.checked ? 1 : 0 } })} /><span>Puede llevar cubierta</span></label>
                  {Object.keys(types).length > 1 && <button type="button" className="btn danger-text" onClick={() => { const next = { ...types }; delete next[k]; setTypes(next) }}>Quitar este trabajo</button>}
                </div>
              </details>
            </li>
          ))}
        </ul>
        <div className="form">
          <h3>Agregar otro tipo de trabajo</h3>
          <div className="two">
            <label>Nombre<input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Escritorio" /></label>
            <label>Se cobra por<select value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
          </div>
          <button type="button" className="btn ghost" onClick={add}>Agregar</button>
        </div>
      </section>
      <div className="quoter-actions">
        <button type="button" className="btn primary" onClick={() => void save()}>Guardar costos</button>
        <button type="button" className="btn ghost" onClick={reset}>Volver a valores iniciales</button>
      </div>
      {msg && <p className={msg.ok ? 'success' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </>
  )
}
