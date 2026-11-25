import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** El código que pone el catálogo en el mensaje de WhatsApp (ver data/orderCode.ts). */
const ORDER_CODE = /CP\d?\.[A-Za-z0-9_-]{6,}/

/**
 * Llega aquí lo que se comparte a Houselite desde otra app (WhatsApp → Compartir → Houselite), por el
 * `share_target` del manifiesto. Con código de catálogo arma el pedido solo; si es un mensaje escrito a mano,
 * abre un pedido nuevo con el mensaje en las notas para elegir los productos.
 */
export default function ShareIn() {
  const navigate = useNavigate()
  const { search } = useLocation()
  useEffect(() => {
    const p = new URLSearchParams(search)
    const text = [p.get('title'), p.get('text'), p.get('url')].filter((s) => s && s.trim()).join('\n').trim()
    if (!text) navigate('/pedidos', { replace: true })
    else if (ORDER_CODE.test(text)) navigate('/pedidos/pegar', { replace: true, state: { text } })
    else navigate('/pedidos/nuevo', { replace: true, state: { sharedText: text } })
  }, [search, navigate])
  return <p className="loading">Abriendo el pedido…</p>
}
