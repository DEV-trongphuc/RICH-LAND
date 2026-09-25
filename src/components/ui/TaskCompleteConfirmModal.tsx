import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, X, User, UserCheck, Users, Calendar, 
  FileText, CheckSquare, Sparkles, Tag, Check, Loader2,
  ExternalLink, FileSpreadsheet, Paperclip
} from 'lucide-react';
import { Avatar } from './Avatar';
import { useLanguage } from '../../contexts/LanguageContext';
import { parseTaskBody, formatVietnameseDescription } from '../../utils/taskBodyParser';

export interface TaskCompleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any | null;
  users: any[];
  onConfirm: (task: any) => Promise<void> | void;
  isSubmitting?: boolean;
}

export const TaskCompleteConfirmModal: React.FC<TaskCompleteConfirmModalProps> = ({
  isOpen,
  onClose,
  task,
  users,
  onConfirm,
  isSubmitting = false
}) => {
  const { t } = useLanguage();
  const [isAgreed, setIsAgreed] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsAgreed(true);
    }
  }, [isOpen, task?.id]);

  // Parse task body safely & comprehensively only when opened
  const parsedBody = useMemo(() => {
    if (!isOpen || !task) return null;
    const rawBody = task.body || task.description || '';
    return parseTaskBody(rawBody);
  }, [isOpen, task?.body, task?.description]);

  // 1. Resolve Creator
  const creatorUser = useMemo(() => {
    if (!isOpen || !task) return null;
    return users.find((u: any) => String(u.id) === String(task.created_by || task.creator_id));
  }, [isOpen, task?.created_by, task?.creator_id, users]);

  const creatorName = task?.created_by_name || creatorUser?.full_name || creatorUser?.name || t('Người tạo việc');
  const creatorAvatar = task?.created_by_avatar || creatorUser?.avatar_url || creatorUser?.avatar;

  // 2. Resolve Main Assignee
  const assigneeUser = useMemo(() => {
    if (!isOpen || !task) return null;
    return users.find((u: any) => String(u.id) === String(task.user_id));
  }, [isOpen, task?.user_id, users]);

  const assigneeName = assigneeUser?.full_name || assigneeUser?.name || task?.user_name || t('Chưa phân công');
  const assigneeAvatar = assigneeUser?.avatar_url || assigneeUser?.avatar || task?.avatar_url;

  // 3. Resolve Participants / Related users
  const rawPIds = useMemo(() => {
    if (!isOpen || !task?.participant_ids) return [];
    return String(task.participant_ids).split(',').map(s => s.trim()).filter(Boolean);
  }, [isOpen, task?.participant_ids]);

  const participantUsers = useMemo(() => {
    if (!isOpen || rawPIds.length === 0) return [];
    return rawPIds
      .map(id => users.find((u: any) => String(u.id) === String(id)))
      .filter(Boolean);
  }, [isOpen, rawPIds, users]);

  // 4. Description, Links, and Checklist
  let cleanDesc = parsedBody?.pureDescription || parsedBody?.description || '';
  if (!cleanDesc && typeof task?.description === 'string' && !task.description.startsWith('{')) {
    cleanDesc = formatVietnameseDescription(task.description);
  }

  // Extract URLs from description for dedicated link cards
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const detectedUrls = Array.from(new Set(cleanDesc.match(urlRegex) || []));
  
  // Clean raw URLs from the displayed text so it doesn't look cluttered
  let displayDescription = cleanDesc;
  detectedUrls.forEach(url => {
    displayDescription = displayDescription.replace(url, '').trim();
  });
  displayDescription = displayDescription.replace(/\n{3,}/g, '\n\n').trim();

  const checklistItems = parsedBody?.checklist || [];
  const totalChecklist = checklistItems.length;
  const doneChecklist = checklistItems.filter((c: any) => c.checked || c.done).length;

  // Priority metadata
  const priorityColor = 
    task?.priority === 'urgent' || task?.priority === 'high' ? '#ef4444' :
    task?.priority === 'medium' ? '#f59e0b' : '#3b82f6';
  const priorityBg = 
    task?.priority === 'urgent' || task?.priority === 'high' ? 'rgba(239, 68, 68, 0.12)' :
    task?.priority === 'medium' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)';
  const priorityLabel = 
    task?.priority === 'urgent' ? t('Khẩn cấp') :
    task?.priority === 'high' ? t('Ưu tiên cao') :
    task?.priority === 'medium' ? t('Bình thường') : t('Thấp');

  const modalNode = (
    <AnimatePresence>
      {isOpen && task && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
            contain: 'layout'
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.78)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              zIndex: 0,
              willChange: 'opacity',
              transform: 'translateZ(0)'
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.6 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '88vh',
              background: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '24px',
              boxShadow: '0 30px 75px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.12)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1,
              contain: 'layout',
              willChange: 'transform, opacity',
              transform: 'translate3d(0, 0, 0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
          {/* Header Section */}
          <div style={{
            padding: '22px 24px 16px',
            borderBottom: '1px solid var(--color-border-light, #f1f5f9)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            position: 'relative',
            background: 'var(--color-surface, #ffffff)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '20px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.28)',
                color: '#10b981',
                fontSize: '0.725rem',
                fontWeight: 700
              }}>
                <CheckCircle2 size={13} strokeWidth={2.5} />
                <span>{t('Xác nhận hoàn thành công việc')}</span>
                <Sparkles size={12} style={{ color: '#f59e0b', marginLeft: '2px' }} />
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted, #64748b)',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s'
                }}
                title={t('Đóng')}
              >
                <X size={18} />
              </button>
            </div>

            <h3 style={{
              margin: '4px 0 2px',
              fontSize: '1.15rem',
              fontWeight: 800,
              color: 'var(--color-text, #0f172a)',
              lineHeight: 1.4,
              letterSpacing: '-0.2px'
            }}>
              {task.subject || t('Không có tiêu đề')}
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '2px' }}>
              <span style={{
                fontSize: '0.685rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '8px',
                background: priorityBg,
                color: priorityColor,
                border: `1px solid ${priorityColor}30`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {priorityLabel}
              </span>

              {task.due_date && (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-light, #f8fafc)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  color: 'var(--color-text-muted, #64748b)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <Calendar size={12} style={{ color: 'var(--color-primary, #BD1D2D)' }} />
                  <span>{t('Hạn chót')}: <strong style={{ color: 'var(--color-text, #0f172a)' }}>{task.due_date.slice(0, 10)}</strong></span>
                </span>
              )}

              {task.task_group_name && (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: '8px',
                  background: 'var(--color-bg-light, #f8fafc)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  color: task.task_group_color || 'var(--color-text, #0f172a)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Tag size={12} />
                  <span>{task.task_group_name}</span>
                </span>
              )}
            </div>
          </div>

          {/* Scrollable Body Content */}
          <div style={{
            padding: '18px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Unified Personnel Card */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1.15fr',
              gap: '1px',
              background: 'var(--color-border-light, #e2e8f0)',
              border: '1px solid var(--color-border-light, #e2e8f0)',
              borderRadius: '16px',
              overflow: 'hidden'
            }}>
              {/* Box 1: Người tạo */}
              <div style={{
                background: 'var(--color-bg-light, #f8fafc)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  <User size={12} style={{ color: '#3b82f6' }} />
                  <span>{t('Người tạo')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <Avatar src={creatorAvatar} name={creatorName} size={30} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--color-text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {creatorName}
                  </span>
                </div>
              </div>

              {/* Box 2: Thực hiện chính */}
              <div style={{
                background: 'var(--color-bg-light, #f8fafc)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  <UserCheck size={12} style={{ color: '#10b981' }} />
                  <span>{t('Thực hiện')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <div style={{ position: 'relative', display: 'flex' }}>
                    <Avatar src={assigneeAvatar} name={assigneeName} size={30} />
                    <span style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: '#10b981', border: '1.5px solid #ffffff' }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--color-text, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {assigneeName}
                  </span>
                </div>
              </div>

              {/* Box 3: Người liên quan */}
              <div style={{
                background: 'var(--color-bg-light, #f8fafc)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  <Users size={12} style={{ color: '#8b5cf6' }} />
                  <span>{t('Liên quan')}</span>
                  {participantUsers.length > 0 && (
                    <span style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 800 }}>({participantUsers.length})</span>
                  )}
                </div>

                {participantUsers.length > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {participantUsers.slice(0, 4).map((pUser: any, idx: number) => (
                      <div
                        key={pUser.id || idx}
                        title={pUser.full_name || pUser.name}
                        style={{
                          marginLeft: idx > 0 ? '-8px' : 0,
                          border: '2px solid #ffffff',
                          borderRadius: '50%',
                          zIndex: 10 - idx
                        }}
                      >
                        <Avatar src={pUser.avatar_url || pUser.avatar} name={pUser.full_name || pUser.name} size={28} />
                      </div>
                    ))}
                    {participantUsers.length > 4 && (
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#e2e8f0',
                        border: '2px solid #ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        marginLeft: '-8px',
                        zIndex: 5
                      }}>
                        +{participantUsers.length - 4}
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)', fontStyle: 'italic' }}>
                    {t('Không có')}
                  </span>
                )}
              </div>
            </div>

            {/* Task Content / Description Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={13} />
                <span>{t('Nội dung công việc')}</span>
              </label>
              
              <div style={{
                background: 'var(--color-bg-light, #f8fafc)',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '14px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '180px',
                overflowY: 'auto'
              }}>
                {displayDescription ? (
                  <div style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-text, #0f172a)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-line',
                    wordBreak: 'break-word'
                  }}>
                    {displayDescription}
                  </div>
                ) : !detectedUrls.length && !checklistItems.length ? (
                  <span style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--color-text-muted, #64748b)' }}>
                    {t('Không có mô tả chi tiết kèm theo.')}
                  </span>
                ) : null}

                {/* Detected Links Cards */}
                {detectedUrls.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: displayDescription ? '4px' : 0 }}>
                    {detectedUrls.map((url, idx) => {
                      const isSheet = url.includes('spreadsheets') || url.includes('excel') || url.includes('.xlsx');
                      return (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            background: '#ffffff',
                            border: '1px solid var(--color-border, #e2e8f0)',
                            color: 'var(--color-primary, #BD1D2D)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            transition: 'all 0.15s'
                          }}
                        >
                          {isSheet ? (
                            <FileSpreadsheet size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                          ) : (
                            <Paperclip size={14} style={{ color: 'var(--color-primary, #BD1D2D)', flexShrink: 0 }} />
                          )}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {url}
                          </span>
                          <ExternalLink size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Checklist Summary & Items */}
                {checklistItems.length > 0 && (
                  <div style={{
                    marginTop: '4px',
                    paddingTop: '8px',
                    borderTop: '1px dashed var(--color-border, #e2e8f0)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted, #64748b)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckSquare size={12} />
                        <span>{t('Danh sách việc con (Checklist)')}</span>
                      </span>
                      <span style={{ color: doneChecklist === totalChecklist ? '#10b981' : 'var(--color-text, #0f172a)' }}>
                        {doneChecklist}/{totalChecklist} {t('hoàn thành')}
                      </span>
                    </div>
                    {checklistItems.map((c: any, cIdx: number) => {
                      const isDone = c.checked || c.done;
                      return (
                        <div key={c.id || cIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: isDone ? 'var(--color-text-muted, #64748b)' : 'var(--color-text, #0f172a)' }}>
                          <span style={{
                            width: 14,
                            height: 14,
                            borderRadius: '4px',
                            background: isDone ? '#10b981' : 'transparent',
                            border: isDone ? 'none' : '1.5px solid var(--color-border, #cbd5e1)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6rem',
                            flexShrink: 0
                          }}>
                            {isDone && '✓'}
                          </span>
                          <span style={{ textDecoration: isDone ? 'line-through' : 'none' }}>
                            {c.text || c.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation Toggle Box */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              background: isAgreed ? 'rgba(16, 185, 129, 0.08)' : 'var(--color-bg-light, #f8fafc)',
              border: isAgreed ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '14px',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.15s ease'
            }}>
              <input
                type="checkbox"
                checked={isAgreed}
                onChange={e => setIsAgreed(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#10b981',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              />
              <span style={{ fontSize: '0.8125rem', fontWeight: 650, color: 'var(--color-text, #0f172a)', lineHeight: 1.4 }}>
                {t('Tôi xác nhận công việc này đã hoàn thành đầy đủ và đạt yêu cầu.')}
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border-light, #f1f5f9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'var(--color-surface, #ffffff)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 18px',
                borderRadius: '11px',
                border: '1px solid var(--color-border, #e2e8f0)',
                background: '#ffffff',
                color: 'var(--color-text, #0f172a)',
                fontWeight: 650,
                fontSize: '0.8125rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {t('Hủy bỏ')}
            </button>

            <button
              type="button"
              disabled={!isAgreed || isSubmitting}
              onClick={() => onConfirm(task)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 24px',
                borderRadius: '11px',
                border: 'none',
                background: isAgreed ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'var(--color-border, #cbd5e1)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: !isAgreed || isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: isAgreed ? '0 4px 16px rgba(16, 185, 129, 0.35)' : 'none',
                opacity: !isAgreed || isSubmitting ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="spin" />
                  <span>{t('Đang lưu...')}</span>
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={3} />
                  <span>{t('Xác nhận hoàn thành')}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : null;
};
