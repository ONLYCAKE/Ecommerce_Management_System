import { useEffect, useState, FormEvent, useMemo } from "react";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { canCreate, canUpdate, canDelete, canRead } from "../utils/permissions";
import { useConfirm } from "../context/ConfirmContext";
import { Pencil, Trash2, Archive, RotateCcw, Save, ArrowLeft, FileText, Phone, Home, AlertTriangle, Plus, Truck, MapPin, TrendingUp, Package } from "lucide-react";
import CountryStateCitySelect from '../components/common/CountryStateCitySelect';
import DataTable, { Column } from '../components/common/DataTable';
import SummaryCards, { SummaryCard } from '../components/common/SummaryCards';
import SearchAndFilterBar, { FilterCheckbox } from '../components/common/SearchAndFilterBar';
import TableActions, { ActionButton } from '../components/common/TableActions';
import { useTableSort } from '../hooks/useTableFeatures';
import { useUrlPagination } from '../hooks/useUrlPagination';

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  createdAt?: string;
  isArchived?: boolean;
}

export default function Suppliers() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [archived, setArchived] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    area: "",
    city: "",
    state: "",
    country: "",
    postalCode: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const confirmModal = useConfirm();

  if (!canRead("supplier")) {
    return (
      <div className="p-6 text-center text-gray-500">
        You do not have permission to view suppliers.
      </div>
    );
  }

  const fetchAll = async () => {
    try {
      const { data } = await api.get("/suppliers", { params: { archived } });
      setItems(Array.isArray(data) ? data : (data?.items || []));
    } catch (err) {
      console.error("Error loading suppliers", err);
      setItems([]);
    }
  };

  useEffect(() => { fetchAll(); }, [archived]);

  // Filter by search
  const filtered = useMemo(() => {
    return (items || []).filter((s) =>
      [s.name, s.email, s.phone, s.address, (s as any).city, (s as any).state]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase())
    );
  }, [q, items]);

  // Apply sorting
  const { sortColumn, sortDirection, handleSort, sortedData } = useTableSort(filtered);

  // Pagination - URL-based
  const { page, pageSize, setPage, setPageSize } = useUrlPagination(1, 10);

  // Calculate pagination manually
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const start = (page - 1) * pageSize;
  const paginatedData = sortedData.slice(start, start + pageSize);
  const currentPage = page;

  // Summary cards
  const summaryCards: SummaryCard[] = useMemo(() => {
    const totalSuppliers = items.length;
    const activeSuppliers = items.filter(s => !(s as any).isArchived).length;

    return [
      {
        title: 'Total Suppliers',
        value: totalSuppliers,
        icon: Truck,
        color: 'green'
      },
      {
        title: 'Active Suppliers',
        value: activeSuppliers,
        icon: TrendingUp,
        color: 'blue'
      }
    ];
  }, [items]);

  const open = (supplier: Supplier | null = null) => {
    setEditing(supplier);
    setErrors({});
    setForm(
      supplier
        ? {
          name: supplier.name,
          email: supplier.email,
          phone: supplier.phone || "",
          addressLine1: (supplier as any).addressLine1 || "",
          addressLine2: (supplier as any).addressLine2 || "",
          area: (supplier as any).area || "",
          city: (supplier as any).city || "",
          state: (supplier as any).state || "",
          country: (supplier as any).country || "",
          postalCode: (supplier as any).postalCode || ""
        }
        : { name: "", email: "", phone: "", addressLine1: "", addressLine2: "", area: "", city: "", state: "", country: "", postalCode: "" }
    );
    setShowForm(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email) errs.email = "Email is required";
    else if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(form.email))
      errs.email = "Email must end with @gmail.com";
    if (!form.phone) errs.phone = "Phone number is required";
    else if (!/^\d{10}$/.test(form.phone))
      errs.phone = "Phone must be 10 digits";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      if (editing) {
        if (!canUpdate("supplier")) return;
        await api.put(`/suppliers/${editing.id}`, form);
      } else {
        if (!canCreate("supplier")) return;
        await api.post(`/suppliers`, form);
      }
      setShowForm(false);
      fetchAll();
    } catch (err) {
      console.error("❌ Save failed", err);
    }
  };

  const archiveSupplier = async (id: number) => {
    if (!canDelete("supplier")) return;
    const ok = await confirmModal({
      title: "Archive supplier?",
      description: "This will archive the supplier. You can restore it later from the archived view.",
    });
    if (!ok) return;
    try {
      await api.delete(`/suppliers/${id}`);
      setToast("✅ Supplier archived");
      setTimeout(() => setToast(null), 1800);
      fetchAll();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Archive failed";
      setToast(`⚠️ ${msg}`);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const deleteSupplier = async (id: number) => {
    if (!canDelete("supplier")) return;
    const ok = await confirmModal({
      title: "Permanently delete supplier?",
      description: "This action cannot be undone. The supplier will be permanently removed from the database.",
    });
    if (!ok) return;
    try {
      await api.delete(`/suppliers/${id}/permanent`);
      setToast("✅ Supplier deleted");
      setTimeout(() => setToast(null), 1800);
      fetchAll();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Delete failed";
      setToast(`⚠️ ${msg}`);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const restoreSupplier = async (id: number) => {
    if (!canUpdate("supplier")) return;
    const ok = await confirmModal({
      title: "Restore supplier?",
      description: "This will unarchive the supplier and make them active again.",
    });
    if (!ok) return;
    try {
      await api.patch(`/suppliers/${id}/restore`, {});
      setToast("✅ Supplier restored");
      setTimeout(() => setToast(null), 1800);
      fetchAll();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Restore failed";
      setToast(`⚠️ ${msg}`);
      setTimeout(() => setToast(null), 2500);
    }
  };

  // Define table columns
  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      align: 'left',
      render: (row: Supplier) => (
        <span className="font-semibold text-gray-900">{row.name}</span>
      )
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      align: 'left',
      render: (row: Supplier) => (
        <span className="text-gray-600">{row.email}</span>
      )
    },
    {
      key: 'phone',
      label: 'Contact',
      sortable: false,
      align: 'left',
      render: (row: Supplier) => (
        <span className="font-medium text-gray-700">{row.phone}</span>
      )
    },
    {
      key: 'location',
      label: 'Location',
      sortable: false,
      align: 'left',
      render: (row: Supplier) => {
        const city = (row as any).city || '';
        const state = (row as any).state || '';
        const location = [city, state].filter(Boolean).join(', ') || '-';

        // Full address for tooltip
        const fullAddress = [
          (row as any).addressLine1,
          (row as any).addressLine2,
          (row as any).area,
          city,
          state,
          (row as any).postalCode,
          (row as any).country
        ].filter(Boolean).join(', ');

        return (
          <span className="text-gray-600 text-sm" title={fullAddress || row.address}>
            {location}
          </span>
        );
      }
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      align: 'left',
      render: (row: Supplier) => (
        <span className="text-xs text-gray-500">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-GB') : '-'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row: Supplier) => {
        const actions: ActionButton[] = [
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => open(row),
            color: 'blue',
            show: canUpdate("supplier") && !archived
          },
          {
            label: 'Delete',
            icon: Trash2,
            onClick: () => deleteSupplier(row.id),
            color: 'red',
            show: canDelete("supplier") && !archived
          },
          {
            label: 'Archive',
            icon: Archive,
            onClick: () => archiveSupplier(row.id),
            color: 'orange',
            show: canDelete("supplier") && !archived
          },
          {
            label: 'Restore',
            icon: RotateCcw,
            onClick: () => restoreSupplier(row.id),
            color: 'green',
            show: canUpdate("supplier") && archived
          }
        ];
        return <TableActions actions={actions} />;
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Search and Filter Bar */}
      <SearchAndFilterBar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search suppliers by name, email, phone, or location..."
        filters={
          <FilterCheckbox
            label={archived ? 'Showing Archived' : 'Show Archived'}
            checked={archived}
            onChange={setArchived}
            icon={archived && <Archive size={16} strokeWidth={1.8} />}
          />
        }
        actions={
          canCreate("supplier") && (
            <button className="btn-primary flex items-center gap-2" onClick={() => open(null)}>
              <Plus size={18} strokeWidth={1.8} />
              Add Supplier
            </button>
          )
        }
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
        emptyMessage={archived ? "No archived suppliers found" : "No suppliers found"}
      />

      {/* Modal Form - Keep Existing */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-6 rounded-t-xl">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                {editing ? (
                  <>
                    <Pencil size={20} strokeWidth={1.8} />
                    Edit Supplier
                  </>
                ) : (
                  <>
                    <Plus size={20} strokeWidth={1.8} />
                    Add New Supplier
                  </>
                )}
              </h3>
              <p className="text-green-100 text-sm mt-1">
                {editing ? 'Update supplier information' : 'Fill in the details to create a new supplier'}
              </p>
            </div>

            <form onSubmit={save} className="p-8">
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-500 flex items-center gap-2">
                    <FileText size={18} strokeWidth={1.8} />
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={`input ${errors.name ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200'} transition-all`}
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Enter supplier name"
                      />
                      {errors.name && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle size={14} strokeWidth={1.8} />
                          {errors.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
                    <Phone size={18} strokeWidth={1.8} />
                    Contact Information
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        className={`input ${errors.email ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200'} transition-all`}
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="supplier@example.com"
                      />
                      {errors.email && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle size={14} strokeWidth={1.8} />
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        className={`input ${errors.phone ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200'} transition-all`}
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="+91 98765 43210"
                      />
                      {errors.phone && (
                        <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                          <AlertTriangle size={14} strokeWidth={1.8} />
                          {errors.phone}
                        </p>
                      )}
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
                          className="input border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                          value={form.addressLine1}
                          onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
                          placeholder="Street address"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address Line 2 <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input
                          className="input border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                          value={form.addressLine2}
                          onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))}
                          placeholder="Apartment, suite, etc."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Area/Locality
                        </label>
                        <input
                          className="input border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                          value={form.area}
                          onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                          placeholder="Area or locality"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Postal Code
                        </label>
                        <input
                          className="input border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all"
                          value={form.postalCode}
                          onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                          placeholder="123456"
                        />
                      </div>
                    </div>

                    {/* Country, State, City Dropdowns */}
                    <CountryStateCitySelect
                      country={form.country}
                      state={form.state}
                      city={form.city}
                      onCountryChange={(value) => setForm((f) => ({ ...f, country: value }))}
                      onStateChange={(value) => setForm((f) => ({ ...f, state: value }))}
                      onCityChange={(value) => setForm((f) => ({ ...f, city: value }))}
                      errors={{
                        country: errors.country,
                        state: errors.state,
                        city: errors.city
                      }}
                    />
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
                    <ArrowLeft size={18} strokeWidth={1.8} className="mr-1" />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                  >
                    <Save size={18} strokeWidth={1.8} className="mr-1" />
                    {editing ? 'Update Supplier' : 'Save Supplier'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-black text-white px-4 py-2 rounded-lg shadow-md">
          {toast}
        </div>
      )}
    </div>
  );
}