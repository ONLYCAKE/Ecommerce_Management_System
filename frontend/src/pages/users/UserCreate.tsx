import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

interface Role { id: number; name: string }

export default function UserCreate() {
    const navigate = useNavigate()
    const [roles, setRoles] = useState<Role[]>([])
    const [form, setForm] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        roleId: null as number | null,
        addressLine1: '',
        addressLine2: '',
        area: '',
        city: '',
        state: '',
        country: '',
        postalCode: ''
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const { data } = await api.get('/roles')
                setRoles(data)
                const defaultRole = data.find((r: Role) => r.name === 'Employee') || data[0]
                if (defaultRole) setForm(f => ({ ...f, roleId: defaultRole.id }))
            } catch (err) {
                console.error('Error loading roles', err)
            }
        }
        fetchRoles()
    }, [])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setErrors({})

        try {
            await api.post('/users', form)
            navigate('/users')
        } catch (err: any) {
            console.error('Error creating user', err)
            if (err.response?.data?.message) {
                setErrors({ general: err.response.data.message })
            }
        }
    }

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Create New User</h1>
                <p className="text-gray-600 mt-1">Add a new user to the system</p>
            </div>

            <form onSubmit={handleSubmit} className="card p-6 space-y-4">
                {errors.general && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {errors.general}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Email *</label>
                        <input
                            type="email"
                            className="input w-full mt-1"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Password *</label>
                        <input
                            type="password"
                            className="input w-full mt-1"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">First Name *</label>
                        <input
                            className="input w-full mt-1"
                            value={form.firstName}
                            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Last Name *</label>
                        <input
                            className="input w-full mt-1"
                            value={form.lastName}
                            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700">Role *</label>
                    <select
                        className="input w-full mt-1"
                        value={form.roleId ?? ''}
                        onChange={(e) => setForm({ ...form, roleId: parseInt(e.target.value) })}
                        required
                    >
                        <option value="">Select Role</option>
                        {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>

                <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Address Information</h3>

                    <div className="space-y-3">
                        <div>
                            <label className="text-sm text-gray-700">Address Line 1</label>
                            <input
                                className="input w-full mt-1"
                                value={form.addressLine1}
                                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                                placeholder="Street address"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-700">Address Line 2 (Optional)</label>
                            <input
                                className="input w-full mt-1"
                                value={form.addressLine2}
                                onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                                placeholder="Apartment, suite, etc."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-700">Area</label>
                                <input
                                    className="input w-full mt-1"
                                    value={form.area}
                                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-700">City</label>
                                <input
                                    className="input w-full mt-1"
                                    value={form.city}
                                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-700">State</label>
                                <input
                                    className="input w-full mt-1"
                                    value={form.state}
                                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-700">Country</label>
                                <input
                                    className="input w-full mt-1"
                                    value={form.country}
                                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm text-gray-700">Postal Code</label>
                            <input
                                className="input w-full mt-1"
                                value={form.postalCode}
                                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => navigate('/users')}
                    >
                        Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                        Create User
                    </button>
                </div>
            </form>
        </div>
    )
}
