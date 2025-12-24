import { useEffect, useState, useMemo } from 'react'
import api from '../api/client'
import { formatINR } from '../utils/currency'
import { useNavigate } from 'react-router-dom'
import { FileText, Package, DollarSign, TrendingUp, Eye, Edit } from 'lucide-react'
import SummaryCards, { SummaryCard } from '../components/common/SummaryCards'
import DataTable, { Column } from '../components/common/DataTable'
import { useTableSort, useTablePagination } from '../hooks/useTableFeatures'
import TableActions, { ActionButton } from '../components/common/TableActions'
import StatusBadge from '../components/common/StatusBadge'

interface OrderItem {
  id: number
  invoiceNo: string
  createdAt: string
  buyer?: { name: string }
  supplier?: { name: string }
  status: 'Draft' | 'Processing' | 'Completed'
  total: number
}

export default function Orders() {
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/invoices')
      setItems(Array.isArray(data) ? data : (data?.items || []))
    } catch (err) {
      console.error('Failed to load invoices:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const previewPdf = async (invNo: string) => {
    try {
      const url = (api.defaults.baseURL || '') + '/invoices/generate/' + invNo
      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      if (!res.ok) throw new Error('Failed to fetch invoice PDF')
      const blob = await res.blob()
      const fileURL = URL.createObjectURL(blob)
      window.open(fileURL, '_blank')
    } catch (err) {
      console.error('Error opening invoice PDF:', err)
      alert('⚠️ Unable to preview invoice. Please try again.')
    }
  }

  // Apply sorting
  const { sortColumn, sortDirection, handleSort, sortedData } = useTableSort(items)

  // Pagination
  const { currentPage, pageSize, paginatedData, setPage, setPageSize } = useTablePagination(sortedData, 10)

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const totalOrders = items.length
    const totalAmount = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
    const draftCount = items.filter(item => item.status === 'Draft').length
    const processingCount = items.filter(item => item.status === 'Processing').length
    const completedCount = items.filter(item => item.status === 'Completed').length

    return { totalOrders, totalAmount, draftCount, processingCount, completedCount }
  }, [items])

  // Summary cards
  const summaryCards: SummaryCard[] = [
    {
      title: 'Total Orders',
      value: summaryMetrics.totalOrders,
      icon: FileText,
      color: 'blue',
      subtitle: 'All invoices'
    },
    {
      title: 'Total Amount',
      value: formatINR(summaryMetrics.totalAmount),
      icon: DollarSign,
      color: 'green',
      subtitle: 'Combined value'
    },
    {
      title: 'Processing',
      value: summaryMetrics.processingCount,
      icon: Package,
      color: 'orange',
      subtitle: 'In progress'
    },
    {
      title: 'Completed',
      value: summaryMetrics.completedCount,
      icon: TrendingUp,
      color: 'purple',
      subtitle: 'Finished orders'
    }
  ]

  // Define table columns
  const columns: Column<OrderItem>[] = [
    {
      key: 'invoiceNo',
      label: 'Invoice No',
      sortable: true,
      align: 'left',
      render: (row: OrderItem) => (
        <span className="font-mono text-sm font-semibold text-gray-900">{row.invoiceNo}</span>
      )
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      align: 'left',
      render: (row: OrderItem) => (
        <span className="text-gray-700">
          {new Date(row.createdAt).toLocaleDateString('en-GB')}
        </span>
      )
    },
    {
      key: 'buyer',
      label: 'Buyer',
      sortable: false,
      align: 'left',
      render: (row: OrderItem) => (
        <span className="text-gray-700">{row.buyer?.name || '-'}</span>
      )
    },
    {
      key: 'supplier',
      label: 'Supplier',
      sortable: false,
      align: 'left',
      render: (row: OrderItem) => (
        <span className="text-gray-700">{row.supplier?.name || '-'}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (row: OrderItem) => {
        const statusVariant =
          row.status === 'Completed' ? 'success' :
            row.status === 'Processing' ? 'info' : 'warning'

        return <StatusBadge label={row.status} variant={statusVariant} size="sm" />
      }
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      align: 'right',
      render: (row: OrderItem) => (
        <span className="font-semibold text-gray-900">{formatINR(row.total)}</span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row: OrderItem) => {
        const actions: ActionButton[] = [
          {
            label: 'View PDF',
            icon: Eye,
            onClick: () => previewPdf(row.invoiceNo),
            color: 'purple',
            show: true
          },
          {
            label: 'Edit',
            icon: Edit,
            onClick: () => navigate(`/invoices/${row.invoiceNo}/edit`),
            color: 'blue',
            show: row.status === 'Draft'
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

      {/* Page Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Orders / Invoices</h2>
        </div>
      </div>

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
        emptyMessage="No orders found"
        loading={loading}
      />
    </div>
  )
}
