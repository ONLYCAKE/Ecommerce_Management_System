import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import Login from './pages/Login.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import Roles from './pages/Roles.jsx'
import EditRole from './pages/EditRole.jsx'
import Permissions from './pages/Permissions.jsx'
import Suppliers from './pages/Suppliers.jsx'
import Buyers from './pages/Buyers.jsx'
import Products from './pages/Products.jsx'
import Orders from './pages/Orders.jsx'
import Invoices from './pages/Invoices.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import { useAuth } from './hooks/useAuth.js'
import UserProfile from './pages/UserProfile.jsx'

function Shell() {
  const { user } = useAuth()
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar email={user?.email} role={user?.role} />
        <main className="p-6 space-y-6 bg-gray-50 flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/roles/:id/edit" element={<EditRole />} />
            <Route path="/permissions" element={<Permissions />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/buyers" element={<Buyers />} />
            <Route path="/products" element={<Products />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword/></ProtectedRoute>} />
      <Route path="/*" element={<ProtectedRoute><Shell/></ProtectedRoute>} />
    </Routes>
  )
}
