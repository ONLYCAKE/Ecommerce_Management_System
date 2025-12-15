/**
 * Calculate invoice status based on received amount
 * Status logic:
 * - received_amount == 0 → Unpaid (red)
 * - 0 < received_amount < total → Partial (orange)
 * - received_amount >= total → Paid (green)
 */
export function calculateInvoiceStatus(
    total: number,
    receivedAmount: number
): {
    label: 'Unpaid' | 'Partial' | 'Paid';
    color: 'red' | 'orange' | 'green';
    bgColor: string;
    textColor: string;
} {
    if (receivedAmount === 0) {
        return {
            label: 'Unpaid',
            color: 'red',
            bgColor: 'bg-red-100',
            textColor: 'text-red-700'
        };
    }

    if (receivedAmount < total) {
        return {
            label: 'Partial',
            color: 'orange',
            bgColor: 'bg-orange-100',
            textColor: 'text-orange-700'
        };
    }

    return {
        label: 'Paid',
        color: 'green',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700'
    };
}

/**
 * Format currency to INR
 */
export function formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
