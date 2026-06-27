import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Camera, Lock, Save, Loader2, Info, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import api from '../../api/axios';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminProfileModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, setUser, clearAuth } = useAuthStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    bio: user?.bio || '',
    avatar_url: user?.avatar_url || '',
    old_password: '',
    new_password: '',
    confirm_password: ''
  });

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      // In real app: await api.put('/users/profile', { full_name: formData.full_name, bio: formData.bio, avatar_url: formData.avatar_url });
      // For now, we mock success and update store
      setTimeout(() => {
        const updatedUser = { ...user, full_name: formData.full_name, bio: formData.bio, avatar_url: formData.avatar_url } as any;
        setUser(updatedUser);
        addToast('Đã cập nhật thông tin cá nhân', 'success');
        setLoading(false);
      }, 1000);
    } catch (e) {
      addToast('Không thể cập nhật thông tin', 'error');
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!formData.old_password || !formData.new_password) {
      addToast('Vui lòng nhập đầy đủ mật khẩu', 'error');
      return;
    }
    if (formData.new_password !== formData.confirm_password) {
      addToast('Mật khẩu mới không khớp', 'error');
      return;
    }
    setLoading(true);
    try {
      // await api.put('/users/password', { old_password: formData.old_password, new_password: formData.new_password });
      setTimeout(() => {
        addToast('Đã đổi mật khẩu thành công', 'success');
        setFormData({ ...formData, old_password: '', new_password: '', confirm_password: '' });
        setLoading(false);
      }, 1000);
    } catch (e) {
      addToast('Mật khẩu cũ không chính xác', 'error');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="overlay-backdrop" 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            onClick={onClose} 
            style={{ zIndex: 1000 }} 
          />
          <motion.div 
            className="modal-sheet" 
            style={{ position: 'fixed', top: '50%', left: '50%', width: 500, maxWidth: 'calc(100vw - 2rem)', zIndex: 1010 }}
            initial={{ opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }} 
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }} 
            exit={{ opacity: 0, scale: 0.96, x: '-50%', y: '-50%' }}
          >
            <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={20} className="text-primary" />
                Cài đặt tài khoản Admin
              </h3>
              <button onClick={onClose}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '4px', margin: '1rem 1.5rem', borderRadius: '12px' }}>
              <button 
                onClick={() => setActiveTab('profile')}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, background: activeTab === 'profile' ? 'var(--color-surface)' : 'transparent', color: activeTab === 'profile' ? 'var(--color-primary)' : 'var(--color-text-light)', boxShadow: activeTab === 'profile' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
              >
                Hồ sơ cá nhân
              </button>
              <button 
                onClick={() => setActiveTab('security')}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, background: activeTab === 'security' ? 'var(--color-surface)' : 'transparent', color: activeTab === 'security' ? 'var(--color-primary)' : 'var(--color-text-light)', boxShadow: activeTab === 'security' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
              >
                Bảo mật & Mật khẩu
              </button>
            </div>

            <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem' }}>
              {activeTab === 'profile' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '2rem', fontWeight: 700, overflow: 'hidden' }}>
                        {formData.avatar_url ? <img src={formData.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : formData.full_name.charAt(0).toUpperCase()}
                      </div>
                      <button style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: '50%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', color: 'var(--color-primary)' }}>
                        <Camera size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Họ & Tên</label>
                    <input className="form-input" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Giới thiệu bản thân</label>
                    <textarea className="form-input" rows={3} style={{ resize: 'none' }} value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} placeholder="Nhập một vài dòng giới thiệu về bạn..." />
                  </div>

                  <button className="btn primary" onClick={handleSaveProfile} disabled={loading} style={{ marginTop: '0.5rem' }}>
                    {loading ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                    Lưu thay đổi
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ padding: '0.75rem 1rem', background: 'var(--color-info-light)', borderRadius: '10px', color: 'var(--color-info)', fontSize: '0.8125rem', display: 'flex', gap: '8px' }}>
                    <Info size={16} style={{ flexShrink: 0 }} />
                    <p>Mật khẩu nên chứa ít nhất 6 ký tự để đảm bảo an toàn.</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mật khẩu hiện tại</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                      <input className="form-input" type="password" style={{ paddingLeft: '2.25rem' }} value={formData.old_password} onChange={e => setFormData({...formData, old_password: e.target.value})} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mật khẩu mới</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                      <input className="form-input" type="password" style={{ paddingLeft: '2.25rem' }} value={formData.new_password} onChange={e => setFormData({...formData, new_password: e.target.value})} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Xác nhận mật khẩu mới</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                      <input className="form-input" type="password" style={{ paddingLeft: '2.25rem' }} value={formData.confirm_password} onChange={e => setFormData({...formData, confirm_password: e.target.value})} />
                    </div>
                  </div>

                  <button className="btn primary" onClick={handleUpdatePassword} disabled={loading} style={{ marginTop: '0.5rem' }}>
                    {loading ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                    Cập nhật mật khẩu
                  </button>

                  <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                    <button 
                      className="btn outline" 
                      style={{ width: '100%', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                      onClick={() => {
                        clearAuth();
                        addToast('Đã đăng xuất thành công', 'info');
                        navigate('/login');
                        onClose();
                      }}
                    >
                      <LogOut size={16} /> Đăng xuất tài khoản
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
