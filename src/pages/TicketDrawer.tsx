import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { X, MessageSquare, Clock, AlertCircle, User, Paperclip, Send, CheckCircle2, MoreHorizontal, Loader2 } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import { createPortal } from 'react-dom';
import { StatRowSkeleton } from '../components/ui/Skeleton';
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
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { addToast } = useUIStore();
  const { user: currentUser } = useAuth();
  const isAdminOrManager = currentUser && ['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes((currentUser.role || '').toLowerCase());

  const formatSlaDate = (dateStr: any) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN');
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [formData, setFormData] = useState<any>({});
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; userName: string } | null>(null);
  const [isInternal, setIsInternal] = useState(false);

  useEffect(() => {
    if (isOpen && comments.length > 0) {
      const highlightCommentId = searchParams.get('highlight_comment_id');
      if (highlightCommentId) {
        setTimeout(() => {
          const element = document.getElementById(`ticket-comment-${highlightCommentId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash highlight the inner bubble
            const bubble = element.querySelector('div > div > div:nth-child(2)') as HTMLElement;
            if (bubble) {
              const originalBg = bubble.style.background;
              bubble.style.backgroundColor = '#fef08a'; // yellow-200
              bubble.style.transition = 'all 0.5s ease';
              setTimeout(() => {
                bubble.style.background = originalBg;
              }, 2500);
            }
            
            // Clean URL parameters
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('highlight_comment_id');
            setSearchParams(newParams, { replace: true });
          }
        }, 300);
      }
    }
  }, [isOpen, comments, searchParams, setSearchParams]);

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

  const [isVisible, setIsVisible] = useState(isOpen);
  const [animateIn, setAnimateIn] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      const timer = setTimeout(() => setAnimateIn(true), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setIsVisible(false), 420);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!ticket) return null;

  const handleSend = async () => {
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const r = await api.post(`/tickets/${ticket.id}/comments`, { 
        body: newComment,
        parent_id: replyTo ? replyTo.id : null
      });
      setComments(r.data.data || []);
      setNewComment('');
      setReplyTo(null);
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

  if (!isVisible) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="drawer-backdrop"
        onClick={onClose}
        style={{
          zIndex: 1000,
          opacity: animateIn ? 1 : 0,
          transition: 'opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: animateIn ? 'auto' : 'none'
        }}
      />
      <div
        className={styles.drawer}
        style={{
          transform: animateIn ? 'translateX(0)' : 'translateX(160px)',
          opacity: animateIn ? 1 : 0,
          transition: 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform, opacity'
        }}
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
                    disabled={!isAdminOrManager}
                  />
                </div>
                <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
              </div>
            </div>

            {/* ── Content Split ── */}
            <div className={styles.drawerBody} style={{ background: 'var(--color-bg)' }}>
              
              {/* Left: Activity Thread */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: isMobile ? 'none' : '1px solid var(--color-border)', borderBottom: isMobile ? '1px dashed var(--color-border)' : 'none' }}>
                <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <StatRowSkeleton />
                      <StatRowSkeleton />
                      <StatRowSkeleton />
                    </div>
                  ) : comments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: '16px', border: '1px dashed var(--color-border)' }}>
                      <MessageSquare size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                      Chưa có ghi chú nào. Hãy bắt đầu thảo luận!
                    </div>
                  ) : (
                    (() => {
                      const rootComments = comments.filter((c: any) => !c.parent_id);
                      const getReplies = (parentId: number) => {
                        return comments
                          .filter((c: any) => Number(c.parent_id) === Number(parentId))
                          .sort((a: any, b: any) => new Date(a.created_at || a.time).getTime() - new Date(b.created_at || b.time).getTime());
                      };

                      const renderSingleComment = (msg: any, isReply: boolean = false) => {
                        const isSelf = currentUser && String(msg.user_id) === String(currentUser.id);
                        return (
                          <div 
                            key={msg.id} 
                            id={`ticket-comment-${msg.id}`}
                            style={{ 
                              display: 'flex', 
                              gap: '1rem', 
                              flexDirection: isSelf ? 'row-reverse' : 'row', 
                              alignSelf: isSelf ? 'flex-end' : 'flex-start',
                              width: '100%',
                              marginTop: isReply ? '4px' : '0'
                            }}
                          >
                            <Avatar name={msg.user_name || msg.user} src={msg.avatar_url} size={isReply ? 24 : 32} />
                            <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexDirection: isSelf ? 'row-reverse' : 'row' }}>
                                <span style={{ fontSize: isReply ? '0.75rem' : '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{msg.user_name || msg.user}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>{(msg.created_at || msg.time) ? new Date(msg.created_at || msg.time).toLocaleString('vi-VN') : ''}</span>
                              </div>
                              <div style={{ 
                                padding: isReply ? '0.625rem 1rem' : '0.875rem 1.25rem', 
                                borderRadius: '16px', 
                                borderTopLeftRadius: isSelf ? '16px' : '4px',
                                borderTopRightRadius: isSelf ? '4px' : '16px',
                                background: isSelf ? 'rgba(201, 24, 43, 0.08)' : (msg.is_internal ? 'var(--color-warning-light)' : 'var(--color-surface)'),
                                border: isSelf ? '1px solid rgba(201, 24, 43, 0.15)' : '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                                fontSize: isReply ? '0.85rem' : '0.9375rem', 
                                lineHeight: 1.5,
                                wordBreak: 'break-word'
                              }}>
                                {msg.body || msg.text}
                              </div>
                              {!isReply && (
                                <button
                                  onClick={() => setReplyTo({ id: msg.id, userName: msg.user_name || msg.user || 'Đồng nghiệp' })}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.7rem', padding: '4px 0 0 0', cursor: 'pointer', fontWeight: 700 }}
                                  className="hover-lift"
                                >
                                  Phản hồi
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      };

                      return rootComments.map((rootComment: any) => {
                        const replies = getReplies(rootComment.id);
                        const isSelfRoot = currentUser && String(rootComment.user_id) === String(currentUser.id);
                        return (
                          <div key={rootComment.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {renderSingleComment(rootComment, false)}
                            {replies.length > 0 && (
                              <div style={{ 
                                marginLeft: isSelfRoot ? '0' : '2.5rem', 
                                marginRight: isSelfRoot ? '2.5rem' : '0', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '8px', 
                                borderLeft: isSelfRoot ? 'none' : '2px solid var(--color-border-light)', 
                                borderRight: isSelfRoot ? '2px solid var(--color-border-light)' : 'none', 
                                paddingLeft: isSelfRoot ? '0' : '12px', 
                                paddingRight: isSelfRoot ? '12px' : '0', 
                                marginTop: '4px' 
                              }}>
                                {replies.map((reply: any) => renderSingleComment(reply, true))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()
                  )}
                </div>

                {/* Reply Box */}
                <div style={{ padding: '1.5rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}>
                  {replyTo && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(201, 24, 43, 0.08)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', color: '#c9182b', fontWeight: 700, marginBottom: '8px' }}>
                      <span>Đang trả lời {replyTo.userName}</span>
                      <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', color: '#c9182b', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', padding: '0 4px' }}>×</button>
                    </div>
                  )}
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
              <div style={{ width: isMobile ? '100%' : '320px', background: 'var(--color-surface)', padding: '1.5rem', overflow: 'auto' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '1rem' }}>Thông tin Ticket</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                  {isAdminOrManager ? (
                    <>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Người phụ trách</p>
                        <CustomSelect
                          options={(users || []).map(u => ({ value: String(u.id), label: u.full_name }))}
                          value={String(formData.assignee_id || '')}
                          onChange={val => {
                            const uid = val ? Number(val) : null;
                            const matchedUser = (users || []).find(u => Number(u.id) === uid);
                            const updated = { ...formData, assignee_id: uid, assignee_name: matchedUser ? matchedUser.full_name : '' };
                            setFormData(updated);
                            onUpdate?.(updated);
                            addToast('Đã chuyển giao ticket thành công', 'success');
                          }}
                          placeholder="-- Chọn người phụ trách --"
                        />
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Độ ưu tiên</p>
                        <CustomSelect
                          options={PRIORITIES.map(p => ({ value: p.id, label: p.label }))}
                          value={formData.priority}
                          onChange={val => {
                            const updated = { ...formData, priority: val as string };
                            setFormData(updated);
                            onUpdate?.(updated);
                            addToast('Đã cập nhật độ ưu tiên', 'success');
                          }}
                        />
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Thời hạn (SLA)</p>
                        <input
                          type="date"
                          className="form-input"
                          style={{ height: '38px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px' }}
                          value={formData.due_date ? formData.due_date.substring(0, 10) : ''}
                          onChange={e => {
                            const val = e.target.value;
                            const updated = { ...formData, due_date: val ? `${val} 23:59:59` : null };
                            setFormData(updated);
                            onUpdate?.(updated);
                            addToast('Đã cập nhật thời hạn xử lý', 'success');
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Người phụ trách</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar name={formData.assignee_name} src={formData.assignee_avatar} size={24} />
                          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{formData.assignee_name || 'Admin'}</span>
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Thời hạn (SLA)</p>
                        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14}/> {formatSlaDate(formData.due_date)}</p>
                      </div>
                    </>
                  )}
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
      </div>
    </>,
    document.body
  );
};
