import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { QuickAddLeadModal } from '../QuickAddLeadModal';
import { ProfileModal } from '../ProfileModal';
import { CustomModal } from '../ui/CustomModal';
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
  XCircle 
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
  const [isFeedLoading, setIsFeedLoading] = useState(false);
  const [expandedFeedItem, setExpandedFeedItem] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchFeed = async () => {
    setIsFeedLoading(true);
    try {
      const res = await fetchAPI('get_system_activity_feed');
      if (res.success && Array.isArray(res.data)) {
        setFeedItems(res.data);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error('Error loading activity feed:', err);
    } finally {
      setIsFeedLoading(false);
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
    if (user?.role === 'admin') {
      fetchAPI('get_reports')
        .then(res => {
          if (res.success && Array.isArray(res.data)) {
            const pending = res.data.filter((r: any) => r.status === 'pending');
            if (pending.length > 0) {
              setPendingTicketsCount(pending.length);
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
        return { icon: <UserCheck size={size} />, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' };
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
        />

        <main className="responsive-main" style={{ flex: 1, overflow: 'auto', padding: '2rem 3rem', position: 'relative', zIndex: 10 }}>
          <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
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
                  ? 'linear-gradient(135deg, #b59dfb 0%, #6d28d9 100%)' 
                  : 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                border: 'none',
                color: '#fff',
                boxShadow: isTicketViewHovered 
                  ? '0 6px 20px rgba(124, 58, 237, 0.4)' 
                  : '0 4px 12px rgba(124, 58, 237, 0.25)',
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
            background: 'rgba(124, 58, 237, 0.08)', 
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
                  ? 'linear-gradient(135deg, #b59dfb 0%, #6d28d9 100%)' 
                  : 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                border: 'none',
                color: '#fff',
                boxShadow: isHeldViewHovered 
                  ? '0 6px 20px rgba(124, 58, 237, 0.4)' 
                  : '0 4px 12px rgba(124, 58, 237, 0.25)',
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
        width={720}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '65vh' }}>
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
            <button
              onClick={fetchFeed}
              disabled={isFeedLoading}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: isFeedLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                outline: 'none'
              }}
            >
              <RefreshCw size={14} className={isFeedLoading ? 'spin' : ''} />
              {t("Làm mới")}
            </button>
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
                        {/* Avatar overlayed with mini event icon */}
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

                        {/* Text Content */}
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
                          
                          {/* Metadata badge and expand trigger */}
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

                      {/* Expandable details panel */}
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
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              paddingTop: '8px',
              borderTop: '1px solid var(--color-border-light)'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
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
        </div>
      </CustomModal>
      <AIChatbot />
    </div>
  );
};

