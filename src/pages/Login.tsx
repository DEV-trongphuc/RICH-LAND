import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Lock, User } from 'lucide-react';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('https://open.domation.net/sale_data/api.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const json = await res.json();
      
      if (json.success) {
        login(json.token, json.user);
        navigate('/');
      } else {
        setError(json.message || 'Đăng nhập thất bại');
      }
    } catch {
      // Vì Server chưa up code mới, ta sẽ MOCK Đăng nhập tạm thời để bạn test UI
      if (username === 'admin' && password === '123456') {
        const mockToken = 'mock_jwt_token_for_admin_testing_purpose';
        const mockUser = { username: 'admin', name: 'Super Admin', role: 'admin' as const };
        login(mockToken, mockUser);
        navigate('/');
      } else if (username === 'viewer' && password === '123456') {
        const mockToken = 'mock_jwt_token_for_viewer_testing_purpose';
        const mockUser = { username: 'viewer', name: 'Trợ lý 1', role: 'assistant' as const };
        login(mockToken, mockUser);
        navigate('/');
      } else {
        setError('Tài khoản hoặc mật khẩu không chính xác (Test: admin/123456)');
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: '2rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        padding: '2.5rem',
        border: '1px solid var(--color-border)',
        animation: 'slideUp 0.4s ease-out'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 1rem', borderRadius: 16,
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <img src="https://crm-domation.vercel.app/LOGO.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} 
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>DOMATION CRM</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 4 }}>Đăng nhập để quản lý Hệ thống</p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem 1rem', background: 'var(--color-danger-light)', color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="form-label">Tài khoản</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
              <input 
                type="text" 
                className="form-input" 
                style={{ paddingLeft: 40 }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập"
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
              <input 
                type="password" 
                className="form-input" 
                style={{ paddingLeft: 40 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn primary" 
            style={{ width: '100%', padding: '0.875rem', marginTop: '0.5rem', fontSize: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Đang xác thực...' : <><LogIn size={18} /> Đăng nhập</>}
          </button>
        </form>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
