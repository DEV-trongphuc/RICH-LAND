import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, AlignLeft, Phone, Mail, Users, CheckSquare, Zap, PhoneOutgoing, PhoneIncoming } from 'lucide-react';
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
  userId?: number;
  activity?: any; // If passed, we are in edit mode
  onSwitchToTask?: () => void;
}

const TYPES = [
  { id: 'call', label: 'Cuộc gọi', icon: <Phone size={16} />, color: 'var(--color-primary)' },
  { id: 'email', label: 'Email', icon: <Mail size={16} />, color: '#10b981' },
  { id: 'meeting', label: 'Cuộc họp', icon: <Users size={16} />, color: '#f59e0b' },
  { id: 'task', label: 'Công việc', icon: <CheckSquare size={16} />, color: '#BD1D2D' },
  { id: 'note', label: 'Ghi chú', icon: <AlignLeft size={16} />, color: '#f59e0b' }
];

export const ActivityModal: React.FC<ActivityModalProps> = ({ isOpen, onClose, entityType, entityId, onSuccess, userId, activity, onSwitchToTask }) => {
  const { addToast } = useUIStore();
  const [formData, setFormData] = useState({
    type: 'call',
    subject: '',
    body: '',
    due_date: '',
    priority: 'medium',
    status: 'planned',
    auto_trigger: false,
    
    // Call-specific properties
    call_direction: 'outbound' as 'outbound' | 'inbound',
    call_outcome: 'reached' as 'reached' | 'no_answer' | 'voicemail' | 'busy' | 'wrong_number',
    call_duration: 5
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const defaultDate = new Date();
      // Adjust timezone offset to get local YYYY-MM-DDTHH:mm
      const tzOffset = defaultDate.getTimezoneOffset() * 60000;
      const localISOTime = new Date(defaultDate.getTime() - tzOffset).toISOString().slice(0, 16);

      setFormData({
        type: activity?.type || 'call',
        subject: activity?.subject || '',
        body: activity?.body || '',
        due_date: activity?.due_date ? new Date(activity.due_date).toISOString().slice(0, 16) : localISOTime,
        priority: activity?.priority || 'medium',
        status: activity?.status || (activity?.type === 'call' ? 'done' : 'planned'),
        auto_trigger: false,
        call_direction: 'outbound',
        call_outcome: 'reached',
        call_duration: 5
      });
    }
  }, [isOpen, activity]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let subject = formData.subject;
    let body = formData.body;
    let status = formData.status;

    if (formData.type === 'call') {
      const directionLabel = formData.call_direction === 'outbound' ? 'đi' : 'đến';
      const outcomeLabel = formData.call_outcome === 'reached' ? 'Đã kết nối' :
                           formData.call_outcome === 'no_answer' ? 'Không nghe máy' :
                           formData.call_outcome === 'busy' ? 'Máy bận' :
                           formData.call_outcome === 'voicemail' ? 'Hộp thư thoại' : 'Sai số';
      subject = `Cuộc gọi ${directionLabel}: ${outcomeLabel}`;
      status = 'done';

      if (formData.call_outcome === 'reached') {
        body = `[Thời lượng: ${formData.call_duration} phút]\n${body}`;
      }
    } else {
      if (!subject.trim()) { addToast('Vui lòng nhập tiêu đề hoạt động', 'error'); return; }
    }

    setLoading(true);
    
    try {
      const formattedDate = formData.due_date ? formData.due_date.replace('T', ' ') : null;
      if (activity?.id) {
        await api.put(`/activities/${activity.id}`, {
          ...formData,
          due_date: formattedDate,
          subject,
          body,
          status
        });
        addToast('Đã cập nhật hoạt động thành công', 'success');
      } else {
        await api.post('/activities', {
          ...formData,
          due_date: formattedDate,
          subject,
          body,
          status,
          related_type: entityType,
          related_id: entityId,
          user_id: userId
        });
        if (formData.auto_trigger) {
          addToast('Đã kích hoạt tự động hóa Workflow', 'success');
        }
        addToast('Đã thêm hoạt động mới', 'success');
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      addToast(activity?.id ? 'Lỗi khi cập nhật hoạt động' : 'Lỗi khi thêm hoạt động', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="overlay-backdrop" style={{ zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
        <motion.div 
          className="modal-sheet" 
          style={{ width: '100%', maxWidth: 640, padding: 0 }}
          initial={{ opacity: 0, y: 20, scale: 0.95 }} 
          animate={{ opacity: 1, y: 0, scale: 1 }} 
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>{activity?.id ? 'Cập nhật hoạt động' : 'Thêm hoạt động mới'}</h3>
            <button className="btn-icon-bare" onClick={onClose}><X size={20}/></button>
          </div>
          
          <form onSubmit={handleSubmit} className="modal-body">
            {/* Type selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
              {TYPES.map(t => (
                <button 
                  key={t.id} type="button"
                  onClick={() => {
                    if (t.id === 'task') {
                      if (onSwitchToTask) {
                        onClose();
                        onSwitchToTask();
                      }
                      return;
                    }
                    setFormData({ ...formData, type: t.id, status: t.id === 'call' ? 'done' : 'planned' });
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem',
                    padding: '12px 0', borderRadius: '12px', cursor: 'pointer',
                    background: formData.type === t.id ? `${t.color}15` : 'var(--color-bg-alt)',
                    border: formData.type === t.id ? `1.5px solid ${t.color}` : '1px solid var(--color-border)',
                    color: formData.type === t.id ? t.color : 'var(--color-text-muted)',
                    fontWeight: formData.type === t.id ? 700 : 500, transition: 'all 0.2s',
                    boxShadow: formData.type === t.id ? `0 4px 12px ${t.color}12` : 'none',
                    outline: 'none'
                  }}
                >
                  <div style={{ transform: formData.type === t.id ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.2s' }}>
                    {t.icon}
                  </div>
                  <span style={{ fontSize: '0.8125rem' }}>{t.label}</span>
                </button>
              ))}
            </div>

            {formData.type === 'call' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
                {/* Loại cuộc gọi */}
                <div>
                  <label className="form-label">Loại cuộc gọi</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, call_direction: 'outbound' })}
                      className={`btn sm ${formData.call_direction === 'outbound' ? 'primary' : 'outline'}`}
                      style={{ flex: 1, height: 38, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <PhoneOutgoing size={15} /> Gọi đi
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, call_direction: 'inbound' })}
                      className={`btn sm ${formData.call_direction === 'inbound' ? 'primary' : 'outline'}`}
                      style={{ flex: 1, height: 38, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <PhoneIncoming size={15} /> Gọi đến
                    </button>
                  </div>
                </div>

                {/* Kết quả cuộc gọi */}
                <div>
                  <label className="form-label">Kết quả cuộc gọi</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
                    {[
                      { value: 'reached', label: 'Đã kết nối', color: '#10b981' },
                      { value: 'no_answer', label: 'Không nghe máy', color: '#f59e0b' },
                      { value: 'voicemail', label: 'Hộp thư thoại', color: '#BD1D2D' },
                      { value: 'busy', label: 'Máy bận', color: '#ef4444' },
                      { value: 'wrong_number', label: 'Sai số', color: '#6b7280' }
                    ].map(out => (
                      <button
                        key={out.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, call_outcome: out.value as any })}
                        className="btn sm"
                        style={{
                          height: 36,
                          border: `1px solid ${formData.call_outcome === out.value ? out.color : 'var(--color-border)'}`,
                          background: formData.call_outcome === out.value ? `${out.color}15` : 'var(--color-surface)',
                          color: formData.call_outcome === out.value ? out.color : 'var(--color-text)',
                          fontWeight: formData.call_outcome === out.value ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {out.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Thời lượng - Only show if Đã kết nối (reached) */}
                {formData.call_outcome === 'reached' && (
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ margin: 0 }}>Thời lượng: <strong style={{ color: 'var(--color-primary)' }}>{formData.call_duration} phút</strong></label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[3, 5, 10, 20].map(mins => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setFormData({ ...formData, call_duration: mins })}
                            className="btn sm outline"
                            style={{ padding: '2px 8px', fontSize: '0.75rem', height: 24, cursor: 'pointer' }}
                          >
                            {mins}p
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="120"
                      value={formData.call_duration}
                      onChange={e => setFormData({ ...formData, call_duration: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      <span>1 phút</span>
                      <span>30 phút</span>
                      <span>60 phút</span>
                      <span>120 phút</span>
                    </div>
                  </div>
                )}

                {/* Thời gian thực hiện */}
                <div className="form-group" style={{ margin: 0 }}>
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
              </div>
            ) : (
              <>
                <div className="form-group" style={{ marginTop: '1.25rem' }}>
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
                    <div style={{ 
                      display: 'flex', 
                      background: 'rgba(100, 116, 139, 0.08)', 
                      borderRadius: '30px', 
                      padding: '3px', 
                      border: '1px solid var(--color-border-light)',
                      height: 42,
                      alignItems: 'center'
                    }}>
                      <button 
                        type="button" 
                        style={{ 
                          flex: 1, 
                          height: '100%',
                          border: 'none', 
                          borderRadius: '30px', 
                          padding: '4px 12px', 
                          fontSize: '0.8125rem', 
                          fontWeight: formData.status === 'planned' ? 700 : 500, 
                          cursor: 'pointer', 
                          transition: 'all 0.2s',
                          background: formData.status === 'planned' ? 'var(--color-surface)' : 'transparent',
                          color: formData.status === 'planned' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          boxShadow: formData.status === 'planned' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                          outline: 'none'
                        }} 
                        onClick={() => setFormData({...formData, status: 'planned'})}
                      >
                        Kế hoạch
                      </button>
                      <button 
                        type="button" 
                        style={{ 
                          flex: 1, 
                          height: '100%',
                          border: 'none', 
                          borderRadius: '30px', 
                          padding: '4px 12px', 
                          fontSize: '0.8125rem', 
                          fontWeight: formData.status === 'done' ? 700 : 500, 
                          cursor: 'pointer', 
                          transition: 'all 0.2s',
                          background: formData.status === 'done' ? 'var(--color-success)' : 'transparent',
                          color: formData.status === 'done' ? 'white' : 'var(--color-text-muted)',
                          boxShadow: formData.status === 'done' ? '0 2px 6px rgba(16, 185, 129, 0.2)' : 'none',
                          outline: 'none'
                        }} 
                        onClick={() => setFormData({...formData, status: 'done'})}
                      >
                        Đã xong
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="form-group" style={{ marginTop: '1.25rem' }}>
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
                background: 'linear-gradient(135deg, rgba(189, 29, 45, 0.08), rgba(189, 29, 45, 0.08))',
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
