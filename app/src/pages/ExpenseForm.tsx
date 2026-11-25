import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ensureCategory, listCategories } from '../data/categories'
import { parseMoney } from '../data/money'
import { createExpense, getTransaction, updateExpense } from '../data/transactions'
import type { Business, PaymentMethod, Transaction } from '../data/types'
import ContactSelect from '../ui/ContactSelect'
import CreditFields from '../ui/CreditFields'
import { METHODS, NEW_OPTION, fromLocalInput, resolveContactId, toLocalInput } from '../ui/forms'

/** S06: nuevo gasto (`/gasto/nuevo`) o edición (`/gasto/:id/editar`). */
export default function ExpenseForm({ business }: { business: Business }) {
  const { id } = useParams()
  // undefined = cargando, null = no existe
  const expense = useLiveQuery(async () => {
    if (!id) return undefined as Transaction | undefined
    const t = await getTransaction(id)
    return t && t.type === 'expense' ? t : null
  }, [id])
  const loading = id ? expense === undefined : false

  if (loading) return <p className="loading">Cargando…</p>
  if (id && !expense) {
    return (
      <section className="card">
        <h1>Gasto no encontrado</h1>
        <Link to="/balance" className="btn primary">Volver a movimientos</Link>
      </section>
    )
  }
  return <Editor key={id ?? 'nuevo'} business={business} expense={expense ?? undefined} />
}

function Editor({ business, expense }: { business: Business; expense?: Transaction }) {
  const navigate = useNavigate()
  const categories = useLiveQuery(() => listCategories(business.id, 'expense'), [business.id]) ?? []
  const [amount, setAmount] = useState(expense ? (expense.amountCents / 100).toFixed(2) : '')
  const [concept, setConcept] = useState(expense?.concept ?? '')
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '')
  const [newCategory, setNewCategory] = useState('')
  const [method, setMethod] = useState<PaymentMethod>(expense?.paymentMethod ?? 'cash')
  const [contactId, setContactId] = useState(expense?.contactId ?? '')
  const [newContact, setNewContact] = useState('')
  const [credit, setCredit] = useState(expense?.status === 'credit')
  const [due, setDue] = useState(expense?.dueDate ?? '')
  const [date, setDate] = useState(() => toLocalInput(expense?.date ?? new Date().toISOString()))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const cents = parseMoney(amount)
    if (!cents) return setError('Escribe el monto del gasto')
    const when = fromLocalInput(date)
    if (!when) return setError('La fecha no es válida')
    setSaving(true)
    try {
      let catId = categoryId
      if (categoryId === NEW_OPTION) catId = newCategory.trim() ? (await ensureCategory(business.id, 'expense', newCategory)).id : ''
      const supplier = await resolveContactId(business.id, 'supplier', contactId, newContact)
      const input = { amountCents: cents, concept, categoryId: catId, paymentMethod: method, date: when, contactId: supplier, credit, dueDate: credit ? due : undefined }
      const saved = expense ? await updateExpense(expense.id, input) : await createExpense(business.id, input)
      navigate(`/gasto/${saved.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to={expense ? `/gasto/${expense.id}` : '/balance'} className="back" aria-label="Volver">←</Link>
        <h1 className="grow">{expense ? 'Editar gasto' : 'Nuevo gasto'}</h1>
      </section>
      <form onSubmit={submit} className="card form" noValidate>
        <label>
          Monto *
          <input className="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus={!expense} />
        </label>
        <label>
          Concepto
          <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Madera de pino" />
        </label>
        <label>
          Categoría
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value={NEW_OPTION}>+ Nueva categoría…</option>
          </select>
        </label>
        {categoryId === NEW_OPTION && (
          <label>
            Nombre de la nueva categoría
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Ej. Materiales" autoFocus />
          </label>
        )}
        <CreditFields credit={credit} onCredit={setCredit} due={due} onDue={setDue} creditLabel="A crédito" contactWord="un proveedor" />
        {!credit && (
          <label>
            Método de pago
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
        )}
        <ContactSelect businessId={business.id} type="supplier" value={contactId} onChange={setContactId} newName={newContact} onNewName={setNewContact} />
        <label>
          Fecha y hora
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn expense" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : expense ? 'Guardar cambios' : credit ? 'Registrar a crédito' : 'Registrar gasto'}
        </button>
      </form>
    </>
  )
}
