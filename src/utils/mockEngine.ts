import { MOCK_DB } from './mockDataDb';

// Utility to simulate network latency
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const processMockRequest = async (action: string, payload?: any): Promise<any> => {
  await delay(300 + Math.random() * 400); // 300-700ms latency

  console.log('[MOCK API INTERCEPT]', action, payload);

  const actionName = action.split('&')[0];

  switch (actionName) {
    case 'login':
      if (payload?.email === 'admin' || payload?.email === 'admin@gmail.com') {
        return {
          success: true,
          token: 'demo_token_12345',
          user: { id: 1, email: 'admin@domation.net', role: 'admin', is_confirmed: 1 }
        };
      }
      throw new Error('Email hoặc mật khẩu không đúng (Mock)');

    case 'get_dashboard_stats':
      return { success: true, data: MOCK_DB.dashboard };

    case 'get_logs':
      let logs = [...MOCK_DB.logs];
      if (payload?.search) {
        const s = payload.search.toLowerCase();
        logs = logs.filter(l => l.lead_name.toLowerCase().includes(s) || l.phone.includes(s));
      }
      if (payload?.status) {
        logs = logs.filter(l => l.status === payload.status);
      }
      return {
        success: true,
        data: logs.slice(0, 50), // paginate
        total: logs.length
      };

    case 'get_consultants':
      return { success: true, data: MOCK_DB.consultants };
      
    case 'get_rounds':
      return { success: true, data: MOCK_DB.rounds };
      
    case 'get_reports':
      return { success: true, data: MOCK_DB.tickets };
      
    case 'get_rules':
      return { success: true, data: MOCK_DB.rules };

    case 'get_connections':
      return { success: true, data: MOCK_DB.connections };

    case 'get_mappings':
      return { success: true, data: MOCK_DB.mappings };
      
    case 'get_integrations':
      return { success: true, data: MOCK_DB.integrations };
      
    case 'get_settings':
      return { success: true, data: MOCK_DB.settings };
      
    case 'get_accounts':
      return { success: true, data: MOCK_DB.accounts };

    case 'get_ticket_settings':
      return { success: true, data: [1, 2] };

    case 'get_report_context':
      return { success: true, data: MOCK_DB.report_context };

    case 'approve_report':
      return { success: true, message: 'Đã duyệt (Demo)' };

    case 'reject_report':
      return { success: true, message: 'Đã từ chối (Demo)' };

    // Default catch-all for POST actions
    case 'add_consultant':
    case 'edit_consultant':
    case 'delete_consultant':
    case 'add_round':
    case 'edit_round':
    case 'delete_round':
    case 'add_rule':
    case 'edit_rule':
    case 'delete_rule':
    case 'update_settings':
    case 'add_account':
    case 'edit_account':
    case 'delete_account':
      return { success: true, message: 'Thao tác thành công (Demo Mode)' };

    default:
      return { success: true, data: [] };
  }
};
