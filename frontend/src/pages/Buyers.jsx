import { useEffect, useState, useMemo } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { canCreate, canUpdate, canDelete } from '../utils/permissions'
import { useConfirm } from '../context/ConfirmContext'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

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

  // 🔹 Fetch all buyers
  const fetchAll = async () => {
    const { data } = await api.get('/buyers')
    setItems(data)
  }
  useEffect(() => { fetchAll() }, [])

  // 🔹 Search + Filter Logic
  const filteredAndSorted = useMemo(() => {
    return items.filter(buyer =>
      Object.values(buyer)
        .join(' ')
        .toLowerCase()
        .includes(q.toLowerCase())
    )
  }, [items, q])

  // 🔹 Pagination
  const totalPages = Math.ceil(filteredAndSorted.length / pageSize) || 1
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredAndSorted.slice(start, start + pageSize)
  }, [filteredAndSorted, page, pageSize])

  // 🔹 Open modal for Add/Edit
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

  // 🔹 Validation
  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'

    if (!form.email) {
      errs.email = 'Email is required'
    } else if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(form.email)) {
      errs.email = 'Email must be valid and end with @gmail.com (lowercase only)'
    }

    if (!form.phone) {
      errs.phone = 'Phone number is required'
    } else if (!/^\d{10}$/.test(form.phone)) {
      errs.phone = 'Phone must be a 10-digit number'
    }

    if (!form.address.trim()) errs.address = 'Address is required'

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // 🔹 Save Buyer (Create/Update)
  const save = async (e) => {
    e.preventDefault()
    if (!validate()) return

    if (editing) await api.put(`/buyers/${editing.id}`, form)
    else await api.post('/buyers', form)

    setShowForm(false)
    fetchAll()
  }

  // 🔹 Delete Buyer
  const remove = async (id) => {
    const ok = await confirmModal({ title: 'Delete buyer?', description: 'This action cannot be undone.' })
    if (!ok) return
    await api.delete(`/buyers/${id}`)
    fetchAll()
  }

  // 🔹 Render
  return (
    <div className="space-y-4">
      {/* 🔍 Search + Add */}
      <div className="flex justify-between items-center">
        <input
          className="input max-w-xs"
          placeholder="Search buyers..."
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
            {[3, 5, 10, 20].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {canCreate('buyer') && (
            <button className="btn-primary" onClick={() => open()}>
              Add Buyer
            </button>
          )}
        </div>
      </div>

      {/* 📋 Buyers Table */}
      <div className="card p-4">
        <table className="table w-full">
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
            {paged.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="font-medium">{b.name}</td>
                <td>{b.email}</td>
                <td>{b.phone}</td>
                <td className="text-sm text-gray-600">{b.address}</td>
                <td className="text-right space-x-2">
                  {canUpdate('buyer') && (
                    <button className="btn-secondary" onClick={() => open(b)}>
                      Edit
                    </button>
                  )}
                  {canDelete('buyer') && (
                    <button className="btn-danger" onClick={() => remove(b.id)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center text-gray-500 py-6">
                  No buyers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ✅ Inline Pagination (Icon-Only) */}
        {filteredAndSorted.length > 0 && (
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
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={18} className="text-gray-700" />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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

      {/* 🧾 Buyer Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editing ? 'Edit Buyer' : 'Add Buyer'}
            </h3>

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
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
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
