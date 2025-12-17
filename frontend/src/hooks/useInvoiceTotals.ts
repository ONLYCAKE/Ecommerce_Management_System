import { useMemo } from 'react'

// Consistent rounding to 2 decimal places
function roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100
}

export interface InvoiceItem {
    id?: string
    productId?: number
    title: string
    description?: string
    qty: number
    unitPrice: number
    taxRate: number
    discount: number
    discountType?: 'percent' | 'fixed'  // NEW: Discount type - percentage or fixed amount
    uom?: string
    hsnCode?: string
}

export interface InvoiceTotals {
    subtotal: number
    taxableAmount: number
    cgst: number
    sgst: number
    igst: number
    totalTax: number
    discount: number
    roundOff: number
    grandTotal: number
    perLineTotals: LineTotal[]
}

export interface LineTotal {
    id?: string
    lineSubtotal: number
    lineDiscount: number
    lineTaxable: number
    lineTax: number
    lineTotal: number
}

interface InvoiceMeta {
    buyerState?: string
    sellerState?: string
    globalDiscountPct?: number
}

const SELLER_STATE = 'Gujarat' // Company state

export function useInvoiceTotals(
    items: InvoiceItem[],
    meta: InvoiceMeta = {}
): InvoiceTotals {
    return useMemo(() => {
        const { buyerState = '', globalDiscountPct = 0 } = meta
        const sellerState = meta.sellerState || SELLER_STATE

        // Calculate per-line totals with consistent rounding
        const perLineTotals: LineTotal[] = items.map((item) => {
            const lineSubtotal = roundToTwoDecimals(item.qty * item.unitPrice)
            const lineDiscount = roundToTwoDecimals(lineSubtotal * (item.discount / 100))
            const lineTaxable = roundToTwoDecimals(lineSubtotal - lineDiscount)
            const lineTax = roundToTwoDecimals(lineTaxable * (item.taxRate / 100))
            const lineTotal = roundToTwoDecimals(lineTaxable + lineTax)

            return {
                id: item.id,
                lineSubtotal,
                lineDiscount,
                lineTaxable,
                lineTax,
                lineTotal
            }
        })

        // Sum up all lines with rounding
        const subtotal = roundToTwoDecimals(perLineTotals.reduce((sum, line) => sum + line.lineSubtotal, 0))
        const itemDiscount = roundToTwoDecimals(perLineTotals.reduce((sum, line) => sum + line.lineDiscount, 0))

        // Apply global discount
        const subtotalAfterItemDiscount = roundToTwoDecimals(subtotal - itemDiscount)
        const globalDiscount = roundToTwoDecimals(subtotalAfterItemDiscount * (globalDiscountPct / 100))
        const taxableAmount = roundToTwoDecimals(subtotalAfterItemDiscount - globalDiscount)

        const totalDiscount = roundToTwoDecimals(itemDiscount + globalDiscount)

        // Calculate tax based on state
        const isSameState = buyerState.toLowerCase() === sellerState.toLowerCase()

        let cgst = 0
        let sgst = 0
        let igst = 0
        let totalTax = 0

        if (isSameState) {
            // Same state: CGST + SGST
            perLineTotals.forEach((line, idx) => {
                const item = items[idx]
                const taxAmount = roundToTwoDecimals(line.lineTaxable * (item.taxRate / 100))
                cgst += roundToTwoDecimals(taxAmount / 2)
                sgst += roundToTwoDecimals(taxAmount / 2)
            })
            cgst = roundToTwoDecimals(cgst)
            sgst = roundToTwoDecimals(sgst)
            totalTax = roundToTwoDecimals(cgst + sgst)
        } else {
            // Different state: IGST
            perLineTotals.forEach((line, idx) => {
                const item = items[idx]
                igst += roundToTwoDecimals(line.lineTaxable * (item.taxRate / 100))
            })
            igst = roundToTwoDecimals(igst)
            totalTax = igst
        }

        // Calculate grand total - round to 2 decimals (NOT whole number)
        const grandTotal = roundToTwoDecimals(taxableAmount + totalTax)
        const roundOff = 0 // No round-off when using 2 decimal precision

        return {
            subtotal,
            taxableAmount,
            cgst,
            sgst,
            igst,
            totalTax,
            discount: totalDiscount,
            roundOff,
            grandTotal,
            perLineTotals
        }
    }, [items, meta])
}

