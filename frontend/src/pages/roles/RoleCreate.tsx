import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

export default function RoleCreate() {
    const navigate = useNavigate()
    const [form, setForm] = useState({ name: '' })
    const [errors, setErrors] = useState<Record<string, string>>({})

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setErrors({})

        try {
            await api.post('/roles', form)
            navigate('/roles')
        } catch (err: any) {
            console.error('Error creating role', err)
            if (err.response?.data?.message) {
                setErrors({ general: err.response.data.message })
            }
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Create New Role</h1>
                <p className="text-gray-600 mt-1">Add a new role to the system</p>
            </div>

            <form onSubmit={handleSubmit} className="card p-6 space-y-4">
                {errors.general && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {errors.general}
                    </div>
                )}

                <div>
                    <label className="text-sm font-medium text-gray-700">Role Name *</label>
                    <input
                        className="input w-full mt-1"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g., Manager, Supervisor"
                        required
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" className="btn-secondary" onClick={() => navigate('/roles')}>Cancel</button>
                    <button type="submit" className="btn-primary">Create Role</button>
                </div>
            </form>
        </div>
    )
}
