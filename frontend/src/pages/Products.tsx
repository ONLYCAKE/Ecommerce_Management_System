import { useEffect, useState, useMemo, FormEvent } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { formatINR } from '../utils/currency'
import { useConfirm } from '../context/ConfirmContext'
import { Package, TrendingUp, AlertTriangle, Pencil, Trash2, Archive, RotateCcw, Save, ArrowLeft, Lightbulb, Plus, Box } from 'lucide-react'
import DataTable, { Column } from '../components/common/DataTable'
import SummaryCards, { SummaryCard } from '../components/common/SummaryCards'
import SearchAndFilterBar, { FilterCheckbox } from '../components/common/SearchAndFilterBar'
import TableActions, { ActionButton } from '../components/common/TableActions'
import { StockBadge } from '../components/common/StatusBadge'
import { useTableSort } from '../hooks/useTableFeatures'
import { useUrlPagination } from '../hooks/useUrlPagination'

interface Supplier { id: number; name: string }
interface Product { id: number; sku?: string; title: string; category?: string; description?: string; price: number; stock: number; supplierId?: number; supplier?: Supplier; hsnCode?: string; taxType?: string; taxRate?: number; isArchived?: boolean }
interface ProductForm { sku: string; title: string; category: string; description: string; price: number | string; stock: number | string; supplierId: number | string; hsnCode: string; taxType: string; taxRate: number }

export default function Products() {
  const [items, setItems] = useState<Product[]>([])
  const [q, setQ] = useState('')
  const { page, pageSize, setPage, setPageSize } = useUrlPagination(1, 10)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [archived, setArchived] = useState(false)
  const [form, setForm] = useState<ProductForm>({ sku: '', title: '', category: '', description: '', price: 0, stock: 0, supplierId: '', hsnCode: '', taxType: 'withTax', taxRate: 18 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { user } = useAuth()
  const perms = user?.permissions || []

  const canCreate = user?.role === 'SuperAdmin' || perms.includes('product.create')
  const canUpdate = user?.role === 'SuperAdmin' || perms.includes('product.update')
  const canDelete = user?.role === 'SuperAdmin' || perms.includes('product.delete')

  const confirmModal = useConfirm()

  const fetchAll = async () => {
    const { data } = await api.get('/products', { params: { archived } })
    setItems(Array.isArray(data) ? data : (data?.items || []))
  }
  useEffect(() => { fetchAll() }, [archived])

  useEffect(() => {
    (async () => {
      const s = await api.get('/suppliers')
      setSuppliers(Array.isArray(s.data) ? s.data : (s.data?.items || []))
    })()
  }, [])

  // Filter by search query
  const filtered = useMemo(() => {
    return items.filter(p => Object.values(p).join(' ').toLowerCase().includes(q.toLowerCase()))
  }, [items, q])

  // Apply sorting
  const { sortColumn, sortDirection, handleSort, sortedData } = useTableSort(filtered)

  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1
  const start = (page - 1) * pageSize
  const paged = sortedData.slice(start, start + pageSize)

  // Summary cards data
  const summaryCards: SummaryCard[] = useMemo(() => {
    const totalProducts = items.filter(p => !p.isArchived).length
    const totalStockQty = items.filter(p => !p.isArchived).reduce((sum, p) => sum + p.stock, 0)
    const outOfStock = items.filter(p => !p.isArchived && p.stock === 0).length

    return [
      {
        title: 'Total Products',
        value: totalProducts,
        icon: Package,
        color: 'blue'
      },
      {
        title: 'Products In Stock',
        value: totalStockQty,
        icon: Box,
        color: 'green',
        subtitle: 'Total units in inventory'
      },
      {
        title: 'Out of Stock',
        value: outOfStock,
        icon: AlertTriangle,
        color: 'red',
        subtitle: 'Products with 0 stock'
      }
    ]
  }, [items])

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
      setForm({ sku: item.sku || '', title: item.title, category: item.category || '', description: item.description || '', price: item.price, stock: item.stock, supplierId: item.supplierId || '', hsnCode: item.hsnCode || '', taxType: item.taxType || 'withTax', taxRate: item.taxRate !== undefined ? item.taxRate : 18 })
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

      setForm({ sku: generateNextSKU(), title: '', category: '', description: '', price: 0, stock: 0, supplierId: '', hsnCode: '', taxType: 'withTax', taxRate: 18 })
    }
    setShowForm(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const payload = { ...form, price: Number(form.price), stock: Number(form.stock), supplierId: Number(form.supplierId), taxRate: Number(form.taxRate) }
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

  // Define table columns
  const columns: Column[] = [
    {
      key: 'sku',
      label: 'SKU',
      sortable: true,
      align: 'left',
      render: (row: Product) => (
        <span className="font-mono text-sm text-blue-600 font-medium">{row.sku || 'N/A'}</span>
      )
    },
    {
      key: 'title',
      label: 'Product Name',
      sortable: true,
      align: 'left',
      render: (row: Product) => (
        <span className="font-semibold text-gray-900">{row.title}</span>
      )
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      align: 'left',
      render: (row: Product) => (
        <span className="text-gray-600">{row.category || '-'}</span>
      )
    },
    {
      key: 'supplier.name',
      label: 'Supplier',
      sortable: true,
      align: 'left',
      render: (row: Product) => (
        <span className="text-gray-600">{row.supplier?.name || '-'}</span>
      )
    },
    {
      key: 'price',
      label: 'Price',
      sortable: true,
      align: 'right',
      render: (row: Product) => (
        <span className="font-medium text-gray-900">{formatINR(row.price)}</span>
      )
    },
    {
      key: 'stock',
      label: 'Stock',
      sortable: true,
      align: 'right',
      render: (row: Product) => <StockBadge stock={row.stock} />
    },
    {
      key: 'hsnCode',
      label: 'HSN/SAC',
      sortable: false,
      align: 'center',
      render: (row: Product) => (
        <span className="font-mono text-xs text-gray-600">{row.hsnCode || '-'}</span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row: Product) => {
        const actions: ActionButton[] = [
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => open(row),
            color: 'blue',
            show: canUpdate && !archived
          },
          {
            label: 'Delete',
            icon: Trash2,
            onClick: () => deleteProduct(row.id),
            color: 'red',
            show: canDelete && !archived
          },
          {
            label: 'Archive',
            icon: Archive,
            onClick: () => archiveProduct(row.id),
            color: 'orange',
            show: canDelete && !archived
          },
          {
            label: 'Restore',
            icon: RotateCcw,
            onClick: () => restoreProduct(row.id),
            color: 'green',
            show: canUpdate && archived
          }
        ]
        return <TableActions actions={actions} />
      }
    }
  ]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Search and Filter Bar */}
      <SearchAndFilterBar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search by name, SKU, or category..."
        filters={
          <FilterCheckbox
            label={archived ? 'Showing Archived' : 'Show Archived'}
            checked={archived}
            onChange={setArchived}
            icon={archived && <Archive size={16} strokeWidth={1.8} />}
          />
        }
        actions={
          canCreate && (
            <button className="btn-primary flex items-center gap-2" onClick={() => open(null)}>
              <Plus size={18} strokeWidth={1.8} />
              Add Product
            </button>
          )
        }
      />

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={paged}
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyMessage={archived ? "No archived products found" : "No products found"}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-700 text-white px-8 py-6 rounded-t-xl">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                {editing ? (
                  <>
                    <Pencil size={20} strokeWidth={1.8} />
                    Edit Product
                  </>
                ) : (
                  <>
                    <Plus size={20} strokeWidth={1.8} />
                    Add New Product
                  </>
                )}
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
                  <Lightbulb size={14} strokeWidth={1.8} className="text-amber-500" />
                  Recommended: 8-digit Indian HSN format (e.g., 84212100)
                </p>
                {form.hsnCode && form.hsnCode.length !== 6 && form.hsnCode.length !== 8 && form.hsnCode.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle size={14} strokeWidth={1.8} />
                    HSN/SAC codes are typically 6 or 8 digits
                  </p>
                )}
              </div>

              {/* Tax Configuration */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Tax Configuration</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Tax Type *</label>
                    <select
                      className="input mt-1 w-full"
                      value={form.taxType}
                      onChange={(e) => setForm(f => ({
                        ...f,
                        taxType: e.target.value,
                        taxRate: e.target.value === 'withoutTax' ? 0 : 18
                      }))}
                    >
                      <option value="withTax">With Tax</option>
                      <option value="withoutTax">Without Tax</option>
                    </select>
                  </div>

                  {form.taxType === 'withTax' && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Tax Rate (%) *</label>
                      <select
                        className="input mt-1 w-full"
                        value={form.taxRate}
                        onChange={(e) => setForm(f => ({ ...f, taxRate: parseFloat(e.target.value) }))}
                      >
                        <option value={0}>0% - Exempted</option>
                        <option value={5}>5% - Reduced Rate</option>
                        <option value={12}>12% - Standard-1</option>
                        <option value={18}>18% - Standard-2 (GST)</option>
                        <option value={28}>28% - Luxury/Sin Goods</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => setShowForm(false)}>
                  <ArrowLeft size={18} strokeWidth={1.8} />
                  Cancel
                </button>
                <button className="btn-primary flex items-center gap-2">
                  <Save size={18} strokeWidth={1.8} />
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
