import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import avatarDefault from '../assets/default-avatar.svg'

export default function UserProfile() {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

  const fullName = useMemo(() => {
    const fn = user?.firstName || ''
    const ln = user?.lastName || ''
    const n = `${fn} ${ln}`.trim()
    return n || 'User'
  }, [user])

  const roleBadge = useMemo(() => {
    const role = user?.role
    if (role === 'SuperAdmin') return 'bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/30'
    if (role === 'Admin') return 'bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/30'
    return 'bg-green-600/20 text-green-300 ring-1 ring-green-500/30'
  }, [user])

  const joinedOn = useMemo(() => {
    if (!user?.createdAt) return '—'
    try {
      return new Date(user.createdAt).toLocaleDateString()
    } catch {
      return '—'
    }
  }, [user])

  const status = 'Active'

  const copyEmail = async () => {
    if (!user?.email) return
    try {
      await navigator.clipboard.writeText(user.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  return (
    <div className="min-h-[calc(100vh-64px)] -m-6 p-8 bg-gradient-to-br from-gray-900 via-slate-800 to-blue-900">
      <div className="max-w-5xl mx-auto">
        {/* Profile Header Card */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/10 rounded-3xl shadow-2xl p-8 md:p-10 space-y-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            
            {/* Profile Photo */}
            <div className="relative">
              <img
                src={user?.photo || avatarDefault}
                alt="Profile"
                className="h-32 w-32 md:h-36 md:w-36 rounded-full object-cover shadow-2xl ring-4 ring-white/20"
              />
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold text-white tracking-tight">{fullName}</h1>
                  <p className="text-gray-300 mt-1">{user?.email || ''}</p>
                  <div className="mt-3 inline-flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${roleBadge}`}>
                      {user?.role || '—'}
                    </span>
                  </div>
                </div>

                {/* Edit Button */}
                <button
                  type="button"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md hover:shadow-blue-600/30 transition-all duration-200"
                >
                  Edit Profile
                </button>
              </div>

              {/* Details Row */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="backdrop-blur bg-white/10 border border-white/10 rounded-xl p-4 text-left">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">First Name</div>
                  <div className="text-sm font-semibold text-white mt-1">{user?.firstName || '—'}</div>
                </div>
                <div className="backdrop-blur bg-white/10 border border-white/10 rounded-xl p-4 text-left">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">Last Name</div>
                  <div className="text-sm font-semibold text-white mt-1">{user?.lastName || '—'}</div>
                </div>
                <div className="backdrop-blur bg-white/10 border border-white/10 rounded-xl p-4 text-left">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">Email</div>
                    <button
                      type="button"
                      className="text-[11px] px-2 py-0.5 rounded-md bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 transition-all duration-150"
                      onClick={copyEmail}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-white mt-1 break-all">{user?.email || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Meta Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 border border-white/10 rounded-2xl p-5 backdrop-blur">
              <div className="text-sm text-gray-300">Joined On</div>
              <div className="text-lg font-semibold text-white mt-1">{joinedOn}</div>
            </div>
            <div className="bg-white/10 border border-white/10 rounded-2xl p-5 backdrop-blur">
              <div className="text-sm text-gray-300">Status</div>
              <div className="text-lg font-semibold text-green-400 mt-1">{status}</div>
            </div>
            <div className="bg-white/10 border border-white/10 rounded-2xl p-5 backdrop-blur">
              <div className="text-sm text-gray-300">Role</div>
              <div className="text-lg font-semibold text-white mt-1">{user?.role || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
