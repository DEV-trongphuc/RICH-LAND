export const INITIAL_MOCK_DB = {
  dashboard: {
    total_today: 1542,
    total_change: '+12%',
    distributed_today: 1400,
    distributed_change: '+8%',
    distributed_assigned: 1200,
    distributed_compensation: 200,
    duplicates: 85,
    duplicates_change: '-5%',
    errors: 45,
    errors_change: '-2%',
    ticket_errors: 15,
    under_standard: 20,
    blacklists: 10,
    ai_passed_count: 950,
    ai_failed_count: 50,
    ai_screener_enabled: 1,
    accepted_today: 1400,
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
      { id: 1, name: 'Hải Đăng', email: 'haidang@domation.net', data: 450, percent: 85, color: '#3b82f6' },
      { id: 2, name: 'Thanh Thảo', email: 'thanhthao@domation.net', data: 380, percent: 70, color: '#10b981' },
      { id: 3, name: 'Việt Dũng', email: 'vietdung@domation.net', data: 310, percent: 60, color: '#f59e0b' },
      { id: 4, name: 'Minh Tuấn', email: 'minhtuan@domation.net', data: 220, percent: 45, color: '#8b5cf6' },
      { id: 5, name: 'Ngọc Mai', email: 'ngocmai@domation.net', data: 150, percent: 30, color: '#ef4444' }
    ],
    roundRatio: [
      { round: 'Vòng Phân Bổ: Facebook & TikTok Ads', count: 850, percent: 55, color: '#3b82f6' },
      { round: 'Vòng Ưu Tiên: Zalo ZCA & Hotline', count: 420, percent: 30, color: '#8b5cf6' },
      { round: 'Vòng Hỗ Trợ: Organic Search', count: 272, percent: 15, color: '#10b981' }
    ],
    sourceStats: [
      { name: 'Form Đăng Ký Tư Vấn Facebook', value: 850, color: '#8b5cf6' },
      { name: 'Landing Page Ưu Đãi Tháng 5', value: 420, color: '#3b82f6' },
      { name: 'Form Đăng Ký Học Thử Google (Demo Lỗi)', value: 272, color: '#ec4899' }
    ],
    leadSourceStats: [
      { name: 'Facebook Ads', value: 680, color: '#8b5cf6' },
      { name: 'Google Ads', value: 320, color: '#3b82f6' },
      { name: 'Website Direct', value: 150, color: '#ec4899' },
      { name: 'Excel Import', value: 70, color: '#f59e0b' }
    ],
    errorStats: [
      { name: 'Hải Đăng', errors: 12 },
      { name: 'Thanh Thảo', errors: 8 },
      { name: 'Việt Dũng', errors: 5 },
      { name: 'Minh Tuấn', errors: 3 }
    ]
  },
  
  consultants: [
    { id: 1, name: 'Hải Đăng', email: 'haidang@domation.net', status: 'active', zalo_chat_id: '9082348234', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150', vacation_mode: 0, work_start_time: '08:00', work_end_time: '17:30', work_schedule: { "1": { active: true, start: "08:00", end: "17:30" }, "2": { active: true, start: "08:00", end: "17:30" }, "3": { active: true, start: "08:00", end: "17:30" }, "4": { active: true, start: "08:00", end: "17:30" }, "5": { active: true, start: "08:00", end: "17:30" }, "6": { active: true, start: "08:00", end: "17:30" }, "7": { active: false, start: "08:00", end: "17:30" } } },
    { id: 2, name: 'Thanh Thảo', email: 'thanhthao@domation.net', status: 'active', zalo_chat_id: '9183492834', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150', vacation_mode: 0, work_start_time: '08:00', work_end_time: '17:30', work_schedule: { "1": { active: true, start: "08:00", end: "17:30" }, "2": { active: true, start: "08:00", end: "17:30" }, "3": { active: true, start: "08:00", end: "17:30" }, "4": { active: true, start: "08:00", end: "17:30" }, "5": { active: true, start: "08:00", end: "17:30" }, "6": { active: false, start: "08:00", end: "17:30" }, "7": { active: false, start: "08:00", end: "17:30" } } },
    { id: 3, name: 'Việt Dũng', email: 'vietdung@domation.net', status: 'leave', zalo_chat_id: '9843573845', leave_start: '2026-05-18', leave_end: '2026-05-25', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150', vacation_mode: 1, work_start_time: '08:30', work_end_time: '18:00', work_schedule: { "1": { active: true, start: "08:30", end: "18:00" }, "2": { active: true, start: "08:30", end: "18:00" }, "3": { active: true, start: "08:30", end: "18:00" }, "4": { active: true, start: "08:30", end: "18:00" }, "5": { active: true, start: "08:30", end: "18:00" }, "6": { active: true, start: "08:30", end: "18:00" }, "7": { active: false, start: "08:30", end: "18:00" } } },
    { id: 4, name: 'Minh Tuấn', email: 'minhtuan@domation.net', status: 'active', zalo_chat_id: '9238472938', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150', vacation_mode: 0, work_start_time: '08:00', work_end_time: '17:30', work_schedule: { "1": { active: true, start: "08:00", end: "17:30" }, "2": { active: true, start: "08:00", end: "17:30" }, "3": { active: true, start: "08:00", end: "17:30" }, "4": { active: true, start: "08:00", end: "17:30" }, "5": { active: true, start: "08:00", end: "17:30" }, "6": { active: false, start: "08:00", end: "17:30" }, "7": { active: false, start: "08:00", end: "17:30" } } },
    { id: 5, name: 'Ngọc Mai', email: 'ngocmai@domation.net', status: 'inactive', zalo_chat_id: '9123847283', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150', vacation_mode: 0, work_start_time: '08:00', work_end_time: '17:30', work_schedule: { "1": { active: true, start: "08:00", end: "17:30" }, "2": { active: true, start: "08:00", end: "17:30" }, "3": { active: true, start: "08:00", end: "17:30" }, "4": { active: true, start: "08:00", end: "17:30" }, "5": { active: true, start: "08:00", end: "17:30" }, "6": { active: false, start: "08:00", end: "17:30" }, "7": { active: false, start: "08:00", end: "17:30" } } }
  ],

  rounds: [
    { id: 1, round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads', is_active: 1, total_distributed: 850, consultants: 'Hải Đăng, Thanh Thảo, Việt Dũng, Minh Tuấn, Ngọc Mai', consultant_ids: '1,2,3,4,5', next_assigned_name: 'Hải Đăng' },
    { id: 2, round_name: 'Vòng Ưu Tiên: Zalo ZCA & Hotline', is_active: 1, total_distributed: 420, consultants: 'Hải Đăng, Thanh Thảo, Việt Dũng, Minh Tuấn', consultant_ids: '1,2,3,4', next_assigned_name: 'Việt Dũng' },
    { id: 3, round_name: 'Vòng Hỗ Trợ: Organic Search', is_active: 0, total_distributed: 272, consultants: 'Hải Đăng, Thanh Thảo, Việt Dũng', consultant_ids: '1,2,3', next_assigned_name: 'Thanh Thảo' },
  ],

  logs: (() => {
    const vietnameseNames = [
      'Nguyễn Trần Khánh Vy', 'Phạm Minh Hoàng', 'Lê Hải Yến', 'Trần Quốc Bảo', 
      'Đỗ Thùy Chi', 'Ngô Tiến Dũng', 'Vũ Hoài Nam', 'Hoàng Lệ Quyên', 
      'Bùi Anh Tuấn', 'Nguyễn Thanh Tùng', 'Dương Mỹ Linh', 'Phan Văn Hậu', 
      'Trần Thị Mai Anh', 'Nguyễn Đức Huy', 'Lê Minh Khôi', 'Hoàng Diệp Chi',
      'Đặng Hoài Thu', 'Phạm Gia Bảo', 'Vũ Thu Trang', 'Nguyễn Tuấn Kiệt'
    ];
    const sources = ['Facebook Ads', 'Google Ads', 'Website Direct', 'Excel Import'];
    const notes = [
      'Quan tâm khóa học IELTS cấp tốc, cần tư vấn lộ trình học gấp',
      'Đăng ký học thử khóa lập trình React Native, hỏi mức học phí và khuyến mãi',
      'Cần tư vấn gói giải pháp chuyển đổi số cho doanh nghiệp vừa và nhỏ',
      'Tư vấn mua sỉ sản phẩm, muốn nhận bảng chiết khấu đại lý',
      'Muốn đăng ký lớp online buổi tối cho người đi làm bận rộn',
      'Khách hàng từ Google Ads tìm hiểu dịch vụ kế toán thuế trọn gói',
      'Đăng ký nhận tài liệu thiết kế đồ họa UI/UX miễn phí',
      'Quan tâm khóa học giao tiếp tiếng Anh 1 kèm 1 cho người mất gốc'
    ];
    const consultants = ['Hải Đăng', 'Thanh Thảo', 'Việt Dũng', 'Minh Tuấn'];
    const rounds = ['Vòng Phân Bổ: Facebook & TikTok Ads', 'Vòng Ưu Tiên: Zalo ZCA & Hotline', 'Vòng Hỗ Trợ: Organic Search'];

    return Array.from({ length: 100 }).map((_, i) => {
      const name = vietnameseNames[i % vietnameseNames.length];
      const source = sources[i % sources.length];
      const note = notes[i % notes.length];
      const assigned = consultants[i % consultants.length];
      const round = rounds[i % rounds.length];
      const statusSeed = Math.random();
      let status = 'assigned';
      if (statusSeed > 0.85) status = 'compensation';
      else if (statusSeed > 0.75) status = 'reminder';
      else if (statusSeed > 0.65) status = 'error';

      // 3 days window
      const date = new Date(Date.now() - Math.floor(i / 10) * 3600000 * 6 - (i % 10) * 1800000);
      
      return {
        id: 2000 - i,
        lead_name: name,
        phone: `09${10000000 + (i * 7654321) % 90000000}`,
        email: `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "")}${i}@demo.com`,
        source,
        type: 'Tư vấn',
        note,
        status,
        assigned_to_name: assigned,
        round_name: round,
        created_at: date.toISOString(),
        report_status: null
      };
    });
  })(),

  tickets: [
    { id: 101, lead_name: 'Nguyễn Trần Khánh Vy', consultant_id: 1, consultant_name: 'Hải Đăng', reason: 'Sai số điện thoại / Số ảo', status: 'pending', created_at: new Date(Date.now() - 3600000).toISOString(), note: 'Gọi toàn thuê bao không liên lạc được nhiều lần' },
    { id: 102, lead_name: 'Phạm Minh Hoàng', consultant_id: 2, consultant_name: 'Thanh Thảo', reason: 'Trùng của người khác', status: 'pending', created_at: new Date(Date.now() - 7200000).toISOString(), note: 'Khách báo đang làm việc với bạn Hải Đăng bên mình' },
    { id: 103, lead_name: 'Lê Hải Yến', consultant_id: 3, consultant_name: 'Việt Dũng', reason: 'Sai số điện thoại / Số ảo', status: 'approved', created_at: new Date(Date.now() - 86400000).toISOString(), note: 'Nhầm số điện thoại, người nghe báo không đăng ký gì', admin_note: 'Đã xác minh và duyệt đền bù data mới' },
    { id: 104, lead_name: 'Trần Quốc Bảo', consultant_id: 4, consultant_name: 'Minh Tuấn', reason: 'Spam ảo / Junk lead', status: 'rejected', created_at: new Date(Date.now() - 172800000).toISOString(), note: 'Khách điền linh tinh chửi bậy hệ thống', admin_note: 'Từ chối vì khách vẫn nghe máy và xác nhận đăng ký tư vấn' },
    { id: 105, lead_name: 'Đỗ Thùy Chi', consultant_id: 1, consultant_name: 'Hải Đăng', reason: 'Không có nhu cầu / Điền nhầm', status: 'approved', created_at: new Date(Date.now() - 43200000).toISOString(), note: 'Khách báo ấn nhầm nút quảng cáo', admin_note: 'Duyệt bù lượt' }
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
    consultant_name: 'Hải Đăng',
    consultant_email: 'haidang@domation.net',
    round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads',
    assigned_at: new Date().toISOString(),
    existing_report: null,
  },

  // Audit and demo mode data enrichment
  gatekeeperStats: {
    total_leads: 1240,
    total_below_standard: 185,
    ratio_below_standard: 14.9,
    total_held: 2,
    total_rejected: 180
  },

  gatekeeperRounds: [
    { round_id: 1, round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads', count: 110 },
    { round_id: 2, round_name: 'Vòng Ưu Tiên: Zalo ZCA & Hotline', count: 50 },
    { round_id: 3, round_name: 'Vòng Hỗ Trợ: Organic Search', count: 25 }
  ],

  gatekeeperSources: [
    { connection_id: 1, source_name: 'Form Đăng Ký Tư Vấn Facebook', count: 95 },
    { connection_id: 2, source_name: 'Landing Page Ưu Đãi Tháng 5', count: 65 },
    { connection_id: 3, source_name: 'Form Đăng Ký Học Thử Google (Demo Lỗi)', count: 25 }
  ],

  gatekeeperReasons: [
    { reason: 'Sai số điện thoại / Số không tồn tại', count: 85 },
    { reason: 'Trùng lặp số điện thoại trong 6 tháng', count: 45 },
    { reason: 'Spam / Junk Lead (Tên rác hoặc chửi bậy)', count: 30 },
    { reason: 'Không có nhu cầu / Điền nhầm', count: 15 },
    { reason: 'Số điện thoại của trẻ em / Chưa đủ tuổi', count: 10 }
  ],

  gatekeeperRecent: [
    { id: 2001, name: 'Nguyễn Hoàng Nam', phone: '0901234567', email: 'namnh@gmail.com', source: 'Facebook Ads', note: '[Từ chối AI]: Số thuê bao không tồn tại | Admin: AI Screener | Lúc: 2026-05-28 21:00:00', ai_evaluation: 'Số điện thoại không đúng định dạng mạng Mobifone hoặc không liên lạc được.', status: 'rejected', created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads' },
    { id: 2002, name: 'Trần Thị Mỹ Linh', phone: '0918765432', email: 'linhtm@yahoo.com', source: 'Landing Page', note: '[Lưu ý: Trùng số điện thoại đã chia cho Hải Đăng ngày 2026-05-15]', ai_evaluation: 'Trùng lặp liên hệ trong vòng 6 tháng.', status: 'rejected', created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), round_name: 'Vòng Ưu Tiên: Zalo ZCA & Hotline' },
    { id: 2003, name: 'Lê Quốc Anh', phone: '0988111222', email: 'anhle@gmail.com', source: 'Google Ads', note: '[Bị chặn bởi Admin] Lý do: Spam chửi bậy hệ thống', ai_evaluation: 'Chứa từ ngữ không phù hợp hoặc junk content.', status: 'blacklisted', created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), round_name: 'Vòng Hỗ Trợ: Organic Search' }
  ],

  heldLeads: [
    {
      id: 2001,
      name: 'Nguyễn Hoàng Nam',
      phone: '0901234567',
      email: 'namnh@gmail.com',
      source: 'Facebook Ads',
      status: 'pending_approval',
      ai_screener_status: 'failed',
      ai_evaluation: 'Số điện thoại không đúng định dạng mạng Mobifone hoặc không liên lạc được.',
      note: 'Khách đăng ký khóa học tiếng Anh giao tiếp.',
      created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      target_round_id: 1,
      round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads',
      consultant_name: 'Hải Đăng',
      consultant_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150'
    },
    {
      id: 2002,
      name: 'Trần Thị Mỹ Linh',
      phone: '0918765432',
      email: 'linhtm@yahoo.com',
      source: 'Landing Page',
      status: 'pending_approval',
      ai_screener_status: 'failed',
      ai_evaluation: 'Tên không hợp lệ hoặc chứa ký tự đặc biệt, nghi ngờ spam.',
      note: 'Tên đăng ký: linh_spam_123',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      target_round_id: 2,
      round_name: 'Vòng Ưu Tiên: Zalo ZCA & Hotline',
      consultant_name: 'Thanh Thảo',
      consultant_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150'
    },
    {
      id: 2003,
      name: 'Lê Quốc Anh',
      phone: '0988111222',
      email: 'anhle@gmail.com',
      source: 'Google Ads',
      status: 'pending_approval',
      ai_screener_status: 'pending',
      ai_evaluation: 'Đang gửi truy vấn AI Pre-screener...',
      note: 'Yêu cầu tư vấn du học nghề Đức.',
      created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      target_round_id: 3,
      round_name: 'Vòng Hỗ Trợ: Organic Search',
      consultant_name: null,
      consultant_avatar: null
    },
    {
      id: 2004,
      name: 'Vương Hồng Đạt',
      phone: '0922333444',
      email: 'datvuong@hotmail.com',
      source: 'Website Direct',
      status: 'rejected',
      ai_screener_status: 'failed',
      ai_evaluation: 'Số điện thoại nằm trong danh sách đen chặn tự động.',
      note: '[Từ chối AI]: Trùng số spam hệ thống | Admin: AI Screener | Lúc: 2026-05-28 15:00:00',
      created_at: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
      target_round_id: 1,
      round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads',
      consultant_name: 'Việt Dũng',
      consultant_avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150'
    },
    {
      id: 2005,
      name: 'Đỗ Minh Trí',
      phone: '0909999888',
      email: 'tridm@company.com',
      source: 'Excel Import',
      status: 'blacklisted',
      ai_screener_status: 'failed',
      ai_evaluation: 'Chặn số blacklist spam.',
      note: '[Bị chặn bởi Admin] Lý do: Spam cuộc gọi rác nhiều lần',
      created_at: new Date(Date.now() - 1000 * 60 * 400).toISOString(),
      target_round_id: 2,
      round_name: 'Vòng Ưu Tiên: Zalo ZCA & Hotline',
      consultant_name: 'Minh Tuấn',
      consultant_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150'
    },
    {
      id: 2006,
      name: 'Bùi Minh Tuấn',
      phone: '0977222333',
      email: 'tuanbm@gmail.com',
      source: 'Facebook Ads',
      status: 'active',
      ai_screener_status: 'failed',
      ai_evaluation: 'Số điện thoại trùng lặp nhẹ nhưng Admin duyệt ghi đè.',
      note: '[Duyệt AI]: Phê duyệt ghi đè bởi Admin | Admin: Admin Demo | Lúc: 2026-05-28 20:30:00',
      created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      target_round_id: 1,
      round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads',
      consultant_name: 'Hải Đăng',
      consultant_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150'
    }
  ],

  fairShareStats: {
    totalLeads: 1542,
    totalConsultants: 4,
    mean: 385.5,
    standardDeviation: 12.4,
    giniRaw: 0.082,
    giniNormalized: 0.035,
    fairnessIndex: 96.5,
    sources: ['Facebook Ads', 'Google Ads', 'Website Direct', 'Excel Import'],
    lastAssignedId: 1,
    consultants: [
      {
        id: 1,
        name: 'Hải Đăng',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
        receive_ratio: 1,
        round_id: 1,
        round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads',
        assigned_count: 450,
        ticket_count: 5,
        total_ticket_count: 8,
        duplicate_count: 12,
        compensation_count: 4,
        pending_compensation: 2,
        skip_count: 0,
        current_turn_remaining: 0,
        sources: {
          'Facebook Ads': 220,
          'Google Ads': 130,
          'Website Direct': 80,
          'Excel Import': 20
        }
      },
      {
        id: 2,
        name: 'Thanh Thảo',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150',
        receive_ratio: 1,
        round_id: 1,
        round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads',
        assigned_count: 380,
        ticket_count: 3,
        total_ticket_count: 6,
        duplicate_count: 8,
        compensation_count: 3,
        pending_compensation: 1,
        skip_count: 0,
        current_turn_remaining: 0,
        sources: {
          'Facebook Ads': 190,
          'Google Ads': 110,
          'Website Direct': 60,
          'Excel Import': 20
        }
      },
      {
        id: 3,
        name: 'Việt Dũng',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150',
        receive_ratio: 1,
        round_id: 1,
        round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads',
        assigned_count: 310,
        ticket_count: 4,
        total_ticket_count: 5,
        duplicate_count: 6,
        compensation_count: 2,
        pending_compensation: 0,
        skip_count: 0,
        current_turn_remaining: 0,
        sources: {
          'Facebook Ads': 150,
          'Google Ads': 90,
          'Website Direct': 50,
          'Excel Import': 20
        }
      },
      {
        id: 4,
        name: 'Minh Tuấn',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150',
        receive_ratio: 1,
        round_id: 1,
        round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads',
        assigned_count: 220,
        ticket_count: 2,
        total_ticket_count: 4,
        duplicate_count: 4,
        compensation_count: 1,
        pending_compensation: 1,
        skip_count: 0,
        current_turn_remaining: 0,
        sources: {
          'Facebook Ads': 110,
          'Google Ads': 60,
          'Website Direct': 40,
          'Excel Import': 10
        }
      }
    ]
  }
};

export const MOCK_DB: typeof INITIAL_MOCK_DB = JSON.parse(JSON.stringify(INITIAL_MOCK_DB));

export const resetMockDb = () => {
  Object.keys(MOCK_DB).forEach(key => {
    delete (MOCK_DB as any)[key];
  });
  Object.assign(MOCK_DB, JSON.parse(JSON.stringify(INITIAL_MOCK_DB)));
};
