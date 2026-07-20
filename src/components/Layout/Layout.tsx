import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Sidebar, SIDEBAR_GROUPS } from './Sidebar';
import { Header } from './Header';
import { QuickAddLeadModal } from '../QuickAddLeadModal';
import { ProfileModal } from '../ProfileModal';
import { CustomModal } from '../ui/CustomModal';
import { CustomSelect } from '../ui/CustomSelect';
import { Avatar } from '../ui/Avatar';
import { AIChatbot } from '../ui/AIChatbot';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAPI } from '../../utils/api';
import { useUIStore } from '../../store/uiStore';
import { POSModal } from '../ui/POSModal';
import { AlertToast } from '../ui/AlertToast';
import { StatRowSkeleton } from '../ui/Skeleton';
import { 
  Ticket as TicketIcon, 
  Activity, 
  UserCheck, 
  Clock, 
  ShieldAlert, 
  AlertTriangle, 
  Scale,
  Settings, 
  LogIn, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight, 
  Copy, 
  HelpCircle, 
  CheckCircle2, 
  XCircle,
  Mail,
  MessageSquare,
  Search,
  Check,
  Home,
  Users,
  Database,
  Calendar,
  BarChart2,
  Fingerprint,
  Camera,
  CheckSquare,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { t, language } = useLanguage();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved ? JSON.parse(saved) : true;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const { showPOS, setShowPOS } = useUIStore();
  
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleGroups = SIDEBAR_GROUPS.map(group => {
    let items = [...group.items];
    if (group.title === 'TỔNG QUAN' && user?.role === 'sale') {
      items = [
        { name: 'Tổng quan', href: '/', icon: Home, end: true },
        { name: 'Bàn làm việc', href: '/workspace', icon: CheckSquare, badgeKey: 'workspaceTasks' },
        { name: 'Kho Databank', href: '/databank', icon: Database, hideForRoles: ['viewer'] }
      ];
    }
    const filteredItems = items.filter((item: any) => {
      const role = user?.role as string;
      const isAdmin = role === 'admin' || role === 'superadmin' || role === 'super_admin';
      const isManagerOrAdmin = isAdmin || role === 'manager' || role === 'director';

      if (item.adminOnly && !isManagerOrAdmin) {
        return false;
      }
      if (item.hideForRoles && item.hideForRoles.includes(role)) {
        return false;
      }
      return true;
    });
    return { ...group, items: filteredItems };
  }).filter(group => group.items.length > 0);
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0);
  const [heldLeadsCount, setHeldLeadsCount] = useState<number>(0);
  const [pendingCheckInsCount, setPendingCheckInsCount] = useState<number>(0);
  const [pendingCoopsCount, setPendingCoopsCount] = useState<number>(0);
  const [pendingExpensesCount, setPendingExpensesCount] = useState<number>(0);
  const [isUnifiedInboxOpen, setIsUnifiedInboxOpen] = useState<boolean>(false);
  
  // Sales pending signatures state
  const [salesPendingSignCount, setSalesPendingSignCount] = useState<number>(0);
  const [supportTicketsCount, setSupportTicketsCount] = useState<number>(0);
  const [isSalesSignModalOpen, setIsSalesSignModalOpen] = useState<boolean>(false);

  // Global Check-In State
  const [todayCheckIn, setTodayCheckIn] = useState<any>(null);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [checkInReason, setCheckInReason] = useState('');
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [consultantProfile, setConsultantProfile] = useState<any>(null);
  const [dismissTelegramReminder, setDismissTelegramReminder] = useState(() => {
    return sessionStorage.getItem('dismiss_telegram_reminder') === '1';
  });
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);

  const [sysSettings, setSysSettings] = useState<any>(null);
  const managerBehaviorMode = user?.manager_behavior_mode || 'combined';
  const isSales = user?.role === 'sale' || (user?.role === 'manager' && managerBehaviorMode === 'combined');

  const loadCheckInStatus = async () => {
    if (!user || !isSales) return;
    try {
      const res = await fetchAPI('check-ins&today_only=1');
      if (res.success) {
        setTodayCheckIn(res.data);
      }
    } catch (err) {
      console.error("Error loading check-in status:", err);
    }
  };

  const loadConsultantProfile = async () => {
    if (!user) return;
    try {
      const res = await fetchAPI('consultant-profile');
      if (res.success) {
        setConsultantProfile(res.data);
      }
    } catch (err) {
      console.error("Error loading consultant profile:", err);
    }
  };

  const startCamera = async () => {
    setCapturedImage(null);
    setCameraError('');
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error(err);
      setCameraError(t('Không thể truy cập camera. Vui lòng cấp quyền.'));
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
    const workStart = consultantProfile?.work_start_time || '08:00';
    const now = new Date();
    const curHM = now.toTimeString().substring(0, 5); 
    return curHM > workStart;
  };

  const isLate = checkIsLate();

  const handleGlobalCheckIn = async () => {
    if (checkInSubmitting) return;
    setCheckInSubmitting(true);
    let selfieUrl = '';
    try {
      if (capturedImage) {
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
                }, 'image/webp', 0.8);
              } else {
                reject(new Error('Canvas context error'));
              }
            };
            img.onerror = () => reject(new Error('Image loading error'));
          });
        };

        const webpBlob = await compressToWebP(capturedImage);
        const file = new File([webpBlob], 'selfie.webp', { type: 'image/webp' });
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
        toast.error(t('Vui lòng chụp hình selfie.'));
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
        window.dispatchEvent(new CustomEvent('checkin-status-changed'));
      } else {
        toast.error(res.message || t('Check-in thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi check-in: ') + err.message);
    }
    setCheckInSubmitting(false);
  };

  useEffect(() => {
    loadCheckInStatus();
    loadConsultantProfile();
    const handleSync = () => loadCheckInStatus();
    const handleTrigger = () => setCheckInModalOpen(true);
    window.addEventListener('checkin-status-changed', handleSync);
    window.addEventListener('trigger-checkin-modal', handleTrigger);
    return () => {
      window.removeEventListener('checkin-status-changed', handleSync);
      window.removeEventListener('trigger-checkin-modal', handleTrigger);
    };
  }, [user, isSales]);

  useEffect(() => {
    if (checkInModalOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [checkInModalOpen]);

  // Hover states for notification buttons
  const [isTicketViewHovered, setIsTicketViewHovered] = useState(false);
  const [isTicketLaterHovered, setIsTicketLaterHovered] = useState(false);
  const [isHeldViewHovered, setIsHeldViewHovered] = useState(false);
  const [isHeldLaterHovered, setIsHeldLaterHovered] = useState(false);

  // Helper translation mapping for held leads notification
  const getTranslation = (key: string, fallback: string) => {
    const val = t(key);
    if (val === key && language !== 'vi') {
      const localDict: Record<string, Record<string, string>> = {
        en: {
          "Thông báo Data tạm giữ": "Held Data Notification",
          "dữ liệu bị tạm giữ bởi AI Pre-screener đang chờ bạn phê duyệt.": "below-standard leads held by AI Pre-screener waiting for your approval."
        },
        ja: {
          "Thông báo Data tạm giữ": "一時保留データのお知らせ",
          "dữ liệu bị tạm giữ bởi AI Pre-screener đang chờ bạn phê duyệt.": "件のデータがAI Pre-screenerによって一時保留され、承認待ちです。"
        },
        zh: {
          "Thông báo Data tạm giữ": "暂存数据通知",
          "dữ liệu bị tạm giữ bởi AI Pre-screener đang chờ bạn phê duyệt.": "条数据被 AI Pre-screener 暂扣，等待您的审批。"
        }
      };
      return localDict[language]?.[key] || fallback;
    }
    return val;
  };

  // Activity Feed states
  const [isActivityFeedOpen, setIsActivityFeedOpen] = useState(false);
  const [feedItems, setFeedItems] = useState<any[]>([]);

  const [expandedFeedItem, setExpandedFeedItem] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // New subtabs for Activity Modal
  const [activeTab, setActiveTab] = useState<'activity' | 'logs'>('activity');

  // Logs state
  const [notifLogs, setNotifLogs] = useState<any[]>([]);
  const [notifTotalCount, setNotifTotalCount] = useState<number>(0);
  const [notifPage, setNotifPage] = useState<number>(1);
  const [notifFilterType, setNotifFilterType] = useState<string>('all');
  const [notifFilterChannel, setNotifFilterChannel] = useState<string>('all');
  const [notifSearchInput, setNotifSearchInput] = useState<string>('');
  const [notifSearch, setNotifSearch] = useState<string>('');
  const [notifFilterSale, setNotifFilterSale] = useState<string>('all');
  const [isNotifLogsLoading, setIsNotifLogsLoading] = useState<boolean>(false);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [hasFetchedUsers, setHasFetchedUsers] = useState<boolean>(false);
  const [backendVersion, setBackendVersion] = useState<string>(() => {
    return localStorage.getItem('backend_version') || '1.5.3';
  });


  const fetchUsersForLogs = async () => {
    if (hasFetchedUsers) return;
    try {
      const [consRes, accRes] = await Promise.all([
        fetchAPI('get_consultants'),
        fetchAPI('get_accounts')
      ]);
      if (consRes.success) setConsultants(consRes.data || []);
      if (accRes.success) setAccounts(accRes.data || []);
      setHasFetchedUsers(true);
    } catch (err) {
      console.error("Error fetching users for logs mapping:", err);
    }
  };

  const getAvatarAndNameByTarget = (target: string) => {
    if (!target || target === '-') return { avatar: undefined, name: t('Hệ thống') };
    const cleanTarget = target.trim().toLowerCase();
    const cons = consultants.find(c => 
      (c.email && c.email.trim().toLowerCase() === cleanTarget) || 
      (c.zalo_chat_id && c.zalo_chat_id.trim().toLowerCase() === cleanTarget)
    );
    if (cons) return { avatar: cons.avatar, name: cons.name };
    const acc = accounts.find(a => 
      (a.email && a.email.trim().toLowerCase() === cleanTarget) ||
      (a.zalo_chat_id && a.zalo_chat_id.trim().toLowerCase() === cleanTarget)
    );
    if (acc) return { avatar: acc.avatar, name: acc.name || acc.username };
    return { avatar: undefined, name: target };
  };

  const fetchNotifLogs = async () => {
    setIsNotifLogsLoading(true);
    try {
      const res = await fetchAPI(`get_notification_logs&channel=${notifFilterChannel}&type=${notifFilterType}&sale=${notifFilterSale}&search=${encodeURIComponent(notifSearch)}&page=${notifPage}&pageSize=10`);
      if (res.success && Array.isArray(res.data)) {
        setNotifLogs(res.data);
        setNotifTotalCount(res.total_count ?? 0);
      }
    } catch (err) {
      console.error('Error fetching notification logs:', err);
    } finally {
      setIsNotifLogsLoading(false);
    }
  };

  // Reset tab when modal closes
  useEffect(() => {
    if (!isActivityFeedOpen) {
      setActiveTab('activity');
      setNotifSearchInput('');
      setNotifSearch('');
      setNotifPage(1);
      setNotifFilterChannel('all');
      setNotifFilterType('all');
      setNotifFilterSale('all');
      setExpandedLogId(null);
    }
  }, [isActivityFeedOpen]);

  // Debounce search input
  useEffect(() => {
    if (activeTab === 'logs') {
      const timer = setTimeout(() => {
        setNotifSearch(notifSearchInput);
        setNotifPage(1);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [notifSearchInput, activeTab]);

  // Reset page on filter changes
  useEffect(() => {
    if (activeTab === 'logs') {
      setNotifPage(1);
    }
  }, [notifFilterChannel, notifFilterType, notifFilterSale]);

  // Fetch notification logs
  useEffect(() => {
    if (isActivityFeedOpen && activeTab === 'logs') {
      fetchUsersForLogs();
      fetchNotifLogs();
    }
  }, [isActivityFeedOpen, activeTab, notifFilterChannel, notifFilterType, notifFilterSale, notifSearch, notifPage]);

  const fetchFeed = async () => {
    try {
      const res = await fetchAPI('get_system_activity_feed');
      if (res.success && Array.isArray(res.data)) {
        setFeedItems(res.data);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error('Error loading activity feed:', err);
    }
  };

  useEffect(() => {
    if (isActivityFeedOpen) {
      fetchFeed();
      setCurrentPage(1);
    }
  }, [isActivityFeedOpen]);

  useEffect(() => {
    const handleOpenFeed = () => {
      setIsActivityFeedOpen(true);
    };
    window.addEventListener('open-activity-feed', handleOpenFeed);
    return () => {
      window.removeEventListener('open-activity-feed', handleOpenFeed);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      isSidebarCollapsed ? '60px' : '220px'
    );
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const handleFocusMode = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        if (customEvent.detail.isFocusMode) {
          setIsSidebarCollapsed(true);
        } else {
          const saved = localStorage.getItem('sidebar_collapsed');
          setIsSidebarCollapsed(saved ? JSON.parse(saved) : false);
        }
      }
    };
    window.addEventListener('focus-mode-toggle', handleFocusMode);
    return () => {
      window.removeEventListener('focus-mode-toggle', handleFocusMode);
    };
  }, []);

  useEffect(() => {
    if (user) {
      console.log('Layout useEffect calling get_settings, user exists:', user);
      fetchAPI('get_settings')
        .then(res => {
          console.log('Layout get_settings response:', res);
          if (res && res.success && res.data) {
            setSysSettings(res.data);
            if (res.data.backend_version) {
              console.log('Setting backendVersion to:', res.data.backend_version);
              setBackendVersion(res.data.backend_version);
              localStorage.setItem('backend_version', res.data.backend_version);
            }
          }
        })
        .catch(err => {
          console.error('Layout get_settings error:', err);
        });
    }
  }, [user]);




  useEffect(() => {
    const role = user?.role as string;
    if (role === 'admin' || role === 'superadmin' || role === 'super_admin' || role === 'director' || role === 'manager') {
      let ticketsCount = 0;
      let heldCount = 0;
      let checkinsCount = 0;
      let coopsCount = 0;
      let supportCount = 0;
      let expensesCount = 0;

      const p1 = fetchAPI('get_reports&status=pending&date=all&pageSize=1')
        .then(res => { if (res.success) ticketsCount = res.total_count ?? 0; });
      const p2 = fetchAPI('get_held_leads&pageSize=1&date=all')
        .then(res => { if (res.success) heldCount = res.total_count ?? 0; });
      const p3 = fetchAPI('check-ins&status=pending_approval')
        .then(res => { if (res.success && Array.isArray(res.data)) checkinsCount = res.data.length; });
      const p4 = fetchAPI('cooperation-slips')
        .then(res => {
          if (res.success && Array.isArray(res.data)) {
            coopsCount = res.data.filter((c: any) => c.status === 'pending_manager_approval').length;
          }
        });
      const p5 = fetchAPI('get_support_tickets_count&status=open')
        .then(res => {
          if (res && res.success) {
            supportCount = res.count || 0;
          }
        }).catch(() => {});
      const p6 = fetchAPI('expenses?status=pending&limit=1')
        .then(res => { if (res.success) expensesCount = res.data?.total ?? 0; }).catch(() => {});

      Promise.all([p1, p2, p3, p4, p5, p6]).then(() => {
        setPendingTicketsCount(ticketsCount);
        setHeldLeadsCount(heldCount);
        setPendingCheckInsCount(checkinsCount);
        setPendingCoopsCount(coopsCount);
        setSupportTicketsCount(supportCount);
        setPendingExpensesCount(expensesCount);
        
        if (location.pathname !== '/support-tickets' && location.pathname !== '/expenses') {
          if (ticketsCount > 0 || heldCount > 0 || checkinsCount > 0 || coopsCount > 0 || supportCount > 0 || expensesCount > 0) {
            setIsUnifiedInboxOpen(true);
          }
        }
      }).catch(err => console.error('Error loading unified approvals:', err));
    } else if (user?.role === 'sale') {
      fetchAPI('cooperation-slips')
        .then(res => {
          if (res.success && Array.isArray(res.data)) {
            const pendingSign = res.data.filter((c: any) => 
              (c.status === 'pending_signatures' || c.status === 'approved_pending_signatures') &&
              c.shareholders?.some((sh: any) => sh.user_id === user?.id && !sh.signed)
            );
            setSalesPendingSignCount(pendingSign.length);
            if (pendingSign.length > 0) {
              setIsSalesSignModalOpen(true);
            }
          }
        })
        .catch(err => console.error('Error loading sales coops:', err));
    }
  }, [user]);

  const getActivityIcon = (item: any) => {
    const size = 18;
    switch (item.type) {
      case 'distribution':
        if (item.status === 'assigned' || item.status === 'compensation') {
          return { icon: <UserCheck size={size} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
        } else if (item.status === 'pending_work_hours') {
          return { icon: <Clock size={size} />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
        } else if (item.status === 'duplicate') {
          return { icon: <Copy size={size} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
        } else if (item.status === 'blacklisted') {
          return { icon: <ShieldAlert size={size} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
        }
        return { icon: <UserCheck size={size} />, color: '#BD1D2D', bg: 'rgba(189, 29, 45, 0.1)' };
      case 'admin':
        if (item.action === 'LOGIN') {
          return { icon: <LogIn size={size} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
        } else if (item.action?.includes('BLACKLIST')) {
          return { icon: <ShieldAlert size={size} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
        }
        return { icon: <Settings size={size} />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
      case 'ticket':
        if (item.status === 'resolved') {
          return { icon: <CheckCircle2 size={size} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
        } else if (item.status === 'rejected') {
          return { icon: <XCircle size={size} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
        }
        return { icon: <AlertTriangle size={size} />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      default:
        return { icon: <HelpCircle size={size} />, color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' };
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--color-bg)', overflow: 'hidden' }}>
      <style>{`
        @media (max-width: 600px) {
          .logs-tab-container {
            gap: 0.75rem !important;
          }
          .logs-tab-btn {
            font-size: 0.75rem !important;
            padding: 4px 2px !important;
          }
          .logs-toolbar {
            padding: 0.4rem !important;
            gap: 0.4rem !important;
            margin-bottom: 0.75rem !important;
          }
          .logs-toolbar-item {
            flex: 1 1 calc(33.33% - 0.27rem) !important;
            min-width: 85px !important;
          }
          .logs-search-wrapper {
            flex: 1 1 100% !important;
            min-width: 100% !important;
          }
          .logs-search-wrapper input {
            height: 32px !important;
            padding-left: 26px !important;
            padding-right: 8px !important;
            font-size: 0.78rem !important;
            border-radius: 6px !important;
          }
          .logs-search-wrapper svg {
            left: 8px !important;
            top: 9px !important;
          }
          .logs-sale-wrapper {
            flex: 1.2 1 calc(33.33% - 0.27rem) !important;
            min-width: 105px !important;
          }
          .logs-toolbar [class*="trigger"] {
            min-height: 32px !important;
            height: 32px !important;
            padding: 0 0.4rem !important;
            border-radius: 6px !important;
            font-size: 0.75rem !important;
          }
          .logs-toolbar [class*="triggerContent"] {
            gap: 0.35rem !important;
          }
          .logs-toolbar [class*="option"] {
            padding: 0.4rem 0.5rem !important;
            font-size: 0.78rem !important;
          }
          .pagination-container {
            flex-direction: column !important;
            gap: 8px !important;
            align-items: center !important;
          }
          .pagination-text {
            text-align: center !important;
            white-space: nowrap !important;
          }
        }
      `}</style>
      {/* Mobile Modal Menu */}
      {isMobile && isMobileSidebarOpen && createPortal(
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
              <XCircle size={20} />
            </button>
          </div>

          {/* Menu Groups */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            {visibleGroups.map((group, groupIdx) => (
              <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>{t(group.title)}</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          navigate(item.href);
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
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(item.name)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {!isMobile && (
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          onToggleCollapse={() => {
            setIsSidebarCollapsed(prev => {
              const newVal = !prev;
              localStorage.setItem('sidebar_collapsed', JSON.stringify(newVal));
              return newVal;
            });
          }} 
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <Header 
          onActivityFeedClick={() => setIsActivityFeedOpen(true)}
          onMenuClick={() => setIsMobileSidebarOpen(true)}
          version={backendVersion}
          pendingInboxCount={pendingTicketsCount + heldLeadsCount + pendingCheckInsCount + pendingCoopsCount + supportTicketsCount + pendingExpensesCount}
          onUnifiedInboxClick={() => setIsUnifiedInboxOpen(true)}
        />

        {user && consultantProfile && !consultantProfile.telegram_chat_id && !dismissTelegramReminder && (
          <div style={{
            background: 'linear-gradient(90deg, #0088cc 0%, #00a8ff 100%)',
            color: '#fff',
            padding: '8px 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            fontWeight: 500,
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            zIndex: 30
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/3840px-Telegram_logo.svg.png" alt="Telegram" style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', padding: 1 }} />
              <span>
                Bạn chưa liên kết tài khoản với <b>Telegram Bot</b> để nhận thông báo chia số tự động. 
                <span 
                  style={{ marginLeft: 8, textDecoration: 'underline', cursor: 'pointer', fontWeight: 700, color: '#fff' }} 
                  onClick={() => setIsTelegramModalOpen(true)}
                >
                  Liên kết ngay →
                </span>
              </span>
            </div>
            <button 
              onClick={() => {
                setDismissTelegramReminder(true);
                sessionStorage.setItem('dismiss_telegram_reminder', '1');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                padding: '0 5px',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        )}


        <main className="responsive-main" style={{ flex: 1, overflow: 'auto', padding: '1.25rem 1.75rem', position: 'relative', zIndex: 10 }}>
          <div style={{ width: '100%' }}>
            {children}
          </div>
        </main>
      </div>
      <AlertToast />
      <QuickAddLeadModal />
      {showPOS && (
        <POSModal 
          onClose={() => setShowPOS(false)} 
          defaultContact={typeof showPOS === 'object' ? showPOS : null}
        />
      )}

      {/* Unified Approvals Inbox Modal */}
      <CustomModal
        isOpen={isUnifiedInboxOpen}
        onClose={() => setIsUnifiedInboxOpen(false)}
        title={t("Hộp thư Phê duyệt & Tồn đọng")}
        width={680}
      >
        <div style={{ display: 'flex', flexDirection: 'column', padding: '0.25rem 0' }}>
          <style>{`
            .unified-inbox-card {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 14px 18px;
              background: var(--color-surface);
              border: 1px solid var(--color-border-light);
              border-radius: 14px;
              cursor: pointer;
              transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.015);
            }
            .unified-inbox-card:hover {
              transform: translateY(-2px);
              border-color: var(--hover-color) !important;
              background: var(--hover-bg) !important;
              box-shadow: 0 10px 25px -8px var(--hover-shadow) !important;
            }
            .unified-inbox-icon {
              width: 38px;
              height: 38px;
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.25s ease;
            }
            .unified-inbox-card:hover .unified-inbox-icon {
              transform: scale(1.1) rotate(2deg);
            }
            .unified-inbox-card:hover .chevron-arrow {
              transform: translateX(4px);
              color: var(--hover-color) !important;
            }
          `}</style>

          {/* Header & List Container */}
          {(() => {
            const hasPendingTasks = (pendingTicketsCount + heldLeadsCount + pendingCheckInsCount + pendingCoopsCount + supportTicketsCount + pendingExpensesCount) > 0;
            if (hasPendingTasks) {
              return (
                <>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '14px', 
                    marginBottom: '1.5rem', 
                    background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.05) 0%, rgba(244, 63, 94, 0.05) 100%)', 
                    padding: '16px', 
                    borderRadius: '16px', 
                    border: '1px solid rgba(189, 29, 45, 0.08)' 
                  }}>
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: '12px', 
                      background: 'linear-gradient(135deg, #BD1D2D 0%, #ef4444 100%)', 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      color: '#fff',
                      boxShadow: '0 8px 20px -6px rgba(189, 29, 45, 0.5)'
                    }}>
                      <ShieldAlert size={24} className="animate-pulse" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>
                        {t("Vấn đề cần xử lý!")}
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '4px 0 0', fontWeight: 500 }}>
                        {t("Bạn đang có các vấn đề tồn đọng cần xử lý:")}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
                    {/* 1. Ticket báo lỗi */}
                    {pendingTicketsCount > 0 && (
                      <div 
                        onClick={() => { setIsUnifiedInboxOpen(false); navigate('/tickets'); }}
                        className="unified-inbox-card"
                        style={{ 
                          '--hover-color': '#ef4444',
                          '--hover-bg': 'rgba(239, 68, 68, 0.03)',
                          '--hover-shadow': 'rgba(239, 68, 68, 0.15)'
                        } as any}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="unified-inbox-icon" style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' }}>
                            <TicketIcon size={18} />
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Ticket báo lỗi data")}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="badge danger" style={{ borderRadius: '20px', padding: '4px 10px', fontWeight: 700, fontSize: '0.72rem', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.12)' }}>{pendingTicketsCount} {t('chờ duyệt')}</span>
                          
                          <div style={{
                            borderRadius: '20px',
                            padding: '5px 12px',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            <span>{t('Duyệt ngay')}</span>
                            <ChevronRight className="chevron-arrow" size={12} style={{ transition: 'all 0.25s' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. AI Pre-screener */}
                    {heldLeadsCount > 0 && (
                      <div 
                        onClick={() => { setIsUnifiedInboxOpen(false); navigate('/gatekeeper'); }}
                        className="unified-inbox-card"
                        style={{ 
                          '--hover-color': '#f59e0b',
                          '--hover-bg': 'rgba(245, 158, 11, 0.03)',
                          '--hover-shadow': 'rgba(245, 158, 11, 0.15)'
                        } as any}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="unified-inbox-icon" style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b' }}>
                            <AlertTriangle size={18} />
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Data tạm giữ (AI Lọc)")}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="badge warning" style={{ borderRadius: '20px', padding: '4px 10px', fontWeight: 700, fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', boxShadow: '0 2px 6px rgba(245, 158, 11, 0.12)' }}>{heldLeadsCount} {t('chờ duyệt')}</span>
                          
                          <div style={{
                            borderRadius: '20px',
                            padding: '5px 12px',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            <span>{t('Duyệt ngay')}</span>
                            <ChevronRight className="chevron-arrow" size={12} style={{ transition: 'all 0.25s' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. Chấm công */}
                    {pendingCheckInsCount > 0 && (
                      <div 
                        onClick={() => { setIsUnifiedInboxOpen(false); navigate('/attendance'); }}
                        className="unified-inbox-card"
                        style={{ 
                          '--hover-color': '#BD1D2D',
                          '--hover-bg': 'rgba(189, 29, 45, 0.03)',
                          '--hover-shadow': 'rgba(189, 29, 45, 0.15)'
                        } as any}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="unified-inbox-icon" style={{ background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D' }}>
                            <Clock size={18} />
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Yêu cầu chấm công bổ sung")}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="badge" style={{ borderRadius: '20px', padding: '4px 10px', fontWeight: 700, fontSize: '0.72rem', background: 'rgba(189, 29, 45, 0.1)', color: 'var(--color-primary)', boxShadow: '0 2px 6px rgba(189, 29, 45, 0.12)' }}>{pendingCheckInsCount} {t('chờ duyệt')}</span>
                          
                          <div style={{
                            borderRadius: '20px',
                            padding: '5px 12px',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                            boxShadow: '0 4px 12px rgba(189, 29, 45, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            <span>{t('Duyệt ngay')}</span>
                            <ChevronRight className="chevron-arrow" size={12} style={{ transition: 'all 0.25s' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. Ký hợp tác */}
                    {pendingCoopsCount > 0 && (
                      <div 
                        onClick={() => { setIsUnifiedInboxOpen(false); navigate('/cooperation-slips'); }}
                        className="unified-inbox-card"
                        style={{ 
                          '--hover-color': '#BD1D2D',
                          '--hover-bg': 'rgba(189, 29, 45, 0.03)',
                          '--hover-shadow': 'rgba(189, 29, 45, 0.15)'
                        } as any}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="unified-inbox-icon" style={{ background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D' }}>
                            <Scale size={18} />
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Phê duyệt ký hợp tác chia hoa hồng")}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="badge" style={{ borderRadius: '20px', padding: '4px 10px', fontWeight: 700, fontSize: '0.72rem', background: 'rgba(189, 29, 45, 0.1)', color: 'var(--color-primary)', boxShadow: '0 2px 6px rgba(189, 29, 45, 0.12)' }}>{pendingCoopsCount} {t('chờ duyệt')}</span>
                          
                          <div style={{
                            borderRadius: '20px',
                            padding: '5px 12px',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                            boxShadow: '0 4px 12px rgba(189, 29, 45, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            <span>{t('Duyệt ngay')}</span>
                            <ChevronRight className="chevron-arrow" size={12} style={{ transition: 'all 0.25s' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 5. Ticket hỗ trợ */}
                    {supportTicketsCount > 0 && (
                      <div 
                        onClick={() => { setIsUnifiedInboxOpen(false); navigate('/support-tickets'); }}
                        className="unified-inbox-card"
                        style={{ 
                          '--hover-color': '#2563eb',
                          '--hover-bg': 'rgba(37, 99, 235, 0.03)',
                          '--hover-shadow': 'rgba(37, 99, 235, 0.15)'
                        } as any}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="unified-inbox-icon" style={{ background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }}>
                            <HelpCircle size={18} />
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Ticket yêu cầu hỗ trợ (IT/CS)")}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="badge" style={{ borderRadius: '20px', padding: '4px 10px', fontWeight: 700, fontSize: '0.72rem', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.12)' }}>{supportTicketsCount} {t('chờ xử lý')}</span>
                          
                          <div style={{
                            borderRadius: '20px',
                            padding: '5px 12px',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            <span>{t('Xử lý ngay')}</span>
                            <ChevronRight className="chevron-arrow" size={12} style={{ transition: 'all 0.25s' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 6. Phê duyệt Chi phí */}
                    {pendingExpensesCount > 0 && (
                      <div 
                        onClick={() => { setIsUnifiedInboxOpen(false); navigate('/expenses?status=pending'); }}
                        className="unified-inbox-card"
                        style={{ 
                          '--hover-color': '#10b981',
                          '--hover-bg': 'rgba(16, 185, 129, 0.03)',
                          '--hover-shadow': 'rgba(16, 185, 129, 0.15)'
                        } as any}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="unified-inbox-icon" style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
                            <DollarSign size={18} />
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{t("Phê duyệt yêu cầu chi phí")}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="badge success" style={{ borderRadius: '20px', padding: '4px 10px', fontWeight: 700, fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', boxShadow: '0 2px 6px rgba(16, 185, 129, 0.12)' }}>{pendingExpensesCount} {t('chờ duyệt')}</span>
                          
                          <div style={{
                            borderRadius: '20px',
                            padding: '5px 12px',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            <span>{t('Duyệt ngay')}</span>
                            <ChevronRight className="chevron-arrow" size={12} style={{ transition: 'all 0.25s' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            } else {
              return (
                <>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '14px', 
                    marginBottom: '1.5rem', 
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(52, 211, 153, 0.05) 100%)', 
                    padding: '16px', 
                    borderRadius: '16px', 
                    border: '1px solid rgba(16, 185, 129, 0.08)' 
                  }}>
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: '12px', 
                      background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      color: '#fff',
                      boxShadow: '0 8px 20px -6px rgba(16, 185, 129, 0.5)'
                    }}>
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>
                        {t("Tuyệt vời! Không có tồn đọng")}
                      </h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '4px 0 0', fontWeight: 500 }}>
                        {t("Hiện tại hệ thống không ghi nhận công việc nào cần phê duyệt.")}
                      </p>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '3rem 1.5rem',
                    background: 'var(--color-bg-secondary)',
                    border: '1px dashed var(--color-border)',
                    borderRadius: '16px',
                    textAlign: 'center',
                    marginBottom: '1.5rem'
                  }}>
                    <CheckCircle2 size={48} style={{ color: '#10b981', marginBottom: '1rem' }} />
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {t("Mọi thứ đã được xử lý hoàn tất")}
                    </span>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '6px', maxWidth: '380px', lineHeight: 1.5 }}>
                      {t("Không còn yêu cầu chờ duyệt nào. Chúc bạn một ngày làm việc hiệu quả và tràn đầy năng lượng!")}
                    </p>
                  </div>
                </>
              );
            }
          })()}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button 
              onClick={() => setIsUnifiedInboxOpen(false)}
              className="btn outline sm"
              style={{ borderRadius: '8px', padding: '8px 18px', fontWeight: 600, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {t("Đóng")}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Sales Pending Signatures Modal */}
      <CustomModal
        isOpen={isSalesSignModalOpen}
        onClose={() => setIsSalesSignModalOpen(false)}
        title={t("Hợp đồng / Phiếu hợp tác chờ ký")}
        width={420}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1rem 0.5rem' }}>
          <div style={{ 
            width: 56, 
            height: 56, 
            borderRadius: '50%', 
            background: 'rgba(16, 185, 129, 0.08)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginBottom: '1rem',
            color: 'var(--color-success)'
          }}>
            <Scale size={28} />
          </div>
          
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
            {t("Bạn có hợp đồng chờ ký!")}
          </h3>
          
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
            {t("Hệ thống ghi nhận bạn đang có")} <strong style={{ color: 'var(--color-success)', fontSize: '1.05rem', fontWeight: 'bold' }}>{salesPendingSignCount}</strong> {t("phiếu hợp tác phân chia hoa hồng dự án đang chờ bạn ký xác nhận.")}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            <button 
              onClick={() => setIsSalesSignModalOpen(false)}
              className="btn outline"
              style={{ flex: 1, borderRadius: '9999px', height: 42, fontWeight: 600 }}
            >
              {t("Để sau")}
            </button>
            <button 
              onClick={() => {
                setIsSalesSignModalOpen(false);
                navigate('/cooperation-slips');
              }}
              className="btn primary"
              style={{ 
                flex: 1, 
                borderRadius: '9999px', 
                height: 42, 
                fontWeight: 600,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderColor: '#10b981',
                color: 'white',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}
            >
              {t("Ký ngay")}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Activity Feed Modal */}
      <CustomModal
        isOpen={isActivityFeedOpen}
        onClose={() => setIsActivityFeedOpen(false)}
        title={t("Bản tin hoạt động hệ thống")}
        width={850}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
          {/* Tab Selector */}
          <div 
            className="logs-tab-container"
            style={{ 
              display: 'flex', 
              gap: '1.5rem', 
              borderBottom: '1px solid var(--color-border-light)', 
              marginBottom: '0.75rem',
              paddingBottom: '0.25rem' 
            }}
          >
            <button
              className="logs-tab-btn"
              onClick={() => setActiveTab('activity')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'activity' ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: activeTab === 'activity' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: activeTab === 'activity' ? 700 : 500,
                fontSize: '0.875rem',
                padding: '6px 4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              {t("Hoạt động hệ thống")}
            </button>
            <button
              className="logs-tab-btn"
              onClick={() => setActiveTab('logs')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'logs' ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: activeTab === 'logs' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: activeTab === 'logs' ? 700 : 500,
                fontSize: '0.875rem',
                padding: '6px 4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              {t("Check Log Zalo & Email")}
            </button>
          </div>

          {activeTab === 'activity' ? (
            <>
              {/* Subheader with refresh info */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid var(--color-border-light)'
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
                  {t("Danh sách hoạt động và phân bổ gần đây nhất")}
                </span>
              </div>

              {/* List content */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                {feedItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {feedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => {
                      const config = getActivityIcon(item);
                      const isExpanded = expandedFeedItem === item.id;
                      const entityName = item.type === 'distribution' 
                        ? (item.consultant_name || t('Hệ thống'))
                        : (item.type === 'ticket'
                            ? (item.consultant_name || t('Hệ thống'))
                            : (item.admin_name || t('Hệ thống')));
                      
                      return (
                        <div 
                          key={item.id}
                          style={{
                            padding: '6px 10px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.01)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ flexShrink: 0, position: 'relative' }}>
                              <Avatar 
                                src={item.consultant_avatar}
                                name={entityName} 
                                size={32} 
                              />
                              <div style={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: 'var(--color-surface)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: config.color,
                                fontSize: '8px'
                              }}>
                                {React.cloneElement(config.icon, { size: 10 })}
                              </div>
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                  {item.title}
                                </span>
                                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                                  {new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} {new Date(item.timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                </span>
                              </div>

                              <div 
                                style={{ fontSize: '0.78125rem', color: 'var(--color-text-light)', marginTop: '2px', lineHeight: '1.4' }}
                                dangerouslySetInnerHTML={{ __html: item.description }}
                              />
                              
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                                <span style={{
                                  fontSize: '0.625rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: config.bg,
                                  color: config.color
                                }}>
                                  {item.tag}
                                </span>

                                {item.details && (
                                  <button
                                    onClick={() => setExpandedFeedItem(isExpanded ? null : item.id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--color-text-light)',
                                      fontSize: '0.71875rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 2,
                                      outline: 'none',
                                      padding: '2px'
                                    }}
                                  >
                                    {isExpanded ? (
                                      <>{t('Thu gọn')} <ChevronUp size={12} /></>
                                    ) : (
                                      <>{t('Chi tiết')} <ChevronDown size={12} /></>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {isExpanded && item.details && (
                            <div style={{
                              marginTop: '8px',
                              padding: '8px 10px',
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              color: 'var(--color-text-light)',
                              fontFamily: 'monospace',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              maxHeight: '120px',
                              overflowY: 'auto'
                            }}>
                              {(() => {
                                try {
                                  const parsed = JSON.parse(item.details);
                                  return JSON.stringify(parsed, null, 2);
                                } catch (e) {
                                  return item.details;
                                }
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', gap: 8 }}>
                    <Activity size={32} style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: '0.875rem' }}>{t('Không có hoạt động nào được ghi nhận gần đây.')}</span>
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {feedItems.length > pageSize && (
                <div 
                  className="pagination-container"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-border-light)'
                  }}
                >
                  <span 
                    className="pagination-text"
                    style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}
                  >
                    {t('Hiển thị')} {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, feedItems.length)} {t('của')} {feedItems.length} {t('hoạt động')}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="btn outline"
                      style={{
                        padding: '3px 8px',
                        height: '26px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage === 1 ? 0.5 : 1
                      }}
                    >
                      {t('Trước')}
                    </button>
                    
                    {(() => {
                      const totalPages = Math.ceil(feedItems.length / pageSize);
                      return Array.from({ length: totalPages }).map((_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border-light)',
                              background: currentPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                              color: currentPage === pageNum ? 'white' : 'var(--color-text)',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      });
                    })()}

                    <button
                      disabled={currentPage === Math.ceil(feedItems.length / pageSize)}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(feedItems.length / pageSize)))}
                      className="btn outline"
                      style={{
                        padding: '3px 8px',
                        height: '26px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: currentPage === Math.ceil(feedItems.length / pageSize) ? 'not-allowed' : 'pointer',
                        opacity: currentPage === Math.ceil(feedItems.length / pageSize) ? 0.5 : 1
                      }}
                    >
                      {t('Sau')}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Check Log subtab content */}
              {/* Tool bar: Search & Filters */}
              <div 
                className="logs-toolbar"
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  background: 'rgba(255, 255, 255, 0.01)',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border-light)'
                }}
              >
                {/* Search */}
                <div 
                  className="logs-search-wrapper"
                  style={{ flex: 1, minWidth: '200px', position: 'relative' }}
                >
                  <input
                    type="text"
                    placeholder={t("Tìm kiếm Sale, Chat ID, nội dung...")}
                    value={notifSearchInput}
                    onChange={(e) => setNotifSearchInput(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      paddingLeft: '32px',
                      paddingRight: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--color-text-muted)' }} />
                </div>

                {/* Filter Kênh */}
                <div 
                  className="logs-toolbar-item"
                  style={{ minWidth: '130px' }}
                >
                  <CustomSelect
                    options={[
                      { value: 'all', label: t('Tất cả kênh') },
                      { 
                        value: 'zalo', 
                        label: 'Zalo', 
                        icon: (
                          <img 
                            src="https://stc-zpl.zdn.vn/favicon.ico" 
                            alt="Zalo" 
                            style={{ width: 14, height: 14, objectFit: 'contain', borderRadius: '50%' }} 
                          />
                        ) 
                      },
                      { value: 'email', label: 'Email', icon: <Mail size={12} style={{ color: 'var(--color-info)' }} /> }
                    ]}
                    value={notifFilterChannel}
                    onChange={(val) => setNotifFilterChannel(val)}
                  />
                </div>

                {/* Filter Loại tin */}
                <div 
                  className="logs-toolbar-item"
                  style={{ minWidth: '150px' }}
                >
                  <CustomSelect
                    options={[
                      { value: 'all', label: t('Tất cả loại tin') },
                      { value: 'sale', label: t('Tin gửi Sale'), icon: <UserCheck size={12} style={{ color: 'var(--color-primary)' }} /> },
                      { value: 'admin', label: t('Tin Admin check'), icon: <ShieldAlert size={12} style={{ color: 'var(--color-danger)' }} /> }
                    ]}
                    value={notifFilterType}
                    onChange={(val) => setNotifFilterType(val)}
                  />
                </div>

                {/* Filter Sale */}
                <div 
                  className="logs-sale-wrapper"
                  style={{ minWidth: '180px' }}
                >
                  <CustomSelect
                    options={[
                      { value: 'all', label: t('Tất cả Sale') },
                      ...consultants.map(c => ({
                        value: String(c.id),
                        label: c.name,
                        avatar: c.avatar,
                        sublabel: c.email || c.zalo_chat_id ? (c.email || c.zalo_chat_id).substring(0, 15) : undefined
                      }))
                    ]}
                    value={notifFilterSale}
                    onChange={(val) => setNotifFilterSale(val)}
                    showAvatars={true}
                    searchable={true}
                    placeholder={t("Chọn Sale...")}
                    align="right"
                  />
                </div>
              </div>

              {/* Logs Content list */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                {isNotifLogsLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '1rem' }}>
                    <StatRowSkeleton />
                    <StatRowSkeleton />
                    <StatRowSkeleton />
                    <StatRowSkeleton />
                  </div>
                ) : notifLogs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {notifLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      const hasDetails = log.body && log.body.length > 0;
                      const isEmail = log.channel === 'email';
                      const userMeta = getAvatarAndNameByTarget(log.target);
                      const formattedTime = new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date(log.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                      
                      const getChannelText = (item: any) => {
                        const channel = item.channel === 'email' ? 'Email' : 'Zalo';
                        const type = item.type === 'admin' ? t('Admin') : t('Sale');
                        const direct = item.is_direct ? ' (direct)' : '';
                        return `${channel}${direct} • ${type}`;
                      };

                      const getStatusIndicator = (status: string) => {
                        switch (status) {
                          case 'sent':
                            return <span style={{ color: 'var(--color-success)', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}><CheckCircle2 size={12} /> {t('Đã gửi')}</span>;
                          case 'pending':
                            return <span style={{ color: 'var(--color-warning)', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={12} /> {t('Đang chờ')}</span>;
                          default:
                            return <span style={{ color: 'var(--color-danger)', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}><XCircle size={12} /> {t('Thất bại')}</span>;
                        }
                      };

                      return (
                        <div
                          key={log.id}
                          style={{
                            padding: '10px 12px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.01)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Avatar with Channel Icon in corner */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <Avatar 
                                src={userMeta.avatar} 
                                name={userMeta.name} 
                                size={36} 
                              />
                              <div style={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: 'var(--color-surface)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                padding: '1px'
                              }}>
                                {isEmail ? (
                                  <img 
                                    src="/imgs/gmail-icon-free-png.webp" 
                                    alt="Gmail" 
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} 
                                  />
                                ) : (
                                  <img 
                                    src="https://stc-zpl.zdn.vn/favicon.ico" 
                                    alt="Zalo" 
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} 
                                  />
                                )}
                              </div>
                            </div>

                            {/* Main row Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.target}>
                                  {userMeta.name}
                                </span>
                                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                                  {formattedTime}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', flexWrap: 'wrap', gap: 6 }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  {getChannelText(log)}
                                </span>

                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                  {getStatusIndicator(log.status)}

                                  {log.body && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(log.body);
                                        setCopySuccessId(log.id);
                                        setTimeout(() => setCopySuccessId(null), 1500);
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: copySuccessId === log.id ? 'var(--color-success)' : 'var(--color-text-muted)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        outline: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        fontSize: '0.7rem',
                                        fontWeight: 600
                                      }}
                                      title={t("Copy nội dung tin nhắn")}
                                    >
                                      {copySuccessId === log.id ? (
                                        <><Check size={12} /> {t("Đã copy")}</>
                                      ) : (
                                        <><Copy size={12} /> {t("Copy")}</>
                                      )}
                                    </button>
                                  )}

                                  {hasDetails && (
                                    <button
                                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--color-text-light)',
                                        fontSize: '0.71875rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        outline: 'none',
                                        padding: '2px'
                                      }}
                                    >
                                      {isExpanded ? (
                                        <>{t('Thu gọn')} <ChevronUp size={12} /></>
                                      ) : (
                                        <>{t('Chi tiết')} <ChevronDown size={12} /></>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>


                          {/* Expanded Content */}
                          {isExpanded && log.body && (
                            <div style={{
                              marginTop: '8px',
                              padding: '10px 12px',
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              color: 'var(--color-text)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              maxHeight: '220px',
                              overflowY: 'auto',
                              lineHeight: '1.5',
                              fontFamily: isEmail ? 'inherit' : 'monospace'
                            }}>
                              {isEmail && <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '6px', marginBottom: '8px', fontWeight: 700 }}>{t("Tiêu đề email:")} {log.subject}</div>}
                              {log.body}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', gap: 8 }}>
                    <MessageSquare size={32} style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: '0.875rem' }}>{t('Không tìm thấy log thông báo nào.')}</span>
                  </div>
                )}
              </div>

              {/* Logs Pagination */}
              {!isNotifLogsLoading && notifTotalCount > 10 && (
                <div 
                  className="pagination-container"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-border-light)'
                  }}
                >
                  <span 
                    className="pagination-text"
                    style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}
                  >
                    {t('Hiển thị')} {((notifPage - 1) * 10) + 1} - {Math.min(notifPage * 10, notifTotalCount)} {t('của')} {notifTotalCount} {t('log')}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      disabled={notifPage === 1}
                      onClick={() => setNotifPage(prev => Math.max(prev - 1, 1))}
                      className="btn outline"
                      style={{
                        padding: '3px 8px',
                        height: '26px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: notifPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: notifPage === 1 ? 0.5 : 1
                      }}
                    >
                      {t('Trước')}
                    </button>
                    
                    {(() => {
                      const totalPages = Math.ceil(notifTotalCount / 10);
                      const pages = [];
                      const startPage = Math.max(1, notifPage - 2);
                      const endPage = Math.min(totalPages, startPage + 4);
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(i);
                      }
                      return pages.map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setNotifPage(pageNum)}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border-light)',
                            background: notifPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: notifPage === pageNum ? 'white' : 'var(--color-text)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                        >
                          {pageNum}
                        </button>
                      ));
                    })()}

                    <button
                      disabled={notifPage === Math.ceil(notifTotalCount / 10)}
                      onClick={() => setNotifPage(prev => Math.min(prev + 1, Math.ceil(notifTotalCount / 10)))}
                      className="btn outline"
                      style={{
                        padding: '3px 8px',
                        height: '26px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: notifPage === Math.ceil(notifTotalCount / 10) ? 'not-allowed' : 'pointer',
                        opacity: notifPage === Math.ceil(notifTotalCount / 10) ? 0.5 : 1
                      }}
                    >
                      {t('Sau')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CustomModal>
      
      {/* Mobile Bottom Navigation Bar */}
      <div className="mobile-bottom-nav">
        <button 
          className={`mobile-bottom-nav-item ${location.pathname === '/contacts' ? 'active' : ''}`}
          onClick={() => navigate('/contacts')}
        >
          <Users size={20} />
          <span className="mobile-bottom-nav-item-label">{t('Khách hàng')}</span>
        </button>
        <button 
          className={`mobile-bottom-nav-item ${location.pathname === '/workspace' ? 'active' : ''}`}
          onClick={() => navigate('/workspace')}
        >
          <CheckSquare size={20} />
          <span className="mobile-bottom-nav-item-label">{t('Bàn làm việc')}</span>
        </button>
        <button 
          className={`mobile-bottom-nav-item ${location.pathname === '/databank' ? 'active' : ''}`}
          onClick={() => navigate('/databank')}
        >
          <Database size={20} />
          <span className="mobile-bottom-nav-item-label">{t('Kho Data')}</span>
        </button>
        <button 
          className={`mobile-bottom-nav-item ${location.pathname === '/account' ? 'active' : ''}`}
          onClick={() => navigate('/account')}
        >
          <UserCheck size={20} />
          <span className="mobile-bottom-nav-item-label">{t('Tài khoản')}</span>
        </button>
      </div>

      <AIChatbot />



      {/* Global Check-in Modal */}
      {checkInModalOpen && (
        <CustomModal
          isOpen={checkInModalOpen}
          onClose={() => setCheckInModalOpen(false)}
          title={t("CHẤM CÔNG HÀNG NGÀY")}
          width="500px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {t('Vui lòng chụp ảnh selfie khuôn mặt của bạn để thực hiện chấm công và nhận data hôm nay.')}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid var(--color-border)'
              }}>
                {t('Giờ vào làm quy định:')} <span style={{ color: '#BD1D2D' }}>{consultantProfile?.work_start_time || '08:00'}</span>
              </div>
            </div>

            <div style={{
              position: 'relative',
              width: '260px',
              height: '260px',
              backgroundColor: '#000',
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px solid var(--color-border)',
              margin: '0 auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
            }}>
              {capturedImage ? (
                <img
                  src={capturedImage}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  alt="Captured Selfie"
                />
              ) : isCameraActive ? (
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  playsInline
                  muted
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#fff', padding: '20px', textAlign: 'center' }}>
                  <Camera size={40} style={{ opacity: 0.5 }} />
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                    {cameraError || t('Camera chưa được kích hoạt')}
                  </span>
                  <button
                    type="button"
                    className="btn primary sm"
                    onClick={startCamera}
                    style={{ backgroundColor: '#BD1D2D', border: 'none' }}
                  >
                    {t('Kích hoạt Camera')}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {isCameraActive && !capturedImage && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={capturePhoto}
                  style={{
                    backgroundColor: '#BD1D2D',
                    color: '#fff',
                    borderRadius: '20px',
                    padding: '8px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Camera size={16} />
                  {t('Chụp ảnh selfie')}
                </button>
              )}
              {capturedImage && (
                <button
                  type="button"
                  className="btn outline"
                  onClick={startCamera}
                  style={{
                    borderRadius: '20px',
                    padding: '8px 20px'
                  }}
                >
                  {t('Chụp lại')}
                </button>
              )}
            </div>

            {isLate && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--color-danger)', fontSize: '0.8125rem', fontWeight: 700 }}>
                  <AlertTriangle size={16} />
                  {t('Bạn đã trễ giờ làm việc!')}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', margin: 0 }}>
                  {t('Vui lòng gửi lý do "Xin nhận lead hôm nay" để Quản lý duyệt mở cổng nhận data.')}
                </p>
                <textarea
                  className="form-control"
                  style={{
                    width: '100%',
                    height: '70px',
                    fontSize: '0.8125rem',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    resize: 'none'
                  }}
                  placeholder={t('Ví dụ: Kẹt xe tại ngã tư Thủ Đức, hỏng xe...')}
                  value={checkInReason}
                  onChange={(e) => setCheckInReason(e.target.value)}
                  required
                />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1.25rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
            <button className="btn outline" onClick={() => setCheckInModalOpen(false)} disabled={checkInSubmitting}>{t('Đóng')}</button>
            <button className="btn primary" onClick={handleGlobalCheckIn} disabled={checkInSubmitting} style={{ backgroundColor: '#BD1D2D', border: 'none' }}>
              {checkInSubmitting ? t('Đang gửi...') : t('Xác nhận Chấm công')}
            </button>
          </div>
        </CustomModal>
      )}

      {isTelegramModalOpen && (
        <CustomModal
          isOpen={isTelegramModalOpen}
          onClose={() => setIsTelegramModalOpen(false)}
          title={t("Liên kết Telegram")}
          width="380px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '1rem 0 0.5rem 0', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '0.5rem 0 0.25rem 0' }}>
              {/* Richland Logo */}
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: '2px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                overflow: 'hidden'
              }}>
                <img 
                  src="/LOGO.jpg" 
                  alt="Rich Land" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              </div>

              {/* Connecting icon */}
              <div style={{ display: 'flex', alignItems: 'center', color: '#BD1D2D' }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>

              {/* Telegram Logo */}
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#0088cc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(0, 136, 204, 0.25)',
                color: '#fff'
              }}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                  <path d="M21.9 2.1c-.2-.1-.5-.1-.7 0L1.6 9.8c-.6.2-.7.6-.2.9l5.3 1.9 2 6.2c.2.5.5.6.8.3l3-2.6 5.3 3.9c.7.5 1.3.2 1.5-.6l3.9-18.3c.2-.7-.3-1.2-1.1-1.1zM8.9 11.9l8.6-5.4c.1-.1.3 0 .2.1l-7.2 6.5-.3 2.5c-.1.5-.4.6-.6.1l-1.7-4.4z"/>
                </svg>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.925rem', color: 'var(--color-text)', lineHeight: '1.6', padding: '0 8px' }}>
              {t('Nhấp nút bên dưới để mở Telegram và kích hoạt nhận thông báo chia data khách hàng tức thời.')}
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              gap: '10px',
              marginTop: '0.5rem',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)'
            }}>
              <a
                href={`https://t.me/${sysSettings?.telegram_bot_username || 'richlandvietnam_bot'}?start=${consultantProfile?.id || user?.id || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsTelegramModalOpen(false)}
                className="btn primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#BD1D2D',
                  border: 'none',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.925rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(189, 29, 45, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                LIÊN KẾT NHANH 1-CLICK
              </a>
            </div>
          </div>
        </CustomModal>
      )}

      <style>{`
        @keyframes pulse-avatar-global {
          0% { transform: scale(1); box-shadow: 0 4px 20px rgba(189, 29, 45, 0.4); }
          50% { transform: scale(1.08); box-shadow: 0 4px 24px rgba(189, 29, 45, 0.7); }
          100% { transform: scale(1); box-shadow: 0 4px 20px rgba(189, 29, 45, 0.4); }
        }
      `}</style>
    </div>
  );
};

