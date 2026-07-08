import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, LabelList } from 'recharts';

import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { withRouterFreezer } from '../components/RouterFreezer';
import { fetchAPI, getDefaultDateFilter } from '../utils/api';
import toast from 'react-hot-toast';
import {
  ShieldAlert, RefreshCw, Filter, Zap, Trash2, Plus,
  CheckCircle, AlertTriangle, ChevronLeft, ChevronRight,
  Phone, Mail, Clock, Tag, XCircle,
  ExternalLink, Check, Shield, Save, Sparkles, X, Settings,
  BarChart2, Search, CheckCircle2, GitBranch, Scale, Edit, Bell, Copy,
  Calendar
} from 'lucide-react';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { CustomModal } from '../components/ui/CustomModal';
import { Avatar } from '../components/ui/Avatar';
import { TableSkeleton, Skeleton, KpiCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import { detectCountryFromPhone } from '../utils/phoneHelper';
import { NotificationPreviewModal } from '../components/ui/NotificationPreviewModal';

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
  target_round_id?: number | null;
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

const getResolutionDetail = (noteText: string) => {
  if (!noteText) return null;
  const normalized = noteText.replace(/\\n/g, '\n');
  const lines = normalized.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('[Duyệt AI]:') ||
      trimmed.startsWith('[Từ chối AI]:') ||
      trimmed.startsWith('[Blacklist AI]:') ||
      trimmed.startsWith('[Xác nhận dưới chuẩn - Fallback]:')
    ) {
      return parseAIDecisionNote(trimmed);
    }
  }
  return null;
};

interface AIScreenerConfig {
  id: string;
  name: string;
  rounds: number[];
  mode: 'ai' | 'manual' | 'hybrid';
  ai_rules: string;
  manual_action: 'hold' | 'skip';
  manual_rules: any[];
  below_standard_fallback_enabled?: boolean;
  below_standard_fallback_round_id?: number | '';
  below_standard_auto_approve?: boolean;
}

const GatekeeperInner = ({ isActive, searchParams, setSearchParams }: { isActive: boolean; searchParams: URLSearchParams; setSearchParams: any }) => {
  const { t } = useLanguage();
  const getStatusBadge = (status: string, reportStatus?: string) => {
    if (status === 'assigned' && reportStatus === 'pending') {
      return (
        <span style={{
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '0.72rem',
          fontWeight: 600,
          background: 'rgba(189, 29, 45, 0.12)',
          color: '#a31422',
          border: '1px solid rgba(189, 29, 45, 0.2)',
          display: 'inline-flex',
          alignItems: 'center'
        }}>
          {t('Ticket Review')}
        </span>
      );
    }
    if (status === 'error' && reportStatus === 'approved') {
      return (
        <span style={{
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '0.72rem',
          fontWeight: 600,
          background: 'var(--color-warning-light)',
          color: 'var(--color-warning)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          display: 'inline-flex',
          alignItems: 'center'
        }}>
          {t('Ticket')}
        </span>
      );
    }
    switch (status) {
      case 'assigned':
      case 'active':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'var(--color-success-light)',
            color: 'var(--color-success)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Đã chia')}
          </span>
        );
      case 'compensation':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-border-light)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Data Bù')}
          </span>
        );
      case 'pending_work_hours':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'var(--color-warning-light)',
            color: 'var(--color-warning)',
            border: '1px solid var(--color-border-light)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Chờ giờ làm')}
          </span>
        );
      case 'error':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'var(--color-danger-light)',
            color: 'var(--color-danger)',
            border: '1px solid var(--color-border-light)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Ticket')}
          </span>
        );
      case 'pending':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'var(--color-warning-light)',
            color: 'var(--color-warning)',
            border: '1px solid var(--color-border-light)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Chờ chia')}
          </span>
        );
      case 'reminder':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'rgba(236, 72, 153, 0.12)',
            color: '#ec4899',
            border: '1px solid rgba(236, 72, 153, 0.25)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Nhắc lại')}
          </span>
        );
      case 'duplicate':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'var(--color-danger-light)',
            color: 'var(--color-danger)',
            border: '1px solid var(--color-border-light)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Trùng lặp')}
          </span>
        );
      case 'rule_6_month':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'var(--color-info-light)',
            color: 'var(--color-info)',
            border: '1px solid var(--color-border-light)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Quy định 6 tháng')}
          </span>
        );
      case 'silent':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'var(--color-info-light)',
            color: 'var(--color-info)',
            border: '1px solid var(--color-border-light)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Chỉ đồng bộ')}
          </span>
        );
      case 'blacklisted':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'rgba(239, 68, 68, 0.16)',
            color: 'var(--color-danger)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Blacklist')}
          </span>
        );
      case 'pending_approval':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'var(--color-warning-light)',
            color: 'var(--color-warning)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Tạm giữ')}
          </span>
        );
      case 'rejected':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'var(--color-danger-light)',
            color: 'var(--color-danger)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Dưới chuẩn')}
          </span>
        );
      case 'fallback':
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#d97706',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {t('Fallback')}
          </span>
        );
      default:
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'var(--color-warning-light)',
            color: 'var(--color-warning)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'inline-flex',
            alignItems: 'center'
          }}>
            {status}
          </span>
        );
    }
  };
  const { user } = useAuth();
  const isUserAdmin = user && ['admin', 'superadmin', 'super_admin'].includes(user.role);
  const isReadOnly = user?.role === 'director';
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

  // Search Params
  const getInitialDateFilter = () => {
    return localStorage.getItem('richland_global_date') || getDefaultDateFilter();
  };
  const dateFilter = searchParams.get('date') || getInitialDateFilter();

  const currentPage = Number(searchParams.get('page') || '1');

  // Lists & Configs States
  const [heldLeads, setHeldLeads] = useState<any[]>([]);
  const [heldLeadsTotalCount, setHeldLeadsTotalCount] = useState<number>(0);
  const [heldLeadsLoading, setHeldLeadsLoading] = useState<boolean>(false);

  // Consultants loaded for lookup
  const [consultants, setConsultants] = useState<any[]>([]);

  // Consultant stats state for details modal
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsConsultant, setStatsConsultant] = useState<any>(null);
  const [statsConsultantLoading, setStatsConsultantLoading] = useState(false);
  const [statsConsultantData, setStatsConsultantData] = useState<any>(null);
  const [statsDateMode, setStatsDateMode] = useState<string>('this_month');
  const [statsStartDate, setStatsStartDate] = useState<string>('');
  const [statsEndDate, setStatsEndDate] = useState<string>('');

  // Duplicate check states
  const [showDupCheckModal, setShowDupCheckModal] = useState(false);
  const [dupCheckInput, setDupCheckInput] = useState('');
  const [dupCheckLoading, setDupCheckLoading] = useState(false);
  const [dupCheckResult, setDupCheckResult] = useState<any>(null);
  const [heldLeadsSearch, setHeldLeadsSearch] = useState<string>('');
  const [rounds, setRounds] = useState<any[]>([]);

  // Settings states
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [aiScreenerEnabled, setAiScreenerEnabled] = useState(false);
  const [aiScreenerConfigs, setAiScreenerConfigs] = useState<AIScreenerConfig[]>([]);

  // Modals & Action States
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
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderChannels, setReminderChannels] = useState({ zalo: true, email: true });
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<'email' | 'zalo'>('email');
  const [previewSentAt, setPreviewSentAt] = useState<string>('');

  const [copiedType, setCopiedType] = useState<string | null>(null);
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
    } finally {
      setIsSendingReminder(false);
    }
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
        fetchHeldLeads();
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
  const [heldActionModalOpen, setHeldActionModalOpen] = useState<'approve' | 'reject' | 'blacklist' | null>(null);
  const [actioningHeldLead, setActioningHeldLead] = useState<any | null>(null);
  const [selectedApproveRoundId, setSelectedApproveRoundId] = useState<number | null>(null);
  const [heldActionReason, setHeldActionReason] = useState<string>('');
  const [previewedConsultant, setPreviewedConsultant] = useState<any>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Custom Settings & Guide Modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);
  const [isDynamicFlowExpanded, setIsDynamicFlowExpanded] = useState<boolean>(false);
  const [activeRoundsDropdown, setActiveRoundsDropdown] = useState<string | null>(null);

  // Stats Modal States
  const [isStatsModalOpen, setIsStatsModalOpen] = useState<boolean>(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [statsPage, setStatsPage] = useState<number>(1);
  const STATS_ITEMS_PER_PAGE = 20;

  // AI Token Stats Modal States
  const [isTokenStatsModalOpen, setIsTokenStatsModalOpen] = useState<boolean>(false);
  const [tokenStatsData, setTokenStatsData] = useState<any>(null);
  const [tokenStatsLoading, setTokenStatsLoading] = useState<boolean>(false);
  const [tokenStatsPage, setTokenStatsPage] = useState<number>(1);

  // Active tab state: queue (Hàng chờ duyệt), substandard (Dưới chuẩn), assigned (Giao lead), ai_pending (Chờ AI đánh giá)
  const [activeTab, setActiveTab] = useState<'queue' | 'substandard' | 'assigned' | 'ai_pending'>('queue');
  const [tabCounts, setTabCounts] = useState<{ queue: number; substandard: number; assigned: number; ai_pending: number }>({ queue: 0, substandard: 0, assigned: 0, ai_pending: 0 });
  const [adminAvatars, setAdminAvatars] = useState<Record<string, string>>({});

  // Dashboard stats state for AI evaluation strip
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState<boolean>(false);

  const paginatedRecentLeads = useMemo(() => {
    if (!statsData?.recent_below_standard) return [];
    const start = (statsPage - 1) * STATS_ITEMS_PER_PAGE;
    return statsData.recent_below_standard.slice(start, start + STATS_ITEMS_PER_PAGE);
  }, [statsData?.recent_below_standard, statsPage]);

  const paginatedRecentAiLeads = useMemo(() => {
    return tokenStatsData?.recent_leads || [];
  }, [tokenStatsData?.recent_leads]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveRoundsDropdown(null);
    };
    if (activeRoundsDropdown) {
      window.addEventListener('click', handleGlobalClick);
    }
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [activeRoundsDropdown]);

  // Custom Date Picker Modal
  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const ITEMS_PER_PAGE = 50;

  const updateParams = (key: string, value: string) => {
    const currentValue = searchParams.get(key) || '';
    if (currentValue === value || (value === '1' && key === 'page' && !searchParams.has('page'))) {
      return;
    }
    if (key === 'date') {
      localStorage.setItem('richland_global_date', value);
      window.dispatchEvent(new CustomEvent('global-date-change', { detail: value }));
    }
    setSearchParams((prev: any) => {
      const next = new URLSearchParams(prev);
      if (value === '' || (key !== 'status' && value === 'all')) next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page');
      return next;
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

  // ── API Fetchers ──
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetchAPI(`get_gatekeeper_stats&date=${encodeURIComponent(dateFilter)}`);
      if (res.success) {
        setStatsData(res);
      } else {
        toast.error(t('Lỗi tải thống kê bộ lọc'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối Server: ') + e.message);
    }
    setStatsLoading(false);
  };

  const fetchTokenStats = async (page: number = 1) => {
    setTokenStatsLoading(true);
    try {
      const res = await fetchAPI(`get_ai_token_stats&date=${encodeURIComponent(dateFilter)}&page=${page}&pageSize=20`);
      if (res.success) {
        setTokenStatsData(res);
      } else {
        toast.error(t('Lỗi tải thống kê token AI'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối Server: ') + e.message);
    }
    setTokenStatsLoading(false);
  };

  useEffect(() => {
    if (isStatsModalOpen) {
      setStatsPage(1);
      fetchStats();
    }
  }, [isStatsModalOpen, dateFilter]);

  useEffect(() => {
    if (isTokenStatsModalOpen) {
      setTokenStatsPage(1);
      fetchTokenStats();
    }
  }, [isTokenStatsModalOpen, dateFilter]);

  const handleRunDupCheck = async (overrideInput?: string) => {
    const inputVal = (overrideInput ?? dupCheckInput).trim();
    if (!inputVal) {
      toast.error(t('Vui lòng nhập số điện thoại hoặc email.'));
      return;
    }
    setDupCheckLoading(true);
    setDupCheckResult(null);
    try {
      const res = await fetchAPI(`check_lead_duplicate&input=${encodeURIComponent(inputVal)}`);
      if (res.success) {
        setDupCheckResult(res);
      } else {
        toast.error(res.message || t('Lỗi kiểm tra trùng lặp.'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setDupCheckLoading(false);
  };

  const handleOpenDupCheckFromDetail = (phone: string, email: string) => {
    const input = (phone && phone !== '-') ? phone : (email && email !== '-' ? email : '');
    if (input) {
      setDupCheckInput(input);
      setShowDupCheckModal(true);
      setTimeout(() => {
        handleRunDupCheck(input);
      }, 50);
    } else {
      toast.error(t('Không có số điện thoại hoặc email để kiểm tra trùng.'));
    }
  };

  const fetchHeldLeads = async () => {
    setHeldLeadsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(currentPage));
      queryParams.set('pageSize', String(ITEMS_PER_PAGE));
      if (heldLeadsSearch) queryParams.set('search', heldLeadsSearch);
      if (dateFilter) queryParams.set('date', dateFilter);

      let apiStatus = 'pending_approval';
      if (activeTab === 'substandard') apiStatus = 'rejected';
      else if (activeTab === 'assigned') apiStatus = 'approved';
      else if (activeTab === 'ai_pending') apiStatus = 'ai_pending';
      queryParams.set('status', apiStatus);

      const res = await fetchAPI(`get_held_leads&${queryParams.toString()}`);
      if (res.success) {
        const data = res.data || [];
        setHeldLeads(data);
        setHeldLeadsTotalCount(res.total_count ?? 0);
        if (res.counts) {
          setTabCounts(res.counts);
        }
        if (res.admin_avatars) {
          setAdminAvatars(res.admin_avatars);
        }
        if (data.length === 0 && !heldLeadsSearch) {
          setIsDynamicFlowExpanded(true);
        }
      }
    } catch (e: any) {
      toast.error(t('Lỗi tải dữ liệu AI Pre-screener: ') + e.message);
    }
    setHeldLeadsLoading(false);
  };

  const fetchDashboardStats = async () => {
    setDashboardStatsLoading(true);
    try {
      const res = await fetchAPI(`get_dashboard_stats&date=${encodeURIComponent(dateFilter)}`);
      if (res.success) {
        setDashboardStats(res.data);
      }
    } catch (e: any) {
      console.error('Error fetching dashboard stats for AI pre-screener rate:', e);
    }
    setDashboardStatsLoading(false);
  };

  const refreshHeldLeadsAndStats = () => {
    fetchHeldLeads();
    fetchDashboardStats();
  };

  useEffect(() => {
    if (isActive) {
      const saved = localStorage.getItem('richland_global_date');
      if (saved && searchParams.get('date') !== saved) {
        setSearchParams((prev: any) => {
          const next = new URLSearchParams(prev);
          next.set('date', saved);
          return next;
        }, { replace: true });
      }
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const handleGlobalDate = (e: any) => {
      const newDate = e.detail;
      if (newDate && searchParams.get('date') !== newDate) {
        setSearchParams((prev: any) => {
          const next = new URLSearchParams(prev);
          next.set('date', newDate);
          return next;
        }, { replace: true });
      }
    };
    window.addEventListener('global-date-change', handleGlobalDate);
    return () => window.removeEventListener('global-date-change', handleGlobalDate);
  }, [searchParams, isActive]);

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetchAPI('get_settings');
      if (res.success && res.data) {
        setAiScreenerEnabled(res.data.ai_screener_enabled === '1' || res.data.ai_screener_enabled === 1);

        // Fetch multiple configurations
        let configsArray: AIScreenerConfig[] = [];
        if (res.data.ai_screener_configs) {
          try {
            const parsed = typeof res.data.ai_screener_configs === 'string'
              ? JSON.parse(res.data.ai_screener_configs)
              : res.data.ai_screener_configs;
            if (Array.isArray(parsed)) {
              configsArray = parsed;
            }
          } catch (e) {
            console.error('Error parsing aiScreenerConfigs', e);
          }
        }

        // Fallback: migrate single configuration to multi-ruleset if none exists
        if (configsArray.length === 0) {
          const oldRounds = res.data.ai_screener_rounds
            ? res.data.ai_screener_rounds.split(',').map(Number).filter((n: any) => !isNaN(n) && n > 0)
            : [];
          if (oldRounds.length > 0 || res.data.ai_screener_rules || res.data.ai_screener_manual_rules) {
            let oldManualRules: any[] = [];
            if (res.data.ai_screener_manual_rules) {
              try {
                const parsedRules = typeof res.data.ai_screener_manual_rules === 'string'
                  ? JSON.parse(res.data.ai_screener_manual_rules)
                  : res.data.ai_screener_manual_rules;
                if (Array.isArray(parsedRules)) oldManualRules = parsedRules;
              } catch { }
            }
            configsArray = [{
              id: 'config_' + Date.now(),
              name: t('Cấu hình mặc định'),
              rounds: oldRounds,
              mode: (res.data.ai_screener_mode as any) || 'ai',
              ai_rules: res.data.ai_screener_rules || '',
              manual_action: (res.data.ai_screener_manual_action as any) || 'hold',
              manual_rules: oldManualRules
            }];
          }
        }
        setAiScreenerConfigs(configsArray);
      }
    } catch (e: any) {
      console.error('Error fetching settings:', e);
    }
    setSettingsLoading(false);
  };

  const fetchRounds = async () => {
    try {
      const res = await fetchAPI('get_rounds');
      if (res.success && res.data) {
        setRounds(res.data);
      }
    } catch (e) {
      console.error('Error fetching rounds:', e);
    }
  };

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
    setStatsConsultantLoading(true);
    try {
      let query = `get_consultant_stats&consultant_id=${consId}&date_mode=${mode}`;
      if (mode === 'custom' && start && end) {
        query += `&start_date=${start}&end_date=${end}`;
      }
      const json = await fetchAPI(query);
      if (json.success) {
        setStatsConsultantData(json);
      } else {
        toast.error(json.message || t('Lỗi khi tải báo cáo thống kê'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setStatsConsultantLoading(false);
  };

  useEffect(() => {
    if (statsModalOpen && statsConsultant) {
      if (statsDateMode !== 'custom' || (statsStartDate && statsEndDate)) {
        fetchConsultantStats(statsConsultant.id, statsDateMode, statsStartDate, statsEndDate);
      }
    }
  }, [statsModalOpen, statsConsultant, statsDateMode, statsStartDate, statsEndDate]);

  useEffect(() => {
    fetchRounds();
    fetchSettings();
    fetchConsultants();
  }, []);

  const prevTabRef = useRef(activeTab);

  useEffect(() => {
    if (isActive && activeTab !== 'queue') {
      setIsDynamicFlowExpanded(false);
    }
  }, [activeTab, isActive]);

  useEffect(() => {
    if (isActive) {
      if (prevTabRef.current !== activeTab) {
        prevTabRef.current = activeTab;
        const pageInParams = Number(searchParams.get('page') || '1');
        if (pageInParams !== 1) {
          updateParams('page', '1');
          return;
        }
      }
      fetchHeldLeads();
      fetchDashboardStats();
    }
  }, [searchParams, heldLeadsSearch, isActive, activeTab]);

  useEffect(() => {
    if (isActive && searchParams.get('open_tokens') === 'true') {
      setIsTokenStatsModalOpen(true);
      updateParams('open_tokens', '');
    }
  }, [isActive, searchParams]);

  useEffect(() => {
    if (searchParams.get('page') && searchParams.get('page') !== '1') {
      updateParams('page', '1');
    }
  }, [heldLeadsSearch]);

  // ── Lead Action Handlers ──
  const handleOpenApproveHeldLead = async (lead: any) => {
    setActioningHeldLead(lead);
    setHeldActionModalOpen('approve');
    setHeldActionReason('');
    setSelectedApproveRoundId(lead.target_round_id ? Number(lead.target_round_id) : null);
    setPreviewLoadingId(lead.id);
    setPreviewedConsultant(null);
    try {
      const rId = lead.target_round_id ? Number(lead.target_round_id) : '';
      const res = await fetchAPI(`preview_held_lead_assignment&lead_id=${lead.id}&round_id=${rId}`);
      if (res.success) {
        setPreviewedConsultant(res.consultant);
      } else {
        toast.error(res.message || t('Lỗi tải thông tin Sale tiếp nhận.'));
      }
    } catch (err: any) {
      console.error(err);
    }
    setPreviewLoadingId(null);
  };

  const handleApproveRoundChange = async (newRoundId: number) => {
    setSelectedApproveRoundId(newRoundId);
    if (!actioningHeldLead) return;
    setPreviewLoadingId(actioningHeldLead.id);
    setPreviewedConsultant(null);
    try {
      const res = await fetchAPI(`preview_held_lead_assignment&lead_id=${actioningHeldLead.id}&round_id=${newRoundId}`);
      if (res.success) {
        setPreviewedConsultant(res.consultant);
      } else {
        toast.error(res.message || t('Lỗi tải thông tin Sale tiếp nhận.'));
      }
    } catch (err: any) {
      console.error(err);
    }
    setPreviewLoadingId(null);
  };

  const handleApproveHeldLeadSubmit = async () => {
    if (!actioningHeldLead) return;
    const currentLeadId = actioningHeldLead.id;
    setHeldActionModalOpen(null);
    setActionLoading(true);
    try {
      const res = await fetchAPI('approve_held_lead', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: currentLeadId,
          round_id: selectedApproveRoundId,
          reason: heldActionReason
        })
      });
      if (res.success) {
        toast.success(t('Đã duyệt và phân bổ lead thành công!'));
        refreshHeldLeadsAndStats();
        window.dispatchEvent(new Event('ticket-resolved'));
      } else {
        toast.error(res.message || t('Lỗi khi duyệt lead'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setActionLoading(false);
  };

  const handleRejectHeldLeadSubmit = async () => {
    if (!actioningHeldLead || !heldActionReason.trim()) {
      toast.error(t('Vui lòng nhập lý do từ chối.'));
      return;
    }
    const currentLeadId = actioningHeldLead.id;
    setHeldActionModalOpen(null);
    setActionLoading(true);
    try {
      const res = await fetchAPI('reject_held_lead', {
        method: 'POST',
        body: JSON.stringify({ lead_id: currentLeadId, reason: heldActionReason })
      });
      if (res.success) {
        toast.success(t('Đã xác nhận dưới chuẩn thành công!'));
        setHeldActionReason('');
        refreshHeldLeadsAndStats();
        window.dispatchEvent(new Event('ticket-resolved'));
      } else {
        toast.error(res.message || t('Lỗi khi xác nhận dưới chuẩn'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setActionLoading(false);
  };

  const handleBlacklistHeldLeadSubmit = async () => {
    if (!actioningHeldLead || !heldActionReason.trim()) {
      toast.error(t('Vui lòng nhập lý do chặn.'));
      return;
    }
    const currentLeadId = actioningHeldLead.id;
    setHeldActionModalOpen(null);
    setActionLoading(true);
    try {
      const res = await fetchAPI('blacklist_held_lead', {
        method: 'POST',
        body: JSON.stringify({ lead_id: currentLeadId, reason: heldActionReason })
      });
      if (res.success) {
        toast.success(t('Đã chặn số và đưa vào Blacklist thành công!'));
        setHeldActionReason('');
        refreshHeldLeadsAndStats();
        window.dispatchEvent(new Event('ticket-resolved'));
      } else {
        toast.error(res.message || t('Lỗi khi chặn lead'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setActionLoading(false);
  };

  // ── Config Action Handlers ──
  const handleSaveConfig = async () => {
    // Validate each config card's fallback settings
    for (const cfg of aiScreenerConfigs) {
      if (cfg.below_standard_fallback_enabled) {
        if (!cfg.below_standard_fallback_round_id) {
          toast.error(t("Vui lòng chọn Vòng phân bổ fallback cho nhóm: ") + (cfg.name || t("Chưa đặt tên")));
          return;
        }
        if (cfg.rounds.includes(Number(cfg.below_standard_fallback_round_id))) {
          toast.error(t("Vòng fallback không được nằm trong các vòng áp dụng của nhóm: ") + (cfg.name || t("Chưa đặt tên")));
          return;
        }
        // Fallback round cannot be selected in the screened rounds of ANY config
        const isSelectedInConfigs = aiScreenerConfigs.some(c =>
          c.rounds.includes(Number(cfg.below_standard_fallback_round_id))
        );
        if (isSelectedInConfigs) {
          toast.error(t("Vòng fallback không được trùng với các vòng đang bật bộ lọc AI ở bất kỳ nhóm nào."));
          return;
        }
      }
    }

    setSavingSettings(true);
    const payload = {
      ai_screener_enabled: aiScreenerEnabled ? '1' : '0',
      ai_screener_configs: aiScreenerConfigs,
      ai_screener_below_standard_fallback_enabled: aiScreenerConfigs.length > 0 && aiScreenerConfigs[0].below_standard_fallback_enabled ? '1' : '0',
      ai_screener_below_standard_fallback_round_id: aiScreenerConfigs.length > 0 && aiScreenerConfigs[0].below_standard_fallback_round_id ? String(aiScreenerConfigs[0].below_standard_fallback_round_id) : '',
      ai_screener_below_standard_auto_approve: aiScreenerConfigs.length > 0 && aiScreenerConfigs[0].below_standard_auto_approve ? '1' : '0',
      // Retain old settings keys for backward compatibility using first config
      ai_screener_rounds: aiScreenerConfigs.length > 0 ? aiScreenerConfigs[0].rounds.join(',') : '',
      ai_screener_rules: aiScreenerConfigs.length > 0 ? aiScreenerConfigs[0].ai_rules : '',
      ai_screener_mode: aiScreenerConfigs.length > 0 ? aiScreenerConfigs[0].mode : 'ai',
      ai_screener_manual_action: aiScreenerConfigs.length > 0 ? aiScreenerConfigs[0].manual_action : 'hold',
      ai_screener_manual_rules: aiScreenerConfigs.length > 0 ? aiScreenerConfigs[0].manual_rules : []
    };

    try {
      const json = await fetchAPI('save_settings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (json.success) {
        toast.success(t("Đã lưu cấu hình bộ lọc thành công!"));
        // Dispatch to update badge count if toggled off
        window.dispatchEvent(new Event('ticket-resolved'));
      } else {
        toast.error(t("Lỗi khi lưu cấu hình bộ lọc!"));
      }
    } catch {
      toast.error(t("Lỗi kết nối Server"));
    }
    setSavingSettings(false);
  };


  const aiPassed = dashboardStats?.ai_passed_count || 0;
  const aiFailed = dashboardStats?.ai_failed_count || 0;
  const aiTotal = aiPassed + aiFailed;
  const aiPassedPercent = aiTotal > 0 ? Math.round((aiPassed / aiTotal) * 100) : 0;
  const aiFailedPercent = aiTotal > 0 ? 100 - aiPassedPercent : 0;

  return (
    <div>

      {/* ── Page Header ── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', background: 'linear-gradient(135deg, #a31422 0%, #a31422 100%)', color: 'white', padding: 8, borderRadius: 12, boxShadow: '0 4px 12px rgba(163, 20, 34, 0.3)' }}>
              <Shield size={24} />
            </span>
            {t('AI Pre-screener')}
          </h1>
        </div>

        {/* Header Actions */}
        <div className="mobile-flex-wrap hide-on-mobile" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>

          {/* Guide Button */}
          <button
            onClick={() => setIsGuideModalOpen(true)}
            title={t("Hướng dẫn sử dụng")}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', cursor: 'pointer',
              color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.8125rem', fontWeight: 700, transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            <Sparkles size={14} color="var(--color-primary)" /> {t('Hướng dẫn')}
          </button>

          <div className="hide-on-mobile" style={{ width: 1, height: 16, background: 'rgba(163, 20, 34,0.15)' }} />

          {/* Settings Button */}
          <button
            onClick={() => {
              fetchSettings();
              setIsSettingsModalOpen(true);
            }}
            title={t("Cấu hình quy tắc")}
            style={{
              padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', cursor: 'pointer',
              color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.8125rem', fontWeight: 700, transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            <Settings size={14} color="var(--color-primary)" />
            <span className="hide-on-mobile">{t('Cấu hình quy tắc')}</span>
            <span className="mobile-only">{t('Cấu hình')}</span>
          </button>

          <div className="hide-on-mobile" style={{ width: 1, height: 16, background: 'rgba(163, 20, 34,0.15)' }} />

          {/* Lọc AI Toggle */}
          <div
            onClick={() => {
              fetchSettings();
              setIsSettingsModalOpen(true);
            }}
            title={t("Cấu hình quy tắc lọc AI")}
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
              e.currentTarget.style.background = 'rgba(163, 20, 34,0.05)';
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
              {t('Lọc AI')}
            </span>
            <div
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: aiScreenerEnabled ? 'var(--color-success)' : 'rgba(148,163,184,0.3)',
                position: 'relative', transition: 'background 0.2s',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{
                position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%',
                background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                left: aiScreenerEnabled ? 19 : 3, transition: 'left 0.2s'
              }} />
            </div>
          </div>

        </div>

      </div>

      {/* Intro explain card styled identically to FairShareAudit */}
      <div className="hide-on-mobile" style={{
        background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.05) 0%, rgba(189, 29, 45, 0.1) 100%)',
        border: '1px solid var(--color-primary-light)', borderLeft: '4px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', width: '100%' }}>
          <div style={{
            background: 'var(--color-card, #fff)',
            width: 40, height: 40, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', boxShadow: 'var(--shadow-sm)', color: 'var(--color-primary)'
          }}>
            <Sparkles size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)', marginBottom: 4, marginTop: 0 }}>
              {t("Bộ Lọc AI Pre-screener hoạt động thế nào?")}
            </h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6, margin: 0 }}>
              {t("Hệ thống tự động tiếp nhận dữ liệu từ webhook nguồn, chuyển qua đánh giá chất lượng tự động (RICH LAND AI hoặc Luật thủ công cấu hình). Những dữ liệu không đạt chuẩn sẽ được tạm giữ phê duyệt và gửi tin báo cho Quản trị viên, giúp tiết kiệm thời gian Telesale.")}
            </p>
          </div>
          <button
            onClick={() => setIsDynamicFlowExpanded(!isDynamicFlowExpanded)}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-primary-light)',
              background: 'var(--color-surface)',
              color: 'var(--color-primary)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              alignSelf: 'center',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            {isDynamicFlowExpanded ? t('Thu gọn') : t('Cách hoạt động')}
            <span style={{ transform: isDynamicFlowExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', fontSize: '10px' }}>▼</span>
          </button>
        </div>

        {/* Dynamic step-by-step logic panel */}
        {isDynamicFlowExpanded && (
          <div style={{
            marginTop: '0.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px dashed var(--color-primary-light)',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-primary)' }}>
              {t('LUỒNG XỬ LÝ HIỆN TẠI (DYNAMIC FLOW):')}
            </h5>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
              position: 'relative'
            }}>
              {/* Step 1 */}
              <div className="flow-step-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="flow-step-number">1</span>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                    {t('Webhook tiếp nhận')}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                  {t('Lead mới được gửi realtime từ các kênh Google Sheets, Facebook Lead Ads, Landing Page...')}
                </p>
                <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: 'rgba(163, 20, 34, 0.08)',
                    color: '#a31422',
                    border: '1px solid rgba(163, 20, 34, 0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#a31422' }} />
                    {t('Thời gian thực (Realtime)')}
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flow-step-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="flow-step-number">2</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                      {t('Kiểm tra bộ lọc AI')}
                    </span>
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: aiScreenerEnabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(163, 20, 34, 0.08)',
                    border: aiScreenerEnabled ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(163, 20, 34, 0.2)',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: aiScreenerEnabled ? '#10b981' : '#a31422'
                  }}>
                    {aiScreenerEnabled ? (
                      <>
                        <span style={{
                          width: 6, height: 6,
                          borderRadius: '50%',
                          background: '#10b981',
                          boxShadow: '0 0 6px #10b981',
                          display: 'inline-block'
                        }} />
                        {t('Đang BẬT')}
                      </>
                    ) : (
                      t('Ví dụ cấu hình')
                    )}
                  </div>
                </div>

                {aiScreenerEnabled ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                      {t('Kiểm tra vòng của Lead. Áp dụng cho các vòng:')}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      {(() => {
                        const allRounds = aiScreenerConfigs.reduce<number[]>((acc: number[], cfg: AIScreenerConfig) => [...acc, ...cfg.rounds], []);
                        if (allRounds.length === 0) {
                          return (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                              {t('Chưa chọn vòng nào (Ví dụ: Form, BBA...)')}
                            </span>
                          );
                        }
                        return rounds
                          .filter((r: any) => allRounds.includes(Number(r.id)))
                          .map((r: any) => (
                            <span key={r.id} style={{
                              fontSize: '0.6875rem',
                              background: 'var(--color-bg-alt)',
                              border: '1px solid var(--color-border)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              color: 'var(--color-text)',
                              fontWeight: 500
                            }}>
                              {r.round_name}
                            </span>
                          ));
                      })()}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%' }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                      {t('Kiểm tra vòng của Lead. Áp dụng cho các vòng được chọn (Ví dụ):')}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      <span style={{
                        fontSize: '0.6875rem',
                        background: 'var(--color-bg-alt)',
                        border: '1px solid var(--color-border)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        color: 'var(--color-text)',
                        fontWeight: 500
                      }}>{t('Vòng Form')}</span>
                      <span style={{
                        fontSize: '0.6875rem',
                        background: 'var(--color-bg-alt)',
                        border: '1px solid var(--color-border)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        color: 'var(--color-text)',
                        fontWeight: 500
                      }}>{t('Vòng BBA')}</span>
                      <span style={{
                        fontSize: '0.6875rem',
                        background: 'var(--color-bg-alt)',
                        border: '1px solid var(--color-border)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        color: 'var(--color-text)',
                        fontWeight: 500
                      }}>{t('Facebook Ads')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3 */}
              <div className="flow-step-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="flow-step-number">3</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                      {t('Đánh giá chất lượng')}
                    </span>
                  </div>
                  {!aiScreenerEnabled && (
                    <div style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: 'rgba(163, 20, 34, 0.08)',
                      color: '#a31422',
                      border: '1px solid rgba(163, 20, 34, 0.2)',
                      whiteSpace: 'nowrap'
                    }}>
                      {t('Ví dụ cấu hình')}
                    </div>
                  )}
                </div>

                {aiScreenerEnabled ? (
                  aiScreenerConfigs.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                      {t('Chưa có nhóm cấu hình lọc nào hoạt động.')}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 110, overflowY: 'auto', paddingRight: 4 }}>
                      {aiScreenerConfigs.map((cfg: AIScreenerConfig, idx: number) => {
                        const roundNames = rounds.filter((r: any) => cfg.rounds.includes(Number(r.id))).map((r: any) => r.round_name).join(', ');
                        return (
                          <div key={cfg.id} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            borderBottom: idx < aiScreenerConfigs.length - 1 ? '1px dashed var(--color-border)' : 'none',
                            paddingBottom: idx < aiScreenerConfigs.length - 1 ? 6 : 0
                          }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                              {cfg.name || `${t('Nhóm')} ${idx + 1}`}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {t('Vòng:')} {roundNames || t('Chưa chọn')}
                            </span>
                            {cfg.mode === 'ai' && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={cfg.ai_rules}>
                                <strong>{t('Quy tắc AI:')}</strong> {cfg.ai_rules || t('Chưa thiết lập')}
                              </span>
                            )}
                            {cfg.mode === 'manual' && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text)' }}>
                                <strong>{t('Quy tắc:')}</strong> {cfg.manual_rules && cfg.manual_rules.length > 0 ? `${cfg.manual_rules.length} ${t('nhánh lọc thủ công')}` : t('Chưa thiết lập')}
                              </span>
                            )}
                            {cfg.mode === 'hybrid' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text)' }}>
                                  <strong>{t('Match logic:')}</strong> {cfg.manual_rules && cfg.manual_rules.length > 0 ? `${cfg.manual_rules.length} ${t('nhánh thủ công')}` : t('Chưa thiết lập')}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={cfg.ai_rules}>
                                  <strong>{t('Quy tắc AI:')}</strong> {cfg.ai_rules || t('Chưa thiết lập')}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 110, overflowY: 'auto', paddingRight: 4 }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      borderBottom: '1px dashed var(--color-border)',
                      paddingBottom: 6
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {t('Ví dụ: Nhóm Lọc Tự Động')}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {t('Vòng:')} {t('Vòng Form, Facebook Ads')}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <strong>{t('Quy tắc AI:')}</strong> {t('Đạt chuẩn (đã đi làm hoặc có nhu cầu học ngay)...')}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {t('Ví dụ: Nhóm Duyệt Tay')}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {t('Vòng:')} {t('Vòng BBA')}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text)' }}>
                        <strong>{t('Quy tắc:')}</strong> {t('2 nhánh lọc thủ công (Loại trừ số rác...)')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4 */}
              <div className="flow-step-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="flow-step-number">4</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                      {t('Phân bổ & Hàng chờ')}
                    </span>
                  </div>
                  {!aiScreenerEnabled && (
                    <div style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: 'rgba(163, 20, 34, 0.08)',
                      color: '#a31422',
                      border: '1px solid rgba(163, 20, 34, 0.2)',
                      whiteSpace: 'nowrap'
                    }}>
                      {t('Ví dụ cấu hình')}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                    {t('Sau khi đánh giá xong, Lead sẽ được phân luồng xử lý:')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.7rem', color: 'var(--color-text)', marginTop: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
                      <span><strong>{t('Đạt chuẩn:')}</strong> {t('Tự động chia vòng & đồng bộ Sheets.')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }} />
                      <span><strong>{t('Không đạt:')}</strong> {t('Giữ lại bảng này chờ Admin duyệt.')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Pre-screener evaluation strip */}
      {dashboardStatsLoading && !dashboardStats ? (
        <div
          className="card"
          style={{
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            background: theme === 'dark' ? 'rgba(163, 20, 34, 0.08)' : 'rgba(163, 20, 34, 0.02)',
            border: theme === 'dark' ? '1px solid rgba(163, 20, 34, 0.15)' : '1px solid rgba(163, 20, 34, 0.08)',
            minHeight: '94px',
            height: 'auto',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Skeleton width="20px" height="20px" borderRadius="4px" />
              <Skeleton width="220px" height="16px" borderRadius="4px" />
            </div>
            <Skeleton width="120px" height="14px" borderRadius="4px" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <Skeleton width="100%" height="10px" borderRadius="999px" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width="160px" height="12px" borderRadius="4px" />
              <Skeleton width="140px" height="12px" borderRadius="4px" />
            </div>
          </div>
        </div>
      ) : (
        dashboardStats && (
          <div className="card" style={{
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            animation: 'fadeIn 0.3s ease-out',
            background: theme === 'dark' ? 'rgba(163, 20, 34, 0.12)' : 'rgba(163, 20, 34, 0.04)',
            border: theme === 'dark' ? '1px solid rgba(163, 20, 34, 0.25)' : '1px solid rgba(163, 20, 34, 0.12)',
            minHeight: '94px',
            height: 'auto',
            boxSizing: 'border-box',
            opacity: dashboardStatsLoading ? 0.6 : 1,
            transition: 'opacity 0.2s ease',
            pointerEvents: dashboardStatsLoading ? 'none' : 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                  src="/LOGO.jpg"
                  alt="RICH LAND AI Logo"
                  style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('Đánh giá chất lượng từ AI Pre-screener')}
                </span>
              </div>
              {aiTotal > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {t('Tổng số đánh giá:')} <strong style={{ color: 'var(--color-text)' }}>{aiTotal}</strong>
                </span>
              )}
            </div>

            {aiTotal > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Progress bar */}
                <div style={{ width: '100%', height: '10px', background: 'var(--color-border-light)', borderRadius: '999px', display: 'flex', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}>
                  <div
                    style={{
                      width: `${aiPassedPercent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--color-primary) 0%, #a78bfa 100%)',
                      transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                    title={`${t('Đạt chuẩn')}: ${aiPassedPercent}%`}
                  />
                  <div
                    style={{
                      width: `${aiFailedPercent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #f59e0b 0%, var(--color-warning) 100%)',
                      transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                    title={`${t('Dưới chuẩn')}: ${aiFailedPercent}%`}
                  />
                </div>

                {/* Labels/Stats detail */}
                <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 600, marginTop: '2px', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                    <span>
                      {t('Đạt chuẩn (Passed):')} <strong>{aiPassedPercent}%</strong> ({aiPassed} lead)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                    <span>
                      {t('Dưới chuẩn:')} <strong>{aiFailedPercent}%</strong> ({aiFailed} lead)
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-text-muted)', opacity: 0.5 }} />
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                  {t('Không có dữ liệu đánh giá từ AI Pre-screener trong khoảng thời gian này.')}
                </span>
              </div>
            )}
          </div>
        )
      )}

      {/* Mobile control bar */}
      <div className="filter-mobile-only" style={{ width: '100%', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
          {/* Status Dropdown (Matches Tickets style) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <CustomSelect
              options={[
                {
                  value: 'held',
                  label: `${t('Tạm giữ')} (${heldLeadsTotalCount})`,
                  icon: <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                }
              ]}
              value="held"
              onChange={() => { }}
              width="100%"
            />
          </div>

          {/* Filter Toggle Button */}
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

          {/* AI Token Stats Button */}
          <button
            onClick={() => setIsTokenStatsModalOpen(true)}
            title={t("Thống kê token AI")}
            style={{
              padding: 0,
              borderRadius: 8,
              border: '1px solid var(--color-primary)',
              background: 'rgba(189, 29, 45, 0.08)',
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
            <Sparkles size={16} />
          </button>

          {/* Stats Button */}
          <button
            onClick={() => setIsStatsModalOpen(true)}
            title={t("Thống kê")}
            style={{
              padding: 0,
              borderRadius: 8,
              border: '1px solid var(--color-primary)',
              background: 'rgba(163, 20, 34,0.08)',
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
            <BarChart2 size={16} />
          </button>

          {/* Settings Button */}
          <button
            onClick={() => {
              fetchSettings();
              setIsSettingsModalOpen(true);
            }}
            title={t("Cấu hình quy tắc")}
            style={{
              padding: 0,
              borderRadius: 8,
              border: '1px solid var(--color-primary)',
              background: 'rgba(163, 20, 34,0.08)',
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
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="card mobile-flat-container" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', position: 'relative' }}>
        {heldLeadsLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, var(--color-primary) 0%, #a78bfa 50%, var(--color-primary) 100%)',
            backgroundSize: '200% 100%',
            animation: 'loadingBar 1.5s infinite linear',
            zIndex: 100
          }} />
        )}

        {/* Custom Tabs Bar */}
        <div style={{
          display: 'flex',
          background: 'var(--color-border-light)',
          padding: '4px',
          borderRadius: '12px',
          gap: '4px',
          alignItems: 'center',
          width: 'fit-content',
          margin: '10px 18px'
        }}>
          {[
            { id: 'queue', label: t('Hàng chờ duyệt'), count: tabCounts.queue, color: 'var(--color-warning)' },
            { id: 'ai_pending', label: t('Chờ AI đánh giá'), count: tabCounts.ai_pending || 0, color: 'var(--color-primary)' },
            { id: 'substandard', label: t('Dưới chuẩn'), count: tabCounts.substandard, color: 'var(--color-danger)' },
            { id: 'assigned', label: t('Giao lead'), count: tabCounts.assigned, color: 'var(--color-success)' }
          ].map(tab => {
            const isActiveTab = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActiveTab ? 'var(--color-surface)' : 'transparent',
                  color: isActiveTab ? 'var(--color-primary)' : 'var(--color-text-light)',
                  boxShadow: isActiveTab ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                className={isActiveTab ? '' : 'hover-lift'}
              >
                <span>{tab.label}</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '20px',
                  height: '20px',
                  padding: '0 6px',
                  borderRadius: '10px',
                  background: isActiveTab ? 'rgba(189, 29, 45, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  color: isActiveTab ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>


        {/* Filter bar */}
        <div className={`responsive-filter-row ${!showMobileFilters ? 'filter-hide-on-mobile' : ''}`} style={{
          position: 'relative', zIndex: 100,
          display: 'flex', gap: 12, padding: '14px 18px',
          background: 'linear-gradient(135deg, rgba(163, 20, 34,0.04) 0%, rgba(189, 29, 45,0.02) 100%)',
          borderBottom: '1px solid var(--color-border)',
          flexWrap: 'wrap', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a31422', fontWeight: 700, fontSize: '0.8125rem' }}>
            <Filter size={14} />
            <span>{t('Bộ lọc')}</span>
          </div>
          <div className="hide-on-mobile" style={{ width: 1, height: 20, background: 'rgba(163, 20, 34,0.2)', margin: '0 4px' }} />

          <div className="mobile-stack" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: 260 }}>
            {/* Search Input */}
            <div className="mobile-w-full" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: 350 }}>
              <input
                type="text"
                value={heldLeadsSearch}
                onChange={e => setHeldLeadsSearch(e.target.value)}
                placeholder={t("Tìm kiếm Tên, SĐT, Email...")}
                className="form-input mobile-w-full"
                style={{ height: 44, fontSize: '0.85rem', width: '100%', maxWidth: 350, borderRadius: 'var(--radius-lg)', padding: '0 1rem', flex: 1 }}
              />
            </div>

            {/* Date Select */}
            <div className="mobile-w-full" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: 180 }}>
              <div style={{ position: 'relative', width: '100%' }} className="mobile-flex-1">
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
            </div>

            {(activeTab === 'queue' || activeTab === 'ai_pending') && (
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
                whiteSpace: 'nowrap'
              }}>
                <Sparkles size={12} /> {t(activeTab === 'queue' ? 'Hiển thị toàn bộ lead chờ duyệt' : 'Hiển thị toàn bộ lead chờ AI đánh giá')}
              </div>
            )}

            {/* Guide & Toggle Switch on Mobile (Only shown on mobile when filter is expanded) */}
            <div className="mobile-only mobile-w-full" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                onClick={() => setIsGuideModalOpen(true)}
                className="btn outline mobile-flex-1"
                style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.85rem', borderRadius: 'var(--radius-lg)', width: '100%' }}
              >
                <Sparkles size={14} color="var(--color-primary)" />
                <span>{t('Hướng dẫn')}</span>
              </button>

              <div
                onClick={() => {
                  fetchSettings();
                  setIsSettingsModalOpen(true);
                }}
                className="mobile-flex-1"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 8,
                  height: 44,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  width: '100%'
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  {t('Lọc AI')}
                </span>
                <div
                  style={{
                    width: 36, height: 20, borderRadius: 10,
                    background: aiScreenerEnabled ? 'var(--color-success)' : 'rgba(148,163,184,0.3)',
                    position: 'relative', transition: 'background 0.2s',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%',
                    background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    left: aiScreenerEnabled ? 19 : 3, transition: 'left 0.2s'
                  }} />
                </div>
              </div>
            </div>

            {/* Desktop filter buttons */}

            <button
              onClick={() => setIsTokenStatsModalOpen(true)}
              className="btn primary hide-on-mobile"
              style={{
                height: 44,
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginLeft: 'auto',
                marginRight: '8px',
                padding: '0 16px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 2px 6px rgba(189, 29, 45, 0.25)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              <Sparkles size={15} />
              <span>{t('Thống kê token AI')}</span>
            </button>

            <button
              onClick={() => setIsStatsModalOpen(true)}
              className="btn primary hide-on-mobile"
              style={{
                height: 44,
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 16px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #a31422 0%, #a31422 100%)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 2px 6px rgba(163, 20, 34, 0.25)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              <BarChart2 size={15} />
              <span>{t('Thống kê dưới chuẩn')}</span>
            </button>
          </div>
        </div>

        {/* Held Leads Queue Table */}
        <div key={activeTab} className="subtab-enter-active">
          {heldLeadsLoading && heldLeads.length === 0 ? (
            <div style={{ padding: '2rem' }}><TableSkeleton rows={8} cols={4} /></div>
          ) : heldLeads.length === 0 ? (
            <div style={{ padding: '8rem 2rem', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <CheckCircle size={40} color="#10b981" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                {heldLeadsSearch ? t('Không tìm thấy liên hệ nào') : t('Không có liên hệ nào đang tạm giữ')}
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0' }}>
                {heldLeadsSearch ? t('Thử đổi từ khóa tìm kiếm.') : t('Hệ thống AI chưa tạm giữ bất kỳ liên hệ dưới chuẩn nào.')}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop View Table */}
              <div
                className="table-wrap hide-on-mobile"
                style={{
                  maxHeight: 'calc(100vh - 340px)',
                  overflowY: 'auto',
                  opacity: heldLeadsLoading ? 0.6 : 1,
                  pointerEvents: heldLeadsLoading ? 'none' : 'auto',
                  transition: 'opacity 0.15s ease'
                }}
              >
                <table className="mobile-table-compact" style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg)' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, width: 240, minWidth: 240, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>{t('Thông tin Lead')}</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, width: 220, minWidth: 220, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                        {activeTab === 'assigned' ? t('Vòng đã phân bổ') : t('Vòng phân bổ dự kiến')}
                      </th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                        {activeTab === 'substandard' ? t('Lý do từ chối') : t('Lý do AI tạm giữ')}
                      </th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, width: 280, minWidth: 280, position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>{t('Thao tác')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heldLeads.map((l: any) => (
                      <tr
                        key={l.id}
                        onClick={() => {
                          setSelectedLead({
                            id: l.id,
                            name: l.name,
                            phone: l.phone,
                            email: l.email || '-',
                            source: l.source || '-',
                            status: l.log_status || l.status,
                            assigned_to_name: l.consultant_name || '-',
                            assigned_to_avatar: l.consultant_avatar || undefined,
                            round_name: l.round_name || '-',
                            created_at: l.created_at,
                            type: l.type || '-',
                            note: l.note || '',
                            ai_screener_status: l.ai_screener_status,
                            ai_evaluation: l.ai_evaluation,
                            target_round_id: l.target_round_id
                          });
                        }}
                        style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', background: 'transparent', cursor: 'pointer' }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '1rem', width: 240, minWidth: 240, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Avatar name={l.name} size={36} />
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{l.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{maskPhone(l.phone)}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: 2 }}>
                                {new Date(l.created_at).toLocaleString('vi-VN')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', width: 220, minWidth: 220, whiteSpace: 'nowrap' }}>
                          {l.consultant_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Avatar src={l.consultant_avatar} name={l.consultant_name} size={32} aiScreened={!!(l.ai_screener_status && l.ai_screener_status !== 'not_screened')} />
                              <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{l.consultant_name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                  {l.round_name || '-'}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 5, background: 'rgba(163, 20, 34,0.08)', color: 'var(--color-primary)', padding: '3px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>
                              <Zap size={12} /> {l.round_name || '-'}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {activeTab !== 'assigned' && (
                              activeTab === 'ai_pending' ? (
                                <span style={{ padding: '4px 10px', alignSelf: 'flex-start', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(163, 20, 34, 0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <RefreshCw size={12} className="spin" /> {t('Chờ AI đánh giá')}
                                </span>
                              ) : l.ai_screener_status === 'error' ? (
                                <span style={{ padding: '4px 10px', alignSelf: 'flex-start', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <AlertTriangle size={12} /> {t('Lỗi kết nối AI (AI Error)')}
                                </span>
                              ) : l.ai_screener_status === 'pending' ? (
                                <span style={{ padding: '4px 10px', alignSelf: 'flex-start', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <AlertTriangle size={12} /> {t('Lỗi Timeout AI Pre-screener')}
                                </span>
                              ) : (l.status === 'blacklisted' || l.log_status === 'blacklisted') ? (
                                <span style={{ padding: '4px 10px', alignSelf: 'flex-start', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.16)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.35)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <ShieldAlert size={12} /> {t('Blacklist')}
                                </span>
                              ) : (
                                <span style={{ padding: '4px 10px', alignSelf: 'flex-start', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <ShieldAlert size={12} /> {t('Dưới chuẩn')}
                                </span>
                              )
                            )}
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)', lineHeight: 1.4, marginTop: 4, whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 450 }}>
                              {(() => {
                                const adminReason = extractManualReason(l.note || '');
                                if (adminReason) {
                                  return (
                                    <>
                                      <strong>{l.status === 'blacklisted' ? t('Lý do chặn:') : t('Lý do từ chối:')}</strong> {adminReason}
                                    </>
                                  );
                                }
                                return (
                                  <>
                                    <strong>{l.ai_screener_status === 'pending' ? (activeTab === 'ai_pending' ? t('Đang đánh giá:') : t('Lỗi AI Pre-screener:')) : l.ai_screener_status === 'error' ? t('Chi tiết lỗi:') : (l.ai_evaluation?.includes('bộ lọc thủ công') || l.ai_evaluation?.includes('khớp luật thủ công') || l.ai_evaluation?.includes('Bỏ qua gọi AI') || l.ai_evaluation?.includes('Không đạt vì') || l.ai_evaluation?.includes('Đạt vì')) ? t('Match logic:') : t('AI Đánh giá:')}</strong> {l.ai_screener_status === 'pending' ? (activeTab === 'ai_pending' ? t('Đang chờ AI phản hồi...') : t('Quá thời gian 5 phút AI chưa có đánh giá.')) : l.ai_evaluation || (l.ai_screener_status === 'error' ? t('Mất kết nối với dịch vụ AI.') : t('Không đáp ứng yêu cầu bộ lọc.'))}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {activeTab === 'ai_pending' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontSize: '0.825rem', fontWeight: 600 }}>
                                <RefreshCw size={14} className="spin" />
                                <span>{t('Đang chờ AI đánh giá...')}</span>
                              </div>
                            ) : activeTab === 'queue' ? (
                              <>
                                <button
                                  onClick={() => {
                                    setActioningHeldLead(l);
                                    setHeldActionReason('');
                                    setHeldActionModalOpen('blacklist');
                                  }}
                                  className="btn outline sm"
                                  style={{
                                    color: 'var(--color-danger)',
                                    borderColor: 'var(--color-danger)',
                                    boxShadow: 'none',
                                    padding: '0 8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: '32px',
                                    height: '32px'
                                  }}
                                  title={t("Đưa khách hàng vào danh sách đen & Xác nhận dưới chuẩn (Blacklist)")}
                                >
                                  <ShieldAlert size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setActioningHeldLead(l);
                                    setHeldActionReason('');
                                    setHeldActionModalOpen('reject');
                                  }}
                                  className="btn primary sm"
                                  style={{ background: 'var(--color-warning)', borderColor: 'var(--color-warning)', color: '#ffffff', boxShadow: 'none' }}
                                  title={t("Không duyệt và đánh dấu dưới chuẩn")}
                                >
                                  {t('Xác nhận dưới chuẩn')}
                                </button>
                                <button
                                  onClick={() => handleOpenApproveHeldLead(l)}
                                  className="btn primary sm"
                                  style={{
                                    background: '#10b981',
                                    borderColor: '#10b981',
                                    boxShadow: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                  title={t("Xem thử AI sẽ giao cho ai và Phê duyệt")}
                                >
                                  <Check size={14} />
                                  {t('Duyệt giao')}
                                </button>
                              </>
                            ) : activeTab === 'substandard' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                {l.status === 'blacklisted' ? (
                                  <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: 'rgba(239, 68, 68, 0.16)',
                                    color: 'var(--color-danger)',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                  }}>
                                    {t('Blacklist')}
                                  </span>
                                ) : (
                                  <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: 'var(--color-danger-light)',
                                    color: 'var(--color-danger)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                  }}>
                                    {t('Đã hủy')}
                                  </span>
                                )}
                                {(() => {
                                  const resDetail = getResolutionDetail(l.note || '');
                                  if (!resDetail) return null;
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        <Avatar src={adminAvatars[resDetail.admin]} name={resDetail.admin} size={18} />
                                        <span>{t('Bởi:')} <strong style={{ color: 'var(--color-text)' }}>{resDetail.admin}</strong></span>
                                      </div>
                                      {resDetail.time && (
                                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-light)' }}>
                                          {resDetail.time}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                <span style={{
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: 'var(--color-success-light)',
                                  color: 'var(--color-success)',
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}>
                                  {t('Đã giao')}
                                </span>
                                {(() => {
                                  const resDetail = getResolutionDetail(l.note || '');
                                  if (!resDetail) return null;
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        <Avatar src={adminAvatars[resDetail.admin]} name={resDetail.admin} size={18} />
                                        <span>{t('Bởi:')} <strong style={{ color: 'var(--color-text)' }}>{resDetail.admin}</strong></span>
                                      </div>
                                      {resDetail.time && (
                                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-light)' }}>
                                          {resDetail.time}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div
                className="mobile-only"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  padding: '0.5rem 0 5rem 0',
                  opacity: heldLeadsLoading ? 0.6 : 1,
                  pointerEvents: heldLeadsLoading ? 'none' : 'auto',
                  transition: 'opacity 0.15s ease'
                }}
              >
                {heldLeads.map((l: any) => (
                  <div
                    key={l.id}
                    onClick={() => {
                      setSelectedLead({
                        id: l.id,
                        name: l.name,
                        phone: l.phone,
                        email: l.email || '-',
                        source: l.source || '-',
                        status: l.log_status || l.status,
                        assigned_to_name: l.consultant_name || '-',
                        assigned_to_avatar: l.consultant_avatar || undefined,
                        round_name: l.round_name || '-',
                        created_at: l.created_at,
                        type: l.type || '-',
                        note: l.note || '',
                        ai_screener_status: l.ai_screener_status,
                        ai_evaluation: l.ai_evaluation,
                        target_round_id: l.target_round_id
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
                        <Avatar name={l.name} size={32} />
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.95rem' }}>{l.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                            <Phone size={12} style={{ opacity: 0.6 }} />
                            <span>{l.phone ? maskPhone(l.phone) : '-'}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', textAlign: 'right' }}>
                          {new Date(l.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}<br />
                          {new Date(l.created_at).toLocaleDateString('vi-VN')}
                        </div>
                        {l.round_name && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(163, 20, 34,0.08)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>
                            <Zap size={10} /> {l.round_name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Evaluation details callout */}
                    <div style={{
                      background: activeTab === 'assigned'
                        ? 'var(--color-bg-alt)'
                        : activeTab === 'ai_pending'
                          ? 'rgba(163, 20, 34, 0.04)'
                          : (l.ai_screener_status === 'error' || l.ai_screener_status === 'pending')
                            ? 'rgba(245, 158, 11, 0.04)'
                            : 'rgba(239, 68, 68, 0.04)',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      {activeTab !== 'assigned' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {activeTab === 'ai_pending' ? (
                            <>
                              <RefreshCw size={12} className="spin" color="var(--color-primary)" />
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                                {t('Chờ AI đánh giá')}
                              </span>
                            </>
                          ) : l.ai_screener_status === 'error' ? (
                            <>
                              <AlertTriangle size={12} color="#d97706" />
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#d97706' }}>
                                {t('Lỗi kết nối AI (AI Error)')}
                              </span>
                            </>
                          ) : l.ai_screener_status === 'pending' ? (
                            <>
                              <AlertTriangle size={12} color="#d97706" />
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#d97706' }}>
                                {t('Lỗi Timeout AI Pre-screener')}
                              </span>
                            </>
                          ) : (l.status === 'blacklisted' || l.log_status === 'blacklisted') ? (
                            <>
                              <ShieldAlert size={12} color="var(--color-danger)" />
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-danger)' }}>
                                {t('Blacklist')}
                              </span>
                            </>
                          ) : (
                            <>
                              <ShieldAlert size={12} color="var(--color-danger)" />
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-danger)' }}>
                                {t('Dưới chuẩn')}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                        {(() => {
                          const adminReason = extractManualReason(l.note || '');
                          if (adminReason) {
                            return (
                              <>
                                <strong>{l.status === 'blacklisted' ? t('Lý do chặn:') : t('Lý do từ chối:')}</strong> {adminReason}
                              </>
                            );
                          }
                          return (
                            <>
                              <strong>{l.ai_screener_status === 'pending' ? (activeTab === 'ai_pending' ? t('Đang đánh giá:') : t('Lỗi AI Pre-screener:')) : l.ai_screener_status === 'error' ? t('Chi tiết lỗi:') : (l.ai_evaluation?.includes('bộ lọc thủ công') || l.ai_evaluation?.includes('khớp luật thủ công') || l.ai_evaluation?.includes('Bỏ qua gọi AI') || l.ai_evaluation?.includes('Không đạt vì') || l.ai_evaluation?.includes('Đạt vì')) ? t('Match logic:') : t('AI Đánh giá:')}</strong>{' '}
                              {l.ai_screener_status === 'pending' ? (activeTab === 'ai_pending' ? t('Đang chờ AI phản hồi...') : t('Quá thời gian 5 phút AI chưa có đánh giá.')) : l.ai_evaluation || (l.ai_screener_status === 'error' ? t('Mất kết nối với dịch vụ AI.') : t('Không đáp ứng yêu cầu bộ lọc.'))}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Actions footer */}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem', width: '100%' }} onClick={e => e.stopPropagation()}>
                      {activeTab === 'ai_pending' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 600 }}>
                          <RefreshCw size={12} className="spin" />
                          <span>{t('Đang chờ AI đánh giá...')}</span>
                        </div>
                      ) : activeTab === 'queue' ? (
                        <>
                          <button
                            onClick={() => {
                              setActioningHeldLead(l);
                              setHeldActionReason('');
                              setHeldActionModalOpen('blacklist');
                            }}
                            className="btn outline sm"
                            style={{
                              color: 'var(--color-danger)',
                              borderColor: 'var(--color-danger)',
                              boxShadow: 'none',
                              width: 36,
                              height: 36,
                              padding: 0,
                              borderRadius: 10,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                            title={t("Chặn & Blacklist")}
                          >
                            <ShieldAlert size={16} />
                          </button>

                          <button
                            onClick={() => {
                              setActioningHeldLead(l);
                              setHeldActionReason('');
                              setHeldActionModalOpen('reject');
                            }}
                            className="btn primary sm"
                            style={{ background: 'var(--color-warning)', borderColor: 'var(--color-warning)', color: '#ffffff', boxShadow: 'none', height: 36, borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            title={t('Dưới chuẩn')}
                          >
                            <XCircle size={14} />
                            <span>{t('Dưới chuẩn')}</span>
                          </button>

                          <button
                            onClick={() => handleOpenApproveHeldLead(l)}
                            className="btn primary sm"
                            style={{ background: '#10b981', borderColor: '#10b981', boxShadow: 'none', height: 36, borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            title={t('Duyệt')}
                          >
                            <Check size={14} />
                            <span>{t('Duyệt')}</span>
                          </button>
                        </>
                      ) : activeTab === 'substandard' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          {l.status === 'blacklisted' ? (
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: 'rgba(239, 68, 68, 0.16)',
                              color: 'var(--color-danger)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}>
                              {t('Blacklist')}
                            </span>
                          ) : (
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: 'var(--color-danger-light)',
                              color: 'var(--color-danger)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}>
                              {t('Đã hủy')}
                            </span>
                          )}
                          {(() => {
                            const resDetail = getResolutionDetail(l.note || '');
                            if (!resDetail) return null;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                <Avatar src={adminAvatars[resDetail.admin]} name={resDetail.admin} size={16} />
                                <span>{t('Bởi:')} <strong>{resDetail.admin}</strong></span>
                                {resDetail.time && <span style={{ opacity: 0.7 }}>({resDetail.time.split(' ')[0]})</span>}
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: 'var(--color-success-light)',
                            color: 'var(--color-success)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}>
                            {t('Đã giao')}
                          </span>
                          {(() => {
                            const resDetail = getResolutionDetail(l.note || '');
                            if (!resDetail) return null;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                <Avatar src={adminAvatars[resDetail.admin]} name={resDetail.admin} size={16} />
                                <span>{t('Bởi:')} <strong>{resDetail.admin}</strong></span>
                                {resDetail.time && <span style={{ opacity: 0.7 }}>({resDetail.time.split(' ')[0]})</span>}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {!heldLeadsLoading && heldLeadsTotalCount > 0 && (
          <div className="responsive-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', flexShrink: 0 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {t('Hiển thị')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, heldLeadsTotalCount)}</span> {t('trên')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{heldLeadsTotalCount}</span>
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
                {Array.from({ length: Math.min(5, Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE)) }, (_, i) => {
                  const totalHeldPages = Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE);
                  let startPage = 1;
                  if (totalHeldPages > 5) {
                    if (currentPage > 3) {
                      startPage = currentPage - 2;
                      if (startPage + 4 > totalHeldPages) {
                        startPage = totalHeldPages - 4;
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
                onClick={() => updateParams('page', String(Math.min(currentPage + 1, Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE))))}
                disabled={currentPage === Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE)}
                style={{ padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)', background: currentPage === Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE) ? 'var(--color-bg)' : 'var(--color-surface)', color: currentPage === Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE) ? 'var(--color-text-muted)' : 'var(--color-text)', cursor: currentPage === Math.ceil(heldLeadsTotalCount / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal (Cấu hình Bộ lọc AI) */}
      <CustomModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title={t("Cấu hình Bộ lọc AI")}
        width="950px"
      >
        {isSettingsModalOpen && (
          <fieldset disabled={isReadOnly} style={{ border: 'none', padding: 0, margin: 0, height: '100%', width: '100%', display: 'contents' }}>
            <style>{`
              div:has(> .settings-modal-container) {
                overflow: hidden !important;
                padding: 0 !important;
              }
            `}</style>
            <div className="settings-modal-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(80vh - 100px)', padding: '1.5rem', overflowX: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {settingsLoading ? (
                    <TableSkeleton rows={4} cols={2} />
                  ) : (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1.25rem',
                        background: 'var(--color-bg-alt)', borderRadius: '12px', border: '1px dashed var(--color-border)'
                      }}>
                        <div style={{ opacity: isReadOnly ? 0.6 : 1, pointerEvents: isReadOnly ? 'none' : 'auto' }}>
                          <ToggleSwitch
                            checked={aiScreenerEnabled}
                            onChange={setAiScreenerEnabled}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {t('Kích hoạt AI Pre-screener (Pre-screener Gatekeeper)')}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                            {t('Khi bật, mọi data mới thuộc các vòng được chọn sẽ đi qua bộ lọc AI đánh giá trước khi phân bổ tự động.')}
                          </div>
                        </div>
                      </div>



                      {aiScreenerEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>

                          {/* Configuration Cards List */}
                          {aiScreenerConfigs.map((config: AIScreenerConfig, index: number) => {
                            return (
                              <div
                                key={config.id}
                                style={{
                                  border: '1px solid var(--color-border)',
                                  borderRadius: '12px',
                                  padding: '1.25rem',
                                  position: 'relative',
                                  background: 'var(--color-surface)',
                                  boxShadow: 'var(--shadow-sm)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '1rem'
                                }}
                              >
                                {/* Card Decorative Left border */}
                                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: 'var(--color-primary)', borderRadius: '12px 0 0 12px' }} />

                                {/* Card Header: Title input and Delete button */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, marginRight: '1.5rem' }}>
                                    <span style={{
                                      background: 'rgba(163, 20, 34, 0.1)',
                                      color: 'var(--color-primary)',
                                      fontWeight: 800,
                                      width: 24, height: 24,
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.8rem',
                                      flexShrink: 0
                                    }}>{index + 1}</span>
                                    <input
                                      type="text"
                                      value={config.name}
                                      onChange={e => {
                                        const updated = [...aiScreenerConfigs];
                                        updated[index].name = e.target.value;
                                        setAiScreenerConfigs(updated);
                                      }}
                                      placeholder={t("Tên nhóm cấu hình (Ví dụ: Nhóm Vòng tiếng Anh)")}
                                      className="form-input"
                                      style={{ height: 36, fontSize: '0.875rem', fontWeight: 700, width: '100%', maxWidth: 350, border: 'none', background: 'transparent', padding: '0 4px', borderBottom: '1px dashed var(--color-border)' }}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    className="btn ghost"
                                    style={{ color: 'var(--color-danger)', padding: 4 }}
                                    onClick={() => {
                                      setAiScreenerConfigs(aiScreenerConfigs.filter((cfg: AIScreenerConfig) => cfg.id !== config.id));
                                    }}
                                    title={t("Xóa nhóm cấu hình lọc này")}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                                {/* Section 1: Choose Rounds (Tags Select with Dropdown) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                                    {t('Chọn các vòng áp dụng cho nhóm này')}
                                  </label>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                    {/* Display already selected rounds */}
                                    {config.rounds.map((roundId: number) => {
                                      const r = rounds.find((x: any) => Number(x.id) === roundId);
                                      if (!r) return null;
                                      return (
                                        <span
                                          key={roundId}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '5px 12px',
                                            borderRadius: '9999px',
                                            fontSize: '0.8125rem',
                                            fontWeight: 600,
                                            border: '1px solid var(--color-primary)',
                                            background: 'var(--color-primary)',
                                            color: '#ffffff',
                                            boxShadow: '0 2px 8px rgba(163, 20, 34, 0.2)',
                                            transition: 'all 0.2s ease'
                                          }}
                                        >
                                          <Tag size={12} style={{ opacity: 0.9 }} />
                                          {r.round_name}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = [...aiScreenerConfigs];
                                              updated[index].rounds = config.rounds.filter((id: number) => id !== roundId);
                                              setAiScreenerConfigs(updated);
                                            }}
                                            style={{
                                              border: 'none',
                                              background: 'rgba(255, 255, 255, 0.15)',
                                              color: '#ffffff',
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              padding: '2px',
                                              borderRadius: '50%',
                                              marginLeft: '4px',
                                              outline: 'none',
                                              transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
                                              e.currentTarget.style.color = '#ffffff';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                                              e.currentTarget.style.color = '#ffffff';
                                            }}
                                          >
                                            <X size={10} />
                                          </button>
                                        </span>
                                      );
                                    })}

                                    {/* Plus Button to add more rounds */}
                                    <div style={{ position: 'relative' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveRoundsDropdown(activeRoundsDropdown === config.id ? null : config.id);
                                        }}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '5px 12px',
                                          borderRadius: '9999px',
                                          fontSize: '0.8125rem',
                                          fontWeight: 600,
                                          border: '1px dashed var(--color-primary-light)',
                                          background: 'rgba(163, 20, 34, 0.02)',
                                          color: 'var(--color-primary)',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s ease',
                                          outline: 'none',
                                          boxShadow: 'var(--shadow-sm)'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = 'rgba(163, 20, 34, 0.08)';
                                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                                          e.currentTarget.style.transform = 'translateY(-0.5px)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = 'rgba(163, 20, 34, 0.02)';
                                          e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                                          e.currentTarget.style.transform = 'none';
                                        }}
                                      >
                                        <Plus size={12} />
                                        <span>{t('Thêm vòng')}</span>
                                      </button>

                                      {/* Dropdown Menu */}
                                      {activeRoundsDropdown === config.id && (
                                        <div
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 6px)',
                                            left: 0,
                                            zIndex: 55,
                                            minWidth: '220px',
                                            background: 'var(--color-surface)',
                                            border: '1px solid rgba(163, 20, 34, 0.15)',
                                            borderRadius: '12px',
                                            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.3)',
                                            maxHeight: '220px',
                                            overflowY: 'auto',
                                            padding: '6px'
                                          }}
                                        >
                                          {(() => {
                                            // Filter rounds that are NOT selected in this config
                                            const availableRounds = rounds.filter((r: any) => !config.rounds.includes(Number(r.id)));

                                            if (availableRounds.length === 0) {
                                              return (
                                                <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                                  {t('Không còn vòng nào khả dụng')}
                                                </div>
                                              );
                                            }

                                            return availableRounds.map((r: any) => {
                                              const roundId = Number(r.id);
                                              const isInactive = Number(r.is_active) !== 1;
                                              // Check if selected in another config
                                              const selectedElsewhere = aiScreenerConfigs.some((cfg: AIScreenerConfig, idx: number) => idx !== index && cfg.rounds.includes(roundId)) || aiScreenerConfigs.some(cfg => cfg.below_standard_fallback_enabled && Number(roundId) === Number(cfg.below_standard_fallback_round_id));

                                              return (
                                                <button
                                                  key={roundId}
                                                  type="button"
                                                  disabled={selectedElsewhere || isInactive}
                                                  onClick={() => {
                                                    const updated = [...aiScreenerConfigs];
                                                    updated[index].rounds = [...config.rounds, roundId];
                                                    setAiScreenerConfigs(updated);
                                                    setActiveRoundsDropdown(null);
                                                  }}
                                                  style={{
                                                    width: '100%',
                                                    padding: '10px 14px',
                                                    fontSize: '0.8125rem',
                                                    fontWeight: 550,
                                                    textAlign: 'left',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    color: (selectedElsewhere || isInactive) ? 'var(--color-text-muted)' : 'var(--color-text)',
                                                    opacity: (selectedElsewhere || isInactive) ? 0.45 : 1,
                                                    cursor: (selectedElsewhere || isInactive) ? 'not-allowed' : 'pointer',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '10px',
                                                    transition: 'all 0.15s ease',
                                                    outline: 'none'
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    if (!selectedElsewhere && !isInactive) {
                                                      e.currentTarget.style.background = 'rgba(163, 20, 34, 0.08)';
                                                      e.currentTarget.style.color = 'var(--color-primary)';
                                                    }
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    if (!selectedElsewhere && !isInactive) {
                                                      e.currentTarget.style.background = 'transparent';
                                                      e.currentTarget.style.color = 'var(--color-text)';
                                                    }
                                                  }}
                                                >
                                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: (selectedElsewhere || isInactive) ? 'var(--color-text-muted)' : 'var(--color-primary)' }} />
                                                    {r.round_name}
                                                  </span>
                                                  {isInactive ? (
                                                    <span style={{
                                                      fontSize: '0.6875rem',
                                                      color: 'var(--color-text-muted)',
                                                      background: 'rgba(0, 0, 0, 0.05)',
                                                      padding: '2px 6px',
                                                      borderRadius: '4px',
                                                      fontWeight: 600,
                                                      flexShrink: 0
                                                    }}>
                                                      {t('Không hoạt động')}
                                                    </span>
                                                  ) : selectedElsewhere && (
                                                    <span style={{
                                                      fontSize: '0.6875rem',
                                                      color: 'var(--color-danger)',
                                                      background: 'rgba(239, 68, 68, 0.08)',
                                                      padding: '2px 6px',
                                                      borderRadius: '4px',
                                                      fontWeight: 600,
                                                      flexShrink: 0,
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: '4px'
                                                    }}>
                                                      <Shield size={10} />
                                                      {t('Nhóm khác')}
                                                    </span>
                                                  )}
                                                </button>
                                              );
                                            });
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>


                                {/* Section 2: Choose Mode */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                                    {t('Chế độ Lọc Pre-screener')}
                                  </label>
                                  <CustomSelect
                                    options={[
                                      { value: 'manual', label: t('Sử dụng Quy tắc Thủ công (Manual Rules)') },
                                      { value: 'hybrid', label: t('Kết hợp: Lọc Thủ công + AI (Ưu tiên thủ công trước)') },
                                      { value: 'ai', label: t('Sử dụng Trí tuệ Nhân tạo (Gemini AI)') }
                                    ]}
                                    value={config.mode}
                                    disabled={isReadOnly}
                                    onChange={val => {
                                      const updated = [...aiScreenerConfigs];
                                      updated[index].mode = val as any;
                                      setAiScreenerConfigs(updated);
                                    }}
                                    width="100%"
                                  />
                                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                                    {config.mode === 'hybrid' && (
                                      <span style={{ color: '#059669', fontWeight: 500 }}>
                                        {t('Chế độ Kết hợp: Hệ thống chạy bộ lọc thủ công trước. Nếu khớp, thực hiện ngay hành động và BỎ QUA gọi AI để tiết kiệm tối đa chi phí. Nếu không khớp, mới gọi AI đánh giá.')}
                                      </span>
                                    )}
                                    {config.mode === 'manual' && (
                                      <span>
                                        {t('Chế độ Thủ công: Chỉ áp dụng quy tắc khớp cột dữ liệu đã cấu hình.')}
                                      </span>
                                    )}
                                    {config.mode === 'ai' && (
                                      <span>
                                        {t('Chế độ AI: RICH LAND AI để đánh giá theo yêu cầu cấu hình dưới.')}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Conditional Prompt Area */}
                                {(config.mode === 'ai' || config.mode === 'hybrid') && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                                      {t('Quy tắc đạt chuẩn duy nhất')}
                                    </label>
                                    <textarea
                                      value={config.ai_rules}
                                      onChange={e => {
                                        const updated = [...aiScreenerConfigs];
                                        updated[index].ai_rules = e.target.value;
                                        setAiScreenerConfigs(updated);
                                      }}
                                      rows={4}
                                      className="form-input"
                                      style={{ resize: 'vertical' }}
                                      placeholder={t("Ví dụ: Tiếng Anh: Đạt chuẩn (đã đi làm hoặc có IELTS), Không đạt chuẩn (học sinh cấp 1, 2)...")}
                                    />
                                  </div>
                                )}

                                {/* Conditional Manual Rules Area */}
                                {(config.mode === 'manual' || config.mode === 'hybrid') && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                                        {t('Danh sách Quy tắc Lọc Thủ công')}
                                      </label>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Hành động khi khớp:')}</span>
                                        <div style={{ width: 140 }}>
                                          <CustomSelect
                                            options={[
                                              { value: 'hold', label: t('Tạm giữ (Hành động)') },
                                              { value: 'skip', label: t('Bỏ qua/Duyệt') }
                                            ]}
                                            value={config.manual_action}
                                            onChange={val => {
                                              const updated = [...aiScreenerConfigs];
                                              updated[index].manual_action = val as any;
                                              setAiScreenerConfigs(updated);
                                            }}
                                            width="100%"
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                      {(config.manual_rules || []).map((branch: any, bIndex: number) => (
                                        <div key={bIndex} style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.75rem 1rem', position: 'relative', background: 'var(--color-bg-alt)', boxShadow: 'var(--shadow-sm)' }}>
                                          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 3, background: '#10b981', borderRadius: '10px 0 0 10px' }} />
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                                              {t("Nhánh {num}").replace('{num}', String(bIndex + 1))}
                                            </h4>
                                            <button
                                              type="button"
                                              className="btn ghost"
                                              style={{ color: 'var(--color-danger)', padding: 4 }}
                                              onClick={() => {
                                                const updated = [...aiScreenerConfigs];
                                                updated[index].manual_rules = config.manual_rules.filter((_: any, idx: number) => idx !== bIndex);
                                                setAiScreenerConfigs(updated);
                                              }}
                                            >
                                              <Trash2 size={16} />
                                            </button>
                                          </div>

                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {(branch.conditions || []).map((c: any, i: number) => {
                                              const isNoValueOp = c.op === 'is_empty' || c.op === 'is_not_empty';
                                              const isLast = i === branch.conditions.length - 1;
                                              return (
                                                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                  <div style={{ position: 'relative', width: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                    {i === 0 ? (
                                                      <div style={{ background: '#d1fae5', color: '#047857', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 800, flexShrink: 0, zIndex: 2 }}>IF</div>
                                                    ) : (
                                                      <div style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0, zIndex: 2 }}>AND</div>
                                                    )}
                                                    {!isLast && (
                                                      <div style={{ position: 'absolute', top: 18, bottom: -18, width: 1.5, borderLeft: '1.5px dashed var(--color-border)', zIndex: 1 }} />
                                                    )}
                                                  </div>

                                                  <div style={{ width: 130 }}>
                                                    <CustomSelect
                                                      options={[
                                                        { value: 'source', label: t('Nguồn (Source)') },
                                                        { value: 'name', label: t('Tên KH (Name)') },
                                                        { value: 'phone', label: t('Số ĐT (Phone)') },
                                                        { value: 'email', label: t('Email') },
                                                        { value: 'note', label: t('Ghi chú (Note)') }
                                                      ]}
                                                      value={c.col || 'source'}
                                                      onChange={val => {
                                                        const updated = [...aiScreenerConfigs];
                                                        updated[index].manual_rules[bIndex].conditions[i].col = String(val);
                                                        setAiScreenerConfigs(updated);
                                                      }}
                                                      width="100%"
                                                      size="sm"
                                                    />
                                                  </div>

                                                  <div style={{ width: 140 }}>
                                                    <CustomSelect
                                                      options={[
                                                        { value: 'contains', label: t('Có chứa') },
                                                        { value: 'not_contains', label: t('Không chứa') },
                                                        { value: 'equals', label: t('Bằng') },
                                                        { value: 'starts_with', label: t('Bắt đầu bằng') },
                                                        { value: 'ends_with', label: t('Kết thúc bằng') },
                                                        { value: 'is_empty', label: t('Rỗng') },
                                                        { value: 'is_not_empty', label: t('Không rỗng') }
                                                      ]}
                                                      value={c.op || 'contains'}
                                                      onChange={val => {
                                                        const updated = [...aiScreenerConfigs];
                                                        updated[index].manual_rules[bIndex].conditions[i].op = String(val);
                                                        if (val === 'is_empty' || val === 'is_not_empty') {
                                                          updated[index].manual_rules[bIndex].conditions[i].val = '';
                                                        }
                                                        setAiScreenerConfigs(updated);
                                                      }}
                                                      width="100%"
                                                      size="sm"
                                                    />
                                                  </div>

                                                  {!isNoValueOp && (
                                                    <div style={{ flex: 1, minWidth: 150 }}>
                                                      <input
                                                        type="text"
                                                        value={c.val || ''}
                                                        onChange={e => {
                                                          const updated = [...aiScreenerConfigs];
                                                          updated[index].manual_rules[bIndex].conditions[i].val = e.target.value;
                                                          setAiScreenerConfigs(updated);
                                                        }}
                                                        placeholder={t("Giá trị so khớp...")}
                                                        className="form-input"
                                                        style={{ height: 32, fontSize: '0.8rem', width: '100%', borderRadius: 'var(--radius-md)' }}
                                                      />
                                                    </div>
                                                  )}

                                                  <button
                                                    type="button"
                                                    className="btn ghost"
                                                    style={{ color: 'var(--color-text-muted)', padding: 4 }}
                                                    onClick={() => {
                                                      const updated = [...aiScreenerConfigs];
                                                      const remaining = config.manual_rules[bIndex].conditions.filter((_: any, idx: number) => idx !== i);
                                                      if (remaining.length === 0) {
                                                        updated[index].manual_rules = config.manual_rules.filter((_: any, idx: number) => idx !== bIndex);
                                                      } else {
                                                        updated[index].manual_rules[bIndex].conditions = remaining;
                                                      }
                                                      setAiScreenerConfigs(updated);
                                                    }}
                                                  >
                                                    <XCircle size={15} />
                                                  </button>
                                                </div>
                                              );
                                            })}

                                            <div style={{ paddingLeft: 44, marginTop: 4 }}>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const updated = [...aiScreenerConfigs];
                                                  updated[index].manual_rules[bIndex].conditions.push({ col: 'source', op: 'contains', val: '' });
                                                  setAiScreenerConfigs(updated);
                                                }}
                                                className="btn ghost"
                                                style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
                                              >
                                                <Plus size={12} /> {t("Thêm điều kiện (AND)")}
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ))}

                                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...aiScreenerConfigs];
                                            updated[index].manual_rules = [...(config.manual_rules || []), { conditions: [{ col: 'source', op: 'contains', val: '' }] }];
                                            setAiScreenerConfigs(updated);
                                          }}
                                          className="btn outline"
                                          style={{ gap: 6, fontWeight: 700, borderRadius: 20, borderColor: 'var(--color-primary)', color: 'var(--color-primary)', padding: '6px 14px', fontSize: '0.8125rem' }}
                                        >
                                          <Plus size={14} /> {t("Thêm nhánh quy tắc")}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Section: Substandard Lead Fallback Settings (per branch) */}
                                <div style={{
                                  borderTop: '1px dashed var(--color-border)',
                                  paddingTop: '1.25rem',
                                  marginTop: '0.5rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '1rem'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <ToggleSwitch
                                      checked={!!config.below_standard_fallback_enabled}
                                      onChange={checked => {
                                        const updated = [...aiScreenerConfigs];
                                        updated[index].below_standard_fallback_enabled = checked;
                                        setAiScreenerConfigs(updated);
                                      }}
                                    />
                                    <div>
                                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                        {t('Fallback lead dưới chuẩn vào vòng khác')}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                        {t('Nếu bật, lead dưới chuẩn thuộc nhóm này sẽ được chuyển vào một vòng chỉ định thay vì hủy bỏ.')}
                                      </div>
                                    </div>
                                  </div>

                                  {config.below_standard_fallback_enabled && (
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                      gap: '1.5rem',
                                      paddingLeft: '3.25rem',
                                      alignItems: 'start',
                                      animation: 'fadeIn 0.15s ease-out'
                                    }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                                          {t('Vòng nhận lead dưới chuẩn (Fallback Round)')}
                                        </label>
                                        <CustomSelect
                                          options={[
                                            { value: '', label: `-- ${t('Chọn Vòng phân bổ fallback')} --` },
                                            ...rounds.map((r: any) => ({
                                              value: String(r.id),
                                              label: r.round_name,
                                              disabled: Number(r.is_active) !== 1,
                                              disabledType: 'round' as const
                                            }))
                                          ]}
                                          value={config.below_standard_fallback_round_id ? String(config.below_standard_fallback_round_id) : ''}
                                          onChange={val => {
                                            const updated = [...aiScreenerConfigs];
                                            updated[index].below_standard_fallback_round_id = val ? Number(val) : '';
                                            setAiScreenerConfigs(updated);
                                          }}
                                          width="100%"
                                        />
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: '22px' }}>
                                        <ToggleSwitch
                                          checked={!!config.below_standard_auto_approve}
                                          onChange={checked => {
                                            const updated = [...aiScreenerConfigs];
                                            updated[index].below_standard_auto_approve = checked;
                                            setAiScreenerConfigs(updated);
                                          }}
                                        />
                                        <div>
                                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                            {t('Tự động duyệt lead dưới chuẩn (Không tạm giữ)')}
                                          </div>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.45 }}>
                                            {t('Nếu bật, data dưới chuẩn sẽ được chuyển thẳng đến vòng fallback mà không đưa vào hàng chờ.')}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                              </div>
                            );
                          })}

                          {/* Add Group Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setAiScreenerConfigs([...aiScreenerConfigs, {
                                id: 'config_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                                name: '',
                                rounds: [],
                                mode: 'ai',
                                ai_rules: '',
                                manual_action: 'hold',
                                manual_rules: []
                              }]);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              padding: '1.25rem',
                              borderRadius: '12px',
                              border: '2px dashed var(--color-primary-light)',
                              background: 'rgba(163, 20, 34, 0.02)',
                              color: 'var(--color-primary)',
                              fontWeight: 700,
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              width: '100%'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = 'rgba(163, 20, 34, 0.06)';
                              e.currentTarget.style.borderColor = 'var(--color-primary)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'rgba(163, 20, 34, 0.02)';
                              e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                            }}
                          >
                            <Plus size={16} /> {t("Thêm nhóm cấu hình lọc mới")}
                          </button>

                        </div>
                      )}
                    </>
                  )}
                </div>

              </div>

              {/* Sticky Bottom Actions Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                borderTop: '1px solid var(--color-border)',
                paddingTop: '1rem',
                marginTop: '0.75rem',
                flexShrink: 0
              }}>
                <button className="btn outline" onClick={() => setIsSettingsModalOpen(false)}>
                  {isReadOnly ? t("Đóng") : t("Hủy bỏ")}
                </button>
                {!isReadOnly && (
                  <button
                    onClick={handleSaveConfig}
                    disabled={savingSettings}
                    className="btn primary"
                    style={{ gap: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', padding: '10px 24px' }}
                  >
                    {savingSettings ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                    {t("Lưu cấu hình bộ lọc")}
                  </button>
                )}
              </div>
            </div>
          </fieldset>
        )}
      </CustomModal>

      {/* Guide Modal */}
      <CustomModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
        title={t("Ưu điểm & Hướng dẫn sử dụng Bộ lọc AI")}
        width="950px"
      >
        {isGuideModalOpen && (
          <>
            <style>{`
              div:has(> .guide-modal-container) {
                overflow: hidden !important;
                padding: 0 !important;
              }
            `}</style>
            <div className="guide-modal-container" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowX: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }} className="responsive-grid-1-1">
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Zap size={18} color="#eab308" />
                      {t('Mẹo cấu hình Gemini AI')}
                    </h4>
                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      <li>
                        <strong>{t('Đặt tiêu chuẩn rõ ràng:')}</strong> {t('AI hoạt động tốt nhất khi được cung cấp quy tắc dạng logic như "Tiếng Anh: Đạt chuẩn (đã đi làm hoặc sinh viên muốn IELTS), Không đạt (học sinh cấp 1, cấp 2 hoặc không nghe điện thoại)".')}
                      </li>
                      <li>
                        <strong>{t('Không cần viết code:')}</strong> {t('Hãy dùng ngôn ngữ tự nhiên bình thường. AI có khả năng đọc ghi chú, thông tin học vấn hay nguồn để suy luận rất tốt.')}
                      </li>
                      <li>
                        <strong>{t('Luôn chỉ rõ trường hợp loại trừ:')}</strong> {t('Ví dụ: "Số điện thoại bị thiếu số hoặc ghi chú ghi là test thì luôn đánh giá không đạt chuẩn".')}
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShieldAlert size={18} color="#3b82f6" />
                      {t('Hướng dẫn xử lý duyệt')}
                    </h4>
                    <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      <li>
                        <strong>{t('Duyệt giao:')}</strong> {t('Lead sẽ được giao tự động cho Sale tiếp theo trong vòng chia số hiện tại. Bạn có thể xem trước Sale nhận ở popup trước khi ấn duyệt.')}
                      </li>
                      <li>
                        <strong>{t('Xác nhận dưới chuẩn:')}</strong> {t('Hệ thống đánh dấu lead này dưới chuẩn và loại bỏ khỏi hàng chờ. Nó sẽ không được chia số và không làm tốn lượt của tư vấn viên.')}
                      </li>
                      <li>
                        <strong>{t('Chặn & Blacklist:')}</strong> {t('Đưa số điện thoại này vào Global Blacklist để tự động từ chối tuyệt đối tất cả các lead có số điện thoại này ở các lần đổ sau.')}
                      </li>
                    </ul>
                  </div>
                </div>

              </div>

              {/* Sticky Bottom Actions Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                borderTop: '1px solid var(--color-border)',
                paddingTop: '1rem',
                marginTop: '0.75rem',
                flexShrink: 0
              }}>
                <button className="btn outline" onClick={() => setIsGuideModalOpen(false)}>
                  {t("Đóng")}
                </button>
              </div>
            </div>
          </>
        )}
      </CustomModal>

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

      {/* AI Pre-screener Filter Stats Modal */}
      <CustomModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        title={t("Thống kê bộ lọc AI Pre-screener")}
        width="1000px"
      >
        {isStatsModalOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem 0' }}>

            {/* Header/Subtitle containing selected Date Filter */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: 'rgba(163, 20, 34, 0.06)',
              border: '1px solid rgba(163, 20, 34, 0.15)',
              borderRadius: '10px',
              marginBottom: '4px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Filter size={16} color="var(--color-primary)" />
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }} className="hide-on-mobile">
                  {t('Đang áp dụng bộ lọc thời gian:')}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }} className="mobile-only">
                  {t('Bộ lọc:')}
                </span>
                <span style={{
                  background: 'linear-gradient(135deg, #a31422 0%, #a31422 100%)',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  boxShadow: '0 2px 4px rgba(163, 20, 34, 0.2)'
                }}>
                  {getDisplayDateFilterText(dateFilter)}
                </span>
              </div>
              {statsLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>{t('Đang tải dữ liệu mới...')}</span>
                </div>
              )}
            </div>

            {statsLoading && !statsData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  <KpiCardSkeleton />
                  <KpiCardSkeleton />
                  <KpiCardSkeleton />
                  <KpiCardSkeleton />
                </div>
                <ChartSkeleton height={260} />
              </div>
            ) : !statsData ? (
              <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                {t('Không có dữ liệu thống kê.')}
              </div>
            ) : (
              <>
                {/* Breakdowns columns grid (Rounds, Sources, Reasons) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                  marginTop: '10px'
                }}>
                  {/* 1. Breakdown by Rounds */}
                  <div className="card" style={{
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <GitBranch size={18} color="#a31422" />
                        {t('Vòng phân bổ dưới chuẩn nhiều nhất')}
                      </h4>
                    </div>
                    <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '220px', overflowY: 'auto', paddingRight: 4 }}>
                      {statsData.rounds_breakdown?.length === 0 ? (
                        <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          {t('Không có dữ liệu phân bố vòng')}
                        </div>
                      ) : (
                        statsData.rounds_breakdown?.map((item: any, idx: number) => {
                          const totalBS = statsData.stats?.total_below_standard || 1;
                          const pct = Math.round((item.count / totalBS) * 100);
                          const colors = ['#a31422', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
                          const color = colors[idx % colors.length];
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', background: color, flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{item.round_name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{`${pct}% ${t('tổng dưới chuẩn')}`}</div>
                              </div>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{item.count}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 2. Breakdown by Sources */}
                  <div className="card" style={{
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart2 size={18} color="#3b82f6" />
                        {t('Nguồn kết nối dưới chuẩn nhiều nhất')}
                      </h4>
                    </div>
                    <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '220px', overflowY: 'auto', paddingRight: 4 }}>
                      {statsData.sources_breakdown?.length === 0 ? (
                        <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          {t('Không có dữ liệu phân bố nguồn')}
                        </div>
                      ) : (
                        statsData.sources_breakdown?.map((item: any, idx: number) => {
                          const totalBS = statsData.stats?.total_below_standard || 1;
                          const pct = Math.round((item.count / totalBS) * 100);
                          const colors = ['#3b82f6', '#10b981', '#a31422', '#f59e0b', '#ef4444'];
                          const color = colors[idx % colors.length];
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', background: color, flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{item.source_name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{`${pct}% ${t('tổng dưới chuẩn')}`}</div>
                              </div>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{item.count}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 3. Tỷ lệ Duyệt & Dưới chuẩn */}
                  <div className="card" style={{
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Scale size={18} color="#10b981" />
                        {t('Tỷ lệ Duyệt & Dưới chuẩn')}
                      </h4>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {(() => {
                        const stats = statsData.stats || {
                          total_leads: 0,
                          count_duyet: 0,
                          count_ai_giu: 0,
                          count_duoi_chuan: 0,
                          count_giao_lead: 0
                        };
                        const totalLeads = stats.total_leads || 0;
                        const countDuyet = stats.count_duyet || 0;
                        const countAiGiu = stats.count_ai_giu || 0;
                        const countDuoiChuan = stats.count_duoi_chuan || 0;
                        const countGiaoLead = stats.count_giao_lead || 0;

                        const duyetPct = totalLeads > 0 ? Math.round((countDuyet / totalLeads) * 100) : 0;
                        const aiGiuPct = totalLeads > 0 ? Math.round((countAiGiu / totalLeads) * 100) : 0;
                        const duoiChuanPct = totalLeads > 0 ? Math.round((countDuoiChuan / totalLeads) * 100) : 0;
                        const giaoLeadPct = totalLeads > 0 ? 100 - duyetPct - aiGiuPct - duoiChuanPct : 0;
                        const giaoLeadPctClamped = Math.max(0, giaoLeadPct);

                        return (
                          <>
                            {/* Passed Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('Duyệt')}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{`${duyetPct}% ${t('tổng data')}`}</div>
                              </div>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{countDuyet}</div>
                            </div>

                            {/* AI giữ Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('AI giữ')}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{`${aiGiuPct}% ${t('tổng data')}`}</div>
                              </div>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{countAiGiu}</div>
                            </div>

                            {/* Dưới chuẩn Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('Dưới chuẩn')}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{`${duoiChuanPct}% ${t('tổng data')}`}</div>
                              </div>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{countDuoiChuan}</div>
                            </div>

                            {/* Giao lead Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#a31422', flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('Giao lead')}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{`${giaoLeadPctClamped}% ${t('tổng data')}`}</div>
                              </div>
                              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{countGiaoLead}</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Table of below-standard leads with pagination */}
                <div style={{ marginTop: '10px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={16} color="var(--color-danger)" />
                    {t('Danh sách lead dưới chuẩn')}
                  </h4>
                  <div style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: 'rgba(255, 255, 255, 0.01)'
                  }}>
                    <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>
                          <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)', position: 'sticky', top: 0, background: 'var(--color-bg)', minWidth: '200px' }}>{t('Họ tên / SĐT')}</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)', position: 'sticky', top: 0, background: 'var(--color-bg)', width: '100%', minWidth: '220px' }}>{t('Đánh giá của AI')}</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)', position: 'sticky', top: 0, background: 'var(--color-bg)', width: '110px' }}>{t('Trạng thái')}</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)', position: 'sticky', top: 0, background: 'var(--color-bg)', textAlign: 'right' }}>{t('Thời gian')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedRecentLeads.length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                {t('Không có lead nào dưới chuẩn')}
                              </td>
                            </tr>
                          ) : (
                            paginatedRecentLeads.map((l: any, idx: number) => {
                              const statusBadge = getStatusBadge(l.status);

                              return (
                                <tr key={idx} style={{ borderBottom: idx < paginatedRecentLeads.length - 1 ? '1px solid var(--color-border)' : 'none', background: 'transparent' }}>
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <Avatar name={l.name} size="sm" />
                                      <div>
                                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{l.name}</div>
                                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '1px' }}>
                                          {maskPhone(l.phone)}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 14px', maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word', color: 'var(--color-text-muted)' }}>
                                    {l.ai_evaluation || l.note || t('Không có đánh giá')}
                                  </td>
                                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                    {statusBadge}
                                  </td>
                                  <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                    {new Date(l.created_at).toLocaleString('vi-VN')}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Footer */}
                    {statsData.recent_below_standard && statsData.recent_below_standard.length > 0 && (
                      <div className="responsive-pagination" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderTop: '1px solid var(--color-border)',
                        background: 'rgba(255,255,255,0.01)',
                        fontSize: '0.8rem'
                      }}>
                        <div style={{ color: 'var(--color-text-muted)' }}>
                          {t('Hiển thị')}{' '}
                          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {(statsPage - 1) * STATS_ITEMS_PER_PAGE + 1}
                          </span>{' '}
                          -{' '}
                          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {Math.min(statsPage * STATS_ITEMS_PER_PAGE, statsData.recent_below_standard.length)}
                          </span>{' '}
                          {t('trên')}{' '}
                          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {statsData.recent_below_standard.length}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => setStatsPage(p => Math.max(p - 1, 1))}
                            disabled={statsPage === 1}
                            style={{
                              padding: '6px',
                              borderRadius: 6,
                              border: '1px solid var(--color-border)',
                              background: statsPage === 1 ? 'var(--color-bg)' : 'var(--color-surface)',
                              color: statsPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)',
                              cursor: statsPage === 1 ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <ChevronLeft size={16} />
                          </button>

                          <div style={{ display: 'flex', gap: 4 }}>
                            {(() => {
                              const totalPages = Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE);
                              const maxVisible = 5;
                              let startPage = 1;
                              if (totalPages > maxVisible) {
                                if (statsPage > 3) {
                                  startPage = statsPage - 2;
                                  if (startPage + maxVisible - 1 > totalPages) {
                                    startPage = totalPages - maxVisible + 1;
                                  }
                                }
                              }
                              const pageNumbers = Array.from(
                                { length: Math.min(maxVisible, totalPages) },
                                (_, i) => startPage + i
                              );
                              return pageNumbers.map(pageNum => (
                                <button
                                  key={pageNum}
                                  onClick={() => setStatsPage(pageNum)}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 6,
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    border: statsPage === pageNum ? 'none' : '1px solid var(--color-border)',
                                    background: statsPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                                    color: statsPage === pageNum ? 'white' : 'var(--color-text)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {pageNum}
                                </button>
                              ));
                            })()}
                          </div>

                          <button
                            onClick={() => {
                              const totalPages = Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE);
                              setStatsPage(p => Math.min(p + 1, totalPages));
                            }}
                            disabled={statsPage === Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE)}
                            style={{
                              padding: '6px',
                              borderRadius: 6,
                              border: '1px solid var(--color-border)',
                              background: statsPage === Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE) ? 'var(--color-bg)' : 'var(--color-surface)',
                              color: statsPage === Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE) ? 'var(--color-text-muted)' : 'var(--color-text)',
                              cursor: statsPage === Math.ceil(statsData.recent_below_standard.length / STATS_ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}


          </div>
        )}
      </CustomModal>

      {/* AI Token Statistics Modal */}
      <CustomModal
        isOpen={isTokenStatsModalOpen}
        onClose={() => setIsTokenStatsModalOpen(false)}
        title={`${t('Thống kê sử dụng Token AI')} - ${getDisplayDateFilterText(dateFilter)}`}
        width="950px"
      >
        {isTokenStatsModalOpen && (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header Filter Context */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-bg)',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--color-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={16} color="var(--color-primary)" />
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                  {t('Thời gian:')}
                </span>
                <span style={{
                  background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  boxShadow: '0 2px 4px rgba(189, 29, 45, 0.2)'
                }}>
                  {getDisplayDateFilterText(dateFilter)}
                </span>
              </div>
              {tokenStatsLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={12} className="spin" />
                  <span>{t('Đang tải dữ liệu...')}</span>
                </div>
              )}
            </div>

            {tokenStatsLoading && !tokenStatsData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  <KpiCardSkeleton />
                  <KpiCardSkeleton />
                  <KpiCardSkeleton />
                  <KpiCardSkeleton />
                </div>
                <TableSkeleton rows={4} cols={5} />
              </div>
            ) : !tokenStatsData ? (
              <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                {t('Không có dữ liệu thống kê Token.')}
              </div>
            ) : (
              <>
                {/* Premium Stat Cards */}
                {(() => {
                  const stats = tokenStatsData.stats || { total_leads: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
                  const promptT = stats.prompt_tokens ?? 0;
                  const compT = stats.completion_tokens ?? 0;
                  let costUsd = 0;
                  if (promptT > 0 || compT > 0) {
                    costUsd = (promptT * 0.10 + compT * 0.40) / 1000000;
                  } else {
                    costUsd = (stats.total_tokens ?? 0) * 0.0000001336;
                  }
                  const costVnd = costUsd * 25400;

                  return (
                    <div className="responsive-grid-4" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '12px'
                    }}>
                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t('Lead đã gọi AI')}</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>{stats.total_leads.toLocaleString('vi-VN')}</div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{t('Số khách hàng được AI đánh giá')}</div>
                      </div>

                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t('Prompt Tokens')}</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#3b82f6', marginTop: '4px' }}>{stats.prompt_tokens.toLocaleString('vi-VN')}</div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{t('Token đầu vào gửi tới AI')}</div>
                      </div>

                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t('Completion Tokens')}</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{stats.completion_tokens.toLocaleString('vi-VN')}</div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{t('Token phản hồi của AI')}</div>
                      </div>

                      <div style={{ background: 'rgba(189, 29, 45, 0.05)', border: '1px solid rgba(189, 29, 45, 0.2)', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>{t('Tổng Token / Chi phí')}</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>{stats.total_tokens.toLocaleString('vi-VN')}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px', background: 'rgba(189, 29, 45, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          <span>~${costUsd.toFixed(4)}</span>
                          <span>~{Math.round(costVnd).toLocaleString('vi-VN')}đ</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Token prompt vs completion breakdown progress bar */}
                {(() => {
                  const stats = tokenStatsData.stats || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 1 };
                  const total = stats.total_tokens || 1;
                  const promptPct = Math.round((stats.prompt_tokens / total) * 100);
                  const compPct = 100 - promptPct;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        <span>{t('Prompt (Đầu vào):')} {promptPct}%</span>
                        <span>{t('Completion (Đầu ra):')} {compPct}%</span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${promptPct}%`, background: '#3b82f6' }} title={`Prompt: ${promptPct}%`} />
                        <div style={{ width: `${compPct}%`, background: '#10b981' }} title={`Completion: ${compPct}%`} />
                      </div>
                    </div>
                  );
                })()}

                {/* Side-by-side Breakdowns */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '20px',
                  marginTop: '10px'
                }}>
                  {/* 1. Breakdown by Rounds */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }}></span>
                      {t('Tiêu thụ Token theo Vòng phân phối')}
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                            <th style={{ padding: '6px 4px', fontWeight: 600 }}>{t('Vòng xoay')}</th>
                            <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'center' }}>{t('Số Lead')}</th>
                            <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>{t('Tổng Token')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tokenStatsData.rounds_breakdown?.length === 0 ? (
                            <tr>
                              <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Không có dữ liệu')}</td>
                            </tr>
                          ) : (
                            tokenStatsData.rounds_breakdown?.map((item: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '8px 4px', fontWeight: 600, color: 'var(--color-text)' }}>{item.round_name}</td>
                                <td style={{ padding: '8px 4px', textAlign: 'center' }}>{item.lead_count}</td>
                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>{item.total_tokens.toLocaleString('vi-VN')}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 2. Breakdown by Connection */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }}></span>
                      {t('Tiêu thụ Token theo Trang tính (Sheet)')}
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                            <th style={{ padding: '6px 4px', fontWeight: 600 }}>{t('Nguồn / Sheet')}</th>
                            <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'center' }}>{t('Số Lead')}</th>
                            <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>{t('Tổng Token')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tokenStatsData.sources_breakdown?.length === 0 ? (
                            <tr>
                              <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Không có dữ liệu')}</td>
                            </tr>
                          ) : (
                            tokenStatsData.sources_breakdown?.map((item: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '8px 4px', fontWeight: 600, color: 'var(--color-text)' }}>{item.source_name}</td>
                                <td style={{ padding: '8px 4px', textAlign: 'center' }}>{item.lead_count}</td>
                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>{item.total_tokens.toLocaleString('vi-VN')}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Detailed lead list with token counts */}
                <div style={{ marginTop: '10px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={16} color="var(--color-primary)" />
                    {t('Chi tiết sử dụng Token trên từng Lead')}
                  </h4>
                  <div style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: 'rgba(255, 255, 255, 0.01)'
                  }}>
                    <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>
                          <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)', position: 'sticky', top: 0, background: 'var(--color-bg)', width: '100%' }}>{t('Họ tên / SĐT')}</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>{t('Kết quả AI')}</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>{t('PROMPT')}</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>{t('COMPLETION')}</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>{t('TOTAL')}</th>
                            <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right', position: 'sticky', top: 0, background: 'var(--color-bg)' }}>{t('Thời gian')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedRecentAiLeads.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                {t('Không có dữ liệu')}
                              </td>
                            </tr>
                          ) : (
                            paginatedRecentAiLeads.map((l: any, idx: number) => {
                              let statusBadge = null;
                              if (l.ai_screener_status === 'passed') {
                                statusBadge = <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, background: 'var(--color-success-light)', color: 'var(--color-success)', border: '1px solid rgba(16,185,129,0.2)' }}>PASSED</span>;
                              } else if (l.ai_screener_status === 'failed') {
                                statusBadge = <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)' }}>FAILED</span>;
                              } else {
                                statusBadge = <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600, background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.2)' }}>{l.ai_screener_status?.toUpperCase() || 'ERROR'}</span>;
                              }

                              return (
                                <tr key={idx} style={{ borderBottom: idx < paginatedRecentAiLeads.length - 1 ? '1px solid var(--color-border)' : 'none', background: 'transparent' }}>
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <Avatar name={l.name} size={32} />
                                      <div>
                                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{l.name}</div>
                                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', marginTop: '1px' }}>
                                          {maskPhone(l.phone)}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                    {statusBadge}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--color-text)', fontWeight: 500 }}>
                                    {Number(l.ai_prompt_tokens).toLocaleString('vi-VN')}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--color-text)', fontWeight: 500 }}>
                                    {Number(l.ai_completion_tokens).toLocaleString('vi-VN')}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text)' }}>
                                    {Number(l.ai_total_tokens).toLocaleString('vi-VN')}
                                  </td>
                                  <td style={{ padding: '10px 14px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                    {new Date(l.created_at).toLocaleString('vi-VN')}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Footer */}
                    {tokenStatsData && tokenStatsData.total_recent_leads > 20 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderTop: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        fontSize: '0.8rem'
                      }}>
                        <div style={{ color: 'var(--color-text-muted)' }}>
                          {t('Hiển thị')}{' '}
                          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {(tokenStatsPage - 1) * 20 + 1}
                          </span>{' '}
                          -{' '}
                          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {Math.min(tokenStatsPage * 20, tokenStatsData.total_recent_leads)}
                          </span>{' '}
                          {t('trên')}{' '}
                          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {tokenStatsData.total_recent_leads}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => {
                              const newPage = Math.max(tokenStatsPage - 1, 1);
                              setTokenStatsPage(newPage);
                              fetchTokenStats(newPage);
                            }}
                            disabled={tokenStatsPage === 1}
                            style={{
                              padding: '6px',
                              borderRadius: 6,
                              border: '1px solid var(--color-border)',
                              background: tokenStatsPage === 1 ? 'var(--color-bg)' : 'var(--color-surface)',
                              color: tokenStatsPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text)',
                              cursor: tokenStatsPage === 1 ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <ChevronLeft size={16} />
                          </button>

                          <div style={{ display: 'flex', gap: 4 }}>
                            {(() => {
                              const totalPages = Math.ceil(tokenStatsData.total_recent_leads / 20);
                              const maxVisible = 5;
                              let startPage = 1;
                              if (totalPages > maxVisible) {
                                if (tokenStatsPage > 3) {
                                  startPage = tokenStatsPage - 2;
                                  if (startPage + maxVisible - 1 > totalPages) {
                                    startPage = totalPages - maxVisible + 1;
                                  }
                                }
                              }
                              const pageNumbers = Array.from(
                                { length: Math.min(maxVisible, totalPages) },
                                (_, i) => startPage + i
                              );
                              return pageNumbers.map(pageNum => (
                                <button
                                  key={pageNum}
                                  onClick={() => {
                                    setTokenStatsPage(pageNum);
                                    fetchTokenStats(pageNum);
                                  }}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 6,
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    border: tokenStatsPage === pageNum ? 'none' : '1px solid var(--color-border)',
                                    background: tokenStatsPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                                    color: tokenStatsPage === pageNum ? 'white' : 'var(--color-text)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {pageNum}
                                </button>
                              ));
                            })()}
                          </div>

                          <button
                            onClick={() => {
                              const totalPages = Math.ceil(tokenStatsData.total_recent_leads / 20);
                              const newPage = Math.min(tokenStatsPage + 1, totalPages);
                              setTokenStatsPage(newPage);
                              fetchTokenStats(newPage);
                            }}
                            disabled={tokenStatsPage === Math.ceil(tokenStatsData.total_recent_leads / 20)}
                            style={{
                              padding: '6px',
                              borderRadius: 6,
                              border: '1px solid var(--color-border)',
                              background: tokenStatsPage === Math.ceil(tokenStatsData.total_recent_leads / 20) ? 'var(--color-bg)' : 'var(--color-surface)',
                              color: tokenStatsPage === Math.ceil(tokenStatsData.total_recent_leads / 20) ? 'var(--color-text-muted)' : 'var(--color-text)',
                              cursor: tokenStatsPage === Math.ceil(tokenStatsData.total_recent_leads / 20) ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CustomModal>

      {/* Approve Held Lead Modal */}
      <CustomModal
        isOpen={heldActionModalOpen === 'approve'}
        onClose={() => setHeldActionModalOpen(null)}
        title={t("Phê duyệt & Phân bổ Lead")}
        width="450px"
      >
        {heldActionModalOpen === 'approve' && (
          <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {t("Hệ thống sẽ thực hiện phân bổ lead này cho Sale tiếp theo trong vòng phân phối tương ứng. Thông tin người tiếp nhận:")}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                {t('Vòng phân phối:')}
              </label>
              <CustomSelect
                options={rounds.map((r: any) => ({
                  value: String(r.id),
                  label: r.round_name,
                  disabled: Number(r.is_active) !== 1,
                  disabledType: 'round' as const
                }))}
                value={selectedApproveRoundId ? String(selectedApproveRoundId) : ''}
                onChange={val => {
                  if (val) {
                    handleApproveRoundChange(Number(val));
                  }
                }}
                width="100%"
              />
            </div>

            <div style={{
              padding: '1.25rem',
              background: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.06), rgba(16, 185, 129, 0.02))',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              {previewLoadingId !== null ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>{t("Đang tính toán Sale tiếp theo...")}</span>
                </div>
              ) : previewedConsultant ? (
                <>
                  <Avatar src={previewedConsultant.avatar} name={previewedConsultant.name} size={40} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.95rem' }}>
                      {previewedConsultant.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {t("Nhận từ vòng:")} <strong>{rounds.find(r => Number(r.id) === selectedApproveRoundId)?.round_name || actioningHeldLead?.round_name}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem', fontWeight: 600 }}>
                  {t("Không tìm thấy Sale hợp lệ trong vòng để nhận lead này.")}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                {t("Lý do phê duyệt (Tùy chọn)")}
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={heldActionReason}
                onChange={e => setHeldActionReason(e.target.value)}
                placeholder={t("Ví dụ: Khách hàng tiềm năng, đã liên hệ trực tiếp...")}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn outline" onClick={() => setHeldActionModalOpen(null)}>
                {t("Hủy bỏ")}
              </button>
              <button
                className="btn primary"
                onClick={handleApproveHeldLeadSubmit}
                disabled={previewLoadingId !== null || actionLoading}
                style={{ background: '#10b981', borderColor: '#10b981' }}
              >
                {actionLoading ? t("Đang duyệt...") : t("Xác nhận duyệt")}
              </button>
            </div>
          </div>
        )}
      </CustomModal>

      {/* Reject Held Lead Modal */}
      <CustomModal
        isOpen={heldActionModalOpen === 'reject'}
        onClose={() => setHeldActionModalOpen(null)}
        title={t("Xác nhận dưới chuẩn")}
        width="450px"
      >
        {heldActionModalOpen === 'reject' && (
          <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {t("Vui lòng nhập lý do xác nhận dưới chuẩn cho lead này. Liên hệ sẽ bị đánh dấu là Không duyệt và không phân bổ.")}
            </p>

            <div>
              <label className="form-label">{t("Lý do từ chối")}</label>
              <textarea
                className="form-input"
                rows={3}
                value={heldActionReason}
                onChange={e => setHeldActionReason(e.target.value)}
                placeholder={t("Ví dụ: Khách hàng không có nhu cầu thật, sai số...")}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn outline" onClick={() => setHeldActionModalOpen(null)}>
                {t("Hủy bỏ")}
              </button>
              <button
                className="btn primary"
                onClick={handleRejectHeldLeadSubmit}
                disabled={!heldActionReason.trim() || actionLoading}
                style={{ background: 'var(--color-warning)', borderColor: 'var(--color-warning)' }}
              >
                {actionLoading ? t("Đang xử lý...") : t("Xác nhận dưới chuẩn")}
              </button>
            </div>
          </div>
        )}
      </CustomModal>

      {/* Blacklist Held Lead Modal */}
      <CustomModal
        isOpen={heldActionModalOpen === 'blacklist'}
        onClose={() => setHeldActionModalOpen(null)}
        title={t("Chặn & Đưa vào Blacklist")}
        width="450px"
      >
        {heldActionModalOpen === 'blacklist' && (
          <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {t("Xác nhận chặn số điện thoại này. Số điện thoại sẽ bị lưu vào danh sách đen (Global Exclusion Contacts) để tự động từ chối trong tương lai.")}
            </p>

            <div>
              <label className="form-label">{t("Lý do chặn blacklist")}</label>
              <textarea
                className="form-input"
                rows={3}
                value={heldActionReason}
                onChange={e => setHeldActionReason(e.target.value)}
                placeholder={t("Ví dụ: Số ảo phá hoại, spam, đối thủ cạnh tranh...")}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn outline" onClick={() => setHeldActionModalOpen(null)}>
                {t("Hủy bỏ")}
              </button>
              <button
                className="btn primary"
                onClick={handleBlacklistHeldLeadSubmit}
                disabled={!heldActionReason.trim() || actionLoading}
                style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              >
                {actionLoading ? t("Đang chặn...") : t("Xác nhận chặn")}
              </button>
            </div>
          </div>
        )}
      </CustomModal>

      {/* Customer Detail Drawer/Modal */}
      <CustomModal
        isOpen={selectedLead !== null}
        onClose={() => {
          setSelectedLead(null);
        }}
        title={t("Chi tiết Khách hàng")}
        width="850px"
      >
        {selectedLead && (
          <div className="modal-body-padding">
            <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem', alignItems: 'start' }}>

              {/* Cột Trái: Chi Tiết */}
              <div className="sticky-column">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Avatar name={selectedLead.name} size={48} aiScreened={!!(selectedLead.ai_screener_status && selectedLead.ai_screener_status !== 'not_screened')} />
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
                            boxShadow: '0 0 0 3px rgba(163, 20, 34, 0.08)'
                          }}
                          onFocus={e => {
                            e.currentTarget.style.borderColor = 'var(--color-primary)';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(163, 20, 34, 0.15)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(163, 20, 34, 0.08)';
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
                    {isUserAdmin && (
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
                              background: 'rgba(163, 20, 34, 0.08)',
                              border: '1px solid var(--color-primary-light)',
                              color: 'var(--color-primary)',
                              boxShadow: '0 2px 6px rgba(163, 20, 34, 0.05)'
                            }}
                            onMouseOver={e => {
                              e.currentTarget.style.background = 'var(--color-primary)';
                              e.currentTarget.style.color = '#ffffff';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 6px 15px rgba(163, 20, 34, 0.2)';
                            }}
                            onMouseOut={e => {
                              e.currentTarget.style.background = 'rgba(163, 20, 34, 0.08)';
                              e.currentTarget.style.color = 'var(--color-primary)';
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(163, 20, 34, 0.05)';
                            }}
                          >
                            <Edit size={14} />
                            {t('Sửa')}
                          </button>
                        )}
                      </>
                    )}
 
                    {isUserAdmin && selectedLead.status !== 'blacklisted' && !isAdminEditingLead && (
                      <button
                        onClick={() => {
                          setSelectedLead(null);
                          setActioningHeldLead(selectedLead);
                          setHeldActionReason('');
                          setHeldActionModalOpen('blacklist');
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
                    onClick={!isAdminEditingLead ? () => handleCopyText(isUserAdmin ? selectedLead.phone : maskPhone(selectedLead.phone), t('Đã sao chép số điện thoại!'), 'phone') : undefined}
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
                        e.currentTarget.style.background = 'rgba(163, 20, 34, 0.02)';
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
                          border: '1px solid rgba(163, 20, 34, 0.15)',
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
                          e.currentTarget.style.boxShadow = '0 0 0 4px rgba(163, 20, 34, 0.12)';
                        }}
                        onBlur={e => {
                          e.currentTarget.style.borderColor = 'rgba(163, 20, 34, 0.15)';
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }} title={selectedLead.phone}>
                          {isUserAdmin ? selectedLead.phone : maskPhone(selectedLead.phone)}
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
                    onClick={!isAdminEditingLead ? () => handleCopyText(isUserAdmin ? selectedLead.email : maskEmail(selectedLead.email), t('Đã sao chép email!'), 'email') : undefined}
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
                        e.currentTarget.style.background = 'rgba(163, 20, 34, 0.02)';
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
                          border: '1px solid rgba(163, 20, 34, 0.15)',
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
                          e.currentTarget.style.boxShadow = '0 0 0 4px rgba(163, 20, 34, 0.12)';
                        }}
                        onBlur={e => {
                          e.currentTarget.style.borderColor = 'rgba(163, 20, 34, 0.15)';
                          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }} title={selectedLead.email}>
                          {isUserAdmin ? selectedLead.email : maskEmail(selectedLead.email)}
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
                          border: '1px solid rgba(163, 20, 34, 0.15)',
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
                          e.currentTarget.style.boxShadow = '0 0 0 4px rgba(163, 20, 34, 0.12)';
                        }}
                        onBlur={e => {
                          e.currentTarget.style.borderColor = 'rgba(163, 20, 34, 0.15)';
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
                      {getStatusBadge(selectedLead.status, selectedLead.report_status)}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenDupCheckFromDetail(selectedLead.phone, selectedLead.email)}
                    className="btn outline"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      justifyContent: 'center',
                      height: '38px',
                      borderRadius: '10px',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                      border: '1px solid var(--color-primary-light)',
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = 'var(--color-primary-light)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Search size={14} />
                    <span>{t("Kiểm tra trùng lặp hệ thống")}</span>
                  </button>
                </div>

                {(() => {
                  const { cleanNote, warningNotes } = parseNote(selectedLead.note || '');
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
                                  border: '1px solid rgba(163, 20, 34, 0.15)',
                                  borderRadius: '10px',
                                  padding: '8px 12px',
                                  flex: 1,
                                  outline: 'none',
                                  transition: 'all 0.2s ease-in-out',
                                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                                }}
                                onFocus={e => {
                                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(163, 20, 34, 0.12)';
                                }}
                                onBlur={e => {
                                  e.currentTarget.style.borderColor = 'rgba(163, 20, 34, 0.15)';
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
                    </>
                  );
                })()}
              </div>

              {/* Cột Phải: Thao tác Duyệt nhanh hoặc Thông tin Phân bổ */}
              <div className="sticky-column gatekeeper-detail-right">
                {activeTab === 'ai_pending' ? (
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1.5px dashed var(--color-primary)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
                    <RefreshCw className="spin" size={32} style={{ color: 'var(--color-primary)' }} />
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.25rem' }}>{t('Đang chờ AI đánh giá')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                        {t('Hệ thống đang gọi API AI Pre-screener để phân tích thông tin của khách hàng.')}
                      </div>
                    </div>
                    <div style={{ width: '100%', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{t('Thời gian chờ tối đa:')} 5 {t('phút')}</div>
                      <div>{t('Nếu quá 5 phút AI chưa có kết quả, lead này sẽ tự động chuyển sang Hàng chờ duyệt và hiển thị thông báo lỗi.')}</div>
                    </div>
                  </div>
                ) : activeTab === 'queue' ? (
                  <>
                    {/* AI Screener Evaluation Details */}
                    {selectedLead.ai_screener_status && selectedLead.ai_screener_status !== 'not_screened' && (
                      <div style={{
                        marginBottom: '1.25rem',
                        padding: '1.25rem',
                        background: (selectedLead.ai_screener_status === 'error' || selectedLead.ai_screener_status === 'pending')
                          ? 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0.02))'
                          : 'linear-gradient(to bottom right, rgba(239, 68, 68, 0.06), rgba(239, 68, 68, 0.02))',
                        border: (selectedLead.ai_screener_status === 'error' || selectedLead.ai_screener_status === 'pending')
                          ? '1px solid rgba(245, 158, 11, 0.15)'
                          : '1px solid rgba(239, 68, 68, 0.15)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar src="/imgs/warn_icon.png" name="Rich Land AI - Screener" size={36} />
                          <div>
                            <div style={{ fontSize: '0.72rem', color: (selectedLead.ai_screener_status === 'error' || selectedLead.ai_screener_status === 'pending') ? '#d97706' : 'var(--color-danger)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {(selectedLead.ai_screener_status === 'error' || selectedLead.ai_screener_status === 'pending') ? t('Lỗi AI Pre-screener') : t('Tạm giữ')}
                            </div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                              {t('Rich Land AI - Screener')}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
                          <strong>{selectedLead.ai_screener_status === 'pending' ? t('Lỗi Timeout:') : selectedLead.ai_screener_status === 'error' ? t('Chi tiết lỗi:') : t('Kết quả đánh giá AI:')}</strong> {selectedLead.ai_screener_status === 'pending' ? t('Quá thời gian 5 phút AI chưa có kết quả đánh giá. Vui lòng duyệt thủ công.') : selectedLead.ai_evaluation || (selectedLead.ai_screener_status === 'error' ? t('Mất kết nối với dịch vụ AI.') : t('Không đạt chuẩn phân chia.'))}
                        </div>
                      </div>
                    )}

                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '1.25rem' }}>{t("Xử lý phê duyệt")}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <button
                        onClick={() => {
                          setSelectedLead(null);
                          handleOpenApproveHeldLead(selectedLead);
                        }}
                        className="btn primary"
                        style={{ width: '100%', height: 46, background: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700 }}
                      >
                        <Check size={18} />
                        {t("Duyệt & Phân bổ Lead")}
                      </button>

                      <button
                        onClick={() => {
                          setSelectedLead(null);
                          setActioningHeldLead(selectedLead);
                          setHeldActionReason('');
                          setHeldActionModalOpen('reject');
                        }}
                        className="btn primary"
                        style={{ width: '100%', height: 46, background: 'var(--color-warning)', borderColor: 'var(--color-warning)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700 }}
                      >
                        <XCircle size={18} />
                        {t("Xác nhận dưới chuẩn")}
                      </button>

                      <div style={{
                        marginTop: '1rem', padding: '1rem',
                        background: 'var(--color-bg-alt)', borderRadius: '12px', border: '1px solid var(--color-border)',
                        fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5
                      }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={14} color="#a31422" />
                          {t("Thông tin thêm")}
                        </div>
                        <div>
                          {t("Khách hàng này được đổ về từ nguồn")} <strong>{selectedLead.source}</strong> {t("vào lúc")} {new Date(selectedLead.created_at).toLocaleString('vi-VN')}. {t("Lead này đã kích hoạt đánh giá tự động và đang được giữ lại để chờ Admin phê duyệt trước khi đi vào hàng chờ phân chia số.")}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                      {t('Thông tin Phân bổ')}
                    </h3>

                    {selectedLead.status === 'rejected' ? (
                      <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1.5px solid var(--color-primary)', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                          <Avatar src="/LOGO.jpg" name="Rich Land AI - Evaluator" size={36} />
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Đánh giá')}</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>Rich Land AI - Evaluator</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Đánh giá')}</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                              {selectedLead.ai_evaluation || t('Không đáp ứng yêu cầu bộ lọc.')}
                            </div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Trạng thái phân bổ')}</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('Dưới chuẩn (Đã hủy)')}</div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
                              <Clock size={12} /> {t('Thời gian nhận')}
                            </div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                              {new Date(selectedLead.created_at).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : selectedLead.status === 'blacklisted' ? (
                      <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1.5px solid var(--color-primary)', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                          <Avatar src="/imgs/angry_icon.jpg" name="Rich Land AI - Angry" size={36} />
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Đánh giá')}</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>Rich Land AI - Angry</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Đánh giá')}</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                              {selectedLead.ai_evaluation || t('Đã chặn số và đưa vào Blacklist.')}
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
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                              {new Date(selectedLead.created_at).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : selectedLead.assigned_to_name && selectedLead.assigned_to_name !== '-' ? (
                      <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                          <Avatar src={selectedLead.assigned_to_avatar} name={selectedLead.assigned_to_name} size={40} aiScreened={!!(selectedLead.ai_screener_status && selectedLead.ai_screener_status !== 'not_screened')} />
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Người tiếp nhận')}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {(() => {
                                const cObj = consultants.find(c => c.name === selectedLead.assigned_to_name);
                                if (cObj) {
                                  return (
                                    <div
                                      style={{
                                        fontSize: '0.95rem',
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
                                return <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>{selectedLead.assigned_to_name}</div>;
                              })()}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Vòng chia')}</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{selectedLead.round_name || '-'}</div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Trạng thái phân bổ')}</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-success)' }}>{t('Đã giao và phân bổ')}</div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
                              <Clock size={12} /> {t('Thời gian nhận')}
                            </div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                              {new Date(selectedLead.created_at).toLocaleString('vi-VN')}
                            </div>
                          </div>
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
                        </div>

                        {/* Manual Reminder Button */}
                        {isUserAdmin && selectedLead.assigned_to_name !== '-' && (
                          <button
                            onClick={() => {
                              setReminderChannels({ zalo: true, email: true });
                              setIsReminderModalOpen(true);
                            }}
                            style={{
                              marginTop: '0.75rem',
                              width: '100%',
                              background: 'rgba(163, 20, 34, 0.08)',
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
                              e.currentTarget.style.boxShadow = '0 4px 10px rgba(163, 20, 34, 0.15)';
                            }}
                            onMouseOut={e => {
                              e.currentTarget.style.background = 'rgba(163, 20, 34, 0.08)';
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
                    ) : (
                      <div style={{ background: 'var(--color-bg)', padding: '1.5rem', borderRadius: 12, textAlign: 'center', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                        {t('Chưa có thông tin phân bổ cho Khách hàng này.')}
                      </div>
                    )}
                  </>
                )}

                {/* AI Decision Notes */}
                {(() => {
                  const { aiDecisionNotes } = parseNote(selectedLead.note || '');
                  if (!aiDecisionNotes || aiDecisionNotes.length === 0) return null;
                  return (
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
                          IconComponent = CheckCircle;
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
                                <Avatar src={adminAvatars[parsed.admin]} name={parsed.admin} size={16} />
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
                  );
                })()}

                {/* Blacklist Notes */}
                {(() => {
                  const { blacklistNotes } = parseNote(selectedLead.note || '');
                  if (!blacklistNotes || blacklistNotes.length === 0) return null;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                      {blacklistNotes.map((note, index) => {
                        const parsed = parseBlacklistNote(note);
                        return (
                          <div key={index} style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            padding: '1.25rem',
                            borderRadius: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}>
                                <ShieldAlert size={18} />
                              </div>
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-danger)' }}>{t("Lịch sử chặn Blacklist")}</span>
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                              <strong>{t("Lý do chặn:")}</strong> {parsed.reason || t("Không rõ")}
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
                                <Avatar src={adminAvatars[parsed.admin]} name={parsed.admin} size={16} />
                                <span>{t("Thực hiện bởi: ")}<strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{parsed.admin}</strong></span>
                              </div>
                              <span style={{ color: theme === 'dark' ? 'var(--color-border)' : '#cbd5e1', fontSize: '0.75rem' }}>•</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: theme === 'dark' ? 'var(--color-text-muted)' : '#64748b' }}>
                                <Clock size={13} style={{ opacity: 0.7 }} />
                                <span>{t("Thời gian: ")}<strong style={{ color: theme === 'dark' ? 'var(--color-text)' : '#334155' }}>{parsed.time}</strong></span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

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
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #8a0f1b 100%)',
                  boxShadow: '0 4px 12px rgba(163, 20, 34, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.25s'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(163, 20, 34, 0.35)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(163, 20, 34, 0.2)';
                }}
              >
                {isSendingReminder ? (
                  <RefreshCw size={14} className="spin" />
                ) : (
                  <Bell size={14} />
                )}
                <span>{isSendingReminder ? t('Đang gửi...') : t('Xác nhận nhắc')}</span>
              </button>
            </div>
          </div>
        )}
      </CustomModal>

      {/* Check Lead Duplicate Modal */}
      <CustomModal
        isOpen={showDupCheckModal}
        onClose={() => {
          setShowDupCheckModal(false);
          setDupCheckInput('');
          setDupCheckResult(null);
        }}
        title={t("Kiểm tra trùng Lead")}
        width="950px"
      >
        {showDupCheckModal && (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              {t("Nhập số điện thoại hoặc email để kiểm tra thông tin trùng lặp của khách hàng trong hệ thống.")}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-light)' }}>
                  {t("Số điện thoại hoặc Email")}
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={dupCheckInput}
                  onChange={e => setDupCheckInput(e.target.value)}
                  placeholder={t("Ví dụ: 0945473306 hoặc test@gmail.com...")}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleRunDupCheck();
                    }
                  }}
                  style={{ width: '100%', height: '40px', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={() => handleRunDupCheck()}
                disabled={dupCheckLoading}
                className="btn primary"
                style={{ height: '40px', padding: '0 1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {dupCheckLoading ? (
                  <RefreshCw size={14} className="spin" />
                ) : (
                  <Search size={14} />
                )}
                <span>{t("Kiểm tra")}</span>
              </button>
            </div>

            {dupCheckResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Conclusion Banner */}
                {(() => {
                  const dupCheckMonths = dupCheckResult.duplicate_check_months || 6;
                  const history = (dupCheckResult.history || []).filter((h: any) => !selectedLead || Number(h.id) !== Number(selectedLead.id));

                  if (history.length === 0) {
                    return (
                      <div style={{
                        padding: '1rem 1.25rem',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1.5px solid var(--color-success)',
                        borderRadius: '12px',
                        color: 'var(--color-success)',
                        fontSize: '0.875rem',
                        lineHeight: 1.5
                      }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <CheckCircle2 size={16} />
                          {t("Không tìm thấy dữ liệu trùng")}
                        </div>
                        <div>
                          {t("Số điện thoại/Email này hoàn toàn mới trong hệ thống. Có thể tiếp nhận phân bổ bình thường.")}
                        </div>
                      </div>
                    );
                  }

                  // Calculate age of the latest matched lead
                  const latest = history[0];
                  const lastDateStr = latest.last_interaction_date || latest.created_at;
                  const lastInt = new Date(lastDateStr.replace(/-/g, '/'));
                  const now = new Date();
                  const diffMs = now.getTime() - lastInt.getTime();
                  const diffMins = diffMs / 60000;
                  const diffHours = diffMins / 60;
                  const diffDays = diffHours / 24;
                  const diffMonths = diffDays / 30;

                  const isDupUnderN = diffMonths < dupCheckMonths;

                  if (isDupUnderN) {
                    return (
                      <div style={{
                        padding: '1rem 1.25rem',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1.5px dashed var(--color-danger)',
                        borderRadius: '12px',
                        color: 'var(--color-danger)',
                        fontSize: '0.875rem',
                        lineHeight: 1.5
                      }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <AlertTriangle size={16} />
                          {t("Trùng lặp dưới")} {dupCheckMonths} {t("tháng")}
                        </div>
                        <div>
                          {t("Lần tương tác gần nhất cách đây")}{' '}
                          <strong>{Math.floor(diffMonths)} {t("tháng")} ({Math.floor(diffDays)} {t("ngày")})</strong>{' '}
                          {t("lúc")}{' '}
                          <code>{lastDateStr}</code>.
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div style={{
                        padding: '1rem 1.25rem',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1.5px solid var(--color-success)',
                        borderRadius: '12px',
                        color: 'var(--color-success)',
                        fontSize: '0.875rem',
                        lineHeight: 1.5
                      }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <CheckCircle2 size={16} />
                          {t("Đủ điều kiện phân bổ mới")} ({t("Trùng")} &gt; {dupCheckMonths} {t("tháng")})
                        </div>
                        <div>
                          {t("Lần tương tác gần nhất cách đây")}{' '}
                          <strong>{Math.floor(diffMonths)} {t("tháng")} ({Math.floor(diffDays)} {t("ngày")})</strong>{' '}
                          {t("lúc")}{' '}
                          <code>{lastDateStr}</code>.<br />
                          {t("Khoảng cách vượt quá hạn quy định")}{' '}
                          <strong>{dupCheckMonths} {t("tháng")}</strong>. {t("Hệ thống sẽ phân bổ mới bình thường.")}
                        </div>
                      </div>
                    );
                  }
                })()}

                {/* History list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {t("Lịch sử lưu vết")} ({(() => {
                      const history = (dupCheckResult.history || []).filter((h: any) => !selectedLead || Number(h.id) !== Number(selectedLead.id));
                      return history.length;
                    })()})
                  </h4>
                  <div style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px'
                  }} className="custom-scrollbar">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-border-light)', borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{t("ID / Họ tên")}</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{t("Nguồn / Vòng")}</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{t("Trạng thái")}</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{t("Sale")}</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{t("Thời gian")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const history = (dupCheckResult.history || []).filter((h: any) => !selectedLead || Number(h.id) !== Number(selectedLead.id));
                          return history && history.length > 0 ? (
                            history.map((h: any) => {
                              const lastDateStr = h.last_interaction_date || h.created_at;
                              const lastInt = new Date(lastDateStr.replace(/-/g, '/'));
                              const now = new Date();
                              const diffMs = now.getTime() - lastInt.getTime();
                              const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));

                              let statusClass = 'muted';
                              let statusText = h.status;
                              if (h.status === 'active') { statusClass = 'success'; statusText = t('Hoạt động'); }
                              else if (h.status === 'pending_approval') { statusClass = 'warning'; statusText = t('Tạm giữ'); }
                              else if (h.status === 'rejected') { statusClass = 'danger'; statusText = t('Dưới chuẩn'); }
                              else if (h.status === 'blacklisted') { statusClass = 'danger'; statusText = t('Blacklist'); }

                              return (
                                <tr key={h.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                  <td style={{ padding: '10px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <Avatar name={h.name} size={32} />
                                      <div>
                                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>{h.name}</span>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>#{h.id}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.85rem' }}>{h.source}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{h.round_name || '-'}</div>
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <span className={`badge ${statusClass}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{statusText}</span>
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    {h.consultant_name ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Avatar src={h.consultant_avatar} name={h.consultant_name} size={28} />
                                        <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.85rem' }}>{h.consultant_name}</span>
                                      </div>
                                    ) : (
                                      <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                    <div>{h.created_at}</div>
                                    <div style={{ color: 'var(--color-primary)', fontWeight: 700, marginTop: '2px' }}>
                                      {diffMonths} {t("tháng trước")}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                {t("Không có dữ liệu lịch sử.")}
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CustomModal>

      {selectedLead && (
        <NotificationPreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          type={previewType}
          leadName={selectedLead.name}
          leadPhone={isUserAdmin ? selectedLead.phone : maskPhone(selectedLead.phone)}
          leadEmail={isUserAdmin ? selectedLead.email : maskEmail(selectedLead.email)}
          leadSource={selectedLead.source || ''}
          leadType={selectedLead.type || ''}
          leadNote={selectedLead.note || ''}
          assignedToName={selectedLead.assigned_to_name || ''}
          sentAt={previewSentAt}
          isReminder={selectedLead.status === 'reminder'}
          leadId={selectedLead.lead_id || selectedLead.id}
          assignedToId={consultants.find(c => c.name === selectedLead.assigned_to_name)?.id}
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
                    <strong>{statsConsultant.name}</strong> • ID: {statsConsultant.id} • {statsConsultant.email}
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
              {statsConsultantLoading && !statsConsultantData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                  </div>
                  <ChartSkeleton height={180} />
                </div>
              ) : !statsConsultantData ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                  {t('Không có dữ liệu thống kê.')}
                </div>
              ) : (
                <>
                  {/* Subtle Loading overlay if reloading in background */}
                  {statsConsultantLoading && (
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
                        {t('Tổng data hệ thống tiếp nhận cho TVV này:')} <strong style={{ fontSize: '1.05rem', color: 'var(--color-text)' }}>{statsConsultantData.summary.total}</strong> lead
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        * {t('Các nhóm độc lập hoàn toàn, không cộng dồn/chồng chéo')}
                      </span>
                    </div>

                    {/* Stacked Percentage Bar */}
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--color-border-light)', position: 'relative' }}>
                      {statsConsultantData.summary.successful > 0 && (
                        <div
                          style={{
                            width: `${(statsConsultantData.summary.successful / Math.max(1, statsConsultantData.summary.total)) * 100}%`,
                            background: 'linear-gradient(90deg, #a78bfa, #a31422)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Thành công')}: ${statsConsultantData.summary.successful}`}
                        />
                      )}
                      {(statsConsultantData.summary.reminder || 0) > 0 && (
                        <div
                          style={{
                            width: `${((statsConsultantData.summary.reminder || 0) / Math.max(1, statsConsultantData.summary.total)) * 100}%`,
                            background: 'linear-gradient(90deg, #fcd34d, #f59e0b)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Nhắc lại')}: ${statsConsultantData.summary.reminder}`}
                        />
                      )}
                      {(statsConsultantData.summary.error || 0) > 0 && (
                        <div
                          style={{
                            width: `${((statsConsultantData.summary.error || 0) / Math.max(1, statsConsultantData.summary.total)) * 100}%`,
                            background: 'linear-gradient(90deg, #fca5a5, #ef4444)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Lỗi')}: ${statsConsultantData.summary.error}`}
                        />
                      )}
                    </div>

                    {/* Legend explaining the numbers */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Thành công (Bàn giao thực tế)')}: <strong style={{ color: 'var(--color-primary)' }}>{statsConsultantData.summary.successful}</strong> ({statsConsultantData.summary.total > 0 ? Math.round((statsConsultantData.summary.successful / statsConsultantData.summary.total) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Nhắc lại (Khách cũ gọi lại)')}: <strong style={{ color: 'var(--color-warning)' }}>{statsConsultantData.summary.reminder || 0}</strong> ({statsConsultantData.summary.total > 0 ? Math.round(((statsConsultantData.summary.reminder || 0) / statsConsultantData.summary.total) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-danger)' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Lỗi / Trùng (Đã lọc bỏ)')}: <strong style={{ color: 'var(--color-danger)' }}>{statsConsultantData.summary.error || 0}</strong> ({statsConsultantData.summary.total > 0 ? Math.round(((statsConsultantData.summary.error || 0) / statsConsultantData.summary.total) * 100) : 0}%)
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
                          {statsConsultantData.summary.successful}
                        </div>
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
                          {statsConsultantData.summary.reminder || 0}
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
                          {statsConsultantData.summary.error || 0}
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
                          {statsConsultantData.summary.system_total_successful > 0
                            ? Math.round((statsConsultantData.summary.successful / statsConsultantData.summary.system_total_successful) * 100)
                            : 0}%
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>{t('Thành công / Tổng của tất cả saleperson')}</div>
                      </div>
                    </div>
                  </div>

                  {/* Row 1: Daily trend bar chart (Full Width) */}
                  <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', width: '100%' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Lưu lượng nhận Data theo Ngày')}</h4>
                    {statsConsultantData.by_date && statsConsultantData.by_date.length > 0 ? (
                      <div style={{ height: 180, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={statsConsultantData.by_date} margin={{ left: -10, right: 5, top: 20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="statsDateGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#e63946" stopOpacity={1} />
                                <stop offset="100%" stopColor="#a31422" stopOpacity={0.8} />
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
                          { name: t('Thành công'), value: statsConsultantData.summary.successful, color: '#a31422' },
                          { name: t('Nhắc lại'), value: statsConsultantData.summary.reminder, color: '#f59e0b' },
                          { name: t('Lỗi'), value: statsConsultantData.summary.error, color: '#ef4444' }
                        ].filter(item => item.value > 0);

                        return statsConsultantData.summary.total > 0 && statusChartData.length > 0 ? (
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
                                    {item.name}: <strong style={{ fontSize: '0.8125rem' }}>{item.value}</strong> ({Math.round(item.value / statsConsultantData.summary.total * 100)}%)
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
                      {statsConsultantData.rounds.length > 0 ? (
                        <div style={{ height: 160, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={statsConsultantData.rounds} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-light)" />
                              <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis dataKey="round_name" type="category" width={90} tick={{ fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                              <Bar dataKey="successful_count" stackId="a" fill="#a31422" radius={[0, 0, 0, 0]} barSize={12} name={t("Thành công")} />
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
                      {statsConsultantData.by_source && statsConsultantData.by_source.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto', paddingRight: 4 }}>
                          {statsConsultantData.by_source.map((src: any, idx: number) => {
                            const sourcePercent = statsConsultantData.summary.successful > 0
                              ? Math.round((src.count / statsConsultantData.summary.successful) * 100)
                              : 0;
                            return (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{src.source}</span>
                                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{src.count} {t('data')} ({sourcePercent}%)</span>
                                </div>
                                <div style={{ width: '100%', height: 4, background: 'var(--color-border-light)', borderRadius: 2 }}>
                                  <div style={{ width: `${sourcePercent}%`, height: '100%', background: '#BD1D2D', borderRadius: 2 }} />
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
                      {statsConsultantData.tickets ? (
                        <>
                          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                            <div style={{ background: 'var(--color-bg)', padding: '6px', borderRadius: 8, border: '1px solid var(--color-border-light)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>{t('GỬI ĐI')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{statsConsultantData.tickets.total}</div>
                            </div>
                            <div style={{ background: 'var(--color-success-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-success)', fontWeight: 700 }}>{t('ĐÃ BÙ')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-success)', marginTop: 2 }}>{statsConsultantData.tickets.approved}</div>
                            </div>
                            <div style={{ background: 'var(--color-warning-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-warning)', fontWeight: 700 }}>{t('ĐANG CHỜ')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: 2 }}>{statsConsultantData.tickets.pending}</div>
                            </div>
                            <div style={{ background: 'var(--color-danger-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-danger)', fontWeight: 700 }}>{t('TỪ CHỐI')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: 2 }}>{statsConsultantData.tickets.rejected}</div>
                            </div>
                          </div>
                          <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', fontWeight: 500 }}>
                            {t('Tổng nhận bù:')} <strong style={{ color: 'var(--color-success)' }}>{statsConsultantData.tickets.approved + (statsConsultantData.active_compensation || 0) + (statsConsultantData.blacklist_compensation || 0)}</strong> {t('data')} (Ticket: {statsConsultantData.tickets.approved}, Blacklist: {statsConsultantData.blacklist_compensation || 0}, {t('Chủ động')}: {statsConsultantData.active_compensation || 0})
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

      <style>{`
        .consultant-hover-trigger:hover {
          color: var(--color-primary) !important;
        }
        .consultant-hover-trigger:hover .consultant-chart-icon {
          opacity: 1 !important;
        }
        @keyframes loadingBar {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .lead-row:hover {
          background-color: var(--color-bg-alt) !important;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .flow-step-card {
          background: var(--color-surface);
          border-radius: 12px !important;
          padding: 1.25rem;
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: var(--shadow-sm);
          cursor: default;
          position: relative;
          transition: border-color 0.4s ease, box-shadow 0.4s ease, transform 0.4s ease !important;
          animation: flowPulse 6s infinite ease-in-out;
        }

        .flow-step-card:nth-child(1) { animation-delay: 0s; }
        .flow-step-card:nth-child(2) { animation-delay: 1.5s; }
        .flow-step-card:nth-child(3) { animation-delay: 3s; }
        .flow-step-card:nth-child(4) { animation-delay: 4.5s; }

        @keyframes flowPulse {
          0%, 100% {
            border-color: var(--color-border);
            box-shadow: var(--shadow-sm);
            transform: translateY(0);
          }
          15%, 35% {
            border-color: var(--color-primary);
            box-shadow: 0 8px 24px rgba(163, 20, 34, 0.12), 0 2px 4px rgba(163, 20, 34, 0.06);
            transform: translateY(-4px);
          }
          50% {
            border-color: var(--color-border);
            box-shadow: var(--shadow-sm);
            transform: translateY(0);
          }
        }

        .flow-step-number {
          position: relative;
          background: linear-gradient(135deg, #a31422 0%, #a31422 100%);
          color: #fff;
          font-weight: 800;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          box-shadow: 0 2px 6px rgba(163, 20, 34, 0.25);
          flex-shrink: 0;
          z-index: 2;
        }

        .flow-step-number::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid var(--color-primary);
          opacity: 0;
          z-index: 1;
          pointer-events: none;
          animation: numberPulse 6s infinite ease-in-out;
        }

        .flow-step-card:nth-child(1) .flow-step-number::after { animation-delay: 0s; }
        .flow-step-card:nth-child(2) .flow-step-number::after { animation-delay: 1.5s; }
        .flow-step-card:nth-child(3) .flow-step-number::after { animation-delay: 3s; }
        .flow-step-card:nth-child(4) .flow-step-number::after { animation-delay: 4.5s; }

        @keyframes numberPulse {
          0%, 100% {
            transform: scale(0.8);
            opacity: 0;
          }
          15%, 35% {
            transform: scale(1.2);
            opacity: 0.6;
          }
          50% {
            transform: scale(0.8);
            opacity: 0;
          }
        }
      `}</style>

    </div>
  );
};

export const Gatekeeper = withRouterFreezer(GatekeeperInner, '/gatekeeper');
