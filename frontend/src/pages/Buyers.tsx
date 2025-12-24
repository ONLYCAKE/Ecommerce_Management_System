import { useEffect, useState, useMemo, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { canCreate, canUpdate, canDelete, canRead } from '../utils/permissions'
import { useConfirm } from '../context/ConfirmContext'
import { Pencil, Trash2, Archive, RotateCcw, Save, ArrowLeft, Plus, ShoppingCart, MapPin, TrendingUp, CreditCard, FileText, Phone, Home, AlertTriangle } from 'lucide-react'
import CountryStateCitySelect from '../components/common/CountryStateCitySelect'
import DataTable, { Column } from '../components/common/DataTable'
import SummaryCards, { SummaryCard } from '../components/common/SummaryCards'
import SearchAndFilterBar, { FilterCheckbox } from '../components/common/SearchAndFilterBar'
import TableActions, { ActionButton } from '../components/common/TableActions'
import StatusBadge from '../components/common/StatusBadge'
import { useTableSort, useTablePagination } from '../hooks/useTableFeatures'

interface Buyer {
  id: number
  name: string
  email: string
  phone: string
  gstin?: string
  address: string
  addressLine1?: string
  city?: string
  state?: string
  createdAt?: string
  isArchived?: boolean
}

export default function Buyers() {
  const [items, setItems] = useState<Buyer[]>([])
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Buyer | null>(null)
  const [archived, setArchived] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    gstin: '',
    addressLine1: '',
    addressLine2: '',
    area: '',
    city: '',
    state: '',
    country: '',
    postalCode: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)
  const { user } = useAuth()
  const confirmModal = useConfirm()
  const navigate = useNavigate()

  if (!canRead('buyer')) {
    return (
      <div className="p-6 text-center text-gray-500">
        You do not have permission to view buyers.
      </div>
    )
  }

  const fetchAll = async () => {
    try {
      const { data } = await api.get('/buyers', { params: { archived } })
      setItems(Array.isArray(data) ? data : (data?.items || []))
    } catch (err) {
      console.error('Error loading buyers', err)
      setItems([])
    }
  }

  useEffect(() => { fetchAll() }, [archived])

  // Filter by search
  const filtered = useMemo(() => {
    return (items || []).filter((b) =>
      [b.name, b.email, b.phone, b.gstin, b.address, (b as any).city, (b as any).state]
        .join(' ')
        .toLowerCase()
        .includes(q.toLowerCase())
    )
  }, [q, items])

  // Apply sorting
  const { sortColumn, sortDirection, handleSort, sortedData } = useTableSort(filtered)

  // Pagination
  const { currentPage, pageSize, paginatedData, setPage, setPageSize } = useTablePagination(sortedData, 10)

  // Summary cards
  const summaryCards: SummaryCard[] = useMemo(() => {
    const totalBuyers = items.filter(b => !(b as any).isArchived).length
    const gstRegistered = items.filter(b => b.gstin && !(b as any).isArchived).length
    const archivedCount = items.filter(b => (b as any).isArchived).length

    return [
      {
        title: 'Total Buyers',
        value: totalBuyers,
        icon: ShoppingCart,
        color: 'teal',
        subtitle: `${items.length} including archived`
      },
      {
        title: 'Active Buyers',
        value: totalBuyers,
        icon: TrendingUp,
        color: 'blue'
      },
      {
        title: 'GST Registered',
        value: gstRegistered,
        icon: CreditCard,
        color: 'indigo',
        subtitle: 'With valid GSTIN'
      },
      {
        title: 'Total Locations',
        value: new Set(items.map(b => (b as any).city).filter(Boolean)).size,
        icon: MapPin,
        color: 'purple',
        subtitle: 'Unique cities'
      }
    ]
  }, [items])

  const open = (item: Buyer | null = null) => {
    setEditing(item)
    setErrors({})
    setForm(
      item
        ? {
          name: item.name,
          email: item.email,
          phone: item.phone || '',
          gstin: item.gstin || '',
          addressLine1: (item as any).addressLine1 || '',
          addressLine2: (item as any).addressLine2 || '',
          area: (item as any).area || '',
          city: (item as any).city || '',
          state: (item as any).state || '',
          country: (item as any).country || '',
          postalCode: (item as any).postalCode || ''
        }
        : { name: '', email: '', phone: '', gstin: '', addressLine1: '', addressLine2: '', area: '', city: '', state: '', country: '', postalCode: '' }
    )
    setShowForm(true)
  }

  const generateGSTIN = () => {
    const stateCode = '22' // Example: Gujarat
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let pan = ''
    for (let i = 0; i < 10; i++) {
      pan += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const entity = '1'
    const z = 'Z'
    const checksum = '5'
    return `${stateCode}${pan}${entity}${z}${checksum}`
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Invalid email format'
    if (!form.phone) errs.phone = 'Phone number is required'
    else if (!/^\d{10}$/.test(form.phone))
      errs.phone = 'Phone must be 10 digits'
    if (form.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(form.gstin))
      errs.gstin = 'Invalid GSTIN format (15 alphanumeric characters)'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    try {
      if (editing) {
        if (!canUpdate('buyer')) return
        await api.put(`/buyers/${editing.id}`, form)
      } else {
        if (!canCreate('buyer')) return
        await api.post('/buyers', form)
      }
      setShowForm(false)
      fetchAll()
    } catch (err) {
      console.error('Save failed', err)
    }
  }

  const archiveBuyer = async (id: number) => {
    if (!canDelete('buyer')) return
    const ok = await confirmModal({
      title: 'Archive buyer?',
      description: 'This will archive the buyer. You can restore it later from the archived view.'
    })
    if (!ok) return
    try {
      await api.delete(`/buyers/${id}`)
      setToast('✅ Buyer archived')
      setTimeout(() => setToast(null), 1800)
      fetchAll()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Archive failed'
      setToast(`⚠️ ${msg}`)
      setTimeout(() => setToast(null), 2500)
    }
  }

  const deleteBuyer = async (id: number) => {
    if (!canDelete('buyer')) return
    const ok = await confirmModal({
      title: 'Permanently delete buyer?',
      description: 'This action cannot be undone. The buyer will be permanently removed from the database.'
    })
    if (!ok) return
    try {
      await api.delete(`/buyers/${id}/permanent`)
      setToast('✅ Buyer deleted')
      setTimeout(() => setToast(null), 1800)
      fetchAll()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Delete failed'
      setToast(`⚠️ ${msg}`)
      setTimeout(() => setToast(null), 2500)
    }
  }

  const restoreBuyer = async (id: number) => {
    if (!canUpdate('buyer')) return
    const ok = await confirmModal({
      title: 'Restore buyer?',
      description: 'This will unarchive the buyer and make them active again.'
    })
    if (!ok) return
    try {
      await api.patch(`/buyers/${id}/restore`, {})
      setToast('✅ Buyer restored')
      setTimeout(() => setToast(null), 1800)
      fetchAll()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Restore failed'
      setToast(`⚠️ ${msg}`)
      setTimeout(() => setToast(null), 2500)
    }
  }

  // Define table columns
  const columns: Column<Buyer>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      align: 'left',
      render: (row: Buyer) => (
        <button
          onClick={() => navigate(`/buyers/${row.id}`)}
          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors text-left"
        >
          {row.name}
        </button>
      )
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      align: 'left',
      render: (row: Buyer) => (
        <span className="text-gray-600">{row.email}</span>
      )
    },
    {
      key: 'phone',
      label: 'Contact',
      sortable: false,
      align: 'left',
      render: (row: Buyer) => (
        <span className="font-medium text-gray-700">{row.phone}</span>
      )
    },
    {
      key: 'gstin',
      label: 'GSTIN',
      sortable: false,
      align: 'center',
      render: (row: Buyer) => (
        row.gstin ? (
          <StatusBadge label={row.gstin} variant="indigo" size="sm" />
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )
      )
    },
    {
      key: 'location',
      label: 'Location',
      sortable: false,
      align: 'left',
      render: (row: Buyer) => {
        const city = (row as any).city || ''
        const state = (row as any).state || ''
        const location = [city, state].filter(Boolean).join(', ') || '-'

        // Full address for tooltip
        const fullAddress = [
          (row as any).addressLine1,
          (row as any).addressLine2,
          (row as any).area,
          city,
          state,
          (row as any).postalCode,
          (row as any).country
        ].filter(Boolean).join(', ')

        return (
          <span className="text-gray-600 text-sm" title={fullAddress || row.address}>
            {location}
          </span>
        )
      }
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      align: 'left',
      render: (row: Buyer) => (
        <span className="text-xs text-gray-500">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-GB') : '-'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row: Buyer) => {
        const actions: ActionButton[] = [
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => open(row),
            color: 'blue',
            show: canUpdate('buyer') && !archived
          },
          {
            label: 'Delete',
            icon: Trash2,
            onClick: () => deleteBuyer(row.id),
            color: 'red',
            show: canDelete('buyer') && !archived
          },
          {
            label: 'Archive',
            icon: Archive,
            onClick: () => archiveBuyer(row.id),
            color: 'orange',
            show: canDelete('buyer') && !archived
          },
          {
            label: 'Restore',
            icon: RotateCcw,
            onClick: () => restoreBuyer(row.id),
            color: 'green',
            show: canUpdate('buyer') && archived
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
        searchPlaceholder="Search buyers by name, email, phone, GSTIN, or location..."
        filters={
          <FilterCheckbox
            label={archived ? 'Showing Archived' : 'Show Archived'}
            checked={archived}
            onChange={setArchived}
            icon={archived && <Archive size={16} strokeWidth={1.8} />}
          />
        }
        actions={
          canCreate('buyer') && (
            <button className="btn-primary flex items-center gap-2" onClick={() => open(null)}>
              <Plus size={18} strokeWidth={1.8} />
              Add Buyer
            </button>
          )
        }
      />

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={paginatedData}
        currentPage={currentPage}
        totalPages={Math.max(1, Math.ceil(sortedData.length / pageSize))}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyMessage={archived ? "No archived buyers found" : "No buyers found"}
      />

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-teal-600 to-teal-700 text-white px-8 py-6 rounded-t-xl">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                {editing ? (
                  <>
                    <Pencil size={20} strokeWidth={1.8} />
                    Edit Buyer
                  </>
                ) : (
                  <>
                    <Plus size={20} strokeWidth={1.8} />
                    Add New Buyer
                  </>
                )}
              </h3>
              <p className="text-teal-100 text-sm mt-1">
                {editing ? 'Update buyer information' : 'Fill in the details to create a new buyer'}
              </p>
            </div>

            <form onSubmit={save} className="p-8">
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-teal-500 flex items-center gap-2">
                    <FileText size={18} strokeWidth={1.8} />
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={`input ${errors.name ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200'} transition-all`}
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Enter buyer name"
                      />
                      {errors.name && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle size={14} strokeWidth={1.8} />
                          {errors.name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        GSTIN <span className="text-gray-400 text-xs">(Optional)</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          className={`input flex-1 ${errors.gstin ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200'} transition-all`}
                          value={form.gstin}
                          onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                          placeholder="22AAAAA0000A1Z5"
                          maxLength={15}
                        />
                        {!editing && (
                          <button
                            type="button"
                            className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-sm font-medium"
                            onClick={() => setForm((f) => ({ ...f, gstin: generateGSTIN() }))}
                          >
                            Generate
                          </button>
                        )}
                      </div>
                      {errors.gstin && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle size={14} strokeWidth={1.8} />
                          {errors.gstin}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
                    <Phone size={18} strokeWidth={1.8} />
                    Contact Information
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        className={`input ${errors.email ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200'} transition-all`}
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="buyer@example.com"
                      />
                      {errors.email && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle size={14} strokeWidth={1.8} />
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        className={`input ${errors.phone ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200'} transition-all`}
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="+91 98765 43210"
                      />
                      {errors.phone && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle size={14} strokeWidth={1.8} />
                          {errors.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Address Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-purple-500 flex items-center gap-2">
                    <Home size={18} strokeWidth={1.8} />
                    Address Details
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address Line 1
                        </label>
                        <input
                          className="input border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all"
                          value={form.addressLine1}
                          onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                          placeholder="Street address"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address Line 2 <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input
                          className="input border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all"
                          value={form.addressLine2}
                          onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
                          placeholder="Apartment, suite, etc."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Area/Locality
                        </label>
                        <input
                          className="input border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all"
                          value={form.area}
                          onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                          placeholder="Area or locality"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Postal Code
                        </label>
                        <input
                          className="input border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all"
                          value={form.postalCode}
                          onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                          placeholder="123456"
                        />
                      </div>
                    </div>

                    {/* Country, State, City Dropdowns */}
                    <CountryStateCitySelect
                      country={form.country}
                      state={form.state}
                      city={form.city}
                      onCountryChange={(value) => setForm((f) => ({ ...f, country: value }))}
                      onStateChange={(value) => setForm((f) => ({ ...f, state: value }))}
                      onCityChange={(value) => setForm((f) => ({ ...f, city: value }))}
                      errors={{
                        country: errors.country,
                        state: errors.state,
                        city: errors.city
                      }}
                    />
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
                    <ArrowLeft size={18} strokeWidth={1.8} />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-teal-800 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                  >
                    <Save size={18} strokeWidth={1.8} />
                    {editing ? 'Update Buyer' : 'Save Buyer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-black text-white px-4 py-2 rounded-lg shadow-md z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
