import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { QuickAddLeadModal } from '../QuickAddLeadModal';
import { ProfileModal } from '../ProfileModal';
import { CustomModal } from '../ui/CustomModal';
import { CustomSelect } from '../ui/CustomSelect';
import { Avatar } from '../ui/Avatar';
import { AIChatbot } from '../ui/AIChatbot';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAPI } from '../../utils/api';
import { 
  Ticket as TicketIcon, 
  Activity, 
  UserCheck, 
  Clock, 
  ShieldAlert, 
  AlertTriangle, 
  Settings, 
  LogIn, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  HelpCircle, 
  CheckCircle2, 
  XCircle,
  Mail,
  MessageSquare,
  Search,
  Check
} from 'lucide-react';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { t, language } = useLanguage();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Notification states
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState<boolean>(false);
  const [heldLeadsCount, setHeldLeadsCount] = useState<number>(0);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState<boolean>(false);

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
    if (user) {
      fetchAPI('get_settings')
        .then(res => {
          if (res && res.success && res.data && res.data.backend_version) {
            setBackendVersion(res.data.backend_version);
            localStorage.setItem('backend_version', res.data.backend_version);
          }
        })
        .catch(() => {});
    }
  }, [user]);


  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      fetchAPI('get_reports&status=pending&date=all&pageSize=1')
        .then(res => {
          if (res.success) {
            const count = res.total_count ?? 0;
            if (count > 0) {
              setPendingTicketsCount(count);
              setIsTicketModalOpen(true);
            }
          }
        })
        .catch(err => console.error('Error loading ticket notification:', err));

      fetchAPI('get_held_leads&pageSize=1&date=all')
        .then(res => {
          if (res.success) {
            const total = res.total_count ?? 0;
            if (total > 0) {
              setHeldLeadsCount(total);
              setIsHeldModalOpen(true);
            }
          }
        })
        .catch(err => console.error('Error loading held leads notification:', err));
    }
  }, [user]);

  const handleViewTickets = () => {
    setIsTicketModalOpen(false);
    setIsHeldModalOpen(false);
    navigate('/tickets');
  };

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
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <Header 
          onActivityFeedClick={() => setIsActivityFeedOpen(true)}
          onMenuClick={() => setIsMobileSidebarOpen(true)}
          version={backendVersion}
        />


        <main className="responsive-main" style={{ flex: 1, overflow: 'auto', padding: '2rem 3rem', position: 'relative', zIndex: 10 }}>
          <div style={{ width: '100%' }}>
            {children}
          </div>
        </main>
      </div>
      <QuickAddLeadModal />
      <ProfileModal />

      {/* Ticket Notification Modal */}
      <CustomModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        title={t("Thông báo Ticket mới")}
        width={420}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1rem 0.5rem' }}>
          <div style={{ 
            width: 56, 
            height: 56, 
            borderRadius: '50%', 
            background: 'rgba(239, 68, 68, 0.08)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginBottom: '1rem',
            color: 'var(--color-danger)'
          }}>
            <TicketIcon size={28} />
          </div>
          
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
            {t("Yêu cầu cần xử lý!")}
          </h3>
          
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
            {t("Hệ thống ghi nhận đang có")} <strong style={{ color: 'var(--color-danger)', fontSize: '1rem', fontWeight: 'bold' }}>{pendingTicketsCount}</strong> {t("ticket báo lỗi dữ liệu từ các Tư vấn viên đang chờ bạn phê duyệt đền bù.")}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            <button 
              onClick={() => setIsTicketModalOpen(false)}
              onMouseEnter={() => setIsTicketLaterHovered(true)}
              onMouseLeave={() => setIsTicketLaterHovered(false)}
              style={{ 
                flex: 1, 
                height: 42, 
                fontWeight: 600, 
                borderRadius: '9999px', 
                border: isTicketLaterHovered ? '1.5px solid var(--color-primary-hover)' : '1.5px solid var(--color-primary)', 
                color: isTicketLaterHovered ? 'var(--color-primary-hover)' : 'var(--color-primary)', 
                background: isTicketLaterHovered ? 'var(--color-primary-light)' : 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                transform: isTicketLaterHovered ? 'translateY(-1px)' : 'none'
              }}
            >
              {t("Để sau")}
            </button>
            <button 
              onClick={handleViewTickets}
              onMouseEnter={() => setIsTicketViewHovered(true)}
              onMouseLeave={() => setIsTicketViewHovered(false)}
              style={{ 
                flex: 1, 
                height: 42, 
                fontWeight: 600, 
                borderRadius: '9999px',
                background: isTicketViewHovered 
                  ? 'linear-gradient(135deg, #b59dfb 0%, #8a0f1b 100%)' 
                  : 'linear-gradient(135deg, #a78bfa 0%, #a31422 100%)',
                border: 'none',
                color: '#fff',
                boxShadow: isTicketViewHovered 
                  ? '0 6px 20px rgba(163, 20, 34, 0.4)' 
                  : '0 4px 12px rgba(163, 20, 34, 0.25)',
                display: 'inline-flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                transform: isTicketViewHovered ? 'translateY(-1px)' : 'none'
              }}
            >
              {t("Xem ngay")}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Held Leads Notification Modal */}
      <CustomModal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
        title={getTranslation("Thông báo Data tạm giữ", "Thông báo Data tạm giữ")}
        width={420}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1rem 0.5rem' }}>
          <div style={{ 
            width: 56, 
            height: 56, 
            borderRadius: '50%', 
            background: 'rgba(163, 20, 34, 0.08)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginBottom: '1rem',
            color: 'var(--color-primary)'
          }}>
            <ShieldAlert size={28} />
          </div>
          
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
            {t("Yêu cầu cần xử lý!")}
          </h3>
          
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
            {t("Hệ thống ghi nhận đang có")} <strong style={{ color: 'var(--color-primary)', fontSize: '1rem', fontWeight: 'bold' }}>{heldLeadsCount}</strong> {getTranslation("dữ liệu bị tạm giữ bởi AI Pre-screener đang chờ bạn phê duyệt.", "dữ liệu bị tạm giữ bởi AI Pre-screener đang chờ bạn phê duyệt.")}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            <button 
              onClick={() => setIsHeldModalOpen(false)}
              onMouseEnter={() => setIsHeldLaterHovered(true)}
              onMouseLeave={() => setIsHeldLaterHovered(false)}
              style={{ 
                flex: 1, 
                height: 42, 
                fontWeight: 600, 
                borderRadius: '9999px', 
                border: isHeldLaterHovered ? '1.5px solid var(--color-primary-hover)' : '1.5px solid var(--color-primary)', 
                color: isHeldLaterHovered ? 'var(--color-primary-hover)' : 'var(--color-primary)', 
                background: isHeldLaterHovered ? 'var(--color-primary-light)' : 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                transform: isHeldLaterHovered ? 'translateY(-1px)' : 'none'
              }}
            >
              {t("Để sau")}
            </button>
            <button 
              onClick={() => {
                setIsHeldModalOpen(false);
                setIsTicketModalOpen(false);
                navigate('/gatekeeper');
              }}
              onMouseEnter={() => setIsHeldViewHovered(true)}
              onMouseLeave={() => setIsHeldViewHovered(false)}
              style={{ 
                flex: 1, 
                height: 42, 
                fontWeight: 600, 
                borderRadius: '9999px',
                background: isHeldViewHovered 
                  ? 'linear-gradient(135deg, #b59dfb 0%, #8a0f1b 100%)' 
                  : 'linear-gradient(135deg, #a78bfa 0%, #a31422 100%)',
                border: 'none',
                color: '#fff',
                boxShadow: isHeldViewHovered 
                  ? '0 6px 20px rgba(163, 20, 34, 0.4)' 
                  : '0 4px 12px rgba(163, 20, 34, 0.25)',
                display: 'inline-flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                transform: isHeldViewHovered ? 'translateY(-1px)' : 'none'
              }}
            >
              {t("Xem ngay")}
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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                    <RefreshCw size={32} className="spin" style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{t('Đang tải log thông báo...')}</span>
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
      <AIChatbot />
    </div>
  );
};

