import { useEffect, useState, FormEvent } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { canCreate, canUpdate, canDelete } from '../utils/permissions'
import { useConfirm } from '../context/ConfirmContext'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface Role { id: number; name: string }
interface UserForm {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roleId: number | null;
  addressLine1: string;
  addressLine2: string;
  area: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export default function Users() {
  const [items, setItems] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [q, setQ] = useState<string>('')
  const [archived, setArchived] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [roles, setRoles] = useState<Role[]>([])
  const [showForm, setShowForm] = useState<boolean>(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<UserForm>({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    roleId: null,
    addressLine1: '',
    addressLine2: '',
    area: '',
    city: '',
    state: '',
    country: '',
    postalCode: ''
  })
  const { user } = useAuth()
  const confirmModal = useConfirm()

  const fetchData = async () => {
    try {
      const { data } = await api.get('/users', { params: { archived } })
      setItems(data.items || [])
    } catch (err) {
      console.error('Error loading users', err)
      setItems([])
    }
  }

  useEffect(() => { fetchData() }, [archived])

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/roles')
        setRoles(data)
      } catch (err) {
        console.error('Error loading roles', err)
      }
    })()
  }, [])

  useEffect(() => {
    const f = items.filter((u: any) =>
      [u.email, u.firstName, u.lastName, u.role?.name].join(' ').toLowerCase().includes(q.toLowerCase())
    )
    setFiltered(f)
    setPage(1)
  }, [q, items])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const start = (page - 1) * pageSize
  const currentPageData = filtered.slice(start, start + pageSize)

  const openCreate = () => {
    const def = roles.find((r) => r.name === 'Employee') || roles[0]
    setEditing(null)
    setForm({
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      roleId: def?.id || null,
      addressLine1: '',
      addressLine2: '',
      area: '',
      city: '',
      state: '',
      country: '',
      postalCode: ''
    })
    setShowForm(true)
  }

  const openEdit = (u: any) => {
    setEditing(u)
    setForm({
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      password: '',
      roleId: u.roleId || u.role?.id,
      addressLine1: u.addressLine1 || '',
      addressLine2: u.addressLine2 || '',
      area: u.area || '',
      city: u.city || '',
      state: u.state || '',
      country: u.country || '',
      postalCode: u.postalCode || ''
    })
    setShowForm(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await api.put(`/users/${editing.id}` as string, form as any)
      } else {
        await api.post('/users', form as any)
      }
      setShowForm(false)
      fetchData()
    } catch (err) {
      console.error('Save failed', err)
    }
  }

  const archive = async (id: number) => {
    const ok = await confirmModal({ title: 'Archive user?', description: 'This will archive the user.' })
    if (!ok) return
    await api.delete(`/users/${id}`)
    fetchData()
  }

  const restoreUser = async (id: number) => {
    const ok = await confirmModal({ title: 'Restore user?', description: 'This will unarchive the user and make them active again.' })
    if (!ok) return
    await api.patch(`/users/${id}/restore`, {})
    fetchData()
  }

  const deleteUser = async (id: number) => {
    const ok = await confirmModal({ title: 'Delete user permanently?', description: 'This will permanently delete the user. This action cannot be undone.' })
    if (!ok) return
    try {
      await api.delete(`/users/${id}`)
      fetchData()
    } catch (err) {
      console.error('Delete failed', err)
    }
  }

  return (
    <div className="space-y-4">
      <style>{`
        .btn-restore { background-color: #16a34a; color: white; font-weight: 500; border-radius: 8px; padding: 6px 16px; transition: all 0.2s ease; }
        .btn-restore:hover { background-color: #15803d; }
      `}</style>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <input className="input max-w-xs" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />

          {/* Checkbox for Archived Users */}
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-all">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700">
              {archived ? '📦 Showing Archived' : 'Show Archived'}
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Rows</label>
          <select className="input w-20" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
            {[3, 5, 10, 20].map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>

          {canCreate('user') && (
            <button className="btn-primary" onClick={openCreate}>Add User</button>
          )}
        </div>
      </div>

      <div className="card p-4">
        <table className="table text-center">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentPageData.map((u: any) => (
              <tr key={u.id} className="border-t">
                <td>{u.email}</td>
                <td>{u.firstName} {u.lastName}</td>
                <td>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.role?.name === 'SuperAdmin' ? 'bg-purple-200 text-purple-800' : u.role?.name === 'Admin' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'}`}>
                    {u.role?.name}
                  </span>
                </td>
                <td>{u.isArchived ? (<span className="text-red-600">Archived</span>) : ('Active')}</td>
                <td className="text-center space-x-2">
                  {canUpdate('user') && !u.isArchived && (
                    <button className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors" onClick={() => openEdit(u)}>Edit</button>
                  )}

                  {canUpdate('user') && !u.isArchived && (
                    <button className="px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-md transition-colors" onClick={() => archive(u.id)}>Archive</button>
                  )}

                  {canDelete('user') && !u.isArchived && (
                    <button className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors" onClick={() => deleteUser(u.id)}>Delete</button>
                  )}

                  {canUpdate('user') && u.isArchived && (
                    <button className="px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors" onClick={() => restoreUser(u.id)}>Restore</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {currentPageData.length === 0 && (
          <div className="text-sm text-gray-500 py-6 text-center">No users found.</div>
        )}

        {filtered.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition" disabled={page === 1} onClick={() => setPage(1)}>
                <ChevronsLeft size={18} className="text-gray-700" />
              </button>
              <button className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={18} className="text-gray-700" />
              </button>
              <button className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <ChevronRight size={18} className="text-gray-700" />
              </button>
              <button className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRight size={18} className="text-gray-700" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-xl">
              <h3 className="text-2xl font-bold">
                {editing ? '✏️ Edit User' : '➕ Add New User'}
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                {editing ? 'Update user information' : 'Fill in the details to create a new user'}
              </p>
            </div>

            <form onSubmit={save} className="p-8">
              {/* Basic Information Section */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
                    <span>📋</span> Basic Information
                  </h4>
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>

                    {!editing && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          type="password"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          required
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.firstName}
                          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.lastName}
                          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                        value={form.roleId ?? ''}
                        onChange={(e) => setForm({ ...form, roleId: parseInt(e.target.value) })}
                        required
                      >
                        <option value="">Select Role</option>
                        {roles.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Address Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-purple-500 flex items-center gap-2">
                    <span>🏠</span> Address Details
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address Line 1
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.addressLine1}
                          onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                          placeholder="Street address"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address Line 2 <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.addressLine2}
                          onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                          placeholder="Apartment, suite, etc."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Area
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.area}
                          onChange={(e) => setForm({ ...form, area: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          City
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          State
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.state}
                          onChange={(e) => setForm({ ...form, state: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Country
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.country}
                          onChange={(e) => setForm({ ...form, country: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Postal Code
                      </label>
                      <input
                        className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                        value={form.postalCode}
                        onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t-2 border-gray-200 mt-8">
                <p className="text-sm text-gray-500 italic">
                  <span className="text-red-500">*</span> Required fields
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 flex items-center gap-2"
                    onClick={() => setShowForm(false)}
                  >
                    <span>✕</span> Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                  >
                    <span>💾</span> {editing ? 'Update User' : 'Save User'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
