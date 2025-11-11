import { useEffect, useState } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { formatINR } from '../utils/currency'
import { useConfirm } from '../context/ConfirmContext'

export default function Projects(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const confirmModal = useConfirm()

  const load = async ()=>{
    setLoading(true)
    try{
      const { data } = await api.get('/api/projects')
      setItems(data)
    } finally { setLoading(false) }
  }
  useEffect(()=>{ load() },[])

  const updateStatus = async (id, status) => {
    const ok = await confirmModal({ title: `Mark as ${status}?`, description: 'This will update the project status.' })
    if (!ok) return
    await api.patch(`/api/projects/${id}/status`, { status })
    load()
  }

  const generateInvoice = async (id) => {
    // download PDF with auth header
    const res = await api.get(`/api/invoice/generate/${id}`, { responseType: 'blob' })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${id}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  const canAct = ['SuperAdmin','Admin','Employee'].includes(user.role)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Projects</h1>
      </div>
      <div className="card p-4">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Buyer</th>
              <th>Supplier</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!items || items.length===0) && !loading && (
              <tr><td colSpan={7} className="text-center text-sm text-gray-500 py-6">No projects found.</td></tr>
            )}
            {items.map(p => (
              <tr key={p.id} className="border-t">
                <td className="font-medium">{p.title}</td>
                <td>{p.category || '-'}</td>
                <td>{p.buyer?.name || '-'}</td>
                <td>{p.supplier?.name || '-'}</td>
                <td>{formatINR(p.price)}</td>
                <td><span className="badge">{p.status}</span></td>
                <td className="space-x-2">
                  {canAct && (
                    <>
                      <button className="btn btn-secondary" onClick={()=>updateStatus(p.id,'PENDING')}>Pending</button>
                      <button className="btn btn-secondary" onClick={()=>updateStatus(p.id,'PROCESSING')}>Processing</button>
                      <button className="btn btn-secondary" onClick={()=>updateStatus(p.id,'COMPLETED')}>Completed</button>
                      <button className="btn" onClick={()=>generateInvoice(p.id)}>Invoice</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
