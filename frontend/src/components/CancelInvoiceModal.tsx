import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import api from '../api/client';
import { toast } from 'react-hot-toast';

interface CancelInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoiceNo: string;
    invoiceStatus: string;
    onSuccess?: () => void;
}

export default function CancelInvoiceModal({
    isOpen,
    onClose,
    invoiceNo,
    invoiceStatus,
    onSuccess
}: CancelInvoiceModalProps) {
    const [reason, setReason] = useState('');
    const [force, setForce] = useState(false);
    const [loading, setLoading] = useState(false);

    const isPaid = invoiceStatus === 'Paid' || invoiceStatus === 'Completed';

    const handleCancel = async () => {
        if (!reason.trim()) {
            toast.error('Please provide a cancellation reason');
            return;
        }

        setLoading(true);

        try {
            const response = await api.patch(`/invoices/${invoiceNo}/cancel`, {
                reason: reason.trim(),
                force: isPaid ? force : false
            });

            if (response.data.success) {
                toast.success('Invoice cancelled successfully');
                onClose();
                if (onSuccess) onSuccess();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to cancel invoice');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
                    <div>
                        <h3 className="text-xl font-bold">Cancel Invoice</h3>
                        <p className="text-red-100 text-sm mt-1">Invoice {invoiceNo}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Warning for paid invoices */}
                    {isPaid && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                            <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-yellow-800">
                                <p className="font-medium">Warning: This invoice is marked as {invoiceStatus}</p>
                                <p className="mt-1">Cancelling a paid invoice requires admin approval and will be audited.</p>
                            </div>
                        </div>
                    )}

                    {/* Reason textarea */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cancellation Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={4}
                            placeholder="Please provide a reason for cancelling this invoice..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all resize-none"
                        />
                    </div>

                    {/* Force checkbox (admin only, for paid invoices) */}
                    {isPaid && (
                        <div className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                id="force-cancel"
                                checked={force}
                                onChange={(e) => setForce(e.target.checked)}
                                className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                            />
                            <label htmlFor="force-cancel" className="text-sm text-gray-700">
                                <span className="font-medium">Force cancel (Admin only)</span>
                                <p className="text-gray-500 mt-0.5">
                                    I understand this action will be audited and requires administrator privileges.
                                </p>
                            </label>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Keep Invoice
                    </button>
                    <button
                        onClick={handleCancel}
                        disabled={loading || !reason.trim()}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Cancelling...
                            </>
                        ) : (
                            'Cancel Invoice'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
