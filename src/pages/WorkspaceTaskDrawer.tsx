import React, { useState, useEffect, useRef } from 'react';
import { 
  X, CheckSquare, Paperclip, Link2, MessageSquare, Calendar, User, Clock, 
  Settings, AlertCircle, Trash2, Plus, Send, Share2, FileText, Globe, 
  Users, RefreshCw, Layers, CheckSquare2, Info, Receipt, Scale, ArrowUpRight
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { CustomSelect } from '../components/ui/CustomSelect';
import { MentionInput } from '../components/ui/MentionInput';
import { Avatar } from '../components/ui/Avatar';
import styles from './EntityDrawer.module.css';

interface WorkspaceTaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  onUpdate: () => void;
  users: any[];
}

export const WorkspaceTaskDrawer: React.FC<WorkspaceTaskDrawerProps> = ({ 
  isOpen, 
  onClose, 
  task, 
  onUpdate, 
  users 
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'detail' | 'checklist' | 'resources' | 'comments'>('detail');
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

  // Checklist adding state
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubAssignee, setNewSubAssignee] = useState('');
  const [newSubDeadline, setNewSubDeadline] = useState('');

  // Resource adding state
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Pinned/Campaign specific state
  const [isPinned, setIsPinned] = useState(false);
  const [campaignTarget, setCampaignTarget] = useState('');

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

  useEffect(() => {
    if (task) {
      setFormData(task);
      setIsPinned(task.tags?.includes('pinned') || false);

      // Parse erp metadata from task body
      let parsedMeta: any = {
        description: task.body || '',
        internal_type: 'task',
        scope: 'team',
        recurrence: { pattern: 'none', weekly_days: [], monthly_day: 1, last_generated: '' },
        checklist: [],
        links: []
      };

      if (task.body && task.body.startsWith('{"erp_task":')) {
        try {
          const parsed = JSON.parse(task.body);
          parsedMeta = { ...parsedMeta, ...parsed.erp_task };
        } catch (e) {
          parsedMeta.description = task.body;
        }
      }

      setErpMeta(parsedMeta);
      setCampaignTarget(parsedMeta.campaign_target || '');
      loadComments(task.id);
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
        onUpdate();
      }
    } catch (e: any) {
      toast.error(t('Lỗi lưu thay đổi: ') + e.message);
    }
  };

  const handleUpdateField = async (field: string, value: any) => {
    if (!task) return;
    try {
      const payload: any = { [field]: value };
      const res = await api.put(`/activities/${task.id}`, payload);
      if (res.data && res.data.success) {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
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
      done: false
    };

    const newChecklist = [...(erpMeta.checklist || []), newItem];
    const updatedMeta = { ...erpMeta, checklist: newChecklist };
    handleSaveMeta(updatedMeta);

    // Reset input
    setNewSubTitle('');
    setNewSubAssignee('');
    setNewSubDeadline('');
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

  if (!isOpen || !task) return null;

  const progressColor = erpMeta.internal_type === 'announcement' ? 'var(--color-primary)' 
                      : erpMeta.internal_type === 'campaign' ? '#db2777' 
                      : erpMeta.internal_type === 'policy' ? '#ea580c' 
                      : 'var(--color-success)';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="drawer-backdrop" 
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 10500,
          backdropFilter: 'blur(3px)',
          animation: 'fade-in 0.2s ease-out'
        }}
      />

      {/* Slideout Panel */}
      <div 
        className={styles.drawer}
        style={{
          width: '780px',
          maxWidth: '90vw',
          zIndex: 10600,
          background: 'var(--color-bg)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'fixed',
          top: 0,
          right: 0,
          boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
          animation: 'slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--color-border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          background: 'var(--color-surface)'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: erpMeta.internal_type === 'announcement' ? 'rgba(163, 20, 34, 0.08)' : 'rgba(16, 185, 129, 0.08)',
              color: erpMeta.internal_type === 'announcement' ? 'var(--color-primary)' : 'var(--color-success)'
            }}>
              {erpMeta.internal_type === 'announcement' ? <Info size={22} /> : <CheckSquare2 size={22} />}
            </div>
            <div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                color: progressColor,
                letterSpacing: '0.5px'
              }}>
                {erpMeta.internal_type === 'announcement' ? t('Thông báo nội bộ') 
                 : erpMeta.internal_type === 'campaign' ? t('Chiến dịch nội bộ') 
                 : erpMeta.internal_type === 'policy' ? t('Chính sách ưu đãi') 
                 : t('Công việc nội bộ')}
              </span>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--color-text)',
                margin: '4px 0 0'
              }}>{formData.subject}</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              borderRadius: '50%'
            }}
            className="hover-lift"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body - Split Left/Right */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* LEFT SIDEBAR: Navigation Tabs */}
          <div style={{
            width: '200px',
            borderRight: '1px solid var(--color-border-light)',
            background: 'var(--color-surface)',
            padding: '1.25rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            {[
              { id: 'detail', label: t('Chi tiết'), icon: Info },
              { id: 'checklist', label: t('Nhiệm vụ con'), icon: CheckSquare },
              { id: 'resources', label: t('Tài liệu & Links'), icon: Paperclip },
              { id: 'comments', label: t('Thảo luận'), icon: MessageSquare }
            ].map(tab => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '10px 14px',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    background: isSelected ? 'rgba(163, 20, 34, 0.08)' : 'transparent',
                    color: isSelected ? 'var(--color-primary)' : 'var(--color-text-light)'
                  }}
                  className="hover-lift"
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* RIGHT VIEW AREA: Dynamic View Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: 'var(--color-bg)' }} className="custom-scrollbar">
            
            {/* VIEW TAB 1: DETAILED VIEW */}
            {activeTab === 'detail' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Approval Banner */}
                {formData.require_approval === 1 && formData.progress === 100 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px 1rem',
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
                    {formData.approval_status === 'pending' && (
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
                
                {/* Description */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '1.25rem', borderRadius: '16px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    {t('Mô tả chi tiết')}
                  </label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={erpMeta.description}
                    onChange={e => setErpMeta({ ...erpMeta, description: e.target.value })}
                    onBlur={() => handleSaveMeta(erpMeta)}
                    placeholder={t('Nhập mô tả chi tiết công việc hoặc nội dung văn bản thông báo...')}
                    style={{ fontSize: '0.85rem', padding: '10px 14px', minHeight: '100px' }}
                  />
                </div>

                {/* Scope & Type configurations */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  
                  {/* Phạm vi */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>{t('Phạm vi áp dụng')}</label>
                    <CustomSelect
                      options={[
                        { value: 'team', label: t('Nội bộ Team') },
                        { value: 'global', label: t('Toàn hệ thống') }
                      ]}
                      value={erpMeta.scope || 'team'}
                      onChange={val => {
                        const updated = { ...erpMeta, scope: String(val) };
                        setErpMeta(updated);
                        handleSaveMeta(updated);
                      }}
                    />
                  </div>

                  {/* Phân công thực hiện */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>{t('Chịu trách nhiệm chính')}</label>
                    <CustomSelect
                      options={users.map(u => ({ value: String(u.id), label: u.full_name }))}
                      value={String(formData.user_id || '')}
                      onChange={val => {
                        handleUpdateField('user_id', Number(val));
                      }}
                    />
                    {(() => {
                      const assigneeUser = users.find(u => String(u.id) === String(formData.user_id));
                      return assigneeUser && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                          <Avatar src={assigneeUser.avatar_url || assigneeUser.avatar} name={assigneeUser.full_name} size={20} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{assigneeUser.full_name}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Người liên quan */}
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>{t('Người liên quan (Participants)')}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {users.map((u: any) => {
                        const currentParticipants = (formData.participant_ids || '').split(',').filter(Boolean);
                        const isMainAssignee = String(formData.user_id || '') === String(u.id);
                        const isParticipant = currentParticipants.includes(String(u.id));

                        if (isMainAssignee) return null;

                        return (
                          <span
                            key={u.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              border: isParticipant ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: isParticipant ? 'var(--color-primary-light)' : 'transparent',
                              color: isParticipant ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              transition: 'all 0.2s'
                            }}
                            onClick={() => {
                              const current = (formData.participant_ids || '').split(',').filter(Boolean);
                              let next = [];
                              if (current.includes(String(u.id))) {
                                next = current.filter(id => id !== String(u.id));
                              } else {
                                next = [...current, String(u.id)];
                              }
                              handleUpdateField('participant_ids', next.join(','));
                            }}
                            className="hover-lift"
                          >
                            <Avatar src={u.avatar_url || u.avatar} name={u.full_name} size={16} />
                            <span>{u.full_name}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Yêu cầu phê duyệt */}
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '12px', marginTop: '4px' }}>
                      <div>
                        <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)' }}>{t('Cần phê duyệt hoàn thành')}</span>
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>{t('Yêu cầu cấp quản lý phê duyệt khi tiến độ đạt 100%.')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = formData.require_approval === 1 ? 0 : 1;
                          handleUpdateField('require_approval', next);
                        }}
                        style={{
                          width: '40px',
                          height: '22px',
                          borderRadius: '11px',
                          border: 'none',
                          background: formData.require_approval === 1 ? 'var(--color-success)' : '#e5e7eb',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
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
                  </div>

                  {formData.require_approval === 1 && (
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label" style={{ fontWeight: 700 }}>{t('Người phê duyệt')}</label>
                      <CustomSelect
                        options={users.filter(u => ['admin', 'superadmin', 'manager', 'director'].includes(u.role?.toLowerCase())).map(u => ({
                          value: String(u.id),
                          label: `${u.full_name} (${u.role})`
                        }))}
                        value={formData.approver_id ? String(formData.approver_id) : ''}
                        onChange={val => {
                          handleUpdateField('approver_id', val ? Number(val) : null);
                        }}
                        placeholder={t('Chọn người phê duyệt...')}
                      />
                      {(() => {
                        const approverUser = formData.approver_id ? users.find(u => String(u.id) === String(formData.approver_id)) : null;
                        return approverUser && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                            <Avatar src={approverUser.avatar_url || approverUser.avatar} name={approverUser.full_name} size={20} />
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{approverUser.full_name} ({approverUser.role})</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                </div>

                {/* Priority & Deadline Configurations */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  
                  {/* Mức độ ưu tiên */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>{t('Mức độ ưu tiên')}</label>
                    <CustomSelect
                      options={[
                        { value: 'low', label: t('Thấp') },
                        { value: 'medium', label: t('Trung bình') },
                        { value: 'high', label: t('Cao') }
                      ]}
                      value={formData.priority || 'medium'}
                      onChange={val => handleUpdateField('priority', String(val))}
                    />
                  </div>

                  {/* Deadline tổng */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>{t('Hạn hoàn thành')}</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.due_date ? formData.due_date.slice(0, 10) : ''}
                      onChange={e => handleUpdateField('due_date', e.target.value)}
                    />
                  </div>
                </div>

                {/* Campaign Indicator Settings (Only for Campaign Type) */}
                {erpMeta.internal_type === 'campaign' && (
                  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '1.25rem', borderRadius: '16px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#db2777', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      🎯 {t('Chỉ tiêu chiến dịch (Doanh số/KPI)')}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={campaignTarget}
                      onChange={e => setCampaignTarget(e.target.value)}
                      onBlur={() => {
                        const updated = { ...erpMeta, campaign_target: campaignTarget };
                        handleSaveMeta(updated);
                      }}
                      placeholder="VD: Doanh số 5 tỷ VND / 10 Giao dịch thành công"
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                )}

                {/* Pinned Switch (Only for Announcement Type) */}
                {erpMeta.internal_type === 'announcement' && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    background: 'var(--color-surface)', 
                    border: '1px solid var(--color-border-light)', 
                    padding: '1rem 1.25rem', 
                    borderRadius: '16px' 
                  }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>📌 {t('Ghim thông báo ở đầu trang')}</span>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>{t('Hiện thị thẻ thông báo nổi bật ở đầu trang Bàn làm việc.')}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={e => {
                        const val = e.target.checked;
                        setIsPinned(val);
                        // Save tags directly with callback
                        let finalTags = task.tags || '';
                        if (val && !finalTags.includes('pinned')) {
                          finalTags += (finalTags ? ',' : '') + 'pinned';
                        } else if (!val && finalTags.includes('pinned')) {
                          finalTags = finalTags.split(',').filter((t: string) => t !== 'pinned').join(',');
                        }
                        handleUpdateField('tags', finalTags);
                      }}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </div>
                )}

                {/* Recurrence Settings Section */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '1.25rem', borderRadius: '16px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    🔄 {t('Lịch lặp lại định kỳ')}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1rem', alignItems: 'center' }}>
                    <CustomSelect
                      options={[
                        { value: 'none', label: t('Không lặp lại') },
                        { value: 'daily', label: t('Hàng ngày') },
                        { value: 'weekly', label: t('Hàng tuần') },
                        { value: 'monthly', label: t('Hàng tháng') }
                      ]}
                      value={erpMeta.recurrence?.pattern || 'none'}
                      onChange={val => {
                        const updatedRecurrence = {
                          ...(erpMeta.recurrence || { pattern: 'none', weekly_days: [], monthly_day: 1, last_generated: '' }),
                          pattern: String(val)
                        };
                        const updated = { ...erpMeta, recurrence: updatedRecurrence };
                        setErpMeta(updated);
                        handleSaveMeta(updated);
                      }}
                    />

                    {/* Weekly Days selection */}
                    {erpMeta.recurrence?.pattern === 'weekly' && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {[
                          { key: 1, label: 'T2' }, { key: 2, label: 'T3' }, { key: 3, label: 'T4' },
                          { key: 4, label: 'T5' }, { key: 5, label: 'T6' }, { key: 6, label: 'T7' },
                          { key: 0, label: 'CN' }
                        ].map(day => {
                          const isSelected = erpMeta.recurrence.weekly_days?.includes(day.key);
                          return (
                            <button
                              key={day.key}
                              type="button"
                              onClick={() => {
                                let newDays = [...(erpMeta.recurrence.weekly_days || [])];
                                if (newDays.includes(day.key)) {
                                  newDays = newDays.filter(d => d !== day.key);
                                } else {
                                  newDays.push(day.key);
                                }
                                const updated = {
                                  ...erpMeta,
                                  recurrence: { ...erpMeta.recurrence, weekly_days: newDays }
                                };
                                setErpMeta(updated);
                                handleSaveMeta(updated);
                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: '1px solid var(--color-border)',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                                color: isSelected ? 'white' : 'var(--color-text)'
                              }}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Monthly day selection */}
                    {erpMeta.recurrence?.pattern === 'monthly' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('Lặp lại ngày:')}</span>
                        <input
                          type="number"
                          className="form-input"
                          min={1}
                          max={31}
                          value={erpMeta.recurrence.monthly_day || 1}
                          onChange={e => {
                            const val = Math.min(31, Math.max(1, Number(e.target.value)));
                            const updated = {
                              ...erpMeta,
                              recurrence: { ...erpMeta.recurrence, monthly_day: val }
                            };
                            setErpMeta(updated);
                          }}
                          onBlur={() => handleSaveMeta(erpMeta)}
                          style={{ width: '60px', height: '32px', textAlign: 'center', padding: 0 }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '1.25rem', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>📊 {t('Tiến độ tổng quát')}</span>
                    <span style={{ fontWeight: 800, color: progressColor }}>{formData.progress || 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--color-border-light)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${formData.progress || 0}%`, height: '100%', background: progressColor, borderRadius: '4px', transition: 'width 0.3s ease-out' }}></div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW TAB 2: SUB-TASKS CHECKLIST */}
            {activeTab === 'checklist' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Add Sub-task form */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '1.25rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>➕ {t('Thêm công việc con mới')}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t('Tên công việc con...')}
                      value={newSubTitle}
                      onChange={e => setNewSubTitle(e.target.value)}
                      style={{ fontSize: '0.8rem', height: '36px' }}
                    />
                    <CustomSelect
                      options={[
                        { value: '', label: `-- ${t('Người làm')} --` },
                        ...users.map(u => ({ value: String(u.id), label: u.full_name }))
                      ]}
                      value={newSubAssignee}
                      onChange={val => setNewSubAssignee(String(val))}
                    />
                    <input
                      type="date"
                      className="form-input"
                      value={newSubDeadline}
                      onChange={e => setNewSubDeadline(e.target.value)}
                      style={{ fontSize: '0.8rem', height: '36px' }}
                    />
                  </div>
                  <button 
                    onClick={handleAddChecklistItem}
                    className="btn primary"
                    style={{ height: '36px', alignSelf: 'flex-end', padding: '0 1.25rem' }}
                  >
                    <Plus size={14} style={{ marginRight: '4px' }} />
                    {t('Thêm việc con')}
                  </button>
                </div>

                {/* Sub-tasks list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {t('Danh sách công việc con')} ({erpMeta.checklist?.length || 0})
                  </label>

                  {(!erpMeta.checklist || erpMeta.checklist.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: '16px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      {t('Chưa có công việc con nào được tạo.')}
                    </div>
                  ) : (
                    erpMeta.checklist.map((item: any) => {
                      const assigneeUser = users.find(u => Number(u.id) === Number(item.assignee_id));
                      return (
                        <div 
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            padding: '12px 1rem',
                            borderRadius: '12px',
                            transition: 'all 0.2s',
                            opacity: item.done ? 0.7 : 1
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={item.done || false}
                              onChange={() => handleToggleChecklist(item.id)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <span style={{ 
                                fontSize: '0.85rem', 
                                fontWeight: 700, 
                                color: 'var(--color-text)',
                                textDecoration: item.done ? 'line-through' : 'none'
                              }}>
                                {item.title}
                              </span>
                              
                              <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                                {assigneeUser && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                    <User size={10} />
                                    <span>{assigneeUser.full_name}</span>
                                  </div>
                                )}
                                {item.due_date && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#ea580c' }}>
                                    <Clock size={10} />
                                    <span>{item.due_date}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteChecklistItem(item.id)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--color-text-muted)',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                            className="hover-lift"
                          >
                            <Trash2 size={14} color="var(--color-danger)" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* VIEW TAB 3: RESOURCES / ATTACHMENTS & LINKS */}
            {activeTab === 'resources' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Link & File upload controls */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '1.25rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* File Upload zone */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>📎 {t('Tải lên tài liệu đính kèm')}</h4>
                    <label style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px dashed var(--color-border)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                      background: 'var(--color-bg)'
                    }} className="hover-lift">
                      {uploadingFile ? (
                        <>
                          <RefreshCw className="spin" size={24} color="var(--color-primary)" />
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>{t('Đang tải tệp lên...')}</span>
                        </>
                      ) : (
                        <>
                          <Paperclip size={24} color="var(--color-text-muted)" />
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '8px' }}>{t('Nhấp để chọn hoặc kéo thả tệp vào đây')}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{t('Chấp nhận các định dạng tệp thông dụng.')}</span>
                        </>
                      )}
                      <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploadingFile} />
                    </label>
                  </div>

                  <div style={{ height: '1px', background: 'var(--color-border-light)' }}></div>

                  {/* Add Web Link */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>🔗 {t('Thêm liên kết / Link tài liệu')}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t('Tên nhãn (ví dụ: Google Drive)')}
                        value={newLinkLabel}
                        onChange={e => setNewLinkLabel(e.target.value)}
                        style={{ fontSize: '0.8rem', height: '36px' }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="https://..."
                        value={newLinkUrl}
                        onChange={e => setNewLinkUrl(e.target.value)}
                        style={{ fontSize: '0.8rem', height: '36px' }}
                      />
                    </div>
                    <button 
                      onClick={handleAddLink}
                      className="btn primary"
                      style={{ height: '36px', alignSelf: 'flex-end', padding: '0 1.25rem', marginTop: '4px' }}
                    >
                      <Link2 size={14} style={{ marginRight: '4px' }} />
                      {t('Thêm liên kết')}
                    </button>
                  </div>
                </div>

                {/* Resources list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {t('Tài liệu & liên kết đính kèm')} ({erpMeta.links?.length || 0})
                  </label>

                  {(!erpMeta.links || erpMeta.links.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: '16px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      {t('Chưa có tài liệu đính kèm.')}
                    </div>
                  ) : (
                    erpMeta.links.map((link: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          padding: '10px 1rem',
                          borderRadius: '12px'
                        }}
                      >
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            textDecoration: 'none',
                            color: 'var(--color-primary)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            flex: 1
                          }}
                          className="hover-lift"
                        >
                          {link.is_file ? <FileText size={16} /> : <Link2 size={16} />}
                          <span>{link.label}</span>
                          <ArrowUpRight size={12} style={{ opacity: 0.6 }} />
                        </a>

                        <button
                          onClick={() => handleDeleteLink(idx)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                          className="hover-lift"
                        >
                          <Trash2 size={14} color="var(--color-danger)" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* VIEW TAB 4: DISCUSSION & COMMENTS WITH MENTIONS */}
            {activeTab === 'comments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
                
                {/* Write comment input block */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  {/* Attachments preview under comment */}
                  {commentAttachments.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      {commentAttachments.map((att, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem' }}>
                          <FileText size={10} color="var(--color-text-light)" />
                          <span style={{ color: 'var(--color-text)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                          <button
                            onClick={() => setCommentAttachments(prev => prev.filter((_, i) => i !== idx))}
                            style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', padding: 0 }}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <MentionInput
                        users={users}
                        className="form-input"
                        placeholder={t('Viết bình luận... (Gõ @ để nhắc tên đồng nghiệp)')}
                        value={newCommentText}
                        onChange={e => setNewCommentText(e.target.value)}
                        style={{
                          fontSize: '0.8rem',
                          minHeight: '44px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {/* Attach file to comment */}
                      <label style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        cursor: 'pointer'
                      }} className="hover-lift">
                        <Paperclip size={14} color="var(--color-text-muted)" />
                        <input type="file" onChange={handleCommentAttachmentUpload} style={{ display: 'none' }} />
                      </label>

                      {/* Post comment button */}
                      <button
                        onClick={handlePostComment}
                        disabled={isSubmittingComment}
                        className="btn primary"
                        style={{ width: '34px', height: '34px', borderRadius: '8px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Comments feed */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {t('Cuộc thảo luận')} ({comments.length})
                  </label>

                  {loadingComments ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                      <RefreshCw className="spin" size={20} color="var(--color-text-muted)" />
                    </div>
                  ) : comments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: '16px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      {t('Chưa có thảo luận nào. Hãy bắt đầu cuộc trò chuyện!')}
                    </div>
                  ) : (
                    comments.map((comment: any) => {
                      const commUser = users.find(u => Number(u.id) === Number(comment.user_id));
                      const parsedAttachments = comment.attachments ? JSON.parse(comment.attachments) : [];
                      
                      return (
                        <div 
                          key={comment.id}
                          style={{
                            display: 'flex',
                            gap: '12px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            padding: '12px',
                            borderRadius: '12px'
                          }}
                        >
                          <Avatar src={commUser?.avatar || commUser?.avatar_url} name={commUser?.full_name || 'User'} size={32} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                {commUser?.full_name || 'Đồng nghiệp'}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                {new Date(comment.created_at).toLocaleString('vi-VN')}
                              </span>
                            </div>

                            <p style={{ 
                              fontSize: '0.8rem', 
                              color: 'var(--color-text-light)', 
                              margin: '6px 0 0', 
                              lineHeight: '1.4',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {comment.content}
                            </p>

                            {/* Attachments */}
                            {parsedAttachments.length > 0 && (
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                {parsedAttachments.map((url: string, aIdx: number) => {
                                  const name = url.substring(url.lastIndexOf('/') + 1);
                                  return (
                                    <a
                                      key={aIdx}
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'var(--color-bg)',
                                        border: '1px solid var(--color-border-light)',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.72rem',
                                        textDecoration: 'none',
                                        color: 'var(--color-primary)'
                                      }}
                                    >
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
            )}
          </div>
        </div>
      </div>
    </>
  );
};
