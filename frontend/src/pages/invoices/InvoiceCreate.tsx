import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { useInvoiceTotals, InvoiceItem } from '../../hooks/useInvoiceTotals'
import CustomerSelect from '../../components/invoice/CustomerSelect'
import ProductSearch from '../../components/invoice/ProductSearch'
import InvoiceTable from '../../components/invoice/InvoiceTable'
import TotalsPanel from '../../components/invoice/TotalsPanel'
import PaymentPanel, { Payment } from '../../components/invoice/PaymentPanel'
import SignaturePanel from '../../components/invoice/SignaturePanel'
import InvoiceMeta from '../../components/invoice/InvoiceMeta'

interface Buyer {
    id: number
    name: string
    email: string
    phone: string
    addressLine1: string
    addressLine2?: string
    area: string
    city: string
    state: string
    country: string
    postalCode: string
}

interface Product {
    id: number
    sku: string
    title: string
    price: number
    stock: number
    hsnCode?: string
    taxType?: 'withTax' | 'withoutTax'
    taxRate?: number
}

const SELLER_STATE = 'Gujarat'

export default function InvoiceCreate() {
    const navigate = useNavigate()

    // Form state
    const [invoiceNo, setInvoiceNo] = useState('')
    const [invoiceDate, setInvoiceDate] = useState<Date | null>(new Date())
    const [dueDate, setDueDate] = useState<Date | null>(new Date())
    const [deliveryDateTime, setDeliveryDateTime] = useState<Date | null>(null)
    const [paymentTime, setPaymentTime] = useState<Date | null>(null)
    const [reference, setReference] = useState('')
    const [customer, setCustomer] = useState<Buyer | null>(null)
    const [items, setItems] = useState<InvoiceItem[]>([])
    const [notes, setNotes] = useState('')
    const [payments, setPayments] = useState<Payment[]>([])
    const [signature, setSignature] = useState<string | null>(null)
    const [globalDiscountPct, setGlobalDiscountPct] = useState(0)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    // Calculate totals
    const totals = useInvoiceTotals(items, {
        buyerState: customer?.state,
        sellerState: SELLER_STATE,
        globalDiscountPct
    })

    const isSameState = customer?.state?.toLowerCase() === SELLER_STATE.toLowerCase()

    // Fetch next invoice number
    useEffect(() => {
        const fetchInvoiceNo = async () => {
            try {
                const { data } = await api.get('/invoices/next-no')
                setInvoiceNo(data.invoiceNo || '')
            } catch (err) {
                console.error('Error fetching invoice number:', err)
            }
        }
        fetchInvoiceNo()
    }, [])

    // Add product to items
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

    // Validation
    const validate = () => {
        const errs: Record<string, string> = {}

        if (!invoiceNo.trim()) errs.invoiceNo = 'Invoice number is required'
        if (!customer) errs.customer = 'Customer is required'
        if (items.length === 0) errs.items = 'At least one item is required'
        if (!invoiceDate) errs.invoiceDate = 'Invoice date is required'

        // Validate due date is not before invoice date
        if (invoiceDate && dueDate && dueDate < invoiceDate) {
            errs.dueDate = 'Due date cannot be before invoice date'
        }

        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    // Save invoice
    const handleSave = async (status: 'Draft' | 'Processing' | 'Completed', print = false) => {
        console.log('💾 Save clicked with status:', status, 'print:', print)

        if (!validate()) {
            console.log('❌ Validation failed:', errors)
            return
        }

        setLoading(true)
        try {
            // Format dates for API
            const formattedInvoiceDate = invoiceDate ? invoiceDate.toISOString().substring(0, 10) : ''
            const formattedDueDate = dueDate ? dueDate.toISOString().substring(0, 10) : ''
            const formattedDeliveryDateTime = deliveryDateTime ? deliveryDateTime.toISOString() : undefined
            const formattedPaymentTime = paymentTime ? paymentTime.toISOString().substring(11, 16) : undefined

            const payload = {
                invoiceNo,
                buyerId: customer!.id,
                invoiceDate: formattedInvoiceDate,
                dueDate: formattedDueDate,
                deliveryDateTime: formattedDeliveryDateTime,
                paymentTime: formattedPaymentTime,
                reference,
                status,
                items: items.map(item => ({
                    productId: item.productId,
                    title: item.title,
                    description: item.description,
                    qty: item.qty,
                    price: item.unitPrice,
                    gst: item.taxRate,
                    discountPct: item.discount,
                    hsnCode: item.hsnCode
                })),
                notes,
                // NEW: Send payments array (payment-centric architecture)
                payments: payments.map(p => ({
                    amount: p.amount,
                    roundOff: p.roundOff || 0,
                    mode: p.mode,
                    note: p.note || ''
                })),
                // DEPRECATED: Kept for backward compatibility
                paymentMethod: payments.length > 0 ? payments[0].mode : 'Cash',
                serviceCharge: 0,
                signature: signature || null  // Add signature to payload
            }

            console.log('📤 Sending payload:', payload)
            const { data } = await api.post('/invoices', payload)
            console.log('✅ Invoice saved:', data)

            if (print) {
                navigate(`/invoices/${data.invoiceNo}/print`)
            } else {
                navigate('/invoices')
            }
        } catch (err: any) {
            console.error('❌ Error saving invoice:', err)
            console.error('Error response:', err.response?.data)
            setErrors({ general: err.response?.data?.message || 'Failed to save invoice' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                className="text-gray-600 hover:text-gray-900"
                                onClick={() => navigate('/invoices')}
                            >
                                ← Back
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Create Invoice</h1>
                                <p className="text-sm text-gray-600">UDAY DAIRY EQUIPMENTS</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Invoice No:</label>
                                <input
                                    type="text"
                                    className="input w-48"
                                    value={invoiceNo}
                                    onChange={(e) => setInvoiceNo(e.target.value)}
                                    readOnly
                                />
                            </div>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleSave('Draft')}
                                disabled={loading}
                            >
                                Save as Draft
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleSave('Processing', true)}
                                disabled={loading}
                            >
                                Save & Print
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => handleSave('Processing')}
                                disabled={loading}
                            >
                                Save →
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
                            <InvoiceMeta
                                invoiceDate={invoiceDate}
                                dueDate={dueDate}
                                deliveryDateTime={deliveryDateTime}
                                paymentTime={paymentTime}
                                setInvoiceDate={setInvoiceDate}
                                setDueDate={setDueDate}
                                setDeliveryDateTime={setDeliveryDateTime}
                                setPaymentTime={setPaymentTime}
                                dateError={errors.dueDate}
                            />
                            {errors.invoiceDate && <p className="text-red-600 text-sm mt-2">{errors.invoiceDate}</p>}

                            <div className="mt-4">
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
                                onClick={() => navigate('/invoices')}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => handleSave('Draft', false)}
                                    disabled={loading}
                                    className="flex-1 px-6 py-3 border border-gray-300 bg-white text-gray-700 font-semibold rounded-lg hover:bg-gray-50 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Saving...' : 'Save as Draft'}
                                </button>
                                <button
                                    onClick={() => handleSave('Processing', false)}
                                    disabled={loading}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 shadow-md  hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Saving...' : 'Save Invoice'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

