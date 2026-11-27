import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

/**
 * AuthContext — global authentication state for ElimuPap.
 *
 * Provides:
 *  - user        : authenticated user object or null
 *  - token       : JWT string or null
 *  - loading     : true while the initial auth check is in progress
 *  - login()     : authenticate with email + password
 *  - register()  : create new account
 *  - logout()    : clear session
 */

const AuthContext = createContext(null);

const TOKEN_KEY = 'elimupap_token';
const USER_KEY  = 'elimupap_user';

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true); // true until initial /auth/me resolves

  // ── Persist helpers ────────────────────────────────────
  const clearCachedStudyData = useCallback(() => {
    localStorage.removeItem('elimupap_offline_meta');
    localStorage.removeItem('elimupap_sync_queue');
    Object.keys(localStorage)
      .filter((k) => k.startsWith('elimupap_cache:'))
      .forEach((k) => localStorage.removeItem(k));
    if (typeof caches !== 'undefined') {
      caches.delete('elimupap-files-v1').catch(() => {});
    }
  }, []);

  const persistSession = useCallback((jwt, userData) => {
    try {
      const prevUserRaw = localStorage.getItem(USER_KEY);
      const prevUser = prevUserRaw ? JSON.parse(prevUserRaw) : null;
      if (prevUser?.id && userData?.id && prevUser.id !== userData.id) {
        clearCachedStudyData();
      }
    } catch {}

    localStorage.setItem(TOKEN_KEY, jwt);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setToken(jwt);
    setUser(userData);
    window.dispatchEvent(new CustomEvent('elimupap:auth-changed', { detail: { user: userData } }));
  }, [clearCachedStudyData]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    clearCachedStudyData();
    setToken(null);
    setUser(null);
  }, [clearCachedStudyData]);

  // ── Rehydrate on app load ──────────────────────────────
  // Try restoring the user from /auth/me using the stored token.
  // The current backend reads the token as a query parameter.
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);

    if (!storedToken) {
      setLoading(false);
      return;
    }

    // Try cached user data first for instant UI, then validate with server
    const cachedUser = localStorage.getItem(USER_KEY);
    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch (_) {
        // ignore parse errors
      }
    }

    // Validate token with backend
    api
      .get('/auth/me', { params: { token: storedToken } })
      .then((res) => {
        setUser(res.data);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data));
      })
      .catch((err) => {
        // Only clear session if the server explicitly rejected the token (401/404).
        // If offline (no err.response), keep the cached user active for offline study.
        if (err?.response?.status === 401 || err?.response?.status === 404) {
          clearSession();
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── login() ────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: jwt, user: userData } = res.data;
    persistSession(jwt, userData);
    return userData;
  }, [persistSession]);

  // ── register() ────────────────────────────────────────
  const register = useCallback(async (formData) => {
    const res = await api.post('/auth/register', formData);
    const { token: jwt, user: userData } = res.data;
    persistSession(jwt, userData);
    return userData;
  }, [persistSession]);

  // ── logout() ──────────────────────────────────────────
  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = {
    user,
    setUser,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — convenience hook to access AuthContext.
 * Must be used inside AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
