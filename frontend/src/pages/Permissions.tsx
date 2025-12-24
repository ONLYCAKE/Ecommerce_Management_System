import { useEffect, useState, FormEvent, useMemo } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../context/ConfirmContext';
import { KeyRound, Plus, Pencil, Trash2, Lock, Package, Shield, Award, Layers, Search } from 'lucide-react';
import SummaryCards, { SummaryCard } from '../components/common/SummaryCards';
import TableActions, { ActionButton } from '../components/common/TableActions';
import StatusBadge from '../components/common/StatusBadge';

interface Permission {
  id: number;
  key: string;
  name: string;
  description: string;
}

export default function Permissions() {
  const [items, setItems] = useState<Permission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();

  // Only SuperAdmin can manage permissions
  const canManage = user?.role === 'SuperAdmin';

  const confirmModal = useConfirm();

  // Load all permissions
  const fetchAll = async () => {
    try {
      const { data } = await api.get<Permission[]>('/permissions');
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading permissions:', err);
      setItems([]);
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

  // Group permissions by module
  const groupedPermissions = useMemo(() => {
    const filtered = searchQuery.trim()
      ? items.filter((p) =>
        [p.key, p.name, p.description]
          .join(' ')
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
      : items;

    return filtered.reduce((acc, perm) => {
      const module = perm.key.split('.')[0];
      if (!acc[module]) acc[module] = [];
      acc[module].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  }, [items, searchQuery]);

  // Summary stats
  const summaryCards: SummaryCard[] = useMemo(() => {
    const totalPermissions = items.length;
    const totalModules = Object.keys(groupedPermissions).length;
    const crudOps = items.filter((p) =>
      ['create', 'read', 'update', 'delete'].some((op) => p.key.includes(`.${op}`))
    ).length;
    const specialPerms = items.filter((p) => p.key.includes('permission')).length;

    return [
      {
        title: 'Total Permissions',
        value: totalPermissions,
        icon: Lock,
        color: 'indigo'
      },
      {
        title: 'Modules',
        value: totalModules,
        icon: Package,
        color: 'purple',
        subtitle: 'Permission groups'
      },
      {
        title: 'CRUD Operations',
        value: crudOps,
        icon: Shield,
        color: 'blue',
        subtitle: 'Standard operations'
      },
      {
        title: 'Special Permissions',
        value: specialPerms,
        icon: Award,
        color: 'orange',
        subtitle: 'Advanced features'
      }
    ];
  }, [items, groupedPermissions]);

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
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-lg">
            <KeyRound size={24} strokeWidth={1.8} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Permissions Management</h1>
            <p className="text-sm text-gray-500">Manage system permissions and access control</p>
          </div>
        </div>
        {canManage && (
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => open(null)}
          >
            <Plus size={18} strokeWidth={1.8} />
            Add Permission
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by key, name, or description..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grouped Permissions */}
      {Object.entries(groupedPermissions).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <Lock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No permissions found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search</p>
        </div>
      ) : (
        Object.entries(groupedPermissions)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([module, perms]) => (
            <div key={module} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Module Header */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Layers size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 capitalize">{module} Module</h3>
                      <p className="text-sm text-gray-600">
                        {perms.length} {perms.length === 1 ? 'permission' : 'permissions'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge label={perms.length} variant="indigo" size="md" />
                </div>
              </div>

              {/* Permissions Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Permission Key
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Description
                      </th>
                      {canManage && (
                        <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {perms.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <code className="px-2.5 py-1 bg-gray-100 text-indigo-600 rounded font-mono text-sm font-medium">
                            {p.key}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-900">{p.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{p.description || '-'}</span>
                        </td>

                        {canManage && (
                          <td className="px-6 py-4 text-right">
                            <TableActions
                              actions={[
                                {
                                  label: 'Edit',
                                  icon: Pencil,
                                  onClick: () => open(p),
                                  color: 'blue',
                                  show: true
                                },
                                {
                                  label: 'Delete',
                                  icon: Trash2,
                                  onClick: () => remove(p.id),
                                  color: 'red',
                                  show: true
                                }
                              ]}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
      )}

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-6 rounded-t-xl">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                {form.id ? (
                  <>
                    <Pencil size={20} strokeWidth={1.8} />
                    Edit Permission
                  </>
                ) : (
                  <>
                    <Plus size={20} strokeWidth={1.8} />
                    Add Permission
                  </>
                )}
              </h3>
              <p className="text-indigo-100 text-sm mt-1">
                {form.id ? 'Update permission details' : 'Create a new system permission'}
              </p>
            </div>

            <form onSubmit={save} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permission Key <span className="text-red-500">*</span>
                </label>
                <input
                  className={`input w-full ${form.id ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'}`}
                  value={form.key}
                  disabled={!!form.id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, key: e.target.value }))
                  }
                  placeholder="module.action (e.g., user.create)"
                  required
                />
                {!form.id && (
                  <p className="text-xs text-gray-500 mt-1">
                    Format: module.action (e.g., user.create, product.update)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="input w-full border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Human-readable name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  className="input w-full h-24 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="What does this permission allow?"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200">
                  {form.id ? 'Update' : 'Create'} Permission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
