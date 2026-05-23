import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Notification states
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState<boolean>(false);

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
      console.error('Lỗi khi tải bản tin hoạt động:', err);
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
        .catch(err => console.error('Lỗi khi tải thông báo ticket:', err));
    }
  }, [user]);

  const handleViewTickets = () => {
    setIsTicketModalOpen(false);
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
          onMenuClick={() => {
            if (window.innerWidth <= 1024) setIsMobileSidebarOpen(true);
            else setIsSidebarCollapsed(!isSidebarCollapsed);
          }} 
          onActivityFeedClick={() => setIsActivityFeedOpen(true)}
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
        title="Thông báo Ticket mới"
        width={420}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1rem 0.5rem' }}>
          <div style={{ 
            width: 56, 
            height: 56, 
            borderRadius: '50%', 
            background: 'rgba(239, 68, 68, 0.1)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginBottom: '1rem',
            color: 'var(--color-danger)'
          }}>
            <TicketIcon size={28} />
          </div>
          
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>
            Yêu cầu cần xử lý!
          </h3>
          
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
            Hệ thống ghi nhận đang có <strong style={{ color: 'var(--color-danger)', fontSize: '1rem' }}>{pendingTicketsCount}</strong> ticket báo lỗi dữ liệu từ các Tư vấn viên đang chờ bạn phê duyệt đền bù.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            <button 
              className="btn outline" 
              onClick={() => setIsTicketModalOpen(false)}
              style={{ flex: 1, height: 42, fontWeight: 600 }}
            >
              Để sau
            </button>
            <button 
              className="btn primary" 
              onClick={handleViewTickets}
              style={{ flex: 1, height: 42, background: 'var(--color-primary)', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
            >
              Xem ngay
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Activity Feed Modal */}
      <CustomModal
        isOpen={isActivityFeedOpen}
        onClose={() => setIsActivityFeedOpen(false)}
        title="Bản tin hoạt động hệ thống"
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
              Danh sách hoạt động và phân bổ gần đây nhất
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
              Làm mới
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
                    ? (item.consultant_name || 'Hệ thống')
                    : (item.type === 'ticket'
                        ? (item.consultant_name || 'Hệ thống')
                        : (item.admin_name || 'Hệ thống'));
                  
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
                                  <>Thu gọn <ChevronUp size={12} /></>
                                ) : (
                                  <>Chi tiết <ChevronDown size={12} /></>
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
                <span style={{ fontSize: '0.875rem' }}>Không có hoạt động nào được ghi nhận gần đây.</span>
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
                Hiển thị {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, feedItems.length)} của {feedItems.length} hoạt động
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
                  Trước
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
                  Sau
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

