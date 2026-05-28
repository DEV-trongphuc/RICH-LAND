import { useState, useEffect } from 'react';
import { Database, Search, Filter, ChevronLeft, ChevronRight, Download, RefreshCw, User, Phone, Mail, Clock, Tag, ExternalLink, AlertTriangle, CheckCircle2, XCircle, ShieldAlert, Calendar, LayoutList, Sparkles } from 'lucide-react';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Avatar } from '../components/ui/Avatar';
import { useSearchParams, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
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

import { fetchAPI } from '../utils/api';

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
  if (!noteText) return { cleanNote: '', errorNotes: [], blacklistNotes: [], warningNotes: [], aiDecisionNotes: [] };
  const normalized = noteText.replace(/\\n/g, '\n');
  const lines = normalized.split('\n');
  const cleanLines: string[] = [];
  const errorNotes: string[] = [];
  const blacklistNotes: string[] = [];
  const warningNotes: string[] = [];
  const aiDecisionNotes: string[] = [];

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
    } else if (
      trimmed.startsWith('[Từ chối AI]:') ||
      trimmed.startsWith('[Duyệt AI]:') ||
      trimmed.startsWith('[Blacklist AI]:') ||
      trimmed.startsWith('[Xác nhận dưới chuẩn - Fallback]:')
    ) {
      aiDecisionNotes.push(trimmed);
    } else {
      cleanLines.push(line);
    }
  });

  return {
    cleanNote: cleanLines.join('\n').trim(),
    errorNotes,
    blacklistNotes,
    warningNotes,
    aiDecisionNotes
  };
};

const parseAIDecisionNote = (note: string) => {
  let type = 'ai_reject';
  let prefix = '[Từ chối AI]';
  let reason = '';
  let admin = 'Hệ thống';
  let time = 'Hệ thống';

  let remaining = note;
  if (note.startsWith('[Từ chối AI]:')) {
    type = 'ai_reject';
    prefix = '[Từ chối AI]';
    remaining = note.substring('[Từ chối AI]:'.length).trim();
  } else if (note.startsWith('[Duyệt AI]:')) {
    type = 'ai_approve';
    prefix = '[Duyệt AI]';
    remaining = note.substring('[Duyệt AI]:'.length).trim();
  } else if (note.startsWith('[Blacklist AI]:')) {
    type = 'ai_blacklist';
    prefix = '[Blacklist AI]';
    remaining = note.substring('[Blacklist AI]:'.length).trim();
  } else if (note.startsWith('[Xác nhận dưới chuẩn - Fallback]:')) {
    type = 'ai_fallback';
    prefix = '[Xác nhận dưới chuẩn - Fallback]';
    remaining = note.substring('[Xác nhận dưới chuẩn - Fallback]:'.length).trim();
  }

  const parts = remaining.split('|');
  if (parts.length > 0) {
    reason = parts[0].trim();
  }

  parts.forEach(part => {
    const trimmed = part.trim();
    if (trimmed.startsWith('Admin:')) {
      admin = trimmed.substring('Admin:'.length).trim();
    } else if (trimmed.startsWith('Lúc:')) {
      time = trimmed.substring('Lúc:'.length).trim();
    }
  });

  return { type, prefix, reason, admin, time };
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

export const DataList = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const location = useLocation();
  const isActive = location.pathname === '/data';
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const dateFilter = searchParams.get('date') || 'this_month';
  const consultantFilter = searchParams.get('consultant') || 'all';
  const roundFilter = searchParams.get('round') || 'all';
  const currentPage = Number(searchParams.get('page') || '1');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [searchInput, setSearchInput] = useState(searchTerm);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchInput !== searchTerm) {
        updateParams('search', searchInput);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchInput, searchTerm]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [rounds, setRounds] = useState<{ id: number; round_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const json = await fetchAPI(`get_logs&page=${currentPage}&pageSize=${ITEMS_PER_PAGE}&date=${encodeURIComponent(dateFilter)}&status=${encodeURIComponent(statusFilter)}&consultant=${encodeURIComponent(consultantFilter)}&round=${encodeURIComponent(roundFilter)}&search=${encodeURIComponent(searchTerm)}`);
      if (json.success) {
        // Map the backend structure to the frontend structure
        const mappedLeads = json.data.map((item: any) => ({
          id: item.id,
          name: item.lead_name || t('Khách hàng ẩn danh'),
          phone: item.phone || '-',
          email: item.email || '-',
          source: item.source || '-',
          type: item.type || '-',
          note: item.note || '',
          status: item.status,
          assigned_to_name: item.assigned_to_name || '-',
          assigned_to_avatar: item.assigned_to_avatar,
          round_name: item.round_name || '-',
          created_at: item.created_at,
          report_status: item.report_status,
          last_activity_at: item.last_activity_at,
          ai_screener_status: item.ai_screener_status,
          ai_evaluation: item.ai_evaluation
        }));
        setLeads(mappedLeads);
        // BUG-04 fix: track truncation
        setTotalCount(json.total_count ?? mappedLeads.length);
      }
    } catch (e: any) {
      toast.error(t('Lỗi tải dữ liệu: ') + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isActive) {
      fetchLeads();
    }
  }, [searchParams, isActive]);

  useEffect(() => {
    fetchConsultants();
    fetchAccounts();
    fetchRounds();
  }, []);

  useEffect(() => {
    const handleLeadAdded = () => {
      if (isActive) {
        fetchLeads();
      }
    };
    window.addEventListener('lead-added', handleLeadAdded);
    return () => window.removeEventListener('lead-added', handleLeadAdded);
  }, [searchParams, isActive]);

  const updateParams = (key: string, value: string) => {
    setSearchParams(prev => {
      if (value === 'all' || value === '') prev.delete(key);
      else prev.set(key, value);
      if (key !== 'page') prev.delete('page');
      return prev;
    }, { replace: true });
  };

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [consultants, setConsultants] = useState<{ id: number; name: string; status: string; avatar?: string; vacation_mode?: number }[]>([]);
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [reassignConsId, setReassignConsId] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState<boolean>(false);
  const [confirmReassignOpen, setConfirmReassignOpen] = useState<boolean>(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState<boolean>(false);
  const [blockReason, setBlockReason] = useState<string>('');
  const [compensateBlock, setCompensateBlock] = useState<boolean>(false);
  const [isBlocking, setIsBlocking] = useState<boolean>(false);
  const isTicketLead = selectedLead?.status === 'error' || selectedLead?.report_status === 'approved' || selectedLead?.report_status === 'pending';

  // Calendar View Mode States
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(searchParams.get('view') === 'calendar' ? 'calendar' : 'list');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<any>(null);
  const [dayDetailsLoading, setDayDetailsLoading] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'sales' | 'tickets' | 'blacklist'>('sales');

  const fetchCalendarStats = async () => {
    setCalendarLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const json = await fetchAPI(`get_calendar_stats&year=${year}&month=${month}&consultant=${encodeURIComponent(consultantFilter)}`);
      if (json.success) {
        setCalendarData(json.data || {});
      }
    } catch (e: any) {
      toast.error(t('Lỗi tải dữ liệu lịch: ') + e.message);
    }
    setCalendarLoading(false);
  };

  const handleDateClick = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setDayDetailsLoading(true);
    setDayDetails(null);
    try {
      const json = await fetchAPI(`get_calendar_day_details&date=${dateStr}&consultant=${encodeURIComponent(consultantFilter)}`);
      if (json.success) {
        setDayDetails(json.data);
      }
    } catch (e: any) {
      toast.error(t('Lỗi tải chi tiết ngày: ') + e.message);
    }
    setDayDetailsLoading(false);
  };

  useEffect(() => {
    if (isActive && viewMode === 'calendar') {
      fetchCalendarStats();
    }
  }, [viewMode, currentDate, consultantFilter, isActive]);

  useEffect(() => {
    if (isActive && selectedDate) {
      handleDateClick(selectedDate);
    }
  }, [consultantFilter, isActive]);

  const fetchConsultants = async () => {
    try {
      const json = await fetchAPI('get_consultants');
      if (json.success) {
        setConsultants(json.data);
      }
    } catch (e: any) {
      console.error(e.message);
    }
  };

  const fetchAccounts = async () => {
    try {
      const json = await fetchAPI('get_accounts');
      if (json.success) {
        setAllAccounts(json.data);
      }
    } catch (e: any) {
      console.error(e.message);
    }
  };

  const getUserAvatarByName = (name: string) => {
    if (!name || name === 'Hệ thống') return undefined;
    const acc = allAccounts.find(a => (a.name || a.username) === name);
    if (acc?.avatar) return acc.avatar;
    const cons = consultants.find(c => c.name === name);
    if (cons?.avatar) return cons.avatar;
    return undefined;
  };

  const fetchRounds = async () => {
    try {
      const json = await fetchAPI('get_rounds');
      if (json.success) {
        setRounds(json.data);
      }
    } catch (e: any) {
      console.error(e.message);
    }
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
        fetchLeads();
        window.dispatchEvent(new CustomEvent('lead-added'));
      } else {
        toast.error(t('Lỗi: ') + (res.message || t('Không thể giao lại'))); // BUG-03 fix
      }
    } catch (err: any) {
      toast.error(t('Đã xảy ra lỗi: ') + err.message); // BUG-03 fix
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
        fetchLeads();
        window.dispatchEvent(new CustomEvent('lead-added'));
      } else {
        toast.error(t('Lỗi: ') + (res.message || t('Không thể chặn khách hàng')));
      }
    } catch (err: any) {
      toast.error(t('Đã xảy ra lỗi: ') + err.message);
    }
    setIsBlocking(false);
  };

  const ITEMS_PER_PAGE = 50;

  // BUG-05 fix: Implement CSV export using Backend Stream to prevent browser/server OOM
  const handleExportCSV = () => {
    if (localStorage.getItem('DOMATION_DEMO_MODE') === 'true') {
      toast.loading(t('Đang chuẩn bị dữ liệu xuất CSV (Demo)...'), { id: 'export' });
      try {
        if (leads.length === 0) {
          toast.error(t('Không có dữ liệu để xuất!'), { id: 'export' });
          return;
        }

        const headers = [t('ID'), t('Họ Tên'), t('SĐT'), t('Email'), t('Vòng'), t('Phân bổ cho'), t('Trạng thái'), t('Nguồn'), t('Ghi chú'), t('Thời gian')];
        const rows = leads.map(lead => [
          lead.id,
          lead.name,
          lead.phone,
          lead.email,
          lead.round_name || '',
          lead.assigned_to_name || t('Chưa phân bổ'),
          lead.status === 'assigned' ? t('Đã chia') :
            lead.status === 'compensation' ? t('Data Bù') :
              lead.status === 'pending' ? t('Chờ chia') :
                lead.status === 'fallback' ? t('Fallback') :
                  lead.status === 'silent' ? t('Chỉ đồng bộ') :
                    lead.status === 'reminder' ? t('Nhắc lại') :
                      lead.status === 'pending_approval' ? t('Tạm giữ') :
                        lead.status === 'rejected' ? t('Dưới chuẩn') : lead.status,
          lead.source || '',
          lead.note || '',
          lead.created_at
        ]);

        const csvContent = "\uFEFF" + [
          headers.join(','),
          ...rows.map(row => row.map(val => {
            const str = String(val === null || val === undefined ? '' : val).replace(/"/g, '""');
            return `"${str}"`;
          }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `export_${new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(t('Đã tải xuống file CSV an toàn!'), { id: 'export' });
      } catch (err) {
        toast.error(t('Có lỗi xảy ra khi xuất dữ liệu'), { id: 'export' });
      }
      return;
    }

    toast.loading(t('Đang chuẩn bị dữ liệu xuất CSV...'), { id: 'export' });
    try {
      const token = localStorage.getItem('domation_token') || '';
      const baseUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api.php` : 'https://open.domation.net/sale_data/api.php';
      const exportUrl = `${baseUrl}?action=export_csv&token=${encodeURIComponent(token)}&date=${encodeURIComponent(dateFilter)}&status=${encodeURIComponent(statusFilter)}&consultant=${encodeURIComponent(consultantFilter)}&round=${encodeURIComponent(roundFilter)}&search=${encodeURIComponent(searchTerm)}`;

      const link = document.createElement('a');
      link.href = exportUrl;
      link.setAttribute('download', `export_${new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(t('Đang tải xuống file CSV...'), { id: 'export' });
    } catch (err) {
      toast.error(t('Có lỗi xảy ra khi xuất dữ liệu'), { id: 'export' });
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const paginatedLeads = leads;

  const getStatusBadge = (status: string, reportStatus?: string) => {
    if (status === 'assigned' && reportStatus === 'pending') {
      return <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', border: '1px solid rgba(99, 102, 241, 0.2)' }}>{t('Ticket Review')}</span>;
    }
    if (status === 'error' && reportStatus === 'approved') {
      return <span className="badge warning">{t('Ticket')}</span>;
    }
    switch (status) {
      case 'assigned': return <span className="badge success">{t('Đã chia')}</span>;
      case 'compensation': return <span className="badge purple">{t('Data Bù')}</span>;
      case 'pending_work_hours': return <span className="badge warm">{t('Chờ giờ làm')}</span>;
      case 'error': return <span className="badge danger">{t('Ticket')}</span>;
      case 'pending': return <span className="badge warning">{t('Chờ chia')}</span>;
      case 'reminder': return <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>{t('Nhắc lại')}</span>;
      case 'duplicate': return <span className="badge danger">{t('Trùng lặp')}</span>;
      case 'rule_6_month': return <span className="badge cold">{t('Quy định 6 tháng')}</span>;
      case 'silent': return <span className="badge cold">{t('Chỉ đồng bộ')}</span>;
      case 'blacklisted': return <span className="badge danger">{t('Blacklist')}</span>;
      case 'pending_approval': return <span className="badge warning">{t('Tạm giữ')}</span>;
      case 'rejected': return <span className="badge danger">{t('Dưới chuẩn')}</span>;
      case 'fallback': return <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}>{t('Fallback')}</span>;
      default: return null;
    }
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { month: 'long' }).format(currentDate);

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startOffset = (firstDayOfMonth(year, month) + 6) % 7;

  // Padding for start of month
  for (let i = 0; i < startOffset; i++) {
    days.push(<div key={`empty-start-${i}`} style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', opacity: 0.3 }}></div>);
  }

  // Days of month
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = calendarData[dateStr] || { distributed: 0, blacklist: 0, reminder: 0, error: 0, ticket_total: 0 };
    const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
    const dayOfWeek = (startOffset + d - 1) % 7;
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

    days.push(
      <div
        key={d}
        onClick={() => handleDateClick(dateStr)}
        style={{
          borderRight: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0.625rem',
          minHeight: '110px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s',
          backgroundColor: isToday
            ? 'rgba(99, 102, 241, 0.08)'
            : isWeekend
              ? 'var(--color-calendar-weekend)'
              : 'var(--color-surface)',
          cursor: 'pointer',
          position: 'relative'
        }}
        className="calendar-day-cell"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{
            fontSize: '0.8125rem',
            fontWeight: 700,
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            backgroundColor: isToday ? 'var(--color-primary)' : 'transparent',
            color: isToday ? 'white' : 'var(--color-text-light)'
          }}>{d}</span>
          {isToday && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-primary)' }}>{t('Hôm nay')}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px', alignContent: 'end' }}>
          {dayData.distributed > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 4px',
              borderRadius: '4px',
              background: 'var(--color-success-light)',
              color: 'var(--color-success)',
              fontSize: '0.6875rem',
              fontWeight: 600
            }} title={t("Đã chia")}>
              <span>Chia:</span>
              <strong>{dayData.distributed}</strong>
            </div>
          )}
          {dayData.blacklist > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 4px',
              borderRadius: '4px',
              background: 'var(--color-danger-light)',
              color: 'var(--color-danger)',
              fontSize: '0.6875rem',
              fontWeight: 600
            }} title="Blacklist">
              <span>{t('Chặn')}:</span>
              <strong>{dayData.blacklist}</strong>
            </div>
          )}
          {dayData.ticket_total > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 4px',
              borderRadius: '4px',
              background: theme === 'dark' ? 'var(--color-primary-light)' : '#f5f3ff',
              color: theme === 'dark' ? 'var(--color-primary)' : '#7c3aed',
              fontSize: '0.6875rem',
              fontWeight: 600,
              border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid #ddd6fe'
            }} title={t("Ticket lỗi")}>
              <span>Ticket:</span>
              <strong>{dayData.ticket_total}</strong>
            </div>
          )}
          {dayData.reminder > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 4px',
              borderRadius: '4px',
              background: theme === 'dark' ? 'rgba(236, 72, 153, 0.15)' : '#fce7f3',
              color: theme === 'dark' ? '#f472b6' : '#db2777',
              fontSize: '0.6875rem',
              fontWeight: 600,
              border: theme === 'dark' ? '1px solid rgba(236, 72, 153, 0.25)' : 'none'
            }} title={t("Nhắc lại")}>
              <span>{t('Nhắc')}:</span>
              <strong>{dayData.reminder}</strong>
            </div>
          )}
          {dayData.error > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 4px',
              borderRadius: '4px',
              background: 'var(--color-warning-light)',
              color: 'var(--color-warning)',
              fontSize: '0.6875rem',
              fontWeight: 600
            }} title={t("Ticket")}>
              <span>Ticket:</span>
              <strong>{dayData.error}</strong>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Padding for end of month to make a perfect grid
  const totalCells = startOffset + totalDays;
  const rows = Math.ceil(totalCells / 7);
  const targetTotalCells = rows * 7;
  const endOffset = targetTotalCells - totalCells;
  for (let i = 0; i < endOffset; i++) {
    days.push(<div key={`empty-end-${i}`} style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', opacity: 0.3 }}></div>);
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)', minHeight: 0 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem', flexShrink: 0 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={24} color="var(--color-primary)" /> {t('Quản lý Data')}
          </h1>
          <p className="page-subtitle">{t('Xem lịch sử, theo dõi tiến trình và quản lý toàn bộ dữ liệu Khách hàng.')}</p>
        </div>
        <div className="data-list-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '3px 4px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            height: '38px'
          }}>
            {/* View Mode Toggle Buttons */}
            <div className="view-mode-toggle-container" style={{
              display: 'flex',
              background: 'transparent',
              borderRadius: '8px',
              padding: '0',
              height: '32px',
              alignItems: 'center'
            }}>
              <button
                type="button"
                className={`btn-toggle-view ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'list' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'list' ? 'white' : 'var(--color-text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '28px'
                }}
              >
                <LayoutList size={13} /> <span className="hide-on-mobile">{t('Danh sách')}</span>
              </button>
              <button
                type="button"
                className={`btn-toggle-view ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={() => setViewMode('calendar')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'calendar' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'calendar' ? 'white' : 'var(--color-text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '28px'
                }}
              >
                <Calendar size={13} /> <span className="hide-on-mobile">{t('Lịch biểu')}</span>
              </button>
            </div>

            {/* Separator line */}
            <div style={{ width: '1px', height: '16px', background: 'var(--color-border)', margin: '0 6px' }} />

            {/* Compact Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 10px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-primary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: '28px'
              }}
              className="btn-export-csv-compact"
            >
              <Download size={13} /> <span>{t('Xuất')}<span className="hide-on-mobile"> CSV</span></span>
            </button>

            {/* Separator line for mobile filter toggle */}
            <div className="mobile-only" style={{ width: '1px', height: '16px', background: 'var(--color-border)', margin: '0 6px' }} />

            {/* Compact Filter Toggle Button (Mobile only) */}
            <button
              type="button"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 8px',
                borderRadius: '6px',
                border: 'none',
                background: showMobileFilters ? 'var(--color-primary-light)' : 'transparent',
                color: showMobileFilters ? 'var(--color-primary)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: '28px',
                width: '32px'
              }}
              title={showMobileFilters ? t('Ẩn bộ lọc') : t('Hiện bộ lọc')}
              className="mobile-only"
            >
              <Filter size={13} style={{ color: showMobileFilters ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className={`responsive-filter-row ${!showMobileFilters ? 'filter-hide-on-mobile' : ''}`}
        style={{
          position: 'relative',
          zIndex: 100,
          display: viewMode === 'calendar' ? 'none' : 'flex',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          flexShrink: 0,
          flexWrap: 'wrap',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
        }}
      >
        <div className="responsive-filter-item" style={{ position: 'relative', width: 240 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--color-text-muted)' }} />
          <input
            className="form-input"
            placeholder={t("Tìm theo tên, SĐT, email...")}
            style={{ paddingLeft: 36, width: '100%', height: 38, fontSize: '0.875rem' }}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>

        <div className="responsive-filter-item">
          <CustomSelect
            options={[
              { value: 'all', label: t('Tất cả thời gian'), icon: <Clock size={16} /> },
              { value: 'today', label: t('Hôm nay') },
              { value: 'yesterday', label: t('Hôm qua') },
              { value: 'this_week', label: t('Tuần này') },
              { value: 'last_week', label: t('Tuần trước') },
              { value: 'two_weeks_ago', label: t('Tuần trước nữa') },
              { value: '7days', label: t('7 ngày qua') },
              { value: '30days', label: t('30 ngày qua') },
              { value: 'this_month', label: t('Tháng này') },
              { value: 'last_month', label: t('Tháng trước') }
            ]}
            value={dateFilter}
            onChange={val => updateParams('date', val.toString())}
            width={160}
          />
        </div>

        <div className="responsive-filter-item">
          <CustomSelect
            options={[
              { value: 'all', label: t('Tất cả trạng thái'), icon: <Filter size={16} /> },
              { value: 'assigned', label: t('Đã chia') },
              { value: 'compensation', label: t('Data Bù') },
              { value: 'pending_work_hours', label: t('Chờ giờ làm') },
              { value: 'pending', label: t('Chờ chia') },
              { value: 'reminder', label: t('Nhắc lại') },
              { value: 'silent', label: t('Chỉ đồng bộ') },
              { value: 'error', label: t('Ticket') },
              { value: 'blacklisted', label: t('Blacklist') },
              { value: 'pending_approval', label: t('Tạm giữ') },
              { value: 'rejected', label: t('Dưới chuẩn') }
            ]}
            value={statusFilter.includes(',') ? statusFilter.split(',') : [statusFilter]}
            onChange={val => {
              const nextVal = Array.isArray(val)
                ? (val.includes('all') ? 'all' : val.join(','))
                : val.toString();
              updateParams('status', nextVal);
            }}
            multiple={true}
            width={170}
          />
        </div>

        <div className="responsive-filter-item">
          <CustomSelect
            options={[
              { value: 'all', label: t('Tất cả vòng'), icon: <Tag size={16} /> },
              ...rounds.map(r => ({
                value: r.round_name,
                label: r.round_name
              }))
            ]}
            value={roundFilter}
            onChange={val => updateParams('round', val.toString())}
            width={160}
          />
        </div>

        <div className="responsive-filter-item">
          <CustomSelect
            options={[
              { value: 'all', label: t('Tất cả TVV'), icon: <User size={16} /> },
              ...consultants.map(c => ({
                value: c.name,
                label: c.name,
                avatar: c.avatar
              }))
            ]}
            value={consultantFilter}
            onChange={val => updateParams('consultant', val.toString())}
            showAvatars={true}
            searchable={true}
            width={180}
          />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          {t('Tổng cộng')}: <strong style={{ color: 'var(--color-text)', marginLeft: 4 }}>{totalCount}</strong> {t('data')}
        </div>
      </div>

      {/* Table */}
      {viewMode === 'calendar' ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} className="fade-in-view">
          {/* Calendar Header / Control */}
          <div className="mobile-stack" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            marginBottom: '1rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            flexShrink: 0,
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '2px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={prevMonth}
                  style={{ width: 34, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', textTransform: 'capitalize', minWidth: 140, justifyContent: 'center' }}>
                  {monthName} {year}
                </span>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={nextMonth}
                  style={{ width: 34, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button
                type="button"
                className="btn outline"
                onClick={() => setCurrentDate(new Date())}
                style={{ height: 36, padding: '0 0.85rem', fontSize: '0.8rem', fontWeight: 600 }}
              >
                {t('Hôm nay')}
              </button>

              <CustomSelect
                options={[
                  { value: 'all', label: t('Tất cả TVV'), icon: <User size={16} /> },
                  ...consultants.map(c => ({
                    value: c.name,
                    label: c.name,
                    avatar: c.avatar
                  }))
                ]}
                value={consultantFilter}
                onChange={val => updateParams('consultant', val.toString())}
                showAvatars={true}
                searchable={true}
                width={180}
              />
            </div>

            {/* Calendar Legend */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></span>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('Đã chia')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-danger)' }}></span>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('Blacklist')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7c3aed' }}></span>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('Ticket lỗi')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#db2777' }}></span>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('Nhắc lại')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-warning)' }}></span>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('Ticket')}</span>
              </div>
            </div>
          </div>

          {/* Calendar Body */}
          <div className="responsive-table-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, minWidth: 700, overflow: 'hidden' }}>
              {/* Calendar Grid Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                background: 'var(--color-border-light)',
                borderBottom: '1px solid var(--color-border)',
                padding: '8px 0',
                flexShrink: 0
              }}>
                {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map(wd => (
                  <div key={wd} style={{ padding: '4px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: wd === 'CN' ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                    <span className="hide-on-mobile">{t(wd)}</span>
                    <span className="mobile-only">{wd === 'CN' ? t('CN') : t(wd.replace('Thứ ', 'T'))}</span>
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gridAutoRows: 'minmax(110px, 1fr)',
                overflowY: 'auto'
              }} className="custom-scrollbar">
                {calendarLoading ? (
                  <div style={{ gridColumn: 'span 7', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', flexDirection: 'column', gap: 12 }}>
                    <RefreshCw size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Đang tải dữ liệu lịch biểu...')}</span>
                  </div>
                ) : days}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card fade-in-view mobile-flat-container" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: isMobile ? 'visible' : 'auto' }} className="table-wrap custom-scrollbar">
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0 5rem 0' }}>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <div key={`skel-${i}`} style={{ padding: '1rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border-light)', animation: 'pulse 1.5s infinite', opacity: 0.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-border)' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ width: 100, height: 14, background: 'var(--color-border)', borderRadius: 4, marginBottom: 6 }} />
                          <div style={{ width: 70, height: 10, background: 'var(--color-border-light)', borderRadius: 4 }} />
                        </div>
                      </div>
                      <div style={{ width: '100%', height: 1, background: 'var(--color-border-light)', margin: '8px 0' }} />
                      <div style={{ width: 150, height: 12, background: 'var(--color-border-light)', borderRadius: 4 }} />
                    </div>
                  ))
                ) : paginatedLeads.length > 0 ? (
                  paginatedLeads.map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      style={{
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        borderRadius: '12px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)';
                        e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.01)';
                        e.currentTarget.style.borderColor = 'var(--color-border-light)';
                      }}
                    >
                      {/* Top Row: Avatar + Name + Status Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                          <Avatar name={lead.name} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {lead.name}
                            </div>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          {getStatusBadge(lead.status, lead.report_status)}
                          {lead.status !== 'assigned' && lead.report_status === 'pending' && (
                            <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700, background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d' }}>
                              {t('Chờ duyệt')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle row: Source & Received Time */}
                      <div style={{
                        borderTop: '1px dotted var(--color-border-light)',
                        paddingTop: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)'
                      }}>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>{t('Nguồn')}: </span>
                          <span>{lead.source || 'N/A'}</span>
                          {lead.type && lead.type !== '-' && <span style={{ color: '#94a3b8' }}> ({lead.type})</span>}
                        </div>
                        <div style={{ textAlign: 'right', color: '#64748b', fontSize: '0.65rem' }}>
                          {lead.created_at}
                        </div>
                      </div>

                      {/* Bottom row: Phân bổ cho */}
                      <div style={{
                        borderTop: '1px solid var(--color-border-light)',
                        paddingTop: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>{t('Giao cho')}:</span>
                          {lead.status === 'pending_approval' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Avatar src="/imgs/warn_icon.png" name="Domation AI - Screener" size={20} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Domation AI - Screener</span>
                            </div>
                          ) : lead.status === 'fallback' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Avatar src="https://crm-domation.vercel.app/LOGO.jpg" name="Domation AI" size={20} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Domation AI</span>
                            </div>
                          ) : lead.status === 'rejected' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Avatar src="https://crm-domation.vercel.app/LOGO.jpg" name="Domation AI - Evaluator" size={20} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Domation AI - Evaluator</span>
                            </div>
                          ) : lead.status === 'blacklisted' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Avatar src="/imgs/angry_icon.jpg" name="Domation AI - Angry" size={20} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Domation AI - Angry</span>
                            </div>
                          ) : lead.assigned_to_name !== '-' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Avatar src={lead.assigned_to_avatar} name={lead.assigned_to_name} size={20} aiScreened={!!(lead.ai_screener_status && lead.ai_screener_status !== 'not_screened')} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{lead.assigned_to_name}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                          )}
                        </div>
                        {lead.round_name && lead.round_name !== '-' && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: '#e0e7ff',
                            color: '#4338ca',
                            fontSize: '0.65rem',
                            fontWeight: 700
                          }}>
                            {lead.round_name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    {t('Không tìm thấy dữ liệu phù hợp.')}
                  </div>
                )}
              </div>
            ) : (
              <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>{t('Khách hàng')}</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>{t('Liên hệ')}</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>{t('Trạng thái')}</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{t('Phân bổ cho')}</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>{t('Thời gian nhận')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? [...Array(8)].map((_, i) => (
                  <tr key={`skel-${i}`}>
                    <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-border)', animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                        <div>
                          <div style={{ width: 120, height: 16, background: 'var(--color-border)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                          <div style={{ width: 80, height: 12, background: 'var(--color-border-light)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ width: 100, height: 16, background: 'var(--color-border)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                      <div style={{ width: 140, height: 12, background: 'var(--color-border-light)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                    </td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ width: 80, height: 24, background: 'var(--color-border)', borderRadius: 12, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                    </td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-border)', animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                        <div style={{ width: 90, height: 14, background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                      </div>
                    </td>
                    <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <div style={{ width: 110, height: 14, background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                    </td>
                  </tr>
                )) : paginatedLeads.length > 0 ? paginatedLeads.map(lead => {
                  return (
                    <tr
                      key={lead.id}
                      className="lead-row"
                      onClick={() => setSelectedLead(lead)}
                      style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar name={lead.name} size={32} />
                          <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{lead.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                          {maskPhone(lead.phone)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{maskEmail(lead.email)}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                          {getStatusBadge(lead.status, lead.report_status)}
                          {lead.status !== 'assigned' && lead.report_status === 'pending' && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d' }}>{t('Đang chờ duyệt')}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                        {lead.status === 'pending_approval' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar src="/imgs/warn_icon.png" name="Domation AI - Screener" size={32} />
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Domation AI - Screener</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('Chờ duyệt')}</div>
                            </div>
                          </div>
                        ) : lead.status === 'fallback' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar src="https://crm-domation.vercel.app/LOGO.jpg" name="Domation AI" size={32} />
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Domation AI</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('Fallback')}</div>
                            </div>
                          </div>
                        ) : lead.status === 'rejected' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar src="https://crm-domation.vercel.app/LOGO.jpg" name="Domation AI - Evaluator" size={32} />
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Domation AI - Evaluator</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('(Lọc khớp dưới chuẩn)')}</div>
                            </div>
                          </div>
                        ) : lead.status === 'blacklisted' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar src="/imgs/angry_icon.jpg" name="Domation AI - Angry" size={32} />
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Domation AI - Angry</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('Blacklist')}</div>
                            </div>
                          </div>
                        ) : lead.assigned_to_name !== '-' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar src={lead.assigned_to_avatar} name={lead.assigned_to_name} size={32} aiScreened={!!(lead.ai_screener_status && lead.ai_screener_status !== 'not_screened')} />
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{lead.assigned_to_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                {(lead.status === 'reminder' && (!lead.round_name || lead.round_name === '-')) ? 'Reminder' : lead.round_name}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>{lead.created_at}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                      {t('Không tìm thấy dữ liệu phù hợp.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          </div>
          {/* Pagination */}
          {totalPages > 0 && (
            <div className="responsive-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', flexShrink: 0 }}>
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
      )}

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
                          {t('Chặn')}
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>ID: #{selectedLead.id}</div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ background: 'var(--color-bg)', padding: '0.625rem 0.75rem', borderRadius: 10, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}><Phone size={12} /> Phone</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {user?.role === 'admin' ? selectedLead.phone : maskPhone(selectedLead.phone)}
                    </div>
                  </div>
                  <div style={{ background: 'var(--color-bg)', padding: '0.625rem 0.75rem', borderRadius: 10, border: '1px solid var(--color-border-light)', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}><Mail size={12} /> Email</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={selectedLead.email}>
                      {user?.role === 'admin' ? selectedLead.email : maskEmail(selectedLead.email)}
                    </div>
                  </div>
                  <div style={{ background: 'var(--color-bg)', padding: '0.625rem 0.75rem', borderRadius: 10, border: '1px solid var(--color-border-light)', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}><ExternalLink size={12} /> {t('Nguồn')}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={selectedLead.source}>{selectedLead.source}</div>
                  </div>
                  <div style={{ background: 'var(--color-bg)', padding: '0.625rem 0.75rem', borderRadius: 10, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}><Tag size={12} /> {t('Trạng thái')}</div>
                    <div>
                      {getStatusBadge(selectedLead.status, selectedLead.report_status)}
                    </div>
                  </div>
                </div>

                {(() => {
                  const { cleanNote, errorNotes, blacklistNotes, warningNotes, aiDecisionNotes } = parseNote(selectedLead.note || '');
                  return (
                    <>
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
                        background: theme === 'dark' ? 'rgba(245, 158, 11, 0.08)' : 'linear-gradient(135deg, #fefce8 0%, #fffbeb 100%)',
                        border: theme === 'dark' ? '1px solid rgba(245, 158, 11, 0.15)' : '1px solid #fef3c7',
                        padding: '1.25rem',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: theme === 'dark' ? 'none' : '0 4px 15px rgba(245, 158, 11, 0.03)'
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
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme === 'dark' ? '#fbbf24' : '#92400e', letterSpacing: '-0.01em' }}>{t('Ghi chú & Phân loại')}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '0.85rem', color: theme === 'dark' ? '#dadada' : '#78350f' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', marginRight: '6px' }}>{t('Loại Data:')}</span>
                            <span style={{ fontWeight: 600 }}>{selectedLead.type !== '-' ? selectedLead.type : t('Không có')}</span>
                          </div>

                          <div style={{ borderTop: theme === 'dark' ? '1px dashed rgba(245, 158, 11, 0.2)' : '1px dashed rgba(217, 119, 6, 0.15)', paddingTop: '8px', marginTop: '4px' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', display: 'block', marginBottom: '4px' }}>{t('Nội dung ghi chú:')}</span>
                            <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#f3f4f6' : '#451a03', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontWeight: 500 }}>
                              {cleanNote ? cleanNote : <em style={{ color: theme === 'dark' ? '#cbd5e1' : '#b45309', opacity: 0.6 }}>{t('Không có ghi chú thêm')}</em>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* AI Decision Notes */}
                      {aiDecisionNotes && aiDecisionNotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          {aiDecisionNotes.map((note, index) => {
                            const parsed = parseAIDecisionNote(note);
                            
                            const isApprove = parsed.type === 'ai_approve';
                            const isBlacklist = parsed.type === 'ai_blacklist';
                            const isFallback = parsed.type === 'ai_fallback';
                            
                            let cardBg = 'rgba(239, 68, 68, 0.08)';
                            let cardBorder = '1px solid rgba(239, 68, 68, 0.15)';
                            let iconBg = 'rgba(239, 68, 68, 0.15)';
                            let iconColor = 'var(--color-danger)';
                            let titleColor = 'var(--color-danger)';
                            let titleText = t("Từ chối bởi AI");
                            let IconComponent = Sparkles;
                            
                            if (isApprove) {
                              cardBg = theme === 'dark' ? 'rgba(16, 185, 129, 0.08)' : 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)';
                              cardBorder = theme === 'dark' ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #a7f3d0';
                              iconBg = theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5';
                              iconColor = 'var(--color-success)';
                              titleColor = 'var(--color-success)';
                              titleText = t("Duyệt bởi AI");
                              IconComponent = CheckCircle2;
                            } else if (isBlacklist) {
                              cardBg = 'rgba(0, 0, 0, 0.2)';
                              cardBorder = '1px solid rgba(255, 255, 255, 0.08)';
                              iconBg = 'rgba(255, 255, 255, 0.1)';
                              iconColor = '#94a3b8';
                              titleColor = '#cbd5e1';
                              titleText = t("Tự động chặn bởi AI (Blacklist)");
                              IconComponent = ShieldAlert;
                            } else if (isFallback) {
                              cardBg = theme === 'dark' ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb';
                              cardBorder = theme === 'dark' ? '1px solid rgba(245, 158, 11, 0.15)' : '1px solid #fca5a5';
                              iconBg = theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#ffe4e6';
                              iconColor = 'var(--color-warning)';
                              titleColor = 'var(--color-warning)';
                              titleText = t("Xác nhận dưới chuẩn (Fallback)");
                              IconComponent = AlertTriangle;
                            }

                            return (
                              <div key={index} style={{
                                background: cardBg,
                                border: cardBorder,
                                padding: '0.875rem 1rem',
                                borderRadius: '14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                boxShadow: theme === 'dark' ? 'none' : '0 2px 8px rgba(0,0,0,0.02)'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ background: iconBg, padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor }}>
                                      <IconComponent size={15} />
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: titleColor }}>{titleText}</span>
                                  </div>
                                </div>

                                <div style={{ fontSize: '0.8125rem', color: theme === 'dark' ? 'var(--color-text-light)' : '#334155' }}>
                                  <strong>{t("Lý do:")}</strong> <span style={{ fontWeight: 600 }}>{parsed.reason || t("Không rõ")}</span>
                                </div>

                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '12px', 
                                  paddingTop: '0.5rem', 
                                  borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.04)', 
                                  flexWrap: 'wrap'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Avatar src={getUserAvatarByName(parsed.admin)} name={parsed.admin} size={16} />
                                    <span>{t("Admin phụ trách: ")}<strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{parsed.admin}</strong></span>
                                  </div>
                                  <span style={{ color: theme === 'dark' ? '#374151' : '#cbd5e1', fontSize: '0.75rem' }}>•</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Clock size={13} style={{ opacity: 0.7 }} />
                                    <span>{t("Thời gian: ")}<strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{parsed.time}</strong></span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Error Notes (Approved / Rejected) */}
                      {errorNotes.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
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
                            let reasonLabel = isApproved ? t('Lý do duyệt:') : t('Lý do từ chối:');

                            if (cleanReason.startsWith('Lý do duyệt:')) {
                              reasonLabel = t('Lý do duyệt:');
                              cleanReason = cleanReason.replace(/^Lý do duyệt:/, '').trim();
                            } else if (cleanReason.startsWith('Lý do từ chối:')) {
                              reasonLabel = t('Lý do từ chối:');
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
                                  <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#cbd5e1' : '#1e293b', fontWeight: 500, lineHeight: 1.5 }}>
                                    {t('Lỗi: ')}<span style={{ fontWeight: 600, color: colors.text }}>{coreError}</span>
                                  </div>
                                  {actionReason && (
                                    <div style={{
                                      fontSize: '0.85rem',
                                      color: theme === 'dark' ? '#9ca3af' : '#475569',
                                      fontWeight: 400,
                                      lineHeight: 1.5,
                                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.4)',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: theme === 'dark' ? '1px dashed rgba(255, 255, 255, 0.08)' : '1px dashed rgba(0, 0, 0, 0.05)',
                                      marginTop: 2
                                    }}>
                                      <strong>{reasonLabel}</strong> {cleanReason}
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
                                  borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.04)',
                                  flexWrap: 'wrap'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Avatar src={getUserAvatarByName(displayAdmin)} name={displayAdmin} size={16} />
                                    <span>{t('Xử lý bởi: ')}<strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{displayAdmin}</strong></span>
                                  </div>
                                  <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>•</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Clock size={13} style={{ opacity: 0.7 }} />
                                    <span>{t('Thời gian: ')}<strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{displayTime}</strong></span>
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
                                      color: theme === 'dark' ? '#9ca3af' : '#1e293b',
                                      fontWeight: 500,
                                      lineHeight: 1.5,
                                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.4)',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: theme === 'dark' ? '1px dashed rgba(255, 255, 255, 0.08)' : '1px dashed rgba(0, 0, 0, 0.05)'
                                    }}>
                                      <strong>{t('Lý do chặn:')}</strong> <span style={{ color: blacklistColors.text, fontWeight: 600 }}>{parsed.reason}</span>
                                    </div>
                                  )}
                                </div>

                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  paddingTop: '0.75rem',
                                  marginTop: '0.25rem',
                                  borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.04)',
                                  flexWrap: 'wrap'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Avatar src={getUserAvatarByName(parsed.admin)} name={parsed.admin} size={16} />
                                    <span>{t('Chặn bởi: ')}<strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{parsed.admin}</strong></span>
                                  </div>
                                  <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>•</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                    <Clock size={13} style={{ opacity: 0.7 }} />
                                    <span>{t('Thời gian: ')}<strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{parsed.time}</strong></span>
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
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>{t('Thông tin Phân bổ')}</h3>

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

                {selectedLead.status === 'pending_approval' ? (
                  <div style={{
                    background: theme === 'dark' ? 'rgba(245, 158, 11, 0.08)' : 'linear-gradient(135deg, #fefce8 0%, #fffbeb 100%)',
                    border: theme === 'dark' ? '1.5px solid rgba(245, 158, 11, 0.2)' : '1.5px solid #fcd34d',
                    padding: '1.25rem',
                    borderRadius: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar src="/imgs/warn_icon.png" name="Domation AI - Screener" size={36} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#d97706', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{t('Đánh giá')}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: theme === 'dark' ? '#f3f4f6' : '#78350f' }}>Domation AI - Screener</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Đánh giá')}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                          {selectedLead.ai_evaluation || extractManualReason(selectedLead.note || '') || t('Tạm giữ')}
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Trạng thái phân bổ')}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('Chờ duyệt')}</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
                          <Clock size={12} /> {t('Thời gian nhận')}
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.created_at}</div>
                      </div>
                    </div>
                  </div>
                ) : selectedLead.status === 'rejected' ? (
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1.5px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar src="https://crm-domation.vercel.app/LOGO.jpg" name="Domation AI - Evaluator" size={36} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{t('Đánh giá')}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Domation AI - Evaluator</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Đánh giá')}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-danger)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                          {selectedLead.ai_evaluation || extractManualReason(selectedLead.note || '') || t('(Lọc khớp dưới chuẩn)')}
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Trạng thái phân bổ')}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('(Lọc khớp dưới chuẩn)')}</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
                          <Clock size={12} /> {t('Thời gian nhận')}
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.created_at}</div>
                      </div>
                    </div>
                  </div>
                ) : selectedLead.status === 'blacklisted' ? (
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1.5px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar src="/imgs/angry_icon.jpg" name="Domation AI - Angry" size={36} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{t('Đánh giá')}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Domation AI - Angry</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Đánh giá')}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-danger)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                          {selectedLead.ai_evaluation || extractManualReason(selectedLead.note || '') || t('Blacklist')}
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Trạng thái phân bổ')}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('Blacklist')}</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
                          <Clock size={12} /> {t('Thời gian nhận')}
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.created_at}</div>
                      </div>
                    </div>
                  </div>
                ) : selectedLead.assigned_to_name !== '-' ? (
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1.5px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar src={selectedLead.assigned_to_avatar} name={selectedLead.assigned_to_name} size={40} aiScreened={!!(selectedLead.ai_screener_status && selectedLead.ai_screener_status !== 'not_screened')} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{t('Người tiếp nhận')}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{selectedLead.assigned_to_name}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Vòng chia')}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                          {(selectedLead.status === 'reminder' && (!selectedLead.round_name || selectedLead.round_name === '-')) ? 'Reminder' : selectedLead.round_name}
                        </div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
                          <Clock size={12} /> {t('Thời gian nhận')}
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.created_at}</div>
                      </div>
                      {selectedLead.status === 'reminder' && selectedLead.last_activity_at && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
                            <Clock size={12} /> {t('Thời gian nhắc lại từ:')}
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f59e0b' }}>
                            {selectedLead.last_activity_at}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'var(--color-bg)', padding: '1.5rem', borderRadius: 12, textAlign: 'center', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                    {t('Chưa có thông tin phân bổ cho Khách hàng này.')}
                  </div>
                )}

                {/* Reassignment section */}
                <div style={{ marginTop: '1.5rem', background: 'var(--color-bg)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={16} color="var(--color-primary)" /> {t('Giao lại Tư vấn viên')}
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
                    {t('Thay đổi người tiếp nhận (Không ảnh hưởng lượt chia).')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <CustomSelect
                      options={[
                        { value: '', label: t('-- Chọn Tư vấn viên --') },
                        ...consultants
                          .filter(c => c.name !== selectedLead?.assigned_to_name)
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
                      {t('Xác nhận giao')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </CustomModal>

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
                {t('Bạn có chắc chắn muốn chuyển quyền chăm sóc Lead')} <strong>"{selectedLead?.name}"</strong> {t('sang cho Tư vấn viên')} <strong>"{consultants.find(c => Number(c.id) === Number(reassignConsId))?.name}"</strong>?
              </p>
              {selectedLead?.assigned_to_name && selectedLead.assigned_to_name !== '-' && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 8, marginBottom: 0 }}>
                  {t('Tư vấn viên hiện tại:')} <strong>{selectedLead.assigned_to_name}</strong>. {t('Chọn hình thức giao lại:')}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="btn outline" onClick={() => setConfirmReassignOpen(false)}>{t('Hủy')}</button>

            {selectedLead?.assigned_to_name && selectedLead.assigned_to_name !== '-' ? (
              <>
                <button
                  className="btn secondary"
                  onClick={() => handleReassign(false)}
                  style={{ background: '#f59e0b', color: '#fff', border: 'none' }}
                  disabled={isReassigning}
                >
                  {t('Giao lại luôn')}
                </button>
                <button
                  className="btn success"
                  onClick={() => handleReassign(true)}
                  style={{ background: '#10b981', color: '#fff', border: 'none' }}
                  disabled={isReassigning}
                >
                  {t('Giao lại và bù vòng cho TVV')}
                </button>
              </>
            ) : (
              <button
                className="btn primary"
                onClick={() => handleReassign(false)}
                disabled={isReassigning}
              >
                {t('Xác nhận chuyển')}
              </button>
            )}
          </div>
        </div>
      </CustomModal>

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
              width: 40, height: 40, borderRadius: '50%', background: '#fee2e2',
              color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p style={{ color: 'var(--color-text)', lineHeight: 1.6, fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>
                {t('Bạn có chắc chắn muốn chặn khách hàng')} "{selectedLead?.name}"?
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 4, marginBottom: 0 }}>
                {t('Số điện thoại/Email của khách hàng sẽ được thêm vào Blacklist toàn cục để chặn nhận trùng trong tương lai.')}
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

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t('Hình thức chặn:')}</div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="blockType"
                checked={!compensateBlock}
                onChange={() => setCompensateBlock(false)}
                style={{ marginTop: '3px' }}
              />
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('Chỉ đưa vào danh sách đen (Blacklist)')}</span>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>{t('Không thực hiện đền bù data cho Sale.')}</p>
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
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('Chặn và Bù vòng cho Sale')}</span>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                  {t('Đền bù 1 lượt data vòng')} <strong>"{selectedLead?.round_name}"</strong> {t('cho Sale')} <strong>"{selectedLead?.assigned_to_name}"</strong>.
                </p>
              </div>
            </label>

            {selectedLead?.assigned_to_name === '-' && (
              <div style={{ color: '#ea580c', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} /> {t('Lead chưa phân bổ cho Sale nào, không thể chọn hình thức Bù vòng.')}
              </div>
            )}

            {isTicketLead && (
              <div style={{ color: '#ea580c', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} /> {t('Lead đã có trạng thái Ticket (lỗi), không thể đền bù thêm khi chặn.')}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t('Lý do chặn')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
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
              {t('Hủy')}
            </button>
            <button
              className="btn danger"
              onClick={handleBlockLead}
              disabled={isBlocking || !blockReason.trim()}
              style={{ background: '#ef4444', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {isBlocking ? <RefreshCw size={14} className="spin" /> : null}
              {t('Xác nhận chặn')}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Day Details Modal */}
      <CustomModal
        isOpen={selectedDate !== null}
        onClose={() => {
          setSelectedDate(null);
          setDayDetails(null);
          setActiveModalTab('sales');
        }}
        title={`${t('Chi tiết hoạt động ngày')} ${selectedDate ? new Date(selectedDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}`}
        width="900px"
      >
        {dayDetailsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', flexDirection: 'column', gap: 12 }}>
            <RefreshCw size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Đang tải dữ liệu chi tiết...')}</span>
          </div>
        ) : dayDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '580px', margin: '-1.5rem', overflow: 'hidden' }}>
            {/* Modal Tabs */}
            <div style={{
              display: 'flex',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '3px',
              gap: '4px',
              flexShrink: 0,
              margin: '1.5rem 1.5rem 1rem 1.5rem',
              height: '38px',
              alignItems: 'center'
            }}>
              <button
                type="button"
                onClick={() => setActiveModalTab('sales')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeModalTab === 'sales' ? 'var(--color-primary)' : 'transparent',
                  color: activeModalTab === 'sales' ? 'white' : 'var(--color-text-muted)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '32px',
                  flex: 1
                }}
                className="modal-tab-button"
              >
                <span>{t('Phân bổ cho Sale')}</span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: activeModalTab === 'sales' ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-border-light)',
                  color: activeModalTab === 'sales' ? 'white' : 'var(--color-text-muted)',
                  padding: '1px 6px',
                  borderRadius: '5px',
                  transition: 'all 0.2s'
                }}>
                  {dayDetails.sales?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('tickets')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeModalTab === 'tickets' ? 'var(--color-primary)' : 'transparent',
                  color: activeModalTab === 'tickets' ? 'white' : 'var(--color-text-muted)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '32px',
                  flex: 1
                }}
                className="modal-tab-button"
              >
                <span>{t('Ticket Lỗi')}</span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: activeModalTab === 'tickets' ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-border-light)',
                  color: activeModalTab === 'tickets' ? 'white' : 'var(--color-text-muted)',
                  padding: '1px 6px',
                  borderRadius: '5px',
                  transition: 'all 0.2s'
                }}>
                  {dayDetails.tickets?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('blacklist')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeModalTab === 'blacklist' ? 'var(--color-primary)' : 'transparent',
                  color: activeModalTab === 'blacklist' ? 'white' : 'var(--color-text-muted)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '32px',
                  flex: 1
                }}
                className="modal-tab-button"
              >
                <span>{t('Blacklist & Lỗi Hệ Thống')}</span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: activeModalTab === 'blacklist' ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-border-light)',
                  color: activeModalTab === 'blacklist' ? 'white' : 'var(--color-text-muted)',
                  padding: '1px 6px',
                  borderRadius: '5px',
                  transition: 'all 0.2s'
                }}>
                  {dayDetails.blacklist_logs?.length || 0}
                </span>
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem 1.5rem' }} className="custom-scrollbar">
              {activeModalTab === 'sales' && (
                <div>
                  {dayDetails.sales && dayDetails.sales.length > 0 ? (
                    <div className="premium-table-container">
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th style={{ width: '45%' }}>{t('Tư vấn viên')}</th>
                            <th style={{ width: '25%' }}>{t('Vòng')}</th>
                            <th style={{ width: '15%' }}>{t('Trạng thái')}</th>
                            <th style={{ width: '15%', textAlign: 'right' }}>{t('Số lượng data')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayDetails.sales.map((item: any, idx: number) => (
                            <tr key={idx}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                  <Avatar src={item.sale_avatar} name={item.sale_name} size={30} />
                                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{item.sale_name}</span>
                                </div>
                              </td>
                              <td>
                                <span style={{
                                  background: 'var(--color-primary-light)',
                                  color: 'var(--color-primary)',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600
                                }}>
                                  {item.round_name}
                                </span>
                              </td>
                              <td>{getStatusBadge(item.status)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{item.count}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                      <User size={40} style={{ marginBottom: 12, color: 'var(--color-text-muted)', opacity: 0.6 }} />
                      <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t('Không có lịch sử chia data cho tư vấn viên nào vào ngày này.')}</p>
                    </div>
                  )}
                </div>
              )}

              {activeModalTab === 'tickets' && (
                <div>
                  {dayDetails.tickets && dayDetails.tickets.length > 0 ? (
                    <div className="premium-table-container">
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th style={{ width: '25%' }}>{t('Khách hàng')}</th>
                            <th style={{ width: '22%' }}>{t('Tư vấn viên báo cáo')}</th>
                            <th style={{ width: '28%' }}>{t('Lý do lỗi')}</th>
                            <th style={{ width: '13%' }}>{t('Trạng thái')}</th>
                            <th style={{ width: '12%', textAlign: 'right' }}>{t('Thời gian báo')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayDetails.tickets.map((item: any, idx: number) => {
                            const showPhone = user?.role === 'admin' ? item.phone : maskPhone(item.phone);
                            return (
                              <tr key={idx}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Avatar name={item.lead_name} size={32} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{item.lead_name}</span>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                                        <Phone size={11} style={{ opacity: 0.6 }} />
                                        {showPhone}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Avatar src={item.sale_avatar} name={item.sale_name} size={28} aiScreened={!!(item.ai_screener_status && item.ai_screener_status !== 'not_screened')} />
                                    <span style={{ fontWeight: 500, color: 'var(--color-text)', fontSize: '0.85rem' }}>{item.sale_name}</span>
                                  </div>
                                </td>
                                <td>
                                  <div style={{
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-light)',
                                    lineHeight: 1.4,
                                    maxWidth: '240px',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal'
                                  }}>
                                    {item.reason}
                                  </div>
                                </td>
                                <td>
                                  {item.status === 'pending' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.2)' }}>{t('Chờ duyệt')}</span>}
                                  {item.status === 'approved' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: 'var(--color-success-light)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{t('Đã duyệt')}</span>}
                                  {item.status === 'rejected' && <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{t('Từ chối')}</span>}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                    <Clock size={11} style={{ opacity: 0.6 }} />
                                    <span>{item.created_at ? item.created_at.split(' ')[1] || item.created_at : ''}</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                      <AlertTriangle size={40} style={{ marginBottom: 12, color: 'var(--color-text-muted)', opacity: 0.6 }} />
                      <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t('Không có báo cáo ticket lỗi dữ liệu nào trong ngày này.')}</p>
                    </div>
                  )}
                </div>
              )}

              {activeModalTab === 'blacklist' && (
                <div>
                  {dayDetails.blacklist_logs && dayDetails.blacklist_logs.length > 0 ? (
                    <div className="premium-table-container">
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th style={{ width: '32%' }}>{t('Khách hàng')}</th>
                            <th style={{ width: '13%' }}>{t('Loại')}</th>
                            <th style={{ width: '43%' }}>{t('Thông điệp hệ thống')}</th>
                            <th style={{ width: '12%', textAlign: 'right' }}>{t('Thời gian')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayDetails.blacklist_logs.map((item: any, idx: number) => {
                            const showPhone = user?.role === 'admin' ? item.phone : maskPhone(item.phone);
                            const showEmail = user?.role === 'admin' ? item.email : maskEmail(item.email);
                            return (
                              <tr key={idx}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Avatar name={item.lead_name} size={32} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{item.lead_name}</span>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {showPhone && showPhone !== '-' && (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-light)' }}>
                                            <Phone size={10} style={{ opacity: 0.6 }} />
                                            {showPhone}
                                          </span>
                                        )}
                                        {showEmail && showEmail !== '-' && (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-light)' }}>
                                            <Mail size={10} style={{ opacity: 0.6 }} />
                                            {showEmail}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td>{getStatusBadge(item.status)}</td>
                                <td>
                                  <div style={{
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-light)',
                                    lineHeight: 1.4,
                                    maxWidth: '360px',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal'
                                  }}>
                                    {item.message}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                    <Clock size={11} style={{ opacity: 0.6 }} />
                                    <span>{item.received_at ? item.received_at.split(' ')[1] || item.received_at : ''}</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                      <ShieldAlert size={40} style={{ marginBottom: 12, color: 'var(--color-text-muted)', opacity: 0.6 }} />
                      <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t('Không phát hiện trường hợp Blacklist hay Lỗi hệ thống nào vào ngày này.')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border-light)',
              background: 'var(--color-bg)',
              flexShrink: 0
            }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setSelectedDate(null);
                  setDayDetails(null);
                  setActiveModalTab('sales');
                }}
              >
                {t('Đóng')}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            {t('Có lỗi xảy ra khi hiển thị chi tiết.')}
          </div>
        )}
      </CustomModal>

      <style>{`
        :root {
          --color-calendar-weekend: #f7f8fa81;
        }
        [data-theme="dark"] {
          --color-calendar-weekend: #141b2d;
        }
        .spin { animation: spin 1s linear infinite; }
        .btn-export-csv-compact:hover {
          background-color: var(--color-primary-light) !important;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .lead-row:hover { background: var(--color-bg) !important; }
        .calendar-day-cell {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }
        .calendar-day-cell:hover {
          background-color: var(--color-surface-hover) !important;
          box-shadow: inset 0 0 0 2px var(--color-primary-light), 0 8px 24px rgba(99, 102, 241, 0.08);
          z-index: 10;
          transform: translateY(-2px);
        }
        .fade-in-view {
          animation: fadeInView 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeInView {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .calendar-day-cell div > div {
          transition: all 0.15s ease-in-out;
          border-radius: 6px !important;
        }
        .calendar-day-cell div > div:hover {
          transform: scale(1.05);
          filter: brightness(0.96);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }
        
        /* Premium Table Styles for Day Details Modal */
         .premium-table-container {
          border: 1px solid var(--color-border);
          border-radius: 12px;
          overflow-x: auto;
          background: var(--color-surface);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.015);
        }
        .premium-table {
          width: 100%;
          min-width: 600px;
          border-collapse: collapse;
          text-align: left;
        }
        .premium-table th {
          background: var(--color-border-light);
          padding: 12px 16px;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid var(--color-border);
        }
        .premium-table td {
          padding: 14px 16px;
          font-size: 0.875rem;
          color: var(--color-text);
          border-bottom: 1px solid var(--color-border-light);
          vertical-align: middle;
        }
        .premium-table tr:last-child td {
          border-bottom: none;
        }
        .premium-table tr {
          transition: background-color 0.15s ease;
        }
        .premium-table tr:hover {
          background-color: var(--color-primary-light);
        }
        .modal-tab-button {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .modal-tab-button:hover {
          color: var(--color-primary) !important;
        }
      `}</style>
    </div>
  );
};
