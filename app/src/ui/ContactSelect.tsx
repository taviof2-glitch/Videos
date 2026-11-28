import { useLiveQuery } from 'dexie-react-hooks'
import { listContacts } from '../data/contacts'
import type { ContactType } from '../data/types'
import { NEW_OPTION } from './forms'

const TEXT = {
  customer: { label: 'Cliente', none: 'Sin cliente', add: '+ Nuevo cliente…', name: 'Nombre del nuevo cliente' },
  supplier: { label: 'Proveedor', none: 'Sin proveedor', add: '+ Nuevo proveedor…', name: 'Nombre del nuevo proveedor' },
}

export default function ContactSelect(props: {
  businessId: string
  type: ContactType
  value: string
  onChange: (v: string) => void
  newName: string
  onNewName: (v: string) => void
}) {
  const t = TEXT[props.type]
  const contacts = useLiveQuery(() => listContacts(props.businessId, props.type), [props.businessId, props.type]) ?? []
  return (
    <>
      <label>
        {t.label}
        <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
          <option value="">{t.none}</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value={NEW_OPTION}>{t.add}</option>
        </select>
      </label>
      {props.value === NEW_OPTION && (
        <label>
          {t.name}
          <input value={props.newName} onChange={(e) => props.onNewName(e.target.value)} autoFocus />
        </label>
      )}
    </>
  )
}
