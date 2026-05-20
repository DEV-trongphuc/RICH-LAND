import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';

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

// Loading spinner fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: ('admin' | 'assistant' | 'viewer')[] }) => {
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
  const adminPaths = ['/consultants', '/rounds', '/tickets', '/rules', '/integrations', '/settings', '/accounts'];
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
        </>
      )}
    </div>
  );
};

export default function App() {
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
              
              {/* Admin only routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/consultants" element={<AppTabs />} />
                <Route path="/rounds" element={<AppTabs />} />
                <Route path="/tickets" element={<AppTabs />} />
                <Route path="/rules" element={<AppTabs />} />
                <Route path="/integrations" element={<AppTabs />} />
                <Route path="/settings" element={<AppTabs />} />
                <Route path="/accounts" element={<AppTabs />} />
              </Route>

              {/* All authenticated users */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<AppTabs />} />
                <Route path="/data" element={<AppTabs />} />
              </Route>
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
