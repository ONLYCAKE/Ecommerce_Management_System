import { InvoiceItem } from '../../hooks/useInvoiceTotals'

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
}

export default function InvoiceTable({ items, onChange, perLineTotals = [] }: InvoiceTableProps) {
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

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 w-8">#</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700">Product</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold text-gray-700 w-24">HSN/SAC</th>
                        <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 w-20">Qty</th>
                        <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 w-28">Unit Price</th>
                        <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 w-24">Discount %</th>
                        <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 w-24">Tax %</th>
                        <th className="px-2 py-3 text-right text-xs font-semibold text-gray-700 w-32">Total</th>
                        <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 w-20">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                No items added yet. Search and add products above.
                            </td>
                        </tr>
                    ) : (
                        items.map((item, index) => {
                            const lineTotal = perLineTotals[index]
                            return (
                                <tr key={item.id || index} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-2 py-2 text-center">
                                        <div className="flex flex-col gap-1">
                                            <button
                                                type="button"
                                                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                onClick={() => moveItem(index, index - 1)}
                                                disabled={index === 0}
                                                title="Move up"
                                            >
                                                ▲
                                            </button>
                                            <span className="text-sm text-gray-600">{index + 1}</span>
                                            <button
                                                type="button"
                                                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
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
                                    <td className="px-2 py-2">
                                        <div className="text-xs font-mono text-gray-600">{item.hsnCode || '-'}</div>
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            min="1"
                                            className="input w-full text-center text-sm"
                                            value={item.qty}
                                            onChange={(e) => updateItem(index, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="input w-full text-right text-sm"
                                            value={item.unitPrice}
                                            onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            className="input w-full text-right text-sm"
                                            value={item.discount}
                                            onChange={(e) => updateItem(index, 'discount', Math.min(100, parseFloat(e.target.value) || 0))}
                                        />
                                    </td>
                                    <td className="px-2 py-2">
                                        <select
                                            className="input w-full text-sm"
                                            value={item.taxRate}
                                            onChange={(e) => updateItem(index, 'taxRate', parseFloat(e.target.value))}
                                        >
                                            <option value="0">GST 0%</option>
                                            <option value="5">GST 5%</option>
                                            <option value="12">GST 12%</option>
                                            <option value="18">GST 18%</option>
                                            <option value="28">GST 28%</option>
                                            <option value="0">IGST 0%</option>
                                            <option value="5">IGST 5%</option>
                                            <option value="12">IGST 12%</option>
                                            <option value="18">IGST 18%</option>
                                            <option value="28">IGST 28%</option>
                                        </select>
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                        <div className="font-medium text-sm text-gray-900">
                                            ₹{lineTotal ? lineTotal.lineTotal.toFixed(2) : '0.00'}
                                        </div>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                        <button
                                            type="button"
                                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                                            onClick={() => deleteItem(index)}
                                            title="Delete item"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            )
                        })
                    )}
                </tbody>
            </table>
        </div>
    )
}
