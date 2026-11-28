/** Contado / a crédito, con fecha límite opcional. Lo usan la venta (fiado) y el gasto (a crédito). */
export default function CreditFields(props: {
  credit: boolean
  onCredit: (v: boolean) => void
  due: string
  onDue: (v: string) => void
  creditLabel: string
  contactWord: string
}) {
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Forma de pago">
        <button type="button" role="tab" aria-selected={!props.credit} className={`tab-btn ${!props.credit ? 'on' : ''}`} onClick={() => props.onCredit(false)}>
          Contado
        </button>
        <button type="button" role="tab" aria-selected={props.credit} className={`tab-btn ${props.credit ? 'on' : ''}`} onClick={() => props.onCredit(true)}>
          {props.creditLabel}
        </button>
      </div>
      {props.credit && (
        <>
          <label>
            Fecha límite de pago (opcional)
            <input type="date" value={props.due} onChange={(e) => props.onDue(e.target.value)} />
          </label>
          <p className="muted">Elige abajo {props.contactWord} para llevar la cuenta. El dinero cuenta en el balance cuando se registre el pago.</p>
        </>
      )}
    </>
  )
}
