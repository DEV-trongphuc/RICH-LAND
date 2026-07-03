import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Users, Phone, Mail, MapPin, Briefcase, Plus, Send, History, CheckSquare, DollarSign, HelpCircle, FileText, ShoppingCart, Tag as TagIcon, Target, Pencil, Trash2, LifeBuoy, AlertCircle, Clock, UserCheck, Activity, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Check, Camera, Loader2, MessageSquare, PenTool, Lightbulb, Upload, Paperclip } from 'lucide-react';
import { LeadScoreRing } from '../components/ui/LeadScoreRing';
import { TagInput } from '../components/ui/TagInput';
import { CallLoggerModal } from '../components/ui/CallLoggerModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { AddressSelect } from '../components/ui/AddressSelect';
import { PhoneLink } from '../components/ui/PhoneLink';
import { ActivityModal } from '../components/ui/ActivityModal';
import { MentionInput } from '../components/ui/MentionInput';
import { CreateExpenseModal } from '../components/ui/CreateExpenseModal';
import { QuoteEditorModal } from '../components/ui/QuoteEditorModal';
import { Avatar } from '../components/ui/Avatar';
import { compressToWebP } from '../utils/imageCompress';
import { TicketDrawer } from './TicketDrawer';
import { EmptyCard } from '../components/ui/EmptyCard';
import { numberToText } from '../utils/numberToText';
import { useUIStore } from '../store/uiStore';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { fetchAPI } from '../utils/api';
import { DEV_MODE } from '../config/env';
import { useMockStore, getFilteredMockState } from '../store/mockStore';
import styles from './EntityDrawer.module.css';
import { Tooltip } from '../components/ui/Tooltip';
import { useAuth } from '../contexts/AuthContext';

/* ─── Types ─────────────────────────────────────────────────── */
interface Props {
  isOpen: boolean;
  onClose: () => void;
  contact: any;
  onUpdate?: (data: any) => void;
}

const FMT = (v: any) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(v) || 0);

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '—';
  const cleanStr = dateStr.replace(' ', 'T');
  const d = new Date(cleanStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const buildTasks = (c: any): any[] => {
  if (!c) return [];
  const { activities } = useMockStore.getState();
  return activities.filter((a: any) => a.contact_id === c.id && a.type === 'task');
};

/* ─── Helpers ────────────────────────────────────────────────── */
// Fallback statuses used when pipeline-stages API has no data or in DEV_MODE
const DEFAULT_PIPELINE_STAGES = [
  { id: 'lead', name: 'Lead mới', color: '#3b82f6', order_index: 0 },
  { id: 'qualified', name: 'Đủ điều kiện', color: '#f59e0b', order_index: 1 },
  { id: 'customer', name: 'Khách hàng', color: '#10b981', order_index: 2 },
  { id: 'churned', name: 'Đã rời bỏ', color: '#ef4444', order_index: 3 },
];
// Keep for pipelineModal label lookups
const CONTACT_STATUSES = DEFAULT_PIPELINE_STAGES.map(s => ({ id: s.id, label: s.name, color: s.color }));

const AGO = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'Vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
};

const overridePurpleColor = (c: string | null | undefined): string => {
  if (!c) return 'var(--color-primary)';
  const hex = c.toLowerCase().trim();
  if (hex === '#6366f1' || hex === '#8b5cf6' || hex === '#7c3aed' || hex === '#6d28d9' || hex === '#4c1d95' || hex === '#a855f7' || hex === '#3b82f6') {
    return 'var(--color-primary)';
  }
  return c;
};

const resolveAttachmentUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  
  let cleanPath = url.replace(/^\/+/, '');
  
  // Rewrite legacy storage paths to the new uploads paths
  if (cleanPath.includes('storage/uploads/')) {
    cleanPath = cleanPath.replace('storage/uploads/', 'uploads/');
  }
  
  if (cleanPath.startsWith('backend/')) {
    cleanPath = cleanPath.substring('backend/'.length);
  }
  
  const apiBase = import.meta.env.VITE_API_URL || '/backend';
  let baseUrl = apiBase;
  if (baseUrl.includes('api.php')) {
    baseUrl = baseUrl.split('api.php')[0];
  }
  baseUrl = baseUrl.replace(/\/+$/, '');
  
  return `${baseUrl}/${cleanPath}`;
};

const TABS = [
  { id: 'info', label: 'Thông tin chung', icon: <User size={16} /> },
  { id: 'tags', label: 'Tags', icon: <TagIcon size={16} /> },
  { id: 'cooperation', label: 'Hợp tác', icon: <Users size={16} /> },
  { id: 'notes', label: 'Ghi chú', icon: <Pencil size={16} /> },
  { id: 'tasks', label: 'Công việc', icon: <CheckSquare size={16} /> },
  { id: 'docs', label: 'Hồ sơ & Tài liệu', icon: <Paperclip size={16} /> },
  { id: 'timeline', label: 'Lịch sử tương tác', icon: <History size={16} /> },
  { id: 'scoring', label: 'Scoring', icon: <Target size={16} /> },
  { id: 'ttl1', label: 'Xác minh TTL1', icon: <UserCheck size={16} /> },
  { id: 'invoices', label: 'Hóa đơn', icon: <FileText size={16} /> },
  { id: 'deals', label: 'Cơ hội', icon: <Briefcase size={16} /> },
  { id: 'quotes', label: 'Báo giá', icon: <ShoppingCart size={16} /> },
  { id: 'expenses', label: 'Chi phí', icon: <DollarSign size={16} /> },
  { id: 'tickets', label: 'Hỗ trợ/Khiếu nại', icon: <LifeBuoy size={16} /> },
];

const ActivityComments: React.FC<{ activityId: number, initialCount?: number }> = ({ activityId, initialCount = 0 }) => {
  const { addToast } = useUIStore();
  const { user: currentUser } = useAuth();
  const [comments, setComments] = useState<any[]>([]);

  const canDeleteComment = (c: any) => {
    if (!currentUser) return false;
    const role = currentUser.role as any;
    if (role === 'admin' || role === 'superadmin' || role === 'super_admin' || role === 'manager' || role === 'assistant') {
      return true;
    }
    return String(c.user_id) === String(currentUser.id);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này không?')) return;
    try {
      await api.delete(`/activities/comments/${commentId}`);
      setComments(comments.filter((c: any) => c.id !== commentId));
      addToast('Đã xóa bình luận thành công', 'success');
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Không thể xóa bình luận', 'error');
    }
  };
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (initialCount > 0 && !hasFetched) {
      api.get(`/activities/${activityId}/comments`)
        .then(res => {
          setComments(res.data.data || []);
          setHasFetched(true);
        })
        .catch(e => console.error(e));
    } else if (initialCount === 0 && !hasFetched) {
      setHasFetched(true);
    }
  }, [activityId, initialCount, hasFetched]);

  const displayCount = hasFetched ? comments.length : initialCount;

  const toggleExpand = async () => {
    if (!expanded && !hasFetched && initialCount > 0) {
      try {
        const res = await api.get(`/activities/${activityId}/comments`);
        setComments(res.data.data || []);
        setHasFetched(true);
      } catch (e: any) {
        addToast(e.response?.data?.message || 'Không thể tải bình luận', 'error');
      }
    }
    setExpanded(!expanded);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      addToast('Dung lượng tệp đính kèm không được vượt quá 5MB', 'error');
      return;
    }
    
    // Clear the input value so the same file can be selected again if needed
    e.target.value = '';

    const previewUrl = URL.createObjectURL(file);
    setAttachmentFile(file);
    setAttachmentPreview(previewUrl);
    addToast('Đã chọn tệp đính kèm', 'success');
  };

  const submitComment = async () => {
    if (!text.trim() && !attachmentFile) return;
    if (submitting) return; // Prevent double submit
    
    setSubmitting(true);
    try {
      let uploadedUrl = '';
      if (attachmentFile) {
        let fileToUpload = attachmentFile;
        if (attachmentFile.type.startsWith('image/')) {
          fileToUpload = await compressToWebP(attachmentFile);
        }
        const fd = new FormData();
        fd.append('file', fileToUpload);
        const res = await api.post('/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedUrl = res.data.data?.url ?? '';
      }

      const payload = { content: text, attachments: uploadedUrl ? [uploadedUrl] : [] };
      const res = await api.post(`/activities/${activityId}/comments`, payload);
      
      // Lấy tên người dùng hiện tại từ storage (nếu có)
      let userName = 'Bạn';
      try {
        const authData = localStorage.getItem('minth-auth');
        if (authData) userName = JSON.parse(authData).state?.user?.full_name || 'Bạn';
      } catch (e: any) {
        console.error(e);
      }

      setComments([...comments, {
        id: res.data?.data?.id || Date.now(),
        user_name: userName,
        content: text,
        attachments: uploadedUrl ? [uploadedUrl] : [],
        created_at: new Date().toISOString()
      }]);
      setText('');
      if (attachmentPreview) {
        URL.revokeObjectURL(attachmentPreview);
      }
      setAttachmentFile(null);
      setAttachmentPreview(null);
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Lỗi khi gửi bình luận', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: '0.75rem', borderTop: '1px dashed var(--color-border-light)', paddingTop: '0.75rem' }}>
      <button 
        className="btn ghost sm" 
        style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        onClick={toggleExpand}
      >
        <MessageSquare size={14} /> Bình luận {displayCount > 0 && `(${displayCount})`}
      </button>

      {expanded && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {comments.map((c: any) => (
            <div key={c.id} style={{ display: 'flex', gap: '0.75rem' }}>
              <Avatar name={c.user_name} size="sm" />
              <div style={{ flex: 1, background: 'var(--color-surface)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <strong style={{ fontSize: '0.8125rem', color: 'var(--color-text)' }}>{c.user_name}</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{c.created_at ? new Date(c.created_at).toLocaleString('vi-VN') : ''}</span>
                    {canDeleteComment(c) && (
                      <button
                        className="btn ghost sm"
                        style={{ padding: '2px', height: '16px', width: '16px', color: 'var(--color-danger)', opacity: 0.5 }}
                        onClick={(e) => { e.stopPropagation(); handleDeleteComment(c.id); }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {c.content && <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.content}</p>}
                {c.attachments && c.attachments.map((att: string, i: number) => {
                  const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(att);
                  const fullUrl = resolveAttachmentUrl(att);
                  return (
                    <div key={i} style={{ marginTop: '0.5rem' }}>
                      {isImg ? (
                        <a href={fullUrl} target="_blank" rel="noreferrer">
                          <img src={fullUrl} alt="attachment" style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '8px', border: '1px solid var(--color-border)' }} />
                        </a>
                      ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--color-bg-light)', borderRadius: '8px', border: '1px solid var(--color-border)', width: 'fit-content' }}>
                          <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                          <a href={fullUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'underline' }}>
                            {att.split('/').pop()}
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'flex-start' }}>
            <Avatar name="Bạn" size="sm" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ position: 'relative' }}>
                <MentionInput 
                  className="form-input" 
                  style={{ minHeight: '60px', padding: '8px 12px', fontSize: '0.875rem', paddingRight: '40px', opacity: submitting ? 0.7 : 1, width: '100%' }} 
                  placeholder="Viết bình luận..."
                  value={text}
                  disabled={submitting}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                />
                <label style={{ position: 'absolute', right: '8px', bottom: '8px', cursor: submitting ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)' }}>
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv,image/*" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading || submitting} />
                  {uploading || submitting ? <Loader2 size={18} className="spin" /> : <Paperclip size={18} />}
                </label>
              </div>
              
              {attachmentPreview && attachmentFile && (() => {
                const isImg = attachmentFile.type.startsWith('image/');
                return (
                  <div style={{ position: 'relative', display: 'inline-block', width: 'fit-content' }}>
                    {isImg ? (
                      <img src={attachmentPreview} alt="preview" style={{ height: '60px', borderRadius: '8px', border: '1px solid var(--color-primary)' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--color-bg-light)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                        <FileText size={16} style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{attachmentFile.name}</span>
                      </div>
                    )}
                    <button 
                      className="btn-icon sm" 
                      style={{ position: 'absolute', top: -6, right: -6, background: 'var(--color-danger)', color: 'white', padding: 2, height: 18, width: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => {
                        URL.revokeObjectURL(attachmentPreview);
                        setAttachmentFile(null);
                        setAttachmentPreview(null);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })()}
              
              <div style={{ textAlign: 'right' }}>
                <button 
                  className="btn primary sm" 
                  disabled={submitting || (!text.trim() && !attachmentFile)}
                  onClick={submitComment}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Send size={14} /> Gửi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const CustomerProfileDrawer: React.FC<Props> = ({ isOpen, onClose, contact, onUpdate }) => {
  const { addToast, showConfirm, showCall } = useUIStore();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [tags, setTags] = useState<string[]>([]);
  const [baseData, setBaseData] = useState<any>(contact || {});
  const [baseTags, setBaseTags] = useState<string[]>(contact?.tags || []);

  const hasChanges = useMemo(() => {
    if (!contact) return false;
    if (JSON.stringify(tags) !== JSON.stringify(baseTags)) return true;
    
    const fieldsToCompare = [
      'company_id', 'company_name', 'owner_id', 'first_name', 'last_name', 'email', 'phone',
      'mobile', 'job_title', 'department', 'source', 'status', 'notes',
      'birthday', 'address', 'city', 'ward', 'expected_revenue', 'win_probability'
    ];
    
    for (const key of fieldsToCompare) {
      const val1 = formData[key] === undefined || formData[key] === null ? '' : String(formData[key]);
      const val2 = baseData[key] === undefined || baseData[key] === null ? '' : String(baseData[key]);
      if (val1 !== val2) return true;
    }
    
    // Custom fields comparison
    if (formData.custom_fields && baseData.custom_fields) {
      if (JSON.stringify(formData.custom_fields) !== JSON.stringify(baseData.custom_fields)) return true;
    }
    
    return false;
  }, [formData, baseData, tags, baseTags, contact]);

  const handleSave = useCallback(async () => {
    // Only send fields that ContactController accepts
    const allowedFields = [
      'company_id', 'company_name', 'owner_id', 'first_name', 'last_name', 'email', 'phone',
      'mobile', 'job_title', 'department', 'source', 'status', 'notes',
      'birthday', 'address', 'city', 'ward', 'expected_revenue', 'win_probability', 'last_contact', 'created_at'
    ];
    const payload: Record<string, any> = {};
    allowedFields.forEach(f => { if (formData[f] !== undefined) payload[f] = formData[f]; });
    payload.tags = tags;
    if (formData.custom_fields && Array.isArray(formData.custom_fields)) {
      for (const f of formData.custom_fields) {
        const isEmpty = f.value === undefined || f.value === null || f.value === '' || (Array.isArray(f.value) && f.value.length === 0);
        if (f.is_required && isEmpty) {
          addToast(`Trường "${f.label}" là bắt buộc.`, 'error');
          return;
        }
      }
      payload.custom_fields = formData.custom_fields.map((f: any) => ({ field_id: f.id, value: f.value }));
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await api.put(`/contacts/${contact.id}`, payload);
      const updated = res.data?.data || { ...formData, tags };
      setFormData(updated);
      setBaseData(updated);
      setBaseTags(updated.tags || []);
      onUpdate?.(updated);
      addToast('Đã lưu thông tin khách hàng', 'success');
    } catch (e: any) {
      addToast(e?.response?.data?.message || 'Lỗi khi lưu thông tin', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, tags, isSubmitting, contact, onUpdate, addToast]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      showConfirm({
        title: 'Bỏ qua thay đổi?',
        message: 'Bạn có các thay đổi chưa lưu. Bạn có muốn lưu thay đổi trước khi đóng không?',
        confirmText: 'Lưu & Đóng',
        extraText: 'Bỏ qua thay đổi',
        cancelText: 'Hủy',
        onConfirm: async () => {
          await handleSave();
          onClose();
        },
        onExtra: () => {
          onClose();
        }
      });
    } else {
      onClose();
    }
  }, [hasChanges, onClose, showConfirm, handleSave]);
  const [showCallLogger, setShowCallLogger] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [editingDealId, setEditingDealId] = useState<number | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<any>(null);
  const [newNote, setNewNote] = useState('');
  const [noteAttachmentFile, setNoteAttachmentFile] = useState<File | null>(null);
  const [noteAttachmentPreview, setNoteAttachmentPreview] = useState<string | null>(null);
  const [noteChannel, setNoteChannel] = useState<'text' | 'call' | 'meet'>('text');
  const [customDocs, setCustomDocs] = useState('');
  const [customObstacle, setCustomObstacle] = useState('');
  const [showAddCustomField, setShowAddCustomField] = useState(false);
  const [customFieldKey, setCustomFieldKey] = useState('');
  const [customFieldValue, setCustomFieldValue] = useState('');
  const [noteType, setNoteType] = useState<'normal' | 'quality'>('normal');
  const [noteDuration, setNoteDuration] = useState<string>('');
  const [noteDocsSent, setNoteDocsSent] = useState<string>('');
  const [noteObstacle, setNoteObstacle] = useState<string>('');
  const [notes, setNotes] = useState<{ id: number; text: string; time: string; user: string; user_id?: number; attachment_url?: string | null }[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [pipelineModal, setPipelineModal] = useState<{ isOpen: boolean; targetId: string; targetLabel: string; note: string }>({ isOpen: false, targetId: '', targetLabel: '', note: '' });
  const [users, setUsers] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>(DEFAULT_PIPELINE_STAGES);
  const [contacts, setContacts] = useState<any[]>([]);
  const [ttl1Data, setTtl1Data] = useState<{
    group1: boolean;
    group2: boolean;
    group3: boolean;
    group4: boolean;
    group5: boolean;
  }>(() => {
    try {
      if (contact.ttl1_data) {
        return typeof contact.ttl1_data === 'string' ? JSON.parse(contact.ttl1_data) : contact.ttl1_data;
      }
    } catch {}
    return { group1: false, group2: false, group3: false, group4: false, group5: false };
  });
  const [isSavingTTL1, setIsSavingTTL1] = useState(false);
  const isOwnerOrAdmin = useMemo(() => {
    const isOwner = Number(currentUser?.id) === Number(formData.owner_id || contact?.owner_id);
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'assistant';
    return isOwner || isAdmin;
  }, [currentUser, formData.owner_id, contact?.owner_id]);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'assistant';
  const [decayDays, setDecayDays] = useState<number>(5);
  const handleSaveTTL1 = async (updatedData: typeof ttl1Data) => {
    setIsSavingTTL1(true);
    const count = Object.values(updatedData).filter(Boolean).length;
    const completed = count >= 4 ? 1 : 0;
    
    // Optimistic local state update
    setFormData((prev: any) => ({ ...prev, ttl1_completed: completed, ttl1_data: JSON.stringify(updatedData) }));

    try {
      if (!DEV_MODE) {
        await api.put(`/contacts/${contact.id}`, {
          ttl1_completed: completed,
          ttl1_data: JSON.stringify(updatedData)
        });
      }
      addToast('Cập nhật Form TTL1 thành công!', 'success');
      onUpdate?.({ ...formData, ttl1_completed: completed, ttl1_data: JSON.stringify(updatedData) });
    } catch (e: any) {
      addToast('Lỗi khi lưu Form TTL1', 'error');
    } finally {
      setIsSavingTTL1(false);
    }
  };

  // Cooperation Slip States and Functions (Module 4)
  const [coopSlip, setCoopSlip] = useState<any>(null);
  const [coopLoading, setCoopLoading] = useState(false);
  const [salesUsers, setSalesUsers] = useState<any[]>([]);
  const [coopShares, setCoopShares] = useState<{ user_id: string; percentage: string }[]>([]);
  const [coopError, setCoopError] = useState('');
  const [isRequestingChange, setIsRequestingChange] = useState(false);
  const [changeReason, setChangeReason] = useState('');

  const fetchCoopSlip = async () => {
    if (!contact?.id) return;
    setCoopLoading(true);
    setCoopError('');
    try {
      const usersEndpoint = currentUser?.role === 'sale' ? 'get_consultants' : 'users';
      const [resSlips, resUsers] = await Promise.all([
        fetchAPI('cooperation-slips'),
        fetchAPI(usersEndpoint)
      ]);
      
      if (resSlips.success) {
        const found = (resSlips.data || []).find((s: any) => Number(s.contact_id) === Number(contact.id));
        setCoopSlip(found || null);
        setIsRequestingChange(false);
        setChangeReason('');
        if (found) {
          const initialShares = found.shareholders.map((s: any) => ({
            user_id: String(s.user_id),
            percentage: String(s.percentage)
          }));
          setCoopShares(initialShares);
        }
      }
      if (resUsers.success) {
        const sales = (resUsers.data || []).filter((u: any) => u.role === 'sales' || u.role === 'sale' || currentUser?.role === 'sale');
        const mapped = sales.map((u: any) => ({
          ...u,
          full_name: u.full_name || u.name,
          role: u.role || 'sales'
        }));
        setSalesUsers(mapped);
      }
    } catch (e: any) {
      setCoopError(e.message || 'Lỗi tải dữ liệu hợp tác');
    }
    setCoopLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'cooperation' && contact?.id) {
      fetchCoopSlip();
    }
  }, [activeTab, contact?.id]);

  const handleCreateCoopSlip = async () => {
    setCoopLoading(true);
    try {
      const res = await fetchAPI('cooperation-slips', {
        method: 'POST',
        body: JSON.stringify({ contact_id: contact.id })
      });
      if (res.success) {
        addToast('Đã khởi tạo phiếu hợp tác hoa hồng thành công!', 'success');
        await fetchCoopSlip();
      } else {
        addToast(res.message || 'Không thể tạo phiếu hợp tác', 'error');
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    }
    setCoopLoading(false);
  };

  const handleSaveCoopShares = async () => {
    if (!coopSlip) return;
    const sum = coopShares.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);
    if (sum !== 100) {
      addToast('Tổng tỷ lệ chia sẻ hoa hồng phải bằng 100% (Hiện tại là ' + sum + '%)', 'error');
      return;
    }
    setCoopLoading(true);
    try {
      const sharesObj: Record<string, number> = {};
      coopShares.forEach(s => {
        if (s.user_id) sharesObj[s.user_id] = Number(s.percentage) || 0;
      });
      const res = await fetchAPI(`cooperation-slips/${coopSlip.id}/shares`, {
        method: 'PUT',
        body: JSON.stringify({ shares: sharesObj, reason: changeReason })
      });
      if (res.success) {
        addToast(isRequestingChange ? 'Gửi yêu cầu thay đổi tỷ lệ thành công!' : 'Cập nhật tỷ lệ chia sẻ thành công!', 'success');
        setIsRequestingChange(false);
        setChangeReason('');
        await fetchCoopSlip();
      } else {
        addToast(res.message || 'Lỗi lưu tỷ lệ', 'error');
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    }
    setCoopLoading(false);
  };

  const handleCoopAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !coopSlip) return;
    const file = e.target.files[0];
    e.target.value = '';
    
    const originalName = file.name;
    const defaultName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const customName = window.prompt("Nhập tên tài liệu:", defaultName);
    if (customName === null) {
      return; // User cancelled
    }
    const ext = originalName.substring(originalName.lastIndexOf('.'));
    const finalName = (customName.trim() || defaultName) + ext;

    setCoopLoading(true);
    try {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await compressToWebP(file);
      }
      const renamedFile = new File([fileToUpload], finalName, { type: fileToUpload.type });
      const fd = new FormData();
      fd.append('file', renamedFile);
      const res = await api.post(`/cooperation-slips/${coopSlip.id}/upload-attachment`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        addToast('Tải lên tài liệu đính kèm thành công!', 'success');
        await fetchCoopSlip();
      } else {
        addToast(res.data.message || 'Lỗi tải lên tài liệu', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi tải lên tài liệu', 'error');
    }
    setCoopLoading(false);
  };

  const handleRemoveCoopAttachment = async () => {
    if (!coopSlip) return;
    setCoopLoading(true);
    try {
      const res = await fetchAPI(`cooperation-slips/${coopSlip.id}/delete-attachment`, {
        method: 'POST'
      });
      if (res.success) {
        addToast('Đã xóa tài liệu đính kèm', 'success');
        await fetchCoopSlip();
      } else {
        addToast(res.message || 'Lỗi xóa tài liệu', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi xóa tài liệu', 'error');
    }
    setCoopLoading(false);
  };

  const handleSignCoopSlip = async () => {
    if (!coopSlip) return;
    setCoopLoading(true);
    try {
      const res = await fetchAPI(`cooperation-slips/${coopSlip.id}/sign`, {
        method: 'POST'
      });
      if (res.success) {
        addToast('Đã ký xác nhận phân chia hoa hồng thành công!', 'success');
        await fetchCoopSlip();
      } else {
        addToast(res.message || 'Lỗi ký xác nhận', 'error');
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    }
    setCoopLoading(false);
  };

  const [ticketForm, setTicketForm] = useState({ subject: '', priority: 'medium', description: '' });
  const [dealForm, setDealForm] = useState({
    title: '',
    value: '',
    stage: 'lead',
    probability: 50,
    expected_close: '',
    description: '',
    priority: 'medium'
  });
  const [taskForm, setTaskForm] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      title: '',
      priority: 'medium',
      due_date: today,
      description: '',
      link: '',
      user_id: String(contact?.owner_id || currentUser?.id || '')
    };
  });


  const [docs, setDocs] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [drawerInvoices, setDrawerInvoices] = useState<any[]>([]);
  const [drawerQuotes, setDrawerQuotes] = useState<any[]>([]);
  const [drawerExpenses, setDrawerExpenses] = useState<any[]>([]);
  const [drawerTickets, setDrawerTickets] = useState<any[]>([]);
  const [drawerActivities, setDrawerActivities] = useState<any[]>([]);
  const [showQuoteEditor, setShowQuoteEditor] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [quickUserCard, setQuickUserCard] = useState<{ id: number; name: string; role: string; email?: string; phone?: string; vacationMode?: number; visible: boolean; x: number; y: number } | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [tempAvatar, setTempAvatar] = useState('');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // In real app, upload to server. For now, use FileReader for preview + update state
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        await api.put(`/contacts/${contact.id}`, { avatar_url: base64 });
        setFormData((prev: any) => ({ ...prev, avatar_url: base64 }));
        addToast('Đã cập nhật ảnh đại diện', 'success');
        onUpdate?.({ ...formData, avatar_url: base64 });
      } catch (err: any) {
        addToast('Lỗi khi cập nhật ảnh', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const showUserCard = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    const user = users.find(u => u.full_name === name || u.full_name.replace(/\s+/g, '_') === name || u.name === name || u.username === name);
    setQuickUserCard({
      id: user?.id || 0,
      name: user?.full_name || name,
      role: user?.role || 'Nhân viên',
      email: user?.email,
      phone: user?.phone || user?.phone_number || '',
      vacationMode: user?.vacation_mode,
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  const formatNote = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_\u00C0-\u1EF9]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.substring(1);
        return (
          <span
            key={i}
            onClick={(e) => showUserCard(e, name)}
            style={{ color: '#BD1D2D', fontWeight: 700, cursor: 'pointer', background: '#fff5f6', padding: '2px 6px', borderRadius: '4px', margin: '0 2px' }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const fetchData = useCallback(async () => {
    if (!contact?.id) return;
    if (DEV_MODE) {
      const state = getFilteredMockState();
      // Load from mock store
      setNotes([]); // No notes in mock store yet
      setDrawerActivities(state.activities.filter((a: any) => a.contact_id === contact.id));
      setTasks(state.activities.filter((a: any) => a.contact_id === contact.id && a.type === 'task').map((a: any) => {
        const link = a.body ? (a.body.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m)?.[1]?.trim() || '') : '';
        const description = a.body ? a.body.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim() : '';
        return {
          id: a.id,
          title: a.subject,
          done: a.status === 'done',
          priority: a.priority || 'medium',
          due: a.due_date ? new Date(a.due_date).toLocaleDateString('vi-VN') : '—',
          link,
          description
        };
      }));
      setDeals(state.deals.filter((d: any) => d.contact_id === contact.id).map((d: any) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        stage: d.stage,
        prob: d.probability,
        close: d.expected_close,
        stage_color: d.stage_color || '#3b82f6'
      })));
      setDrawerInvoices(state.invoices.filter((i: any) => i.contact_id === contact.id));
      setDrawerQuotes(state.quotes.filter((q: any) => q.contact_id === contact.id)); 
      setDrawerExpenses(state.expenses.filter((e: any) => e.contact_id === contact.id)); 
      setDrawerTickets(state.tickets.filter((t: any) => t.customer_name === `${contact.first_name} ${contact.last_name}`.trim()));
      setDocs(state.files.filter((f: any) => f.contact_id === contact.id));
      setStages(DEFAULT_PIPELINE_STAGES);
      setLoadingRelated(false);
      return;
    }
    setLoadingRelated(true);
    try {
      // Fetch fresh Contact details
      try {
        const contactRes = await api.get(`/contacts/${contact.id}`);
        const freshContact = contactRes.data.data || contactRes.data;
        if (freshContact && freshContact.id) {
          setFormData(prev => ({ ...prev, ...freshContact }));
          setBaseData(freshContact);
        }
      } catch (err) {}

      // Fetch Notes
      const notesRes = await api.get(`/notes?entity_type=contact&entity_id=${contact.id}`);
      setNotes((notesRes.data.data || []).map((n: any) => ({
        id: n.id,
        text: n.body,
        time: n.created_at,
        user: n.user_name || 'Hệ thống',
        user_id: n.user_id
      })));

      // Fetch Tasks (Activities)
      const tasksRes = await api.get(`/activities?related_type=contact&related_id=${contact.id}`);
      const rawActivities = tasksRes.data.data?.items || [];
      setDrawerActivities(rawActivities);
      setTasks(rawActivities.filter((a: any) => a.type === 'task').map((a: any) => {
        const link = a.body ? (a.body.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m)?.[1]?.trim() || '') : '';
        const description = a.body ? a.body.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim() : '';
        return {
          id: a.id,
          title: a.subject,
          done: a.status === 'done',
          priority: a.priority,
          due: a.due_date ? new Date(a.due_date).toLocaleDateString('vi-VN') : '—',
          link,
          description
        };
      }));

      // Fetch Pipeline Stages
      try {
        const stagesRes = await api.get('/pipeline-stages');
        setStages(stagesRes.data.data?.items || stagesRes.data.data || []);
      } catch (err) {}

      // Fetch Deals
      const dealsRes = await api.get(`/deals?contact_id=${contact.id}`);
      const dealsList = (dealsRes.data.data?.items || []).map((d: any) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        stage: d.stage_name || 'Chưa xác định',
        stage_id: d.stage_id,
        prob: d.probability,
        close: d.expected_close_date || d.expected_close,
        description: d.description || '',
        priority: d.priority || 'medium',
        stage_color: d.stage_color || '#3b82f6'
      }));
      setDeals(dealsList);

      // Auto-sync contact expected_revenue & win_probability based on current deals
      const totalRev = dealsList.length > 0 ? dealsList.reduce((sum, d) => sum + (Number(d.value) || 0), 0) : 0;
      const avgProb = dealsList.length > 0 ? Math.round(dealsList.reduce((total, d) => total + (Number(d.prob) || 0), 0) / dealsList.length) : 0;
      if (totalRev !== Number(formData.expected_revenue || 0) || avgProb !== Number(formData.win_probability || 0)) {
        api.put(`/contacts/${contact.id}`, {
          expected_revenue: totalRev,
          win_probability: avgProb
        }).then(() => {
          setFormData(prev => ({ ...prev, expected_revenue: totalRev, win_probability: avgProb }));
          setBaseData(prev => ({ ...prev, expected_revenue: totalRev, win_probability: avgProb }));
        }).catch(err => console.error("Error syncing contact metrics:", err));
      }

      // Fetch Invoices
      const invoicesRes = await api.get(`/invoices?contact_id=${contact.id}`);
      const invData = invoicesRes.data.data;
      setDrawerInvoices(Array.isArray(invData) ? invData : (invData?.items || []));

      // Fetch Quotes
      const quotesRes = await api.get(`/quotes?contact_id=${contact.id}`);
      const qData = quotesRes.data.data;
      setDrawerQuotes(Array.isArray(qData) ? qData : (qData?.items || []));

      // Fetch Expenses
      const expensesRes = await api.get(`/expenses/entity/contact/${contact.id}`);
      const expData = expensesRes.data.data;
      setDrawerExpenses(Array.isArray(expData) ? expData : (expData?.items || []));

      // Fetch Tickets
      const ticketsRes = await api.get(`/tickets?contact_id=${contact.id}`);
      const tData = ticketsRes.data.data;
      setDrawerTickets(Array.isArray(tData) ? tData : (tData?.items || []));

      // Fetch Documents (Cloud Files)
      const docsRes = await api.get(`/cloud-files?contact_id=${contact.id}&limit=1000`);
      const docsData = docsRes.data.data?.items || [];
      setDocs(docsData.map((d: any) => ({
        id: d.id,
        name: d.name,
        date: new Date(d.created_at).toLocaleDateString('vi-VN'),
        size: (d.file_size / 1024 / 1024).toFixed(1) + ' MB',
        type: d.name.split('.').pop() || 'file',
        path: d.file_path
      })));

    } catch (e: any) {
      console.error("Error fetching drawer data:", e);
    } finally {
      setLoadingRelated(false);
    }
  }, [contact?.id]);

  useEffect(() => {
    if (contact) {
      setFormData(contact);
      setTags(contact.tags || []);
      setBaseData(contact);
      setBaseTags(contact.tags || []);
      setNotes([]);
      setTasks([]);
      setDeals([]);
      setDrawerInvoices([]);
      setDrawerQuotes([]);
      setDrawerExpenses([]);
      setDrawerTickets([]);
      setActiveTab('info');
      if (isOpen) fetchData();
    }
  }, [contact, isOpen, fetchData]);

  useEffect(() => {
    if (isOpen) {
      if (currentUser && currentUser.role !== 'sale') {
        api.get('/users').then(r => { const d = r.data.data; setUsers(Array.isArray(d) ? d : (d?.items || [])); }).catch(() => {});
      }
      api.get('/tags').then(r => setAllTags(r.data.data || [])).catch(() => { });
      api.get('/contacts?limit=1000').then(r => setContacts(r.data.data?.items || r.data.data || [])).catch(() => { });

      // Fetch dynamic business configurations (decay days & pipeline status hierarchy)
      fetchAPI('get_settings')
        .then(res => {
          if (res && res.success && res.data) {
            if (res.data.temperature_decay_days !== undefined) {
              const val = parseInt(res.data.temperature_decay_days, 10);
              if (!isNaN(val) && val > 0) {
                setDecayDays(val);
              }
            }
            if (res.data.pipeline_status_hierarchy && res.data.pipeline_status_labels) {
              try {
                const hierarchy = JSON.parse(res.data.pipeline_status_hierarchy);
                const labels = JSON.parse(res.data.pipeline_status_labels);
                if (Array.isArray(hierarchy) && hierarchy.length > 0) {
                  const mappedStages = hierarchy.map((slug: string, idx: number) => ({
                    id: slug,
                    name: labels[slug] || slug,
                    color: slug === 'dat_coc' || slug === 'dong_deal' ? '#10b981' : slug === 'booking' || slug === 'da_gap' || slug === 'dong_y_gap' ? '#f59e0b' : '#3b82f6',
                    order_index: idx
                  }));
                  setPipelineStages(mappedStages);
                }
              } catch (e) {
                console.error('Failed to parse pipeline stages from settings', e);
              }
            }
          }
        })
        .catch(() => {});

    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);



  const { score, rules } = useMemo(() => {
    let s = 0;
    const r: any[] = [];
    const title = (formData.job_title || '').toLowerCase();
    if (title.includes('giám đốc') || title.includes('ceo')) {
      s += 30; r.push({ rule: 'Chức danh C-Level (Giám đốc/CEO)', pts: 30, type: 'Demographic' });
    } else if (title) {
      s += 10; r.push({ rule: 'Có thông tin chức vụ', pts: 10, type: 'Demographic' });
    }
    if (formData.phone) { s += 15; r.push({ rule: 'Cung cấp số điện thoại', pts: 15, type: 'Demographic' }); }
    if (formData.email) { s += 10; r.push({ rule: 'Cung cấp Email', pts: 10, type: 'Demographic' }); }
    if (formData.source === 'website') { s += 20; r.push({ rule: 'Nguồn Inbound (Website)', pts: 20, type: 'Behavioral' }); }
    if (formData.source === 'referral') { s += 25; r.push({ rule: 'Khách hàng giới thiệu (Referral)', pts: 25, type: 'Behavioral' }); }
    if (formData.expected_revenue > 100000000) { s += 30; r.push({ rule: 'Deal size tiềm năng > 100Tr', pts: 30, type: 'Behavioral' }); }
    if (formData.status === 'qualified' || formData.status === 'customer') { s += 20; r.push({ rule: 'Sales đã verify chất lượng', pts: 20, type: 'Behavioral' }); }

    // Temperature Decay rule: -15 points after 5 days of inactivity
    let lastInteractionTime = contact?.last_contact || contact?.updated_at || formData.created_at;
    if (drawerActivities && drawerActivities.length > 0) {
      const latestActivity = drawerActivities.reduce((latest, current) => {
        const latestTime = new Date(latest.created_at).getTime();
        const currentTime = new Date(current.created_at).getTime();
        return currentTime > latestTime ? current : latest;
      }, drawerActivities[0]);
      if (latestActivity && latestActivity.created_at) {
        lastInteractionTime = latestActivity.created_at;
      }
    }

    const fiveDaysInMs = decayDays * 24 * 60 * 60 * 1000;
    const isDecayed = lastInteractionTime ? (new Date().getTime() - new Date(lastInteractionTime).getTime() > fiveDaysInMs) : false;

    if (isDecayed) {
      s -= 15;
      r.push({ rule: `Rớt nhiệt do quá ${decayDays} ngày không tương tác`, pts: -15, type: 'Decay' });
    }

    if (r.length === 0) r.push({ rule: 'Điểm khởi tạo (Mặc định)', pts: 15, type: 'System' });

    return { score: Math.min(100, Math.max(0, s || 15)), rules: r };
  }, [
    formData.job_title, formData.phone, formData.email, formData.source, formData.expected_revenue, formData.status,
    formData.created_at, contact?.last_contact, contact?.updated_at, drawerActivities, decayDays
  ]);

  const mockStore = useMockStore();

  const timeline = useMemo(() => {
    if (!contact?.id) return [];
    const source = drawerActivities;
    return source.map((a: any) => ({
      id: a.id,
      title: a.subject,
      type: a.type,
      user: a.user_name || 'Hệ thống',
      time: a.created_at,
      color: a.type === 'call' ? '#3b82f6' : a.type === 'meeting' ? '#BD1D2D' : a.type === 'task' ? '#f59e0b' : '#10b981',
      icon: a.type === 'call' ? <Phone size={16} /> : a.type === 'meeting' ? <User size={16} /> : a.type === 'task' ? <CheckSquare size={16} /> : <Mail size={16} />,
      note: a.body || a.note || '',
      comment_count: a.comment_count,
      expense_image_url: a.expense_image_url
    })).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [drawerActivities, mockStore.activities, contact?.id]);
  const fullName = `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'Chưa cập nhật tên';

  const handleAddCustomField = () => {
    const key = customFieldKey.trim();
    const val = customFieldValue.trim();
    if (!key) {
      addToast('Vui lòng nhập tên trường (Key).', 'error');
      return;
    }

    const systemKeys = [
      'id', 'company_id', 'company_name', 'owner_id', 'first_name', 'last_name', 
      'email', 'phone', 'mobile', 'job_title', 'department', 'source', 'status', 
      'notes', 'birthday', 'address', 'city', 'ward', 'expected_revenue', 
      'win_probability', 'last_contact', 'created_at', 'updated_at', 'avatar_url', 'tags'
    ];
    if (systemKeys.includes(key.toLowerCase())) {
      addToast(`Tên trường "${key}" trùng với tên hệ thống. Vui lòng chọn tên khác!`, 'error');
      return;
    }

    const existingFields = formData.custom_fields || [];
    const isConflict = existingFields.some((f: any) => f.label.toLowerCase() === key.toLowerCase());
    if (isConflict) {
      addToast(`Trường "${key}" đã tồn tại. Vui lòng chọn tên khác!`, 'error');
      return;
    }

    const newField = {
      id: Date.now(),
      label: key,
      field_type: 'text',
      value: val,
      is_required: false
    };

    setFormData((prev: any) => ({
      ...prev,
      custom_fields: [...(prev.custom_fields || []), newField]
    }));

    setCustomFieldKey('');
    setCustomFieldValue('');
    setShowAddCustomField(false);
    addToast('Đã thêm trường tùy chỉnh mới', 'success');
  };



  const canDeleteNote = (noteCreatorId?: number) => {
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'assistant';
    return isAdmin || Number(currentUser?.id) === Number(noteCreatorId);
  };

  const addNote = async () => {
    if (!newNote.trim() || isSubmitting) return;
    setIsSubmitting(true);
    const channelLabel = noteChannel === 'text' ? 'Nối Đất (Text/Chat)' : noteChannel === 'call' ? 'Nối Đồng (Call)' : 'Nối Áp Suất (Gặp mặt)';
    let text = `[${channelLabel} - Tương tác ${noteType === 'normal' ? 'Thường' : 'Chất lượng'}]\n`;
    if (noteChannel === 'call' && noteDuration.trim()) {
      text += `Thời lượng cuộc gọi: ${noteDuration} giây\n`;
    }
    if (noteDocsSent.trim()) {
      const docsArray = noteDocsSent.split(', ').map(d => d.trim());
      const docsFinal = docsArray.map(d => d === 'Khác' ? (customDocs.trim() || 'Khác') : d).filter(Boolean);
      text += `Tài liệu đã gửi: ${docsFinal.join(', ')}
`;
    }
    if (noteObstacle) {
      const obstacleLabels: Record<string, string> = {
        'trust': '🧑 Chưa tin mình',
        'project': '🏙️ Chưa ưng dự án',
        'unit': '🏠 Chưa chọn căn',
        'smooth': '✓ Đang xuôi',
        'other': `➕ Khác: ${customObstacle.trim() || 'Chưa rõ'}`
      };
      text += `Trạng thái vướng mắc: ${obstacleLabels[noteObstacle] || noteObstacle}\n`;
    }
    text += `Nội dung: ${newNote.trim()}`;
    try {
      let uploadedUrl = '';
      if (noteAttachmentFile) {
        let fileToUpload = noteAttachmentFile;
        if (noteAttachmentFile.type.startsWith('image/')) {
          fileToUpload = await compressToWebP(noteAttachmentFile);
        }
        const fd = new FormData();
        fd.append('file', fileToUpload);
        const res = await api.post('/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedUrl = res.data.data?.url ?? '';
      }

      await api.post(`/notes?entity_type=contact&entity_id=${contact.id}`, {
        body: text, type: 'internal', attachment_url: uploadedUrl || null
      });
      setNewNote('');
      if (noteAttachmentPreview) {
        URL.revokeObjectURL(noteAttachmentPreview);
      }
      setNoteAttachmentFile(null);
      setNoteAttachmentPreview(null);
      setNoteChannel('text');
      setNoteType('normal');
      setNoteDuration('');
      setNoteDocsSent('');
      setCustomDocs('');
      setNoteObstacle('');
      setCustomObstacle('');
      fetchData(); // Reload all to stay in sync
      addToast('Đã lưu ghi chú', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu ghi chú', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNoteAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast('Dung lượng tệp đính kèm không được vượt quá 5MB', 'error');
      return;
    }

    e.target.value = '';
    const previewUrl = URL.createObjectURL(file);
    setNoteAttachmentFile(file);
    setNoteAttachmentPreview(previewUrl);
    addToast('Đã chọn tài liệu đính kèm', 'success');
  };

  const handleTaskFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      addToast('Dung lượng tệp tối đa cho phép là 10MB', 'error');
      return;
    }
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    formData.append('category', 'general');
    formData.append('visibility', 'shared');
    if (contact?.id) {
      formData.append('contact_id', contact.id.toString());
    }
    try {
      const res = await api.post('/cloud-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        const filePath = res.data.data.path;
        setTaskForm(prev => ({ ...prev, link: filePath }));
        addToast('Tải tệp đính kèm thành công', 'success');
      } else {
        addToast(res.data.message || 'Lỗi khi tải tệp lên', 'error');
      }
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi kết nối khi tải tệp lên', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddTask = async () => {
    if (!taskForm.title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    let bodyText = taskForm.description.trim();
    if (taskForm.link && taskForm.link.trim()) {
      bodyText += (bodyText ? "\n\n" : "") + `Tài liệu/Link đính kèm: ${taskForm.link.trim()}`;
    }
    try {
      await api.post('/activities', {
        related_type: 'contact',
        related_id: contact.id,
        subject: taskForm.title,
        type: 'task',
        priority: taskForm.priority,
        due_date: taskForm.due_date,
        user_id: taskForm.user_id ? Number(taskForm.user_id) : null,
        body: bodyText || null,
        status: 'planned'
      });
      setShowTaskModal(false);
      setTaskForm({ 
        title: '', 
        priority: 'medium', 
        due_date: new Date().toISOString().slice(0, 10), 
        description: '', 
        link: '', 
        user_id: String(contact?.owner_id || currentUser?.id || '') 
      });
      fetchData();
      addToast('Đã thêm công việc mới', 'success');
    } catch (e: any) {
      addToast(e?.response?.data?.message || 'Lỗi khi lưu công việc', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };



  const deleteActivity = async (id: number) => {
    showConfirm({
      title: 'Xóa hoạt động',
      message: 'Bạn có chắc chắn muốn xóa hoạt động này khỏi nhật ký?',
      isDanger: true,
      confirmText: 'Xóa',
      onConfirm: async () => {
        try {
          await api.delete(`/activities/${id}`);
          fetchData();
          addToast('Đã xóa hoạt động', 'success');
        } catch (e: any) {
          addToast('Lỗi khi xóa hoạt động', 'error');
        }
      }
    });
  };

  const toggleTaskDone = async (taskId: number, currentDone: boolean) => {
    setTasks(p => p.map(x => x.id === taskId ? { ...x, done: !currentDone } : x));
    try {
      const nextStatus = !currentDone ? 'done' : 'planned';
      await api.put(`/activities/${taskId}`, { status: nextStatus });
      addToast(nextStatus === 'done' ? 'Đã hoàn thành công việc' : 'Đã mở lại công việc', 'success');
      setDrawerActivities(prev => prev.map(a => a.id === taskId ? { ...a, status: nextStatus } : a));
    } catch (err: any) {
      setTasks(p => p.map(x => x.id === taskId ? { ...x, done: currentDone } : x));
      addToast(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái công việc', 'error');
    }
  };

  const deleteDeal = async (id: number) => {
    showConfirm({
      title: 'Xóa cơ hội bán hàng',
      message: 'Bạn có chắc chắn muốn xóa cơ hội này?',
      isDanger: true,
      confirmText: 'Xóa',
      onConfirm: async () => {
        try {
          await api.delete(`/deals/${id}`);
          fetchData();
          addToast('Đã xóa cơ hội thành công', 'success');
        } catch (e: any) {
          addToast('Lỗi khi xóa cơ hội', 'error');
        }
      }
    });
  };

  const handleSaveDeal = async () => {
    if (!dealForm.title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const selectedStageId = (dealForm.stage === 'lead' || !dealForm.stage) ? null : Number(dealForm.stage);
      const payload = {
        title: dealForm.title,
        value: Number(dealForm.value) || 0,
        stage_id: selectedStageId,
        probability: dealForm.probability,
        expected_close_date: dealForm.expected_close || null,
        description: dealForm.description || null,
        priority: dealForm.priority || 'medium'
      };

      if (editingDealId) {
        await api.put(`/deals/${editingDealId}`, payload);
        addToast('Đã cập nhật cơ hội thành công', 'success');
      } else {
        await api.post('/deals', {
          ...payload,
          contact_id: contact.id
        });
        addToast('Đã tạo cơ hội mới thành công', 'success');
      }
      setShowDealModal(false);
      setDealForm({ title: '', value: '', stage: 'lead', probability: 50, expected_close: '', description: '', priority: 'medium' });
      setEditingDealId(null);
      fetchData();
    } catch (e: any) {
      addToast(e?.response?.data?.message || 'Lỗi khi lưu cơ hội', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketForm.subject.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post('/tickets', {
        contact_id: contact.id,
        customer_name: fullName,
        subject: ticketForm.subject,
        priority: ticketForm.priority,
        description: ticketForm.description
      });
      setShowTicketModal(false);
      setTicketForm({ subject: '', priority: 'medium', description: '' });
      fetchData();
      addToast('Đã gửi yêu cầu hỗ trợ', 'success');
    } catch (e: any) {
      addToast(e?.response?.data?.message || 'Lỗi khi tạo ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!contact) return null;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="overlay-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={handleClose}
              style={{ zIndex: 1000 }}
            />
            <motion.div
              className={styles.drawer}
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
            >
              <AnimatePresence>
                {showAvatarModal && (
                  <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                      style={{ background: 'var(--color-surface)', width: '400px', borderRadius: '24px', padding: '2rem', boxShadow: 'var(--shadow-2xl)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', textAlign: 'center' }}>Cập nhật Ảnh đại diện</h3>

                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                        <div style={{ width: 120, height: 120, borderRadius: '32px', background: tempAvatar ? `url(${tempAvatar}) center/cover` : 'var(--color-bg)', border: '4px solid var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
                          {!tempAvatar && <User size={48} color="var(--color-text-muted)" />}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <label className="form-label">Tải ảnh lên</label>
                          <div 
                            onClick={() => {
                              const el = document.getElementById('avatar-file-input');
                              if (el) el.click();
                            }}
                            style={{
                              border: '2px dashed var(--color-border)',
                              borderRadius: '16px',
                              padding: '1.25rem',
                              textAlign: 'center',
                              cursor: 'pointer',
                              background: 'var(--color-bg)',
                              transition: 'all 0.2s',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'var(--color-primary)';
                              e.currentTarget.style.background = 'var(--color-primary-light)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--color-border)';
                              e.currentTarget.style.background = 'var(--color-bg)';
                            }}
                          >
                            <Upload size={20} style={{ color: 'var(--color-text-muted)' }} />
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>Click để tải ảnh lên</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Hỗ trợ JPG, PNG, WEBP</span>
                            <input
                              id="avatar-file-input"
                              type="file"
                              style={{ display: 'none' }}
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const compressed = await compressToWebP(file);
                                  const reader = new FileReader();
                                  reader.onloadend = () => setTempAvatar(reader.result as string);
                                  reader.readAsDataURL(compressed);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="form-label">Hoặc dán URL ảnh</label>
                          <input
                            className="form-input"
                            placeholder="https://example.com/avatar.jpg"
                            value={tempAvatar}
                            onChange={e => setTempAvatar(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                        <button className="btn outline" style={{ flex: 1 }} onClick={() => setShowAvatarModal(false)}>Hủy</button>
                        <button
                          className="btn primary"
                          style={{ flex: 1 }}
                          onClick={async () => {
                            try {
                              let finalUrl = tempAvatar;

                              // Check if tempAvatar is a base64 string (meaning it was just uploaded)
                              if (tempAvatar.startsWith('data:image/')) {
                                const blob = await (await fetch(tempAvatar)).blob();
                                const formDataUpload = new FormData();
                                formDataUpload.append('file', blob, 'avatar.jpg');
                                formDataUpload.append('previous_url', formData.avatar_url || '');

                                const uploadRes = await api.post('/upload', formDataUpload, {
                                  headers: { 'Content-Type': 'multipart/form-data' }
                                });
                                finalUrl = uploadRes.data.data?.url ?? '';
                              }

                              await api.put(`/contacts/${contact.id}`, { avatar_url: finalUrl });
                              setFormData((prev: any) => ({ ...prev, avatar_url: finalUrl }));
                              addToast('Đã cập nhật ảnh đại diện', 'success');
                              setShowAvatarModal(false);
                              onUpdate?.({ ...formData, avatar_url: finalUrl });
                            } catch (err: any) {
                              addToast(err.response?.data?.message || 'Lỗi khi lưu ảnh', 'error');
                            }
                          }}
                        >
                          Lưu thay đổi
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* ── Quick User Card Popover ── */}
              <AnimatePresence>
                {quickUserCard && quickUserCard.visible && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 3000 }}
                      onClick={() => setQuickUserCard(null)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      style={{
                        position: 'fixed',
                        top: quickUserCard.y + 15,
                        left: quickUserCard.x - 110,
                        zIndex: 3001,
                        width: 220,
                        background: 'var(--color-surface)',
                        borderRadius: '16px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                        border: '1px solid var(--color-border)',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ height: 60, background: 'linear-gradient(135deg, #BD1D2D 0%, #8a0f1b 100%)' }} />
                      <div style={{ padding: '0 1.25rem 1.25rem', textAlign: 'center', marginTop: -30 }}>
                        <div style={{ width: 60, height: 60, borderRadius: '20px', background: 'var(--color-surface)', margin: '0 auto 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', border: '4px solid var(--color-surface)', fontSize: '1.5rem', fontWeight: 800, color: '#BD1D2D' }}>
                          {quickUserCard.name.charAt(0).toUpperCase()}
                        </div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '2px' }}>{quickUserCard.name}</h4>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#BD1D2D', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{quickUserCard.role === 'admin' ? 'Quản trị viên' : 'Nhân viên kinh doanh'}</p>
                        
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.625rem', padding: '2px 6px', borderRadius: '4px', background: quickUserCard.vacationMode === 1 ? 'var(--color-warning-light)' : 'var(--color-success-light)', color: quickUserCard.vacationMode === 1 ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 700 }}>
                            {quickUserCard.vacationMode === 1 ? 'Đang nghỉ phép' : 'Đang hoạt động'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {quickUserCard.email && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-light)', fontSize: '0.75rem', padding: '6px 8px', background: 'var(--color-bg)', borderRadius: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={quickUserCard.email}>
                              <Mail size={11} style={{ flexShrink: 0 }} />
                              <span style={{ fontWeight: 500 }}>{quickUserCard.email}</span>
                            </div>
                          )}
                          {quickUserCard.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-light)', fontSize: '0.75rem', padding: '6px 8px', background: 'var(--color-bg)', borderRadius: '8px' }}>
                              <Phone size={11} style={{ flexShrink: 0 }} />
                              <span style={{ fontWeight: 500 }}>{quickUserCard.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* ── Header ── */}
              <div className={styles.profileHeader}>
                {/* Absolute Close Button */}
                <button className={styles.closeBtnAbsolute} onClick={handleClose} aria-label="Close drawer">
                  <X size={20} />
                </button>

                <div className={styles.profileHeaderContent}>
                  {/* Avatar Section */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      className="avatar-placeholder lg"
                      style={{
                        background: formData.avatar_url 
                          ? `url(${formData.avatar_url}) center/cover` 
                          : `linear-gradient(135deg, ${formData.stage_color || 'var(--color-primary)'} 0%, ${formData.stage_color ? formData.stage_color + 'cc' : '#8a0f1b'} 100%)`,
                        fontSize: '1.25rem', width: 56, height: 56, borderRadius: '50%',
                        boxShadow: '0 4px 12px rgba(189, 29, 45, 0.12)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      onClick={() => {
                        setTempAvatar(formData.avatar_url || '');
                        setShowAvatarModal(true);
                      }}
                    >
                      {!formData.avatar_url && (formData.first_name?.[0] || '?').toUpperCase()}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.3)',
                          opacity: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'opacity 0.2s',
                          borderRadius: '50%'
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                      >
                        <Pencil size={16} color="white" />
                      </div>
                    </div>
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', border: '2px solid var(--color-surface)' }}>
                      <UserCheck size={11} className="text-success" />
                    </div>
                  </div>

                  {/* Info Section */}
                  <div className={styles.profileInfoSection}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em', wordBreak: 'break-word' }}>{fullName}</h2>
                      <span className={`badge ${formData.status === 'customer' ? 'success' : formData.status === 'qualified' ? 'warning' : 'info'}`} style={{ padding: '2px 8px', fontSize: '0.6875rem', borderRadius: '6px' }}>
                        {formData.status === 'customer' ? 'Khách hàng VIP' : formData.status === 'qualified' ? 'Đã thẩm định' : 'Tiềm năng'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-light)', fontSize: '0.75rem' }}>
                        <Clock size={12} /> <span>Tạo lúc: <strong style={{ color: 'var(--color-text)' }}>{formatDateTime(formData.created_at)}</strong></span>
                      </p>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-light)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>|</span>
                        <span>Cập nhật: <strong style={{ color: 'var(--color-text)' }}>{formatDateTime(formData.updated_at || formData.created_at)}</strong></span>
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => formData.phone && showCall(formData.phone)}>
                          <Phone size={12} style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <PhoneLink phone={formData.phone} style={{ fontSize: '0.8125rem' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Mail size={12} className="text-muted" />
                        </div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{formData.email || 'contact@email.com'}</span>
                      </div>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'pointer' }}
                        onClick={(e) => showUserCard(e, formData.owner_name)}
                      >
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#BD1D2D', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800 }}>
                          {formData.owner_name ? formData.owner_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8a0f1b' }}>{formData.owner_name || 'Sale phụ trách'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className={styles.profileActionsSection}>
                     {/* Lead Score inline card */}
                     <div 
                       onClick={() => setActiveTab('scoring')}
                       style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                       title="Xem chi tiết Scoring"
                     >
                       <LeadScoreRing score={score} size={44} showLabel={true} />
                     </div>

                    <button
                      className={`btn ${hasChanges ? 'primary' : 'outline'} sm`}
                      disabled={!hasChanges}
                      onClick={handleSave}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '10px', height: '36px', fontSize: '0.8125rem' }}
                    >
                      <CheckSquare size={14} /> {hasChanges ? 'Lưu thay đổi' : 'Đã đồng bộ'}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Pipeline Stepper Bar ── */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border-light)', overflow: 'hidden' }}>
                <button className="btn outline sm" style={{ padding: '4px', height: 26, width: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: '50%', position: 'absolute', left: '0.75rem', zIndex: 10, background: 'var(--color-surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} onClick={() => document.getElementById('pipeline-scroll-container')?.scrollBy({ left: -250, behavior: 'smooth' })}>
                  <ChevronLeft size={14} />
                </button>

                <div id="pipeline-scroll-container" className="no-scrollbar" style={{ display: 'flex', padding: '0.625rem 3rem', gap: '12px', overflowX: 'auto', flex: 1, scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none', position: 'relative' }}>
                  <style dangerouslySetInnerHTML={{ __html: `#pipeline-scroll-container::-webkit-scrollbar { display: none; }` }} />
                  {(() => {
                    const currentIdx = pipelineStages.findIndex(s => String(s.id) === String(formData.pipeline_status || 'chua_xac_dinh'));
                    const safeIndex = currentIdx === -1 ? 0 : currentIdx;

                    return pipelineStages.map((st, i) => {
                      const isActive = i <= safeIndex;
                      const isCurrent = i === safeIndex;
                      const stColor = overridePurpleColor(st.color);
                      return (
                        <div
                          key={st.id}
                          onClick={() => {
                            if (isCurrent) return;

                            // Guard: Only owner or admin can change pipeline status
                            const isOwner = Number(currentUser?.id) === Number(formData.owner_id || contact?.owner_id);
                            const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'assistant';
                            if (currentUser?.role === 'sale' && !isOwner && !isAdmin) {
                              addToast('Chặn thao tác: Chỉ chủ sở hữu (Owner) mới có quyền chuyển trạng thái khách hàng!', 'error');
                              return;
                            }
                            
                            // Check interaction guardrail: if transitioning to 'churned' (Đã rời bỏ/Đóng), must have at least 1 activity
                            if (st.id === 'churned' && drawerActivities.length === 0) {
                              addToast('Chặn đóng deal: Khách hàng chưa từng có tương tác nào! Vui lòng tạo ghi chú cuộc gọi, email hoặc hoạt động trước.', 'error');
                              return;
                            }

                            // Check TTL1 constraint: moving to status index >= 2 (e.g. 'dong_y_gap' / 'Đồng Ý Gặp' or later)
                            const targetIdx = pipelineStages.findIndex(s => String(s.id) === String(st.id));
                            if (targetIdx >= 2) {
                              const count = Object.values(ttl1Data).filter(Boolean).length;
                              if (count < 4) {
                                addToast('Chặn chuyển giai đoạn: Yêu cầu hoàn thành tối thiểu 4/5 nhóm thông tin trong Form TTL1!', 'error');
                                return;
                              }
                            }
                            
                            setPipelineModal({ isOpen: true, targetId: String(st.id), targetLabel: st.name, note: '' });
                          }}
                          style={{
                            flex: '1 0 auto', minWidth: '135px', position: 'relative', height: '32px', cursor: isCurrent ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', transition: 'all 0.3s'
                          }}
                        >
                          {/* Connection Line */}
                          {i < pipelineStages.length - 1 && (
                            <div style={{ position: 'absolute', top: '50%', left: '50%', right: '-50%', height: '2px', background: i < safeIndex ? stColor : 'var(--color-border)', transform: 'translateY(-50%)', zIndex: 1, borderRadius: '4px' }} />
                          )}

                          <div style={{
                            position: 'relative', zIndex: 2, flex: 1,
                            background: isCurrent ? stColor : 'var(--color-surface)',
                            color: isCurrent ? '#fff' : (isActive ? stColor : 'var(--color-text-muted)'),
                            border: `2px solid ${isActive ? stColor : 'var(--color-border-light)'}`,
                            padding: '4px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            whiteSpace: 'nowrap',
                            boxShadow: isCurrent ? `0 4px 12px ${stColor}40` : 'none',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}>
                            {isActive && !isCurrent && <Check size={12} />}
                            {isCurrent && <UserCheck size={12} />}
                            {st.name}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <button className="btn outline sm" style={{ padding: '4px', height: 26, width: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: '50%', position: 'absolute', right: '0.75rem', zIndex: 10, background: 'var(--color-surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} onClick={() => document.getElementById('pipeline-scroll-container')?.scrollBy({ left: 250, behavior: 'smooth' })}>
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* ── Layout Split: Left Sidebar Tabs & Content ── */}
              <div className={styles.drawerBody}>

                {/* Sidebar Tabs */}
                <div className={styles.sidebarTabs} style={{ gap: '0.25rem', overflowY: 'auto' }}>
                  {(() => {
                    const tabGroups = [
                      {
                        title: 'Thông tin & Nhật ký',
                        tabs: ['info', 'tags', 'scoring', 'notes', 'timeline']
                      },
                      {
                        title: 'Giao dịch & Công việc',
                        tabs: ['cooperation', 'tasks', 'docs', 'deals', 'quotes', 'invoices', 'expenses']
                      },
                      {
                        title: 'Nghiệp vụ & Hỗ trợ',
                        tabs: ['ttl1', 'tickets']
                      }
                    ];

                    return tabGroups.map((group, groupIdx) => {
                      const allowedTabs = TABS.filter(tab => group.tabs.includes(tab.id) && (isOwnerOrAdmin || (tab.id !== 'quotes' && tab.id !== 'expenses')));
                      if (allowedTabs.length === 0) return null;

                      return (
                        <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginBottom: groupIdx !== tabGroups.length - 1 ? '0.75rem' : 0 }}>
                          <div style={{ 
                            padding: '0.375rem 0.5rem', 
                            fontSize: '0.65rem', 
                            fontWeight: 800, 
                            color: 'var(--color-text-muted)', 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.08em',
                            opacity: 0.8
                          }}>
                            {group.title}
                          </div>
                           {allowedTabs.map(tab => (
                            <button
                              key={tab.id}
                              className={`${styles.sidebarTabBtn} ${activeTab === tab.id ? styles.sidebarTabActive : ''}`}
                              onClick={() => setActiveTab(tab.id)}
                              style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {tab.icon}
                                <span>{tab.label}</span>
                              </div>
                              {tab.id === 'tasks' && tasks.filter(t => !t.done).length > 0 && (
                                <span style={{
                                  background: 'var(--color-danger)',
                                  color: 'white',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '18px',
                                  height: '18px',
                                  lineHeight: 1
                                }}>
                                  {tasks.filter(t => !t.done).length}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    });
                  })()}
                  <div style={{ marginTop: 'auto', padding: '1rem 0 0 0', borderTop: '1px solid var(--color-border)' }}>
                    <p style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>Enterprise CRM</p>
                  </div>
                </div>



                {/* Content Area */}
                <div className={styles.contentArea}>

                  {/* INFO TAB */}
                  {activeTab === 'info' && (
                    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Quick Stats Dashboard */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
                        <div className="card-panel" style={{ padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', borderRadius: '10px' }}>
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>DỰ KIẾN DOANH THU</span>
                          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981', marginTop: '0.15rem', whiteSpace: 'nowrap' }}>{FMT(formData.expected_revenue || 0)}</span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}><span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{formData.win_probability || 0}%</span> xác suất</span>
                        </div>
                        <div className="card-panel" style={{ padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', borderRadius: '10px' }}>
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>DOANH THU THỰC TẾ</span>
                          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-success)', marginTop: '0.15rem', whiteSpace: 'nowrap' }}>{FMT(formData.actual_revenue || 0)}</span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{formData.paid_invoice_count || 0} hóa đơn</span>
                        </div>
                        <div className="card-panel" style={{ padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', borderRadius: '10px' }}>
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>CHI TIÊU</span>
                          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: '0.15rem', whiteSpace: 'nowrap' }}>{FMT(formData.total_spent || 0)}</span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>{formData.expense_count || 0} khoản chi</span>
                        </div>
                        <div className="card-panel" style={{ padding: '0.75rem 0.875rem', display: 'flex', flexDirection: 'column', borderRadius: '10px' }}>
                          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>LẦN LIÊN HỆ CUỐI</span>
                          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '0.15rem', whiteSpace: 'nowrap' }}>
                            {formData.last_contact ? new Date(formData.last_contact).toLocaleDateString('vi-VN') : 'Chưa có'}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {formData.last_contact ? AGO(formData.last_contact) : 'Cần liên hệ ngay'}
                          </span>
                        </div>
                      </div>


                      <div className="card-panel">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="panel-title" style={{ margin: 0 }}>Thông tin liên hệ & Công việc</h4>
                        </div>
                        <div className="grid grid-2">
                          <div className="form-group">
                            <label className="form-label">Họ tên <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input className="form-input" placeholder="Họ" value={formData.first_name || ''} onChange={e => {
                                const val = e.target.value;
                                setFormData((prev: any) => ({ ...prev, first_name: val }));
                              }} />
                              <input className="form-input" placeholder="Tên" value={formData.last_name || ''} onChange={e => {
                                const val = e.target.value;
                                setFormData((prev: any) => ({ ...prev, last_name: val }));
                              }} />
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" placeholder="ví dụ: email@congty.com" value={formData.email || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => ({ ...prev, email: val }));
                            }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Số điện thoại chính</label>
                            <input className="form-input" type="tel" placeholder="09xx xxx xxx" value={formData.phone || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => ({ ...prev, phone: val }));
                            }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Số điện thoại phụ</label>
                            <input className="form-input" type="tel" placeholder="08xx xxx xxx" value={formData.mobile || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => ({ ...prev, mobile: val }));
                            }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Ngày sinh</label>
                            <input className="form-input" type="date" value={formData.birthday || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => ({ ...prev, birthday: val }));
                            }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Chức danh</label>
                            <input className="form-input" placeholder="ví dụ: Giám đốc" value={formData.job_title || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => ({ ...prev, job_title: val }));
                            }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Công ty</label>
                            <input className="form-input" placeholder="Tên công ty" value={formData.company_name || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => ({ ...prev, company_name: val }));
                            }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Phòng ban</label>
                            <input className="form-input" placeholder="ví dụ: Kinh doanh" value={formData.department || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => ({ ...prev, department: val }));
                            }} />
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--color-border-light)', margin: '1.25rem 0', paddingTop: '1.25rem' }}></div>

                        {formData.custom_fields && formData.custom_fields.length > 0 && (
                          <>
                            <h4 className="panel-title" style={{ margin: '0 0 1rem 0' }}>Trường tùy chỉnh</h4>
                            <div className="grid grid-2" style={{ marginBottom: '1.25rem' }}>
                              {formData.custom_fields.map((field: any, index: number) => (
                                <div className="form-group" key={field.id}>
                                  <label className="form-label">{field.label} {field.is_required ? <span style={{color: 'var(--color-danger)'}}>*</span> : ''}</label>
                                  {field.field_type === 'text' && (
                                    <input className="form-input" value={field.value || ''} onChange={e => {
                                      const newFields = [...formData.custom_fields];
                                      newFields[index].value = e.target.value;
                                      setFormData({ ...formData, custom_fields: newFields });
                                    }} />
                                  )}
                                  {field.field_type === 'number' && (
                                    <input type="number" className="form-input" value={field.value || ''} onChange={e => {
                                      const newFields = [...formData.custom_fields];
                                      newFields[index].value = e.target.value;
                                      setFormData({ ...formData, custom_fields: newFields });
                                    }} />
                                  )}
                                  {field.field_type === 'date' && (
                                    <input type="date" className="form-input" value={field.value || ''} onChange={e => {
                                      const newFields = [...formData.custom_fields];
                                      newFields[index].value = e.target.value;
                                      setFormData({ ...formData, custom_fields: newFields });
                                    }} />
                                  )}
                                  {field.field_type === 'dropdown' && (
                                    <CustomSelect 
                                      options={(field.options || []).map((o:any) => ({ value: o, label: o }))} 
                                      value={field.value || ''} 
                                      onChange={val => {
                                        const newFields = [...formData.custom_fields];
                                        newFields[index].value = val.toString();
                                        setFormData({ ...formData, custom_fields: newFields });
                                      }} 
                                    />
                                  )}
                                  {field.field_type === 'multiselect' && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.25rem' }}>
                                      {(field.options || []).map((o: any) => {
                                        let selected: string[] = [];
                                        try {
                                          if (typeof field.value === 'string') selected = JSON.parse(field.value);
                                          else if (Array.isArray(field.value)) selected = field.value;
                                        } catch (e: any) { console.error(e); }
                                        const isChecked = selected.includes(o);
                                        return (
                                          <label key={o} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', background: isChecked ? 'var(--color-primary)' : 'var(--color-bg)', padding: '6px 12px', borderRadius: '20px', border: `1px solid ${isChecked ? 'var(--color-primary)' : 'var(--color-border)'}`, transition: 'all 0.2s' }}>
                                            <input type="checkbox" checked={isChecked} onChange={e => {
                                              const newFields = [...formData.custom_fields];
                                              const newSelected = e.target.checked ? [...selected, o] : selected.filter((s: string) => s !== o);
                                              newFields[index].value = newSelected;
                                              setFormData({ ...formData, custom_fields: newFields });
                                            }} style={{ display: 'none' }} />
                                            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: isChecked ? 'white' : 'var(--color-text)' }}>{o}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {field.field_type === 'checkbox' && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '40px' }}>
                                      <CustomCheckbox 
                                        checked={field.value === 'true' || field.value === true} 
                                        onChange={e => {
                                          const newFields = [...formData.custom_fields];
                                          newFields[index].value = e ? 'true' : 'false';
                                          setFormData({ ...formData, custom_fields: newFields });
                                        }} 
                                      />
                                      <span style={{ fontSize: '0.875rem' }}>Có</span>
                                    </label>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div style={{ borderTop: '1px solid var(--color-border-light)', margin: '1.25rem 0', paddingTop: '1.25rem' }}></div>
                          </>
                        )}

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={13} style={{ color: 'var(--color-text-muted)' }} /> Thời gian
                          </label>
                          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text-light)', minWidth: 58 }}>Tạo lúc:</span>
                              <input
                                type="datetime-local"
                                className="form-input sm"
                                style={{ padding: '4px 8px', fontSize: '0.8125rem', width: '240px' }}
                                value={formData.created_at ? formData.created_at.substring(0, 16).replace(' ', 'T') : ''}
                                onChange={e => {
                                  const val = e.target.value.replace('T', ' ') + ':00';
                                  setFormData((prev: any) => ({ ...prev, created_at: val }));
                                }}
                              />
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text-light)', minWidth: 58 }}>Cập nhật:</span>
                              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                                {formatDateTime(formData.updated_at || formData.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px dashed var(--color-border-light)' }}>
                          {!showAddCustomField ? (
                            <button
                              type="button"
                              className="btn outline sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '6px' }}
                              onClick={() => setShowAddCustomField(true)}
                            >
                              <Plus size={14} /> Thêm trường custom
                            </button>
                          ) : (
                            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <h5 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>Thêm trường tùy chỉnh mới</h5>
                              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Tên trường (Key)</label>
                                  <input
                                    type="text"
                                    className="form-input sm"
                                    placeholder="Ví dụ: Sở thích"
                                    value={customFieldKey}
                                    onChange={e => setCustomFieldKey(e.target.value)}
                                    style={{ height: '32px', fontSize: '0.75rem', borderRadius: '6px' }}
                                  />
                                </div>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Giá trị (Value)</label>
                                  <input
                                    type="text"
                                    className="form-input sm"
                                    placeholder="Ví dụ: Bóng đá"
                                    value={customFieldValue}
                                    onChange={e => setCustomFieldValue(e.target.value)}
                                    style={{ height: '32px', fontSize: '0.75rem', borderRadius: '6px' }}
                                  />
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                                <button
                                  type="button"
                                  className="btn ghost sm"
                                  style={{ fontSize: '0.75rem', height: '28px', padding: '0 8px' }}
                                  onClick={() => {
                                    setShowAddCustomField(false);
                                    setCustomFieldKey('');
                                    setCustomFieldValue('');
                                  }}
                                >
                                  Hủy
                                </button>
                                <button
                                  type="button"
                                  className="btn primary sm"
                                  style={{ fontSize: '0.75rem', height: '28px', padding: '0 10px', fontWeight: 600 }}
                                  onClick={handleAddCustomField}
                                >
                                  Thêm
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="card-panel">
                        <h4 className="panel-title">Địa chỉ</h4>
                        <AddressSelect
                          value={formData.address || ''}
                          onChange={addr => setFormData((prev: any) => ({ ...prev, address: addr }))}
                          placeholder="Chọn địa chỉ liên hệ..."
                        />
                      </div>

                      <div className="card-panel">
                        <h4 className="panel-title">Phân loại & Trạng thái Sales</h4>
                        <div className="grid grid-2">
                          <div className="form-group">
                            <label className="form-label">Nguồn khách (Source)</label>
                            <CustomSelect
                              options={[
                                { value: 'website', label: 'Từ Website' },
                                { value: 'facebook', label: 'Facebook Ads' },
                                { value: 'referral', label: 'Giới thiệu' },
                                { value: 'cold_call', label: 'Cold Call' }
                              ]}
                              value={formData.source || 'website'}
                              onChange={val => setFormData((prev: any) => ({ ...prev, source: val as string }))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Dự kiến doanh thu</label>
                            <div style={{ position: 'relative' }}>
                              <input className="form-input" type="number" placeholder="0" style={{ paddingRight: '40px' }} value={formData.expected_revenue || ''} onChange={e => {
                                const val = e.target.value;
                                setFormData((prev: any) => ({ ...prev, expected_revenue: val }));
                              }} />
                              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>VNĐ</span>
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Xác suất chốt (%)</label>
                            <input className="form-input" type="number" min="0" max="100" placeholder="50" value={formData.win_probability || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => ({ ...prev, win_probability: val }));
                            }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Người đang chăm sóc (Sale)</label>
                            {currentUser?.role === 'sale' ? (
                              <div style={{ padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.875rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Avatar src={formData.owner_avatar} name={formData.owner_name} size="sm" />
                                <span>{formData.owner_name || 'Chưa giao'}</span>
                              </div>
                            ) : (
                              <CustomSelect
                                options={users.map(u => ({
                                  value: u.id,
                                  label: u.full_name,
                                  avatar: u.avatar_url,
                                  sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                                }))}
                                value={formData.owner_id || ''}
                                onChange={val => {
                                  const u = users.find(x => x.id === Number(val));
                                  setFormData({ ...formData, owner_id: val, owner_name: u?.full_name || '' });
                                }}
                                placeholder="Chọn sale phụ trách..."
                                searchable
                                showAvatars
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAGS TAB */}
                  {activeTab === 'tags' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TagIcon size={24} />
                        </div>
                        <div>
                          <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-text)', letterSpacing: '-0.01em' }}>Phân loại khách hàng</h3>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)' }}>Sử dụng các thẻ tag để phân nhóm và tối ưu hóa quy trình tìm kiếm.</p>
                        </div>
                      </div>

                      <div className="card-panel" style={{ padding: '1.5rem', background: 'linear-gradient(to bottom right, var(--color-surface), var(--color-bg))', border: '1px solid var(--color-border-light)' }}>
                        <div>
                          <label className="form-label" style={{ fontWeight: 700, marginBottom: '1rem', display: 'block', fontSize: '0.9375rem' }}>Gắn thẻ thông minh</label>
                          <TagInput
                            tags={tags}
                            onChange={setTags}
                            suggestions={allTags.map(t => t.name)}
                            placeholder="Chọn thẻ tag..."
                          />
                          <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', width: '100%', marginBottom: '0.25rem' }}>Gợi ý hệ thống:</span>
                            {allTags.slice(0, 8).map(t => (
                              <button
                                key={t.id}
                                onClick={() => !tags.includes(t.name) && setTags([...tags, t.name])}
                                className="btn ghost sm"
                                style={{ borderRadius: '10px', fontSize: '0.75rem', padding: '4px 12px', border: '1px dashed var(--color-border)' }}
                              >
                                + {t.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* COOPERATION TAB (Module 4) */}
                  {activeTab === 'cooperation' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                        <div>
                          <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-text)', letterSpacing: '-0.01em', marginBottom: '0.25rem' }}>Phân chia hợp tác & Hoa hồng</h3>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Quản lý tỷ lệ chia sẻ doanh thu và ký xác nhận giữa các nhân viên hỗ trợ khách hàng.</p>
                        </div>
                      </div>

                      {coopLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--color-primary)' }} />
                        </div>
                      ) : coopError ? (
                        <div className="card-panel error" style={{ padding: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <AlertCircle size={20} />
                          <span>{coopError}</span>
                        </div>
                      ) : !coopSlip ? (
                        <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                          <Users size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                          <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa thiết lập hợp tác</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '320px', margin: '0 auto 1.5rem' }}>
                            Khách hàng này chưa có cấu hình phiếu phân chia hoa hồng. Bắt đầu thiết lập để phân chia tỷ lệ doanh thu.
                          </p>
                          <button className="btn primary" onClick={handleCreateCoopSlip}>
                            <Plus size={16} /> Thiết lập hợp tác hoa hồng
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {/* Status and summary */}
                          {(() => {
                            const status = coopSlip.status;
                            let bg = 'var(--color-bg-light)';
                            let border = '1px solid var(--color-border)';
                            let leftBorder = '4px solid var(--color-text-muted)';
                            let statusIcon = <Clock size={18} style={{ color: 'var(--color-text-muted)' }} />;
                            let statusTitle = 'Chưa xác định';
                            let statusDesc = 'Phiếu hợp tác đang trong quá trình xử lý.';
                            let badgeClass = 'warning';

                            if (status === 'approved') {
                              bg = 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0.08) 100%)';
                              border = '1px solid rgba(16, 185, 129, 0.15)';
                              leftBorder = '4px solid #10b981';
                              statusIcon = <CheckCircle2 size={18} style={{ color: '#10b981' }} />;
                              statusTitle = 'Đã phê duyệt';
                              statusDesc = 'Phiếu hợp tác đã được xác nhận hiệu lực & hoa hồng.';
                              badgeClass = 'success';
                            } else if (status === 'pending_manager_approval') {
                              bg = 'linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, rgba(245, 158, 11, 0.08) 100%)';
                              border = '1px solid rgba(245, 158, 11, 0.2)';
                              leftBorder = '4px solid #f59e0b';
                              statusIcon = <Clock size={18} style={{ color: '#f59e0b', animation: 'pulse 2s infinite' }} />;
                              statusTitle = 'Chờ phê duyệt';
                              statusDesc = 'Đang chờ Quản lý hoặc Giám đốc kinh doanh duyệt.';
                              badgeClass = 'warning';
                            } else if (status === 'rejected') {
                              bg = 'linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, rgba(239, 68, 68, 0.08) 100%)';
                              border = '1px solid rgba(239, 68, 68, 0.15)';
                              leftBorder = '4px solid #ef4444';
                              statusIcon = <AlertCircle size={18} style={{ color: '#ef4444' }} />;
                              statusTitle = 'Bị từ chối';
                              statusDesc = 'Phiếu hợp tác bị từ chối phê duyệt.';
                              badgeClass = 'danger';
                            } else {
                              bg = 'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(99, 102, 241, 0.08) 100%)';
                              border = '1px solid rgba(99, 102, 241, 0.15)';
                              leftBorder = '4px solid #6366f1';
                              statusIcon = <PenTool size={18} style={{ color: '#6366f1' }} />;
                              statusTitle = 'Chờ ký xác nhận';
                              statusDesc = 'Đang chờ các thành viên liên quan ký xác nhận.';
                              badgeClass = 'info';
                            }

                            return (
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                padding: '1.25rem 1.5rem', 
                                background: bg, 
                                borderRadius: '12px', 
                                border: border,
                                borderLeft: leftBorder,
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                                transition: 'all 0.3s ease'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: 'var(--color-bg-light)',
                                    border: '1px solid var(--color-border-light)',
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
                                  }}>
                                    {statusIcon}
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>{statusTitle}</span>
                                      <span className={`badge ${badgeClass}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                                        {status === 'approved' ? 'Hiệu lực' : 
                                         status === 'rejected' ? 'Bị từ chối' : 
                                         status === 'pending_manager_approval' ? 'Chờ duyệt' : 'Chờ ký'}
                                      </span>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                      {statusDesc}
                                    </p>
                                  </div>

                                  {status === 'pending_manager_approval' && isAdmin && (
                                    <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                                      <button 
                                        className="btn primary sm" 
                                        onClick={async () => {
                                          if (window.confirm('Bạn có chắc chắn muốn duyệt phiếu hợp tác này không?')) {
                                            try {
                                              await api.post(`/cooperation-slips/${coopSlip.id}/approve`);
                                              addToast('Đã phê duyệt phiếu hợp tác thành công!', 'success');
                                              await fetchCoopSlip();
                                            } catch (err: any) {
                                              addToast(err.response?.data?.message || 'Lỗi khi duyệt phiếu', 'error');
                                            }
                                          }
                                        }}
                                        style={{ padding: '4px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}
                                      >
                                        <Check size={12} /> Duyệt
                                      </button>
                                      <button 
                                        className="btn outline sm text-danger" 
                                        onClick={async () => {
                                          const reason = window.prompt('Nhập lý do từ chối phiếu hợp tác:');
                                          if (reason === null) return;
                                          try {
                                            await api.post(`/cooperation-slips/${coopSlip.id}/reject`, { reason });
                                            addToast('Đã từ chối phiếu hợp tác thành công!', 'success');
                                            await fetchCoopSlip();
                                          } catch (err: any) {
                                            addToast(err.response?.data?.message || 'Lỗi khi từ chối phiếu', 'error');
                                          }
                                        }}
                                        style={{ padding: '4px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'var(--color-danger)', borderRadius: '8px' }}
                                      >
                                        <X size={12} /> Từ chối
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 700, 
                                    color: 'var(--color-primary)', 
                                    background: 'var(--color-primary-light)', 
                                    padding: '4px 8px', 
                                    borderRadius: '6px' 
                                  }}>
                                    Phiên bản: {coopSlip.version}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}

                          {coopSlip.dispute_details && (
                            <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: '12px', fontSize: '0.875rem' }}>
                              <strong>Lý do từ chối:</strong> {coopSlip.dispute_details}
                            </div>
                          )}

                          {/* Cooperation Slip Attachment */}
                          <div className="card-panel" style={{ padding: '1.5rem' }}>
                            <h4 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Paperclip size={18} /> Tài liệu hợp tác đính kèm
                            </h4>
                            {coopSlip.attachment_url ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--color-bg-light)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {coopSlip.attachment_url.toLowerCase().endsWith('.pdf') ? (
                                    <FileText size={24} style={{ color: '#ef4444' }} />
                                  ) : (coopSlip.attachment_url.toLowerCase().endsWith('.doc') || coopSlip.attachment_url.toLowerCase().endsWith('.docx')) ? (
                                    <FileText size={24} style={{ color: '#3b82f6' }} />
                                  ) : (
                                    <Camera size={24} style={{ color: '#10b981' }} />
                                  )}
                                  <div>
                                    <a href={resolveAttachmentUrl(coopSlip.attachment_url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'underline' }}>
                                      Xem tài liệu hợp tác
                                    </a>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                      {coopSlip.attachment_url.split('/').pop()}
                                    </p>
                                  </div>
                                </div>
                                {isOwnerOrAdmin && (
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <button className="btn-icon sm" title="Đổi tên" onClick={async () => {
                                      const filename = coopSlip.attachment_url.split('/').pop() || '';
                                      const cleanName = filename.substring(0, filename.lastIndexOf('.')) || filename;
                                      const newName = prompt('Nhập tên mới cho tài liệu hợp tác:', cleanName);
                                      if (newName && newName.trim()) {
                                        try {
                                          await api.post(`/cooperation-slips/${coopSlip.id}/rename-attachment`, { name: newName.trim() });
                                          await fetchCoopSlip();
                                          addToast('Đã đổi tên tài liệu hợp tác.', 'success');
                                        } catch (err) {
                                          addToast('Lỗi khi đổi tên tài liệu.', 'error');
                                        }
                                      }
                                    }}>
                                      <Pencil size={14} />
                                    </button>
                                    <button className="btn-icon sm text-danger" title="Xóa" onClick={handleRemoveCoopAttachment}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                                  Chưa có tài liệu/hợp đồng đính kèm cho phiếu này.
                                </p>
                                {isOwnerOrAdmin && (
                                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <input
                                      type="file"
                                      id="coop-attachment-upload"
                                      style={{ display: 'none' }}
                                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
                                      onChange={handleCoopAttachmentUpload}
                                    />
                                    <label htmlFor="coop-attachment-upload" className="btn outline sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                      <Upload size={14} /> Tải tài liệu đính kèm
                                    </label>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Shareholder Management */}
                          <div className="card-panel" style={{ padding: '1.5rem' }}>
                            <h4 style={{ fontWeight: 700, marginBottom: '1.25rem', fontSize: '1rem' }}>Danh sách phân chia hoa hồng</h4>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                              {coopShares.map((share, idx) => {
                                const isSigned = coopSlip.shareholders?.find((s: any) => String(s.user_id) === share.user_id)?.signed;

                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                      flex: 1,
                                      pointerEvents: (coopSlip.status !== 'pending_signatures' && coopSlip.status !== 'rejected' && !isRequestingChange) ? 'none' : 'auto',
                                      opacity: (coopSlip.status !== 'pending_signatures' && coopSlip.status !== 'rejected') ? 0.6 : 1
                                    }}>
                                      <CustomSelect
                                        value={share.user_id}
                                        onChange={(val) => {
                                          const newShares = [...coopShares];
                                          newShares[idx].user_id = val;
                                          setCoopShares(newShares);
                                        }}
                                        options={[
                                          { value: '', label: '-- Chọn nhân sự --' },
                                          ...salesUsers
                                            .filter(u => String(u.id) !== String(currentUser?.consultant_id) && String(u.id) !== String(currentUser?.id))
                                            .filter(u => {
                                              if (String(u.id) === String(share.user_id)) return true;
                                              return !coopShares.some((other, otherIdx) => otherIdx !== idx && String(other.user_id) === String(u.id));
                                            })
                                            .map(u => ({ value: String(u.id), label: u.full_name, sublabel: u.email, avatar: u.avatar }))
                                        ]}
                                        showAvatars
                                        searchable
                                      />
                                    </div>
                                    <div style={{ width: '120px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <input
                                        type="number"
                                        className="form-control"
                                        value={share.percentage}
                                        min="0"
                                        max="100"
                                        onChange={(e) => {
                                          const newShares = [...coopShares];
                                          newShares[idx].percentage = e.target.value;
                                          setCoopShares(newShares);
                                        }}
                                        disabled={coopSlip.status !== 'pending_signatures' && coopSlip.status !== 'rejected' && !isRequestingChange}
                                        style={{ textAlign: 'right' }}
                                      />
                                      <span style={{ fontWeight: 600 }}>%</span>
                                    </div>
                                    {(coopSlip.status === 'pending_signatures' || coopSlip.status === 'rejected' || isRequestingChange) ? (
                                      <button 
                                        className="btn ghost text-danger sm" 
                                        onClick={() => setCoopShares(prev => prev.filter((_, i) => i !== idx))}
                                        style={{ padding: '8px' }}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    ) : (
                                      <div style={{ width: '40px', display: 'flex', justifyContent: 'center' }} title={isSigned ? "Đã ký xác nhận" : "Chờ ký"}>
                                        {isSigned ? (
                                          <CheckCircle2 size={18} color="#10b981" />
                                        ) : (
                                          <Clock size={18} color="#f59e0b" />
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Actions to Add New Shareholder or Save */}
                            {isRequestingChange && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '1rem' }}>
                                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Lý do thay đổi / Yêu cầu điều chỉnh</label>
                                <textarea
                                  placeholder="VD: Bổ sung thêm sale tư vấn hoặc điều chỉnh lại tỷ lệ..."
                                  value={changeReason}
                                  onChange={e => setChangeReason(e.target.value)}
                                  className="form-control"
                                  style={{ fontSize: '0.8rem', padding: '8px 12px', height: '60px', resize: 'vertical' }}
                                  required
                                />
                              </div>
                            )}

                            {(coopSlip.status === 'pending_signatures' || coopSlip.status === 'rejected' || isRequestingChange) ? (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button 
                                  className="btn outline sm"
                                  onClick={() => setCoopShares(prev => [...prev, { user_id: '', percentage: '0' }])}
                                >
                                  <Plus size={14} /> Thêm nhân sự
                                </button>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {isRequestingChange && (
                                    <button 
                                      className="btn outline sm"
                                      onClick={() => {
                                        setIsRequestingChange(false);
                                        setChangeReason('');
                                      }}
                                    >
                                      Hủy bỏ
                                    </button>
                                  )}
                                  <button 
                                    className="btn primary sm"
                                    onClick={handleSaveCoopShares}
                                  >
                                    {isRequestingChange ? 'Gửi yêu cầu thay đổi' : 'Lưu tỷ lệ mới'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              (coopSlip.status === 'approved' || coopSlip.status === 'pending_manager_approval') && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <button 
                                    className="btn outline sm"
                                    onClick={() => setIsRequestingChange(true)}
                                    style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                                  >
                                    Yêu cầu thay đổi tỷ lệ
                                  </button>
                                </div>
                              )
                            )}
                          </div>

                          {/* Signature section */}
                          {coopSlip.status === 'pending_signatures' && coopSlip.shareholders?.some((s: any) => String(s.user_id) === String(currentUser?.id) && !s.signed) && (
                            <div className="card-panel" style={{ padding: '1.5rem', background: 'rgba(189, 29, 45, 0.1)', border: '1px solid #BD1D2D' }}>
                              <h4 style={{ fontWeight: 700, color: '#BD1D2D', marginBottom: '0.5rem' }}>Bạn có yêu cầu ký xác nhận</h4>
                              <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--color-text)' }}>
                                Bạn là một bên trong phiếu hợp tác này. Vui lòng ký xác nhận tỷ lệ chia sẻ hoa hồng.
                              </p>
                              <button className="btn primary" onClick={handleSignCoopSlip}>
                                <PenTool size={16} /> Ký xác nhận
                              </button>
                            </div>
                          )}

                          {/* Shareholders signatures list */}
                          <div className="card-panel" style={{ padding: '1.5rem' }}>
                            <h4 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '1rem' }}>Bảng chữ ký và tỷ lệ</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {coopSlip.shareholders?.map((sh: any) => (
                                <div key={sh.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--color-border-light)' }}>
                                  <div>
                                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sh.name}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{sh.email}</p>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>{sh.percentage}%</span>
                                    {sh.signed ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.8125rem', fontWeight: 600 }}>
                                        <CheckCircle2 size={16} /> Đã ký ({new Date(sh.signature_time).toLocaleDateString('vi-VN')})
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '0.8125rem', fontWeight: 600 }}>
                                        <Clock size={16} /> Chờ ký
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TIMELINE TAB */}
                  {activeTab === 'timeline' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                        <div>
                          <h3 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.25rem' }}>Nhật ký tương tác</h3>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Lưu vết toàn bộ quá trình chăm sóc khách hàng</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn outline sm" onClick={() => setShowCallLogger(true)} style={{ color: '#3b82f6', borderColor: '#3b82f630', background: '#3b82f608', fontWeight: 600 }}><Phone size={14} /> Log Call</button>
                          <button className="btn outline sm" onClick={() => setShowActivityModal(true)} style={{ color: '#BD1D2D', borderColor: '#BD1D2D30', background: '#BD1D2D08', fontWeight: 600 }}><Mail size={14} /> Email</button>
                          <button className="btn outline sm" onClick={() => {
                            const today = new Date().toISOString().slice(0, 10);
                            setTaskForm({
                              title: '',
                              priority: 'medium',
                              due_date: today,
                              description: '',
                              link: '',
                              user_id: String(contact?.owner_id || currentUser?.id || '')
                            });
                            setShowTaskModal(true);
                          }} style={{ color: '#f59e0b', borderColor: '#f59e0b30', background: '#f59e0b08', fontWeight: 600 }}><CheckSquare size={14} /> Task</button>
                          <button className="btn primary sm" onClick={() => setShowActivityModal(true)} style={{ fontWeight: 600 }}><Plus size={14} /> Tương tác</button>
                        </div>
                      </div>

                      <div className="timeline-stepper" style={{ position: 'relative', marginTop: '1rem', marginLeft: '0.5rem', paddingBottom: '1.5rem' }}>
                        <div style={{ position: 'absolute', left: 18, top: 10, bottom: 0, width: 2, background: 'linear-gradient(to bottom, var(--color-border) 0%, rgba(0,0,0,0) 100%)' }} />

                        {timeline.map((ev: any, index) => (
                          <motion.div
                            key={ev.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', position: 'relative' }}
                          >
                            {/* Step Node */}
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${ev.color}15`, border: `2px solid ${ev.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, backgroundColor: 'var(--color-surface)', boxShadow: `0 0 0 4px var(--color-bg)` }}>
                              <div style={{ color: ev.color, display: 'flex' }}>{ev.icon}</div>
                            </div>

                            {/* Step Content */}
                            <div
                              style={{ flex: 1, padding: '1rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s', cursor: 'default' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = ev.color; e.currentTarget.style.transform = 'translateX(4px)'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-light)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                <div>
                                  <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '0.25rem' }}>{ev.title}</h4>
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: ev.color, background: `${ev.color}15`, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>{ev.type.toUpperCase()}</span>
                                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      Thực hiện bởi <Avatar name={ev.user} size="sm" /> <strong>{ev.user}</strong>
                                    </span>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{new Date(ev.time).toLocaleDateString('vi-VN')}</span>
                                    <button
                                      className="btn ghost sm"
                                      style={{ padding: '2px', height: '24px', width: '24px', color: 'var(--color-danger)', opacity: 0.5 }}
                                      onClick={(e) => { e.stopPropagation(); deleteActivity(ev.id); }}
                                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                      onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{new Date(ev.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                              </div>
                              {(ev.note || ev.expense_image_url) && (() => {
                                const linkMatch = ev.note ? ev.note.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m) : null;
                                const hasLink = !!linkMatch || !!ev.expense_image_url;
                                const linkUrl = linkMatch ? linkMatch[1].trim() : (ev.expense_image_url || '');
                                const displayNoteText = linkMatch ? ev.note.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim() : (ev.note || '');

                                return (
                                  <div style={{ padding: '0.875rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', marginTop: '0.5rem', border: '1px solid var(--color-border-light)' }}>
                                    {displayNoteText && (
                                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', lineHeight: 1.6 }}>{formatNote(displayNoteText)}</p>
                                    )}

                                    {linkUrl && (
                                      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                        {/\.(jpg|jpeg|png|gif|webp)$/i.test(linkUrl) ? (
                                          <Camera size={14} style={{ color: '#10b981' }} />
                                        ) : (
                                          <FileText size={14} style={{ color: 'var(--color-primary)' }} />
                                        )}
                                        <a
                                          href={resolveAttachmentUrl(linkUrl)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline' }}
                                        >
                                          {linkUrl.split('/').pop()}
                                        </a>
                                      </div>
                                    )}
                                  
                                  {/* Rich Metadata Rendering */}
                                  {ev.type === 'call' && (ev as any).metadata?.recording_url && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <button className="btn-icon sm" style={{ background: 'var(--color-primary)', color: 'white' }}><Activity size={14} /></button>
                                      <div style={{ flex: 1, height: '4px', background: '#e2e8f0', borderRadius: '2px', position: 'relative' }}>
                                        <div style={{ width: '60%', height: '100%', background: 'var(--color-primary)', borderRadius: '2px' }} />
                                      </div>
                                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{(ev as any).metadata.duration || '0:00'}</span>
                                    </div>
                                  )}

                                  {ev.type === 'email' && (ev as any).metadata?.email_subject && (
                                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                                      <span className="badge info" style={{ fontSize: '0.65rem' }}>{(ev as any).metadata.status === 'opened' ? 'Đã mở' : 'Đã gửi'}</span>
                                      <span style={{ color: 'var(--color-text-muted)' }}>{(ev as any).metadata.opens || 0} lượt mở • Lần cuối: {new Date((ev as any).metadata.last_open).toLocaleTimeString('vi-VN')}</span>
                                    </div>
                                  )}

                                  {ev.type === 'meeting' && (ev as any).metadata?.zoom_link && (
                                    <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                      <a href={(ev as any).metadata.zoom_link} target="_blank" rel="noreferrer" className="btn outline sm" style={{ fontSize: '0.7rem', height: '28px', padding: '0 8px' }}>Tham gia Zoom</a>
                                      <div style={{ display: 'flex', gap: '-4px' }}>
                                        {((ev as any).metadata.participants || []).map((p: string, pi: number) => (
                                          <Avatar key={pi} name={p} size={20} style={{ border: '2px solid white' }} />
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  </div>
                                );
                              })()}
                              <ActivityComments activityId={ev.id} initialCount={Number(ev.comment_count) || 0} />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SCORING TAB */}
                  {activeTab === 'scoring' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                          <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Lead Scoring Engine</h3>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Chi tiết hệ thống tự động chấm điểm khách hàng tiềm năng</p>
                        </div>
                      </div>

                      {(() => {
                        return (
                          <div className="card-panel">
                            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', alignItems: 'center', padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)' }}>
                              <LeadScoreRing score={score} size={80} />
                              <div>
                                <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Tổng điểm: {score}/100</h4>
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                  Khách hàng này đang ở mức <strong>{score >= 80 ? 'Rất Nóng' : score >= 50 ? 'Tiềm Năng' : 'Lạnh'}</strong>.
                                  Hệ thống tự động phân tích dựa trên {rules.length} tiêu chí.
                                </p>
                              </div>
                            </div>

                            <h4 style={{ fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>Phân tích điểm chi tiết</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {rules.map((r, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)' }}>
                                  <div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: r.type === 'Demographic' ? '#3b82f6' : '#BD1D2D', background: r.type === 'Demographic' ? '#3b82f615' : '#BD1D2D15', padding: '2px 8px', borderRadius: '12px', marginRight: '8px' }}>
                                      {r.type}
                                    </span>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.rule}</span>
                                  </div>
                                  <span style={{ fontWeight: 700, color: '#10b981' }}>+{r.pts} pts</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* TTL1 VERIFICATION TAB */}
                  {activeTab === 'ttl1' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                          <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Form xác minh điều kiện gặp (TTL1)</h3>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            Yêu cầu đạt tối thiểu <strong>4/5 nhóm thông tin</strong> để chuyển sang giai đoạn Đồng Ý Gặp hoặc cao hơn.
                          </p>
                        </div>
                      </div>

                      <div className="card-panel" style={{ padding: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                          
                          {/* Group 1 */}
                          <label style={{ display: 'flex', gap: '12px', cursor: 'pointer', alignItems: 'flex-start' }}>
                            <CustomCheckbox
                              checked={ttl1Data.group1}
                              onChange={(e) => setTtl1Data(p => ({ ...p, group1: e.target.checked }))}
                            />
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhóm 1: Nhân khẩu học (Demographics)</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Có đầy đủ Họ tên, Ngày sinh, Nghề nghiệp và thông tin liên hệ chính thống.</p>
                            </div>
                          </label>

                          {/* Group 2 */}
                          <label style={{ display: 'flex', gap: '12px', cursor: 'pointer', alignItems: 'flex-start' }}>
                            <CustomCheckbox
                              checked={ttl1Data.group2}
                              onChange={(e) => setTtl1Data(p => ({ ...p, group2: e.target.checked }))}
                            />
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhóm 2: Khả năng tài chính (Financial Readiness)</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Xác định nguồn ngân sách đầu tư rõ ràng, có khả năng chứng minh vốn tự có hoặc bảo lãnh vay.</p>
                            </div>
                          </label>

                          {/* Group 3 */}
                          <label style={{ display: 'flex', gap: '12px', cursor: 'pointer', alignItems: 'flex-start' }}>
                            <CustomCheckbox
                              checked={ttl1Data.group3}
                              onChange={(e) => setTtl1Data(p => ({ ...p, group3: e.target.checked }))}
                            />
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhóm 3: Mức độ cấp thiết (Urgency)</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Nhu cầu mua hàng thật sự, có lộ trình ra quyết định trong thời hạn 1 - 3 tháng tới.</p>
                            </div>
                          </label>

                          {/* Group 4 */}
                          <label style={{ display: 'flex', gap: '12px', cursor: 'pointer', alignItems: 'flex-start' }}>
                            <CustomCheckbox
                              checked={ttl1Data.group4}
                              onChange={(e) => setTtl1Data(p => ({ ...p, group4: e.target.checked }))}
                            />
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhóm 4: Mức độ phù hợp với dự án (Project Fit)</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Dòng sản phẩm của dự án phù hợp với yêu cầu diện tích, vị trí và mục tiêu sinh lời của khách hàng.</p>
                            </div>
                          </label>

                          {/* Group 5 */}
                          <label style={{ display: 'flex', gap: '12px', cursor: 'pointer', alignItems: 'flex-start' }}>
                            <CustomCheckbox
                              checked={ttl1Data.group5}
                              onChange={(e) => setTtl1Data(p => ({ ...p, group5: e.target.checked }))}
                            />
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhóm 5: Vai trò quyết định (Decision Role)</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Xác định người đứng tên cọc/hợp đồng hoặc có vai trò quyết định mua hàng cuối cùng.</p>
                            </div>
                          </label>
                          


                        </div>

                        {/* Status Summary & Action */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', paddingTop: '1.25rem', marginTop: '1.5rem' }}>
                          <div>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                              Tổng điều kiện đạt: <strong>{Object.values(ttl1Data).filter(Boolean).length}/5</strong>
                            </span>
                            <span style={{
                              marginLeft: '12px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                              background: Object.values(ttl1Data).filter(Boolean).length >= 4 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: Object.values(ttl1Data).filter(Boolean).length >= 4 ? '#059669' : '#dc2626'
                            }}>
                              {Object.values(ttl1Data).filter(Boolean).length >= 4 ? 'Đủ điều kiện chuyển giai đoạn' : 'Chưa đủ điều kiện'}
                            </span>
                          </div>
                          <button
                            className="btn primary sm"
                            onClick={() => handleSaveTTL1(ttl1Data)}
                            disabled={isSavingTTL1}
                          >
                            {isSavingTTL1 ? 'Đang lưu...' : 'Lưu Form TTL1'}
                          </button>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* DEALS TAB */}
                  {activeTab === 'deals' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Cơ hội (Deals) - {deals.length}</h3>
                        <button className="btn primary sm" onClick={() => {
                          const initialStage = stages[0]?.id?.toString() || 'lead';
                          setDealForm({ title: '', value: '', stage: initialStage, probability: 50, expected_close: '', description: '', priority: 'medium' });
                          setEditingDealId(null);
                          setShowDealModal(true);
                        }}><Plus size={14} /> Tạo deal mới</button>
                      </div>
                      {deals.length === 0 ? (
                        <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                          <Activity size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                          <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa có cơ hội</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '240px', margin: '0 auto' }}>Đang không có cơ hội kinh doanh nào đang mở cho khách hàng này.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                          {deals.map((d: any) => {
                            const wonStage = stages.find((s: any) => s.is_won === 1 || s.is_won === true);
                            const lostStage = stages.find((s: any) => s.is_lost === 1 || s.is_lost === true);
                            const isWon = wonStage && Number(d.stage_id) === Number(wonStage.id);
                            const isLost = lostStage && Number(d.stage_id) === Number(lostStage.id);
                            
                            return (
                              <div key={d.id} className="card-panel" style={{ padding: 0, overflow: 'hidden', border: `1px solid var(--color-border)`, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', borderRadius: '16px' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--color-surface)' }}>
                                  <div>
                                    <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>{d.title}</h4>
                                    <span className="badge" style={{ background: `${d.stage_color}15`, color: d.stage_color, fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '8px' }}>{d.stage}</span>
                                  </div>
                                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1rem', letterSpacing: '-0.01em' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(d.value || 0)}</span>
                                      <button 
                                        className="btn-icon sm" 
                                        title="Chỉnh sửa" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDealForm({
                                            title: d.title,
                                            value: String(d.value || ''),
                                            stage: d.stage_id ? d.stage_id.toString() : 'lead',
                                            probability: d.prob || 50,
                                            expected_close: d.close || '',
                                            description: d.description || '',
                                            priority: d.priority || 'medium'
                                          });
                                          setEditingDealId(d.id);
                                          setShowDealModal(true);
                                        }}
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        className="btn-icon sm text-danger"
                                        style={{ opacity: 0.4, transition: 'opacity 0.2s', padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                        onClick={(e) => { e.stopPropagation(); deleteDeal(d.id); }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                    {(!isWon && !isLost) && (
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          style={{
                                            fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px',
                                            background: '#e6f4ea', color: '#137333',
                                            border: '1px solid #137333', fontWeight: 700, cursor: 'pointer'
                                          }}
                                          onClick={async () => {
                                            if (!wonStage) {
                                              addToast('Không tìm thấy giai đoạn Đóng deal', 'error');
                                              return;
                                            }
                                            try {
                                              await api.patch(`/deals/${d.id}/stage`, { stage_id: wonStage.id });
                                              addToast('Đã chốt cơ hội thành công!', 'success');
                                              fetchData();
                                            } catch (err: any) {
                                              addToast(err.response?.data?.message || 'Lỗi khi chốt cơ hội', 'error');
                                            }
                                          }}
                                        >
                                          Chốt
                                        </button>
                                        <button
                                          type="button"
                                          style={{
                                            fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px',
                                            background: '#fce8e6', color: '#c5221f',
                                            border: '1px solid #c5221f', fontWeight: 700, cursor: 'pointer'
                                          }}
                                          onClick={async () => {
                                            if (!lostStage) {
                                              addToast('Không tìm thấy giai đoạn Thất bại/Từ chối', 'error');
                                              return;
                                            }
                                            try {
                                              await api.patch(`/deals/${d.id}/stage`, { stage_id: lostStage.id });
                                              addToast('Đã từ chối cơ hội', 'warning');
                                              fetchData();
                                            } catch (err: any) {
                                              addToast(err.response?.data?.message || 'Lỗi khi từ chối cơ hội', 'error');
                                            }
                                          }}
                                        >
                                          Từ chối
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div style={{ padding: '1rem 1.5rem', background: 'linear-gradient(to right, var(--color-bg), var(--color-surface))', borderTop: '1px solid var(--color-border-light)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>
                                    <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={14} /> Xác suất chốt</span>
                                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{d.prob}%</span>
                                  </div>
                                  <div style={{ height: 8, background: 'var(--color-border-light)', borderRadius: 4, overflow: 'hidden', marginBottom: '1.25rem' }}>
                                    <div style={{ width: `${d.prob}%`, height: '100%', background: `linear-gradient(90deg, ${d.stage_color}88 0%, ${d.stage_color} 100%)`, borderRadius: 4 }} />
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                                    <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> Ngày dự kiến</span>
                                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{d.close && d.close !== '0000-00-00' ? new Date(d.close).toLocaleDateString('vi-VN') : 'Chưa thiết lập'}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TASKS TAB */}
                  {activeTab === 'tasks' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Công việc cần làm</h3>
                        <button className="btn primary sm" onClick={() => {
                          const today = new Date().toISOString().slice(0, 10);
                          setTaskForm({
                            title: '',
                            priority: 'medium',
                            due_date: today,
                            description: '',
                            link: '',
                            user_id: String(contact?.owner_id || currentUser?.id || '')
                          });
                          setShowTaskModal(true);
                        }}><Plus size={14} /> Thêm công việc</button>
                      </div>

                      {tasks.length === 0 ? (
                        <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                          <CheckSquare size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                          <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa có công việc</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '240px', margin: '0 auto' }}>Bắt đầu bằng việc thêm một công việc mới để quản lý tiến độ với khách hàng.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {tasks.map(t => (
                            <div
                              key={t.id}
                              className="card-panel"
                              onClick={() => toggleTaskDone(t.id, t.done)}
                              style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', opacity: t.done ? 0.6 : 1, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid transparent' }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary-light)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                            >
                              <div style={{ width: 24, height: 24, borderRadius: '6px', border: `2px solid ${t.done ? 'var(--color-success)' : 'var(--color-border)'}`, background: t.done ? 'var(--color-success)' : 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                                {t.done && <CheckSquare size={14} />}
                              </div>
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: '0.9375rem', fontWeight: 600, textDecoration: t.done ? 'line-through' : 'none', color: 'var(--color-text)' }}>{t.title}</p>
                                {t.description && (
                                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{t.description}</p>
                                )}
                                {t.link && (
                                  <div style={{ marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }} onClick={e => e.stopPropagation()}>
                                    <Paperclip size={13} style={{ color: 'var(--color-primary)' }} />
                                    <a 
                                      href={resolveAttachmentUrl(t.link)} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'underline' }}
                                    >
                                      {t.link.includes('uploads/') ? t.link.split('/').pop().replace(/^\d+_/, '') : t.link}
                                    </a>
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.375rem' }}>
                                  <span className={`badge ${t.priority === 'high' ? 'danger' : 'warning'}`} style={{ fontSize: '0.7rem' }}>{t.priority === 'high' ? 'Ưu tiên cao' : 'Trung bình'}</span>
                                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Hạn hoàn thành: {t.due}</span>
                                </div>
                              </div>
                              <button
                                className="btn-icon sm text-danger"
                                style={{ opacity: 0.4, transition: 'opacity 0.2s' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showConfirm(
                                    'Xóa công việc?',
                                    `Bạn có chắc chắn muốn xóa công việc "${t.title}"?`,
                                    async () => {
                                      try {
                                        await api.delete(`/activities/${t.id}`);
                                        setTasks(prev => prev.filter(x => x.id !== t.id));
                                        addToast('Đã xóa công việc thành công', 'success');
                                      } catch (err: any) {
                                        addToast(err.response?.data?.message || 'Lỗi khi xóa công việc', 'error');
                                      }
                                    }
                                  );
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* NOTES TAB */}
                  {activeTab === 'notes' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Ghi chú nội bộ</h3>
                      </div>
                      <div className="card-panel animate-fade" style={{ marginBottom: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        {/* 1. Channel & Type Row */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                          {/* Channel Select */}
                          <div style={{ flex: '1 0 200px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '6px' }}>Kênh tương tác (Nối)</label>
                            <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '2px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                              <button
                                type="button"
                                onClick={() => setNoteChannel('text')}
                                style={{
                                  flex: 1, padding: '6px 10px', fontSize: '0.75rem', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer',
                                  background: noteChannel === 'text' ? 'var(--color-surface)' : 'transparent',
                                  color: noteChannel === 'text' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  boxShadow: noteChannel === 'text' ? 'var(--shadow-sm)' : 'none',
                                  transition: 'all 0.2s'
                                }}
                              >
                                📝 Nối Đất
                              </button>
                              <button
                                type="button"
                                onClick={() => setNoteChannel('call')}
                                style={{
                                  flex: 1, padding: '6px 10px', fontSize: '0.75rem', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer',
                                  background: noteChannel === 'call' ? 'var(--color-surface)' : 'transparent',
                                  color: noteChannel === 'call' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  boxShadow: noteChannel === 'call' ? 'var(--shadow-sm)' : 'none',
                                  transition: 'all 0.2s'
                                }}
                              >
                                📞 Nối Đồng
                              </button>
                              <button
                                type="button"
                                onClick={() => setNoteChannel('meet')}
                                style={{
                                  flex: 1, padding: '6px 10px', fontSize: '0.75rem', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer',
                                  background: noteChannel === 'meet' ? 'var(--color-surface)' : 'transparent',
                                  color: noteChannel === 'meet' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  boxShadow: noteChannel === 'meet' ? 'var(--shadow-sm)' : 'none',
                                  transition: 'all 0.2s'
                                }}
                              >
                                🤝 Nối Áp Suất
                              </button>
                            </div>
                          </div>

                          {/* Interaction Type Select */}
                          <div style={{ flex: '1 0 150px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '6px' }}>Loại tương tác</label>
                            <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '2px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                              <button
                                type="button"
                                onClick={() => setNoteType('normal')}
                                style={{
                                  flex: 1, padding: '6px 10px', fontSize: '0.75rem', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer',
                                  background: noteType === 'normal' ? 'var(--color-surface)' : 'transparent',
                                  color: noteType === 'normal' ? 'var(--color-text)' : 'var(--color-text-muted)',
                                  boxShadow: noteType === 'normal' ? 'var(--shadow-sm)' : 'none',
                                  transition: 'all 0.2s'
                                }}
                              >
                                Thường
                              </button>
                              <button
                                type="button"
                                onClick={() => setNoteType('quality')}
                                style={{
                                  flex: 1, padding: '6px 10px', fontSize: '0.75rem', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer',
                                  background: noteType === 'quality' ? 'var(--color-surface)' : 'transparent',
                                  color: noteType === 'quality' ? 'var(--color-success)' : 'var(--color-text-muted)',
                                  boxShadow: noteType === 'quality' ? 'var(--shadow-sm)' : 'none',
                                  transition: 'all 0.2s'
                                }}
                              >
                                Chất lượng
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 2. Optional Fields (Call Duration, Documents Sent) */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                          {noteChannel === 'call' && (
                            <div style={{ flex: '1 0 150px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '6px' }}>Thời lượng cuộc gọi (giây)</label>
                              <input
                                type="number"
                                className="form-input"
                                placeholder="Ví dụ: 45"
                                value={noteDuration}
                                onChange={e => setNoteDuration(e.target.value)}
                                style={{ height: '38px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.8125rem', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                              />
                            </div>
                          )}

                          <div style={{ flex: '1 0 100%', display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '8px' }}>Tài liệu đã gửi (Chọn tài liệu)</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {[
                                'Bảng giá',
                                'Sơ đồ mặt bằng',
                                'Pháp lý dự án',
                                'Chính sách bán hàng',
                                'Brochure dự án',
                                'Thiết kế chi tiết',
                                'Khác'
                              ].map(doc => {
                                const selectedDocs = noteDocsSent ? noteDocsSent.split(', ').map(d => d.trim()) : [];
                                const isSelected = selectedDocs.includes(doc);
                                return (
                                  <button
                                    key={doc}
                                    type="button"
                                    onClick={() => {
                                      let nextDocs;
                                      if (isSelected) {
                                        nextDocs = selectedDocs.filter(d => d !== doc);
                                      } else {
                                        nextDocs = [...selectedDocs, doc];
                                      }
                                      setNoteDocsSent(nextDocs.join(', '));
                                    }}
                                    style={{
                                      padding: '6px 14px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s',
                                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-bg)',
                                      color: isSelected ? '#3b82f6' : 'var(--color-text-muted)',
                                      border: `1px solid ${isSelected ? '#3b82f6' : 'var(--color-border-light)'}`,
                                      boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                                    }}
                                  >
                                    📁 {doc}
                                  </button>
                                );
                              })}
                            </div>
                            {noteDocsSent.split(', ').map(d => d.trim()).includes('Khác') && (
                              <div style={{ marginTop: '8px' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Nhập tên tài liệu khác khác (ngăn cách bằng dấu phẩy)..."
                                  value={customDocs}
                                  onChange={e => setCustomDocs(e.target.value)}
                                  style={{ height: '36px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.8125rem', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '0 12px', width: '100%' }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 3. Obstacle Tags Row ("Khách đang vướng ở đâu?") */}
                        <div style={{ marginBottom: '1.25rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '8px' }}>Khách đang vướng ở đâu?</label>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {[
                              { id: 'trust', label: '🧑 Chưa tin mình', color: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', text: 'var(--color-danger)' },
                              { id: 'project', label: '🏙️ Chưa ưng dự án', color: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.2)', text: 'var(--color-warning)' },
                              { id: 'unit', label: '🏠 Chưa chọn căn', color: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
                              { id: 'smooth', label: '✓ Đang xuôi', color: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)', text: 'var(--color-success)' },
                              { id: 'other', label: '➕ Khác', color: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.2)', text: '#8b5cf6' }
                            ].map(item => {
                              const isSelected = noteObstacle === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setNoteObstacle(noteObstacle === item.id ? '' : item.id)}
                                  style={{
                                    padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s',
                                    background: isSelected ? item.color : 'var(--color-bg)',
                                    color: isSelected ? item.text : 'var(--color-text-muted)',
                                    border: `1px solid ${isSelected ? item.border : 'var(--color-border-light)'}`,
                                    boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                                  }}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                          {noteObstacle === 'other' && (
                            <div style={{ marginTop: '8px' }}>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Nhập vướng mắc khác của khách..."
                                value={customObstacle}
                                onChange={e => setCustomObstacle(e.target.value)}
                                style={{ height: '36px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.8125rem', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '0 12px', width: '100%' }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Gợi ý hành động dựa trên vướng mắc */}
                        {noteObstacle && (
                          <div style={{
                            background: '#fef08a1c',
                            borderLeft: '4px solid #eab308',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            marginBottom: '1rem',
                            fontSize: '0.75rem',
                            color: 'var(--color-text-muted)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            boxShadow: 'var(--shadow-sm)'
                          }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Lightbulb size={12} style={{ color: '#eab308' }} />
                              {'Toa gợi ý hành động (Sổ tay Richland):'}
                            </span>
                            <span style={{ lineHeight: 1.4 }}>
                              {noteObstacle === 'trust' && 'Áp dụng nguyên liệu [Phòng Bếp] (Xây dựng uy tín cá nhân, chia sẻ kiến thức chuyên sâu và hỗ trợ tận tâm để khách hàng tin tưởng hơn).'}
                              {noteObstacle === 'project' && 'Áp dụng nguyên liệu [Nước Sôi] + [Than so sánh] (Gửi bảng so sánh trực quan với đối thủ, nhấn mạnh lợi thế độc bản của dự án).'}
                              {noteObstacle === 'unit' && 'Áp dụng nguyên liệu [Than chốt cá nhân hóa] + [Oxy] (Gửi phân tích dòng tiền căn tiềm năng nhất, tạo độ khan hiếm cho giỏ hàng độc quyền).'}
                              {noteObstacle === 'smooth' && 'Khách hàng đang thuận lợi. Hãy duy trì tương tác đều đặn để chuẩn bị dẫn khách đi xem dự án thực tế hoặc đặt booking giữ chỗ.'}
                            </span>
                          </div>
                        )}

                        {/* 4. Text Input Area */}
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '6px' }}>Nội dung chi tiết tương tác</label>
                          <MentionInput
                            value={newNote || ''}
                            onChange={e => setNewNote(e.target.value)}
                            placeholder="Nhập ghi chú phản hồi khách hàng (Sử dụng @ để nhắc tên)..."
                            style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.875rem', lineHeight: 1.6, resize: 'vertical', minHeight: 100, color: 'var(--color-text)', outline: 'none', background: 'var(--color-surface)' }}
                          />
                        </div>

                        {/* Note Attachment */}
                        <div style={{ marginBottom: '1.25rem' }}>
                          {noteAttachmentPreview && noteAttachmentFile ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--color-bg-light)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {noteAttachmentFile.type.startsWith('image/') ? (
                                  <Camera size={18} style={{ color: '#10b981' }} />
                                ) : (
                                  <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                                )}
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{noteAttachmentFile.name}</span>
                              </div>
                              <button 
                                className="btn ghost text-danger sm" 
                                onClick={() => {
                                  if (noteAttachmentPreview) {
                                    URL.revokeObjectURL(noteAttachmentPreview);
                                  }
                                  setNoteAttachmentFile(null);
                                  setNoteAttachmentPreview(null);
                                }} 
                                style={{ padding: '6px' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="file"
                                id="note-file-upload"
                                style={{ display: 'none' }}
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv,image/*"
                                onChange={handleNoteAttachmentUpload}
                                disabled={isSubmitting}
                              />
                              <label htmlFor="note-file-upload" className="btn outline sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
                                <Paperclip size={14} />
                                Đính kèm tài liệu
                              </label>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button className="btn primary" onClick={addNote} disabled={isSubmitting || !newNote.trim()}>
                            {isSubmitting ? <Loader2 size={14} className="spin" /> : <Send size={14} />} 
                            {isSubmitting ? 'Đang lưu...' : 'Lưu ghi chú'}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {notes.map(n => {
                          const cardBg = '#fefce8'; // pale yellow like note paper
                          const leftBorder = '4px solid #eab308'; // golden yellow accent border

                          return (
                            <div key={n.id} className="card-panel animate-fade" style={{ padding: '1.25rem', background: cardBg, border: '1px solid #fef08a', borderLeft: leftBorder, borderRadius: '12px', boxShadow: '0 2px 8px rgba(234, 179, 8, 0.05)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{formatNote(n.text)}</p>
                                  {n.attachment_url && (
                                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {/\.(jpg|jpeg|png|gif|webp)$/i.test(n.attachment_url) ? (
                                        <Camera size={14} style={{ color: '#10b981' }} />
                                      ) : (
                                        <FileText size={14} style={{ color: 'var(--color-primary)' }} />
                                      )}
                                      <a
                                        href={resolveAttachmentUrl(n.attachment_url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline' }}
                                      >
                                        {n.attachment_url.split('/').pop()}
                                      </a>
                                    </div>
                                  )}
                                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.75rem' }}>
                                    Tạo bởi <strong>{n.user}</strong> lúc {n.time ? new Date(n.time).toLocaleString('vi-VN') : ''}
                                  </p>
                                </div>

                              {canDeleteNote(n.user_id) && (
                                <button
                                  className="btn-icon sm text-danger"
                                  style={{ opacity: 0.4, transition: 'opacity 0.2s' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showConfirm(
                                      'Xóa ghi chú?',
                                      'Bạn có chắc chắn muốn xóa ghi chú này không?',
                                      async () => {
                                        try {
                                          await api.delete(`/notes/${n.id}`);
                                          setNotes(prev => prev.filter(x => x.id !== n.id));
                                          addToast('Đã xóa ghi chú', 'success');
                                        } catch (e: any) {
                                          addToast('Lỗi khi xóa ghi chú', 'error');
                                        }
                                      }
                                    );
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                  onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      </div>
                    </div>
                  )}

                  {/* RESTORED OLD TABS */}
                  {activeTab === 'docs' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Hồ sơ & Tài liệu</h3>
                        {isOwnerOrAdmin && (
                          <label className="btn outline sm" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input type="file" style={{ display: 'none' }} onChange={async (e) => {
                              if (e.target.files?.[0]) {
                                const file = e.target.files[0];
                                const originalName = file.name;
                                const defaultName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
                                const customName = window.prompt("Nhập tên tài liệu:", defaultName);
                                if (customName === null) {
                                  return; // User cancelled
                                }
                                const ext = originalName.substring(originalName.lastIndexOf('.'));
                                const finalName = (customName.trim() || defaultName) + ext;
                                
                                const compressed = await compressToWebP(file);
                                const renamedFile = new File([compressed], finalName, { type: compressed.type });
                                const fData = new FormData();
                                fData.append('file', renamedFile);
                                fData.append('name', finalName);
                                fData.append('contact_id', String(contact.id));
                                fData.append('category', 'general');
                                fData.append('visibility', 'shared');
                                setUploadProgress(0);
                                try {
                                  await api.post('/cloud-files', fData, {
                                    headers: { 'Content-Type': 'multipart/form-data' },
                                    onUploadProgress: (progressEvent) => {
                                      const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
                                      setUploadProgress(percent);
                                    }
                                  });
                                  setUploadProgress(null);
                                  fetchData();
                                  addToast('Đã tải lên tài liệu mới.', 'success');
                                } catch (err: any) {
                                  setUploadProgress(null);
                                  addToast('Lỗi khi tải tài liệu lên server', 'error');
                                }
                              }
                            }} />
                            <Plus size={14} /> Upload file
                          </label>
                        )}
                      </div>

                      {uploadProgress !== null && (
                        <div style={{ padding: '1rem', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>
                            <span style={{ color: 'var(--color-text)' }}>Đang tải tài liệu lên...</span>
                            <span style={{ color: 'var(--color-primary)' }}>{uploadProgress}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'var(--color-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.1s ease-out' }} />
                          </div>
                        </div>
                      )}

                      {docs.length === 0 ? (
                        <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                          <FileText size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                          <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa có tài liệu nào</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '240px', margin: '0 auto' }}>Upload hợp đồng, CMND/CCCD hoặc báo giá tại đây.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {docs.map(doc => {
                            const ext = doc.name.split('.').pop()?.toLowerCase();
                            const isImg = ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                            const fileUrl = `${import.meta.env.VITE_API_URL ?? '/backend'}/${doc.path}`;
                            return (
                              <div key={doc.id} className="card-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--color-surface)' }}>
                                <div style={{ width: 40, height: 40, background: 'var(--color-info-light)', color: 'var(--color-info)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                  {isImg ? (
                                    <img src={fileUrl} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <FileText size={20} />
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <a 
                                    href={fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                  >
                                    {doc.name}
                                  </a>
                                  <p className="text-xs text-light mt-1">Tải lên: {doc.date} • {doc.size}</p>
                                </div>
                                {isOwnerOrAdmin && (
                                  <div className="flex gap-2" style={{ flexShrink: 0 }}>
                                    <button className="btn-icon sm" title="Đổi tên" onClick={async () => {
                                      const newName = prompt('Nhập tên mới cho tài liệu:', doc.name);
                                      if (newName && newName.trim()) {
                                        try {
                                          await api.put(`/cloud-files/${doc.id}`, { name: newName.trim() });
                                          fetchData();
                                          addToast('Đã đổi tên tài liệu.', 'success');
                                        } catch (err) {
                                          addToast('Lỗi khi đổi tên tài liệu.', 'error');
                                        }
                                      }
                                    }}><Pencil size={14} /></button>
                                    <button className="btn-icon sm text-danger" title="Xóa" onClick={() => {
                                      showConfirm({
                                        title: 'Xóa tài liệu?',
                                        message: `Bạn có chắc muốn xóa vĩnh viễn tài liệu "${doc.name}"?`,
                                        isDanger: true,
                                        confirmText: 'Xóa',
                                        onConfirm: async () => {
                                          try {
                                            await api.delete(`/cloud-files/${doc.id}`);
                                            setDocs(prev => prev.filter(d => d.id !== doc.id));
                                            addToast('Đã xóa tài liệu.', 'success');
                                          } catch (err) {
                                            addToast('Lỗi khi xóa tài liệu.', 'error');
                                          }
                                        }
                                      });
                                    }}><Trash2 size={14} /></button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'invoices' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Invoices</h3>
                        <button className="btn outline sm" onClick={() => { useUIStore.getState().setShowPOS(formData); }}><Plus size={14} /> Tạo hóa đơn</button>
                      </div>
                      {drawerInvoices.length === 0 ? (
                        <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                          <DollarSign size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                          <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa có hóa đơn</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '240px', margin: '0 auto' }}>Khách hàng này chưa phát sinh giao dịch thanh toán nào.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {/* Invoice Summary */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                            <div className="card-panel" style={{ padding: '1.25rem 1rem', background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '6px', background: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <FileText size={14} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Tổng hóa đơn</span>
                              </div>
                              <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(drawerInvoices.reduce((acc: number, inv: any) => acc + inv.total, 0))}
                              </h4>
                            </div>
                            <div className="card-panel" style={{ padding: '1.25rem 1rem', background: 'var(--color-success-light)', border: '1px solid var(--color-success)', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <CheckCircle2 size={14} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase' }}>Đã thu</span>
                              </div>
                              <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-success)' }}>
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(drawerInvoices.filter((i: any) => i.status === 'paid').reduce((acc: number, inv: any) => acc + inv.total, 0))}
                              </h4>
                            </div>
                            <div className="card-panel" style={{ padding: '1.25rem 1rem', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning)', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Clock size={14} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-warning)', textTransform: 'uppercase' }}>Chờ xử lý</span>
                              </div>
                              <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-warning)' }}>
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(drawerInvoices.filter((i: any) => i.status === 'pending').reduce((acc: number, inv: any) => acc + inv.total, 0))}
                              </h4>
                            </div>
                            <div className="card-panel" style={{ padding: '1.25rem 1rem', background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <div style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <AlertCircle size={14} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-danger)', textTransform: 'uppercase' }}>Quá hạn nợ</span>
                              </div>
                              <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-danger)' }}>
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(drawerInvoices.filter((i: any) => i.status === 'overdue').reduce((acc: number, inv: any) => acc + inv.total, 0))}
                              </h4>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gap: '1rem' }}>
                            {drawerInvoices.map((inv: any) => (
                              <div key={inv.id} className="card-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.05)'; e.currentTarget.style.borderColor = 'var(--color-primary-light)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}>
                                <div>
                                  <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', letterSpacing: '-0.01em' }}>{inv.invoice_number}</h4>
                                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={12} /> Xuất ngày: {new Date(inv.issue_date).toLocaleDateString('vi-VN')}
                                  </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1.05rem', marginBottom: '6px', letterSpacing: '-0.01em' }}>
                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(inv.total)}
                                  </div>
                                  <span className={`badge ${inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'danger' : 'warning'}`} style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}>
                                    {inv.status === 'paid' ? 'Đã thanh toán' : inv.status === 'overdue' ? 'Quá hạn' : 'Chờ xử lý'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* QUOTES TAB */}
                  {activeTab === 'quotes' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                          <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-text)' }}>Danh sách Báo giá</h3>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)' }}>Theo dõi các đề xuất giá gửi cho khách hàng này</p>
                        </div>
                        <button
                          className="btn primary sm"
                          style={{ boxShadow: '0 4px 12px rgba(189, 29, 45, 0.2)' }}
                          onClick={() => {
                            setSelectedQuote(null);
                            setShowQuoteEditor(true);
                          }}
                        >
                          <Plus size={14} /> Tạo Báo giá
                        </button>
                      </div>

                      {drawerQuotes.length === 0 ? (
                        <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                          <FileText size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                          <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa có báo giá</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '240px', margin: '0 auto' }}>Bắt đầu bằng việc tạo một báo giá chuyên nghiệp để chốt deal nhanh hơn.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(Array.isArray(drawerQuotes) ? drawerQuotes : []).map((q: any) => (
                            <div
                              key={q.id}
                              className="card-panel table-row-hover"
                              onClick={() => {
                                setSelectedQuote(q);
                                setShowQuoteEditor(true);
                              }}
                              style={{
                                padding: '1.25rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid var(--color-border-light)',
                                borderRadius: '16px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', width: 40, height: 40, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <FileText size={20} />
                                </div>
                                <div>
                                  <h4 style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'var(--color-text)', marginBottom: '2px' }}>{q.title}</h4>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>{q.quote_number} • {new Date(q.created_at).toLocaleDateString('vi-VN')}</p>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--color-text)', marginBottom: '4px' }}>
                                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(q.total)}
                                </div>
                                <span className={`badge ${q.status === 'accepted' ? 'success' : q.status === 'rejected' ? 'danger' : q.status === 'sent' ? 'warning' : 'info'}`} style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  {q.status === 'accepted' ? 'Đã duyệt' : q.status === 'rejected' ? 'Từ chối' : q.status === 'sent' ? 'Đã gửi' : 'Bản nháp'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* EXPENSES TAB */}
                  {activeTab === 'expenses' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Chi phí liên quan</h3>
                        <button className="btn outline sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#BD1D2D', borderColor: '#BD1D2D' }} onClick={() => setShowExpenseModal(true)}><Plus size={14} /> Nhập chi phí</button>
                      </div>
                      {drawerExpenses.length > 0 ? (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                          {drawerExpenses.map((exp: any) => (
                            <div key={exp.id} className="card-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <h4 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '4px' }}>{exp.title}</h4>
                                <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  <span className="badge info">{exp.category}</span>
                                  <span>{new Date(exp.date).toLocaleDateString('vi-VN')}</span>
                                  <span>Tạo bởi: {exp.creator_name}</span>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ef4444' }}>
                                  -{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(exp.split_amount || exp.amount)}
                                </div>
                                {exp.split_amount && exp.split_amount !== exp.amount && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                    (Chia từ tổng {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(exp.amount)})
                                  </div>
                                )}
                                <span className={`badge ${exp.status === 'approved' ? 'success' : exp.status === 'rejected' ? 'danger' : 'warning'}`} style={{ marginTop: '4px', fontSize: '0.7rem' }}>
                                  {exp.status === 'approved' ? 'Đã duyệt' : exp.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                          <DollarSign size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                          <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa có chi phí</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '240px', margin: '0 auto' }}>Hệ thống chưa ghi nhận bất kỳ khoản chi phí nào liên quan đến khách hàng này.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'tickets' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Hỗ trợ / Khiếu nại (Tickets)</h3>
                        <button className="btn outline sm" onClick={() => setShowTicketModal(true)}>
                          <Plus size={14} /> Tạo Ticket
                        </button>
                      </div>
                      {drawerTickets.length === 0 ? (
                        <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                          <LifeBuoy size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                          <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa có ticket hỗ trợ</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '240px', margin: '0 auto' }}>Hiện tại không có yêu cầu hỗ trợ nào đang chờ xử lý cho khách hàng này.</p>
                        </div>
                      ) : (
                        <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)' }}>Mã & Tiêu đề</th>
                                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)' }}>Trạng thái</th>
                                <th style={{ textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)' }}>Phụ trách</th>
                              </tr>
                            </thead>
                            <tbody>
                              {drawerTickets.map((t: any) => (
                                <tr 
                                  key={t.id} 
                                  style={{ borderBottom: '1px solid var(--color-border-light)', cursor: 'pointer' }}
                                  onClick={() => setSelectedTicketDetail(t)}
                                  className="table-row-hover"
                                >
                                  <td style={{ padding: '0.875rem 1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                      <AlertCircle size={14} color={t.priority === 'high' || t.priority === 'urgent' ? '#ef4444' : t.priority === 'medium' ? '#f59e0b' : '#10b981'} style={{ marginTop: '2px' }} />
                                      <div>
                                        <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '2px' }}>{t.subject}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>#{t.id} • Mở: {new Date(t.created_at).toLocaleDateString('vi-VN')}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.875rem 1rem' }}>
                                    <span className={`badge ${t.status === 'resolved' ? 'success' : t.status === 'in_progress' ? 'warning' : 'danger'}`}>
                                      {t.status === 'resolved' ? 'Đã giải quyết' : t.status === 'in_progress' ? 'Đang xử lý' : 'Đang mở'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', fontWeight: 600 }}>{t.assignee_name || 'Chưa phân công'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CallLoggerModal
        isOpen={showCallLogger}
        onClose={() => setShowCallLogger(false)}
        contact={{ id: contact?.id, full_name: fullName, phone: contact?.phone }}
        onSave={async (log) => {
          try {
            // Map CallLog to activities table schema exactly
            const subject = `Cuộc gọi ${log.direction === 'outbound' ? 'đi' : 'đến'}: ${log.outcome === 'reached' ? 'Đã kết nối' :
              log.outcome === 'no_answer' ? 'Không nghe máy' :
                log.outcome === 'busy' ? 'Máy bận' :
                  log.outcome === 'voicemail' ? 'Hộp thư thoại' : 'Sai số'
              }`;
            await api.post('/activities', {
              type: 'call',
              subject,
              body: log.note || null,
              status: 'done',
              related_type: 'contact',
              related_id: contact?.id,
              due_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
              done_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
            });

            // Update local mock store for immediate timeline reflect
            const { addActivity } = useMockStore.getState();
            addActivity({
              id: Date.now(), subject, type: 'call', status: 'done',
              user_name: 'Admin', created_at: new Date().toISOString(), contact_id: contact?.id
            });

            addToast('Đã ghi nhận cuộc gọi và thêm vào Timeline', 'success');
            fetchData();
          } catch (err: any) {
            addToast(err.response?.data?.message || 'Lỗi khi lưu nhật ký cuộc gọi', 'error');
          }
        }}
      />
      <ActivityModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        entityType="contact"
        entityId={contact?.id}
        onSuccess={fetchData}
        userId={contact?.owner_id || currentUser?.id}
      />

      <AnimatePresence>
        {pipelineModal.isOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
              onClick={() => setPipelineModal({ ...pipelineModal, isOpen: false })}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ position: 'relative', background: 'var(--color-surface)', width: '90%', maxWidth: '400px', borderRadius: 'var(--radius-xl)', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            >
              <h3 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.25rem' }}>Cập nhật trạng thái Pipeline</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                Từ <strong>{pipelineStages.find(x => String(x.id) === String(formData.stage_id || formData.status))?.name || pipelineStages[0]?.name || 'Bước 1'}</strong>
                <span style={{ margin: '0 4px' }}>→</span>
                <strong style={{ color: pipelineStages.find(x => String(x.id) === pipelineModal.targetId)?.color || 'var(--color-primary)' }}>{pipelineModal.targetLabel}</strong>
              </p>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Ghi chú Audit Trail <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <textarea
                  className="form-input"
                  placeholder="Ghi chú bắt buộc lý do hoặc tóm tắt trước khi chuyển bước..."
                  value={pipelineModal.note || ''}
                  onChange={e => setPipelineModal({ ...pipelineModal, note: e.target.value })}
                  style={{ minHeight: '120px', padding: '12px 16px', lineHeight: 1.5, resize: 'vertical' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                <button className="btn outline" onClick={() => setPipelineModal({ ...pipelineModal, isOpen: false })}>Hủy</button>
                <button
                  className="btn primary"
                  disabled={!pipelineModal.note.trim()}
                  onClick={async () => {
                    const targetId = pipelineModal.targetId;   // string, e.g. 'chua_xac_dinh' or 'dong_y_gap'
                    const targetLabel = pipelineModal.targetLabel;
                    const note = pipelineModal.note;
                    setPipelineModal({ isOpen: false, targetId: '', targetLabel: '', note: '' });

                    // Map selected pipeline stage slug to the macro status enum
                    let calculatedStatus = 'lead';
                    if (targetId === 'dat_coc' || targetId === 'dong_deal') {
                      calculatedStatus = 'customer';
                    } else if (targetId === 'not_lead') {
                      calculatedStatus = 'churned';
                    } else if (targetId === 'chua_xac_dinh') {
                      calculatedStatus = 'lead';
                    } else {
                      calculatedStatus = 'qualified';
                    }

                    // Optimistically update UI
                    setFormData((prev: any) => ({ 
                      ...prev, 
                      pipeline_status: targetId, 
                      status: calculatedStatus 
                    }));

                    try {
                      // Persist status change
                      await api.put(`/contacts/${contact.id}`, { 
                        pipeline_status: targetId, 
                        status: calculatedStatus,
                        ttl1_completed: formData.ttl1_completed,
                        ttl1_data: formData.ttl1_data
                      });
                      // Log audit note with correct query params
                      await api.post(`/notes?entity_type=contact&entity_id=${contact.id}`, {
                        body: `[Chuyển trạng thái Pipeline] → ${targetLabel}: ${note}`,
                        type: 'internal'
                      });
                      setNotes(p => [{ id: Date.now(), text: `[Chuyển trạng thái] → ${targetLabel}: ${note}`, time: new Date().toISOString(), user: 'Admin' }, ...p]);
                      addToast(`Đã cập nhật Pipeline thành ${targetLabel}`, 'success');
                    } catch (e: any) {
                      // Rollback optimistic update
                      setFormData((prev: any) => ({ 
                        ...prev, 
                        pipeline_status: contact.pipeline_status, 
                        status: contact.status 
                      }));
                      addToast(e?.response?.data?.message || 'Lỗi khi cập nhật Pipeline', 'error');
                    }
                  }}

                >
                  Lưu cập nhật
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE DEAL MODAL */}
      <AnimatePresence>
        {showDealModal && (
          <div className="overlay-backdrop" style={{ zIndex: 1100 }} onClick={() => setShowDealModal(false)}>
            <motion.div
              className="modal-sheet"
              style={{ width: '100%', maxWidth: 520 }}
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800 }}>{editingDealId ? 'Chỉnh sửa cơ hội (Deal)' : 'Tạo cơ hội (Deal) mới'}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Liên kết với: <strong>{fullName}</strong></p>
                  </div>
                </div>
                <button className="btn-icon sm" onClick={() => setShowDealModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tên Deal *</label>
                  <input className="form-input" placeholder={`VD: Triển khai ERP cho ${fullName}`} value={dealForm.title} onChange={e => setDealForm({ ...dealForm, title: e.target.value })} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Giá trị dự kiến (VNĐ)</label>
                  <input className="form-input" type="number" placeholder="0" value={dealForm.value} onChange={e => setDealForm({ ...dealForm, value: e.target.value })} />
                  {dealForm.value && Number(dealForm.value) > 0 && (
                    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic' }}>
                      Bằng chữ: {numberToText(Number(dealForm.value))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Giai đoạn</label>
                    <CustomSelect
                      options={(stages.length > 0 ? stages : DEFAULT_PIPELINE_STAGES).map(s => ({
                        value: s.id.toString(),
                        label: s.name
                      }))}
                      value={dealForm.stage}
                      onChange={val => setDealForm({ ...dealForm, stage: val.toString() })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Xác suất (%)</label>
                    <input className="form-input" type="number" value={dealForm.probability} onChange={e => setDealForm({ ...dealForm, probability: Number(e.target.value) })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Ngày dự kiến chốt</label>
                    <input 
                      className="form-input" 
                      type="date" 
                      value={dealForm.expected_close} 
                      onChange={e => setDealForm({ ...dealForm, expected_close: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mức độ ưu tiên</label>
                    <CustomSelect
                      options={[
                        { value: 'low', label: 'Thấp' },
                        { value: 'medium', label: 'Trung bình' },
                        { value: 'high', label: 'Cao' }
                      ]}
                      value={dealForm.priority}
                      onChange={val => setDealForm({ ...dealForm, priority: val.toString() })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Mô tả chi tiết</label>
                  <textarea 
                    className="form-input" 
                    rows={3} 
                    placeholder="Nhập thông tin chi tiết về cơ hội/giao dịch..." 
                    value={dealForm.description} 
                    onChange={e => setDealForm({ ...dealForm, description: e.target.value })} 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn outline" onClick={() => setShowDealModal(false)} disabled={isSubmitting}>Hủy</button>
                <button className="btn primary" onClick={handleSaveDeal} disabled={isSubmitting}>
                  {isSubmitting ? 'Đang lưu...' : (editingDealId ? 'Lưu thay đổi' : 'Tạo Deal')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE TASK MODAL */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="overlay-backdrop" style={{ zIndex: 1100 }} onClick={() => setShowTaskModal(false)}>
            <motion.div
              className="modal-sheet"
              style={{ width: '100%', maxWidth: 520 }}
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(245,158,11,0.12)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckSquare size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800 }}>Thêm công việc mới</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Liên quan đến khách hàng: <strong>{fullName}</strong></p>
                  </div>
                </div>
                <button className="btn-icon sm" onClick={() => setShowTaskModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Tên công việc *</label>
                  <input className="form-input" placeholder="VD: Gửi báo giá, Demo tính năng..." value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} autoFocus />
                </div>
                
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Người thực hiện</label>
                  <CustomSelect
                    showAvatars={true}
                    options={[
                      { value: '', label: 'Chưa giao cho ai' },
                      ...users.map(u => ({
                        value: String(u.id),
                        label: `${u.full_name} (${u.role === 'admin' ? 'Admin' : u.role === 'sales' ? 'Sales' : u.role})`,
                        avatar: u.avatar_url || undefined
                      }))
                    ]}
                    value={taskForm.user_id}
                    onChange={val => setTaskForm({ ...taskForm, user_id: val.toString() })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Tài liệu hoặc Link đính kèm (Tùy chọn)</span>
                    {uploadingFile && <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }} className="animate-pulse">Đang tải tệp lên...</span>}
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      className="form-input" 
                      placeholder="Nhập link tài liệu hoặc link đính kèm..." 
                      value={taskForm.link || ''} 
                      onChange={e => setTaskForm({ ...taskForm, link: e.target.value })} 
                      style={{ flex: 1 }}
                    />
                    <label className="btn outline" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', margin: 0, padding: '0 0.75rem', height: '38px', borderRadius: '8px' }}>
                      <Paperclip size={16} />
                      Tải tệp
                      <input 
                        type="file" 
                        onChange={handleTaskFileUpload} 
                        style={{ display: 'none' }} 
                        disabled={uploadingFile}
                      />
                    </label>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Mô tả chi tiết công việc</label>
                  <textarea 
                    className="form-input" 
                    placeholder="Nhập ghi chú hoặc mô tả chi tiết công việc..." 
                    value={taskForm.description} 
                    onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} 
                    style={{ minHeight: 80, resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Mức độ ưu tiên</label>
                    <CustomSelect
                      options={[
                        { value: 'low', label: 'Thấp' },
                        { value: 'medium', label: 'Trung bình' },
                        { value: 'high', label: 'Cao' }
                      ]}
                      value={taskForm.priority}
                      onChange={val => setTaskForm({ ...taskForm, priority: val.toString() })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hạn hoàn thành</label>
                    <input className="form-input" type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn outline" onClick={() => setShowTaskModal(false)} disabled={isSubmitting}>Hủy</button>

                <button className="btn primary" onClick={handleAddTask} disabled={isSubmitting}>
                  {isSubmitting ? 'Đang lưu...' : 'Lưu công việc'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE TICKET MODAL */}
      <AnimatePresence>
        {showTicketModal && (
          <div className="overlay-backdrop" style={{ zIndex: 1100 }} onClick={() => setShowTicketModal(false)}>
            <motion.div
              className="modal-sheet"
              style={{ width: '100%', maxWidth: 540 }}
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <HelpCircle size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800 }}>Tạo Ticket hỗ trợ</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Khách hàng: <strong>{fullName}</strong></p>
                  </div>
                </div>
                <button className="btn-icon sm" onClick={() => setShowTicketModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Tiêu đề hỗ trợ *</label>
                    <input className="form-input" placeholder="Tóm tắt yêu cầu/lỗi..." value={ticketForm.subject} onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })} autoFocus />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Độ ưu tiên</label>
                    <CustomSelect
                      options={[
                        { value: 'low', label: 'Thấp' },
                        { value: 'medium', label: 'Trung bình' },
                        { value: 'high', label: 'Cao' },
                        { value: 'urgent', label: 'Khẩn cấp' }
                      ]}
                      value={ticketForm.priority}
                      onChange={val => setTicketForm({ ...ticketForm, priority: val.toString() })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Mô tả chi tiết</label>
                  <textarea className="form-input" rows={4} placeholder="Nội dung chi tiết..." value={ticketForm.description || ''} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} style={{ resize: 'none' }} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn outline" onClick={() => setShowTicketModal(false)} disabled={isSubmitting}>Hủy</button>
                <button className="btn primary" onClick={handleCreateTicket} disabled={isSubmitting}>
                  {isSubmitting ? 'Đang tạo...' : 'Tạo Ticket'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <CreateExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        initialEntity={{ type: 'contact', id: contact?.id, name: `${contact?.first_name} ${contact?.last_name || ''}`.trim() }}
        onSuccess={fetchData}
      />
      <QuoteEditorModal
        isOpen={showQuoteEditor}
        onClose={() => setShowQuoteEditor(false)}
        quote={selectedQuote}
        initialContact={contact}
        onSuccess={() => {
          setShowQuoteEditor(false);
          fetchData();
        }}
      />
      <TicketDrawer
        isOpen={!!selectedTicketDetail}
        onClose={() => setSelectedTicketDetail(null)}
        ticket={selectedTicketDetail}
        onUpdate={async (updated) => {
          try {
            await api.put(`/tickets/${updated.id}`, updated);
            setDrawerTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
          } catch (e: any) {
            addToast(e.response?.data?.message || 'Không thể cập nhật Ticket', 'error');
          }
        }}
        contacts={contacts}
        users={users}
      />
    </>,
    document.body
  );
};
