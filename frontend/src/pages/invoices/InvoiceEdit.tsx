import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../api/client'
import CustomerSelect from '../../components/invoice/CustomerSelect'
import ProductSearch from '../../components/invoice/ProductSearch'
import InvoiceTable from '../../components/invoice/InvoiceTable'
import TotalsPanel from '../../components/invoice/TotalsPanel'
import PaymentPanel from '../../components/invoice/PaymentPanel'
import SignaturePanel from '../../components/invoice/SignaturePanel'
import { InvoiceItem, useInvoiceTotals } from '../../hooks/useInvoiceTotals'

interface Customer {
    id: number
    name: string
    email: string
    phone: string
    addressLine1?: string
    addressLine2?: string
    area?: string
    city?: string
    state?: string
    country?: string
    postalCode?: string
}

interface Product {
    id: number
    title: string
    description?: string
    price: number
    stock: number
    hsnCode?: string
    taxType?: 'withTax' | 'withoutTax'
    taxRate?: number
}

interface Payment {
    id?: string
    amount: number
    mode: string
    notes: string
}

export default function InvoiceEdit() {
    const { invoiceNo } = useParams<{ invoiceNo: string }>()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [invoiceDate, setInvoiceDate] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [reference, setReference] = useState('')
    const [customer, setCustomer] = useState<Customer | null>(null)
    const [items, setItems] = useState<InvoiceItem[]>([])
    const [globalDiscountPct, setGlobalDiscountPct] = useState(0)
    const [notes, setNotes] = useState('')
    const [payments, setPayments] = useState<Payment[]>([])
    const [signature, setSignature] = useState('')
    const [errors, setErrors] = useState<Record<string, string>>({})

    const totals = useInvoiceTotals(items, customer?.state || '', globalDiscountPct)
    const isSameState = customer?.state === 'Gujarat'

    // Load invoice data
    useEffect(() => {
        const loadInvoice = async () => {
            try {
                const { data } = await api.get(`/invoices/${invoiceNo}`)

                // Set basic fields
                const loadedInvoiceDate = data.invoiceDate ? new Date(data.invoiceDate).toISOString().split('T')[0] : ''
                const loadedDueDate = data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : ''

                // Auto-fill invoice date with current date if empty
                if (!loadedInvoiceDate) {
                    const now = new Date()
                    const localDate = now.toISOString().split('T')[0] // YYYY-MM-DD format
                    setInvoiceDate(localDate)
                } else {
                    setInvoiceDate(loadedInvoiceDate)
                }

                setDueDate(loadedDueDate)
                setReference(data.reference || '')
                setNotes(data.notes || '')
                setGlobalDiscountPct(data.globalDiscountPct || 0)

                // Set customer
                if (data.buyer) {
                    setCustomer(data.buyer)
                }

                // Set items
                if (data.items && data.items.length > 0) {
                    const invoiceItems: InvoiceItem[] = data.items.map((item: any) => ({
                        id: item.id?.toString() || Math.random().toString(),
                        productId: item.productId,
                        title: item.title,
                        description: item.description || '',
                        qty: item.qty,
                        unitPrice: item.price,
                        discount: item.discountPct || 0,
                        taxRate: item.gst || 0,
                        uom: item.uom || ''
                    }))
                    setItems(invoiceItems)
                }

                // Set payments (if available)
                if (data.payments && data.payments.length > 0) {
                    setPayments(data.payments)
                }

                // Set signature (if available)
                if (data.signature) {
                    setSignature(data.signature)
                }

                setLoading(false)
            } catch (err) {
                console.error('Error loading invoice:', err)
                setErrors({ general: 'Failed to load invoice' })
                setLoading(false)
            }
        }

        if (invoiceNo) {
            loadInvoice()
        }
    }, [invoiceNo])

    const handleAddProduct = (product: Product, qty: number) => {
        const newItem: InvoiceItem = {
            id: Date.now().toString(),
            productId: product.id,
            title: product.title,
            qty,
            unitPrice: product.price,
            // AUTO-APPLY product's tax configuration
            taxRate: product.taxType === 'withTax' ? (product.taxRate !== undefined ? product.taxRate : 18) : 0,
            discount: 0,
            uom: 'Pcs',
            hsnCode: product.hsnCode || ''
        }
        setItems([...items, newItem])
    }

    const validate = () => {
        const errs: Record<string, string> = {}
        if (!customer) errs.customer = 'Please select a customer'
        if (items.length === 0) errs.items = 'Please add at least one item'
        if (!invoiceDate) errs.invoiceDate = 'Invoice date is required'
        if (!dueDate) errs.dueDate = 'Due date is required'
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    const handleSave = async (status: 'Draft' | 'Processing' | 'Completed', print = false) => {
        console.log('💾 Update clicked with status:', status, 'print:', print)

        if (!validate()) {
            console.log('❌ Validation failed:', JSON.stringify(errors, null, 2))
            alert(`Validation failed:\n${Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join('\n')}`)
            return
        }

        setSaving(true)
        try {
            const payload = {
                buyerId: customer!.id,
                invoiceDate,
                dueDate,
                reference,
                status,
                items: items.map(item => ({
                    productId: item.productId,
                    title: item.title,
                    description: item.description,
                    qty: item.qty,
                    price: item.unitPrice,
                    gst: item.taxRate,
                    discountPct: item.discount
                })),
                notes,
                paymentMethod: payments.length > 0 ? payments[0].mode : 'Cash',
                serviceCharge: 0,
                signature: signature || null
            }

            console.log('📤 Sending update payload:', payload)
            const { data } = await api.put(`/invoices/${invoiceNo}`, payload)
            console.log('✅ Invoice updated:', data)

            if (print) {
                window.open(`/api/invoices/generate/${invoiceNo}`, '_blank')
                navigate('/invoices')
            } else {
                navigate('/invoices')
            }
        } catch (err: any) {
            console.error('❌ Error updating invoice:', err)
            console.error('Error response:', err.response?.data)
            alert(`Failed to update invoice: ${err.response?.data?.message || err.message}`)
            setErrors({ general: err.response?.data?.message || 'Failed to update invoice' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading invoice...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <button
                                onClick={() => navigate('/invoices')}
                                className="text-gray-600 hover:text-gray-900 mb-2 flex items-center gap-2"
                            >
                                ← Back
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">Edit Invoice</h1>
                            <p className="text-sm text-gray-600 mt-1">Invoice No: {invoiceNo}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleSave('Draft')}
                                disabled={saving}
                            >
                                Save as Draft
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleSave('Processing', true)}
                                disabled={saving}
                            >
                                Save & Print
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => handleSave('Processing')}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save →'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                {errors.general && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                        {errors.general}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column (2/3 width) */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Customer Selection */}
                        <div className="card p-6">
                            <CustomerSelect
                                value={customer}
                                onChange={setCustomer}
                            />
                            {errors.customer && <p className="text-red-600 text-sm mt-2">{errors.customer}</p>}
                        </div>

                        {/* Invoice Meta */}
                        <div className="card p-6">
                            <h3 className="font-semibold text-gray-800 mb-4">Invoice Details</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Invoice Date *
                                    </label>
                                    <input
                                        type="date"
                                        className="input w-full"
                                        value={invoiceDate}
                                        onChange={(e) => setInvoiceDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Due Date *
                                    </label>
                                    <input
                                        type="date"
                                        className="input w-full"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Reference
                                    </label>
                                    <input
                                        type="text"
                                        className="input w-full"
                                        value={reference}
                                        onChange={(e) => setReference(e.target.value)}
                                        placeholder="PO number, etc."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Product Search */}
                        <ProductSearch
                            onAdd={handleAddProduct}
                            onNavigateToCreate={() => navigate('/products/new')}
                        />

                        {/* Invoice Table */}
                        <div className="card p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-gray-800">Items</h3>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-gray-600">Global Discount %:</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        className="input w-20 text-sm"
                                        value={globalDiscountPct}
                                        onChange={(e) => setGlobalDiscountPct(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                            <InvoiceTable
                                items={items}
                                onChange={setItems}
                                perLineTotals={totals.perLineTotals}
                            />
                            {errors.items && <p className="text-red-600 text-sm mt-2">{errors.items}</p>}
                        </div>

                        {/* Terms & Conditions */}
                        <div className="card p-6">
                            <h3 className="font-semibold text-gray-800 mb-3">Terms & Conditions</h3>
                            <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm text-gray-700 space-y-2">
                                <p className="font-medium">Terms And Conditions</p>
                                <p>1) Goods once sold will not be taken back or exchange.</p>
                                <p>2) We are not responsible for damage, shortage or breakage after despatched from our premises.</p>
                                <p>3) We are not responsible for given guarantee or warranty by the principle of electric & electronics items.</p>
                                <p>4) Subject to Ahmedabad Jurisdiction. [E&OE]</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (1/3 width - Sticky) */}
                    <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                        {/* Totals Panel */}
                        <TotalsPanel totals={totals} isSameState={isSameState} />

                        {/* Payment Panel */}
                        <PaymentPanel
                            payments={payments}
                            onChange={setPayments}
                            grandTotal={totals.grandTotal}
                        />

                        {/* Signature Panel */}
                        <SignaturePanel signature={signature} onChange={setSignature} />

                        {/* Save Buttons (Duplicate for sticky sidebar) */}
                        <div className="space-y-2">
                            <button
                                type="button"
                                className="btn-secondary w-full"
                                onClick={() => handleSave('Draft')}
                                disabled={saving}
                            >
                                Save as Draft
                            </button>
                            <button
                                type="button"
                                className="btn-secondary w-full"
                                onClick={() => handleSave('Processing', true)}
                                disabled={saving}
                            >
                                Save & Print
                            </button>
                            <button
                                type="button"
                                className="btn-primary w-full"
                                onClick={() => handleSave('Processing')}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save Invoice →'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
