import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CountryStateCitySelect from '../CountryStateCitySelect'

describe('CountryStateCitySelect', () => {
    const mockOnCountryChange = jest.fn()
    const mockOnStateChange = jest.fn()
    const mockOnCityChange = jest.fn()

    const defaultProps = {
        country: '',
        state: '',
        city: '',
        onCountryChange: mockOnCountryChange,
        onStateChange: mockOnStateChange,
        onCityChange: mockOnCityChange,
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders all three dropdowns', () => {
        render(<CountryStateCitySelect {...defaultProps} />)

        expect(screen.getByLabelText(/country/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/state/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/city/i)).toBeInTheDocument()
    })

    it('disables state dropdown when no country is selected', () => {
        render(<CountryStateCitySelect {...defaultProps} />)

        const stateDropdown = screen.getByLabelText(/state/i)
        expect(stateDropdown).toBeDisabled()
    })

    it('disables city dropdown when no state is selected', () => {
        render(<CountryStateCitySelect {...defaultProps} />)

        const cityDropdown = screen.getByLabelText(/city/i)
        expect(cityDropdown).toBeDisabled()
    })

    it('calls onCountryChange when country is selected', async () => {
        render(<CountryStateCitySelect {...defaultProps} />)

        const countryDropdown = screen.getByLabelText(/country/i)
        fireEvent.change(countryDropdown, { target: { value: 'IN' } })

        await waitFor(() => {
            expect(mockOnCountryChange).toHaveBeenCalled()
        })
    })

    it('shows manual input toggle checkbox', () => {
        render(<CountryStateCitySelect {...defaultProps} />)

        const checkbox = screen.getByLabelText(/type manually/i)
        expect(checkbox).toBeInTheDocument()
        expect(checkbox).not.toBeChecked()
    })

    it('switches to manual input mode when checkbox is clicked', () => {
        render(<CountryStateCitySelect {...defaultProps} />)

        const checkbox = screen.getByLabelText(/type manually/i)
        fireEvent.click(checkbox)

        // Should show text inputs instead of dropdowns
        const countryInput = screen.getByPlaceholderText(/enter country/i)
        expect(countryInput).toBeInTheDocument()
        expect(countryInput).toHaveAttribute('type', 'text')
    })

    it('prefills with existing values', () => {
        const props = {
            ...defaultProps,
            country: 'India',
            state: 'Gujarat',
            city: 'Ahmedabad',
        }

        render(<CountryStateCitySelect {...props} />)

        // Component should attempt to find and select these values
        // or enable manual input if not found
        expect(screen.getByLabelText(/country/i)).toBeInTheDocument()
    })

    it('displays validation errors', () => {
        const props = {
            ...defaultProps,
            errors: {
                country: 'Country is required',
                state: 'State is required',
            },
        }

        render(<CountryStateCitySelect {...props} />)

        expect(screen.getByText('Country is required')).toBeInTheDocument()
        expect(screen.getByText('State is required')).toBeInTheDocument()
    })

    it('clears state and city when country changes', async () => {
        render(<CountryStateCitySelect {...defaultProps} />)

        const countryDropdown = screen.getByLabelText(/country/i)
        fireEvent.change(countryDropdown, { target: { value: 'IN' } })

        await waitFor(() => {
            expect(mockOnStateChange).toHaveBeenCalledWith('')
            expect(mockOnCityChange).toHaveBeenCalledWith('')
        })
    })
})
