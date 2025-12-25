import { useState, useEffect, useRef } from 'react'
import api from '../../api/client'
import { Loader2, Lightbulb } from 'lucide-react'

interface Product {
    id: number
    sku: string
    title: string
    price: number
    stock: number
    category?: string
}

interface ProductSearchProps {
    onAdd: (product: Product, qty: number) => void
    onNavigateToCreate?: () => void
    excludedProductIds?: number[] // NEW: Products to hide from selection
}

export default function ProductSearch({ onAdd, onNavigateToCreate, excludedProductIds = [] }: ProductSearchProps) {
    const [search, setSearch] = useState('')
    const [qty, setQty] = useState(1)
    const [products, setProducts] = useState<Product[]>([])
    const [allProducts, setAllProducts] = useState<Product[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Load all products on mount
    useEffect(() => {
        const loadAllProducts = async () => {
            setLoading(true)
            try {
                const { data } = await api.get('/products')
                const productsList = Array.isArray(data) ? data : (data?.items || [])
                setAllProducts(productsList)
                setProducts(productsList)
            } catch (err) {
                console.error('Error loading products:', err)
                setAllProducts([])
                setProducts([])
            } finally {
                setLoading(false)
            }
        }
        loadAllProducts()
    }, [])

    // Filter products based on search AND excludedProductIds
    useEffect(() => {
        // Filter out excluded products first
        const availableProducts = allProducts.filter(p => !excludedProductIds.includes(p.id))

        if (search.length === 0) {
            setProducts(availableProducts)
            return
        }

        const filtered = availableProducts.filter(p =>
            p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.sku.toLowerCase().includes(search.toLowerCase())
        )
        setProducts(filtered)
    }, [search, allProducts, excludedProductIds])

    const handleSelect = (product: Product) => {
        onAdd(product, qty)
        setSearch('')
        // Keep dropdown open and show remaining available products
        const availableProducts = allProducts.filter(p => !excludedProductIds.includes(p.id))
        setProducts(availableProducts)
        setIsOpen(true)
        // Reset qty to 1 for next product
        setQty(1)
    }

    const handleBarcodeInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Barcode scanners typically send Enter after scanning
        if (e.key === 'Enter' && search.length > 0) {
            // Try to find exact SKU match
            const exactMatch = products.find(p => p.sku.toLowerCase() === search.toLowerCase())
            if (exactMatch) {
                handleSelect(exactMatch)
            }
        }
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex gap-3 items-end">
                <div className="flex-1 relative" ref={wrapperRef}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Product Search (or scan barcode)
                    </label>
                    <input
                        type="text"
                        className="input w-full"
                        placeholder="Search by name, SKU, or scan barcode..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleBarcodeInput}
                        onFocus={() => {
                            if (products.length > 0) {
                                setIsOpen(true)
                            }
                        }}
                    />

                    {/* Dropdown */}
                    {isOpen && products.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {products.map((product) => (
                                <div
                                    key={product.id}
                                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                                    onClick={() => handleSelect(product)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-medium text-gray-900">{product.title}</div>
                                            <div className="text-sm text-gray-600">SKU: {product.sku}</div>
                                            {product.category && (
                                                <div className="text-xs text-gray-500">{product.category}</div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium text-gray-900">₹{product.price.toFixed(2)}</div>
                                            <div className="text-xs text-gray-500">Stock: {product.stock}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {loading && (
                        <div className="absolute right-3 top-9 text-gray-400">
                            <Loader2 className="animate-spin" size={18} strokeWidth={1.8} />
                        </div>
                    )}
                </div>

                <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Qty
                    </label>
                    <input
                        type="number"
                        min="1"
                        className="input w-full"
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                </div>

                {onNavigateToCreate && (
                    <button
                        type="button"
                        className="btn-primary whitespace-nowrap"
                        onClick={onNavigateToCreate}
                    >
                        + Add Product
                    </button>
                )}
            </div>

            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                <Lightbulb size={14} strokeWidth={1.8} className="text-amber-500" />
                <span>Tip: Scan barcode or type to search, then press Enter or click to add</span>
            </div>
        </div>
    )
}
