import { useMemo } from 'react'

export interface InvoiceItem {
    id?: string
    productId?: number
    title: string
    description?: string
    qty: number
    unitPrice: number
    taxRate: number
    discount: number
    uom?: string
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

        // Calculate per-line totals
        const perLineTotals: LineTotal[] = items.map((item) => {
            const lineSubtotal = item.qty * item.unitPrice
            const lineDiscount = lineSubtotal * (item.discount / 100)
            const lineTaxable = lineSubtotal - lineDiscount
            const lineTax = lineTaxable * (item.taxRate / 100)
            const lineTotal = lineTaxable + lineTax

            return {
                id: item.id,
                lineSubtotal,
                lineDiscount,
                lineTaxable,
                lineTax,
                lineTotal
            }
        })

        // Sum up all lines
        const subtotal = perLineTotals.reduce((sum, line) => sum + line.lineSubtotal, 0)
        const itemDiscount = perLineTotals.reduce((sum, line) => sum + line.lineDiscount, 0)

        // Apply global discount
        const subtotalAfterItemDiscount = subtotal - itemDiscount
        const globalDiscount = subtotalAfterItemDiscount * (globalDiscountPct / 100)
        const taxableAmount = subtotalAfterItemDiscount - globalDiscount

        const totalDiscount = itemDiscount + globalDiscount

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
                const taxAmount = line.lineTaxable * (item.taxRate / 100)
                cgst += taxAmount / 2
                sgst += taxAmount / 2
            })
            totalTax = cgst + sgst
        } else {
            // Different state: IGST
            perLineTotals.forEach((line, idx) => {
                const item = items[idx]
                igst += line.lineTaxable * (item.taxRate / 100)
            })
            totalTax = igst
        }

        // Calculate grand total
        const beforeRound = taxableAmount + totalTax
        const roundOff = Math.round(beforeRound) - beforeRound
        const grandTotal = Math.round(beforeRound)

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
