import { useState } from 'react';
import { Bell, Check, X, Loader2 } from 'lucide-react';
import api from '../api/client';
import { toast } from 'react-hot-toast';

interface ReminderBellProps {
    invoiceNo: string;
    status: string;
    buyerEmail?: string;
    onSuccess?: () => void;
}

export default function ReminderBell({ invoiceNo, status, buyerEmail, onSuccess }: ReminderBellProps) {
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState(false);

    // Only show for Pending/Processing invoices with buyer email
    if (!['Pending', 'Processing'].includes(status) || !buyerEmail) {
        return null;
    }

    const handleSendReminder = async () => {
        setLoading(true);
        setError(false);

        try {
            const response = await api.post(`/invoices/${invoiceNo}/send-reminder`, {});

            if (response.data.success) {
                setSent(true);
                toast.success('Reminder sent successfully!');

                // Reset icon after 2 seconds
                setTimeout(() => setSent(false), 2000);

                if (onSuccess) onSuccess();
            }
        } catch (err: any) {
            setError(true);
            toast.error(err.response?.data?.message || 'Failed to send reminder');

            // Reset icon after 2 seconds
            setTimeout(() => setError(false), 2000);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleSendReminder}
            disabled={loading || sent}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            title={buyerEmail ? `Send reminder to ${buyerEmail}` : 'No email on file'}
            data-testid={`reminder-bell-${invoiceNo}`}
        >
            {loading && <Loader2 size={16} className="animate-spin text-blue-600" data-testid="spinner" />}
            {sent && <Check size={16} className="text-green-600" data-testid="success-icon" />}
            {error && <X size={16} className="text-red-600" data-testid="error-icon" />}
            {!loading && !sent && !error && <Bell size={16} className="text-gray-600" />}
        </button>
    );
}
