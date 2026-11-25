import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, Route, Routes } from 'react-router-dom'
import { getCurrentBusiness } from './data/business'
import Layout from './ui/Layout'
import ContactForm from './pages/ContactForm'
import Contacts from './pages/Contacts'
import Home from './pages/Home'
import DebtDetail from './pages/DebtDetail'
import Debts from './pages/Debts'
import ExpenseForm from './pages/ExpenseForm'
import Inventory from './pages/Inventory'
import MovementDetail from './pages/MovementDetail'
import Movements from './pages/Movements'
import More from './pages/More'
import QuoteDetail from './pages/QuoteDetail'
import QuoteForm from './pages/QuoteForm'
import Quotes from './pages/Quotes'
import PaymentForm from './pages/PaymentForm'
import Receipt from './pages/Receipt'
import SaleForm from './pages/SaleForm'
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
        <Route path="balance" element={<Movements business={business} />} />
        <Route path="venta/nueva" element={<SaleForm business={business} />} />
        <Route path="venta/:id" element={<MovementDetail business={business} type="sale" />} />
        <Route path="venta/:id/editar" element={<SaleForm business={business} />} />
        <Route path="venta/:id/comprobante" element={<Receipt business={business} />} />
        <Route path="gasto/nuevo" element={<ExpenseForm business={business} />} />
        <Route path="gasto/:id" element={<MovementDetail business={business} type="expense" />} />
        <Route path="gasto/:id/editar" element={<ExpenseForm business={business} />} />
        <Route path="deudas" element={<Debts business={business} />} />
        <Route path="deudas/:contactId" element={<DebtDetail business={business} />} />
        <Route path="deudas/:contactId/abono" element={<PaymentForm business={business} />} />
        <Route path="inventario" element={<Inventory business={business} />} />
        <Route path="inventario/nuevo" element={<ProductForm business={business} />} />
        <Route path="inventario/:id" element={<ProductForm business={business} />} />
        <Route path="clientes" element={<Contacts business={business} type="customer" />} />
        <Route path="clientes/nuevo" element={<ContactForm business={business} type="customer" />} />
        <Route path="clientes/:id" element={<ContactForm business={business} type="customer" />} />
        <Route path="proveedores" element={<Contacts business={business} type="supplier" />} />
        <Route path="proveedores/nuevo" element={<ContactForm business={business} type="supplier" />} />
        <Route path="proveedores/:id" element={<ContactForm business={business} type="supplier" />} />
        <Route path="cotizaciones" element={<Quotes business={business} />} />
        <Route path="cotizaciones/nueva" element={<QuoteForm business={business} />} />
        <Route path="cotizaciones/:id" element={<QuoteDetail business={business} />} />
        <Route path="cotizaciones/:id/editar" element={<QuoteForm business={business} />} />
        <Route path="mas" element={<More business={business} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
