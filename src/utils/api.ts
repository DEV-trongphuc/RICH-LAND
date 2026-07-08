const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocal ? '/backend/api.php' : (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api.php` : '/backend/api.php');
import { en, ja, zh } from './translations';

function getTranslatedError(key: string, replacements?: Record<string, string | number>): string {
  const lang = localStorage.getItem('richland_lang') || 'vi';
  if (lang === 'vi') return key;
  let translated = key;
  if (lang === 'en') translated = en[key] || key;
  if (lang === 'ja') translated = ja[key] || key;
  if (lang === 'zh') translated = zh[key] || key;
  
  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      translated = translated.replace(`{${k}}`, String(v));
    });
  }
  return translated;
}


import api from '../api/axios';

export async function fetchAPI(action: string, options: RequestInit = {}) {
  const originalMethod = (options.method || 'GET').toUpperCase();
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  const token = localStorage.getItem('richland_token');
  const parts = action.split('?');
  const baseAction = parts[0];
  let url = `api.php?action=${baseAction}`;
  if (parts[1]) {
    url += `&${parts[1]}`;
  }
  if (token) {
    url += `&token=${token}`;
  }

  try {
    const response = await api({
      method: originalMethod as any,
      url,
      data: options.body,
      headers,
    });
    return response.data;
  } catch (err: any) {
    if (err.response) {
      throw new Error(err.response.data?.message || err.message, { cause: err });
    }
    throw err;
  }
}

/**
 * fetchPublicAPI — dùng cho các trang public (report-data, v.v.)
 * KHÔNG gửi token, KHÔNG redirect về /login khi lỗi
 */
export async function fetchPublicAPI(action: string, options: RequestInit = {}) {
  const originalMethod = options.method ? options.method.toUpperCase() : 'GET';
  const isDevMode = import.meta.env.DEV || window.location.hostname === 'localhost';
  const isProd = !isDevMode;

  if (isProd && ['PUT', 'PATCH', 'DELETE'].includes(originalMethod)) {
    options.method = 'POST';
  }

  const isPayloadMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(originalMethod);
  const headers: Record<string, string> = {
    ...(isPayloadMethod && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
  };

  const parts = action.split('?');
  const baseAction = parts[0];
  let url = `${BASE_URL}?action=${baseAction}`;
  if (parts[1]) {
    url += `&${parts[1]}`;
  }
  if (isProd && ['PUT', 'PATCH', 'DELETE'].includes(originalMethod)) {
    url += `&_method=${originalMethod}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Parse JSON regardless of status code
  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new Error(getTranslatedError('Lỗi kết nối máy chủ (không phải JSON)'));
  }

  // Never redirect — just throw with server message
  if (!response.ok) {
    throw new Error(json?.message || getTranslatedError('Lỗi máy chủ ({status})', { status: response.status }));
  }

  return json;
}

export function getDefaultDateFilter(): string {
  return new Date().getDate() >= 7 ? 'Tháng này' : '30 ngày qua';
}
