import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";

export default function EditRole() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [toast, setToast] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/roles/${id}`);
        setRole(data);
      } catch (err) {
        console.error("Error loading role or permissions", err);
      }
    })();
  }, [id]);

  const toggle = async (key, current) => {
    try {
      const { data } = await api.put(`/roles/${id}/permissions`, { key, enabled: !current });
      setRole((r) => ({ ...r, permissions: Object.fromEntries(data.map(k => [k, true])) }));
      setToast("✅ Permissions updated");
      setTimeout(() => setToast(null), 1200);
    } catch (err) {
      console.error("Error toggling permission", err);
    }
  };

  if (!role)
    return <div className="p-8 text-gray-600">Loading role data...</div>;

  // Modules and actions matrix
  const modules = [
    { label: "Users", base: "user" },
    { label: "Buyers", base: "buyer" },
    { label: "Products", base: "product" },
    { label: "Invoices", base: "invoice" },
  ];
  const actions = ["create", "update", "delete", "read"];

  const canEdit = (() => {
    if (user?.role === "SuperAdmin" && role.name !== "SuperAdmin") return true;
    if (user?.role === "Admin" && role.name === "Employee") return true;
    return false;
  })();

  return (
    <div className="p-8 min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded">
        SuperAdmin has all permissions and cannot be changed.
      </div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Edit Role: {role.name}</h1>
        <button className="btn-secondary" onClick={() => navigate("/roles")}>Back</button>
      </div>

      <div className="card p-6 rounded-2xl shadow-md">
        <table className="table-auto w-full text-sm text-center border-collapse">
          <thead>
            <tr className="bg-gray-200 text-gray-800 uppercase text-xs">
              <th className="py-3 text-left pl-4">Permission</th>
              <th className="text-green-700">Add</th>
              <th className="text-blue-700">Update</th>
              <th className="text-red-700">Delete</th>
              <th className="text-purple-700">Read</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.base} className="border-t hover:bg-gray-50">
                <td className="text-left font-medium pl-4">{m.label}</td>
                {actions.map((action) => {
                  const key = `${m.base}.${action}`;
                  const checked = !!role.permissions?.[key];
                  const disabled = !canEdit || (role.name === "SuperAdmin");
                  return (
                    <td key={action}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(key, checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 bg-green-600 text-white px-4 py-2 rounded-lg shadow-md">
          {toast}
        </div>
      )}
    </div>
  );
}
