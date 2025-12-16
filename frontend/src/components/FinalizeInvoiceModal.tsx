import React from 'react'

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
                    <div className="flex-shrink-0">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Finalize Invoice
                    </button>
                </div>
            </div>
        </div>
    )
}

export default FinalizeInvoiceModal
