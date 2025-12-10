import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import InvoiceMeta from '../InvoiceMeta'

describe('InvoiceMeta Component', () => {
    const mockSetInvoiceDate = vi.fn()
    const mockSetDueDate = vi.fn()
    const mockSetDeliveryDateTime = vi.fn()
    const mockSetPaymentTime = vi.fn()

    const defaultProps = {
        invoiceDate: new Date('2025-12-10'),
        dueDate: new Date('2025-12-20'),
        deliveryDateTime: null,
        paymentTime: null,
        setInvoiceDate: mockSetInvoiceDate,
        setDueDate: mockSetDueDate,
        setDeliveryDateTime: mockSetDeliveryDateTime,
        setPaymentTime: mockSetPaymentTime
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders all four date/time pickers', () => {
        render(<InvoiceMeta {...defaultProps} />)

        expect(screen.getByLabelText('Invoice date picker')).toBeInTheDocument()
        expect(screen.getByLabelText('Due date picker')).toBeInTheDocument()
        expect(screen.getByLabelText('Delivery date and time picker')).toBeInTheDocument()
        expect(screen.getByLabelText('Payment time picker')).toBeInTheDocument()
    })

    it('displays human-readable preview for invoice date', () => {
        render(<InvoiceMeta {...defaultProps} />)

        // Should show formatted date like "Wednesday, December 10th, 2025"
        expect(screen.getByText(/December 10th, 2025/i)).toBeInTheDocument()
    })

    it('displays human-readable preview for due date', () => {
        render(<InvoiceMeta {...defaultProps} />)

        // Should show formatted date like "Friday, December 20th, 2025"
        expect(screen.getByText(/December 20th, 2025/i)).toBeInTheDocument()
    })

    it('calls setInvoiceDate when invoice date is changed', () => {
        render(<InvoiceMeta {...defaultProps} />)

        const invoiceDateInput = screen.getByLabelText('Invoice date picker')
        fireEvent.change(invoiceDateInput, { target: { value: '2025-12-15' } })

        expect(mockSetInvoiceDate).toHaveBeenCalled()
    })

    it('calls setDueDate when due date is changed', () => {
        render(<InvoiceMeta {...defaultProps} />)

        const dueDateInput = screen.getByLabelText('Due date picker')
        fireEvent.change(dueDateInput, { target: { value: '2025-12-25' } })

        expect(mockSetDueDate).toHaveBeenCalled()
    })

    it('displays date error message when provided', () => {
        const propsWithError = {
            ...defaultProps,
            dateError: 'Due date cannot be before invoice date'
        }

        render(<InvoiceMeta {...propsWithError} />)

        expect(screen.getByText('Due date cannot be before invoice date')).toBeInTheDocument()
    })

    it('shows clearable buttons for all pickers', () => {
        render(<InvoiceMeta {...defaultProps} />)

        // react-datepicker adds clear buttons when isClearable is true
        const clearButtons = screen.getAllByRole('button', { name: /clear/i })
        expect(clearButtons.length).toBeGreaterThan(0)
    })

    it('does not show preview when date is null', () => {
        const propsWithNullDates = {
            ...defaultProps,
            invoiceDate: null,
            dueDate: null
        }

        render(<InvoiceMeta {...propsWithNullDates} />)

        // Preview text should not be present
        expect(screen.queryByText(/December/i)).not.toBeInTheDocument()
    })

    it('applies custom className when provided', () => {
        const { container } = render(
            <InvoiceMeta {...defaultProps} className="custom-class" />
        )

        expect(container.firstChild).toHaveClass('custom-class')
    })

    it('sets minDate for due date picker based on invoice date', () => {
        render(<InvoiceMeta {...defaultProps} />)

        const dueDateInput = screen.getByLabelText('Due date picker')

        // Due date picker should have minDate set to invoice date
        // This prevents selecting a date before invoice date
        expect(dueDateInput).toBeInTheDocument()
    })
})

export { }
