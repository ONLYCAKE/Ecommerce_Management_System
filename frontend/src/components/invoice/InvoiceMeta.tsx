import { FC } from 'react'
import DatePicker from 'react-datepicker'
import { format } from 'date-fns'
import 'react-datepicker/dist/react-datepicker.css'
import './InvoiceMeta.css'

interface InvoiceMetaProps {
    invoiceDate: Date | null
    dueDate: Date | null
    deliveryDateTime: Date | null
    paymentTime: Date | null
    setInvoiceDate: (d: Date | null) => void
    setDueDate: (d: Date | null) => void
    setDeliveryDateTime: (d: Date | null) => void
    setPaymentTime: (d: Date | null) => void
    className?: string
    dateError?: string
}

const InvoiceMeta: FC<InvoiceMetaProps> = ({
    invoiceDate,
    dueDate,
    deliveryDateTime,
    paymentTime,
    setInvoiceDate,
    setDueDate,
    setDeliveryDateTime,
    setPaymentTime,
    className = '',
    dateError
}) => {
    // Format preview text
    const formatPreview = (date: Date | null, formatStr: string): string => {
        if (!date) return ''
        try {
            return format(date, formatStr)
        } catch {
            return ''
        }
    }

    return (
        <div className={`space-y-4 ${className}`}>
            <h3 className="font-semibold text-gray-800 mb-4">Invoice Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Invoice Date - Date Only */}
                <div>
                    <label
                        htmlFor="invoice-date"
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Invoice Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                        id="invoice-date"
                        selected={invoiceDate}
                        onChange={setInvoiceDate}
                        dateFormat="dd-MM-yyyy"
                        isClearable
                        placeholderText="Select invoice date"
                        aria-label="Invoice date picker"
                        className="input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {invoiceDate && (
                        <p className="text-xs text-gray-500 mt-1">
                            {formatPreview(invoiceDate, 'EEEE, MMMM do, yyyy')}
                        </p>
                    )}
                </div>

                {/* Due Date - Date Only */}
                <div>
                    <label
                        htmlFor="due-date"
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Due Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                        id="due-date"
                        selected={dueDate}
                        onChange={setDueDate}
                        dateFormat="dd-MM-yyyy"
                        isClearable
                        placeholderText="Select due date"
                        aria-label="Due date picker"
                        minDate={invoiceDate || undefined}
                        className="input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {dueDate && (
                        <p className="text-xs text-gray-500 mt-1">
                            {formatPreview(dueDate, 'EEEE, MMMM do, yyyy')}
                        </p>
                    )}
                    {dateError && (
                        <p className="text-xs text-red-600 mt-1 font-medium">{dateError}</p>
                    )}
                </div>

                {/* Delivery Date & Time - Date + Time */}
                <div>
                    <label
                        htmlFor="delivery-datetime"
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Delivery Date & Time
                    </label>
                    <DatePicker
                        id="delivery-datetime"
                        selected={deliveryDateTime}
                        onChange={setDeliveryDateTime}
                        dateFormat="dd-MM-yyyy HH:mm"
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        isClearable
                        placeholderText="Select delivery date & time"
                        aria-label="Delivery date and time picker"
                        className="input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {deliveryDateTime && (
                        <p className="text-xs text-gray-500 mt-1">
                            {formatPreview(deliveryDateTime, 'EEE, MMM do, yyyy @ h:mm a')}
                        </p>
                    )}
                </div>

                {/* Payment Time - Time Only */}
                <div>
                    <label
                        htmlFor="payment-time"
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Payment Time
                    </label>
                    <DatePicker
                        id="payment-time"
                        selected={paymentTime}
                        onChange={setPaymentTime}
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={15}
                        timeCaption="Time"
                        dateFormat="HH:mm"
                        isClearable
                        placeholderText="Select payment time"
                        aria-label="Payment time picker"
                        className="input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {paymentTime && (
                        <p className="text-xs text-gray-500 mt-1">
                            {formatPreview(paymentTime, 'h:mm a')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default InvoiceMeta
