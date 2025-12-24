import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { canCreate, canUpdate, canDelete } from "../utils/permissions";
import { useConfirm } from "../context/ConfirmContext";
import { Shield, Plus, Pencil, Trash2, KeyRound, Users, Award, Lock } from "lucide-react";
import DataTable, { Column } from "../components/common/DataTable";
import SummaryCards, { SummaryCard } from "../components/common/SummaryCards";
import SearchAndFilterBar from "../components/common/SearchAndFilterBar";
import TableActions, { ActionButton } from "../components/common/TableActions";
import StatusBadge from "../components/common/StatusBadge";
import { useTableSort, useTablePagination } from "../hooks/useTableFeatures";

// ---------------------- TYPES ----------------------

interface RolePermission {
  permissionId: number;
  permission?: { key: string };
}

interface Role {
  id: number;
  name: string;
  RolePermission?: RolePermission[];
  createdAt?: string | Date;
  isActive?: boolean;
  isArchived?: boolean;
  description?: string;
}

interface Permission {
  id: number;
  key: string;
}

interface UserSummary {
  id: number;
  roleId: number;
}

// ---------------------- COMPONENT ----------------------

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [search, setSearch] = useState("");

  const { user } = useAuth();
  const confirmModal = useConfirm();
  const navigate = useNavigate();

  const canManagePermissions =
    Array.isArray(user?.permissions) &&
    user.permissions.includes("permission.permission");

  // ---------------------- LOAD ROLES & PERMS ----------------------

  const fetchAll = async () => {
    try {
      const [r, p, u] = await Promise.all([
        api.get<Role[]>("/roles"),
        api.get<Permission[]>("/permissions"),
        api.get<UserSummary[]>("/users"),
      ]);

      const rolesData = Array.isArray(r.data)
        ? r.data.map((role: any) => ({
          ...role,
          // Normalize backend field name `rolePermissions` -> `RolePermission`
          RolePermission: Array.isArray(role.rolePermissions)
            ? role.rolePermissions.map((rp: any) => ({
              permissionId: rp.permissionId,
              permission: rp.permission
                ? { key: rp.permission.key as string }
                : undefined,
            }))
            : role.RolePermission ?? [],
        }))
        : [];
      const permsData = Array.isArray(p.data) ? p.data : [];
      const usersData = Array.isArray(u.data) ? u.data : u.data?.items || [];

      setRoles(rolesData);
      setPerms(permsData);
      setUsers(usersData);
    } catch (err) {
      console.error("Error fetching roles or permissions", err);
      setRoles([]);
      setPerms([]);
      setUsers([]);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Filter by search
  const filtered = useMemo(() => {
    return search.trim()
      ? roles.filter((r) =>
        r.name.toLowerCase().includes(search.trim().toLowerCase())
      )
      : roles;
  }, [roles, search]);

  // Apply sorting
  const { sortColumn, sortDirection, handleSort, sortedData } = useTableSort(filtered);

  // Pagination
  const { currentPage, pageSize, paginatedData, setPage, setPageSize } = useTablePagination(sortedData, 10);

  // Summary cards
  const summaryCards: SummaryCard[] = useMemo(() => {
    const totalRoles = roles.length;
    const totalUsers = users.length;
    const avgPermsPerRole = roles.length > 0
      ? Math.round(roles.reduce((sum, r) => sum + (r.RolePermission?.length || 0), 0) / roles.length)
      : 0;

    return [
      {
        title: 'Total Roles',
        value: totalRoles,
        icon: Shield,
        color: 'blue'
      },
      {
        title: 'Total Users',
        value: totalUsers,
        icon: Users,
        color: 'green',
        subtitle: 'Assigned to roles'
      },
      {
        title: 'Avg Permissions',
        value: avgPermsPerRole,
        icon: Award,
        color: 'purple',
        subtitle: 'Per role'
      },
      {
        title: 'Total Permissions',
        value: perms.length,
        icon: Lock,
        color: 'orange'
      }
    ];
  }, [roles, users, perms]);

  // ---------------------- DELETE ROLE ----------------------

  const remove = async (id: number) => {
    const ok = await confirmModal({
      title: "Delete role?",
      description: "This action cannot be undone.",
    });

    if (!ok) return;

    try {
      await api.delete(`/roles/${id}`);
      fetchAll();
    } catch (err) {
      console.error("Error deleting role", err);
    }
  };

  // Define table columns
  const columns: Column<Role>[] = [
    {
      key: 'name',
      label: 'Role Name',
      sortable: true,
      align: 'left',
      render: (row: Role) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{row.name}</span>
          <span className="text-xs text-gray-500 mt-0.5">
            {row.description || "No description"}
          </span>
        </div>
      )
    },
    {
      key: 'permissions',
      label: 'Permissions',
      sortable: false,
      align: 'center',
      render: (row: Role) => {
        const permissionCount = Array.isArray(row.RolePermission) ? row.RolePermission.length : 0;
        return (
          <StatusBadge
            label={`${permissionCount} permissions`}
            variant="info"
            size="sm"
          />
        );
      }
    },
    {
      key: 'users',
      label: 'Users',
      sortable: false,
      align: 'center',
      render: (row: Role) => {
        const userCount = users.filter((u) => u.roleId === row.id).length;
        return (
          <StatusBadge
            label={`${userCount} users`}
            variant="gray"
            size="sm"
          />
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      align: 'center',
      render: (row: Role) => {
        const isActive = (() => {
          if (typeof row.isActive === "boolean") return row.isActive;
          if (typeof row.isArchived === "boolean") return !row.isArchived;
          return true;
        })();

        return (
          <StatusBadge
            label={isActive ? "Active" : "Inactive"}
            variant={isActive ? "success" : "error"}
            size="sm"
          />
        );
      }
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      align: 'left',
      render: (row: Role) => {
        const createdAtLabel = row.createdAt
          ? new Date(row.createdAt).toLocaleDateString()
          : "-";
        return <span className="text-xs text-gray-600">{createdAtLabel}</span>;
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row: Role) => {
        const actions: ActionButton[] = [
          {
            label: 'Edit Role',
            icon: Pencil,
            onClick: () => navigate(`/roles/${row.id}/edit`),
            color: 'blue',
            show: canUpdate("role")
          },
          {
            label: 'Manage Permissions',
            icon: KeyRound,
            onClick: () => navigate(`/roles/${row.id}/permissions`),
            color: 'purple',
            show: canUpdate("role")
          },
          {
            label: 'View Users',
            icon: Users,
            onClick: () => navigate("/users"),
            color: 'gray',
            show: true
          },
          {
            label: 'Delete',
            icon: Trash2,
            onClick: () => remove(row.id),
            color: 'red',
            show: canDelete("role")
          }
        ];
        return <TableActions actions={actions} />;
      }
    }
  ];

  // ---------------------- RENDER ----------------------

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-lg">
            <Shield size={24} strokeWidth={1.8} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Roles Management</h1>
            <p className="text-sm text-gray-500">Manage who can access which parts of the system</p>
          </div>
        </div>
        {canCreate("role") && (
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => navigate("/roles/new")}
          >
            <Plus size={18} strokeWidth={1.8} />
            Add Role
          </button>
        )}
      </div>

      {/* Search Bar */}
      <SearchAndFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search roles by name..."
      />

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={paginatedData}
        currentPage={currentPage}
        totalPages={Math.max(1, Math.ceil(sortedData.length / pageSize))}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyMessage="No roles found"
      />
    </div>
  );
}