import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createContact, deleteContact, getContact, updateContact } from '../data/contacts'
import type { Business, Contact, ContactType } from '../data/types'
import { KINDS } from './contactKinds'
import { ChevronLeft } from 'lucide-react'

/** Crear (`/clientes/nuevo`) o editar (`/clientes/:id`) un contacto; igual para proveedores. */
export default function ContactForm({ business, type }: { business: Business; type: ContactType }) {
  const { id } = useParams()
  // undefined = cargando, null = no existe
  const contact = useLiveQuery(async () => (id ? ((await getContact(id)) ?? null) : null), [id])

  if (id && contact === undefined) return <p className="loading">Cargando…</p>
  if (id && !contact) {
    return (
      <section className="card">
        <h1>No encontrado</h1>
        <p className="muted">Puede que se haya borrado.</p>
        <Link to={KINDS[type].base} className="btn primary">Volver</Link>
      </section>
    )
  }
  return <Editor key={id ?? 'nuevo'} business={business} type={type} contact={contact ?? undefined} />
}

function Editor({ business, type, contact }: { business: Business; type: ContactType; contact?: Contact }) {
  const kind = KINDS[type]
  const navigate = useNavigate()
  const [name, setName] = useState(contact?.name ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [documentId, setDocumentId] = useState(contact?.documentId ?? '')
  const [notes, setNotes] = useState(contact?.notes ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const input = { name, phone, documentId, notes }
      if (contact) await updateContact(contact.id, input)
      else await createContact(business.id, type, input)
      navigate(kind.base)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  async function remove() {
    if (!contact) return
    try {
      await deleteContact(contact.id)
      navigate(kind.base, { replace: true })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo borrar')
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to={kind.base} className="back" aria-label={`Volver a ${kind.title.toLowerCase()}`}><ChevronLeft size={24} strokeWidth={2} aria-hidden /></Link>
        <h1 className="grow">{contact ? `Editar ${kind.one}` : `Nuevo ${kind.one}`}</h1>
      </section>

      <form onSubmit={submit} className="card form" noValidate>
        <label>
          Nombre *
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={!contact} />
        </label>
        <label>
          Teléfono
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Para WhatsApp (opcional)" />
        </label>
        <label>
          RFC u otro documento
          <input value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="Opcional" />
        </label>
        <label>
          Notas
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={type === 'customer' ? 'Ej. medidas de la cocina, dirección de entrega' : 'Ej. días de entrega, condiciones de pago'}
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : contact ? 'Guardar cambios' : `Guardar ${kind.one}`}
        </button>
      </form>

      {deleteError && <p className="error" role="alert">{deleteError}</p>}
      {contact &&
        (confirmDelete ? (
          <section className="card confirm">
            <p>¿Borrar a <strong>{contact.name}</strong>? Desaparece de la agenda; sus ventas y deudas se conservan.</p>
            <div className="quick">
              <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button type="button" className="btn expense" onClick={() => void remove()}>Sí, borrar</button>
            </div>
          </section>
        ) : (
          <button type="button" className="btn danger-text" onClick={() => setConfirmDelete(true)}>Borrar {kind.one}</button>
        ))}
    </>
  )
}
