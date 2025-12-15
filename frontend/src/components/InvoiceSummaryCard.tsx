import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatCurrency } from '../utils/invoiceStatus';

interface SummaryData {
    totalSales: number;
    totalReceived: number;
    totalBalance: number;
    count: number;
}

interface InvoiceSummaryCardProps {
    filters?: {
        status?: string;
        paymentMethod?: string;
    };
}

export default function InvoiceSummaryCard({ filters }: InvoiceSummaryCardProps) {
    const [summary, setSummary] = useState<SummaryData>({
        totalSales: 0,
        totalReceived: 0,
        totalBalance: 0,
        count: 0
    });
    const [loading, setLoading] = useState(true);

    const fetchSummary = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters?.status) params.append('status', filters.status);
            if (filters?.paymentMethod) params.append('paymentMethod', filters.paymentMethod);

            const { data } = await api.get(`/invoices/summary?${params.toString()}`);
            setSummary(data);
        } catch (error) {
            console.error('Failed to fetch summary:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, [filters?.status, filters?.paymentMethod]);

    // Expose refresh function for parent components
    useEffect(() => {
        (window as any).refreshInvoiceSummary = fetchSummary;
        return () => {
            delete (window as any).refreshInvoiceSummary;
        };
    }, [filters]);

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-20 bg-gray-200 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-500 mb-1">Total Invoices</span>
                    <span className="text-2xl font-bold text-gray-900">{summary.count}</span>
                </div>

                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-500 mb-1">Total Sales</span>
                    <span className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalSales)}</span>
                </div>

                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-500 mb-1">Received</span>
                    <span className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalReceived)}</span>
                </div>

                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-500 mb-1">Balance</span>
                    <span className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalBalance)}</span>
                </div>
            </div>
        </div>
    );
}
