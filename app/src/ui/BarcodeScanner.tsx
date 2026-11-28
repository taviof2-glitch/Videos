import { useEffect, useRef, useState } from 'react'

import { BarcodeDetectorApi } from './scanner'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']

export default function BarcodeScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!BarcodeDetectorApi) return
    let stream: MediaStream | undefined
    let timer: number | undefined
    let stopped = false
    const detector = new BarcodeDetectorApi({ formats: FORMATS })

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped || !video.current) return
        video.current.srcObject = stream
        await video.current.play()
        const tick = async () => {
          if (stopped || !video.current) return
          try {
            const [hit] = await detector.detect(video.current)
            if (hit?.rawValue) {
              onDetected(hit.rawValue)
              return
            }
          } catch {
            // fotograma sin imagen todavía; se reintenta
          }
          timer = window.setTimeout(tick, 250)
        }
        void tick()
      } catch {
        setError('No se pudo abrir la cámara. Revisa el permiso o escribe el código.')
      }
    }
    void start()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onDetected])

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
      <div className="sheet">
        <h2>Escanear código</h2>
        {error ? <p className="error">{error}</p> : <video ref={video} className="scanner" muted playsInline />}
        <p className="muted">Apunta la cámara al código de barras del producto.</p>
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}
