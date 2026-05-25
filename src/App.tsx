import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Calendar, Sparkles, TrendingUp, AlertCircle, ListCollapse, ArrowRight, Keyboard } from 'lucide-react';
import { CustomModal } from './components/ui/CustomModal';

// Lazy load all pages for Code Splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Consultants = lazy(() => import('./pages/Consultants').then(module => ({ default: module.Consultants })));
const Rounds = lazy(() => import('./pages/Rounds').then(module => ({ default: module.Rounds })));
const Tickets = lazy(() => import('./pages/Tickets').then(module => ({ default: module.Tickets })));
const RuleSettings = lazy(() => import('./pages/RuleSettings').then(module => ({ default: module.RuleSettings })));
const Integrations = lazy(() => import('./pages/Integrations').then(module => ({ default: module.Integrations })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const DataList = lazy(() => import('./pages/DataList').then(module => ({ default: module.DataList })));
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Accounts = lazy(() => import('./pages/Accounts').then(module => ({ default: module.Accounts })));
const ReportData = lazy(() => import('./pages/ReportData').then(module => ({ default: module.ReportData })));
const DemoEntry = lazy(() => import('./pages/DemoEntry').then(module => ({ default: module.DemoEntry })));
const SalePortal = lazy(() => import('./pages/SalePortal').then(module => ({ default: module.SalePortal })));
const FairShareAudit = lazy(() => import('./pages/FairShareAudit').then(module => ({ default: module.FairShareAudit })));

// Loading spinner fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: ('admin' | 'assistant' | 'viewer' | 'sale')[] }) => {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
};

// AppTabs wrapper to keep page DOMs alive and avoid unmount/remount loading screens
const AppTabs = () => {
  const { user } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  // Track which paths have been visited to lazy-load their components (code-split)
  const [visitedPaths, setVisitedPaths] = useState<string[]>([currentPath]);

  useEffect(() => {
    if (!visitedPaths.includes(currentPath)) {
      setVisitedPaths(prev => [...prev, currentPath]);
    }
  }, [currentPath, visitedPaths]);

  // Route protection mapping
  const adminPaths = ['/consultants', '/rounds', '/tickets', '/rules', '/integrations', '/settings', '/accounts', '/fair-share'];
  const isAdminPath = adminPaths.includes(currentPath);

  if (isAdminPath && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* User Pages */}
      <div style={{ display: currentPath === '/' ? 'block' : 'none' }}>
        {visitedPaths.includes('/') && <Dashboard />}
      </div>
      <div style={{ display: currentPath === '/data' ? 'block' : 'none' }}>
        {visitedPaths.includes('/data') && <DataList />}
      </div>

      {/* Admin Pages */}
      {user?.role === 'admin' && (
        <>
          <div style={{ display: currentPath === '/consultants' ? 'block' : 'none' }}>
            {visitedPaths.includes('/consultants') && <Consultants />}
          </div>
          <div style={{ display: currentPath === '/rounds' ? 'block' : 'none' }}>
            {visitedPaths.includes('/rounds') && <Rounds />}
          </div>
          <div style={{ display: currentPath === '/tickets' ? 'block' : 'none' }}>
            {visitedPaths.includes('/tickets') && <Tickets />}
          </div>
          <div style={{ display: currentPath === '/rules' ? 'block' : 'none' }}>
            {visitedPaths.includes('/rules') && <RuleSettings />}
          </div>
          <div style={{ display: currentPath === '/integrations' ? 'block' : 'none' }}>
            {visitedPaths.includes('/integrations') && <Integrations />}
          </div>
          <div style={{ display: currentPath === '/settings' ? 'block' : 'none' }}>
            {visitedPaths.includes('/settings') && <Settings />}
          </div>
          <div style={{ display: currentPath === '/accounts' ? 'block' : 'none' }}>
            {visitedPaths.includes('/accounts') && <Accounts />}
          </div>
          <div style={{ display: currentPath === '/fair-share' ? 'block' : 'none' }}>
            {visitedPaths.includes('/fair-share') && <FairShareAudit />}
          </div>
        </>
      )}

    </div>
  );
};

interface CalendarPromoModalProps {
  onClose: () => void;
}

const CalendarPromoModal = ({ onClose }: CalendarPromoModalProps) => {
  const navigate = useNavigate();

  const handleAction = () => {
    localStorage.setItem('has_seen_calendar_notification', 'true');
    onClose();
    navigate('/data?view=calendar');
  };

  const handleDecline = () => {
    localStorage.setItem('has_seen_calendar_notification', 'true');
    onClose();
  };

  return (
    <div className="promo-overlay">
      <div className="promo-modal-container">
        {/* Header Visual with Gradient */}
        <div className="promo-header">
          <div className="promo-badge">
            <Sparkles size={12} className="sparkle-icon" />
            TÍNH NĂNG MỚI
          </div>
          
          <div className="promo-icon-wrapper">
            <div className="promo-icon-glow" />
            <div className="promo-icon-circle">
              <Calendar size={38} className="promo-calendar-icon" />
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="promo-body">
          <div className="promo-title-wrapper">
            <h3 className="promo-title">
              Giao Diện Lịch Biểu Mới!
            </h3>
            <p className="promo-subtitle">
              Chúng tôi vừa cập nhật giao diện xem trực quan mới, giúp bạn quản lý và tối ưu hóa phân phối lead hiệu quả hơn.
            </p>
          </div>

          <div className="promo-cards-list">
            {/* Card 1 */}
            <div className="promo-feature-card promo-card-indigo" onClick={handleAction}>
              <div className="promo-card-icon-container">
                <TrendingUp size={18} />
              </div>
              <div className="promo-card-content">
                <span className="promo-card-title">Thống kê trực quan</span>
                <span className="promo-card-text">
                  Theo dõi số lượng lead được chia mỗi ngày của từng sale rep theo dạng lịch biểu tháng.
                </span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="promo-feature-card promo-card-rose" onClick={handleAction}>
              <div className="promo-card-icon-container">
                <AlertCircle size={18} />
              </div>
              <div className="promo-card-content">
                <span className="promo-card-title">Quản lý sự cố</span>
                <span className="promo-card-text">
                  Thống kê và theo dõi số lượng blacklist, lead trùng, và lỗi hệ thống chi tiết từng ngày.
                </span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="promo-feature-card promo-card-emerald" onClick={handleAction}>
              <div className="promo-card-icon-container">
                <ListCollapse size={18} />
              </div>
              <div className="promo-card-content">
                <span className="promo-card-title">Bảng kê chi tiết</span>
                <span className="promo-card-text">
                  Click chọn ngày bất kỳ trên lịch để tra cứu danh sách cuộc gọi, rounds và ticket đền bù.
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="promo-actions">
            <button
              type="button"
              onClick={handleAction}
              className="promo-btn promo-btn-primary"
            >
              Trải nghiệm ngay
              <ArrowRight size={16} style={{ marginLeft: '6px' }} />
            </button>
            <button
              type="button"
              onClick={handleDecline}
              className="promo-btn promo-btn-secondary"
            >
              Để sau
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .promo-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(8, 10, 24, 0.75);
          backdrop-filter: blur(12px);
          z-index: 9999999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: promoFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .promo-modal-container {
          background: var(--color-surface);
          border-radius: 28px;
          width: 500px;
          max-width: calc(100vw - 2.5rem);
          box-shadow: 
            0 10px 25px -5px rgba(0, 0, 0, 0.1),
            0 25px 50px -12px rgba(0, 0, 0, 0.25),
            0 0 40px rgba(99, 102, 241, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: promoScaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .promo-header {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%);
          padding: 2.5rem 2rem 2rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .promo-badge {
          background: rgba(255, 255, 255, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(4px);
          color: #ffffff;
          font-size: 0.6875rem;
          font-weight: 800;
          letter-spacing: 1.5px;
          border-radius: 30px;
          padding: 5px 14px;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        }

        .sparkle-icon {
          animation: sparkleAnimation 2s infinite ease-in-out;
        }

        .promo-icon-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .promo-icon-glow {
          position: absolute;
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: #db2777;
          filter: blur(20px);
          opacity: 0.6;
          animation: glowPulse 3s infinite ease-in-out;
        }

        .promo-icon-circle {
          position: relative;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            0 10px 25px rgba(99, 102, 241, 0.25),
            inset 0 -4px 8px rgba(0, 0, 0, 0.05);
          animation: floatIcon 4s infinite ease-in-out;
        }

        .promo-calendar-icon {
          color: #7c3aed;
        }

        .promo-body {
          padding: 2rem 2.25rem 2.25rem 2.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .promo-title-wrapper {
          text-align: center;
        }

        .promo-title {
          font-size: 1.45rem;
          font-weight: 900;
          background: linear-gradient(135deg, var(--color-primary) 0%, #d946ef 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.5px;
        }

        .promo-subtitle {
          font-size: 0.875rem;
          color: var(--color-text-muted);
          line-height: 1.55;
          margin: 0;
          padding: 0 0.5rem;
        }

        .promo-cards-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .promo-feature-card {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 0.875rem 1rem;
          background: var(--color-surface);
          border: 1px solid var(--color-border-light);
          border-radius: 16px;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          cursor: pointer;
        }

        .promo-feature-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.04);
          border-color: rgba(99, 102, 241, 0.2);
        }

        .promo-card-indigo {
          border-left: 4px solid #6366f1;
        }
        .promo-card-indigo .promo-card-icon-container {
          background: rgba(99, 102, 241, 0.1);
          color: #6366f1;
        }

        .promo-card-rose {
          border-left: 4px solid #f43f5e;
        }
        .promo-card-rose .promo-card-icon-container {
          background: rgba(244, 63, 94, 0.1);
          color: #f43f5e;
        }

        .promo-card-emerald {
          border-left: 4px solid #10b981;
        }
        .promo-card-emerald .promo-card-icon-container {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .promo-card-icon-container {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.2s;
        }

        .promo-feature-card:hover .promo-card-icon-container {
          transform: scale(1.05);
        }

        .promo-card-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .promo-card-title {
          font-size: 0.875rem;
          font-weight: 750;
          color: var(--color-text);
        }

        .promo-card-text {
          font-size: 0.8125rem;
          color: var(--color-text-light);
          line-height: 1.45;
        }

        .promo-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.25rem;
        }

        .promo-btn {
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .promo-btn-primary {
          flex: 1.5;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: #ffffff;
          border: none;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
        }

        .promo-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
          filter: brightness(1.05);
        }

        .promo-btn-primary:active {
          transform: translateY(0);
        }

        .promo-btn-secondary {
          flex: 1;
          background: var(--color-surface-hover);
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
        }

        .promo-btn-secondary:hover {
          background: var(--color-border-light);
          color: var(--color-text);
        }

        @keyframes promoFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes promoScaleUp {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes sparkleAnimation {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.8; }
          50% { transform: scale(1.2) rotate(15deg); opacity: 1; }
        }

        @keyframes glowPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }

        @keyframes floatIcon {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(3deg); }
        }

        @media (max-width: 480px) {
          .promo-modal-container {
            max-width: calc(100vw - 1.5rem) !important;
          }
          .promo-body {
            padding: 1.25rem 1rem 1.5rem 1rem !important;
            gap: 1rem !important;
          }
          .promo-title {
            font-size: 1.2rem !important;
          }
          .promo-subtitle {
            font-size: 0.78rem !important;
            padding: 0 !important;
          }
          .promo-feature-card {
            padding: 0.65rem 0.75rem !important;
            border-radius: 12px !important;
          }
          .promo-card-title {
            font-size: 0.8rem !important;
          }
          .promo-card-text {
            font-size: 0.75rem !important;
          }
        }
      `}</style>
    </div>
  );
};

const CalendarPromoController = () => {
  const { user } = useAuth();
  const [showCalendarPromo, setShowCalendarPromo] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      const hasSeen = localStorage.getItem('has_seen_calendar_notification');
      if (!hasSeen) {
        setShowCalendarPromo(true);
      }
    }
  }, [user]);

  if (!showCalendarPromo) return null;

  return (
    <CalendarPromoModal 
      onClose={() => setShowCalendarPromo(false)} 
    />
  );
};

const KeyboardShortcutsController = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.hasAttribute('contenteditable')
      );

      if (e.key === 'Escape') {
        if (isInputActive) {
          (activeEl as HTMLElement).blur();
        } else {
          setShowHelpModal(false);
        }
        return;
      }

      if (isInputActive) {
        return;
      }

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowHelpModal(prev => !prev);
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();

        if (key === 'n') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
          setShowHelpModal(false);
          return;
        }

        if (key === 'h') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('open-activity-feed'));
          setShowHelpModal(false);
          return;
        }

        const shortcuts: Record<string, string> = {
          d: '/',
          l: '/data',
        };

        if (user?.role === 'admin') {
          shortcuts.s = '/fair-share';
          shortcuts.r = '/rounds';
          shortcuts.c = '/consultants';
          shortcuts.t = '/tickets';
          shortcuts.w = '/rules';
          shortcuts.i = '/integrations';
          shortcuts.o = '/settings';
          shortcuts.a = '/accounts';
        }

        if (shortcuts[key] !== undefined) {
          e.preventDefault();
          navigate(shortcuts[key]);
          setShowHelpModal(false);
        }
      }
    };

    const handleOpenHelp = () => {
      setShowHelpModal(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-keyboard-shortcuts', handleOpenHelp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-keyboard-shortcuts', handleOpenHelp);
    };
  }, [user, navigate, token]);

  if (!token) return null;

  const isSystemAdmin = user?.role === 'admin';

  return (
    <>
      <CustomModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="Bảng phím tắt điều hướng nhanh"
        width="650px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
            <Keyboard size={20} />
            <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Mẹo: Nhấn Alt + [Chữ cái] để chuyển hướng nhanh toàn hệ thống</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isSystemAdmin ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
            {/* Column 1: Chung & Vận hành */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                  Chung & Vận hành
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text)' }}>Trang chủ Dashboard</span>
                    <kbd className="shortcuts-kbd">Alt + D</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text)' }}>Nhật ký Lead (Data)</span>
                    <kbd className="shortcuts-kbd">Alt + L</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text)' }}>Thêm Data (Lead) nhanh</span>
                    <kbd className="shortcuts-kbd">Alt + N</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text)' }}>Bản tin hoạt động hệ thống</span>
                    <kbd className="shortcuts-kbd">Alt + H</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text)' }}>Xem kịch bản trợ giúp này</span>
                    <kbd className="shortcuts-kbd">?</kbd>
                  </div>
                </div>
              </div>

              {isSystemAdmin && (
                <div>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                    Chia số & Đối soát
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>Vòng xoay chia số (Rounds)</span>
                      <kbd className="shortcuts-kbd">Alt + R</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>Quy tắc chia số (Rules)</span>
                      <kbd className="shortcuts-kbd">Alt + W</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>Đối soát Công bằng (Fair Share)</span>
                      <kbd className="shortcuts-kbd">Alt + S</kbd>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Nhân sự & Quản trị */}
            {isSystemAdmin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                    Nhân sự & Tickets
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>Quản lý Tư vấn viên (Sale)</span>
                      <kbd className="shortcuts-kbd">Alt + C</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>Quản lý Tickets báo lỗi</span>
                      <kbd className="shortcuts-kbd">Alt + T</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                    Cấu hình & Quản trị
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>Tích hợp API & Google Sheets</span>
                      <kbd className="shortcuts-kbd">Alt + I</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>Cài đặt Hệ thống</span>
                      <kbd className="shortcuts-kbd">Alt + O</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>Tài khoản phân quyền</span>
                      <kbd className="shortcuts-kbd">Alt + A</kbd>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button className="btn primary" onClick={() => setShowHelpModal(false)}>Đóng</button>
          </div>
        </div>
      </CustomModal>

      <style>{`
        .shortcuts-kbd {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-bottom: 2px solid var(--color-border);
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 0.75rem;
          font-family: monospace;
          font-weight: 800;
          color: var(--color-primary);
          box-shadow: var(--shadow-xs);
          user-select: none;
        }
      `}</style>
    </>
  );
};

export default function App() {
  useEffect(() => {
    const localTheme = localStorage.getItem('domation_theme') as 'light' | 'dark';
    if (localTheme) {
      document.documentElement.setAttribute('data-theme', localTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster position="top-right" />
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/report-data" element={<ReportData />} />
              <Route path="/demo" element={<DemoEntry />} />
              <Route path="/sale-portal" element={<SalePortal />} />
              
              {/* Admin only routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/consultants" element={<AppTabs />} />
                <Route path="/rounds" element={<AppTabs />} />
                <Route path="/tickets" element={<AppTabs />} />
                <Route path="/rules" element={<AppTabs />} />
                <Route path="/integrations" element={<AppTabs />} />
                <Route path="/settings" element={<AppTabs />} />
                <Route path="/accounts" element={<AppTabs />} />
                <Route path="/fair-share" element={<AppTabs />} />
              </Route>

              {/* All authenticated users */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<AppTabs />} />
                <Route path="/data" element={<AppTabs />} />
              </Route>
            </Routes>
            <CalendarPromoController />
            <KeyboardShortcutsController />
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
