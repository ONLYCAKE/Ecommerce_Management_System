import { useEffect, useState, FormEvent } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../context/ConfirmContext';

interface Permission {
  id: number;
  key: string;
  name: string;
  description: string;
}

export default function Permissions() {
  const [items, setItems] = useState<Permission[]>([]);
  const { user } = useAuth();

  // Only SuperAdmin can manage permissions
  const canManage = user?.role === 'SuperAdmin';

  const confirmModal = useConfirm();

  // Load all permissions
  const fetchAll = async () => {
    try {
      const { data } = await api.get<Permission[]>('/permissions');
      setItems(data);
    } catch (err) {
      console.error('Error loading permissions:', err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // FORM STATE
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState<Permission>({
    id: 0,
    key: '',
    name: '',
    description: '',
  });

  // Open form for edit/create
  const open = (p: Permission | null = null) => {
    if (p) {
      setForm(p);
    } else {
      setForm({ id: 0, key: '', name: '', description: '' });
    }
    setShowForm(true);
  };

  // Save permission
  const save = async (e: FormEvent) => {
    e.preventDefault();

    try {
      if (form.id) {
        await api.put(`/permissions/${form.id}`, {
          key: form.key,
          name: form.name,
          description: form.description,
        });
      } else {
        await api.post('/permissions', {
          key: form.key,
          name: form.name,
          description: form.description,
        });
      }

      setShowForm(false);
      fetchAll();
    } catch (err) {
      console.error('Error saving permission:', err);
    }
  };

  // Delete a permission
  const remove = async (id: number) => {
    const ok = await confirmModal({
      title: 'Delete permission?',
      description: 'This action cannot be undone.',
    });

    if (!ok) return;

    try {
      await api.delete(`/permissions/${id}`);
      fetchAll();
    } catch (err) {
      console.error('Error deleting permission:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold">Permissions</h1>
        {canManage && (
          <button className="btn-primary" onClick={() => open(null)}>
            Add Permission
          </button>
        )}
      </div>

      {/* TABLE */}
      <div className="card p-4">
        <table className="table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Description</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="font-mono text-sm">{p.key}</td>
                <td>{p.name}</td>
                <td className="text-sm text-gray-600">{p.description}</td>

                <td className="text-right space-x-2">
                  {canManage && (
                    <>
                      <button
                        className="btn-secondary"
                        onClick={() => open(p)}
                      >
                        Edit
                      </button>

                      <button
                        className="btn-danger"
                        onClick={() => remove(p.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-lg p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold mb-4">
              {form.id ? 'Edit Permission' : 'Add Permission'}
            </h3>

            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Key</label>
                <input
                  className="input mt-1"
                  value={form.key}
                  disabled={!!form.id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, key: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Name</label>
                <input
                  className="input mt-1"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Description</label>
                <textarea
                  className="input mt-1"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
