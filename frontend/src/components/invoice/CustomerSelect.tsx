import { useState, useEffect, useRef } from 'react'
import api from '../../api/client'

interface Buyer {
    id: number
    name: string
    email: string
    phone: string
    gstin?: string
    addressLine1: string
    addressLine2?: string
    area: string
    city: string
    state: string
    country: string
    postalCode: string
}

interface CustomerSelectProps {
    value: Buyer | null
    onChange: (buyer: Buyer | null) => void
    onNavigateToCreate?: () => void
}

export default function CustomerSelect({ value, onChange, onNavigateToCreate }: CustomerSelectProps) {
    const [search, setSearch] = useState('')
    const [buyers, setBuyers] = useState<Buyer[]>([])
    const [allBuyers, setAllBuyers] = useState<Buyer[]>([])
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

    // Load all buyers on mount
    useEffect(() => {
        const loadAllBuyers = async () => {
            setLoading(true)
            try {
                const { data } = await api.get('/buyers')
                setAllBuyers(data || [])
                setBuyers(data || [])
            } catch (err) {
                console.error('Error loading buyers:', err)
            } finally {
                setLoading(false)
            }
        }
        loadAllBuyers()
    }, [])

    // Filter buyers based on search
    useEffect(() => {
        if (search.length === 0) {
            setBuyers(allBuyers)
            return
        }

        const filtered = allBuyers.filter(b =>
            b.name.toLowerCase().includes(search.toLowerCase()) ||
            b.email.toLowerCase().includes(search.toLowerCase()) ||
            b.phone.includes(search)
        )
        setBuyers(filtered)
    }, [search, allBuyers])

    const handleSelect = (buyer: Buyer) => {
        onChange(buyer)
        setSearch('')
        setIsOpen(false)
    }

    const handleClear = () => {
        onChange(null)
        setSearch('')
        setBuyers(allBuyers)
    }

    return (
        <div className="space-y-3">
            <div className="relative" ref={wrapperRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer *
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="input flex-1"
                        placeholder="Search customer by name, email, or phone..."
                        value={value ? value.name : search}
                        onChange={(e) => {
                            if (value) {
                                // If a customer is already selected, clear it when typing
                                onChange(null)
                            }
                            setSearch(e.target.value)
                        }}
                        onFocus={() => {
                            if (buyers.length > 0) {
                                setIsOpen(true)
                            }
                        }}
                    />
                    {value && (
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleClear}
                        >
                            Clear
                        </button>
                    )}
                    {onNavigateToCreate && (
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={onNavigateToCreate}
                        >
                            + Add New
                        </button>
                    )}
                </div>

                {/* Dropdown */}
                {isOpen && buyers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {buyers.map((buyer) => (
                            <div
                                key={buyer.id}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                                onClick={() => handleSelect(buyer)}
                            >
                                <div className="font-medium text-gray-900">{buyer.name}</div>
                                <div className="text-sm text-gray-600">{buyer.email} • {buyer.phone}</div>
                                <div className="text-xs text-gray-500">
                                    {buyer.gstin && <span className="font-mono mr-2">GSTIN: {buyer.gstin}</span>}
                                    {buyer.city}, {buyer.state}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {loading && (
                    <div className="absolute right-3 top-9 text-gray-400">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                )}
            </div>

            {/* Address Preview */}
            {value && (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Billing Address</div>
                    <div className="text-sm text-gray-600 space-y-1">
                        <div>{value.name}</div>
                        <div>{value.addressLine1}</div>
                        {value.addressLine2 && <div>{value.addressLine2}</div>}
                        <div>{value.area}, {value.city}</div>
                        <div>{value.state} - {value.postalCode}</div>
                        <div>{value.country}</div>
                        {value.gstin && (
                            <div className="pt-2 border-t mt-2">
                                <span className="font-medium">GSTIN:</span> <span className="font-mono">{value.gstin}</span>
                            </div>
                        )}
                        <div className={value.gstin ? "pt-2" : "pt-2 border-t mt-2"}>
                            <span className="font-medium">Email:</span> {value.email}
                        </div>
                        <div>
                            <span className="font-medium">Phone:</span> {value.phone}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
