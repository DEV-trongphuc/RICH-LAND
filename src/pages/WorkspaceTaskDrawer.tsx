import React, { useState, useEffect } from 'react';
import { 
  X, CheckSquare, Check, Paperclip, Link2, MessageSquare, Calendar, User, Clock, 
  Settings, AlertCircle, Trash2, Plus, Send, Share2, FileText, Globe, 
  Users, RefreshCw, Layers, CheckSquare2, Info, Receipt, Scale, ArrowUpRight, Search, Save, Bell, BellOff,
  Eye, ExternalLink, UserPlus, UserCheck, Edit3, Play, Sparkles, ArrowRight, Building2, Megaphone, Loader2
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
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
}

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
  onNextFocusTask
}) => {
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
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentAttachments, setCommentAttachments] = useState<any[]>([]);
  const [replyTo, setReplyTo] = useState<{ id: number; userName: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  const [loadingMute, setLoadingMute] = useState(false);
  const [showMuteConfirmModal, setShowMuteConfirmModal] = useState(false);

  useEffect(() => {
    if (isOpen && task?.id) {
      setLoadingMute(true);
      api.get(`/activities/${task.id}/mute-status`)
        .then(res => {
          if (res.data && res.data.success) {
            setIsMuted(!!res.data.is_muted);
          }
        })
        .catch(err => console.error("Lỗi lấy trạng thái thông báo task:", err))
        .finally(() => setLoadingMute(false));
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

  // Checklist adding state
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubAssignee, setNewSubAssignee] = useState('');
  const [newSubDeadline, setNewSubDeadline] = useState('');
  const [newSubPriority, setNewSubPriority] = useState<string>('medium');

  // Checklist inline edit & assignee picker state
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistTitle, setEditingChecklistTitle] = useState<string>('');
  const [activeAssigneeDropdownId, setActiveAssigneeDropdownId] = useState<string | null>(null);
  const [deleteSubtaskTarget, setDeleteSubtaskTarget] = useState<{ id: string; title: string } | null>(null);

  const [allowedProjects, setAllowedProjects] = useState<any[]>([]);
  const [allowedCampaigns, setAllowedCampaigns] = useState<any[]>([]);
  const [allowedTeams, setAllowedTeams] = useState<any[]>([]);

  // Quick View Drawer states for Project & Campaign
  const [viewProjectModal, setViewProjectModal] = useState<any | null>(null);
  const [viewCampaignModal, setViewCampaignModal] = useState<any | null>(null);
  const [loadingViewProject, setLoadingViewProject] = useState(false);
  const [loadingViewCampaign, setLoadingViewCampaign] = useState(false);

  const openProjectDetail = async (projId: number) => {
    if (!projId) return;
    setLoadingViewProject(true);
    try {
      const res = await api.get(`/projects/${projId}`);
      setViewProjectModal(res.data.data || res.data);
    } catch {
      toast.error(t('Không thể tải chi tiết dự án'));
    } finally {
      setLoadingViewProject(false);
    }
  };

  const openCampaignDetail = async (campId: number) => {
    if (!campId) return;
    setLoadingViewCampaign(true);
    try {
      const res = await api.get(`/campaigns/${campId}`);
      setViewCampaignModal(res.data.data || res.data);
    } catch {
      toast.error(t('Không thể tải chi tiết chiến dịch'));
    } finally {
      setLoadingViewCampaign(false);
    }
  };

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

  useEffect(() => {
    if (comments.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const highlightCommentId = params.get('comment_id') || params.get('highlight_comment_id');
      if (highlightCommentId) {
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
      } else {
        setComments([]);
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
        toast.success(task.id === 'new' ? t('Tạo công việc thành công!') : t('Đã lưu tất cả thay đổi thành công!'));
        setOriginalHash(currentHash);
        onUpdate();
        
        if (isJustSubmittedForApproval && approverName) {
          toast.success(t('Đã gửi thông báo email thành công!'));
          setShowApprovalSuccessModal(approverName);
        }

        if (task.id === 'new') {
          onClose();
        }
      }
    } catch (e: any) {
      toast.error(t('Lỗi lưu thay đổi: ') + e.message);
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
      }
    } catch (e: any) {
      toast.error(t('Lỗi cập nhật: ') + e.message);
    }
  };

  // Checklist Actions
  const handleAddChecklistItem = () => {
    if (!newSubTitle.trim()) {
      toast.error(t('Vui lòng nhập tên công việc con'));
      return;
    }
    const newItem = {
      id: 'sub_' + Date.now(),
      title: newSubTitle.trim(),
      assignee_id: newSubAssignee ? Number(newSubAssignee) : null,
      due_date: newSubDeadline || null,
      priority: newSubPriority || 'medium',
      done: false
    };

    const newChecklist = [...(erpMeta.checklist || []), newItem];
    const updatedMeta = { ...erpMeta, checklist: newChecklist };
    handleSaveMeta(updatedMeta);

    if (newItem.assignee_id) {
      const current = getParticipantIds(formData.participant_ids);
      if (!current.includes(String(newItem.assignee_id))) {
        const next = [...current, String(newItem.assignee_id)];
        const nextString = next.join(',');
        setFormData((prev: any) => ({ ...prev, participant_ids: nextString }));
        handleUpdateField('participant_ids', nextString);
      }
    }

    // Reset input
    setNewSubTitle('');
    setNewSubAssignee('');
    setNewSubDeadline('');
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

  const handleUpdateChecklistItemAssignee = (itemId: string, newAssigneeId: string) => {
    const updatedChecklist = erpMeta.checklist.map((item: any) => {
      if (item.id === itemId) {
        return { ...item, assignee_id: newAssigneeId };
      }
      return item;
    });

    if (newAssigneeId) {
      const current = getParticipantIds(formData.participant_ids);
      if (!current.includes(String(newAssigneeId))) {
        const next = [...current, String(newAssigneeId)];
        const nextString = next.join(',');
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
  const handleCommentAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setCommentAttachments(prev => [...prev, { name: file.name, url: fileUrl }]);
        toast.success(t('Tải lên đính kèm thành công!'));
      } else {
        finishUpload(taskId, false, res.data?.message || t('Lỗi tải tệp lên'));
      }
    } catch (err: any) {
      finishUpload(taskId, false, err.message || t('Lỗi tải đính kèm'));
      toast.error(t('Lỗi tải đính kèm: ') + err.message);
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handlePostComment = async () => {
    if (!newCommentText.trim() && commentAttachments.length === 0) return;
    setIsSubmittingComment(true);

    try {
      const attachmentUrls = commentAttachments.map(a => a.url);
      const res = await api.post(`/activities/${task.id}/comments`, {
        content: newCommentText.trim(),
        attachments: attachmentUrls,
        parent_id: replyTo ? replyTo.id : null
      });

      if (res.data && res.data.success) {
        setNewCommentText('');
        setCommentAttachments([]);
        setReplyTo(null);
        loadComments(task.id);
        toast.success(t('Đã thêm bình luận!'));
      }
    } catch (e: any) {
      toast.error(t('Không thể gửi bình luận: ') + e.message);
    } finally {
      setIsSubmittingComment(false);
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
    const next = current.includes(String(userId))
      ? current.filter(id => id !== String(userId))
      : [...current, String(userId)];
    const nextString = next.join(',');
    setFormData((prev: any) => ({ ...prev, participant_ids: nextString }));
    handleUpdateField('participant_ids', nextString);
  };

  const [isVisible, setIsVisible] = useState(isOpen && !!task);
  const [animateIn, setAnimateIn] = useState(isOpen && !!task);

  useEffect(() => {
    if (isOpen && task) {
      setIsVisible(true);
      const timer = setTimeout(() => setAnimateIn(true), 10);
      return () => clearTimeout(timer);
    } else {
      setAnimateIn(false);
      const timer = setTimeout(() => setIsVisible(false), 420);
      return () => clearTimeout(timer);
    }
  }, [isOpen, task]);

  // Document body overflow handling
  useEffect(() => {
    if (isVisible && !embedMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible, embedMode]);

  if (!isVisible || !task) return null;

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
    return `${c.last_name || ''} ${c.first_name || ''}`.trim() || c.name || t('Khách hàng');
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

  const currentHash = (() => {
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
  })();

  const hasChanges = originalHash !== currentHash;

  const isApproverOrAdmin = currentUser && (
    Number(currentUser.id) === Number(formData.approver_id) ||
    ['admin', 'superadmin', 'super_admin', 'director', 'manager'].includes((currentUser.role || '').toLowerCase())
  );

  const content = (
    <div 
      className={`${embedMode ? '' : styles.drawer} ${embedMode ? 'focus-right-column' : ''}`}
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
        maxWidth: '100vw',
        zIndex: 10600,
        background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-border-light) 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
        transform: animateIn ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform'
      }}
    >
        {/* Drawer Header */}
        <div style={{
          padding: isMobileOrTablet ? '0.5rem 0.75rem' : (embedMode ? '0.75rem 1rem' : '1.25rem 1.5rem'),
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
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t("Chi tiết công việc")}</span>
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
                        {new Date(formData.created_at).toLocaleDateString('vi-VN')} {new Date(formData.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                  )}

                  {formData.due_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                      <Clock size={12} style={{ color: 'var(--color-danger, #ef4444)' }} />
                      <span>{t('Hạn hoàn thành:')}</span>
                      <strong style={{ color: 'var(--color-text)' }}>
                        {new Date(formData.due_date).toLocaleDateString('vi-VN')} {new Date(formData.due_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                  )}

                  {!!erpMeta.project_id && (
                    <button
                      type="button"
                      disabled={loadingViewProject}
                      onClick={() => openProjectDetail(erpMeta.project_id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-info)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer' }}
                      title={t('Mở Drawer xem chi tiết Dự án')}
                    >
                      {loadingViewProject ? <Loader2 size={12} className="spin" /> : <Building2 size={12} />}
                      <span>{allowedProjects.find(p => Number(p.id) === Number(erpMeta.project_id))?.name || t('Dự án')}</span>
                    </button>
                  )}
                  {!!erpMeta.campaign_id && (
                    <button
                      type="button"
                      disabled={loadingViewCampaign}
                      onClick={() => openCampaignDetail(erpMeta.campaign_id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-warning)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer' }}
                      title={t('Mở Drawer xem chi tiết Chiến dịch')}
                    >
                      {loadingViewCampaign ? <Loader2 size={12} className="spin" /> : <Megaphone size={12} />}
                      <span>{allowedCampaigns.find(c => Number(c.id) === Number(erpMeta.campaign_id))?.name || t('Chiến dịch')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
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

            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isMobileOrTablet ? '0' : '6px',
                padding: isMobileOrTablet ? '6px' : '8px 18px',
                width: isMobileOrTablet ? '36px' : undefined,
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                height: '36px',
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
        <div style={{ display: 'flex', flexDirection: isMobileOrTablet ? 'column' : 'row', flex: 1, overflowY: 'auto', padding: isMobileOrTablet ? '1rem 1rem 100px 1rem' : (embedMode ? '1rem 1rem 4.5rem 1rem' : '1.5rem 1.5rem 4.5rem 1.5rem'), gap: isMobileOrTablet ? '1rem' : (embedMode ? '1rem' : '1.5rem') }} className={`custom-scrollbar ${embedMode ? 'focus-right-column' : ''}`}>
          
          {/* Left Column (3/5) */}
          <div style={{ flex: isMobileOrTablet ? 'none' : 3, display: 'flex', flexDirection: 'column', gap: isMobileOrTablet ? '1rem' : (embedMode ? '1rem' : '1.5rem'), minWidth: 0 }}>
            
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
                style={{ fontSize: '0.85rem', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
              />
            </div>

            {/* Mô tả chi tiết */}
            <div className="card" style={cardStyle}>
              <label style={cardLabelStyle}>
                {t('Mô tả chi tiết')}
              </label>
              <textarea
                className="form-input"
                rows={4}
                value={erpMeta.description || ''}
                onChange={(e) => setErpMeta({ ...erpMeta, description: e.target.value })}
                onBlur={() => handleSaveMeta(erpMeta)}
                placeholder={t('Chưa có mô tả...')}
                style={{ fontSize: '0.85rem', padding: '10px 14px', minHeight: '120px', borderRadius: '8px', border: '1px solid var(--color-border)', resize: 'vertical' }}
              />
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
                        background: percent === 100 ? 'var(--color-success)' : 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-success) 100%)',
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
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '8px 12px', height: '38px', borderRadius: '8px', border: '1px solid var(--color-border)', width: '100%' }}
                      placeholder={t('Ví dụ: Gửi hợp đồng cho khách...')}
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
                    const itemUser = users.find(u => Number(u.id) === Number(item.assignee_id));
                    const isEditingThis = editingChecklistId === item.id;
                    const isAssigneeDropdownOpen = activeAssigneeDropdownId === item.id;

                    return (
                      <div 
                        key={item.id}
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
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          {/* Round & Large Custom Checkbox */}
                          <div style={{ position: 'relative', width: 22, height: 22, flexShrink: 0 }}>
                            <input
                              type="checkbox"
                              checked={!!item.done}
                              onChange={() => handleToggleChecklist(item.id)}
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={editingChecklistTitle}
                                  onChange={(e) => setEditingChecklistTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleUpdateChecklistItemTitle(item.id, editingChecklistTitle);
                                      setEditingChecklistId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingChecklistId(null);
                                    }
                                  }}
                                  autoFocus
                                  style={{ fontSize: '0.82rem', padding: '4px 8px', height: '32px', borderRadius: '6px', width: '100%' }}
                                />
                                <button
                                  type="button"
                                  className="btn primary sm"
                                  onClick={() => {
                                    handleUpdateChecklistItemTitle(item.id, editingChecklistTitle);
                                    setEditingChecklistId(null);
                                  }}
                                  style={{ padding: '4px 10px', height: '32px', fontSize: '0.75rem', flexShrink: 0 }}
                                >
                                  {t('Lưu')}
                                </button>
                                <button
                                  type="button"
                                  className="btn outline sm"
                                  onClick={() => setEditingChecklistId(null)}
                                  style={{ padding: '4px 8px', height: '32px', fontSize: '0.75rem', flexShrink: 0 }}
                                >
                                  ✕
                                </button>
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
                                    onClick={() => {
                                      setEditingChecklistId(item.id);
                                      setEditingChecklistTitle(item.title);
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
                                {t('Giao cho')}: <strong style={{ color: itemUser ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{itemUser ? (itemUser.full_name || itemUser.name) : t('Chưa phân công')}</strong>
                              </span>
                              {item.due_date && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                                  {` • Hạn: ${new Date(item.due_date).toLocaleDateString('vi-VN')}`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Actions (Round User Icon & Delete Trash Icon) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {/* Round User Assignee Icon Button */}
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => setActiveAssigneeDropdownId(isAssigneeDropdownOpen ? null : item.id)}
                              disabled={currentUser?.role === 'viewer'}
                              style={{
                                border: itemUser ? '1.5px solid var(--color-primary-light)' : '1px solid var(--color-border-light)',
                                background: itemUser ? 'transparent' : 'rgba(163, 20, 34, 0.06)',
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
                              title={itemUser ? `${t('Giao cho')}: ${itemUser.full_name || itemUser.name}` : t('Phân công người thực hiện')}
                            >
                              {itemUser ? (
                                <Avatar 
                                  src={itemUser.avatar || itemUser.avatar_url} 
                                  name={itemUser.full_name || itemUser.name} 
                                  size={26} 
                                />
                              ) : (
                                <UserPlus size={14} color="var(--color-primary)" />
                              )}
                            </button>

                            {/* User selection dropdown popup */}
                            {isAssigneeDropdownOpen && (
                              <div style={{
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
                              }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', padding: '4px 8px' }}>
                                  {t('Phân công người thực hiện:')}
                                </div>
                                
                                {/* Unassign option */}
                                <div
                                  onClick={() => {
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

                                {users.map((u: any) => (
                                  <div
                                    key={u.id}
                                    onClick={() => {
                                      handleUpdateChecklistItemAssignee(item.id, String(u.id));
                                      setActiveAssigneeDropdownId(null);
                                    }}
                                    style={{
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      background: String(u.id) === String(item.assignee_id) ? 'var(--color-primary-light)' : 'transparent',
                                      color: String(u.id) === String(item.assignee_id) ? 'var(--color-primary)' : 'var(--color-text)',
                                      fontWeight: String(u.id) === String(item.assignee_id) ? 700 : 500
                                    }}
                                    className="hover-bg-alt"
                                  >
                                    <Avatar src={u.avatar || u.avatar_url} name={u.full_name || u.name} size={18} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {u.full_name || u.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Delete Trash Can */}
                          {currentUser?.role !== 'viewer' && (
                            <button
                              type="button"
                              onClick={() => setDeleteSubtaskTarget({ id: item.id, title: item.title })}
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

            {/* Bình luận & Trao đổi */}
            {task?.id !== 'new' && (
              <div className="card" style={cardStyle}>
                <label style={cardLabelStyle}>
                  {t('Bình luận & Trao đổi')} ({comments.length})
                </label>

                {/* Add comment input */}
                <div style={{ background: 'rgba(0, 0, 0, 0.015)', border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.01)' }}>
                  {replyTo && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(163, 20, 34, 0.08)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', color: '#a31422', fontWeight: 700 }}>
                      <span>Đang trả lời {replyTo.userName}</span>
                      <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', color: '#a31422', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', padding: '0 4px' }}>×</button>
                    </div>
                  )}
                  <MentionInput
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    placeholder={t('Viết bình luận... (Gõ @ để nhắc tên đồng nghiệp)')}
                    style={{ minHeight: '55px' }}
                  />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', paddingTop: '10px', marginTop: '4px' }}>
                    {/* File attach trigger */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)' }} className="hover-lift">
                        <Paperclip size={12} color="var(--color-text-muted)" />
                        <span>{t('Đính kèm file')}</span>
                        <input type="file" onChange={handleCommentAttachmentUpload} style={{ display: 'none' }} />
                      </label>
                      {commentAttachments.map((att: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.625rem' }}>
                          <span style={{ maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                          <button onClick={() => setCommentAttachments(prev => prev.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.7rem' }}>×</button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handlePostComment}
                      disabled={isSubmittingComment}
                      className="btn primary sm"
                      style={{ padding: '5px 16px', fontSize: '0.75rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {isSubmittingComment ? <RefreshCw className="spin" size={12} /> : t('Gửi bình luận')}
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
                          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
                              background: isReply ? 'transparent' : 'rgba(0, 0, 0, 0.01)', 
                              border: isReply ? 'none' : '1px solid var(--color-border-light)', 
                              padding: isReply ? '4px 0 4px 12px' : '12px 16px', 
                              borderRadius: isReply ? '0' : '14px',
                              borderLeft: isReply ? '2px solid var(--color-border-light)' : undefined,
                              transition: 'all 0.5s ease',
                              marginTop: isReply ? '6px' : '0'
                            }}
                          >
                            <Avatar src={comment.avatar_url || commUser?.avatar || commUser?.avatar_url} name={commUser?.full_name || comment.user_name || 'Đồng nghiệp'} size={isReply ? 24 : 28} />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: isReply ? '0.75rem' : '0.8rem', fontWeight: 800, color: 'var(--color-text)' }}>{commUser?.full_name || comment.user_name || 'Đồng nghiệp'}</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{new Date(comment.created_at).toLocaleString('vi-VN')}</span>
                              </div>
                              <p style={{ fontSize: isReply ? '0.78rem' : '0.825rem', color: 'var(--color-text-light)', margin: '4px 0 0', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>{renderCommentContent(comment.content)}</p>
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
                              
                              {!isReply && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                  <button
                                    onClick={() => setReplyTo({ id: comment.id, userName: commUser?.full_name || comment.user_name || 'Đồng nghiệp' })}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.7rem', padding: 0, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}
                                    className="hover-lift"
                                  >
                                    Phản hồi
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      };

                      return rootComments.map((rootComment: any) => {
                        const replies = getReplies(rootComment.id);
                        return (
                          <div key={rootComment.id} style={{ display: 'flex', flexDirection: 'column' }}>
                            {renderSingleComment(rootComment, false)}
                            {replies.length > 0 && (
                              <div style={{ marginLeft: '32px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid var(--color-border-light)', paddingLeft: '8px', marginTop: '4px' }}>
                                {replies.map((reply: any) => renderSingleComment(reply, true))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            )}
            {/* Bottom Spacer to prevent content from being flush against the bottom */}
            <div style={{ height: '5rem', flexShrink: 0 }} />
          </div>

          {/* Right Column (2/5) */}
          <div style={{ flex: isMobileOrTablet ? 'none' : 2, display: 'flex', flexDirection: 'column', gap: isMobileOrTablet ? '1rem' : (embedMode ? '1rem' : '1.5rem'), minWidth: 0 }}>
            
            {/* Tiến độ công việc */}
            <div className="card" style={cardStyle}>
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
            </div>

            {/* Khách hàng liên quan */}
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
                      background: 'rgba(189, 29, 45, 0.04)',
                      border: '1px solid rgba(189, 29, 45, 0.1)',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      color: 'var(--color-primary)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Avatar name={formData.contact_name || t('Khách hàng')} size={26} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{formData.contact_name || t('Khách hàng')}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Nhấn để xem chi tiết')}</span>
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

            {/* Dự án & Chiến dịch liên quan */}
            <div className="card" style={cardStyle}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                {t('Liên kết Dự án / Chiến dịch / Team')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Dự án')}</span>
                    {!!erpMeta.project_id && (
                      <button 
                        type="button" 
                        disabled={loadingViewProject}
                        onClick={() => openProjectDetail(erpMeta.project_id)} 
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.725rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                        className="hover-opacity"
                      >
                        {loadingViewProject ? <Loader2 size={12} className="spin" /> : <Eye size={13} style={{ color: 'var(--color-text-muted)' }} />} {t('Xem')}
                      </button>
                    )}
                  </div>
                  <CustomSelect
                    searchable
                    options={[
                      { value: '', label: t('Chọn dự án...') },
                      ...allowedProjects.map(p => ({ value: String(p.id), label: p.name }))
                    ]}
                    value={erpMeta.project_id ? String(erpMeta.project_id) : ''}
                    onChange={val => {
                      const nextProject = val ? Number(val) : null;
                      let nextCampaign = erpMeta.campaign_id;
                      if (nextProject && nextCampaign) {
                        const campObj = allowedCampaigns.find(c => Number(c.id) === nextCampaign);
                        if (campObj && Number(campObj.project_id) !== nextProject) {
                          nextCampaign = null;
                        }
                      }
                      const nextMeta = { ...erpMeta, project_id: nextProject, campaign_id: nextCampaign };
                      setErpMeta(nextMeta);
                      handleSaveMeta(nextMeta);
                    }}
                    placeholder={t('Chọn dự án...')}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Chiến dịch')}</span>
                    {!!erpMeta.campaign_id && (
                      <button 
                        type="button" 
                        disabled={loadingViewCampaign}
                        onClick={() => openCampaignDetail(erpMeta.campaign_id)} 
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '0.725rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                        className="hover-opacity"
                        title={t('Xem chi tiết chiến dịch')}
                      >
                        {loadingViewCampaign ? <Loader2 size={12} className="spin" /> : <Eye size={13} style={{ color: 'var(--color-text-muted)' }} />} {t('Xem')}
                      </button>
                    )}
                  </div>
                  {(() => {
                    const filteredCamps = erpMeta.project_id
                      ? allowedCampaigns.filter(c => Number(c.project_id) === Number(erpMeta.project_id))
                      : allowedCampaigns;
                    return (
                      <CustomSelect
                        searchable
                        options={[
                          { value: '', label: t('Chọn chiến dịch...') },
                          ...filteredCamps.map(c => ({ value: String(c.id), label: c.name, faded: c.status !== 'active' }))
                        ]}
                        value={erpMeta.campaign_id ? String(erpMeta.campaign_id) : ''}
                        onChange={val => {
                          const nextCampaign = val ? Number(val) : null;
                          let nextProject = erpMeta.project_id;
                          if (nextCampaign) {
                            const campObj = allowedCampaigns.find(c => Number(c.id) === nextCampaign);
                            if (campObj && campObj.project_id) {
                              nextProject = Number(campObj.project_id);
                            }
                          }
                          const nextMeta = { ...erpMeta, campaign_id: nextCampaign, project_id: nextProject };
                          setErpMeta(nextMeta);
                          handleSaveMeta(nextMeta);
                        }}
                        placeholder={t('Chọn chiến dịch...')}
                      />
                    );
                  })()}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Nhóm / Team')}</span>
                  <CustomSelect
                    searchable
                    showAvatars
                    options={[
                      { value: '', label: t('Chọn nhóm...') },
                      ...allowedTeams.map(t => ({ value: String(t.id), label: t.name }))
                    ]}
                    value={erpMeta.team_id ? String(erpMeta.team_id) : ''}
                    onChange={val => {
                      const nextTeam = val ? Number(val) : null;
                      const nextMeta = { ...erpMeta, team_id: nextTeam };
                      setErpMeta(nextMeta);
                      handleSaveMeta(nextMeta);
                    }}
                    placeholder={t('Chọn nhóm...')}
                  />
                </div>
              </div>
            </div>

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
                      onClick={async () => {
                        try {
                          const res = await api.put(`/activities/${task.id}`, { approval_status: 'approved', status: 'done' });
                          if (res.data && res.data.success) {
                            setFormData((prev: any) => ({ ...prev, approval_status: 'approved', status: 'done' }));
                            toast.success(t('Đã phê duyệt hoàn thành công việc!'));
                            onUpdate();
                          }
                        } catch (e: any) {
                          toast.error(t('Lỗi phê duyệt: ') + e.message);
                        }
                      }}
                      style={{ height: '28px', fontSize: '0.72rem', fontWeight: 700, padding: '0 10px', background: 'var(--color-success)', borderColor: 'var(--color-success)', color: 'white' }}
                    >
                      {t('Phê duyệt')}
                    </button>
                    <button
                      className="btn outline"
                      onClick={async () => {
                        try {
                          const res = await api.put(`/activities/${task.id}`, { approval_status: 'rejected', progress: 90 });
                          if (res.data && res.data.success) {
                            setFormData((prev: any) => ({ ...prev, approval_status: 'rejected', progress: 90 }));
                            toast.success(t('Đã từ chối phê duyệt hoàn thành.'));
                            onUpdate();
                          }
                        } catch (e: any) {
                          toast.error(t('Lỗi từ chối: ') + e.message);
                        }
                      }}
                      style={{ height: '28px', fontSize: '0.72rem', fontWeight: 700, padding: '0 10px', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                    >
                      {t('Từ chối')}
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
                      label: `${u.full_name} (${u.role})`,
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

            {/* Người thực hiện */}
            <div className="card" style={cardStyle}>
              <label style={cardLabelStyle}>
                {t('Người thực hiện')}
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

            {/* Người liên quan */}
            <div className="card" style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={cardLabelStyle}>
                  {t('Người liên quan')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowParticipantsModal(true)}
                  className="btn outline sm hover-lift"
                  style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Users size={12} />
                  {t('Quản lý')}
                </button>
              </div>

              {/* Avatar Stack */}
              <div 
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '4px 0' }}
                onClick={() => setShowParticipantsModal(true)}
              >
                {participants.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    {t('Chưa có người liên quan.')}
                  </span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {participants.slice(0, 3).map((u: any, idx: number) => (
                        <div 
                          key={u.id} 
                          style={{ 
                            marginLeft: idx === 0 ? 0 : -8, 
                            border: '2px solid var(--color-surface)', 
                            borderRadius: '50%',
                            overflow: 'hidden',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            zIndex: 10 - idx
                          }}
                        >
                          <Avatar src={u.avatar_url || u.avatar} name={u.full_name} size={28} />
                        </div>
                      ))}
                      {participants.length > 3 && (
                        <div 
                          style={{ 
                            marginLeft: -8, 
                            width: 28, 
                            height: 28, 
                            borderRadius: '50%', 
                            background: 'var(--color-border-light)', 
                            color: 'var(--color-text)', 
                            fontSize: '0.7rem', 
                            fontWeight: 800, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            border: '2px solid var(--color-surface)',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            zIndex: 5
                          }}
                        >
                          +{participants.length - 3}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', marginLeft: '8px' }}>
                      ({participants.length} {t('người')})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Lặp lại định kỳ */}
            <div className="card" style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={cardLabelStyle}>🔄 {t('Lặp lại định kỳ')}</span>
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
                {(formData.tags || '').split(',').filter(Boolean).map((tag: string, tIdx: number) => (
                  <span key={tIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(107, 114, 128, 0.08)', color: 'var(--color-text-light)', fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                    <span>{tag}</span>
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
                ))}
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
              zIndex: 10700,
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fade-in 0.2s ease-out'
            }}
            onClick={() => setShowParticipantsModal(false)}
          >
            <div 
              style={{
                width: '600px',
                maxWidth: '90vw',
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
                  onClick={() => setShowParticipantsModal(false)}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredUsersForParticipants.map((u: any) => {
                    const isParticipant = participantIds.includes(Number(u.id));
                    const subtasks = (erpMeta.checklist || []).filter((item: any) => Number(item.assignee_id) === Number(u.id));

                    return (
                      <div 
                        key={u.id}
                        style={{
                          background: isParticipant ? 'rgba(189,29,45,0.02)' : 'transparent',
                          border: `1px solid ${isParticipant ? 'var(--color-border-light)' : 'rgba(0,0,0,0.03)'}`,
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
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{u.role}</span>
                            </div>
                          </div>
                        </div>

                        {/* Display sub-tasks for this member */}
                        {isParticipant && (
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
                                    <span style={{
                                      fontSize: '0.55rem',
                                      fontWeight: 800,
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      background: st.priority === 'high' ? 'rgba(239, 68, 68, 0.08)' : st.priority === 'low' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                      color: st.priority === 'high' ? 'var(--color-danger)' : st.priority === 'low' ? 'var(--color-info)' : 'var(--color-warning)',
                                      textTransform: 'uppercase'
                                    }}>
                                      {st.priority === 'high' ? t('Cao') : st.priority === 'low' ? t('Thấp') : t('Trung bình')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginLeft: '38px', fontStyle: 'italic' }}>
                                {t('Chưa giao việc con nào')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', background: 'var(--color-surface)' }}>
                <button className="btn outline" onClick={() => setShowParticipantsModal(false)} style={{ borderRadius: '20px', padding: '6px 20px' }}>
                  {t('Đóng')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (embedMode) {
    return content;
  }

  return createPortal(
    <>
      <div 
        className="drawer-backdrop" 
        onClick={handleCloseDrawer}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          zIndex: 10500,
          backdropFilter: 'blur(4px)',
          opacity: animateIn ? 1 : 0,
          transition: 'opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: animateIn ? 'auto' : 'none'
        }}
      />
      {content}

          {/* Validation Warning Modal */}
          <AnimatePresence>
            {showValidationModal && (
              <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }} onClick={() => setShowValidationModal(false)}>
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
              <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000 }} onClick={() => setShowApprovalSuccessModal(null)}>
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

            {/* Mute Confirmation Modal */}
            {showMuteConfirmModal && (
              <div 
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 100000,
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

          {/* Quick View Project Drawer */}
          {viewProjectModal && createPortal(
            <div className="modal-overlay" onClick={() => setViewProjectModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 2000020, backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.65)', display: 'flex', justifyContent: 'flex-end' }}>
              <motion.div 
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                style={{ width: '600px', maxWidth: '90vw', height: '100%', background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', boxShadow: '-10px 0 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-info)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>{viewProjectModal.name}</h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>Mã dự án: {viewProjectModal.code || '—'} {viewProjectModal.developer ? `• CĐT: ${viewProjectModal.developer}` : ''}</p>
                    </div>
                  </div>
                  <button type="button" className="btn-icon" onClick={() => setViewProjectModal(null)} style={{ borderRadius: '8px' }}><X size={18} /></button>
                </div>

                <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                    <div style={{ padding: '0.875rem', borderRadius: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>TRẠNG THÁI</span>
                      <p style={{ fontSize: '0.875rem', fontWeight: 800, margin: '2px 0 0 0', color: viewProjectModal.status === 'active' ? 'var(--color-success)' : 'var(--color-text)' }}>
                        {viewProjectModal.status === 'active' ? 'Hoạt động' : (viewProjectModal.status || 'Chờ triển khai')}
                      </p>
                    </div>
                    <div style={{ padding: '0.875rem', borderRadius: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>ĐỊA ĐIỂM</span>
                      <p style={{ fontSize: '0.875rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {viewProjectModal.location || 'Chưa cập nhật'}
                      </p>
                    </div>
                    <div style={{ padding: '0.875rem', borderRadius: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>QUY MÔ</span>
                      <p style={{ fontSize: '0.875rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--color-text)' }}>
                        {viewProjectModal.scale_unit_count ? `${viewProjectModal.scale_unit_count} căn` : 'Chưa rõ'} {viewProjectModal.scale_block_count ? `(${viewProjectModal.scale_block_count} block)` : ''}
                      </p>
                    </div>
                    <div style={{ padding: '0.875rem', borderRadius: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>PHÁP LÝ / TIẾN ĐỘ</span>
                      <p style={{ fontSize: '0.875rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--color-text)' }}>
                        {viewProjectModal.legal_status || 'Chưa rõ'} {viewProjectModal.progress_percent ? `(${viewProjectModal.progress_percent}%)` : ''}
                      </p>
                    </div>
                  </div>

                  {viewProjectModal.description && (
                    <div style={{ padding: '1rem', borderRadius: '14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: 0 }}>Mô tả dự án</h4>
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.5, margin: '6px 0 0 0', whiteSpace: 'pre-line' }}>{viewProjectModal.description}</p>
                    </div>
                  )}

                  {viewProjectModal.roster && viewProjectModal.roster.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Nhân sự phụ trách ({viewProjectModal.roster.length})</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {viewProjectModal.roster.map((m: any) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', borderRadius: '10px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Avatar name={m.full_name || m.name} src={m.avatar_url} size={32} />
                              <div>
                                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)', margin: 0 }}>{m.full_name || m.name}</p>
                                <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: 0 }}>{m.email || m.role || 'Thành viên'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>,
            document.body
          )}

          {/* Quick View Campaign Drawer */}
          {viewCampaignModal && createPortal(
            <div className="modal-overlay" onClick={() => setViewCampaignModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 2000020, backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.65)', display: 'flex', justifyContent: 'flex-end' }}>
              <motion.div 
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                style={{ width: '600px', maxWidth: '90vw', height: '100%', background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)', boxShadow: '-10px 0 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Megaphone size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>{viewCampaignModal.name}</h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>Mã chiến dịch: {viewCampaignModal.code || '—'} {viewCampaignModal.project_name ? `• Dự án: ${viewCampaignModal.project_name}` : ''}</p>
                    </div>
                  </div>
                  <button type="button" className="btn-icon" onClick={() => setViewCampaignModal(null)} style={{ borderRadius: '8px' }}><X size={18} /></button>
                </div>

                <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                    <div style={{ padding: '0.875rem', borderRadius: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>TRẠNG THÁI</span>
                      <p style={{ fontSize: '0.875rem', fontWeight: 800, margin: '2px 0 0 0', color: viewCampaignModal.status === 'active' ? 'var(--color-success)' : 'var(--color-text)' }}>
                        {viewCampaignModal.status === 'active' ? 'Đang diễn ra' : (viewCampaignModal.status || 'Tạm dừng')}
                      </p>
                    </div>
                    <div style={{ padding: '0.875rem', borderRadius: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>NGÂN SÁCH</span>
                      <p style={{ fontSize: '0.875rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--color-primary)' }}>
                        {viewCampaignModal.budget ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(viewCampaignModal.budget) : 'Chưa lập'}
                      </p>
                    </div>
                    <div style={{ padding: '0.875rem', borderRadius: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>MỤC TIÊU CHIẾN DỊCH</span>
                      <p style={{ fontSize: '0.875rem', fontWeight: 800, margin: '2px 0 0 0', color: 'var(--color-text)' }}>
                        {viewCampaignModal.target || viewCampaignModal.description || 'Chưa có thông tin mục tiêu'}
                      </p>
                    </div>
                  </div>

                  {viewCampaignModal.description && (
                    <div style={{ padding: '1rem', borderRadius: '14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: 0 }}>Chi tiết chiến dịch</h4>
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.5, margin: '6px 0 0 0', whiteSpace: 'pre-line' }}>{viewCampaignModal.description}</p>
                    </div>
                  )}

                  {viewCampaignModal.roster && viewCampaignModal.roster.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Nhân sự tham gia chiến dịch ({viewCampaignModal.roster.length})</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {viewCampaignModal.roster.map((m: any) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', borderRadius: '10px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Avatar name={m.full_name || m.name} src={m.avatar_url} size={32} />
                              <div>
                                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text)', margin: 0 }}>{m.full_name || m.name}</p>
                                <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', margin: 0 }}>{m.email || m.role || 'Thành viên'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>,
            document.body
          )}
    </>,
    document.body
  );
};
