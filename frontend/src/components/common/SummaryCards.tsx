import React, { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

export interface SummaryCard {
    title: string
    value: string | number
    icon: LucideIcon
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo' | 'teal'
    subtitle?: string
}

interface SummaryCardsProps {
    cards: SummaryCard[]
}

const colorClasses = {
    blue: {
        bg: 'from-blue-500 to-blue-600',
        icon: 'bg-blue-100 text-blue-600',
        text: 'text-blue-50'
    },
    green: {
        bg: 'from-green-500 to-green-600',
        icon: 'bg-green-100 text-green-600',
        text: 'text-green-50'
    },
    purple: {
        bg: 'from-purple-500 to-purple-600',
        icon: 'bg-purple-100 text-purple-600',
        text: 'text-purple-50'
    },
    orange: {
        bg: 'from-orange-500 to-orange-600',
        icon: 'bg-orange-100 text-orange-600',
        text: 'text-orange-50'
    },
    red: {
        bg: 'from-red-500 to-red-600',
        icon: 'bg-red-100 text-red-600',
        text: 'text-red-50'
    },
    indigo: {
        bg: 'from-indigo-500 to-indigo-600',
        icon: 'bg-indigo-100 text-indigo-600',
        text: 'text-indigo-50'
    },
    teal: {
        bg: 'from-teal-500 to-teal-600',
        icon: 'bg-teal-100 text-teal-600',
        text: 'text-teal-50'
    }
}

export default function SummaryCards({ cards }: SummaryCardsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((card, index) => {
                const Icon = card.icon
                const colors = colorClasses[card.color || 'blue']

                return (
                    <div
                        key={index}
                        className={`
              relative overflow-hidden rounded-xl shadow-lg
              bg-gradient-to-br ${colors.bg}
              transform transition-all duration-300 hover:scale-105 hover:shadow-xl
            `}
                    >
                        {/* Decorative Background Pattern */}
                        <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-full -mr-12 -mt-12"></div>
                            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white rounded-full -ml-8 -mb-8"></div>
                        </div>

                        <div className="relative p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className={`text-sm font-medium ${colors.text} opacity-90`}>
                                        {card.title}
                                    </p>
                                    <h3 className="text-3xl font-bold text-white mt-1">
                                        {card.value}
                                    </h3>
                                    {card.subtitle && (
                                        <p className={`text-xs ${colors.text} opacity-80 mt-1`}>
                                            {card.subtitle}
                                        </p>
                                    )}
                                </div>
                                <div className={`${colors.icon} p-3 rounded-lg shadow-md`}>
                                    <Icon size={24} strokeWidth={2} />
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
