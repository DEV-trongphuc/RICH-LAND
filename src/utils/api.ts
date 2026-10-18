const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocal ? '/backend/api.php' : (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api.php` : '/backend/api.php');


function getTranslatedError(key: string, replacements?: Record<string, string | number>): string {
  let translated = key;
  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      translated = translated.replace(`{${k}}`, String(v));
    });
  }
  return translated;
}


import api from '../api/axios';
import { sanitizeUserMessage } from './toastEnhancer';

let settingsCachePromise: Promise<any> | null = null;
let cachedToken: string | null = null;

export function clearSettingsCache() {
  settingsCachePromise = null;
  cachedToken = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('system_settings_updated', () => {
    clearSettingsCache();
  });
}

export async function fetchAPI(action: string, options: RequestInit = {}) {
  const originalMethod = (options.method || 'GET').toUpperCase();
  const isBypassCache = options.cache === 'no-store' || 
                        options.cache === 'no-cache' || 
                        (options.headers as any)?.['Cache-Control'] === 'no-cache';
  
  if (action.includes('save_settings') || originalMethod !== 'GET' || isBypassCache) {
    clearSettingsCache();
  }

  // Transparent caching for get_settings action
  if (action === 'get_settings' && originalMethod === 'GET') {
    const token = localStorage.getItem('richland_token');
    const fetchFresh = async () => {
      const url = `api.php?action=get_settings&_t=${Date.now()}`;
      try {
        const response = await api({
          method: 'GET',
          url,
          signal: options.signal as any,
          headers: {
            ...(options.headers as Record<string, string>),
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
        });
        if (response.data && typeof response.data === 'object' && response.data.success === false && typeof response.data.message === 'string') {
          response.data.message = sanitizeUserMessage(response.data.message);
        }
        return response.data;
      } catch (err: any) {
        settingsCachePromise = null; // Clear on error to allow retries
        if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
          throw err;
        }
        if (err.response) {
          throw new Error(sanitizeUserMessage(err.response.data?.message || err.message), { cause: err });
        }
        if (err && typeof err.message === 'string') {
          err.message = sanitizeUserMessage(err.message);
        }
        throw err;
      }
    };

    if (isBypassCache) {
      clearSettingsCache();
      return fetchFresh();
    }

    if (token !== cachedToken) {
      settingsCachePromise = null;
      cachedToken = token;
    }
    
    if (!settingsCachePromise) {
      settingsCachePromise = fetchFresh();
    }
    return settingsCachePromise;
  }
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  const parts = action.split('?');
  const baseAction = parts[0];
  let url = `api.php?action=${baseAction}`;
  if (parts[1]) {
    url += `&${parts[1]}`;
  }

  try {
    const response = await api({
      method: originalMethod as any,
      url,
      data: options.body,
      headers,
      signal: options.signal as any,
    });
    if (response.data && typeof response.data === 'object' && response.data.success === false && typeof response.data.message === 'string') {
      response.data.message = sanitizeUserMessage(response.data.message);
    }
    return response.data;
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
      throw err;
    }
    if (err.response) {
      throw new Error(sanitizeUserMessage(err.response.data?.message || err.message), { cause: err });
    }
    if (err && typeof err.message === 'string') {
      err.message = sanitizeUserMessage(err.message);
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
    throw new Error(sanitizeUserMessage(getTranslatedError('Lỗi kết nối máy chủ (không phải JSON)')));
  }

  // Never redirect — just throw with server message
  if (!response.ok) {
    throw new Error(sanitizeUserMessage(json?.message || getTranslatedError('Lỗi máy chủ ({status})', { status: response.status })));
  }

  if (json && typeof json === 'object' && json.success === false && typeof json.message === 'string') {
    json.message = sanitizeUserMessage(json.message);
  }

  return json;
}

export function getDefaultDateFilter(): string {
  return new Date().getDate() >= 7 ? 'Tháng này' : '30 ngày qua';
}
