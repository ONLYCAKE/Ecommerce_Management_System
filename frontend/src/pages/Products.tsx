import { useEffect, useState, useMemo, FormEvent } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { formatINR } from '../utils/currency'
import { useConfirm } from '../context/ConfirmContext'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

interface Supplier { id: number; name: string }
interface Product { id: number; sku?: string; title: string; category?: string; description?: string; price: number; stock: number; supplierId?: number; supplier?: Supplier; hsnCode?: string }
interface ProductForm { sku: string; title: string; category: string; description: string; price: number | string; stock: number | string; supplierId: number | string; hsnCode: string }

export default function Products() {
  const [items, setItems] = useState<Product[]>([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortBy, setSortBy] = useState<keyof Product>('title')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [archived, setArchived] = useState(false)
  const [form, setForm] = useState<ProductForm>({ sku: '', title: '', category: '', description: '', price: 0, stock: 0, supplierId: '', hsnCode: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { user } = useAuth()
  const perms = user?.permissions || []

  const canCreate = user?.role === 'SuperAdmin' || perms.includes('product.create')
  const canUpdate = user?.role === 'SuperAdmin' || perms.includes('product.update')
  const canDelete = user?.role === 'SuperAdmin' || perms.includes('product.delete')

  const confirmModal = useConfirm()

  const fetchAll = async () => {
    const { data } = await api.get('/products', { params: { archived } })
    setItems(data)
  }
  useEffect(() => { fetchAll() }, [archived])

  useEffect(() => { (async () => { const s = await api.get('/suppliers'); setSuppliers(s.data) })() }, [])

  const filteredAndSorted = useMemo(() => {
    const filtered = items.filter(p => Object.values(p).join(' ').toLowerCase().includes(q.toLowerCase()))
    return filtered.sort((a, b) => {
      let valA: any = a[sortBy]
      let valB: any = b[sortBy]
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

  const handleSort = (column: keyof Product) => {
    if (sortBy === column) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(column); setSortOrder('asc') }
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.sku) errs.sku = 'SKU is required'
    if (!form.title) errs.title = 'Title is required'
    if (!form.category) errs.category = 'Category is required'
    if (!form.description) errs.description = 'Description is required'
    if (form.price === '' || isNaN(Number(form.price))) errs.price = 'Valid price is required'
    if (form.stock === '' || isNaN(Number(form.stock))) errs.stock = 'Valid stock is required'
    if (!form.supplierId) errs.supplierId = 'Supplier is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const open = (item: Product | null = null) => {
    setEditing(item)
    setErrors({})
    if (item) {
      // Editing existing product
      setForm({ sku: item.sku || '', title: item.title, category: item.category || '', description: item.description || '', price: item.price, stock: item.stock, supplierId: item.supplierId || '', hsnCode: item.hsnCode || '' })
    } else {
      // Adding new product - auto-generate SKU
      const generateNextSKU = () => {
        if (items.length === 0) return 'SKU-1001'

        // Extract all SKU numbers and find the maximum
        const skuNumbers = items
          .map(p => p.sku)
          .filter(sku => sku && sku.startsWith('SKU-'))
          .map(sku => {
            const match = sku!.match(/SKU-(\d+)/)
            return match ? parseInt(match[1], 10) : 0
          })
          .filter(num => !isNaN(num))

        const maxSKU = skuNumbers.length > 0 ? Math.max(...skuNumbers) : 1000
        return `SKU-${maxSKU + 1}`
      }

      setForm({ sku: generateNextSKU(), title: '', category: '', description: '', price: 0, stock: 0, supplierId: '', hsnCode: '' })
    }
    setShowForm(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const payload = { ...form, price: Number(form.price), stock: Number(form.stock), supplierId: Number(form.supplierId) }
    if (editing) await api.put(`/products/${editing.id}`, payload)
    else await api.post('/products', payload)
    setShowForm(false)
    fetchAll()
  }

  const archiveProduct = async (id: number) => {
    const ok = await confirmModal({ title: 'Archive product?', description: 'This will archive the product. You can restore it later from the archived view.' })
    if (!ok) return
    await api.delete(`/products/${id}`)
    fetchAll()
  }

  const deleteProduct = async (id: number) => {
    const ok = await confirmModal({ title: 'Permanently delete product?', description: 'This action cannot be undone. The product will be permanently removed from the database.' })
    if (!ok) return
    await api.delete(`/products/${id}/permanent`)
    fetchAll()
  }

  const restoreProduct = async (id: number) => {
    const ok = await confirmModal({ title: 'Restore product?', description: 'This will unarchive the product and make it active again.' })
    if (!ok) return
    await api.patch(`/products/${id}/restore`, {})
    fetchAll()
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              className="input pl-10 pr-4 py-2.5 w-80 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              placeholder="Search products by name, SKU, or category..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            <svg className="absolute left-3 top-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <label className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-all">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500 cursor-pointer" />
            <span className="text-sm font-medium text-gray-700">{archived ? '📦 Showing Archived' : 'Show Archived'}</span>
          </label>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Rows per page:</label>
            <select
              className="input px-3 py-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            >
              {[3, 5, 10, 20].map(n => (<option key={n} value={n}>{n}</option>))}
            </select>
          </div>

          {canCreate && (
            <button
              className="btn-primary px-5 py-2.5 font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              onClick={() => open(null)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Product
            </button>
          )}
        </div>
      </div>

      <div className="card p-6 shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort('sku')}>SKU {sortBy === 'sku' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort('title')}>Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">HSN/SAC</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort('price')}>Price {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort('stock')}>Stock {sortBy === 'stock' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
              <th className="pb-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-4">
                  <div className="text-sm font-mono text-blue-600 font-medium">{p.sku}</div>
                </td>
                <td className="py-4">
                  <div className="text-sm font-semibold text-gray-900">{p.title}</div>
                </td>
                <td className="py-4">
                  <div className="text-sm font-mono text-gray-600">{p.hsnCode || '-'}</div>
                </td>
                <td className="py-4">
                  <div className="text-sm text-gray-600">{p.category || '-'}</div>
                </td>
                <td className="py-4">
                  <div className="text-sm text-gray-600">{p.supplier?.name || '-'}</div>
                </td>
                <td className="py-4">
                  <div className="text-sm font-medium text-gray-900">{formatINR(p.price)}</div>
                </td>
                <td className="py-4">
                  <div className="text-sm font-medium text-gray-700">{p.stock}</div>
                </td>
                <td className="py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {!archived && canUpdate && (
                      <button className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors" onClick={() => open(p)}>Edit</button>
                    )}
                    {!archived && canDelete && (
                      <button className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors" onClick={() => deleteProduct(p.id)}>Delete</button>
                    )}
                    {!archived && canDelete && (
                      <button className="px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-md transition-colors" onClick={() => archiveProduct(p.id)}>Archive</button>
                    )}
                    {archived && canUpdate && (
                      <button className="px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors" onClick={() => restoreProduct(p.id)}>Restore</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredAndSorted.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-500 py-6">No products found.</td></tr>
            )}
          </tbody>
        </table>

        {filteredAndSorted.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition" disabled={page === 1} onClick={() => setPage(1)}><ChevronsLeft size={18} className="text-gray-700" /></button>
              <button className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={18} className="text-gray-700" /></button>
              <button className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight size={18} className="text-gray-700" /></button>
              <button className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition" disabled={page >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight size={18} className="text-gray-700" /></button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-700 text-white px-8 py-6 rounded-t-xl">
              <h3 className="text-2xl font-bold">
                {editing ? '✏️ Edit Product' : '➕ Add New Product'}
              </h3>
              <p className="text-orange-100 text-sm mt-1">
                {editing ? 'Update product information' : 'Fill in the details to create a new product'}
              </p>
            </div>

            <form onSubmit={save} className="p-8">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">SKU</label>
                  <input
                    className={`input mt-1 ${errors.sku ? 'border-red-500' : ''} ${!editing ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    value={form.sku}
                    onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    readOnly={!editing}
                    disabled={!editing}
                  />
                  {errors.sku && <div className="text-red-500 text-xs mt-1">{errors.sku}</div>}
                  {!editing && <div className="text-xs text-gray-500 mt-1">Auto-generated</div>}
                </div>
                <div>
                  <label className="text-sm text-gray-600">Title</label>
                  <input className={`input mt-1 ${errors.title ? 'border-red-500' : ''}`} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  {errors.title && <div className="text-red-500 text-xs mt-1">{errors.title}</div>}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600">Category</label>
                <input className={`input mt-1 ${errors.category ? 'border-red-500' : ''}`} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                {errors.category && <div className="text-red-500 text-xs mt-1">{errors.category}</div>}
              </div>
              <div>
                <label className="text-sm text-gray-600">Description</label>
                <textarea className={`input mt-1 ${errors.description ? 'border-red-500' : ''}`} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                {errors.description && <div className="text-red-500 text-xs mt-1">{errors.description}</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Price</label>
                  <input type="number" className={`input mt-1 ${errors.price ? 'border-red-500' : ''}`} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                  {errors.price && <div className="text-red-500 text-xs mt-1">{errors.price}</div>}
                </div>
                <div>
                  <label className="text-sm text-gray-600">Stock</label>
                  <input type="number" className={`input mt-1 ${errors.stock ? 'border-red-500' : ''}`} value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                  {errors.stock && <div className="text-red-500 text-xs mt-1">{errors.stock}</div>}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600">Supplier</label>
                <select className={`input mt-1 ${errors.supplierId ? 'border-red-500' : ''}`} value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
                {errors.supplierId && (<div className="text-red-500 text-xs mt-1">{errors.supplierId}</div>)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  HSN/SAC Code
                </label>
                <input
                  type="text"
                  className="input w-full border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all font-mono"
                  value={form.hsnCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, ''); // Only digits
                    if (value.length <= 8) {
                      setForm(f => ({ ...f, hsnCode: value }));
                    }
                  }}
                  placeholder="Enter 6 or 8 digit code"
                  maxLength={8}
                />
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <span>💡</span> Recommended: 8-digit Indian HSN format (e.g., 84212100)
                </p>
                {form.hsnCode && form.hsnCode.length !== 6 && form.hsnCode.length !== 8 && form.hsnCode.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <span>⚠️</span> HSN/SAC codes are typically 6 or 8 digits
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
