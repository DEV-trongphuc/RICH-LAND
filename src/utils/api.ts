const BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api.php` : 'https://open.domation.net/sale_data/api.php';

export async function fetchAPI(action: string, options: RequestInit = {}) {
  const token = localStorage.getItem('domation_token'); // Lấy từ auth context hoặc localStorage (AuthContext lưu JWT vào localStorage under 'domation_token')
  
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
    if (response.status === 401 || response.status === 403) {
      // Bị lỗi xác thực hoặc không có quyền
      if (action !== 'login') {
        localStorage.removeItem('domation_token');
        localStorage.removeItem('domation_user');
        window.location.href = '/login';
      }
    }
    throw new Error(json.message || 'Lỗi kết nối máy chủ');
  }

  return json;
}
