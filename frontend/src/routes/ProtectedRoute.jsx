import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children }){
  const { token, user } = useAuth()
  const location = useLocation()
  if (!token || !user) return <Navigate to="/login" state={{ from: location }} replace />
  // Enforce first-time password change
  const mustChange = user?.mustChangePassword
  const onChangePage = location.pathname === '/change-password'
  if (mustChange && !onChangePage) {
    return <Navigate to="/change-password" replace />
  }
  if (!mustChange && onChangePage) {
    return <Navigate to="/" replace />
  }
  return children
}
