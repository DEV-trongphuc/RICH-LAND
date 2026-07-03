import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Clock, AlertCircle, User, Paperclip, Send, CheckCircle2, MoreHorizontal, Loader2 } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useUIStore } from '../store/uiStore';
import api from '../api/axios';
import { createPortal } from 'react-dom';
import styles from './EntityDrawer.module.css'; 

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticket: any;
  onUpdate?: (data: any) => void;
  contacts?: any[];
  users?: any[];
}

const TICKET_STATUSES = [
  { id: 'open', label: 'Mới mở', color: '#3b82f6' },
  { id: 'in_progress', label: 'Đang xử lý', color: '#f59e0b' },
  { id: 'waiting', label: 'Chờ phản hồi', color: '#BD1D2D' },
  { id: 'resolved', label: 'Đã giải quyết', color: '#10b981' },
  { id: 'closed', label: 'Đã đóng', color: '#6b7280' },
];

const PRIORITIES = [
  { id: 'low', label: 'Thấp', color: '#10b981' },
  { id: 'medium', label: 'Trung bình', color: '#3b82f6' },
  { id: 'high', label: 'Cao', color: '#f59e0b' },
  { id: 'urgent', label: 'Khẩn cấp', color: '#ef4444' },
];

export const TicketDrawer: React.FC<Props> = ({ isOpen, onClose, ticket, onUpdate, contacts = [], users = [] }) => {
  const { addToast } = useUIStore();
  const [formData, setFormData] = useState<any>({});
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComments = async () => {
    if (!ticket?.id) return;
    setLoading(true);
    try {
      const r = await api.get(`/tickets/${ticket.id}/comments`);
      setComments(r.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch ticket comments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticket?.id) {
      setFormData(ticket);
      fetchComments();
    }
  }, [ticket]);

  if (!ticket) return null;

  const handleSend = async () => {
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const r = await api.post(`/tickets/${ticket.id}/comments`, { body: newComment });
      setComments(r.data.data || []);
      setNewComment('');
      addToast('Đã thêm ghi chú', 'success');
    } catch (err: any) {
      addToast('Lỗi khi lưu ghi chú', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    const oldStatus = formData.status;
    setFormData((prev: any) => ({ ...prev, status: newStatus }));
    onUpdate?.({ ...formData, status: newStatus });
    
    addToast('Đã cập nhật trạng thái', 'success', {
      label: 'Undo',
      onClick: () => {
        setFormData((prev: any) => ({ ...prev, status: oldStatus }));
        onUpdate?.({ ...formData, status: oldStatus });
      }
    });
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
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
            className={styles.drawer}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
          >
            {/* ── Header ── */}
            <div className={styles.header}>
              <div className={styles.headerProfile}>
                <div className="avatar-placeholder lg" style={{ background: PRIORITIES.find(p => p.id === formData.priority)?.color || 'var(--color-primary)' }}>
                  <AlertCircle size={24} color="white" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-light)' }}>#{formData.id}</span>
                    <span className="badge" style={{ background: PRIORITIES.find(p => p.id === formData.priority)?.color + '20', color: PRIORITIES.find(p => p.id === formData.priority)?.color }}>
                      {PRIORITIES.find(p => p.id === formData.priority)?.label}
                    </span>
                  </div>
                  <h2 className={styles.title} style={{ fontSize: '1.25rem' }}>{formData.subject}</h2>
                  <p className={styles.subtitle} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <User size={14} /> {formData.customer_name} • Mở lúc: {formData.created_at ? new Date(formData.created_at).toLocaleString('vi-VN') : '—'}
                  </p>
                </div>
              </div>
              <div className={styles.headerActions}>
                <div style={{ width: 140 }}>
                  <CustomSelect 
                    options={TICKET_STATUSES.map(s => ({ value: s.id, label: s.label }))} 
                    value={formData.status} 
                    onChange={val => handleStatusChange(val.toString())} 
                  />
                </div>
                <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
              </div>
            </div>

            {/* ── Content Split ── */}
            <div className={styles.drawerBody} style={{ background: 'var(--color-bg)' }}>
              
              {/* Left: Activity Thread */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>Đang tải ghi chú...</div>
                  ) : comments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: '16px', border: '1px dashed var(--color-border)' }}>
                      <MessageSquare size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                      Chưa có ghi chú nào. Hãy bắt đầu thảo luận!
                    </div>
                  ) : (
                    comments.map((msg, i) => (
                      <div key={msg.id || i} style={{ display: 'flex', gap: '1rem', flexDirection: 'row' }}>
                        <Avatar name={msg.user_name || msg.user} src={msg.avatar_url} size={32} />
                        <div style={{ maxWidth: '85%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{msg.user_name || msg.user}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{(msg.created_at || msg.time) ? new Date(msg.created_at || msg.time).toLocaleString('vi-VN') : ''}</span>
                          </div>
                          <div style={{ 
                            padding: '0.875rem 1.25rem', 
                            borderRadius: '16px', 
                            background: msg.is_internal ? 'var(--color-warning-light)' : 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                            fontSize: '0.9375rem', lineHeight: 1.5,
                            borderTopLeftRadius: '4px'
                          }}>
                            {msg.body || msg.text}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Reply Box */}
                <div style={{ padding: '1.5rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ position: 'relative' }}>
                    <textarea 
                      className="form-input" 
                      placeholder="Thêm ghi chú, cập nhật tiến độ xử lý..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      style={{ minHeight: '100px', paddingBottom: '3rem', resize: 'none' }}
                    />
                    <div style={{ position: 'absolute', bottom: '12px', left: '12px', display: 'flex', gap: '8px' }}>
                      <button className="btn-icon sm"><Paperclip size={16} /></button>
                    </div>
                    <button 
                      className="btn primary sm"
                      style={{ position: 'absolute', bottom: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleSend}
                      disabled={isSubmitting || !newComment.trim()}
                    >
                      {isSubmitting ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                      {isSubmitting ? 'Đang cập nhật' : 'Cập nhật'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Info Panel */}
              <div style={{ width: '320px', background: 'var(--color-surface)', padding: '1.5rem', overflow: 'auto' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '1rem' }}>Thông tin Ticket</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Người phụ trách</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Avatar name={formData.assignee_name} size={24} />
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{formData.assignee_name || 'Admin'}</span>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Thời hạn (SLA)</p>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14}/> {new Date(formData.due_date).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>

                <h4 style={{ fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '1rem' }}>Thông tin khách hàng</h4>
                <div className="card" style={{ padding: '1rem', background: 'var(--color-bg)', border: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
                    <Avatar name={formData.customer_name} size={40} />
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{formData.customer_name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Khách hàng chính</p>
                    </div>
                  </div>
                </div>

                {formData.related_contacts?.length > 0 && (
                  <>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginTop: '1.5rem', marginBottom: '1rem' }}>Khách hàng liên quan</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {formData.related_contacts.map((cid: any) => {
                        const c = (contacts || []).find(x => String(x.id) === String(cid));
                        if (!c) return null;
                        return (
                          <div key={cid} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Avatar src={c.avatar_url} name={`${c.first_name} ${c.last_name}`} size={28} />
                            <div style={{ fontSize: '0.8125rem' }}>
                              <p style={{ fontWeight: 600 }}>{c.first_name} {c.last_name}</p>
                              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{c.phone}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {formData.related_users?.length > 0 && (
                  <>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginTop: '1.5rem', marginBottom: '1rem' }}>Nhân viên liên quan</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {formData.related_users.map((uid: any) => {
                        const u = (users || []).find(x => String(x.id) === String(uid));
                        if (!u) return null;
                        return (
                          <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Avatar src={u.avatar_url} name={u.full_name} size={28} />
                            <div style={{ fontSize: '0.8125rem' }}>
                              <p style={{ fontWeight: 600 }}>{u.full_name}</p>
                              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{u.role}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
