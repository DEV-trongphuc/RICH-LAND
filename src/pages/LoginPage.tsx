import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, Hand, User, Laptop } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import styles from './LoginPage.module.css';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: 'admin@richland.crm', password: 'password' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

        <div className={styles.demoHint}>
          <p>Demo: admin@richland.crm / password</p>
        </div>

        {/*
        <div style={{ marginTop: '1.25rem', textAlign: 'center', borderTop: '1px solid rgba(148, 163, 184, 0.12)', paddingTop: '1rem' }}>
          <a 
            href="/download" 
            style={{ 
              fontSize: '0.8rem', 
              color: 'var(--color-primary)', 
              fontWeight: 600, 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              textDecoration: 'none',
              transition: 'opacity 0.2s'
            }}
          >
            <Laptop size={14} /> Tải ứng dụng Desktop (Windows / macOS)
          </a>
        </div>
        */}
      </div>
    </div>
  );
};
