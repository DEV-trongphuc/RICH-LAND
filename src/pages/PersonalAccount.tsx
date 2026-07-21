import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { User, Key, Eye, EyeOff, Save, ShieldAlert, Mail, Activity, Clock, Settings, ChevronDown, ChevronUp, LogOut, Edit3 } from 'lucide-react';
import { SignaturePadModal } from '../components/ui/SignaturePadModal';
import { fetchAPI } from '../utils/api';
import { compressToWebP } from '../utils/imageCompress';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import toast from 'react-hot-toast';
import { StatRowSkeleton } from '../components/ui/Skeleton';
import { withRouterFreezer } from '../components/RouterFreezer';
import styles from './EntityDrawer.module.css';

const PersonalAccountInner = () => {
  const { t } = useLanguage();
  const { user, login, logout, updateUser } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'activity'>('profile');
  const [loading, setLoading] = useState(false);
  
  // Profile State
  const [profileData, setProfileData] = useState({ name: '', email: '', avatar: '' });
  
  // Password State
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passData, setPassData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  // Activity Logs State
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [signatureUrl, setSignatureUrl] = useState<string | null>(user?.signature_url || null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || user.username || '',
        avatar: user.avatar || ''
      });
      setSignatureUrl(user.signature_url || null);
    }
  }, [user]);

  const handleSaveSignatureInProfile = async (newSigUrl: string) => {
    setSignatureUrl(newSigUrl);
    const res = await fetchAPI('update_profile', {
      method: 'POST',
      body: JSON.stringify({ signature_url: newSigUrl })
    });
    if (res.success) {
      updateUser({ signature_url: newSigUrl });
    } else {
      throw new Error(res.message || t('Lỗi lưu chữ ký'));
    }
  };

  useEffect(() => {
    if (activeTab === 'activity') {
      const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
          const res = await fetchAPI('get_my_activity_logs');
          if (res.success) {
            setActivityLogs(res.data || []);
          }
        } catch (err) {
          console.error(t('Lỗi khi tải lịch sử hoạt động:'), err);
        } finally {
          setLoadingLogs(false);
        }
      };
      fetchLogs();
    }
  }, [activeTab]);

  const toggleExpand = (logId: number) => {
    setExpandedLogs(prev => ({ ...prev, [logId]: !prev[logId] }));
  };

  const formatLogDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    const dd = pad(d.getDate());
    const mMonth = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    return `${hh}:${mm}:${ss} ${dd}-${mMonth}-${yyyy}`;
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('Vui lòng chọn file hình ảnh hợp lệ.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('Kích thước ảnh không được vượt quá 5MB.'));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const compressedFile = await compressToWebP(file);
      const fd = new FormData();
      fd.append('avatar', compressedFile);

      const oldAvatar = profileData.avatar || '';
      const query = `upload_avatar&old_avatar=${encodeURIComponent(oldAvatar)}`;
      const res = await fetchAPI(query, {
        method: 'POST',
        body: fd
      });

      if (res.success && res.url) {
        setProfileData(prev => ({ ...prev, avatar: res.url }));
        if (user) {
          const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
          login(token, { ...user, avatar: res.url } as any);
        }
        toast.success(t('Tải ảnh đại diện lên thành công!'));
      } else {
        toast.error(res.message || t('Lỗi khi tải ảnh lên'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData.name) {
      toast.error(t('Tên không được để trống'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetchAPI('update_profile', {
        method: 'POST',
        body: JSON.stringify({ name: profileData.name, avatar: profileData.avatar })
      });
      if (res.success) {
        toast.success(t('Cập nhật thông tin thành công!'));
        const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
        if (user) {
          login(token, { ...user, name: profileData.name, avatar: profileData.avatar } as any);
        }
      } else {
        toast.error(res.message || t('Lỗi cập nhật'));
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi hệ thống'));
    }
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passData.oldPassword || !passData.newPassword || !passData.confirmPassword) {
      toast.error(t('Vui lòng nhập đầy đủ thông tin'));
      return;
    }
    if (passData.newPassword !== passData.confirmPassword) {
      toast.error(t('Mật khẩu mới không khớp'));
      return;
    }
    if (passData.newPassword.length < 6) {
      toast.error(t('Mật khẩu mới phải có ít nhất 6 ký tự'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetchAPI('auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: passData.oldPassword, new_password: passData.newPassword })
      });
      if (res.success) {
        toast.success(t('Đổi mật khẩu thành công!'));
        setPassData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(res.message || t('Lỗi khi đổi mật khẩu'));
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi hệ thống'));
    }
    setLoading(false);
  };

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'superadmin':
        return { label: 'Super Admin', color: 'var(--color-primary)', bg: 'rgba(189, 29, 45, 0.1)' };
      case 'admin':
        return { label: 'Admin', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' };
      case 'director':
        return { label: 'Director', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' };
      case 'manager':
        return { label: 'Manager', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' };
      default:
        return { label: role || 'User', color: '#4b5563', bg: 'rgba(75, 85, 99, 0.1)' };
    }
  };

  const badge = getRoleBadge(user?.role || '');

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
          {t('Tài khoản cá nhân')}
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
          {t('Quản lý thông tin hồ sơ cá nhân, đổi mật khẩu và xem lịch sử hoạt động.')}
        </p>
      </div>

      <div className={styles.drawerBody} style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        minHeight: isMobile ? 'auto' : '600px',
        background: 'var(--color-surface)',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden'
      }}>
        
        {/* Left Column: Sidebar with Avatar & Vertical Tabs */}
        <div className={styles.sidebarTabs} style={{
          width: isMobile ? '100%' : '280px',
          borderRight: isMobile ? 'none' : '1px solid var(--color-border)',
          borderBottom: isMobile ? '1px solid var(--color-border)' : 'none',
          padding: isMobile ? '1.5rem 1rem' : '2rem 1.5rem',
          background: 'var(--color-bg-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          flexShrink: 0
        }}>
          {/* Avatar block */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-block', position: 'relative', marginBottom: '1.25rem' }}>
              <Avatar src={profileData.avatar} name={profileData.name || 'User'} size={96} />
              {isUploadingAvatar && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('Tải...')}</span>
                </div>
              )}
            </div>

            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 6px 0' }}>
              {profileData.name || user?.username}
            </h2>
            
            <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '16px', fontSize: '0.72rem', fontWeight: 700, color: badge.color, backgroundColor: badge.bg, marginBottom: '1.25rem' }}>
              {badge.label}
            </div>

            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t('Email liên kết')}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-all' }}>{profileData.email}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t('Quyền truy cập')}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>{badge.label} System Access</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn outline sm"
                style={{ width: '100%', fontSize: '0.75rem', height: '34px' }}
                disabled={isUploadingAvatar}
              >
                {t('Thay đổi ảnh đại diện')}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Navigation Buttons Stacked Vertically / Horizontally */}
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'row' : 'column', 
            gap: '6px', 
            borderTop: isMobile ? 'none' : '1px solid var(--color-border)', 
            paddingTop: isMobile ? '0' : '1.5rem',
            overflowX: isMobile ? 'auto' : 'visible',
            scrollbarWidth: 'none',
            width: '100%',
            flexShrink: 0
          }} className="hide-scrollbar">
            <button
              onClick={() => setActiveTab('profile')}
              className={`${styles.sidebarTabBtn} ${activeTab === 'profile' ? styles.active : ''}`}
              style={{
                width: isMobile ? 'auto' : '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px', fontSize: '0.8125rem', whiteSpace: 'nowrap', flexShrink: 0
              }}
            >
              <User size={16} />
              <span>{t('Thông tin hồ sơ')}</span>
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`${styles.sidebarTabBtn} ${activeTab === 'password' ? styles.active : ''}`}
              style={{
                width: isMobile ? 'auto' : '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px', fontSize: '0.8125rem', whiteSpace: 'nowrap', flexShrink: 0
              }}
            >
              <Key size={16} />
              <span>{t('Mật khẩu & Bảo mật')}</span>
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`${styles.sidebarTabBtn} ${activeTab === 'activity' ? styles.active : ''}`}
              style={{
                width: isMobile ? 'auto' : '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px', fontSize: '0.8125rem', whiteSpace: 'nowrap', flexShrink: 0
              }}
            >
              <Activity size={16} />
              <span>{t('Lịch sử hoạt động')}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Profile details Content Area */}
        <div className={styles.contentArea} style={{
          flex: 1,
          padding: isMobile ? '1.5rem 0 1rem 0' : '2.5rem',
          background: 'var(--color-surface)',
          overflowY: isMobile ? 'visible' : 'auto'
        }}>
            {/* Tab 1: Profile */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Tên hiển thị')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileData.name}
                    onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                    placeholder={t("Nhập họ và tên...")}
                    style={{ height: '40px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Email / Tên đăng nhập')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileData.email}
                    disabled
                    style={{ height: '40px', cursor: 'not-allowed', backgroundColor: 'var(--color-bg-light)', color: 'var(--color-text-muted)' }}
                  />
                  <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                    {t('Tên đăng nhập không thể thay đổi sau khi tạo để bảo mật vết hệ thống.')}
                  </small>
                </div>
                <div className="form-group" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border-light)' }}>
                  <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('Chữ ký Điện tử Cá nhân')}</span>
                    <button
                      type="button"
                      onClick={() => setShowSignatureModal(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#BD1D2D',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Edit3 size={14} />
                      {signatureUrl ? t('Thay đổi chữ ký mẫu') : t('Tạo chữ ký mẫu')}
                    </button>
                  </label>

                  {signatureUrl ? (
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      maxHeight: '100px',
                      backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                      backgroundSize: '12px 12px'
                    }}>
                      <img src={signatureUrl} alt="Chữ ký mẫu" style={{ maxHeight: '75px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div
                      onClick={() => setShowSignatureModal(true)}
                      style={{
                        border: '2px dashed var(--color-border)',
                        borderRadius: '8px',
                        padding: '16px',
                        textAlign: 'center',
                        color: 'var(--color-text-muted)',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        background: 'var(--color-bg-light)'
                      }}
                    >
                      {t('Bạn chưa thiết lập chữ ký mẫu. Bấm vào đây để vẽ hoặc tải ảnh chữ ký.')}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '1.5rem' }}>
                  <button type="submit" className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', height: '40px', fontWeight: 700 }} disabled={loading}>
                    <Save size={16} /> {loading ? t('Đang lưu...') : t('Lưu thay đổi')}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Password */}
            {activeTab === 'password' && (
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', borderLeft: '4px solid #ef4444', padding: '1rem', borderRadius: '4px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ color: '#ef4444', fontSize: '0.875rem', fontWeight: 700, margin: '0 0 4px 0' }}>{t('Độ mật khẩu cao')}</h4>
                    <p style={{ color: 'var(--color-text-light)', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
                      {t('Hãy đảm bảo mật khẩu mới của bạn tối thiểu 6 ký tự và bao gồm ký tự đặc biệt để đảm bảo an toàn tuyệt đối.')}
                    </p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Mật khẩu hiện tại')}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showOldPass ? 'text' : 'password'}
                      className="form-input"
                      value={passData.oldPassword}
                      onChange={e => setPassData({ ...passData, oldPassword: e.target.value })}
                      placeholder={t("Nhập mật khẩu cũ...")}
                      style={{ paddingRight: '45px', height: '40px' }}
                    />
                    <button type="button" onClick={() => setShowOldPass(!showOldPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                      {showOldPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Mật khẩu mới')}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      className="form-input"
                      value={passData.newPassword}
                      onChange={e => setPassData({ ...passData, newPassword: e.target.value })}
                      placeholder={t("Nhập mật khẩu mới...")}
                      style={{ paddingRight: '45px', height: '40px' }}
                    />
                    <button type="button" onClick={() => setShowNewPass(!showNewPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                      {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Xác nhận mật khẩu mới')}</label>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    className="form-input"
                    value={passData.confirmPassword}
                    onChange={e => setPassData({ ...passData, confirmPassword: e.target.value })}
                    placeholder={t("Nhập lại mật khẩu mới...")}
                    style={{ height: '40px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '1.5rem' }}>
                  <button type="submit" className="btn primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 20px', height: '40px', fontWeight: 700 }} disabled={loading}>
                    <Save size={16} /> {loading ? t('Đang cập nhật...') : t('Đổi mật khẩu')}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 3: Activity Logs */}
            {activeTab === 'activity' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {loadingLogs ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <StatRowSkeleton />
                    <StatRowSkeleton />
                    <StatRowSkeleton />
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                    {t('Chưa có hoạt động nào được ghi nhận.')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto' }} className="custom-scrollbar">
                      {activityLogs
                        .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                        .map((log: any) => {
                          const action = (log.action || '').toUpperCase();
                          let logTitle = t('Thao tác quản trị');
                          if (action.includes('PASSWORD')) {
                            logTitle = t('Thay đổi mật khẩu');
                          } else if (action.includes('PROFILE') || action.includes('AVATAR')) {
                            logTitle = t('Cập nhật thông tin cá nhân');
                          } else if (action.includes('LEAD_BLACKLIST') || action.includes('BLOCK_LEAD')) {
                            logTitle = t('Quản lý danh sách đen');
                          } else if (action.includes('HELD_LEAD') || action.includes('REJECT_HELD_LEAD')) {
                            logTitle = t('Kiểm soát dữ liệu trùng');
                          }

                          const isExpanded = expandedLogs[log.id] || false;

                          return (
                            <div 
                              key={log.id} 
                              style={{ 
                                padding: '16px', 
                                background: 'var(--color-bg-light)', 
                                border: '1px solid var(--color-border-light)', 
                                borderRadius: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                              }}
                            >
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{
                                  background: 'var(--color-primary)',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '32px',
                                  height: '32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {(() => {
                                    const act = action.toLowerCase();
                                    if (act.includes('password')) return <Key size={14} />;
                                    if (act.includes('profile') || act.includes('avatar')) return <User size={14} />;
                                    return <Settings size={14} />;
                                  })()}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                                      {logTitle}
                                    </h4>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Clock size={12} /> {formatLogDate(log.created_at)}
                                    </span>
                                  </div>
                                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', margin: '4px 0 0', lineHeight: 1.4 }}>
                                    Hành động: <code style={{ padding: '2px 6px', background: 'var(--color-surface)', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>{log.action}</code>
                                  </p>
                                </div>
                              </div>

                              {log.details && (
                                <div style={{ marginTop: '4px', borderTop: '1px dashed var(--color-border-light)', paddingTop: '8px' }}>
                                  <button
                                    onClick={() => toggleExpand(log.id)}
                                    style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    {isExpanded ? <><ChevronUp size={12} /> {t('Thu gọn chi tiết')}</> : <><ChevronDown size={12} /> {t('Xem chi tiết')}</>}
                                  </button>
                                  
                                  {isExpanded && (
                                    <pre style={{
                                      marginTop: '8px',
                                      background: 'var(--color-surface)',
                                      border: '1px solid var(--color-border)',
                                      borderRadius: '8px',
                                      padding: '12px',
                                      fontFamily: 'monospace',
                                      fontSize: '0.75rem',
                                      color: 'var(--color-text-light)',
                                      overflowX: 'auto',
                                      whiteSpace: 'pre-wrap',
                                      margin: 0
                                    }}>
                                      {log.details}
                                    </pre>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Pagination */}
                    {activityLogs.length > ITEMS_PER_PAGE && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
                        <button
                          type="button"
                          className="btn outline sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        >
                          ← {t('Trước')}
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          {t('Trang')} {currentPage} / {Math.ceil(activityLogs.length / ITEMS_PER_PAGE)}
                        </span>
                        <button
                          type="button"
                          className="btn outline sm"
                          disabled={currentPage >= Math.ceil(activityLogs.length / ITEMS_PER_PAGE)}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(activityLogs.length / ITEMS_PER_PAGE)))}
                        >
                          {t('Sau')} →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => logout()}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                fontWeight: 700,
                fontSize: '0.9375rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <LogOut size={18} />
              {t('Đăng xuất tài khoản')}
            </button>
          </div>
        </div>

      </div>
      <SignaturePadModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSave={handleSaveSignatureInProfile}
        initialSignatureUrl={signatureUrl}
      />
    </div>
  );
};

export const PersonalAccount = withRouterFreezer(PersonalAccountInner, '/account');
