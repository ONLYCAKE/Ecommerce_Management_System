import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { FiGrid, FiUsers, FiUserCheck, FiShield, FiTruck, FiShoppingBag, FiPackage, FiFileText, FiDollarSign, FiChevronLeft } from 'react-icons/fi'
import { useAuth } from '../hooks/useAuth.ts'
import avatarDefault from '../assets/default-avatar.svg'

const navItems = [
  { to: '/', label: 'Dashboard', icon: <FiGrid /> },
  { to: '/users', label: 'Users', icon: <FiUsers /> },
  { to: '/roles', label: 'Roles', icon: <FiUserCheck /> },
  { to: '/permissions', label: 'Permissions', icon: <FiShield /> },
  { to: '/suppliers', label: 'Suppliers', icon: <FiTruck /> },
  { to: '/buyers', label: 'Buyers', icon: <FiShoppingBag /> },
  { to: '/products', label: 'Products', icon: <FiPackage /> },
  { to: '/invoices', label: 'Invoices', icon: <FiFileText /> },
  { to: '/payments', label: 'Payment Records', icon: <FiDollarSign /> },
  { to: '/orders', label: 'Orders', icon: <FiFileText /> },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  return (
    <aside className={`h-screen sticky top-0 ${collapsed ? 'w-16' : 'w-64'} transition-all flex flex-col`} style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between px-4 py-4">
        <div className={`flex items-center gap-3 ${collapsed ? 'opacity-0' : 'opacity-100'} transition-all`}>
          <img src="/logo.jpg" alt="Company Logo" className="h-10 w-10 rounded-lg object-contain bg-white p-1" />
          <div className="font-heading font-medium text-text">Uday Dairy</div>
        </div>
        <button onClick={() => setCollapsed(v => !v)} className="p-2 rounded-lg hover:bg-blue-100 hover:text-primary">
          <FiChevronLeft className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <nav className="px-2 space-y-1">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-[var(--primary)] text-white' : 'text-[var(--text)] hover:bg-blue-100 hover:text-[var(--primary)]'}`
          }>
            <span className="text-lg">{item.icon}</span>
            {!collapsed && <span className="font-heading text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-3 py-4">
        <button
          onClick={() => navigate('/profile')}
          className="group w-full flex items-center gap-3 rounded-xl p-2 bg-white/5 hover:bg-white/10 transition-colors"
          title={`${(user?.firstName || '') + (user?.lastName ? ' ' + user.lastName : '')}`.trim()}
        >
          <div className="relative">
            <img
              src="/logo.jpg"
              alt="Company Logo"
              className="h-10 w-10 rounded-full object-cover shadow-md ring-2 ring-white/20 transform transition-transform duration-200 group-hover:scale-105 bg-white p-1"
            />
            <span
              className={`absolute -right-2 -bottom-2 text-[10px] px-2 py-0.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${user?.role === 'SuperAdmin' ? 'bg-purple-600 text-white' :
                user?.role === 'Admin' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
                }`}
            >
              {user?.role || '—'}
            </span>
          </div>
          {!collapsed && (
            <div className="flex flex-col text-left">
              <span className="text-sm font-semibold text-[var(--text)]">
                {((user?.firstName || '') + (user?.lastName ? ' ' + user.lastName : '')).trim() || 'Profile'}
              </span>
              <span className="text-xs text-gray-500 truncate max-w-[150px]">{user?.email || ''}</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  )
}
