import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { 
  X, MessageSquare, Clock, AlertCircle, User, Paperclip, Send, CheckCircle2, 
  XCircle, Inbox, Image as ImageIcon, FileText, ExternalLink, Loader2, Lock, Eye, Calendar
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
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
  onOpenContact?: (contact: any) => void;
}

const PRIORITIES = [
  { id: 'low', label: 'Thấp', color: '#10b981' },
  { id: 'medium', label: 'Trung bình', color: '#3b82f6' },
  { id: 'high', label: 'Cao', color: '#f59e0b' },
  { id: 'urgent', label: 'Khẩn cấp', color: '#ef4444' },
];

export const TicketDrawer: React.FC<Props> = ({ isOpen, onClose, ticket, onUpdate, contacts = [], users = [], onOpenContact }) => {
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
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prevTicketId, setPrevTicketId] = useState<number | null>(null);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (isOpen && ticket?.id && ticket.id !== prevTicketId && !loading) {
    setLoading(true);
  }

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
      setPrevTicketId(ticket.id);
      fetchComments();
    }
  }, [ticket]);

  useEffect(() => {
    if (isOpen && comments.length > 0) {
      const highlightCommentId = searchParams.get('highlight_comment_id');
      if (highlightCommentId) {
        setTimeout(() => {
          const element = document.getElementById(`ticket-comment-${highlightCommentId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const bubble = element.querySelector('div > div > div:nth-child(2)') as HTMLElement;
            if (bubble) {
              const originalBg = bubble.style.background;
              bubble.style.backgroundColor = '#fef08a';
              bubble.style.transition = 'all 0.5s ease';
              setTimeout(() => {
                bubble.style.background = originalBg;
              }, 2500);
            }
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

  const handleAcceptTicket = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updated = { ...formData, status: 'in_progress' };
      await api.put(`/tickets/${ticket.id}`, { status: 'in_progress' });
      setFormData(updated);
      onUpdate?.(updated);
      addToast('Đã tiếp nhận ticket và gửi thông báo cho người tạo', 'success');
    } catch (err: any) {
      addToast('Lỗi khi tiếp nhận ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveTicket = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updated = { ...formData, status: 'closed', resolution_status: 'resolved' };
      await api.put(`/tickets/${ticket.id}`, { status: 'closed', resolution_status: 'resolved' });
      setFormData(updated);
      onUpdate?.(updated);
      addToast('Đã hoàn thành và đóng ticket', 'success');
    } catch (err: any) {
      addToast('Lỗi khi đóng ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectTicket = async () => {
    if (!rejectReason.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updated = { ...formData, status: 'closed', resolution_status: 'rejected', rejection_reason: rejectReason };
      await api.put(`/tickets/${ticket.id}`, { status: 'closed', resolution_status: 'rejected', rejection_reason: rejectReason });
      
      await api.post(`/tickets/${ticket.id}/comments`, { 
        body: `[Từ chối Hỗ trợ]: ${rejectReason}`
      });
      
      fetchComments();
      setFormData(updated);
      onUpdate?.(updated);
      setShowRejectModal(false);
      setRejectReason('');
      addToast('Đã từ chối và đóng ticket', 'success');
    } catch (err: any) {
      addToast('Lỗi khi từ chối ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAttachedImages = (data: any) => {
    const list: { label: string; url: string }[] = [];
    if (!data) return list;
    
    const text = (data.description || '') + ' ' + (typeof data.attachments === 'string' ? data.attachments : JSON.stringify(data.attachments || []));
    
    const mdImgRegex = /!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g;
    let m;
    while ((m = mdImgRegex.exec(text)) !== null) {
      list.push({ label: m[1] || 'Ảnh đính kèm', url: m[2] });
    }

    const mdLinkRegex = /\[(.*?)\]\((https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|gif|webp|svg)[^\s)]*)\)/gi;
    while ((m = mdLinkRegex.exec(text)) !== null) {
      if (!list.some(item => item.url === m![2])) {
        list.push({ label: m[1] || 'Ảnh đính kèm', url: m[2] });
      }
    }

    const rawUrlRegex = /(https?:\/\/[^\s<"']+(?:\/uploads\/|\.(?:png|jpg|jpeg|gif|webp|svg))[^\s<"']*)/gi;
    while ((m = rawUrlRegex.exec(text)) !== null) {
      if (!list.some(item => item.url === m![1])) {
        list.push({ label: 'Ảnh đính kèm', url: m[1] });
      }
    }

    return list;
  };

  if (!isVisible) return null;
  if (typeof document === 'undefined') return null;

  const attachedImages = getAttachedImages(formData);
  const matchedAssignee = (users || []).find(u => Number(u.id) === Number(formData.assignee_id));
  const assigneeName = formData.assignee_name || matchedAssignee?.full_name || 'Hệ thống / Admin';
  const assigneeAvatar = formData.assignee_avatar || matchedAssignee?.avatar_url;

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
          transform: animateIn ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform'
        }}
      >
        {/* Modern Dark Glass Header Banner */}
        <div style={{
          padding: isMobile ? '1rem' : '1.25rem 1.75rem',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, minWidth: 0 }}>
            {/* Priority Squircle Icon */}
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '16px',
              background: formData.priority === 'urgent' 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : formData.priority === 'high' 
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                : formData.priority === 'low'
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              flexShrink: 0
            }}>
              <AlertCircle size={24} />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              {/* Badges row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '0.725rem',
                  fontWeight: 800,
                  color: '#94a3b8',
                  background: 'rgba(255,255,255,0.08)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.12)'
                }}>
                  #{formData.id}
                </span>

                <span style={{
                  background: PRIORITIES.find(p => p.id === formData.priority)?.color ? `${PRIORITIES.find(p => p.id === formData.priority)?.color}30` : 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.725rem',
                  padding: '2px 9px',
                  borderRadius: '6px',
                  border: `1px solid ${PRIORITIES.find(p => p.id === formData.priority)?.color || '#3b82f6'}60`
                }}>
                  {PRIORITIES.find(p => p.id === formData.priority)?.label || 'Trung bình'}
                </span>

                {/* Status Badge */}
                {formData.status === 'open' || formData.status === 'new' || !formData.status ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 9px', borderRadius: '6px', fontWeight: 700, fontSize: '0.725rem', background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                    <Inbox size={12} /> Mới tạo
                  </span>
                ) : formData.status === 'in_progress' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 9px', borderRadius: '6px', fontWeight: 700, fontSize: '0.725rem', background: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                    <Clock size={12} /> Đã tiếp nhận
                  </span>
                ) : formData.resolution_status === 'rejected' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 9px', borderRadius: '6px', fontWeight: 700, fontSize: '0.725rem', background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                    <XCircle size={12} /> Từ chối
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 9px', borderRadius: '6px', fontWeight: 700, fontSize: '0.725rem', background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                    <CheckCircle2 size={12} /> Đã hoàn thành
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                {formData.subject}
              </h2>

              {/* Meta row */}
              <p style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.775rem', color: '#cbd5e1', margin: 0, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 650, color: '#f8fafc' }}>
                  <User size={13} style={{ color: '#38bdf8' }} /> {formData.created_by_name || formData.customer_name || 'Người gửi'}
                </span>
                <span style={{ color: '#64748b' }}>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                  <Clock size={12} /> Mở lúc: {formData.created_at ? new Date(formData.created_at).toLocaleString('vi-VN') : '—'}
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
            {/* Operational Action Buttons */}
            {isAdminOrManager && (
              <>
                {(formData.status === 'open' || formData.status === 'new' || !formData.status) && (
                  <button 
                    type="button"
                    className="btn primary sm"
                    onClick={handleAcceptTicket}
                    disabled={isSubmitting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, borderRadius: '8px', padding: '7px 14px' }}
                  >
                    {isSubmitting ? <Loader2 size={14} className="spin" /> : <Inbox size={14} />}
                    Tiếp nhận Ticket
                  </button>
                )}

                {formData.status === 'in_progress' && (
                  <>
                    <button 
                      type="button"
                      className="btn success sm"
                      onClick={handleResolveTicket}
                      disabled={isSubmitting}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#10b981', color: '#fff', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '7px 14px' }}
                    >
                      {isSubmitting ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                      Hoàn thành & Đóng
                    </button>
                    <button 
                      type="button"
                      className="btn danger sm outline"
                      onClick={() => setShowRejectModal(true)}
                      disabled={isSubmitting}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, borderRadius: '8px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                    >
                      <XCircle size={14} />
                      Từ chối & Đóng
                    </button>
                  </>
                )}
              </>
            )}

            <button 
              onClick={onClose} 
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Split */}
        <div className={styles.drawerBody} style={{ background: 'var(--color-bg)' }}>
          
          {/* Left: Content & Activity Thread */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: isMobile ? 'none' : '1px solid var(--color-border)', borderBottom: isMobile ? '1px dashed var(--color-border)' : 'none' }}>
            <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '0.75rem 0.5rem 100px 0.5rem' : '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Ticket Initial Description & Attached Media Card */}
              <div style={{ background: 'var(--color-surface)', borderRadius: '14px', padding: '1.25rem', border: '1px solid var(--color-border-light)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={15} style={{ color: 'var(--color-primary)' }} /> Nội dung yêu cầu hỗ trợ
                </h4>
                <div style={{ fontSize: '0.925rem', color: 'var(--color-text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {formData.description ? formData.description.replace(/!\[.*?\]\(.*?\)/g, '').trim() || formData.description : 'Không có mô tả chi tiết.'}
                </div>

                {attachedImages.length > 0 && (
                  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--color-border-light)' }}>
                    <p style={{ fontSize: '0.775rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ImageIcon size={14} style={{ color: 'var(--color-primary)' }} /> Hình ảnh / Tài liệu đính kèm ({attachedImages.length}):
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                      {attachedImages.map((img, idx) => (
                        <div 
                          key={idx}
                          onClick={() => setPreviewImage(img.url)}
                          style={{
                            position: 'relative',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid var(--color-border)',
                            aspectRatio: '1',
                            cursor: 'pointer',
                            background: 'var(--color-bg)'
                          }}
                          className="hover-lift"
                        >
                          <img src={img.url} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', color: 'white', padding: '3px 4px', fontSize: '0.65rem', textAlign: 'center', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                            {img.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Comments Thread */}
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={15} style={{ color: 'var(--color-primary)' }} /> Nhật ký trao đổi ({comments.length})
              </h4>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                </div>
              ) : comments.length === 0 ? (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '2.5rem', 
                  color: 'var(--color-text-muted)', 
                  background: 'var(--color-surface)', 
                  borderRadius: '16px', 
                  border: '1px dashed var(--color-border)' 
                }}>
                  <MessageSquare size={32} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
                  <span style={{ fontSize: '0.875rem' }}>Chưa có ghi chú nào. Hãy bắt đầu thảo luận!</span>
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
            {formData.status === 'closed' ? (
              <div style={{ padding: '1.25rem', background: 'var(--color-bg-light)', borderTop: '1px solid var(--color-border)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>
                <Lock size={16} style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle', color: 'var(--color-text-muted)' }} />
                Ticket đã đóng, không thể thêm phản hồi hoặc cập nhật.
              </div>
            ) : (
              <div style={{ padding: '1.25rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}>
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
                    style={{ minHeight: '90px', paddingBottom: '3rem', resize: 'none' }}
                  />
                  <div style={{ position: 'absolute', bottom: '12px', left: '12px', display: 'flex', gap: '8px' }}>
                    <button className="btn-icon sm" type="button"><Paperclip size={16} /></button>
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
            )}
          </div>

          {/* Right: Info Panel */}
          <div style={{ width: isMobile ? '100%' : '320px', background: 'var(--color-surface)', padding: isMobile ? '0.75rem 0.5rem 100px 0.5rem' : '1.5rem', overflow: 'auto' }}>
            
            {/* Assignee Card (Read-only) */}
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '0.75rem' }}>Người phụ trách</h4>
            <div className="card" style={{ padding: '0.875rem 1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Avatar name={assigneeName} src={assigneeAvatar} size={38} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)', margin: 0 }}>{assigneeName}</p>
                  <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: 0 }}>Phụ trách xử lý Ticket</p>
                </div>
              </div>
            </div>

            {/* SLA Date */}
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '0.75rem' }}>Thời hạn xử lý (SLA)</h4>
            <div className="card" style={{ padding: '0.75rem 1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Clock size={15}/> {formatSlaDate(formData.due_date)}
              </p>
            </div>

            {/* Customer Info Card (Clickable only if CRM contact profile exists) */}
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: '0.75rem' }}>THÔNG TIN KHÁCH HÀNG</h4>
            {(() => {
              const cid = formData.contact_id || formData.customer_id || (formData.related_contacts && formData.related_contacts.length > 0 ? formData.related_contacts[0] : null);
              const matchedContact = cid 
                ? (contacts || []).find((x: any) => String(x.id) === String(cid))
                : (contacts || []).find((x: any) => {
                    const fullName = `${x.last_name || ''} ${x.first_name || ''}`.trim() || x.name;
                    return fullName && formData.customer_name && fullName.toLowerCase() === formData.customer_name.toLowerCase();
                  });

              const targetContact = matchedContact || (cid ? { id: Number(cid), name: formData.customer_name || 'Khách hàng' } : null);
              const hasLink = !!targetContact;

              return (
                <div 
                  onClick={() => {
                    if (hasLink) {
                      onOpenContact?.(targetContact);
                    }
                  }}
                  className={`card ${hasLink ? 'hover-lift' : ''}`}
                  style={{ 
                    padding: '1rem', 
                    background: 'var(--color-surface)', 
                    border: '1px solid var(--color-border-light)', 
                    borderRadius: '14px',
                    cursor: hasLink ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Avatar name={formData.customer_name || 'Khách hàng'} size={42} />
                      <div>
                        <p style={{ fontWeight: 750, fontSize: '0.9rem', color: 'var(--color-text)', margin: 0 }}>{formData.customer_name || 'Chưa cập nhật'}</p>
                        <p style={{ fontSize: '0.75rem', margin: 0, marginTop: '2px' }}>
                          {hasLink ? (
                            <span style={{ color: 'var(--color-text-muted)' }}>Khách hàng liên quan</span>
                          ) : (
                            <span style={{ color: 'var(--color-warning)', fontWeight: 650 }}>Chưa liên kết hồ sơ CRM</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {hasLink ? (
                      <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                        <ExternalLink size={16} />
                      </div>
                    ) : (
                      <span className="badge warning sm" style={{ fontSize: '0.6875rem', fontWeight: 650, padding: '2px 8px', borderRadius: '6px' }}>
                        Tự nhập
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {formData.related_contacts?.length > 0 && (
              <>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-light)', marginTop: '1.5rem', marginBottom: '0.75rem' }}>Khách hàng liên quan khác</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {formData.related_contacts.map((cid: any) => {
                    const c = (contacts || []).find(x => String(x.id) === String(cid));
                    if (!c) return null;
                    return (
                      <div 
                        key={cid} 
                        onClick={() => onOpenContact?.(c)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', background: 'var(--color-bg)' }}
                        className="hover-lift"
                      >
                        <Avatar src={c.avatar_url} name={`${c.last_name} ${c.first_name}`} size={28} />
                        <div style={{ fontSize: '0.8125rem' }}>
                          <p style={{ fontWeight: 600, margin: 0 }}>{c.last_name} {c.first_name}</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>{c.phone}</p>
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

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--color-surface)', width: '100%', maxWidth: '440px', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Từ chối & Đóng Ticket</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Vui lòng nhập lý do từ chối hỗ trợ ticket này. Lý do sẽ được thông báo trực tiếp cho người tạo ticket.
            </p>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Nhập lý do từ chối hỗ trợ..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ width: '100%', resize: 'none', marginBottom: '1.25rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn outline sm" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>Hủy bỏ</button>
              <button 
                className="btn danger sm" 
                onClick={handleRejectTicket} 
                disabled={isSubmitting || !rejectReason.trim()}
              >
                {isSubmitting ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />}
                Xác nhận Từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', cursor: 'pointer' }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <a href={previewImage} target="_blank" rel="noopener noreferrer" style={{ color: 'white', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ExternalLink size={14} /> Mở ảnh trong tab mới
              </a>
              <button className="btn outline sm" onClick={() => setPreviewImage(null)} style={{ color: 'white', borderColor: 'white' }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};
