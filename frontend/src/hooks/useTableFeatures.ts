import { useState, useMemo } from 'react'

export type SortDirection = 'asc' | 'desc' | undefined

export interface UseSortReturn<T> {
    sortColumn: string | undefined
    sortDirection: SortDirection
    handleSort: (column: string) => void
    sortedData: T[]
}

/**
 * Custom hook for table sorting
 * @param data - Array of data to be sorted
 * @param initialColumn - Initial column to sort by (optional)
 * @param initialDirection - Initial sort direction (optional)
 */
export function useTableSort<T extends Record<string, any>>(
    data: T[],
    initialColumn: string | undefined = undefined,
    initialDirection: SortDirection = undefined
): UseSortReturn<T> {
    const [sortColumn, setSortColumn] = useState<string | undefined>(initialColumn)
    const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection)

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            // Cycle through: asc -> desc -> undefined
            if (sortDirection === 'asc') {
                setSortDirection('desc')
            } else if (sortDirection === 'desc') {
                setSortDirection(undefined)
                setSortColumn(undefined)
            } else {
                setSortDirection('asc')
            }
        } else {
            setSortColumn(column)
            setSortDirection('asc')
        }
    }

    const sortedData = useMemo(() => {
        if (!sortColumn || !sortDirection) return data

        return [...data].sort((a, b) => {
            const aVal = a[sortColumn]
            const bVal = b[sortColumn]

            // Handle null/undefined values
            if (aVal == null && bVal == null) return 0
            if (aVal == null) return sortDirection === 'asc' ? 1 : -1
            if (bVal == null) return sortDirection === 'asc' ? -1 : 1

            // Handle nested properties (e.g., user.name)
            const getValue = (obj: any, path: string) => {
                return path.split('.').reduce((curr, key) => curr?.[key], obj)
            }

            const aValue = getValue(a, sortColumn)
            const bValue = getValue(b, sortColumn)

            // Handle different data types
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc'
                    ? aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' })
                    : bValue.localeCompare(aValue, undefined, { numeric: true, sensitivity: 'base' })
            }

            // Date handling
            if (aValue instanceof Date && bValue instanceof Date) {
                return sortDirection === 'asc'
                    ? aValue.getTime() - bValue.getTime()
                    : bValue.getTime() - aValue.getTime()
            }

            // String comparison as fallback
            const aString = String(aValue)
            const bString = String(bValue)
            return sortDirection === 'asc'
                ? aString.localeCompare(bString)
                : bString.localeCompare(aString)
        })
    }, [data, sortColumn, sortDirection])

    return {
        sortColumn,
        sortDirection,
        handleSort,
        sortedData
    }
}

export interface UsePaginationReturn {
    currentPage: number
    pageSize: number
    totalPages: number
    paginatedData: any[]
    setPage: (page: number) => void
    setPageSize: (size: number) => void
    nextPage: () => void
    prevPage: () => void
    goToFirstPage: () => void
    goToLastPage: () => void
}

/**
 * Custom hook for table pagination
 * @param data - Array of data to be paginated
 * @param initialPageSize - Initial number of items per page
 */
export function useTablePagination<T>(
    data: T[],
    initialPageSize: number = 10
): UsePaginationReturn {
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(initialPageSize)

    const totalPages = Math.max(1, Math.ceil(data.length / pageSize))

    // Reset to page 1 if current page exceeds total pages
    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(1)
    }

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return data.slice(start, start + pageSize)
    }, [data, currentPage, pageSize])

    const setPage = (page: number) => {
        const validPage = Math.max(1, Math.min(page, totalPages))
        setCurrentPage(validPage)
    }

    const handlePageSizeChange = (size: number) => {
        setPageSize(size)
        setCurrentPage(1) // Reset to first page when page size changes
    }

    return {
        currentPage,
        pageSize,
        totalPages,
        paginatedData,
        setPage,
        setPageSize: handlePageSizeChange,
        nextPage: () => setPage(currentPage + 1),
        prevPage: () => setPage(currentPage - 1),
        goToFirstPage: () => setPage(1),
        goToLastPage: () => setPage(totalPages)
    }
}

export interface UseSearchReturn<T> {
    searchQuery: string
    setSearchQuery: (query: string) => void
    filteredData: T[]
}

/**
 * Custom hook for table search/filtering
 * @param data - Array of data to be filtered
 * @param searchFields - Array of field names to search in
 */
export function useTableSearch<T extends Record<string, any>>(
    data: T[],
    searchFields: string[]
): UseSearchReturn<T> {
    const [searchQuery, setSearchQuery] = useState('')

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data

        const query = searchQuery.toLowerCase()

        return data.filter((item) => {
            return searchFields.some((field) => {
                const getValue = (obj: any, path: string): any => {
                    return path.split('.').reduce((curr, key) => curr?.[key], obj)
                }

                const value = getValue(item, field)

                if (value == null) return false

                return String(value).toLowerCase().includes(query)
            })
        })
    }, [data, searchQuery, searchFields])

    return {
        searchQuery,
        setSearchQuery,
        filteredData
    }
}
