const BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api.php` : 'https://open.domation.net/sale_data/api.php';

// BUG-11 fix: Guard against multiple concurrent 401 redirects
let _isRedirectingToLogin = false;

export async function fetchAPI(action: string, options: RequestInit = {}) {
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
    throw new Error(json.message || 'Lỗi kết nối máy chủ');
  }

  return json;
}

/**
 * fetchPublicAPI — dùng cho các trang public (report-data, v.v.)
 * KHÔNG gửi token, KHÔNG redirect về /login khi lỗi
 */
export async function fetchPublicAPI(action: string, options: RequestInit = {}) {
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
