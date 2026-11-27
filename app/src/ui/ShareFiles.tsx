import { useState } from 'react'
import { canShareFiles, downloadBlob, shareFile } from './share'

export type SharedFile = { blob: Blob; filename: string }

/**
 * Compartir un documento como PDF o como imagen. Donde el navegador tiene el menú de compartir con archivos
 * (teléfonos), se abre con el archivo ya adjunto; donde no, se descarga para adjuntarlo después.
 */
export default function ShareFiles(props: { title: string; text: string; pdf: () => SharedFile | Promise<SharedFile>; image: () => Promise<SharedFile> }) {
  const native = canShareFiles()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()

  async function go(kind: 'pdf' | 'image') {
    setBusy(true)
    setMessage(undefined)
    try {
      const { blob, filename } = kind === 'pdf' ? await props.pdf() : await props.image()
      if (native) {
        await shareFile(new File([blob], filename, { type: kind === 'pdf' ? 'application/pdf' : 'image/png' }), props.title, props.text)
      } else if (await downloadBlob(blob, filename)) {
        setMessage({ ok: true, text: `Se guardó ${filename}. Adjúntalo en WhatsApp o en la app que uses.` })
      }
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudo preparar el archivo' })
    }
    setBusy(false)
  }

  const verb = native ? 'Compartir' : 'Descargar'
  return (
    <>
      <div className="quick" role="group" aria-label="Compartir como archivo">
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void go('pdf')}>{verb} PDF</button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void go('image')}>{verb} imagen</button>
      </div>
      {message && <p className={message.ok ? 'muted' : 'error'} role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
    </>
  )
}

/**
 * Botón principal «Enviar por WhatsApp»: manda la imagen del documento. En el teléfono abre el menú de compartir
 * con la imagen ya adjunta (ahí se elige WhatsApp); donde no se puede adjuntar, la descarga y abre WhatsApp con el texto.
 */
export function WhatsAppImage(props: { title: string; text: string; image: () => Promise<SharedFile>; waLink: string }) {
  const native = canShareFiles()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()

  async function send() {
    setBusy(true)
    setMessage(undefined)
    try {
      const { blob, filename } = await props.image()
      if (native) {
        await shareFile(new File([blob], filename, { type: 'image/png' }), props.title, props.text)
      } else {
        if (await downloadBlob(blob, filename)) setMessage({ ok: true, text: `Se guardó ${filename}: adjúntalo en el chat que se abrió.` })
        window.open(props.waLink, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudo preparar la imagen' })
    }
    setBusy(false)
  }

  return (
    <>
      <button type="button" className="btn sale" disabled={busy} onClick={() => void send()}>{busy ? 'Preparando imagen…' : 'Enviar por WhatsApp (imagen)'}</button>
      <a href={props.waLink} target="_blank" rel="noopener noreferrer" className="link-small">o enviar solo el texto</a>
      {message && <p className={message.ok ? 'muted' : 'error'} role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
    </>
  )
}
