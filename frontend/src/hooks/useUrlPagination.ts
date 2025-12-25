import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Custom hook for URL-based pagination
 * Reads page and pageSize from URL query params as source of truth
 * 
 * @param defaultPage - Default page number (default: 1)
 * @param defaultPageSize - Default page size (default: 10)
 * @returns { page, pageSize, setPage, setPageSize }
 * 
 * @example
 * const { page, pageSize, setPage, setPageSize } = useUrlPagination()
 * 
 * // URL: /invoices?page=2&pageSize=25
 * // page = 2, pageSize = 25
 */
export function useUrlPagination(defaultPage = 1, defaultPageSize = 10) {
    const [searchParams, setSearchParams] = useSearchParams()

    // Read from URL, fallback to defaults
    const urlPage = searchParams.get('page')
    const urlPageSize = searchParams.get('pageSize') || searchParams.get('limit') // Support both

    const [page, setPageState] = useState<number>(
        urlPage ? parseInt(urlPage) : defaultPage
    )
    const [pageSize, setPageSizeState] = useState<number>(
        urlPageSize ? parseInt(urlPageSize) : defaultPageSize
    )

    // Sync state from URL on mount and when URL changes
    useEffect(() => {
        const urlPageNum = urlPage ? parseInt(urlPage) : defaultPage
        const urlPageSizeNum = urlPageSize ? parseInt(urlPageSize) : defaultPageSize

        if (!isNaN(urlPageNum) && urlPageNum > 0) {
            setPageState(urlPageNum)
        }

        if (!isNaN(urlPageSizeNum) && urlPageSizeNum > 0) {
            setPageSizeState(urlPageSizeNum)
        }
    }, [urlPage, urlPageSize, defaultPage, defaultPageSize])

    // Update URL when page changes
    const setPage = (newPage: number | ((prev: number) => number)) => {
        const pageNum = typeof newPage === 'function' ? newPage(page) : newPage
        setPageState(pageNum)

        const params = new URLSearchParams(searchParams)
        params.set('page', pageNum.toString())
        setSearchParams(params, { replace: true })
    }

    // Update URL when page size changes
    const setPageSize = (newPageSize: number) => {
        setPageSizeState(newPageSize)
        setPageState(1) // Reset to page 1 when changing page size

        const params = new URLSearchParams(searchParams)
        params.set('pageSize', newPageSize.toString())
        params.set('page', '1')
        setSearchParams(params, { replace: true })
    }

    return {
        page,
        pageSize,
        setPage,
        setPageSize,
    }
}
