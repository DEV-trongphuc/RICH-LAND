import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { withRouterFreezer } from '../components/RouterFreezer';
import {
  LogOut, LogIn, Search, Filter, AlertCircle, CheckCircle2,
  XCircle, Clock, FileText,
  Clock3, GitBranch, ArrowUpRight, ShieldAlert, Send, ArrowLeft,
  Sun, Moon, ChevronDown, ChevronUp, AlertTriangle, ChevronLeft, ChevronRight,
  LayoutDashboard, Database, Ticket, Calendar, RefreshCw, Menu, Tag, Server, Scale, Settings, Info, Cpu,
  Camera, Video, Layers, Plus, Receipt, CreditCard, Building2, Users, User, UserCheck, UserPlus, Trash2, CheckSquare, X, Paperclip, LifeBuoy, Fingerprint, LayoutGrid, Monitor, Tv, Phone, Save, Award, Ban, RotateCcw, MoreHorizontal, Check, KeyRound, Loader2, Shield, Mail, ShieldCheck, Lock as LockIcon,
  Play, Sparkles, ArrowRight, Eye, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';

import { WarRoomFlightDeck } from '../components/Dashboard/WarRoomFlightDeck';
import { QuickAddLeadModal } from '../components/QuickAddLeadModal';
import { AddressSelect } from '../components/ui/AddressSelect';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { DigitPinInput } from '../components/ui/DigitPinInput';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart,
  PieChart, Pie, Cell, LabelList
} from 'recharts';
import toast from 'react-hot-toast';
import { useUIStore } from '../store/uiStore';
import { Package } from 'lucide-react';
import { AssignedAssetsSection, type AssignedAsset } from '../components/ui/AssignedAssetsSection';

import { fetchAPI } from '../utils/api';
import { compressToWebP } from '../utils/imageCompress';
import { MentionInput } from '../components/ui/MentionInput';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useLanguage } from '../contexts/LanguageContext';
import { Avatar } from '../components/ui/Avatar';
import { EmptyCard } from '../components/ui/EmptyCard';
import { Pagination } from '../components/ui/Pagination';
import { TableSkeleton, StatRowSkeleton, CalendarSkeleton, CardSkeleton, Skeleton } from '../components/ui/Skeleton';
import { SignaturePadModal } from '../components/ui/SignaturePadModal';
import { Edit3 } from 'lucide-react';
import { FairShareAudit } from './FairShareAudit';
import { InvoicesPage } from './InvoicesPage';
import ProjectsPage from './ProjectsPage';
import { FilesPage } from './FilesPage';
import { Consultants } from './Consultants';
import AttendancePage from './AttendancePage';
import api from '../api/axios';
import { CustomerProfileDrawer } from './CustomerProfileDrawer';
import { WorkspaceTaskDrawer } from './WorkspaceTaskDrawer';
import styles from './EntityDrawer.module.css';
import vnFlag from '../assets/vn.svg';
import usFlag from '../assets/us.svg';
import jpFlag from '../assets/jp.svg';
import cnFlag from '../assets/cn.svg';

const languagesList = [
  { code: 'vi', name: 'Tiếng Việt', flag: vnFlag },
  { code: 'en', name: 'English', flag: usFlag },
  { code: 'ja', name: '日本語', flag: jpFlag },
  { code: 'zh', name: '简体中文', flag: cnFlag }
] as const;

const LeadRecallTimer: React.FC<{
  lastInteractionDate: string;
  receivedAt?: string;
  leadRecallMinutes: number;
  defaultTimeoutMinutes?: number;
  onTimeout?: () => void;
  t: (key: string) => string;
}> = ({ lastInteractionDate, receivedAt, leadRecallMinutes, defaultTimeoutMinutes = 2, onTimeout, t }) => {
  const targetDate = React.useMemo(() => new Date(receivedAt || lastInteractionDate).getTime(), [lastInteractionDate, receivedAt]);
  const leadRecallMins = leadRecallMinutes || defaultTimeoutMinutes;
  const limitMs = leadRecallMins * 60 * 1000;

  const [remainingMs, setRemainingMs] = React.useState(() => {
    const elapsed = Date.now() - targetDate;
    return limitMs - elapsed;
  });

  React.useEffect(() => {
    if (leadRecallMins <= 0) return;

    const timer = setInterval(() => {
      const elapsed = Date.now() - targetDate;
      const remaining = limitMs - elapsed;
      setRemainingMs(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        if (onTimeout) onTimeout();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, limitMs, leadRecallMins, onTimeout]);

  if (leadRecallMins <= 0) return null;

  if (remainingMs <= 0) {
    return <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>{t('Quá hạn')}</span>;
  }

  const totalSecs = Math.max(0, Math.floor(remainingMs / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const formatted = `${mins}:${String(secs).padStart(2, '0')}`;

  return (
    <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Clock size={12} /> {formatted}
    </span>
  );
};

const DAY_LABELS: { [key: string]: string } = {
  "1": "Thứ 2",
  "2": "Thứ 3",
  "3": "Thứ 4",
  "4": "Thứ 5",
  "5": "Thứ 6",
  "6": "Thứ 7",
  "7": "Chủ Nhật"
};

const DEFAULT_SCHEDULE = {
  "1": { active: true, start: "08:00", end: "17:30" },
  "2": { active: true, start: "08:00", end: "17:30" },
  "3": { active: true, start: "08:00", end: "17:30" },
  "4": { active: true, start: "08:00", end: "17:30" },
  "5": { active: true, start: "08:00", end: "17:30" },
  "6": { active: true, start: "08:00", end: "17:30" },
  "7": { active: true, start: "08:00", end: "17:30" }
};

const isCurrentlyOnLeave = (profile: any) => {
  if (!profile || !profile.leave_start || !profile.leave_end) return false;
  const now = new Date();
  const start = new Date(profile.leave_start + ' 00:00:00');
  const end = new Date(profile.leave_end + ' 23:59:59');
  return now >= start && now <= end;
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

const getDueDateLabel = (dateStr: string | null | undefined, isDone: boolean, t: any) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  if (isDone) return d.toLocaleDateString('vi-VN');
  const today = new Date().setHours(0,0,0,0);
  const due = d.setHours(0,0,0,0);
  if (due === today) return t('Hôm nay');
  if (due < today) {
    const diff = Math.ceil((today - due) / (1000 * 60 * 60 * 24));
    return `${t('Trễ')} ${diff} ${t('ngày')}`;
  }
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff <= 7) return `${t('Còn')} ${diff} ${t('ngày')}`;
  return d.toLocaleDateString('vi-VN');
};

interface SalePortalProps {
  isActive?: boolean;
  searchParams?: URLSearchParams;
  setSearchParams?: any;
  location?: any;
  activeTabProp?: 'dashboard' | 'workspace' | 'data' | 'tickets' | 'schedule' | 'calendar' | 'fair-share' | 'databank' | 'invoices' | 'projects' | 'files' | 'consultants';
  embedMode?: boolean;
}

const ALLOWED_PORTAL_ROLES = ['sale', 'sales', 'superadmin', 'admin', 'super_admin', 'manager', 'director', 'assistant', 'viewer'];

const SalePortalInner = ({ location, activeTabProp, embedMode = false }: SalePortalProps) => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const loc = location || routerLocation;
  const { user, token, login, logout, updateUser } = useAuth();
  const currentUser = user;
  const { language, setLanguage, t } = useLanguage();
  const { showConfirm, closeConfirm } = useUIStore();
  const [showWorkspaceHelpModal, setShowWorkspaceHelpModal] = useState(false);
  const [showTicketHelpModal, setShowTicketHelpModal] = useState(false);
  const [showDatabankHelpModal, setShowDatabankHelpModal] = useState(false);
  const [sysSettings, setSysSettings] = useState<any>(null);
  useEffect(() => {
    fetchAPI('get_settings').then(res => {
      if (res && res.success) {
        setSysSettings(res.data);
      }
    });
  }, []);

  const [showDatabankSettingsModal, setShowDatabankSettingsModal] = useState(false);
  const [dbLimitHour, setDbLimitHour] = useState(3);
  const [dbLimitDay, setDbLimitDay] = useState(2);
  const [dbLimitMonth, setDbLimitMonth] = useState(300);
  const [dbApplicableSources, setDbApplicableSources] = useState('');
  const [dbTimerChuaXacDinh, setDbTimerChuaXacDinh] = useState('');
  const [dbTimerQuanTam, setDbTimerQuanTam] = useState('');
  const [dbTimerThienChi, setDbTimerThienChi] = useState('');
  const [dbTimerDongYGap, setDbTimerDongYGap] = useState('');
  const [dbTimerDaGap, setDbTimerDaGap] = useState('');
  const [dbTimerBooking, setDbTimerBooking] = useState('');

  useEffect(() => {
    if (sysSettings) {
      setDbLimitHour(Number(sysSettings.databank_limit_per_hour ?? 3));
      setDbLimitDay(Number(sysSettings.databank_limit_per_day ?? 2));
      setDbLimitMonth(Number(sysSettings.databank_limit_per_month ?? 300));
      setDbApplicableSources(sysSettings.databank_applicable_sources ?? '');
      setDbTimerChuaXacDinh(sysSettings.security_timer_chua_xac_dinh ?? '');
      setDbTimerQuanTam(sysSettings.security_timer_quan_tam ?? '');
      setDbTimerThienChi(sysSettings.security_timer_thien_chi ?? '');
      setDbTimerDongYGap(sysSettings.security_timer_dong_y_gap ?? '');
      setDbTimerDaGap(sysSettings.security_timer_da_gap ?? '');
      setDbTimerBooking(sysSettings.security_timer_booking ?? '');
    }
  }, [sysSettings]);

  const [isSavingDbSettings, setIsSavingDbSettings] = useState(false);
  const handleSaveDatabankSettings = async () => {
    setIsSavingDbSettings(true);
    try {
      const payload = {
        ...sysSettings,
        databank_limit_per_hour: dbLimitHour,
        databank_limit_per_day: dbLimitDay,
        databank_limit_per_month: dbLimitMonth,
        databank_applicable_sources: dbApplicableSources,
        security_timer_chua_xac_dinh: dbTimerChuaXacDinh,
        security_timer_quan_tam: dbTimerQuanTam,
        security_timer_thien_chi: dbTimerThienChi,
        security_timer_dong_y_gap: dbTimerDongYGap,
        security_timer_da_gap: dbTimerDaGap,
        security_timer_booking: dbTimerBooking
      };

      const res = await fetchAPI('save_settings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res && res.success) {
        toast.success(t("Cấu hình Kho Data Chung đã được lưu!"));
        setSysSettings(payload);
        setShowDatabankSettingsModal(false);
        fetchPublicLeads();
      } else {
        toast.error(res?.message || t("Lỗi khi lưu cấu hình"));
      }
    } catch (err) {
      toast.error(t("Không thể kết nối máy chủ"));
    } finally {
      setIsSavingDbSettings(false);
    }
  };


  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLangOpen) return;
    const handleClose = () => setIsLangOpen(false);
    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, [isLangOpen]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const localTheme = localStorage.getItem('richland_theme') as 'light' | 'dark';
    if (localTheme) {
      setTheme(localTheme);
      document.documentElement.setAttribute('data-theme', localTheme);
    } else {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = (event?: React.MouseEvent) => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';

    // Check if View Transition is supported and user does not prefer reduced motion
    if (!(document as any).startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTheme(nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('richland_theme', nextTheme);
      window.dispatchEvent(new Event('theme-change'));
      return;
    }

    // Get click position or fallback to center of the viewport
    const x = event ? event.clientX : window.innerWidth / 2;
    const y = event ? event.clientY : window.innerHeight / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = (document as any).startViewTransition(() => {
      setTheme(nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('richland_theme', nextTheme);
      window.dispatchEvent(new Event('theme-change'));
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`
      ];
      document.documentElement.animate(
        {
          clipPath: clipPath,
        },
        {
          duration: 600,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };


  // Parse initial search query from email link
  const getInitialSearch = () => {
    const params = new URLSearchParams(loc.search);
    return params.get('search') || '';
  };

  // State definitions
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({
    leads: [],
    rounds: [],
    consultants: [],
    stats: {
      total_received: 0,
      tickets_total: 0,
      tickets_approved: 0,
      tickets_rejected: 0,
      tickets_pending: 0
    },
    by_round: [],
    by_hour: Array(24).fill(0)
  });
  const isAllowedToReport = data.is_allowed_to_report !== false;

  const [portalVacationMode, setPortalVacationMode] = useState(false);
  const [pendingCoopsCount, setPendingCoopsCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
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
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const [search, setSearch] = useState(getInitialSearch());
  const [searchInput, setSearchInput] = useState(getInitialSearch());
  const [roundId, setRoundId] = useState('');
  const [saleIdFilter, setSaleIdFilter] = useState(() => {
    const params = new URLSearchParams(loc.search);
    return params.get('sale_id') || '';
  });
  const [dateMode, setDateMode] = useState('7_days'); // all, today, yesterday, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [flowViewMode, setFlowViewMode] = useState<'day' | 'hour'>('day');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    priority: 'medium',
    due_date: new Date().toISOString().slice(0, 10),
    description: '',
    link: '',
    related_id: '',
    user_id: '',
    progress: 0,
    require_approval: 0,
    approver_id: '',
    // ERP extra task properties
    internal_type: 'task',
    scope: 'team',
    recurrence_pattern: 'none',
    recurrence_weekly_days: [] as number[],
    recurrence_monthly_day: 1,
    participant_ids: [] as string[],
    related_contact_ids: [] as string[],
    checklist: [] as any[],
    project_id: '',
    campaign_id: '',
    team_id: '',
    campaign_target: ''
  });

  // Local states for subtasks creation
  const [subTaskTitle, setSubTaskTitle] = useState('');
  const [subTaskAssignee, setSubTaskAssignee] = useState('');
  const [taskTypeTab, setTaskTypeTab] = useState<'customer' | 'team' | 'personal'>('customer');

  const [currentPage, setCurrentPage] = useState(1);
  const [databankPage, setDatabankPage] = useState(1);
  const [selectedPublicLeads, setSelectedPublicLeads] = useState<number[]>([]);
  const [calendarSubTab, setCalendarSubTab] = useState<'calendar' | 'attendance'>('calendar');
  const [wsTaskFilter, setWsTaskFilter] = useState<'all' | 'assigned_to_me' | 'approve_by_me' | 'collaborator'>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [wsSubTab, setWsSubTab] = useState<'all' | 'customer' | 'team' | 'personal'>('all');
  const [wsTeamSubFilter, setWsTeamSubFilter] = useState<'all' | 'task' | 'announcement' | 'campaign' | 'policy'>('all');
  
  // Task participant modal states
  const [selectedTaskParticipants, setSelectedTaskParticipants] = useState<any[]>([]);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);

  // Authentication states
  const [googleError, setGoogleError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isAdminMsg, setIsAdminMsg] = useState('');

  // Ticket submission modal states
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [reportReasonType, setReportReasonType] = useState('Số điện thoại không đúng / Thuê bao');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [showWarRoom, setShowWarRoom] = useState(false);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeDetailLead, setActiveDetailLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [isReleasingLead, setIsReleasingLead] = useState(false);
  const [profileContact, setProfileContact] = useState<any>(null);
  const [profileDrawerTab, setProfileDrawerTab] = useState<string>('info');

  // Tab & Layout states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workspace' | 'data' | 'tickets' | 'schedule' | 'calendar' | 'fair-share' | 'databank' | 'invoices' | 'projects' | 'files' | 'consultants'>(activeTabProp || 'dashboard');
  const [sourceViewMode, setSourceViewMode] = useState<'connection' | 'lead'>('connection');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [vacationConfirmOpen, setVacationConfirmOpen] = useState(false);

  // Filter states for workspace tasks
  const [wsSearch, setWsSearch] = useState('');
  const [wsPriority, setWsPriority] = useState('');
  const [wsStatus, setWsStatus] = useState('planned'); // Default: hide completed
  const [wsViewMode, setWsViewMode] = useState<'grid' | 'kanban' | 'focus'>('grid');
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [activeOverCol, setActiveOverCol] = useState<'todo' | 'in_progress' | 'done' | null>(null);
  const [wsDatePreset, setWsDatePreset] = useState('all');
  const [completedCallsCount, setCompletedCallsCount] = useState<number>(0);
  const [showCallsModal, setShowCallsModal] = useState(false);
  const [modalCalls, setModalCalls] = useState<any[]>([]);
  const [loadingModalCalls, setLoadingModalCalls] = useState(false);
  const [callsSearch, setCallsSearch] = useState('');
  const [callsModalTab, setCallsModalTab] = useState<'chart' | 'detail'>('chart');
  const [callsModalPage, setCallsModalPage] = useState(1);
  const [callsModalPageSize] = useState(5);
  const [wsStartDate, setWsStartDate] = useState('');
  const [wsEndDate, setWsEndDate] = useState('');
  const [wsTasks, setWsTasks] = useState<any[]>([]);
  const [wsTeamId, setWsTeamId] = useState('');
  const [wsUserId, setWsUserId] = useState('');
  const [wsActivityType, setWsActivityType] = useState('task');
  const [wsRelatedType, setWsRelatedType] = useState('');
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<Array<{ text: string; checked: boolean }>>([]);
  const [wsTasksPage, setWsTasksPage] = useState(1);
  const [wsTasksPageSize, setWsTasksPageSize] = useState(12);

  const [showUpcomingMeetingsModal, setShowUpcomingMeetingsModal] = useState(false);
  const [meetingSearchText, setMeetingSearchText] = useState('');
  const [meetingFilterStatus, setMeetingFilterStatus] = useState<'all' | 'planned' | 'overdue' | 'done'>('all');
  const [meetingPage, setMeetingPage] = useState(1);
  const [meetingFilterTeamId, setMeetingFilterTeamId] = useState('all');
  const [meetingFilterSaleId, setMeetingFilterSaleId] = useState('all');

  const [showMeetingTeamDropdown, setShowMeetingTeamDropdown] = useState(false);
  const [showMeetingSaleDropdown, setShowMeetingSaleDropdown] = useState(false);
  const [meetingTeamSearchText, setMeetingTeamSearchText] = useState('');
  const [meetingSaleSearchText, setMeetingSaleSearchText] = useState('');

  const formatVietnameseFullName = (nameStr: string) => {
    if (!nameStr || typeof nameStr !== 'string') return '';
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length <= 1) return nameStr;
    const lastName = parts.pop();
    return `${lastName} ${parts.join(' ')}`;
  };

  const isUserAdminRole = ['admin', 'superadmin', 'assistant', 'super_admin'].includes(String(currentUser?.role).toLowerCase());
  const isUserManagerRole = String(currentUser?.role).toLowerCase() === 'manager';
  const currentUidVal = currentUser?.id ? Number(currentUser.id) : 0;

  const checkMeetingIsDone = (t: any) => {
    if (!t) return false;
    const statusStr = String(t.status || '').toLowerCase();
    const textContent = (String(t.note || '') + ' ' + String(t.description || '') + ' ' + String(t.subject || '') + ' ' + String(t.title || '')).toLowerCase();
    return (
      statusStr === 'done' ||
      statusStr === 'completed' ||
      statusStr === 'da_gap' ||
      t.progress === 100 ||
      textContent.includes('đã gặp') ||
      textContent.includes('hoàn thành gặp')
    );
  };

  const checkMeetingIsOverdue = (t: any) => {
    if (!t || checkMeetingIsDone(t)) return false;
    const dueStr = t.due_date || t.shift_date;
    if (!dueStr) return false;
    const dueDate = new Date(dueStr);
    const now = new Date();
    return dueDate < now;
  };

  const getRelativeDateLabel = (dueDateRaw: string) => {
    if (!dueDateRaw) return '';
    const due = new Date(dueDateRaw);
    if (isNaN(due.getTime())) return '';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    const diffMs = dueStart.getTime() - todayStart.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Ngày mai';
    if (diffDays === -1) return 'Hôm qua';
    if (diffDays > 1) return `${diffDays} ngày tới`;
    return `${Math.abs(diffDays)} ngày trước`;
  };

  const upcomingMeetingsList = useMemo(() => {
    if (!wsTasks || !Array.isArray(wsTasks)) return [];
    
    return wsTasks.filter((t: any) => {
      const isMeeting = t.type === 'meeting' || t.activity_type === 'meeting';
      if (!isMeeting) return false;
      if (t.status === 'cancelled') return false;

      // Data Scoping:
      // Admin / Assistant: see all meetings (admin direct thấy hết)
      if (isUserAdminRole) return true;

      // Manager: team nào thấy team đó
      if (isUserManagerRole) {
        if (wsTeamId && wsTeamId !== 'all_teams_bypass') {
          return String(t.team_id || '') === String(wsTeamId);
        }
        return true;
      }

      // Sale: see own meetings
      const taskAssigneeId = Number(t.assignee_id || t.user_id || t.owner_id || 0);
      return taskAssigneeId === currentUidVal;
    }).sort((a: any, b: any) => {
      const dateA = a.due_date || a.shift_date || a.created_at || '';
      const dateB = b.due_date || b.shift_date || b.created_at || '';
      return dateA.localeCompare(dateB);
    });
  }, [wsTasks, currentUser, isUserAdminRole, isUserManagerRole, wsTeamId, currentUidVal]);

  const meetingSalesOptions = useMemo(() => {
    const map = new Map<string, string>();
    upcomingMeetingsList.forEach((item: any) => {
      const uid = String(item.assignee_id || item.user_id || item.owner_id || item.created_by || '');
      const name = item.assignee_name || item.user_name || item.created_by_name || item.sale_name;
      if (uid && uid !== '0' && name) {
        map.set(uid, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [upcomingMeetingsList]);

  const meetingTeamSelectOptions = useMemo(() => {
    const opts: any[] = [
      {
        value: 'all',
        label: t('Tất cả các Nhóm'),
        icon: (
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #BD1D2D 0%, #E11D48 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
            ALL
          </div>
        )
      }
    ];
    if (Array.isArray(teamsList)) {
      teamsList.forEach((tm: any) => {
        opts.push({
          value: String(tm.id),
          label: tm.name || `Nhóm ${tm.id}`,
          avatar: tm.avatar_url || tm.avatar || ''
        });
      });
    }
    return opts;
  }, [teamsList, t]);

  const meetingSaleSelectOptions = useMemo(() => {
    const opts: any[] = [
      {
        value: 'all',
        label: t('Tất cả Sale / TVV'),
        icon: (
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
            ALL
          </div>
        )
      }
    ];
    meetingSalesOptions.forEach((s: any) => {
      opts.push({
        value: String(s.id),
        label: s.name,
        avatar: s.avatar || ''
      });
    });
    return opts;
  }, [meetingSalesOptions, t]);

  const meetingStatusSelectOptions = useMemo(() => {
    const totalCount = upcomingMeetingsList.length;
    const plannedCount = upcomingMeetingsList.filter(t => !checkMeetingIsDone(t) && !checkMeetingIsOverdue(t)).length;
    const overdueCount = upcomingMeetingsList.filter(t => !checkMeetingIsDone(t) && checkMeetingIsOverdue(t)).length;
    const doneCount = upcomingMeetingsList.filter(t => checkMeetingIsDone(t)).length;

    return [
      { value: 'all', label: `${t('Tất cả')} (${totalCount})` },
      { value: 'planned', label: `${t('Sắp diễn ra')} (${plannedCount})` },
      { value: 'overdue', label: `${t('Quá giờ hẹn')} (${overdueCount})` },
      { value: 'done', label: `${t('Đã gặp')} (${doneCount})` }
    ];
  }, [upcomingMeetingsList, t]);

  const selectedFilterTeam = useMemo(() => {
    if (meetingFilterTeamId === 'all') return null;
    return teamsList.find((t: any) => String(t.id) === String(meetingFilterTeamId));
  }, [teamsList, meetingFilterTeamId]);

  const selectedFilterSale = useMemo(() => {
    if (meetingFilterSaleId === 'all') return null;
    return meetingSalesOptions.find((s: any) => String(s.id) === String(meetingFilterSaleId));
  }, [meetingSalesOptions, meetingFilterSaleId]);

  const filteredUpcomingMeetingsModalList = useMemo(() => {
    let list = upcomingMeetingsList;
    if (meetingFilterStatus === 'planned') {
      list = list.filter(t => !checkMeetingIsDone(t) && !checkMeetingIsOverdue(t));
    } else if (meetingFilterStatus === 'overdue') {
      list = list.filter(t => !checkMeetingIsDone(t) && checkMeetingIsOverdue(t));
    } else if (meetingFilterStatus === 'done') {
      list = list.filter(t => checkMeetingIsDone(t));
    }

    if (meetingFilterTeamId !== 'all') {
      list = list.filter(t => String(t.team_id || '') === String(meetingFilterTeamId));
    }

    if (meetingFilterSaleId !== 'all') {
      list = list.filter(t => {
        const uid = String(t.assignee_id || t.user_id || t.owner_id || '');
        return uid === String(meetingFilterSaleId);
      });
    }

    if (meetingSearchText.trim()) {
      const q = meetingSearchText.toLowerCase().trim();
      list = list.filter(t => {
        const cName = String(t.contact_name || t.lead_name || t.related_name || t.customer_name || '').toLowerCase();
        const cPhone = String(t.phone || t.contact_phone || t.lead_phone || '').toLowerCase();
        const sName = String(t.assignee_name || t.user_name || t.created_by_name || t.sale_name || '').toLowerCase();
        const subj = String(t.subject || t.title || t.note || '').toLowerCase();
        return cName.includes(q) || cPhone.includes(q) || sName.includes(q) || subj.includes(q);
      });
    }
    return list;
  }, [upcomingMeetingsList, meetingFilterStatus, meetingFilterTeamId, meetingFilterSaleId, meetingSearchText]);

  const MEETINGS_PER_PAGE = 20;
  const totalMeetingPages = Math.ceil(filteredUpcomingMeetingsModalList.length / MEETINGS_PER_PAGE) || 1;

  const paginatedUpcomingMeetingsList = useMemo(() => {
    const start = (meetingPage - 1) * MEETINGS_PER_PAGE;
    return filteredUpcomingMeetingsModalList.slice(start, start + MEETINGS_PER_PAGE);
  }, [filteredUpcomingMeetingsModalList, meetingPage]);

  const handleOpenCustomerFromMeetingModal = (meetingItem: any) => {
    setShowUpcomingMeetingsModal(false);
    const targetContactId = Number(meetingItem.contact_id || meetingItem.related_id || meetingItem.lead_id || 0);
    if (targetContactId) {
      handleOpenContactProfile(targetContactId);
    } else {
      toast.error(t('Khách hàng này chưa có mã liên hệ cụ thể'));
    }
  };

  const [isFocusSessionActive, setIsFocusSessionActive] = useState(false);
  const [focusTasksList, setFocusTasksList] = useState<any[]>([]);
  const [focusTaskIndex, setFocusTaskIndex] = useState(0);

  const handleStartFocusSession = () => {
    const currentTasks = wsTasks || [];
    const focusList = currentTasks.filter((t: any) => {
      if (t.status === 'completed' || t.status === 'done') return false;
      const dueDate = t.due_date ? new Date(t.due_date) : null;
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const isOverdueOrToday = dueDate ? dueDate <= today : false;
      const isHighPriority = t.priority === 'high' || t.priority === 'urgent';
      return isOverdueOrToday || isHighPriority;
    }).sort((a: any, b: any) => {
      const priorityWeight: any = { urgent: 3, high: 2, medium: 1, low: 0 };
      const pA = priorityWeight[a.priority] || 0;
      const pB = priorityWeight[b.priority] || 0;
      if (pB !== pA) return pB - pA;
      return new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
    });

    if (focusList.length === 0) {
      alert(t('Tuyệt vời! Bạn không có công việc nào tồn đọng hoặc quá hạn hôm nay.'));
      return;
    }

    setFocusTasksList(focusList);
    setFocusTaskIndex(0);
    setIsFocusSessionActive(true);
    setWsViewMode('focus');
    handleSelectTask(focusList[0]);
  };

  const handleNextFocusTask = () => {
    if (focusTaskIndex < focusTasksList.length - 1) {
      const nextIdx = focusTaskIndex + 1;
      setFocusTaskIndex(nextIdx);
      setSelectedTaskForDetails(focusTasksList[nextIdx]);
    } else {
      setIsFocusSessionActive(false);
      setSelectedTaskForDetails(null);
      alert(t('Chúc mừng! Bạn đã hoàn thành tất cả công việc trong phiên làm việc tập trung.'));
    }
  };

  useEffect(() => {
    setWsTasksPage(1);
  }, [wsSearch, wsPriority, wsStatus, wsDatePreset, wsSubTab, wsTeamSubFilter, wsTaskFilter, wsActivityType, wsRelatedType]);

  useEffect(() => {
    const isFocus = wsViewMode === 'focus';
    const event = new CustomEvent('focus-mode-toggle', { detail: { isFocusMode: isFocus } });
    window.dispatchEvent(event);
  }, [wsViewMode]);

  const parseDescriptionAndChecklist = (descText: string) => {
    const lines = descText ? descText.split('\n') : [];
    const descLines: string[] = [];
    const checklistItems: Array<{ text: string; checked: boolean }> = [];
    
    lines.forEach(line => {
      const match = line.match(/^\s*-\s*\[([ xX])\]\s*(.*)$/);
      if (match) {
        checklistItems.push({
          checked: match[1].toLowerCase() === 'x',
          text: match[2].trim()
        });
      } else {
        descLines.push(line);
      }
    });
    
    return {
      pureDescription: descLines.join('\n').trim(),
      checklist: checklistItems
    };
  };

  const handleSelectTask = (task: any) => {
    if (!task) {
      setSelectedTaskForDetails(null);
      setChecklist([]);
      return;
    }
    const link = task.body && !task.body.startsWith('{"erp_task":') 
      ? (task.body.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m)?.[1]?.trim() || '') 
      : '';
    
    let description = '';
    if (task.body) {
      if (task.body.startsWith('{"erp_task":')) {
        try {
          const parsed = JSON.parse(task.body);
          description = parsed.erp_task?.description || '';
        } catch (e) {
          description = task.body;
        }
      } else {
        description = task.body.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim();
      }
    }
    const parsed = parseDescriptionAndChecklist(description);
    const parsedTask = {
      id: task.id,
      title: task.subject,
      done: task.status === 'done',
      priority: task.priority,
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      link,
      description: parsed.pureDescription,
      user_id: task.user_id,
      user_name: task.user_name || 'Hệ thống',
      tags: task.tags || '',
      participant_ids: task.participant_ids || '',
      progress: task.progress || 0,
      require_approval: task.require_approval || 0,
      approver_id: task.approver_id,
      approval_status: task.approval_status,
      contact_id: task.contact_id,
      contact_name: task.contact_name,
      contact_avatar: task.contact_avatar,
      related_type: task.related_type,
      related_id: task.related_id,
      body: task.body,
      created_by: task.created_by,
      created_by_name: task.created_by_name,
      created_by_avatar: task.created_by_avatar
    };
    setChecklist(parsed.checklist);
    setSelectedTaskForDetails(parsedTask);
  };

  const serializeDescriptionAndChecklist = (pureDesc: string, items: Array<{ text: string; checked: boolean }>) => {
    let result = pureDesc.trim();
    if (items.length > 0) {
      const checklistStr = items.map(item => `- [${item.checked ? 'x' : ' '}] ${item.text}`).join('\n');
      result += (result ? '\n\n' : '') + checklistStr;
    }
    return result;
  };

  const addChecklistItem = () => {
    setChecklist(prev => [...prev, { text: '', checked: false }]);
  };

  const toggleChecklistItem = (idx: number) => {
    setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c));
  };

  const updateChecklistItemText = (idx: number, val: string) => {
    setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, text: val } : c));
  };

  const removeChecklistItem = (idx: number) => {
    setChecklist(prev => prev.filter((_, i) => i !== idx));
  };

  const getPresetDates = (preset: string) => {
    let start = '';
    let end = '';
    if (preset === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      start = todayStr;
      end = todayStr;
    } else if (preset === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomStr = tomorrow.toISOString().slice(0, 10);
      start = tomStr;
      end = tomStr;
    } else if (preset === 'week') {
      const today = new Date();
      const first = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1);
      const monday = new Date(today);
      const sunday = new Date(today);
      sunday.setDate(monday.getDate() + 6);
      start = monday.toISOString().slice(0, 10);
      end = sunday.toISOString().slice(0, 10);
    } else if (preset === '7_days') {
      const now = new Date();
      const startD = new Date();
      startD.setDate(now.getDate() - 7);
      start = startD.toISOString().slice(0, 10);
      end = now.toISOString().slice(0, 10);
    } else if (preset === '30_days') {
      const now = new Date();
      const startD = new Date();
      startD.setDate(now.getDate() - 30);
      start = startD.toISOString().slice(0, 10);
      end = now.toISOString().slice(0, 10);
    } else if (preset === 'this_month') {
      const now = new Date();
      const startD = new Date(now.getFullYear(), now.getMonth(), 1);
      const endD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = startD.toISOString().slice(0, 10);
      end = endD.toISOString().slice(0, 10);
    } else if (preset === 'last_month') {
      const now = new Date();
      const startD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endD = new Date(now.getFullYear(), now.getMonth(), 0);
      start = startD.toISOString().slice(0, 10);
      end = endD.toISOString().slice(0, 10);
    } else if (preset === 'overdue') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      end = yesterday.toISOString().slice(0, 10);
    } else if (preset === 'custom') {
      start = wsStartDate;
      end = wsEndDate;
    }
    return { start, end };
  };

  const filteredWsTasks = useMemo(() => {
    let list = wsTasks;
    const targetUserId = wsUserId ? Number(wsUserId) : Number(currentUser?.id);

    // Filter by Priority
    if (wsPriority && wsPriority !== 'all') {
      list = list.filter(task => task.priority === wsPriority);
    }

    // Filter by Status
    if (wsStatus && wsStatus !== 'all') {
      list = list.filter(task => task.status === wsStatus);
    }

    // Filter by Date Preset
    if (wsDatePreset && wsDatePreset !== 'all') {
      const { start, end } = getPresetDates(wsDatePreset);
      if (wsDatePreset === 'overdue') {
        list = list.filter(task => {
          if (task.status === 'done') return false;
          if (!task.due_date) return false;
          return task.due_date.slice(0, 10) <= end;
        });
      } else {
        list = list.filter(task => {
          if (!task.due_date) return false;
          const dt = task.due_date.slice(0, 10);
          if (start && dt < start) return false;
          if (end && dt > end) return false;
          return true;
        });
      }
    }

    // Filter by main subtabs
    if (wsSubTab === 'customer') {
      list = list.filter(task => task.related_type && ['contact', 'deal', 'company'].includes(task.related_type));
    } else if (wsSubTab === 'personal') {
      list = list.filter(task => task.tags?.split(',').map((t: string) => t.trim()).includes('personal_task'));
    } else if (wsSubTab === 'team') {
      list = list.filter(task => {
        const isClientRelated = task.related_type && ['contact', 'deal', 'company'].includes(task.related_type);
        const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
        const isPersonal = tagsList.includes('personal_task');
        return !isClientRelated && !isPersonal;
      });

      // Filter by team sub-filters (announcements, campaigns, policies, internal tasks)
      if (wsTeamSubFilter !== 'all') {
        const targetTag = `internal_${wsTeamSubFilter}`;
        list = list.filter(task => {
          const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
          return tagsList.includes(targetTag);
        });
      }
    }

    // Apply quick filters (assignee, approver, collaborator)
    if (wsTaskFilter === 'assigned_to_me') {
      list = list.filter(task => Number(task.user_id) === targetUserId);
    } else if (wsTaskFilter === 'approve_by_me') {
      list = list.filter(task => Number(task.require_approval) === 1 && Number(task.approver_id) === targetUserId);
    } else if (wsTaskFilter === 'collaborator') {
      list = list.filter(task => {
        const pIds = task.participant_ids ? task.participant_ids.split(',').map(Number).filter(Boolean) : [];
        return pIds.includes(targetUserId);
      });
    }

    if (!wsSearch) return list;
    const searchVal = wsSearch.toLowerCase();
    return list.filter(task => {
      const subject = task.subject ? String(task.subject).toLowerCase() : '';
      const body = task.body ? String(task.body).toLowerCase() : '';
      const contactName = task.contact_name ? String(task.contact_name).toLowerCase() : '';
      const companyName = task.company_name ? String(task.company_name).toLowerCase() : '';
      const dealName = task.deal_name ? String(task.deal_name).toLowerCase() : '';
      const userName = task.user_name ? String(task.user_name).toLowerCase() : '';
      const teamName = task.team_name ? String(task.team_name).toLowerCase() : '';
      const projectName = task.project_name ? String(task.project_name).toLowerCase() : '';
      const campaignName = task.campaign_name ? String(task.campaign_name).toLowerCase() : '';
      
      // Parse description from JSON body if present
      let description = '';
      if (task.body && task.body.trim().startsWith('{"erp_task":')) {
        try {
          const parsed = JSON.parse(task.body);
          description = (parsed.erp_task?.description || '').toLowerCase();
        } catch (e) {}
      }

      return (
        subject.includes(searchVal) ||
        body.includes(searchVal) ||
        description.includes(searchVal) ||
        contactName.includes(searchVal) ||
        companyName.includes(searchVal) ||
        dealName.includes(searchVal) ||
        userName.includes(searchVal) ||
        teamName.includes(searchVal) ||
        projectName.includes(searchVal) ||
        campaignName.includes(searchVal)
      );
    });
  }, [wsTasks, wsSearch, wsTaskFilter, wsSubTab, wsTeamSubFilter, currentUser, wsUserId, wsPriority, wsStatus, wsDatePreset]);

  const workspaceStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayTime = now.getTime();
    
    let tabTasks = wsTasks;
    if (wsSubTab === 'customer') {
      tabTasks = tabTasks.filter(task => task.related_type && ['contact', 'deal', 'company'].includes(task.related_type));
    } else if (wsSubTab === 'personal') {
      tabTasks = tabTasks.filter(task => task.tags?.split(',').map((t: string) => t.trim()).includes('personal_task'));
    } else if (wsSubTab === 'team') {
      tabTasks = tabTasks.filter(task => {
        const isClientRelated = task.related_type && ['contact', 'deal', 'company'].includes(task.related_type);
        const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
        const isPersonal = tagsList.includes('personal_task');
        return !isClientRelated && !isPersonal;
      });
    }

    let overdue = 0;
    let dueToday = 0;
    let upcoming = 0;
    let pendingApproval = 0;

    tabTasks.forEach(task => {
      // Pending approval
      if (Number(task.require_approval) === 1 && task.approval_status === 'pending' && Number(task.approver_id) === Number(currentUser?.id)) {
        pendingApproval++;
      }

      if (task.status === 'done') return;

      if (task.due_date) {
        const dt = task.due_date.slice(0, 10);
        if (dt === todayStr) {
          dueToday++;
        } else if (dt < todayStr) {
          overdue++;
        } else {
          const taskDate = new Date(dt);
          taskDate.setHours(0, 0, 0, 0);
          const diffDays = (taskDate.getTime() - todayTime) / (1000 * 60 * 60 * 24);
          if (diffDays > 0 && diffDays <= 3) {
            upcoming++;
          }
        }
      }
    });

    return { overdue, dueToday, upcoming, pendingApproval };
  }, [wsTasks, wsSubTab, currentUser]);

  const paginatedWsTasks = useMemo(() => {
    const startIndex = (wsTasksPage - 1) * wsTasksPageSize;
    return filteredWsTasks.slice(startIndex, startIndex + wsTasksPageSize);
  }, [filteredWsTasks, wsTasksPage, wsTasksPageSize]);

  const [loadingWsTasks, setLoadingWsTasks] = useState(false);
  const [wsContacts, setWsContacts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [allowedProjects, setAllowedProjects] = useState<any[]>([]);
  const [allowedCampaigns, setAllowedCampaigns] = useState<any[]>([]);
  const [allowedTeams, setAllowedTeams] = useState<any[]>([]);

  // Task details modal states inside SalePortal
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<any>(null);
  const [taskComments, setTaskComments] = useState<any[]>([]);
  const [loadingTaskComments, setLoadingTaskComments] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: number; userName: string } | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<{ name: string; url: string; type: 'image' | 'file' }[]>([]);
  const [uploadingCommentFile, setUploadingCommentFile] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [showApproverDropdown, setShowApproverDropdown] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (activeTabProp) {
      setActiveTab(activeTabProp);
    }
  }, [activeTabProp]);

  const prevFilteredIdsRef = useRef<string>('');

  // Auto-select first task in Focus Mode when entering or when list changes
  useEffect(() => {
    if (wsViewMode === 'focus') {
      const currentIds = filteredWsTasks.map(t => t.id).join(',');
      const prevIds = prevFilteredIdsRef.current;
      
      if (currentIds !== prevIds) {
        const isStillInList = selectedTaskForDetails && filteredWsTasks.some(t => t.id === selectedTaskForDetails.id);
        if (!selectedTaskForDetails || !isStillInList) {
          if (filteredWsTasks.length > 0) {
            handleSelectTask(filteredWsTasks[0]);
          } else {
            handleSelectTask(null);
          }
        }
        prevFilteredIdsRef.current = currentIds;
      }
    } else {
      prevFilteredIdsRef.current = '';
    }
  }, [wsViewMode, filteredWsTasks, selectedTaskForDetails]);

  const [publicLeads, setPublicLeads] = useState<any[]>([]);
  const [showDeletedFilter, setShowDeletedFilter] = useState<'none' | 'only' | 'all'>('none');
  const [publicLoading, setPublicLoading] = useState(false);
  const [isClaimingLeadId, setIsClaimingLeadId] = useState<number | null>(null);
  const [publicQuota, setPublicQuota] = useState<any>(null);
  const [claimLeadConfirmOpen, setClaimLeadConfirmOpen] = useState(false);
  const [claimLeadPerson, setClaimLeadPerson] = useState<{ id: number; name: string } | null>(null);
  const [adminActionLead, setAdminActionLead] = useState<any | null>(null);

  // Check-in state variables
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [checkInReason, setCheckInReason] = useState('');
  const [todayCheckIn, setTodayCheckIn] = useState<any>(null);
  const [isCheckInLoaded, setIsCheckInLoaded] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Night shift state variables
  const [nightShiftRegistered, setNightShiftRegistered] = useState(false);
  const [nightShiftApproved, setNightShiftApproved] = useState(false);
  const [nightShiftLoading, setNightShiftLoading] = useState(true);
  const [nightShiftCanToggle, setNightShiftCanToggle] = useState(true);
  const [nightShiftDate, setNightShiftDate] = useState('');
  const isTodayWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  const [nightShiftDeadline, setNightShiftDeadline] = useState('');
  const [togglingNightShift, setTogglingNightShift] = useState(false);
  const currentHour = new Date().getHours();
  const isOvertime = (currentHour >= 18 && currentHour < 22) || (currentHour >= 0 && currentHour < 6);

  // Weekend shift state variables
  const [weekendShiftAllow, setWeekendShiftAllow] = useState(false);
  const [weekendShiftSat, setWeekendShiftSat] = useState<any>(null);
  const [weekendShiftSun, setWeekendShiftSun] = useState<any>(null);
  const [weekendShiftLoading, setWeekendShiftLoading] = useState(false);
  const [togglingWeekendShift, setTogglingWeekendShift] = useState<Record<string, boolean>>({});

  // Holiday shift state variables
  const [holidayShifts, setHolidayShifts] = useState<any[]>([]);
  const [holidayShiftLoading, setHolidayShiftLoading] = useState(false);
  const [togglingHolidayShift, setTogglingHolidayShift] = useState<Record<string, boolean>>({});

  // Weekly shift state variables
  const [weeklyShiftDates, setWeeklyShiftDates] = useState<string[]>([]);
  const [weeklySubmitting, setWeeklySubmitting] = useState(false);
  const [weeklyRegistrations, setWeeklyRegistrations] = useState<any[]>([]);
  const [loadingWeeklyRegs, setLoadingWeeklyRegs] = useState(false);
  const [showWeeklyShiftScheduler, setShowWeeklyShiftScheduler] = useState(false);
  const [showWeeklyConfirmModal, setShowWeeklyConfirmModal] = useState(false);

  const executeSubmitWeeklyShifts = async () => {
    if (weeklyShiftDates.length === 0) {
      toast.error(t('Vui lòng chọn ít nhất 1 ngày để đăng ký lịch trực tuần!'));
      return;
    }
    setWeeklySubmitting(true);
    try {
      const res = await fetchAPI('users/weekly-shifts', {
        method: 'POST',
        body: JSON.stringify({
          dates: weeklyShiftDates
        })
      });
      if (res && (res.success || res.status === 'success')) {
        toast.success(t('Đã lưu và gửi đăng ký lịch trực tuần thành công!'));
        setShowWeeklyConfirmModal(false);
      } else {
        toast.error(res?.message || t('Không thể lưu lịch trực tuần'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t('Lỗi kết nối khi lưu lịch trực'));
    } finally {
      setWeeklySubmitting(false);
    }
  };

  // Leave scheduler state
  const [showLeaveScheduler, setShowLeaveScheduler] = useState(false);
  const [showNightShiftConfirmModal, setShowNightShiftConfirmModal] = useState(false);

  const getHourLabel = (timeStr: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    const hr = parseInt(parts[0], 10);
    return isNaN(hr) ? timeStr : `${hr}h`;
  };

  const nightStartHour = getHourLabel(sysSettings?.night_shift_start_time || '18:00');
  const nightEndHour = getHourLabel(sysSettings?.night_shift_end_time || '06:00');

  // Sliding tab indicator
  const [sliderStyle, setSliderStyle] = useState({ top: 0, height: 0 });
  const navContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (navContainerRef.current) {
        const activeBtn = navContainerRef.current.querySelector('[data-active="true"]') as HTMLElement;
        if (activeBtn) {
          setSliderStyle({
            top: activeBtn.offsetTop,
            height: activeBtn.offsetHeight
          });
        } else {
          setSliderStyle({ top: 0, height: 0 });
        }
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activeTab, isCollapsed]);

  // Calendar states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<any>(null);
  const [dayDetailsLoading, setDayDetailsLoading] = useState(false);
  const [activeCalendarModalTab, setActiveCalendarModalTab] = useState<'sales' | 'tickets'>('sales');

  // Ticket detail modal states
  const [selectedDetailTicket, setSelectedDetailTicket] = useState<any>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);

  // Profile settings states
  const [activeProfileTab, setActiveProfileTab] = useState<'personal' | 'erp' | 'contact' | 'payment' | 'emergency' | 'schedule' | 'documents'>('personal');
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editWorkStartTime, setEditWorkStartTime] = useState('08:00');
  const [editWorkEndTime, setEditWorkEndTime] = useState('17:30');
  const [editWorkSchedule, setEditWorkSchedule] = useState<any>(DEFAULT_SCHEDULE);
  const [scheduleMode, setScheduleMode] = useState<'daily' | 'custom'>('daily');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editCitizenId, setEditCitizenId] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [editLeaveStart, setEditLeaveStart] = useState('');
  const [editLeaveEnd, setEditLeaveEnd] = useState('');
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);

  const [profileActiveTab, setProfileActiveTab] = useState(() => window.innerWidth < 768 ? '' : 'personal');
  const profileLoadedIdRef = useRef<string | number | null>(null);

  const [isMobileDateMenuOpen, setIsMobileDateMenuOpen] = useState(false);
  const mobileDateMenuRef = useRef<HTMLDivElement>(null);
  const [showWsTeamFilterDropdown, setShowWsTeamFilterDropdown] = useState(false);
  const [wsTeamFilterSearch, setWsTeamFilterSearch] = useState('');
  const wsTeamFilterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileDateMenuRef.current && !mobileDateMenuRef.current.contains(e.target as Node)) {
        setIsMobileDateMenuOpen(false);
      }
      if (wsTeamFilterDropdownRef.current && !wsTeamFilterDropdownRef.current.contains(e.target as Node)) {
        setShowWsTeamFilterDropdown(false);
      }
    };
    const handleResetAccountTab = () => {
      setProfileActiveTab('');
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('reset-account-tab', handleResetAccountTab);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('reset-account-tab', handleResetAccountTab);
    };
  }, []);

  // Enterprise ERP Profile Extra Fields
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editContractType, setEditContractType] = useState('official');
  const [editDateJoined, setEditDateJoined] = useState('');
  const [editDirectManager, setEditDirectManager] = useState('');
  const [editDirectManagerId, setEditDirectManagerId] = useState('');
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [saleSignatureUrl, setSaleSignatureUrl] = useState<string | null>(user?.signature_url || null);
  const [showSaleSignatureModal, setShowSaleSignatureModal] = useState(false);

  useEffect(() => {
    const fetchUsersList = async () => {
      try {
        const res = await fetchAPI('users?all=1');
        if (res && Array.isArray(res)) {
          setAllUsersList(res);
        } else if (res?.success && Array.isArray(res.data)) {
          setAllUsersList(res.data);
        }
      } catch (err) {
        console.warn('Failed to fetch users list in SalePortal:', err);
      }
    };
    fetchUsersList();
  }, []);

  useEffect(() => {
    if (user?.signature_url) {
      setSaleSignatureUrl(user.signature_url);
    }
  }, [user?.signature_url]);

  const handleSaveSaleSignature = async (newUrl: string) => {
    setSaleSignatureUrl(newUrl);
    setShowSaleSignatureModal(false);
    const uid = user?.id;
    if (uid) {
      try {
        await fetchAPI(`users/${uid}`, {
          method: 'PATCH',
          body: JSON.stringify({ signature_url: newUrl })
        });
        toast.success('Đã lưu chữ ký mẫu thành công');
        updateUser({ signature_url: newUrl });
      } catch (err) {
        console.error(err);
        toast.error('Không thể lưu chữ ký');
      }
    }
  };

  // Password Change & 2FA State
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(Boolean(user?.two_factor_enabled));
  const [twoFactorType, setTwoFactorType] = useState<'email' | 'totp'>((user?.two_factor_type as any) || 'email');
  const [show2FAConfigModal, setShow2FAConfigModal] = useState(false);
  const [setup2FAData, setSetup2FAData] = useState<{ secret: string; otpauth_url: string; backup_codes: string[] } | null>(null);
  const [test2FACode, setTest2FACode] = useState('');
  const [enabling2FA, setEnabling2FA] = useState(false);
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState('');
  const [disabling2FA, setDisabling2FA] = useState(false);

  useEffect(() => {
    if (user) {
      setTwoFactorEnabled(Boolean(user.two_factor_enabled));
      setTwoFactorType((user.two_factor_type as any) || 'email');
    }
  }, [user]);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPass || !newPass || !confirmPass) {
      toast.error(t('Vui lòng điền đầy đủ thông tin mật khẩu'));
      return;
    }
    if (newPass !== confirmPass) {
      toast.error(t('Mật khẩu mới không trùng khớp'));
      return;
    }
    if (newPass.length < 6) {
      toast.error(t('Mật khẩu mới phải có ít nhất 6 ký tự'));
      return;
    }
    setChangingPass(true);
    try {
      const res = await fetchAPI('auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPass, new_password: newPass })
      });
      if (res.success) {
        toast.success(res.message || t('Đổi mật khẩu thành công!'));
        setOldPass('');
        setNewPass('');
        setConfirmPass('');
      } else {
        toast.error(res.message || t('Đổi mật khẩu thất bại'));
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi đổi mật khẩu'));
    }
    setChangingPass(false);
  };

  const handleStart2FASetup = async (type: 'email' | 'totp') => {
    if (type === 'email') {
      try {
        const res = await fetchAPI('users/2fa-enable', {
          method: 'POST',
          body: JSON.stringify({ type: 'email' })
        });
        if (res.success) {
          setTwoFactorType('email');
          setTwoFactorEnabled(true);
          updateUser({ two_factor_enabled: 1, two_factor_type: 'email' });
          toast.success(t('Đã bật xác thực 2 yếu tố qua Email OTP thành công!'));
        } else {
          toast.error(res.message || t('Lỗi kích hoạt 2FA'));
        }
      } catch (err: any) {
        toast.error(err.message || t('Lỗi kết nối'));
      }
    } else {
      try {
        const res = await fetchAPI('users/2fa-setup');
        if (res.success && res.data) {
          setSetup2FAData(res.data);
          setTest2FACode('');
          setShow2FAConfigModal(true);
        } else {
          toast.error(res.message || t('Không thể khởi tạo 2FA Google Authenticator'));
        }
      } catch (err: any) {
        toast.error(err.message || t('Lỗi kết nối'));
      }
    }
  };

  const handleConfirmEnableTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!test2FACode || test2FACode.length < 6) {
      toast.error(t('Vui lòng nhập mã 6 chữ số từ app Google Authenticator'));
      return;
    }
    setEnabling2FA(true);
    try {
      const res = await fetchAPI('users/2fa-enable', {
        method: 'POST',
        body: JSON.stringify({
          type: 'totp',
          code: test2FACode.trim(),
          secret: setup2FAData?.secret,
          backup_codes: setup2FAData?.backup_codes
        })
      });
      if (res.success) {
        setTwoFactorType('totp');
        setTwoFactorEnabled(true);
        updateUser({ two_factor_enabled: 1, two_factor_type: 'totp' });
        toast.success(t('Đã kích hoạt 2FA Google Authenticator thành công!'));
        setShow2FAConfigModal(false);
      } else {
        toast.error(res.message || t('Mã xác nhận không đúng'));
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi kích hoạt 2FA'));
    }
    setEnabling2FA(false);
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disable2FAPassword) {
      toast.error(t('Vui lòng nhập mật khẩu hiện tại'));
      return;
    }
    setDisabling2FA(true);
    try {
      const res = await fetchAPI('users/2fa-disable', {
        method: 'POST',
        body: JSON.stringify({ password: disable2FAPassword })
      });
      if (res.success) {
        setTwoFactorEnabled(false);
        updateUser({ two_factor_enabled: 0 });
        toast.success(t('Đã tắt xác thực 2 yếu tố (2FA)'));
        setShowDisable2FAModal(false);
        setDisable2FAPassword('');
      } else {
        toast.error(res.message || t('Mật khẩu không chính xác'));
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi tắt 2FA'));
    }
    setDisabling2FA(false);
  };
  const [editWorkplace, setEditWorkplace] = useState('');
  const [editPersonalPhone, setEditPersonalPhone] = useState('');
  const [editExtNumber, setEditExtNumber] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyRelation, setEditEmergencyRelation] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editTaxId, setEditTaxId] = useState('');
  const [editInsuranceId, setEditInsuranceId] = useState('');
  const [editBrokerLicense, setEditBrokerLicense] = useState('');
  const [editDegree, setEditDegree] = useState('');

  const [editNationality, setEditNationality] = useState('');
  const [editMaritalStatus, setEditMaritalStatus] = useState('');
  const [editPersonalEmail, setEditPersonalEmail] = useState('');
  const [editHometown, setEditHometown] = useState('');
  const [editBankBranch, setEditBankBranch] = useState('');
  const [openProfileSections, setOpenProfileSections] = useState<Record<string, boolean>>({
    personal: true,
    erp: true,
    contact: true,
    payment: true,
    emergency: false
  });
  const [emergencyContacts, setEmergencyContacts] = useState<{ name: string, relationship: string, phone: string }[]>([{ name: '', relationship: '', phone: '' }]);
  const [profileCertificates, setProfileCertificates] = useState<{ id: string, name: string, code: string, issuer: string, link: string, image: string, issuedDate: string, expiryDate: string }[]>([]);
  const [profileHRRecords, setProfileHRRecords] = useState<{ id: string, type: 'award' | 'warning' | 'discipline', title: string, date: string, amount: string, reason: string, decisionNumber: string, documentLink: string }[]>([]);
  const [editAddressTemporary, setEditAddressTemporary] = useState('');

  const toggleProfileSection = (sec: string) => {
    setOpenProfileSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const [consultantDocs, setConsultantDocs] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Impersonation role calculation for admin viewing sale
  const impersonatedSale = ((user?.role === 'admin' || user?.role === 'superadmin') && saleIdFilter)
    ? data.consultants?.find((c: any) => String(c.id) === String(saleIdFilter))
    : null;

  const displayUser = impersonatedSale ? {
    ...user,
    name: impersonatedSale.name,
    avatar: impersonatedSale.avatar || null,
    email: impersonatedSale.email || '',
    role: 'sale',
    consultant_id: impersonatedSale.id,
    id: impersonatedSale.user_id ? Number(impersonatedSale.user_id) : user?.id
  } : user;

  const targetConsultantId = data.consultant_profile?.id || displayUser?.consultant_id || null;

  const fetchConsultantDocs = async () => {
    if (!targetConsultantId) return;
    try {
      const res = await api.get(`/cloud-files?category=consultant_${targetConsultantId}&limit=1000`);
      if (res.data && res.data.data && res.data.data.items) {
        setConsultantDocs(res.data.data.items);
      }
    } catch (err) {
      console.error("Error fetching consultant documents:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'schedule' && targetConsultantId) {
      fetchConsultantDocs();
    }
  }, [activeTab, targetConsultantId]);

  const effectiveRole = displayUser?.role;

  // Find oldest active offered lead to accept
  const activeIncomingOffer = useMemo(() => {
    if (!['sale', 'manager'].includes(String(effectiveRole).toLowerCase())) return null;
    const unacceptedLeads = (data.leads || []).filter(
      (l: any) => !Number(l.is_accepted) && Number(l.lead_recall_minutes) > 0
    );
    if (unacceptedLeads.length === 0) return null;
    
    const activeOffers = unacceptedLeads.map((lead: any) => {
      const leadRecallMins = Number(lead.lead_recall_minutes) || 0;
      const limitMs = leadRecallMins * 60 * 1000;
      const elapsedMs = now - new Date(lead.last_interaction_date).getTime();
      const remainingMs = limitMs - elapsedMs;
      return { lead, remainingMs };
    }).filter(item => item.remainingMs > 0);

    if (activeOffers.length === 0) return null;
    activeOffers.sort((a, b) => a.remainingMs - b.remainingMs);
    return activeOffers[0];
  }, [data.leads, effectiveRole, now]);

  // Tickets states & loading logic
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState(() => {
    const params = new URLSearchParams(loc.search);
    return params.get('status') || 'all';
  });
  const [ticketDateFilter, setTicketDateFilter] = useState('Tất cả');
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketTotalCount, setTicketTotalCount] = useState(0);
  const TICKET_ITEMS_PER_PAGE = 10;
  const ticketTotalPages = Math.ceil(ticketTotalCount / TICKET_ITEMS_PER_PAGE);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const statusParam = params.get('status');
    if (activeTab === 'tickets' && statusParam) {
      setTicketStatusFilter(statusParam);
    }
  }, [loc.search, activeTab]);

  const loadTicketsData = async () => {
    if (!token) return;
    setTicketsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(ticketPage));
      queryParams.set('pageSize', String(TICKET_ITEMS_PER_PAGE));
      if (ticketStatusFilter !== 'all') {
        queryParams.set('status', ticketStatusFilter);
      }
      if (ticketDateFilter && ticketDateFilter !== 'Tất cả') {
        queryParams.set('date', ticketDateFilter);
      }
      if (displayUser?.consultant_id) {
        queryParams.set('consultant_id', String(displayUser.consultant_id));
      }

      const res = await fetchAPI(`get_reports&${queryParams.toString()}`);
      if (res.success) {
        setTickets(res.data || []);
        setTicketTotalCount(res.total_count ?? 0);
      } else {
        toast.error(res.message || t('Không thể tải danh sách ticket'));
      }
    } catch (err: any) {
      if (err.message !== 'Unauthorized') {
        toast.error(t('Lỗi tải ticket: ') + err.message);
      }
    }
    setTicketsLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'tickets' && token) {
      loadTicketsData();
    }
  }, [token, ticketStatusFilter, ticketDateFilter, ticketPage, activeTab, displayUser?.consultant_id]);

  useEffect(() => {
    setTicketPage(1);
  }, [displayUser?.consultant_id]);

  // Google Login element references
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  // Dynamically load Google Client library
  useEffect(() => {
    if (!document.getElementById('google-jssdk')) {
      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // Initialize Google Login button
  const handleGoogleLoginResponse = async (response: any) => {
    setGoogleLoading(true);
    setGoogleError('');
    setIsAdminMsg('');

    if (localStorage.getItem('RICH LAND_DEMO_MODE') === 'true') {
      await new Promise(resolve => setTimeout(resolve, 500));
      login('demo_token_sale_1', {
        username: 'haidang',
        email: 'haidang@richland.net',
        name: 'Hải Đăng',
        role: 'sale',
        consultant_id: 1,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150'
      });
      toast.success(t('Chào mừng Hải Đăng quay trở lại!'));
      setGoogleLoading(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=login_google_sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const json = await res.json();
      if (json.success) {
        if (json.is_admin) {
          setIsAdminMsg(json.message || t('Bạn là admin, để xem đầy đủ vui lòng truy cập link gốc production.'));
        } else {
          login(json.token, json.user);
          toast.success(t('Chào mừng') + ` ${json.user.name} ` + t('quay trở lại!'));
        }
      } else {
        setGoogleError(json.message || t('Xác thực tài khoản Google thất bại'));
      }
    } catch (e) {
      setGoogleError(t('Không thể kết nối đến máy chủ xác thực Google. Vui lòng thử lại.'));
    }
    setGoogleLoading(false);
  };

  useEffect(() => {
    renderedRef.current = false;
  }, [theme, user]);

  useEffect(() => {
    let intervalId: any;
    const initGoogle = () => {
      if (renderedRef.current) {
        clearInterval(intervalId);
        return;
      }
      if ((window as any).google?.accounts?.id && googleBtnRef.current) {
        (window as any).google.accounts.id.initialize({
          client_id: '641158233158-nsg8a8tdsj3fdgb34dc9tugm8god7tho.apps.googleusercontent.com',
          callback: handleGoogleLoginResponse
        });
        (window as any).google.accounts.id.renderButton(
          googleBtnRef.current,
          { theme: theme === 'dark' ? 'filled_blue' : 'outline', size: 'large', width: 300, text: 'signin_with', shape: 'rectangular' }
        );
        renderedRef.current = true;
        clearInterval(intervalId);
      }
    };

    initGoogle();
    intervalId = setInterval(initGoogle, 500);
    return () => clearInterval(intervalId);
  }, [user, theme]);

  const [portalTasks, setPortalTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [pendingCoopSlips, setPendingCoopSlips] = useState<any[]>([]);
  const [loadingCoops, setLoadingCoops] = useState(false);

  const fetchPortalCoops = async () => {
    if (!token) return;
    setLoadingCoops(true);
    try {
      const res = await fetchAPI('cooperation-slips?pending_sign=1');
      if (res.success) {
        const slips = res.data || [];
        setPendingCoopSlips(slips);
        setPendingCoopsCount(slips.length);
        if (slips.length > 0 && ['sale', 'sales'].includes(effectiveRole) && ['/', '/workspace'].includes(loc.pathname)) {
          navigate(`/cooperation-slips?sign_id=${slips[0].id}`);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCoops(false);
    }
  };

  const fetchPortalTasks = async () => {
    if (!token) return;
    setLoadingTasks(true);
    try {
      const res = await api.get('/activities?status=planned&limit=200');
      if (res.data && res.data.data) {
        const raw = res.data.data.items || res.data.data || [];
        const filtered = raw.filter((item: any) => item.type === 'task' || item.type === 'meeting');
        setPortalTasks(filtered);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTasks(false);
    }
  };

  const triggerRecurrenceCheck = async (tasksList: any[]) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const t of tasksList) {
      if (!t.body || !t.body.startsWith('{"erp_task":') || t.status !== 'done') continue;
      
      try {
        const parsed = JSON.parse(t.body);
        const erp = parsed.erp_task;
        if (!erp || !erp.recurrence || erp.recurrence.pattern === 'none') continue;
        
        // If it was already generated today, skip to prevent loops
        if (erp.recurrence.last_generated === todayStr) continue;

        // Calculate next due date
        const currentDueDate = new Date(t.due_date || t.created_at);
        let nextDueDate = new Date(currentDueDate);

        if (erp.recurrence.pattern === 'daily') {
          nextDueDate.setDate(nextDueDate.getDate() + 1);
        } else if (erp.recurrence.pattern === 'weekly') {
          const wDays = erp.recurrence.weekly_days || [];
          if (wDays.length === 0) {
            nextDueDate.setDate(nextDueDate.getDate() + 7);
          } else {
            let found = false;
            for (let i = 1; i <= 7; i++) {
              const testDate = new Date(currentDueDate);
              testDate.setDate(testDate.getDate() + i);
              if (wDays.includes(testDate.getDay())) {
                nextDueDate = testDate;
                found = true;
                break;
              }
            }
            if (!found) nextDueDate.setDate(nextDueDate.getDate() + 7);
          }
        } else if (erp.recurrence.pattern === 'monthly') {
          const mDay = erp.recurrence.monthly_day || 1;
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          nextDueDate.setDate(mDay);
        } else if (erp.recurrence.pattern === 'custom_days') {
          const daysInterval = Number(erp.recurrence.days_interval || 3);
          nextDueDate.setDate(nextDueDate.getDate() + daysInterval);
        }

        const nextDueDateStr = nextDueDate.toISOString().slice(0, 10);
        
        // Only generate if today >= nextDueDateStr
        if (todayStr >= nextDueDateStr) {
          const newErp = {
            ...erp,
            recurrence: {
              ...erp.recurrence,
              last_generated: ''
            },
            checklist: (erp.checklist || []).map((c: any) => ({ ...c, done: false }))
          };

          await api.post('/activities', {
            subject: t.subject,
            type: 'task',
            priority: t.priority,
            due_date: nextDueDateStr,
            related_type: t.related_type,
            related_id: t.related_id ? Number(t.related_id) : null,
            user_id: t.user_id ? Number(t.user_id) : null,
            body: JSON.stringify({ erp_task: newErp }),
            status: 'planned',
            progress: 0,
            require_approval: t.require_approval,
            approver_id: t.approver_id ? Number(t.approver_id) : null,
            tags: t.tags
          });

          // Update the old task's last_generated to avoid duplicate generation
          const updatedOldErp = {
            ...erp,
            recurrence: {
              ...erp.recurrence,
              last_generated: todayStr
            }
          };
          await api.put(`/activities/${t.id}`, {
            body: JSON.stringify({ erp_task: updatedOldErp })
          });

          toast.success(`Tự động sinh nhiệm vụ định kỳ tiếp theo: ${t.subject}`);
        }
      } catch (err) {
        console.error('Error generating recurring task', err);
      }
    }
  };



  const handleOpenCallsModal = async () => {
    setShowCallsModal(true);
    setCallsModalTab('chart');
    setCallsModalPage(1);
    setLoadingModalCalls(true);
    setCallsSearch('');
    try {
      let { start, end } = getPresetDates(wsDatePreset);
      if (wsDatePreset === 'all') {
        const p7 = getPresetDates('7_days');
        start = p7.start;
        end = p7.end;
      }
      let url = '/activities?type=call&status=done&limit=1000';
      if (start) url += `&start_date=${start}`;
      if (end) url += `&end_date=${end}`;
      
      // If user is Admin/Manager, load team calls; if Sale, load their own calls
      const isManager = currentUser && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'vp', 'leader', 'assistant'].includes(String(currentUser.role).toLowerCase());
      if (wsUserId) {
        url += `&user_id=${wsUserId}`;
      } else if (!isManager) {
        url += `&user_id=${currentUser?.id || user?.id}`;
      }

      const res = await api.get(url);
      if (res.data && res.data.data) {
        const rawCalls = res.data.data.items || res.data.data || [];
        setModalCalls(rawCalls);
      }
    } catch (e) {
      console.error(e);
      toast.error(t('Không thể tải danh sách cuộc gọi'));
    } finally {
      setLoadingModalCalls(false);
    }
  };

  const modalChartData = useMemo(() => {
    if (!modalCalls || modalCalls.length === 0) return [];
    const isManager = currentUser && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'vp', 'leader', 'assistant'].includes(String(currentUser.role).toLowerCase());
    
    if (isManager) {
      const counts: Record<string, number> = {};
      modalCalls.forEach((call: any) => {
        const name = call.user_name || currentUser?.name || 'Tư vấn viên';
        counts[name] = (counts[name] || 0) + 1;
      });
      return Object.entries(counts).map(([name, total]) => ({
        name,
        calls: total
      })).sort((a, b) => b.calls - a.calls);
    } else {
      const counts: Record<string, number> = {};
      modalCalls.forEach((call: any) => {
        if (call.due_date) {
          const dateStr = call.due_date.slice(0, 10);
          counts[dateStr] = (counts[dateStr] || 0) + 1;
        }
      });
      return Object.entries(counts).map(([name, total]) => ({
        name,
        calls: total
      })).sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [modalCalls, currentUser]);

  const filteredCalls = useMemo(() => {
    const s = callsSearch.toLowerCase();
    return modalCalls.filter(c => {
      return (
        (c.subject || '').toLowerCase().includes(s) ||
        (c.body || '').toLowerCase().includes(s) ||
        (c.contact_name || '').toLowerCase().includes(s) ||
        (c.user_name || '').toLowerCase().includes(s)
      );
    });
  }, [modalCalls, callsSearch]);

  const paginatedCalls = useMemo(() => {
    const startIndex = (callsModalPage - 1) * callsModalPageSize;
    return filteredCalls.slice(startIndex, startIndex + callsModalPageSize);
  }, [filteredCalls, callsModalPage, callsModalPageSize]);

  useEffect(() => {
    setCallsModalPage(1);
  }, [callsSearch]);

  const fetchWorkspaceTasks = async () => {
    if (!token) return;
    setLoadingWsTasks(true);
    try {
      let url = '/activities?limit=5000';
      if (wsActivityType && wsActivityType !== 'all') {
        if (wsActivityType !== 'task') {
          url += `&type=${wsActivityType}`;
        }
      }
      if (wsRelatedType) {
        url += `&related_type=${wsRelatedType}`;
      }
      
      if (wsSubTab === 'personal') {
        const targetUid = wsUserId || currentUser?.id;
        if (targetUid) url += `&user_id=${targetUid}`;
      } else {
        if (wsTeamId && wsTeamId !== 'all_teams_bypass') url += `&team_id=${wsTeamId}`;
        if (wsUserId) url += `&user_id=${wsUserId}`;
      }

      const { start, end } = getPresetDates(wsDatePreset);

      const res = await api.get(url);
      if (res.data && res.data.data) {
        let rawTasks = res.data.data.items || res.data.data || [];
        if (wsActivityType === 'task') {
          rawTasks = rawTasks.filter((item: any) => item.type === 'task' || (item.type === 'meeting' && item.status === 'planned'));
        }
        setWsTasks(rawTasks);
        triggerRecurrenceCheck(rawTasks);
      }

      // Fetch completed calls count
      let callsUrl = '/activities?type=call&status=done&limit=1';
      let callsStart = wsDatePreset === 'all' ? '' : start;
      let callsEnd = wsDatePreset === 'all' ? '' : end;
      if (callsStart) callsUrl += `&start_date=${callsStart}`;
      if (callsEnd) callsUrl += `&end_date=${callsEnd}`;
      
      if (wsUserId) {
        callsUrl += `&user_id=${wsUserId}`;
      } else if (['sale', 'manager'].includes(String(currentUser?.role).toLowerCase())) {
        callsUrl += `&user_id=${currentUser?.id}`;
      }

      const callsRes = await api.get(callsUrl);
      if (callsRes.data && callsRes.data.data) {
        setCompletedCallsCount(callsRes.data.data.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWsTasks(false);
    }
  };

  const handleTaskDrop = async (taskId: number, targetCol: 'todo' | 'in_progress' | 'done') => {
    let nextDone = false;
    let nextProgress = 0;
    let nextStatus = 'planned';

    if (targetCol === 'todo') {
      nextDone = false;
      nextProgress = 0;
      nextStatus = 'planned';
    } else if (targetCol === 'in_progress') {
      nextDone = false;
      nextProgress = 50;
      nextStatus = 'planned';
    } else if (targetCol === 'done') {
      nextDone = true;
      nextProgress = 100;
      nextStatus = 'done';
    }

    // Optimistic local state update
    setWsTasks(prev => prev.map(x => x.id === taskId ? { ...x, status: nextStatus, progress: nextProgress } : x));
    
    try {
      await api.put(`/activities/${taskId}`, { 
        progress: nextProgress,
        status: nextStatus
      });
      const colLabel = targetCol === 'todo' ? 'Cần làm' : targetCol === 'in_progress' ? 'Đang làm' : 'Đã xong';
      toast.success(`Đã chuyển công việc sang cột ${colLabel}`);
      if (nextStatus === 'done') {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      }
      fetchWorkspaceTasks();
    } catch (err: any) {
      fetchWorkspaceTasks();
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật tiến độ công việc');
    }
  };

  useEffect(() => {
    if (activeTab === 'workspace') {
      fetchWorkspaceTasks();
    }
  }, [activeTab, wsPriority, wsStatus, wsDatePreset, wsStartDate, wsEndDate, wsTeamId, wsUserId, wsActivityType, wsRelatedType, wsSubTab]);

  useEffect(() => {
    if (activeTab === 'workspace') {
      api.get('/contacts?limit=100').then(res => {
        if (res.data && res.data.data) {
          const items = res.data.data.items || res.data.data || [];
          setWsContacts(items);
        }
      }).catch(() => {});
    }
  }, [activeTab, user?.role]);

  useEffect(() => {
    if (token) {
      const usersEndpoint = '/users?all=1';
      api.get(usersEndpoint).then(r => {
        const d = r.data.data;
        const list = Array.isArray(d) ? d : (d?.items || []);
        const team = list.map((u: any) => ({
          ...u,
          id: u.id,
          full_name: u.full_name || u.name || u.username || '',
          avatar_url: u.avatar_url || u.avatar || '',
          role: u.role || 'sale'
        })).filter((u: any) => {
          if (!u || !u.role) return false;
          const roleLower = u.role.toLowerCase();
          return ['admin', 'superadmin', 'super_admin', 'sales', 'sale', 'manager', 'assistant', 'telesale', 'prescreener', 'director', 'staff', 'employee'].includes(roleLower);
        });
        setUsers(team);
      }).catch(() => {});
      api.get('/projects').then(r => setAllowedProjects(r.data.data || r.data || [])).catch(() => {});
      api.get('/marketing-campaigns').then(r => setAllowedCampaigns(r.data.data?.items || r.data.data || [])).catch(() => {});
      api.get('/teams').then(r => {
        const list = r.data.data || r.data || [];
        setAllowedTeams(list);
        setTeamsList(list);
      }).catch(() => {});
    }
  }, [token, user?.role]);

  const loadTaskComments = async (taskId: number) => {
    setLoadingTaskComments(true);
    try {
      const res = await api.get(`/activities/${taskId}/comments`);
      if (res.data.success) {
        setTaskComments(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTaskComments(false);
    }
  };

  useEffect(() => {
    if (selectedTaskForDetails?.id) {
      loadTaskComments(selectedTaskForDetails.id);
    } else {
      setTaskComments([]);
    }
  }, [selectedTaskForDetails?.id]);

  const renderFormattedText = (text: string) => {
    if (!text) return '';
    // Regex matches URLs or @mentions (supporting unicode characters and parentheses like @Minh_Khôi_(Manager))
    const regex = /(https?:\/\/[^\s]+|@[\p{L}\p{N}_()]+)/gu;
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {part}
          </a>
        );
      } else if (part.startsWith('@')) {
        const cleanName = (n: string) => (n || '').trim().replace(/\s+/g, '_').toLowerCase().replace(/_\([^)]+\)/g, '').replace(/\([^)]+\)/g, '');
        const cleanMentionVal = cleanName(part.substring(1));
        // Look up user to find avatar
        const taggedUser = users.find((u: any) => {
          const normalizedUser = cleanName(u.full_name || u.name || u.fullname || u.username);
          return normalizedUser === cleanMentionVal;
        });

        const displayName = taggedUser?.full_name || part.substring(1).replace(/_/g, ' ');
        const avatarUrl = taggedUser?.avatar_url || taggedUser?.avatar;
        const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

        return (
          <span
            key={index}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#dc2626', // Red text
              background: 'rgba(239, 68, 68, 0.08)', // Light red background tint
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '2px 8px',
              borderRadius: '9999px',
              margin: '0 2px',
              fontWeight: 600,
              fontSize: '0.85em',
              verticalAlign: 'middle'
            }}
          >
            <Avatar name={displayName} src={avatarUrl} size={16} />
            @{displayName}
          </span>
        );
      }
      return part;
    });
  };

  const handleCommentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('Dung lượng tệp tối đa cho phép là 10MB'));
      return;
    }
    setUploadingCommentFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    formData.append('category', 'comment');
    formData.append('visibility', 'shared');
    
    try {
      const uploadRes = await api.post('/cloud-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (uploadRes.data.success && uploadRes.data.data) {
        const fileUrl = uploadRes.data.data.path;
        const type = file.type.startsWith('image/') ? 'image' : 'file';
        setPendingAttachments(prev => [...prev, { name: file.name, url: fileUrl, type }]);
        toast.success(t('Đính kèm tệp thành công'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t('Lỗi khi đính kèm tệp'));
    } finally {
      setUploadingCommentFile(false);
      e.target.value = '';
    }
  };

  const handlePostTaskComment = async () => {
    if ((!newCommentText.trim() && pendingAttachments.length === 0) || !selectedTaskForDetails) return;
    try {
      const res = await api.post(`/activities/${selectedTaskForDetails.id}/comments`, {
        content: newCommentText.trim(),
        attachments: pendingAttachments,
        parent_id: replyTo ? replyTo.id : null
      });
      if (res.data.success) {
        setNewCommentText('');
        setPendingAttachments([]);
        setReplyTo(null);
        loadTaskComments(selectedTaskForDetails.id);
      }
    } catch (e) {
      console.error(e);
      toast.error(t('Lỗi khi thêm bình luận'));
    }
  };

  const handleDeleteTaskComment = (commentId: number) => {
    showConfirm({
      title: t('Xóa bình luận'),
      message: t('Bạn có chắc chắn muốn xóa bình luận này không?'),
      confirmText: t('Xóa'),
      cancelText: t('Hủy'),
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.delete(`/activities/comments/${commentId}`);
          if (res.data.success) {
            toast.success(t('Đã xóa bình luận thành công!'));
            loadTaskComments(selectedTaskForDetails.id);
          }
        } catch (e) {
          console.error(e);
          toast.error(t('Lỗi khi xóa bình luận'));
        }
      }
    });
  };

  const resolveAttachmentUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = api.defaults.baseURL || '';
    const cleanBase = base.replace(/\/api\/?$/, '');
    return `${cleanBase}/${path}`;
  };

  const handleDetailTaskFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTaskForDetails) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('Dung lượng tệp tối đa cho phép là 10MB'));
      return;
    }
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    formData.append('category', 'general');
    formData.append('visibility', 'shared');
    if (selectedTaskForDetails.related_type === 'contact' && selectedTaskForDetails.related_id) {
      formData.append('contact_id', selectedTaskForDetails.related_id.toString());
    }
    try {
      const uploadRes = await api.post('/cloud-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (uploadRes.data.success && uploadRes.data.data) {
        const fileUrl = uploadRes.data.data.path;
        setSelectedTaskForDetails(prev => prev ? { ...prev, link: fileUrl } : null);
        toast.success(t('Đính kèm tệp thành công'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t('Lỗi khi tải tệp lên'));
    } finally {
      setUploadingFile(false);
    }
  };

  const closeTaskDetailsModal = () => {
    setSelectedTaskForDetails(null);
    setShowAssigneeDropdown(false);
    setShowParticipantDropdown(false);
    setShowApproverDropdown(false);
  };

  const handleSaveAllTaskDetails = async () => {
    if (!selectedTaskForDetails) return;
    setIsUpdatingTask(true);
    try {
      const payload: any = {
        subject: selectedTaskForDetails.title,
        body: serializeDescriptionAndChecklist(selectedTaskForDetails.description || '', checklist) + (selectedTaskForDetails.link ? `\n\nTài liệu/Link đính kèm: ${selectedTaskForDetails.link}` : ''),
        user_id: selectedTaskForDetails.user_id,
        status: selectedTaskForDetails.status,
        priority: selectedTaskForDetails.priority,
        due_date: selectedTaskForDetails.due_date,
        tags: selectedTaskForDetails.tags,
        participant_ids: selectedTaskForDetails.participant_ids,
        progress: selectedTaskForDetails.progress,
        require_approval: selectedTaskForDetails.require_approval,
        approver_id: selectedTaskForDetails.approver_id,
        approval_status: selectedTaskForDetails.approval_status
      };

      const nextProgress = selectedTaskForDetails.progress || 0;
      const nextReqApproval = selectedTaskForDetails.require_approval || 0;
      const nextApprovalStatus = selectedTaskForDetails.approval_status;

      if (nextProgress === 100) {
        if (nextReqApproval === 1) {
          if (nextApprovalStatus === 'approved') {
            payload.status = 'done';
            payload.approval_status = 'approved';
          } else if (nextApprovalStatus === 'rejected') {
            payload.status = 'planned';
            payload.approval_status = 'rejected';
            payload.progress = 90;
          } else {
            payload.status = 'planned';
            payload.approval_status = 'pending';
          }
        } else {
          payload.status = 'done';
          payload.approval_status = null;
        }
      } else {
        payload.status = 'planned';
        payload.approval_status = null;
      }

      const res = await api.put(`/activities/${selectedTaskForDetails.id}`, payload);
      if (res.status === 200) {
        toast.success(t('Đã lưu công việc thành công'));
        setSelectedTaskForDetails(null);
        fetchWorkspaceTasks();
      }
    } catch (e) {
      console.error(e);
      toast.error(t('Lỗi khi lưu công việc'));
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleUpdateTaskDetail = async (updatedFields: any) => {
    if (!selectedTaskForDetails) return;
    setIsUpdatingTask(true);
    try {
      const payload: any = {};
      if ('title' in updatedFields) payload.subject = updatedFields.title;
      
      const currentDesc = 'description' in updatedFields ? updatedFields.description : (selectedTaskForDetails.description || '');
      const currentLink = 'link' in updatedFields ? updatedFields.link : (selectedTaskForDetails.link || '');
      
      if ('description' in updatedFields || 'link' in updatedFields || 'checklist' in updatedFields) {
        const listItems = 'checklist' in updatedFields ? updatedFields.checklist : checklist;
        const finalDescription = serializeDescriptionAndChecklist(currentDesc, listItems);
        payload.body = finalDescription + (currentLink ? `\n\nTài liệu/Link đính kèm: ${currentLink}` : '');
      }

      const directFields = ['user_id', 'status', 'priority', 'due_date', 'tags', 'participant_ids', 'progress', 'require_approval', 'approver_id', 'approval_status'];
      directFields.forEach(f => {
        if (f in updatedFields) payload[f] = updatedFields[f];
      });

      if ('user_id' in updatedFields) {
        const newAssigneeId = String(updatedFields.user_id);
        const currentParticipants = (selectedTaskForDetails.participant_ids || '').split(',').filter(Boolean);
        const nextParticipants = currentParticipants.filter(id => id !== newAssigneeId);
        payload.participant_ids = nextParticipants.join(',');
        updatedFields.participant_ids = payload.participant_ids;
      }

      const nextProgress = 'progress' in updatedFields ? updatedFields.progress : selectedTaskForDetails.progress;
      const nextReqApproval = 'require_approval' in updatedFields ? updatedFields.require_approval : selectedTaskForDetails.require_approval;
      const nextApprovalStatus = 'approval_status' in updatedFields ? updatedFields.approval_status : selectedTaskForDetails.approval_status;

      if (nextProgress === 100) {
        if (nextReqApproval === 1) {
          if (nextApprovalStatus === 'approved') {
            payload.status = 'done';
            payload.approval_status = 'approved';
            updatedFields.status = 'done';
            updatedFields.approval_status = 'approved';
          } else if (nextApprovalStatus === 'rejected') {
            payload.status = 'planned';
            payload.approval_status = 'rejected';
            payload.progress = 90;
            updatedFields.status = 'planned';
            updatedFields.approval_status = 'rejected';
            updatedFields.progress = 90;
          } else {
            payload.status = 'planned';
            payload.approval_status = 'pending';
            updatedFields.status = 'planned';
            updatedFields.approval_status = 'pending';
          }
        } else {
          payload.status = 'done';
          payload.approval_status = null;
          updatedFields.status = 'done';
          updatedFields.approval_status = null;
        }
      } else {
        payload.status = 'planned';
        payload.approval_status = null;
        updatedFields.status = 'planned';
        updatedFields.approval_status = null;
      }

      const res = await api.put(`/activities/${selectedTaskForDetails.id}`, payload);
      if (res.status === 200) {
        setSelectedTaskForDetails((prev: any) => ({ ...prev, ...updatedFields }));
        fetchWorkspaceTasks();
      }
    } catch (err: any) {
      toast.error(t('Lỗi khi cập nhật công việc'));
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleToggleTaskStatus = async (taskId: number) => {
    try {
      await api.put(`/activities/${taskId}`, { status: 'done' });
      toast.success(t('Đã hoàn thành công việc'));
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      fetchPortalTasks();
    } catch (e) {
      toast.error(t('Lỗi khi cập nhật trạng thái công việc'));
    }
  };


  const handleReleaseToDatabank = (leadId: number, contactId?: number) => {
    showConfirm({
      title: t('Nhả khách về Kho chung'),
      message: t('Bạn có chắc chắn muốn nhả khách hàng này về Kho chung (Databank)? Việc này sẽ thu hồi quyền sở hữu của các tư vấn viên hiện tại.'),
      confirmText: t('Nhả về Kho chung'),
      cancelText: t('Hủy'),
      isDanger: true,
      onConfirm: async () => {
        setIsReleasingLead(true);
        try {
          let res;
          if (contactId) {
            res = await fetchAPI(`contacts/${contactId}/release-databank`, {
              method: 'POST'
            });
            if (res && !res.hasOwnProperty('success')) {
              res = { success: true, message: res.message || t('Đã nhả về Kho chung thành công!') };
            }
          } else {
            res = await fetchAPI('release_to_databank', {
              method: 'POST',
              body: JSON.stringify({ lead_id: leadId })
            });
          }
          if (res.success || res.action) {
            toast.success(res.message || t('Đã nhả về Kho chung thành công!'));
            setDetailModalOpen(false);
            setActiveDetailLead(null);
            loadPortalData();
          } else {
            toast.error(res.message || t('Lỗi khi nhả về Kho chung.'));
          }
        } catch (e: any) {
          toast.error(t('Lỗi kết nối') + ': ' + e.message);
        } finally {
          setIsReleasingLead(false);
        }
      }
    });
  };

  // Fetch portal data when token is valid
  const loadPortalData = async (isSilent = false) => {
    if (!token || !ALLOWED_PORTAL_ROLES.includes(user?.role || '')) return;
    const activePaths = ['/', '/workspace', '/account', '/calendar', '/databank', '/fair-share'];
    if (!activePaths.includes(loc.pathname)) return;
    if (!isSilent && !data?.consultant_profile && loc.pathname !== '/account') setLoading(true);
    fetchPortalTasks();
    fetchPortalCoops();

    if (!isSilent) {
      loadCheckInStatus();
      loadNightShiftStatus();
      loadWeekendShiftStatus();
      loadHolidayShiftStatus();
      loadWeeklyRegistrations();
    }
    try {
      let query = `get_sale_portal_data&search=${encodeURIComponent(search)}&round_id=${roundId}&date_mode=${dateMode}&sale_id=${saleIdFilter}`;
      if (dateMode === 'custom') {
        query += `&start_date=${startDate}&end_date=${endDate}`;
      }
      const json = await fetchAPI(query);
      if (json.success) {
        setData(json);
        if (json.vacation_mode !== undefined) setPortalVacationMode(Boolean(Number(json.vacation_mode)));
      } else {
        if (!isSilent) toast.error(json.message || t('Không thể tải dữ liệu'));
      }
    } catch (err: any) {
      if (!isSilent && err.message !== 'Unauthorized') {
        toast.error(t('Lỗi tải dữ liệu: ') + err.message);
      }
    }
    if (!isSilent) setLoading(false);
  };

  const [togglingVacation, setTogglingVacation] = useState(false);

  const handleTogglePortalVacation = async () => {
    if (togglingVacation) return;
    try {
      setTogglingVacation(true);
      const json = await fetchAPI('toggle_consultant_vacation', {
        method: 'POST',
        body: JSON.stringify({ id: displayUser?.consultant_id })
      });
      if (json.success) {
        toast.success(t('Đã thay đổi trạng thái Tạm ngưng'));
        const nextMode = Boolean(Number(json.vacation_mode));
        setPortalVacationMode(nextMode);
        window.dispatchEvent(new CustomEvent('vacation-status-changed', { detail: nextMode }));
      } else {
        toast.error(json.message || t('Lỗi thay đổi trạng thái'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setTogglingVacation(false);
    }
  };

  const loadCheckInStatus = async () => {
    if (!token) return;
    try {
      const res = await fetchAPI('check-ins&today_only=1');
      if (res.success) {
        setTodayCheckIn(res.data);
        window.dispatchEvent(new CustomEvent('checkin-status-changed'));
      }
    } catch (err) {
      console.error("Error loading check-in status:", err);
    } finally {
      setIsCheckInLoaded(true);
    }
  };

  const loadNightShiftStatus = async () => {
    if (!token) return;
    setNightShiftLoading(true);
    try {
      const res = await fetchAPI('get_night_shift_status');
      if (res.success) {
        setNightShiftRegistered(res.registered);
        setNightShiftApproved(res.approved === 1 || res.approved === true);
        setNightShiftCanToggle(res.can_toggle);
        setNightShiftDate(res.shift_date);
        setNightShiftDeadline(res.deadline_time || '');
      }
    } catch (e) {
      console.error("Error loading night shift status:", e);
    } finally {
      setNightShiftLoading(false);
    }
  };

  const handleToggleNightShift = async () => {
    if (togglingNightShift) return;
    setTogglingNightShift(true);
    try {
      const res = await fetchAPI('register_night_shift', {
        method: 'POST',
        body: JSON.stringify({ register: !nightShiftRegistered })
      });
      if (res.success) {
        toast.success(res.message);
        setNightShiftRegistered(!nightShiftRegistered);
        if (res.pending) {
          setNightShiftApproved(false);
        } else {
          setNightShiftApproved(!nightShiftRegistered);
        }
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(t('Lỗi đăng ký: ') + e.message);
    } finally {
      setTogglingNightShift(false);
    }
  };

  const loadWeekendShiftStatus = async () => {
    if (!token) return;
    setWeekendShiftLoading(true);
    try {
      const res = await fetchAPI('get_weekend_shift_status');
      if (res.success) {
        setWeekendShiftAllow(res.allow_weekend_registration);
        setWeekendShiftSat(res.saturday);
        setWeekendShiftSun(res.sunday);
      }
    } catch (e) {
      console.error("Error loading weekend shift status:", e);
    } finally {
      setWeekendShiftLoading(false);
    }
  };

  const handleToggleWeekendShift = async (dateStr: string, currentRegistered: boolean) => {
    if (togglingWeekendShift[dateStr]) return;
    setTogglingWeekendShift(prev => ({ ...prev, [dateStr]: true }));
    try {
      const res = await fetchAPI('register_weekend_shift', {
        method: 'POST',
        body: JSON.stringify({ date: dateStr, register: !currentRegistered })
      });
      if (res.success) {
        toast.success(res.message);
        loadWeekendShiftStatus();
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(t('Lỗi đăng ký: ') + e.message);
    } finally {
      setTogglingWeekendShift(prev => ({ ...prev, [dateStr]: false }));
    }
  };

  const loadHolidayShiftStatus = async () => {
    if (!token) return;
    setHolidayShiftLoading(true);
    try {
      const res = await fetchAPI('get_holiday_shift_status');
      if (res.success) {
        setHolidayShifts(res.holidays || []);
      }
    } catch (e) {
      console.error("Error loading holiday shift status:", e);
    } finally {
      setHolidayShiftLoading(false);
    }
  };

  const handleToggleHolidayShift = async (holidayName: string, dateStr: string, currentRegistered: boolean) => {
    if (togglingHolidayShift[dateStr]) return;
    setTogglingHolidayShift(prev => ({ ...prev, [dateStr]: true }));
    try {
      const res = await fetchAPI('register_holiday_shift', {
        method: 'POST',
        body: JSON.stringify({ holiday_name: holidayName, date: dateStr, register: !currentRegistered })
      });
      if (res.success) {
        toast.success(res.message);
        loadHolidayShiftStatus();
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(t('Lỗi đăng ký: ') + e.message);
    } finally {
      setTogglingHolidayShift(prev => ({ ...prev, [dateStr]: false }));
    }
  };

  // Weekly shift helpers
  const getWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
    const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayDiff);

    const weekdays = [
      t('Thứ Hai'),
      t('Thứ Ba'),
      t('Thứ Tư'),
      t('Thứ Năm'),
      t('Thứ Sáu'),
      t('Thứ Bảy'),
      t('Chủ Nhật')
    ];

    return weekdays.map((name, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      return {
        name,
        date: dateStr,
        dayIndex: i
      };
    });
  };

  const loadWeeklyRegistrations = async () => {
    if (!token) return;
    setLoadingWeeklyRegs(true);
    try {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + mondayDiff);
      const startStr = monday.toISOString().split('T')[0];

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const endStr = sunday.toISOString().split('T')[0];

      const res = await fetchAPI(`check-ins&start_date=${startStr}&end_date=${endStr}&include_shifts=1`);
      if (res.success && res.data && res.data.shifts) {
        const myShifts = res.data.shifts.filter((s: any) => String(s.user_id) === String(user?.id));
        setWeeklyRegistrations(myShifts);
        const registeredDates = myShifts.map((s: any) => s.shift_date);
        setWeeklyShiftDates(registeredDates);
      }
    } catch (e) {
      console.error("Error loading weekly registrations:", e);
    } finally {
      setLoadingWeeklyRegs(false);
    }
  };

  const handleSubmitWeeklyShifts = async () => {
    if (weeklySubmitting) return;
    setWeeklySubmitting(true);
    try {
      const res = await fetchAPI('register_weekly_shifts', {
        method: 'POST',
        body: JSON.stringify({ dates: weeklyShiftDates })
      });
      if (res.success) {
        toast.success(t('Đăng ký lịch tuần thành công và đang chờ Admin duyệt!'));
        loadWeeklyRegistrations();
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(t('Lỗi gửi đăng ký: ') + e.message);
    } finally {
      setWeeklySubmitting(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setCapturedImage(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(t('Không thể truy cập camera. Vui lòng cấp quyền hoặc tải ảnh lên thay thế.'));
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(err => console.log('SalePortal camera play error:', err));
    }
  }, [cameraStream, isCameraActive]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const checkIsLate = () => {
    const workStart = impersonatedSale
      ? (impersonatedSale.work_start_time || '08:00')
      : (data.consultant_profile?.work_start_time || '08:00');
    const now = new Date();
    const curHM = now.toTimeString().substring(0, 5); 
    return curHM > workStart;
  };
  const isLate = checkIsLate();

  const fetchPublicLeads = async () => {
    setPublicLoading(true);
    setDatabankPage(1);
    setSelectedPublicLeads([]);
    try {
      const res = await fetchAPI(`get_public_leads&show_deleted=${showDeletedFilter}`);
      if (res.success) {
        setPublicLeads(res.data || []);
        if (res.quota) {
          setPublicQuota(res.quota);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPublicLoading(false);
    }
  };

  const handleDeletePublicLeads = (personIds: number[]) => {
    if (personIds.length === 0) return;
    showConfirm({
      title: t('Ẩn/Xóa khỏi Databank'),
      message: t('Bạn có chắc chắn muốn ẩn/xóa') + ' ' + personIds.length + ' ' + t('khách hàng đã chọn khỏi Kho chung (Databank)? Quản trị viên có thể tìm lại ở bộ lọc Lịch sử ẩn/xóa.'),
      confirmText: t('Ẩn/Xóa ngay'),
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI('delete_public_leads', {
            method: 'POST',
            body: JSON.stringify({ person_ids: personIds })
          });
          if (res && res.success) {
            toast.success(res.message || t('Đã ẩn dữ liệu thành công'));
            setSelectedPublicLeads([]);
            fetchPublicLeads();
          } else {
            toast.error(res ? res.message : t('Ẩn dữ liệu thất bại'));
          }
        } catch (e: any) {
          toast.error(t('Lỗi: ') + e.message);
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const handleRestorePublicLeads = (personIds: number[]) => {
    if (personIds.length === 0) return;
    showConfirm({
      title: t('Khôi phục hiển thị Databank'),
      message: t('Bạn có chắc chắn muốn khôi phục hiển thị cho') + ' ' + personIds.length + ' ' + t('khách hàng đã chọn trong Kho chung (Databank)?'),
      confirmText: t('Khôi phục'),
      isDanger: false,
      onConfirm: async () => {
        try {
          const res = await fetchAPI('restore_public_leads', {
            method: 'POST',
            body: JSON.stringify({ person_ids: personIds })
          });
          if (res && res.success) {
            toast.success(res.message || t('Đã khôi phục dữ liệu thành công'));
            setSelectedPublicLeads([]);
            fetchPublicLeads();
          } else {
            toast.error(res ? res.message : t('Khôi phục thất bại'));
          }
        } catch (e: any) {
          toast.error(t('Lỗi: ') + e.message);
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const handleBlockPublicLeads = (personIds: number[]) => {
    if (personIds.length === 0) return;
    showConfirm({
      title: t('Chặn liên hệ vĩnh viễn'),
      message: t('Bạn có chắc chắn muốn chặn vĩnh viễn') + ' ' + personIds.length + ' ' + t('khách hàng đã chọn? Hệ thống sẽ ẩn liên hệ khỏi Databank và ngăn chặn việc đẩy lại sau này dựa trên Số điện thoại/Email.'),
      confirmText: t('Chặn vĩnh viễn'),
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI('block_public_leads', {
            method: 'POST',
            body: JSON.stringify({ person_ids: personIds })
          });
          if (res && res.success) {
            toast.success(res.message || t('Đã chặn liên hệ thành công'));
            setSelectedPublicLeads([]);
            fetchPublicLeads();
          } else {
            toast.error(res ? res.message : t('Chặn liên hệ thất bại'));
          }
        } catch (e: any) {
          toast.error(t('Lỗi: ') + e.message);
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const handleUnblockPublicLeads = (personIds: number[]) => {
    if (personIds.length === 0) return;
    showConfirm({
      title: t('Hủy chặn liên hệ'),
      message: t('Bạn có chắc chắn muốn bỏ chặn cho') + ' ' + personIds.length + ' ' + t('khách hàng đã chọn?'),
      confirmText: t('Bỏ chặn'),
      isDanger: false,
      onConfirm: async () => {
        try {
          const res = await fetchAPI('unblock_public_leads', {
            method: 'POST',
            body: JSON.stringify({ person_ids: personIds })
          });
          if (res && res.success) {
            toast.success(res.message || t('Đã bỏ chặn liên hệ thành công'));
            setSelectedPublicLeads([]);
            fetchPublicLeads();
          } else {
            toast.error(res ? res.message : t('Bỏ chặn thất bại'));
          }
        } catch (e: any) {
          toast.error(t('Lỗi: ') + e.message);
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const handleClaimLead = (personId: number, personName?: string) => {
    setClaimLeadPerson({ id: personId, name: personName || t('Khách hàng này') });
    setClaimLeadConfirmOpen(true);
  };

  const handleExecuteClaimLead = async () => {
    if (!claimLeadPerson) return;
    const personId = claimLeadPerson.id;
    setIsClaimingLeadId(personId);
    try {
      const json = await fetchAPI('claim_public_lead', {
        method: 'POST',
        body: JSON.stringify({ person_id: personId })
      });
      if (json.success) {
        toast.success(json.message || t('Nhận data thành công!'));
        setClaimLeadConfirmOpen(false);
        fetchPublicLeads();
        loadPortalData();
        if (json.contact_id) {
          navigate('/contacts?open_contact_id=' + json.contact_id);
        }
      } else {
        toast.error(json.message || t('Nhận data thất bại'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    } finally {
      setIsClaimingLeadId(null);
    }
  };



  useEffect(() => {
    const handleContactUpdated = () => {
      loadPortalData(true);
    };
    const handleNewNotif = () => {
      loadPortalData(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadPortalData(true);
      }
    };

    window.addEventListener('contact-updated', handleContactUpdated);
    window.addEventListener('new-notification-received', handleNewNotif);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('contact-updated', handleContactUpdated);
      window.removeEventListener('new-notification-received', handleNewNotif);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token]);

  useEffect(() => {
    if (activeTab === 'databank') {
      fetchPublicLeads();
    }
  }, [activeTab, showDeletedFilter]);

  const handleSubmitCheckIn = async (fileToUpload?: File) => {
    setCheckInSubmitting(true);
    try {
      let selfieUrl = '';
      
      if (fileToUpload) {
        const compressedFile = await compressToWebP(fileToUpload);
        const formData = new FormData();
        formData.append('file', compressedFile);
        const uploadRes = await fetchAPI('upload', {
          method: 'POST',
          body: formData
        });
        if (uploadRes.success && uploadRes.data?.url) {
          selfieUrl = uploadRes.data.url;
        } else {
          toast.error(uploadRes.message || t('Lỗi tải ảnh lên'));
          setCheckInSubmitting(false);
          return;
        }
      } else if (capturedImage) {
        const compressToWebP = (dataUrl: string): Promise<Blob> => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((b) => {
                  if (b) resolve(b);
                  else reject(new Error('WebP conversion failed'));
                }, 'image/webp', 0.8); // 80% quality compression
              } else {
                reject(new Error('Canvas context error'));
              }
            };
            img.onerror = () => reject(new Error('Image loading error'));
          });
        };

        const webpBlob = await compressToWebP(capturedImage);
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
        const saleName = (user?.name || displayUser?.name || 'selfie').replace(/[^a-zA-Z0-9\s\u00C0-\u1EF9]/g, '').trim().replace(/\s+/g, '_');
        const fileName = `${saleName}_${timestamp}.webp`;
        const file = new File([webpBlob], fileName, { type: 'image/webp' });
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetchAPI('upload', {
          method: 'POST',
          body: formData
        });
        if (uploadRes.success && uploadRes.data?.url) {
          selfieUrl = uploadRes.data.url;
        } else {
          toast.error(uploadRes.message || t('Lỗi tải ảnh lên'));
          setCheckInSubmitting(false);
          return;
        }
      } else {
        toast.error(t('Vui lòng chụp hình selfie hoặc tải ảnh lên.'));
        setCheckInSubmitting(false);
        return;
      }

      if (isLate && !checkInReason.trim()) {
        toast.error(t('Bạn đi trễ. Vui lòng điền lý do để quản lý duyệt.'));
        setCheckInSubmitting(false);
        return;
      }

      const res = await fetchAPI('check-ins', {
        method: 'POST',
        body: JSON.stringify({
          selfie_url: selfieUrl,
          reason: isLate ? checkInReason : null
        })
      });

      if (res.success) {
        toast.success(res.message || t('Check-in thành công!'));
        setCheckInModalOpen(false);
        setCapturedImage(null);
        setCheckInReason('');
        loadCheckInStatus();
        loadPortalData();
      } else {
        toast.error(res.message || t('Check-in thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi check-in: ') + err.message);
    }
    setCheckInSubmitting(false);
  };



  useEffect(() => {
    const handleVacationChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setPortalVacationMode(customEvent.detail);
    };
    window.addEventListener('vacation-status-changed', handleVacationChange);
    return () => {
      window.removeEventListener('vacation-status-changed', handleVacationChange);
    };
  }, []);

  const handleOpenContactProfile = async (contactId: number, tab: string = 'info') => {
    if (!contactId) return;
    setProfileDrawerTab(tab);
    try {
      const res = await api.get(`/contacts/${contactId}`);
      if (res.data.success && res.data.data) {
        setProfileContact(res.data.data);
      } else {
        toast.error(t('Không thể lấy chi tiết liên hệ'));
      }
    } catch (e: any) {
      console.error(e);
      toast.error(t('Lỗi khi tải thông tin khách hàng'));
    }
  };

  const handleAcceptLead = async (leadId: number) => {
    try {
      const json = await fetchAPI('accept_lead', {
        method: 'POST',
        body: JSON.stringify({ lead_id: leadId })
      });
      if (json.success) {
        toast.success(t('Tiếp nhận lead thành công!'));
        loadPortalData();
      } else {
        toast.error(json.message || t('Lỗi tiếp nhận lead'));
        loadPortalData();
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    }
  };

  useEffect(() => {
    if (data.consultant_profile) {
      const currentProfileId = data.consultant_profile.id || 'current';
      if (profileLoadedIdRef.current !== currentProfileId) {
        profileLoadedIdRef.current = currentProfileId;

        const isSaleOrManager = ['sale', 'manager'].includes(String(displayUser?.role || user?.role).toLowerCase());
        const isMobileViewport = window.innerWidth <= 1024;
        if (isMobileViewport) {
          setProfileActiveTab('');
        } else {
          setProfileActiveTab(isSaleOrManager ? 'schedule' : 'personal');
        }
        setEditName(data.consultant_profile.name || '');
        setEditAvatar(data.consultant_profile.avatar || '');
        const fallbackStart = sysSettings?.global_work_start_time || '08:00';
        const fallbackEnd = sysSettings?.global_work_end_time || '17:30';

        setEditWorkStartTime(data.consultant_profile.work_start_time || fallbackStart);
        setEditWorkEndTime(data.consultant_profile.work_end_time || fallbackEnd);
        setEditDob(data.consultant_profile.dob || '');
        setEditGender(data.consultant_profile.gender || '');
        setEditCitizenId(data.consultant_profile.citizen_id || '');
        
        const rawAddress = data.consultant_profile.address || '';
        if (rawAddress.startsWith('{"erp_profile":')) {
          try {
            const parsed = JSON.parse(rawAddress);
            const erp = parsed.erp_profile || {};
            setEditAddress(erp.address_text || '');
            setEditEmployeeId(erp.employee_id || '');
            setEditDepartment(erp.department || '');
            setEditJobTitle(erp.job_title || '');
            setEditContractType(erp.contract_type || 'official');
            setEditDateJoined(erp.date_joined || '');
            setEditDirectManager(erp.direct_manager || '');
            setEditWorkplace(erp.workplace || '');
            setEditPersonalPhone(erp.personal_phone || '');
            setEditExtNumber(erp.ext_number || '');
            setEditEmergencyName(erp.emergency_contact_name || '');
            setEditEmergencyRelation(erp.emergency_contact_relationship || '');
            setEditEmergencyPhone(erp.emergency_contact_phone || '');
            setEditAddressTemporary(erp.address_temporary || '');
            if (Array.isArray(erp.emergency_contacts) && erp.emergency_contacts.length > 0) {
              setEmergencyContacts(erp.emergency_contacts);
            } else if (erp.emergency_contact_name || erp.emergency_contact_relationship || erp.emergency_contact_phone) {
              setEmergencyContacts([
                {
                  name: erp.emergency_contact_name || '',
                  relationship: erp.emergency_contact_relationship || '',
                  phone: erp.emergency_contact_phone || ''
                }
              ]);
            } else {
              setEmergencyContacts([{ name: '', relationship: '', phone: '' }]);
            }

            if (Array.isArray(erp.certificates)) {
              setProfileCertificates(erp.certificates);
            } else {
              setProfileCertificates([]);
            }

            if (Array.isArray(erp.hr_records)) {
              setProfileHRRecords(erp.hr_records);
            } else {
              setProfileHRRecords([]);
            }
            setEditTaxId(erp.tax_id || '');
            setEditInsuranceId(erp.insurance_id || '');
            setEditBrokerLicense(erp.broker_license || '');
            setEditDegree(erp.degree || '');
            setEditNationality(erp.nationality || '');
            setEditMaritalStatus(erp.marital_status || '');
            setEditPersonalEmail(erp.personal_email || '');
            setEditHometown(erp.hometown || '');
            setEditBankBranch(erp.bank_branch || '');
          } catch (e) {
            setEditAddress(rawAddress);
          }
        } else {
          setEditAddress(rawAddress);
          setEditEmployeeId('');
          setEditDepartment('');
          setEditJobTitle('');
          setEditContractType('official');
          setEditDateJoined('');
          setEditDirectManager('');
          setEditWorkplace('');
          setEditPersonalPhone('');
          setEditExtNumber('');
          setEditEmergencyName('');
          setEditEmergencyRelation('');
          setEditEmergencyPhone('');
          setEditAddressTemporary('');
          setEmergencyContacts([{ name: '', relationship: '', phone: '' }]);
          setProfileCertificates([]);
          setProfileHRRecords([]);
          setEditTaxId('');
          setEditInsuranceId('');
          setEditBrokerLicense('');
          setEditDegree('');
          setEditNationality('');
          setEditMaritalStatus('');
          setEditPersonalEmail('');
          setEditHometown('');
          setEditBankBranch('');
        }

        setEditBankName(data.consultant_profile.bank_name || '');
        setEditBankAccount(data.consultant_profile.bank_account || '');
        setEditLeaveStart(data.consultant_profile.leave_start || '');
        setEditLeaveEnd(data.consultant_profile.leave_end || '');

        const schedule = data.consultant_profile.work_schedule;
        if (schedule && Object.keys(schedule).length > 0) {
          setEditWorkSchedule(schedule);
          setScheduleMode('custom');
        } else if (sysSettings?.global_work_schedule) {
          try {
            const globalSchedule = typeof sysSettings.global_work_schedule === 'string'
              ? JSON.parse(sysSettings.global_work_schedule)
              : sysSettings.global_work_schedule;
            setEditWorkSchedule(globalSchedule);
            let isSimpleDaily = true;
            const firstDay = globalSchedule["1"] || globalSchedule[1];
            if (firstDay) {
              for (let i = 1; i <= 7; i++) {
                const day = globalSchedule[String(i)] || globalSchedule[i];
                if (!day || !day.active || day.start !== firstDay.start || day.end !== firstDay.end) {
                  isSimpleDaily = false;
                  break;
                }
              }
            }
            setScheduleMode(isSimpleDaily ? 'daily' : 'custom');
          } catch (e) {
            setEditWorkSchedule(DEFAULT_SCHEDULE);
            setScheduleMode('daily');
          }
        } else {
          setEditWorkSchedule(DEFAULT_SCHEDULE);
          setScheduleMode('daily');
        }
      }
    }
  }, [data.consultant_profile, sysSettings]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const compressedFile = await compressToWebP(file);
      const fd = new FormData();
      fd.append('avatar', compressedFile);

      const oldAvatar = editAvatar || '';
      const query = `upload_avatar&old_avatar=${encodeURIComponent(oldAvatar)}`;

      const res = await fetchAPI(query, {
        method: 'POST',
        body: fd
      });

      if (res.success && res.url) {
        setEditAvatar(res.url);
        toast.success(t('Tải lên ảnh đại diện thành công!'));
      } else {
        toast.error(res.message || t('Lỗi tải ảnh đại diện lên'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối tải ảnh: ') + err.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCertificateImageUpload = async (index: number, file: File) => {
    try {
      const compressedFile = await compressToWebP(file);
      const fd = new FormData();
      fd.append('avatar', compressedFile);

      const currentImg = profileCertificates[index]?.image || '';
      const query = `upload_avatar&old_avatar=${encodeURIComponent(currentImg)}`;

      const res = await fetchAPI(query, {
        method: 'POST',
        body: fd
      });

      if (res.success && res.url) {
        const updated = [...profileCertificates];
        updated[index] = {
          ...updated[index],
          image: res.url
        };
        setProfileCertificates(updated);
        toast.success(t('Tải lên ảnh chứng chỉ thành công!'));
      } else {
        toast.error(res.message || t('Lỗi tải ảnh chứng chỉ lên'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối tải ảnh: ') + err.message);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast.error(t('Tên không được để trống.'));
      return;
    }
    setSavingProfile(true);
    try {
      const firstEmergency = emergencyContacts[0] || { name: '', relationship: '', phone: '' };
      const addressPayload = JSON.stringify({
        erp_profile: {
          address_text: editAddress,
          address_temporary: editAddressTemporary,
          employee_id: editEmployeeId,
          department: editDepartment,
          job_title: editJobTitle,
          contract_type: editContractType,
          date_joined: editDateJoined,
          direct_manager: editDirectManager,
          workplace: editWorkplace,
          personal_phone: editPersonalPhone,
          ext_number: editExtNumber,
          emergency_contact_name: firstEmergency.name || '',
          emergency_contact_relationship: firstEmergency.relationship || '',
          emergency_contact_phone: firstEmergency.phone || '',
          emergency_contacts: emergencyContacts,
          certificates: profileCertificates,
          hr_records: profileHRRecords,
          tax_id: editTaxId,
          insurance_id: editInsuranceId,
          broker_license: editBrokerLicense,
          degree: editDegree,
          nationality: editNationality,
          marital_status: editMaritalStatus,
          personal_email: editPersonalEmail,
          hometown: '',
          bank_branch: editBankBranch
        }
      });

      const payload = {
        consultant_id: ['sale', 'manager'].includes(String(displayUser?.role).toLowerCase()) ? displayUser?.consultant_id : (data.consultant_profile?.id || null),
        name: editName.trim(),
        avatar: editAvatar,
        work_start_time: editWorkStartTime,
        work_end_time: editWorkEndTime,
        work_schedule: scheduleMode === 'custom' ? editWorkSchedule : null,
        dob: editDob,
        gender: editGender,
        citizen_id: editCitizenId,
        address: addressPayload,
        bank_name: editBankName,
        bank_account: editBankAccount,
        leave_start: editLeaveStart || null,
        leave_end: editLeaveEnd || null
      };

      const res = await fetchAPI('update_consultant_self_profile', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        toast.success(t('Cập nhật thông tin tài khoản thành công!'));
        loadPortalData(true);
      } else {
        toast.error(res.message || t('Lỗi lưu cài đặt tài khoản'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối lưu thiết lập: ') + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const fetchLeaveHistory = async () => {
    const activePaths = ['/', '/workspace', '/account', '/calendar', '/databank', '/fair-share'];
    if (!activePaths.includes(loc.pathname)) return;
    setLoadingLeaves(true);
    try {
      const saleId = ['sale', 'manager'].includes(String(displayUser?.role).toLowerCase()) ? displayUser?.consultant_id : (data.consultant_profile?.id || null);
      const query = saleId ? `get_consultant_leaves&consultant_id=${saleId}` : 'get_consultant_leaves';
      const res = await fetchAPI(query);
      if (res.success) {
        setLeaveHistory(res.data || []);
      }
    } catch (err) {
      /* silent */
    } finally {
      setLoadingLeaves(false);
    }
  };

  const [submittingTask, setSubmittingTask] = useState(false);

  const handleCreatePortalTask = async () => {
    if (!taskForm.title.trim()) {
      toast.error(t('Vui lòng nhập tên công việc.'));
      return;
    }
    setSubmittingTask(true);

    let tagsPayload = '';
    if (taskTypeTab === 'personal') {
      tagsPayload = 'personal_task';
    } else if (taskTypeTab === 'team') {
      tagsPayload = `internal_${taskForm.internal_type || 'task'}`;
    }

    const additionalContactIds = (taskForm.related_contact_ids || [])
      .filter((id: any) => id !== 'all' && id !== '')
      .map(Number);

    // Always structure body as JSON to support Checklist, Links, and Recurrence
    const erpPayload = {
      erp_task: {
        description: taskForm.description.trim(),
        internal_type: taskTypeTab === 'team' ? (taskForm.internal_type || 'task') : 'task',
        scope: taskTypeTab === 'team' ? (taskForm.scope || 'team') : 'personal',
        project_id: taskForm.project_id || '',
        campaign_id: taskForm.campaign_id || '',
        team_id: taskForm.team_id || '',
        campaign_target: taskForm.campaign_target || '',
        recurrence: {
          pattern: taskForm.recurrence_pattern || 'none',
          weekly_days: taskForm.recurrence_weekly_days || [],
          monthly_day: Number(taskForm.recurrence_monthly_day || 1),
          last_generated: ''
        },
        checklist: taskForm.checklist || [],
        links: taskForm.link?.trim() ? [{ label: t('Đường dẫn đính kèm'), url: taskForm.link.trim() }] : [],
        related_contact_ids: additionalContactIds
      }
    };

    const mainAssignee = taskForm.user_id ? Number(taskForm.user_id) : currentUser?.id;
    const participantIdsString = (taskForm.participant_ids || [])
      .filter((id: any) => id !== 'all' && Number(id) !== Number(mainAssignee))
      .join(',');

    const bodyPayload = JSON.stringify(erpPayload);

    let relatedType = null;
    let relatedId = null;

    if (taskTypeTab === 'customer' && taskForm.related_id) {
      relatedType = 'contact';
      relatedId = Number(taskForm.related_id);
    }

    if (taskForm.project_id) {
      relatedType = 'project';
      relatedId = Number(taskForm.project_id);
    } else if (taskForm.campaign_id) {
      relatedType = 'campaign';
      relatedId = Number(taskForm.campaign_id);
    } else if (taskForm.team_id) {
      relatedType = 'team';
      relatedId = Number(taskForm.team_id);
    }

    try {
      await api.post('/activities', {
        subject: taskForm.title,
        type: 'task',
        priority: taskForm.priority,
        due_date: taskForm.due_date,
        related_type: relatedType,
        related_id: relatedId,
        user_id: taskForm.user_id ? Number(taskForm.user_id) : currentUser?.id,
        body: bodyPayload,
        status: 'planned',
        progress: Number(taskForm.progress || 0),
        require_approval: Number(taskForm.require_approval || 0),
        approver_id: taskForm.approver_id ? Number(taskForm.approver_id) : null,
        tags: tagsPayload || null,
        participant_ids: participantIdsString || null
      });
      setShowTaskModal(false);
      setTaskForm({
        title: '',
        priority: 'medium',
        due_date: new Date().toISOString().slice(0, 10),
        description: '',
        link: '',
        related_id: '',
        user_id: '',
        progress: 0,
        require_approval: 0,
        approver_id: '',
        internal_type: 'task',
        scope: 'team',
        recurrence_pattern: 'none',
        recurrence_weekly_days: [],
        recurrence_monthly_day: 1,
        participant_ids: [] as string[],
        related_contact_ids: [] as string[],
        checklist: [] as any[],
        project_id: '',
        campaign_id: '',
        team_id: '',
        campaign_target: ''
      });
      fetchPortalTasks();
      fetchWorkspaceTasks();
      toast.success(t('Đã tạo công việc mới'));
    } catch (e) {
      toast.error(t('Lỗi khi tạo công việc'));
    } finally {
      setSubmittingTask(false);
    }
  };


  const [savingLeave, setSavingLeave] = useState(false);
  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLeaveStart || !editLeaveEnd) {
      toast.error(t('Vui lòng chọn đầy đủ Từ ngày và Đến ngày.'));
      return;
    }
    if (editLeaveStart > editLeaveEnd) {
      toast.error(t('Ngày bắt đầu không được lớn hơn ngày kết thúc.'));
      return;
    }
    setSavingLeave(true);
    try {
      const saleId = ['sale', 'manager'].includes(String(displayUser?.role).toLowerCase()) ? displayUser?.consultant_id : (data.consultant_profile?.id || null);
      const payload = {
        consultant_id: saleId,
        start_date: editLeaveStart,
        end_date: editLeaveEnd
      };
      const res = await fetchAPI('add_consultant_leave', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        toast.success(t('Đăng ký nghỉ phép thành công!'));
        setEditLeaveStart('');
        setEditLeaveEnd('');
        fetchLeaveHistory();
        loadPortalData();
      } else {
        toast.error(res.message || t('Lỗi đăng ký nghỉ phép'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setSavingLeave(false);
    }
  };

  const handleDeleteLeave = (leaveId: number) => {
    showConfirm({
      title: t('Xác nhận xóa nghỉ phép'),
      message: t('Bạn có chắc chắn muốn xóa đăng ký nghỉ phép này không?'),
      confirmText: t('Xóa'),
      cancelText: t('Hủy'),
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI('delete_consultant_leave', {
            method: 'POST',
            body: JSON.stringify({ id: leaveId })
          });
          if (res.success) {
            toast.success(t('Đã xóa đăng ký nghỉ phép thành công!'));
            fetchLeaveHistory();
            loadPortalData();
          } else {
            toast.error(res.message || t('Lỗi khi xóa'));
          }
        } catch (err: any) {
          toast.error(t('Lỗi kết nối: ') + err.message);
        }
      }
    });
  };

  useEffect(() => {
    if (token && user?.id) {
      fetchLeaveHistory();
    }
  }, [token, user?.id, saleIdFilter, data.consultant_profile?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPortalData();
    }, 100);
    return () => clearTimeout(timer);
  }, [token, user?.id, user?.role, roundId, dateMode, saleIdFilter, search, startDate, endDate]);



  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const uId = params.get('sale_id') || '';
    if (uId !== saleIdFilter) {
      setSaleIdFilter(uId);
    }
  }, [loc.search]);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const taskId = params.get('task_id');
    if (taskId && token) {
      const loadTaskDetailFromUrl = async () => {
        try {
          const res = await api.get(`/activities/${taskId}`);
          if (res.data && res.data.success) {
            const task = res.data.data;
            if (task) {
              let link = '';
              let description = '';
              if (task.body) {
                const matchLink = task.body.match(/Tài liệu\/Link đính kèm:\s*(https?:\/\/[^\s]+)/);
                if (matchLink) {
                  link = matchLink[1];
                }
                if (task.type === 'task') {
                  try {
                    const parsed = JSON.parse(task.body);
                    description = parsed.erp_task?.description || '';
                  } catch (e) {
                    description = task.body;
                  }
                } else {
                  description = task.body.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim();
                }
              }
              const parsed = parseDescriptionAndChecklist(description);
              const parsedTask = {
                id: task.id,
                title: task.subject,
                done: task.status === 'done',
                priority: task.priority,
                due_date: task.due_date ? task.due_date.slice(0, 10) : '',
                link,
                description: parsed.pureDescription,
                user_id: task.user_id,
                user_name: task.user_name || 'Hệ thống',
                tags: task.tags || '',
                participant_ids: task.participant_ids || '',
                progress: task.progress || 0,
                require_approval: task.require_approval || 0,
                approver_id: task.approver_id,
                approval_status: task.approval_status,
                contact_id: task.contact_id,
                contact_name: task.contact_name,
                contact_avatar: task.contact_avatar,
                related_type: task.related_type,
                related_id: task.related_id,
                body: task.body,
                created_by: task.created_by,
                created_by_name: task.created_by_name,
                created_by_avatar: task.created_by_avatar
              };
              setChecklist(parsed.checklist);
              setSelectedTaskForDetails(parsedTask);
              
              // Set active subtab to correspond with the task type so it shows in the list
              const isClient = task.related_type && ['contact', 'deal', 'company'].includes(task.related_type);
              const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
              if (tagsList.includes('personal_task')) {
                setWsSubTab('personal');
              } else if (!isClient) {
                setWsSubTab('team');
              } else {
                setWsSubTab('customer');
              }

              // Clear the task_id from URL so it doesn't pop open again when page refreshes/loads
              const nextParams = new URLSearchParams(loc.search);
              nextParams.delete('task_id');
              navigate(`${loc.pathname}${nextParams.toString() ? '?' + nextParams.toString() : ''}`, { replace: true });
            }
          }
        } catch (e) {
          console.error("Lỗi khi nạp chi tiết công việc từ URL:", e);
        }
      };
      loadTaskDetailFromUrl();
    }
  }, [loc.search, token]);

  const handleExitImpersonation = () => {
    setSaleIdFilter('');
    const params = new URLSearchParams(loc.search);
    params.delete('sale_id');
    navigate(`/${params.toString() ? '?' + params.toString() : ''}`);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

  useEffect(() => {
    const handleLeadAdded = () => {
      loadPortalData();
    };
    window.addEventListener('lead-added', handleLeadAdded);
    return () => window.removeEventListener('lead-added', handleLeadAdded);
  }, [token, user, roundId, dateMode, saleIdFilter, startDate, endDate]);

  // Calendar stats fetch
  const fetchCalendarStats = async () => {
    if (!token) return;
    setCalendarLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      let consultantParam = '';
      if (['sale', 'manager'].includes(String(displayUser?.role).toLowerCase())) {
        consultantParam = displayUser.name;
      }
      const json = await fetchAPI(`get_calendar_stats&year=${year}&month=${month}&consultant=${encodeURIComponent(consultantParam)}`);
      if (json.success) {
        setCalendarData(json.data || {});
      }
    } catch (e: any) {
      console.error('Lỗi tải thống kê lịch biểu: ', e.message);
    }
    setCalendarLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'calendar') {
      fetchCalendarStats();
    }
  }, [activeTab, currentDate, saleIdFilter, token]);

  const handleDateClick = async (dateStr: string) => {
    setSelectedCalendarDate(dateStr);
    setDayDetailsLoading(true);
    setDayDetails(null);
    try {
      let consultantParam = '';
      if (['sale', 'manager'].includes(String(displayUser?.role).toLowerCase())) {
        consultantParam = displayUser.name;
      }
      const json = await fetchAPI(`get_calendar_day_details&date=${dateStr}&consultant=${encodeURIComponent(consultantParam)}&view=individual`);
      if (json.success) {
        setDayDetails(json.data);
      }
    } catch (e: any) {
      toast.error(t('Lỗi tải chi tiết ngày: ') + e.message);
    }
    setDayDetailsLoading(false);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [data.leads]);

  // Load timeline for selected lead in modal
  useEffect(() => {
    if (activeDetailLead?.lead_id && detailModalOpen && token) {
      setLoadingTimeline(true);
      fetchAPI(`get_sale_lead_timeline&lead_id=${activeDetailLead.lead_id}`)
        .then((json) => {
          if (json.success) {
            setTimeline(json.timeline || []);
          } else {
            toast.error(json.message || 'Không thể tải lịch sử nhắc lại');
            setTimeline([]);
          }
        })
        .catch((err) => {
          console.error(err);
          setTimeline([]);
        })
        .finally(() => {
          setLoadingTimeline(false);
        });
    } else {
      setTimeline([]);
    }
  }, [activeDetailLead, detailModalOpen, token]);

  // Handle manual apply for Custom date and search button
  const handleApplyFilters = () => {
    setSearch(searchInput.trim());
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setSearch(searchInput.trim());
    }
  };

  const handleDateModeChange = (val: string) => {
    setDateMode(val);
    if (val === 'custom') {
      setShowCustomDate(true);
    } else {
      setShowCustomDate(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success(t('Đã đăng xuất tài khoản.'));
  };

  const getReasonsList = (): { reason: string; note: string }[] => {
    return data.report_error_reasons || [
      { reason: 'Sai số điện thoại / Số ảo', note: 'Data có số điện thoại sai, không đúng, thiếu số, hoặc gọi thì báo không phải tên của khách hàng.' },
      { reason: 'Trùng của tôi', note: 'Data bị trùng, đã check CRCM mà thấy data có lần tương tác cuối cùng > {n} tháng nghĩa là giao đúng; hoặc data < {n} tháng mà giao thì báo cáo trùng; hoặc nhập data không được (tùy trường hợp sẽ xét).' },
      { reason: 'Trùng của người khác', note: 'Data bị trùng, đã check CRCM mà thấy data có lần tương tác cuối cùng > {n} tháng nghĩa là giao đúng; hoặc data < {n} tháng mà giao thì báo cáo trùng; hoặc nhập data không được (tùy trường hợp sẽ xét).' },
      { reason: 'Spam ảo / Junk lead', note: 'Data mà vừa giao gọi cuộc 1 đã báo hết nhu cầu rồi, không có đăng kí, cháu chắt phá, hoặc đăng kí cho vui.' },
      { reason: 'Khác', note: 'Là data Unqualified. Mọi data như đăng kí khác chuyên ngành như Luật/NNA, data mới cấp 3, không có tiếng anh (được ghi chú từ đầu bởi thông báo của MKT), là những data được định nghĩa Unqualified như trên Misa thì cứ báo cáo và ghi lý do ở dưới. Tạm thời c vẫn sẽ bù vòng.' }
    ];
  };

  // Submit quick ticket
  const handleOpenReportModal = (lead: any) => {
    setSelectedLead(lead);
    const rList = getReasonsList();
    setReportReasonType(rList[0]?.reason || '');
    setReportDetails('');
    setReportModalOpen(true);
  };

  const handleSubmitReport = async () => {
    if (!selectedLead) return;
    const isOtherReason = reportReasonType.toLowerCase().includes('khác') || reportReasonType.toLowerCase().includes('other');
    if (isOtherReason && !reportDetails.trim()) {
      toast.error(t('Vui lòng nhập mô tả chi tiết lý do lỗi.'));
      return;
    }
    setSubmittingReport(true);
    try {
      const finalReason = isOtherReason
        ? `${reportReasonType}: ${reportDetails.trim()}`
        : (reportDetails.trim() ? `${reportReasonType} (Ghi chú: ${reportDetails.trim()})` : reportReasonType);
      const payload = {
        lead_id: selectedLead.lead_id,
        sale_id: ['sale', 'manager'].includes(String(displayUser?.role).toLowerCase()) ? displayUser?.consultant_id : selectedLead.assigned_to,
        round_id: selectedLead.round_id,
        reason: finalReason
      };

      const json = await fetchAPI('submit_report', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (json.success) {
        if (json.auto_approved) {
          toast.success(t('Báo cáo lỗi đã được HỆ THỐNG TỰ ĐỘNG PHÊ DUYỆT & ĐỀN BÙ thành công!'), { duration: 6000 });
        } else {
          toast.success(t('Gửi báo lỗi data thành công! Đang chờ admin duyệt bù.'));
        }
        setReportModalOpen(false);
        loadPortalData();
      } else {
        toast.error(json.message || t('Gửi báo lỗi thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Không thể kết nối máy chủ gửi báo lỗi') + (err.message ? ': ' + err.message : ''));
    }
    setSubmittingReport(false);
  };

  // Prepare chart data for Recharts (Hourly distribution)
  const hourlyChartData = data.by_hour.map((count: number, hr: number) => ({
    time: `${String(hr).padStart(2, '0')}:00`,
    volume: count
  }));

  const getDailyChartData = () => {
    const dailyMap: { [key: string]: number } = {};
    if (data.leads && Array.isArray(data.leads)) {
      data.leads.filter((l: any) => l.status !== 'reminder').forEach((lead: any) => {
        if (lead.received_at) {
          const dateStr = lead.received_at.split(' ')[0]; // "YYYY-MM-DD"
          dailyMap[dateStr] = (dailyMap[dateStr] || 0) + 1;
        }
      });
    }

    const sortedDates = Object.keys(dailyMap).sort();
    return sortedDates.map(dateStr => {
      const parts = dateStr.split('-'); // ["2026", "05", "28"]
      const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
      return {
        date: label,
        volume: dailyMap[dateStr]
      };
    });
  };

  const activeChartData = flowViewMode === 'day' ? getDailyChartData() : hourlyChartData;

  const [statusFilter, setStatusFilter] = useState(() => {
    const params = new URLSearchParams(loc.search);
    return params.get('status') || 'all';
  });

  const uncontactedCount = data.uncontacted_count || 0;

  useEffect(() => {
    sessionStorage.setItem('sale-uncontacted-count', String(uncontactedCount));
    window.dispatchEvent(new CustomEvent('uncontacted-count-changed', { detail: uncontactedCount }));
  }, [uncontactedCount]);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const statusParam = params.get('status');
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, [loc.search]);

  const getStatusBadge = (status: string, reportStatus?: string, aiScreenerStatus?: string, createdAt?: string, takers?: any[]) => {
    if (status === 'assigned' && reportStatus === 'pending') {
      return <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#4338ca', border: '1px solid rgba(99, 102, 241, 0.2)' }}>{t('Ticket Review')}</span>;
    }
    if (reportStatus === 'approved_no_comp') {
      return <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8', border: '1px solid rgba(59, 130, 246, 0.2)' }}>{t('Lỗi không bù')}</span>;
    }
    if (status === 'error' && reportStatus === 'approved') {
      return <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{t('Ticket')}</span>;
    }
    if (status === 'pending_approval' && aiScreenerStatus === 'pending') {
      const nowTime = new Date();
      const created = createdAt ? parseServerDate(createdAt) : nowTime;
      const diffMins = (nowTime.getTime() - created.getTime()) / 60000;
      if (diffMins >= -2 && diffMins < 5) {
        return <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#be185d', border: '1px solid rgba(236, 72, 153, 0.2)' }}>{t('Chờ AI đánh giá')}</span>;
      }
    }
    switch (status) {
      case 'assigned': return <span className="badge" style={{ background: 'rgba(13, 148, 136, 0.1)', color: '#0f766e', border: '1px solid rgba(13, 148, 136, 0.2)' }}>{t('Đã chia')}</span>;
      case 'compensation': return <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#6d28d9', border: '1px solid rgba(139, 92, 246, 0.2)' }}>{t('Data Bù')}</span>;
      case 'pending_work_hours': return <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.2)' }}>{t('Chờ giờ làm')}</span>;
      case 'error': return <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#be123c', border: '1px solid rgba(244, 63, 94, 0.2)' }}>{t('Ticket')}</span>;
      case 'pending': return <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#a16207', border: '1px solid rgba(234, 179, 8, 0.2)' }}>{t('Chờ chia')}</span>;
      case 'reminder': return <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#be185d', border: '1px solid rgba(236, 72, 153, 0.2)' }}>{t('Nhắc lại')}</span>;
      case 'duplicate': return <span className="badge" style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#991b1b', border: '1px solid rgba(220, 38, 38, 0.2)' }}>{t('Trùng lặp')}</span>;
      case 'rule_6_month': return <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8', border: '1px solid rgba(59, 130, 246, 0.2)' }}>{t('Quy định 6 tháng')}</span>;
      case 'silent': return <span className="badge" style={{ background: 'rgba(79, 70, 229, 0.1)', color: '#3730a3', border: '1px solid rgba(79, 70, 229, 0.2)' }}>{t('Chỉ đồng bộ')}</span>;
      case 'blacklisted': return <span className="badge" style={{ background: 'rgba(31, 41, 55, 0.1)', color: '#111827', border: '1px solid rgba(31, 41, 55, 0.2)' }}>{t('Blacklist')}</span>;
      case 'pending_approval': return <span className="badge" style={{ background: 'rgba(234, 88, 12, 0.1)', color: '#c2410c', border: '1px solid rgba(234, 88, 12, 0.2)' }}>{t('Tạm giữ')}</span>;
      case 'rejected': return <span className="badge" style={{ background: 'rgba(120, 53, 4, 0.1)', color: '#78350f', border: '1px solid rgba(120, 53, 4, 0.2)' }}>{t('Dưới chuẩn')}</span>;
      case 'fallback': return <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.2)' }}>{t('Fallback')}</span>;
      case 'databank_claim': return <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{t('Đã nhận (Kho)')}</span>;
      case 'released_to_kho':
      case 'databank': {
        const cnt = takers && takers.length ? takers.length : 0;
        if (cnt === 0) {
          return <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#047857', border: '1px solid rgba(16,185,129,0.2)' }}>{t('Public (2/2)')}</span>;
        } else if (cnt >= 2) {
          return <span className="badge" style={{ background: 'rgba(107, 114, 128, 0.1)', color: '#4b5563', border: '1px solid rgba(107, 114, 128, 0.2)' }}>{t('Giới hạn (0/2)')}</span>;
        } else {
          return <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.2)' }}>{t(`Public (1/2)`)}</span>;
        }
      }
      default: return null;
    }
  };

  const filteredLeads = data.leads.filter((lead: any) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'assigned') {
        if (!['assigned', 'rule_6_month', 'pending_work_hours', 'fallback', 'databank_claim'].includes(lead.status) || lead.report_status) return false;
      } else if (statusFilter === 'databank_claim') {
        if (lead.status !== 'databank_claim' || lead.report_status) return false;
      } else if (statusFilter === 'compensation') {
        if (lead.status !== 'compensation' || lead.report_status) return false;
      } else if (statusFilter === 'reminder') {
        if (lead.status !== 'reminder') return false;
      } else if (statusFilter === 'pending_ticket') {
        if (lead.report_status !== 'pending') return false;
      } else if (statusFilter === 'approved_ticket') {
        if (lead.report_status !== 'approved') return false;
      } else if (statusFilter === 'approved_no_comp_ticket') {
        if (lead.report_status !== 'approved_no_comp') return false;
      } else if (statusFilter === 'not_contacted') {
        if (lead.contact_last_contact) return false;
      } else if (statusFilter === 'rejected_ticket') {
        if (lead.report_status !== 'rejected') return false;
      }
    }
    return true;
  });

  const ITEMS_PER_PAGE = 10;
  const totalCount = filteredLeads.length;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Render Login Layout if not authorized
  if (!token || !ALLOWED_PORTAL_ROLES.includes(user?.role || '')) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        position: 'relative',
        overflow: 'hidden',
        padding: '2rem'
      }}>
        {/* Animated Background Elements */}
        <div style={{
          position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, rgba(163, 20, 34,0.15) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%', filter: 'blur(60px)', animation: 'float 12s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%', width: '60vw', height: '60vw',
          background: 'radial-gradient(circle, rgba(189, 29, 45,0.15) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%', filter: 'blur(80px)', animation: 'float 15s ease-in-out infinite reverse'
        }} />

        <div style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 450,
          background: theme === 'dark' ? 'var(--color-surface)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          boxShadow: theme === 'dark' ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.05) inset' : '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
          padding: '3rem 2rem',
          textAlign: 'center',
          border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : 'none'
        }}>
          {/* Header/Logo */}
          <div style={{
            width: 64, height: 64, margin: '0 auto 1.5rem', borderRadius: '50%',
            background: 'linear-gradient(135deg, #a31422 0%, #8a0f1b 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(163, 20, 34,0.3)', overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.9)'
          }}>
            <img
              src="/LOGO.jpg"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo"
            />
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: theme === 'dark' ? '#f8fafc' : '#0f172a', letterSpacing: '-0.5px' }}>
            {t('CỔNG TƯ VẤN VIÊN')}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.925rem', marginTop: 6, lineHeight: 1.5 }}>
            {t('Vui lòng đăng nhập bằng tài khoản Google nhận mail để tra cứu danh sách khách hàng và quản lý tickets.')}
          </p>

          <div style={{ margin: '2rem 0' }}>
            {isAdminMsg ? (
              <div style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                padding: '1.25rem', borderRadius: '16px', color: '#b45309', fontSize: '0.9rem',
                lineHeight: 1.6, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontWeight: 700 }}>
                  <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                  <span>{t('Cảnh báo quản trị')}</span>
                </div>
                <span>{isAdminMsg}</span>
                <button
                  onClick={() => navigate('/')}
                  style={{
                    background: '#d97706', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '8px 16px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#b45309')}
                  onMouseOut={(e) => (e.currentTarget.style.background = '#d97706')}
                >
                  {t('Vào trang Quản trị')} <ArrowUpRight size={14} />
                </button>
              </div>
            ) : user && !ALLOWED_PORTAL_ROLES.includes(user.role) ? (
              <div style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                padding: '1.25rem', borderRadius: '16px', color: '#b45309', fontSize: '0.9rem',
                lineHeight: 1.6, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontWeight: 700 }}>
                  <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                  <span>{t('Quyền truy cập bị từ chối')}</span>
                </div>
                <span>{t('Tài khoản hiện tại của bạn không có vai trò Tư vấn viên. Vui lòng chuyển sang tài khoản Gmail của Sale hoặc đăng xuất.')}</span>
                <button
                  onClick={handleLogout}
                  style={{
                    background: '#d97706', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '8px 16px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
                  }}
                >
                  {t('Đăng xuất tài khoản')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                <div ref={googleBtnRef} style={{ minHeight: 44 }}></div>

                {localStorage.getItem('RICH LAND_DEMO_MODE') === 'true' && (
                  <button
                    onClick={() => {
                      setGoogleLoading(true);
                      setTimeout(() => {
                        login('demo_token_sale_1', {
                          username: 'haidang',
                          email: 'haidang@richland.net',
                          name: 'Hải Đăng',
                          role: 'sale',
                          consultant_id: 1,
                          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150'
                        });
                        toast.success(t('Chào mừng Hải Đăng quay trở lại!'));
                        setGoogleLoading(false);
                      }, 500);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px 24px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                      transition: 'all 0.2s',
                      width: 300,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                    onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <LogIn size={16} /> {t('Đăng nhập Demo (Tư vấn viên)')}
                  </button>
                )}

                {googleLoading && <div style={{ fontSize: '0.85rem', color: '#BD1D2D' }}>{t('Đang kết nối Google API...')}</div>}

                {googleError && (
                  <div style={{
                    padding: '0.75rem 1rem', background: 'var(--color-danger-light)', border: '1px solid var(--color-danger-light)',
                    color: 'var(--color-danger)', borderRadius: '12px', fontSize: '0.825rem', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: '6px', width: '100%', textAlign: 'left'
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{googleError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
            {t('Hệ thống Quản lý Rich Land DATA')} &copy; 2026
          </div>
        </div>
        <style>{`
          @keyframes float {
            0% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-20px) scale(1.03); }
            100% { transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    );
  }

  // Active Sale Portal View
  const renderWorkspaceView = () => {
    const currentUser = user;
    const isAdminOrManager = ['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes(String(user?.role || displayUser?.role || '').toLowerCase());
    const teamOptions = [
      { value: '', label: t('Tất cả Nhóm') },
      ...teamsList.map((t: any) => ({ value: String(t.id), label: t.name }))
    ];

    const consultantOptions = [
      { value: '', label: t('Tất cả Nhân viên') },
      ...users.map((u: any) => ({ value: String(u.id), label: u.full_name || u.username, avatar: u.avatar || u.avatar_url }))
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: wsViewMode === 'focus' ? '0' : '1.25rem', paddingBottom: isMobile ? '100px' : '0' }}>
        {wsViewMode !== 'focus' && (
          <>
            {/* Workspace Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {t("Bàn làm việc")}
                <button
                  onClick={() => setShowWorkspaceHelpModal(true)}
                  style={{
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    border: '1px solid var(--color-border)',
                    padding: '3px 8px',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    transition: 'all 0.2s',
                    height: '24px'
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
                  title={t("Xem hướng dẫn sử dụng Bàn làm việc")}
                >
                  <Info size={12} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
                </button>
              </h1>
              
              {/* Completed Calls Count Pill */}
              <div 
                onClick={handleOpenCallsModal}
                className="hover-lift"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#10b981',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  height: '24px'
                }}
              >
                <Phone size={11} style={{ flexShrink: 0 }} />
                <span>
                  {t('Đã gọi:')} <strong>{completedCallsCount}</strong>
                </span>
              </div>
            </div>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              {t("Quản lý toàn bộ công việc cần thực hiện, lọc chi tiết theo tiến độ và độ ưu tiên.")}
            </p>
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn secondary"
                onClick={handleStartFocusSession}
                style={{
                  background: 'rgba(189, 29, 45, 0.06)',
                  border: '1px solid rgba(189, 29, 45, 0.25)',
                  color: 'var(--color-primary, #BD1D2D)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(189, 29, 45, 0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(189, 29, 45, 0.06)'; }}
              >
                <Play size={14} />
                <span>{t('Bắt đầu Phiên Làm Việc')}</span>
              </button>

              <button 
                className="btn primary" 
                style={{ background: 'var(--color-primary, #BD1D2D)', borderColor: 'var(--color-primary, #BD1D2D)' }}
                onClick={() => {
                  setSelectedTaskForDetails({
                    id: 'new',
                    subject: '',
                    priority: 'medium',
                    due_date: new Date().toISOString().slice(0, 10),
                    description: '',
                    link: '',
                    user_id: String(user?.id || ''),
                    progress: 0,
                    require_approval: 0,
                    approver_id: '',
                    tags: wsSubTab === 'personal' ? 'personal_task' : '',
                    internal_type: wsSubTab === 'team' ? 'task' : '',
                    scope: wsSubTab === 'team' ? 'team' : '',
                    participant_ids: '',
                    related_contact_ids: [],
                    checklist: [],
                    project_id: '',
                    campaign_id: '',
                    team_id: '',
                    campaign_target: ''
                  });
                }}
              >
                <Plus size={16} /> {t('Tạo công việc')}
              </button>
            </div>
          )}
        </div>

        {/* Pending Leads Section */}
        {(() => {
          const pendingLeads = (data.leads || []).filter((l: any) => !Number(l.is_accepted));
          if (pendingLeads.length === 0) return null;
          return (
            <div 
              style={{
                background: 'linear-gradient(135deg, rgba(163, 20, 34, 0.03) 0%, rgba(163, 20, 34, 0.08) 100%)',
                border: '1px solid rgba(163, 20, 34, 0.15)',
                borderRadius: '16px',
                padding: '1.25rem',
                marginBottom: '1rem',
                animation: 'pulseGlow 2s infinite alternate'
              }}
            >
              <style>{`
                @keyframes pulseGlow {
                  0% { box-shadow: 0 4px 6px -1px rgba(163, 20, 34, 0.05), 0 2px 4px -1px rgba(163, 20, 34, 0.03); }
                  100% { box-shadow: 0 10px 15px -3px rgba(163, 20, 34, 0.15), 0 4px 6px -2px rgba(163, 20, 34, 0.05); }
                }
                @keyframes pulseDot {
                  0% { transform: scale(0.9); opacity: 0.6; }
                  100% { transform: scale(1.1); opacity: 1; }
                }
                .pulsing-dot-red {
                  width: 8px;
                  height: 8px;
                  border-radius: 50%;
                  background-color: var(--color-primary);
                  display: inline-block;
                  animation: pulseDot 0.8s infinite alternate;
                }
              `}</style>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <span className="pulsing-dot-red" />
                {t('DATA MỚI ĐANG CHỜ TIẾN NHẬN')} ({pendingLeads.length})
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {pendingLeads.map((lead: any) => {
                  const leadRecallMins = Number(lead.lead_recall_minutes) || Number(sysSettings?.lead_response_timeout_minutes) || 2;
                  const limitMs = leadRecallMins * 60 * 1000;
                  const isOverdue = leadRecallMins > 0 && (Date.now() - new Date(lead.received_at || lead.last_interaction_date).getTime()) >= limitMs;

                  return (
                    <div 
                      key={lead.log_id} 
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '12px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        boxShadow: 'var(--shadow-sm)',
                        position: 'relative'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <Avatar name={lead.lead_name || 'K'} size={32} />
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                            {lead.lead_name || t('Khách hàng mới')}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                          SĐT: {(() => {
                            const phone = lead.phone || '';
                            if (!phone) return '—';
                            if (phone.length < 6) return '***';
                            return phone.slice(0, 4) + '***' + phone.slice(-3);
                          })()}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '4px 0 0 0' }}>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: '#ffe3e8', color: '#8a0f1b', fontWeight: 700 }}>
                            {lead.round_name || t('Bàn giao')}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Nguồn: {lead.source || 'Facebook CAPI'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--color-border-light)', paddingTop: '0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                            {t('Chia lúc:')} {lead.received_at ? new Date(lead.received_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                          {leadRecallMins > 0 && (
                            <span style={{ fontSize: '0.72rem', color: isOverdue ? 'var(--color-danger)' : '#f59e0b', fontWeight: 700, marginTop: '2px' }}>
                              {isOverdue ? t('Quá hạn tiếp nhận') : (
                                <LeadRecallTimer
                                  lastInteractionDate={lead.last_interaction_date}
                                  receivedAt={lead.received_at}
                                  leadRecallMinutes={leadRecallMins}
                                  t={t}
                                />
                              )}
                            </span>
                          )}
                        </div>

                        <button 
                          onClick={() => handleAcceptLead(lead.lead_id)} 
                          disabled={isOverdue}
                          className="btn primary sm hover-lift"
                          style={{
                            height: '32px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            padding: '0 14px',
                            background: isOverdue ? '#cbd5e1' : 'var(--color-primary)',
                            color: isOverdue ? '#64748b' : '#fff',
                            fontSize: '0.8rem',
                            cursor: isOverdue ? 'not-allowed' : 'pointer',
                            pointerEvents: isOverdue ? 'none' : 'auto',
                            border: 'none'
                          }}
                        >
                          {isOverdue ? t('Quá hạn') : t('Tiếp nhận')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Main Subtabs Selection */}
        {isMobile ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            gap: '0.75rem', 
            marginBottom: '1rem',
            width: '100%'
          }}>
            {/* Dropdown filter on the left */}
            <div style={{ position: 'relative', flex: 1 }}>
              <select
                value={wsSubTab}
                onChange={(e) => {
                  setWsSubTab(e.target.value as any);
                  setWsTeamSubFilter('all');
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  padding: '0 2.25rem 0 0.75rem',
                  appearance: 'none',
                  outline: 'none',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {[
                  { id: 'all', label: `${t('Tất cả')} (${wsTasks.length})` },
                  { id: 'customer', label: `${t('Công việc khách hàng')} (${wsTasks.filter(task => task.related_type && ['contact', 'deal', 'company'].includes(task.related_type)).length})` },
                  { id: 'team', label: `${t('Công việc nội bộ team')} (${wsTasks.filter(task => {
                      const isClient = task.related_type && ['contact', 'deal', 'company'].includes(task.related_type);
                      const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
                      return !isClient && !tagsList.includes('personal_task');
                    }).length})` },
                  { id: 'personal', label: `${t('Công việc cá nhân')} (${wsTasks.filter(task => {
                      const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
                      return tagsList.includes('personal_task');
                    }).length})` }
                ].map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <div style={{
                position: 'absolute',
                top: '50%',
                right: '0.75rem',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center'
              }}>
                <ChevronDown size={14} />
              </div>
            </div>

            {/* Tạo công việc button on the right */}
            <button 
              className="btn primary sm" 
              onClick={() => {
                setSelectedTaskForDetails({
                  id: 'new',
                  subject: '',
                  priority: 'medium',
                  due_date: new Date().toISOString().slice(0, 10),
                  description: '',
                  link: '',
                  user_id: String(user?.id || ''),
                  progress: 0,
                  require_approval: 0,
                  approver_id: '',
                  tags: wsSubTab === 'personal' ? 'personal_task' : '',
                  internal_type: wsSubTab === 'team' ? 'task' : '',
                  scope: wsSubTab === 'team' ? 'team' : '',
                  participant_ids: '',
                  related_contact_ids: [],
                  checklist: [],
                  project_id: '',
                  campaign_id: '',
                  team_id: '',
                  campaign_target: ''
                });
              }}
              style={{
                height: '38px',
                borderRadius: '10px',
                fontWeight: 700,
                padding: '0 12px',
                fontSize: '0.8rem',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
            >
              <Plus size={14} /> {t('Tạo công việc')}
            </button>
          </div>
        ) : (
          <div className="segmented-control-wrapper" style={{ marginBottom: '1rem' }}>
            <div style={{
              display: 'flex',
              background: 'var(--color-border-light)',
              border: '1px solid var(--color-border)',
              padding: '2px',
              borderRadius: '8px',
              gap: '2px',
              width: 'fit-content',
              position: 'relative'
            }}>
              {[
                { id: 'all', label: t('Tất cả'), icon: <Layers size={14} />, count: wsTasks.length },
                { id: 'customer', label: t('Công việc khách hàng'), icon: <Users size={14} />, count: wsTasks.filter(task => task.related_type && ['contact', 'deal', 'company'].includes(task.related_type)).length },
                { id: 'team', label: t('Công việc nội bộ team'), icon: <CheckSquare size={14} />, count: wsTasks.filter(task => {
                    const isClient = task.related_type && ['contact', 'deal', 'company'].includes(task.related_type);
                    const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
                    return !isClient && !tagsList.includes('personal_task');
                  }).length
                },
                { id: 'personal', label: t('Công việc cá nhân'), icon: <User size={14} />, count: wsTasks.filter(task => {
                    const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
                    return tagsList.includes('personal_task');
                  }).length
                }
              ].map(tab => {
                const isSelected = wsSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setWsSubTab(tab.id as any);
                      setWsTeamSubFilter('all');
                    }}
                    style={{
                      padding: '6px 16px',
                      height: '34px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: 'transparent',
                      color: isSelected ? 'var(--color-text)' : 'var(--color-text-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      position: 'relative',
                      outline: 'none',
                      boxShadow: 'none',
                      flexShrink: 0,
                      zIndex: 2,
                      transition: 'color 0.2s ease'
                    }}
                  >
                    {isSelected && (
                      <motion.div 
                        layoutId="activeWsSubTabIndicator"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'var(--color-surface)',
                          borderRadius: '6px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          zIndex: 1
                        }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    
                    <span style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {tab.icon}
                      <span>{tab.label}</span>
                    </span>
                    
                    <span style={{
                      position: 'relative',
                      zIndex: 2,
                      fontSize: '0.75rem',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      background: isSelected ? 'var(--color-border-light)' : 'rgba(0, 0, 0, 0.04)',
                      color: isSelected ? 'var(--color-text)' : 'var(--color-text-muted)',
                      fontWeight: 800,
                      transition: 'background 0.2s ease, color 0.2s ease'
                    }}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Team sub-filters */}
        {wsSubTab === 'team' && (
          <div className="no-scrollbar" style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: isMobile ? '4px 0' : '8px 12px',
            background: isMobile ? 'transparent' : 'var(--color-surface)',
            border: isMobile ? 'none' : '1px solid var(--color-border-light)',
            borderRadius: '12px',
            width: '100%',
            marginBottom: '0.75rem'
          }}>
            {!isMobile && (
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', marginRight: '6px', whiteSpace: 'nowrap' }}>
                {t('Phân loại nội bộ:')}
              </span>
            )}
            {[
              { id: 'all', label: t('Tất cả'), color: 'var(--color-text-light)' },
              { id: 'task', label: t('Nhiệm vụ'), color: 'var(--color-success)' },
              { id: 'announcement', label: t('Thông báo'), color: 'var(--color-primary)' },
              { id: 'campaign', label: t('Chiến dịch'), color: '#db2777' },
              { id: 'policy', label: t('Chính sách'), color: '#ea580c' }
            ].map(sub => {
              const isSelected = wsTeamSubFilter === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setWsTeamSubFilter(sub.id as any)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: isSelected ? sub.color : 'rgba(128, 128, 128, 0.12)',
                    color: isSelected ? 'white' : 'var(--color-text-light)',
                    whiteSpace: 'nowrap'
                  }}
                  className="hover-lift"
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        )}

        {uncontactedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: isMobile ? '10px' : '16px',
              padding: isMobile ? '8px 12px' : '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: isMobile ? '8px' : '1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 20px -6px rgba(239, 68, 68, 0.08)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              marginBottom: '0.75rem'
            }}
            whileHover={{ 
              scale: 1.005, 
              borderColor: 'rgba(239, 68, 68, 0.45)',
              boxShadow: '0 8px 30px -6px rgba(239, 68, 68, 0.15)'
            }}
            onClick={() => {
              navigate('/contacts?status=not_contacted');
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '1rem', flex: 1, minWidth: 0 }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                width: isMobile ? 32 : 44,
                height: isMobile ? 32 : 44,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: 'inset 0 2px 4px rgba(239, 68, 68, 0.06)'
              }}>
                <AlertCircle size={isMobile ? 16 : 24} className="animate-pulse" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: isMobile ? '0.8rem' : '1rem', color: 'var(--color-text)', display: 'block', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isMobile ? t('Liên hệ khách hàng mới') : t('Yêu cầu liên hệ khách hàng mới')}
                </span>
                <span style={{ fontSize: isMobile ? '0.72rem' : '0.85rem', color: 'var(--color-text-muted)', marginTop: isMobile ? 1 : 4, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isMobile ? (
                    <>Có <strong style={{ color: '#ef4444', fontSize: '1.2em', fontWeight: 800 }}>{uncontactedCount}</strong> khách hàng chưa liên hệ.</>
                  ) : (
                    <>Bạn đang có <strong style={{ color: '#ef4444', fontSize: '1.2em', fontWeight: 800 }}>{uncontactedCount}</strong> data khách hàng chưa liên hệ. Vui lòng kiểm tra và liên hệ ngay.</>
                  )}
                </span>
              </div>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: isMobile ? '26px' : undefined,
              height: isMobile ? '26px' : undefined,
              gap: isMobile ? '0' : '6px', 
              color: '#ef4444', 
              fontWeight: 800, 
              fontSize: '0.875rem',
              background: 'rgba(239, 68, 68, 0.08)',
              padding: isMobile ? '0' : '8px 16px',
              borderRadius: isMobile ? '50%' : '10px',
              transition: 'background 0.2s',
              flexShrink: 0
            }}>
              {!isMobile && <span>Xem ngay</span>}
              <ChevronRight size={isMobile ? 12 : 16} />
            </div>
          </motion.div>
        )}

        {pendingCoopsCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: isMobile ? '10px' : '16px',
              padding: isMobile ? '8px 12px' : '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: isMobile ? '8px' : '1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 20px -6px rgba(16, 185, 129, 0.08)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              marginBottom: '0.75rem'
            }}
            whileHover={{ 
              scale: 1.005, 
              borderColor: 'rgba(16, 185, 129, 0.45)',
              boxShadow: '0 8px 30px -6px rgba(16, 185, 129, 0.15)'
            }}
            onClick={() => {
              navigate('/cooperation-slips');
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '1rem', flex: 1, minWidth: 0 }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                width: isMobile ? 32 : 44,
                height: isMobile ? 32 : 44,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: 'inset 0 2px 4px rgba(16, 185, 129, 0.06)'
              }}>
                <Scale size={isMobile ? 16 : 24} className="animate-pulse" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: isMobile ? '0.8rem' : '1rem', color: 'var(--color-text)', display: 'block', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isMobile ? t('Ký phiếu hợp tác') : t('Yêu cầu ký phiếu hợp tác chia hoa hồng')}
                </span>
                <span style={{ fontSize: isMobile ? '0.72rem' : '0.85rem', color: 'var(--color-text-muted)', marginTop: isMobile ? 1 : 4, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isMobile 
                    ? `Có ${pendingCoopsCount} phiếu chờ ký xác nhận.` 
                    : `Bạn đang có ${pendingCoopsCount} phiếu hợp tác hoa hồng đang chờ ký xác nhận. Vui lòng ký ngay.`}
                </span>
              </div>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: isMobile ? '26px' : undefined,
              height: isMobile ? '26px' : undefined,
              gap: isMobile ? '0' : '6px', 
              color: '#10b981', 
              fontWeight: 800, 
              fontSize: '0.875rem',
              background: 'rgba(16, 185, 129, 0.08)',
              padding: isMobile ? '0' : '8px 16px',
              borderRadius: isMobile ? '50%' : '10px',
              transition: 'background 0.2s',
              flexShrink: 0
            }}>
              {!isMobile && <span>Ký ngay</span>}
              <ChevronRight size={isMobile ? 12 : 16} />
            </div>
          </motion.div>
        )}

        {/* 2-Card Header Layout: AI Priority + Upcoming Meetings */}
        {(() => {
          const todayStr = new Date().toISOString().slice(0, 10);
          const uid = currentUser?.id ? Number(currentUser.id) : 0;

          const isMyTask = (t: any) => {
            if (!uid) return false;
            const assignee = Number(t.assignee_id || t.user_id || 0);
            return assignee === uid;
          };

          const myOverdueCount = (wsTasks || []).filter((t: any) => t.status !== 'done' && isMyTask(t) && t.due_date && t.due_date.slice(0, 10) < todayStr).length;
          const myDueTodayCount = (wsTasks || []).filter((t: any) => t.status !== 'done' && isMyTask(t) && t.due_date && t.due_date.slice(0, 10) === todayStr).length;
          const myHighPriorityTask = (wsTasks || []).find((t: any) => t.status !== 'done' && isMyTask(t) && (t.priority === 'high' || t.priority === 'urgent'));

          const totalOverdueCount = workspaceStats.overdue || 0;
          const totalDueTodayCount = workspaceStats.dueToday || 0;
          const teamHighPriorityTask = (wsTasks || []).find((t: any) => t.status !== 'done' && (t.priority === 'high' || t.priority === 'urgent'));

          let aiMessage = '';
          if (myOverdueCount > 0) {
            aiMessage = `Hôm nay bạn có ${myOverdueCount} công việc quá hạn cần xử lý gấp. Bạn nên ưu tiên hoàn thành trước để đảm bảo tiến độ!`;
          } else if (myHighPriorityTask) {
            aiMessage = `Bạn có 1 công việc ưu tiên cao (${myHighPriorityTask.subject || 'Nhiệm vụ quan trọng'}) cần tập trung xử lý ngay.`;
          } else if (myDueTodayCount > 0) {
            aiMessage = `Hôm nay bạn có ${myDueTodayCount} công việc đến hạn cần hoàn thành đúng kế hoạch.`;
          } else if (totalOverdueCount > 0) {
            aiMessage = `Toàn đội ngũ hiện có ${totalOverdueCount} công việc quá hạn cần đôn đốc xử lý.`;
          } else if (teamHighPriorityTask) {
            aiMessage = `Hệ thống có 1 công việc ưu tiên cao (${teamHighPriorityTask.subject || 'Nhiệm vụ quan trọng'}) cần theo dõi.`;
          } else if (totalDueTodayCount > 0) {
            aiMessage = `Hôm nay toàn đội ngũ có ${totalDueTodayCount} công việc đến hạn cần hoàn thành.`;
          } else {
            aiMessage = `Hệ thống vận hành tối ưu. Các công việc hiện được sắp xếp đúng kế hoạch.`;
          }

          let mobileAiMessage = '';
          if (myOverdueCount > 0) {
            mobileAiMessage = `${myOverdueCount} việc quá hạn cần làm`;
          } else if (myHighPriorityTask) {
            mobileAiMessage = `1 việc ưu tiên cao`;
          } else if (myDueTodayCount > 0) {
            mobileAiMessage = `${myDueTodayCount} việc đến hạn`;
          } else if (totalOverdueCount > 0) {
            mobileAiMessage = `${totalOverdueCount} việc quá hạn đội ngũ`;
          } else if (teamHighPriorityTask) {
            mobileAiMessage = `1 việc ưu tiên cao`;
          } else if (totalDueTodayCount > 0) {
            mobileAiMessage = `${totalDueTodayCount} việc đến hạn`;
          } else {
            mobileAiMessage = `0 việc cần làm`;
          }

          const meetingCount = upcomingMeetingsList.length;

          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: isMobile ? '8px' : '1rem',
              marginBottom: '0.75rem'
            }}>
              {/* CARD 1: GỢI Ý ƯU TIÊN TỪ AI */}
              <div style={{
                background: 'var(--color-surface, #ffffff)',
                border: '1px solid var(--color-border)',
                borderRadius: isMobile ? '10px' : '14px',
                padding: isMobile ? '8px' : '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: isMobile ? '4px' : '1rem',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: isMobile ? '26px' : '38px',
                    height: isMobile ? '26px' : '38px',
                    borderRadius: isMobile ? '6px' : '10px',
                    background: '#f1f5f9',
                    color: 'var(--color-primary, #BD1D2D)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Sparkles size={isMobile ? 13 : 18} />
                  </div>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: isMobile ? '0.6rem' : '0.725rem', fontWeight: 800, color: 'var(--color-primary, #BD1D2D)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>
                      {isMobile ? t('GỢI Ý AI') : t('GỢI Ý ƯU TIÊN TỪ AI')}
                    </span>
                    <span style={{ fontSize: isMobile ? '0.725rem' : '0.85rem', fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap', marginTop: '1px', lineHeight: 1.15 }}>
                      {isMobile ? mobileAiMessage : aiMessage}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStartFocusSession}
                  style={{
                    background: 'rgba(189, 29, 45, 0.08)',
                    border: '1px solid rgba(189, 29, 45, 0.2)',
                    color: 'var(--color-primary, #BD1D2D)',
                    padding: isMobile ? '4px 7px' : '7px 14px',
                    fontSize: isMobile ? '0.68rem' : '0.8rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.2s'
                  }}
                  className="hover-bg-light"
                >
                  <Play size={isMobile ? 10 : 13} />
                  <span>{isMobile ? t('Xử lý') : t('Xử lý ngay')}</span>
                </button>
              </div>

              {/* CARD 2: CUỘC HẸN GẶP SẮP DIỄN RA */}
              <div style={{
                background: 'var(--color-surface, #ffffff)',
                border: '1px solid var(--color-border)',
                borderRadius: isMobile ? '10px' : '14px',
                padding: isMobile ? '8px' : '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: isMobile ? '4px' : '1rem',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: isMobile ? '26px' : '38px',
                    height: isMobile ? '26px' : '38px',
                    borderRadius: isMobile ? '6px' : '10px',
                    background: '#f1f5f9',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Calendar size={isMobile ? 13 : 18} />
                  </div>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: isMobile ? '0.6rem' : '0.725rem', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>
                      {isMobile ? t('LỊCH HẸN') : t('LỊCH HẸN GẶP SẮP DIỄN RA')}
                    </span>
                    <span style={{ fontSize: isMobile ? '0.725rem' : '0.85rem', fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', whiteSpace: 'nowrap', marginTop: '1px', lineHeight: 1.15 }}>
                      {meetingCount > 0 
                        ? (isMobile ? `${meetingCount} cuộc hẹn` : `Có ${meetingCount} cuộc hẹn gặp khách hàng đã được lên lịch trong kế hoạch.`)
                        : (isMobile ? `0 cuộc hẹn` : t('Chưa có lịch hẹn'))}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUpcomingMeetingsModal(true)}
                  style={{
                    background: 'rgba(37, 99, 235, 0.08)',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    color: '#2563EB',
                    padding: isMobile ? '4px 7px' : '7px 14px',
                    fontSize: isMobile ? '0.68rem' : '0.8rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.2s'
                  }}
                  className="hover-bg-light"
                >
                  <Eye size={isMobile ? 10 : 13} />
                  <span>{isMobile ? t('Xem') : t('Xem danh sách')}</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Consolidated Workspace Toolbar Row (Pills + Search + Filters + View Controls) */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: isMobile ? '12px' : '16px',
          padding: isMobile ? '8px 10px' : '0.625rem 0.875rem',
          boxShadow: '0 4px 20px -8px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '8px' : '0.625rem',
          marginBottom: '1rem'
        }}>
          {/* Top Group: Horizontal Scrollable Status Pills & Team Dropdown */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            width: '100%',
            paddingBottom: isMobile ? '2px' : '0'
          }} className="custom-scrollbar-hidden">
            {/* Overdue Pill */}
            <div 
              onClick={() => {
                setWsDatePreset('overdue');
                setWsStatus('planned');
                setWsTaskFilter('all');
              }}
              style={{
                padding: isMobile ? '4px 10px' : '5px 12px',
                borderRadius: '20px',
                border: wsDatePreset === 'overdue' ? '1.5px solid var(--color-danger)' : '1px solid var(--color-border)',
                background: wsDatePreset === 'overdue' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                color: 'var(--color-danger)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: isMobile ? '0.725rem' : '0.78rem',
                fontWeight: 700,
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <Clock size={isMobile ? 12 : 13} />
              <span>{t('Quá hạn')}</span>
              <span style={{ background: 'var(--color-danger)', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.675rem', fontWeight: 800 }}>
                {workspaceStats.overdue}
              </span>
            </div>

            {/* Due Today Pill */}
            <div 
              onClick={() => {
                setWsDatePreset('today');
                setWsStatus('planned');
                setWsTaskFilter('all');
              }}
              style={{
                padding: isMobile ? '4px 10px' : '5px 12px',
                borderRadius: '20px',
                border: wsDatePreset === 'today' ? '1.5px solid var(--color-warning)' : '1px solid var(--color-border)',
                background: wsDatePreset === 'today' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                color: 'var(--color-warning)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: isMobile ? '0.725rem' : '0.78rem',
                fontWeight: 700,
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <Calendar size={isMobile ? 12 : 13} />
              <span>{t('Đến hạn')}</span>
              <span style={{ background: 'var(--color-warning)', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.675rem', fontWeight: 800 }}>
                {workspaceStats.dueToday}
              </span>
            </div>

            {/* Upcoming Pill */}
            <div 
              onClick={() => {
                setWsDatePreset('tomorrow');
                setWsStatus('planned');
                setWsTaskFilter('all');
              }}
              style={{
                padding: isMobile ? '4px 10px' : '5px 12px',
                borderRadius: '20px',
                border: wsDatePreset === 'tomorrow' ? '1.5px solid var(--color-info)' : '1px solid var(--color-border)',
                background: wsDatePreset === 'tomorrow' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: 'var(--color-info)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: isMobile ? '0.725rem' : '0.78rem',
                fontWeight: 700,
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowUpRight size={isMobile ? 12 : 13} />
              <span>{t('Sắp đến hạn')}</span>
              <span style={{ background: 'var(--color-info)', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.675rem', fontWeight: 800 }}>
                {workspaceStats.upcoming}
              </span>
            </div>

            {/* Waiting Approval Pill */}
            <div 
              onClick={() => {
                setWsTaskFilter('approve_by_me');
                setWsStatus('all');
                setWsDatePreset('all');
              }}
              style={{
                padding: isMobile ? '4px 10px' : '5px 12px',
                borderRadius: '20px',
                border: wsTaskFilter === 'approve_by_me' ? '1.5px solid #8b5cf6' : '1px solid var(--color-border)',
                background: wsTaskFilter === 'approve_by_me' ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                color: '#8b5cf6',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: isMobile ? '0.725rem' : '0.78rem',
                fontWeight: 700,
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              <UserCheck size={isMobile ? 12 : 13} />
              <span>{t('Chờ tôi duyệt')}</span>
              <span style={{ background: '#8b5cf6', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.675rem', fontWeight: 800 }}>
                {workspaceStats.pendingApproval}
              </span>
            </div>

            {/* Team Selector Dropdown Pill */}
            {isAdminOrManager && teamsList.length > 0 && (() => {
              const selectedTeam = teamsList.find(t => String(t.id) === String(wsTeamId));
              return (
                <div ref={wsTeamFilterDropdownRef} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setShowWsTeamFilterDropdown(!showWsTeamFilterDropdown)}
                    style={{
                      height: isMobile ? '28px' : '32px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      borderRadius: '20px',
                      padding: '2px 8px 2px 4px',
                      border: '1.5px solid var(--color-primary, #BD1D2D)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: isMobile ? '0.725rem' : '0.78rem',
                      boxShadow: '0 2px 8px rgba(189, 29, 45, 0.08)'
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: (selectedTeam?.avatar_url || selectedTeam?.avatar) ? 'transparent' : 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                      color: '#ffffff',
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      border: (selectedTeam?.avatar_url || selectedTeam?.avatar) ? '1px solid var(--color-border-light)' : 'none',
                      flexShrink: 0
                    }}>
                      {(selectedTeam?.avatar_url || selectedTeam?.avatar) ? (
                        <img src={selectedTeam.avatar_url || selectedTeam.avatar} alt="Team" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        selectedTeam ? (selectedTeam.name?.[0] || 'T') : 'ALL'
                      )}
                    </div>
                    <span>{selectedTeam ? selectedTeam.name : t('Tất cả Nhóm')}</span>
                    <ChevronDown size={12} style={{ opacity: 0.7 }} />
                  </button>

                  {showWsTeamFilterDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '6px',
                      width: '280px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 1000,
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div>
                        <input
                          type="text"
                          className="form-input"
                          placeholder={t('Tìm kiếm nhóm...')}
                          value={wsTeamFilterSearch}
                          onChange={e => setWsTeamFilterSearch(e.target.value)}
                          style={{ width: '100%', fontSize: '0.78rem', padding: '6px 10px', height: '32px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                        />
                      </div>
                      <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }} className="custom-scrollbar">
                        {/* Option: Tất cả các Nhóm */}
                        <div
                          onClick={() => {
                            setWsTeamId('all_teams_bypass');
                            setShowWsTeamFilterDropdown(false);
                            setWsTeamFilterSearch('');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            background: (!wsTeamId || wsTeamId === 'all_teams_bypass') ? 'rgba(189, 29, 45, 0.05)' : 'transparent',
                            fontWeight: (!wsTeamId || wsTeamId === 'all_teams_bypass') ? 600 : 400
                          }}
                          className="hover-bg-light"
                        >
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            flexShrink: 0
                          }}>
                            ALL
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>{t('Tất cả các Nhóm')}</span>
                        </div>

                        {/* Filtered Teams */}
                        {(() => {
                          const filtered = teamsList.filter((tm: any) =>
                            (tm.name || '').toLowerCase().includes(wsTeamFilterSearch.toLowerCase())
                          );
                          if (filtered.length === 0 && wsTeamFilterSearch) {
                            return (
                              <div style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                {t('Không tìm thấy nhóm')}
                              </div>
                            );
                          }
                          return filtered.map((tm: any) => {
                            const isSelected = String(tm.id) === String(wsTeamId);
                            return (
                              <div
                                key={tm.id}
                                onClick={() => {
                                  setWsTeamId(String(tm.id));
                                  setShowWsTeamFilterDropdown(false);
                                  setWsTeamFilterSearch('');
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  background: isSelected ? 'rgba(189, 29, 45, 0.05)' : 'transparent',
                                  fontWeight: isSelected ? 600 : 400
                                }}
                                className="hover-bg-light"
                              >
                                <div style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: (tm.avatar_url || tm.avatar) ? 'transparent' : 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                                  color: '#ffffff',
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  border: (tm.avatar_url || tm.avatar) ? '1px solid var(--color-border-light)' : 'none',
                                  flexShrink: 0
                                }}>
                                  {(tm.avatar_url || tm.avatar) ? (
                                    <img src={tm.avatar_url || tm.avatar} alt="Team" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    tm.name?.[0] || 'T'
                                  )}
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {tm.name}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Controls Group: Search + Advanced Filters Trigger + Segmented Control + View Modes */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            width: '100%'
          }}>
            {/* Search Input & Filter Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: isMobile ? '100%' : '260px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tìm theo tên, mô tả..."
                  value={wsSearch}
                  onChange={e => setWsSearch(e.target.value)}
                  style={{ height: isMobile ? '34px' : '38px', fontSize: isMobile ? '0.78rem' : '0.85rem', padding: '6px 10px', borderRadius: '8px', width: '100%' }}
                />
              </div>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                style={{
                  height: isMobile ? '34px' : '38px',
                  padding: isMobile ? '0 10px' : '0 12px',
                  borderRadius: '8px',
                  border: showAdvancedFilters ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: showAdvancedFilters ? 'var(--color-primary-light)' : 'transparent',
                  color: showAdvancedFilters ? 'var(--color-primary)' : 'var(--color-text)',
                  fontSize: isMobile ? '0.75rem' : '0.8rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                <Filter size={isMobile ? 13 : 14} />
                <span>{t('Bộ lọc')}</span>
                {(() => {
                  let count = 0;
                  if (wsPriority) count++;
                  if (wsStatus && wsStatus !== 'planned') count++;
                  if (wsDatePreset && wsDatePreset !== 'all') count++;
                  if (wsTeamId) count++;
                  if (wsUserId) count++;
                  return count > 0 ? (
                    <span style={{
                      background: 'var(--color-primary)',
                      color: 'white',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: '2px'
                    }}>
                      {count}
                    </span>
                  ) : null;
                })()}
              </button>
            </div>

            {/* Segmented Control & View Mode Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', width: isMobile ? '100%' : 'auto', justifyContent: 'space-between' }}>
              <div className="segmented-control-wrapper" style={{ flex: isMobile ? 1 : 'none' }}>
                <div style={{ display: 'flex', gap: '2px', background: 'var(--color-border-light)', border: '1px solid var(--color-border)', padding: '2px', borderRadius: '8px', width: isMobile ? '100%' : 'fit-content', position: 'relative' }}>
                  {[
                    { value: 'all', label: t('Tất cả') },
                    { value: 'assigned_to_me', label: isMobile ? t('Tôi làm') : t('Tôi thực hiện') },
                    currentUser && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'vp', 'leader', 'assistant'].includes(String(currentUser.role).toLowerCase()) && { value: 'approve_by_me', label: isMobile ? t('Tôi duyệt') : t('Tôi duyệt') },
                    { value: 'collaborator', label: isMobile ? t('Liên quan') : t('Tôi liên quan') }
                  ].filter((tab): tab is { value: string; label: string } => !!tab).map(tab => {
                    const isSelected = wsTaskFilter === tab.value;
                    return (
                      <button
                        key={tab.value}
                        onClick={() => setWsTaskFilter(tab.value as any)}
                        style={{
                          flex: isMobile ? 1 : 'none',
                          width: isMobile ? 'auto' : '110px',
                          height: isMobile ? '26px' : '28px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: isMobile ? '0.725rem' : '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: isSelected ? 'var(--color-surface)' : 'transparent',
                          color: isSelected ? 'var(--color-text)' : 'var(--color-text-light)',
                          boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          outline: 'none',
                          padding: isMobile ? '0 4px' : '0 8px',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!isMobile && (
                <div style={{
                  display: 'flex',
                  background: 'var(--color-border-light)',
                  border: '1px solid var(--color-border)',
                  padding: '2px',
                  borderRadius: '8px',
                  gap: '2px'
                }}>
                  <button
                    onClick={() => setWsViewMode('grid')}
                    title={t('Dạng lưới')}
                    style={{
                      width: '32px',
                      height: '28px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: wsViewMode === 'grid' ? 'var(--color-surface)' : 'transparent',
                      color: wsViewMode === 'grid' ? 'var(--color-text)' : 'var(--color-text-light)',
                      boxShadow: wsViewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      outline: 'none',
                      transform: 'none'
                    }}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setWsViewMode('kanban')}
                    title={t('Dạng Kanban')}
                    style={{
                      width: '32px',
                      height: '28px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: wsViewMode === 'kanban' ? 'var(--color-surface)' : 'transparent',
                      color: wsViewMode === 'kanban' ? 'var(--color-text)' : 'var(--color-text-light)',
                      boxShadow: wsViewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      outline: 'none',
                      transform: 'none'
                    }}
                  >
                    <Layers size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Advanced Dropdown Filters (Collapsible) */}
          <AnimatePresence>
            {showAdvancedFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: showAdvancedFilters ? 'visible' : 'hidden' }}
              >
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
                  gap: '14px',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--color-border-light)'
                }}>
                  {/* Priority Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Độ ưu tiên')}</label>
                    <CustomSelect
                      options={[
                        { value: '', label: t('Tất cả độ ưu tiên') },
                        { value: 'high', label: t('Cao') },
                        { value: 'medium', label: t('Trung bình') },
                        { value: 'low', label: t('Thấp') }
                      ]}
                      value={wsPriority}
                      onChange={val => setWsPriority(String(val))}
                    />
                  </div>

                  {/* Status Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Trạng thái')}</label>
                    <CustomSelect
                      options={[
                        { value: 'planned', label: t('Chưa hoàn thành') },
                        { value: '', label: t('Tất cả trạng thái') },
                        { value: 'done', label: t('Đã hoàn thành') }
                      ]}
                      value={wsStatus}
                      onChange={val => setWsStatus(String(val))}
                    />
                  </div>

                  {/* Date Preset Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Thời gian hạn')}</label>
                    <CustomSelect
                      options={[
                        { value: 'all', label: t('Tất cả thời gian') },
                        { value: 'today', label: t('Hôm nay') },
                        { value: 'tomorrow', label: t('Ngày mai') },
                        { value: 'week', label: t('Tuần này') },
                        { value: '7_days', label: t('7 ngày qua') },
                        { value: '30_days', label: t('30 ngày qua') },
                        { value: 'this_month', label: t('Tháng này') },
                        { value: 'last_month', label: t('Tháng trước') },
                        { value: 'overdue', label: t('Quá hạn') },
                        { value: 'custom', label: t('Tùy chỉnh ngày...') }
                      ]}
                      value={wsDatePreset}
                      onChange={val => setWsDatePreset(String(val))}
                    />
                  </div>

                  {/* Activity Type Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Phân loại công việc')}</label>
                    <CustomSelect
                      options={[
                        { value: 'task', label: t('Nhiệm vụ (Tasks)') },
                        { value: 'all', label: t('Tất cả phân loại') },
                        { value: 'call', label: t('Cuộc gọi (Calls)') },
                        { value: 'email', label: t('Emails') },
                        { value: 'meeting', label: t('Cuộc gặp') },
                        { value: 'note', label: t('Ghi chú') }
                      ]}
                      value={wsActivityType}
                      onChange={val => setWsActivityType(String(val))}
                    />
                  </div>

                  {/* Related Type Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Liên quan đến')}</label>
                    <CustomSelect
                      options={[
                        { value: '', label: t('Tất cả đối tượng') },
                        { value: 'contact', label: t('Khách hàng (Contacts)') },
                        { value: 'company', label: t('Pháp nhân (Companies)') },
                        { value: 'deal', label: t('Giao dịch (Deals)') }
                      ]}
                      value={wsRelatedType}
                      onChange={val => setWsRelatedType(String(val))}
                    />
                  </div>

                  {/* Team filter (Admin/Manager only) */}
                  {['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes(currentUser?.role || '') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Nhóm')}</label>
                      <CustomSelect
                        options={teamOptions}
                        value={wsTeamId}
                        onChange={val => { setWsTeamId(String(val)); setWsUserId(''); }}
                      />
                    </div>
                  )}

                  {/* Consultant filter (Admin/Manager only) */}
                  {['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes(currentUser?.role || '') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Nhân viên')}</label>
                      <CustomSelect
                        options={consultantOptions}
                        value={wsUserId}
                        onChange={val => setWsUserId(String(val))}
                        showAvatars
                        searchable
                        align="right"
                      />
                    </div>
                  )}
                </div>

                {/* Custom Date Pickers */}
                {wsDatePreset === 'custom' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '0.75rem 0 0 0',
                    marginTop: '0.5rem',
                    borderTop: '1px dashed var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Từ ngày:')}</span>
                      <input
                        type="date"
                        className="form-input"
                        value={wsStartDate}
                        onChange={e => setWsStartDate(e.target.value)}
                        style={{ height: '36px', width: '140px', padding: '4px 8px', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Đến ngày:')}</span>
                      <input
                        type="date"
                        className="form-input"
                        value={wsEndDate}
                        onChange={e => setWsEndDate(e.target.value)}
                        style={{ height: '36px', width: '140px', padding: '4px 8px', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                )}

                {/* Clear Filter Toolbar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px dashed var(--color-border-light)',
                  gap: '8px'
                }}>
                  <button
                    type="button"
                    className="btn outline sm"
                    onClick={() => {
                      setWsPriority('');
                      setWsStatus('planned');
                      setWsDatePreset('all');
                      setWsStartDate('');
                      setWsEndDate('');
                      setWsTeamId('');
                      setWsUserId('');
                      setWsActivityType('task');
                      setWsRelatedType('');
                      setWsSearch('');
                      toast.success(t('Đã reset toàn bộ bộ lọc'));
                    }}
                    style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                  >
                    {t('Xóa bộ lọc')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </>)}

        {/* Task Grid */}
        {isAdminOrManager && !wsTeamId && wsSubTab !== 'personal' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              {t('Vui lòng chọn một Nhóm để xem chi tiết công việc:')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '1.25rem' }}>
              {/* Card for "Tất cả các Nhóm" */}
              <div
                onClick={() => setWsTeamId('all_teams_bypass')}
                style={{
                  padding: '1.5rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all var(--transition-fluid)',
                  cursor: 'pointer',
                  justifyContent: 'center',
                  minHeight: '140px'
                }}
                className="hover-lift active-press"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '10px', background: 'rgba(189, 29, 45, 0.08)', borderRadius: '10px', color: 'var(--color-primary)', display: 'flex' }}>
                    <Layers size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-text)', margin: 0 }}>
                      {t('Tất cả các Nhóm')}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                      {t('Xem toàn bộ công việc hệ thống')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Individual Team Cards */}
              {teamsList.map(team => {
                const teamMembers = users.filter(u => String(u.team_id) === String(team.id));
                const leaderUser = users.find(u => Number(u.id) === Number(team.leader_id));
                
                return (
                  <div
                    key={team.id}
                    onClick={() => setWsTeamId(String(team.id))}
                    style={{
                      padding: '1.25rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      minHeight: '150px',
                      justifyContent: 'space-between'
                    }}
                    className="hover-lift active-press"
                  >
                    <div>
                      {/* Header row: Team Name */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>
                          {team.name}
                        </h3>
                        {team.branch && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            <Building2 size={12} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.2 }}>
                              {team.branch}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Leader details */}
                      <div style={{ marginTop: '0.625rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <span>Manager:</span>
                        {leaderUser ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Avatar src={leaderUser.avatar_url || leaderUser.avatar} name={leaderUser.full_name || leaderUser.username || leaderUser.name} size={18} />
                            <strong style={{ color: 'var(--color-text)' }}>{leaderUser.full_name || leaderUser.username || leaderUser.name}</strong>
                          </div>
                        ) : (
                          <strong style={{ color: 'var(--color-text)' }}>{team.leader_name || t('Chưa gán')}</strong>
                        )}
                      </div>
                    </div>

                    {/* Footer row: Member Avatar Stack & Total Count */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dotted var(--color-border-light)', paddingTop: '0.625rem', marginTop: '4px' }}>
                      {/* Avatar Stack */}
                      <div className="avatar-stack" style={{ display: 'flex', alignItems: 'center' }}>
                        {teamMembers.slice(0, 5).map((member, index) => (
                          <div
                            key={member.id}
                            style={{
                              marginLeft: index > 0 ? '-8px' : '0',
                              zIndex: 10 - index,
                              position: 'relative'
                            }}
                          >
                            <Avatar
                              src={member.avatar_url || member.avatar}
                              name={member.full_name || member.username || member.name}
                              size={24}
                              style={{ border: '2px solid var(--color-surface)' }}
                            />
                          </div>
                        ))}
                        {teamMembers.length > 5 && (
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: 'var(--color-bg-light)',
                              border: '2px solid var(--color-surface)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              color: 'var(--color-text-muted)',
                              marginLeft: '-8px',
                              zIndex: 4,
                              position: 'relative'
                            }}
                          >
                            +{teamMembers.length - 5}
                          </div>
                        )}
                        {teamMembers.length === 0 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            {t('Không có thành viên')}
                          </span>
                        )}
                      </div>

                      {/* Total Count */}
                      {teamMembers.length > 0 && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {teamMembers.length} sales
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Back button when inside a team view */}
            {((isAdminOrManager && wsTeamId && wsSubTab !== 'personal') && wsViewMode !== 'focus') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem', background: 'var(--color-surface)', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)' }}>
                <button
                  onClick={() => {
                    setWsTeamId('');
                  }}
                  style={{
                    height: 38,
                    borderRadius: '10px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-light)',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: isMobile ? '0' : '8px',
                    padding: isMobile ? '0 12px' : '0 16px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    boxShadow: 'var(--shadow-xs)',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  className="hover-lift"
                >
                  <ArrowLeft size={15} /> {!isMobile && t('Quay lại')}
                </button>

                {wsTeamId && (
                  <>
                    <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', flexShrink: 0 }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {(() => {
                        const targetTeam = teamsList.find(t => String(t.id) === wsTeamId);
                        const teamName = wsTeamId === 'all_teams_bypass' ? t('Tất cả các Nhóm') : (targetTeam?.name || wsTeamId);
                        const teamAvatar = targetTeam?.avatar_url || targetTeam?.avatar;
                        return (
                          <>
                            {wsTeamId !== 'all_teams_bypass' && (
                              <div style={{ 
                                width: isMobile ? '30px' : '36px', 
                                height: isMobile ? '30px' : '36px', 
                                borderRadius: '10px', 
                                overflow: 'hidden', 
                                border: '1.5px solid var(--color-border-light)',
                                boxShadow: 'var(--shadow-xs)',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: teamAvatar ? 'transparent' : 'var(--color-primary-light, rgba(189, 29, 45, 0.1))',
                                color: 'var(--color-primary)'
                              }}>
                                {teamAvatar ? (
                                  <img src={teamAvatar} alt={teamName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <Avatar name={teamName} size={isMobile ? 30 : 36} />
                                )}
                              </div>
                            )}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: isMobile ? '0.625rem' : '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('ĐANG XEM NHÓM')}</span>
                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--color-primary)' }} />
                                <span style={{ fontSize: isMobile ? '0.625rem' : '0.7rem', fontWeight: 700, color: 'var(--color-primary)' }}>{t('Nội bộ')}</span>
                              </div>
                              <h4 style={{ fontSize: isMobile ? '0.85rem' : '0.95rem', fontWeight: 800, color: 'var(--color-text)', margin: '1px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? '160px' : 'none' }}>
                                {teamName}
                              </h4>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}

            {wsViewMode !== 'focus' && loadingWsTasks ? (
              wsViewMode === 'kanban' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
                  {[1, 2, 3].map((col) => (
                    <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-bg)', padding: '1rem', borderRadius: '12px' }}>
                      <CardSkeleton height={140} />
                      <CardSkeleton height={140} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <CardSkeleton key={i} height={150} />
                  ))}
                </div>
              )
            ) : wsViewMode !== 'focus' && filteredWsTasks.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)' }}>
            <CheckSquare size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Không tìm thấy công việc nào phù hợp với bộ lọc.</p>
          </div>
        ) : wsViewMode === 'grid' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {paginatedWsTasks.map(task => {
              const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0));
              const isToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();
              
              let dateBadgeColor = 'var(--color-text-muted)';
              let dateBadgeBg = 'var(--color-bg)';
              if (isOverdue) {
                dateBadgeColor = 'var(--color-danger)';
                dateBadgeBg = 'rgba(239, 68, 68, 0.08)';
              } else if (isToday) {
                dateBadgeColor = 'var(--color-warning)';
                dateBadgeBg = 'rgba(245, 158, 11, 0.08)';
              }

              const link = task.body && !task.body.startsWith('{"erp_task":') 
                ? (task.body.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m)?.[1]?.trim() || '') 
                : '';
              
              let description = '';
              if (task.body) {
                if (task.body.startsWith('{"erp_task":')) {
                  try {
                    const parsed = JSON.parse(task.body);
                    description = parsed.erp_task?.description || '';
                  } catch (e) {
                    description = task.body;
                  }
                } else {
                  description = task.body.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim();
                }
              }
              
              const progressVal = task.progress || 0;

              return (
                <div 
                  key={task.id} 
                  style={{
                    padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem',
                    background: 'var(--color-surface)',
                    border: isOverdue && task.status !== 'done' ? '1.5px solid var(--color-danger)' : '1px solid var(--color-border-light)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isMobile ? '0.5rem' : '0.75rem',
                    boxShadow: isOverdue && task.status !== 'done' ? 'var(--shadow-md), 0 0 12px rgba(239, 68, 68, 0.08)' : 'var(--shadow-sm)',
                    transition: 'all var(--transition-fluid)',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  className="hover-lift active-press"
                  onClick={() => {
                    const parsed = parseDescriptionAndChecklist(description);
                    const parsedTask = {
                      id: task.id,
                      title: task.subject,
                      done: task.status === 'done',
                      priority: task.priority,
                      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
                      link,
                      description: parsed.pureDescription,
                      user_id: task.user_id,
                      user_name: task.user_name || 'Hệ thống',
                      tags: task.tags || '',
                      participant_ids: task.participant_ids || '',
                      progress: task.progress || 0,
                      require_approval: task.require_approval || 0,
                      approver_id: task.approver_id,
                      approval_status: task.approval_status,
                      contact_id: task.contact_id,
                      contact_name: task.contact_name,
                      contact_avatar: task.contact_avatar,
                      related_type: task.related_type,
                      related_id: task.related_id,
                      body: task.body,
                      created_by: task.created_by,
                      created_by_name: task.created_by_name,
                      created_by_avatar: task.created_by_avatar
                    };
                    setChecklist(parsed.checklist);
                    setSelectedTaskForDetails(parsedTask);
                  }}
                >
                  {/* Top Tags & Priority */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {task.tags && task.tags.split(',').filter(Boolean).map((tag: string) => {
                        return (
                          <span 
                            key={tag} 
                            style={{ 
                              fontSize: '0.65rem', 
                              padding: '1px 6px', 
                              borderRadius: '20px', 
                              background: 'var(--color-bg)', 
                              color: 'var(--color-text-light)', 
                              fontWeight: 700 
                            }}
                          >
                            #{tag.trim()}
                          </span>
                        );
                      })}
                    </div>
                    {task.priority === 'high' && (
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '1px 6px', borderRadius: '20px', background: 'var(--color-danger-light)', color: 'var(--color-danger)', flexShrink: 0 }}>
                        {t('Khẩn cấp')}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>
                      {task.subject}
                    </h3>
                    {description && (
                      <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        margin: 0,
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {description}
                      </p>
                    )}
                  </div>

                  {/* Progress Bar indicator */}
                  <div style={{ marginTop: 'auto', paddingTop: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Tiến độ:</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: progressVal === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>{progressVal}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--color-border-light)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${progressVal}%`, 
                          height: '100%', 
                          background: progressVal === 100 
                            ? 'var(--color-success)' 
                            : 'linear-gradient(90deg, #BD1D2D, #F97316)', 
                          borderRadius: '99px',
                          transition: 'width 0.4s var(--transition-fluid)' 
                        }} 
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border-light)', margin: '2px 0' }} />

                  {/* Footer metadata */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {task.due_date && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', color: dateBadgeColor, background: dateBadgeBg, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} /> {getDueDateLabel(task.due_date, task.status === 'done', t)}
                          {isOverdue && task.status !== 'done' && <ShieldAlert size={10} style={{ marginLeft: 2 }} />}
                        </span>
                      )}
                      
                      {task.related_type === 'contact' && task.related_id && (
                        <span
                          style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: '20px',
                            color: 'var(--color-text, #334155)', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', border: '1px solid var(--color-border-light, rgba(0,0,0,0.05))', display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenContactProfile(Number(task.related_id));
                          }}
                        >
                          <Avatar name={formatVietnameseFullName(task.contact_name || t('Khách hàng'))} size={14} />
                          {formatVietnameseFullName(task.contact_name || t('Khách hàng'))}
                        </span>
                      )}
                    </div>

                    {(() => {
                      const assigneeUser = users.find((u: any) => String(u.id) === String(task.user_id));
                      const approverUser = task.approver_id ? users.find((u: any) => String(u.id) === String(task.approver_id)) : null;
                      const participantIds = task.participant_ids ? task.participant_ids.split(',').filter(Boolean) : [];
                      const participantUsers = participantIds.map((id: string) => users.find((u: any) => String(u.id) === String(id))).filter(Boolean);

                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => {
                          if (participantUsers.length > 0) {
                            e.stopPropagation();
                            setSelectedTaskParticipants(participantUsers);
                            setParticipantsModalOpen(true);
                          }
                        }}>
                          {/* Assignee Avatar */}
                          {assigneeUser && (
                            <div title={`Chịu trách nhiệm: ${assigneeUser.full_name}`} style={{ position: 'relative', display: 'flex' }}>
                              <Avatar src={assigneeUser.avatar_url || assigneeUser.avatar} name={assigneeUser.full_name} size={24} />
                              <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--color-primary)', borderRadius: '50%', width: 10, height: 10, border: '1.5px solid var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                            </div>
                          )}

                          {/* Approver Avatar */}
                          {approverUser && (
                            <div title={`Người duyệt: ${approverUser.full_name}`} style={{ position: 'relative', display: 'flex' }}>
                              <Avatar src={approverUser.avatar_url || approverUser.avatar} name={approverUser.full_name} size={24} />
                              <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--color-warning)', borderRadius: '50%', width: 10, height: 10, border: '1.5px solid var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                            </div>
                          )}

                          {/* Overlapping Participant Avatars */}
                          {participantUsers.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', marginLeft: '2px', position: 'relative' }}>
                              {participantUsers.slice(0, 3).map((pUser: any, pIdx: number) => (
                                <div
                                  key={pUser.id}
                                  title={`Người liên quan: ${pUser.full_name}`}
                                  style={{
                                    marginLeft: pIdx > 0 ? '-8px' : '0px',
                                    border: '1.5px solid var(--color-surface)',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    zIndex: 10 - pIdx,
                                    display: 'flex'
                                  }}
                                >
                                  <Avatar src={pUser.avatar_url || pUser.avatar} name={pUser.full_name} size={22} />
                                </div>
                              ))}
                              {participantUsers.length > 3 && (
                                <div
                                  style={{
                                    marginLeft: '-8px',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    background: 'var(--color-border)',
                                    color: 'var(--color-text-muted)',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1.5px solid var(--color-surface)',
                                    zIndex: 5,
                                    cursor: 'pointer'
                                  }}
                                >
                                  +{participantUsers.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
            </div>
            {filteredWsTasks.length > wsTasksPageSize && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <Pagination
                  total={filteredWsTasks.length}
                  page={wsTasksPage}
                  pageSize={wsTasksPageSize}
                  onChange={setWsTasksPage}
                />
              </div>
            )}
          </>
        ) : wsViewMode === 'kanban' ? (
          /* Kanban View */
          <>
            {(() => {
              const todoTasks = filteredWsTasks.filter(t => t.status !== 'done' && (!t.progress || t.progress === 0));
              const inProgressTasks = filteredWsTasks.filter(t => t.status !== 'done' && t.progress > 0 && t.progress < 100);
              const doneTasks = filteredWsTasks.filter(t => t.status === 'done' || t.progress === 100);

              const renderKanbanColumn = (
                colId: 'todo' | 'in_progress' | 'done',
                title: string,
                columnTasks: any[],
                headerColor: string,
                bgColor: string
              ) => {
                const isOver = activeOverCol === colId;
                return (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (activeOverCol !== colId) setActiveOverCol(colId);
                    }}
                    onDragLeave={() => setActiveOverCol(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setActiveOverCol(null);
                      if (draggedTaskId !== null) {
                        handleTaskDrop(draggedTaskId, colId);
                      }
                    }}
                    style={{
                      background: '#f8fafc',
                      border: isOver ? '2px dashed var(--color-primary)' : '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '0.75rem',
                      minHeight: '450px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      transition: 'all 0.2s',
                      boxShadow: isOver ? '0 4px 12px rgba(189, 29, 45, 0.08)' : 'none',
                      width: '100%'
                    }}
                  >
                    {/* Column Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.375rem', borderBottom: '1px solid var(--color-border-light)', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: headerColor }}></span>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{title}</h4>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: bgColor, color: headerColor }}>
                        {columnTasks.length}
                      </span>
                    </div>

                    {/* Tasks List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1, overflowY: 'auto', maxHeight: '600px' }}>
                      {columnTasks.slice(0, 30).map(task => {
                        const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0));
                        const isToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();
                        
                        let dateBadgeColor = 'var(--color-text-muted)';
                        let dateBadgeBg = 'var(--color-bg)';
                        if (isOverdue) {
                          dateBadgeColor = 'var(--color-danger)';
                          dateBadgeBg = 'rgba(239, 68, 68, 0.08)';
                        } else if (isToday) {
                          dateBadgeColor = 'var(--color-warning)';
                          dateBadgeBg = 'rgba(245, 158, 11, 0.08)';
                        }

                        const link = task.body && !task.body.startsWith('{"erp_task":') 
                          ? (task.body.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m)?.[1]?.trim() || '') 
                          : '';
                        
                        let description = '';
                        if (task.body) {
                          if (task.body.startsWith('{"erp_task":')) {
                            try {
                              const parsed = JSON.parse(task.body);
                              description = parsed.erp_task?.description || '';
                            } catch (e) {
                              description = task.body;
                            }
                          } else {
                            description = task.body.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim();
                          }
                        }
                        
                        const progressVal = task.progress || 0;

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => setDraggedTaskId(task.id)}
                            onDragEnd={() => setDraggedTaskId(null)}
                            onClick={() => {
                              const parsed = parseDescriptionAndChecklist(description);
                              const parsedTask = {
                                id: task.id,
                                title: task.subject,
                                done: task.status === 'done',
                                priority: task.priority,
                                due_date: task.due_date ? task.due_date.slice(0, 10) : '',
                                link,
                                description: parsed.pureDescription,
                                user_id: task.user_id,
                                user_name: task.user_name || 'Hệ thống',
                                tags: task.tags || '',
                                participant_ids: task.participant_ids || '',
                                progress: task.progress || 0,
                                require_approval: task.require_approval || 0,
                                approver_id: task.approver_id,
                                approval_status: task.approval_status,
                                contact_id: task.contact_id,
                                contact_name: task.contact_name,
                                contact_avatar: task.contact_avatar,
                                related_type: task.related_type,
                                related_id: task.related_id,
                                body: task.body,
                                created_by: task.created_by,
                                created_by_name: task.created_by_name,
                                created_by_avatar: task.created_by_avatar
                              };
                              setChecklist(parsed.checklist);
                              setSelectedTaskForDetails(parsedTask);
                            }}
                            style={{
                              background: 'var(--color-surface)',
                              border: isOverdue && task.status !== 'done' ? '1.5px solid var(--color-danger)' : '1px solid var(--color-border-light)',
                              borderRadius: '12px',
                              padding: '0.875rem',
                              cursor: 'grab',
                              opacity: task.status === 'done' ? 0.7 : 1,
                              boxShadow: 'var(--shadow-sm)',
                              transition: 'all 0.2s',
                              position: 'relative'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = isOverdue && task.status !== 'done' ? 'var(--color-danger)' : 'var(--color-primary)';
                              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = isOverdue && task.status !== 'done' ? 'var(--color-danger)' : 'var(--color-border-light)';
                              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            }}
                          >
                            {/* Drag handle & header info */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '4px' }}>
                              <span className={`badge ${task.priority === 'high' ? 'danger' : 'warning'}`} style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                                {task.priority === 'high' ? 'Cao' : 'Trung bình'}
                              </span>
                            </div>

                            {/* Task Title */}
                            <p style={{ 
                              fontSize: '0.8125rem', 
                              fontWeight: 600, 
                              color: 'var(--color-text)', 
                              margin: '0 0 6px 0', 
                              textDecoration: task.status === 'done' ? 'line-through' : 'none',
                              lineHeight: '1.25'
                            }}>
                              {task.subject}
                            </p>

                            {/* Task Description */}
                            {description && (
                              <p style={{ 
                                fontSize: '0.75rem', 
                                color: 'var(--color-text-muted)', 
                                margin: '0 0 6px 0',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                lineHeight: '1.3'
                              }}>
                                {description}
                              </p>
                            )}

                            {/* Attachment Link */}
                            {link && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '6px' }} onClick={e => e.stopPropagation()}>
                                <Paperclip size={11} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                <a 
                                  href={link} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                  {link.includes('uploads/') ? link.split('/').pop().replace(/^\d+_/, '') : link}
                                </a>
                              </div>
                            )}

                            {/* Related Entity Badge */}
                            {task.related_type === 'contact' && task.related_id && (
                              <div style={{ marginBottom: '6px' }} onClick={e => e.stopPropagation()}>
                                <span
                                  style={{
                                    fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px',
                                    color: 'var(--color-text, #334155)', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', border: '1px solid var(--color-border-light, rgba(0,0,0,0.05))', display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => handleOpenContactProfile(Number(task.related_id))}
                                >
                                  <Avatar name={formatVietnameseFullName(task.contact_name || t('Khách hàng'))} size={12} />
                                  {formatVietnameseFullName(task.contact_name || t('Khách hàng'))}
                                </span>
                              </div>
                            )}

                            {/* Tags */}
                            {task.tags && (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                {task.tags.split(',').filter(Boolean).map((tag: string) => (
                                  <span 
                                    key={tag} 
                                    style={{ 
                                      fontSize: '0.65rem', 
                                      padding: '2px 8px', 
                                      borderRadius: '20px', 
                                      background: 'var(--color-bg)', 
                                      color: 'var(--color-text-light)', 
                                      fontWeight: 700 
                                    }}
                                  >
                                    #{tag.trim()}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Progress Bar indicator */}
                            <div style={{ marginTop: '0.375rem', paddingTop: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Tiến độ:</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: progressVal === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>{progressVal}%</span>
                              </div>
                              <div style={{ width: '100%', height: '12px', background: 'var(--color-border-light)', borderRadius: '99px', overflow: 'hidden' }}>
                                <div style={{ width: `${progressVal}%`, height: '100%', background: progressVal === 100 ? 'var(--color-success)' : 'linear-gradient(90deg, #BD1D2D, #F97316)', borderRadius: '99px', transition: 'width 0.4s var(--transition-fluid)' }} />
                              </div>
                            </div>

                            {/* Footer info (Due Date & Progress & Avatars) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '0.5rem', paddingTop: '0.375rem', borderTop: '1px solid var(--color-border-light)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  color: isOverdue && task.status !== 'done' ? 'var(--color-danger)' : 'var(--color-text-muted)', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '3px',
                                  fontWeight: isOverdue && task.status !== 'done' ? 600 : 'normal'
                                }}>
                                  <Clock size={10} />
                                  {getDueDateLabel(task.due_date, task.status === 'done', t)}
                                </span>
                                
                                {colId === 'in_progress' && (
                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)' }}>
                                    {progressVal}%
                                  </span>
                                )}
                              </div>

                              {/* Assignee & Participants Avatars */}
                              {(() => {
                                const assigneeUser = users.find((u: any) => String(u.id) === String(task.user_id));
                                const approverUser = task.approver_id ? users.find((u: any) => String(u.id) === String(task.approver_id)) : null;
                                const participantIds = task.participant_ids ? task.participant_ids.split(',').filter(Boolean) : [];
                                const participantUsers = participantIds.map((id: string) => users.find((u: any) => String(u.id) === String(id))).filter(Boolean);

                                if (!assigneeUser && !approverUser && participantUsers.length === 0) return null;

                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }} onClick={(e) => {
                                    if (participantUsers.length > 0) {
                                      e.stopPropagation();
                                      setSelectedTaskParticipants(participantUsers);
                                      setParticipantsModalOpen(true);
                                    }
                                  }}>
                                    {/* Assignee Avatar */}
                                    {assigneeUser && (
                                      <div title={`Chịu trách nhiệm: ${assigneeUser.full_name}`} style={{ position: 'relative', display: 'flex' }}>
                                        <Avatar src={assigneeUser.avatar_url || assigneeUser.avatar} name={assigneeUser.full_name} size={22} />
                                        <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--color-primary)', borderRadius: '50%', width: 8, height: 8, border: '1.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                                      </div>
                                    )}

                                    {/* Approver Avatar */}
                                    {approverUser && (
                                      <div title={`Người duyệt: ${approverUser.full_name}`} style={{ position: 'relative', display: 'flex' }}>
                                        <Avatar src={approverUser.avatar_url || approverUser.avatar} name={approverUser.full_name} size={22} />
                                        <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--color-warning)', borderRadius: '50%', width: 8, height: 8, border: '1.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                                      </div>
                                    )}

                                    {/* Overlapping Participant Avatars */}
                                    {participantUsers.length > 0 && (
                                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: '2px', position: 'relative' }}>
                                        {participantUsers.slice(0, 3).map((pUser: any, pIdx: number) => (
                                          <div
                                            key={pUser.id}
                                            title={`Người liên quan: ${pUser.full_name}`}
                                            style={{
                                              marginLeft: pIdx > 0 ? '-6px' : '0px',
                                              border: '1.5px solid white',
                                              borderRadius: '50%',
                                              overflow: 'hidden',
                                              zIndex: 10 - pIdx,
                                              display: 'flex'
                                            }}
                                          >
                                            <Avatar src={pUser.avatar_url || pUser.avatar} name={pUser.full_name} size={20} />
                                          </div>
                                        ))}
                                        {participantUsers.length > 3 && (
                                          <div
                                            style={{
                                              marginLeft: '-6px',
                                              width: '20px',
                                              height: '20px',
                                              borderRadius: '50%',
                                              background: 'var(--color-border)',
                                              color: 'var(--color-text-muted)',
                                              fontSize: '0.6rem',
                                              fontWeight: 800,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              border: '1.5px solid white',
                                              zIndex: 5,
                                              cursor: 'pointer'
                                            }}
                                          >
                                            +{participantUsers.length - 3}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                      {columnTasks.length > 30 && (
                        <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: '8px', border: '1px dashed var(--color-border-light)', margin: '0.5rem' }}>
                          {t('Hiển thị 30 / {total} công việc. Hãy dùng tìm kiếm/bộ lọc để tìm các công việc khác.').replace('{total}', String(columnTasks.length))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              };

              return (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem', alignItems: 'start', width: '100%' }}>
                  {renderKanbanColumn('todo', t('Cần làm'), todoTasks, 'var(--color-text-muted)', '#e2e8f0')}
                  {renderKanbanColumn('in_progress', t('Đang làm'), inProgressTasks, 'var(--color-warning)', 'rgba(245, 158, 11, 0.12)')}
                  {renderKanbanColumn('done', t('Đã xong'), doneTasks, 'var(--color-success)', 'rgba(16, 185, 129, 0.12)')}
                </div>
              );
            })()}
          </>
        ) : (
          /* Focus Mode (Fullscreen Zen Mode) */
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '16px',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '360px minmax(0, 1fr)',
            overflow: 'hidden',
            height: isMobile ? 'auto' : 'calc(100vh - 120px)',
            minHeight: '600px',
            width: '100%'
          }}>
            {/* Left Column: Tasks List */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              borderRight: isMobile ? 'none' : '1px solid var(--color-border-light)',
              height: '100%',
              overflowY: 'auto'
            }}>
              <div style={{ 
                padding: '1.25rem 1rem', 
                borderBottom: '1px solid var(--color-border-light)', 
                background: 'var(--color-surface)', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => {
                        setWsViewMode('grid');
                        setSelectedTaskForDetails(null);
                        setIsFocusSessionActive(false);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-light)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        transition: 'background 0.2s'
                      }}
                      className="hover-bg-light"
                      title={t('Quay lại')}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                      {t('CHẾ ĐỘ TẬP TRUNG')}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setWsViewMode('grid');
                      setSelectedTaskForDetails(null);
                      setIsFocusSessionActive(false);
                    }}
                    style={{
                      border: 'none',
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: 'var(--color-danger)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    className="hover-lift"
                  >
                    <X size={12} />
                    {t('Thoát')}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  <span>{t('DANH SÁCH CÔNG VIỆC')} ({filteredWsTasks.length})</span>
                </div>
              </div>

              {/* Filter Ribbon Pills inside Focus Mode Left Panel */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                overflowX: 'auto',
                padding: '8px 10px',
                borderBottom: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-light)',
                scrollbarWidth: 'none'
              }}>
                <button
                  type="button"
                  onClick={() => { setWsDatePreset('all'); setWsStatus('planned'); setWsTaskFilter('all'); }}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '16px',
                    border: wsDatePreset === 'all' && wsTaskFilter === 'all' ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: wsDatePreset === 'all' && wsTaskFilter === 'all' ? 'rgba(189, 29, 45, 0.08)' : 'var(--color-surface)',
                    color: wsDatePreset === 'all' && wsTaskFilter === 'all' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  <span>{t('Tất cả')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setWsDatePreset('overdue'); setWsStatus('planned'); setWsTaskFilter('all'); }}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '16px',
                    border: wsDatePreset === 'overdue' ? '1.5px solid var(--color-danger)' : '1px solid var(--color-border)',
                    background: wsDatePreset === 'overdue' ? 'var(--color-danger-light)' : 'var(--color-surface)',
                    color: 'var(--color-danger)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  <Clock size={11} />
                  <span>{t('Quá hạn')}</span>
                  <span style={{ background: 'var(--color-danger)', color: '#fff', borderRadius: '10px', padding: '0 5px', fontSize: '0.65rem', fontWeight: 800 }}>
                    {workspaceStats.overdue}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setWsDatePreset('today'); setWsStatus('planned'); setWsTaskFilter('all'); }}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '16px',
                    border: wsDatePreset === 'today' ? '1.5px solid var(--color-warning)' : '1px solid var(--color-border)',
                    background: wsDatePreset === 'today' ? 'rgba(245, 158, 11, 0.1)' : 'var(--color-surface)',
                    color: 'var(--color-warning)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  <Calendar size={11} />
                  <span>{t('Đến hạn')}</span>
                  <span style={{ background: 'var(--color-warning)', color: '#fff', borderRadius: '10px', padding: '0 5px', fontSize: '0.65rem', fontWeight: 800 }}>
                    {workspaceStats.dueToday}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setWsDatePreset('tomorrow'); setWsStatus('planned'); setWsTaskFilter('all'); }}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '16px',
                    border: wsDatePreset === 'tomorrow' ? '1.5px solid var(--color-info)' : '1px solid var(--color-border)',
                    background: wsDatePreset === 'tomorrow' ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-surface)',
                    color: 'var(--color-info)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  <ArrowUpRight size={11} />
                  <span>{t('Sắp đến hạn')}</span>
                  <span style={{ background: 'var(--color-info)', color: '#fff', borderRadius: '10px', padding: '0 5px', fontSize: '0.65rem', fontWeight: 800 }}>
                    {workspaceStats.upcoming}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setWsTaskFilter('approve_by_me'); setWsStatus('all'); setWsDatePreset('all'); }}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '16px',
                    border: wsTaskFilter === 'approve_by_me' ? '1.5px solid #8b5cf6' : '1px solid var(--color-border)',
                    background: wsTaskFilter === 'approve_by_me' ? 'rgba(139, 92, 246, 0.1)' : 'var(--color-surface)',
                    color: '#8b5cf6',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  <UserCheck size={11} />
                  <span>{t('Chờ tôi duyệt')}</span>
                  <span style={{ background: '#8b5cf6', color: '#fff', borderRadius: '10px', padding: '0 5px', fontSize: '0.65rem', fontWeight: 800 }}>
                    {workspaceStats.pendingApproval}
                  </span>
                </button>
              </div>
              {/* Gamification Progress Bar */}
              {(filteredWsTasks.length > 0 || completedCallsCount > 0) && (
                <div style={{ padding: '0.65rem 1rem 0.8rem', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-bg-light)' }}>
                  {filteredWsTasks.length > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                        <span>{t('Tiến độ công việc')}</span>
                        <span>
                          {filteredWsTasks.filter(t => t.status === 'done').length}/{filteredWsTasks.length} ({
                            Math.round((filteredWsTasks.filter(t => t.status === 'done').length / filteredWsTasks.length) * 100)
                          }%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--color-border-light)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                        <div style={{
                          width: `${(filteredWsTasks.filter(t => t.status === 'done').length / filteredWsTasks.length) * 100}%`,
                          height: '100%',
                          background: 'var(--color-success)',
                          borderRadius: '3px',
                          transition: 'width 0.4s ease-in-out'
                        }} />
                      </div>
                    </>
                  )}
                  {/* Call Stats with dynamic preset label */}
                  <div 
                    onClick={handleOpenCallsModal}
                    className="hover-lift"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.72rem',
                      color: 'var(--color-text-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: 'rgba(16, 185, 129, 0.06)',
                      padding: '5px 10px',
                      borderRadius: '8px',
                      marginTop: '2px',
                      border: '1px solid rgba(16, 185, 129, 0.12)'
                    }}
                  >
                    <Phone size={12} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                    <span>
                      {t('Đã thực hiện:')} <strong style={{ color: 'var(--color-success)', fontSize: '0.8rem' }}>{completedCallsCount}</strong> {t('cuộc gọi')} {
                        wsDatePreset === 'today' ? t('hôm nay') :
                        wsDatePreset === 'yesterday' ? t('hôm qua') :
                        wsDatePreset === 'week' ? t('tuần này') :
                        wsDatePreset === '7_days' ? t('7 ngày qua') :
                        wsDatePreset === '30_days' ? t('30 ngày qua') :
                        wsDatePreset === 'this_month' ? t('tháng này') :
                        wsDatePreset === 'last_month' ? t('tháng trước') :
                        wsDatePreset === 'tomorrow' ? t('ngày mai') :
                        wsDatePreset === 'overdue' ? t('quá hạn') :
                        t('từ trước tới nay')
                      }
                    </span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', gap: '0.5rem' }}>
                {filteredWsTasks.slice(0, 50).map(task => {
                  const isSelected = selectedTaskForDetails?.id === task.id;
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleSelectTask(task)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                        background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                      className="hover-lift"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '220px'
                        }}>
                          {task.subject}
                        </span>
                        {task.priority === 'high' && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 4px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                            {t('Gấp')}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        <span>
                          {task.due_date ? getDueDateLabel(task.due_date, task.status === 'done', t) : ''}
                        </span>
                        <span style={{ fontWeight: 600 }}>{task.progress || 0}%</span>
                      </div>
                    </div>
                  );
                })}
                {filteredWsTasks.length > 50 && (
                  <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: '8px', border: '1px dashed var(--color-border-light)', margin: '0.5rem' }}>
                    {t('Hiển thị 50 / {total} công việc. Hãy dùng tìm kiếm/bộ lọc để tìm các công việc khác.').replace('{total}', String(filteredWsTasks.length))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Task Detail Embed */}
            <div 
              className="focus-right-column"
              style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, overflow: 'hidden', minWidth: 0 }}
            >
              {selectedTaskForDetails ? (
                <div style={{ height: '100%', overflowY: 'auto' }}>
                  <WorkspaceTaskDrawer
                    isOpen={true}
                    onClose={() => setSelectedTaskForDetails(null)}
                    task={selectedTaskForDetails}
                    onUpdate={() => {
                      fetchPortalTasks();
                      fetchWorkspaceTasks();
                      window.dispatchEvent(new CustomEvent('task-updated'));
                    }}
                    users={users}
                    embedMode={true}
                    onOpenContact={(contactId) => {
                      handleOpenContactProfile(contactId);
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', gap: '1rem', padding: '2rem', flex: 1 }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', border: '1px solid var(--color-border-light)' }}>
                    <CheckSquare size={32} />
                  </div>
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <p style={{ fontWeight: 800, color: 'var(--color-text)', margin: 0, fontSize: '1rem' }}>
                      {t('CHẾ ĐỘ TẬP TRUNG (FOCUS MODE)')}
                    </p>
                    <p style={{ fontSize: '0.8125rem', margin: '6px auto 0', maxWidth: '320px', lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
                      {t('Chọn một công việc ở cột bên trái để bắt đầu gọi điện và ghi chú thông tin khách hàng trực tiếp.')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </>
        )}

        {/* Task Details Modal moved to root level */}
      </div>
    );
  };

  const renderDashboardView = () => {
    const getCurrentDateVi = () => {
      const days = [
        t('Chủ Nhật'),
        t('Thứ Hai'),
        t('Thứ Ba'),
        t('Thứ Tư'),
        t('Thứ Năm'),
        t('Thứ Sáu'),
        t('Thứ Bảy')
      ];
      const now = new Date();
      const dayName = days[now.getDay()];
      const date = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      return `${dayName}, ngày ${date}/${month}/${year}`;
    };

    const isAdmin = ['admin', 'superadmin', 'super_admin', 'director'].includes(String(user?.role || displayUser?.role || '').toLowerCase());
    const todayStr = new Date().toISOString().slice(0, 10);
    const pendingTasks = portalTasks.filter((t: any) => t.status !== 'done' && (!t.due_date || t.due_date <= todayStr));
    const pendingTasksCount = pendingTasks.length;

    const issues = [];
    if (pendingCoopsCount > 0) {
      issues.push({
        type: 'coop',
        text: t(`Có ${pendingCoopsCount} Phiếu hợp tác đang chờ bạn ký xác nhận.`),
        action: () => setActiveTab('data')
      });
    }
    if (pendingTasksCount > 0) {
      issues.push({
        type: 'task',
        text: t(`Có ${pendingTasksCount} công việc chưa hoàn thành hôm nay.`),
        action: () => setActiveTab('workspace')
      });
    }
    if (isCheckInLoaded && !isAdmin && !isOvertime && (!todayCheckIn || todayCheckIn.status === 'rejected')) {
      issues.push({
        type: 'checkin',
        text: t('Bạn chưa hoàn thành chấm công ngày hôm nay.'),
        action: () => window.dispatchEvent(new CustomEvent('trigger-checkin-modal'))
      });
    }

    const kpis = [
      { 
        id: 'total',
        key: 'data', 
        status: 'all', 
        label: t('TỔNG DATA'), 
        value: data.stats.total_received, 
        color: '#a31422', 
        bg: 'rgba(163, 20, 34, 0.08)', 
        icon: Users,
        change: '+100%', 
        up: true,
        bullets: [
          { text: t('Tổng data đang chăm sóc') + ': ' + (data.stats.total_received || 0), color: '#a31422' }
        ],
        decor: (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
            <circle cx="35" cy="45" r="15" fill="currentColor" fillOpacity="0.2" />
            <circle cx="65" cy="45" r="15" fill="currentColor" fillOpacity="0.4" />
            <circle cx="50" cy="70" r="18" fill="currentColor" fillOpacity="0.6" />
          </svg>
        )
      },
      { 
        id: 'distributed',
        key: 'data', 
        status: 'distributed', 
        label: t('ĐƯỢC CHIA'), 
        value: (data.stats.distributed_count || 0) + (data.stats.coop_count || 0), 
        color: '#007af5', 
        bg: 'rgba(0, 122, 245, 0.08)', 
        icon: Send,
        change: '+100%', 
        up: true,
        bullets: [
          { text: t('Nhận từ lượt chia tự động') + ': ' + (data.stats.distributed_count || 0), color: '#007af5' },
          { text: t('Hợp tác (co.op)') + ': ' + (data.stats.coop_count || 0), color: '#fbbf24' }
        ],
        decor: (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <path d="M10 50 Q 50 10 90 50 T 90 90" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="10" cy="50" r="6" fill="currentColor" />
            <circle cx="50" cy="10" r="6" fill="currentColor" />
            <circle cx="90" cy="50" r="6" fill="currentColor" />
            <path d="M50 10 L 90 50" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )
      },
      { 
        id: 'personal',
        key: 'data', 
        status: 'personal', 
        label: t('DATA CÁ NHÂN'), 
        value: (data.stats.self_count || 0) + (data.stats.databank_count || 0), 
        color: '#34c759', 
        bg: 'rgba(52, 199, 89, 0.08)', 
        icon: User,
        change: '+100%', 
        up: true,
        bullets: [
          { text: t('Tự tạo hoặc giới thiệu') + ': ' + (data.stats.self_count || 0), color: '#f59e0b' },
          { text: t('Claim từ Kho Databank') + ': ' + (data.stats.databank_count || 0), color: '#34c759' }
        ],
        decor: (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <rect x="20" y="20" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.6" />
            <rect x="20" y="42" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.4" />
            <rect x="20" y="64" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.2" />
          </svg>
        )
      },
      { 
        id: 'error_ticket',
        key: 'data', 
        status: 'error_ticket', 
        label: t('DATA LỖI & TICKET'), 
        value: data.stats.error_ticket_count || 0, 
        color: '#ef4444', 
        bg: 'rgba(239, 68, 68, 0.08)', 
        icon: AlertCircle,
        change: '+100%', 
        up: true,
        bullets: [
          { text: t('Data lỗi / trùng') + ': ' + (data.stats.error_ticket_count || 0), color: '#ef4444' },
          { text: t('Số Ticket đã gửi') + ': ' + (data.stats.tickets_total || 0), color: '#ef4444' }
        ],
        decor: (
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
            <path d="M50 35 V 65 M35 50 H 65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )
      }
    ];

    const recentLeads = data.leads.slice(0, 5);

    return (
      <>
        <style>{`
          .stat-card {
            position: relative;
            overflow: hidden;
            background: linear-gradient(135deg, var(--color-surface) 0%, #f9fafb 100%) !important;
            border: 1px solid var(--color-border) !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          [data-theme="dark"] .stat-card {
            background: linear-gradient(135deg, var(--color-surface) 0%, #151517 100%) !important;
            border: 1px solid var(--color-border-light) !important;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
          }
          .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08) !important;
          }
          [data-theme="dark"] .stat-card:hover {
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 255, 255, 0.03) !important;
          }
          .stat-card.total-card:hover {
            border-color: rgba(163, 20, 34, 0.4) !important;
            box-shadow: 0 8px 24px rgba(163, 20, 34, 0.08), 0 0 15px rgba(163, 20, 34, 0.03) !important;
          }
          [data-theme="dark"] .stat-card.total-card:hover {
            border-color: rgba(163, 20, 34, 0.6) !important;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.65), 0 0 20px rgba(163, 20, 34, 0.25) !important;
          }
          .stat-card.distributed-card:hover {
            border-color: rgba(0, 122, 245, 0.4) !important;
            box-shadow: 0 8px 24px rgba(0, 122, 245, 0.08), 0 0 15px rgba(0, 122, 245, 0.03) !important;
          }
          [data-theme="dark"] .stat-card.distributed-card:hover {
            border-color: rgba(0, 122, 245, 0.6) !important;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 122, 245, 0.25) !important;
          }
          .stat-card.personal-card:hover {
            border-color: rgba(16, 185, 129, 0.4) !important;
            box-shadow: 0 8px 24px rgba(16, 185, 129, 0.08), 0 0 15px rgba(16, 185, 129, 0.03) !important;
          }
          [data-theme="dark"] .stat-card.personal-card:hover {
            border-color: rgba(16, 185, 129, 0.6) !important;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.65), 0 0 20px rgba(16, 185, 129, 0.25) !important;
          }
          .stat-card.error_ticket-card:hover {
            border-color: rgba(239, 68, 68, 0.4) !important;
            box-shadow: 0 8px 24px rgba(239, 68, 68, 0.08), 0 0 15px rgba(239, 68, 68, 0.03) !important;
          }
          [data-theme="dark"] .stat-card.error_ticket-card:hover {
            border-color: rgba(239, 68, 68, 0.6) !important;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.65), 0 0 20px rgba(239, 68, 68, 0.25) !important;
          }
          .decor-svg {
            position: absolute;
            bottom: -15px;
            right: -15px;
            width: 100px;
            height: 100px;
            opacity: 0.07;
            pointer-events: none;
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .stat-card:hover .decor-svg {
            transform: scale(1.2) rotate(6deg);
            opacity: 0.14;
          }
          .stat-icon {
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .stat-card:hover .stat-icon {
            transform: scale(1.1) rotate(-8deg);
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Personalized Welcome Card with Premium Aesthetics */}
        <style>{`
          .welcome-banner {
            position: relative;
            overflow: hidden;
            background: linear-gradient(135deg, #181515 0%, #381f21 50%, #121010 100%) !important;
            border: 1px solid rgba(189, 29, 45, 0.4) !important;
            border-radius: 20px !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 1px 0 rgba(255, 255, 255, 0.08) inset !important;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
            padding: 1.75rem 2.25rem !important;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 1.5rem;
            margin-bottom: 0.25rem;
          }
          .welcome-banner::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 350px;
            height: 350px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(189, 29, 45, 0.15) 0%, transparent 70%);
            pointer-events: none;
          }
          .welcome-banner:hover {
            transform: translateY(-2px);
            box-shadow: 0 14px 35px rgba(189, 29, 45, 0.22), 0 1px 0 rgba(255, 255, 255, 0.12) inset !important;
            border-color: rgba(189, 29, 45, 0.55) !important;
          }
          .welcome-action-btn {
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            cursor: pointer;
            border-radius: 12px !important;
            padding: 10px 20px !important;
            font-size: 0.8rem !important;
            font-weight: 600 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            height: 38px !important;
          }
          .welcome-action-btn.primary-btn {
            background: linear-gradient(135deg, #BD1D2D 0%, #a31422 100%) !important;
            border: none !important;
            color: white !important;
            box-shadow: 0 4px 14px rgba(189, 29, 45, 0.45) !important;
          }
          .welcome-action-btn.primary-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(189, 29, 45, 0.5) !important;
            filter: brightness(1.1);
          }
          .welcome-action-btn.outline-btn {
            background: rgba(255, 255, 255, 0.05) !important;
            border: 1px solid rgba(255, 255, 255, 0.18) !important;
            color: #ffffff !important;
          }
          .welcome-action-btn.outline-btn:hover {
            background: rgba(189, 29, 45, 0.18) !important;
            border-color: rgba(189, 29, 45, 0.5) !important;
            color: #ffffff !important;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(189, 29, 45, 0.25) !important;
          }
          .welcome-task-row {
            background: rgba(255, 255, 255, 0.04) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-radius: 12px !important;
            padding: 10px 16px !important;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.825rem;
            color: #ffffff !important;
            font-weight: 500 !important;
            transition: all 0.2s ease;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important;
          }
          .welcome-task-row:hover {
            background: rgba(189, 29, 45, 0.15) !important;
            border-color: rgba(189, 29, 45, 0.4) !important;
            color: #ffffff !important;
            transform: translateX(4px);
            box-shadow: 0 4px 12px rgba(189, 29, 45, 0.25) !important;
          }

          @media (max-width: 768px) {
            .welcome-banner {
              padding: 0.875rem 1.125rem !important;
              gap: 0.875rem !important;
              border-radius: 16px !important;
            }
            .welcome-banner h2 {
              font-size: 0.95rem !important;
              font-weight: 700 !important;
            }
            .welcome-task-row {
              padding: 8px 12px !important;
              font-size: 0.75rem !important;
              border-radius: 10px !important;
            }
            .welcome-action-btn {
              padding: 0 12px !important;
              font-size: 0.72rem !important;
              height: 34px !important;
              border-radius: 10px !important;
              flex: 1 !important;
              justify-content: center !important;
            }
          }
        `}</style>

        <div className="welcome-banner">
          {/* Left section: Welcome Info */}
          
          {/* Left section: Welcome Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '1rem' : '1.5rem', flex: isMobile ? '1 1 100%' : '1 1 340px', minWidth: 0 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar 
                name={displayUser?.name || 'User'} 
                src={displayUser?.avatar} 
                size={isMobile ? 64 : 60} 
                style={{ border: '2.5px solid rgba(189, 29, 45, 0.45)', boxShadow: '0 0 16px rgba(189, 29, 45, 0.3)' }}
              />
              <span className="animate-pulse" style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                border: '2.5px solid #181515',
                boxShadow: '0 0 10px #10b981'
              }} />
            </div>
            {isMobile ? (
              /* Mobile Layout: Date on top, greeting + name below, role below, checkin below */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.725rem', color: '#e4e4e7' }}>
                  <Clock size={12} style={{ color: '#ff4d5a' }} />
                  {getCurrentDateVi()}
                </span>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.3px', textShadow: '0 2px 4px rgba(0,0,0,0.3)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  {t('Xin chào')}, {displayUser?.name || 'Thành viên'}
                </h2>
                <div style={{ display: 'flex' }}>
                  <span style={{ 
                    fontSize: '0.625rem', 
                    fontWeight: 900, 
                    color: '#ffffff', 
                    background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)', 
                    padding: '3px 10px', 
                    borderRadius: '20px', 
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 8px rgba(189, 29, 45, 0.5)',
                    letterSpacing: '0.6px'
                  }}>
                    {(() => {
                      const matched = data.consultants?.find((c: any) => 
                        (c.user_id && String(c.user_id) === String(displayUser?.id)) || 
                        (c.id && String(c.id) === String(displayUser?.consultant_id)) ||
                        (c.id && String(c.id) === String(displayUser?.id))
                      );
                      const jt = (displayUser as any)?.job_title || matched?.job_title || (displayUser as any)?.erp_profile?.job_title;
                      if (jt) return jt;
                      if ((displayUser as any)?.address) {
                        try {
                          const p = typeof (displayUser as any).address === 'string' ? JSON.parse((displayUser as any).address) : (displayUser as any).address;
                          if (p?.erp_profile?.job_title) return p.erp_profile.job_title;
                        } catch(e) {}
                      }
                      return displayUser?.role === 'sale' ? t('Tư vấn viên') : displayUser?.role === 'sales' ? t('Tư vấn viên') : displayUser?.role;
                    })()}
                  </span>
                </div>
                {!isAdmin && (
                  <div style={{ marginTop: '2px', display: 'flex' }}>
                    {(() => {
                      if (!todayCheckIn) {
                        return null;
                      }
                      const timeStr = todayCheckIn.check_in_time ? todayCheckIn.check_in_time.substring(0, 5) : '';
                      if (todayCheckIn.status === 'approved') {
                        return null;
                      }
                      if (todayCheckIn.status === 'pending_approval') {
                        return (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(245, 158, 11, 0.22)',
                            color: '#ffe066',
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontWeight: 800,
                            fontSize: '0.725rem'
                          }}>
                            <Clock size={12} />
                            {t('Chờ duyệt đi trễ lúc ') + timeStr}
                          </span>
                        );
                      }
                      if (todayCheckIn.status === 'rejected') {
                        return (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(239, 68, 68, 0.22)',
                            color: '#ffa3a3',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontWeight: 800,
                            fontSize: '0.725rem'
                          }}>
                            <AlertCircle size={12} />
                            {t('Chấm công bị từ chối')}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            ) : (
              /* Desktop Layout */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.3px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                  {t('Xin chào')}, {displayUser?.name || 'Thành viên'}
                </h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.825rem', color: '#e4e4e7' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    <Clock size={13} style={{ color: '#ff4d5a' }} />
                    {getCurrentDateVi()}
                  </span>
                  {!isAdmin && (
                    <>
                      <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>•</span>
                      {(() => {
                        if (!todayCheckIn) {
                          return null;
                        }
                        const timeStr = todayCheckIn.check_in_time ? todayCheckIn.check_in_time.substring(0, 5) : '';
                        if (todayCheckIn.status === 'approved') {
                          return null;
                        }
                        if (todayCheckIn.status === 'pending_approval') {
                          return (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(245, 158, 11, 0.22)',
                              color: '#ffe066',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontWeight: 800
                            }}>
                              <Clock size={13} />
                              {t('Chờ duyệt đi trễ lúc ') + timeStr}
                            </span>
                          );
                        }
                        if (todayCheckIn.status === 'rejected') {
                          return (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(239, 68, 68, 0.22)',
                              color: '#ffa3a3',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontWeight: 800
                            }}>
                              <AlertCircle size={13} />
                              {t('Chấm công bị từ chối')}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </>
                  )}
                </div>

                <div style={{ display: 'flex' }}>
                  <span style={{ 
                    fontSize: '0.68rem', 
                    fontWeight: 900, 
                    color: '#ffffff', 
                    background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)', 
                    padding: '4px 12px', 
                    borderRadius: '20px', 
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 8px rgba(189, 29, 45, 0.5)',
                    letterSpacing: '0.6px'
                  }}>
                    {(() => {
                      const matched = data.consultants?.find((c: any) => 
                        (c.user_id && String(c.user_id) === String(displayUser?.id)) || 
                        (c.id && String(c.id) === String(displayUser?.consultant_id)) ||
                        (c.id && String(c.id) === String(displayUser?.id))
                      );
                      const jt = (displayUser as any)?.job_title || matched?.job_title || (displayUser as any)?.erp_profile?.job_title;
                      if (jt) return jt;
                      if ((displayUser as any)?.address) {
                        try {
                          const p = typeof (displayUser as any).address === 'string' ? JSON.parse((displayUser as any).address) : (displayUser as any).address;
                          if (p?.erp_profile?.job_title) return p.erp_profile.job_title;
                        } catch(e) {}
                      }
                      return displayUser?.role === 'sale' ? t('Tư vấn viên') : displayUser?.role === 'sales' ? t('Tư vấn viên') : displayUser?.role;
                    })()}
                  </span>
                </div>
              </div>
            )}
          </div>
          
{/* Middle section: Issues/Tasks */}
          <div style={{ flex: isMobile ? '1 1 100%' : '2 1 380px', display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '10px', minWidth: isMobile ? '100%' : '280px' }}>
            <h4 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 500, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>
              {t('Nhiệm vụ & Vấn đề cần giải quyết')}
            </h4>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="welcome-task-row" style={{ cursor: 'default' }}>
                  <Skeleton width={14} height={14} borderRadius="50%" style={{ '--skeleton-base': 'rgba(255, 255, 255, 0.08)', '--skeleton-shine': 'rgba(255, 255, 255, 0.15)' } as React.CSSProperties} />
                  <Skeleton width="60%" height={12} style={{ '--skeleton-base': 'rgba(255, 255, 255, 0.08)', '--skeleton-shine': 'rgba(255, 255, 255, 0.15)' } as React.CSSProperties} />
                </div>
                <div className="welcome-task-row" style={{ cursor: 'default' }}>
                  <Skeleton width={14} height={14} borderRadius="50%" style={{ '--skeleton-base': 'rgba(255, 255, 255, 0.08)', '--skeleton-shine': 'rgba(255, 255, 255, 0.15)' } as React.CSSProperties} />
                  <Skeleton width="45%" height={12} style={{ '--skeleton-base': 'rgba(255, 255, 255, 0.08)', '--skeleton-shine': 'rgba(255, 255, 255, 0.15)' } as React.CSSProperties} />
                </div>
              </div>
            ) : issues.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {issues.map((issue, index) => (
                  <div 
                    key={index} 
                    onClick={issue.action}
                    className="welcome-task-row"
                  >
                    {issue.type === 'coop' && <FileText size={14} style={{ color: '#fbbf24' }} />}
                    {issue.type === 'task' && <CheckSquare size={14} style={{ color: '#60a5fa' }} />}
                    {issue.type === 'checkin' && <AlertCircle size={14} style={{ color: '#ff8a8a' }} />}
                    <span style={{ flex: 1 }}>{issue.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '14px', 
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)', 
                padding: '16px', 
                borderRadius: '16px', 
                border: '1px solid rgba(255, 255, 255, 0.06)' 
              }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: '10px', 
                  background: 'linear-gradient(135deg, #3f3f46 0%, #18181b 100%)', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  color: '#e4e4e7',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  flexShrink: 0
                }}>
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}>
                    {t("Tuyệt vời! Không có tồn đọng")}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#a1a1aa', margin: '4px 0 0', fontWeight: 500 }}>
                    {t("Chúc bạn một ngày chốt thật nhiều deal! 🚀")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right section: Quick Actions */}
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'nowrap', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
            {isCheckInLoaded && !isAdmin && !isOvertime && (!todayCheckIn || todayCheckIn.status === 'rejected') && (
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('trigger-checkin-modal'))}
                className="welcome-action-btn primary-btn"
              >
                <Camera size={14} />
                {t('Chấm công')}
              </button>
            )}
            <button 
              onClick={() => setActiveTab('databank')}
              className="welcome-action-btn outline-btn"
            >
              <Database size={14} />
              {t('Nhận data')}
            </button>
          </div>
        </div>

          {/* Dashboard header */}
          <div className="page-header" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '0px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px' }}>
              <h1 className="page-title" style={{ margin: 0, fontSize: isMobile ? '1.15rem' : undefined }}>{t("Tổng quan Phân bổ Data")}</h1>
              
              {isMobile ? (
                <div ref={mobileDateMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setIsMobileDateMenuOpen(prev => !prev)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)',
                      position: 'relative'
                    }}
                    title={t("Bộ lọc thời gian")}
                  >
                    <MoreHorizontal size={18} />
                    {dateMode !== 'all' && (
                      <span style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#BD1D2D'
                      }} />
                    )}
                  </button>

                  <AnimatePresence>
                    {isMobileDateMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: '6px',
                          width: '210px',
                          maxHeight: '320px',
                          overflowY: 'auto',
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                          zIndex: 1000,
                          padding: '6px'
                        }}
                      >
                        {[
                          { value: 'all', label: t('Tất cả thời gian') },
                          { value: 'today', label: t('Hôm nay') },
                          { value: 'yesterday', label: t('Hôm qua') },
                          { value: 'this_week', label: t('Tuần này') },
                          { value: 'last_week', label: t('Tuần trước') },
                          { value: 'two_weeks_ago', label: t('Tuần trước nữa') },
                          { value: '7_days', label: t('7 ngày qua') },
                          { value: '30_days', label: t('30 ngày qua') },
                          { value: 'this_month', label: t('Tháng này') },
                          { value: 'last_month', label: t('Tháng trước') },
                          { value: 'this_year', label: t('Năm nay') },
                          { value: 'custom', label: t('Tùy chọn ngày...') }
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setIsMobileDateMenuOpen(false);
                              if (opt.value === 'custom') {
                                setShowCustomDate(true);
                              } else {
                                handleDateModeChange(opt.value);
                              }
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 12px',
                              fontSize: '0.8125rem',
                              borderRadius: '8px',
                              border: 'none',
                              background: dateMode === opt.value ? 'rgba(189, 29, 45, 0.1)' : 'transparent',
                              color: dateMode === opt.value ? '#BD1D2D' : 'var(--color-text)',
                              fontWeight: dateMode === opt.value ? 700 : 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <span>{opt.label}</span>
                            {dateMode === opt.value && <Check size={14} style={{ color: '#BD1D2D' }} />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <p className="page-subtitle" style={{ fontSize: isMobile ? '0.75rem' : '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
                {t("Phân tích hiệu suất giao data theo thời gian thực — Hệ thống đang hoạt động trơn tru.")}
              </p>

              {!isMobile && (
                <div style={{ position: 'relative', zIndex: 100, flexShrink: 0, minWidth: '240px', maxWidth: '320px' }}>
                  <CustomSelect
                    options={[
                      { value: 'all', label: t('Tất cả thời gian'), icon: <Clock size={16} /> },
                      { value: 'today', label: t('Hôm nay') },
                      { value: 'yesterday', label: t('Hôm qua') },
                      { value: 'this_week', label: t('Tuần này') },
                      { value: 'last_week', label: t('Tuần trước') },
                      { value: 'two_weeks_ago', label: t('Tuần trước nữa') },
                      { value: '7_days', label: t('7 ngày qua') },
                      { value: '30_days', label: t('30 ngày qua') },
                      { value: 'this_month', label: t('Tháng này') },
                      { value: 'last_month', label: t('Tháng trước') },
                      { value: 'this_year', label: t('Năm nay') },
                      { value: 'custom', label: t('Tùy chọn ngày...') }
                    ]}
                    value={dateMode}
                    onChange={(val) => {
                      if (val === 'custom') {
                        setShowCustomDate(true);
                      } else {
                        handleDateModeChange(String(val));
                      }
                    }}
                    width="100%"
                  />
                </div>
              )}
            </div>
          </div>

          {showCustomDate && (
            <div className="portal-filters-row" style={{
              display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px',
              padding: '1rem 1.5rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)', marginTop: '-0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Từ ngày')}:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)',
                    fontSize: '0.85rem', outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)', height: 38
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Đến ngày')}:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)',
                    fontSize: '0.85rem', outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)', height: 38
                  }}
                />
              </div>
              <button
                onClick={() => loadPortalData()}
                className="btn sm primary"
                style={{ height: 38, padding: '0 15px', borderRadius: '10px' }}
              >
                {t('Áp dụng')}
              </button>
            </div>
          )}



        {/* KPI Cards Grid */}
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '0.75rem' : '1.25rem' }}>
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className={`stat-card ${kpi.id}-card`}
                style={{
                  minHeight: isMobile ? '105px' : '140px',
                  padding: isMobile ? '12px' : '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (kpi.key === 'data') {
                    navigate('/data?status=' + kpi.status);
                  } else if (kpi.key === 'tickets') {
                    navigate('/tickets?status=' + kpi.status);
                  }
                }}
              >
                {/* Decorative Background SVG */}
                <div className="decor-svg" style={{ color: kpi.color }}>
                  {kpi.decor}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '6px' : '12px', position: 'relative', zIndex: 2 }}>
                  <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: isMobile ? '0.625rem' : '0.7rem' }}>{kpi.label}</span>
                  <div className="stat-icon" style={{
                    color: kpi.color,
                    background: kpi.bg,
                    width: isMobile ? '28px' : '36px',
                    height: isMobile ? '28px' : '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={isMobile ? 15 : 18} />
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>
                  <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: isMobile ? '1.5rem' : '2.25rem', lineHeight: 1.1 }}>
                    {loading ? (
                      <Skeleton width="60px" height={isMobile ? 24 : 36} style={{ margin: '4px 0' }} />
                    ) : (
                      kpi.value
                    )}
                  </div>
                  
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {loading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', marginTop: '4px' }}>
                        <Skeleton width="80%" height={8} />
                        {kpi.bullets.length > 1 && <Skeleton width="50%" height={8} />}
                      </div>
                    ) : (
                      kpi.bullets.map((b, bIdx) => (
                        <span key={bIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.color, display: 'inline-block', flexShrink: 0 }} />
                          <span>{b.text}</span>
                        </span>
                      ))
                    )}
                  </div>

                  {loading ? (
                    <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                      <Skeleton width="60%" height={10} />
                    </div>
                  ) : (
                    (() => {
                      const isIncrease = kpi.change.startsWith('+');
                      const isZero = kpi.change === '0%';
                      const changeColor = isZero ? 'var(--color-text-light)' : (kpi.up ? 'var(--color-success)' : 'var(--color-danger)');
                      return (
                        <div className="stat-change" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: changeColor, fontWeight: 700, fontSize: '0.75rem' }}>
                          {!isZero && (
                            isIncrease ? (
                              <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                                <path d="M12 5l9 14H3z" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                                <path d="M12 19L3 5h18z" />
                              </svg>
                            )
                          )}
                          {kpi.change}
                          <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>
                            {t('so với kỳ trước')}
                          </span>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            );
          })}
        </div>



        {/* Row 1: Charts & Recent Leads feed */}
        <div className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '6fr 4fr', gap: '1.25rem' }}>
          {/* Chart Left (Performance) */}
          <div className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
            {loading ? (
              <div style={{ height: 320, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <Skeleton width="40%" height={20} />
                <Skeleton width="100%" height={260} borderRadius={12} />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock3 size={18} color="var(--color-primary)" />
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                      {flowViewMode === 'day' ? t('LƯU LƯỢNG NHẬN DATA THEO NGÀY') : t('LƯU LƯỢNG NHẬN DATA THEO KHUNG GIỜ')}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                    <button
                      onClick={() => setFlowViewMode('day')}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                        background: flowViewMode === 'day' ? 'var(--color-surface)' : 'transparent',
                        color: flowViewMode === 'day' ? 'var(--color-primary)' : 'var(--color-text-muted)'
                      }}
                    >
                      {t('Theo ngày')}
                    </button>
                    <button
                      onClick={() => setFlowViewMode('hour')}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                        background: flowViewMode === 'hour' ? 'var(--color-surface)' : 'transparent',
                        color: flowViewMode === 'hour' ? 'var(--color-primary)' : 'var(--color-text-muted)'
                      }}
                    >
                      {t('Theo giờ')}
                    </button>
                  </div>
                </div>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={activeChartData} margin={{ left: -20, right: 5, top: 10 }}>
                      <defs>
                        <linearGradient id="chartBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={1} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                      <XAxis dataKey={flowViewMode === 'day' ? 'date' : 'time'} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={35} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div style={{ background: 'var(--color-surface)', padding: '8px 12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid var(--color-border)', fontSize: '0.8rem' }}>
                              <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{label}</div>
                              <div style={{ color: 'var(--color-primary)', marginTop: 2 }}>{t('Số lượng data: ')}<span style={{ fontWeight: 800 }}>{payload[0].value}</span></div>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Bar dataKey="volume" fill="var(--color-primary)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={16} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {/* Recent Leads Feed (y như bên Lịch sử giao Data gần đây) */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{t('Data nhận gần đây')}</h3>
              <span
                style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setActiveTab('data')}
              >{t('Xem tất cả')}</span>
            </div>
            <div style={{ flex: 1, padding: '0.5rem 0.5rem 1.25rem 0.5rem', overflowY: 'auto', maxHeight: 280 }} className="custom-scrollbar">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem' }}>
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                </div>
              ) : recentLeads.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {recentLeads.map((lead: any) => (
                    <div key={lead.log_id} className="hover-lift" style={{
                      padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'background 0.2s',
                      borderBottom: '1px solid var(--color-border-light)'
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => {
                        if (lead.contact_id) {
                          handleOpenContactProfile(Number(lead.contact_id));
                        } else {
                          setActiveDetailLead(lead);
                          setDetailModalOpen(true);
                        }
                      }}
                    >
                      <Avatar name={lead.lead_name || t('Khách hàng')} size={32} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                          {lead.lead_name || t('Ẩn danh')}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {lead.phone} • {lead.round_name || t('Mặc định')} • {lead.received_at ? new Date(lead.received_at).toLocaleString('vi-VN') : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {getStatusBadge(lead.status, lead.report_status, lead.ai_screener_status, lead.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  {t('Chưa nhận được data nào.')}
                </div>
              )}
            </div>
          </div>
        </div>



        {/* PHIẾU HỢP TÁC CHỜ KÝ */}
        {pendingCoopSlips.length > 0 && (
          <div className="card animate-fade" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', marginBottom: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={18} color="var(--color-warning)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t('PHIẾU HỢP TÁC CHỜ KÝ')}
                  <span style={{
                    background: 'var(--color-warning)',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    lineHeight: 1
                  }}>
                    {pendingCoopSlips.length}
                  </span>
                </h3>
              </div>
              <button 
                className="btn outline warning sm" 
                onClick={() => navigate('/cooperation-slips')}
                style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}
              >
                {t('Xem tất cả phiếu')}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
              {pendingCoopSlips.map((slip: any) => {
                const myShare = slip.shareholders?.find((x: any) => String(x.user_id) === String(displayUser?.id));
                const percentage = myShare ? myShare.percentage : 0;
                
                return (
                  <div 
                    key={slip.id} 
                    style={{
                      padding: '1rem', 
                      background: 'var(--color-surface)', 
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '12px', 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: 'var(--shadow-sm)', 
                      transition: 'all 0.2s'
                    }}
                    className="hover-lift"
                  >
                    <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.08)',
                        color: 'var(--color-warning)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Scale size={18} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {slip.customer_name || t('Khách hàng')}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {slip.project_name || t('Dự án')} • {t('Căn')}: {slip.unit_code}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '8px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-warning)' }}>
                          {percentage}%
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                          {t('Tỷ lệ chia')}
                        </div>
                      </div>
                      <button 
                        className="btn sm" 
                        style={{ background: 'var(--color-warning)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                        onClick={() => navigate('/cooperation-slips')}
                      >
                        {t('Ký ngay')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 2: Round distribution card & Source Ratio PieChart */}

        <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
          {/* Card 1: Tỷ lệ theo Vòng Phân Bổ */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <GitBranch size={18} color="var(--color-primary)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('Tỷ lệ theo Vòng Phân Bổ')}
              </h3>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
              {data.by_round && data.by_round.length > 0 ? (
                data.by_round.map((r: any, idx: number) => {
                  const percentage = data.stats.total_received > 0
                    ? ((r.count / data.stats.total_received) * 100).toFixed(1)
                    : '0.0';
                  const colors = ['#BD1D2D', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#BD1D2D'];
                  const themeColor = colors[idx % colors.length];

                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: themeColor }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{r.round_name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{percentage}% tổng data</span>
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '1rem' }}>{r.count}</span>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                  {t('Chưa có dữ liệu phân bổ vòng chia')}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Tỷ lệ Nguồn Data */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '8px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
                <GitBranch size={18} color="#BD1D2D" /> {t('Tỷ lệ Nguồn Data')}
              </h3>
              <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--color-border-light)', flexShrink: 0 }}>
                <button
                  onClick={() => setSourceViewMode('connection')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: sourceViewMode === 'connection' ? 'var(--color-surface)' : 'transparent',
                    color: sourceViewMode === 'connection' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: sourceViewMode === 'connection' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  {t('Theo Kết nối')}
                </button>
                <button
                  onClick={() => setSourceViewMode('lead')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: sourceViewMode === 'lead' ? 'var(--color-surface)' : 'transparent',
                    color: sourceViewMode === 'lead' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: sourceViewMode === 'lead' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  {t('Theo Nguồn Lead')}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {(() => {
                const getSourceStats = () => {
                  const counts: Record<string, number> = {};
                  data.leads.filter((l: any) => l.status !== 'reminder').forEach((lead: any) => {
                    const name = lead.connection_name || t('Nhập tay');
                    counts[name] = (counts[name] || 0) + 1;
                  });
                  const colors = ['#BD1D2D', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#BD1D2D', '#06b6d4'];
                  return Object.entries(counts)
                    .map(([name, value], idx) => ({
                      name,
                      value,
                      color: colors[idx % colors.length]
                    }))
                    .sort((a, b) => b.value - a.value);
                };

                const getLeadSourceStats = () => {
                  const counts: Record<string, number> = {};
                  data.leads.filter((l: any) => l.status !== 'reminder').forEach((lead: any) => {
                    const name = lead.source?.trim() || t('Không xác định');
                    counts[name] = (counts[name] || 0) + 1;
                  });
                  const colors = ['#BD1D2D', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#BD1D2D', '#06b6d4'];
                  return Object.entries(counts)
                    .map(([name, value], idx) => ({
                      name,
                      value,
                      color: colors[idx % colors.length]
                    }))
                    .sort((a, b) => b.value - a.value);
                };

                const activeSourceData = sourceViewMode === 'connection' ? getSourceStats() : getLeadSourceStats();

                return activeSourceData && activeSourceData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie
                          data={activeSourceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={55}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {activeSourceData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Legend list */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '6px 12px',
                      width: '100%',
                      marginTop: '10px',
                      fontSize: '0.75rem',
                      color: 'var(--color-text-light)'
                    }}>
                      {activeSourceData.map((entry: any, index: number) => (
                        <div
                          key={index}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}
                          title={`${entry.name}: ${entry.value}`}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {entry.name}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 500, flexShrink: 0 }}>
                            {entry.value} data
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Chưa có dữ liệu thống kê')}</div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

  const renderDataView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Consolidated Filters Row */}
        <div className="portal-filters-row" style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '0.5rem',
          flexShrink: 0,
          flexWrap: 'wrap',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
        }}>
          {/* Search Input */}
          <div className="responsive-filter-item" style={{ position: 'relative', width: 240 }}>
            <input
              className="form-input"
              placeholder={t("Tìm theo tên, SĐT, email...")}
              style={{ paddingLeft: 12, width: '100%', height: 38, fontSize: '0.875rem' }}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyPress={handleSearchKeyPress}
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                }}
                style={{
                  position: 'absolute', right: 10, top: 10, background: 'none', border: 'none',
                  color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center'
                }}
              >
                <XCircle size={14} />
              </button>
            )}
          </div>

          {/* Date Select Filter */}
          <div className="responsive-filter-item">
            <CustomSelect
              options={[
                { value: 'all', label: t('Tất cả thời gian'), icon: <Clock size={16} /> },
                { value: 'today', label: t('Hôm nay') },
                { value: 'yesterday', label: t('Hôm qua') },
                { value: 'this_week', label: t('Tuần này') },
                { value: 'last_week', label: t('Tuần trước') },
                { value: 'two_weeks_ago', label: t('Tuần trước nữa') },
                { value: '7_days', label: t('7 ngày qua') },
                { value: '30_days', label: t('30 ngày qua') },
                { value: 'this_month', label: t('Tháng này') },
                { value: 'last_month', label: t('Tháng trước') },
                { value: 'this_year', label: t('Năm nay') },
                { value: 'custom', label: t('Tùy chọn ngày...') }
              ]}
              value={dateMode}
              onChange={(val) => handleDateModeChange(String(val))}
              width={160}
            />
          </div>

          {/* Custom Date Inputs */}
          {showCustomDate && (
            <div className="portal-filter-custom-date" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)',
                  fontSize: '0.85rem', outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)',
                  height: 38
                }}
              />
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t('đến')}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)',
                  fontSize: '0.85rem', outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)',
                  height: 38
                }}
              />
            </div>
          )}

          {/* Status Select Filter */}
          <div className="responsive-filter-item">
            <CustomSelect
              options={[
                { value: 'all', label: t('Tất cả trạng thái'), icon: <Filter size={16} /> },
                { value: 'assigned', label: t('Đã chia') },
                { value: 'compensation', label: t('Data Bù') },
                { value: 'databank_claim', label: 'Databank Claim' },
                { value: 'reminder', label: t('Nhắc lại') },
                { value: 'pending_ticket', label: t('Ticket chờ duyệt') },
                { value: 'approved_ticket', label: t('Ticket đã bù') },
                { value: 'approved_no_comp_ticket', label: t('Lỗi không bù') },
                { value: 'not_contacted', label: t('Chưa liên hệ'), icon: <AlertCircle size={16} /> },
                { value: 'rejected_ticket', label: t('Ticket bị từ chối') }
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(String(val))}
              width={170}
            />
          </div>

          {/* Round Select Filter */}
          <div className="responsive-filter-item">
            <CustomSelect
              options={[
                { value: '', label: t('Tất cả vòng'), icon: <Tag size={16} /> },
                ...data.rounds.map((r: any) => ({ value: r.id, label: r.round_name }))
              ]}
              value={roundId}
              onChange={(val) => setRoundId(String(val))}
              width={160}
            />
          </div>

          <button
            onClick={handleApplyFilters}
            className="btn sm primary"
            style={{ height: 38 }}
          >
            <Filter size={14} /> {t('Áp dụng')}
          </button>

          <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            {t('Tổng cộng:')} <strong style={{ color: 'var(--color-text)' }}>{filteredLeads.length}</strong> {t('data')}
          </div>
        </div>

        {/* Bảng Dữ Liệu */}
        <div className="card mobile-flat-container" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              {t('DANH SÁCH DỮ LIỆU ĐƯỢC PHÂN BỔ')}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', background: 'var(--color-border-light)', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
              {t('Đang hiển thị')} {paginatedLeads.length} / {totalCount} {t('dòng')}
            </span>
          </div>

          <div className="table-wrap responsive-table-wrap mobile-card-table" style={{
            overflowX: isMobile ? 'visible' : 'auto',
            maxHeight: isMobile ? 'none' : '520px',
            overflowY: isMobile ? 'visible' : 'auto'
          }}>
            {loading ? (
              <TableSkeleton cols={7} rows={6} />
            ) : filteredLeads.length > 0 ? (
              isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0 5rem 0' }}>
                  {paginatedLeads.map((lead: any) => (
                    <div
                      key={lead.log_id}
                      onClick={() => {
                        if (lead.contact_id) {
                          handleOpenContactProfile(Number(lead.contact_id));
                        } else {
                          setActiveDetailLead(lead);
                          setDetailModalOpen(true);
                        }
                      }}
                      style={{
                        padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                        borderRadius: '12px', background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                          <Avatar name={lead.lead_name || t('Khách hàng')} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {lead.lead_name || t('Chưa cập nhật')}
                              </span>
                              {effectiveRole === 'sale' && Number(lead.is_accepted) === 1 && Number(lead.lead_recall_minutes) > 0 && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', borderRadius: '8px',
                                  background: '#e6f4ea', color: '#137333', fontSize: '0.65rem', fontWeight: 700
                                }}>
                                  <CheckCircle2 size={10} /> {t('Đã tiếp nhận')}
                                </span>
                              )}
                              {getStatusBadge(lead.status, lead.report_status)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '1px' }}>
                              <span style={{ color: 'var(--color-text)', fontWeight: 700, fontSize: '0.75rem' }}>{lead.phone}</span>
                              {lead.lead_email && (
                                <>
                                  <span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>•</span>
                                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                                    {lead.lead_email}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '8px', background: '#ffe3e8', color: '#8a0f1b', fontSize: '0.675rem', fontWeight: 700 }}>
                            {lead.round_name || t('Mặc định')}
                          </span>
                          {lead.status === 'compensation' && (
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#d1fae5', color: '#065f46', fontSize: '0.625rem', fontWeight: 700 }}>
                              {t('Data bù')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px dotted var(--color-border-light)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>{t('Nguồn')}: </span>
                            <span>{lead.source || 'N/A'}</span>
                            {lead.type && <span style={{ color: '#94a3b8' }}> ({lead.type})</span>}
                          </div>
                          {lead.sale_name && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>{t('Phân bổ')}: </span>
                              <Avatar src={lead.sale_avatar} name={lead.sale_name} size={18} />
                              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{lead.sale_name}</span>
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', color: '#64748b' }}>
                          {lead.received_at ? new Date(lead.received_at).toLocaleString('vi-VN') : '—'}
                        </div>
                      </div>

                      {((effectiveRole === 'sale' && !Number(lead.is_accepted)) || lead.report_status || (isAllowedToReport &&
                        (!data.below_standard_fallback_round_ids || !data.below_standard_fallback_round_ids.includes(Number(lead.round_id))) &&
                        (!data.below_standard_fallback_round_id || Number(lead.round_id) !== Number(data.below_standard_fallback_round_id)))) && (
                          <div onClick={e => e.stopPropagation()} style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                            {effectiveRole === 'sale' && !Number(lead.is_accepted) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <LeadRecallTimer
                                  lastInteractionDate={lead.last_interaction_date}
                                  leadRecallMinutes={Number(lead.lead_recall_minutes) || 0}
                                  t={t}
                                />
                                <button onClick={() => handleAcceptLead(lead.lead_id)} className="btn sm primary" style={{ height: 30, padding: '0 10px' }}>
                                  {t('Tiếp nhận')}
                                </button>
                              </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {lead.report_status === 'pending' && (
                                <span className="badge warning" title={t("Ticket chờ duyệt (Bấm để xem chi tiết)")} onClick={() => { setActiveDetailLead(lead); setDetailModalOpen(true); }}>
                                  {t('Chờ duyệt')}
                                </span>
                              )}
                              {lead.report_status === 'approved' && (
                                <span className="badge success" title={t("Ticket đã duyệt bù (Bấm để xem chi tiết)")} onClick={() => { setActiveDetailLead(lead); setDetailModalOpen(true); }}>
                                  {t('Đã bù')}
                                </span>
                              )}
                              {lead.report_status === 'approved_no_comp' && (
                                <span className="badge" style={{ background: '#dbeafe', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.2)', cursor: 'pointer' }} title={t("Ticket duyệt lỗi không bù (Bấm để xem chi tiết)")} onClick={() => { setActiveDetailLead(lead); setDetailModalOpen(true); }}>
                                  {t('Lỗi không bù')}
                                </span>
                              )}
                              {lead.report_status === 'rejected' && (
                                <span className="badge danger" title={t("Từ chối")} onClick={() => { setActiveDetailLead(lead); setDetailModalOpen(true); }}>
                                  {t('Từ chối')}
                                </span>
                              )}
                              {(!lead.report_status || lead.report_status === 'rejected') && isAllowedToReport && lead.status !== 'reminder' && lead.status !== 'databank_claim' &&
                                (!data.below_standard_fallback_round_ids || !data.below_standard_fallback_round_ids.includes(Number(lead.round_id))) &&
                                (!data.below_standard_fallback_round_id || Number(lead.round_id) !== Number(data.below_standard_fallback_round_id)) && (
                                  <button onClick={() => handleOpenReportModal(lead)} className="btn sm danger" style={{ height: 30, padding: '0 10px' }}>
                                    <AlertCircle size={12} /> {t('Báo lỗi')}
                                  </button>
                                )}
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              ) : (
                <table style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('KHÁCH HÀNG')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('LIÊN HỆ')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('TRẠNG THÁI')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('PHÂN BỔ CHO')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('NGUỒN / PHÂN LOẠI')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('THỜI GIAN NHẬN')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>{t('TICKET')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLeads.map((lead: any) => (
                      <tr
                        key={lead.log_id}
                        onClick={() => {
                          if (lead.contact_id) {
                            handleOpenContactProfile(Number(lead.contact_id));
                          } else {
                            setActiveDetailLead(lead);
                            setDetailModalOpen(true);
                          }
                        }}
                        className="table-row-hover"
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Avatar name={lead.lead_name || t('Khách hàng')} size={32} />
                              <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>
                                {lead.lead_name || t('Chưa cập nhật')}
                              </span>
                            </div>

                            {effectiveRole === 'sale' && !Number(lead.is_accepted) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                <LeadRecallTimer
                                  lastInteractionDate={lead.last_interaction_date}
                                  leadRecallMinutes={Number(lead.lead_recall_minutes) || 0}
                                  t={t}
                                />
                                <button onClick={() => handleAcceptLead(lead.lead_id)} className="btn sm primary" style={{ height: 30 }}>
                                  {t('Tiếp nhận')}
                                </button>
                              </div>
                            )}

                            {effectiveRole === 'sale' && Number(lead.is_accepted) === 1 && Number(lead.lead_recall_minutes) > 0 && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: '12px',
                                background: '#e6f4ea', color: '#137333', fontSize: '0.725rem', fontWeight: 700
                              }}>
                                <CheckCircle2 size={12} /> {t('Đã tiếp nhận')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{lead.phone}</span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{lead.lead_email || '—'}</span>
                          </div>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          {getStatusBadge(lead.status, lead.report_status)}
                        </td>

                        <td style={{ padding: '1rem' }}>
                          {lead.sale_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Avatar src={lead.sale_avatar} name={lead.sale_name} size={32} />
                              <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{lead.sale_name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                  {(lead.status === 'reminder' && (!lead.round_name || lead.round_name === '-')) ? 'Reminder' : (lead.round_name || 'Form')}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                          )}
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ color: 'var(--color-text-light)', fontSize: '0.8rem', fontWeight: 500 }}>{lead.source || 'N/A'}</span>
                            {lead.type && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{lead.type}</span>}
                          </div>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            <span>{lead.received_at ? new Date(lead.received_at).toLocaleString('vi-VN') : '—'}</span>
                            {lead.status === 'compensation' && (
                              <span style={{ alignSelf: 'flex-start', padding: '2px 6px', borderRadius: '4px', background: '#d1fae5', color: '#065f46', fontSize: '0.7rem', fontWeight: 700 }}>
                                {t('Data bù')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                            {lead.report_status === 'pending' && (
                              <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: '#fef3c7', color: '#d97706' }} title={t("Ticket chờ duyệt")}>
                                <Clock size={16} />
                              </div>
                            )}
                            {lead.report_status === 'approved' && (
                              <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'var(--color-success-light)', color: 'var(--color-success)' }} title={t("Ticket đã duyệt bù")}>
                                <CheckCircle2 size={16} />
                              </div>
                            )}
                            {lead.report_status === 'approved_no_comp' && (
                              <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb' }} title={t("Ticket duyệt lỗi không bù")}>
                                <Info size={16} />
                              </div>
                            )}
                            {lead.report_status === 'rejected' && (
                              <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'var(--color-danger-light)', color: 'var(--color-danger)' }} title={t("Từ chối")}>
                                <XCircle size={16} />
                              </div>
                            )}
                            {(!lead.report_status || lead.report_status === 'rejected') && isAllowedToReport && lead.status !== 'reminder' && lead.status !== 'databank_claim' &&
                              (!data.below_standard_fallback_round_ids || !data.below_standard_fallback_round_ids.includes(Number(lead.round_id))) &&
                              (!data.below_standard_fallback_round_id || Number(lead.round_id) !== Number(data.below_standard_fallback_round_id)) && (
                                <button
                                  onClick={() => handleOpenReportModal(lead)}
                                  className="btn sm danger"
                                  style={{ borderRadius: '50%', width: 32, height: 32, padding: 0 }}
                                >
                                  <AlertCircle size={16} />
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
                <span>{t('Không tìm thấy dữ liệu nào.')}</span>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {t('Hiển thị')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</span> {t('trên')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{totalCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
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
                        onClick={() => setCurrentPage(pageNum)}
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
                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDatabankView = () => {
    const DATABANK_ITEMS_PER_PAGE = 10;
    const databankTotalPages = Math.ceil(publicLeads.length / DATABANK_ITEMS_PER_PAGE);
    const paginatedPublicLeads = publicLeads.slice((databankPage - 1) * DATABANK_ITEMS_PER_PAGE, databankPage * DATABANK_ITEMS_PER_PAGE);
    const isAdmin = ['admin', 'superadmin', 'super_admin', 'director'].includes(String(user?.role || displayUser?.role || '').toLowerCase());

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: isMobile ? '100px' : '0' }}>
        {/* Header Block */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1rem 1.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.75rem'
        }}>
          {/* Top header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('KHO DATA CHUNG (DATABANK)')}
              </h3>
              <button
                onClick={() => setShowDatabankHelpModal(true)}
                style={{
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  border: '1px solid var(--color-border)',
                  padding: '3px 8px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  transition: 'all 0.2s',
                  height: '22px'
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
                title={t("Xem hướng dẫn quy chế Kho data chung và thời gian thu hồi")}
              >
                <Info size={11} />
                <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowDatabankSettingsModal(true)}
                className="btn secondary"
                style={{
                  height: '32px',
                  width: '32px',
                  padding: 0,
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-light)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
                title={t("Cấu hình nhanh Kho Databank")}
              >
                <Settings size={14} />
              </button>
            )}
          </div>

          {/* Description & Quotas row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
            borderTop: '1px solid var(--color-border-light)', paddingTop: '0.5rem'
          }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, flex: 1, minWidth: '240px' }}>
              {t('Danh sách các khách hàng tiềm năng đã công khai. Bấm "Nhận Data" để trực tiếp nhận chăm sóc.')}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* 3 Quota Badges */}
              {publicQuota && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap', flexShrink: 0 }}>
                  {[
                    {
                      label: t('Giờ'),
                      value: publicQuota.claims_hour,
                      limit: publicQuota.limit_hour,
                      icon: <Clock size={12} />,
                      color: 'var(--color-primary)',
                    },
                    {
                      label: t('Ngày'),
                      value: publicQuota.claims_day,
                      limit: publicQuota.limit_day,
                      icon: <Calendar size={12} />,
                      color: '#d97706',
                    },
                    {
                      label: t('Tháng'),
                      value: publicQuota.claims_month,
                      limit: publicQuota.limit_month,
                      icon: <Layers size={12} />,
                      color: '#2563eb',
                    }
                  ].map((q, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'transparent',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '8px',
                      padding: '4px 6px',
                      height: '30px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }} title={t('Hạn mức ') + q.label}>
                      <span style={{ color: q.color, display: 'flex', alignItems: 'center' }}>{q.icon}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', fontWeight: 600 }}>{q.label}:</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text)', fontWeight: 800, marginLeft: '2px' }}>
                        {q.value}/{q.limit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/* Status Filter for Admin */}
              {isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('Bộ lọc:')}</span>
                  <CustomSelect
                    options={[
                      { value: 'none', label: t('Hoạt động') },
                      { value: 'only', label: t('Đã ẩn/xóa') },
                      { value: 'all', label: t('Tất cả') }
                    ]}
                    value={showDeletedFilter}
                    onChange={(val) => setShowDeletedFilter(val as any)}
                    width={110}
                  />
                </div>
              )}

              {/* Action buttons for Admin */}
              {isAdmin && selectedPublicLeads.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {showDeletedFilter !== 'only' && (
                    <button
                      onClick={() => handleDeletePublicLeads(selectedPublicLeads)}
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        cursor: 'pointer'
                      }}
                      title={t('Ẩn/Xóa khỏi Databank')}
                    >
                      <Trash2 size={12} />
                      {t('Ẩn/Xóa')} ({selectedPublicLeads.length})
                    </button>
                  )}

                  {showDeletedFilter !== 'none' && (
                    <button
                      onClick={() => handleRestorePublicLeads(selectedPublicLeads)}
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        cursor: 'pointer'
                      }}
                      title={t('Khôi phục hiển thị Databank')}
                    >
                      <RotateCcw size={12} />
                      {t('Khôi phục')} ({selectedPublicLeads.length})
                    </button>
                  )}

                  <button
                    onClick={() => handleBlockPublicLeads(selectedPublicLeads)}
                    style={{
                      height: '30px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(220, 38, 38, 0.15)',
                      color: '#dc2626',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      cursor: 'pointer'
                    }}
                    title={t('Chặn vĩnh viễn')}
                  >
                    <Ban size={12} />
                    {t('Chặn')} ({selectedPublicLeads.length})
                  </button>

                  <button
                    onClick={() => handleUnblockPublicLeads(selectedPublicLeads)}
                    style={{
                      height: '30px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: '#3b82f6',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      cursor: 'pointer'
                    }}
                    title={t('Hủy chặn vĩnh viễn')}
                  >
                    <CheckSquare size={12} />
                    {t('Bỏ chặn')} ({selectedPublicLeads.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {publicLoading ? (
          isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <Skeleton width={42} height={42} borderRadius="50%" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      <Skeleton width="60%" height={14} />
                      <Skeleton width="40%" height={10} />
                      <Skeleton width="50%" height={10} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                    <Skeleton width={68} height={22} borderRadius={12} />
                    <Skeleton width={50} height={12} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TableSkeleton cols={isAdmin ? 5 : 4} rows={6} />
          )
        ) : publicLeads.length === 0 ? (
          <EmptyCard
            icon={<Database size={48} />}
            title={t("Kho chung trống")}
            description={t("Hiện tại không có khách hàng tiềm năng nào được công khai để nhận.")}
          />
        ) : isMobile ? (
          /* ── Mobile Card View ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {paginatedPublicLeads.map((lead) => {
              const hasClaimed = lead.takers && lead.takers.some((t: any) => Number(t.id) === Number(displayUser?.id) || Number(t.id) === Number(displayUser?.consultant_id));
              const isFull = lead.takers && lead.takers.length >= 2;
              const takerCount = lead.takers ? lead.takers.length : 0;
              const availableCount = Math.max(0, 2 - takerCount);
              const canClaim = !hasClaimed && !isFull && isClaimingLeadId === null && !isAdmin;

              // Determine badge colors based on takerCount
              const badgeBg = isFull ? 'rgba(107, 114, 128, 0.1)' : (availableCount === 1 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)');
              const badgeColor = isFull ? '#4b5563' : (availableCount === 1 ? '#1d4ed8' : '#047857');
              const badgeText = isFull ? t('Giới hạn (0/2)') : (availableCount === 1 ? t('Public (1/2)') : t('Public (2/2)'));

              return (
                <div 
                  key={lead.id}
                  onClick={() => {
                    if (isAdmin) {
                      setAdminActionLead(lead);
                    } else if (canClaim) {
                      handleClaimLead(lead.id, lead.full_name || lead.name);
                    }
                  }}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    padding: '12px 16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    cursor: (canClaim || isAdmin) ? 'pointer' : 'default'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{ flexShrink: 0 }}>
                      <Avatar name={lead.full_name || t('Khách hàng')} size={42} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '2px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: 1.2 }}>
                        {lead.full_name || t('Khách hàng')}
                      </span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {t('Điện thoại')}: {lead.phone || '—'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: badgeBg,
                      color: badgeColor,
                      whiteSpace: 'nowrap'
                    }}>
                      {badgeText}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Mobile Pagination */}
            {databankTotalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                <button onClick={() => setDatabankPage(prev => Math.max(prev - 1, 1))} disabled={databankPage === 1} className="btn sm secondary" style={{ height: 32, padding: '0 12px' }}>
                  {t('Trước')}
                </button>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{databankPage} / {databankTotalPages}</span>
                <button onClick={() => setDatabankPage(prev => Math.min(prev + 1, databankTotalPages))} disabled={databankPage === databankTotalPages || databankTotalPages === 0} className="btn sm secondary" style={{ height: 32, padding: '0 12px' }}>
                  {t('Sau')}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Desktop Table View ── */
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
          }}>
            <div style={{
              overflowX: 'auto',
              maxHeight: '680px',
              overflowY: 'auto'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    {isAdmin && (
                      <th style={{ padding: '1rem', width: '40px' }}>
                        <input 
                          type="checkbox" 
                          checked={paginatedPublicLeads.length > 0 && paginatedPublicLeads.every(lead => selectedPublicLeads.includes(lead.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newSelections = [...selectedPublicLeads];
                              paginatedPublicLeads.forEach(lead => {
                                if (!newSelections.includes(lead.id)) {
                                  newSelections.push(lead.id);
                                }
                              });
                              setSelectedPublicLeads(newSelections);
                            } else {
                              const pageIds = paginatedPublicLeads.map(l => l.id);
                              setSelectedPublicLeads(selectedPublicLeads.filter(id => !pageIds.includes(id)));
                            }
                          }}
                        />
                      </th>
                    )}
                    <th style={{ padding: '1rem', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Khách hàng')}</th>
                    <th style={{ padding: '1rem', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Liên hệ')}</th>
                    <th style={{ padding: '1rem', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Trạng thái')}</th>
                    <th style={{ padding: '1rem', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Thời gian ra kho')}</th>
                    <th style={{ padding: '1rem', width: isAdmin ? 190 : 140 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPublicLeads.map((lead) => {
                    const hasClaimed = lead.takers && lead.takers.some((t: any) => Number(t.id) === Number(displayUser?.id) || Number(t.id) === Number(displayUser?.consultant_id));
                    const isFull = lead.takers && lead.takers.length >= 2;
                    const isAdmin = ['admin', 'superadmin', 'super_admin', 'director'].includes(String(user?.role || displayUser?.role || '').toLowerCase());
                    const canClaim = !hasClaimed && !isFull && isClaimingLeadId === null && !isAdmin;

                    return (
                      <tr 
                        key={lead.id} 
                        className="table-row-hover" 
                        onClick={() => {
                          if (isAdmin) {
                            setAdminActionLead(lead);
                          } else if (canClaim) {
                            handleClaimLead(lead.id, lead.full_name || lead.name);
                          }
                        }}
                        style={{ 
                          borderBottom: '1px solid var(--color-border-light)', 
                          color: 'var(--color-text)', 
                          transition: 'background 0.2s',
                          cursor: (canClaim || isAdmin) ? 'pointer' : 'default'
                        }}
                      >
                        {isAdmin && (
                          <td style={{ padding: '1rem' }} onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={selectedPublicLeads.includes(lead.id)}
                              onChange={() => {
                                if (selectedPublicLeads.includes(lead.id)) {
                                  setSelectedPublicLeads(selectedPublicLeads.filter(id => id !== lead.id));
                                } else {
                                  setSelectedPublicLeads([...selectedPublicLeads, lead.id]);
                                }
                              }}
                            />
                          </td>
                        )}
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar name={lead.full_name || t('Khách hàng')} size={32} />
                            <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{lead.full_name || t('Khách hàng')}</span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                            {lead.phone || '-'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{lead.email || '-'}</div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {getStatusBadge('databank', undefined, undefined, undefined, lead.takers)}
                              {Number(lead.deleted_from_databank) === 1 && (
                                <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                  {t('Đã ẩn/xóa')}
                                </span>
                              )}
                              {Number(lead.is_blocked) === 1 && (
                                <span className="badge" style={{ background: 'rgba(17, 24, 39, 0.1)', color: '#111827', border: '1px solid rgba(17, 24, 39, 0.2)' }}>
                                  {t('Đã chặn')}
                                </span>
                              )}
                            </div>
                            {(() => {
                              const currentUserRole = String(user?.role || displayUser?.role || '').toLowerCase();
                              const currentUserId = Number(user?.id || displayUser?.id || 0);
                              
                              let displayTakers = [];
                              if (lead.takers) {
                                if (['admin', 'superadmin', 'super_admin', 'director'].includes(currentUserRole)) {
                                  displayTakers = lead.takers;
                                } else if (['sale', 'sales'].includes(currentUserRole)) {
                                  displayTakers = [];
                                } else if (currentUserRole === 'manager') {
                                  const managedTeamIds = teamsList.map((t: any) => Number(t.id));
                                  displayTakers = lead.takers.filter((taker: any) => {
                                    if (Number(taker.id) === currentUserId) return true;
                                    const takerUser = users.find((u: any) => Number(u.id) === Number(taker.id));
                                    return takerUser && takerUser.team_id && managedTeamIds.includes(Number(takerUser.team_id));
                                  });
                                } else {
                                  displayTakers = [];
                                }
                              }
                              
                              if (displayTakers.length === 0) return null;
                              
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {displayTakers.map((taker: any, tIdx: number) => (
                                      <div 
                                        key={taker.id || tIdx} 
                                        style={{ 
                                          marginLeft: tIdx > 0 ? '-6px' : '0', 
                                          zIndex: 10 - tIdx,
                                          position: 'relative'
                                        }}
                                        title={`${taker.name || 'Sale'} (${taker.claimed_at ? new Date(taker.claimed_at).toLocaleString('vi-VN') : ''})`}
                                      >
                                        <Avatar 
                                          src={taker.avatar} 
                                          name={taker.name} 
                                          size={20} 
                                          style={{ 
                                            border: '1.5px solid var(--color-surface)',
                                            boxShadow: 'var(--shadow-sm)'
                                          }} 
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                    {displayTakers.map((t: any) => t.name).join(', ')}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                          {lead.released_to_kho_at ? new Date(lead.released_to_kho_at).toLocaleString('vi-VN') : '-'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            {isAdmin && (
                              <>
                                {Number(lead.deleted_from_databank) === 1 ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestorePublicLeads([lead.id]);
                                    }}
                                    className="btn sm outline success-hover"
                                    style={{
                                      height: 32,
                                      width: 32,
                                      padding: 0,
                                      borderRadius: '50%',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1px solid var(--color-border)',
                                      background: 'transparent',
                                      color: 'var(--color-text-muted)',
                                      cursor: 'pointer'
                                    }}
                                    title={t('Khôi phục hiển thị Databank')}
                                  >
                                    <RotateCcw size={14} />
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePublicLeads([lead.id]);
                                    }}
                                    className="btn sm outline danger-hover"
                                    style={{
                                      height: 32,
                                      width: 32,
                                      padding: 0,
                                      borderRadius: '50%',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1px solid var(--color-border)',
                                      background: 'transparent',
                                      color: 'var(--color-text-muted)',
                                      cursor: 'pointer'
                                    }}
                                    title={t('Ẩn/Xóa khỏi Databank')}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}

                                {Number(lead.is_blocked) === 1 ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnblockPublicLeads([lead.id]);
                                    }}
                                    className="btn sm outline info-hover"
                                    style={{
                                      height: 32,
                                      width: 32,
                                      padding: 0,
                                      borderRadius: '50%',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1px solid var(--color-border)',
                                      background: 'transparent',
                                      color: 'var(--color-text-muted)',
                                      cursor: 'pointer'
                                    }}
                                    title={t('Hủy chặn vĩnh viễn')}
                                  >
                                    <CheckSquare size={14} />
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleBlockPublicLeads([lead.id]);
                                    }}
                                    className="btn sm outline danger-hover"
                                    style={{
                                      height: 32,
                                      width: 32,
                                      padding: 0,
                                      borderRadius: '50%',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1px solid var(--color-border)',
                                      background: 'transparent',
                                      color: 'var(--color-text-muted)',
                                      cursor: 'pointer'
                                    }}
                                    title={t('Chặn vĩnh viễn liên hệ')}
                                  >
                                    <Ban size={14} />
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClaimLead(lead.id, lead.full_name || lead.name);
                              }}
                              disabled={isClaimingLeadId !== null || hasClaimed || isFull || isAdmin}
                              className={isFull ? "btn outline sm" : (hasClaimed ? "btn success sm" : "btn primary sm")}
                              style={{
                                height: 32,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '0 10px',
                                background: isAdmin ? 'rgba(0,0,0,0.04)' : (hasClaimed ? 'rgba(16,185,129,0.12)' : (isFull ? 'transparent' : '#BD1D2D')),
                                color: isAdmin ? 'var(--color-text-muted)' : (hasClaimed ? '#10b981' : (isFull ? 'var(--color-text-muted)' : '#ffffff')),
                                border: isAdmin ? '1px solid var(--color-border-light)' : (hasClaimed ? '1px solid rgba(16,185,129,0.2)' : (isFull ? '1px solid var(--color-border)' : 'none')),
                                borderRadius: '16px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: (hasClaimed || isFull || isAdmin) ? 'none' : '0 4px 12px rgba(189,29,45,0.15)',
                                cursor: isAdmin ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {isClaimingLeadId === lead.id 
                                ? t('Đang nhận...') 
                                : (hasClaimed ? t('Đã nhận') : (isFull ? t('Hết lượt') : (isAdmin ? t('Chỉ dành cho Sales') : t('Nhận Data'))))}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {databankTotalPages > 1 && (
              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {t('Hiển thị')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(databankPage - 1) * DATABANK_ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(databankPage * DATABANK_ITEMS_PER_PAGE, publicLeads.length)}</span> {t('trên')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{publicLeads.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => setDatabankPage(prev => Math.max(prev - 1, 1))} disabled={databankPage === 1} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: Math.min(5, databankTotalPages) }, (_, i) => {
                      let startPage = 1;
                      if (databankTotalPages > 5) {
                        if (databankPage > 3) {
                          startPage = databankPage - 2;
                          if (startPage + 4 > databankTotalPages) {
                            startPage = databankTotalPages - 4;
                          }
                        }
                      }
                      const pageNum = startPage + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setDatabankPage(pageNum)}
                          style={{
                            width: 32, height: 32, borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                            border: databankPage === pageNum ? 'none' : '1px solid var(--color-border)',
                            background: databankPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: databankPage === pageNum ? 'white' : 'var(--color-text)',
                            cursor: 'pointer'
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setDatabankPage(prev => Math.min(prev + 1, databankTotalPages))} disabled={databankPage === databankTotalPages || databankTotalPages === 0} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {adminActionLead && (
          <CustomModal
            isOpen={!!adminActionLead}
            onClose={() => setAdminActionLead(null)}
            title={t('Thao tác dữ liệu Kho chung')}
            width="420px"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center', padding: '0.5rem 0' }}>
              <Avatar name={adminActionLead.full_name || t('Khách hàng')} size={64} />
              <div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px' }}>
                  {adminActionLead.full_name || t('Khách hàng')}
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t('SĐT:')} <strong>{adminActionLead.phone || '—'}</strong> | {t('Email:')} <strong>{adminActionLead.email || '—'}</strong>
                </p>
                {adminActionLead.released_to_kho_at && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', margin: '4px 0 0' }}>
                    {t('Thời gian ra kho:')} {new Date(adminActionLead.released_to_kho_at).toLocaleString('vi-VN')}
                  </p>
                )}
              </div>

              <div style={{ 
                width: '100%', 
                borderTop: '1px solid var(--color-border-light)', 
                paddingTop: '1.25rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '10px' 
              }}>
                {Number(adminActionLead.deleted_from_databank) === 1 ? (
                  <button
                    onClick={() => {
                      handleRestorePublicLeads([adminActionLead.id]);
                      setAdminActionLead(null);
                    }}
                    className="btn primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#10b981' }}
                  >
                    <RotateCcw size={16} />
                    {t('Khôi phục hiển thị Databank')}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleDeletePublicLeads([adminActionLead.id]);
                      setAdminActionLead(null);
                    }}
                    className="btn danger"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Trash2 size={16} />
                    {t('Ẩn/Xóa khỏi Databank')}
                  </button>
                )}

                {Number(adminActionLead.is_blocked) === 1 ? (
                  <button
                    onClick={() => {
                      handleUnblockPublicLeads([adminActionLead.id]);
                      setAdminActionLead(null);
                    }}
                    className="btn outline"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderColor: 'var(--color-border)' }}
                  >
                    <CheckSquare size={16} />
                    {t('Hủy chặn vĩnh viễn')}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleBlockPublicLeads([adminActionLead.id]);
                      setAdminActionLead(null);
                    }}
                    className="btn secondary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#374151', color: '#fff' }}
                  >
                    <Ban size={16} />
                    {t('Chặn vĩnh viễn liên hệ')}
                  </button>
                )}
              </div>
            </div>
          </CustomModal>
        )}
      </div>
    );
  };

  const renderTicketsView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Ticket Filters Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1rem 1.5rem'
        }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {t('DANH SÁCH BÁO CÁO LỖI')}
              <button
                onClick={() => setShowTicketHelpModal(true)}
                style={{
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  border: '1px solid var(--color-border)',
                  padding: '3px 8px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  transition: 'all 0.2s',
                  height: '22px'
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
                title={t("Xem hướng dẫn quy trình báo báo lỗi và đền bù")}
              >
                <Info size={11} />
                <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
              </button>
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>{t('Theo dõi tình trạng phê duyệt đền bù data lỗi từ Admin.')}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TRẠNG THÁI:')}</span>
              <CustomSelect
                options={[
                  { value: 'all', label: t('Tất cả trạng thái') },
                  { value: 'pending', label: t('Chờ xử lý') },
                  { value: 'approved', label: t('Đã bù') },
                  { value: 'rejected', label: t('Từ chối') }
                ]}
                value={ticketStatusFilter}
                onChange={(val) => {
                  setTicketStatusFilter(String(val));
                  setTicketPage(1);
                }}
                width={160}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('THỜI GIAN:')}</span>
              <CustomSelect
                options={[
                  { value: 'Tất cả', label: t('Tất cả thời gian') },
                  { value: 'Hôm nay', label: t('Hôm nay') },
                  { value: 'Hôm qua', label: t('Hôm qua') },
                  { value: 'Tuần này', label: t('Tuần này') },
                  { value: 'Tháng này', label: t('Tháng này') },
                  { value: 'Tháng trước', label: t('Tháng trước') }
                ]}
                value={ticketDateFilter}
                onChange={(val) => {
                  setTicketDateFilter(String(val));
                  setTicketPage(1);
                }}
                width={160}
              />
            </div>

            <button
              onClick={loadTicketsData}
              disabled={ticketsLoading}
              className="btn sm secondary"
              style={{ height: 38 }}
            >
              <RefreshCw size={14} style={{ animation: ticketsLoading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Tickets Table / List */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              {t('CHI TIẾT TICKETS')}
            </h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', background: 'var(--color-border-light)', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
              {t('Đang hiển thị')} {tickets.length} / {ticketTotalCount} {t('dòng')}
            </span>
          </div>

          <div className="table-wrap responsive-table-wrap mobile-card-table" style={{
            overflowX: isMobile ? 'visible' : 'auto',
            maxHeight: isMobile ? 'none' : '520px',
            overflowY: isMobile ? 'visible' : 'auto'
          }}>
            {ticketsLoading ? (
              <TableSkeleton cols={5} rows={6} />
            ) : tickets.length > 0 ? (
              <table style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('KHÁCH HÀNG')}</th>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('TƯ VẤN VIÊN')}</th>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700, textAlign: 'center' }}>{t('TRẠNG THÁI')}</th>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('PHẢN HỒI TỪ ADMIN')}</th>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('THỜI GIAN BÁO')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket: any) => {
                    let statusColor = '#d97706';
                    let statusBg = '#fef3c7';
                    let statusText = t('Chờ duyệt');
                    if (ticket.status === 'approved') {
                      statusColor = 'var(--color-success)';
                      statusBg = 'var(--color-success-light)';
                      statusText = t('Đã bù');
                    } else if (ticket.status === 'rejected') {
                      statusColor = 'var(--color-danger)';
                      statusBg = 'var(--color-danger-light)';
                      statusText = t('Từ chối');
                    }

                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => {
                          setSelectedDetailTicket(ticket);
                          setTicketModalOpen(true);
                        }}
                        style={{
                          borderBottom: '1px solid var(--color-border-light)',
                          background: 'var(--color-surface)',
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar name={ticket.lead_name || t('Khách hàng')} size={32} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{ticket.lead_name || t('Ẩn danh')}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{ticket.lead_phone}</span>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar src={ticket.consultant_avatar} name={ticket.consultant_name} size={32} />
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{ticket.consultant_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                {ticket.round_name || t('Mặc định')}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                            background: statusBg, color: statusColor, display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            {ticket.status === 'pending' && <Clock size={12} />}
                            {ticket.status === 'approved' && <CheckCircle2 size={12} />}
                            {ticket.status === 'rejected' && <XCircle size={12} />}
                            {statusText}
                          </span>
                        </td>

                        <td style={{ padding: '1rem 1.25rem' }}>
                          {ticket.status === 'pending' ? (
                            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>{t('Đang xử lý...')}</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Avatar src={ticket.resolved_by_avatar} name={ticket.resolved_by || t('Hệ thống')} size={32} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                                  {ticket.resolved_by || t('Hệ thống')}
                                </span>
                                {ticket.status === 'approved' && (
                                  <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                                    {ticket.approval_reason ? ticket.approval_reason : t('Chấp nhận đền bù')}
                                  </span>
                                )}
                                {ticket.status === 'rejected' && (
                                  <span style={{ color: 'var(--color-danger)', fontWeight: 500 }}>
                                    {ticket.reject_reason ? ticket.reject_reason : t('Không đền bù')}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '1rem 1.25rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                          {ticket.created_at ? new Date(ticket.created_at).toLocaleString('vi-VN') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '2rem 1rem' }}>
                <EmptyCard
                  icon={<Ticket />}
                  title={t('Không tìm thấy ticket nào')}
                  description={t('Hệ thống không tìm thấy bất kỳ Ticket báo lỗi hoặc yêu cầu hỗ trợ nào khớp với bộ lọc hiện tại.')}
                />
              </div>
            )}
          </div>

          {/* Ticket Pagination */}
          {ticketTotalPages > 1 && (
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {t('Hiển thị')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(ticketPage - 1) * TICKET_ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(ticketPage * TICKET_ITEMS_PER_PAGE, ticketTotalCount)}</span> {t('trên')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{ticketTotalCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => setTicketPage(prev => Math.max(prev - 1, 1))} disabled={ticketPage === 1} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
                  <ChevronLeft size={16} />
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: Math.min(5, ticketTotalPages) }, (_, i) => {
                    let startPage = 1;
                    if (ticketTotalPages > 5) {
                      if (ticketPage > 3) {
                        startPage = ticketPage - 2;
                        if (startPage + 4 > ticketTotalPages) {
                          startPage = ticketTotalPages - 4;
                        }
                      }
                    }
                    const pageNum = startPage + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setTicketPage(pageNum)}
                        style={{
                          width: 32, height: 32, borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                          border: ticketPage === pageNum ? 'none' : '1px solid var(--color-border)',
                          background: ticketPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: ticketPage === pageNum ? 'white' : 'var(--color-text)',
                          cursor: 'pointer'
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setTicketPage(prev => Math.min(prev + 1, ticketTotalPages))} disabled={ticketPage === ticketTotalPages || ticketTotalPages === 0} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCalendarView = () => {
    const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const monthName = new Intl.DateTimeFormat(
      language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : 'en-US',
      { month: 'long' }
    ).format(currentDate);

    const days = [];
    const totalDays = daysInMonth(y, m);
    const startOffset = (firstDayOfMonth(y, m) + 6) % 7;

    // Padding for start of month
    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-start-${i}`} style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', opacity: 0.3 }}></div>);
    }

    // Days of month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = calendarData[dateStr] || { distributed: 0, blacklist: 0, reminder: 0, error: 0, ticket_total: 0 };
      const isToday = new Date().toDateString() === new Date(y, m, d).toDateString();
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
            backgroundColor: isWeekend
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
          </div>
        </div>
      );
    }

    const totalCells = startOffset + totalDays;
    const rowsCount = Math.ceil(totalCells / 7);
    const targetTotalCells = rowsCount * 7;
    const endOffset = targetTotalCells - totalCells;
    for (let i = 0; i < endOffset; i++) {
      days.push(<div key={`empty-end-${i}`} style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', opacity: 0.3 }}></div>);
    }

    return (
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
                {monthName} {y}
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
          </div>

          {/* Calendar Legend */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', fontWeight: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></span>
              <span style={{ color: 'var(--color-text-muted)' }}>{t('Đã chia')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a31422' }}></span>
              <span style={{ color: 'var(--color-text-muted)' }}>{t('Ticket lỗi')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#db2777' }}></span>
              <span style={{ color: 'var(--color-text-muted)' }}>{t('Nhắc lại')}</span>
            </div>
          </div>
        </div>

        {/* Calendar Body */}
        <div className="responsive-table-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="card calendar-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, minWidth: 700, overflow: 'hidden' }}>
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
    );
  };

  const renderScheduleView = () => {
    const profile = data.consultant_profile;
    if (!profile) {
      return (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '2rem', padding: '1rem', width: '100%' }}>
          {!isMobile && (
            <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '1rem', flexShrink: 0 }}>
              <CardSkeleton height={150} />
              <CardSkeleton height={40} />
              <CardSkeleton height={40} />
              <CardSkeleton height={40} />
            </div>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <CardSkeleton height={120} />
            <CardSkeleton height={200} />
          </div>
        </div>
      );
    }

    const getTabLabel = (tab: string) => {
      switch (tab) {
        case 'schedule': return t('Lịch trực nhận data');
        case 'personal': return t('Thông tin cá nhân');
        case 'erp': return t('Hồ sơ & ERP');
        case 'assets': return t('Tài sản cấp phát');
        case 'certificates': return t('Bằng cấp & Chứng chỉ');
        case 'hr_records': return t('Khen thưởng & Kỷ luật');
        case 'contact': return t('Thông tin liên hệ');
        case 'payment': return t('Thanh toán & Thuế');
        case 'emergency': return t('Liên hệ khẩn cấp');
        case 'documents': return t('Lưu trữ tài liệu');
        case 'security': return t('Tài khoản & Bảo mật');
        default: return '';
      }
    };

    const renderColoredIcon = (IconComponent: any, bgColor: string) => (
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '7px',
        backgroundColor: bgColor,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0
      }}>
        <IconComponent size={15} color="white" style={{ display: 'block', width: '15px', height: '15px', margin: 'auto' }} />
      </div>
    );

    const cardContainerStyle = (isMobile: boolean, customBorderRadius?: string): React.CSSProperties => (isMobile ? {
      padding: '1.25rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      background: 'var(--color-surface)',
      borderRadius: '12px',
      boxShadow: 'none'
    } : {
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      background: 'var(--color-surface)',
      borderRadius: customBorderRadius || '12px',
      border: '1px solid var(--color-border-light)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
    });

    const onLeave = isCurrentlyOnLeave(profile);

    const handleDayActiveToggle = (dayKey: string, active: boolean) => {
      setEditWorkSchedule((prev: any) => ({
        ...prev,
        [dayKey]: {
          ...(prev[dayKey] || { active: true, start: editWorkStartTime, end: editWorkEndTime }),
          active
        }
      }));
    };

    const handleDayTimeChange = (dayKey: string, field: 'start' | 'end', value: string) => {
      setEditWorkSchedule((prev: any) => ({
        ...prev,
        [dayKey]: {
          ...(prev[dayKey] || { active: true, start: editWorkStartTime, end: editWorkEndTime }),
          [field]: value
        }
      }));
    };

    const getProfileAssets = (p: any): AssignedAsset[] => {
      if (!p) return [];
      if (Array.isArray(p.assigned_assets)) return p.assigned_assets;
      if (Array.isArray(p.erp_profile?.assigned_assets)) return p.erp_profile.assigned_assets;
      if (p.extra_fields_json) {
        try {
          const extra = typeof p.extra_fields_json === 'string' ? JSON.parse(p.extra_fields_json) : p.extra_fields_json;
          if (extra.erp_profile?.assigned_assets) return extra.erp_profile.assigned_assets;
          if (extra.assigned_assets) return extra.assigned_assets;
        } catch (e) {}
      }
      return [];
    };
    const profileAssets = getProfileAssets(profile);

    const canEditUserAssets = ['admin', 'superadmin', 'manager'].includes(String(user?.role).toLowerCase());

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1rem', padding: isMobile ? '0.25rem 0' : '0.5rem 0' }}>
        {/* Sticky Header block */}
        {(!isMobile || profileActiveTab) && (
          <div style={{
            position: 'sticky',
            top: isMobile ? '-1.25rem' : '-1.5rem',
            zIndex: 100,
            background: 'var(--color-bg)',
            padding: isMobile ? '1rem 0 0.75rem 0' : '1.5rem 0 1rem 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--color-border)',
            margin: isMobile ? '-1.25rem 0 1rem 0' : '-1.5rem 0 1.5rem 0',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {isMobile && profileActiveTab && (
                <button 
                  onClick={() => setProfileActiveTab('')} 
                  style={{ border: 'none', background: 'transparent', padding: '4px', cursor: 'pointer', color: 'var(--color-text)', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <h2 style={{ 
                  fontSize: isMobile ? '1.1rem' : '1.5rem', 
                  fontWeight: 800, 
                  color: 'var(--color-text)', 
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {isMobile ? getTabLabel(profileActiveTab) : t('QUẢN LÝ TÀI KHOẢN')}
                </h2>
                {!isMobile && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', margin: 0 }}>
                    {t('Cấu hình thông tin cá nhân, ảnh đại diện và thời gian trực nhận lead tự động.')}
                  </p>
                )}
              </div>
            </div>

            {(!isMobile || profileActiveTab) && (
              <button
                className="btn primary"
                style={isMobile ? { 
                  height: '36px', 
                  width: '44px', 
                  borderRadius: '10px', 
                  padding: '0', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexShrink: 0
                } : { 
                  height: '38px', 
                  padding: '0 1.5rem', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  flexShrink: 0,
                  fontSize: '0.875rem'
                }}
                onClick={handleSaveProfile}
                disabled={savingProfile || isUploadingAvatar}
              >
                {savingProfile ? (
                  <RefreshCw size={isMobile ? 16 : 14} className="spin" />
                ) : (
                  <Save size={isMobile ? 16 : 14} />
                )}
                {!isMobile && (savingProfile ? t('Đang lưu...') : t('Lưu thiết lập'))}
              </button>
            )}
          </div>
        )}

        {/* Responsive flex container with sidebar tabs */}
        <div className={styles.drawerBody} style={{
          background: 'var(--color-surface)',
          borderRadius: '16px',
          border: '1px solid var(--color-border-light)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'visible',
          minHeight: isMobile ? 'auto' : '650px',
          margin: '0'
        }}>
          {/* LEFT SIDEBAR: Avatar & Tabs */}
          {(!isMobile || !profileActiveTab) && (
            <div style={isMobile ? {
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              padding: '1.25rem 1rem',
              background: 'var(--color-bg-alt)',
              boxSizing: 'border-box'
            } : {
              width: '250px',
              borderRight: '1px solid var(--color-border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              padding: '1.5rem 1rem',
              flexShrink: 0,
              background: 'var(--color-bg-alt)',
              position: 'sticky',
              top: '5rem',
              alignSelf: 'flex-start',
              zIndex: 10,
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '0px',
              borderBottomLeftRadius: '16px'
            }}>
              {isMobile ? (
                /* ── Mobile OS Settings Card-Style Standalone Avatar Card ── */
                <div 
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('label')) return;
                    setProfileActiveTab('personal');
                  }}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    width: '100%'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                      <div style={{
                        border: '2px solid var(--color-primary-light)',
                        borderRadius: '50%',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--color-surface)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                      }}>
                        <Avatar src={editAvatar} name={editName} size={60} />
                      </div>
                      <label style={{
                        position: 'absolute', bottom: -2, right: -2,
                        background: 'var(--color-primary)', color: 'white',
                        width: 22, height: 22, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', boxShadow: '0 2px 4px rgba(163, 20, 34, 0.3)',
                        transition: 'all 0.2s', border: '1.5px solid var(--color-surface)'
                      }} className="hover-lift active-press" title={t('Tải lên ảnh đại diện mới')}>
                        <Camera size={10} />
                        <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                      </label>
                      {isUploadingAvatar && (
                        <div style={{
                          position: 'absolute', inset: 2, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.6)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          backdropFilter: 'blur(2px)'
                        }}>
                          <RefreshCw className="spin" size={14} color="white" />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                        {editName}
                      </h4>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        {editPersonalPhone ? `${t('Điện thoại:')} ${editPersonalPhone}` : profile.email}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
                </div>
              ) : (
                /* ── Desktop Profile Avatar Section ── */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0' }}>
                  <div style={{ position: 'relative', display: 'inline-flex', marginBottom: '0.75rem' }}>
                    <div style={{
                      border: '3px solid var(--color-primary-light)',
                      borderRadius: '50%',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--color-surface)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}>
                      <Avatar src={editAvatar} name={editName} size={80} />
                    </div>
                    <label style={{
                      position: 'absolute', bottom: 0, right: 0,
                      background: 'var(--color-primary)', color: 'white',
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', boxShadow: '0 2px 6px rgba(163, 20, 34, 0.3)',
                      transition: 'all 0.2s', border: '2px solid var(--color-surface)'
                    }} className="hover-lift active-press" title={t('Tải lên ảnh đại diện mới')}>
                      <Camera size={12} />
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                    </label>
                    {isUploadingAvatar && (
                      <div style={{
                        position: 'absolute', inset: 4, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(2px)'
                      }}>
                        <RefreshCw className="spin" size={18} color="white" />
                      </div>
                    )}
                  </div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px 0', textAlign: 'center' }}>
                    {editName}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>
                    {profile.email}
                  </span>
                </div>
              )}

              {/* Sidebar Tab Menu */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: isMobile ? 'visible' : 'auto', flex: 1 }} className={styles.tabGroup}>
                {isMobile ? (
                  /* ── Mobile OS Settings Card-Style Vertical Menu List ── */
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.875rem',
                    width: '100%',
                    paddingTop: '0.5rem'
                  }}>
                    {/* Group 1: Cá nhân & Lịch trực */}
                    <div style={{ fontSize: '0.65rem', fontWeight: 750, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>
                      {t('Cá nhân & Lịch trực')}
                    </div>
                    <div style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}>
                      {['sale', 'manager'].includes(String(effectiveRole).toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => setProfileActiveTab('schedule')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 16px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--color-border-light)',
                            width: '100%',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                            {renderColoredIcon(Clock, '#f09a37')}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Lịch trực nhận data')}</span>
                          </div>
                          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => setProfileActiveTab('personal')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: 'none',
                          width: '100%',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                          {renderColoredIcon(User, '#eb4e3d')}
                          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Thông tin cá nhân')}</span>
                        </div>
                        <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                      </button>
                    </div>

                    {/* Group 2: Quản lý hồ sơ */}
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 750, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px', marginTop: '0.5rem' }}>
                          {t('Quản lý hồ sơ')}
                        </div>
                        <div style={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                        }}>
                          <button
                            type="button"
                            onClick={() => setProfileActiveTab('erp')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 16px',
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '1px solid var(--color-border-light)',
                              width: '100%',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                              {renderColoredIcon(Layers, '#5856d6')}
                              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Hồ sơ & ERP')}</span>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setProfileActiveTab('certificates')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 16px',
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '1px solid var(--color-border-light)',
                              width: '100%',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                              {renderColoredIcon(Award, '#f2a20b')}
                              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Bằng cấp & Chứng chỉ')}</span>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setProfileActiveTab('hr_records')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 16px',
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '1px solid var(--color-border-light)',
                              width: '100%',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                              {renderColoredIcon(AlertCircle, '#ff9500')}
                              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Khen thưởng & Kỷ luật')}</span>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setProfileActiveTab('contact')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 16px',
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '1px solid var(--color-border-light)',
                              width: '100%',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                              {renderColoredIcon(Server, '#007af5')}
                              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Thông tin liên hệ')}</span>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setProfileActiveTab('payment')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 16px',
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '1px solid var(--color-border-light)',
                              width: '100%',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                              {renderColoredIcon(Receipt, '#34c759')}
                              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Thanh toán & Thuế')}</span>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                          </button>



                          <button
                            type="button"
                            onClick={() => setProfileActiveTab('documents')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 16px',
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '1px solid var(--color-border-light)',
                              width: '100%',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                              {renderColoredIcon(FileText, '#8e8e93')}
                              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Lưu trữ tài liệu')}</span>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setProfileActiveTab('security')}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '14px 16px',
                              background: 'transparent',
                              border: 'none',
                              width: '100%',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-text)' }}>
                              {renderColoredIcon(ShieldCheck, '#ef4444')}
                              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('Tài khoản & Bảo mật')}</span>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                          </button>
                        </div>
                      </div>

                    {/* Mobile Log Out Button */}
                    <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
                      <button
                        type="button"
                        onClick={handleLogout}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          padding: '14px 16px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: '12px',
                          width: '100%',
                          cursor: 'pointer',
                          color: '#ef4444',
                          fontWeight: 700,
                          fontSize: '0.9375rem',
                          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <LogOut size={18} />
                        <span>{t('Đăng xuất tài khoản')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Desktop Tab Menu ── */
                  <>
                    {['sale', 'manager'].includes(String(effectiveRole).toLowerCase()) && (
                      <button
                        type="button"
                        className={`${styles.sidebarTabBtn} ${profileActiveTab === 'schedule' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setProfileActiveTab('schedule')}
                        style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                      >
                        {renderColoredIcon(Clock, '#f09a37')}
                        <span style={{ whiteSpace: 'nowrap' }}>{t('Lịch trực nhận data')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${styles.sidebarTabBtn} ${profileActiveTab === 'personal' ? styles.sidebarTabActive : ''}`}
                      onClick={() => setProfileActiveTab('personal')}
                      style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                      {renderColoredIcon(User, '#eb4e3d')}
                      <span style={{ whiteSpace: 'nowrap' }}>{t('Thông tin cá nhân')}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.sidebarTabBtn} ${profileActiveTab === 'erp' ? styles.sidebarTabActive : ''}`}
                      onClick={() => setProfileActiveTab('erp')}
                      style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                      {renderColoredIcon(Layers, '#5856d6')}
                      <span style={{ whiteSpace: 'nowrap' }}>{t('Hồ sơ & ERP')}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.sidebarTabBtn} ${profileActiveTab === 'assets' ? styles.sidebarTabActive : ''}`}
                      onClick={() => setProfileActiveTab('assets')}
                      style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                      {renderColoredIcon(Package, '#8b5cf6')}
                      <span style={{ whiteSpace: 'nowrap' }}>{t('Tài sản cấp phát')}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.sidebarTabBtn} ${profileActiveTab === 'certificates' ? styles.sidebarTabActive : ''}`}
                      onClick={() => setProfileActiveTab('certificates')}
                      style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                      {renderColoredIcon(Award, '#f2a20b')}
                      <span style={{ whiteSpace: 'nowrap' }}>{t('Bằng cấp & Chứng chỉ')}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.sidebarTabBtn} ${profileActiveTab === 'hr_records' ? styles.sidebarTabActive : ''}`}
                      onClick={() => setProfileActiveTab('hr_records')}
                      style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                      {renderColoredIcon(AlertCircle, '#ff9500')}
                      <span style={{ whiteSpace: 'nowrap' }}>{t('Khen thưởng & Kỷ luật')}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.sidebarTabBtn} ${profileActiveTab === 'contact' ? styles.sidebarTabActive : ''}`}
                      onClick={() => setProfileActiveTab('contact')}
                      style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                      {renderColoredIcon(Server, '#007af5')}
                      <span style={{ whiteSpace: 'nowrap' }}>{t('Thông tin liên hệ')}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.sidebarTabBtn} ${profileActiveTab === 'payment' ? styles.sidebarTabActive : ''}`}
                      onClick={() => setProfileActiveTab('payment')}
                      style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                      {renderColoredIcon(Receipt, '#34c759')}
                      <span style={{ whiteSpace: 'nowrap' }}>{t('Thanh toán & Thuế')}</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.sidebarTabBtn} ${profileActiveTab === 'documents' ? styles.sidebarTabActive : ''}`}
                      onClick={() => setProfileActiveTab('documents')}
                      style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                      {renderColoredIcon(FileText, '#8e8e93')}
                      <span style={{ whiteSpace: 'nowrap' }}>{t('Lưu trữ tài liệu')}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.sidebarTabBtn} ${profileActiveTab === 'security' ? styles.sidebarTabActive : ''}`}
                      onClick={() => setProfileActiveTab('security')}
                      style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                      {renderColoredIcon(ShieldCheck, '#ef4444')}
                      <span style={{ whiteSpace: 'nowrap' }}>{t('Tài khoản & Bảo mật')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* RIGHT CONTENT AREA */}
          {(!isMobile || profileActiveTab) && (
            <div className={styles.contentArea} style={{
              flex: 1,
              padding: isMobile ? '1rem' : '2rem',
              background: isMobile ? 'transparent' : 'var(--color-surface)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              borderTopRightRadius: isMobile ? '0px' : '16px',
              borderBottomRightRadius: isMobile ? '0px' : '16px',
              borderTopLeftRadius: '0px',
              borderBottomLeftRadius: '0px'
            }}>
            {/* 1. PERSONAL INFO */}
            {profileActiveTab === 'personal' && (
              <div className="card animate-fade-in" style={cardContainerStyle(isMobile)}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={16} color="var(--color-primary)" /> {t('Thông tin cá nhân')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.75rem' : '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Họ và tên')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder={t('Nhập tên đầy đủ')}
                          style={{ fontWeight: 600, fontSize: isMobile ? '0.8125rem' : '0.875rem', height: isMobile ? '36px' : '40px' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Email cá nhân')}</label>
                        <input
                          type="email"
                          className="form-input"
                          value={editPersonalEmail}
                          onChange={(e) => setEditPersonalEmail(e.target.value)}
                          placeholder={t('VD: email@gmail.com')}
                          style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', height: isMobile ? '36px' : '40px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Ngày sinh')}</label>
                        <input
                          type="date"
                          className="form-input"
                          value={editDob}
                          onChange={(e) => setEditDob(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Giới tính')}</label>
                        <CustomSelect
                          options={[
                            { value: '', label: `-- ${t('Chọn giới tính')} --` },
                            { value: 'male', label: t('Nam') },
                            { value: 'female', label: t('Nữ') },
                            { value: 'other', label: t('Khác') }
                          ]}
                          value={editGender}
                          onChange={val => setEditGender(String(val))}
                          placeholder={t('Chọn giới tính...')}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.75rem' : '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Số CMND/CCCD')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editCitizenId}
                          onChange={(e) => setEditCitizenId(e.target.value)}
                          placeholder={t('Nhập số CMND hoặc CCCD')}
                          style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', height: isMobile ? '36px' : '40px' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Quốc tịch')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editNationality}
                          onChange={(e) => setEditNationality(e.target.value)}
                          placeholder={t('VD: Việt Nam')}
                          style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', height: isMobile ? '36px' : '40px' }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Tình trạng hôn nhân')}</label>
                      <CustomSelect
                        options={[
                          { value: '', label: `-- ${t('Chọn tình trạng')} --` },
                          { value: 'single', label: t('Độc thân') },
                          { value: 'married', label: t('Đã kết hôn') },
                          { value: 'divorced', label: t('Đã ly hôn') },
                          { value: 'other', label: t('Khác') }
                        ]}
                        value={editMaritalStatus}
                        onChange={val => setEditMaritalStatus(String(val))}
                        placeholder={t('Chọn tình trạng...')}
                      />
                    </div>

                    <div className="form-group" style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontWeight: 600, margin: 0, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Chữ ký Điện tử Cá nhân')}</label>
                        <button
                          type="button"
                          onClick={() => setShowSaleSignatureModal(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#BD1D2D',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Edit3 size={14} />
                          {saleSignatureUrl ? t('Thay đổi chữ ký mẫu') : t('Tạo chữ ký mẫu')}
                        </button>
                      </div>

                      {saleSignatureUrl ? (
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '120px',
                          maxHeight: '150px',
                          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                          backgroundSize: '12px 12px'
                        }}>
                          <img src={saleSignatureUrl} alt="Chữ ký mẫu" style={{ maxHeight: '110px', objectFit: 'contain' }} />
                        </div>
                      ) : (
                        <div
                          onClick={() => setShowSaleSignatureModal(true)}
                          style={{
                            border: '2px dashed var(--color-border)',
                            borderRadius: '8px',
                            padding: '32px 20px',
                            minHeight: '120px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            color: 'var(--color-text-muted)',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            background: 'var(--color-bg-light)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {t('Chưa thiết lập chữ ký mẫu. Bấm vào đây để vẽ hoặc tải ảnh chữ ký.')}
                        </div>
                      )}
                    </div>
                </div>
              </div>
            )}

            {/* 2. ERP PROFILE */}
            {profileActiveTab === 'erp' && (
              <div className="card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={16} color="var(--color-primary)" /> {t('Thông tin nhân sự & ERP')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.75rem' : '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Mã nhân viên')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editEmployeeId}
                          onChange={(e) => setEditEmployeeId(e.target.value)}
                          placeholder="VD: RL-2026-089"
                          disabled={!canEditUserAssets}
                          style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: isMobile ? '0.8125rem' : '0.875rem', height: isMobile ? '36px' : '40px', opacity: !canEditUserAssets ? 0.7 : 1, cursor: !canEditUserAssets ? 'not-allowed' : 'text' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Bộ phận / Phòng ban')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editDepartment}
                          onChange={(e) => setEditDepartment(e.target.value)}
                          placeholder="VD: Phòng Kinh doanh 1"
                          disabled={!canEditUserAssets}
                          style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', height: isMobile ? '36px' : '40px', opacity: !canEditUserAssets ? 0.7 : 1, cursor: !canEditUserAssets ? 'not-allowed' : 'text' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.75rem' : '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Chức danh / Vị trí')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editJobTitle}
                          onChange={(e) => setEditJobTitle(e.target.value)}
                          placeholder="VD: Chuyên viên Tư vấn"
                          disabled={!canEditUserAssets}
                          style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', height: isMobile ? '36px' : '40px', opacity: !canEditUserAssets ? 0.7 : 1, cursor: !canEditUserAssets ? 'not-allowed' : 'text' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Loại hợp đồng')}</label>
                        <CustomSelect
                          options={[
                            { value: 'official', label: t('Chính thức') },
                            { value: 'probation', label: t('Thử việc') },
                            { value: 'internship', label: t('Học việc / Thực tập') },
                            { value: 'collaborator', label: t('Cộng tác viên') },
                            { value: 'other', label: t('Khác') }
                          ]}
                          value={editContractType}
                          onChange={val => setEditContractType(String(val))}
                          placeholder={t('Chọn loại hợp đồng...')}
                          disabled={!canEditUserAssets}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '0.75rem' : '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Ngày vào làm')}</label>
                        <input
                          type="date"
                          className="form-input"
                          value={editDateJoined}
                          onChange={(e) => setEditDateJoined(e.target.value)}
                          disabled={!canEditUserAssets}
                          style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', height: isMobile ? '36px' : '40px', opacity: !canEditUserAssets ? 0.7 : 1, cursor: !canEditUserAssets ? 'not-allowed' : 'text' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>{t('Người quản lý trực tiếp')}</label>
                        <CustomSelect
                          value={editDirectManagerId || editDirectManager}
                          onChange={(val: any) => {
                            setEditDirectManagerId(String(val));
                            const found = allUsersList.find(u => String(u.id) === String(val));
                            if (found) {
                              setEditDirectManager(found.name || found.full_name || found.username || String(val));
                            } else {
                              setEditDirectManager(String(val));
                            }
                          }}
                          options={allUsersList.map(u => ({
                            value: String(u.id),
                            label: u.name || u.full_name || u.username,
                            avatar: u.avatar || u.avatar_url,
                            sublabel: u.role ? `(${u.role})` : undefined
                          }))}
                          placeholder={t('Chọn người quản lý trực tiếp...')}
                          searchable
                          showAvatars
                          disabled={!canEditUserAssets}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <AddressSelect
                        label={t('Địa điểm làm việc')}
                        value={editWorkplace}
                        onChange={(val) => setEditWorkplace(val)}
                        placeholder={t('Chọn địa điểm làm việc...')}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Chứng chỉ môi giới')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editBrokerLicense}
                          onChange={(e) => setEditBrokerLicense(e.target.value)}
                          placeholder="Mã số chứng chỉ (nếu có)"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Trình độ học vấn')}</label>
                        <CustomSelect
                          options={[
                            { value: 'undergraduate', label: t('Trung cấp / Cao đẳng') },
                            { value: 'graduate', label: t('Đại học') },
                            { value: 'postgraduate', label: t('Thạc sĩ / Tiến sĩ') },
                            { value: 'other', label: t('Khác') }
                          ]}
                          value={editDegree}
                          onChange={val => setEditDegree(String(val))}
                          placeholder={t('Chọn trình độ...')}
                        />
                      </div>
                    </div>
                </div>
              </div>
            )}

            {/* TÀI SẢN CẤP PHÁT TAB */}
            {profileActiveTab === 'assets' && (
              <AssignedAssetsSection
                assets={profileAssets}
                onChange={() => {}}
                readOnly={!canEditUserAssets}
              />
            )}

            {profileActiveTab === 'certificates' && (
              <div className="card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={18} color="var(--color-primary)" />
                  {t('BẰNG CẤP & CHỨNG CHỈ HÀNH NGHỀ')}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t('Cập nhật các bằng cấp, chứng chỉ chuyên môn của bạn để phục vụ công tác thẩm định hồ sơ nhân sự.')}
                </p>

                {profileCertificates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--color-bg)', borderRadius: '12px', border: '1px dashed var(--color-border-light)' }}>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      {t('Chưa có chứng chỉ hoặc bằng cấp nào được thêm.')}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {profileCertificates.map((cert, index) => (
                      <div key={cert.id || index} style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: '1.5rem',
                        padding: '1.5rem',
                        background: 'var(--color-bg-alt)',
                        borderRadius: '12px',
                        border: '1px solid var(--color-border-light)',
                        position: 'relative'
                      }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t('Bạn có chắc chắn muốn xóa chứng chỉ này?'))) {
                              setProfileCertificates(profileCertificates.filter((_, i) => i !== index));
                            }
                          }}
                          style={{
                            position: 'absolute', top: '12px', right: '12px',
                            background: 'rgba(239, 68, 68, 0.08)', border: 'none',
                            color: 'var(--color-danger)', cursor: 'pointer',
                            padding: '6px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          className="hover-bg-danger-light"
                          title={t('Xóa chứng chỉ')}
                        >
                          <Trash2 size={16} />
                        </button>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '150px' }}>
                          <div style={{
                            width: '140px',
                            height: '90px',
                            borderRadius: '8px',
                            border: '2px dashed var(--color-border)',
                            background: 'var(--color-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative',
                            boxShadow: 'var(--shadow-sm)'
                          }}>
                            {cert.image ? (
                              <img src={resolveAttachmentUrl(cert.image)} alt="Certificate" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)' }}>
                                <Camera size={20} />
                                <span style={{ fontSize: '0.65rem' }}>{t('Chưa có ảnh')}</span>
                              </div>
                            )}
                          </div>

                          <label style={{
                            background: 'var(--color-primary-light)',
                            color: 'var(--color-primary)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'center',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }} className="hover-lift">
                            <Plus size={12} />
                            {cert.image ? t('Thay ảnh') : t('Tải ảnh')}
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleCertificateImageUpload(index, file);
                              }}
                            />
                          </label>
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: '1rem' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontWeight: 600 }}>{t('Tên bằng cấp / chứng chỉ')}</label>
                              <input
                                type="text"
                                className="form-input"
                                value={cert.name || ''}
                                onChange={(e) => {
                                  const updated = [...profileCertificates];
                                  updated[index] = { ...updated[index], name: e.target.value };
                                  setProfileCertificates(updated);
                                }}
                                placeholder={t('Ví dụ: Chứng chỉ hành nghề Môi giới BĐS')}
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontWeight: 600 }}>{t('Mã số chứng chỉ')}</label>
                              <input
                                type="text"
                                className="form-input"
                                value={cert.code || ''}
                                onChange={(e) => {
                                  const updated = [...profileCertificates];
                                  updated[index] = { ...updated[index], code: e.target.value };
                                  setProfileCertificates(updated);
                                }}
                                placeholder={t('Số hiệu / Mã số')}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontWeight: 600 }}>{t('Tổ chức cấp')}</label>
                              <input
                                type="text"
                                className="form-input"
                                value={cert.issuer || ''}
                                onChange={(e) => {
                                  const updated = [...profileCertificates];
                                  updated[index] = { ...updated[index], issuer: e.target.value };
                                  setProfileCertificates(updated);
                                }}
                                placeholder={t('Ví dụ: Sở Xây Dựng TP.HCM')}
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontWeight: 600 }}>{t('Đường dẫn liên kết (Link)')}</label>
                              <input
                                type="text"
                                className="form-input"
                                value={cert.link || ''}
                                onChange={(e) => {
                                  const updated = [...profileCertificates];
                                  updated[index] = { ...updated[index], link: e.target.value };
                                  setProfileCertificates(updated);
                                }}
                                placeholder={t('Ví dụ: https://example.com/certificate')}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontWeight: 600 }}>{t('Ngày cấp')}</label>
                              <input
                                type="date"
                                className="form-input"
                                value={cert.issuedDate || ''}
                                onChange={(e) => {
                                  const updated = [...profileCertificates];
                                  updated[index] = { ...updated[index], issuedDate: e.target.value };
                                  setProfileCertificates(updated);
                                }}
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontWeight: 600 }}>{t('Ngày hết hạn')}</label>
                              <input
                                type="date"
                                className="form-input"
                                value={cert.expiryDate || ''}
                                onChange={(e) => {
                                  const updated = [...profileCertificates];
                                  updated[index] = { ...updated[index], expiryDate: e.target.value };
                                  setProfileCertificates(updated);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  className="btn outline"
                  onClick={() => {
                    setProfileCertificates([...profileCertificates, {
                      id: 'cert_' + Math.random().toString(36).substring(2, 9),
                      name: '',
                      code: '',
                      issuer: '',
                      link: '',
                      image: '',
                      issuedDate: '',
                      expiryDate: ''
                    }]);
                  }}
                  style={{ width: 'fit-content', alignSelf: 'flex-start', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} />
                  {t('Thêm bằng cấp / chứng chỉ')}
                </button>
              </div>
            )}

            {profileActiveTab === 'hr_records' && (
              <div className="card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={18} color="var(--color-primary)" />
                  {t('KHEN THƯỞNG, CẢNH CÁO & KỶ LUẬT')}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t('Lịch sử ghi nhận thành tích, nhắc nhở hoặc các quyết định kỷ luật từ phòng Nhân sự.')}
                </p>

                {profileHRRecords.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--color-bg)', borderRadius: '12px', border: '1px dashed var(--color-border-light)' }}>
                    <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      {t('Chưa có ghi nhận khen thưởng hoặc kỷ luật nào.')}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {profileHRRecords.map((record, index) => {
                      const isAward = record.type === 'award';
                      const isWarning = record.type === 'warning';
                      const isDiscipline = record.type === 'discipline';

                      const badgeColor = isAward ? 'var(--color-success)' : (isWarning ? 'var(--color-warning)' : 'var(--color-danger)');
                      const badgeBg = isAward ? 'rgba(16, 185, 129, 0.1)' : (isWarning ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)');
                      
                      const canEdit = ['admin', 'superadmin', 'manager', 'assistant'].includes(String(user?.role).toLowerCase());

                      return (
                        <div key={record.id || index} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem',
                          padding: '1.25rem',
                          background: 'var(--color-bg-alt)',
                          borderRadius: '12px',
                          border: '1px solid var(--color-border-light)',
                          position: 'relative'
                        }}>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(t('Bạn có chắc chắn muốn xóa ghi nhận này?'))) {
                                  setProfileHRRecords(profileHRRecords.filter((_, i) => i !== index));
                                }
                              }}
                              style={{
                                position: 'absolute', top: '12px', right: '12px',
                                background: 'rgba(239, 68, 68, 0.08)', border: 'none',
                                color: 'var(--color-danger)', cursor: 'pointer',
                                padding: '6px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s'
                              }}
                              className="hover-bg-danger-light"
                              title={t('Xóa ghi nhận')}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}

                          {!canEdit ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                                  padding: '4px 8px', borderRadius: '6px', color: badgeColor, background: badgeBg
                                }}>
                                  {isAward ? t('Khen thưởng') : (isWarning ? t('Cảnh cáo') : t('Kỷ luật'))}
                                </span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                  {record.title || t('Chưa đặt tiêu đề')}
                                </span>
                                {record.decisionNumber && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                    ({t('Số QĐ')}: {record.decisionNumber})
                                  </span>
                                )}
                              </div>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-light)', marginTop: '4px' }}>
                                <div>📅 <strong>{t('Ngày quyết định')}:</strong> {record.date ? new Date(record.date).toLocaleDateString('vi-VN') : t('Chưa cập nhật')}</div>
                                {record.amount && <div>💰 <strong>{t('Giá trị phạt/thưởng')}:</strong> {record.amount}</div>}
                                {record.documentLink && (
                                  <div>
                                    🔗 <strong>{t('Văn bản đính kèm')}:</strong>{' '}
                                    <a href={record.documentLink} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }} className="hover-underline">
                                      {t('Xem tài liệu')}
                                    </a>
                                  </div>
                                )}
                              </div>
                              {record.reason && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '6px 0 0 0', lineHeight: 1.4, padding: '8px', background: 'var(--color-surface)', borderRadius: '6px', borderLeft: `3px solid ${badgeColor}` }}>
                                  <strong>{t('Lý do / Nội dung chi tiết')}:</strong> {record.reason}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.5fr 1fr', gap: '1rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Phân loại')}</label>
                                  <CustomSelect
                                    options={[
                                      { value: 'award', label: t('Khen thưởng') },
                                      { value: 'warning', label: t('Cảnh cáo') },
                                      { value: 'discipline', label: t('Kỷ luật') }
                                    ]}
                                    value={record.type}
                                    onChange={val => {
                                      const updated = [...profileHRRecords];
                                      updated[index] = { ...updated[index], type: val as any };
                                      setProfileHRRecords(updated);
                                    }}
                                    placeholder={t('Chọn loại...')}
                                  />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Tiêu đề / Tên quyết định')}</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={record.title || ''}
                                    onChange={(e) => {
                                      const updated = [...profileHRRecords];
                                      updated[index] = { ...updated[index], title: e.target.value };
                                      setProfileHRRecords(updated);
                                    }}
                                    placeholder={t('Ví dụ: Vinh danh chuyên xuất sắc quý 2')}
                                  />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Số quyết định')}</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={record.decisionNumber || ''}
                                    onChange={(e) => {
                                      const updated = [...profileHRRecords];
                                      updated[index] = { ...updated[index], decisionNumber: e.target.value };
                                      setProfileHRRecords(updated);
                                    }}
                                    placeholder="Ví dụ: QĐ-12/2026/RL"
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1.5fr', gap: '1rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Ngày quyết định')}</label>
                                  <input
                                    type="date"
                                    className="form-input"
                                    value={record.date || ''}
                                    onChange={(e) => {
                                      const updated = [...profileHRRecords];
                                      updated[index] = { ...updated[index], date: e.target.value };
                                      setProfileHRRecords(updated);
                                    }}
                                  />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Giá trị phạt/thưởng (nếu có)')}</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={record.amount || ''}
                                    onChange={(e) => {
                                      const updated = [...profileHRRecords];
                                      updated[index] = { ...updated[index], amount: e.target.value };
                                      setProfileHRRecords(updated);
                                    }}
                                    placeholder="Ví dụ: +1,000,000đ hoặc -500,000đ"
                                  />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Đường dẫn văn bản đính kèm')}</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={record.documentLink || ''}
                                    onChange={(e) => {
                                      const updated = [...profileHRRecords];
                                      updated[index] = { ...updated[index], documentLink: e.target.value };
                                      setProfileHRRecords(updated);
                                    }}
                                    placeholder="https://example.com/decision.pdf"
                                  />
                                </div>
                              </div>

                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>{t('Lý do & Nội dung chi tiết')}</label>
                                <textarea
                                  className="form-input"
                                  rows={2}
                                  value={record.reason || ''}
                                  onChange={(e) => {
                                    const updated = [...profileHRRecords];
                                    updated[index] = { ...updated[index], reason: e.target.value };
                                    setProfileHRRecords(updated);
                                  }}
                                  placeholder={t('Ghi chú chi tiết lý do và nội dung sự việc')}
                                  style={{ minHeight: '60px' }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {['admin', 'superadmin', 'manager', 'assistant'].includes(String(user?.role).toLowerCase()) && (
                  <button
                    type="button"
                    className="btn outline"
                    onClick={() => {
                      setProfileHRRecords([...profileHRRecords, {
                        id: 'hr_' + Math.random().toString(36).substring(2, 9),
                        type: 'award',
                        title: '',
                        decisionNumber: '',
                        date: new Date().toISOString().split('T')[0],
                        amount: '',
                        documentLink: '',
                        reason: ''
                      }]);
                    }}
                    style={{ width: 'fit-content', alignSelf: 'flex-start', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={16} />
                    {t('Thêm khen thưởng / kỷ luật')}
                  </button>
                )}
              </div>
            )}

            {/* 3. CONTACT & LOGIN */}
            {profileActiveTab === 'contact' && (
              <div className="card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Server size={16} color="var(--color-primary)" /> {t('Thông tin liên hệ')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Email đăng nhập')}</label>
                      <input
                        type="email"
                        className="form-input"
                        value={profile.email || ''}
                        disabled
                        style={{
                          opacity: 0.7,
                          cursor: 'not-allowed',
                          background: 'var(--color-bg)',
                          borderColor: 'var(--color-border-light)'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Số điện thoại cá nhân')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editPersonalPhone}
                          onChange={(e) => setEditPersonalPhone(e.target.value)}
                          placeholder="Nhập SĐT cá nhân"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Số điện thoại nội bộ')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editExtNumber}
                          onChange={(e) => setEditExtNumber(e.target.value)}
                          placeholder="VD: 104"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <AddressSelect
                          label={t('Địa chỉ thường trú')}
                          value={editAddress}
                          onChange={(val) => setEditAddress(val)}
                          placeholder={t('Chọn địa chỉ thường trú...')}
                        />
                      </div>
                      <div className="form-group">
                        <AddressSelect
                          label={t('Địa chỉ tạm trú')}
                          value={editAddressTemporary}
                          onChange={(val) => setEditAddressTemporary(val)}
                          placeholder={t('Chọn địa chỉ tạm trú...')}
                        />
                      </div>
                    </div>
                </div>
              </div>
            )}

            {/* SECURITY & ACCOUNT TAB (TÀI KHOẢN & BẢO MẬT) */}
            {profileActiveTab === 'security' && (
              <div className="card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={16} color="var(--color-primary)" /> {t('Tài khoản & Bảo mật')}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Change Password Section */}
                  <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                      <KeyRound size={16} color="var(--color-primary)" />
                      {t('Đổi mật khẩu tài khoản')}
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '1rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Mật khẩu hiện tại')}</label>
                        <input
                          type="password"
                          className="form-input"
                          value={oldPass}
                          onChange={e => setOldPass(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Mật khẩu mới')}</label>
                        <input
                          type="password"
                          className="form-input"
                          value={newPass}
                          onChange={e => setNewPass(e.target.value)}
                          placeholder="≥ 6 ký tự"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Xác nhận mật khẩu mới')}</label>
                        <input
                          type="password"
                          className="form-input"
                          value={confirmPass}
                          onChange={e => setConfirmPass(e.target.value)}
                          placeholder="Nhập lại mật khẩu mới"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn primary sm"
                      disabled={changingPass || !oldPass || !newPass || !confirmPass}
                      style={{ width: 'fit-content', alignSelf: 'flex-start' }}
                    >
                      {changingPass ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                      {t('Lưu mật khẩu mới')}
                    </button>
                  </form>

                  {/* Divider */}
                  <div style={{ height: '1px', background: 'var(--color-border-light)', margin: '0.5rem 0' }} />

                  {/* 2FA Security Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text)' }}>
                        <Shield size={16} color="var(--color-primary)" />
                        {t('Xác thực 2 yếu tố (2FA)')}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: twoFactorEnabled ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                          {twoFactorEnabled ? t('Đang bật') : t('Đang tắt')}
                        </span>
                        <ToggleSwitch
                          checked={twoFactorEnabled}
                          onChange={(val) => {
                            if (!val) {
                              setShowDisable2FAModal(true);
                            } else {
                              handleStart2FASetup('email');
                            }
                          }}
                        />
                      </div>
                    </div>

                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                      {t('Tăng cường bảo mật cho tài khoản của bạn bằng cách yêu cầu mã xác thực OTP qua Email hoặc ứng dụng Google Authenticator mỗi khi đăng nhập.')}
                    </p>

                    {/* Active 2FA Method Status Box */}
                    {twoFactorEnabled && (
                      <div style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.05)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        gap: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            {twoFactorType === 'totp' ? <ShieldCheck size={18} color="#10b981" /> : <Mail size={18} color="#10b981" />}
                          </div>
                          <div>
                            <span style={{ fontSize: '0.675rem', fontWeight: 700, textTransform: 'uppercase', color: '#059669', letterSpacing: '0.4px', display: 'block' }}>
                              {t('Phương thức xác thực đang hoạt động')}
                            </span>
                            <h5 style={{ margin: '1px 0 0 0', fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)' }}>
                              {twoFactorType === 'totp' ? t('Google Authenticator (Ứng dụng TOTP)') : t('Mã OTP qua Email')}
                            </h5>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {twoFactorType === 'email' ? (
                            <button
                              type="button"
                              className="btn outline sm"
                              onClick={() => handleStart2FASetup('totp')}
                              style={{ padding: '4px 10px', fontSize: '0.75rem', height: 'auto' }}
                            >
                              {t('Chuyển sang Google Authenticator')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn outline sm"
                              onClick={() => handleStart2FASetup('email')}
                              style={{ padding: '4px 10px', fontSize: '0.75rem', height: 'auto' }}
                            >
                              {t('Chuyển sang Email OTP')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Method Selector Options when 2FA is DISABLED */}
                    {!twoFactorEnabled && (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                        {/* Option A: Email OTP */}
                        <div style={{
                          padding: '1.25rem',
                          border: '1.5px solid var(--color-border-light)',
                          borderRadius: '12px',
                          background: 'var(--color-bg-alt)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Mail size={20} style={{ color: 'var(--color-primary)' }} />
                            <strong style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{t('Mã OTP qua Email')}</strong>
                          </div>
                          <p style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)', margin: 0, flex: 1 }}>
                            {t('Mã xác thực 6 chữ số sẽ được tự động gửi về Email cá nhân của bạn mỗi khi đăng nhập.')}
                          </p>
                          <button
                            type="button"
                            className="btn outline sm"
                            onClick={() => handleStart2FASetup('email')}
                            style={{ width: 'fit-content' }}
                          >
                            {t('Bật xác thực Email OTP')}
                          </button>
                        </div>

                        {/* Option B: Google Authenticator */}
                        <div style={{
                          padding: '1.25rem',
                          border: '1.5px solid var(--color-border-light)',
                          borderRadius: '12px',
                          background: 'var(--color-bg-alt)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <ShieldCheck size={20} style={{ color: 'var(--color-primary)' }} />
                            <strong style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{t('Google Authenticator (App)')}</strong>
                          </div>
                          <p style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)', margin: 0, flex: 1 }}>
                            {t('Quét mã QR bằng ứng dụng Google Authenticator hoặc Authy trên điện thoại để lấy mã 6 chữ số mọi lúc.')}
                          </p>
                          <button
                            type="button"
                            className="btn primary sm"
                            onClick={() => handleStart2FASetup('totp')}
                            style={{ width: 'fit-content' }}
                          >
                            {t('Cấu hình Google Authenticator')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 4. BANKING & PAYMENTS */}
            {profileActiveTab === 'payment' && (
              <div className="card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={16} color="var(--color-primary)" /> {t('Thanh toán & Thuế')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Tên ngân hàng')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editBankName}
                          onChange={(e) => setEditBankName(e.target.value)}
                          placeholder={t('VD: Vietcombank')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Số tài khoản')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editBankAccount}
                          onChange={(e) => setEditBankAccount(e.target.value)}
                          placeholder={t('Nhập số tài khoản')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Chi nhánh ngân hàng')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editBankBranch}
                          onChange={(e) => setEditBankBranch(e.target.value)}
                          placeholder={t('Nhập chi nhánh')}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Mã số thuế cá nhân')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editTaxId}
                          onChange={(e) => setEditTaxId(e.target.value)}
                          placeholder="Mã số thuế"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Số sổ BHXH')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editInsuranceId}
                          onChange={(e) => setEditInsuranceId(e.target.value)}
                          placeholder="Mã số BHXH"
                        />
                      </div>
                    </div>
                </div>
              </div>
            )}

            {/* 5. EMERGENCY CONTACT (Merged into Contact & Account) */}
            {(profileActiveTab === 'contact' || profileActiveTab === 'emergency') && (
              <div className="card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Scale size={16} color="var(--color-primary)" /> {t('Liên hệ khẩn cấp')}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t('Thêm danh sách liên hệ khẩn cấp của bạn để công ty có thể chủ động liên lạc khi cần thiết.')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {emergencyContacts.map((contact, index) => (
                    <div key={index} style={{
                      padding: '1.25rem',
                      background: 'var(--color-bg-alt)',
                      borderRadius: '10px',
                      border: '1px solid var(--color-border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      position: 'relative'
                    }}>
                      {emergencyContacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setEmergencyContacts(emergencyContacts.filter((_, i) => i !== index));
                          }}
                          style={{
                            position: 'absolute', top: '10px', right: '10px',
                            background: 'transparent', border: 'none',
                            color: 'var(--color-danger)', cursor: 'pointer',
                            padding: '4px', borderRadius: '4px'
                          }}
                          className="hover-bg-danger-light"
                          title={t('Xóa liên hệ')}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>{t('Người liên hệ')}</label>
                          <input
                            type="text"
                            className="form-input"
                            value={contact.name || ''}
                            onChange={(e) => {
                              const updated = [...emergencyContacts];
                              updated[index] = { ...updated[index], name: e.target.value };
                              setEmergencyContacts(updated);
                            }}
                            placeholder="Họ tên người liên hệ"
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>{t('Mối quan hệ')}</label>
                          <input
                            type="text"
                            className="form-input"
                            value={contact.relationship || ''}
                            onChange={(e) => {
                              const updated = [...emergencyContacts];
                              updated[index] = { ...updated[index], relationship: e.target.value };
                              setEmergencyContacts(updated);
                            }}
                            placeholder="VD: Bố, Mẹ, Vợ, Chồng..."
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Số điện thoại khẩn cấp')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={contact.phone || ''}
                          onChange={(e) => {
                            const updated = [...emergencyContacts];
                            updated[index] = { ...updated[index], phone: e.target.value };
                            setEmergencyContacts(updated);
                          }}
                          placeholder="SĐT người liên hệ"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn outline sm"
                  onClick={() => setEmergencyContacts([...emergencyContacts, { name: '', relationship: '', phone: '' }])}
                  style={{ width: 'fit-content', alignSelf: 'flex-start', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} />
                  {t('Thêm người liên hệ')}
                </button>
              </div>
            )}

            {/* 6. WORK SCHEDULE & DATA ROTATION */}
            {profileActiveTab === 'schedule' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {['sale', 'manager'].includes(String(effectiveRole).toLowerCase()) && (
                  <>
                    {/* Vacation Status Card */}
                    <div className="card" style={{
                      padding: '1.5rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '16px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'rgba(189, 29, 45, 0.08)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0
                        }}>
                          <Clock3 size={20} color="#BD1D2D" style={{ display: 'block', width: '20px', height: '20px', margin: 'auto' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>
                            {t('TRẠNG THÁI NHẬN DATA')}
                          </h3>
                          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, lineHeight: '1.45' }}>
                            {t('Khi kích hoạt: Nhận khách hàng mới theo vòng chia. Khi tắt (Nghỉ/Tạm ngưng): Dừng nhận khách hàng mới, nhưng khách hàng cũ đăng ký lại VẪN sẽ tự động chuyển và gửi tin nhắn Nhắc trùng cho bạn chăm sóc.')}
                          </p>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--color-bg-alt)',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: '1px solid var(--color-border-light)'
                      }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-light)' }}>
                          {t('Trạng thái hiện tại:')}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: !portalVacationMode && !onLeave ? 'var(--color-success)' : 'var(--color-warning)',
                            background: !portalVacationMode && !onLeave ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            {!portalVacationMode && !onLeave ? t('Sẵn sàng') :
                              onLeave ? t('Nghỉ phép') : t('Tạm ngưng')}
                          </span>
                          {['sale', 'manager'].includes(String(effectiveRole).toLowerCase()) && (
                            <div style={{ pointerEvents: onLeave ? 'none' : 'auto', opacity: onLeave ? 0.5 : 1 }}>
                              <ToggleSwitch
                                checked={!portalVacationMode}
                                onChange={() => {
                                  if (!portalVacationMode) {
                                    setVacationConfirmOpen(true);
                                  } else {
                                    handleTogglePortalVacation();
                                  }
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {onLeave && (
                        <div style={{
                          background: 'var(--color-warning-light)', color: 'var(--color-warning)', padding: '10px 14px',
                          borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 8
                        }}>
                          <AlertTriangle size={15} />
                          <span>{t('Bạn hiện đang trong thời gian nghỉ phép. Hệ thống tự động khóa chế độ nhận data cho đến khi kết thúc kỳ nghỉ.')}</span>
                        </div>
                      )}
                    </div>

                    {/* Weekend Shift Registration Card */}
                    {weekendShiftAllow && (
                      <div className="card" style={{
                        padding: '1.5rem',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '16px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        transition: 'all 0.3s ease'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'rgba(16, 185, 129, 0.08)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0
                          }}>
                            <Calendar size={20} color="var(--color-success)" style={{ display: 'block', width: '20px', height: '20px', margin: 'auto' }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>
                              {t('ĐĂNG KÝ TRỰC CUỐI TUẦN')}
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, lineHeight: '1.45' }}>
                              {t('Đăng ký nhận lead trong các ngày Thứ Bảy và Chủ Nhật.')}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* Saturday */}
                          {weekendShiftSat && (() => {
                            const satWorkConfig = editWorkSchedule?.["6"] || editWorkSchedule?.[6];
                            const isSatWorkday = satWorkConfig?.active;
                            const satHours = isSatWorkday ? `${satWorkConfig.start} - ${satWorkConfig.end}` : '';

                            return (
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'var(--color-bg-alt)',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                border: '1px solid var(--color-border-light)'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                    {t('Thứ Bảy')} ({new Date(weekendShiftSat.date).toLocaleDateString('vi-VN')})
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                    {isSatWorkday && (
                                      <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        background: 'rgba(100, 116, 139, 0.08)',
                                        padding: '2px 8px',
                                        borderRadius: '4px'
                                      }}>
                                        {t('Lịch hành chính:')} {satHours}
                                      </span>
                                    )}
                                    {weekendShiftSat.deadline_time && (
                                      <span style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--color-text-muted)',
                                        background: 'rgba(100, 116, 139, 0.04)',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid var(--color-border-light)'
                                      }}>
                                        {t('Hạn đăng ký:')} {new Date(weekendShiftSat.deadline_time).toLocaleString('vi-VN')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  {(!isMobile || weekendShiftSat.registered) && (
                                    <span style={{
                                      fontSize: '0.8rem',
                                      fontWeight: 700,
                                      color: weekendShiftSat.registered ? (weekendShiftSat.approved ? 'var(--color-success)' : 'var(--color-warning)') : 'var(--color-text-muted)',
                                      background: weekendShiftSat.registered ? (weekendShiftSat.approved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)') : 'rgba(100, 116, 139, 0.08)',
                                      padding: '3px 8px',
                                      borderRadius: '6px'
                                    }}>
                                      {weekendShiftSat.registered ? (weekendShiftSat.approved ? t('Đã duyệt trực') : t('Chờ duyệt')) : t('Chưa đăng ký')}
                                    </span>
                                  )}
                                  {['sale', 'manager'].includes(String(effectiveRole).toLowerCase()) && (
                                    <div style={{ opacity: weekendShiftSat.can_toggle ? 1 : 0.6 }}>
                                      <ToggleSwitch
                                        checked={weekendShiftSat.registered}
                                        onChange={() => {
                                          if (!weekendShiftSat.can_toggle) {
                                            toast.error(t('Đã quá hạn đăng ký trực cuối tuần cho Thứ Bảy!'));
                                            return;
                                          }
                                          handleToggleWeekendShift(weekendShiftSat.date, weekendShiftSat.registered);
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Sunday */}
                          {weekendShiftSun && (() => {
                            const sunWorkConfig = editWorkSchedule?.["7"] || editWorkSchedule?.[7];
                            const isSunWorkday = sunWorkConfig?.active;
                            const sunHours = isSunWorkday ? `${sunWorkConfig.start} - ${sunWorkConfig.end}` : '';

                            return (
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'var(--color-bg-alt)',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                border: '1px solid var(--color-border-light)'
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                    {t('Chủ Nhật')} ({new Date(weekendShiftSun.date).toLocaleDateString('vi-VN')})
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                    {isSunWorkday && (
                                      <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        background: 'rgba(100, 116, 139, 0.08)',
                                        padding: '2px 8px',
                                        borderRadius: '4px'
                                      }}>
                                        {t('Lịch hành chính:')} {sunHours}
                                      </span>
                                    )}
                                    {weekendShiftSun.deadline_time && (
                                      <span style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--color-text-muted)',
                                        background: 'rgba(100, 116, 139, 0.04)',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid var(--color-border-light)'
                                      }}>
                                        {t('Hạn đăng ký:')} {new Date(weekendShiftSun.deadline_time).toLocaleString('vi-VN')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  {(!isMobile || weekendShiftSun.registered) && (
                                    <span style={{
                                      fontSize: '0.8rem',
                                      fontWeight: 700,
                                      color: weekendShiftSun.registered ? (weekendShiftSun.approved ? 'var(--color-success)' : 'var(--color-warning)') : 'var(--color-text-muted)',
                                      background: weekendShiftSun.registered ? (weekendShiftSun.approved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)') : 'rgba(100, 116, 139, 0.08)',
                                      padding: '3px 8px',
                                      borderRadius: '6px'
                                    }}>
                                      {weekendShiftSun.registered ? (weekendShiftSun.approved ? t('Đã duyệt trực') : t('Chờ duyệt')) : t('Chưa đăng ký')}
                                    </span>
                                  )}
                                  {['sale', 'manager'].includes(String(effectiveRole).toLowerCase()) && (
                                    <div style={{ opacity: weekendShiftSun.can_toggle ? 1 : 0.6 }}>
                                      <ToggleSwitch
                                        checked={weekendShiftSun.registered}
                                        onChange={() => {
                                          if (!weekendShiftSun.can_toggle) {
                                            toast.error(t('Đã quá hạn đăng ký trực cuối tuần cho Chủ Nhật!'));
                                            return;
                                          }
                                          handleToggleWeekendShift(weekendShiftSun.date, weekendShiftSun.registered);
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {((weekendShiftSat && !weekendShiftSat.can_toggle && !weekendShiftSat.registered) || 
                          (weekendShiftSun && !weekendShiftSun.can_toggle && !weekendShiftSun.registered)) && (
                          <div style={{
                            background: 'var(--color-danger-light)', 
                            color: 'var(--color-danger)', 
                            padding: '10px 14px',
                            borderRadius: '10px', 
                            border: '1px solid rgba(239, 68, 68, 0.2)', 
                            fontSize: '0.78rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 8,
                            marginTop: '4px'
                          }}>
                            <Info size={14} />
                            <span>
                              {t('Đã quá hạn đăng ký trực cuối tuần. Bạn không thể thay đổi trạng thái đăng ký của các ngày đã quá hạn.')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Night Shift Registration Card */}
                    <div className="card" style={{
                      padding: '1.5rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '16px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'rgba(245, 158, 11, 0.08)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0
                        }}>
                          <ShieldAlert size={20} color="var(--color-warning)" style={{ display: 'block', width: '20px', height: '20px', margin: 'auto' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>
                            {t(`ĐĂNG KÝ TRỰC CA ĐÊM (${nightStartHour}-${nightEndHour})`)}
                          </h3>
                          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, lineHeight: '1.45' }}>
                            {t('Nhận lead tự động trong ca đêm. Danh sách đăng ký tự reset vào lúc 6:00 sáng hôm sau.')}
                          </p>
                          {nightShiftDeadline && (
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: 'var(--color-text-muted)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              marginTop: '6px',
                              background: 'rgba(100, 116, 139, 0.08)',
                              padding: '2px 8px',
                              borderRadius: '4px'
                            }}>
                              {t('Hạn chót đăng ký:')} {nightShiftDeadline} {t('hôm nay')}
                            </span>
                          )}
                        </div>
                      </div>

                      {(() => {
                        const past7Days = [];
                        const today = new Date();
                        for (let i = 7; i >= 1; i--) {
                          const d = new Date();
                          d.setDate(today.getDate() - i);
                          const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                          const dayLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                          const isRegistered = Boolean(profile?.night_shifts && profile.night_shifts.some((ns: any) => ns.shift_date === dateStr));
                          past7Days.push({ dateStr, dayLabel, isRegistered });
                        }

                        return (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            background: 'var(--color-bg-alt)',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            border: '1px solid var(--color-border-light)',
                            marginBottom: '8px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                {t('Lịch sử trực ca đêm (7 ngày qua):')}
                              </span>
                            </div>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(7, 1fr)',
                              gap: isMobile ? '4px' : '6px',
                              marginTop: '2px'
                            }}>
                              {past7Days.map((item) => (
                                <div
                                  key={item.dateStr}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '6px 2px',
                                    borderRadius: '8px',
                                    background: item.isRegistered ? 'rgba(139, 92, 246, 0.1)' : 'var(--color-surface)',
                                    border: item.isRegistered ? '1px solid #8b5cf6' : '1px solid var(--color-border-light)',
                                    textAlign: 'center'
                                  }}
                                >
                                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                    {item.dayLabel}
                                  </span>
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: item.isRegistered ? '#8b5cf6' : 'var(--color-text-muted)',
                                    marginTop: '2px'
                                  }}>
                                    {item.isRegistered ? t('Đã trực') : t('Nghỉ')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--color-bg-alt)',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        border: '1px solid var(--color-border-light)'
                      }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-light)' }}>
                          {t('Đăng ký trực hôm nay:')}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {(!isMobile || nightShiftRegistered) && (
                            <span style={{
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: nightShiftRegistered 
                                ? 'var(--color-success)' 
                                : ((nightShiftCanToggle && !isTodayWeekend) ? 'var(--color-text-muted)' : (isTodayWeekend ? 'var(--color-text-muted)' : 'var(--color-danger)')),
                              background: nightShiftRegistered 
                                ? 'rgba(16, 185, 129, 0.1)' 
                                : ((nightShiftCanToggle && !isTodayWeekend) ? 'rgba(100, 116, 139, 0.08)' : (isTodayWeekend ? 'rgba(100, 116, 139, 0.08)' : 'var(--color-danger-light)')),
                              padding: '3px 8px',
                              borderRadius: '6px'
                            }}>
                              {nightShiftRegistered 
                                ? t('Đã đăng ký trực') 
                                : ((nightShiftCanToggle && !isTodayWeekend) ? t('Chưa đăng ký') : (isTodayWeekend ? t('Nghỉ trực ca đêm') : t('Đã hết hạn đăng ký')))}
                            </span>
                          )}
                          {['sale', 'manager'].includes(String(effectiveRole).toLowerCase()) && (
                            <div style={{ opacity: (nightShiftCanToggle && !isTodayWeekend && !togglingNightShift) ? 1 : 0.6, pointerEvents: togglingNightShift ? 'none' : 'auto' }}>
                              <ToggleSwitch
                                checked={nightShiftRegistered}
                                disabled={togglingNightShift || !nightShiftCanToggle || isTodayWeekend}
                                onChange={() => {
                                  if (togglingNightShift) return;
                                  if (isTodayWeekend) {
                                    toast.error(t('Hôm nay là cuối tuần, vui lòng đăng ký trực cuối tuần ở trên!'));
                                    return;
                                  }
                                  if (!nightShiftCanToggle) {
                                    toast.error(t('Đã quá hạn đăng ký trực ca đêm hôm nay!'));
                                    return;
                                  }
                                  setShowNightShiftConfirmModal(true);
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {(!nightShiftCanToggle || isTodayWeekend) && (
                        <div style={{
                          background: isTodayWeekend ? 'rgba(100, 116, 139, 0.08)' : 'var(--color-danger-light)',
                          color: isTodayWeekend ? 'var(--color-text-muted)' : 'var(--color-danger)',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: isTodayWeekend ? '1px solid var(--color-border-light)' : '1px solid rgba(239, 68, 68, 0.2)',
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          <Info size={14} />
                          <span>
                            {isTodayWeekend 
                              ? t('Hôm nay là cuối tuần. Vui lòng đăng ký trực cuối tuần ở trên.')
                              : t(`Quá hạn đăng ký (${nightShiftDeadline}). Bạn không thể thay đổi đăng ký trực ca đêm hôm nay.`)}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Holiday Shift Registration Card */}
                    {holidayShifts.length > 0 && (
                      <div className="card" style={{
                        padding: '1.5rem',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '16px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        transition: 'all 0.3s ease'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0
                          }}>
                            <Calendar size={20} color="var(--color-primary)" style={{ display: 'block', width: '20px', height: '20px', margin: 'auto' }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>
                              {t('ĐĂNG KÝ TRỰC NGÀY LỄ')}
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0, lineHeight: '1.45' }}>
                              {t('Đăng ký nhận lead trong các dịp nghỉ lễ lớn của công ty.')}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {holidayShifts.map((h) => (
                            <div key={h.id || h.name} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '12px', marginBottom: '4px' }}>
                              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 4px 0' }}>
                                {h.name}
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(h.dates_status || []).map((ds) => {
                                    const today = new Date();
                                    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                                    const isHolidayPast = ds.date < todayStr;

                                    return (
                                      <div key={ds.date} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: 'var(--color-bg-alt)',
                                        padding: '8px 12px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--color-border-light)',
                                        opacity: isHolidayPast ? 0.6 : 1
                                      }}>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)' }}>
                                          {new Date(ds.date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                          <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            color: ds.registered 
                                              ? (ds.approved ? 'var(--color-success)' : 'var(--color-warning)') 
                                              : 'var(--color-text-muted)',
                                            background: ds.registered 
                                              ? (ds.approved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)') 
                                              : 'rgba(100, 116, 139, 0.08)',
                                            padding: '2px 6px',
                                            borderRadius: '4px'
                                          }}>
                                            {ds.registered 
                                              ? (ds.approved ? t('Đã duyệt') : t('Chờ duyệt')) 
                                              : (isHolidayPast ? t('Đã qua') : t('Chưa đăng ký'))}
                                          </span>
                                          {['sale', 'manager'].includes(String(effectiveRole).toLowerCase()) && (
                                            <div style={{ opacity: isHolidayPast ? 0.6 : 1 }}>
                                              <ToggleSwitch
                                                checked={ds.registered}
                                                onChange={() => {
                                                  if (isHolidayPast) {
                                                    toast.error(t('Đã qua ngày nghỉ lễ này, không thể thay đổi đăng ký!'));
                                                    return;
                                                  }
                                                  handleToggleHolidayShift(h.name, ds.date, ds.registered);
                                                }}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weekly Shift Grid Scheduler Card */}
                    <div className="card" style={{
                      padding: '1.25rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '16px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      transition: 'all 0.3s ease'
                    }}>
                      <div 
                        onClick={() => setShowWeeklyShiftScheduler(!showWeeklyShiftScheduler)} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: 'var(--color-primary-light)',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0
                          }}>
                            <Calendar size={18} style={{ display: 'block', width: '18px', height: '18px', margin: 'auto', color: 'var(--color-primary)' }} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                              {t('ĐĂNG KÝ LỊCH TRỰC TUẦN')}
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, marginBottom: 0 }}>
                              {t('Đăng ký lịch làm việc và trực nhận data cho cả tuần.')}
                            </p>
                          </div>
                        </div>
                        <div style={{
                          color: 'var(--color-text-muted)',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--color-bg-alt)',
                          border: '1px solid var(--color-border-light)'
                        }}>
                          {showWeeklyShiftScheduler ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {showWeeklyShiftScheduler && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                          {/* Grid with 7 days in 1 row of compact square boxes */}
                          <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'stretch',
                            justifyContent: 'space-between',
                            gap: isMobile ? '3px' : '8px',
                            marginTop: '0.25rem',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}>
                            {getWeekDates().map((day) => {
                              const reg = weeklyRegistrations.find(r => r.shift_date === day.date);
                              const isNightRegistered = Boolean(
                                (reg && (reg.shift_type === 'night' || reg.is_night === 1 || reg.is_night === true || String(reg.note || '').toLowerCase().includes('đêm'))) ||
                                (nightShiftRegistered && nightShiftDate === day.date) ||
                                (profile?.night_shifts && profile.night_shifts.some((ns: any) => ns.shift_date === day.date))
                              );
                              const isWeekendRegistered = Boolean(
                                (day.date === weekendShiftSat?.date && weekendShiftSat?.registered) || 
                                (day.date === weekendShiftSun?.date && weekendShiftSun?.registered)
                              );
                              const isSelected = weeklyShiftDates.includes(day.date) || isNightRegistered || isWeekendRegistered || Boolean(reg);
                              const isApproved = reg ? (reg.approved === 1 || reg.approved === true) : (isNightRegistered ? nightShiftApproved : isWeekendRegistered);

                              const today = new Date();
                              const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                              const isPastDay = day.date < todayStr;

                              const getShortDayLabel = (name: string) => {
                                if (!name) return '';
                                if (name.includes('2') || name.includes('Hai')) return 'T2';
                                if (name.includes('3') || name.includes('Ba')) return 'T3';
                                if (name.includes('4') || name.includes('Tư')) return 'T4';
                                if (name.includes('5') || name.includes('Năm')) return 'T5';
                                if (name.includes('6') || name.includes('Sáu')) return 'T6';
                                if (name.includes('7') || name.includes('Bảy')) return 'T7';
                                if (name.includes('CN') || name.includes('Chủ')) return 'CN';
                                return name.replace('Thứ ', 'T');
                              };

                              const isWeekend = Boolean(
                                (day.name && (day.name.includes('7') || day.name.includes('Bảy') || day.name.includes('Sat') || day.name.includes('CN') || day.name.includes('Chủ') || day.name.includes('Sun'))) ||
                                day.dayIndex === 6 || day.dayIndex === 0
                              );

                              // Determine background, border and text colors based on state
                              let borderStyle = '1px solid var(--color-border-light)';
                              let backgroundStyle = 'var(--color-bg-alt)';
                              let statusText = t('Nghỉ');
                              let statusColor = 'var(--color-text-muted)';
                              let statusBg = 'rgba(100, 116, 139, 0.08)';

                              if (isNightRegistered) {
                                backgroundStyle = 'rgba(139, 92, 246, 0.06)';
                                borderStyle = '2px solid #8b5cf6';
                                statusText = isPastDay ? t('Đã trực đêm') : t('Trực đêm');
                                statusColor = '#8b5cf6';
                                statusBg = 'rgba(139, 92, 246, 0.12)';
                              } else if (isSelected || reg) {
                                if (isApproved) {
                                  backgroundStyle = 'rgba(16, 185, 129, 0.06)';
                                  borderStyle = '2px solid var(--color-success)';
                                  statusText = isPastDay ? t('Đã làm') : t('Đã duyệt');
                                  statusColor = 'var(--color-success)';
                                  statusBg = 'rgba(16, 185, 129, 0.12)';
                                } else if (isWeekend) {
                                  // Cuối tuần -> Màu Đỏ
                                  backgroundStyle = 'rgba(239, 68, 68, 0.06)';
                                  borderStyle = '2px solid #dc2626';
                                  statusText = isPastDay ? t('Đã làm') : t('Đăng ký');
                                  statusColor = '#dc2626';
                                  statusBg = 'rgba(239, 68, 68, 0.12)';
                                } else {
                                  // Ngày thường -> Màu Vàng & ghi Đăng ký
                                  backgroundStyle = 'rgba(245, 158, 11, 0.06)';
                                  borderStyle = '2px solid #f59e0b';
                                  statusText = isPastDay ? t('Đã làm') : t('Đăng ký');
                                  statusColor = '#d97706';
                                  statusBg = 'rgba(245, 158, 11, 0.15)';
                                }
                              }

                              return (
                                <div
                                  key={day.date}
                                  onClick={() => {
                                    if (isPastDay) return;
                                    if (['sale', 'manager'].includes(String(effectiveRole).toLowerCase())) {
                                      setWeeklyShiftDates(prev => 
                                        prev.includes(day.date) 
                                          ? prev.filter(d => d !== day.date) 
                                          : [...prev, day.date]
                                      );
                                    }
                                  }}
                                  style={{
                                    flex: '1 1 0px',
                                    minWidth: 0,
                                    padding: isMobile ? '5px 1px' : '10px 4px',
                                    borderRadius: isMobile ? '8px' : '10px',
                                    border: borderStyle,
                                    background: backgroundStyle,
                                    cursor: isPastDay 
                                      ? 'not-allowed' 
                                      : (['sale', 'manager'].includes(String(effectiveRole).toLowerCase()) ? 'pointer' : 'default'),
                                    opacity: isPastDay ? 0.75 : 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: isMobile ? '1px' : '2px',
                                    transition: 'all 0.2s',
                                    textAlign: 'center',
                                    minHeight: isMobile ? '48px' : '70px',
                                    boxSizing: 'border-box',
                                    userSelect: 'none'
                                  }}
                                  className="weekly-date-card"
                                >
                                  <span style={{ fontSize: isMobile ? '0.65rem' : '0.8rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                                    {isMobile ? getShortDayLabel(day.name) : day.name}
                                  </span>
                                  <span style={{ fontSize: isMobile ? '0.5rem' : '0.68rem', color: 'var(--color-text-muted)', lineHeight: 1, marginTop: '1px' }}>
                                    {new Date(day.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                  </span>
                                  
                                  {/* Status badge */}
                                  <span style={{
                                    fontSize: isMobile ? '0.42rem' : '0.62rem',
                                    fontWeight: 700,
                                    padding: isMobile ? '1px 2px' : '1px 3px',
                                    borderRadius: isMobile ? '3px' : '4px',
                                    marginTop: '2px',
                                    whiteSpace: 'nowrap',
                                    lineHeight: 1,
                                    letterSpacing: isMobile ? '-0.02em' : 'normal',
                                    color: statusColor,
                                    background: statusBg
                                  }}>
                                    {statusText}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {['sale', 'manager'].includes(String(effectiveRole).toLowerCase()) && (
                            <button
                              type="button"
                              className="btn primary"
                              style={{
                                width: '100%',
                                height: '36px',
                                borderRadius: '10px',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                marginTop: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                              onClick={() => {
                                if (weeklyShiftDates.length === 0) {
                                  toast.error(t('Vui lòng chọn ít nhất 1 ngày để đăng ký lịch trực tuần!'));
                                  return;
                                }
                                setShowWeeklyConfirmModal(true);
                              }}
                              disabled={weeklySubmitting}
                            >
                              {weeklySubmitting ? (
                                <>
                                  <RefreshCw size={14} className="spin" />
                                  {t('Đang gửi đăng ký...')}
                                </>
                              ) : (
                                t('Lưu lịch trực tuần')
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Leave (Nghỉ phép) registration card */}
                    <div className="card" style={{
                      padding: '1.25rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '16px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      transition: 'all 0.3s ease'
                    }}>
                      <div 
                        onClick={() => setShowLeaveScheduler(!showLeaveScheduler)} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Calendar size={18} color="var(--color-primary)" />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{t('ĐĂNG KÝ NGHÌ PHÉP (LEAVE)')}</span>
                              {onLeave && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  color: 'var(--color-warning)',
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}>{t('Đang nghỉ')}</span>
                              )}
                            </h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, marginBottom: 0 }}>
                              {t('Tạm dừng nhận data phân bổ tự động.')}
                            </p>
                          </div>
                        </div>
                        <div style={{
                          color: 'var(--color-text-muted)',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--color-bg-alt)',
                          border: '1px solid var(--color-border-light)'
                        }}>
                          {showLeaveScheduler ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {showLeaveScheduler && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                          {onLeave && (
                            <div style={{
                              padding: '8px 12px', borderRadius: 8, textAlign: 'center', fontWeight: 700, fontSize: '0.8rem',
                              background: 'var(--color-warning-light)', color: 'var(--color-warning)'
                            }}>
                              {t('ĐANG TRONG KỲ NGHỈ PHÉP')}
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--color-bg-alt)', padding: '16px', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontWeight: 750, fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Từ ngày')}</label>
                              <input
                                type="date"
                                className="form-input"
                                value={editLeaveStart}
                                onChange={(e) => setEditLeaveStart(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0 12px',
                                  borderRadius: '10px',
                                  height: '42px',
                                  fontSize: '0.85rem',
                                  background: 'var(--color-surface)',
                                  border: '1px solid var(--color-border-light)',
                                  boxShadow: 'var(--shadow-sm)',
                                  transition: 'border-color 0.15s ease'
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <label style={{ fontWeight: 750, fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Đến ngày')}</label>
                              <input
                                type="date"
                                className="form-input"
                                value={editLeaveEnd}
                                onChange={(e) => setEditLeaveEnd(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '0 12px',
                                  borderRadius: '10px',
                                  height: '42px',
                                  fontSize: '0.85rem',
                                  background: 'var(--color-surface)',
                                  border: '1px solid var(--color-border-light)',
                                  boxShadow: 'var(--shadow-sm)',
                                  transition: 'border-color 0.15s ease'
                                }}
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn primary"
                            style={{
                              width: '100%',
                              height: '38px',
                              borderRadius: '10px',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              boxShadow: '0 4px 12px rgba(189, 29, 45, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                            onClick={handleAddLeave}
                            disabled={savingLeave}
                          >
                            {savingLeave ? (
                              <>
                                <RefreshCw size={14} className="spin" />
                                {t('Đang đăng ký...')}
                              </>
                            ) : (
                              t('Đăng ký nghỉ')
                            )}
                          </button>

                          {/* Lịch sử đăng ký nghỉ phép */}
                          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', marginTop: '6px' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{t('LỊCH SỬ NGHỈ PHÉP')}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                                ({leaveHistory.length})
                              </span>
                            </h4>

                            {loadingLeaves ? (
                              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                <RefreshCw className="spin" size={16} style={{ marginRight: 6 }} />
                                {t('Đang tải lịch sử...')}
                              </div>
                            ) : leaveHistory.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                {t('Chưa có đăng ký nghỉ phép nào.')}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                                {leaveHistory.map((leave) => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  const isPast = leave.end_date < todayStr;
                                  const isCurrent = todayStr >= leave.start_date && todayStr <= leave.end_date;

                                  return (
                                    <div
                                      key={leave.id}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px 14px',
                                        background: isCurrent ? 'rgba(245, 158, 11, 0.04)' : (isPast ? 'var(--color-bg-alt)' : 'var(--color-surface)'),
                                        border: isCurrent 
                                          ? '1px solid var(--color-warning)' 
                                          : '1px solid var(--color-border-light)',
                                        borderRadius: '12px',
                                        boxShadow: 'var(--shadow-xs)'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{
                                          width: '32px',
                                          height: '32px',
                                          borderRadius: '8px',
                                          background: isCurrent 
                                            ? 'rgba(245, 158, 11, 0.1)' 
                                            : (isPast ? 'rgba(100, 116, 139, 0.08)' : 'var(--color-primary-light)'),
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0
                                        }}>
                                          <Calendar size={14} color={isCurrent ? 'var(--color-warning)' : (isPast ? 'var(--color-text-muted)' : 'var(--color-primary)')} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                            {new Date(leave.start_date).toLocaleDateString('vi-VN')} → {new Date(leave.end_date).toLocaleDateString('vi-VN')}
                                          </span>
                                          <span style={{
                                            fontSize: '0.68rem',
                                            fontWeight: 650,
                                            color: isCurrent ? 'var(--color-warning)' : (isPast ? 'var(--color-text-muted)' : 'var(--color-primary)')
                                          }}>
                                            {isCurrent ? t('Đang trong kỳ nghỉ') : (isPast ? t('Đã qua') : t('Sắp nghỉ'))}
                                          </span>
                                        </div>
                                      </div>
                                      {!isPast && ['sale', 'manager'].includes(String(effectiveRole).toLowerCase()) && (
                                        <button
                                          type="button"
                                          className="btn text-danger"
                                          style={{
                                            padding: '4px 10px',
                                            fontSize: '0.75rem',
                                            height: '28px',
                                            borderRadius: '6px',
                                            background: 'rgba(239, 68, 68, 0.08)',
                                            border: 'none',
                                            fontWeight: 600
                                          }}
                                          onClick={() => handleDeleteLeave(leave.id)}
                                        >
                                          {t('Hủy')}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Combined Work Hours & Schedule Card */}
                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={18} color="var(--color-primary)" />
                      {t('GIỜ LÀM VIỆC & LỊCH TRÌNH')}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
                      {t('Thời gian nhận lead cố định hàng ngày hoặc lịch trình tùy chỉnh theo từng thứ do Ban Quản Trị thiết lập.')}
                    </p>
                  </div>

                  {scheduleMode === 'daily' ? (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(100, 116, 139, 0.04)',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px solid var(--color-border-light)'
                    }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {t('Tất cả các ngày trong tuần')}
                      </span>
                      <span style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        color: 'var(--color-text-muted)',
                        background: 'rgba(100, 116, 139, 0.08)',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {editWorkStartTime} - {editWorkEndTime}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {Object.entries(DAY_LABELS).map(([dayKey, dayLabel]) => {
                        const config = editWorkSchedule[dayKey] || { active: true, start: editWorkStartTime, end: editWorkEndTime };
                        const isActive = config.active;

                        return (
                          <div
                            key={dayKey}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 14px',
                              borderRadius: '12px',
                              border: isActive ? '1px solid var(--color-border-light)' : '1px dashed var(--color-border-light)',
                              background: isActive ? 'var(--color-surface)' : 'var(--color-bg-alt)',
                              opacity: isActive ? 1 : 0.65,
                              transition: 'all 0.2s'
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                              {t(dayLabel)}
                            </span>

                            {isActive ? (
                              <span style={{
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: 'var(--color-text-muted)',
                                background: 'rgba(100, 116, 139, 0.08)',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                {config.start || editWorkStartTime} - {config.end || editWorkEndTime}
                              </span>
                            ) : (
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: 'var(--color-success)'
                              }}>
                                {t('Nghỉ')}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 7. DOCUMENTS & CONTRACTS */}
            {profileActiveTab === 'documents' && (
              <div className="card animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={18} color="var(--color-primary)" />
                    {t('HỒ SƠ & TÀI LIỆU NHÂN SỰ')}
                  </h3>
                  {/* Admin/Manager upload button */}
                  {(['admin', 'superadmin', 'manager', 'assistant'].includes(user?.role as any)) && (
                    <label style={{
                      background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                      padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', margin: 0
                    }}>
                      <Plus size={14} />
                      {t('Tải lên')}
                      <input type="file" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !targetConsultantId) return;
                        setUploadingDoc(true);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          formData.append('name', file.name);
                          formData.append('category', `consultant_${targetConsultantId}`);
                          formData.append('visibility', 'personal');
                          
                          const uploadRes = await api.post('/cloud-files', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });
                          if (uploadRes.data && uploadRes.data.success) {
                            toast.success(t('Đã tải tài liệu lên thành công!'));
                            fetchConsultantDocs();
                          } else {
                            toast.error(uploadRes.data.message || t('Lỗi tải tài liệu lên'));
                          }
                        } catch (err: any) {
                          toast.error(t('Lỗi kết nối tải tài liệu: ') + err.message);
                        } finally {
                          setUploadingDoc(false);
                        }
                      }} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t('Danh sách tài liệu hợp đồng, quyết định khen thưởng/kỷ luật hoặc hồ sơ nhân sự.')}
                </p>

                {uploadingDoc && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    <RefreshCw className="spin" size={14} />
                    {t('Đang tải tài liệu lên...')}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.5rem' }}>
                  {consultantDocs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic', background: 'var(--color-bg)', borderRadius: '8px' }}>
                      {t('Chưa có tài liệu nào được tải lên.')}
                    </div>
                  ) : (
                    consultantDocs.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginRight: '8px' }}>
                          <a
                            href={resolveAttachmentUrl(doc.file_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              color: 'var(--color-primary)',
                              textDecoration: 'none',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden'
                            }}
                            className="hover-underline"
                          >
                            {doc.name}
                          </a>
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                            {t('Tải lên bởi')} {doc.uploader_name || t('Hệ thống')} • {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '4px' }}>
                          <a
                            href={resolveAttachmentUrl(doc.file_path)}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            className="hover-bg-primary-light"
                            title={t('Tải xuống')}
                          >
                            <ArrowUpRight size={15} />
                          </a>

                          {(['admin', 'superadmin', 'manager', 'assistant'].includes(user?.role as any)) && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm(t('Bạn có chắc chắn muốn xóa tài liệu này?'))) return;
                                try {
                                  const res = await api.delete(`/cloud-files/${doc.id}`);
                                  if (res.data.success || res.data.success) {
                                    toast.success(t('Đã xóa tài liệu thành công!'));
                                    fetchConsultantDocs();
                                  } else {
                                    toast.error(res.data.message || t('Lỗi khi xóa tài liệu'));
                                  }
                                } catch (err: any) {
                                    toast.error(t('Lỗi kết nối xóa tài liệu: ') + err.message);
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--color-danger)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              className="hover-bg-danger-light"
                              title={t('Xóa tài liệu')}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    );
  };

  // Active Sale Portal View
  return (
    <div style={embedMode ? { width: '100%' } : { height: '100vh', width: '100vw', background: 'var(--color-bg)', display: 'flex', overflow: 'hidden' }}>

      {/* Mobile Modal Menu */}
      {!embedMode && isMobile && isMobileSidebarOpen && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 11000,
          background: 'rgba(22, 29, 49, 0.96)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          color: '#dadada',
          overflowY: 'auto'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid rgba(192, 132, 252, 0.8)'
              }}>
                <img src="/LOGO.jpg" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} alt="logo" />
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>RICH LAND</span>
            </div>
            <button 
              onClick={() => setIsMobileSidebarOpen(false)}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Menu Groups */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            {(() => {
              const PORTAL_SIDEBAR_GROUPS = [
                {
                  title: 'TỔNG QUAN',
                  items: [
                    { name: 'Tổng quan', key: 'dashboard', icon: LayoutDashboard },
                    { name: 'Bàn làm việc', key: 'workspace', icon: CheckSquare },
                    { name: 'Kho Databank', key: 'databank', icon: Layers }
                  ]
                },
                {
                  title: 'KHÁCH HÀNG',
                  items: [
                    { name: 'Nhật ký Data', key: 'data', icon: Database },
                    { name: 'Khách hàng CRM', key: 'crm-contacts', icon: Users, route: '/contacts' },
                    { name: 'Lịch biểu', key: 'calendar', icon: Calendar },
                    { name: 'Ticket Lỗi Data', key: 'tickets', icon: Ticket, badgeCount: data.stats.tickets_pending },
                    { name: 'Ticket Hỗ Trợ', key: 'support-tickets', icon: LifeBuoy, route: '/support-tickets' }
                  ]
                },
                {
                  title: 'DỰ ÁN',
                  items: [
                    { name: 'Dự án', key: 'projects', icon: Building2 },
                    { name: 'Tài liệu', key: 'files', icon: FileText }
                  ]
                },
                {
                  title: 'NHÂN SỰ',
                  items: [
                    { name: 'Tư vấn viên', key: 'consultants', icon: Users }
                  ]
                },
                {
                  title: 'TÀI CHÍNH',
                  items: [
                    { name: 'Hóa đơn', key: 'invoices', icon: Receipt },
                    { name: 'Phiếu hợp tác', key: 'cooperation-slips', icon: Scale, route: '/cooperation-slips' },
                    { name: 'Chi phí', key: 'expenses', icon: CreditCard, route: '/expenses' }
                  ]
                },
                {
                  title: 'CÀI ĐẶT TÀI KHOẢN',
                  items: [
                    { name: 'Quản lý tài khoản', key: 'schedule', icon: Settings }
                  ]
                }
              ];

              return PORTAL_SIDEBAR_GROUPS.map((group, groupIdx) => (
                <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>{t(group.title)}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                    {group.items.map(({ name, key, icon: Icon, badgeCount, route }) => {
                      const isActive = activeTab === key;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (route) {
                              navigate(route);
                            } else {
                              setActiveTab(key as any);
                            }
                            setIsMobileSidebarOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '0.75rem',
                            background: isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '0.8125rem',
                            fontWeight: isActive ? 700 : 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                            position: 'relative'
                          }}
                        >
                          <Icon size={16} color="white" />
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(name)}</span>
                          {badgeCount !== undefined && badgeCount > 0 && (
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '10px',
                              background: '#ef4444',
                              color: 'white',
                              fontSize: '0.6rem',
                              fontWeight: 700
                            }}>{badgeCount}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* Mobile Sidebar overlay - hidden on mobile due to the modal menu, kept for non-mobile fallback if needed */}
      {!embedMode && !isMobile && isMobileSidebarOpen && (
        <div
          className="responsive-sidebar-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      {!embedMode && (
        <aside
        className={`responsive-sidebar ${isMobileSidebarOpen ? 'responsive-sidebar-open' : ''}`}
        style={{
          width: isCollapsed ? 72 : 260,
          background: 'var(--sidebar-bg, #161d31)',
          color: '#dadada',
          display: isMobile ? 'none' : 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 50,
          boxShadow: '4px 0 24px rgba(0,0,0,0.12)'
        }}
      >
        {/* Logo Area */}
        <div style={{
          height: 92,
          display: 'flex',
          alignItems: 'center',
          padding: isCollapsed ? '20px 0 0 0' : '20px 1.25rem 0 1.25rem',
          gap: '0.875rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          overflow: 'hidden'
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(192, 132, 252, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            border: '2px solid rgba(192, 132, 252, 0.8)'
          }}>
            <img src="/LOGO.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo" />
          </div>

          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 900, whiteSpace: 'nowrap', color: 'white', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                RICH LAND
              </span>
              <span style={{
                fontSize: '0.625rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #f45b69 0%, #e63946 50%, #BD1D2D 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginTop: '4px',
                whiteSpace: 'nowrap'
              }}>
                / SALE PORTAL
              </span>
            </div>
          )}
        </div>

        {/* Quick Action Button */}
        <div style={{ padding: isCollapsed ? '0.75rem 0.5rem' : '1.25rem 1rem', display: 'flex', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {isCollapsed ? (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
                setIsMobileSidebarOpen(false);
              }}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #FF4D6D 0%, #C9182B 50%, #800F2F 100%)',
                color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 14px rgba(201, 24, 43, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(201, 24, 43, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.35)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(201, 24, 43, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)';
              }}
              title={t("Thêm data nhanh")}
            >
              <Plus size={20} />
            </button>
          ) : (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
                setIsMobileSidebarOpen(false);
              }}
              style={{
                width: '100%', height: 44, borderRadius: '12px',
                background: 'linear-gradient(135deg, #FF4D6D 0%, #C9182B 50%, #800F2F 100%)',
                color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(201, 24, 43, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(201, 24, 43, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.35)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(201, 24, 43, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)';
              }}
            >
              <Plus size={18} /> {t("Thêm data nhanh")}
            </button>
          )}
        </div>

        {/* Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="responsive-hide-mobile"
          style={{
            position: 'absolute', right: -12, top: 36, transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%', background: 'var(--color-surface)', color: 'var(--color-text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 200, border: '1px solid var(--color-border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'all 0.2s',
          }}
        >
          <ChevronLeft size={14} style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
        </button>

        {/* Navigation list */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
          <div ref={navContainerRef} style={{ position: 'relative', padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>

            {/* Sliding Active Indicator */}
            {sliderStyle.height > 0 && (
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 4,
                height: sliderStyle.height,
                background: 'var(--color-primary)',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: `translateY(${sliderStyle.top}px)`,
                borderRadius: '0 2px 2px 0',
                pointerEvents: 'none',
                zIndex: 10
              }} />
            )}

            {(() => {
              const PORTAL_SIDEBAR_GROUPS = [
                {
                  title: 'TỔNG QUAN',
                  items: [
                    { name: 'Tổng quan', key: 'dashboard', icon: LayoutDashboard },
                    { name: 'Bàn làm việc', key: 'workspace', icon: CheckSquare },
                    { name: 'Kho Databank', key: 'databank', icon: Layers }
                  ]
                },
                {
                  title: 'KHÁCH HÀNG',
                  items: [
                    { name: 'Nhật ký Data', key: 'data', icon: Database },
                    { name: 'Khách hàng CRM', key: 'crm-contacts', icon: Users, route: '/contacts' },
                    { name: 'Lịch biểu', key: 'calendar', icon: Calendar },
                    { name: 'Ticket Lỗi Data', key: 'tickets', icon: Ticket, badgeCount: data.stats.tickets_pending },
                    { name: 'Ticket Hỗ Trợ', key: 'support-tickets', icon: LifeBuoy, route: '/support-tickets' }
                  ]
                },
                {
                  title: 'DỰ ÁN',
                  items: [
                    { name: 'Dự án', key: 'projects', icon: Building2 },
                    { name: 'Tài liệu', key: 'files', icon: FileText }
                  ]
                },
                {
                  title: 'NHÂN SỰ',
                  items: [
                    { name: 'Tư vấn viên', key: 'consultants', icon: Users }
                  ]
                },
                {
                  title: 'TÀI CHÍNH',
                  items: [
                    { name: 'Hóa đơn', key: 'invoices', icon: Receipt },
                    { name: 'Phiếu hợp tác', key: 'cooperation-slips', icon: Scale, route: '/cooperation-slips' },
                    { name: 'Chi phí', key: 'expenses', icon: CreditCard, route: '/expenses' }
                  ]
                },
                {
                  title: 'CÀI ĐẶT TÀI KHOẢN',
                  items: [
                    { name: 'Quản lý tài khoản', key: 'schedule', icon: Settings }
                  ]
                }
              ];

              return PORTAL_SIDEBAR_GROUPS.map((group, groupIdx) => (
                <React.Fragment key={groupIdx}>
                  {!isCollapsed && (
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
                      padding: '0.5rem 1.5rem', whiteSpace: 'nowrap',
                      display: 'block',
                      marginTop: groupIdx > 0 ? '1.25rem' : '0.5rem',
                      marginBottom: '0.25rem'
                    }}>{t(group.title)}</span>
                  )}
                  {group.items.map(({ name, key, icon: Icon, badgeCount, route }) => {
                    const isActive = activeTab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          if (route) {
                            navigate(route);
                          } else {
                            setActiveTab(key as any);
                          }
                          setIsMobileSidebarOpen(false);
                        }}
                        data-active={isActive ? "true" : "false"}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.875rem',
                          padding: isCollapsed ? '0.75rem 0' : '0.75rem 1.5rem',
                          justifyContent: isCollapsed ? 'center' : 'flex-start',
                          color: isActive ? '#dadada' : 'rgba(255,255,255,0.5)',
                          border: 'none', background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                          fontSize: '0.9375rem', cursor: 'pointer', width: '100%',
                          fontWeight: isActive ? 700 : 500, transition: 'all 0.2s ease',
                          position: 'relative', textAlign: 'left', outline: 'none'
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.2s', position: 'relative'
                        }}>
                          <Icon size={18} color={isActive ? '#dadada' : 'rgba(255,255,255,0.5)'} />
                          {isCollapsed && badgeCount !== undefined && badgeCount > 0 && (
                            <span style={{
                              position: 'absolute', top: 4, right: 4,
                              width: 8, height: 8, borderRadius: '50%',
                              background: '#ef4444',
                              boxShadow: '0 0 0 2px var(--sidebar-bg, #161d31)'
                            }} />
                          )}
                        </div>

                        {!isCollapsed && (
                          <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            {t(name)}
                            {badgeCount !== undefined && badgeCount > 0 && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 800,
                                height: 20, minWidth: 20, padding: '0 6px', borderRadius: '9999px'
                              }}>
                                {badgeCount}
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              ));
            })()}
          </div>
        </div>
      </aside>
      )}

      {/* Right Side Content Panel */}
      <div style={embedMode ? { width: '100%' } : { flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Top Header Navigation */}
        {!embedMode && (
          <header className="portal-header" style={{
          height: 66,
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Mobile Hamburger menu toggle */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              style={{
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                cursor: 'pointer',
                color: 'var(--color-text)'
              }}
              className="mobile-menu-btn"
            >
              <Menu size={20} />
            </button>

            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '0.5px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>RICH LAND PORTAL</span>
                <span style={{ fontSize: '0.725rem', padding: '2px 8px', borderRadius: 20, background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 700 }}>
                  SALE
                </span>
              </h1>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {t('Nhân viên: {name}').replace('{name}', displayUser?.name || '')}
                {(user?.role === 'admin' || user?.role === 'superadmin') && saleIdFilter && (
                  <button 
                    onClick={handleExitImpersonation}
                    style={{
                      background: 'var(--color-danger-light)',
                      color: 'var(--color-danger)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--color-danger-light)'}
                  >
                    {t('Thoát đóng vai')}
                  </button>
                )}
              </span>
            </div>
          </div>

          <div className="portal-header-user" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            {/* Switch to CRM Button */}
            <button 
              onClick={() => navigate('/contacts')}
              className="responsive-hide-mobile"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                transition: 'all 0.2s',
                marginRight: '0.5rem',
                outline: 'none'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Users size={14} />
              {t('Tru cập CRM')}
            </button>

            {/* Quick Vacation Toggle for Sale */}
            {['sale', 'manager'].includes(String(displayUser?.role).toLowerCase()) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '6px 12px',
                marginRight: '0.5rem'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: !portalVacationMode ? '#10b981' : '#f59e0b' }}>
                  {!portalVacationMode ? t('Nhận data') : t('Tạm ngưng')}
                </span>
                <ToggleSwitch
                  checked={!portalVacationMode}
                  onChange={() => {
                    if (!portalVacationMode) {
                      setVacationConfirmOpen(true);
                    } else {
                      handleTogglePortalVacation();
                    }
                  }}
                />
              </div>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="responsive-hide-mobile"
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-light)',
                borderRadius: 8,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              title={theme === 'light' ? t("Chuyển sang giao diện tối") : t("Chuyển sang giao diện sáng")}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--color-bg)';
                e.currentTarget.style.color = 'var(--color-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--color-text-light)';
              }}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} style={{ color: '#fbbf24' }} />}
            </button>

            {/* Language Selector Dropdown */}
            <div className="responsive-hide-mobile" style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLangOpen(!isLangOpen);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'var(--color-bg)',
                  border: `1px solid ${isLangOpen ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: '6px',
                  padding: '3px 6px',
                  cursor: 'pointer',
                  color: 'var(--color-text)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  height: 30,
                  outline: 'none',
                  boxShadow: 'none',
                }}
                title={t('Chọn ngôn ngữ')}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isLangOpen ? 'var(--color-primary)' : 'var(--color-border)';
                }}
              >
                <img
                  src={languagesList.find(l => l.code === language)?.flag || vnFlag}
                  style={{
                    width: 24,
                    height: 16,
                    borderRadius: '1.5px',
                    objectFit: 'cover',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    display: 'block'
                  }}
                  alt={t(languagesList.find(l => l.code === language)?.name || 'Tiếng Việt')}
                />
                <ChevronDown
                  size={12}
                  style={{
                    color: 'var(--color-text-muted)',
                    transform: isLangOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s'
                  }}
                />
              </button>

              {isLangOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: '135px',
                  zIndex: 50
                }}>
                  {languagesList.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsLangOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '8px 10px',
                        border: 'none',
                        background: language === lang.code ? 'var(--color-bg)' : 'transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: 'var(--color-text)',
                        fontSize: '0.8125rem',
                        fontWeight: language === lang.code ? 600 : 400,
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => {
                        if (language !== lang.code) e.currentTarget.style.background = 'var(--color-bg)';
                      }}
                      onMouseLeave={e => {
                        if (language !== lang.code) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <img
                        src={lang.flag}
                        style={{ width: 20, height: 14, borderRadius: '1.5px', objectFit: 'cover', border: '1px solid rgba(0, 0, 0, 0.08)' }}
                        alt={lang.name}
                      />
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Check-in Button */}
            {['sale', 'manager'].includes(String(displayUser?.role).toLowerCase()) && (
              <div style={{ marginRight: '0.75rem', display: 'flex', alignItems: 'center' }}>
                {todayCheckIn ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: todayCheckIn.status === 'rejected' ? 'pointer' : 'default',
                      border: '1px solid',
                      backgroundColor: 
                        todayCheckIn.status === 'approved' ? 'rgba(255, 255, 255, 0.12)' :
                        todayCheckIn.status === 'pending_approval' ? 'rgba(245, 158, 11, 0.18)' :
                        'rgba(239, 68, 68, 0.18)',
                      color: 
                        todayCheckIn.status === 'approved' ? '#ffffff' :
                        todayCheckIn.status === 'pending_approval' ? '#ffe066' :
                        '#ff8888',
                      borderColor: 
                        todayCheckIn.status === 'approved' ? 'rgba(255, 255, 255, 0.25)' :
                        todayCheckIn.status === 'pending_approval' ? 'rgba(245, 158, 11, 0.35)' :
                        'rgba(239, 68, 68, 0.35)',
                      backdropFilter: 'blur(8px)',
                    }}
                    onClick={() => {
                      if (todayCheckIn.status === 'rejected') {
                        window.dispatchEvent(new CustomEvent('trigger-checkin-modal'));
                      }
                    }}
                    title={
                      todayCheckIn.status === 'approved' ? t('Đã chấm công thành công') :
                      todayCheckIn.status === 'pending_approval' ? t('Đang chờ quản lý phê duyệt đi trễ') :
                      t('Bị từ chối chấm công. Click để thử lại.')
                    }
                  >
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 
                        todayCheckIn.status === 'approved' ? '#34c759' :
                        todayCheckIn.status === 'pending_approval' ? 'var(--color-warning)' :
                        'var(--color-danger)',
                    }} />
                    {todayCheckIn.status === 'approved' && `${t('Đã Check-in')} (${todayCheckIn.check_in_time.substring(0, 5)})`}
                    {todayCheckIn.status === 'pending_approval' && `${t('Chờ duyệt trễ')} (${todayCheckIn.check_in_time.substring(0, 5)})`}
                    {todayCheckIn.status === 'rejected' && t('Chấm công bị từ chối')}
                  </div>
                ) : (
                  <button
                    className="btn primary sm"
                    style={{
                      borderRadius: '20px',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: 'auto',
                      backgroundColor: '#BD1D2D',
                    }}
                    onClick={() => window.dispatchEvent(new CustomEvent('trigger-checkin-modal'))}
                  >
                    <Camera size={14} />
                    {t('Chấm công')}
                  </button>
                )}
              </div>
            )}

            {/* Hoverable Profile Dropdown */}
            <div
              onMouseEnter={() => setIsProfileMenuOpen(true)}
              onMouseLeave={() => setIsProfileMenuOpen(false)}
              style={{ position: 'relative' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  paddingLeft: '0.875rem',
                  borderLeft: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'background 0.2s',
                  background: isProfileMenuOpen ? 'var(--color-bg)' : 'transparent'
                }}
              >
                <Avatar src={displayUser?.avatar} name={displayUser?.name} size={32} />
                <div className="responsive-hide-mobile" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{displayUser?.name || 'User'}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>
                    {(() => {
                      const matched = data.consultants?.find((c: any) => 
                        (c.user_id && String(c.user_id) === String(displayUser?.id)) || 
                        (c.id && String(c.id) === String(displayUser?.consultant_id)) ||
                        (c.id && String(c.id) === String(displayUser?.id))
                      );
                      const jt = (displayUser as any)?.job_title || matched?.job_title || (displayUser as any)?.erp_profile?.job_title;
                      if (jt) return jt;
                      if ((displayUser as any)?.address) {
                        try {
                          const p = typeof (displayUser as any).address === 'string' ? JSON.parse((displayUser as any).address) : (displayUser as any).address;
                          if (p?.erp_profile?.job_title) return p.erp_profile.job_title;
                        } catch(e) {}
                      }
                      return displayUser?.role === 'sale' ? t('Tư vấn viên') : displayUser?.role === 'sales' ? t('Tư vấn viên') : displayUser?.role;
                    })()}
                  </span>
                </div>
              </div>

              {isProfileMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: '160px',
                  zIndex: 50
                }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '8px 10px',
                      color: 'var(--color-text)',
                      fontSize: '0.75rem',
                      borderBottom: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      borderRadius: '6px 6px 0 0'
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{displayUser?.name}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.65rem' }}>{displayUser?.email}</span>
                  </div>

                  <a
                    href="https://zalo.me/0378859736"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--color-text)',
                      fontSize: '0.8125rem',
                      textAlign: 'left',
                      textDecoration: 'none',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} />
                    {t('Báo lỗi')}
                  </a>

                  {currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin' && (
                    <>
                      <button
                        onClick={() => {
                          setActiveTab('schedule');
                          setIsProfileMenuOpen(false);
                          toast.success(t('Đang mở trang Thông tin cá nhân'));
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '8px 10px',
                          border: 'none',
                          background: 'transparent',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          fontSize: '0.8125rem',
                          textAlign: 'left',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <User size={14} style={{ color: 'var(--color-primary)' }} />
                        {t('Thông tin cá nhân')}
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('consultants');
                          setIsProfileMenuOpen(false);
                          toast.success(t('Đang mở trang Thông tin Team'));
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '8px 10px',
                          border: 'none',
                          background: 'transparent',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          fontSize: '0.8125rem',
                          textAlign: 'left',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Users size={14} style={{ color: 'var(--color-primary)' }} />
                        {t('Thông tin Team')}
                      </button>
                    </>
                  )}

                  <div style={{ borderBottom: '1px solid var(--color-border)', margin: '4px 0' }} />

                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--color-danger)',
                      fontSize: '0.8125rem',
                      textAlign: 'left',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <LogOut size={14} />
                    {t('Đăng xuất')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        )}

        {/* Scrollable View Area */}
        <main className={embedMode ? "" : "no-scrollbar responsive-main portal-main-content"} style={embedMode ? { width: '100%' } : { flex: 1, padding: '2rem 3rem', width: '100%', overflowY: 'auto' }}>
          <div style={{ width: '100%' }}>


            {/* Render views based on activeTab */}
            <div key={activeTab} className="subtab-enter-active">
              {activeTab === 'dashboard' && renderDashboardView()}
              {activeTab === 'workspace' && renderWorkspaceView()}
              {activeTab === 'data' && renderDataView()}
              {activeTab === 'databank' && renderDatabankView()}
              {activeTab === 'calendar' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Title & Sub-tabs header row */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    width: '100%'
                  }}>
                    <div>
                      <h1 className="page-title" style={{ margin: 0 }}>{t('Lịch biểu & Chấm công')}</h1>
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      background: 'var(--color-border-light)',
                      border: '1px solid var(--color-border)',
                      padding: '2px',
                      borderRadius: '8px',
                      position: 'relative',
                      gap: '2px'
                    }}>
                      <button
                        onClick={() => setCalendarSubTab('calendar')}
                        style={{
                          padding: '6px 16px',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          background: 'transparent',
                          color: calendarSubTab === 'calendar' ? 'var(--color-text)' : 'var(--color-text-light)',
                          border: 'none',
                          outline: 'none',
                          boxShadow: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'color 0.2s',
                          position: 'relative'
                        }}
                      >
                        {calendarSubTab === 'calendar' && (
                          <motion.div 
                            layoutId="activeCalendarSubTabIndicator"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: 'var(--color-surface)',
                              borderRadius: '6px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                              zIndex: 1
                            }}
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          />
                        )}
                        <span style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} />
                          {t('Lịch biểu')}
                        </span>
                      </button>
                      <button
                        onClick={() => setCalendarSubTab('attendance')}
                        style={{
                          padding: '6px 16px',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          background: 'transparent',
                          color: calendarSubTab === 'attendance' ? 'var(--color-text)' : 'var(--color-text-light)',
                          border: 'none',
                          outline: 'none',
                          boxShadow: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'color 0.2s',
                          position: 'relative'
                        }}
                      >
                        {calendarSubTab === 'attendance' && (
                          <motion.div 
                            layoutId="activeCalendarSubTabIndicator"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: 'var(--color-surface)',
                              borderRadius: '6px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                              zIndex: 1
                            }}
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          />
                        )}
                        <span style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} />
                          {t('Chấm công')}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* View body */}
                  <div style={{ flex: 1 }}>
                    {calendarSubTab === 'calendar' ? renderCalendarView() : <AttendancePage embedMode={true} />}
                  </div>
                </div>
              )}
              {activeTab === 'fair-share' && <FairShareAudit forceActive={true} />}
              {activeTab === 'tickets' && renderTicketsView()}
              {activeTab === 'schedule' && renderScheduleView()}
              {activeTab === 'invoices' && <InvoicesPage />}
              {activeTab === 'projects' && <ProjectsPage />}
              {activeTab === 'files' && <FilesPage />}
              {activeTab === 'consultants' && <Consultants />}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      {!embedMode && (
        <div className="mobile-bottom-nav">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`mobile-bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard />
            <span className="mobile-bottom-nav-item-label">{t('Tổng quan')}</span>
          </button>
          <button
            onClick={() => setActiveTab('workspace')}
            className={`mobile-bottom-nav-item ${activeTab === 'workspace' ? 'active' : ''}`}
          >
            <CheckSquare />
            <span className="mobile-bottom-nav-item-label">{t('Bàn làm việc')}</span>
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`mobile-bottom-nav-item ${activeTab === 'data' ? 'active' : ''}`}
          >
            <Database />
            <span className="mobile-bottom-nav-item-label">{t('Nhật ký Data')}</span>
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`mobile-bottom-nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
          >
            <div style={{ position: 'relative' }}>
              <Ticket />
              {data?.stats?.tickets_pending !== undefined && data.stats.tickets_pending > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-10px',
                  background: 'var(--color-danger)',
                  color: 'white',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  lineHeight: '1',
                  minWidth: '14px',
                  textAlign: 'center'
                }}>
                  {data.stats.tickets_pending}
                </span>
              )}
            </div>
            <span className="mobile-bottom-nav-item-label">{t('Hộp thư')}</span>
          </button>
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="mobile-bottom-nav-item"
          >
            <Menu />
            <span className="mobile-bottom-nav-item-label">{t('Xem thêm')}</span>
          </button>
        </div>
      )}


      {/* Vacation Confirm Modal */}
      {vacationConfirmOpen && (
        <CustomModal
          isOpen={vacationConfirmOpen}
          onClose={() => setVacationConfirmOpen(false)}
          title={t("CẢNH BÁO TẠM NGƯNG NHẬN DATA")}
          width="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', color: 'var(--color-danger)' }}>
              <AlertTriangle size={24} style={{ flexShrink: 0 }} />
              <div>
                <h4 style={{ fontWeight: 800, margin: 0, fontSize: '0.95rem' }}>{t('Bạn có chắc chắn muốn TẠM NGƯNG nhận data mới?')}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
                  {t('Hệ thống sẽ tạm ngưng phân bổ khách hàng mới cho bạn. Khách hàng cũ của bạn đăng ký lại VẪN sẽ tự động chuyển và gửi tin nhắn Nhắc trùng cho bạn chăm sóc bình thường. Thông báo tạm ngưng này sẽ được gửi trực tiếp đến Zalo của Ban quản trị (Admin).')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                onClick={() => setVacationConfirmOpen(false)}
                className="btn sm secondary"
              >
                {t('Hủy bỏ')}
              </button>
              <button
                onClick={() => {
                  handleTogglePortalVacation();
                  setVacationConfirmOpen(false);
                }}
                className="btn sm danger"
              >
                {t('Xác nhận tạm ngưng')}
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {/* Modal 1: Quick Report / Submit Ticket */}
      {reportModalOpen && selectedLead && (
        <CustomModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          title={t("BÁO CÁO LỖI DỮ LIỆU")}
        >
          {(() => {
            const isOtherReason = reportReasonType.toLowerCase().includes('khác') || reportReasonType.toLowerCase().includes('other');
            const rList = getReasonsList();
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: 'var(--color-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <strong>{t('Tên Khách hàng:')}</strong> {selectedLead.lead_name}
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <strong>{t('Số điện thoại:')}</strong> <span style={{ color: '#d97706', fontWeight: 700 }}>{selectedLead.phone}</span>
                  </div>
                  <div>
                    <strong>{t('Vòng chia:')}</strong> {selectedLead.round_name || t('Mặc định')}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-light)', marginBottom: '6px' }}>
                    {t('Lý do báo lỗi (Chọn mẫu có sẵn)')}
                  </label>
                  <select
                    value={reportReasonType}
                    onChange={(e) => setReportReasonType(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '10px',
                      border: '1px solid var(--color-border)', fontSize: '0.875rem', background: 'var(--color-surface)',
                      color: 'var(--color-text)', outline: 'none', cursor: 'pointer'
                    }}
                  >
                    {rList.map((r: any) => (
                      <option key={r.reason} value={r.reason}>{t(r.reason)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-light)', marginBottom: '6px' }}>
                    {isOtherReason ? t('Mô tả chi tiết lỗi (Bắt buộc)') : t('Mô tả chi tiết lỗi (Không bắt buộc)')}
                  </label>
                  <textarea
                    placeholder={isOtherReason ? t('Nhập chi tiết lý do lỗi (bắt buộc)...') : t('Nhập thêm chi tiết lỗi hoặc dẫn chứng trùng lặp (tùy chọn)...')}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    style={{
                      width: '100%', height: 100, padding: '10px 12px', borderRadius: '10px',
                      border: '1px solid var(--color-border)', fontSize: '0.875rem', outline: 'none',
                      resize: 'none', fontFamily: 'inherit', color: 'var(--color-text)', background: 'var(--color-surface)'
                    }}
                  />
                </div>

                <details style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}>
                  <summary style={{ fontWeight: 700, color: 'var(--color-text-light)', outline: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>💡 {t("Xem hướng dẫn quy định báo cáo lỗi")}</span>
                  </summary>
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'default' }}>
                    {rList.map((item: any, idx: number) => {
                      const borderColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#BD1D2D'];
                      const borderColor = borderColors[idx % borderColors.length];
                      const cleanNote = (item.note || '').replace(/{n}/g, String(data.duplicate_check_months || 6));
                      if (!cleanNote) return null;
                      return (
                        <div key={idx} style={{ fontSize: '0.78rem', lineHeight: 1.4, borderLeft: `3px solid ${borderColor}`, paddingLeft: 8 }}>
                          <strong style={{ color: borderColor }}>{t(item.reason).toUpperCase()}:</strong> {t(cleanNote)}
                        </div>
                      );
                    })}
                  </div>
                </details>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    onClick={() => setReportModalOpen(false)}
                    style={{
                      background: 'var(--color-border-light)', color: 'var(--color-text-light)', border: 'none', borderRadius: '8px',
                      padding: '10px 20px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer'
                    }}
                  >
                    {t('Hủy bỏ')}
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    disabled={submittingReport}
                    style={{
                      background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px',
                      padding: '10px 20px', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Send size={16} /> {submittingReport ? t('Đang gửi...') : t('Gửi báo cáo lỗi')}
                  </button>
                </div>
              </div>
            );
          })()}
        </CustomModal>
      )}

      {/* Modal 2: View Details */}
      {detailModalOpen && activeDetailLead && (
        <CustomModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={t("CHI TIẾT THÔNG TIN KHÁCH HÀNG")}
          width="900px"
        >
          <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem', fontSize: '0.9rem', minHeight: '380px' }}>
            {/* Cột trái: Thông tin khách hàng & Ghi chú */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Họ và tên:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{activeDetailLead.lead_name || t('Chưa cập nhật')}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Số điện thoại:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--score-warm)' }}>{activeDetailLead.phone}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Email:')}</span>
                <span style={{ color: 'var(--color-text)' }}>{activeDetailLead.lead_email || '—'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Vòng chia:')}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{activeDetailLead.round_name || t('Mặc định')}</span>
                  {activeDetailLead.status === 'compensation' && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'var(--color-success-light)',
                      color: 'var(--color-success)',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      marginTop: '2px'
                    }}>
                      {t('Data bù')}
                    </span>
                  )}
                </div>
              </div>

              {displayUser?.role !== 'sale' && (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Tư vấn viên:')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar src={activeDetailLead.sale_avatar} name={activeDetailLead.sale_name || t('Chưa nhận')} size="sm" />
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{activeDetailLead.sale_name || t('Chưa nhận')}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Nguồn khách:')}</span>
                <span style={{ color: 'var(--color-text)' }}>{activeDetailLead.source || 'N/A'}</span>
              </div>

              {activeDetailLead.type && (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Phân loại:')}</span>
                  <span style={{ color: 'var(--color-text)' }}>{activeDetailLead.type}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  {activeDetailLead.is_accepted === 1 ? t('Nhận lúc:') : t('Chia lúc:')}
                </span>
                <span style={{ color: 'var(--color-text-light)' }}>
                  {activeDetailLead.received_at ? new Date(activeDetailLead.received_at).toLocaleString('vi-VN') : 'N/A'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--color-bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)', marginTop: '4px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{t('Ghi chú đính kèm:')}</span>
                <span style={{ color: 'var(--color-text)', whiteSpace: 'pre-line', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {activeDetailLead.note
                    ? activeDetailLead.note
                      .replace(/\\n/g, '\n')
                      .split('\n')
                      .filter((line: string) => !/^(?:Nhập dữ liệu cũ|Nhap du lieu cu)\s*(?:\(Silent\))?$/i.test(line.trim()))
                      .join('\n')
                      .trim() || t('Không có ghi chú.')
                    : t('Không có ghi chú.')}
                </span>
              </div>
            </div>

            {/* Cột phải: Đánh giá AI & Lịch sử bàn giao & Nhắc lại */}
            <div className="portal-detail-right" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '1px solid var(--color-border)', paddingLeft: '1.5rem' }}>
              {/* Đánh giá AI */}
              {activeDetailLead.ai_screener_status && activeDetailLead.ai_screener_status !== 'not_screened' && (
                <div style={{
                  background: activeDetailLead.ai_screener_status === 'passed'
                    ? 'var(--color-success-light)'
                    : (activeDetailLead.ai_screener_status === 'failed' ? 'var(--color-danger-light)' : 'var(--color-warning-light)'),
                  border: '1px solid',
                  borderColor: activeDetailLead.ai_screener_status === 'passed'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : (activeDetailLead.ai_screener_status === 'failed' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'),
                  padding: '12px',
                  borderRadius: '12px',
                  marginBottom: '8px',
                  fontSize: '0.825rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #a31422 0%, #a31422 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 800, fontSize: '0.65rem'
                    }}>
                      AI
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{t('Đánh giá AI:')}</span>
                    <span style={{
                      marginLeft: 'auto',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: activeDetailLead.ai_screener_status === 'passed'
                        ? 'var(--color-success)'
                        : (activeDetailLead.ai_screener_status === 'failed' ? 'var(--color-danger)' : 'var(--color-warning)'),
                      color: 'white'
                    }}>
                      {activeDetailLead.ai_screener_status === 'passed'
                        ? t('ĐẠT CHUẨN')
                        : (activeDetailLead.ai_screener_status === 'failed' ? t('KHÔNG ĐẠT') : t('ĐANG XỬ LÝ'))}
                    </span>
                  </div>
                  <div style={{ color: 'var(--color-text-light)', lineHeight: 1.4 }}>
                    {activeDetailLead.ai_evaluation || t('Không có đánh giá chi tiết.')}
                  </div>
                </div>
              )}

              <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '8px' }}>{t('Lịch sử bàn giao & Nhắc lại:')}</span>

              {loadingTimeline ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                </div>
              ) : timeline && timeline.length > 0 ? (
                <div className="timeline" style={{ marginTop: '4px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                  {timeline.map((item: any, idx: number) => {
                    if (item.is_ticket === 1) {
                      let dotColor = '#ef4444'; // default rejected/red
                      if (item.ticket_status === 'approved') dotColor = '#10b981';
                      if (item.ticket_status === 'approved_no_comp') dotColor = '#2563eb';
                      if (item.ticket_status === 'pending') dotColor = '#f59e0b';

                      let statusLabel = t('Báo cáo lỗi (Đã bị từ chối)');
                      if (item.ticket_status === 'approved') statusLabel = t('Báo cáo lỗi (Đã duyệt bù)');
                      if (item.ticket_status === 'approved_no_comp') statusLabel = t('Báo cáo lỗi (Duyệt không bù)');
                      if (item.ticket_status === 'pending') statusLabel = t('Báo cáo lỗi (Chờ duyệt)');

                      return (
                        <div key={idx} className="timeline-item" style={{ marginBottom: '1.25rem' }}>
                          <div className="timeline-icon" style={{ backgroundColor: dotColor, left: '-1.85rem', width: '1rem', height: '1rem', border: '3px solid var(--color-surface)', boxShadow: '0 0 0 1px var(--color-border)' }} />
                          <div className="timeline-content" style={{
                            background: item.ticket_status === 'approved' ? 'var(--color-success-light)' : item.ticket_status === 'approved_no_comp' ? '#dbeafe' : item.ticket_status === 'pending' ? 'var(--color-warning-light)' : 'var(--color-danger-light)',
                            color: item.ticket_status === 'approved' ? 'var(--color-success)' : item.ticket_status === 'approved_no_comp' ? '#2563eb' : item.ticket_status === 'pending' ? 'var(--color-warning)' : 'var(--color-danger)',
                            padding: '10px 14px', borderRadius: '12px', border: '1px solid currentColor'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertCircle size={14} />
                                {statusLabel}
                              </span>
                              {item.received_at && (
                                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                  {new Date(item.received_at).toLocaleString('vi-VN')}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                              <strong>{t('Lý do gửi:')}</strong> {item.ticket_reason || '—'}
                            </div>
                            {item.ticket_status === 'rejected' && (
                              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                                <strong>{t('Lý do từ chối:')}</strong> {item.ticket_reject_reason || t('Không cung cấp lý do.')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    let dotColor = '#94a3b8';
                    if (item.status === 'Đã bàn giao') dotColor = '#3b82f6';
                    if (item.status === 'Nhắc trùng') dotColor = '#f59e0b';
                    if (item.status === 'Bù lượt') dotColor = '#10b981';

                    return (
                      <div key={idx} className="timeline-item" style={{ marginBottom: '1.25rem' }}>
                        <div className="timeline-icon" style={{ backgroundColor: dotColor, left: '-1.85rem', width: '1rem', height: '1rem', border: '3px solid var(--color-surface)', boxShadow: '0 0 0 1px var(--color-border)' }} />
                        <div className="timeline-content" style={{ background: 'var(--color-bg)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.85rem' }}>
                              {t(item.status)} {item.round_name ? `(${item.round_name})` : ''}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {new Date(item.received_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Avatar src={item.consultant_avatar} name={item.consultant_name} size={16} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                              <strong>{t('Nhận bởi:')}</strong> {item.consultant_name || t('Chưa rõ')}
                            </span>
                          </div>
                          {item.message && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                              &ldquo;{item.message}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', padding: '8px' }}>
                  {t('Không có lịch sử nhắc lại trước đó.')}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            {(() => {
              const myTaker = activeDetailLead.takers && activeDetailLead.takers.find((t: any) => Number(t.id) === Number(user?.id) || Number(t.id) === Number(user?.consultant_id));
              const isAssignee = Number(activeDetailLead.assigned_to) === Number(user?.consultant_id) || Number(activeDetailLead.assigned_to) === Number(user?.id);
              const isClaimer = !!myTaker || isAssignee;
              const canRelease = isClaimer && activeDetailLead.status !== 'databank' && activeDetailLead.status !== 'released_to_kho' && activeDetailLead.is_public !== 1 && Number(activeDetailLead.is_public) !== 1;

              return canRelease ? (
                <button
                  onClick={() => handleReleaseToDatabank(activeDetailLead.lead_id || activeDetailLead.id, myTaker?.contact_id)}
                  disabled={isReleasingLead}
                  title={t("Nhả về Kho chung (Databank)")}
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.05)',
                    borderRadius: '8px',
                    padding: '8px 20px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={14} className={isReleasingLead ? 'spin' : ''} />
                  {isReleasingLead ? t('Đang nhả...') : t('Nhả Kho')}
                </button>
              ) : null;
            })()}
            <button
              onClick={() => setDetailModalOpen(false)}
              style={{
                background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px',
                padding: '8px 24px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              {t('Đóng lại')}
            </button>
          </div>
        </CustomModal>
      )}

      {/* Modal 4: View Ticket Details */}
      {ticketModalOpen && selectedDetailTicket && (
        <CustomModal
          isOpen={ticketModalOpen}
          onClose={() => {
            setTicketModalOpen(false);
            setSelectedDetailTicket(null);
          }}
          title={t("CHI TIẾT VẤN ĐỀ / TICKET LỖI")}
          width="700px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.9rem' }}>

            {/* Lead & Ticket Metadata Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'var(--color-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-primary)', fontSize: '0.95rem' }}>
                  {t('Thông tin Khách hàng')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Họ và tên')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{selectedDetailTicket.lead_name || t('Ẩn danh')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Số điện thoại')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--score-warm)' }}>{selectedDetailTicket.lead_phone || '—'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-primary)', fontSize: '0.95rem' }}>
                  {t('Thông tin Báo cáo')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Tư vấn viên báo')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Avatar src={selectedDetailTicket.consultant_avatar} name={selectedDetailTicket.consultant_name} size={18} />
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{selectedDetailTicket.consultant_name}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Vòng chia')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{selectedDetailTicket.round_name || t('Mặc định')}</span>
                </div>
              </div>
            </div>

            {/* Ticket Reason / Issue details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '12px', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
              <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{t('Lý do báo lỗi chi tiết:')}</span>
              <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {selectedDetailTicket.reason || t('Chưa có thông tin lý do lỗi.')}
              </span>
            </div>

            {/* Admin Resolution & Feedback details */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '12px', borderRadius: '12px', border: '1px solid',
              background: selectedDetailTicket.status === 'approved' ? 'var(--color-success-light)' : selectedDetailTicket.status === 'approved_no_comp' ? '#dbeafe' : selectedDetailTicket.status === 'pending' ? '#fef3c7' : 'var(--color-danger-light)',
              borderColor: selectedDetailTicket.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : selectedDetailTicket.status === 'approved_no_comp' ? 'rgba(37, 99, 235, 0.2)' : selectedDetailTicket.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: selectedDetailTicket.status === 'approved' ? 'var(--color-success)' : selectedDetailTicket.status === 'approved_no_comp' ? '#2563eb' : selectedDetailTicket.status === 'pending' ? '#d97706' : 'var(--color-danger)'
            }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                {selectedDetailTicket.status === 'pending' && <Clock size={16} />}
                {selectedDetailTicket.status === 'approved' && <CheckCircle2 size={16} />}
                {selectedDetailTicket.status === 'approved_no_comp' && <Info size={16} />}
                {selectedDetailTicket.status === 'rejected' && <XCircle size={16} />}
                <span>
                  {t('Trạng thái Ticket: ')}{selectedDetailTicket.status === 'approved' ? t('Đã duyệt đền bù') : selectedDetailTicket.status === 'approved_no_comp' ? t('Duyệt không bù') : selectedDetailTicket.status === 'pending' ? t('Đang chờ phê duyệt') : t('Đã bị từ chối')}
                </span>
              </div>

              {selectedDetailTicket.status !== 'pending' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid currentColor', paddingTop: '8px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar src={selectedDetailTicket.resolved_by_avatar} name={selectedDetailTicket.resolved_by || t('Hệ thống')} size={24} />
                    <span style={{ fontSize: '0.825rem', fontWeight: 700 }}>
                      {t('Người duyệt:')} <span style={{ color: 'var(--color-text)' }}>{selectedDetailTicket.resolved_by || t('Hệ thống')}</span>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-text-light)' }}>
                    <strong>{t('Ý kiến phản hồi:')}</strong>{' '}
                    {selectedDetailTicket.status === 'approved'
                      ? (selectedDetailTicket.approval_reason || t('Hợp lệ & Đã được đền bù lượt chia mới.'))
                      : selectedDetailTicket.status === 'approved_no_comp'
                      ? (selectedDetailTicket.approval_reason || t('Hợp lệ nhưng không đền bù.'))
                      : (selectedDetailTicket.reject_reason || t('Không đủ điều kiện đền bù data lỗi.'))
                    }
                  </div>
                </div>
              )}

              {selectedDetailTicket.created_at && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', textAlign: 'right' }}>
                  {t('Ngày gửi báo cáo: ')}{new Date(selectedDetailTicket.created_at).toLocaleString('vi-VN')}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
              <button
                onClick={() => {
                  setTicketModalOpen(false);
                  setSelectedDetailTicket(null);
                }}
                style={{
                  background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px',
                  padding: '8px 24px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                {t('Đóng lại')}
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {/* Modal 3: View Calendar Day Details */}
      {selectedCalendarDate && (
        <CustomModal
          isOpen={!!selectedCalendarDate}
          onClose={() => {
            setSelectedCalendarDate(null);
            setDayDetails(null);
            setActiveCalendarModalTab('sales');
          }}
          title={`${t('Chi tiết hoạt động ngày')} ${selectedCalendarDate ? new Date(selectedCalendarDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}`}
          width="900px"
        >
          {dayDetailsLoading ? (
            <div style={{ padding: '1rem' }}>
              <TableSkeleton rows={5} cols={4} />
            </div>
          ) : dayDetails ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '580px', margin: '-1.5rem', overflow: 'hidden' }}>
              {/* Modal Tabs */}
              <div style={{
                display: 'flex',
                background: 'var(--color-border-light)',
                borderRadius: '12px',
                padding: '4px',
                gap: '4px',
                flexShrink: 0,
                margin: '1.5rem 1.5rem 1rem 1.5rem',
                height: '40px',
                alignItems: 'center'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveCalendarModalTab('sales')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '8px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeCalendarModalTab === 'sales' ? 'var(--color-surface)' : 'transparent',
                    color: activeCalendarModalTab === 'sales' ? 'var(--color-primary)' : 'var(--color-text-light)',
                    boxShadow: activeCalendarModalTab === 'sales' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '32px',
                    flex: 1
                  }}
                  className=""
                >
                  <span>{t('Dữ liệu nhận (Phân bổ)')}</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: activeCalendarModalTab === 'sales' ? 'rgba(189, 29, 45, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: activeCalendarModalTab === 'sales' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    padding: '1px 6px',
                    borderRadius: '5px',
                    transition: 'all 0.2s'
                  }}>
                    {dayDetails.sales?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCalendarModalTab('tickets')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '8px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeCalendarModalTab === 'tickets' ? 'var(--color-surface)' : 'transparent',
                    color: activeCalendarModalTab === 'tickets' ? 'var(--color-primary)' : 'var(--color-text-light)',
                    boxShadow: activeCalendarModalTab === 'tickets' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '32px',
                    flex: 1
                  }}
                  className=""
                >
                  <span>{t('Ticket lỗi')}</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: activeCalendarModalTab === 'tickets' ? 'rgba(189, 29, 45, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: activeCalendarModalTab === 'tickets' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    padding: '1px 6px',
                    borderRadius: '5px',
                    transition: 'all 0.2s'
                  }}>
                    {dayDetails.tickets?.length || 0}
                  </span>
                </button>
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem 1.5rem' }}>
                {activeCalendarModalTab === 'sales' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {dayDetails.sales && dayDetails.sales.length > 0 ? (
                      dayDetails.sales.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setActiveDetailLead(item);
                            setDetailModalOpen(true);
                          }}
                          style={{
                            padding: '12px 16px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          className="hover-lift"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Avatar name={item.lead_name} size={36} />
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {item.lead_name || t('Ẩn danh')}
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}>
                                  ID: {item.lead_id}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600 }}>{item.phone || t('SĐT đã ẩn')}</span>
                                <span>•</span>
                                <span>Nguồn: <strong>{item.source || t('Chưa rõ')}</strong></span>
                                <span>•</span>
                                <span>Vòng: <strong style={{ color: 'var(--color-primary)' }}>{item.round_name || t('Ngoài vòng')}</strong></span>
                                {item.type && (
                                  <>
                                    <span>•</span>
                                    <span style={{ padding: '0 4px', background: 'rgba(37, 99, 235, 0.06)', color: '#2563eb', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>{item.type}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                              {item.received_at ? new Date(item.received_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            {getStatusBadge(item.status, item.report_status)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                        {t('Không có dữ liệu phân bổ nào trong ngày.')}
                      </div>
                    )}
                  </div>
                )}

                {activeCalendarModalTab === 'tickets' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {dayDetails.tickets && dayDetails.tickets.length > 0 ? (
                      dayDetails.tickets.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            padding: '12px 14px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Avatar name={item.lead_name} size={28} />
                              <div>
                                <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.85rem' }}>
                                  {item.lead_name || t('Ẩn danh')}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 8 }}>
                                  {item.lead_phone}
                                </span>
                              </div>
                            </div>
                            <span style={{
                              padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700,
                              background: item.status === 'approved' ? 'var(--color-success-light)' : item.status === 'approved_no_comp' ? '#dbeafe' : item.status === 'pending' ? '#fef3c7' : 'var(--color-danger-light)',
                              color: item.status === 'approved' ? 'var(--color-success)' : item.status === 'approved_no_comp' ? '#2563eb' : item.status === 'pending' ? '#d97706' : 'var(--color-danger)'
                            }}>
                              {item.status === 'approved' ? t('Đã bù') : item.status === 'approved_no_comp' ? t('Không bù') : item.status === 'pending' ? t('Chờ duyệt') : t('Từ chối')}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', borderLeft: '2px solid var(--color-border)', paddingLeft: 8, fontStyle: 'italic' }}>
                            <strong>{t('Lý do báo lỗi:')}</strong> {item.reason}
                          </div>
                          {item.resolved_by && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Avatar src={item.resolved_by_avatar} name={item.resolved_by} size={16} />
                              <span>
                                <strong>Admin {item.resolved_by}:</strong> {item.reject_reason || item.approval_reason || (item.status === 'approved_no_comp' ? t('Đã duyệt không bù') : t('Đã duyệt đền bù'))}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                        {t('Không có ticket lỗi nào được báo cáo trong ngày.')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </CustomModal>
      )}

      {showWarRoom && (
        <WarRoomFlightDeck
          isOpen={showWarRoom}
          onClose={() => setShowWarRoom(false)}
          stats={null}
          recentLogs={[]}
        />
      )}


      {/* Upcoming Meetings List Modal */}
      <CustomModal
        isOpen={showUpcomingMeetingsModal}
        onClose={() => setShowUpcomingMeetingsModal(false)}
        title={t('Danh Sách Cuộc Hẹn Sắp Diễn Ra')}
        maxWidth={1150}
        zIndex={2000000}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '4px 0' }}>
          {/* Toolbar: Search + Team Filter + Sale Filter + Status Filter + Count Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            width: '100%'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: isMobile ? '100%' : '230px', flexShrink: 0 }}>
              <input
                type="text"
                placeholder={t('Tìm tên khách, SĐT, TVV...')}
                value={meetingSearchText}
                onChange={e => {
                  setMeetingSearchText(e.target.value);
                  setMeetingPage(1);
                }}
                className="form-input"
                style={{ paddingLeft: '14px', paddingRight: '34px', fontSize: '0.825rem', height: '36px', width: '100%' }}
              />
              {meetingSearchText ? (
                <button
                  onClick={() => {
                    setMeetingSearchText('');
                    setMeetingPage(1);
                  }}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                >
                  <X size={14} />
                </button>
              ) : (
                <Search size={15} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              )}
            </div>

            {/* Custom Team Filter Dropdown (Admin / Manager) */}
            {(isUserAdminRole || isUserManagerRole) && (
              <CustomSelect
                options={meetingTeamSelectOptions}
                value={meetingFilterTeamId}
                onChange={(val) => {
                  setMeetingFilterTeamId(String(val));
                  setMeetingFilterSaleId('all');
                  setMeetingPage(1);
                }}
                searchable
                showAvatars
                placeholder={t('Tất cả các Nhóm')}
                width={isMobile ? '100%' : '180px'}
              />
            )}

            {/* Custom Sale / TVV Filter Dropdown (Admin / Manager) */}
            {(isUserAdminRole || isUserManagerRole) && (
              <CustomSelect
                options={meetingSaleSelectOptions}
                value={meetingFilterSaleId}
                onChange={(val) => {
                  setMeetingFilterSaleId(String(val));
                  setMeetingPage(1);
                }}
                searchable
                showAvatars
                placeholder={t('Tất cả Sale / TVV')}
                width={isMobile ? '100%' : '190px'}
              />
            )}

            {/* Status Dropdown */}
            <CustomSelect
              options={meetingStatusSelectOptions}
              value={meetingFilterStatus}
              onChange={(val) => {
                setMeetingFilterStatus(val as any);
                setMeetingPage(1);
              }}
              placeholder={t('Trạng thái')}
              width={isMobile ? '100%' : '170px'}
            />

            {/* Count Indicator */}
            <span style={{
              marginLeft: isMobile ? '0' : 'auto',
              fontSize: '0.8rem',
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
              width: isMobile ? '100%' : 'auto',
              textAlign: isMobile ? 'right' : 'left',
              marginTop: isMobile ? '2px' : '0'
            }}>
              {t('Hiển thị')} {filteredUpcomingMeetingsModalList.length} / {upcomingMeetingsList.length} {t('cuộc hẹn')}
            </span>
          </div>

          {/* Desktop Table Column Header (Hidden on Mobile) */}
          {!isMobile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 16px',
              background: 'var(--color-bg-subtle, rgba(0,0,0,0.02))',
              borderRadius: '8px',
              fontSize: '0.725rem',
              fontWeight: 800,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              gap: '1rem',
              border: '1px solid var(--color-border)'
            }}>
              <div style={{ flex: '1.4', minWidth: '220px' }}>{t('Khách hàng')}</div>
              <div style={{ flex: '1.2', minWidth: '180px' }}>{t('Sale phụ trách')}</div>
              <div style={{ flex: '1.2', minWidth: '170px' }}>{t('Thời gian')}</div>
              <div style={{ width: '130px', flexShrink: 0 }}>{t('Trạng thái')}</div>
              <div style={{ width: '100px', flexShrink: 0, textAlign: 'right' }}>{t('Thao tác')}</div>
            </div>
          )}

          {/* Meeting Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '8px', maxHeight: '58vh', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredUpcomingMeetingsModalList.length === 0 ? (
              <div style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                background: 'var(--color-bg-subtle)',
                borderRadius: '12px',
                border: '1px border-dashed var(--color-border)'
              }}>
                <Calendar size={32} style={{ color: 'var(--color-text-muted)' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('Không có cuộc hẹn gặp nào trong danh sách')}</span>
              </div>
            ) : (
              paginatedUpcomingMeetingsList.map((item: any, idx: number) => {
                const rawCustomerName = item.contact_name || item.lead_name || item.related_name || item.customer_name || 'Khách hàng';
                const customerName = formatVietnameseFullName(rawCustomerName);
                const customerPhone = item.phone || item.contact_phone || item.lead_phone || '';
                const customerAvatar = item.contact_avatar || item.customer_avatar || item.lead_avatar || '';

                const saleName = item.assignee_name || item.user_name || item.created_by_name || item.sale_name || 'Tư vấn viên';
                const saleAvatar = item.assignee_avatar || item.user_avatar || item.sale_avatar || item.created_by_avatar || item.avatar_url || item.avatar || '';

                const dueDateRaw = item.due_date || item.shift_date || item.created_at || '';

                const isDone = checkMeetingIsDone(item);
                const isOverdue = checkMeetingIsOverdue(item);

                // MOBILE CARD VIEW
                if (isMobile) {
                  return (
                    <motion.div
                      key={item.id || idx}
                      whileHover={{ translateY: -1 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => handleOpenCustomerFromMeetingModal(item)}
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '14px',
                        padding: '0.875rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        boxShadow: 'var(--shadow-xs)',
                        cursor: 'pointer'
                      }}
                    >
                      {/* Top Row: Customer Info + Status Pill */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <Avatar name={customerName} src={customerAvatar} size={40} />
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: '0.925rem', fontWeight: 800, color: 'var(--color-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {customerName}
                            </span>
                            {customerPhone && (
                              <span style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                <Phone size={12} />
                                {customerPhone}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div style={{ flexShrink: 0 }}>
                          {isDone ? (
                            <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.725rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                              <CheckCircle2 size={12} /> {t('Đã gặp')}
                            </span>
                          ) : isOverdue ? (
                            <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.725rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>
                              <AlertCircle size={12} /> {t('Quá giờ hẹn')}
                            </span>
                          ) : (
                            <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.725rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB' }}>
                              <Clock size={12} /> {t('Sắp diễn ra')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Line Separator */}
                      <div style={{ height: '1px', background: 'var(--color-border-light)' }} />

                      {/* Middle Row: Meeting Time & Sale in Charge */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignItems: 'center' }}>
                        {/* Time info */}
                        <div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>
                            {getRelativeDateLabel(dueDateRaw) ? t(getRelativeDateLabel(dueDateRaw)) : t('Thời gian')}
                          </span>
                          <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Clock size={12} style={{ color: '#2563EB' }} />
                            {dueDateRaw ? dueDateRaw.replace('T', ' ').slice(0, 16) : t('Chưa xếp giờ')}
                          </span>
                        </div>

                        {/* Sale info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <Avatar name={saleName} src={saleAvatar} size={24} />
                          <div style={{ minWidth: 0, textAlign: 'right' }}>
                            <span style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 600 }}>
                              {t('Sale phụ trách')}
                            </span>
                            <span style={{ fontSize: '0.775rem', fontWeight: 700, color: 'var(--color-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {saleName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button Bar */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                        <button
                          type="button"
                          className="btn sm outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCustomerFromMeetingModal(item);
                          }}
                          style={{
                            width: '100%',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            padding: '7px 12px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Eye size={14} />
                          <span>{t('Xem chi tiết hồ sơ')}</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </motion.div>
                  );
                }

                // DESKTOP TABLE ROW
                return (
                  <motion.div
                    key={item.id || idx}
                    whileHover={{ translateY: -1 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleOpenCustomerFromMeetingModal(item)}
                  >
                    {/* Col 1: Customer Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1.4', minWidth: '220px' }}>
                      <Avatar name={customerName} src={customerAvatar} size={36} />
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--color-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {customerName}
                        </span>
                        {customerPhone && (
                          <span style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                            <Phone size={11} />
                            {customerPhone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Col 2: Sale Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1.2', minWidth: '180px' }}>
                      <Avatar name={saleName} src={saleAvatar} size={26} />
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '0.685rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 600 }}>
                          {t('Sale phụ trách')}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {saleName}
                        </span>
                      </div>
                    </div>

                    {/* Col 3: Clean Time with relative date label above */}
                    <div style={{ flex: '1.2', minWidth: '170px', display: 'flex', flexDirection: 'column' }}>
                      {getRelativeDateLabel(dueDateRaw) && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', lineHeight: 1.2 }}>
                          {t(getRelativeDateLabel(dueDateRaw))}
                        </span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
                        <Clock size={12} style={{ color: 'var(--color-text-muted)' }} />
                        <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)' }}>
                          {dueDateRaw ? dueDateRaw.replace('T', ' ').slice(0, 16) : t('Chưa xếp giờ')}
                        </span>
                      </div>
                    </div>

                    {/* Col 4: Status */}
                    <div style={{ width: '130px', flexShrink: 0 }}>
                      {isDone ? (
                        <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '0.725rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                          <CheckCircle2 size={12} /> {t('Đã gặp')}
                        </span>
                      ) : isOverdue ? (
                        <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '0.725rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                          <AlertCircle size={12} /> {t('Quá giờ hẹn')}
                        </span>
                      ) : (
                        <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '0.725rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563EB' }}>
                          <Clock size={12} /> {t('Sắp diễn ra')}
                        </span>
                      )}
                    </div>

                    {/* Col 5: Action */}
                    <div style={{ width: '100px', flexShrink: 0, textAlign: 'right' }}>
                      <button
                        className="btn sm primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCustomerFromMeetingModal(item);
                        }}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                      >
                        <UserCheck size={12} />
                        <span>{t('Xem hồ sơ')}</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Pagination Bar (20 items / page) */}
          {totalMeetingPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'var(--color-bg-subtle, rgba(0,0,0,0.02))',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              marginTop: '4px'
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {t('Trang')} {meetingPage} / {totalMeetingPages} ({filteredUpcomingMeetingsModalList.length} {t('cuộc hẹn')})
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  disabled={meetingPage <= 1}
                  onClick={() => setMeetingPage(prev => Math.max(prev - 1, 1))}
                  className="btn sm secondary"
                  style={{ padding: '4px 10px', fontSize: '0.775rem', cursor: meetingPage <= 1 ? 'not-allowed' : 'pointer', opacity: meetingPage <= 1 ? 0.5 : 1 }}
                >
                  ‹ {t('Trang trước')}
                </button>

                {Array.from({ length: totalMeetingPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setMeetingPage(p)}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '6px',
                      fontSize: '0.775rem',
                      fontWeight: p === meetingPage ? 800 : 600,
                      border: '1px solid var(--color-border)',
                      background: p === meetingPage ? 'var(--color-primary, #BD1D2D)' : 'var(--color-surface)',
                      color: p === meetingPage ? '#ffffff' : 'var(--color-text)',
                      cursor: 'pointer'
                    }}
                  >
                    {p}
                  </button>
                ))}

                <button
                  disabled={meetingPage >= totalMeetingPages}
                  onClick={() => setMeetingPage(prev => Math.min(prev + 1, totalMeetingPages))}
                  className="btn sm secondary"
                  style={{ padding: '4px 10px', fontSize: '0.775rem', cursor: meetingPage >= totalMeetingPages ? 'not-allowed' : 'pointer', opacity: meetingPage >= totalMeetingPages ? 0.5 : 1 }}
                >
                  {t('Trang sau')} ›
                </button>
              </div>
            </div>
          )}
        </div>
      </CustomModal>

      <CustomerProfileDrawer
        isOpen={!!profileContact}
        onClose={() => {
          setProfileContact(null);
          loadPortalData();
          fetchWorkspaceTasks();
        }}
        contact={profileContact}
        initialTab={profileDrawerTab}
        onUpdate={updated => {
          if (updated === null) {
            setProfileContact(null);
            setData((prev: any) => {
              if (!prev) return prev;
              const next = { ...prev };
              if (next.contacts) {
                next.contacts = next.contacts.filter((c: any) => c.id !== profileContact?.id);
              }
              return next;
            });
            loadPortalData();
            fetchWorkspaceTasks();
            return;
          }
          setProfileContact(updated);
          loadPortalData();
          fetchWorkspaceTasks();
        }}
      />

      {/* Interactive Explanation Modals */}
      <CustomModal
        isOpen={showWorkspaceHelpModal}
        onClose={() => setShowWorkspaceHelpModal(false)}
        title={t("Hướng dẫn sử dụng Bàn làm việc")}
        width="760px"
      >
        <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '0.875rem 1rem', 
            background: 'var(--color-primary-light)', 
            border: '1px solid rgba(163, 20, 34, 0.15)', 
            borderRadius: 12 
          }}>
            <Info size={24} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              {t("Bàn làm việc (Workspace) là trung tâm quản lý tất cả nhiệm vụ và hoạt động cần xử lý của bạn trong ngày. Hệ thống phân loại công việc thành 3 nhóm độc lập:")}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Nhóm 1 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(59, 130, 246, 0.04)' : 'rgba(59, 130, 246, 0.02)', 
              borderLeft: '4px solid #3b82f6', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Users size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("1. Công việc khách hàng (Client Tasks)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Các công việc gắn trực tiếp với hồ sơ khách hàng hoặc deal giao dịch (gọi điện, hẹn gặp, ký cọc...). Bất kỳ cập nhật nào tại đây sẽ đồng bộ trực tiếp vào Nhật ký hoạt động của khách hàng đó.")}
                </p>
              </div>
            </div>

            {/* Nhóm 2 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.02)', 
              borderLeft: '4px solid #10b981', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Building2 size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("2. Công việc nội bộ team (Internal Tasks)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Công việc chung của phòng ban hoặc công ty giao xuống, được phân loại cụ thể thành: Nhiệm vụ (Task nội bộ), Thông báo (Yêu cầu đọc), Chiến dịch (Bán hàng chung) và Chính sách (Quy định cần tuân thủ).")}
                </p>
              </div>
            </div>

            {/* Nhóm 3 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(139, 92, 246, 0.04)' : 'rgba(139, 92, 246, 0.02)', 
              borderLeft: '4px solid #8b5cf6', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <User size={20} color="#8b5cf6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("3. Công việc cá nhân (Personal Tasks)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Nhiệm vụ tự lập để quản lý quỹ thời gian cá nhân của bạn. Chỉ có bạn mới nhìn thấy các công việc này, giúp bạn chủ động ghi chú các đầu việc nhỏ lẻ ngoài lề.")}
                </p>
              </div>
            </div>

            {/* Daily Calls Tracker */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.02)', 
              borderLeft: '4px solid #f59e0b', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Phone size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("Theo dõi cuộc gọi hàng ngày (Calls Completed)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Chỉ số \"Đã gọi\" trên tiêu đề đếm tổng số cuộc gọi mà bạn đã thực hiện và lưu nhật ký thành công trong ngày hôm nay. Bấm vào chỉ số này để xem nhanh danh sách chi tiết các cuộc gọi đó.")}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowWorkspaceHelpModal(false)} style={{ minWidth: 100 }}>{t("Đồng ý")}</button>
        </div>
      </CustomModal>

      <CustomModal
        isOpen={showTicketHelpModal}
        onClose={() => setShowTicketHelpModal(false)}
        title={t("Quy trình Báo cáo lỗi & Đền bù")}
        width="760px"
      >
        <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '0.875rem 1rem', 
            background: 'var(--color-primary-light)', 
            border: '1px solid rgba(163, 20, 34, 0.15)', 
            borderRadius: 12 
          }}>
            <Info size={24} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              {t("Quy trình Báo cáo lỗi giúp bảo vệ quyền lợi của Tư vấn viên khi nhận phải data không liên lạc được, sai số, hoặc thuê bao. Quy trình hoạt động như sau:")}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(239, 68, 68, 0.04)' : 'rgba(239, 68, 68, 0.02)', 
              borderLeft: '4px solid #ef4444', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("1. Gửi báo cáo lỗi (Create Ticket)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Khi phát hiện khách hàng có thông tin lỗi, hãy chọn khách hàng đó và bấm nút \"Báo cáo lỗi\" từ ngăn kéo thông tin. Điền lý do và đính kèm bằng chứng (ví dụ: ảnh chụp màn hình Zalo chặn, lịch sử cuộc gọi rỗng...).")}
                </p>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.02)', 
              borderLeft: '4px solid #f59e0b', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Clock size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("2. Admin xét duyệt (Review & Verification)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Admin sẽ kiểm tra bằng chứng bạn cung cấp. Trạng thái của ticket sẽ chuyển từ \"Chờ duyệt\" sang \"Đã duyệt bù\" hoặc \"Từ chối\" tùy thuộc vào tính xác thực của thông tin lỗi.")}
                </p>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.02)', 
              borderLeft: '4px solid #10b981', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("3. Cơ chế Đền bù (+1 Lead Credit)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Nếu được duyệt đền bù, hệ thống sẽ cộng dồn 1 lượt đền bù vào Round-Robin cho tài khoản của bạn. Trong đợt chia số tiếp theo, bạn sẽ được hệ thống ưu tiên phân phối lead trước để bù lại số lượng đã mất.")}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowTicketHelpModal(false)} style={{ minWidth: 100 }}>{t("Đồng ý")}</button>
        </div>
      </CustomModal>

      <CustomModal
        isOpen={showDatabankSettingsModal}
        onClose={() => setShowDatabankSettingsModal(false)}
        title={t("Cấu hình nhanh Kho Databank")}
        width="620px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.75rem' }}>
              {t("1. Hạn mức nhận số (Claim Limits)")}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>{t("Hạn mức giờ")}</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number"
                    className="form-input"
                    value={dbLimitHour}
                    onChange={e => setDbLimitHour(Number(e.target.value))}
                    min={0}
                    style={{ width: '100%', height: '34px', paddingRight: '2.5rem' }}
                  />
                  <span style={{ position: 'absolute', right: '8px', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>/giờ</span>
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>{t("Hạn mức ngày")}</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number"
                    className="form-input"
                    value={dbLimitDay}
                    onChange={e => setDbLimitDay(Number(e.target.value))}
                    min={0}
                    style={{ width: '100%', height: '34px', paddingRight: '2.5rem' }}
                  />
                  <span style={{ position: 'absolute', right: '8px', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>/ngày</span>
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>{t("Hạn mức tháng")}</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number"
                    className="form-input"
                    value={dbLimitMonth}
                    onChange={e => setDbLimitMonth(Number(e.target.value))}
                    min={0}
                    style={{ width: '100%', height: '34px', paddingRight: '2.5rem' }}
                  />
                  <span style={{ position: 'absolute', right: '8px', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>/tháng</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.75rem' }}>
              {t("2. Thời hạn bảo mật (Security Timers)")}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>{t("Chưa xác định")}</label>
                <input
                  type="text"
                  className="form-input"
                  value={dbTimerChuaXacDinh}
                  onChange={e => setDbTimerChuaXacDinh(e.target.value)}
                  placeholder="Ví dụ: +3 hours"
                  style={{ height: '34px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>{t("Quan tâm")}</label>
                <input
                  type="text"
                  className="form-input"
                  value={dbTimerQuanTam}
                  onChange={e => setDbTimerQuanTam(e.target.value)}
                  placeholder="Ví dụ: +1 day"
                  style={{ height: '34px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>{t("Thiện chí")}</label>
                <input
                  type="text"
                  className="form-input"
                  value={dbTimerThienChi}
                  onChange={e => setDbTimerThienChi(e.target.value)}
                  placeholder="Ví dụ: +3 days"
                  style={{ height: '34px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>{t("Đồng ý gặp")}</label>
                <input
                  type="text"
                  className="form-input"
                  value={dbTimerDongYGap}
                  onChange={e => setDbTimerDongYGap(e.target.value)}
                  placeholder="Ví dụ: +4 days"
                  style={{ height: '34px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>{t("Đã gặp")}</label>
                <input
                  type="text"
                  className="form-input"
                  value={dbTimerDaGap}
                  onChange={e => setDbTimerDaGap(e.target.value)}
                  placeholder="Ví dụ: +5 days"
                  style={{ height: '34px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>{t("Booking")}</label>
                <input
                  type="text"
                  className="form-input"
                  value={dbTimerBooking}
                  onChange={e => setDbTimerBooking(e.target.value)}
                  placeholder="Ví dụ: +3 months"
                  style={{ height: '34px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t("3. Nguồn lead áp dụng ra kho")}</label>
            <input
              type="text"
              className="form-input"
              value={dbApplicableSources}
              onChange={e => setDbApplicableSources(e.target.value)}
              placeholder="Ví dụ: R3_Fb,R3,R2,broadcast"
              style={{ height: '34px' }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
              {t("Các nguồn lead cách nhau bằng dấu phẩy.")}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
            <button className="btn outline" onClick={() => setShowDatabankSettingsModal(false)} disabled={isSavingDbSettings}>{t("Hủy")}</button>
            <button className="btn primary" onClick={handleSaveDatabankSettings} disabled={isSavingDbSettings}>
              {isSavingDbSettings ? t("Đang lưu...") : t("Lưu cấu hình")}
            </button>
          </div>
        </div>
      </CustomModal>

      <CustomModal
        isOpen={showDatabankHelpModal}
        onClose={() => setShowDatabankHelpModal(false)}
        title={t("Quy chế Kho Data Chung & Đồng hồ Bảo mật")}
        width="760px"
      >
        <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '0.875rem 1rem', 
            background: 'var(--color-primary-light)', 
            border: '1px solid rgba(163, 20, 34, 0.15)', 
            borderRadius: 12 
          }}>
            <Info size={24} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              {t("Kho Data Chung (Databank) chứa các khách hàng tiềm năng đã bị thu hồi do quá hạn chăm sóc hoặc bể cọc. Sale có thể chủ động nhận chăm sóc theo các quy định dưới đây:")}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(59, 130, 246, 0.04)' : 'rgba(59, 130, 246, 0.02)', 
              borderLeft: '4px solid #3b82f6', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Scale size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("1. Hạn mức nhận số (Claim Limits)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Để đảm bảo công bằng, mỗi Sale có một hạn mức nhận số từ Databank: tối đa ")}
                  <strong>{sysSettings?.databank_limit_per_hour || 5} {t("số/giờ")}</strong>
                  {t(" và ")}
                  <strong>{sysSettings?.databank_limit_per_day || 10} {t("số/ngày")}</strong>.
                  {t(" Nếu đạt ngưỡng tối đa, bạn cần chờ chu kỳ thời gian tiếp theo để có thể nhận thêm.")}
                </p>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.02)', 
              borderLeft: '4px solid #f59e0b', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Clock size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("2. Đồng hồ bảo mật chăm sóc (Security Timer)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Khi bạn nhận một lead từ Databank, đồng hồ bảo mật bắt đầu đếm ngược (Thời hạn bảo mật trạng thái Booking là ")}
                  <strong>{sysSettings?.security_timer_booking || 120} {t("giờ")}</strong>
                  {t(", Đã Gặp là ")}
                  <strong>{sysSettings?.security_timer_da_gap || 72} {t("giờ")}</strong>
                  {t("). Bạn CẦN thực hiện ít nhất 1 tương tác (gọi điện, tạo note chất lượng, đặt lịch hẹn) trước khi hết hạn. Nếu không tương tác, lead sẽ bị hệ thống TỰ ĐỘNG THU HỒI về lại Databank.")}
                </p>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(239, 68, 68, 0.04)' : 'rgba(239, 68, 68, 0.02)', 
              borderLeft: '4px solid #ef4444', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("3. Quy tắc bể cọc (Deposit Cancellation Policies)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("• Bể cọc chưa phát sinh doanh thu: Trạng thái khách hàng sẽ bị hạ xuống mức Booking hoặc Đã Gặp, đồng hồ bảo mật kích hoạt chạy lại bình thường và có thể bị thu hồi tự động ra Databank.")}
                  <br />
                  {t("• Bể cọc đã phát sinh doanh thu (đóng đợt 1): Khách hàng được giữ nguyên trạng thái Đặt cọc để bảo vệ quyền sở hữu trọn đời của Sale chăm sóc (vì đã phát sinh dòng tiền thực tế).")}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowDatabankHelpModal(false)} style={{ minWidth: 100 }}>{t("Đồng ý")}</button>
        </div>
      </CustomModal>

      {/* Task Details Drawer */}
      <WorkspaceTaskDrawer
        isOpen={!!selectedTaskForDetails && wsViewMode !== 'focus'}
        onClose={() => {
          setSelectedTaskForDetails(null);
          setIsFocusSessionActive(false);
        }}
        task={selectedTaskForDetails}
        onUpdate={() => {
          fetchPortalTasks();
          fetchWorkspaceTasks();
          window.dispatchEvent(new CustomEvent('task-updated'));
        }}
        users={users}
        onOpenContact={(contactId) => {
          setSelectedTaskForDetails(null);
          handleOpenContactProfile(contactId);
        }}
        isFocusSessionActive={isFocusSessionActive}
        focusTaskIndex={focusTaskIndex}
        focusTasksCount={focusTasksList.length}
        onNextFocusTask={handleNextFocusTask}
      />

      {/* 2-Minute Lead Offer Countdown Modal */}
      {activeIncomingOffer && (
        <CustomModal
          isOpen={true}
          onClose={() => {}}
          title={t('🚨 CÓ LEAD MỚI ĐƯỢC PHÂN BỔ!')}
          width="400px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '1rem 0' }}>
            <div style={{ position: 'relative', width: '100px', height: '100px' }}>
              <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="var(--color-border-light)"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="var(--color-danger)"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 44}
                  strokeDashoffset={
                    (2 * Math.PI * 44) * 
                    (1 - Math.max(0, activeIncomingOffer.remainingMs) / (Number(activeIncomingOffer.lead.lead_recall_minutes) * 60 * 1000))
                  }
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--color-danger)',
              }}>
                {(() => {
                  const totalSecs = Math.max(0, Math.floor(activeIncomingOffer.remainingMs / 1000));
                  const mins = Math.floor(totalSecs / 60);
                  const secs = totalSecs % 60;
                  return `${mins}:${String(secs).padStart(2, '0')}`;
                })()}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                {activeIncomingOffer.lead.full_name || t('Khách hàng mới')}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                Nguồn: <strong style={{ color: 'var(--color-primary)' }}>{activeIncomingOffer.lead.source || 'Facebook CAPI'}</strong>
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <AlertTriangle size={12} /> {t('Vui lòng tiếp nhận ngay. Lead sẽ bị thu hồi khi hết giờ!')}
              </p>
            </div>

            <button
              onClick={() => handleAcceptLead(activeIncomingOffer.lead.lead_id)}
              className="btn danger pulsing"
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '22px',
                fontSize: '0.9rem',
                fontWeight: 800,
                boxShadow: '0 4px 15px rgba(189,29,45,0.3)',
              }}
            >
              {t('TIẾP NHẬN LEAD NGAY')}
            </button>
          </div>
        </CustomModal>
      )}

      {/* Task Participants List Modal */}
      {participantsModalOpen && (
        <CustomModal
          isOpen={participantsModalOpen}
          onClose={() => setParticipantsModalOpen(false)}
          title={t('Người liên quan (Participants)')}
          width="400px"
        >
          <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }} className="custom-scrollbar">
              {selectedTaskParticipants.map((pUser) => (
                <div key={pUser.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: '10px' }}>
                  <Avatar src={pUser.avatar_url || pUser.avatar} name={pUser.full_name} size={28} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>{pUser.full_name}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{pUser.email}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button className="btn primary" onClick={() => setParticipantsModalOpen(false)}>{t('Đóng')}</button>
            </div>
          </div>
        </CustomModal>
      )}

      {claimLeadConfirmOpen && (
        <CustomModal
          isOpen={claimLeadConfirmOpen}
          onClose={() => !isClaimingLeadId && setClaimLeadConfirmOpen(false)}
          title={t('Nhận Khách hàng từ Databank')}
          width="460px"
        >
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '24px',
              background: 'var(--color-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
              boxShadow: '0 8px 20px rgba(189, 29, 45, 0.15)',
              marginBottom: '0.5rem'
            }}>
              <Database size={32} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em', margin: 0 }}>
                {t('Xác nhận nhận khách hàng')}
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-light)', lineHeight: 1.5, margin: 0 }}>
                {t('Bạn có chắc chắn muốn nhận khách hàng')} <strong style={{ color: 'var(--color-primary)', fontSize: '0.95rem' }}>{claimLeadPerson?.name}</strong> {t('từ Kho Databank về danh sách quản lý cá nhân của mình?')}
              </p>
            </div>

            <div style={{
              width: '100%',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '14px',
              padding: '1rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('Nguồn dữ liệu:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Kho chung Databank</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('Người nhận:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{currentUser?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('Mức trừ hạn mức:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>1 lượt nhận</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
              <button
                className="btn outline"
                onClick={() => setClaimLeadConfirmOpen(false)}
                disabled={!!isClaimingLeadId}
                style={{ flex: 1, height: '42px', fontWeight: 700 }}
              >
                {t('Hủy bỏ')}
              </button>
              <button
                className="btn primary"
                onClick={handleExecuteClaimLead}
                disabled={!!isClaimingLeadId}
                style={{
                  flex: 1,
                  height: '42px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #d32f2f 100%)',
                  boxShadow: '0 4px 12px rgba(189, 29, 45, 0.25)'
                }}
              >
                {isClaimingLeadId ? t('Đang xử lý...') : t('Nhận Khách')}
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {showCallsModal && (
        <CustomModal
          isOpen={showCallsModal}
          onClose={() => setShowCallsModal(false)}
          title={`${t('Danh sách cuộc gọi')} (${modalCalls.length})`}
          width="680px"
        >
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '400px', maxHeight: '650px' }}>
            {/* Subtabs */}
            <div style={{ display: 'flex', background: 'var(--color-border-light)', borderRadius: '12px', padding: '4px', width: 'fit-content', gap: '4px', alignSelf: 'center' }}>
              <button 
                type="button" 
                onClick={() => setCallsModalTab('chart')} 
                style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, border: 'none', background: callsModalTab === 'chart' ? 'var(--color-surface)' : 'transparent', color: callsModalTab === 'chart' ? 'var(--color-primary)' : 'var(--color-text-light)', boxShadow: callsModalTab === 'chart' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {t("Biểu đồ thống kê")}
              </button>
              <button 
                type="button" 
                onClick={() => setCallsModalTab('detail')} 
                style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, border: 'none', background: callsModalTab === 'detail' ? 'var(--color-surface)' : 'transparent', color: callsModalTab === 'detail' ? 'var(--color-primary)' : 'var(--color-text-light)', boxShadow: callsModalTab === 'detail' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {t("Chi tiết")}
              </button>
            </div>

            {loadingModalCalls ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '1rem' }}>
                <StatRowSkeleton />
                <StatRowSkeleton />
                <StatRowSkeleton />
              </div>
            ) : callsModalTab === 'chart' ? (
              /* Chart Tab */
              <div style={{ height: 320, padding: '1rem' }}>
                {modalChartData.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
                    <Phone size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <span style={{ fontSize: '0.875rem' }}>{t('Chưa có cuộc gọi nào để vẽ biểu đồ.')}</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modalChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} 
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <YAxis 
                        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} 
                        axisLine={false} 
                        tickLine={false} 
                        allowDecimals={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '8px 12px', borderRadius: '8px', boxShadow: 'var(--shadow-md)' }}>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8125rem', color: 'var(--color-text)' }}>{data.name}</p>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                                  {t('Số cuộc gọi:')} <span style={{ fontWeight: 800 }}>{data.calls}</span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="calls" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        <LabelList dataKey="calls" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 700 }} />
                        {modalChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--color-primary)' : '#10b981'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            ) : (
              /* Detail Tab */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflow: 'hidden' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    style={{ paddingLeft: '0.75rem', height: '38px', borderRadius: '10px' }}
                    value={callsSearch}
                    onChange={e => setCallsSearch(e.target.value)}
                    placeholder={t('Tìm theo tên khách hàng, nội dung cuộc gọi...')}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                  {paginatedCalls.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      <Phone size={36} style={{ marginBottom: '8px', opacity: 0.5, marginLeft: 'auto', marginRight: 'auto' }} />
                      <p>{t('Không tìm thấy cuộc gọi nào phù hợp.')}</p>
                    </div>
                  ) : (
                    paginatedCalls.map(call => (
                      <div 
                        key={call.id}
                        style={{
                          padding: '1rem',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '12px',
                          background: 'var(--color-surface)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: 'var(--color-success)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Phone size={14} />
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                              {call.subject || t('Cuộc gọi')}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            {call.due_date ? new Date(call.due_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                          </span>
                        </div>

                        {call.body && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', margin: '4px 0', background: 'var(--color-bg-light)', padding: '8px 10px', borderRadius: '8px', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                            {call.body}
                          </p>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginTop: '2px', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {t('Người thực hiện:')}
                            {(() => {
                              const callUser = users.find((u: any) => String(u.id) === String(call.user_id)) || (String(call.user_id) === String(currentUser?.id) ? currentUser : null);
                              const avatarUrl = callUser?.avatar_url || callUser?.avatar || '';
                              const displayName = call.user_name || callUser?.full_name || currentUser?.name || t('Tư vấn viên');
                              return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text)', fontWeight: 700 }}>
                                  <Avatar src={avatarUrl} name={displayName} size={18} />
                                  {displayName}
                                </span>
                              );
                            })()}
                          </span>
                          {call.related_type === 'contact' && (
                            <button
                              onClick={() => {
                                setShowCallsModal(false);
                                handleOpenContactProfile(call.related_id);
                              }}
                              style={{
                                border: 'none',
                                background: 'none',
                                padding: 0,
                                color: 'var(--color-primary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Users size={12} />
                              {call.contact_name || t('Xem khách hàng')}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {filteredCalls.length > callsModalPageSize && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                    <Pagination
                      total={filteredCalls.length}
                      page={callsModalPage}
                      pageSize={callsModalPageSize}
                      onChange={setCallsModalPage}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </CustomModal>
      )}

      <ConfirmModal
        isOpen={showNightShiftConfirmModal}
        onClose={() => setShowNightShiftConfirmModal(false)}
        onConfirm={() => {
          setShowNightShiftConfirmModal(false);
          handleToggleNightShift();
        }}
        title={nightShiftRegistered ? t('Xác nhận HỦY trực ca đêm') : t('Xác nhận ĐĂNG KÝ trực ca đêm')}
        message={
          nightShiftRegistered
            ? t('Bạn có chắc chắn muốn HỦY đăng ký trực ca đêm hôm nay (22h - 6h) không?')
            : t('Bạn có chắc chắn muốn ĐĂNG KÝ trực ca đêm hôm nay (22h - 6h) để tự động nhận lead mới phân bổ trong ca không?')
        }
        confirmText={nightShiftRegistered ? t('Hủy trực ca đêm') : t('Xác nhận đăng ký')}
        cancelText={t('Quay lại')}
        confirmType={nightShiftRegistered ? 'danger' : 'primary'}
      />

      <SignaturePadModal
        isOpen={showSaleSignatureModal}
        onClose={() => setShowSaleSignatureModal(false)}
        onSave={handleSaveSaleSignature}
        initialSignatureUrl={saleSignatureUrl}
      />

      {/* Google Authenticator Setup Modal */}
      {show2FAConfigModal && (
        <CustomModal
          isOpen={show2FAConfigModal}
          onClose={() => setShow2FAConfigModal(false)}
          title={t("Cấu hình Google Authenticator (2FA)")}
          maxWidth="380px"
        >
          <form onSubmit={handleConfirmEnableTOTP} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0', alignItems: 'center', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {t("Mở ứng dụng Google Authenticator trên điện thoại và quét mã QR bên dưới:")}
            </p>

            {/* QR Card */}
            <div style={{ background: 'white', padding: '12px', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(setup2FAData?.otpauth_url || '')}`}
                alt="2FA QR Code"
                style={{ width: '160px', height: '160px', objectFit: 'contain' }}
              />
            </div>

            {/* Manual Secret Key */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Hoặc nhập khóa thủ công:")}</span>
              <div style={{ background: 'var(--color-bg-alt)', padding: '6px 14px', borderRadius: '8px', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '1px', userSelect: 'all', border: '1px solid var(--color-border-light)' }}>
                {setup2FAData?.secret}
              </div>
            </div>

            <div style={{ width: '100%', height: '1px', background: 'var(--color-border-light)', margin: '0.25rem 0' }} />

            {/* Step 2: 6 Pin Input */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {t("Nhập mã 6 chữ số từ ứng dụng để xác nhận")}
              </label>
              <DigitPinInput
                value={test2FACode}
                onChange={setTest2FACode}
                align="center"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%', marginTop: '0.25rem' }}>
              <button
                type="button"
                className="btn outline sm"
                onClick={() => setShow2FAConfigModal(false)}
                disabled={enabling2FA}
              >
                {t("Hủy")}
              </button>
              <button
                type="submit"
                className="btn primary sm"
                disabled={enabling2FA || test2FACode.length < 6}
              >
                {enabling2FA ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                {t("Kích hoạt Google Authenticator")}
              </button>
            </div>
          </form>
        </CustomModal>
      )}

      {/* Disable 2FA Modal */}
      {showDisable2FAModal && (
        <CustomModal
          isOpen={showDisable2FAModal}
          onClose={() => setShowDisable2FAModal(false)}
          title={t("Tắt Xác thực 2 yếu tố (2FA)")}
          maxWidth="500px"
        >
          <form onSubmit={handleDisable2FA} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              {t("Vui lòng nhập mật khẩu hiện tại của bạn để xác nhận tắt tính năng bảo mật 2FA.")}
            </p>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t("Mật khẩu hiện tại")}</label>
              <input
                type="password"
                className="form-input"
                value={disable2FAPassword}
                onChange={e => setDisable2FAPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn outline sm"
                onClick={() => setShowDisable2FAModal(false)}
                disabled={disabling2FA}
              >
                {t("Hủy")}
              </button>
              <button
                type="submit"
                className="btn danger sm"
                disabled={disabling2FA || !disable2FAPassword}
              >
                {disabling2FA ? <Loader2 size={14} className="spin" /> : <LockIcon size={14} />}
                {t("Xác nhận tắt 2FA")}
              </button>
            </div>
          </form>
        </CustomModal>
      )}

      {/* Weekly Shift Confirmation Modal */}
      {showWeeklyConfirmModal && (
        <CustomModal
          isOpen={showWeeklyConfirmModal}
          onClose={() => setShowWeeklyConfirmModal(false)}
          title={t("Xác Nhận Đăng Ký Lịch Trực Tuần")}
          maxWidth="540px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0.25rem 0' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
              {t("Vui lòng kiểm tra chi tiết danh sách lịch trực bạn đã chọn cho 7 ngày tới trước khi gửi xác nhận:")}
            </p>

            {/* List of 7 days */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {getWeekDates().map((day) => {
                const reg = weeklyRegistrations.find(r => r.shift_date === day.date);
                const isNightRegistered = Boolean(
                  (reg && (reg.shift_type === 'night' || reg.is_night === 1 || reg.is_night === true || String(reg.note || '').toLowerCase().includes('đêm'))) ||
                  (nightShiftRegistered && nightShiftDate === day.date) ||
                  (data.consultant_profile?.night_shifts && data.consultant_profile.night_shifts.some((ns: any) => ns.shift_date === day.date))
                );
                const isWeekend = Boolean(
                  (day.name && (day.name.includes('7') || day.name.includes('Bảy') || day.name.includes('Sat') || day.name.includes('CN') || day.name.includes('Chủ') || day.name.includes('Sun'))) ||
                  day.dayIndex === 6 || day.dayIndex === 0
                );
                const isSelected = weeklyShiftDates.includes(day.date) || isNightRegistered || Boolean(reg);

                let statusLabel = t('Nghỉ');
                let statusBadgeColor = 'var(--color-text-muted)';
                let statusBadgeBg = 'rgba(100, 116, 139, 0.08)';

                if (isNightRegistered) {
                  statusLabel = t('Trực đêm');
                  statusBadgeColor = '#8b5cf6';
                  statusBadgeBg = 'rgba(139, 92, 246, 0.12)';
                } else if (isSelected || reg) {
                  if (isWeekend) {
                    statusLabel = t('Đăng ký (Cuối tuần)');
                    statusBadgeColor = '#dc2626';
                    statusBadgeBg = 'rgba(239, 68, 68, 0.12)';
                  } else {
                    statusLabel = t('Đăng ký (Ngày thường)');
                    statusBadgeColor = '#d97706';
                    statusBadgeBg = 'rgba(245, 158, 11, 0.15)';
                  }
                }

                return (
                  <div
                    key={day.date}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: isSelected ? 'var(--color-surface)' : 'var(--color-bg-alt)',
                      border: isSelected ? '1px solid var(--color-border-light)' : '1px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {day.name}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        ({new Date(day.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })})
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: statusBadgeColor,
                      background: statusBadgeBg,
                      padding: '3px 10px',
                      borderRadius: '6px'
                    }}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Warning note */}
            <div style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.78rem',
              color: '#b45309'
            }}>
              <AlertCircle size={15} color="#d97706" style={{ flexShrink: 0 }} />
              <span>{t('Lịch đăng ký làm việc sẽ được gửi hệ thống xác nhận và phân bổ xoay ca.')}</span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn outline sm"
                onClick={() => setShowWeeklyConfirmModal(false)}
                disabled={weeklySubmitting}
              >
                {t('Hủy / Kiểm tra lại')}
              </button>
              <button
                type="button"
                className="btn primary sm"
                onClick={executeSubmitWeeklyShifts}
                disabled={weeklySubmitting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                {weeklySubmitting ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />}
                {t('Xác Nhận & Gửi Đăng Ký')}
              </button>
            </div>
          </div>
        </CustomModal>
      )}
    </div>
  );
};

export const SalePortal = SalePortalInner;
