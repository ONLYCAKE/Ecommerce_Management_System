import { useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import avatarDefault from '../assets/default-avatar.svg'

export default function UserProfile() {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  })

  const fullName = useMemo(() => {
    const fn = user?.firstName || ''
    const ln = user?.lastName || ''
    const n = `${fn} ${ln}`.trim()
    return n || 'User'
  }, [user])

  const joinedOn = useMemo(() => {
    const created = (user as any)?.createdAt
    if (!created) return '—'
    try { return new Date(created).toLocaleDateString() } catch { return '—' }
  }, [user])

  const roleBadgeColor =
    user?.role === 'SuperAdmin' ? 'bg-purple-100 text-purple-700' :
    user?.role === 'Admin' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'

  const handleCopy = async () => {
    if (!user?.email) return
    try {
      await navigator.clipboard.writeText(user.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  return (
    <div className="p-6 md:p-10 bg-gray-50 min-h-[calc(100vh-64px)]">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Profile</h1>
            <p className="text-gray-500">View and edit your account details</p>
          </div>
          <button onClick={() => setIsEditing(true)} className="mt-4 md:mt-0 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm">Edit Profile</button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div>
              <img src={(user as any)?.photo || avatarDefault} alt="Profile" className="h-32 w-32 rounded-full border border-gray-300 object-cover shadow-sm" />
            </div>

            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-800">{fullName}</h2>
              <p className="text-gray-600 mt-1">{user?.email}</p>
              <span className={`inline-block mt-3 px-3 py-1 rounded-full text-sm font-medium ${roleBadgeColor}`}>{user?.role || 'Employee'}</span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-500">First Name</div>
                  <div className="font-medium text-gray-800 mt-1">{user?.firstName || '—'}</div>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-500">Last Name</div>
                  <div className="font-medium text-gray-800 mt-1">{user?.lastName || '—'}</div>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    Email
                    <button onClick={handleCopy} className="text-blue-600 hover:text-blue-800 text-xs font-medium">{copied ? 'Copied' : 'Copy'}</button>
                  </div>
                  <div className="font-medium text-gray-800 mt-1 break-all">{user?.email || '—'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-500">Joined On</div>
                  <div className="font-medium text-gray-800 mt-1">{joinedOn}</div>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="font-medium text-green-600 mt-1">Active</div>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-500">Role</div>
                  <div className="font-medium text-gray-800 mt-1">{user?.role || 'Employee'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-[90%] md:w-[420px] shadow-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Profile</h3>
              <div className="space-y-4">
                <input type="text" placeholder="First Name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
                <input type="text" placeholder="Last Name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
                <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700">Cancel</button>
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
