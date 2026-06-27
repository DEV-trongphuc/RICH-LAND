import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, Hand, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import styles from './LoginPage.module.css';
import { DEV_MODE } from '../config/env';
import { useMockStore } from '../store/mockStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const mockUsers = useMockStore(state => state.users);
  const [form, setForm] = useState({ email: 'admin@richland.crm', password: 'password' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMockLogin = (user: any) => {
    setAuth(user, 'mock_access_token', 'mock_refresh_token');
    navigate('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      setAuth(data.data.user, data.data.access_token, data.data.refresh_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.formCard}>
        <div className={styles.brandContainer}>
          <div className={styles.brandIcon}>
            <img src="/LOGO.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span className={styles.brandName}>CRM Portal</span>
        </div>

        <div className={styles.formHeader}>
          <h2>Đăng nhập</h2>
          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            Chào mừng trở lại <Hand size={16} color="var(--color-warning)" />
          </p>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label className="form-label" style={{ color: '#94a3b8' }}>Email</label>
            <div className={styles.inputWrap}>
              <Mail size={16} className={styles.inputIcon} />
              <input
                type="email" 
                className={`${styles.inputPadded}`}
                value={form.email} 
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="email@company.com" 
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: '#94a3b8' }}>Mật khẩu</label>
            <div className={styles.inputWrap}>
              <Lock size={16} className={styles.inputIcon} />
              <input
                type={showPw ? 'text' : 'password'} 
                className={`${styles.inputPadded} ${styles.inputPaddedRight}`}
                value={form.password} 
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••" 
                required
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className={styles.forgotRow}>
            <a href="#" className={styles.forgotLink}>Quên mật khẩu?</a>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : null}
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {DEV_MODE && (
          <div className={styles.devModeSection}>
            <p className={styles.devModeTitle}>
              DEV MODE: Đăng nhập nhanh theo Role
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {mockUsers.map((u: any) => (
                <button
                  key={u.id}
                  type="button"
                  className={styles.mockUserBtn}
                  onClick={() => handleMockLogin(u)}
                >
                  <div className={styles.mockUserAvatar}>
                    {u.avatar ? <img src={u.avatar} alt="" /> : <User size={14} />}
                  </div>
                  <div className={styles.mockUserText}>
                    <div className="name">{u.full_name}</div>
                    <div className="role">Role: {u.role}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!DEV_MODE && (
          <div className={styles.demoHint}>
            <p>Demo: admin@richland.crm / password</p>
          </div>
        )}
      </div>
    </div>
  );
};
