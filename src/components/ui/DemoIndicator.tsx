import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEV_MODE } from '../../config/env';
import { AlertCircle, Terminal, X, Send, User, Mail, Building, Phone, Loader2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { CustomSelect } from './CustomSelect';

export const DemoIndicator: React.FC = () => {
  const { addToast } = useUIStore();
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    size: '1-10',
    note: 'Đăng ký trải nghiệm RICH LAND CRM'
  });

  if (!DEV_MODE) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      addToast('Vui lòng nhập tên và email', 'error');
      return;
    }

    setLoading(true);
    try {
      // URL của Google Apps Script Web App
      const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwY3J_VJN6lhGHaoJ0zNnOyYxsswyb3I1KqQ7nrdeElMZreXEKO_cigKEOEhtH-0noK/exec'; 
      
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          source: 'RICH LAND CRM Demo',
          timestamp: new Date().toLocaleString('vi-VN')
        })
      });

      addToast('Đăng ký thành công! Chúng tôi sẽ liên hệ sớm nhất.', 'success');
      setShowModal(false);
      setFormData({ name: '', email: '', phone: '', company: '', size: '1-10', note: '' });
    } catch (error) {
      console.error('Submit error:', error);
      addToast('Có lỗi xảy ra khi gửi đăng ký. Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchRole = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <>
      <motion.div 
        initial={{ y: -50, x: '-50%', opacity: 0 }} 
        animate={{ y: 0, x: '-50%', opacity: 1 }}
        style={{
          position: 'fixed',
          top: 12,
          left: '50%',
          zIndex: 900,
          pointerEvents: 'auto'
        }}
      >
        <div style={{
          background: 'rgba(25, 10, 50, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(189, 29, 45, 0.4)',
          padding: '6px 16px',
          borderRadius: '99px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 32px rgba(88, 28, 135, 0.3)',
          color: 'white'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            background: 'linear-gradient(135deg, #BD1D2D, #8a0f1b)',
            borderRadius: '50%',
            boxShadow: '0 0 15px rgba(189, 29, 45, 0.5)'
          }}>
            <Terminal size={14} />
          </div>
          <span 
            onClick={handleSwitchRole}
            style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.02em', cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            DEMO MODE: <span style={{ color: '#c4b5fd', textDecoration: 'underline' }}>SWITCH ROLE ACCOUNT</span>
          </span>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
          
          <button 
            onClick={() => setShowModal(true)}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #b45309)',
              border: 'none',
              borderRadius: '99px',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '4px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(180, 83, 9, 0.4)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(180, 83, 9, 0.5)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(180, 83, 9, 0.4)';
            }}
          >
            <Send size={10} /> ĐĂNG KÝ SỬ DỤNG
          </button>
        </div>
      </motion.div>

      {/* Registration Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !loading && setShowModal(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(15, 5, 30, 0.7)', backdropFilter: 'blur(8px)', zIndex: 10000 }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: '-45%', x: '-50%' }}
              animate={{ opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
              exit={{ opacity: 0, scale: 0.9, y: '-45%', x: '-50%' }}
              style={{
                position: 'fixed', top: '50%', left: '50%', width: '900px',
                maxWidth: '95vw', maxHeight: '90vh', background: 'var(--color-surface)', borderRadius: '32px', zIndex: 10001,
                boxShadow: 'var(--shadow-2xl)', border: '1px solid var(--color-border)',
                overflow: 'visible', display: 'flex'
              }}
            >
              {/* Left Panel: Promo */}
              <div style={{ width: '380px', background: 'linear-gradient(135deg, #2e1065, #4c1d95)', padding: '3rem', color: 'white', display: 'flex', flexDirection: 'column', position: 'relative', flexShrink: 0, borderTopLeftRadius: '32px', borderBottomLeftRadius: '32px', overflow: 'hidden' }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Building size={24} />
                  </div>
                  <h3 style={{ fontSize: '1.875rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem', letterSpacing: '-0.02em' }}>Nâng tầm quản trị cùng RICH LAND</h3>
                  <p style={{ fontSize: '1rem', opacity: 0.8, lineHeight: 1.6, marginBottom: '2.5rem' }}>Hệ thống quản trị khách hàng tối ưu nhất cho doanh nghiệp vừa và nhỏ.</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {[
                      'Bảo mật dữ liệu tuyệt đối trên host riêng',
                      'Theo dõi tương tác khách hàng 360 độ',
                      'Quản lý phễu bán hàng & kho hàng',
                      'Hỗ trợ kỹ thuật 24/7'
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                          width: 20, height: 20, borderRadius: '50%', 
                          background: 'linear-gradient(135deg, #f59e0b, #b45309)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(180, 83, 9, 0.4)'
                        }}>
                          <Send size={10} style={{ transform: 'rotate(-45deg)', color: 'white' }} />
                        </div>
                        <span style={{ fontSize: '0.925rem', fontWeight: 600 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Decorative Elements */}
                <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', width: '200px', height: '200px', background: 'rgba(189, 29, 45, 0.2)', borderRadius: '50%', filter: 'blur(40px)', zIndex: 1 }} />
                <div style={{ position: 'absolute', top: '20%', left: '-30px', width: '100px', height: '100px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '50%', filter: 'blur(30px)', zIndex: 1 }} />
              </div>

              {/* Right Panel: Form */}
              <div style={{ flex: 1, padding: '2.5rem 3.5rem', position: 'relative', background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg) 100%)', borderTopRightRadius: '32px', borderBottomRightRadius: '32px' }}>
                <button 
                  onClick={() => setShowModal(false)}
                  style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'var(--color-bg)', border: 'none', color: 'var(--color-text)', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface)'}
                ><X size={20}/></button>

                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Bắt đầu ngay hôm nay</h4>
                <p style={{ fontSize: '0.925rem', color: 'var(--color-text-muted)', marginBottom: '2.5rem' }}>Để lại thông tin, chuyên gia của chúng tôi sẽ phản hồi trong 24h.</p>

                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-light)' }}>Họ và tên <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          className="form-input lg" style={{ paddingLeft: '2.75rem', borderRadius: '12px' }} 
                          placeholder="Nguyễn Văn A" required
                          value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                        <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#BD1D2D', opacity: 0.7 }} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-light)' }}>Số điện thoại</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          className="form-input lg" style={{ paddingLeft: '2.75rem', borderRadius: '12px' }} 
                          placeholder="09xx xxx xxx"
                          value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                        />
                        <Phone size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#BD1D2D', opacity: 0.7 }} />
                      </div>
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-light)' }}>Email doanh nghiệp <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          className="form-input lg" style={{ paddingLeft: '2.75rem', borderRadius: '12px' }} 
                          type="email" placeholder="example@business.com" required
                          value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                        <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#BD1D2D', opacity: 0.7 }} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-light)' }}>Tên doanh nghiệp</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          className="form-input lg" style={{ paddingLeft: '2.75rem', borderRadius: '12px' }} 
                          placeholder="Tên công ty của bạn..."
                          value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})}
                        />
                        <Building size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#BD1D2D', opacity: 0.7 }} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-light)' }}>Quy mô nhân sự</label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ borderRadius: '12px', height: '44px' }} className="demo-select-wrapper">
                          <CustomSelect 
                            options={[
                            { value: '1-10', label: 'Dưới 10 nhân sự' },
                            { value: '11-50', label: 'Từ 11 - 50 nhân sự' },
                            { value: '51-200', label: 'Từ 51 - 200 nhân sự' },
                            { value: '200+', label: 'Trên 200 nhân sự' }
                          ]}
                          value={formData.size} 
                          onChange={val => setFormData({...formData, size: String(val)})}
                        />
                        <style>{`
                          .demo-select-wrapper > div > div:first-of-type {
                            border-radius: 12px;
                            height: 44px;
                            min-height: 44px;
                            padding-left: 2.75rem;
                          }
                        `}</style>
                        </div>
                        <Users size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#BD1D2D', opacity: 0.7, pointerEvents: 'none', zIndex: 10 }} />
                      </div>
                    </div>
                  </div>

                  <button 
                    className="btn primary" 
                    type="submit" 
                    disabled={loading}
                    style={{ 
                      width: '100%', height: '56px', marginTop: '1.5rem', 
                      fontWeight: 800, fontSize: '1.125rem', borderRadius: '16px', 
                      background: 'linear-gradient(135deg, #BD1D2D, #4c1d95)',
                      boxShadow: '0 10px 25px -5px rgba(88, 28, 135, 0.4)' 
                    }}
                  >
                    {loading ? <><Loader2 size={22} className="animate-spin" style={{ marginRight: 12 }} /> ĐANG XỬ LÝ...</> : 'GỬI ĐĂNG KÝ TRẢI NGHIỆM'}
                  </button>
                  
                  <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    <AlertCircle size={14} style={{ color: '#f59e0b' }} />
                    <span>Chúng tôi cam kết bảo mật thông tin và phản hồi sớm nhất.</span>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
