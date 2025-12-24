import { FC } from 'react'
import DatePicker from 'react-datepicker'
import { format } from 'date-fns'
import { X } from 'lucide-react'
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
                    <div className="relative">
                        <DatePicker
                            id="invoice-date"
                            selected={invoiceDate}
                            onChange={setInvoiceDate}
                            dateFormat="dd-MM-yyyy"
                            placeholderText="Select invoice date"
                            aria-label="Invoice date picker"
                            className="input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                        />
                        {invoiceDate && (
                            <button
                                type="button"
                                onClick={() => setInvoiceDate(null)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                                title="Clear date"
                                aria-label="Clear invoice date"
                            >
                                <X size={16} strokeWidth={2} />
                            </button>
                        )}
                    </div>
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
                    <div className="relative">
                        <DatePicker
                            id="due-date"
                            selected={dueDate}
                            onChange={setDueDate}
                            dateFormat="dd-MM-yyyy"
                            placeholderText="Select due date"
                            aria-label="Due date picker"
                            minDate={invoiceDate || undefined}
                            className="input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                        />
                        {dueDate && (
                            <button
                                type="button"
                                onClick={() => setDueDate(null)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                                title="Clear date"
                                aria-label="Clear due date"
                            >
                                <X size={16} strokeWidth={2} />
                            </button>
                        )}
                    </div>
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
                    <div className="relative">
                        <DatePicker
                            id="delivery-datetime"
                            selected={deliveryDateTime}
                            onChange={setDeliveryDateTime}
                            dateFormat="dd MMM yyyy, HH:mm"
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            timeCaption="Time"
                            placeholderText="Select delivery date & time"
                            aria-label="Delivery date and time picker"
                            className="input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                            popperPlacement="top-start"
                            popperClassName="shadow-xl border border-gray-200 rounded-lg"
                            calendarClassName="!text-sm"
                        />
                        {deliveryDateTime && (
                            <button
                                type="button"
                                onClick={() => setDeliveryDateTime(null)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                                title="Clear date and time"
                                aria-label="Clear delivery date and time"
                            >
                                <X size={16} strokeWidth={2} />
                            </button>
                        )}
                    </div>
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
                    <div className="relative">
                        <DatePicker
                            id="payment-time"
                            selected={paymentTime}
                            onChange={setPaymentTime}
                            showTimeSelect
                            showTimeSelectOnly
                            timeIntervals={15}
                            timeCaption="Time"
                            dateFormat="HH:mm"
                            placeholderText="Select payment time"
                            aria-label="Payment time picker"
                            className="input w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                            popperPlacement="top-start"
                        />
                        {paymentTime && (
                            <button
                                type="button"
                                onClick={() => setPaymentTime(null)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                                title="Clear time"
                                aria-label="Clear payment time"
                            >
                                <X size={16} strokeWidth={2} />
                            </button>
                        )}
                    </div>
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
