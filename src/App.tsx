import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Consultants } from './pages/Consultants';
import { Rounds } from './pages/Rounds';
import { Tickets } from './pages/Tickets';
import { RuleSettings } from './pages/RuleSettings';
import { Integrations } from './pages/Integrations';
import { Settings } from './pages/Settings';
import { DataList } from './pages/DataList';
import { Login } from './pages/Login';
import { Accounts } from './pages/Accounts';
import { ReportData } from './pages/ReportData';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: ('admin' | 'assistant' | 'viewer')[] }) => {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <Router>
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
      </Router>
    </AuthProvider>
  );
}
