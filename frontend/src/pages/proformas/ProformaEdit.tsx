import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../api/client'
import CustomerSelect from '../../components/invoice/CustomerSelect'
import ProductSearch from '../../components/invoice/ProductSearch'
import InvoiceTable, { ColumnVisibility } from '../../components/invoice/InvoiceTable'
import ExtraChargesPanel, { ExtraCharge } from '../../components/invoice/ExtraChargesPanel'
import NotesPanel from '../../components/invoice/NotesPanel'
import SignaturePanel from '../../components/invoice/SignaturePanel'
import { InvoiceItem, useInvoiceTotals } from '../../hooks/useInvoiceTotals'
import { toast } from 'react-hot-toast'
import type { Buyer } from '../../types/models'

interface Product {
  id: number
  title: string
  price: number
  stock: number
  hsnCode?: string
  taxType?: 'withTax' | 'withoutTax'
  taxRate?: number
}

export default function ProformaEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [buyer, setBuyer] = useState<Buyer | null>(null)
  const [proformaDate, setProformaDate] = useState<string>('')
  const [validTill, setValidTill] = useState<string>('')
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [extraChargesEnabled, setExtraChargesEnabled] = useState(false)
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([])
  const [notesEnabled, setNotesEnabled] = useState(false)
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    hsn: true,
    qty: true,
    unitPrice: true,
    discount: true,
    tax: true,
    total: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const totals = useInvoiceTotals(items, { buyerState: buyer?.state })

  useEffect(() => {
    const load = async () => {
      if (!id) return
      try {
        setLoading(true)
        const { data } = await api.get(`/proforma-invoices/${id}`)
        setBuyer(data.buyer || null)
        setProformaDate(data.proformaDate ? new Date(data.proformaDate).toISOString().split('T')[0] : '')
        setValidTill(data.validTill ? new Date(data.validTill).toISOString().split('T')[0] : '')
        setNotes(data.notes || '')
        setTerms(data.terms || '')
        setSignature(data.signature ?? null)
        if (Array.isArray(data.extraCharges) && data.extraCharges.length > 0) {
          setExtraChargesEnabled(true)
          setExtraCharges(data.extraCharges)
        }
        if (Array.isArray(data.items)) {
          const mapped: InvoiceItem[] = data.items.map((it: any) => ({
            id: (it.id || Math.random()).toString(),
            productId: it.productId,
            title: it.title,
            description: it.description || '',
            qty: it.qty,
            unitPrice: it.price,
            discount: it.discountPct || 0,
            taxRate: it.gst || 0,
            uom: 'Pcs',
            hsnCode: it.hsnCode || '',
          }))
          setItems(mapped)
        }
      } catch (err: any) {
        console.error('Failed to load proforma:', err)
        toast.error(err.response?.data?.message || 'Failed to load proforma invoice')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  const handleAddProduct = (product: Product, qty: number) => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      productId: product.id,
      title: product.title,
      qty,
      unitPrice: product.price,
      taxRate: product.taxType === 'withTax' ? (product.taxRate ?? 18) : 0,
      discount: 0,
      uom: 'Pcs',
      hsnCode: product.hsnCode || '',
    }
    setItems(prev => [...prev, newItem])
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!buyer) errs.buyer = 'Please select a buyer'
    if (items.length === 0) errs.items = 'Please add at least one item'
    if (!proformaDate) errs.proformaDate = 'Proforma date is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!id) return
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        buyerId: buyer!.id,
        proformaDate,
        validTill: validTill || undefined,
        items: items.map(it => ({
          productId: it.productId,
          title: it.title,
          description: it.description,
          qty: it.qty,
          price: it.unitPrice,
          gst: it.taxRate,
          discountPct: it.discount,
          hsnCode: it.hsnCode,
          amount: 0,
        })),
        notes: notesEnabled ? notes : undefined,
        terms: terms || undefined,
        extraCharges: extraChargesEnabled && extraCharges.length > 0
          ? extraCharges.filter(c => c.name && c.amount > 0)
          : undefined,
        signature: signature || undefined,
      }

      await api.put(`/proforma-invoices/${id}`, payload)
      toast.success('Proforma invoice updated')
      navigate(`/proformas/${id}`)
    } catch (err: any) {
      console.error('Failed to update proforma:', err)
      toast.error(err.response?.data?.message || 'Failed to update proforma')
    } finally {
      setSaving(false)
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/proformas')}
              className="text-gray-600 hover:text-gray-900 mb-1 flex items-center gap-2"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Edit Proforma Invoice</h1>
            <p className="text-sm text-gray-600 mt-1">PROFORMA (Not a Tax Invoice)</p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {errors.general && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {errors.general}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <CustomerSelect value={buyer} onChange={setBuyer} />
          {errors.buyer && <p className="text-red-600 text-sm mt-2">{errors.buyer}</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-indigo-700">Proforma Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proforma Date *</label>
              <input
                type="date"
                className="input w-full"
                value={proformaDate}
                onChange={e => setProformaDate(e.target.value)}
              />
              {errors.proformaDate && <p className="text-red-600 text-sm mt-1">{errors.proformaDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid Till</label>
              <input
                type="date"
                className="input w-full"
                value={validTill}
                onChange={e => setValidTill(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Terms (Optional)</label>
              <input
                type="text"
                className="input w-full"
                value={terms}
                onChange={e => setTerms(e.target.value)}
                placeholder="Payment / delivery terms"
              />
            </div>
          </div>
        </div>

        <ProductSearch
          onAdd={handleAddProduct}
          onNavigateToCreate={() => navigate('/products/new')}
        />

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-indigo-700">Proforma Line Items</h3>
          </div>
          <InvoiceTable
            items={items}
            onChange={setItems}
            perLineTotals={totals.perLineTotals}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
          />
          {errors.items && <p className="text-red-600 text-sm mt-2">{errors.items}</p>}
        </div>

        <ExtraChargesPanel
          charges={extraCharges}
          onChange={setExtraCharges}
          enabled={extraChargesEnabled}
          onToggle={setExtraChargesEnabled}
        />

        <NotesPanel
          notes={notes}
          onChange={setNotes}
          enabled={notesEnabled}
          onToggle={setNotesEnabled}
        />

        <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <SignaturePanel signature={signature} onChange={setSignature} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 text-right">Proforma Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-gray-800">₹{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Tax (approx.)</span>
                  <span>₹{(totals.cgst + totals.sgst + totals.igst).toFixed(2)}</span>
                </div>
                {extraChargesEnabled && extraCharges.length > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Extra Charges</span>
                    <span className="text-amber-600">₹{extraCharges.reduce((s, c) => s + (c.amount || 0), 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-gray-300">
                  <span className="font-semibold text-gray-800">Estimated Total</span>
                  <span className="font-bold text-lg text-indigo-600">
                    ₹{(totals.grandTotal + (extraChargesEnabled ? extraCharges.reduce((s, c) => s + (c.amount || 0), 0) : 0)).toFixed(2)}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500 text-right">
                This is a Proforma Invoice and does not represent a final tax invoice or recorded sale.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
