import { FiLogOut } from 'react-icons/fi'
import { useAuth } from '../hooks/useAuth'

export default function Topbar({ email, role }){
  const { logout, user } = useAuth()
  const mustChange = user?.mustChangePassword
  return (
    <header className="shadow-sm" style={{backgroundColor:'rgba(255,255,255,0.06)'}}>
      <div className="max-w-full mx-auto px-6 py-3 flex items-center justify-between">
        <div className="text-sm">
          {mustChange ? <span className="badge">First login: please change password</span> : <span className="text-[var(--text)]">Welcome back</span>}
        </div>
        <div className="flex items-center gap-4 text-white">
          <div className="text-sm text-[var(--text)] text-right">
            <div className="font-heading font-medium">{email}</div>
            <div className="opacity-75">{role}</div>
          </div>
          <button onClick={logout} className="btn btn-primary flex items-center gap-2"><FiLogOut/> Logout</button>
        </div>
      </div>
    </header>
  )
}
