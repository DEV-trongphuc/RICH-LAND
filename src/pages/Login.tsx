import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LogIn, Lock, Mail, Share2, Bell, BarChart3, Sparkles, ShieldCheck, Zap, Bot, History, CheckCircle2, User, ArrowRight } from 'lucide-react';

export const Login = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleGoogleLoginResponse = async (response: any) => {
    setLoading(true);
    setError('');

    if (localStorage.getItem('RICH LAND_DEMO_MODE') === 'true') {
      await new Promise(resolve => setTimeout(resolve, 500));
      login('demo_token_12345', { id: 1, username: 'admin', email: 'admin@richland.net', name: 'Admin Demo', role: 'admin' });
      navigate('/');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=login_google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const json = await res.json();
      if (json.success) {
        login(json.token, json.user);
        navigate('/');
      } else {
        setError(t(json.message) || t('Đăng nhập Google thất bại'));
      }
    } catch {
      setError(t('Không thể kết nối đến máy chủ xác thực Google. Vui lòng thử lại.'));
    }
    setLoading(false);
  };

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

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
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('richland_theme') === 'dark';
        (window as any).google.accounts.id.renderButton(
          googleBtnRef.current,
          { theme: isDark ? 'filled_blue' : 'outline', size: 'large', width: 320, text: 'signin_with', shape: 'rectangular' }
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

    if (localStorage.getItem('RICH LAND_DEMO_MODE') === 'true') {
      await new Promise(resolve => setTimeout(resolve, 500));
      const isSale = email.includes('sale') || email.includes('haidang') || email.includes('thao') || email.includes('dung') || email.includes('tuan');
      if (isSale) {
        let cId = 1;
        let name = 'Hải Đăng';
        let cEmail = 'haidang@richland.net';
        if (email.includes('thao')) { cId = 2; name = 'Thanh Thảo'; cEmail = 'thanhthao@richland.net'; }
        else if (email.includes('dung')) { cId = 3; name = 'Việt Dũng'; cEmail = 'vietdung@richland.net'; }
        else if (email.includes('tuan')) { cId = 4; name = 'Minh Tuấn'; cEmail = 'minhtuan@richland.net'; }

        login(`demo_token_sale_${cId}`, { id: cId, username: cEmail.split('@')[0], email: cEmail, name: name, role: 'sale', consultant_id: cId });
        navigate('/');
      } else {
        login('demo_token_12345', { id: 1, username: (email || 'admin@richland.net').split('@')[0], email: email || 'admin@richland.net', name: 'Admin Demo', role: 'admin' });
        navigate('/');
      }
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const json = await res.json();

      if (json.success) {
        login(json.token, json.user);
        navigate('/');
      } else {
        setError(t(json.message) || t('Đăng nhập thất bại'));
      }
    } catch {
      setError(t('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.'));
    }
    setLoading(false);
  };

  const handleQuickLogin = async (emailVal: string, passwordVal: string, roleName: string) => {
    setLoading(true);
    setError('');

    if (localStorage.getItem('RICH LAND_DEMO_MODE') === 'true') {
      await new Promise(resolve => setTimeout(resolve, 300));
      let userRole = roleName.toLowerCase();
      if (userRole === 'sales') userRole = 'sale';
      login(`demo_token_quick_${userRole}`, {
        id: emailVal === 'haidang@richland.net' ? 1000 : 999,
        username: emailVal.split('@')[0],
        email: emailVal,
        name: `Dev ${roleName}`,
        role: userRole as any,
        consultant_id: emailVal === 'haidang@richland.net' ? 1 : undefined
      });
      navigate('/');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, password: passwordVal })
      });
      const json = await res.json();
      if (json.success) {
        login(json.token, json.user);
        navigate('/');
      } else {
        setError(t(json.message) || `Đăng nhập ${roleName} thất bại`);
      }
    } catch (e: any) {
      setError('Lỗi kết nối: ' + e.message);
    }
    setLoading(false);
  };

  const ALL_MODULES = [
    { title: t('Tích Hợp Zalo Bot'), sub: t('Quản lý ticket, nhận thông báo chia số và phản hồi duyệt lỗi tức thì trên Zalo.'), icon: Bot, color: 'linear-gradient(135deg, #3b82f6, #6366f1)' },
    { title: t('Chia Data Thông Minh'), sub: t('Tự động phân bổ data theo vòng lặp, xử lý chống trùng lặp và đền bù lỗi.'), icon: Share2, color: 'linear-gradient(135deg, #f43f5e, #be123c)' },
    { title: t('Thông Báo Email'), sub: t('Gửi mail cảnh báo trùng lặp, thông báo kết quả duyệt ticket ngay lập tức.'), icon: Bell, color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    { title: t('Báo Cáo & Thống Kê'), sub: t('Báo cáo thống kê gửi hàng ngày theo khung giờ, đo lường hiệu suất Sale.'), icon: BarChart3, color: 'linear-gradient(135deg, #10b981, #059669)' },
    { title: t('Đồng Hồ Bảo Mật'), sub: t('Tự động thu hồi khách hàng không tương tác và giải phóng về Databank chung.'), icon: ShieldCheck, color: 'linear-gradient(135deg, #a855f7, #6d28d9)' },
    { title: t('Bù Lượt Lỗi Ca Trực'), sub: t('Cơ chế đền bù lượt lỗi, bù lượt thiếu do nghỉ phép hoặc trực ngoài giờ.'), icon: Zap, color: 'linear-gradient(135deg, #06b6d4, #0891b2)' }
  ];

  const row1 = ALL_MODULES.slice(0, 3);
  const row2 = ALL_MODULES.slice(3);

  const isDemoMode = localStorage.getItem('RICH LAND_DEMO_MODE') === 'true';

  return (
    <div className="login-container">
      {/* Background Decorative Blur Gradients */}
      <div className="blur-glow-1" />
      <div className="blur-glow-2" />

      {/* Left Side: Brand & Visual Marquee */}
      <div className="left-side">
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {/* Header Badge */}
          <div className="badge-container animate-float">
            <Sparkles size={14} style={{ color: '#f87171' }} />
            <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#fca5a5' }}>
              {t("Data Automation Ecosystem")}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h1 className="title-main">
              RICH LAND <br />
              <span className="title-gradient">
                DATA SYSTEM 2026.
              </span>
            </h1>
            <p className="subtitle-main">
              {t("Giải pháp toàn diện giúp tự động hóa quy trình phân bổ khách hàng, tối ưu hóa điểm chạm và tăng tỷ lệ chuyển đổi.")}
            </p>
          </div>

          {/* Scrolling Features Marquee */}
          <div className="marquee-wrapper pause-on-hover mask-fade-edges">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', position: 'relative' }}>
              {/* Row 1 */}
              <div className="marquee-row animate-slide-infinite">
                {[...row1, ...row1, ...row1].map((f, i) => (
                  <div key={`r1-${i}`} className="marquee-item">
                    <div className="icon-box" style={{ background: f.color }}>
                      <f.icon size={20} color="white" />
                    </div>
                    <h3 className="item-title">{f.title}</h3>
                    <p className="item-sub">{f.sub}</p>
                  </div>
                ))}
              </div>

              {/* Row 2 */}
              <div className="marquee-row animate-slide-infinite-reverse">
                {[...row2, ...row2, ...row2].map((f, i) => (
                  <div key={`r2-${i}`} className="marquee-item">
                    <div className="icon-box" style={{ background: f.color }}>
                      <f.icon size={20} color="white" />
                    </div>
                    <h3 className="item-title">{f.title}</h3>
                    <p className="item-sub">{f.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Circular Lines Decor */}
        <div className="circle-decor-1" />
        <div className="circle-decor-2" />
        <div className="circle-decor-3" />
      </div>

      {/* Right Side: Identity Check Card */}
      <div className="right-side">
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Animated rotated logo container */}
            <div className="logo-box">
              <img src="/imgs/logo-rich-land-viet-nam-trang.webp" className="logo-img" style={{ objectFit: 'contain' }} alt="Rich Land Logo" />
            </div>
            <div style={{ paddingTop: '8px' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', letterSpacing: '-0.5px' }}>
                {isDemoMode ? t('Trải nghiệm Demo') : t('Đăng Nhập')}
              </h2>
              <p style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.875rem', marginTop: '6px' }}>
                {isDemoMode
                  ? t('Hãy chọn tài khoản demo để khởi động hệ thống')
                  : t('Đăng nhập bằng tài khoản hoặc mã Google')}
              </p>
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', fontSize: '12px', fontWeight: 700, color: '#f87171', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <div className="login-card">
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label-custom">{t("Email đăng nhập")}</label>
                <div className="input-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    className="input-field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("VD: ten@richland.net")}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label-custom">{t("Mật khẩu")}</label>
                <div className="input-wrapper">
                  <Lock size={16} className="input-icon" />
                  <input
                    type="password"
                    className="input-field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("Nhập mật khẩu")}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="submit-btn-custom"
                disabled={loading}
              >
                {loading ? t('Đang xác thực...') : <><LogIn size={16} /> {t("Đăng nhập")}</>}
              </button>

              {isDemoMode && (
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setTimeout(() => {
                      login('demo_token_12345', { id: 1, username: 'admin', email: 'admin@richland.net', name: 'Admin Demo', role: 'admin' });
                      navigate('/');
                      setLoading(false);
                    }, 500);
                  }}
                  className="submit-btn-custom"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)' }}
                >
                  <LogIn size={16} /> {t("Đăng nhập Demo (Admin)")}
                </button>
              )}
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '20px 0' }}>
              <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px' }}>{t("Hoặc")}</span>
              <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <div ref={googleBtnRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', minHeight: '44px' }}></div>
            </div>

            <p style={{ fontSize: '10px', color: '#475569', fontWeight: 500, textAlign: 'center', lineHeight: 1.5, marginTop: '16px' }}>
              {t("Bằng cách đăng nhập, bạn đồng ý với các chính sách bảo mật và điều khoản sử dụng của hệ thống.")}
            </p>
          </div>

          {/* Dev Quick Login Section */}
          <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.25)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '10px', color: '#475569', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', letterSpacing: '1px', margin: 0 }}>
              {t("Developer Quick Login")}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <button
                onClick={() => handleQuickLogin('turniodev@gmail.com', 'pass123', 'Admin')}
                style={{ height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.6)', color: '#cbd5e1', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Admin
              </button>
              <button
                onClick={() => handleQuickLogin('director@richland.net', 'director123', 'Director')}
                style={{ height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.6)', color: '#cbd5e1', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Director
              </button>
              <button
                onClick={() => handleQuickLogin('manager@richland.net', 'manager123', 'Manager')}
                style={{ height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.6)', color: '#cbd5e1', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Manager
              </button>
              <button
                onClick={() => handleQuickLogin('dom.marketing.vn@gmail.com', 'sale123', 'Sale')}
                style={{ height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.6)', color: '#cbd5e1', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Sale
              </button>
            </div>
          </div>
        </div>

        {/* Watermark */}
        <div style={{ position: 'absolute', bottom: '24px', right: '24px', color: 'rgba(255,255,255,0.015)', fontSize: '80px', fontWeight: 900, pointerEvents: 'none', userSelect: 'none', transform: 'rotate(2deg) translateY(40px)' }}>
          RICHLAND.
        </div>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          flex-direction: row;
          background: #080d1a;
          position: relative;
          overflow: hidden;
        }
        .blur-glow-1 {
          position: absolute;
          top: 0;
          right: 0;
          width: 500px;
          height: 500px;
          background: rgba(239, 68, 68, 0.08);
          filter: blur(120px);
          border-radius: 50%;
          pointer-events: none;
        }
        .blur-glow-2 {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 500px;
          height: 500px;
          background: rgba(245, 158, 11, 0.08);
          filter: blur(120px);
          border-radius: 50%;
          pointer-events: none;
        }
        .left-side {
          position: relative;
          flex: 1;
          padding: 5rem 2rem 5rem 5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
        }
        .right-side {
          position: relative;
          width: 560px;
          background: rgba(12, 18, 32, 0.6);
          backdrop-filter: blur(30px);
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          padding: 4rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          overflow-y: auto;
        }
        .badge-container {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(239, 68, 68, 0.08);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 9999px;
          margin-bottom: 2rem;
          align-self: flex-start;
        }
        .title-main {
          font-size: 4rem;
          font-weight: 900;
          color: white;
          line-height: 1.1;
          letter-spacing: -2px;
          margin-bottom: 1.5rem;
        }
        .title-gradient {
          background: linear-gradient(to right, #ff4d4d, #ff8080, #ffb366);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtitle-main {
          max-width: 450px;
          font-size: 1.125rem;
          color: #94a3b8;
          font-weight: 500;
          line-height: 1.6;
          margin-bottom: 3rem;
        }
        .logo-box {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #BD1D2D 0%, #a31422 100%);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
          box-shadow: 0 20px 40px rgba(189, 29, 45, 0.35);
          transform: rotate(3deg);
          overflow: hidden;
          padding: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 16px;
        }
        .login-card {
          width: 100%;
          max-width: 380px;
          padding: 2rem;
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 32px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(20px);
        }
        .form-label-custom {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
          display: block;
          margin-bottom: 6px;
        }
        .input-wrapper {
          position: relative;
          margin-bottom: 1.25rem;
        }
        .input-icon {
          position: absolute;
          right: 14px;
          top: 13px;
          color: #64748b;
        }
        .input-field {
          width: 100%;
          height: 44px;
          padding-left: 16px;
          padding-right: 42px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(15, 23, 42, 0.8);
          color: white;
          font-size: 14px;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .input-field:focus {
          outline: none;
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
        }
        .submit-btn-custom {
          width: 100%;
          height: 46px;
          background: linear-gradient(135deg, #a31422 0%, #d01d33 100%);
          color: white;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          border: none;
          cursor: pointer;
          box-shadow: 0 8px 16px rgba(163, 20, 34, 0.25);
        }
        .submit-btn-custom:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 20px rgba(163, 20, 34, 0.35);
        }
        .submit-btn-custom:active {
          transform: translateY(1px);
        }
        .marquee-wrapper {
          position: relative;
          width: 100%;
          overflow: hidden;
          margin-top: 2rem;
        }
        .marquee-row {
          display: flex;
          gap: 16px;
          width: max-content;
        }
        .marquee-item {
          width: 280px;
          flex-shrink: 0;
          padding: 1.25rem;
          background: rgba(18, 25, 42, 0.4);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          transition: all 0.3s ease;
        }
        .marquee-item:hover {
          background: rgba(30, 41, 59, 0.6);
          border-color: rgba(239, 68, 68, 0.3);
          transform: translateY(-2px);
        }
        .icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          box-shadow: 0 8px 16px rgba(0,0,0,0.15);
        }
        .item-title {
          font-size: 14px;
          font-weight: 700;
          color: white;
          margin-bottom: 4px;
        }
        .item-sub {
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.5;
        }
        .circle-decor-1 {
          position: absolute;
          top: 50%;
          left: 0;
          transform: translateY(-50%);
          width: 800px;
          height: 800px;
          border: 1px solid rgba(255,255,255,0.015);
          border-radius: 50%;
          pointer-events: none;
        }
        .circle-decor-2 {
          position: absolute;
          top: 50%;
          left: 0;
          transform: translateY(-50%) translate(40px);
          width: 600px;
          height: 600px;
          border: 1px solid rgba(255,255,255,0.015);
          border-radius: 50%;
          pointer-events: none;
        }
        .circle-decor-3 {
          position: absolute;
          top: 50%;
          left: 0;
          transform: translateY(-50%) translate(80px);
          width: 400px;
          height: 400px;
          border: 1px solid rgba(255,255,255,0.02);
          border-radius: 50%;
          pointer-events: none;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        @keyframes slide-infinite {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.3333%); }
        }
        @keyframes slide-infinite-reverse {
          0% { transform: translateX(-33.3333%); }
          100% { transform: translateX(0); }
        }
        .animate-slide-infinite {
          animation: slide-infinite 25s linear infinite;
        }
        .animate-slide-infinite-reverse {
          animation: slide-infinite-reverse 25s linear infinite;
        }
        .pause-on-hover:hover .animate-slide-infinite,
        .pause-on-hover:hover .animate-slide-infinite-reverse {
          animation-play-state: paused;
        }
        .mask-fade-edges {
          mask-image: linear-gradient(to right, transparent, white 4%, white 98%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, white 4%, white 98%, transparent);
        }

        @media (max-width: 992px) {
          .login-container {
            flex-direction: column;
            overflow-y: auto;
          }
          .left-side {
            padding: 3rem 1.5rem;
            min-height: auto;
          }
          .right-side {
            width: 100%;
            padding: 3rem 1.5rem;
            border-left: none;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(12, 18, 32, 0.85);
          }
          .title-main {
            font-size: 2.75rem;
          }
        }
      `}</style>
    </div>
  );
};
