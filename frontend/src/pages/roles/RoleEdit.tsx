import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../api/client'

export default function RoleEdit() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({ name: '' })
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        const fetchRole = async () => {
            try {
                const { data } = await api.get(`/roles/${id}`)
                setForm({ name: data.name || '' })
                setLoading(false)
            } catch (err) {
                console.error('Error loading role', err)
                setLoading(false)
            }
        }
        fetchRole()
    }, [id])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setErrors({})

        try {
            await api.put(`/roles/${id}`, form)
            navigate('/roles')
        } catch (err: any) {
            console.error('Error updating role', err)
            if (err.response?.data?.message) {
                setErrors({ general: err.response.data.message })
            }
        }
    }

    if (loading) return <div className="p-6">Loading...</div>

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Edit Role</h1>
                <p className="text-gray-600 mt-1">Update role information</p>
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
                        required
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" className="btn-secondary" onClick={() => navigate('/roles')}>Cancel</button>
                    <button type="submit" className="btn-primary">Update Role</button>
                </div>
            </form>
        </div>
    )
}
