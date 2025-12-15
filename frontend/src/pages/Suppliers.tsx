import { useEffect, useState, FormEvent, useMemo } from "react";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { canCreate, canUpdate, canDelete, canRead } from "../utils/permissions";
import { useConfirm } from "../context/ConfirmContext";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import CountryStateCitySelect from '../components/common/CountryStateCitySelect';

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export default function Suppliers() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  /* ------------------------------------------------------------
     READ PERMISSION PROTECTION
  ------------------------------------------------------------ */
  if (!canRead("supplier")) {
    return (
      <div className="p-6 text-center text-gray-500">
        You do not have permission to view suppliers.
      </div>
    );
  }

  /* ------------------------------------------------------------
     Load All Suppliers
  ------------------------------------------------------------ */
  const fetchAll = async () => {
    try {
      const { data } = await api.get("/suppliers", { params: { archived } });
      setItems(data);
    } catch (err) {
      console.error("Error loading suppliers", err);
      setItems([]);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [archived]);

  /* ------------------------------------------------------------
     Search + Filter
  ------------------------------------------------------------ */
  const filtered = useMemo(() => {
    return (items || []).filter((s) =>
      [s.name, s.email, s.phone, s.address]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase())
    );
  }, [q, items]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const currentPageData = filtered.slice(start, start + pageSize);

  /* ------------------------------------------------------------
     Open Form
  ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------
     Validation
  ------------------------------------------------------------ */
  const validate = () => {
    const errs: Record<string, string> = {};

    if (!form.name.trim()) errs.name = "Name is required";

    if (!form.email) errs.email = "Email is required";
    else if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(form.email))
      errs.email = "Email must end with @gmail.com";

    if (!form.phone) errs.phone = "Phone number is required";
    else if (!/^\d{10}$/.test(form.phone))
      errs.phone = "Phone must be 10 digits";

    // Address fields are optional

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ------------------------------------------------------------
     Save Supplier
  ------------------------------------------------------------ */
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

  /* ------------------------------------------------------------
     Archive/Delete/Restore Supplier
  ------------------------------------------------------------ */
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
      console.error("❌ Archive failed", err);
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
      console.error("❌ Delete failed", err);
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
      console.error("❌ Restore failed", err);
    }
  };

  /* ------------------------------------------------------------
     UI
  ------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              className="input pl-10 pr-4 py-2.5 w-80 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              placeholder="Search suppliers by name, email, or phone..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <svg className="absolute left-3 top-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Checkbox for Archived Suppliers */}
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-all">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700">
              {archived ? '📦 Showing Archived' : 'Show Archived'}
            </span>
          </label>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Rows per page:</label>
            <select
              className="input px-3 py-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[3, 5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {canCreate("supplier") && (
            <button
              className="btn-primary px-5 py-2.5 font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
              onClick={() => open(null)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-6 shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">No</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact No</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</th>
              <th className="pb-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created Date</th>
              <th className="pb-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {currentPageData.map((s, index) => {
              const fullAddress = [
                (s as any).addressLine1,
                (s as any).addressLine2,
                (s as any).area,
                (s as any).city,
                (s as any).state,
                (s as any).postalCode,
                (s as any).country
              ].filter(Boolean).join(', ')

              return (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 text-sm font-medium text-gray-500">
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  <td className="py-4">
                    <div className="text-sm font-semibold text-gray-900">{s.name}</div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm text-gray-600">{s.email}</div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm font-medium text-gray-700">{s.phone}</div>
                  </td>
                  <td className="py-4 max-w-xs">
                    <div className="text-sm text-gray-600 line-clamp-2">
                      {fullAddress || s.address || '-'}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="text-sm text-gray-500">
                      {(s as any).createdAt ? new Date((s as any).createdAt).toLocaleDateString('en-GB') : '09/12/2025'}
                    </div>
                  </td>

                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {!archived && canUpdate("supplier") && (
                        <button
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                          onClick={() => open(s)}
                        >
                          Edit
                        </button>
                      )}

                      {!archived && canDelete("supplier") && (
                        <button
                          className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                          onClick={() => deleteSupplier(s.id)}
                        >
                          Delete
                        </button>
                      )}

                      {!archived && canDelete("supplier") && (
                        <button
                          className="px-3 py-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-md transition-colors"
                          onClick={() => archiveSupplier(s.id)}
                        >
                          Archive
                        </button>
                      )}

                      {archived && canUpdate("supplier") && (
                        <button
                          className="px-3 py-1.5 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
                          onClick={() => restoreSupplier(s.id)}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

            {currentPageData.length === 0 && (
              <tr>
                <td className="text-center py-6 text-gray-500" colSpan={7}>
                  No suppliers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-6 rounded-t-xl">
              <h3 className="text-2xl font-bold">
                {editing ? '✏️ Edit Supplier' : '➕ Add New Supplier'}
              </h3>
              <p className="text-green-100 text-sm mt-1">
                {editing ? 'Update supplier information' : 'Fill in the details to create a new supplier'}
              </p>
            </div>

            <form onSubmit={save} className="p-8">
              {/* Sections */}
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-500 flex items-center gap-2">
                    <span>📋</span> Basic Information
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
                          <span>⚠️</span> {errors.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
                    <span>📞</span> Contact Information
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
                          <span>⚠️</span> {errors.email}
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
                          <span>⚠️</span> {errors.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Address Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-purple-500 flex items-center gap-2">
                    <span>🏠</span> Address Details
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
                    <span>✕</span> Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                  >
                    <span>💾</span> {editing ? 'Update Supplier' : 'Save Supplier'}
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