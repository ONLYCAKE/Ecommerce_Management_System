import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { formatINR } from '../utils/currency'
import { io } from 'socket.io-client'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'

type Stats = {
  totals: { users: number; suppliers: number; buyers: number; products: number }
  invoices: { draft: number; completed: number }
  revenueByMonth: Array<{ label: string; total: number }>
  recentProducts: Array<{ id: number; title: string; supplier?: { name?: string }; price: number; stock: number; createdAt: string | Date }>
  totalSales?: number
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    totals: { users: 0, suppliers: 0, buyers: 0, products: 0 },
    invoices: { draft: 0, completed: 0 },
    revenueByMonth: [],
    recentProducts: [],
    totalSales: 0
  })
  const [period, setPeriod] = useState<string>('month')

  const load = async () => {
    try {
      const { data } = await api.get<Stats>(`/stats?period=${period}`)
      setStats(data as any)
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [period])
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000')
    socket.on('invoice.created', load)
    socket.on('invoice.updated', load)
    socket.on('invoice.deleted', load)
    socket.on('invoice.completed', load)
    return () => { socket.disconnect() }
  }, [])

  // Format chart data for better display
  const chartData = stats.revenueByMonth.map(item => ({
    name: item.label.split('-')[1] + '/' + item.label.split('-')[0].slice(2),
    revenue: item.total
  }))

  // Calculate total revenue from chart data
  const totalRevenue = stats.revenueByMonth.reduce((sum, m) => sum + m.total, 0)

  const cards = [
    { title: 'Total Users', value: stats.totals.users, icon: '👥', color: 'from-blue-500 to-blue-600' },
    { title: 'Suppliers', value: stats.totals.suppliers, icon: '🏭', color: 'from-green-500 to-green-600' },
    { title: 'Buyers', value: stats.totals.buyers, icon: '🛒', color: 'from-purple-500 to-purple-600' },
    { title: 'Products', value: stats.totals.products, icon: '📦', color: 'from-orange-500 to-orange-600' },
    { title: 'Invoices (Draft)', value: stats.invoices.draft, icon: '📝', color: 'from-yellow-500 to-yellow-600' },
    { title: 'Invoices (Completed)', value: stats.invoices.completed, icon: '✅', color: 'from-teal-500 to-teal-600' },
  ]

  const handleSaleReport = () => {
    // Navigate to invoices with period filter
    const today = new Date()
    let startDate = new Date()

    if (period === 'week') {
      startDate.setDate(today.getDate() - 7)
    } else if (period === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    } else if (period === 'lastMonth') {
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      today.setDate(0) // Last day of previous month
    } else if (period === 'quarter') {
      startDate.setMonth(today.getMonth() - 3)
    } else if (period === 'year') {
      startDate = new Date(today.getFullYear(), 0, 1)
    }

    navigate(`/invoices?status=all&from=${startDate.toISOString().split('T')[0]}&to=${today.toISOString().split('T')[0]}`)
  }

  const handleDaybookReport = () => {
    // Use local date format (YYYY-MM-DD) to avoid timezone issues
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    navigate(`/invoices?from=${today}&to=${today}&report=daybook`)
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c, i) => (
          <div
            key={i}
            className={`bg-gradient-to-br ${c.color} rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{c.icon}</span>
            </div>
            <div className="text-3xl font-bold mb-1">{c.value}</div>
            <div className="text-sm opacity-90">{c.title}</div>
          </div>
        ))}
      </div>

      {/* Period Selector & Total Sales */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-gray-600 font-medium">Period:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="quarter">Quarter (3 Months)</option>
            <option value="year">This Year</option>
          </select>
        </div>

        <div className="flex items-center gap-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl px-6 py-3 text-white shadow-lg">
            <div className="text-sm opacity-90">Total Revenue</div>
            <div className="text-2xl font-bold">{formatINR(totalRevenue)}</div>
          </div>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">📊 Sales Analytics</h2>
          <div className="text-sm text-gray-500">Last 12 Months Revenue</div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => [formatINR(Number(value || 0)), 'Revenue']}
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Report Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleSaleReport}
          className="group bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <div className="text-lg font-bold mb-1">📈 Sale Report</div>
              <div className="text-sm opacity-90">View detailed sales invoices for selected period</div>
            </div>
            <div className="text-3xl group-hover:translate-x-2 transition-transform">→</div>
          </div>
        </button>

        <button
          onClick={handleDaybookReport}
          className="group bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="text-left">
              <div className="text-lg font-bold mb-1">📅 Daybook Report</div>
              <div className="text-sm opacity-90">View today's transactions and activities</div>
            </div>
            <div className="text-3xl group-hover:translate-x-2 transition-transform">→</div>
          </div>
        </button>
      </div>

      {/* Recent Products */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">🛍️ Recent Products</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Title</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Supplier</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Price</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Stock</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recentProducts || []).map((p, i) => (
                <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                  <td className="py-3 px-4 font-medium text-gray-800">{p.title}</td>
                  <td className="py-3 px-4 text-gray-600">{p.supplier?.name || '-'}</td>
                  <td className="py-3 px-4 text-green-600 font-semibold">{formatINR(p.price)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.stock > 50 ? 'bg-green-100 text-green-700' :
                      p.stock > 10 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500">{new Date(p.createdAt as any).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
