import axios from 'axios';

/**
 * Axios instance pre-configured with the FastAPI base URL.
 * Interceptors automatically:
 *  - Attach Authorization header on outgoing requests (for future protected endpoints).
 *  - Redirect to /login on 401 Unauthorized responses.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request Interceptor ──────────────────────────────────
// Attach the JWT token to every outgoing request.
// The /auth/me endpoint reads the token from a query param (legacy backend behaviour),
// so that specific call passes ?token= manually. All future protected endpoints will
// use the Authorization header added here.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('elimupap_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ─────────────────────────────────
// On 401, clear stored credentials and redirect to /login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only clear + redirect if it's not the login/register endpoint itself
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuthEndpoint) {
        localStorage.removeItem('elimupap_token');
        localStorage.removeItem('elimupap_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
