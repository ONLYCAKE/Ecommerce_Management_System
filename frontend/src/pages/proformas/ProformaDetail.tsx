import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../api/client'
import { toast } from 'react-hot-toast'

export default function ProformaDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [proforma, setProforma] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)

  const load = async () => {
    if (!id) return
    try {
      setLoading(true)
      const { data } = await api.get(`/proforma-invoices/${id}`)
      setProforma(data)
    } catch (err: any) {
      console.error('Failed to load proforma invoice:', err)
      toast.error(err.response?.data?.message || 'Failed to load proforma invoice')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const handleConvert = async () => {
    if (!id) return
    if (!window.confirm('Convert this proforma into a draft invoice?')) return
    try {
      setConverting(true)
      const { data } = await api.post(`/proforma-invoices/${id}/convert`)
      toast.success('Proforma converted to draft invoice')
      const invoiceNo = data.invoice?.invoiceNo
      if (invoiceNo) {
        navigate(`/invoices/${invoiceNo}/edit`)
      } else {
        navigate('/invoices')
      }
    } catch (err: any) {
      console.error('Failed to convert proforma:', err)
      toast.error(err.response?.data?.message || 'Failed to convert proforma')
    } finally {
      setConverting(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!id) return
    try {
      const response = await api.get(`/proforma-invoices/${id}/pdf`, {
        responseType: 'arraybuffer',
      })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err: any) {
      console.error('Failed to open proforma PDF:', err)
      toast.error(err.response?.data?.message || 'Failed to open proforma PDF')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-gray-600">
          <div className="h-8 w-8 rounded-full border-b-2 border-indigo-600 animate-spin" />
          <span>Loading proforma invoice...</span>
        </div>
      </div>
    )
  }

  if (!proforma) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate('/proformas')}
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to Proformas
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Proforma invoice not found.
        </div>
      </div>
    )
  }

  const totalExtraCharges = Array.isArray(proforma.extraCharges)
    ? proforma.extraCharges.reduce((s: number, c: any) => s + (c.amount || 0), 0)
    : 0

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/proformas')}
            className="text-gray-600 hover:text-gray-900 mb-1 flex items-center gap-2"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Proforma Invoice
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
              PROFORMA (Not a Tax Invoice)
            </span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">{proforma.proformaNo}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            onClick={handleDownloadPdf}
            className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            View PDF
          </button>
          {proforma.status !== 'Converted' && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
            >
              {converting ? 'Converting...' : 'Convert to Invoice'}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Buyer Details</h2>
            <div className="text-sm text-gray-700 space-y-1">
              <div className="font-semibold">{proforma.buyer?.name}</div>
              {proforma.buyer?.email && <div>{proforma.buyer.email}</div>}
              {proforma.buyer?.phone && <div>{proforma.buyer.phone}</div>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Line Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Item</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">Price</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">GST %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {proforma.items?.map((it: any, idx: number) => (
                    <tr key={it.id || idx}>
                      <td className="px-3 py-2 text-gray-600">{idx + 1}</td>
                      <td className="px-3 py-2 text-gray-800">
                        <div className="font-medium">{it.title}</div>
                        {it.description && (
                          <div className="text-xs text-gray-500">{it.description}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">{it.qty}</td>
                      <td className="px-3 py-2 text-right text-gray-700">₹{Number(it.price || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{Number(it.gst || 0).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
                {proforma.items?.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-200 text-xs sm:text-sm">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right font-semibold text-gray-700">Items Subtotal</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">
                        ₹{proforma.items.reduce((sum: number, it: any) => sum + (Number(it.qty || 0) * Number(it.price || 0)), 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2" />
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right font-semibold text-gray-700">Items GST (approx.)</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">
                        ₹{proforma.items.reduce((sum: number, it: any) => {
                          const lineSubtotal = Number(it.qty || 0) * Number(it.price || 0)
                          const gstPct = Number(it.gst || 0)
                          return sum + (lineSubtotal * gstPct) / 100
                        }, 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Proforma Date</dt>
                <dd className="text-gray-800">{new Date(proforma.proformaDate).toLocaleDateString('en-IN')}</dd>
              </div>
              {proforma.validTill && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">Valid Till</dt>
                  <dd className="text-gray-800">{new Date(proforma.validTill).toLocaleDateString('en-IN')}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-600">Status</dt>
                <dd className="font-semibold text-gray-900">{proforma.status}</dd>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                <dt className="font-semibold text-gray-800">Estimated Total</dt>
                <dd className="font-bold text-lg text-indigo-600">₹{Number((proforma.total || 0) + totalExtraCharges).toFixed(2)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-gray-500">
              This is a Proforma Invoice and does not represent a final tax invoice or recorded sale.
            </p>
          </div>

          {proforma.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Notes</h2>
              <p className="text-sm text-gray-700 whitespace-pre-line">{proforma.notes}</p>
            </div>
          )}

          {proforma.terms && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Terms</h2>
              <p className="text-sm text-gray-700 whitespace-pre-line">{proforma.terms}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
