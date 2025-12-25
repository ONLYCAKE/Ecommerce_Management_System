import { useState, useEffect } from 'react'
import { Shield, CheckCircle, XCircle, Info } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'

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
    userRole?: string
}

type PermissionSource = 'role' | 'grant' | 'deny' | 'none'

export default function PermissionOverridePanel({ userId, userRoleId, userRole }: PermissionOverridePanelProps) {
    const { refreshPermissions } = useAuth()
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set())
    const [overrides, setOverrides] = useState<Override[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const isSuperAdmin = userRole?.toLowerCase() === 'superadmin'
    const isAdmin = userRole?.toLowerCase() === 'admin'
    const isEmployee = userRole?.toLowerCase() === 'employee'

    // Debug logging
    useEffect(() => {
        console.log('🔍 PermissionOverridePanel Debug:', {
            userRole,
            isSuperAdmin,
            isAdmin,
            isEmployee,
            userId,
            userRoleId
        })
    }, [userRole, isSuperAdmin, isAdmin, isEmployee])

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

            // Extract role permission keys
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

    // Determine permission source and effective state
    const getPermissionState = (key: string): { source: PermissionSource; isEffective: boolean } => {
        const hasRole = rolePermissions.has(key)
        const override = overrides.find(o => o.key === key)

        // SuperAdmin always has all permissions
        if (isSuperAdmin) {
            return { source: 'role', isEffective: true }
        }

        // Check override first
        if (override) {
            if (override.mode === 'GRANT') {
                return { source: 'grant', isEffective: true }
            }
            if (override.mode === 'DENY') {
                return { source: 'deny', isEffective: false }
            }
        }

        // Fall back to role permission
        if (hasRole) {
            return { source: 'role', isEffective: true }
        }

        return { source: 'none', isEffective: false }
    }

    const handleTogglePermission = async (key: string) => {
        if (isSuperAdmin || saving) return // SuperAdmin permissions are read-only

        setSaving(true)
        try {
            const { source, isEffective } = getPermissionState(key)
            const hasRole = rolePermissions.has(key)
            let newOverrides = [...overrides]

            // Determine what to do based on current state and role defaults
            if (isEffective) {
                // Currently has permission - user wants to remove it
                if (source === 'role') {
                    // Permission from role - add DENY override
                    newOverrides = newOverrides.filter(o => o.key !== key)
                    newOverrides.push({ key, mode: 'DENY' })
                } else if (source === 'grant') {
                    // Permission from GRANT override - remove override
                    newOverrides = newOverrides.filter(o => o.key !== key)
                }
                // source === 'deny' shouldn't happen if isEffective is true
            } else {
                // Currently doesn't have permission - user wants to add it
                if (source === 'deny') {
                    // Was denied - remove DENY override
                    newOverrides = newOverrides.filter(o => o.key !== key)
                } else {
                    // Not in role - add GRANT override
                    newOverrides = newOverrides.filter(o => o.key !== key)
                    newOverrides.push({ key, mode: 'GRANT' })
                }
            }

            // Save to backend
            await api.put(`/users/${userId}/overrides`, { overrides: newOverrides })

            // Reload data
            await loadData()

            // Refresh current user's permissions
            await refreshPermissions()

            // Force reload if editing current user for full UI sync
            const currentUserId = JSON.parse(localStorage.getItem('user') || '{}').id
            if (currentUserId === userId) {
                setTimeout(() => window.location.reload(), 300)
            }
        } catch (err) {
            console.error('Error toggling permission:', err)
            alert('Failed to update permission')
        } finally {
            setSaving(false)
        }
    }

    const getPermissionBadge = (source: PermissionSource) => {
        switch (source) {
            case 'role':
                return (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                        Role
                    </span>
                )
            case 'grant':
                return (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                        ✓ GRANT
                    </span>
                )
            case 'deny':
                return (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-semibold">
                        ✗ DENY
                    </span>
                )
            default:
                return null
        }
    }

    const getTooltipText = (source: PermissionSource, isEffective: boolean) => {
        if (isSuperAdmin) return 'SuperAdmin has all permissions by default'

        switch (source) {
            case 'role':
                return 'Granted by role'
            case 'grant':
                return 'Granted explicitly (override)'
            case 'deny':
                return 'Blocked by override'
            default:
                return isEffective ? 'Permission enabled' : 'Permission disabled'
        }
    }

    if (loading) {
        return (
            <div className="card p-6">
                <div className="flex items-center gap-2 text-gray-600">
                    <Shield className="animate-pulse" size={18} />
                    <span>Loading permissions...</span>
                </div>
            </div>
        )
    }

    // Calculate stats
    const effectiveCount = permissions.filter(p => getPermissionState(p.key).isEffective).length
    const grantCount = overrides.filter(o => o.mode === 'GRANT').length
    const denyCount = overrides.filter(o => o.mode === 'DENY').length

    return (
        <div className="card p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                    <Shield size={20} className="text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-800">User Permissions</h3>
                    {isSuperAdmin && (
                        <div className="flex items-center gap-1 ml-2 px-2 py-1 bg-purple-50 border border-purple-200 rounded text-xs text-purple-700">
                            <Info size={14} />
                            <span className="font-semibold">SuperAdmin</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Role Info Banner */}
            {isSuperAdmin && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-purple-900">
                        <strong>🔐 SuperAdmin Access:</strong><br />
                        This user has the <strong>SuperAdmin</strong> role which grants <strong>ALL permissions</strong> automatically.
                        Permissions cannot be modified and are shown for reference only.
                    </p>
                </div>
            )}

            {isAdmin && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                        <strong>💡 Admin Role:</strong><br />
                        Permissions marked with <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium mx-1">Role</span> are granted by the Admin role.
                        You can add <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold mx-1">✓ GRANT</span> overrides for additional permissions
                        or <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold mx-1">✗ DENY</span> overrides to remove specific permissions.
                    </p>
                </div>
            )}

            {isEmployee && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                        <strong>👤 Employee Role:</strong><br />
                        By default, employees have no permissions. Check boxes to grant specific permissions via <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold mx-1">✓ GRANT</span> overrides.
                    </p>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="bg-gray-50 rounded p-3">
                    <div className="text-gray-600 text-xs">From Role</div>
                    <div className="text-lg font-bold text-gray-800">{rolePermissions.size}</div>
                </div>
                <div className="bg-green-50 rounded p-3">
                    <div className="text-green-600 text-xs">GRANT Overrides</div>
                    <div className="text-lg font-bold text-green-700">{grantCount}</div>
                </div>
                <div className="bg-red-50 rounded p-3">
                    <div className="text-red-600 text-xs">DENY Overrides</div>
                    <div className="text-lg font-bold text-red-700">{denyCount}</div>
                </div>
                <div className="bg-blue-50 rounded p-3">
                    <div className="text-blue-600 text-xs">Effective Total</div>
                    <div className="text-lg font-bold text-blue-700">{effectiveCount}</div>
                </div>
            </div>

            {/* Permission Checkboxes */}
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                    <span className="text-sm font-semibold text-gray-700">All Permissions ({permissions.length})</span>
                    {saving && <span className="ml-3 text-xs text-gray-500">Saving...</span>}
                </div>
                <div className="max-h-96 overflow-y-auto">
                    {permissions.map((perm) => {
                        const { source, isEffective } = getPermissionState(perm.key)
                        const tooltipText = getTooltipText(source, isEffective)

                        return (
                            <div
                                key={perm.id}
                                className={`px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${saving ? 'opacity-50 pointer-events-none' : ''
                                    }`}
                            >
                                <label
                                    className="flex items-center cursor-pointer"
                                    title={tooltipText}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isEffective}
                                        onChange={() => handleTogglePermission(perm.key)}
                                        disabled={isSuperAdmin || saving}
                                        className={`h-5 w-5 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 ${isSuperAdmin ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                            }`}
                                    />
                                    <div className="ml-3 flex-1">
                                        <div className="flex items-center">
                                            <span className="text-sm font-medium text-gray-800">
                                                {perm.name}
                                            </span>
                                            {getPermissionBadge(source)}
                                        </div>
                                        <span className="text-xs text-gray-500 font-mono">{perm.key}</span>
                                    </div>
                                    {isEffective ? (
                                        <CheckCircle size={18} className="text-green-600" />
                                    ) : (
                                        <XCircle size={18} className="text-gray-300" />
                                    )}
                                </label>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
