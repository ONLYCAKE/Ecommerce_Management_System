import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { canCreate, canUpdate, canDelete } from "../utils/permissions";
import { useConfirm } from "../context/ConfirmContext";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [errors, setErrors] = useState({});
  const { user } = useAuth();
  const confirmModal = useConfirm();
  const [toast, setToast] = useState(null);

  // ✅ Fetch Suppliers
  const fetchAll = async () => {
    try {
      const { data } = await api.get("/suppliers");
      setItems(data || []);
    } catch (err) {
      console.error("❌ Error loading suppliers", err);
      setItems([]);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // ✅ Client-side search filter identical to Users.jsx
  useEffect(() => {
    const f = (items || []).filter((s) =>
      [s.name, s.email, s.phone, s.address]
        .join(' ')
        .toLowerCase()
        .includes(q.toLowerCase())
    );
    setFiltered(f);
    setPage(1);
  }, [q, items]);

  // ✅ Form Open / Edit
  const open = (item = null) => {
    setEditing(item);
    setErrors({});
    setForm(
      item
        ? {
            name: item.name,
            email: item.email,
            phone: item.phone || "",
            address: item.address || "",
          }
        : { name: "", email: "", phone: "", address: "" }
    );
    setShowForm(true);
  };

  // ✅ Form Validation
  const validate = () => {
    const errs = {};

    if (!form.name.trim()) errs.name = "Name is required";

    // ✅ Email validation: must be lowercase and @gmail.com
    if (!form.email) {
      errs.email = "Email is required";
    } else if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(form.email)) {
      errs.email = "Email must be valid and end with @gmail.com (lowercase only)";
    }

    // ✅ Phone validation: must be 10 digits
    if (!form.phone) {
      errs.phone = "Phone number is required";
    } else if (!/^\d{10}$/.test(form.phone)) {
      errs.phone = "Phone must be a 10-digit number";
    }

    if (!form.address.trim()) errs.address = "Address is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ✅ Save Supplier (Add/Edit)
  const save = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (editing) await api.put(`/suppliers/${editing.id}`, form);
      else await api.post("/suppliers", form);
      setShowForm(false);
      fetchAll();
    } catch (err) {
      console.error("❌ Save failed", err);
    }
  };

  // ✅ Delete Supplier
  const remove = async (id) => {
    const ok = await confirmModal({
      title: "Delete supplier?",
      description: "This action cannot be undone.",
    });
    if (!ok) return;
    try {
      await api.delete(`/suppliers/${id}`);
      setToast('✅ Supplier deleted');
      setTimeout(() => setToast(null), 1800);
      fetchAll();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Delete failed';
      setToast(`⚠️ ${msg}`);
      setTimeout(() => setToast(null), 2500);
      console.error("❌ Delete failed", err);
    }
  };

  // ✅ Pagination logic (identical to Users.jsx)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const currentPageData = filtered.slice(start, start + pageSize);

  return (
    <div className="space-y-4">
      {/* ✅ Header */}
      <div className="flex justify-between items-center">
        <input
          className="input max-w-xs"
          placeholder="Search suppliers..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Rows</label>
          <select
            className="input w-20"
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

          {canCreate('supplier') && (
            <button className="btn-primary" onClick={() => open()}>
              Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* ✅ Table */}
      <div className="card p-4">
        <table className="table text-center">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentPageData.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="font-medium">{s.name}</td>
                <td>{s.email}</td>
                <td>{s.phone}</td>
                <td className="text-sm text-gray-600">{s.address}</td>
                <td className="text-center space-x-2">
                  {canUpdate('supplier') && (
                    <button className="btn-secondary" onClick={() => open(s)}>
                      Edit
                    </button>
                  )}
                  {canDelete('supplier') && (
                    <button
                      className="btn-danger bg-red-600 text-white hover:bg-red-700"
                      onClick={() => remove(s.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ✅ No Data Message */}
        {currentPageData.length === 0 && (
          <div className="text-sm text-gray-500 py-6 text-center">
            No suppliers found.
          </div>
        )}

        {/* ✅ Pagination */}
        {filtered.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={18} />
              </button>

              <button
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-40 transition"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ Add/Edit Supplier Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              {editing ? "Edit Supplier" : "Add Supplier"}
            </h3>

            <form onSubmit={save} className="space-y-3">
              {/* Name */}
              <div>
                <label className="text-sm text-gray-700">Name</label>
                <input
                  className={`input mt-1 ${
                    errors.name ? "border-red-500" : ""
                  }`}
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                {errors.name && (
                  <div className="text-red-500 text-xs mt-1">
                    {errors.name}
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm text-gray-700">Email</label>
                <input
                  className={`input mt-1 ${
                    errors.email ? "border-red-500" : ""
                  }`}
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
                {errors.email && (
                  <div className="text-red-500 text-xs mt-1">
                    {errors.email}
                  </div>
                )}
              </div>

              {/* Phone & Address */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Phone</label>
                  <input
                    className={`input mt-1 ${
                      errors.phone ? "border-red-500" : ""
                    }`}
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                  {errors.phone && (
                    <div className="text-red-500 text-xs mt-1">
                      {errors.phone}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-700">Address</label>
                  <input
                    className={`input mt-1 ${
                      errors.address ? "border-red-500" : ""
                    }`}
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                  />
                  {errors.address && (
                    <div className="text-red-500 text-xs mt-1">
                      {errors.address}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editing ? "Update Supplier" : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-black text-white px-4 py-2 rounded-lg shadow-md">
          {toast}
        </div>
      )}
    </div>
  );
}
