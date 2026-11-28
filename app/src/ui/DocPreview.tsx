import { useEffect, useState } from 'react'

/** Vista previa del documento con diseño: la misma imagen que se comparte. */
export default function DocPreview({ render, label, deps }: { render: () => Promise<Blob>; label: string; deps: unknown[] }) {
  const [url, setUrl] = useState<string>()
  const [failed, setFailed] = useState(false)
  // Las dependencias las pasa quien llama (el documento y el logo).
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true
    let made: string | undefined
    setFailed(false)
    render().then(
      (blob) => {
        if (!alive) return
        made = URL.createObjectURL(blob)
        setUrl(made)
      },
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, deps)
  if (failed) return null
  return (
    <figure className="doc-preview" aria-label={label}>
      {url ? <img src={url} alt={label} /> : <div className="doc-preview-wait" aria-hidden />}
    </figure>
  )
}
