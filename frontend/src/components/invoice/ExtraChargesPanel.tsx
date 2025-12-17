import { useState } from 'react'
import { Plus, X, ToggleLeft, ToggleRight } from 'lucide-react'

export interface ExtraCharge {
    id: string
    name: string
    amount: number
}

interface ExtraChargesPanelProps {
    charges: ExtraCharge[]
    onChange: (charges: ExtraCharge[]) => void
    enabled: boolean
    onToggle: (enabled: boolean) => void
}

export default function ExtraChargesPanel({ charges, onChange, enabled, onToggle }: ExtraChargesPanelProps) {
    const addCharge = () => {
        onChange([
            ...charges,
            { id: Date.now().toString(), name: '', amount: 0 }
        ])
    }

    const updateCharge = (id: string, field: keyof ExtraCharge, value: any) => {
        onChange(charges.map(c => c.id === id ? { ...c, [field]: value } : c))
    }

    const removeCharge = (id: string) => {
        onChange(charges.filter(c => c.id !== id))
    }

    const total = charges.reduce((sum, c) => sum + (c.amount || 0), 0)

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header with Toggle */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">Extra Charges</h3>
                        <p className="text-xs text-gray-500">Add delivery, packing, or other charges</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onToggle(!enabled)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${enabled ? 'bg-amber-500' : 'bg-gray-200'
                        }`}
                >
                    <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                    />
                </button>
            </div>

            {/* Content */}
            {enabled && (
                <div className="p-4 space-y-3">
                    {charges.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                            No extra charges added
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {charges.map((charge) => (
                                <div key={charge.id} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Charge name (e.g. Delivery)"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                        value={charge.name}
                                        onChange={(e) => updateCharge(charge.id, 'name', e.target.value)}
                                    />
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            className="w-28 pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                            value={charge.amount || ''}
                                            onChange={(e) => updateCharge(charge.id, 'amount', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeCharge(charge.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Button */}
                    <button
                        type="button"
                        onClick={addCharge}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={16} />
                        Add Charge
                    </button>

                    {/* Total */}
                    {charges.length > 0 && (
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                            <span className="text-sm font-medium text-gray-600">Total Extra Charges</span>
                            <span className="text-sm font-bold text-amber-600">₹{total.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
