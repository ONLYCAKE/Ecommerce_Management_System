import { useState, useRef, useEffect } from 'react'
import { InvoiceItem } from '../../hooks/useInvoiceTotals'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'

// Column visibility configuration
export interface ColumnVisibility {
    hsn: boolean
    qty: boolean
    unitPrice: boolean
    discount: boolean
    tax: boolean
    total: boolean
}

interface InvoiceTableProps {
    items: InvoiceItem[]
    onChange: (items: InvoiceItem[]) => void
    perLineTotals?: Array<{
        id?: string
        lineSubtotal: number
        lineDiscount: number
        lineTaxable: number
        lineTax: number
        lineTotal: number
    }>
    columnVisibility?: ColumnVisibility
    onColumnVisibilityChange?: (visibility: ColumnVisibility) => void
}

const defaultVisibility: ColumnVisibility = {
    hsn: true,
    qty: true,
    unitPrice: true,
    discount: true,
    tax: true,
    total: true
}

export default function InvoiceTable({
    items,
    onChange,
    perLineTotals = [],
    columnVisibility = defaultVisibility,
    onColumnVisibilityChange
}: InvoiceTableProps) {
    const [showColumnMenu, setShowColumnMenu] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowColumnMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const toggleColumn = (column: keyof ColumnVisibility) => {
        if (onColumnVisibilityChange) {
            onColumnVisibilityChange({
                ...columnVisibility,
                [column]: !columnVisibility[column]
            })
        }
    }

    const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
        const updated = [...items]
        updated[index] = { ...updated[index], [field]: value }
        onChange(updated)
    }

    const deleteItem = (index: number) => {
        onChange(items.filter((_, i) => i !== index))
    }

    const moveItem = (fromIndex: number, toIndex: number) => {
        const updated = [...items]
        const [moved] = updated.splice(fromIndex, 1)
        updated.splice(toIndex, 0, moved)
        onChange(updated)
    }

    // Calculate visible column count for empty state
    const visibleColumns = 2 + Object.values(columnVisibility).filter(Boolean).length + 1 // # + Product + visible + Actions

    return (
        <div className="relative">
            {/* Column Visibility Control */}
            <div className="flex justify-end mb-3" ref={menuRef}>
                <button
                    type="button"
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                >
                    <Eye size={16} />
                    Columns
                    <ChevronDown size={14} className={`transition-transform ${showColumnMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {showColumnMenu && (
                    <div className="absolute right-0 top-10 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 mb-1">
                            Toggle Columns
                        </div>
                        {[
                            { key: 'hsn', label: 'HSN / SAC' },
                            { key: 'qty', label: 'Quantity' },
                            { key: 'unitPrice', label: 'Unit Price' },
                            { key: 'discount', label: 'Discount' },
                            { key: 'tax', label: 'Tax %' },
                            { key: 'total', label: 'Total' }
                        ].map(({ key, label }) => (
                            <label
                                key={key}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={columnVisibility[key as keyof ColumnVisibility]}
                                    onChange={() => toggleColumn(key as keyof ColumnVisibility)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700 flex items-center gap-2">
                                    {columnVisibility[key as keyof ColumnVisibility] ? (
                                        <Eye size={14} className="text-green-600" />
                                    ) : (
                                        <EyeOff size={14} className="text-gray-400" />
                                    )}
                                    {label}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                            <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 w-8">#</th>
                            <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700">Product</th>
                            {columnVisibility.hsn && (
                                <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 w-24">HSN/SAC</th>
                            )}
                            {columnVisibility.qty && (
                                <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 w-20">Qty</th>
                            )}
                            {columnVisibility.unitPrice && (
                                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 w-28">Unit Price</th>
                            )}
                            {columnVisibility.discount && (
                                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 w-36">Discount</th>
                            )}
                            {columnVisibility.tax && (
                                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 w-32">Tax %</th>
                            )}
                            {columnVisibility.total && (
                                <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 w-32">Total</th>
                            )}
                            <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 w-20">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns} className="px-4 py-8 text-center text-gray-500">
                                    No items added yet. Search and add products above.
                                </td>
                            </tr>
                        ) : (
                            items.map((item, index) => {
                                const lineTotal = perLineTotals[index]
                                return (
                                    <tr key={item.id || index} className="border-b border-gray-200 hover:bg-blue-50/30 transition-colors">
                                        <td className="px-2 py-2 text-center">
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    type="button"
                                                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                                                    onClick={() => moveItem(index, index - 1)}
                                                    disabled={index === 0}
                                                    title="Move up"
                                                >
                                                    ▲
                                                </button>
                                                <span className="text-sm text-gray-600 font-medium">{index + 1}</span>
                                                <button
                                                    type="button"
                                                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                                                    onClick={() => moveItem(index, index + 1)}
                                                    disabled={index === items.length - 1}
                                                    title="Move down"
                                                >
                                                    ▼
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-2 py-2">
                                            <div>
                                                <div className="font-medium text-sm text-gray-900">{item.title}</div>
                                                {item.description && (
                                                    <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                                                )}
                                                {item.uom && (
                                                    <div className="text-xs text-gray-500">UoM: {item.uom}</div>
                                                )}
                                            </div>
                                        </td>
                                        {columnVisibility.hsn && (
                                            <td className="px-2 py-2">
                                                <div className="text-xs font-mono text-gray-600">{item.hsnCode || '-'}</div>
                                            </td>
                                        )}
                                        {columnVisibility.qty && (
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    value={item.qty}
                                                    onChange={(e) => updateItem(index, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                                />
                                            </td>
                                        )}
                                        {columnVisibility.unitPrice && (
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                        )}
                                        {columnVisibility.discount && (
                                            <td className="px-2 py-2">
                                                <div className="flex items-center">
                                                    {/* Type Dropdown - Professional */}
                                                    <select
                                                        className="h-9 w-14 px-2 py-2 bg-gradient-to-b from-white to-gray-50 border border-gray-300 rounded-l-lg text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-sm hover:from-gray-50 hover:to-gray-100 transition-all"
                                                        value={item.discountType || 'percent'}
                                                        onChange={(e) => updateItem(index, 'discountType', e.target.value)}
                                                    >
                                                        <option value="percent">%</option>
                                                        <option value="fixed">₹</option>
                                                    </select>
                                                    {/* Value Input */}
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={item.discountType === 'fixed' ? 999999 : 100}
                                                        step="0.01"
                                                        placeholder="0"
                                                        className="h-9 w-20 px-3 py-2 border border-l-0 border-gray-300 rounded-r-lg text-sm text-right font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                                        value={item.discount || ''}
                                                        onChange={(e) => updateItem(index, 'discount', item.discountType === 'fixed' ? parseFloat(e.target.value) || 0 : Math.min(100, parseFloat(e.target.value) || 0))}
                                                    />
                                                </div>
                                            </td>
                                        )}
                                        {columnVisibility.tax && (
                                            <td className="px-2 py-2">
                                                <select
                                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                                    value={item.taxRate || 0}
                                                    onChange={(e) => updateItem(index, 'taxRate', parseFloat(e.target.value))}
                                                >
                                                    <option value="0">GST 0%</option>
                                                    <option value="5">GST 5%</option>
                                                    <option value="12">GST 12%</option>
                                                    <option value="18">GST 18%</option>
                                                    <option value="28">GST 28%</option>
                                                </select>
                                            </td>
                                        )}
                                        {columnVisibility.total && (
                                            <td className="px-2 py-2 text-right">
                                                <div className="font-semibold text-sm text-gray-900">
                                                    ₹{lineTotal ? lineTotal.lineTotal.toFixed(2) : '0.00'}
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-2 py-2 text-center">
                                            <button
                                                type="button"
                                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                                                onClick={() => deleteItem(index)}
                                                title="Delete item"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
