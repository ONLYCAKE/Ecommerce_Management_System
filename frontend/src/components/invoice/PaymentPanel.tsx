import { useState, useMemo } from 'react'

export interface Payment {
    id?: string
    amount: number
    roundOff?: number
    mode: string
    note: string
}

interface PaymentPanelProps {
    payments: Payment[]
    onChange: (payments: Payment[]) => void
    grandTotal: number
}

const ROUND_OFF_THRESHOLD = 1.00 // ₹1.00

function roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100
}

function calculateRoundOff(paymentAmount: number, remainingBalance: number) {
    const roundedPayment = roundToTwoDecimals(paymentAmount)
    const roundedBalance = roundToTwoDecimals(remainingBalance)

    // Check if payment is integer (whole number)
    const isIntegerPayment = roundedPayment === Math.floor(roundedPayment)

    if (!isIntegerPayment) {
        return { adjustedAmount: roundedPayment, roundOff: 0, shouldApplyRoundOff: false }
    }

    // Calculate difference
    const difference = roundToTwoDecimals(roundedPayment - roundedBalance)

    // Apply round-off if difference is within threshold and positive
    if (difference >= 0 && difference <= ROUND_OFF_THRESHOLD) {
        return {
            adjustedAmount: roundedBalance,
            roundOff: difference,
            shouldApplyRoundOff: true
        }
    }

    return { adjustedAmount: roundedPayment, roundOff: 0, shouldApplyRoundOff: false }
}

export default function PaymentPanel({ payments, onChange, grandTotal }: PaymentPanelProps) {
    const [showForm, setShowForm] = useState(false)
    const [newPayment, setNewPayment] = useState<Payment>({
        amount: 0,
        mode: 'Cash',
        note: ''
    })
    const [error, setError] = useState('')

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    const balance = roundToTwoDecimals(grandTotal - totalPaid)

    // Calculate round-off preview for current input
    const roundOffPreview = useMemo(() => {
        if (!newPayment.amount || newPayment.amount <= 0) return null
        return calculateRoundOff(newPayment.amount, balance)
    }, [newPayment.amount, balance])

    const openPaymentForm = () => {
        // Auto-fill with remaining balance rounded up to nearest integer
        const suggestedAmount = balance > 0 ? Math.ceil(balance) : 0
        setNewPayment({
            amount: suggestedAmount,
            mode: 'Cash',
            note: ''
        })
        setError('')
        setShowForm(true)
    }

    const addPayment = () => {
        if (!newPayment.amount || newPayment.amount <= 0) {
            setError('Please enter a valid amount greater than 0')
            return
        }

        const { adjustedAmount, roundOff, shouldApplyRoundOff } = calculateRoundOff(newPayment.amount, balance)

        // Validate: payment should not exceed balance unless round-off applies
        if (!shouldApplyRoundOff && newPayment.amount > balance) {
            setError(`Amount cannot exceed balance of ₹${balance.toFixed(2)}`)
            return
        }

        onChange([...payments, {
            ...newPayment,
            id: Date.now().toString(),
            amount: adjustedAmount,
            roundOff: roundOff
        }])
        setNewPayment({ amount: 0, mode: 'Cash', note: '' })
        setError('')
        setShowForm(false)
    }

    const deletePayment = (id?: string) => {
        onChange(payments.filter(p => p.id !== id))
    }

    const markFullyPaid = () => {
        if (balance <= 0) return

        const suggestedAmount = Math.ceil(balance)
        const { adjustedAmount, roundOff } = calculateRoundOff(suggestedAmount, balance)

        onChange([...payments, {
            id: Date.now().toString(),
            amount: adjustedAmount,
            roundOff: roundOff,
            mode: 'Cash',
            note: roundOff > 0 ? `Full payment (Round-off: ₹${roundOff.toFixed(2)})` : 'Full payment'
        }])
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm border-b pb-2">Payments</h3>

            {/* Payment Summary */}
            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount</span>
                    <span className="font-medium">₹{grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                    <span>Paid</span>
                    <span className="font-medium">₹{totalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold text-gray-800">Balance</span>
                    <span className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{balance.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Payment List */}
            {payments.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                    <div className="text-xs font-medium text-gray-600 mb-2">Payment History</div>
                    {payments.map((payment) => (
                        <div key={payment.id} className="bg-gray-50 rounded p-2 text-xs flex justify-between items-start">
                            <div>
                                <div className="font-medium text-gray-900">₹{payment.amount.toFixed(2)}</div>
                                {payment.roundOff && payment.roundOff > 0 && (
                                    <div className="text-blue-600 text-[10px]">
                                        Round-off: +₹{payment.roundOff.toFixed(2)}
                                    </div>
                                )}
                                <div className="text-gray-600">{payment.mode}</div>
                                {payment.note && <div className="text-gray-500 italic">{payment.note}</div>}
                            </div>
                            <button
                                type="button"
                                className="text-red-600 hover:text-red-800"
                                onClick={() => deletePayment(payment.id)}
                                title="Delete payment"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Payment Form */}
            {showForm ? (
                <div className="border-t pt-3 space-y-2">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                            {error}
                        </div>
                    )}
                    {roundOffPreview && roundOffPreview.shouldApplyRoundOff && (
                        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-xs">
                            💡 Round-off of ₹{roundOffPreview.roundOff.toFixed(2)} will be applied
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Amount (Whole Number) *</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            className="input w-full text-sm"
                            value={newPayment.amount || ''}
                            onChange={(e) => {
                                const value = parseInt(e.target.value) || 0
                                setNewPayment({ ...newPayment, amount: value })
                                setError('')
                            }}
                            placeholder="Enter whole number amount"
                            autoFocus
                        />
                        <div className="text-[10px] text-gray-500 mt-1">
                            Enter integer amounts only (e.g., 1000, 1500)
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Mode</label>
                        <select
                            className="input w-full text-sm"
                            value={newPayment.mode}
                            onChange={(e) => setNewPayment({ ...newPayment, mode: e.target.value })}
                        >
                            <option>Cash</option>
                            <option>Card</option>
                            <option>UPI</option>
                            <option>Bank Transfer</option>
                            <option>Cheque</option>
                            <option>Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Note (optional)</label>
                        <input
                            type="text"
                            className="input w-full text-sm"
                            value={newPayment.note}
                            onChange={(e) => setNewPayment({ ...newPayment, note: e.target.value })}
                            placeholder="Payment note"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button type="button" className="btn-primary text-sm flex-1" onClick={addPayment}>
                            Add Payment
                        </button>
                        <button type="button" className="btn-secondary text-sm" onClick={() => { setShowForm(false); setError('') }}>
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="border-t pt-3 space-y-2">
                    <button
                        type="button"
                        className="btn-secondary w-full text-sm"
                        onClick={openPaymentForm}
                    >
                        + Add Payment
                    </button>
                    {balance > 0 && (
                        <button
                            type="button"
                            className="btn-primary w-full text-sm"
                            onClick={markFullyPaid}
                        >
                            Mark as Fully Paid
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
