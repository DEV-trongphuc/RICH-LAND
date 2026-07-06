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
  const devLoginAccounts = [
    { name: 'Super Admin', email: 'superadmin@richland.net', password: 'superadmin123', role: 'superadmin' },
    { name: 'Admin', email: 'admin@richland.net', password: 'admin123', role: 'admin' },
    { name: 'Director (Giám đốc KD)', email: 'director@richland.net', password: 'director123', role: 'director' },
    { name: 'Manager (Trưởng nhóm)', email: 'manager@richland.net', password: 'manager123', role: 'manager' },
    { name: 'Sale (Hải Đăng)', email: 'haidang@richland.net', password: 'sale123', role: 'sales' },
    { name: 'Assistant (Trợ lý)', email: 'assistant@richland.net', password: 'assistant123', role: 'assistant' },
    { name: 'Viewer (Người xem)', email: 'viewer@richland.net', password: 'viewer123', role: 'viewer' },
  ];

  const [form, setForm] = useState({ email: 'admin@richland.net', password: 'admin123' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDevLogin = async (account: typeof devLoginAccounts[0]) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', {
        email: account.email,
        password: account.password
      });
      setAuth(data.data.user, data.data.access_token, data.data.refresh_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập dev thất bại. Vui lòng chạy run_migrations.php.');
    } finally {
      setLoading(false);
    }
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
              DEV MODE: Đăng nhập nhanh theo Role (Real DB Account)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
              {devLoginAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className={styles.mockUserBtn}
                  onClick={() => handleDevLogin(acc)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '0.8rem', width: '100%', height: 'auto' }}
                >
                  <div className={styles.mockUserAvatar} style={{ flexShrink: 0 }}>
                    <User size={12} />
                  </div>
                  <div className={styles.mockUserText} style={{ textAlign: 'left' }}>
                    <div className="name" style={{ fontWeight: 600, fontSize: '0.78rem' }}>{acc.name}</div>
                    <div className="role" style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>Role: {acc.role}</div>
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
