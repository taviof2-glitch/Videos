import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { getCurrentBusiness } from './data/business'
import { seedDefaultExpenseCategories } from './data/categories'
import { can, currentActor, type Permission } from './data/team'
import { ActorContext, useActor } from './ui/actor'
import Layout from './ui/Layout'
import ContactForm from './pages/ContactForm'
import BusinessProfile from './pages/BusinessProfile'
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
import PurchaseDetail from './pages/PurchaseDetail'
import PurchaseForm from './pages/PurchaseForm'
import Purchases from './pages/Purchases'
import Stats from './pages/Stats'
import Catalog from './pages/Catalog'
import OrderDetail from './pages/OrderDetail'
import OrderForm from './pages/OrderForm'
import OrderPaste from './pages/OrderPaste'
import Orders from './pages/Orders'
import PaymentForm from './pages/PaymentForm'
import Receipt from './pages/Receipt'
import SaleForm from './pages/SaleForm'
import ProductForm from './pages/ProductForm'
import Welcome from './pages/Welcome'
import Account from './pages/Account'
import Businesses from './pages/Businesses'
import Quoter from './pages/Quoter'
import Team from './pages/Team'
import UserGate from './pages/UserGate'

/** Deja pasar solo a quien tiene el permiso (o al dueño). Es una restricción de la pantalla, no de los datos: ver pages/Team.tsx. */
function Need({ perm, children }: { perm: Permission | 'owner'; children: ReactNode }) {
  const actor = useActor()
  const ok = perm === 'owner' ? actor.role === 'owner' : can(actor, perm)
  return ok ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  // undefined = cargando, null = no hay negocio todavía
  const business = useLiveQuery(async () => (await getCurrentBusiness()) ?? null, [])

  const actor = useLiveQuery(async () => (business ? await currentActor(business.id) : undefined), [business?.id])
  // Negocios que ya existían antes de que hubiera categorías de gasto de fábrica.
  const businessId = business?.id
  useEffect(() => {
    if (businessId) void seedDefaultExpenseCategories(businessId)
  }, [businessId])

  if (business === undefined) return <p className="loading">Cargando…</p>

  if (business === null) {
    return (
      <Routes>
        <Route path="/bienvenida" element={<Welcome />} />
        <Route path="/cuenta" element={<main className="welcome"><Account business={null} /></main>} />
        <Route path="*" element={<Navigate to="/bienvenida" replace />} />
      </Routes>
    )
  }

  if (actor === undefined) return <p className="loading">Cargando…</p>
  if (actor === null) return <UserGate business={business} />

  return (
    <ActorContext.Provider value={actor}>
    <Routes>
      <Route element={<Layout businessName={business.name} businessId={business.id} logo={business.logo} />}>
        <Route index element={<Home business={business} />} />
        <Route path="balance" element={<Need perm="balance"><Movements business={business} /></Need>} />
        <Route path="cuenta" element={<Need perm="owner"><Account business={business} /></Need>} />
        <Route path="venta/nueva" element={<SaleForm business={business} />} />
        <Route path="venta/:id" element={<MovementDetail business={business} type="sale" />} />
        <Route path="venta/:id/editar" element={<Need perm="void"><SaleForm business={business} /></Need>} />
        <Route path="venta/:id/comprobante" element={<Receipt business={business} />} />
        <Route path="gasto/nuevo" element={<Need perm="expenses"><ExpenseForm business={business} /></Need>} />
        <Route path="gasto/:id" element={<Need perm="expenses"><MovementDetail business={business} type="expense" /></Need>} />
        <Route path="gasto/:id/editar" element={<Need perm="void"><ExpenseForm business={business} /></Need>} />
        <Route path="deudas" element={<Debts business={business} />} />
        <Route path="deudas/:contactId" element={<DebtDetail business={business} />} />
        <Route path="deudas/:contactId/abono" element={<PaymentForm business={business} />} />
        <Route path="inventario" element={<Inventory business={business} />} />
        <Route path="inventario/nuevo" element={<Need perm="inventory"><ProductForm business={business} /></Need>} />
        <Route path="inventario/:id" element={<Need perm="inventory"><ProductForm business={business} /></Need>} />
        <Route path="clientes" element={<Contacts business={business} type="customer" />} />
        <Route path="clientes/nuevo" element={<ContactForm business={business} type="customer" />} />
        <Route path="clientes/:id" element={<ContactForm business={business} type="customer" />} />
        <Route path="proveedores" element={<Need perm="expenses"><Contacts business={business} type="supplier" /></Need>} />
        <Route path="proveedores/nuevo" element={<Need perm="expenses"><ContactForm business={business} type="supplier" /></Need>} />
        <Route path="proveedores/:id" element={<Need perm="expenses"><ContactForm business={business} type="supplier" /></Need>} />
        <Route path="cotizaciones" element={<Quotes business={business} />} />
        <Route path="cotizaciones/nueva" element={<QuoteForm business={business} />} />
        <Route path="cotizaciones/:id" element={<QuoteDetail business={business} />} />
        <Route path="cotizaciones/:id/editar" element={<QuoteForm business={business} />} />
        <Route path="negocio" element={<Need perm="owner"><BusinessProfile business={business} /></Need>} />
        <Route path="negocios" element={<Businesses business={business} />} />
        <Route path="cotizador" element={<Quoter business={business} />} />
        <Route path="compras" element={<Need perm="expenses"><Purchases business={business} /></Need>} />
        <Route path="compras/nueva" element={<Need perm="expenses"><PurchaseForm business={business} /></Need>} />
        <Route path="compras/:id" element={<Need perm="expenses"><PurchaseDetail business={business} /></Need>} />
        <Route path="estadisticas" element={<Need perm="balance"><Stats business={business} /></Need>} />
        <Route path="catalogo" element={<Need perm="owner"><Catalog business={business} /></Need>} />
        <Route path="pedidos" element={<Orders business={business} />} />
        <Route path="pedidos/nuevo" element={<OrderForm business={business} />} />
        <Route path="pedidos/pegar" element={<OrderPaste business={business} />} />
        <Route path="pedidos/:id" element={<OrderDetail business={business} />} />
        <Route path="pedidos/:id/editar" element={<OrderForm business={business} />} />
        <Route path="empleados" element={<Need perm="owner"><Team business={business} /></Need>} />
        <Route path="mas" element={<More business={business} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ActorContext.Provider>
  )
}
