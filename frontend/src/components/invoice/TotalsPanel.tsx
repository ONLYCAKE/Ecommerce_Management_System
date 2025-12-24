import { InvoiceTotals } from '../../hooks/useInvoiceTotals'
import { ExtraCharge } from './ExtraChargesPanel'
import { FileText } from 'lucide-react'

interface TotalsPanelProps {
    totals: InvoiceTotals
    isSameState: boolean
    extraCharges?: ExtraCharge[]
    extraChargesEnabled?: boolean
}

export default function TotalsPanel({
    totals,
    isSameState,
    extraCharges = [],
    extraChargesEnabled = false
}: TotalsPanelProps) {
    // Calculate extra charges total
    const extraChargesTotal = extraChargesEnabled
        ? extraCharges.reduce((sum, c) => sum + (c.amount || 0), 0)
        : 0

    // Final grand total including extra charges
    const finalGrandTotal = totals.grandTotal + extraChargesTotal

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                    <FileText size={16} strokeWidth={1.8} className="text-green-600" />
                    Invoice Summary
                </h3>
            </div>

            <div className="p-4 space-y-3">
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
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

                    {/* Extra Charges */}
                    {extraChargesEnabled && extraCharges.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                            <div className="text-xs font-semibold text-amber-800 mb-1">
                                Extra Charges
                            </div>
                            {extraCharges.map((charge) => (
                                charge.amount > 0 && (
                                    <div key={charge.id} className="flex justify-between text-xs">
                                        <span className="text-gray-700">{charge.name || 'Unnamed Charge'}</span>
                                        <span className="font-medium text-gray-900">₹{charge.amount.toFixed(2)}</span>
                                    </div>
                                )
                            ))}
                            <div className="flex justify-between text-xs border-t border-amber-300 pt-1 mt-1">
                                <span className="font-medium text-gray-700">Total Extra</span>
                                <span className="font-semibold text-amber-700">₹{extraChargesTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

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
                    <div className="flex justify-between border-t-2 border-gray-300 pt-3 mt-3">
                        <span className="font-bold text-gray-800">Grand Total</span>
                        <span className="font-bold text-xl text-green-600">₹{finalGrandTotal.toFixed(2)}</span>
                    </div>
                </div>

                {/* Amount in Words */}
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 border-t mt-3 pt-3">
                    <div className="font-medium mb-1">Amount in Words:</div>
                    <div className="italic text-gray-700">
                        Rupees {finalGrandTotal.toLocaleString('en-IN')} only
                    </div>
                </div>
            </div>
        </div>
    )
}
