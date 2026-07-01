
import { MOCK_DB, resetMockDb } from './mockDataDb';

// Utility to simulate network latency
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const processMockRequest = async (action: string, payload?: any, method = 'GET'): Promise<any> => {
  await delay(300 + Math.random() * 400); // 300-700ms latency

  console.log('[MOCK API INTERCEPT]', action, payload);

  const actionName = action.split('&')[0];
  const normalizedAction = actionName.split('/')[0];

  switch (normalizedAction) {
    case 'reset_demo':
      resetMockDb();
      return { success: true, message: 'Đã thiết lập lại cơ sở dữ liệu demo thành công.' };

    case 'login':
      {
        const email = payload?.email || '';
        if (email.includes('sale') || email.includes('haidang') || email.includes('thao') || email.includes('dung') || email.includes('tuan')) {
          let cId = 1;
          let name = 'Hải Đăng';
          let cEmail = 'haidang@richland.net';
          if (email.includes('thao')) { cId = 2; name = 'Thanh Thảo'; cEmail = 'thanhthao@richland.net'; }
          else if (email.includes('dung')) { cId = 3; name = 'Việt Dũng'; cEmail = 'vietdung@richland.net'; }
          else if (email.includes('tuan')) { cId = 4; name = 'Minh Tuấn'; cEmail = 'minhtuan@richland.net'; }

          return {
            success: true,
            token: `demo_token_sale_${cId}`,
            user: { id: cId, email: cEmail, name: name, role: 'sale', consultant_id: cId, is_confirmed: 1 }
          };
        }

        // Permissive admin login
        return {
          success: true,
          token: 'demo_token_12345',
          user: { id: 1, email: email || 'admin@richland.net', name: 'Admin Demo', role: 'admin', is_confirmed: 1 }
        };
      }

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
      {
        const params = new URLSearchParams(action.includes('&') ? action.substring(action.indexOf('&') + 1) : '');
        const consultantIdStr = params.get('consultant_id');
        let filteredTickets = [...MOCK_DB.tickets];
        if (consultantIdStr) {
          filteredTickets = filteredTickets.filter(t => String(t.consultant_id) === String(consultantIdStr));
        }
        const stats = {
          pending: filteredTickets.filter(t => t.status === 'pending').length,
          approved: filteredTickets.filter(t => t.status === 'approved').length,
          rejected: filteredTickets.filter(t => t.status === 'rejected').length,
          all: filteredTickets.length
        };
        return { 
          success: true, 
          data: filteredTickets, 
          total_count: filteredTickets.length,
          stats
        };
      }

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
            'AI Screener': '/LOGO.jpg'
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
      {
        const params = new URLSearchParams(action.includes('&') ? action.substring(action.indexOf('&') + 1) : '');
        const leadId = Number(params.get('lead_id') || '0');
        const mockLead = MOCK_DB.heldLeads.find(l => l.id === leadId);
        const isPendingWorkHours = mockLead?.status === 'pending_work_hours';

        return {
          success: true,
          data: {
            lead_id: leadId,
            email: {
              queued: true,
              status: isPendingWorkHours ? 'pending' : 'sent',
              id: null,
              target: 'haidang@richland.net',
              sent_at: isPendingWorkHours ? null : new Date().toISOString()
            },
            zalo: {
              queued: true,
              status: isPendingWorkHours ? 'pending' : 'sent',
              id: null,
              target: '9082348234',
              sent_at: isPendingWorkHours ? null : new Date().toISOString()
            }
          }
        };
      }

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
                { admin_name: 'AI Screener', admin_avatar: '/LOGO.jpg', created_at: new Date(Date.now() - 18000000).toISOString(), reason: 'Chặn số blacklist spam' }
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

    case 'get_sale_portal_data':
      {
        const params = new URLSearchParams(action.includes('&') ? action.substring(action.indexOf('&') + 1) : '');
        const search = (params.get('search') || '').toLowerCase();
        const roundIdFilter = params.get('round_id');
        const saleIdFilter = params.get('sale_id');

        const userStr = localStorage.getItem('richland_user');
        const user = userStr ? JSON.parse(userStr) : null;
        const currentSaleId = user?.role === 'sale' ? user?.consultant_id || user?.id : null;
        const targetSaleId = saleIdFilter ? Number(saleIdFilter) : currentSaleId;

        const consultant = MOCK_DB.consultants.find(c => c.id === targetSaleId) || MOCK_DB.consultants[0];
        const consultantName = consultant.name;

        // Filter logs
        let filteredLogs = MOCK_DB.logs.filter(l => l.assigned_to_name === consultantName);

        if (search) {
          filteredLogs = filteredLogs.filter(l => 
            l.lead_name.toLowerCase().includes(search) || 
            l.phone.includes(search) || 
            (l.email && l.email.toLowerCase().includes(search))
          );
        }

        if (roundIdFilter) {
          const rId = Number(roundIdFilter);
          filteredLogs = filteredLogs.filter(l => {
            const matchRound = MOCK_DB.rounds.find(r => r.id === rId);
            return matchRound ? l.round_name === matchRound.round_name : true;
          });
        }

        // Map logs to leads structure expected by SalePortal
        const leads = filteredLogs.map(l => {
          const ticket = MOCK_DB.tickets.find(t => t.lead_name === l.lead_name);
          return {
            log_id: l.id,
            received_at: l.created_at,
            status: l.status,
            message: l.note,
            round_id: l.round_name.includes('Facebook') ? 1 : l.round_name.includes('Zalo') ? 2 : 3,
            assigned_to: consultant.id,
            lead_id: l.id,
            lead_name: l.lead_name,
            phone: l.phone,
            lead_email: l.email,
            source: l.source,
            type: l.type,
            note: l.note,
            is_accepted: l.status === 'assigned' ? 0 : 1,
            accepted_at: l.status === 'assigned' ? null : l.created_at,
            last_interaction_date: l.created_at,
            round_name: l.round_name,
            sale_name: l.assigned_to_name,
            sale_email: `${l.assigned_to_name.toLowerCase().replace(/\s+/g, '')}@richland.net`,
            sale_avatar: consultant.avatar,
            report_status: ticket ? ticket.status : null,
            report_id: ticket ? ticket.id : null,
            report_reason: ticket ? ticket.reason : null,
            report_reject_reason: ticket ? ticket.admin_note : null,
            report_created_at: ticket ? ticket.created_at : null,
            lead_recall_minutes: 15,
            connection_name: l.source === 'Facebook Ads' ? 'Form Đăng Ký Tư Vấn Facebook' : 'Landing Page Ưu Đãi Tháng 5'
          };
        });

        // 2. Query distinct rounds consultant is in
        const consultantRounds = MOCK_DB.rounds.filter(r => r.consultant_ids.split(',').includes(String(consultant.id)));

        // 3. Ticket stats under active date filter
        const consultantTickets = MOCK_DB.tickets.filter(t => t.consultant_id === consultant.id);
        const ticketsTotal = consultantTickets.length;
        const ticketsApproved = consultantTickets.filter(t => t.status === 'approved').length;
        const ticketsRejected = consultantTickets.filter(t => t.status === 'rejected').length;
        const ticketsPending = consultantTickets.filter(t => t.status === 'pending').length;

        // 4. Query distribution by round
        const validLeads = leads.filter(l => l.status !== 'reminder');
        const byRoundMap: Record<string, number> = {};
        validLeads.forEach(l => {
          byRoundMap[l.round_name] = (byRoundMap[l.round_name] || 0) + 1;
        });
        const byRound = Object.entries(byRoundMap).map(([round_name, count]) => ({ round_name, count }));

        // 5. Query distribution by hour
        const byHour = Array(24).fill(0);
        validLeads.forEach(l => {
          if (l.received_at) {
            const hr = new Date(l.received_at).getHours();
            byHour[hr] = (byHour[hr] || 0) + 1;
          }
        });

        // Active consultants if user is admin
        const consultantsList = user?.role === 'admin' ? MOCK_DB.consultants.filter(c => c.status === 'active') : [];

        return {
          success: true,
          leads,
          rounds: consultantRounds,
          consultants: consultantsList,
          consultant_profile: consultant,
          vacation_mode: consultant.vacation_mode,
          lead_recall_minutes: 15,
          below_standard_fallback_round_id: 3,
          below_standard_fallback_round_ids: [3],
          duplicate_check_months: 6,
          report_error_reasons: [
            'Số điện thoại không đúng / Thuê bao',
            'Trùng khách đang chăm sóc / Khách cũ',
            'Sai thông tin khóa học / Điền nhầm',
            'Spam / Junk Lead'
          ],
          is_allowed_to_report: true,
          stats: {
            total_received: validLeads.length,
            tickets_total: ticketsTotal,
            tickets_approved: ticketsApproved,
            tickets_rejected: ticketsRejected,
            tickets_pending: ticketsPending
          },
          by_round: byRound,
          by_hour: byHour
        };
      }

    case 'get_sale_lead_timeline':
      {
        const params = new URLSearchParams(action.includes('&') ? action.substring(action.indexOf('&') + 1) : '');
        const leadId = Number(params.get('lead_id') || '0');
        const log = MOCK_DB.logs.find(l => l.id === leadId);
        const heldLead = MOCK_DB.heldLeads.find(l => l.id === leadId);
        const name = log?.lead_name || heldLead?.name || 'Khách hàng Demo';
        const phone = log?.phone || heldLead?.phone || '';
        const source = log?.source || heldLead?.source || 'Facebook Ads';
        const roundName = log?.round_name || heldLead?.round_name || 'Vòng Phân Bổ: Facebook & TikTok Ads';
        const assignedName = log?.assigned_to_name || heldLead?.consultant_name || 'Hải Đăng';
        const status = log?.status || heldLead?.status || 'assigned';
        const receivedAt = log?.created_at || heldLead?.created_at || new Date().toISOString();
        const note = log?.note || heldLead?.note || 'Đăng ký tư vấn khóa học';

        const timeline = [];

        timeline.push({
          status: 'Đã nhận từ Webhook',
          round_name: '',
          received_at: new Date(new Date(receivedAt).getTime() - 1000 * 6).toISOString(),
          consultant_name: 'Hệ thống',
          consultant_avatar: '/LOGO.jpg',
          message: `Lead mới từ nguồn ${source} - Tên: ${name}, SĐT: ${phone}`,
          is_ticket: 0
        });

        if (MOCK_DB.dashboard.ai_screener_enabled) {
          timeline.push({
            status: 'AI Pre-screener đánh giá',
            round_name: '',
            received_at: new Date(new Date(receivedAt).getTime() - 1000 * 4).toISOString(),
            consultant_name: 'AI Screener',
            consultant_avatar: '/LOGO.jpg',
            message: status === 'rejected' || status === 'blacklisted' 
              ? `[Từ chối tự động]: Số điện thoại không đạt chuẩn | Lý do: ${heldLead?.ai_evaluation || 'Không liên lạc được'}`
              : `[Đạt chuẩn]: Số điện thoại hợp lệ và không trùng lặp`,
            is_ticket: 0
          });
        }

        let distStatus = 'Đã bàn giao';
        if (status === 'compensation') {
          distStatus = 'Bù lượt';
        } else if (status === 'reminder') {
          distStatus = 'Nhắc trùng';
        } else if (status === 'rejected' || status === 'blacklisted') {
          distStatus = 'Không phân bổ';
        }
        
        timeline.push({
          status: distStatus,
          round_name: roundName,
          received_at: receivedAt,
          consultant_name: assignedName,
          consultant_avatar: null,
          message: `Phân bổ cho ${assignedName} qua ${roundName}. Ghi chú: ${note}`,
          is_ticket: 0
        });

        const ticket = MOCK_DB.tickets.find(t => t.lead_name === name);
        if (ticket) {
          timeline.push({
            is_ticket: 1,
            ticket_status: ticket.status,
            ticket_reason: ticket.reason,
            ticket_reject_reason: ticket.admin_note || null,
            received_at: ticket.created_at
          });
        }

        return {
          success: true,
          timeline: timeline.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime())
        };
      }

    case 'accept_lead':
      {
        const leadId = Number(payload?.lead_id);
        const log = MOCK_DB.logs.find(l => l.id === leadId);
        if (log) {
          log.status = 'accepted';
        }
        const held = MOCK_DB.heldLeads.find(l => l.id === leadId);
        if (held) {
          held.status = 'active';
        }
        return { success: true, message: 'Tiếp nhận lead thành công (Demo)' };
      }

    case 'submit_report':
      {
        const leadId = payload?.lead_id;
        const saleId = payload?.sale_id;
        const reason = payload?.reason || '';
        
        const log = MOCK_DB.logs.find(l => l.id === leadId);
        const name = log ? log.lead_name : 'Khách hàng Demo';
        const consultant = MOCK_DB.consultants.find(c => c.id === saleId) || MOCK_DB.consultants[0];

        const newTicket = {
          id: Math.floor(Math.random() * 1000) + 200,
          lead_name: name,
          consultant_id: consultant.id,
          consultant_name: consultant.name,
          reason: reason,
          status: 'pending',
          created_at: new Date().toISOString(),
          note: 'Báo cáo từ cổng tư vấn viên (Demo)'
        };
        MOCK_DB.tickets.unshift(newTicket);

        MOCK_DB.dashboard.ticket_errors += 1;

        return { 
          success: true, 
          message: 'Gửi báo lỗi thành công (Demo)',
          auto_approved: false 
        };
      }

    case 'toggle_consultant_vacation':
      {
        const id = Number(payload?.id);
        const consultant = MOCK_DB.consultants.find(c => c.id === id);
        let currentVacation = false;
        if (consultant) {
          (consultant as any).vacation_mode = (consultant as any).vacation_mode === 1 ? 0 : 1;
          currentVacation = (consultant as any).vacation_mode === 1;
        }
        return { 
          success: true, 
          message: 'Thay đổi trạng thái Tạm ngưng thành công (Demo)', 
          vacation_mode: currentVacation ? 1 : 0 
        };
      }

    case 'update_consultant_self_profile':
      {
        const userStr = localStorage.getItem('richland_user');
        const user = userStr ? JSON.parse(userStr) : null;
        const currentSaleId = user?.role === 'sale' ? user?.consultant_id || user?.id : null;
        if (currentSaleId) {
          const consultant = MOCK_DB.consultants.find(c => c.id === currentSaleId);
          if (consultant) {
            consultant.name = payload?.name || consultant.name;
            (consultant as any).avatar = payload?.avatar || (consultant as any).avatar;
            (consultant as any).work_start_time = payload?.work_start_time || '08:00';
            (consultant as any).work_end_time = payload?.work_end_time || '17:30';
            (consultant as any).work_schedule = payload?.work_schedule ? JSON.parse(payload.work_schedule) : (consultant as any).work_schedule;
            
            user.name = consultant.name;
            localStorage.setItem('richland_user', JSON.stringify(user));
          }
        }
        return { success: true, message: 'Cập nhật thông tin cá nhân thành công (Demo)' };
      }

    case 'check-ins':
      {
        const params = new URLSearchParams(action.includes('&') ? action.substring(action.indexOf('&') + 1) : '');
        const todayOnly = params.get('today_only') === '1';
        const dateParam = params.get('date');
        const statusParam = params.get('status');
        const userIdParam = params.get('user_id');

        const userStr = localStorage.getItem('richland_user');
        const userObj = userStr ? JSON.parse(userStr) : null;
        const currentUserId = userObj ? userObj.id : null;

        const actionPath = actionName; 
        const pathSegments = actionPath.split('/');
        const idFromPath = pathSegments[1] ? Number(pathSegments[1]) : null;

        if (method === 'GET') {
          if (todayOnly) {
            const row = MOCK_DB.check_ins.find(c => c.user_id === currentUserId && c.check_in_date === '2026-07-01');
            return { success: true, data: row || null };
          }

          let list = (MOCK_DB.check_ins as any[]).map(c => {
            const consultant = MOCK_DB.consultants.find(cons => cons.id === c.user_id);
            return {
              ...c,
              user_name: consultant ? consultant.name : 'Nhân viên Demo',
              user_email: consultant ? consultant.email : 'demo@richland.net',
              user_avatar: consultant ? consultant.avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
              work_start_time: consultant ? consultant.work_start_time : '08:00'
            };
          });

          if (userObj && userObj.role === 'sale') {
            list = list.filter(c => c.user_id === currentUserId);
          } else {
            if (userIdParam) {
              list = list.filter(c => String(c.user_id) === String(userIdParam));
            }
          }

          const monthParam = params.get('month');
          const yearParam = params.get('year') || '2026';

          if (monthParam) {
            list = list.filter(c => {
              const dParts = c.check_in_date.split('-');
              return Number(dParts[0]) === Number(yearParam) && Number(dParts[1]) === Number(monthParam);
            });
          } else if (dateParam && dateParam !== 'all') {
            list = list.filter(c => c.check_in_date === dateParam);
          }

          if (statusParam && statusParam !== 'all') {
            list = list.filter(c => c.status === statusParam);
          }

          return { success: true, data: list };
        }

        if (method === 'POST') {
          const selfieUrl = payload?.selfie_url || '';
          const reason = payload?.reason || '';

          if (!selfieUrl) return { success: false, message: 'Ảnh selfie check-in là bắt buộc' };

          const exists = MOCK_DB.check_ins.find(c => c.user_id === currentUserId && c.check_in_date === '2026-07-01');
          if (exists) return { success: false, message: 'Bạn đã thực hiện check-in hôm nay rồi' };

          const consultant = MOCK_DB.consultants.find(c => c.id === currentUserId);
          const workStartTime = consultant ? consultant.work_start_time : '08:00';

          const now = new Date();
          const curHM = now.toTimeString().substring(0, 5);
          const isLate = curHM > workStartTime;

          let status = 'approved';
          if (isLate) {
            if (!reason) {
              return { success: false, message: 'Bạn đi làm trễ giờ làm việc (' + workStartTime + '). Vui lòng gửi lý do "Xin nhận lead hôm nay" để quản lý phê duyệt.' };
            }
            status = 'pending_approval';
          }

          const newRow = {
            id: MOCK_DB.check_ins.length + 1,
            user_id: currentUserId,
            check_in_date: '2026-07-01',
            check_in_time: now.toTimeString().substring(0, 8),
            selfie_url: selfieUrl,
            status: status,
            reason: reason || null
          };

          MOCK_DB.check_ins.push(newRow);

          return {
            success: true,
            data: {
              id: newRow.id,
              check_in_date: newRow.check_in_date,
              check_in_time: newRow.check_in_time,
              status: newRow.status,
              is_late: isLate
            },
            message: 'Check-in thành công' + (isLate ? ' (Đang chờ quản lý duyệt vì đi trễ)' : '')
          };
        }

        if (method === 'PUT') {
          if (!idFromPath) return { success: false, message: 'ID check-in không hợp lệ' };
          const status = payload?.status || '';
          const reason = payload?.reason || '';

          const row = MOCK_DB.check_ins.find(c => c.id === idFromPath);
          if (!row) return { success: false, message: 'Không tìm thấy bản ghi check-in' };

          row.status = status;
          if (reason) row.reason = reason;

          return { success: true, message: 'Cập nhật trạng thái check-in thành công (Demo)' };
        }

        if (method === 'DELETE') {
          if (!idFromPath) return { success: false, message: 'ID check-in không hợp lệ' };
          const index = MOCK_DB.check_ins.findIndex(c => c.id === idFromPath);
          if (index === -1) return { success: false, message: 'Không tìm thấy bản ghi check-in' };

          MOCK_DB.check_ins.splice(index, 1);
          return { success: true, message: 'Đã xóa bản ghi check-in thành công (Demo)' };
        }

        return { success: false, message: 'Phương thức không được hỗ trợ' };
      }

    case 'get_calendar_stats':
      {
        const params = new URLSearchParams(action.includes('&') ? action.substring(action.indexOf('&') + 1) : '');
        const year = params.get('year') || String(new Date().getFullYear());
        const month = params.get('month') || String(new Date().getMonth() + 1);
        const consultantParam = params.get('consultant') || 'all';

        const stats: Record<string, any> = {};

        MOCK_DB.logs.forEach(l => {
          const date = new Date(l.created_at);
          if (date.getFullYear() === Number(year) && (date.getMonth() + 1) === Number(month)) {
            const dateStr = date.toISOString().split('T')[0];
            
            if (consultantParam !== 'all' && l.assigned_to_name !== consultantParam) {
              return;
            }

            if (!stats[dateStr]) {
              stats[dateStr] = { distributed: 0, blacklist: 0, reminder: 0, error: 0, total: 0, ticket_total: 0, ticket_approved: 0 };
            }

            stats[dateStr].total += 1;
            if (l.status === 'assigned' || l.status === 'compensation') {
              stats[dateStr].distributed += 1;
            } else if (l.status === 'reminder') {
              stats[dateStr].reminder += 1;
            } else if (l.status === 'error') {
              stats[dateStr].error += 1;
            }
          }
        });

        MOCK_DB.tickets.forEach(t => {
          const date = new Date(t.created_at);
          if (date.getFullYear() === Number(year) && (date.getMonth() + 1) === Number(month)) {
            const dateStr = date.toISOString().split('T')[0];

            if (consultantParam !== 'all' && t.consultant_name !== consultantParam) {
              return;
            }

            if (!stats[dateStr]) {
              stats[dateStr] = { distributed: 0, blacklist: 0, reminder: 0, error: 0, total: 0, ticket_total: 0, ticket_approved: 0 };
            }

            stats[dateStr].ticket_total += 1;
            if (t.status === 'approved') {
              stats[dateStr].ticket_approved += 1;
            }
          }
        });

        return { success: true, data: stats };
      }

    case 'get_calendar_day_details':
      {
        const params = new URLSearchParams(action.includes('&') ? action.substring(action.indexOf('&') + 1) : '');
        const dateStr = params.get('date') || '';
        const consultantParam = params.get('consultant') || 'all';

        const dayLogs = MOCK_DB.logs.filter(l => l.created_at.split('T')[0] === dateStr);
        const dayTickets = MOCK_DB.tickets.filter(t => t.created_at.split('T')[0] === dateStr);

        const salesSummary: Record<string, { sale_name: string, sale_avatar: string | null, round_name: string, status: string, count: number }> = {};
        dayLogs.forEach(l => {
          if (consultantParam !== 'all' && l.assigned_to_name !== consultantParam) return;
          if (l.status === 'silent' || l.status === 'error' || l.status === 'blacklisted') return;

          const key = `${l.assigned_to_name}_${l.round_name}_${l.status}`;
          if (!salesSummary[key]) {
            salesSummary[key] = {
              sale_name: l.assigned_to_name,
              sale_avatar: null,
              round_name: l.round_name,
              status: l.status,
              count: 0
            };
          }
          salesSummary[key].count += 1;
        });

        const tickets = dayTickets
          .filter(t => consultantParam === 'all' || t.consultant_name === consultantParam)
          .map(t => ({
            id: t.id,
            lead_name: t.lead_name,
            phone: '09*******',
            sale_name: t.consultant_name,
            sale_avatar: null,
            reason: t.reason,
            status: t.status,
            created_at: t.created_at,
            ai_screener_status: 'passed'
          }));

        const blacklistLogs = dayLogs
          .filter(l => ['blacklisted', 'error', 'no_consultant', 'reminder', 'duplicate'].includes(l.status))
          .filter(l => consultantParam === 'all' || l.assigned_to_name === consultantParam)
          .map(l => ({
            id: l.id,
            lead_name: l.lead_name,
            phone: l.phone,
            email: l.email,
            status: l.status,
            message: l.note,
            received_at: l.created_at,
            ai_screener_status: l.status === 'blacklisted' ? 'failed' : 'passed'
          }));

        return {
          success: true,
          data: {
            sales: Object.values(salesSummary),
            tickets,
            blacklist_logs: blacklistLogs
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
