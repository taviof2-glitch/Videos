import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Send, Sparkles } from 'lucide-react'
import { businessContext, executeSale, planSale, type SaleAction, type SalePlan } from '../data/assistant'
import { formatMoney } from '../data/money'
import { dayKey } from '../data/dates'
import type { Business } from '../data/types'
import { askAssistant, type ChatMessage } from '../sync/assistant'
import { useSyncStatus } from '../sync/runner'

const IDEAS = ['Agrega una venta de ', '¿Cómo va el mes comparado con el pasado?', '¿Qué tengo pendiente esta semana?', '¿A quién le cobro primero?', 'Escribe un mensaje para recordar un saldo pendiente']

// La conversación se queda mientras la app está abierta, aunque se cambie de pantalla.
const kept = new Map<string, ChatMessage[]>()

/** Asistente: preguntas sobre el negocio contestadas con los datos de la app. */
export default function Assistant({ business }: { business: Business }) {
  const st = useSyncStatus()
  const [messages, setMessages] = useState<ChatMessage[]>(() => kept.get(business.id) ?? [])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [pending, setPending] = useState<{ action: SaleAction; plan: SalePlan | string }>()
  const navigate = useNavigate()
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    kept.set(business.id, messages)
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy, business.id])

  async function send(question: string) {
    const q = question.trim()
    if (!q || busy) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setText('')
    setProblem('')
    setBusy(true)
    try {
      const context = await businessContext(business, dayKey(Date.now(), business.timezone))
      const answer = await askAssistant(next, context)
      if (answer.action) {
        // La venta propuesta queda como mensaje (para que el asistente sepa qué propuso) y como tarjeta para confirmar.
        const plan = await planSale(business, answer.action).catch((e: unknown) => (e instanceof Error ? e.message : 'No se pudo preparar la venta'))
        setMessages([...next, { role: 'assistant', content: `${answer.text}\n[Venta propuesta: ${saleSummary(answer.action)}]` }])
        setPending({ action: answer.action, plan })
      } else setMessages([...next, { role: 'assistant', content: answer.text }])
    } catch (e) {
      // La pregunta vuelve al cuadro para no tener que escribirla otra vez.
      setMessages(messages)
      setText(q)
      setProblem(e instanceof Error ? e.message : 'El asistente no pudo contestar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat">
      <div className="row-between">
        <h1>Asistente</h1>
        {messages.length > 0 && !busy && <button type="button" className="link" onClick={() => { setMessages([]); setPending(undefined) }}>Nueva conversación</button>}
      </div>
      {!st.session && (
        <Link to="/cuenta" className="alert">Entra a tu cuenta para usar el asistente<span>Entrar</span></Link>
      )}
      {messages.length === 0 && (
        <section className="card chat-intro">
          <Sparkles aria-hidden strokeWidth={1.75} />
          <p>Pregunta por tus ventas, obras, cobros y pagos del taller, o pide un mensaje para un cliente.</p>
          <div className="chips">
            {IDEAS.map((i) => <button key={i} type="button" className="chip" disabled={busy} onClick={() => (i.endsWith(' ') ? setText(i) : void send(i))}>{i}</button>)}
          </div>
          <small className="muted">Para contestar se envía a Claude (Anthropic) un resumen de tu negocio: balance, saldos de clientes, obras, cotizaciones y pagos. No cambia nada en la app.</small>
        </section>
      )}
      <div className="chat-log" aria-live="polite">
        {messages.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.content}</div>)}
        {busy && <div className="bubble assistant muted">Pensando…</div>}
        {pending && typeof pending.plan !== 'string' && (
          <SaleCard plan={pending.plan} currency={business.currency} onCancel={() => { setPending(undefined); setMessages((m) => [...m, { role: 'assistant', content: 'Listo, no registré la venta.' }]) }}
            onConfirm={async () => {
              const sale = await executeSale(business, pending.action)
              setPending(undefined)
              setMessages((m) => [...m, { role: 'assistant', content: `Venta registrada por ${formatMoney(sale.amountCents, business.currency)}.` }])
              navigate(`/venta/${sale.id}/comprobante`, { state: { nueva: true } })
            }} />
        )}
        {pending && typeof pending.plan === 'string' && <p className="error" role="alert">{pending.plan}</p>}
        <div ref={end} />
      </div>
      {problem && <p className="error" role="alert">{problem}</p>}
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); void send(text) }}>
        <textarea aria-label="Tu pregunta" rows={2} value={text} placeholder="Escribe tu pregunta" maxLength={2000} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn dark" disabled={busy || !text.trim()} aria-label="Enviar"><Send aria-hidden /></button>
      </form>
    </div>
  )
}

function saleSummary(a: SaleAction): string {
  return `${a.cliente || 'sin cliente'}; ${a.productos.map((p) => `${p.cantidad} × ${p.nombre}${p.medidas ? ` (${p.medidas})` : ''} a $${p.precio}`).join(', ')}; ${a.pago}${a.anticipo ? `, anticipo $${a.anticipo}` : ''}${a.encargo ? ', encargo' : ''}`
}

/** La venta que preparó el asistente: se revisa y solo se guarda al confirmar. */
function SaleCard({ plan, currency, onConfirm, onCancel }: { plan: SalePlan; currency: string; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const money = (c: number) => formatMoney(c, currency)
  return (
    <section className="card form sale-card" aria-label="Venta por confirmar">
      <h2>Venta por confirmar</h2>
      <p><strong>Cliente:</strong> {plan.contact ? plan.contact.name : plan.newContact ? <>{plan.newContact} <span className="badge muted">nuevo</span></> : 'Sin cliente'}</p>
      <ul className="fixed-paid">
        {plan.lines.map((l, i) => (
          <li key={i}>
            {l.quantity} × {l.product ? l.product.name : l.newProduct!.name} {!l.product && <span className="badge muted">producto nuevo, sobre pedido</span>}
            {l.newProduct?.description && <small className="muted"> · {l.newProduct.description}</small>} — {money(Math.round(l.quantity * l.priceCents))}
          </li>
        ))}
      </ul>
      <p className="total-line">Total <strong>{money(plan.totalCents)}</strong></p>
      <p className="muted">{plan.credit ? `Fiado${plan.advanceCents ? `, con anticipo de ${money(plan.advanceCents)}` : ''}` : 'De contado'}{plan.asJob ? ' · se sigue en Obras' : ''}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn primary" disabled={busy} onClick={() => { setBusy(true); setError(''); void onConfirm().catch((e: unknown) => { setError(e instanceof Error ? e.message : 'No se pudo registrar'); setBusy(false) }) }}>{busy ? 'Guardando…' : 'Confirmar venta'}</button>
      </div>
    </section>
  )
}
