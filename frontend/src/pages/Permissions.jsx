import { useEffect, useState } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useConfirm } from '../context/ConfirmContext'

export default function Permissions(){
  const [items, setItems] = useState([])
  const { user } = useAuth()
  const canManage = user.role === 'SuperAdmin'
  const confirmModal = useConfirm()

  const fetchAll = async ()=> { const { data } = await api.get('/permissions'); setItems(data) }
  useEffect(()=>{ fetchAll() },[])

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ id:null, key:'', name:'', description:'' })

  const open = (p=null) => { setForm(p? p : { id:null, key:'', name:'', description:'' }); setShowForm(true) }
  const save = async (e) => {
    e.preventDefault()
    if (form.id) await api.put(`/permissions/${form.id}`, { key: form.key, name: form.name, description: form.description })
    else await api.post(`/permissions`, { key: form.key, name: form.name, description: form.description })
    setShowForm(false); fetchAll()
  }
  const remove = async (id) => {
    const ok = await confirmModal({ title: 'Delete permission?', description: 'This action cannot be undone.' })
    if (!ok) return
    await api.delete(`/permissions/${id}`)
    fetchAll()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h1 className="text-lg font-semibold">Permissions</h1>
        {canManage && <button className="btn-primary" onClick={()=>open()}>Add Permission</button>}
      </div>
      <div className="card p-4">
        <table className="table">
          <thead><tr><th>Key</th><th>Name</th><th>Description</th><th></th></tr></thead>
          <tbody>
            {items.map(p=> (
              <tr key={p.id} className="border-t">
                <td className="font-mono text-sm">{p.key}</td>
                <td>{p.name}</td>
                <td className="text-sm text-gray-600">{p.description}</td>
                <td className="text-right space-x-2">
                  {canManage && <button className="btn-secondary" onClick={()=>open(p)}>Edit</button>}
                  {canManage && <button className="btn-danger" onClick={()=>remove(p.id)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4">{form.id? 'Edit Permission' : 'Add Permission'}</h3>
            <form onSubmit={save} className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Key</label>
                <input className="input mt-1" value={form.key} onChange={e=>setForm(f=>({...f, key:e.target.value}))} disabled={!!form.id} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Name</label>
                <input className="input mt-1" value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Description</label>
                <textarea className="input mt-1" value={form.description} onChange={e=>setForm(f=>({...f, description:e.target.value}))} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
