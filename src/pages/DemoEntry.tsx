import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const DemoEntry: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    // Set global demo mode flag
    localStorage.setItem('DOMATION_DEMO_MODE', 'true');
    
    // Clear out old real tokens
    localStorage.removeItem('domation_token');
    localStorage.removeItem('domation_user');
    
    // Fake login
    const demoToken = 'demo_token_12345';
    const demoUser = { id: 1, email: 'admin@domation.net', role: 'admin' as const, is_confirmed: 1, username: 'admin', name: 'Admin Demo' };
    
    login(demoToken, demoUser);
    
    setTimeout(() => {
      navigate('/', { replace: true });
    }, 1500);
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
      <Loader2 size={48} className="spin" style={{ color: '#3b82f6', marginBottom: 20 }} />
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Khởi tạo môi trường Demo...</h2>
      <p style={{ color: '#94a3b8' }}>Đang nạp dữ liệu ảo và chuẩn bị giao diện.</p>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
