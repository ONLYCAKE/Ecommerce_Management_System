import { FormEvent, useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'

interface Permission {
  id: number
  key: string
  name?: string
  description?: string
}

export default function RoleCreate() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [perms, setPerms] = useState<Permission[]>([])
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set())
  const [permSearch, setPermSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [error, setError] = useState<string | null>(null)

  const canManagePermissions = Array.isArray(user?.permissions)
    && user.permissions.includes('permission.permission')

  useEffect(() => {
    const loadPerms = async () => {
      try {
        const { data } = await api.get<Permission[]>('/permissions')
        setPerms(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Error loading permissions', err)
        setPerms([])
      }
    }
    loadPerms()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      // 1) Create role
      const res = await api.post('/roles', {
        name,
        description,
      })

      const newRoleId = res.data?.id as number | undefined

      // 2) Assign permissions via existing endpoint
      if (newRoleId) {
        const slugs = Array.from(selectedPerms)
        for (const key of slugs) {
          try {
            await api.put(`/roles/${newRoleId}/permissions`, {
              key,
              enabled: true,
            })
          } catch (err) {
            console.error('Error assigning permission to new role', key, err)
          }
        }
      }

      navigate('/roles')
    } catch (err: any) {
      console.error('Error creating role', err)
      if (err.response?.data?.message) {
        setError(err.response.data.message)
      } else {
        setError('Failed to create role')
      }
    }
  }

  // Compute categories and filtered/grouped permissions
  const withCategory = useMemo(() => {
    return perms.map((p) => {
      const [module] = (p.key || '').split('.')
      return {
        ...p,
        module: (module || 'other').toLowerCase(),
      }
    })
  }, [perms])

  const categoryOptions = useMemo(() => {
    const modules = new Set<string>()
    withCategory.forEach((p) => {
      if ((p as any).module) modules.add((p as any).module as string)
    })
    return ['ALL', ...Array.from(modules).sort()]
  }, [withCategory])

  const filtered = useMemo(() => {
    return withCategory.filter((p) => {
      const mod = (p as any).module as string
      if (categoryFilter !== 'ALL' && mod !== categoryFilter) return false
      if (!permSearch.trim()) return true
      const q = permSearch.trim().toLowerCase()
      return (
        ((p.name || '').toLowerCase().includes(q)) ||
        p.key.toLowerCase().includes(q)
      )
    })
  }, [withCategory, categoryFilter, permSearch])

  const grouped = useMemo(() => {
    const groups: Record<string, Permission[]> = {}
    filtered.forEach((p) => {
      const mod = (p as any).module as string
      if (!groups[mod]) groups[mod] = []
      groups[mod].push(p)
    })
    return groups
  }, [filtered])

  const togglePerm = (slug: string) => {
    if (!canManagePermissions) return
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const addAllInCategory = (category: string) => {
    if (!canManagePermissions) return
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      const groupPerms = grouped[category] || []
      groupPerms.forEach((p) => next.add(p.key))
      return next
    })
  }

  const removeAllInCategory = (category: string) => {
    if (!canManagePermissions) return
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      withCategory
        .filter((p) => p.module === category)
        .forEach((p) => next.delete(p.key))
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => navigate('/roles')}
        >
          Back to Roles
        </button>

        <div className="text-right">
          <div className="text-xs text-gray-500">Create Role</div>
          <div className="text-lg font-semibold text-gray-800">New Role</div>
        </div>
      </div>

      <div className="card p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* NAME */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Role Name *</label>
              <input
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Admin, Employee"
                required
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Description</label>
              <input
                className="input mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description for this role"
              />
            </div>
          </div>

          {/* PERMISSIONS */}
          <div className="mt-6 space-y-3">
            <label className="text-sm text-gray-600">Permissions</label>

            {/* Toolbar (search + category) */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex-1 min-w-[220px] max-w-sm">
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Search permissions..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="input text-sm min-w-[160px]"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'ALL'
                        ? 'All Categories'
                        : opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Permission groups (mirroring EditRole cards) */}
            <div className="space-y-4 mt-2">
              {Object.entries(grouped).map(([mod, groupPerms]) => {
                const total = groupPerms.length
                const assigned = groupPerms.filter((p) => selectedPerms.has(p.key)).length

                const label = mod.charAt(0).toUpperCase() + mod.slice(1)

                return (
                  <div key={mod} className="border rounded-xl bg-white">
                    <div className="px-4 py-3 flex items-center justify-between border-b bg-gray-50">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{label}</div>
                        <div className="text-xs text-gray-500">
                          {assigned} / {total} selected
                        </div>
                      </div>

                      {canManagePermissions && (
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-md border border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                            onClick={() => addAllInCategory(mod)}
                          >
                            + Add All
                          </button>
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                            onClick={() => removeAllInCategory(mod)}
                          >
                            - Remove All
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {groupPerms.map((p) => {
                        const checked = selectedPerms.has(p.key)

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
                              if (!canManagePermissions) return
                              togglePerm(p.key)
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

            {!canManagePermissions && (
              <div className="text-xs text-gray-500 mt-2">
                You don't have permission to manage permissions. Viewing read-only.
              </div>
            )}
          </div>

          {/* ACTIONS */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/roles')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!name.trim()}
            >
              Create Role
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
