import { useState, useEffect } from 'react'
import { Country, State, City, ICountry, IState, ICity } from 'country-state-city'

interface CountryStateCitySelectProps {
    country: string
    state: string
    city: string
    onCountryChange: (value: string) => void
    onStateChange: (value: string) => void
    onCityChange: (value: string) => void
    errors?: {
        country?: string
        state?: string
        city?: string
    }
}

export default function CountryStateCitySelect({
    country,
    state,
    city,
    onCountryChange,
    onStateChange,
    onCityChange,
    errors = {}
}: CountryStateCitySelectProps) {
    const [countries, setCountries] = useState<ICountry[]>([])
    const [states, setStates] = useState<IState[]>([])
    const [cities, setCities] = useState<ICity[]>([])
    const [selectedCountryCode, setSelectedCountryCode] = useState('')
    const [selectedStateCode, setSelectedStateCode] = useState('')
    const [manualInput, setManualInput] = useState(false)

    // Load all countries on mount
    useEffect(() => {
        const allCountries = Country.getAllCountries()
        setCountries(allCountries)

        // Try to find country code from name
        if (country) {
            const foundCountry = allCountries.find(
                c => c.name.toLowerCase() === country.toLowerCase()
            )
            if (foundCountry) {
                setSelectedCountryCode(foundCountry.isoCode)
            } else {
                // Country not found in dropdown, enable manual input
                setManualInput(true)
            }
        }
    }, [])

    // Load states when country changes
    useEffect(() => {
        if (selectedCountryCode) {
            const countryStates = State.getStatesOfCountry(selectedCountryCode)
            setStates(countryStates)

            // Try to find state code from name
            if (state) {
                const foundState = countryStates.find(
                    s => s.name.toLowerCase() === state.toLowerCase()
                )
                if (foundState) {
                    setSelectedStateCode(foundState.isoCode)
                } else if (!manualInput) {
                    // State not found, enable manual input
                    setManualInput(true)
                }
            }
        } else {
            setStates([])
            setSelectedStateCode('')
        }
    }, [selectedCountryCode, state])

    // Load cities when state changes
    useEffect(() => {
        if (selectedCountryCode && selectedStateCode) {
            const stateCities = City.getCitiesOfState(selectedCountryCode, selectedStateCode)
            setCities(stateCities)
        } else {
            setCities([])
        }
    }, [selectedCountryCode, selectedStateCode])

    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const countryCode = e.target.value
        setSelectedCountryCode(countryCode)
        setSelectedStateCode('')

        const selectedCountry = countries.find(c => c.isoCode === countryCode)
        onCountryChange(selectedCountry?.name || '')
        onStateChange('')
        onCityChange('')
    }

    const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const stateCode = e.target.value
        setSelectedStateCode(stateCode)

        const selectedState = states.find(s => s.isoCode === stateCode)
        onStateChange(selectedState?.name || '')
        onCityChange('')
    }

    const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const cityName = e.target.value
        onCityChange(cityName)
    }

    const toggleManualInput = () => {
        setManualInput(!manualInput)
        if (!manualInput) {
            // Switching to manual, clear selections
            setSelectedCountryCode('')
            setSelectedStateCode('')
        }
    }

    if (manualInput) {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <input
                        type="checkbox"
                        id="manualInput"
                        checked={manualInput}
                        onChange={toggleManualInput}
                        className="rounded"
                    />
                    <label htmlFor="manualInput" className="text-sm text-gray-600 cursor-pointer">
                        Type manually (location not found in dropdown)
                    </label>
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700">Country *</label>
                    <input
                        type="text"
                        className={`input mt-1 ${errors.country ? 'border-red-500' : ''}`}
                        value={country}
                        onChange={(e) => onCountryChange(e.target.value)}
                        placeholder="Enter country"
                    />
                    {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country}</p>}
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700">State *</label>
                    <input
                        type="text"
                        className={`input mt-1 ${errors.state ? 'border-red-500' : ''}`}
                        value={state}
                        onChange={(e) => onStateChange(e.target.value)}
                        placeholder="Enter state"
                    />
                    {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700">City</label>
                    <input
                        type="text"
                        className={`input mt-1 ${errors.city ? 'border-red-500' : ''}`}
                        value={city}
                        onChange={(e) => onCityChange(e.target.value)}
                        placeholder="Enter city"
                    />
                    {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <input
                    type="checkbox"
                    id="manualInput"
                    checked={manualInput}
                    onChange={toggleManualInput}
                    className="rounded"
                />
                <label htmlFor="manualInput" className="text-sm text-gray-600 cursor-pointer">
                    Type manually
                </label>
            </div>

            <div>
                <label className="text-sm font-medium text-gray-700">Country *</label>
                <select
                    className={`input mt-1 ${errors.country ? 'border-red-500' : ''}`}
                    value={selectedCountryCode}
                    onChange={handleCountryChange}
                >
                    <option value="">Select Country</option>
                    {countries.map((c) => (
                        <option key={c.isoCode} value={c.isoCode}>
                            {c.name}
                        </option>
                    ))}
                </select>
                {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country}</p>}
            </div>

            <div>
                <label className="text-sm font-medium text-gray-700">State *</label>
                <select
                    className={`input mt-1 ${errors.state ? 'border-red-500' : ''}`}
                    value={selectedStateCode}
                    onChange={handleStateChange}
                    disabled={!selectedCountryCode}
                >
                    <option value="">Select State</option>
                    {states.map((s) => (
                        <option key={s.isoCode} value={s.isoCode}>
                            {s.name}
                        </option>
                    ))}
                </select>
                {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
            </div>

            <div>
                <label className="text-sm font-medium text-gray-700">City</label>
                <select
                    className={`input mt-1 ${errors.city ? 'border-red-500' : ''}`}
                    value={city}
                    onChange={handleCityChange}
                    disabled={!selectedStateCode}
                >
                    <option value="">Select City</option>
                    {cities.map((c) => (
                        <option key={c.name} value={c.name}>
                            {c.name}
                        </option>
                    ))}
                </select>
                {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
            </div>
        </div>
    )
}
