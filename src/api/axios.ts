import axios from 'axios';
import { DEV_MODE, API_BASE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';

// Auto-detect: local dev uses Vite proxy, production uses real URL
const BASE_URL = API_BASE;

// Custom Mock Adapter for PURE DEMO MODE
const mockAdapter = (config: any): Promise<any> => {
  return new Promise((resolve) => {
    const state = getFilteredMockState();
    const url = config.url || '';
    const method = config.method?.toLowerCase();
    let responseData: any = null;

    // Mapping API endpoints to Mock Store data
    if (url.includes('/comments')) {
      responseData = [
        { id: 1, user_name: 'Minh Khôi (Manager)', content: 'Tuyệt vời, cố gắng theo sát khách này nhé! Nhớ nhắc khách về chương trình khuyến mãi tháng này.', attachments: [], created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 2, user_name: 'Bảo Trâm (Sale 2)', content: 'Khách này mình đã chăm sóc từ đợt trước, họ rất quan tâm tới giải pháp bảo mật.', attachments: [], created_at: new Date(Date.now() - 43200000).toISOString() }
      ];
    } else if (url.includes('/contacts')) {
      const companyId = config.params?.company_id;
      let items = state.contacts;
      if (companyId) items = items.filter((c: any) => String(c.company_id) === String(companyId));
      responseData = { items, total: items.length };
    } else if (url.includes('/users')) {
      responseData = state.users;
    } else if (url.includes('/deals')) {
      const contactId = config.params?.contact_id;
      const companyId = config.params?.company_id;
      let items = state.deals;
      if (contactId) items = items.filter((d: any) => String(d.contact_id) === String(contactId));
      if (companyId) items = items.filter((d: any) => String(d.company_id) === String(companyId));
      responseData = { items, total: items.length };
    } else if (url.includes('/activities')) {
      const contactId = config.params?.related_id || config.params?.contact_id;
      let items = state.activities;
      if (contactId) items = items.filter((a: any) => String(a.contact_id) === String(contactId));
      responseData = { items, total: items.length };
    } else if (url.includes('/expenses')) {
      const contactId = config.params?.contact_id;
      let items = state.expenses || [];
      if (contactId) items = items.filter((e: any) => String(e.contact_id) === String(contactId));
      responseData = items;
    } else if (url.includes('/invoices')) {
      const contactId = config.params?.contact_id;
      let items = state.invoices;
      if (contactId) items = items.filter((i: any) => String(i.contact_id) === String(contactId));
      responseData = { items, total: items.length };
    } else if (url.includes('/tickets')) {
      const contactId = config.params?.contact_id;
      let items = state.tickets;
      if (contactId) items = items.filter((t: any) => String(t.contact_id) === String(contactId));
      responseData = { items, total: items.length };
    } else if (url.includes('/products')) {
      responseData = { items: state.products, total: state.products.length };
    } else if (url.includes('/inventory') && !url.includes('logs')) {
      responseData = { 
        items: state.batches, 
        total: state.batches.length,
        summary: { total_items: 450, out_of_stock: 2, capital_value: 1250000000 } 
      };
    } else if (url.includes('/batches')) {
      responseData = state.batches;
    } else if (url.includes('/notifications')) {
      responseData = state.notifications;
    } else if (url.includes('/quotes')) {
      const contactId = config.params?.contact_id;
      let items = state.quotes;
      if (contactId) items = items.filter((q: any) => String(q.contact_id) === String(contactId));
      responseData = { items, total: items.length };
    } else if (url.includes('/pipeline-stages')) {
      responseData = state.pipeline_stages;
    } else if (url.includes('/tags')) {
      responseData = state.tags;
    } else if (url.includes('/inventory/global-logs')) {
      responseData = state.inventory_logs;
    } else if (url.match(/\/inventory\/logs\/\d+/)) {
      const batchId = parseInt(url.split('/').pop() || '0', 10);
      responseData = state.inventory_logs.filter((l: any) => l.batch_id === batchId);
    } else if (url.includes('/companies')) {
      responseData = { items: state.companies, total: state.companies.length };
    } else if (url.includes('/suppliers')) {
      responseData = { items: state.suppliers, total: state.suppliers.length };
    } else if (url.includes('/files')) {
      const companyId = config.params?.company_id;
      let items = state.files;
      if (companyId) items = items.filter((f: any) => String(f.company_id) === String(companyId));
      responseData = { items, total: items.length };
    } else if (url.includes('/notes')) {
      const entityId = config.params?.entity_id;
      let items = state.activities.filter((a: any) => a.type === 'note');
      if (entityId) items = items.filter((a: any) => String(a.contact_id) === String(entityId));
      responseData = items; // Notes usually return array directly or wrapped depending on implementation, but CPD expects array
    } else if (url.includes('/pipeline-stages')) {
      // Already handled above, but ensure this branch works too
    } else if (url.includes('/dashboard/stats')) {
      const activeDeals = state.deals.filter((d: any) => d.stage !== 'won' && d.stage !== 'lost');
      const dealsValue = activeDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
      const wonDeals = state.deals.filter((d: any) => d.stage === 'won');
      const revenue = wonDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);

      responseData = {
        revenue: revenue || 125000000,
        revenue_change: 12.5,
        gross_profit: (revenue || 125000000) * 0.35,
        gross_profit_change: 8.2,
        new_contacts: state.contacts.length > 0 ? Math.floor(state.contacts.length * 0.2) : 48,
        new_contacts_change: 5.4,
        total_contacts: state.contacts.length || 1250,
        total_contacts_change: 2.1,
        active_deals: activeDeals.length || 15,
        deals_value: dealsValue || 420000000,
        conversion_rate: state.deals.length ? Math.round((wonDeals.length / state.deals.length) * 100) : 64
      };
    }

    // Simulate network delay for realism
    setTimeout(() => {
      // For mutations (POST, PUT, DELETE), always return success in DEV_MODE
      if (['post', 'put', 'delete', 'patch'].includes(method || '')) {
        let returnData = {};

        // Specific mock handlers
        if (url.includes('/upload')) {
          // Fake uploaded image URL (random nature placeholder)
          returnData = { url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' };
        } else {
          try {
            returnData = config.data ? JSON.parse(config.data) : {};
          } catch (e) {
            // Ignore parse errors (e.g. if FormData)
          }
        }

        resolve({
          data: { success: true, message: 'DEMO MODE: Action simulated successfully', data: returnData },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
        return;
      }

      // For GET, return mapped data or empty success
      resolve({
        data: { success: true, data: responseData || [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    }, 300);
  });
};

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  // Use mock adapter if DEV_MODE is active
  adapter: DEV_MODE ? (mockAdapter as any) : undefined,
});


// Attach access token
api.interceptors.request.use((config) => {
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
