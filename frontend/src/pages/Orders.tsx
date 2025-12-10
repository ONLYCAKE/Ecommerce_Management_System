import { useEffect, useState } from 'react'
import api from '../api/client'
import { formatINR } from '../utils/currency'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface OrderItem { id: number; invoiceNo: string; createdAt: string; buyer?: { name: string }; supplier?: { name: string }; status: 'Draft' | 'Processing' | 'Completed'; total: number }

export default function Orders() {
  const [items, setItems] = useState<OrderItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const navigate = useNavigate()

  const load = async () => { const { data } = await api.get('/orders'); setItems(data) }
  useEffect(() => { load() }, [])

  useEffect(() => {
    const socket = io((import.meta as any).env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000')
    socket.on('invoice.created', load)
    socket.on('invoice.updated', load)
    socket.on('invoice.deleted', load)
    socket.on('invoice.completed', load)
    return () => { socket.disconnect() }
  }, [])

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Invoices</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Rows</label>
          <select className="input w-20" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[3, 5, 10, 20].map(n => (<option key={n} value={n}>{n}</option>))}
          </select>
        </div>
      </div>

      <div className="card p-4">
        <table className="table text-center">
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              <th>Buyer</th>
              <th>Supplier</th>
              <th>Status</th>
              <th>Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-500 py-6">No invoices found</td></tr>
            ) : (
              items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize).map(inv => (
                <tr key={inv.id} className="border-t hover:bg-[rgba(255,255,255,0.05)] transition-all">
                  <td className="font-mono text-sm">{inv.invoiceNo}</td>
                  <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td>{inv.buyer?.name}</td>
                  <td>{inv.supplier?.name}</td>
                  <td>
                    <span className={`px-3 py-1 rounded-full text-xs ${inv.status === 'Draft' ? 'bg-yellow-500/20 text-yellow-300' : inv.status === 'Processing' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}>{inv.status}</span>
                  </td>
                  <td>{formatINR(inv.total)}</td>
                  <td className="text-center">
                    <button className="btn-primary text-sm" onClick={() => previewPdf(inv.invoiceNo)}>View / Download</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {items.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Page {page} of {Math.max(1, Math.ceil(items.length / pageSize))}
              </span>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page >= Math.ceil(items.length / pageSize)}
                onClick={() => setPage(p => Math.min(Math.ceil(items.length / pageSize) || 1, p + 1))}
              >
                <ChevronRight size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page >= Math.ceil(items.length / pageSize)}
                onClick={() => setPage(Math.max(1, Math.ceil(items.length / pageSize)))}
              >
                <ChevronsRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
