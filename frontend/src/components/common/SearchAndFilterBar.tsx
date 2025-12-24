import React, { ReactNode } from 'react'
import { Search, Filter } from 'lucide-react'

interface SearchAndFilterBarProps {
    searchValue: string
    onSearchChange: (value: string) => void
    searchPlaceholder?: string
    filters?: ReactNode
    actions?: ReactNode
}

export default function SearchAndFilterBar({
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Search...',
    filters,
    actions
}: SearchAndFilterBarProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Left Side - Search & Filters */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1 w-full sm:w-auto">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[280px] max-w-lg">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            placeholder={searchPlaceholder}
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                        {searchValue && (
                            <button
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                onClick={() => onSearchChange('')}
                                aria-label="Clear search"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Filters */}
                    {filters && (
                        <div className="flex items-center gap-2 flex-wrap">
                            {filters}
                        </div>
                    )}
                </div>

                {/* Right Side - Actions */}
                {actions && (
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    )
}

interface FilterSelectProps {
    label: string
    value: string | number
    options: Array<{ label: string; value: string | number }>
    onChange: (value: string | number) => void
    icon?: React.ReactNode
}

export function FilterSelect({ label, value, options, onChange, icon }: FilterSelectProps) {
    return (
        <div className="flex items-center gap-2">
            {icon && <span className="text-gray-500">{icon}</span>}
            <select
                className="input py-2 px-3 pr-8 border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    )
}

interface FilterCheckboxProps {
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
    icon?: React.ReactNode
}

export function FilterCheckbox({ label, checked, onChange, icon }: FilterCheckboxProps) {
    return (
        <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-all">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary/20 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                {icon}
                {label}
            </span>
        </label>
    )
}
