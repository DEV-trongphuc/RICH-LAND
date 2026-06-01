import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Users, User, CheckCircle, Ticket as TicketIcon, RefreshCw, Zap, Filter, Settings2, Save, Bell, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle, Phone, Mail, Clock, Tag, CheckCircle2, XCircle, ShieldAlert, Database, Plus, Trash2, Edit2, Sparkles, Check, X, Edit, Copy, BarChart2, Scale, Calendar, Info, ArrowRight } from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, LabelList
} from 'recharts';
import toast from 'react-hot-toast';
import { fetchAPI } from '../utils/api';
import { TableSkeleton, KpiCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { Avatar } from '../components/ui/Avatar';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { withRouterFreezer } from '../components/RouterFreezer';
import { detectCountryFromPhone } from '../utils/phoneHelper';
import { NotificationPreviewModal } from '../components/ui/NotificationPreviewModal';
import { useNavigate } from 'react-router-dom';

type Lead = {
  id: number;
  lead_id?: number;
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
  reason?: string;
  report_created_at?: string;
};

const parseServerDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();
  if (trimmed.includes('T') || trimmed.includes('+') || trimmed.includes('Z')) {
    return new Date(trimmed);
  }
  const isoStr = trimmed.replace(' ', 'T') + '+07:00';
  return new Date(isoStr);
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

const TicketsInner = ({ isActive, searchParams, setSearchParams }: { isActive: boolean; searchParams: URLSearchParams; setSearchParams: any }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
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

  const activeFilter = (searchParams.get('status') || 'pending') as 'all' | 'pending' | 'approved' | 'rejected';
  const saleFilter = searchParams.get('consultant') || '';

  const getInitialDateFilter = () => {
    return localStorage.getItem('domation_global_date') || '7 ngày qua';
  };
  const dateFilter = searchParams.get('date') || getInitialDateFilter();

  const currentPage = Number(searchParams.get('page') || '1');

  const [showDateModal, setShowDateModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
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

  // Consultant stats state for details modal
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsConsultant, setStatsConsultant] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsDateMode, setStatsDateMode] = useState<string>('this_month');
  const [statsStartDate, setStatsStartDate] = useState<string>('');
  const [statsEndDate, setStatsEndDate] = useState<string>('');

  const syncDateFilterToModal = (filter: string) => {
    let mode = 'this_month';
    let start = '';
    let end = '';

    if (filter === 'Hôm nay') {
      mode = 'today';
    } else if (filter === 'Hôm qua') {
      mode = 'yesterday';
    } else if (filter === '7 ngày qua') {
      mode = '7_days';
    } else if (filter === '30 ngày qua') {
      mode = '30_days';
    } else if (filter === 'Tháng này') {
      mode = 'this_month';
    } else if (filter === 'Tháng trước') {
      mode = 'last_month';
    } else if (filter === 'Tuần này') {
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + distanceToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      mode = 'custom';
      start = monday.toISOString().split('T')[0];
      end = sunday.toISOString().split('T')[0];
    } else if (filter === 'Tuần trước') {
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const prevMonday = new Date(now);
      prevMonday.setDate(now.getDate() + distanceToMonday - 7);
      const prevSunday = new Date(prevMonday);
      prevSunday.setDate(prevMonday.getDate() + 6);

      mode = 'custom';
      start = prevMonday.toISOString().split('T')[0];
      end = prevSunday.toISOString().split('T')[0];
    } else if (filter === 'Tuần trước nữa') {
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const prev2Monday = new Date(now);
      prev2Monday.setDate(now.getDate() + distanceToMonday - 14);
      const prev2Sunday = new Date(prev2Monday);
      prev2Sunday.setDate(prev2Monday.getDate() + 6);

      mode = 'custom';
      start = prev2Monday.toISOString().split('T')[0];
      end = prev2Sunday.toISOString().split('T')[0];
    } else {
      const match = filter.match(/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/i);
      if (match) {
        mode = 'custom';
        start = match[1];
        end = match[2];
      }
    }

    setStatsDateMode(mode);
    setStatsStartDate(start);
    setStatsEndDate(end);
  };

  const fetchConsultantStats = async (consId: number, mode: string, start?: string, end?: string) => {
    setStatsLoading(true);
    try {
      let query = `get_consultant_stats&consultant_id=${consId}&date_mode=${mode}`;
      if (mode === 'custom' && start && end) {
        query += `&start_date=${start}&end_date=${end}`;
      }
      const json = await fetchAPI(query);
      if (json.success) {
        setStatsData(json);
      } else {
        toast.error(json.message || t('Lỗi khi tải báo cáo thống kê'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setStatsLoading(false);
  };

  useEffect(() => {
    if (statsModalOpen && statsConsultant) {
      if (statsDateMode !== 'custom' || (statsStartDate && statsEndDate)) {
        fetchConsultantStats(statsConsultant.id, statsDateMode, statsStartDate, statsEndDate);
      }
    }
  }, [statsModalOpen, statsConsultant, statsDateMode, statsStartDate, statsEndDate]);

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
  const [notificationStatus, setNotificationStatus] = useState<any>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [isAdminEditingLead, setIsAdminEditingLead] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    source: '',
    type: '',
    note: ''
  });
  const [isSavingLeadFields, setIsSavingLeadFields] = useState(false);

  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<'email' | 'zalo'>('email');
  const [previewSentAt, setPreviewSentAt] = useState<string>('');

  const handleCopyText = (text: string, successMessage: string, type?: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast.success(successMessage);
        if (type) {
          setCopiedType(type);
          setTimeout(() => setCopiedType(null), 1500);
        }
      })
      .catch(() => toast.error(t('Lỗi khi sao chép')));
  };

  const handleCopyFullInfo = (lead: Lead) => {
    const isUserAdmin = user?.role === 'admin';
    const displayPhone = isUserAdmin ? lead.phone : maskPhone(lead.phone);
    const displayEmail = isUserAdmin ? lead.email : maskEmail(lead.email);
    const text = [
      `${t('Họ tên')}: ${lead.name || ''}`,
      `${t('Số điện thoại')}: ${displayPhone || ''}`,
      `Email: ${displayEmail || ''}`,
      `${t('Nguồn')}: ${lead.source || ''}`,
      `${t('Loại')}: ${lead.type || ''}`,
      `${t('Ghi chú')}: ${lead.note || ''}`
    ].join('\n');
    handleCopyText(text, t('Đã sao chép toàn bộ thông tin khách hàng!'), 'full');
  };
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderChannels, setReminderChannels] = useState({ zalo: true, email: true });
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  const fetchNotificationStatus = async (leadId: number) => {
    setNotifLoading(true);
    try {
      const json = await fetchAPI(`get_lead_notification_status&lead_id=${leadId}`);
      if (json.success) {
        setNotificationStatus(json.data);
      }
    } catch (err) {
      console.error("Lỗi lấy trạng thái thông báo:", err);
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLead) {
      setNotificationStatus(null);
      fetchNotificationStatus(selectedLead.lead_id || selectedLead.id);

      setEditForm({
        name: selectedLead.name || '',
        phone: selectedLead.phone || '',
        email: selectedLead.email || '',
        source: selectedLead.source || '',
        type: selectedLead.type || '',
        note: selectedLead.note || ''
      });
      setIsAdminEditingLead(false);
    } else {
      setNotificationStatus(null);
      setIsAdminEditingLead(false);
    }
  }, [selectedLead]);

  const handleSendReminder = async () => {
    if (!selectedLead) return;
    setIsSendingReminder(true);
    try {
      const res = await fetchAPI('send_lead_reminder', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: selectedLead.lead_id || selectedLead.id,
          send_zalo: reminderChannels.zalo,
          send_email: reminderChannels.email
        })
      });
      if (res.success) {
        toast.success(res.message || t('Đã gửi nhắc nhở thành công!'));
        setIsReminderModalOpen(false);
        fetchNotificationStatus(selectedLead.lead_id || selectedLead.id);
      } else {
        toast.error(t('Lỗi: ') + (res.message || t('Không thể gửi nhắc nhở')));
      }
    } catch (err: any) {
      toast.error(t('Đã xảy ra lỗi: ') + err.message);
    }
    setIsSendingReminder(false);
  };

  const handleSaveLeadFields = async () => {
    if (!selectedLead) return;
    if (!editForm.name.trim()) {
      toast.error(t('Tên khách hàng không được để trống'));
      return;
    }
    setIsSavingLeadFields(true);
    try {
      const res = await fetchAPI('update_lead_fields', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: selectedLead.lead_id || selectedLead.id,
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          email: editForm.email.trim(),
          source: editForm.source.trim(),
          type: editForm.type.trim(),
          note: editForm.note.trim()
        })
      });
      if (res.success) {
        toast.success(t('Cập nhật thông tin khách hàng thành công!'));
        setSelectedLead({
          ...selectedLead,
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          email: editForm.email.trim(),
          source: editForm.source.trim(),
          type: editForm.type.trim(),
          note: editForm.note.trim()
        });
        setIsAdminEditingLead(false);
        fetchReports();
        window.dispatchEvent(new CustomEvent('lead-added'));
      } else {
        toast.error(t('Lỗi: ') + (res.message || t('Không thể lưu thông tin')));
      }
    } catch (err: any) {
      toast.error(t('Đã xảy ra lỗi: ') + err.message);
    } finally {
      setIsSavingLeadFields(false);
    }
  };
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
    if (key === 'date') {
      localStorage.setItem('domation_global_date', value);
      window.dispatchEvent(new CustomEvent('global-date-change', { detail: value }));
    }
    setSearchParams((prev: any) => {
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
    if (isActive) {
      const saved = localStorage.getItem('domation_global_date');
      if (saved && searchParams.get('date') !== saved) {
        setSearchParams((prev: any) => {
          prev.set('date', saved);
          return prev;
        }, { replace: true });
      }
    }
  }, [isActive]);

  useEffect(() => {
    const handleGlobalDate = (e: any) => {
      const newDate = e.detail;
      if (newDate && searchParams.get('date') !== newDate) {
        setSearchParams((prev: any) => {
          prev.set('date', newDate);
          return prev;
        }, { replace: true });
      }
    };
    window.addEventListener('global-date-change', handleGlobalDate);
    return () => window.removeEventListener('global-date-change', handleGlobalDate);
  }, [searchParams]);

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
  const hasActiveFilters = saleFilter || (dateFilter !== '7 ngày qua' && dateFilter !== 'all' && dateFilter !== '');

  const FILTER_TABS = [
    { key: 'pending', label: 'Chờ duyệt', color: '#b45309', bg: '#fef3c7' },
    { key: 'approved', label: 'Đã duyệt', color: '#065f46', bg: '#d1fae5' },
    { key: 'rejected', label: 'Đã từ chối', color: '#6b7280', bg: '#f3f4f6' },
    { key: 'all', label: 'Tất cả', color: 'var(--color-text)', bg: 'var(--color-bg)' },
  ] as const;

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <TicketIcon size={28} color="var(--color-primary)" /> {t('Ticket Lỗi Data')}
            <button
              onClick={() => setShowInfoModal(true)}
              style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                border: '1px solid var(--color-border)',
                padding: '4px 10px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'all 0.2s',
                marginLeft: '8px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--color-primary)';
                e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                e.currentTarget.style.background = 'var(--color-primary-light)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
              }}
              title={t("Xem chi tiết quy định duyệt bù")}
            >
              <Info size={14} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
            </button>
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {t('Quản lý và xét duyệt các BÁO CÁO DATA từ Tư vấn viên')}
          </p>
        </div>

        {/* Filters right aligned on same row as title on desktop */}
        <div className="responsive-hide-mobile" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Sale filter */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
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
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 200 }}>
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
              setSearchParams((prev: any) => {
                prev.delete('consultant');
                prev.delete('date');
                prev.delete('page');
                return prev;
              }, { replace: true });
            }}
              style={{
                fontSize: '0.75rem', padding: '0 12px', borderRadius: 8,
                border: '1.5px solid var(--color-danger-light)', background: 'var(--color-danger-light)',
                color: 'var(--color-danger)', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.15s',
                height: 38
              }}>
              ✕ {t('Xóa lọc')}
            </button>
          )}

          {/* Auto duyệt Toggle */}
          <div
            onClick={() => setShowAutoApproveModal(true)}
            title={t("Cấu hình quy tắc tự động duyệt")}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              height: 38,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(124,58,237,0.05)';
              const label = e.currentTarget.querySelector('.auto-approve-label') as HTMLSpanElement;
              if (label) label.style.color = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-surface)';
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
        </div>
      </div>

      <div className="mobile-filter-tabs hide-on-mobile" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {FILTER_TABS.map(tab => (
          <button key={tab.key} onClick={() => updateParams('status', tab.key)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: activeFilter === tab.key ? tab.color : 'var(--color-border)', background: activeFilter === tab.key ? tab.bg : 'transparent', color: activeFilter === tab.key ? tab.color : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
            {t(tab.label)} {`(${stats[tab.key]})`}
          </button>
        ))}

        {activeFilter === 'pending' && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--color-warning)',
            background: 'var(--color-warning-light)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginLeft: 8
          }}>
            <Sparkles size={12} /> {t('Hiển thị toàn bộ ticket chờ duyệt')}
          </div>
        )}

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

        <div style={{ width: 1, height: 16, background: 'rgba(124,58,237,0.15)', marginLeft: 8 }} />

        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(124,58,237,0.1)', marginLeft: 4 }}>
          {t('Tổng cộng:')} {totalCount} {t('tickets')}
        </span>
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

      {showMobileFilters && (
        <div className="responsive-filter-row filter-mobile-only" style={{
          position: 'relative', zIndex: 100,
          display: 'flex', gap: 12, marginTop: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center',
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

          <div className="hide-on-mobile" style={{ width: 1, height: 20, background: 'rgba(124,58,237,0.2)', margin: '0 4px' }} />

          {/* Sale filter */}
          <div className="responsive-filter-item" style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
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
              width="100%"
            />
          </div>

          {/* Date Filter */}
          <div className="responsive-filter-item" style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
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

          {activeFilter === 'pending' && (
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--color-warning)',
              background: 'var(--color-warning-light)',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              width: '100%',
              justifyContent: 'center'
            }}>
              <Sparkles size={12} /> {t('Hiển thị toàn bộ ticket chờ duyệt')}
            </div>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <button onClick={() => {
              setSearchParams((prev: any) => {
                prev.delete('consultant');
                prev.delete('date');
                prev.delete('page');
                return prev;
              }, { replace: true });
            }}
              style={{
                fontSize: '0.75rem', padding: '8px 12px', borderRadius: 10,
                border: '1.5px solid var(--color-danger-light)', background: 'var(--color-danger-light)',
                color: 'var(--color-danger)', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                boxShadow: '0 1px 4px rgba(220,38,38,0.06)',
                transition: 'all 0.15s',
                width: '100%',
                justifyContent: 'center'
              }}>
              ✕ {t('Xóa lọc')}
            </button>
          )}

          <div className="mobile-ml-0" style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            justifyContent: 'space-between',
            marginTop: '4px',
            paddingTop: '8px',
            borderTop: '1px dashed rgba(124,58,237,0.1)'
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

            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(124,58,237,0.1)' }}>
              {t('Tổng cộng:')} {totalCount} {t('tickets')}
            </span>
          </div>
        </div>
      )}

      {/* ── Table / Held leads list ── */}
      <div className="card mobile-flat-container" style={{ padding: 0, overflow: 'hidden' }}>
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
                          lead_id: r.lead_id || 0,
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
                          ai_evaluation: r.ai_evaluation,
                          reason: r.reason,
                          report_created_at: r.created_at
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
            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0 5rem 0' }}>
              {filteredReports.map(r => (
                <div
                  key={r.id}
                  onClick={() => {
                    setSelectedLead({
                      id: r.log_id || 0,
                      lead_id: r.lead_id || 0,
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
                      ai_evaluation: r.ai_evaluation,
                      reason: r.reason,
                      report_created_at: r.created_at
                    });
                  }}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  className=""
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
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', textAlign: 'right' }}>
                        {new Date(r.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}<br />
                        {new Date(r.created_at).toLocaleDateString('vi-VN')}
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
      <TicketSettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      {/* Custom Date Picker Modal */}
      <CustomModal
        isOpen={showDateModal}
        onClose={() => setShowDateModal(false)}
        title={t("Tùy chỉnh thời gian")}
        width="400px"
      >
        {showDateModal && (
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
        )}
      </CustomModal>



      {/* Reject Modal */}
      <CustomModal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title={t("Từ chối Báo cáo Lỗi")}>
        {rejectModalOpen && (
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
        )}
      </CustomModal>

      {/* Quick Message Modal */}
      <CustomModal isOpen={quickMessageOpen} onClose={() => setQuickMessageOpen(false)} title={`${t("Nhắn tin cho")} ${quickMessageTarget?.name || t("Sale")}`}>
        {quickMessageOpen && (
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
        )}
      </CustomModal>

      {/* Approve Modal */}
      <CustomModal isOpen={approveModalOpen} onClose={() => setApproveModalOpen(false)} title={t("Duyệt & Đền Bù Data")}>
        {approveModalOpen && (
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
        )}
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
            <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem', alignItems: 'start' }}>
              {/* Cột Trái: Chi Tiết */}
              <div className="sticky-column">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Avatar name={selectedLead.name} size={48} />
                    <div>
                      {isAdminEditingLead ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          placeholder={t("Nhập tên khách hàng")}
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            color: 'var(--color-text)',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-primary-light)',
                            borderRadius: '10px',
                            padding: '8px 14px',
                            width: '240px',
                            outline: 'none',
                            transition: 'all 0.2s ease-in-out',
                            boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.08)'
                          }}
                          onFocus={e => {
                            e.currentTarget.style.borderColor = 'var(--color-primary)';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.15)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.08)';
                          }}
                        />
                      ) : (
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{selectedLead.name}</h2>
                      )}
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: 4 }}>ID: #{selectedLead.id}</div>
                    </div>
                  </div>

                  <div className="detail-action-buttons">
                    {!isAdminEditingLead && (
                      <button
                        onClick={() => selectedLead && handleCopyFullInfo(selectedLead)}
                        title={t("Sao chép toàn bộ thông tin")}
                        className="detail-action-btn"
                        style={{
                          background: copiedType === 'full' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                          border: copiedType === 'full' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(59, 130, 246, 0.2)',
                          color: copiedType === 'full' ? '#10b981' : '#3b82f6',
                          boxShadow: '0 2px 6px rgba(59, 130, 246, 0.05)'
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.background = copiedType === 'full' ? '#10b981' : '#3b82f6';
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = copiedType === 'full' ? '0 6px 15px rgba(16, 185, 129, 0.2)' : '0 6px 15px rgba(59, 130, 246, 0.2)';
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.background = copiedType === 'full' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)';
                          e.currentTarget.style.color = copiedType === 'full' ? '#10b981' : '#3b82f6';
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(59, 130, 246, 0.05)';
                        }}
                      >
                        {copiedType === 'full' ? <Check size={14} /> : <Copy size={14} />}
                        {copiedType === 'full' ? t('Đã chép') : t('Sao chép')}
                      </button>
                    )}
                    {user?.role === 'admin' && (
                      <>
                        {isAdminEditingLead ? (
                          <>
                            <button
                              onClick={handleSaveLeadFields}
                              disabled={isSavingLeadFields}
                              title={t("Lưu thay đổi")}
                              className="detail-action-btn"
                              style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                border: 'none',
                                color: '#ffffff',
                                fontWeight: 700,
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                              }}
                              onMouseOver={e => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.35)';
                              }}
                              onMouseOut={e => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.2)';
                              }}
                            >
                              <Check size={14} />
                              {isSavingLeadFields ? t('Đang lưu...') : t('Lưu')}
                            </button>
                            <button
                              onClick={() => setIsAdminEditingLead(false)}
                              title={t("Hủy")}
                              className="detail-action-btn"
                              style={{
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text-muted)'
                              }}
                              onMouseOver={e => {
                                e.currentTarget.style.background = 'var(--color-border-light)';
                                e.currentTarget.style.color = 'var(--color-text)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }}
                              onMouseOut={e => {
                                e.currentTarget.style.background = 'var(--color-surface)';
                                e.currentTarget.style.color = 'var(--color-text-muted)';
                                e.currentTarget.style.transform = 'none';
                              }}
                            >
                              <X size={14} />
                              {t('Hủy')}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setEditForm({
                                name: selectedLead.name || '',
                                phone: selectedLead.phone || '',
                                email: selectedLead.email || '',
                                source: selectedLead.source || '',
                                type: selectedLead.type || '',
                                note: selectedLead.note || ''
                              });
                              setIsAdminEditingLead(true);
                            }}
                            title={t("Sửa thông tin")}
                            className="detail-action-btn"
                            style={{
                              background: 'rgba(124, 58, 237, 0.08)',
                              border: '1px solid var(--color-primary-light)',
                              color: 'var(--color-primary)',
                              boxShadow: '0 2px 6px rgba(124, 58, 237, 0.05)'
                            }}
                            onMouseOver={e => {
                              e.currentTarget.style.background = 'var(--color-primary)';
                              e.currentTarget.style.color = '#ffffff';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 6px 15px rgba(124, 58, 237, 0.2)';
                            }}
                            onMouseOut={e => {
                              e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                              e.currentTarget.style.color = 'var(--color-primary)';
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(124, 58, 237, 0.05)';
                            }}
                          >
                            <Edit size={14} />
                            {t('Sửa')}
                          </button>
                        )}
                      </>
                    )}
 
                    {user?.role === 'admin' && selectedLead.status !== 'blacklisted' && !isAdminEditingLead && (
                      <button
                        onClick={() => {
                          const isTicket = selectedLead.status === 'error' || selectedLead.report_status === 'approved' || selectedLead.report_status === 'pending';
                          setCompensateBlock(selectedLead.assigned_to_name !== '-' && !isTicket);
                          setConfirmBlockOpen(true);
                        }}
                        title={t("Chặn & Blacklist khách hàng này")}
                        className="detail-action-btn"
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid var(--color-danger-light)',
                          color: 'var(--color-danger)',
                          boxShadow: '0 2px 6px rgba(239, 68, 68, 0.05)'
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.background = 'var(--color-danger)';
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 15px rgba(239, 68, 68, 0.2)';
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                          e.currentTarget.style.color = 'var(--color-danger)';
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(239, 68, 68, 0.05)';
                        }}
                      >
                        <AlertTriangle size={14} />
                        {t('Chặn')}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  <div
                    onClick={!isAdminEditingLead ? () => handleCopyText(user?.role === 'admin' ? selectedLead.phone : maskPhone(selectedLead.phone), t('Đã sao chép số điện thoại!'), 'phone') : undefined}
                    style={{
                      background: 'var(--color-bg)',
                      padding: '0.625rem 0.75rem',
                      borderRadius: 10,
                      border: '1px solid var(--color-border-light)',
                      cursor: !isAdminEditingLead ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      if (!isAdminEditingLead) {
                        e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                        e.currentTarget.style.background = 'rgba(124, 58, 237, 0.02)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isAdminEditingLead) {
                        e.currentTarget.style.borderColor = 'var(--color-border-light)';
                        e.currentTarget.style.background = 'var(--color-bg)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Phone size={12} /> {t("Phone")}
                      </div>
                      {(() => {
                        const country = detectCountryFromPhone(selectedLead.phone);
                        if (!country) return null;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={country.name}>
                            <img
                              src={country.flagUrl}
                              alt={country.name}
                              style={{
                                width: '16px',
                                height: '11px',
                                borderRadius: '2px',
                                objectFit: 'cover',
                                border: '1px solid rgba(0,0,0,0.1)'
                              }}
                            />
                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{country.code}</span>
                          </div>
                        );
                      })()}
                    </div>
                    {isAdminEditingLead ? (
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          background: 'var(--color-surface)',
                          border: '1px solid rgba(124, 58, 237, 0.15)',
                          borderRadius: '10px',
                          padding: '8px 12px',
                          width: '100%',
                          boxSizing: 'border-box',
                          outline: 'none',
                          transition: 'all 0.2s ease-in-out',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                        }}
                        onFocus={e => {
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                          e.currentTarget.style.boxShadow = '0 0 0 4px rgba(124, 58, 237, 0.12)';
                        }}
                        onBlur={e => {
                          e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.15)';
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }} title={selectedLead.phone}>
                          {user?.role === 'admin' ? selectedLead.phone : maskPhone(selectedLead.phone)}
                        </span>
                        {!isAdminEditingLead && (
                          <div
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              color: copiedType === 'phone' ? '#10b981' : 'var(--color-text-muted)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: copiedType === 'phone' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.05)'
                            }}
                          >
                            {copiedType === 'phone' ? <Check size={12} /> : <Copy size={12} />}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    onClick={!isAdminEditingLead ? () => handleCopyText(user?.role === 'admin' ? selectedLead.email : maskEmail(selectedLead.email), t('Đã sao chép email!'), 'email') : undefined}
                    style={{
                      background: 'var(--color-bg)',
                      padding: '0.625rem 0.75rem',
                      borderRadius: 10,
                      border: '1px solid var(--color-border-light)',
                      minWidth: 0,
                      cursor: !isAdminEditingLead ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      if (!isAdminEditingLead) {
                        e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                        e.currentTarget.style.background = 'rgba(124, 58, 237, 0.02)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isAdminEditingLead) {
                        e.currentTarget.style.borderColor = 'var(--color-border-light)';
                        e.currentTarget.style.background = 'var(--color-bg)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}><Mail size={12} /> {t("Email")}</div>
                    {isAdminEditingLead ? (
                      <input
                        type="text"
                        value={editForm.email}
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          background: 'var(--color-surface)',
                          border: '1px solid rgba(124, 58, 237, 0.15)',
                          borderRadius: '10px',
                          padding: '8px 12px',
                          width: '100%',
                          boxSizing: 'border-box',
                          outline: 'none',
                          transition: 'all 0.2s ease-in-out',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                        }}
                        onFocus={e => {
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                          e.currentTarget.style.boxShadow = '0 0 0 4px rgba(124, 58, 237, 0.12)';
                        }}
                        onBlur={e => {
                          e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.15)';
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }} title={selectedLead.email}>
                          {user?.role === 'admin' ? selectedLead.email : maskEmail(selectedLead.email)}
                        </span>
                        {!isAdminEditingLead && (
                          <div
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              color: copiedType === 'email' ? '#10b981' : 'var(--color-text-muted)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: copiedType === 'email' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.05)'
                            }}
                          >
                            {copiedType === 'email' ? <Check size={12} /> : <Copy size={12} />}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ background: 'var(--color-bg)', padding: '0.625rem 0.75rem', borderRadius: 10, border: '1px solid var(--color-border-light)', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}><ExternalLink size={12} /> {t("Nguồn Data")}</div>
                    {isAdminEditingLead ? (
                      <input
                        type="text"
                        value={editForm.source}
                        onChange={e => setEditForm({ ...editForm, source: e.target.value })}
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          background: 'var(--color-surface)',
                          border: '1px solid rgba(124, 58, 237, 0.15)',
                          borderRadius: '10px',
                          padding: '8px 12px',
                          width: '100%',
                          boxSizing: 'border-box',
                          outline: 'none',
                          transition: 'all 0.2s ease-in-out',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                        }}
                        onFocus={e => {
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                          e.currentTarget.style.boxShadow = '0 0 0 4px rgba(124, 58, 237, 0.12)';
                        }}
                        onBlur={e => {
                          e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.15)';
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={selectedLead.source}>{selectedLead.source}</div>
                    )}
                  </div>
                  <div style={{ background: 'var(--color-bg)', padding: '0.625rem 0.75rem', borderRadius: 10, border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}><Tag size={12} /> {t("Trạng thái")}</div>
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
                  const { cleanNote, errorNotes, blacklistNotes, warningNotes, aiDecisionNotes } = parseNote(selectedLead.note || '');
                  return (
                    <>
                      {/* Active Ticket Report Card */}
                      {selectedLead.reason && (
                        <div style={{
                          background: theme === 'dark' ? 'rgba(239, 68, 68, 0.08)' : 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
                          border: theme === 'dark' ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid #fecaca',
                          padding: '1.25rem',
                          borderRadius: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          marginBottom: '1rem',
                          boxShadow: theme === 'dark' ? 'none' : '0 4px 15px rgba(239, 68, 68, 0.03)'
                        }}
                          className="premium-alert-card"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              background: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                              padding: '8px',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: theme === 'dark' ? '#f87171' : '#dc2626'
                            }}>
                              <AlertTriangle size={18} strokeWidth={2.5} />
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme === 'dark' ? '#f87171' : '#991b1b', letterSpacing: '-0.01em' }}>
                              {t("Thông tin báo cáo lỗi")}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.85rem', color: theme === 'dark' ? '#dadada' : '#7f1d1d' }}>
                              <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#f87171' : '#b91c1c', marginRight: '6px' }}>
                                {t("Lý do lỗi:")}
                              </span>
                              <span style={{ fontWeight: 600 }}>{selectedLead.reason}</span>
                            </div>
                          </div>

                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            paddingTop: '0.75rem',
                            marginTop: '0.25rem',
                            borderTop: theme === 'dark' ? '1px dashed rgba(239, 68, 68, 0.2)' : '1px dashed rgba(220, 38, 38, 0.15)',
                            flexWrap: 'wrap'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#7f1d1d' }}>
                              <Avatar src={selectedLead.assigned_to_avatar} name={selectedLead.assigned_to_name} size={16} />
                              <span>{t("Người báo cáo:")} <strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#991b1b' }}>{selectedLead.assigned_to_name}</strong></span>
                            </div>
                            <span style={{ color: theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#fca5a5', fontSize: '0.75rem' }}>•</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#7f1d1d' }}>
                              <Clock size={13} style={{ opacity: 0.7 }} />
                              <span>{t("Thời gian:")} <strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#991b1b' }}>{selectedLead.report_created_at ? new Date(selectedLead.report_created_at).toLocaleString('vi-VN') : ''}</strong></span>
                            </div>
                          </div>
                        </div>
                      )}


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
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: theme === 'dark' ? '#fbbf24' : '#92400e', letterSpacing: '-0.01em' }}>{t("Ghi chú & Phân loại")}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {isAdminEditingLead ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', width: '80px', flexShrink: 0 }}>{t("Loại Data:")}</span>
                              <input
                                type="text"
                                value={editForm.type}
                                onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                                style={{
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  color: 'var(--color-text)',
                                  background: 'var(--color-surface)',
                                  border: '1px solid rgba(124, 58, 237, 0.15)',
                                  borderRadius: '10px',
                                  padding: '8px 12px',
                                  flex: 1,
                                  outline: 'none',
                                  transition: 'all 0.2s ease-in-out',
                                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                                }}
                                onFocus={e => {
                                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(124, 58, 237, 0.12)';
                                }}
                                onBlur={e => {
                                  e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.15)';
                                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.85rem', color: theme === 'dark' ? '#dadada' : '#78350f' }}>
                              <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', marginRight: '6px' }}>{t("Loại Data:")}</span>
                              <span style={{ fontWeight: 600 }}>{selectedLead.type !== '-' ? selectedLead.type : t('Không có')}</span>
                            </div>
                          )}

                          <div style={{ borderTop: theme === 'dark' ? '1px dashed rgba(245, 158, 11, 0.2)' : '1px dashed rgba(217, 119, 6, 0.15)', paddingTop: '10px', marginTop: '2px' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', display: 'block', marginBottom: '6px' }}>{t("Nội dung ghi chú:")}</span>
                            {isAdminEditingLead ? (
                              <textarea
                                value={editForm.note}
                                onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                                rows={4}
                                style={{
                                  fontSize: '0.875rem',
                                  fontWeight: 500,
                                  color: 'var(--color-text)',
                                  background: 'var(--color-surface)',
                                  border: '1px solid rgba(245, 158, 11, 0.25)',
                                  borderRadius: '10px',
                                  padding: '10px 14px',
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  lineHeight: 1.5,
                                  resize: 'vertical',
                                  outline: 'none',
                                  transition: 'all 0.2s ease-in-out',
                                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                                }}
                                onFocus={e => {
                                  e.currentTarget.style.borderColor = '#d97706';
                                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.15)';
                                }}
                                onBlur={e => {
                                  e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.25)';
                                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                                }}
                              />
                            ) : (
                              <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#f3f4f6' : '#451a03', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontWeight: 500 }}>
                                {cleanNote ? cleanNote : <em style={{ color: theme === 'dark' ? '#cbd5e1' : '#b45309', opacity: 0.6 }}>{t("Không có ghi chú thêm")}</em>}
                              </div>
                            )}
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
              <div className="sticky-column">
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
                          {selectedLead.ai_screener_status === 'error' ? t('Lỗi AI Pre-screener') : (
                            (selectedLead.ai_screener_status === 'pending' && (() => {
                              const now = new Date();
                              const created = selectedLead.created_at ? parseServerDate(selectedLead.created_at) : now;
                              const diffMins = (now.getTime() - created.getTime()) / 60000;
                              return diffMins >= -2 && diffMins < 5;
                            })())
                              ? t('Chờ AI đánh giá')
                              : t('Tạm giữ')
                          )}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                          {t('Domation AI - Screener')}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
                      <strong>{selectedLead.ai_screener_status === 'error' ? t('Chi tiết lỗi:') : t('Kết quả đánh giá AI:')}</strong> {
                        selectedLead.ai_evaluation || (
                          selectedLead.ai_screener_status === 'error'
                            ? t('Mất kết nối với dịch vụ AI.')
                            : (
                              (selectedLead.ai_screener_status === 'pending' && (() => {
                                const now = new Date();
                                const created = selectedLead.created_at ? parseServerDate(selectedLead.created_at) : now;
                                const diffMins = (now.getTime() - created.getTime()) / 60000;
                                return diffMins >= -2 && diffMins < 5;
                              })())
                                ? t('Đang chờ AI đánh giá...')
                                : t('Không đạt chuẩn phân chia.')
                            )
                        )
                      }
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
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4, fontWeight: 600 }}>
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
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{t("Người tiếp nhận Lead")}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {(() => {
                            const cObj = allConsultants.find(c => c.name === selectedLead.assigned_to_name);
                            if (cObj) {
                              return (
                                <div
                                  style={{
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'color 0.2s ease'
                                  }}
                                  className="consultant-hover-trigger"
                                  onClick={() => {
                                    setStatsConsultant(cObj);
                                    syncDateFilterToModal(dateFilter);
                                    setStatsModalOpen(true);
                                  }}
                                >
                                  {selectedLead.assigned_to_name}
                                  <BarChart2 size={16} className="consultant-chart-icon" style={{ opacity: 0.7, color: 'var(--color-primary)', transition: 'opacity 0.2s ease' }} />
                                </div>
                              );
                            }
                            return <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{selectedLead.assigned_to_name}</div>;
                          })()}
                        </div>
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

                    {/* Tình trạng thông báo Zalo & Email */}
                    <div style={{
                      marginTop: '1rem',
                      paddingTop: '1rem',
                      borderTop: '1px dashed var(--color-border-light)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                        <RefreshCw size={12} className={notifLoading ? "spin" : ""} style={{ color: 'var(--color-primary)' }} />
                        <span>{t('Tình trạng gửi thông báo')}</span>
                      </div>
                      {notifLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', padding: '4px 0' }}>
                          <RefreshCw size={12} className="spin" />
                          <span>{t('Đang tải trạng thái thực tế...')}</span>
                        </div>
                      ) : notificationStatus ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                          {/* Email Status */}
                          <div
                            onClick={() => {
                              if (notificationStatus.email.status === 'sent') {
                                setPreviewType('email');
                                setPreviewSentAt(notificationStatus.email.sent_at || '');
                                setPreviewOpen(true);
                              }
                            }}
                            title={notificationStatus.email.status === 'sent' ? t('Bấm để xem mẫu email đã gửi') : undefined}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.78rem',
                              cursor: notificationStatus.email.status === 'sent' ? 'pointer' : 'default',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => {
                              if (notificationStatus.email.status === 'sent') {
                                e.currentTarget.style.backgroundColor = 'var(--color-border-light)';
                              }
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)', minWidth: 0 }}>
                              <img
                                src="/imgs/gmail-icon-free-png.webp"
                                alt="Gmail"
                                style={{ width: 14, height: 14, objectFit: 'contain', borderRadius: '50%', flexShrink: 0 }}
                              />
                              <span style={{ flexShrink: 0 }}>Email:</span>
                              <span style={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={notificationStatus.email.sent_at || notificationStatus.email.target}>
                                {notificationStatus.email.status === 'sent'
                                  ? (notificationStatus.email.sent_at || '-')
                                  : ((notificationStatus.email.status === 'pending' || (selectedLead?.status === 'pending_work_hours' && notificationStatus.email.status === 'missed')) ? t('Đang chờ gửi...') : '-')}
                              </span>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                              {notificationStatus.email.status === 'sent' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, borderRadius: '50%', background: 'var(--color-success)', color: 'white', flexShrink: 0 }}>
                                    <Check size={8} strokeWidth={3} />
                                  </span> {t('Đã gửi')} {notificationStatus.email.id ? `#${notificationStatus.email.id}` : ''}
                                </span>
                              )}
                              {(notificationStatus.email.status === 'pending' || (selectedLead?.status === 'pending_work_hours' && notificationStatus.email.status === 'missed')) && (
                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'var(--color-info-light)', color: 'var(--color-info)' }}>
                                  {selectedLead?.status === 'pending_work_hours' ? t('Chờ gửi') : t('Đang chờ')} {notificationStatus.email.id ? `#${notificationStatus.email.id}` : ''}
                                </span>
                              )}
                              {notificationStatus.email.status === 'failed' && (
                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                                  {t('Thất bại')} {notificationStatus.email.id ? `#${notificationStatus.email.id}` : ''}
                                </span>
                              )}
                              {notificationStatus.email.status === 'missed' && selectedLead?.status !== 'pending_work_hours' && (
                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px dashed rgba(239, 68, 68, 0.2)' }}>
                                  {t('Chưa gửi')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Zalo Status */}
                          <div
                            onClick={() => {
                              if (notificationStatus.zalo.status === 'sent') {
                                setPreviewType('zalo');
                                setPreviewSentAt(notificationStatus.zalo.sent_at || '');
                                setPreviewOpen(true);
                              }
                            }}
                            title={notificationStatus.zalo.status === 'sent' ? t('Bấm để xem mẫu Zalo đã gửi') : undefined}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.78rem',
                              cursor: notificationStatus.zalo.status === 'sent' ? 'pointer' : 'default',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => {
                              if (notificationStatus.zalo.status === 'sent') {
                                e.currentTarget.style.backgroundColor = 'var(--color-border-light)';
                              }
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)', minWidth: 0 }}>
                              <img
                                src="https://stc-zpl.zdn.vn/favicon.ico"
                                alt="Zalo"
                                style={{ width: 14, height: 14, objectFit: 'contain', borderRadius: '50%', flexShrink: 0 }}
                              />
                              <span style={{ flexShrink: 0 }}>Zalo:</span>
                              <span style={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={notificationStatus.zalo.sent_at || notificationStatus.zalo.target}>
                                {notificationStatus.zalo.status === 'sent'
                                  ? (notificationStatus.zalo.sent_at || '-')
                                  : (notificationStatus.zalo.status === 'no_zalo_config' ? t('Chưa cấu hình ID') : ((notificationStatus.zalo.status === 'pending' || (selectedLead?.status === 'pending_work_hours' && notificationStatus.zalo.status === 'missed')) ? t('Đang chờ gửi...') : '-'))}
                              </span>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                              {notificationStatus.zalo.status === 'no_zalo_config' && (
                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                                  {t('Chưa cấu hình ID')}
                                </span>
                              )}
                              {notificationStatus.zalo.status === 'sent (Direct cURL)' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, borderRadius: '50%', background: 'var(--color-success)', color: 'white', flexShrink: 0 }}>
                                    <Check size={8} strokeWidth={3} />
                                  </span> {t('Đã gửi (cURL)')}
                                </span>
                              )}
                              {notificationStatus.zalo.status === 'sent' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, borderRadius: '50%', background: 'var(--color-success)', color: 'white', flexShrink: 0 }}>
                                    <Check size={8} strokeWidth={3} />
                                  </span> {t('Đã gửi')} {notificationStatus.zalo.id && notificationStatus.zalo.id !== 'Log' ? `#${notificationStatus.zalo.id}` : ''}
                                </span>
                              )}
                              {(notificationStatus.zalo.status === 'pending' || (selectedLead?.status === 'pending_work_hours' && notificationStatus.zalo.status === 'missed')) && (
                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'var(--color-info-light)', color: 'var(--color-info)' }}>
                                  {selectedLead?.status === 'pending_work_hours' ? t('Chờ gửi') : t('Đang chờ')} {notificationStatus.zalo.id ? `#${notificationStatus.zalo.id}` : ''}
                                </span>
                              )}
                              {notificationStatus.zalo.status === 'failed' && (
                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                                  {t('Thất bại')} {notificationStatus.zalo.id ? `#${notificationStatus.zalo.id}` : ''}
                                </span>
                              )}
                              {notificationStatus.zalo.status === 'missed' && selectedLead?.status !== 'pending_work_hours' && (
                                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px dashed rgba(239, 68, 68, 0.2)' }}>
                                  {t('Chưa gửi')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {t('Không lấy được trạng thái gửi thông báo')}
                        </div>
                      )}

                      {/* Manual Reminder Button */}
                      {user?.role === 'admin' && selectedLead.assigned_to_name !== '-' && (
                        <button
                          onClick={() => {
                            setReminderChannels({ zalo: true, email: true });
                            setIsReminderModalOpen(true);
                          }}
                          style={{
                            marginTop: '0.75rem',
                            width: '100%',
                            background: 'rgba(124, 58, 237, 0.08)',
                            border: '1px solid var(--color-primary-light)',
                            borderRadius: '10px',
                            padding: '8px 12px',
                            color: 'var(--color-primary)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          onMouseOver={e => {
                            e.currentTarget.style.background = 'var(--color-primary)';
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 10px rgba(124, 58, 237, 0.15)';
                          }}
                          onMouseOut={e => {
                            e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                            e.currentTarget.style.color = 'var(--color-primary)';
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <Bell size={12} />
                          {t('Nhắc lại thông báo')}
                        </button>
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
        {confirmReassignOpen && (
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
        )}
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
        {confirmBlockOpen && (
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
        )}
      </CustomModal>

      {/* Auto-Approve Settings Modal */}
      <CustomModal
        isOpen={showAutoApproveModal}
        onClose={() => setShowAutoApproveModal(false)}
        title={t("Cấu hình Tự Động Duyệt Ticket")}
        width="680px"
      >
        {showAutoApproveModal && (
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
        )}
      </CustomModal>

      {/* Custom Modal for Auto-Approve Rule */}
      <CustomModal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        title={editingRule ? t("Chỉnh sửa Luật Tự Động Duyệt") : t("Thêm Luật Tự Động Duyệt Mới")}
        width="620px"
      >
        {ruleModalOpen && (
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
        )}
      </CustomModal>

      {/* Reminder Confirmation Modal */}
      <CustomModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        title={t("Xác nhận nhắc lại cho Tư vấn viên")}
        width="480px"
      >
        {isReminderModalOpen && selectedLead && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Avatar
                src={selectedLead.assigned_to_avatar}
                name={selectedLead.assigned_to_name}
                size={44}
              />
              <div>
                <p style={{ color: 'var(--color-text)', lineHeight: 1.6, fontSize: '0.9375rem', margin: 0, fontWeight: 500 }}>
                  {t('Gửi thông báo nhắc nhở chăm sóc khách hàng')} <strong>"{selectedLead.name}"</strong> {t('đến Tư vấn viên')} <strong>"{selectedLead.assigned_to_name}"</strong>.
                </p>
              </div>
            </div>

            <div style={{
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('Kênh nhận thông báo:')}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src="https://stc-zpl.zdn.vn/favicon.ico"
                    alt="Zalo"
                    style={{ width: 16, height: 16, objectFit: 'contain', borderRadius: '50%' }}
                  />
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 500 }}>Zalo Bot Message</span>
                </div>
                <ToggleSwitch
                  checked={reminderChannels.zalo}
                  onChange={checked => setReminderChannels({ ...reminderChannels, zalo: checked })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src="/imgs/gmail-icon-free-png.webp"
                    alt="Gmail"
                    style={{ width: 16, height: 16, objectFit: 'contain' }}
                  />
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 500 }}>Gmail SMTP Notification</span>
                </div>
                <ToggleSwitch
                  checked={reminderChannels.email}
                  onChange={checked => setReminderChannels({ ...reminderChannels, email: checked })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
              <button
                className="btn outline"
                onClick={() => setIsReminderModalOpen(false)}
                style={{
                  borderRadius: '10px',
                  padding: '8px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                {t('Hủy')}
              </button>
              <button
                className="btn primary"
                onClick={handleSendReminder}
                disabled={isSendingReminder || (!reminderChannels.zalo && !reminderChannels.email)}
                style={{
                  borderRadius: '10px',
                  padding: '8px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #6d28d9 100%)',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.25s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 15px rgba(124, 58, 237, 0.3)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.2)';
                }}
              >
                {isSendingReminder ? <RefreshCw size={14} className="spin" /> : <Bell size={14} />}
                {isSendingReminder ? t('Đang gửi...') : t('Xác nhận')}
              </button>
            </div>
          </div>
        )}
      </CustomModal>

      {selectedLead && (
        <NotificationPreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          type={previewType}
          leadName={selectedLead.name}
          leadPhone={user?.role === 'admin' ? selectedLead.phone : maskPhone(selectedLead.phone)}
          leadEmail={user?.role === 'admin' ? selectedLead.email : maskEmail(selectedLead.email)}
          leadSource={selectedLead.source || ''}
          leadType={selectedLead.type || ''}
          leadNote={selectedLead.note || ''}
          assignedToName={selectedLead.assigned_to_name || ''}
          sentAt={previewSentAt}
          isReminder={selectedLead.status === 'reminder'}
          leadId={selectedLead.lead_id || selectedLead.id}
          assignedToId={allConsultants.find(c => c.name === selectedLead.assigned_to_name)?.id}
          roundId={rounds.find(r => r.round_name === selectedLead.round_name)?.id}
          roundName={selectedLead.round_name}
          aiEvaluation={selectedLead.ai_evaluation}
          aiStatus={selectedLead.ai_screener_status}
        />
      )}

      {statsModalOpen && statsConsultant && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setStatsModalOpen(false)}>
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 900,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              animation: 'modalSpring 0.4s cubic-bezier(0.34, 1.18, 0.64, 1) both'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="stats-header-container" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                <Avatar
                  src={statsConsultant.avatar}
                  name={statsConsultant.name}
                  size={44}
                  style={{
                    filter: (statsConsultant.status === 'inactive' || statsConsultant.status === 'leave' || Number(statsConsultant.vacation_mode) === 1) ? 'grayscale(1)' : 'none',
                    opacity: (statsConsultant.status === 'inactive' || statsConsultant.status === 'leave' || Number(statsConsultant.vacation_mode) === 1) ? 0.5 : 1
                  }}
                />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Báo cáo hiệu suất TVV')}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <strong>{statsConsultant.name}</strong> • ID: {statsConsultant.id} • <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}><img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png" alt="Gmail" style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0 }} /> {statsConsultant.email}</span>
                  </p>
                </div>
              </div>

              {/* Timeframe Filter Dropdown in Header */}
              <div className="stats-header-filters">
                <Calendar size={18} color="var(--color-text-light)" style={{ display: 'flex', alignItems: 'center' }} />
                <div style={{ position: 'relative', zIndex: 100 }}>
                  <CustomSelect
                    options={[
                      { value: 'this_month', label: t('Tháng này') },
                      { value: 'today', label: t('Hôm nay') },
                      { value: 'yesterday', label: t('Hôm qua') },
                      { value: '7_days', label: t('7 ngày qua') },
                      { value: '30_days', label: t('30 ngày qua') },
                      { value: 'last_month', label: t('Tháng trước') },
                      { value: 'all', label: t('Tất cả thời gian') },
                      { value: 'custom', label: t('Tự chọn ngày...') }
                    ]}
                    value={statsDateMode}
                    onChange={val => setStatsDateMode(String(val))}
                    width={180}
                  />
                </div>

                {statsDateMode === 'custom' && (
                  <div className="stats-custom-dates" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', animation: 'slideUp 0.15s ease-out', flexShrink: 0 }}>
                    <input
                      type="date"
                      className="form-input"
                      style={{ padding: '4px 10px', fontSize: '0.8125rem', height: 32, width: 130 }}
                      value={statsStartDate}
                      onChange={e => setStatsStartDate(e.target.value)}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('đến')}</span>
                    <input
                      type="date"
                      className="form-input"
                      style={{ padding: '4px 10px', fontSize: '0.8125rem', height: 32, width: 130 }}
                      value={statsEndDate}
                      onChange={e => setStatsEndDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
              {statsLoading && !statsData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                  </div>
                  <ChartSkeleton height={180} />
                </div>
              ) : !statsData ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                  {t('Không có dữ liệu thống kê.')}
                </div>
              ) : (
                <>
                  {/* Subtle Loading overlay if reloading in background */}
                  {statsLoading && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--color-primary-light)', zIndex: 10, overflow: 'hidden' }}>
                      <div style={{ width: '30%', height: '100%', background: 'var(--color-primary)', borderRadius: 'inherit', animation: 'loadingBar 1.5s infinite ease-in-out' }} />
                    </div>
                  )}
                  <style>{`
                    @keyframes loadingBar {
                      0% { transform: translateX(-100%); }
                      100% { transform: translateX(330%); }
                    }
                  `}</style>

                  {/* Visual Breakdown explanation */}
                  <div style={{
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.6)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: 12,
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {t('Tổng data hệ thống tiếp nhận cho TVV này:')} <strong style={{ fontSize: '1.05rem', color: 'var(--color-text)' }}>{statsData.summary.total}</strong> lead
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        * {t('Các nhóm độc lập hoàn toàn, không cộng dồn/chồng chéo')}
                      </span>
                    </div>

                    {/* Stacked Percentage Bar */}
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--color-border-light)', position: 'relative' }}>
                      {statsData.summary.successful > 0 && (
                        <div
                          style={{
                            width: `${(statsData.summary.successful / Math.max(1, statsData.summary.total)) * 100}%`,
                            background: 'linear-gradient(90deg, #a78bfa, #7c3aed)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Thành công')}: ${statsData.summary.successful}`}
                        />
                      )}
                      {(statsData.summary.reminder || 0) > 0 && (
                        <div
                          style={{
                            width: `${((statsData.summary.reminder || 0) / Math.max(1, statsData.summary.total)) * 100}%`,
                            background: 'linear-gradient(90deg, #fcd34d, #f59e0b)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Nhắc lại')}: ${statsData.summary.reminder}`}
                        />
                      )}
                      {(statsData.summary.error || 0) > 0 && (
                        <div
                          style={{
                            width: `${((statsData.summary.error || 0) / Math.max(1, statsData.summary.total)) * 100}%`,
                            background: 'linear-gradient(90deg, #fca5a5, #ef4444)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Lỗi')}: ${statsData.summary.error}`}
                        />
                      )}
                    </div>

                    {/* Legend explaining the numbers */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Thành công (Bàn giao thực tế)')}: <strong style={{ color: 'var(--color-primary)' }}>{statsData.summary.successful}</strong> ({statsData.summary.total > 0 ? Math.round((statsData.summary.successful / statsData.summary.total) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Nhắc lại (Khách cũ gọi lại)')}: <strong style={{ color: 'var(--color-warning)' }}>{statsData.summary.reminder || 0}</strong> ({statsData.summary.total > 0 ? Math.round(((statsData.summary.reminder || 0) / statsData.summary.total) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-danger)' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Lỗi / Trùng (Đã lọc bỏ)')}: <strong style={{ color: 'var(--color-danger)' }}>{statsData.summary.error || 0}</strong> ({statsData.summary.total > 0 ? Math.round(((statsData.summary.error || 0) / statsData.summary.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* KPI Cards Row (4 Columns) */}
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    <div className="stat-card hover-lift" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Thành công')}</span>
                        <div className="stat-icon" style={{ color: 'var(--color-primary)', opacity: 0.8 }}><CheckCircle size={18} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)' }}>
                          {statsData.summary.successful
                          }</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>{t('Data gán mới thành công')}</div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: 2 }}>{t('(Không bao gồm Nhắc lại & Lỗi)')}</div>
                      </div>
                    </div>

                    <div className="stat-card hover-lift" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Nhắc lại')}</span>
                        <div className="stat-icon" style={{ color: 'var(--color-warning)', opacity: 0.8 }}><Clock size={18} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)' }}>
                          {statsData.summary.reminder || 0}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>{t('Yêu cầu gọi lại')}</div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-warning)', fontWeight: 600, marginTop: 2 }}>{t('(Tính riêng biệt, không cộng dồn)')}</div>
                      </div>
                    </div>

                    <div className="stat-card hover-lift" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Lỗi')}</span>
                        <div className="stat-icon" style={{ color: 'var(--color-danger)', opacity: 0.8 }}><AlertTriangle size={18} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)' }}>
                          {statsData.summary.error || 0}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>{t('Trùng lặp / Lỗi chia')}</div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-danger)', fontWeight: 600, marginTop: 2 }}>{t('(Đã loại bỏ khỏi Thành công)')}</div>
                      </div>
                    </div>

                    <div className="stat-card hover-lift" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Tỷ lệ')}</span>
                        <div className="stat-icon" style={{ color: 'var(--color-success)', opacity: 0.8 }}><BarChart2 size={18} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)' }}>
                          {statsData.summary.system_total_successful > 0
                            ? Math.round((statsData.summary.successful / statsData.summary.system_total_successful) * 100)
                            : 0}%
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>{t('Thành công / Tổng của tất cả saleperson')}</div>
                      </div>
                    </div>
                  </div>

                  {/* Row 1: Daily trend bar chart (Full Width) */}
                  <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', width: '100%' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Lưu lượng nhận Data theo Ngày')}</h4>
                    {statsData.by_date && statsData.by_date.length > 0 ? (
                      <div style={{ height: 180, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={statsData.by_date} margin={{ left: -10, right: 5, top: 20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="statsDateGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#c084fc" stopOpacity={1} />
                                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, (max: number) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                            <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                            <Bar dataKey="count" fill="url(#statsDateGradient)" radius={[4, 4, 0, 0]} maxBarSize={30} name={t("Data thành công")}>
                              <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text)', fontSize: 10, fontWeight: 700 }} offset={6} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                        {t('Không có dữ liệu phân bổ theo ngày')}
                      </div>
                    )}
                  </div>

                  {/* Row 2: Status Ratio (Donut) & Rounds Breakdown */}
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    {/* Donut chart for status ratio */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Tỷ lệ Trạng thái Data')}</h4>
                      {(() => {
                        const statusChartData = [
                          { name: t('Thành công'), value: statsData.summary.successful, color: '#7c3aed' },
                          { name: t('Nhắc lại'), value: statsData.summary.reminder, color: '#f59e0b' },
                          { name: t('Lỗi'), value: statsData.summary.error, color: '#ef4444' }
                        ].filter(item => item.value > 0);

                        return statsData.summary.total > 0 && statusChartData.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', justifyContent: 'center' }}>
                            <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={statusChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={35}
                                    outerRadius={55}
                                    paddingAngle={4}
                                    dataKey="value"
                                  >
                                    {statusChartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.75rem' }}>
                              {statusChartData.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                    {item.name}: <strong style={{ fontSize: '0.8125rem' }}>{item.value}</strong> ({Math.round(item.value / statsData.summary.total * 100)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2rem 0' }}>
                            {t('Không có dữ liệu lưu lượng')}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Rounds breakdown chart */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Phân bổ theo Vòng (Round)')}</h4>
                      {statsData.rounds.length > 0 ? (
                        <div style={{ height: 160, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={statsData.rounds} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-light)" />
                              <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis dataKey="round_name" type="category" width={90} tick={{ fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                              <Bar dataKey="successful_count" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} barSize={12} name={t("Thành công")} />
                              <Bar dataKey="reminder_count" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={12} name={t("Nhắc lại")} />
                              <Bar dataKey="error_count" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={12} name={t("Lỗi")} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2rem 0' }}>
                          {t('Không có dữ liệu chia số theo vòng')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Marketing Sources & Tickets Reports */}
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    {/* Source breakdown list */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Tỷ lệ Nguồn Data (Chi tiết)')}</h4>
                      {statsData.by_source && statsData.by_source.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto', paddingRight: 4 }}>
                          {statsData.by_source.map((src: any, idx: number) => {
                            const sourcePercent = statsData.summary.successful > 0
                              ? Math.round((src.count / statsData.summary.successful) * 100)
                              : 0;
                            return (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{src.source}</span>
                                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{src.count} {t('data')} ({sourcePercent}%)</span>
                                </div>
                                <div style={{ width: '100%', height: 4, background: 'var(--color-border-light)', borderRadius: 2 }}>
                                  <div style={{ width: `${sourcePercent}%`, height: '100%', background: '#8b5cf6', borderRadius: 2 }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '1.5rem 0' }}>
                          {t('Không có dữ liệu nguồn data')}
                        </div>
                      )}
                    </div>

                    {/* Tickets Reports statistics */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Thống kê Ticket báo lỗi Data')}</h4>
                      {statsData.tickets ? (
                        <>
                          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                            <div style={{ background: 'var(--color-bg)', padding: '6px', borderRadius: 8, border: '1px solid var(--color-border-light)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>{t('GỬI ĐI')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{statsData.tickets.total}</div>
                            </div>
                            <div style={{ background: 'var(--color-success-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-success)', fontWeight: 700 }}>{t('ĐÃ BÙ')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-success)', marginTop: 2 }}>{statsData.tickets.approved}</div>
                            </div>
                            <div style={{ background: 'var(--color-warning-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-warning)', fontWeight: 700 }}>{t('ĐANG CHỜ')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: 2 }}>{statsData.tickets.pending}</div>
                            </div>
                            <div style={{ background: 'var(--color-danger-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-danger)', fontWeight: 700 }}>{t('TỪ CHỐI')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: 2 }}>{statsData.tickets.rejected}</div>
                            </div>
                          </div>
                          <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', fontWeight: 500 }}>
                            {t('Tổng nhận bù:')} <strong style={{ color: 'var(--color-success)' }}>{statsData.tickets.approved + (statsData.active_compensation || 0) + (statsData.blacklist_compensation || 0)}</strong> {t('data')} (Ticket: {statsData.tickets.approved}, Blacklist: {statsData.blacklist_compensation || 0}, {t('Chủ động')}: {statsData.active_compensation || 0})
                          </div>
                          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                            <button
                              onClick={() => {
                                setStatsModalOpen(false);
                                navigate(`/fair-share?open_comp_id=${statsConsultant.id}&date_mode=${statsDateMode}`);
                              }}
                              className="btn outline sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', padding: '6px 12px', height: 'auto', borderRadius: 8 }}
                            >
                              <Scale size={13} /> {t('Xem chi tiết data bù')}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '1rem 0' }}>
                          {t('Không có dữ liệu ticket')}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.25rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
              <button type="button" className="btn primary sm" onClick={() => setStatsModalOpen(false)}>{t('Đóng')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <CustomModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} title={t("Quy định duyệt bù & Báo lỗi Data")} width="800px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem' }}>
          {/* Section 1: Process Workflow */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="var(--color-primary)" />
              {t("1. Quy trình báo cáo & duyệt đền bù")}
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {t("Quy trình 3 bước khép kín từ khi Tư vấn viên phát hiện số lỗi đến khi nhận data đền bù:")}
            </p>

            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {/* Step 1 */}
              <div style={{ 
                flex: 1, minWidth: 160, 
                background: theme === 'dark' ? 'rgba(124, 58, 237, 0.04)' : 'rgba(124, 58, 237, 0.02)', 
                border: '1.5px solid rgba(124, 58, 237, 0.15)', borderRadius: 10, padding: '0.75rem',
                display: 'flex', flexDirection: 'column', gap: 4
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'var(--color-primary)', color: 'white', padding: '1px 5px', borderRadius: 4 }}>BƯỚC 1</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)' }}>{t("TVV Báo Lỗi")}</span>
                </div>
                <p style={{ fontSize: '0.725rem', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>
                  {t("Gửi báo cáo kèm lý do cụ thể trong thời gian quy định khi phát hiện data không đạt chất lượng.")}
                </p>
              </div>

              {/* Arrow */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }} className="hide-on-mobile">
                <ArrowRight size={14} color="var(--color-text-muted)" />
              </div>

              {/* Step 2 */}
              <div style={{ 
                flex: 1, minWidth: 160, 
                background: theme === 'dark' ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.02)', 
                border: '1.5px solid rgba(245, 158, 11, 0.15)', borderRadius: 10, padding: '0.75rem',
                display: 'flex', flexDirection: 'column', gap: 4
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#f59e0b', color: 'white', padding: '1px 5px', borderRadius: 4 }}>BƯỚC 2</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309' }}>{t("Admin Xét Duyệt")}</span>
                </div>
                <p style={{ fontSize: '0.725rem', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>
                  {t("Admin/AI đối soát thông tin. Nếu duyệt: Giao lại (Reassign) hoặc đưa số vào Blacklist và cộng +1 nợ bù.")}
                </p>
              </div>

              {/* Arrow */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }} className="hide-on-mobile">
                <ArrowRight size={14} color="var(--color-text-muted)" />
              </div>

              {/* Step 3 */}
              <div style={{ 
                flex: 1, minWidth: 160, 
                background: theme === 'dark' ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.02)', 
                border: '1.5px solid rgba(16, 185, 129, 0.15)', borderRadius: 10, padding: '0.75rem',
                display: 'flex', flexDirection: 'column', gap: 4
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#10b981', color: 'white', padding: '1px 5px', borderRadius: 4 }}>BƯỚC 3</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#065f46' }}>{t("Tự động Đền bù")}</span>
                </div>
                <p style={{ fontSize: '0.725rem', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>
                  {t("Ở lượt phân bổ tiếp theo, hệ thống ưu tiên giao lead bù cho Sale để trả nợ trước khi xoay vòng tiếp.")}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Error Classifications */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="var(--color-primary)" />
              {t("2. Phân loại lỗi data được chấp nhận duyệt bù")}
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {t("Hệ thống hỗ trợ duyệt bù tự động bằng AI hoặc duyệt thủ công theo 4 nhóm lỗi chuẩn:")}
            </p>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
              gap: '0.75rem',
              marginTop: 4
            }}>
              {/* Card 1: Sai số */}
              <div style={{ 
                background: 'var(--color-surface)', 
                border: '1px solid var(--color-border-light)', 
                borderRadius: 12, padding: '1rem',
                display: 'flex', gap: 12, alignItems: 'flex-start'
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#3b82f6' }}>
                  <Phone size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Sai số / Thuê bao")}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                    {t("Số điện thoại không tồn tại, thuê bao không liên lạc được ngay từ cuộc gọi đầu tiên, gọi sai người đăng ký.")}
                  </div>
                </div>
              </div>

              {/* Card 2: Trùng lặp */}
              <div style={{ 
                background: 'var(--color-surface)', 
                border: '1px solid var(--color-border-light)', 
                borderRadius: 12, padding: '1rem',
                display: 'flex', gap: 12, alignItems: 'flex-start'
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#8b5cf6' }}>
                  <Copy size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Trùng lặp (Duplicate)")}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                    {t("Lead bị trùng lặp SĐT hoặc Email với lead đã chia cho cùng một tư vấn viên hoặc người khác trong vòng 6 tháng.")}
                  </div>
                </div>
              </div>

              {/* Card 3: Spam ảo */}
              <div style={{ 
                background: 'var(--color-surface)', 
                border: '1px solid var(--color-border-light)', 
                borderRadius: 12, padding: '1rem',
                display: 'flex', gap: 12, alignItems: 'flex-start'
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#f59e0b' }}>
                  <Trash2 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Spam ảo / Junk Lead")}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                    {t("Khách khai thông tin giả lập, trẻ em bấm nghịch đăng ký, điền lung tung hoặc báo không đăng ký ngay khi gọi.")}
                  </div>
                </div>
              </div>

              {/* Card 4: Dưới chuẩn */}
              <div style={{ 
                background: 'var(--color-surface)', 
                border: '1px solid var(--color-border-light)', 
                borderRadius: 12, padding: '1rem',
                display: 'flex', gap: 12, alignItems: 'flex-start'
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#ef4444' }}>
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Dưới chuẩn / Khác")}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                    {t("Khách sai đối tượng chuyên ngành, học sinh cấp 3, không đúng nhu cầu học hoặc không đạt tiêu chuẩn tối thiểu vòng chia.")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Admin Options and Compensation Logic */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scale size={18} color="var(--color-primary)" />
              {t("3. Hành động xét duyệt từ Admin")}
            </h4>
            
            <div style={{ 
              background: 'var(--color-bg)', 
              border: '1px solid var(--color-border)', 
              borderRadius: 12, 
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ 
                  width: 24, height: 24, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0, marginTop: 2
                }}>✓</div>
                <div>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--color-text)' }}>{t("Duyệt & Đền Bù (Approve)")}</strong>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                    {t("Sale được cộng +1 nợ bù. Admin có thể chọn giao lại (Reassign) lead này cho Sale khác (nếu lead vẫn cứu vớt được) hoặc click Chặn Blacklist để hệ thống không bao giờ chia lại số này nữa.")}
                  </p>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--color-border-light)' }} />

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ 
                  width: 24, height: 24, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0, marginTop: 2
                }}>✗</div>
                <div>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--color-text)' }}>{t("Từ chối (Reject)")}</strong>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                    {t("Từ chối báo cáo đền bù của Sale (do gọi muộn quá hạn, không đúng lý do, hoặc thiếu bằng chứng chứng minh). Sale không được đền bù lượt này.")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowInfoModal(false)} style={{ minWidth: 100 }}>{t("Đồng ý")}</button>
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

export const Tickets = withRouterFreezer(TicketsInner, '/tickets');

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
      {open && (
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
                        <div style={{ fontSize: '0.8rem', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {noEmail ? (
                            <span style={{ color: 'var(--color-danger)' }}>{t("⚠ Chưa cài email — không nhận được")}</span>
                          ) : (
                            <>
                              <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png" alt="Gmail" style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0 }} />
                              <span>{acc.email}</span>
                            </>
                          )}
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
      )}
    </CustomModal>
  );
};
