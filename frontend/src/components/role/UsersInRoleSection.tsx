import { useState, useEffect } from 'react'
import { Users, Settings } from 'lucide-react'
import api from '../../api/client'
import ManageUserPermissionsModal from './ManageUserPermissionsModal'

interface User {
    id: number
    email: string
    firstName?: string
    lastName?: string
    roleId: number
}

interface UsersInRoleSectionProps {
    roleId: number
    roleName: string
}

export default function UsersInRoleSection({ roleId, roleName }: UsersInRoleSectionProps) {
    const [users, setUsers] = useState<User[]>([])
    const [overrideCounts, setOverrideCounts] = useState<Record<number, number>>({})
    const [loading, setLoading] = useState(true)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)

    useEffect(() => {
        loadUsersInRole()
    }, [roleId])

    const loadUsersInRole = async () => {
        try {
            setLoading(true)
            const { data } = await api.get('/users')
            const usersData = Array.isArray(data) ? data : (data?.items || [])

            // Filter users with this role
            const roleUsers = usersData.filter((u: User) => u.roleId === roleId)
            setUsers(roleUsers)

            // Load override counts for each user
            const counts: Record<number, number> = {}
            await Promise.all(
                roleUsers.map(async (user: User) => {
                    try {
                        const { data: overrides } = await api.get(`/users/${user.id}/overrides`)
                        counts[user.id] = Array.isArray(overrides) ? overrides.length : 0
                    } catch {
                        counts[user.id] = 0
                    }
                })
            )
            setOverrideCounts(counts)
        } catch (err) {
            console.error('Error loading users in role:', err)
        } finally {
            setLoading(false)
        }
    }

    const getUserDisplayName = (user: User) => {
        if (user.firstName && user.lastName) {
            return `${user.firstName} ${user.lastName}`
        }
        if (user.firstName) return user.firstName
        if (user.lastName) return user.lastName
        return user.email
    }

    if (loading) {
        return (
            <div className="card p-6">
                <div className="flex items-center gap-2 text-gray-600">
                    <Users className="animate-pulse" size={18} />
                    <span>Loading users...</span>
                </div>
            </div>
        )
    }

    if (users.length === 0) {
        return (
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-3">
                    <Users size={20} className="text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-800">Users in This Role</h3>
                </div>
                <p className="text-sm text-gray-500">No users currently assigned to this role.</p>
            </div>
        )
    }

    return (
        <>
            <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                        <Users size={20} className="text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-800">Users in This Role</h3>
                        <span className="text-sm text-gray-500">({users.length})</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left py-2 px-3 font-semibold text-gray-700">Name</th>
                                <th className="text-left py-2 px-3 font-semibold text-gray-700">Email</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700">Overrides</th>
                                <th className="text-center py-2 px-3 font-semibold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {users.map((user) => {
                                const overrideCount = overrideCounts[user.id] || 0
                                const displayName = getUserDisplayName(user)

                                return (
                                    <tr key={user.id} className="hover:bg-gray-50">
                                        <td className="py-2 px-3">
                                            <div className="font-medium text-gray-900">{displayName}</div>
                                        </td>
                                        <td className="py-2 px-3">
                                            <div className="text-gray-600">{user.email}</div>
                                        </td>
                                        <td className="text-center py-2 px-3">
                                            {overrideCount > 0 ? (
                                                <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
                                                    {overrideCount} {overrideCount === 1 ? 'override' : 'overrides'}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="text-center py-2 px-3">
                                            <button
                                                onClick={() => setSelectedUser(user)}
                                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded"
                                            >
                                                <Settings size={14} />
                                                Manage Permissions
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedUser && (
                <ManageUserPermissionsModal
                    user={selectedUser}
                    roleName={roleName}
                    onClose={() => {
                        setSelectedUser(null)
                        loadUsersInRole() // Refresh counts
                    }}
                />
            )}
        </>
    )
}
