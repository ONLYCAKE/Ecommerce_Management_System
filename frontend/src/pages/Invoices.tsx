import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { io, Socket } from 'socket.io-client'
import { ChevronDown, DollarSign, ArrowUpDown, Filter, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, CheckCircle, Eye, Mail, IndianRupee, FileText, TrendingUp, Wallet, Plus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import EmailTemplateModal from '../components/EmailTemplateModal'
import SummaryCards, { SummaryCard } from '../components/common/SummaryCards'
import PaymentModal from '../components/PaymentModal'

import FinalizeInvoiceModal from '../components/FinalizeInvoiceModal'
import { calculateInvoiceStatus, formatCurrency } from '../utils/invoiceStatus'

export default function Invoices() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Data state
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  //Summary data state
  const [summaryData, setSummaryData] = useState({
    totalSales: 0,
    totalReceived: 0,
    totalBalance: 0,
    count: 0
  })

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string[]>([])
  const [showPaymentFilter, setShowPaymentFilter] = useState(false)
  const [dateFilter, setDateFilter] = useState<Date | null>(null)
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [partyNameSearch, setPartyNameSearch] = useState<string>('')
  const [showPartyNameFilter, setShowPartyNameFilter] = useState(false)
  const [reportMode, setReportMode] = useState<string | null>(null)

  // Pagination state
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)

  // Sort state
  const [sortBy, setSortBy] = useState<'invoiceNo' | 'total' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modal state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentInvoice, setSelectedPaymentInvoice] = useState<any>(null)

  // Finalize modal
  const [selectedFinalizeInvoice, setSelectedFinalizeInvoice] = useState<any>(null)
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)

  // Socket state
  const [socket, setSocket] = useState<Socket | null>(null)

  // Initialize filters from URL params (for Sale Report / Daybook Report navigation)
  useEffect(() => {
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const status = searchParams.get('status')

    if (from) setDateFrom(new Date(from))
    if (to) setDateTo(new Date(to))
    if (status && status !== 'all') setStatusFilter(status)

    // Set report mode based on URL
    if (from === to && from) {
      setReportMode('daybook')
    } else if (from && to) {
      setReportMode('sale')
    }
  }, [searchParams])

  const canCreate = useMemo(() => (user?.permissions || []).includes('invoice.create') || user?.role === 'SuperAdmin', [user])
  const canUpdate = useMemo(() => (user?.permissions || []).includes('invoice.update') || user?.role === 'SuperAdmin', [user])

  // Load invoices
  const load = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (statusFilter !== 'All') params.append('status', statusFilter)
      if (paymentMethodFilter.length > 0) params.append('paymentMethod', paymentMethodFilter.join(','))

      // Handle date range filters (from Sale Report / Daybook Report)
      if (dateFrom && dateTo) {
        params.append('dateFrom', dateFrom.toISOString().split('T')[0])
        params.append('dateTo', dateTo.toISOString().split('T')[0])
      } else if (dateFilter) {
        // Single date filter (legacy)
        params.append('date', dateFilter.toISOString().split('T')[0])
      }

      if (sortBy) {
        params.append('sortBy', sortBy)
        params.append('sortOrder', sortOrder)
      }
      if (partyNameSearch.trim()) {
        params.append('partyName', partyNameSearch.trim())
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

  // Fetch summary data
  const loadSummary = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'All') params.append('status', statusFilter)
      if (paymentMethodFilter.length > 0) params.append('paymentMethod', paymentMethodFilter.join(','))

      const { data } = await api.get(`/invoices/summary?${params.toString()}`)
      setSummaryData(data)
    } catch (error) {
      console.error('Failed to fetch summary:', error)
    }
  }

  // Clear report mode and date range
  const clearReportFilters = () => {
    setDateFrom(null)
    setDateTo(null)
    setReportMode(null)
    navigate('/invoices', { replace: true })
  }

  // Load on filter/sort change
  useEffect(() => {
    load()
    loadSummary()
  }, [statusFilter, paymentMethodFilter, dateFilter, dateFrom, dateTo, sortBy, sortOrder, partyNameSearch])

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
      loadSummary()
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
  const handleSort = (column: 'invoiceNo' | 'total') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const start = (page - 1) * pageSize
  const sortedItems = items.slice(start, start + pageSize)

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, partyNameSearch, dateFilter])

  // Handle email modal
  const openEmailModal = (invoice: any) => {
    setSelectedInvoice(invoice)
    setShowEmailModal(true)
  }

  const closeEmailModal = () => {
    setShowEmailModal(false)
    setSelectedInvoice(null)
  }



  // Handle finalize draft invoice
  const openFinalizeModal = (invoice: any) => {
    setSelectedFinalizeInvoice(invoice)
    setShowFinalizeModal(true)
  }

  const closeFinalizeModal = () => {
    setShowFinalizeModal(false)
    setSelectedFinalizeInvoice(null)
  }

  const handleFinalize = async () => {
    if (!selectedFinalizeInvoice) return

    try {
      await api.post(`/invoices/${selectedFinalizeInvoice.invoiceNo}/finalize`)
      toast.success('Invoice finalized successfully!')
      load() // Reload list
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to finalize invoice')
    }
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
    // Check database status first (for Draft and Cancelled)
    if (invoice.status === 'Draft') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
          Draft
        </span>
      )
    }



    // For other statuses, use payment-based calculation
    const receivedAmount = invoice.receivedAmount || 0
    const status = calculateInvoiceStatus(invoice.total, receivedAmount)

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bgColor} ${status.textColor}`}>
        {status.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Report Banner - shown when accessing from Dashboard */}
      {reportMode && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${reportMode === 'daybook'
          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
          : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
          }`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{reportMode === 'daybook' ? '📅' : '📈'}</span>
            <div>
              <div className="font-bold text-lg">
                {reportMode === 'daybook' ? 'Daybook Report' : 'Sale Report'}
              </div>
              <div className="text-sm opacity-90">
                {reportMode === 'daybook'
                  ? `Showing invoices created today (${dateFrom?.toLocaleDateString('en-IN')})`
                  : `Showing invoices from ${dateFrom?.toLocaleDateString('en-IN')} to ${dateTo?.toLocaleDateString('en-IN')}`
                }
              </div>
            </div>
          </div>
          <button
            onClick={clearReportFilters}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-medium"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <SummaryCards cards={[
        {
          title: 'Total Invoices',
          value: summaryData.count,
          icon: FileText,
          color: 'blue',
          subtitle: 'All invoices'
        },
        {
          title: 'Total Sales',
          value: formatCurrency(summaryData.totalSales),
          icon: DollarSign,
          color: 'indigo',
          subtitle: 'Total amount'
        },
        {
          title: 'Received',
          value: formatCurrency(summaryData.totalReceived),
          icon: Wallet,
          color: 'green',
          subtitle: 'Paid amount'
        },
        {
          title: 'Balance',
          value: formatCurrency(summaryData.totalBalance),
          icon: TrendingUp,
          color: 'orange',
          subtitle: 'Pending'
        }
      ]} />

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Search and Filters */}
          <div className="flex items-center gap-3 flex-1">
            {/* Status Filter Buttons */}
            {['All', 'Draft', 'Unpaid', 'Partial', 'Paid'].map(filter => (
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
                <div className="absolute top-full mt-2 bg-white rounded-lg shadow-lg p-4 z-10 w-56 border border-gray-200">
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

          {/* Right side - Add Sale Button */}
          {canCreate && (
            <button
              onClick={() => navigate('/invoices/new')}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              <Plus size={18} strokeWidth={1.8} />
              Add Sale
            </button>
          )}
        </div>
      </div>

      {/* Invoices Table */}
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
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-2 relative">
                    <span>Party Name</span>
                    <button
                      onClick={() => setShowPartyNameFilter(!showPartyNameFilter)}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Filter by party name"
                    >
                      <Filter size={14} className={partyNameSearch ? 'text-blue-600' : 'text-gray-400'} />
                    </button>

                    {showPartyNameFilter && (
                      <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 w-64">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Party Name</label>
                            <input
                              type="text"
                              value={partyNameSearch}
                              onChange={(e) => setPartyNameSearch(e.target.value)}
                              placeholder="Search..."
                              className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setPartyNameSearch('')
                                setShowPartyNameFilter(false)
                              }}
                              className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
                            >
                              Clear
                            </button>
                            <button
                              onClick={() => setShowPartyNameFilter(false)}
                              className="flex-1 px-3 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
                          {/* Show NO action buttons for Cancelled invoices */}
                          {inv.status === 'Cancelled' ? (
                            <span className="text-sm text-gray-400 italic">No actions available</span>
                          ) : (
                            <>
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

                              {/* Finalize Draft - only for Draft invoices */}
                              {inv.status === 'Draft' && canUpdate && (
                                <button
                                  onClick={() => openFinalizeModal(inv)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Finalize Draft"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              )}

                              {/* View Invoice PDF - disabled for Draft */}
                              {inv.status !== 'Draft' && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const response = await api.get(`/invoices/generate/${inv.invoiceNo}`, {
                                        responseType: 'arraybuffer'
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
                              )}

                              {/* Send Email - disabled for Draft */}
                              {inv.status !== 'Draft' && (
                                <button
                                  onClick={() => openEmailModal(inv)}
                                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                  title="Send Email"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              )}

                              {/* Add Payment - only show when balance > 0 AND not Draft */}
                              {canUpdate && balance > 0 && inv.status !== 'Draft' && (
                                <button
                                  onClick={() => openPaymentModal(inv)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Add Payment"
                                >
                                  <DollarSign size={16} />
                                </button>
                              )}




                            </>
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

        {/* Pagination - with footer rows-per-page selector */}
        {items.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between gap-4">
              {/* Rows per page - LEFT */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Rows per page:</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Page navigation - RIGHT */}
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
          </div>
        )}
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



      {/* Finalize Invoice Modal */}
      {showFinalizeModal && selectedFinalizeInvoice && (
        <FinalizeInvoiceModal
          isOpen={showFinalizeModal}
          invoiceNo={selectedFinalizeInvoice.invoiceNo}
          onClose={closeFinalizeModal}
          onConfirm={handleFinalize}
        />
      )}
    </div>
  )
}
