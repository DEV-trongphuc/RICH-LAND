import React, { useState, useEffect, useRef } from 'react';
import { 
  X, CheckSquare, Check, Paperclip, Link2, MessageSquare, Calendar, User, Clock, 
  Settings, AlertCircle, Trash2, Plus, Send, Share2, FileText, Globe,
  Bold, Italic, List, ListOrdered, Image as ImageIcon, 
  Users, RefreshCw, Layers, CheckSquare2, Info, Receipt, Scale, ArrowUpRight, Search, Save, Bell, BellOff,
  Eye, EyeOff, ExternalLink, UserPlus, UserCheck, Edit3, Play, Sparkles, ArrowRight, Building2, Megaphone, Loader2, RotateCcw,
  CheckCircle2, XCircle, Camera, Target
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { CustomSelect } from '../components/ui/CustomSelect';
import { MentionInput } from '../components/ui/MentionInput';
import { Avatar } from '../components/ui/Avatar';
import styles from './EntityDrawer.module.css';
import { Skeleton, StatRowSkeleton } from '../components/ui/Skeleton';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../store/uiStore';
import { useUploadProgress } from '../contexts/UploadProgressContext';
import { PasteDropzoneArea } from '../components/ui/PasteDropzoneArea';
import { ConfirmModal } from '../components/ui/ConfirmModal';

interface WorkspaceTaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  onUpdate: () => void;
  users: any[];
  onOpenContact?: (contactId: number) => void;
  embedMode?: boolean;
  isFocusSessionActive?: boolean;
  focusTaskIndex?: number;
  focusTasksCount?: number;
  onNextFocusTask?: () => void;
  zIndex?: number;
}

const getRoleDisplayName = (user: any) => {
  if (!user) return '';
  if (user.job_title) return user.job_title;
  const roleMap: Record<string, string> = {
    super_admin: 'Super Admin',
    superadmin: 'Super Admin',
    admin: 'Admin',
    director: 'Giám đốc',
    manager: 'Quản lý',
    sales: 'Kinh doanh',
    sale: 'Kinh doanh',
    accountant: 'Kế toán',
    hr: 'Nhân sự',
    sale_admin: 'Sale Admin',
    saleadmin: 'Sale Admin',
    marketing: 'Marketing',
    viewer: 'Viewer'
  };
  return roleMap[user.role?.toLowerCase()] || user.role || '';
};

export const WorkspaceTaskDrawer: React.FC<WorkspaceTaskDrawerProps> = ({ 
  isOpen, 
  onClose, 
  task, 
  onUpdate, 
  users,
  onOpenContact,
  embedMode = false,
  isFocusSessionActive = false,
  focusTaskIndex = 0,
  focusTasksCount = 1,
  onNextFocusTask,
  zIndex
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { startUpload, updateProgress, finishUpload } = useUploadProgress();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const { showConfirm, closeConfirm } = useUIStore();
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => setIsMobileOrTablet(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [formData, setFormData] = useState<any>({});
  const [erpMeta, setErpMeta] = useState<any>({
    description: '',
    internal_type: 'task',
    scope: 'team',
    recurrence: {
      pattern: 'none',
      weekly_days: [],
      monthly_day: 1,
      days_interval: 3,
      last_generated: ''
    },
    checklist: [],
    links: []
  });

  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'timeline'>('comments');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentAttachments, setCommentAttachments] = useState<any[]>([]);
  const [replyTo, setReplyTo] = useState<{ id: number; userName: string; avatar?: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Subtask comments state
  const [selectedSubtask, setSelectedSubtask] = useState<any | null>(null);
  const [subtaskComments, setSubtaskComments] = useState<any[]>([]);
  const [loadingSubtaskComments, setLoadingSubtaskComments] = useState(false);
  const [newSubtaskCommentText, setNewSubtaskCommentText] = useState('');
  const [isSubmittingSubtaskComment, setIsSubmittingSubtaskComment] = useState(false);
  const [subtaskCommentAttachments, setSubtaskCommentAttachments] = useState<any[]>([]);
  const [subtaskCommentCounts, setSubtaskCommentCounts] = useState<Record<string, number>>({});

  const [isMuted, setIsMuted] = useState(false);
  const [loadingMute, setLoadingMute] = useState(false);
  const [showMuteConfirmModal, setShowMuteConfirmModal] = useState(false);

  const [isHidden, setIsHidden] = useState(false);
  const [loadingHide, setLoadingHide] = useState(false);

  // Meeting action modals
  const [meetingToComplete, setMeetingToComplete] = useState<any>(null);
  const [completingMeeting, setCompletingMeeting] = useState(false);
  const [proofCommentText, setProofCommentText] = useState('Ảnh minh chứng hoàn thành gặp gỡ');
  const [proofImageFile, setProofImageFile] = useState<File | null>(null);
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null);

  const [cancellingMeeting, setCancellingMeeting] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [savingCancel, setSavingCancel] = useState(false);

  const loadSubtaskCommentCounts = () => {
    if (!task?.id || task.id === 'new') return;
    api.get(`/activities/${task.id}/subtasks-comment-counts`)
      .then(res => {
        if (res.data && res.data.success) {
          setSubtaskCommentCounts(res.data.data || {});
        }
      })
      .catch(err => console.error("Lỗi lấy số lượng bình luận việc con:", err));
  };

  useEffect(() => {
    if (isOpen && task?.id && task.id !== 'new') {
      setLoadingMute(true);
      api.get(`/activities/${task.id}/mute-status`)
        .then(res => {
          if (res.data && res.data.success) {
            setIsMuted(!!res.data.is_muted);
          }
        })
        .catch(err => console.error("Lỗi lấy trạng thái thông báo task:", err))
        .finally(() => setLoadingMute(false));

      api.get(`/activities/${task.id}/hide-status`)
        .then(res => {
          if (res.data && res.data.success) {
            setIsHidden(!!res.data.is_hidden);
          }
        })
        .catch(err => console.error("Lỗi lấy trạng thái ẩn task:", err));
      
      loadSubtaskCommentCounts();
    }
  }, [isOpen, task?.id]);

  const handleBellClick = () => {
    if (!task?.id) return;
    if (!isMuted) {
      setShowMuteConfirmModal(true);
    } else {
      setLoadingMute(true);
      api.post(`/activities/${task.id}/toggle-mute`, { mute: false })
        .then(res => {
          if (res.data && res.data.success) {
            setIsMuted(false);
            toast.success(res.data.message || t('Đã bật lại thông báo cho công việc này'));
          }
        })
        .catch(err => {
          toast.error(t('Lỗi cập nhật thông báo: ') + (err.response?.data?.message || err.message));
        })
        .finally(() => setLoadingMute(false));
    }
  };

  const handleConfirmMute = () => {
    if (!task?.id) return;
    setShowMuteConfirmModal(false);
    setLoadingMute(true);
    api.post(`/activities/${task.id}/toggle-mute`, { mute: true })
      .then(res => {
        if (res.data && res.data.success) {
          setIsMuted(true);
          toast.success(res.data.message || t('Đã tắt thông báo cho công việc này'));
        }
      })
      .catch(err => {
        toast.error(t('Lỗi tắt thông báo: ') + (err.response?.data?.message || err.message));
      })
      .finally(() => setLoadingMute(false));
  };

  const handleHideClick = () => {
    if (!task?.id) return;
    if (isHidden) {
      // Unhide doesn't need confirmation
      executeToggleHide();
    } else {
      setShowHideConfirmModal(true);
    }
  };

  const executeToggleHide = () => {
    if (!task?.id) return;
    setLoadingHide(true);
    api.post(`/activities/${task.id}/toggle-hide`)
      .then(res => {
        if (res.data && res.data.success) {
          setIsHidden(res.data.is_hidden);
          toast.success(res.data.message);
          onUpdate();
        }
      })
      .catch(err => {
        toast.error(t('Lỗi cập nhật trạng thái ẩn: ') + (err.response?.data?.message || err.message));
      })
      .finally(() => setLoadingHide(false));
  };

  const handleShareTask = () => {
    if (!formData.id) return;
    const params = new URLSearchParams(window.location.search);
    params.set('task_id', String(formData.id));
    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success(t('Đã sao chép liên kết chia sẻ công việc!'));
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      toast.error(t('Không thể sao chép liên kết'));
    });
  };

  const getTomorrowString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  // Checklist adding state
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubAssignee, setNewSubAssignee] = useState('');
  const [newSubDeadline, setNewSubDeadline] = useState(getTomorrowString());
  const [newSubPriority, setNewSubPriority] = useState<string>('medium');

  // Checklist inline edit & assignee picker state
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistTitle, setEditingChecklistTitle] = useState<string>('');
  const [editingChecklistDeadline, setEditingChecklistDeadline] = useState<string>('');
  const [activeAssigneeDropdownId, setActiveAssigneeDropdownId] = useState<string | null>(null);
  const [deleteSubtaskTarget, setDeleteSubtaskTarget] = useState<{ id: string; title: string } | null>(null);
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);
  const [showHideConfirmModal, setShowHideConfirmModal] = useState(false);

  const [allowedProjects, setAllowedProjects] = useState<any[]>([]);
  const [allowedCampaigns, setAllowedCampaigns] = useState<any[]>([]);
  const [allowedTeams, setAllowedTeams] = useState<any[]>([]);

  const teamDropdownRef = useRef<HTMLDivElement>(null);
  const participantDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showTeamDropdown && teamDropdownRef.current && !teamDropdownRef.current.contains(target)) {
        setShowTeamDropdown(false);
      }
      if (showParticipantDropdown && participantDropdownRef.current && !participantDropdownRef.current.contains(target)) {
        setShowParticipantDropdown(false);
      }
      if (activeAssigneeDropdownId !== null) {
        const isTrigger = (target as HTMLElement).closest('.subtask-assignee-trigger');
        const isDropdown = (target as HTMLElement).closest('.subtask-assignee-dropdown');
        if (!isTrigger && !isDropdown) {
          setActiveAssigneeDropdownId(null);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showTeamDropdown, showParticipantDropdown, activeAssigneeDropdownId]);

  useEffect(() => {
    if (isOpen) {
      const isRosterRestricted = ['sale', 'sales', 'manager', 'director'].includes(currentUser?.role || '');
      const projUrl = isRosterRestricted ? '/projects' : '/projects?bypass_roster=1';
      const campUrl = isRosterRestricted ? '/campaigns' : '/campaigns?bypass_roster=1';
      api.get(projUrl).then(res => {
        const d = res.data.data;
        setAllowedProjects(Array.isArray(d) ? d : (d?.items || []));
      }).catch(() => {});

      api.get(campUrl).then(res => {
        const d = res.data.data;
        setAllowedCampaigns(Array.isArray(d) ? d : (d?.items || []));
      }).catch(() => {});

      api.get('/teams').then(res => {
        setAllowedTeams(res.data.data || res.data || []);
      }).catch(() => {});
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (isOpen && task && erpMeta) {
      const activeProjId = erpMeta.project_id || (task.related_type === 'project' ? task.related_id : null);
      if (activeProjId && !allowedProjects.some((p: any) => Number(p.id) === Number(activeProjId))) {
        api.get(`/projects/${activeProjId}`).then(res => {
          const pObj = res.data?.data || res.data;
          if (pObj && pObj.id) {
            setAllowedProjects(prev => {
              if (prev.some((p: any) => Number(p.id) === Number(pObj.id))) return prev;
              return [pObj, ...prev];
            });
          }
        }).catch(() => {});
      }

      const activeCampId = erpMeta.campaign_id || (task.related_type === 'campaign' ? task.related_id : null);
      if (activeCampId && !allowedCampaigns.some((c: any) => Number(c.id) === Number(activeCampId))) {
        api.get(`/campaigns/${activeCampId}`).then(res => {
          const cObj = res.data?.data || res.data;
          if (cObj && cObj.id) {
            setAllowedCampaigns(prev => {
              if (prev.some((c: any) => Number(c.id) === Number(cObj.id))) return prev;
              return [cObj, ...prev];
            });
          }
        }).catch(() => {});
      }
    }
  }, [isOpen, task, erpMeta?.project_id, erpMeta?.campaign_id, allowedProjects.length, allowedCampaigns.length]);

  // Resource adding state
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const editorRef = React.useRef(null);
  const isFocusedRef = React.useRef(false);

  const handleEditorCommand = (command, value = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setErpMeta((prev) => ({ ...prev, description: html }));
    }
  };

  const handleEditorAddLink = () => {
    const url = prompt(t('Nhập đường dẫn URL (ví dụ: https://example.com):'));
    if (url) {
      // Ensure absolute URL prefix
      const absoluteUrl = url.match(/^https?:\/\//) ? url : 'https://' + url;
      handleEditorCommand('createLink', absoluteUrl);
    }
  };

  // Sync description from backend ONLY when user is not actively typing/focused
  useEffect(() => {
    if (!isFocusedRef.current && editorRef.current) {
      editorRef.current.innerHTML = erpMeta?.description || '';
    }
  }, [erpMeta?.description, task?.id]);

  const handleEditorUploadImage = () => {
    let savedRange = null;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const toastId = toast.loading(t('Đang tải ảnh lên...'));
      const fd = new FormData();
      fd.append('file', file);

      try {
        const res = await api.post('/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const fileUrl = res.data?.data?.url || res.data?.url;
        if (res.data && res.data.success && fileUrl) {
          toast.success(t('Tải ảnh lên thành công!'), { id: toastId });

          const apiBase = import.meta.env.VITE_API_URL || '/backend';
          let resolvedUrl = fileUrl;
          if (fileUrl && fileUrl.startsWith('uploads/')) {
            resolvedUrl = `${apiBase}/${fileUrl}`;
          } else if (fileUrl && fileUrl.startsWith('storage/uploads/')) {
            resolvedUrl = `${apiBase}/${fileUrl.replace('storage/uploads/', 'uploads/')}`;
          }

          // Create image node directly
          const img = document.createElement('img');
          img.src = resolvedUrl;
          img.alt = 'Uploaded Image';
          img.style.maxWidth = '100%';
          img.style.borderRadius = '8px';
          img.style.margin = '8px 0';
          img.style.display = 'block';

          if (editorRef.current) {
            editorRef.current.focus();
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              if (savedRange) {
                selection.addRange(savedRange);
              }
            }

            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.deleteContents();
              range.insertNode(img);
              range.setStartAfter(img);
              range.setEndAfter(img);
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              editorRef.current.appendChild(img);
            }

            const html = editorRef.current.innerHTML;
            setErpMeta((prev) => ({ ...prev, description: html }));
            handleSaveMeta({ ...erpMeta, description: html });
          }
        } else {
          toast.error(res.data?.message || t('Lỗi tải tệp lên'), { id: toastId });
        }
      } catch (err) {
        toast.error(t('Lỗi kết nối tải tệp: ') + err.message, { id: toastId });
      }
    };
    input.click();
  };

  const handleEditorPaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    let imageFile = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageFile = items[i].getAsFile();
        break;
      }
    }

    if (imageFile) {
      e.preventDefault();
      
      let savedRange = null;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }

      const toastId = toast.loading(t('Đang tải ảnh chụp màn hình lên...'));
      const fd = new FormData();
      fd.append('file', imageFile);

      try {
        const res = await api.post('/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const fileUrl = res.data?.data?.url || res.data?.url;
        if (res.data && res.data.success && fileUrl) {
          toast.success(t('Tải ảnh lên thành công!'), { id: toastId });

          const apiBase = import.meta.env.VITE_API_URL || '/backend';
          let resolvedUrl = fileUrl;
          if (fileUrl && fileUrl.startsWith('uploads/')) {
            resolvedUrl = `${apiBase}/${fileUrl}`;
          } else if (fileUrl && fileUrl.startsWith('storage/uploads/')) {
            resolvedUrl = `${apiBase}/${fileUrl.replace('storage/uploads/', 'uploads/')}`;
          }

          // Create image node directly
          const img = document.createElement('img');
          img.src = resolvedUrl;
          img.alt = 'Pasted Image';
          img.style.maxWidth = '100%';
          img.style.borderRadius = '8px';
          img.style.margin = '8px 0';
          img.style.display = 'block';

          if (editorRef.current) {
            editorRef.current.focus();
            const selection = window.getSelection();
            if (selection) {
              selection.removeAllRanges();
              if (savedRange) {
                selection.addRange(savedRange);
              }
            }

            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.deleteContents();
              range.insertNode(img);
              range.setStartAfter(img);
              range.setEndAfter(img);
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              editorRef.current.appendChild(img);
            }

            const html = editorRef.current.innerHTML;
            setErpMeta((prev) => ({ ...prev, description: html }));
            handleSaveMeta({ ...erpMeta, description: html });
          }
        } else {
          toast.error(res.data?.message || t('Lỗi tải tệp lên'), { id: toastId });
        }
      } catch (err) {
        toast.error(t('Lỗi kết nối tải tệp: ') + err.message, { id: toastId });
      }
    }
  };
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  const renderFormattedText = (text) => {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Pinned/Campaign specific state
  const [isPinned, setIsPinned] = useState(false);
  const [campaignTarget, setCampaignTarget] = useState('');
  
  // Validation and approval modals state
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showApprovalSuccessModal, setShowApprovalSuccessModal] = useState<string | null>(null);

  // Participants modal state
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participantsSearch, setParticipantsSearch] = useState('');
  const [selectedSubtaskForParticipants, setSelectedSubtaskForParticipants] = useState<any | null>(null);
  const [showAddParticipantsSection, setShowAddParticipantsSection] = useState(false);

  // Contacts state
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [originalHash, setOriginalHash] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setLoadingContacts(true);
      api.get('/contacts?limit=200').then(async res => {
        if (res.data && res.data.success) {
          let list = res.data.data.items || res.data.data || [];
          const activeContactId = task?.contact_id || (task?.related_type === 'contact' ? task?.related_id : null);
          if (activeContactId && !list.some((c: any) => Number(c.id) === Number(activeContactId))) {
            try {
              const singleRes = await api.get(`/contacts/${activeContactId}`);
              const cObj = singleRes.data?.data || singleRes.data;
              if (cObj && cObj.id) {
                list = [cObj, ...list];
              }
            } catch (err) {
              console.error("Lỗi tải contact chi tiết:", err);
            }
          }
          setContacts(list);
        }
      }).catch(err => {
        console.error("Lỗi tải danh sách khách hàng:", err);
      }).finally(() => {
        setLoadingContacts(false);
      });
    }
  }, [isOpen, task]);

  const loadComments = async (taskId: number) => {
    setLoadingComments(true);
    try {
      const res = await api.get(`/activities/${taskId}/comments`);
      if (res.data && res.data.success) {
        setComments(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!task?.id || task.id === 'new') return;
    try {
      const res = await api.delete(`/activities/comments/${commentId}`);
      if (res.data && res.data.success) {
        loadComments(task.id);
        loadTimeline(task.id);
        toast.success(t('Đã xóa bình luận!'));
      } else {
        toast.error(res.data?.message || t('Không thể xóa bình luận'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi khi xóa bình luận: ') + e.message);
    }
  };

  const loadTimeline = async (taskId: number) => {
    setLoadingTimeline(true);
    try {
      const res = await api.get(`/activities/${taskId}/timeline`);
      if (res.data && res.data.success) {
        setTimeline(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const loadSubtaskComments = async (taskId: number, subtaskId: string) => {
    setLoadingSubtaskComments(true);
    try {
      const res = await api.get(`/activities/${taskId}/comments?subtask_id=${subtaskId}`);
      if (res.data && res.data.success) {
        setSubtaskComments(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSubtaskComments(false);
    }
  };

  useEffect(() => {
    if (task && task.id !== 'new' && selectedSubtask) {
      loadSubtaskComments(Number(task.id), selectedSubtask.id);
    }
  }, [selectedSubtask]);

  useEffect(() => {
    if (isOpen && task && erpMeta?.checklist) {
      const targetSubtaskId = searchParams.get('subtask_id');
      if (targetSubtaskId) {
        const found = erpMeta.checklist.find((item: any) => String(item.id) === String(targetSubtaskId));
        if (found) {
          setSelectedSubtask(found);
        }
      }
    }
  }, [isOpen, task, erpMeta?.checklist]);

  useEffect(() => {
    if (subtaskComments.length > 0) {
      const targetSubtaskId = searchParams.get('subtask_id');
      const highlightCommentId = searchParams.get('comment_id') || searchParams.get('highlight_comment_id');
      if (targetSubtaskId && highlightCommentId) {
        setTimeout(() => {
          const element = document.getElementById(`workspace-comment-${highlightCommentId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.backgroundColor = 'var(--color-primary-light)';
            setTimeout(() => {
              element.style.backgroundColor = 'var(--color-surface)';
            }, 2500);

            // Clean URL parameters
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('subtask_id');
            newParams.delete('comment_id');
            newParams.delete('highlight_comment_id');
            setSearchParams(newParams, { replace: true });
          }
        }, 500);
      }
    }
  }, [subtaskComments]);

  useEffect(() => {
    if (comments.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const highlightCommentId = params.get('comment_id') || params.get('highlight_comment_id');
      if (highlightCommentId && !params.get('subtask_id')) {
        setTimeout(() => {
          const element = document.getElementById(`workspace-comment-${highlightCommentId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.backgroundColor = '#fef08a'; // yellow-200
            setTimeout(() => {
              element.style.backgroundColor = 'rgba(0, 0, 0, 0.01)';
            }, 2500);
            
            // Clean URL parameters
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('comment_id');
            newParams.delete('highlight_comment_id');
            setSearchParams(newParams, { replace: true });
          }
        }, 300);
      }
    }
  }, [comments]);

  useEffect(() => {
    if (isOpen && !embedMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, embedMode]);

  useEffect(() => {
    if (task) {
      const isSaleRole = currentUser?.role as string === 'sale';
      const defaultUserId = task.user_id || (isSaleRole ? currentUser.id : null);
      const normalizedTask = {
        ...task,
        subject: task.subject || task.title || '',
        body: task.body || task.description || '',
        user_id: defaultUserId ? Number(defaultUserId) : null,
        created_by: task.id === 'new' ? currentUser?.id : task.created_by,
        created_by_name: task.id === 'new' ? (currentUser?.name || (currentUser as any)?.full_name || '') : task.created_by_name,
        created_by_avatar: task.id === 'new' ? (currentUser?.avatar || (currentUser as any)?.avatar_url || '') : task.created_by_avatar,
        contact_id: task.contact_id || (task.related_type === 'contact' ? task.related_id : null)
      };
      setFormData(normalizedTask);
      setIsPinned(normalizedTask.tags?.includes('pinned') || false);

      // Parse erp metadata from task body
      let parsedMeta: any = {
        description: normalizedTask.body || '',
        internal_type: 'task',
        scope: 'team',
        recurrence: { pattern: 'none', weekly_days: [], monthly_day: 1, days_interval: 3, last_generated: '' },
        checklist: [],
        links: [],
        project_id: normalizedTask.related_type === 'project' ? normalizedTask.related_id : null,
        campaign_id: normalizedTask.related_type === 'campaign' ? normalizedTask.related_id : null,
        team_id: normalizedTask.related_type === 'team' ? normalizedTask.related_id : null
      };

      if (normalizedTask.body) {
        let currentBody = normalizedTask.body.trim();
        let wasParsed = false;
        while (currentBody.startsWith('{"erp_task"') || currentBody.startsWith('{"erp_task":')) {
          try {
            const parsed = JSON.parse(currentBody);
            parsedMeta = { ...parsedMeta, ...parsed.erp_task };
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
        if (!wasParsed) {
          parsedMeta.description = normalizedTask.body;
        } else {
          parsedMeta.description = currentBody;
        }
      }

      if (normalizedTask.related_type === 'project' && normalizedTask.related_id) {
        parsedMeta.project_id = normalizedTask.related_id;
      }
      if (normalizedTask.related_type === 'campaign' && normalizedTask.related_id) {
        parsedMeta.campaign_id = normalizedTask.related_id;
      }
      if (normalizedTask.related_type === 'team' && normalizedTask.related_id) {
        parsedMeta.team_id = normalizedTask.related_id;
      }

      setErpMeta(parsedMeta);
      setCampaignTarget(parsedMeta.campaign_target || '');
      if (normalizedTask.id !== 'new') {
        loadComments(normalizedTask.id);
        loadTimeline(normalizedTask.id);
      } else {
        setComments([]);
        setTimeline([]);
      }

      // Compute and store original hash
      const cleanObj = (obj: any) => {
        const clean: any = {};
        Object.keys(obj || {}).forEach(key => {
          if (['created_at', 'updated_at', 'deleted_at', 'created_by_name', 'created_by_avatar', 'contact_name', 'contact_avatar', 'user_name'].includes(key)) {
            return;
          }
          const val = obj[key];
          clean[key] = (val === null || val === undefined) ? '' : val;
        });
        return clean;
      };

      setOriginalHash(JSON.stringify({
        formData: cleanObj(normalizedTask),
        erpMeta: cleanObj(parsedMeta)
      }));
    }
  }, [task]);

  const validateRecurrence = (meta: any): { isValid: boolean; error?: string } => {
    const rec = meta?.recurrence;
    if (!rec || rec.pattern === 'none') {
      return { isValid: true };
    }
    
    if (rec.pattern === 'weekly') {
      if (!rec.weekly_days || rec.weekly_days.length === 0) {
        return { 
          isValid: false, 
          error: t('Vui lòng chọn ít nhất một ngày trong tuần để lặp lại!') 
        };
      }
    }
    
    if (rec.pattern === 'monthly') {
      const day = Number(rec.monthly_day);
      if (isNaN(day) || day < 1 || day > 31) {
        return { 
          isValid: false, 
          error: t('Vui lòng chọn một ngày hợp lệ trong tháng (từ 1 đến 31)!') 
        };
      }
    }
    
    if (rec.pattern === 'custom_days') {
      const interval = Number(rec.days_interval);
      if (isNaN(interval) || interval < 1) {
        return { 
          isValid: false, 
          error: t('Vui lòng chọn khoảng thời gian lặp lại hợp lệ (từ 1 ngày trở lên)!') 
        };
      }
    }
    
    return { isValid: true };
  };

  const linkifyHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>|(<[^>]+>)|(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi, (match, aContent, htmlTag, url) => {
      if (aContent) return match;
      if (htmlTag) return match;
      if (url) {
        const href = url.startsWith('www.') ? `https://${url}` : url;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); text-decoration: underline; word-break: break-all;">${url}</a>`;
      }
      return match;
    });
  };

  const renderCommentContent = (text: string) => {
    if (!text) return '';
    const regex = /(https?:\/\/[^\s]+|@[\p{L}\p{N}_()]+)/gu;
    const parts = text.split(regex);
    return parts.map((part, idx) => {
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--color-primary)',
              textDecoration: 'underline',
              wordBreak: 'break-all'
            }}
          >
            {part}
          </a>
        );
      } else if (part.startsWith('@')) {
        const cleanName = (n: string) => (n || '').trim().replace(/\s+/g, '_').toLowerCase().replace(/_\([^)]+\)/g, '').replace(/\([^)]+\)/g, '');
        const cleanMentionVal = cleanName(part.substring(1));
        const taggedUser = users.find((u: any) => {
          const normalizedUser = cleanName(u.full_name || u.name || u.fullname || u.username);
          return normalizedUser === cleanMentionVal;
        });

        const displayName = taggedUser?.full_name || taggedUser?.name || taggedUser?.fullname || taggedUser?.username || part.substring(1).replace(/_/g, ' ');
        const avatarUrl = taggedUser?.avatar_url || taggedUser?.avatar;
        const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';

        return (
          <span
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#dc2626',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '2px 8px',
              borderRadius: '9999px',
              margin: '0 2px',
              fontWeight: 600,
              fontSize: '0.85em',
              verticalAlign: 'middle'
            }}
          >
            <Avatar name={displayName} src={avatarUrl} size={16} />
            @{displayName}
          </span>
        );
      }
      return part;
    });
  };

  const handleSaveMeta = async (updatedMeta: any) => {
    if (!task) return;

    // Recurrence validation
    const validation = validateRecurrence(updatedMeta);
    if (!validation.isValid) {
      setErpMeta(updatedMeta);
      toast.error(validation.error);
      return;
    }

    if (task.id === 'new') {
      setErpMeta(updatedMeta);
      return;
    }
    try {
      const bodyPayload = JSON.stringify({ erp_task: updatedMeta });
      let finalTags = task.tags || '';

      // Manage pinned tag
      if (updatedMeta.internal_type === 'announcement') {
        if (isPinned && !finalTags.includes('pinned')) {
          finalTags += (finalTags ? ',' : '') + 'pinned';
        } else if (!isPinned && finalTags.includes('pinned')) {
          finalTags = finalTags.split(',').filter((t: string) => t !== 'pinned').join(',');
        }
      }

      // Sync tags with type
      const newTag = `internal_${updatedMeta.internal_type}`;
      let tagArray = finalTags.split(',').map((t: string) => t.trim()).filter(Boolean);
      tagArray = tagArray.filter((t: string) => !t.startsWith('internal_'));
      tagArray.push(newTag);
      finalTags = tagArray.join(',');

      let relType = null;
      let relId = null;

      if (updatedMeta.project_id) {
        relType = 'project';
        relId = updatedMeta.project_id;
      } else if (updatedMeta.campaign_id) {
        relType = 'campaign';
        relId = updatedMeta.campaign_id;
      } else if (updatedMeta.team_id) {
        relType = 'team';
        relId = updatedMeta.team_id;
      } else if (formData.contact_id || formData.related_id) {
        relType = 'contact';
        relId = formData.contact_id || formData.related_id;
      }

      const finalContactId = formData.contact_id || (formData.related_type === 'contact' ? formData.related_id : null);

      const payload: any = {
        body: bodyPayload,
        tags: finalTags,
        progress: formData.progress,
        priority: formData.priority,
        status: formData.status,
        due_date: formData.due_date,
        subject: formData.subject,
        user_id: formData.user_id,
        related_type: relType,
        related_id: relId ? Number(relId) : null,
        contact_id: finalContactId ? Number(finalContactId) : null
      };

      const res = await api.put(`/activities/${task.id}`, payload);
      if (res.data && res.data.success) {
        setErpMeta(updatedMeta);
        
        const cleanObj = (obj: any) => {
          const clean: any = {};
          Object.keys(obj || {}).forEach(key => {
            if (['created_at', 'updated_at', 'deleted_at', 'created_by_name', 'created_by_avatar', 'contact_name', 'contact_avatar', 'user_name'].includes(key)) {
              return;
            }
            const val = obj[key];
            clean[key] = (val === null || val === undefined) ? '' : val;
          });
          return clean;
        };
        setOriginalHash(JSON.stringify({
          formData: cleanObj(formData),
          erpMeta: cleanObj(updatedMeta)
        }));

        onUpdate();
      }
    } catch (e: any) {
      toast.error(t('Lỗi lưu thay đổi: ') + e.message);
    }
  };

  const handleManualSave = async () => {
    if (!task) return;
    
    // Validation: Require approval must have an approver selected
    if (formData.require_approval === 1 && !formData.approver_id) {
      setShowValidationModal(true);
      return;
    }

    setIsSaving(true);
    try {
      const isJustSubmittedForApproval = 
        task.id !== 'new' &&
        formData.progress === 100 &&
        formData.require_approval === 1 &&
        formData.approver_id &&
        formData.approval_status === 'pending' &&
        (task.progress !== 100 || task.approval_status !== 'pending');

      const approverName = isJustSubmittedForApproval
        ? users.find(u => Number(u.id) === Number(formData.approver_id))?.full_name || 'Người duyệt'
        : null;

      // Sync description
      const finalDesc = erpMeta.description || '';
      const updatedErpMeta = {
        ...erpMeta,
        description: finalDesc
      };

      const bodyPayload = JSON.stringify({ erp_task: updatedErpMeta });
      let finalTags = formData.tags || '';

      // Manage pinned tag
      if (updatedErpMeta.internal_type === 'announcement') {
        if (isPinned && !finalTags.includes('pinned')) {
          finalTags += (finalTags ? ',' : '') + 'pinned';
        } else if (!isPinned && finalTags.includes('pinned')) {
          finalTags = finalTags.split(',').filter((t: string) => t !== 'pinned').join(',');
        }
      }

      // Sync tags with type
      const newTag = `internal_${updatedErpMeta.internal_type}`;
      let tagArray = finalTags.split(',').map((t: string) => t.trim()).filter(Boolean);
      tagArray = tagArray.filter((t: string) => !t.startsWith('internal_'));
      tagArray.push(newTag);
      finalTags = tagArray.join(',');

      let relType = null;
      let relId = null;

      if (updatedErpMeta.project_id) {
        relType = 'project';
        relId = updatedErpMeta.project_id;
      } else if (updatedErpMeta.campaign_id) {
        relType = 'campaign';
        relId = updatedErpMeta.campaign_id;
      } else if (updatedErpMeta.team_id) {
        relType = 'team';
        relId = updatedErpMeta.team_id;
      } else if (formData.contact_id || formData.related_id) {
        relType = 'contact';
        relId = formData.contact_id || formData.related_id;
      }

      const finalContactId = formData.contact_id || (formData.related_type === 'contact' ? formData.related_id : null);

      const payload: any = {
        subject: formData.subject || formData.title || '',
        description: finalDesc,
        body: bodyPayload,
        tags: finalTags,
        progress: formData.progress || 0,
        priority: formData.priority || 'medium',
        status: formData.status || 'planned',
        due_date: formData.due_date || new Date().toISOString().slice(0, 10),
        user_id: formData.user_id ? Number(formData.user_id) : null,
        created_by: formData.created_by ? Number(formData.created_by) : null,
        require_approval: formData.require_approval || 0,
        approver_id: formData.require_approval === 1 ? Number(formData.approver_id) : null,
        approval_status: formData.approval_status || 'none',
        participant_ids: formData.participant_ids ? String(formData.participant_ids) : null,
        related_id: relId ? Number(relId) : null,
        related_type: relType,
        contact_id: finalContactId ? Number(finalContactId) : null
      };

      let res;
      if (task.id === 'new') {
        res = await api.post('/activities', {
          ...payload,
          type: 'task'
        });
      } else {
        res = await api.put(`/activities/${task.id}`, payload);
      }

      if (res.data && res.data.success) {
        const taskName = formData.subject || t('Không có tiêu đề');
        toast.success(task.id === 'new' 
          ? t('Đã tạo công việc "{subject}" thành công!').replace('{subject}', taskName) 
          : t('Đã lưu các thay đổi của công việc "{subject}" thành công!').replace('{subject}', taskName)
        );
        setOriginalHash(currentHash);
        onUpdate();
        
        if (isJustSubmittedForApproval && approverName) {
          toast.success(t('Đã gửi thông báo email phê duyệt tới {name}!').replace('{name}', approverName));
          setShowApprovalSuccessModal(approverName);
        }

        if (task.id === 'new') {
          onClose();
        }
      }
    } catch (e: any) {
      const taskName = formData.subject || t('Không có tiêu đề');
      toast.error(t('Không thể lưu thay đổi cho công việc "{subject}": ').replace('{subject}', taskName) + (e.response?.data?.message || e.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDrawer = () => {
    if (formData.require_approval === 1 && !formData.approver_id) {
      setShowValidationModal(true);
      return;
    }
    onClose();
  };

  const handleDeleteTask = async () => {
    if (!task?.id || task.id === 'new') return;
    
    showConfirm({
      title: t('Xóa công việc?'),
      message: t('Bạn có chắc chắn muốn xóa vĩnh viễn công việc này? Thao tác này không thể hoàn tác.'),
      isDanger: true,
      confirmText: t('Xác nhận xóa'),
      onConfirm: async () => {
        try {
          const res = await api.delete(`/activities/${task.id}`);
          if (res.data.success) {
            toast.success(t('Đã xóa công việc'));
            onUpdate();
            onClose();
          } else {
            toast.error(res.data.message || t('Không có quyền xóa'));
          }
        } catch (err: any) {
          toast.error(err.response?.data?.message || t('Lỗi kết nối server'));
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const isAdminOrManager = ['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes(currentUser?.role || '');
  const isAssignee = Number(currentUser?.id) === Number(formData.user_id || task?.user_id);
  const isCreator = Number(currentUser?.id) === Number(formData.created_by || task?.created_by);
  const isApprover = Number(currentUser?.id) === Number(formData.approver_id || task?.approver_id);
  const canDelete = task?.id && task.id !== 'new' && (isAdminOrManager || isAssignee || isCreator || isApprover);

  const handleUpdateField = async (field: string, value: any) => {
    if (!task) return;
    if (task.id === 'new') {
      setFormData((prev: any) => ({ ...prev, [field]: value }));
      return;
    }
    try {
      const payload: any = { [field]: value };
      const res = await api.put(`/activities/${task.id}`, payload);
      if (res.data && res.data.success) {
        setFormData((prev: any) => {
          const nextData = { ...prev, [field]: value };
          
          const cleanObj = (obj: any) => {
            const clean: any = {};
            Object.keys(obj || {}).forEach(key => {
              if (['created_at', 'updated_at', 'deleted_at', 'created_by_name', 'created_by_avatar', 'contact_name', 'contact_avatar', 'user_name'].includes(key)) {
                return;
              }
              const val = obj[key];
              clean[key] = (val === null || val === undefined) ? '' : val;
            });
            return clean;
          };
          setOriginalHash(JSON.stringify({
            formData: cleanObj(nextData),
            erpMeta: cleanObj(erpMeta)
          }));

          return nextData;
        });
        onUpdate();
        loadTimeline(task.id);
      }
    } catch (e: any) {
      toast.error(t('Lỗi cập nhật: ') + e.message);
    }
  };

  // Checklist Actions
  const handleAddChecklistItem = () => {
    const titles = newSubTitle.split('\n').map(t => t.trim()).filter(Boolean);
    if (titles.length === 0) {
      toast.error(t('Vui lòng nhập tên công việc con'));
      return;
    }
    
    let currentParticipantIds = getParticipantIds(formData.participant_ids);
    const newItems = titles.map((title, idx) => {
      const itemId = 'sub_' + (Date.now() + idx);
      const assigneeId = newSubAssignee ? Number(newSubAssignee) : null;
      if (assigneeId) {
        const idStr = String(assigneeId);
        if (!currentParticipantIds.includes(idStr)) {
          currentParticipantIds.push(idStr);
        }
      }
      return {
        id: itemId,
        title: title,
        assignee_id: assigneeId,
        due_date: newSubDeadline || null,
        priority: newSubPriority || 'medium',
        done: false
      };
    });

    const newChecklist = [...(erpMeta.checklist || []), ...newItems];
    const updatedMeta = { ...erpMeta, checklist: newChecklist };
    handleSaveMeta(updatedMeta);

    const nextString = currentParticipantIds.join(',');
    if (formData.participant_ids !== nextString) {
      setFormData((prev: any) => ({ ...prev, participant_ids: nextString }));
      handleUpdateField('participant_ids', nextString);
    }

    // Reset input
    setNewSubTitle('');
    setNewSubAssignee('');
    setNewSubDeadline(getTomorrowString());
    setNewSubPriority('medium');
    setShowAddChecklist(false);
    toast.success(t('Đã thêm việc con'));
  };

  const handleToggleChecklist = (itemId: string) => {
    const updatedChecklist = erpMeta.checklist.map((item: any) => {
      if (item.id === itemId) {
        return { ...item, done: !item.done };
      }
      return item;
    });

    const updatedMeta = { ...erpMeta, checklist: updatedChecklist };
    handleSaveMeta(updatedMeta);
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    const updatedChecklist = erpMeta.checklist.filter((item: any) => item.id !== itemId);
    const updatedMeta = { ...erpMeta, checklist: updatedChecklist };
    handleSaveMeta(updatedMeta);
    toast.success(t('Đã xóa việc con'));
  };

  const handleUpdateChecklistItemTitle = (itemId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    const updatedChecklist = erpMeta.checklist.map((item: any) => {
      if (item.id === itemId) {
        return { ...item, title: newTitle.trim() };
      }
      return item;
    });
    const updatedMeta = { ...erpMeta, checklist: updatedChecklist };
    handleSaveMeta(updatedMeta);
    toast.success(t('Đã cập nhật tiêu đề việc con'));
  };

  const handleUpdateChecklistItem = (itemId: string, newTitle: string, newDeadline: string) => {
    if (!newTitle.trim()) return;
    const updatedChecklist = erpMeta.checklist.map((item: any) => {
      if (item.id === itemId) {
        return { 
          ...item, 
          title: newTitle.trim(),
          due_date: newDeadline || null
        };
      }
      return item;
    });
    const updatedMeta = { ...erpMeta, checklist: updatedChecklist };
    handleSaveMeta(updatedMeta);
    toast.success(t('Đã cập nhật công việc con'));
  };

  const handleUpdateChecklistItemAssignee = (itemId: string, newAssigneeId: string) => {
    const updatedChecklist = erpMeta.checklist.map((item: any) => {
      if (item.id === itemId) {
        return { ...item, assignee_id: newAssigneeId };
      }
      return item;
    });

    if (newAssigneeId) {
      const newAssignees = String(newAssigneeId).split(',').map(id => id.trim()).filter(Boolean);
      const current = getParticipantIds(formData.participant_ids);
      let changed = false;
      newAssignees.forEach(id => {
        if (!current.includes(id)) {
          current.push(id);
          changed = true;
        }
      });
      if (changed) {
        const nextString = current.join(',');
        setFormData((prev: any) => ({ ...prev, participant_ids: nextString }));
        handleUpdateField('participant_ids', nextString);
      }
    }

    const updatedMeta = { ...erpMeta, checklist: updatedChecklist };
    handleSaveMeta(updatedMeta);
    toast.success(t('Đã phân công nhân sự thực hiện'));
  };

  // Resources Actions
  const handleAddLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) {
      toast.error(t('Nhãn và URL không được để trống'));
      return;
    }
    const newLink = {
      label: newLinkLabel.trim(),
      url: newLinkUrl.trim().startsWith('http') ? newLinkUrl.trim() : 'https://' + newLinkUrl.trim()
    };
    const newLinks = [...(erpMeta.links || []), newLink];
    const updatedMeta = { ...erpMeta, links: newLinks };
    handleSaveMeta(updatedMeta);

    setNewLinkLabel('');
    setNewLinkUrl('');
    toast.success(t('Đã thêm liên kết'));
  };

  const handleDeleteLink = (index: number) => {
    const newLinks = erpMeta.links.filter((_: any, i: number) => i !== index);
    const updatedMeta = { ...erpMeta, links: newLinks };
    handleSaveMeta(updatedMeta);
    toast.success(t('Đã xóa liên kết'));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    const taskId = startUpload(file.name, sizeStr);

    const fd = new FormData();
    fd.append('file', file);

    try {
      updateProgress(taskId, 20, 'uploading');
      const res = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            updateProgress(taskId, percent, percent === 100 ? 'processing' : 'uploading');
          }
        }
      });
      const fileUrl = res.data?.data?.url || res.data?.url;
      if (res.data && res.data.success && fileUrl) {
        finishUpload(taskId, true);
        // Add to resources links
        const newResource = {
          label: file.name,
          url: fileUrl,
          is_file: true
        };
        const newLinks = [...(erpMeta.links || []), newResource];
        const updatedMeta = { ...erpMeta, links: newLinks };
        handleSaveMeta(updatedMeta);
        toast.success(t('Tải lên tài liệu thành công!'));
      } else {
        finishUpload(taskId, false, res.data?.message || t('Lỗi tải tệp lên'));
        toast.error(res.data?.message || t('Lỗi tải tệp lên'));
      }
    } catch (err: any) {
      finishUpload(taskId, false, err.message || t('Lỗi kết nối tải tệp'));
      toast.error(t('Lỗi kết nối tải tệp: ') + err.message);
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handlePasteDropzoneUpload = async (item: { file?: File; url?: string; label: string }) => {
    if (item.url) {
      const newResource = {
        label: item.label || item.url,
        url: item.url,
        is_file: false
      };
      const newLinks = [...(erpMeta.links || []), newResource];
      const updatedMeta = { ...erpMeta, links: newLinks };
      handleSaveMeta(updatedMeta);
      toast.success(t('Thêm liên kết đính kèm thành công!'));
      return;
    }

    if (item.file) {
      const file = item.file;
      setUploadingFile(true);
      const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
      const taskId = startUpload(item.label || file.name, sizeStr);

      const fd = new FormData();
      fd.append('file', file);

      try {
        updateProgress(taskId, 20, 'uploading');
        const res = await api.post('/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              updateProgress(taskId, percent, percent === 100 ? 'processing' : 'uploading');
            }
          }
        });

        const fileUrl = res.data?.data?.url || res.data?.url;
        if (res.data && res.data.success && fileUrl) {
          finishUpload(taskId, true);
          const newResource = {
            label: item.label || file.name,
            url: fileUrl,
            is_file: true
          };
          const newLinks = [...(erpMeta.links || []), newResource];
          const updatedMeta = { ...erpMeta, links: newLinks };
          handleSaveMeta(updatedMeta);
          toast.success(t('Tải lên đính kèm thành công!'));
        } else {
          finishUpload(taskId, false, res.data?.message || t('Lỗi tải tệp lên'));
          toast.error(res.data?.message || t('Lỗi tải tệp lên'));
        }
      } catch (err: any) {
        finishUpload(taskId, false, err.message || t('Lỗi kết nối tải tệp'));
        toast.error(t('Lỗi kết nối tải tệp: ') + err.message);
      } finally {
        setUploadingFile(false);
      }
    }
  };

  // Comment Attachments Upload
  const addLocalTaskCommentAttachment = (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('Dung lượng tệp đính kèm không được vượt quá 10MB'));
      return;
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setCommentAttachments(prev => [...prev, { file, name: file.name, previewUrl }]);
    toast.success(t('Đã thêm tệp đính kèm!'));
  };

  const handleCommentAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addLocalTaskCommentAttachment(file);
    e.target.value = '';
  };

  const removeTaskCommentAttachment = (index: number) => {
    setCommentAttachments(prev => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handlePostComment = async () => {
    if (!newCommentText.trim() && commentAttachments.length === 0) return;
    setIsSubmittingComment(true);
    setUploadingFile(true);

    try {
      const uploadedUrls: string[] = [];
      for (const att of commentAttachments) {
        if (att.url) {
          uploadedUrls.push(att.url);
        } else if (att.file) {
          const sizeStr = (att.file.size / (1024 * 1024)).toFixed(1) + ' MB';
          const taskId = startUpload(att.name, sizeStr);

          const fd = new FormData();
          fd.append('file', att.file);

          updateProgress(taskId, 20, 'uploading');
          const res = await api.post('/upload', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                updateProgress(taskId, percent, percent === 100 ? 'processing' : 'uploading');
              }
            }
          });
          const fileUrl = res.data?.data?.url || res.data?.url;
          if (fileUrl) {
            finishUpload(taskId, true);
            uploadedUrls.push(fileUrl);
            if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
          } else {
            finishUpload(taskId, false, res.data?.message || t('Lỗi tải tệp lên'));
            throw new Error(res.data?.message || t('Lỗi tải tệp lên'));
          }
        }
      }

      const commentText = newCommentText.trim();
      setNewCommentText('');
      setCommentAttachments([]);
      setReplyTo(null);

      const res = await api.post(`/activities/${task.id}/comments`, {
        content: commentText,
        attachments: uploadedUrls,
        parent_id: replyTo ? replyTo.id : null
      });

      if (res.data && res.data.success) {
        loadComments(task.id);
        loadTimeline(task.id);
        toast.success(t('Đã thêm bình luận!'));
      }
    } catch (e: any) {
      toast.error(t('Không thể gửi bình luận: ') + e.message);
    } finally {
      setIsSubmittingComment(false);
      setUploadingFile(false);
    }
  };

  // Subtask Comment Attachments Upload Helpers
  const addLocalSubtaskCommentAttachment = (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('Dung lượng tệp đính kèm không được vượt quá 10MB'));
      return;
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setSubtaskCommentAttachments(prev => [...prev, { file, name: file.name, previewUrl }]);
    toast.success(t('Đã thêm tệp đính kèm!'));
  };

  const handleSubtaskCommentAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addLocalSubtaskCommentAttachment(file);
    e.target.value = '';
  };

  const removeSubtaskCommentAttachment = (index: number) => {
    setSubtaskCommentAttachments(prev => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handlePostSubtaskComment = async () => {
    if (!task || !selectedSubtask) return;
    if (!newSubtaskCommentText.trim() && subtaskCommentAttachments.length === 0) return;
    setIsSubmittingSubtaskComment(true);
    setUploadingFile(true);

    try {
      const uploadedUrls: string[] = [];
      for (const att of subtaskCommentAttachments) {
        if (att.file) {
          const sizeStr = (att.file.size / (1024 * 1024)).toFixed(1) + ' MB';
          const taskId = startUpload(att.name, sizeStr);

          const fd = new FormData();
          fd.append('file', att.file);

          updateProgress(taskId, 20, 'uploading');
          const res = await api.post('/upload', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                updateProgress(taskId, percent, percent === 100 ? 'processing' : 'uploading');
              }
            }
          });
          const fileUrl = res.data?.data?.url || res.data?.url;
          if (fileUrl) {
            finishUpload(taskId, true);
            uploadedUrls.push(fileUrl);
            if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
          } else {
            finishUpload(taskId, false, res.data?.message || t('Lỗi tải tệp lên'));
            throw new Error(res.data?.message || t('Lỗi tải tệp lên'));
          }
        }
      }

      const commentText = newSubtaskCommentText.trim();
      setNewSubtaskCommentText('');
      setSubtaskCommentAttachments([]);

      const res = await api.post(`/activities/${task.id}/comments`, {
        content: commentText,
        attachments: uploadedUrls,
        subtask_id: selectedSubtask.id
      });

      if (res.data && res.data.success) {
        loadSubtaskComments(Number(task.id), selectedSubtask.id);
        loadSubtaskCommentCounts();
        toast.success(t('Đã thêm bình luận việc con!'));
      }
    } catch (e: any) {
      toast.error(t('Không thể gửi bình luận: ') + e.message);
    } finally {
      setIsSubmittingSubtaskComment(false);
      setUploadingFile(false);
    }
  };

  const getParticipantIds = (ids: any): string[] => {
    if (Array.isArray(ids)) {
      return ids.map(String).filter(Boolean);
    }
    if (typeof ids === 'string') {
      return ids.split(',').filter(Boolean);
    }
    if (typeof ids === 'number') {
      return [String(ids)];
    }
    return [];
  };

  const handleToggleParticipant = (userId: number) => {
    const current = getParticipantIds(formData.participant_ids);
    const isSelected = current.includes(String(userId));
    
    if (isSelected) {
      // Check if user is currently assigned to any subtask
      const isAssignedToSubtask = erpMeta.checklist?.some((item: any) => {
        const assignedIds = item.assignee_id ? String(item.assignee_id).split(',').map(id => id.trim()).filter(Boolean) : [];
        return assignedIds.includes(String(userId));
      });
      
      if (isAssignedToSubtask) {
        toast.error(t('Người này hiện đang thực hiện công việc con'));
        return;
      }
      
      const next = current.filter(id => id !== String(userId));
      const nextString = next.join(',');
      setFormData((prev: any) => ({ ...prev, participant_ids: nextString }));
      handleUpdateField('participant_ids', nextString);
    } else {
      const next = [...current, String(userId)];
      const nextString = next.join(',');
      setFormData((prev: any) => ({ ...prev, participant_ids: nextString }));
      handleUpdateField('participant_ids', nextString);
    }
  };

  // Document body overflow handling
  useEffect(() => {
    if (isOpen && task && !embedMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, task, embedMode]);

  const drawerMotionProps = embedMode ? {} : {
    initial: isMobileOrTablet ? { y: '100%' } : { opacity: 0, x: '250px' },
    animate: { y: 0, x: 0, opacity: 1 },
    exit: isMobileOrTablet ? { y: '100%' } : { opacity: 0, x: '250px' },
    transition: { type: 'spring' as const, damping: 30, stiffness: 250, mass: 0.8 },
    drag: isMobileOrTablet ? ('y' as const) : false,
    dragConstraints: { top: 0 },
    dragElastic: { top: 0.05, bottom: 0.7 },
    onDragEnd: (event: any, info: any) => {
      if (isMobileOrTablet && (info.offset.y > 150 || info.velocity.y > 400)) {
        handleCloseDrawer();
      }
    }
  };


  // Common card style override
  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: embedMode ? '8px' : '12px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border-light)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
    borderRadius: embedMode ? '12px' : '16px',
    padding: embedMode ? '1rem' : '1.5rem'
  };

  const cardLabelStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  };

  const participantIds = getParticipantIds(formData.participant_ids).map(Number);
  const participants = users.filter(u => participantIds.includes(Number(u.id)));

  const isSale = currentUser && ['sales', 'sale'].includes(currentUser.role?.toLowerCase());

  const getContactFullName = (c: any) => {
    return (c.full_name || '').trim() || c.name || t('Khách hàng');
  };

  const allowedContacts = contacts.filter(c => {
    const activeContactId = formData.contact_id || (formData.related_type === 'contact' ? formData.related_id : null);
    if (activeContactId && Number(c.id) === Number(activeContactId)) {
      return true;
    }
    if (isSale) {
      return Number(c.owner_id) === Number(currentUser?.id);
    }
    return true;
  });

  const approverOptions = users;

  const filteredUsersForParticipants = users
    .filter(u => {
      return (u.full_name || '').toLowerCase().includes(participantsSearch.toLowerCase()) ||
             (u.role || '').toLowerCase().includes(participantsSearch.toLowerCase());
    })
    .sort((a, b) => {
      const aChecked = participantIds.includes(Number(a.id)) ? 1 : 0;
      const bChecked = participantIds.includes(Number(b.id)) ? 1 : 0;
      return bChecked - aChecked;
    });

  const currentHash = React.useMemo(() => {
    const cleanObj = (obj: any) => {
      const clean: any = {};
      Object.keys(obj || {}).forEach(key => {
        if (['created_at', 'updated_at', 'deleted_at', 'created_by_name', 'created_by_avatar', 'contact_name', 'contact_avatar', 'user_name'].includes(key)) {
          return;
        }
        const val = obj[key];
        clean[key] = (val === null || val === undefined) ? '' : val;
      });
      return clean;
    };
    return JSON.stringify({
      formData: cleanObj(formData),
      erpMeta: cleanObj(erpMeta)
    });
  }, [formData, erpMeta]);

  if (!task) return null;

  const handleImageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && target.closest('.rich-comment-content')) {
      target.classList.toggle('zoomed');
    }
  };

  const hasChanges = originalHash !== currentHash;

  const isApproverOrAdmin = currentUser && Number(currentUser.id) === Number(formData.approver_id);

  const formatLogAction = (log: any) => {
    const action = log.action;
    let data: any = {};
    try {
      data = JSON.parse(log.new_data || '{}');
    } catch(e) {}
    
    switch (action) {
      case 'CREATE':
        return `đã tạo công việc "${data.subject || ''}"`;
      case 'UPDATE':
        const keys = Object.keys(data);
        const displayKeys = keys.filter(k => [
          'status', 'progress', 'priority', 'user_id', 'due_date', 'body', 'subject', 'participant_ids', 'tags'
        ].includes(k));
        
        if (displayKeys.length > 0) {
          const changes = displayKeys.map(k => {
            const val = data[k];
            if (k === 'status') {
              const statusLabels: Record<string, string> = {
                todo: 'Cần làm',
                in_progress: 'Đang làm',
                done: 'Hoàn thành',
                cancelled: 'Đã hủy',
                pending: 'Chờ duyệt'
              };
              return `trạng thái thành "${statusLabels[val] || val}"`;
            }
            if (k === 'progress') return `tiến độ thành ${val}%`;
            if (k === 'priority') {
              const priorityLabels: Record<string, string> = {
                low: 'Thấp',
                medium: 'Trung bình',
                high: 'Cao'
              };
              return `độ ưu tiên thành "${priorityLabels[val] || val}"`;
            }
            if (k === 'user_id') {
              const assignedUser = users.find(u => Number(u.id) === Number(val));
              return `người thực hiện thành "${assignedUser?.full_name || val}"`;
            }
            if (k === 'due_date') return `thời hạn thành "${val || 'không có'}"`;
            if (k === 'body') return `mô tả công việc`;
            if (k === 'subject') return `tên công việc`;
            if (k === 'participant_ids') return `người liên quan`;
            if (k === 'tags') return `nhãn công việc`;
            return `trường "${k}"`;
          });
          return `đã cập nhật ${changes.join(', ')}`;
        }
        return 'đã cập nhật thông tin công việc';
      case 'ADD_COMMENT':
        return 'đã thêm bình luận mới';
      case 'DELETE_COMMENT':
        return 'đã xóa bình luận';
      case 'COMPLETE_SUBTASK':
        return `đã hoàn thành công việc con "${data.title || ''}"`;
      case 'INCOMPLETE_SUBTASK':
        return `đã đánh dấu chưa hoàn thành công việc con "${data.title || ''}"`;
      case 'ADD_SUBTASK':
        return `đã thêm công việc con "${data.title || ''}"`;
      case 'DELETE_SUBTASK':
        return `đã xóa công việc con "${data.title || ''}"`;
      case 'CANCEL_MEETING':
        return `đã hủy lịch hẹn. Lý do: "${data.reason || ''}"`;
      case 'RESCHEDULE_MEETING':
        return `đã dời lịch hẹn đến ngày ${data.due_date || ''}`;
      default:
        return `đã thực hiện thao tác "${action}"`;
    }
  };

  const content = (
    <motion.div 
      onClick={handleImageClick}
      className={`${embedMode ? '' : styles.drawer} ${embedMode ? 'focus-right-column' : ''}`}
      {...drawerMotionProps}
      style={embedMode ? {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        boxShadow: 'none',
        borderLeft: '1px solid var(--color-border-light)'
      } : {
        left: isMobileOrTablet ? 0 : 'var(--sidebar-width, 220px)',
        right: 0,
        top: 0,
        bottom: 0,
        height: isMobileOrTablet ? '92dvh' : '100vh',
        marginTop: isMobileOrTablet ? '8dvh' : 0,
        borderRadius: isMobileOrTablet ? '24px 24px 0 0' : 0,
        overflow: 'hidden',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
        zIndex: zIndex || 1000200,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        background: 'var(--color-surface)'
      }}
    >
      {isMobileOrTablet && !embedMode && (
        <div style={{ width: '36px', height: '5px', background: 'var(--color-border)', borderRadius: '999px', margin: '12px auto 2px', flexShrink: 0 }} />
      )}
        {/* Drawer Header */}
        <div style={{
          padding: isMobileOrTablet ? '0.5rem 0.75rem' : (embedMode ? '0.75rem 0.5rem' : '1.25rem 1.5rem'),
          borderBottom: '1px solid var(--color-border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-surface)',
          zIndex: 100,
          position: 'sticky',
          top: 0,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', gap: isMobileOrTablet ? '8px' : '12px', alignItems: 'center', minWidth: 0, flex: 1 }}>
            {!isMobileOrTablet && (
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: erpMeta.internal_type === 'announcement'
                  ? 'rgba(163, 20, 34, 0.08)'
                  : (formData.priority === 'high'
                      ? 'rgba(239, 68, 68, 0.08)'
                      : (formData.priority === 'low'
                          ? 'rgba(59, 130, 246, 0.08)'
                          : 'rgba(245, 158, 11, 0.08)')),
                color: erpMeta.internal_type === 'announcement'
                  ? 'var(--color-primary)'
                  : (formData.priority === 'high'
                      ? 'var(--color-danger)'
                      : (formData.priority === 'low'
                          ? 'var(--color-info)'
                          : 'var(--color-warning)')),
                flexShrink: 0
              }}>
                {erpMeta.internal_type === 'announcement' ? <AlertCircle size={20} /> : <CheckSquare2 size={20} />}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ fontSize: isMobileOrTablet ? '0.75rem' : '1.1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: isMobileOrTablet ? '4px' : '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span 
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={formData.subject || t("Chi tiết công việc")}
                >
                  {formData.subject || t("Chi tiết công việc")}
                </span>
                <span className="badge" style={{
                  background: 'rgba(107, 114, 128, 0.1)',
                  color: 'var(--color-text-muted)',
                  fontSize: isMobileOrTablet ? '0.55rem' : '0.6rem',
                  fontWeight: 800,
                  padding: isMobileOrTablet ? '1px 4px' : '1px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  flexShrink: 0
                }}>#{formData.id}</span>
                <span className={`badge ${formData.priority === 'high' ? 'danger' : formData.priority === 'low' ? 'info' : 'warning'}`} style={{
                  fontSize: isMobileOrTablet ? '0.55rem' : '0.6rem',
                  fontWeight: 800,
                  padding: isMobileOrTablet ? '1px 4px' : '1px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  flexShrink: 0
                }}>
                  {formData.priority === 'high' ? t('Khẩn cấp') : formData.priority === 'low' ? t('Thấp') : t('Trung bình')}
                </span>
              </h3>
              {!isMobileOrTablet && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>{t('Người tạo:')}</span>
                    <Avatar src={formData.created_by_avatar || undefined} name={formData.created_by_name || t('Hệ thống / Admin')} size={20} />
                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{formData.created_by_name || t('Hệ thống / Admin')}</span>
                  </div>

                  {formData.created_at && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                      <Calendar size={12} style={{ color: 'var(--color-primary)' }} />
                      <span>{t('Ngày tạo:')}</span>
                      <strong style={{ color: 'var(--color-text)' }}>
                        {new Date(formData.created_at.replace(/-/g, '/')).toLocaleDateString('vi-VN')} {new Date(formData.created_at.replace(/-/g, '/')).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                  )}

                  {formData.due_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                      <Clock size={12} style={{ color: 'var(--color-danger, #ef4444)' }} />
                      <span>{t('Hạn hoàn thành:')}</span>
                      <strong style={{ color: 'var(--color-text)' }}>
                        {new Date(formData.due_date.replace(/-/g, '/')).toLocaleDateString('vi-VN')} {new Date(formData.due_date.replace(/-/g, '/')).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                  )}

                  {!!erpMeta.project_id && (
                    <button
                      type="button"
                                            onClick={() => { navigate(`/projects?id=${erpMeta.project_id}`); onClose?.(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-info)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer' }}
                      title={t('Mở Drawer xem chi tiết Dự án')}
                    >
                      <Building2 size={12} />
                      <span>{allowedProjects.find(p => Number(p.id) === Number(erpMeta.project_id))?.name || t('Dự án')}</span>
                    </button>
                  )}
                  {!!erpMeta.campaign_id && (
                    <button
                      type="button"
                                            onClick={() => { navigate(`/projects?tab=campaigns&id=${erpMeta.campaign_id}`); onClose?.(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-warning)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer' }}
                      title={t('Mở Drawer xem chi tiết Chiến dịch')}
                    >
                      <Megaphone size={12} />
                      <span>{allowedCampaigns.find(c => Number(c.id) === Number(erpMeta.campaign_id))?.name || t('Chiến dịch')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
            {/* Share Task Button */}
            {formData.id && formData.id !== 'new' && (
              <button
                type="button"
                onClick={handleShareTask}
                className="hover-lift"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s'
                }}
                title={t("Chia sẻ liên kết công việc")}
              >
                <Share2 size={18} />
              </button>
            )}

            {/* Notification Mute Bell Button */}
            <button
              type="button"
              onClick={handleBellClick}
              disabled={loadingMute}
              className="hover-lift"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: isMuted ? '1px solid var(--color-border)' : '1px solid rgba(189, 29, 45, 0.3)',
                background: isMuted ? 'var(--color-bg)' : 'rgba(189, 29, 45, 0.08)',
                color: isMuted ? 'var(--color-text-muted)' : '#BD1D2D',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s'
              }}
              title={isMuted ? t("Thông báo đang tắt (Bấm để bật)") : t("Thông báo đang bật (Bấm để tắt)")}
            >
              {isMuted ? <BellOff size={18} /> : <Bell size={18} />}
            </button>

            {/* Hide task eye button */}
            {task?.id && task.id !== 'new' && (
              <button
                type="button"
                onClick={handleHideClick}
                disabled={loadingHide}
                className="hover-lift"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: isHidden ? '1.5px solid var(--color-danger)' : '1px solid var(--color-border)',
                  background: isHidden ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-surface)',
                  color: isHidden ? 'var(--color-danger)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s'
                }}
                title={isHidden ? t("Công việc đang ẩn (Bấm để hiển thị lại)") : t("Ẩn công việc khỏi bàn làm việc")}
              >
                {isHidden ? <EyeOff size={18} style={{ color: 'var(--color-danger)' }} /> : <Eye size={18} />}
              </button>
            )}

            {!embedMode && (window.location.pathname === '/workspace' || window.location.pathname === '/') && (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('enter-focus-mode', { detail: { task } }));
                  handleCloseDrawer();
                }}
                className="hover-lift"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s'
                }}
                title={t("Chế độ tập trung")}
              >
                <Target size={18} />
              </button>
            )}

            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isMobileOrTablet ? '0' : '8px',
                padding: isMobileOrTablet ? '6px' : '8px 20px',
                width: isMobileOrTablet ? '36px' : undefined,
                borderRadius: isMobileOrTablet ? '8px' : '10px',
                fontSize: isMobileOrTablet ? '0.85rem' : '0.9rem',
                fontWeight: 700,
                height: isMobileOrTablet ? '36px' : '38px',
                background: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
                color: 'white',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s'
              }}
            >
              {isSaving ? <RefreshCw className="spin" size={14} /> : <Save size={16} />}
              {!isMobileOrTablet && <span>{t('Lưu thay đổi')}</span>}
            </button>

            <button 
              onClick={handleCloseDrawer} 
              className="hover-lift"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                padding: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '36px',
                width: '36px'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Drawer Body - 2 Columns Layout */}
        <div style={{ display: 'flex', flexDirection: isMobileOrTablet ? 'column' : 'row', flex: 1, overflow: 'hidden' }} className={embedMode ? 'focus-right-column' : ''}>
          
          {/* Left Column (7) */}
          <div 
            style={{ 
              flex: isMobileOrTablet ? 'none' : 7, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: isMobileOrTablet ? '1rem' : (embedMode ? '12px' : '1.5rem'), 
              minWidth: 0,
              overflowY: 'auto',
              padding: isMobileOrTablet ? '1rem 1rem 100px 1rem' : (embedMode ? '1rem 0.5rem 1.5rem 1.25rem' : '1.5rem 2rem 1.5rem 2rem')
            }}
            className="custom-scrollbar"
          >
            
            {/* Tên công việc */}
            <div className="card" style={cardStyle}>
              <label style={cardLabelStyle}>
                {t('Tên công việc')}
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.subject || ''}
                onChange={(e) => setFormData((prev: any) => ({ ...prev, subject: e.target.value }))}
                onBlur={(e) => handleUpdateField('subject', e.target.value)}
                placeholder={t('Nhập tên công việc...')}
                style={{ fontSize: '0.85rem', fontWeight: 700, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
              />
            </div>

            {/* Mô tả chi tiết */}
            <div className="card" style={cardStyle}>
              <style>{`
                .rich-text-editor-content ul, .rich-text-editor-content ol {
                  padding-left: 1.5rem !important;
                  margin: 0.5rem 0 !important;
                  list-style-position: outside !important;
                }
                .rich-text-editor-content li {
                  margin-bottom: 0.25rem !important;
                }
                .rich-text-editor-content img {
                  max-width: 100% !important;
                  height: auto !important;
                  border-radius: 8px !important;
                  margin: 8px 0 !important;
                  display: block !important;
                }
                .rich-comment-content img {
                  max-width: 150px !important;
                  max-height: 120px !important;
                  border-radius: 8px !important;
                  cursor: pointer !important;
                  transition: transform 0.2s ease, max-width 0.25s ease, max-height 0.25s ease !important;
                  object-fit: cover !important;
                  display: block !important;
                  margin: 6px 0 !important;
                }
                .rich-comment-content img:hover {
                  transform: scale(1.02) !important;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
                }
                .rich-comment-content img.zoomed {
                  max-width: 100% !important;
                  max-height: 600px !important;
                  object-fit: contain !important;
                  box-shadow: 0 10px 30px rgba(0,0,0,0.2) !important;
                }
              `}</style>
              <label style={cardLabelStyle}>
                {t('Mô tả chi tiết')}
              </label>
              <div 
                style={{ 
                  borderRadius: '8px', 
                  border: '1px solid var(--color-border)', 
                  display: 'flex', 
                  flexDirection: 'column',
                  overflow: 'hidden',
                  background: 'var(--color-surface)',
                  minHeight: '260px'
                }}
              >
                {/* Editor Toolbar */}
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    padding: '6px 8px', 
                    background: 'var(--color-bg)', 
                    borderBottom: '1px solid var(--color-border)',
                    flexWrap: 'wrap',
                    userSelect: 'none'
                  }}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleEditorCommand('bold')}
                    style={{ padding: '6px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
                    title={t('In đậm')}
                  >
                    <Bold size={15} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleEditorCommand('italic')}
                    style={{ padding: '6px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
                    title={t('In nghiêng')}
                  >
                    <Italic size={15} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleEditorCommand('underline')}
                    style={{ padding: '6px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
                    title={t('Gạch chân')}
                  >
                    <span style={{ textDecoration: 'underline', fontWeight: 'bold', fontSize: '14px', lineHeight: '1' }}>U</span>
                  </button>
                  <div style={{ width: '1px', height: '16px', background: 'var(--color-border)', margin: '0 4px' }} />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleEditorAddLink}
                    style={{ padding: '6px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
                    title={t('Chèn liên kết')}
                  >
                    <Link2 size={15} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleEditorUploadImage}
                    style={{ padding: '6px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
                    title={t('Tải ảnh lên')}
                  >
                    <ImageIcon size={15} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleEditorCommand('insertUnorderedList')}
                    style={{ padding: '6px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
                    title={t('Danh sách dấu đầu dòng')}
                  >
                    <List size={15} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleEditorCommand('insertOrderedList')}
                    style={{ padding: '6px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
                    title={t('Danh sách số')}
                  >
                    <ListOrdered size={15} />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleEditorCommand('removeFormat')}
                    style={{ padding: '6px 8px', borderRadius: '4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}
                    title={t('Xóa định dạng')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* contenteditable text area */}
                <div
                  key={task.id}
                  ref={editorRef}
                  contentEditable
                  onFocus={() => {
                    isFocusedRef.current = true;
                  }}
                  onBlur={(e) => {
                    isFocusedRef.current = false;
                    const html = e.currentTarget.innerHTML;
                    setErpMeta((prev) => ({ ...prev, description: html }));
                    handleSaveMeta({ ...erpMeta, description: html });
                  }}
                  onPaste={handleEditorPaste}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target && target.tagName === 'A') {
                      e.preventDefault();
                      window.open(target.getAttribute('href') || '', '_blank');
                    }
                  }}
                  style={{
                    padding: '12px 14px',
                    minHeight: '200px',
                    outline: 'none',
                    fontSize: '0.85rem',
                    lineHeight: '1.6',
                    overflowY: 'auto',
                    color: 'var(--color-text)',
                    background: 'transparent',
                    flex: 1
                  }}
                  className="rich-text-editor-content"
                />
              </div>
            </div>

            {/* Checklist công việc con */}
            <div className="card" style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={cardLabelStyle}>
                  {t('Checklist công việc con')}
                </label>
                {currentUser?.role !== 'viewer' && (
                  <button
                    type="button"
                    className="btn outline sm"
                    onClick={() => setShowAddChecklist(!showAddChecklist)}
                    style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'var(--color-border)', color: 'var(--color-text-light)' }}
                  >
                    <Plus size={12} />
                    {t('Thêm mục')}
                  </button>
                )}
              </div>

              {/* Checklist Progress Bar */}
              {erpMeta.checklist && erpMeta.checklist.length > 0 && (() => {
                const total = erpMeta.checklist.length;
                const completed = erpMeta.checklist.filter((x: any) => x.done).length;
                const percent = Math.round((completed / total) * 100);
                const showSuggestion = currentUser?.role !== 'viewer' && Number(formData.progress || 0) !== percent;

                return (
                  <div style={{
                    marginTop: '8px',
                    marginBottom: '12px',
                    padding: '8px 12px',
                    background: 'rgba(0, 0, 0, 0.02)',
                    borderRadius: '8px',
                    border: '1px dashed var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>
                        {t('Tiến độ việc con:')} <strong style={{ color: 'var(--color-success)' }}>{completed}/{total}</strong> {t('đã xong')} ({percent}%)
                      </span>
                      {showSuggestion && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev: any) => ({ ...prev, progress: percent }));
                            toast.success(t('Đã cập nhật tiến độ công việc chính thành ') + percent + '%');
                          }}
                          style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            color: 'var(--color-success)',
                            border: '1px solid rgba(16, 185, 129, 0.15)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                          }}
                        >
                          {t('Đồng bộ tiến độ chính')}
                        </button>
                      )}
                    </div>
                    <div style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '3px',
                      background: 'var(--color-border-light)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${percent}%`,
                        height: '100%',
                        background: percent < 33 
                          ? 'var(--color-danger)' 
                          : (percent < 66 
                              ? 'var(--color-warning)' 
                              : 'var(--color-success)'
                            ),
                        borderRadius: '3px',
                        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                      }} />
                    </div>
                  </div>
                );
              })()}

              {/* Add checklist item expander form */}
              {showAddChecklist && (
                <div style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border-light)',
                  padding: '16px',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  animation: 'slideDown 0.2s ease-out',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  {/* Row 1: Title */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Tên công việc con')}</span>
                    <textarea
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '8px 12px', minHeight: '60px', borderRadius: '8px', border: '1px solid var(--color-border)', width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                      placeholder={t('Nhập công việc con (Có thể xuống dòng để thêm nhiều mục cùng lúc...)')}
                      value={newSubTitle}
                      onChange={(e) => setNewSubTitle(e.target.value)}
                    />
                  </div>

                  {/* Row 2: Grid for Assignee, Priority, Deadline */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Người thực hiện')}</span>
                      <CustomSelect
                        options={users.map(u => ({
                          value: String(u.id),
                          label: u.full_name,
                          avatar: u.avatar || u.avatar_url
                        }))}
                        value={newSubAssignee}
                        onChange={val => setNewSubAssignee(String(val))}
                        placeholder={t('Chọn người làm...')}
                        searchable
                        showAvatars
                        size="sm"
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Độ ưu tiên')}</span>
                      <CustomSelect
                        options={[
                          { value: 'high', label: t('Cao') },
                          { value: 'medium', label: t('Trung bình') },
                          { value: 'low', label: t('Thấp') }
                        ]}
                        value={newSubPriority}
                        onChange={val => setNewSubPriority(String(val))}
                        placeholder={t('Độ ưu tiên')}
                        size="sm"
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Hạn hoàn thành')}</span>
                      <input
                        type="date"
                        className="form-input"
                        style={{ fontSize: '0.8rem', padding: '6px 10px', height: '36px', borderRadius: '8px', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                        value={newSubDeadline}
                        onChange={(e) => setNewSubDeadline(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Row 3: Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
                    <button 
                      className="btn outline sm" 
                      onClick={() => setShowAddChecklist(false)} 
                      style={{ padding: '6px 14px', fontSize: '0.75rem', borderRadius: '6px', cursor: 'pointer', height: '32px', display: 'flex', alignItems: 'center' }}
                    >
                      {t('Hủy')}
                    </button>
                    <button 
                      className="btn primary sm" 
                      onClick={handleAddChecklistItem} 
                      style={{ padding: '6px 14px', fontSize: '0.75rem', borderRadius: '6px', cursor: 'pointer', height: '32px', display: 'flex', alignItems: 'center', background: 'var(--color-primary)', color: 'white', border: 'none' }}
                    >
                      {t('Thêm')}
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-tasks list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(!erpMeta.checklist || erpMeta.checklist.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                    {t('Chưa có công việc con nào.')}
                  </div>
                ) : (
                  erpMeta.checklist.map((item: any) => {
                    const assignedIds = item.assignee_id ? String(item.assignee_id).split(',').map(id => id.trim()).filter(Boolean) : [];
                    const itemUsers = users.filter(u => assignedIds.includes(String(u.id)));
                    const itemUser = itemUsers[0] || null;
                    const isEditingThis = editingChecklistId === item.id;
                    const isAssigneeDropdownOpen = activeAssigneeDropdownId === item.id;
                    const isCommentsOpen = selectedSubtask?.id === item.id;

                    return (
                      <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {/* Subtask Card */}
                        <div 
                          onClick={() => {
                            if (task?.id !== 'new') {
                              setSelectedSubtask(isCommentsOpen ? null : item);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: item.done ? 'rgba(16, 185, 129, 0.03)' : 'var(--color-bg)',
                            border: '1px solid var(--color-border-light)',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            transition: 'all 0.2s',
                            opacity: item.done ? 0.8 : 1,
                            position: 'relative',
                            gap: '10px',
                            cursor: task?.id !== 'new' ? 'pointer' : 'default'
                          }}
                          className={task?.id !== 'new' ? "hover-bg-alt" : ""}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                            {/* Round & Large Custom Checkbox */}
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              style={{ position: 'relative', width: 22, height: 22, flexShrink: 0, marginTop: '2px' }}
                            >
                              <input
                                type="checkbox"
                                checked={!!item.done}
                                onChange={() => handleToggleChecklist(item.id)}
                                onClick={(e) => e.stopPropagation()}
                                disabled={currentUser?.role === 'viewer'}
                                style={{
                                  opacity: 0,
                                  position: 'absolute',
                                  width: '100%',
                                  height: '100%',
                                  cursor: currentUser?.role === 'viewer' ? 'not-allowed' : 'pointer',
                                  margin: 0,
                                  zIndex: 1
                                }}
                              />
                              <motion.div
                                animate={{
                                  backgroundColor: item.done ? 'var(--color-success)' : 'var(--color-surface)',
                                  borderColor: item.done ? 'var(--color-success)' : 'var(--color-border)',
                                  opacity: currentUser?.role === 'viewer' ? 0.6 : 1
                                }}
                                style={{
                                  width: 22,
                                  height: 22,
                                  border: '2px solid',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background-color 0.2s, border-color 0.2s'
                                }}
                              >
                                <AnimatePresence>
                                  {item.done && (
                                    <motion.div
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <Check size={14} color="white" strokeWidth={4} />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '3px' }}>
                              {/* Title / Inline Edit */}
                              {isEditingThis ? (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                                    <input
                                      type="text"
                                      className="form-input"
                                      value={editingChecklistTitle}
                                      onChange={(e) => setEditingChecklistTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleUpdateChecklistItem(item.id, editingChecklistTitle, editingChecklistDeadline);
                                          setEditingChecklistId(null);
                                        } else if (e.key === 'Escape') {
                                          setEditingChecklistId(null);
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                      style={{ fontSize: '0.82rem', padding: '4px 8px', height: '32px', borderRadius: '6px', flex: 1 }}
                                    />
                                    <input
                                      type="date"
                                      className="form-input"
                                      value={editingChecklistDeadline}
                                      onChange={(e) => setEditingChecklistDeadline(e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ fontSize: '0.8rem', padding: '4px 6px', height: '32px', borderRadius: '6px', width: '130px', flexShrink: 0 }}
                                    />
                                    <button
                                      type="button"
                                      className="btn primary sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateChecklistItem(item.id, editingChecklistTitle, editingChecklistDeadline);
                                        setEditingChecklistId(null);
                                      }}
                                      style={{ padding: '4px 10px', height: '32px', fontSize: '0.75rem', flexShrink: 0 }}
                                    >
                                      {t('Lưu')}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn outline sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingChecklistId(null);
                                      }}
                                      style={{ padding: '4px 8px', height: '32px', fontSize: '0.75rem', flexShrink: 0 }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    color: item.done ? 'var(--color-text-muted)' : 'var(--color-text)',
                                    textDecoration: item.done ? 'line-through' : 'none',
                                    wordBreak: 'break-word'
                                  }}>
                                    {item.title}
                                  </span>
                                  {currentUser?.role !== 'viewer' && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingChecklistId(item.id);
                                        setEditingChecklistTitle(item.title);
                                        setEditingChecklistDeadline(item.due_date ? new Date(item.due_date).toISOString().split('T')[0] : '');
                                      }}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        color: 'var(--color-text-muted)',
                                        cursor: 'pointer',
                                        padding: '2px 4px',
                                        borderRadius: '4px',
                                        display: 'inline-flex',
                                        alignItems: 'center'
                                      }}
                                      className="hover-bg-alt hover-color-primary"
                                      title={t('Sửa tiêu đề')}
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Subtitle Assignee & Due Date Row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                                  {t('Giao cho')}: <strong style={{ color: itemUsers.length > 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{itemUsers.length > 0 ? itemUsers.map(u => u.full_name || u.name).join(', ') : t('Chưa phân công')}</strong>
                                </span>
                                {item.due_date && (
                                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                                    {` • Hạn: ${new Date(item.due_date).toLocaleDateString('vi-VN')}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                             {/* Round User Assignee Icon Button & Stack */}
                             <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
                               {itemUsers.length > 0 && (
                                 <div 
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setSelectedSubtaskForParticipants(item);
                                   }}
                                   className="subtask-assignee-trigger"
                                   style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                                   title={itemUsers.map(u => u.full_name || u.name).join(', ')}
                                 >
                                   {itemUsers.slice(0, 3).map((u, idx) => (
                                     <div 
                                       key={u.id} 
                                       style={{ 
                                          marginLeft: idx === 0 ? 0 : -8, 
                                          border: '1.5px solid var(--color-surface)',
                                          borderRadius: '50%',
                                          overflow: 'hidden',
                                          zIndex: 10 - idx,
                                          boxShadow: 'var(--shadow-sm)',
                                          display: 'flex'
                                       }}
                                     >
                                       <Avatar src={u.avatar || u.avatar_url} name={u.full_name || u.name} size={22} />
                                     </div>
                                   ))}
                                   {itemUsers.length > 3 && (
                                     <div 
                                       style={{ 
                                          marginLeft: -8, 
                                          width: '22px', 
                                          height: '22px', 
                                          borderRadius: '50%', 
                                          background: 'var(--color-primary-light)', 
                                          color: 'var(--color-primary)', 
                                          fontSize: '0.625rem', 
                                          fontWeight: 800, 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center',
                                          border: '1.5px solid var(--color-surface)',
                                          zIndex: 5
                                       }}
                                     >
                                       +{itemUsers.length - 3}
                                     </div>
                                   )}
                                 </div>
                               )}

                               <button
                                 type="button"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setActiveAssigneeDropdownId(isAssigneeDropdownOpen ? null : item.id);
                                 }}
                                 disabled={currentUser?.role === 'viewer'}
                                 style={{
                                   border: '1px dashed var(--color-primary)',
                                   background: 'rgba(163, 20, 34, 0.04)',
                                   width: '24px',
                                   height: '24px',
                                   borderRadius: '50%',
                                   display: 'flex',
                                   alignItems: 'center',
                                   justifyContent: 'center',
                                   cursor: currentUser?.role === 'viewer' ? 'default' : 'pointer',
                                   padding: 0,
                                   transition: 'all 0.15s ease'
                                 }}
                                 className="hover-scale subtask-assignee-trigger"
                                 title={t('Phân công người thực hiện')}
                               >
                                 <UserPlus size={12} color="var(--color-primary)" />
                               </button>

                              {/* User selection dropdown popup */}
                              {isAssigneeDropdownOpen && (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className="subtask-assignee-dropdown"
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '6px',
                                    zIndex: 9999,
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border-light)',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.18)',
                                    minWidth: '220px',
                                    maxHeight: '230px',
                                    overflowY: 'auto',
                                    padding: '6px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                  }}
                                >
                                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', padding: '4px 8px' }}>
                                    {t('Phân công người thực hiện:')}
                                  </div>
                                  
                                  {/* Unassign option */}
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateChecklistItemAssignee(item.id, '');
                                      setActiveAssigneeDropdownId(null);
                                    }}
                                    style={{
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                      color: 'var(--color-danger)',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}
                                    className="hover-bg-alt"
                                  >
                                    <span>✕ {t('Bỏ phân công (Chưa ai làm)')}</span>
                                  </div>

                                  {users.map((u: any) => {
                                    const isAssigned = assignedIds.includes(String(u.id));
                                    return (
                                      <div
                                        key={u.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const nextAssignees = isAssigned
                                            ? assignedIds.filter(id => id !== String(u.id))
                                            : [...assignedIds, String(u.id)];
                                          handleUpdateChecklistItemAssignee(item.id, nextAssignees.join(','));
                                        }}
                                        style={{
                                          padding: '6px 8px',
                                          borderRadius: '6px',
                                          cursor: 'pointer',
                                          fontSize: '0.75rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '8px',
                                          background: isAssigned ? 'var(--color-primary-light)' : 'transparent',
                                          color: isAssigned ? 'var(--color-primary)' : 'var(--color-text)',
                                          fontWeight: isAssigned ? 700 : 500
                                        }}
                                        className="hover-bg-alt"
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                          <Avatar src={u.avatar || u.avatar_url} name={u.full_name || u.name} size={18} />
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {u.full_name || u.name}
                                          </span>
                                        </div>
                                        {isAssigned && <Check size={12} color="var(--color-primary)" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Subtask Discussion / Comments Trigger */}
                            {task?.id !== 'new' && (() => {
                              const commentCount = subtaskCommentCounts[item.id] || 0;
                              return (
                                <div style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSubtask(isCommentsOpen ? null : item);
                                    }}
                                    style={{
                                      border: isCommentsOpen ? '1px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                                      background: isCommentsOpen ? 'rgba(163, 20, 34, 0.06)' : 'transparent',
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      padding: 0,
                                      color: isCommentsOpen ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    className="hover-scale hover-color-primary"
                                    title={t('Thảo luận / Bình luận việc con')}
                                  >
                                    <MessageSquare size={13} />
                                  </button>
                                  {commentCount > 0 && (
                                    <span style={{
                                      position: 'absolute',
                                      top: '-6px',
                                      right: '-6px',
                                      background: 'var(--color-primary)',
                                      color: 'white',
                                      fontSize: '9px',
                                      fontWeight: 800,
                                      borderRadius: '8px',
                                      padding: '2px 5px',
                                      lineHeight: 1,
                                      border: '1.5px solid var(--color-bg)',
                                      pointerEvents: 'none'
                                    }}>
                                      {commentCount}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Delete Trash Can */}
                            {currentUser?.role !== 'viewer' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteSubtaskTarget({ id: item.id, title: item.title });
                                }}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-danger)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                className="hover-lift"
                                title={t('Xóa việc con')}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline Comments Area */}
                        <AnimatePresence>
                          {isCommentsOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              style={{
                                overflow: 'hidden',
                                background: 'rgba(0, 0, 0, 0.015)',
                                border: '1px solid var(--color-border-light)',
                                borderRadius: '12px',
                                padding: '14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                marginLeft: '34px'
                              }}
                            >
                              {/* Comments Feed */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }} className="custom-scrollbar">
                                {loadingSubtaskComments ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <StatRowSkeleton />
                                    <StatRowSkeleton />
                                  </div>
                                ) : subtaskComments.length === 0 ? (
                                  <div style={{ textAlign: 'center', padding: '12px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                    {t('Chưa có thảo luận nào.')}
                                  </div>
                                ) : (
                                  subtaskComments.map((comment: any) => {
                                    const commUser = users.find(u => Number(u.id) === Number(comment.user_id));
                                    let commentParsedAtts = [];
                                    if (comment.attachments) {
                                      try {
                                        commentParsedAtts = typeof comment.attachments === 'string' ? JSON.parse(comment.attachments) : comment.attachments;
                                      } catch (e) {
                                        console.error(e);
                                      }
                                    }
                                    if (!Array.isArray(commentParsedAtts)) commentParsedAtts = [];

                                    return (
                                      <div 
                                        key={comment.id}
                                        id={`workspace-comment-${comment.id}`}
                                        style={{ 
                                          display: 'flex', 
                                          gap: '8px', 
                                          background: 'var(--color-surface)', 
                                          border: '1px solid var(--color-border-light)', 
                                          padding: '8px 12px', 
                                          borderRadius: '10px',
                                          transition: 'background-color 0.5s ease'
                                        }}
                                      >
                                        <Avatar src={comment.avatar_url || commUser?.avatar || commUser?.avatar_url} name={commUser?.full_name || comment.user_name || 'Đồng nghiệp'} size={22} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text)' }}>{commUser?.full_name || comment.user_name || 'Đồng nghiệp'}</span>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>{new Date(comment.created_at.replace(/-/g, '/')).toLocaleString('vi-VN')}</span>
                                          </div>
                                          {comment.content && /<[a-z][\s\S]*>/i.test(comment.content) ? (
                                            <div 
                                              className="rich-comment-content"
                                              dangerouslySetInnerHTML={{ __html: linkifyHtml(comment.content) }}
                                              style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0', lineHeight: '1.4' }}
                                            />
                                          ) : (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', margin: '2px 0 0', lineHeight: '1.4', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                              {renderCommentContent(comment.content)}
                                            </div>
                                          )}
                                          {commentParsedAtts.length > 0 && (
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                                              {commentParsedAtts.map((url: any, aIdx: number) => {
                                                const name = typeof url === 'string' ? url.substring(url.lastIndexOf('/') + 1) : (url.name || 'File');
                                                const rawHref = typeof url === 'string' ? url : (url.url || '#');

                                                const apiBase = import.meta.env.VITE_API_URL || '/backend';
                                                let href = rawHref;
                                                if (rawHref && rawHref.startsWith('uploads/')) {
                                                  href = `${apiBase}/${rawHref}`;
                                                } else if (rawHref && rawHref.startsWith('storage/uploads/')) {
                                                  href = `${apiBase}/${rawHref.replace('storage/uploads/', 'uploads/')}`;
                                                }

                                                const isImg = name.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
                                                if (isImg) {
                                                  return (
                                                    <a key={aIdx} href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border-light)' }}>
                                                      <img src={href} alt={name} style={{ maxHeight: '60px', maxWidth: '100px', objectFit: 'contain' }} />
                                                    </a>
                                                  );
                                                }
                                                return (
                                                  <a key={aIdx} href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 6px', borderRadius: '10px', background: 'rgba(0, 0, 0, 0.03)', fontSize: '0.68rem', color: 'var(--color-primary)', fontWeight: 600, border: '1px solid var(--color-border-light)' }} className="hover-opacity">
                                                    <Paperclip size={9} />
                                                    <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                                                  </a>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              {/* Comment Input */}
                              {currentUser?.role !== 'viewer' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--color-border-light)', paddingTop: '10px' }}>
                                  <div style={{ position: 'relative' }}>
                                    <MentionInput
                                      value={newSubtaskCommentText}
                                      onChange={e => setNewSubtaskCommentText(e.target.value)}
                                      onImagePaste={addLocalSubtaskCommentAttachment}
                                      onFilePaste={addLocalSubtaskCommentAttachment}
                                      placeholder={t('Viết bình luận việc con... (Dán ảnh Ctrl+V)')}
                                      style={{ minHeight: '48px', fontSize: '0.8rem', paddingRight: '40px' }}
                                      disabled={isSubmittingSubtaskComment || uploadingFile}
                                    />
                                    <label style={{ position: 'absolute', right: '8px', bottom: '8px', cursor: (uploadingFile || isSubmittingSubtaskComment) ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('Đính kèm file')}>
                                      <input type="file" onChange={handleSubtaskCommentAttachmentUpload} style={{ display: 'none' }} disabled={uploadingFile || isSubmittingSubtaskComment} />
                                      {uploadingFile ? <RefreshCw className="spin" size={15} /> : <Paperclip size={15} />}
                                    </label>
                                  </div>

                                  {/* Attachment Chips */}
                                  {subtaskCommentAttachments.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                      {subtaskCommentAttachments.map((att: any, idx: number) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '2px 6px', borderRadius: '10px', fontSize: '0.68rem', color: 'var(--color-text)' }}>
                                          {att.previewUrl ? (
                                            <img src={att.previewUrl} alt="preview" style={{ width: '18px', height: '18px', borderRadius: '3px', objectFit: 'cover' }} />
                                          ) : (
                                            <Paperclip size={10} color="var(--color-primary)" />
                                          )}
                                          <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{att.name}</span>
                                          <button onClick={() => removeSubtaskCommentAttachment(idx)} style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.75rem', padding: '0 2px' }}>×</button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                    <button
                                      onClick={handlePostSubtaskComment}
                                      disabled={isSubmittingSubtaskComment || uploadingFile || (!newSubtaskCommentText.trim() && subtaskCommentAttachments.length === 0)}
                                      className="btn primary sm"
                                      style={{ padding: '4px 14px', fontSize: '0.72rem', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: '#fff' }}
                                    >
                                      {isSubmittingSubtaskComment ? <RefreshCw className="spin" size={11} /> : <Send size={11} />}
                                      <span>{t('Gửi')}</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Tài liệu hoặc Link đính kèm */}
            <div className="card" style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={cardLabelStyle}>
                  {t('Tài liệu hoặc Link đính kèm')}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn outline sm"
                    onClick={() => setShowAddLink(!showAddLink)}
                    style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'var(--color-border)', color: 'var(--color-text-light)' }}
                  >
                    <Link2 size={12} />
                    {t('Thêm link')}
                  </button>
                  <label
                    className="btn outline sm hover-lift"
                    style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0, borderColor: 'var(--color-border)', color: 'var(--color-text-light)' }}
                  >
                    {uploadingFile ? <RefreshCw className="spin" size={12} /> : <Plus size={12} />}
                    {t('Tải tệp lên')}
                    <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploadingFile} />
                  </label>
                </div>
              </div>

              {/* Add Web Link form */}
              {showAddLink && (
                <div style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border-light)',
                  padding: '12px',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  animation: 'slideDown 0.2s ease-out'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t('Tên nhãn (ví dụ: Google Drive)')}
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    />
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://..."
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button className="btn outline sm" onClick={() => setShowAddLink(false)} style={{ padding: '3px 8px', fontSize: '0.72rem' }}>{t('Hủy')}</button>
                    <button className="btn primary sm" onClick={handleAddLink} style={{ padding: '3px 8px', fontSize: '0.72rem' }}>{t('Thêm')}</button>
                  </div>
                </div>
              )}

              {/* Attached list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <PasteDropzoneArea
                  onConfirmUpload={handlePasteDropzoneUpload}
                  compact={true}
                  placeholder="Kéo thả tệp tin hoặc nhấn Ctrl+V để dán ảnh/link tại đây"
                  subtext="Xem trước ảnh/tệp tin trước khi tải lên (Hỗ trợ Ctrl+V từ Clipboard)"
                />

                {erpMeta.links && erpMeta.links.map((link: any, idx: number) => {
                  const rawUrl = link.url || '';
                  const fullUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')
                    ? rawUrl
                    : `${window.location.origin}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

                  const combinedStr = `${rawUrl} ${link.label || ''}`.toLowerCase();
                  const isImage = Boolean(
                    link.is_image ||
                    combinedStr.includes('.jpg') ||
                    combinedStr.includes('.jpeg') ||
                    combinedStr.includes('.png') ||
                    combinedStr.includes('.gif') ||
                    combinedStr.includes('.webp') ||
                    combinedStr.includes('.svg') ||
                    combinedStr.includes('image/') ||
                    combinedStr.includes('/img_') ||
                    combinedStr.includes('uploads/')
                  );

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        minHeight: '54px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                        gap: '12px',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      className="hover-lift"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('.btn-delete-link')) return;
                        window.open(fullUrl, '_blank');
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        {/* Left Thumbnail Preview or Icon */}
                        {isImage ? (
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            flexShrink: 0,
                            border: '1px solid var(--color-border-light)',
                            background: 'var(--color-bg-alt)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <img
                              src={fullUrl}
                              alt={link.label || 'Preview'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '8px',
                            background: link.is_file ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-primary-light)',
                            color: link.is_file ? 'var(--color-success)' : 'var(--color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {link.is_file ? <FileText size={20} /> : <Link2 size={20} />}
                          </div>
                        )}

                        {/* Name & Subtext */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              color: 'var(--color-text)',
                              textDecoration: 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block'
                            }}
                            className="hover-color-primary"
                          >
                            {link.label || link.url}
                          </a>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Eye size={12} /> {isImage ? t('Nhấn để xem / phóng to ảnh') : t('Nhấn để mở tệp / link')}
                          </span>
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            color: 'var(--color-text-muted)',
                            background: 'var(--color-bg-alt)',
                            transition: 'all 0.15s ease'
                          }}
                          className="hover-bg-primary-light hover-color-primary"
                          title={t('Mở trong tab mới')}
                        >
                          <ExternalLink size={15} />
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLink(idx);
                          }}
                          style={{
                            border: 'none',
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                          className="btn-delete-link hover-bg-danger-light"
                          title={t('Xóa tệp đính kèm')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bình luận & Trao đổi hoặc Dòng thời gian */}
            {task?.id !== 'new' && (
              <div className="card" style={cardStyle}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', marginBottom: '14px', gap: '20px' }}>
                  <button 
                    onClick={() => setActiveTab('comments')} 
                    style={{ 
                      padding: '8px 4px', 
                      fontSize: '0.85rem', 
                      fontWeight: 700, 
                      border: 'none', 
                      background: 'none', 
                      borderBottom: activeTab === 'comments' ? '2px solid var(--color-primary)' : '2px solid transparent', 
                      color: activeTab === 'comments' ? 'var(--color-primary)' : 'var(--color-text-muted)', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <MessageSquare size={14} />
                    <span>{t('Bình luận & Trao đổi')} ({comments.length})</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('timeline')} 
                    style={{ 
                      padding: '8px 4px', 
                      fontSize: '0.85rem', 
                      fontWeight: 700, 
                      border: 'none', 
                      background: 'none', 
                      borderBottom: activeTab === 'timeline' ? '2px solid var(--color-primary)' : '2px solid transparent', 
                      color: activeTab === 'timeline' ? 'var(--color-primary)' : 'var(--color-text-muted)', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Clock size={14} />
                    <span>{t('Dòng thời gian')} ({timeline.length})</span>
                  </button>
                </div>

                {activeTab === 'comments' ? (
                  <>
                    {/* Add comment input */}
                    <div style={{ background: 'rgba(0, 0, 0, 0.015)', border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.01)' }}>
                      {replyTo && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          background: 'rgba(107, 114, 128, 0.08)', 
                          border: '1px solid var(--color-border-light)',
                          padding: '8px 12px', 
                          borderRadius: '10px', 
                          fontSize: '0.78rem', 
                          color: 'var(--color-text)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={replyTo.avatar} name={replyTo.userName} size={20} />
                            <span>
                              {t('Đang trả lời')}{' '}
                              <strong style={{ color: 'var(--color-primary)' }}>{replyTo.userName}</strong>
                            </span>
                          </div>
                          <button 
                            onClick={() => setReplyTo(null)} 
                            style={{ 
                              border: 'none', 
                              background: 'transparent', 
                              color: 'var(--color-text-muted)', 
                              cursor: 'pointer', 
                              fontWeight: 800, 
                              fontSize: '1rem', 
                              padding: '0 4px',
                              lineHeight: 1
                            }}
                          >
                            ×
                          </button>
                        </div>
                      )}
                      <div style={{ position: 'relative' }}>
                        <MentionInput
                          value={newCommentText}
                          onChange={e => setNewCommentText(e.target.value)}
                          onImagePaste={addLocalTaskCommentAttachment}
                          onFilePaste={addLocalTaskCommentAttachment}
                          placeholder={t('Viết bình luận... (Dán ảnh trực tiếp Ctrl+V)')}
                          style={{ minHeight: '65px', fontSize: '0.85rem', paddingRight: '40px' }}
                          disabled={isSubmittingComment || uploadingFile}
                        />
                        <label style={{ position: 'absolute', right: '10px', bottom: '10px', cursor: (uploadingFile || isSubmittingComment) ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('Đính kèm file')}>
                          <input type="file" onChange={handleCommentAttachmentUpload} style={{ display: 'none' }} disabled={uploadingFile || isSubmittingComment} />
                          {uploadingFile ? <RefreshCw className="spin" size={18} /> : <Paperclip size={18} />}
                        </label>
                      </div>
                      
                      {/* Attachment Chips List */}
                      {commentAttachments.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '2px' }}>
                          {commentAttachments.map((att: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', color: 'var(--color-text)' }}>
                              {att.previewUrl ? (
                                <img src={att.previewUrl} alt="preview" style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover' }} />
                              ) : (
                                <Paperclip size={11} color="var(--color-primary)" />
                              )}
                              <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{att.name}</span>
                              <button onClick={() => removeTaskCommentAttachment(idx)} style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px', lineHeight: 1 }}>×</button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '4px' }}>
                        <button
                          onClick={handlePostComment}
                          disabled={isSubmittingComment || uploadingFile || (!newCommentText.trim() && commentAttachments.length === 0)}
                          className="btn primary sm"
                          style={{ padding: '6px 18px', fontSize: '0.78rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: '#fff' }}
                        >
                          {isSubmittingComment ? <RefreshCw className="spin" size={13} /> : <Send size={13} />}
                          <span>{t('Gửi')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Comments feed list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', marginTop: '4px' }} className="custom-scrollbar">
                      {loadingComments ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                        </div>
                      ) : comments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                          {t('Chưa có thảo luận nào.')}
                        </div>
                      ) : (
                        (() => {
                          const rootComments = comments.filter((c: any) => !c.parent_id);
                          const getReplies = (parentId: number) => {
                            return comments
                              .filter((c: any) => Number(c.parent_id) === Number(parentId))
                              .sort((a: any, b: any) => new Date(a.created_at.replace(/-/g, '/')).getTime() - new Date(b.created_at.replace(/-/g, '/')).getTime());
                          };

                          const renderSingleComment = (comment: any, isReply: boolean = false) => {
                            const commUser = users.find(u => Number(u.id) === Number(comment.user_id));
                            let commentParsedAtts = [];
                            if (comment.attachments) {
                              try {
                                commentParsedAtts = typeof comment.attachments === 'string' ? JSON.parse(comment.attachments) : comment.attachments;
                              } catch (e) {
                                console.error(e);
                              }
                            }
                            if (!Array.isArray(commentParsedAtts)) commentParsedAtts = [];

                            return (
                              <div 
                                key={comment.id} 
                                id={`workspace-comment-${comment.id}`}
                                style={{ 
                                  display: 'flex', 
                                  gap: '12px', 
                                  background: isReply ? 'var(--color-bg-light, rgba(0, 0, 0, 0.015))' : 'var(--color-surface, #fff)', 
                                  border: '1px solid var(--color-border-light)', 
                                  padding: isReply ? '10px 14px' : '14px 18px', 
                                  borderRadius: isReply ? '12px' : '16px',
                                  boxShadow: isReply ? 'inset 0 1px 2px rgba(0, 0, 0, 0.01)' : '0 2px 8px rgba(0, 0, 0, 0.02)',
                                  transition: 'all 0.5s ease',
                                  marginTop: isReply ? '4px' : '0',
                                  boxSizing: 'border-box'
                                }}
                              >
                                <Avatar src={comment.avatar_url || commUser?.avatar || commUser?.avatar_url} name={commUser?.full_name || comment.user_name || 'Đồng nghiệp'} size={isReply ? 24 : 32} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                    <span style={{ fontSize: isReply ? '0.76rem' : '0.82rem', fontWeight: 800, color: 'var(--color-text)' }}>{commUser?.full_name || comment.user_name || 'Đồng nghiệp'}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{new Date(comment.created_at.replace(/-/g, '/')).toLocaleString('vi-VN')}</span>
                                  </div>
                                  {comment.content && /<[a-z][\s\S]*>/i.test(comment.content) ? (
                                    <div 
                                      className="rich-text-editor-content"
                                      dangerouslySetInnerHTML={{ __html: linkifyHtml(comment.content) }}
                                      style={{ fontSize: isReply ? '0.78rem' : '0.825rem', color: 'var(--color-text-light)', margin: '6px 0 0', lineHeight: '1.45' }}
                                    />
                                  ) : (
                                    <div style={{ fontSize: isReply ? '0.78rem' : '0.825rem', color: 'var(--color-text-light)', margin: '6px 0 0', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                                      {renderCommentContent(comment.content)}
                                    </div>
                                  )}
                                  {commentParsedAtts.length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                                      {commentParsedAtts.map((url: any, aIdx: number) => {
                                        const name = typeof url === 'string' ? url.substring(url.lastIndexOf('/') + 1) : (url.name || 'File');
                                        const rawHref = typeof url === 'string' ? url : (url.url || '#');

                                        const apiBase = import.meta.env.VITE_API_URL || '/backend';
                                        let href = rawHref;
                                        if (rawHref && rawHref.startsWith('uploads/')) {
                                          href = `${apiBase}/${rawHref}`;
                                        } else if (rawHref && rawHref.startsWith('storage/uploads/')) {
                                          href = `${apiBase}/${rawHref.replace('storage/uploads/', 'uploads/')}`;
                                        }

                                        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(href);

                                        if (isImage) {
                                          return (
                                            <div key={aIdx} style={{ marginTop: '4px', display: 'inline-block' }}>
                                              <a href={href} target="_blank" rel="noreferrer">
                                                <img 
                                                  src={href} 
                                                  alt={name} 
                                                  style={{ 
                                                    maxWidth: '240px', 
                                                    maxHeight: '160px', 
                                                    borderRadius: '8px', 
                                                    border: '1px solid var(--color-border-light)', 
                                                    objectFit: 'cover',
                                                    cursor: 'zoom-in',
                                                    boxShadow: 'var(--shadow-sm)'
                                                  }} 
                                                />
                                              </a>
                                            </div>
                                          );
                                        }

                                        return (
                                          <a key={aIdx} href={href} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none', color: 'var(--color-primary)', fontSize: '0.65rem' }}>
                                            <FileText size={10} />
                                            <span>{name}</span>
                                          </a>
                                        );
                                      })}
                                    </div>
                                  )}
                                  
                                  {(() => {
                                    const isCurrentUserAdmin = ['admin', 'superadmin', 'super_admin', 'director'].includes(currentUser?.role || '');
                                    const isCommentAuthor = currentUser?.id && String(currentUser.id) === String(comment.user_id);
                                    const canDeleteComment = isCurrentUserAdmin || isCommentAuthor;

                                    if (!isReply || canDeleteComment) {
                                      return (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                                          {canDeleteComment && (
                                            <button
                                              onClick={() => setCommentToDelete(comment.id)}
                                              style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                color: 'var(--color-danger, #ef4444)', 
                                                cursor: 'pointer', 
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                padding: '4px' 
                                              }}
                                              className="hover-scale"
                                              title={t('Xóa bình luận')}
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          )}
                                          {!isReply && (
                                            <button
                                              onClick={() => setReplyTo({ id: comment.id, userName: commUser?.full_name || comment.user_name || 'Đồng nghiệp', avatar: comment.avatar_url || commUser?.avatar || commUser?.avatar_url })}
                                              style={{ 
                                                background: 'rgba(163, 20, 34, 0.05)', 
                                                border: 'none', 
                                                color: 'var(--color-primary)', 
                                                fontSize: '0.7rem', 
                                                padding: '4px 10px', 
                                                borderRadius: '12px',
                                                cursor: 'pointer', 
                                                fontWeight: 700, 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '4px' 
                                              }}
                                              className="hover-scale"
                                            >
                                              <MessageSquare size={11} />
                                              <span>Phản hồi</span>
                                            </button>
                                          )}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>
                            );
                          };

                          return rootComments.map((rootComment: any) => {
                            const replies = getReplies(rootComment.id);
                            return (
                              <div key={rootComment.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {renderSingleComment(rootComment, false)}
                                {replies.length > 0 && (
                                  <div style={{ 
                                    marginLeft: '20px', 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    gap: '8px', 
                                    borderLeft: '2px solid rgba(163, 20, 34, 0.15)', 
                                    paddingLeft: '14px', 
                                    marginTop: '8px',
                                    marginBottom: '6px'
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
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 5px', position: 'relative' }}>
                    {/* Scrollable Container for Timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '450px', overflowY: 'auto', paddingRight: '6px', position: 'relative' }} className="custom-scrollbar">
                      {/* Vertical line connector */}
                      <div style={{ position: 'absolute', left: '17px', top: '15px', bottom: '15px', width: '2px', background: 'var(--color-border-light)' }} />
                      
                      {loadingTimeline ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <StatRowSkeleton />
                          <StatRowSkeleton />
                        </div>
                      ) : timeline.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', padding: '20px 0' }}>
                          {t('Chưa có lịch sử hoạt động ghi nhận')}
                        </div>
                      ) : (
                        (() => {
                          const itemsPerPage = 20;
                          const startIndex = (timelinePage - 1) * itemsPerPage;
                          const paginatedTimeline = timeline.slice(startIndex, startIndex + itemsPerPage);

                          return paginatedTimeline.map((log: any, idx: number) => {
                            const dateStr = log.created_at ? new Date(log.created_at.replace(/-/g, '/')).toLocaleString('vi-VN') : '';
                            let data: any = {};
                            try {
                              data = JSON.parse(log.new_data || '{}');
                            } catch(e) {}

                            // Parse changes
                            const keys = Object.keys(data);
                            const displayKeys = keys.filter(k => [
                              'status', 'progress', 'priority', 'user_id', 'due_date'
                            ].includes(k));

                            const getActionMainText = () => {
                              switch (log.action) {
                                case 'CREATE':
                                  return t('đã tạo công việc này');
                                case 'UPDATE':
                                  if (displayKeys.length > 0) {
                                    return t('đã cập nhật các thông tin:');
                                  }
                                  return t('đã cập nhật thông tin công việc');
                                case 'ADD_COMMENT':
                                  return t('đã thêm bình luận mới');
                                case 'DELETE_COMMENT':
                                  return t('đã xóa bình luận');
                                case 'COMPLETE_SUBTASK':
                                  return `${t('đã hoàn thành công việc con')} "${data.title || ''}"`;
                                case 'INCOMPLETE_SUBTASK':
                                  return `${t('đã đánh dấu chưa hoàn thành công việc con')} "${data.title || ''}"`;
                                case 'ADD_SUBTASK':
                                  return `${t('đã thêm công việc con')} "${data.title || ''}"`;
                                case 'DELETE_SUBTASK':
                                  return `${t('đã xóa công việc con')} "${data.title || ''}"`;
                                case 'CANCEL_MEETING':
                                  return `${t('đã hủy lịch hẹn')} (Lý do: "${data.reason || ''}")`;
                                case 'RESCHEDULE_MEETING':
                                  return `${t('đã dời lịch hẹn đến ngày')} ${data.due_date || ''}`;
                                default:
                                  return `${t('đã thực hiện thao tác')} "${log.action}"`;
                              }
                            };

                            return (
                              <div key={idx} style={{ display: 'flex', gap: '15px', position: 'relative', zIndex: 1 }}>
                                {/* Avatar */}
                                <div style={{ flexShrink: 0 }}>
                                  <Avatar 
                                    src={log.user_avatar} 
                                    name={log.user_name || t('Hệ thống')} 
                                    size={36} 
                                  />
                                </div>
                                
                                {/* Log details */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, paddingTop: '2px' }}>
                                  <div style={{ fontSize: '0.825rem', color: 'var(--color-text)', lineHeight: '1.4' }}>
                                    <strong style={{ color: 'var(--color-text)', marginRight: '6px', fontWeight: 700 }}>
                                      {log.user_name || t('Hệ thống')}
                                    </strong>
                                    {getActionMainText()}
                                  </div>
                                  {log.action === 'UPDATE' && displayKeys.length > 0 && (
                                    <div style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column', 
                                      gap: '4px', 
                                      marginTop: '2px',
                                      marginBottom: '2px',
                                      paddingLeft: '10px',
                                      borderLeft: '2px solid var(--color-border-light)'
                                    }}>
                                      {displayKeys.map(k => {
                                        const val = data[k];
                                        let label = '';
                                        let displayVal = val;
                                        
                                        if (k === 'status') {
                                          label = t('Trạng thái');
                                          const statusLabels: Record<string, string> = {
                                            todo: t('Cần làm'),
                                            in_progress: t('Đang làm'),
                                            done: t('Hoàn thành'),
                                            cancelled: t('Đã hủy'),
                                            pending: t('Chờ duyệt'),
                                            planned: t('Lên kế hoạch')
                                          };
                                          displayVal = statusLabels[val] || val;
                                        } else if (k === 'progress') {
                                          label = t('Tiến độ');
                                          displayVal = `${val}%`;
                                        } else if (k === 'priority') {
                                          label = t('Độ ưu tiên');
                                          const priorityLabels: Record<string, string> = {
                                            low: t('Thấp'),
                                            medium: t('Trung bình'),
                                            high: t('Cao')
                                          };
                                          displayVal = priorityLabels[val] || val;
                                        } else if (k === 'user_id') {
                                          label = t('Người thực hiện');
                                          const assignedUser = users.find(u => Number(u.id) === Number(val));
                                          displayVal = assignedUser?.full_name || val;
                                        } else if (k === 'due_date') {
                                          label = t('Thời hạn');
                                          displayVal = val ? new Date(val).toLocaleDateString('vi-VN') : t('Không có');
                                        } else if (k === 'body') {
                                          label = t('Mô tả');
                                          displayVal = t('Đã cập nhật nội dung');
                                        } else if (k === 'subject') {
                                          label = t('Tên công việc');
                                          displayVal = val;
                                        } else if (k === 'participant_ids') {
                                          label = t('Người liên quan');
                                          displayVal = t('Đã cập nhật danh sách');
                                        } else if (k === 'tags') {
                                          label = t('Nhãn công việc');
                                          displayVal = val;
                                        } else {
                                          label = k;
                                        }
                                        
                                        return (
                                          <span key={k} style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                                            • {label}: <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{displayVal}</strong>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                  
                                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                    {dateStr}
                                  </span>
                                </div>
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>

                    {/* Pagination Controls */}
                    {timeline.length > 20 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '10px', borderTop: '1px solid var(--color-border-light)', paddingTop: '15px' }}>
                        {Array.from({ length: Math.min(5, Math.ceil(timeline.length / 20)) }).map((_, pIdx) => {
                          const pNum = pIdx + 1;
                          return (
                            <button
                              key={pNum}
                              onClick={() => setTimelinePage(pNum)}
                              className={`btn sm ${timelinePage === pNum ? 'primary' : 'border'}`}
                              style={{ 
                                minWidth: '32px', 
                                height: '32px', 
                                borderRadius: '8px', 
                                padding: 0, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                background: timelinePage === pNum ? 'var(--color-primary)' : 'var(--color-surface)',
                                borderColor: timelinePage === pNum ? 'var(--color-primary)' : 'var(--color-border)',
                                color: timelinePage === pNum ? '#fff' : 'var(--color-text)'
                              }}
                            >
                              {pNum}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Bottom Spacer to prevent content from being flush against the bottom */}
            <div style={{ height: '5rem', flexShrink: 0 }} />
          </div>

          {/* Right Column (3) */}
          <div 
            style={{ 
              flex: isMobileOrTablet ? 'none' : 3, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: isMobileOrTablet ? '1rem' : (embedMode ? '12px' : '1.5rem'), 
              minWidth: 0,
              background: 'var(--color-bg)',
              borderLeft: isMobileOrTablet ? 'none' : '1px solid var(--color-border-light)',
              overflowY: 'auto',
              padding: isMobileOrTablet ? '1rem 1rem 100px 1rem' : (embedMode ? '1rem 0.5rem 1.5rem 0.5rem' : '1.5rem 2rem 1.5rem 2rem')
            }}
            className="custom-scrollbar"
          >
            
            {/* Tiến độ công việc */}
            <div className="card" style={cardStyle}>
              {formData.type === 'meeting' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Trạng thái lịch hẹn')}</span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Trạng thái hiện tại:')}</span>
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        background: formData.status === 'done' 
                          ? 'rgba(16, 185, 129, 0.08)' 
                          : (formData.status === 'cancelled' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)'),
                        color: formData.status === 'done' 
                          ? 'var(--color-success)' 
                          : (formData.status === 'cancelled' ? 'var(--color-danger)' : 'var(--color-warning)')
                      }}
                    >
                      {formData.status === 'done' ? t('Đã gặp') : (formData.status === 'cancelled' ? t('Đã hủy') : t('Chưa gặp'))}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    {/* Đã gặp Button */}
                    <button 
                      className="btn success" 
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', 
                        padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer',
                        background: formData.status === 'done' ? 'var(--color-success)' : 'rgba(16, 185, 129, 0.08)',
                        color: formData.status === 'done' ? '#fff' : 'var(--color-success)',
                        transition: 'all 0.2s'
                      }}
                      onClick={async () => {
                        try {
                          const res = await api.get(`/activities/${task.id}/comments`);
                          const commentsList = res.data.data || [];
                          const hasImage = commentsList.some((c: any) => {
                            const atts = Array.isArray(c.attachments) ? c.attachments : JSON.parse(c.attachments || '[]');
                            return atts.some((att: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(att));
                          });

                          if (hasImage) {
                            await api.put(`/activities/${task.id}`, { status: 'done', progress: 100 });
                            setFormData((prev: any) => ({ ...prev, status: 'done', progress: 100 }));
                            onUpdate();
                            toast.success(t('Đã cập nhật trạng thái lịch hẹn thành công'));
                          } else {
                            setMeetingToComplete(task);
                            setProofCommentText('Ảnh minh chứng hoàn thành gặp gỡ');
                            setProofImageFile(null);
                            setProofImagePreview(null);
                          }
                        } catch (e) {
                          toast.error(t('Lỗi khi kiểm tra minh chứng'));
                        }
                      }}
                    >
                      <CheckCircle2 size={14} /> {t('Đã gặp')}
                    </button>

                    {/* Hủy Button */}
                    <button 
                      className="btn danger" 
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', 
                        padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer',
                        background: formData.status === 'cancelled' ? 'var(--color-danger)' : 'rgba(239, 68, 68, 0.08)',
                        color: formData.status === 'cancelled' ? '#fff' : 'var(--color-danger)',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => {
                        setCancellingMeeting(task);
                        setCancelReason('');
                      }}
                    >
                      <XCircle size={14} /> {t('Hủy lịch hẹn')}
                    </button>

                    {/* Dời lịch Button & Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--color-border-light)', paddingTop: '10px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} /> {t('Dời lịch hẹn sang:')}
                      </span>
                      <input 
                        type="datetime-local" 
                        value={formData.due_date ? formData.due_date.slice(0, 16) : ''}
                        onChange={async (e) => {
                          const newDate = e.target.value;
                          if (newDate) {
                            const formatted = new Date(newDate).toISOString();
                            try {
                              const payload = { due_date: formatted, status: 'open', progress: 0 };
                              await api.put(`/activities/${task.id}`, payload);
                              setFormData((prev: any) => ({ ...prev, due_date: formatted, status: 'open', progress: 0 }));
                              onUpdate();
                              toast.success(t('Đã dời lịch hẹn thành công'));
                            } catch (err) {
                              toast.error(t('Lỗi khi dời lịch hẹn'));
                            }
                          }
                        }}
                        style={{ 
                          width: '100%', 
                          fontSize: '0.8rem', 
                          padding: '6px 10px', 
                          borderRadius: '8px', 
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-text)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Tiến độ công việc')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.progress ?? 0}
                        onChange={(e) => {
                          let val = Number(e.target.value);
                          if (isNaN(val)) val = 0;
                          val = Math.min(100, Math.max(0, val));
                          setFormData((prev: any) => {
                            const next: any = { ...prev, progress: val };
                            if (val === 100 && prev.require_approval === 1 && prev.approver_id) {
                              next.approval_status = 'pending';
                            } else if (val < 100) {
                              next.approval_status = null;
                            }
                            return next;
                          });
                        }}
                        style={{
                          width: '45px',
                          height: '24px',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          textAlign: 'center',
                          color: 'var(--color-primary)',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '4px',
                          background: 'var(--color-surface)',
                          padding: 0
                        }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.progress || 0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormData((prev: any) => {
                        const next: any = { ...prev, progress: val };
                        if (val === 100 && prev.require_approval === 1 && prev.approver_id) {
                          next.approval_status = 'pending';
                        } else if (val < 100) {
                          next.approval_status = null;
                        }
                        return next;
                      });
                    }}
                    className="progress-slider"
                    style={{
                      background: (formData.progress || 0) === 100
                        ? 'var(--color-success)'
                        : 'linear-gradient(to right, #BD1D2D 0%, #F97316 ' + (formData.progress || 0) + '%, var(--color-border-light) ' + (formData.progress || 0) + '%, var(--color-border-light) 100%)'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </>
              )}
            </div>

            {/* Khách hàng liên quan */}
            {(currentUser?.role === 'superadmin' || currentUser?.role === 'admin' || currentUser?.role === 'sale') && (
              <div className="card" style={cardStyle}>
                
                {/* Primary Contact (if any) */}
                {((formData.related_type === 'contact' || formData.contact_id) && (formData.related_type === 'contact' ? formData.related_id : formData.contact_id)) ? (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        {t('Khách hàng chính')}
                      </div>
                      {task.id === 'new' && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ 
                              ...formData, 
                              contact_id: null, 
                              contact_name: '',
                              ...(formData.related_type === 'contact' ? { related_id: '', related_type: null } : {})
                            });
                          }}
                          style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.75rem', padding: '2px' }}
                        >
                          {t('Thay đổi')}
                        </button>
                      )}
                    </div>
                    <div 
                      className="hover-lift"
                      onClick={() => {
                        if (onOpenContact) {
                          onOpenContact(Number(formData.related_type === 'contact' ? formData.related_id : formData.contact_id));
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: 'rgba(0, 0, 0, 0.015)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Avatar 
                          name={formData.contact_name || t('Khách hàng')} 
                          src={allowedContacts.find(c => String(c.id) === String(formData.contact_id || formData.related_id))?.avatar_url || allowedContacts.find(c => String(c.id) === String(formData.contact_id || formData.related_id))?.avatar}
                          size={24} 
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {formData.contact_name || t('Khách hàng')}
                          </span>
                          <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
                            {allowedContacts.find(c => String(c.id) === String(formData.contact_id || formData.related_id))?.phone || allowedContacts.find(c => String(c.id) === String(formData.contact_id || formData.related_id))?.email || t('Xem hồ sơ')}
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight size={16} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {t('Khách hàng chính *')}
                    </div>
                    <CustomSelect
                      searchable
                      options={[
                        { value: '', label: t('Chọn khách hàng chính...') },
                        ...allowedContacts.map(c => ({
                          value: String(c.id),
                          label: `${getContactFullName(c)} ${c.phone ? `(${c.phone})` : ''}`,
                          avatar: c.avatar_url || c.avatar
                        }))
                      ]}
                      value={formData.contact_id ? String(formData.contact_id) : (formData.related_type === 'contact' && formData.related_id ? String(formData.related_id) : '')}
                      onChange={async val => {
                        const selected = allowedContacts.find(c => String(c.id) === String(val));
                        const contactIdVal = val ? Number(val) : null;
                        const contactNameVal = selected ? getContactFullName(selected) : '';
                        const isContactRelated = (formData.related_type === 'contact' || !formData.related_type);
                        
                        setFormData({
                          ...formData,
                          contact_id: contactIdVal,
                          contact_name: contactNameVal,
                          ...(isContactRelated ? {
                            related_id: contactIdVal,
                            related_type: contactIdVal ? 'contact' : null
                          } : {})
                        });

                        if (task.id !== 'new') {
                          try {
                            await api.put(`/activities/${task.id}`, {
                              contact_id: contactIdVal,
                              ...(isContactRelated ? {
                                related_id: contactIdVal,
                                related_type: contactIdVal ? 'contact' : null
                              } : {})
                            });
                            onUpdate();
                          } catch (e: any) {
                            toast.error(t('Lỗi cập nhật khách hàng liên kết: ') + e.message);
                          }
                        }
                      }}
                      placeholder={t('Chọn khách hàng chính...')}
                    />
                  </div>
                )}

                {/* Additional Contacts list */}
                {(() => {
                  const addContactIds = erpMeta.related_contact_ids || [];
                  const addContacts = allowedContacts.filter(c => addContactIds.includes(Number(c.id)));
                  const mainContactId = Number(formData.related_id || formData.contact_id || 0);
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {addContacts.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                            {t('Khách hàng liên kết thêm')} ({addContacts.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {addContacts.map(c => (
                              <div 
                                key={c.id} 
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: 'rgba(0, 0, 0, 0.015)',
                                  border: '1px solid var(--color-border-light)',
                                  padding: '8px 12px',
                                  borderRadius: '10px'
                                }}
                              >
                                <div 
                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}
                                  onClick={() => {
                                    if (onOpenContact) {
                                      onOpenContact(Number(c.id));
                                    }
                                  }}
                                >
                                  <Avatar name={getContactFullName(c)} src={c.avatar_url || c.avatar} size={22} />
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>{getContactFullName(c)}</span>
                                    <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>{c.phone || c.email || t('Xem hồ sơ')}</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextIds = addContactIds.filter((id: number) => id !== Number(c.id));
                                    const updatedMeta = { ...erpMeta, related_contact_ids: nextIds };
                                    setErpMeta(updatedMeta);
                                    handleSaveMeta(updatedMeta);
                                  }}
                                  style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem', padding: '4px' }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Picker/Dropdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                          {t('Thêm khách hàng liên kết')}
                        </div>
                        <CustomSelect
                          multiple
                          searchable
                          showAvatars
                          options={allowedContacts
                            .filter(c => Number(c.id) !== mainContactId)
                            .map(c => ({
                              value: String(c.id),
                              label: `${getContactFullName(c)} ${c.phone ? `(${c.phone})` : ''}`,
                              avatar: c.avatar_url || c.avatar
                            }))}
                          value={addContactIds.map(String)}
                          onChange={(vals) => {
                            const nextIds = vals.map(Number);
                            const updatedMeta = { ...erpMeta, related_contact_ids: nextIds };
                            setErpMeta(updatedMeta);
                            handleSaveMeta(updatedMeta);
                          }}
                          placeholder={t('Chọn khách hàng...')}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}


            {/* Approval Banner */}
            {formData.require_approval === 1 && formData.progress === 100 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px',
                borderRadius: '12px',
                background: formData.approval_status === 'pending' ? 'rgba(245, 158, 11, 0.06)' : formData.approval_status === 'approved' ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                border: `1px solid ${formData.approval_status === 'pending' ? 'var(--color-warning)' : formData.approval_status === 'approved' ? 'var(--color-success)' : 'var(--color-danger)'}`,
                color: formData.approval_status === 'pending' ? 'var(--color-warning)' : formData.approval_status === 'approved' ? 'var(--color-success)' : 'var(--color-danger)',
              }}>
                <div style={{ fontSize: '0.825rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} />
                  <span>
                    {formData.approval_status === 'pending' ? (
                      `Đang chờ Người duyệt (${users.find(u => String(u.id) === String(formData.approver_id))?.full_name || 'Chưa phân công'}) phê duyệt hoàn thành.`
                    ) : formData.approval_status === 'approved' ? (
                      t('Nhiệm vụ đã được phê duyệt duyệt thành công!')
                    ) : (
                      t('Yêu cầu hoàn thành nhiệm vụ bị từ chối!')
                    )}
                  </span>
                </div>
                {formData.approval_status === 'pending' && isApproverOrAdmin && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      className="btn primary"
                      disabled={isSaving}
                      onClick={async () => {
                        setIsSaving(true);
                        try {
                          const res = await api.put(`/activities/${task.id}`, { approval_status: 'approved', status: 'done' });
                          if (res.data && res.data.success) {
                            setFormData((prev: any) => ({ ...prev, approval_status: 'approved', status: 'done' }));
                            toast.success(t('Đã phê duyệt hoàn thành công việc!'));
                            onUpdate();
                          }
                        } catch (e: any) {
                          toast.error(t('Lỗi phê duyệt: ') + e.message);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      style={{ height: '28px', fontSize: '0.72rem', fontWeight: 700, padding: '0 10px', background: 'var(--color-success)', borderColor: 'var(--color-success)', color: 'white' }}
                    >
                      {isSaving ? t('Đang duyệt...') : t('Phê duyệt')}
                    </button>
                    <button
                      className="btn outline"
                      disabled={isSaving}
                      onClick={async () => {
                        setIsSaving(true);
                        try {
                          const res = await api.put(`/activities/${task.id}`, { approval_status: 'rejected', progress: 90 });
                          if (res.data && res.data.success) {
                            setFormData((prev: any) => ({ ...prev, approval_status: 'rejected', progress: 90 }));
                            toast.success(t('Đã từ chối phê duyệt hoàn thành.'));
                            onUpdate();
                          }
                        } catch (e: any) {
                          toast.error(t('Lỗi từ chối: ') + e.message);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      style={{ height: '28px', fontSize: '0.72rem', fontWeight: 700, padding: '0 10px', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                    >
                      {isSaving ? t('Đang từ chối...') : t('Từ chối')}
                    </button>
                  </div>
                )}
              </div>
            )}



            {/* Yêu cầu phê duyệt */}
            <div className="card" style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Yêu cầu phê duyệt')}</span>
                  <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', margin: 0 }}>{t('Duyệt hoàn thành khi đạt 100%')}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const next = formData.require_approval === 1 ? 0 : 1;
                    const nextData: any = { require_approval: next };
                    if (next === 0) {
                      nextData.approver_id = null;
                      nextData.approval_status = null;
                    } else if (formData.progress === 100 && formData.approver_id) {
                      nextData.approval_status = 'pending';
                    }
                    
                    setFormData((prev: any) => ({ ...prev, ...nextData }));

                    if (task.id !== 'new') {
                      try {
                        await api.put(`/activities/${task.id}`, nextData);
                        onUpdate();
                      } catch (e: any) {
                        toast.error(t('Lỗi cập nhật yêu cầu phê duyệt: ') + e.message);
                      }
                    }
                  }}
                  style={{
                    width: '38px',
                    height: '20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: formData.require_approval === 1 ? 'var(--color-success)' : '#e5e7eb',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'var(--color-surface)',
                    position: 'absolute',
                    top: '2px',
                    left: formData.require_approval === 1 ? 20 : 2,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                  }} />
                </button>
              </div>

              {formData.require_approval === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', borderTop: '1px solid var(--color-border-light)', paddingTop: '8px' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t('Người phê duyệt')}</label>
                  <CustomSelect
                    options={approverOptions.map(u => ({
                      value: String(u.id),
                      label: `${u.full_name} (${getRoleDisplayName(u)})`,
                      avatar: u.avatar || u.avatar_url
                    }))}
                    value={formData.approver_id ? String(formData.approver_id) : ''}
                    onChange={async val => {
                      const nextVal = val ? Number(val) : null;
                      const nextData: any = { approver_id: nextVal };
                      if (formData.progress === 100 && nextVal) {
                        nextData.approval_status = 'pending';
                      }
                      
                      setFormData((prev: any) => ({ ...prev, ...nextData }));

                      if (task.id !== 'new') {
                        try {
                          await api.put(`/activities/${task.id}`, nextData);
                          onUpdate();
                        } catch (e: any) {
                          toast.error(t('Lỗi cập nhật người phê duyệt: ') + e.message);
                        }
                      }
                    }}
                    placeholder={t('Chọn người phê duyệt...')}
                    searchable
                    showAvatars
                  />
                </div>
              )}
            </div>

            {/* Liên kết team */}
            <div className="card" style={cardStyle}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                {t('Liên kết team')}
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {/* Selected team pills */}
                {(() => {
                  const selectedTeamIds = erpMeta?.team_ids || (erpMeta?.team_id ? [erpMeta.team_id] : []);
                  const selectedTeams = allowedTeams.filter(t => selectedTeamIds.includes(t.id) || selectedTeamIds.includes(String(t.id)) || selectedTeamIds.includes(Number(t.id)));
                  
                  return (
                    <>
                      {selectedTeams.map(t => (
                        <span 
                          key={t.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 12px',
                            background: 'rgba(107, 114, 128, 0.08)',
                            color: 'var(--color-text)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            borderRadius: '16px',
                            border: '1px solid rgba(107, 114, 128, 0.16)'
                          }}
                        >
                          <Users size={13} style={{ opacity: 0.7 }} color="var(--color-text-muted)" />
                          {t.name}
                          <button
                            type="button"
                            onClick={() => {
                              const nextTeamIds = selectedTeamIds.filter(id => String(id) !== String(t.id));
                              const nextMeta = { ...erpMeta, team_ids: nextTeamIds, team_id: nextTeamIds[0] || null };
                              setErpMeta(nextMeta);
                              handleSaveMeta(nextMeta);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'rgba(107, 114, 128, 0.8)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              padding: 0,
                              fontSize: '0.85rem',
                              marginLeft: '4px'
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </>
                  );
                })()}

                {/* Dash add button for teams */}
                <button
                  type="button"
                  onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                  style={{
                    border: '1px dashed var(--color-primary)',
                    background: 'rgba(163, 20, 34, 0.04)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'all 0.15s ease'
                  }}
                  className="hover-scale"
                  title={t('Liên kết thêm team')}
                >
                  <Plus size={16} color="var(--color-primary)" />
                </button>

                {/* Dropdown list of teams */}
                {showTeamDropdown && (
                  <div 
                    ref={teamDropdownRef}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '6px',
                      zIndex: 9999,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '16px',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
                      minWidth: '260px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px'
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', padding: '6px 8px', borderBottom: '1px dashed var(--color-border-light)', marginBottom: '4px' }}>
                      {t('Chọn team liên kết:')}
                    </div>
                    {allowedTeams.map((tItem: any) => {
                      const selectedTeamIds = erpMeta?.team_ids || (erpMeta?.team_id ? [erpMeta.team_id] : []);
                      const isSelected = selectedTeamIds.some(id => String(id) === String(tItem.id));
                      
                      return (
                        <div
                          key={tItem.id}
                          onClick={() => {
                            let nextTeamIds = [...selectedTeamIds];
                            if (isSelected) {
                              nextTeamIds = nextTeamIds.filter(id => String(id) !== String(tItem.id));
                            } else {
                              nextTeamIds.push(tItem.id);
                              
                              // Automatically add all members of this team to related users!
                              const teamUsers = users.filter(u => Number(u.team_id) === Number(tItem.id));
                              if (teamUsers.length > 0) {
                                const currentP = getParticipantIds(formData.participant_ids);
                                const nextP = [...currentP];
                                let addedCount = 0;
                                teamUsers.forEach(u => {
                                  const uidStr = String(u.id);
                                  if (!nextP.includes(uidStr)) {
                                    nextP.push(uidStr);
                                    addedCount++;
                                  }
                                });
                                if (addedCount > 0) {
                                  const nextPString = nextP.join(',');
                                  setFormData((prev: any) => ({ ...prev, participant_ids: nextPString }));
                                  handleUpdateField('participant_ids', nextPString);
                                  toast.success(t('Đã tự động thêm {count} nhân sự thuộc phòng ban vào người liên quan.').replace('{count}', String(addedCount)));
                                }
                              }
                            }
                            const nextMeta = { ...erpMeta, team_ids: nextTeamIds, team_id: nextTeamIds[0] || null };
                            setErpMeta(nextMeta);
                            handleSaveMeta(nextMeta);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                            color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                            fontWeight: isSelected ? 600 : 400
                          }}
                          className="hover-bg-alt"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={14} color={isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                            <span>{tItem.name}</span>
                          </div>
                          {isSelected && <Check size={12} color="var(--color-primary)" strokeWidth={3} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Người thực hiện & Người liên quan */}
            <div className="card" style={cardStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={cardLabelStyle}>
                    {t('Người thực hiện chính')}
                  </label>
                  <CustomSelect
                    options={users.map(u => ({
                      value: String(u.id),
                      label: u.full_name,
                      avatar: u.avatar || u.avatar_url
                    }))}
                    value={String(formData.user_id || '')}
                    onChange={val => {
                      handleUpdateField('user_id', Number(val));
                    }}
                    searchable
                    showAvatars
                  />
                </div>
                
                <div style={{ borderTop: '1px dashed var(--color-border-light)', paddingTop: '12px' }}>
                  <label style={cardLabelStyle}>
                    {t('Người liên quan')}
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {/* Selected participant avatars */}
                    {participants.length > 0 && (
                      <div 
                        style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setShowParticipantsModal(true)}
                        title={t('Xem chi tiết người liên quan')}
                        className="hover-lift"
                      >
                        {participants.map((u, idx) => (
                          <div
                            key={u.id}
                            style={{
                              marginLeft: idx === 0 ? 0 : -8,
                              border: '1.5px solid var(--color-surface)',
                              borderRadius: '50%',
                              overflow: 'hidden',
                              zIndex: 10 - idx,
                              boxShadow: 'var(--shadow-sm)',
                              display: 'flex'
                            }}
                            title={u.full_name || u.name}
                          >
                            <Avatar src={u.avatar || u.avatar_url} name={u.full_name || u.name} size={28} />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Dash add button */}
                    <button
                      type="button"
                      onClick={() => setShowParticipantDropdown(!showParticipantDropdown)}
                      disabled={currentUser?.role === 'viewer'}
                      style={{
                        border: '1px dashed var(--color-primary)',
                        background: 'rgba(163, 20, 34, 0.04)',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: currentUser?.role === 'viewer' ? 'default' : 'pointer',
                        padding: 0,
                        transition: 'all 0.15s ease'
                      }}
                      className="hover-scale"
                      title={t('Thêm người liên quan')}
                    >
                      <UserPlus size={14} color="var(--color-primary)" />
                    </button>
                    
                    {showParticipantDropdown && (
                      <div 
                        ref={participantDropdownRef}
                        style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '6px',
                        zIndex: 9999,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.18)',
                        minWidth: '220px',
                        maxHeight: '230px',
                        overflowY: 'auto',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', padding: '4px 8px' }}>
                          {t('Chọn người liên quan:')}
                        </div>
                        {users.map((u: any) => {
                          const isSelected = participantIds.includes(Number(u.id));
                          return (
                            <div
                              key={u.id}
                              onClick={() => handleToggleParticipant(Number(u.id))}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                                color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                fontWeight: isSelected ? 600 : 400
                              }}
                              className="hover-bg-alt"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Avatar src={u.avatar || u.avatar_url} name={u.full_name || u.name} size={20} />
                                <span>{u.full_name || u.name}</span>
                              </div>
                              {isSelected && <Check size={12} color="var(--color-primary)" strokeWidth={3} />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>





            {/* Phân loại công việc */}
            <div className="card" style={cardStyle}>
              <label style={cardLabelStyle}>
                {t('Phân loại công việc')}
              </label>
              <CustomSelect
                options={[
                  { value: 'task', label: t('Công việc chính') },
                  { value: 'meeting', label: t('Lịch hẹn gặp gỡ') }
                ]}
                value={formData.type || 'task'}
                onChange={async (val) => {
                  const newType = String(val);
                  setFormData((prev: any) => ({ ...prev, type: newType }));
                  await handleUpdateField('type', newType);
                  onUpdate();
                  toast.success(t('Đã thay đổi phân loại công việc'));
                }}
              />
            </div>

            {/* Độ ưu tiên & Hạn hoàn thành */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="card" style={cardStyle}>
                <label style={cardLabelStyle}>
                  {t('Độ ưu tiên')}
                </label>
                <CustomSelect
                  options={[
                    { value: 'high', label: t('Cao') },
                    { value: 'medium', label: t('Trung bình') },
                    { value: 'low', label: t('Thấp') }
                  ]}
                  value={formData.priority || 'medium'}
                  onChange={val => {
                    handleUpdateField('priority', String(val));
                  }}
                />
              </div>

              <div className="card" style={cardStyle}>
                <label style={cardLabelStyle}>
                  {t('Hạn hoàn thành')}
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.due_date ? formData.due_date.substring(0, 10) : ''}
                  onChange={(e) => {
                    handleUpdateField('due_date', e.target.value || null);
                  }}
                  style={{ fontSize: '0.8rem', padding: '6px 10px', height: '36px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
                />
              </div>
            </div>

            {/* Thẻ tag */}
            <div className="card" style={cardStyle}>
              <label style={cardLabelStyle}>
                {t('Thẻ tag')}
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                {(formData.tags || '').split(',').filter(Boolean).map((tag: string, tIdx: number) => {
                  const trimmedTag = tag.trim();
                  if (trimmedTag === 'internal_task') return null;
                  return (
                    <span key={tIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(107, 114, 128, 0.08)', color: 'var(--color-text-light)', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                      <span>{trimmedTag}</span>
                      <button
                        onClick={() => {
                          const next = (formData.tags || '').split(',').filter(Boolean).filter((t: string) => t !== tag).join(',');
                          handleUpdateField('tags', next);
                        }}
                        style={{ border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', padding: 0 }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
              <input
                type="text"
                className="form-input"
                placeholder={t('Gõ tag & nhấn Enter...')}
                style={{ fontSize: '0.78rem', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const inputVal = (e.target as HTMLInputElement).value.trim();
                    if (inputVal) {
                      const tags = (formData.tags || '').split(',').filter(Boolean);
                      if (!tags.includes(inputVal)) {
                        tags.push(inputVal);
                        handleUpdateField('tags', tags.join(','));
                      }
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
            </div>

            {/* Lặp lại định kỳ */}
            <div className="card" style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={cardLabelStyle}>{t('Lặp lại định kỳ')}</span>
                  {erpMeta.recurrence?.pattern && erpMeta.recurrence.pattern !== 'none' && (
                    <span className="badge success" style={{ fontSize: '0.625rem', borderRadius: '4px', padding: '2px 6px', textTransform: 'none', letterSpacing: 'normal' }}>
                      {erpMeta.recurrence?.pattern === 'daily' ? t('Hàng ngày') :
                       erpMeta.recurrence?.pattern === 'weekly' ? t('Hàng tuần') :
                       erpMeta.recurrence?.pattern === 'monthly' ? t('Hàng tháng') :
                       erpMeta.recurrence?.pattern === 'custom_days' ? t('Theo chu kỳ') : ''}
                    </span>
                  )}
                </div>
                
                <div style={{ width: '180px' }}>
                  <CustomSelect
                    options={[
                      { value: 'none', label: t('Không lặp lại') },
                      { value: 'daily', label: t('Hàng ngày') },
                      { value: 'weekly', label: t('Hàng tuần') },
                      { value: 'monthly', label: t('Hàng tháng') },
                      { value: 'custom_days', label: t('Chu kỳ ngày') }
                    ]}
                    value={erpMeta.recurrence?.pattern || 'none'}
                    onChange={val => {
                      const nextPattern = val.toString();
                      const nextRecurrence = {
                        ...(erpMeta.recurrence || { weekly_days: [], monthly_day: 1, days_interval: 3, last_generated: '' }),
                        pattern: nextPattern
                      };
                      const nextMeta = { ...erpMeta, recurrence: nextRecurrence };
                      setErpMeta(nextMeta);
                      handleSaveMeta(nextMeta);
                    }}
                    width="100%"
                  />
                </div>
              </div>

              {erpMeta.recurrence?.pattern && erpMeta.recurrence.pattern !== 'none' && erpMeta.recurrence.pattern !== 'daily' && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '10px 14px', 
                  background: 'var(--color-bg)', 
                  borderRadius: '8px', 
                  marginTop: '4px',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap'
                }}>
                  {erpMeta.recurrence?.pattern === 'weekly' && (
                    <>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Chọn ngày lặp lại:')}</span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[
                          { key: 1, label: 'T2' }, { key: 2, label: 'T3' }, { key: 3, label: 'T4' },
                          { key: 4, label: 'T5' }, { key: 5, label: 'T6' }, { key: 6, label: 'T7' },
                          { key: 0, label: 'CN' }
                        ].map(day => {
                          const isSelected = (erpMeta.recurrence?.weekly_days || []).includes(day.key);
                          return (
                            <button
                              key={day.key}
                              type="button"
                              onClick={() => {
                                const isSelected = (erpMeta.recurrence?.weekly_days || []).includes(day.key);
                                const newDays = isSelected ? [] : [day.key];
                                const nextRecurrence = {
                                  ...(erpMeta.recurrence || { monthly_day: 1, days_interval: 3, last_generated: '' }),
                                  weekly_days: newDays
                                };
                                const nextMeta = { ...erpMeta, recurrence: nextRecurrence };
                                setErpMeta(nextMeta);
                                handleSaveMeta(nextMeta);
                              }}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                                color: isSelected ? 'white' : 'var(--color-text)',
                                transition: 'all 0.15s',
                                boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.2)' : 'none'
                              }}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {erpMeta.recurrence?.pattern === 'monthly' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Chọn ngày trong tháng để tự động lặp lại:')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text)', fontWeight: 600 }}>{t('Ngày')}</span>
                        <input
                          type="number"
                          className="form-input"
                          min={1}
                          max={31}
                          value={erpMeta.recurrence?.monthly_day || 1}
                          onChange={e => {
                            const dayVal = Math.min(31, Math.max(1, Number(e.target.value)));
                            const nextRecurrence = {
                              ...(erpMeta.recurrence || { weekly_days: [], days_interval: 3, last_generated: '' }),
                              monthly_day: dayVal
                            };
                            const nextMeta = { ...erpMeta, recurrence: nextRecurrence };
                            setErpMeta(nextMeta);
                          }}
                          onBlur={() => {
                            handleSaveMeta(erpMeta);
                          }}
                          style={{ width: '55px', height: '32px', textAlign: 'center', padding: 0, borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                        />
                      </div>
                    </div>
                  )}

                  {erpMeta.recurrence?.pattern === 'custom_days' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Tự động tạo nhiệm vụ mới sau một khoảng thời gian:')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text)', fontWeight: 600 }}>{t('Mỗi')}</span>
                        <input
                          type="number"
                          className="form-input"
                          min={1}
                          max={365}
                          value={erpMeta.recurrence?.days_interval || 3}
                          onChange={e => {
                            const daysVal = Math.max(1, Number(e.target.value));
                            const nextRecurrence = {
                              ...(erpMeta.recurrence || { weekly_days: [], monthly_day: 1, last_generated: '' }),
                              days_interval: daysVal
                            };
                            const nextMeta = { ...erpMeta, recurrence: nextRecurrence };
                            setErpMeta(nextMeta);
                          }}
                          onBlur={() => {
                            handleSaveMeta(erpMeta);
                          }}
                          style={{ width: '55px', height: '32px', textAlign: 'center', padding: 0, borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text)', fontWeight: 600 }}>{t('ngày')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Nút xóa công việc ở dưới cùng */}
            {canDelete && (
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleDeleteTask}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-danger)',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Trash2 size={13} />
                  {t('Xóa công việc')}
                </button>
              </div>
            )}

            {/* Bottom Spacer to prevent content from being flush against the bottom */}
            <div style={{ height: '5rem', flexShrink: 0 }} />
          </div>

        </div>



        {/* PARTICIPANTS & SUBTASKS MODAL */}
        {showParticipantsModal && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              zIndex: 1000300,
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fade-in 0.2s ease-out'
            }}
            onClick={() => { setShowParticipantsModal(false); setShowAddParticipantsSection(false); }}
          >
            <div 
              style={{
                width: '850px',
                maxWidth: '94vw',
                height: '80vh',
                background: 'var(--color-surface)',
                borderRadius: '20px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                animation: 'scale-up 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                    {t('Quản lý Người liên quan & Công việc')}
                  </h3>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                    {t('Chọn thành viên tham gia và theo dõi tiến độ của từng người')}
                  </p>
                </div>
                <button 
                  onClick={() => { setShowParticipantsModal(false); setShowAddParticipantsSection(false); }}
                  style={{ border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search Box */}
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', background: 'rgba(0,0,0,0.01)' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('Tìm kiếm thành viên...')}
                    value={participantsSearch}
                    onChange={(e) => setParticipantsSearch(e.target.value)}
                    style={{ paddingLeft: '12px', fontSize: '0.8rem', borderRadius: '8px' }}
                  />
                </div>
              </div>

              {/* Members List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }} className="custom-scrollbar">
                {(() => {
                  const currentRelatedUsers = filteredUsersForParticipants.filter((u: any) => participantIds.includes(Number(u.id)));
                  const nonRelatedUsers = filteredUsersForParticipants.filter((u: any) => !participantIds.includes(Number(u.id)));

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Current Related Members Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t('Thành viên liên quan')} ({currentRelatedUsers.length})
                        </span>
                        {currentRelatedUsers.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--color-text-muted)', fontSize: '0.78rem', fontStyle: 'italic', border: '1px dashed var(--color-border-light)', borderRadius: '12px' }}>
                            {t('Chưa có thành viên liên quan nào')}
                          </div>
                        ) : (
                          currentRelatedUsers.map((u: any) => {
                            const isParticipant = true;
                            const subtasks = (erpMeta.checklist || []).filter((item: any) => Number(item.assignee_id) === Number(u.id));

                            return (
                              <div 
                                key={u.id}
                                style={{
                                  background: 'rgba(189,29,45,0.02)',
                                  border: '1px solid var(--color-border-light)',
                                  borderRadius: '12px',
                                  padding: '10px 14px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px',
                                  transition: 'all 0.2s'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input
                                      type="checkbox"
                                      checked={isParticipant}
                                      onChange={() => handleToggleParticipant(u.id)}
                                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                                    />
                                    <Avatar src={u.avatar_url || u.avatar} name={u.full_name} size={28} />
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text)' }}>{u.full_name}</span>
                                      <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{getRoleDisplayName(u)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Display sub-tasks for this member */}
                                <div style={{ borderTop: '1px dashed var(--color-border-light)', paddingTop: '6px', marginTop: '4px' }}>
                                  {subtasks.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '38px' }}>
                                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {t('Nhiệm vụ được giao')} ({subtasks.length}):
                                      </span>
                                      {subtasks.map((st: any) => (
                                        <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem' }}>
                                          <input 
                                            type="checkbox" 
                                            checked={!!st.done} 
                                            readOnly
                                            style={{ width: 12, height: 12, accentColor: 'var(--color-success)', cursor: 'default' }} 
                                          />
                                          <span style={{ textDecoration: st.done ? 'line-through' : 'none', color: st.done ? 'var(--color-text-muted)' : 'var(--color-text-light)' }}>
                                            {st.title}
                                          </span>
                                          {st.due_date && (
                                            <span style={{
                                              fontSize: '0.68rem',
                                              color: 'var(--color-text-muted)',
                                              background: 'var(--color-bg-subtle, rgba(0,0,0,0.02))',
                                              padding: '1px 6px',
                                              borderRadius: '4px',
                                              border: '1px solid var(--color-border-light)',
                                              marginLeft: '6px'
                                            }}>
                                              {t('Hạn')}: {new Date(st.due_date).toLocaleDateString('vi-VN')}
                                            </span>
                                          )}
                                          {st.priority && st.priority !== 'medium' && (
                                            <span style={{
                                              fontSize: '0.55rem',
                                              fontWeight: 800,
                                              padding: '1px 4px',
                                              borderRadius: '3px',
                                              background: st.priority === 'high' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                                              color: st.priority === 'high' ? 'var(--color-danger)' : 'var(--color-info)',
                                              textTransform: 'uppercase',
                                              marginLeft: '6px'
                                            }}>
                                              {st.priority === 'high' ? t('Cao') : t('Thấp')}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginLeft: '38px', fontStyle: 'italic' }}>
                                      {t('Chưa giao việc con nào')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Add Member Button / Section */}
                      <div style={{ marginTop: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '16px' }}>
                        {!showAddParticipantsSection ? (
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => setShowAddParticipantsSection(true)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 24px',
                                background: 'var(--color-primary-light, rgba(163,20,34,0.05))',
                                color: 'var(--color-primary, #a31422)',
                                border: '1px dashed var(--color-primary, #a31422)',
                                borderRadius: '24px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              className="hover-lift"
                            >
                              <UserPlus size={15} />
                              {t('Thêm thành viên')}
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {t('Thành viên chưa liên quan')} ({nonRelatedUsers.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowAddParticipantsSection(false)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-primary)',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                {t('Thu gọn')}
                              </button>
                            </div>

                            {nonRelatedUsers.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                {t('Tất cả nhân sự đều đã được thêm làm người liên quan')}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                                {nonRelatedUsers.map((u: any) => (
                                  <div
                                    key={u.id}
                                    style={{
                                      background: 'transparent',
                                      border: '1px solid rgba(0,0,0,0.03)',
                                      borderRadius: '12px',
                                      padding: '8px 12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      transition: 'all 0.15s ease'
                                    }}
                                    className="hover-bg-alt"
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <input
                                        type="checkbox"
                                        checked={false}
                                        onChange={() => handleToggleParticipant(u.id)}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                                      />
                                      <Avatar src={u.avatar_url || u.avatar} name={u.full_name} size={28} />
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text)' }}>{u.full_name}</span>
                                        <span style={{ fontSize: '0.66rem', color: 'var(--color-text-muted)' }}>{getRoleDisplayName(u)}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', background: 'var(--color-surface)' }}>
                <button className="btn outline" onClick={() => { setShowParticipantsModal(false); setShowAddParticipantsSection(false); }} style={{ borderRadius: '20px', padding: '6px 20px' }}>
                  {t('Đóng')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUBTASK PARTICIPANTS MODAL */}
        {selectedSubtaskForParticipants && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              zIndex: 1000300,
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fade-in 0.2s ease-out'
            }}
            onClick={() => setSelectedSubtaskForParticipants(null)}
          >
            <div 
              style={{
                width: '450px',
                maxWidth: '90vw',
                background: 'var(--color-surface)',
                borderRadius: '16px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                animation: 'scale-up 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                    {t('Người thực hiện công việc con')}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '340px' }}>
                    {selectedSubtaskForParticipants.title}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedSubtaskForParticipants(null)}
                  style={{ border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* List of Users */}
              <div style={{ padding: '1.25rem 1.5rem', maxHeight: '400px', overflowY: 'auto' }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(() => {
                    const assigneeIds = selectedSubtaskForParticipants.assignee_id ? selectedSubtaskForParticipants.assignee_id.split(',').filter(Boolean) : [];
                    const subtaskUsers = assigneeIds.map((id: string) => users.find((u: any) => String(u.id) === String(id))).filter(Boolean);

                    if (subtaskUsers.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                          {t('Chưa phân công ai')}
                        </div>
                      );
                    }

                    return subtaskUsers.map((u: any) => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.01))', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                        <Avatar src={u.avatar_url || u.avatar} name={u.full_name} size={32} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--color-text)' }}>{u.full_name}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{getRoleDisplayName(u)}</span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', background: 'var(--color-surface)' }}>
                <button className="btn outline" onClick={() => setSelectedSubtaskForParticipants(null)} style={{ borderRadius: '20px', padding: '6px 20px', fontSize: '0.8rem' }}>
                  {t('Đóng')}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
  );

  if (embedMode) {
    return isOpen && task ? content : null;
  }

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && task && (
          <>
            <motion.div 
              className="drawer-backdrop" 
              onClick={handleCloseDrawer}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                zIndex: zIndex ? zIndex - 100 : 1000100,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)'
              }}
            />
            {content}
          </>
        )}
      </AnimatePresence>

          {/* Validation Warning Modal */}
          <AnimatePresence>
            {showValidationModal && (
              <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000400 }} onClick={() => setShowValidationModal(false)}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  onClick={e => e.stopPropagation()}
                  style={{ 
                    background: 'var(--color-surface)', 
                    width: '90%', 
                    maxWidth: '420px', 
                    borderRadius: 'var(--radius-xl)', 
                    padding: '2rem', 
                    boxShadow: 'var(--shadow-2xl)', 
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '1rem'
                  }}
                >
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: 'var(--color-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <AlertCircle size={28} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                    {t('Thiếu thông tin người phê duyệt')}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.45 }}>
                    {t('Bạn đã kích hoạt chức năng "Yêu cầu phê duyệt" cho công việc này, nhưng chưa phân công Người phê duyệt. Vui lòng chọn người phê duyệt trước khi lưu hoặc đóng cửa sổ.')}
                  </p>
                  <button 
                    className="btn primary" 
                    onClick={() => setShowValidationModal(false)}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', fontWeight: 700 }}
                  >
                    {t('Đã hiểu, quay lại chọn')}
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Approval Success Modal */}
          <AnimatePresence>
            {showApprovalSuccessModal && (
              <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000400 }} onClick={() => setShowApprovalSuccessModal(null)}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  onClick={e => e.stopPropagation()}
                  style={{ 
                    background: 'var(--color-surface)', 
                    width: '90%', 
                    maxWidth: '440px', 
                    borderRadius: 'var(--radius-xl)', 
                    padding: '2rem', 
                    boxShadow: 'var(--shadow-2xl)', 
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '1.25rem'
                  }}
                >
                  <div style={{
                    width: '58px',
                    height: '58px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.08)',
                    color: 'var(--color-success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckSquare2 size={30} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
                      {t('Đã gửi yêu cầu phê duyệt!')}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 700, margin: 0 }}>
                      {t('Tiến độ đạt 100%')}
                    </p>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                    {t('Hệ thống đã gửi thông báo khẩn cấp và email xác nhận đến Người phê duyệt:')}
                    <br />
                    <strong style={{ color: 'var(--color-text)', display: 'inline-block', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                      {showApprovalSuccessModal}
                    </strong>
                    <br />
                    {t('Trạng thái công việc được chuyển sang "Đang chờ duyệt". Bạn sẽ nhận được thông báo ngay khi có kết quả phê duyệt.')}
                  </p>
                  <button 
                    className="btn primary" 
                    onClick={() => setShowApprovalSuccessModal(null)}
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', fontWeight: 700 }}
                  >
                    {t('Đóng')}
                  </button>
                </motion.div>
              </div>
            )}

            {/* Meeting Proof Modal */}
            {meetingToComplete && (
              <div 
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 1000500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem'
                }}
                onClick={() => setMeetingToComplete(null)}
              >
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  onClick={e => e.stopPropagation()}
                  style={{ 
                    width: '100%', 
                    maxWidth: 500, 
                    padding: '1.5rem', 
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    background: 'var(--color-surface)', 
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <Camera style={{ color: '#10b981' }} size={20} />
                      Cung cấp ảnh minh chứng
                    </h3>
                    <button className="btn-icon sm ghost" style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setMeetingToComplete(null)}><X size={16} /></button>
                  </div>

                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5, margin: 0 }}>
                    Gặp gỡ này chưa có ảnh đính kèm trong phần bình luận. Bạn phải tải lên ảnh minh chứng (chụp ảnh cùng khách hàng, sa bàn, v.v.) để hoàn thành cuộc gặp.
                  </p>

                  <div style={{ marginBottom: '1.25rem', marginTop: '1rem' }}>
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
                        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '120px', border: '2px dashed var(--color-border)', borderRadius: '10px', cursor: 'pointer', background: 'var(--color-bg)', transition: 'border-color 0.2s' }}>
                          <Camera size={28} style={{ color: 'var(--color-text-muted)', marginBottom: '6px' }} />
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Tải ảnh lên (JPEG, PNG, WebP)</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 5 * 1024 * 1024) {
                                toast.error('Dung lượng tệp đính kèm không được vượt quá 5MB');
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
                      style={{ width: '100%', minHeight: '80px', fontSize: '0.875rem', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '8px', outline: 'none', resize: 'none', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                      value={proofCommentText}
                      onChange={(e) => setProofCommentText(e.target.value)}
                      placeholder="Nhập ghi chú hoặc mô tả về buổi gặp gỡ..."
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
                          try {
                            const { compressToWebP } = await import('../utils/imageCompress');
                            fileToUpload = await compressToWebP(proofImageFile);
                          } catch (err) {}
                          
                          const fd = new FormData();
                          fd.append('file', fileToUpload);
                          const uploadRes = await api.post('/upload', fd, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                          });
                          const uploadedUrl = uploadRes.data.data?.url ?? uploadRes.data.url ?? '';
                          if (!uploadedUrl) throw new Error('Không thể tải ảnh lên');

                          // Post comment
                          const payload = {
                            content: proofCommentText,
                            attachments: [uploadedUrl],
                            parent_id: null
                          };
                          await api.post(`/activities/${meetingToComplete.id}/comments`, payload);

                          // Complete activity
                          await api.put(`/activities/${meetingToComplete.id}`, { status: 'done', progress: 100 });

                          toast.success(t('Đã tải ảnh minh chứng và hoàn thành gặp gỡ'));
                          setFormData((prev: any) => ({ ...prev, status: 'done', progress: 100 }));
                          onUpdate();
                          setMeetingToComplete(null);
                        } catch (e: any) {
                          toast.error(e.response?.data?.message || 'Có lỗi xảy ra khi lưu minh chứng');
                        } finally {
                          setCompletingMeeting(false);
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-success)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
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

            {/* Meeting Cancellation Modal */}
            {cancellingMeeting && (
              <div 
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 1000500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem'
                }}
                onClick={() => setCancellingMeeting(null)}
              >
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  onClick={e => e.stopPropagation()}
                  style={{ 
                    width: '100%', 
                    maxWidth: 450, 
                    padding: '1.5rem', 
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    background: 'var(--color-surface)', 
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <XCircle style={{ color: 'var(--color-danger)' }} size={20} />
                      Nhập lý do hủy lịch
                    </h3>
                    <button className="btn-icon sm ghost" style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setCancellingMeeting(null)}><X size={16} /></button>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Lý do hủy *</label>
                    <textarea
                      style={{ width: '100%', minHeight: '100px', fontSize: '0.875rem', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '8px', outline: 'none', resize: 'none', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Vui lòng nhập lý do hủy cuộc hẹn..."
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button className="btn outline" onClick={() => setCancellingMeeting(null)} disabled={savingCancel}>Hủy</button>
                    <button 
                      className="btn danger" 
                      disabled={!cancelReason.trim() || savingCancel} 
                      onClick={async () => {
                        const reason = cancelReason.trim();
                        if (!reason) return;
                        setSavingCancel(true);
                        try {
                          await api.put(`/activities/${cancellingMeeting.id}`, { status: 'cancelled', progress: 0 });
                          await api.post(`/activities/${cancellingMeeting.id}/comments`, {
                            content: `Hủy lịch gặp gỡ với lý do: ${reason}`
                          });
                          toast.success(t('Đã hủy lịch hẹn thành công'));
                          setFormData((prev: any) => ({ ...prev, status: 'cancelled', progress: 0 }));
                          onUpdate();
                          setCancellingMeeting(null);
                        } catch (e: any) {
                          toast.error('Lỗi khi hủy gặp gỡ');
                        } finally {
                          setSavingCancel(false);
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-danger)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {savingCancel ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Đang xử lý...
                        </>
                      ) : (
                        <>
                          <XCircle size={14} />
                          Xác nhận hủy
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Mute Confirmation Modal */}
            {showMuteConfirmModal && (
              <div 
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 1000500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem'
                }}
                onClick={() => setShowMuteConfirmModal(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    maxWidth: '420px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(189, 29, 45, 0.1)',
                      color: '#BD1D2D',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <BellOff size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {t('Tắt thông báo cho công việc này?')}
                      </h3>
                      <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                        {t('Bạn sẽ không còn nhận bất kỳ thông báo nào (bình luận mới, nhắc tên, cập nhật trạng thái...) về công việc này nữa.')}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowMuteConfirmModal(false)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        background: 'transparent',
                        color: 'var(--color-text)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {t('Quay lại')}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmMute}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#BD1D2D',
                        color: 'white',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {t('Xác nhận tắt')}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Confirm Subtask Deletion Modal */}
          <ConfirmModal
            isOpen={Boolean(deleteSubtaskTarget)}
            onClose={() => setDeleteSubtaskTarget(null)}
            onConfirm={() => {
              if (deleteSubtaskTarget) {
                handleDeleteChecklistItem(deleteSubtaskTarget.id);
                setDeleteSubtaskTarget(null);
              }
            }}
            title={t('Xác nhận xóa việc con')}
            message={t(`Bạn có chắc chắn muốn xóa việc con "${deleteSubtaskTarget?.title || ''}" không? Hành động này không thể hoàn tác.`)}
            confirmText={t('Xóa việc con')}
            cancelText={t('Quay lại')}
            confirmType="danger"
          />

          {/* Confirm Comment Deletion Modal */}
          <ConfirmModal
            isOpen={commentToDelete !== null}
            onClose={() => setCommentToDelete(null)}
            onConfirm={async () => {
              if (commentToDelete !== null) {
                await handleDeleteComment(commentToDelete);
                setCommentToDelete(null);
              }
            }}
            title={t('Xác nhận xóa bình luận')}
            message={t('Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác.')}
            confirmText={t('Xóa')}
            cancelText={t('Hủy')}
            confirmType="danger"
          />

          {/* Confirm Hide Task Modal */}
          <ConfirmModal
            isOpen={showHideConfirmModal}
            onClose={() => setShowHideConfirmModal(false)}
            onConfirm={() => {
              setShowHideConfirmModal(false);
              executeToggleHide();
            }}
            title={t('Ẩn công việc khỏi bàn làm việc?')}
            confirmText={t('Xác nhận ẩn')}
            cancelText={t('Hủy')}
            confirmType="danger"
            width={480}
          >
            <div style={{ textAlign: 'left', lineHeight: '1.6', fontSize: '0.85rem', color: 'var(--color-text)' }}>
              <p style={{ marginBottom: '12px' }}>{t('Bạn có chắc chắn muốn ẩn công việc này khỏi Bàn làm việc của mình không?')}</p>
              <p style={{ fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                {t('Công việc này sẽ tự động hiển thị trở lại khi:')}
              </p>
              <ul style={{ listStyleType: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--color-text-muted)' }}>
                <li>{t('Bạn được phân công làm Người thực hiện chính mới.')}</li>
                <li>{t('Bạn được thêm vào danh sách Người liên quan (Người tham gia).')}</li>
                <li>{t('Ai đó nhắc tên (mention) bạn bằng cú pháp @tên hoặc tag trực tiếp bạn trong phần mô tả/checklist.')}</li>
                <li>{t('Ai đó nhắc tên (mention) bạn hoặc trả lời bình luận của bạn trong phần Thảo luận.')}</li>
              </ul>
            </div>
          </ConfirmModal>
    </>,
    document.body
  );
};
