import { useEffect, useState, useMemo, FormEvent } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { canCreate, canUpdate, canDelete, canRead } from '../utils/permissions'
import { useConfirm } from '../context/ConfirmContext'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import CountryStateCitySelect from '../components/common/CountryStateCitySelect'

interface Buyer {
  id: number
  name: string
  email: string
  phone: string
  gstin?: string
  address: string
}

export default function Buyers() {
  const [items, setItems] = useState<Buyer[]>([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
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
  const confirmModal = useConfirm()
  const { user } = useAuth()

  /* ------------------------------------------------------------
     PERMISSION CHECK: If user has no READ access → hide page
  ------------------------------------------------------------ */
  if (!canRead('buyer')) {
    return (
      <div className="p-6 text-center text-gray-500">
        You do not have permission to view buyers.
      </div>
    )
  }

  /* ------------------------------------------------------------
     Fetch Data
  ------------------------------------------------------------ */
  const fetchAll = async () => {
    try {
      const { data } = await api.get('/buyers', { params: { archived } })
      setItems(data)
    } catch (err) {
      console.error('Error fetching buyers', err)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [archived])

  /* ------------------------------------------------------------
     Searching & Pagination
  ------------------------------------------------------------ */
  const filteredAndSorted = useMemo(() => {
    return items.filter((b) =>
      Object.values(b).join(' ').toLowerCase().includes(q.toLowerCase())
    )
  }, [items, q])

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize) || 1

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredAndSorted.slice(start, start + pageSize)
  }, [filteredAndSorted, page, pageSize])

  /* ------------------------------------------------------------
     Form Controls
  ------------------------------------------------------------ */
  const open = (item: Buyer | null = null) => {
    setEditing(item)
    setErrors({})
    setForm(
      item
        ? {
          name: item.name,
          email: item.email,
          phone: item.phone,
          gstin: (item as any).gstin || '',
          addressLine1: (item as any).addressLine1 || '',
          addressLine2: (item as any).addressLine2 || '',
          area: (item as any).area || '',
          city: (item as any).city || '',
          state: (item as any).state || '',
          country: (item as any).country || '',
          postalCode: (item as any).postalCode || ''
        }
        : {
          name: '',
          email: '',
          phone: '',
          gstin: generateGSTIN(), // Auto-generate GSTIN for new buyers
          addressLine1: '',
          addressLine2: '',
          area: '',
          city: '',
          state: '',
          country: '',
          postalCode: ''
        }
    )
    setShowForm(true)
  }

  // Generate realistic GSTIN number
  // Format: 22AAAAA0000A1Z5 (15 characters)
  // First 2 digits: State code (22 = Gujarat)
  // Next 10 characters: PAN-like structure
  // Next 1 digit: Entity number
  // Next 1 character: Z (default)
  // Last 1 character: Checksum
  const generateGSTIN = () => {
    const stateCode = '24' // Gujarat state code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const digits = '0123456789'

    // Generate PAN-like structure: 5 letters + 4 digits + 1 letter
    let pan = ''
    for (let i = 0; i < 5; i++) pan += chars[Math.floor(Math.random() * chars.length)]
    for (let i = 0; i < 4; i++) pan += digits[Math.floor(Math.random() * digits.length)]
    pan += chars[Math.floor(Math.random() * chars.length)]

    const entityNumber = Math.floor(Math.random() * 10) // 0-9
    const defaultChar = 'Z'
    const checksum = digits[Math.floor(Math.random() * digits.length)]

    return `${stateCode}${pan}${entityNumber}${defaultChar}${checksum}`
  }

  const validate = () => {
    const errs: Record<string, string> = {}

    if (!form.name.trim()) errs.name = 'Name is required'

    if (!form.email) errs.email = 'Email is required'
    else if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(form.email))
      errs.email = 'Email must be valid and end with @gmail.com'

    if (!form.phone) errs.phone = 'Phone is required'
    else if (!/^\d{10}$/.test(form.phone))
      errs.phone = 'Phone must be 10 digits'

    // GSTIN validation - only validate format if provided
    if (form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[Z]{1}\d{1}$/.test(form.gstin))
      errs.gstin = 'GSTIN must be 15 characters (e.g., 24ABCDE1234F1Z5)'

    // Address fields are optional for now

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
      console.error('Save buyer failed', err)
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
      fetchAll()
    } catch (err) {
      console.error('Error archiving buyer', err)
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
      fetchAll()
    } catch (err) {
      console.error('Error deleting buyer', err)
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
      fetchAll()
    } catch (err) {
      console.error('Error restoring buyer', err)
    }
  }

  /* ------------------------------------------------------------
     UI Rendering
  ------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              className="input pl-10 pr-4 py-2.5 w-80 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              placeholder="Search buyers by name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <svg className="absolute left-3 top-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Checkbox for Archived Buyers */}
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

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Rows per page:</label>
            <select
              className="input px-3 py-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
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
          </div>

          {canCreate('buyer') && (
            <button
              className="btn-primary px-5 py-2.5 font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              onClick={() => open(null)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Buyer
            </button>
          )}
        </div>
      </div>

      <div className="card p-6 shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">No</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact No</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">GSTIN</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created Date</th>
              <th className="pb-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {paged.map((b, index) => {
              const fullAddress = [
                (b as any).addressLine1,
                (b as any).addressLine2,
                (b as any).area,
                (b as any).city,
                (b as any).state,
                (b as any).postalCode,
                (b as any).country
              ].filter(Boolean).join(', ')

              return (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 text-sm font-medium text-gray-500">
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  <td className="py-4">
                    <div className="text-sm font-semibold text-gray-900">{b.name}</div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm text-gray-600">{b.email}</div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm font-medium text-gray-700">{b.phone}</div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm font-mono text-blue-600 font-medium">
                      {(b as any).gstin || <span className="text-gray-400">-</span>}
                    </div>
                  </td>
                  <td className="py-4 max-w-xs">
                    <div className="text-sm text-gray-600 line-clamp-2">
                      {fullAddress || b.address || '-'}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm text-gray-500">
                      {(b as any).createdAt ? new Date((b as any).createdAt).toLocaleDateString('en-GB') : '09/12/2025'}
                    </div>
                  </td>

                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {!archived && canUpdate('buyer') && (
                        <button
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                          onClick={() => open(b)}
                        >
                          Edit
                        </button>
                      )}

                      {!archived && canDelete('buyer') && (
                        <button
                          className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                          onClick={() => deleteBuyer(b.id)}
                        >
                          Delete
                        </button>
                      )}

                      {!archived && canDelete('buyer') && (
                        <button
                          className="px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-md transition-colors"
                          onClick={() => archiveBuyer(b.id)}
                        >
                          Archive
                        </button>
                      )}

                      {archived && canUpdate('buyer') && (
                        <button
                          className="px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
                          onClick={() => restoreBuyer(b.id)}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

            {filteredAndSorted.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="text-center text-gray-500 py-6"
                >
                  No buyers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {filteredAndSorted.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-xl">
              <h3 className="text-2xl font-bold">
                {editing ? '✏️ Edit Buyer' : '➕ Add New Buyer'}
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                {editing ? 'Update buyer information' : 'Fill in the details to create a new buyer'}
              </p>
            </div>

            <form onSubmit={save} className="p-8">
              {/* Basic Information Section */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
                    <span>📋</span> Basic Information
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={`input ${errors.name ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'} transition-all`}
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Enter buyer name"
                      />
                      {errors.name && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <span>⚠️</span> {errors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        GSTIN
                      </label>
                      <input
                        className={`input ${errors.gstin ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'} font-mono transition-all`}
                        value={form.gstin}
                        onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                        placeholder="24ABCDE1234F1Z5"
                        maxLength={15}
                      />
                      {errors.gstin && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <span>⚠️</span> {errors.gstin}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Information Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-500 flex items-center gap-2">
                    <span>📞</span> Contact Information
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        className={`input ${errors.email ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'} transition-all`}
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="buyer@example.com"
                      />
                      {errors.email && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <span>⚠️</span> {errors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        className={`input ${errors.phone ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'} transition-all`}
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="+91 98765 43210"
                      />
                      {errors.phone && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <span>⚠️</span> {errors.phone}
                        </p>
                      )}
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
                          className="input border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
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
                          className="input border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
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
                          className="input border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
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
                          className="input border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
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
                    <span>✕</span> Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                  >
                    <span>💾</span> {editing ? 'Update Buyer' : 'Save Buyer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )
      }
    </div >
  )
}
