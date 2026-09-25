import React, { Suspense } from 'react';
import {
  Search, Filter, AlertCircle, CheckCircle2, Clock, FileText,
  ShieldAlert, Send, ArrowLeft, ChevronLeft, ChevronRight,
  Database, RefreshCw, Layers, Plus, Building2, Users, User,
  UserCheck, Trash2, CheckSquare, X, Paperclip, LayoutGrid,
  Phone, Pin, Palette, BarChart3, Play, Sparkles, Check, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type SensorDescriptor,
  type SensorOptions
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CustomSelect } from '../ui/CustomSelect';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import { VietnameseDateInput } from '../ui/VietnameseDateInput';
import { Avatar } from '../ui/Avatar';
import { Pagination } from '../ui/Pagination';
import { Skeleton } from '../ui/Skeleton';
import { TaskGroupSection, TaskGroupBadge, type TaskGroup, type TaskGroupsSummary } from '../TaskGroups/TaskGroupSection';
import { WORKSPACE_INSPIRATIONAL_QUOTES } from '../../data/inspirationalQuotes';
import { parseTaskBody, extractCleanCardDescription, isTaskEffectivelyDone, getTaskEffectiveProgress } from '../../utils/taskBodyParser';

export interface WorkspaceViewProps {
  currentUser: any;
  user: any;
  displayUser?: any;
  isAdminOrManager: boolean;
  isTopAdmin: boolean;
  isSaleUser: boolean;
  teamsList: any[];
  users: any[];
  wsTasks: any[];
  filteredWsTasks: any[];
  paginatedWsTasks: any[];
  loadingWsTasks: boolean;
  workspaceStats: {
    overdue: number;
    dueToday: number;
    upcoming: number;
    pendingApproval: number;
    assignedToMe?: number;
    collaborator?: number;
  };
  wsViewMode: 'grid' | 'kanban' | 'focus';
  setWsViewMode: (mode: 'grid' | 'kanban' | 'focus') => void;
  wsSearch: string;
  setWsSearch: (val: string) => void;
  isWsSearchFocused: boolean;
  setIsWsSearchFocused: (val: boolean) => void;
  wsPriority: string;
  setWsPriority: (val: string) => void;
  wsStatus: string;
  setWsStatus: (val: string) => void;
  showDoneTasks: boolean;
  setShowDoneTasks: (updater: boolean | ((prev: boolean) => boolean)) => void;
  adminViewFull: boolean;
  setAdminViewFull: (updater: boolean | ((prev: boolean) => boolean)) => void;
  wsDatePreset: string;
  setWsDatePreset: (val: string) => void;
  wsStartDate: string;
  setWsStartDate: (val: string) => void;
  wsEndDate: string;
  setWsEndDate: (val: string) => void;
  wsTeamId: string;
  setWsTeamId: (val: string) => void;
  wsUserId: string;
  setWsUserId: (val: string) => void;
  wsActivityType: string;
  setWsActivityType: (val: string) => void;
  wsRelatedType: string;
  setWsRelatedType: (val: string) => void;
  wsSubTab: string;
  setWsSubTab: (val: any) => void;
  wsTaskFilter: any;
  setWsTaskFilter: (val: any) => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (updater: boolean | ((prev: boolean) => boolean)) => void;
  completedCallsCount: number;
  handleOpenCallsModal: () => void;
  hideWorkspaceAlerts: boolean;
  setHideWorkspaceAlerts: (val: boolean) => void;
  uncontactedCount: number;
  pendingCoopsCount: number;
  pendingCoopSlips: any[];
  upcomingMeetingsList: any[];
  handleStartFocusSession: () => void;
  setShowUpcomingMeetingsModal: (val: boolean) => void;
  setShowWorkspaceCustomizer: (val: boolean) => void;
  showWorkspaceCustomizer: boolean;
  setIsWorkspaceStatsModalOpen: (val: boolean) => void;
  setShowWorkspaceHelpModal: (val: boolean) => void;
  wsBg: string;
  wsCols: number;
  wsOverlay: number;
  sensors: any;
  customCollisionDetection: (args: any) => any;
  handleGridDragStart: (event: DragStartEvent) => void;
  handleGridDragEnd: (event: DragEndEvent) => void;
  enrichedTaskGroups: TaskGroup[];
  computedGroupSummary: TaskGroupsSummary;
  activeTaskGroupId: string | number;
  setActiveTaskGroupId: (id: string | number) => void;
  handleCreateTaskGroup: (data: any) => Promise<any>;
  handleUpdateTaskGroup: (id: number, data: any) => Promise<any>;
  handleDeleteTaskGroup: (id: number) => Promise<any>;
  handleTogglePinTaskGroup: (id: number) => Promise<any>;
  handleReorderTaskGroups: (orderIds: number[]) => Promise<any>;
  handleDropTaskOnGroup: (taskId: number, groupId: number | null) => Promise<void>;
  draggedTaskId: number | null;
  setDraggedTaskId: (id: number | null) => void;
  showCardCreateGroupModal: boolean;
  setShowCardCreateGroupModal: (val: boolean) => void;
  currentQuoteIdx: number;
  handlePrevQuote: () => void;
  handleShuffleQuote: () => void;
  handleNextQuote: () => void;
  pinnedTaskIds: number[];
  togglePinTask: (id: number) => void;
  getDueDateLabel: (dateStr: string | null | undefined, isDone: boolean, t: any) => string;
  parseDescriptionAndChecklist: (descText: string) => any;
  setChecklist: (cl: any) => void;
  setSelectedTaskForDetails: (task: any) => void;
  selectedTaskForDetails: any;
  handleOpenContactProfile: (id: number, tab?: string, initData?: any) => void;
  setSelectedTaskParticipants: (users: any[]) => void;
  setParticipantsModalOpen: (open: boolean) => void;
  taskGroups: TaskGroup[];
  handleAssignTaskGroup: (taskId: number, groupId: number | null) => Promise<void>;
  handleToggleTaskStatus: (taskId: number, e?: React.MouseEvent) => Promise<void>;
  completingTaskId: number | null;
  wsTasksPage: number;
  setWsTasksPage: (page: number) => void;
  wsTasksPageSize: number;
  activeOverCol: 'todo' | 'in_progress' | 'done' | null;
  setActiveOverCol: (col: 'todo' | 'in_progress' | 'done' | null) => void;
  handleTaskDrop: (taskId: number, targetCol: 'todo' | 'in_progress' | 'done') => Promise<void>;
  handleSelectTask: (task: any) => void;
  setIsFocusSessionActive: (val: boolean) => void;
  activeDragTask: any | null;
  SortableWorkspaceCard: React.FC<any>;
  WorkspaceCardInner: React.FC<any>;
  WorkspaceTaskDrawer: React.ComponentType<any>;
  fetchPortalTasks: () => void;
  fetchWorkspaceTasks: () => void;
  setShowTaskModal: (val: boolean) => void;
  isMobile: boolean;
  theme: string;
  t: (key: string) => string;
  navigate: (url: string) => void;
}

const formatVietnameseFullName = (nameStr: string) => {
  if (!nameStr || typeof nameStr !== 'string') return '';
  const parts = nameStr.trim().split(/\s+/);
  if (parts.length <= 1) return nameStr;
  const lastName = parts.pop();
  return `${lastName} ${parts.join(' ')}`;
};

export const WorkspaceView: React.FC<WorkspaceViewProps> = (props) => {
  const {
    currentUser, user, displayUser, isAdminOrManager, isTopAdmin, isSaleUser,
    teamsList, users, wsTasks, filteredWsTasks, paginatedWsTasks, loadingWsTasks,
    workspaceStats, wsViewMode, setWsViewMode, wsSearch, setWsSearch,
    isWsSearchFocused, setIsWsSearchFocused, wsPriority, setWsPriority,
    wsStatus, setWsStatus, showDoneTasks, setShowDoneTasks, adminViewFull,
    setAdminViewFull, wsDatePreset, setWsDatePreset, wsStartDate, setWsStartDate,
    wsEndDate, setWsEndDate, wsTeamId, setWsTeamId, wsUserId, setWsUserId,
    wsActivityType, setWsActivityType, wsRelatedType, setWsRelatedType,
    wsSubTab, setWsSubTab, wsTaskFilter, setWsTaskFilter, showAdvancedFilters,
    setShowAdvancedFilters, completedCallsCount, handleOpenCallsModal,
    hideWorkspaceAlerts, setHideWorkspaceAlerts, uncontactedCount, pendingCoopsCount,
    pendingCoopSlips, upcomingMeetingsList, handleStartFocusSession,
    setShowUpcomingMeetingsModal, setShowWorkspaceCustomizer, showWorkspaceCustomizer,
    setIsWorkspaceStatsModalOpen, setShowWorkspaceHelpModal, wsBg, wsCols, wsOverlay,
    sensors, customCollisionDetection, handleGridDragStart, handleGridDragEnd,
    enrichedTaskGroups, computedGroupSummary, activeTaskGroupId, setActiveTaskGroupId,
    handleCreateTaskGroup, handleUpdateTaskGroup, handleDeleteTaskGroup,
    handleTogglePinTaskGroup, handleReorderTaskGroups, handleDropTaskOnGroup,
    draggedTaskId, setDraggedTaskId, showCardCreateGroupModal, setShowCardCreateGroupModal,
    currentQuoteIdx, handlePrevQuote, handleShuffleQuote, handleNextQuote,
    pinnedTaskIds, togglePinTask, getDueDateLabel, parseDescriptionAndChecklist,
    setChecklist, setSelectedTaskForDetails, selectedTaskForDetails,
    handleOpenContactProfile, setSelectedTaskParticipants, setParticipantsModalOpen,
    taskGroups, handleAssignTaskGroup, handleToggleTaskStatus, completingTaskId,
    wsTasksPage, setWsTasksPage, wsTasksPageSize, activeOverCol, setActiveOverCol,
    handleTaskDrop, handleSelectTask, setIsFocusSessionActive, activeDragTask,
    SortableWorkspaceCard, WorkspaceCardInner, WorkspaceTaskDrawer,
    fetchPortalTasks, fetchWorkspaceTasks, setShowTaskModal,
    isMobile, theme, t, navigate
  } = props;

  const teamOptions = [
    { value: '', label: t('Tất cả Nhóm') },
    ...teamsList.map((tm: any) => ({ value: String(tm.id), label: tm.name }))
  ];

  const consultantOptions = [
    { value: '', label: t('Tất cả Nhân viên') },
    ...users.map((u: any) => ({ value: String(u.id), label: u.full_name || u.username, avatar: u.avatar || u.avatar_url }))
  ];

  const handleCreateTask = () => {
    setSelectedTaskForDetails({
      id: 'new',
      subject: '',
      priority: 'medium',
      due_date: null,
      description: '',
      link: '',
      user_id: String(user?.id || ''),
      progress: 0,
      require_approval: 0,
      approver_id: '',
      tags: wsSubTab === 'personal' ? 'personal_task' : '',
      internal_type: wsSubTab === 'team' ? 'task' : '',
      scope: wsSubTab === 'team' ? 'team' : '',
      participant_ids: '',
      related_contact_ids: [],
      checklist: [],
      project_id: '',
      campaign_id: '',
      team_id: '',
      campaign_target: ''
    });
  };

  return (
    <div 
      className="workspace-custom-wrapper"
      style={{ 
        position: 'relative',
        borderRadius: '0',
        display: 'flex', 
        flexDirection: 'column', 
        gap: wsViewMode === 'focus' ? '0' : '1rem', 
        padding: isMobile ? '12px 14px' : '1.5rem 2.5rem',
        paddingBottom: wsViewMode === 'focus' ? '0' : (isMobile ? '120px' : '200px'),
        height: wsViewMode === 'focus' ? 'calc(100vh - 120px)' : 'auto',
        minHeight: wsBg ? 'calc(100vh - 120px)' : 'auto',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        background: 'transparent',
        transition: 'all 0.3s ease'
      }}>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: wsViewMode === 'focus' ? '0' : '1rem', width: '100%' }}>
      {wsViewMode !== 'focus' && (
        <>
          {/* Workspace Header */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '6px',
            marginBottom: isMobile ? '2px' : '0.25rem',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {/* Row 1: Title + Info Button + Completed Calls + Action Button */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              width: '100%',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <h1 className="page-title" style={{ 
                  margin: 0, 
                  fontSize: isMobile ? '1.15rem' : '1.35rem', 
                  fontWeight: 800, 
                  whiteSpace: 'nowrap', 
                  flexShrink: 0,
                  padding: '2px 4px',
                  color: wsBg ? '#ffffff' : 'var(--color-text)',
                  textShadow: wsBg ? '0 1px 3px rgba(0, 0, 0, 0.7), 0 2px 6px rgba(0, 0, 0, 0.4)' : 'none'
                }}>
                  {t("Bàn làm việc")}
                </h1>
                
                {/* Completed Calls Count Pill */}
                {isSaleUser && !isMobile && (
                  <div 
                    onClick={handleOpenCallsModal}
                    className="hover-lift"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: wsBg ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.08)',
                      border: wsBg ? '1px solid rgba(52, 211, 153, 0.5)' : '1px solid rgba(16, 185, 129, 0.15)',
                      backdropFilter: wsBg ? 'blur(8px)' : 'none',
                      WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: wsBg ? '#a7f3d0' : '#10b981',
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      height: '24px',
                      flexShrink: 0,
                      textShadow: wsBg ? '0 1px 3px rgba(0,0,0,0.7)' : 'none'
                    }}
                  >
                    <Phone size={10} style={{ flexShrink: 0 }} />
                    <span>
                      {t('Đã gọi:')} <strong>{completedCallsCount}</strong>
                    </span>
                  </div>
                )}

                {/* Show alerts toggler when hidden */}
                {hideWorkspaceAlerts && (
                  (() => {
                    const hasUncontacted = uncontactedCount > 0 && isSaleUser;
                    const hasCoops = pendingCoopsCount > 0;
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const uid = user?.id ? Number(user.id) : 0;
                    const isMyTask = (tItem: any) => {
                      if (!uid) return false;
                      const assignee = Number(tItem.assignee_id || tItem.user_id || 0);
                      return assignee === uid;
                    };
                    const myOverdueCount = (wsTasks || []).filter((tItem: any) => tItem.status !== 'done' && isMyTask(tItem) && tItem.due_date && tItem.due_date.slice(0, 10) < todayStr).length;
                    const myDueTodayCount = (wsTasks || []).filter((tItem: any) => tItem.status !== 'done' && isMyTask(tItem) && tItem.due_date && tItem.due_date.slice(0, 10) === todayStr).length;
                    const myHighPriorityTask = (wsTasks || []).find((tItem: any) => tItem.status !== 'done' && isMyTask(tItem) && (tItem.priority === 'high' || tItem.priority === 'urgent'));
                    const totalOverdueCount = workspaceStats.overdue || 0;
                    const totalDueTodayCount = workspaceStats.dueToday || 0;
                    const teamHighPriorityTask = (wsTasks || []).find((tItem: any) => tItem.status !== 'done' && (tItem.priority === 'high' || tItem.priority === 'urgent'));

                    let aiCount = 0;
                    if (myOverdueCount > 0) aiCount = myOverdueCount;
                    else if (myHighPriorityTask) aiCount = 1;
                    else if (myDueTodayCount > 0) aiCount = myDueTodayCount;
                    else if (totalOverdueCount > 0) aiCount = totalOverdueCount;
                    else if (teamHighPriorityTask) aiCount = 1;
                    else if (totalDueTodayCount > 0) aiCount = totalDueTodayCount;

                    const meetingCount = upcomingMeetingsList.length;
                    const hasAnyAlert = hasUncontacted || hasCoops || aiCount > 0 || meetingCount > 0;

                    if (!hasAnyAlert) return null;
                    return (
                      <button
                        onClick={() => setHideWorkspaceAlerts(false)}
                        style={{
                          background: wsBg ? 'rgba(255, 255, 255, 0.2)' : 'rgba(189, 29, 45, 0.06)',
                          border: wsBg ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid rgba(189, 29, 45, 0.2)',
                          backdropFilter: wsBg ? 'blur(10px)' : 'none',
                          WebkitBackdropFilter: wsBg ? 'blur(10px)' : 'none',
                          padding: '2px 9px',
                          borderRadius: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          color: wsBg ? '#ffffff' : 'var(--color-primary, #BD1D2D)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          height: '24px',
                          flexShrink: 0,
                          transition: 'all 0.15s',
                          boxShadow: wsBg ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
                          textShadow: wsBg ? '0 1px 3px rgba(0,0,0,0.7)' : 'none'
                        }}
                        className="hover-lift"
                        title={t('Hiện lại gợi ý xử lý')}
                      >
                        <Sparkles size={11} style={{ color: '#ef4444' }} />
                        <span>{t('Gợi ý')}</span>
                      </button>
                    );
                  })()
                )}
              </div>

              {/* Top Right Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {/* Ô tìm kiếm chuyển lên trên cạnh Chế độ tập trung (Desktop only) */}
                {!isMobile && (
                  <div style={{ 
                    position: 'relative', 
                    width: isWsSearchFocused ? '400px' : '340px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxSizing: 'border-box'
                  }}>
                    <input
                      type="text"
                      className="ws-search-input"
                      placeholder={t('Tìm theo tên, mô tả...')}
                      value={wsSearch}
                      onChange={e => setWsSearch(e.target.value)}
                      onFocus={() => setIsWsSearchFocused(true)}
                      onBlur={() => setIsWsSearchFocused(false)}
                      style={{ 
                        height: '38px', 
                        minHeight: '38px',
                        maxHeight: '38px',
                        lineHeight: '38px',
                        fontSize: '0.85rem', 
                        padding: wsSearch ? '0 46px 0 14px' : '0 36px 0 14px', 
                        borderRadius: '10px', 
                        width: '100%',
                        boxSizing: 'border-box',
                        border: isWsSearchFocused 
                          ? '1.5px solid var(--color-primary, #BD1D2D)' 
                          : (wsBg ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid var(--color-border)'),
                        background: wsBg 
                          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.1) 100%)' 
                          : 'var(--color-surface)',
                        color: wsBg ? '#ffffff' : 'var(--color-text)',
                        textShadow: wsBg ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
                        backdropFilter: wsBg ? 'blur(12px)' : 'none',
                        WebkitBackdropFilter: wsBg ? 'blur(12px)' : 'none',
                        boxShadow: wsBg ? '0 4px 16px rgba(0, 0, 0, 0.3)' : 'none',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                      }}
                    />
                    <Search 
                      size={15} 
                      style={{ 
                        position: 'absolute', 
                        right: wsSearch ? '28px' : '12px', 
                        top: '50%', 
                        transform: isWsSearchFocused 
                          ? 'translateY(-50%) rotate(15deg) scale(1.15)' 
                          : 'translateY(-50%) rotate(0deg) scale(1)', 
                        color: wsBg ? '#ffffff' : 'var(--color-text-muted)', 
                        pointerEvents: 'none',
                        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                        filter: wsBg ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' : 'none'
                      }} 
                    />
                    {wsSearch && (
                      <button
                        type="button"
                        onClick={() => setWsSearch('')}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          padding: '2px',
                          cursor: 'pointer',
                          color: wsBg ? '#ffffff' : 'var(--color-text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '50%',
                          transition: 'transform 0.15s ease, color 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = 'var(--color-primary, #BD1D2D)';
                          e.currentTarget.style.transform = 'translateY(-50%) scale(1.15)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = wsBg ? '#ffffff' : 'var(--color-text-muted)';
                          e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}

                {/* Nút Thống Kê Công Việc */}
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setShowDoneTasks(true);
                    setWsStatus('all');
                    setIsWorkspaceStatsModalOpen(true);
                  }}
                  title={t('Báo cáo & Thống kê công việc')}
                  style={{
                    background: wsBg 
                      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.1) 100%)' 
                      : 'rgba(189, 29, 45, 0.06)',
                    border: wsBg ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(189, 29, 45, 0.25)',
                    backdropFilter: wsBg ? 'blur(12px)' : 'none',
                    WebkitBackdropFilter: wsBg ? 'blur(12px)' : 'none',
                    color: wsBg ? '#ffffff' : 'var(--color-primary, #BD1D2D)',
                    textShadow: wsBg ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    borderRadius: '10px',
                    padding: isMobile ? '0 10px' : '0 14px',
                    height: '38px',
                    boxSizing: 'border-box',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: wsBg ? '0 4px 16px rgba(0, 0, 0, 0.3)' : 'none',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = wsBg ? 'rgba(255, 255, 255, 0.32)' : 'rgba(189, 29, 45, 0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = wsBg ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.1) 100%)' : 'rgba(189, 29, 45, 0.06)'; }}
                >
                  <BarChart3 size={15} style={{ color: wsBg ? '#ffffff' : 'var(--color-primary, #BD1D2D)' }} />
                  {!isMobile && <span>{t('Thống kê')}</span>}
                </button>

                {!isMobile && (
                  <button
                    className="btn secondary"
                    onClick={handleStartFocusSession}
                    style={{
                      background: wsBg ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.1) 100%)' : 'rgba(189, 29, 45, 0.06)',
                      border: wsBg ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(189, 29, 45, 0.25)',
                      backdropFilter: wsBg ? 'blur(12px)' : 'none',
                      WebkitBackdropFilter: wsBg ? 'blur(12px)' : 'none',
                      color: wsBg ? '#ffffff' : 'var(--color-primary, #BD1D2D)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      borderRadius: '10px',
                      padding: '0 14px',
                      height: '38px',
                      boxSizing: 'border-box',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: wsBg ? '0 4px 16px rgba(0, 0, 0, 0.3)' : 'none',
                      textShadow: wsBg ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = wsBg ? 'rgba(255, 255, 255, 0.32)' : 'rgba(189, 29, 45, 0.12)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = wsBg ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.1) 100%)' : 'rgba(189, 29, 45, 0.06)'; }}
                  >
                    <Play size={14} />
                    <span>{t('Chế độ tập trung')}</span>
                  </button>
                )}

                <button 
                  className="btn primary" 
                  style={{ 
                    background: 'var(--color-primary, #BD1D2D)', 
                    borderColor: 'var(--color-primary, #BD1D2D)',
                    height: '38px',
                    padding: isMobile ? '0 12px' : '0 16px',
                    borderRadius: '10px',
                    fontSize: isMobile ? '0.78rem' : '0.85rem',
                    fontWeight: 700,
                    boxSizing: 'border-box',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    border: wsBg ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid var(--color-primary, #BD1D2D)',
                    boxShadow: wsBg ? '0 4px 16px rgba(189, 29, 45, 0.5), 0 2px 8px rgba(0,0,0,0.3)' : '0 2px 6px rgba(189, 29, 45, 0.2)'
                  }}
                  onClick={handleCreateTask}
                >
                  <Plus size={14} /> <span>{isMobile ? t('Tạo việc') : t('Tạo công việc')}</span>
                </button>
              </div>
            </div>
            
            {/* Mobile Search Bar - Dedicated Full Width Row */}
            {isMobile && (
              <div style={{ 
                position: 'relative', 
                width: '100%',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box',
                marginTop: '4px'
              }}>
                <input
                  type="text"
                  className="ws-search-input"
                  placeholder={t('Tìm việc theo tên, mô tả...')}
                  value={wsSearch}
                  onChange={e => setWsSearch(e.target.value)}
                  onFocus={() => setIsWsSearchFocused(true)}
                  onBlur={() => setIsWsSearchFocused(false)}
                  style={{ 
                    height: '36px', 
                    minHeight: '36px',
                    maxHeight: '36px',
                    lineHeight: '36px',
                    fontSize: '0.825rem', 
                    padding: wsSearch ? '0 44px 0 14px' : '0 34px 0 14px', 
                    borderRadius: '10px', 
                    width: '100%',
                    boxSizing: 'border-box',
                    border: isWsSearchFocused 
                      ? '1.5px solid var(--color-primary, #BD1D2D)' 
                      : (wsBg ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid var(--color-border)'),
                    background: wsBg 
                      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.1) 100%)' 
                      : 'var(--color-surface)',
                    color: wsBg ? '#ffffff' : 'var(--color-text)',
                    textShadow: wsBg ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
                    backdropFilter: wsBg ? 'blur(12px)' : 'none',
                    WebkitBackdropFilter: wsBg ? 'blur(12px)' : 'none',
                    boxShadow: wsBg ? '0 4px 16px rgba(0, 0, 0, 0.3)' : 'none',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                />
                <Search 
                  size={14} 
                  style={{ 
                    position: 'absolute', 
                    right: wsSearch ? '28px' : '10px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: wsBg ? '#ffffff' : 'var(--color-text-muted)', 
                    pointerEvents: 'none'
                  }} 
                />
                {wsSearch && (
                  <button
                    type="button"
                    onClick={() => setWsSearch('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      cursor: 'pointer',
                      color: wsBg ? '#ffffff' : 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '50%'
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
            
            {/* Row 2: Subtitle or Group Breadcrumb */}
            {((isAdminOrManager && wsTeamId && wsSubTab !== 'personal')) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', boxSizing: 'border-box' }}>
                <button
                  onClick={() => setWsTeamId('')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    border: wsBg ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--color-border)',
                    background: wsBg ? 'rgba(255, 255, 255, 0.18)' : 'var(--color-surface)',
                    backdropFilter: wsBg ? 'blur(8px)' : 'none',
                    WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                    color: wsBg ? '#ffffff' : 'var(--color-text-light)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    transition: 'all 0.15s',
                    flexShrink: 0,
                    textShadow: wsBg ? '0 1px 3px rgba(0,0,0,0.6)' : 'none'
                  }}
                  className="hover-lift"
                >
                  <ArrowLeft size={11} /> {t('Quay lại')}
                </button>
                <span style={{ fontSize: '0.725rem', color: wsBg ? '#e2e8f0' : 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: wsBg ? '0 1px 3px rgba(0,0,0,0.7)' : 'none' }}>
                  <span>{t('Đang xem nhóm:')}</span>
                  <strong style={{ color: wsBg ? '#fbbf24' : 'var(--color-primary, #BD1D2D)', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: wsBg ? '0 1px 4px rgba(0,0,0,0.8), 0 0 10px rgba(251, 191, 36, 0.4)' : 'none' }}>
                    {wsTeamId === 'all_teams_bypass' ? t('Tất cả các Nhóm') : (teamsList.find(tItem => String(tItem.id) === wsTeamId)?.name || wsTeamId)}
                  </strong>
                </span>
              </div>
            ) : (
              !isMobile && (
                <p className="page-subtitle" style={{ fontSize: '0.825rem', color: wsBg ? '#e2e8f0' : 'var(--color-text-muted)', margin: 0, textShadow: wsBg ? '0 1px 3px rgba(0,0,0,0.7)' : 'none' }}>
                  {t("Quản lý toàn bộ công việc cần thực hiện, lọc chi tiết theo tiến độ và độ ưu tiên.")}
                </p>
              )
            )}
          </div>

          {/* Unified Alert & Suggestion Center */}
          {(() => {
            const hasUncontacted = uncontactedCount > 0 && isSaleUser;
            const hasCoops = pendingCoopsCount > 0;
            
            const todayStr = new Date().toISOString().slice(0, 10);
            const uid = currentUser?.id ? Number(currentUser.id) : 0;
            const isMyTask = (tItem: any) => {
              if (!uid) return false;
              const assignee = Number(tItem.assignee_id || tItem.user_id || 0);
              return assignee === uid;
            };
            const myOverdueCount = (wsTasks || []).filter((tItem: any) => tItem.status !== 'done' && isMyTask(tItem) && tItem.due_date && tItem.due_date.slice(0, 10) < todayStr).length;
            const myDueTodayCount = (wsTasks || []).filter((tItem: any) => tItem.status !== 'done' && isMyTask(tItem) && tItem.due_date && tItem.due_date.slice(0, 10) === todayStr).length;
            const myHighPriorityTask = (wsTasks || []).find((tItem: any) => tItem.status !== 'done' && isMyTask(tItem) && (tItem.priority === 'high' || tItem.priority === 'urgent'));
            const totalOverdueCount = workspaceStats.overdue || 0;
            const totalDueTodayCount = workspaceStats.dueToday || 0;
            const teamHighPriorityTask = (wsTasks || []).find((tItem: any) => tItem.status !== 'done' && (tItem.priority === 'high' || tItem.priority === 'urgent'));

            // Calculate AI Priority Message
            let aiCount = 0;
            let aiMessage: React.ReactNode = '';
            if (myOverdueCount > 0) {
              aiCount = myOverdueCount;
              aiMessage = (
                <>
                  Hôm nay bạn có <strong style={{ color: 'var(--color-primary, #BD1D2D)', fontWeight: 800 }}>{myOverdueCount}</strong> công việc quá hạn cần xử lý gấp.
                </>
              );
            } else if (myHighPriorityTask) {
              aiCount = 1;
              aiMessage = (
                <>
                  Bạn có công việc ưu tiên cao (<strong style={{ fontWeight: 800 }}>{myHighPriorityTask.subject || 'Nhiệm vụ quan trọng'}</strong>) cần xử lý.
                </>
              );
            } else if (myDueTodayCount > 0) {
              aiCount = myDueTodayCount;
              aiMessage = (
                <>
                  Hôm nay bạn có <strong style={{ color: 'var(--color-primary, #BD1D2D)', fontWeight: 800 }}>{myDueTodayCount}</strong> công việc đến hạn cần hoàn thành.
                </>
              );
            } else if (totalOverdueCount > 0) {
              aiCount = totalOverdueCount;
              aiMessage = (
                <>
                  Toàn đội ngũ hiện có <strong style={{ color: 'var(--color-primary, #BD1D2D)', fontWeight: 800 }}>{totalOverdueCount}</strong> công việc quá hạn cần đôn đốc.
                </>
              );
            } else if (teamHighPriorityTask) {
              aiCount = 1;
              aiMessage = (
                <>
                  Có công việc ưu tiên cao của đội ngũ (<strong style={{ fontWeight: 800 }}>{teamHighPriorityTask.subject || 'Nhiệm vụ quan trọng'}</strong>) cần theo dõi.
                </>
              );
            } else if (totalDueTodayCount > 0) {
              aiCount = totalDueTodayCount;
              aiMessage = (
                <>
                  Hôm nay toàn đội ngũ có <strong style={{ color: 'var(--color-primary, #BD1D2D)', fontWeight: 800 }}>{totalDueTodayCount}</strong> công việc đến hạn cần hoàn thành.
                </>
              );
            } else {
              aiMessage = t('Hệ thống vận hành tối ưu. Các công việc hiện được sắp xếp đúng kế hoạch.');
            }

            const meetingCount = upcomingMeetingsList.length;

            const hasAnyAlert = hasUncontacted || hasCoops || aiCount > 0 || meetingCount > 0;
            if (!hasAnyAlert || hideWorkspaceAlerts) return null;

            const actionBtnStyle = {
              height: '30px',
              borderRadius: '20px',
              border: 'none',
              padding: '0 12px',
              fontSize: '0.725rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s',
              flexShrink: 0,
              marginLeft: 'auto'
            };

            return (
              <div style={{
                background: wsBg ? (theme === 'dark' ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.88)') : 'var(--color-surface)',
                backdropFilter: wsBg ? 'blur(16px)' : 'none',
                WebkitBackdropFilter: wsBg ? 'blur(16px)' : 'none',
                border: wsBg ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid var(--color-border-light)',
                borderRadius: '12px',
                padding: isMobile ? '10px 12px' : '10px 16px',
                marginBottom: '0.75rem',
                boxShadow: wsBg ? '0 8px 32px 0 rgba(0, 0, 0, 0.25)' : 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: wsBg ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--color-border-light)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} style={{ color: '#ef4444' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#ef4444' }}>
                      {t('Cảnh báo & Gợi ý xử lý')}
                    </span>
                  </div>
                  <button
                    onClick={() => setHideWorkspaceAlerts(true)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: wsBg ? '#cbd5e1' : 'var(--color-text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s'
                    }}
                    className="hover-color-primary"
                    title={t('Tạm ẩn gợi ý')}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Alert Items Stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* 1. Uncontacted leads alert */}
                  {hasUncontacted && ['sale', 'sales'].includes(String(user?.role || displayUser?.role || '').toLowerCase()) && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <AlertCircle size={15} />
                        </div>
                        <span style={{ fontSize: isMobile ? '0.78rem' : '0.825rem', color: 'var(--color-text)', lineHeight: 1.35, wordBreak: 'break-word' }}>
                          {t('Yêu cầu liên hệ khách hàng mới: ')}
                          <strong style={{ color: '#ef4444', fontWeight: 800 }}>{uncontactedCount}</strong>
                          {t(' data chưa liên hệ.')}
                        </span>
                      </div>
                      <button
                        onClick={() => navigate('/contacts?status=not_contacted')}
                        style={{
                          ...actionBtnStyle,
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#ef4444'
                        }}
                        className="hover-lift"
                      >
                        {t('Xem ngay')} <ChevronRight size={12} />
                      </button>
                    </div>
                  )}

                  {/* 2. Cooperation slips alert */}
                  {hasCoops && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '4px 0', borderTop: '1px dashed var(--color-border-light)', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={15} />
                        </div>
                        <span style={{ fontSize: isMobile ? '0.78rem' : '0.825rem', color: 'var(--color-text)', lineHeight: 1.35, wordBreak: 'break-word' }}>
                          {t('Yêu cầu ký phiếu hợp tác: ')}
                          <strong style={{ color: '#10b981', fontWeight: 800 }}>{pendingCoopsCount}</strong>
                          {t(' phiếu đang chờ bạn ký.')}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const firstSlipId = pendingCoopSlips[0]?.id;
                          navigate(firstSlipId ? `/cooperation-slips?sign_id=${firstSlipId}` : '/cooperation-slips');
                        }}
                        style={{
                          ...actionBtnStyle,
                          background: 'rgba(16, 185, 129, 0.08)',
                          color: '#10b981'
                        }}
                        className="hover-lift"
                      >
                        {t('Ký ngay')} <ChevronRight size={12} />
                      </button>
                    </div>
                  )}

                  {/* 3. AI suggestion alert */}
                  {aiCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '4px 0', borderTop: '1px dashed var(--color-border-light)', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Sparkles size={14} style={{ color: '#ef4444' }} />
                        </div>
                        <span style={{ fontSize: isMobile ? '0.78rem' : '0.825rem', color: 'var(--color-text)', lineHeight: 1.35, wordBreak: 'break-word' }}>
                          {aiMessage}
                        </span>
                      </div>
                      <button
                        onClick={handleStartFocusSession}
                        style={{
                          ...actionBtnStyle,
                          background: 'rgba(189, 29, 45, 0.08)',
                          color: 'var(--color-primary, #BD1D2D)'
                        }}
                        className="hover-lift"
                      >
                        {t('Xử lý ngay')} <ChevronRight size={12} />
                      </button>
                    </div>
                  )}

                  {/* 4. Upcoming meetings alert */}
                  {meetingCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '4px 0', borderTop: '1px dashed var(--color-border-light)', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.08)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Clock size={14} />
                        </div>
                        <span style={{ fontSize: isMobile ? '0.78rem' : '0.825rem', color: 'var(--color-text)', lineHeight: 1.35, wordBreak: 'break-word' }}>
                          {t('Lịch hẹn sắp diễn ra: ')}
                          <strong style={{ color: '#d97706', fontWeight: 800 }}>{meetingCount}</strong>
                          {t(' cuộc hẹn gặp khách hàng đã lên lịch.')}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowUpcomingMeetingsModal(true)}
                        style={{
                          ...actionBtnStyle,
                          background: 'rgba(245, 158, 11, 0.08)',
                          color: '#d97706'
                        }}
                        className="hover-lift"
                      >
                        {t('Xem danh sách')} <ChevronRight size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Consolidated Workspace Toolbar Row (Pills + Search + Filters + View Controls) */}
          <div style={{
            background: wsBg ? (theme === 'dark' ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.88)') : 'var(--color-surface)',
            backdropFilter: wsBg ? 'blur(16px)' : 'none',
            WebkitBackdropFilter: wsBg ? 'blur(16px)' : 'none',
            border: wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(255, 255, 255, 0.65)') : '1px solid var(--color-border-light)',
            borderRadius: isMobile ? '12px' : '16px',
            padding: isMobile ? '8px 10px' : '6px 10px',
            boxShadow: wsBg ? (theme === 'dark' ? '0 8px 32px 0 rgba(0, 0, 0, 0.35)' : '0 8px 24px -4px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.04)') : '0 4px 20px -8px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '1rem',
            overflow: 'visible',
            position: 'relative',
            zIndex: 12
          }}>
            {/* Main Toolbar Row (Pills + Controls side-by-side) */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              justifyContent: 'space-between',
              gap: '12px',
              width: '100%'
            }}>
              {/* Top Group: Horizontal Scrollable Status Pills & Team Dropdown */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              WebkitOverflowScrolling: 'touch',
              flex: isMobile ? 'none' : '0 1 auto',
              paddingBottom: isMobile ? '4px' : '0',
              maxWidth: isMobile ? '100%' : 'calc(100% - 280px)',
              width: isMobile ? '100%' : 'auto'
            }} className="custom-scrollbar-hidden">
              {/* Tất cả Pill */}
              {(() => {
                const isAllActive = wsDatePreset === 'all' && wsTaskFilter === 'all';
                return (
                  <div 
                    onClick={() => {
                      setWsDatePreset('all');
                      setWsStatus('planned');
                      setWsTaskFilter('all');
                      if (!wsTeamId) setWsTeamId('all_teams_bypass');
                    }}
                    style={{
                      position: 'relative',
                      padding: isMobile ? '4px 10px' : '5px 12px',
                      borderRadius: '20px',
                      border: isAllActive 
                        ? '1.5px solid transparent' 
                        : (wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(0, 0, 0, 0.1)') : '1px solid var(--color-border)'),
                      background: isAllActive ? 'transparent' : (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)') : 'transparent'),
                      backdropFilter: wsBg ? 'blur(8px)' : 'none',
                      WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                      color: isAllActive 
                        ? (wsBg ? (theme === 'dark' ? '#ffffff' : 'var(--color-primary, #BD1D2D)') : 'var(--color-primary, #BD1D2D)') 
                        : (wsBg ? (theme === 'dark' ? '#cbd5e1' : '#334155') : 'var(--color-text-muted)'),
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: isMobile ? '0.725rem' : '0.78rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      userSelect: 'none',
                      transition: 'color 0.2s ease',
                      textShadow: wsBg && theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.7)' : 'none'
                    }}
                  >
                    {isAllActive && (
                      <motion.div
                        layoutId="activeWorkspaceFilterPill"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '20px',
                          background: 'rgba(189, 29, 45, 0.22)',
                          border: '1.5px solid var(--color-primary, #BD1D2D)',
                          boxShadow: '0 2px 10px rgba(189, 29, 45, 0.25)',
                          zIndex: 0
                        }}
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>{t('Tất cả')}</span>
                    </span>
                  </div>
                );
              })()}

              {/* Assigned to me Pill (Tôi thực hiện) */}
              {(() => {
                const isAssignedActive = wsTaskFilter === 'assigned_to_me';
                return (
                  <div 
                    onClick={() => {
                      if (wsTaskFilter === 'assigned_to_me') {
                        setWsTaskFilter('all');
                      } else {
                        setWsTaskFilter('assigned_to_me');
                        setWsStatus('planned');
                        setWsDatePreset('all');
                      }
                      if (!wsTeamId) setWsTeamId('all_teams_bypass');
                    }}
                    style={{
                      position: 'relative',
                      padding: isMobile ? '4px 10px' : '5px 12px',
                      borderRadius: '20px',
                      border: isAssignedActive 
                        ? '1.5px solid transparent' 
                        : (wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(0, 0, 0, 0.1)') : '1px solid var(--color-border)'),
                      background: isAssignedActive ? 'transparent' : (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)') : 'transparent'),
                      backdropFilter: wsBg ? 'blur(8px)' : 'none',
                      WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                      color: isAssignedActive 
                        ? (theme === 'dark' ? '#93c5fd' : '#1d4ed8') 
                        : (wsBg ? (theme === 'dark' ? '#cbd5e1' : '#334155') : '#2563eb'),
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: isMobile ? '0.725rem' : '0.78rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      userSelect: 'none',
                      transition: 'color 0.2s ease',
                      textShadow: wsBg && theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.7)' : 'none'
                    }}
                  >
                    {isAssignedActive && (
                      <motion.div
                        layoutId="activeWorkspaceFilterPill"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '20px',
                          background: 'rgba(37, 99, 235, 0.25)',
                          border: '1.5px solid #3b82f6',
                          boxShadow: '0 2px 10px rgba(59, 130, 246, 0.25)',
                          zIndex: 0
                        }}
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <User size={isMobile ? 12 : 13} style={{ color: isAssignedActive ? (theme === 'dark' ? '#93c5fd' : '#1d4ed8') : '#2563eb' }} />
                      <span>{t('Tôi thực hiện')}</span>
                      <span style={{ background: '#2563eb', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.675rem', fontWeight: 800 }}>
                        {workspaceStats.assignedToMe || 0}
                      </span>
                    </span>
                  </div>
                );
              })()}

              {/* Overdue Pill (Quá hạn) */}
              {(() => {
                const isOverdueActive = wsDatePreset === 'overdue';
                return (
                  <div 
                    onClick={() => {
                      if (wsDatePreset === 'overdue') {
                        setWsDatePreset('all');
                      } else {
                        setWsDatePreset('overdue');
                        setWsStatus('planned');
                        setWsTaskFilter('all');
                      }
                      if (!wsTeamId) setWsTeamId('all_teams_bypass');
                    }}
                    style={{
                      position: 'relative',
                      padding: isMobile ? '4px 10px' : '5px 12px',
                      borderRadius: '20px',
                      border: isOverdueActive 
                        ? '1.5px solid transparent' 
                        : (wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(0, 0, 0, 0.1)') : '1px solid var(--color-border)'),
                      background: isOverdueActive ? 'transparent' : (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)') : 'transparent'),
                      backdropFilter: wsBg ? 'blur(8px)' : 'none',
                      WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                      color: isOverdueActive 
                        ? (theme === 'dark' ? '#fca5a5' : '#b91c1c') 
                        : (wsBg ? (theme === 'dark' ? '#cbd5e1' : '#334155') : 'var(--color-danger)'),
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: isMobile ? '0.725rem' : '0.78rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      userSelect: 'none',
                      transition: 'color 0.2s ease',
                      textShadow: wsBg && theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.7)' : 'none'
                    }}
                  >
                    {isOverdueActive && (
                      <motion.div
                        layoutId="activeWorkspaceFilterPill"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '20px',
                          background: 'rgba(239, 68, 68, 0.25)',
                          border: '1.5px solid #ef4444',
                          boxShadow: '0 2px 10px rgba(239, 68, 68, 0.25)',
                          zIndex: 0
                        }}
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={isMobile ? 12 : 13} style={{ color: isOverdueActive ? (theme === 'dark' ? '#fca5a5' : '#b91c1c') : 'var(--color-danger)' }} />
                      <span>{t('Quá hạn')}</span>
                      <span style={{ background: 'var(--color-danger)', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.675rem', fontWeight: 800 }}>
                        {workspaceStats.overdue}
                      </span>
                    </span>
                  </div>
                );
              })()}

              {/* Due Today Pill (Đến hạn) */}
              {(() => {
                const isTodayActive = wsDatePreset === 'today';
                return (
                  <div 
                    onClick={() => {
                      if (wsDatePreset === 'today') {
                        setWsDatePreset('all');
                      } else {
                        setWsDatePreset('today');
                        setWsStatus('planned');
                        setWsTaskFilter('all');
                      }
                      if (!wsTeamId) setWsTeamId('all_teams_bypass');
                    }}
                    style={{
                      position: 'relative',
                      padding: isMobile ? '4px 10px' : '5px 12px',
                      borderRadius: '20px',
                      border: isTodayActive 
                        ? '1.5px solid transparent' 
                        : (wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(0, 0, 0, 0.1)') : '1px solid var(--color-border)'),
                      background: isTodayActive ? 'transparent' : (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)') : 'transparent'),
                      backdropFilter: wsBg ? 'blur(8px)' : 'none',
                      WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                      color: isTodayActive 
                        ? (theme === 'dark' ? '#fde68a' : '#b45309') 
                        : (wsBg ? (theme === 'dark' ? '#cbd5e1' : '#334155') : 'var(--color-warning)'),
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: isMobile ? '0.725rem' : '0.78rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      userSelect: 'none',
                      transition: 'color 0.2s ease',
                      textShadow: wsBg && theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.7)' : 'none'
                    }}
                  >
                    {isTodayActive && (
                      <motion.div
                        layoutId="activeWorkspaceFilterPill"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '20px',
                          background: 'rgba(245, 158, 11, 0.25)',
                          border: '1.5px solid #f59e0b',
                          boxShadow: '0 2px 10px rgba(245, 158, 11, 0.25)',
                          zIndex: 0
                        }}
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={isMobile ? 12 : 13} style={{ color: isTodayActive ? (theme === 'dark' ? '#fde68a' : '#b45309') : 'var(--color-warning)' }} />
                      <span>{t('Đến hạn')}</span>
                      <span style={{ background: 'var(--color-warning)', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.675rem', fontWeight: 800 }}>
                        {workspaceStats.dueToday}
                      </span>
                    </span>
                  </div>
                );
              })()}

              {/* Waiting Approval Pill (Chờ tôi duyệt) */}
              {(() => {
                const isApproveActive = wsTaskFilter === 'approve_by_me';
                return (
                  <div 
                    onClick={() => {
                      if (wsTaskFilter === 'approve_by_me') {
                        setWsTaskFilter('all');
                      } else {
                        setWsTaskFilter('approve_by_me');
                        setWsStatus('planned');
                        setWsDatePreset('all');
                      }
                      if (!wsTeamId) setWsTeamId('all_teams_bypass');
                    }}
                    style={{
                      position: 'relative',
                      padding: isMobile ? '4px 10px' : '5px 12px',
                      borderRadius: '20px',
                      border: isApproveActive 
                        ? '1.5px solid transparent' 
                        : (wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(0, 0, 0, 0.1)') : '1px solid var(--color-border)'),
                      background: isApproveActive ? 'transparent' : (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)') : 'transparent'),
                      backdropFilter: wsBg ? 'blur(8px)' : 'none',
                      WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                      color: isApproveActive 
                        ? (theme === 'dark' ? '#d8b4fe' : '#6d28d9') 
                        : (wsBg ? (theme === 'dark' ? '#cbd5e1' : '#334155') : '#8b5cf6'),
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: isMobile ? '0.725rem' : '0.78rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      userSelect: 'none',
                      transition: 'color 0.2s ease',
                      textShadow: wsBg && theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.7)' : 'none'
                    }}
                  >
                    {isApproveActive && (
                      <motion.div
                        layoutId="activeWorkspaceFilterPill"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '20px',
                          background: 'rgba(168, 85, 247, 0.25)',
                          border: '1.5px solid #a855f7',
                          boxShadow: '0 2px 10px rgba(168, 85, 247, 0.25)',
                          zIndex: 0
                        }}
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <UserCheck size={isMobile ? 12 : 13} style={{ color: isApproveActive ? (theme === 'dark' ? '#d8b4fe' : '#6d28d9') : '#8b5cf6' }} />
                      <span>{t('Chờ tôi duyệt')}</span>
                      <span style={{ background: '#8b5cf6', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.675rem', fontWeight: 800 }}>
                        {workspaceStats.pendingApproval}
                      </span>
                    </span>
                  </div>
                );
              })()}

              {/* Collaborator / Related Pill */}
              {(() => {
                const isCollabActive = wsTaskFilter === 'collaborator';
                return (
                  <div 
                    onClick={() => {
                      if (wsTaskFilter === 'collaborator') {
                        setWsTaskFilter('all');
                      } else {
                        setWsTaskFilter('collaborator');
                        setWsStatus('planned');
                        setWsDatePreset('all');
                      }
                      if (!wsTeamId) setWsTeamId('all_teams_bypass');
                    }}
                    style={{
                      position: 'relative',
                      padding: isMobile ? '4px 10px' : '5px 12px',
                      borderRadius: '20px',
                      border: isCollabActive 
                        ? '1.5px solid transparent' 
                        : (wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(0, 0, 0, 0.1)') : '1px solid var(--color-border)'),
                      background: isCollabActive ? 'transparent' : (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)') : 'transparent'),
                      backdropFilter: wsBg ? 'blur(8px)' : 'none',
                      WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                      color: isCollabActive 
                        ? (theme === 'dark' ? '#cbd5e1' : '#1e293b') 
                        : (wsBg ? (theme === 'dark' ? '#94a3b8' : '#64748b') : '#475569'),
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: isMobile ? '0.725rem' : '0.78rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      userSelect: 'none',
                      transition: 'color 0.2s ease',
                      textShadow: wsBg && theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.7)' : 'none'
                    }}
                  >
                    {isCollabActive && (
                      <motion.div
                        layoutId="activeWorkspaceFilterPill"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '20px',
                          background: 'rgba(100, 116, 139, 0.25)',
                          border: '1.5px solid #64748b',
                          boxShadow: '0 2px 10px rgba(100, 116, 139, 0.25)',
                          zIndex: 0
                        }}
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={isMobile ? 12 : 13} style={{ color: isCollabActive ? (theme === 'dark' ? '#cbd5e1' : '#1e293b') : '#64748b' }} />
                      <span>{t('Tôi liên quan')}</span>
                      <span style={{ background: '#475569', color: '#fff', borderRadius: '10px', padding: '1px 5px', fontSize: '0.675rem', fontWeight: 800 }}>
                        {workspaceStats.collaborator || 0}
                      </span>
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Controls Group: Search + Advanced Filters Trigger + Segmented Control + View Modes */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '8px' : '6px',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              flex: isMobile ? 'none' : '1 1 auto',
              justifyContent: isMobile ? 'flex-start' : 'flex-end',
              width: isMobile ? '100%' : 'auto',
              minWidth: 0,
              boxSizing: 'border-box'
            }}>
              {/* Filter Trigger Button */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: showAdvancedFilters 
                    ? '1.5px solid var(--color-primary, #BD1D2D)' 
                    : (wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(0, 0, 0, 0.15)') : '1px solid var(--color-border)'),
                  background: showAdvancedFilters 
                    ? 'var(--color-primary-light)' 
                    : (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.04)') : 'transparent'),
                  backdropFilter: wsBg ? 'blur(8px)' : 'none',
                  WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                  color: showAdvancedFilters ? 'var(--color-primary, #BD1D2D)' : (wsBg ? (theme === 'dark' ? '#ffffff' : '#1e293b') : 'var(--color-text)'),
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  textShadow: wsBg && theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.6)' : 'none'
                }}
              >
                <Filter size={12} style={{ color: wsBg ? (theme === 'dark' ? '#ffffff' : '#475569') : 'var(--color-text)' }} />
                <span>{t('Bộ lọc')}</span>
                {(() => {
                  let count = 0;
                  if (wsPriority) count++;
                  if (wsStatus && wsStatus !== 'planned') count++;
                  if (wsDatePreset && wsDatePreset !== 'all') count++;
                  if (wsTeamId && wsTeamId !== 'all_teams_bypass') count++;
                  if (wsUserId) count++;
                  if (wsActivityType && wsActivityType !== 'task') count++;
                  if (wsRelatedType) count++;
                  return count > 0 ? (
                    <span style={{
                      background: 'var(--color-primary, #BD1D2D)',
                      color: 'white',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: '2px'
                    }}>
                      {count}
                    </span>
                  ) : null;
                })()}
              </button>

              {/* Toggle Switch Hiện việc đã xong */}
              <div
                onClick={() => setShowDoneTasks(prev => !prev)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowDoneTasks(prev => !prev);
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '32px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  border: showDoneTasks 
                    ? '1.5px solid #10b981' 
                    : (wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(0, 0, 0, 0.15)') : '1px solid var(--color-border)'),
                  background: showDoneTasks 
                    ? 'rgba(16, 185, 129, 0.15)' 
                    : (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.04)') : 'transparent'),
                  backdropFilter: wsBg ? 'blur(8px)' : 'none',
                  WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                  cursor: 'pointer',
                  userSelect: 'none',
                  flexShrink: 0,
                  transition: 'all 0.2s'
                }}
                title={showDoneTasks ? t('Đang hiện việc đã hoàn thành. Bấm để ẩn') : t('Bấm để hiển thị cả việc đã xong')}
              >
                <div style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                  <ToggleSwitch
                    checked={showDoneTasks}
                    onChange={() => {}}
                    small={true}
                  />
                </div>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: showDoneTasks ? 700 : 600,
                  color: showDoneTasks ? (theme === 'dark' ? '#34d399' : '#059669') : (wsBg ? (theme === 'dark' ? '#f1f5f9' : '#1e293b') : 'var(--color-text)'),
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  textShadow: wsBg && theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.6)' : 'none'
                }}>
                  {t('Hiện việc đã xong')}
                </span>
              </div>

              {/* Toggle Switch Admin View Full (chỉ hiện cho Admin) */}
              {isTopAdmin && (
                <div
                  onClick={() => {
                    setAdminViewFull(prev => {
                      const next = !prev;
                      try {
                        localStorage.setItem('ws_admin_view_full', String(next));
                      } catch {}
                      return next;
                    });
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setAdminViewFull(prev => {
                        const next = !prev;
                        try {
                          localStorage.setItem('ws_admin_view_full', String(next));
                        } catch {}
                        return next;
                      });
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '32px',
                    padding: '0 8px',
                    borderRadius: '6px',
                    border: adminViewFull 
                      ? '1.5px solid var(--color-primary, #BD1D2D)' 
                      : (wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(0, 0, 0, 0.15)') : '1px solid var(--color-border)'),
                    background: adminViewFull 
                      ? 'rgba(189, 29, 45, 0.15)' 
                      : (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.04)') : 'transparent'),
                    backdropFilter: wsBg ? 'blur(8px)' : 'none',
                    WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                    cursor: 'pointer',
                    userSelect: 'none',
                    flexShrink: 0,
                    transition: 'all 0.2s'
                  }}
                  title={adminViewFull ? t('Đang xem toàn bộ công việc hệ thống. Bấm để chỉ xem việc của tôi') : t('Bấm để xem toàn bộ công việc hệ thống (Admin view full)')}
                >
                  <div style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                    <ToggleSwitch
                      checked={adminViewFull}
                      onChange={() => {}}
                      small={true}
                    />
                  </div>
                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: adminViewFull ? 700 : 600,
                    color: adminViewFull ? (theme === 'dark' ? '#f87171' : '#dc2626') : (wsBg ? (theme === 'dark' ? '#f1f5f9' : '#1e293b') : 'var(--color-text)'),
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    textShadow: wsBg && theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.6)' : 'none'
                  }}>
                    <Shield size={12} style={{ color: adminViewFull ? 'var(--color-primary, #BD1D2D)' : (wsBg ? (theme === 'dark' ? '#cbd5e1' : '#64748b') : 'var(--color-text-muted)') }} />
                    {t('Admin view full')}
                  </span>
                </div>
              )}

              {/* View Mode Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', flexShrink: 0 }}>
                {!isMobile && (
                  <div style={{
                    display: 'flex',
                    background: wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.06)') : 'var(--color-border-light)',
                    border: wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(0, 0, 0, 0.1)') : '1px solid var(--color-border)',
                    backdropFilter: wsBg ? 'blur(8px)' : 'none',
                    WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                    padding: '2px',
                    borderRadius: '8px',
                    gap: '2px'
                  }}>
                    <button
                      onClick={() => setWsViewMode('grid')}
                      title={t('Dạng lưới')}
                      style={{
                        width: '32px',
                        height: '28px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: wsViewMode === 'grid' ? (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.25)' : '#ffffff') : 'var(--color-surface)') : 'transparent',
                        color: wsViewMode === 'grid' ? (wsBg ? (theme === 'dark' ? '#ffffff' : '#0f172a') : 'var(--color-text)') : (wsBg ? (theme === 'dark' ? '#cbd5e1' : '#64748b') : 'var(--color-text-light)'),
                        boxShadow: wsViewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        outline: 'none',
                        transform: 'none'
                      }}
                    >
                      <LayoutGrid size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setWsViewMode('kanban');
                        setShowDoneTasks(true);
                      }}
                      title={t('Dạng Kanban')}
                      style={{
                        width: '32px',
                        height: '28px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: wsViewMode === 'kanban' ? (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.25)' : '#ffffff') : 'var(--color-surface)') : 'transparent',
                        color: wsViewMode === 'kanban' ? (wsBg ? (theme === 'dark' ? '#ffffff' : '#0f172a') : 'var(--color-text)') : (wsBg ? (theme === 'dark' ? '#cbd5e1' : '#64748b') : 'var(--color-text-light)'),
                        boxShadow: wsViewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        outline: 'none',
                        transform: 'none'
                      }}
                    >
                      <Layers size={16} />
                    </button>
                  </div>
                )}

                {/* Workspace Customizer Button */}
                <button
                  onClick={() => setShowWorkspaceCustomizer(true)}
                  title={t('Tùy biến giao diện Bàn làm việc')}
                  style={{
                    height: '32px',
                    padding: isMobile ? '0 8px' : '0 10px',
                    borderRadius: '6px',
                    border: wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(0, 0, 0, 0.15)') : '1px solid var(--color-border)',
                    background: showWorkspaceCustomizer 
                      ? 'var(--color-primary-light)' 
                      : (wsBg ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.04)') : 'var(--color-surface)'),
                    backdropFilter: wsBg ? 'blur(8px)' : 'none',
                    WebkitBackdropFilter: wsBg ? 'blur(8px)' : 'none',
                    color: showWorkspaceCustomizer ? 'var(--color-primary, #BD1D2D)' : (wsBg ? (theme === 'dark' ? '#ffffff' : '#1e293b') : 'var(--color-text)'),
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                    boxShadow: wsBg ? (theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.06)') : 'none',
                    textShadow: wsBg && theme === 'dark' ? '0 1px 3px rgba(0,0,0,0.6)' : 'none'
                  }}
                  className="hover-lift"
                >
                  <Palette size={14} style={{ color: '#ef4444' }} />
                  {!isMobile && <span>{t('Giao diện')}</span>}
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Dropdown Filters (Collapsible) */}
          <AnimatePresence>
            {showAdvancedFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'visible' }}
              >
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
                  gap: '14px',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--color-border-light)'
                }}>
                  {/* Priority Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Độ ưu tiên')}</label>
                    <CustomSelect
                      options={[
                        { value: '', label: t('Tất cả độ ưu tiên') },
                        { value: 'high', label: t('Cao') },
                        { value: 'medium', label: t('Trung bình') },
                        { value: 'low', label: t('Thấp') }
                      ]}
                      value={wsPriority}
                      onChange={val => setWsPriority(String(val))}
                    />
                  </div>

                  {/* Status Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Trạng thái')}</label>
                    <CustomSelect
                      options={[
                        { value: 'planned', label: t('Chưa hoàn thành') },
                        { value: '', label: t('Tất cả trạng thái') },
                        { value: 'done', label: t('Đã hoàn thành') },
                        { value: 'hidden', label: t('Việc đã ẩn') }
                      ]}
                      value={wsStatus}
                      onChange={val => setWsStatus(String(val))}
                    />
                  </div>

                  {/* Date Preset Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Thời gian hạn')}</label>
                    <CustomSelect
                      options={[
                        { value: 'all', label: t('Tất cả thời gian') },
                        { value: 'today', label: t('Hôm nay') },
                        { value: 'tomorrow', label: t('Ngày mai') },
                        { value: 'week', label: t('Tuần này') },
                        { value: '7_days', label: t('7 ngày qua') },
                        { value: '30_days', label: t('30 ngày qua') },
                        { value: 'this_month', label: t('Tháng này') },
                        { value: 'last_month', label: t('Tháng trước') },
                        { value: 'overdue', label: t('Quá hạn') },
                        { value: 'custom', label: t('Tùy chỉnh ngày...') }
                      ]}
                      value={wsDatePreset}
                      onChange={val => setWsDatePreset(String(val))}
                    />
                  </div>

                  {/* Activity Type Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Phân loại công việc')}</label>
                    <CustomSelect
                      options={[
                        { value: 'task', label: t('Nhiệm vụ (Tasks)') },
                        { value: 'all', label: t('Tất cả phân loại') },
                        { value: 'call', label: t('Cuộc gọi (Calls)') },
                        { value: 'email', label: t('Emails') },
                        { value: 'meeting', label: t('Cuộc gặp') },
                        { value: 'note', label: t('Ghi chú') }
                      ]}
                      value={wsActivityType}
                      onChange={val => setWsActivityType(String(val))}
                    />
                  </div>

                  {/* Related Type Filter */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Liên quan đến')}</label>
                    <CustomSelect
                      options={[
                        { value: '', label: t('Tất cả đối tượng') },
                        { value: 'contact', label: t('Khách hàng (Contacts)') },
                        { value: 'company', label: t('Pháp nhân (Companies)') },
                        { value: 'deal', label: t('Giao dịch (Deals)') }
                      ]}
                      value={wsRelatedType}
                      onChange={val => setWsRelatedType(String(val))}
                    />
                  </div>

                  {/* Team filter (Admin/Manager only) */}
                  {isAdminOrManager && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Nhóm')}</label>
                      <CustomSelect
                        options={teamOptions}
                        value={wsTeamId}
                        onChange={val => { setWsTeamId(String(val)); setWsUserId(''); }}
                      />
                    </div>
                  )}

                  {/* Consultant filter (Admin/Manager only) */}
                  {isAdminOrManager && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('Nhân viên')}</label>
                      <CustomSelect
                        options={consultantOptions}
                        value={wsUserId}
                        onChange={val => setWsUserId(String(val))}
                        showAvatars
                        searchable
                        align="right"
                      />
                    </div>
                  )}
                </div>

                {/* Custom Date Pickers */}
                {wsDatePreset === 'custom' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '0.75rem 0 0 0',
                    marginTop: '0.5rem',
                    borderTop: '1px dashed var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Từ ngày:')}</span>
                      <div style={{ width: '150px' }}>
                        <VietnameseDateInput
                          value={wsStartDate}
                          onChange={val => setWsStartDate(val)}
                          size="sm"
                          inputStyle={{ height: '36px', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Đến ngày:')}</span>
                      <div style={{ width: '150px' }}>
                        <VietnameseDateInput
                          value={wsEndDate}
                          onChange={val => setWsEndDate(val)}
                          size="sm"
                          inputStyle={{ height: '36px', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Clear Filter Toolbar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px dashed var(--color-border-light)',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={showDoneTasks || wsStatus === 'all'}
                        onChange={() => {
                          const next = !(showDoneTasks || wsStatus === 'all');
                          setShowDoneTasks(next);
                          setWsStatus(next ? 'all' : 'planned');
                        }}
                        style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                      />
                      <span>{t('Hiện việc đã xong')}</span>
                    </label>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={wsStatus === 'hidden'}
                        onChange={() => {
                          setWsStatus(wsStatus === 'hidden' ? 'planned' : 'hidden');
                        }}
                        style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                      />
                      <span>{t('Hiện việc đã ẩn')}</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    className="btn outline sm"
                    onClick={() => {
                      setWsPriority('');
                      setWsStatus('planned');
                      setShowDoneTasks(false);
                      setWsDatePreset('all');
                      setWsStartDate('');
                      setWsEndDate('');
                      setWsTeamId('all_teams_bypass');
                      setWsUserId('');
                      setWsActivityType('task');
                      setWsRelatedType('');
                      setWsSearch('');
                    }}
                    style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                  >
                    {t('Xóa bộ lọc')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </>
      )}

      {/* Task Grid */}
      {isAdminOrManager && !wsTeamId && wsSubTab !== 'personal' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: isMobile ? '100px' : '40px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
            {t('Vui lòng chọn một Phòng ban để xem chi tiết công việc:')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: isMobile ? '0.75rem' : '1.25rem' }}>
            {/* Card for "Tất cả các Nhóm" */}
            <div
              onClick={() => setWsTeamId('all_teams_bypass')}
              style={{
                padding: '1.5rem',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all var(--transition-fluid)',
                cursor: 'pointer',
                justifyContent: 'center',
                minHeight: '140px'
              }}
              className="hover-lift active-press"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', background: 'rgba(189, 29, 45, 0.08)', borderRadius: '10px', color: 'var(--color-primary, #BD1D2D)', display: 'flex' }}>
                  <Layers size={24} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-text)', margin: 0 }}>
                     {t('Tất cả các Phòng ban')}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                    {t('Xem toàn bộ công việc hệ thống')}
                  </p>
                </div>
              </div>
            </div>

            {/* Individual Team Cards */}
            {teamsList.map(team => {
              const teamMembers = users.filter(u => String(u.team_id) === String(team.id));
              const leaderUser = users.find(u => Number(u.id) === Number(team.leader_id));
              
              return (
                <div
                  key={team.id}
                  onClick={() => setWsTeamId(String(team.id))}
                  style={{
                    padding: '1.25rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    minHeight: '150px',
                    justifyContent: 'space-between'
                  }}
                  className="hover-lift active-press"
                >
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>
                        {team.name}
                      </h3>
                      {team.branch && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          <Building2 size={12} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.2 }}>
                            {team.branch}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ marginTop: '0.625rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      <span>Manager:</span>
                      {leaderUser ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Avatar src={leaderUser.avatar_url || leaderUser.avatar} name={leaderUser.full_name || leaderUser.username || leaderUser.name} size={18} />
                          <strong style={{ color: 'var(--color-text)' }}>{leaderUser.full_name || leaderUser.username || leaderUser.name}</strong>
                        </div>
                      ) : (
                        <strong style={{ color: 'var(--color-text)' }}>{team.leader_name || t('Chưa gán')}</strong>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dotted var(--color-border-light)', paddingTop: '0.625rem', marginTop: '4px' }}>
                    <div className="avatar-stack" style={{ display: 'flex', alignItems: 'center' }}>
                      {teamMembers.slice(0, 5).map((member, index) => (
                        <div
                          key={member.id}
                          style={{
                            marginLeft: index > 0 ? '-8px' : '0',
                            zIndex: 10 - index,
                            position: 'relative'
                          }}
                        >
                          <Avatar
                            src={member.avatar_url || member.avatar}
                            name={member.full_name || member.username || member.name}
                            size={24}
                            style={{ border: '2px solid var(--color-surface)' }}
                          />
                        </div>
                      ))}
                      {teamMembers.length > 5 && (
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'var(--color-bg-light)',
                            border: '2px solid var(--color-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: 'var(--color-text-muted)',
                            marginLeft: '-8px',
                            zIndex: 4,
                            position: 'relative'
                          }}
                        >
                          +{teamMembers.length - 5}
                        </div>
                      )}
                      {teamMembers.length === 0 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          {t('Không có thành viên')}
                        </span>
                      )}
                    </div>

                    {teamMembers.length > 0 && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary, #BD1D2D)' }}>
                        {teamMembers.length} sales
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleGridDragStart}
          onDragEnd={handleGridDragEnd}
        >
          {/* Task Groups Section Carousel */}
          {wsViewMode !== 'focus' && (
            <TaskGroupSection
              showProgress={showDoneTasks}
              groups={enrichedTaskGroups}
              summary={computedGroupSummary}
              activeGroupId={activeTaskGroupId}
              onSelectGroup={(groupId) => setActiveTaskGroupId(groupId)}
              onCreateGroup={handleCreateTaskGroup}
              onUpdateGroup={handleUpdateTaskGroup}
              onDeleteGroup={handleDeleteTaskGroup}
              onTogglePinGroup={handleTogglePinTaskGroup}
              onReorderGroups={handleReorderTaskGroups}
              onDropTaskOnGroup={handleDropTaskOnGroup}
              draggedTaskId={draggedTaskId}
              isLightText={!!wsBg}
              theme={theme}
              isMobile={isMobile}
              showCreateModal={showCardCreateGroupModal}
              setShowCreateModal={setShowCardCreateGroupModal}
            />
          )}

          {wsViewMode !== 'focus' && loadingWsTasks ? (
            wsViewMode === 'kanban' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
                {[1, 2, 3].map((col) => (
                  <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-bg)', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <Skeleton width={80} height={14} borderRadius={4} />
                      <Skeleton width={24} height={18} borderRadius={10} />
                    </div>
                    {[1, 2].map((idx) => (
                      <div key={idx} style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '16px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        minHeight: '160px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Skeleton width="60%" height={16} borderRadius={6} />
                          <Skeleton width={16} height={16} borderRadius={4} />
                        </div>
                        <Skeleton width="90%" height={11} borderRadius={4} />
                        <Skeleton width="45%" height={11} borderRadius={4} />
                        <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <Skeleton width="28%" height={10} borderRadius={4} />
                            <Skeleton width="15%" height={10} borderRadius={4} />
                          </div>
                          <Skeleton width="100%" height={6} borderRadius={99} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--color-border-light)' }}>
                          <Skeleton width={75} height={20} borderRadius={20} />
                          <Skeleton width={26} height={26} borderRadius="50%" />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '100%' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? '0.75rem' : '1.25rem', paddingBottom: isMobile ? '100px' : '40px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    minHeight: '160px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Skeleton width={`${50 + (i % 4) * 10}%`} height={16} borderRadius={6} />
                      <Skeleton width={16} height={16} borderRadius={4} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <Skeleton width="90%" height={11} borderRadius={4} />
                      <Skeleton width={`${40 + (i % 3) * 15}%`} height={11} borderRadius={4} />
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <Skeleton width="28%" height={10} borderRadius={4} />
                        <Skeleton width="15%" height={10} borderRadius={4} />
                      </div>
                      <Skeleton width="100%" height={6} borderRadius={99} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--color-border-light)' }}>
                      <Skeleton width={75} height={20} borderRadius={20} />
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Skeleton width={26} height={26} borderRadius="50%" />
                        {i % 2 === 0 && <Skeleton width={26} height={26} borderRadius="50%" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : wsViewMode !== 'focus' && filteredWsTasks.length === 0 ? (
            <div style={{ 
              margin: isMobile ? '3.5rem auto 4rem auto' : '7.5rem auto 8rem auto', 
              maxWidth: '1000px',
              width: '100%',
              padding: isMobile ? '1rem 0.5rem' : '1.5rem 1.5rem', 
              textAlign: 'center',
              position: 'relative',
              boxSizing: 'border-box'
            }}>
              {/* Quote En & Vi */}
              <div style={{ marginBottom: '1.75rem', minHeight: '90px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{
                  fontSize: isMobile ? '1.25rem' : '1.65rem',
                  fontWeight: 700,
                  lineHeight: 1.45,
                  color: wsBg ? '#ffffff' : 'var(--color-text)',
                  margin: '0 0 0.75rem 0',
                  fontStyle: 'italic',
                  textShadow: wsBg ? '0 2px 14px rgba(0, 0, 0, 0.85)' : 'none',
                  letterSpacing: '-0.2px'
                }}>
                  "{WORKSPACE_INSPIRATIONAL_QUOTES[currentQuoteIdx]?.en}"
                </p>
                <p style={{
                  fontSize: isMobile ? '0.95rem' : '1.1rem',
                  fontWeight: 500,
                  color: wsBg ? 'rgba(255, 255, 255, 0.88)' : 'var(--color-text-muted)',
                  margin: '0 0 0.75rem 0',
                  lineHeight: 1.55,
                  textShadow: wsBg ? '0 1px 6px rgba(0, 0, 0, 0.75)' : 'none'
                }}>
                  {WORKSPACE_INSPIRATIONAL_QUOTES[currentQuoteIdx]?.vi}
                </p>
                <p style={{
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  color: wsBg ? 'rgba(255, 255, 255, 0.7)' : 'var(--color-primary, #BD1D2D)',
                  margin: 0,
                  letterSpacing: '0.5px',
                  textShadow: wsBg ? '0 1px 4px rgba(0, 0, 0, 0.7)' : 'none'
                }}>
                  — {WORKSPACE_INSPIRATIONAL_QUOTES[currentQuoteIdx]?.author}
                </p>
              </div>

              {/* Navigation Controls: Prev, Shuffle, Next */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}>
                <button
                  type="button"
                  onClick={handlePrevQuote}
                  title={t('Câu trước')}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: wsBg ? 'rgba(255, 255, 255, 0.15)' : 'var(--color-bg)',
                    border: wsBg ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid var(--color-border)',
                    color: wsBg ? '#ffffff' : 'var(--color-text)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = wsBg ? 'rgba(255, 255, 255, 0.28)' : 'var(--color-border)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = wsBg ? 'rgba(255, 255, 255, 0.15)' : 'var(--color-bg)'; }}
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  type="button"
                  onClick={handleShuffleQuote}
                  title={t('Đổi câu ngẫu nhiên')}
                  style={{
                    padding: '0 16px',
                    height: '36px',
                    borderRadius: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: wsBg ? 'rgba(255, 255, 255, 0.18)' : 'var(--color-bg)',
                    border: wsBg ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid var(--color-border)',
                    color: wsBg ? '#ffffff' : 'var(--color-text)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.background = wsBg ? 'rgba(255, 255, 255, 0.3)' : 'var(--color-border)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = wsBg ? 'rgba(255, 255, 255, 0.18)' : 'var(--color-bg)'; }}
                >
                  <RefreshCw size={13} />
                  <span>{t('Đổi câu')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextQuote}
                  title={t('Câu kế tiếp')}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: wsBg ? 'rgba(255, 255, 255, 0.15)' : 'var(--color-bg)',
                    border: wsBg ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid var(--color-border)',
                    color: wsBg ? '#ffffff' : 'var(--color-text)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = wsBg ? 'rgba(255, 255, 255, 0.28)' : 'var(--color-border)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = wsBg ? 'rgba(255, 255, 255, 0.15)' : 'var(--color-bg)'; }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Subtitle note & Quick create button */}
              <div style={{
                marginTop: '1.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  fontSize: '0.82rem',
                  color: wsBg ? 'rgba(255, 255, 255, 0.65)' : 'var(--color-text-muted)',
                  textShadow: wsBg ? '0 1px 4px rgba(0, 0, 0, 0.7)' : 'none'
                }}>
                  {t('Không có công việc nào phù hợp với bộ lọc hiện tại.')}
                </span>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-primary, #BD1D2D)',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(189, 29, 45, 0.4)',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <Plus size={13} />
                  <span>{t('Tạo việc mới')}</span>
                </button>
              </div>
            </div>
          ) : wsViewMode === 'grid' ? (
            <>
              <SortableContext
                items={paginatedWsTasks.map(tItem => tItem.id)}
                strategy={rectSortingStrategy}
              >
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '100%' : `repeat(${wsCols || 4}, minmax(0, 1fr))`, gap: isMobile ? '0.75rem' : '1.25rem', paddingBottom: isMobile ? '20px' : '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                  {paginatedWsTasks.map(task => {
                    const isPinned = pinnedTaskIds.includes(Number(task.id));
                    return (
                      <SortableWorkspaceCard
                        key={task.id}
                        task={task}
                        isMobile={isMobile}
                        wsBg={wsBg}
                        theme={theme}
                        isPinned={isPinned}
                        togglePinTask={togglePinTask}
                        users={users}
                        t={t}
                        getDueDateLabel={getDueDateLabel}
                        parseDescriptionAndChecklist={parseDescriptionAndChecklist}
                        setChecklist={setChecklist}
                        setSelectedTaskForDetails={setSelectedTaskForDetails}
                        handleOpenContactProfile={handleOpenContactProfile}
                        setSelectedTaskParticipants={setSelectedTaskParticipants}
                        setParticipantsModalOpen={setParticipantsModalOpen}
                        taskGroups={taskGroups}
                        onAssignGroup={handleAssignTaskGroup}
                        onOpenCreateGroupModal={() => setShowCardCreateGroupModal(true)}
                        onToggleComplete={handleToggleTaskStatus}
                        isCompleting={completingTaskId === task.id}
                      />
                    );
                  })}
                </div>
              </SortableContext>

              {filteredWsTasks.length > wsTasksPageSize && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '1.25rem',
                  marginBottom: isMobile ? '4rem' : '2rem',
                  background: 'transparent'
                }}>
                  <Pagination
                    total={filteredWsTasks.length}
                    page={wsTasksPage}
                    pageSize={wsTasksPageSize}
                    onChange={setWsTasksPage}
                    isLightText={!!wsBg}
                  />
                </div>
              )}
            </>
          ) : wsViewMode === 'kanban' ? (
            /* Kanban View */
            <>
              {(() => {
                const todoTasks = filteredWsTasks.filter(tItem => !isTaskEffectivelyDone(tItem) && getTaskEffectiveProgress(tItem) === 0);
                const inProgressTasks = filteredWsTasks.filter(tItem => !isTaskEffectivelyDone(tItem) && getTaskEffectiveProgress(tItem) > 0);
                const doneTasks = filteredWsTasks.filter(tItem => isTaskEffectivelyDone(tItem));

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
                        background: wsBg 
                          ? (theme === 'dark' ? 'rgba(15, 23, 42, 0.65)' : 'rgba(241, 245, 249, 0.82)')
                          : '#f8fafc',
                        border: isOver 
                          ? '2px dashed var(--color-primary, #BD1D2D)' 
                          : (wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.65)') : '1px solid #e2e8f0'),
                        backdropFilter: wsBg ? 'blur(12px)' : 'none',
                        WebkitBackdropFilter: wsBg ? 'blur(12px)' : 'none',
                        borderRadius: '16px',
                        padding: '0.75rem',
                        minHeight: '450px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        transition: 'all 0.2s',
                        boxShadow: isOver ? '0 4px 12px rgba(189, 29, 45, 0.08)' : (wsBg ? '0 4px 16px rgba(0,0,0,0.06)' : 'none'),
                        width: '100%',
                        minWidth: 0
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1, overflowY: 'auto', maxHeight: '600px' }}>
                        {columnTasks.slice(0, 20).map(task => {
                          const isCompleted = isTaskEffectivelyDone(task);
                          const isOverdue = !isCompleted && task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0));
                          const isToday = !isCompleted && task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();
                          
                          let dateBadgeColor = 'var(--color-text-muted)';
                          let dateBadgeBg = 'var(--color-bg)';
                          if (isOverdue) {
                            dateBadgeColor = 'var(--color-danger)';
                            dateBadgeBg = 'rgba(239, 68, 68, 0.08)';
                          } else if (isToday) {
                            dateBadgeColor = 'var(--color-warning)';
                            dateBadgeBg = 'rgba(245, 158, 11, 0.08)';
                          }

                          const parsedBody = parseTaskBody(task.body);
                          const link = (parsedBody.links?.[0]?.url) || (task.body && !task.body.trim().startsWith('{')
                            ? (task.body.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m)?.[1]?.trim() || '')
                            : '');
                          const description = parsedBody.description;
                          const cleanDesc = extractCleanCardDescription(task.body);
                          const isPinned = pinnedTaskIds.includes(Number(task.id));

                          return (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={() => setDraggedTaskId(task.id)}
                              onDragEnd={() => setDraggedTaskId(null)}
                              onClick={() => {
                                const parsed = parseDescriptionAndChecklist(description);
                                const checklistItems = (parsedBody.checklist && parsedBody.checklist.length > 0)
                                  ? parsedBody.checklist.map(c => ({ text: String(c.text || ''), checked: Boolean(c.checked) }))
                                  : parsed.checklist;
                                const parsedTask = {
                                  id: task.id,
                                  title: task.subject,
                                  done: task.status === 'done',
                                  priority: task.priority,
                                  due_date: task.due_date || '',
                                  created_at: task.created_at,
                                  link,
                                  description: parsedBody.pureDescription || parsed.pureDescription,
                                  user_id: task.user_id,
                                  user_name: task.user_name || 'Hệ thống',
                                  tags: task.tags || '',
                                  participant_ids: task.participant_ids || '',
                                  progress: task.progress || 0,
                                  require_approval: task.require_approval || 0,
                                  approver_id: task.approver_id,
                                  approval_status: task.approval_status,
                                  contact_id: task.contact_id,
                                  contact_name: task.contact_name,
                                  contact_avatar: task.contact_avatar,
                                  related_type: task.related_type,
                                  related_id: task.related_id,
                                  body: task.body,
                                  created_by: task.created_by,
                                  created_by_name: task.created_by_name,
                                  created_by_avatar: task.created_by_avatar,
                                  due_sla_notified: parsedBody.due_sla_notified,
                                  subtask_sla_notified: parsedBody.subtask_sla_notified
                                };
                                setChecklist(checklistItems);
                                setSelectedTaskForDetails(parsedTask);
                              }}
                              style={{
                                background: isPinned 
                                  ? (wsBg ? (theme === 'dark' ? 'rgba(189, 29, 45, 0.22)' : 'rgba(254, 242, 242, 0.96)') : 'rgba(189, 29, 45, 0.03)')
                                  : (wsBg ? (theme === 'dark' ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.95)') : 'var(--color-surface)'),
                                border: isPinned 
                                  ? '2px solid var(--color-primary, #BD1D2D)' 
                                  : (isOverdue && task.status !== 'done' ? '1.5px solid var(--color-danger)' : (wsBg ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.85)') : '1px solid var(--color-border-light)')),
                                backdropFilter: wsBg ? 'blur(6px)' : 'none',
                                WebkitBackdropFilter: wsBg ? 'blur(6px)' : 'none',
                                borderRadius: '12px',
                                padding: '0.875rem',
                                cursor: 'grab',
                                opacity: task.status === 'done' ? 0.7 : 1,
                                boxShadow: isPinned 
                                  ? 'var(--shadow-md), 0 0 12px rgba(189, 29, 45, 0.1)' 
                                  : (wsBg ? '0 4px 12px rgba(0,0,0,0.06)' : 'var(--shadow-sm)'),
                                transition: 'all 0.2s',
                                position: 'relative',
                                minWidth: 0,
                                overflow: 'hidden',
                                flexShrink: 0
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor = isPinned 
                                  ? 'var(--color-primary, #BD1D2D)' 
                                  : (isOverdue && task.status !== 'done' ? 'var(--color-danger)' : 'var(--color-primary, #BD1D2D)');
                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor = isPinned 
                                  ? 'var(--color-primary, #BD1D2D)' 
                                  : (isOverdue && task.status !== 'done' ? 'var(--color-danger)' : 'var(--color-border-light)');
                                e.currentTarget.style.boxShadow = isPinned 
                                  ? 'var(--shadow-md), 0 0 12px rgba(189, 29, 45, 0.1)' 
                                  : 'var(--shadow-sm)';
                              }}
                            >
                              {/* Drag handle & header info */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span className={`badge ${task.priority === 'high' ? 'danger' : 'warning'}`} style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                                    {task.priority === 'high' ? 'Cao' : 'Trung bình'}
                                  </span>
                                  <TaskGroupBadge
                                    task={task}
                                    groups={taskGroups}
                                    onAssignGroup={handleAssignTaskGroup}
                                    onOpenCreateModal={() => setShowCardCreateGroupModal(true)}
                                  />
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePinTask(task.id);
                                  }}
                                  style={{
                                    border: 'none',
                                    background: isPinned ? 'rgba(189, 29, 45, 0.15)' : 'transparent',
                                    color: isPinned ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-light)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                  }}
                                  title={isPinned ? t('Bỏ ghim công việc') : t('Ghim công việc')}
                                >
                                  <Pin size={12} style={{ transform: isPinned ? 'rotate(0deg)' : 'rotate(45deg)', transition: 'transform 0.2s' }} />
                                </button>
                              </div>

                              {/* Task Image Preview */}
                              {task.first_image_url && (
                                <div style={{
                                  width: '100%',
                                  height: '100px',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  border: '1px solid var(--color-border-light)',
                                  background: 'var(--color-bg-alt)',
                                  marginBottom: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <img 
                                    src={task.first_image_url.startsWith('http') || task.first_image_url.startsWith('blob:') || task.first_image_url.startsWith('data:')
                                      ? task.first_image_url 
                                      : `${import.meta.env.VITE_API_URL || '/backend'}/${task.first_image_url}`} 
                                    alt="Task Preview" 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).parentElement!.style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}

                              {/* Task Title */}
                              <p style={{ 
                                fontSize: '0.8125rem', 
                                fontWeight: 600, 
                                color: 'var(--color-text)', 
                                margin: '0 0 6px 0', 
                                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                                lineHeight: '1.25'
                              }}>
                                {task.subject}
                              </p>

                              {/* Task Description */}
                              {cleanDesc && (
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
                                  {cleanDesc}
                                </p>
                              )}

                              {/* Attachment Link */}
                              {link && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '6px' }} onClick={e => e.stopPropagation()}>
                                  <Paperclip size={11} style={{ color: 'var(--color-primary, #BD1D2D)', flexShrink: 0 }} />
                                  <a 
                                    href={link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    style={{ fontSize: '0.75rem', color: 'var(--color-primary, #BD1D2D)', fontWeight: 500, textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  >
                                    {link.includes('uploads/') ? link.split('/').pop().replace(/^\d+_/, '') : link}
                                  </a>
                                </div>
                              )}

                              {/* Related Entity Badge */}
                              {(() => {
                                const hasKanbanContact = Boolean((task.related_type === 'contact' && task.related_id) || task.contact_name || task.contact_id);
                                const kContactId = task.contact_id || (task.related_type === 'contact' ? task.related_id : null);
                                const kContactName = formatVietnameseFullName(task.contact_name || (task.related_type === 'contact' ? t('Khách hàng') : ''));

                                if (!hasKanbanContact || !kContactName) return null;

                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '20px',
                                        color: 'var(--color-text, #334155)',
                                        background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))',
                                        border: '1px solid var(--color-border-light, rgba(0,0,0,0.06))',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        cursor: kContactId ? 'pointer' : 'default',
                                        maxWidth: '100%',
                                        transition: 'all 0.15s ease'
                                      }}
                                      onClick={(e) => {
                                        if (kContactId) {
                                          e.stopPropagation();
                                          handleOpenContactProfile(Number(kContactId), 'info', {
                                            id: Number(kContactId),
                                            full_name: kContactName,
                                            avatar_url: task.contact_avatar,
                                            _isLoading: true
                                          });
                                        }
                                      }}
                                      title={kContactName}
                                    >
                                      <Avatar 
                                        src={task.contact_avatar} 
                                        name={kContactName} 
                                        size={14} 
                                      />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {kContactName}
                                      </span>
                                    </span>
                                  </div>
                                );
                              })()}

                              {/* Footer metadata */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', paddingTop: '6px', marginTop: 'auto' }}>
                                <div>
                                  {task.due_date && (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: '12px', color: dateBadgeColor, background: dateBadgeBg, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      <Clock size={10} /> {getDueDateLabel(task.due_date, task.status === 'done', t)}
                                    </span>
                                  )}
                                </div>

                                {(() => {
                                  const assigneeUser = users.find((u: any) => String(u.id) === String(task.user_id));
                                  const approverUser = task.approver_id ? users.find((u: any) => String(u.id) === String(task.approver_id)) : null;
                                  const participantIds = task.participant_ids ? task.participant_ids.split(',').filter(Boolean) : [];
                                  const participantUsers = participantIds.map((id: string) => users.find((u: any) => String(u.id) === String(id))).filter(Boolean);

                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }} onClick={(e) => {
                                      if (participantUsers.length > 0) {
                                        e.stopPropagation();
                                        setSelectedTaskParticipants(participantUsers);
                                        setParticipantsModalOpen(true);
                                      }
                                    }}>
                                      {/* Assignee Avatar */}
                                      {assigneeUser && (
                                        <div title={`Chịu trách nhiệm: ${assigneeUser.full_name}`} style={{ position: 'relative', display: 'flex' }}>
                                          <Avatar src={assigneeUser.avatar_url || assigneeUser.avatar} name={assigneeUser.full_name} size={22} />
                                          <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--color-primary, #BD1D2D)', borderRadius: '50%', width: 8, height: 8, border: '1.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                                        </div>
                                      )}

                                      {/* Approver Avatar */}
                                      {approverUser && (
                                        <div title={`Người duyệt: ${approverUser.full_name}`} style={{ position: 'relative', display: 'flex' }}>
                                          <Avatar src={approverUser.avatar_url || approverUser.avatar} name={approverUser.full_name} size={22} />
                                          <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--color-warning)', borderRadius: '50%', width: 8, height: 8, border: '1.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                                        </div>
                                      )}

                                      {/* Overlapping Participant Avatars */}
                                      {participantUsers.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '2px', position: 'relative' }}>
                                          {participantUsers.slice(0, 3).map((pUser: any, pIdx: number) => (
                                            <div
                                              key={pUser.id}
                                              title={`Người liên quan: ${pUser.full_name}`}
                                              style={{
                                                marginLeft: pIdx > 0 ? '-6px' : '0px',
                                                border: '1.5px solid white',
                                                borderRadius: '50%',
                                                overflow: 'hidden',
                                                zIndex: 10 - pIdx,
                                                display: 'flex'
                                              }}
                                            >
                                              <Avatar src={pUser.avatar_url || pUser.avatar} name={pUser.full_name} size={20} />
                                            </div>
                                          ))}
                                          {participantUsers.length > 3 && (
                                            <div
                                              style={{
                                                marginLeft: '-6px',
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                background: 'var(--color-border)',
                                                color: 'var(--color-text-muted)',
                                                fontSize: '0.6rem',
                                                fontWeight: 800,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: '1.5px solid white',
                                                zIndex: 5,
                                                cursor: 'pointer'
                                              }}
                                            >
                                              +{participantUsers.length - 3}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}
                        {columnTasks.length > 20 && (
                          <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: '8px', border: '1px dashed var(--color-border-light)', margin: '0.5rem' }}>
                            {t('Hiển thị 20 / {total} công việc. Hãy dùng tìm kiếm/bộ lọc để tìm các công việc khác.').replace('{total}', String(columnTasks.length))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                };

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: '1rem', alignItems: 'start', width: '100%' }}>
                    {renderKanbanColumn('todo', t('Cần làm'), todoTasks, 'var(--color-text-muted)', '#e2e8f0')}
                    {renderKanbanColumn('in_progress', t('Đang làm'), inProgressTasks, 'var(--color-warning)', 'rgba(245, 158, 11, 0.12)')}
                    {renderKanbanColumn('done', t('Đã xong'), doneTasks, 'var(--color-success)', 'rgba(16, 185, 129, 0.12)')}
                  </div>
                );
              })()}
            </>
          ) : (
            /* Focus Mode (Fullscreen Zen Mode) */
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '16px',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '360px minmax(0, 1fr)',
              overflow: 'hidden',
              height: isMobile ? 'auto' : 'calc(100vh - 120px)',
              minHeight: isMobile ? '600px' : '0',
              width: '100%'
            }}>
              {/* Left Column: Tasks List */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                borderRight: isMobile ? 'none' : '1px solid var(--color-border-light)',
                height: '100%',
                overflowY: 'auto'
              }}>
                <div style={{ 
                  padding: '1.25rem 1rem', 
                  borderBottom: '1px solid var(--color-border-light)', 
                  background: 'var(--color-surface)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setWsViewMode('grid');
                        setSelectedTaskForDetails(null);
                        setIsFocusSessionActive(false);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-light)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        transition: 'background 0.2s'
                      }}
                      className="hover-bg-light"
                      title={t('Quay lại')}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                      {t('CHẾ ĐỘ TẬP TRUNG')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    <span>{t('DANH SÁCH CÔNG VIỆC')} ({filteredWsTasks.length})</span>
                  </div>
                </div>

                {/* Filter Dropdown Select inside Focus Mode Left Panel */}
                <div style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--color-border-light)',
                  background: 'var(--color-bg-light)'
                }}>
                  <CustomSelect
                    value={(() => {
                      if (wsDatePreset === 'overdue') return 'overdue';
                      if (wsDatePreset === 'today') return 'today';
                      if (wsTaskFilter === 'approve_by_me') return 'approve_by_me';
                      if (wsTaskFilter === 'assigned_to_me') return 'assigned_to_me';
                      if (wsTaskFilter === 'collaborator') return 'collaborator';
                      return 'all';
                    })()}
                    onChange={(val) => {
                      if (val === 'all') {
                        setWsDatePreset('all');
                        setWsStatus('planned');
                        setWsTaskFilter('all');
                      } else if (val === 'overdue') {
                        setWsDatePreset('overdue');
                        setWsStatus('planned');
                        setWsTaskFilter('all');
                      } else if (val === 'today') {
                        setWsDatePreset('today');
                        setWsStatus('planned');
                        setWsTaskFilter('all');
                      } else if (val === 'approve_by_me') {
                        setWsTaskFilter('approve_by_me');
                        setWsStatus('planned');
                        setWsDatePreset('all');
                      } else if (val === 'assigned_to_me') {
                        setWsTaskFilter('assigned_to_me');
                        setWsStatus('planned');
                        setWsDatePreset('all');
                      } else if (val === 'collaborator') {
                        setWsTaskFilter('collaborator');
                        setWsStatus('planned');
                        setWsDatePreset('all');
                      }
                    }}
                    options={[
                      { value: 'all', label: t('Tất cả công việc') },
                      { value: 'assigned_to_me', label: t('Tôi thực hiện'), badge: { count: workspaceStats.assignedToMe || 0, color: '#2563eb' } },
                      { value: 'overdue', label: t('Công việc Quá hạn'), badge: { count: workspaceStats.overdue, color: 'var(--color-danger)' } },
                      { value: 'today', label: t('Công việc Đến hạn hôm nay'), badge: { count: workspaceStats.dueToday, color: 'var(--color-warning)' } },
                      { value: 'approve_by_me', label: t('Chờ tôi duyệt'), badge: { count: workspaceStats.pendingApproval, color: '#8b5cf6' } },
                      { value: 'collaborator', label: t('Tôi liên quan'), badge: { count: workspaceStats.collaborator || 0, color: '#475569' } }
                    ]}
                    width="100%"
                    size="sm"
                  />
                </div>
                {/* Gamification Progress Bar */}
                {filteredWsTasks.length > 0 && (
                  <div style={{ padding: '0.65rem 1rem 0.8rem', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-bg-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                      <span>{t('Tiến độ công việc')}</span>
                      <span>
                        {filteredWsTasks.filter(tItem => tItem.status === 'done').length}/{filteredWsTasks.length} ({
                          Math.round((filteredWsTasks.filter(tItem => tItem.status === 'done').length / filteredWsTasks.length) * 100)
                        }%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--color-border-light)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${(filteredWsTasks.filter(tItem => tItem.status === 'done').length / filteredWsTasks.length) * 100}%`,
                        height: '100%',
                        background: 'var(--color-success)',
                        borderRadius: '3px',
                        transition: 'width 0.4s ease-in-out'
                      }} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', gap: '0.5rem' }}>
                  {filteredWsTasks.slice(0, 20).map(task => {
                    const isSelected = selectedTaskForDetails?.id === task.id;
                    const isPinned = pinnedTaskIds.includes(Number(task.id));
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleSelectTask(task)}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '10px',
                          border: isSelected 
                            ? '1.5px solid var(--color-primary, #BD1D2D)' 
                            : (isPinned ? '2px solid var(--color-primary, #BD1D2D)' : '1px solid var(--color-border-light)'),
                          background: isSelected 
                            ? 'var(--color-primary-light)' 
                            : (isPinned ? 'rgba(189, 29, 45, 0.03)' : 'var(--color-surface)'),
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          boxShadow: isPinned && !isSelected ? '0 2px 8px rgba(189, 29, 45, 0.1)' : 'none'
                        }}
                        className="hover-bg-alt"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: isSelected ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '180px',
                            flex: 1
                          }}>
                            {task.subject}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            {task.priority === 'high' && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 4px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                                {t('Gấp')}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePinTask(task.id);
                              }}
                              style={{
                                border: 'none',
                                background: isPinned ? 'rgba(189, 29, 45, 0.15)' : 'transparent',
                                color: isPinned ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-light)',
                                cursor: 'pointer',
                                padding: '2px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                              }}
                              title={isPinned ? t('Bỏ ghim công việc') : t('Ghim công việc')}
                            >
                              <Pin size={11} style={{ transform: isPinned ? 'rotate(0deg)' : 'rotate(45deg)', transition: 'transform 0.2s' }} />
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          <span>
                            {task.due_date ? getDueDateLabel(task.due_date, task.status === 'done', t) : ''}
                          </span>
                        </div>
                        
                        {(() => {
                          const assigneeId = task.user_id;
                          const assignee = users.find(u => String(u.id) === String(assigneeId));
                          const participantIds = task.participant_ids ? task.participant_ids.split(',').map((id: string) => id.trim()).filter(Boolean) : [];
                          const collaborators = users.filter(u => participantIds.includes(String(u.id)));
                          const progressVal = task.progress || 0;
                          const progressColor = progressVal < 33 
                            ? 'var(--color-danger)' 
                            : (progressVal < 66 
                                ? 'var(--color-warning)' 
                                : 'var(--color-success)'
                              );

                          return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                              {/* Left section: Assignee & Collaborators */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {assignee ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title={`${t('Người thực hiện')}: ${assignee.full_name}`}>
                                    <Avatar src={assignee.avatar_url || assignee.avatar} name={assignee.full_name} size={18} />
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Chưa gán')}</span>
                                )}
                                
                                {/* Collaborator Stack */}
                                {collaborators.length > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: '14px' }}>
                                    {collaborators.slice(0, 3).map((collab, index) => (
                                      <div
                                        key={collab.id}
                                        style={{
                                          marginLeft: index > 0 ? '-6px' : '0',
                                          zIndex: 10 - index,
                                          position: 'relative'
                                        }}
                                        title={`${t('Người liên quan')}: ${collab.full_name}`}
                                      >
                                        <Avatar
                                          src={collab.avatar_url || collab.avatar}
                                          name={collab.full_name}
                                          size={16}
                                          style={{ border: '1px solid var(--color-surface)' }}
                                        />
                                      </div>
                                    ))}
                                    {collaborators.length > 3 && (
                                      <div
                                        style={{
                                          width: 16,
                                          height: 16,
                                          borderRadius: '50%',
                                          background: 'var(--color-bg-light)',
                                          border: '1px solid var(--color-surface)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '0.55rem',
                                          fontWeight: 700,
                                          color: 'var(--color-text-muted)',
                                          marginLeft: '-6px',
                                          zIndex: 4,
                                          position: 'relative'
                                        }}
                                      >
                                        +{collaborators.length - 3}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Right section: Progress with color badge */}
                              <span style={{ fontWeight: 800, color: progressColor, background: `${progressColor}10`, padding: '2px 6px', borderRadius: '6px', fontSize: '0.68rem' }}>
                                {progressVal}%
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                  {filteredWsTasks.length > 20 && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: '8px', border: '1px dashed var(--color-border-light)', margin: '0.5rem' }}>
                      {t('Hiển thị 20 / {total} công việc. Hãy dùng tìm kiếm/bộ lọc để tìm các công việc khác.').replace('{total}', String(filteredWsTasks.length))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Task Detail Embed */}
              <div 
                className="focus-right-column"
                style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, overflow: 'hidden', minWidth: 0 }}
              >
                {selectedTaskForDetails ? (
                  <div style={{ height: '100%', width: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <Suspense fallback={null}>
                      <WorkspaceTaskDrawer
                        isOpen={true}
                        onClose={() => setSelectedTaskForDetails(null)}
                        task={selectedTaskForDetails}
                        taskGroups={taskGroups}
                        onUpdate={() => {
                          fetchPortalTasks();
                          fetchWorkspaceTasks();
                          window.dispatchEvent(new CustomEvent('task-updated'));
                        }}
                        users={users}
                        embedMode={true}
                        onOpenContact={(contactId: number, initialData?: any) => {
                          handleOpenContactProfile(contactId, 'info', initialData);
                        }}
                      />
                    </Suspense>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', gap: '1rem', padding: '2rem', flex: 1 }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary, #BD1D2D)', border: '1px solid var(--color-border-light)' }}>
                      <CheckSquare size={32} />
                    </div>
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <p style={{ fontWeight: 800, color: 'var(--color-text)', margin: 0, fontSize: '1rem' }}>
                        {t('CHẾ ĐỘ TẬP TRUNG (FOCUS MODE)')}
                      </p>
                      <p style={{ fontSize: '0.8125rem', margin: '6px auto 0', maxWidth: '320px', lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
                        {t('Chọn một công việc ở cột bên trái để bắt đầu gọi điện và ghi chú thông tin khách hàng trực tiếp.')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DragOverlay adjustScale={false}>
            {activeDragTask ? (
              <WorkspaceCardInner
                task={activeDragTask}
                isMobile={isMobile}
                wsBg={wsBg}
                theme={theme}
                isPinned={pinnedTaskIds.includes(Number(activeDragTask.id))}
                togglePinTask={togglePinTask}
                users={users}
                t={t}
                getDueDateLabel={getDueDateLabel}
                parseDescriptionAndChecklist={parseDescriptionAndChecklist}
                setChecklist={setChecklist}
                setSelectedTaskForDetails={setSelectedTaskForDetails}
                handleOpenContactProfile={handleOpenContactProfile}
                setSelectedTaskParticipants={setSelectedTaskParticipants}
                setParticipantsModalOpen={setParticipantsModalOpen}
                isOverlay={true}
                taskGroups={taskGroups}
                onAssignGroup={handleAssignTaskGroup}
                onOpenCreateGroupModal={() => setShowCardCreateGroupModal(true)}
                onToggleComplete={handleToggleTaskStatus}
                isCompleting={completingTaskId === activeDragTask.id}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
        )}
      </div>
    </div>
  );
};
