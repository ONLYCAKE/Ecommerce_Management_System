import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, IndianRupee, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

interface PaymentRecord {
    id: number
    invoiceNo: string
    paymentDate: string
    paidAmount: number
    remainingBalance: number
    paymentMethod: string
    reference: string
    addedBy: string
    invoiceTotal: number
    invoiceStatus: string
}

type SortField = 'paymentDate' | 'paidAmount' | 'remainingBalance' | 'invoiceNo'
type SortDirection = 'asc' | 'desc'

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(amount)
}

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || ''
    if (statusLower === 'paid' || statusLower === 'completed') {
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Paid</span>
    } else if (statusLower === 'partial' || statusLower === 'processing') {
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Partial</span>
    } else {
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Unpaid</span>
    }
}

const getMethodBadge = (method: string) => {
    const methodLower = method?.toLowerCase() || ''
    const colors: Record<string, string> = {
        cash: 'bg-emerald-100 text-emerald-700',
        upi: 'bg-purple-100 text-purple-700',
        bank: 'bg-blue-100 text-blue-700',
        card: 'bg-indigo-100 text-indigo-700',
        cheque: 'bg-orange-100 text-orange-700',
        online: 'bg-cyan-100 text-cyan-700'
    }
    const colorClass = colors[methodLower] || 'bg-gray-100 text-gray-700'
    return (
        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
            {method || 'N/A'}
        </span>
    )
}

export default function PaymentRecords() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [payments, setPayments] = useState<PaymentRecord[]>([])
    const [error, setError] = useState('')

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [methodFilter, setMethodFilter] = useState<string>('all')

    // Sorting
    const [sortField, setSortField] = useState<SortField>('paymentDate')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

    // Pagination
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    // Fetch payment records
    useEffect(() => {
        const fetchPayments = async () => {
            try {
                setLoading(true)
                const { data } = await api.get('/payments/records')
                setPayments(data || [])
                setError('')
            } catch (err: any) {
                console.error('Failed to fetch payment records:', err)
                setError(err.response?.data?.message || 'Failed to load payment records')
            } finally {
                setLoading(false)
            }
        }
        fetchPayments()
    }, [])

    // Get unique methods for filter dropdown
    const uniqueMethods = useMemo(() => {
        const methods = new Set(payments.map(p => p.paymentMethod).filter(Boolean))
        return Array.from(methods).sort()
    }, [payments])

    // Filtered and sorted data
    const filteredAndSorted = useMemo(() => {
        let result = [...payments]

        // Search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase()
            result = result.filter(p =>
                p.invoiceNo?.toLowerCase().includes(term) ||
                p.reference?.toLowerCase().includes(term) ||
                p.paymentMethod?.toLowerCase().includes(term) ||
                p.addedBy?.toLowerCase().includes(term)
            )
        }

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(p => {
                const status = p.invoiceStatus?.toLowerCase() || ''
                if (statusFilter === 'paid') return status === 'paid' || status === 'completed'
                if (statusFilter === 'partial') return status === 'partial' || status === 'processing'
                if (statusFilter === 'unpaid') return status === 'unpaid' || status === 'draft' || status === 'pending'
                return true
            })
        }

        // Method filter
        if (methodFilter !== 'all') {
            result = result.filter(p => p.paymentMethod?.toLowerCase() === methodFilter.toLowerCase())
        }

        // Sorting
        result.sort((a, b) => {
            let comparison = 0
            switch (sortField) {
                case 'paymentDate':
                    comparison = new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
                    break
                case 'paidAmount':
                    comparison = a.paidAmount - b.paidAmount
                    break
                case 'remainingBalance':
                    comparison = a.remainingBalance - b.remainingBalance
                    break
                case 'invoiceNo':
                    comparison = (a.invoiceNo || '').localeCompare(b.invoiceNo || '')
                    break
            }
            return sortDirection === 'asc' ? comparison : -comparison
        })

        return result
    }, [payments, searchTerm, statusFilter, methodFilter, sortField, sortDirection])

    // Pagination
    const totalPages = Math.ceil(filteredAndSorted.length / pageSize)
    const paginatedData = useMemo(() => {
        const start = (page - 1) * pageSize
        return filteredAndSorted.slice(start, start + pageSize)
    }, [filteredAndSorted, page, pageSize])

    // Reset page when filters change
    useEffect(() => {
        setPage(1)
    }, [searchTerm, statusFilter, methodFilter, pageSize])

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('desc')
        }
    }

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) return <ArrowUpDown size={14} className="text-gray-400" />
        return sortDirection === 'asc'
            ? <ArrowUp size={14} className="text-blue-600" />
            : <ArrowDown size={14} className="text-blue-600" />
    }

    // Summary stats
    const stats = useMemo(() => {
        const totalPaid = filteredAndSorted.reduce((sum, p) => sum + p.paidAmount, 0)
        const totalRemaining = filteredAndSorted.reduce((sum, p) => sum + (p.remainingBalance || 0), 0)
        return { totalPaid, totalRemaining, count: filteredAndSorted.length }
    }, [filteredAndSorted])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading payment records...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Payment Records</h1>
                    <p className="text-sm text-gray-500 mt-1">View and search all payment transactions</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-green-100">
                            <IndianRupee className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Collected</p>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-amber-100">
                            <IndianRupee className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Pending Balance</p>
                            <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.totalRemaining)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-blue-100">
                            <Calendar className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Records</p>
                            <p className="text-2xl font-bold text-blue-600">{stats.count}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[250px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by Invoice No, Reference, Method, or Added By..."
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500  bg-white"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="paid">Paid</option>
                        <option value="partial">Partial</option>
                        <option value="unpaid">Unpaid</option>
                    </select>

                    {/* Method Filter */}
                    <select
                        className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                        value={methodFilter}
                        onChange={(e) => setMethodFilter(e.target.value)}
                    >
                        <option value="all">All Methods</option>
                        {uniqueMethods.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                <th
                                    className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('invoiceNo')}
                                >
                                    <div className="flex items-center gap-2">
                                        Invoice No
                                        {getSortIcon('invoiceNo')}
                                    </div>
                                </th>
                                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Status
                                </th>
                                <th
                                    className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('paymentDate')}
                                >
                                    <div className="flex items-center gap-2">
                                        Payment Date
                                        {getSortIcon('paymentDate')}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('paidAmount')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Paid Amount
                                        {getSortIcon('paidAmount')}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('remainingBalance')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Balance
                                        {getSortIcon('remainingBalance')}
                                    </div>
                                </th>
                                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Method
                                </th>
                                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Reference
                                </th>
                                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Added By
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <IndianRupee className="h-12 w-12 text-gray-300" />
                                            <p className="font-medium">No payment records found</p>
                                            <p className="text-sm">Try adjusting your search or filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <button
                                                onClick={() => navigate(`/invoices/${payment.invoiceNo}/edit`)}
                                                className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                                            >
                                                {payment.invoiceNo}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {getStatusBadge(payment.invoiceStatus)}
                                        </td>
                                        <td className="px-4 py-3.5 text-gray-700">
                                            {formatDate(payment.paymentDate)}
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <span className="font-semibold text-green-600">
                                                {formatCurrency(payment.paidAmount)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <span className={`font-medium ${payment.remainingBalance > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                                                {formatCurrency(payment.remainingBalance)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {getMethodBadge(payment.paymentMethod)}
                                        </td>
                                        <td className="px-4 py-3.5 text-gray-600 text-sm">
                                            {payment.reference || '-'}
                                        </td>
                                        <td className="px-4 py-3.5 text-gray-600 text-sm">
                                            {payment.addedBy}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredAndSorted.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-end gap-4">
                            {/* Rows per page */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-600">Rows per page:</label>
                                <select
                                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>

                            {/* Page info and navigation */}
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600">
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-40 transition"
                                    disabled={page === 1}
                                    onClick={() => setPage(1)}
                                >
                                    <ChevronsLeft size={18} className="text-gray-700" />
                                </button>
                                <button
                                    className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-40 transition"
                                    disabled={page === 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft size={18} className="text-gray-700" />
                                </button>
                                <button
                                    className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-40 transition"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                >
                                    <ChevronRight size={18} className="text-gray-700" />
                                </button>
                                <button
                                    className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-40 transition"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(totalPages)}
                                >
                                    <ChevronsRight size={18} className="text-gray-700" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
