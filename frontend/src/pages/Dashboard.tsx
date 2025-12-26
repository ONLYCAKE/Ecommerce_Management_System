import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { formatINR } from '../utils/currency'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from 'recharts'
import {
  FileText,
  IndianRupee,
  Wallet,
  TrendingUp,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Users,
  Package,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ArrowUpDown,
  X,
  Save,
  Globe,
  MapPin,
  Building2,
  Map
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import CountryStateCitySelect from '../components/common/CountryStateCitySelect'

// Types
type Stats = {
  totals: { users: number; suppliers: number; buyers: number; products: number }
  invoices: { draft: number; completed: number }
  revenueByMonth: Array<{ label: string; total: number }>
  recentProducts: Array<{ id: number; title: string; supplier?: { name?: string }; price: number; stock: number; createdAt: string | Date }>
  totalSales?: number
  totalRevenue?: number
  receivedAmount?: number
  balancePending?: number
  paidInvoicesCount?: number
  unpaidInvoicesCount?: number
  partialInvoicesCount?: number
  periodInvoicesCount?: number
}

// Chart colors palette
const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [stats, setStats] = useState<Stats>({
    totals: { users: 0, suppliers: 0, buyers: 0, products: 0 },
    invoices: { draft: 0, completed: 0 },
    revenueByMonth: [],
    recentProducts: [],
    totalSales: 0,
    totalRevenue: 0,
    receivedAmount: 0
  })
  const [loading, setLoading] = useState(true)

  // Real-time invoice summary for accurate balance
  const [invoiceSummary, setInvoiceSummary] = useState({
    totalSales: 0,
    totalReceived: 0,
    totalBalance: 0,
    count: 0
  })

  // Add Buyer Modal State
  const [showBuyerModal, setShowBuyerModal] = useState(false)
  const [buyerForm, setBuyerForm] = useState({
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
  const [buyerFormErrors, setBuyerFormErrors] = useState<Record<string, string>>({})
  const [savingBuyer, setSavingBuyer] = useState(false)

  // Analytics data state
  const [analytics, setAnalytics] = useState<{
    buyerWiseSales: Array<{ id: number; name: string; total: number; percentage: number }>
    productWiseSales: Array<{ id: number; name: string; total: number; percentage: number }>
    topBuyersTable: Array<{ id: number; buyerName: string; totalInvoices: number; totalSales: number; pendingBalance: number }>
    collectionSummary: { totalSales: number; totalReceived: number; pendingAmount: number; collectionPercentage: number; invoiceCount: number }
    buyerFilter?: { id: number; name: string } | null
    // Location-wise sales
    salesByCountry: Array<{ name: string; total: number; percentage: number }>
    salesByState: Array<{ name: string; total: number; percentage: number }>
    salesByCity: Array<{ name: string; total: number; percentage: number }>
    salesByArea: Array<{ name: string; total: number; percentage: number }>
  }>({
    buyerWiseSales: [],
    productWiseSales: [],
    topBuyersTable: [],
    collectionSummary: { totalSales: 0, totalReceived: 0, pendingAmount: 0, collectionPercentage: 0, invoiceCount: 0 },
    buyerFilter: null,
    salesByCountry: [],
    salesByState: [],
    salesByCity: [],
    salesByArea: []
  })

  // Buyer filter from URL (source of truth)
  const buyerIdFromUrl = searchParams.get('buyerId')
  const buyerId = buyerIdFromUrl ? parseInt(buyerIdFromUrl) : null

  // Global Date Range Filter State
  const [dateFrom, setDateFrom] = useState<Date | null>(() => {
    const from = searchParams.get('from')
    return from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  })
  const [dateTo, setDateTo] = useState<Date | null>(() => {
    const to = searchParams.get('to')
    return to ? new Date(to) : new Date()
  })

  // Read period from URL for backward compatibility
  const validPeriods = ['week', 'month', 'lastMonth', 'quarter', 'year', 'custom']
  const urlPeriod = searchParams.get('period')
  const period = validPeriods.includes(urlPeriod || '') ? urlPeriod! : 'month'

  // Update URL and dates when period preset changes
  const handlePeriodChange = (newPeriod: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('period', newPeriod)

    const now = new Date()
    let newFrom: Date
    let newTo: Date = new Date()

    switch (newPeriod) {
      case 'week':
        newFrom = new Date(now)
        newFrom.setDate(now.getDate() - 7)
        break
      case 'month':
        newFrom = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'lastMonth':
        newFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        newTo = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'quarter':
        newFrom = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        break
      case 'year':
        newFrom = new Date(now.getFullYear(), 0, 1)
        break
      default:
        newFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    setDateFrom(newFrom)
    setDateTo(newTo)
    params.set('from', newFrom.toISOString().split('T')[0])
    params.set('to', newTo.toISOString().split('T')[0])
    setSearchParams(params, { replace: true })
  }

  // Apply custom date range
  const handleApplyDateRange = () => {
    if (dateFrom && dateTo) {
      const params = new URLSearchParams(searchParams)
      params.set('period', 'custom')
      params.set('from', dateFrom.toISOString().split('T')[0])
      params.set('to', dateTo.toISOString().split('T')[0])
      setSearchParams(params, { replace: true })
    }
  }

  // Set buyer filter - updates URL to filter dashboard
  const handleBuyerFilter = (buyerId: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('buyerId', buyerId.toString())
    setSearchParams(params, { replace: true })
  }

  // Clear buyer filter - removes buyerId from URL
  const handleClearBuyerFilter = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('buyerId')
    setSearchParams(params, { replace: true })
  }

  // Load stats
  const load = async () => {
    try {
      setLoading(true)

      // Build URL with date parameters for custom range
      let url = `/stats?period=${period}`
      if (dateFrom && dateTo) {
        const fromStr = dateFrom.toISOString().split('T')[0]
        const toStr = dateTo.toISOString().split('T')[0]
        url += `&from=${fromStr}&to=${toStr}`
      }
      // Add buyer filter if present
      if (buyerId) {
        url += `&buyerId=${buyerId}`
      }

      const { data } = await api.get<Stats>(url)
      setStats(data as any)
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load real-time invoice summary for accurate balance - with date range filter
  const loadInvoiceSummary = async () => {
    try {
      // Build URL with date parameters for period filtering
      let url = '/invoices/summary'
      const params = new URLSearchParams()

      if (dateFrom) {
        params.append('dateFrom', dateFrom.toISOString().split('T')[0])
      }
      if (dateTo) {
        params.append('dateTo', dateTo.toISOString().split('T')[0])
      }
      // Add buyer filter if present
      if (buyerId) {
        params.append('buyerId', buyerId.toString())
      }

      if (params.toString()) {
        url += `?${params.toString()}`
      }

      const { data } = await api.get(url)
      if (data) {
        setInvoiceSummary({
          totalSales: data.totalSales || 0,
          totalReceived: data.totalReceived || 0,
          totalBalance: data.totalBalance || 0,
          count: data.count || 0
        })
      }
    } catch (err) {
      // Try to calculate from invoices if summary endpoint not available
      try {
        const { data: invoices } = await api.get('/invoices')
        const items = Array.isArray(invoices) ? invoices : (invoices?.items || [])
        let totalSales = 0
        let totalReceived = 0

        // Filter by date range if set
        const filteredItems = items.filter((inv: any) => {
          if (!dateFrom && !dateTo) return true
          const invDate = new Date(inv.createdAt || inv.invoiceDate)
          if (dateFrom && invDate < dateFrom) return false
          if (dateTo && invDate > dateTo) return false
          return true
        })

        filteredItems.forEach((inv: any) => {
          totalSales += Number(inv.total || 0)
          const received = (inv.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
          totalReceived += received
        })
        setInvoiceSummary({
          totalSales,
          totalReceived,
          totalBalance: totalSales - totalReceived,
          count: filteredItems.length
        })
      } catch { }
    }
  }

  // Load analytics data (buyer-wise, product-wise sales, top buyers table)
  const loadAnalytics = async () => {
    try {
      const params = new URLSearchParams()
      params.append('period', period)
      if (dateFrom) params.append('from', dateFrom.toISOString().split('T')[0])
      if (dateTo) params.append('to', dateTo.toISOString().split('T')[0])
      // Add buyer filter if present
      if (buyerId) params.append('buyerId', buyerId.toString())

      const { data } = await api.get(`/dashboard/analytics?${params.toString()}`)
      if (data) {
        setAnalytics({
          buyerWiseSales: data.buyerWiseSales || [],
          productWiseSales: data.productWiseSales || [],
          topBuyersTable: data.topBuyersTable || [],
          collectionSummary: data.collectionSummary || { totalSales: 0, totalReceived: 0, pendingAmount: 0, collectionPercentage: 0, invoiceCount: 0 },
          buyerFilter: data.buyerFilter || null,
          // Location-wise sales
          salesByCountry: data.salesByCountry || [],
          salesByState: data.salesByState || [],
          salesByCity: data.salesByCity || [],
          salesByArea: data.salesByArea || []
        })
      }
    } catch (err) {
      console.error('Failed to load analytics:', err)
    }
  }

  // Save buyer
  const handleSaveBuyer = async () => {
    const newErrors: Record<string, string> = {}
    if (!buyerForm.name.trim()) newErrors.name = 'Name is required'
    if (!buyerForm.phone.trim()) newErrors.phone = 'Phone is required'

    if (Object.keys(newErrors).length > 0) {
      setBuyerFormErrors(newErrors)
      return
    }

    try {
      setSavingBuyer(true)
      await api.post('/buyers', {
        name: buyerForm.name,
        email: buyerForm.email,
        phone: buyerForm.phone,
        gstin: buyerForm.gstin,
        addressLine1: buyerForm.addressLine1,
        addressLine2: buyerForm.addressLine2,
        area: buyerForm.area,
        city: buyerForm.city,
        state: buyerForm.state,
        country: buyerForm.country,
        postalCode: buyerForm.postalCode
      })
      toast.success('Buyer added successfully!')
      setShowBuyerModal(false)
      setBuyerForm({
        name: '', email: '', phone: '', gstin: '',
        addressLine1: '', addressLine2: '', area: '',
        city: '', state: '', country: '', postalCode: ''
      })
      load() // Refresh stats
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add buyer')
    } finally {
      setSavingBuyer(false)
    }
  }

  // Load on mount, period change, date range change, or buyer filter change
  useEffect(() => {
    load()
    loadInvoiceSummary()
    loadAnalytics()
  }, [period, dateFrom, dateTo, buyerId])

  // Auto-refresh every 30 seconds for real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      loadInvoiceSummary()
    }, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Format chart data for display
  const chartData = useMemo(() => {
    return (stats.revenueByMonth || []).map(item => {
      let name = item.label
      if (item.label.includes('-') && item.label.length === 7) {
        const parts = item.label.split('-')
        name = parts[1] + '/' + parts[0].slice(2)
      }
      return { name, revenue: item.total }
    })
  }, [stats.revenueByMonth])

  // Calculate derived metrics - Use real-time invoice summary for accurate data matching Invoices page
  // invoiceSummary contains: totalSales, totalReceived, totalBalance, count from /invoices/summary
  const totalRevenue = invoiceSummary.totalSales || stats.totalRevenue || stats.totalSales || 0
  const receivedAmount = invoiceSummary.totalReceived || stats.receivedAmount || 0
  const balanceAmount = invoiceSummary.totalBalance || stats.balancePending || (totalRevenue - receivedAmount)
  const totalInvoices = invoiceSummary.count || stats.periodInvoicesCount || ((stats.paidInvoicesCount || 0) + (stats.unpaidInvoicesCount || 0) + (stats.partialInvoicesCount || 0) + stats.invoices.draft)

  // Pie chart data - Invoice Status Breakdown
  const invoiceStatusData = useMemo(() => [
    { name: 'Paid', value: stats.paidInvoicesCount || 0, color: '#22c55e' },
    { name: 'Partial', value: stats.partialInvoicesCount || 0, color: '#f59e0b' },
    { name: 'Unpaid', value: stats.unpaidInvoicesCount || 0, color: '#ef4444' },
    { name: 'Draft', value: stats.invoices.draft, color: '#94a3b8' }
  ].filter(d => d.value > 0), [stats])

  // Pie chart data - Entity Distribution
  const entityDistributionData = useMemo(() => [
    { name: 'Products', value: stats.totals.products, color: '#6366f1' },
    { name: 'Buyers', value: stats.totals.buyers, color: '#22c55e' },
    { name: 'Suppliers', value: stats.totals.suppliers, color: '#f59e0b' },
    { name: 'Users', value: stats.totals.users, color: '#8b5cf6' }
  ].filter(d => d.value > 0), [stats.totals])

  // Period label
  const periodLabels: Record<string, string> = {
    week: 'Last 7 Days',
    month: 'This Month',
    lastMonth: 'Last Month',
    quarter: 'Last 3 Months',
    year: 'This Year',
    custom: 'Custom Range'
  }

  return (
    <div className="space-y-6 bg-gray-50 min-h-screen -m-6 p-6">

      {/* ===== HEADER WITH GLOBAL DATE FILTER ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500">Business Analytics & Performance</p>
          </div>

          {/* Global Date Filter */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Period Presets */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              {['week', 'month', 'quarter', 'year'].map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${period === p
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  {p === 'week' ? 'Week' : p === 'month' ? 'Month' : p === 'quarter' ? 'Quarter' : 'Year'}
                </button>
              ))}
            </div>

            {/* Custom Date Range */}
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-400" />

              {/* From Date */}
              <div className="relative flex items-center">
                <DatePicker
                  selected={dateFrom}
                  onChange={(date) => setDateFrom(date)}
                  maxDate={dateTo || new Date()}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="From"
                  className="w-32 text-sm px-3 py-2 pr-8 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                />
                {dateFrom && (
                  <button
                    onClick={() => setDateFrom(null)}
                    className="absolute right-2 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Clear date"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <span className="text-gray-400">to</span>

              {/* To Date */}
              <div className="relative flex items-center">
                <DatePicker
                  selected={dateTo}
                  onChange={(date) => setDateTo(date)}
                  minDate={dateFrom || undefined}
                  maxDate={new Date()}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="To"
                  className="w-32 text-sm px-3 py-2 pr-8 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                />
                {dateTo && (
                  <button
                    onClick={() => setDateTo(null)}
                    className="absolute right-2 p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Clear date"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <button
                onClick={handleApplyDateRange}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Apply
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={load}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ===== BUYER FILTER INDICATOR ===== */}
      {analytics.buyerFilter && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-700 font-medium">
                Showing analytics for buyer:
              </p>
              <p className="text-lg font-bold text-purple-900">{analytics.buyerFilter.name}</p>
            </div>
          </div>
          <button
            onClick={handleClearBuyerFilter}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 hover:bg-purple-100 rounded-lg transition-colors"
          >
            <X size={16} />
            Clear Filter
          </button>
        </div>
      )}

      {/* ===== KPI CARDS ROW ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoices */}
        <div
          onClick={() => navigate('/invoices')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
              <FileText size={24} className="text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Invoices</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{totalInvoices}</div>
          <div className="text-sm text-gray-500">Total invoices • <span className="text-blue-600 font-medium">{periodLabels[period]}</span></div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-green-600">{stats.paidInvoicesCount || 0} Paid</span>
            <span className="text-amber-600">{stats.partialInvoicesCount || 0} Partial</span>
            <span className="text-gray-500">{stats.invoices.draft} Draft</span>
          </div>
        </div>

        {/* Total Sales */}
        <div
          onClick={() => navigate('/invoices?status=paid')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-green-200 transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
              <TrendingUp size={24} className="text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Sales</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{formatINR(totalRevenue)}</div>
          <div className="text-sm text-gray-500">Total sales amount</div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            {periodLabels[period] || 'This Month'}
          </div>
        </div>

        {/* Received Amount */}
        <div
          onClick={() => navigate('/payment-records')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-emerald-200 transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
              <Wallet size={24} className="text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Received</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{formatINR(receivedAmount)}</div>
          <div className="text-sm text-gray-500">Payment received • <span className="text-emerald-600 font-medium">{periodLabels[period]}</span></div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
            <span className="text-green-600">{totalRevenue > 0 ? ((receivedAmount / totalRevenue) * 100).toFixed(1) : '0.0'}% collected</span>
          </div>
        </div>

        {/* Balance/Pending */}
        <div
          onClick={() => navigate('/invoices?status=unpaid')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-amber-200 transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-100 rounded-xl group-hover:bg-amber-200 transition-colors">
              <IndianRupee size={24} className="text-amber-600" />
            </div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pending</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{formatINR(Math.max(0, balanceAmount))}</div>
          <div className="text-sm text-gray-500">Balance pending • <span className="text-amber-600 font-medium">{periodLabels[period]}</span></div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
            <span className="text-amber-600">{totalRevenue > 0 ? ((balanceAmount / totalRevenue) * 100).toFixed(1) : '0.0'}% pending</span>
          </div>
        </div>
      </div>

      {/* ===== CHARTS SECTION ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main Revenue Chart - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <BarChart3 size={20} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Revenue Trend</h2>
                <p className="text-sm text-gray-500">{periodLabels[period] || 'This Month'}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-indigo-600">{formatINR(totalRevenue)}</div>
              <div className="text-xs text-gray-500">Total Revenue</div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value) => [formatINR(Number(value || 0)), 'Revenue']}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invoice Status Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-lg">
              <PieChartIcon size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Invoice Status</h2>
              <p className="text-sm text-gray-500">Distribution by status</p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={invoiceStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {invoiceStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Invoices']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {invoiceStatusData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-gray-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== MULTI-DIMENSION ANALYTICS CHARTS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Buyer-wise Sales Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users size={18} className="text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Top Buyers</h3>
                <p className="text-xs text-gray-500">{periodLabels[period] || 'Selected Period'}</p>
              </div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.buyerWiseSales}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="total"
                  nameKey="name"
                  label={false}
                  labelLine={false}
                >
                  {analytics.buyerWiseSales.map((entry, index) => (
                    <Cell key={`buyer-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatINR(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4 max-h-32 overflow-y-auto">
            {analytics.buyerWiseSales.map((buyer, index) => (
              <div key={buyer.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></div>
                  <button
                    onClick={() => handleBuyerFilter(buyer.id)}
                    className="text-purple-600 hover:text-purple-800 hover:underline truncate max-w-[150px] text-left"
                    title={`Filter dashboard by ${buyer.name}`}
                  >
                    {buyer.name}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{buyer.percentage}%</span>
                  <span className="font-medium text-gray-900">{formatINR(buyer.total)}</span>
                </div>
              </div>
            ))}
            {analytics.buyerWiseSales.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No data for selected period</p>
            )}
          </div>
        </div>

        {/* Product-wise Sales Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Package size={18} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Top Products</h3>
                <p className="text-xs text-gray-500">{periodLabels[period] || 'Selected Period'}</p>
              </div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.productWiseSales}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="total"
                  nameKey="name"
                  label={false}
                  labelLine={false}
                >
                  {analytics.productWiseSales.map((entry, index) => (
                    <Cell key={`product-${index}`} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatINR(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4 max-h-32 overflow-y-auto">
            {analytics.productWiseSales.map((product, index) => (
              <div key={product.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[(index + 2) % CHART_COLORS.length] }}></div>
                  <span className="text-gray-700 truncate max-w-[150px]">{product.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{product.percentage}%</span>
                  <span className="font-medium text-gray-900">{formatINR(product.total)}</span>
                </div>
              </div>
            ))}
            {analytics.productWiseSales.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No data for selected period</p>
            )}
          </div>
        </div>
      </div>

      {/* ===== SECOND ROW CHARTS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Entity Distribution Pie */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users size={18} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Entities</h3>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={entityDistributionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={55}
                  dataKey="value"
                  label={false}
                >
                  {entityDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2">
            {entityDistributionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package size={18} className="text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Quick Stats</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Products</span>
              <span className="text-lg font-bold text-gray-900">{stats.totals.products}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Suppliers</span>
              <span className="text-lg font-bold text-gray-900">{stats.totals.suppliers}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Buyers</span>
              <span className="text-lg font-bold text-gray-900">{stats.totals.buyers}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Users</span>
              <span className="text-lg font-bold text-gray-900">{stats.totals.users}</span>
            </div>
          </div>
        </div>

        {/* Collection Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Wallet size={18} className="text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Collection</h3>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium text-gray-900">{totalRevenue > 0 ? ((receivedAmount / totalRevenue) * 100).toFixed(1) : '0.0'}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${totalRevenue > 0 ? Math.min((receivedAmount / totalRevenue) * 100, 100) : 0}%` }}
                ></div>
              </div>
            </div>
            <div className="pt-2 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Sales</span>
                <span className="font-medium">{formatINR(totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Received</span>
                <span className="font-medium text-green-600">{formatINR(receivedAmount)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-gray-500">Pending</span>
                <span className="font-medium text-amber-600">{formatINR(Math.max(0, balanceAmount))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Calendar size={18} className="text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Today</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-sm text-gray-600">Invoices</span>
              <span className="text-lg font-bold text-indigo-600">{stats.invoices.draft + (stats.paidInvoicesCount || 0)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-sm text-gray-600">Revenue</span>
              <span className="text-lg font-bold text-green-600">{formatINR(totalRevenue)}</span>
            </div>
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0]
                navigate(`/invoices?from=${today}&to=${today}`)
              }}
              className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              View Daybook →
            </button>
          </div>
        </div>
      </div>

      {/* ===== LOCATION-WISE SALES CHARTS (2x2 Grid) ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Country-wise Sales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Sales by Country</h3>
              <p className="text-xs text-gray-500">{periodLabels[period] || 'Selected Period'}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-1/2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.salesByCountry}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="total"
                    nameKey="name"
                    label={false}
                  >
                    {analytics.salesByCountry.map((_, index) => (
                      <Cell key={`country-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatINR(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-1.5 max-h-40 overflow-y-auto">
              {analytics.salesByCountry.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></div>
                    <span className="text-gray-700 truncate max-w-[80px]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{item.percentage}%</span>
                    <span className="font-medium text-gray-900">{formatINR(item.total)}</span>
                  </div>
                </div>
              ))}
              {analytics.salesByCountry.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No data</p>
              )}
            </div>
          </div>
        </div>

        {/* State-wise Sales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <MapPin size={18} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Sales by State</h3>
              <p className="text-xs text-gray-500">{periodLabels[period] || 'Selected Period'}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-1/2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.salesByState}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="total"
                    nameKey="name"
                    label={false}
                  >
                    {analytics.salesByState.map((_, index) => (
                      <Cell key={`state-${index}`} fill={CHART_COLORS[(index + 1) % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatINR(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-1.5 max-h-40 overflow-y-auto">
              {analytics.salesByState.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[(index + 1) % CHART_COLORS.length] }}></div>
                    <span className="text-gray-700 truncate max-w-[80px]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{item.percentage}%</span>
                    <span className="font-medium text-gray-900">{formatINR(item.total)}</span>
                  </div>
                </div>
              ))}
              {analytics.salesByState.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No data</p>
              )}
            </div>
          </div>
        </div>

        {/* City-wise Sales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 size={18} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Sales by City</h3>
              <p className="text-xs text-gray-500">{periodLabels[period] || 'Selected Period'}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-1/2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.salesByCity}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="total"
                    nameKey="name"
                    label={false}
                  >
                    {analytics.salesByCity.map((_, index) => (
                      <Cell key={`city-${index}`} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatINR(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-1.5 max-h-40 overflow-y-auto">
              {analytics.salesByCity.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[(index + 2) % CHART_COLORS.length] }}></div>
                    <span className="text-gray-700 truncate max-w-[80px]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{item.percentage}%</span>
                    <span className="font-medium text-gray-900">{formatINR(item.total)}</span>
                  </div>
                </div>
              ))}
              {analytics.salesByCity.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No data</p>
              )}
            </div>
          </div>
        </div>

        {/* Area-wise Sales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Map size={18} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Sales by Area</h3>
              <p className="text-xs text-gray-500">{periodLabels[period] || 'Selected Period'}</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-1/2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.salesByArea}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="total"
                    nameKey="name"
                    label={false}
                  >
                    {analytics.salesByArea.map((_, index) => (
                      <Cell key={`area-${index}`} fill={CHART_COLORS[(index + 3) % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatINR(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-1.5 max-h-40 overflow-y-auto">
              {analytics.salesByArea.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[(index + 3) % CHART_COLORS.length] }}></div>
                    <span className="text-gray-700 truncate max-w-[80px]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{item.percentage}%</span>
                    <span className="font-medium text-gray-900">{formatINR(item.total)}</span>
                  </div>
                </div>
              ))}
              {analytics.salesByArea.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No data</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== TOP BUYERS ANALYTICS TABLE ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users size={18} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Top Buyers Analytics</h3>
              <p className="text-xs text-gray-500">{periodLabels[period] || 'Selected Period'} • Sorted by Total Sales</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/buyers')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View All Buyers →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">#</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Buyer Name</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Invoices</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Total Sales</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Pending Balance</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topBuyersTable.map((buyer, index) => (
                <tr key={buyer.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleBuyerFilter(buyer.id)}
                      className="font-medium text-purple-600 hover:text-purple-800 hover:underline text-left"
                      title={`Filter dashboard by ${buyer.buyerName}`}
                    >
                      {buyer.buyerName}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {buyer.totalInvoices}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-green-600">{formatINR(buyer.totalSales)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${buyer.pendingBalance > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {buyer.pendingBalance > 0 ? formatINR(buyer.pendingBalance) : '₹0'}
                    </span>
                  </td>
                </tr>
              ))}
              {analytics.topBuyersTable.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No buyer data for selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {analytics.topBuyersTable.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-500">Showing top {analytics.topBuyersTable.length} buyers</span>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">
                Total: <span className="font-semibold text-gray-900">{formatINR(analytics.topBuyersTable.reduce((sum, b) => sum + b.totalSales, 0))}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ===== ANALYTICS TABLES ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Products Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Package size={18} className="text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Recent Products</h3>
            </div>
            <button
              onClick={() => navigate('/products')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Product</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Price</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Stock</th>
                </tr>
              </thead>
              <tbody>
                {(stats.recentProducts || []).slice(0, 5).map((p, i) => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{p.title}</td>
                    <td className="py-3 px-4 text-gray-600">{p.supplier?.name || '-'}</td>
                    <td className="py-3 px-4 text-right text-green-600 font-semibold">{formatINR(p.price)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.stock > 50 ? 'bg-green-100 text-green-700' :
                        p.stock > 10 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                        {p.stock}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp size={18} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/invoices/new')}
              className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl text-white text-left transition-all hover:shadow-lg"
            >
              <FileText size={24} className="mb-2" />
              <div className="font-semibold">New Invoice</div>
              <div className="text-xs opacity-80">Create a sale</div>
            </button>
            <button
              onClick={() => navigate('/products/new')}
              className="p-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl text-white text-left transition-all hover:shadow-lg"
            >
              <Package size={24} className="mb-2" />
              <div className="font-semibold">Add Product</div>
              <div className="text-xs opacity-80">New inventory</div>
            </button>
            <button
              onClick={() => setShowBuyerModal(true)}
              className="p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-xl text-white text-left transition-all hover:shadow-lg"
            >
              <Users size={24} className="mb-2" />
              <div className="font-semibold">Add Buyer</div>
              <div className="text-xs opacity-80">New customer</div>
            </button>
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0]
                navigate(`/invoices?from=${today}&to=${today}&report=daybook`)
              }}
              className="p-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl text-white text-left transition-all hover:shadow-lg"
            >
              <Calendar size={24} className="mb-2" />
              <div className="font-semibold">Daybook</div>
              <div className="text-xs opacity-80">Today's report</div>
            </button>
          </div>
        </div>
      </div>

      {/* ===== ADD BUYER MODAL ===== */}
      {showBuyerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users size={20} className="text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Add New Buyer</h2>
              </div>
              <button
                onClick={() => setShowBuyerModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={buyerForm.name}
                  onChange={(e) => setBuyerForm({ ...buyerForm, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${buyerFormErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter buyer name"
                />
                {buyerFormErrors.name && <p className="text-red-500 text-xs mt-1">{buyerFormErrors.name}</p>}
              </div>

              {/* Phone & Email Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={buyerForm.phone}
                    onChange={(e) => setBuyerForm({ ...buyerForm, phone: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${buyerFormErrors.phone ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Phone number"
                  />
                  {buyerFormErrors.phone && <p className="text-red-500 text-xs mt-1">{buyerFormErrors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={buyerForm.email}
                    onChange={(e) => setBuyerForm({ ...buyerForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Email address"
                  />
                </div>
              </div>

              {/* GSTIN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={buyerForm.gstin}
                  onChange={(e) => setBuyerForm({ ...buyerForm, gstin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="GST Number (optional)"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={buyerForm.addressLine1}
                  onChange={(e) => setBuyerForm({ ...buyerForm, addressLine1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Street address"
                />
              </div>

              {/* City, State Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={buyerForm.city}
                    onChange={(e) => setBuyerForm({ ...buyerForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={buyerForm.state}
                    onChange={(e) => setBuyerForm({ ...buyerForm, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="State"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowBuyerModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBuyer}
                disabled={savingBuyer}
                className="px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {savingBuyer ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Buyer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
