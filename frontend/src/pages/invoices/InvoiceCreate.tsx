import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { useInvoiceTotals, InvoiceItem } from '../../hooks/useInvoiceTotals'
import CustomerSelect from '../../components/invoice/CustomerSelect'
import ProductSearch from '../../components/invoice/ProductSearch'
import InvoiceTable, { ColumnVisibility } from '../../components/invoice/InvoiceTable'
import TotalsPanel from '../../components/invoice/TotalsPanel'
import PaymentPanel, { Payment } from '../../components/invoice/PaymentPanel'
import SignaturePanel from '../../components/invoice/SignaturePanel'
import InvoiceMeta from '../../components/invoice/InvoiceMeta'
import ExtraChargesPanel, { ExtraCharge } from '../../components/invoice/ExtraChargesPanel'
import NotesPanel from '../../components/invoice/NotesPanel'

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

type InvoiceViewMode = 'default' | 'full'

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
    const [globalDiscountType, setGlobalDiscountType] = useState<'percent' | 'fixed'>('percent')
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    // Layout / view mode (UI-only)
    const [viewMode, setViewMode] = useState<InvoiceViewMode>('default')

    // Column visibility state
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
        hsn: true, qty: true, unitPrice: true, discount: true, tax: true, total: true
    })

    // Extra charges state
    const [extraChargesEnabled, setExtraChargesEnabled] = useState(false)
    const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([])

    // Notes state
    const [notesEnabled, setNotesEnabled] = useState(false)

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

    // Validation - drafts allow skipping items/dates, but backend always requires buyer
    const validate = (isDraft: boolean = false) => {
        const errs: Record<string, string> = {}

        // Always require invoice number
        if (!invoiceNo.trim()) errs.invoiceNo = 'Invoice number is required'

        // Backend requires buyer even for drafts
        if (!customer) errs.customer = 'Customer is required'

        // For non-draft saves, require all fields
        if (!isDraft) {
            if (items.length === 0) errs.items = 'At least one item is required'
            if (!invoiceDate) errs.invoiceDate = 'Invoice date is required'

            // Validate due date is not before invoice date
            if (invoiceDate && dueDate && dueDate < invoiceDate) {
                errs.dueDate = 'Due date cannot be before invoice date'
            }
        }

        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    // Save invoice
    const handleSave = async (status: 'Draft' | 'Processing' | 'Completed', print = false) => {
        console.log('💾 Save clicked with status:', status, 'print:', print)

        const isDraft = status === 'Draft'
        if (!validate(isDraft)) {
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
                subtotal: totals.subtotal,
                tax: totals.totalTax,
                total: totals.grandTotal,
                items: items.map(item => ({
                    productId: item.productId,
                    title: item.title,
                    description: item.description,
                    qty: item.qty,
                    price: item.unitPrice,
                    gst: item.taxRate,
                    discountPct: item.discount,
                    hsnCode: item.hsnCode,
                    amount: item.qty * item.unitPrice * (1 - item.discount / 100) * (1 + item.taxRate / 100)
                })),
                notes: notesEnabled ? notes : null,
                // Extra charges (only if enabled and has charges)
                extraCharges: extraChargesEnabled && extraCharges.length > 0
                    ? extraCharges.filter(c => c.name && c.amount > 0)
                    : null,
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
        <div
            className={
                `min-h-screen transition-all duration-300 ${viewMode === 'full' ? 'bg-slate-900/5' : 'bg-gray-50'
                }`
            }
        >
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
                            {/* View mode toggle */}
                            {/* View mode toggle */}
                            <div className="hidden md:flex w-64 items-center bg-gray-100 rounded-full p-1 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('default')}
                                    className={
                                        `flex-1 text-center justify-center py-1.5 text-xs font-medium rounded-full transition-all ${viewMode === 'default'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                        }`
                                    }
                                >
                                    Default
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('full')}
                                    className={
                                        `flex-1 text-center justify-center py-1.5 text-xs font-medium rounded-full transition-all ${viewMode === 'full'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                        }`
                                    }
                                >
                                    Full Screen
                                </button>
                            </div>

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
            <div
                className={
                    `transition-all duration-300 py-6 ${viewMode === 'full'
                        ? 'w-full max-w-none px-4 sm:px-8 lg:px-10'
                        : 'max-w-5xl mx-auto px-4 sm:px-6'
                    }`
                }
            >
                {errors.general && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {errors.general}
                    </div>
                )}

                {/* Form Sections - Full Width */}
                <div className="space-y-5">
                    {/* Customer Selection */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <CustomerSelect
                            value={customer}
                            onChange={setCustomer}
                        />
                        {errors.customer && <p className="text-red-600 text-sm mt-2">{errors.customer}</p>}
                    </div>

                    {/* Invoice Meta */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <h3 className="text-sm font-semibold text-blue-700 mb-4">Invoice Details</h3>
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
                                Reference Number
                            </label>
                            <input
                                type="text"
                                className="input w-full max-w-sm"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    {/* Product Search */}
                    <ProductSearch
                        onAdd={handleAddProduct}
                        onNavigateToCreate={() => navigate('/products/new')}
                    />

                    {/* Invoice Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-semibold text-blue-700">Product Details</h3>
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

                    {/* Extra Charges */}
                    <ExtraChargesPanel
                        charges={extraCharges}
                        onChange={setExtraCharges}
                        enabled={extraChargesEnabled}
                        onToggle={setExtraChargesEnabled}
                    />

                    {/* Comments / Notes */}
                    <NotesPanel
                        notes={notes}
                        onChange={setNotes}
                        enabled={notesEnabled}
                        onToggle={setNotesEnabled}
                    />

                    {/* Bottom Section: Payments, Signature & Summary */}
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 mt-8">
                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* Left: Signature + Payments */}
                            <div className="space-y-4">
                                <SignaturePanel signature={signature} onChange={setSignature} />

                                <PaymentPanel
                                    payments={payments}
                                    onChange={setPayments}
                                    grandTotal={totals.grandTotal}
                                />
                            </div>

                            {/* Right: Summary */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 text-right">Invoice Summary</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Subtotal</span>
                                        <span className="font-medium text-gray-800">₹{totals.subtotal.toFixed(2)}</span>
                                    </div>
                                    {isSameState ? (
                                        <>
                                            <div className="flex justify-between text-gray-500">
                                                <span>CGST</span>
                                                <span>₹{(totals.cgst || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-500">
                                                <span>SGST</span>
                                                <span>₹{(totals.sgst || 0).toFixed(2)}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex justify-between text-gray-500">
                                            <span>IGST</span>
                                            <span>₹{(totals.igst || 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    {extraChargesEnabled && extraCharges.length > 0 && (
                                        <div className="flex justify-between text-gray-500">
                                            <span>Extra Charges</span>
                                            <span className="text-amber-600">₹{extraCharges.reduce((s, c) => s + (c.amount || 0), 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between pt-3 border-t border-gray-300">
                                        <span className="font-semibold text-gray-800">Total</span>
                                        <span className="font-bold text-lg text-green-600">₹{(totals.grandTotal + (extraChargesEnabled ? extraCharges.reduce((s, c) => s + (c.amount || 0), 0) : 0)).toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Payment Summary */}
                                <div className="mt-4 pt-3 border-t border-gray-200">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Received</span>
                                        <span className="font-medium text-green-600">₹{payments.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Balance</span>
                                        <span className={`font-semibold ${(totals.grandTotal - payments.reduce((sum, p) => sum + (p.amount || 0), 0)) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                            ₹{(totals.grandTotal - payments.reduce((sum, p) => sum + (p.amount || 0), 0)).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons - Bottom */}
                    <div className="flex justify-end items-center gap-3 pt-4 pb-8">
                        <button
                            type="button"
                            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            onClick={() => navigate('/invoices')}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            onClick={() => handleSave('Draft')}
                            disabled={loading}
                        >
                            Save Draft
                        </button>
                        <button
                            type="button"
                            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                            onClick={() => handleSave('Processing', true)}
                            disabled={loading}
                        >
                            Save & Print
                        </button>
                        <button
                            type="button"
                            className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                            onClick={() => handleSave('Processing')}
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Invoice'}
                            <span>→</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

