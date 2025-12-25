import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../api/client'
import CustomerSelect from '../../components/invoice/CustomerSelect'
import ProductSearch from '../../components/invoice/ProductSearch'
import InvoiceTable, { ColumnVisibility } from '../../components/invoice/InvoiceTable'
import TotalsPanel from '../../components/invoice/TotalsPanel'
import PaymentPanel from '../../components/invoice/PaymentPanel'
import SignaturePanel from '../../components/invoice/SignaturePanel'
import ExtraChargesPanel, { ExtraCharge } from '../../components/invoice/ExtraChargesPanel'
import NotesPanel from '../../components/invoice/NotesPanel'
import { InvoiceItem, useInvoiceTotals } from '../../hooks/useInvoiceTotals'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

interface Customer {
    id: number
    name: string
    email: string
    phone: string
    gstin?: string
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
    roundOff?: number
    mode: string
    note: string
}

type InvoiceViewMode = 'default' | 'full'

export default function InvoiceEdit() {
    const { invoiceNo } = useParams<{ invoiceNo: string }>()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [invoiceDate, setInvoiceDate] = useState<Date | null>(null)
    const [dueDate, setDueDate] = useState<Date | null>(null)
    const [reference, setReference] = useState('')
    const [customer, setCustomer] = useState<Customer | null>(null)
    const [items, setItems] = useState<InvoiceItem[]>([])
    const [globalDiscountPct, setGlobalDiscountPct] = useState(0)
    const [notes, setNotes] = useState('')
    const [payments, setPayments] = useState<Payment[]>([])
    const [signature, setSignature] = useState<string | null>(null)
    const [errors, setErrors] = useState<Record<string, string>>({})

    // Layout / view mode (UI-only)
    const [viewMode, setViewMode] = useState<InvoiceViewMode>('default')

    // NEW: Column visibility state (matches InvoiceCreate)
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
        hsn: true,
        qty: true,
        unitPrice: true,
        discount: true,
        tax: true,
        total: true
    })

    // NEW: Extra charges state
    const [extraChargesEnabled, setExtraChargesEnabled] = useState(false)
    const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([])

    // NEW: Notes toggle state
    const [notesEnabled, setNotesEnabled] = useState(false)

    const totals = useInvoiceTotals(items, {
        buyerState: customer?.state,
        sellerState: 'Gujarat',
        globalDiscountPct
    })
    const isSameState = customer?.state === 'Gujarat'

    // Load invoice data
    useEffect(() => {
        const loadInvoice = async () => {
            try {
                const { data } = await api.get(`/invoices/${invoiceNo}`)

                // Set basic fields - use Date objects for DatePicker
                const loadedInvoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : null
                const loadedDueDate = data.dueDate ? new Date(data.dueDate) : null

                // Auto-fill invoice date with current date if empty
                if (!loadedInvoiceDate) {
                    setInvoiceDate(new Date())
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
        // Check if product already exists in items
        const existingItemIndex = items.findIndex(item => item.productId === product.id)

        if (existingItemIndex !== -1) {
            // Product exists: increment quantity
            const updatedItems = [...items]
            updatedItems[existingItemIndex] = {
                ...updatedItems[existingItemIndex],
                qty: updatedItems[existingItemIndex].qty + qty
            }
            setItems(updatedItems)
        } else {
            // Product doesn't exist: add new row
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
                invoiceDate: invoiceDate?.toISOString().split('T')[0] || '',
                dueDate: dueDate?.toISOString().split('T')[0] || '',
                reference,
                // Do not send status field when editing – backend calculates it from payments
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
                        <div className="flex gap-3 items-center">
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
            </div>

            {/* Main Content */}
            <div className="pb-64"> {/* Bottom padding for fixed bar */}
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
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Invoice Date *
                                    </label>
                                    <DatePicker
                                        selected={invoiceDate}
                                        onChange={(date) => setInvoiceDate(date)}
                                        dateFormat="dd/MM/yyyy"
                                        className="input w-full"
                                        placeholderText="Select invoice date"
                                        isClearable
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Due Date *
                                    </label>
                                    <DatePicker
                                        selected={dueDate}
                                        onChange={(date) => setDueDate(date)}
                                        dateFormat="dd/MM/yyyy"
                                        className="input w-full"
                                        placeholderText="Select due date"
                                        minDate={invoiceDate ?? undefined}
                                        isClearable
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Reference Number
                                    </label>
                                    <input
                                        type="text"
                                        className="input w-full"
                                        value={reference}
                                        onChange={(e) => setReference(e.target.value)}
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Product Search */}
                        <ProductSearch
                            onAdd={handleAddProduct}
                            onNavigateToCreate={() => navigate('/products/new')}
                            excludedProductIds={items.map(item => item.productId).filter((id): id is number => id !== undefined)}
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
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                onClick={() => handleSave('Draft')}
                                disabled={saving}
                            >
                                Save Draft
                            </button>
                            <button
                                type="button"
                                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                onClick={() => handleSave('Processing', true)}
                                disabled={saving}
                            >
                                Save & Print
                            </button>
                            <button
                                type="button"
                                className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                                onClick={() => handleSave('Processing')}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save Invoice'}
                                <span>→</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
