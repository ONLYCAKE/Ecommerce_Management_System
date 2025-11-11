import { useState } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

export default function ChangePassword(){
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const [loading, setLoading] = useState(false)
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      const updated = { ...user, mustChangePassword: false }
      login(localStorage.getItem('token'), updated)
      navigate('/')
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to update password')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="card p-6">
        <h1 className="text-lg font-semibold mb-4">Change Password</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-600">Current Password</label>
            <input type="password" className="input mt-1" value={currentPassword} onChange={e=>setCurrent(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-600">New Password</label>
            <input type="password" className="input mt-1" value={newPassword} onChange={e=>setNew(e.target.value)} />
          </div>
          <button className="btn" disabled={loading}>{loading? 'Saving...' : 'Save'}</button>
        </form>
      </div>
    </div>
  )
}
