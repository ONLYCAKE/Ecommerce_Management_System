import React, { ReactNode } from 'react'
import { ArrowUp, ArrowDown, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

export type SortDirection = 'asc' | 'desc' | null
export type ColumnAlignment = 'left' | 'center' | 'right'

export interface Column<T = any> {
    key: string
    label: string
    sortable?: boolean
    align?: ColumnAlignment
    render?: (row: T) => ReactNode
    width?: string
}

export interface DataTableProps<T = any> {
    columns: Column<T>[]
    data: T[]
    currentPage: number
    totalPages: number
    pageSize: number
    onPageChange: (page: number) => void
    onPageSizeChange?: (size: number) => void
    sortColumn?: string
    sortDirection?: SortDirection
    onSort?: (column: string) => void
    emptyMessage?: string
    isLoading?: boolean
    stickyHeader?: boolean
    pageSizeOptions?: number[]
}

export default function DataTable<T = any>({
    columns,
    data,
    currentPage,
    totalPages,
    pageSize,
    onPageChange,
    onPageSizeChange,
    sortColumn,
    sortDirection,
    onSort,
    emptyMessage = 'No records found',
    isLoading = false,
    stickyHeader = true,
    pageSizeOptions = [5, 10, 20, 50]
}: DataTableProps<T>) {
    const getAlignmentClass = (align: ColumnAlignment = 'left') => {
        switch (align) {
            case 'center':
                return 'text-center'
            case 'right':
                return 'text-right'
            default:
                return 'text-left'
        }
    }

    const handleSort = (column: Column<T>) => {
        if (!column.sortable || !onSort) return
        onSort(column.key)
    }

    const renderSortIcon = (column: Column<T>) => {
        if (!column.sortable) return null

        const isActive = sortColumn === column.key

        return (
            <span className="inline-flex ml-1.5">
                {isActive && sortDirection === 'asc' && (
                    <ArrowUp size={14} className="text-primary" />
                )}
                {isActive && sortDirection === 'desc' && (
                    <ArrowDown size={14} className="text-primary" />
                )}
                {!isActive && (
                    <div className="opacity-30 group-hover:opacity-60 transition-opacity">
                        <ArrowUp size={14} />
                    </div>
                )}
            </span>
        )
    }

    const renderLoadingSkeleton = () => (
        <>
            {[...Array(5)].map((_, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                    {columns.map((col, colIdx) => (
                        <td key={colIdx} className="py-4 px-4">
                            <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }}></div>
                        </td>
                    ))}
                </tr>
            ))}
        </>
    )

    return (
        <div className="w-full">
            {/* Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
                            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-primary/10">
                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        className={`
                      px-4 py-3.5 text-xs font-bold uppercase tracking-wider
                      ${getAlignmentClass(column.align)}
                      ${column.sortable ? 'cursor-pointer select-none group hover:bg-slate-100 transition-colors' : ''}
                      text-primary
                    `}
                                        style={{ width: column.width }}
                                        onClick={() => handleSort(column)}
                                    >
                                        <div className={`flex items-center ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                            <span>{column.label}</span>
                                            {renderSortIcon(column)}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                renderLoadingSkeleton()
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                                                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                </svg>
                                            </div>
                                            <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data.map((row: any, rowIndex) => (
                                    <tr
                                        key={row.id || rowIndex}
                                        className="border-t border-gray-100 hover:bg-slate-50 transition-colors duration-150"
                                    >
                                        {columns.map((column) => (
                                            <td
                                                key={column.key}
                                                className={`px-4 py-3.5 text-sm font-medium text-gray-700 ${getAlignmentClass(column.align)}`}
                                            >
                                                {column.render ? column.render(row) : row[column.key]}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {data.length > 0 && totalPages > 0 && (
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-t border-gray-200 px-6 py-4">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            {/* Page Size Selector */}
                            {onPageSizeChange && (
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-gray-600">Rows per page:</label>
                                    <select
                                        className="input w-20 py-1.5 text-sm border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20"
                                        value={pageSize}
                                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                                    >
                                        {pageSizeOptions.map((size) => (
                                            <option key={size} value={size}>
                                                {size}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Page Info & Navigation */}
                            <div className="flex items-center gap-4 ml-auto">
                                <span className="text-sm font-medium text-gray-600">
                                    Page <span className="text-primary font-bold">{currentPage}</span> of{' '}
                                    <span className="text-primary font-bold">{totalPages}</span>
                                </span>

                                <div className="flex items-center gap-1">
                                    <button
                                        className="p-2 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 hover:shadow-sm"
                                        disabled={currentPage === 1}
                                        onClick={() => onPageChange(1)}
                                        title="First page"
                                    >
                                        <ChevronsLeft size={18} className="text-gray-700" />
                                    </button>
                                    <button
                                        className="p-2 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 hover:shadow-sm"
                                        disabled={currentPage === 1}
                                        onClick={() => onPageChange(currentPage - 1)}
                                        title="Previous page"
                                    >
                                        <ChevronLeft size={18} className="text-gray-700" />
                                    </button>
                                    <button
                                        className="p-2 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 hover:shadow-sm"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => onPageChange(currentPage + 1)}
                                        title="Next page"
                                    >
                                        <ChevronRight size={18} className="text-gray-700" />
                                    </button>
                                    <button
                                        className="p-2 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 hover:shadow-sm"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => onPageChange(totalPages)}
                                        title="Last page"
                                    >
                                        <ChevronsRight size={18} className="text-gray-700" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
