import PhotoQuote from '../ui/PhotoQuote'
import type { PhotoIntent } from '../data/photoCatalog'
import { listProducts } from '../data/products'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getContact, listContacts } from '../data/contacts'
import { DEFAULT_SPECS, modulesSummary, type CutSpec } from '../data/cutlist'
import { dayKey } from '../data/dates'
import { formatMoney } from '../data/money'
import {
  costsFor, PER_JOB_KEYS, SIMPLE_KEY, BOARD_KEY, BOARD_COST_KEYS, BOARD_WOOD_LABEL, DEFAULT_BOARD, boardUnitCents, type BoardSpec, type BoardWood, DEFAULT_SIMPLE, simpleSummary, BASE_COST_KEYS, CONFIG_LABELS, DEFAULT_CONFIG, DESK_COST_KEYS, BUILTIN_MEASURED, MEASURED_COST_KEYS, MEASURED_KIND, medSummary, DEFAULT_DESK, DEFAULT_FORM, DESK_KEY, deskSummary, jobOf, DEFAULT_TYPES, JOB_FIELDS, calcQuote, quoteMessage, quoterSettings, projectExtras, saveQuoteCut, saveQuoterQuote, saveQuoterSettings, unitName,
  type JobOverrides, type JobType, type QuoterConfig, type QuoterForm,
} from '../data/quoter'
import { getQuote, listQuotes } from '../data/quotes'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'
import { useCan } from '../ui/actor'
import CutListPanel from '../ui/CutListPanel'
import Sketch from '../ui/Sketch'
import { simpleClosetSketch } from '../data/sketch'
import MedFields, { medForm, medSpec as toMedSpec, type MedForm } from '../ui/MedFields'
import QuoteBadge from '../ui/QuoteBadge'
import BasesPanel from '../ui/BasesPanel'
import { baseTitle, initialBase, SHEET_PRESETS, type BaseState } from '../data/bases'
import ServicesPanel from '../ui/ServicesPanel'
import { isOn, serviceDefaults, servicePrices, serviceTitle, SERVICES, type Part, type ServConfig, type ServState } from '../data/services'

const IVA_RATE = 16
const UNITS = ['metros lineales', 'piezas', 'm²']
const num = (s: string) => Math.max(0, parseFloat(s) || 0)
type Tab = 'cotizar' | 'bases' | 'servicios' | 'despiece' | 'costos' | 'guardadas'

/** Cotizador rápido: del costo real del trabajo al precio que conviene cobrar; cada cotización se guarda en Cotizaciones. */
export default function Quoter({ business }: { business: Business }) {
  const can = useCan()
  const canSeeCosts = can('balance')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { cfg, types, mats, serv: servConf, over } = useMemo(() => quoterSettings(business), [business])
  const money = (c: number) => formatMoney(c, business.currency)
  const [tab, setTab] = useState<Tab>('cotizar')

  const [f, setF] = useState({ type: DEFAULT_FORM.type, q: '1', km: String(DEFAULT_FORM.km), suave: true, pint: false, cub: true, xmat: '0', xhrs: '0' })
  const [simple, setSimple] = useState(() => Object.fromEntries(Object.entries(DEFAULT_SIMPLE).map(([k, v]) => [k, String(v)])) as Record<keyof typeof DEFAULT_SIMPLE, string>)
  const [desk, setDesk] = useState({ largo: String(DEFAULT_DESK.largo), fondo: String(DEFAULT_DESK.fondo), alto: String(DEFAULT_DESK.alto), cajones: String(DEFAULT_DESK.cajones) })
  // Cocina, closet y mueble de TV se cotizan por medidas (o por metro lineal, como antes).
  const [byMed, setByMed] = useState(true)
  const [med, setMed] = useState<MedForm>(() => medForm(DEFAULT_SPECS[MEASURED_KIND[DEFAULT_FORM.type] ?? 'bajo']))
  // Grosor y veta del despiece guardado con la cotización.
  const [cutPrefs, setCutPrefs] = useState<{ grosor: number; girar: boolean; more?: CutSpec[] }>()
  const [withSketch, setWithSketch] = useState(false)
  // Material elegido ('' = el de siempre) y si los demás muebles del proyecto se suman al precio.
  const [mat, setMat] = useState('')
  const [sumMore, setSumMore] = useState(true)
  const [customer, setCustomer] = useState('')
  const [phone, setPhone] = useState('')
  const [desc, setDesc] = useState('')
  const [delivery, setDelivery] = useState('2 a 3 semanas')
  const [iva, setIva] = useState(false)
  const [quoteId, setQuoteId] = useState<string>()
  // Pestaña Bases: el mueble que se está armando y el que se pasó al cotizador (se guarda con la cotización).
  const [board, setBoard] = useState<BoardSpec>(DEFAULT_BOARD)
  // Cambia cuando la foto llena Bases, para que el panel tome las medidas nuevas.
  const [basesKey, setBasesKey] = useState(0)
  const [photoMsg, setPhotoMsg] = useState<string>()
  const [base, setBase] = useState<BaseState>(() => initialBase(cfg))
  const [baseSnap, setBaseSnap] = useState<BaseState>()
  // Pestaña Servicios: el servicio que se está calculando, el que se pasó al cotizador y las partidas juntas.
  const [serv, setServ] = useState<ServState>(() => { const s = SERVICES.find((x) => isOn(x.key, servConf)) ?? SERVICES[0]; return { key: s.key, values: serviceDefaults(s) } })
  const [servSnap, setServSnap] = useState<ServState>()
  const [parts, setParts] = useState<Part[]>([])
  const [partsSnap, setPartsSnap] = useState<Part[]>()
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  const [busy, setBusy] = useState(false)

  const customers = useLiveQuery(() => listContacts(business.id, 'customer'), [business.id]) ?? []
  const products = useLiveQuery(() => listProducts(business.id), [business.id]) ?? []
  const saved = useLiveQuery(async () => (await listQuotes(business.id)).filter((q) => q.quoter), [business.id]) ?? []
  const names = useLiveQuery(async () => new Map((await listContacts(business.id, 'customer')).map((c) => [c.id, c.name])), [business.id])
  const [today] = useState(() => dayKey(Date.now(), business.timezone))

  // El escritorio a la medida siempre está en la lista (salvo que el negocio ya tenga un trabajo propio con esa clave).
  const hasDesk = !(DESK_KEY in types)
  const isDesk = hasDesk && f.type === DESK_KEY
  const hasBoard = !(BOARD_KEY in types)
  const isBoard = hasBoard && f.type === BOARD_KEY
  const hasSimple = !(SIMPLE_KEY in types)
  const isSimple = hasSimple && f.type === SIMPLE_KEY
  const simpleSpec = { ancho: num(simple.ancho), alto: num(simple.alto), fondo: num(simple.fondo), tubos: Math.round(num(simple.tubos)), repisas: Math.round(num(simple.repisas)) }
  const deskSpec = { largo: num(desk.largo), fondo: num(desk.fondo), alto: num(desk.alto), cajones: Math.round(num(desk.cajones)) }
  // Librero y mueble de baño siempre están (por medidas); los demás, si el negocio tiene ese trabajo.
  const builtin = f.type in BUILTIN_MEASURED && !(f.type in types)
  const medKind = f.type in types || builtin ? MEASURED_KIND[f.type] : undefined
  const isMed = !!medKind && (byMed || builtin)
  const medSpec: CutSpec | undefined = medKind && toMedSpec(medKind, med)
  const form: QuoterForm = { ...(isBoard && { board }), type: f.type in types || isDesk || isSimple || isBoard || builtin ? f.type : Object.keys(types)[0], q: num(f.q), km: num(f.km), suave: f.suave, pint: f.pint, cub: f.cub, xmat: num(f.xmat), xhrs: num(f.xhrs), ...(mat && mats.some((m) => m.n === mat) && { mat }), ...(isDesk && { desk: deskSpec }), ...(isSimple && { simple: simpleSpec }), ...(isMed && { med: medSpec }), ...(f.type === 'otro' && baseSnap && { base: baseSnap }), ...(f.type === 'otro' && servSnap && { serv: servSnap }), ...(f.type === 'otro' && partsSnap && { parts: partsSnap }) }
  const cutSpecNow: CutSpec | undefined = isDesk ? { kind: 'escritorio', largo: deskSpec.largo, alto: deskSpec.alto, fondo: deskSpec.fondo, cajones: deskSpec.cajones, puertas: 0, entrepanos: 0, divisiones: 0, grosor: 15 } : isMed ? medSpec : undefined
  const type = jobOf(types, form, cfg) ?? Object.values(types)[0]
  const r = useMemo(() => calcQuote(cfg, types, form, mats, over), [cfg, types, mats, over, f, desk, simple, med, byMed, mat, board]) // eslint-disable-line react-hooks/exhaustive-deps
  // Los demás muebles del proyecto (se agregan en la pestaña Despiece) se cobran aparte, salvo que se pida no sumarlos.
  const moreSpecs = cutSpecNow ? (cutPrefs?.more ?? []) : []
  const project = useMemo(() => (sumMore ? projectExtras(cfg, types, form, moreSpecs, mats, over) : []), [cfg, types, mats, over, f, mat, sumMore, JSON.stringify(moreSpecs)]) // eslint-disable-line react-hooks/exhaustive-deps
  const price = r.priceCents + project.reduce((a, e) => a + e.result.priceCents, 0)
  const extras = { customer, description: desc, delivery, iva, ivaRate: IVA_RATE, project }
  const text = quoteMessage(business, costsFor(cfg, over, form.type), types, form, r, extras)
  const total = iva ? Math.round(price * (1 + IVA_RATE / 100)) : price
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
      setWithSketch(!!s.sketch)
      setMat(s.mat ?? '')
      setSumMore(s.sumMore !== false)
      setCutPrefs(s.cut ? { grosor: s.cut.spec.grosor, girar: s.cut.girar, more: s.cut.more } : undefined)
      if (s.med) setMed(medForm(s.med))
      setByMed(!!s.med || !(s.type in MEASURED_KIND))
      if (s.simple) setSimple(Object.fromEntries(Object.entries(s.simple).map(([k, v]) => [k, String(v)])) as Record<keyof typeof DEFAULT_SIMPLE, string>)
      if (s.board) setBoard(s.board)
      if (s.desk) setDesk({ largo: String(s.desk.largo), fondo: String(s.desk.fondo), alto: String(s.desk.alto), cajones: String(s.desk.cajones) })
      const c = await getContact(q.contactId)
      setCustomer(c?.name ?? '')
      setPhone(c?.phone ?? '')
      setDesc(s.desc)
      setDelivery(s.delivery)
      setIva(s.iva)
      setQuoteId(q.id)
      setMsg(undefined)
      setBaseSnap(s.base)
      if (s.base) setBase(s.base)
      setServSnap(s.serv)
      if (s.serv) setServ(s.serv)
      setPartsSnap(s.parts)
      setParts(s.parts ?? [])
      setTab(s.parts?.length || s.serv ? 'servicios' : s.base ? 'bases' : 'cotizar')
    })()
  }, [openId])

  function newQuote() {
    setF({ type: DEFAULT_FORM.type, q: '1', km: String(DEFAULT_FORM.km), suave: true, pint: false, cub: true, xmat: '0', xhrs: '0' })
    setCutPrefs(undefined)
    setWithSketch(false)
    setMat('')
    setSumMore(true)
    setByMed(true)
    setMed(medForm(DEFAULT_SPECS[MEASURED_KIND[DEFAULT_FORM.type] ?? 'bajo']))
    setCustomer('')
    setPhone('')
    setDesc('')
    setIva(false)
    setQuoteId(undefined)
    setMsg(undefined)
    setBaseSnap(undefined)
    setServSnap(undefined)
    setPartsSnap(undefined)
    setParts([])
    if (openId) setParams({}, { replace: true })
  }

  async function save() {
    setBusy(true)
    setMsg(undefined)
    try {
      const q = await saveQuoterQuote(business, form, { ...extras, phone, quoteId, cutPrefs, sketch: withSketch, sumMore })
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
        <button type="button" role="tab" aria-selected={tab === 'bases'} className={`tab-btn ${tab === 'bases' ? 'on' : ''}`} onClick={() => setTab('bases')}>Bases</button>
        <button type="button" role="tab" aria-selected={tab === 'servicios'} className={`tab-btn ${tab === 'servicios' ? 'on' : ''}`} onClick={() => setTab('servicios')}>Servicios{parts.length ? ` (${parts.length})` : ''}</button>
        <button type="button" role="tab" aria-selected={tab === 'despiece'} className={`tab-btn ${tab === 'despiece' ? 'on' : ''}`} onClick={() => setTab('despiece')}>Despiece</button>
        {canSeeCosts && <button type="button" role="tab" aria-selected={tab === 'costos'} className={`tab-btn ${tab === 'costos' ? 'on' : ''}`} onClick={() => setTab('costos')}>Mis costos</button>}
        <button type="button" role="tab" aria-selected={tab === 'guardadas'} className={`tab-btn ${tab === 'guardadas' ? 'on' : ''}`} onClick={() => setTab('guardadas')}>Guardadas ({saved.length})</button>
      </div>

      {(tab === 'cotizar' || tab === 'bases' || tab === 'servicios') && (
        <PhotoQuote business={business} products={products} baseOpts={base.opts} onIntent={(i: PhotoIntent) => {
          setPhotoMsg(undefined)
          if (i.kind === 'base') { setBase(i.state); setBasesKey((k) => k + 1); setTab('bases') }
          else if (i.kind === 'board') { setBoard(i.board); setF({ ...f, type: BOARD_KEY, q: String(i.q) }); setTab('cotizar') }
          else if (i.kind === 'cotizar') {
            setF({ ...f, type: i.type, q: String(i.q) })
            if (i.med) { setMed(medForm(i.med)); setByMed(true) }
            if (i.desk) setDesk({ largo: String(i.desk.largo), fondo: String(i.desk.fondo), alto: String(i.desk.alto), cajones: String(i.desk.cajones) })
            if (i.simple) setSimple(Object.fromEntries(Object.entries(i.simple).map(([k, v]) => [k, String(v)])) as Record<keyof typeof DEFAULT_SIMPLE, string>)
            setTab('cotizar')
          } else if (i.kind === 'serv') { setServ(i.serv); setBasesKey((k) => k + 1); setTab('servicios') }
          else setPhotoMsg(`${i.product.name}: ${money(i.product.priceCents)} cada uno${i.q > 1 ? ` × ${i.q} = ${money(i.product.priceCents * i.q)}` : ''}. Está en tu inventario; véndelo o cotízalo desde «+ Venta» o «Cotizaciones».`)
        }} />
      )}
      {photoMsg && <p className="note-box" role="status">{photoMsg}</p>}
      {tab === 'cotizar' && (
        <>
          <section className="card quoter-price" aria-live="polite">
            <small className="muted">{quoteId ? 'Cotización guardada · precio sugerido' : 'Precio sugerido'}</small>
            <strong className="quoter-big">{money(total)}</strong>
            <small className="muted">
              {iva ? `${money(price)} + IVA ${IVA_RATE} % · ` : ''}
              {project.length ? `${project.length + 1} muebles · ` : form.q > 0 ? `${money(Math.round(r.priceCents / form.q))} por ${unitName(type.u)} · ` : ''}{Math.round(r.hours + project.reduce((a, e) => a + e.result.hours, 0))} h de trabajo
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
              <select value={form.type} onChange={(e) => { const desk = (hasDesk && e.target.value === DESK_KEY) || (hasSimple && e.target.value === SIMPLE_KEY); const kind = desk ? undefined : MEASURED_KIND[e.target.value]; const t = desk || !(e.target.value in types) ? { u: 'piezas' } : types[e.target.value]; setF({ ...f, type: e.target.value, ...((desk || (kind && byMed)) && { q: '1' }) }); if (kind) setMed(medForm(DEFAULT_SPECS[kind])); setDelivery(t.u === 'm²' ? '1 semana' : t.u === 'piezas' ? '1 a 2 semanas' : '2 a 3 semanas') }}>
                {Object.entries(types).map(([k, t]) => <option key={k} value={k}>{t.n}</option>)}
                {hasDesk && <option value={DESK_KEY}>Escritorio a la medida</option>}
                {hasBoard && <option value={BOARD_KEY}>Tabla de picar</option>}
                {hasSimple && <option value={SIMPLE_KEY}>Closet sencillo abierto (con tubos)</option>}
                {Object.entries(BUILTIN_MEASURED).filter(([k]) => !(k in types)).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            {medKind && !builtin && (
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
            {isBoard && (
              <fieldset className="desk-box">
                <legend>Tabla de picar <small className="muted">(cm)</small></legend>
                <div className="chips wrap" role="group" aria-label="Madera">
                  {(Object.keys(BOARD_WOOD_LABEL) as BoardWood[]).map((w) => <button key={w} type="button" className={`chip ${board.madera === w ? 'on' : ''}`} aria-pressed={board.madera === w} onClick={() => setBoard({ ...board, madera: w })}>{BOARD_WOOD_LABEL[w]} <small>${w === 'parota' ? cfg.tablaParota : w === 'cedro' ? cfg.tablaCedro : cfg.tablaPino}/cm²</small></button>)}
                </div>
                <div className="two">
                  <label>Ancho<input value={board.ancho || ''} onChange={(e) => setBoard({ ...board, ancho: num(e.target.value) })} inputMode="decimal" /></label>
                  <label>Largo<input value={board.largo || ''} onChange={(e) => setBoard({ ...board, largo: num(e.target.value) })} inputMode="decimal" /></label>
                </div>
                <label className="check"><input type="checkbox" checked={board.redonda} onChange={(e) => setBoard({ ...board, redonda: e.target.checked })} /><span>Redonda (suma {cfg.tablaRedonda} %)</span></label>
                <label className="check"><input type="checkbox" checked={board.mango} onChange={(e) => setBoard({ ...board, mango: e.target.checked })} /><span>Con mango</span></label>
                {board.mango && <label>Largo del mango<input value={board.mangoLargo || ''} onChange={(e) => setBoard({ ...board, mangoLargo: num(e.target.value) })} inputMode="decimal" /></label>}
                <p className="note-box">{board.ancho} × {board.largo + (board.mango ? board.mangoLargo : 0)} cm = {Math.round(board.ancho * (board.largo + (board.mango ? board.mangoLargo : 0)))} cm² × ${board.madera === 'parota' ? cfg.tablaParota : board.madera === 'cedro' ? cfg.tablaCedro : cfg.tablaPino}{board.redonda ? ` + ${cfg.tablaRedonda} %` : ''} = <strong>{money(boardUnitCents(cfg, board))}</strong> cada una{r.wholesalePct ? <><br />Mayoreo ({form.q} piezas): −{r.wholesalePct} % → <strong>{money(r.perUnitCents)}</strong> cada una</> : null}</p>
                <small className="muted">Mayoreo: desde {cfg.may1Q} piezas −{cfg.may1Pct} %, desde {cfg.may2Q} −{cfg.may2Pct} %, desde {cfg.may3Q} −{cfg.may3Pct} %.</small>
                <small className="muted">Los precios por cm² y el % de las redondas se cambian en «Mis costos».</small>
              </fieldset>
            )}
            {isSimple && (
              <fieldset className="desk-box">
                <legend>Medidas del closet <small className="muted">(cm)</small></legend>
                <div className="three">
                  <label>Ancho<input value={simple.ancho} onChange={(e) => setSimple({ ...simple, ancho: e.target.value })} inputMode="decimal" /></label>
                  <label>Alto<input value={simple.alto} onChange={(e) => setSimple({ ...simple, alto: e.target.value })} inputMode="decimal" /></label>
                  <label>Fondo<input value={simple.fondo} onChange={(e) => setSimple({ ...simple, fondo: e.target.value })} inputMode="decimal" /></label>
                </div>
                <div className="two">
                  <label>Tubos para colgar<input value={simple.tubos} onChange={(e) => setSimple({ ...simple, tubos: e.target.value })} inputMode="numeric" /></label>
                  <label>Repisas<input value={simple.repisas} onChange={(e) => setSimple({ ...simple, repisas: e.target.value })} inputMode="numeric" /></label>
                </div>
                <small className="muted">Abierto, sin puertas: laterales, techo, base, zoclo, fondo de 3 mm y tubos con soportes. El despiece completo y el archivo para SketchCut están en la pestaña Bases.</small>
              </fieldset>
            )}
            {isSimple && simpleSpec.ancho > 0 && simpleSpec.alto > 0 && (
              <>
                <Sketch drawing={{ title: `Closet sencillo abierto ${simpleSummary(simpleSpec)}`, sketch: simpleClosetSketch(simpleSpec) }} />
                <label className="check"><input type="checkbox" checked={withSketch} onChange={(e) => setWithSketch(e.target.checked)} /><span>Incluir el boceto en la cotización (imagen y PDF)</span></label>
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
            {cutSpecNow && (
              <>
                <Sketch spec={cutSpecNow} />
                <label className="check"><input type="checkbox" checked={withSketch} onChange={(e) => setWithSketch(e.target.checked)} /><span>Incluir el boceto en la cotización (imagen y PDF)</span></label>
              </>
            )}
            <div className="two">
              <label>
                Cantidad <small className="muted">({type.u})</small>
                <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} inputMode="decimal" />
              </label>
              {!isBoard && <label>
                Distancia a la obra <small className="muted">(km, ida)</small>
                <input value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} inputMode="decimal" />
              </label>}
            </div>
            {!isBoard && <label className="check"><input type="checkbox" checked={f.suave} onChange={(e) => setF({ ...f, suave: e.target.checked })} /><span>Herrajes de cierre suave</span></label>}
            {mats.length > 0 && !isBoard && (
              <label>
                Material
                <select value={form.mat ?? ''} onChange={(e) => { setMat(e.target.value); if (/mdf/i.test(e.target.value) && !f.pint) setF({ ...f, pint: true }) }}>
                  <option value="">Melamina de siempre ({money(cfg.hoja * 100)} la hoja)</option>
                  {mats.map((m) => <option key={m.n} value={m.n}>{m.n} ({money(m.hoja * 100)} la hoja)</option>)}
                </select>
              </label>
            )}
            {moreSpecs.length > 0 && (
              <div className="desk-box">
                <strong>Proyecto de {moreSpecs.length + 1} muebles</strong>
                <label className="check"><input type="checkbox" checked={sumMore} onChange={(e) => setSumMore(e.target.checked)} /><span>Sumar al precio los demás muebles del proyecto</span></label>
                {sumMore && (
                  <ul className="fixed-paid">
                    <li className="row-between"><span>{type.n}</span><strong>{money(r.priceCents)}</strong></li>
                    {project.map((e, i) => <li key={i} className="row-between"><span>{e.name} <small className="muted">{e.summary.split(',')[0]}</small></span><strong>{money(e.result.priceCents)}</strong></li>)}
                  </ul>
                )}
                <small className="muted">Los demás muebles se agregan y se quitan en la pestaña «Despiece».</small>
              </div>
            )}
            {!type.pint && !isBoard && <label className="check"><input type="checkbox" checked={f.pint} onChange={(e) => setF({ ...f, pint: e.target.checked })} /><span>Acabado pintado (laca con pistola)</span></label>}
            {type.cub ? <label className="check"><input type="checkbox" checked={f.cub} onChange={(e) => setF({ ...f, cub: e.target.checked })} /><span>Incluye cubierta</span></label> : null}
            {!isBoard && <div className="two">
              <label>
                Material extra <small className="muted">($)</small>
                <input value={f.xmat} onChange={(e) => setF({ ...f, xmat: e.target.value })} inputMode="decimal" />
              </label>
              <label>
                Horas extra
                <input value={f.xhrs} onChange={(e) => setF({ ...f, xhrs: e.target.value })} inputMode="decimal" />
              </label>
            </div>}
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
            {canSeeCosts && !isBoard && (
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

      {tab === 'bases' && (
        <BasesPanel
          key={`${quoteId ?? 'nueva'}-${basesKey}`}
          business={business} cfg={cfg} km={num(f.km)} state={base} onChange={setBase} showCosts={canSeeCosts}
          onAdd={(s, br) => setParts([...parts, { id: crypto.randomUUID(), name: baseTitle(s), material: br.material, hours: br.hours, base: s }])}
          onPass={(s, br) => {
            setF({ ...f, type: 'otro', q: '1', xmat: String(br.material), xhrs: String(br.hours), pint: false, cub: false, suave: s.opts.suave })
            setDesc(baseTitle(s))
            setBaseSnap(s)
            setServSnap(undefined)
            setPartsSnap(undefined)
            setMsg({ ok: true, text: `Listo: ${baseTitle(s)} en el cotizador. Escribe el cliente y guárdala.` })
            setTab('cotizar')
          }}
        />
      )}

      {tab === 'servicios' && (
        <ServicesPanel
          key={basesKey}
          business={business} cfg={cfg} conf={servConf} km={num(f.km)} state={serv} onChange={setServ} showCosts={canSeeCosts}
          parts={parts} onAdd={(p) => setParts([...parts, p])} onRemove={(id) => setParts(parts.filter((p) => p.id !== id))} onClear={() => setParts([])}
          onGoCosts={canSeeCosts ? () => setTab('costos') : undefined}
          onPass={(s, sr) => {
            setF({ ...f, type: 'otro', q: '1', xmat: String(sr.material), xhrs: String(sr.hours), pint: false, cub: false })
            setDesc(serviceTitle(s))
            setServSnap(s)
            setBaseSnap(undefined)
            setPartsSnap(undefined)
            setMsg({ ok: true, text: `Listo: ${serviceTitle(s)} en el cotizador. Escribe el cliente y guárdala.` })
            setTab('cotizar')
          }}
          onPassParts={() => {
            const mat = parts.reduce((a, p) => a + p.material, 0)
            const hrs = parts.reduce((a, p) => a + p.hours, 0)
            setF({ ...f, type: 'otro', q: '1', xmat: String(mat), xhrs: String(hrs), pint: false, cub: false })
            setDesc(parts.map((p) => p.name).join('; '))
            setPartsSnap(parts)
            setBaseSnap(undefined)
            setServSnap(undefined)
            setMsg({ ok: true, text: `Listo: ${parts.length} partidas en el cotizador con un solo total.` })
            setTab('cotizar')
          }}
        />
      )}

      {tab === 'despiece' && (
        <>
          {quoteId && cutSpecNow && <p className="muted">Este despiece se guarda con la cotización de {customer || 'este cliente'}. Si cambias el grosor, la veta o alguna medida aquí, toca «Guardar despiece en la cotización».</p>}
          <CutListPanel
            business={business}
            initial={cutSpecNow ? { ...cutSpecNow, ...(cutPrefs && { grosor: cutPrefs.grosor }) } : undefined}
            initialMore={cutPrefs?.more}
            initialGirar={cutPrefs?.girar}
            onSpecs={(specs, girar) => { const next = { grosor: specs[0].grosor, girar, more: specs.slice(1) }; if (JSON.stringify(next) !== JSON.stringify(cutPrefs ?? { grosor: 15, girar: true, more: [] })) setCutPrefs(next) }}
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
  const [matList, setMatList] = useState<{ n: string; hoja: string }[]>(() => initial.mats.map((m) => ({ n: m.n, hoja: String(m.hoja) })))
  const [cfg, setCfg] = useState<Record<keyof QuoterConfig, string>>(() => Object.fromEntries(Object.entries(initial.cfg).map(([k, v]) => [k, String(v)])) as Record<keyof QuoterConfig, string>)
  const [types, setTypes] = useState<Record<string, JobType>>(() => structuredClone(initial.types))
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState(UNITS[0])
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  const [servConf, setServConf] = useState<ServConfig>(() => structuredClone(initial.serv))
  // Costos propios de cada trabajo: texto por campo; vacío = usa el general.
  const [own, setOwn] = useState<Record<string, Record<string, string>>>(() => Object.fromEntries(Object.entries(initial.over).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk, String(vv)]))])))
  const [ownJob, setOwnJob] = useState<string>(() => Object.keys(initial.types)[0] ?? DESK_KEY)

  const liveCfg = Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, num(v)])) as unknown as QuoterConfig
  const deskPreview = calcQuote(liveCfg, types, { type: DESK_KEY, q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, desk: DEFAULT_DESK })

  const tvPreview = calcQuote(liveCfg, types, { type: 'tv' in types ? 'tv' : Object.keys(types)[0], q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, med: DEFAULT_SPECS.tv })

  const kitchenSample: CutSpec = { ...DEFAULT_SPECS.bajo, largo: 250 }
  const kitchenPreview = calcQuote(liveCfg, types, { type: 'cocina_inf' in types ? 'cocina_inf' : Object.keys(types)[0], q: 1, km: 0, suave: true, pint: false, cub: true, xmat: 0, xhrs: 0, med: kitchenSample })

  const setField = (k: string, field: keyof JobType, v: string) => setTypes({ ...types, [k]: { ...types[k], [field]: num(v) } })

  async function save() {
    await saveQuoterSettings(business.id, Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, num(v)])) as unknown as QuoterConfig, types, matList.map((m) => ({ n: m.n, hoja: num(m.hoja) })), servConf, ownToOver(own))
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
          {(Object.keys(CONFIG_LABELS) as (keyof QuoterConfig)[]).filter((k) => !([...DESK_COST_KEYS, ...MEASURED_COST_KEYS, ...BASE_COST_KEYS, ...BOARD_COST_KEYS] as readonly string[]).includes(k)).map((k) => (
            <label key={k}>
              {CONFIG_LABELS[k]}
              <input value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} inputMode="decimal" />
            </label>
          ))}
        </div>
      </section>
      <JobCosts types={types} cfg={liveCfg} own={own} setOwn={setOwn} job={ownJob} setJob={setOwnJob} currency={business.currency} />
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
        <h2>Bases (despiece en milímetros)</h2>
        <p className="muted">Lo que usa la pestaña Bases. Son valores aproximados: cámbialos por tus precios reales. La hoja de melamina y el fondo, las bisagras, correderas, jaladeras, tubo, riel y cubierta salen de tus costos de arriba.</p>
        <label>
          Medida de la hoja
          <select value={`${cfg.hojaL}x${cfg.hojaA}`} onChange={(e) => { const [l, a] = e.target.value.split('x'); if (l && a) setCfg({ ...cfg, hojaL: l, hojaA: a }) }}>
            {SHEET_PRESETS.map(([l, a]) => <option key={`${l}x${a}`} value={`${l}x${a}`}>{l} × {a} mm</option>)}
            {!SHEET_PRESETS.some(([l, a]) => `${l}x${a}` === `${cfg.hojaL}x${cfg.hojaA}`) && <option value={`${cfg.hojaL}x${cfg.hojaA}`}>{cfg.hojaL} × {cfg.hojaA} mm (la tuya)</option>}
          </select>
        </label>
        <div className="two">
          {BASE_COST_KEYS.map((k) => (
            <label key={k}>
              {CONFIG_LABELS[k]}
              <input value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} inputMode="decimal" />
            </label>
          ))}
        </div>
      </section>
      <section className="card form">
        <h2>Tablas de picar</h2>
        <p className="muted">Precio directo: ancho × largo en cm² (con el mango si lleva) por el precio de la madera. Las redondas suman el %. Por mayoreo se descuenta el % del escalón más alto que alcance la cantidad.</p>
        <div className="two">
          {BOARD_COST_KEYS.map((k) => (
            <label key={k}>
              {CONFIG_LABELS[k]}
              <input value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })} inputMode="decimal" />
            </label>
          ))}
        </div>
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
      <section className="card form">
        <h2>Servicios</h2>
        <p className="muted">Enciende los trabajos de obra que sí haces; salen en la pestaña Servicios. Los precios vienen <strong>estimados: cámbialos por tu precio</strong>.</p>
        {SERVICES.map((s) => {
          const on = isOn(s.key, servConf)
          const prices = servicePrices(s, servConf)
          return (
            <div key={s.key} className="serv-conf">
              <label className="check">
                <input type="checkbox" checked={on} onChange={(e) => setServConf({ ...servConf, on: e.target.checked ? [...(servConf.on ?? []), s.key] : (servConf.on ?? []).filter((k) => k !== s.key) })} />
                <span><strong>{s.name}</strong> <small className="muted">· {s.desc}</small></span>
              </label>
              {on && (
                <div className="two">
                  {s.prices.map((p) => (
                    <label key={p.k}>
                      <span>{p.label} <small className="muted">(estimado)</small></span>
                      <input defaultValue={String(prices[p.k])} inputMode="decimal" onChange={(e) => setServConf({ ...servConf, p: { ...servConf.p, [s.key]: { ...servConf.p?.[s.key], [p.k]: num(e.target.value) } } })} />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </section>
      <section className="card form">
        <h2>Materiales</h2>
        <p className="muted">Si trabajas con otros tableros (melamina de color, MDF, triplay…), agrégalos con su precio por hoja. Al cotizar eliges el material y el precio se ajusta. El de siempre es la «hoja de melamina» de tus costos.</p>
        {matList.map((m, i) => (
          <div className="mat-row" key={i}>
            <label>Nombre<input value={m.n} onChange={(e) => setMatList(matList.map((x, k) => (k === i ? { ...x, n: e.target.value } : x)))} placeholder="Ej. Melamina nogal" /></label>
            <label>Hoja ($)<input value={m.hoja} onChange={(e) => setMatList(matList.map((x, k) => (k === i ? { ...x, hoja: e.target.value } : x)))} inputMode="decimal" /></label>
            <button type="button" className="btn ghost" aria-label={`Quitar ${m.n || 'material'}`} onClick={() => setMatList(matList.filter((_, k) => k !== i))}>Quitar</button>
          </div>
        ))}
        <button type="button" className="btn ghost" onClick={() => setMatList([...matList, { n: '', hoja: '' }])}>Agregar material</button>
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

/** Los costos propios escritos (texto) a números; los campos vacíos no cuentan. */
function ownToOver(own: Record<string, Record<string, string>>): JobOverrides {
  const out: JobOverrides = {}
  for (const [job, fields] of Object.entries(own)) {
    const vals = Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim() !== '' && Number.isFinite(num(v))).map(([k, v]) => [k, num(v)]))
    if (Object.keys(vals).length) out[job] = vals
  }
  return out
}

/** Qué costos tiene cada trabajo: los comunes más los de su forma de cotizar. */
function jobKeys(job: string, types: Record<string, JobType>): (keyof QuoterConfig)[] {
  if (job === BOARD_KEY && !(job in types)) return ['anticipo', ...BOARD_COST_KEYS]
  if (job === DESK_KEY && !(job in types)) return [...PER_JOB_KEYS, ...DESK_COST_KEYS]
  if (job === SIMPLE_KEY && !(job in types)) return ['margen', 'hoja', 'fondo', 'tuboML', 'hPieza', 'hInst', 'tcD', 'sop', 'deslz']
  if (job in MEASURED_KIND) return [...PER_JOB_KEYS, ...MEASURED_COST_KEYS]
  return [...PER_JOB_KEYS]
}

/** Un ejemplo para ver el precio con los costos propios: las medidas de siempre de ese trabajo. */
function sampleForm(job: string, types: Record<string, JobType>): QuoterForm {
  const base = { type: job, q: 1, km: 0, suave: true, pint: false, cub: true, xmat: 0, xhrs: 0 }
  if (job === BOARD_KEY && !(job in types)) return { ...base, board: DEFAULT_BOARD }
  if (job === DESK_KEY && !(job in types)) return { ...base, desk: DEFAULT_DESK }
  if (job === SIMPLE_KEY && !(job in types)) return { ...base, simple: DEFAULT_SIMPLE }
  if (job in MEASURED_KIND) return { ...base, med: DEFAULT_SPECS[MEASURED_KIND[job]] }
  return base
}

/** Costos por trabajo: cambiar los de un mueble sin mover los de los demás. */
function JobCosts({ types, cfg, own, setOwn, job, setJob, currency }: { types: Record<string, JobType>; cfg: QuoterConfig; own: Record<string, Record<string, string>>; setOwn: (o: Record<string, Record<string, string>>) => void; job: string; setJob: (j: string) => void; currency: string }) {
  const jobs: [string, string][] = [
    ...Object.entries(types).map(([k, t]) => [k, t.n] as [string, string]),
    ...(!(DESK_KEY in types) ? [[DESK_KEY, 'Escritorio a la medida'] as [string, string]] : []),
    ...Object.entries(BUILTIN_MEASURED).filter(([k]) => !(k in types)),
    ...(!(SIMPLE_KEY in types) ? [[SIMPLE_KEY, 'Closet sencillo abierto'] as [string, string]] : []),
    ...(!(BOARD_KEY in types) ? [[BOARD_KEY, 'Tabla de picar'] as [string, string]] : []),
  ]
  const fields = own[job] ?? {}
  const set = (k: string, v: string) => setOwn({ ...own, [job]: { ...fields, [k]: v } })
  const over = ownToOver(own)
  const sample = sampleForm(job, types)
  const general = calcQuote(cfg, types, sample)
  const mine = calcQuote(cfg, types, sample, [], over)
  const changed = Object.keys(over[job] ?? {}).length
  const money = (c: number) => formatMoney(c, currency)
  return (
    <section className="card form">
      <h2>Costos por trabajo</h2>
      <p className="muted">Si un mueble te sale caro o barato, cambia aquí sus costos sin mover los de los demás. Lo que dejes vacío usa tus costos generales (el número gris).</p>
      <label>
        Trabajo
        <select value={job} onChange={(e) => setJob(e.target.value)}>
          {jobs.map(([k, n]) => <option key={k} value={k}>{n}{Object.keys(over[k] ?? {}).length ? ' · con costos propios' : ''}</option>)}
        </select>
      </label>
      <div className="two">
        {jobKeys(job, types).map((k) => (
          <label key={k}>
            {CONFIG_LABELS[k]}
            <input value={fields[k] ?? ''} placeholder={String(cfg[k])} onChange={(e) => set(k, e.target.value)} inputMode="decimal" />
          </label>
        ))}
      </div>
      <p className="note-box" aria-live="polite">
        Ejemplo ({sample.desk ? deskSummary(sample.desk) : sample.simple ? simpleSummary(sample.simple) : sample.med ? medSummary(sample.med) : `1 ${unitName(types[job]?.u ?? 'pieza')}`}): con tus costos generales sale en {money(general.priceCents)}{changed ? <>; con los de este trabajo, <strong>{money(mine.priceCents)}</strong>.</> : '.'}
      </p>
      {changed > 0 && <button type="button" className="btn ghost" onClick={() => setOwn({ ...own, [job]: {} })}>Quitar los costos propios de este trabajo</button>}
    </section>
  )
}
