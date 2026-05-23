import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Users, User, CheckCircle, Ticket as TicketIcon, RefreshCw, Zap, Filter, Calendar, Settings2, Save, Bell, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle, Phone, Mail, Clock, Tag, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAPI } from '../utils/api';
import { TableSkeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { Avatar } from '../components/ui/Avatar';
import { useAuth } from '../contexts/AuthContext';

type Lead = {
  id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  assigned_to_name: string;
  assigned_to_avatar?: string;
  round_name: string;
  created_at: string;
  type?: string;
  note?: string;
  report_status?: string;
  resolved_by?: string | null;
  resolved_at?: string | null;
};

const maskPhone = (phone: string) => {
  if (!phone || phone === '-') return phone;
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.length < 8) return phone;
  const start = clean.slice(0, clean.length - 6);
  const end = clean.slice(-3);
  return `${start}***${end}`;
};

const maskEmail = (email: string) => {
  if (!email || email === '-') return email;
  const parts = email.split('@');
  if (parts.length < 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 3) {
    return `${name.slice(0, 1)}***@${domain}`;
  }
  return `${name.slice(0, 3)}***${name.slice(-1)}@${domain}`;
};

const parseNote = (noteText: string) => {
  if (!noteText) return { cleanNote: '', errorNotes: [], blacklistNotes: [] };
  const normalized = noteText.replace(/\\n/g, '\n');
  const lines = normalized.split('\n');
  const cleanLines: string[] = [];
  const errorNotes: string[] = [];
  const blacklistNotes: string[] = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('[LỖI -') || trimmed.startsWith('[LỖI ')) {
      errorNotes.push(trimmed);
    } else if (
      trimmed.startsWith('[Bị chặn bởi') ||
      trimmed.startsWith('[Chặn bởi') ||
      trimmed.toLowerCase().startsWith('[bị chặn bởi') ||
      trimmed.toLowerCase().startsWith('[chặn bởi')
    ) {
      blacklistNotes.push(trimmed);
    } else {
      cleanLines.push(line);
    }
  });
  
  return {
    cleanNote: cleanLines.join('\n').trim(),
    errorNotes,
    blacklistNotes
  };
};

const parseErrorNote = (err: string) => {
  const parts = err.split(' | ');
  let admin = '';
  let time = '';
  
  parts.forEach(part => {
    const trimmed = part.trim();
    if (trimmed.startsWith('Admin duyệt:') || trimmed.startsWith('Admin từ chối:')) {
      admin = trimmed.substring(trimmed.indexOf(':') + 1).trim();
    } else if (trimmed.startsWith('Thời gian:')) {
      time = trimmed.substring(trimmed.indexOf(':') + 1).trim();
    }
  });

  const cleanText = parts.filter(part => {
    const trimmed = part.trim();
    return !trimmed.startsWith('Admin duyệt:') && !trimmed.startsWith('Admin từ chối:') && !trimmed.startsWith('Thời gian:');
  }).join(' | ');

  return { cleanText, admin, time };
};

const parseBlacklistNote = (note: string) => {
  let admin = 'Hệ thống';
  let time = 'Hệ thống';
  let reason = '';

  const adminMatch = note.match(/bởi\s+Admin\s+([^\s]+(?:\s+[^\s]+)*?)(?:\s+lúc|$)/i);
  if (adminMatch && adminMatch[1]) {
    admin = adminMatch[1].trim();
  }

  const timeMatch = note.match(/lúc\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}|\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
  if (timeMatch && timeMatch[1]) {
    time = timeMatch[1].trim();
  }

  const reasonMatch = note.match(/Lý\s+do:\s*(.*?)\]?$/i);
  if (reasonMatch && reasonMatch[1]) {
    reason = reasonMatch[1].trim();
  }

  return { admin, time, reason };
};

export const Tickets = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = (searchParams.get('status') || 'pending') as 'all' | 'pending' | 'approved' | 'rejected';
  const saleFilter = searchParams.get('consultant') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const currentPage = Number(searchParams.get('page') || '1');

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActioning, setIsActioning] = useState<number | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveReason, setApproveReason] = useState('');
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<any>({ pending: 0, approved: 0, rejected: 0, all: 0 });
  const [consultantOptions, setConsultantOptions] = useState<string[]>([]);
  const [allConsultants, setAllConsultants] = useState<any[]>([]);
  const [reassignConsultantId, setReassignConsultantId] = useState<string>('');

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [ticketAutoApprove, setTicketAutoApprove] = useState(false);

  const { user } = useAuth();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [reassignConsId, setReassignConsId] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState<boolean>(false);
  const [confirmReassignOpen, setConfirmReassignOpen] = useState<boolean>(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState<boolean>(false);
  const [blockReason, setBlockReason] = useState<string>('');
  const [compensateBlock, setCompensateBlock] = useState<boolean>(false);
  const [isBlocking, setIsBlocking] = useState<boolean>(false);

  const ITEMS_PER_PAGE = 50;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const updateParams = (key: string, value: string) => {
    setSearchParams(prev => {
      if (value === '' || (key !== 'status' && value === 'all')) prev.delete(key);
      else prev.set(key, value);
      if (key !== 'page') prev.delete('page');
      return prev;
    }, { replace: true });
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(currentPage));
      queryParams.set('pageSize', String(ITEMS_PER_PAGE));
      if (activeFilter !== 'all') queryParams.set('status', activeFilter);
      if (saleFilter) queryParams.set('consultant', saleFilter);
      if (dateFrom) queryParams.set('dateFrom', dateFrom);
      if (dateTo) queryParams.set('dateTo', dateTo);

      const res = await fetchAPI(`get_reports&${queryParams.toString()}`);
      if (res.success) {
        setReports(res.data);
        setTotalCount(res.total_count ?? 0);
        if (res.stats) {
          setStats(res.stats);
          if (!searchParams.get('status') && Number(res.stats.pending) === 0) {
            updateParams('status', 'all');
          }
        }
        if (res.consultants) setConsultantOptions(res.consultants);
      }
    } catch (e: any) {
      toast.error('Lỗi tải ticket: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [searchParams]);

  useEffect(() => {
    fetchAPI('get_settings')
      .then(res => {
        if (res.success && res.data) {
          setTicketAutoApprove(Number(res.data.ticket_auto_approve_enabled) === 1);
        }
      })
      .catch(err => console.error('Lỗi tải cấu hình auto duyệt:', err));

    fetchAPI('get_consultants')
      .then(res => {
        if (res.success && res.data) {
          setAllConsultants(res.data);
        }
      })
      .catch(err => console.error('Lỗi tải danh sách TVV:', err));
  }, []);



  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  // Quick Message State
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [quickMessageTarget, setQuickMessageTarget] = useState<any>(null);
  const [quickMessageText, setQuickMessageText] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  const openApproveModal = (id: number) => {
    setApprovingId(id);
    setApproveReason('');
    setReassignConsultantId('');
    setApproveModalOpen(true);
  };

  const submitApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingId) return;

    setIsActioning(approvingId);
    setApproveModalOpen(false);

    try {
      const res = await fetchAPI('approve_report', {
        method: 'POST',
        body: JSON.stringify({ 
          id: approvingId, 
          approval_reason: approveReason,
          new_consultant_id: reassignConsultantId ? Number(reassignConsultantId) : null
        })
      });
      if (res.success) {
        toast.success('Đã duyệt đền bù Data!');
        window.dispatchEvent(new Event('ticket-resolved'));
        fetchReports();
      } else {
        toast.error(res.message || 'Có lỗi xảy ra');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsActioning(null);
  };

  const openRejectModal = (id: number) => {
    setRejectingId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const submitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId || !rejectReason.trim()) return;

    setIsActioning(rejectingId);
    setRejectModalOpen(false);

    try {
      const res = await fetchAPI('reject_report', {
        method: 'POST',
        body: JSON.stringify({ id: rejectingId, reject_reason: rejectReason })
      });
      if (res.success) {
        toast.success('Đã từ chối báo cáo!');
        window.dispatchEvent(new Event('ticket-resolved'));
        fetchReports();
      } else {
        toast.error(res.message || 'Có lỗi xảy ra');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsActioning(null);
  };

  const handleSendQuickMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMessageText.trim() || !quickMessageTarget) return;
    setIsSendingMsg(true);
    try {
      const res = await fetchAPI('send_quick_zalo_message', {
        method: 'POST',
        body: JSON.stringify({ consultant_id: quickMessageTarget.consultant_id, message: quickMessageText })
      });
      if (res.success) {
        toast.success(res.message || 'Đã gửi tin nhắn thành công!');
        setQuickMessageOpen(false);
        setQuickMessageText('');
      } else {
        toast.error(res.message || 'Lỗi khi gửi tin');
      }
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message);
    }
    setIsSendingMsg(false);
  };

  const handleReassign = async (compensate: boolean = false) => {
    if (!selectedLead || !reassignConsId) return;
    setIsReassigning(true);
    try {
      const res = await fetchAPI('reassign_lead', {
        method: 'POST',
        body: JSON.stringify({
          log_id: selectedLead.id,
          new_consultant_id: Number(reassignConsId),
          compensate_old_sale: compensate
        })
      });
      if (res.success) {
        toast.success(compensate 
          ? 'Giao lại Tư vấn viên & Đền bù thành công!' 
          : 'Giao lại Tư vấn viên thành công!'
        );
        setSelectedLead(null);
        setReassignConsId('');
        setConfirmReassignOpen(false);
        fetchReports();
        window.dispatchEvent(new CustomEvent('lead-added'));
      } else {
        toast.error('Lỗi: ' + (res.message || 'Không thể giao lại'));
      }
    } catch (err: any) {
      toast.error('Đã xảy ra lỗi: ' + err.message);
    }
    setIsReassigning(false);
  };

  const handleBlockLead = async () => {
    if (!selectedLead) return;
    if (!blockReason.trim()) {
      toast.error('Vui lòng nhập lý do chặn.');
      return;
    }
    setIsBlocking(true);
    try {
      const res = await fetchAPI('block_lead', {
        method: 'POST',
        body: JSON.stringify({
          log_id: selectedLead.id,
          compensate_sale: compensateBlock,
          reason: blockReason.trim()
        })
      });
      if (res.success) {
        toast.success('Chặn khách hàng và đưa vào Blacklist thành công!');
        setSelectedLead(null);
        setConfirmBlockOpen(false);
        setBlockReason('');
        setCompensateBlock(false);
        fetchReports();
        window.dispatchEvent(new CustomEvent('lead-added'));
      } else {
        toast.error('Lỗi: ' + (res.message || 'Không thể chặn khách hàng'));
      }
    } catch (err: any) {
      toast.error('Đã xảy ra lỗi: ' + err.message);
    }
    setIsBlocking(false);
  };

  // Since pagination and filters are handled server-side, reports are already filtered
  const filteredReports = reports;

  const pendingCount = stats.pending;
  const hasActiveFilters = saleFilter || dateFrom || dateTo;

  const FILTER_TABS = [
    { key: 'pending', label: 'Chờ duyệt', color: '#b45309', bg: '#fef3c7' },
    { key: 'approved', label: 'Đã duyệt', color: '#065f46', bg: '#d1fae5' },
    { key: 'rejected', label: 'Đã từ chối', color: '#6b7280', bg: '#f3f4f6' },
    { key: 'all', label: 'Tất cả', color: 'var(--color-text)', bg: 'var(--color-bg)' },
  ] as const;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <TicketIcon size={28} color="var(--color-primary)" /> Ticket Lỗi Data
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Quản lý và xét duyệt các BÁO CÁO DATA từ Tư vấn viên
          </p>
        </div>
        <div className="mobile-filter-tabs" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => updateParams('status', tab.key)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: activeFilter === tab.key ? tab.color : 'var(--color-border)', background: activeFilter === tab.key ? tab.bg : 'transparent', color: activeFilter === tab.key ? tab.color : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
              {tab.label} {`(${stats[tab.key]})`}
            </button>
          ))}
          <button onClick={fetchReports} disabled={loading} title="Làm mới" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            title="Thiết lập thông báo Ticket"
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-primary)',
              background: 'rgba(124,58,237,0.08)', cursor: 'pointer',
              color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 5,
              fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s'
            }}
          >
            <Settings2 size={14} /> Cài đặt thông báo
          </button>

          <div style={{
            background: pendingCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: pendingCount > 0 ? 'var(--color-danger)' : '#10b981',
            padding: '8px 16px', borderRadius: 20, fontSize: '0.875rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4
          }}>
            {pendingCount > 0 ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            {pendingCount} chờ duyệt
          </div>
        </div>
      </div>

      {/* Mobile Filter Toggle */}
      <div className="mobile-only" style={{ marginBottom: '1rem' }}>
        <button className="btn outline" onClick={() => setShowMobileFilters(!showMobileFilters)} style={{ width: '100%', justifyContent: 'center', background: 'var(--color-surface)', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>
          <Filter size={16} /> {showMobileFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
        </button>
      </div>

      {/* ── Filter bar: Sale + Date ── */}
      <div className={!showMobileFilters ? 'hide-on-mobile' : ''} style={{
        display: 'flex', gap: 10, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center',
        padding: '14px 18px',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(99,102,241,0.04) 100%)',
        border: '1px solid rgba(124,58,237,0.15)',
        borderRadius: 16,
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 12px rgba(124,58,237,0.06), inset 0 1px 0 rgba(255,255,255,0.8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7c3aed', fontWeight: 700, fontSize: '0.8rem' }}>
          <Filter size={14} />
          <span>Bộ lọc</span>
        </div>

        <div style={{ width: 1, height: 20, background: 'rgba(124,58,237,0.2)', margin: '0 4px' }} />

        {/* Sale filter */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <CustomSelect
            options={[
              { value: '', label: 'Tất cả Sale', icon: <Users size={16} /> },
              ...consultantOptions.map(name => ({
                value: name,
                label: name,
                avatar: ''
              }))
            ]}
            value={saleFilter}
            onChange={val => updateParams('consultant', val.toString())}
            showAvatars={true}
            searchable={true}
            width={200}
          />
        </div>

        {/* Date from */}
        <div className="mobile-flex-wrap mobile-flex-1" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="mobile-flex-1" style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 130 }}>
            <Calendar size={13} style={{ position: 'absolute', left: 9, color: dateFrom ? '#7c3aed' : '#94a3b8', zIndex: 1, pointerEvents: 'none' }} />
            <input
              type="date"
              value={dateFrom}
              onChange={e => updateParams('dateFrom', e.target.value)}
              className="mobile-w-full"
              style={{
                fontSize: '0.8rem', padding: '7px 10px 7px 28px',
                borderRadius: 10,
                border: '1.5px solid',
                borderColor: dateFrom ? '#7c3aed' : 'rgba(124,58,237,0.2)',
                background: dateFrom ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.7)',
                color: dateFrom ? '#5b21b6' : '#64748b',
                outline: 'none',
                fontWeight: dateFrom ? 700 : 400,
                boxShadow: dateFrom ? '0 0 0 3px rgba(124,58,237,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
            />
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>→</span>
          <div className="mobile-flex-1" style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 130 }}>
            <Calendar size={13} style={{ position: 'absolute', left: 9, color: dateTo ? '#7c3aed' : '#94a3b8', zIndex: 1, pointerEvents: 'none' }} />
            <input
              type="date"
              value={dateTo}
              onChange={e => updateParams('dateTo', e.target.value)}
              className="mobile-w-full"
              style={{
                fontSize: '0.8rem', padding: '7px 10px 7px 28px',
                borderRadius: 10,
                border: '1.5px solid',
                borderColor: dateTo ? '#7c3aed' : 'rgba(124,58,237,0.2)',
                background: dateTo ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.7)',
                color: dateTo ? '#5b21b6' : '#64748b',
                outline: 'none',
                fontWeight: dateTo ? 700 : 400,
                boxShadow: dateTo ? '0 0 0 3px rgba(124,58,237,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
            />
          </div>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button onClick={() => {
            setSearchParams(prev => {
              prev.delete('consultant');
              prev.delete('dateFrom');
              prev.delete('dateTo');
              prev.delete('page');
              return prev;
            }, { replace: true });
          }}
            style={{
              fontSize: '0.75rem', padding: '6px 12px', borderRadius: 10,
              border: '1.5px solid #fca5a5', background: 'linear-gradient(135deg,#fff5f5,#fee2e2)',
              color: '#dc2626', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              boxShadow: '0 1px 4px rgba(220,38,38,0.12)',
              transition: 'all 0.15s'
            }}>
            ✕ Xóa lọc
          </button>
        )}

        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {/* Auto duyệt Toggle */}
          <div 
            onClick={() => navigate('/settings?tab=processing#auto-approve')}
            title="Cấu hình quy tắc tự động duyệt"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 8,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(124,58,237,0.05)';
              const label = e.currentTarget.querySelector('.auto-approve-label') as HTMLSpanElement;
              if (label) label.style.color = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              const label = e.currentTarget.querySelector('.auto-approve-label') as HTMLSpanElement;
              if (label) label.style.color = 'var(--color-text-muted)';
            }}
          >
            <span 
              className="auto-approve-label"
              style={{ 
                fontSize: '0.8rem', 
                fontWeight: 700, 
                color: 'var(--color-text-muted)',
                transition: 'color 0.2s',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted'
              }}
            >
              Auto duyệt
            </span>
            <div 
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: ticketAutoApprove ? 'var(--color-success)' : 'rgba(148,163,184,0.3)',
                position: 'relative', transition: 'background 0.2s',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{
                position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%',
                background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                left: ticketAutoApprove ? 19 : 3, transition: 'left 0.2s'
              }} />
            </div>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(124,58,237,0.15)' }} />

          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, background: 'rgba(255,255,255,0.6)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(124,58,237,0.1)' }}>
            Tổng cộng: {totalCount} tickets
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : filteredReports.length === 0 ? (
          <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <CheckCircle size={40} color="#10b981" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
              {hasActiveFilters ? 'Không có kết quả phù hợp' : 'Chưa có báo cáo lỗi nào'}
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto' }}>
              {hasActiveFilters ? 'Thử thay đổi bộ lọc để tìm kết quả khác.' : 'Hệ thống đang hoạt động trơn tru. Các báo cáo lỗi Data từ Sale sẽ hiển thị tại đây.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="mobile-table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Thông tin Lead</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Tư vấn viên</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Vòng phân bổ</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Lý do lỗi</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(r => (
                  <tr 
                    key={r.id} 
                    onClick={() => {
                      setSelectedLead({
                        id: r.log_id || 0,
                        name: r.lead_name,
                        phone: r.lead_phone,
                        email: r.lead_email || '-',
                        source: r.lead_source || '-',
                        status: r.log_status || 'assigned',
                        assigned_to_name: r.consultant_name,
                        assigned_to_avatar: r.consultant_avatar,
                        round_name: r.round_name || '-',
                        created_at: r.log_received_at || r.created_at,
                        type: r.lead_type || '-',
                        note: r.lead_note || '',
                        report_status: r.status,
                        resolved_by: r.resolved_by,
                        resolved_at: r.resolved_at
                      });
                    }}
                    style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', background: 'transparent', cursor: 'pointer' }}
                    className="lead-row"
                  >
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar name={r.lead_name} size={36} color="#7c3aed" />
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{r.lead_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                            <span>{r.lead_phone}</span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: 2 }}>
                            {new Date(r.created_at).toLocaleString('vi-VN')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', fontWeight: 500 }}>
                        <Avatar src={r.consultant_avatar} name={r.consultant_name} size={24} /> {r.consultant_name}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      {r.round_name && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(124,58,237,0.08)', color: 'var(--color-primary)', padding: '3px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>
                          <Zap size={12} /> {r.round_name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>{r.reason}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: r.status !== 'pending' ? 6 : 0 }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: r.status === 'pending' ? '#fef3c7' : r.status === 'approved' ? '#d1fae5' : '#f3f4f6',
                          color: r.status === 'pending' ? '#b45309' : r.status === 'approved' ? '#065f46' : '#6b7280'
                        }}>
                          {r.status === 'pending' ? 'Chờ duyệt' : r.status === 'approved' ? 'Đã duyệt' : 'Từ chối'}
                        </div>
                        {r.status === 'rejected' && r.reject_reason && (
                          <div style={{ fontSize: '0.75rem', color: '#dc2626', background: '#fee2e2', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                            Lý do: {r.reject_reason}
                          </div>
                        )}
                        {r.status === 'approved' && r.approval_reason && (
                          <div style={{ fontSize: '0.75rem', color: '#065f46', background: '#d1fae5', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                            Lý do: {r.approval_reason}
                          </div>
                        )}
                      </div>
                      {r.status !== 'pending' && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span>
                            {r.status === 'approved' ? 'Duyệt' : 'Từ chối'} bởi: <strong style={{ color: 'var(--color-text-muted)' }}>{r.resolved_by || 'Hệ thống'}</strong>
                          </span>
                          {r.resolved_at && (
                            <>
                              <span style={{ opacity: 0.5 }}>•</span>
                              <span>{new Date(r.resolved_at).toLocaleString('vi-VN')}</span>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      {r.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {r.zalo_chat_id && (
                            <button onClick={(e) => { e.stopPropagation(); setQuickMessageTarget({ id: r.consultant_id, name: r.consultant_name }); setQuickMessageOpen(true); }} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: '#0068ff' }} title="Nhắn Zalo Bot cho Sale">
                              <Bell size={14} />
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); openRejectModal(r.id); }} disabled={isActioning === r.id} className="btn outline sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', boxShadow: 'none' }}>
                            Từ chối
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openApproveModal(r.id); }} disabled={isActioning === r.id} className="btn primary sm" style={{ background: '#10b981', borderColor: '#10b981', boxShadow: 'none' }}>
                            {isActioning === r.id ? 'Đang xử lý...' : 'Duyệt & Đền Bù'}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                          {r.zalo_chat_id && (
                            <button onClick={(e) => { e.stopPropagation(); setQuickMessageTarget({ id: r.consultant_id, name: r.consultant_name }); setQuickMessageOpen(true); }} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: '#0068ff' }} title="Nhắn Zalo Bot cho Sale">
                              <Bell size={14} />
                            </button>
                          )}
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: r.status === 'approved' ? '#10b981' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, background: r.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-bg)', padding: '6px 12px', borderRadius: 20 }}>
                            {r.status === 'approved' ? <><CheckCircle size={14} /> Đã Đền Bù</> : 'Đã Từ chối'}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 0 && (
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', flexShrink: 0 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Hiển thị <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</span> trên <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{totalCount}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                onClick={() => updateParams('page', String(Math.max(currentPage - 1, 1)))}
                disabled={currentPage === 1}
                style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: currentPage === 1 ? 'var(--color-bg)' : 'var(--color-surface)', color: currentPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={16} />
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let startPage = 1;
                  if (totalPages > 5) {
                    if (currentPage > 3) {
                      startPage = currentPage - 2;
                      if (startPage + 4 > totalPages) {
                        startPage = totalPages - 4;
                      }
                    }
                  }
                  const pageNum = startPage + i;
                  return (
                     <button
                       key={pageNum}
                       onClick={() => updateParams('page', pageNum.toString())}
                       style={{ 
                         width: 32, height: 32, borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                         border: currentPage === pageNum ? 'none' : '1px solid var(--color-border)',
                         background: currentPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                         color: currentPage === pageNum ? 'white' : 'var(--color-text)',
                         cursor: 'pointer'
                       }}
                     >
                       {pageNum}
                     </button>
                  );
                })}
              </div>
              <button 
                onClick={() => updateParams('page', String(Math.min(currentPage + 1, totalPages)))}
                disabled={currentPage === totalPages || totalPages === 0}
                style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: currentPage === totalPages || totalPages === 0 ? 'var(--color-bg)' : 'var(--color-surface)', color: currentPage === totalPages || totalPages === 0 ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      <TicketSettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      {/* Reject Modal */}
      <CustomModal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title="Từ chối Báo cáo Lỗi">
        <form onSubmit={submitReject}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Vui lòng nhập lý do từ chối để Tư vấn viên biết lý do không được đền bù Data:
            </p>
            <div className="form-group">
              <label className="form-label">Lý do từ chối <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <textarea
                className="form-input"
                placeholder="Ví dụ: Khách bảo có nhu cầu nhưng Sale tư vấn chưa tốt..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
                autoFocus
                style={{ minHeight: 80, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setRejectModalOpen(false)}>Hủy</button>
              <button type="submit" className="btn primary" style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} disabled={isActioning !== null}>
                {isActioning ? 'Đang xử lý...' : 'Xác nhận Từ chối'}
              </button>
            </div>
          </div>
        </form>
      </CustomModal>

      {/* Quick Message Modal */}
      <CustomModal isOpen={quickMessageOpen} onClose={() => setQuickMessageOpen(false)} title={`Nhắn tin cho ${quickMessageTarget?.name || 'Sale'}`}>
        <form onSubmit={handleSendQuickMessage}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>Tin nhắn sẽ được tự động gửi qua Zalo Bot (nếu có) và Email với tiêu đề [ TIN NHẮN TỪ QUẢN TRỊ VIÊN ]</p>
            <div className="form-group">
              <label className="form-label">Nội dung tin nhắn <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <textarea
                className="form-input"
                placeholder="Nhập nội dung cần thông báo cho Sale..."
                value={quickMessageText}
                onChange={e => setQuickMessageText(e.target.value)}
                required
                autoFocus
                style={{ minHeight: 100, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setQuickMessageOpen(false)}>Hủy</button>
              <button type="submit" className="btn primary" disabled={isSendingMsg} style={{ background: '#0068ff', borderColor: '#0068ff' }}>
                {isSendingMsg ? 'Đang gửi...' : 'Gửi tin nhắn'}
              </button>
            </div>
          </div>
        </form>
      </CustomModal>

      {/* Approve Modal */}
      <CustomModal isOpen={approveModalOpen} onClose={() => setApproveModalOpen(false)} title="Duyệt & Đền Bù Data">
        <form onSubmit={submitApprove}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn DUYỆT báo cáo lỗi này và ĐỀN BÙ 1 lượt nhận Data tiếp theo cho Sale không? Hành động này sẽ cộng thêm chỉ số đền bù vào vòng xoay Round-Robin ngay lập tức.
            </p>
            <div className="form-group">
              <label className="form-label">Lý do duyệt (không bắt buộc)</label>
              <textarea
                className="form-input"
                placeholder="Ví dụ: Đã kiểm tra đúng là khách hàng trùng hoặc thuê bao..."
                value={approveReason}
                onChange={(e) => setApproveReason(e.target.value)}
                autoFocus
                style={{ minHeight: 80, resize: 'vertical' }}
              />
            </div>
            {reports.find(r => Number(r.id) === Number(approvingId))?.reason?.includes('Trùng của người khác') && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                  Nhắc lại cho TVV khác (Tùy chọn)
                </label>
                <CustomSelect
                  options={[
                    { value: '', label: 'Không nhắc lại cho TVV khác', icon: null },
                    ...allConsultants
                      .filter(c => {
                        const currentReport = reports.find(r => Number(r.id) === Number(approvingId));
                        return Number(c.id) !== Number(currentReport?.consultant_id) && c.status === 'active';
                      })
                      .map(c => ({
                        value: String(c.id),
                        label: c.name,
                        sublabel: c.email,
                        avatar: ''
                      }))
                  ]}
                  value={reassignConsultantId}
                  onChange={(val) => setReassignConsultantId(val ? String(val) : '')}
                  showAvatars={true}
                  searchable={true}
                  placeholder="Chọn TVV khác..."
                  width="100%"
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Chọn TVV này nếu đây là lỗi trùng và muốn chuyển Lead sang cho họ (Không tính vòng chia số).
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setApproveModalOpen(false)}>Hủy</button>
              <button type="submit" className="btn primary" style={{ background: '#10b981', borderColor: '#10b981' }} disabled={isActioning !== null}>
                {isActioning ? 'Đang xử lý...' : 'Xác nhận duyệt'}
              </button>
            </div>
          </div>
        </form>
      </CustomModal>

      {/* Customer Detail Modal */}
      <CustomModal
        isOpen={selectedLead !== null}
        onClose={() => {
          setSelectedLead(null);
          setReassignConsId('');
        }}
        title="Chi tiết Khách hàng"
        width="850px"
      >
        {selectedLead && (
          <div style={{ padding: '1.5rem', background: 'white' }}>
            <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem' }}>
              {/* Cột Trái: Chi Tiết */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <Avatar name={selectedLead.name} size={48} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{selectedLead.name}</h2>
                      {user?.role === 'admin' && selectedLead.status !== 'blacklisted' && (
                        <button
                          onClick={() => {
                            setCompensateBlock(selectedLead.assigned_to_name !== '-');
                            setConfirmBlockOpen(true);
                          }}
                          title="Chặn & Blacklist khách hàng này"
                          style={{
                            background: '#fee2e2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            color: '#ef4444',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            lineHeight: 1,
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={e => {
                            e.currentTarget.style.background = '#fca5a5';
                            e.currentTarget.style.color = '#b91c1c';
                          }}
                          onMouseOut={e => {
                            e.currentTarget.style.background = '#fee2e2';
                            e.currentTarget.style.color = '#ef4444';
                          }}
                        >
                          <AlertTriangle size={12} />
                          Chặn
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>ID: #{selectedLead.id}</div>
                  </div>
                </div>

                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Phone size={14} /> Phone</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {user?.role === 'admin' ? selectedLead.phone : maskPhone(selectedLead.phone)}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Mail size={14} /> Email</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {user?.role === 'admin' ? selectedLead.email : maskEmail(selectedLead.email)}
                    </div>
                  </div>
                </div>

                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><ExternalLink size={14} /> Nguồn Data</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.source}</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Tag size={14} /> Trạng thái</div>
                    <div>
                      {selectedLead.status === 'assigned' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-success-light)', color: 'var(--color-success)' }}>Đã chia</span>}
                      {selectedLead.status === 'compensation' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#e0e7ff', color: '#4f46e5' }}>Data Bù</span>}
                      {selectedLead.status === 'pending_work_hours' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#ffedd5', color: '#ea580c' }}>Chờ giờ làm</span>}
                      {selectedLead.status === 'error' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>Bị Lỗi</span>}
                      {selectedLead.status === 'pending' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>Chờ chia</span>}
                      {selectedLead.status === 'reminder' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#fce7f3', color: '#db2777' }}>Nhắc lại</span>}
                      {selectedLead.status === 'duplicate' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>Trùng lặp</span>}
                      {selectedLead.status === 'rule_6_month' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Quy định 6 tháng</span>}
                      {selectedLead.status === 'silent' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#e2e8f0', color: '#475569' }}>Chỉ đồng bộ</span>}
                      {selectedLead.status === 'blacklisted' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#fee2e2', color: '#ef4444' }}>Blacklist</span>}
                    </div>
                  </div>
                </div>

                {(() => {
                  const { cleanNote, errorNotes, blacklistNotes } = parseNote(selectedLead.note || '');
                  return (
                    <>
                      {/* Clean Note Card */}
                      <div style={{ 
                        background: 'linear-gradient(135deg, #fefce8 0%, #fffbeb 100%)', 
                        border: '1px solid #fef3c7',
                        padding: '1.25rem', 
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: '0 4px 15px rgba(245, 158, 11, 0.03)'
                      }}
                      className="premium-alert-card"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            background: '#fef3c7',
                            padding: '8px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#d97706'
                          }}>
                            <Tag size={18} strokeWidth={2.5} />
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#92400e', letterSpacing: '-0.01em' }}>Ghi chú & Phân loại</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '0.85rem', color: '#78350f' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: '#b45309', marginRight: '6px' }}>Loại Data:</span>
                            <span style={{ fontWeight: 600 }}>{selectedLead.type !== '-' ? selectedLead.type : 'Không có'}</span>
                          </div>
                          
                          <div style={{ borderTop: '1px dashed rgba(217, 119, 6, 0.15)', paddingTop: '8px', marginTop: '4px' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: '#b45309', display: 'block', marginBottom: '4px' }}>Nội dung ghi chú:</span>
                            <div style={{ fontSize: '0.875rem', color: '#451a03', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontWeight: 500 }}>
                              {cleanNote ? cleanNote : <em style={{ color: '#b45309', opacity: 0.6 }}>Không có ghi chú thêm</em>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Error Notes (Approved / Rejected) */}
                      {errorNotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          {errorNotes.map((err, index) => {
                            const isApproved = err.includes('DUYỆT');
                            
                            // Rich harmonious color palettes
                            const colors = isApproved ? {
                              gradient: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                              border: '1px solid #a7f3d0',
                              glow: '0 4px 15px rgba(16, 185, 129, 0.04)',
                              accent: '#10b981',
                              title: '#065f46',
                              text: '#047857',
                              badgeBg: '#d1fae5',
                              badgeText: '#065f46',
                              badgeBorder: '1px solid #a7f3d0',
                              iconBg: '#d1fae5',
                            } : {
                              gradient: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
                              border: '1px solid #fecaca',
                              glow: '0 4px 15px rgba(244, 63, 94, 0.04)',
                              accent: '#f43f5e',
                              title: '#9f1239',
                              text: '#be123c',
                              badgeBg: '#ffe4e6',
                              badgeText: '#9f1239',
                              badgeBorder: '1px solid #fca5a5',
                              iconBg: '#ffe4e6',
                            };

                            const IconComponent = isApproved ? CheckCircle2 : XCircle;

                            const { cleanText, admin: noteAdmin, time: noteTime } = parseErrorNote(err);
                            const displayAdmin = noteAdmin || selectedLead?.resolved_by || 'Hệ thống';
                            
                            let displayTime = noteTime;
                            if (!displayTime) {
                              if (selectedLead?.resolved_at) {
                                try {
                                  const dt = new Date(selectedLead.resolved_at.replace(/-/g, '/'));
                                  if (!isNaN(dt.getTime())) {
                                    displayTime = dt.toLocaleString('vi-VN');
                                  } else {
                                    displayTime = selectedLead.resolved_at;
                                  }
                                } catch (e) {
                                  displayTime = selectedLead.resolved_at;
                                }
                              } else {
                                displayTime = 'Hệ thống';
                              }
                            }

                            let cleanMsg = cleanText;
                            if (cleanMsg.startsWith('[LỖI -')) {
                              const bracketIndex = cleanMsg.indexOf(']');
                              if (bracketIndex !== -1) {
                                cleanMsg = cleanMsg.substring(bracketIndex + 1).trim();
                                if (cleanMsg.startsWith(':')) {
                                  cleanMsg = cleanMsg.substring(1).trim();
                                }
                              }
                            }

                            const msgParts = cleanMsg.split(' | ');
                            const coreError = msgParts[0] || '';
                            const actionReason = msgParts[1] || '';

                            return (
                              <div key={index} style={{ 
                                background: colors.gradient, 
                                border: colors.border,
                                boxShadow: colors.glow,
                                padding: '1.25rem', 
                                borderRadius: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                position: 'relative'
                              }}
                              className="premium-alert-card"
                              >
                                {/* Top header info */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                      background: colors.iconBg,
                                      padding: '8px',
                                      borderRadius: '10px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: colors.accent
                                    }}>
                                      <IconComponent size={18} strokeWidth={2.5} />
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.title, letterSpacing: '-0.01em' }}>
                                      {isApproved ? 'Thông tin lỗi - Đã Duyệt' : 'Thông tin lỗi - Từ Chối'}
                                    </span>
                                  </div>
                                  <span style={{ 
                                    fontSize: '0.7rem', 
                                    fontWeight: 700, 
                                    color: colors.badgeText, 
                                    background: colors.badgeBg, 
                                    border: colors.badgeBorder,
                                    padding: '3px 8px', 
                                    borderRadius: '8px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}>
                                    {isApproved ? 'Đã duyệt' : 'Từ chối'}
                                  </span>
                                </div>

                                {/* Content block */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 500, lineHeight: 1.5 }}>
                                    Lỗi: <span style={{ fontWeight: 600, color: colors.text }}>{coreError}</span>
                                  </div>
                                  {actionReason && (
                                    <div style={{ 
                                      fontSize: '0.85rem', 
                                      color: '#475569', 
                                      fontWeight: 400, 
                                      lineHeight: 1.5,
                                      background: 'rgba(255, 255, 255, 0.4)',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: '1px dashed rgba(0, 0, 0, 0.05)',
                                      marginTop: 2
                                    }}>
                                      <strong>Lý do từ chối / Duyệt:</strong> {actionReason.trim()}
                                    </div>
                                  )}
                                </div>

                                {/* Footer metadata */}
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '12px', 
                                  paddingTop: '0.75rem', 
                                  marginTop: '0.25rem',
                                  borderTop: '1px solid rgba(0, 0, 0, 0.04)', 
                                  flexWrap: 'wrap'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#64748b' }}>
                                    <User size={13} style={{ opacity: 0.7 }} />
                                    <span>Xử lý bởi: <strong style={{ color: '#334155' }}>{displayAdmin}</strong></span>
                                  </div>
                                  <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>•</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#64748b' }}>
                                    <Clock size={13} style={{ opacity: 0.7 }} />
                                    <span>Thời gian: <strong style={{ color: '#334155' }}>{displayTime}</strong></span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Blacklist Notes */}
                      {blacklistNotes && blacklistNotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          {blacklistNotes.map((note, index) => {
                            const parsed = parseBlacklistNote(note);
                            const blacklistColors = {
                              gradient: 'linear-gradient(135deg, #fff1f2 0%, #fff5f5 100%)',
                              border: '1px solid #fecaca',
                              glow: '0 4px 15px rgba(244, 63, 94, 0.04)',
                              accent: '#f43f5e',
                              title: '#9f1239',
                              text: '#be123c',
                              badgeBg: '#ffe4e6',
                              badgeText: '#9f1239',
                              badgeBorder: '1px solid #fca5a5',
                              iconBg: '#ffe4e6',
                            };

                            return (
                              <div key={index} style={{ 
                                background: blacklistColors.gradient, 
                                border: blacklistColors.border,
                                boxShadow: blacklistColors.glow,
                                padding: '1.25rem', 
                                borderRadius: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                position: 'relative'
                              }}
                              className="premium-alert-card"
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                      background: blacklistColors.iconBg,
                                      padding: '8px',
                                      borderRadius: '10px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: blacklistColors.accent
                                    }}>
                                      <ShieldAlert size={18} strokeWidth={2.5} />
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: blacklistColors.title, letterSpacing: '-0.01em' }}>
                                      Thông tin chặn (Blacklist)
                                    </span>
                                  </div>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 700, 
                                    color: blacklistColors.badgeText, 
                                    background: blacklistColors.badgeBg, 
                                    border: blacklistColors.badgeBorder,
                                    padding: '3px 8px', 
                                    borderRadius: '8px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                  }}>
                                    Bị Chặn
                                  </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {parsed.reason && (
                                    <div style={{ 
                                      fontSize: '0.875rem', 
                                      color: '#1e293b', 
                                      fontWeight: 500, 
                                      lineHeight: 1.5,
                                      background: 'rgba(255, 255, 255, 0.4)',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: '1px dashed rgba(0, 0, 0, 0.05)'
                                    }}>
                                      <strong>Lý do chặn:</strong> <span style={{ color: blacklistColors.text, fontWeight: 600 }}>{parsed.reason}</span>
                                    </div>
                                  )}
                                </div>

                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '12px', 
                                  paddingTop: '0.75rem', 
                                  marginTop: '0.25rem',
                                  borderTop: '1px solid rgba(0, 0, 0, 0.04)', 
                                  flexWrap: 'wrap'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#64748b' }}>
                                    <User size={13} style={{ opacity: 0.7 }} />
                                    <span>Chặn bởi: <strong style={{ color: '#334155' }}>{parsed.admin}</strong></span>
                                  </div>
                                  <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>•</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#64748b' }}>
                                    <Clock size={13} style={{ opacity: 0.7 }} />
                                    <span>Thời gian: <strong style={{ color: '#334155' }}>{parsed.time}</strong></span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Cột Phải: Phân bổ */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>Thông tin Phân bổ</h3>
                
                {selectedLead.assigned_to_name !== '-' ? (
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar src={selectedLead.assigned_to_avatar} name={selectedLead.assigned_to_name} size={24} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Người tiếp nhận</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{selectedLead.assigned_to_name}</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> Vòng chia</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.round_name}</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Clock size={12} /> Thời gian nhận</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.created_at}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: 12, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Chưa có thông tin phân bổ cho Khách hàng này.
                  </div>
                )}

                {/* Giao lại Tư vấn viên */}
                {user?.role === 'admin' && (
                  <div style={{ marginTop: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={16} color="var(--color-primary)" /> Giao lại Tư vấn viên
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
                      Thay đổi người tiếp nhận (Không ảnh hưởng lượt chia).
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <CustomSelect 
                        options={[
                          { value: '', label: '-- Chọn Tư vấn viên --' },
                          ...allConsultants
                            .filter(c => c.status === 'active')
                            .map(c => ({
                              value: c.id.toString(),
                              label: c.name,
                              avatar: ''
                            }))
                        ]}
                        value={reassignConsId}
                        onChange={val => setReassignConsId(val.toString())}
                        showAvatars={true}
                        searchable={true}
                        width="100%"
                        direction="up"
                      />
                      <button 
                        className="btn primary" 
                        onClick={() => setConfirmReassignOpen(true)}
                        disabled={isReassigning || !reassignConsId}
                        style={{ height: 38, background: 'var(--color-primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, padding: '0 1rem', fontSize: '0.875rem', fontWeight: 700, width: '100%' }}
                      >
                        {isReassigning ? <RefreshCw size={14} className="spin" /> : null}
                        Xác nhận giao
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        )}
      </CustomModal>

      {/* Confirm Reassign Modal */}
      <CustomModal
        isOpen={confirmReassignOpen}
        onClose={() => setConfirmReassignOpen(false)}
        title="Xác nhận Giao lại Lead"
        width={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', 
              color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p style={{ color: 'var(--color-text)', lineHeight: 1.6, fontSize: '0.9375rem', margin: 0 }}>
                Bạn có chắc chắn muốn chuyển quyền chăm sóc Lead <strong>"{selectedLead?.name}"</strong> sang cho Tư vấn viên <strong>"{allConsultants.find(c => Number(c.id) === Number(reassignConsId))?.name}"</strong>?
              </p>
              {selectedLead?.assigned_to_name && selectedLead.assigned_to_name !== '-' && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 8, marginBottom: 0 }}>
                  Lead này hiện đang thuộc về: <strong>{selectedLead.assigned_to_name}</strong>. Bạn muốn bù data cho <strong>{selectedLead.assigned_to_name}</strong> chứ?
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="btn outline" onClick={() => setConfirmReassignOpen(false)}>Hủy</button>
            
            {selectedLead?.assigned_to_name && selectedLead.assigned_to_name !== '-' ? (
              <>
                <button 
                  className="btn secondary" 
                  onClick={() => handleReassign(false)}
                  style={{ background: '#f59e0b', color: '#fff', border: 'none' }}
                  disabled={isReassigning}
                >
                  Chuyển luôn, Không bù
                </button>
                <button 
                  className="btn success" 
                  onClick={() => handleReassign(true)}
                  style={{ background: '#10b981', color: '#fff', border: 'none' }}
                  disabled={isReassigning}
                >
                  Chuyển & Bù cho sale cũ
                </button>
              </>
            ) : (
              <button 
                className="btn primary" 
                onClick={() => handleReassign(false)}
                disabled={isReassigning}
              >
                Xác nhận chuyển
              </button>
            )}
          </div>
        </div>
      </CustomModal>

      {/* Confirm Block Modal */}
      <CustomModal
        isOpen={confirmBlockOpen}
        onClose={() => {
          setConfirmBlockOpen(false);
          setBlockReason('');
          setCompensateBlock(false);
        }}
        title="Xác nhận Chặn & Blacklist"
        width="550px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: '50%', background: '#fee2e2', 
              color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p style={{ color: 'var(--color-text)', lineHeight: 1.6, fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>
                Bạn có chắc chắn muốn chặn khách hàng "{selectedLead?.name}"?
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 4, marginBottom: 0 }}>
                Số điện thoại/Email của khách hàng sẽ được thêm vào Blacklist toàn cục để chặn nhận trùng trong tương lai.
              </p>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Hình thức chặn:</div>
            
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="blockType" 
                checked={!compensateBlock} 
                onChange={() => setCompensateBlock(false)} 
                style={{ marginTop: '3px' }}
              />
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Chỉ đưa vào danh sách đen (Blacklist)</span>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>Không thực hiện đền bù data cho Sale.</p>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: selectedLead?.assigned_to_name === '-' ? 'not-allowed' : 'pointer', opacity: selectedLead?.assigned_to_name === '-' ? 0.5 : 1 }}>
              <input 
                type="radio" 
                name="blockType" 
                checked={compensateBlock} 
                onChange={() => setCompensateBlock(true)} 
                disabled={selectedLead?.assigned_to_name === '-'}
                style={{ marginTop: '3px' }}
              />
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Chặn và Bù vòng cho Sale</span>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                  Đền bù 1 lượt data vòng <strong>"{selectedLead?.round_name}"</strong> cho Sale <strong>"{selectedLead?.assigned_to_name}"</strong>.
                </p>
              </div>
            </label>
            
            {selectedLead?.assigned_to_name === '-' && (
              <div style={{ color: '#ea580c', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} /> Lead chưa phân bổ cho Sale nào, không thể chọn hình thức Bù vòng.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Lý do chặn <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Nhập lý do chặn (ví dụ: Số điện thoại ảo, khách không có nhu cầu, spam...)"
              style={{
                width: '100%',
                height: '80px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                fontSize: '0.875rem',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button 
              className="btn outline" 
              onClick={() => {
                setConfirmBlockOpen(false);
                setBlockReason('');
                setCompensateBlock(false);
              }}
              disabled={isBlocking}
            >
              Hủy
            </button>
            <button 
              className="btn danger" 
              onClick={handleBlockLead}
              disabled={isBlocking || !blockReason.trim()}
              style={{ background: '#ef4444', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {isBlocking ? <RefreshCw size={14} className="spin" /> : null}
              Xác nhận chặn
            </button>
          </div>
        </div>
      </CustomModal>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .lead-row:hover { background: var(--color-bg) !important; }
      `}</style>

    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// TicketSettingsModal — Chọn admin nhận email thông báo Ticket
// ─────────────────────────────────────────────────────────────
const TicketSettingsModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    Promise.all([
      fetchAPI('get_accounts'),
      fetchAPI('get_ticket_settings')
    ]).then(([accRes, settingsRes]) => {
      if (accRes.success) setAccounts(accRes.data);
      if (settingsRes.success) setSelectedIds((settingsRes.data ?? []).map((id: any) => Number(id)));
    }).catch((e: any) => toast.error('Lỗi tải cấu hình: ' + e.message))
      .finally(() => setLoadingData(false));
  }, [open]);

  const toggle = (id: any) => {
    const numId = Number(id);
    setSelectedIds(prev => prev.includes(numId) ? prev.filter(x => x !== numId) : [...prev, numId]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetchAPI('save_ticket_settings', {
        method: 'POST',
        body: JSON.stringify({ admin_ids: selectedIds })
      });
      if (res.success) {
        toast.success('Đã lưu cài đặt thông báo Ticket!');
        onClose();
      } else {
        toast.error(res.message || 'Lỗi lưu cài đặt');
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <CustomModal isOpen={open} onClose={onClose} title="Cài đặt thông báo Ticket">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loadingData ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Đang tải...</div>
        ) : (
          <>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
              Admin đầu tiên nhận email <strong>To:</strong> — Các admin còn lại nhận <strong>CC:</strong>. Admin phải có email mới có thể được chọn.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '50vh', overflowY: 'auto', paddingRight: 4 }}>
              {accounts.filter((a: any) => a.role === 'admin' || a.role === 'assistant').map((acc: any) => {
                const isSelected = selectedIds.includes(Number(acc.id));
                const noEmail = !acc.email;
                return (
                  <div
                    key={acc.id}
                    onClick={() => !noEmail && toggle(Number(acc.id))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      borderRadius: 'var(--radius-lg)', border: '1px solid',
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      background: isSelected ? 'var(--color-primary-light)' : 'var(--color-bg)',
                      cursor: noEmail ? 'not-allowed' : 'pointer',
                      opacity: noEmail ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.9rem' }}>{acc.name}</div>
                      <div style={{ fontSize: '0.8rem', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)', marginTop: 2 }}>
                        {noEmail
                          ? <span style={{ color: 'var(--color-danger)' }}>⚠ Chưa cài email — không nhận được</span>
                          : acc.email
                        }
                      </div>
                    </div>
                    {/* Role badge */}
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '4px 8px', borderRadius: 'var(--radius-md)', flexShrink: 0,
                      background: acc.role === 'admin' ? 'rgba(124,58,237,0.1)' : 'rgba(16,185,129,0.1)',
                      color: acc.role === 'admin' ? 'var(--color-primary)' : '#10b981'
                    }}>
                      {acc.role === 'admin' ? 'Admin' : 'Assistant'}
                    </span>
                    {/* Toggle switch */}
                    <div style={{
                      width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                      background: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                      position: 'relative', transition: 'background 0.2s', marginLeft: 8
                    }}>
                      <div style={{
                        position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
                        background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        left: isSelected ? 21 : 3, transition: 'left 0.2s'
                      }} />
                    </div>
                  </div>
                );
              })}
              {accounts.filter((a: any) => a.role === 'admin' || a.role === 'assistant').length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Chưa có admin nào trong hệ thống</div>
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button onClick={onClose} className="btn ghost" type="button">Hủy</button>
          <button
            onClick={handleSave}
            disabled={saving || loadingData}
            className="btn primary"
            type="button"
          >
            <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>
    </CustomModal>
  );
};
