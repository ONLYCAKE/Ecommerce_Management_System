import { useState } from 'react'

export interface Payment {
    id?: string
    amount: number
    mode: string
    note: string
}

interface PaymentPanelProps {
    payments: Payment[]
    onChange: (payments: Payment[]) => void
    grandTotal: number
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
    const balance = grandTotal - totalPaid

    const openPaymentForm = () => {
        // Auto-fill with remaining balance
        setNewPayment({
            amount: balance > 0 ? balance : 0,
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

        if (newPayment.amount > balance) {
            setError(`Amount cannot exceed balance of ₹${balance.toFixed(2)}`)
            return
        }

        onChange([...payments, { ...newPayment, id: Date.now().toString() }])
        setNewPayment({ amount: 0, mode: 'Cash', note: '' })
        setError('')
        setShowForm(false)
    }

    const deletePayment = (id?: string) => {
        onChange(payments.filter(p => p.id !== id))
    }

    const markFullyPaid = () => {
        if (balance <= 0) return

        onChange([...payments, {
            id: Date.now().toString(),
            amount: balance,
            mode: 'Cash',
            note: 'Full payment'
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
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input w-full text-sm"
                            value={newPayment.amount || ''}
                            onChange={(e) => {
                                setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) || 0 })
                                setError('')
                            }}
                            placeholder="Enter amount"
                            autoFocus
                        />
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
