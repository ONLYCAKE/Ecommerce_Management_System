import React from 'react'
import { CheckCircle2, Check } from 'lucide-react'

interface FinalizeInvoiceModalProps {
    isOpen: boolean
    invoiceNo: string
    onClose: () => void
    onConfirm: () => void
}

const FinalizeInvoiceModal: React.FC<FinalizeInvoiceModalProps> = ({
    isOpen,
    invoiceNo,
    onClose,
    onConfirm
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-shrink-0 text-green-600">
                        <CheckCircle2 size={32} strokeWidth={1.8} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Finalize Draft Invoice</h3>
                        <p className="text-sm text-gray-500">{invoiceNo}</p>
                    </div>
                </div>

                <div className="mb-6">
                    <p className="text-gray-700 mb-3">
                        Are you sure you want to finalize this draft invoice?
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                            <strong>This action will:</strong>
                        </p>
                        <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4 list-disc">
                            <li>Generate a permanent invoice number (INV-YYYYMM-XXXX)</li>
                            <li>Change status from Draft to Unpaid</li>
                            <li>Enable payments, PDF generation, and email sending</li>
                            <li>Send email notification to the buyer (if email exists)</li>
                        </ul>
                    </div>
                </div>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onConfirm()
                            onClose()
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center gap-2"
                    >
                        <Check size={16} strokeWidth={1.8} />
                        Finalize Invoice
                    </button>
                </div>
            </div>
        </div>
    )
}

export default FinalizeInvoiceModal
