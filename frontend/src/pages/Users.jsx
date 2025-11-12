import { useEffect, useState } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { canCreate, canUpdate, canDelete } from '../utils/rbac'
import { useConfirm } from '../context/ConfirmContext'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export default function Users() {
  const [items, setItems] = useState([])
  const [filtered, setFiltered] = useState([])
  const [q, setQ] = useState('')
  const [archived, setArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [roles, setRoles] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    roleId: null,
  })
  const { user } = useAuth()
  const confirmModal = useConfirm()

  // ✅ Fetch users
  const fetchData = async () => {
    try {
      const { data } = await api.get('/users', { params: { archived } })
      setItems(data.items || [])
    } catch (err) {
      console.error('Error loading users', err)
      setItems([])
    }
  }

  useEffect(() => {
    fetchData()
  }, [archived])

  // ✅ Fetch roles
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

  // ✅ Search Filter
  useEffect(() => {
    const f = items.filter((u) =>
      [u.email, u.firstName, u.lastName, u.role?.name]
        .join(' ')
        .toLowerCase()
        .includes(q.toLowerCase())
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
    })
    setShowForm(true)
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      password: '',
      roleId: u.roleId || u.role?.id,
    })
    setShowForm(true)
  }

  const save = async (e) => {
    e.preventDefault()
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, form)
      } else {
        await api.post('/users', form)
      }
      setShowForm(false)
      fetchData()
    } catch (err) {
      console.error('Save failed', err)
    }
  }

  const archive = async (id) => {
    const ok = await confirmModal({
      title: 'Archive user?',
      description: 'This will archive the user.',
    })
    if (!ok) return
    await api.delete(`/users/${id}`)
    fetchData()
  }

  const restoreUser = async (id) => {
    const ok = await confirmModal({
      title: 'Restore user?',
      description: 'This will unarchive the user and make them active again.',
    })
    if (!ok) return
    await api.patch(`/users/${id}/restore`)
    fetchData()
  }

  return (
    <div className="space-y-4">
      <style>{`
        .btn-restore {
          background-color: #16a34a;
          color: white;
          font-weight: 500;
          border-radius: 8px;
          padding: 6px 16px;
          transition: all 0.2s ease;
        }
        .btn-restore:hover {
          background-color: #15803d;
        }
      `}</style>

      {/* ✅ Header */}
      <div className="flex justify-between items-center">
        <input
          className="input max-w-xs"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Rows</label>
          <select
            className="input w-20"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
          >
            {[3, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          {canCreate(user.role) && (
            <button className="btn-primary" onClick={openCreate}>
              Add User
            </button>
          )}
        </div>
      </div>

      {/* ✅ Table Card */}
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
            {currentPageData.map((u) => (
              <tr key={u.id} className="border-t">
                <td>{u.email}</td>
                <td>
                  {u.firstName} {u.lastName}
                </td>
                <td>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      u.role?.name === 'SuperAdmin'
                        ? 'bg-purple-200 text-purple-800'
                        : u.role?.name === 'Admin'
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-green-200 text-green-800'
                    }`}
                  >
                    {u.role?.name}
                  </span>
                </td>
                <td>
                  {u.isArchived ? (
                    <span className="text-red-600">Archived</span>
                  ) : (
                    'Active'
                  )}
                </td>
                <td className="text-center space-x-2">
                  {canUpdate(user.role, 'user.update') && !u.isArchived && (
                    <button className="btn-secondary" onClick={() => openEdit(u)}>
                      Edit
                    </button>
                  )}

                  {canDelete(user.role, 'user.delete') &&
                    (u.isArchived ? (
                      <button className="btn-restore" onClick={() => restoreUser(u.id)}>
                        Restore
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary text-white"
                        onClick={() => archive(u.id)}
                      >
                        Archive
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* No Data */}
        {currentPageData.length === 0 && (
          <div className="text-sm text-gray-500 py-6 text-center">No users found.</div>
        )}

        {/* ✅ Inline Pagination (Icon-Only) */}
        {filtered.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft size={18} className="text-gray-700" />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={18} className="text-gray-700" />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={18} className="text-gray-700" />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight size={18} className="text-gray-700" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Add/Edit User Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              {editing ? 'Edit User' : 'Add User'}
            </h3>

            <form onSubmit={save} className="space-y-4">
              {/* Email */}
              <div>
                <label className="text-sm text-gray-700">Email</label>
                <input
                  className="input w-full mt-1"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              {/* Password (only for add) */}
              {!editing && (
                <div>
                  <label className="text-sm text-gray-700">Password</label>
                  <input
                    className="input w-full mt-1"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </div>
              )}

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-700">First Name</label>
                  <input
                    className="input w-full mt-1"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Last Name</label>
                  <input
                    className="input w-full mt-1"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="text-sm text-gray-700">Role</label>
                <select
                  className="input w-full mt-1"
                  value={form.roleId ?? ''}
                  onChange={(e) => setForm({ ...form, roleId: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Select Role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editing ? 'Update User' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
