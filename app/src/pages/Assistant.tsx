import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, Sparkles } from 'lucide-react'
import { businessContext } from '../data/assistant'
import { dayKey } from '../data/dates'
import type { Business } from '../data/types'
import { askAssistant, type ChatMessage } from '../sync/assistant'
import { useSyncStatus } from '../sync/runner'

const IDEAS = ['¿Cómo va el mes comparado con el pasado?', '¿Qué tengo pendiente esta semana?', '¿A quién le cobro primero?', 'Escribe un mensaje para recordar un saldo pendiente']

// La conversación se queda mientras la app está abierta, aunque se cambie de pantalla.
const kept = new Map<string, ChatMessage[]>()

/** Asistente: preguntas sobre el negocio contestadas con los datos de la app. */
export default function Assistant({ business }: { business: Business }) {
  const st = useSyncStatus()
  const [messages, setMessages] = useState<ChatMessage[]>(() => kept.get(business.id) ?? [])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
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
      setMessages([...next, { role: 'assistant', content: answer }])
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
        {messages.length > 0 && !busy && <button type="button" className="link" onClick={() => setMessages([])}>Nueva conversación</button>}
      </div>
      {!st.session && (
        <Link to="/cuenta" className="alert">Entra a tu cuenta para usar el asistente<span>Entrar</span></Link>
      )}
      {messages.length === 0 && (
        <section className="card chat-intro">
          <Sparkles aria-hidden strokeWidth={1.75} />
          <p>Pregunta por tus ventas, obras, cobros y pagos del taller, o pide un mensaje para un cliente.</p>
          <div className="chips">
            {IDEAS.map((i) => <button key={i} type="button" className="chip" disabled={busy} onClick={() => void send(i)}>{i}</button>)}
          </div>
          <small className="muted">Para contestar se envía a Claude (Anthropic) un resumen de tu negocio: balance, saldos de clientes, obras, cotizaciones y pagos. No cambia nada en la app.</small>
        </section>
      )}
      <div className="chat-log" aria-live="polite">
        {messages.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.content}</div>)}
        {busy && <div className="bubble assistant muted">Pensando…</div>}
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
