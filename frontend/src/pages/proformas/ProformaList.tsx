import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { toast } from 'react-hot-toast'
import { FileText, DollarSign, TrendingUp, CheckCircle, Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import SummaryCards, { SummaryCard } from '../../components/common/SummaryCards'
import DataTable, { Column } from '../../components/common/DataTable'
import { useTableSort } from '../../hooks/useTableFeatures'
import { useUrlPagination } from '../../hooks/useUrlPagination'
import TableActions, { ActionButton } from '../../components/common/TableActions'
import StatusBadge from '../../components/common/StatusBadge'
import { formatINR } from '../../utils/currency'

export default function ProformaList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [summaryData, setSummaryData] = useState({
    totalProformas: 0,
    totalAmount: 0,
    draftCount: 0,
    convertedCount: 0
  })

  const load = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/proforma-invoices')
      const proformasList = Array.isArray(data) ? data : (data?.items || [])
      setItems(proformasList)

      // Calculate summary
      const totalProformas = proformasList.length
      const totalAmount = proformasList.reduce((sum: number, pf: any) => sum + (Number(pf.total) || 0), 0)
      const draftCount = proformasList.filter((pf: any) => pf.status === 'Draft').length
      const convertedCount = proformasList.filter((pf: any) => pf.status === 'Converted').length

      setSummaryData({ totalProformas, totalAmount, draftCount, convertedCount })
    } catch (err) {
      console.error('Failed to load proforma invoices:', err)
      toast.error('Failed to load proforma invoices')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this draft proforma? This cannot be undone.')) return
    try {
      await api.delete(`/proforma-invoices/${id}`)
      toast.success('Proforma deleted')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete proforma')
    }
  }

  // Apply sorting
  const { sortColumn, sortDirection, handleSort, sortedData } = useTableSort(items)

  // Pagination - URL-based
  const { page, pageSize, setPage, setPageSize } = useUrlPagination(1, 10)

  // Calculate pagination manually
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1
  const start = (page - 1) * pageSize
  const paginatedData = sortedData.slice(start, start + pageSize)
  const currentPage = page

  // Summary cards
  const summaryCards: SummaryCard[] = [
    {
      title: 'Total Proformas',
      value: summaryData.totalProformas,
      icon: FileText,
      color: 'indigo',
      subtitle: 'All proforma invoices'
    },
    {
      title: 'Total Amount',
      value: formatINR(summaryData.totalAmount),
      icon: DollarSign,
      color: 'blue',
      subtitle: 'Combined value'
    },
    {
      title: 'Draft',
      value: summaryData.draftCount,
      icon: Pencil,
      color: 'orange',
      subtitle: 'Pending conversion'
    },
    {
      title: 'Converted',
      value: summaryData.convertedCount,
      icon: CheckCircle,
      color: 'green',
      subtitle: 'To invoices'
    }
  ]

  // Define table columns
  const columns: Column<any>[] = [
    {
      key: 'proformaDate',
      label: 'Date',
      sortable: true,
      align: 'left',
      render: (row: any) => (
        <span className="text-gray-700">
          {new Date(row.proformaDate || row.createdAt).toLocaleDateString('en-GB')}
        </span>
      )
    },
    {
      key: 'proformaNo',
      label: 'Proforma No',
      sortable: true,
      align: 'left',
      render: (row: any) => (
        <span className="font-semibold text-gray-900">{row.proformaNo}</span>
      )
    },
    {
      key: 'buyer',
      label: 'Buyer',
      sortable: false,
      align: 'left',
      render: (row: any) => (
        <span className="text-gray-700">{row.buyer?.name || 'N/A'}</span>
      )
    },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      align: 'right',
      render: (row: any) => (
        <span className="font-semibold text-gray-900">{formatINR(Number(row.total) || 0)}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (row: any) => {
        const statusVariant =
          row.status === 'Converted' ? 'success' :
            row.status === 'Cancelled' ? 'error' : 'gray'

        return <StatusBadge label={row.status} variant={statusVariant} size="sm" />
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row: any) => {
        const actions: ActionButton[] = [
          {
            label: 'View',
            icon: Eye,
            onClick: () => navigate(`/proformas/${row.id}`),
            color: 'purple',
            show: true
          },
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => navigate(`/proformas/${row.id}/edit`),
            color: 'blue',
            show: row.status === 'Draft'
          },
          {
            label: 'Delete',
            icon: Trash2,
            onClick: () => handleDelete(row.id),
            color: 'red',
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

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Could add filters here */}
          <div className="flex items-center gap-3 flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Proforma Invoices</h2>
          </div>

          {/* Right side - Create Button */}
          <button
            onClick={() => navigate('/proformas/new')}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <Plus size={18} strokeWidth={1.8} />
            Create Proforma
          </button>
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
        emptyMessage="No proforma invoices found"
        isLoading={loading}
      />
    </div>
  )
}
