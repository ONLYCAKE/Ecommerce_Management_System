import React, { createContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { io } from 'socket.io-client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Sync token and user to localStorage
  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  // Verify token and fetch user
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
      } catch (err) {
        console.warn('Auth check failed:', err?.response?.data || err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [token]);

  // Socket connection
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

    const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      transports: ['websocket', 'polling'],
    });

    setSocket(s);
    s.on('connect', () => console.log('✅ Socket connected'));

    s.on('permissions.updated', async (payload) => {
      if (user?.roleId && payload?.roleId === user.roleId) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data);
        } catch (err) {
          console.warn('Permission refresh failed:', err);
        }
      }
    });

    return () => {
      try {
        s.disconnect();
      } catch {}
    };
  }, [token, user?.roleId]);

  // Define login/logout actions
  const login = (tk, usr) => {
    setToken(tk);
    setUser(usr);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  };

  // Memoized context value
  const value = useMemo(() => ({ token, user, login, logout, loading }), [token, user, loading]);

  // ✅ Return one consistent JSX block (no hooks after return!)
  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-600">
          Checking session...
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
