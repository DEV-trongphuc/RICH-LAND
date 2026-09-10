import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LogIn, Lock, Mail, Share2, Bell, BarChart3, Sparkles, ShieldCheck, Zap, Bot, History, CheckCircle2, User, ArrowRight, Shield, KeyRound, Loader2, X, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { CustomModal } from '../components/ui/CustomModal';
import { DigitPinInput } from '../components/ui/DigitPinInput';

export const Login = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // 2FA Prompt State
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pending2FAData, setPending2FAData] = useState<{ tempToken: string; type: string; maskedEmail: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);

  // Forgot Password State
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPass, setShowForgotNewPass] = useState(false);
  const [showForgotConfirmPass, setShowForgotConfirmPass] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [forgotLoading, setForgotLoading] = useState(false);

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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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
      const res = await fetchAPI('auth/login', {
        method: 'POST',
        body: JSON.stringify({ 
          email: email.trim(), 
          password, 
          remember_me: rememberMe 
        })
      });

      if (res && res.success && res.data) {
        if (rememberMe) {
          localStorage.setItem('richland_remember_me', 'true');
          localStorage.setItem('richland_session_expires', String(Date.now() + 90 * 86400 * 1000));
        } else {
          localStorage.removeItem('richland_remember_me');
          localStorage.removeItem('richland_session_expires');
        }

        if (res.data.requires_2fa) {
          setPending2FAData({
            tempToken: res.data.temp_token,
            type: res.data.two_factor_type,
            maskedEmail: res.data.masked_email
          });
          setOtpCode('');
          setShow2FAModal(true);
        } else {
          login(res.data.access_token, res.data.user);
          navigate('/');
        }
      } else {
        const errorMsg = t(res?.message) || t('Email hoặc mật khẩu không đúng. Vui lòng thử lại.');
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMsg = err.message || t('Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.');
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      toast.error('Vui lòng nhập đủ 6 chữ số mã xác thực');
      return;
    }
    setVerifying2FA(true);
    try {
      const res = await fetchAPI('auth/verify-2fa', {
        method: 'POST',
        body: JSON.stringify({
          temp_token: pending2FAData?.tempToken,
          otp_code: otpCode.trim()
        })
      });
      if (res.success && res.data) {
        login(res.data.access_token, res.data.user);
        setShow2FAModal(false);
        navigate('/');
      } else {
        toast.error(res.message || 'Mã xác thực không chính xác');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xác thực 2FA');
    }
    setVerifying2FA(false);
  };

  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const account = forgotEmail.trim();
    if (!account) {
      toast.error(t('Vui lòng nhập Email hoặc Tên đăng nhập'));
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetchAPI('auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: account })
      });
      if (res.success) {
        toast.success(res.message || t('Đã gửi mã xác thực OTP'));
        if (res.data?.masked_email) {
          setMaskedEmail(res.data.masked_email);
        }
        setForgotStep(2);
        setResendCooldown(60);
      } else {
        toast.error(res.message || t('Không thể gửi mã OTP'));
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi gửi yêu cầu xác thực'));
    }
    setForgotLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp || forgotOtp.trim().length < 6) {
      toast.error(t('Vui lòng nhập đủ 6 chữ số mã xác thực OTP'));
      return;
    }
    if (!forgotNewPassword) {
      toast.error(t('Vui lòng nhập mật khẩu mới'));
      return;
    }
    if (forgotNewPassword.length < 6 || !/[a-zA-Z]/.test(forgotNewPassword) || !/[0-9]/.test(forgotNewPassword)) {
      toast.error(t('Mật khẩu mới phải có ít nhất 6 ký tự, bao gồm cả chữ cái và chữ số'));
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      toast.error(t('Xác nhận mật khẩu mới không khớp'));
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetchAPI('auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp_code: forgotOtp.trim(),
          new_password: forgotNewPassword
        })
      });
      if (res.success) {
        toast.success(res.message || t('Đặt lại mật khẩu thành công!'));
        if (res.data?.email) {
          setEmail(res.data.email);
        } else if (forgotEmail.includes('@')) {
          setEmail(forgotEmail.trim());
        }
        setPassword('');
        setShowForgotPasswordModal(false);
        setForgotStep(1);
        setForgotOtp('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
      } else {
        toast.error(res.message || t('Không thể đặt lại mật khẩu'));
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi đặt lại mật khẩu'));
    }
    setForgotLoading(false);
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

          <div className="login-card">
            {error && (
              <div className="login-error-alert animate-shake">
                <AlertCircle size={18} style={{ flexShrink: 0, color: '#f87171' }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group-custom">
                <label className="form-label-custom">{t("Email hoặc Tên đăng nhập")}</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon-left" />
                  <input
                    type="text"
                    className="input-field"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder={t("hethong@richland.city hoặc hethong")}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="form-group-custom">
                <label className="form-label-custom">{t("Mật khẩu")}</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon-left" />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input-field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("Nhập mật khẩu")}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="input-btn-right"
                    title={showPassword ? t("Ẩn mật khẩu") : t("Hiện mật khẩu")}
                    aria-label={showPassword ? t("Ẩn mật khẩu") : t("Hiện mật khẩu")}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="remember-forgot-row">
                <label className="remember-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="remember-checkbox-input"
                  />
                  <span className="remember-checkbox-text">{t("Ghi nhớ đăng nhập")}</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPasswordModal(true);
                    setForgotEmail(email);
                    setForgotStep(1);
                  }}
                  className="forgot-pass-btn"
                >
                  {t("Quên mật khẩu?")}
                </button>
              </div>

              <button
                type="submit"
                className="submit-btn-custom"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 size={18} className="spin" /> {t('Đang xác thực...')}</>
                ) : (
                  <><LogIn size={18} /> {t("Đăng nhập")}</>
                )}
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
                  <LogIn size={18} /> {t("Đăng nhập Demo (Admin)")}
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

        </div>

        {/* Watermark */}
        <div style={{ position: 'absolute', bottom: '24px', right: '24px', color: 'rgba(255,255,255,0.015)', fontSize: '80px', fontWeight: 900, pointerEvents: 'none', userSelect: 'none', transform: 'rotate(2deg) translateY(40px)' }}>
          RICHLAND.
        </div>

        {/* 2FA Verification Modal */}
        {show2FAModal && (
          <CustomModal
            isOpen={show2FAModal}
            onClose={() => setShow2FAModal(false)}
            title={t("Xác thực 2 yếu tố (2FA)")}
            maxWidth="500px"
          >
            <form onSubmit={handleVerify2FA} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-bg-light)', padding: '12px 16px', borderRadius: '10px' }}>
                <Shield size={24} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                  {pending2FAData?.type === 'email'
                    ? t(`Đã gửi mã OTP 6 chữ số đến email: ${pending2FAData?.maskedEmail}`)
                    : t("Vui lòng mở ứng dụng Google Authenticator và nhập mã 6 chữ số")}
                </p>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ textAlign: 'center', display: 'block', fontWeight: 600 }}>{t("Nhập mã 6 chữ số")}</label>
                <DigitPinInput
                  value={otpCode}
                  onChange={setOtpCode}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn outline sm"
                  onClick={() => setShow2FAModal(false)}
                  disabled={verifying2FA}
                >
                  {t("Hủy")}
                </button>
                <button
                  type="submit"
                  className="btn primary sm"
                  disabled={verifying2FA || otpCode.length < 6}
                >
                  {verifying2FA ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
                  {t("Xác thực & Đăng nhập")}
                </button>
              </div>
            </form>
          </CustomModal>
        )}

        {/* Forgot Password Modal */}
        {showForgotPasswordModal && (
          <CustomModal
            isOpen={showForgotPasswordModal}
            onClose={() => setShowForgotPasswordModal(false)}
            title={t("Quên mật khẩu")}
            maxWidth="500px"
          >
            {forgotStep === 1 ? (
              <form onSubmit={handleSendForgotOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  {t("Nhập Email hoặc Tên đăng nhập của bạn. Hệ thống sẽ gửi mã xác thực OTP 6 chữ số đến email để bạn đặt lại mật khẩu.")}
                </p>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Email hoặc Tên đăng nhập")}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder={t("hethong@richland.city hoặc hethong")}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn outline sm"
                    onClick={() => setShowForgotPasswordModal(false)}
                    disabled={forgotLoading}
                  >
                    {t("Hủy")}
                  </button>
                  <button
                    type="submit"
                    className="btn primary sm"
                    disabled={forgotLoading || !forgotEmail.trim()}
                  >
                    {forgotLoading ? <Loader2 size={14} className="spin" /> : <Mail size={14} />}
                    {t("Gửi mã OTP")}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '8px', color: '#166534', fontSize: '0.8125rem' }}>
                  {t(`Đã gửi mã xác nhận OTP đến ${maskedEmail || forgotEmail}. Vui lòng kiểm tra hộp thư.`)}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ textAlign: 'center', display: 'block', fontWeight: 600 }}>{t("Mã OTP 6 chữ số")}</label>
                  <DigitPinInput
                    value={forgotOtp}
                    onChange={setForgotOtp}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Mật khẩu mới")}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showForgotNewPass ? "text" : "password"}
                      className="form-input"
                      value={forgotNewPassword}
                      onChange={e => setForgotNewPassword(e.target.value)}
                      placeholder={t("Tối thiểu 6 ký tự, gồm cả chữ cái và số")}
                      style={{ paddingRight: '42px' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPass(!showForgotNewPass)}
                      tabIndex={-1}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
                      aria-label="Toggle password visibility"
                    >
                      {showForgotNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Xác nhận mật khẩu mới")}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showForgotConfirmPass ? "text" : "password"}
                      className="form-input"
                      value={forgotConfirmPassword}
                      onChange={e => setForgotConfirmPassword(e.target.value)}
                      placeholder={t("Nhập lại mật khẩu mới")}
                      style={{ paddingRight: '42px' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPass(!showForgotConfirmPass)}
                      tabIndex={-1}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
                      aria-label="Toggle password visibility"
                    >
                      {showForgotConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                    {t("Mật khẩu phải có ít nhất 6 ký tự, bao gồm cả chữ cái và chữ số.")}
                  </small>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (resendCooldown <= 0) {
                        handleSendForgotOtp({ preventDefault: () => {} } as any);
                      }
                    }}
                    disabled={resendCooldown > 0 || forgotLoading}
                    style={{ background: 'none', border: 'none', color: resendCooldown > 0 ? '#94a3b8' : 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 600, cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer' }}
                  >
                    {resendCooldown > 0 ? t(`Gửi lại OTP (${resendCooldown}s)`) : t("← Gửi lại OTP")}
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn outline sm"
                      onClick={() => setShowForgotPasswordModal(false)}
                      disabled={forgotLoading}
                    >
                      {t("Hủy")}
                    </button>
                    <button
                      type="submit"
                      className="btn primary sm"
                      disabled={forgotLoading || !forgotOtp || !forgotNewPassword || !forgotConfirmPassword}
                    >
                      {forgotLoading ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />}
                      {t("Xác nhận đặt lại")}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </CustomModal>
        )}
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
        .login-error-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 14px;
          font-size: 13px;
          font-weight: 600;
          color: #fca5a5;
          line-height: 1.4;
          margin-bottom: 1rem;
        }
        .animate-shake {
          animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        .form-group-custom {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-label-custom {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
          display: block;
        }
        .input-wrapper {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
        }
        .input-icon-left {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          pointer-events: none;
          transition: color 0.2s ease;
          z-index: 2;
        }
        .input-wrapper:focus-within .input-icon-left {
          color: #ef4444;
        }
        .input-btn-right {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          z-index: 2;
        }
        .input-btn-right:hover {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.08);
        }
        .input-field {
          width: 100%;
          height: 48px;
          padding-left: 44px;
          padding-right: 44px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.85);
          color: white;
          font-size: 14px;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .input-field:focus {
          outline: none;
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
          background: rgba(15, 23, 42, 0.95);
        }
        .remember-forgot-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: -2px;
          margin-bottom: 2px;
          width: 100%;
          flex-wrap: nowrap;
        }
        .remember-checkbox-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .remember-checkbox-input {
          width: 16px;
          height: 16px;
          accent-color: #ef4444;
          border-radius: 4px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .remember-checkbox-text {
          font-size: 13px;
          color: #94a3b8;
          font-weight: 500;
          white-space: nowrap;
        }
        .forgot-pass-btn {
          background: none;
          border: none;
          color: #f43f5e;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 0;
          transition: color 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .forgot-pass-btn:hover {
          color: #fb7185;
          text-decoration: underline;
        }
        .submit-btn-custom {
          width: 100%;
          height: 48px;
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
        .submit-btn-custom:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 20px rgba(163, 20, 34, 0.35);
        }
        .submit-btn-custom:disabled {
          opacity: 0.7;
          cursor: not-allowed;
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
            align-items: center;
            justify-content: center;
          }
          .left-side {
            display: none;
          }
          .right-side {
            width: 100%;
            min-height: 100vh;
            padding: 2rem 1.25rem;
            border-left: none;
            border-top: none;
            background: transparent;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          .login-card {
            padding: 1.5rem 1.25rem;
            border-radius: 24px;
          }
          .input-field {
            height: 52px;
            font-size: 16px;
            padding-left: 48px;
            padding-right: 48px;
            border-radius: 14px;
          }
          .input-icon-left {
            left: 16px;
          }
          .input-btn-right {
            right: 12px;
            padding: 8px;
          }
          .submit-btn-custom {
            height: 52px;
            font-size: 15px;
            border-radius: 14px;
          }
          .remember-forgot-row {
            flex-wrap: nowrap;
            width: 100%;
            gap: 8px;
          }
          .remember-checkbox-label {
            white-space: nowrap;
            flex-shrink: 0;
          }
          .remember-checkbox-text,
          .forgot-pass-btn {
            font-size: 13px;
            white-space: nowrap;
            flex-shrink: 0;
          }
          .right-side > div {
            gap: 1.25rem !important;
          }
          .logo-box {
            width: 70px;
            height: 70px;
            margin-bottom: 0.5rem;
          }
          .logo-box + div h2 {
            font-size: 1.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};
