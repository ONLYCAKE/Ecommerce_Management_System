import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import UsersInRoleSection from '../components/role/UsersInRoleSection'

interface RoleApi {
  id: number
  name: string
  permissions?: Record<string, boolean>
  // Optional metadata that might exist on the role payload
  description?: string
  isActive?: boolean
  isArchived?: boolean
  createdAt?: string | Date
}

interface PermissionApi {
  id: number
  key: string
  name: string
  description?: string
}

interface UserSummary {
  id: number
  roleId: number
}

export default function EditRole() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [role, setRole] = useState<RoleApi | null>(null)
  const [permissions, setPermissions] = useState<PermissionApi[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | string>('all')

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [roleRes, permRes, usersRes] = await Promise.all([
          api.get(`/roles/${id}`),
          api.get<PermissionApi[]>('/permissions'),
          api.get<UserSummary[]>('/users'),
        ])

        if (!isMounted) return

        const roleData = roleRes.data as RoleApi
        setRole(roleData)

        const permsDataRaw = permRes.data
        const permsData = Array.isArray(permsDataRaw)
          ? permsDataRaw
          : (permsDataRaw as any)?.items && Array.isArray((permsDataRaw as any).items)
            ? ((permsDataRaw as any).items as PermissionApi[])
            : []
        setPermissions(permsData)

        const usersRaw = usersRes.data
        const usersData = Array.isArray(usersRaw) ? usersRaw : []
        setUsers(usersData)

        const initialSelected = new Set<string>()
        const permsRecord = roleData.permissions || {}
        Object.entries(permsRecord).forEach(([key, enabled]) => {
          if (enabled) initialSelected.add(key)
        })
        setSelected(initialSelected)
      } catch (err) {
        console.error('Error loading role or permissions', err)
        if (!isMounted) return
        setError('Unable to load role or permissions. Please try again.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [id])

  const canEdit = useMemo(() => {
    if (!role) return false
    if (user?.role === 'SuperAdmin' && role.name !== 'SuperAdmin') return true
    if (user?.role === 'Admin' && role.name === 'Employee') return true
    return false
  }, [role, user])

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 1500)
  }

  const applyServerSelection = (data: unknown) => {
    if (!Array.isArray(data)) return
    const next = new Set<string>()
    data.forEach((k) => {
      if (typeof k === 'string') next.add(k)
    })
    setSelected(next)
  }

  const updateSingle = async (key: string, enabled: boolean) => {
    if (!id) return

    const prev = new Set(selected)
    const optimistic = new Set(prev)
    if (enabled) optimistic.add(key)
    else optimistic.delete(key)
    setSelected(optimistic)

    try {
      const { data } = await api.put(`/roles/${id}/permissions`, { key, enabled })
      applyServerSelection(data)
      showToast('Permissions updated')
    } catch (err) {
      console.error('Error updating permission', err)
      setSelected(prev)
      setError('Failed to update permission. Please try again.')
    }
  }

  const updateBulk = async (keys: string[], enable: boolean) => {
    if (!id || !keys.length) return

    const uniqueKeys = keys.filter((k) =>
      enable ? !selected.has(k) : selected.has(k)
    )
    if (!uniqueKeys.length) return

    const prev = new Set(selected)
    const optimistic = new Set(prev)
    uniqueKeys.forEach((k) => {
      if (enable) optimistic.add(k)
      else optimistic.delete(k)
    })
    setSelected(optimistic)

    try {
      const responses = await Promise.all(
        uniqueKeys.map((key) =>
          api.put(`/roles/${id}/permissions`, { key, enabled: enable })
        )
      )
      const last = responses[responses.length - 1]?.data
      applyServerSelection(last)
      showToast('Permissions updated')
    } catch (err) {
      console.error('Error updating permissions in bulk', err)
      setSelected(prev)
      setError('Failed to update some permissions. Please try again.')
    }
  }

  const withCategory = useMemo(() => {
    return permissions.map((p) => {
      const [module] = (p.key || '').split('.')
      return {
        ...p,
        module: module || 'other',
      }
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
    const groups: Record<string, PermissionApi[]> = {}
    filtered.forEach((p) => {
      const mod = (p as any).module as string
      if (!groups[mod]) groups[mod] = []
      groups[mod].push(p)
    })
    return groups
  }, [filtered])

  if (loading) {
    return <div className="p-8 text-gray-600">Loading role and permissions...</div>
  }

  if (!role) {
    return (
      <div className="p-8 text-gray-600">
        Unable to load role.
      </div>
    )
  }

  const userCount = users.filter((u) => u.roleId === role.id).length
  const permissionCount = selected.size

  const isActive = (() => {
    if (typeof role.isActive === 'boolean') return role.isActive
    if (typeof role.isArchived === 'boolean') return !role.isArchived
    return undefined as boolean | undefined
  })()

  const createdAtLabel = role.createdAt
    ? new Date(role.createdAt).toLocaleDateString()
    : '-'

  const isSuperAdmin = user?.role === 'SuperAdmin'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => navigate('/roles')}
        >
          Back to Roles
        </button>

        <div className="text-right">
          <div className="text-xs text-gray-500">Manage Permissions</div>
          <div className="text-lg font-semibold text-gray-800">{role.name}</div>
        </div>
      </div>

      {/* Role summary card */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">{role.name}</div>
          <div className="text-xs text-gray-500 mt-1">
            {(role as any).description || 'No description'}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
            <span>
              <span className="font-semibold">{permissionCount}</span> permissions
            </span>
            <span className="mx-1 text-gray-300">•</span>
            <span>
              <span className="font-semibold">{userCount}</span> users
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 text-xs">
          <div>
            {isActive === true && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                Active
              </span>
            )}
            {isActive === false && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                Inactive
              </span>
            )}
            {isActive === undefined && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500">
                -
              </span>
            )}
          </div>
          <div className="text-gray-400">Created {createdAtLabel}</div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex-1 min-w-[220px] max-w-sm">
          <input
            type="text"
            className="input w-full"
            placeholder="Search permissions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
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
      </div>

      {/* Permission groups */}
      <div className="space-y-4">
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
                    {assigned} / {total} assigned
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-md border border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                      onClick={() => updateBulk(groupPerms.map((p) => p.key), true)}
                    >
                      + Add All
                    </button>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                      onClick={() => updateBulk(groupPerms.map((p) => p.key), false)}
                    >
                      - Remove All
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {groupPerms.map((p) => {
                  const checked = selected.has(p.key)

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
                      onClick={() => {
                        if (!canEdit) return
                        updateSingle(p.key, !checked)
                      }}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-green-600"
                        checked={checked}
                        readOnly
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">
                          {p.name || p.key}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono break-all">
                          {p.key}
                        </div>
                        {p.description && (
                          <div className="mt-1 text-[11px] text-gray-500">
                            {p.description}
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
          <div className="text-sm text-gray-500">
            No permissions found for this filter.
          </div>
        )}
      </div>

      {/* Users in This Role Section - SuperAdmin Only */}
      {isSuperAdmin && role && (
        <UsersInRoleSection
          roleId={role.id}
          roleName={role.name}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 bg-green-600 text-white px-4 py-2 rounded-lg shadow-md text-sm">
          {toast}
        </div>
      )}
    </div>
  )
}
