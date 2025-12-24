import { useState, useEffect } from 'react'
import { XCircle, Shield, CheckCircle, XCircle as XCircleIcon, Trash2, Plus } from 'lucide-react'
import api from '../../api/client'

interface User {
    id: number
    email: string
    firstName?: string
    lastName?: string
    roleId: number
}

interface Permission {
    id: number
    key: string
    name: string
}

interface Override {
    key: string
    mode: 'GRANT' | 'DENY'
}

interface ManageUserPermissionsModalProps {
    user: User
    roleName: string
    onClose: () => void
}

export default function ManageUserPermissionsModal({ user, roleName, onClose }: ManageUserPermissionsModalProps) {
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set())
    const [overrides, setOverrides] = useState<Override[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddDropdown, setShowAddDropdown] = useState(false)
    const [selectedPermission, setSelectedPermission] = useState('')
    const [selectedMode, setSelectedMode] = useState<'GRANT' | 'DENY'>('GRANT')

    useEffect(() => {
        loadData()
    }, [user.id, user.roleId])

    const loadData = async () => {
        try {
            setLoading(true)
            const [permsRes, rolePermsRes, overridesRes] = await Promise.all([
                api.get('/permissions'),
                api.get(`/roles/${user.roleId}/permissions`),
                api.get(`/users/${user.id}/overrides`)
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

    const handleAddOverride = async () => {
        if (!selectedPermission) {
            alert('Please select a permission')
            return
        }

        try {
            await api.put(`/users/${user.id}/overrides`, {
                overrides: [...overrides.filter(o => o.key !== selectedPermission), { key: selectedPermission, mode: selectedMode }]
            })
            await loadData()
            setShowAddDropdown(false)
            setSelectedPermission('')
        } catch (err) {
            console.error('Error adding override:', err)
            alert('Failed to add override')
        }
    }

    const handleDeleteOverride = async (key: string) => {
        if (!confirm('Delete this permission override?')) return

        try {
            await api.delete(`/users/${user.id}/overrides/${key}`)
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

    const userName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || user.email

    const overrideMap = new Map(overrides.map(o => [o.key, o.mode]))
    const existingOverrideKeys = new Set(overrides.map(o => o.key))
    const availablePermissions = permissions.filter(p => !existingOverrideKeys.has(p.key))

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">Manage User Permissions</h3>
                        <p className="text-sm text-gray-600 mt-1">
                            {userName} • {user.email} • <span className="font-medium">{roleName}</span> role
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XCircle size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Shield className="animate-pulse text-gray-400" size={32} />
                        </div>
                    ) : (
                        <>
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div className="bg-gray-50 rounded p-3">
                                    <div className="text-gray-600">Role Permissions</div>
                                    <div className="text-xl font-semibold text-gray-900">{rolePermissions.size}</div>
                                </div>
                                <div className="bg-blue-50 rounded p-3">
                                    <div className="text-blue-700">Overrides Applied</div>
                                    <div className="text-xl font-semibold text-blue-900">{overrides.length}</div>
                                </div>
                                <div className="bg-green-50 rounded p-3">
                                    <div className="text-green-700">Effective Permissions</div>
                                    <div className="text-xl font-semibold text-green-900">
                                        {permissions.filter(p => getEffectivePermission(p.key)).length}
                                    </div>
                                </div>
                            </div>

                            {/* Add Override Section */}
                            {showAddDropdown ? (
                                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1">
                                            <select
                                                className="input w-full mb-2"
                                                value={selectedPermission}
                                                onChange={(e) => setSelectedPermission(e.target.value)}
                                            >
                                                <option value="">Select a permission...</option>
                                                {availablePermissions.map((perm) => (
                                                    <option key={perm.id} value={perm.key}>
                                                        {perm.key} - {perm.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    className={`flex-1 px-3 py-2 rounded border-2 text-sm font-medium ${selectedMode === 'GRANT'
                                                            ? 'border-green-500 bg-green-50 text-green-700'
                                                            : 'border-gray-200 bg-white text-gray-600'
                                                        }`}
                                                    onClick={() => setSelectedMode('GRANT')}
                                                >
                                                    ✅ GRANT
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`flex-1 px-3 py-2 rounded border-2 text-sm font-medium ${selectedMode === 'DENY'
                                                            ? 'border-red-500 bg-red-50 text-red-700'
                                                            : 'border-gray-200 bg-white text-gray-600'
                                                        }`}
                                                    onClick={() => setSelectedMode('DENY')}
                                                >
                                                    ❌ DENY
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={handleAddOverride}
                                                className="btn-primary text-sm"
                                                disabled={!selectedPermission}
                                            >
                                                Add
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowAddDropdown(false)
                                                    setSelectedPermission('')
                                                }}
                                                className="btn-secondary text-sm"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowAddDropdown(true)}
                                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2"
                                >
                                    <Plus size={16} />
                                    Add Permission Override
                                </button>
                            )}

                            {/* Permission Table */}
                            <div className="overflow-x-auto border rounded">
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
                                                            <XCircleIcon className="inline text-gray-300" size={18} />
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
                                                            <XCircleIcon className="inline text-gray-400" size={20} />
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
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
                    <button onClick={onClose} className="btn-primary">
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
