import React, { createContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { io } from "socket.io-client";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ✅ Persist token in localStorage
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  // ✅ Persist user in localStorage
  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  // ✅ Check if token valid and fetch user
  useEffect(() => {
    const verifyUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch (err) {
        console.warn("Auth validation failed:", err?.response?.data || err);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setToken(null);
        setUser(null);
        navigate("/login", { replace: true });
      } finally {
        setLoading(false);
      }
    };
    verifyUser();
  }, [token, navigate]);

  // ✅ Manage socket connection
  useEffect(() => {
    if (!token) {
      if (socket) {
        try {
          socket.disconnect();
        } catch {}
      }
      setSocket(null);
      return;
    }

    const s = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      transports: ["websocket", "polling"],
      auth: { token },
    });

    s.on("connect", () => console.log("✅ Socket connected"));
    s.on("disconnect", () => console.log("🔌 Socket disconnected"));

    // 🔁 Live permission refresh
    s.on("permissions.updated", async (payload) => {
      if (user?.roleId && payload?.roleId === user.roleId) {
        try {
          const { data } = await api.get("/auth/me");
          setUser(data);
          console.log("🔄 Permissions refreshed for role:", payload.roleId);
        } catch (err) {
          console.warn("Permission refresh failed:", err?.response?.data || err);
        }
      }
    });

    setSocket(s);

    return () => {
      try {
        s.disconnect();
      } catch {}
    };
  }, [token, user?.roleId]);

  // ✅ Auth Actions
  const login = (tk, usr) => {
    setToken(tk);
    setUser(usr);
  };

  const logout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch {}
    setToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  };

  // ✅ Provide stable context value
  const value = useMemo(() => ({ token, user, login, logout, loading }), [token, user, loading]);

  // ✅ Loading splash (no hook order issues)
  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-600">
          <div className="animate-pulse">Checking session...</div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
