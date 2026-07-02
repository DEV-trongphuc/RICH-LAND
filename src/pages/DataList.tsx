import { useState, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Database, Search, Filter, ChevronLeft, ChevronRight, Download, RefreshCw, User, Phone, Mail, Clock, Tag, ExternalLink, AlertTriangle, CheckCircle2, XCircle, ShieldAlert, Calendar, LayoutList, Sparkles, Check, X, Edit, Bell, Copy, CheckCircle, BarChart2, Scale, Info } from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, LabelList
} from 'recharts';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Avatar } from '../components/ui/Avatar';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { EmptyCard } from '../components/ui/EmptyCard';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { withRouterFreezer } from '../components/RouterFreezer';
import { CalendarSkeleton, TableSkeleton, KpiCardSkeleton, CardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import { detectCountryFromPhone } from '../utils/phoneHelper';
import { NotificationPreviewModal } from '../components/ui/NotificationPreviewModal';
import { RuleSettings } from './RuleSettings';


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
  takers?: any[];
  is_public?: number | boolean;
  person_id?: number;
};

import { fetchAPI, getDefaultDateFilter } from '../utils/api';

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

const getAICardConfig = (selectedLead: Lead | null, theme: 'light' | 'dark', t: (key: string) => string) => {
  if (!selectedLead) return null;
  if (selectedLead.ai_screener_status === 'passed' && selectedLead.ai_evaluation) {
    return {
      avatar: "/LOGO.jpg",
      title: "Rich Land AI",
      badgeText: t("Đạt chuẩn"),
      badgeBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      badgeColor: '#ffffff',
      content: selectedLead.ai_evaluation,
      accentColor: '#BD1D2D',
      textAccentColor: theme === 'dark' ? '#a78bfa' : '#8a0f1b',
      topAccentGradient: 'linear-gradient(90deg, #BD1D2D 0%, #BD1D2D 100%)',
      bgGradient: theme === 'dark' ? 'linear-gradient(135deg, rgba(189, 29, 45, 0.08) 0%, rgba(189, 29, 45, 0.08) 100%)' : 'linear-gradient(135deg, #fff8f9 0%, #fff0f3 100%)',
      borderColor: theme === 'dark' ? '1px solid rgba(189, 29, 45, 0.25)' : '1px solid rgba(189, 29, 45, 0.15)',
    };
  } else if (selectedLead.status === 'pending_approval') {
    const isPendingEvaluation = selectedLead.ai_screener_status === 'pending' && (() => {
      const now = new Date();
      const created = selectedLead.created_at ? parseServerDate(selectedLead.created_at) : now;
      const diffMins = (now.getTime() - created.getTime()) / 60000;
      return diffMins >= -2 && diffMins < 5;
    })();
    return {
      avatar: "/imgs/warn_icon.png",
      title: "Rich Land AI",
      badgeText: t("Chờ duyệt"),
      badgeBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      badgeColor: '#ffffff',
      content: selectedLead.ai_evaluation || (isPendingEvaluation ? t('Đang chờ AI đánh giá...') : t('Tạm giữ')),
      accentColor: '#f59e0b',
      textAccentColor: theme === 'dark' ? '#fbbf24' : '#b45309',
      topAccentGradient: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
      bgGradient: theme === 'dark' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.08) 100%)' : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
      borderColor: theme === 'dark' ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(245, 158, 11, 0.15)',
    };
  } else if (selectedLead.status === 'rejected') {
    return {
      avatar: "/LOGO.jpg",
      title: "Rich Land AI",
      badgeText: t("Từ chối"),
      badgeBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      badgeColor: '#ffffff',
      content: selectedLead.ai_evaluation || t('Không đủ điều kiện'),
      accentColor: '#ef4444',
      textAccentColor: theme === 'dark' ? '#f87171' : '#be123c',
      topAccentGradient: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
      bgGradient: theme === 'dark' ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.08) 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
      borderColor: theme === 'dark' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(239, 68, 68, 0.15)',
    };
  } else if (selectedLead.status === 'blacklisted') {
    return {
      avatar: "/imgs/angry_icon.jpg",
      title: "Rich Land AI",
      badgeText: t("Bị chặn"),
      badgeBg: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
      badgeColor: '#ffffff',
      content: selectedLead.ai_evaluation || t('Chặn tự động'),
      accentColor: '#ef4444',
      textAccentColor: theme === 'dark' ? '#f87171' : '#dc2626',
      topAccentGradient: 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)',
      bgGradient: theme === 'dark' ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(185, 28, 28, 0.08) 100%)' : 'linear-gradient(135deg, #fff5f5 0%, #ffe3e3 100%)',
      borderColor: theme === 'dark' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(239, 68, 68, 0.15)',
    };
  }
  return null;
};

const DataListInner = ({ isActive, searchParams, setSearchParams, location }: { isActive: boolean; searchParams: URLSearchParams; setSearchParams: any; location: any }) => {
  const { user } = useAuth();
  const userRole = user?.role as string;
  const isAdmin = userRole === 'admin' || userRole === 'superadmin' || userRole === 'super_admin' || userRole === 'manager';
  const { language, t } = useLanguage();
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

  const navigate = useNavigate();
  const searchTerm = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const [dateFilter, setDateFilter] = useState(() => {
    return localStorage.getItem('richland_global_date') || getDefaultDateFilter();
  });

  const handleUpdateDateFilter = (val: string) => {
    setDateFilter(val);
    localStorage.setItem('richland_global_date', val);
    window.dispatchEvent(new CustomEvent('global-date-change', { detail: val }));
  };
  const consultantFilter = searchParams.get('consultant') || 'all';
  const roundFilter = searchParams.get('round') || 'all';
  const currentPage = Number(searchParams.get('page') || '1');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const [searchInput, setSearchInput] = useState(searchTerm);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  const [showDupCheckModal, setShowDupCheckModal] = useState(false);
  const [dupCheckInput, setDupCheckInput] = useState('');

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
  const [dupCheckLoading, setDupCheckLoading] = useState(false);
  const [dupCheckResult, setDupCheckResult] = useState<any>(null);

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
          lead_id: item.lead_id,
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
          ai_evaluation: item.ai_evaluation,
          is_public: item.is_public,
          takers: item.takers || []
        }));
        setLeads(mappedLeads);
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
  }, [searchParams, dateFilter, isActive]);

  useEffect(() => {
    if (isActive) {
      const saved = localStorage.getItem('richland_global_date') || getDefaultDateFilter();
      if (saved && saved !== dateFilter) {
        setDateFilter(saved);
      }
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const handleGlobalDate = (e: any) => {
      const newDate = e.detail;
      if (newDate && newDate !== dateFilter) {
        setDateFilter(newDate);
      }
    };
    window.addEventListener('global-date-change', handleGlobalDate);
    return () => window.removeEventListener('global-date-change', handleGlobalDate);
  }, [dateFilter, isActive]);

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
  }, [searchParams, dateFilter, isActive]);

  useEffect(() => {
    if (isActive && leads.length > 0) {
      const autoOpen = searchParams.get('auto_open');
      const openId = searchParams.get('open_id');
      const phoneParam = searchParams.get('search');
      
      if (autoOpen === 'true' || openId) {
        let foundLead = null;
        if (openId) {
          foundLead = leads.find(l => String(l.id) === String(openId) || String(l.lead_id) === String(openId));
        }
        if (!foundLead && phoneParam) {
          foundLead = leads.find(l => l.phone === phoneParam);
        }
        if (!foundLead && leads.length === 1) {
          foundLead = leads[0];
        }
        if (foundLead) {
          setSelectedLead(foundLead);
          
          setSearchParams((prev: any) => {
            prev.delete('auto_open');
            prev.delete('open_id');
            return prev;
          }, { replace: true });
        }
      }
    }
  }, [leads, searchParams, isActive]);

  const updateParams = (key: string, value: string) => {
    if (key === 'date') {
      handleUpdateDateFilter(value);
      return;
    }
    setSearchParams((prev: any) => {
      const next = new URLSearchParams(prev);
      if (value === 'all' || value === '') next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page');
      return next;
    }, { replace: true });
  };

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
    const isUserAdmin = (user?.role === 'admin' || user?.role === 'superadmin');
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
  const [isReleasingLead, setIsReleasingLead] = useState(false);

  const handleReleaseToDatabank = async (leadId: number) => {
    if (!window.confirm(t('Bạn có chắc chắn muốn nhả khách hàng này về Kho chung (Databank)? Việc này sẽ thu hồi quyền sở hữu của các tư vấn viên hiện tại.'))) {
      return;
    }
    setIsReleasingLead(true);
    try {
      const res = await fetchAPI('release_to_databank', {
        method: 'POST',
        body: JSON.stringify({ lead_id: leadId })
      });
      if (res.success) {
        toast.success(res.message || t('Đã nhả về Kho chung thành công!'));
        setSelectedLead(null);
        fetchLeads();
        if (viewMode === 'databank') {
          fetchPublicLeads();
        }
      } else {
        toast.error(res.message || t('Lỗi khi nhả về Kho chung.'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t('Lỗi kết nối hệ thống.'));
    } finally {
      setIsReleasingLead(false);
    }
  };

  const [isDeletingClaim, setIsDeletingClaim] = useState(false);

  const handleDeletePublicClaim = async (personId: number, saleId: number, saleName: string) => {
    if (!window.confirm(t('Bạn có chắc chắn muốn xóa lượt nhận của Sale {name} cho khách hàng này không?').replace('{name}', saleName))) {
      return;
    }
    setIsDeletingClaim(true);
    try {
      const res = await fetchAPI('delete_public_lead_claim', {
        method: 'POST',
        body: JSON.stringify({ person_id: personId, sale_id: saleId })
      });
      if (res.success) {
        toast.success(res.message || t('Đã xóa lượt nhận thành công!'));
        
        // Update local modal details
        const updatedTakers = selectedLead.takers ? selectedLead.takers.filter((t: any) => t.id !== saleId) : [];
        setSelectedLead({
          ...selectedLead,
          takers: updatedTakers
        });

        // Refresh table counts
        fetchLeads();
        if (viewMode === 'databank') {
          fetchPublicLeads();
        }
      } else {
        toast.error(res.message || t('Lỗi khi xóa lượt nhận.'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    } finally {
      setIsDeletingClaim(false);
    }
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
        fetchLeads();
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

  // Calendar / Databank View Mode States
  const [localViewMode, setLocalViewMode] = useState<'list' | 'calendar' | 'databank'>('list');
  useEffect(() => {
    if (location.pathname === '/calendar') {
      setLocalViewMode('calendar');
    } else {
      const viewParam = searchParams.get('view');
      if (viewParam === 'databank') {
        setLocalViewMode('databank');
      } else {
        setLocalViewMode('list');
      }
    }
  }, [location.pathname, searchParams]);
  const viewMode = localViewMode;

  const [publicLeads, setPublicLeads] = useState<any[]>([]);
  const [publicTotalCount, setPublicTotalCount] = useState(0);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicPage, setPublicPage] = useState(1);
  const [isClaimingLeadId, setIsClaimingLeadId] = useState<number | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<any>(null);
  const [dayDetailsLoading, setDayDetailsLoading] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'sales' | 'tickets' | 'blacklist'>('sales');
  const [expandedSales, setExpandedSales] = useState<Record<string, boolean>>({});

  const toggleExpandSale = (saleName: string) => {
    setExpandedSales(prev => ({
      ...prev,
      [saleName]: !prev[saleName]
    }));
  };

  const fetchPublicLeads = async () => {
    setPublicLoading(true);
    try {
      const json = await fetchAPI(`get_public_leads&page=${publicPage}&pageSize=${ITEMS_PER_PAGE}&search=${encodeURIComponent(searchTerm)}`);
      if (json.success) {
        setPublicLeads(json.data || []);
        setPublicTotalCount(json.total_count || (json.data ? json.data.length : 0));
      } else {
        toast.error(json.message || t('Lỗi tải dữ liệu kho data chung'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi tải dữ liệu kho data chung: ') + e.message);
    }
    setPublicLoading(false);
  };

  const handleClaimLead = async (personId: number) => {
    setIsClaimingLeadId(personId);
    try {
      const json = await fetchAPI('claim_public_lead', {
        method: 'POST',
        body: JSON.stringify({ person_id: personId })
      });
      if (json.success) {
        toast.success(json.message || t('Nhận data thành công!'));
        fetchPublicLeads();
        window.dispatchEvent(new CustomEvent('lead-claimed'));
      } else {
        toast.error(json.message || t('Nhận data thất bại'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsClaimingLeadId(null);
  };

  useEffect(() => {
    if (isActive && viewMode === 'databank') {
      fetchPublicLeads();
    }
  }, [isActive, viewMode, publicPage, searchTerm]);

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
    if (localStorage.getItem('RICH LAND_DEMO_MODE') === 'true') {
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
                      lead.status === 'pending_approval' ? (
                        lead.ai_screener_status === 'pending' && (() => {
                          const now = new Date();
                          const created = lead.created_at ? parseServerDate(lead.created_at) : now;
                          const diffMins = (now.getTime() - created.getTime()) / 60000;
                          return diffMins >= -2 && diffMins < 5;
                        })()
                          ? t('Chờ AI đánh giá')
                          : t('Tạm giữ')
                      ) :
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
      const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
      const baseUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api.php` : '/backend/api.php';
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

  const handleRunDupCheck = async () => {
    if (!dupCheckInput.trim()) {
      toast.error(t('Vui lòng nhập số điện thoại hoặc email.'));
      return;
    }
    setDupCheckLoading(true);
    setDupCheckResult(null);
    try {
      const res = await fetchAPI(`check_lead_duplicate&input=${encodeURIComponent(dupCheckInput.trim())}`);
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const paginatedLeads = leads;

  const getStatusBadge = (status: string, reportStatus?: string, aiScreenerStatus?: string, createdAt?: string, takers?: any[]) => {
    if (status === 'assigned' && reportStatus === 'pending') {
      return <span className="badge" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-border-light)' }}>{t('Ticket Review')}</span>;
    }
    if (status === 'error' && reportStatus === 'approved') {
      return <span className="badge warning">{t('Ticket')}</span>;
    }
    if (status === 'pending_approval' && aiScreenerStatus === 'pending') {
      const now = new Date();
      const created = createdAt ? parseServerDate(createdAt) : now;
      const diffMins = (now.getTime() - created.getTime()) / 60000;
      if (diffMins >= -2 && diffMins < 5) {
        return <span className="badge" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-border-light)' }}>{t('Chờ AI đánh giá')}</span>;
      }
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
      case 'released_to_kho':
      case 'databank': {
        const cnt = takers && takers.length ? takers.length : 0;
        if (cnt === 0) {
          return <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>{t('Public (2/2)')}</span>;
        } else if (cnt >= 2) {
          return <span className="badge" style={{ background: 'rgba(156,163,175,0.12)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.2)' }}>{t('Giới hạn (0/2)')}</span>;
        } else {
          return <span className="badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>{t(`Public (1/2)`)}</span>;
        }
      }
      case 'fallback': return <span className="badge" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)', border: '1px solid var(--color-border-light)' }}>{t('Fallback')}</span>;
      default: return null;
    }
  };

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = new Intl.DateTimeFormat(
    language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : 'en-US',
    { month: 'long' }
  ).format(currentDate);

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
            ? 'rgba(189, 29, 45, 0.08)'
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
              <span>{t('Chia')}:</span>
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
              background: theme === 'dark' ? 'var(--color-primary-light)' : '#fff5f6',
              color: theme === 'dark' ? 'var(--color-primary)' : '#a31422',
              fontSize: '0.6875rem',
              fontWeight: 600,
              border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid #ddd6fe'
            }} title={t("Ticket lỗi")}>
              <span>{t('Ticket')}:</span>
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
              <span>{t('Ticket')}:</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)', minHeight: 0 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem', flexShrink: 0 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={24} color="var(--color-primary)" /> {t('Quản lý Data')}
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
              title={t("Giải thích ý nghĩa các trạng thái data")}
            >
              <Info size={14} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t("Giải thích trạng thái")}</span>
            </button>
          </h1>
          <p className="page-subtitle">{t('Xem lịch sử, theo dõi tiến trình và quản lý toàn bộ dữ liệu Khách hàng.')}</p>
        </div>
        <div className="data-list-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {user?.role !== 'sale' ? (
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
                onClick={() => {
                  setLocalViewMode('list');
                  navigate('/data');
                }}
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
                onClick={() => {
                  setLocalViewMode('calendar');
                  navigate('/calendar');
                }}
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
              <button
                type="button"
                className={`btn-toggle-view ${viewMode === 'databank' ? 'active' : ''}`}
                onClick={() => {
                  setLocalViewMode('databank');
                  navigate('/data?view=databank');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'databank' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'databank' ? 'white' : 'var(--color-text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '28px'
                }}
              >
                <Database size={13} /> <span className="hide-on-mobile">{t('Kho chung (Databank)')}</span>
              </button>
            </div>

            {/* Separator line */}
            <div style={{ width: '1px', height: '16px', background: 'var(--color-border)', margin: '0 6px' }} />

            {/* Compact Check Duplicate Button */}
            <button
              type="button"
              onClick={() => setShowDupCheckModal(true)}
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
              <Search size={13} /> <span>{t('Check trùng')}</span>
            </button>

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
          ) : (
            /* For Sale, only show Filter button on mobile */
            <div className="mobile-only" style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              padding: '3px 4px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              height: '38px'
            }}>
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
              >
                <Filter size={13} style={{ color: showMobileFilters ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div
        className={`responsive-filter-row ${!showMobileFilters ? 'filter-hide-on-mobile' : ''}`}
        style={{
          position: 'relative',
          zIndex: 100,
          display: (viewMode === 'calendar') ? 'none' : 'flex',
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

        {viewMode !== 'databank' && (
          <>
            <div className="responsive-filter-item">
              <CustomSelect
                options={[
                  { value: 'all', label: t('Tất cả thời gian'), icon: <Clock size={16} /> },
                  { value: 'Hôm nay', label: t('Hôm nay') },
                  { value: 'Hôm qua', label: t('Hôm qua') },
                  { value: 'Tuần này', label: t('Tuần này') },
                  { value: 'Tuần trước', label: t('Tuần trước') },
                  { value: 'Tuần trước nữa', label: t('Tuần trước nữa') },
                  { value: '7 ngày qua', label: t('7 ngày qua') },
                  { value: '30 ngày qua', label: t('30 ngày qua') },
                  { value: 'Tháng này', label: t('Tháng này') },
                  { value: 'Tháng trước', label: t('Tháng trước') }
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

            {user?.role !== 'sale' && (
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
            )}
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          {t('Tổng cộng')}: <strong style={{ color: 'var(--color-text)', marginLeft: 4 }}>{viewMode === 'databank' ? publicTotalCount : totalCount}</strong> {t('data')}
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
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a31422' }}></span>
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
                  <div style={{ gridColumn: 'span 7' }}>
                    <CalendarSkeleton />
                  </div>
                ) : days}
              </div>
            </div>
          </div>
        </div>
      ) : viewMode === 'databank' ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} className="fade-in-view">
          <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div style={{ flex: 1, overflow: 'auto' }} className="table-wrap custom-scrollbar">
              {publicLoading ? (
                <div style={{ padding: '2rem' }}>
                  <TableSkeleton />
                </div>
              ) : publicLeads.length === 0 ? (
                <div style={{ padding: '3rem 1rem' }}>
                  <EmptyCard
                    icon={<Database size={32} color="var(--color-text-muted)" />}
                    title={t('Kho chung trống')}
                    description={t('Không có dữ liệu trong Kho chung (Databank)')}
                  />
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>{t('Khách hàng')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>{t('Liên hệ')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>{t('Nguồn')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>{t('Người nhận')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700 }}>{t('Giải phóng lúc')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>
                        {isAdmin ? t('Lượt nhận') : t('Hành động')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {publicLeads.map((lead: any) => (
                      <tr 
                        key={lead.id} 
                        style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.2s', cursor: isAdmin ? 'pointer' : 'default' }} 
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(255,255,255,0.01)' : '#fff9fa'} 
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={() => {
                          if (isAdmin) {
                            setSelectedLead({
                              id: lead.id,
                              name: lead.full_name || '',
                              phone: lead.phone || '',
                              email: lead.email || '',
                              source: lead.original_source || 'Databank',
                              status: 'databank',
                              assigned_to_name: t('Chưa ai nhận'),
                              round_name: t('Kho chung'),
                              created_at: lead.released_to_kho_at || '',
                              note: '',
                              type: '-',
                              takers: lead.takers || []
                            });
                          }
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar name={lead.full_name || t('Khách hàng')} size={32} />
                            <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{lead.full_name || t('Khách hàng')}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                            {lead.phone || '-'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{lead.email || '-'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="badge" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>
                            {lead.original_source || 'Databank'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {lead.takers && lead.takers.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {lead.takers.map((t: any) => (
                                <div 
                                  key={t.id} 
                                  title={t.name}
                                  style={{
                                    width: '26px', height: '26px', borderRadius: '50%',
                                    background: 'var(--color-primary-light)',
                                    color: 'var(--color-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, fontSize: '0.75rem', border: '2px solid var(--color-surface)',
                                    overflow: 'hidden', cursor: 'help'
                                  }}
                                >
                                  {t.avatar ? (
                                    <img src={t.avatar} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    t.name.charAt(0).toUpperCase()
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{t('Chưa ai nhận')}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{lead.released_to_kho_at || '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          {isAdmin ? (
                            <span 
                              className="badge" 
                              style={{ 
                                background: !lead.takers || lead.takers.length === 0 ? 'rgba(16,185,129,0.1)' : (lead.takers.length === 1 ? 'rgba(59,130,246,0.1)' : 'rgba(156,163,175,0.1)'),
                                color: !lead.takers || lead.takers.length === 0 ? '#10b981' : (lead.takers.length === 1 ? '#3b82f6' : '#9ca3af'),
                                border: !lead.takers || lead.takers.length === 0 ? '1px solid rgba(16,185,129,0.2)' : (lead.takers.length === 1 ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(156,163,175,0.2)'),
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                padding: '4px 10px',
                                borderRadius: '20px'
                              }}
                            >
                              {Math.max(0, 2 - (lead.takers ? lead.takers.length : 0))} / 2
                            </span>
                          ) : (
                            {(() => {
                              const hasClaimed = lead.takers && lead.takers.some((t: any) => Number(t.id) === Number(user?.id) || Number(t.id) === Number(user?.consultant_id));
                              const isFull = lead.takers && lead.takers.length >= 2;
                              return (
                                <button
                                  onClick={() => handleClaimLead(lead.id)}
                                  disabled={isClaimingLeadId !== null || hasClaimed || isFull}
                                  style={{
                                    background: hasClaimed ? 'rgba(16,185,129,0.12)' : (isFull ? 'transparent' : 'linear-gradient(135deg, #bd1d2d 0%, #e63946 100%)'),
                                    border: hasClaimed ? '1px solid rgba(16,185,129,0.2)' : (isFull ? '1px solid var(--color-border)' : 'none'),
                                    color: hasClaimed ? '#10b981' : (isFull ? 'var(--color-text-muted)' : '#ffffff'),
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    fontSize: '0.8125rem',
                                    fontWeight: 700,
                                    cursor: (hasClaimed || isFull) ? 'default' : 'pointer',
                                    boxShadow: (hasClaimed || isFull) ? 'none' : '0 2px 6px rgba(189, 29, 45, 0.2)',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(!hasClaimed && !isFull) ? e => {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(189, 29, 45, 0.35)';
                                  } : undefined}
                                  onMouseLeave={(!hasClaimed && !isFull) ? e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(189, 29, 45, 0.2)';
                                  } : undefined}
                                >
                                  {isClaimingLeadId === lead.id ? t('Đang nhận...') : (hasClaimed ? t('Đã nhận') : (isFull ? t('Hết lượt') : t('Nhận Data')))}
                                </button>
                              );
                            })()}
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination for Databank */}
            {publicTotalCount > ITEMS_PER_PAGE && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {t('Hiển thị')} <strong>{Math.min(publicTotalCount, (publicPage - 1) * ITEMS_PER_PAGE + 1)}</strong> - <strong>{Math.min(publicTotalCount, publicPage * ITEMS_PER_PAGE)}</strong> {t('trên')} <strong>{publicTotalCount}</strong>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    disabled={publicPage <= 1}
                    onClick={() => setPublicPage(prev => Math.max(1, prev - 1))}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: publicPage <= 1 ? 'not-allowed' : 'pointer',
                      color: 'var(--color-text)'
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={publicPage * ITEMS_PER_PAGE >= publicTotalCount}
                    onClick={() => setPublicPage(prev => prev + 1)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: publicPage * ITEMS_PER_PAGE >= publicTotalCount ? 'not-allowed' : 'pointer',
                      color: 'var(--color-text)'
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
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
                          {getStatusBadge((lead.is_public === 1 || Number(lead.is_public) === 1 || lead.status === 'released_to_kho' || lead.status === 'databank_claim') ? 'databank' : lead.status, lead.report_status, lead.ai_screener_status, lead.created_at, lead.takers)}
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
                              <Avatar src="/imgs/warn_icon.png" name="Rich Land AI - Screener" size={20} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Rich Land AI - Screener</span>
                            </div>
                          ) : lead.status === 'fallback' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Avatar src="/LOGO.jpg" name="Rich Land AI" size={20} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Rich Land AI</span>
                            </div>
                          ) : lead.status === 'rejected' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Avatar src="/LOGO.jpg" name="Rich Land AI - Evaluator" size={20} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Rich Land AI - Evaluator</span>
                            </div>
                          ) : lead.status === 'blacklisted' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Avatar src="/imgs/angry_icon.jpg" name="Rich Land AI - Angry" size={20} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Rich Land AI - Angry</span>
                            </div>
                          ) : (lead.is_public === 1 || Number(lead.is_public) === 1 || lead.status === 'released_to_kho' || lead.status === 'databank_claim' || lead.status === 'databank') ? (
                            lead.takers && lead.takers.length > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {lead.takers.map((t: any) => (
                                  <Avatar key={t.id} src={t.avatar} name={t.name} size={20} title={t.name} />
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)' }}>{t('Chưa ai nhận')}</span>
                            )
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
                            background: '#ffe3e8',
                            color: '#8a0f1b',
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
                  <EmptyCard
                    icon={<Database size={48} />}
                    title={t("Không tìm thấy dữ liệu phù hợp")}
                    description={t("Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để xem kết quả.")}
                  />
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
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--skeleton-base)', animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                          <div>
                            <div style={{ width: 120, height: 16, background: 'var(--skeleton-base)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                            <div style={{ width: 80, height: 12, background: 'var(--skeleton-shine)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                        <div style={{ width: 100, height: 16, background: 'var(--skeleton-base)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                        <div style={{ width: 140, height: 12, background: 'var(--skeleton-shine)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                        <div style={{ width: 80, height: 24, background: 'var(--skeleton-base)', borderRadius: 12, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--skeleton-base)', animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                          <div style={{ width: 90, height: 14, background: 'var(--skeleton-base)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
                        </div>
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                        <div style={{ width: 110, height: 14, background: 'var(--skeleton-base)', borderRadius: 4, animation: 'pulse 1.5s infinite', opacity: 0.5 }} />
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
                            {getStatusBadge((lead.is_public === 1 || Number(lead.is_public) === 1 || lead.status === 'released_to_kho' || lead.status === 'databank_claim') ? 'databank' : lead.status, lead.report_status, lead.ai_screener_status, lead.created_at, lead.takers)}
                            {lead.status !== 'assigned' && lead.report_status === 'pending' && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d' }}>{t('Đang chờ duyệt')}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                          {lead.status === 'pending_approval' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Avatar src="/imgs/warn_icon.png" name="Rich Land AI - Screener" size={32} />
                              <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Rich Land AI - Screener</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('Chờ duyệt')}</div>
                              </div>
                            </div>
                          ) : lead.status === 'fallback' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Avatar src="/LOGO.jpg" name="Rich Land AI" size={32} />
                              <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Rich Land AI</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('Fallback')}</div>
                              </div>
                            </div>
                          ) : lead.status === 'rejected' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Avatar src="/LOGO.jpg" name="Rich Land AI - Evaluator" size={32} />
                              <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Rich Land AI - Evaluator</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('Failed')}</div>
                              </div>
                            </div>
                          ) : lead.status === 'blacklisted' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Avatar src="/imgs/angry_icon.jpg" name="Rich Land AI - Angry" size={32} />
                              <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Rich Land AI - Angry</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{t('Blacklist')}</div>
                              </div>
                            </div>
                          ) : (lead.is_public === 1 || Number(lead.is_public) === 1 || lead.status === 'released_to_kho' || lead.status === 'databank_claim' || lead.status === 'databank') ? (
                            lead.takers && lead.takers.length > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {lead.takers.map((t: any) => (
                                  <div 
                                    key={t.id} 
                                    title={t.name}
                                    style={{
                                      width: '28px', height: '28px', borderRadius: '50%',
                                      background: 'var(--color-primary-light)',
                                      color: 'var(--color-primary)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontWeight: 700, fontSize: '0.75rem', border: '2px solid var(--color-surface)',
                                      overflow: 'hidden', cursor: 'help'
                                    }}
                                  >
                                    {t.avatar ? (
                                      <img src={t.avatar} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      t.name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('Chưa ai nhận')}</span>
                            )
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
          <div className="modal-body-padding">
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
                    {(user?.role === 'admin' || user?.role === 'superadmin') && (
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
 
                    {(user?.role === 'admin' || user?.role === 'superadmin') && selectedLead.status !== 'blacklisted' && !isAdminEditingLead && (
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

                    {isAdmin && selectedLead.status !== 'databank' && selectedLead.status !== 'released_to_kho' && selectedLead.status !== 'databank_claim' && selectedLead.is_public !== 1 && Number(selectedLead.is_public) !== 1 && !isAdminEditingLead && (
                      <button
                        onClick={() => handleReleaseToDatabank(selectedLead.lead_id || selectedLead.id)}
                        disabled={isReleasingLead}
                        title={t("Nhả về Kho chung (Databank)")}
                        className="detail-action-btn"
                        style={{
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#10b981',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.05)'
                        }}
                        onMouseOver={e => {
                          e.currentTarget.style.background = '#10b981';
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 15px rgba(16, 185, 129, 0.2)';
                        }}
                        onMouseOut={e => {
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                          e.currentTarget.style.color = '#10b981';
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(16, 185, 129, 0.05)';
                        }}
                      >
                        <RefreshCw size={14} className={isReleasingLead ? 'animate-spin' : ''} />
                        {isReleasingLead ? t('Đang nhả...') : t('Nhả Kho')}
                      </button>
                    )}

                    {user?.role === 'sale' && 
                     (selectedLead.is_public === 1 || Number(selectedLead.is_public) === 1 || selectedLead.status === 'released_to_kho' || selectedLead.status === 'databank_claim' || selectedLead.status === 'databank') &&
                     !(selectedLead.takers && selectedLead.takers.some((t: any) => Number(t.id) === Number(user?.consultant_id))) &&
                     (selectedLead.takers ? selectedLead.takers.length : 0) < 2 && (
                      <button
                        onClick={async () => {
                          await handleClaimLead(selectedLead.person_id || selectedLead.id);
                          setSelectedLead(null);
                          fetchLeads();
                        }}
                        disabled={isClaimingLeadId !== null}
                        title={t("Nhận khách hàng này về danh sách chăm sóc của bạn")}
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
                        <RefreshCw size={14} className={isClaimingLeadId !== null ? 'animate-spin' : ''} />
                        {isClaimingLeadId !== null ? t('Đang nhận...') : t('Nhận Data')}
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
                    onClick={!isAdminEditingLead ? () => handleCopyText((user?.role === 'admin' || user?.role === 'superadmin') ? selectedLead.phone : maskPhone(selectedLead.phone), t('Đã sao chép số điện thoại!'), 'phone') : undefined}
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
                          {(user?.role === 'admin' || user?.role === 'superadmin') ? selectedLead.phone : maskPhone(selectedLead.phone)}
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
                    onClick={!isAdminEditingLead ? () => handleCopyText((user?.role === 'admin' || user?.role === 'superadmin') ? selectedLead.email : maskEmail(selectedLead.email), t('Đã sao chép email!'), 'email') : undefined}
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
                          {(user?.role === 'admin' || user?.role === 'superadmin') ? selectedLead.email : maskEmail(selectedLead.email)}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}><ExternalLink size={12} /> {t('Nguồn')}</div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}><Tag size={12} /> {t('Trạng thái')}</div>
                    <div>
                      {getStatusBadge((selectedLead.is_public === 1 || Number(selectedLead.is_public) === 1 || selectedLead.status === 'released_to_kho' || selectedLead.status === 'databank_claim') ? 'databank' : selectedLead.status, selectedLead.report_status, selectedLead.ai_screener_status, selectedLead.created_at, selectedLead.takers)}
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

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {isAdminEditingLead ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', width: '80px', flexShrink: 0 }}>{t('Loại Data:')}</span>
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
                              <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', marginRight: '6px' }}>{t('Loại Data:')}</span>
                              <span style={{ fontWeight: 600 }}>{selectedLead.type !== '-' ? selectedLead.type : t('Không có')}</span>
                            </div>
                          )}

                          <div style={{ borderTop: theme === 'dark' ? '1px dashed rgba(245, 158, 11, 0.2)' : '1px dashed rgba(217, 119, 6, 0.15)', paddingTop: '10px', marginTop: '2px' }}>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', color: theme === 'dark' ? '#fbbf24' : '#b45309', display: 'block', marginBottom: '6px' }}>{t('Nội dung ghi chú:')}</span>
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
                                {cleanNote ? cleanNote : <em style={{ color: theme === 'dark' ? '#cbd5e1' : '#b45309', opacity: 0.6 }}>{t('Không có ghi chú thêm')}</em>}
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
              <div className="sticky-column">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>{t('Thông tin Phân bổ')}</h3>

                {/* Đánh giá AI - Nằm bên trên người tiếp nhận */}
                {(() => {
                  const aiConfig = getAICardConfig(selectedLead, theme, t);
                  if (!aiConfig) return null;
                  return (
                    <div style={{
                      marginTop: '0.5rem',
                      marginBottom: '1.5rem',
                      background: aiConfig.bgGradient,
                      border: aiConfig.borderColor,
                      borderRadius: '16px',
                      padding: '1.25rem',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: theme === 'dark' ? '0 8px 32px 0 rgba(0, 0, 0, 0.15)' : '0 10px 25px -5px rgba(189, 29, 45, 0.05), 0 8px 10px -6px rgba(189, 29, 45, 0.03)',
                      transition: 'all 0.3s ease'
                    }}>
                      {/* Top glowing accent bar */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: aiConfig.topAccentGradient
                      }} />

                      {/* Header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1rem',
                        gap: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Avatar src={aiConfig.avatar} name={aiConfig.title} size={36} />
                            <div style={{
                              position: 'absolute',
                              bottom: -2,
                              right: -2,
                              background: aiConfig.accentColor,
                              borderRadius: '50%',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              border: '1.5px solid var(--color-surface)'
                            }}>
                              <Sparkles size={8} />
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: aiConfig.textAccentColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('ĐÁNH GIÁ AI')}</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>{aiConfig.title}</div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span style={{
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          background: aiConfig.badgeBg,
                          color: aiConfig.badgeColor,
                          padding: '2px 6px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }}>
                          {aiConfig.badgeText}
                        </span>
                      </div>

                      {/* Content */}
                      <div style={{
                        background: theme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(255, 255, 255, 0.8)',
                        borderRadius: '12px',
                        padding: '0.875rem 1rem',
                        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          color: aiConfig.textAccentColor,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                          marginBottom: 6
                        }}>
                          <Tag size={12} strokeWidth={2.5} style={{ color: aiConfig.accentColor }} /> {t('Phân tích kết quả')}
                        </div>
                        <div style={{
                          fontSize: '0.85rem',
                          color: 'var(--color-text)',
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.6,
                          fontWeight: 500,
                          letterSpacing: '-0.005em'
                        }}>
                          {aiConfig.content}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {selectedLead.status === 'pending_approval' ? (
                  <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    padding: '1.25rem',
                    borderRadius: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar src="/imgs/warn_icon.png" name="Rich Land AI - Screener" size={36} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{t('Người tiếp nhận')}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Rich Land AI - Screener</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar src="/LOGO.jpg" name="Rich Land AI - Evaluator" size={36} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{t('Người tiếp nhận')}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Rich Land AI - Evaluator</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: '0.75rem', marginBottom: 4 }}><Tag size={12} /> {t('Trạng thái phân bổ')}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t('Failed - Đã hủy')}</div>
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
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar src="/imgs/angry_icon.jpg" name="Rich Land AI - Angry" size={36} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{t('Người tiếp nhận')}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Rich Land AI - Angry</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                ) : (selectedLead.is_public === 1 || Number(selectedLead.is_public) === 1 || selectedLead.status === 'released_to_kho' || selectedLead.status === 'databank_claim' || selectedLead.status === 'databank') ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                      {t('Danh sách Sale đã nhận')}
                    </div>
                    {selectedLead.takers && selectedLead.takers.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {selectedLead.takers.map((t: any, idx: number) => (
                          <div key={t.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--color-surface)', padding: '0.75rem 1rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                            <Avatar src={t.avatar} name={t.name} size={32} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t.name}</div>
                              {t.claimed_at && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                  <Clock size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                  {t.claimed_at}
                                </div>
                              )}
                            </div>
                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                              <button
                                onClick={() => handleDeletePublicClaim(selectedLead.person_id || selectedLead.id, t.id, t.name)}
                                disabled={isDeletingClaim}
                                title={t('Xóa lượt nhận của Sale')}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '28px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  flexShrink: 0
                                }}
                                onMouseOver={e => {
                                  e.currentTarget.style.background = '#ef4444';
                                  e.currentTarget.style.color = '#ffffff';
                                }}
                                onMouseOut={e => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                                  e.currentTarget.style.color = '#ef4444';
                                }}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ background: 'var(--color-bg)', padding: '1.25rem', borderRadius: 12, textAlign: 'center', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                        {t('Chưa có Sale nào nhận chăm sóc khách hàng này.')}
                      </div>
                    )}
                  </div>
                ) : selectedLead.assigned_to_name !== '-' ? (
                  <div style={{ background: 'var(--color-surface)', padding: '1.25rem', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <Avatar src={selectedLead.assigned_to_avatar} name={selectedLead.assigned_to_name} size={40} aiScreened={!!(selectedLead.ai_screener_status && selectedLead.ai_screener_status !== 'not_screened')} />
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{t('Người tiếp nhận')}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {(() => {
                            const cObj = consultants.find(c => c.name === selectedLead.assigned_to_name);
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

                    {/* Tình trạng thông báo Zalo & Email */}
                    {selectedLead.assigned_to_name !== '-' && selectedLead.assigned_to_name !== t('Chưa ai nhận') && selectedLead.status !== 'databank' && selectedLead.status !== 'released_to_kho' && selectedLead.status !== 'databank_claim' && selectedLead.is_public !== 1 && Number(selectedLead.is_public) !== 1 && (
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
                      {(user?.role === 'admin' || user?.role === 'superadmin') && selectedLead.assigned_to_name !== '-' && selectedLead.assigned_to_name !== t('Chưa ai nhận') && selectedLead.status !== 'databank' && selectedLead.status !== 'released_to_kho' && selectedLead.is_public !== 1 && Number(selectedLead.is_public) !== 1 && (
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
                  )}
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
        )}
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
        {confirmBlockOpen && (
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
        )}
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
        {selectedDate !== null && (
          <>
            {dayDetailsLoading ? (
              <div style={{ padding: '1rem' }}>
                <TableSkeleton rows={6} cols={4} />
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
                              {(() => {
                                const groupedSales: Record<string, {
                                  sale_name: string;
                                  sale_avatar?: string;
                                  items: any[];
                                  totalCount: number;
                                }> = {};

                                dayDetails.sales.forEach((item: any) => {
                                  const name = item.sale_name || t('Chưa phân bổ');
                                  if (!groupedSales[name]) {
                                    groupedSales[name] = {
                                      sale_name: name,
                                      sale_avatar: item.sale_avatar,
                                      items: [],
                                      totalCount: 0
                                    };
                                  }
                                  groupedSales[name].items.push(item);
                                  groupedSales[name].totalCount += Number(item.count) || 0;
                                });

                                const sortedGroupedNames = Object.keys(groupedSales).sort((a, b) => {
                                  const isUnassignedA = a === 'Chưa phân bổ' || a === 'Unassigned' || a === '';
                                  const isUnassignedB = b === 'Chưa phân bổ' || b === 'Unassigned' || b === '';
                                  if (isUnassignedA && !isUnassignedB) return 1;
                                  if (!isUnassignedA && isUnassignedB) return -1;
                                  return a.localeCompare(b, 'vi');
                                });

                                return sortedGroupedNames.map((name) => {
                                  const group = groupedSales[name];
                                  const isExpanded = !!expandedSales[name];

                                  const sortedItems = [...group.items].sort((a, b) => {
                                    const roundA = a.status === 'reminder' ? 'REMINDER' : (a.round_name || '');
                                    const roundB = b.status === 'reminder' ? 'REMINDER' : (b.round_name || '');
                                    return roundA.localeCompare(roundB, 'vi');
                                  });

                                  return (
                                    <Fragment key={name}>
                                      {/* Collapsible Header Row */}
                                      <tr
                                        onClick={() => toggleExpandSale(name)}
                                        style={{
                                          background: 'var(--color-bg-light)',
                                          cursor: 'pointer',
                                          fontWeight: 600,
                                          borderBottom: '1px solid var(--color-border)'
                                        }}
                                      >
                                        <td>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', paddingLeft: '4px' }}>
                                            <span style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              transition: 'transform 0.2s',
                                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                              color: 'var(--color-text-muted)',
                                              marginRight: '2px'
                                            }}>
                                              <ChevronRight size={16} />
                                            </span>
                                            <Avatar src={group.sale_avatar} name={group.sale_name} size={30} />
                                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                              {group.sale_name}
                                            </span>
                                            <span style={{
                                              fontSize: '0.7rem',
                                              background: 'var(--color-border-light)',
                                              color: 'var(--color-text-light)',
                                              padding: '2px 6px',
                                              borderRadius: '10px',
                                              marginLeft: '6px',
                                              fontWeight: 600
                                            }}>
                                              {group.items.length} {t('nhóm')}
                                            </span>
                                          </div>
                                        </td>
                                        <td style={{ color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 500 }}>
                                          {isExpanded ? '' : t('Nhấp để xem chi tiết')}
                                        </td>
                                        <td></td>
                                        <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                                          <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.95rem' }}>
                                            {group.totalCount}
                                          </span>
                                        </td>
                                      </tr>

                                      {/* Detail Rows when expanded */}
                                      {isExpanded && sortedItems.map((item: any, idx: number) => {
                                        const isReminder = item.status === 'reminder';
                                        const roundDisplay = isReminder ? 'REMINDER' : (item.round_name || '-');

                                        return (
                                          <tr key={`${name}_${idx}`} style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border-light)' }}>
                                            <td style={{ paddingLeft: '2.5rem' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '0.825rem' }}>
                                                <span style={{ opacity: 0.5 }}>└─</span>
                                                <span>{t('Phân bổ trong vòng')}</span>
                                              </div>
                                            </td>
                                            <td>
                                              <span style={{
                                                background: isReminder ? 'rgba(236, 72, 153, 0.12)' : 'var(--color-primary-light)',
                                                color: isReminder ? '#ec4899' : 'var(--color-primary)',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600
                                              }}>
                                                {roundDisplay}
                                              </span>
                                            </td>
                                            <td>{getStatusBadge(item.status)}</td>
                                            <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                                              <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>
                                                {item.count}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </Fragment>
                                  );
                                });
                              })()}
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
                                const showPhone = (user?.role === 'admin' || user?.role === 'superadmin') ? item.phone : maskPhone(item.phone);
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
                                const showPhone = (user?.role === 'admin' || user?.role === 'superadmin') ? item.phone : maskPhone(item.phone);
                                const showEmail = (user?.role === 'admin' || user?.role === 'superadmin') ? item.email : maskEmail(item.email);
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
          </>
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
                onClick={handleRunDupCheck}
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
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 15px rgba(163, 20, 34, 0.3)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(163, 20, 34, 0.2)';
                }}
              >
                {isSendingReminder ? <RefreshCw size={14} className="spin" /> : <Bell size={14} />}
                {isSendingReminder ? t('Đang gửi...') : t('Xác nhận')}
              </button>
            </div>
          </div>
        )}
      </CustomModal>

      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={t("Ý nghĩa các Trạng thái Data")}
        width="800px"
      >
        <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
            {t("Hệ thống tự động phân loại dữ liệu khách hàng theo các trạng thái dưới đây nhằm đảm bảo tính tối ưu, minh bạch và công bằng cho đội ngũ Tư vấn viên (TVV).")}
          </p>

          {/* Group 1: Active & Distributed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ 
              fontSize: '0.9rem', 
              fontWeight: 700, 
              color: 'var(--color-success)', 
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              paddingBottom: '6px',
              borderBottom: '1px solid var(--color-border-light)'
            }}>
              <CheckCircle2 size={16} /> {t("1. Hoạt động & Phân bổ")}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }} className="responsive-grid-1">
              {/* assigned */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#e6f4ea',
                  color: theme === 'dark' ? '#34d399' : '#137333',
                  border: theme === 'dark' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid #ceead6',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <CheckCircle2 size={12} />
                  {t("Đã chia (assigned)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Data được phân bổ thành công cho TVV thông qua cơ chế xoay vòng (Round-Robin) tự động.")}
                </span>
              </div>

              {/* compensation */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(189, 29, 45, 0.15)' : '#fff0f3',
                  color: theme === 'dark' ? '#a78bfa' : '#700913',
                  border: theme === 'dark' ? '1px solid rgba(189, 29, 45, 0.25)' : '1px solid #ffccd5',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <Scale size={12} />
                  {t("Data Bù (compensation)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Lượt đền bù tự động giao cho TVV để trả nợ data lỗi đã được duyệt. Luôn có độ ưu tiên cao nhất hàng đợi.")}
                </span>
              </div>

              {/* reminder */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(236, 72, 153, 0.15)' : '#fce7f3',
                  color: theme === 'dark' ? '#f472b6' : '#9d174d',
                  border: theme === 'dark' ? '1px solid rgba(236, 72, 153, 0.25)' : '1px solid #fbcfe8',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <Bell size={12} />
                  {t("Nhắc lại (reminder)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Khách hàng cũ đăng ký lại. Hệ thống tự động chuyển thẳng cho TVV đã chăm sóc trước đó để tiếp tục theo dõi.")}
                </span>
              </div>

              {/* fallback */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(249, 115, 22, 0.15)' : '#fff7ed',
                  color: theme === 'dark' ? '#fb923c' : '#c2410c',
                  border: theme === 'dark' ? '1px solid rgba(249, 115, 22, 0.25)' : '1px solid #ffedd5',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <Sparkles size={12} />
                  {t("Dự phòng (fallback)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Phân bổ khẩn cấp cho TVV được chỉ định làm dự phòng khi vòng không tìm được TVV nào sẵn sàng nhận số.")}
                </span>
              </div>
            </div>
          </div>

          {/* Group 2: Queue & Verification */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ 
              fontSize: '0.9rem', 
              fontWeight: 700, 
              color: 'var(--color-warning)', 
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              paddingBottom: '6px',
              borderBottom: '1px solid var(--color-border-light)'
            }}>
              <Clock size={16} /> {t("2. Hàng đợi & Kiểm duyệt")}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }} className="responsive-grid-1">
              {/* pending */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : '#e8f0fe',
                  color: theme === 'dark' ? '#60a5fa' : '#1a73e8',
                  border: theme === 'dark' ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid #d2e3fc',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <Clock size={12} />
                  {t("Chờ chia (pending)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Data đang nằm trong hàng đợi phân phối, chờ đến lượt của thuật toán chia số tiếp theo.")}
                </span>
              </div>

              {/* pending_work_hours */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(6, 182, 212, 0.15)' : '#ecfeff',
                  color: theme === 'dark' ? '#22d3ee' : '#0f766e',
                  border: theme === 'dark' ? '1px solid rgba(6, 182, 212, 0.25)' : '1px solid #cffafe',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <Calendar size={12} />
                  {t("Chờ giờ làm (pending_work_hours)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Data đổ về ngoài khung giờ làm việc. Hệ thống sẽ giữ lại và tự động chia khi bắt đầu ca làm việc.")}
                </span>
              </div>

              {/* pending_approval */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start',
                gridColumn: 'span 2'
              }} className="span-full-mobile">
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb',
                  color: theme === 'dark' ? '#fbbf24' : '#b45309',
                  border: theme === 'dark' ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid #fef3c7',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <ShieldAlert size={12} />
                  {t("Tạm giữ / Chờ AI đánh giá (pending_approval)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Data có yếu tố nghi vấn về chất lượng hoặc đang trong hàng đợi xử lý sàng lọc của AI (Gatekeeper). Nếu đạt chuẩn sẽ được chia tiếp, nếu dưới chuẩn sẽ bị từ chối chuyển sang trạng thái Dưới chuẩn.")}
                </span>
              </div>
            </div>
          </div>

          {/* Group 3: Filtered & Blocked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ 
              fontSize: '0.9rem', 
              fontWeight: 700, 
              color: 'var(--color-danger)', 
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              paddingBottom: '6px',
              borderBottom: '1px solid var(--color-border-light)'
            }}>
              <XCircle size={16} /> {t("3. Lọc bỏ & Chặn")}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }} className="responsive-grid-1">
              {/* rejected */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fce8e6',
                  color: theme === 'dark' ? '#f87171' : '#c5221f',
                  border: theme === 'dark' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid #fad2cf',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <XCircle size={12} />
                  {t("Dưới chuẩn (rejected)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Data bị hệ thống AI hoặc Admin từ chối do không đủ tiêu chuẩn tối thiểu (sai chuyên ngành, học sinh cấp 3, không nhu cầu thực tế...).")}
                </span>
              </div>

              {/* blacklisted */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(220, 38, 38, 0.15)' : '#fee2e2',
                  color: theme === 'dark' ? '#fca5a5' : '#991b1b',
                  border: theme === 'dark' ? '1px solid rgba(220, 38, 38, 0.25)' : '1px solid #fca5a5',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <AlertTriangle size={12} />
                  {t("Blacklist (blacklisted)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Số điện thoại rác, spam hoặc quấy phá nằm trong danh sách đen bị chặn vĩnh viễn, không bao giờ được chia.")}
                </span>
              </div>

              {/* duplicate */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(100, 116, 139, 0.15)' : '#f1f5f9',
                  color: theme === 'dark' ? '#94a3b8' : '#475569',
                  border: theme === 'dark' ? '1px solid rgba(100, 116, 139, 0.25)' : '1px solid #e2e8f0',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <Copy size={12} />
                  {t("Trùng lặp (duplicate)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Data bị trùng lặp thông tin liên hệ với khách hàng đã tồn tại trong hệ thống.")}
                </span>
              </div>

              {/* rule_6_month */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(100, 116, 139, 0.15)' : '#f1f5f9',
                  color: theme === 'dark' ? '#94a3b8' : '#475569',
                  border: theme === 'dark' ? '1px solid rgba(100, 116, 139, 0.25)' : '1px solid #e2e8f0',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <Calendar size={12} />
                  {t("Quy định 6 tháng (rule_6_month)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Áp dụng quy tắc chặn hoặc điều hướng đặc biệt đối với khách hàng đăng ký lại trong vòng 6 tháng gần nhất.")}
                </span>
              </div>

              {/* silent */}
              <div style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                border: '1px solid var(--color-border-light)',
                borderRadius: '10px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-start',
                gridColumn: 'span 2'
              }} className="span-full-mobile">
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: theme === 'dark' ? 'rgba(100, 116, 139, 0.15)' : '#f1f5f9',
                  color: theme === 'dark' ? '#94a3b8' : '#475569',
                  border: theme === 'dark' ? '1px solid rgba(100, 116, 139, 0.25)' : '1px solid #e2e8f0',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  <RefreshCw size={12} />
                  {t("Chỉ đồng bộ (silent)")}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  {t("Data được đẩy vào phục vụ mục đích ghi nhận lịch sử, đối soát hoặc thống kê của hệ thống tiếp thị mà không tham gia vào luồng chia số.")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CustomModal>

      {selectedLead && (
        <NotificationPreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          type={previewType}
          leadName={selectedLead.name}
          leadPhone={(user?.role === 'admin' || user?.role === 'superadmin') ? selectedLead.phone : maskPhone(selectedLead.phone)}
          leadEmail={(user?.role === 'admin' || user?.role === 'superadmin') ? selectedLead.email : maskEmail(selectedLead.email)}
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
              {statsLoading && !statsData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* KPI Cards Skeleton Row */}
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                  </div>
                  {/* Chart Skeleton */}
                  <ChartSkeleton height={180} />
                  {/* Two Columns Grid for other charts */}
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <CardSkeleton height={140} />
                    <CardSkeleton height={140} />
                  </div>
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
                            background: 'linear-gradient(90deg, #a78bfa, #a31422)',
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
                          { name: t('Thành công'), value: statsData.summary.successful, color: '#a31422' },
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

      <style>{`
        @media (max-width: 768px) {
          .responsive-grid-1 {
            grid-template-columns: 1fr !important;
          }
          .span-full-mobile {
            grid-column: span 1 !important;
          }
        }
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
          box-shadow: inset 0 0 0 2px var(--color-primary-light), 0 8px 24px rgba(189, 29, 45, 0.08);
          z-index: 10;
          transform: translateY(-2px);
        }
        .fade-in-view {
          opacity: 1;
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

export const DataList = withRouterFreezer(DataListInner, (path) => path === '/data' || path === '/calendar');
