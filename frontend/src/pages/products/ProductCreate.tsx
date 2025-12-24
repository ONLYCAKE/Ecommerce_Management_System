import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

interface Supplier { id: number; name: string }

export default function ProductCreate() {
    const navigate = useNavigate()
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [form, setForm] = useState({
        sku: '',
        title: '',
        description: '',
        category: '',
        price: 0,
        stock: 0,
        supplierId: null as number | null,
        taxType: 'withTax' as 'withTax' | 'withoutTax',
        taxRate: 18
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const { data } = await api.get('/suppliers')
                const suppliersList = Array.isArray(data) ? data : (data?.items || [])
                setSuppliers(suppliersList)
            } catch (err) {
                console.error('Error loading suppliers', err)
                setSuppliers([])
            }
        }
        fetchSuppliers()
    }, [])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setErrors({})

        try {
            await api.post('/products', form)
            navigate('/products')
        } catch (err: any) {
            console.error('Error creating product', err)
            if (err.response?.data?.message) {
                setErrors({ general: err.response.data.message })
            }
        }
    }

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Create New Product</h1>
                <p className="text-gray-600 mt-1">Add a new product to inventory</p>
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
                        <input className="input w-full mt-1" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
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

                {/* Tax Configuration */}
                <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Tax Configuration</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Tax Type *</label>
                            <select
                                className="input w-full mt-1"
                                value={form.taxType}
                                onChange={(e) => setForm({
                                    ...form,
                                    taxType: e.target.value as 'withTax' | 'withoutTax',
                                    taxRate: e.target.value === 'withoutTax' ? 0 : 18
                                })}
                            >
                                <option value="withTax">With Tax</option>
                                <option value="withoutTax">Without Tax</option>
                            </select>
                        </div>

                        {form.taxType === 'withTax' && (
                            <div>
                                <label className="text-sm font-medium text-gray-700">Tax Rate (%) *</label>
                                <select
                                    className="input w-full mt-1"
                                    value={form.taxRate}
                                    onChange={(e) => setForm({ ...form, taxRate: parseFloat(e.target.value) })}
                                >
                                    <option value={0}>0% - Exempted</option>
                                    <option value={5}>5% - Reduced Rate</option>
                                    <option value={12}>12% - Standard-1</option>
                                    <option value={18}>18% - Standard-2 (GST)</option>
                                    <option value={28}>28% - Luxury/Sin Goods</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" className="btn-secondary" onClick={() => navigate('/products')}>Cancel</button>
                    <button type="submit" className="btn-primary">Create Product</button>
                </div>
            </form>
        </div>
    )
}
