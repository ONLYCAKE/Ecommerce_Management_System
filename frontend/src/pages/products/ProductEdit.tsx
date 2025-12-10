import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../api/client'

interface Supplier { id: number; name: string }

export default function ProductEdit() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({
        sku: '',
        title: '',
        description: '',
        category: '',
        price: 0,
        stock: 0,
        supplierId: null as number | null
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [suppliersRes, productRes] = await Promise.all([
                    api.get('/suppliers'),
                    api.get(`/products/${id}`)
                ])
                setSuppliers(suppliersRes.data)
                const product = productRes.data
                setForm({
                    sku: product.sku || '',
                    title: product.title || '',
                    description: product.description || '',
                    category: product.category || '',
                    price: product.price || 0,
                    stock: product.stock || 0,
                    supplierId: product.supplierId
                })
                setLoading(false)
            } catch (err) {
                console.error('Error loading data', err)
                setLoading(false)
            }
        }
        fetchData()
    }, [id])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setErrors({})

        try {
            await api.put(`/products/${id}`, form)
            navigate('/products')
        } catch (err: any) {
            console.error('Error updating product', err)
            if (err.response?.data?.message) {
                setErrors({ general: err.response.data.message })
            }
        }
    }

    if (loading) return <div className="p-6">Loading...</div>

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Edit Product</h1>
                <p className="text-gray-600 mt-1">Update product information</p>
            </div>

            <form onSubmit={handleSubmit} className="card p-6 space-y-4">
                {errors.general && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {errors.general}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">SKU *</label>
                        <input className="input w-full mt-1 bg-gray-100" value={form.sku} readOnly />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Title *</label>
                        <input className="input w-full mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700">Description</label>
                    <textarea className="input w-full mt-1" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Category</label>
                        <input className="input w-full mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Price *</label>
                        <input type="number" step="0.01" className="input w-full mt-1" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })} required />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Stock *</label>
                        <input type="number" className="input w-full mt-1" value={form.stock} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) })} required />
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-gray-700">Supplier</label>
                    <select className="input w-full mt-1" value={form.supplierId ?? ''} onChange={(e) => setForm({ ...form, supplierId: parseInt(e.target.value) })}>
                        <option value="">Select Supplier</option>
                        {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" className="btn-secondary" onClick={() => navigate('/products')}>Cancel</button>
                    <button type="submit" className="btn-primary">Update Product</button>
                </div>
            </form>
        </div>
    )
}
