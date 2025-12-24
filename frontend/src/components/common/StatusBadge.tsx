import React from 'react'

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'purple' | 'gray' | 'indigo' | 'teal'
export type BadgeSize = 'sm' | 'md' | 'lg'

interface StatusBadgeProps {
    label: string | number
    variant?: BadgeVariant
    size?: BadgeSize
    icon?: React.ReactNode
    className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    teal: 'bg-teal-100 text-teal-800 border-teal-200'
}

const sizeClasses: Record<BadgeSize, string> = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
}

export default function StatusBadge({
    label,
    variant = 'gray',
    size = 'sm',
    icon,
    className = ''
}: StatusBadgeProps) {
    return (
        <span
            className={`
        inline-flex items-center gap-1.5 
        font-semibold rounded-full border
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
        >
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span>{label}</span>
        </span>
    )
}

// Preset badges for common use cases
export function RoleBadge({ role }: { role: string }) {
    const variant =
        role === 'SuperAdmin' ? 'purple' :
            role === 'Admin' ? 'info' :
                'success'

    return <StatusBadge label={role} variant={variant} />
}

export function StockBadge({ stock }: { stock: number }) {
    const variant =
        stock === 0 ? 'error' :
            stock < 10 ? 'warning' :
                stock < 50 ? 'info' :
                    'success'

    const label =
        stock === 0 ? 'Out of Stock' :
            stock < 10 ? 'Low Stock' :
                stock < 50 ? 'Medium' :
                    'In Stock'

    return <StatusBadge label={`${label} (${stock})`} variant={variant} />
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
    return (
        <StatusBadge
            label={isActive ? 'Active' : 'Inactive'}
            variant={isActive ? 'success' : 'gray'}
        />
    )
}

export function ArchivedBadge({ isArchived }: { isArchived: boolean }) {
    return isArchived ? (
        <StatusBadge label="Archived" variant="error" />
    ) : (
        <StatusBadge label="Active" variant="success" />
    )
}
