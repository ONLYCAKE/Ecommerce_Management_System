import { useEffect, useState, useMemo } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { formatINR } from '../utils/currency'
import { useConfirm } from '../context/ConfirmContext'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

export default function Products() {
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState('title')
  const [sortOrder, setSortOrder] = useState('asc')
  const [suppliers, setSuppliers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    sku: '',
    title: '',
    category: '',
    description: '',
    price: 0,
    stock: 0,
    supplierId: '',
  })
  const [errors, setErrors] = useState({})
  const { user } = useAuth()
  const perms = user?.permissions || []

  const canCreate = user?.role === 'SuperAdmin' || perms.includes('product.create')
  const canUpdate = user?.role === 'SuperAdmin' || perms.includes('product.update')
  const canDelete = user?.role === 'SuperAdmin' || perms.includes('product.delete')

  const confirmModal = useConfirm()

  // 🔹 Fetch data
  const fetchAll = async () => {
    const { data } = await api.get('/products')
    setItems(data)
  }

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    (async () => {
      const s = await api.get('/suppliers')
      setSuppliers(s.data)
    })()
  }, [])

  // 🔹 Filtering + Sorting
  const filteredAndSorted = useMemo(() => {
    const filtered = items.filter(p =>
      Object.values(p).join(' ').toLowerCase().includes(q.toLowerCase())
    )

    return filtered.sort((a, b) => {
      let valA = a[sortBy]
      let valB = b[sortBy]

      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [items, q, sortBy, sortOrder])

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredAndSorted.slice(start, start + pageSize)
  }, [filteredAndSorted, page, pageSize])

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize) || 1

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // 🔹 Validation
  const validate = () => {
    const errs = {}
    if (!form.sku) errs.sku = 'SKU is required'
    if (!form.title) errs.title = 'Title is required'
    if (!form.category) errs.category = 'Category is required'
    if (!form.description) errs.description = 'Description is required'
    if (!form.price || isNaN(form.price)) errs.price = 'Valid price is required'
    if (!form.stock || isNaN(form.stock)) errs.stock = 'Valid stock is required'
    if (!form.supplierId) errs.supplierId = 'Supplier is required'
    if (!form.buyerId) errs.buyerId = 'Buyer is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // 🔹 Modal logic
  const open = (item = null) => {
    setEditing(item)
    setErrors({})
    setForm(
      item
        ? {
            sku: item.sku || '',
            title: item.title,
            category: item.category || '',
            description: item.description || '',
            price: item.price,
            stock: item.stock,
            supplierId: item.supplierId || '',
          }
        : { sku: '', title: '', category: '', description: '', price: 0, stock: 0, supplierId: '' }
    )
    setShowForm(true)
  }

  const save = async e => {
    e.preventDefault()
    if (!validate()) return

    const payload = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
      supplierId: Number(form.supplierId),
    }

    if (editing) await api.put(`/products/${editing.id}`, payload)
    else await api.post('/products', payload)

    setShowForm(false)
    fetchAll()
  }

  const remove = async id => {
    const ok = await confirmModal({ title: 'Delete product?', description: 'This action cannot be undone.' })
    if (!ok) return
    await api.delete(`/products/${id}`)
    fetchAll()
  }

  // 🔹 Render
  return (
    <div className="space-y-4">
      {/* 🔍 Search + Add */}
      <div className="flex justify-between items-center">
        <input
          className="input max-w-xs"
          placeholder="Search across all fields..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Rows</label>
          <select
            className="input w-20"
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
          >
            {[3, 5, 10, 20].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {canCreate && <button className="btn-primary" onClick={() => open()}>Add Product</button>}
        </div>
      </div>

      {/* 📦 Product Table */}
      <div className="card p-4">
        <table className="table w-full">
          <thead>
            <tr>
              <th>SKU</th>
              <th
                className="cursor-pointer select-none"
                onClick={() => handleSort('title')}
              >
                Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Category</th>
              <th>Supplier</th>
              <th
                className="cursor-pointer select-none"
                onClick={() => handleSort('price')}
              >
                Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="cursor-pointer select-none"
                onClick={() => handleSort('stock')}
              >
                Stock {sortBy === 'stock' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {paged.map(p => (
              <tr key={p.id} className="border-t">
                <td className="font-mono text-sm">{p.sku}</td>
                <td className="font-medium">{p.title}</td>
                <td className="text-sm text-gray-600">{p.category || '-'}</td>
                <td className="text-sm text-gray-600">{p.supplier?.name || '-'}</td>
                <td>{formatINR(p.price)}</td>
                <td>{p.stock}</td>
                <td className="text-right space-x-2">
                  {canUpdate && (
                    <button className="btn-secondary" onClick={() => open(p)}>Edit</button>
                  )}
                  {canDelete && (
                    <button className="btn-danger" onClick={() => remove(p.id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}

            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center text-gray-500 py-6">
                  No products found.
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

      {/* 🧾 Product Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="card w-full max-w-xl p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editing ? 'Edit Product' : 'Add Product'}
            </h3>

            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">SKU</label>
                  <input
                    className={`input mt-1 ${errors.sku ? 'border-red-500' : ''}`}
                    value={form.sku}
                    onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  />
                  {errors.sku && <div className="text-red-500 text-xs mt-1">{errors.sku}</div>}
                </div>

                <div>
                  <label className="text-sm text-gray-600">Title</label>
                  <input
                    className={`input mt-1 ${errors.title ? 'border-red-500' : ''}`}
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                  {errors.title && <div className="text-red-500 text-xs mt-1">{errors.title}</div>}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">Category</label>
                <input
                  className={`input mt-1 ${errors.category ? 'border-red-500' : ''}`}
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                />
                {errors.category && <div className="text-red-500 text-xs mt-1">{errors.category}</div>}
              </div>

              <div>
                <label className="text-sm text-gray-600">Description</label>
                <textarea
                  className={`input mt-1 ${errors.description ? 'border-red-500' : ''}`}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
                {errors.description && <div className="text-red-500 text-xs mt-1">{errors.description}</div>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Price</label>
                  <input
                    type="number"
                    className={`input mt-1 ${errors.price ? 'border-red-500' : ''}`}
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  />
                  {errors.price && <div className="text-red-500 text-xs mt-1">{errors.price}</div>}
                </div>

                <div>
                  <label className="text-sm text-gray-600">Stock</label>
                  <input
                    type="number"
                    className={`input mt-1 ${errors.stock ? 'border-red-500' : ''}`}
                    value={form.stock}
                    onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  />
                  {errors.stock && <div className="text-red-500 text-xs mt-1">{errors.stock}</div>}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">Supplier</label>
                <select
                  className={`input mt-1 ${errors.supplierId ? 'border-red-500' : ''}`}
                  value={form.supplierId}
                  onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {errors.supplierId && (
                  <div className="text-red-500 text-xs mt-1">{errors.supplierId}</div>
                )}
              </div>

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
