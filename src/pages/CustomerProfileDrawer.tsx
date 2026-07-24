import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Users, Phone, Mail, MapPin, Briefcase, Plus, Search, Send, History, CheckSquare, DollarSign, HelpCircle, FileText, ShoppingCart, Tag as TagIcon, Target, Pencil, Trash2, LifeBuoy, AlertCircle, Clock, UserCheck, Activity, Calendar, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, Check, Camera, Loader2, MessageSquare, PenTool, Lightbulb, Upload, Paperclip, CreditCard, Ban, ShieldAlert, Copy, Folder, FolderPlus, ArrowRightLeft, List, LayoutGrid, RotateCcw, RefreshCw, Layers, Save, LogOut, XCircle, Eye, TrendingUp, Wallet, Lock, Zap, Link2 } from 'lucide-react';
import confetti from 'canvas-confetti';
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
import { CustomModal } from '../components/ui/CustomModal';
import { SignaturePadModal } from '../components/ui/SignaturePadModal';
import { compressToWebP } from '../utils/imageCompress';
import { TicketDrawer } from './TicketDrawer';
import { WorkspaceTaskDrawer } from './WorkspaceTaskDrawer';
import { Skeleton, StatRowSkeleton } from '../components/ui/Skeleton';
import { EmptyCard } from '../components/ui/EmptyCard';
import { numberToText } from '../utils/numberToText';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { useUIStore } from '../store/uiStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { useUploadProgress } from '../contexts/UploadProgressContext';
import { PasteDropzoneArea } from '../components/ui/PasteDropzoneArea';
import { fetchAPI } from '../utils/api';
import styles from './EntityDrawer.module.css';
import { Tooltip } from '../components/ui/Tooltip';
import { useLanguage } from '../contexts/LanguageContext';
import { getModulePermissionScope } from '../store/authStore';

const EditHistoryIndicator = ({ history }: { history: any }) => {
  const [showPopup, setShowPopup] = useState(false);
  let parsed = [];
  try {
    parsed = typeof history === 'string' ? JSON.parse(history) : (history || []);
  } catch (e) {}

  if (!parsed || parsed.length === 0) return null;

  const lastEdit = parsed[0];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span 
        style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', cursor: 'pointer', textDecoration: 'underline dotted', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
        onClick={() => setShowPopup(!showPopup)}
        onMouseEnter={() => setShowPopup(true)}
        onMouseLeave={() => setShowPopup(false)}
      >
        <Clock size={10} /> Đã chỉnh sửa (lần cuối bởi {lastEdit.edited_by_name} lúc {new Date(lastEdit.edited_at).toLocaleDateString('vi-VN')} {new Date(lastEdit.edited_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
      </span>
      {showPopup && (
        <div style={{ position: 'absolute', bottom: '100%', left: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px 12px', boxShadow: 'var(--shadow-lg)', zIndex: 1000, width: '260px', marginBottom: '4px' }}>
          <p style={{ fontWeight: 700, fontSize: '0.75rem', marginBottom: '6px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '4px', textAlign: 'left', color: 'var(--color-text)' }}>Lịch sử chỉnh sửa (Tối đa 3 lần)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
            {parsed.map((item: any, idx: number) => (
              <div key={idx} style={{ fontSize: '0.7rem', lineHeight: 1.3, color: 'var(--color-text)' }}>
                <strong>{item.edited_by_name}</strong> · <span style={{ color: 'var(--color-text-muted)' }}>{new Date(item.edited_at).toLocaleDateString('vi-VN')}</span>
                <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Nội dung cũ: {item.old_body || item.old_subject}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const tempLabels: Record<string, { label: string; color: string; bg: string }> = {
  hot: { label: 'Sôi', color: '#b91c1c', bg: 'rgba(185, 28, 28, 0.1)' },
  warm: { label: 'Nóng', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  neutral: { label: 'Ấm', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  cool: { label: 'Nguội', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  cold: { label: 'Lạnh', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }
};

/* ─── Types ─────────────────────────────────────────────────── */
interface Props {
  isOpen: boolean;
  onClose: () => void;
  contact: any;
  onUpdate?: (data: any) => void;
  initialTab?: string;
  zIndex?: number;
}

const FMT = (v: any) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(v) || 0);

function numberToVietnameseWords(num: number): string {
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  if (num === 0) return 'Không phần trăm';
  if (num === 100) return 'Một trăm phần trăm';
  
  let words = '';
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  
  if (tens > 1) {
    words += units[tens] + ' mươi';
    if (ones === 1) {
      words += ' mốt';
    } else if (ones === 5) {
      words += ' lăm';
    } else if (ones > 0) {
      words += ' ' + units[ones];
    }
  } else if (tens === 1) {
    words += 'mười';
    if (ones === 5) {
      words += ' lăm';
    } else if (ones > 0) {
      words += ' ' + units[ones];
    }
  } else {
    words += units[ones];
  }
  
  const result = words.trim();
  return (result.charAt(0).toUpperCase() + result.slice(1) + ' phần trăm').trim();
}

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '—';
  const cleanStr = dateStr.replace(' ', 'T');
  const d = new Date(cleanStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const buildTasks = (c: any): any[] => {
  return [];
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
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  
  let cleanPath = url.replace(/^\/+/, '');
  
  // Rewrite legacy storage paths to the new uploads paths
  if (cleanPath.includes('storage/uploads/')) {
    cleanPath = cleanPath.replace('storage/uploads/', 'uploads/');
  }
  
  if (cleanPath.startsWith('backend/')) {
    cleanPath = cleanPath.substring('backend/'.length);
  }
  
  if (cleanPath.startsWith('deposits/')) {
    cleanPath = 'uploads/' + cleanPath;
  }
  
  const apiBase = import.meta.env.VITE_API_URL || 'https://open.domation.net/richland/api.php';
  let baseUrl = apiBase;
  if (baseUrl.includes('api.php')) {
    baseUrl = baseUrl.split('api.php')[0];
  }
  baseUrl = baseUrl.replace(/\/+$/, '');
  
  if (!baseUrl.startsWith('http')) {
    baseUrl = 'https://open.domation.net/richland';
  }
  
  return `${baseUrl}/${cleanPath}`;
};

const TABS = [
  { id: 'info', label: 'Thông tin chung', icon: <User size={16} /> },
  { id: 'tags', label: 'Tags & Ghi chú', icon: <TagIcon size={16} /> },
  { id: 'cooperation', label: 'Hợp tác', icon: <Users size={16} /> },
  { id: 'tasks', label: 'Công việc', icon: <CheckSquare size={16} /> },
  { id: 'docs', label: 'Hồ sơ & Tài liệu', icon: <Paperclip size={16} /> },
  { id: 'timeline', label: 'Lịch sử tương tác', icon: <History size={16} /> },
  { id: 'scoring', label: 'Scoring', icon: <Target size={16} /> },
  { id: 'ttl1', label: 'Xác minh TTL1', icon: <UserCheck size={16} /> },
  { id: 'invoices', label: 'Hóa đơn', icon: <FileText size={16} /> },
  { id: 'deals', label: 'Phiếu đặt cọc', icon: <CreditCard size={16} /> },
  { id: 'quotes', label: 'Báo giá', icon: <ShoppingCart size={16} /> },
  { id: 'expenses', label: 'Chi phí', icon: <DollarSign size={16} /> },
  { id: 'tickets', label: 'Hỗ trợ & Khiếu nại', icon: <LifeBuoy size={16} /> },
];

const renderColoredTabIcon = (tabId: string, IconComponent: any) => {
  let bgColor = 'var(--color-primary)';
  switch (tabId) {
    case 'info': bgColor = '#ef4444'; break;
    case 'tags': bgColor = '#ec4899'; break;
    case 'cooperation': bgColor = '#f59e0b'; break;
    case 'tasks': bgColor = '#10b981'; break;
    case 'docs': bgColor = '#8b5cf6'; break;
    case 'timeline': bgColor = '#3b82f6'; break;
    case 'scoring': bgColor = '#06b6d4'; break;
    case 'ttl1': bgColor = '#14b8a6'; break;
    case 'invoices': bgColor = '#f43f5e'; break;
    case 'deals': bgColor = '#eab308'; break;
    case 'quotes': bgColor = '#10b981'; break;
    case 'expenses': bgColor = '#ef4444'; break;
    case 'tickets': bgColor = '#6b7280'; break;
  }
  return (
    <div style={{
      width: '28px',
      height: '28px',
      borderRadius: '7px',
      backgroundColor: bgColor,
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0
    }}>
      {React.cloneElement(IconComponent, { size: 15, color: 'white', style: { display: 'block', width: '15px', height: '15px', margin: 'auto' } })}
    </div>
  );
};


const renderFormattedText = (text: string, users: any[], onMentionClick?: (e: React.MouseEvent, name: string) => void) => {
  if (!text) return '';
  // Regex matches URLs or @mentions (supporting unicode characters and parentheses like @Minh_Khôi_(Manager))
  const regex = /(https?:\/\/[^\s]+|@[\p{L}\p{N}_()]+)/gu;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
        >
          {part}
        </a>
      );
    } else if (part.startsWith('@')) {
      const cleanName = (n: string) => (n || '').trim().replace(/\s+/g, '_').toLowerCase().replace(/_\([^)]+\)/g, '').replace(/\([^)]+\)/g, '');
      const cleanMentionVal = cleanName(part.substring(1));
      // Look up user to find avatar
      const taggedUser = users.find((u: any) => {
        const normalizedUser = cleanName(u.full_name || u.name || u.fullname || u.username);
        return normalizedUser === cleanMentionVal;
      });

      const displayName = taggedUser?.full_name || part.substring(1).replace(/_/g, ' ');
      const avatarUrl = taggedUser?.avatar_url || taggedUser?.avatar;

      return (
        <span
          key={index}
          onClick={(e) => onMentionClick && onMentionClick(e, displayName)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--color-primary)',
            background: 'rgba(163, 20, 34, 0.05)',
            border: '1px solid rgba(163, 20, 34, 0.15)',
            padding: '2px 8px',
            borderRadius: '9999px',
            margin: '0 2px',
            fontWeight: 600,
            fontSize: '0.85em',
            verticalAlign: 'middle',
            cursor: onMentionClick ? 'pointer' : 'default'
          }}
        >
          <Avatar name={displayName} src={avatarUrl} size={14} />
          @{displayName}
        </span>
      );
    }
    return part;
  });
};

const formatMeetingTime = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const MeetingCountdown: React.FC<{ dueDate: string }> = ({ dueDate }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      const target = new Date(dueDate);
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (isNaN(target.getTime())) {
        setTimeLeft('');
        return;
      }

      if (diff <= 0) {
        setTimeLeft('Đã đến giờ/Quá giờ');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      let result = 'Sắp gặp trong: ';
      if (days > 0) result += `${days}d `;
      if (hours > 0 || days > 0) result += `${hours}h `;
      result += `${minutes}m`;
      setTimeLeft(result);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 30000);
    return () => clearInterval(interval);
  }, [dueDate]);

  if (!timeLeft) return null;

  const isOverdue = timeLeft === 'Đã đến giờ/Quá giờ';

  return (
    <span style={{ 
      fontSize: '0.72rem', 
      fontWeight: 600, 
      color: isOverdue ? 'var(--color-danger)' : '#2563eb', 
      background: isOverdue ? 'rgba(239,68,68,0.08)' : 'rgba(37,99,235,0.08)',
      padding: '2px 6px',
      borderRadius: '4px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      marginTop: '4px'
    }}>
      <Clock size={10} />
      {timeLeft}
    </span>
  );
};

const ActivityComments: React.FC<{ 
  activityId: number; 
  initialCount?: number; 
  users?: any[]; 
  onMentionClick?: (e: React.MouseEvent, name: string) => void;
  actions?: React.ReactNode;
}> = ({ activityId, initialCount = 0, users = [], onMentionClick, actions }) => {
  const { addToast, showConfirm } = useUIStore();
  const { user: currentUser } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [replyTo, setReplyTo] = useState<{ id: number; userName: string } | null>(null);

  const canDeleteComment = (c: any) => {
    if (!currentUser) return false;
    const role = currentUser.role as any;
    if (role === 'admin' || role === 'superadmin' || role === 'super_admin' || role === 'manager' || role === 'assistant' || role === 'director') {
      return true;
    }
    return String(c.user_id) === String(currentUser.id);
  };

  const fetchComments = async () => {
    try {
      const res = await api.get(`/activities/${activityId}/comments`);
      setComments(res.data.data || []);
      setHasFetched(true);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    showConfirm({
      title: 'Xóa bình luận',
      message: 'Bạn có chắc chắn muốn xóa bình luận này không?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/activities/comments/${commentId}`);
          await fetchComments();
          addToast('Đã xóa bình luận thành công', 'success');
        } catch (e: any) {
          addToast(e.response?.data?.message || 'Không thể xóa bình luận', 'error');
        }
      }
    });
  };
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightActivityId = params.get('highlight_activity_id');

    if (String(activityId) === String(highlightActivityId)) {
      setExpanded(true);
      if (!hasFetched) {
        fetchComments();
      }
    } else {
      if (initialCount > 0 && !hasFetched) {
        fetchComments();
      } else if (initialCount === 0 && !hasFetched) {
        setHasFetched(true);
      }
    }
  }, [activityId, initialCount, hasFetched]);

  useEffect(() => {
    if (expanded && comments.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const highlightCommentId = params.get('highlight_comment_id');
      const highlightActivityId = params.get('highlight_activity_id');
      
      if (String(activityId) === String(highlightActivityId)) {
        if (highlightCommentId) {
          setTimeout(() => {
            const element = document.getElementById(`comment-${highlightCommentId}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              element.style.backgroundColor = '#fef08a'; // yellow-200
              setTimeout(() => {
                element.style.backgroundColor = 'transparent';
              }, 2500);
            }
          }, 300);
        } else {
          setTimeout(() => {
            const element = document.getElementById(`activity-item-${highlightActivityId}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 300);
        }
      }
    }
  }, [expanded, comments, activityId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightCommentId = params.get('highlight_comment_id');
    if (highlightCommentId && comments.length > 0) {
      const hasComment = comments.some((c: any) => String(c.id) === String(highlightCommentId));
      if (hasComment) {
        setExpanded(true);
      }
    }
  }, [comments]);

  const displayCount = hasFetched ? comments.length : initialCount;

  const toggleExpand = async () => {
    if (!expanded && !hasFetched && initialCount > 0) {
      await fetchComments();
    }
    setExpanded(!expanded);
  };

  const handleImagePaste = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      addToast('Dung lượng tệp đính kèm không được vượt quá 5MB', 'error');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setAttachmentFile(file);
    setAttachmentPreview(previewUrl);
    addToast('Đã dán tệp đính kèm từ clipboard!', 'success');
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

      const commentText = text;
      setText('');
      setReplyTo(null);
      if (attachmentPreview) {
        URL.revokeObjectURL(attachmentPreview);
      }
      setAttachmentFile(null);
      setAttachmentPreview(null);

      const payload = { 
        content: commentText, 
        attachments: uploadedUrl ? [uploadedUrl] : [],
        parent_id: replyTo ? replyTo.id : null
      };
      await api.post(`/activities/${activityId}/comments`, payload);
      fetchComments();
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Lỗi khi gửi bình luận', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop: '0.75rem', borderTop: '1px dashed var(--color-border-light)', paddingTop: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          className="btn ghost sm" 
          style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          onClick={toggleExpand}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <MessageSquare size={14} />
          Bình luận {displayCount > 0 && `(${displayCount})`}
        </button>
        {actions}
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(() => {
            const rootComments = comments.filter((c: any) => !c.parent_id);
            const getDescendants = (rootId: number) => {
              const result: any[] = [];
              const queue = [rootId];
              while (queue.length > 0) {
                const currentId = queue.shift();
                const children = comments
                  .filter((c: any) => Number(c.parent_id) === Number(currentId))
                  .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                for (const child of children) {
                  if (!result.some(r => r.id === child.id)) {
                    result.push(child);
                    queue.push(child.id);
                  }
                }
              }
              return result.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            };

            const renderCommentNode = (c: any, isReply: boolean = false, rootId?: number) => {
              const parentComment = isReply && c.parent_id ? comments.find((pc: any) => pc.id === c.parent_id) : null;
              const isDirectReplyToRoot = parentComment && !parentComment.parent_id;

              return (
                <div key={c.id} id={`comment-${c.id}`} style={{ display: 'flex', gap: '0.75rem', transition: 'all 0.5s ease', borderRadius: '12px', padding: isReply ? '4px 0 4px 12px' : '4px', borderLeft: isReply ? '2px solid var(--color-border-light)' : undefined }}>
                  <Avatar name={c.user_name} src={c.avatar_url || undefined} size={isReply ? 24 : "sm"} />
                  <div style={{ flex: 1, background: isReply ? 'transparent' : 'var(--color-surface)', padding: isReply ? '4px 0' : '0.75rem', borderRadius: isReply ? '0' : '12px', border: isReply ? 'none' : '1px solid var(--color-border-light)', boxShadow: isReply ? 'none' : 'var(--shadow-sm)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: isReply ? '0.75rem' : '0.8125rem', color: 'var(--color-text)' }}>
                        {c.user_name}
                        {isReply && parentComment && !isDirectReplyToRoot && (
                          <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '6px', fontSize: '0.7rem' }}>
                            trả lời <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>@{parentComment.user_name}</span>
                          </span>
                        )}
                      </strong>
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
                    {c.content && <p style={{ fontSize: isReply ? '0.8125rem' : '0.875rem', color: 'var(--color-text-light)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderFormattedText(c.content, users, onMentionClick)}</p>}
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
                    <button
                      onClick={() => setReplyTo({ id: c.id, userName: c.user_name || 'Đồng nghiệp' })}
                      style={{ alignSelf: 'flex-end', background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.72rem', padding: '4px 0 0 0', cursor: 'pointer', fontWeight: 700, display: 'block', width: 'fit-content' }}
                      className="hover-lift"
                    >
                      Phản hồi
                    </button>
                  </div>
                </div>
              );
            };

            return rootComments.map((rootC: any) => {
              const replies = getDescendants(rootC.id);
              return (
                <div key={rootC.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {renderCommentNode(rootC, false)}
                  {replies.length > 0 && (
                    <div style={{ marginLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '1px solid var(--color-border-light)', paddingLeft: '0.75rem' }}>
                      {replies.map((reply: any) => renderCommentNode(reply, true, rootC.id))}
                    </div>
                  )}
                </div>
              );
            });
          })()}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'flex-start' }}>
            <Avatar name={(currentUser as any)?.full_name || "Bạn"} src={(currentUser as any)?.avatar_url || undefined} size="sm" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {replyTo && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(163, 20, 34, 0.08)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', color: '#a31422', fontWeight: 700 }}>
                  <span>Đang trả lời {replyTo.userName}</span>
                  <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', color: '#a31422', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', padding: '0 4px' }}>×</button>
                </div>
              )}
              <div style={{ position: 'relative' }}>
                <MentionInput
                  className="form-input" 
                  style={{ minHeight: '60px', padding: '8px 12px', fontSize: '0.875rem', paddingRight: '40px', opacity: submitting ? 0.7 : 1, width: '100%' }} 
                  placeholder="Viết bình luận..."
                  value={text}
                  disabled={submitting}
                  onChange={e => setText(e.target.value)}
                  onImagePaste={handleImagePaste}
                  onFilePaste={handleImagePaste}
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

const DrawerSkeleton = () => {
  return (
    <div className="skeleton-wrapper" style={{ display: 'flex', flex: 1, gap: '2rem', height: '100%', background: 'var(--color-surface)' }}>
      {/* Sidebar Skeleton */}
      <div className="skeleton-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '250px', borderRight: '1px solid var(--color-border-light)', padding: '1.5rem 1rem' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
          <div key={i} className="skeleton" style={{ width: '100%', height: '36px', borderRadius: '8px' }}></div>
        ))}
      </div>

      {/* Content Area Skeleton */}
      <div className="skeleton-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem 2rem 1.5rem 0' }}>
        <div className="skeleton-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="skeleton" style={{ width: '30%', height: '14px', borderRadius: '4px' }}></div>
              <div className="skeleton" style={{ width: '100%', height: '38px', borderRadius: '8px' }}></div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
          <div className="skeleton" style={{ width: '15%', height: '14px', borderRadius: '4px' }}></div>
          <div className="skeleton" style={{ width: '100%', height: '120px', borderRadius: '8px' }}></div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
        @media (max-width: 1024px) {
          .skeleton-wrapper {
            flex-direction: column !important;
            gap: 1.5rem !important;
            padding: 1rem !important;
          }
          .skeleton-sidebar {
            width: 100% !important;
            border-right: none !important;
            padding: 0 0 0.5rem 0 !important;
            flex-direction: row !important;
            overflow-x: auto;
            border-bottom: 1px solid var(--color-border-light);
            flex-shrink: 0;
            gap: 0.75rem !important;
          }
          .skeleton-sidebar > div {
            width: 100px !important;
            flex-shrink: 0;
          }
          .skeleton-content {
            padding: 0 !important;
          }
          .skeleton-grid {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
        }
      `}</style>
    </div>
  );
};

const formatNumberWithCommas = (val: any) => {
  if (val === undefined || val === null || val === '') return '';
  const cleanVal = String(val).replace(/[^0-9]/g, '');
  if (!cleanVal) return '';
  return cleanVal.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

interface TimelineItemProps {
  ev: any;
  index: number;
  currentUser: any;
  drawerActivities: any[];
  users: any[];
  isMobile: boolean;
  formatNote: (text: string) => any;
  resolveAttachmentUrl: (url: string) => string;
  formatMeetingTime: (date: string) => string;
  handleTimelineItemClick: (ev: any) => void;
  deleteActivity: (id: number) => void;
  setEditingActivity: (ev: any) => void;
  setShowActivityModal: (show: boolean) => void;
  showUserCard: (e: React.MouseEvent, name: string) => void;
  handleCompleteMeeting: (ev: any) => void;
  handleCancelMeeting: (ev: any) => void;
  handleRescheduleMeetingClick: (ev: any) => void;
}

const TimelineItem = React.memo<TimelineItemProps>(({
  ev,
  index,
  currentUser,
  drawerActivities,
  users,
  isMobile,
  formatNote,
  resolveAttachmentUrl,
  formatMeetingTime,
  handleTimelineItemClick,
  deleteActivity,
  setEditingActivity,
  setShowActivityModal,
  showUserCard,
  handleCompleteMeeting,
  handleCancelMeeting,
  handleRescheduleMeetingClick
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.25) }}
      id={`activity-item-${ev.id}`}
      style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', position: 'relative' }}
      className="timeline-event-item gpu-accelerated"
    >
      {/* Step Node */}
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${ev.color}15`, border: `2px solid ${ev.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, backgroundColor: 'var(--color-surface)', boxShadow: `0 0 0 4px var(--color-bg)` }}>
        <div style={{ color: ev.color, display: 'flex' }}>{ev.icon}</div>
      </div>

      {/* Step Content */}
      <div
        onClick={() => handleTimelineItemClick(ev)}
        style={{ 
          flex: 1, 
          padding: '8px 10px', 
          background: 'var(--color-surface)', 
          borderRadius: '12px', 
          border: '1px solid var(--color-border-light)', 
          boxShadow: 'var(--shadow-sm)', 
          transition: 'all 0.2s', 
          cursor: ['call', 'email', 'meeting', 'task'].includes(ev.type) ? 'pointer' : 'default',
          position: 'relative'
        }}
        onMouseEnter={e => { if (['call', 'email', 'meeting', 'task'].includes(ev.type)) e.currentTarget.style.borderColor = ev.color; }}
        onMouseLeave={e => { if (['call', 'email', 'meeting', 'task'].includes(ev.type)) e.currentTarget.style.borderColor = 'var(--color-border-light)'; }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: currentUser && ['admin', 'superadmin', 'super_admin', 'director'].includes(currentUser.role) ? '54px' : '0px' }}>
          {ev.title && (
            <h4 style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)', margin: 0, paddingRight: '8px' }}>
              {ev.title}
            </h4>
          )}
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: ev.color, background: `${ev.color}12`, padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
              {ev.type === 'meeting' ? (ev.status === 'cancelled' ? 'Hủy gặp' : (ev.status === 'planned' ? 'Lịch gặp' : 'Đã gặp')) : ev.type === 'zalo_connect' ? 'Zalo' : ev.type.toUpperCase()}
            </span>
            <span>•</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Avatar name={ev.user} src={ev.avatar} size="sm" style={{ width: '15px', height: '15px' }} />
              <strong>{ev.user}</strong>
            </div>
            <span>•</span>
            <span>{new Date(ev.time).toLocaleDateString('vi-VN')} {new Date(ev.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            {ev.type === 'meeting' && ev.due_date && (
              <>
                <span>•</span>
                <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>
                  Lịch gặp: {formatMeetingTime(ev.due_date)}
                </span>
              </>
            )}
          </div>
        </div>

        {currentUser && ['admin', 'superadmin', 'super_admin', 'director'].includes(currentUser.role) && (
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              position: 'absolute', 
              top: '6px', 
              right: '6px', 
              display: 'flex', 
              gap: '2px',
              zIndex: 10
            }}
          >
            <button
              className="btn ghost sm"
              style={{ padding: '2px', height: '24px', width: '24px', color: 'var(--color-text-muted)', opacity: 0.6 }}
              onClick={(e) => {
                e.stopPropagation();
                const rawAct = drawerActivities.find((x: any) => x.id === ev.id);
                if (rawAct) {
                  setEditingActivity(rawAct);
                  setShowActivityModal(true);
                }
              }}
            >
              <Pencil size={12} />
            </button>
            <button
              className="btn ghost sm"
              style={{ padding: '2px', height: '24px', width: '24px', color: 'var(--color-danger)', opacity: 0.6 }}
              onClick={(e) => { e.stopPropagation(); deleteActivity(ev.id); }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}

        {(ev.note || ev.expense_image_url) && (() => {
          const linkMatch = ev.note ? ev.note.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m) : null;
          const linkUrl = linkMatch ? linkMatch[1].trim() : (ev.expense_image_url || '');
          let displayNoteText = linkMatch ? ev.note.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim() : (ev.note || '');
          let currentBody = displayNoteText.trim();
          let wasParsed = false;
          while (currentBody.startsWith('{"erp_task"') || currentBody.startsWith('{"erp_task":')) {
            try {
              const parsed = JSON.parse(currentBody);
              wasParsed = true;
              if (typeof parsed.erp_task?.description === 'string') {
                currentBody = parsed.erp_task.description.trim();
              } else {
                break;
              }
            } catch (e) {
              break;
            }
          }
          if (wasParsed) {
            displayNoteText = currentBody;
          }

          const hasContent = displayNoteText.trim() !== '' || 
                            linkUrl.trim() !== '' || 
                            (ev.type === 'call' && !!(ev as any).metadata?.recording_url) || 
                            (ev.type === 'email' && !!(ev as any).metadata?.email_subject) || 
                            (ev.type === 'meeting' && !!(ev as any).metadata?.zoom_link) || 
                            !!ev.edit_history;

          if (!hasContent) return null;

          return (
            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', marginTop: '0.375rem', border: '1px solid var(--color-border-light)' }}>
              {displayNoteText && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', lineHeight: 1.5, margin: 0 }}>{formatNote(displayNoteText)}</p>
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
              {ev.edit_history && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <EditHistoryIndicator history={ev.edit_history} />
                </div>
              )}
            </div>
          );
        })()}

        {['call', 'email', 'meeting', 'task', 'note', 'zalo_connect'].includes(ev.type) && (
          <ActivityComments 
            activityId={ev.id} 
            initialCount={Number(ev.comment_count) || 0} 
            users={users} 
            onMentionClick={showUserCard}
            actions={ev.type === 'meeting' && (ev.status === 'planned' || ev.status === 'rescheduled') && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCompleteMeeting(ev);
                  }}
                  className="btn sm success"
                  style={{
                    height: '24px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0 10px',
                    backgroundColor: '#10b981',
                    color: 'white'
                  }}
                >
                  <Check size={12} />
                  <span>Đã gặp</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelMeeting(ev);
                  }}
                  className="btn sm danger"
                  style={{
                    height: '24px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0 10px',
                    backgroundColor: '#ef4444',
                    color: 'white'
                  }}
                >
                  <X size={12} />
                  <span>Hủy lịch</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRescheduleMeetingClick(ev);
                  }}
                  className="btn sm warning"
                  style={{
                    height: '24px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0 10px',
                    backgroundColor: '#f59e0b',
                    color: 'white'
                  }}
                >
                  <Calendar size={12} />
                  <span>Dời lịch</span>
                </button>
              </div>
            )}
          />
        )}
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return prevProps.ev.id === nextProps.ev.id &&
         prevProps.ev.time === nextProps.ev.time &&
         prevProps.ev.status === nextProps.ev.status &&
         prevProps.ev.comment_count === nextProps.ev.comment_count &&
         prevProps.index === nextProps.index;
});

export const CustomerProfileDrawer: React.FC<Props> = ({ isOpen, onClose, contact, onUpdate, initialTab, zIndex }) => {
  const { addToast, showConfirm, showCall } = useUIStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => setIsMobileOrTablet(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      lastLoadedContactIdRef.current = null;
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const renderFormattedText = (text: string) => {
    if (!text) return '';
    // Regex matches URLs or @mentions (supporting unicode characters and parentheses like @Minh_Khôi_(Manager))
    const regex = /(https?:\/\/[^\s]+|@[\p{L}\p{N}_()]+)/gu;
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {part}
          </a>
        );
      } else if (part.startsWith('@')) {
        const cleanMention = part.substring(1).toLowerCase();
        // Look up user to find avatar
        const taggedUser = users.find((u: any) => {
          const normalizedUser = (u.full_name || '').trim().replace(/\s+/g, '_').toLowerCase();
          return normalizedUser === cleanMention;
        });

        const displayName = taggedUser?.full_name || part.substring(1).replace(/_/g, ' ');
        const avatarUrl = taggedUser?.avatar_url || taggedUser?.avatar;
        const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

        return (
          <span
            key={index}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#dc2626', // Red text
              background: 'rgba(239, 68, 68, 0.08)', // Light red background tint
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '2px 8px',
              borderRadius: '9999px',
              margin: '0 2px',
              fontWeight: 600,
              fontSize: '0.85em',
              verticalAlign: 'middle'
            }}
          >
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={displayName} 
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block'
                }}
              />
            ) : (
              <span 
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  lineHeight: 1
                }}
              >
                {initial}
              </span>
            )}
            @{displayName}
          </span>
        );
      }
      return part;
    });
  };
  const [activeTab, setActiveTab] = useState<string>(() => {
    const isMobile = window.innerWidth <= 1024;
    return isMobile ? '' : 'info';
  });
  const [taskViewMode, setTaskViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedDepForManage, setSelectedDepForManage] = useState<any | null>(null);
  const [tempMilestones, setTempMilestones] = useState<any[]>([]);
  const [isSavingMilestones, setIsSavingMilestones] = useState(false);
  const [actioningMilestoneId, setActioningMilestoneId] = useState<any>(null);
  const [actioningType, setActioningType] = useState<'approve' | 'reject' | null>(null);
  const [sharesData, setSharesData] = useState<any[]>([]);
  
  const [tempExpectedCommission, setTempExpectedCommission] = useState<number>(0);
  const [tempSharesData, setTempSharesData] = useState<any[]>([]);

  const handleTempSharePercentChange = (sIdx: number, val: string) => {
    const updated = [...tempSharesData];
    updated[sIdx].percentage = parseInt(val) || 0;
    setTempSharesData(updated);
  };
  const [showDealModal, setShowDealModal] = useState(false);
  const [depositProjectId, setDepositProjectId] = useState('');
  const [depositUnitCode, setDepositUnitCode] = useState('');
  const [depositPrice, setDepositPrice] = useState('');
  const [depositExpectedCommission, setDepositExpectedCommission] = useState('');
  const [commissionType, setCommissionType] = useState<'percent' | 'amount'>('amount');
  const [commissionPercent, setCommissionPercent] = useState('');
  const [depositMilestones, setDepositMilestones] = useState<{ name: string; amount: string }[]>([
    { name: 'Đợt 1 - Cọc giữ chỗ', amount: '' }
  ]);
  const [depositUncFile, setDepositUncFile] = useState<File | null>(null);
  const [pendingPipelineTransition, setPendingPipelineTransition] = useState<{ targetId: string; targetLabel: string; note: string } | null>(null);
  const [depositCoopShares, setDepositCoopShares] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedDepForManage) {
      setSharesData([]);
      setTempExpectedCommission(Number(selectedDepForManage.expected_commission) || 0);
      setTempSharesData([]);
      api.get(`/cooperation-slips?contact_id=${selectedDepForManage.contact_id}`)
        .then(res => {
          const slips = res.data?.data || res.data || [];
          if (slips.length > 0) {
            const matchedSlip = slips.find((s: any) => Number(s.deposit_slip_id) === Number(selectedDepForManage.id)) || slips[0];
            if (matchedSlip && matchedSlip.shareholders) {
              setSharesData(matchedSlip.shareholders);
              setTempSharesData(matchedSlip.shareholders.map((sh: any) => ({ ...sh })));
            }
          }
        })
        .catch(err => console.error("Error loading cooperation shares in CustomerProfileDrawer:", err));
    }
  }, [selectedDepForManage]);

  useEffect(() => {
    if (commissionType === 'percent' && depositPrice) {
      const pct = parseFloat(commissionPercent) || 0;
      const priceVal = parseFloat(depositPrice) || 0;
      const computedAmt = Math.round(priceVal * pct / 100);
      setDepositExpectedCommission(String(computedAmt));
    }
  }, [commissionType, commissionPercent, depositPrice]);

  const [prevContactId, setPrevContactId] = useState<number | null>(null);
  const [showMobilePipelineSelector, setShowMobilePipelineSelector] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasHighlight = params.has('highlight_activity_id') || params.has('highlight_comment_id');
    const hasHighlightNote = params.has('highlight_note_id');
    
    if (isOpen && hasHighlight) {
      setActiveTab('timeline');
    } else if (isOpen && hasHighlightNote) {
      setActiveTab('tags');
    } else if (isOpen) {
      if (isMobileOrTablet) {
        setActiveTab(''); // On mobile, always default opening to the main tab menu list
      } else {
        setActiveTab(initialTab || 'info');
      }
    }
  }, [isOpen, initialTab, isMobileOrTablet]);

  useEffect(() => {
    if (isOpen && activeTab === 'timeline') {
      const params = new URLSearchParams(window.location.search);
      const highlightActivityId = params.get('highlight_activity_id');
      const highlightCommentId = params.get('highlight_comment_id');
      
      if (highlightActivityId) {
        if (!highlightCommentId) {
          setTimeout(() => {
            const element = document.getElementById(`activity-item-${highlightActivityId}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              const innerContent = element.firstElementChild?.nextElementSibling as HTMLElement;
              if (innerContent) {
                innerContent.style.transition = 'all 0.5s ease';
                innerContent.style.borderColor = 'var(--color-primary)';
                innerContent.style.backgroundColor = 'rgba(189, 29, 45, 0.05)';
                setTimeout(() => {
                  innerContent.style.borderColor = 'var(--color-border-light)';
                  innerContent.style.backgroundColor = 'var(--color-surface)';
                }, 2500);
              }
            }
          }, 300);
        }
        
        // Clean URL parameters after a short delay so children components can read them first
        setTimeout(() => {
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('highlight_activity_id');
          newParams.delete('highlight_comment_id');
          setSearchParams(newParams, { replace: true });
        }, 1200);
      }
    }
  }, [isOpen, activeTab]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (window as any).__setDepositSubmitting = setIsSubmitting;
    (window as any).__showDepositAnimation = (visible: boolean) => {
      setShowDealModal(visible);
      setIsSubmitting(visible);
    };
    return () => {
      delete (window as any).__setDepositSubmitting;
      delete (window as any).__showDepositAnimation;
    };
  }, [setIsSubmitting, setShowDealModal]);
  const lastLoadedContactIdRef = React.useRef<number | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [showScoringSystemModal, setShowScoringSystemModal] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [baseData, setBaseData] = useState<any>(contact || {});
  const [baseTags, setBaseTags] = useState<string[]>(contact?.tags || []);

  const hasChanges = useMemo(() => {
    if (!contact || !formData || !formData.id) return false;
    
    // Allowed fields that are editable in the form
    const editableFields = [
      'company_id', 'company_name', 'owner_id', 'first_name', 'last_name', 'email', 'phone',
      'mobile', 'job_title', 'department', 'source', 'status', 'notes',
      'birthday', 'address', 'city', 'ward', 'expected_revenue', 'win_probability', 'gender', 'zalo_link', 'fb_link', 'customer_type', 'industry', 'budget_range',
      'project_id', 'campaign_id', 'ttl1_completed', 'ttl1_data'
    ];

    const cleanObject = (obj: any) => {
      const clean: any = {};
      editableFields.forEach(key => {
        const val = obj ? obj[key] : undefined;
        clean[key] = (val === null || val === undefined) ? '' : val;
      });
      return clean;
    };

    const serializeCustomFields = (fields: any) => {
      if (!Array.isArray(fields)) return '';
      return fields.map(f => `${f.id}:${f.value === null || f.value === undefined ? '' : f.value}`).sort().join('|');
    };

    const hash1 = JSON.stringify({
      formData: cleanObject(formData),
      tags: tags || [],
      customFields: serializeCustomFields(formData.custom_fields)
    });

    const hash2 = JSON.stringify({
      formData: cleanObject(baseData),
      tags: baseTags || [],
      customFields: serializeCustomFields(baseData.custom_fields)
    });

    return hash1 !== hash2;
  }, [formData, baseData, tags, baseTags, contact]);

  const handleSave = useCallback(async () => {
    // Only send fields that ContactController accepts
    const allowedFields = [
      'company_id', 'company_name', 'owner_id', 'first_name', 'last_name', 'email', 'phone',
      'mobile', 'job_title', 'department', 'source', 'status', 'notes',
      'birthday', 'address', 'city', 'ward', 'expected_revenue', 'win_probability', 'last_contact', 'created_at',
      'gender', 'zalo_link', 'fb_link', 'customer_type', 'industry', 'budget_range', 'project_id', 'campaign_id', 'ttl1_completed', 'ttl1_data',
      'stage_id', 'pipeline_status', 'temperature', 'suggested_temperature', 'collaborator_ids'
    ];
    const payload: Record<string, any> = {};
    allowedFields.forEach(f => { if (formData[f] !== undefined) payload[f] = formData[f]; });
    payload.tags = tags;
    payload.lead_score = score;
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
      window.dispatchEvent(new CustomEvent('contact-updated'));
      addToast(`Đã lưu thông tin hồ sơ của khách hàng ${fullName || ''} thành công!`, 'success');
    } catch (e: any) {
      addToast(e?.response?.data?.message || 'Không thể lưu hồ sơ khách hàng. Vui lòng kiểm tra lại dữ liệu đầu vào.', 'error');
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
  const [meetingToComplete, setMeetingToComplete] = useState<any | null>(null);
  const [proofImageFile, setProofImageFile] = useState<File | null>(null);
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null);
  const [proofCommentText, setProofCommentText] = useState('Ảnh minh chứng hoàn thành gặp gỡ');
  const [completingMeeting, setCompletingMeeting] = useState(false);
  const [activeMeetingMenuId, setActiveMeetingMenuId] = useState<number | null>(null);
  const [reschedulingMeeting, setReschedulingMeeting] = useState<any | null>(null);
  const [newMeetingTime, setNewMeetingTime] = useState<string>('');
  const [updatingMeetingTime, setUpdatingMeetingTime] = useState(false);
  const [cancellingMeeting, setCancellingMeeting] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [savingCancel, setSavingCancel] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [editingDealId, setEditingDealId] = useState<number | null>(null);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReasonType, setReportReasonType] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportReasons, setReportReasons] = useState<any[]>([]);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<any>(null);
  const [taskComments, setTaskComments] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<Array<{ text: string; checked: boolean }>>([]);

  const parseDescriptionAndChecklist = (descText: string) => {
    const lines = descText ? descText.split('\n') : [];
    const descLines: string[] = [];
    const checklistItems: Array<{ text: string; checked: boolean }> = [];
    
    lines.forEach(line => {
      const match = line.match(/^\s*-\s*\[([ xX])\]\s*(.*)$/);
      if (match) {
        checklistItems.push({
          checked: match[1].toLowerCase() === 'x',
          text: match[2].trim()
        });
      } else {
        descLines.push(line);
      }
    });
    
    return {
      pureDescription: descLines.join('\n').trim(),
      checklist: checklistItems
    };
  };

  const serializeDescriptionAndChecklist = (pureDesc: string, items: Array<{ text: string; checked: boolean }>) => {
    let result = pureDesc.trim();
    if (items.length > 0) {
      const checklistStr = items.map(item => `- [${item.checked ? 'x' : ' '}] ${item.text}`).join('\n');
      result += (result ? '\n\n' : '') + checklistStr;
    }
    return result;
  };

  const addChecklistItem = async () => {
    const newChecklist = [...checklist, { text: '', checked: false }];
    setChecklist(newChecklist);
    await handleUpdateTaskDetail({ checklist: newChecklist });
  };

  const toggleChecklistItem = async (idx: number) => {
    const newChecklist = checklist.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c);
    setChecklist(newChecklist);
    await handleUpdateTaskDetail({ checklist: newChecklist });
  };

  const updateChecklistItemText = (idx: number, val: string) => {
    setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, text: val } : c));
  };

  const handleChecklistItemBlur = async () => {
    await handleUpdateTaskDetail({ checklist });
  };

  const removeChecklistItem = async (idx: number) => {
    const newChecklist = checklist.filter((_, i) => i !== idx);
    setChecklist(newChecklist);
    await handleUpdateTaskDetail({ checklist: newChecklist });
  };

  const [loadingTaskComments, setLoadingTaskComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [showApproverDropdown, setShowApproverDropdown] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [uploadingFileObj, setUploadingFileObj] = useState<any>(null);
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
  const [noteSaleTemp, setNoteSaleTemp] = useState<'cold' | 'cool' | 'neutral' | 'warm' | 'hot' | ''>('');
  const [tempSuggestionCallDuration, setTempSuggestionCallDuration] = useState<number>(300);
  const [tempSuggestionRequiredNotes, setTempSuggestionRequiredNotes] = useState<number>(2);
  const [notes, setNotes] = useState<{ id: number; text: string; time: string; user: string; user_id?: number; user_avatar?: string | null; attachment_url?: string | null; edit_history?: any; channel?: string; note_type?: string; duration_minutes?: number; stuck_tag?: string; suggested_temperature?: string; sale_temperature?: string; documents_sent?: string }[]>([]);
  
  const calculatedSuggestedTemp = useMemo(() => {
    if (noteChannel === 'meet') {
      return 'warm'; // Nóng
    }
    const durationSec = parseInt(noteDuration, 10) || 0;
    if (noteChannel === 'call' && durationSec > tempSuggestionCallDuration && notes.length >= tempSuggestionRequiredNotes) {
      return 'neutral'; // Ấm
    }
    return 'cold'; // Lạnh
  }, [noteChannel, noteDuration, notes.length, tempSuggestionCallDuration, tempSuggestionRequiredNotes]);

  useEffect(() => {
    if (isOpen && activeTab === 'tags' && notes.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const highlightNoteId = params.get('highlight_note_id');
      if (highlightNoteId) {
        setTimeout(() => {
          const element = document.getElementById(`customer-note-${highlightNoteId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.boxShadow = '0 0 0 4px rgba(189, 29, 45, 0.2)';
            element.style.borderColor = 'var(--color-primary)';
            setTimeout(() => {
              element.style.boxShadow = '0 4px 12px rgba(234, 179, 8, 0.05)';
              element.style.borderColor = '#fef08a';
            }, 2500);
            
            // Clean URL parameters
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('highlight_note_id');
            setSearchParams(newParams, { replace: true });
          }
        }, 300);
      }
    }
  }, [isOpen, activeTab, notes, searchParams, setSearchParams]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [allowedProjects, setAllowedProjects] = useState<any[]>([]);
  const [allowedCampaigns, setAllowedCampaigns] = useState<any[]>([]);
  const [allowedTeams, setAllowedTeams] = useState<any[]>([]);
  const [pipelineModal, setPipelineModal] = useState<{ isOpen: boolean; targetId: string; targetLabel: string; note: string }>({ isOpen: false, targetId: '', targetLabel: '', note: '' });
  const [users, setUsers] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [activeOverCol, setActiveOverCol] = useState<'todo' | 'in_progress' | 'done' | null>(null);
  const [zaloSource, setZaloSource] = useState<'primary' | 'secondary' | 'none'>('none');
  const [loadingContactDetails, setLoadingContactDetails] = useState(false);

  if (isOpen && contact?.id && contact.id !== prevContactId && !loadingContactDetails) {
    setLoadingContactDetails(true);
  }

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

  const [allowPipelineBackward, setAllowPipelineBackward] = useState<boolean>(false);
  const [allowPipelineSkip, setAllowPipelineSkip] = useState<boolean>(false);

  // Cooperation Slip States and Functions (Module 4)
  const [coopSlip, setCoopSlip] = useState<any>(null);
  const [coopLoading, setCoopLoading] = useState(false);
  const [coopEligibleStatuses, setCoopEligibleStatuses] = useState<string[]>([]);
  const [coopDefaultFiles, setCoopDefaultFiles] = useState<string[]>([]);
  const [requiredDocsUploadModal, setRequiredDocsUploadModal] = useState<{
    isOpen: boolean;
    missingFiles: string[];
    targetId: string;
    targetLabel: string;
    note: string;
    uploadedFiles: { [key: string]: boolean };
    isUploading: { [key: string]: boolean };
  }>({
    isOpen: false,
    missingFiles: [],
    targetId: '',
    targetLabel: '',
    note: '',
    uploadedFiles: {},
    isUploading: {}
  });
  const [salesUsers, setSalesUsers] = useState<any[]>([]);
  const [coopShares, setCoopShares] = useState<{ user_id: string; percentage: string }[]>([]);
  const [coopError, setCoopError] = useState('');
  const [isRequestingChange, setIsRequestingChange] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  
  const [isCreateCoopModalOpen, setIsCreateCoopModalOpen] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [suggestedSales, setSuggestedSales] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [collabSearchQuery, setCollabSearchQuery] = useState('');

  const getCoopCollaboratorIds = useCallback(() => {
    const ownerId = String(contact?.owner_id || formData?.owner_id || currentUser?.id || '');
    let ids: string[] = [];

    const rawCollab = formData?.collaborator_ids ?? contact?.collaborator_ids;
    if (Array.isArray(rawCollab)) {
      ids.push(...rawCollab.map(x => String(x).trim()));
    } else if (typeof rawCollab === 'string') {
      ids.push(...rawCollab.split(',').map(x => x.trim()));
    } else if (rawCollab) {
      ids.push(String(rawCollab).trim());
    }

    if (Array.isArray(selectedCollaborators)) {
      ids.push(...selectedCollaborators.map(x => String(x).trim()));
    }

    if (coopSlip) {
      if (coopSlip.shares_json) {
        try {
          const parsed = typeof coopSlip.shares_json === 'string' ? JSON.parse(coopSlip.shares_json) : coopSlip.shares_json;
          if (parsed && typeof parsed === 'object') {
            ids.push(...Object.keys(parsed).map(x => String(x).trim()));
          }
        } catch (e) {}
      }
      if (Array.isArray(coopSlip.shareholders)) {
        ids.push(...coopSlip.shareholders.map((s: any) => String(s.user_id || s.id).trim()));
      }
    }

    return Array.from(new Set(ids)).filter(id => Boolean(id) && id !== ownerId && id !== '0');
  }, [contact, formData, selectedCollaborators, coopSlip, currentUser?.id]);

  useEffect(() => {
    if (showDealModal && contact) {
      const ownerId = String(contact.owner_id || formData?.owner_id || currentUser?.id || '');
      const collabList = getCoopCollaboratorIds();
      const allMemberIds = Array.from(new Set([ownerId, ...collabList].filter(Boolean)));

      if (allMemberIds.length > 1) {
        let existingShares: Record<string, string> = {};
        if (coopSlip?.shares_json) {
          try {
            const parsed = typeof coopSlip.shares_json === 'string' ? JSON.parse(coopSlip.shares_json) : coopSlip.shares_json;
            if (parsed && typeof parsed === 'object') {
              Object.entries(parsed).forEach(([uid, pct]) => {
                existingShares[uid] = String(pct);
              });
            }
          } catch (e) {}
        }

        const basePct = Math.floor(100 / allMemberIds.length);
        const remainder = 100 - (basePct * allMemberIds.length);
        const initial: Record<string, string> = {};
        allMemberIds.forEach((uid, idx) => {
          initial[uid] = existingShares[uid] || String(idx === 0 ? basePct + remainder : basePct);
        });
        setDepositCoopShares(initial);
      } else {
        setDepositCoopShares({ [ownerId]: '100' });
      }
    }
  }, [showDealModal, contact, formData?.collaborator_ids, selectedCollaborators, coopSlip, currentUser?.id, getCoopCollaboratorIds]);

  const handleToggleCollaborator = (userId: string) => {
    setSelectedCollaborators(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      }
      if (prev.length >= 2) {
        addToast('Chỉ được chọn tối đa 2 nhân sự hợp tác', 'warning');
        return prev;
      }
      return [...prev, userId];
    });
  };

  const [docs, setDocs] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);

  const isOwnerOrAdmin = useMemo(() => {
    const scope = getModulePermissionScope(currentUser, 'leads', 'write');
    if (scope === 'all') return true;
    if (scope === 'team') {
      const userTeamId = (currentUser as any)?.team_id || (currentUser as any)?.consultant_profile?.team_id;
      if (userTeamId && Number(contact?.team_id || formData.team_id) === Number(userTeamId)) return true;
    }
    
    const isCollaborator = (formData.collaborator_ids || contact?.collaborator_ids || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)
      .includes(String(currentUser?.id));
    if (isCollaborator) return true;

    const isShareholder = coopSlip?.shareholders?.some((sh: any) => String(sh.user_id) === String(currentUser?.id) || String(sh.user_id) === String(currentUser?.consultant_id));
    if (isShareholder) return true;

    if (scope === 'own') {
      return Number(currentUser?.id) === Number(formData.owner_id || contact?.owner_id) || Number(currentUser?.consultant_id) === Number(formData.owner_id || contact?.owner_id);
    }
    if (scope === 'none') return false;

    if (currentUser?.role === 'viewer') return false;
    const isOwner = Number(currentUser?.id) === Number(formData.owner_id || contact?.owner_id);
    const isAdmin = currentUser?.role && ['admin', 'superadmin', 'super_admin', 'assistant', 'director', 'manager'].includes(currentUser.role);
    return isOwner || isAdmin;
  }, [currentUser, formData.owner_id, contact?.owner_id, contact?.team_id, formData.team_id, formData.collaborator_ids, contact?.collaborator_ids, coopSlip]);
  const isAdmin = currentUser?.role && ['admin', 'superadmin', 'super_admin', 'assistant', 'director', 'manager'].includes(currentUser.role);
  const isViewer = currentUser?.role === 'viewer';
  const isMainOwnerOrManagerAdmin = useMemo(() => {
    if (['admin', 'superadmin', 'super_admin', 'director', 'manager', 'assistant'].includes(currentUser?.role || '')) return true;
    return Number(currentUser?.id) === Number(formData.owner_id || contact?.owner_id);
  }, [currentUser, formData.owner_id, contact?.owner_id]);

  const collabsList = useMemo(() => {
    const ids = (formData.collaborator_ids || contact?.collaborator_ids || '')
      .split(',')
      .map((id: string) => id.trim())
      .filter(Boolean);
    return ids.map(id => users.find(u => String(u.id) === String(id))).filter(Boolean);
  }, [formData.collaborator_ids, contact?.collaborator_ids, users]);

  const [decayDays, setDecayDays] = useState<number>(5);
  const handleSaveTTL1 = async (updatedData: typeof ttl1Data) => {
    setIsSavingTTL1(true);
    const count = Object.values(updatedData).filter(Boolean).length;
    const completed = count >= 4 ? 1 : 0;
    
    // Optimistic local state update
    setFormData((prev: any) => ({ ...prev, ttl1_completed: completed, ttl1_data: JSON.stringify(updatedData) }));

    try {
      await api.put(`/contacts/${contact.id}`, {
        ttl1_completed: completed,
        ttl1_data: JSON.stringify(updatedData)
      });
      addToast('Cập nhật Form TTL1 thành công!', 'success');
      onUpdate?.({ ...formData, ttl1_completed: completed, ttl1_data: JSON.stringify(updatedData) });
      window.dispatchEvent(new CustomEvent('contact-updated'));
    } catch (e: any) {
      addToast('Lỗi khi lưu Form TTL1', 'error');
    } finally {
      setIsSavingTTL1(false);
    }
  };

  // Cooperation Slip Functions (Module 4)

  const isCoopShareholder = useMemo(() => {
    if (!coopSlip || !currentUser) return false;
    return coopSlip.shareholders?.some((sh: any) => String(sh.user_id) === String(currentUser.id) || String(sh.user_id) === String(currentUser.consultant_id));
  }, [coopSlip, currentUser]);

  const isCoopCreator = useMemo(() => {
    if (!coopSlip || !currentUser) return false;
    return String(coopSlip.created_by) === String(currentUser.id);
  }, [coopSlip, currentUser]);

  const isCoopApprover = useMemo(() => {
    if (!currentUser) return false;
    return ['admin', 'superadmin', 'super_admin', 'director'].includes(currentUser.role);
  }, [currentUser]);

  const canEditShares = useMemo(() => {
    if (!coopSlip) return false;
    const inEditableState = coopSlip.status === 'pending_signatures' || coopSlip.status === 'approved_pending_signatures' || coopSlip.status === 'rejected';
    if (inEditableState) {
      return isCoopCreator || isCoopApprover;
    }
    return isRequestingChange && (isCoopShareholder || isCoopCreator || isCoopApprover);
  }, [coopSlip, isCoopCreator, isCoopApprover, isRequestingChange, isCoopShareholder]);

  const canManageCoopAttachments = useMemo(() => {
    const isOwner = Number(currentUser?.id) === Number(formData.owner_id || contact?.owner_id);
    return isCoopApprover || isCoopCreator || isOwner;
  }, [isCoopApprover, isCoopCreator, currentUser?.id, formData.owner_id, contact?.owner_id]);

  const checkFileExists = useCallback((fileKeyword: string) => {
    const cleanKeyword = fileKeyword.split('.')[0].toLowerCase().trim();
    if (!cleanKeyword) return false;

    // 1. Check coopSlip attachments
    const files = coopSlip?.attachment_url ? coopSlip.attachment_url.split(',') : [];
    const existsInCoop = files.some((f: string) => {
      const filename = f.split('/').pop() || '';
      const lower = (f + ' ' + filename).toLowerCase();
      if (cleanKeyword === 'unc' || cleanKeyword === 'uy nhiem chi' || cleanKeyword === 'ủy nhiệm chi') {
        return lower.includes('unc') || lower.includes('uy nhiem chi') || lower.includes('ủy nhiệm chi') || lower.includes('deposits');
      }
      return lower.includes(cleanKeyword);
    });
    if (existsInCoop) return true;

    // 2. Check profile document files (cloud_files / docs)
    if (docs && docs.length > 0) {
      const existsInDocs = docs.some((d: any) => {
        const name = (d.name || '').toLowerCase();
        const cat = (d.category || d.folder || '').toLowerCase();
        const path = (d.path || d.file_path || '').toLowerCase();
        if (cleanKeyword === 'unc' || cleanKeyword === 'uy nhiem chi' || cleanKeyword === 'ủy nhiệm chi') {
          return name.includes('unc') || name.includes('cọc') || name.includes('đặt cọc') || name.includes('uy nhiem chi') || name.includes('ủy nhiệm chi') || cat.includes('đặt cọc') || cat.includes('unc') || path.includes('deposits');
        }
        return name.includes(cleanKeyword) || cat.includes(cleanKeyword);
      });
      if (existsInDocs) return true;
    }

    // 3. Check deals / deposits milestone proofs
    if (deals && deals.length > 0) {
      const existsInDeals = deals.some((d: any) => {
        const ms = d.milestones || [];
        return ms.some((m: any) => {
          const uPath = (m.unc_file_path || m.attachment_url || '').toLowerCase();
          const mName = (m.name || m.milestone_name || '').toLowerCase();
          if (cleanKeyword === 'unc' || cleanKeyword === 'uy nhiem chi' || cleanKeyword === 'ủy nhiệm chi') {
            return uPath.length > 0 || mName.includes('cọc') || mName.includes('unc');
          }
          return uPath.includes(cleanKeyword) || mName.includes(cleanKeyword);
        });
      });
      if (existsInDeals) return true;
    }

    return false;
  }, [coopSlip?.attachment_url, docs, deals]);

  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signatureMethod, setSignatureMethod] = useState<'draw' | 'upload'>('draw');
  const [uploadedSignatureImg, setUploadedSignatureImg] = useState<string | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const isDrawing = React.useRef(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    isDrawing.current = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (e.cancelable) {
      e.preventDefault();
    }

    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const fetchCoopSlip = async () => {
    if (!contact?.id) return;
    setCoopLoading(true);
    setCoopError('');
    try {
      const usersEndpoint = 'users?all=1';
      const [resSlips, resUsers, resDocs, resDeposits] = await Promise.all([
        fetchAPI('cooperation-slips'),
        fetchAPI(usersEndpoint),
        api.get(`/cloud-files?contact_id=${contact.id}&limit=1000`).catch(() => ({ data: { data: { items: [] } } })),
        api.get(`/deposits?contact_id=${contact.id}`).catch(() => ({ data: { data: [] } }))
      ]);
      
      const docsData = resDocs?.data?.data?.items || [];
      const mappedDocs = docsData.map((d: any) => ({
        id: d.id,
        name: d.name,
        category: d.category || d.folder || 'general',
        folder: d.folder || d.category || 'general',
        path: d.file_path,
        date: d.created_at ? new Date(d.created_at).toLocaleDateString('vi-VN') : '—',
        type: d.name ? d.name.split('.').pop() : 'file'
      }));

      const depositsData = resDeposits?.data?.data || [];
      const depositsList = (Array.isArray(depositsData) ? depositsData : []).map((d: any) => ({
        id: d.id,
        title: `${d.project_name} - Căn ${d.unit_code}`,
        value: d.price,
        unit_code: d.unit_code,
        price: d.price,
        milestones: d.milestones || [],
        contact_id: d.contact_id
      }));

      // Merge deposit milestone payment proofs (UNC) into docs
      depositsList.forEach((dep: any) => {
        const milestones = dep.milestones || [];
        milestones.forEach((m: any) => {
          const fileUrl = m.unc_file_path || m.attachment_url;
          if (fileUrl) {
            const filename = (() => {
              const base = fileUrl.split('/').pop() || `${m.name || 'Cọc'}_UNC`;
              try { return decodeURIComponent(base); } catch (e) { return base; }
            })();
            const fileExt = filename.split('.').pop() || 'png';
            const exists = mappedDocs.some((d: any) => d.path === fileUrl);
            if (!exists) {
              mappedDocs.push({
                id: `milestone_attachment_${m.id}`,
                name: filename,
                date: m.updated_at ? new Date(m.updated_at).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
                size: '—',
                type: fileExt,
                path: fileUrl,
                category: 'Đặt cọc',
                folder: 'Đặt cọc',
                isMilestoneAttachment: true
              });
            }
          }
        });
      });

      setDocs(mappedDocs);
      setDeals(depositsList);

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

          // Merge coop slip attachment files into docs if any
          if (found.attachment_url) {
            const coopFiles = found.attachment_url.split(',').map((s: string) => s.trim()).filter(Boolean);
            coopFiles.forEach((fileUrl: string, idx: number) => {
              const filename = fileUrl.split('/').pop() || 'coop_file';
              const exists = mappedDocs.some((d: any) => d.path === fileUrl);
              if (!exists) {
                mappedDocs.push({
                  id: `coop_slip_attachment_${idx}`,
                  name: filename,
                  date: found.created_at ? new Date(found.created_at).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
                  size: '—',
                  type: filename.split('.').pop() || 'file',
                  path: fileUrl,
                  category: 'Tài liệu Hợp tác & Hoa hồng',
                  folder: 'Tài liệu Hợp tác & Hoa hồng',
                  isCoopAttachment: true
                });
              }
            });
            setDocs([...mappedDocs]);
          }
        }
      }

      if (resUsers.success) {
        const mapped = (resUsers.data || []).map((u: any) => ({
          ...u,
          value: String(u.id),
          label: u.full_name || u.name,
          full_name: u.full_name || u.name,
          role: u.role || 'sale'
        }));
        setSalesUsers(mapped);
      }
    } catch (e: any) {
      setCoopError(e.message || 'Lỗi tải dữ liệu hợp tác');
    }
    setCoopLoading(false);
  };

  useEffect(() => {
    if (contact?.id) {
      fetchCoopSlip();
    }
  }, [contact?.id]);

  const handleCreateCoopSlip = async () => {
    // Validate customer status
    const currentStatus = baseData?.pipeline_status || contact?.pipeline_status || 'chua_xac_dinh';
    if (coopEligibleStatuses.length > 0 && !coopEligibleStatuses.includes(currentStatus)) {
      const allowedLabels = coopEligibleStatuses.map(slug => {
        const foundStage = pipelineStages.find(s => s.id === slug);
        return foundStage ? foundStage.name : slug;
      }).join(', ');
      addToast(`Không thể khởi tạo phiếu hợp tác. Khách hàng phải ở trạng thái: ${allowedLabels}`, 'error');
      return;
    }

    setCollabSearchQuery('');
    
    // Auto-fill existing collaborators (chăm sóc chung) if they exist
    const existingCollabs = (formData.collaborator_ids || contact?.collaborator_ids || '')
      .split(',')
      .map((id: string) => id.trim())
      .filter((id: string) => Boolean(id) && id !== String(contact?.owner_id || formData?.owner_id));
      
    setSelectedCollaborators(existingCollabs);
    setSuggestedSales([]);
    setIsCreateCoopModalOpen(true);
    setLoadingSuggestions(true);
    try {
      const res = await fetchAPI(`cooperation-slips/suggestions?contact_id=${contact.id}`);
      if (res.success) {
        setSuggestedSales(res.data || []);
      }
    } catch (e) {
      console.error("Error fetching suggestions:", e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSaveCoopShares = async () => {
    if (!coopSlip) return;
    const sum = coopShares.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);
    if (sum > 100) {
      addToast('Tổng tỷ lệ chia sẻ hoa hồng không được vượt quá 100% (Hiện tại là ' + sum + '%)', 'error');
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

  const handleCoopAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !coopSlip) return;
    const file = e.target.files[0];
    const inputTarget = e.target;
    
    const originalName = file.name;
    const defaultName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const ext = originalName.substring(originalName.lastIndexOf('.'));

    showConfirm({
      title: 'Tải lên tài liệu đính kèm',
      message: 'Nhập tên cho tài liệu hợp tác này trước khi tải lên:',
      requirePromptInput: true,
      promptPlaceholder: defaultName,
      confirmText: 'Tải lên',
      cancelText: 'Hủy',
      onConfirm: async (customName) => {
        const finalName = ((customName && customName.trim()) || defaultName) + ext;
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
            addToast('Tải lên tài liệu thành công!', 'success');
            await fetchCoopSlip();
          } else {
            addToast(res.data.message || 'Lỗi khi tải lên tài liệu', 'error');
          }
        } catch (e: any) {
          addToast(e.message, 'error');
        } finally {
          setCoopLoading(false);
        }
      },
      onCancel: () => {
        inputTarget.value = '';
      }
    });
  };
  const handleUploadRequiredDoc = async (docName: string, file: File) => {
    let finalName = file.name;
    const ext = file.name.split('.').pop() || '';
    const cleanDocName = docName.split('.')[0];
    if (!finalName.toLowerCase().includes(cleanDocName.toLowerCase())) {
      finalName = `${cleanDocName}_${contact.name || 'document'}.${ext}`;
    }
    
    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
      try {
        fileToUpload = await compressToWebP(file);
      } catch (e) {
        console.error('Compression failed, uploading original', e);
      }
    }
    const renamedFile = new File([fileToUpload], finalName, { type: fileToUpload.type });
    
    const fData = new FormData();
    fData.append('file', renamedFile);
    fData.append('contact_id', String(contact.id));
    fData.append('category', 'general');
    fData.append('visibility', 'shared');
    
    setRequiredDocsUploadModal(prev => ({
      ...prev,
      isUploading: { ...prev.isUploading, [docName]: true }
    }));
    
    try {
      await api.post('/cloud-files', fData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      addToast(`Tải lên tài liệu ${cleanDocName} thành công.`, 'success');
      setRequiredDocsUploadModal(prev => ({
        ...prev,
        uploadedFiles: { ...prev.uploadedFiles, [docName]: true },
        isUploading: { ...prev.isUploading, [docName]: false }
      }));
      fetchData();
    } catch (err) {
      addToast(`Lỗi khi tải lên tài liệu ${cleanDocName}`, 'error');
      setRequiredDocsUploadModal(prev => ({
        ...prev,
        isUploading: { ...prev.isUploading, [docName]: false }
      }));
    }
  };

  const handleCompleteTransitionWithDocs = async () => {
    const allUploaded = requiredDocsUploadModal.missingFiles.every(
      f => requiredDocsUploadModal.uploadedFiles[f]
    );
    if (!allUploaded) {
      addToast('Vui lòng tải lên đầy đủ các tài liệu yêu cầu!', 'error');
      return;
    }
    
    const targetId = requiredDocsUploadModal.targetId;
    const targetLabel = requiredDocsUploadModal.targetLabel;
    const note = requiredDocsUploadModal.note;
    
    setRequiredDocsUploadModal({
      isOpen: false,
      missingFiles: [],
      targetId: '',
      targetLabel: '',
      note: '',
      uploadedFiles: {},
      isUploading: {}
    });
    
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
    
    setFormData((prev: any) => ({ 
      ...prev, 
      pipeline_status: targetId, 
      status: calculatedStatus 
    }));
    
    try {
      await api.put(`/contacts/${contact.id}`, { 
        pipeline_status: targetId, 
        status: calculatedStatus,
        ttl1_completed: formData.ttl1_completed,
        ttl1_data: formData.ttl1_data
      });
      await api.post('/activities', {
        type: 'note',
        subject: `Chuyển trạng thái Pipeline → ${targetLabel}`,
        body: note || null,
        status: 'done',
        related_type: 'contact',
        related_id: contact.id,
        contact_id: contact.id,
        user_id: currentUser?.id,
        due_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
        done_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
      });
      fetchData();
      addToast(`Đã cập nhật trạng thái pipeline của ${fullName || 'khách hàng'} sang "${targetLabel}" thành công!`, 'success');
      window.dispatchEvent(new CustomEvent('contact-updated'));
    } catch (e: any) {
      setFormData((prev: any) => ({ 
        ...prev, 
        pipeline_status: contact.pipeline_status, 
        status: contact.status 
      }));
      addToast(e?.response?.data?.message || `Không thể chuyển trạng thái pipeline sang "${targetLabel}". Vui lòng thử lại.`, 'error');
    }
  };
  const handleRemoveCoopAttachment = async (fileUrl: string) => {
    if (!coopSlip) return;
    setCoopLoading(true);
    try {
      const res = await fetchAPI(`cooperation-slips/${coopSlip.id}/delete-attachment`, {
        method: 'POST',
        body: JSON.stringify({ file_url: fileUrl })
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

  const handleSignCoopSlip = async (signatureImg: string) => {
    if (!coopSlip) return;

    // Check for expected revenue
    if (!formData.expected_revenue || Number(formData.expected_revenue) === 0) {
      addToast('Vui lòng nhập Doanh thu dự kiến trước khi ký xác nhận!', 'error');
      return;
    }

    // Check for mandatory files based on admin configuration using checkFileExists helper
    if (coopDefaultFiles && coopDefaultFiles.length > 0) {
      for (const mandatoryFile of coopDefaultFiles) {
        if (!checkFileExists(mandatoryFile)) {
          addToast(`Vui lòng upload tài liệu ${mandatoryFile} trước khi ký xác nhận!`, 'error');
          return;
        }
      }
    } else {
      // Fallback safeguard: check if UNC file exists anywhere via checkFileExists
      if (!checkFileExists('UNC') && !checkFileExists('Ủy nhiệm chi') && !checkFileExists('uy nhiem chi')) {
        addToast('Vui lòng upload tài liệu UNC (Ủy nhiệm chi) trước khi ký xác nhận!', 'error');
        return;
      }
    }

    setCoopLoading(true);
    try {
      const res = await fetchAPI(`cooperation-slips/${coopSlip.id}/sign`, {
        method: 'POST',
        body: JSON.stringify({ signature_img: signatureImg })
      });
      if (res.success) {
        addToast('Đã ký xác nhận phân chia hoa hồng thành công!', 'success');
        setIsSignModalOpen(false);
        await fetchCoopSlip();
      } else {
        addToast(res.message || 'Lỗi ký xác nhận', 'error');
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    }
    setCoopLoading(false);
  };


  const [ticketForm, setTicketForm] = useState({ subject: '', category: 'technical_support', priority: 'medium', description: '' });
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
      user_id: String(currentUser?.id || contact?.owner_id || ''),
      progress: 0,
      require_approval: 0,
      approver_id: '',
      participant_ids: [] as string[],
      related_contact_ids: [] as string[],
      checklist: [] as any[],
      recurrence_pattern: 'none',
      recurrence_weekly_days: [] as number[],
      recurrence_monthly_day: 1,
      project_id: '',
      campaign_id: '',
      team_id: '',
      campaign_target: ''
    };
  });

  const [subTaskTitle, setSubTaskTitle] = useState('');
  const [subTaskAssignee, setSubTaskAssignee] = useState('');


  const [drawerTaskFilter, setDrawerTaskFilter] = useState<'all' | 'assigned_to_me' | 'approve_by_me' | 'collaborator'>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'call' | 'email' | 'meeting' | 'task'>('all');
  const [viewExpense, setViewExpense] = useState<any>(null);
  const [rejectingExpense, setRejectingExpense] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);
  const [isRefundingExpense, setIsRefundingExpense] = useState(false);
  const [refundExpenseImgUrl, setRefundExpenseImgUrl] = useState('');
  const [uploadingExpenseRefund, setUploadingExpenseRefund] = useState(false);
  const [submittingExpenseRefund, setSubmittingExpenseRefund] = useState(false);

  useEffect(() => {
    setIsRefundingExpense(false);
    setRefundExpenseImgUrl('');
    setUploadingExpenseRefund(false);
    setSubmittingExpenseRefund(false);
    setRejectingExpense(null);
    setRejectReason('');
    setSubmittingReject(false);
  }, [viewExpense]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    addToast('Đã sao chép: ' + text, 'success');
    setTimeout(() => setCopiedField(null), 1200);
  };

  const getDueDateLabel = (dateStr: string | null | undefined, isDone: boolean) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Hạn hoàn thành: ' + dateStr;
    if (isDone) return 'Hạn hoàn thành: ' + d.toLocaleDateString('vi-VN');
    const today = new Date().setHours(0,0,0,0);
    const due = d.setHours(0,0,0,0);
    if (due === today) return 'Hôm nay';
    if (due < today) {
      const diff = Math.ceil((today - due) / (1000 * 60 * 60 * 24));
      return `Trễ ${diff} ngày`;
    }
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (diff <= 7) return `Còn ${diff} ngày`;
    return d.toLocaleDateString('vi-VN');
  };

  const handleTimelineItemClick = (ev: any) => {
    // Check if it's an expense log
    const match = ev.title.match(/Ghi nhận Chi phí:\s*(.*)/i);
    if (match) {
      const expTitle = match[1].trim();
      const foundExp = drawerExpenses.find((e: any) => e.title.toLowerCase() === expTitle.toLowerCase());
      if (foundExp) {
        setViewExpense(foundExp);
        return;
      }
    }
    
    if (ev.type !== 'task') {
      // Non-task items (notes, system alerts) should not trigger modal edit when clicking their body.
      return;
    }
    
    // Fallback to task details modal
    if (ev.rawActivity) {
      setSelectedTaskForDetails(ev.rawActivity);
    }
  };

  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [localFolders, setLocalFolders] = useState<string[]>([]);
  const [movingFile, setMovingFile] = useState<any>(null);

  useEffect(() => {
    if (contact?.id) {
      setCurrentFolder('');
      try {
        const saved = localStorage.getItem(`richland_folders_contact_${contact.id}`);
        setLocalFolders(saved ? JSON.parse(saved) : []);
      } catch {
        setLocalFolders([]);
      }
    }
  }, [contact?.id]);

  const allFolders = useMemo(() => {
    const docCategories = docs
      .map(d => d.category || d.folder)
      .filter(c => c && c !== 'general' && c !== 'shared');
    const hasDeposits = (deals && deals.length > 0) || docs.some(d => d.category === 'Đặt cọc' || d.folder === 'Đặt cọc' || d.isMilestoneAttachment);
    const extraFolders = hasDeposits ? ['Đặt cọc'] : [];
    return Array.from(new Set([...localFolders, ...docCategories, ...extraFolders]));
  }, [localFolders, docs, deals]);

  const visibleDocs = useMemo(() => {
    if (currentFolder === '') {
      return docs.filter(d => !d.category || d.category === 'general' || d.category === 'shared' || !allFolders.includes(d.category));
    } else {
      return docs.filter(d => (d.category || d.folder) === currentFolder);
    }
  }, [docs, currentFolder, allFolders]);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [drawerInvoices, setDrawerInvoices] = useState<any[]>([]);
  const [drawerQuotes, setDrawerQuotes] = useState<any[]>([]);
  const [drawerExpenses, setDrawerExpenses] = useState<any[]>([]);
  const [drawerTickets, setDrawerTickets] = useState<any[]>([]);
  const [drawerActivities, setDrawerActivities] = useState<any[]>([]);
  const [showQuoteEditor, setShowQuoteEditor] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [quickUserCard, setQuickUserCard] = useState<{ id: number; name: string; role: string; email?: string; phone?: string; vacationMode?: number; avatarUrl?: string; visible: boolean; x: number; y: number } | null>(null);
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
    const cleanName = (n: string) => (n || '').trim().replace(/\s+/g, '_').toLowerCase();
    const searchVal = cleanName(name);
    const user = users.find(u => {
      const uName = cleanName(u.full_name || u.name || u.username || '');
      return uName === searchVal || uName.includes(searchVal) || searchVal.includes(uName);
    });

    setQuickUserCard({
      id: user?.id || 0,
      name: user?.full_name || name,
      role: user?.role || 'sales',
      email: user?.email,
      phone: user?.phone || user?.phone_number || '',
      vacationMode: user?.vacation_mode,
      avatarUrl: (user?.avatar_url || user?.avatar) ? resolveAttachmentUrl(user.avatar_url || user.avatar || '') : '',
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  const formatNote = (text: string) => {
    if (!text) return '';
    const parts = text.split(/(@[a-zA-Z0-9_\u00C0-\u1EF9]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.substring(1);
        const cleanName = (n: string) => (n || '').trim().replace(/\s+/g, '_').toLowerCase();
        const searchVal = cleanName(name);
        const taggedUser = users.find(u => {
          const uName = cleanName(u.full_name || u.name || u.username || '');
          return uName === searchVal || uName.includes(searchVal);
        });

        const displayName = taggedUser?.full_name || name.replace(/_/g, ' ');
        const avatarUrl = taggedUser?.avatar_url || taggedUser?.avatar;

        return (
          <span
            key={i}
            onClick={(e) => showUserCard(e, displayName)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--color-primary)',
              background: 'rgba(163, 20, 34, 0.05)',
              border: '1px solid rgba(163, 20, 34, 0.15)',
              padding: '2px 8px',
              borderRadius: '9999px',
              margin: '0 2px',
              fontWeight: 600,
              fontSize: '0.85em',
              verticalAlign: 'middle',
              cursor: 'pointer'
            }}
          >
            <Avatar name={displayName} src={avatarUrl} size={14} />
            @{displayName}
          </span>
        );
      }
      return part;
    });
  };

  const fetchData = useCallback(async (targetTab?: string, forceFreshContact = false) => {
    if (!contact?.id) return;
    const tabToLoad = targetTab || activeTab;

    setLoadingRelated(true);
    try {
      // 1. Fetch fresh Contact details
      const shouldFetchContact = forceFreshContact || !targetTab || contact.id !== lastLoadedContactIdRef.current;
      if (shouldFetchContact) {
        try {
          const contactRes = await api.get(`/contacts/${contact.id}`);
          const freshContact = contactRes.data.data || contactRes.data;
          if (freshContact && freshContact.id) {
            setFormData(prev => ({ ...prev, ...freshContact }));
            setBaseData(freshContact);
            lastLoadedContactIdRef.current = freshContact.id;
          }
        } catch (err) {} finally {
          setLoadingContactDetails(false);
        }
      } else {
        setLoadingContactDetails(false);
      }

      // 2. Fetch static metadata (Stages, Projects, Companies) only if not already loaded (caching)
      try {
        if (stages.length === 0) {
          const stagesRes = await api.get('/pipeline-stages');
          setStages(stagesRes.data.data?.items || stagesRes.data.data || []);
        }
      } catch (err) {}

      if (tabToLoad === 'info') {
        try {
          if (projectsList.length === 0) {
            const role = currentUser?.role;
            const bypassProj = role === 'sale' ? '' : '?bypass_roster=1';
            const projectsRes = await api.get(`/projects${bypassProj}`);
            setProjectsList(projectsRes.data.data || projectsRes.data || []);
          }
        } catch (err) {}

        try {
          if (companiesList.length === 0) {
            const companiesRes = await api.get('/companies?limit=2000');
            setCompaniesList(companiesRes.data.data?.items || companiesRes.data.data || []);
          }
        } catch (err) {}
      }

      // 3. Tab-specific lazy data fetching
      if (tabToLoad === 'timeline' || tabToLoad === 'tags') {
        const notesRes = await api.get(`/notes?entity_type=contact&entity_id=${contact.id}`);
        setNotes((notesRes.data.data || []).map((n: any) => ({
          id: n.id,
          text: n.body,
          time: n.created_at,
          user: n.user_name || 'Hệ thống',
          user_id: n.user_id,
          user_avatar: n.author_avatar || n.user_avatar || null,
          attachment_url: n.attachment_url,
          edit_history: n.edit_history,
          channel: n.channel,
          note_type: n.note_type,
          duration_minutes: n.duration_minutes,
          stuck_tag: n.stuck_tag,
          sale_temperature: n.sale_temperature,
          suggested_temperature: n.suggested_temperature,
          documents_sent: n.documents_sent
        })));
      }

      if (true || tabToLoad === 'tasks' || tabToLoad === 'timeline') {
        const [tasksRes, allTasksRes] = await Promise.all([
          api.get(`/activities?related_type=contact&related_id=${contact.id}`),
          api.get(`/activities?type=task&limit=200`)
        ]);
        const rawActivities = tasksRes.data.data?.items || tasksRes.data.data || [];
        const allTasks = allTasksRes.data.data?.items || allTasksRes.data.data || [];

        // Filter tasks that have this contact in their related_contact_ids
        const secondaryTasks = allTasks.filter((a: any) => {
          if (a.type !== 'task') return false;
          if (rawActivities.some((ra: any) => ra.id === a.id)) return false;
          if (a.body && a.body.trim().startsWith('{"erp_task"')) {
            try {
              const parsed = JSON.parse(a.body.trim());
              const rContactIds = parsed.erp_task?.related_contact_ids || [];
              return rContactIds.includes(Number(contact.id)) || rContactIds.includes(String(contact.id));
            } catch (e) {
              return false;
            }
          }
          return false;
        });

        const combinedActivities = [...rawActivities, ...secondaryTasks];
        setDrawerActivities(combinedActivities);
        setTasks(combinedActivities.filter((a: any) => {
          if (a.type === 'task') return true;
          if (a.type === 'meeting') {
            return a.status !== 'done' && a.status !== 'cancelled';
          }
          return false;
        }).map((a: any) => {
          const link = a.body && !a.body.trim().startsWith('{"erp_task"') 
            ? (a.body.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m)?.[1]?.trim() || '') 
            : '';
          
          let description = '';
          if (a.body) {
            let currentBody = a.body.trim();
            let wasParsed = false;
            while (currentBody.startsWith('{"erp_task"') || currentBody.startsWith('{"erp_task":')) {
              try {
                const parsed = JSON.parse(currentBody);
                wasParsed = true;
                if (typeof parsed.erp_task?.description === 'string') {
                  currentBody = parsed.erp_task.description.trim();
                } else {
                  break;
                }
              } catch (e) {
                break;
              }
            }
            if (wasParsed) {
              description = currentBody;
            } else {
              description = a.body.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim();
            }
          }
          return {
            id: a.id,
            title: a.subject,
            subject: a.subject,
            body: a.body,
            done: a.status === 'done',
            priority: a.priority,
            due: a.due_date ? new Date(a.due_date).toLocaleDateString('vi-VN') : '—',
            due_date: a.due_date || '',
            link,
            description,
            user_id: a.user_id,
            user_name: a.user_name || 'Hệ thống',
            tags: a.tags || '',
            participant_ids: a.participant_ids || '',
            progress: a.progress || 0,
            require_approval: a.require_approval || 0,
            approver_id: a.approver_id,
            approval_status: a.approval_status,
            created_by: a.created_by,
            created_by_name: a.created_by_name,
            created_by_avatar: a.created_by_avatar,
            created_at: a.created_at,
            contact_id: a.contact_id,
            contact_name: a.contact_name,
            related_id: a.related_id,
            related_type: a.related_type,
            type: a.type,
            status: a.status,
            rawActivity: a
          };
        }));
      }

      if (tabToLoad === 'deals' || tabToLoad === 'cooperation' || tabToLoad === 'info' || !tabToLoad) {
        api.get(`/cloud-files?contact_id=${contact.id}&limit=1000`)
          .then(res => {
            const docsData = res.data.data?.items || [];
            const mappedDocs = docsData.map((d: any) => ({
              id: d.id,
              name: d.name,
              category: d.category || d.folder || 'general',
              folder: d.folder || d.category || 'general',
              path: d.file_path,
              date: d.created_at ? new Date(d.created_at).toLocaleDateString('vi-VN') : '—',
              type: d.name ? d.name.split('.').pop() : 'file'
            }));
            setDocs(mappedDocs);
          })
          .catch(err => console.error("Error pre-fetching cloud-files for cooperation check:", err));

        const depositsRes = await api.get(`/deposits?contact_id=${contact.id}`);
        const depositsList = (depositsRes.data.data || []).map((d: any) => ({
          id: d.id,
          title: `${d.project_name} - Căn ${d.unit_code}`,
          value: d.price,
          stage: (() => {
            if (d.status === 'pending_admin') {
              const hasPaidMilestone = d.milestones && Array.isArray(d.milestones) && d.milestones.some((m: any) => m.status === 'paid');
              return hasPaidMilestone ? 'Chờ duyệt cọc' : 'Đang giao dịch';
            }
            if (d.status === 'approved') return 'Hoàn tất cọc';
            if (d.status === 'cancelled') return 'Đã bể cọc';
            return d.status;
          })(),
          stage_id: d.status,
          prob: 100,
          close: d.created_at,
          description: d.cancelled_reason || '',
          priority: 'high',
          stage_color: d.status === 'approved' ? '#10b981' : d.status === 'cancelled' ? '#ef4444' : '#f59e0b',
          unit_code: d.unit_code,
          price: d.price,
          expected_commission: d.expected_commission,
          project_name: d.project_name,
          project_id: d.project_id,
          milestones: d.milestones || [],
          contact_id: d.contact_id,
          first_name: d.first_name,
          last_name: d.last_name,
          phone: d.phone,
          avatar_url: d.avatar_url,
          created_at: d.created_at,
          created_by: d.created_by,
          contact_owner_id: d.contact_owner_id
        }));
        setDeals(depositsList);

        // Auto-sync contact expected_revenue & win_probability based on current deposits
        if (depositsList.length > 0) {
          const totalRev = depositsList.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
          const avgProb = Math.round(depositsList.reduce((total, d) => total + (Number(d.prob) || 0), 0) / depositsList.length);
          if (totalRev !== Number(formData.expected_revenue || 0) || avgProb !== Number(formData.win_probability || 0)) {
            api.put(`/contacts/${contact.id}`, {
              expected_revenue: totalRev,
              win_probability: avgProb
            }).then(() => {
              setFormData(prev => ({ ...prev, expected_revenue: totalRev, win_probability: avgProb }));
              setBaseData(prev => ({ ...prev, expected_revenue: totalRev, win_probability: avgProb }));
            }).catch(err => console.error("Error syncing contact metrics:", err));
          }
        }
      }

      if (tabToLoad === 'invoices') {
        const invoicesRes = await api.get(`/invoices?contact_id=${contact.id}`);
        const invData = invoicesRes.data.data;
        setDrawerInvoices(Array.isArray(invData) ? invData : (invData?.items || []));
      }

      if (tabToLoad === 'quotes') {
        const quotesRes = await api.get(`/quotes?contact_id=${contact.id}`);
        const qData = quotesRes.data.data;
        setDrawerQuotes(Array.isArray(qData) ? qData : (qData?.items || []));
      }

      if (tabToLoad === 'expenses') {
        const expensesRes = await api.get(`/expenses/entity/contact/${contact.id}`);
        const expData = expensesRes.data.data;
        setDrawerExpenses(Array.isArray(expData) ? expData : (expData?.items || []));
      }

      if (tabToLoad === 'tickets') {
        const ticketsRes = await api.get(`/tickets?contact_id=${contact.id}`);
        const tData = ticketsRes.data.data;
        setDrawerTickets(Array.isArray(tData) ? tData : (tData?.items || []));
      }

      if (tabToLoad === 'docs') {
        const docsRes = await api.get(`/cloud-files?contact_id=${contact.id}&limit=1000`);
        const docsData = docsRes.data.data?.items || [];
        const mappedDocs = docsData.map((d: any) => ({
          id: d.id,
          name: d.name,
          date: new Date(d.created_at).toLocaleDateString('vi-VN'),
          size: (() => {
            const bytes = Number(d.file_size || 0);
            if (!bytes) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
          })(),
          type: d.name.split('.').pop() || 'file',
          path: d.file_path,
          category: d.category
        }));

        // Fetch and include cooperation slip attachments dynamically
        let activeCoopSlip = coopSlip;
        if (!activeCoopSlip) {
          try {
            const resSlips = await fetchAPI('cooperation-slips');
            if (resSlips.success) {
              activeCoopSlip = (resSlips.data || []).find((s: any) => Number(s.contact_id) === Number(contact.id)) || null;
            }
          } catch (coopErr) {
            console.error("Lỗi khi tải thông tin hợp tác cho tài liệu:", coopErr);
          }
        }

        if (activeCoopSlip && activeCoopSlip.attachment_url) {
          const coopFiles = activeCoopSlip.attachment_url.split(',').map((s: string) => s.trim()).filter(Boolean);
          coopFiles.forEach((fileUrl: string, idx: number) => {
            const filename = fileUrl.split('/').pop() || 'coop_file';
            mappedDocs.push({
              id: `coop_slip_attachment_${idx}`,
              name: filename,
              date: activeCoopSlip.created_at ? new Date(activeCoopSlip.created_at).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
              size: '—',
              type: filename.split('.').pop() || 'file',
              path: fileUrl,
              category: 'Tài liệu Hợp tác & Hoa hồng',
              isCoopAttachment: true
            });
          });
        }

        // Fetch and include deposit milestone payment proofs (UNC) dynamically
        try {
          const resDep = await api.get(`/deposits?contact_id=${contact.id}`);
          const customerDeposits = resDep.data?.data || [];
          (Array.isArray(customerDeposits) ? customerDeposits : []).forEach((dep: any) => {
            const milestones = dep.milestones || [];
            milestones.forEach((m: any) => {
              const fileUrl = m.unc_file_path || m.attachment_url;
              if (fileUrl) {
                const filename = (() => {
                  const base = fileUrl.split('/').pop() || `${m.name || 'Cọc'}_UNC`;
                  try { return decodeURIComponent(base); } catch (e) { return base; }
                })();
                const fileExt = filename.split('.').pop() || 'png';
                const exists = mappedDocs.some((d: any) => d.path === fileUrl);
                if (!exists) {
                  mappedDocs.push({
                    id: `milestone_attachment_${m.id}`,
                    name: filename,
                    date: m.updated_at ? new Date(m.updated_at).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
                    size: '—',
                    type: fileExt,
                    path: fileUrl,
                    category: 'Đặt cọc',
                    folder: 'Đặt cọc',
                    isMilestoneAttachment: true
                  });
                }
              }
            });
          });
        } catch (depErr) {
          console.error("Lỗi khi tải thông tin cọc cho tài liệu:", depErr);
        }

        setDocs(mappedDocs);
      }
    } catch (e: any) {
      console.error("Error fetching tab data:", e);
    } finally {
      setLoadingRelated(false);
    }
  }, [contact?.id, activeTab, stages.length, projectsList.length, companiesList.length]);

  // Sync data whenever active tab, contact, or open status changes
  useEffect(() => {
    if (isOpen && contact?.id) {
      fetchData(activeTab);
    }
  }, [activeTab, isOpen, contact?.id, fetchData]);

  useEffect(() => {
    if (isOpen && contact?.id) {
      setLoadingContactDetails(true);
    }
  }, [isOpen, contact?.id]);

  useEffect(() => {
    const handleQuoteUpdate = () => {
      if (isOpen && contact?.id) {
        fetchData('quotes');
      }
    };
    window.addEventListener('quote-updated', handleQuoteUpdate);
    return () => {
      window.removeEventListener('quote-updated', handleQuoteUpdate);
    };
  }, [isOpen, contact?.id, fetchData]);

  useEffect(() => {
    if (contact) {
      const isNewContact = contact.id !== prevContactId;
      
      const cleanPhone = (contact.phone || '').replace(/[^0-9]/g, '');
      const cleanMobile = (contact.mobile || '').replace(/[^0-9]/g, '');
      const cleanZalo = (contact.zalo_link || '').replace(/[^0-9]/g, '');
      
      if (!contact.id) {
        // Creating a new contact: default Zalo source to 'primary'
        setZaloSource('primary');
      } else if (cleanZalo) {
        if (cleanMobile && cleanZalo === cleanMobile) {
          setZaloSource('secondary');
        } else {
          setZaloSource('primary');
        }
      } else {
        // Existing contact with no Zalo link: set to 'none'
        setZaloSource('none');
      }

      setFormData(contact);
      setTags(contact.tags || []);
      setBaseData(contact);
      setBaseTags(contact.tags || []);
      
      let initialTtl1 = { group1: false, group2: false, group3: false, group4: false, group5: false };
      try {
        if (contact.ttl1_data) {
          const parsed = typeof contact.ttl1_data === 'string' ? JSON.parse(contact.ttl1_data) : contact.ttl1_data;
          if (parsed && typeof parsed === 'object') {
            initialTtl1 = { ...initialTtl1, ...parsed };
          }
        }
      } catch {}
      setTtl1Data(initialTtl1);

      if (isNewContact) {
        setNotes([]);
        setTasks([]);
        setDeals([]);
        setDrawerInvoices([]);
        setDrawerQuotes([]);
        setDrawerExpenses([]);
        setDrawerTickets([]);
        const params = new URLSearchParams(window.location.search);
        if (params.has('highlight_activity_id')) {
          setActiveTab('timeline');
        } else if (params.has('highlight_note_id')) {
          setActiveTab('tags');
        } else {
          setActiveTab(isMobileOrTablet ? '' : (initialTab || 'info'));
        }
        setPrevContactId(contact.id);
      }
    } else {
      setPrevContactId(null);
    }
  }, [contact, prevContactId, initialTab, isMobileOrTablet]);

  useEffect(() => {
    if (formData.campaign_id && !formData.project_id && allowedCampaigns.length > 0) {
      const camp = allowedCampaigns.find(c => Number(c.id) === Number(formData.campaign_id));
      if (camp && camp.project_id) {
        setFormData((prev: any) => ({
          ...prev,
          project_id: Number(camp.project_id)
        }));
      }
    }
  }, [allowedCampaigns, formData.campaign_id, formData.project_id]);

  useEffect(() => {
    if (isOpen) {
      api.get('/users?all=1').then(r => {
        const d = r.data.data;
        const list = Array.isArray(d) ? d : (d?.items || []);
        const team = list.map((u: any) => ({
          ...u,
          id: u.id,
          full_name: u.full_name || u.name,
          avatar_url: u.avatar || u.avatar_url
        })).filter((u: any) => {
          if (!u || !u.role) return false;
          const roleLower = u.role.toLowerCase();
          return ['admin', 'superadmin', 'super_admin', 'sales', 'sale', 'manager', 'assistant', 'telesale', 'prescreener', 'director', 'staff', 'employee'].includes(roleLower);
        });
        setUsers(team);
      }).catch(() => {});
      api.get('/tags').then(r => setAllTags(r.data.data || [])).catch(() => { });
      api.get('/contacts?limit=1000').then(r => setContacts(r.data.data?.items || r.data.data || [])).catch(() => { });
      const isRosterRestricted = ['sale', 'sales', 'manager', 'director'].includes(currentUser?.role || '');
      const bypassProj = isRosterRestricted ? '' : '?bypass_roster=1';
      api.get(`/projects${bypassProj}`).then(r => setAllowedProjects(r.data.data || r.data || [])).catch(() => {});
      api.get('/marketing-campaigns').then(r => setAllowedCampaigns(r.data.data?.items || r.data.data || [])).catch(() => {});
      api.get('/teams').then(r => setAllowedTeams(r.data.data || r.data || [])).catch(() => {});

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
            if (res.data.temp_suggestion_call_duration_seconds !== undefined) {
              const val = parseInt(res.data.temp_suggestion_call_duration_seconds, 10);
              if (!isNaN(val) && val > 0) {
                setTempSuggestionCallDuration(val);
              }
            }
            if (res.data.temp_suggestion_required_notes !== undefined) {
              const val = parseInt(res.data.temp_suggestion_required_notes, 10);
              if (!isNaN(val) && val > 0) {
                setTempSuggestionRequiredNotes(val);
              }
            }
            if (res.data.allow_pipeline_backward !== undefined) {
              setAllowPipelineBackward(res.data.allow_pipeline_backward === '1' || res.data.allow_pipeline_backward === 1);
            }
            if (res.data.allow_pipeline_skip !== undefined) {
              setAllowPipelineSkip(res.data.allow_pipeline_skip === '1' || res.data.allow_pipeline_skip === 1);
            }
            if (res.data.coop_eligible_statuses) {
              try {
                setCoopEligibleStatuses(JSON.parse(res.data.coop_eligible_statuses));
              } catch (e) {
                setCoopEligibleStatuses(res.data.coop_eligible_statuses.split(',').map((s: string) => s.trim()).filter(Boolean));
              }
            }
            if (res.data.coop_default_files) {
              try {
                setCoopDefaultFiles(JSON.parse(res.data.coop_default_files));
              } catch (e) {
                setCoopDefaultFiles(res.data.coop_default_files.split(',').map((s: string) => s.trim()).filter(Boolean));
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
    
    // Base score
    s += 10;
    r.push({ rule: 'Điểm khởi tạo (Mặc định)', pts: 10, type: 'System' });

    // Job Title
    const title = (formData.job_title || '').toLowerCase();
    if (title.includes('giám đốc') || title.includes('ceo') || title.includes('sáng lập') || title.includes('founder') || title.includes('chủ tịch')) {
      s += 20; r.push({ rule: 'Chức danh C-Level (Giám đốc/CEO/Founder/Chủ tịch)', pts: 20, type: 'Demographic' });
    } else if (title) {
      s += 5; r.push({ rule: 'Có thông tin chức vụ', pts: 5, type: 'Demographic' });
    }

    // Phone / Contact Info
    if (formData.phone) { s += 15; r.push({ rule: 'Cung cấp số điện thoại chính', pts: 15, type: 'Demographic' }); }
    if (formData.mobile) { s += 10; r.push({ rule: 'Cung cấp số điện thoại phụ', pts: 10, type: 'Demographic' }); }
    if (formData.phone && formData.mobile) { s += 10; r.push({ rule: 'Có cả 2 số liên hệ (Độ tin cậy cao)', pts: 10, type: 'Demographic' }); }
    if (formData.email) { s += 10; r.push({ rule: 'Cung cấp Email', pts: 10, type: 'Demographic' }); }
    if (formData.zalo_link || formData.fb_link) { s += 10; r.push({ rule: 'Có liên kết mạng xã hội (Zalo/Facebook)', pts: 10, type: 'Demographic' }); }
    if (formData.birthday) { s += 10; r.push({ rule: 'Có thông tin ngày sinh (Hỗ trợ sinh nhật)', pts: 10, type: 'Demographic' }); }
    if (formData.gender) { s += 5; r.push({ rule: 'Có thông tin giới tính', pts: 5, type: 'Demographic' }); }
    if (formData.customer_type) { s += 5; r.push({ rule: 'Xác định loại khách hàng (Cá nhân/Doanh nghiệp)', pts: 5, type: 'Demographic' }); }

    // Address
    if (formData.address) { s += 15; r.push({ rule: 'Có thông tin địa chỉ đầy đủ', pts: 15, type: 'Demographic' }); }

    // Source
    if (formData.source === 'website') { s += 15; r.push({ rule: 'Nguồn khách từ Website', pts: 15, type: 'Behavioral' }); }
    if (formData.source === 'referral' || formData.source === 'gioi_thieu') { s += 20; r.push({ rule: 'Khách được giới thiệu (Referral)', pts: 20, type: 'Behavioral' }); }

    // Projects / Companies / Segmentations
    if (formData.project_id) { s += 15; r.push({ rule: 'Liên kết dự án quan tâm', pts: 15, type: 'Behavioral' }); }
    if (formData.company_id) { s += 5; r.push({ rule: 'Liên kết công ty đối tác', pts: 5, type: 'Behavioral' }); }
    if (formData.industry) { s += 5; r.push({ rule: 'Xác định ngành nghề kinh doanh', pts: 5, type: 'Demographic' }); }
    if (formData.budget_range) { s += 10; r.push({ rule: 'Xác định phân khúc ngân sách', pts: 10, type: 'Behavioral' }); }

    // Revenue & Probability
    const revenue = Number(formData.expected_revenue) || 0;
    if (revenue > 500000000) {
      s += 35; r.push({ rule: 'Kỳ vọng doanh thu lớn (> 500 Triệu)', pts: 35, type: 'Behavioral' });
    } else if (revenue > 100000000) {
      s += 20; r.push({ rule: 'Kỳ vọng doanh thu lớn (> 100 Triệu)', pts: 20, type: 'Behavioral' });
    }
    if (Number(formData.win_probability) > 70) { s += 10; r.push({ rule: 'Xác suất chốt giao dịch cao (>70%)', pts: 10, type: 'Behavioral' }); }

    // State & TTL1
    if (formData.status === 'qualified' || formData.status === 'customer') { s += 15; r.push({ rule: 'Xác nhận trạng thái chất lượng', pts: 15, type: 'Behavioral' }); }
    if (formData.ttl1_completed === 1) { s += 25; r.push({ rule: 'Đã hoàn thành xác minh điều kiện gặp (TTL1)', pts: 25, type: 'Behavioral' }); }

    // Content Enrichment
    if (formData.notes && formData.notes.trim().length > 10) { s += 10; r.push({ rule: 'Có ghi chú chi tiết về nhu cầu', pts: 10, type: 'Behavioral' }); }
    if (tags && tags.length > 0) { s += 10; r.push({ rule: 'Đã gắn thẻ phân loại (Tags)', pts: 10, type: 'Behavioral' }); }

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

    return { score: Math.min(100, Math.max(0, s)), rules: r };
  }, [
    formData.job_title, formData.phone, formData.mobile, formData.email, formData.customer_type, formData.gender,
    formData.zalo_link, formData.fb_link, formData.birthday, formData.address, formData.source, formData.project_id,
    formData.company_id, formData.industry, formData.budget_range, formData.expected_revenue, formData.win_probability,
    formData.status, formData.ttl1_completed, formData.notes, tags,
    formData.created_at, contact?.last_contact, contact?.updated_at, drawerActivities, decayDays
  ]);

  const timeline = useMemo(() => {
    if (!contact?.id) return [];
    let source = drawerActivities;
    if (timelineFilter !== 'all') {
      source = source.filter((a: any) => a.type === timelineFilter);
    }
    return source.map((a: any) => ({
      id: a.id,
      title: a.subject,
      type: a.type,
      status: a.status,
      user: a.user_name || 'Hệ thống',
      avatar: a.avatar_url || undefined,
      time: a.created_at,
      due_date: a.due_date,
      color: a.status === 'cancelled' ? '#6b7280' : (a.type === 'zalo_connect' ? '#0084FF' : a.type === 'call' ? '#3b82f6' : a.type === 'meeting' ? '#BD1D2D' : a.type === 'task' ? '#f59e0b' : a.type === 'system' ? '#64748b' : a.type === 'note' ? '#6366f1' : '#10b981'),
      icon: a.type === 'call' ? <Phone size={16} /> : a.type === 'zalo_connect' ? <img src="https://stc-zpl.zdn.vn/favicon.ico" style={{ width: 16, height: 16, objectFit: 'contain', borderRadius: '4px' }} alt="Zalo" /> : a.type === 'meeting' ? <User size={16} /> : a.type === 'task' ? <CheckSquare size={16} /> : a.type === 'system' ? <History size={16} /> : a.type === 'note' ? <FileText size={16} /> : <Mail size={16} />,
      note: a.body || a.note || '',
      comment_count: a.comment_count,
      expense_image_url: a.expense_image_url,
      rawActivity: a
    })).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [drawerActivities, contact?.id, timelineFilter]);
  const fullName = `${formData.last_name || ''} ${formData.first_name || ''}`.trim() || 'Chưa cập nhật tên';
  const ownerUser = users.find(u => u.full_name === formData.owner_name || u.name === formData.owner_name || u.username === formData.owner_name);
  const ownerAvatarUrl = ownerUser?.avatar_url || ownerUser?.avatar || undefined;

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
    const isAdmin = currentUser?.role && ['admin', 'superadmin', 'super_admin', 'assistant', 'director', 'manager'].includes(currentUser.role);
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

      const channelMap: Record<string, string> = {
        text: 'noi_dat',
        call: 'noi_dong',
        meet: 'noi_ap_suat'
      };

      const typeMap: Record<string, string> = {
        normal: 'regular',
        quality: 'quality'
      };

      const obstacleMap: Record<string, string> = {
        trust: 'sales',
        project: 'project',
        unit: 'unit',
        smooth: 'smooth',
        other: 'sales'
      };

      const docsArray = noteDocsSent ? noteDocsSent.split(', ').map(d => d.trim()) : [];
      const docsFinal = docsArray.map(d => d === 'Khác' ? (customDocs.trim() || 'Khác') : d).filter(Boolean).join(', ');

      await api.post(`/notes?entity_type=contact&entity_id=${contact.id}`, {
        body: text,
        type: 'internal',
        attachment_url: uploadedUrl || null,
        channel: channelMap[noteChannel] || 'noi_dat',
        note_type: typeMap[noteType] || 'regular',
        duration_minutes: noteChannel === 'call' ? Math.ceil((parseInt(noteDuration, 10) || 0) / 60) : 0,
        client_feedback: customObstacle.trim() || null,
        stuck_tag: noteObstacle === 'other' ? (customObstacle.trim() || 'sales') : (obstacleMap[noteObstacle] || null),
        suggested_temperature: calculatedSuggestedTemp,
        sale_temperature: noteSaleTemp || calculatedSuggestedTemp,
        documents_sent: docsFinal || null,
        is_heritage: 0
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
      setNoteSaleTemp('');
      fetchData(); // Reload all to stay in sync
      window.dispatchEvent(new CustomEvent('contact-updated'));
      addToast('Đã lưu ghi chú và cập nhật nhiệt độ!', 'success');
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

  const fetchTaskComments = async (taskId: number) => {
    setLoadingTaskComments(true);
    try {
      const res = await api.get(`/activities/${taskId}/comments`);
      if (res.data.success && res.data.data) {
        setTaskComments(res.data.data);
      } else {
        setTaskComments(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTaskComments(false);
    }
  };

  const handlePostTaskComment = async () => {
    if (!newCommentText.trim() || !selectedTaskForDetails) return;
    try {
      await api.post(`/activities/${selectedTaskForDetails.id}/comments`, {
        content: newCommentText.trim()
      });
      setNewCommentText('');
      await fetchTaskComments(selectedTaskForDetails.id);
      fetchData();
      addToast('Đã đăng bình luận thành công!', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi gửi bình luận', 'error');
    }
  };

  const handleDeleteTaskComment = (commentId: number) => {
    showConfirm({
      title: 'Xóa bình luận',
      message: 'Bạn có chắc chắn muốn xóa bình luận này?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/activities/comments/${commentId}`);
          await fetchTaskComments(selectedTaskForDetails.id);
          fetchData();
          addToast('Đã xóa bình luận thành công!', 'success');
        } catch (err: any) {
          addToast(err.response?.data?.message || 'Lỗi khi xóa bình luận', 'error');
        }
      }
    });
  };

  const handleUpdateTaskDetail = async (updatedFields: any) => {
    if (!selectedTaskForDetails) return;
    setIsUpdatingTask(true);
    try {
      const payload: any = {};
      if ('title' in updatedFields) payload.subject = updatedFields.title;
      if ('description' in updatedFields || 'checklist' in updatedFields) {
        const descText = 'description' in updatedFields ? updatedFields.description : (selectedTaskForDetails.description || '');
        const listItems = 'checklist' in updatedFields ? updatedFields.checklist : checklist;
        const finalDescription = serializeDescriptionAndChecklist(descText, listItems);
        payload.body = finalDescription + (selectedTaskForDetails.link ? `\n\nTài liệu/Link đính kèm: ${selectedTaskForDetails.link}` : '');
      } else if ('link' in updatedFields) {
        const descText = selectedTaskForDetails.description || '';
        const finalDescription = serializeDescriptionAndChecklist(descText, checklist);
        payload.body = finalDescription + (updatedFields.link ? `\n\nTài liệu/Link đính kèm: ${updatedFields.link}` : '');
      }
      
      const directFields = ['user_id', 'status', 'priority', 'due_date', 'tags', 'participant_ids', 'progress', 'require_approval', 'approver_id', 'approval_status'];
      directFields.forEach(f => {
        if (f in updatedFields) payload[f] = updatedFields[f];
      });

      // Filter assignee out of co-workers if assignee changes
      if ('user_id' in updatedFields) {
        const newAssigneeId = String(updatedFields.user_id);
        const currentParticipants = (selectedTaskForDetails.participant_ids || '').split(',').filter(Boolean);
        const nextParticipants = currentParticipants.filter(id => id !== newAssigneeId);
        payload.participant_ids = nextParticipants.join(',');
        updatedFields.participant_ids = payload.participant_ids;
      }

      // Progress & Approval logic
      const nextProgress = 'progress' in updatedFields ? updatedFields.progress : selectedTaskForDetails.progress;
      const nextReqApproval = 'require_approval' in updatedFields ? updatedFields.require_approval : selectedTaskForDetails.require_approval;
      const nextApprovalStatus = 'approval_status' in updatedFields ? updatedFields.approval_status : selectedTaskForDetails.approval_status;

      if (nextProgress === 100) {
        if (nextReqApproval === 1) {
          if (nextApprovalStatus === 'approved') {
            payload.status = 'done';
            payload.approval_status = 'approved';
            updatedFields.status = 'done';
            updatedFields.approval_status = 'approved';
          } else if (nextApprovalStatus === 'rejected') {
            payload.status = 'planned';
            payload.approval_status = 'rejected';
            payload.progress = 90; // push progress back to 90
            updatedFields.status = 'planned';
            updatedFields.approval_status = 'rejected';
            updatedFields.progress = 90;
          } else {
            payload.status = 'planned';
            payload.approval_status = 'pending';
            updatedFields.status = 'planned';
            updatedFields.approval_status = 'pending';
          }
        } else {
          payload.status = 'done';
          payload.approval_status = null;
          updatedFields.status = 'done';
          updatedFields.approval_status = null;
        }
      } else {
        payload.status = 'planned';
        payload.approval_status = null;
        updatedFields.status = 'planned';
        updatedFields.approval_status = null;
      }

      const res = await api.put(`/activities/${selectedTaskForDetails.id}`, payload);
      if (res.status === 200) {
        setSelectedTaskForDetails((prev: any) => ({ ...prev, ...updatedFields }));
        fetchData();
      }
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi cập nhật công việc', 'error');
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleDetailTaskFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTaskForDetails) return;
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
        await handleUpdateTaskDetail({ link: filePath });
        addToast('Tải tệp đính kèm thành công', 'success');
      } else {
        addToast(res.data.message || 'Lỗi khi tải tệp lên', 'error');
      }
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi kết nối khi tải tệp lên', 'error');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (selectedTaskForDetails) {
      fetchTaskComments(selectedTaskForDetails.id);
      
      const parsed = parseDescriptionAndChecklist(selectedTaskForDetails.description || '');
      setChecklist(parsed.checklist);
      selectedTaskForDetails.description = parsed.pureDescription;
    }
  }, [selectedTaskForDetails?.id]);

  const handleAddTask = async () => {
    if (!taskForm.title.trim() || isSubmitting) return;
    setIsSubmitting(true);

    const additionalContactIds = Array.from(new Set([
      Number(contact.id),
      ...(taskForm.related_contact_ids || [])
        .filter((id: any) => id !== 'all' && id !== '')
        .map(Number)
    ]));

    const erpPayload = {
      erp_task: {
        description: taskForm.description.trim(),
        internal_type: 'task',
        scope: 'personal',
        project_id: taskForm.project_id || '',
        campaign_id: taskForm.campaign_id || '',
        team_id: taskForm.team_id || '',
        campaign_target: taskForm.campaign_target || '',
        recurrence: {
          pattern: taskForm.recurrence_pattern || 'none',
          weekly_days: taskForm.recurrence_weekly_days || [],
          monthly_day: Number(taskForm.recurrence_monthly_day || 1),
          last_generated: ''
        },
        checklist: taskForm.checklist || [],
        links: taskForm.link?.trim() ? [{ label: t('Đường dẫn đính kèm'), url: taskForm.link.trim() }] : [],
        related_contact_ids: additionalContactIds
      }
    };

    const mainAssignee = taskForm.user_id ? Number(taskForm.user_id) : currentUser?.id;
    const participantIdsString = (taskForm.participant_ids || [])
      .filter((id: any) => id !== 'all' && Number(id) !== Number(mainAssignee))
      .join(',');

    let relatedType = 'contact';
    let relatedId = contact.id;

    if (taskForm.project_id) {
      relatedType = 'project';
      relatedId = Number(taskForm.project_id);
    } else if (taskForm.campaign_id) {
      relatedType = 'campaign';
      relatedId = Number(taskForm.campaign_id);
    } else if (taskForm.team_id) {
      relatedType = 'team';
      relatedId = Number(taskForm.team_id);
    }

    try {
      await api.post('/activities', {
        related_type: relatedType,
        related_id: relatedId,
        subject: taskForm.title,
        type: 'task',
        priority: taskForm.priority,
        due_date: taskForm.due_date,
        user_id: taskForm.user_id ? Number(taskForm.user_id) : null,
        body: JSON.stringify(erpPayload),
        status: 'planned',
        progress: Number(taskForm.progress || 0),
        require_approval: Number(taskForm.require_approval || 0),
        approver_id: taskForm.approver_id ? Number(taskForm.approver_id) : null,
        participant_ids: participantIdsString || null
      });
      setShowTaskModal(false);
      setTaskForm({ 
        title: '', 
        priority: 'medium', 
        due_date: new Date().toISOString().slice(0, 10), 
        description: '', 
        link: '', 
        user_id: String(currentUser?.id || contact?.owner_id || ''),
        progress: 0,
        require_approval: 0,
        approver_id: '',
        participant_ids: [] as string[],
        related_contact_ids: [] as string[],
        checklist: [] as any[],
        recurrence_pattern: 'none',
        recurrence_weekly_days: [] as number[],
        recurrence_monthly_day: 1,
        project_id: '',
        campaign_id: '',
        team_id: '',
        campaign_target: ''
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

  const handleCompleteMeeting = async (ev: any) => {
    try {
      const res = await api.get(`/activities/${ev.id}/comments`);
      const commentsList = res.data.data || [];
      const hasImage = commentsList.some((c: any) => {
        const atts = Array.isArray(c.attachments) ? c.attachments : JSON.parse(c.attachments || '[]');
        return atts.some((att: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(att));
      });

      if (hasImage) {
        await api.put(`/activities/${ev.id}`, { status: 'done' });
        addToast('Đã hoàn thành gặp gỡ', 'success');
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
        setDrawerActivities(prev => prev.map(a => a.id === ev.id ? { ...a, status: 'done' } : a));
        setTasks(prev => prev.filter(a => a.id !== ev.id));
      } else {
        setMeetingToComplete(ev);
        setProofCommentText('Ảnh minh chứng hoàn thành gặp gỡ');
        setProofImageFile(null);
        setProofImagePreview(null);
      }
    } catch (e: any) {
      console.error(e);
      addToast('Lỗi khi kiểm tra bình luận gặp gỡ', 'error');
    }
  };

  const handleCancelMeeting = (ev: any) => {
    const rawEv = ev.rawActivity || ev;
    setCancellingMeeting(rawEv);
    setCancelReason('');
  };

  const submitCancelMeeting = async () => {
    if (!cancellingMeeting) return;
    const reason = cancelReason.trim();
    if (!reason) {
      addToast('Vui lòng nhập lý do hủy lịch', 'error');
      return;
    }
    setSavingCancel(true);
    try {
      await api.put(`/activities/${cancellingMeeting.id}`, { status: 'cancelled' });
      await api.post(`/activities/${cancellingMeeting.id}/comments`, {
        content: `Hủy lịch gặp gỡ với lý do: ${reason}`
      });
      addToast('Đã hủy gặp gỡ', 'success');
      setDrawerActivities(prev => prev.map(a => a.id === cancellingMeeting.id ? { ...a, status: 'cancelled' } : a));
      setTasks(prev => prev.filter(a => a.id !== cancellingMeeting.id));
      setCancellingMeeting(null);
      setCancelReason('');
    } catch (e: any) {
      console.error(e);
      addToast('Lỗi khi hủy gặp gỡ', 'error');
    } finally {
      setSavingCancel(false);
    }
  };

  const handleRescheduleMeetingClick = (ev: any) => {
    setReschedulingMeeting(ev);
    if (ev.time) {
      const d = new Date(ev.time);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setNewMeetingTime(`${year}-${month}-${date}T${hours}:${minutes}`);
        return;
      }
    }
    setNewMeetingTime(new Date().toISOString().slice(0, 16));
  };

  const handleUpdateReschedule = async () => {
    if (!reschedulingMeeting) return;
    setUpdatingMeetingTime(true);
    try {
      const formattedTime = newMeetingTime.replace('T', ' ') + ':00';
      await api.put(`/activities/${reschedulingMeeting.id}`, {
        status: 'rescheduled',
        due_date: formattedTime
      });
      addToast('Đã dời lịch gặp gỡ', 'success');
      setDrawerActivities(prev => prev.map(a => a.id === reschedulingMeeting.id ? { ...a, status: 'rescheduled', time: formattedTime, due_date: formattedTime } : a));
      setTasks(prev => prev.map(a => a.id === reschedulingMeeting.id ? { ...a, status: 'rescheduled', due_date: formattedTime } : a));
      setReschedulingMeeting(null);
    } catch (e: any) {
      console.error(e);
      addToast('Lỗi khi dời lịch gặp gỡ', 'error');
    } finally {
      setUpdatingMeetingTime(false);
    }
  };

  const toggleTaskDone = async (taskId: number, currentDone: boolean) => {
    setTasks(p => p.map(x => x.id === taskId ? { ...x, done: !currentDone } : x));
    try {
      const nextStatus = !currentDone ? 'done' : 'planned';
      await api.put(`/activities/${taskId}`, { status: nextStatus });
      addToast(nextStatus === 'done' ? 'Đã hoàn thành công việc' : 'Đã mở lại công việc', 'success');
      if (nextStatus === 'done') {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      }
      setDrawerActivities(prev => prev.map(a => a.id === taskId ? { ...a, status: nextStatus } : a));
    } catch (err: any) {
      setTasks(p => p.map(x => x.id === taskId ? { ...x, done: currentDone } : x));
      addToast(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái công việc', 'error');
    }
  };

  const handleTaskDrop = async (taskId: number, targetCol: 'todo' | 'in_progress' | 'done') => {
    let nextDone = false;
    let nextProgress = 0;
    let nextStatus = 'planned';

    if (targetCol === 'todo') {
      nextDone = false;
      nextProgress = 0;
      nextStatus = 'planned';
    } else if (targetCol === 'in_progress') {
      nextDone = false;
      nextProgress = 50;
      nextStatus = 'planned';
    } else if (targetCol === 'done') {
      nextDone = true;
      nextProgress = 100;
      nextStatus = 'done';
    }

    // Optimistic local state update
    setTasks(prev => prev.map(x => x.id === taskId ? { ...x, done: nextDone, progress: nextProgress, status: nextStatus } : x));
    
    try {
      await api.put(`/activities/${taskId}`, { 
        progress: nextProgress,
        status: nextStatus
      });
      const colLabel = targetCol === 'todo' ? 'Cần làm' : targetCol === 'in_progress' ? 'Đang làm' : 'Đã xong';
      addToast(`Đã chuyển công việc sang cột ${colLabel}`, 'success');
      if (nextStatus === 'done') {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      }
      setDrawerActivities(prev => prev.map(a => a.id === taskId ? { ...a, progress: nextProgress, status: nextStatus } : a));
    } catch (err: any) {
      // Revert if error
      fetchData();
      addToast(err.response?.data?.message || 'Lỗi khi cập nhật tiến độ công việc', 'error');
    }
  };

  const handleSaveDeposit = async (createCoopSlipChoice: boolean = false) => {
    if (!depositProjectId || !depositUnitCode || !depositPrice) {
      addToast('Vui lòng nhập đầy đủ Dự án, Mã căn hộ và Giá bán', 'error');
      return;
    }
    
    // Require amount for milestone 1
    if (!depositMilestones[0] || !depositMilestones[0].amount || parseFloat(depositMilestones[0].amount) <= 0) {
      addToast('Vui lòng nhập số tiền cọc cho Đợt 1 - Cọc giữ chỗ (bắt buộc).', 'error');
      return;
    }

    // Require UNC proof for milestone 1
    if (!depositUncFile) {
      addToast('Vui lòng tải lên minh chứng chuyển khoản (UNC) Đợt 1 để tạo phiếu cọc.', 'error');
      return;
    }

    // Verify milestones total sum
    const totalM = depositMilestones.reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
    if (totalM > parseFloat(depositPrice)) {
      addToast(`Tổng tiền các đợt thanh toán (${totalM.toLocaleString()} VND) không được vượt quá Doanh thu dự kiến (${parseFloat(depositPrice).toLocaleString()} VND)`, 'error');
      return;
    }

    const collabListCheck = getCoopCollaboratorIds();
    const hasCoopSalesCheck = collabListCheck.length > 0;

    if (hasCoopSalesCheck && createCoopSlipChoice) {
      const sumPct = Object.values(depositCoopShares).reduce((acc, p) => acc + (parseFloat(p) || 0), 0);
      if (sumPct !== 100) {
        addToast(`Tổng tỷ lệ chia sẻ hoa hồng phải đúng 100% (Hiện tại là ${sumPct}%). Vui lòng điều chỉnh lại!`, 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 1. Create the deposit slip and milestones
      const res = await api.post('/deposits', {
        contact_id: contact.id,
        project_id: Number(depositProjectId),
        unit_code: depositUnitCode,
        price: parseFloat(depositPrice),
        expected_commission: parseFloat(depositExpectedCommission) || 0,
        milestones: depositMilestones,
        create_coop_slip: createCoopSlipChoice,
        shares: depositCoopShares
      });

      const responseData = res.data?.data || res.data;
      const createdDepositId = responseData?.id;
      const createdMilestones = responseData?.milestones || [];

      if (!createdDepositId || createdMilestones.length === 0) {
        throw new Error('Không nhận được thông tin phiếu đặt cọc hoặc đợt thanh toán từ máy chủ.');
      }

      // 2. Upload UNC proof to the first milestone
      const firstMilestone = createdMilestones[0];
      const formDataUpload = new FormData();
      formDataUpload.append('file', depositUncFile);

      await api.post(`/deposits/${createdDepositId}/milestones/${firstMilestone.id}`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Auto-register "Đặt cọc" folder for Customer Documents
      const updatedFolders = Array.from(new Set([...localFolders, 'Đặt cọc']));
      setLocalFolders(updatedFolders);
      if (contact?.id) {
        localStorage.setItem(`richland_folders_contact_${contact.id}`, JSON.stringify(updatedFolders));
      }

      // 3. Complete pipeline stage transition if pending
      if (pendingPipelineTransition) {
        const { targetId, targetLabel, note } = pendingPipelineTransition;
        const calculatedStatus = 'customer';

        await api.put(`/contacts/${contact.id}`, { 
          pipeline_status: targetId, 
          status: calculatedStatus,
          ttl1_completed: formData.ttl1_completed,
          ttl1_data: formData.ttl1_data
        });

        await api.post('/activities', {
          type: 'note',
          subject: `Chuyển trạng thái Pipeline → ${targetLabel}`,
          body: note || null,
          status: 'done',
          related_type: 'contact',
          related_id: contact.id,
          contact_id: contact.id,
          user_id: currentUser?.id,
          due_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
          done_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        });

        setPendingPipelineTransition(null);
      }

      if (hasCoopSalesCheck && createCoopSlipChoice) {
        addToast('Tạo phiếu cọc và tự động khởi tạo Phiếu hợp tác phân chia hoa hồng thành công!', 'success');
      } else {
        addToast('Tạo phiếu cọc và tải lên UNC thành công!', 'success');
      }

      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      setShowDealModal(false);

      // Reset form states
      setDepositProjectId('');
      setDepositUnitCode('');
      setDepositPrice('');
      setDepositExpectedCommission('');
      setDepositMilestones([{ name: 'Đợt 1 - Cọc giữ chỗ', amount: '' }]);
      setDepositUncFile(null);
      
      fetchData();
      await fetchCoopSlip();

      if (hasCoopSalesCheck && createCoopSlipChoice) {
        setActiveTab('cooperation');
      }
    } catch (e: any) {
      addToast(e?.response?.data?.message || e.message || 'Lỗi khi tạo phiếu cọc', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelDeposit = (depositId: number) => {
    showConfirm({
      title: 'Báo cáo bể cọc / Hủy đặt cọc',
      message: 'Vui lòng nhập lý do hủy đặt cọc / bể cọc của khách hàng:',
      confirmText: 'Báo cáo bể cọc',
      cancelText: 'Hủy',
      isDanger: true,
      requirePromptInput: true,
      promptPlaceholder: 'Nhập lý do chi tiết (bắt buộc)...',
      onConfirm: async (reason) => {
        if (!reason || !reason.trim()) {
          addToast("Vui lòng nhập lý do hủy", "error");
          return;
        }
        try {
          const res = await api.post(`/deposits/${depositId}/cancel`, { reason });
          if (res.data.success || res.data) {
            addToast("Đã hủy đặt cọc thành công", "success");
            fetchData();
          }
        } catch (e: any) {
          addToast(e?.response?.data?.message || "Không thể hủy đặt cọc", "error");
        }
      }
    });
  };
  const handleOpenManageMilestones = (dep: any) => {
    setSelectedDepForManage(dep);
    setTempMilestones((dep.milestones || []).map((m: any) => ({ ...m })));
    setShowManageModal(true);
  };

  const handleAddMilestoneRow = () => {
    setTempMilestones([
      ...tempMilestones,
      {
        tempId: Date.now() + Math.random(),
        milestone_name: `Đợt ${tempMilestones.length + 1}`,
        expected_amount: 0,
        status: 'pending'
      }
    ]);
  };

  const handleUpdateMilestoneField = (index: number, field: string, value: any) => {
    const updated = [...tempMilestones];
    updated[index] = { ...updated[index], [field]: value };
    setTempMilestones(updated);
  };

  const handleRemoveMilestoneRow = (index: number) => {
    const updated = [...tempMilestones];
    updated.splice(index, 1);
    setTempMilestones(updated);
  };

  const handleUploadUncFromModal = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('access_token') || localStorage.getItem('richland_token') || '';
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=upload&token=${token}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Auth-Token': token
        },
        body: formData
      });
      const res = await response.json();
      
      if (res.success && res.data?.url) {
        addToast('Tải ảnh UNC thành công! Hãy nhấn "Lưu lịch trình" để hoàn tất lưu.', 'success');
        
        const updated = [...tempMilestones];
        updated[index].unc_file_path = res.data.url;
        updated[index].status = 'paid';
        setTempMilestones(updated);
      } else {
        addToast(res.message || 'Lỗi khi tải ảnh UNC', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleApproveFromModal = async (index: number) => {
    const m = tempMilestones[index];
    setActioningMilestoneId(m.id);
    setActioningType('approve');
    try {
      const res = await api.post(`/deposits/${selectedDepForManage.id}/milestones/${m.id}/approve`);
      if (res.data?.success || res.data) {
        addToast('Phê duyệt đợt tiền thành công!', 'success');
        
        const updated = [...tempMilestones];
        updated[index].status = 'approved';
        setTempMilestones(updated);
        
        fetchData();
      } else {
        addToast(res.data?.message || 'Lỗi phê duyệt', 'error');
      }
    } catch (err: any) {
      addToast(err?.response?.data?.message || err.message || 'Lỗi kết nối', 'error');
    } finally {
      setActioningMilestoneId(null);
      setActioningType(null);
    }
  };

  const handleRejectFromModal = async (index: number) => {
    const m = tempMilestones[index];
    setActioningMilestoneId(m.id);
    setActioningType('reject');
    try {
      const res = await api.post(`/deposits/${selectedDepForManage.id}/milestones/${m.id}/reject`);
      if (res.data?.success || res.data) {
        addToast('Bác bỏ UNC đợt tiền thành công!', 'success');
        
        const updated = [...tempMilestones];
        updated[index].status = 'failed';
        setTempMilestones(updated);
        
        fetchData();
      } else {
        addToast(res.data?.message || 'Lỗi bác bỏ', 'error');
      }
    } catch (err: any) {
      addToast(err?.response?.data?.message || err.message || 'Lỗi kết nối', 'error');
    } finally {
      setActioningMilestoneId(null);
      setActioningType(null);
    }
  };

  const handleSaveMilestones = async () => {
    const totalAmount = tempMilestones.reduce((sum, m) => sum + (Number(m.expected_amount) || 0), 0);
    if (Math.abs(totalAmount - selectedDepForManage.price) > 1) {
      addToast(`Tổng tiền các đợt (${totalAmount.toLocaleString()} VND) phải bằng đúng Giá bán căn hộ (${selectedDepForManage.price.toLocaleString()} VND)`, 'error');
      return;
    }

    const hasProof = tempMilestones.some(m => m.unc_file_path && m.unc_file_path.trim() !== '');
    if (!hasProof) {
      addToast('Lịch trình thanh toán bắt buộc phải có ít nhất 1 minh chứng.', 'error');
      return;
    }

    const isAdmin = currentUser && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director'].includes(currentUser.role);
    if (isAdmin && tempSharesData && tempSharesData.length > 0) {
      const totalPct = tempSharesData.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
      if (totalPct !== 100) {
        addToast('Tổng tỷ lệ chia sẻ hoa hồng phải bằng 100%.', 'error');
        return;
      }
    }

    try {
      setIsSavingMilestones(true);
      const payload: any = {
        milestones: tempMilestones.map(m => ({
          id: m.id || null,
          milestone_name: m.milestone_name,
          expected_amount: m.expected_amount,
          status: m.status
        }))
      };
      if (isAdmin) {
        payload.expected_commission = tempExpectedCommission;
        payload.shares = tempSharesData.map(sh => ({
          user_id: sh.user_id,
          percentage: sh.percentage
        }));
      }
      const res = await api.put(`/deposits/${selectedDepForManage.id}/milestones`, payload);

      if (res.data?.success || res.data) {
        addToast(`Lịch trình thanh toán và phân chia hoa hồng cho căn ${selectedDepForManage?.unit_code || ''} đã được lưu thành công!`, 'success');
        setShowManageModal(false);
        fetchData();
      } else {
        addToast(res.data?.message || 'Lỗi lưu lịch trình thanh toán.', 'error');
      }
    } catch (err: any) {
      addToast(err?.response?.data?.message || err.message || 'Không thể kết nối đến máy chủ để lưu lịch trình thanh toán.', 'error');
    } finally {
      setIsSavingMilestones(false);
    }
  };

  const isReleaseBlocked = (() => {
    const currentStatus = contact?.pipeline_status || 'chua_xac_dinh';
    const blockedStatuses = ['dat_coc', 'da_coc', 'dong_deal', 'thanh_cong', ...(coopEligibleStatuses || [])];
    return blockedStatuses.includes(currentStatus);
  })();

  const handleReturnToDatabank = () => {
    if (isReleaseBlocked) return;
    showConfirm({
      title: 'Trả khách hàng về Databank',
      message: 'Bạn có chắc chắn muốn trả khách hàng này về Databank chung không? Lưu ý:\n\n• Nếu bạn là người duy nhất chăm sóc khách hàng này, khách hàng sẽ được nhả về Databank chung (không còn thuộc sở hữu của bạn).\n• Nếu có từ 2 Sale chăm sóc song song trở lên, hệ thống sẽ chỉ xóa khách hàng khỏi danh sách cá nhân của bạn, không ảnh hưởng đến Sale khác.',
      confirmText: 'Xác nhận trả',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.post(`/contacts/${contact.id}/release-databank`);
          if (res.data.success || res.data) {
            addToast(res.data.message || 'Thao tác thành công', 'success');
            onUpdate?.(null);
            onClose();
          }
        } catch (e: any) {
          addToast(e?.response?.data?.message || 'Không thể trả khách hàng về Databank', 'error');
        }
      }
    });
  };

  const handleAddMilestoneInput = () => {
    setDepositMilestones(prev => [...prev, { name: `Đợt ${prev.length + 1}`, amount: '' }]);
  };

  const handleRemoveMilestoneInput = (index: number) => {
    setDepositMilestones(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateTicket = async () => {
    if (!ticketForm.subject.trim() || isSubmitting) return;
    const isSelfEnteredOrDb = ['ca_nhan', 'cold_call', 'gioi_thieu'].includes(formData.source || contact?.source) || (formData.dl_status || contact?.dl_status) === 'databank_claim';
    if (isSelfEnteredOrDb && ticketForm.category === 'lead_error_compensation') {
      addToast('Khách hàng tự khai thác / Databank không hỗ trợ tạo ticket Báo lỗi bù data.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/tickets', {
        contact_id: contact.id,
        customer_name: fullName,
        subject: ticketForm.subject,
        category: ticketForm.category || 'technical_support',
        priority: ticketForm.priority,
        description: ticketForm.description
      });
      setShowTicketModal(false);
      setTicketForm({ subject: '', category: 'technical_support', priority: 'medium', description: '' });
      fetchData();
      addToast('Đã gửi yêu cầu hỗ trợ', 'success');
    } catch (e: any) {
      addToast(e?.response?.data?.message || 'Lỗi khi tạo ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReport = async () => {
    const leadId = formData.lead_id || contact?.lead_id;
    const saleId = formData.owner_id || contact?.owner_id;
    const roundId = formData.dl_round_id || contact?.dl_round_id;
    if (!leadId || !saleId || !roundId) {
      addToast('Thiếu thông tin phân bổ để báo lỗi', 'error');
      return;
    }
    if (!reportReasonType.trim() || submittingReport) return;
    const isOtherReason = reportReasonType.toLowerCase().includes('khác') || reportReasonType.toLowerCase().includes('other');
    if (isOtherReason && !reportDetails.trim()) {
      addToast('Vui lòng nhập mô tả chi tiết lý do lỗi.', 'error');
      return;
    }
    setSubmittingReport(true);
    try {
      const finalReason = isOtherReason
        ? `${reportReasonType}: ${reportDetails.trim()}`
        : (reportDetails.trim() ? `${reportReasonType} (Ghi chú: ${reportDetails.trim()})` : reportReasonType);

      const payload = {
        lead_id: Number(leadId),
        sale_id: Number(saleId),
        round_id: Number(roundId),
        reason: finalReason
      };

      const res = await api.post('/api.php?action=submit_report', payload);
      if (res.data.success) {
        if (res.data.auto_approved) {
          addToast('Báo cáo lỗi đã được HỆ THỐNG TỰ ĐỘNG PHÊ DUYỆT & ĐỀN BÙ thành công!', 'success');
        } else {
          addToast('Gửi báo lỗi data thành công! Đang chờ admin duyệt bù.', 'success');
        }
        setShowReportModal(false);
        fetchData();
      } else {
        addToast(res.data.message || 'Gửi báo lỗi thất bại', 'error');
      }
    } catch (err: any) {
      addToast('Lỗi kết nối: ' + (err?.response?.data?.message || err.message || ''), 'error');
    } finally {
      setSubmittingReport(false);
    }
  };

  // Document body overflow handling
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

  const drawerMotionProps = {
    initial: isMobileOrTablet ? { y: '100%' } : { x: '100%' },
    animate: { y: 0, x: 0 },
    exit: isMobileOrTablet ? { y: '100%' } : { x: '100%' },
    transition: { type: 'spring' as const, damping: 30, stiffness: 250, mass: 0.8 },
    drag: isMobileOrTablet ? ('y' as const) : false,
    dragConstraints: { top: 0 },
    dragElastic: { top: 0.05, bottom: 0.7 },
    onDragEnd: (event: any, info: any) => {
      if (isMobileOrTablet && (info.offset.y > 150 || info.velocity.y > 400)) {
        handleClose();
      }
    }
  };

  if (!contact) return null;

  if (typeof document === 'undefined') return null;

  const handleStageTransition = (targetId: string, targetName: string) => {
    const currentIdx = pipelineStages.findIndex(s => String(s.id) === String(formData.pipeline_status || 'chua_xac_dinh'));
    const safeIndex = currentIdx === -1 ? 0 : currentIdx;

    // Guard: Only owner or admin can change pipeline status
    const isOwner = Number(currentUser?.id) === Number(formData.owner_id || contact?.owner_id);
    const isAdmin = currentUser?.role && ['admin', 'superadmin', 'super_admin', 'assistant', 'director', 'manager'].includes(currentUser.role);
    if (currentUser?.role === 'sale' && !isOwner && !isAdmin) {
      const ownerName = formData.owner_name || contact?.owner_name || contact?.consultant_name || 'chủ sở hữu';
      addToast(`Chặn thao tác: Chỉ chủ sở hữu (Owner: ${ownerName}) mới có quyền chuyển trạng thái khách hàng!`, 'error');
      return;
    }

    const targetIdx = pipelineStages.findIndex(s => String(s.id) === String(targetId));
    const isBackward = targetIdx !== -1 && targetIdx < safeIndex;

    const currentStageObj = pipelineStages[safeIndex];
    const targetStageObj = pipelineStages[targetIdx];
    const isFromDeposit = currentStageObj?.name?.toLowerCase()?.includes('cọc') || currentStageObj?.name?.toLowerCase()?.includes('deposit');
    const isToSuccess = targetStageObj?.name?.toLowerCase()?.includes('hợp đồng') || targetStageObj?.name?.toLowerCase()?.includes('won') || targetStageObj?.name?.toLowerCase()?.includes('thành công') || targetStageObj?.is_won;
    const isCancellation = isFromDeposit && !isToSuccess;

    if (isBackward && !isCancellation && !allowPipelineBackward) {
      addToast("Không thể di chuyển ngược giai đoạn trên Pipeline.", "error");
      return;
    }

    const isForwardSkip = (targetIdx !== -1 && targetIdx > safeIndex + 1);
    if (isForwardSkip && !allowPipelineSkip) {
      addToast("Không được phép nhảy cóc giai đoạn. Tiến trình chuyển giai đoạn phải đi tuần tự từng bước.", "error");
      return;
    }

    // Check interaction guardrail: if transitioning to 'churned' or 'dong_deal' (Đã rời bỏ/Đóng), must have at least 1 activity
    if ((targetId === 'churned' || targetId === 'dong_deal') && drawerActivities.length === 0) {
      addToast('Chặn đóng deal: Khách hàng chưa từng có tương tác nào! Vui lòng tạo ghi chú cuộc gọi, email hoặc hoạt động trước.', 'error');
      return;
    }

    // Check TTL1 constraint: moving to status index >= 2 (e.g. 'dong_y_gap' / 'Đồng Ý Gặp' or later)
    if (targetIdx >= 2) {
      const count = Object.values(ttl1Data).filter(Boolean).length;
      if (count < 4) {
        addToast('Chặn chuyển giai đoạn: Yêu cầu hoàn thành tối thiểu 4/5 nhóm thông tin trong Form TTL1!', 'error');
        return;
      }
    }
    
    setPipelineModal({ isOpen: true, targetId, targetLabel: targetName, note: '' });
  };

  const pipelineStepperBar = (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border-light)', overflow: 'hidden', width: '100%', flexShrink: 0 }}>
      {!isMobileOrTablet && (
        <button className="btn outline sm" style={{ padding: '4px', height: 26, width: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: '50%', position: 'absolute', left: '0.75rem', zIndex: 10, background: 'var(--color-surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} onClick={() => document.getElementById('pipeline-scroll-container')?.scrollBy({ left: -250, behavior: 'smooth' })}>
          <ChevronLeft size={14} />
        </button>
      )}

      <div id="pipeline-scroll-container" className="no-scrollbar" style={{ display: 'flex', padding: isMobileOrTablet ? '0.625rem 1rem' : '0.625rem 3rem', gap: '12px', overflowX: 'auto', flex: 1, scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none', position: 'relative' }}>
        <style dangerouslySetInnerHTML={{ __html: `#pipeline-scroll-container::-webkit-scrollbar { display: none; }` }} />
        {(() => {
          const currentIdx = pipelineStages.findIndex(s => String(s.id) === String(formData.pipeline_status || 'chua_xac_dinh'));
          const safeIndex = currentIdx === -1 ? 0 : currentIdx;

          return pipelineStages.map((st, i) => {
            const isActive = i <= safeIndex;
            const isCurrent = i === safeIndex;
            const isBackward = i < safeIndex;
            const stColor = overridePurpleColor(st.color);
            return (
              <div
                key={st.id}
                onClick={() => {
                  if (isCurrent || isBackward) return;
                  handleStageTransition(String(st.id), st.name);
                }}
                style={{
                  flex: '1 0 auto', minWidth: '135px', position: 'relative', height: '32px', cursor: isCurrent ? 'default' : (isBackward ? 'not-allowed' : 'pointer'),
                  display: 'flex', alignItems: 'center', transition: 'all 0.3s',
                  opacity: isBackward ? 0.5 : 1
                }}
              >
                <div style={{
                  position: 'absolute', left: 0, right: 0, height: '4px',
                  background: isActive ? stColor : 'var(--color-border-light)',
                  borderRadius: '2px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }} />

                <div style={{
                  position: 'relative', zIndex: 2, flex: 1,
                  background: isCurrent ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: isCurrent ? '#fff' : 'var(--color-text-muted)',
                  border: isCurrent ? '2px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                  padding: '4px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  whiteSpace: 'nowrap',
                  boxShadow: isCurrent ? '0 4px 12px rgba(189, 29, 45, 0.2)' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}>
                  {isCurrent && <UserCheck size={12} />}
                  {st.name}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {!isMobileOrTablet && (
        <button className="btn outline sm" style={{ padding: '4px', height: 26, width: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: '50%', position: 'absolute', right: '0.75rem', zIndex: 10, background: 'var(--color-surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} onClick={() => document.getElementById('pipeline-scroll-container')?.scrollBy({ left: 250, behavior: 'smooth' })}>
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="drawer-backdrop"
              onClick={handleClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: zIndex ? zIndex - 5 : 1000005,
                background: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
              }}
            />
            <motion.div
              className={styles.drawer}
              {...drawerMotionProps}
              style={{
                left: isMobileOrTablet ? 0 : 'var(--sidebar-width, 220px)',
                right: 0,
                top: 0,
                bottom: 0,
                height: isMobileOrTablet ? '92dvh' : '100vh',
                marginTop: isMobileOrTablet ? '8dvh' : 0,
                borderRadius: isMobileOrTablet ? '24px 24px 0 0' : 0,
                overflow: 'hidden',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
                zIndex: zIndex || 1000010,
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                background: 'var(--color-surface)'
              }}
            >
              {isMobileOrTablet && (
                <div style={{ width: '36px', height: '5px', background: 'var(--color-border)', borderRadius: '999px', margin: '12px auto 2px', flexShrink: 0 }} />
              )}
              <AnimatePresence>
                {showAvatarModal && (
                  <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000020 }}>
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
                      style={{ position: 'fixed', inset: 0, zIndex: 1000050, background: isMobileOrTablet ? 'rgba(0,0,0,0.5)' : 'transparent' }}
                      onClick={() => setQuickUserCard(null)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      style={isMobileOrTablet ? {
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000060,
                        width: 'calc(100vw - 40px)',
                        maxWidth: '290px',
                        background: 'var(--color-surface)',
                        borderRadius: '20px',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
                        border: '1px solid rgba(163, 20, 34, 0.12)',
                        overflow: 'hidden'
                      } : {
                        position: 'fixed',
                        top: quickUserCard.y + 15,
                        left: quickUserCard.x - 130,
                        zIndex: 1000060,
                        width: 270,
                        background: 'var(--color-surface)',
                        borderRadius: '20px',
                        boxShadow: '0 20px 48px -10px rgba(163, 20, 34, 0.18), 0 8px 24px -6px rgba(0,0,0,0.06)',
                        border: '1px solid rgba(163, 20, 34, 0.12)',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ height: 75, background: 'linear-gradient(135deg, var(--color-primary) 0%, #8a0f1b 100%)' }} />
                      <div style={{ padding: '0 1.25rem 1.25rem', textAlign: 'center', marginTop: -32 }}>
                        <div style={{ 
                          width: 64, 
                          height: 64, 
                          borderRadius: '50%', 
                          background: 'var(--color-surface)', 
                          margin: '0 auto 0.5rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', 
                          border: '4px solid var(--color-surface)', 
                          fontSize: '1.5rem', 
                          fontWeight: 800, 
                          color: 'var(--color-primary)',
                          overflow: 'hidden'
                        }}>
                          {quickUserCard.avatarUrl ? (
                            <img 
                              src={quickUserCard.avatarUrl} 
                              alt={quickUserCard.name} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            />
                          ) : (
                            quickUserCard.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '2px' }}>
                          {quickUserCard.name}
                        </h4>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                          RL-{String(quickUserCard.id).padStart(4, '0')}
                        </span>
                        
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                          {['admin', 'superadmin', 'super_admin'].includes(quickUserCard.role.toLowerCase()) 
                            ? 'Quản trị viên' 
                            : ['manager', 'director'].includes(quickUserCard.role.toLowerCase()) 
                              ? 'Trưởng nhóm kinh doanh' 
                              : 'Nhân viên kinh doanh'}
                        </p>
                        
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                          <span style={{ 
                            fontSize: '0.65rem', 
                            padding: '3px 8px', 
                            borderRadius: '100px', 
                            background: quickUserCard.vacationMode === 1 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)', 
                            color: quickUserCard.vacationMode === 1 ? '#d97706' : '#059669', 
                            border: quickUserCard.vacationMode === 1 ? '1px solid rgba(245, 158, 11, 0.15)' : '1px solid rgba(16, 185, 129, 0.15)',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span style={{ 
                              width: 6, 
                              height: 6, 
                              borderRadius: '50%', 
                              background: quickUserCard.vacationMode === 1 ? '#d97706' : '#059669' 
                            }} />
                            {quickUserCard.vacationMode === 1 ? 'Nghỉ phép (Tạm ngưng nhận lead)' : 'Đang hoạt động (Sẵn sàng nhận lead)'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                          {quickUserCard.email && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--color-bg)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={quickUserCard.email}>
                                <Mail size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quickUserCard.email}</span>
                              </div>
                              <button
                                type="button"
                                className="btn-icon xs"
                                onClick={() => copyToClipboard(quickUserCard.email || '', 'email')}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-muted)', display: 'inline-flex', borderRadius: '4px' }}
                                title="Sao chép email"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          )}
                          {quickUserCard.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--color-bg)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={quickUserCard.phone}>
                                <Phone size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>{quickUserCard.phone}</span>
                              </div>
                              <button
                                type="button"
                                className="btn-icon xs"
                                onClick={() => copyToClipboard(quickUserCard.phone || '', 'số điện thoại')}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-muted)', display: 'inline-flex', borderRadius: '4px' }}
                                title="Sao chép số điện thoại"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', width: '100%' }}>
                          {quickUserCard.email && (
                            <a 
                              href={`mailto:${quickUserCard.email}`} 
                              className="btn primary sm" 
                              style={{ flex: 1, height: '32px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <Mail size={12} />
                              Email
                            </a>
                          )}
                          {quickUserCard.phone && (
                            <a 
                              href={`tel:${quickUserCard.phone}`} 
                              className="btn outline sm" 
                              style={{ flex: 1, height: '32px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <Phone size={12} />
                              Gọi điện
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* ── Header ── */}
              {isMobileOrTablet ? (
                /* ── Compact Sticky Header for Mobile ── */
                <div style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 150,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 1rem',
                  background: 'var(--color-surface)',
                  borderBottom: '1px solid var(--color-border-light)',
                  height: '52px',
                  boxSizing: 'border-box',
                  width: '100%',
                  flexShrink: 0
                }}>
                  <button 
                    onClick={handleClose} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    <LogOut size={20} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '0 0.5rem', overflow: 'hidden' }}>
                    <Avatar 
                      src={formData.avatar_url} 
                      name={fullName} 
                      size={24} 
                    />
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center' }}>
                      {fullName}
                      {((formData.dl_status || contact?.dl_status) === 'databank_claim' || (formData.source || contact?.source) === 'databank') ? (
                        <span title="Khách hàng từ Databank" style={{ display: 'inline-flex', marginLeft: '6px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                          <Layers size={13} />
                        </span>
                      ) : (!(formData.dl_status || contact?.dl_status) && (formData.source || contact?.source) !== 'databank') ? (
                        <span title="Khách hàng cá nhân" style={{ display: 'inline-flex', marginLeft: '6px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                          <User size={13} />
                        </span>
                      ) : null}
                    </h3>
                  </div>
                  <button
                    disabled={isSubmitting}
                    onClick={handleSave}
                    className="btn success sm"
                    style={{
                      padding: isMobileOrTablet ? '6px 12px' : '6px 14px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      height: isMobileOrTablet ? '36px' : '32px',
                      width: isMobileOrTablet ? '44px' : undefined,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: isMobileOrTablet ? '0' : '6px',
                      background: 'var(--color-primary)',
                      borderColor: 'var(--color-primary)',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <Save size={isMobileOrTablet ? 16 : 14} />
                    {!isMobileOrTablet && <span>Lưu</span>}
                  </button>
                </div>
              ) : (
                /* ── Desktop Profile Header ── */
                <div className={styles.profileHeader}>
                  {/* Absolute Close Button */}
                  <button className={styles.closeBtnAbsolute} onClick={handleClose} aria-label="Close drawer">
                    <X size={20} />
                  </button>

                  {/* Not Lead Proposal Banner */}
                  {formData.not_lead_proposed === 1 && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
                      padding: '10px 1.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', fontSize: '0.8rem', fontWeight: 600 }}>
                        <ShieldAlert size={16} />
                        <span>Khách hàng này được đề xuất loại khỏi phễu (Not Lead) và đang chờ phê duyệt.</span>
                      </div>
                      {((currentUser?.role as string) === 'admin' || (currentUser?.role as string) === 'superadmin' || (currentUser?.role as string) === 'super_admin' || (currentUser?.role as string) === 'director' || (currentUser?.role as string) === 'ads' || (currentUser?.role as string) === 'content') && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn success sm"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', height: '28px', color: 'white', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={async () => {
                              try {
                                const res = await api.put(`/contacts/${contact.id}`, { pipeline_status: 'not_lead' });
                                if (res.data.success) {
                                  setFormData((prev: any) => ({ ...prev, pipeline_status: 'not_lead', not_lead_proposed: 0 }));
                                  addToast('Đã phê duyệt Not Lead thành công!', 'success');
                                  onUpdate?.({ ...formData, pipeline_status: 'not_lead', not_lead_proposed: 0 });
                                }
                              } catch (err: any) {
                                addToast(err.response?.data?.message || 'Lỗi khi phê duyệt', 'error');
                              }
                            }}
                          >
                            <Check size={12} /> Duyệt
                          </button>
                          <button
                            type="button"
                            className="btn outline sm"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', height: '28px' }}
                            onClick={async () => {
                              try {
                                const res = await api.put(`/contacts/${contact.id}`, { not_lead_proposed: 0 });
                                if (res.data.success) {
                                  setFormData((prev: any) => ({ ...prev, not_lead_proposed: 0 }));
                                  addToast('Đã từ chối đề xuất Not Lead!', 'success');
                                  onUpdate?.({ ...formData, not_lead_proposed: 0 });
                                }
                              } catch (err: any) {
                                addToast(err.response?.data?.message || 'Lỗi khi từ chối', 'error');
                              }
                            }}
                          >
                            Từ chối
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.profileHeaderContent}>
                    {/* Avatar Section */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          position: 'relative'
                        }}
                        onClick={() => {
                          setTempAvatar(formData.avatar_url || '');
                          setShowAvatarModal(true);
                        }}
                      >
                        <Avatar 
                          src={formData.avatar_url} 
                          name={fullName} 
                          size={56} 
                        />
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
                        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {fullName}
                          {((formData.dl_status || contact?.dl_status) === 'databank_claim' || (formData.source || contact?.source) === 'databank') ? (
                            <span title="Khách hàng từ Databank" style={{ display: 'inline-flex', marginLeft: '6px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                              <Layers size={15} />
                            </span>
                          ) : (!(formData.dl_status || contact?.dl_status) && (formData.source || contact?.source) !== 'databank') ? (
                            <span title="Khách hàng cá nhân" style={{ display: 'inline-flex', marginLeft: '6px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                              <User size={15} />
                            </span>
                          ) : null}
                          <button
                            className="btn-icon xs"
                            style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px' }}
                            onClick={() => copyToClipboard(fullName, 'name')}
                            title="Sao chép tên"
                          >
                            {copiedField === 'name' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                          </button>
                        </h2>
                        <span className={`badge ${formData.status === 'customer' ? 'success' : formData.status === 'qualified' ? 'warning' : 'info'}`} style={{ padding: '2px 8px', fontSize: '0.6875rem', borderRadius: '6px' }}>
                          {formData.status === 'customer' ? 'Khách hàng VIP' : formData.status === 'qualified' ? 'Đã thẩm định' : 'Tiềm năng'}
                        </span>
                        {formData.temperature && tempLabels[formData.temperature] && (
                          <span 
                            style={{ 
                              padding: '2px 8px', 
                              fontSize: '0.6875rem', 
                              borderRadius: '6px',
                              fontWeight: 700,
                              color: tempLabels[formData.temperature].color,
                              background: tempLabels[formData.temperature].bg,
                              border: `1px solid ${tempLabels[formData.temperature].color}33`,
                              marginLeft: '6px'
                            }}
                            title={`Nhiệt độ sale chốt: ${tempLabels[formData.temperature].label}`}
                          >
                            Nhiệt: {tempLabels[formData.temperature].label}
                          </span>
                        )}
                        {formData.suggested_temperature && tempLabels[formData.suggested_temperature] && (
                          <span 
                            style={{ 
                              padding: '2px 8px', 
                              fontSize: '0.6875rem', 
                              borderRadius: '6px',
                              fontWeight: 600,
                              color: '#64748b',
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border-light)',
                              marginLeft: '6px'
                            }}
                            title={`Máy đề xuất: ${tempLabels[formData.suggested_temperature].label}`}
                          >
                            AI: {tempLabels[formData.suggested_temperature].label}
                          </span>
                        )}
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
                          {formData.phone && (
                            <button
                              className="btn-icon xs"
                              style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', marginLeft: '-2px' }}
                              onClick={() => copyToClipboard(formData.phone, 'phone')}
                              title="Sao chép số điện thoại"
                            >
                              {copiedField === 'phone' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Mail size={12} className="text-muted" />
                          </div>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{formData.email || 'contact@email.com'}</span>
                          {formData.email && (
                            <button
                              className="btn-icon xs"
                              style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', marginLeft: '-2px' }}
                              onClick={() => copyToClipboard(formData.email, 'email')}
                              title="Sao chép email"
                            >
                              {copiedField === 'email' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                        {coopSlip ? (
                          <div
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              padding: '2px 8px 2px 4px', 
                              background: 'linear-gradient(135deg, rgba(163, 20, 34, 0.08) 0%, rgba(163, 20, 34, 0.01) 100%)', 
                              border: '1px solid rgba(163, 20, 34, 0.15)', 
                              borderRadius: '20px',
                              boxShadow: 'var(--shadow-sm)'
                            }}
                          >
                            <span style={{ 
                              fontSize: '0.65rem', 
                              fontWeight: 800, 
                              color: 'var(--color-primary)', 
                              textTransform: 'uppercase', 
                              letterSpacing: '0.05em',
                              padding: '2px 6px',
                              background: 'var(--color-surface)',
                              borderRadius: '9999px',
                              border: '1px solid rgba(163, 20, 34, 0.1)'
                            }}>
                              Hợp tác
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
                              {(coopSlip.shareholders || []).map((sh: any, shIdx: number) => (
                                <div 
                                  key={shIdx} 
                                  style={{ 
                                    marginLeft: shIdx > 0 ? '-8px' : '0', 
                                    position: 'relative',
                                    cursor: 'pointer'
                                  }}
                                  onClick={(e) => showUserCard(e, sh.name)}
                                  title={`${sh.name}\n- Trạng thái: ${sh.signed ? 'Đã ký' : 'Chờ ký'}\n- Tỷ lệ: ${sh.percentage}%\n- Hoa hồng dự kiến: ${FMT((Number(coopSlip.expected_commission || 0) * Number(sh.percentage || 0)) / 100)}`}
                                >
                                  <Avatar 
                                    src={resolveAttachmentUrl(sh.avatar)}
                                    name={sh.name} 
                                    size={22}
                                    style={{
                                      border: '2px solid var(--color-primary)',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : collabsList.length > 0 ? (
                          <div
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              padding: '2px 8px 2px 4px', 
                              background: '#e2e8f0', 
                              border: '1px solid var(--color-border-light)', 
                              borderRadius: '20px',
                              boxShadow: 'var(--shadow-sm)'
                            }}
                          >
                            <span style={{ 
                              fontSize: '0.65rem', 
                              fontWeight: 800, 
                              color: 'var(--color-primary)', 
                              textTransform: 'uppercase', 
                              letterSpacing: '0.05em',
                              padding: '2px 6px',
                              background: 'var(--color-surface)',
                              borderRadius: '9999px',
                              border: '1px solid var(--color-border-light)'
                            }}>
                              Chăm sóc chung
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
                              <div 
                                style={{ 
                                  position: 'relative',
                                  cursor: 'pointer'
                                }}
                                onClick={(e) => showUserCard(e, formData.owner_name)}
                                title={`${formData.owner_name || 'Sale phụ trách'} (Chính)`}
                              >
                                <Avatar 
                                  src={ownerAvatarUrl}
                                  name={formData.owner_name} 
                                  size={22}
                                  style={{
                                    border: '2px solid var(--color-primary)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                  }}
                                />
                              </div>
                              {collabsList.map((collab: any, cIdx: number) => (
                                <div 
                                  key={cIdx} 
                                  style={{ 
                                    marginLeft: '-8px', 
                                    position: 'relative',
                                    cursor: 'pointer'
                                  }}
                                  onClick={(e) => showUserCard(e, collab.full_name)}
                                  title={`${collab.full_name} (Phụ)`}
                                >
                                  <Avatar 
                                    src={collab.avatar_url}
                                    name={collab.full_name} 
                                    size={22}
                                    style={{
                                      border: '2px solid #9333ea',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'pointer' }}
                            onClick={(e) => showUserCard(e, formData.owner_name)}
                          >
                            <Avatar 
                              src={ownerAvatarUrl}
                              name={formData.owner_name} 
                              size={20} 
                            />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8a0f1b' }}>{formData.owner_name || 'Sale phụ trách'}</span>
                          </div>
                        )}
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
                        disabled={isSubmitting}
                        onClick={handleSave}
                        className="btn"
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          padding: '8px 18px', 
                          borderRadius: '10px', 
                          height: '40px', 
                          fontSize: '0.875rem',
                          background: 'var(--color-primary)',
                          borderColor: 'var(--color-primary)',
                          color: 'white',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Save size={14} /> Lưu thay đổi
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Pipeline Stepper Bar (Desktop Only) ── */}
              {!isMobileOrTablet && pipelineStepperBar}

              {/* ── Layout Split: Left Sidebar Tabs & Content ── */}
              <div className={styles.drawerBody}>
                {loadingContactDetails ? (
                  <DrawerSkeleton />
                ) : (
                  <>
                    <AnimatePresence>
                      {(!isMobileOrTablet || !activeTab) && (
                        <motion.div
                          initial={isMobileOrTablet ? { opacity: 0, x: -30 } : undefined}
                          animate={isMobileOrTablet ? { opacity: 1, x: 0 } : undefined}
                          exit={isMobileOrTablet ? { opacity: 0, x: -30 } : undefined}
                          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                          className={styles.sidebarTabs}
                          style={isMobileOrTablet ? { width: '100%', gap: '0.25rem', padding: '12px 12px 100px 12px', overflowY: 'auto' } : { gap: '0.25rem', overflowY: 'auto' }}
                        >
                        {isMobileOrTablet ? (
                          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            {/* Compact Mobile Profile Info Card */}
                            <div style={{
                              background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-bg-dark) 100%)',
                              padding: '1rem',
                              borderBottom: '1px solid var(--color-border-light)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              borderTopLeftRadius: '12px',
                              borderTopRightRadius: '12px',
                              borderBottomLeftRadius: '0px',
                              borderBottomRightRadius: '0px',
                              marginBottom: '1rem'
                            }}>
                               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                  {/* Avatar on the left */}
                                  <div style={{ flexShrink: 0 }}>
                                    <Avatar name={fullName} src={formData.avatar_url} size={48} />
                                  </div>

                                  {/* Center/Right: Phone & Email */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Phone size={12} className="text-primary" style={{ flexShrink: 0 }} />
                                      <PhoneLink phone={formData.phone} style={{ fontSize: '0.8125rem', fontWeight: 700 }} />
                                    </div>
                                    {formData.email && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                        <Mail size={12} className="text-muted" style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formData.email}>
                                          {formData.email}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Far Right: Score Ring */}
                                <div 
                                  onClick={() => setActiveTab('scoring')}
                                  style={{ cursor: 'pointer', flexShrink: 0 }}
                                >
                                  <LeadScoreRing score={score} size={32} showLabel={true} />
                                </div>
                              </div>

                              {/* Row 2: Pipeline status wrapped in a beautiful card */}
                              <div style={{
                                width: '100%',
                                marginTop: '4px',
                                padding: '10px 12px',
                                background: 'var(--color-surface-hover, #f8fafc)',
                                borderRadius: '10px',
                                border: '1px solid var(--color-border-light)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px'
                              }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Trạng thái:</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {(() => {
                                    const currentStageObj = pipelineStages.find(s => String(s.id) === String(formData.pipeline_status || 'chua_xac_dinh'));
                                    const stColor = currentStageObj ? overridePurpleColor(currentStageObj.color) : 'var(--color-text-muted)';
                                    return (
                                      <button 
                                        onClick={() => setShowMobilePipelineSelector(true)}
                                        style={{
                                          padding: '4px 10px',
                                          fontSize: '0.75rem',
                                          borderRadius: '6px',
                                          fontWeight: 800,
                                          background: currentStageObj ? `${stColor}1a` : 'var(--color-bg)',
                                          color: stColor,
                                          border: `1px solid ${stColor}33`,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          cursor: 'pointer',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                        }}
                                      >
                                        <span>{currentStageObj?.name || 'Chưa xác định'}</span>
                                        <ChevronRight size={12} />
                                      </button>
                                    );
                                  })()}
                                  {formData.not_lead_proposed === 1 && (
                                    <span className="badge danger" style={{ padding: '2px 6px', fontSize: '0.625rem', borderRadius: '4px' }}>Chờ duyệt loại</span>
                                  )}
                                </div>
                              </div>

                              {/* Row 2: Owner & Last Interaction */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '0.7rem', color: 'var(--color-text-muted)', paddingTop: '8px', borderTop: 'none', flexWrap: 'wrap' }}>
                                {coopSlip ? (
                                  <div
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      padding: '2px 6px 2px 3px', 
                                      background: 'rgba(163, 20, 34, 0.08)', 
                                      border: '1px solid rgba(163, 20, 34, 0.15)', 
                                      borderRadius: '20px',
                                      boxShadow: 'var(--shadow-sm)'
                                    }}
                                  >
                                    <span style={{ 
                                      fontSize: '0.6rem', 
                                      fontWeight: 800, 
                                      color: 'var(--color-primary)', 
                                      textTransform: 'uppercase', 
                                      padding: '1px 4px',
                                      background: 'var(--color-surface)',
                                      borderRadius: '9999px',
                                      border: '1px solid rgba(163, 20, 34, 0.1)'
                                    }}>
                                      Hợp tác
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: '2px' }}>
                                      {(coopSlip.shareholders || []).map((sh: any, shIdx: number) => (
                                        <div 
                                          key={shIdx} 
                                          style={{ 
                                            marginLeft: shIdx > 0 ? '-6px' : '0', 
                                            position: 'relative',
                                            cursor: 'pointer'
                                          }}
                                          onClick={(e) => showUserCard(e, sh.name)}
                                          title={`${sh.name}\n- Trạng thái: ${sh.signed ? 'Đã ký' : 'Chờ ký'}\n- Tỷ lệ: ${sh.percentage}%\n- Hoa hồng dự kiến: ${FMT((Number(coopSlip.expected_commission || 0) * Number(sh.percentage || 0)) / 100)}`}
                                        >
                                          <Avatar 
                                            src={resolveAttachmentUrl(sh.avatar)}
                                            name={sh.name} 
                                            size={18}
                                            style={{
                                              border: '1.5px solid var(--color-primary)',
                                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : collabsList.length > 0 ? (
                                  <div
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      padding: '2px 6px 2px 3px', 
                                      background: '#e2e8f0', 
                                      border: '1px solid var(--color-border-light)', 
                                      borderRadius: '20px',
                                      boxShadow: 'var(--shadow-sm)'
                                    }}
                                  >
                                    <span style={{ 
                                      fontSize: '0.6rem', 
                                      fontWeight: 800, 
                                      color: 'var(--color-primary)', 
                                      textTransform: 'uppercase', 
                                      padding: '1px 4px',
                                      background: 'var(--color-surface)',
                                      borderRadius: '9999px',
                                      border: '1px solid var(--color-border-light)'
                                    }}>
                                      Chăm sóc chung
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: '2px' }}>
                                      <div 
                                        style={{ 
                                          position: 'relative',
                                          cursor: 'pointer'
                                        }}
                                        onClick={(e) => showUserCard(e, formData.owner_name)}
                                        title={`${formData.owner_name || 'Sale phụ trách'} (Chính)`}
                                      >
                                        <Avatar 
                                          src={ownerAvatarUrl}
                                          name={formData.owner_name} 
                                          size={18}
                                          style={{
                                            border: '1.5px solid var(--color-primary)',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                          }}
                                        />
                                      </div>
                                      {collabsList.map((collab: any, cIdx: number) => (
                                        <div 
                                          key={cIdx} 
                                          style={{ 
                                            marginLeft: '-6px', 
                                            position: 'relative',
                                            cursor: 'pointer'
                                          }}
                                          onClick={(e) => showUserCard(e, collab.full_name)}
                                          title={`${collab.full_name} (Phụ)`}
                                        >
                                          <Avatar 
                                            src={collab.avatar_url}
                                            name={collab.full_name} 
                                            size={18}
                                            style={{
                                              border: '1.5px solid #9333ea',
                                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer' }}
                                    onClick={(e) => showUserCard(e, formData.owner_name)}
                                  >
                                    <Avatar 
                                      src={ownerAvatarUrl}
                                      name={formData.owner_name} 
                                      size={16} 
                                    />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8a0f1b' }}>{formData.owner_name || 'Chưa nhận'}</span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={11} style={{ color: 'var(--color-text-muted)' }} />
                                  <span>{formData.last_contact ? `Tương tác: ${AGO(formData.last_contact)}` : 'Chưa tương tác'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Mobile Tab Groups */}
                            {(() => {
                              const tabGroups = [
                                {
                                  title: 'Thông tin & Nhật ký',
                                  tabs: ['info', 'tags', 'ttl1', 'tasks', 'timeline', 'scoring']
                                },
                                {
                                  title: 'Giao dịch & Tài liệu',
                                  tabs: ['cooperation', 'docs', 'deals', 'quotes', 'invoices', 'expenses']
                                },
                                {
                                  title: 'Nghiệp vụ & Hỗ trợ',
                                  tabs: ['tickets']
                                }
                              ];

                              return tabGroups.map((group, groupIdx) => {
                                const allowedTabs = group.tabs
                                  .map(id => TABS.find(tab => tab.id === id))
                                  .filter((tab): tab is any => !!tab && (isOwnerOrAdmin || (tab.id !== 'quotes' && tab.id !== 'expenses')));
                                if (allowedTabs.length === 0) return null;

                                return (
                                  <div key={groupIdx} style={{ marginBottom: '1rem' }}>
                                    <div style={{ 
                                      padding: '0.25rem 4px', 
                                      fontSize: '0.7rem', 
                                      fontWeight: 800, 
                                      color: 'var(--color-text-muted)', 
                                      textTransform: 'uppercase', 
                                      letterSpacing: '0.08em',
                                      marginBottom: '6px'
                                    }}>
                                      {group.title}
                                    </div>
                                    <div className="os-list-group">
                                      {allowedTabs.map(tab => (
                                        <button
                                          key={tab.id}
                                          className="os-list-item"
                                          onClick={() => setActiveTab(tab.id)}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {renderColoredTabIcon(tab.id, tab.icon)}
                                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{tab.label}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {tab.id === 'tasks' && tasks.filter(t => !t.done).length > 0 && (
                                              <span style={{
                                                background: 'var(--color-danger)',
                                                color: 'white',
                                                fontSize: '0.65rem',
                                                fontWeight: 700,
                                                padding: '1px 6px',
                                                borderRadius: '10px',
                                              }}>
                                                {tasks.filter(t => !t.done).length}
                                              </span>
                                            )}
                                            {tab.id === 'cooperation' && coopSlip && (coopSlip.status === 'pending_manager_approval' || coopSlip.shareholders?.some((sh: any) => !sh.signed)) && (
                                              <span style={{
                                                background: '#f59e0b',
                                                color: 'white',
                                                fontSize: '0.65rem',
                                                fontWeight: 700,
                                                padding: '2px 6px',
                                                borderRadius: '10px',
                                              }}>
                                                {coopSlip.status === 'pending_manager_approval' ? 'Chờ duyệt' : 'Chờ ký'}
                                              </span>
                                            )}
                                            <ChevronRight size={16} style={{ color: 'var(--color-text-light)' }} />
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const tabGroups = [
                                {
                                  title: 'Thông tin & Nhật ký',
                                  tabs: ['info', 'tags', 'ttl1', 'tasks', 'timeline', 'scoring']
                                },
                                {
                                  title: 'Giao dịch & Tài liệu',
                                  tabs: ['cooperation', 'docs', 'deals', 'quotes', 'invoices', 'expenses']
                                },
                                {
                                  title: 'Nghiệp vụ & Hỗ trợ',
                                  tabs: ['tickets']
                                }
                              ];

                              return tabGroups.map((group, groupIdx) => {
                                const allowedTabs = group.tabs
                                  .map(id => TABS.find(tab => tab.id === id))
                                  .filter((tab): tab is any => !!tab && (isOwnerOrAdmin || (tab.id !== 'quotes' && tab.id !== 'expenses')));
                                if (allowedTabs.length === 0) return null;

                                return (
                                  <div key={groupIdx} className={styles.tabGroup} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginBottom: groupIdx !== tabGroups.length - 1 ? '0.75rem' : 0 }}>
                                    <div className={styles.tabGroupTitle} style={{ 
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
                                        style={{ padding: '11px 0.875rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                          {renderColoredTabIcon(tab.id, tab.icon)}
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
                                        {tab.id === 'cooperation' && coopSlip && (coopSlip.status === 'pending_manager_approval' || coopSlip.shareholders?.some((sh: any) => !sh.signed)) && (
                                          <span style={{
                                            background: '#f59e0b',
                                            color: 'white',
                                            fontSize: '0.675rem',
                                            fontWeight: 700,
                                            padding: '3px 8px',
                                            borderRadius: '20px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            lineHeight: 1
                                          }}>
                                            {coopSlip.status === 'pending_manager_approval' ? 'Chờ duyệt' : 'Chờ ký'}
                                          </span>
                                        )}
                                      </button>
                                    ))}

                                    {group.title === 'Nghiệp vụ & Hỗ trợ' && 
                                     !['ca_nhan', 'cold_call', 'gioi_thieu'].includes(formData.source || contact?.source) && 
                                     (formData.dl_status || contact?.dl_status) !== 'databank_claim' && 
                                     Number(formData.dl_round_id || contact?.dl_round_id) > 0 && (
                                       (formData.ticket_status || contact?.ticket_status || contact?.report_status) ? (
                                         <div
                                           style={{
                                             padding: '11px 0.875rem',
                                             fontSize: '0.85rem',
                                             display: 'flex',
                                             alignItems: 'center',
                                             gap: '8px',
                                             width: '100%',
                                             borderRadius: '6px',
                                             fontWeight: 600,
                                             marginTop: '0.15rem',
                                             color: 
                                               (formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'approved' || (formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'resolved' || (formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'approved_no_comp' ? '#10b981' :
                                               (formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'rejected' ? '#ef4444' : '#f59e0b',
                                             background: 
                                               (formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'approved' || (formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'resolved' || (formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'approved_no_comp' ? 'rgba(16, 185, 129, 0.08)' :
                                               (formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'rejected' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                             border: '1px solid currentColor'
                                           }}
                                         >
                                           {(formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'approved' || (formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'resolved' || (formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'approved_no_comp' ? (
                                             <>
                                               <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                                               <span>Báo lỗi: Đã duyệt</span>
                                             </>
                                           ) : (formData.ticket_status || contact?.ticket_status || contact?.report_status) === 'rejected' ? (
                                             <>
                                               <XCircle size={16} style={{ color: '#ef4444' }} />
                                               <span>Báo lỗi: Bị từ chối</span>
                                             </>
                                           ) : (
                                             <>
                                               <Clock size={16} style={{ color: '#f59e0b' }} />
                                               <span>Báo lỗi: Chờ duyệt</span>
                                             </>
                                           )}
                                         </div>
                                       ) : (
                                         <button
                                           className={styles.sidebarTabBtn}
                                           onClick={async () => {
                                             if (reportReasons.length === 0) {
                                               try {
                                                 const res = await api.get('/api.php?action=get_report_context');
                                                 if (res.data && res.data.success && res.data.data.report_error_reasons) {
                                                   setReportReasons(res.data.data.report_error_reasons);
                                                   setReportReasonType(res.data.data.report_error_reasons[0]?.reason || 'Sai số điện thoại / Số ảo');
                                                 } else {
                                                   setReportReasonType('Sai số điện thoại / Số ảo');
                                                 }
                                               } catch (e) {
                                                 console.error(e);
                                                 setReportReasonType('Sai số điện thoại / Số ảo');
                                               }
                                             } else {
                                               setReportReasonType(reportReasons[0]?.reason || 'Sai số điện thoại / Số ảo');
                                             }
                                             setReportDetails('');
                                             setShowReportModal(true);
                                           }}
                                           style={{
                                             padding: '11px 0.875rem',
                                             fontSize: '0.85rem',
                                             display: 'flex',
                                             alignItems: 'center',
                                             gap: '8px',
                                             width: '100%',
                                             border: 'none',
                                             background: 'transparent',
                                             borderRadius: '6px',
                                             textAlign: 'left',
                                             cursor: 'pointer',
                                             fontWeight: 600,
                                             transition: 'all 0.15s ease',
                                             marginTop: '0.15rem'
                                           }}
                                         >
                                           <ShieldAlert size={16} style={{ color: '#ef4444' }} />
                                           <span>Báo lỗi data</span>
                                         </button>
                                       )
                                     )}

                                    {group.title === 'Nghiệp vụ & Hỗ trợ' && isOwnerOrAdmin && (
                                      <button
                                        className={styles.sidebarTabBtn}
                                        onClick={isReleaseBlocked ? undefined : handleReturnToDatabank}
                                        disabled={isReleaseBlocked}
                                        style={{
                                          padding: '11px 0.875rem',
                                          fontSize: '0.85rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          width: '100%',
                                          border: 'none',
                                          background: 'transparent',
                                          borderRadius: '6px',
                                          textAlign: 'left',
                                          cursor: isReleaseBlocked ? 'not-allowed' : 'pointer',
                                          color: isReleaseBlocked ? 'var(--color-text-muted)' : 'var(--color-danger)',
                                          fontWeight: 600,
                                          opacity: isReleaseBlocked ? 0.5 : 1,
                                          transition: 'all 0.15s ease',
                                          marginTop: '0.15rem'
                                        }}
                                        onMouseEnter={e => {
                                          if (!isReleaseBlocked) e.currentTarget.style.background = 'rgba(220, 38, 38, 0.05)';
                                        }}
                                        onMouseLeave={e => {
                                          if (!isReleaseBlocked) e.currentTarget.style.background = 'transparent';
                                        }}
                                        title={isReleaseBlocked ? t('Không thể trả về Databank do trạng thái khách hàng đặc biệt') : undefined}
                                      >
                                        <RotateCcw size={16} />
                                        <span>Trả về Databank</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                            <div style={{ marginTop: 'auto', padding: '1rem 0 0 0', borderTop: '1px solid var(--color-border)' }}>
                              <p style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>Enterprise CRM</p>
                            </div>
                          </>
                        )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                {/* Content Area */}
                <AnimatePresence>
                  {(!isMobileOrTablet || activeTab) && (
                    <motion.div 
                      key={activeTab || 'content'}
                      initial={isMobileOrTablet ? { opacity: 0, x: 30 } : undefined}
                      animate={isMobileOrTablet ? { opacity: 1, x: 0 } : undefined}
                      exit={isMobileOrTablet ? { opacity: 0, x: 30 } : undefined}
                      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                      className={styles.contentArea} 
                      style={isMobileOrTablet ? { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '0', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', overflowX: 'hidden' } : undefined}
                    >
                    {isMobileOrTablet && activeTab && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 16px',
                        background: 'transparent',
                        borderBottom: 'none',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        flexShrink: 0
                      }}>
                        <button
                          onClick={() => setActiveTab('')}
                          style={{
                            background: 'none',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--color-primary)',
                            padding: '4px',
                            marginLeft: '-4px'
                          }}
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                          {TABS.find(t => t.id === activeTab)?.label || ''}
                        </span>
                      </div>
                    )}

                    <div style={isMobileOrTablet ? { padding: '12px 12px 100px 12px', flex: 1, width: '100%', minWidth: 0, boxSizing: 'border-box', overflowX: 'hidden' } : undefined}>

                  {/* INFO TAB */}
                  {activeTab === 'info' && (
                    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Quick Stats Dashboard */}
                      <div style={{ display: 'grid', gridTemplateColumns: isMobileOrTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '0.75rem' }}>
                        <div className="card-panel stat-card hover-lift" style={{ 
                          padding: isMobileOrTablet ? '0.75rem 0.875rem' : '1rem 1.125rem', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          borderRadius: '14px', 
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                          <div className="decor-svg" style={{ color: '#3b82f6' }}>
                            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                              <path d="M20 70 L 45 45 L 60 60 L 85 30 M 85 30 H 65 M 85 30 V 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                            </svg>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>DỰ KIẾN DOANH THU</span>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <TrendingUp size={16} />
                            </div>
                          </div>
                          <span style={{ fontSize: isMobileOrTablet ? '0.8rem' : '0.95rem', fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{FMT(formData.expected_revenue || 0)}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ color: '#3b82f6', fontWeight: 700 }}>{formData.win_probability || 0}%</span> xác suất</span>
                        </div>

                        <div className="card-panel stat-card hover-lift" style={{ 
                          padding: isMobileOrTablet ? '0.75rem 0.875rem' : '1rem 1.125rem', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          borderRadius: '14px', 
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                          <div className="decor-svg" style={{ color: '#10b981' }}>
                            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                              <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                              <path d="M30 50 L 45 65 L 75 35" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>DOANH THU THỰC TẾ</span>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <CheckCircle2 size={16} />
                            </div>
                          </div>
                          <span style={{ fontSize: isMobileOrTablet ? '0.8rem' : '0.95rem', fontWeight: 800, color: '#10b981', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{FMT(formData.actual_revenue || 0)}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ color: '#10b981', fontWeight: 700 }}>{formData.paid_invoice_count || 0}</span> hóa đơn</span>
                        </div>

                        <div className="card-panel stat-card hover-lift" style={{ 
                          padding: isMobileOrTablet ? '0.75rem 0.875rem' : '1rem 1.125rem', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          borderRadius: '14px', 
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                          <div className="decor-svg" style={{ color: '#f59e0b' }}>
                            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                              <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                              <path d="M50 30 V 50 H 65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>CHI TIÊU</span>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Wallet size={16} />
                            </div>
                          </div>
                          <span style={{ fontSize: isMobileOrTablet ? '0.8rem' : '0.95rem', fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{FMT(formData.total_spent || 0)}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ color: '#f59e0b', fontWeight: 700 }}>{formData.expense_count || 0}</span> khoản chi</span>
                        </div>

                        <div className="card-panel stat-card hover-lift" style={{ 
                          padding: isMobileOrTablet ? '0.75rem 0.875rem' : '1rem 1.125rem', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          borderRadius: '14px', 
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                          <div className="decor-svg" style={{ color: 'var(--color-text-muted)' }}>
                            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                              <rect x="25" y="25" width="50" height="50" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                              <path d="M25 40 H 75 M 40 20 V 30 M 60 20 V 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
                            </svg>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>LẦN LIÊN HỆ CUỐI</span>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Clock size={16} />
                            </div>
                          </div>
                          <span style={{ fontSize: isMobileOrTablet ? '0.8rem' : '0.95rem', fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {formData.last_contact ? formatDateTime(formData.last_contact) : 'Chưa có'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label className="form-label" style={{ margin: 0 }}>Số điện thoại chính</label>
                              <span 
                                onClick={() => {
                                  if (isViewer || !formData.phone?.trim()) return;
                                  if (zaloSource === 'primary') {
                                    setZaloSource('none');
                                    setFormData((prev: any) => ({ ...prev, zalo_link: '' }));
                                  } else {
                                    setZaloSource('primary');
                                    const cleanPhone = (formData.phone || '').replace(/[^0-9]/g, '');
                                    setFormData((prev: any) => ({ ...prev, zalo_link: cleanPhone ? `https://zalo.me/${cleanPhone}` : '' }));
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  cursor: isViewer || !formData.phone?.trim() ? 'not-allowed' : 'pointer',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: zaloSource === 'primary' && formData.phone?.trim() ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  userSelect: 'none'
                                }}
                              >
                                <div style={{
                                  width: '32px',
                                  height: '18px',
                                  borderRadius: '9px',
                                  background: zaloSource === 'primary' && formData.phone?.trim() ? 'var(--color-primary)' : 'var(--color-border)',
                                  position: 'relative',
                                  transition: 'background-color 0.2s',
                                  opacity: isViewer || !formData.phone?.trim() ? 0.5 : 1
                                }}>
                                  <div style={{
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    background: 'var(--color-surface)',
                                    position: 'absolute',
                                    top: '2px',
                                    left: zaloSource === 'primary' && formData.phone?.trim() ? '16px' : '2px',
                                    transition: 'left 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                                  }} />
                                </div>
                                <span>Liên kết Zalo</span>
                              </span>
                            </div>
                            <input className="form-input" type="tel" placeholder="09xx xxx xxx" value={formData.phone || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => {
                                const next = { ...prev, phone: val };
                                if (zaloSource === 'primary') {
                                  const cleanPhone = val.replace(/[^0-9]/g, '');
                                  next.zalo_link = cleanPhone ? `https://zalo.me/${cleanPhone}` : '';
                                }
                                return next;
                              });
                            }} />
                          </div>
                          <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label className="form-label" style={{ margin: 0 }}>Số điện thoại phụ</label>
                              <span 
                                onClick={() => {
                                  if (isViewer || !formData.mobile?.trim()) return;
                                  if (zaloSource === 'secondary') {
                                    setZaloSource('none');
                                    setFormData((prev: any) => ({ ...prev, zalo_link: '' }));
                                  } else {
                                    setZaloSource('secondary');
                                    const cleanPhone = (formData.mobile || '').replace(/[^0-9]/g, '');
                                    setFormData((prev: any) => ({ ...prev, zalo_link: cleanPhone ? `https://zalo.me/${cleanPhone}` : '' }));
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  cursor: isViewer || !formData.mobile?.trim() ? 'not-allowed' : 'pointer',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: zaloSource === 'secondary' && formData.mobile?.trim() ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                  userSelect: 'none'
                                }}
                              >
                                <div style={{
                                  width: '32px',
                                  height: '18px',
                                  borderRadius: '9px',
                                  background: zaloSource === 'secondary' && formData.mobile?.trim() ? 'var(--color-primary)' : 'var(--color-border)',
                                  position: 'relative',
                                  transition: 'background-color 0.2s',
                                  opacity: isViewer || !formData.mobile?.trim() ? 0.5 : 1
                                }}>
                                  <div style={{
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    background: 'var(--color-surface)',
                                    position: 'absolute',
                                    top: '2px',
                                    left: zaloSource === 'secondary' && formData.mobile?.trim() ? '16px' : '2px',
                                    transition: 'left 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                                  }} />
                                </div>
                                <span>Liên kết Zalo</span>
                              </span>
                            </div>
                            <input className="form-input" type="tel" placeholder="08xx xxx xxx" value={formData.mobile || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => {
                                const next = { ...prev, mobile: val };
                                if (zaloSource === 'secondary') {
                                  const cleanPhone = val.replace(/[^0-9]/g, '');
                                  next.zalo_link = cleanPhone ? `https://zalo.me/${cleanPhone}` : '';
                                }
                                return next;
                              });
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
                            <label className="form-label">Loại khách hàng</label>
                            <CustomSelect
                              options={[
                                { value: '', label: '— Chưa chọn —' },
                                { value: 'individual', label: 'Cá nhân (Individual)' },
                                { value: 'corporate', label: 'Doanh nghiệp (Corporate)' }
                              ]}
                              value={formData.customer_type || ''}
                              onChange={val => setFormData((prev: any) => ({ ...prev, customer_type: val as string }))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Giới tính</label>
                            <CustomSelect
                              options={[
                                { value: '', label: '— Chưa chọn —' },
                                { value: 'male', label: 'Nam' },
                                { value: 'female', label: 'Nữ' },
                                { value: 'other', label: 'Khác' }
                              ]}
                              value={formData.gender || ''}
                              onChange={val => setFormData((prev: any) => ({ ...prev, gender: val as string }))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Liên kết Zalo</label>
                            <input className="form-input" placeholder="https://zalo.me/..." value={formData.zalo_link || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => ({ ...prev, zalo_link: val }));
                            }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Liên kết Facebook</label>
                            <input className="form-input" placeholder="https://facebook.com/..." value={formData.fb_link || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => ({ ...prev, fb_link: val }));
                            }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Công ty (Liên kết)</label>
                            <CustomSelect
                              searchable
                              options={[
                                { value: '', label: '— Không chọn —' },
                                ...companiesList.map(c => ({ value: String(c.id), label: c.name }))
                              ]}
                              value={String(formData.company_id || '')}
                              onChange={val => {
                                const selectedId = val ? Number(val) : null;
                                const selectedComp = companiesList.find(c => Number(c.id) === selectedId);
                                setFormData((prev: any) => ({
                                  ...prev,
                                  company_id: selectedId,
                                  company_name: selectedComp ? selectedComp.name : ''
                                }));
                              }}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Phòng ban</label>
                            <input className="form-input" placeholder="ví dụ: Kinh doanh" value={formData.department || ''} onChange={e => {
                              const val = e.target.value;
                              setFormData((prev: any) => ({ ...prev, department: val }));
                            }} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Dự án Quan tâm (Liên kết)</label>
                            <CustomSelect
                              searchable
                              options={[
                                { value: '', label: '— Không chọn —' },
                                ...projectsList.map(p => ({ value: String(p.id), label: p.name }))
                              ]}
                              value={String(formData.project_id || '')}
                              onChange={val => {
                                const selectedId = val ? Number(val) : null;
                                let nextCampaignId = formData.campaign_id;
                                if (!selectedId) {
                                  nextCampaignId = null;
                                } else if (nextCampaignId) {
                                  const campObj = allowedCampaigns.find(c => Number(c.id) === Number(nextCampaignId));
                                  if (campObj && Number(campObj.project_id) !== selectedId) {
                                    nextCampaignId = null;
                                  }
                                }
                                setFormData((prev: any) => ({
                                  ...prev,
                                  project_id: selectedId,
                                  campaign_id: nextCampaignId
                                }));
                              }}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Chiến dịch Quan tâm (Liên kết)</label>
                            {(() => {
                              const filteredCamps = formData.project_id
                                ? allowedCampaigns.filter(c => Number(c.project_id) === Number(formData.project_id))
                                : allowedCampaigns;
                              return (
                                <CustomSelect
                                  searchable
                                  options={[
                                    { value: '', label: '— Không chọn —' },
                                    ...filteredCamps.map(c => ({ value: String(c.id), label: c.name, faded: c.status !== 'active' }))
                                  ]}
                                  value={formData.campaign_id ? String(formData.campaign_id) : ''}
                                  onChange={val => {
                                    const nextCampaign = val ? Number(val) : null;
                                    let nextProjectId = formData.project_id;
                                    if (nextCampaign) {
                                      const campObj = allowedCampaigns.find(c => Number(c.id) === nextCampaign);
                                      if (campObj && campObj.project_id) {
                                        nextProjectId = Number(campObj.project_id);
                                      }
                                    }
                                    setFormData((prev: any) => ({
                                      ...prev,
                                      campaign_id: nextCampaign,
                                      project_id: nextProjectId
                                    }));
                                  }}
                                />
                              );
                            })()}
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
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>Nguồn khách (Source)</span>
                              {currentUser?.role === 'sale' && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Lock size={11} /> Chỉ Quản lý/Admin</span>
                              )}
                            </label>
                            <CustomSelect
                              disabled={currentUser?.role === 'sale'}
                              options={[
                                { value: 'website', label: 'Từ Website' },
                                { value: 'facebook', label: 'Facebook Ads' },
                                { value: 'gioi_thieu', label: 'Giới thiệu' },
                                { value: 'ca_nhan', label: 'Cá nhân tự khai thác' },
                                { value: 'cold_call', label: 'Cold Call' }
                              ]}
                              value={formData.source || 'website'}
                              onChange={val => setFormData((prev: any) => ({ ...prev, source: val as string }))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Ngành nghề kinh doanh</label>
                            <CustomSelect
                              options={[
                                { value: '', label: '— Chưa chọn —' },
                                { value: 'real_estate', label: 'Bất động sản' },
                                { value: 'finance', label: 'Tài chính / Ngân hàng' },
                                { value: 'tech', label: 'Công nghệ / IT' },
                                { value: 'manufacturing', label: 'Sản xuất / Xây dựng' },
                                { value: 'medical', label: 'Y tế / Dược phẩm' },
                                { value: 'education', label: 'Giáo dục' },
                                { value: 'other', label: 'Ngành nghề khác' }
                              ]}
                              value={formData.industry || ''}
                              onChange={val => setFormData((prev: any) => ({ ...prev, industry: val as string }))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Phân khúc ngân sách</label>
                            <CustomSelect
                              options={[
                                { value: '', label: '— Chưa chọn —' },
                                { value: 'under_2b', label: 'Dưới 2 Tỷ' },
                                { value: '2b_5b', label: '2 Tỷ - 5 Tỷ' },
                                { value: '5b_10b', label: '5 Tỷ - 10 Tỷ' },
                                { value: 'above_10b', label: 'Trên 10 Tỷ' }
                              ]}
                              value={formData.budget_range || ''}
                              onChange={val => setFormData((prev: any) => ({ ...prev, budget_range: val as string }))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Dự kiến doanh thu</label>
                            <CurrencyInput
                              value={formData.expected_revenue || 0}
                              onChange={val => setFormData((prev: any) => ({ ...prev, expected_revenue: val }))}
                              placeholder="VD: 1.500.000.000"
                            />
                          </div>
                          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label className="form-label" style={{ marginBottom: 0 }}>Xác suất chốt</label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="50"
                                  value={formData.win_probability || 0}
                                  onChange={e => {
                                    let val = Number(e.target.value);
                                    if (val < 0) val = 0;
                                    if (val > 100) val = 100;
                                    setFormData((prev: any) => ({ ...prev, win_probability: val }));
                                  }}
                                  style={{
                                    width: '64px',
                                    height: '28px',
                                    textAlign: 'center',
                                    fontSize: '0.85rem',
                                    fontWeight: 800,
                                    padding: '2px 4px',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '6px',
                                    background: 'var(--color-surface)',
                                    color: (formData.win_probability ?? 0) === 100 ? 'var(--color-success)' : 'var(--color-primary)'
                                  }}
                                />
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>%</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={formData.win_probability ?? 0}
                              onChange={e => setFormData((prev: any) => ({ ...prev, win_probability: Number(e.target.value) }))}
                              className="progress-slider"
                              style={{
                                background: (formData.win_probability ?? 0) === 100
                                  ? 'var(--color-success)'
                                  : 'linear-gradient(to right, #BD1D2D 0%, #F97316 ' + (formData.win_probability ?? 0) + '%, var(--color-border-light) ' + (formData.win_probability ?? 0) + '%, var(--color-border-light) 100%)'
                              }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                              <span>0%</span>
                              <span>50%</span>
                              <span>100%</span>
                            </div>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Người đang chăm sóc (Sale)</label>
                            {currentUser?.role === 'sale' ? (
                              <div 
                                style={{ padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.875rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                onClick={() => {
                                  const ownerName = formData.owner_name || contact?.owner_name || contact?.consultant_name || 'chủ sở hữu';
                                  addToast(`Chặn thao tác: Chỉ chủ sở hữu (${ownerName}) hoặc Admin mới có quyền chuyển nhượng người chăm sóc!`, 'error');
                                }}
                                title="Chỉ Owner hoặc Admin mới có quyền chuyển nhượng người chăm sóc"
                              >
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
                          <div className="form-group">
                            <label className="form-label">Nhân sự chăm sóc phụ (Co-care)</label>
                            <div
                              onClickCapture={(e) => {
                                if (isViewer || !isMainOwnerOrManagerAdmin) {
                                  e.stopPropagation();
                                  const ownerName = formData.owner_name || contact?.owner_name || contact?.consultant_name || 'chủ sở hữu';
                                  addToast(`Chặn thao tác: Chỉ chủ sở hữu (${ownerName}) mới có quyền chỉnh sửa nhân sự chăm sóc phụ (Co-care)!`, 'error');
                                }
                              }}
                            >
                              <CustomSelect
                                multiple
                                options={Array.from(new Map(
                                  users
                                    .filter(u => Number(u.id) !== Number(formData.owner_id))
                                    .map(u => [String(u.id), {
                                      value: String(u.id),
                                      label: u.full_name,
                                      avatar: u.avatar_url,
                                      sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                                    }])
                                ).values())}
                                value={Array.from(new Set((formData.collaborator_ids || '').split(',').map((s: string) => s.trim()).filter(Boolean)))}
                                onChange={val => {
                                  const list = Array.isArray(val) ? Array.from(new Set(val.filter((v: any) => v !== 'all'))) : [];
                                  setFormData((prev: any) => ({ ...prev, collaborator_ids: list.join(',') }));
                                }}
                                placeholder="Chọn nhân sự chăm sóc phụ..."
                                searchable
                                showAvatars
                                disabled={isViewer || !isMainOwnerOrManagerAdmin}
                              />
                            </div>
                            
                            {(() => {
                              const list = (formData.collaborator_ids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                              if (list.length === 0) return null;
                              return (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                  {list.map(cId => {
                                    const u = users.find(x => String(x.id) === String(cId));
                                    if (!u) return null;
                                    return (
                                      <div
                                        key={cId}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          background: 'rgba(59, 130, 246, 0.05)',
                                          border: '1px solid rgba(59, 130, 246, 0.15)',
                                          borderRadius: '20px',
                                          padding: '4px 10px 4px 4px',
                                          fontSize: '0.785rem',
                                          fontWeight: 600,
                                          color: 'var(--color-primary)'
                                        }}
                                      >
                                        <Avatar src={u.avatar_url} name={u.full_name} size={22} />
                                        <span>{u.full_name}</span>
                                        {!(isViewer || !isMainOwnerOrManagerAdmin) && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const remaining = list.filter(x => x !== cId);
                                              setFormData((prev: any) => ({ ...prev, collaborator_ids: remaining.join(',') }));
                                            }}
                                            style={{
                                              border: 'none',
                                              background: 'none',
                                              padding: 0,
                                              marginLeft: '4px',
                                              cursor: 'pointer',
                                              color: 'var(--color-text-muted)',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontWeight: 'bold',
                                              fontSize: '1rem',
                                              width: '14px',
                                              height: '14px',
                                              borderRadius: '50%'
                                            }}
                                            title="Xóa nhân sự này"
                                            className="hover-remove-btn"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', display: 'block' }}>
                              Cho phép các sale khác có quyền xem và cùng chăm sóc khách hàng này.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAGS TAB */}
                  {activeTab === 'tags' && (
                    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TagIcon size={24} />
                          </div>
                          <div>
                            <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-text)', letterSpacing: '-0.01em' }}>Phân loại khách hàng</h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)' }}>Sử dụng các thẻ tag để phân nhóm và tối ưu hóa quy trình tìm kiếm.</p>
                          </div>
                        </div>

                        <div className="card-panel" style={{ padding: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
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

                      {/* Notes Section (Combined here!) */}
                      <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                          <div>
                            <h3 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.25rem' }}>Ghi chú nội bộ</h3>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Các ghi chú dạng giấy Note đính kèm thông tin</p>
                          </div>
                          <button className="btn primary sm" onClick={() => {
                            setEditingNote(null);
                            setNewNote('');
                            setShowNoteModal(true);
                          }} style={{ fontWeight: 600 }}><Plus size={14} /> Thêm ghi chú</button>
                        </div>

                        {(() => {
                          // Retrieve stored note IDs sorting order
                          const storedOrder = localStorage.getItem(`notes_order_${contact?.id}`);
                          let sortedNotes = [...notes];
                          if (storedOrder) {
                            try {
                              const orderIds = JSON.parse(storedOrder);
                              sortedNotes.sort((a, b) => {
                                const idxA = orderIds.indexOf(a.id);
                                const idxB = orderIds.indexOf(b.id);
                                if (idxA === -1 && idxB === -1) return 0;
                                if (idxA === -1) return 1;
                                if (idxB === -1) return -1;
                                return idxA - idxB;
                              });
                            } catch (e) {}
                          }

                          // Drag & Drop handlers
                          const handleDragStart = (e: React.DragEvent, index: number) => {
                            setDraggedIndex(index);
                            e.dataTransfer.effectAllowed = 'move';
                          };

                          const handleDragOver = (e: React.DragEvent, index: number) => {
                            e.preventDefault();
                            if (draggedIndex === index) return;
                            setDraggedOverIndex(index);
                          };

                          const handleDrop = (e: React.DragEvent, targetIndex: number) => {
                            e.preventDefault();
                            if (draggedIndex === null || draggedIndex === targetIndex) return;

                            const newNotes = [...sortedNotes];
                            const [removed] = newNotes.splice(draggedIndex, 1);
                            newNotes.splice(targetIndex, 0, removed);

                            // Save new order to state
                            setNotes(newNotes);

                            // Persist the order in LocalStorage
                            const newOrderIds = newNotes.map(x => x.id);
                            localStorage.setItem(`notes_order_${contact?.id}`, JSON.stringify(newOrderIds));
                            
                            setDraggedIndex(null);
                            setDraggedOverIndex(null);
                          };

                          const handleDragEnd = () => {
                            setDraggedIndex(null);
                            setDraggedOverIndex(null);
                          };

                          if (notes.length === 0) {
                            return (
                              <EmptyCard
                                icon={<FileText size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />}
                                title="Chưa có ghi chú nội bộ"
                                description="Các ghi chú dạng giấy Note đính kèm thông tin khách hàng sẽ xuất hiện tại đây."
                                actionText="Thêm ghi chú"
                                onAction={() => {
                                  setEditingNote(null);
                                  setNewNote('');
                                  setShowNoteModal(true);
                                }}
                              />
                            );
                          }

                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                              {sortedNotes.map((n, idx) => {
                                const cardBg = '#fefce8'; // pale yellow like note paper
                                const leftBorder = '4px solid #eab308'; // golden yellow accent border
                                const isDragging = idx === draggedIndex;
                                const isDraggedOver = idx === draggedOverIndex;

                                return (
                                  <div 
                                    key={n.id} id={`customer-note-${n.id}`}
                                    draggable={!isViewer}
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDrop={(e) => handleDrop(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    className="card-panel animate-fade" 
                                    style={{ 
                                      padding: '1.25rem', 
                                      background: cardBg, 
                                      border: '1px solid #fef08a', 
                                      borderLeft: leftBorder, 
                                      borderRadius: '12px', 
                                      boxShadow: '0 4px 12px rgba(234, 179, 8, 0.05)', 
                                      position: 'relative', 
                                      display: 'flex', 
                                      flexDirection: 'column', 
                                      justifyContent: 'space-between', 
                                      minHeight: '160px',
                                      cursor: isViewer ? 'default' : 'grab',
                                      opacity: isDragging ? 0.4 : 1,
                                      transform: isDraggedOver ? 'scale(1.02)' : 'none',
                                      transition: 'all 0.2s',
                                      borderStyle: isDraggedOver ? 'dashed' : 'solid',
                                      borderColor: isDraggedOver ? '#eab308' : '#fef08a'
                                    }}
                                  >
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                        <div style={{ flex: 1 }}>
                                          <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{formatNote(n.text)}</p>
                                        
                                        {/* Hiển thị thông tin ghi chú cấu trúc Bếp Đun Nước */}
                                        {(n.channel || n.stuck_tag || n.sale_temperature || n.note_type === 'quality' || n.documents_sent) && (
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', marginBottom: '4px' }}>
                                            {n.channel && (
                                              <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)' }}>
                                                {n.channel === 'noi_dat' ? '🟫 Nồi Đất' : n.channel === 'noi_dong' ? '🟨 Nồi Đồng' : '🟥 Nồi Áp Suất'}
                                                {n.channel === 'noi_dong' && n.duration_minutes ? ` (${n.duration_minutes}m)` : ''}
                                              </span>
                                            )}
                                            {n.note_type === 'quality' && (
                                              <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                                ⭐ Chất lượng
                                              </span>
                                            )}
                                            {n.stuck_tag && (
                                              <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                📍 Vướng: {n.stuck_tag === 'sales' ? 'Sales' : n.stuck_tag === 'project' ? 'Dự án' : n.stuck_tag === 'unit' ? 'Căn' : n.stuck_tag === 'smooth' ? 'Đang xuôi' : n.stuck_tag}
                                              </span>
                                            )}
                                            {n.sale_temperature && tempLabels[n.sale_temperature] && (
                                              <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: tempLabels[n.sale_temperature].bg, color: tempLabels[n.sale_temperature].color, border: `1px solid ${tempLabels[n.sale_temperature].color}33` }}>
                                                🌡️ {tempLabels[n.sale_temperature].label}
                                              </span>
                                            )}
                                            {n.documents_sent && (
                                              <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }} title={n.documents_sent}>
                                                📁 Đã gửi tài liệu
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                          {canDeleteNote(n.user_id) && (
                                            <>
                                              <button
                                                className="btn ghost sm"
                                                style={{ padding: '4px', height: '24px', width: '24px', color: 'var(--color-text-muted)', border: 'none', background: 'transparent' }}
                                                onClick={() => {
                                                  setEditingNote(n);
                                                  setNewNote(n.text);
                                                  setShowNoteModal(true);
                                                }}
                                              >
                                                <Pencil size={12} />
                                              </button>
                                              <button
                                                className="btn ghost sm text-danger"
                                                style={{ padding: '4px', height: '24px', width: '24px', border: 'none', background: 'transparent' }}
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
                                                        window.dispatchEvent(new CustomEvent('contact-updated'));
                                                      } catch (e: any) {
                                                        addToast('Lỗi khi xóa ghi chú', 'error');
                                                      }
                                                    }
                                                  );
                                                }}
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      {n.attachment_url && (
                                        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          {/\.(jpg|jpeg|png|gif|webp)$/i.test(n.attachment_url) ? (
                                            <Camera size={12} style={{ color: '#10b981' }} />
                                          ) : (
                                            <FileText size={12} style={{ color: 'var(--color-primary)' }} />
                                          )}
                                          <a
                                            href={resolveAttachmentUrl(n.attachment_url)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline' }}
                                          >
                                            {n.attachment_url.split('/').pop()}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                                      <EditHistoryIndicator history={n.edit_history} />
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                        <Avatar src={n.user_avatar || undefined} name={n.user} size={20} />
                                        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                          Tạo bởi <strong>{n.user}</strong> lúc {n.time ? new Date(n.time).toLocaleString('vi-VN') : ''}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                          <StatRowSkeleton />
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
                          {/* Yêu cầu tài liệu & Trạng thái được phép tạo phiếu */}
                          <div style={{
                            margin: '1.5rem auto',
                            maxWidth: '380px',
                            background: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            {(() => {
                              const currentStatus = baseData?.pipeline_status || contact?.pipeline_status || 'chua_xac_dinh';
                              const isStatusOk = coopEligibleStatuses.includes(currentStatus);
                              
                              const isDocsOk = coopDefaultFiles.length === 0 || coopDefaultFiles.every(f => checkFileExists(f));
                              
                              return (
                                <>
                                  {coopEligibleStatuses.length > 0 && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                      {isStatusOk ? (
                                        <CheckCircle2 size={14} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: '2px' }} />
                                      ) : (
                                        <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>•</span>
                                      )}
                                      <span>
                                        Trạng thái được tạo: <strong>
                                          {coopEligibleStatuses.map(s => {
                                            const found = pipelineStages?.find(stage => stage.id === s);
                                            return found ? found.name : s;
                                          }).join(', ')}
                                        </strong>
                                      </span>
                                    </div>
                                  )}
                                  
                                  {coopDefaultFiles.length > 0 && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                      {isDocsOk ? (
                                        <CheckCircle2 size={14} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: '2px' }} />
                                      ) : (
                                        <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>•</span>
                                      )}
                                      <span>
                                        Tài liệu đính kèm bắt buộc: <strong>{coopDefaultFiles.join(', ')}</strong>
                                      </span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {!isViewer && (
                            <button
                              className="btn primary"
                              onClick={handleCreateCoopSlip}
                              disabled={coopEligibleStatuses.length > 0 && !coopEligibleStatuses.includes(baseData?.pipeline_status || contact?.pipeline_status || 'chua_xac_dinh')}
                              style={coopEligibleStatuses.length > 0 && !coopEligibleStatuses.includes(baseData?.pipeline_status || contact?.pipeline_status || 'chua_xac_dinh') ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                              <Plus size={16} /> Thiết lập hợp tác hoa hồng
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {/* Unified White Card for Cooperation & Shares */}
                          <div className="card-panel" style={{ padding: '1.75rem', background: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Status banner */}
                            {(() => {
                              const status = coopSlip.status;
                              const isPendingSignatures = (status === 'pending_signatures' || status === 'approved_pending_signatures') && coopSlip.shareholders?.some((sh: any) => !sh.signed);
                              
                              let bg = 'var(--color-bg-light)';
                              let border = '1px solid var(--color-border)';
                              let leftBorder = '4px solid var(--color-text-muted)';
                              let statusIcon = <Clock size={18} style={{ color: 'var(--color-text-muted)' }} />;
                              let statusTitle = 'Chưa xác định';
                              let statusDesc = 'Phiếu hợp tác đang trong quá trình xử lý.';
                              let badgeClass = 'warning';
                              let iconBg = 'var(--color-bg-light)';
                              let iconBorder = '1px solid var(--color-border-light)';

                              if (isPendingSignatures) {
                                bg = 'linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, rgba(245, 158, 11, 0.08) 100%)';
                                border = '1px solid rgba(245, 158, 11, 0.2)';
                                leftBorder = '4px solid #f59e0b';
                                statusIcon = <Clock size={18} style={{ color: '#f59e0b', animation: 'pulse 2s infinite' }} />;
                                statusTitle = 'Đang chờ ký';
                                statusDesc = 'Đang chờ các thành viên liên quan ký xác nhận tỷ lệ phân chia.';
                                badgeClass = 'warning';
                                iconBg = 'rgba(245, 158, 11, 0.08)';
                                iconBorder = '1px solid rgba(245, 158, 11, 0.25)';
                              } else if (status === 'approved') {
                                bg = 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0.08) 100%)';
                                border = '1px solid rgba(16, 185, 129, 0.15)';
                                leftBorder = '4px solid #10b981';
                                statusIcon = <CheckCircle2 size={18} style={{ color: '#10b981' }} />;
                                statusTitle = 'Đã phê duyệt';
                                statusDesc = 'Phiếu hợp tác đã được xác nhận hiệu lực & hoa hồng.';
                                badgeClass = 'success';
                                iconBg = 'rgba(16, 185, 129, 0.08)';
                                iconBorder = '1px solid rgba(16, 185, 129, 0.25)';
                              } else if (status === 'pending_manager_approval') {
                                bg = 'linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, rgba(245, 158, 11, 0.08) 100%)';
                                border = '1px solid rgba(245, 158, 11, 0.2)';
                                leftBorder = '4px solid #f59e0b';
                                statusIcon = <Clock size={18} style={{ color: '#f59e0b', animation: 'pulse 2s infinite' }} />;
                                statusTitle = 'Chờ phê duyệt';
                                statusDesc = 'Đang chờ Quản lý hoặc Giám đốc kinh doanh duyệt.';
                                badgeClass = 'warning';
                                iconBg = 'rgba(245, 158, 11, 0.08)';
                                iconBorder = '1px solid rgba(245, 158, 11, 0.25)';
                              } else if (status === 'rejected') {
                                bg = 'linear-gradient(135deg, rgba(239, 68, 68, 0.04) 0%, rgba(239, 68, 68, 0.08) 100%)';
                                border = '1px solid rgba(239, 68, 68, 0.15)';
                                leftBorder = '4px solid #ef4444';
                                statusIcon = <AlertCircle size={18} style={{ color: '#ef4444' }} />;
                                statusTitle = 'Bị từ chối';
                                statusDesc = 'Phiếu hợp tác bị từ chối phê duyệt.';
                                badgeClass = 'danger';
                                iconBg = 'rgba(239, 68, 68, 0.08)';
                                iconBorder = '1px solid rgba(239, 68, 68, 0.25)';
                              } else {
                                bg = 'linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(99, 102, 241, 0.08) 100%)';
                                border = '1px solid rgba(99, 102, 241, 0.15)';
                                leftBorder = '4px solid #6366f1';
                                statusIcon = <PenTool size={18} style={{ color: '#6366f1' }} />;
                                statusTitle = 'Chờ ký xác nhận';
                                statusDesc = 'Đang chờ các thành viên liên quan ký xác nhận.';
                                badgeClass = 'info';
                                iconBg = 'rgba(99, 102, 241, 0.08)';
                                iconBorder = '1px solid rgba(99, 102, 241, 0.25)';
                              }

                                     return (
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  padding: '10px 14px', 
                                  background: bg, 
                                  borderRadius: '12px', 
                                  border: border,
                                  borderLeft: leftBorder,
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                                  transition: 'all 0.3s ease',
                                  gap: '12px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '8px',
                                      background: iconBg,
                                      border: iconBorder,
                                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                                      flexShrink: 0
                                    }}>
                                      {statusIcon}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)' }}>{statusTitle}</span>
                                        <span className={`badge ${badgeClass}`} style={{ fontSize: '0.625rem', padding: '1px 6px', borderRadius: '20px', fontWeight: 700 }}>
                                          {isPendingSignatures ? 'Chờ ký' : 
                                           status === 'approved' ? 'Hiệu lực' : 
                                           status === 'rejected' ? 'Bị từ chối' : 
                                           status === 'pending_manager_approval' ? 'Chờ duyệt' : 'Chờ ký'}
                                        </span>
                                        <span style={{ 
                                          fontSize: '0.625rem', 
                                          fontWeight: 700, 
                                          color: 'var(--color-primary)', 
                                          background: 'var(--color-primary-light)', 
                                          padding: '1px 6px', 
                                          borderRadius: '20px' 
                                        }}>
                                          v{coopSlip.version}
                                        </span>
                                      </div>
                                      <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0', lineHeight: 1.3 }}>
                                        {statusDesc}
                                      </p>
                                      {status === 'approved' && coopSlip.approver && (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.675rem', color: 'var(--color-text-muted)', marginTop: '4px', background: 'rgba(16, 185, 129, 0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                                          <span style={{ fontWeight: 650, color: '#10b981' }}>Duyệt bởi:</span>
                                          <Avatar src={coopSlip.approver.avatar} name={coopSlip.approver.name} size={14} />
                                          <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{coopSlip.approver.name}</span>
                                          <span>lúc {new Date(coopSlip.approver.approved_at).toLocaleString('vi-VN')}</span>
                                        </div>
                                      )}
                                      
                                      {status === 'pending_manager_approval' && isCoopApprover && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                          <button 
                                            className="btn primary sm" 
                                            onClick={() => {
                                              showConfirm({
                                                title: 'Duyệt phiếu hợp tác',
                                                message: 'Bạn có chắc chắn muốn duyệt phiếu hợp tác này không?',
                                                confirmText: 'Phê duyệt',
                                                cancelText: 'Hủy',
                                                onConfirm: async () => {
                                                  try {
                                                    await api.post(`/cooperation-slips/${coopSlip.id}/approve`);
                                                    addToast('Đã phê duyệt phiếu hợp tác thành công!', 'success');
                                                    await fetchCoopSlip();
                                                  } catch (err: any) {
                                                    addToast(err.response?.data?.message || 'Lỗi khi duyệt phiếu', 'error');
                                                  }
                                                }
                                              });
                                            }}
                                            style={{ padding: '3px 10px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
                                          >
                                            <Check size={12} /> Duyệt
                                          </button>
                                          <button 
                                            className="btn outline sm text-danger" 
                                            onClick={() => {
                                              showConfirm({
                                                title: 'Từ chối phiếu hợp tác',
                                                message: 'Vui lòng nhập lý do từ chối phiếu hợp tác này:',
                                                confirmText: 'Từ chối',
                                                cancelText: 'Hủy',
                                                isDanger: true,
                                                requirePromptInput: true,
                                                promptPlaceholder: 'Nhập lý do từ chối...',
                                                onConfirm: async (reason) => {
                                                  try {
                                                    await api.post(`/cooperation-slips/${coopSlip.id}/reject`, { reason: reason || 'Từ chối' });
                                                    addToast('Đã từ chối phiếu hợp tác thành công!', 'success');
                                                    await fetchCoopSlip();
                                                  } catch (err: any) {
                                                    addToast(err.response?.data?.message || 'Lỗi khi từ chối phiếu', 'error');
                                                  }
                                                }
                                              });
                                            }}
                                            style={{ padding: '3px 10px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderColor: 'var(--color-danger)', borderRadius: '6px' }}
                                          >
                                            <X size={12} /> Từ chối
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {coopSlip.status === 'rejected' && coopSlip.dispute_details && (
                              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: '12px', fontSize: '0.875rem' }}>
                                <strong>Lý do từ chối:</strong> {coopSlip.dispute_details}
                              </div>
                            )}

                            {/* Cooperation Project & Financial Details Summary Card */}
                            <div style={{
                              background: 'var(--color-bg-light)',
                              borderRadius: '12px',
                              border: '1px solid var(--color-border-light)',
                              padding: isMobileOrTablet ? '14px 16px' : '16px 20px',
                              display: 'flex',
                              flexDirection: isMobileOrTablet ? 'column' : 'row',
                              alignItems: isMobileOrTablet ? 'stretch' : 'center',
                              justifyContent: 'space-between',
                              gap: '16px'
                            }}>
                              {/* Column 1: Project details */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: isMobileOrTablet ? 'none' : '2', minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  <Briefcase size={13} style={{ color: 'var(--color-primary)' }} />
                                  <span>Dự án giao dịch</span>
                                </div>
                                <h4 style={{ fontWeight: 800, fontSize: '0.95rem', margin: '2px 0 0 0', color: 'var(--color-text)' }}>
                                  {coopSlip.project_name || '— Chưa liên kết dự án —'}
                                </h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                                  {coopSlip.unit_code && (
                                    <span style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                                      Căn/Lô: {coopSlip.unit_code}
                                    </span>
                                  )}
                                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                    Cọc ngày: {coopSlip.created_at ? new Date(coopSlip.created_at).toLocaleDateString('vi-VN') : '—'}
                                  </span>
                                </div>
                              </div>

                              {/* Nested financial columns: Always horizontal on both mobile and desktop */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '12px',
                                flex: isMobileOrTablet ? 'none' : '2',
                                borderTop: isMobileOrTablet ? '1px solid var(--color-border-light)' : 'none',
                                paddingTop: isMobileOrTablet ? '12px' : '0',
                                width: isMobileOrTablet ? '100%' : 'auto'
                              }}>
                                {/* Column 2: Expected Revenue */}
                                <div style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  gap: '4px', 
                                  borderLeft: isMobileOrTablet ? 'none' : '1px solid var(--color-border-light)', 
                                  paddingLeft: isMobileOrTablet ? '0' : '1.5rem',
                                  flex: 1
                                }}>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Doanh thu dự kiến
                                  </span>
                                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                    {FMT(coopSlip.expected_revenue)}
                                  </span>
                                </div>

                                {/* Column 3: Expected Commission */}
                                <div style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  gap: '4px', 
                                  borderLeft: '1px solid var(--color-border-light)', 
                                  paddingLeft: isMobileOrTablet ? '12px' : '1.5rem',
                                  flex: 1
                                }}>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Hoa hồng dự kiến
                                  </span>
                                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                                    {FMT(coopSlip.expected_commission)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Visual Partnership Split Breakdown Bar */}
                            {coopSlip.shareholders && coopSlip.shareholders.length > 0 && (
                              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Tỷ lệ hợp tác đóng góp
                                  </span>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                                    {coopSlip.shareholders.length} thành viên tham gia
                                  </span>
                                </div>
                                <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', background: '#e2e8f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)' }}>
                                  {coopSlip.shareholders.map((sh: any, shIdx: number) => {
                                    const colors = ['var(--color-primary)', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
                                    const color = colors[shIdx % colors.length];
                                    return (
                                      <div 
                                        key={sh.user_id} 
                                        style={{ 
                                          width: `${sh.percentage}%`, 
                                          backgroundColor: color, 
                                          height: '100%',
                                          transition: 'all 0.3s ease'
                                        }} 
                                        title={`${sh.name}: ${sh.percentage}%`}
                                      />
                                    );
                                  })}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 18px', marginTop: '12px' }}>
                                  {coopSlip.shareholders.map((sh: any, shIdx: number) => {
                                    const colors = ['var(--color-primary)', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
                                    const color = colors[shIdx % colors.length];
                                    return (
                                      <div key={sh.user_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                                        <span>{sh.name} <strong style={{ color: color }}>{sh.percentage}%</strong></span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Signature request notification callout (if any) */}
                            {(coopSlip.status === 'pending_signatures' || coopSlip.status === 'approved_pending_signatures') && coopSlip.shareholders?.some((s: any) => String(s.user_id) === String(currentUser?.id) && !s.signed) && !isViewer && (
                              <div style={{ padding: '1.25rem', background: 'rgba(189, 29, 45, 0.05)', border: '1px solid rgba(189, 29, 45, 0.2)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                <div>
                                  <h4 style={{ fontWeight: 700, color: '#BD1D2D', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Bạn có yêu cầu ký xác nhận</h4>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                    Vui lòng ký xác nhận tỷ lệ chia sẻ hoa hồng để kích hoạt phiếu hợp tác.
                                  </p>
                                </div>
                                <button className="btn primary" onClick={() => setIsSignModalOpen(true)} style={{ background: '#BD1D2D', borderColor: '#BD1D2D' }}>
                                  <PenTool size={15} /> Ký xác nhận ngay
                                </button>
                              </div>
                            )}

                            {/* Shareholders signatures list */}
                            <div style={{ marginTop: '0.5rem' }}>
                              <h4 style={{ fontWeight: 700, marginBottom: '1.25rem', fontSize: '0.95rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Users size={16} style={{ color: 'var(--color-primary)' }} /> Bảng chữ ký và tỷ lệ
                              </h4>
                              <div style={{ display: 'grid', gridTemplateColumns: isMobileOrTablet ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                                {coopSlip.shareholders?.map((sh: any) => (
                                  <div 
                                    key={sh.user_id} 
                                    className="card"
                                    style={{ 
                                      padding: '1rem', 
                                      borderRadius: '16px', 
                                      background: 'var(--color-surface)', 
                                      border: '1px solid var(--color-border-light)',
                                      boxShadow: '0 2px 8px -2px rgba(0,0,0,0.03)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '12px'
                                    }}
                                  >
                                    {/* Card Header: Avatar + Info (Left) & Status (Right) */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Avatar src={sh.avatar} name={sh.name} size="md" />
                                        <div>
                                          <h5 style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                            {sh.name}
                                          </h5>
                                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', display: 'block', wordBreak: 'break-all' }}>
                                            {sh.email}
                                          </span>
                                        </div>
                                      </div>
                                      
                                      {/* Status Badge */}
                                      {sh.signed ? (
                                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.08)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '4px 10px', borderRadius: '30px', fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                          <CheckCircle2 size={12} /> Đã ký
                                        </span>
                                      ) : (
                                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-warning)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '4px 10px', borderRadius: '30px', fontSize: '0.7rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-warning)' }} /> Chờ ký
                                        </span>
                                      )}
                                    </div>

                                    {/* Card Body: Split Percent & Expected Commission */}
                                    <div style={{ 
                                      display: 'grid', 
                                      gridTemplateColumns: '1fr 1fr', 
                                      background: 'var(--color-bg-light)', 
                                      borderRadius: '10px', 
                                      padding: '10px 12px',
                                      gap: '8px'
                                    }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                          Tỷ lệ đóng góp
                                        </span>
                                        <span style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--color-text)' }}>
                                          {sh.percentage}%
                                        </span>
                                      </div>
                                      
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid var(--color-border-light)', paddingLeft: '12px' }}>
                                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                          Hoa hồng dự kiến
                                        </span>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                                          {coopSlip.expected_commission && Number(coopSlip.expected_commission) > 0 
                                            ? `~ ${Math.round((parseFloat(coopSlip.expected_commission) || 0) * (sh.percentage || 0) / 100).toLocaleString()} đ`
                                            : '0 đ'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Card Footer: Signature Details (if signed) */}
                                    {sh.signed && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--color-border-light)', paddingTop: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>
                                            Ký lúc: <strong style={{ color: 'var(--color-text)' }}>{new Date(sh.signature_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(sh.signature_time).toLocaleDateString('vi-VN')}</strong>
                                          </span>
                                          {sh.signature_img && (
                                            <div style={{ background: '#f8fafc', padding: '3px 8px', borderRadius: '6px', border: '1px dashed var(--color-border-light)', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
                                              <img 
                                                src={sh.signature_img.startsWith('http') || sh.signature_img.startsWith('data:') ? sh.signature_img : `https://open.domation.net/richland/${sh.signature_img.replace(/^\/+/, '')}`} 
                                                style={{ height: '36px', maxWidth: '120px', objectFit: 'contain' }} 
                                                alt="Chữ ký" 
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {!canEditShares && (coopSlip.status === 'approved' || coopSlip.status === 'pending_manager_approval') && (isCoopCreator || isCoopShareholder || isCoopApprover) && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem' }}>
                                  <button 
                                    type="button"
                                    className="btn outline sm"
                                    onClick={() => {
                                      if (coopSlip && Array.isArray(coopSlip.shareholders) && coopSlip.shareholders.length > 0) {
                                        setCoopShares(coopSlip.shareholders.map((s: any) => ({
                                          user_id: String(s.user_id),
                                          percentage: String(s.percentage || '0')
                                        })));
                                      }
                                      setIsRequestingChange(true);
                                    }}
                                    style={{ color: 'var(--color-primary)', borderColor: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
                                  >
                                    <Pencil size={13} /> {isCoopApprover ? 'Cập nhật tỷ lệ' : 'Yêu cầu thay đổi tỷ lệ'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Shareholder Management - Only shown in Edit / Request Change mode */}
                          {canEditShares && (
                            <div className="card-panel" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                              <h4 style={{ fontWeight: 700, marginBottom: '1.25rem', fontSize: '1rem' }}>Danh sách phân chia hoa hồng</h4>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                                {(coopShares.length > 0
                                  ? coopShares
                                  : (coopSlip?.shareholders && coopSlip.shareholders.length > 0)
                                  ? coopSlip.shareholders.map((s: any) => ({ user_id: String(s.user_id), percentage: String(s.percentage || '0') }))
                                  : [{ user_id: String(contact?.owner_id || currentUser?.id || ''), percentage: '100' }]
                                ).map((share: any, idx: number) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', width: '100%' }}>
                                    <div style={{
                                      flex: '1 1 320px',
                                      maxWidth: '450px',
                                      pointerEvents: idx === 0 ? 'none' : 'auto',
                                      opacity: idx === 0 ? 0.7 : 1
                                    }}>
                                      <CustomSelect
                                        value={share.user_id}
                                        onChange={(val) => {
                                          const newShares = coopShares.length > 0 ? [...coopShares] : coopSlip.shareholders.map((s: any) => ({ user_id: String(s.user_id), percentage: String(s.percentage || '0') }));
                                          newShares[idx].user_id = val;
                                          setCoopShares(newShares);
                                        }}
                                        options={[
                                          { value: '', label: '-- Chọn nhân sự --' },
                                          ...salesUsers
                                            .filter(u => {
                                              if (idx === 0) return true;
                                              return !coopShares.some((s, sIdx) => sIdx !== idx && String(s.user_id) === String(u.value));
                                            })
                                        ]}
                                        placeholder="Chọn nhân sự"
                                        showAvatars
                                        searchable
                                      />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, minWidth: '240px' }}>
                                      {/* Percentage Input Group */}
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '8px',
                                        background: 'var(--color-bg)',
                                        padding: '0 10px',
                                        height: '38px',
                                        width: '110px',
                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                                        transition: 'border-color 0.2s'
                                      }}>
                                        <input
                                          type="number"
                                          value={share.percentage}
                                          min="0"
                                          max="100"
                                          onChange={(e) => {
                                            const currentList = coopShares.length > 0 ? coopShares : coopSlip.shareholders.map((s: any) => ({ user_id: String(s.user_id), percentage: String(s.percentage || '0') }));
                                            const newShares = [...currentList];
                                            newShares[idx].percentage = e.target.value;
                                            setCoopShares(newShares);
                                          }}
                                          style={{
                                            border: 'none',
                                            background: 'transparent',
                                            width: '100%',
                                            height: '100%',
                                            textAlign: 'center',
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            outline: 'none',
                                            color: 'var(--color-text)',
                                            padding: 0
                                          }}
                                          placeholder="0"
                                        />
                                        <span style={{ fontWeight: 850, fontSize: '0.85rem', color: 'var(--color-text-muted)', marginLeft: '4px' }}>%</span>
                                      </div>

                                      {/* Money Equivalent Badge */}
                                      {coopSlip?.expected_commission && Number(coopSlip.expected_commission) > 0 && (
                                        <div style={{
                                          fontSize: '0.8rem',
                                          color: 'var(--color-primary)',
                                          fontWeight: 700,
                                          background: 'rgba(189, 29, 45, 0.05)',
                                          padding: '8px 12px',
                                          borderRadius: '8px',
                                          border: '1px solid rgba(189, 29, 45, 0.12)',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          <span style={{ fontSize: '0.72rem', opacity: 0.7, fontWeight: 600 }}>Dự kiến:</span>
                                          {Math.round((parseFloat(coopSlip.expected_commission) || 0) * (parseFloat(share.percentage) || 0) / 100).toLocaleString()}
                                          <span style={{ fontSize: '0.68rem', fontWeight: 600, opacity: 0.9 }}>VND</span>
                                        </div>
                                      )}
                                    </div>
                                    {String(share.user_id) === String(contact?.owner_id || formData?.owner_id) || 
                                     String(share.user_id) === String(currentUser?.id) || 
                                     (currentUser?.consultant_id && String(share.user_id) === String(currentUser.consultant_id)) ? (
                                      <div style={{ width: '36px', height: '36px' }} />
                                    ) : (
                                      <button 
                                        type="button"
                                        className="btn ghost text-danger sm" 
                                        onClick={() => {
                                          const currentList = coopShares.length > 0 ? coopShares : coopSlip.shareholders.map((s: any) => ({ user_id: String(s.user_id), percentage: String(s.percentage || '0') }));
                                          setCoopShares(currentList.filter((_, i) => i !== idx));
                                        }}
                                        style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)', background: 'rgba(239, 68, 68, 0.02)', width: '36px', height: '36px', cursor: 'pointer' }}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Actions to Add New Shareholder or Save */}
                              {isRequestingChange && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '1rem' }}>
                                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Lý do thay đổi / Yêu cầu điều chỉnh</label>
                                  <textarea
                                    placeholder="VD: Bổ sung thêm sale tư vấn hoặc điều chỉnh lại tỷ lệ..."
                                    value={changeReason}
                                    onChange={(e) => setChangeReason(e.target.value)}
                                    className="form-control"
                                    rows={2}
                                    style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                                  />
                                </div>
                              )}

                              {/* Actions (Sticky Bottom) */}
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderTop: '1px solid var(--color-border-light)',
                                paddingTop: '1rem',
                                paddingBottom: '0.25rem',
                                position: 'sticky',
                                bottom: 0,
                                background: '#ffffff',
                                zIndex: 10
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <button 
                                    type="button"
                                    className="btn outline sm"
                                    onClick={() => setCoopShares(prev => [...(prev.length > 0 ? prev : (coopSlip?.shareholders || []).map((s: any) => ({ user_id: String(s.user_id), percentage: String(s.percentage || '0') }))), { user_id: '', percentage: '0' }])}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
                                  >
                                    <Plus size={14} /> Thêm nhân sự
                                  </button>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                    Tổng: {(coopShares.length > 0 ? coopShares : (coopSlip?.shareholders || [])).reduce((acc: number, curr: any) => acc + (Number(curr.percentage) || 0), 0)}% / 100%
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {isRequestingChange && (
                                    <button 
                                      type="button"
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
                                    type="button"
                                    className="btn primary sm"
                                    onClick={handleSaveCoopShares}
                                  >
                                    {isRequestingChange ? 'Gửi yêu cầu thay đổi' : 'Lưu tỷ lệ mới'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}



                          {/* Cooperation Slip Attachment Card (Placed strictly at the bottom) */}
                          <div className="card-panel" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
                              <h4 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                <Paperclip size={18} style={{ color: 'var(--color-primary)' }} /> Tài liệu hợp tác đính kèm
                              </h4>
                              
                              {canManageCoopAttachments && coopSlip.attachment_url && (
                                <div>
                                  <input
                                    type="file"
                                    id="coop-attachment-upload-top"
                                    style={{ display: 'none' }}
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
                                    onChange={handleCoopAttachmentUpload}
                                  />
                                  <label htmlFor="coop-attachment-upload-top" className="btn outline sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                    <Upload size={14} /> Tải thêm tài liệu
                                  </label>
                                </div>
                              )}
                            </div>
                            
                            {coopDefaultFiles.length > 0 && (
                              <div style={{ marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', marginRight: '4px' }}>
                                  Yêu cầu đính kèm:
                                </span>
                                {coopDefaultFiles.map((file, fIdx) => {
                                  const exists = checkFileExists(file);
                                  return (
                                    <span 
                                      key={fIdx} 
                                      style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        padding: '4px 10px', 
                                        borderRadius: '20px', 
                                        fontSize: '0.75rem', 
                                        fontWeight: 600,
                                        background: exists ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                                        border: exists ? '1px solid rgba(16, 185, 129, 0.18)' : '1px solid rgba(239, 68, 68, 0.18)',
                                        color: exists ? 'var(--color-success)' : 'var(--color-danger)'
                                      }}
                                    >
                                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: exists ? 'var(--color-success)' : 'var(--color-danger)' }} />
                                      {file}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {(() => {
                              // Combined list of attachments from coopSlip, docs ('Đặt cọc' / milestone UNC), and deals
                              const coopAttachmentsList: { name: string; path: string; canDelete: boolean }[] = [];
                              const addedPaths = new Set<string>();

                              if (coopSlip?.attachment_url) {
                                coopSlip.attachment_url.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((fileUrl: string) => {
                                  if (!addedPaths.has(fileUrl)) {
                                    addedPaths.add(fileUrl);
                                    const filename = fileUrl.split('/').pop() || 'Tài liệu hợp tác';
                                    coopAttachmentsList.push({ name: filename, path: fileUrl, canDelete: true });
                                  }
                                });
                              }

                              if (Array.isArray(docs)) {
                                docs.forEach((d: any) => {
                                  const p = d.path || d.file_path;
                                  if (p && !addedPaths.has(p)) {
                                    const cat = (d.category || d.folder || '').toLowerCase();
                                    const nameLower = (d.name || '').toLowerCase();
                                    if (cat.includes('cọc') || cat.includes('unc') || d.isMilestoneAttachment || nameLower.includes('unc') || p.toLowerCase().includes('deposits')) {
                                      addedPaths.add(p);
                                      coopAttachmentsList.push({ name: d.name || p.split('/').pop() || 'UNC Đặt cọc', path: p, canDelete: false });
                                    }
                                  }
                                });
                              }

                              if (Array.isArray(deals)) {
                                deals.forEach((dep: any) => {
                                  (dep.milestones || []).forEach((m: any) => {
                                    const fileUrl = m.unc_file_path || m.attachment_url;
                                    if (fileUrl && !addedPaths.has(fileUrl)) {
                                      addedPaths.add(fileUrl);
                                      const filename = (() => {
                                        const base = fileUrl.split('/').pop() || `${m.name || 'Cọc giữ chỗ'} - UNC.${fileUrl.split('.').pop() || 'png'}`;
                                        try { return decodeURIComponent(base); } catch (e) { return base; }
                                      })();
                                      coopAttachmentsList.push({ name: filename, path: fileUrl, canDelete: false });
                                    }
                                  });
                                });
                              }

                              if (coopAttachmentsList.length > 0) {
                                return (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
                                    {coopAttachmentsList.map((item, fIdx) => {
                                      const fileUrl = item.path;
                                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
                                      const isPdf = fileUrl.toLowerCase().endsWith('.pdf');
                                      const isWord = fileUrl.toLowerCase().endsWith('.doc') || fileUrl.toLowerCase().endsWith('.docx');
                                      const filename = item.name;

                                      return (
                                        <div 
                                          key={fIdx} 
                                          style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'space-between', 
                                            padding: '12px', 
                                            background: '#f8fafc', 
                                            borderRadius: '12px', 
                                            border: '1px solid var(--color-border-light)',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                            {isImage ? (
                                              <div style={{ position: 'relative', width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border-light)', flexShrink: 0 }}>
                                                <img 
                                                  src={resolveAttachmentUrl(fileUrl)} 
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                  alt={filename} 
                                                />
                                              </div>
                                            ) : (
                                              <div style={{ 
                                                width: '44px', 
                                                height: '44px', 
                                                borderRadius: '8px', 
                                                background: isPdf ? 'rgba(239, 68, 68, 0.08)' : isWord ? 'rgba(59, 130, 246, 0.08)' : 'rgba(100, 116, 139, 0.08)',
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                flexShrink: 0
                                              }}>
                                                {isPdf ? (
                                                  <FileText size={20} style={{ color: '#ef4444' }} />
                                                ) : isWord ? (
                                                  <FileText size={20} style={{ color: '#3b82f6' }} />
                                                ) : (
                                                  <Paperclip size={20} style={{ color: '#64748b' }} />
                                                )}
                                              </div>
                                            )}

                                            <div style={{ minWidth: 0, flex: 1 }}>
                                              <a 
                                                href={resolveAttachmentUrl(fileUrl)} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                style={{ 
                                                  fontSize: '0.85rem', 
                                                  fontWeight: 700, 
                                                  color: 'var(--color-text)', 
                                                  textDecoration: 'none',
                                                  display: 'block',
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap'
                                                }}
                                                title={filename}
                                              >
                                                {filename}
                                              </a>
                                              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                                                {isImage ? 'Định dạng: Hình ảnh' : isPdf ? 'Định dạng: PDF' : isWord ? 'Định dạng: Word Document' : 'Tài liệu đính kèm'}
                                              </p>
                                            </div>
                                          </div>

                                          {canManageCoopAttachments && (
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginLeft: '8px' }}>
                                              {item.canDelete && (
                                                <>
                                                  <button 
                                                    type="button"
                                                    className="btn-icon sm ghost" 
                                                    title="Đổi tên" 
                                                    style={{ background: '#ffffff', border: '1px solid var(--color-border-light)', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    onClick={() => {
                                                      const cleanName = filename.substring(0, filename.lastIndexOf('.')) || filename;
                                                      showConfirm({
                                                        title: 'Đổi tên tài liệu hợp tác',
                                                        message: 'Nhập tên mới cho tài liệu hợp tác:',
                                                        requirePromptInput: true,
                                                        promptPlaceholder: cleanName,
                                                        confirmText: 'Lưu',
                                                        cancelText: 'Hủy',
                                                        onConfirm: async (newName) => {
                                                          if (newName && newName.trim()) {
                                                            try {
                                                              await api.post(`/cooperation-slips/${coopSlip.id}/rename-attachment`, { name: newName.trim(), file_url: fileUrl });
                                                              await fetchCoopSlip();
                                                              addToast('Đã đổi tên tài liệu hợp tác.', 'success');
                                                            } catch (err) {
                                                              addToast('Lỗi khi đổi tên tài liệu.', 'error');
                                                            }
                                                          }
                                                        }
                                                      });
                                                    }}
                                                  >
                                                    <Pencil size={12} />
                                                  </button>
                                                  <button 
                                                    type="button"
                                                    className="btn-icon sm ghost text-danger" 
                                                    title="Xóa" 
                                                    style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    onClick={() => handleRemoveCoopAttachment(fileUrl)}
                                                  >
                                                    <Trash2 size={12} />
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              }

                              return (
                                <div style={{ 
                                  padding: '2.5rem 1.5rem', 
                                  textAlign: 'center', 
                                  background: '#f8fafc', 
                                  borderRadius: '12px', 
                                  border: '1px dashed var(--color-border)', 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  alignItems: 'center', 
                                  gap: '12px' 
                                }}>
                                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(100, 116, 139, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                                    <Paperclip size={22} />
                                  </div>
                                  <div>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--color-text)', margin: '0 0 4px 0' }}>Chưa có tài liệu đính kèm</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>Vui lòng đính kèm các tài liệu/minh chứng hợp tác bắt buộc phía trên.</p>
                                  </div>
                                  {canManageCoopAttachments && (
                                    <div style={{ marginTop: '4px' }}>
                                      <input
                                        type="file"
                                        id="coop-attachment-upload"
                                        style={{ display: 'none' }}
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
                                        onChange={handleCoopAttachmentUpload}
                                      />
                                      <label htmlFor="coop-attachment-upload" className="btn primary sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '8px' }}>
                                        <Upload size={14} /> Tải tài liệu đính kèm
                                      </label>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TIMELINE TAB */}
                  {activeTab === 'timeline' && (
                    <div className="animate-fade">
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        marginBottom: '1rem', 
                        paddingBottom: '0.75rem', 
                        borderBottom: '1px solid var(--color-border-light)', 
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ flex: 1, minWidth: '130px' }}>
                          <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0 }}>Nhật ký tương tác</h3>
                          <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 2, marginBottom: 0 }}>Lưu vết toàn bộ quá trình chăm sóc khách hàng</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, position: 'relative' }}>
                          {/* Add Interaction Button */}
                          <button 
                            className="btn primary sm" 
                            onClick={() => setShowActivityModal(true)} 
                            style={{ 
                              fontWeight: 700, 
                              borderRadius: '8px', 
                              padding: '6px 12px', 
                              fontSize: '0.8rem',
                              height: '34px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Plus size={14} /> 
                            <span>Tương tác</span>
                          </button>

                          {/* Filter Button (...) / Subtabs on Desktop */}
                          {/* Filter Dropdown (All devices) */}
                          <>
                            <button
                              onClick={() => setShowFilterDropdown(prev => !prev)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                height: '34px',
                                borderRadius: '8px',
                                border: '1px solid var(--color-border)',
                                background: showFilterDropdown ? 'var(--color-bg-alt)' : 'var(--color-surface)',
                                color: 'var(--color-text)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                              }}
                              className="hover-lift"
                              title="Lọc tương tác"
                            >
                              <List size={13} style={{ color: 'var(--color-text-muted)' }} />
                              <span>{
                                timelineFilter === 'all' ? 'Tất cả' :
                                timelineFilter === 'call' ? 'Cuộc gọi' :
                                timelineFilter === 'email' ? 'Email' :
                                timelineFilter === 'meeting' ? 'Gặp gỡ' : 'Công việc'
                              }</span>
                              <ChevronDown size={12} style={{ color: 'var(--color-text-muted)', marginLeft: '2px' }} />
                            </button>

                            {/* Dropdown Menu */}
                            {showFilterDropdown && (
                              <>
                                {/* Overlay to close when clicking outside */}
                                <div 
                                  onClick={() => setShowFilterDropdown(false)}
                                  style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    zIndex: 998,
                                    background: 'transparent'
                                  }}
                                />
                                <div style={{
                                  position: 'absolute',
                                  top: '40px',
                                  right: 0,
                                  width: '160px',
                                  background: 'var(--color-surface)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: '10px',
                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                  padding: '6px',
                                  zIndex: 999,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px'
                                }}>
                                  {[
                                    { value: 'all', label: 'Tất cả', icon: null },
                                    { value: 'call', label: 'Cuộc gọi', icon: <Phone size={13} /> },
                                    { value: 'email', label: 'Email', icon: <Mail size={13} /> },
                                    { value: 'meeting', label: 'Gặp gỡ', icon: <Users size={13} /> },
                                    { value: 'task', label: 'Công việc', icon: <CheckSquare size={13} /> }
                                  ].map(tab => {
                                    const isSelected = timelineFilter === tab.value;
                                    return (
                                      <button
                                        key={tab.value}
                                        onClick={() => {
                                          setTimelineFilter(tab.value as any);
                                          setShowFilterDropdown(false);
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '8px 10px',
                                          borderRadius: '6px',
                                          border: 'none',
                                          fontSize: '0.78rem',
                                          fontWeight: isSelected ? 700 : 500,
                                          cursor: 'pointer',
                                          background: isSelected ? 'var(--color-bg-alt)' : 'transparent',
                                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          textAlign: 'left'
                                        }}
                                      >
                                        <span style={{ display: 'flex', alignItems: 'center', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                                          {tab.icon || <List size={13} />}
                                        </span>
                                        <span>{tab.label}</span>
                                        {isSelected && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 'bold' }}>✓</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </>
                        </div>
                      </div>

                      {loadingRelated ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                        </div>
                      ) : timeline.length === 0 ? (
                        <EmptyCard
                          icon={<History size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />}
                          title="Chưa có nhật ký tương tác"
                          description="Các cuộc gọi, email, task hoặc lịch hẹn của khách hàng này sẽ xuất hiện tại đây."
                          actionText="Ghi nhận tương tác"
                          onAction={() => setShowActivityModal(true)}
                        />
                      ) : (
                        <div className="timeline-stepper" style={{ position: 'relative', marginTop: '1rem', marginLeft: '0.5rem', paddingBottom: '1.5rem' }}>
                          <div style={{ position: 'absolute', left: 18, top: 10, bottom: 0, width: 0, borderLeft: '2px dashed var(--color-border-light)' }} />

                          {timeline.map((ev: any, index) => (
                            <TimelineItem
                              key={ev.id}
                              ev={ev}
                              index={index}
                              currentUser={currentUser}
                              drawerActivities={drawerActivities}
                              users={users}
                              isMobile={isMobileOrTablet}
                              formatNote={formatNote}
                              resolveAttachmentUrl={resolveAttachmentUrl}
                              formatMeetingTime={formatMeetingTime}
                              handleTimelineItemClick={handleTimelineItemClick}
                              deleteActivity={deleteActivity}
                              setEditingActivity={setEditingActivity}
                              setShowActivityModal={setShowActivityModal}
                              showUserCard={showUserCard}
                              handleCompleteMeeting={handleCompleteMeeting}
                              handleCancelMeeting={handleCancelMeeting}
                              handleRescheduleMeetingClick={handleRescheduleMeetingClick}
                            />
                          ))}
                        </div>
                      )}
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
                        <button
                          className="btn primary sm"
                          onClick={() => setShowScoringSystemModal(true)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 700,
                            borderRadius: '10px'
                          }}
                        >
                          <HelpCircle size={14} />
                          {t('Hệ thống tính điểm')}
                        </button>
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
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: r.type === 'Demographic' ? '#3b82f6' : r.type === 'Behavioral' ? '#10b981' : '#ef4444', background: r.type === 'Demographic' ? 'rgba(59,130,246,0.1)' : r.type === 'Behavioral' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '12px', marginRight: '8px' }}>
                                      {r.type}
                                    </span>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{r.rule}</span>
                                  </div>
                                  <span style={{ fontWeight: 700, color: r.pts > 0 ? '#10b981' : '#ef4444' }}>
                                    {r.pts > 0 ? `+${r.pts}` : r.pts} pts
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {showScoringSystemModal && (
                        <CustomModal
                          isOpen={showScoringSystemModal}
                          onClose={() => setShowScoringSystemModal(false)}
                          title={t('Hệ thống quy tắc chấm điểm Lead Scoring')}
                          width="600px"
                        >
                          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
                              {t('Hệ thống chấm điểm tự động phân tích hồ sơ và hành vi của Khách hàng tiềm năng để xếp hạng độ nóng/lạnh. Dưới đây là bảng quy tắc tính điểm chi tiết:')}
                            </p>

                            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                                <thead>
                                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)' }}>
                                    <th style={{ padding: '10px 14px', fontWeight: 700 }}>{t('Tiêu chí')}</th>
                                    <th style={{ padding: '10px 14px', fontWeight: 700 }}>{t('Phân loại')}</th>
                                    <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>{t('Điểm số')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    { rule: 'Điểm khởi tạo', type: 'System', pts: 10, desc: 'Điểm cơ bản cho mỗi liên hệ mới' },
                                    { rule: 'Chức danh C-Level (Giám đốc/CEO/Founder/Chủ tịch)', type: 'Demographic', pts: 20, desc: 'Giám đốc, CEO, Founder, Chủ tịch...' },
                                    { rule: 'Có thông tin chức vụ', type: 'Demographic', pts: 5, desc: 'Có điền chức danh khác' },
                                    { rule: 'Cung cấp số điện thoại chính', type: 'Demographic', pts: 15, desc: 'Có số điện thoại chính' },
                                    { rule: 'Cung cấp số điện thoại phụ', type: 'Demographic', pts: 10, desc: 'Có số điện thoại phụ' },
                                    { rule: 'Có cả 2 số liên hệ', type: 'Demographic', pts: 10, desc: 'Cung cấp cả số chính và số phụ' },
                                    { rule: 'Cung cấp Email', type: 'Demographic', pts: 10, desc: 'Có trường Email' },
                                    { rule: 'Xác định loại khách hàng', type: 'Demographic', pts: 5, desc: 'Cá nhân hoặc Doanh nghiệp' },
                                    { rule: 'Có thông tin giới tính', type: 'Demographic', pts: 5, desc: 'Xác định giới tính khách hàng' },
                                    { rule: 'Liên kết Zalo / Facebook', type: 'Demographic', pts: 10, desc: 'Có điền link Zalo hoặc Facebook' },
                                    { rule: 'Có thông tin ngày sinh', type: 'Demographic', pts: 10, desc: 'Giúp lập kế hoạch chúc mừng sinh nhật' },
                                    { rule: 'Có thông tin địa chỉ đầy đủ', type: 'Demographic', pts: 15, desc: 'Thuận tiện ký hợp đồng trực tiếp' },
                                    { rule: 'Xác định ngành nghề kinh doanh', type: 'Demographic', pts: 5, desc: 'Có trường Ngành nghề kinh doanh' },
                                    { rule: 'Nguồn khách từ Website', type: 'Behavioral', pts: 15, desc: 'Nguồn Inbound đăng ký qua web' },
                                    { rule: 'Khách được giới thiệu (Referral)', type: 'Behavioral', pts: 20, desc: 'Được ghi nhận nguồn giới thiệu' },
                                    { rule: 'Liên kết dự án quan tâm', type: 'Behavioral', pts: 15, desc: 'Chọn dự án bất động sản cụ thể' },
                                    { rule: 'Liên kết công ty đối tác', type: 'Behavioral', pts: 5, desc: 'Gắn liên kết đối tác công ty' },
                                    { rule: 'Xác định phân khúc ngân sách', type: 'Behavioral', pts: 10, desc: 'Có lựa chọn phân khúc ngân sách' },
                                    { rule: 'Kỳ vọng doanh thu > 100 Triệu', type: 'Behavioral', pts: 20, desc: 'Kỳ vọng giao dịch từ 100Tr đến 500Tr VNĐ' },
                                    { rule: 'Kỳ vọng doanh thu lớn (> 500 Triệu)', type: 'Behavioral', pts: 35, desc: 'Kỳ vọng giao dịch trên 500Tr VNĐ' },
                                    { rule: 'Xác suất chốt giao dịch cao (>70%)', type: 'Behavioral', pts: 10, desc: 'Xác suất chốt deals trên 70%' },
                                    { rule: 'Xác nhận trạng thái chất lượng', type: 'Behavioral', pts: 15, desc: 'Trạng thái Qualified hoặc Customer' },
                                    { rule: 'Đã hoàn thành xác minh (TTL1)', type: 'Behavioral', pts: 25, desc: 'Đạt điều kiện gặp gỡ tư vấn trực tiếp' },
                                    { rule: 'Có ghi chú chi tiết nhu cầu', type: 'Behavioral', pts: 10, desc: 'Nội dung ghi chú có độ dài trên 10 ký tự' },
                                    { rule: 'Đã gắn thẻ phân loại (Tags)', type: 'Behavioral', pts: 10, desc: 'Sử dụng nhãn phân loại khách hàng' },
                                    { rule: 'Rớt nhiệt (Inactivity Decay)', type: 'Decay', pts: -15, desc: 'Không có tương tác nào trong vòng 5 ngày' }
                                  ].map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', background: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-light)' }}>
                                      <td style={{ padding: '10px 14px' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{t(item.rule)}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{t(item.desc)}</div>
                                      </td>
                                      <td style={{ padding: '10px 14px' }}>
                                        <span style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          padding: '2px 6px',
                                          borderRadius: '6px',
                                          background: item.type === 'Demographic' ? 'rgba(59, 130, 246, 0.08)' : item.type === 'Behavioral' ? 'rgba(16, 185, 129, 0.08)' : item.type === 'Decay' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(107, 114, 128, 0.08)',
                                          color: item.type === 'Demographic' ? '#2563eb' : item.type === 'Behavioral' ? '#059669' : item.type === 'Decay' ? '#dc2626' : '#4b5563',
                                          border: `1px solid ${item.type === 'Demographic' ? 'rgba(59, 130, 246, 0.15)' : item.type === 'Behavioral' ? 'rgba(16, 185, 129, 0.15)' : item.type === 'Decay' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(107, 114, 128, 0.15)'}`
                                        }}>{item.type}</span>
                                      </td>
                                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: item.pts > 0 ? '#10b981' : '#ef4444' }}>
                                        {item.pts > 0 ? `+${item.pts}` : item.pts} {t('pts')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div style={{
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border-light)',
                              borderRadius: '12px',
                              padding: '0.875rem 1.125rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.375rem'
                            }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Xếp hạng độ nhiệt')}</div>
                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                                  <span>{t('Rất Nóng:')} <strong>80 - 100 pts</strong></span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                                  <span>{t('Tiềm Năng:')} <strong>50 - 79 pts</strong></span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                                  <span>{t('Lạnh:')} <strong>0 - 49 pts</strong></span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                              <button className="btn primary" onClick={() => setShowScoringSystemModal(false)} style={{ minWidth: '100px', fontWeight: 700 }}>
                                {t('Đóng')}
                              </button>
                            </div>
                          </div>
                        </CustomModal>
                      )}
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
                          <label style={{ display: 'flex', gap: '12px', cursor: isViewer ? 'not-allowed' : 'pointer', alignItems: 'flex-start' }}>
                            <CustomCheckbox
                              checked={ttl1Data.group1}
                              onChange={(e) => setTtl1Data(p => ({ ...p, group1: e.target.checked }))}
                              disabled={isViewer}
                            />
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhóm 1: Nhân khẩu học (Demographics)</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Có đầy đủ Họ tên, Ngày sinh, Nghề nghiệp và thông tin liên hệ chính thống.</p>
                            </div>
                          </label>

                          {/* Group 2 */}
                          <label style={{ display: 'flex', gap: '12px', cursor: isViewer ? 'not-allowed' : 'pointer', alignItems: 'flex-start' }}>
                            <CustomCheckbox
                              checked={ttl1Data.group2}
                              onChange={(e) => setTtl1Data(p => ({ ...p, group2: e.target.checked }))}
                              disabled={isViewer}
                            />
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhóm 2: Khả năng tài chính (Financial Readiness)</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Xác định nguồn ngân sách đầu tư rõ ràng, có khả năng chứng minh vốn tự có hoặc bảo lãnh vay.</p>
                            </div>
                          </label>

                          {/* Group 3 */}
                          <label style={{ display: 'flex', gap: '12px', cursor: isViewer ? 'not-allowed' : 'pointer', alignItems: 'flex-start' }}>
                            <CustomCheckbox
                              checked={ttl1Data.group3}
                              onChange={(e) => setTtl1Data(p => ({ ...p, group3: e.target.checked }))}
                              disabled={isViewer}
                            />
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhóm 3: Mức độ cấp thiết (Urgency)</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Nhu cầu mua hàng thật sự, có lộ trình ra quyết định trong thời hạn 1 - 3 tháng tới.</p>
                            </div>
                          </label>

                          {/* Group 4 */}
                          <label style={{ display: 'flex', gap: '12px', cursor: isViewer ? 'not-allowed' : 'pointer', alignItems: 'flex-start' }}>
                            <CustomCheckbox
                              checked={ttl1Data.group4}
                              onChange={(e) => setTtl1Data(p => ({ ...p, group4: e.target.checked }))}
                              disabled={isViewer}
                            />
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhóm 4: Mức độ phù hợp với dự án (Project Fit)</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Dòng sản phẩm của dự án phù hợp với yêu cầu diện tích, vị trí và mục tiêu sinh lời của khách hàng.</p>
                            </div>
                          </label>

                          {/* Group 5 */}
                          <label style={{ display: 'flex', gap: '12px', cursor: isViewer ? 'not-allowed' : 'pointer', alignItems: 'flex-start' }}>
                            <CustomCheckbox
                              checked={ttl1Data.group5}
                              onChange={(e) => setTtl1Data(p => ({ ...p, group5: e.target.checked }))}
                              disabled={isViewer}
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
                            disabled={isSavingTTL1 || isViewer}
                          >
                            {isSavingTTL1 ? 'Đang lưu...' : (isViewer ? 'Bạn không có quyền chỉnh sửa' : 'Lưu Form TTL1')}
                          </button>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* DEALS TAB */}
                  {activeTab === 'deals' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Phiếu đặt cọc - {deals.length}</h3>
                        {!isViewer && (
                          <button className="btn primary sm" onClick={() => {
                            setDepositProjectId('');
                            setDepositUnitCode('');
                            const defaultPrice = String(formData.expected_revenue || contact?.expected_revenue || '');
                            setDepositPrice(defaultPrice);
                            setDepositExpectedCommission('');
                            setCommissionType('amount');
                            setCommissionPercent('');
                            setDepositMilestones([{ name: 'Đợt 1 - Cọc giữ chỗ', amount: '' }]);
                            setShowDealModal(true);
                          }}><Plus size={14} /> Tạo phiếu đặt cọc</button>
                        )}
                      </div>
                      {loadingRelated ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                        </div>
                      ) : deals.length === 0 ? (
                        <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                          <CreditCard size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                          <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa có phiếu đặt cọc</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '240px', margin: '0 auto' }}>Đang không có phiếu đặt cọc nào cho khách hàng này.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                          {deals.map((d: any) => {
                            return (
                              <div 
                                key={d.id} 
                                className="card-panel table-row-hover" 
                                style={{ padding: 0, overflow: 'hidden', border: `1px solid var(--color-border)`, transition: 'transform 0.2s, box-shadow 0.2s', borderRadius: '16px', cursor: 'pointer' }}
                                onClick={() => {
                                  handleOpenManageMilestones(d);
                                }}
                              >
                                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--color-surface)' }}>
                                  <div>
                                    <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>{d.title}</h4>
                                    <span className="badge" style={{ background: `${d.stage_color}15`, color: d.stage_color, fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '8px' }}>{d.stage}</span>
                                  </div>
                                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1rem', letterSpacing: '-0.01em' }}>
                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(d.value || 0)}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                      {t('Hoa hồng dự kiến')}: <strong>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(d.expected_commission || 0)}</strong>
                                    </div>
                                  </div>
                                </div>

                                {d.milestones && d.milestones.length > 0 && (
                                  <div style={{ padding: '1rem 1.5rem', background: 'var(--color-bg-light)', borderTop: '1px solid var(--color-border-light)' }}>
                                    <h5 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>Lịch trình thanh toán:</h5>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {d.milestones.map((m: any) => (
                                        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                          <span>{m.milestone_name}</span>
                                          <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <strong>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(m.expected_amount || 0)}</strong>
                                            <span style={{
                                              padding: '2px 8px',
                                              borderRadius: '6px',
                                              fontSize: '0.7rem',
                                              fontWeight: 700,
                                              background: m.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : m.status === 'paid' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                              color: m.status === 'approved' ? '#10b981' : m.status === 'paid' ? '#f59e0b' : '#ef4444'
                                            }}>
                                              {m.status === 'approved' ? 'Đã duyệt' : m.status === 'paid' ? 'Chờ duyệt' : 'Chưa đóng'}
                                            </span>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {d.stage_id !== 'cancelled' && (() => {
                                  const isCreator = String(d.created_by) === String(currentUser?.id);
                                  const isOwner = String(d.contact_owner_id) === String(currentUser?.id);
                                  const isStaff = currentUser && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director'].includes(currentUser.role);
                                  
                                  if (isStaff || isCreator || isOwner) {
                                    return (
                                      <div style={{ padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'flex-end', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border-light)' }}>
                                        <button 
                                          className="btn outline danger sm"
                                          onClick={(e) => { e.stopPropagation(); handleCancelDeposit(d.id); }}
                                          style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '28px', fontSize: '0.75rem', padding: '0 10px', cursor: 'pointer' }}
                                        >
                                          <Ban size={12} /> Hủy đặt cọc (Bể cọc)
                                        </button>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
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
                        <h3 style={{ fontWeight: 700, fontSize: '1.125rem', margin: 0 }}>Công việc cần làm</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                            <button
                              type="button"
                              onClick={() => setTaskViewMode('kanban')}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: 'none',
                                background: taskViewMode === 'kanban' ? 'var(--color-surface)' : 'transparent',
                                color: taskViewMode === 'kanban' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.15s',
                                boxShadow: taskViewMode === 'kanban' ? 'var(--shadow-sm)' : 'none'
                              }}
                              title="Dạng bảng (Kanban)"
                            >
                              <LayoutGrid size={14} />
                              <span className="responsive-hide-mobile">Bảng</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setTaskViewMode('list')}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: 'none',
                                background: taskViewMode === 'list' ? 'var(--color-surface)' : 'transparent',
                                color: taskViewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.15s',
                                boxShadow: taskViewMode === 'list' ? 'var(--shadow-sm)' : 'none'
                              }}
                              title="Dạng danh sách (List)"
                            >
                              <List size={14} />
                              <span className="responsive-hide-mobile">Danh sách</span>
                            </button>
                          </div>
                          {!isViewer && (
                            <button className="btn primary" style={{ padding: '8px 16px', fontSize: '0.875rem', height: '34px' }} onClick={() => {
                              const today = new Date().toISOString().slice(0, 10);
                              const fullName = `${formData.last_name || ''} ${formData.first_name || ''}`.trim();
                              setSelectedTaskForDetails({
                                id: 'new',
                                subject: '',
                                priority: 'medium',
                                due_date: today,
                                description: '',
                                link: '',
                                user_id: String(formData?.owner_id || currentUser?.id || ''),
                                progress: 0,
                                require_approval: 0,
                                approver_id: '',
                                participant_ids: '',
                                related_contact_ids: [],
                                checklist: [],
                                recurrence_pattern: 'none',
                                recurrence_weekly_days: [],
                                recurrence_monthly_day: 1,
                                project_id: '',
                                campaign_id: '',
                                team_id: '',
                                campaign_target: '',
                                related_id: formData?.id || contact?.id,
                                related_type: 'contact',
                                contact_name: fullName,
                                contact_id: formData?.id || contact?.id
                              });
                            }}><Plus size={14} /> Thêm công việc</button>
                          )}
                        </div>
                      </div>

                      {/* Quick Task Role Filters */}
                      <div className="segmented-control-wrapper" style={{ marginBottom: '1rem' }}>
                        <div style={{
                          display: 'flex',
                          gap: '2px',
                          background: 'var(--color-border-light)',
                          border: '1px solid var(--color-border)',
                          padding: '2px',
                          borderRadius: '8px',
                          width: 'fit-content',
                          position: 'relative'
                        }}>
                          {/* Sliding Pill Background Indicator */}
                          {(() => {
                            const tabs = [
                              { value: 'all', label: 'Tất cả' },
                              { value: 'assigned_to_me', label: 'Tôi thực hiện' },
                              currentUser && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'vp', 'leader', 'assistant'].includes(String(currentUser.role).toLowerCase()) && { value: 'approve_by_me', label: 'Tôi duyệt' },
                              { value: 'collaborator', label: 'Tôi liên quan' }
                            ].filter(Boolean) as any[];
                            const activeIndex = tabs.findIndex(t => t.value === drawerTaskFilter);
                            const safeIndex = activeIndex === -1 ? 0 : activeIndex;
                            return (
                              <div style={{
                                position: 'absolute',
                                top: '2px',
                                bottom: '2px',
                                width: '110px',
                                borderRadius: '6px',
                                background: 'var(--color-surface)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: `translateX(${safeIndex * 112}px)`,
                                zIndex: 1
                              }} />
                            );
                          })()}

                          {[
                            { value: 'all', label: 'Tất cả' },
                            { value: 'assigned_to_me', label: 'Tôi thực hiện' },
                            currentUser && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'vp', 'leader', 'assistant'].includes(String(currentUser.role).toLowerCase()) && { value: 'approve_by_me', label: 'Tôi duyệt' },
                            { value: 'collaborator', label: 'Tôi liên quan' }
                          ].filter((tab): tab is { value: string; label: string } => !!tab).map(tab => {
                            const isSelected = drawerTaskFilter === tab.value;
                            return (
                              <button
                                key={tab.value}
                                onClick={() => setDrawerTaskFilter(tab.value as any)}
                                style={{
                                  width: '110px',
                                  height: '26px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  background: 'transparent',
                                  color: isSelected ? 'var(--color-text)' : 'var(--color-text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  position: 'relative',
                                  outline: 'none',
                                  boxShadow: 'none',
                                  zIndex: 2,
                                  transition: 'color 0.2s ease'
                                }}
                              >
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {(() => {
                        const filteredTasks = tasks.filter(t => {
                          const currentUserId = Number(currentUser?.id);
                          if (drawerTaskFilter === 'assigned_to_me') {
                            return Number(t.user_id) === currentUserId;
                          } else if (drawerTaskFilter === 'approve_by_me') {
                            return Number(t.require_approval) === 1 && Number(t.approver_id) === currentUserId;
                          } else if (drawerTaskFilter === 'collaborator') {
                            const pIds = t.participant_ids ? t.participant_ids.split(',').map(Number).filter(Boolean) : [];
                            return pIds.includes(currentUserId);
                          }
                          return true;
                        });

                        if (loadingRelated) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                              <StatRowSkeleton />
                              <StatRowSkeleton />
                              <StatRowSkeleton />
                            </div>
                          );
                        }

                        if (filteredTasks.length === 0) {
                          return (
                            <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                              <CheckSquare size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                              <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa có công việc</h4>
                              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '240px', margin: '0 auto' }}>Bắt đầu bằng việc thêm một công việc mới để quản lý tiến độ với khách hàng.</p>
                            </div>
                          );
                        }

                        const todoTasks = filteredTasks.filter(t => !t.done && (!t.progress || t.progress === 0));
                        const inProgressTasks = filteredTasks.filter(t => !t.done && t.progress > 0 && t.progress < 100);
                        const doneTasks = filteredTasks.filter(t => t.done || t.progress === 100);

                        const renderKanbanColumn = (
                          colId: 'todo' | 'in_progress' | 'done',
                          title: string,
                          columnTasks: any[],
                          headerColor: string,
                          bgColor: string
                        ) => {
                          const isOver = activeOverCol === colId;
                          return (
                            <div
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (activeOverCol !== colId) setActiveOverCol(colId);
                              }}
                              onDragLeave={() => setActiveOverCol(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setActiveOverCol(null);
                                if (draggedTaskId !== null) {
                                  handleTaskDrop(draggedTaskId, colId);
                                }
                              }}
                              style={{
                                background: '#f8fafc',
                                border: isOver ? '2px dashed var(--color-primary)' : '1px solid #e2e8f0',
                                borderRadius: '16px',
                                padding: '0.75rem',
                                minHeight: '380px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem',
                                transition: 'all 0.2s',
                                boxShadow: isOver ? '0 4px 12px rgba(189, 29, 45, 0.08)' : 'none',
                                width: '100%'
                              }}
                            >
                              {/* Column Header */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.375rem', borderBottom: '1px solid var(--color-border-light)', marginBottom: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: headerColor }}></span>
                                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{title}</h4>
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: bgColor, color: headerColor }}>
                                  {columnTasks.length}
                                </span>
                              </div>

                              {/* Tasks List */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1, overflowY: 'auto', maxHeight: '500px' }}>
                                {columnTasks.map(t => {
                                  const isOverdue = t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0,0,0,0));
                                  return (
                                    <div
                                      key={t.id}
                                      draggable
                                      onDragStart={() => setDraggedTaskId(t.id)}
                                      onDragEnd={() => setDraggedTaskId(null)}
                                      onClick={() => {
                                        if (t.done) return;
                                        setSelectedTaskForDetails(t);
                                      }}
                                      style={{
                                        background: 'var(--color-surface)',
                                        border: isOverdue && !t.done ? '1.5px solid var(--color-danger)' : '1px solid var(--color-border-light)',
                                        borderRadius: '12px',
                                        padding: '0.875rem',
                                        cursor: 'grab',
                                        opacity: t.done ? 0.7 : 1,
                                        boxShadow: 'var(--shadow-sm)',
                                        transition: 'all 0.2s',
                                        position: 'relative'
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = isOverdue && !t.done ? 'var(--color-danger)' : 'var(--color-primary)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = isOverdue && !t.done ? 'var(--color-danger)' : 'var(--color-border-light)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                      }}
                                    >
                                      {/* Drag handle & header info */}
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '4px' }}>
                                        <span className={`badge ${t.priority === 'high' ? 'danger' : 'warning'}`} style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                                          {t.priority === 'high' ? 'Cao' : 'Trung bình'}
                                        </span>
                                        <button
                                          className="btn-icon sm text-danger"
                                          style={{ opacity: 0.3, padding: '2px' }}
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
                                          onMouseLeave={e => e.currentTarget.style.opacity = '0.3'}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>

                                      {/* Task Title */}
                                      <p style={{ 
                                        fontSize: '0.8125rem', 
                                        fontWeight: 600, 
                                        color: 'var(--color-text)', 
                                        margin: '0 0 6px 0', 
                                        textDecoration: t.done ? 'line-through' : 'none',
                                        lineHeight: '1.25'
                                      }}>
                                        {t.title}
                                      </p>

                                      {t.type === 'meeting' && !t.done && t.due_date && (
                                        <div style={{ marginBottom: '6px' }}>
                                          <MeetingCountdown dueDate={t.due_date} />
                                        </div>
                                      )}

                                      {/* Task Description */}
                                      {t.description && (
                                        <p style={{ 
                                          fontSize: '0.75rem', 
                                          color: 'var(--color-text-muted)', 
                                          margin: '0 0 6px 0',
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          lineHeight: '1.3'
                                        }}>
                                          {t.description}
                                        </p>
                                      )}

                                      {/* Attachment Link */}
                                      {t.link && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '6px' }} onClick={e => e.stopPropagation()}>
                                          <Paperclip size={11} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                          <a 
                                            href={resolveAttachmentUrl(t.link)} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                          >
                                            {t.link.includes('uploads/') ? t.link.split('/').pop().replace(/^\d+_/, '') : t.link}
                                          </a>
                                        </div>
                                      )}

                                      {/* Tags */}
                                      {(t.tags || '').split(',').filter(Boolean).length > 0 && (
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                          {(t.tags || '').split(',').filter(Boolean).map((tag: string) => (
                                            <span key={tag} style={{ fontSize: '0.6rem', padding: '0px 4px', borderRadius: '4px', background: 'rgba(16,185,129,0.06)', color: '#059669', fontWeight: 600 }}>
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* MEETING TYPE INLINE ACTIONS FOR TASK CARD */}
                                      {t.type === 'meeting' && !t.done && (
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '0.5rem', flexWrap: 'wrap', pointerEvents: 'auto' }} onClick={e => e.stopPropagation()}>
                                          <button 
                                            className="btn success sm" 
                                            style={{ height: '22px', fontSize: '0.7rem', padding: '0 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px', border: 'none', cursor: 'pointer' }}
                                            onClick={() => handleCompleteMeeting(t.rawActivity || t)}
                                          >
                                            <Check size={10} /> Đã gặp
                                          </button>
                                          <button 
                                            className="btn danger sm" 
                                            style={{ height: '22px', fontSize: '0.7rem', padding: '0 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px', border: 'none', cursor: 'pointer' }}
                                            onClick={() => handleCancelMeeting(t.rawActivity || t)}
                                          >
                                            <X size={10} /> Hủy lịch
                                          </button>
                                          <button 
                                            className="btn warning sm" 
                                            style={{ height: '22px', fontSize: '0.7rem', padding: '0 8px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px', border: 'none', cursor: 'pointer', color: '#7c2d12' }}
                                            onClick={() => setReschedulingMeeting(t.rawActivity || t)}
                                          >
                                            <Calendar size={10} /> Dời lịch
                                          </button>
                                        </div>
                                      )}

                                      {/* Footer info (Due Date & Progress) */}
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.375rem', borderTop: '1px solid var(--color-border-light)' }}>
                                        <span style={{ 
                                          fontSize: '0.7rem', 
                                          color: isOverdue && !t.done ? 'var(--color-danger)' : 'var(--color-text-muted)', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          gap: '3px',
                                          fontWeight: isOverdue && !t.done ? 600 : 'normal'
                                        }}>
                                          <Clock size={10} />
                                          {t.type === 'meeting' ? `Lịch gặp: ${formatMeetingTime(t.due_date)}` : getDueDateLabel(t.due_date, t.done)}
                                        </span>
                                        
                                        {colId === 'in_progress' && (
                                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)' }}>
                                            {t.progress || 50}%
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        };

                        const renderTasksListView = () => {
                          if (isMobileOrTablet) {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '0.5rem', width: '100%' }}>
                                {filteredTasks.map(t => {
                                  const isOverdue = t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0,0,0,0)) && !t.done;
                                  const statusLabel = t.done || t.progress === 100 ? 'Đã xong' : (t.progress > 0 ? 'Đang làm' : 'Cần làm');
                                  const statusColor = t.done || t.progress === 100 ? 'var(--color-success)' : (t.progress > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)');
                                  const statusBg = t.done || t.progress === 100 ? 'rgba(16, 185, 129, 0.08)' : (t.progress > 0 ? 'rgba(245, 158, 11, 0.08)' : '#f1f5f9');
                                  return (
                                    <div 
                                      key={t.id}
                                      onClick={() => { if (!t.done) setSelectedTaskForDetails(t); }}
                                      style={{ 
                                        background: 'var(--color-surface)',
                                        borderRadius: '12px',
                                        border: isOverdue ? '1.5px solid var(--color-danger)' : '1px solid var(--color-border-light)',
                                        padding: '10px 12px',
                                        boxShadow: 'var(--shadow-sm)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px',
                                        position: 'relative'
                                      }}
                                    >
                                      {/* Badges & Actions row */}
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', color: statusColor, background: statusBg }}>
                                            {statusLabel}
                                          </span>
                                          <span className={`badge ${t.priority === 'high' ? 'danger' : 'warning'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                            {t.priority === 'high' ? 'Cao' : 'Trung bình'}
                                          </span>
                                        </div>
                                        
                                        <div onClick={e => e.stopPropagation()}>
                                          <button
                                            className="btn-icon sm text-danger"
                                            style={{ padding: '2px' }}
                                            onClick={() => {
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
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Title & Description */}
                                      <div>
                                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)', textDecoration: t.done ? 'line-through' : 'none' }}>
                                          {t.title}
                                        </span>
                                        {t.type === 'meeting' && !t.done && t.due_date && (
                                          <div style={{ marginTop: '2px' }}>
                                            <MeetingCountdown dueDate={t.due_date} />
                                          </div>
                                        )}
                                        {t.description && (
                                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>
                                            {t.description}
                                          </span>
                                        )}
                                        {t.tags && (
                                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                                            {t.tags.split(',').filter(Boolean).map((tag: string) => (
                                              <span key={tag} style={{ fontSize: '0.6rem', padding: '0px 4px', borderRadius: '4px', background: 'rgba(16,185,129,0.06)', color: '#059669', fontWeight: 600 }}>#{tag}</span>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Date & Progress */}
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '0.72rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-light)', paddingTop: '6px', marginTop: '2px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <Clock size={11} />
                                          <span>{t.type === 'meeting' ? `Lịch gặp: ${formatMeetingTime(t.due_date)}` : getDueDateLabel(t.due_date, t.done)}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <div style={{ width: '40px', height: '4px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ width: `${t.done ? 100 : (t.progress || 0)}%`, height: '100%', background: t.done ? 'var(--color-success)' : 'var(--color-primary)' }} />
                                          </div>
                                          <span style={{ fontWeight: 700 }}>{t.done ? 100 : (t.progress || 0)}%</span>
                                        </div>
                                      </div>

                                      {/* Meeting Inline actions */}
                                      {t.type === 'meeting' && !t.done && (
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                          <button 
                                            className="btn success sm" 
                                            style={{ height: '22px', fontSize: '0.68rem', padding: '0 6px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px', border: 'none', cursor: 'pointer' }}
                                            onClick={() => handleCompleteMeeting(t.rawActivity || t)}
                                          >
                                            <Check size={10} /> Đã gặp
                                          </button>
                                          <button 
                                            className="btn danger sm" 
                                            style={{ height: '22px', fontSize: '0.68rem', padding: '0 6px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px', border: 'none', cursor: 'pointer' }}
                                            onClick={() => handleCancelMeeting(t.rawActivity || t)}
                                          >
                                            <X size={10} /> Hủy lịch
                                          </button>
                                          <button 
                                            className="btn warning sm" 
                                            style={{ height: '22px', fontSize: '0.68rem', padding: '0 6px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px', border: 'none', cursor: 'pointer', color: '#7c2d12' }}
                                            onClick={() => setReschedulingMeeting(t.rawActivity || t)}
                                          >
                                            <Calendar size={10} /> Dời lịch
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          return (
                            <div style={{ background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', overflow: 'hidden', marginTop: '0.5rem', width: '100%' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                                <thead>
                                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-muted)' }}>Tên công việc</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-muted)', width: '120px' }}>Trạng thái</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-muted)', width: '100px' }}>Độ ưu tiên</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-muted)', width: '130px' }}>Hạn hoàn thành</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-muted)', width: '140px' }}>Tiến độ</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text-muted)', width: '80px', textAlign: 'right' }}>Thao tác</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredTasks.map(t => {
                                    const isOverdue = t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0,0,0,0)) && !t.done;
                                    const statusLabel = t.done || t.progress === 100 ? 'Đã xong' : (t.progress > 0 ? 'Đang làm' : 'Cần làm');
                                    const statusColor = t.done || t.progress === 100 ? 'var(--color-success)' : (t.progress > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)');
                                    const statusBg = t.done || t.progress === 100 ? 'rgba(16, 185, 129, 0.08)' : (t.progress > 0 ? 'rgba(245, 158, 11, 0.08)' : '#f1f5f9');
                                    
                                    return (
                                      <tr 
                                        key={t.id}
                                        onClick={() => { if (!t.done) setSelectedTaskForDetails(t); }}
                                        style={{ 
                                          borderBottom: '1px solid var(--color-border-light)', 
                                          cursor: t.done ? 'default' : 'pointer', 
                                          transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={e => { if (!t.done) e.currentTarget.style.backgroundColor = 'var(--color-bg)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                      >
                                        <td style={{ padding: '14px 16px' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--color-text)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                                            {t.type === 'meeting' && !t.done && t.due_date && (
                                              <div style={{ marginTop: '2px' }}>
                                                <MeetingCountdown dueDate={t.due_date} />
                                              </div>
                                            )}
                                            {t.description && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</span>}
                                            {t.tags && (
                                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                                {t.tags.split(',').filter(Boolean).map((tag: string) => (
                                                  <span key={tag} style={{ fontSize: '0.6rem', padding: '0px 4px', borderRadius: '4px', background: 'rgba(16,185,129,0.06)', color: '#059669', fontWeight: 600 }}>#{tag}</span>
                                                ))}
                                              </div>
                                            )}
                                            {t.type === 'meeting' && !t.done && (
                                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                                <button 
                                                  className="btn success sm" 
                                                  style={{ height: '20px', fontSize: '0.65rem', padding: '0 6px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px', border: 'none', cursor: 'pointer' }}
                                                  onClick={() => handleCompleteMeeting(t.rawActivity || t)}
                                                >
                                                  <Check size={10} /> Đã gặp
                                                </button>
                                                <button 
                                                  className="btn danger sm" 
                                                  style={{ height: '20px', fontSize: '0.65rem', padding: '0 6px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px', border: 'none', cursor: 'pointer' }}
                                                  onClick={() => handleCancelMeeting(t.rawActivity || t)}
                                                >
                                                  <X size={10} /> Hủy lịch
                                                </button>
                                                <button 
                                                  className="btn warning sm" 
                                                  style={{ height: '20px', fontSize: '0.65rem', padding: '0 6px', borderRadius: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px', border: 'none', cursor: 'pointer', color: '#7c2d12' }}
                                                  onClick={() => setReschedulingMeeting(t.rawActivity || t)}
                                                >
                                                  <Calendar size={10} /> Dời lịch
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', color: statusColor, background: statusBg }}>
                                            {statusLabel}
                                          </span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                          <span className={`badge ${t.priority === 'high' ? 'danger' : 'warning'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                            {t.priority === 'high' ? 'Cao' : 'Trung bình'}
                                          </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: isOverdue ? 600 : 'normal' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} />
                                            {t.type === 'meeting' ? `Lịch gặp: ${formatMeetingTime(t.due_date)}` : getDueDateLabel(t.due_date, t.done)}
                                          </div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100px' }}>
                                            <div style={{ flex: 1, height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                                              <div style={{ width: `${t.done ? 100 : (t.progress || 0)}%`, height: '100%', background: t.done ? 'var(--color-success)' : 'var(--color-primary)' }} />
                                            </div>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, minWidth: '24px', textAlign: 'right' }}>{t.done ? 100 : (t.progress || 0)}%</span>
                                          </div>
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                          <button
                                            className="btn-icon sm text-danger"
                                            style={{ padding: '4px' }}
                                            onClick={() => {
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
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        };

                        if (taskViewMode === 'list') {
                          return renderTasksListView();
                        }

                        return (
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: isMobileOrTablet ? '1fr' : 'repeat(3, 1fr)', 
                            gap: '1rem', 
                            alignItems: 'start', 
                            marginTop: '0.5rem', 
                            width: '100%' 
                          }}>
                            {renderKanbanColumn('todo', 'Cần làm', todoTasks, 'var(--color-text-muted)', '#e2e8f0')}
                            {renderKanbanColumn('in_progress', 'Đang làm', inProgressTasks, 'var(--color-warning)', 'rgba(245, 158, 11, 0.12)')}
                            {renderKanbanColumn('done', 'Đã xong', doneTasks, 'var(--color-success)', 'rgba(16, 185, 129, 0.12)')}
                          </div>
                        );
                      })()}
                  </div>
                )}



                  {/* RESTORED OLD TABS */}
                  {activeTab === 'docs' && (
                    <div className="animate-fade">
                      {/* Spaced and styled Title block */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border-light)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-text)', margin: 0 }}>Hồ sơ & Tài liệu</h3>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            Quản lý hợp đồng, CMND/CCCD hoặc báo giá của khách hàng theo thư mục
                          </span>
                        </div>
                        {isOwnerOrAdmin && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                              onClick={() => {
                                showConfirm({
                                  title: 'Thư mục mới',
                                  message: 'Vui lòng nhập tên cho thư mục mới:',
                                  requirePromptInput: true,
                                  promptPlaceholder: 'Tên thư mục...',
                                  confirmText: 'Tạo thư mục',
                                  cancelText: 'Hủy',
                                  onConfirm: (name) => {
                                    if (name && name.trim()) {
                                      const trimmed = name.trim();
                                      if (allFolders.includes(trimmed)) {
                                        addToast('Thư mục đã tồn tại.', 'warning');
                                        return;
                                      }
                                      const next = [...localFolders, trimmed];
                                      setLocalFolders(next);
                                      localStorage.setItem(`richland_folders_contact_${contact.id}`, JSON.stringify(next));
                                      addToast('Đã tạo thư mục mới.', 'success');
                                    }
                                  }
                                });
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                background: 'rgba(100, 116, 139, 0.08)',
                                color: 'var(--color-text-light)',
                                border: '1px solid var(--color-border-light)',
                                fontSize: '0.825rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                height: '36px'
                              }}
                              className="hover-lift"
                            >
                              <FolderPlus size={16} /> Tạo thư mục
                            </button>
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                background: 'rgba(100, 116, 139, 0.08)',
                                color: 'var(--color-text-light)',
                                border: '1px solid var(--color-border-light)',
                                fontSize: '0.825rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                height: '36px'
                              }}
                              className="hover-lift"
                            >
                              <input type="file" style={{ display: 'none' }} onChange={async (e) => {
                                if (e.target.files?.[0]) {
                                  const file = e.target.files[0];
                                  const originalName = file.name;
                                  const defaultName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
                                  let ext = originalName.substring(originalName.lastIndexOf('.'));
                                  
                                  let fileToUpload = file;
                                  if (file.type && file.type.startsWith('image/')) {
                                    try {
                                      fileToUpload = await compressToWebP(file);
                                      ext = '.webp';
                                    } catch (compressErr) {
                                      console.error("Compression failed, using original file", compressErr);
                                    }
                                  }
                                  const finalName = defaultName + ext;
                                  const renamedFile = new File([fileToUpload], finalName, { type: fileToUpload.type });
                                  const fData = new FormData();
                                  fData.append('file', renamedFile);
                                  fData.append('name', finalName);
                                  fData.append('contact_id', String(contact.id));
                                  fData.append('category', currentFolder || 'general');
                                  fData.append('visibility', 'shared');

                                  const isImg = renamedFile.type && renamedFile.type.startsWith('image/');
                                  const previewUrl = isImg ? URL.createObjectURL(renamedFile) : '';
                                  setUploadingFileObj({
                                    name: finalName,
                                    size: (renamedFile.size / 1024 / 1024).toFixed(1) + ' MB',
                                    previewUrl,
                                    isImage: isImg
                                  });
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
                                    setUploadingFileObj(null);
                                    fetchData();
                                    addToast('Đã tải lên tài liệu mới thành công.', 'success');
                                  } catch (err: any) {
                                    setUploadProgress(null);
                                    setUploadingFileObj(null);
                                    addToast('Lỗi khi tải tài liệu lên server', 'error');
                                  } finally {
                                    e.target.value = '';
                                  }
                                }
                              }} />
                              <Plus size={16} /> Upload file
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Folder Breadcrumb Navigation */}
                      {currentFolder !== '' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '1.25rem', padding: '8px 14px', background: 'var(--color-bg)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                          <span 
                            style={{ color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setCurrentFolder('')}
                          >
                            <Folder size={15} /> Tất cả tài liệu
                          </span>
                          <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                          <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{currentFolder}</span>
                        </div>
                      )}

                      {/* Uploading progress bar */}
                      {uploadProgress !== null && uploadingFileObj && (
                        <div className="card-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', marginBottom: '1rem' }}>
                          <div style={{ width: 40, height: 40, background: 'var(--color-info-light)', color: 'var(--color-info)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                            {uploadingFileObj.isImage ? (
                              <img src={uploadingFileObj.previewUrl} alt={uploadingFileObj.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <FileText size={20} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {uploadingFileObj.name}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 }}>
                                {uploadProgress}%
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '6px', background: 'var(--color-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.1s ease-out' }} />
                              </div>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                                {uploadingFileObj.size}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Root Folders Grid View */}
                      {currentFolder === '' && allFolders.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                          {allFolders.map(folder => {
                            const folderFiles = docs.filter(d => {
                              if (folder === 'Đặt cọc') {
                                const cat = (d.category || d.folder || '').toLowerCase();
                                const p = (d.path || d.file_path || '').toLowerCase();
                                return cat.includes('cọc') || cat.includes('unc') || d.isMilestoneAttachment || (d.name || '').toLowerCase().includes('unc') || p.includes('deposits');
                              }
                              return d.category === folder || d.folder === folder;
                            });
                            return (
                              <div
                                key={folder}
                                className="card-panel hover-lift"
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  padding: '1.25rem 1rem',
                                  background: 'var(--color-surface)',
                                  border: '1px solid var(--color-border-light)',
                                  borderRadius: '16px',
                                  cursor: 'pointer',
                                  transition: 'all 0.25s'
                                }}
                                onClick={() => setCurrentFolder(folder)}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '1.25rem' }}>
                                  <div style={{ width: 44, height: 44, background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Folder size={24} fill="#f59e0b" fillOpacity={0.2} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {folder}
                                    </h4>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                      {folderFiles.length} tệp tin
                                    </span>
                                  </div>
                                </div>
                                {isOwnerOrAdmin && (
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                                    <button
                                      style={{
                                        background: 'rgba(100, 116, 139, 0.08)',
                                        color: 'var(--color-text-light)',
                                        border: '1px solid var(--color-border-light)',
                                        padding: '4px 10px',
                                        borderRadius: '8px',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        height: '26px'
                                      }}
                                      className="hover-lift"
                                      title="Đổi tên thư mục"
                                      onClick={() => {
                                        showConfirm({
                                          title: 'Đổi tên thư mục',
                                          message: `Nhập tên mới cho thư mục "${folder}":`,
                                          requirePromptInput: true,
                                          promptPlaceholder: folder,
                                          confirmText: 'Lưu',
                                          cancelText: 'Hủy',
                                          onConfirm: async (newName) => {
                                            if (newName && newName.trim() && newName.trim() !== folder) {
                                              const trimmed = newName.trim();
                                              try {
                                                const updates = folderFiles.map(d =>
                                                  api.put(`/cloud-files/${d.id}`, { name: d.name, category: trimmed })
                                                );
                                                await Promise.all(updates);
                                                
                                                const next = localFolders.map(f => f === folder ? trimmed : f);
                                                setLocalFolders(next);
                                                localStorage.setItem(`richland_folders_contact_${contact.id}`, JSON.stringify(next));
                                                
                                                fetchData();
                                                addToast('Đã đổi tên thư mục thành công.', 'success');
                                              } catch (err) {
                                                addToast('Lỗi khi đổi tên thư mục.', 'error');
                                              }
                                            }
                                          }
                                        });
                                      }}
                                    >
                                      <Pencil size={12} /> Đổi tên
                                    </button>
                                    <button
                                      style={{
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.15)',
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '26px'
                                      }}
                                      className="hover-lift"
                                      title="Xóa thư mục"
                                      onClick={() => {
                                        showConfirm({
                                          title: 'Xóa thư mục?',
                                          message: folderFiles.length > 0
                                            ? `Thư mục "${folder}" đang chứa ${folderFiles.length} tệp tin. Bạn muốn di chuyển chúng ra thư mục gốc hay xóa tất cả?`
                                            : `Bạn có chắc muốn xóa thư mục "${folder}"?`,
                                          isDanger: true,
                                          confirmText: folderFiles.length > 0 ? 'Chuyển ra gốc & Xóa' : 'Xóa',
                                          onConfirm: async () => {
                                            try {
                                              if (folderFiles.length > 0) {
                                                const updates = folderFiles.map(d =>
                                                  api.put(`/cloud-files/${d.id}`, { name: d.name, category: 'general' })
                                                );
                                                await Promise.all(updates);
                                              }
                                              
                                              const next = localFolders.filter(f => f !== folder);
                                              setLocalFolders(next);
                                              localStorage.setItem(`richland_folders_contact_${contact.id}`, JSON.stringify(next));
                                              
                                              fetchData();
                                              addToast('Đã xóa thư mục thành công.', 'success');
                                            } catch (err) {
                                              addToast('Lỗi khi xóa thư mục.', 'error');
                                            }
                                          }
                                        });
                                      }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Empty documents placeholder */}
                      {loadingRelated ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                        </div>
                      ) : docs.length === 0 ? (
                        <EmptyCard
                          icon={<FileText size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />}
                          title="Chưa có tài liệu nào"
                          description="Upload hợp đồng, CMND/CCCD hoặc báo giá tại đây."
                          actionText={isOwnerOrAdmin ? "Upload file" : undefined}
                          onAction={isOwnerOrAdmin ? () => {
                            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                            if (fileInput) fileInput.click();
                          } : undefined}
                        />
                      ) : visibleDocs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <Folder size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.5, marginBottom: '0.75rem' }} />
                          <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '4px' }}>Thư mục trống</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>Chưa có tài liệu nào trong thư mục này.</p>
                          {isOwnerOrAdmin && (
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                background: 'rgba(100, 116, 139, 0.08)',
                                color: 'var(--color-text-light)',
                                border: '1px solid var(--color-border-light)',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                height: '32px'
                              }}
                              className="hover-lift"
                            >
                              <input type="file" style={{ display: 'none' }} onChange={async (e) => {
                                if (e.target.files?.[0]) {
                                  const file = e.target.files[0];
                                  const originalName = file.name;
                                  const defaultName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
                                  let ext = originalName.substring(originalName.lastIndexOf('.'));

                                  let fileToUpload = file;
                                  if (file.type && file.type.startsWith('image/')) {
                                    try {
                                      fileToUpload = await compressToWebP(file);
                                      ext = '.webp';
                                    } catch (e) {}
                                  }
                                  const finalName = defaultName + ext;
                                  const renamedFile = new File([fileToUpload], finalName, { type: fileToUpload.type });
                                  const fData = new FormData();
                                  fData.append('file', renamedFile);
                                  fData.append('name', finalName);
                                  fData.append('contact_id', String(contact.id));
                                  fData.append('category', currentFolder || 'general');
                                  fData.append('visibility', 'shared');

                                  setUploadingFileObj({
                                    name: finalName,
                                    size: (renamedFile.size / 1024 / 1024).toFixed(1) + ' MB',
                                    previewUrl: renamedFile.type.startsWith('image/') ? URL.createObjectURL(renamedFile) : '',
                                    isImage: renamedFile.type.startsWith('image/')
                                  });
                                  setUploadProgress(0);

                                  try {
                                    await api.post('/cloud-files', fData, {
                                      headers: { 'Content-Type': 'multipart/form-data' },
                                      onUploadProgress: (progressEvent) => {
                                        setUploadProgress(Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1)));
                                      }
                                    });
                                    setUploadProgress(null);
                                    setUploadingFileObj(null);
                                    fetchData();
                                    addToast('Đã tải lên tài liệu mới thành công.', 'success');
                                  } catch (err: any) {
                                    setUploadProgress(null);
                                    setUploadingFileObj(null);
                                    addToast('Lỗi khi tải tài liệu lên server', 'error');
                                  }
                                }
                              }} />
                              <Plus size={14} /> Upload file ngay
                            </label>
                          )}
                        </div>
                      ) : (
                        /* Files List View */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {docs.filter(d => {
                            if (currentFolder === '') return true;
                            if (currentFolder === 'Đặt cọc') {
                              const cat = (d.category || d.folder || '').toLowerCase();
                              const p = (d.path || d.file_path || '').toLowerCase();
                              return cat.includes('cọc') || cat.includes('unc') || d.isMilestoneAttachment || (d.name || '').toLowerCase().includes('unc') || p.includes('deposits');
                            }
                            return d.category === currentFolder || d.folder === currentFolder;
                          }).map(doc => {
                            const ext = doc.name.split('.').pop()?.toLowerCase();
                            const isImg = ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                            const fileUrl = resolveAttachmentUrl(doc.path);
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
                                {isOwnerOrAdmin && !doc.isCoopAttachment && (
                                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                                    <button
                                      style={{
                                        background: 'rgba(100, 116, 139, 0.08)',
                                        color: 'var(--color-text-light)',
                                        border: '1px solid var(--color-border-light)',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        height: '30px',
                                        transition: 'all 0.2s'
                                      }}
                                      className="hover-lift"
                                      title="Di chuyển tệp vào/ra thư mục"
                                      onClick={() => setMovingFile(doc)}
                                    >
                                      <ArrowRightLeft size={13} /> Di chuyển
                                    </button>
                                    <button
                                      style={{
                                        background: 'rgba(100, 116, 139, 0.08)',
                                        color: 'var(--color-text-light)',
                                        border: '1px solid var(--color-border-light)',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        height: '30px',
                                        transition: 'all 0.2s'
                                      }}
                                      className="hover-lift"
                                      title="Đổi tên tài liệu"
                                      onClick={() => {
                                        const ext = doc.name.includes('.') ? doc.name.slice(doc.name.lastIndexOf('.')) : '';
                                        const baseName = ext ? doc.name.slice(0, doc.name.lastIndexOf('.')) : doc.name;
                                        showConfirm({
                                          title: 'Đổi tên tài liệu',
                                          message: `Nhập tên mới cho tài liệu "${doc.name}":`,
                                          requirePromptInput: true,
                                          promptPlaceholder: baseName,
                                          confirmText: 'Lưu',
                                          cancelText: 'Hủy',
                                          onConfirm: async (newName) => {
                                            if (newName && newName.trim()) {
                                              try {
                                                let finalName = newName.trim();
                                                if (ext && !finalName.toLowerCase().endsWith(ext.toLowerCase())) {
                                                  finalName += ext;
                                                }
                                                await api.put(`/cloud-files/${doc.id}`, { name: finalName, category: doc.category || 'general' });
                                                fetchData();
                                                addToast('Đã đổi tên tài liệu.', 'success');
                                              } catch (err) {
                                                addToast('Lỗi khi đổi tên tài liệu.', 'error');
                                              }
                                            }
                                          }
                                        });
                                      }}
                                    >
                                      <Pencil size={13} /> Đổi tên
                                    </button>
                                    <button
                                      style={{
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.15)',
                                        padding: '6px 10px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '30px',
                                        transition: 'all 0.2s'
                                      }}
                                      className="hover-lift"
                                      title="Xóa tài liệu"
                                      onClick={() => {
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
                                      }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Moving File CustomModal */}
                      {movingFile && (
                        <CustomModal
                          isOpen={!!movingFile}
                          onClose={() => setMovingFile(null)}
                          title={t('Di chuyển tài liệu')}
                          width="420px"
                        >
                          <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                              Chọn thư mục đích cho tài liệu <strong>{movingFile.name}</strong>:
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }} className="custom-scrollbar">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '10px', cursor: 'pointer' }}>
                                <input
                                  type="radio"
                                  name="destFolder"
                                  value="general"
                                  defaultChecked={movingFile.category === 'general' || !movingFile.category || !allFolders.includes(movingFile.category)}
                                />
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Thư mục gốc (Root)</span>
                              </label>
                              {allFolders.map(folder => (
                                <label key={folder} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '10px', cursor: 'pointer' }}>
                                  <input
                                    type="radio"
                                    name="destFolder"
                                    value={folder}
                                    defaultChecked={movingFile.category === folder}
                                  />
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>{folder}</span>
                                </label>
                              ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                              <button className="btn outline" onClick={() => setMovingFile(null)}>{t('Hủy')}</button>
                              <button
                                className="btn primary"
                                onClick={async () => {
                                  const selectedRadio = document.querySelector('input[name="destFolder"]:checked') as HTMLInputElement;
                                  if (selectedRadio) {
                                    const dest = selectedRadio.value;
                                    try {
                                      await api.put(`/cloud-files/${movingFile.id}`, { name: movingFile.name, category: dest });
                                      fetchData();
                                      addToast('Đã di chuyển tài liệu thành công.', 'success');
                                    } catch {
                                      addToast('Lỗi khi di chuyển tài liệu.', 'error');
                                    } finally {
                                      setMovingFile(null);
                                    }
                                  }
                                }}
                              >
                                {t('Xác nhận')}
                              </button>
                            </div>
                          </div>
                        </CustomModal>
                      )}
                    </div>
                  )}

                  {activeTab === 'invoices' && (
                    <div className="animate-fade">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Invoices</h3>
                        {!isViewer && (
                          <button 
                            className="btn primary sm" 
                            style={{ boxShadow: '0 4px 12px rgba(189, 29, 45, 0.2)' }}
                            onClick={() => { useUIStore.getState().setShowPOS(formData); }}
                          >
                            <Plus size={14} /> Tạo hóa đơn
                          </button>
                        )}
                      </div>
                      {loadingRelated ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                        </div>
                      ) : drawerInvoices.length === 0 ? (
                        <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                          <DollarSign size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                          <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa có hóa đơn</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '240px', margin: '0 auto' }}>Khách hàng này chưa phát sinh giao dịch thanh toán nào.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {/* Invoice Summary */}
                          <div style={{ display: 'grid', gridTemplateColumns: isMobileOrTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1rem' }}>
                            <div className="card-panel stat-card hover-lift" style={{ padding: '1rem 1.125rem', borderRadius: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden' }}>
                              <div className="decor-svg" style={{ color: 'var(--color-text-muted)' }}>
                                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                                  <rect x="25" y="25" width="50" height="50" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                                  <path d="M35 40 H 65 M 35 52 H 65 M 35 64 H 55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TỔNG HÓA ĐƠN</span>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <FileText size={16} />
                                </div>
                              </div>
                              <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(drawerInvoices.reduce((acc: number, inv: any) => acc + inv.total, 0))}
                              </h4>
                            </div>

                            <div className="card-panel stat-card hover-lift" style={{ padding: '1rem 1.125rem', borderRadius: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden' }}>
                              <div className="decor-svg" style={{ color: '#10b981' }}>
                                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                                  <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                                  <path d="M30 50 L 45 65 L 75 35" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ĐÃ THU</span>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <CheckCircle2 size={16} />
                                </div>
                              </div>
                              <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', margin: 0 }}>
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(drawerInvoices.filter((i: any) => i.status === 'paid').reduce((acc: number, inv: any) => acc + inv.total, 0))}
                              </h4>
                            </div>

                            <div className="card-panel stat-card hover-lift" style={{ padding: '1rem 1.125rem', borderRadius: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden' }}>
                              <div className="decor-svg" style={{ color: '#f59e0b' }}>
                                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                                  <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                                  <path d="M50 30 V 50 H 65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CHỜ XỬ LÝ</span>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Clock size={16} />
                                </div>
                              </div>
                              <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', margin: 0 }}>
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(drawerInvoices.filter((i: any) => i.status === 'pending').reduce((acc: number, inv: any) => acc + inv.total, 0))}
                              </h4>
                            </div>

                            <div className="card-panel stat-card hover-lift" style={{ padding: '1rem 1.125rem', borderRadius: '14px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden' }}>
                              <div className="decor-svg" style={{ color: '#ef4444' }}>
                                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                                  <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                                  <path d="M35 35 L 65 65 M 65 35 L 35 65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>QUÁ HẠN NỢ</span>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <AlertCircle size={16} />
                                </div>
                              </div>
                              <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', margin: 0 }}>
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(drawerInvoices.filter((i: any) => i.status === 'overdue' || (i.status === 'pending' && new Date(i.due_date) < new Date())).reduce((acc: number, inv: any) => acc + inv.total, 0))}
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
                        {!isViewer && (
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
                        )}
                      </div>

                      {loadingRelated ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                        </div>
                      ) : drawerQuotes.length === 0 ? (
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
                        {!isViewer && (
                          <button 
                            className="btn primary sm" 
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(189, 29, 45, 0.2)' }} 
                            onClick={() => setShowExpenseModal(true)}
                          >
                            <Plus size={14} /> Nhập chi phí
                          </button>
                        )}
                      </div>
                      {loadingRelated ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                        </div>
                      ) : drawerExpenses.length > 0 ? (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                          {drawerExpenses.map((exp: any) => (
                            <div 
                              key={exp.id} 
                              className="card-panel" 
                              onClick={() => setViewExpense(exp)} 
                              style={{ 
                                padding: '1rem', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                cursor: 'pointer', 
                                transition: 'all 0.2s',
                                border: '1px solid transparent'
                              }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary-light)'}
                              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                            >
                              <div>
                                <h4 style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '4px' }}>{exp.title}</h4>
                                <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)', alignItems: 'center' }}>
                                  <span className="badge info">{exp.category}</span>
                                  <span>{new Date(exp.date).toLocaleDateString('vi-VN')}</span>
                                  <span>Tạo bởi: {exp.creator_name}</span>
                                  {exp.is_refunded && exp.refund_image_url && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 700 }} title="Có ảnh hoàn tiền">
                                      <Paperclip size={12} /> Ảnh hoàn tiền
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ef4444' }}>
                                  -{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(exp.split_amount || exp.amount)}
                                </div>
                                {exp.split_amount && exp.split_amount !== exp.amount && (
                                  <div style={{ fontSize: '0.675rem', color: 'var(--color-text-muted)' }}>
                                    (Chia từ tổng {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(exp.amount)})
                                  </div>
                                )}
                                <span className={`badge ${exp.status === 'approved' ? (exp.is_refunded ? 'info' : 'success') : exp.status === 'rejected' ? 'danger' : 'warning'}`} style={{ marginTop: '4px', fontSize: '0.7rem' }}>
                                  {exp.status === 'approved' ? (exp.is_refunded ? 'Đã hoàn tiền' : 'Đã duyệt') : exp.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
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
                        {!isViewer && (
                          <button className="btn outline sm" onClick={() => setShowTicketModal(true)}>
                            <Plus size={14} /> Tạo Ticket
                          </button>
                        )}
                      </div>
                      {loadingRelated ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                        </div>
                      ) : drawerTickets.length === 0 ? (
                        <div className="card-panel" style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--color-border-light)', borderRadius: '24px' }}>
                          <LifeBuoy size={48} style={{ color: 'var(--color-border)', margin: '0 auto 1.5rem', opacity: 0.4 }} />
                          <h4 style={{ fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>Chưa có ticket hỗ trợ</h4>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '340px', margin: '0 auto' }}>
                            {['ca_nhan', 'cold_call', 'gioi_thieu'].includes(formData.source || contact?.source) || (formData.dl_status || contact?.dl_status) === 'databank_claim'
                              ? t('Khách hàng tự nhập hoặc nhận từ Databank không hỗ trợ báo lỗi/yêu cầu bù data. Bạn vẫn có thể gửi ticket hỗ trợ kỹ thuật.')
                              : t('Hiện tại không có yêu cầu hỗ trợ nào đang chờ xử lý cho khách hàng này.')
                            }
                          </p>
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
                  </motion.div>
                )}
              </AnimatePresence>
              </>
            )}
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
              user_id: currentUser?.id,
              due_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
              done_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
            });



            addToast('Đã ghi nhận cuộc gọi và thêm vào Timeline', 'success');
            fetchData();
            window.dispatchEvent(new CustomEvent('contact-updated'));
          } catch (err: any) {
            addToast(err.response?.data?.message || 'Lỗi khi lưu nhật ký cuộc gọi', 'error');
          }
        }}
      />
      <ActivityModal
        isOpen={showActivityModal}
        onClose={() => { setShowActivityModal(false); setEditingActivity(null); }}
        entityType="contact"
        entityId={contact?.id}
        onSuccess={() => {
          fetchData();
          window.dispatchEvent(new CustomEvent('contact-updated'));
        }}
        userId={currentUser?.id || contact?.owner_id}
        activity={editingActivity}
      />

      {/* PROOF UPLOAD MODAL FOR MEETING COMPLETION */}
      <AnimatePresence>
        {meetingToComplete && (
          <div className="overlay-backdrop" style={{ zIndex: 1000020, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setMeetingToComplete(null)}>
            <motion.div 
              className="modal-sheet" 
              style={{ width: '100%', maxWidth: 500, padding: '1.5rem', borderRadius: '16px', overflow: 'hidden', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              initial={{ opacity: 0, y: 20, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera style={{ color: '#10b981' }} />
                  Cung cấp ảnh minh chứng
                </h3>
                <button className="btn-icon sm ghost" onClick={() => setMeetingToComplete(null)}><X size={16} /></button>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Gặp gỡ này chưa có ảnh đính kèm trong phần bình luận. Bạn phải tải lên ảnh minh chứng (chụp ảnh cùng khách hàng, sa bàn, v.v.) để hoàn thành cuộc gặp.
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Ảnh minh chứng *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {proofImagePreview ? (
                    <div style={{ position: 'relative', width: '100%', height: '180px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                      <img src={proofImagePreview} alt="Proof preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button 
                        onClick={() => {
                          setProofImageFile(null);
                          setProofImagePreview(null);
                        }}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '120px', border: '2px dashed var(--color-border)', borderRadius: '10px', cursor: 'pointer', background: 'var(--color-bg)', transition: 'border-color 0.2s' }} className="hover-lift">
                      <Camera size={28} style={{ color: 'var(--color-text-muted)', marginBottom: '6px' }} />
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Tải ảnh lên (JPEG, PNG, WebP)</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            addToast('Dung lượng tệp đính kèm không được vượt quá 5MB', 'error');
                            return;
                          }
                          const previewUrl = URL.createObjectURL(file);
                          setProofImageFile(file);
                          setProofImagePreview(previewUrl);
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Nội dung bình luận</label>
                <textarea
                  className="input w-full"
                  value={proofCommentText}
                  onChange={(e) => setProofCommentText(e.target.value)}
                  placeholder="Nhập ghi chú hoặc mô tả về buổi gặp gỡ..."
                  style={{ minHeight: '80px', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn outline" onClick={() => setMeetingToComplete(null)} disabled={completingMeeting}>Hủy</button>
                <button 
                  className="btn success" 
                  disabled={!proofImageFile || completingMeeting} 
                  onClick={async () => {
                    if (!proofImageFile || !meetingToComplete) return;
                    setCompletingMeeting(true);
                    try {
                      let fileToUpload = proofImageFile;
                      if (proofImageFile.type.startsWith('image/')) {
                        fileToUpload = await compressToWebP(proofImageFile);
                      }
                      const fd = new FormData();
                      fd.append('file', fileToUpload);
                      const uploadRes = await api.post('/upload', fd, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      const uploadedUrl = uploadRes.data.data?.url ?? '';
                      if (!uploadedUrl) throw new Error('Không thể tải ảnh lên');

                      // Post comment
                      const payload = {
                        content: proofCommentText,
                        attachments: [uploadedUrl],
                        parent_id: null
                      };
                      await api.post(`/activities/${meetingToComplete.id}/comments`, payload);

                      // Complete activity
                      await api.put(`/activities/${meetingToComplete.id}`, { status: 'done' });

                      addToast('Đã tải ảnh minh chứng và hoàn thành gặp gỡ', 'success');
                      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });

                      // Update local state
                      setDrawerActivities(prev => prev.map(a => a.id === meetingToComplete.id ? { ...a, status: 'done' } : a));
                      setTasks(prev => prev.filter(a => a.id !== meetingToComplete.id));

                      setMeetingToComplete(null);
                      fetchData();
                    } catch (e: any) {
                      addToast(e.response?.data?.message || 'Có lỗi xảy ra khi lưu minh chứng', 'error');
                    } finally {
                      setCompletingMeeting(false);
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {completingMeeting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      Hoàn thành
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD/EDIT NOTE MODAL */}
      <AnimatePresence>
        {showNoteModal && (
          <div className="overlay-backdrop" style={{ zIndex: 1000020, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setShowNoteModal(false); setEditingNote(null); }}>
            <motion.div 
              className="modal-sheet" 
              style={{ width: '100%', maxWidth: 780, padding: 0, borderRadius: '12px', overflow: 'hidden' }}
              initial={{ opacity: 0, y: 20, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{editingNote ? 'Chỉnh sửa ghi chú' : 'Thêm ghi chú mới'}</h3>
                <button className="btn-icon-bare" onClick={() => { setShowNoteModal(false); setEditingNote(null); }}><X size={20}/></button>
              </div>
              
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
                {!editingNote && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {/* Left Column: Interaction & Temp */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Channel Selector */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                          Kênh tương tác (Nối)
                        </label>
                        <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                          {['text', 'call', 'meet'].map((ch: any) => (
                            <button
                              key={ch}
                              type="button"
                              onClick={() => setNoteChannel(ch)}
                              style={{
                                flex: 1, padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, border: 'none', borderRadius: '6px', cursor: 'pointer',
                                background: noteChannel === ch ? 'var(--color-surface)' : 'transparent',
                                color: noteChannel === ch ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                boxShadow: noteChannel === ch ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 0.2s',
                                outline: 'none'
                              }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%' }}>
                                {ch === 'text' ? <PenTool size={13} /> : ch === 'call' ? <Phone size={13} /> : <Users size={13} />}
                                <span>{ch === 'text' ? 'Nối Đất' : ch === 'call' ? 'Nối Đồng' : 'Nối Áp Suất'}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Type Selector & Call Duration */}
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                            Loại tương tác
                          </label>
                          <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                            {['normal', 'quality'].map((t: any) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setNoteType(t)}
                                style={{
                                  flex: 1, padding: '8px 10px', fontSize: '0.75rem', fontWeight: 700, border: 'none', borderRadius: '6px', cursor: 'pointer',
                                  background: noteType === t ? 'var(--color-surface)' : 'transparent',
                                  color: noteType === t ? (t === 'quality' ? 'var(--color-success)' : 'var(--color-text)') : 'var(--color-text-muted)',
                                  boxShadow: noteType === t ? 'var(--shadow-sm)' : 'none',
                                  transition: 'all 0.2s',
                                  outline: 'none'
                                }}
                              >
                                {t === 'normal' ? 'Thường' : 'Chất lượng'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {noteChannel === 'call' && (
                          <div style={{ width: '140px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                              Thời lượng (giây)
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="Ví dụ: 45"
                              value={noteDuration}
                              onChange={e => setNoteDuration(e.target.value)}
                              style={{ height: '38px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.8125rem', background: 'var(--color-surface)', color: 'var(--color-text)', width: '100%', padding: '0 12px', outline: 'none' }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Temperature Selector */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                          Nhiệt độ khách hàng (Sale chốt)
                        </label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {[
                            { id: 'cold', label: 'Lạnh', color: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
                            { id: 'cool', label: 'Nguội', color: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)', text: 'var(--color-success)' },
                            { id: 'neutral', label: 'Ấm', color: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.2)', text: 'var(--color-warning)' },
                            { id: 'warm', label: 'Nóng', color: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', text: 'var(--color-danger)' },
                            { id: 'hot', label: 'Sôi', color: 'rgba(185, 28, 28, 0.1)', border: 'rgba(185, 28, 28, 0.2)', text: '#b91c1c' }
                          ].map(item => {
                            const isSelected = noteSaleTemp === item.id || (noteSaleTemp === '' && calculatedSuggestedTemp === item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setNoteSaleTemp(item.id as any)}
                                style={{
                                  padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s',
                                  background: isSelected ? item.color : 'var(--color-bg)',
                                  color: isSelected ? item.text : 'var(--color-text-muted)',
                                  border: `1px solid ${isSelected ? item.border : 'var(--color-border-light)'}`,
                                  boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                                  outline: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span>{item.label}</span>
                                {calculatedSuggestedTemp === item.id && (
                                  <span style={{ fontSize: '0.6rem', background: 'rgba(100, 116, 139, 0.2)', padding: '1px 4px', borderRadius: '8px', color: 'var(--color-text)' }}>
                                    Máy đoán
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Docs & Obstacles */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Documents Sent */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                          Tài liệu đã gửi (Chọn tài liệu)
                        </label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                                  padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s',
                                  background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--color-bg)',
                                  color: isSelected ? '#3b82f6' : 'var(--color-text-muted)',
                                  border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.3)' : 'var(--color-border-light)'}`,
                                  boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                                  outline: 'none'
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
                              placeholder="Nhập tên tài liệu khác (ngăn cách bằng dấu phẩy)..."
                              value={customDocs}
                              onChange={e => setCustomDocs(e.target.value)}
                              style={{ height: '36px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.8125rem', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '0 12px', width: '100%', outline: 'none' }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Obstacles */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                          Khách đang vướng ở đâu?
                        </label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {[
                            { id: 'trust', label: '🧑 Chưa tin mình', color: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', text: 'var(--color-danger)' },
                            { id: 'project', label: '🏙️ Chưa ưng dự án', color: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', text: 'var(--color-warning)' },
                            { id: 'unit', label: '🏠 Chưa chọn căn', color: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
                            { id: 'smooth', label: '✓ Đang xuôi', color: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.2)', text: 'var(--color-success)' },
                            { id: 'other', label: '➕ Khác', color: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.2)', text: '#8b5cf6' }
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
                                  boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                                  outline: 'none'
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
                              style={{ height: '36px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.8125rem', background: 'var(--color-surface)', color: 'var(--color-text)', padding: '0 12px', width: '100%', outline: 'none' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggestion Alert */}
                {!editingNote && noteObstacle && (
                  <div style={{
                    background: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(234, 179, 8, 0.04)' : '#fefcbf8a',
                    borderLeft: '4px solid #eab308',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    boxShadow: 'var(--shadow-sm)',
                    borderTop: '1px solid var(--color-border-light)',
                    borderRight: '1px solid var(--color-border-light)',
                    borderBottom: '1px solid var(--color-border-light)'
                  }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lightbulb size={13} style={{ color: '#eab308' }} />
                      {'Toa gợi ý hành động (Sổ tay Richland):'}
                    </span>
                    <span style={{ lineHeight: 1.45 }}>
                      {noteObstacle === 'trust' && 'Áp dụng nguyên liệu [Phòng Bếp] (Xây dựng uy tín cá nhân, chia sẻ kiến thức chuyên sâu và hỗ trợ tận tâm để khách hàng tin tưởng hơn).'}
                      {noteObstacle === 'project' && 'Áp dụng nguyên liệu [Nước Sôi] + [Than so sánh] (Gửi bảng so sánh trực quan với đối thủ, nhấn mạnh lợi thế độc bản của dự án).'}
                      {noteObstacle === 'unit' && 'Áp dụng nguyên liệu [Than chốt cá nhân hóa] + [Oxy] (Gửi phân tích dòng tiền căn tiềm năng nhất, tạo độ khan hiếm cho giỏ hàng độc quyền).'}
                      {noteObstacle === 'smooth' && 'Khách hàng đang thuận lợi. Hãy duy trì tương tác đều đặn để chuẩn bị dẫn khách đi xem dự án thực tế hoặc đặt booking giữ chỗ.'}
                    </span>
                  </div>
                )}

                {/* Note Body Text Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Nội dung chi tiết tương tác
                  </label>
                  <MentionInput
                    value={newNote || ''}
                    onChange={e => setNewNote(e.target.value)}
                    onImagePaste={(file: File) => {
                      if (file.size > 10 * 1024 * 1024) {
                        addToast('Dung lượng tệp đính kèm không được vượt quá 10MB', 'error');
                        return;
                      }
                      const previewUrl = URL.createObjectURL(file);
                      setNoteAttachmentFile(file);
                      setNoteAttachmentPreview(previewUrl);
                      addToast('Đã dán tệp đính kèm từ clipboard!', 'success');
                    }}
                    onFilePaste={(file: File) => {
                      if (file.size > 10 * 1024 * 1024) {
                        addToast('Dung lượng tệp đính kèm không được vượt quá 10MB', 'error');
                        return;
                      }
                      const previewUrl = URL.createObjectURL(file);
                      setNoteAttachmentFile(file);
                      setNoteAttachmentPreview(previewUrl);
                      addToast('Đã dán tệp đính kèm từ clipboard!', 'success');
                    }}
                    placeholder="Nhập ghi chú phản hồi khách hàng (Dán ảnh trực tiếp Ctrl+V)..."
                    style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.875rem', lineHeight: 1.6, resize: 'vertical', minHeight: 120, color: 'var(--color-text)', outline: 'none', background: 'var(--color-surface)' }}
                  />
                </div>

                {!editingNote && (
                  /* Note Attachment */
                  <div>
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
                            if (noteAttachmentPreview) { URL.revokeObjectURL(noteAttachmentPreview); }
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
                          id="note-file-upload-modal"
                          style={{ display: 'none' }}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv,image/*"
                          onChange={handleNoteAttachmentUpload}
                          disabled={isSubmitting}
                        />
                        <label htmlFor="note-file-upload-modal" className="btn outline sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', borderRadius: '20px' }}>
                          <Paperclip size={14} />
                          Đính kèm tài liệu
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn outline lg" onClick={() => { setShowNoteModal(false); setEditingNote(null); }} disabled={isSubmitting}>Hủy bỏ</button>
                <button type="button" className="btn primary lg" onClick={async () => {
                  if (editingNote) {
                    setIsSubmitting(true);
                    try {
                      await api.put(`/notes/${editingNote.id}`, { body: newNote });
                      addToast('Cập nhật ghi chú thành công!', 'success');
                      setShowNoteModal(false);
                      setEditingNote(null);
                      setNewNote('');
                      fetchData();
                      window.dispatchEvent(new CustomEvent('contact-updated'));
                    } catch (e: any) {
                      addToast('Lỗi khi cập nhật ghi chú', 'error');
                    } finally {
                      setIsSubmitting(false);
                    }
                  } else {
                    await addNote();
                    setShowNoteModal(false);
                  }
                }} disabled={isSubmitting || !newNote.trim()}>
                  {isSubmitting ? 'Đang lưu...' : 'Lưu ghi chú'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pipelineModal.isOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000020, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(4px)' }}
              onClick={() => setPipelineModal({ ...pipelineModal, isOpen: false })}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ position: 'relative', background: 'var(--color-surface)', width: '90%', maxWidth: '550px', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button className="btn outline" onClick={() => setPipelineModal({ ...pipelineModal, isOpen: false })}>Hủy</button>
                <button
                  className="btn primary"
                  disabled={isSubmitting || !pipelineModal.note.trim()}
                  onClick={async () => {
                    if (isSubmitting) return;
                    setIsSubmitting(true);
                    
                    const targetId = pipelineModal.targetId;   // string, e.g. 'chua_xac_dinh' or 'dong_y_gap'
                    const targetLabel = pipelineModal.targetLabel;
                    const note = pipelineModal.note;
                    
                    if (targetId === 'dat_coc' || targetId === 'da_coc') {
                      setDepositProjectId('');
                      setDepositUnitCode('');
                      const defaultPrice = String(formData.expected_revenue || contact?.expected_revenue || '');
                      setDepositPrice(defaultPrice);
                      setDepositExpectedCommission('');
                      setCommissionType('amount');
                      setCommissionPercent('');
                      setDepositMilestones([{ name: 'Đợt 1 - Cọc giữ chỗ', amount: '' }]);
                      setPipelineModal({ isOpen: false, targetId: '', targetLabel: '', note: '' });
                      setPendingPipelineTransition({ targetId, targetLabel, note });
                      setShowDealModal(true);
                      setIsSubmitting(false);
                      return;
                    }
                    
                    if (coopEligibleStatuses.includes(targetId)) {
                      try {
                        const docsRes = await api.get(`/cloud-files?contact_id=${contact.id}&limit=1000`);
                        const currentCloudFiles = docsRes.data.data?.items || [];
                        const coopFiles = coopSlip?.attachment_url ? coopSlip.attachment_url.split(',') : [];
                        
                        const missingFiles: string[] = [];
                        if (coopDefaultFiles && coopDefaultFiles.length > 0) {
                          for (const mandatoryFile of coopDefaultFiles) {
                            const cleanKeyword = mandatoryFile.split('.')[0].toLowerCase().trim();
                            if (!cleanKeyword) continue;
                            
                            let hasFile = currentCloudFiles.some((f: any) => {
                              const lower = f.name.toLowerCase();
                              if (cleanKeyword === 'unc' || cleanKeyword === 'uy nhiem chi' || cleanKeyword === 'ủy nhiệm chi') {
                                return lower.includes('unc') || lower.includes('uy nhiem chi') || lower.includes('ủy nhiệm chi');
                              }
                              return lower.includes(cleanKeyword);
                            });
                            
                            if (!hasFile) {
                              hasFile = coopFiles.some((f: string) => {
                                const filename = f.split('/').pop() || '';
                                const lower = filename.toLowerCase();
                                if (cleanKeyword === 'unc' || cleanKeyword === 'uy nhiem chi' || cleanKeyword === 'ủy nhiệm chi') {
                                  return lower.includes('unc') || lower.includes('uy nhiem chi') || lower.includes('ủy nhiệm chi');
                                }
                                return lower.includes(cleanKeyword);
                              });
                            }
                            
                            if (!hasFile) {
                              missingFiles.push(mandatoryFile);
                            }
                          }
                        }
                        
                        if (missingFiles.length > 0) {
                          setPipelineModal({ isOpen: false, targetId: '', targetLabel: '', note: '' });
                          setRequiredDocsUploadModal({
                            isOpen: true,
                            missingFiles,
                            targetId,
                            targetLabel,
                            note,
                            uploadedFiles: {},
                            isUploading: {}
                          });
                          return;
                        }
                      } catch (err) {
                        addToast('Lỗi khi kiểm tra tài liệu bắt buộc hợp tác.', 'error');
                        return;
                      } finally {
                        setIsSubmitting(false);
                      }
                    }
                    
                    try {
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

                      // Persist status change
                      await api.put(`/contacts/${contact.id}`, { 
                        pipeline_status: targetId, 
                        status: calculatedStatus,
                        ttl1_completed: formData.ttl1_completed,
                        ttl1_data: formData.ttl1_data
                      });
                      // Log status transition in activities (Nhật ký tương tác)
                      await api.post('/activities', {
                        type: 'note',
                        subject: `Chuyển trạng thái Pipeline → ${targetLabel}`,
                        body: note || null,
                        status: 'done',
                        related_type: 'contact',
                        related_id: contact.id,
                        contact_id: contact.id,
                        user_id: currentUser?.id,
                        due_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
                        done_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                      });
                      fetchData();
                      addToast(`Đã cập nhật Pipeline thành ${targetLabel}`, 'success');
                      window.dispatchEvent(new CustomEvent('contact-updated'));
                    } catch (e: any) {
                      // Rollback optimistic update
                      setFormData((prev: any) => ({ 
                        ...prev, 
                        pipeline_status: contact.pipeline_status, 
                        status: contact.status 
                      }));
                      addToast(e?.response?.data?.message || 'Lỗi khi cập nhật Pipeline', 'error');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}

                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu cập nhật'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {requiredDocsUploadModal.isOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000020, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(4px)' }}
              onClick={() => setRequiredDocsUploadModal(prev => ({ ...prev, isOpen: false }))}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ position: 'relative', background: 'var(--color-surface)', width: '95%', maxWidth: '500px', borderRadius: 'var(--radius-md)', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', color: 'var(--color-danger)' }}>
                <ShieldAlert size={20} />
                <h3 style={{ fontWeight: 700, fontSize: '1.125rem', margin: 0 }}>Tải lên tài liệu bắt buộc</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Trạng thái <strong style={{ color: 'var(--color-primary)' }}>{requiredDocsUploadModal.targetLabel}</strong> yêu cầu các tài liệu hợp tác sau đây. Vui lòng tải lên đầy đủ để hoàn tất việc chuyển trạng thái.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {requiredDocsUploadModal.missingFiles.map((file, idx) => {
                  const isUploaded = requiredDocsUploadModal.uploadedFiles[file];
                  const isUploading = requiredDocsUploadModal.isUploading[file];
                  return (
                    <div key={file} style={{ 
                      padding: '12px', 
                      background: 'var(--color-bg)', 
                      border: `1px dashed ${isUploaded ? 'var(--color-success)' : 'var(--color-border)'}`, 
                      borderRadius: '8px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <FileText size={18} style={{ color: isUploaded ? 'var(--color-success)' : 'var(--color-text-muted)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file}
                        </span>
                      </div>
                      
                      <div>
                        {isUploaded ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={14} /> Đã tải
                          </span>
                        ) : isUploading ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                            Đang tải...
                          </span>
                        ) : (
                          <label className="btn outline sm" style={{ cursor: 'pointer', margin: 0, padding: '4px 10px', fontSize: '0.75rem' }}>
                            Tải lên
                            <input
                              type="file"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  await handleUploadRequiredDoc(file, f);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button className="btn outline" onClick={() => setRequiredDocsUploadModal(prev => ({ ...prev, isOpen: false }))}>Hủy bỏ</button>
                <button 
                  className="btn primary" 
                  disabled={!requiredDocsUploadModal.missingFiles.every(f => requiredDocsUploadModal.uploadedFiles[f])}
                  onClick={handleCompleteTransitionWithDocs}
                >
                  Hoàn tất & Chuyển
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE DEPOSIT MODAL */}
      <AnimatePresence>
        {showDealModal && (
          <div className="overlay-backdrop" style={{ zIndex: 1000020 }}>
            <motion.div
              className="modal-sheet"
              style={{ width: '100%', maxWidth: 820, position: 'relative' }}
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
            >
              {isSubmitting && (() => {
                const ownerId = String(contact?.owner_id || formData?.owner_id || currentUser?.id || '');
                const collabList = getCoopCollaboratorIds();
                
                const mainSaleUser = salesUsers.find(u => String(u.id) === ownerId) || users.find(u => String(u.id) === ownerId) || currentUser;
                const coopSaleUsers = collabList.map(uid => salesUsers.find(u => String(u.id) === String(uid)) || users.find(u => String(u.id) === String(uid))).filter(Boolean);
                const hasCoop = coopSaleUsers.length > 0;

                return (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'var(--color-surface)',
                    opacity: 0.98,
                    backdropFilter: 'blur(10px)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '24px',
                    borderRadius: '16px',
                    padding: '2rem'
                  }}>
                    <style>{`
                      @keyframes flowDash {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(300%); }
                      }
                      @keyframes progressBar {
                        0% { width: 0%; }
                        50% { width: 70%; }
                        100% { width: 100%; }
                      }
                      @keyframes pulseSlow {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.15); opacity: 0.85; }
                      }
                      .flow-dash {
                        animation: flowDash 1.5s infinite linear;
                      }
                      .progress-bar-fill {
                        animation: progressBar 3s infinite ease-in-out;
                      }
                      .pulse-slow {
                        animation: pulseSlow 2s infinite ease-in-out;
                      }
                    `}</style>

                    {/* Avatars Connection Animation */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
                      {/* Main Sale */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          position: 'relative',
                          padding: '4px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--color-primary) 0%, #ff4d61 100%)',
                          boxShadow: '0 4px 12px rgba(189, 29, 45, 0.25)'
                        }}>
                          <Avatar src={mainSaleUser?.avatar_url || mainSaleUser?.avatar} name={mainSaleUser?.full_name || mainSaleUser?.name || 'Sale'} size={60} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text)', maxWidth: '90px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {mainSaleUser?.full_name || mainSaleUser?.name || 'Sale'}
                        </span>
                      </div>

                      {/* Connection Link */}
                      {hasCoop && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '80px', position: 'relative' }}>
                          {/* Animated connection dash */}
                          <div style={{
                            width: '100%',
                            height: '3px',
                            background: 'var(--color-primary)',
                            borderRadius: '2px',
                            position: 'relative',
                            overflow: 'hidden'
                          }}>
                            <div className="flow-dash" style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              height: '100%',
                              width: '30px',
                              background: '#ffffff',
                              opacity: 0.8,
                              borderRadius: '50%'
                            }} />
                          </div>
                          {/* Center link icon */}
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-surface)',
                            border: '2.5px solid var(--color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-primary)',
                            boxShadow: 'var(--shadow-sm)'
                          }}>
                            <Link2 size={14} className="pulse-slow" />
                          </div>
                        </div>
                      )}

                      {/* Coop Sale(s) */}
                      {hasCoop && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {coopSaleUsers.slice(0, 3).map((collab, cIdx) => (
                            <div key={cIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                position: 'relative',
                                padding: '4px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--color-primary) 0%, #ff4d61 100%)',
                                boxShadow: '0 4px 12px rgba(189, 29, 45, 0.25)'
                              }}>
                                <Avatar src={collab?.avatar_url || collab?.avatar} name={collab?.full_name || collab?.name || 'Sale'} size={60} />
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text)', maxWidth: '90px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {collab?.full_name || collab?.name || 'Co.op'}
                              </span>
                            </div>
                          ))}
                          {coopSaleUsers.length > 3 && (
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-bg-light)',
                              border: '1px solid var(--color-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: 'var(--color-text-muted)'
                            }}>
                              +{coopSaleUsers.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Progress Bar & Status Text */}
                    <div style={{ width: '100%', maxWidth: '340px', textAlign: 'center', marginTop: '10px' }}>
                      <h4 style={{ fontWeight: 800, color: 'var(--color-text)', margin: '0 0 6px 0', fontSize: '1rem' }}>
                        Đang khởi tạo hợp tác
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0 0 14px 0', lineHeight: 1.4, fontWeight: 500 }}>
                        {hasCoop 
                          ? 'Đang tạo phiếu đặt cọc và tự động liên kết tạo phiếu hợp tác chia hoa hồng...' 
                          : 'Đang xử lý tạo phiếu đặt cọc giao dịch...'}
                      </p>

                      {/* Progress Bar */}
                      <div style={{
                        width: '100%',
                        height: '6px',
                        backgroundColor: 'var(--color-border-light)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <div className="progress-bar-fill" style={{
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--color-primary) 0%, #ff4d61 100%)',
                          borderRadius: '10px'
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800 }}>Tạo phiếu đặt cọc mới</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Thiết lập thông tin giao dịch đặt cọc dự án</p>
                  </div>
                </div>
                <button className="btn-icon sm" onClick={() => setShowDealModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1.5rem' }}>
                
                {/* Client Banner */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'linear-gradient(135deg, rgba(163, 20, 34, 0.05) 0%, rgba(163, 20, 34, 0.01) 100%)', borderRadius: '12px', border: '1px dashed var(--color-primary-light)', marginBottom: '1.5rem' }}>
                  <Avatar name={fullName} size={40} />
                  <div>
                    <h4 style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.925rem', margin: 0 }}>{fullName}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                      {contact?.phone} {contact?.email ? `• ${contact.email}` : ''}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.75rem' }}>
                  {/* Left Column: Project & Price */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700 }}>Dự án giao dịch *</label>
                      <CustomSelect
                        searchable
                        options={projectsList.map(p => ({
                          value: String(p.id),
                          label: p.name
                        }))}
                        value={depositProjectId}
                        onChange={val => setDepositProjectId(val.toString())}
                        placeholder="-- Chọn dự án --"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700 }}>Mã căn hộ/Lô đất *</label>
                      <input
                        type="text"
                        placeholder="VD: A-12.05, LK-04..."
                        value={depositUnitCode}
                        onChange={e => setDepositUnitCode(e.target.value.toUpperCase())}
                        className="form-input"
                        style={{ fontWeight: 600 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700 }}>Doanh thu dự kiến (Giá bán) *</label>
                      <CurrencyInput
                        value={depositPrice}
                        onChange={val => setDepositPrice(String(val))}
                        placeholder="Nhập giá trị giao dịch..."
                        showTextHelper={true}
                      />
                    </div>
                  </div>

                  {/* Right Column: Commission & Proof */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingLeft: '1.5rem', borderLeft: '1px solid var(--color-border-light)' }}>
                    <div className="form-group">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>Hoa hồng dự kiến</label>
                        <div style={{ display: 'inline-flex', background: 'var(--color-bg)', padding: '2px', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                          <button
                            type="button"
                            onClick={() => setCommissionType('percent')}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: 'none',
                              background: commissionType === 'percent' ? 'var(--color-surface)' : 'transparent',
                              color: commissionType === 'percent' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              cursor: 'pointer',
                              boxShadow: commissionType === 'percent' ? 'var(--shadow-sm)' : 'none'
                            }}
                          >
                            % Phần trăm
                          </button>
                          <button
                            type="button"
                            onClick={() => setCommissionType('amount')}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: 'none',
                              background: commissionType === 'amount' ? 'var(--color-surface)' : 'transparent',
                              color: commissionType === 'amount' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              cursor: 'pointer',
                              boxShadow: commissionType === 'amount' ? 'var(--shadow-sm)' : 'none'
                            }}
                          >
                            Số tiền (VND)
                          </button>
                        </div>
                      </div>

                      {commissionType === 'percent' ? (
                        <div>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Ví dụ: 2.5"
                              value={commissionPercent}
                              onChange={e => setCommissionPercent(e.target.value)}
                              className="form-input"
                              style={{ paddingRight: '35px', fontWeight: 600 }}
                            />
                            <span style={{ position: 'absolute', right: 12, fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>%</span>
                          </div>
                          {depositExpectedCommission && Number(depositExpectedCommission) > 0 && (
                            <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                              = {Number(depositExpectedCommission).toLocaleString()} VND
                            </div>
                          )}
                        </div>
                      ) : (
                        <CurrencyInput
                          value={depositExpectedCommission}
                          onChange={val => setDepositExpectedCommission(String(val))}
                          placeholder="Nhập số tiền hoa hồng..."
                          showTextHelper={true}
                        />
                      )}
                    </div>

                    {/* Phase 1 UNC upload */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.12)', borderRadius: '10px', marginTop: 'auto' }}>
                      <label className="form-label" style={{ fontWeight: 700, margin: 0, fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Minh chứng chuyển tiền Đợt 1 (UNC) <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                        <label
                          className="btn outline sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', height: '32px', fontSize: '0.75rem', borderRadius: '8px' }}
                        >
                          <Upload size={13} /> {depositUncFile ? 'Chọn lại tệp' : 'Chọn ảnh UNC'}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={e => {
                              if (e.target.files && e.target.files.length > 0) {
                                setDepositUncFile(e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                        {depositUncFile ? (
                          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                            ✓ {depositUncFile.name}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            Yêu cầu bắt buộc 1 UNC
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Milestones config */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border-light)', marginTop: '1.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Lịch trình thanh toán cọc</h4>
                      <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        (Tổng tiền các đợt cọc có thể nhỏ hơn doanh thu dự kiến)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMilestoneInput}
                      style={{ fontSize: '0.75rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}
                    >
                      <Plus size={14} /> Thêm đợt thanh toán
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {depositMilestones.map((m, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                          type="text"
                          required
                          placeholder={`Tên đợt ${idx + 1} (VD: Đợt 1 - Cọc giữ chỗ)`}
                          value={m.name}
                          onChange={e =>
                            setDepositMilestones(prev =>
                              prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                            )
                          }
                          className="form-input"
                          style={{ flex: 1 }}
                        />
                        <div style={{ width: '220px', flexShrink: 0 }}>
                          <CurrencyInput
                            value={m.amount}
                            required
                            onChange={val =>
                              setDepositMilestones(prev =>
                                prev.map((item, i) => (i === idx ? { ...item, amount: String(val) } : item))
                              )
                            }
                            placeholder="Số tiền (VND)"
                            showTextHelper={false}
                          />
                        </div>
                        {depositMilestones.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMilestoneInput(idx)}
                            style={{ padding: '8px', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', borderRadius: '50%' }}
                            className="btn-icon sm"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Multi-sale Co-op Commission Allocation Section */}
                {(() => {
                  const ownerId = String(contact?.owner_id || formData?.owner_id || currentUser?.id || '');
                  const collabList = getCoopCollaboratorIds();
                  const hasCoopSales = collabList.length > 0;
                  if (!hasCoopSales) return null;

                  const allUids = Array.from(new Set([ownerId, ...collabList].filter(Boolean)));
                  const expCommission = parseFloat(depositExpectedCommission) || 0;
                  const totalPctSum = Object.values(depositCoopShares).reduce((a, b) => a + (parseFloat(b) || 0), 0);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border-light)', marginTop: '1.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Users size={16} style={{ color: 'var(--color-primary)' }} />
                            Phân chia hoa hồng Sale Hợp tác (Co-care)
                          </h4>
                          <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                            Nhập tỷ lệ % để tự động khởi tạo phiếu hợp tác hoặc chọn chuyển cọc không tạo phiếu hợp tác.
                          </p>
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                          {totalPctSum === 100 ? (
                            <span style={{ color: '#10b981' }}>✓ Tổng 100%</span>
                          ) : (
                            <span style={{ color: '#ef4444' }}>
                              Tổng: {totalPctSum}% (Cần đúng 100%)
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {allUids.map(uid => {
                          const uObj = salesUsers.find(u => String(u.id) === String(uid)) || users.find(u => String(u.id) === String(uid));
                          const uName = uObj?.full_name || uObj?.name || (uid === ownerId ? 'Sale chính' : `Sale ID #${uid}`);
                          const uAvatar = uObj?.avatar_url || uObj?.avatar;
                          const isOwner = String(uid) === ownerId;
                          const pctVal = depositCoopShares[uid] || '0';
                          const calcVnd = Math.round((expCommission * (parseFloat(pctVal) || 0)) / 100);

                          return (
                            <div key={uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-bg-light)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                <Avatar src={uAvatar} name={uName} size={32} />
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {uName}
                                    </span>
                                    <span className={`badge ${isOwner ? 'primary' : 'info'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                      {isOwner ? 'Sale chính' : 'Sale Co.op'}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.725rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: '2px' }}>
                                    Hoa hồng dự kiến: {calcVnd > 0 ? `${calcVnd.toLocaleString('vi-VN')} VND` : '0 VND'}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={pctVal}
                                  onChange={e => {
                                    const newVal = e.target.value;
                                    setDepositCoopShares(prev => ({ ...prev, [uid]: newVal }));
                                  }}
                                  className="form-input"
                                  style={{ width: '70px', height: '34px', textAlign: 'center', fontWeight: 700 }}
                                />
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn outline" onClick={() => setShowDealModal(false)} disabled={isSubmitting}>Hủy</button>
                {(() => {
                  const ownerId = String(contact?.owner_id || formData?.owner_id || currentUser?.id || '');
                  const collabList = getCoopCollaboratorIds();
                  const hasCoopSales = collabList.length > 0;
                  if (hasCoopSales) {
                    return (
                      <>
                        <button 
                          className="btn outline" 
                          style={{ borderColor: '#f59e0b', color: '#d97706', fontWeight: 700 }} 
                          onClick={() => handleSaveDeposit(false)} 
                          disabled={isSubmitting}
                          title="Chuyển cọc không tạo phiếu hợp tác (100% hoa hồng cho Sale chính)"
                        >
                          {isSubmitting ? 'Đang lưu...' : 'Chuyển cọc KHÔNG tạo Phiếu HT'}
                        </button>
                        <button 
                          className="btn primary" 
                          onClick={() => handleSaveDeposit(true)} 
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Đang lưu...' : 'Tạo cọc & Tạo Phiếu Hợp tác'}
                        </button>
                      </>
                    );
                  }
                  return (
                    <button className="btn primary" onClick={() => handleSaveDeposit(false)} disabled={isSubmitting}>
                      {isSubmitting ? 'Đang tạo...' : 'Tạo phiếu cọc'}
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

            {/* Task Details & Creation Drawer */}
      <WorkspaceTaskDrawer
        isOpen={selectedTaskForDetails !== null}
        onClose={() => {
          setSelectedTaskForDetails(null);
          setShowAssigneeDropdown(false);
          setShowParticipantDropdown(false);
          setShowApproverDropdown(false);
        }}
        task={selectedTaskForDetails}
        onUpdate={() => {
          fetchData();
        }}
        users={users}
        zIndex={zIndex ? zIndex + 100 : undefined}
      />

{/* CREATE TICKET MODAL */}
      <AnimatePresence>
        {showTicketModal && (
          <div className="overlay-backdrop" style={{ zIndex: 1000020 }} onClick={() => setShowTicketModal(false)}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 2 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Khách hàng:</span>
                      <Avatar name={fullName} size={22} />
                      <strong style={{ fontSize: '0.8125rem', color: 'var(--color-text)' }}>{fullName}</strong>
                    </div>
                  </div>
                </div>
                <button className="btn-icon sm" onClick={() => setShowTicketModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Loại hỗ trợ *</label>
                  <CustomSelect
                    options={[
                      { value: 'technical_support', label: 'Hỗ trợ kỹ thuật / Yêu cầu chung' },
                      { value: 'lead_error_compensation', label: 'Báo lỗi data / Yêu cầu bù data' }
                    ]}
                    value={ticketForm.category || 'technical_support'}
                    onChange={val => setTicketForm({ ...ticketForm, category: val.toString() })}
                  />
                  {(['ca_nhan', 'cold_call', 'gioi_thieu'].includes(formData.source || contact?.source) || (formData.dl_status || contact?.dl_status) === 'databank_claim') && (
                    <span style={{ fontSize: '0.725rem', color: '#dc2626', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                      * Khách hàng tự khai thác / Databank chỉ hỗ trợ gửi ticket Hỗ trợ kỹ thuật (không hỗ trợ báo lỗi bù data).
                    </span>
                  )}
                </div>
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
                <div className="form-group" style={{ marginTop: '0.75rem' }}>
                  <label className="form-label">Ảnh chụp màn hình / Tài liệu đính kèm</label>
                  <PasteDropzoneArea
                    compact={true}
                    placeholder="Kéo thả tệp hoặc nhấn Ctrl+V để dán ảnh màn hình lỗi"
                    subtext="Chụp ảnh màn hình lỗi (Ctrl+V) dán trực tiếp tại đây"
                    onConfirmUpload={async (item) => {
                      if (item.file) {
                        const fd = new FormData();
                        fd.append('file', item.file);
                        try {
                          const res = await api.post('/upload', fd);
                          const url = res.data?.data?.url || res.data?.url;
                          if (url) {
                            setTicketForm(prev => ({
                              ...prev,
                              description: (prev.description || '') + (prev.description ? '\n\n' : '') + `![${item.label}](${url})`
                            }));
                          }
                        } catch (err) {}
                      } else if (item.url) {
                        setTicketForm(prev => ({
                          ...prev,
                          description: (prev.description || '') + (prev.description ? '\n\n' : '') + `[${item.label}](${item.url})`
                        }));
                      }
                    }}
                  />
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
      <CustomModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Báo cáo dữ liệu lỗi / Trùng lặp"
        zIndex={1000020}
      >
        <div style={{ padding: '0.5rem 0' }}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>Lý do báo lỗi (Chọn mẫu có sẵn)</label>
            <CustomSelect
              options={
                reportReasons.length > 0
                  ? reportReasons.map(r => ({ value: r.reason, label: r.reason }))
                  : [
                      { value: 'Sai số điện thoại / Số ảo', label: 'Sai số điện thoại / Số ảo' },
                      { value: 'Trùng của tôi (Trùng Saleperson)', label: 'Trùng của tôi (Trùng Saleperson)' },
                      { value: 'Trùng của người khác (Saleperson khác đã chăm)', label: 'Trùng của người khác (Saleperson khác đã chăm)' },
                      { value: 'Spam ảo / Junk lead', label: 'Spam ảo / Junk lead' },
                      { value: 'Khác', label: 'Khác' }
                    ]
              }
              value={reportReasonType}
              onChange={(val) => setReportReasonType(String(val))}
            />
            {(() => {
              const matchedReason = reportReasons.find(r => r.reason === reportReasonType);
              if (matchedReason && matchedReason.note) {
                return (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', background: 'var(--color-surface-hover)', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid var(--color-primary)' }}>
                    {matchedReason.note.replace('{n}', '6')}
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ fontWeight: 700, marginBottom: '6px', display: 'block' }}>Nội dung chi tiết báo cáo</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Nhập chi tiết lý do báo lỗi, bằng chứng cuộc gọi/hình ảnh (nếu có)..."
              value={reportDetails}
              onChange={e => setReportDetails(e.target.value)}
              style={{ resize: 'none', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1.5rem' }}>
            <button
              className="btn outline"
              onClick={() => setShowReportModal(false)}
              disabled={submittingReport}
              style={{ borderRadius: '8px', padding: '8px 16px' }}
            >
              Hủy
            </button>
            <button
              className="btn primary"
              onClick={handleSubmitReport}
              disabled={submittingReport}
              style={{
                background: 'var(--color-danger)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {submittingReport ? 'Đang gửi...' : 'Gửi báo cáo'}
            </button>
          </div>
        </div>
      </CustomModal>
      <CreateExpenseModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        initialEntity={{ type: 'contact', id: contact?.id, name: `${contact?.last_name || ''} ${contact?.first_name}`.trim() }}
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

      {/* Signature Modal */}
      {isSignModalOpen && coopSlip && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }} onClick={() => setIsSignModalOpen(false)}>
          <div className="card animate-fade" style={{ maxWidth: '800px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>Đọc tài liệu &amp; Ký xác nhận điện tử</h2>
              <button onClick={() => { setIsSignModalOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>

            {/* Document Reader Area */}
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>1. Đọc tài liệu đính kèm:</h3>
              {(() => {
                const modalAttachmentsList: { name: string; path: string }[] = [];
                const addedPaths = new Set<string>();

                if (coopSlip?.attachment_url) {
                  coopSlip.attachment_url.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((fileUrl: string) => {
                    if (!addedPaths.has(fileUrl)) {
                      addedPaths.add(fileUrl);
                      const filename = fileUrl.split('/').pop() || 'Tài liệu hợp tác';
                      modalAttachmentsList.push({ name: filename, path: fileUrl });
                    }
                  });
                }

                if (Array.isArray(docs)) {
                  docs.forEach((d: any) => {
                    const p = d.path || d.file_path;
                    if (p && !addedPaths.has(p)) {
                      const cat = (d.category || d.folder || '').toLowerCase();
                      const nameLower = (d.name || '').toLowerCase();
                      if (cat.includes('cọc') || cat.includes('unc') || d.isMilestoneAttachment || nameLower.includes('unc') || p.toLowerCase().includes('deposits')) {
                        addedPaths.add(p);
                        modalAttachmentsList.push({ name: d.name || p.split('/').pop() || 'UNC Đặt cọc', path: p });
                      }
                    }
                  });
                }

                if (Array.isArray(deals)) {
                  deals.forEach((dep: any) => {
                    (dep.milestones || []).forEach((m: any) => {
                      const fileUrl = m.unc_file_path || m.attachment_url;
                      if (fileUrl && !addedPaths.has(fileUrl)) {
                        addedPaths.add(fileUrl);
                        const filename = (() => {
                          const base = fileUrl.split('/').pop() || `${m.name || 'Cọc giữ chỗ'} - UNC.${fileUrl.split('.').pop() || 'png'}`;
                          try { return decodeURIComponent(base); } catch (e) { return base; }
                        })();
                        modalAttachmentsList.push({ name: filename, path: fileUrl });
                      }
                    });
                  });
                }

                if (modalAttachmentsList.length > 0) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {modalAttachmentsList.map((item, urlIdx) => (
                        <div key={urlIdx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--color-bg-light)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                          <FileText size={24} style={{ color: 'var(--color-primary)' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '0.825rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.name}
                            </p>
                            <a 
                              href={item.path.startsWith('http') ? item.path : `https://open.domation.net/richland/${item.path}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'underline', marginTop: '2px', display: 'inline-block' }}
                            >
                              Bấm để mở xem tài liệu ở tab mới ↗
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <div style={{ padding: '1rem', textAlign: 'center', background: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    Phiếu hợp tác này không đính kèm tệp tài liệu bổ sung. Vui lòng kiểm tra tỷ lệ phân chia bên dưới.
                  </div>
                );
              })()}
            </div>

            {/* Shares info recap */}
            <div style={{ padding: '12px 16px', background: 'var(--color-bg-light)', borderRadius: '10px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)' }}>Tỷ lệ phân chia của các thành viên:</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {coopSlip.shareholders?.map((sh: any) => (
                  <div key={sh.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar src={sh.avatar} name={sh.name} size="md" />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{sh.name}</span>
                        <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                          {numberToVietnameseWords(sh.percentage)}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {sh.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Signature Banner if user has saved signature */}
            {currentUser?.signature_url ? (
              <div style={{
                background: 'rgba(189, 29, 45, 0.05)',
                border: '1px solid rgba(189, 29, 45, 0.2)',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: '240px' }}>
                  <div style={{
                    background: 'white',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    maxHeight: '45px',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0
                  }}>
                    <img 
                      src={currentUser.signature_url.startsWith('http') || currentUser.signature_url.startsWith('data:') ? currentUser.signature_url : `https://open.domation.net/richland/${currentUser.signature_url.replace(/^\/+/, '')}`} 
                      alt="Chữ ký mẫu" 
                      style={{ maxHeight: '35px', objectFit: 'contain' }} 
                    />
                  </div>
                  <div style={{ flex: '1' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>
                      Chữ ký mẫu đã lưu của bạn
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                      Điền chữ ký cá nhân chính chủ chỉ với 1-click
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSignCoopSlip(currentUser.signature_url!)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#BD1D2D',
                    color: 'white',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flex: '1 0 auto',
                    justifyContent: 'center',
                    maxWidth: '100%'
                  }}
                >
                  <Zap size={15} />
                  Dùng chữ ký của tôi
                </button>
              </div>
            ) : (
              <div style={{
                background: 'var(--color-bg-light)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Bạn chưa cài đặt chữ ký mẫu cá nhân.
                </span>
                <span style={{ fontSize: '0.8rem', color: '#BD1D2D', fontWeight: 700 }}>
                  (Vẽ chữ ký của bạn bên dưới để ký xác nhận)
                </span>
              </div>
            )}

            {/* Signature Area Selector & Component */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
                <button
                  type="button"
                  className={`btn sm ${signatureMethod === 'draw' ? 'primary' : 'outline'}`}
                  style={{ flex: 1, height: '36px', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => setSignatureMethod('draw')}
                >
                  <PenTool size={14} /> Vẽ chữ ký tay
                </button>
                <button
                  type="button"
                  className={`btn sm ${signatureMethod === 'upload' ? 'primary' : 'outline'}`}
                  style={{ flex: 1, height: '36px', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => setSignatureMethod('upload')}
                >
                  <Paperclip size={14} /> Tải file ảnh chữ ký
                </button>
              </div>

              {signatureMethod === 'draw' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>2. Vẽ chữ ký của bạn lên khung dưới đây:</h3>
                    <button 
                      onClick={clearCanvas} 
                      style={{ fontSize: '0.75rem', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Xóa vẽ lại
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={750}
                    height={220}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{
                      border: '2px dashed var(--color-border)',
                      borderRadius: '8px',
                      background: 'var(--color-bg-light)',
                      cursor: 'crosshair',
                      display: 'block',
                      touchAction: 'none',
                      width: '100%',
                      height: '220px'
                    }}
                  />
                </div>
              ) : (
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text)' }}>2. Chọn file ảnh chữ ký từ máy tính của bạn:</h3>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setUploadedSignatureImg(event.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ display: 'block', width: '100%', padding: '10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-bg-light)', fontSize: '0.8125rem', cursor: 'pointer' }}
                  />
                  {uploadedSignatureImg && (
                    <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                      <img src={uploadedSignatureImg} alt="Preview Chữ ký" style={{ maxHeight: '150px', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky Action Footer Button */}
            <div style={{ position: 'sticky', bottom: 0, background: 'var(--color-surface, #ffffff)', paddingTop: '12px', paddingBottom: '4px', marginTop: '12px', borderTop: '1px solid var(--color-border)', zIndex: 20 }}>
              <button
                onClick={() => {
                  if (coopLoading) return;
                  if (signatureMethod === 'upload') {
                    if (!uploadedSignatureImg) {
                      alert('Vui lòng tải file ảnh chữ ký của bạn lên trước khi bấm xác nhận.');
                      return;
                    }
                    handleSignCoopSlip(uploadedSignatureImg);
                  } else {
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    
                    const buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
                    const isBlank = !buffer.some(color => color !== 0);
                    if (isBlank) {
                      alert('Vui lòng vẽ chữ ký của bạn trước khi bấm xác nhận.');
                      return;
                    }

                    const signatureImg = canvas.toDataURL('image/png');
                    handleSignCoopSlip(signatureImg);
                  }
                }}
                disabled={coopLoading}
                className="btn primary w-full"
                style={{ height: '48px', fontSize: '1rem', fontWeight: 800, opacity: coopLoading ? 0.7 : 1, cursor: coopLoading ? 'not-allowed' : 'pointer', background: '#BD1D2D', borderColor: '#BD1D2D', borderRadius: '10px', boxShadow: '0 4px 14px rgba(189, 29, 45, 0.3)' }}
              >
                {coopLoading ? 'Đang xử lý chữ ký số...' : 'Tôi đồng ý và Ký xác nhận'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {reschedulingMeeting && (
        <CustomModal
          isOpen={true}
          onClose={() => setReschedulingMeeting(null)}
          title="Dời lịch gặp gỡ"
          zIndex={1000020}
        >
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Chọn thời gian mới cho cuộc gặp gỡ: <strong>{reschedulingMeeting.title}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>Thời gian mới</label>
              <input
                type="datetime-local"
                value={newMeetingTime}
                onChange={(e) => setNewMeetingTime(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setReschedulingMeeting(null)}
                className="btn secondary sm"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleUpdateReschedule}
                disabled={updatingMeetingTime}
                className="btn primary sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {updatingMeetingTime && <Loader2 size={12} className="animate-spin" />}
                Xác nhận dời lịch
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {cancellingMeeting && (
        <CustomModal
          isOpen={true}
          onClose={() => setCancellingMeeting(null)}
          title="Hủy lịch gặp gỡ"
          zIndex={1000020}
        >
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Nhập lý do hủy lịch gặp gỡ cho: <strong>{cancellingMeeting.title}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>Lý do hủy</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ví dụ: Khách bận đột xuất, khách không nghe máy..."
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  width: '100%',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setCancellingMeeting(null)}
                className="btn secondary sm"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={submitCancelMeeting}
                disabled={savingCancel || !cancelReason.trim()}
                className="btn primary sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              >
                {savingCancel && <Loader2 size={12} className="animate-spin" />}
                Xác nhận hủy
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      <CustomModal
        isOpen={isCreateCoopModalOpen}
        onClose={() => setIsCreateCoopModalOpen(false)}
        title={selectedCollaborators.length === 0 ? "Khởi tạo phiếu đặt cọc" : "Thiết lập hợp tác hoa hồng"}
        zIndex={1000020}
      >
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
            {selectedCollaborators.length === 0 
              ? "Bạn đang tạo phiếu đặt cọc cho giao dịch độc lập (không có nhân sự hợp tác hỗ trợ)." 
              : "Hợp tác là bắt buộc đối với phiếu hợp tác. Bạn có thể chọn tối đa 2 nhân sự để cùng chăm sóc khách hàng này."}
          </p>

          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Tìm kiếm nhân sự theo tên hoặc email..."
              value={collabSearchQuery}
              onChange={e => setCollabSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', fontSize: '0.875rem' }}
            />
          </div>

          {loadingSuggestions ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="spin" size={24} style={{ color: 'var(--color-primary)' }} />
            </div>
          ) : (
            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              
              {/* Highlight Suggestions if search is empty or matches suggestions */}
              {(() => {
                const filteredSuggestions = suggestedSales.filter(u => 
                  (u.full_name || '').toLowerCase().includes(collabSearchQuery.toLowerCase()) || 
                  (u.email || '').toLowerCase().includes(collabSearchQuery.toLowerCase())
                );
                
                if (filteredSuggestions.length === 0) return null;
                
                return (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lightbulb size={12} /> Gợi ý nhân sự (Trùng khách hàng)
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {filteredSuggestions.map((u) => {
                        const isSelected = selectedCollaborators.includes(String(u.id));
                        return (
                          <div 
                            key={u.id}
                            onClick={() => handleToggleCollaborator(String(u.id))}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              borderRadius: '12px',
                              border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Avatar src={resolveAttachmentUrl(u.avatar)} name={u.full_name} size="sm" />
                              <div>
                                <strong style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{u.full_name}</strong>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block' }}>{u.email}</span>
                              </div>
                            </div>
                            <span className="badge warning" style={{ fontSize: '0.65rem' }}>💡 Trùng khách</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* All other sales list */}
              <div>
                <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', marginTop: '4px' }}>
                  Danh sách nhân sự
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {salesUsers
                    .filter(u => String(u.id) !== String(contact?.owner_id || formData?.owner_id)) // exclude owner
                    .filter(u => !suggestedSales.some(s => String(s.id) === String(u.id))) // exclude suggested ones to avoid duplication
                    .filter(u => 
                      (u.full_name || '').toLowerCase().includes(collabSearchQuery.toLowerCase()) || 
                      (u.email || '').toLowerCase().includes(collabSearchQuery.toLowerCase())
                    )
                    .map((u) => {
                      const isSelected = selectedCollaborators.includes(String(u.id));
                      return (
                        <div 
                          key={u.id}
                          onClick={() => handleToggleCollaborator(String(u.id))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                            background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Avatar src={resolveAttachmentUrl(u.avatar)} name={u.full_name} size="sm" />
                            <div>
                              <strong style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{u.full_name}</strong>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block' }}>{u.email}</span>
                            </div>
                          </div>
                          {isSelected && <Check size={16} style={{ color: 'var(--color-primary)' }} />}
                        </div>
                      );
                    })}
                </div>
              </div>

            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button className="btn outline" style={{ flex: 1 }} onClick={() => setIsCreateCoopModalOpen(false)}>Hủy</button>
            <button
              className="btn primary"
              style={{ flex: 1 }}
              disabled={coopLoading}
              onClick={async () => {
                setCoopLoading(true);
                try {
                  const res = await fetchAPI('cooperation-slips', {
                    method: 'POST',
                    body: JSON.stringify({ 
                      contact_id: contact.id, 
                      collaborators: selectedCollaborators 
                    })
                  });
                  if (res.success) {
                    addToast(selectedCollaborators.length === 0 ? 'Đã khởi tạo phiếu đặt cọc thành công!' : 'Đã khởi tạo phiếu hợp tác hoa hồng thành công!', 'success');
                    setIsCreateCoopModalOpen(false);
                    await fetchCoopSlip();
                  } else {
                    addToast(res.message || (selectedCollaborators.length === 0 ? 'Không thể tạo phiếu đặt cọc' : 'Không thể tạo phiếu hợp tác'), 'error');
                  }
                } catch (e: any) {
                  addToast(e.message, 'error');
                } finally {
                  setCoopLoading(false);
                }
              }}
            >
              {coopLoading 
                ? (selectedCollaborators.length === 0 ? 'Đang tạo phiếu đặt cọc...' : 'Đang tạo phiếu hợp tác...') 
                : (selectedCollaborators.length === 0 ? 'Tạo phiếu đặt cọc' : 'Tạo phiếu hợp tác')}
            </button>
          </div>

        </div>
      </CustomModal>

      {/* Quick View Expense Modal */}
      {viewExpense && createPortal(
        <div className="overlay-backdrop" onClick={() => setViewExpense(null)} style={{ zIndex: 1000020, position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <motion.div 
            className="modal-sheet shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            onClick={e => e.stopPropagation()}
            style={{ padding: '2rem', maxWidth: '640px', width: '100%', background: 'var(--color-surface)', borderRadius: '24px', boxShadow: 'var(--shadow-2xl)', boxSizing: 'border-box' }}
          >
            {/* Close Button & Badge Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${viewExpense.status === 'approved' ? (viewExpense.is_refunded ? 'info' : 'success') : viewExpense.status === 'rejected' ? 'danger' : 'warning'}`} style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '8px' }}>
                  {viewExpense.status === 'approved' ? (viewExpense.is_refunded ? 'Đã hoàn tiền' : 'Đã duyệt') : viewExpense.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
                </span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {viewExpense.date ? new Date(viewExpense.date).toLocaleDateString('vi-VN') : '—'}
                </span>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-light)' }} onClick={() => setViewExpense(null)}><X size={20} /></button>
            </div>

            {/* Invoice Layout */}
            <div className="card-panel" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem', borderBottom: '2px dashed var(--color-border-light)', paddingBottom: '1.25rem' }}>
                <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '0.25rem' }}>Richland Data Automation</h4>
                <h2 style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-text)', margin: 0 }}>HÓA ĐƠN CHI PHÍ</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', margin: 0 }}>Mã số: #EXP-{viewExpense.id}</p>
              </div>

              <div style={{ textAlign: 'center', padding: '1.25rem', background: 'var(--color-bg)', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid var(--color-border-light)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>SỐ TIỀN CHI</span>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#BD1D2D', margin: 0, letterSpacing: '-0.02em' }}>
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(viewExpense.split_amount || viewExpense.amount)}
                </h1>
                <p style={{ fontSize: '0.775rem', fontWeight: 700, fontStyle: 'italic', color: '#8a0f1b', marginTop: '0.5rem', marginBottom: 0 }}>
                  Bằng chữ: {numberToText(viewExpense.split_amount || viewExpense.amount)}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Nội dung chi</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{viewExpense.title}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Danh mục</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{viewExpense.category}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Ngày chi</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                    {viewExpense.date ? new Date(viewExpense.date).toLocaleDateString('vi-VN') : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem', fontSize: '0.8125rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Người tạo</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Avatar src={viewExpense.creator_avatar} name={viewExpense.creator_name || 'Hệ thống'} size={20} />
                    {viewExpense.creator_name || 'Hệ thống'}
                    {viewExpense.created_at && (
                      <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                        (lúc {new Date(viewExpense.created_at).toLocaleString('vi-VN')})
                      </span>
                    )}
                  </span>
                </div>
                {viewExpense.status === 'approved' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem', fontSize: '0.8125rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Người duyệt</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Avatar src={viewExpense.approver_avatar} name={viewExpense.approver_name || 'Admin'} size={20} />
                      {viewExpense.approver_name || 'Admin'}
                      {viewExpense.approved_at && (
                        <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                          (lúc {new Date(viewExpense.approved_at).toLocaleString('vi-VN')})
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {viewExpense.status === 'rejected' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem', fontSize: '0.8125rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Người từ chối</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Avatar src={viewExpense.approver_avatar} name={viewExpense.approver_name || 'Admin'} size={20} />
                        {viewExpense.approver_name || 'Admin'}
                        {viewExpense.approved_at && (
                          <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                            (lúc {new Date(viewExpense.approved_at).toLocaleString('vi-VN')})
                          </span>
                        )}
                      </span>
                    </div>
                    {viewExpense.reject_reason && (
                      <div style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '6px 10px', borderRadius: '6px', marginTop: '4px', fontSize: '0.75rem' }}>
                        <strong>Lý do từ chối:</strong> {viewExpense.reject_reason}
                      </div>
                    )}
                  </div>
                )}
                {viewExpense.image_url && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', alignItems: 'center', paddingTop: '0.25rem' }}>
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Đính kèm</span>
                    <a 
                      href={viewExpense.image_url.startsWith('http') ? viewExpense.image_url : `${import.meta.env.VITE_API_URL || '/backend'}${viewExpense.image_url}`} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'underline' }}
                    >
                      <Paperclip size={13} />
                      Xem ảnh hóa đơn
                    </a>
                  </div>
                )}

                {viewExpense.status === 'approved' && (
                  <>
                    {viewExpense.is_refunded ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--color-border)', paddingTop: '12px', marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', alignItems: 'center' }}>
                          <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Hoàn tiền</span>
                          <span className="badge info" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                            <CheckCircle2 size={11} /> Đã hoàn tiền cho sale
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', alignItems: 'center' }}>
                          <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Người hoàn tiền</span>
                          <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Avatar src={viewExpense.refunder_avatar} name={viewExpense.refunder_name || 'Admin'} size={20} />
                            {viewExpense.refunder_name || 'Admin'} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>(lúc {viewExpense.refunded_at ? new Date(viewExpense.refunded_at).toLocaleString('vi-VN') : '—'})</span>
                          </span>
                        </div>
                        {viewExpense.refund_image_url && (
                          <div style={{ marginTop: '4px' }}>
                            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px' }}>Chứng từ hoàn tiền:</span>
                            <div style={{ border: '1px solid var(--color-border-light)', borderRadius: '8px', overflow: 'hidden', maxWidth: '100%', maxHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
                              <img 
                                  src={viewExpense.refund_image_url.startsWith('http') ? viewExpense.refund_image_url : `${import.meta.env.VITE_API_URL || '/backend'}${viewExpense.refund_image_url}`} 
                                  alt="Chứng từ hoàn tiền" 
                                  style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', cursor: 'pointer' }}
                                  onClick={() => window.open(viewExpense.refund_image_url.startsWith('http') ? viewExpense.refund_image_url : `${import.meta.env.VITE_API_URL || '/backend'}${viewExpense.refund_image_url}`, '_blank')}
                                />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      ((currentUser?.role as any) === 'admin' || (currentUser?.role as any) === 'superadmin' || (currentUser?.role as any) === 'super_admin' || currentUser?.role === 'director') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--color-border)', paddingTop: '12px', marginTop: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>Xác nhận hoàn tiền</span>
                            <CustomCheckbox checked={isRefundingExpense} onChange={() => setIsRefundingExpense(!isRefundingExpense)} label="Đã hoàn tiền cho sale" />
                          </div>
                          
                          {isRefundingExpense && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Tải lên ảnh chứng từ hoàn tiền:</span>
                              <div style={{
                                border: '2px dashed var(--color-border)', borderRadius: '12px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                padding: '12px', position: 'relative', cursor: 'pointer', background: 'var(--color-bg)',
                                overflow: 'hidden', minHeight: '90px'
                              }}
                                onClick={() => document.getElementById('drawer-refund-image-upload')?.click()}
                              >
                                {uploadingExpenseRefund ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="spinner sm"></div>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Đang tải lên...</span>
                                  </div>
                                ) : refundExpenseImgUrl ? (
                                  <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img 
                                      src={refundExpenseImgUrl.startsWith('http') ? refundExpenseImgUrl : `${import.meta.env.VITE_API_URL || '/backend'}${refundExpenseImgUrl}`} 
                                      alt="Chứng từ hoàn tiền" 
                                      style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain', borderRadius: '6px' }} 
                                    />
                                    <button 
                                      type="button"
                                      style={{
                                        position: 'absolute', top: -4, right: -4, background: 'rgba(239, 68, 68, 0.9)', 
                                        color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRefundExpenseImgUrl('');
                                      }}
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-1 text-center">
                                    <Upload size={18} className="text-light" />
                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Chọn ảnh biên lai/chuyển khoản</span>
                                  </div>
                                )}
                                <input 
                                  type="file" 
                                  id="drawer-refund-image-upload" 
                                  accept="image/*" 
                                  style={{ display: 'none' }} 
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploadingExpenseRefund(true);
                                    try {
                                      const webpBlob = await compressToWebP(file);
                                      const compFile = new File([webpBlob], 'refund_proof.webp', { type: 'image/webp' });
                                      const fd = new FormData();
                                      fd.append('file', compFile);
                                      const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                                      if (res.data && res.data.data?.url) {
                                        setRefundExpenseImgUrl(res.data.data.url);
                                      } else {
                                        addToast('Lỗi tải ảnh', 'error');
                                      }
                                    } catch (err: any) {
                                      addToast('Lỗi tải ảnh: ' + err.message, 'error');
                                    } finally {
                                      setUploadingExpenseRefund(false);
                                    }
                                  }}
                                />
                              </div>
                              
                              <button 
                                className="btn primary sm" 
                                disabled={submittingExpenseRefund}
                                onClick={async () => {
                                  setSubmittingExpenseRefund(true);
                                  try {
                                    await api.put(`/expenses/${viewExpense.id}`, { 
                                      is_refunded: 1, 
                                      refund_image_url: refundExpenseImgUrl 
                                    });
                                    addToast('Đã xác nhận hoàn tiền cho nhân viên', 'success');
                                    setViewExpense(null);
                                    fetchData();
                                    if (onUpdate) onUpdate(contact);
                                  } catch (e: any) {
                                    addToast('Lỗi khi cập nhật hoàn tiền: ' + (e.response?.data?.message || e.message), 'error');
                                  } finally {
                                    setSubmittingExpenseRefund(false);
                                  }
                                }}
                                style={{ marginTop: '4px', background: 'var(--color-success)', color: 'white', border: 'none', width: '100%', height: '36px', fontWeight: 700 }}
                              >
                                {submittingExpenseRefund ? 'Đang cập nhật...' : 'Xác nhận đã hoàn tiền'}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            </div>

            {viewExpense.notes && (
              <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '8px', fontSize: '0.8125rem', color: '#b45309', marginBottom: '1.5rem' }}>
                <span style={{ fontWeight: 700, display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', letterSpacing: '0.05em' }}>GHI CHÚ / THÔNG TIN THÊM:</span>
                {viewExpense.notes}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              {viewExpense.status === 'pending' && currentUser?.role && ['admin', 'superadmin', 'super_admin', 'director', 'manager'].includes(currentUser.role) ? (
                <>
                  <button 
                    className="btn success" 
                    style={{ flex: 1, background: 'var(--color-success)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600 }}
                    onClick={async () => {
                      try {
                        await api.patch(`/expenses/${viewExpense.id}`, { status: 'approved' });
                        setViewExpense(prev => ({ ...prev, status: 'approved' }));
                        addToast('Đã phê duyệt chi phí', 'success');
                        fetchData();
                      } catch (e: any) {
                        addToast('Lỗi khi phê duyệt chi phí', 'error');
                      }
                    }}
                  >
                    <CheckCircle2 size={14} /> Phê duyệt
                  </button>
                  <button 
                    className="btn danger" 
                    style={{ flex: 1, background: 'var(--color-danger)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600 }}
                    onClick={() => setRejectingExpense(viewExpense)}
                  >
                    <XCircle size={14} /> Từ chối
                  </button>
                  <button className="btn outline" style={{ flex: 1 }} onClick={() => setViewExpense(null)}>Đóng</button>
                </>
              ) : (
                <button className="btn outline" style={{ flex: 1 }} onClick={() => setViewExpense(null)}>Đóng</button>
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {rejectingExpense && createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000030, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '1rem' }} onClick={() => setRejectingExpense(null)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            style={{ background: 'var(--color-surface)', borderRadius: '16px', padding: '1.5rem', maxWidth: '400px', width: '100%', boxShadow: 'var(--shadow-xl)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>Từ chối yêu cầu chi phí</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>Vui lòng nhập lý do từ chối:</p>
            <textarea
              style={{ width: '100%', height: '80px', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', background: 'var(--color-bg)', color: 'var(--color-text)', resize: 'none', marginBottom: '1rem' }}
              placeholder="Nhập lý do từ chối chi phí này..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                className="btn outline sm" 
                onClick={() => {
                  setRejectingExpense(null);
                  setRejectReason('');
                }}
                disabled={submittingReject}
              >
                Hủy
              </button>
              <button 
                className="btn danger sm" 
                style={{ background: 'var(--color-danger)', color: 'white', border: 'none', fontWeight: 600 }}
                onClick={async () => {
                  if (!rejectReason.trim()) {
                    addToast('Vui lòng nhập lý do từ chối', 'error');
                    return;
                  }
                  setSubmittingReject(true);
                  try {
                    await api.patch(`/expenses/${rejectingExpense.id}`, { status: 'rejected', reject_reason: rejectReason });
                    addToast('Đã từ chối chi phí', 'success');
                    setRejectingExpense(null);
                    setRejectReason('');
                    setViewExpense(null);
                    fetchData();
                  } catch (e: any) {
                    addToast('Lỗi khi từ chối chi phí', 'error');
                  } finally {
                    setSubmittingReject(false);
                  }
                }}
                disabled={submittingReject || !rejectReason.trim()}
              >
                {submittingReject ? 'Đang cập nhật...' : 'Từ chối'}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {showMobilePipelineSelector && (
        <div 
          className="overlay-backdrop" 
          style={{ zIndex: 1000050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)' }} 
          onClick={() => setShowMobilePipelineSelector(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            style={{
              background: 'var(--color-surface)',
              width: '100%',
              maxWidth: '380px',
              borderRadius: '24px',
              maxHeight: '75vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-2xl)',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px',
              boxSizing: 'border-box',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '12px' }}>
              <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: 'var(--color-text)' }}>Chuyển giai đoạn Pipeline</h4>
              <button 
                onClick={() => setShowMobilePipelineSelector(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }} className="no-scrollbar">
              {(() => {
                const currentIdx = pipelineStages.findIndex(s => String(s.id) === String(formData.pipeline_status || 'chua_xac_dinh'));
                return pipelineStages.map((st, idx) => {
                  const isCurrent = String(st.id) === String(formData.pipeline_status || 'chua_xac_dinh');
                  const isBackward = idx < currentIdx;
                  const stColor = overridePurpleColor(st.color);
                  return (
                    <button
                      key={st.id}
                      disabled={isBackward}
                      onClick={() => {
                        setShowMobilePipelineSelector(false);
                        if (isCurrent || isBackward) return;
                        handleStageTransition(String(st.id), st.name);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: isCurrent ? `1.5px solid ${stColor}` : '1px solid var(--color-border-light)',
                        background: isCurrent ? `${stColor}10` : 'var(--color-bg-alt)',
                        color: isCurrent ? stColor : 'var(--color-text)',
                        fontWeight: isCurrent ? 800 : 600,
                        fontSize: '0.875rem',
                        cursor: isCurrent ? 'default' : (isBackward ? 'not-allowed' : 'pointer'),
                        opacity: isBackward ? 0.4 : 1,
                        textAlign: 'left',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      <span>{st.name}</span>
                      {isCurrent && <UserCheck size={16} />}
                    </button>
                  );
                });
              })()}
            </div>
          </motion.div>
        </div>
      )}

      {/* Manage Milestones Modal inside Customer Profile Drawer */}
      <CustomModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title={`Chi tiết & Lịch trình thanh toán - Căn ${selectedDepForManage?.unit_code}`}
        width="980px"
        zIndex={1000020}
      >
        {selectedDepForManage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Brief Info with Customer Details and Sales Team */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '1.5rem',
              background: 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-hover) 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid var(--color-border-light)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
            }}>
              {/* Left Column: Customer details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRight: '1px solid var(--color-border-light)', paddingRight: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <Avatar
                      src={selectedDepForManage.avatar_url}
                      name={`${selectedDepForManage.last_name || ''} ${selectedDepForManage.first_name || ''}`}
                      size="lg"
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 600 }}>Khách hàng</span>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: 'var(--color-primary)'
                      }}
                    >
                      {selectedDepForManage.last_name} {selectedDepForManage.first_name}
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      SĐT: {selectedDepForManage.phone}
                    </p>
                  </div>
                </div>

                {/* Sales team section */}
                <div style={{ marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Nhân sự chăm sóc & tỷ lệ chia hoa hồng:
                  </span>
                  {(() => {
                    const isAdmin = currentUser && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director'].includes(currentUser.role);
                    if (isAdmin && tempSharesData && tempSharesData.length > 0) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {tempSharesData.map((sh, sIdx) => (
                            <div
                              key={sIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-border-light)',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                maxWidth: '360px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Avatar src={sh.avatar} name={sh.name} size="sm" />
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{sh.name}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={sh.percentage}
                                  onChange={(e) => handleTempSharePercentChange(sIdx, e.target.value)}
                                  className="form-input"
                                  style={{ width: '60px', height: '28px', textAlign: 'center', padding: '2px', fontSize: '0.8rem' }}
                                />
                                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>%</span>
                              </div>
                            </div>
                          ))}
                          {(() => {
                            const totalPct = tempSharesData.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
                            if (totalPct !== 100) {
                              return (
                                <span style={{ fontSize: '0.725rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                                  * Tổng tỷ lệ phải bằng 100% (Hiện tại: {totalPct}%)
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      );
                    }
                    if (sharesData && sharesData.length > 0) {
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {sharesData.map((sh, sIdx) => (
                            <div
                              key={sIdx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-border-light)',
                                padding: '3px 8px',
                                borderRadius: '16px',
                                boxShadow: 'var(--shadow-sm)'
                              }}
                            >
                              <Avatar src={sh.avatar} name={sh.name} size="sm" />
                              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{sh.name}</span>
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: '#2563eb',
                                padding: '1px 5px',
                                borderRadius: '8px'
                              }}>
                                {sh.percentage}%
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Bán độc lập (Chỉ có chủ sở hữu cọc)
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Right Column: Transaction details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Dự án & Căn hộ</span>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{selectedDepForManage.project_name} - Căn {selectedDepForManage.unit_code}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Thời gian tạo phiếu</span>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {new Date(selectedDepForManage.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Tổng giá trị căn hộ</span>
                    <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '1rem' }}>
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(selectedDepForManage.price)}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Hoa hồng dự kiến</span>
                    {(() => {
                      const isAdmin = currentUser && ['admin', 'superadmin', 'super_admin', 'assistant', 'manager', 'director'].includes(currentUser.role);
                      if (isAdmin) {
                        return (
                          <CurrencyInput
                            value={tempExpectedCommission}
                            onChange={(val) => setTempExpectedCommission(val || 0)}
                            className="form-input"
                            style={{ height: '32px', fontSize: '0.9rem', fontWeight: 800, color: '#059669', width: '100%', maxWidth: '160px' }}
                          />
                        );
                      }
                      return (
                        <span style={{ fontWeight: 800, color: '#059669', fontSize: '1rem' }}>
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(selectedDepForManage.expected_commission)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Milestones List */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>Các đợt thanh toán</h4>
                <button
                  className="btn sm"
                  onClick={handleAddMilestoneRow}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    background: 'rgba(16, 185, 129, 0.08)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  + Thêm đợt
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1fr 1.5fr',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--color-surface-hover)',
                  borderBottom: '2px solid var(--color-border)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <div>Tên đợt thanh toán</div>
                  <div>Ngày tạo</div>
                  <div>Số tiền (VND)</div>
                  <div style={{ textAlign: 'center' }}>Trạng thái</div>
                  <div style={{ textAlign: 'center' }}>Minh chứng</div>
                  <div style={{ textAlign: 'right' }}>Thao tác</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto', paddingRight: 4 }}>
                  {tempMilestones.map((m: any, idx: number) => {
                    const isLocked = m.status === 'approved' || m.status === 'paid';
                    return (
                      <div
                        key={m.tempId || m.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1fr 1.5fr',
                          gap: '12px',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '8px',
                          transition: 'all 0.2s',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                        }}
                      >
                        {/* Name input */}
                        <div>
                          <input
                            type="text"
                            placeholder="Tên đợt (ví dụ: Đợt 1 - Cọc giữ chỗ)"
                            value={m.milestone_name}
                            onChange={e => handleUpdateMilestoneField(idx, 'milestone_name', e.target.value)}
                            className="form-input"
                            style={{ width: '100%', height: '34px', fontSize: '0.775rem', padding: '0 10px', borderRadius: '6px' }}
                          />
                        </div>

                        {/* Created Date */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: '4px', fontWeight: 500 }}>
                          {new Date(m.created_at || selectedDepForManage.created_at).toLocaleDateString('vi-VN')}
                        </div>

                        {/* Amount input */}
                        <div>
                          <input
                            type="text"
                            placeholder="Số tiền"
                            value={formatNumberWithCommas(m.expected_amount)}
                            disabled={isLocked}
                            onChange={e => {
                              const rawVal = e.target.value.replace(/[^0-9]/g, '');
                              handleUpdateMilestoneField(idx, 'expected_amount', rawVal ? parseInt(rawVal, 10) : 0);
                            }}
                            className="form-input"
                            style={{ width: '100%', height: '34px', fontSize: '0.775rem', padding: '0 10px', borderRadius: '6px' }}
                          />
                        </div>

                        {/* Status */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '4px 8px',
                            borderRadius: '9999px',
                            background: m.status === 'approved' ? 'rgba(16, 185, 129, 0.12)' : m.status === 'paid' ? 'rgba(37, 99, 235, 0.12)' : m.status === 'failed' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(107, 114, 128, 0.12)',
                            color: m.status === 'approved' ? '#10b981' : m.status === 'paid' ? '#2563eb' : m.status === 'failed' ? '#ef4444' : '#6b7280',
                            textAlign: 'center',
                            display: 'inline-block',
                            whiteSpace: 'nowrap'
                          }}>
                            {m.status === 'approved' ? 'Đã duyệt' : m.status === 'paid' ? 'Chờ duyệt' : m.status === 'failed' ? 'Từ chối' : 'Chờ nộp'}
                          </span>
                          {m.approval_date && m.status === 'approved' && (
                            <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 500, textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {new Date(m.approval_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(',', '')}
                            </span>
                          )}
                        </div>

                        {/* UNC proof */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                          {/* Upload UNC - hidden if m.unc_file_path is present */}
                          {!m.unc_file_path && m.status !== 'approved' && (
                            <label
                              className="btn sm"
                              style={{
                                padding: '0 8px',
                                height: '30px',
                                cursor: actioningMilestoneId !== null ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                color: 'var(--color-text-muted)',
                                opacity: actioningMilestoneId !== null ? 0.5 : 1,
                                pointerEvents: actioningMilestoneId !== null ? 'none' : 'auto',
                                transition: 'all 0.15s'
                              }}
                              title="Tải ảnh chuyển khoản (UNC)"
                            >
                              <Upload size={13} />
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                disabled={actioningMilestoneId !== null}
                                onChange={e => handleUploadUncFromModal(e, idx)}
                              />
                            </label>
                          )}

                          {/* View UNC link - Show thumbnail image instead of eye icon */}
                          {m.unc_file_path && (() => {
                            const downloadUrl = m.unc_file_path.startsWith('uploads/') ? `${import.meta.env.VITE_API_URL || '/backend'}/${m.unc_file_path}` : `${import.meta.env.VITE_API_URL || '/backend'}/uploads/${m.unc_file_path}`;
                            const isPdf = m.unc_file_path.toLowerCase().endsWith('.pdf');
                            return (
                              <a
                                href={downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  border: '1px solid var(--color-border-light)',
                                  background: '#ffffff',
                                  boxShadow: 'var(--shadow-sm)',
                                  transition: 'transform 0.15s'
                                }}
                                className="hover-scale"
                                title="Bấm để xem chi tiết minh chứng"
                              >
                                {isPdf ? (
                                  <FileText size={16} color="var(--color-primary)" />
                                ) : (
                                  <img 
                                    src={downloadUrl} 
                                    alt="Minh chứng" 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                  />
                                )}
                              </a>
                            );
                          })()}
                        </div>

                        {/* Actions (Approve/Reject or Delete) */}
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {/* Admin approval/rejection */}
                          {isAdmin && m.status === 'paid' && (
                            <>
                              <button
                                onClick={() => handleApproveFromModal(idx)}
                                disabled={actioningMilestoneId !== null}
                                style={{
                                  padding: '0 8px',
                                  height: '30px',
                                  background: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: actioningMilestoneId !== null ? 'not-allowed' : 'pointer',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  opacity: actioningMilestoneId !== null ? 0.6 : 1
                                }}
                                title="Phê duyệt đợt tiền này"
                              >
                                {actioningMilestoneId === m.id && actioningType === 'approve' && (
                                  <Loader2 size={13} className="animate-spin" style={{ marginRight: 4 }} />
                                )}
                                Duyệt
                              </button>
                              <button
                                onClick={() => handleRejectFromModal(idx)}
                                disabled={actioningMilestoneId !== null}
                                style={{
                                  padding: '0 8px',
                                  height: '30px',
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: actioningMilestoneId !== null ? 'not-allowed' : 'pointer',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  opacity: actioningMilestoneId !== null ? 0.6 : 1
                                }}
                                title="Từ chối minh chứng"
                              >
                                {actioningMilestoneId === m.id && actioningType === 'reject' && (
                                  <Loader2 size={13} className="animate-spin" style={{ marginRight: 4 }} />
                                )}
                                Từ chối
                              </button>
                            </>
                          )}

                          {/* Delete row */}
                          {!isLocked && (
                            <button
                              onClick={() => handleRemoveMilestoneRow(idx)}
                              style={{
                                padding: '0 8px',
                                height: '30px',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                background: 'transparent',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              title="Xóa đợt thanh toán"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
              <button className="btn" onClick={() => setShowManageModal(false)} style={{ minWidth: 80 }}>
                Hủy
              </button>
              <button className="btn primary" onClick={handleSaveMilestones} style={{ minWidth: 100 }} disabled={isSavingMilestones}>
                {isSavingMilestones ? 'Đang lưu...' : 'Lưu lịch trình'}
              </button>
            </div>
          </div>
        )}
      </CustomModal>
    </>,
    document.body
  );
};
