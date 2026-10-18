import axios from 'axios';
import { API_BASE } from '../config/env';
import { sanitizeUserMessage } from '../utils/toastEnhancer';

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
  [
    'refresh-page',
    'lead-added',
    'contact-updated',
    'deposit-updated',
    'coop-updated',
    'refresh-pending-counts',
    'task-updated',
    'system_settings_updated',
  ].forEach((evt) => {
    window.addEventListener(evt, () => {
      getResponseCache.clear();
    });
  });
}

const MUTATION_ACTION_PREFIXES = [
  'save_',
  'update_',
  'delete_',
  'create_',
  'approve_',
  'reject_',
  'cancel_',
  'claim_',
  'accept_',
  'release_',
  'assign_',
  'move_',
  'toggle_',
];

function isMutationAction(action: string): boolean {
  if (!action || action === 'claim_lead_check' || action === 'mark_read') return false;
  return MUTATION_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix));
}

function extractActionAndCanonicalKey(config: any): { key: string; action: string; fullTarget: string } {
  const rawUrl = String(config.url || '');
  const [basePath, queryString] = rawUrl.split('?');
  const mergedParams: Record<string, string> = {};

  if (queryString) {
    const sp = new URLSearchParams(queryString);
    sp.forEach((v, k) => {
      mergedParams[k] = v;
    });
  }
  if (config.params && typeof config.params === 'object') {
    Object.keys(config.params).forEach((k) => {
      const val = config.params[k];
      if (val !== undefined && val !== null) {
        mergedParams[k] = typeof val === 'object' ? JSON.stringify(val) : String(val);
      }
    });
  }

  const sortedPairs = Object.keys(mergedParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(mergedParams[k])}`);
  const canonicalQuery = sortedPairs.join('&');
  const key = `${basePath}?${canonicalQuery}`;
  const action = String(mergedParams.action || '').toLowerCase();
  return { key, action, fullTarget: key.toLowerCase() };
}

function getCacheTtlMs(fullTarget: string, action: string): number {
  // Real-time endpoints: coalesce in-flight only (0ms post-completion cache)
  if (
    action === 'get_active_offers' ||
    action === 'notifications' ||
    action === 'check_version' ||
    action === 'get_round_cooldowns' ||
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
    action === 'get_settings' ||
    action === 'projects' ||
    action === 'users' ||
    action === 'pipeline-stages' ||
    action === 'teams' ||
    action === 'custom-fields' ||
    action === 'get_consultants' ||
    action === 'get_rounds' ||
    action === 'get_rules' ||
    fullTarget.includes('minimal=1') ||
    fullTarget.includes('get_consultants') ||
    fullTarget.includes('get_rounds') ||
    fullTarget.includes('get_rules') ||
    fullTarget.includes('get_settings') ||
    fullTarget.includes('action=users') ||
    fullTarget.includes('action=projects') ||
    fullTarget.includes('action=pipeline-stages') ||
    fullTarget.includes('action=teams') ||
    fullTarget.includes('action=custom-fields')
  ) {
    return 15000;
  }
  // Standard GET & filter queries: 2.5s micro-cache (eliminates double-mount fetches & rapid filter back-and-forth lag)
  return 2500;
}

function createCanceledError(config: any): any {
  const err: any = new axios.CanceledError('canceled', undefined, config);
  err.name = 'CanceledError';
  err.code = 'ERR_CANCELED';
  return err;
}

function attachCallerSignal<T>(promise: Promise<T>, signal?: AbortSignal | any, config?: any): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(createCanceledError(config));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(createCanceledError(config));
    };
    if (typeof signal.addEventListener === 'function') {
      signal.addEventListener('abort', onAbort, { once: true });
    }
    promise.then(
      (val) => {
        if (typeof signal.removeEventListener === 'function') {
          signal.removeEventListener('abort', onAbort);
        }
        if (signal.aborted) {
          reject(createCanceledError(config));
        } else {
          resolve(val);
        }
      },
      (err) => {
        if (typeof signal.removeEventListener === 'function') {
          signal.removeEventListener('abort', onAbort);
        }
        reject(err);
      }
    );
  });
}

// Custom Axios Adapter to coalesce ALL concurrent GET calls (api(config), api.get(), fetchAPI() with AbortSignal)
const defaultAdapter = axios.getAdapter(axios.defaults.adapter);

api.defaults.adapter = async function coalescedAdapter(config: any): Promise<any> {
  const method = String(config.method || 'get').toLowerCase();
  const headers = config.headers || {};
  const cacheControl = String(headers['Cache-Control'] || headers['cache-control'] || '');
  const isNoCache = cacheControl.includes('no-store') || cacheControl.includes('no-cache');
  const { key, action, fullTarget } = extractActionAndCanonicalKey(config);

  // Any write/mutation immediately invalidates the GET cache so subsequent reads are 100% fresh
  if (method !== 'get' && method !== 'head') {
    if (action !== 'claim_lead_check' && action !== 'mark_read' && !fullTarget.includes('claim_lead_check') && !fullTarget.includes('mark_read')) {
      getResponseCache.clear();
    }
    return defaultAdapter(config);
  }

  if (isMutationAction(action)) {
    getResponseCache.clear();
    return defaultAdapter(config);
  }

  if (method === 'get' && !isNoCache) {
    if (config.signal?.aborted) {
      return Promise.reject(createCanceledError(config));
    }

    const ttlMs = getCacheTtlMs(fullTarget, action);

    if (ttlMs > 0) {
      const cached = getResponseCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return Promise.resolve({ ...cached.response, config });
      }
    }

    const existing = inFlightGetRequests.get(key);
    if (existing) {
      return attachCallerSignal(
        existing.then((res) => ({ ...res, config })),
        config.signal,
        config
      );
    }

    // Run underlying network call without single-caller abort signal so one unmounting component
    // does not abort the shared in-flight request for other active subscribers
    const sharedConfig = config.signal ? { ...config, signal: undefined } : config;
    const networkPromise = defaultAdapter(sharedConfig)
      .then((res: any) => {
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

    inFlightGetRequests.set(key, networkPromise);
    return attachCallerSignal(
      networkPromise.then((res) => ({ ...res, config })),
      config.signal,
      config
    );
  }

  return defaultAdapter(config);
};

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => {
    if (r?.data && typeof r.data === 'object' && r.data.success === false && typeof r.data.message === 'string') {
      r.data.message = sanitizeUserMessage(r.data.message);
    }
    return r;
  },
  async (error) => {
    const isCanceled =
      error?.name === 'AbortError' ||
      error?.name === 'CanceledError' ||
      error?.code === 'ERR_CANCELED';

    const original = error?.config;
    if (!original) {
      if (!isCanceled && error) {
        if (error.response?.data && typeof error.response.data === 'object' && typeof error.response.data.message === 'string') {
          error.response.data.message = sanitizeUserMessage(error.response.data.message);
        }
        if (typeof error.message === 'string') {
          error.message = sanitizeUserMessage(error.response?.data?.message || error.message);
        }
      }
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
    if (!isCanceled && error) {
      if (error.response?.data && typeof error.response.data === 'object' && typeof error.response.data.message === 'string') {
        error.response.data.message = sanitizeUserMessage(error.response.data.message);
      }
      if (typeof error.message === 'string') {
        error.message = sanitizeUserMessage(error.response?.data?.message || error.message);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
