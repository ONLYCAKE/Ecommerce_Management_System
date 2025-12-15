import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { io, Socket } from 'socket.io-client'
import { ChevronDown, DollarSign, ArrowUpDown, Filter, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import EmailTemplateModal from '../components/EmailTemplateModal'
import InvoiceSummaryCard from '../components/InvoiceSummaryCard'
import PaymentModal from '../components/PaymentModal'
import { calculateInvoiceStatus, formatCurrency } from '../utils/invoiceStatus'

export default function Invoices() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Data state
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string[]>([])
  const [showPaymentFilter, setShowPaymentFilter] = useState(false)
  const [dateFilter, setDateFilter] = useState<Date | null>(null)

  // Sort state
  const [sortBy, setSortBy] = useState<'invoiceNo' | 'total' | 'partyName' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modal state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentInvoice, setSelectedPaymentInvoice] = useState<any>(null)

  // Socket state
  const [socket, setSocket] = useState<Socket | null>(null)

  const canCreate = useMemo(() => (user?.permissions || []).includes('invoice.create') || user?.role === 'SuperAdmin', [user])
  const canUpdate = useMemo(() => (user?.permissions || []).includes('invoice.update') || user?.role === 'SuperAdmin', [user])

  // Load invoices
  const load = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (statusFilter !== 'All') params.append('status', statusFilter)
      if (paymentMethodFilter.length > 0) params.append('paymentMethod', paymentMethodFilter.join(','))
      if (dateFilter) {
        // Send date in YYYY-MM-DD format for server-side filtering
        params.append('date', dateFilter.toISOString().split('T')[0])
      }
      if (sortBy) {
        params.append('sortBy', sortBy)
        params.append('sortOrder', sortOrder)
      }

      const { data } = await api.get(`/invoices?${params.toString()}`)
      setItems(data)
    } catch (error) {
      console.error('Failed to load invoices:', error)
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  // Load on filter/sort change
  useEffect(() => {
    load()
  }, [statusFilter, paymentMethodFilter, dateFilter, sortBy, sortOrder])

  // Socket.IO real-time updates
  useEffect(() => {
    const socketUrl = (import.meta as any).env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'
    const newSocket = io(socketUrl)

    newSocket.on('connected', () => {
      console.log('✅ Connected to real-time server')
    })

    // Payment events
    newSocket.on('payment.created', () => {
      load()
      if ((window as any).refreshInvoiceSummary) {
        (window as any).refreshInvoiceSummary()
      }
    })

    newSocket.on('payment.updated', () => {
      load()
      if ((window as any).refreshInvoiceSummary) {
        (window as any).refreshInvoiceSummary()
      }
    })

    newSocket.on('payment.deleted', () => {
      load()
      if ((window as any).refreshInvoiceSummary) {
        (window as any).refreshInvoiceSummary()
      }
    })

    // Invoice events
    newSocket.on('invoice.updated', () => {
      load()
      if ((window as any).refreshInvoiceSummary) {
        (window as any).refreshInvoiceSummary()
      }
    })

    newSocket.on('invoice.created', load)
    newSocket.on('invoice.deleted', load)
    newSocket.on('invoice.completed', load)

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  // Handle sort
  const handleSort = (column: 'invoiceNo' | 'total' | 'partyName') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Sort items client-side for partyName (server-side for others)
  const sortedItems = useMemo(() => {
    if (sortBy === 'partyName') {
      return [...items].sort((a, b) => {
        const nameA = a.buyer?.name || ''
        const nameB = b.buyer?.name || ''
        if (sortOrder === 'asc') {
          return nameA.localeCompare(nameB)
        } else {
          return nameB.localeCompare(nameA)
        }
      })
    }
    return items
  }, [items, sortBy, sortOrder])

  // Handle email modal
  const openEmailModal = (invoice: any) => {
    setSelectedInvoice(invoice)
    setShowEmailModal(true)
  }

  const closeEmailModal = () => {
    setShowEmailModal(false)
    setSelectedInvoice(null)
  }

  // Handle payment modal
  const openPaymentModal = (invoice: any) => {
    setSelectedPaymentInvoice(invoice)
    setShowPaymentModal(true)
  }

  const closePaymentModal = () => {
    setShowPaymentModal(false)
    setSelectedPaymentInvoice(null)
  }

  const handlePaymentSuccess = () => {
    load()
    if ((window as any).refreshInvoiceSummary) {
      (window as any).refreshInvoiceSummary()
    }
  }

  // Render status chip
  const renderStatus = (invoice: any) => {
    const receivedAmount = invoice.receivedAmount || 0
    const status = calculateInvoiceStatus(invoice.total, receivedAmount)

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bgColor} ${status.textColor}`}>
        {status.label}
      </span>
    )
  }

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Sale Invoices</h1>
        {canCreate && (
          <button
            onClick={() => navigate('/invoices/new')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all"
          >
            + Add Sale
          </button>
        )}
      </div>

      {/* Summary Card */}
      <InvoiceSummaryCard
        filters={{
          status: statusFilter !== 'All' ? statusFilter : undefined,
          paymentMethod: paymentMethodFilter.length > 0 ? paymentMethodFilter.join(',') : undefined
        }}
      />

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        {/* Status Filter Buttons */}
        {['All', 'Unpaid', 'Partial', 'Paid', 'Cancelled'].map(filter => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${statusFilter === filter
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {filter}
          </button>
        ))}

        {/* Payment Method Filter */}
        <div className="relative">
          <button
            onClick={() => setShowPaymentFilter(!showPaymentFilter)}
            className="px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-2"
          >
            <Filter size={16} />
            Payment Type
            {paymentMethodFilter.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {paymentMethodFilter.length}
              </span>
            )}
          </button>

          {showPaymentFilter && (
            <div className="absolute top-full mt-2 bg-white rounded-lg shadow-lg p-4 z-10 w-56">
              <div className="space-y-2">
                {['Cash', 'Card', 'UPI', 'Bank Transfer', 'Cheque'].map(method => (
                  <label key={method} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentMethodFilter.includes(method)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPaymentMethodFilter([...paymentMethodFilter, method])
                        } else {
                          setPaymentMethodFilter(paymentMethodFilter.filter(m => m !== method))
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{method}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setPaymentMethodFilter([])}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowPaymentFilter(false)}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Date</span>
                    <div className="relative">
                      <DatePicker
                        selected={dateFilter}
                        onChange={(date) => setDateFilter(date)}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Filter"
                        isClearable
                        className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-28"
                      />
                    </div>
                    {dateFilter && (
                      <button
                        onClick={() => setDateFilter(null)}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Clear date filter"
                      >
                        <X size={14} className="text-gray-500" />
                      </button>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('invoiceNo')}
                >
                  <div className="flex items-center gap-2">
                    Invoice No
                    <ArrowUpDown size={14} className={sortBy === 'invoiceNo' ? 'text-blue-600' : 'text-gray-400'} />
                  </div>
                </th>
                <th
                  className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('partyName')}
                >
                  <div className="flex items-center gap-2">
                    Party Name
                    <ArrowUpDown size={14} className={sortBy === 'partyName' ? 'text-blue-600' : 'text-gray-400'} />
                  </div>
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Payment Type
                </th>
                <th
                  className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Amount
                    <ArrowUpDown size={14} className={sortBy === 'total' ? 'text-blue-600' : 'text-gray-400'} />
                  </div>
                </th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                sortedItems.map((inv) => {
                  const receivedAmount = inv.receivedAmount || 0
                  const balance = inv.balance || (inv.total - receivedAmount)
                  const itemCount = inv.items?.length || 0

                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(inv.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {inv.invoiceNo}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {inv.buyer?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {inv.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-orange-600">
                        {formatCurrency(balance)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {renderStatus(inv)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {/* Edit Invoice */}
                          <button
                            onClick={() => navigate(`/invoices/${inv.invoiceNo}/edit`)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Invoice"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* View Invoice PDF */}
                          <button
                            onClick={async () => {
                              try {
                                const response = await api.get(`/invoices/generate/${inv.invoiceNo}`, {
                                  responseType: 'blob'
                                })
                                const blob = new Blob([response.data], { type: 'application/pdf' })
                                const url = window.URL.createObjectURL(blob)
                                window.open(url, '_blank')
                              } catch (error) {
                                console.error('Failed to open PDF:', error)
                                toast.error('Failed to open invoice PDF')
                              }
                            }}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="View Invoice"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          {/* Send Email */}
                          <button
                            onClick={() => openEmailModal(inv)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Send Email"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>

                          {/* Add Payment - only show when balance > 0 */}
                          {canUpdate && balance > 0 && (
                            <button
                              onClick={() => openPaymentModal(inv)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Add Payment"
                            >
                              <DollarSign size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Template Modal */}
      {showEmailModal && selectedInvoice && (
        <EmailTemplateModal
          isOpen={showEmailModal}
          invoice={selectedInvoice}
          buyer={selectedInvoice.buyer}
          onClose={closeEmailModal}
          onSend={async (data) => {
            // Send email via backend API
            try {
              await api.post(`/invoices/${selectedInvoice.invoiceNo}/send-email`, {
                to: data.to,
                subject: data.subject,
                htmlBody: data.htmlBody
              })
              toast.success('Email sent successfully!')
              closeEmailModal()
              load()
            } catch (error: any) {
              toast.error(error.response?.data?.message || 'Failed to send email')
              throw error // Re-throw to let EmailTemplateModal show error
            }
          }}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedPaymentInvoice && (
        <PaymentModal
          invoice={selectedPaymentInvoice}
          onClose={closePaymentModal}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}
