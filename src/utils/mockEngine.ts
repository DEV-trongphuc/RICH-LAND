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

    case 'get_consultant_stats':
      return {
        success: true,
        summary: {
          total: 154,
          successful: 122,
          duplicate: 32
        },
        rounds: [
          {
            round_id: 1,
            round_name: "Vòng Phân Bổ: Facebook & TikTok Ads",
            total_count: 94,
            successful_count: 75,
            duplicate_count: 19
          },
          {
            round_id: 2,
            round_name: "Vòng Phân Bổ: Google Ads & Website",
            total_count: 60,
            successful_count: 47,
            duplicate_count: 13
          }
        ],
        by_date: [
          { date: "01/05", count: 12 },
          { date: "05/05", count: 18 },
          { date: "10/05", count: 15 },
          { date: "15/05", count: 24 },
          { date: "20/05", count: 22 },
          { date: "24/05", count: 31 }
        ],
        by_source: [
          { source: "Facebook Ads", count: 68 },
          { source: "Google Ads", count: 32 },
          { source: "Website Direct", count: 15 },
          { source: "Excel Import", count: 7 }
        ],
        tickets: {
          total: 12,
          approved: 8,
          rejected: 2,
          pending: 2
        }
      };

    case 'approve_report':
      return { success: true, message: 'Đã duyệt (Demo)' };

    case 'reject_report':
      return { success: true, message: 'Đã từ chối (Demo)' };

    case 'preview_routing':
      return { 
        success: true, 
        round_id: 1, 
        consultant: { consultant_id: 1, name: 'Hải Đăng', round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads' } 
      };

    case 'manual_insert_lead':
      return { success: true, message: 'Đã thêm thành công (Demo)' };

    case 'get_my_activity_logs':
      return {
        success: true,
        data: [
          { id: 1, account_id: 1, action: 'LOGIN', details: '{"message":"User logged in successfully"}', ip_address: '127.0.0.1', created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
          { id: 2, account_id: 1, action: 'UPDATE_PROFILE', details: '{"name":"Turnio DEV","avatar":null}', ip_address: '127.0.0.1', created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
          { id: 3, account_id: 1, action: 'CHANGE_PASSWORD', details: '{}', ip_address: '127.0.0.1', created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() }
        ]
      };

    case 'upload_avatar':
      return { success: true, url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150' };

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
    case 'update_profile':
      return { success: true, message: 'Thao tác thành công (Demo Mode)' };

    default:
      return { success: true, data: [] };
  }
};
