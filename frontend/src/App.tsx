import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar.tsx'
import Topbar from './components/Topbar.tsx'
import Footer from './components/Footer.tsx'
import Login from './pages/Login.tsx'
import ChangePassword from './pages/ChangePassword.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Users from './pages/Users.tsx'
import Roles from './pages/Roles.tsx'
import EditRole from './pages/EditRole.tsx'
import Permissions from './pages/Permissions.tsx'
import Suppliers from './pages/Suppliers.tsx'
import Buyers from './pages/Buyers.tsx'
import BuyerLedger from './pages/BuyerLedger.tsx'
import Products from './pages/Products.tsx'
import Orders from './pages/Orders.tsx'
import Invoices from './pages/Invoices.tsx'
import ProtectedRoute from './routes/ProtectedRoute.tsx'
import { useAuth } from './hooks/useAuth.ts'
import UserProfile from './pages/UserProfile.tsx'
import ProformaList from './pages/proformas/ProformaList.tsx'
import ProformaCreate from './pages/proformas/ProformaCreate.tsx'
import ProformaDetail from './pages/proformas/ProformaDetail.tsx'
import ProformaEdit from './pages/proformas/ProformaEdit.tsx'

// Dedicated Create/Edit Pages
import UserCreate from './pages/users/UserCreate.tsx'
import UserEdit from './pages/users/UserEdit.tsx'
import RoleCreate from './pages/roles/RoleCreate.tsx'
import RoleEdit from './pages/roles/RoleEdit.tsx'
import ProductCreate from './pages/products/ProductCreate.tsx'
import ProductEdit from './pages/products/ProductEdit.tsx'
import InvoiceCreate from './pages/invoices/InvoiceCreate.tsx'
import InvoiceEdit from './pages/invoices/InvoiceEdit.tsx'
import PaymentRecords from './pages/PaymentRecords.tsx'

function Shell() {
  const { user } = useAuth()
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar email={user?.email} role={user?.role as any} />
        <main className="p-6 space-y-6 bg-gray-50 flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/users/new" element={<UserCreate />} />
            <Route path="/users/:id/edit" element={<UserEdit />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/roles/new" element={<RoleCreate />} />
            <Route path="/roles/:id/edit" element={<RoleEdit />} />
            <Route path="/roles/:id/permissions" element={<EditRole />} />
            <Route path="/permissions" element={<Permissions />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/buyers" element={<Buyers />} />
            <Route path="/buyers/:buyerId" element={<BuyerLedger />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/new" element={<ProductCreate />} />
            <Route path="/products/:id/edit" element={<ProductEdit />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<InvoiceCreate />} />
            <Route path="/invoices/:invoiceNo/edit" element={<InvoiceEdit />} />
            <Route path="/proformas" element={<ProformaList />} />
            <Route path="/proformas/new" element={<ProformaCreate />} />
            <Route path="/proformas/:id" element={<ProformaDetail />} />
            <Route path="/proformas/:id/edit" element={<ProformaEdit />} />
            <Route path="/payments" element={<PaymentRecords />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      <Route path="/*" element={<ProtectedRoute><Shell /></ProtectedRoute>} />
    </Routes>
  )
}
