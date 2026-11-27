import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Sparkles, Square } from 'lucide-react'
import { businessContext, executeSale, planSale, saleSummary, type SaleAction, type SalePlan } from '../data/assistant'
import { dayKey } from '../data/dates'
import type { Business } from '../data/types'
import { askAssistant, type ChatMessage } from '../sync/assistant'
import { useActor } from './actor'
import { useDictation } from './dictation'
import { notifySale } from './jobNotify'
import SaleCard from './SaleCard'

const HINT = 'Ej. «Vendí un closet de 2 metros a Juan Pérez en 8,500, fiado, dejó 4,000 de anticipo»'

/** Dictar la venta (o escribirla) y que el asistente la prepare; se revisa y solo se guarda al confirmar. */
export default function VoiceSale({ business }: { business: Business }) {
  const navigate = useNavigate()
  const actor = useActor()
  const [text, setText] = useState('')
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ action: SaleAction; plan: SalePlan }>()
  const voice = useDictation(setText, (t) => void ask(t))

  async function ask(said: string) {
    const q = said.trim()
    if (!q || busy) return
    setBusy(true)
    setError('')
    setReply('')
    setPending(undefined)
    // La primera vez se le pide que registre una venta; si pregunta algo, la respuesta sigue la misma conversación.
    const next: ChatMessage[] = [...chat, { role: 'user', content: chat.length ? q : `Quiero registrar esta venta: ${q}` }]
    try {
      const context = await businessContext(business, dayKey(Date.now(), business.timezone))
      const answer = await askAssistant(next, context)
      if (answer.action && answer.action.type === 'venta') {
        const action = answer.action as SaleAction
        const plan = await planSale(business, action)
        setChat([...next, { role: 'assistant', content: `${answer.text}\n[Venta propuesta: ${saleSummary(action)}]` }])
        setPending({ action, plan })
      } else {
        setChat([...next, { role: 'assistant', content: answer.text }])
        setReply(answer.text)
      }
      setText('')
    } catch (e) {
      setText(q)
      setError(e instanceof Error ? e.message : 'El asistente no pudo preparar la venta.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setChat([]); setReply(''); setPending(undefined); setText(''); setError('') }

  return (
    <section className="card form voice-sale" aria-label="Dictar la venta">
      <h2><Sparkles className="i-inline" aria-hidden /> Dictar la venta</h2>
      {!pending && (
        <>
          <p className="muted">{chat.length ? 'Contesta lo que te preguntó:' : 'Dila como se la contarías a alguien; el asistente llena todo y tú confirmas.'}</p>
          {reply && <p className="bubble assistant">{reply}</p>}
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} readOnly={voice.listening} placeholder={voice.listening ? 'Te escucho… toca ■ al terminar' : HINT} aria-label="Venta dictada" maxLength={1500} />
          <div className="quick">
            <button type="button" className={`btn ${voice.listening ? 'expense mic-on' : 'primary'}`} disabled={busy} onClick={() => voice.toggle(text)} aria-pressed={voice.listening}>
              {voice.listening ? <><Square aria-hidden /> Terminar</> : <><Mic aria-hidden /> Dictar</>}
            </button>
            <button type="button" className="btn ghost" disabled={busy || voice.listening || !text.trim()} onClick={() => void ask(text)}>{busy ? 'Preparando…' : 'Preparar venta'}</button>
          </div>
          {chat.length > 0 && !busy && <button type="button" className="link" onClick={reset}>Empezar de nuevo</button>}
        </>
      )}
      {busy && <p className="muted">El asistente está preparando la venta…</p>}
      {pending && (
        <SaleCard plan={pending.plan} currency={business.currency} onCancel={reset}
          onConfirm={async () => {
            const sale = await executeSale(business, pending.action)
            void notifySale(business, sale.id, actor)
            navigate(`/venta/${sale.id}/comprobante`, { replace: true, state: { nueva: true } })
          }} />
      )}
      {(error || voice.error) && <p className="error" role="alert">{error || voice.error}</p>}
    </section>
  )
}
