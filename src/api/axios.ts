import axios from 'axios';
import { API_BASE } from '../config/env';

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

  // Translate PUT, PATCH, DELETE to POST with method override header/param to bypass server restrictions
  if (config.method && ['put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
    const originalMethod = config.method.toUpperCase();
    config.params = config.params || {};
    config.params._method = originalMethod;
    config.method = 'post';
  }
  // Rewrite URL to api.php?action=... to bypass missing web server rewrite rules
  if (config.url && !config.url.startsWith('http') && !config.url.includes('api.php')) {
    const cleanUrl = config.url.replace(/^\//, ''); // remove leading slash
    const firstDelimiter = cleanUrl.search(/[?&]/);
    let actionPart = cleanUrl;
    let queryPart = '';
    if (firstDelimiter !== -1) {
      actionPart = cleanUrl.substring(0, firstDelimiter);
      queryPart = cleanUrl.substring(firstDelimiter + 1);
    }
    config.params = config.params || {};
    config.params.action = actionPart;
    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      searchParams.forEach((val, key) => {
        if (config.params[key] === undefined) {
          config.params[key] = val;
        }
      });
    }
    config.url = 'api.php';
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

// Single-flight lock for 401 token refresh so concurrent 401s share one refresh call
let refreshTokenPromise: Promise<string> | null = null;

// Single-flight coalescing map for identical concurrent GET requests
const inFlightGetRequests = new Map<string, Promise<any>>();

// Short-TTL in-memory response cache to eliminate duplicate mount fetches & make filter/tab switches instant
// Automatically invalidated on ANY non-GET mutation (POST/PUT/PATCH/DELETE) or manual refresh
const getResponseCache = new Map<string, { expiresAt: number; response: any }>();

export function clearApiGetCache() {
  getResponseCache.clear();
}

if (typeof window !== 'undefined') {
  ['refresh-page', 'lead-added', 'task-updated', 'system_settings_updated'].forEach((evt) => {
    window.addEventListener(evt, () => {
      getResponseCache.clear();
    });
  });
}

function getCacheTtlMs(url: string, params: Record<string, any> | undefined): number {
  const fullTarget = `${url}?${JSON.stringify(params || {})}`.toLowerCase();
  // Real-time endpoints: coalesce in-flight only (0ms post-completion cache)
  if (
    fullTarget.includes('get_active_offers') ||
    fullTarget.includes('notifications') ||
    fullTarget.includes('check_version') ||
    fullTarget.includes('get_round_cooldowns') ||
    fullTarget.includes('_t=')
  ) {
    return 0;
  }
  // Reference dropdowns & shared metadata: 15s TTL (wiped immediately on any mutation)
  if (
    fullTarget.includes('minimal=1') ||
    fullTarget.includes('"minimal":1') ||
    fullTarget.includes('"minimal":"1"') ||
    fullTarget.includes('get_consultants') ||
    fullTarget.includes('get_rounds') ||
    fullTarget.includes('get_rules') ||
    fullTarget.includes('get_settings') ||
    fullTarget.includes('/users') ||
    fullTarget.includes('action=users') ||
    fullTarget.includes('"action":"users"') ||
    fullTarget.includes('/projects') ||
    fullTarget.includes('action=projects') ||
    fullTarget.includes('"action":"projects"')
  ) {
    return 15000;
  }
  // Standard GET & filter queries: 2.5s micro-cache (eliminates double-mount fetches & rapid filter back-and-forth lag)
  return 2500;
}

// Wrap api.request to coalesce identical concurrent GET requests and serve short-TTL cached responses
const originalRequest = api.request.bind(api);
api.request = function coalescedRequest(configOrUrl: any, config?: any): Promise<any> {
  const resolvedConfig = typeof configOrUrl === 'string'
    ? { ...(config || {}), url: configOrUrl }
    : { ...(configOrUrl || {}) };

  const method = (resolvedConfig.method || 'get').toLowerCase();
  const hasSignal = Boolean(resolvedConfig.signal);
  const headers = resolvedConfig.headers || {};
  const isNoCache = headers['Cache-Control']?.includes('no-store') || headers['Cache-Control']?.includes('no-cache');

  // Any write/mutation immediately invalidates the GET cache so subsequent reads are 100% fresh
  if (method !== 'get' && method !== 'head') {
    const urlStr = String(resolvedConfig.url || '');
    if (!urlStr.includes('claim_lead_check') && !urlStr.includes('mark_read')) {
      getResponseCache.clear();
    }
    return originalRequest(resolvedConfig);
  }

  if (method === 'get' && !isNoCache) {
    const key = `${resolvedConfig.url || ''}?${JSON.stringify(resolvedConfig.params || {})}`;
    const ttlMs = getCacheTtlMs(resolvedConfig.url || '', resolvedConfig.params);

    if (ttlMs > 0) {
      const cached = getResponseCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return Promise.resolve(cached.response);
      }
    }

    if (!hasSignal) {
      const existing = inFlightGetRequests.get(key);
      if (existing) {
        return existing;
      }
      const promise = originalRequest(resolvedConfig)
        .then((res) => {
          if (ttlMs > 0 && res && res.status >= 200 && res.status < 300) {
            if (getResponseCache.size > 150) {
              const oldestKey = getResponseCache.keys().next().value;
              if (oldestKey) getResponseCache.delete(oldestKey);
            }
            getResponseCache.set(key, { expiresAt: Date.now() + ttlMs, response: res });
          }
          return res;
        })
        .finally(() => {
          inFlightGetRequests.delete(key);
        });
      inFlightGetRequests.set(key, promise);
      return promise;
    }
  }

  return originalRequest(resolvedConfig);
} as any;

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error?.config;
    if (!original) {
      return Promise.reject(error);
    }

    // Don't intercept 401s from login or refresh endpoints themselves
    const reqUrl = (original.url || '').toLowerCase();
    const actionParam = (original.params?.action || '').toLowerCase();
    const isAuthRequest =
      reqUrl.includes('auth/login') ||
      reqUrl.includes('auth/refresh') ||
      reqUrl.includes('login_google') ||
      actionParam === 'auth/login' ||
      actionParam === 'auth/refresh' ||
      actionParam === 'login_google';

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !isAuthRequest
    ) {
      original._retry = true;
      try {
        if (!refreshTokenPromise) {
          refreshTokenPromise = (async () => {
            const refresh = localStorage.getItem('refresh_token');
            if (!refresh) {
              throw new Error('No refresh token');
            }
            const { data } = await axios.post(`${BASE_URL}/api.php?action=auth/refresh`, { refresh_token: refresh });
            const { access_token, refresh_token } = data.data;
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('richland_token', access_token);
            if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
            try {
              const { useAuthStore } = await import('../store/authStore' as any);
              const s = useAuthStore.getState();
              if (s.user) useAuthStore.setState({ accessToken: access_token });
            } catch {}
            return access_token;
          })().finally(() => {
            refreshTokenPromise = null;
          });
        }

        const newAccessToken = await refreshTokenPromise;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    if (error.response?.status === 500) {
      console.error('SERVER ERROR:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
