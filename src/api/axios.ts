import axios from 'axios';
import { DEV_MODE, API_BASE } from '../config/env';

// Auto-detect: local dev uses Vite proxy, production uses real URL
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocal ? '/backend' : API_BASE;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});


// Attach access token
api.interceptors.request.use((config) => {
  // Remove Content-Type header for GET/HEAD requests to prevent 415 Unsupported Media Type errors on strict WAFs
  if (config.method && ['get', 'head'].includes(config.method.toLowerCase())) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
      }
    }
  }

  // Remove Content-Type header for FormData payloads to allow automatic boundary configuration
  if (config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type'];
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
      }
    }
  }

  // Translate PUT, PATCH, DELETE to POST with method override header/param for production to bypass server restrictions
  if (!DEV_MODE && config.method && ['put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
    const originalMethod = config.method.toUpperCase();
    config.params = config.params || {};
    config.params._method = originalMethod;
    config.method = 'post';
  }
  // In production (not DEV_MODE), rewrite URL to api.php?action=... to bypass missing web server rewrite rules
  if (!DEV_MODE && config.url && !config.url.startsWith('http') && !config.url.includes('api.php')) {
    const cleanUrl = config.url.replace(/^\//, ''); // remove leading slash
    config.params = config.params || {};
    config.params.action = cleanUrl;
    config.url = 'api.php';
  }

  // Block mutations in DEV_MODE, but whitelist comments and upload for UI testing
  if (DEV_MODE && config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
    const isWhitelisted = config.url && (config.url.includes('/comments') || config.url.includes('/upload'));

    if (!isWhitelisted) {
      console.warn(`DEV_MODE ACTIVE: Action ${config.method.toUpperCase()} blocked for ${config.url}`);
      // Create a structured error that components can easily catch and display
      const mockError = new Error('Tính năng này bị hạn chế ở chế độ DEMO MODE');
      (mockError as any).response = {
        status: 403,
        data: {
          success: false,
          message: 'Tính năng này bị hạn chế ở chế độ DEMO MODE (Dữ liệu mẫu không được thay đổi)'
        }
      };
      (mockError as any).isMockBlock = true;
      return Promise.reject(mockError);
    }
  }

  let token = null;
  const storedUserStr = localStorage.getItem('richland_user');
  if (storedUserStr) {
    try {
      const u = JSON.parse(storedUserStr);
      if (u && (u.role === 'sale' || u.role === 'sales')) {
        token = localStorage.getItem('richland_token');
      }
    } catch (e) {}
  }
  if (!token) {
    token = localStorage.getItem('access_token') || localStorage.getItem('richland_token');
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    // Don't intercept 401s from login or refresh endpoints themselves
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/refresh')
    ) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refresh });
        const { access_token, refresh_token } = data.data;
        localStorage.setItem('access_token', access_token);
        if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
        // Sync new token to Zustand store
        try { const { useAuthStore } = await import('../store/authStore' as any); const s = useAuthStore.getState(); if (s.user) useAuthStore.setState({ accessToken: access_token }); } catch {}
        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    if (error.response?.status === 500) {
      console.error('SERVER ERROR:', error.response.data);
      // We don't have direct access to addToast here easily without a store or window property.
      // But we can ensure the error is descriptive for the caller.
    }
    return Promise.reject(error);
  }
);

export default api;
