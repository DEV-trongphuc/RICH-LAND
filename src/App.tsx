import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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
              
              {/* Admin only routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/consultants" element={<Consultants />} />
                <Route path="/rounds" element={<Rounds />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/rules" element={<RuleSettings />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/accounts" element={<Accounts />} />
              </Route>

              {/* All authenticated users */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/data" element={<DataList />} />
              </Route>
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
