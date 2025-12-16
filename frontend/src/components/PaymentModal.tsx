import { useState, FormEvent, useMemo } from 'react';
import api from '../api/client';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../utils/invoiceStatus';

interface PaymentModalProps {
    invoice: any;
    onClose: () => void;
    onSuccess: () => void;
}

const ROUND_OFF_THRESHOLD = 1.00; // ₹1.00

function roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
}

function calculateRoundOff(paymentAmount: number, remainingBalance: number) {
    const roundedPayment = roundToTwoDecimals(paymentAmount);
    const roundedBalance = roundToTwoDecimals(remainingBalance);

    // Check if payment is integer (whole number)
    const isIntegerPayment = roundedPayment === Math.floor(roundedPayment);

    if (!isIntegerPayment) {
        return { adjustedAmount: roundedPayment, roundOff: 0, shouldApplyRoundOff: false };
    }

    // Calculate difference
    const difference = roundToTwoDecimals(roundedPayment - roundedBalance);

    // Apply round-off if difference is within threshold and positive
    if (difference >= 0 && difference <= ROUND_OFF_THRESHOLD) {
        return {
            adjustedAmount: roundedBalance,
            roundOff: difference,
            shouldApplyRoundOff: true
        };
    }

    return { adjustedAmount: roundedPayment, roundOff: 0, shouldApplyRoundOff: false };
}

export default function PaymentModal({ invoice, onClose, onSuccess }: PaymentModalProps) {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [reference, setReference] = useState('');
    const [loading, setLoading] = useState(false);

    const receivedAmount = invoice.receivedAmount || 0;
    const remainingBalance = roundToTwoDecimals(invoice.total - receivedAmount);

    // Calculate round-off preview
    const roundOffPreview = useMemo(() => {
        const amountNum = parseFloat(amount);
        if (!amount || isNaN(amountNum) || amountNum <= 0) return null;
        return calculateRoundOff(amountNum, remainingBalance);
    }, [amount, remainingBalance]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const amountNum = roundToTwoDecimals(parseFloat(amount));

        // Validation
        if (!amount || isNaN(amountNum) || amountNum <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        const { adjustedAmount, roundOff, shouldApplyRoundOff } = calculateRoundOff(amountNum, remainingBalance);

        // Validate payment amount (with round-off consideration)
        if (!shouldApplyRoundOff && amountNum > remainingBalance) {
            toast.error(`Amount cannot exceed remaining balance (${formatCurrency(remainingBalance)})`);
            return;
        }

        try {
            setLoading(true);
            await api.post('/payments', {
                invoiceNo: invoice.invoiceNo,
                amount: amountNum, // Send the decimal amount
                method,
                reference: reference || undefined
            });

            if (roundOff > 0) {
                toast.success(`Payment added with round-off of ${formatCurrency(roundOff)}!`);
            } else {
                toast.success('Payment added successfully!');
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to add payment');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Add Payment</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                        ×
                    </button>
                </div>

                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Invoice:</span>
                        <span className="text-sm font-semibold">{invoice.invoiceNo}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Total:</span>
                        <span className="text-sm font-semibold">{formatCurrency(invoice.total)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-600">Received:</span>
                        <span className="text-sm font-semibold text-green-600">{formatCurrency(receivedAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Balance:</span>
                        <span className="text-sm font-bold text-orange-600">{formatCurrency(remainingBalance)}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    {roundOffPreview && roundOffPreview.shouldApplyRoundOff && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start gap-2">
                                <span className="text-lg">💡</span>
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-blue-900">Round-off Applied</div>
                                    <div className="text-xs text-blue-700 mt-1">
                                        ₹{roundOffPreview.roundOff.toFixed(2)} will be adjusted as round-off
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Amount <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter amount"
                            required
                        />
                        <div className="text-xs text-gray-500 mt-1">
                            Enter payment amount (e.g., 100.50, 0.20)
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Payment Method <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        >
                            <option value="Cash">Cash</option>
                            <option value="Card">Card</option>
                            <option value="UPI">UPI</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                        </select>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Reference Number (Optional)
                        </label>
                        <input
                            type="text"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Transaction ID, Cheque No, etc."
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? 'Adding...' : 'Add Payment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
