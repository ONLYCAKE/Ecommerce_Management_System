import { useEffect, useMemo, useState, FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { io } from 'socket.io-client'
import { formatINR } from '../utils/currency'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface Buyer { id: number; name: string }
interface Product { id: number; title: string; price: number }
interface InvoiceItemForm { productId: number | string; title: string; description: string; qty: number | string; price: number | string; gst: number | string; discountPct: number | string }
interface InvoiceForm { invoiceNo: string; date: string; buyerId: string; paymentMethod: string; lines: InvoiceItemForm[]; serviceCharge: number | string }

export default function Invoices() {
  const navigate = useNavigate()
  const [items, setItems] = useState<any[]>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [show, setShow] = useState(false)
  const [editingInvNo, setEditingInvNo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Processing' | 'Completed'>('All')
  const [toast, setToast] = useState<string | null>(null)
  const { user } = useAuth()
  const location = useLocation()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const canCreate = useMemo(() => (user?.permissions || []).includes('invoice.create') || user?.role === 'SuperAdmin', [user])

  const load = async () => {
    const qs = statusFilter !== 'All' ? `?status=${statusFilter}` : ''
    const { data } = await api.get('/invoices' + qs)
    setItems(data)
  }
  useEffect(() => { load() }, [statusFilter])

  useEffect(() => {
    (async () => {
      const [b, p] = await Promise.all([api.get('/buyers'), api.get('/products')])
      setBuyers(b.data)
      setProducts(p.data)
    })()
  }, [])

  useEffect(() => {
    const socket = io((import.meta as any).env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000')
    socket.on('invoice.created', load)
    socket.on('invoice.updated', load)
    socket.on('invoice.deleted', load)
    socket.on('invoice.completed', load)
    return () => { socket.disconnect() }
  }, [])

  useEffect(() => { const params = new URLSearchParams(location.search); if (params.get('new') === '1') setShow(true) }, [location])

  useEffect(() => { (async () => { if (!show) return; try { if (!editingInvNo) { const { data } = await api.get('/invoices/next-no'); setForm(f => ({ ...f, invoiceNo: f.invoiceNo || data.invoiceNo })) } } catch { } })() }, [show])

  const [form, setForm] = useState<InvoiceForm>({ invoiceNo: '', date: new Date().toISOString().slice(0, 10), buyerId: '', paymentMethod: 'Cash', lines: [{ productId: '', title: '', description: '', qty: 1, price: 0, gst: 0, discountPct: 0 }], serviceCharge: 0 })

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { productId: '', title: '', description: '', qty: 1, price: 0, gst: 0, discountPct: 0 }] }))
  const updateLine = (i: number, patch: Partial<InvoiceItemForm>) => setForm(f => ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }))
  const removeLine = (i: number) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))

  const computedTotal = useMemo(() => {
    const itemsTotal = form.lines.reduce((s, l) => {
      const price = Number(l.price) || 0
      const qty = Number(l.qty) || 0
      const gst = Number(l.gst) || 0
      const disc = Number(l.discountPct) || 0
      const line = price * qty * (1 - disc / 100) * (1 + gst / 100)
      return s + line
    }, 0)
    return itemsTotal + (Number(form.serviceCharge) || 0)
  }, [form])

  const validateInvoice = () => {
    const errs: string[] = []
    if (!form.buyerId) errs.push('Buyer is required')
    const validLines = (form.lines || []).filter(l => (l.productId || l.title) && Number(l.qty) > 0)
    if (validLines.length === 0) errs.push('At least one valid line item is required')
    if (!editingInvNo && !form.invoiceNo) errs.push('Invoice No is required')
    return { ok: errs.length === 0, errs, validLines }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const { ok, errs, validLines } = validateInvoice()
      if (!ok) { const msg = `Validation failed: ${errs.join(', ')}`; setToast(`⚠️ ${msg}`); setTimeout(() => setToast(null), 2200); return }

      const itemsPayload = validLines.map(l => ({ productId: l.productId ? Number(l.productId) : undefined, title: l.title, description: l.description, qty: Number(l.qty), price: Number(l.price), gst: Number(l.gst), discountPct: Number(l.discountPct) || 0, amount: (Number(l.price) || 0) * (Number(l.qty) || 0) * (1 - (Number(l.discountPct) || 0) / 100) * (1 + (Number(l.gst) || 0) / 100) }))

      const payloadBase = { buyerId: Number(form.buyerId), paymentMethod: form.paymentMethod, serviceCharge: Number(form.serviceCharge) || 0 }

      if (editingInvNo) { const payload = { ...payloadBase, items: itemsPayload }; await api.put(`/invoices/${editingInvNo}`, payload) }
      else { const payload = { ...payloadBase, invoiceNo: form.invoiceNo, status: 'Processing', items: itemsPayload }; await api.post('/invoices', payload) }

      handleClose(); setEditingInvNo(''); setToast('✅ Invoice successfully saved!'); setTimeout(() => setToast(null), 2500); load()
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Unknown error'
      setToast(`⚠️ Save failed: ${message}`)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const markCompleted = async (invNo: string) => { await api.post(`/invoices/mark-complete/${invNo}`); setToast('✅ Invoice marked as Completed'); setTimeout(() => setToast(null), 1800); load() }

  const downloadPdf = async (invNo: string) => {
    try {
      const url = (api.defaults.baseURL || '') + `/invoices/${invNo}/download`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      if (!res.ok) throw new Error('Failed to fetch invoice PDF')
      const blob = await res.blob(); const fileURL = URL.createObjectURL(blob); window.open(fileURL, '_blank')
    } catch (err) { setToast('⚠️ Unable to preview invoice.'); setTimeout(() => setToast(null), 2000) }
  }

  const startEdit = (inv: any) => {
    if (inv.status === 'Completed') return
    setEditingInvNo(inv.invoiceNo)
    setForm({ invoiceNo: inv.invoiceNo, date: new Date(inv.createdAt).toISOString().slice(0, 10), buyerId: String(inv.buyerId || ''), paymentMethod: inv.paymentMethod || 'Cash', serviceCharge: inv.serviceCharge || 0, lines: (inv.items || []).map((it: any) => ({ productId: it.productId || '', title: it.title || '', description: it.description || '', qty: it.qty, price: it.price, gst: it.gst, discountPct: it.discountPct || 0 })) })
    setShow(true)
  }

  const handleClose = () => { setShow(false); window.history.replaceState({}, '', '/invoices') }

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select className="input w-40 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'All' | 'Draft' | 'Processing' | 'Completed')}>
            <option value="All">All</option>
            <option value="Draft">Draft</option>
            <option value="Processing">Processing</option>
            <option value="Completed">Completed</option>
          </select>
          <label className="text-sm font-medium text-gray-700">Rows</label>
          <select className="input w-20 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {[3, 5, 10, 20].map(n => (<option key={n} value={n}>{n}</option>))}
          </select>
          {canCreate && (<button onClick={() => navigate('/invoices/new')} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all">+ Create Invoice</button>)}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-gray-200">
            <tr>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">No</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Buyer</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="pb-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
              <th className="pb-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(items || []).length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-500 py-8">No invoices found</td></tr>
            ) : (
              items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize).map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 font-mono text-blue-600 font-medium">{inv.invoiceNo}</td>
                  <td className="py-4 text-gray-600">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="py-4 text-gray-900 font-medium">{inv.buyer?.name}</td>
                  <td className="py-4 text-gray-600">{inv.supplier?.name}</td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${inv.status === 'Draft' ? 'bg-yellow-100 text-yellow-700' : inv.status === 'Processing' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{inv.status}</span>
                  </td>
                  <td className="py-4 text-right font-semibold text-gray-900">{formatINR(inv.total)}</td>
                  <td className="py-4 text-center space-x-2">
                    {inv.status === 'Completed' ? (
                      <button onClick={() => downloadPdf(inv.invoiceNo)} className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">View / Download</button>
                    ) : (
                      <>
                        <button onClick={() => navigate(`/invoices/${inv.invoiceNo}/edit`)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition">Edit</button>
                        <button onClick={() => markCompleted(inv.invoiceNo)} className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">Complete</button>
                      </>
                    )}
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

      {show && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[var(--card-bg)] text-[var(--text)] w-full max-w-3xl rounded-2xl shadow-2xl p-6 relative overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-gray-700 pb-3 mb-4">
              <h2 className="text-xl font-bold tracking-wider">{editingInvNo ? 'Edit Invoice' : 'Create Invoice'}</h2>
              <button onClick={handleClose} className="btn-secondary">✕ Close</button>
            </div>

            <form onSubmit={save} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Invoice No</label>
                  <input className="w-full mt-1 bg-transparent border border-gray-600 rounded-lg p-2" value={form.invoiceNo} onChange={(e) => setForm(f => ({ ...f, invoiceNo: e.target.value }))} required disabled={!!editingInvNo} />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Date</label>
                  <input type="date" className="w-full mt-1 bg-transparent border border-gray-600 rounded-lg p-2" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Payment Method</label>
                  <select className="w-full mt-1 bg-transparent border border-gray-600 rounded-lg p-2" value={form.paymentMethod} onChange={(e) => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Card</option>
                    <option>NetBanking</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400">Buyer</label>
                <select className="w-full mt-1 bg-transparent border border-gray-600 rounded-lg p-2" value={form.buyerId} onChange={(e) => setForm(f => ({ ...f, buyerId: e.target.value }))} required>
                  <option value="">Select buyer</option>
                  {buyers.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Products</h3>
                  <button type="button" onClick={addLine} className="btn-primary">+ Add Row</button>
                </div>
                {form.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end bg-[rgba(255,255,255,0.05)] p-3 rounded-xl">
                    <div className="col-span-3">
                      <label className="text-xs text-gray-400">Product</label>
                      <select className="w-full bg-transparent border border-gray-700 rounded-md p-1" value={l.productId} onChange={(e) => {
                        const prod = products.find(p => p.id === Number(e.target.value))
                        updateLine(i, { productId: e.target.value, title: prod ? prod.title : l.title, price: prod ? prod.price : l.price })
                      }}>
                        <option value="">Select</option>
                        {products.map(p => (<option key={p.id} value={p.id}>{p.title}</option>))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-gray-400">Description</label>
                      <input className="w-full bg-transparent border border-gray-700 rounded-md p-1" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-400">Qty</label>
                      <input type="number" className="w-full bg-transparent border border-gray-700 rounded-md p-1 text-center" value={l.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-400">Price</label>
                      <input type="number" className="w-full bg-transparent border border-gray-700 rounded-md p-1 text-center" value={l.price} onChange={(e) => updateLine(i, { price: e.target.value })} />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-400">GST%</label>
                      <select className="w-full bg-transparent border border-gray-700 rounded-md p-1 text-center" value={l.gst} onChange={(e) => updateLine(i, { gst: e.target.value })}>
                        {[0, 5, 12, 18, 28].map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-400">Discount %</label>
                      <input type="number" className="w-full bg-transparent border border-gray-700 rounded-md p-1 text-center" value={l.discountPct} onChange={(e) => updateLine(i, { discountPct: e.target.value })} />
                    </div>
                    <div className="col-span-1">
                      <button type="button" onClick={() => removeLine(i)} className="btn-danger w-full text-sm">✕</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-700 mt-4">
                <div className="text-gray-400 text-sm">Service Charge</div>
                <input type="number" step="0.01" className="bg-transparent border border-gray-600 rounded-md p-2 w-24 text-center" value={form.serviceCharge} onChange={(e) => setForm(f => ({ ...f, serviceCharge: e.target.value }))} />
              </div>
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total</span>
                <span>{formatINR(computedTotal)}</span>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-700">
                <button type="button" onClick={handleClose} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingInvNo ? 'Update Invoice' : 'Save Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (<div className="fixed bottom-5 right-5 bg-green-600 text-white px-4 py-2 rounded-lg shadow-md animate-bounce">{toast}</div>)}
    </div>
  )
}
