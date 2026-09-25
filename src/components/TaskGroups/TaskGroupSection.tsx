import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { 
  Folder, Star, Zap, Target, Bookmark, Briefcase, Flame, Clock, 
  Sparkles, Flag, Smile, Layers, Heart, CheckCircle, Tag, Compass, 
  Shield, Plus, MoreVertical, Edit2, Trash2, X, Check, Inbox, GripVertical, Search, ArrowLeft, User
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export interface TaskGroup {
  id: number;
  user_id: number;
  name: string;
  color: string;
  icon: string;
  order_index: number;
  is_pinned?: number;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  progress_percent: number;
  created_at?: string;
}

export interface TaskGroupsSummary {
  all: { total_tasks: number; completed_tasks: number; pending_tasks: number; progress_percent: number };
  unassigned: { total_tasks: number; completed_tasks: number; pending_tasks: number; progress_percent: number };
  personal?: { total_tasks: number; completed_tasks: number; pending_tasks: number; progress_percent: number };
}

export const ICON_MAP: Record<string, React.ElementType> = {
  Folder, Star, Zap, Target, Bookmark, Briefcase, Flame, Clock, 
  Sparkles, Flag, Smile, Layers, Heart, CheckCircle, Tag, Compass, Shield, Inbox, User
};

export const PRESET_COLORS = [
  '#BD1D2D', // Ideas Red / RICH LAND Red
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#0ea5e9', // Sky Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#64748b'  // Slate
];

interface DroppableGroupCardProps {
  id: string; // e.g. 'group-12', 'group-unassigned', 'group-all', 'group-personal'
  groupId: number | null | 'all' | 'unassigned' | 'personal';
  isSelected: boolean;
  color: string;
  IconComp: React.ElementType;
  title: string;
  completedTasks: number;
  totalTasks: number;
  progress: number;
  isMobile: boolean;
  showProgress?: boolean;
  onSelect: () => void;
  onDropTaskOnGroup?: (taskId: number, targetGroupId: number | null) => void;
  draggedTaskId?: number | null;
  childrenMenu?: React.ReactNode;
  isPinned?: boolean;
  onTogglePin?: () => void;
  isReorderable?: boolean;
  isDraggingGroup?: boolean;
  isDragOverTarget?: boolean;
  onGroupDragStart?: (e: React.DragEvent) => void;
  onGroupDragEnd?: (e: React.DragEvent) => void;
  onGroupDragOver?: (e: React.DragEvent) => void;
  onGroupDragLeave?: (e: React.DragEvent) => void;
  onGroupDrop?: (e: React.DragEvent) => void;
}

const DroppableGroupCard: React.FC<DroppableGroupCardProps> = ({
  id,
  groupId,
  isSelected,
  color,
  IconComp,
  title,
  completedTasks,
  totalTasks,
  progress,
  isMobile,
  showProgress = true,
  onSelect,
  onDropTaskOnGroup,
  draggedTaskId,
  childrenMenu,
  isPinned = false,
  onTogglePin,
  isReorderable = false,
  isDraggingGroup = false,
  isDragOverTarget = false,
  onGroupDragStart,
  onGroupDragEnd,
  onGroupDragOver,
  onGroupDragLeave,
  onGroupDrop
}) => {
  const { t } = useLanguage();
  const isDropDisabled = groupId === 'all' || groupId === 'personal';
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: isDropDisabled
  });
  const [isHtml5Over, setIsHtml5Over] = useState(false);

  const isOverNow = (isOver || isHtml5Over) && !isDropDisabled;

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      draggable={isReorderable}
      onDragStart={(e) => {
        if (onGroupDragStart) onGroupDragStart(e);
      }}
      onDragEnd={(e) => {
        if (onGroupDragEnd) onGroupDragEnd(e);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/myerp-group-id')) {
          e.preventDefault();
          if (onGroupDragOver) onGroupDragOver(e);
          return;
        }
        if (!isDropDisabled) {
          e.preventDefault();
          setIsHtml5Over(true);
        }
      }}
      onDragLeave={(e) => {
        if (onGroupDragLeave) onGroupDragLeave(e);
        setIsHtml5Over(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.types.includes('text/myerp-group-id') || e.dataTransfer.getData('text/myerp-group-id')) {
          e.preventDefault();
          if (onGroupDrop) onGroupDrop(e);
          return;
        }
        e.preventDefault();
        setIsHtml5Over(false);
        if (!isDropDisabled && onDropTaskOnGroup && draggedTaskId) {
          onDropTaskOnGroup(Number(draggedTaskId), groupId === 'unassigned' ? null : Number(groupId));
        }
      }}
      style={{
        minWidth: isMobile ? '150px' : '185px',
        maxWidth: '220px',
        padding: '10px 12px',
        borderRadius: '12px',
        background: '#ffffff',
        border: isOverNow
          ? `2px solid ${color}`
          : isDragOverTarget
          ? `2px dashed var(--color-primary, #BD1D2D)`
          : isSelected
          ? `2px solid ${color}`
          : isPinned
          ? `1.5px solid #f59e0b`
          : '1px solid #e2e8f0',
        boxShadow: isOverNow
          ? `0 0 0 4px ${color}25, 0 10px 25px -5px ${color}35`
          : isDragOverTarget
          ? `0 0 0 4px rgba(189, 29, 45, 0.15)`
          : isSelected
          ? `0 4px 14px ${color}22`
          : isPinned
          ? '0 2px 8px rgba(245, 158, 11, 0.15)'
          : '0 1px 3px rgba(0, 0, 0, 0.05)',
        opacity: isDraggingGroup ? 0.45 : 1,
        transform: isOverNow ? 'scale(1.03)' : isDragOverTarget ? 'scale(1.02)' : 'none',
        cursor: isReorderable ? 'grab' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '8px',
        flexShrink: 0,
        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative'
      }}
      onMouseEnter={e => {
        if (!isSelected && !isOverNow && !isDragOverTarget) {
          e.currentTarget.style.borderColor = isPinned ? '#f59e0b' : color;
          e.currentTarget.style.boxShadow = isPinned ? '0 3px 12px rgba(245, 158, 11, 0.25)' : `0 3px 10px ${color}15`;
        }
      }}
      onMouseLeave={e => {
        if (!isSelected && !isOverNow && !isDragOverTarget) {
          e.currentTarget.style.borderColor = isPinned ? '#f59e0b' : '#e2e8f0';
          e.currentTarget.style.boxShadow = isPinned ? '0 2px 8px rgba(245, 158, 11, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.05)';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {isReorderable && (
            <div
              style={{
                cursor: 'grab',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                padding: '2px 0',
                transition: 'color 0.15s'
              }}
              title={t('Nắm kéo để đổi thứ tự nhóm')}
              onMouseEnter={e => e.currentTarget.style.color = '#475569'}
              onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
            >
              <GripVertical size={13} />
            </div>
          )}
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '7px',
            background: `${color}18`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <IconComp size={14} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            color: '#64748b'
          }}>
            {showProgress ? `${completedTasks}/${totalTasks}` : `${Math.max(0, totalTasks - completedTasks)}`}
          </span>
          {onTogglePin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              title={isPinned ? t('Bỏ ghim nhóm') : t('Ghim nhóm lên đầu')}
              style={{
                background: isPinned ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                border: 'none',
                color: isPinned ? '#f59e0b' : '#94a3b8',
                cursor: 'pointer',
                padding: '3px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                if (!isPinned) e.currentTarget.style.color = '#f59e0b';
              }}
              onMouseLeave={e => {
                if (!isPinned) e.currentTarget.style.color = '#94a3b8';
              }}
            >
              <Star size={13} fill={isPinned ? '#f59e0b' : 'none'} strokeWidth={isPinned ? 0 : 2} />
            </button>
          )}
          {childrenMenu}
        </div>
      </div>

      <div>
        <div style={{
          fontSize: '0.8rem',
          fontWeight: 800,
          color: '#0f172a',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {title}
        </div>
        {showProgress && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <div style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              background: '#f1f5f9',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                borderRadius: '2px',
                background: color,
                transition: 'width 0.3s ease'
              }} />
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>
              {progress}%
            </span>
          </div>
        )}
      </div>

      {/* Visual Droppable Indicator when hovering a dragged task over this card */}
      {isOverNow && (
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '10px',
          background: `${color}0D`,
          border: `2px dashed ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 10,
          animation: 'fadeIn 0.15s ease'
        }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            color: color,
            background: '#ffffff',
            padding: '3px 10px',
            borderRadius: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Inbox size={12} />
            {t('Thả vào nhóm')}
          </span>
        </div>
      )}
    </div>
  );
};

interface TaskGroupSectionProps {
  groups: TaskGroup[];
  summary: TaskGroupsSummary | null;
  activeGroupId: string | number; // 'all' | 'unassigned' | number
  onSelectGroup: (groupId: string | number) => void;
  onCreateGroup: (data: { name: string; color: string; icon: string } | any) => Promise<any>;
  onUpdateGroup: (id: number, data: { name: string; color: string; icon: string } | any) => Promise<any>;
  onDeleteGroup: (id: number) => Promise<any>;
  onTogglePinGroup?: (id: number) => Promise<any>;
  onReorderGroups?: (orderIds: number[]) => Promise<any>;
  onDropTaskOnGroup?: (taskId: number, targetGroupId: number | null) => void;
  draggedTaskId?: number | null;
  isLightText?: boolean;
  theme?: string;
  isMobile?: boolean;
  showProgress?: boolean;
  showCreateModal?: boolean;
  setShowCreateModal?: (show: boolean) => void;
}

export const TaskGroupSection: React.FC<TaskGroupSectionProps> = ({
  groups,
  summary,
  activeGroupId,
  onSelectGroup,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onTogglePinGroup,
  onReorderGroups,
  onDropTaskOnGroup,
  draggedTaskId,
  isLightText = false,
  theme = 'light',
  isMobile = false,
  showProgress = true,
  showCreateModal = false,
  setShowCreateModal
}) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedGroupId, setDraggedGroupId] = useState<number | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingGroup, setEditingGroup] = useState<TaskGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState(PRESET_COLORS[0]);
  const [groupIcon, setGroupIcon] = useState('Folder');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  React.useEffect(() => {
    if (showCreateModal) {
      openCreateModal();
      if (setShowCreateModal) setShowCreateModal(false);
    }
  }, [showCreateModal]);

  const openCreateModal = () => {
    setGroupName('');
    setGroupColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setGroupIcon('Folder');
    setEditingGroup(null);
    setModalMode('create');
  };

  const openEditModal = (group: TaskGroup) => {
    setGroupName(group.name);
    setGroupColor(group.color || PRESET_COLORS[0]);
    setGroupIcon(group.icon || 'Folder');
    setEditingGroup(group);
    setModalMode('edit');
    setActiveMenuId(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setGroupName('');
    setEditingGroup(null);
    setIsSubmitting(false);
    if (setShowCreateModal) setShowCreateModal(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = groupName.trim();
    if (!trimmedName || isSubmitting) return;

    setIsSubmitting(true);
    const mode = modalMode;
    const editing = editingGroup;
    const color = groupColor;
    const icon = groupIcon;

    closeModal();

    try {
      if (mode === 'create') {
        await onCreateGroup({ name: trimmedName, color, icon });
      } else if (mode === 'edit' && editing) {
        await onUpdateGroup(editing.id, { name: trimmedName, color, icon });
      }
    } catch (err) {
      console.error('Save task group error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async (id: number) => {
    try {
      await onDeleteGroup(id);
      setDeletingId(null);
      if (activeGroupId === id) {
        onSelectGroup('all');
      }
    } catch {
      // Handled by caller
    }
  };

  const allStats = summary?.all || {
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
    progress_percent: 0
  };
  const allProgress = allStats.total_tasks > 0 
    ? Math.round((allStats.completed_tasks / allStats.total_tasks) * 100) 
    : 0;

  const unassignedStats = summary?.unassigned || {
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
    progress_percent: 0
  };
  const unassignedProgress = unassignedStats.total_tasks > 0 
    ? Math.round((unassignedStats.completed_tasks / unassignedStats.total_tasks) * 100) 
    : 0;

  const personalStats = summary?.personal || {
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
    progress_percent: 0
  };
  const personalProgress = personalStats.total_tasks > 0 
    ? Math.round((personalStats.completed_tasks / personalStats.total_tasks) * 100) 
    : 0;

  const handleLocalReorder = (fromId: number, toId: number) => {
    const fromIdx = groups.findIndex(g => g.id === fromId);
    const toIdx = groups.findIndex(g => g.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...groups];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    if (onReorderGroups) {
      onReorderGroups(next.map(g => g.id));
    }
  };

  const displayedGroups = groups.filter(g => {
    if (!searchQuery.trim()) return true;
    return g.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const isFilteredGroup = activeGroupId !== 'all';
  const isUnassigned = activeGroupId === 'unassigned';
  const isPersonal = activeGroupId === 'personal';
  const selectedGroup = !isUnassigned && !isPersonal && isFilteredGroup ? groups.find(g => Number(g.id) === Number(activeGroupId)) : null;
  const currentGroupName = isPersonal ? t('Công việc cá nhân') : (isUnassigned ? t('Chưa phân nhóm') : (selectedGroup?.name || t('Nhóm')));
  const currentGroupColor = isPersonal ? '#2563eb' : (isUnassigned ? '#64748b' : (selectedGroup?.color || '#BD1D2D'));
  const CurrentIconComp = isPersonal ? User : (isUnassigned ? Inbox : (selectedGroup ? (ICON_MAP[selectedGroup.icon] || Folder) : Folder));
  const currentTotal = isPersonal ? personalStats.total_tasks : (isUnassigned ? unassignedStats.total_tasks : (selectedGroup?.total_tasks || 0));
  const currentCompleted = isPersonal ? personalStats.completed_tasks : (isUnassigned ? unassignedStats.completed_tasks : (selectedGroup?.completed_tasks || 0));
  const currentProgress = currentTotal > 0 ? Math.round((currentCompleted / currentTotal) * 100) : 0;

  return (
    <div style={{ marginBottom: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
      {isFilteredGroup ? (
        /* Collapsed View */
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '8px 14px',
          borderRadius: '12px',
          background: isLightText ? 'rgba(255, 255, 255, 0.15)' : '#ffffff',
          backdropFilter: isLightText ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: isLightText ? 'blur(10px)' : 'none',
          border: isLightText ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid #e2e8f0',
          boxShadow: isLightText ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'all 0.2s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onSelectGroup('all')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '8px',
                border: isLightText ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid #cbd5e1',
                background: isLightText ? 'rgba(255, 255, 255, 0.22)' : '#f8fafc',
                color: isLightText ? '#ffffff' : '#0f172a',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isLightText ? 'rgba(255, 255, 255, 0.35)' : '#e2e8f0';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isLightText ? 'rgba(255, 255, 255, 0.22)' : '#f8fafc';
              }}
            >
              <ArrowLeft size={14} />
              <span>{t('Quay lại')}</span>
            </button>

            <div style={{ width: '1px', height: '18px', background: isLightText ? 'rgba(255,255,255,0.25)' : '#e2e8f0' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: isLightText ? 'rgba(255, 255, 255, 0.2)' : `${currentGroupColor}18`,
                color: isLightText ? '#ffffff' : currentGroupColor
              }}>
                <CurrentIconComp size={15} />
              </span>
              <span style={{
                fontSize: '0.84rem',
                fontWeight: 800,
                color: isLightText ? '#ffffff' : '#0f172a',
                textShadow: isLightText ? '0 1px 2px rgba(0,0,0,0.6)' : 'none'
              }}>
                {t('Đang xem nhóm:')}{' '}
                <span style={{ color: isLightText ? '#ffffff' : currentGroupColor }}>
                  {currentGroupName}
                </span>
              </span>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                background: isLightText ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.06)',
                color: isLightText ? '#ffffff' : '#475569'
              }}>
                {showProgress
                  ? `${currentCompleted}/${currentTotal} ${t('hoàn thành')} (${currentProgress}%)`
                  : `${Math.max(0, currentTotal - currentCompleted)} ${t('công việc cần làm')}`}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedGroup && (
              <button
                type="button"
                onClick={() => openEditModal(selectedGroup)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: isLightText ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid #e2e8f0',
                  background: isLightText ? 'rgba(255, 255, 255, 0.15)' : '#ffffff',
                  color: isLightText ? '#ffffff' : '#475569',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Edit2 size={12} style={{ color: currentGroupColor }} />
                <span>{t('Chỉnh sửa')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectGroup('all')}
              style={{
                border: 'none',
                background: 'transparent',
                color: isLightText ? 'rgba(255, 255, 255, 0.8)' : '#64748b',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {t('Mở danh sách các nhóm')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Header bar of Group Section */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: '0.65rem',
            padding: '0 2px',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            fontSize: '0.78rem', 
            fontWeight: 800, 
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: isLightText ? '#ffffff' : 'var(--color-text-muted, #475569)',
            textShadow: isLightText ? '0 1px 3px rgba(0,0,0,0.8)' : 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Folder size={14} style={{ color: '#BD1D2D' }} />
            {t('Gom nhóm công việc')}
          </span>
          <span style={{ 
            fontSize: '0.68rem', 
            fontWeight: 700, 
            background: isLightText ? 'rgba(255,255,255,0.2)' : 'rgba(189,29,45,0.1)', 
            color: isLightText ? '#ffffff' : 'var(--color-primary, #BD1D2D)', 
            padding: '1px 7px', 
            borderRadius: '10px' 
          }}>
            {groups.length} {t('nhóm')}
          </span>
        </div>

        {/* Right side: Search Box + Quick Add Group Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLightText && (
            <style>{`
              .task-group-search-translucent::placeholder {
                color: rgba(255, 255, 255, 0.7) !important;
              }
            `}</style>
          )}

          {/* Search Box */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Tìm nhóm...')}
              className={isLightText ? 'task-group-search-translucent' : ''}
              style={{
                padding: '4px 26px 4px 10px',
                borderRadius: '8px',
                border: isLightText ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid #e2e8f0',
                background: isLightText ? 'rgba(255, 255, 255, 0.15)' : '#ffffff',
                backdropFilter: isLightText ? 'blur(10px)' : 'none',
                WebkitBackdropFilter: isLightText ? 'blur(10px)' : 'none',
                color: isLightText ? '#ffffff' : '#0f172a',
                fontSize: '0.75rem',
                fontWeight: 600,
                width: isMobile ? '105px' : '135px',
                outline: 'none',
                boxShadow: isLightText ? '0 2px 8px rgba(0,0,0,0.18)' : '0 1px 2px rgba(0,0,0,0.04)',
                textShadow: isLightText ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = isLightText ? '#ffffff' : 'var(--color-primary, #BD1D2D)';
                if (isLightText) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                }
                if (!isMobile) e.currentTarget.style.width = '175px';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = isLightText ? 'rgba(255, 255, 255, 0.25)' : '#e2e8f0';
                if (isLightText) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }
                if (!isMobile && !searchQuery) e.currentTarget.style.width = '135px';
              }}
            />
            <Search size={13} style={{ 
              position: 'absolute', 
              right: '8px', 
              color: isLightText ? 'rgba(255, 255, 255, 0.75)' : '#94a3b8', 
              pointerEvents: 'none' 
            }} />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  background: 'transparent',
                  border: 'none',
                  color: isLightText ? 'rgba(255, 255, 255, 0.8)' : '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick Add Group Button */}
          <button
            type="button"
            onClick={openCreateModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 12px',
              borderRadius: '8px',
              border: isLightText ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid #e2e8f0',
              background: isLightText ? 'rgba(255, 255, 255, 0.18)' : '#ffffff',
              backdropFilter: isLightText ? 'blur(10px)' : 'none',
              WebkitBackdropFilter: isLightText ? 'blur(10px)' : 'none',
              color: isLightText ? '#ffffff' : '#0f172a',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isLightText ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
              textShadow: isLightText ? '0 1px 3px rgba(0,0,0,0.6)' : 'none'
            }}
            onMouseEnter={e => {
              if (isLightText) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)';
                e.currentTarget.style.borderColor = '#ffffff';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
              } else {
                e.currentTarget.style.borderColor = 'var(--color-primary, #BD1D2D)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(189, 29, 45, 0.15)';
              }
            }}
            onMouseLeave={e => {
              if (isLightText) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.28)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
              } else {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
              }
            }}
          >
            <Plus size={13} style={{ color: isLightText ? '#ffffff' : 'var(--color-primary, #BD1D2D)' }} />
            <span>{t('Tạo nhóm mới')}</span>
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Carousel */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '10px',
        overflowX: 'auto',
        paddingBottom: '6px',
        scrollbarWidth: 'thin',
        WebkitOverflowScrolling: 'touch'
      }}>
        {/* 1. Card "Tất cả công việc" */}
        <DroppableGroupCard
          id="group-all"
          groupId="all"
          isSelected={activeGroupId === 'all'}
          color="#BD1D2D"
          IconComp={Layers}
          title={t('Tất cả công việc')}
          completedTasks={allStats.completed_tasks}
          totalTasks={allStats.total_tasks}
          progress={allProgress}
          isMobile={isMobile}
          showProgress={showProgress}
          onSelect={() => onSelectGroup('all')}
          onDropTaskOnGroup={onDropTaskOnGroup}
          draggedTaskId={draggedTaskId}
        />

        {/* 2. Card "Công việc cá nhân" */}
        <DroppableGroupCard
          id="group-personal"
          groupId="personal"
          isSelected={(activeGroupId as any) === 'personal'}
          color="#2563eb"
          IconComp={User}
          title={t('Công việc cá nhân')}
          completedTasks={personalStats.completed_tasks}
          totalTasks={personalStats.total_tasks}
          progress={personalProgress}
          isMobile={isMobile}
          showProgress={showProgress}
          onSelect={() => onSelectGroup('personal')}
          onDropTaskOnGroup={onDropTaskOnGroup}
          draggedTaskId={draggedTaskId}
        />

        {/* Custom Group Cards */}
        {displayedGroups.map((grp) => {
          const isSelected = (activeGroupId as any) === grp.id;
          const color = grp.color || '#BD1D2D';
          const IconComp = ICON_MAP[grp.icon] || Folder;
          const total = grp.total_tasks || 0;
          const completed = grp.completed_tasks || 0;
          const progress = total > 0 ? Math.round((completed / total) * 100) : (grp.progress_percent || 0);
          const isPinned = grp.is_pinned === 1;

          return (
            <DroppableGroupCard
              key={grp.id}
              id={`group-${grp.id}`}
              groupId={grp.id}
              isSelected={isSelected}
              color={color}
              IconComp={IconComp}
              title={grp.name}
              completedTasks={completed}
              totalTasks={total}
              progress={progress}
              isMobile={isMobile}
              showProgress={showProgress}
              onSelect={() => onSelectGroup(grp.id)}
              onDropTaskOnGroup={onDropTaskOnGroup}
              draggedTaskId={draggedTaskId}
              isPinned={isPinned}
              onTogglePin={() => onTogglePinGroup?.(grp.id)}
              isReorderable={!searchQuery.trim()}
              isDraggingGroup={draggedGroupId === grp.id}
              isDragOverTarget={dragOverGroupId === grp.id}
              onGroupDragStart={(e) => {
                e.dataTransfer.setData('text/myerp-group-id', String(grp.id));
                e.dataTransfer.effectAllowed = 'move';
                setDraggedGroupId(grp.id);
              }}
              onGroupDragEnd={() => {
                setDraggedGroupId(null);
                setDragOverGroupId(null);
              }}
              onGroupDragOver={(e) => {
                if (draggedGroupId && draggedGroupId !== grp.id) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverGroupId !== grp.id) setDragOverGroupId(grp.id);
                }
              }}
              onGroupDragLeave={() => {
                if (dragOverGroupId === grp.id) setDragOverGroupId(null);
              }}
              onGroupDrop={(e) => {
                const fromIdStr = e.dataTransfer.getData('text/myerp-group-id');
                if (fromIdStr) {
                  e.preventDefault();
                  e.stopPropagation();
                  const fromId = Number(fromIdStr);
                  const toId = grp.id;
                  if (fromId && toId && fromId !== toId) {
                    handleLocalReorder(fromId, toId);
                  }
                  setDraggedGroupId(null);
                  setDragOverGroupId(null);
                }
              }}
              childrenMenu={(
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setActiveMenuId(activeMenuId === grp.id ? null : grp.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      padding: '2px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={t('Tùy chọn nhóm')}
                  >
                    <MoreVertical size={13} />
                  </button>

                  {activeMenuId === grp.id && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                        onClick={() => setActiveMenuId(null)}
                      />
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        right: 0,
                        zIndex: 100,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                        padding: '4px',
                        minWidth: '130px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onTogglePinGroup?.(grp.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'transparent',
                            color: isPinned ? '#f59e0b' : '#0f172a',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left'
                          }}
                          className="hover-bg"
                        >
                          <Star size={12} fill={isPinned ? '#f59e0b' : 'none'} style={{ color: '#f59e0b' }} />
                          <span>{isPinned ? t('Bỏ ghim nhóm') : t('Ghim lên đầu')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(grp)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'transparent',
                            color: '#0f172a',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left'
                          }}
                          className="hover-bg"
                        >
                          <Edit2 size={12} style={{ color: color }} />
                          <span>{t('Chỉnh sửa')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            setDeletingId(grp.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left'
                          }}
                          className="hover-bg"
                        >
                          <Trash2 size={12} />
                          <span>{t('Xóa nhóm')}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            />
          );
        })}

        {displayedGroups.length === 0 && searchQuery && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px dashed #e2e8f0',
            fontSize: '0.75rem',
            color: '#64748b',
            whiteSpace: 'nowrap'
          }}>
            {t('Không tìm thấy nhóm:')} "{searchQuery}"
          </div>
        )}

        {/* 3. Card "Chưa phân nhóm" */}
        <DroppableGroupCard
          id="group-unassigned"
          groupId="unassigned"
          isSelected={(activeGroupId as any) === 'unassigned'}
          color="#64748b"
          IconComp={Inbox}
          title={t('Chưa phân nhóm')}
          completedTasks={unassignedStats.completed_tasks}
          totalTasks={unassignedStats.total_tasks}
          progress={unassignedProgress}
          isMobile={isMobile}
          showProgress={showProgress}
          onSelect={() => onSelectGroup('unassigned')}
          onDropTaskOnGroup={onDropTaskOnGroup}
          draggedTaskId={draggedTaskId}
        />
      </div>
        </>
      )}

      {/* Modal Tạo / Sửa nhóm */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {modalMode && (
            <motion.div 
              key="task-group-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 100050,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                boxSizing: 'border-box'
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) closeModal();
              }}
            >
              <motion.div 
                key="task-group-modal-content"
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ 
                  duration: 0.24, 
                  ease: [0.16, 1, 0.3, 1] 
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  width: '100%',
                  maxWidth: '440px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                  border: '1px solid #e2e8f0',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  boxSizing: 'border-box',
                  maxHeight: '90vh',
                  overflowY: 'auto'
                }}
              >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                {modalMode === 'create' ? t('Tạo nhóm công việc mới') : t('Chỉnh sửa nhóm công việc')}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: 5, color: '#0f172a' }}>
                  {t('Tên nhóm công việc')} <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('Ví dụ: Dự án VIP, Việc gấp, Khách hàng, Hành chính...')}
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>
                  {t('Màu sắc nhận diện')}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {PRESET_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setGroupColor(c)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: c,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: groupColor === c ? '2.5px solid #ffffff' : 'none',
                        boxShadow: groupColor === c ? `0 0 0 2px ${c}` : 'none',
                        transition: 'box-shadow 0.15s ease'
                      }}
                    >
                      {groupColor === c && <Check size={14} color="#ffffff" strokeWidth={3} />}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>
                  {t('Biểu tượng (Icon)')}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {Object.keys(ICON_MAP).slice(0, 14).map(icKey => {
                    const Ic = ICON_MAP[icKey];
                    const isPicked = groupIcon === icKey;
                    return (
                      <div
                        key={icKey}
                        onClick={() => setGroupIcon(icKey)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isPicked ? `${groupColor}20` : '#f8fafc',
                          border: isPicked ? `2px solid ${groupColor}` : '1px solid #e2e8f0',
                          color: isPicked ? groupColor : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s ease'
                        }}
                      >
                        <Ic size={15} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: `${groupColor}20`,
                  color: groupColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {React.createElement(ICON_MAP[groupIcon] || Folder, { size: 16 })}
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{t('Xem trước:')}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>
                    {groupName.trim() || t('Tên nhóm mới')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: 'transparent',
                    color: '#0f172a',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {t('Hủy')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !groupName.trim()}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--color-primary, #BD1D2D)',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: isSubmitting || !groupName.trim() ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting || !groupName.trim() ? 0.6 : 1,
                    boxShadow: '0 2px 8px rgba(189, 29, 45, 0.35)'
                  }}
                >
                  {isSubmitting ? t('Đang lưu...') : (modalMode === 'create' ? t('Tạo nhóm') : t('Cập nhật'))}
                </button>
              </div>
            </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Modal Xác nhận xóa nhóm */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {deletingId !== null && (
            <motion.div 
              key="task-group-delete-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 100060,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                boxSizing: 'border-box'
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setDeletingId(null);
              }}
            >
              <motion.div 
                key="task-group-delete-content"
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 6 }}
                transition={{ 
                  duration: 0.22, 
                  ease: [0.16, 1, 0.3, 1] 
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  width: '100%',
                  maxWidth: '380px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                  border: '1px solid #e2e8f0',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-danger, #ef4444)' }}>
              {t('Xác nhận xóa nhóm công việc?')}
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
              {t('Xóa nhóm này sẽ đưa toàn bộ công việc hiện tại về trạng thái "Chưa phân nhóm". Công việc của bạn sẽ KHÔNG bị mất.')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: 'transparent',
                  color: '#0f172a',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {t('Giữ lại')}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deletingId)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-danger, #ef4444)',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {t('Đồng ý xóa')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )}
    </div>
  );
};

// Subcomponent: Quick Group Badge & Dropdown on individual task card
interface TaskGroupBadgeProps {
  task: any;
  groups: TaskGroup[];
  onAssignGroup: (taskId: number, groupId: number | null) => Promise<void>;
  onOpenCreateModal?: () => void;
  isLightText?: boolean;
}

export const TaskGroupBadge: React.FC<TaskGroupBadgeProps> = ({
  task,
  groups,
  onAssignGroup,
  onOpenCreateModal,
  isLightText = false
}) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentGroupId = task.task_group_id ? Number(task.task_group_id) : null;
  const currentGroup = groups.find(g => g.id === currentGroupId);
  const groupName = currentGroup?.name || task.task_group_name;
  const groupColor = currentGroup?.color || task.task_group_color || '#64748b';
  const groupIcon = currentGroup?.icon || task.task_group_icon || 'Folder';
  const IconComp = ICON_MAP[groupIcon] || Folder;

  const handleSelect = async (gId: number | null) => {
    setIsUpdating(true);
    try {
      await onAssignGroup(Number(task.id), gId);
      setIsOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={groupName ? `${t('Nhóm:')} ${groupName} (${t('Bấm để đổi')})` : t('Bấm để gom vào nhóm')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 7px',
          borderRadius: '12px',
          background: groupName ? `${groupColor}18` : (isLightText ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
          border: groupName ? `1px solid ${groupColor}40` : (isLightText ? '1px dashed rgba(255,255,255,0.3)' : '1px dashed var(--color-border, #e2e8f0)'),
          color: groupName ? groupColor : (isLightText ? '#cbd5e1' : 'var(--color-text-muted, #64748b)'),
          fontSize: '0.675rem',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'border-color 0.15s ease'
        }}
      >
        <IconComp size={10} style={{ color: groupColor }} />
        <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {groupName || t('+ Gom nhóm')}
        </span>
      </button>

      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 110 }} 
            onClick={() => setIsOpen(false)} 
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              zIndex: 120,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
              padding: '6px',
              minWidth: '160px',
              maxWidth: '220px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px'
            }}
          >
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', padding: '2px 6px', letterSpacing: '0.04em' }}>
              {t('Chuyển vào nhóm:')}
            </div>

            {/* Option: Chưa phân nhóm */}
            <div
              onClick={() => handleSelect(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 8px',
                borderRadius: '6px',
                background: !currentGroupId ? 'rgba(100, 116, 139, 0.12)' : 'transparent',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: !currentGroupId ? 700 : 500,
                color: '#0f172a'
              }}
              className="hover-bg"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Inbox size={12} style={{ color: '#64748b' }} />
                <span>{t('Chưa phân nhóm')}</span>
              </div>
              {!currentGroupId && <Check size={12} color="#64748b" />}
            </div>

            {/* Custom Groups */}
            {groups.map(g => {
              const isCurr = currentGroupId === g.id;
              const GIcon = ICON_MAP[g.icon] || Folder;
              return (
                <div
                  key={g.id}
                  onClick={() => handleSelect(g.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    background: isCurr ? `${g.color}18` : 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: isCurr ? 700 : 500,
                    color: isCurr ? g.color : '#0f172a'
                  }}
                  className="hover-bg"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <GIcon size={12} style={{ color: g.color }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.name}
                    </span>
                  </div>
                  {isCurr && <Check size={12} color={g.color} />}
                </div>
              );
            })}

            {/* Option: Tạo nhóm mới */}
            {onOpenCreateModal && (
              <div
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreateModal();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  color: 'var(--color-primary, #BD1D2D)',
                  borderTop: '1px dashed #e2e8f0',
                  marginTop: '2px',
                  paddingTop: '6px'
                }}
                className="hover-bg"
              >
                <Plus size={12} />
                <span>{t('Tạo nhóm mới...')}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
