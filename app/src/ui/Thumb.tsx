import { useEffect, useRef } from 'react'

/** Muestra una foto guardada como Blob; la URL temporal se libera al desmontar o al cambiar la foto. */
export default function Thumb({ blob, alt, className = 'thumb' }: { blob?: Blob; alt: string; className?: string }) {
  const img = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (!blob || !img.current) return
    const url = URL.createObjectURL(blob)
    img.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return blob ? <img ref={img} alt={alt} className={className} /> : <div className={`${className} empty`} aria-hidden>📦</div>
}
