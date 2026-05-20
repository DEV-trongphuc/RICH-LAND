import React, { useState, useEffect } from 'react';
import { User, Key, Eye, EyeOff, Save, ShieldAlert, Mail } from 'lucide-react';
import { fetchAPI } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { CustomModal } from './ui/CustomModal';
import toast from 'react-hot-toast';

export const ProfileModal = () => {
  const { user, login } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  
  // Profile State
  const [profileData, setProfileData] = useState({ name: '', email: '' });
  
  // Password State
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passData, setPassData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    const handleOpen = () => {
      setProfileData({ name: user?.name || '', email: user?.email || user?.username || '' });
      setPassData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setActiveTab('profile');
      setIsOpen(true);
    };
    window.addEventListener('open-profile-modal', handleOpen);
    return () => window.removeEventListener('open-profile-modal', handleOpen);
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData.name) {
      toast.error('Tên không được để trống');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchAPI('update_profile', {
        method: 'POST',
        body: JSON.stringify({ name: profileData.name, email: profileData.email })
      });
      if (res.success) {
        toast.success('Cập nhật thông tin thành công!');
        // Update local user context so UI reflects the new name/email
        const token = localStorage.getItem('domation_token') || '';
        if (user) {
          login(token, { ...user, name: profileData.name, email: profileData.email, username: profileData.email } as any);
        }
        setIsOpen(false);
      } else {
        toast.error(res.message || 'Lỗi cập nhật');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi hệ thống');
    }
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passData.oldPassword || !passData.newPassword || !passData.confirmPassword) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    if (passData.newPassword !== passData.confirmPassword) {
      toast.error('Mật khẩu mới không khớp');
      return;
    }
    if (passData.newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchAPI('change_password', {
        method: 'POST',
        body: JSON.stringify({ old_password: passData.oldPassword, new_password: passData.newPassword })
      });
      if (res.success) {
        toast.success('Đổi mật khẩu thành công!');
        setIsOpen(false);
      } else {
        toast.error(res.message || 'Lỗi khi đổi mật khẩu');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi hệ thống');
    }
    setLoading(false);
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Thông tin Tài khoản"
      width="500px"
    >
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem', gap: '1rem', padding: '0 1rem' }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            color: activeTab === 'profile' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'profile' ? '2px solid var(--color-primary)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9375rem', transition: 'all 0.2s'
          }}
        >
          <User size={18} /> Hồ sơ của tôi
        </button>
        <button
          onClick={() => setActiveTab('password')}
          style={{
            padding: '12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
            fontWeight: activeTab === 'password' ? 700 : 500,
            color: activeTab === 'password' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: activeTab === 'password' ? '2px solid var(--color-primary)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9375rem', transition: 'all 0.2s'
          }}
        >
          <Key size={18} /> Đổi mật khẩu
        </button>
      </div>

      <div style={{ padding: '0 1rem' }}>
        {activeTab === 'profile' ? (
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label>Tên hiển thị</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-control"
                  value={profileData.name}
                  onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                  placeholder="Nhập tên hiển thị..."
                  style={{ paddingLeft: 42 }}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Email / Username đăng nhập</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-control"
                  value={profileData.email}
                  onChange={e => setProfileData({ ...profileData, email: e.target.value })}
                  placeholder="Nhập email đăng nhập..."
                  style={{ paddingLeft: 42 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" className="btn primary" disabled={loading}>
                {loading ? 'Đang xử lý...' : <><Save size={18} /> Cập nhật Thông tin</>}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '12px 16px', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <ShieldAlert size={20} color="#ef4444" style={{ marginTop: 2 }} />
              <div>
                <h4 style={{ color: '#991b1b', fontSize: '0.875rem', fontWeight: 700, margin: '0 0 4px 0' }}>Bảo mật tài khoản</h4>
                <p style={{ color: '#b91c1c', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
                  Nếu bạn quên mật khẩu, vui lòng Đăng xuất và sử dụng chức năng <strong>Quên mật khẩu</strong> tại màn hình Đăng nhập để khôi phục qua Email.
                </p>
              </div>
            </div>

            <div className="form-group">
              <label>Mật khẩu hiện tại</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showOldPass ? 'text' : 'password'}
                  className="form-control"
                  value={passData.oldPassword}
                  onChange={e => setPassData({ ...passData, oldPassword: e.target.value })}
                  placeholder="Nhập mật khẩu cũ..."
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowOldPass(!showOldPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  {showOldPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  className="form-control"
                  value={passData.newPassword}
                  onChange={e => setPassData({ ...passData, newPassword: e.target.value })}
                  placeholder="Nhập mật khẩu mới..."
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowNewPass(!showNewPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                  {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Xác nhận mật khẩu mới</label>
              <input
                type={showNewPass ? 'text' : 'password'}
                className="form-control"
                value={passData.confirmPassword}
                onChange={e => setPassData({ ...passData, confirmPassword: e.target.value })}
                placeholder="Nhập lại mật khẩu mới..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" className="btn primary" disabled={loading} style={{ background: '#10b981' }}>
                {loading ? 'Đang xử lý...' : <><Save size={18} /> Đổi Mật Khẩu</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </CustomModal>
  );
};
