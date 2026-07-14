import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Keyboard } from 'lucide-react';
import { CustomModal } from './components/ui/CustomModal';
import { getDefaultDateFilter } from './utils/api';
import { GlobalConfirmModal } from './components/ui/GlobalConfirmModal';
import { QRCodeCallModal } from './components/ui/QRCodeCallModal';
import { ProfileModal } from './components/ProfileModal';


// Lazy load all pages for Code Splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Consultants = lazy(() => import('./pages/Consultants').then(module => ({ default: module.Consultants })));
const Rounds = lazy(() => import('./pages/Rounds').then(module => ({ default: module.Rounds })));
const Tickets = lazy(() => import('./pages/Tickets').then(module => ({ default: module.Tickets })));
const RuleSettings = lazy(() => import('./pages/RuleSettings').then(module => ({ default: module.RuleSettings })));
const Integrations = lazy(() => import('./pages/Integrations').then(module => ({ default: module.Integrations })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Gatekeeper = lazy(() => import('./pages/Gatekeeper').then(module => ({ default: module.Gatekeeper })));
const DataList = lazy(() => import('./pages/DataList').then(module => ({ default: module.DataList })));
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Accounts = lazy(() => import('./pages/Accounts').then(module => ({ default: module.Accounts })));
const ReportData = lazy(() => import('./pages/ReportData').then(module => ({ default: module.ReportData })));
const DemoEntry = lazy(() => import('./pages/DemoEntry').then(module => ({ default: module.DemoEntry })));
const SalePortal = lazy(() => import('./pages/SalePortal').then(module => ({ default: module.SalePortal })));
const FairShareAudit = lazy(() => import('./pages/FairShareAudit').then(module => ({ default: module.FairShareAudit })));

const ContactsPage = lazy(() => import('./pages/ContactsPage').then(module => ({ default: module.ContactsPage })));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage').then(module => ({ default: module.CompaniesPage })));
const DealsPage = lazy(() => import('./pages/DealsPage').then(module => ({ default: module.DealsPage })));
const QuotesPage = lazy(() => import('./pages/QuotesPage').then(module => ({ default: module.QuotesPage })));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage').then(module => ({ default: module.ActivitiesPage })));
const ProductsPage = lazy(() => import('./pages/ProductsPage').then(module => ({ default: module.ProductsPage })));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage').then(module => ({ default: module.InvoicesPage })));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage').then(module => ({ default: module.ExpensesPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(module => ({ default: module.ReportsPage })));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage').then(module => ({ default: module.SuppliersPage })));
const FilesPage = lazy(() => import('./pages/FilesPage').then(module => ({ default: module.FilesPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(module => ({ default: module.default })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const CooperationSlipsPage = lazy(() => import('./pages/CooperationSlipsPage'));
const DepositsPage = lazy(() => import('./pages/DepositsPage'));
const CapiPage = lazy(() => import('./pages/CapiPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(module => ({ default: module.AttendancePage })));
const TicketsPage = lazy(() => import('./pages/TicketsPage').then(module => ({ default: module.TicketsPage })));

// Loading spinner fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: ('superadmin' | 'admin' | 'manager' | 'director' | 'assistant' | 'viewer' | 'sale')[] }) => {
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

  // Route protection mapping
  const adminPaths = ['/consultants', '/rounds', '/tickets', '/rules', '/integrations', '/settings', '/accounts', '/gatekeeper', '/capi'];
  const userPaths = ['/', '/workspace', '/data', '/calendar', '/databank', '/contacts', '/companies', '/deals', '/quotes', '/activities', '/products', '/invoices', '/expenses', '/reports-crm', '/suppliers', '/files', '/inventory', '/projects', '/cooperation-slips', '/deposits', '/support-tickets', '/attendance'];
  const allPaths = [...userPaths, ...adminPaths];
  const isAdminPath = adminPaths.includes(currentPath);

  // Fallback for unrecognized paths
  if (!allPaths.includes(currentPath)) {
    return <Navigate to="/" replace />;
  }

  if (currentPath === '/accounts') {
    if (!['admin', 'superadmin', 'super_admin', 'director'].includes(user?.role || '')) {
      return <Navigate to="/" replace />;
    }
  } else if (currentPath === '/consultants') {
    if (!['admin', 'superadmin', 'super_admin', 'manager', 'director', 'assistant'].includes(user?.role || '')) {
      return <Navigate to="/" replace />;
    }
  } else if (currentPath === '/invoices' || currentPath === '/deposits' || currentPath === '/attendance') {
    if ((user?.role as string) === 'viewer') {
      return <Navigate to="/" replace />;
    }
  } else if (currentPath === '/quotes') {
    if (!['admin', 'superadmin', 'super_admin', 'manager', 'director', 'assistant', 'sale'].includes(user?.role || '')) {
      return <Navigate to="/" replace />;
    }
  } else if (currentPath === '/expenses') {
    if (!['admin', 'superadmin', 'super_admin', 'manager', 'director', 'assistant'].includes(user?.role || '')) {
      return <Navigate to="/" replace />;
    }
  } else if (currentPath === '/tickets') {
    if (!['admin', 'superadmin', 'super_admin', 'manager', 'director', 'assistant', 'sale', 'sales'].includes(user?.role || '')) {
      return <Navigate to="/" replace />;
    }
  } else if (currentPath === '/fair-share') {
    if (!['admin', 'superadmin', 'super_admin', 'manager', 'director', 'assistant', 'sale', 'sales'].includes(user?.role || '')) {
      return <Navigate to="/" replace />;
    }
  } else if (currentPath === '/activities') {
    if (['sale', 'sales'].includes(user?.role || '')) {
      const searchParams = new URLSearchParams(location.search);
      const taskId = searchParams.get('id');
      if (taskId) {
        return <Navigate to={`/workspace?task_id=${taskId}`} replace />;
      }
      return <Navigate to="/workspace" replace />;
    }
  } else if (isAdminPath) {
    if (!['admin', 'superadmin', 'super_admin', 'director'].includes(user?.role || '')) {
      return <Navigate to="/" replace />;
    }
  }

  const renderPageComponent = () => {
    switch (currentPath) {
      case '/':
        return ((user?.role as any) === 'sale' || (user?.role as any) === 'sales') 
          ? <SalePortal embedMode={true} activeTabProp="dashboard" key="dashboard" /> 
          : <Dashboard key="dashboard" />;
      case '/workspace':
        return <SalePortal embedMode={true} activeTabProp="workspace" key="workspace" />;
      case '/data':
        return user?.role === 'sale' ? <Navigate to="/contacts" replace /> : <DataList key="data" />;
      case '/calendar':
        return user?.role === 'sale' ? <SalePortal embedMode={true} activeTabProp="calendar" key="calendar" /> : <DataList key="calendar" />;
      case '/databank':
        return <SalePortal embedMode={true} activeTabProp="databank" key="databank" />;
      case '/contacts':
        return <ContactsPage key="contacts" />;
      case '/companies':
        return <CompaniesPage key="companies" />;
      case '/deals':
        return <DealsPage key="deals" />;
      case '/quotes':
        return <QuotesPage key="quotes" />;
      case '/activities':
        return <ActivitiesPage key="activities" />;
      case '/products':
        return <ProductsPage key="products" />;
      case '/invoices':
        return <InvoicesPage key="invoices" />;
      case '/expenses':
        return <ExpensesPage key="expenses" />;
      case '/reports-crm':
        return <ReportsPage key="reports-crm" />;
      case '/suppliers':
        return <SuppliersPage key="suppliers" />;
      case '/files':
        return <FilesPage key="files" />;
      case '/inventory':
        return <InventoryPage key="inventory" />;
      case '/tickets':
        return user?.role === 'sale' ? <SalePortal embedMode={true} activeTabProp="tickets" key="tickets" /> : <Tickets key="tickets" />;
      case '/support-tickets':
        return <TicketsPage key="support-tickets" />;
      case '/consultants':
        return <Consultants key="consultants" />;
      case '/rounds':
        return <Rounds key="rounds" />;
      case '/rules':
        return <RuleSettings key="rules" />;
      case '/integrations':
        return <Integrations key="integrations" />;
      case '/settings':
        return <Settings key="settings" />;
      case '/gatekeeper':
        return <Gatekeeper key="gatekeeper" />;
      case '/fair-share':
        return user?.role === 'sale' ? <SalePortal embedMode={true} activeTabProp="fair-share" key="fair-share" /> : <FairShareAudit key="fair-share" />;
      case '/capi':
        return <CapiPage key="capi" />;
      case '/attendance':
        return <AttendancePage key="attendance" />;
      case '/projects':
        return <ProjectsPage key="projects" />;
      case '/cooperation-slips':
        return <CooperationSlipsPage key="cooperation-slips" />;
      case '/deposits':
        return <DepositsPage key="deposits" />;
      default:
        return <Navigate to="/" replace />;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Suspense fallback={<PageLoader />}>
        {renderPageComponent()}
      </Suspense>
    </div>
  );
};


const KeyboardShortcutsController = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
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

        if (user?.role === 'admin' || user?.role === 'superadmin') {
          shortcuts.s = '/fair-share';
          shortcuts.r = '/rounds';
          shortcuts.c = '/consultants';
          shortcuts.t = '/tickets';
          shortcuts.w = '/rules';
          shortcuts.i = '/integrations';
          shortcuts.o = '/settings';
          shortcuts.g = '/gatekeeper';
          if (user?.role === 'superadmin') {
            shortcuts.a = '/accounts';
          }
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

  const isSystemAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <>
      <CustomModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title={t("Bảng phím tắt điều hướng nhanh")}
        width="650px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
            <Keyboard size={20} />
            <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{t("Mẹo: Nhấn Alt + [Chữ cái] để chuyển hướng nhanh toàn hệ thống")}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isSystemAdmin ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
            {/* Column 1: Chung & Vận hành */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                  {t("Chung & Vận hành")}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text)' }}>{t("Trang chủ Dashboard")}</span>
                    <kbd className="shortcuts-kbd">Alt + D</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text)' }}>{t("Nhật ký Lead (Data)")}</span>
                    <kbd className="shortcuts-kbd">Alt + L</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text)' }}>{t("Thêm Data (Lead) nhanh")}</span>
                    <kbd className="shortcuts-kbd">Alt + N</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text)' }}>{t("Bản tin hoạt động hệ thống")}</span>
                    <kbd className="shortcuts-kbd">Alt + H</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--color-text)' }}>{t("Xem kịch bản trợ giúp này")}</span>
                    <kbd className="shortcuts-kbd">?</kbd>
                  </div>
                </div>
              </div>

              {isSystemAdmin && (
                <div>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                    {t("Chia số & Đối soát")}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Vòng xoay chia số (Rounds)")}</span>
                      <kbd className="shortcuts-kbd">Alt + R</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Quy tắc chia số (Rules)")}</span>
                      <kbd className="shortcuts-kbd">Alt + W</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Đối soát Công bằng (Fair Share)")}</span>
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
                    {t("Nhân sự & Tickets")}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Quản lý Tư vấn viên (Sale)")}</span>
                      <kbd className="shortcuts-kbd">Alt + C</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Quản lý Tickets báo lỗi")}</span>
                      <kbd className="shortcuts-kbd">Alt + T</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px' }}>
                    {t("Cấu hình & Quản trị")}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Tích hợp API & Google Sheets")}</span>
                      <kbd className="shortcuts-kbd">Alt + I</kbd>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("Cài đặt Hệ thống")}</span>
                      <kbd className="shortcuts-kbd">Alt + O</kbd>
                    </div>
                    {user?.role === 'superadmin' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--color-text)' }}>{t("Tài khoản phân quyền")}</span>
                        <kbd className="shortcuts-kbd">Alt + A</kbd>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--color-text)' }}>{t("AI Pre-screener")}</span>
                      <kbd className="shortcuts-kbd">Alt + G</kbd>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button className="btn primary" onClick={() => setShowHelpModal(false)}>{t("Đóng")}</button>
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
    const localTheme = localStorage.getItem('richland_theme') as 'light' | 'dark';
    if (localTheme) {
      document.documentElement.setAttribute('data-theme', localTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('richland_global_date', getDefaultDateFilter());
  }, []);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <Toaster position="top-right" containerStyle={{ zIndex: 999999 }} toastOptions={{ className: 'custom-toast' }} />
          <Router>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/report-data" element={<ReportData />} />
                <Route path="/demo" element={<DemoEntry />} />
                
                {/* All authenticated users (sharing a single persistent AppTabs instance) */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/*" element={<AppTabs />} />
                </Route>
              </Routes>
              <KeyboardShortcutsController />
            </Suspense>
          </Router>
          <GlobalConfirmModal />
          <QRCodeCallModal />
          <ProfileModal />
        </AuthProvider>

      </LanguageProvider>
    </ErrorBoundary>
  );
}
