import React from 'react';

interface StatusChipProps {
    status: string;
}

export default function StatusChip({ status }: StatusChipProps) {
    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
            case 'processing':
                return 'bg-yellow-100 text-yellow-700';
            case 'paid':
            case 'completed':
                return 'bg-green-100 text-green-700';
            case 'draft':
                return 'bg-gray-100 text-gray-700';
            default:
                return 'bg-blue-100 text-blue-700';
        }
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
            {status}
        </span>
    );
}
