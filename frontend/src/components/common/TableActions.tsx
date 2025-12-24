import React from 'react'
import { LucideIcon } from 'lucide-react'

export interface ActionButton {
    label: string
    icon: LucideIcon
    onClick: () => void
    color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'gray'
    show?: boolean
}

interface TableActionsProps {
    actions: ActionButton[]
    align?: 'left' | 'center' | 'right'
}

const colorClasses = {
    blue: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
    green: 'text-green-600 hover:text-green-700 hover:bg-green-50',
    red: 'text-red-600 hover:text-red-700 hover:bg-red-50',
    orange: 'text-orange-600 hover:text-orange-700 hover:bg-orange-50',
    purple: 'text-purple-600 hover:text-purple-700 hover:bg-purple-50',
    gray: 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
}

export default function TableActions({ actions, align = 'right' }: TableActionsProps) {
    const visibleActions = actions.filter(action => action.show !== false)

    if (visibleActions.length === 0) return null

    const alignmentClass = align === 'center' ? 'justify-center' : align === 'left' ? 'justify-start' : 'justify-end'

    return (
        <div className={`flex items-center gap-1 ${alignmentClass}`}>
            {visibleActions.map((action, index) => {
                const Icon = action.icon
                const colorClass = colorClasses[action.color || 'blue']

                return (
                    <button
                        key={index}
                        className={`
              group relative px-2.5 py-1.5 text-sm font-medium rounded-md
              transition-all duration-150
              ${colorClass}
            `}
                        onClick={action.onClick}
                        title={action.label}
                    >
                        <Icon size={16} strokeWidth={2} />

                        {/* Tooltip */}
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            {action.label}
                            <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></span>
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
