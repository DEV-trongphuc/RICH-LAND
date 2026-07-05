import React, { useState, useEffect } from 'react';
import { 
  X, CheckSquare, Paperclip, Link2, MessageSquare, Calendar, User, Clock, 
  Settings, AlertCircle, Trash2, Plus, Send, Share2, FileText, Globe, 
  Users, RefreshCw, Layers, CheckSquare2, Info, Receipt, Scale, ArrowUpRight, Search
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { CustomSelect } from '../components/ui/CustomSelect';
import { MentionInput } from '../components/ui/MentionInput';
import { Avatar } from '../components/ui/Avatar';
import styles from './EntityDrawer.module.css';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkspaceTaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  onUpdate: () => void;
  users: any[];
  onOpenContact?: (contactId: number) => void;
  embedMode?: boolean;
}

export const WorkspaceTaskDrawer: React.FC<WorkspaceTaskDrawerProps> = ({ 
  isOpen, 
  onClose, 
  task, 
  onUpdate, 
  users,
  onOpenContact,
  embedMode = false
}) => {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
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
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Checklist adding state
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubAssignee, setNewSubAssignee] = useState('');
  const [newSubDeadline, setNewSubDeadline] = useState('');
  const [newSubPriority, setNewSubPriority] = useState<string>('medium');

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
      api.get('/contacts?limit=200').then(res => {
        if (res.data && res.data.success) {
          setContacts(res.data.data.items || res.data.data || []);
        }
      }).catch(err => {
        console.error("Lỗi tải danh sách khách hàng:", err);
      }).finally(() => {
        setLoadingContacts(false);
      });
    }
  }, [isOpen]);

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
      const normalizedTask = {
        ...task,
        subject: task.subject || task.title || '',
        body: task.body || task.description || ''
      };
      setFormData(normalizedTask);
      setIsPinned(normalizedTask.tags?.includes('pinned') || false);

      // Parse erp metadata from task body
      let parsedMeta: any = {
        description: normalizedTask.body || '',
        internal_type: 'task',
        scope: 'team',
        recurrence: { pattern: 'none', weekly_days: [], monthly_day: 1, last_generated: '' },
        checklist: [],
        links: []
      };

      if (normalizedTask.body && normalizedTask.body.trim().startsWith('{"erp_task":')) {
        try {
          const parsed = JSON.parse(normalizedTask.body);
          parsedMeta = { ...parsedMeta, ...parsed.erp_task };
        } catch (e) {
          parsedMeta.description = normalizedTask.body;
        }
      }

      setErpMeta(parsedMeta);
      setCampaignTarget(parsedMeta.campaign_target || '');
      loadComments(normalizedTask.id);

      // Compute and store original hash
      const cleanObj = (obj: any) => {
        const clean: any = {};
        Object.keys(obj || {}).forEach(key => {
          if (['created_at', 'updated_at', 'deleted_at', 'created_by_name', 'contact_name', 'contact_avatar', 'user_name'].includes(key)) {
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

  const handleSaveMeta = async (updatedMeta: any) => {
    if (!task) return;
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

      const payload: any = {
        body: bodyPayload,
        tags: finalTags,
        progress: formData.progress,
        priority: formData.priority,
        status: formData.status,
        due_date: formData.due_date,
        subject: formData.subject,
        user_id: formData.user_id
      };

      const res = await api.put(`/activities/${task.id}`, payload);
      if (res.data && res.data.success) {
        setErpMeta(updatedMeta);
        
        const cleanObj = (obj: any) => {
          const clean: any = {};
          Object.keys(obj || {}).forEach(key => {
            if (['created_at', 'updated_at', 'deleted_at', 'created_by_name', 'contact_name', 'contact_avatar', 'user_name'].includes(key)) {
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
        formData.progress === 100 &&
        formData.require_approval === 1 &&
        formData.approver_id &&
        formData.approval_status === 'pending' &&
        (task.progress !== 100 || task.approval_status !== 'pending');

      const approverName = isJustSubmittedForApproval
        ? users.find(u => Number(u.id) === Number(formData.approver_id))?.full_name || 'Người duyệt'
        : null;

      const bodyPayload = JSON.stringify({ erp_task: erpMeta });
      let finalTags = formData.tags || '';

      // Manage pinned tag
      if (erpMeta.internal_type === 'announcement') {
        if (isPinned && !finalTags.includes('pinned')) {
          finalTags += (finalTags ? ',' : '') + 'pinned';
        } else if (!isPinned && finalTags.includes('pinned')) {
          finalTags = finalTags.split(',').filter((t: string) => t !== 'pinned').join(',');
        }
      }

      // Sync tags with type
      const newTag = `internal_${erpMeta.internal_type}`;
      let tagArray = finalTags.split(',').map((t: string) => t.trim()).filter(Boolean);
      tagArray = tagArray.filter((t: string) => !t.startsWith('internal_'));
      tagArray.push(newTag);
      finalTags = tagArray.join(',');

      const payload: any = {
        body: bodyPayload,
        tags: finalTags,
        progress: formData.progress,
        priority: formData.priority,
        status: formData.status,
        due_date: formData.due_date,
        subject: formData.subject,
        user_id: formData.user_id,
        require_approval: formData.require_approval,
        approver_id: formData.approver_id,
        approval_status: formData.approval_status,
        participant_ids: formData.participant_ids
      };

      const res = await api.put(`/activities/${task.id}`, payload);
      if (res.data && res.data.success) {
        toast.success(t('Đã lưu tất cả thay đổi thành công!'));
        setOriginalHash(currentHash);
        onUpdate();
        
        if (isJustSubmittedForApproval && approverName) {
          toast.success(t('Đã gửi thông báo email thành công!'));
          setShowApprovalSuccessModal(approverName);
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

  const handleUpdateField = async (field: string, value: any) => {
    if (!task) return;
    try {
      const payload: any = { [field]: value };
      const res = await api.put(`/activities/${task.id}`, payload);
      if (res.data && res.data.success) {
        setFormData((prev: any) => {
          const nextData = { ...prev, [field]: value };
          
          const cleanObj = (obj: any) => {
            const clean: any = {};
            Object.keys(obj || {}).forEach(key => {
              if (['created_at', 'updated_at', 'deleted_at', 'created_by_name', 'contact_name', 'contact_avatar', 'user_name'].includes(key)) {
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

    // Reset input
    setNewSubTitle('');
    setNewSubAssignee('');
    setNewSubDeadline('');
    setNewSubPriority('medium');
    toast.success(t('Đã thêm việc con'));
  };

  const handleToggleChecklist = (itemId: string) => {
    const updatedChecklist = erpMeta.checklist.map((item: any) => {
      if (item.id === itemId) {
        return { ...item, done: !item.done };
      }
      return item;
    });

    // Auto calculate progress percentage
    const completedCount = updatedChecklist.filter((x: any) => x.done).length;
    const progressPercent = updatedChecklist.length > 0 
      ? Math.round((completedCount / updatedChecklist.length) * 100) 
      : 0;

    setFormData((prev: any) => ({ ...prev, progress: progressPercent }));
    handleUpdateField('progress', progressPercent);

    const updatedMeta = { ...erpMeta, checklist: updatedChecklist };
    handleSaveMeta(updatedMeta);
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    const updatedChecklist = erpMeta.checklist.filter((item: any) => item.id !== itemId);
    const updatedMeta = { ...erpMeta, checklist: updatedChecklist };
    handleSaveMeta(updatedMeta);
    toast.success(t('Đã xóa việc con'));
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
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await api.post('/upload', fd);
      if (res.data && res.data.success && res.data.url) {
        // Add to resources links
        const newResource = {
          label: file.name,
          url: res.data.url,
          is_file: true
        };
        const newLinks = [...(erpMeta.links || []), newResource];
        const updatedMeta = { ...erpMeta, links: newLinks };
        handleSaveMeta(updatedMeta);
        toast.success(t('Tải lên tài liệu thành công!'));
      } else {
        toast.error(res.data?.message || t('Lỗi tải tệp lên'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối tải tệp: ') + err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  // Comment Attachments Upload
  const handleCommentAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await api.post('/upload', fd);
      if (res.data && res.data.success && res.data.url) {
        setCommentAttachments(prev => [...prev, { name: file.name, url: res.data.url }]);
        toast.success(t('Tải lên đính kèm thành công!'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi tải đính kèm: ') + err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handlePostComment = async () => {
    if (!newCommentText.trim() && commentAttachments.length === 0) return;
    setIsSubmittingComment(true);

    try {
      const attachmentUrls = commentAttachments.map(a => a.url);
      const res = await api.post(`/activities/${task.id}/comments`, {
        content: newCommentText.trim(),
        attachments: attachmentUrls
      });

      if (res.data && res.data.success) {
        setNewCommentText('');
        setCommentAttachments([]);
        loadComments(task.id);
        toast.success(t('Đã thêm bình luận!'));
      }
    } catch (e: any) {
      toast.error(t('Không thể gửi bình luận: ') + e.message);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleToggleParticipant = (userId: number) => {
    const current = (formData.participant_ids || '').split(',').filter(Boolean);
    let next = [];
    if (current.includes(String(userId))) {
      next = current.filter(id => id !== String(userId));
    } else {
      next = [...current, String(userId)];
    }
    const nextString = next.join(',');
    setFormData((prev: any) => ({ ...prev, participant_ids: nextString }));
    handleUpdateField('participant_ids', nextString);
  };

  if (!isOpen || !task) return null;

  // Common card style override
  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border-light)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
    borderRadius: '16px',
    padding: '1.5rem'
  };

  const cardLabelStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  };

  const participantIds = (formData.participant_ids || '').split(',').filter(Boolean).map(Number);
  const participants = users.filter(u => participantIds.includes(Number(u.id)));

  const isSale = currentUser && ['sales', 'sale'].includes(currentUser.role?.toLowerCase());

  const getContactFullName = (c: any) => {
    return `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name || t('Khách hàng');
  };

  const allowedContacts = contacts.filter(c => {
    if (isSale) {
      return Number(c.owner_id) === Number(currentUser?.id);
    }
    return true;
  });

  const approverOptions = users.filter(u => {
    const uRole = (u.role || '').toLowerCase();
    if (['admin', 'superadmin', 'super_admin', 'director'].includes(uRole)) {
      return true;
    }
    if (isSale) {
      return uRole === 'manager' && u.team_id && Number(u.team_id) === Number((currentUser as any)?.team_id);
    }
    return uRole === 'manager';
  });

  const filteredUsersForParticipants = users.filter(u => {
    const uRole = (u.role || '').toLowerCase();
    const isAllowed = 
      ['admin', 'superadmin', 'super_admin', 'director', 'manager'].includes(uRole) ||
      (currentUser && u.team_id && Number(u.team_id) === Number((currentUser as any).team_id));
    
    if (!isAllowed) return false;

    return (u.full_name || '').toLowerCase().includes(participantsSearch.toLowerCase()) ||
           (u.role || '').toLowerCase().includes(participantsSearch.toLowerCase());
  });

  const currentHash = (() => {
    const cleanObj = (obj: any) => {
      const clean: any = {};
      Object.keys(obj || {}).forEach(key => {
        if (['created_at', 'updated_at', 'deleted_at', 'created_by_name', 'contact_name', 'contact_avatar', 'user_name'].includes(key)) {
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
    <motion.div 
      className={styles.drawer}
      initial={embedMode ? {} : { x: '100vw' }}
      animate={embedMode ? {} : { x: 0 }}
      exit={embedMode ? {} : { x: '100vw' }}
      transition={{ type: 'tween', ease: 'easeOut', duration: 0.3 }}
      style={embedMode ? {
        width: '100%',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        boxShadow: 'none',
        borderLeft: '1px solid var(--color-border-light)'
      } : {
        width: isMobileOrTablet ? '100vw' : 'calc(100vw - var(--sidebar-width, 260px))',
        maxWidth: '100vw',
        zIndex: 10600,
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        right: 0,
        boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
        x: '100vw'
      }}
    >
        {/* Drawer Header */}
        <div style={{
          padding: isMobileOrTablet ? '0.5rem 0.75rem' : '1.25rem 1.5rem',
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
                background: erpMeta.internal_type === 'announcement' ? 'rgba(163, 20, 34, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                color: erpMeta.internal_type === 'announcement' ? 'var(--color-primary)' : 'var(--color-success)',
                flexShrink: 0
              }}>
                {erpMeta.internal_type === 'announcement' ? <AlertCircle size={20} /> : <CheckSquare2 size={20} />}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ fontSize: isMobileOrTablet ? '0.9rem' : '1.1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t("Chi tiết công việc")}
                <span className="badge" style={{
                  background: 'rgba(107, 114, 128, 0.1)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  flexShrink: 0
                }}>#{formData.id}</span>
              </h3>
              {!isMobileOrTablet && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                  {t('Người tạo:')} <span style={{ fontWeight: 700 }}>{formData.created_by_name || t('Hệ thống / Admin')}</span>
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={handleManualSave}
              disabled={isSaving || !hasChanges}
              className="btn hover-lift"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: isMobileOrTablet ? '4px 10px' : '6px 16px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 700,
                height: '30px',
                background: hasChanges ? 'var(--color-primary)' : '#e5e7eb',
                borderColor: hasChanges ? 'var(--color-primary)' : '#e5e7eb',
                color: hasChanges ? 'white' : '#9ca3af',
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              {isSaving ? <RefreshCw className="spin" size={12} /> : <CheckSquare2 size={12} />}
              <span>{isMobileOrTablet ? t('Lưu') : t('Lưu thay đổi')}</span>
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
                height: '34px',
                width: '34px'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Drawer Body - 2 Columns Layout */}
        <div style={{ display: 'flex', flexDirection: isMobileOrTablet ? 'column' : 'row', flex: 1, overflowY: 'auto', padding: isMobileOrTablet ? '1rem 1rem 5rem 1rem' : '1.5rem 1.5rem 4.5rem 1.5rem', gap: isMobileOrTablet ? '1rem' : '1.5rem', background: 'var(--color-bg)' }} className="custom-scrollbar">
          
          {/* Left Column (3/5) */}
          <div style={{ flex: isMobileOrTablet ? 'none' : 3, display: 'flex', flexDirection: 'column', gap: isMobileOrTablet ? '1rem' : '1.5rem', minWidth: 0 }}>
            
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
                <button
                  type="button"
                  className="btn outline sm"
                  onClick={() => setShowAddChecklist(!showAddChecklist)}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  <Plus size={12} />
                  {t('Thêm mục')}
                </button>
              </div>

              {/* Add checklist item expander form */}
              {showAddChecklist && (
                <div style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border-light)',
                  padding: '12px',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  animation: 'slideDown 0.2s ease-out'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.25fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.75rem', padding: '6px 10px', height: '38px' }}
                      placeholder={t('Tiêu đề việc con...')}
                      value={newSubTitle}
                      onChange={(e) => setNewSubTitle(e.target.value)}
                    />
                    
                    <CustomSelect
                      options={users.map(u => ({
                        value: String(u.id),
                        label: u.full_name,
                        avatar: u.avatar || u.avatar_url
                      }))}
                      value={newSubAssignee}
                      onChange={val => setNewSubAssignee(String(val))}
                      placeholder={t('Người làm...')}
                      searchable
                      showAvatars
                      size="sm"
                    />

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

                    <input
                      type="date"
                      className="form-input"
                      style={{ fontSize: '0.75rem', padding: '6px', height: '38px' }}
                      value={newSubDeadline}
                      onChange={(e) => setNewSubDeadline(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button className="btn outline sm" onClick={() => setShowAddChecklist(false)} style={{ padding: '3px 8px', fontSize: '0.72rem' }}>{t('Hủy')}</button>
                    <button className="btn primary sm" onClick={handleAddChecklistItem} style={{ padding: '3px 8px', fontSize: '0.72rem' }}>{t('Thêm')}</button>
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
                    return (
                      <div 
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: item.done ? 'rgba(16, 185, 129, 0.03)' : 'var(--color-bg)',
                          border: '1px solid var(--color-border-light)',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          transition: 'all 0.2s',
                          opacity: item.done ? 0.8 : 1
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={!!item.done}
                            onChange={() => handleToggleChecklist(item.id)}
                            style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--color-success)' }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: item.done ? 'var(--color-text-muted)' : 'var(--color-text)',
                              textDecoration: item.done ? 'line-through' : 'none'
                            }}>{item.title}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                                {itemUser ? `${t('Giao cho')}: ${itemUser.full_name}` : t('Chưa phân công')}
                                {item.due_date && ` • Hạn: ${new Date(item.due_date).toLocaleDateString('vi-VN')}`}
                              </span>
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: item.priority === 'high' ? 'rgba(239, 68, 68, 0.08)' : item.priority === 'low' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                color: item.priority === 'high' ? 'var(--color-danger)' : item.priority === 'low' ? 'var(--color-info)' : 'var(--color-warning)',
                                textTransform: 'uppercase'
                              }}>
                                {item.priority === 'high' ? t('Cao') : item.priority === 'low' ? t('Thấp') : t('Trung bình')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteChecklistItem(item.id)}
                          style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                          className="hover-lift"
                        >
                          <Trash2 size={13} />
                        </button>
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
                    style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Link2 size={12} />
                    {t('Thêm link')}
                  </button>
                  <label
                    className="btn outline sm hover-lift"
                    style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(!erpMeta.links || erpMeta.links.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                    {t('Chưa có tệp đính kèm.')}
                  </div>
                ) : (
                  erpMeta.links.map((link: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border-light)',
                        padding: '6px 12px',
                        borderRadius: '6px'
                      }}
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          textDecoration: 'none',
                          color: 'var(--color-primary)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          flex: 1
                        }}
                      >
                        {link.is_file ? <FileText size={12} /> : <Link2 size={12} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>{link.label}</span>
                      </a>

                      <button
                        onClick={() => handleDeleteLink(idx)}
                        style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }}
                        className="hover-lift"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bình luận & Trao đổi */}
            <div className="card" style={cardStyle}>
              <label style={cardLabelStyle}>
                {t('Bình luận & Trao đổi')} ({comments.length})
              </label>

              {/* Add comment input */}
              <div style={{ background: 'rgba(0, 0, 0, 0.015)', border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.01)' }}>
                <MentionInput
                  users={users}
                  value={newCommentText}
                  onChange={setNewCommentText}
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
                    style={{ padding: '5px 16px', fontSize: '0.75rem', borderRadius: '20px' }}
                  >
                    {t('Gửi bình luận')}
                  </button>
                </div>
              </div>

              {/* Comments feed list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', marginTop: '4px' }} className="custom-scrollbar">
                {loadingComments ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <RefreshCw className="spin" size={18} color="var(--color-text-muted)" />
                  </div>
                ) : comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                    {t('Chưa có thảo luận nào.')}
                  </div>
                ) : (
                  comments.map((comment: any) => {
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
                        style={{ 
                          display: 'flex', 
                          gap: '12px', 
                          background: 'rgba(0, 0, 0, 0.01)', 
                          border: '1px solid var(--color-border-light)', 
                          padding: '12px 16px', 
                          borderRadius: '14px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Avatar src={commUser?.avatar || commUser?.avatar_url} name={commUser?.full_name || 'User'} size={28} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text)' }}>{commUser?.full_name || 'Đồng nghiệp'}</span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{new Date(comment.created_at).toLocaleString('vi-VN')}</span>
                          </div>
                          <p style={{ fontSize: '0.825rem', color: 'var(--color-text-light)', margin: '4px 0 0', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>{comment.content}</p>
                          {commentParsedAtts.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                              {commentParsedAtts.map((url: any, aIdx: number) => {
                                const name = typeof url === 'string' ? url.substring(url.lastIndexOf('/') + 1) : (url.name || 'File');
                                const href = typeof url === 'string' ? url : (url.url || '#');
                                return (
                                  <a key={aIdx} href={href} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '2px 6px', borderRadius: '4px', textDecoration: 'none', color: 'var(--color-primary)', fontSize: '0.65rem' }}>
                                    <FileText size={10} />
                                    <span>{name}</span>
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
            </div>
            {/* Bottom Spacer to prevent content from being flush against the bottom */}
            <div style={{ height: '5rem', flexShrink: 0 }} />
          </div>

          {/* Right Column (2/5) */}
          <div style={{ flex: isMobileOrTablet ? 'none' : 2, display: 'flex', flexDirection: 'column', gap: isMobileOrTablet ? '1rem' : '1.5rem', minWidth: 0 }}>
            
            {/* Khách hàng liên quan */}
            <div className="card" style={cardStyle}>
              
              {/* Primary Contact (if any) */}
              {(formData.related_type === 'contact' || formData.contact_id) && (formData.related_id || formData.contact_id) && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {t('Khách hàng chính')}
                  </div>
                  <div 
                    className="hover-lift"
                    onClick={() => {
                      if (onOpenContact) {
                        onOpenContact(Number(formData.related_id || formData.contact_id));
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

            {/* Tiến độ công việc */}
            <div className="card" style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Tiến độ công việc')}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-primary)' }}>{formData.progress || 0}%</span>
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

            {/* Yêu cầu phê duyệt */}
            <div className="card" style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Yêu cầu phê duyệt')}</span>
                  <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', margin: 0 }}>{t('Duyệt hoàn thành khi đạt 100%')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = formData.require_approval === 1 ? 0 : 1;
                    setFormData((prev: any) => {
                      const nextData = { ...prev, require_approval: next };
                      if (next === 0) {
                        nextData.approver_id = null;
                        nextData.approval_status = null;
                      }
                      return nextData;
                    });
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
                    background: 'white',
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
                    onChange={val => {
                      const nextVal = val ? Number(val) : null;
                      setFormData((prev: any) => {
                        const nextData = { ...prev, approver_id: nextVal };
                        if (prev.progress === 100 && nextVal) {
                          nextData.approval_status = 'pending';
                        }
                        return nextData;
                      });
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
            {erpMeta.recurrence && erpMeta.recurrence.pattern !== 'none' && (
              <div className="card" style={{ ...cardStyle, background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🔄</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {t('Tác vụ lặp định kỳ')}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      {erpMeta.recurrence.pattern === 'daily' && t('Lặp lại hàng ngày')}
                      {erpMeta.recurrence.pattern === 'weekly' && `${t('Hàng tuần vào:')} ${
                        (erpMeta.recurrence.weekly_days || [])
                          .map((d: number) => {
                            const days = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 0: 'CN' } as any;
                            return days[d] || '';
                          })
                          .join(', ')
                      }`}
                      {erpMeta.recurrence.pattern === 'monthly' && `${t('Hàng tháng vào ngày:')} ${erpMeta.recurrence.monthly_day}`}
                    </span>
                  </div>
                </div>
              </div>
            )}

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
                  <Search size={14} style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('Tìm kiếm thành viên...')}
                    value={participantsSearch}
                    onChange={(e) => setParticipantsSearch(e.target.value)}
                    style={{ paddingLeft: '34px', fontSize: '0.8rem', borderRadius: '8px' }}
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
      </motion.div>
  );

  if (embedMode) {
    return content;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="drawer-backdrop" 
            onClick={handleCloseDrawer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              zIndex: 10500,
              backdropFilter: 'blur(4px)'
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
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
