import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LogOut, Search, Filter, AlertCircle, CheckCircle2,
  XCircle, Clock, FileText,
  Clock3, GitBranch, ArrowUpRight, ShieldAlert, Send
} from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart
} from 'recharts';
import toast from 'react-hot-toast';
import { fetchAPI } from '../utils/api';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useLanguage } from '../contexts/LanguageContext';
import { Avatar } from '../components/ui/Avatar';
import { TableSkeleton, StatRowSkeleton } from '../components/ui/Skeleton';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';

export const SalePortal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, login, logout } = useAuth();
  const { t } = useLanguage();

  // Parse initial search query from email link
  const getInitialSearch = () => {
    const params = new URLSearchParams(location.search);
    return params.get('search') || '';
  };

  // State definitions
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({
    leads: [],
    rounds: [],
    consultants: [],
    stats: {
      total_received: 0,
      tickets_total: 0,
      tickets_approved: 0,
      tickets_rejected: 0,
      tickets_pending: 0
    },
    by_round: [],
    by_hour: Array(24).fill(0)
  });

  const [portalVacationMode, setPortalVacationMode] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filters
  const [search, setSearch] = useState(getInitialSearch());
  const [roundId, setRoundId] = useState('');
  const [saleIdFilter, setSaleIdFilter] = useState('');
  const [dateMode, setDateMode] = useState('this_month'); // all, today, yesterday, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);

  // Authentication states
  const [googleError, setGoogleError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isAdminMsg, setIsAdminMsg] = useState('');

  // Ticket submission modal states
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [reportReasonType, setReportReasonType] = useState('Số điện thoại không đúng / Thuê bao');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeDetailLead, setActiveDetailLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Google Login element references
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  // Dynamically load Google Client library
  useEffect(() => {
    if (!document.getElementById('google-jssdk')) {
      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // Initialize Google Login button
  const handleGoogleLoginResponse = async (response: any) => {
    setGoogleLoading(true);
    setGoogleError('');
    setIsAdminMsg('');
    try {
      const res = await fetch('https://open.domation.net/sale_data/api.php?action=login_google_sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const json = await res.json();
      if (json.success) {
        if (json.is_admin) {
          setIsAdminMsg(json.message || t('Bạn là admin, để xem đầy đủ vui lòng truy cập link gốc production.'));
        } else {
          login(json.token, json.user);
          toast.success(t('Chào mừng') + ` ${json.user.name} ` + t('quay trở lại!'));
        }
      } else {
        setGoogleError(json.message || t('Xác thực tài khoản Google thất bại'));
      }
    } catch (e) {
      setGoogleError(t('Không thể kết nối đến máy chủ xác thực Google. Vui lòng thử lại.'));
    }
    setGoogleLoading(false);
  };

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
          { theme: 'outline', size: 'large', width: 300, text: 'signin_with', shape: 'rectangular' }
        );
        renderedRef.current = true;
        clearInterval(intervalId);
      }
    };

    initGoogle();
    intervalId = setInterval(initGoogle, 500);
    return () => clearInterval(intervalId);
  }, [user]);

  // Fetch portal data when token is valid
  const loadPortalData = async () => {
    if (!token || !['sale', 'admin', 'assistant', 'viewer'].includes(user?.role || '')) return;
    setLoading(true);
    try {
      let query = `get_sale_portal_data&search=${encodeURIComponent(search)}&round_id=${roundId}&date_mode=${dateMode}&sale_id=${saleIdFilter}`;
      if (dateMode === 'custom') {
        query += `&start_date=${startDate}&end_date=${endDate}`;
      }
      const json = await fetchAPI(query);
      if (json.success) {
        setData(json);
        if (json.vacation_mode !== undefined) setPortalVacationMode(Boolean(Number(json.vacation_mode)));
      } else {
        toast.error(json.message || t('Không thể tải dữ liệu'));
      }
    } catch (err: any) {
      if (err.message !== 'Unauthorized') {
        toast.error(t('Lỗi tải dữ liệu: ') + err.message);
      }
    }
    setLoading(false);
  };

  const handleTogglePortalVacation = async () => {
    try {
      const json = await fetchAPI('toggle_consultant_vacation', {
        method: 'POST',
        body: JSON.stringify({ id: user?.consultant_id })
      });
      if (json.success) {
        toast.success(t('Đã thay đổi chế độ nghỉ phép nhanh'));
        setPortalVacationMode(Boolean(Number(json.vacation_mode)));
      } else {
        toast.error(json.message || t('Lỗi thay đổi trạng thái'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    }
  };

  const handleAcceptLead = async (leadId: number) => {
    try {
      const json = await fetchAPI('accept_lead', {
        method: 'POST',
        body: JSON.stringify({ lead_id: leadId })
      });
      if (json.success) {
        toast.success(t('Tiếp nhận lead thành công!'));
        loadPortalData();
      } else {
        toast.error(json.message || t('Lỗi tiếp nhận lead'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, [token, user, roundId, dateMode, saleIdFilter]);

  useEffect(() => {
    const handleLeadAdded = () => {
      loadPortalData();
    };
    window.addEventListener('lead-added', handleLeadAdded);
    return () => window.removeEventListener('lead-added', handleLeadAdded);
  }, [token, user, roundId, dateMode, saleIdFilter]);

  // Load timeline for selected lead in modal
  useEffect(() => {
    if (activeDetailLead?.lead_id && detailModalOpen && token) {
      setLoadingTimeline(true);
      fetchAPI(`get_sale_lead_timeline&lead_id=${activeDetailLead.lead_id}`)
        .then((json) => {
          if (json.success) {
            setTimeline(json.timeline || []);
          } else {
            toast.error(json.message || 'Không thể tải lịch sử nhắc lại');
            setTimeline([]);
          }
        })
        .catch((err) => {
          console.error(err);
          setTimeline([]);
        })
        .finally(() => {
          setLoadingTimeline(false);
        });
    } else {
      setTimeline([]);
    }
  }, [activeDetailLead, detailModalOpen, token]);

  // Handle manual apply for Custom date and search button
  const handleApplyFilters = () => {
    loadPortalData();
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadPortalData();
    }
  };

  const handleDateModeChange = (val: string) => {
    setDateMode(val);
    if (val === 'custom') {
      setShowCustomDate(true);
    } else {
      setShowCustomDate(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success(t('Đã đăng xuất tài khoản.'));
  };

  // Submit quick ticket
  const handleOpenReportModal = (lead: any) => {
    setSelectedLead(lead);
    setReportReasonType('Số điện thoại không đúng / Thuê bao');
    setReportDetails('');
    setReportModalOpen(true);
  };

  const handleSubmitReport = async () => {
    if (!selectedLead) return;
    setSubmittingReport(true);
    try {
      const fullReason = `${reportReasonType}${reportDetails ? ' - ' + reportDetails.trim() : ''}`;
      const payload = {
        lead_id: selectedLead.lead_id,
        sale_id: user?.role === 'sale' ? user?.consultant_id : selectedLead.assigned_to,
        round_id: selectedLead.round_id,
        reason: fullReason
      };

      const res = await fetch('https://open.domation.net/sale_data/api.php?action=submit_report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        if (json.auto_approved) {
          toast.success(t('Báo cáo lỗi đã được HỆ THỐNG TỰ ĐỘNG PHÊ DUYỆT & ĐỀN BÙ thành công!'), { duration: 6000 });
        } else {
          toast.success(t('Gửi báo lỗi data thành công! Đang chờ admin duyệt bù.'));
        }
        setReportModalOpen(false);
        loadPortalData();
      } else {
        toast.error(json.message || t('Gửi báo lỗi thất bại'));
      }
    } catch (err) {
      toast.error(t('Không thể kết nối máy chủ gửi báo lỗi'));
    }
    setSubmittingReport(false);
  };

  // Prepare chart data for Recharts (Hourly distribution)
  const hourlyChartData = data.by_hour.map((count: number, hr: number) => ({
    time: `${String(hr).padStart(2, '0')}:00`,
    volume: count
  }));

  // Render Login Layout if not authorized
  if (!token || !['sale', 'admin', 'assistant', 'viewer'].includes(user?.role || '')) {
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
        {/* Animated Background Elements */}
        <div style={{
          position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%', filter: 'blur(60px)', animation: 'float 12s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%', width: '60vw', height: '60vw',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%', filter: 'blur(80px)', animation: 'float 15s ease-in-out infinite reverse'
        }} />

        <div style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 450,
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
          padding: '3rem 2rem',
          textAlign: 'center'
        }}>
          {/* Header/Logo */}
          <div style={{
            width: 64, height: 64, margin: '0 auto 1.5rem', borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124,58,237,0.3)', overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.9)'
          }}>
            <img
              src="https://crm-domation.vercel.app/LOGO.jpg"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo"
            />
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            {t('CỔNG TƯ VẤN VIÊN')}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.925rem', marginTop: 6, lineHeight: 1.5 }}>
            {t('Vui lòng đăng nhập bằng tài khoản Google nhận mail để tra cứu danh sách khách hàng và quản lý tickets.')}
          </p>
 
          <div style={{ margin: '2rem 0' }}>
            {isAdminMsg ? (
              <div style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                padding: '1.25rem', borderRadius: '16px', color: '#b45309', fontSize: '0.9rem',
                lineHeight: 1.6, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontWeight: 700 }}>
                  <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                  <span>{t('Cảnh báo quản trị')}</span>
                </div>
                <span>{isAdminMsg}</span>
                <button
                  onClick={() => navigate('/')}
                  style={{
                    background: '#d97706', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '8px 16px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#b45309')}
                  onMouseOut={(e) => (e.currentTarget.style.background = '#d97706')}
                >
                  {t('Vào trang Quản trị')} <ArrowUpRight size={14} />
                </button>
              </div>
            ) : user && !['sale', 'admin', 'assistant', 'viewer'].includes(user.role) ? (
              <div style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                padding: '1.25rem', borderRadius: '16px', color: '#b45309', fontSize: '0.9rem',
                lineHeight: 1.6, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontWeight: 700 }}>
                  <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                  <span>{t('Quyền truy cập bị từ chối')}</span>
                </div>
                <span>{t('Tài khoản hiện tại của bạn không có vai trò Tư vấn viên. Vui lòng chuyển sang tài khoản Gmail của Sale hoặc đăng xuất.')}</span>
                <button
                  onClick={handleLogout}
                  style={{
                    background: '#d97706', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '8px 16px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
                  }}
                >
                  {t('Đăng xuất tài khoản')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                <div ref={googleBtnRef} style={{ minHeight: 44 }}></div>
 
                {googleLoading && <div style={{ fontSize: '0.85rem', color: '#6366f1' }}>{t('Đang kết nối Google API...')}</div>}
 
                {googleError && (
                  <div style={{
                    padding: '0.75rem 1rem', background: 'var(--color-danger-light)', border: '1px solid var(--color-danger-light)',
                    color: 'var(--color-danger)', borderRadius: '12px', fontSize: '0.825rem', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: '6px', width: '100%', textAlign: 'left'
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{googleError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
 
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
            {t('Hệ thống Quản lý Domation DATA')} &copy; 2026
          </div>
        </div>
        <style>{`
          @keyframes float {
            0% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-20px) scale(1.03); }
            100% { transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    );
  }

  // Active Sale Portal View
  return (
    <div style={{ height: '100vh', width: '100vw', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Header Navigation */}
      <header className="portal-header" style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
        color: 'white', padding: '1rem 2rem', position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div className="portal-header-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.2)', overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.9)'
          }}>
            <img
              src="https://crm-domation.vercel.app/LOGO.jpg"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo"
            />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '0.5px' }}>DOMATION PORTAL</h1>
            <span style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
              {t('Dành riêng cho TVV')}
            </span>
          </div>
        </div>

        <div className="portal-header-user" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {user?.role === 'sale' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 12px', marginRight: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: !portalVacationMode ? '#10b981' : '#f59e0b' }}>
                {!portalVacationMode ? t('Nhận data') : t('Nghỉ phép nhanh')}
              </span>
              <ToggleSwitch
                checked={!portalVacationMode}
                onChange={handleTogglePortalVacation}
              />
            </div>
          )}
          <Avatar src={user?.avatar} name={user?.name} size={36} />
          <div className="portal-header-user-info" style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f8fafc' }}>{user?.name}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="portal-header-logout"
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px', color: 'white', padding: '8px 14px', fontSize: '0.85rem',
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            <LogOut size={16} /> {t('Đăng xuất')}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="no-scrollbar portal-main-content" style={{ flex: 1, padding: '2rem', maxWidth: 1400, width: '100%', margin: '0 auto', overflowY: 'auto' }}>

        {/* Top Filter and Actions Row */}
        <div className="portal-filters-row" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem',
          background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px',
          padding: '1rem 1.5rem'
        }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{t('Tổng quan hiệu suất')}</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>{t('Thống kê & phân tích dựa trên bộ lọc được chọn.')}</p>
          </div>

          <div className="portal-filters-list" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Round Filter */}
            <div className="portal-filter-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="portal-filter-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('VÒNG:')}</span>
              <CustomSelect
                options={[
                  { value: '', label: 'Tất cả vòng' },
                  ...data.rounds.map((r: any) => ({ value: r.id, label: r.round_name }))
                ]}
                value={roundId}
                onChange={(val) => setRoundId(String(val))}
                width={160}
              />
            </div>

            {/* Sale Filter (Only for non-sale roles) */}
            {user?.role !== 'sale' && data.consultants && (
              <div className="portal-filter-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="portal-filter-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TƯ VẤN VIÊN:')}</span>
                <CustomSelect
                  options={[
                    { value: '', label: 'Tất cả TVV' },
                    ...(data.consultants || []).map((c: any) => ({ value: c.id, label: c.name, avatar: c.avatar }))
                  ]}
                  value={saleIdFilter}
                  onChange={(val) => setSaleIdFilter(String(val))}
                  width={200}
                  showAvatars={true}
                  searchable={true}
                />
              </div>
            )}

            {/* Date Mode Filter */}
            <div className="portal-filter-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="portal-filter-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('THỜI GIAN:')}</span>
              <CustomSelect
                options={[
                  { value: 'all', label: 'Tất cả thời gian' },
                  { value: 'today', label: 'Hôm nay' },
                  { value: 'yesterday', label: 'Hôm qua' },
                  { value: 'this_week', label: 'Tuần này' },
                  { value: 'last_week', label: 'Tuần trước' },
                  { value: 'two_weeks_ago', label: 'Tuần trước nữa' },
                  { value: '7_days', label: '7 ngày qua' },
                  { value: '30_days', label: '30 ngày qua' },
                  { value: 'this_month', label: 'Tháng này' },
                  { value: 'last_month', label: 'Tháng trước' },
                  { value: 'this_year', label: 'Năm nay' },
                  { value: 'custom', label: 'Tùy chọn ngày...' }
                ]}
                value={dateMode}
                onChange={(val) => handleDateModeChange(String(val))}
                width={180}
              />
            </div>

            {/* Custom Date Inputs */}
            {showCustomDate && (
              <div className="portal-filter-custom-date" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0',
                    fontSize: '0.85rem', outline: 'none'
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t('đến')}</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0',
                    fontSize: '0.85rem', outline: 'none'
                  }}
                />
              </div>
            )}

            {/* Apply filters button */}
            <button
              onClick={handleApplyFilters}
              className="portal-filter-apply-btn"
              style={{
                background: '#7c3aed', color: 'white', border: 'none',
                borderRadius: '10px', padding: '9px 18px', fontSize: '0.85rem', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(124,58,237,0.2)'
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#6d28d9')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#7c3aed')}
            >
              <Filter size={14} /> {t('Áp dụng')}
            </button>
          </div>
        </div>

        {/* KPI Dashboard Row */}
        <section className="portal-kpis-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.25rem', marginBottom: '2rem'
        }}>
          {/* Card 1: Data received */}
          <div className="card" style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px',
            padding: '1.25rem', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('DATA KHÁCH HÀNG')}</span>
              <div style={{ color: '#7c3aed', background: 'rgba(124,58,237,0.1)', padding: '6px', borderRadius: '8px' }}>
                <FileText size={18} />
              </div>
            </div>
            <div className="portal-kpi-val" style={{ fontSize: '1.75rem', fontWeight: 800, margin: '8px 0 2px', color: 'var(--color-text)' }}>
              {data.stats.total_received}
            </div>
            <span className="portal-kpi-subtext" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Tổng data được bàn giao')}</span>
          </div>

          {/* Card 2: Tickets Total */}
          <div className="card" style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px',
            padding: '1.25rem', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('BÁO CÁO TỔNG CỘNG')}</span>
              <div style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '6px', borderRadius: '8px' }}>
                <AlertCircle size={18} />
              </div>
            </div>
            <div className="portal-kpi-val" style={{ fontSize: '1.75rem', fontWeight: 800, margin: '8px 0 2px', color: 'var(--color-text)' }}>
              {data.stats.tickets_total}
            </div>
            <span className="portal-kpi-subtext" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Tổng số ticket đã gửi đi')}</span>
          </div>

          {/* Card 3: Pending */}
          <div className="card" style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px',
            padding: '1.25rem', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TICKET CHỜ DUYỆT')}</span>
              <div style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '6px', borderRadius: '8px' }}>
                <Clock size={18} />
              </div>
            </div>
            <div className="portal-kpi-val" style={{ fontSize: '1.75rem', fontWeight: 800, margin: '8px 0 2px', color: '#f59e0b' }}>
              {data.stats.tickets_pending}
            </div>
            <span className="portal-kpi-subtext" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Đang chờ Admin xử lý')}</span>
          </div>

          {/* Card 4: Approved */}
          <div className="card" style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px',
            padding: '1.25rem', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('ĐÃ DUYỆT BÙ')}</span>
              <div style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '6px', borderRadius: '8px' }}>
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="portal-kpi-val" style={{ fontSize: '1.75rem', fontWeight: 800, margin: '8px 0 2px', color: '#10b981' }}>
              {data.stats.tickets_approved}
            </div>
            <span className="portal-kpi-subtext" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Ticket hợp lệ & đã được bù')}</span>
          </div>

          {/* Card 5: Rejected */}
          <div className="card" style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px',
            padding: '1.25rem', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TỪ CHỐI BÙ')}</span>
              <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '6px', borderRadius: '8px' }}>
                <XCircle size={18} />
              </div>
            </div>
            <div className="portal-kpi-val" style={{ fontSize: '1.75rem', fontWeight: 800, margin: '8px 0 2px', color: '#ef4444' }}>
              {data.stats.tickets_rejected}
            </div>
            <span className="portal-kpi-subtext" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('Ticket bị từ chối / Không được bù')}</span>
          </div>
        </section>

        {/* Charts & Analytical Section */}
        <section className="portal-charts-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
          gap: '1.5rem', marginBottom: '2rem'
        }}>
          {/* Chart Left: Hourly Flow */}
          <div className="card" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <Clock3 size={18} color="#7c3aed" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('LƯU LƯỢNG NHẬN DATA THEO KHUNG GIỜ')}
              </h3>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourlyChartData} margin={{ left: -20, right: 5, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: 'var(--color-surface)', padding: '8px 12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid var(--color-border)', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{label}</div>
                          <div style={{ color: '#7c3aed', marginTop: 2 }}>{t('Số lượng data: ')}<span style={{ fontWeight: 800 }}>{payload[0].value}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="volume" fill="#7c3aed" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={16} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart Right: Rounds Ratio */}
          <div className="card" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <GitBranch size={18} color="#4f46e5" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('TỶ LỆ PHÂN BỔ THEO VÒNG (ROUND)')}
              </h3>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'center' }}>
              {data.by_round && data.by_round.length > 0 ? (
                data.by_round.map((r: any, idx: number) => {
                  const percentage = data.stats.total_received > 0
                    ? Math.round((r.count / data.stats.total_received) * 100)
                    : 0;
                  const colors = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
                  const themeColor = colors[idx % colors.length];

                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-light)' }}>{r.round_name}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          <strong>{r.count} {t('data')}</strong> ({percentage}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: 8, background: 'var(--color-border-light)', borderRadius: 999 }}>
                        <div style={{
                          height: '100%', width: `${percentage}%`, background: themeColor,
                          borderRadius: 999, transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                        }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  {t('Chưa có dữ liệu phân bổ vòng chia')}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Search controls panel */}
        <section className="mobile-stack" style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px',
          padding: '1.25rem', marginBottom: '1.5rem', display: 'flex',
          alignItems: 'center', gap: '1rem'
        }}>
          {/* Quick Search */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: 11, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder={t("Tìm kiếm bằng SĐT hoặc Email khách hàng (Nhập từ khóa và bấm Tìm kiếm hoặc nhấn Enter)...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              style={{
                width: '100%', padding: '8px 12px 8px 40px', borderRadius: '10px',
                border: '1px solid var(--color-border)', fontSize: '0.875rem', outline: 'none',
                background: 'var(--color-bg)', transition: 'all 0.2s', color: 'var(--color-text)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#7c3aed';
                e.currentTarget.style.background = 'var(--color-surface)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.background = 'var(--color-bg)';
              }}
            />
          </div>

          <button
            onClick={handleApplyFilters}
            className="mobile-w-full"
            style={{
              background: '#4f46e5', color: 'white', border: 'none',
              borderRadius: '10px', padding: '9px 18px', fontSize: '0.85rem', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#4338ca')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#4f46e5')}
          >
            <Search size={14} /> {t('Tìm kiếm')}
          </button>
        </section>

        {/* Detailed Data List Table */}
        <section className="card" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              {t('DANH SÁCH DỮ LIỆU ĐƯỢC PHÂN BỔ')}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', background: 'var(--color-border-light)', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
              {t('Đang hiển thị')} {data.leads.length} {t('dòng')}
            </span>
          </div>

          <div className="table-wrap responsive-table-wrap" style={{ overflowX: 'auto' }}>
            {loading ? (
              <TableSkeleton cols={5} rows={6} />
            ) : data.leads.length > 0 ? (
              <table className="mobile-table-compact" style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('KHÁCH HÀNG')}</th>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('LIÊN HỆ')}</th>
                    {user?.role === 'sale' ? (
                      <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('VÒNG')}</th>
                    ) : (
                      <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('PHÂN BỔ CHO')}</th>
                    )}
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('NGUỒN / PHÂN LOẠI')}</th>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('THỜI GIAN NHẬN')}</th>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700, textAlign: 'center' }}>{t('TICKET')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.map((lead: any, index: number) => (
                    <tr
                      key={lead.log_id}
                      onClick={() => {
                        setActiveDetailLead(lead);
                        setDetailModalOpen(true);
                      }}
                      style={{
                        borderBottom: '1px solid var(--color-border-light)',
                        background: index % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)',
                        transition: 'background 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-primary-light)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = index % 2 === 0 ? 'var(--color-surface)' : 'var(--color-bg)')}
                    >
                      {/* KHÁCH HÀNG */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} title={t("Xem chi tiết")}>
                            <Avatar name={lead.lead_name || t('Khách hàng')} size={32} />
                            <span
                              style={{
                                fontWeight: 700,
                                color: '#0f172a'
                              }}
                              onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {lead.lead_name || t('Chưa cập nhật')}
                            </span>
                          </div>

                          {/* Accept Button & Timer */}
                          {user?.role === 'sale' && !Number(lead.is_accepted) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                              {(() => {
                                const leadRecallMins = Number(lead.lead_recall_minutes) || 0;
                                const limitMs = leadRecallMins * 60 * 1000;
                                const elapsedMs = now - new Date(lead.last_interaction_date).getTime();
                                const remainingMs = limitMs - elapsedMs;

                                if (leadRecallMins > 0 && remainingMs <= 0) {
                                  return (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                                      {t('Quá hạn')}
                                    </span>
                                  );
                                }

                                const formatTime = (ms: number) => {
                                  const totalSecs = Math.max(0, Math.floor(ms / 1000));
                                  const mins = Math.floor(totalSecs / 60);
                                  const secs = totalSecs % 60;
                                  return `${mins}:${String(secs).padStart(2, '0')}`;
                                };

                                return (
                                  <>
                                    {leadRecallMins > 0 && (
                                      <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Clock size={12} /> {formatTime(remainingMs)}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => handleAcceptLead(lead.lead_id)}
                                      style={{
                                        background: '#3b82f6', color: 'white', border: 'none',
                                        borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem',
                                        fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                                        display: 'flex', alignItems: 'center', gap: 4
                                      }}
                                      onMouseOver={e => e.currentTarget.style.background = '#2563eb'}
                                      onMouseOut={e => e.currentTarget.style.background = '#3b82f6'}
                                    >
                                      {t('Tiếp nhận')}
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          {user?.role === 'sale' && Number(lead.is_accepted) && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: '12px',
                              background: '#e6f4ea', color: '#137333', fontSize: '0.725rem', fontWeight: 700
                            }}>
                              <CheckCircle2 size={12} /> {t('Đã tiếp nhận')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* LIÊN HỆ */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: '#d97706', fontWeight: 700 }}>{lead.phone}</span>
                          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{lead.lead_email || '—'}</span>
                        </div>
                      </td>

                      {/* VÒNG / PHÂN BỔ CHO */}
                      {user?.role === 'sale' ? (
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            <span style={{
                              display: 'inline-flex',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              background: '#e0e7ff',
                              color: '#4338ca',
                              fontSize: '0.75rem',
                              fontWeight: 700
                            }}>
                              {lead.round_name || t('Mặc định')}
                            </span>
                          </div>
                        </td>
                      ) : (
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={lead.sale_avatar} name={lead.sale_name || t('Chưa nhận')} size="sm" />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                                {lead.sale_name || t('Chưa nhận')}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {lead.round_name || t('Mặc định')}
                              </span>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* NGUỒN / PHÂN LOẠI */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 500 }}>
                            {lead.source || 'N/A'}
                          </span>
                          {lead.type && (
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                              {lead.type}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* THỜI GIAN NHẬN */}
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#64748b' }}>
                          <span>{lead.received_at ? new Date(lead.received_at).toLocaleString('vi-VN') : 'N/A'}</span>
                          {lead.status === 'compensation' && (
                            <span style={{
                              alignSelf: 'flex-start',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#d1fae5',
                              color: '#065f46',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              marginTop: '2px'
                            }}>
                              {t('Data bù')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* TICKET (Trạng thái / Báo lỗi) */}
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          {lead.report_status === 'pending' && (
                            <div
                              style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: '#fef3c7', color: '#d97706' }}
                              title={t("Ticket chờ duyệt (Bấm để xem chi tiết)")}
                            >
                              <Clock size={16} />
                            </div>
                          )}
                          {lead.report_status === 'approved' && (
                            <div
                              style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'var(--color-success-light)', color: 'var(--color-success)' }}
                              title={t("Ticket đã duyệt bù (Bấm để xem chi tiết)")}
                            >
                              <CheckCircle2 size={16} />
                            </div>
                          )}
                          {lead.report_status === 'rejected' && (
                            <div
                                style={{
                                  display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'var(--color-danger-light)', color: 'var(--color-danger)'
                                }}
                              title={`${t('Ticket từ chối bù:')} ${lead.report_reject_reason || t('Không cung cấp')} ${t('(Bấm để xem chi tiết)')}`}
                            >
                              <XCircle size={16} />
                            </div>
                          )}
                          {!lead.report_status && (
                            <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenReportModal(lead);
                                }}
                              style={{
                                background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: 'none',
                                borderRadius: '50%', width: '32px', height: '32px',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'all 0.2s'
                              }}
                              title={t("Gửi báo cáo lỗi data")}
                              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-danger)', e.currentTarget.style.color = '#ffffff')}
                              onMouseOut={(e) => (e.currentTarget.style.background = 'var(--color-danger-light)', e.currentTarget.style.color = 'var(--color-danger)')}
                            >
                              <AlertCircle size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
                <span>{t('Không tìm thấy dữ liệu nào khớp với bộ lọc hiện tại.')}</span>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Modal 1: Quick Report / Submit Ticket */}
      {reportModalOpen && selectedLead && (
        <CustomModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          title={t("BÁO CÁO LỖI DỮ LIỆU")}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'var(--color-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
              <div style={{ marginBottom: '6px' }}>
                <strong>{t('Tên Khách hàng:')}</strong> {selectedLead.lead_name}
              </div>
              <div style={{ marginBottom: '6px' }}>
                <strong>{t('Số điện thoại:')}</strong> <span style={{ color: '#d97706', fontWeight: 700 }}>{selectedLead.phone}</span>
              </div>
              <div>
                <strong>{t('Vòng chia:')}</strong> {selectedLead.round_name || t('Mặc định')}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-light)', marginBottom: '6px' }}>
                {t('Lý do báo lỗi (Chọn mẫu có sẵn)')}
              </label>
              <select
                value={reportReasonType}
                onChange={(e) => setReportReasonType(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  border: '1px solid var(--color-border)', fontSize: '0.875rem', background: 'var(--color-surface)',
                  color: 'var(--color-text)', outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="Số điện thoại không đúng / Thuê bao">{t("Số điện thoại không đúng / Thuê bao")}</option>
                <option value="Khách hàng trùng lặp">{t("Khách hàng trùng lặp (Đã được giao trước đó)")}</option>
                <option value="Khách hàng không có nhu cầu / Spam">{t("Khách hàng không có nhu cầu / Spam")}</option>
                <option value="Sai dòng sản phẩm / Nhầm phân bổ">{t("Sai dòng sản phẩm / Nhầm phân bổ")}</option>
                <option value="Lý do khác (Vui lòng ghi chi tiết)">{t("Lý do khác (Vui lòng ghi chi tiết ở dưới)")}</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-light)', marginBottom: '6px' }}>
                {t('Mô tả chi tiết lỗi (Không bắt buộc)')}
              </label>
              <textarea
                placeholder={t("Nhập thêm chi tiết lỗi hoặc dẫn chứng trùng lặp...")}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                style={{
                  width: '100%', height: 100, padding: '10px 12px', borderRadius: '10px',
                  border: '1px solid var(--color-border)', fontSize: '0.875rem', outline: 'none',
                  resize: 'none', fontFamily: 'inherit', color: 'var(--color-text)', background: 'var(--color-surface)'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                onClick={() => setReportModalOpen(false)}
                style={{
                  background: 'var(--color-border-light)', color: 'var(--color-text-light)', border: 'none', borderRadius: '8px',
                  padding: '10px 20px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer'
                }}
              >
                {t('Hủy bỏ')}
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={submittingReport}
                style={{
                  background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px',
                  padding: '10px 20px', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Send size={16} /> {submittingReport ? t('Đang gửi...') : t('Gửi báo cáo lỗi')}
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {/* Modal 2: View Details */}
      {detailModalOpen && activeDetailLead && (
        <CustomModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={t("CHI TIẾT THÔNG TIN KHÁCH HÀNG")}
          width="900px"
        >
          <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem', fontSize: '0.9rem', minHeight: '380px' }}>
            {/* Cột trái: Thông tin khách hàng & Ghi chú */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Họ và tên:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{activeDetailLead.lead_name || t('Chưa cập nhật')}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Số điện thoại:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--score-warm)' }}>{activeDetailLead.phone}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Email:')}</span>
                <span style={{ color: 'var(--color-text)' }}>{activeDetailLead.lead_email || '—'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Vòng chia:')}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{activeDetailLead.round_name || t('Mặc định')}</span>
                  {activeDetailLead.status === 'compensation' && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'var(--color-success-light)',
                      color: 'var(--color-success)',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      marginTop: '2px'
                    }}>
                      {t('Data bù')}
                    </span>
                  )}
                </div>
              </div>

              {user?.role !== 'sale' && (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Tư vấn viên:')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar src={activeDetailLead.sale_avatar} name={activeDetailLead.sale_name || t('Chưa nhận')} size="sm" />
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{activeDetailLead.sale_name || t('Chưa nhận')}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Nguồn khách:')}</span>
                <span style={{ color: 'var(--color-text)' }}>{activeDetailLead.source || 'N/A'}</span>
              </div>

              {activeDetailLead.type && (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Phân loại:')}</span>
                  <span style={{ color: 'var(--color-text)' }}>{activeDetailLead.type}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Nhận lúc:')}</span>
                <span style={{ color: 'var(--color-text-light)' }}>
                  {activeDetailLead.received_at ? new Date(activeDetailLead.received_at).toLocaleString('vi-VN') : 'N/A'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Tiếp nhận:')}</span>
                <span style={{ fontWeight: 700, color: Number(activeDetailLead.is_accepted) ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {Number(activeDetailLead.is_accepted)
                    ? `${t('Đã tiếp nhận lúc')} ${activeDetailLead.accepted_at ? new Date(activeDetailLead.accepted_at).toLocaleString('vi-VN') : ''}`
                    : t('Chưa tiếp nhận')}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--color-bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)', marginTop: '4px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{t('Ghi chú đính kèm:')}</span>
                <span style={{ color: 'var(--color-text)', whiteSpace: 'pre-line', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {activeDetailLead.note
                    ? activeDetailLead.note
                        .replace(/\\n/g, '\n')
                        .split('\n')
                        .filter((line: string) => !/^(?:Nhập dữ liệu cũ|Nhap du lieu cu)\s*(?:\(Silent\))?$/i.test(line.trim()))
                        .join('\n')
                        .trim() || t('Không có ghi chú.')
                    : t('Không có ghi chú.')}
                </span>
              </div>

              {activeDetailLead.report_status && (
                <div style={{
                  background: activeDetailLead.report_status === 'approved' ? 'var(--color-success-light)' : activeDetailLead.report_status === 'pending' ? 'var(--color-warning-light)' : 'var(--color-danger-light)',
                  color: activeDetailLead.report_status === 'approved' ? 'var(--color-success)' : activeDetailLead.report_status === 'pending' ? 'var(--color-warning)' : 'var(--color-danger)',
                  padding: '12px', borderRadius: '10px', border: '1px solid currentColor', marginTop: '4px'
                }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: 4 }}>
                    <AlertCircle size={16} />
                    <span>
                      {t('Báo cáo lỗi: ')}{activeDetailLead.report_status === 'approved' ? t('Đã duyệt bù') : activeDetailLead.report_status === 'pending' ? t('Chờ quản trị viên duyệt') : t('Đã bị từ chối')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem' }}><strong>{t('Lý do gửi:')}</strong> {activeDetailLead.report_reason || '—'}</div>
                  {activeDetailLead.report_status === 'rejected' && (
                    <div style={{ fontSize: '0.8rem', marginTop: 4 }}><strong>{t('Lý do từ chối:')}</strong> {activeDetailLead.report_reject_reason || t('Không cung cấp lý do.')}</div>
                  )}
                </div>
              )}
            </div>

            {/* Cột phải: Lịch sử bàn giao & Nhắc lại */}
            <div className="portal-detail-right" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '1px solid var(--color-border)', paddingLeft: '1.5rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '8px' }}>{t('Lịch sử bàn giao & Nhắc lại:')}</span>
              
              {loadingTimeline ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                </div>
              ) : timeline && timeline.length > 0 ? (
                <div className="timeline" style={{ marginTop: '4px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                  {timeline.map((item: any, idx: number) => {
                    let dotColor = '#94a3b8';
                    if (item.status === 'Đã bàn giao') dotColor = '#3b82f6';
                    if (item.status === 'Nhắc trùng') dotColor = '#f59e0b';
                    if (item.status === 'Bù lượt') dotColor = '#10b981';

                    return (
                      <div key={idx} className="timeline-item" style={{ marginBottom: '1.25rem' }}>
                        <div className="timeline-icon" style={{ backgroundColor: dotColor, left: '-1.85rem', width: '1rem', height: '1rem', border: '3px solid var(--color-surface)', boxShadow: '0 0 0 1px var(--color-border)' }} />
                        <div className="timeline-content" style={{ background: 'var(--color-bg)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.85rem' }}>
                              {t(item.status)} {item.round_name ? `(${item.round_name})` : ''}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {new Date(item.received_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Avatar src={item.consultant_avatar} name={item.consultant_name} size={16} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                              <strong>{t('Nhận bởi:')}</strong> {item.consultant_name || t('Chưa rõ')}
                            </span>
                          </div>
                          {item.message && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                              &ldquo;{item.message}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', padding: '8px' }}>
                  {t('Không có lịch sử nhắc lại trước đó.')}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            <button
              onClick={() => setDetailModalOpen(false)}
              style={{
                background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px',
                padding: '8px 24px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              {t('Đóng lại')}
            </button>
          </div>
        </CustomModal>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
