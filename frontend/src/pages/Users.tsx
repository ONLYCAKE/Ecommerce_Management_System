import { useEffect, useState, FormEvent, useMemo } from 'react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { canCreate, canUpdate, canDelete } from '../utils/permissions'
import { useConfirm } from '../context/ConfirmContext'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, Pencil, Trash2, Archive, RotateCcw, Save, ArrowLeft, AlertTriangle, FileText, Home, UserPlus, UserCog, Shield, Users as UsersIcon, UserCheck, Crown } from 'lucide-react'
import UserPermissionManagementModal from '../components/role/UserPermissionManagementModal'
import DataTable, { Column } from '../components/common/DataTable'
import SummaryCards, { SummaryCard } from '../components/common/SummaryCards'
import SearchAndFilterBar, { FilterCheckbox } from '../components/common/SearchAndFilterBar'
import TableActions, { ActionButton } from '../components/common/TableActions'
import { RoleBadge, ArchivedBadge } from '../components/common/StatusBadge'
import { useTableSort } from '../hooks/useTableFeatures'

interface Role { id: number; name: string }
interface UserForm {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roleId: number | null;
  addressLine1: string;
  addressLine2: string;
  area: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export default function Users() {
  const [items, setItems] = useState<any[]>([])
  const [q, setQ] = useState<string>('')
  const [archived, setArchived] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [roles, setRoles] = useState<Role[]>([])
  const [showForm, setShowForm] = useState<boolean>(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [showPermissionsModal, setShowPermissionsModal] = useState<boolean>(false)
  const [form, setForm] = useState<UserForm>({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    roleId: null,
    addressLine1: '',
    addressLine2: '',
    area: '',
    city: '',
    state: '',
    country: '',
    postalCode: ''
  })
  const { user } = useAuth()
  const confirmModal = useConfirm()

  const fetchData = async () => {
    try {
      const { data } = await api.get('/users', { params: { archived } })
      setItems(data.items || [])
    } catch (err) {
      console.error('Error loading users', err)
      setItems([])
    }
  }

  useEffect(() => { fetchData() }, [archived])

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/roles')
        setRoles(data)
      } catch (err) {
        console.error('Error loading roles', err)
      }
    })()
  }, [])

  // Filter data by search query
  const filtered = useMemo(() => {
    return items.filter((u: any) =>
      [u.email, u.firstName, u.lastName, u.role?.name].join(' ').toLowerCase().includes(q.toLowerCase())
    )
  }, [q, items])

  // Apply sorting
  const { sortColumn, sortDirection, handleSort, sortedData } = useTableSort(filtered)

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const start = (page - 1) * pageSize
  const currentPageData = sortedData.slice(start, start + pageSize)

  // Summary cards data
  const summaryCards: SummaryCard[] = useMemo(() => {
    const totalUsers = items.length
    const activeUsers = items.filter(u => !u.isArchived).length
    const adminCount = items.filter(u => u.role?.name === 'SuperAdmin' || u.role?.name === 'Admin').length
    const employeeCount = items.filter(u => u.role?.name === 'Employee').length

    return [
      {
        title: 'Total Users',
        value: totalUsers,
        icon: UsersIcon,
        color: 'blue',
        subtitle: `${activeUsers} active`
      },
      {
        title: 'Active Users',
        value: activeUsers,
        icon: UserCheck,
        color: 'green'
      },
      {
        title: 'Admins',
        value: adminCount,
        icon: Crown,
        color: 'purple',
        subtitle: 'SuperAdmin & Admin'
      },
      {
        title: 'Employees',
        value: employeeCount,
        icon: UsersIcon,
        color: 'orange'
      }
    ]
  }, [items])

  const openCreate = () => {
    const def = roles.find((r) => r.name === 'Employee') || roles[0]
    setEditing(null)
    setForm({
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      roleId: def?.id || null,
      addressLine1: '',
      addressLine2: '',
      area: '',
      city: '',
      state: '',
      country: '',
      postalCode: ''
    })
    setShowForm(true)
  }

  const openEdit = (u: any) => {
    setEditing(u)
    setForm({
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      password: '',
      roleId: u.roleId || u.role?.id,
      addressLine1: u.addressLine1 || '',
      addressLine2: u.addressLine2 || '',
      area: u.area || '',
      city: u.city || '',
      state: u.state || '',
      country: u.country || '',
      postalCode: u.postalCode || ''
    })
    setShowForm(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await api.put(`/users/${editing.id}` as string, form as any)
      } else {
        await api.post('/users', form as any)
      }
      setShowForm(false)
      fetchData()
    } catch (err) {
      console.error('Save failed', err)
    }
  }

  const archive = async (id: number) => {
    const ok = await confirmModal({ title: 'Archive user?', description: 'This will archive the user.' })
    if (!ok) return
    await api.delete(`/users/${id}`)
    fetchData()
  }

  const restoreUser = async (id: number) => {
    const ok = await confirmModal({ title: 'Restore user?', description: 'This will unarchive the user and make them active again.' })
    if (!ok) return
    await api.patch(`/users/${id}/restore`, {})
    fetchData()
  }

  const deleteUser = async (id: number) => {
    const ok = await confirmModal({ title: 'Delete user permanently?', description: 'This will permanently delete the user. This action cannot be undone.' })
    if (!ok) return
    try {
      await api.delete(`/users/${id}`)
      fetchData()
    } catch (err) {
      console.error('Delete failed', err)
    }
  }

  // Define table columns
  const columns: Column[] = [
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      align: 'left',
      render: (row: any) => (
        <span className="font-medium text-gray-900">{row.email}</span>
      )
    },
    {
      key: 'firstName',
      label: 'Name',
      sortable: true,
      align: 'left',
      render: (row: any) => (
        <span className="font-medium text-gray-900">
          {row.firstName} {row.lastName}
        </span>
      )
    },
    {
      key: 'role.name',
      label: 'Role',
      sortable: true,
      align: 'center',
      render: (row: any) => <RoleBadge role={row.role?.name || 'N/A'} />
    },
    {
      key: 'isArchived',
      label: 'Status',
      sortable: true,
      align: 'center',
      render: (row: any) => <ArchivedBadge isArchived={row.isArchived} />
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row: any) => {
        const actions: ActionButton[] = [
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => openEdit(row),
            color: 'blue',
            show: canUpdate('user') && !row.isArchived
          },
          {
            label: 'Archive',
            icon: Archive,
            onClick: () => archive(row.id),
            color: 'orange',
            show: canUpdate('user') && !row.isArchived
          },
          {
            label: 'Delete',
            icon: Trash2,
            onClick: () => deleteUser(row.id),
            color: 'red',
            show: canDelete('user') && !row.isArchived
          },
          {
            label: 'Restore',
            icon: RotateCcw,
            onClick: () => restoreUser(row.id),
            color: 'green',
            show: canUpdate('user') && row.isArchived
          }
        ]
        return <TableActions actions={actions} />
      }
    }
  ]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Search and Filter Bar */}
      <SearchAndFilterBar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search by email, name, or role..."
        filters={
          <FilterCheckbox
            label={archived ? 'Showing Archived' : 'Show Archived'}
            checked={archived}
            onChange={setArchived}
            icon={archived && <Archive size={16} strokeWidth={1.8} />}
          />
        }
        actions={
          canCreate('user') && (
            <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
              <UserPlus size={18} strokeWidth={1.8} />
              Add User
            </button>
          )
        }
      />

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={currentPageData}
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyMessage={archived ? "No archived users found" : "No users found"}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    {editing ? (
                      <>
                        <UserCog size={20} strokeWidth={1.8} />
                        Edit User
                      </>
                    ) : (
                      <>
                        <UserPlus size={20} strokeWidth={1.8} />
                        Add New User
                      </>
                    )}
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {editing ? 'Update user information' : 'Fill in the details to create a new user'}
                  </p>
                </div>
                {editing && user?.role === 'SuperAdmin' && form.roleId && (
                  <button
                    type="button"
                    onClick={() => setShowPermissionsModal(true)}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white font-medium transition-all flex items-center gap-2 border border-white/30"
                  >
                    <Shield size={18} />
                    Manage Permissions
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={save} className="p-8">
              {/* Basic Information Section */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
                    <FileText size={18} strokeWidth={1.8} />
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>

                    {!editing && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          type="password"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          required
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.firstName}
                          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.lastName}
                          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                        value={form.roleId ?? ''}
                        onChange={(e) => setForm({ ...form, roleId: parseInt(e.target.value) })}
                        required
                      >
                        <option value="">Select Role</option>
                        {roles.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Address Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-purple-500 flex items-center gap-2">
                    <Home size={18} strokeWidth={1.8} />
                    Address Details
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address Line 1
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.addressLine1}
                          onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                          placeholder="Street address"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address Line 2 <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.addressLine2}
                          onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                          placeholder="Apartment, suite, etc."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Area
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.area}
                          onChange={(e) => setForm({ ...form, area: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          City
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          State
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.state}
                          onChange={(e) => setForm({ ...form, state: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Country
                        </label>
                        <input
                          className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                          value={form.country}
                          onChange={(e) => setForm({ ...form, country: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Postal Code
                      </label>
                      <input
                        className="input w-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                        value={form.postalCode}
                        onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t-2 border-gray-200 mt-8">
                <p className="text-sm text-gray-500 italic">
                  <span className="text-red-500">*</span> Required fields
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 flex items-center gap-2"
                    onClick={() => setShowForm(false)}
                  >
                    <ArrowLeft size={18} strokeWidth={1.8} />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                  >
                    <Save size={18} strokeWidth={1.8} />
                    {editing ? 'Update User' : 'Save User'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Management Modal */}
      {showPermissionsModal && editing && form.roleId && (
        <UserPermissionManagementModal
          user={{
            id: editing.id,
            email: form.email,
            firstName: form.firstName,
            lastName: form.lastName,
            roleId: form.roleId
          }}
          roleName={roles.find(r => r.id === form.roleId)?.name || ''}
          onClose={() => setShowPermissionsModal(false)}
        />
      )}
    </div>
  )
}
