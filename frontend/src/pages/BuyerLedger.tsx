import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import { formatCurrency } from '../utils/invoiceStatus'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { ArrowLeft, FileText, CreditCard, Search, IndianRupee, Loader2, Filter, ArrowUpDown } from 'lucide-react'
import PaymentModal from '../components/PaymentModal'
import { toast } from 'react-hot-toast'

interface Buyer {
  id: number
  name: string
  email?: string
  phone?: string
  gstin?: string
  addressLine1?: string
  addressLine2?: string
  area?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

interface Invoice {
  id: number
  invoiceNo: string
  buyerId: number
  total: number
  balance?: number
  status: string
  createdAt: string
  invoiceDate?: string
  buyer?: Buyer
  receivedAmount?: number
}

interface PaymentRecord {
  id: number
  invoiceId?: number
  invoiceNo: string
  paymentDate: string
  paidAmount: number
  remainingBalance: number
  paymentMethod: string
  reference: string
  invoiceStatus: string
}

type LedgerRowType = 'invoice' | 'payment'

interface LedgerRow {
  id: string
  date: Date
  type: LedgerRowType
  documentNo: string
  status: string
  amount: number
  balanceAfter: number
  rawInvoice?: Invoice
  rawPayment?: PaymentRecord
}

export default function BuyerLedger() {
  const { buyerId } = useParams<{ buyerId: string }>()
  const navigate = useNavigate()

  const [buyer, setBuyer] = useState<Buyer | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'ledger' | 'invoices' | 'payments'>('ledger')

  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'All' | 'Paid' | 'Partial' | 'Unpaid'>('All')

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentInvoice, setSelectedPaymentInvoice] = useState<Invoice | null>(null)

  const openInvoicePdf = async (invoiceNo: string) => {
    try {
      const response = await api.get(`/invoices/generate/${invoiceNo}`, {
        responseType: 'arraybuffer'
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (error: any) {
      console.error('Failed to open invoice PDF:', error)
      toast.error(error?.response?.data?.message || 'Failed to open invoice PDF')
    }
  }

  useEffect(() => {
    const load = async () => {
      if (!buyerId) return
      setLoading(true)
      setError(null)
      try {
        const [buyersRes, invoicesRes, paymentsRes] = await Promise.all([
          api.get(`/buyers/${buyerId}`).catch(() => api.get('/buyers')),
          api.get('/invoices'),
          api.get('/payments/records')
        ])

        // Buyer
        if (Array.isArray(buyersRes.data)) {
          const found = buyersRes.data.find((b: any) => b.id === Number(buyerId)) || null
          setBuyer(found)
        } else {
          setBuyer(buyersRes.data || null)
        }

        const allInvoices: Invoice[] = Array.isArray(invoicesRes.data) ? invoicesRes.data : (invoicesRes.data?.items || [])
        const buyerInvoices = allInvoices.filter(inv =>
          inv.buyerId === Number(buyerId) || inv.buyer?.id === Number(buyerId)
        )
        setInvoices(buyerInvoices)

        const allPayments: PaymentRecord[] = Array.isArray(paymentsRes.data) ? paymentsRes.data : (paymentsRes.data?.items || [])
        const buyerInvoiceNos = new Set(buyerInvoices.map(inv => inv.invoiceNo))
        const buyerPayments = allPayments.filter(p => buyerInvoiceNos.has(p.invoiceNo))
        setPayments(buyerPayments)
      } catch (err: any) {
        console.error('Failed to load buyer ledger data', err)
        setError(err.response?.data?.message || 'Failed to load buyer ledger data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [buyerId])

  const outstandingBalance = useMemo(() => {
    return invoices.reduce((sum, inv) => {
      const balance = typeof inv.balance === 'number'
        ? inv.balance
        : typeof inv.receivedAmount === 'number'
          ? inv.total - inv.receivedAmount
          : inv.total
      return sum + balance
    }, 0)
  }, [invoices])

  const filteredInvoices = useMemo(() => {
    let result = [...invoices]

    if (invoiceStatusFilter !== 'All') {
      result = result.filter(inv => {
        const status = (inv.status || '').toLowerCase()
        if (invoiceStatusFilter === 'Paid') return status === 'paid' || status === 'completed'
        if (invoiceStatusFilter === 'Partial') return status === 'partial' || status === 'processing'
        if (invoiceStatusFilter === 'Unpaid') return status === 'unpaid' || status === 'draft' || status === 'pending'
        return true
      })
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(inv =>
        inv.invoiceNo?.toLowerCase().includes(term) ||
        inv.buyer?.name?.toLowerCase().includes(term)
      )
    }

    if (dateFrom || dateTo) {
      result = result.filter(inv => {
        const dateStr = inv.invoiceDate || inv.createdAt
        if (!dateStr) return false
        const d = new Date(dateStr)
        if (dateFrom && d < dateFrom) return false
        if (dateTo && d > dateTo) return false
        return true
      })
    }

    return result
  }, [invoices, invoiceStatusFilter, searchTerm, dateFrom, dateTo])

  const filteredPayments = useMemo(() => {
    let result = [...payments]

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(p =>
        p.invoiceNo?.toLowerCase().includes(term) ||
        p.reference?.toLowerCase().includes(term)
      )
    }

    if (dateFrom || dateTo) {
      result = result.filter(p => {
        const d = new Date(p.paymentDate)
        if (dateFrom && d < dateFrom) return false
        if (dateTo && d > dateTo) return false
        return true
      })
    }

    return result
  }, [payments, searchTerm, dateFrom, dateTo])

  const ledgerRows: LedgerRow[] = useMemo(() => {
    const rows: LedgerRow[] = []

    for (const inv of filteredInvoices) {
      const dateStr = inv.invoiceDate || inv.createdAt
      const date = new Date(dateStr)
      rows.push({
        id: `inv-${inv.id}`,
        date,
        type: 'invoice',
        documentNo: inv.invoiceNo,
        status: inv.status,
        amount: inv.total,
        balanceAfter: 0,
        rawInvoice: inv
      })
    }

    for (const p of filteredPayments) {
      const date = new Date(p.paymentDate)
      rows.push({
        id: `pay-${p.id}`,
        date,
        type: 'payment',
        documentNo: p.reference || p.invoiceNo,
        status: p.invoiceStatus,
        amount: p.paidAmount,
        balanceAfter: 0,
        rawPayment: p
      })
    }

    rows.sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime()
      if (diff !== 0) return diff
      if (a.type === b.type) return 0
      return a.type === 'invoice' ? -1 : 1
    })

    let running = 0
    for (const row of rows) {
      if (row.type === 'invoice') {
        running += row.amount
      } else {
        running -= row.amount
      }
      row.balanceAfter = running
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      return rows.filter(r =>
        r.documentNo.toLowerCase().includes(term) ||
        r.status?.toLowerCase().includes(term)
      )
    }

    if (dateFrom || dateTo) {
      return rows.filter(r => {
        if (dateFrom && r.date < dateFrom) return false
        if (dateTo && r.date > dateTo) return false
        return true
      })
    }

    return rows
  }, [filteredInvoices, filteredPayments, searchTerm, dateFrom, dateTo])

  const openPayRemaining = (invoice: Invoice) => {
    const received = invoice.receivedAmount || 0
    const balance = typeof invoice.balance === 'number' ? invoice.balance : invoice.total - received
    if (balance <= 0) return
    setSelectedPaymentInvoice({ ...invoice, receivedAmount: received })
    setShowPaymentModal(true)
  }

  const closePaymentModal = () => {
    setShowPaymentModal(false)
    setSelectedPaymentInvoice(null)
  }

  const handlePaymentSuccess = () => {
    if (!buyerId) return
    setLoading(true)
    api.get('/invoices')
      .then(res => {
        const allInvoices: Invoice[] = Array.isArray(res.data) ? res.data : (res.data?.items || [])
        const buyerInvoices = allInvoices.filter(inv =>
          inv.buyerId === Number(buyerId) || inv.buyer?.id === Number(buyerId)
        )
        setInvoices(buyerInvoices)
      })
      .finally(() => setLoading(false))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-gray-600">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>Loading buyer ledger...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    )
  }

  const fullAddress = buyer
    ? [
      buyer.addressLine1,
      buyer.addressLine2,
      buyer.area,
      buyer.city,
      buyer.state,
      buyer.postalCode,
      buyer.country
    ].filter(Boolean).join(', ')
    : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/buyers')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to Buyers
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
              {buyer?.name?.charAt(0).toUpperCase() || 'B'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{buyer?.name || 'Buyer'}</h1>
              <div className="mt-1 text-sm text-gray-600 space-y-1">
                {buyer?.email && <div>{buyer.email}</div>}
                {buyer?.phone && <div>{buyer.phone}</div>}
                {fullAddress && <div className="text-xs text-gray-500 max-w-xl">{fullAddress}</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs uppercase tracking-wide text-gray-500">Outstanding Balance</span>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200">
            <IndianRupee size={16} className="text-amber-600" />
            <span className="text-lg font-semibold text-amber-700">{formatCurrency(outstandingBalance)}</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Based on all invoices and payments for this buyer
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(['ledger', 'invoices', 'payments'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2 ${activeTab === tab
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-white'
                }`}
            >
              {tab === 'ledger' && <FileText size={16} />}
              {tab === 'invoices' && <FileText size={16} />}
              {tab === 'payments' && <CreditCard size={16} />}
              <span className="capitalize">{tab}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
              placeholder="Search by Invoice No or Reference..."
            />
          </div>

          <div className="flex items-center gap-2">
            <DatePicker
              selected={dateFrom}
              onChange={(date) => setDateFrom(date)}
              selectsStart
              startDate={dateFrom}
              endDate={dateTo}
              dateFormat="dd/MM/yyyy"
              placeholderText="From"
              isClearable
              className="text-xs px-2 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-28"
            />
            <span className="text-gray-400 text-xs">to</span>
            <DatePicker
              selected={dateTo}
              onChange={(date) => setDateTo(date)}
              selectsEnd
              startDate={dateFrom}
              endDate={dateTo}
              minDate={dateFrom ?? undefined}
              dateFormat="dd/MM/yyyy"
              placeholderText="To"
              isClearable
              className="text-xs px-2 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-28"
            />
          </div>

          {activeTab === 'invoices' && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 flex items-center gap-1">
                <Filter size={14} /> Status:
              </span>
              {(['All', 'Paid', 'Partial', 'Unpaid'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setInvoiceStatusFilter(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${invoiceStatusFilter === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeTab === 'ledger' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Document No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance After</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                      No ledger entries found for this buyer.
                    </td>
                  </tr>
                ) : (
                  ledgerRows.map(row => {
                    const isInvoice = row.type === 'invoice'
                    const inv = row.rawInvoice
                    const statusLower = (row.status || '').toLowerCase()
                    const isPartial = statusLower === 'partial' || statusLower === 'processing'
                    const received = inv?.receivedAmount || 0
                    const balance = inv
                      ? (typeof inv.balance === 'number' ? inv.balance : inv.total - received)
                      : 0

                    return (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700">
                          {row.date.toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          {isInvoice ? (
                            <button
                              className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                              onClick={() => inv && openInvoicePdf(inv.invoiceNo)}
                            >
                              {row.documentNo}
                            </button>
                          ) : (
                            <span className="text-gray-800 font-medium">{row.documentNo}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isInvoice ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                            {isInvoice ? 'Invoice' : 'Payment'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                            {row.status || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          <span className={isInvoice ? 'text-gray-900' : 'text-green-600'}>
                            {formatCurrency(row.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-700">
                          {formatCurrency(row.balanceAfter)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isInvoice ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md"
                                onClick={() => inv && openInvoicePdf(inv.invoiceNo)}
                              >
                                View Invoice
                              </button>
                              {isPartial && balance > 0 && (
                                <button
                                  className="px-3 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md"
                                  onClick={() => inv && openPayRemaining(inv)}
                                >
                                  Pay Remaining
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md"
                              onClick={() => row.rawPayment && openInvoicePdf(row.rawPayment.invoiceNo)}
                            >
                              View Invoice
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice No</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                      No invoices found for this buyer.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => {
                    const received = inv.receivedAmount || 0
                    const balance = typeof inv.balance === 'number' ? inv.balance : inv.total - received
                    const statusLower = (inv.status || '').toLowerCase()
                    const isPartial = statusLower === 'partial' || statusLower === 'processing'

                    return (
                      <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700">
                          {new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                            onClick={() => openInvoicePdf(inv.invoiceNo)}
                          >
                            {inv.invoiceNo}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {formatCurrency(inv.total)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-amber-700">
                          {formatCurrency(balance)}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                            {inv.status || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md"
                              onClick={() => openInvoicePdf(inv.invoiceNo)}
                            >
                              View Invoice
                            </button>
                            {isPartial && balance > 0 && (
                              <button
                                className="px-3 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md"
                                onClick={() => openPayRemaining(inv)}
                              >
                                Pay Remaining
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
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice No</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Remaining Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reference</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                      No payments found for this buyer.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700">
                        {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                          onClick={() => openInvoicePdf(p.invoiceNo)}
                        >
                          {p.invoiceNo}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        {formatCurrency(p.paidAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-amber-700">
                        {formatCurrency(p.remainingBalance)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {p.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {p.reference || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md"
                          onClick={() => openInvoicePdf(p.invoiceNo)}
                        >
                          View Invoice
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPaymentModal && selectedPaymentInvoice && (
        <PaymentModal
          invoice={selectedPaymentInvoice}
          onClose={closePaymentModal}
          onSuccess={handlePaymentSuccess}
          initialAmount={(() => {
            const received = selectedPaymentInvoice.receivedAmount || 0
            const balance = typeof selectedPaymentInvoice.balance === 'number'
              ? selectedPaymentInvoice.balance
              : selectedPaymentInvoice.total - received
            return balance > 0 ? balance : undefined
          })()}
        />
      )}
    </div>
  )
}
