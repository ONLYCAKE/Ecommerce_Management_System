import React, {
  createContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { io, Socket } from "socket.io-client";

/* -------------------------- USER INTERFACE -------------------------- */
export interface User {
  id: number;
  roleId: number;
  email: string;
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
  mustChangePassword?: boolean;
  permissions?: string[];
}

/* ---------------------- CONTEXT VALUE INTERFACE ---------------------- */
export interface AuthContextValue {
  token: string | null;
  user: User | null;
  login: (tk: string, usr: User) => void;
  logout: () => void;
  loading: boolean;
}

/* ------------------------ CREATE CONTEXT ------------------------ */
export const AuthContext = createContext<AuthContextValue | null>(null);

/* ------------------------ PROVIDER ------------------------ */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token")
  );

  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null") as User | null;
    } catch {
      return null;
    }
  });

  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  /* ---------------------- PERSIST TOKEN ---------------------- */
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  /* ---------------------- PERSIST USER ---------------------- */
  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  /* ------------------------- AUTH VALIDATION ------------------------- */
  useEffect(() => {
    const verifyUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get<User>("/auth/me");
        setUser(data);
      } catch (err: any) {
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

  /* ------------------------- SOCKET CONNECTION ------------------------- */
  useEffect(() => {
    if (!token) {
      if (socket) {
        try {
          socket.disconnect();
        } catch { }
      }
      setSocket(null);
      return;
    }

    const s: Socket = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:5000",
      {
        transports: ["websocket", "polling"],
        auth: { token },
      }
    );

    s.on("connect", () => console.log("✅ Socket connected"));
    s.on("disconnect", () => console.log("🔌 Socket disconnected"));

    // 🔁 Refresh permissions live
    s.on("permissions.updated", async (payload: { roleId: number }) => {
      if (user?.roleId && payload.roleId === user.roleId) {
        try {
          const { data } = await api.get<User>("/auth/me");
          setUser(data);
          console.log("🔄 Permissions refreshed for role:", payload.roleId);
        } catch (err: any) {
          console.warn("Permission refresh failed:", err?.response?.data || err);
        }
      }
    });

    setSocket(s);

    return () => {
      try {
        s.disconnect();
      } catch { }
    };
  }, [token, user?.roleId]);

  /* -------------------------- LOGIN & LOGOUT -------------------------- */
  const login = (tk: string, usr: User) => {
    setToken(tk);
    setUser(usr);
  };

  const logout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch { }

    setToken(null);
    setUser(null);

    navigate("/login", { replace: true });
  };

  /* ------------------ PROVIDE MEMOIZED CONTEXT VALUE ------------------ */
  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      login,
      logout,
      loading,
    }),
    [token, user, loading]
  );

  /* -------------------------- PROVIDER WRAPPER -------------------------- */
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
