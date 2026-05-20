import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { QuickAddLeadModal } from '../QuickAddLeadModal';
import { ProfileModal } from '../ProfileModal';
import { CustomModal } from '../ui/CustomModal';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAPI } from '../../utils/api';
import { Ticket as TicketIcon } from 'lucide-react';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Notification states
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState<boolean>(false);

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

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--color-bg)', overflow: 'hidden' }}>
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <Header onMenuClick={() => {
          if (window.innerWidth <= 1024) setIsMobileSidebarOpen(true);
          else setIsSidebarCollapsed(!isSidebarCollapsed);
        }} />

        <main className="responsive-main" style={{ flex: 1, overflow: 'auto', padding: '2rem 3rem', position: 'relative', zIndex: 10 }}>
          <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
      <QuickAddLeadModal />
      <ProfileModal />

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
    </div>
  );
};
