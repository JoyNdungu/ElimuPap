import axios from 'axios';
import {
  saveCachedResponse,
  getCachedResponse,
  isQueueableMutation,
  enqueueOfflineAction,
  buildOfflineQuizFromCache,
} from '../utils/offlineCache';

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
// 1. Cache successful study data for offline viewing.
// 2. Fallback to offline cache on network errors.
// 3. On 401, clear stored credentials and redirect to /login.
api.interceptors.response.use(
  (response) => {
    try {
      saveCachedResponse(
        response.config?.method,
        response.config?.url,
        response.config?.data,
        response.data
      );
    } catch (_) {
      // ignore cache write issues
    }
    return response;
  },
  (error) => {
    // Offline fallback when there is no network response
    if (!error.response && error.config) {
      const cached = getCachedResponse(
        error.config.method,
        error.config.url,
        error.config.data
      );
      if (cached !== null) {
        return Promise.resolve({
          data: cached,
          status: 200,
          statusText: 'OK (Offline Cache)',
          headers: {},
          config: error.config,
          fromOfflineCache: true,
        });
      }

      // Offline fallback quiz built from cached summary definitions & takeaways
      if ((error.config.url || '').includes('/ai/quiz')) {
        const fallbackQuiz = buildOfflineQuizFromCache(error.config.data);
        if (fallbackQuiz) {
          return Promise.resolve({
            data: fallbackQuiz,
            status: 200,
            statusText: 'OK (Offline Quiz Fallback)',
            headers: {},
            config: error.config,
            fromOfflineCache: true,
          });
        }
      }

      // Queue study mutations (SRS reviews, study timer, activity logs) to sync when back online
      if (isQueueableMutation(error.config.method, error.config.url)) {
        enqueueOfflineAction(error.config.method, error.config.url, error.config.data);
        return Promise.resolve({
          data: { queued: true, offline: true },
          status: 200,
          statusText: 'Queued (Offline Sync)',
          headers: {},
          config: error.config,
          fromOfflineQueue: true,
        });
      }
    }

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
