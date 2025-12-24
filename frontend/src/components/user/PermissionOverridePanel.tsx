import { useState, useEffect } from 'react'
import { Shield, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react'
import api from '../../api/client'
import AddOverrideModal from './AddOverrideModal'

interface Permission {
    id: number
    key: string
    name: string
}

interface Override {
    key: string
    mode: 'GRANT' | 'DENY'
}

interface PermissionOverridePanelProps {
    userId: number
    userRoleId: number
}

export default function PermissionOverridePanel({ userId, userRoleId }: PermissionOverridePanelProps) {
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set())
    const [overrides, setOverrides] = useState<Override[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)

    useEffect(() => {
        loadData()
    }, [userId, userRoleId])

    const loadData = async () => {
        try {
            setLoading(true)
            const [permsRes, rolePermsRes, overridesRes] = await Promise.all([
                api.get('/permissions'),
                api.get(`/roles/${userRoleId}/permissions`),
                api.get(`/users/${userId}/overrides`)
            ])

            setPermissions(permsRes.data.items || permsRes.data || [])

            const rpKeys = new Set<string>(
                (rolePermsRes.data.items || rolePermsRes.data || [])
                    .filter((rp: any) => rp.enabled)
                    .map((rp: any) => rp.permission?.key || rp.key)
            )
            setRolePermissions(rpKeys)
            setOverrides(overridesRes.data || [])
        } catch (err) {
            console.error('Error loading permission data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleAddOverride = async (key: string, mode: 'GRANT' | 'DENY') => {
        try {
            await api.put(`/users/${userId}/overrides`, {
                overrides: [...overrides.filter(o => o.key !== key), { key, mode }]
            })
            await loadData()
            setShowAddModal(false)
        } catch (err) {
            console.error('Error adding override:', err)
            alert('Failed to add override')
        }
    }

    const handleDeleteOverride = async (key: string) => {
        if (!confirm('Delete this permission override?')) return

        try {
            await api.delete(`/users/${userId}/overrides/${key}`)
            await loadData()
        } catch (err) {
            console.error('Error deleting override:', err)
            alert('Failed to delete override')
        }
    }

    const getEffectivePermission = (key: string): boolean => {
        const hasRole = rolePermissions.has(key)
        const override = overrides.find(o => o.key === key)

        if (!override) return hasRole
        if (override.mode === 'GRANT') return true
        if (override.mode === 'DENY') return false
        return hasRole
    }

    if (loading) {
        return (
            <div className="card p-6">
                <div className="flex items-center gap-2 text-gray-600">
                    <Shield className="animate-pulse" size={18} />
                    <span>Loading permission overrides...</span>
                </div>
            </div>
        )
    }

    const overrideMap = new Map(overrides.map(o => [o.key, o.mode]))

    return (
        <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                    <Shield size={20} className="text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-800">Permission Overrides</h3>
                    <span className="text-xs text-gray-500">(User-Specific)</span>
                </div>
                <button
                    type="button"
                    className="btn-primary text-sm flex items-center gap-2"
                    onClick={() => setShowAddModal(true)}
                >
                    <Plus size={16} />
                    Add Override
                </button>
            </div>

            <div className="text-sm space-y-2 mb-4">
                <div className="flex justify-between text-gray-600">
                    <span>Role Permissions:</span>
                    <span className="font-medium">{rolePermissions.size}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                    <span>Overrides Applied:</span>
                    <span className="font-medium">{overrides.length}</span>
                </div>
                <div className="flex justify-between text-gray-700 font-semibold border-t pt-2">
                    <span>Effective Permissions:</span>
                    <span>{permissions.filter(p => getEffectivePermission(p.key)).length}</span>
                </div>
            </div>

            {overrides.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                    <p className="text-xs text-blue-700">
                        <strong>Note:</strong> Overrides apply only to this user and do not affect the role.
                        GRANT adds permissions not in the role. DENY removes permissions from the role.
                    </p>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Permission</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700">From Role</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700">Override</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700">Effective</th>
                            <th className="text-center py-2 px-3 font-semibold text-gray-700">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {permissions.map((perm) => {
                            const override = overrideMap.get(perm.key)
                            const hasRole = rolePermissions.has(perm.key)
                            const effective = getEffectivePermission(perm.key)

                            return (
                                <tr key={perm.id} className="hover:bg-gray-50">
                                    <td className="py-2 px-3">
                                        <div className="font-mono text-xs">{perm.key}</div>
                                        <div className="text-gray-600 text-xs">{perm.name}</div>
                                    </td>
                                    <td className="text-center py-2 px-3">
                                        {hasRole ? (
                                            <CheckCircle className="inline text-green-600" size={18} />
                                        ) : (
                                            <XCircle className="inline text-gray-300" size={18} />
                                        )}
                                    </td>
                                    <td className="text-center py-2 px-3">
                                        {override === 'GRANT' && (
                                            <span className="inline-block px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded">
                                                ✅ GRANT
                                            </span>
                                        )}
                                        {override === 'DENY' && (
                                            <span className="inline-block px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded">
                                                ❌ DENY
                                            </span>
                                        )}
                                        {!override && <span className="text-gray-400">-</span>}
                                    </td>
                                    <td className="text-center py-2 px-3">
                                        {effective ? (
                                            <CheckCircle className="inline text-blue-600 font-bold" size={20} />
                                        ) : (
                                            <XCircle className="inline text-gray-400" size={20} />
                                        )}
                                    </td>
                                    <td className="text-center py-2 px-3">
                                        {override && (
                                            <button
                                                onClick={() => handleDeleteOverride(perm.key)}
                                                className="text-red-600 hover:text-red-800 p-1"
                                                title="Remove override"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {showAddModal && (
                <AddOverrideModal
                    permissions={permissions}
                    existingOverrides={overrides}
                    onAdd={handleAddOverride}
                    onClose={() => setShowAddModal(false)}
                />
            )}
        </div>
    )
}
