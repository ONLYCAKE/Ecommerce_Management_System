import { InvoiceTotals } from '../../hooks/useInvoiceTotals'

interface TotalsPanelProps {
    totals: InvoiceTotals
    isSameState: boolean
}

export default function TotalsPanel({ totals, isSameState }: TotalsPanelProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm border-b pb-2">Invoice Summary</h3>

            <div className="space-y-2 text-sm">
                {/* Subtotal */}
                <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">₹{totals.subtotal.toFixed(2)}</span>
                </div>

                {/* Discount */}
                {totals.discount > 0 && (
                    <div className="flex justify-between text-red-600">
                        <span>Discount</span>
                        <span>- ₹{totals.discount.toFixed(2)}</span>
                    </div>
                )}

                {/* Taxable Amount */}
                <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600">Taxable Amount</span>
                    <span className="font-medium">₹{totals.taxableAmount.toFixed(2)}</span>
                </div>

                {/* Tax Breakdown */}
                <div className="bg-blue-50 border border-blue-200 rounded p-2 space-y-1">
                    <div className="text-xs font-semibold text-blue-800 mb-1">
                        {isSameState ? 'Tax (Same State)' : 'Tax (Interstate)'}
                    </div>

                    {isSameState ? (
                        <>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-700">CGST</span>
                                <span className="font-medium text-gray-900">₹{totals.cgst.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-700">SGST</span>
                                <span className="font-medium text-gray-900">₹{totals.sgst.toFixed(2)}</span>
                            </div>
                        </>
                    ) : (
                        <div className="flex justify-between text-xs">
                            <span className="text-gray-700">IGST</span>
                            <span className="font-medium text-gray-900">₹{totals.igst.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex justify-between text-xs border-t border-blue-300 pt-1 mt-1">
                        <span className="font-medium text-gray-700">Total Tax</span>
                        <span className="font-semibold text-gray-900">₹{totals.totalTax.toFixed(2)}</span>
                    </div>
                </div>

                {/* Round Off */}
                {Math.abs(totals.roundOff) > 0.01 && (
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Round Off</span>
                        <span className={totals.roundOff >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {totals.roundOff >= 0 ? '+' : ''} ₹{totals.roundOff.toFixed(2)}
                        </span>
                    </div>
                )}

                {/* Grand Total */}
                <div className="flex justify-between border-t-2 border-gray-300 pt-2 mt-2">
                    <span className="font-bold text-gray-800">Grand Total</span>
                    <span className="font-bold text-lg text-green-600">₹{totals.grandTotal.toFixed(2)}</span>
                </div>
            </div>

            {/* Amount in Words */}
            <div className="bg-gray-50 rounded p-2 text-xs text-gray-600 border-t mt-3 pt-3">
                <div className="font-medium mb-1">Amount in Words:</div>
                <div className="italic">
                    Rupees {totals.grandTotal.toLocaleString('en-IN')} only
                </div>
            </div>
        </div>
    )
}
