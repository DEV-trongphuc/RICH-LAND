
import { MOCK_DB, resetMockDb } from './mockDataDb';

// Utility to simulate network latency
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const processMockRequest = async (action: string, payload?: any): Promise<any> => {
  await delay(300 + Math.random() * 400); // 300-700ms latency

  console.log('[MOCK API INTERCEPT]', action, payload);

  const actionName = action.split('&')[0];

  switch (actionName) {
    case 'reset_demo':
      resetMockDb();
      return { success: true, message: 'Đã thiết lập lại cơ sở dữ liệu demo thành công.' };

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
          successful: 110,
          reminder: 32,
          error: 12
        },
        rounds: [
          {
            round_id: 1,
            round_name: "Vòng Phân Bổ: Facebook & TikTok Ads",
            total_count: 94,
            successful_count: 70,
            reminder_count: 18,
            error_count: 6
          },
          {
            round_id: 2,
            round_name: "Vòng Phân Bổ: Google Ads & Website",
            total_count: 60,
            successful_count: 40,
            reminder_count: 14,
            error_count: 6
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

    case 'check_lead_duplicate':
      {
        const params = new URLSearchParams(action.includes('&') ? action.substring(action.indexOf('&') + 1) : '');
        const input = params.get('input') || '';
        const isDup = input.includes('0945473306') || input.toLowerCase().includes('test');
        return {
          success: true,
          duplicate_check_months: 6,
          crm_check: {
            isDuplicate: isDup,
            monthsSinceLastInteraction: isDup ? 3 : 0,
            assignedName: isDup ? 'Hải Đăng' : 'Không rõ',
            lastInteractionDate: isDup ? '2026-05-10 10:00:00' : null
          },
          history: isDup ? [
            {
              id: 1042,
              name: 'Nguyễn Văn Trùng',
              phone: input,
              email: input.includes('@') ? input : 'trung@gmail.com',
              source: 'Facebook Ads',
              round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads',
              status: 'active',
              consultant_name: 'Hải Đăng',
              consultant_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
              created_at: '2026-05-10 10:00:00',
              last_interaction_date: '2026-05-10 10:00:00'
            }
          ] : []
        };
      }

    case 'reject_report':
      return { success: true, message: 'Đã từ chối (Demo)' };

    case 'preview_routing':
      return {
        success: true,
        round_id: 1,
        consultant: { consultant_id: 1, name: 'Hải Đăng', round_name: 'Vòng Phân Bổ: Facebook & TikTok Ads' }
      };

    case 'manual_insert_lead':
      {
        const data = payload?.data || {};
        const overrideConsId = payload?.override_consultant_id;
        const overrideRoundId = payload?.override_round_id || 1;

        const newId = Math.floor(Math.random() * 10000) + 3000;
        
        // Find assigned consultant
        let assignedConsultant = MOCK_DB.fairShareStats.consultants.find(c => String(c.id) === String(overrideConsId));
        if (!assignedConsultant) {
          assignedConsultant = MOCK_DB.fairShareStats.consultants.find(c => c.round_id === Number(overrideRoundId)) 
            || MOCK_DB.fairShareStats.consultants[0];
        }

        if (assignedConsultant) {
          // Increment stats
          assignedConsultant.assigned_count += 1;
          const leadSource = data.source || 'Facebook Ads';
          
          if (!(assignedConsultant as any).sources) {
            (assignedConsultant as any).sources = {} as any;
          }
          (assignedConsultant.sources as any)[leadSource] = ((assignedConsultant.sources as any)[leadSource] || 0) + 1;
          MOCK_DB.fairShareStats.totalLeads += 1;

          // Add to heldLeads
          MOCK_DB.heldLeads.unshift({
            id: newId,
            name: data.name || 'Khách hàng nhập tay',
            phone: data.phone || '',
            email: data.email || '',
            source: leadSource,
            status: 'active',
            ai_screener_status: 'passed',
            ai_evaluation: 'Giao số trực tiếp thành công.',
            note: data.note || '',
            created_at: new Date().toISOString(),
            target_round_id: assignedConsultant.round_id,
            round_name: assignedConsultant.round_name,
            consultant_name: assignedConsultant.name,
            consultant_avatar: assignedConsultant.avatar
          });

          // Add to logs
          MOCK_DB.logs.unshift({
            id: newId,
            lead_name: data.name || 'Khách hàng nhập tay',
            phone: data.phone || '',
            email: data.email || '',
            source: leadSource,
            type: data.type || 'Tư vấn',
            note: data.note || '',
            status: 'assigned',
            assigned_to_name: assignedConsultant.name,
            round_name: assignedConsultant.round_name,
            created_at: new Date().toISOString(),
            report_status: null
          });

          // Update Dashboard
          MOCK_DB.dashboard.total_today += 1;
          MOCK_DB.dashboard.distributed_today += 1;
          MOCK_DB.dashboard.distributed_assigned += 1;

          const dbCons = MOCK_DB.dashboard.topConsultants.find(c => c.id === assignedConsultant.id);
          if (dbCons) {
            dbCons.data += 1;
          }

          const dbRound = MOCK_DB.dashboard.roundRatio.find(r => r.round === assignedConsultant.round_name);
          if (dbRound) {
            dbRound.count += 1;
          }

          const srcStat = MOCK_DB.dashboard.leadSourceStats.find(s => s.name === leadSource);
          if (srcStat) {
            srcStat.value += 1;
          }
        }

        return { success: true, message: 'Đã thêm thành công (Demo)' };
      }

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

    case 'get_gatekeeper_stats':
      return {
        success: true,
        stats: MOCK_DB.gatekeeperStats,
        rounds_breakdown: MOCK_DB.gatekeeperRounds,
        sources_breakdown: MOCK_DB.gatekeeperSources,
        reasons_breakdown: MOCK_DB.gatekeeperReasons,
        recent_below_standard: MOCK_DB.gatekeeperRecent
      };

    case 'get_held_leads':
      {
        const params = new URLSearchParams(action.includes('&') ? action.substring(action.indexOf('&') + 1) : '');
        const statusParam = params.get('status') || 'pending_approval';
        const searchParam = (params.get('search') || '').toLowerCase();
        
        let filtered = [...MOCK_DB.heldLeads];
        
        // Filter by status matching the backend filter logic:
        if (statusParam === 'rejected') {
          filtered = filtered.filter(l => l.status === 'rejected' || l.status === 'blacklisted');
        } else if (statusParam === 'approved') {
          filtered = filtered.filter(l => l.status === 'active');
        } else if (statusParam === 'ai_pending') {
          filtered = filtered.filter(l => l.ai_screener_status === 'pending');
        } else {
          // queue (pending_approval)
          filtered = filtered.filter(l => l.status === 'pending_approval' && l.ai_screener_status !== 'pending');
        }

        if (searchParam) {
          filtered = filtered.filter(l => 
            l.name.toLowerCase().includes(searchParam) || 
            l.phone.includes(searchParam) || 
            (l.email && l.email.toLowerCase().includes(searchParam))
          );
        }

        // Calculate tab counts
        const allLeads = MOCK_DB.heldLeads;
        const queueCount = allLeads.filter(l => l.status === 'pending_approval' && l.ai_screener_status !== 'pending').length;
        const aiPendingCount = allLeads.filter(l => l.ai_screener_status === 'pending').length;
        const substandardCount = allLeads.filter(l => l.status === 'rejected' || l.status === 'blacklisted').length;
        const assignedCount = allLeads.filter(l => l.status === 'active').length;

        return {
          success: true,
          data: filtered,
          total_count: filtered.length,
          admin_avatars: {
            'Admin Demo': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
            'AI Screener': 'https://crm-domation.vercel.app/LOGO.jpg'
          },
          counts: {
            queue: queueCount,
            ai_pending: aiPendingCount,
            substandard: substandardCount,
            assigned: assignedCount
          }
        };
      }

    case 'preview_held_lead_assignment':
      {
        const params = new URLSearchParams(action.includes('&') ? action.substring(action.indexOf('&') + 1) : '');
        const roundId = Number(params.get('round_id') || '1');
        const consultant = MOCK_DB.fairShareStats.consultants.find(c => c.round_id === roundId) || MOCK_DB.fairShareStats.consultants[0];
        return {
          success: true,
          consultant: { consultant_id: consultant.id, name: consultant.name, round_name: consultant.round_name, avatar: consultant.avatar }
        };
      }

    case 'approve_held_lead':
      {
        const leadId = Number(payload?.lead_id);
        const roundId = Number(payload?.round_id || 1);
        const reason = payload?.reason || '';
        
        // Find lead in heldLeads
        const lead = MOCK_DB.heldLeads.find(l => l.id === leadId);
        if (lead) {
          lead.status = 'active';
          lead.ai_screener_status = 'passed';
          lead.note += `\n[Duyệt AI]: Phê duyệt bởi Admin | Admin: Admin Demo | Lúc: ${new Date().toISOString()} | Lý do: ${reason}`;
          
          // Find consultant
          const assignedConsultant = MOCK_DB.fairShareStats.consultants.find(c => c.round_id === roundId) 
            || MOCK_DB.fairShareStats.consultants.find(c => c.id === 1);
            
          if (assignedConsultant) {
            lead.consultant_name = assignedConsultant.name;
            lead.consultant_avatar = assignedConsultant.avatar;
            lead.round_name = assignedConsultant.round_name;
            
            // Increment statistics
            assignedConsultant.assigned_count += 1;
            if (!(assignedConsultant as any).sources) {
              (assignedConsultant as any).sources = {};
            }
            (assignedConsultant as any).sources[lead.source] = ((assignedConsultant as any).sources[lead.source] || 0) + 1;
            MOCK_DB.fairShareStats.totalLeads += 1;
            
            // Increment dashboard
            MOCK_DB.dashboard.total_today += 1;
            MOCK_DB.dashboard.distributed_today += 1;
            MOCK_DB.dashboard.distributed_assigned += 1;
            
            const dashboardConsultant = MOCK_DB.dashboard.topConsultants.find(c => c.id === assignedConsultant.id);
            if (dashboardConsultant) {
              dashboardConsultant.data += 1;
            }
            
            const dashboardRound = MOCK_DB.dashboard.roundRatio.find(r => r.round === assignedConsultant.round_name);
            if (dashboardRound) {
              dashboardRound.count += 1;
            }
            
            const srcStat = MOCK_DB.dashboard.leadSourceStats.find(s => s.name === lead.source);
            if (srcStat) {
              srcStat.value += 1;
            }
            
            // Decrement gatekeeper held count
            MOCK_DB.gatekeeperStats.total_held = Math.max(0, MOCK_DB.gatekeeperStats.total_held - 1);
            
            // Add history log
            MOCK_DB.logs.unshift({
              id: lead.id,
              lead_name: lead.name,
              phone: lead.phone,
              email: lead.email,
              source: lead.source,
              type: (lead as any).type || 'Tư vấn',
              note: lead.note,
              status: 'assigned',
              assigned_to_name: assignedConsultant.name,
              round_name: assignedConsultant.round_name,
              created_at: new Date().toISOString(),
              report_status: null
            });
          }
        }
        return { success: true, message: 'Đã duyệt và phân bổ lead thành công (Demo)' };
      }

    case 'reject_held_lead':
      {
        const leadId = Number(payload?.lead_id);
        const reason = payload?.reason || '';
        const lead = MOCK_DB.heldLeads.find(l => l.id === leadId);
        if (lead) {
          lead.status = 'rejected';
          lead.note += `\n[Từ chối AI]: Đánh dấu dưới chuẩn | Admin: Admin Demo | Lúc: ${new Date().toISOString()} | Lý do: ${reason}`;
          
          MOCK_DB.dashboard.errors += 1;
          MOCK_DB.dashboard.under_standard += 1;
          
          MOCK_DB.gatekeeperStats.total_held = Math.max(0, MOCK_DB.gatekeeperStats.total_held - 1);
          MOCK_DB.gatekeeperStats.total_rejected += 1;
        }
        return { success: true, message: 'Đã xác nhận dưới chuẩn thành công (Demo)' };
      }

    case 'blacklist_held_lead':
      {
        const leadId = Number(payload?.lead_id);
        const reason = payload?.reason || '';
        const lead = MOCK_DB.heldLeads.find(l => l.id === leadId);
        if (lead) {
          lead.status = 'blacklisted';
          lead.note += `\n[Bị chặn bởi Admin] Lý do: ${reason} | Lúc: ${new Date().toISOString()}`;
          
          MOCK_DB.dashboard.errors += 1;
          MOCK_DB.dashboard.blacklists += 1;
          
          MOCK_DB.gatekeeperStats.total_held = Math.max(0, MOCK_DB.gatekeeperStats.total_held - 1);
          MOCK_DB.gatekeeperStats.total_rejected += 1;
        }
        return { success: true, message: 'Đã chặn số và đưa vào Blacklist thành công (Demo)' };
      }

    case 'get_lead_notification_status':
      return {
        success: true,
        data: {
          lead_id: payload?.lead_id || 1,
          email: {
            queued: true,
            status: 'sent',
            id: null,
            target: 'haidang@domation.net',
            sent_at: new Date().toISOString()
          },
          zalo: {
            queued: true,
            status: 'sent',
            id: null,
            target: '9082348234',
            sent_at: new Date().toISOString()
          }
        }
      };

    case 'get_fair_share_stats':
      return {
        success: true,
        data: MOCK_DB.fairShareStats
      };

    case 'get_consultant_compensation_details':
      {
        const params = new URLSearchParams(action.includes('&') ? action.substring(action.indexOf('&') + 1) : '');
        const cId = Number(params.get('consultant_id') || '1');
        const consultant = MOCK_DB.fairShareStats.consultants.find(c => c.id === cId) || MOCK_DB.fairShareStats.consultants[0];
        
        return {
          success: true,
          data: {
            consultant_id: cId,
            name: consultant.name,
            avatar: consultant.avatar,
            total_assigned: consultant.assigned_count,
            total_compensation_received: consultant.compensation_count,
            breakdown: {
              ticket: consultant.ticket_count,
              ticket_details: [
                { admin_name: 'Admin Demo', admin_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150', created_at: new Date(Date.now() - 3600000).toISOString(), reason: 'Duyệt ticket báo trùng số điện thoại' },
                { admin_name: 'Admin Demo', admin_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150', created_at: new Date(Date.now() - 7200000).toISOString(), reason: 'Duyệt ticket báo sai số điện thoại' }
              ],
              blacklist: 2,
              blacklist_details: [
                { admin_name: 'AI Screener', admin_avatar: 'https://crm-domation.vercel.app/LOGO.jpg', created_at: new Date(Date.now() - 18000000).toISOString(), reason: 'Chặn số blacklist spam' }
              ],
              reassign: 1,
              reassign_details: [
                { admin_name: 'Admin Demo', admin_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150', created_at: new Date(Date.now() - 86400000).toISOString(), reason: 'Thu hồi chuyển lead cho Sale khác' }
              ],
              active_total: consultant.compensation_count - 3 > 0 ? consultant.compensation_count - 3 : 1,
              active_details: [
                { reason: 'Bù chủ động do lỗi hệ thống', count: 1, admin_name: 'Admin Demo', admin_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150', created_at: new Date(Date.now() - 172800000).toISOString() }
              ]
            }
          }
        };
      }

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
    case 'update_round_ratios':
      return { success: true, message: 'Thao tác thành công (Demo Mode)' };

    default:
      return { success: true, data: [] };
  }
};
