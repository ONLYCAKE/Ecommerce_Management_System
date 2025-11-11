import { useEffect, useState } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { canCreate, canUpdate, canDelete } from '../utils/rbac'
import { useConfirm } from '../context/ConfirmContext'

export default function Buyers() {
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [errors, setErrors] = useState({})
  const { user } = useAuth()
  const confirmModal = useConfirm()

  const fetchAll = async () => {
    const { data } = await api.get('/buyers', { params: { q } })
    setItems(data)
  }
  useEffect(() => { fetchAll() }, [q])

  const open = (item = null) => {
    setEditing(item)
    setErrors({})
    setForm(
      item
        ? { name: item.name, email: item.email, phone: item.phone || '', address: item.address || '' }
        : { name: '', email: '', phone: '', address: '' }
    )
    setShowForm(true)
  }

  const validate = () => {
    const errs = {}

    if (!form.name.trim()) errs.name = 'Name is required'

    // Email validation: must contain lowercase, @, and gmail.com
    if (!form.email) {
      errs.email = 'Email is required'
    } else if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(form.email)) {
      errs.email = 'Email must be valid and end with @gmail.com (lowercase only)'
    }

    // Phone validation: 10-digit number only
    if (!form.phone) {
      errs.phone = 'Phone number is required'
    } else if (!/^\d{10}$/.test(form.phone)) {
      errs.phone = 'Phone must be a 10-digit number'
    }

    if (!form.address.trim()) errs.address = 'Address is required'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const save = async (e) => {
    e.preventDefault()
    if (!validate()) return

    if (editing) await api.put(`/buyers/${editing.id}`, form)
    else await api.post('/buyers', form)

    setShowForm(false)
    fetchAll()
  }

  const remove = async (id) => {
    const ok = await confirmModal({ title: 'Delete buyer?', description: 'This action cannot be undone.' })
    if (!ok) return
    await api.delete(`/buyers/${id}`)
    fetchAll()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <input
          className="input max-w-xs"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Rows</label>
          <select className="input w-20" value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1); }}>
            {[3,5,10,20].map(n => (<option key={n} value={n}>{n}</option>))}
          </select>
          {canCreate(user.role) && (
            <button className="btn-primary" onClick={() => open()}>
              Add Buyer
            </button>
          )}
        </div>
      </div>

      <div className="card p-4">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.slice((page-1)*pageSize, (page-1)*pageSize + pageSize).map((s) => (
              <tr key={s.id} className="border-t">
                <td className="font-medium">{s.name}</td>
                <td>{s.email}</td>
                <td>{s.phone}</td>
                <td className="text-sm text-gray-600">{s.address}</td>
                <td className="text-right space-x-2">
                  {canUpdate(user.role) && (
                    <button className="btn-secondary" onClick={() => open(s)}>
                      Edit
                    </button>
                  )}
                  {canDelete(user.role) && (
                    <button className="btn-danger" onClick={() => remove(s.id)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Page {page} of {Math.max(1, Math.ceil(items.length / pageSize))}</span>
              <button className="btn-secondary" disabled={page===1} onClick={()=>setPage(1)}>{'<<'}</button>
              <button className="btn-secondary" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>{'<'}</button>
              <button className="btn-secondary" disabled={page>=Math.ceil(items.length/pageSize)} onClick={()=>setPage(p=>Math.min(Math.ceil(items.length/pageSize)||1,p+1))}>{'>'}</button>
              <button className="btn-secondary" disabled={page>=Math.ceil(items.length/pageSize)} onClick={()=>setPage(Math.max(1,Math.ceil(items.length/pageSize)))}>{'>>'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4">{editing ? 'Edit Buyer' : 'Add Buyer'}</h3>
            <form onSubmit={save} className="space-y-3">
              {/* Name */}
              <div>
                <label className="text-sm text-gray-600">Name</label>
                <input
                  className={`input mt-1 ${errors.name ? 'border-red-500' : ''}`}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                {errors.name && <div className="text-red-500 text-xs mt-1">{errors.name}</div>}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm text-gray-600">Email</label>
                <input
                  className={`input mt-1 ${errors.email ? 'border-red-500' : ''}`}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                {errors.email && <div className="text-red-500 text-xs mt-1">{errors.email}</div>}
              </div>

              {/* Phone + Address */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Phone</label>
                  <input
                    className={`input mt-1 ${errors.phone ? 'border-red-500' : ''}`}
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                  {errors.phone && <div className="text-red-500 text-xs mt-1">{errors.phone}</div>}
                </div>
                <div>
                  <label className="text-sm text-gray-600">Address</label>
                  <input
                    className={`input mt-1 ${errors.address ? 'border-red-500' : ''}`}
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                  {errors.address && <div className="text-red-500 text-xs mt-1">{errors.address}</div>}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
