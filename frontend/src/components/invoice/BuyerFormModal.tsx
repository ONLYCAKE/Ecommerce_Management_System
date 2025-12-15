import { useState, FormEvent } from 'react'
import api from '../../api/client'
import CountryStateCitySelect from '../common/CountryStateCitySelect'

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

interface BuyerFormModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: (buyer: Buyer) => void
}

export default function BuyerFormModal({ isOpen, onClose, onSuccess }: BuyerFormModalProps) {
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        gstin: generateGSTIN(),
        addressLine1: '',
        addressLine2: '',
        area: '',
        city: '',
        state: '',
        country: '',
        postalCode: ''
    })

    const [errors, setErrors] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)

    // Generate realistic GSTIN number
    function generateGSTIN() {
        const stateCode = '24' // Gujarat state code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        const digits = '0123456789'

        // Generate PAN-like structure: 5 letters + 4 digits + 1 letter
        let pan = ''
        for (let i = 0; i < 5; i++) pan += chars[Math.floor(Math.random() * chars.length)]
        for (let i = 0; i < 4; i++) pan += digits[Math.floor(Math.random() * digits.length)]
        pan += chars[Math.floor(Math.random() * chars.length)]

        const entityNumber = Math.floor(Math.random() * 10)
        const defaultChar = 'Z'
        const checksum = digits[Math.floor(Math.random() * digits.length)]

        return `${stateCode}${pan}${entityNumber}${defaultChar}${checksum}`
    }

    const validate = () => {
        const errs: Record<string, string> = {}

        if (!form.name.trim()) errs.name = 'Name is required'

        if (!form.email) errs.email = 'Email is required'
        else if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(form.email))
            errs.email = 'Email must be valid and end with @gmail.com'

        if (!form.phone) errs.phone = 'Phone is required'
        else if (!/^\d{10}$/.test(form.phone))
            errs.phone = 'Phone must be 10 digits'

        // GSTIN validation - only validate format if provided
        if (form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[Z]{1}\d{1}$/.test(form.gstin))
            errs.gstin = 'GSTIN must be 15 characters (e.g., 24ABCDE1234F1Z5)'

        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()

        if (!validate()) return

        setSaving(true)
        try {
            const { data } = await api.post('/buyers', form)
            onSuccess(data)
            // Reset form
            setForm({
                name: '',
                email: '',
                phone: '',
                gstin: generateGSTIN(),
                addressLine1: '',
                addressLine2: '',
                area: '',
                city: '',
                state: '',
                country: '',
                postalCode: ''
            })
            setErrors({})
        } catch (err: any) {
            console.error('Save buyer failed', err)
            setErrors({ general: err.response?.data?.message || 'Failed to create buyer' })
        } finally {
            setSaving(false)
        }
    }

    const handleClose = () => {
        setForm({
            name: '',
            email: '',
            phone: '',
            gstin: generateGSTIN(),
            addressLine1: '',
            addressLine2: '',
            area: '',
            city: '',
            state: '',
            country: '',
            postalCode: ''
        })
        setErrors({})
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-xl">
                    <h3 className="text-2xl font-bold">
                        ➕ Add New Buyer
                    </h3>
                    <p className="text-blue-100 text-sm mt-1">
                        Fill in the details to create a new buyer
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-8">
                    {errors.general && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                            {errors.general}
                        </div>
                    )}

                    {/* Basic Information Section */}
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
                                <span>📋</span> Basic Information
                            </h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        className={`input ${errors.name ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'} transition-all`}
                                        value={form.name}
                                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                        placeholder="Enter buyer name"
                                    />
                                    {errors.name && (
                                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                                            <span>⚠️</span> {errors.name}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        GSTIN
                                    </label>
                                    <input
                                        className={`input ${errors.gstin ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'} font-mono transition-all`}
                                        value={form.gstin}
                                        onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                                        placeholder="24ABCDE1234F1Z5"
                                        maxLength={15}
                                    />
                                    {errors.gstin && (
                                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                                            <span>⚠️</span> {errors.gstin}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Contact Information Section */}
                        <div>
                            <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-500 flex items-center gap-2">
                                <span>📞</span> Contact Information
                            </h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        className={`input ${errors.email ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'} transition-all`}
                                        value={form.email}
                                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                        placeholder="buyer@gmail.com"
                                    />
                                    {errors.email && (
                                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                                            <span>⚠️</span> {errors.email}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Phone <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        className={`input ${errors.phone ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'} transition-all`}
                                        value={form.phone}
                                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                        placeholder="9876543210"
                                    />
                                    {errors.phone && (
                                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                                            <span>⚠️</span> {errors.phone}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Address Section */}
                        <div>
                            <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-purple-500 flex items-center gap-2">
                                <span>🏠</span> Address Details
                            </h4>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Address Line 1
                                        </label>
                                        <input
                                            className="input border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                            value={form.addressLine1}
                                            onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                                            placeholder="Street address"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Address Line 2 <span className="text-gray-400 text-xs">(Optional)</span>
                                        </label>
                                        <input
                                            className="input border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                            value={form.addressLine2}
                                            onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
                                            placeholder="Apartment, suite, etc."
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Area/Locality
                                        </label>
                                        <input
                                            className="input border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                            value={form.area}
                                            onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                                            placeholder="Area or locality"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Postal Code
                                        </label>
                                        <input
                                            className="input border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                                            value={form.postalCode}
                                            onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                                            placeholder="123456"
                                        />
                                    </div>
                                </div>

                                {/* Country, State, City Dropdowns */}
                                <CountryStateCitySelect
                                    country={form.country}
                                    state={form.state}
                                    city={form.city}
                                    onCountryChange={(value) => setForm((f) => ({ ...f, country: value }))}
                                    onStateChange={(value) => setForm((f) => ({ ...f, state: value }))}
                                    onCityChange={(value) => setForm((f) => ({ ...f, city: value }))}
                                    errors={{
                                        country: errors.country,
                                        state: errors.state,
                                        city: errors.city
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-6 border-t-2 border-gray-200 mt-8">
                        <p className="text-sm text-gray-500 italic">
                            <span className="text-red-500">*</span> Required fields
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 flex items-center gap-2"
                                onClick={handleClose}
                                disabled={saving}
                            >
                                <span>✕</span> Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={saving}
                            >
                                <span>💾</span> {saving ? 'Saving...' : 'Save Buyer'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
