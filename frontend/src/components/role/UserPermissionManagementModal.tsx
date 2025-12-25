import { useState, useEffect, useMemo } from 'react'
import { Shield, XCircle } from 'lucide-react'
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
    description?: string
}

interface PermissionWithModule extends Permission {
    module: string
}

interface UserPermissionManagementModalProps {
    user: User
    roleName: string
    onClose: () => void
}

export default function UserPermissionManagementModal({ user, roleName, onClose }: UserPermissionManagementModalProps) {
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set())
    const [overrides, setOverrides] = useState<Map<string, 'GRANT' | 'DENY'>>(new Map())
    const [selected, setSelected] = useState<Set<string>>(new Set()) // Effective permissions
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState<'all' | string>('all')

    // Detect SuperAdmin role
    const isSuperAdmin = roleName?.toLowerCase() === 'superadmin'

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

            const allPerms = permsRes.data.items || permsRes.data || []
            setPermissions(allPerms)

            // Get role permissions
            const rpKeys = new Set<string>(
                (rolePermsRes.data.items || rolePermsRes.data || [])
                    .filter((rp: any) => rp.enabled)
                    .map((rp: any) => rp.permission?.key || rp.key)
            )

            console.log('🔍 Permission Modal Debug:', {
                userId: user.id,
                roleName,
                isSuperAdmin,
                totalPermissions: allPerms.length,
                rolePermissions: Array.from(rpKeys),
                rolePermissionCount: rpKeys.size
            })

            setRolePermissions(rpKeys)

            // Get overrides
            const overridesArray = overridesRes.data || []
            const overridesMap = new Map<string, 'GRANT' | 'DENY'>()
            overridesArray.forEach((o: any) => {
                overridesMap.set(o.key, o.mode)
            })
            setOverrides(overridesMap)

            // Calculate effective permissions
            let effective: Set<string>

            if (isSuperAdmin) {
                // SuperAdmin gets ALL permissions checked
                effective = new Set(allPerms.map((p: Permission) => p.key))
                console.log('✅ SuperAdmin detected - all permissions enabled')
            } else {
                // Normal role resolution
                effective = new Set(rpKeys)

                console.log('📋 Starting with role permissions:', {
                    effectiveCount: effective.size,
                    firstFew: Array.from(effective).slice(0, 10)
                })

                overridesArray.forEach((o: any) => {
                    if (o.mode === 'GRANT') effective.add(o.key)
                    if (o.mode === 'DENY') effective.delete(o.key)
                })

                console.log('✅ After applying overrides:', {
                    effectiveCount: effective.size,
                    grantOverrides: overridesArray.filter((o: any) => o.mode === 'GRANT').length,
                    denyOverrides: overridesArray.filter((o: any) => o.mode === 'DENY').length
                })
            }

            setSelected(effective)
        } catch (err) {
            console.error('Error loading permission data:', err)
        } finally {
            setLoading(false)
        }
    }

    const togglePermission = async (key: string, currentlyHas: boolean) => {
        // SuperAdmin cannot toggle permissions (always has all)
        if (isSuperAdmin) {
            return
        }

        const hasFromRole = rolePermissions.has(key)
        const currentOverride = overrides.get(key)

        // Optimistic update
        const newSelected = new Set(selected)
        const newOverrides = new Map(overrides)

        if (currentlyHas) {
            // User has it, wants to remove it
            newSelected.delete(key)

            if (hasFromRole) {
                // Has from role, need DENY override
                newOverrides.set(key, 'DENY')
            } else {
                // Has from GRANT override, remove it
                newOverrides.delete(key)
            }
        } else {
            // User doesn't have it, wants to add it
            newSelected.add(key)

            if (!hasFromRole) {
                // Doesn't have from role, need GRANT override
                newOverrides.set(key, 'GRANT')
            } else {
                // Has from role but was DENYed, remove DENY
                newOverrides.delete(key)
            }
        }

        setSelected(newSelected)
        setOverrides(newOverrides)

        // Send to API
        try {
            const overridesArray = Array.from(newOverrides.entries()).map(([k, mode]) => ({ key: k, mode }))
            await api.put(`/users/${user.id}/overrides`, { overrides: overridesArray })
        } catch (err) {
            console.error('Error updating override:', err)
            // Revert on error
            setSelected(selected)
            setOverrides(overrides)
            alert('Failed to update permission')
        }
    }

    const updateBulk = async (keys: string[], enable: boolean) => {
        const newSelected = new Set(selected)
        const newOverrides = new Map(overrides)

        keys.forEach(key => {
            const hasFromRole = rolePermissions.has(key)

            if (enable) {
                newSelected.add(key)
                if (!hasFromRole) {
                    newOverrides.set(key, 'GRANT')
                } else {
                    newOverrides.delete(key)
                }
            } else {
                newSelected.delete(key)
                if (hasFromRole) {
                    newOverrides.set(key, 'DENY')
                } else {
                    newOverrides.delete(key)
                }
            }
        })

        setSelected(newSelected)
        setOverrides(newOverrides)

        try {
            const overridesArray = Array.from(newOverrides.entries()).map(([k, mode]) => ({ key: k, mode }))
            await api.put(`/users/${user.id}/overrides`, { overrides: overridesArray })
        } catch (err) {
            console.error('Error bulk updating:', err)
            setSelected(selected)
            setOverrides(overrides)
            alert('Failed to update permissions')
        }
    }

    const withCategory = useMemo(() => {
        return permissions.map((p) => {
            const [module] = (p.key || '').split('.')
            return {
                ...p,
                module: module || 'other',
            } as PermissionWithModule
        })
    }, [permissions])

    const categoryOptions = useMemo(() => {
        const modules = new Set<string>()
        withCategory.forEach((p) => {
            if (p.module) modules.add(p.module)
        })
        return ['all', ...Array.from(modules).sort()]
    }, [withCategory])

    const filtered = useMemo(() => {
        return withCategory.filter((p) => {
            if (category !== 'all' && p.module !== category) return false
            if (!search.trim()) return true
            const q = search.trim().toLowerCase()
            return (
                (p.name && p.name.toLowerCase().includes(q)) ||
                p.key.toLowerCase().includes(q)
            )
        })
    }, [withCategory, category, search])

    const grouped = useMemo(() => {
        const groups: Record<string, PermissionWithModule[]> = {}
        filtered.forEach((p) => {
            const mod = p.module
            if (!groups[mod]) groups[mod] = []
            groups[mod].push(p)
        })
        return groups
    }, [filtered])

    const userName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || user.email

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8">
                    <Shield className="animate-pulse text-gray-400 mx-auto" size={48} />
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Shield size={24} />
                                Manage User Permissions
                                {isSuperAdmin && (
                                    <span className="ml-2 px-3 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">
                                        SUPERADMIN
                                    </span>
                                )}
                            </h3>
                            <p className="text-blue-100 text-sm mt-1">
                                {userName} • {user.email} • <span className="font-medium">{roleName}</span> role
                            </p>
                            <p className="text-blue-200 text-xs mt-1">
                                {selected.size} of {permissions.length} permissions enabled • {overrides.size} custom overrides
                                {isSuperAdmin && <span className="ml-2 font-semibold">(All permissions granted by default)</span>}
                            </p>
                        </div>
                        <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition">
                            <XCircle size={24} />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b bg-gray-50 flex gap-3">
                    <input
                        type="text"
                        className="input flex-1 max-w-md"
                        placeholder="Search permissions..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                        className="input text-sm min-w-[160px]"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        {categoryOptions.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt === 'all'
                                    ? 'All Categories'
                                    : opt.charAt(0).toUpperCase() + opt.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Permission Groups */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {Object.entries(grouped).map(([mod, groupPerms]) => {
                        const total = groupPerms.length
                        const assigned = groupPerms.filter((p) => selected.has(p.key)).length
                        const label = mod.charAt(0).toUpperCase() + mod.slice(1)

                        return (
                            <div key={mod} className="border rounded-xl bg-white">
                                <div className="px-4 py-3 flex items-center justify-between border-b bg-gray-50">
                                    <div>
                                        <div className="text-sm font-semibold text-gray-800">{label}</div>
                                        <div className="text-xs text-gray-500">
                                            {assigned} / {total} enabled
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs">
                                        <button
                                            type="button"
                                            className="px-2.5 py-1 rounded-md border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={() => updateBulk(groupPerms.map((p) => p.key), true)}
                                            disabled={isSuperAdmin}
                                        >
                                            + Enable All
                                        </button>
                                        <button
                                            type="button"
                                            className="px-2.5 py-1 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={() => updateBulk(groupPerms.map((p) => p.key), false)}
                                            disabled={isSuperAdmin}
                                        >
                                            - Disable All
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                    {groupPerms.map((p) => {
                                        const checked = selected.has(p.key)
                                        const hasFromRole = rolePermissions.has(p.key)
                                        const override = overrides.get(p.key)

                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                className={
                                                    'w-full text-left border rounded-lg px-3 py-2 text-sm transition-colors flex items-start gap-2 ' +
                                                    (checked
                                                        ? 'bg-green-50 border-green-500'
                                                        : 'bg-white border-gray-200 hover:bg-gray-50')
                                                }
                                                onClick={() => togglePermission(p.key, checked)}
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="mt-0.5 h-4 w-4 accent-green-600"
                                                    checked={checked}
                                                    readOnly
                                                />
                                                <div className="flex-1">
                                                    <div className="font-semibold text-gray-800 flex items-center gap-1">
                                                        {p.name || p.key}
                                                        {override === 'GRANT' && (
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded font-bold">+</span>
                                                        )}
                                                        {override === 'DENY' && (
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded font-bold">−</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-gray-500 font-mono break-all">
                                                        {p.key}
                                                    </div>
                                                    {p.description && (
                                                        <div className="mt-1 text-[11px] text-gray-500">
                                                            {p.description}
                                                        </div>
                                                    )}
                                                    {override && (
                                                        <div className="mt-1 text-[10px] text-gray-600 italic">
                                                            {override === 'GRANT' && !hasFromRole && '(Extra permission)'}
                                                            {override === 'DENY' && hasFromRole && '(Role permission blocked)'}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}

                    {Object.keys(grouped).length === 0 && (
                        <div className="text-sm text-gray-500 text-center py-8">
                            No permissions found for this filter.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                        💡 <strong>Tip:</strong> Green <span className="text-green-700 font-bold">+</span> = Extra permission granted.
                        Red <span className="text-red-700 font-bold">−</span> = Role permission blocked.
                    </p>
                    <button onClick={onClose} className="btn-primary">
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
