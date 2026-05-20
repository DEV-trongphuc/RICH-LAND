import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Lock, Mail, Share2, Bell, BarChart3 } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleGoogleLoginResponse = async (response: any) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://open.domation.net/sale_data/api.php?action=login_google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const json = await res.json();
      if (json.success) {
        login(json.token, json.user);
        navigate('/');
      } else {
        setError(json.message || 'Đăng nhập Google thất bại');
      }
    } catch {
      setError('Không thể kết nối đến máy chủ xác thực Google. Vui lòng thử lại.');
    }
    setLoading(false);
  };

  const googleBtnRef = React.useRef<HTMLDivElement>(null);
  const renderedRef = React.useRef(false);

  useEffect(() => {
    let intervalId: any;
    
    const initGoogle = () => {
      if (renderedRef.current) {
        clearInterval(intervalId);
        return;
      }
      
      if ((window as any).google?.accounts?.id && googleBtnRef.current) {
        (window as any).google.accounts.id.initialize({
          client_id: '641158233158-nsg8a8tdsj3fdgb34dc9tugm8god7tho.apps.googleusercontent.com',
          callback: handleGoogleLoginResponse
        });
        (window as any).google.accounts.id.renderButton(
          googleBtnRef.current,
          { theme: 'outline', size: 'large', width: 320, text: 'signin_with', shape: 'rectangular' }
        );
        renderedRef.current = true;
        clearInterval(intervalId);
      }
    };

    initGoogle();
    intervalId = setInterval(initGoogle, 500);

    return () => clearInterval(intervalId);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('https://open.domation.net/sale_data/api.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const json = await res.json();

      if (json.success) {
        login(json.token, json.user);
        navigate('/');
      } else {
        setError(json.message || 'Đăng nhập thất bại');
      }
    } catch {
      setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.');
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
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      position: 'relative',
      overflow: 'hidden',
      padding: '2rem'
    }}>
      {/* Decorative Background Elements */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%', filter: 'blur(60px)', animation: 'float 10s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%', width: '60vw', height: '60vw',
        background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%', filter: 'blur(80px)', animation: 'float 15s ease-in-out infinite reverse'
      }} />
      
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4rem',
        flexWrap: 'wrap'
      }}>
        
        {/* Left Side: Features Info */}
        <div className="features-panel" style={{ flex: '1 1 400px', color: 'white', animation: 'slideRight 0.6s cubic-bezier(0.16, 1, 0.3, 1)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '100px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', marginBottom: '1.5rem' }}>
              <span style={{ display: 'flex', width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.5px' }}>HỆ THỐNG AUTO CHIA DATA LOGIC</span>
            </div>
            <h1 style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem', letterSpacing: '-1px' }}>
              DOMATION <span style={{ background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>DATA</span>
            </h1>
            <p style={{ fontSize: '1.125rem', color: '#cbd5e1', lineHeight: 1.6, maxWidth: 480 }}>
              Giải pháp toàn diện giúp tự động hóa quy trình phân bổ khách hàng, theo dõi hiệu suất và tăng tỷ lệ chuyển đổi.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: 'linear-gradient(to right, rgba(0,104,255,0.1), rgba(0,104,255,0.02))', padding: '16px', borderRadius: '16px', border: '1px solid rgba(0,104,255,0.3)', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,104,255,0.15)' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, background: '#0068ff', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '3px 10px', borderBottomLeftRadius: '12px', letterSpacing: '0.5px' }}>NỔI BẬT</div>
              <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(0,104,255,0.6)', boxShadow: '0 4px 16px rgba(0,104,255,0.4)', marginTop: '2px' }}>
                <img src="https://s120-ava-talk.zadn.vn/0/1/e/7/1/120/e932faecd85ad36444b8a9d41eb73bb7.jpg" alt="Zalo Bot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ paddingTop: '2px' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '6px', color: '#60a5fa' }}>Tích Hợp Zalo Bot</h3>
                <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.5 }}>Quản lý ticket, nhận thông báo chia số và phản hồi duyệt lỗi nhanh chóng ngay trên ứng dụng Zalo.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ background: 'rgba(99,102,241,0.2)', padding: '10px', borderRadius: '12px', color: '#818cf8' }}>
                <Share2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '4px' }}>Chia Data Thông Minh</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5 }}>Tự động phân bổ data theo vòng lặp, xử lý chống trùng lặp và đền bù data lỗi chính xác 100%.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ background: 'rgba(56,189,248,0.2)', padding: '10px', borderRadius: '12px', color: '#38bdf8' }}>
                <Bell size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '4px' }}>Thông Báo Email Tức Thì</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5 }}>Gửi email cảnh báo data trùng lặp, data mới, và thông báo kết quả duyệt ticket ngay lập tức.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ background: 'rgba(244,114,182,0.2)', padding: '10px', borderRadius: '12px', color: '#f472b6' }}>
                <BarChart3 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '4px' }}>Báo Cáo & Thống Kê</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5 }}>Báo cáo thống kê tự động gửi hàng ngày theo khung giờ tùy chọn, đo lường chính xác hiệu suất Sale và chất lượng Data.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div style={{
          flex: '0 1 400px',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
          padding: '3rem 2.5rem',
          animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>Đăng Nhập</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 4 }}>Vui lòng đăng nhập để tiếp tục</p>
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
            <label className="form-label">Email đăng nhập</label>
            <div style={{ position: 'relative' }}>
              <Mail size={20} style={{ position: 'absolute', left: 14, top: 14, color: '#94a3b8' }} />
              <input
                type="email"
                className="form-input login-input"
                style={{ paddingLeft: 44, height: 48, borderRadius: 12 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="VD: ten@domation.net"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock size={20} style={{ position: 'absolute', left: 14, top: 14, color: '#94a3b8' }} />
              <input 
                type="password" 
                className="form-input login-input" 
                style={{ paddingLeft: 44, height: 48, borderRadius: 12 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="login-btn" 
            style={{ width: '100%', padding: '0 1.5rem', height: 48, marginTop: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            disabled={loading}
          >
            {loading ? 'Đang xác thực...' : <><LogIn size={18} /> Đăng nhập</>}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0 1.25rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <span style={{ padding: '0 0.75rem', fontWeight: 500 }}>Hoặc đăng nhập bằng</span>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div ref={googleBtnRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', minHeight: 44 }}></div>
        </div>
      </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes float {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
          100% { transform: translateY(0) scale(1); }
        }
        .login-input {
          transition: all 0.2s ease;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .login-input:focus {
          background: #fff;
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.1);
        }
        .login-btn {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(99,102,241,0.3);
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(99,102,241,0.4);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        @media (max-width: 768px) {
          .features-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
