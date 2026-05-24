export const MOCK_DB = {
  dashboard: {
    total_today: 1542,
    total_change: '+12%',
    distributed_today: 1400,
    distributed_change: '+8%',
    duplicates: 85,
    duplicates_change: '-5%',
    errors: 45,
    errors_change: '-2%',
    chartData: [
      { time: '08:00', volume: 15 },
      { time: '10:00', volume: 45 },
      { time: '12:00', volume: 120 },
      { time: '14:00', volume: 80 },
      { time: '16:00', volume: 150 },
      { time: '18:00', volume: 60 },
      { time: '20:00', volume: 20 },
    ],
    topConsultants: [
      { name: 'Nguyễn Văn A', data: 450, percent: 85, color: '#3b82f6' },
      { name: 'Trần Thị B', data: 380, percent: 70, color: '#10b981' },
      { name: 'Lê Hoàng C', data: 310, percent: 60, color: '#f59e0b' },
      { name: 'Hoàng Tú E', data: 220, percent: 45, color: '#8b5cf6' },
      { name: 'Phạm Minh D', data: 150, percent: 30, color: '#ef4444' }
    ],
    roundRatio: [
      { round: 'Vòng A - Facebook Ads', count: 850, percent: 55, color: '#3b82f6' },
      { round: 'Vòng B - Zalo ZCA', count: 420, percent: 30, color: '#8b5cf6' },
      { round: 'Vòng C - Organic Search', count: 272, percent: 15, color: '#10b981' }
    ]
  },
  
  consultants: [
    { id: 1, name: 'Hải Đăng', email: 'haidang@domation.net', status: 'active', zalo_chat_id: '9082348234' },
    { id: 2, name: 'Thanh Thảo', email: 'thanhthao@domation.net', status: 'active', zalo_chat_id: '9183492834' },
    { id: 3, name: 'Việt Dũng', email: 'vietdung@domation.net', status: 'leave', zalo_chat_id: '9843573845', leave_start: '2026-05-18', leave_end: '2026-05-25' },
    { id: 4, name: 'Minh Tuấn', email: 'minhtuan@domation.net', status: 'active', zalo_chat_id: '9238472938' },
    { id: 5, name: 'Ngọc Mai', email: 'ngocmai@domation.net', status: 'inactive', zalo_chat_id: '9123847283' }
  ],

  rounds: [
    { id: 1, round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads', is_active: 1, total_distributed: 850, consultants: 'Hải Đăng, Thanh Thảo, Việt Dũng, Minh Tuấn, Ngọc Mai', consultant_ids: '1,2,3,4,5', next_assigned_name: 'Hải Đăng' },
    { id: 2, round_name: 'Vòng Ưu Tiên: Zalo ZCA & Hotline', is_active: 1, total_distributed: 420, consultants: 'Hải Đăng, Thanh Thảo, Việt Dũng, Minh Tuấn', consultant_ids: '1,2,3,4', next_assigned_name: 'Việt Dũng' },
    { id: 3, round_name: 'Vòng Hỗ Trợ: Organic Search', is_active: 0, total_distributed: 272, consultants: 'Hải Đăng, Thanh Thảo, Việt Dũng', consultant_ids: '1,2,3', next_assigned_name: 'Thanh Thảo' },
  ],

  logs: Array.from({ length: 50 }).map((_, i) => ({
    id: 1000 - i,
    lead_name: `Khách hàng Demo ${1000 - i}`,
    phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
    email: `khachhang${i}@demo.com`,
    source: Math.random() > 0.5 ? 'Facebook Ads' : 'Zalo Ads',
    type: 'Tư vấn',
    note: 'Demo data from mock engine',
    status: Math.random() > 0.8 ? (Math.random() > 0.5 ? 'error' : 'compensation') : 'assigned',
    assigned_to_name: ['Nguyễn Văn A', 'Trần Thị B', 'Lê Hoàng C', 'Hoàng Tú E'][Math.floor(Math.random() * 4)],
    round_name: ['Vòng A - Facebook Ads', 'Vòng B - Zalo ZCA'][Math.floor(Math.random() * 2)],
    created_at: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
    report_status: null
  })),

  tickets: [
    { id: 101, lead_name: 'Trần Văn Demo', consultant_name: 'Nguyễn Văn A', reason: 'Sai số điện thoại / Số ảo', status: 'pending', created_at: new Date(Date.now() - 3600000).toISOString(), note: 'Gọi toàn ò í e' },
    { id: 102, lead_name: 'Lê Thị Test', consultant_name: 'Trần Thị B', reason: 'Trùng của người khác', status: 'pending', created_at: new Date(Date.now() - 7200000).toISOString(), note: 'Khách bảo đang làm việc với C' },
    { id: 103, lead_name: 'Phạm Văn Mẫu', consultant_name: 'Lê Hoàng C', reason: 'Khác', status: 'approved', created_at: new Date(Date.now() - 86400000).toISOString(), note: 'Đã đền bù data mới', admin_note: 'Duyệt đền bù' },
    { id: 104, lead_name: 'Nguyễn Demo 4', consultant_name: 'Hoàng Tú E', reason: 'Spam ảo / Junk lead', status: 'rejected', created_at: new Date(Date.now() - 172800000).toISOString(), note: 'Spam chửi bậy', admin_note: 'Từ chối vì khách vẫn nghe máy' },
  ],

  rules: [
    { 
      id: 1, 
      target_round_id: 1, 
      round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads', 
      conditions_json: JSON.stringify([
        { conditions: [{ col: 'source', op: 'contains', val: 'facebook' }], inject: { enabled: true, fields: [{ col: 'type', val: 'Ads' }] } },
        { conditions: [{ col: 'source', op: 'contains', val: 'tiktok' }] }
      ]), 
      action_type: 'assign_to_round', 
      priority: 1, 
      is_active: 1,
      connection_id: 1,
      sheet_name: 'Form Đăng Ký Tư Vấn Facebook'
    },
    { 
      id: 2, 
      target_round_id: 2, 
      round_name: 'Vòng Ưu Tiên: Zalo ZCA & Hotline', 
      conditions_json: JSON.stringify([
        { conditions: [{ col: 'source', op: 'equals', val: 'zalo_zca' }] },
        { conditions: [{ col: 'note', op: 'contains', val: 'gấp' }] }
      ]), 
      action_type: 'assign_to_round', 
      priority: 2, 
      is_active: 1,
      connection_id: null
    },
    { 
      id: 3, 
      target_round_id: 3, 
      round_name: 'Vòng Hỗ Trợ: Organic Search', 
      conditions_json: JSON.stringify([
        { conditions: [{ col: 'source', op: 'contains', val: 'seo' }] }
      ]), 
      action_type: 'assign_to_round', 
      priority: 3, 
      is_active: 0,
      connection_id: null
    }
  ],

  integrations: {
    webhook_secret: 'wh_sec_demo1234567890',
    zalo_oa_id: '123456789012345678',
    zalo_access_token: 'demo_zalo_token_xyz',
    recent_logs: [
      { id: 1, event_type: 'lead_received', status: 'success', created_at: new Date().toISOString(), payload: '{"name":"Demo","phone":"090123"}' },
      { id: 2, event_type: 'zalo_message_sent', status: 'success', created_at: new Date(Date.now() - 60000).toISOString(), payload: '{"to":"090123","msg":"Data mới..."}' }
    ]
  },

  connections: [
    { 
      id: 1, 
      sheet_name: 'Form Đăng Ký Tư Vấn Facebook', 
      spreadsheet_id: '1BxiMvs0XRYFgwnK_zH', 
      webhook_token: 'tok_demo1234', 
      is_active: 1, 
      sync_interval: 15, 
      connection_type: 'sheets',
      require_both_contact: 1,
      last_sync_at: new Date(Date.now() - 300000).toISOString(),
      sync_status: 'idle',
      last_error: null
    },
    { 
      id: 2, 
      sheet_name: 'Landing Page Ưu Đãi Tháng 5', 
      spreadsheet_id: '', 
      webhook_token: 'tok_demo5678', 
      is_active: 1, 
      sync_interval: 0, 
      connection_type: 'landing_page',
      require_both_contact: 0,
      last_sync_at: new Date(Date.now() - 86400000).toISOString(),
      sync_status: 'idle',
      last_error: null
    },
    { 
      id: 3, 
      sheet_name: 'Form Đăng Ký Học Thử Google (Demo Lỗi)', 
      spreadsheet_id: '1InvalidSpreadsheetID_xyz123', 
      webhook_token: 'tok_demo9999', 
      is_active: 1, 
      sync_interval: 5, 
      connection_type: 'sheets',
      require_both_contact: 0,
      last_sync_at: new Date(Date.now() - 600000).toISOString(),
      sync_status: 'error',
      last_error: 'Failed to fetch CSV. HTTP Code: 404. Spreadsheet might be private or invalid.'
    }
  ],

  mappings: [
    { id: 1, connection_id: 1, sheet_column: 'Họ và Tên', system_field: 'name', custom_label: 'Họ Tên KH' },
    { id: 2, connection_id: 1, sheet_column: 'Số điện thoại', system_field: 'phone', custom_label: '' },
    { id: 3, connection_id: 1, sheet_column: 'Dịch vụ quan tâm', system_field: 'note', custom_label: 'Sản phẩm' }
  ],

  settings: {
    company_name: 'DOMATION DEMO COMPANY',
    admin_email: 'admin@domation.net',
    auto_compensate: '1',
    zalo_daily_report_time: '17:00',
    email_provider: 'appscript',
    appscript_webhook_url: 'https://script.google.com/macros/s/AKfycby.../exec',
    frontend_url: 'https://domation.net',
    ses_host: 'email-smtp.us-east-1.amazonaws.com',
    ses_username: 'AKIA...',
    ses_sender_email: 'noreply@domation.net',
    ses_sender_name: 'DOMATION TEAM',
    zalo_bot_token: 'demo_zalo_bot_token',
    zalo_webhook_secret: 'demo_wh_secret',
    zalo_bot_link: 'https://zalo.me/1234567890'
  },

  accounts: [
    { id: 1, name: 'Hải Đăng (Admin)', email: 'admin@domation.net', role: 'admin', is_confirmed: 1, zalo_chat_id: '12345678' },
    { id: 2, name: 'Thanh Thảo (Trợ lý)', email: 'assistant@domation.net', role: 'assistant', is_confirmed: 1, zalo_chat_id: '' },
    { id: 3, name: 'Việt Dũng (Kế toán)', email: 'viewer@domation.net', role: 'viewer', is_confirmed: 0, zalo_chat_id: '' },
  ],

  report_context: {
    lead_name: 'Trần Thị Mai Anh (Demo)',
    lead_phone: '0912 345 678',
    lead_email: 'maianh.tran@gmail.com',
    lead_source: 'Facebook Ads — Chiến dịch Demo',
    lead_type: 'Tư vấn khóa học',
    lead_note: 'Quan tâm: Khóa Marketing\nNgân sách: 5–10 triệu',
    consultant_name: 'Nguyễn Văn A',
    consultant_email: 'nguyenvana@domation.net',
    round_name: 'Vòng A — Facebook Inbound',
    assigned_at: new Date().toISOString(),
    existing_report: null,
  }
};
