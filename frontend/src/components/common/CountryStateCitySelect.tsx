import { useState, useEffect } from 'react'
import Select from 'react-select'
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

interface OptionType {
    value: string
    label: string
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
                setManualInput(true)
            }
        }
    }, [])

    // Load states when country changes
    useEffect(() => {
        if (selectedCountryCode) {
            const countryStates = State.getStatesOfCountry(selectedCountryCode)
            setStates(countryStates)

            if (state) {
                const foundState = countryStates.find(
                    s => s.name.toLowerCase() === state.toLowerCase()
                )
                if (foundState) {
                    setSelectedStateCode(foundState.isoCode)
                } else if (!manualInput) {
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

    // Convert to React Select options
    const countryOptions: OptionType[] = countries.map(c => ({
        value: c.isoCode,
        label: c.name
    }))

    const stateOptions: OptionType[] = states.map(s => ({
        value: s.isoCode,
        label: s.name
    }))

    const cityOptions: OptionType[] = cities.map(c => ({
        value: c.name,
        label: c.name
    }))

    // Get selected values for React Select
    const selectedCountry = countryOptions.find(opt => opt.label === country) || null
    const selectedState = stateOptions.find(opt => opt.label === state) || null
    const selectedCity = cityOptions.find(opt => opt.value === city) || null

    const handleCountryChange = (option: OptionType | null) => {
        if (option) {
            const selectedCountry = countries.find(c => c.isoCode === option.value)
            setSelectedCountryCode(option.value)
            onCountryChange(selectedCountry?.name || '')
            onStateChange('')
            onCityChange('')
            setSelectedStateCode('')
        } else {
            setSelectedCountryCode('')
            onCountryChange('')
            onStateChange('')
            onCityChange('')
        }
    }

    const handleStateChange = (option: OptionType | null) => {
        if (option) {
            const selectedState = states.find(s => s.isoCode === option.value)
            setSelectedStateCode(option.value)
            onStateChange(selectedState?.name || '')
            onCityChange('')
        } else {
            setSelectedStateCode('')
            onStateChange('')
            onCityChange('')
        }
    }

    const handleCityChange = (option: OptionType | null) => {
        onCityChange(option?.value || '')
    }

    const toggleManualInput = () => {
        setManualInput(!manualInput)
        if (!manualInput) {
            setSelectedCountryCode('')
            setSelectedStateCode('')
        }
    }

    // Custom styles for React Select
    const customStyles = {
        control: (base: any, state: any) => ({
            ...base,
            borderColor: errors.country || errors.state || errors.city ? '#ef4444' : state.isFocused ? '#3b82f6' : '#d1d5db',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
            '&:hover': {
                borderColor: state.isFocused ? '#3b82f6' : '#9ca3af'
            },
            minHeight: '42px',
            borderRadius: '0.375rem'
        }),
        menu: (base: any) => ({
            ...base,
            zIndex: 9999
        })
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
                <label className="text-sm font-medium text-gray-700 block mb-1">
                    Country <span className="text-red-500">*</span>
                </label>
                <Select
                    options={countryOptions}
                    value={selectedCountry}
                    onChange={handleCountryChange}
                    isClearable
                    isSearchable
                    placeholder="Search and select country..."
                    styles={customStyles}
                    className="react-select-container"
                    classNamePrefix="react-select"
                />
                {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country}</p>}
            </div>

            <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                    State <span className="text-red-500">*</span>
                </label>
                <Select
                    options={stateOptions}
                    value={selectedState}
                    onChange={handleStateChange}
                    isClearable
                    isSearchable
                    isDisabled={!selectedCountryCode}
                    placeholder="Search and select state..."
                    styles={customStyles}
                    className="react-select-container"
                    classNamePrefix="react-select"
                />
                {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
            </div>

            <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                    City
                </label>
                <Select
                    options={cityOptions}
                    value={selectedCity}
                    onChange={handleCityChange}
                    isClearable
                    isSearchable
                    isDisabled={!selectedStateCode}
                    placeholder="Search and select city (optional)..."
                    styles={customStyles}
                    className="react-select-container"
                    classNamePrefix="react-select"
                />
                {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
            </div>
        </div>
    )
}
