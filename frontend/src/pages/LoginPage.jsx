import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function validate(fields) {
  const errors = {};
  if (!fields.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) errors.email = 'Enter a valid email address.';
  if (!fields.password) errors.password = 'Password is required.';
  return errors;
}

export default function LoginPage() {
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [fields, setFields]     = useState({ email: '', password: '' });
  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, authLoading, navigate, from]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFields((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
    setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ve = validate(fields);
    if (Object.keys(ve).length) { setErrors(ve); return; }
    setLoading(true);
    setApiError('');
    try {
      await login(fields);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Login failed. Please check your credentials.';
      setApiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12" style={{ backgroundColor: '#13131f' }}>

      {/* Top Logo */}
      <div className="text-center mb-10 animate-fade-in">
        <Link to="/" aria-label="ElimuPap home" className="inline-block">
          <h1 className="font-display text-3xl text-white tracking-tight leading-none mb-2">
            ElimuPap
          </h1>
          <p className="text-sm" style={{ color: '#9898c0' }}>
            Academic Assistant
          </p>
        </Link>
      </div>

      {/* Card */}
      <div 
        className="w-full max-w-[420px] rounded-xl p-8 sm:p-10 animate-slide-up"
        style={{ backgroundColor: '#1a1a2e', border: '1px solid #2d2d4a' }}
      >
        <h2 className="text-center font-display text-2xl text-white mb-8">
          Welcome back
        </h2>

        {/* API error */}
        {apiError && (
          <div className="alert-error mb-5" role="alert" aria-live="assertive">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate aria-label="Login form">
          
          {/* Email Field */}
          <div className="mb-5">
            <label className="block text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: '#9898c0' }} htmlFor="login-email">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#7070b0' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </span>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:border-transparent transition-shadow ${errors.email ? 'border-red-500 focus:ring-red-500' : 'focus:ring-[#5B57FF]'}`}
                style={{ backgroundColor: '#11111a', border: `1px solid ${errors.email ? '#ef4444' : '#2d2d4a'}` }}
                value={fields.email}
                onChange={handleChange}
                disabled={loading}
                autoFocus
              />
            </div>
            {errors.email && <p className="error-message">⚠ {errors.email}</p>}
          </div>

          {/* Password Field */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: '#9898c0' }} htmlFor="login-password">
                Password
              </label>
              <Link to="/forgot-password" className="text-[10px] font-bold tracking-[0.05em] hover:opacity-80 transition-opacity" style={{ color: '#c4c2ff' }}>
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#7070b0' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </span>
              <input
                id="login-password"
                name="password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`w-full pl-10 pr-10 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:border-transparent transition-shadow tracking-widest ${errors.password ? 'border-red-500 focus:ring-red-500' : 'focus:ring-[#5B57FF]'}`}
                style={{ backgroundColor: '#11111a', border: `1px solid ${errors.password ? '#ef4444' : '#2d2d4a'}` }}
                value={fields.password}
                onChange={handleChange}
                disabled={loading}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPass((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center hover:opacity-80 transition-opacity"
                style={{ color: '#7070b0' }}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass
                  ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                }
              </button>
            </div>
            {errors.password && <p className="error-message">⚠ {errors.password}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="login-submit-btn"
            className="w-full py-2.5 rounded-lg flex justify-center items-center gap-2 text-sm font-medium transition-colors mb-6"
            style={{ backgroundColor: '#5B57FF', color: '#fff' }}
            disabled={loading}
            aria-busy={loading}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#7571ff'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#5B57FF'}
          >
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Signing in…</>
            ) : (
              <>Log In <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg></>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="w-full h-px mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />

        {/* Footer */}
        <p className="text-center text-sm" style={{ color: '#9898c0' }}>
          Don't have an account?{' '}
          <Link to="/register" className="font-medium hover:opacity-80 transition-opacity" style={{ color: '#e8e7ff' }} id="login-to-register-link">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
