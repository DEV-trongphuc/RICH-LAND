import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LogOut, Search, Filter, AlertCircle, CheckCircle2,
  XCircle, Clock, FileText,
  Clock3, GitBranch, ArrowUpRight, ShieldAlert, Send,
  Sun, Moon, ChevronDown, AlertTriangle, ChevronLeft, ChevronRight,
  LayoutDashboard, Database, Ticket, Calendar, RefreshCw, Menu, Tag, Server, Scale, Settings
} from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart,
  PieChart, Pie, Cell
} from 'recharts';
import toast from 'react-hot-toast';
import { fetchAPI } from '../utils/api';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useLanguage } from '../contexts/LanguageContext';
import { Avatar } from '../components/ui/Avatar';
import { TableSkeleton, StatRowSkeleton } from '../components/ui/Skeleton';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { FairShareAudit } from './FairShareAudit';
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

export const SalePortal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, login, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();

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
    const localTheme = localStorage.getItem('domation_theme') as 'light' | 'dark';
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
      localStorage.setItem('domation_theme', nextTheme);
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
      localStorage.setItem('domation_theme', nextTheme);
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
          duration: 30000,
          easing: 'linear',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };


  // Parse initial search query from email link
  const getInitialSearch = () => {
    const params = new URLSearchParams(location.search);
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
  const [now, setNow] = useState(Date.now());
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
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filters
  const [search, setSearch] = useState(getInitialSearch());
  const [searchInput, setSearchInput] = useState(getInitialSearch());
  const [roundId, setRoundId] = useState('');
  const [saleIdFilter, setSaleIdFilter] = useState('');
  const [dateMode, setDateMode] = useState('this_month'); // all, today, yesterday, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [flowViewMode, setFlowViewMode] = useState<'day' | 'hour'>('day');
  const [currentPage, setCurrentPage] = useState(1);

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

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeDetailLead, setActiveDetailLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Tab & Layout states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'tickets' | 'schedule' | 'calendar' | 'fair-share'>('dashboard');
  const [sourceViewMode, setSourceViewMode] = useState<'connection' | 'lead'>('connection');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [vacationConfirmOpen, setVacationConfirmOpen] = useState(false);

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
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editWorkStartTime, setEditWorkStartTime] = useState('08:00');
  const [editWorkEndTime, setEditWorkEndTime] = useState('17:30');
  const [editWorkSchedule, setEditWorkSchedule] = useState<any>(DEFAULT_SCHEDULE);
  const [scheduleMode, setScheduleMode] = useState<'daily' | 'custom'>('daily');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Impersonation role calculation for admin viewing sale
  const impersonatedSale = (user?.role === 'admin' && saleIdFilter)
    ? data.consultants?.find((c: any) => String(c.id) === String(saleIdFilter))
    : null;

  const displayUser = impersonatedSale ? {
    ...user,
    name: impersonatedSale.name,
    avatar: impersonatedSale.avatar || null,
    email: impersonatedSale.email || '',
    role: 'sale',
    consultant_id: impersonatedSale.id
  } : user;

  const effectiveRole = displayUser?.role;

  // Tickets states & loading logic
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
  const [ticketDateFilter, setTicketDateFilter] = useState('Tất cả');
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketTotalCount, setTicketTotalCount] = useState(0);
  const TICKET_ITEMS_PER_PAGE = 10;
  const ticketTotalPages = Math.ceil(ticketTotalCount / TICKET_ITEMS_PER_PAGE);

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
    try {
      const res = await fetch('https://open.domation.net/sale_data/api.php?action=login_google_sale', {
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
          { theme: 'outline', size: 'large', width: 300, text: 'signin_with', shape: 'rectangular' }
        );
        renderedRef.current = true;
        clearInterval(intervalId);
      }
    };

    initGoogle();
    intervalId = setInterval(initGoogle, 500);
    return () => clearInterval(intervalId);
  }, [user]);

  // Fetch portal data when token is valid
  const loadPortalData = async () => {
    if (!token || !['sale', 'admin', 'assistant', 'viewer'].includes(user?.role || '')) return;
    setLoading(true);
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
        toast.error(json.message || t('Không thể tải dữ liệu'));
      }
    } catch (err: any) {
      if (err.message !== 'Unauthorized') {
        toast.error(t('Lỗi tải dữ liệu: ') + err.message);
      }
    }
    setLoading(false);
  };

  const handleTogglePortalVacation = async () => {
    try {
      const json = await fetchAPI('toggle_consultant_vacation', {
        method: 'POST',
        body: JSON.stringify({ id: displayUser?.consultant_id })
      });
      if (json.success) {
        toast.success(t('Đã thay đổi trạng thái Tạm ngưng'));
        setPortalVacationMode(Boolean(Number(json.vacation_mode)));
      } else {
        toast.error(json.message || t('Lỗi thay đổi trạng thái'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
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
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    }
  };

  useEffect(() => {
    if (data.consultant_profile) {
      setEditName(data.consultant_profile.name || '');
      setEditAvatar(data.consultant_profile.avatar || '');
      setEditWorkStartTime(data.consultant_profile.work_start_time || '08:00');
      setEditWorkEndTime(data.consultant_profile.work_end_time || '17:30');
      
      const schedule = data.consultant_profile.work_schedule;
      if (schedule && Object.keys(schedule).length > 0) {
        setEditWorkSchedule(schedule);
        setScheduleMode('custom');
      } else {
        setEditWorkSchedule(DEFAULT_SCHEDULE);
        setScheduleMode('daily');
      }
    }
  }, [data.consultant_profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);

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

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast.error(t('Tên không được để trống.'));
      return;
    }
    setSavingProfile(true);
    try {
      const payload = {
        consultant_id: displayUser?.role === 'sale' ? displayUser?.consultant_id : (data.consultant_profile?.id || null),
        name: editName.trim(),
        avatar: editAvatar,
        work_start_time: editWorkStartTime,
        work_end_time: editWorkEndTime,
        work_schedule: scheduleMode === 'custom' ? editWorkSchedule : null
      };

      const res = await fetchAPI('update_consultant_self_profile', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        toast.success(t('Cập nhật thông tin tài khoản thành công!'));
        loadPortalData();
      } else {
        toast.error(res.message || t('Lỗi lưu cài đặt tài khoản'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối lưu thiết lập: ') + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, [token, user, roundId, dateMode, saleIdFilter, search, startDate, endDate]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearch(searchInput);
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
      if (displayUser?.role === 'sale') {
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
      if (displayUser?.role === 'sale') {
        consultantParam = displayUser.name;
      }
      const json = await fetchAPI(`get_calendar_day_details&date=${dateStr}&consultant=${encodeURIComponent(consultantParam)}`);
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
    setSearch(searchInput);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setSearch(searchInput);
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
        sale_id: displayUser?.role === 'sale' ? displayUser?.consultant_id : selectedLead.assigned_to,
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
      data.leads.forEach((lead: any) => {
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

  const [statusFilter, setStatusFilter] = useState('all');

  const getStatusBadge = (status: string, reportStatus?: string, aiScreenerStatus?: string, createdAt?: string) => {
    if (status === 'assigned' && reportStatus === 'pending') {
      return <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', border: '1px solid rgba(99, 102, 241, 0.2)' }}>{t('Ticket Review')}</span>;
    }
    if (status === 'error' && reportStatus === 'approved') {
      return <span className="badge warning">{t('Ticket')}</span>;
    }
    if (status === 'pending_approval' && aiScreenerStatus === 'pending') {
      const nowTime = new Date();
      const created = createdAt ? parseServerDate(createdAt) : nowTime;
      const diffMins = (nowTime.getTime() - created.getTime()) / 60000;
      if (diffMins >= -2 && diffMins < 5) {
        return <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', border: '1px solid rgba(99, 102, 241, 0.2)' }}>{t('Chờ AI đánh giá')}</span>;
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
      case 'fallback': return <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}>{t('Fallback')}</span>;
      default: return null;
    }
  };

  const filteredLeads = data.leads.filter((lead: any) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'assigned') {
        if (!['assigned', 'rule_6_month', 'pending_work_hours', 'fallback'].includes(lead.status) || lead.report_status) return false;
      } else if (statusFilter === 'compensation') {
        if (lead.status !== 'compensation' || lead.report_status) return false;
      } else if (statusFilter === 'reminder') {
        if (lead.status !== 'reminder') return false;
      } else if (statusFilter === 'pending_ticket') {
        if (lead.report_status !== 'pending') return false;
      } else if (statusFilter === 'approved_ticket') {
        if (lead.report_status !== 'approved') return false;
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
  if (!token || !['sale', 'admin', 'assistant', 'viewer'].includes(user?.role || '')) {
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
          background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%', filter: 'blur(60px)', animation: 'float 12s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%', width: '60vw', height: '60vw',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%', filter: 'blur(80px)', animation: 'float 15s ease-in-out infinite reverse'
        }} />

        <div style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 450,
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
          padding: '3rem 2rem',
          textAlign: 'center'
        }}>
          {/* Header/Logo */}
          <div style={{
            width: 64, height: 64, margin: '0 auto 1.5rem', borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124,58,237,0.3)', overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.9)'
          }}>
            <img
              src="https://crm-domation.vercel.app/LOGO.jpg"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo"
            />
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
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
            ) : user && !['sale', 'admin', 'assistant', 'viewer'].includes(user.role) ? (
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
 
                {googleLoading && <div style={{ fontSize: '0.85rem', color: '#6366f1' }}>{t('Đang kết nối Google API...')}</div>}
 
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
            {t('Hệ thống Quản lý Domation DATA')} &copy; 2026
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
  const renderDashboardView = () => {
    const kpis = [
      { key: 'data', status: 'all', label: t('DATA KHÁCH HÀNG'), value: data.stats.total_received, sub: t('Tổng nhận được bàn giao'), color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)', icon: FileText },
      { key: 'tickets', status: 'pending', label: t('TICKET BÁO LỖI'), value: data.stats.tickets_total, sub: `${data.stats.tickets_pending} đang chờ duyệt`, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', icon: AlertCircle },
      { key: 'data', status: 'approved_ticket', label: t('ĐÃ DUYỆT BÙ'), value: data.stats.tickets_approved, sub: t('Hợp lệ & Đã được bù'), color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', icon: CheckCircle2 },
      { key: 'data', status: 'rejected_ticket', label: t('TỪ CHỐI BÙ'), value: data.stats.tickets_rejected, sub: t('Bị từ chối / Không đền bù'), color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', icon: XCircle }
    ];

    const recentLeads = data.leads.slice(0, 5);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Dashboard header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>{t("Tổng quan Phân bổ Data")}</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>{t("Phân tích hiệu suất giao data theo thời gian thực — Hệ thống đang hoạt động trơn tru.")}</p>
          </div>
          <div className="mobile-w-full" style={{ display: 'flex', gap: '8px', alignItems: 'center', width: 'auto', flexWrap: 'wrap' }}>
            <div className="mobile-flex-1" style={{ position: 'relative', zIndex: 100, width: 200 }}>
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
            {/* Button to open Connection Health Modal */}
            <button
              className="btn outline"
              onClick={() => {}}
              title={t("Kiểm tra kết nối hệ thống")}
              style={{ width: 38, height: 38, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', color: 'var(--color-text-light)', cursor: 'default' }}
            >
              <Server size={16} />
            </button>
            <button
              className="btn outline"
              onClick={() => loadPortalData()}
              disabled={loading}
              title={t("Làm mới dữ liệu")}
              style={{ width: 38, height: 38, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', color: 'var(--color-text-light)', cursor: 'pointer' }}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
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
              onClick={loadPortalData}
              className="btn sm primary"
              style={{ height: 38, padding: '0 15px', borderRadius: '10px' }}
            >
              {t('Áp dụng')}
            </button>
          </div>
        )}

        {/* KPI Cards Grid */}
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '1.25rem' }}>
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className="stat-card hover-lift"
                style={{ minHeight: '140px', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                onClick={() => {
                  if (kpi.key === 'data') {
                    setStatusFilter(kpi.status);
                    setActiveTab('data');
                  } else if (kpi.key === 'tickets') {
                    setTicketStatusFilter(kpi.status);
                    setActiveTab('tickets');
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>{kpi.label}</span>
                  <div className="stat-icon" style={{ color: kpi.color, opacity: 0.8 }}><Icon size={20} /></div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)' }}>{kpi.value}</div>
                  <div className="stat-desc" style={{ color: 'var(--color-text-muted)', marginTop: 'auto', fontWeight: 500, fontSize: '0.75rem' }}>
                    {kpi.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Row 1: Charts & Recent Leads feed */}
        <div className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '6fr 4fr', gap: '1.25rem' }}>
          {/* Chart Left (Performance) */}
          <div className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
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
              {recentLeads.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {recentLeads.map((lead: any) => (
                    <div key={lead.log_id} className="hover-lift" style={{
                      padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'background 0.2s',
                      borderBottom: '1px solid var(--color-border-light)'
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => {
                        setActiveDetailLead(lead);
                        setDetailModalOpen(true);
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
                  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1'];
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
                <GitBranch size={18} color="#8b5cf6" /> {t('Tỷ lệ Nguồn Data')}
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
                  data.leads.forEach((lead: any) => {
                    const name = lead.connection_name || t('Nhập tay');
                    counts[name] = (counts[name] || 0) + 1;
                  });
                  const colors = ['#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#06b6d4'];
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
                  data.leads.forEach((lead: any) => {
                    const name = lead.source?.trim() || t('Không xác định');
                    counts[name] = (counts[name] || 0) + 1;
                  });
                  const colors = ['#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#06b6d4'];
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
            <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--color-text-muted)' }} />
            <input
              className="form-input"
              placeholder={t("Tìm theo tên, SĐT, email...")}
              style={{ paddingLeft: 36, width: '100%', height: 38, fontSize: '0.875rem' }}
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
                { value: 'reminder', label: t('Nhắc lại') },
                { value: 'pending_ticket', label: t('Ticket chờ duyệt') },
                { value: 'approved_ticket', label: t('Ticket đã bù') },
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
                        setActiveDetailLead(lead);
                        setDetailModalOpen(true);
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
                          <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca', fontSize: '0.675rem', fontWeight: 700 }}>
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

                      {((effectiveRole === 'sale' && !Number(lead.is_accepted) && Number(lead.lead_recall_minutes) > 0) || lead.report_status || (isAllowedToReport && 
                        (!data.below_standard_fallback_round_ids || !data.below_standard_fallback_round_ids.includes(Number(lead.round_id))) && 
                        (!data.below_standard_fallback_round_id || Number(lead.round_id) !== Number(data.below_standard_fallback_round_id)))) && (
                        <div onClick={e => e.stopPropagation()} style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                          {effectiveRole === 'sale' && !Number(lead.is_accepted) && Number(lead.lead_recall_minutes) > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {(() => {
                                const leadRecallMins = Number(lead.lead_recall_minutes) || 0;
                                const limitMs = leadRecallMins * 60 * 1000;
                                const elapsedMs = now - new Date(lead.last_interaction_date).getTime();
                                const remainingMs = limitMs - elapsedMs;

                                if (leadRecallMins > 0 && remainingMs <= 0) {
                                  return <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>{t('Quá hạn')}</span>;
                                }

                                const formatTime = (ms: number) => {
                                  const totalSecs = Math.max(0, Math.floor(ms / 1000));
                                  const mins = Math.floor(totalSecs / 60);
                                  const secs = totalSecs % 60;
                                  return `${mins}:${String(secs).padStart(2, '0')}`;
                                };

                                return (
                                  <>
                                    {leadRecallMins > 0 && (
                                      <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Clock size={12} /> {formatTime(remainingMs)}
                                      </span>
                                    )}
                                    <button onClick={() => handleAcceptLead(lead.lead_id)} className="btn sm primary" style={{ height: 30, padding: '0 10px' }}>
                                      {t('Tiếp nhận')}
                                    </button>
                                  </>
                                );
                              })()}
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
                            {lead.report_status === 'rejected' && (
                              <span className="badge danger" title={t("Từ chối")} onClick={() => { setActiveDetailLead(lead); setDetailModalOpen(true); }}>
                                {t('Từ chối')}
                              </span>
                            )}
                            {!lead.report_status && isAllowedToReport && lead.status !== 'reminder' &&
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
                <table style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('KHÁCH HÀNG')}</th>
                      <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('LIÊN HỆ')}</th>
                      <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('TRẠNG THÁI')}</th>
                      <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('PHÂN BỔ CHO')}</th>
                      <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('NGUỒN / PHÂN LOẠI')}</th>
                      <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('THỜI GIAN NHẬN')}</th>
                      <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700, textAlign: 'center' }}>{t('TICKET')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLeads.map((lead: any) => (
                      <tr
                        key={lead.log_id}
                        onClick={() => {
                          setActiveDetailLead(lead);
                          setDetailModalOpen(true);
                        }}
                        style={{
                          borderBottom: '1px solid var(--color-border-light)',
                          background: 'var(--color-surface)',
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Avatar name={lead.lead_name || t('Khách hàng')} size={32} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                                {lead.lead_name || t('Chưa cập nhật')}
                              </span>
                            </div>

                            {effectiveRole === 'sale' && !Number(lead.is_accepted) && Number(lead.lead_recall_minutes) > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                {(() => {
                                  const leadRecallMins = Number(lead.lead_recall_minutes) || 0;
                                  const limitMs = leadRecallMins * 60 * 1000;
                                  const elapsedMs = now - new Date(lead.last_interaction_date).getTime();
                                  const remainingMs = limitMs - elapsedMs;

                                  if (leadRecallMins > 0 && remainingMs <= 0) {
                                    return <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>{t('Quá hạn')}</span>;
                                  }

                                  const formatTime = (ms: number) => {
                                    const totalSecs = Math.max(0, Math.floor(ms / 1000));
                                    const mins = Math.floor(totalSecs / 60);
                                    const secs = totalSecs % 60;
                                    return `${mins}:${String(secs).padStart(2, '0')}`;
                                  };

                                  return (
                                    <>
                                      {leadRecallMins > 0 && (
                                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <Clock size={12} /> {formatTime(remainingMs)}
                                        </span>
                                      )}
                                      <button onClick={() => handleAcceptLead(lead.lead_id)} className="btn sm primary" style={{ height: 30 }}>
                                        {t('Tiếp nhận')}
                                      </button>
                                    </>
                                  );
                                })()}
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

                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{lead.phone}</span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{lead.lead_email || '—'}</span>
                          </div>
                        </td>

                        <td style={{ padding: '1rem 1.25rem' }}>
                          {getStatusBadge(lead.status, lead.report_status)}
                        </td>

                        <td style={{ padding: '1rem 1.25rem' }}>
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

                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ color: 'var(--color-text-light)', fontSize: '0.8rem', fontWeight: 500 }}>{lead.source || 'N/A'}</span>
                            {lead.type && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{lead.type}</span>}
                          </div>
                        </td>

                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            <span>{lead.received_at ? new Date(lead.received_at).toLocaleString('vi-VN') : '—'}</span>
                            {lead.status === 'compensation' && (
                              <span style={{ alignSelf: 'flex-start', padding: '2px 6px', borderRadius: '4px', background: '#d1fae5', color: '#065f46', fontSize: '0.7rem', fontWeight: 700 }}>
                                {t('Data bù')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
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
                            {lead.report_status === 'rejected' && (
                              <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'var(--color-danger-light)', color: 'var(--color-danger)' }} title={t("Từ chối")}>
                                <XCircle size={16} />
                              </div>
                            )}
                            {!lead.report_status && isAllowedToReport && lead.status !== 'reminder' && 
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

  const renderTicketsView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Ticket Filters Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1rem 1.5rem'
        }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{t('DANH SÁCH BÁO CÁO LỖI')}</h3>
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
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
                <span>{t('Không tìm thấy ticket nào.')}</span>
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
                background: theme === 'dark' ? 'var(--color-primary-light)' : '#f5f3ff',
                color: theme === 'dark' ? 'var(--color-primary)' : '#7c3aed',
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
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7c3aed' }}></span>
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
    );
  };

  const renderScheduleView = () => {
    const profile = data.consultant_profile;
    if (!profile) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          {t('Đang tải thông tin lịch làm việc...')}
        </div>
      );
    }

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

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1.5rem 0' }}>
        {/* Header Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
            {t('QUẢN LÝ TÀI KHOẢN')}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', margin: 0 }}>
            {t('Cấu hình thông tin cá nhân, ảnh đại diện và thời gian trực nhận lead tự động.')}
          </p>
        </div>

        {/* 2-Column Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          
          {/* LEFT COLUMN: Profile Card & Action Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Profile Detail Settings Card */}
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 1.5rem 0', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={20} color="var(--color-primary)" />
                {t('THÔNG TIN CÁ NHÂN')}
              </h3>

              {/* Avatar Section */}
              <div style={{ position: 'relative', display: 'inline-flex', marginBottom: '1.5rem' }}>
                <div style={{
                  border: '3px solid var(--color-primary-light)',
                  borderRadius: '50%',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--color-surface)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                }}>
                  <Avatar src={editAvatar} name={editName} size={110} />
                </div>
                
                {/* Upload Trigger Input */}
                <label style={{
                  position: 'absolute', bottom: 4, right: 4,
                  background: 'var(--color-primary)', color: 'white',
                  width: 34, height: 34, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                  transition: 'all 0.2s', border: '2px solid var(--color-surface)'
                }} className="hover-lift active-press" title={t('Tải lên ảnh đại diện mới')}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                </label>

                {isUploadingAvatar && (
                  <div style={{
                    position: 'absolute', inset: 4, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(2px)'
                  }}>
                    <RefreshCw className="spin" size={24} color="white" />
                  </div>
                )}
              </div>
              
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem', textAlign: 'center' }}>
                {t('Chấp nhận ảnh JPG, PNG, GIF, WEBP. Tối đa 5MB.')}
              </span>

              {/* Form Input fields */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Họ và tên')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t('Nhập tên đầy đủ')}
                    style={{ fontWeight: 600 }}
                  />
                </div>

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

                {/* Save Button */}
                <button
                  className="btn primary"
                  style={{ width: '100%', marginTop: '1rem', height: '46px' }}
                  onClick={handleSaveProfile}
                  disabled={savingProfile || isUploadingAvatar}
                >
                  {savingProfile ? (
                    <>
                      <RefreshCw size={18} className="spin" />
                      {t('Đang lưu thiết lập...')}
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                      </svg>
                      {t('Lưu thiết lập')}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Leave (Nghỉ phép) registration card */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="var(--color-warning)" />
                {t('ĐĂNG KÝ NGHỈ PHÉP (LEAVE)')}
              </h3>

              {profile.leave_start || profile.leave_end ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{t('Từ ngày:')}</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                      {profile.leave_start ? new Date(profile.leave_start).toLocaleDateString('vi-VN') : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{t('Đến ngày:')}</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                      {profile.leave_end ? new Date(profile.leave_end).toLocaleDateString('vi-VN') : '—'}
                    </span>
                  </div>
                  <div style={{
                    padding: '8px 12px', borderRadius: 8, textAlign: 'center', fontWeight: 700, fontSize: '0.8rem',
                    background: onLeave ? 'var(--color-warning-light)' : 'var(--color-success-light)',
                    color: onLeave ? 'var(--color-warning)' : 'var(--color-success)'
                  }}>
                    {onLeave ? t('ĐANG TRONG KỲ NGHỈ PHÉP') : t('LỊCH NGHỈ PHÉP SẮP TỚI / ĐÃ QUA')}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  {t('Không có đăng ký nghỉ phép nào.')}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Vacation Toggle & Work Hour Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Vacation Status Card */}
            <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock3 size={20} color="var(--color-primary)" />
                    {t('TRẠNG THÁI NHẬN DATA')}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
                    {t('Khi kích hoạt, hệ thống sẽ tự động phân bổ khách hàng mới cho bạn theo vòng chia.')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    fontSize: '0.9rem', fontWeight: 800,
                    color: !portalVacationMode && !onLeave ? 'var(--color-success)' : 'var(--color-warning)'
                  }}>
                    {!portalVacationMode && !onLeave ? t('Sẵn sàng') :
                     onLeave ? t('Nghỉ phép') : t('Tạm ngưng')}
                  </span>
                  {effectiveRole === 'sale' && (
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
                  background: 'var(--color-warning-light)', color: 'var(--color-warning)', padding: '12px 16px',
                  borderRadius: '10px', border: '1px solid currentColor', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <AlertTriangle size={16} />
                  <span>{t('Bạn hiện đang trong thời gian nghỉ phép. Hệ thống tự động khóa chế độ nhận data cho đến khi kết thúc kỳ nghỉ.')}</span>
                </div>
              )}
            </div>

            {/* Combined Work Hours & Schedule Card */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={18} color="var(--color-primary)" />
                  {t('GIỜ LÀM VIỆC & LỊCH TRÌNH')}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
                  {t('Thiết lập thời gian nhận lead cố định hàng ngày hoặc lịch trình tùy chỉnh theo từng thứ.')}
                </p>
              </div>

              {/* Segmented Control for Schedule Mode */}
              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-bg)', padding: '4px', borderRadius: '12px' }}>
                <button
                  type="button"
                  onClick={() => setScheduleMode('daily')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem',
                    background: scheduleMode === 'daily' ? (theme === 'dark' ? 'var(--color-surface)' : 'white') : 'transparent',
                    color: scheduleMode === 'daily' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: scheduleMode === 'daily' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                  }}
                >{t('Cố định hàng ngày')}</button>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleMode('custom');
                    if (!editWorkSchedule) {
                      setEditWorkSchedule(DEFAULT_SCHEDULE);
                    }
                  }}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem',
                    background: scheduleMode === 'custom' ? (theme === 'dark' ? 'var(--color-surface)' : 'white') : 'transparent',
                    color: scheduleMode === 'custom' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: scheduleMode === 'custom' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                  }}
                >{t('Tùy chỉnh (Thứ 2 - CN)')}</button>
              </div>

              {scheduleMode === 'daily' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'slideUp 0.15s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                        {t('Bắt đầu làm việc')}
                      </label>
                      <input
                        type="time"
                        className="form-input"
                        value={editWorkStartTime}
                        onChange={(e) => setEditWorkStartTime(e.target.value)}
                        style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', letterSpacing: '0.05em' }}
                      />
                    </div>
                    <div style={{ fontSize: '1.5rem', color: 'var(--color-text-muted)', paddingTop: '20px' }}>→</div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                        {t('Kết thúc làm việc')}
                      </label>
                      <input
                        type="time"
                        className="form-input"
                        value={editWorkEndTime}
                        onChange={(e) => setEditWorkEndTime(e.target.value)}
                        style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', letterSpacing: '0.05em' }}
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                    💡 {t('Lưu ý: Lead mới sẽ chỉ được phân bổ tự động cho bạn trong khoảng thời gian làm việc đã thiết lập.')}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'slideUp 0.15s ease-out' }}>
                  {Object.entries(DAY_LABELS).map(([dayKey, dayLabel]) => {
                    const config = editWorkSchedule[dayKey] || { active: true, start: editWorkStartTime, end: editWorkEndTime };
                    const isActive = config.active;

                    return (
                      <div
                        key={dayKey}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--color-border-light)',
                          background: isActive ? 'var(--color-surface)' : 'var(--color-bg)',
                          transition: 'all 0.2s',
                          boxShadow: isActive ? 'var(--shadow-xs)' : 'none'
                        }}
                      >
                        {/* Day Label with custom checkbox */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            className="custom-checkbox"
                            checked={isActive}
                            onChange={(e) => handleDayActiveToggle(dayKey, e.target.checked)}
                          />
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                            {t(dayLabel)}
                          </span>
                        </label>

                        {/* Day Hour Inputs / Offline badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {isActive ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="time"
                                className="form-input"
                                style={{ width: '92px', height: '34px', fontSize: '0.8rem', padding: '0 6px', textAlign: 'center', borderRadius: '6px' }}
                                value={config.start || editWorkStartTime}
                                onChange={(e) => handleDayTimeChange(dayKey, 'start', e.target.value)}
                              />
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>-</span>
                              <input
                                type="time"
                                className="form-input"
                                style={{ width: '92px', height: '34px', fontSize: '0.8rem', padding: '0 6px', textAlign: 'center', borderRadius: '6px' }}
                                value={config.end || editWorkEndTime}
                                onChange={(e) => handleDayTimeChange(dayKey, 'end', e.target.value)}
                              />
                            </div>
                          ) : (
                            <span style={{
                              padding: '2px 8px', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700,
                              background: 'var(--color-danger-light)',
                              color: 'var(--color-danger)'
                            }}>
                              {t('Nghỉ')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    );
  };

  // Active Sale Portal View
  return (
    <div style={{ height: '100vh', width: '100vw', background: 'var(--color-bg)', display: 'flex', overflow: 'hidden' }}>
      
      {/* Mobile Sidebar overlay */}
      {isMobileSidebarOpen && (
        <div
          className="responsive-sidebar-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`responsive-sidebar ${isMobileSidebarOpen ? 'responsive-sidebar-open' : ''}`}
        style={{
          width: isCollapsed ? 72 : 260,
          background: 'var(--sidebar-bg, #161d31)',
          color: '#dadada',
          display: 'flex',
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
            <img src="https://crm-domation.vercel.app/LOGO.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo" />
          </div>

          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 900, whiteSpace: 'nowrap', color: 'white', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                DOMATION
              </span>
              <span style={{
                fontSize: '0.625rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #d8b4fe 0%, #c084fc 50%, #a855f7 100%)',
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

        {/* Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="responsive-hide-mobile"
          style={{
            position: 'absolute', right: -12, top: 36, transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%', background: 'white', color: 'var(--sidebar-bg, #161d31)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 200, border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'all 0.2s',
          }}
        >
          <ChevronLeft size={14} style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
        </button>

        {/* Navigation list */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
          <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {!isCollapsed && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
                padding: '0.5rem 1.5rem', whiteSpace: 'nowrap'
              }}>{t("Chức năng chính")}</span>
            )}

            {[
              { name: 'Dashboard', key: 'dashboard', icon: LayoutDashboard },
              { name: 'Nhật ký Data', key: 'data', icon: Database },
              { name: 'Lịch biểu', key: 'calendar', icon: Calendar },
              { name: 'Đối soát công bằng', key: 'fair-share', icon: Scale },
              { name: 'Ticket Lỗi Data', key: 'tickets', icon: Ticket, badgeCount: data.stats.tickets_pending }
            ].map(({ name, key, icon: Icon, badgeCount }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTab(key as any);
                    setIsMobileSidebarOpen(false);
                  }}
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
                  {isActive && (
                    <span style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: 4, background: 'var(--color-primary)', borderRadius: '0 2px 2px 0'
                    }} />
                  )}

                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.2s', position: 'relative'
                  }}>
                    <Icon size={18} color={isActive ? '#dadada' : 'rgba(255,255,255,0.5)'} />
                    {isCollapsed && badgeCount > 0 && (
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
                      {badgeCount > 0 && (
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

            {!isCollapsed && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
                padding: '0.5rem 1.5rem', whiteSpace: 'nowrap', marginTop: '1.25rem'
              }}>{t("Cài đặt tài khoản")}</span>
            )}

            {[
              { name: 'Quản lý tài khoản', key: 'schedule', icon: Settings }
            ].map(({ name, key, icon: Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTab(key as any);
                    setIsMobileSidebarOpen(false);
                  }}
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
                  {isActive && (
                    <span style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: 4, background: 'var(--color-primary)', borderRadius: '0 2px 2px 0'
                    }} />
                  )}

                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.2s', position: 'relative'
                  }}>
                    <Icon size={18} color={isActive ? '#dadada' : 'rgba(255,255,255,0.5)'} />
                  </div>

                  {!isCollapsed && (
                    <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {t(name)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Right Side Content Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* Top Header Navigation */}
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
                <span>DOMATION PORTAL</span>
                <span style={{ fontSize: '0.725rem', padding: '2px 8px', borderRadius: 20, background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 700 }}>
                  SALE
                </span>
              </h1>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                {t('Nhân viên: {name}').replace('{name}', displayUser?.name || '')}
              </span>
            </div>
          </div>

          <div className="portal-header-user" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            {/* Quick Vacation Toggle for Sale */}
            {displayUser?.role === 'sale' && (
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
            <div style={{ position: 'relative' }}>
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
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{displayUser?.email}</span>
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

        {/* Scrollable View Area */}
        <main className="no-scrollbar responsive-main portal-main-content" style={{ flex: 1, padding: '2rem 3rem', width: '100%', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
            {/* Admin Switch Sale View warning/dropdown */}
            {user?.role === 'admin' && data.consultants && (
              <div className="portal-filters-row" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px',
                padding: '1rem 1.5rem'
              }}>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={16} color="var(--color-warning)" />
                    {t('GÓC QUẢN TRỊ VIÊN')}
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                    {t('Đang xem dữ liệu với vai trò của nhân viên được chọn dưới đây.')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('ĐÓNG VAI SALE:')}</span>
                  <CustomSelect
                    options={[
                      { value: '', label: t('Chọn tư vấn viên...') },
                      ...(data.consultants || []).map((c: any) => ({ value: c.id, label: c.name, avatar: c.avatar }))
                    ]}
                    value={saleIdFilter}
                    onChange={(val) => {
                      setSaleIdFilter(String(val));
                      setCurrentPage(1);
                    }}
                    width={220}
                    showAvatars={true}
                    searchable={true}
                  />
                </div>
              </div>
            )}

            {/* Render views based on activeTab */}
            {activeTab === 'dashboard' && renderDashboardView()}
            {activeTab === 'data' && renderDataView()}
            {activeTab === 'calendar' && renderCalendarView()}
            {activeTab === 'fair-share' && <FairShareAudit forceActive={true} />}
            {activeTab === 'tickets' && renderTicketsView()}
            {activeTab === 'schedule' && renderScheduleView()}
          </div>
        </main>
      </div>

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
                  {t('Hệ thống sẽ dừng phân bổ khách hàng mới cho bạn. Thông báo tạm ngưng này sẽ được gửi trực tiếp đến Zalo của Ban quản trị (Admin).')}
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
                      const borderColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];
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
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Nhận lúc:')}</span>
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
                      background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
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
                      if (item.ticket_status === 'pending') dotColor = '#f59e0b';

                      let statusLabel = t('Báo cáo lỗi (Đã bị từ chối)');
                      if (item.ticket_status === 'approved') statusLabel = t('Báo cáo lỗi (Đã duyệt bù)');
                      if (item.ticket_status === 'pending') statusLabel = t('Báo cáo lỗi (Chờ duyệt)');

                      return (
                        <div key={idx} className="timeline-item" style={{ marginBottom: '1.25rem' }}>
                          <div className="timeline-icon" style={{ backgroundColor: dotColor, left: '-1.85rem', width: '1rem', height: '1rem', border: '3px solid var(--color-surface)', boxShadow: '0 0 0 1px var(--color-border)' }} />
                          <div className="timeline-content" style={{ 
                            background: item.ticket_status === 'approved' ? 'var(--color-success-light)' : item.ticket_status === 'pending' ? 'var(--color-warning-light)' : 'var(--color-danger-light)',
                            color: item.ticket_status === 'approved' ? 'var(--color-success)' : item.ticket_status === 'pending' ? 'var(--color-warning)' : 'var(--color-danger)',
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '12px', borderRadius: '12px', border: '1px solid',
              background: selectedDetailTicket.status === 'approved' ? 'var(--color-success-light)' : selectedDetailTicket.status === 'pending' ? '#fef3c7' : 'var(--color-danger-light)',
              borderColor: selectedDetailTicket.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : selectedDetailTicket.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: selectedDetailTicket.status === 'approved' ? 'var(--color-success)' : selectedDetailTicket.status === 'pending' ? '#d97706' : 'var(--color-danger)'
            }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                {selectedDetailTicket.status === 'pending' && <Clock size={16} />}
                {selectedDetailTicket.status === 'approved' && <CheckCircle2 size={16} />}
                {selectedDetailTicket.status === 'rejected' && <XCircle size={16} />}
                <span>
                  {t('Trạng thái Ticket: ')}{selectedDetailTicket.status === 'approved' ? t('Đã duyệt đền bù') : selectedDetailTicket.status === 'pending' ? t('Đang chờ phê duyệt') : t('Đã bị từ chối')}
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
                  onClick={() => setActiveCalendarModalTab('sales')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeCalendarModalTab === 'sales' ? 'var(--color-primary)' : 'transparent',
                    color: activeCalendarModalTab === 'sales' ? 'white' : 'var(--color-text-muted)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '32px',
                    flex: 1
                  }}
                >
                  <span>{t('Dữ liệu nhận (Phân bổ)')}</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: activeCalendarModalTab === 'sales' ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-border-light)',
                    color: activeCalendarModalTab === 'sales' ? 'white' : 'var(--color-text-muted)',
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
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeCalendarModalTab === 'tickets' ? 'var(--color-primary)' : 'transparent',
                    color: activeCalendarModalTab === 'tickets' ? 'white' : 'var(--color-text-muted)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '32px',
                    flex: 1
                  }}
                >
                  <span>{t('Ticket lỗi')}</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: activeCalendarModalTab === 'tickets' ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-border-light)',
                    color: activeCalendarModalTab === 'tickets' ? 'white' : 'var(--color-text-muted)',
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
                            padding: '10px 14px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          className="hover-lift"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Avatar name={item.lead_name} size={32} />
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.875rem' }}>
                                {item.lead_name || t('Ẩn danh')}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                {item.phone} • {item.source}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
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
                              background: item.status === 'approved' ? 'var(--color-success-light)' : item.status === 'pending' ? '#fef3c7' : 'var(--color-danger-light)',
                              color: item.status === 'approved' ? 'var(--color-success)' : item.status === 'pending' ? '#d97706' : 'var(--color-danger)'
                            }}>
                              {item.status === 'approved' ? t('Đã bù') : item.status === 'pending' ? t('Chờ duyệt') : t('Từ chối')}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', borderLeft: '2px solid var(--color-border)', paddingLeft: 8, fontStyle: 'italic' }}>
                            <strong>{t('Lý do báo lỗi:')}</strong> {item.reason}
                          </div>
                          {item.resolved_by && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Avatar src={item.resolved_by_avatar} name={item.resolved_by} size={16} />
                              <span>
                                <strong>Admin {item.resolved_by}:</strong> {item.reject_reason || item.approval_reason || t('Đã duyệt đền bù')}
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
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
