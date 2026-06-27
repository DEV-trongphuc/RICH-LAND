import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, AlignLeft, Phone, Mail, Users, CheckSquare, Zap } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { CustomSelect } from './CustomSelect';
import { MentionInput } from './MentionInput';
import api from '../../api/axios';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType?: 'contact' | 'company' | 'deal';
  entityId?: number;
  onSuccess?: () => void;
}

const TYPES = [
  { id: 'call', label: 'Cuộc gọi', icon: <Phone size={16} />, color: 'var(--color-primary)' },
  { id: 'email', label: 'Email', icon: <Mail size={16} />, color: '#10b981' },
  { id: 'meeting', label: 'Cuộc họp', icon: <Users size={16} />, color: '#f59e0b' },
  { id: 'task', label: 'Công việc', icon: <CheckSquare size={16} />, color: '#8b5cf6' },
  { id: 'note', label: 'Ghi chú', icon: <AlignLeft size={16} />, color: '#f59e0b' }
];

export const ActivityModal: React.FC<ActivityModalProps> = ({ isOpen, onClose, entityType, entityId, onSuccess }) => {
  const { addToast } = useUIStore();
  const [formData, setFormData] = useState({
    type: 'task',
    subject: '',
    body: '',
    due_date: '',
    priority: 'medium',
    status: 'planned',
    auto_trigger: false // The automation trigger integration
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim()) { addToast('Vui lòng nhập tiêu đề hoạt động', 'error'); return; }
    setLoading(true);
    
    try {
      await api.post('/activities', {
        ...formData,
        related_type: entityType,
        related_id: entityId
      });
      
      if (formData.auto_trigger) {
        addToast('Đã kích hoạt tự động hóa Workflow', 'success');
      }
      
      addToast('Đã thêm hoạt động mới', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      addToast('Lỗi khi thêm hoạt động', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="overlay-backdrop" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
        <motion.div 
          className="modal-sheet" 
          style={{ width: '100%', maxWidth: 640, padding: 0 }}
          initial={{ opacity: 0, y: 20, scale: 0.95 }} 
          animate={{ opacity: 1, y: 0, scale: 1 }} 
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>Thêm hoạt động mới</h3>
            <button className="btn-icon-bare" onClick={onClose}><X size={20}/></button>
          </div>
          
          <form onSubmit={handleSubmit} className="modal-body">
            {/* Type selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
              {TYPES.map(t => (
                <button 
                  key={t.id} type="button"
                  onClick={() => setFormData({ ...formData, type: t.id })}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
                    padding: '1.25rem 0', borderRadius: 'var(--radius-xl)', cursor: 'pointer',
                    background: formData.type === t.id ? `${t.color}15` : 'var(--color-surface)',
                    border: `2px solid ${formData.type === t.id ? t.color : 'var(--color-border)'}`,
                    color: formData.type === t.id ? t.color : 'var(--color-text-muted)',
                    fontWeight: formData.type === t.id ? 700 : 500, transition: 'all 0.2s',
                    boxShadow: formData.type === t.id ? `0 8px 16px ${t.color}15` : 'none'
                  }}
                >
                  <div style={{ transform: formData.type === t.id ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s' }}>
                    {t.icon}
                  </div>
                  <span style={{ fontSize: '0.875rem' }}>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">Tiêu đề hoạt động <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input 
                className="form-input" 
                placeholder="VD: Gọi điện chốt sale, Họp demo..." 
                value={formData.subject}
                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                autoFocus
                style={{ fontSize: '1rem', padding: '0.75rem 1rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} /> Thời gian thực hiện
                </label>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  value={formData.due_date}
                  onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mức độ ưu tiên</label>
                <CustomSelect 
                  options={[
                    { value: 'low', label: 'Thấp' },
                    { value: 'medium', label: 'Bình thường' },
                    { value: 'high', label: 'Quan trọng' }
                  ]}
                  value={formData.priority}
                  onChange={val => setFormData({ ...formData, priority: val as string })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Trạng thái</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className={`btn sm ${formData.status === 'planned' ? 'primary' : 'outline'}`} style={{ flex: 1 }} onClick={() => setFormData({...formData, status: 'planned'})}>Kế hoạch</button>
                  <button type="button" className={`btn sm ${formData.status === 'done' ? 'success' : 'outline'}`} style={{ flex: 1, borderColor: formData.status === 'done' ? 'var(--color-success)' : '' }} onClick={() => setFormData({...formData, status: 'done'})}>Đã xong</button>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlignLeft size={14} /> Ghi chú chi tiết
              </label>
              <MentionInput 
                className="form-input" 
                rows={4} 
                placeholder="Nhập nội dung chi tiết của hoạt động (Sử dụng @ để tag user/sale)..."
                value={formData.body}
                onChange={e => setFormData({ ...formData, body: e.target.value })}
                style={{ resize: 'none' }}
              />
            </div>

            {/* Automation Trigger Toggle */}
            <div 
              style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))',
                border: '1px solid var(--color-primary-light)', borderRadius: 'var(--radius-xl)',
                padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', cursor: 'pointer',
                marginTop: '0.5rem'
              }}
              onClick={() => setFormData({ ...formData, auto_trigger: !formData.auto_trigger })}
            >
              <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', boxShadow: 'var(--shadow-sm)' }}>
                <Zap size={24} fill={formData.auto_trigger ? 'var(--color-primary)' : 'none'} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
                  Tích hợp Automation Workflow
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  Hệ thống sẽ tự động gửi Email, cập nhật Lead Score hoặc chuyển trạng thái Deal dựa trên hành động này.
                </p>
              </div>
              <div className={`custom-toggle ${formData.auto_trigger ? 'active' : ''}`} style={{ zoom: 1.2 }}></div>
            </div>
          </form>

          <div className="modal-footer">
            <button type="button" className="btn outline lg" onClick={onClose} disabled={loading}>Hủy bỏ</button>
            <button type="button" className="btn primary lg" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Đang lưu...' : 'Lưu hoạt động'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
