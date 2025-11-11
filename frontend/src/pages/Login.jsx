import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('superadmin@ems.com');
  const [password, setPassword] = useState('Super@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        setError('Email and password are required.');
        return;
      }

      // 🔹 Call backend
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;

      // 🔹 Save token & user (fallback if useAuth doesn't persist)
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // 🔹 Update global auth context
      login(token, user);

      // 🔹 Redirect logic
      const from = location.state?.from?.pathname || '/dashboard';
      if (user.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-6">
      <div className="card w-full max-w-md p-8">
        <h1 className="font-heading text-2xl text-primary mb-1">Sign in</h1>
        <p className="text-sm text-text mb-6">Use demo credentials below</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-600">Email</label>
            <input
              type="email"
              className="input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Password</label>
            <input
              type="password"
              className="input mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="btn w-full btn-primary"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-xs text-gray-500 space-y-1">
          <div>superadmin@ems.com / Super@123 (SuperAdmin)</div>
          <div>admin@ems.com / Admin@123 (Admin)</div>
          <div>employee@ems.com / Emp@123 (Employee)</div>
        </div>
      </div>
    </div>
  );
}
