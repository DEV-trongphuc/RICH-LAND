import { useEffect, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { AlertCircle, Users, User, CheckCircle, Ticket as TicketIcon, RefreshCw, Zap, Filter, Settings2, Save, Bell, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle, Phone, Mail, Clock, Tag, CheckCircle2, XCircle, ShieldAlert, Database, Plus, Trash2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAPI } from '../utils/api';
import { TableSkeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { Avatar } from '../components/ui/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

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
  last_activity_at?: string | null;
  ai_screener_status?: string;
  ai_evaluation?: string;
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
  if (!noteText) return { cleanNote: '', errorNotes: [], blacklistNotes: [], warningNotes: [] };
  const normalized = noteText.replace(/\\n/g, '\n');
  const lines = normalized.split('\n');
  const cleanLines: string[] = [];
  const errorNotes: string[] = [];
  const blacklistNotes: string[] = [];
  const warningNotes: string[] = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (/^(?:Nhập dữ liệu cũ|Nhap du lieu cu)\s*(?:\(Silent\))?$/i.test(trimmed)) {
      return;
    }
    if (trimmed.startsWith('[LỖI -') || trimmed.startsWith('[LỖI ')) {
      errorNotes.push(trimmed);
    } else if (
      trimmed.startsWith('[Bị chặn bởi') ||
      trimmed.startsWith('[Chặn bởi') ||
      trimmed.toLowerCase().startsWith('[bị chặn bởi') ||
      trimmed.toLowerCase().startsWith('[chặn bởi')
    ) {
      blacklistNotes.push(trimmed);
    } else if (
      trimmed.startsWith('[Lưu ý:') ||
      trimmed.startsWith('Lưu ý:') ||
      trimmed.toLowerCase().startsWith('[lưu ý:') ||
      trimmed.toLowerCase().startsWith('lưu ý:') ||
      trimmed.startsWith('[Chú ý:') ||
      trimmed.toLowerCase().startsWith('[chú ý:')
    ) {
      let cleanWarn = trimmed;
      if (cleanWarn.startsWith('[') && cleanWarn.endsWith(']')) {
        cleanWarn = cleanWarn.substring(1, cleanWarn.length - 1).trim();
      }
      warningNotes.push(cleanWarn);
    } else {
      cleanLines.push(line);
    }
  });
  
  return {
    cleanNote: cleanLines.join('\n').trim(),
    errorNotes,
    blacklistNotes,
    warningNotes
  };
};

const extractManualReason = (note: string) => {
  if (!note) return '';
  const normalized = note.replace(/\\n/g, '\n');
  const lines = normalized.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('Bị chặn bởi Admin') || trimmed.includes('Chặn bởi Admin')) {
      const match = trimmed.match(/Lý do:\s*([^\]]+)/i);
      if (match) return match[1].trim();
    }
    if (trimmed.startsWith('[Từ chối AI]:')) {
      const parts = trimmed.substring('[Từ chối AI]:'.length).split('|');
      return parts[0].trim();
    }
    if (trimmed.startsWith('[Xác nhận dưới chuẩn - Fallback]:')) {
      const parts = trimmed.substring('[Xác nhận dưới chuẩn - Fallback]:'.length).split('|');
      return parts[0].trim();
    }
    if (trimmed.startsWith('[Blacklist AI]:')) {
      const parts = trimmed.substring('[Blacklist AI]:'.length).split('|');
      return parts[0].trim();
    }
  }
  return '';
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
  const { t } = useLanguage();
  const location = useLocation();
  const isActive = location.pathname === '/tickets';
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = (searchParams.get('status') || 'pending') as 'all' | 'pending' | 'approved' | 'rejected';
  const saleFilter = searchParams.get('consultant') || '';
  const dateFilter = searchParams.get('date') || 'Tháng này';
  const currentPage = Number(searchParams.get('page') || '1');

  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
  const [allAccounts, setAllAccounts] = useState<any[]>([]);

  const [reassignConsultantId, setReassignConsultantId] = useState<string>('');

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [ticketAutoApprove, setTicketAutoApprove] = useState(false);

  const [ticketAutoApproveRules, setTicketAutoApproveRules] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);

  // Auto-Approve main settings modal
  const [showAutoApproveModal, setShowAutoApproveModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Auto-Approve rule modal (Rule Editor)
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleActive, setRuleActive] = useState(true);
  const [ruleRounds, setRuleRounds] = useState<any[]>(['all']);
  const [ruleSales, setRuleSales] = useState<any[]>(['all']);
  const [ruleConnections, setRuleConnections] = useState<any[]>(['all']);
  const [ruleKeywords, setRuleKeywords] = useState('');

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
  const isTicketLead = selectedLead?.status === 'error' || selectedLead?.report_status === 'approved' || selectedLead?.report_status === 'pending';

  const updateParams = (key: string, value: string) => {
    setSearchParams(prev => {
      if (value === '' || (key !== 'status' && value === 'all')) prev.delete(key);
      else prev.set(key, value);
      if (key !== 'page') prev.delete('page');
      return prev;
    }, { replace: true });
  };

  const getDisplayDateFilterText = (filter: string) => {
    if (filter.includes('đến')) {
      return filter.replace(/\s*đến\s*/i, ` ${t('đến')} `);
    }
    return t(filter);
  };

  const dateOptions = [
    { value: 'all', label: t('Tất cả thời gian') },
    { value: 'Hôm nay', label: t('Hôm nay') },
    { value: 'Hôm qua', label: t('Hôm qua') },
    { value: 'Tuần này', label: t('Tuần này') },
    { value: 'Tuần trước', label: t('Tuần trước') },
    { value: 'Tuần trước nữa', label: t('Tuần trước nữa') },
    { value: '7 ngày qua', label: t('7 ngày qua') },
    { value: '30 ngày qua', label: t('30 ngày qua') },
    { value: 'Tháng này', label: t('Tháng này') },
    { value: 'Tháng trước', label: t('Tháng trước') }
  ];

  const defaultFilters = ['all', 'Hôm nay', 'Hôm qua', 'Tuần này', 'Tuần trước', 'Tuần trước nữa', '7 ngày qua', '30 ngày qua', 'Tháng này', 'Tháng trước', 'Tùy chỉnh'];
  if (!defaultFilters.includes(dateFilter)) {
    dateOptions.push({ value: dateFilter, label: getDisplayDateFilterText(dateFilter) });
  }

  dateOptions.push({ value: 'Tùy chỉnh', label: t('Tùy chỉnh...') });

  const handleCustomDateSubmit = () => {
    if (!startDate || !endDate) {
      toast.error(t("Vui lòng chọn đầy đủ Từ ngày và Đến ngày"));
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error(t("Từ ngày không được lớn hơn Đến ngày"));
      return;
    }
    const label = `${startDate} ${t('đến')} ${endDate}`;
    updateParams('date', label);
    setShowDateModal(false);
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(currentPage));
      queryParams.set('pageSize', String(ITEMS_PER_PAGE));
      if (activeFilter !== 'all') queryParams.set('status', activeFilter);
      if (saleFilter) queryParams.set('consultant', saleFilter);
      if (dateFilter) queryParams.set('date', dateFilter);

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
      toast.error(t('Lỗi tải ticket: ') + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isActive) {
      fetchReports();
    }
  }, [searchParams, isActive]);

  useEffect(() => {
    fetchAPI('get_settings')
      .then(res => {
        if (res.success && res.data) {
          setTicketAutoApprove(Number(res.data.ticket_auto_approve_enabled) === 1);
          if (res.data.ticket_auto_approve_rules) {
            try {
              const parsed = JSON.parse(res.data.ticket_auto_approve_rules);
              if (Array.isArray(parsed)) setTicketAutoApproveRules(parsed);
            } catch (e) {
              console.error('Lỗi parse rule auto duyệt:', e);
            }
          }
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

    fetchAPI('get_accounts')
      .then(res => {
        if (res.success && res.data) {
          setAllAccounts(res.data);
        }
      })
      .catch(err => console.error('Lỗi tải danh sách tài khoản:', err));

    fetchAPI('get_rounds')
      .then(res => {
        if (res.success && res.data) {
          setRounds(res.data);
        }
      })
      .catch(err => console.error('Lỗi tải vòng phân bổ:', err));

    fetchAPI('get_connections')
      .then(res => {
        if (res.success && res.data) {
          setConnections(res.data);
        }
      })
      .catch(err => console.error('Lỗi tải nguồn kết nối:', err));
  }, []);

  const getUserAvatarByName = (name: string) => {
    if (!name || name === 'Hệ thống') return undefined;
    const acc = allAccounts.find(a => (a.name || a.username) === name);
    if (acc?.avatar) return acc.avatar;
    const cons = allConsultants.find(c => c.name === name);
    if (cons?.avatar) return cons.avatar;
    return undefined;
  };



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
        toast.success(t('Đã duyệt đền bù Data!'));
        window.dispatchEvent(new Event('ticket-resolved'));
        fetchReports();
      } else {
        toast.error(res.message || t('Có lỗi xảy ra'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
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
        toast.success(t('Đã từ chối báo cáo!'));
        window.dispatchEvent(new Event('ticket-resolved'));
        fetchReports();
      } else {
        toast.error(res.message || t('Có lỗi xảy ra'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
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
        toast.success(res.message || t('Đã gửi tin nhắn thành công!'));
        setQuickMessageOpen(false);
        setQuickMessageText('');
      } else {
        toast.error(res.message || t('Lỗi khi gửi tin'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
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
          ? t('Giao lại Tư vấn viên & Đền bù thành công!') 
          : t('Giao lại Tư vấn viên thành công!')
        );
        setSelectedLead(null);
        setReassignConsId('');
        setConfirmReassignOpen(false);
        fetchReports();
        window.dispatchEvent(new CustomEvent('lead-added'));
      } else {
        toast.error(t('Lỗi: ') + (res.message || t('Không thể giao lại')));
      }
    } catch (err: any) {
      toast.error(t('Đã xảy ra lỗi: ') + err.message);
    }
    setIsReassigning(false);
  };

  const handleBlockLead = async () => {
    if (!selectedLead) return;
    if (!blockReason.trim()) {
      toast.error(t('Vui lòng nhập lý do chặn.'));
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
        toast.success(t('Chặn khách hàng và đưa vào Blacklist thành công!'));
        setSelectedLead(null);
        setConfirmBlockOpen(false);
        setBlockReason('');
        setCompensateBlock(false);
        fetchReports();
        window.dispatchEvent(new CustomEvent('lead-added'));
      } else {
        toast.error(t('Lỗi: ') + (res.message || t('Không thể chặn khách hàng')));
      }
    } catch (err: any) {
      toast.error(t('Đã xảy ra lỗi: ') + err.message);
    }
    setIsBlocking(false);
  };


  const roundOptions = [
    { value: 'all', label: t('Tất cả các vòng'), icon: <Zap size={14} style={{ color: 'var(--color-primary)' }} /> },
    ...rounds.map(r => ({
      value: Number(r.id),
      label: r.round_name,
      icon: <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />,
      disabled: Number(r.is_active) !== 1,
      disabledType: 'round' as const
    }))
  ];

  const saleOptions = [
    { value: 'all', label: t('Tất cả Salepersons'), icon: <Users size={14} style={{ color: 'var(--color-primary)' }} /> },
    ...allConsultants.map(c => ({
      value: Number(c.id),
      label: c.name + (c.status === 'leave' ? ` (${t('Nghỉ phép')})` : Number(c.vacation_mode) === 1 ? ` (${t('Tạm ngưng')})` : c.status === 'inactive' ? ` (${t('Nghỉ việc')})` : ''),
      icon: <Users size={14} style={{ color: 'var(--color-text-muted)' }} />,
      disabled: c.status !== 'active' || Number(c.vacation_mode) === 1,
      disabledType: 'sale' as const
    }))
  ];

  const connectionOptions = [
    { value: 'all', label: t('Tất cả các nguồn'), icon: <Database size={14} style={{ color: 'var(--color-primary)' }} /> },
    ...connections.map(conn => ({
      value: Number(conn.id),
      label: conn.sheet_name,
      icon: <Database size={14} style={{ color: 'var(--color-text-muted)' }} />
    }))
  ];

  const handleSaveAutoApprove = async () => {
    setSavingSettings(true);
    try {
      const res = await fetchAPI('save_settings', {
        method: 'POST',
        body: JSON.stringify({
          ticket_auto_approve_enabled: ticketAutoApprove ? 1 : 0,
          ticket_auto_approve_rules: ticketAutoApproveRules
        })
      });
      if (res.success) {
        toast.success(t("Đã lưu cấu hình Tự động duyệt ticket thành công!"));
        setShowAutoApproveModal(false);
      } else {
        toast.error(t("Lỗi khi lưu cấu hình!"));
      }
    } catch (e: any) {
      toast.error(t("Lỗi kết nối: ") + e.message);
    }
    setSavingSettings(false);
  };

  // Since pagination and filters are handled server-side, reports are already filtered
  const filteredReports = reports;

  const pendingCount = stats.pending;
  const hasActiveFilters = saleFilter || (dateFilter !== 'Tháng này' && dateFilter !== 'all' && dateFilter !== '');

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
          <h1 className="page-title" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <TicketIcon size={28} color="var(--color-primary)" /> {t('Ticket Lỗi Data')}
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {t('Quản lý và xét duyệt các BÁO CÁO DATA từ Tư vấn viên')}
          </p>
        </div>
      </div>
      
      <div className="mobile-filter-tabs hide-on-mobile" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {FILTER_TABS.map(tab => (
          <button key={tab.key} onClick={() => updateParams('status', tab.key)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.8.5rem', fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: activeFilter === tab.key ? tab.color : 'var(--color-border)', background: activeFilter === tab.key ? tab.bg : 'transparent', color: activeFilter === tab.key ? tab.color : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
            {t(tab.label)} {`(${stats[tab.key]})`}
          </button>
        ))}
        <button onClick={fetchReports} disabled={loading} title={t("Làm mới")} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
        <button
          onClick={() => setShowSettingsModal(true)}
          title={t("Thiết lập thông báo Ticket")}
          style={{
            marginLeft: 'auto',
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-primary)',
            background: 'rgba(124,58,237,0.08)', cursor: 'pointer',
            color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 5,
            fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s'
          }}
        >
          <Settings2 size={14} /> {t('Cài đặt thông báo')}
        </button>

        <div style={{
          background: pendingCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          color: pendingCount > 0 ? 'var(--color-danger)' : '#10b981',
          padding: '8px 16px', borderRadius: 20, fontSize: '0.875rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4
        }}>
          {pendingCount > 0 ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {pendingCount} {t('chờ duyệt')}
        </div>
      </div>

        <div className="filter-mobile-only" style={{ width: '100%', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            {/* Status Dropdown */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <CustomSelect
                options={FILTER_TABS.map(tab => ({
                  value: tab.key,
                  label: `${t(tab.label)} (${stats[tab.key] || 0})`,
                  icon: <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: tab.color }} />
                }))}
                value={activeFilter}
                onChange={val => updateParams('status', val.toString())}
                width="100%"
              />
            </div>
            
            {/* Filter Toggle Button (Icon only) */}
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              title={showMobileFilters ? t("Ẩn bộ lọc") : t("Hiện bộ lọc")}
              style={{
                padding: 0,
                borderRadius: 8,
                border: '1px solid',
                borderColor: showMobileFilters ? 'var(--color-primary)' : 'var(--color-border)',
                background: showMobileFilters ? 'var(--color-primary-light)' : 'var(--color-surface)',
                color: showMobileFilters ? 'var(--color-primary)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                flexShrink: 0
              }}
            >
              <Filter size={16} />
            </button>

            {/* Reload Button */}
            <button
              onClick={fetchReports}
              disabled={loading}
              title={t("Làm mới")}
              style={{
                padding: 0,
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-muted)',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                flexShrink: 0
              }}
            >
              <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              title={t("Thiết lập thông báo Ticket")}
              style={{
                padding: 0,
                borderRadius: 8,
                border: '1px solid var(--color-primary)',
                background: 'rgba(124,58,237,0.08)',
                color: 'var(--color-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                flexShrink: 0
              }}
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>

      <div className={`responsive-filter-row ${!showMobileFilters ? 'filter-hide-on-mobile' : ''}`} style={{
          position: 'relative', zIndex: 100,
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
            <span>{t('Bộ lọc')}</span>
          </div>

          <div style={{ width: 1, height: 20, background: 'rgba(124,58,237,0.2)', margin: '0 4px' }} />

          {/* Sale filter */}
          <div className="responsive-filter-item" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <CustomSelect
              options={[
                { value: '', label: t('Tất cả Saleperson'), icon: <Users size={16} /> },
                ...consultantOptions.map(name => {
                  const matched = allConsultants.find(c => c.name === name);
                  return {
                    value: name,
                    label: name,
                    avatar: matched?.avatar || ''
                  };
                })
              ]}
              value={saleFilter}
              onChange={val => updateParams('consultant', val.toString())}
              showAvatars={true}
              searchable={true}
              width={200}
            />
          </div>

          {/* Date Filter */}
          <div className="responsive-filter-item" style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 200 }}>
            <CustomSelect
              options={dateOptions}
              value={dateFilter}
              onChange={val => {
                if (val === 'Tùy chỉnh') {
                  setShowDateModal(true);
                  return;
                }
                updateParams('date', val.toString());
              }}
              width="100%"
            />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button onClick={() => {
              setSearchParams(prev => {
                prev.delete('consultant');
                prev.delete('date');
                prev.delete('page');
                return prev;
              }, { replace: true });
            }}
              style={{
                fontSize: '0.75rem', padding: '6px 12px', borderRadius: 10,
                border: '1.5px solid var(--color-danger-light)', background: 'var(--color-danger-light)',
                color: 'var(--color-danger)', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                boxShadow: '0 1px 4px rgba(220,38,38,0.06)',
                transition: 'all 0.15s'
              }}>
              ✕ {t('Xóa lọc')}
            </button>
          )}

          <div className="mobile-ml-0" style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            {/* Auto duyệt Toggle */}
            <div 
              onClick={() => setShowAutoApproveModal(true)}
              title={t("Cấu hình quy tắc tự động duyệt")}
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
                {t('Auto duyệt')}
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
              {t('Tổng cộng:')} {totalCount} {t('tickets')}
            </span>
          </div>
        </div>

      {/* ── Table / Held leads list ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <TableSkeleton rows={4} cols={5} />
            ) : filteredReports.length === 0 ? (
              <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <CheckCircle size={40} color="#10b981" />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                  {hasActiveFilters ? t('Không có kết quả phù hợp') : t('Chưa có báo cáo lỗi nào')}
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto' }}>
                  {hasActiveFilters ? t('Thử thay đổi bộ lọc để tìm kết quả khác.') : t('Hệ thống đang hoạt động trơn tru. Các báo cáo lỗi Data từ Sale sẽ hiển thị tại đây.')}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop View Table */}
                <div className="table-wrap hide-on-mobile" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
                  <table className="mobile-table-compact" style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg)' }}>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', width: 220, minWidth: 220, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>{t('Thông tin Lead')}</th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', width: 220, minWidth: 220, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>{t('Tư vấn viên')}</th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>{t('Vòng phân bổ')}</th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>{t('Lý do lỗi')}</th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', width: 220, minWidth: 220, position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>{t('Thao tác')}</th>
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
                              resolved_at: r.resolved_at,
                              last_activity_at: r.last_activity_at,
                              ai_screener_status: r.ai_screener_status,
                              ai_evaluation: r.ai_evaluation
                            });
                          }}
                          style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', background: 'transparent', cursor: 'pointer' }}
                          className="lead-row"
                        >
                          <td style={{ padding: '1.25rem 1.5rem', width: 220, minWidth: 220, whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
                               <Avatar name={r.lead_name} size={36} />
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{r.lead_name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                                  <span>{maskPhone(r.lead_phone)}</span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: 2 }}>
                                  {new Date(r.created_at).toLocaleString('vi-VN')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem', width: 220, minWidth: 220, whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                              <Avatar src={r.consultant_avatar} name={r.consultant_name} size={28} aiScreened={!!(r.ai_screener_status && r.ai_screener_status !== 'not_screened')} /> {r.consultant_name}
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
                                background: r.status === 'pending' ? 'var(--color-warning-light)' : r.status === 'approved' ? 'var(--color-success-light)' : 'var(--color-border)',
                                color: r.status === 'pending' ? 'var(--color-warning)' : r.status === 'approved' ? 'var(--color-success)' : 'var(--color-text-muted)'
                              }}>
                                {r.status === 'pending' ? t('Chờ duyệt') : r.status === 'approved' ? t('Đã duyệt') : t('Từ chối')}
                              </div>
                              {r.status === 'rejected' && r.reject_reason && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', background: 'var(--color-danger-light)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                                  {t('Lý do:')} {r.reject_reason}
                                </div>
                              )}
                              {r.status === 'approved' && r.approval_reason && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', background: 'var(--color-success-light)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                                  {t('Lý do:')} {r.approval_reason}
                                </div>
                              )}
                            </div>
                            {r.status !== 'pending' && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Avatar src={r.resolved_by_avatar} name={t(r.resolved_by || 'Hệ thống')} size={16} />
                                <span>
                                  {r.status === 'approved' ? t('Duyệt') : t('Từ chối')} {t('bởi:')} <strong style={{ color: 'var(--color-text-muted)' }}>{t(r.resolved_by || 'Hệ thống')}</strong>
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
                          <td className="col-actions" style={{ padding: '1.25rem 1.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {r.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                {r.zalo_chat_id && (
                                  <button onClick={(e) => { e.stopPropagation(); setQuickMessageTarget({ id: r.consultant_id, name: r.consultant_name }); setQuickMessageOpen(true); }} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: '#0068ff' }} title={t("Nhắn Zalo Bot cho Sale")}>
                                    <Bell size={14} />
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); openRejectModal(r.id); }} disabled={isActioning === r.id} className="btn outline sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', boxShadow: 'none' }}>
                                  {t('Từ chối')}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); openApproveModal(r.id); }} disabled={isActioning === r.id} className="btn primary sm" style={{ background: '#10b981', borderColor: '#10b981', boxShadow: 'none' }}>
                                  {isActioning === r.id ? t('Đang xử lý...') : t('Duyệt & Đền Bù')}
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
                                {r.zalo_chat_id && (
                                  <button onClick={(e) => { e.stopPropagation(); setQuickMessageTarget({ id: r.consultant_id, name: r.consultant_name }); setQuickMessageOpen(true); }} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: '#0068ff' }} title={t("Nhắn Zalo Bot cho Sale")}>
                                    <Bell size={14} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List View */}
                <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 1rem 5rem 1rem' }}>
                  {filteredReports.map(r => (
                    <div 
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
                          resolved_at: r.resolved_at,
                          last_activity_at: r.last_activity_at,
                          ai_screener_status: r.ai_screener_status,
                          ai_evaluation: r.ai_evaluation
                        });
                      }}
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '16px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        boxShadow: 'var(--shadow-sm)',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      className="hover-lift"
                    >
                      {/* Header: Lead Info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Avatar name={r.lead_name} size={32} />
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.95rem' }}>{r.lead_name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                              <Phone size={12} style={{ opacity: 0.6 }} />
                              <span>{maskPhone(r.lead_phone)}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--color-text-light)' }}>
                            <Clock size={12} style={{ opacity: 0.6 }} />
                            <span>
                              {new Date(r.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                              {new Date(r.created_at).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                          {r.round_name && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(124,58,237,0.08)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>
                              <Zap size={10} /> {r.round_name}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ height: '1px', background: 'var(--color-border-light)' }} />

                      {/* Consultant details */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-light)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <User size={12} style={{ opacity: 0.6 }} />
                          {t('Người báo lỗi:')}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text)', fontWeight: 600 }}>
                          <Avatar src={r.consultant_avatar} name={r.consultant_name} size={24} aiScreened={!!(r.ai_screener_status && r.ai_screener_status !== 'not_screened')} />
                          <span>{r.consultant_name}</span>
                        </div>
                      </div>

                      {/* Error Reason & Status Callout */}
                      <div style={{
                        background: r.status === 'pending' ? 'rgba(245, 158, 11, 0.04)' : r.status === 'approved' ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)',
                        borderLeft: `3px solid ${r.status === 'pending' ? 'var(--color-warning)' : r.status === 'approved' ? 'var(--color-success)' : 'var(--color-danger)'}`,
                        padding: '10px 12px',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: r.status === 'pending' ? 'var(--color-warning)' : r.status === 'approved' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {r.status === 'pending' ? t('Chờ duyệt') : r.status === 'approved' ? t('Đã duyệt') : t('Từ chối')}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', fontWeight: 600, marginTop: 2 }}>
                          {r.reason}
                        </div>

                        {/* Resolve Info */}
                        {r.status !== 'pending' && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', borderTop: '1px dashed var(--color-border-light)', paddingTop: 6, marginTop: 4 }}>
                            <Avatar src={r.resolved_by_avatar} name={t(r.resolved_by || 'Hệ thống')} size={14} />
                            <span>
                              {r.status === 'approved' ? t('Duyệt') : t('Từ chối')} {t('bởi')} <strong>{t(r.resolved_by || 'Hệ thống')}</strong>
                            </span>
                            {r.resolved_at && (
                              <span>• {new Date(r.resolved_at).toLocaleString('vi-VN')}</span>
                            )}
                          </div>
                        )}
                        
                        {r.status === 'rejected' && r.reject_reason && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600, background: 'rgba(239, 68, 68, 0.04)', padding: '4px 8px', borderRadius: 4, marginTop: 4 }}>
                            {t('Lý do từ chối:')} {r.reject_reason}
                          </div>
                        )}
                        {r.status === 'approved' && r.approval_reason && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600, background: 'rgba(16, 185, 129, 0.04)', padding: '4px 8px', borderRadius: 4, marginTop: 4 }}>
                            {t('Ghi chú duyệt:')} {r.approval_reason}
                          </div>
                        )}
                      </div>

                      {/* Actions footer */}
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }} onClick={e => e.stopPropagation()}>
                          {r.zalo_chat_id && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setQuickMessageTarget({ id: r.consultant_id, name: r.consultant_name }); 
                                setQuickMessageOpen(true); 
                              }} 
                              className="btn ghost sm" 
                              style={{ width: 36, height: 36, padding: 0, borderRadius: 10, color: '#0068ff', border: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }} 
                              title={t("Nhắn Zalo Bot")}
                            >
                              <Bell size={16} />
                            </button>
                          )}
                          
                          <button 
                            onClick={(e) => { 
                               e.stopPropagation(); 
                               openRejectModal(r.id); 
                            }} 
                            disabled={isActioning === r.id} 
                            className="btn outline sm" 
                            style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)', boxShadow: 'none', height: 36, borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            title={t('Từ chối')}
                          >
                            <XCircle size={14} />
                            <span>{t('Từ chối')}</span>
                          </button>

                          <button 
                            onClick={(e) => { 
                               e.stopPropagation(); 
                               openApproveModal(r.id); 
                            }} 
                            disabled={isActioning === r.id} 
                            className="btn primary sm" 
                            style={{ background: '#10b981', borderColor: '#10b981', boxShadow: 'none', height: 36, borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            title={t('Duyệt')}
                          >
                            <CheckCircle2 size={14} />
                            <span>{t('Duyệt')}</span>
                          </button>
                        </div>
                      )}

                      {r.status !== 'pending' && r.zalo_chat_id && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }} onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setQuickMessageTarget({ id: r.consultant_id, name: r.consultant_name }); 
                              setQuickMessageOpen(true); 
                            }} 
                            className="btn ghost sm" 
                            style={{ width: 36, height: 36, padding: 0, borderRadius: 10, color: '#0068ff', border: '1px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }} 
                            title={t("Nhắn Zalo Bot")}
                          >
                            <Bell size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination */}
            {!loading && totalPages > 0 && (
              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', flexShrink: 0 }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {t('Hiển thị')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</span> {t('trên')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{totalCount}</span>
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

      {/* Custom Date Picker Modal */}
      <CustomModal 
        isOpen={showDateModal} 
        onClose={() => setShowDateModal(false)} 
        title={t("Tùy chỉnh thời gian")}
        width="400px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
          <div>
            <label className="form-label">{t("Từ ngày")}</label>
            <input 
              type="date" 
              className="form-input" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
          </div>
          <div>
            <label className="form-label">{t("Đến ngày")}</label>
            <input 
              type="date" 
              className="form-input" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn outline" onClick={() => setShowDateModal(false)}>{t("Hủy")}</button>
            <button className="btn primary" onClick={handleCustomDateSubmit}>{t("Áp dụng")}</button>
          </div>
        </div>
      </CustomModal>



      {/* Reject Modal */}
      <CustomModal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title={t("Từ chối Báo cáo Lỗi")}>
        <form onSubmit={submitReject}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              {t("Vui lòng nhập lý do từ chối để Tư vấn viên biết lý do không được đền bù Data:")}
            </p>
            <div className="form-group">
              <label className="form-label">{t("Lý do từ chối")} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <textarea
                className="form-input"
                placeholder={t("Ví dụ: Khách bảo có nhu cầu nhưng Sale tư vấn chưa tốt...")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
                autoFocus
                style={{ minHeight: 80, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setRejectModalOpen(false)}>{t("Hủy")}</button>
              <button type="submit" className="btn primary" style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} disabled={isActioning !== null}>
                {isActioning ? t("Đang xử lý...") : t("Xác nhận Từ chối")}
              </button>
            </div>
          </div>
        </form>
      </CustomModal>

      {/* Quick Message Modal */}
      <CustomModal isOpen={quickMessageOpen} onClose={() => setQuickMessageOpen(false)} title={`${t("Nhắn tin cho")} ${quickMessageTarget?.name || t("Sale")}`}>
        <form onSubmit={handleSendQuickMessage}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>{t("Tin nhắn sẽ được tự động gửi qua Zalo Bot (nếu có) và Email với tiêu đề [ TIN NHẮN TỪ QUẢN TRỊ VIÊN ]")}</p>
            <div className="form-group">
              <label className="form-label">{t("Nội dung tin nhắn")} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <textarea
                className="form-input"
                placeholder={t("Nhập nội dung cần thông báo cho Sale...")}
                value={quickMessageText}
                onChange={e => setQuickMessageText(e.target.value)}
                required
                autoFocus
                style={{ minHeight: 100, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setQuickMessageOpen(false)}>{t("Hủy")}</button>
              <button type="submit" className="btn primary" disabled={isSendingMsg} style={{ background: '#0068ff', borderColor: '#0068ff' }}>
                {isSendingMsg ? t("Đang gửi...") : t("Gửi tin nhắn")}
              </button>
            </div>
          </div>
        </form>
      </CustomModal>

      {/* Approve Modal */}
      <CustomModal isOpen={approveModalOpen} onClose={() => setApproveModalOpen(false)} title={t("Duyệt & Đền Bù Data")}>
        <form onSubmit={submitApprove}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {t("Bạn có chắc chắn muốn DUYỆT báo cáo lỗi này và ĐỀN BÙ 1 lượt nhận Data tiếp theo cho Sale không? Hành động này sẽ cộng thêm chỉ số đền bù vào vòng xoay Round-Robin ngay lập tức.")}
            </p>
            <div className="form-group">
              <label className="form-label">{t("Lý do duyệt (không bắt buộc)")}</label>
              <textarea
                className="form-input"
                placeholder={t("Ví dụ: Đã kiểm tra đúng là khách hàng trùng hoặc thuê bao...")}
                value={approveReason}
                onChange={(e) => setApproveReason(e.target.value)}
                autoFocus
                style={{ minHeight: 80, resize: 'vertical' }}
              />
            </div>
            {reports.find(r => Number(r.id) === Number(approvingId))?.reason?.includes('Trùng của người khác') && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                  {t("Nhắc lại cho TVV khác (Tùy chọn)")}
                </label>
                <CustomSelect
                  options={[
                    { value: '', label: t('Không nhắc lại cho TVV khác'), icon: null },
                    ...allConsultants
                      .filter(c => {
                        const currentReport = reports.find(r => Number(r.id) === Number(approvingId));
                        return Number(c.id) !== Number(currentReport?.consultant_id);
                      })
                      .map(c => ({
                        value: String(c.id),
                        label: c.name + (c.status === 'leave' ? ` (${t('Nghỉ phép')})` : Number(c.vacation_mode) === 1 ? ` (${t('Tạm ngưng')})` : c.status === 'inactive' ? ` (${t('Nghỉ việc')})` : ''),
                        sublabel: c.email,
                        avatar: c.avatar,
                        disabled: c.status !== 'active' || Number(c.vacation_mode) === 1,
                        disabledType: 'sale' as const
                      }))
                  ]}
                  value={reassignConsultantId}
                  onChange={(val) => setReassignConsultantId(val ? String(val) : '')}
                  showAvatars={true}
                  searchable={true}
                  placeholder={t("Chọn TVV khác...")}
                  width="100%"
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {t("Chọn TVV này nếu đây là lỗi trùng và muốn chuyển Lead sang cho họ (Không tính vòng chia số).")}
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setApproveModalOpen(false)}>{t("Hủy")}</button>
              <button type="submit" className="btn primary" style={{ background: '#10b981', borderColor: '#10b981' }} disabled={isActioning !== null}>
                {isActioning ? t("Đang xử lý...") : t("Xác nhận duyệt")}
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
        title={t("Chi tiết Khách hàng")}
        width="850px"
      >
        {selectedLead && (
          <div style={{ padding: '1.5rem', background: 'transparent' }}>
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
                            const isTicket = selectedLead.status === 'error' || selectedLead.report_status === 'approved' || selectedLead.report_status === 'pending';
                            setCompensateBlock(selectedLead.assigned_to_name !== '-' && !isTicket);
                            setConfirmBlockOpen(true);
                          }}
                          title={t("Chặn & Blacklist khách hàng này")}
                          style={{
                            background: 'var(--color-danger-light)',
                            border: '1px solid var(--color-danger-light)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            color: 'var(--color-danger)',
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
                            e.currentTarget.style.background = 'var(--color-danger)';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseOut={e => {
                            e.currentTarget.style.background = 'var(--color-danger-light)';
                            e.currentTarget.style.color = 'var(--color-danger)';
                          }}
                        >
                          <AlertTriangle size={12} />
                          {t("Chặn")}
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>ID: #{selectedLead.id}</div>
                  </div>
                </div>

                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Phone size={14} /> {t("Phone")}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {user?.role === 'admin' ? selectedLead.phone : maskPhone(selectedLead.phone)}
                    </div>
                  </div>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Mail size={14} /> {t("Email")}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {user?.role === 'admin' ? selectedLead.email : maskEmail(selectedLead.email)}
                    </div>
                  </div>
                </div>

                <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><ExternalLink size={14} /> {t("Nguồn Data")}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.source}</div>
                  </div>
                  <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}><Tag size={14} /> {t("Trạng thái")}</div>
                    <div>
                      {selectedLead.status === 'assigned' && (
                        selectedLead.report_status === 'pending' ? (
                          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', border: '1px solid rgba(99, 102, 241, 0.2)' }}>{t("Ticket Review")}</span>
                        ) : (
                          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-success-light)', color: 'var(--color-success)' }}>{t("Đã chia")}</span>
                        )
                      )}
                      {selectedLead.status === 'compensation' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-info-light)', color: 'var(--color-info)' }}>{t("Data Bù")}</span>}
                      {selectedLead.status === 'pending_work_hours' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>{t("Chờ giờ làm")}</span>}
                      {selectedLead.status === 'error' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>{t("Ticket")}</span>}
                      {selectedLead.status === 'pending' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>{t("Chờ chia")}</span>}
                      {selectedLead.status === 'reminder' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: theme === 'dark' ? 'rgba(219, 39, 119, 0.15)' : '#fce7f3', color: theme === 'dark' ? '#f472b6' : '#db2777' }}>{t("Nhắc lại")}</span>}
                      {selectedLead.status === 'duplicate' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>{t("Trùng lặp")}</span>}
                      {selectedLead.status === 'rule_6_month' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{t("Quy định 6 tháng")}</span>}
                      {selectedLead.status === 'silent' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{t("Chỉ đồng bộ")}</span>}
                      {selectedLead.status === 'blacklisted' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>{t("Blacklist")}</span>}
                      {selectedLead.status === 'pending_approval' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>{t("AI Pre-screener")}</span>}
                    </div>
                  </div>
                </div>

                {(() => {
                  const { cleanNote, errorNotes, blacklistNotes, warningNotes } = parseNote(selectedLead.note || '');
                  return (
                    <>


                      {/* Error Notes (Approved / Rejected) */}
                      {errorNotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                          {errorNotes.map((err, index) => {
                            const isApproved = err.includes('DUYỆT');
                            
                            // Rich harmonious color palettes
                            const colors = isApproved ? (
                              theme === 'dark' ? {
                                gradient: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.15)',
                                glow: 'none',
                                accent: '#34d399',
                                title: '#34d399',
                                text: '#dadada',
                                badgeBg: 'rgba(16, 185, 129, 0.15)',
                                badgeText: '#34d399',
                                badgeBorder: '1px solid rgba(16, 185, 129, 0.2)',
                                iconBg: 'rgba(16, 185, 129, 0.15)',
                              } : {
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
                              }
                            ) : (
                              theme === 'dark' ? {
                                gradient: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.15)',
                                glow: 'none',
                                accent: '#f87171',
                                title: '#f87171',
                                text: '#dadada',
                                badgeBg: 'rgba(239, 68, 68, 0.15)',
                                badgeText: '#f87171',
                                badgeBorder: '1px solid rgba(239, 68, 68, 0.2)',
                                iconBg: 'rgba(239, 68, 68, 0.15)',
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
                              }
                            );

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

                            let cleanReason = actionReason.trim();
                            let reasonLabel = isApproved ? 'Lý do duyệt:' : 'Lý do từ chối:';

                            if (cleanReason.startsWith('Lý do duyệt:')) {
                              reasonLabel = 'Lý do duyệt:';
                              cleanReason = cleanReason.replace(/^Lý do duyệt:/, '').trim();
                            } else if (cleanReason.startsWith('Lý do từ chối:')) {
                              reasonLabel = 'Lý do từ chối:';
                              cleanReason = cleanReason.replace(/^Lý do từ chối:/, '').trim();
                            }

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
                                      {isApproved ? t('Thông tin lỗi - Đã Duyệt') : t('Thông tin lỗi - Từ Chối')}
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
                                    {isApproved ? t('Đã duyệt') : t('Từ chối')}
                                  </span>
                                </div>

                                {/* Content block */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? 'var(--color-text)' : '#1e293b', fontWeight: 500, lineHeight: 1.5 }}>
                                    {t("Lỗi:")} <span style={{ fontWeight: 600, color: colors.text }}>{coreError}</span>
                                  </div>
                                  {actionReason && (
                                    <div style={{ 
                                      fontSize: '0.85rem', 
                                      color: theme === 'dark' ? 'var(--color-text-muted)' : '#475569', 
                                      fontWeight: 400, 
                                      lineHeight: 1.5,
                                      background: theme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.4)',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: theme === 'dark' ? '1px dashed var(--color-border)' : '1px dashed rgba(0, 0, 0, 0.05)',
                                      marginTop: 2
                                    }}>
                                      <strong>{t(reasonLabel)}</strong> {cleanReason}
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
                                  borderTop: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid rgba(0, 0, 0, 0.04)', 
                                  flexWrap: 'wrap'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Avatar src={getUserAvatarByName(displayAdmin)} name={t(displayAdmin)} size={16} />
                                    <span>{t("Xử lý bởi:")} <strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{t(displayAdmin)}</strong></span>
                                  </div>
                                  <span style={{ color: theme === 'dark' ? 'var(--color-border)' : '#cbd5e1', fontSize: '0.75rem' }}>•</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Clock size={13} style={{ opacity: 0.7 }} />
                                    <span>{t("Thời gian:")} <strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{t(displayTime)}</strong></span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Warning Notes Card */}
                      {warningNotes && warningNotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                          {warningNotes.map((warn, index) => (
                            <div key={index} style={{
                              background: theme === 'dark' ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb',
                              border: '1px dashed var(--color-warning)',
                              padding: '1rem 1.25rem',
                              borderRadius: '16px',
                              display: 'flex',
                              gap: '0.75rem',
                              alignItems: 'center'
                            }}>
                              <div style={{
                                background: theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                                padding: '6px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-warning)',
                                flexShrink: 0
                              }}>
                                <AlertTriangle size={16} strokeWidth={2.5} />
                              </div>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: theme === 'dark' ? '#f3f4f6' : '#78350f', lineHeight: 1.4 }}>
                                {warn}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Clean Note Card */}
                      <div style={{ 
                        background: 'var(--color-warning-light)', 
                        border: '1px solid var(--color-warning-light)',
                        padding: '1.25rem', 
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: 'none'
                      }}
                      className="premium-alert-card"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            background: theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
                            padding: '8px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: theme === 'dark' ? '#f59e0b' : '#d97706'
                          }}>
                            <Tag size={18} strokeWidth={2.5} />
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme === 'dark' ? '#fbbf24' : '#92400e', letterSpacing: '-0.01em' }}>{t("Ghi chú & Phân loại")}</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '0.85rem', color: theme === 'dark' ? '#dadada' : '#78350f' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', marginRight: '6px' }}>{t("Loại Data:")}</span>
                            <span style={{ fontWeight: 600 }}>{selectedLead.type !== '-' ? selectedLead.type : t('Không có')}</span>
                          </div>
                          
                          <div style={{ borderTop: theme === 'dark' ? '1px dashed rgba(245, 158, 11, 0.2)' : '1px dashed rgba(217, 119, 6, 0.15)', paddingTop: '8px', marginTop: '4px' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', display: 'block', marginBottom: '4px' }}>{t("Nội dung ghi chú:")}</span>
                            <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#f3f4f6' : '#451a03', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontWeight: 500 }}>
                              {cleanNote ? cleanNote : <em style={{ color: theme === 'dark' ? '#cbd5e1' : '#b45309', opacity: 0.6 }}>{t("Không có ghi chú thêm")}</em>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Blacklist Notes */}
                      {blacklistNotes && blacklistNotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          {blacklistNotes.map((note, index) => {
                            const parsed = parseBlacklistNote(note);
                            const blacklistColors = theme === 'dark' ? {
                              gradient: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.15)',
                              glow: 'none',
                              accent: '#f87171',
                              title: '#f87171',
                              text: '#dadada',
                              badgeBg: 'rgba(239, 68, 68, 0.15)',
                              badgeText: '#f87171',
                              badgeBorder: '1px solid rgba(239, 68, 68, 0.2)',
                              iconBg: 'rgba(239, 68, 68, 0.15)',
                            } : {
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'space-between' }}>
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
                                      {t("Thông tin chặn (Blacklist)")}
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
                                    {t("Bị Chặn")}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {parsed.reason && (
                                    <div style={{ 
                                      fontSize: '0.875rem', 
                                      color: theme === 'dark' ? 'var(--color-text)' : '#1e293b', 
                                      fontWeight: 500, 
                                      lineHeight: 1.5,
                                      background: theme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.4)',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: theme === 'dark' ? '1px dashed var(--color-border)' : '1px dashed rgba(0, 0, 0, 0.05)'
                                    }}>
                                      <strong>{t("Lý do chặn:")}</strong> <span style={{ color: blacklistColors.text, fontWeight: 600 }}>{parsed.reason}</span>
                                    </div>
                                  )}
                                </div>

                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '12px', 
                                  paddingTop: '0.75rem', 
                                  marginTop: '0.25rem',
                                  borderTop: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid rgba(0, 0, 0, 0.04)', 
                                  flexWrap: 'wrap'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Avatar src={getUserAvatarByName(parsed.admin)} name={t(parsed.admin)} size={16} />
                                    <span>{t("Chặn bởi:")} <strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{t(parsed.admin)}</strong></span>
                                  </div>
                                  <span style={{ color: theme === 'dark' ? 'var(--color-border)' : '#cbd5e1', fontSize: '0.75rem' }}>•</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Clock size={13} style={{ opacity: 0.7 }} />
                                    <span>{t("Thời gian:")} <strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{t(parsed.time)}</strong></span>
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
                {/* AI Screener Evaluation Details */}
                {selectedLead.ai_screener_status && selectedLead.ai_screener_status !== 'not_screened' && selectedLead.ai_screener_status !== 'passed' && (
                  <div style={{
                    marginBottom: '1.25rem',
                    padding: '1.25rem',
                    background: selectedLead.ai_screener_status === 'error'
                      ? 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0.02))'
                      : 'linear-gradient(to bottom right, rgba(239, 68, 68, 0.06), rgba(239, 68, 68, 0.02))',
                    border: selectedLead.ai_screener_status === 'error'
                      ? '1px solid rgba(245, 158, 11, 0.15)'
                      : '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Avatar src="/imgs/warn_icon.png" name="Domation AI - Screener" size={36} />
                      <div>
                        <div style={{ fontSize: '0.72rem', color: selectedLead.ai_screener_status === 'error' ? '#d97706' : 'var(--color-danger)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {selectedLead.ai_screener_status === 'error' ? t('Lỗi AI Pre-screener') : t('AI Pre-screener Tạm Giữ')}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                          {t('Domation AI - Screener')}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
                      <strong>{selectedLead.ai_screener_status === 'error' ? t('Chi tiết lỗi:') : t('Kết quả đánh giá AI:')}</strong> {selectedLead.ai_evaluation || extractManualReason(selectedLead.note || '') || (selectedLead.ai_screener_status === 'error' ? t('Mất kết nối với dịch vụ AI.') : t('Không đạt chuẩn phân chia.'))}
                    </div>
                  </div>
                )}

                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>{t("Thông tin Phân bổ")}</h3>
                
                {selectedLead.ai_screener_status === 'passed' && selectedLead.ai_evaluation && (
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1.5px solid var(--color-primary)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                      <Avatar src="https://crm-domation.vercel.app/LOGO.jpg" name="Domation AI" size={36} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{t('Đánh giá')}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Domation AI</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} strokeWidth={2} /> {t('Nội dung AI đánh giá')}</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                        {selectedLead.ai_evaluation}
                      </div>
                    </div>
                  </div>
                )}

                {selectedLead.assigned_to_name !== '-' ? (
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar src={selectedLead.assigned_to_avatar} name={selectedLead.assigned_to_name} size={40} aiScreened={!!(selectedLead.ai_screener_status && selectedLead.ai_screener_status !== 'not_screened')} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{t("Người tiếp nhận")}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{selectedLead.assigned_to_name}</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t("Vòng chia")}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.round_name}</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
                          <Clock size={12} /> {t("Thời gian nhận")}
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.created_at}</div>
                      </div>
                      {selectedLead.status === 'reminder' && selectedLead.last_activity_at && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
                            <Clock size={12} /> {t("Thời gian nhắc lại từ:")}
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f59e0b' }}>
                            {selectedLead.last_activity_at}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'var(--color-bg)', padding: '1.5rem', borderRadius: 12, border: '1px solid var(--color-border)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    {t("Chưa có thông tin phân bổ cho Khách hàng này.")}
                  </div>
                )}

                {/* Giao lại Tư vấn viên */}
                {user?.role === 'admin' && (
                  <div style={{ marginTop: '1.5rem', background: 'var(--color-bg)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={16} color="var(--color-primary)" /> {t("Giao lại Tư vấn viên")}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
                      {t("Thay đổi người tiếp nhận (Không ảnh hưởng lượt chia).")}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <CustomSelect 
                        options={[
                          { value: '', label: t('-- Chọn Tư vấn viên --') },
                          ...allConsultants
                            .map(c => ({
                              value: c.id.toString(),
                              label: c.name + (c.status === 'leave' ? ` (${t('Nghỉ phép')})` : Number(c.vacation_mode) === 1 ? ` (${t('Tạm ngưng')})` : c.status === 'inactive' ? ` (${t('Nghỉ việc')})` : ''),
                              avatar: c.avatar,
                              disabled: c.status !== 'active' || Number(c.vacation_mode) === 1,
                              disabledType: 'sale' as const
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
                        {t("Xác nhận giao")}
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
        title={t("Xác nhận Giao lại Lead")}
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
                {t('Bạn có chắc chắn muốn chuyển quyền chăm sóc Lead')} <strong>"{selectedLead?.name}"</strong> {t('sang cho Tư vấn viên')} <strong>"{allConsultants.find(c => Number(c.id) === Number(reassignConsId))?.name}"</strong>?
              </p>
              {selectedLead?.assigned_to_name && selectedLead.assigned_to_name !== '-' && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 8, marginBottom: 0 }}>
                  {t('Lead này hiện đang thuộc về:')} <strong>{selectedLead.assigned_to_name}</strong>. {t('Bạn muốn bù data cho')} <strong>{selectedLead.assigned_to_name}</strong> {t('chứ?')}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="btn outline" onClick={() => setConfirmReassignOpen(false)}>{t("Hủy")}</button>
            
            {selectedLead?.assigned_to_name && selectedLead.assigned_to_name !== '-' ? (
              <>
                <button 
                  className="btn secondary" 
                  onClick={() => handleReassign(false)}
                  style={{ background: '#f59e0b', color: '#fff', border: 'none' }}
                  disabled={isReassigning}
                >
                  {t("Chuyển luôn, Không bù")}
                </button>
                <button 
                  className="btn success" 
                  onClick={() => handleReassign(true)}
                  style={{ background: '#10b981', color: '#fff', border: 'none' }}
                  disabled={isReassigning}
                >
                  {t("Chuyển & Bù cho sale cũ")}
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
        title={t("Xác nhận Chặn & Blacklist")}
        width="550px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: '50%', background: 'var(--color-danger-light)', 
              color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p style={{ color: 'var(--color-text)', lineHeight: 1.6, fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>
                {t('Bạn có chắc chắn muốn chặn khách hàng')} "{selectedLead?.name || ''}"?
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 4, marginBottom: 0 }}>
                {t("Số điện thoại/Email của khách hàng sẽ được thêm vào Blacklist toàn cục để chặn nhận trùng trong tương lai.")}
              </p>
            </div>
          </div>

          {isTicketLead && (
            <div style={{
              background: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              padding: '1rem',
              color: 'var(--color-danger)',
              fontSize: '0.875rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              lineHeight: 1.5,
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)'
            }}>
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                {t("Lead này đã có trạng thái Ticket và đã được bù rồi. Hệ thống sẽ chỉ đưa thông tin khách hàng này vào Blacklist và không thực hiện đền bù thêm lượt nào nữa.")}
              </div>
            </div>
          )}

          <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Hình thức chặn:")}</div>
            
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="blockType" 
                checked={!compensateBlock} 
                onChange={() => setCompensateBlock(false)} 
                style={{ marginTop: '3px' }}
              />
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t("Chỉ đưa vào danh sách đen (Blacklist)")}</span>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>{t("Không thực hiện đền bù data cho Sale.")}</p>
              </div>
            </label>

            <label style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '8px', 
              cursor: (selectedLead?.assigned_to_name === '-' || isTicketLead) ? 'not-allowed' : 'pointer', 
              opacity: (selectedLead?.assigned_to_name === '-' || isTicketLead) ? 0.5 : 1 
            }}>
              <input 
                type="radio" 
                name="blockType" 
                checked={compensateBlock} 
                onChange={() => setCompensateBlock(true)} 
                disabled={selectedLead?.assigned_to_name === '-' || isTicketLead}
                style={{ marginTop: '3px' }}
              />
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t("Chặn và Bù vòng cho Sale")}</span>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                  {t('Đền bù 1 lượt data vòng')} <strong>"{selectedLead?.round_name}"</strong> {t('cho Sale')} <strong>"{selectedLead?.assigned_to_name}"</strong>.
                </p>
              </div>
            </label>
            
            {selectedLead?.assigned_to_name === '-' && (
              <div style={{ color: '#ea580c', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} /> {t("Lead chưa phân bổ cho Sale nào, không thể chọn hình thức Bù vòng.")}
              </div>
            )}

            {isTicketLead && (
              <div style={{ color: '#ea580c', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} /> {t("Lead đã có trạng thái Ticket (lỗi), không thể đền bù thêm khi chặn.")}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Lý do chặn")} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder={t("Nhập lý do chặn (ví dụ: Số điện thoại ảo, khách không có nhu cầu, spam...)")}
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
              {t("Hủy")}
            </button>
            <button 
              className="btn danger" 
              onClick={handleBlockLead}
              disabled={isBlocking || !blockReason.trim()}
              style={{ background: '#ef4444', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {isBlocking ? <RefreshCw size={14} className="spin" /> : null}
              {t("Xác nhận chặn")}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Auto-Approve Settings Modal */}
      <CustomModal
        isOpen={showAutoApproveModal}
        onClose={() => setShowAutoApproveModal(false)}
        title={t("Cấu hình Tự Động Duyệt Ticket")}
        width="680px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0', textAlign: 'left' }}>
          
          {/* Main switch toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>{t("Trạng thái tự động duyệt ticket")}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                {t("Khi được kích hoạt, hệ thống sẽ tự động duyệt báo cáo lỗi của Sale nếu khớp với các luật bên dưới.")}
              </span>
            </div>
            <div 
              onClick={() => setTicketAutoApprove(!ticketAutoApprove)}
              style={{
                width: 48, height: 26, borderRadius: 13,
                background: ticketAutoApprove ? 'var(--color-success)' : 'var(--color-border)',
                position: 'relative', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer',
                boxShadow: ticketAutoApprove ? '0 0 8px rgba(16, 185, 129, 0.25)' : 'none',
                flexShrink: 0
              }}
            >
              <div style={{
                position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%',
                background: 'white', left: ticketAutoApprove ? 25 : 3, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
              }} />
            </div>
          </div>

          {/* Rules list section */}
          {ticketAutoApprove && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.95rem' }}>
                  {t("Danh sách luật duyệt tự động")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRule(null);
                    setRuleName('');
                    setRuleActive(true);
                    setRuleRounds(['all']);
                    setRuleSales(['all']);
                    setRuleConnections(['all']);
                    setRuleKeywords('');
                    setRuleModalOpen(true);
                  }}
                  className="btn primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  <Plus size={16} /> {t("Thêm Luật Mới")}
                </button>
              </div>

              {ticketAutoApproveRules.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '3rem 2rem', border: '2px dashed var(--color-border)',
                  borderRadius: 'var(--radius-lg)', color: 'var(--color-text-muted)', fontSize: '0.875rem'
                }}>
                  {t("Chưa có luật tự động duyệt nào. Nhấp \"Thêm Luật Mới\" để bắt đầu thiết lập.")}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: 4 }} className="custom-scrollbar">
                  {ticketAutoApproveRules.map((rule) => {
                    const targetRounds = rule.rounds.includes('all')
                      ? t('Tất cả vòng')
                      : rounds.filter(r => rule.rounds.map(String).includes(String(r.id))).map(r => r.round_name).join(', ') || t('Không xác định');

                    const targetSales = rule.sales.includes('all')
                      ? t('Tất cả Salepersons')
                      : allConsultants.filter(c => rule.sales.map(String).includes(String(c.id))).map(c => c.name).join(', ') || t('Không xác định');

                    const targetConns = (rule.connections || []).includes('all') || !rule.connections
                      ? t('Tất cả nguồn')
                      : connections.filter(conn => (rule.connections || []).map(String).includes(String(conn.id))).map(conn => conn.sheet_name).join(', ') || t('Không xác định');

                    const kwList = Array.isArray(rule.keywords) ? rule.keywords : (rule.keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean);

                    return (
                      <div
                        key={rule.id}
                        style={{
                          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                          background: rule.active ? 'var(--color-surface)' : 'rgba(0,0,0,0.02)',
                          padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                          position: 'relative', transition: 'all 0.2s',
                          opacity: rule.active ? 1 : 0.65
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                              {rule.name}
                              {!rule.active && (
                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 4 }}>
                                  {t("Tắt")}
                                </span>
                              )}
                            </h4>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {/* Quick toggle */}
                            <div
                              onClick={() => {
                                setTicketAutoApproveRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
                              }}
                              style={{
                                width: 32, height: 18, borderRadius: 9,
                                background: rule.active ? 'var(--color-success)' : 'var(--color-border)',
                                position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
                                marginRight: '0.5rem',
                                flexShrink: 0
                              }}
                            >
                              <div style={{
                                position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%',
                                background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                left: rule.active ? 16 : 2, transition: 'left 0.2s'
                              }} />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingRule(rule);
                                setRuleName(rule.name);
                                setRuleActive(rule.active);
                                setRuleRounds(rule.rounds);
                                setRuleSales(rule.sales);
                                setRuleConnections(rule.connections || ['all']);
                                setRuleKeywords(Array.isArray(rule.keywords) ? rule.keywords.join(', ') : rule.keywords);
                                setRuleModalOpen(true);
                              }}
                              style={{ padding: 4, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title={t("Chỉnh sửa")}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(t('Bạn có chắc chắn muốn xóa luật') + ` "${rule.name}"?`)) {
                                  setTicketAutoApproveRules(prev => prev.filter(r => r.id !== rule.id));
                                }
                              }}
                              style={{ padding: 4, color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title={t("Xóa")}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Details/Tags */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem' }}>
                          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>{t("Vòng:")}</span>
                            <span style={{ fontWeight: 600 }}>{targetRounds}</span>
                          </div>
                          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>{t("Sales:")}</span>
                            <span style={{ fontWeight: 600 }}>{targetSales}</span>
                          </div>
                          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>{t("Nguồn:")}</span>
                            <span style={{ fontWeight: 600 }}>{targetConns}</span>
                          </div>
                        </div>

                        {/* Keywords list */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', marginTop: 2 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginRight: 4 }}>{t("Từ khóa")} ({kwList.length}):</span>
                          {kwList.map((kw: string, i: number) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(16,185,129,0.1)',
                                color: 'var(--color-success)', borderRadius: 4, fontWeight: 600
                              }}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <button onClick={() => setShowAutoApproveModal(false)} className="btn ghost" type="button">{t("Hủy")}</button>
            <button
              onClick={handleSaveAutoApprove}
              disabled={savingSettings}
              className="btn primary"
              type="button"
            >
              <Save size={16} /> {savingSettings ? t('Đang lưu...') : t('Lưu cấu hình')}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Custom Modal for Auto-Approve Rule */}
      <CustomModal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title={editingRule ? t("Chỉnh sửa Luật Tự Động Duyệt") : t("Thêm Luật Tự Động Duyệt Mới")}
        width="620px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0', textAlign: 'left' }}>
          {/* Name */}
          <div>
            <label className="form-label" style={{ fontWeight: 600 }}>{t("Tên luật duyệt tự động")} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <input
              type="text"
              className="form-input"
              placeholder={t("Ví dụ: Lỗi số điện thoại — Vòng A")}
              value={ruleName}
              onChange={e => setRuleName(e.target.value)}
            />
          </div>

          {/* Scope: Rounds */}
          <div>
            <CustomSelect
              label={t("Áp dụng cho Vòng phân bổ")}
              options={roundOptions}
              value={ruleRounds}
              onChange={setRuleRounds}
              multiple={true}
              searchable={true}
              placeholder={t("Chọn vòng phân bổ...")}
            />
          </div>

          {/* Scope: Sales */}
          <div>
            <CustomSelect
              label={t("Áp dụng cho Tư vấn viên (Sales)")}
              options={saleOptions}
              value={ruleSales}
              onChange={setRuleSales}
              multiple={true}
              searchable={true}
              placeholder={t("Chọn tư vấn viên...")}
            />
          </div>

          {/* Scope: Sources (Sheet Connections) */}
          <div>
            <CustomSelect
              label={t("Áp dụng cho Nguồn dữ liệu (Sources)")}
              options={connectionOptions}
              value={ruleConnections}
              onChange={setRuleConnections}
              multiple={true}
              searchable={true}
              placeholder={t("Chọn nguồn dữ liệu...")}
            />
          </div>

          {/* Keywords / Reasons */}
          <div>
            <label className="form-label" style={{ fontWeight: 600 }}>{t("Từ khóa / Lý do lỗi kích hoạt (Cách nhau bằng dấu phẩy)")} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <textarea
              className="form-input"
              placeholder={t("Ví dụ: sai số, thuê bao, nhầm số, không liên lạc được")}
              value={ruleKeywords}
              onChange={e => setRuleKeywords(e.target.value)}
              style={{ minHeight: 80, resize: 'vertical' }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
              {t("Khi lý do báo lỗi của Sale chứa bất kỳ từ khóa nào trong danh sách trên, ticket sẽ được duyệt tự động.")}
            </span>
          </div>

          {/* Active status */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)', marginTop: '0.25rem'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>{t("Trạng thái hoạt động")}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Kích hoạt hoặc tạm ngưng áp dụng luật này")}</span>
            </div>
            <div
              onClick={() => setRuleActive(!ruleActive)}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: ruleActive ? 'var(--color-success)' : 'var(--color-border)',
                position: 'relative', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer',
                boxShadow: ruleActive ? '0 0 8px rgba(16, 185, 129, 0.2)' : 'none',
                flexShrink: 0
              }}
            >
              <div style={{
                position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                background: 'white', left: ruleActive ? 23 : 3, transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
              }} />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              className="btn outline"
              onClick={() => setRuleModalOpen(false)}
            >
              {t("Hủy")}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                if (!ruleName.trim()) {
                  toast.error(t("Vui lòng nhập tên luật!"));
                  return;
                }
                if (!ruleKeywords.trim()) {
                  toast.error(t("Vui lòng nhập từ khóa duyệt!"));
                  return;
                }
                if (ruleRounds.length === 0) {
                  toast.error(t("Vui lòng chọn ít nhất một vòng áp dụng!"));
                  return;
                }
                if (ruleSales.length === 0) {
                  toast.error(t("Vui lòng chọn ít nhất một Sale áp dụng!"));
                  return;
                }
                if (ruleConnections.length === 0) {
                  toast.error(t("Vui lòng chọn ít nhất một nguồn áp dụng!"));
                  return;
                }

                const keywordsArray = ruleKeywords.split(',')
                  .map(k => k.trim())
                  .filter(k => k.length > 0);

                const newRule = {
                  id: editingRule ? editingRule.id : Date.now(),
                  name: ruleName.trim(),
                  active: ruleActive,
                  rounds: ruleRounds,
                  sales: ruleSales,
                  connections: ruleConnections,
                  keywords: keywordsArray
                };

                if (editingRule) {
                  setTicketAutoApproveRules(prev => prev.map(r => r.id === editingRule.id ? newRule : r));
                  toast.success(t("Đã cập nhật luật thành công!"));
                } else {
                  setTicketAutoApproveRules(prev => [...prev, newRule]);
                  toast.success(t("Đã thêm luật mới thành công!"));
                }
                setRuleModalOpen(false);
              }}
            >
              {t("Xác nhận")}
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
  const { t } = useLanguage();

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
    }).catch((e: any) => toast.error(t('Lỗi tải cấu hình: ') + e.message))
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
        toast.success(t('Đã lưu cài đặt thông báo Ticket!'));
        onClose();
      } else {
        toast.error(res.message || t('Lỗi lưu cài đặt'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setSaving(false);
  };

  return (
    <CustomModal isOpen={open} onClose={onClose} title={t("Cài đặt thông báo Ticket")}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loadingData ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t("Đang tải...")}</div>
        ) : (
          <>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
              {t("Admin đầu tiên nhận email To: — Các admin còn lại nhận CC:. Admin phải có email mới có thể được chọn.")}
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
                    <Avatar src={acc.avatar} name={acc.name} size={36} />
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.9rem' }}>{acc.name}</div>
                      <div style={{ fontSize: '0.8rem', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)', marginTop: 2 }}>
                        {noEmail
                          ? <span style={{ color: 'var(--color-danger)' }}>{t("⚠ Chưa cài email — không nhận được")}</span>
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
                      {acc.role === 'admin' ? t('Admin') : t('Assistant')}
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
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>{t("Chưa có admin nào trong hệ thống")}</div>
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button onClick={onClose} className="btn ghost" type="button">{t("Hủy")}</button>
          <button
            onClick={handleSave}
            disabled={saving || loadingData}
            className="btn primary"
            type="button"
          >
            <Save size={16} /> {saving ? t('Đang lưu...') : t('Lưu cài đặt')}
          </button>
        </div>
      </div>
    </CustomModal>
  );
};
