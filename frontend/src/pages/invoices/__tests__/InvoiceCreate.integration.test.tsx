import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import InvoiceCreate from '../InvoiceCreate'
import * as api from '../../../api/client'

// Mock the API client
vi.mock('../../../api/client', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}))

// Mock child components to simplify testing
vi.mock('../../../components/invoice/CustomerSelect', () => ({
    default: ({ onChange }: any) => (
        <button onClick={() => onChange({ id: 1, name: 'Test Customer', state: 'Gujarat' })}>
            Select Customer
        </button>
    )
}))

vi.mock('../../../components/invoice/ProductSearch', () => ({
    default: ({ onAdd }: any) => (
        <button onClick={() => onAdd({ id: 1, title: 'Test Product', price: 100 }, 1)}>
            Add Product
        </button>
    )
}))

vi.mock('../../../components/invoice/InvoiceTable', () => ({
    default: () => <div>Invoice Table</div>
}))

vi.mock('../../../components/invoice/TotalsPanel', () => ({
    default: () => <div>Totals Panel</div>
}))

vi.mock('../../../components/invoice/PaymentPanel', () => ({
    default: () => <div>Payment Panel</div>
}))

vi.mock('../../../components/invoice/SignaturePanel', () => ({
    default: () => <div>Signature Panel</div>
}))

vi.mock('../../../hooks/useInvoiceTotals', () => ({
    useInvoiceTotals: () => ({
        subtotal: 100,
        cgst: 9,
        sgst: 9,
        igst: 0,
        grandTotal: 118,
        perLineTotals: []
    })
}))

describe('InvoiceCreate Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
            // Mock API responses
            ; (api.default.get as any).mockResolvedValue({
                data: { invoiceNo: 'INV-001' }
            })
            ; (api.default.post as any).mockResolvedValue({
                data: { invoiceNo: 'INV-001' }
            })
    })

    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <InvoiceCreate />
            </BrowserRouter>
        )
    }

    it('blocks save when due date is before invoice date', async () => {
        renderComponent()

        // Wait for component to load
        await waitFor(() => {
            expect(screen.getByText('Create Invoice')).toBeInTheDocument()
        })

        // Select customer
        const selectCustomerBtn = screen.getByText('Select Customer')
        fireEvent.click(selectCustomerBtn)

        // Add product
        const addProductBtn = screen.getByText('Add Product')
        fireEvent.click(addProductBtn)

        // Set invoice date to today
        const invoiceDatePicker = screen.getByLabelText('Invoice date picker')
        const today = new Date()
        fireEvent.change(invoiceDatePicker, { target: { value: today.toISOString().split('T')[0] } })

        // Set due date to yesterday (invalid)
        const dueDatePicker = screen.getByLabelText('Due date picker')
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        fireEvent.change(dueDatePicker, { target: { value: yesterday.toISOString().split('T')[0] } })

        // Try to save
        const saveButton = screen.getAllByText(/Save/i)[0]
        fireEvent.click(saveButton)

        // Should show error message
        await waitFor(() => {
            expect(screen.getByText('Due date cannot be before invoice date')).toBeInTheDocument()
        })

        // API should not be called
        expect(api.default.post).not.toHaveBeenCalled()
    })

    it('allows save when due date is after invoice date', async () => {
        renderComponent()

        await waitFor(() => {
            expect(screen.getByText('Create Invoice')).toBeInTheDocument()
        })

        // Select customer
        const selectCustomerBtn = screen.getByText('Select Customer')
        fireEvent.click(selectCustomerBtn)

        // Add product
        const addProductBtn = screen.getByText('Add Product')
        fireEvent.click(addProductBtn)

        // Set invoice date to today
        const invoiceDatePicker = screen.getByLabelText('Invoice date picker')
        const today = new Date()
        fireEvent.change(invoiceDatePicker, { target: { value: today.toISOString().split('T')[0] } })

        // Set due date to tomorrow (valid)
        const dueDatePicker = screen.getByLabelText('Due date picker')
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        fireEvent.change(dueDatePicker, { target: { value: tomorrow.toISOString().split('T')[0] } })

        // Try to save
        const saveButton = screen.getAllByText(/Save/i)[0]
        fireEvent.click(saveButton)

        // Should not show error message
        await waitFor(() => {
            expect(screen.queryByText('Due date cannot be before invoice date')).not.toBeInTheDocument()
        })

        // API should be called
        await waitFor(() => {
            expect(api.default.post).toHaveBeenCalled()
        })
    })

    it('formats dates correctly in save payload', async () => {
        renderComponent()

        await waitFor(() => {
            expect(screen.getByText('Create Invoice')).toBeInTheDocument()
        })

        // Select customer
        const selectCustomerBtn = screen.getByText('Select Customer')
        fireEvent.click(selectCustomerBtn)

        // Add product
        const addProductBtn = screen.getByText('Add Product')
        fireEvent.click(addProductBtn)

        // Set dates
        const invoiceDatePicker = screen.getByLabelText('Invoice date picker')
        const dueDatePicker = screen.getByLabelText('Due date picker')

        fireEvent.change(invoiceDatePicker, { target: { value: '2025-12-10' } })
        fireEvent.change(dueDatePicker, { target: { value: '2025-12-20' } })

        // Try to save
        const saveButton = screen.getAllByText(/Save/i)[0]
        fireEvent.click(saveButton)

        // Check API call payload
        await waitFor(() => {
            expect(api.default.post).toHaveBeenCalledWith(
                '/invoices',
                expect.objectContaining({
                    invoiceDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
                    dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
                })
            )
        })
    })

    it('includes optional delivery date/time and payment time in payload when provided', async () => {
        renderComponent()

        await waitFor(() => {
            expect(screen.getByText('Create Invoice')).toBeInTheDocument()
        })

        // Select customer and add product
        fireEvent.click(screen.getByText('Select Customer'))
        fireEvent.click(screen.getByText('Add Product'))

        // Set delivery date/time
        const deliveryDateTimePicker = screen.getByLabelText('Delivery date and time picker')
        fireEvent.change(deliveryDateTimePicker, { target: { value: '2025-12-15T14:30' } })

        // Set payment time
        const paymentTimePicker = screen.getByLabelText('Payment time picker')
        fireEvent.change(paymentTimePicker, { target: { value: '14:30' } })

        // Save
        const saveButton = screen.getAllByText(/Save/i)[0]
        fireEvent.click(saveButton)

        // Check payload includes formatted datetime and time
        await waitFor(() => {
            expect(api.default.post).toHaveBeenCalledWith(
                '/invoices',
                expect.objectContaining({
                    deliveryDateTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/), // ISO format
                    paymentTime: expect.stringMatching(/^\d{2}:\d{2}$/) // HH:mm format
                })
            )
        })
    })
})

export { }
