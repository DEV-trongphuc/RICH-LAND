import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { User, Key, Eye, EyeOff, Save, ShieldAlert, Mail, Activity, Clock } from 'lucide-react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { CustomModal } from './ui/CustomModal';
import { Avatar } from './ui/Avatar';
import toast from 'react-hot-toast';

export const ProfileModal = () => {
  const { t, language } = useLanguage();
  const { user, login } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'activity'>('profile');
  
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
  const ITEMS_PER_PAGE = 50;
  
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOpen = () => {
      setProfileData({ 
        name: user?.name || '', 
        email: user?.email || user?.username || '',
        avatar: user?.avatar || ''
      });
      setPassData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setActiveTab('profile');
      setIsOpen(true);
    };
    window.addEventListener('open-profile-modal', handleOpen);
    return () => window.removeEventListener('open-profile-modal', handleOpen);
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, isOpen]);

  useEffect(() => {
    if (activeTab === 'activity' && isOpen) {
      const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
          const res = await fetchAPI('get_my_activity_logs');
          if (res.success) {
            setActivityLogs(res.data || []);
          }
        } catch (err) {
          console.error('Lỗi khi tải lịch sử hoạt động:', err);
        } finally {
          setLoadingLogs(false);
        }
      };
      fetchLogs();
    }
  }, [activeTab, isOpen]);

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
      const fd = new FormData();
      fd.append('avatar', file);

      const oldAvatar = profileData.avatar || '';
      const query = `upload_avatar&old_avatar=${encodeURIComponent(oldAvatar)}`;
      const res = await fetchAPI(query, {
        method: 'POST',
        body: fd
      });

      if (res.success && res.url) {
        setProfileData(prev => ({ ...prev, avatar: res.url }));
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
        const token = localStorage.getItem('domation_token') || '';
        if (user) {
          login(token, { ...user, name: profileData.name, avatar: profileData.avatar } as any);
        }
        setIsOpen(false);
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
      const res = await fetchAPI('change_password', {
        method: 'POST',
        body: JSON.stringify({ old_password: passData.oldPassword, new_password: passData.newPassword })
      });
      if (res.success) {
        toast.success(t('Đổi mật khẩu thành công!'));
        setIsOpen(false);
      } else {
        toast.error(res.message || t('Lỗi khi đổi mật khẩu'));
      }
    } catch (err: any) {
      toast.error(err.message || t('Lỗi hệ thống'));
    }
    setLoading(false);
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title={t("Thông tin Tài khoản")}
      width="760px"
    >
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem', gap: '0.75rem', padding: '0 1rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            color: activeTab === 'profile' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'profile' ? '2px solid var(--color-primary)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', transition: 'all 0.2s', whiteSpace: 'nowrap'
          }}
        >
          <User size={16} /> {t('Hồ sơ của tôi')}
        </button>
        <button
          onClick={() => setActiveTab('password')}
          style={{
            padding: '12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
            fontWeight: activeTab === 'password' ? 700 : 500,
            color: activeTab === 'password' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'password' ? '2px solid var(--color-primary)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', transition: 'all 0.2s', whiteSpace: 'nowrap'
          }}
        >
          <Key size={16} /> {t('Đổi mật khẩu')}
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          style={{
            padding: '12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
            fontWeight: activeTab === 'activity' ? 700 : 500,
            color: activeTab === 'activity' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'activity' ? '2px solid var(--color-primary)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', transition: 'all 0.2s', whiteSpace: 'nowrap'
          }}
        >
          <Activity size={16} /> {t('Thống kê hoạt động')}
        </button>
      </div>

      <div style={{ padding: '0 1rem' }}>
        {activeTab === 'profile' && (
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Avatar Upload Container */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar src={profileData.avatar} name={profileData.name || 'User'} size={64} />
                {isUploadingAvatar && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600 }}>{t('Tải...')}</span>
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
                  {t('Ảnh đại diện')}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn outline sm"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto', background: 'white' }}
                    disabled={isUploadingAvatar}
                  >
                    {t('Tải ảnh lên')}
                  </button>
                  {profileData.avatar && (
                    <button
                      type="button"
                      onClick={() => setProfileData({ ...profileData, avatar: '' })}
                      className="btn outline sm"
                      style={{ fontSize: '0.75rem', padding: '4px 8px', height: 'auto', color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'white' }}
                    >
                      {t('Xóa ảnh')}
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                  {t('Chấp nhận JPG, PNG, WEBP (tối đa 5MB)')}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label>{t('Tên hiển thị')}</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-control"
                  value={profileData.name}
                  onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                  placeholder={t("Nhập tên hiển thị...")}
                  style={{ paddingLeft: 42 }}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>{t('Email / Username đăng nhập')}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-control"
                  value={profileData.email}
                  disabled
                  placeholder={t("Email đăng nhập...")}
                  style={{ paddingLeft: 42, cursor: 'not-allowed', backgroundColor: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" className="btn primary" disabled={loading}>
                {loading ? t('Đang xử lý...') : <><Save size={18} /> {t('Cập nhật Thông tin')}</>}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '12px 16px', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <ShieldAlert size={20} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <h4 style={{ color: '#991b1b', fontSize: '0.875rem', fontWeight: 700, margin: '0 0 4px 0' }}>{t('Bảo mật tài khoản')}</h4>
                <p style={{ color: '#b91c1c', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
                  {t('Nếu bạn quên mật khẩu, vui lòng Đăng xuất và sử dụng chức năng')} <strong>{t('Quên mật khẩu')}</strong> tại màn hình Đăng nhập để khôi phục qua Email.
                </p>
              </div>
            </div>

            <div className="form-group">
              <label>{t('Mật khẩu hiện tại')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showOldPass ? 'text' : 'password'}
                  className="form-control"
                  value={passData.oldPassword}
                  onChange={e => setPassData({ ...passData, oldPassword: e.target.value })}
                  placeholder={t("Nhập mật khẩu cũ...")}
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowOldPass(!showOldPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  {showOldPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>{t('Mật khẩu mới')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  className="form-control"
                  value={passData.newPassword}
                  onChange={e => setPassData({ ...passData, newPassword: e.target.value })}
                  placeholder={t("Nhập mật khẩu mới...")}
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowNewPass(!showNewPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>{t('Xác nhận mật khẩu mới')}</label>
              <input
                type={showNewPass ? 'text' : 'password'}
                className="form-control"
                value={passData.confirmPassword}
                onChange={e => setPassData({ ...passData, confirmPassword: e.target.value })}
                placeholder={t("Nhập lại mật khẩu mới...")}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" className="btn primary" disabled={loading} style={{ background: '#10b981' }}>
                {loading ? t('Đang xử lý...') : <><Save size={18} /> {t('Đổi Mật Khẩu')}</>}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'activity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
              {loadingLogs ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  {t('Đang tải lịch sử hoạt động...')}
                </div>
              ) : activityLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  {t('Không có hoạt động nào được ghi nhận.')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activityLogs
                    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                    .map((log: any) => {
                      const action = (log.action || '').toUpperCase();
                      let statusColor = '#7c3aed'; // default purple
                      let bgColor = 'rgba(124, 58, 237, 0.02)';
                      if (action.includes('ADD') || action.includes('CREATE') || action.includes('INSERT')) {
                        statusColor = '#10b981'; // green
                        bgColor = 'rgba(16, 185, 129, 0.02)';
                      } else if (action.includes('EDIT') || action.includes('UPDATE')) {
                        statusColor = '#3b82f6'; // blue
                        bgColor = 'rgba(59, 130, 246, 0.02)';
                      } else if (action.includes('DELETE') || action.includes('REMOVE')) {
                        statusColor = '#ef4444'; // red
                        bgColor = 'rgba(239, 68, 68, 0.02)';
                      }

                      return (
                        <div 
                          key={log.id} 
                          style={{ 
                            padding: '12px 16px', 
                            background: bgColor, 
                            border: '1px solid var(--color-border-light)', 
                            borderLeft: `4px solid ${statusColor}`,
                            borderRadius: 12,
                            fontSize: '0.8125rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span style={{ 
                              background: `${statusColor}1A`, // 10% opacity
                              color: statusColor, 
                              padding: '3px 8px', 
                              borderRadius: 6, 
                              fontSize: '0.7rem', 
                              fontWeight: 700, 
                              textTransform: 'uppercase',
                              letterSpacing: '0.02em'
                            }}>
                              {log.action}
                            </span>
                            <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} /> {new Date(log.created_at).toLocaleString(language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : 'en-US')}
                            </span>
                          </div>

                          {(() => {
                            try {
                              const parsed = JSON.parse(log.details);
                              if (parsed && typeof parsed === 'object') {
                                return (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                                    {Object.entries(parsed).map(([k, v]) => {
                                      const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
                                      return (
                                        <div key={k} style={{ 
                                          display: 'inline-flex', 
                                          alignItems: 'center', 
                                          background: 'white', 
                                          border: '1px solid var(--color-border-light)', 
                                          padding: '3px 8px', 
                                          borderRadius: 6, 
                                          fontSize: '0.7rem' 
                                        }}>
                                          <span style={{ color: 'var(--color-text-muted)', marginRight: 4, fontWeight: 500 }}>{k}:</span>
                                          <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{valStr}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              }
                            } catch {
                              if (log.details) {
                                return (
                                  <div style={{ color: 'var(--color-text-light)', marginTop: '0.5rem', marginBottom: '0.25rem', fontSize: '0.75rem', background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border-light)' }}>
                                    {log.details}
                                  </div>
                                );
                              }
                            }
                            return null;
                          })()}

                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8' }} /> IP: {log.ip_address}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {!loadingLogs && activityLogs.length > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginTop: '0.5rem', 
                borderTop: '1px solid var(--color-border-light)', 
                paddingTop: '0.75rem',
                paddingBottom: '0.5rem'
              }}>
                <span style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>
                  {t('Hiển thị')} {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, activityLogs.length)} {t('trên')} {activityLogs.length} {t('hoạt động')}
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn outline"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28 }}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    {t('Trước')}
                  </button>
                  <span style={{ padding: '4px 10px', fontSize: '0.775rem', fontWeight: 600 }}>
                    {t('Trang')} {currentPage} / {Math.ceil(activityLogs.length / ITEMS_PER_PAGE) || 1}
                  </span>
                  <button
                    type="button"
                    className="btn outline"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', height: 28 }}
                    disabled={currentPage === (Math.ceil(activityLogs.length / ITEMS_PER_PAGE) || 1)}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    {t('Sau')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CustomModal>
  );
};
