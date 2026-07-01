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

// Loading spinner fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: ('superadmin' | 'admin' | 'assistant' | 'viewer' | 'sale')[] }) => {
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
  const adminPaths = ['/consultants', '/rounds', '/tickets', '/rules', '/integrations', '/settings', '/accounts', '/fair-share', '/gatekeeper', '/capi', '/attendance'];
  const userPaths = ['/', '/data', '/calendar', '/contacts', '/companies', '/deals', '/quotes', '/activities', '/products', '/invoices', '/expenses', '/reports-crm', '/suppliers', '/files', '/inventory', '/projects', '/cooperation-slips', '/deposits'];
  const allPaths = [...userPaths, ...adminPaths];
  const isAdminPath = adminPaths.includes(currentPath);

  // Fallback for unrecognized paths
  if (!allPaths.includes(currentPath)) {
    return <Navigate to="/" replace />;
  }

  // Admin & Superadmin route protection check
  if (currentPath === '/accounts') {
    if ((user?.role as string) !== 'admin' && (user?.role as string) !== 'superadmin' && (user?.role as string) !== 'super_admin') {
      return <Navigate to="/" replace />;
    }
  } else if (currentPath === '/invoices') {
    if ((user?.role as string) === 'sale' || (user?.role as string) === 'viewer') {
      return <Navigate to="/" replace />;
    }
  } else if (currentPath === '/quotes' || currentPath === '/expenses') {
    if ((user?.role as string) !== 'admin' && (user?.role as string) !== 'superadmin' && (user?.role as string) !== 'super_admin' && (user?.role as string) !== 'manager') {
      return <Navigate to="/" replace />;
    }
  } else if (isAdminPath) {
    if ((user?.role as string) !== 'admin' && (user?.role as string) !== 'superadmin' && (user?.role as string) !== 'super_admin') {
      return <Navigate to="/" replace />;
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* User Pages */}
      <div style={{ display: currentPath === '/' ? 'block' : 'none' }} className={currentPath === '/' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/') && (
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        )}
      </div>
      <div style={{ display: (currentPath === '/data' || currentPath === '/calendar') ? 'block' : 'none' }} className={(currentPath === '/data' || currentPath === '/calendar') ? 'page-enter-active' : ''}>
        {(visitedPaths.includes('/data') || visitedPaths.includes('/calendar')) && (
          <Suspense fallback={<PageLoader />}>
            <DataList />
          </Suspense>
        )}
      </div>

      {/* CRM Pages */}
      <div style={{ display: currentPath === '/contacts' ? 'block' : 'none' }} className={currentPath === '/contacts' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/contacts') && (
          <Suspense fallback={<PageLoader />}>
            <ContactsPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/companies' ? 'block' : 'none' }} className={currentPath === '/companies' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/companies') && (
          <Suspense fallback={<PageLoader />}>
            <CompaniesPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/deals' ? 'block' : 'none' }} className={currentPath === '/deals' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/deals') && (
          <Suspense fallback={<PageLoader />}>
            <DealsPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/quotes' ? 'block' : 'none' }} className={currentPath === '/quotes' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/quotes') && (
          <Suspense fallback={<PageLoader />}>
            <QuotesPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/activities' ? 'block' : 'none' }} className={currentPath === '/activities' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/activities') && (
          <Suspense fallback={<PageLoader />}>
            <ActivitiesPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/products' ? 'block' : 'none' }} className={currentPath === '/products' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/products') && (
          <Suspense fallback={<PageLoader />}>
            <ProductsPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/invoices' ? 'block' : 'none' }} className={currentPath === '/invoices' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/invoices') && (
          <Suspense fallback={<PageLoader />}>
            <InvoicesPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/expenses' ? 'block' : 'none' }} className={currentPath === '/expenses' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/expenses') && (
          <Suspense fallback={<PageLoader />}>
            <ExpensesPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/reports-crm' ? 'block' : 'none' }} className={currentPath === '/reports-crm' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/reports-crm') && (
          <Suspense fallback={<PageLoader />}>
            <ReportsPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/suppliers' ? 'block' : 'none' }} className={currentPath === '/suppliers' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/suppliers') && (
          <Suspense fallback={<PageLoader />}>
            <SuppliersPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/files' ? 'block' : 'none' }} className={currentPath === '/files' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/files') && (
          <Suspense fallback={<PageLoader />}>
            <FilesPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/inventory' ? 'block' : 'none' }} className={currentPath === '/inventory' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/inventory') && (
          <Suspense fallback={<PageLoader />}>
            <InventoryPage />
          </Suspense>
        )}
      </div>

      {/* Admin Pages */}
      {((user?.role as string) === 'admin' || (user?.role as string) === 'superadmin' || (user?.role as string) === 'super_admin') && (
        <>
          <div style={{ display: currentPath === '/consultants' ? 'block' : 'none' }} className={currentPath === '/consultants' ? 'page-enter-active' : ''}>
            {visitedPaths.includes('/consultants') && (
              <Suspense fallback={<PageLoader />}>
                <Consultants />
              </Suspense>
            )}
          </div>
          <div style={{ display: currentPath === '/rounds' ? 'block' : 'none' }} className={currentPath === '/rounds' ? 'page-enter-active' : ''}>
            {visitedPaths.includes('/rounds') && (
              <Suspense fallback={<PageLoader />}>
                <Rounds />
              </Suspense>
            )}
          </div>
          <div style={{ display: currentPath === '/tickets' ? 'block' : 'none' }} className={currentPath === '/tickets' ? 'page-enter-active' : ''}>
            {visitedPaths.includes('/tickets') && (
              <Suspense fallback={<PageLoader />}>
                <Tickets />
              </Suspense>
            )}
          </div>
          <div style={{ display: currentPath === '/rules' ? 'block' : 'none' }} className={currentPath === '/rules' ? 'page-enter-active' : ''}>
            {visitedPaths.includes('/rules') && (
              <Suspense fallback={<PageLoader />}>
                <RuleSettings />
              </Suspense>
            )}
          </div>
          <div style={{ display: currentPath === '/integrations' ? 'block' : 'none' }} className={currentPath === '/integrations' ? 'page-enter-active' : ''}>
            {visitedPaths.includes('/integrations') && (
              <Suspense fallback={<PageLoader />}>
                <Integrations />
              </Suspense>
            )}
          </div>
          <div style={{ display: currentPath === '/settings' ? 'block' : 'none' }} className={currentPath === '/settings' ? 'page-enter-active' : ''}>
            {visitedPaths.includes('/settings') && (
              <Suspense fallback={<PageLoader />}>
                <Settings />
              </Suspense>
            )}
          </div>
          <div style={{ display: currentPath === '/accounts' ? 'block' : 'none' }} className={currentPath === '/accounts' ? 'page-enter-active' : ''}>
            {visitedPaths.includes('/accounts') && (
              <Suspense fallback={<PageLoader />}>
                <Accounts />
              </Suspense>
            )}
          </div>
          <div style={{ display: currentPath === '/gatekeeper' ? 'block' : 'none' }} className={currentPath === '/gatekeeper' ? 'page-enter-active' : ''}>
            {visitedPaths.includes('/gatekeeper') && (
              <Suspense fallback={<PageLoader />}>
                <Gatekeeper />
              </Suspense>
            )}
          </div>
          <div style={{ display: currentPath === '/fair-share' ? 'block' : 'none' }} className={currentPath === '/fair-share' ? 'page-enter-active' : ''}>
            {visitedPaths.includes('/fair-share') && (
              <Suspense fallback={<PageLoader />}>
                <FairShareAudit />
              </Suspense>
            )}
          </div>
          <div style={{ display: currentPath === '/capi' ? 'block' : 'none' }} className={currentPath === '/capi' ? 'page-enter-active' : ''}>
            {visitedPaths.includes('/capi') && (
              <Suspense fallback={<PageLoader />}>
                <CapiPage />
              </Suspense>
            )}
          </div>
          <div style={{ display: currentPath === '/attendance' ? 'block' : 'none' }} className={currentPath === '/attendance' ? 'page-enter-active' : ''}>
            {visitedPaths.includes('/attendance') && (
              <Suspense fallback={<PageLoader />}>
                <AttendancePage />
              </Suspense>
            )}
          </div>
        </>
      )}

      {/* User Dynamic Pages */}
      <div style={{ display: currentPath === '/projects' ? 'block' : 'none' }} className={currentPath === '/projects' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/projects') && (
          <Suspense fallback={<PageLoader />}>
            <ProjectsPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/cooperation-slips' ? 'block' : 'none' }} className={currentPath === '/cooperation-slips' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/cooperation-slips') && (
          <Suspense fallback={<PageLoader />}>
            <CooperationSlipsPage />
          </Suspense>
        )}
      </div>
      <div style={{ display: currentPath === '/deposits' ? 'block' : 'none' }} className={currentPath === '/deposits' ? 'page-enter-active' : ''}>
        {visitedPaths.includes('/deposits') && (
          <Suspense fallback={<PageLoader />}>
            <DepositsPage />
          </Suspense>
        )}
      </div>
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
          <Toaster position="top-right" />
          <Router>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/report-data" element={<ReportData />} />
                <Route path="/demo" element={<DemoEntry />} />
                <Route path="/sale-portal" element={<SalePortal />} />
                
                {/* All authenticated users (sharing a single persistent AppTabs instance) */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/*" element={<AppTabs />} />
                </Route>
              </Routes>
              <KeyboardShortcutsController />
            </Suspense>
          </Router>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
