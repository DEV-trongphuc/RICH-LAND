const BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api.php` : 'https://open.domation.net/sale_data/api.php';
import { processMockRequest } from './mockEngine';

// BUG-11 fix: Guard against multiple concurrent 401 redirects
let _isRedirectingToLogin = false;

export async function fetchAPI(action: string, options: RequestInit = {}, retries = 2) {
  if (localStorage.getItem('DOMATION_DEMO_MODE') === 'true') {
    let payload;
    if (options.body) {
      try { payload = JSON.parse(options.body as string); } catch (e) {}
    }
    return processMockRequest(action, payload);
  }

  const token = localStorage.getItem('domation_token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }

  let url = `${BASE_URL}?action=${action}`;
  if (token) {
    url += `&token=${token}`;
  }

  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const json = await response.json();

      if (!response.ok) {
        if ((response.status === 401 || response.status === 403) && action !== 'login') {
          // BUG-11 fix: Only redirect once even if multiple parallel requests all fail
          if (!_isRedirectingToLogin) {
            _isRedirectingToLogin = true;
            localStorage.removeItem('domation_token');
            localStorage.removeItem('domation_user');
            // Use replace to avoid back-button loop
            window.location.replace('/login');
          }
        }
        // Do not retry 4xx errors
        if (response.status >= 400 && response.status < 500) {
          throw new Error(json.message || 'Lỗi dữ liệu phía người dùng');
        }
        // If 5xx, we throw to trigger retry
        throw new Error(json.message || `Lỗi kết nối máy chủ (${response.status})`);
      }

      return json;
    } catch (err: any) {
      lastError = err;
      const isNetworkError = err instanceof TypeError && err.message === 'Failed to fetch';
      const isServerError = err instanceof Error && err.message.includes('Lỗi kết nối máy chủ');
      
      // Retry ONLY on pure network drops or 5xx server errors
      if (!isNetworkError && !isServerError) {
        throw err;
      }
      
      // If last attempt, give up
      if (attempt === retries) {
        break;
      }
      
      // Exponential backoff
      await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
    }
  }

  throw lastError;
}

/**
 * fetchPublicAPI — dùng cho các trang public (report-data, v.v.)
 * KHÔNG gửi token, KHÔNG redirect về /login khi lỗi
 */
export async function fetchPublicAPI(action: string, options: RequestInit = {}) {
  if (localStorage.getItem('DOMATION_DEMO_MODE') === 'true') {
    let payload;
    if (options.body) {
      try { payload = JSON.parse(options.body as string); } catch (e) {}
    }
    return processMockRequest(action, payload);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const url = `${BASE_URL}?action=${action}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Parse JSON regardless of status code
  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new Error('Lỗi kết nối máy chủ (không phải JSON)');
  }

  // Never redirect — just throw with server message
  if (!response.ok) {
    throw new Error(json?.message || `Lỗi máy chủ (${response.status})`);
  }

  return json;
}
