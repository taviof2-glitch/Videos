import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, Route, Routes } from 'react-router-dom'
import { getCurrentBusiness } from './data/business'
import Layout from './ui/Layout'
import Placeholder from './pages/Placeholder'
import Home from './pages/Home'
import Inventory from './pages/Inventory'
import ProductForm from './pages/ProductForm'
import Welcome from './pages/Welcome'

export default function App() {
  // undefined = cargando, null = no hay negocio todavía
  const business = useLiveQuery(async () => (await getCurrentBusiness()) ?? null, [])

  if (business === undefined) return <p className="loading">Cargando…</p>

  if (business === null) {
    return (
      <Routes>
        <Route path="/bienvenida" element={<Welcome />} />
        <Route path="*" element={<Navigate to="/bienvenida" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout businessName={business.name} />}>
        <Route index element={<Home business={business} />} />
        <Route path="balance" element={<Placeholder title="Balance" task="T5" />} />
        <Route path="deudas" element={<Placeholder title="Deudas" task="T6" />} />
        <Route path="inventario" element={<Inventory business={business} />} />
        <Route path="inventario/nuevo" element={<ProductForm business={business} />} />
        <Route path="inventario/:id" element={<ProductForm business={business} />} />
        <Route path="mas" element={<Placeholder title="Más" task="T1" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
