import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { canCreate, canUpdate, canDelete } from '../utils/permissions'
import { useConfirm } from '../context/ConfirmContext'

export default function Roles() {
  const [roles, setRoles] = useState([])
  const [perms, setPerms] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ id: null, name: '', permissionIds: [] })
  const { user } = useAuth()
  const confirmModal = useConfirm()
  const navigate = useNavigate()
  const canManagePermissions = Array.isArray(user?.permissions) && user.permissions.includes('permission.permission')

  // Fetch roles + permissions
  const fetchAll = async () => {
    try {
      const [r, p] = await Promise.all([api.get('/roles'), api.get('/permissions')])
      setRoles(r.data)
      setPerms(p.data)
    } catch (err) {
      console.error('Error fetching roles or permissions', err)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  // Open Add/Edit form
  const open = (role) => {
    if (role)
      setForm({
        id: role.id,
        name: role.name,
        permissionIds: role.RolePermission?.map((rp) => rp.permissionId) || [],
      })
    else setForm({ id: null, name: '', permissionIds: [] })
    setShowForm(true)
  }

  // Save role (Add or Edit)
  const save = async (e) => {
    e.preventDefault()
    try {
      if (form.id)
        await api.put(`/roles/${form.id}`, { name: form.name, permissionIds: form.permissionIds })
      else
        await api.post('/roles', { name: form.name, permissionIds: form.permissionIds })

      setShowForm(false)
      fetchAll()
    } catch (err) {
      console.error('Error saving role', err)
    }
  }

  // Delete role
  const remove = async (id) => {
    const ok = await confirmModal({
      title: 'Delete role?',
      description: 'This action cannot be undone.',
    })
    if (!ok) return
    try {
      await api.delete(`/roles/${id}`)
      fetchAll()
    } catch (err) {
      console.error('Error deleting role', err)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Roles</h1>
        {canCreate('role') && (
          <button className="btn-primary" onClick={() => open(null)}>
            Add Role
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card p-4">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Permissions</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="font-medium">{r.name}</td>
                <td className="text-sm text-gray-600">
                  {r.RolePermission?.map((rp) => rp.permission?.key).join(', ') || '-'}
                </td>
                <td className="text-right space-x-2">
                  {(canUpdate('role') || canDelete('role')) && (
                    <>
                      <button
                        className="btn-secondary"
                        onClick={() => navigate(`/roles/${r.id}/edit`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => remove(r.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Role Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-xl p-6 rounded-2xl shadow-md animate-fadeIn">
            <h3 className="text-lg font-semibold mb-4">
              {form.id ? 'Edit Role' : 'Add Role'}
            </h3>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Name</label>
                <input
                  className="input mt-1"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Permissions</label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-64 overflow-auto">
                  {perms.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.permissionIds.includes(p.id)}
                        disabled={!canManagePermissions}
                        onChange={(e) => {
                          if (!canManagePermissions) return
                          setForm((f) => ({
                            ...f,
                            permissionIds: e.target.checked
                              ? [...f.permissionIds, p.id]
                              : f.permissionIds.filter((id) => id !== p.id),
                          }))
                        }}
                      />
                      {p.key}
                    </label>
                  ))}
                </div>
                {!canManagePermissions && (
                  <div className="text-xs text-gray-500 mt-2">You don't have permission to manage permissions. Viewing read-only.</div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button className="btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
