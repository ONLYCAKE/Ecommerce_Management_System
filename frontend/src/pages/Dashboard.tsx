import { useEffect, useState } from 'react'
import api from '../api/client'
import { formatINR } from '../utils/currency'
import { io } from 'socket.io-client'

type Stats = {
  totals: { users: number; suppliers: number; buyers: number; products: number }
  invoices: { draft: number; completed: number }
  revenueByMonth: Array<{ label: string; total: number }>
  recentProducts: Array<{ id: number; title: string; supplier?: { name?: string }; price: number; stock: number; createdAt: string | Date }>
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totals: { users: 0, suppliers: 0, buyers: 0, products: 0 },
    invoices: { draft: 0, completed: 0 },
    revenueByMonth: [],
    recentProducts: []
  })

  const load = async () => {
    try {
      const { data } = await api.get<Stats>('/stats')
      setStats(data as any)
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000')
    socket.on('invoice.created', load)
    socket.on('invoice.updated', load)
    socket.on('invoice.deleted', load)
    socket.on('invoice.completed', load)
    return () => { socket.disconnect() }
  }, [])

  const cards = [
    { title: 'Total Users', value: stats.totals.users },
    { title: 'Suppliers', value: stats.totals.suppliers },
    { title: 'Buyers', value: stats.totals.buyers },
    { title: 'Products', value: stats.totals.products },
    { title: 'Invoices (Draft)', value: stats.invoices.draft },
    { title: 'Invoices (Completed)', value: stats.invoices.completed },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <div key={i} className="card p-5 flex flex-col gap-4 text-center">
            <div className="font-heading text-lg text-text">{c.title}</div>
            <div className="text-2xl font-semibold text-primary">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg">Recent Products</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="text-left">Title</th>
                <th className="text-left">Supplier</th>
                <th className="text-left">Price</th>
                <th className="text-left">Stock</th>
                <th className="text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recentProducts || []).map((p) => (
                <tr key={p.id} className="border-t text-left">
                  <td>{p.title}</td>
                  <td>{p.supplier?.name || '-'}</td>
                  <td>{formatINR(p.price)}</td>
                  <td>{p.stock}</td>
                  <td>{new Date(p.createdAt as any).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
