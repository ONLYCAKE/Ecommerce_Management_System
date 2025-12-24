import { useEffect, useState } from 'react'
import api from '../api/client'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '../utils/invoiceStatus'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'

interface PaymentRecord {
    id: number
    invoiceNo: string
    paymentDate: string
    paidAmount: number
    roundOff: number
    remainingBalance: number
    paymentMethod: string
    reference: string
    addedBy: string
    invoiceTotal: number
    invoiceStatus: string
}

export default function PaymentRecordsView() {
    const [payments, setPayments] = useState<PaymentRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [socket, setSocket] = useState<Socket | null>(null)
    const navigate = useNavigate()

    const loadPaymentRecords = async () => {
        try {
            setLoading(true)
            const { data } = await api.get('/payments/records')
            setPayments(data)
        } catch (error) {
            console.error('Failed to load payment records:', error)
            toast.error('Failed to load payment records')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadPaymentRecords()

        // Socket.IO DISABLED - not implemented in NestJS backend
        // const socketUrl = (import.meta as any).env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'
        // const newSocket = io(socketUrl)
        // newSocket.on('connected', () => { console.log('✅ PaymentRecordsView connected to real-time server') })
        // newSocket.on('payment.created', () => { console.log('🔄 Payment created - refreshing payment records'); loadPaymentRecords() })
        // newSocket.on('payment.updated', () => { console.log('🔄 Payment updated - refreshing payment records'); loadPaymentRecords() })
        // newSocket.on('payment.deleted', () => { console.log('🔄 Payment deleted - refreshing payment records'); loadPaymentRecords() })
        // newSocket.on('invoice.updated', () => { console.log('🔄 Invoice updated - refreshing payment records'); loadPaymentRecords() })
        // setSocket(newSocket)
        // return () => { newSocket.disconnect() }
    }, [])

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="text-gray-500">Loading payment records...</div>
            </div>
        )
    }

    if (payments.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-md p-8 text-center">
                <p className="text-gray-500">No payment records found</p>
                <p className="text-sm text-gray-400 mt-2">
                    Payment records will appear here when invoices receive payments.
                </p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="border-b-2 border-gray-200 bg-gray-50">
                        <tr>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Invoice No
                            </th>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Payment Date
                            </th>
                            <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Paid Amount
                            </th>
                            <th className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Remaining Balance
                            </th>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Payment Method
                            </th>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Reference
                            </th>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Added By
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {payments.map((payment) => (
                            <tr
                                key={payment.id}
                                className="hover:bg-gray-50 transition-colors"
                            >
                                <td className="px-4 py-4">
                                    <div className="font-medium text-gray-900">
                                        {payment.invoiceNo}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Total: {formatCurrency(payment.invoiceTotal)}
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-gray-700">
                                    {formatDate(payment.paymentDate)}
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <div className="font-medium text-green-600">
                                        {formatCurrency(payment.paidAmount)}
                                    </div>
                                    {payment.roundOff > 0 && (
                                        <div className="text-xs text-blue-600">
                                            +{formatCurrency(payment.roundOff)} round-off
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <div className="font-medium text-orange-600">
                                        {formatCurrency(payment.remainingBalance)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {((payment.remainingBalance / payment.invoiceTotal) * 100).toFixed(0)}% pending
                                    </div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {payment.paymentMethod}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-gray-600">
                                    {payment.reference}
                                </td>
                                <td className="px-4 py-4 text-gray-600">
                                    {payment.addedBy}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Summary Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex justify-between items-center text-sm">
                    <div className="text-gray-600">
                        Showing {payments.length} payment record{payments.length !== 1 ? 's' : ''}
                    </div>
                    <div className="flex gap-6">
                        <div>
                            <span className="text-gray-600">Total Paid: </span>
                            <span className="font-semibold text-green-600">
                                {formatCurrency(payments.reduce((sum, p) => sum + p.paidAmount, 0))}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-600">Total Remaining: </span>
                            <span className="font-semibold text-orange-600">
                                {formatCurrency(payments.reduce((sum, p) => sum + p.remainingBalance, 0))}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
