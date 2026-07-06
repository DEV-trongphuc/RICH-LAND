import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { withRouterFreezer } from '../components/RouterFreezer';
import {
  LogOut, LogIn, Search, Filter, AlertCircle, CheckCircle2,
  XCircle, Clock, FileText,
  Clock3, GitBranch, ArrowUpRight, ShieldAlert, Send, ArrowLeft,
  Sun, Moon, ChevronDown, AlertTriangle, ChevronLeft, ChevronRight,
  LayoutDashboard, Database, Ticket, Calendar, RefreshCw, Menu, Tag, Server, Scale, Settings, Info, Cpu,
  Camera, Video, Layers, Plus, Receipt, Building2, Users, User, Trash2, CheckSquare, X, Paperclip, LifeBuoy, Fingerprint, LayoutGrid, Monitor, Tv, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';

import { WarRoomFlightDeck } from '../components/Dashboard/WarRoomFlightDeck';
import { QuickAddLeadModal } from '../components/QuickAddLeadModal';
import {
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart,
  PieChart, Pie, Cell
} from 'recharts';
import toast from 'react-hot-toast';
import { useUIStore } from '../store/uiStore';

import { fetchAPI } from '../utils/api';
import { compressToWebP } from '../utils/imageCompress';
import { MentionInput } from '../components/ui/MentionInput';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useLanguage } from '../contexts/LanguageContext';
import { Avatar } from '../components/ui/Avatar';
import { EmptyCard } from '../components/ui/EmptyCard';
import { TableSkeleton, StatRowSkeleton, CalendarSkeleton } from '../components/ui/Skeleton';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { FairShareAudit } from './FairShareAudit';
import { InvoicesPage } from './InvoicesPage';
import ProjectsPage from './ProjectsPage';
import { FilesPage } from './FilesPage';
import { Consultants } from './Consultants';
import AttendancePage from './AttendancePage';
import api from '../api/axios';
import { CustomerProfileDrawer } from './CustomerProfileDrawer';
import { WorkspaceTaskDrawer } from './WorkspaceTaskDrawer';
import vnFlag from '../assets/vn.svg';
import usFlag from '../assets/us.svg';
import jpFlag from '../assets/jp.svg';
import cnFlag from '../assets/cn.svg';

const languagesList = [
  { code: 'vi', name: 'Tiếng Việt', flag: vnFlag },
  { code: 'en', name: 'English', flag: usFlag },
  { code: 'ja', name: '日本語', flag: jpFlag },
  { code: 'zh', name: '简体中文', flag: cnFlag }
] as const;

const DAY_LABELS: { [key: string]: string } = {
  "1": "Thứ 2",
  "2": "Thứ 3",
  "3": "Thứ 4",
  "4": "Thứ 5",
  "5": "Thứ 6",
  "6": "Thứ 7",
  "7": "Chủ Nhật"
};

const DEFAULT_SCHEDULE = {
  "1": { active: true, start: "08:00", end: "17:30" },
  "2": { active: true, start: "08:00", end: "17:30" },
  "3": { active: true, start: "08:00", end: "17:30" },
  "4": { active: true, start: "08:00", end: "17:30" },
  "5": { active: true, start: "08:00", end: "17:30" },
  "6": { active: true, start: "08:00", end: "17:30" },
  "7": { active: true, start: "08:00", end: "17:30" }
};

const isCurrentlyOnLeave = (profile: any) => {
  if (!profile || !profile.leave_start || !profile.leave_end) return false;
  const now = new Date();
  const start = new Date(profile.leave_start + ' 00:00:00');
  const end = new Date(profile.leave_end + ' 23:59:59');
  return now >= start && now <= end;
};

const parseServerDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();
  if (trimmed.includes('T') || trimmed.includes('+') || trimmed.includes('Z')) {
    return new Date(trimmed);
  }
  const isoStr = trimmed.replace(' ', 'T') + '+07:00';
  return new Date(isoStr);
};

const getDueDateLabel = (dateStr: string | null | undefined, isDone: boolean, t: any) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  if (isDone) return d.toLocaleDateString('vi-VN');
  const today = new Date().setHours(0,0,0,0);
  const due = d.setHours(0,0,0,0);
  if (due === today) return t('Hôm nay');
  if (due < today) {
    const diff = Math.ceil((today - due) / (1000 * 60 * 60 * 24));
    return `${t('Trễ')} ${diff} ${t('ngày')}`;
  }
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff <= 7) return `${t('Còn')} ${diff} ${t('ngày')}`;
  return d.toLocaleDateString('vi-VN');
};

interface SalePortalProps {
  isActive?: boolean;
  searchParams?: URLSearchParams;
  setSearchParams?: any;
  location?: any;
  activeTabProp?: 'dashboard' | 'workspace' | 'data' | 'tickets' | 'schedule' | 'calendar' | 'fair-share' | 'databank' | 'invoices' | 'projects' | 'files' | 'consultants';
  embedMode?: boolean;
}

const SalePortalInner = ({ location, activeTabProp, embedMode = false }: SalePortalProps) => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const loc = location || routerLocation;
  const { user, token, login, logout } = useAuth();
  const currentUser = user;
  const { language, setLanguage, t } = useLanguage();
  const { showConfirm } = useUIStore();


  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLangOpen) return;
    const handleClose = () => setIsLangOpen(false);
    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, [isLangOpen]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const localTheme = localStorage.getItem('richland_theme') as 'light' | 'dark';
    if (localTheme) {
      setTheme(localTheme);
      document.documentElement.setAttribute('data-theme', localTheme);
    } else {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = (event?: React.MouseEvent) => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';

    // Check if View Transition is supported and user does not prefer reduced motion
    if (!(document as any).startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTheme(nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('richland_theme', nextTheme);
      window.dispatchEvent(new Event('theme-change'));
      return;
    }

    // Get click position or fallback to center of the viewport
    const x = event ? event.clientX : window.innerWidth / 2;
    const y = event ? event.clientY : window.innerHeight / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = (document as any).startViewTransition(() => {
      setTheme(nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('richland_theme', nextTheme);
      window.dispatchEvent(new Event('theme-change'));
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`
      ];
      document.documentElement.animate(
        {
          clipPath: clipPath,
        },
        {
          duration: 600,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };


  // Parse initial search query from email link
  const getInitialSearch = () => {
    const params = new URLSearchParams(loc.search);
    return params.get('search') || '';
  };

  // State definitions
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({
    leads: [],
    rounds: [],
    consultants: [],
    stats: {
      total_received: 0,
      tickets_total: 0,
      tickets_approved: 0,
      tickets_rejected: 0,
      tickets_pending: 0
    },
    by_round: [],
    by_hour: Array(24).fill(0)
  });
  const isAllowedToReport = data.is_allowed_to_report !== false;

  const [portalVacationMode, setPortalVacationMode] = useState(false);
  const [pendingCoopsCount, setPendingCoopsCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [search, setSearch] = useState(getInitialSearch());
  const [searchInput, setSearchInput] = useState(getInitialSearch());
  const [roundId, setRoundId] = useState('');
  const [saleIdFilter, setSaleIdFilter] = useState(() => {
    const params = new URLSearchParams(loc.search);
    return params.get('sale_id') || '';
  });
  const [dateMode, setDateMode] = useState('7_days'); // all, today, yesterday, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [flowViewMode, setFlowViewMode] = useState<'day' | 'hour'>('day');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    priority: 'medium',
    due_date: new Date().toISOString().slice(0, 10),
    description: '',
    link: '',
    related_id: '',
    user_id: '',
    progress: 0,
    require_approval: 0,
    approver_id: '',
    // ERP extra task properties
    internal_type: 'task',
    scope: 'team',
    recurrence_pattern: 'none',
    recurrence_weekly_days: [] as number[],
    recurrence_monthly_day: 1,
    participant_ids: [] as string[],
    related_contact_ids: [] as string[],
    checklist: [] as any[]
  });

  // Local states for subtasks creation
  const [subTaskTitle, setSubTaskTitle] = useState('');
  const [subTaskAssignee, setSubTaskAssignee] = useState('');
  const [taskTypeTab, setTaskTypeTab] = useState<'customer' | 'team' | 'personal'>('customer');

  const [currentPage, setCurrentPage] = useState(1);
  const [databankPage, setDatabankPage] = useState(1);
  const [calendarSubTab, setCalendarSubTab] = useState<'calendar' | 'attendance'>('calendar');
  const [wsTaskFilter, setWsTaskFilter] = useState<'all' | 'assigned_to_me' | 'approve_by_me' | 'collaborator'>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [wsSubTab, setWsSubTab] = useState<'customer' | 'team' | 'personal'>('customer');
  const [wsTeamSubFilter, setWsTeamSubFilter] = useState<'all' | 'task' | 'announcement' | 'campaign' | 'policy'>('all');
  
  // Task participant modal states
  const [selectedTaskParticipants, setSelectedTaskParticipants] = useState<any[]>([]);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);

  // Authentication states
  const [googleError, setGoogleError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isAdminMsg, setIsAdminMsg] = useState('');

  // Ticket submission modal states
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [reportReasonType, setReportReasonType] = useState('Số điện thoại không đúng / Thuê bao');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [showWarRoom, setShowWarRoom] = useState(false);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeDetailLead, setActiveDetailLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [isReleasingLead, setIsReleasingLead] = useState(false);
  const [profileContact, setProfileContact] = useState<any>(null);
  const [profileDrawerTab, setProfileDrawerTab] = useState<string>('info');

  // Tab & Layout states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workspace' | 'data' | 'tickets' | 'schedule' | 'calendar' | 'fair-share' | 'databank' | 'invoices' | 'projects' | 'files' | 'consultants'>(activeTabProp || 'dashboard');
  const [sourceViewMode, setSourceViewMode] = useState<'connection' | 'lead'>('connection');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [vacationConfirmOpen, setVacationConfirmOpen] = useState(false);

  // Filter states for workspace tasks
  const [wsSearch, setWsSearch] = useState('');
  const [wsPriority, setWsPriority] = useState('');
  const [wsStatus, setWsStatus] = useState('planned'); // Default: hide completed
  const [wsViewMode, setWsViewMode] = useState<'grid' | 'kanban' | 'focus'>('grid');
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [activeOverCol, setActiveOverCol] = useState<'todo' | 'in_progress' | 'done' | null>(null);
  const [wsDatePreset, setWsDatePreset] = useState('all');
  const [completedCallsCount, setCompletedCallsCount] = useState<number>(0);
  const [showCallsModal, setShowCallsModal] = useState(false);
  const [modalCalls, setModalCalls] = useState<any[]>([]);
  const [loadingModalCalls, setLoadingModalCalls] = useState(false);
  const [callsSearch, setCallsSearch] = useState('');
  const [wsStartDate, setWsStartDate] = useState('');
  const [wsEndDate, setWsEndDate] = useState('');
  const [wsTasks, setWsTasks] = useState<any[]>([]);
  const [wsTeamId, setWsTeamId] = useState('');
  const [wsUserId, setWsUserId] = useState('');
  const [wsActivityType, setWsActivityType] = useState('task');
  const [wsRelatedType, setWsRelatedType] = useState('');
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<Array<{ text: string; checked: boolean }>>([]);

  useEffect(() => {
    const isFocus = wsViewMode === 'focus';
    const event = new CustomEvent('focus-mode-toggle', { detail: { isFocusMode: isFocus } });
    window.dispatchEvent(event);
  }, [wsViewMode]);

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

  const addChecklistItem = () => {
    setChecklist(prev => [...prev, { text: '', checked: false }]);
  };

  const toggleChecklistItem = (idx: number) => {
    setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c));
  };

  const updateChecklistItemText = (idx: number, val: string) => {
    setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, text: val } : c));
  };

  const removeChecklistItem = (idx: number) => {
    setChecklist(prev => prev.filter((_, i) => i !== idx));
  };
  const filteredWsTasks = useMemo(() => {
    let list = wsTasks;
    const currentUserId = Number(currentUser?.id);

    // Filter by main subtabs
    if (wsSubTab === 'customer') {
      list = list.filter(task => task.related_type && ['contact', 'deal', 'company'].includes(task.related_type));
    } else if (wsSubTab === 'personal') {
      list = list.filter(task => task.tags?.split(',').map((t: string) => t.trim()).includes('personal_task'));
    } else if (wsSubTab === 'team') {
      list = list.filter(task => {
        const isClientRelated = task.related_type && ['contact', 'deal', 'company'].includes(task.related_type);
        const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
        const isPersonal = tagsList.includes('personal_task');
        return !isClientRelated && !isPersonal;
      });

      // Filter by team sub-filters (announcements, campaigns, policies, internal tasks)
      if (wsTeamSubFilter !== 'all') {
        const targetTag = `internal_${wsTeamSubFilter}`;
        list = list.filter(task => {
          const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
          return tagsList.includes(targetTag);
        });
      }
    }

    // Apply quick filters (assignee, approver, collaborator)
    if (wsTaskFilter === 'assigned_to_me') {
      list = list.filter(task => Number(task.user_id) === currentUserId);
    } else if (wsTaskFilter === 'approve_by_me') {
      list = list.filter(task => task.require_approval === 1 && Number(task.approver_id) === currentUserId);
    } else if (wsTaskFilter === 'collaborator') {
      list = list.filter(task => {
        const pIds = task.participant_ids ? task.participant_ids.split(',').map(Number).filter(Boolean) : [];
        return pIds.includes(currentUserId);
      });
    }

    if (!wsSearch) return list;
    const searchVal = wsSearch.toLowerCase();
    return list.filter(task => {
      const subject = task.subject ? String(task.subject).toLowerCase() : '';
      const body = task.body ? String(task.body).toLowerCase() : '';
      const contactName = task.contact_name ? String(task.contact_name).toLowerCase() : '';
      const companyName = task.company_name ? String(task.company_name).toLowerCase() : '';
      const dealName = task.deal_name ? String(task.deal_name).toLowerCase() : '';
      return (
        subject.includes(searchVal) ||
        body.includes(searchVal) ||
        contactName.includes(searchVal) ||
        companyName.includes(searchVal) ||
        dealName.includes(searchVal)
      );
    });
  }, [wsTasks, wsSearch, wsTaskFilter, wsSubTab, wsTeamSubFilter, currentUser]);
  const [loadingWsTasks, setLoadingWsTasks] = useState(false);
  const [wsContacts, setWsContacts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Task details modal states inside SalePortal
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<any>(null);
  const [taskComments, setTaskComments] = useState<any[]>([]);
  const [loadingTaskComments, setLoadingTaskComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<{ name: string; url: string; type: 'image' | 'file' }[]>([]);
  const [uploadingCommentFile, setUploadingCommentFile] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const [showApproverDropdown, setShowApproverDropdown] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (activeTabProp) {
      setActiveTab(activeTabProp);
    }
  }, [activeTabProp]);

  const [publicLeads, setPublicLeads] = useState<any[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [isClaimingLeadId, setIsClaimingLeadId] = useState<number | null>(null);
  const [publicQuota, setPublicQuota] = useState<any>(null);
  const [claimLeadConfirmOpen, setClaimLeadConfirmOpen] = useState(false);
  const [claimLeadPerson, setClaimLeadPerson] = useState<{ id: number; name: string } | null>(null);

  // Check-in state variables
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [checkInReason, setCheckInReason] = useState('');
  const [todayCheckIn, setTodayCheckIn] = useState<any>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Night shift state variables
  const [nightShiftRegistered, setNightShiftRegistered] = useState(false);
  const [nightShiftLoading, setNightShiftLoading] = useState(true);
  const [nightShiftCanToggle, setNightShiftCanToggle] = useState(true);
  const [nightShiftDate, setNightShiftDate] = useState('');
  const [togglingNightShift, setTogglingNightShift] = useState(false);

  // Sliding tab indicator
  const [sliderStyle, setSliderStyle] = useState({ top: 0, height: 0 });
  const navContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (navContainerRef.current) {
        const activeBtn = navContainerRef.current.querySelector('[data-active="true"]') as HTMLElement;
        if (activeBtn) {
          setSliderStyle({
            top: activeBtn.offsetTop,
            height: activeBtn.offsetHeight
          });
        } else {
          setSliderStyle({ top: 0, height: 0 });
        }
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activeTab, isCollapsed]);

  // Calendar states
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<any>(null);
  const [dayDetailsLoading, setDayDetailsLoading] = useState(false);
  const [activeCalendarModalTab, setActiveCalendarModalTab] = useState<'sales' | 'tickets'>('sales');

  // Ticket detail modal states
  const [selectedDetailTicket, setSelectedDetailTicket] = useState<any>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);

  // Profile settings states
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editWorkStartTime, setEditWorkStartTime] = useState('08:00');
  const [editWorkEndTime, setEditWorkEndTime] = useState('17:30');
  const [editWorkSchedule, setEditWorkSchedule] = useState<any>(DEFAULT_SCHEDULE);
  const [scheduleMode, setScheduleMode] = useState<'daily' | 'custom'>('daily');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editCitizenId, setEditCitizenId] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [editLeaveStart, setEditLeaveStart] = useState('');
  const [editLeaveEnd, setEditLeaveEnd] = useState('');
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);

  // Enterprise ERP Profile Extra Fields
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editContractType, setEditContractType] = useState('official');
  const [editDateJoined, setEditDateJoined] = useState('');
  const [editDirectManager, setEditDirectManager] = useState('');
  const [editWorkplace, setEditWorkplace] = useState('');
  const [editPersonalPhone, setEditPersonalPhone] = useState('');
  const [editExtNumber, setEditExtNumber] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyRelation, setEditEmergencyRelation] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editTaxId, setEditTaxId] = useState('');
  const [editInsuranceId, setEditInsuranceId] = useState('');
  const [editBrokerLicense, setEditBrokerLicense] = useState('');
  const [editDegree, setEditDegree] = useState('');

  const [editNationality, setEditNationality] = useState('');
  const [editMaritalStatus, setEditMaritalStatus] = useState('');
  const [editPersonalEmail, setEditPersonalEmail] = useState('');
  const [editHometown, setEditHometown] = useState('');
  const [editBankBranch, setEditBankBranch] = useState('');

  const [consultantDocs, setConsultantDocs] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Impersonation role calculation for admin viewing sale
  const impersonatedSale = ((user?.role === 'admin' || user?.role === 'superadmin') && saleIdFilter)
    ? data.consultants?.find((c: any) => String(c.id) === String(saleIdFilter))
    : null;

  const displayUser = impersonatedSale ? {
    ...user,
    name: impersonatedSale.name,
    avatar: impersonatedSale.avatar || null,
    email: impersonatedSale.email || '',
    role: 'sale',
    consultant_id: impersonatedSale.id,
    id: impersonatedSale.user_id ? Number(impersonatedSale.user_id) : user?.id
  } : user;

  const targetConsultantId = displayUser?.role === 'sale' ? displayUser?.consultant_id : (data.consultant_profile?.id || null);

  const fetchConsultantDocs = async () => {
    if (!targetConsultantId) return;
    try {
      const res = await api.get(`/cloud-files?category=consultant_${targetConsultantId}&limit=1000`);
      if (res.data && res.data.items) {
        setConsultantDocs(res.data.items);
      }
    } catch (err) {
      console.error("Error fetching consultant documents:", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'schedule' && targetConsultantId) {
      fetchConsultantDocs();
    }
  }, [activeTab, targetConsultantId]);

  const effectiveRole = displayUser?.role;

  // Find oldest active offered lead to accept
  const activeIncomingOffer = useMemo(() => {
    if (effectiveRole !== 'sale') return null;
    const unacceptedLeads = (data.leads || []).filter(
      (l: any) => !Number(l.is_accepted) && Number(l.lead_recall_minutes) > 0
    );
    if (unacceptedLeads.length === 0) return null;
    
    const activeOffers = unacceptedLeads.map((lead: any) => {
      const leadRecallMins = Number(lead.lead_recall_minutes) || 0;
      const limitMs = leadRecallMins * 60 * 1000;
      const elapsedMs = now - new Date(lead.last_interaction_date).getTime();
      const remainingMs = limitMs - elapsedMs;
      return { lead, remainingMs };
    }).filter(item => item.remainingMs > 0);

    if (activeOffers.length === 0) return null;
    activeOffers.sort((a, b) => a.remainingMs - b.remainingMs);
    return activeOffers[0];
  }, [data.leads, effectiveRole, now]);

  // Tickets states & loading logic
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState(() => {
    const params = new URLSearchParams(loc.search);
    return params.get('status') || 'all';
  });
  const [ticketDateFilter, setTicketDateFilter] = useState('Tất cả');
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketTotalCount, setTicketTotalCount] = useState(0);
  const TICKET_ITEMS_PER_PAGE = 10;
  const ticketTotalPages = Math.ceil(ticketTotalCount / TICKET_ITEMS_PER_PAGE);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const statusParam = params.get('status');
    if (activeTab === 'tickets' && statusParam) {
      setTicketStatusFilter(statusParam);
    }
  }, [loc.search, activeTab]);

  const loadTicketsData = async () => {
    if (!token) return;
    setTicketsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(ticketPage));
      queryParams.set('pageSize', String(TICKET_ITEMS_PER_PAGE));
      if (ticketStatusFilter !== 'all') {
        queryParams.set('status', ticketStatusFilter);
      }
      if (ticketDateFilter && ticketDateFilter !== 'Tất cả') {
        queryParams.set('date', ticketDateFilter);
      }
      if (displayUser?.consultant_id) {
        queryParams.set('consultant_id', String(displayUser.consultant_id));
      }

      const res = await fetchAPI(`get_reports&${queryParams.toString()}`);
      if (res.success) {
        setTickets(res.data || []);
        setTicketTotalCount(res.total_count ?? 0);
      } else {
        toast.error(res.message || t('Không thể tải danh sách ticket'));
      }
    } catch (err: any) {
      if (err.message !== 'Unauthorized') {
        toast.error(t('Lỗi tải ticket: ') + err.message);
      }
    }
    setTicketsLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'tickets' && token) {
      loadTicketsData();
    }
  }, [token, ticketStatusFilter, ticketDateFilter, ticketPage, activeTab, displayUser?.consultant_id]);

  // Google Login element references
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  // Dynamically load Google Client library
  useEffect(() => {
    if (!document.getElementById('google-jssdk')) {
      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // Initialize Google Login button
  const handleGoogleLoginResponse = async (response: any) => {
    setGoogleLoading(true);
    setGoogleError('');
    setIsAdminMsg('');

    if (localStorage.getItem('RICH LAND_DEMO_MODE') === 'true') {
      await new Promise(resolve => setTimeout(resolve, 500));
      login('demo_token_sale_1', {
        username: 'haidang',
        email: 'haidang@richland.net',
        name: 'Hải Đăng',
        role: 'sale',
        consultant_id: 1,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150'
      });
      toast.success(t('Chào mừng Hải Đăng quay trở lại!'));
      setGoogleLoading(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=login_google_sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const json = await res.json();
      if (json.success) {
        if (json.is_admin) {
          setIsAdminMsg(json.message || t('Bạn là admin, để xem đầy đủ vui lòng truy cập link gốc production.'));
        } else {
          login(json.token, json.user);
          toast.success(t('Chào mừng') + ` ${json.user.name} ` + t('quay trở lại!'));
        }
      } else {
        setGoogleError(json.message || t('Xác thực tài khoản Google thất bại'));
      }
    } catch (e) {
      setGoogleError(t('Không thể kết nối đến máy chủ xác thực Google. Vui lòng thử lại.'));
    }
    setGoogleLoading(false);
  };

  useEffect(() => {
    renderedRef.current = false;
  }, [theme, user]);

  useEffect(() => {
    let intervalId: any;
    const initGoogle = () => {
      if (renderedRef.current) {
        clearInterval(intervalId);
        return;
      }
      if ((window as any).google?.accounts?.id && googleBtnRef.current) {
        (window as any).google.accounts.id.initialize({
          client_id: '641158233158-nsg8a8tdsj3fdgb34dc9tugm8god7tho.apps.googleusercontent.com',
          callback: handleGoogleLoginResponse
        });
        (window as any).google.accounts.id.renderButton(
          googleBtnRef.current,
          { theme: theme === 'dark' ? 'filled_blue' : 'outline', size: 'large', width: 300, text: 'signin_with', shape: 'rectangular' }
        );
        renderedRef.current = true;
        clearInterval(intervalId);
      }
    };

    initGoogle();
    intervalId = setInterval(initGoogle, 500);
    return () => clearInterval(intervalId);
  }, [user, theme]);

  const [portalTasks, setPortalTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [pendingCoopSlips, setPendingCoopSlips] = useState<any[]>([]);
  const [loadingCoops, setLoadingCoops] = useState(false);

  const fetchPortalCoops = async () => {
    if (!token) return;
    setLoadingCoops(true);
    try {
      const res = await fetchAPI('cooperation-slips');
      if (res.success) {
        const slips = res.data || [];
        const filtered = slips.filter((s: any) => {
          const sh = s.shareholders?.find((x: any) => String(x.user_id) === String(displayUser?.id));
          return s.status !== 'rejected' && sh && !sh.signed;
        });
        setPendingCoopSlips(filtered);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCoops(false);
    }
  };

  const fetchPortalTasks = async () => {
    if (!token) return;
    setLoadingTasks(true);
    try {
      const res = await api.get('/activities?type=task&status=planned&limit=100');
      if (res.data && res.data.data) {
        setPortalTasks(res.data.data.items || res.data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTasks(false);
    }
  };

  const triggerRecurrenceCheck = async (tasksList: any[]) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const t of tasksList) {
      if (!t.body || !t.body.startsWith('{"erp_task":') || t.status !== 'done') continue;
      
      try {
        const parsed = JSON.parse(t.body);
        const erp = parsed.erp_task;
        if (!erp || !erp.recurrence || erp.recurrence.pattern === 'none') continue;
        
        // If it was already generated today, skip to prevent loops
        if (erp.recurrence.last_generated === todayStr) continue;

        // Calculate next due date
        const currentDueDate = new Date(t.due_date || t.created_at);
        let nextDueDate = new Date(currentDueDate);

        if (erp.recurrence.pattern === 'daily') {
          nextDueDate.setDate(nextDueDate.getDate() + 1);
        } else if (erp.recurrence.pattern === 'weekly') {
          const wDays = erp.recurrence.weekly_days || [];
          if (wDays.length === 0) {
            nextDueDate.setDate(nextDueDate.getDate() + 7);
          } else {
            let found = false;
            for (let i = 1; i <= 7; i++) {
              const testDate = new Date(currentDueDate);
              testDate.setDate(testDate.getDate() + i);
              if (wDays.includes(testDate.getDay())) {
                nextDueDate = testDate;
                found = true;
                break;
              }
            }
            if (!found) nextDueDate.setDate(nextDueDate.getDate() + 7);
          }
        } else if (erp.recurrence.pattern === 'monthly') {
          const mDay = erp.recurrence.monthly_day || 1;
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          nextDueDate.setDate(mDay);
        }

        const nextDueDateStr = nextDueDate.toISOString().slice(0, 10);
        
        // Only generate if today >= nextDueDateStr
        if (todayStr >= nextDueDateStr) {
          const newErp = {
            ...erp,
            recurrence: {
              ...erp.recurrence,
              last_generated: ''
            },
            checklist: (erp.checklist || []).map((c: any) => ({ ...c, done: false }))
          };

          await api.post('/activities', {
            subject: t.subject,
            type: 'task',
            priority: t.priority,
            due_date: nextDueDateStr,
            related_type: t.related_type,
            related_id: t.related_id ? Number(t.related_id) : null,
            user_id: t.user_id ? Number(t.user_id) : null,
            body: JSON.stringify({ erp_task: newErp }),
            status: 'planned',
            progress: 0,
            require_approval: t.require_approval,
            approver_id: t.approver_id ? Number(t.approver_id) : null,
            tags: t.tags
          });

          // Update the old task's last_generated to avoid duplicate generation
          const updatedOldErp = {
            ...erp,
            recurrence: {
              ...erp.recurrence,
              last_generated: todayStr
            }
          };
          await api.put(`/activities/${t.id}`, {
            body: JSON.stringify({ erp_task: updatedOldErp })
          });

          toast.success(`Tự động sinh nhiệm vụ định kỳ tiếp theo: ${t.subject}`);
        }
      } catch (err) {
        console.error('Error generating recurring task', err);
      }
    }
  };

  const getPresetDates = (preset: string) => {
    let start = '';
    let end = '';
    if (preset === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      start = todayStr;
      end = todayStr;
    } else if (preset === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomStr = tomorrow.toISOString().slice(0, 10);
      start = tomStr;
      end = tomStr;
    } else if (preset === 'week') {
      const today = new Date();
      const first = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1);
      const monday = new Date(today);
      const sunday = new Date(today);
      sunday.setDate(monday.getDate() + 6);
      start = monday.toISOString().slice(0, 10);
      end = sunday.toISOString().slice(0, 10);
    } else if (preset === '7_days') {
      const now = new Date();
      const startD = new Date();
      startD.setDate(now.getDate() - 7);
      start = startD.toISOString().slice(0, 10);
      end = now.toISOString().slice(0, 10);
    } else if (preset === '30_days') {
      const now = new Date();
      const startD = new Date();
      startD.setDate(now.getDate() - 30);
      start = startD.toISOString().slice(0, 10);
      end = now.toISOString().slice(0, 10);
    } else if (preset === 'this_month') {
      const now = new Date();
      const startD = new Date(now.getFullYear(), now.getMonth(), 1);
      const endD = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = startD.toISOString().slice(0, 10);
      end = endD.toISOString().slice(0, 10);
    } else if (preset === 'last_month') {
      const now = new Date();
      const startD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endD = new Date(now.getFullYear(), now.getMonth(), 0);
      start = startD.toISOString().slice(0, 10);
      end = endD.toISOString().slice(0, 10);
    } else if (preset === 'overdue') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      end = yesterday.toISOString().slice(0, 10);
    } else if (preset === 'custom') {
      start = wsStartDate;
      end = wsEndDate;
    }
    return { start, end };
  };

  const handleOpenCallsModal = async () => {
    setShowCallsModal(true);
    setLoadingModalCalls(true);
    setCallsSearch('');
    try {
      let { start, end } = getPresetDates(wsDatePreset);
      if (wsDatePreset === 'all') {
        const p7 = getPresetDates('7_days');
        start = p7.start;
        end = p7.end;
      }
      let url = '/activities?type=call&status=done&limit=100';
      if (start) url += `&start_date=${start}`;
      if (end) url += `&end_date=${end}`;
      if (wsUserId) url += `&user_id=${wsUserId}`;
      else url += `&user_id=${user?.id}`;

      const res = await api.get(url);
      if (res.data && res.data.data) {
        const rawCalls = res.data.data.items || res.data.data || [];
        setModalCalls(rawCalls);
      }
    } catch (e) {
      console.error(e);
      toast.error(t('Không thể tải danh sách cuộc gọi'));
    } finally {
      setLoadingModalCalls(false);
    }
  };

  const fetchWorkspaceTasks = async () => {
    if (!token) return;
    setLoadingWsTasks(true);
    try {
      let url = '/activities?limit=100';
      if (wsActivityType && wsActivityType !== 'all') {
        url += `&type=${wsActivityType}`;
      }
      if (wsRelatedType) {
        url += `&related_type=${wsRelatedType}`;
      }
      if (wsPriority) url += `&priority=${wsPriority}`;
      if (wsStatus) url += `&status=${wsStatus}`;
      
      const { start, end } = getPresetDates(wsDatePreset);

      if (start) url += `&start_date=${start}`;
      if (end) url += `&end_date=${end}`;
      if (wsTeamId && wsTeamId !== 'all_teams_bypass') url += `&team_id=${wsTeamId}`;
      if (wsUserId) url += `&user_id=${wsUserId}`;

      const res = await api.get(url);
      if (res.data && res.data.data) {
        const rawTasks = res.data.data.items || res.data.data || [];
        setWsTasks(rawTasks);
        triggerRecurrenceCheck(rawTasks);
      }

      // Fetch completed calls count
      let callsUrl = '/activities?type=call&status=done&limit=1';
      let callsStart = wsDatePreset === 'all' ? '' : start;
      let callsEnd = wsDatePreset === 'all' ? '' : end;
      if (callsStart) callsUrl += `&start_date=${callsStart}`;
      if (callsEnd) callsUrl += `&end_date=${callsEnd}`;
      
      if (wsUserId) {
        callsUrl += `&user_id=${wsUserId}`;
      } else if (currentUser?.role === 'sale') {
        callsUrl += `&user_id=${currentUser?.id}`;
      }

      const callsRes = await api.get(callsUrl);
      if (callsRes.data && callsRes.data.data) {
        setCompletedCallsCount(callsRes.data.data.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWsTasks(false);
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
    setWsTasks(prev => prev.map(x => x.id === taskId ? { ...x, status: nextStatus, progress: nextProgress } : x));
    
    try {
      await api.put(`/activities/${taskId}`, { 
        progress: nextProgress,
        status: nextStatus
      });
      const colLabel = targetCol === 'todo' ? 'Cần làm' : targetCol === 'in_progress' ? 'Đang làm' : 'Đã xong';
      toast.success(`Đã chuyển công việc sang cột ${colLabel}`);
      if (nextStatus === 'done') {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      }
      fetchWorkspaceTasks();
    } catch (err: any) {
      fetchWorkspaceTasks();
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật tiến độ công việc');
    }
  };

  useEffect(() => {
    if (activeTab === 'workspace') {
      fetchWorkspaceTasks();
    }
  }, [activeTab, wsPriority, wsStatus, wsDatePreset, wsStartDate, wsEndDate, wsTeamId, wsUserId, wsActivityType, wsRelatedType]);

  useEffect(() => {
    if (activeTab === 'workspace') {
      api.get('/contacts?limit=100').then(res => {
        if (res.data && res.data.data) {
          const items = res.data.data.items || res.data.data || [];
          setWsContacts(items);
        }
      }).catch(() => {});

      const isPrivileged = ['admin', 'superadmin', 'super_admin', 'manager'].includes(user?.role || '');
      if (isPrivileged) {
        api.get('/teams').then(res => {
          setTeamsList(res.data.data || res.data || []);
        }).catch(() => {});
      }
    }
  }, [activeTab, user?.role]);

  useEffect(() => {
    if (token) {
      api.get('/users').then(r => {
        const d = r.data.data;
        const list = Array.isArray(d) ? d : (d?.items || []);
        const team = list.filter((u: any) => {
          if (!u || !u.role) return false;
          const roleLower = u.role.toLowerCase();
          return ['admin', 'superadmin', 'super_admin', 'sales', 'sale', 'manager', 'assistant', 'telesale', 'prescreener', 'director', 'staff', 'employee'].includes(roleLower);
        });
        setUsers(team);
      }).catch(() => {});
    }
  }, [token]);

  const loadTaskComments = async (taskId: number) => {
    setLoadingTaskComments(true);
    try {
      const res = await api.get(`/activities/${taskId}/comments`);
      if (res.data.success) {
        setTaskComments(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTaskComments(false);
    }
  };

  useEffect(() => {
    if (selectedTaskForDetails?.id) {
      loadTaskComments(selectedTaskForDetails.id);
    } else {
      setTaskComments([]);
    }
  }, [selectedTaskForDetails?.id]);

  const renderFormattedText = (text: string) => {
    if (!text) return '';
    // Regex matches URLs or @mentions (supporting unicode characters and parentheses like @Minh_Khôi_(Manager))
    const regex = /(https?:\/\/[^\s]+|@[a-zA-Z0-9_\u00C0-\u1EF9()]+)/g;
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

  const handleCommentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('Dung lượng tệp tối đa cho phép là 10MB'));
      return;
    }
    setUploadingCommentFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    formData.append('category', 'comment');
    formData.append('visibility', 'shared');
    
    try {
      const uploadRes = await api.post('/cloud-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (uploadRes.data.success && uploadRes.data.data) {
        const fileUrl = uploadRes.data.data.path;
        const type = file.type.startsWith('image/') ? 'image' : 'file';
        setPendingAttachments(prev => [...prev, { name: file.name, url: fileUrl, type }]);
        toast.success(t('Đính kèm tệp thành công'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t('Lỗi khi đính kèm tệp'));
    } finally {
      setUploadingCommentFile(false);
      e.target.value = '';
    }
  };

  const handlePostTaskComment = async () => {
    if ((!newCommentText.trim() && pendingAttachments.length === 0) || !selectedTaskForDetails) return;
    try {
      const res = await api.post(`/activities/${selectedTaskForDetails.id}/comments`, {
        content: newCommentText.trim(),
        attachments: pendingAttachments
      });
      if (res.data.success) {
        setNewCommentText('');
        setPendingAttachments([]);
        loadTaskComments(selectedTaskForDetails.id);
      }
    } catch (e) {
      console.error(e);
      toast.error(t('Lỗi khi thêm bình luận'));
    }
  };

  const handleDeleteTaskComment = (commentId: number) => {
    showConfirm({
      title: t('Xóa bình luận'),
      message: t('Bạn có chắc chắn muốn xóa bình luận này không?'),
      confirmText: t('Xóa'),
      cancelText: t('Hủy'),
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.delete(`/activities/comments/${commentId}`);
          if (res.data.success) {
            toast.success(t('Đã xóa bình luận thành công!'));
            loadTaskComments(selectedTaskForDetails.id);
          }
        } catch (e) {
          console.error(e);
          toast.error(t('Lỗi khi xóa bình luận'));
        }
      }
    });
  };

  const resolveAttachmentUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = api.defaults.baseURL || '';
    const cleanBase = base.replace(/\/api\/?$/, '');
    return `${cleanBase}/${path}`;
  };

  const handleDetailTaskFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTaskForDetails) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('Dung lượng tệp tối đa cho phép là 10MB'));
      return;
    }
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    formData.append('category', 'general');
    formData.append('visibility', 'shared');
    if (selectedTaskForDetails.related_type === 'contact' && selectedTaskForDetails.related_id) {
      formData.append('contact_id', selectedTaskForDetails.related_id.toString());
    }
    try {
      const uploadRes = await api.post('/cloud-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (uploadRes.data.success && uploadRes.data.data) {
        const fileUrl = uploadRes.data.data.path;
        setSelectedTaskForDetails(prev => prev ? { ...prev, link: fileUrl } : null);
        toast.success(t('Đính kèm tệp thành công'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t('Lỗi khi tải tệp lên'));
    } finally {
      setUploadingFile(false);
    }
  };

  const closeTaskDetailsModal = () => {
    setSelectedTaskForDetails(null);
    setShowAssigneeDropdown(false);
    setShowParticipantDropdown(false);
    setShowApproverDropdown(false);
  };

  const handleSaveAllTaskDetails = async () => {
    if (!selectedTaskForDetails) return;
    setIsUpdatingTask(true);
    try {
      const payload: any = {
        subject: selectedTaskForDetails.title,
        body: serializeDescriptionAndChecklist(selectedTaskForDetails.description || '', checklist) + (selectedTaskForDetails.link ? `\n\nTài liệu/Link đính kèm: ${selectedTaskForDetails.link}` : ''),
        user_id: selectedTaskForDetails.user_id,
        status: selectedTaskForDetails.status,
        priority: selectedTaskForDetails.priority,
        due_date: selectedTaskForDetails.due_date,
        tags: selectedTaskForDetails.tags,
        participant_ids: selectedTaskForDetails.participant_ids,
        progress: selectedTaskForDetails.progress,
        require_approval: selectedTaskForDetails.require_approval,
        approver_id: selectedTaskForDetails.approver_id,
        approval_status: selectedTaskForDetails.approval_status
      };

      const nextProgress = selectedTaskForDetails.progress || 0;
      const nextReqApproval = selectedTaskForDetails.require_approval || 0;
      const nextApprovalStatus = selectedTaskForDetails.approval_status;

      if (nextProgress === 100) {
        if (nextReqApproval === 1) {
          if (nextApprovalStatus === 'approved') {
            payload.status = 'done';
            payload.approval_status = 'approved';
          } else if (nextApprovalStatus === 'rejected') {
            payload.status = 'planned';
            payload.approval_status = 'rejected';
            payload.progress = 90;
          } else {
            payload.status = 'planned';
            payload.approval_status = 'pending';
          }
        } else {
          payload.status = 'done';
          payload.approval_status = null;
        }
      } else {
        payload.status = 'planned';
        payload.approval_status = null;
      }

      const res = await api.put(`/activities/${selectedTaskForDetails.id}`, payload);
      if (res.status === 200) {
        toast.success(t('Đã lưu công việc thành công'));
        setSelectedTaskForDetails(null);
        fetchWorkspaceTasks();
      }
    } catch (e) {
      console.error(e);
      toast.error(t('Lỗi khi lưu công việc'));
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleUpdateTaskDetail = async (updatedFields: any) => {
    if (!selectedTaskForDetails) return;
    setIsUpdatingTask(true);
    try {
      const payload: any = {};
      if ('title' in updatedFields) payload.subject = updatedFields.title;
      
      const currentDesc = 'description' in updatedFields ? updatedFields.description : (selectedTaskForDetails.description || '');
      const currentLink = 'link' in updatedFields ? updatedFields.link : (selectedTaskForDetails.link || '');
      
      if ('description' in updatedFields || 'link' in updatedFields || 'checklist' in updatedFields) {
        const listItems = 'checklist' in updatedFields ? updatedFields.checklist : checklist;
        const finalDescription = serializeDescriptionAndChecklist(currentDesc, listItems);
        payload.body = finalDescription + (currentLink ? `\n\nTài liệu/Link đính kèm: ${currentLink}` : '');
      }

      const directFields = ['user_id', 'status', 'priority', 'due_date', 'tags', 'participant_ids', 'progress', 'require_approval', 'approver_id', 'approval_status'];
      directFields.forEach(f => {
        if (f in updatedFields) payload[f] = updatedFields[f];
      });

      if ('user_id' in updatedFields) {
        const newAssigneeId = String(updatedFields.user_id);
        const currentParticipants = (selectedTaskForDetails.participant_ids || '').split(',').filter(Boolean);
        const nextParticipants = currentParticipants.filter(id => id !== newAssigneeId);
        payload.participant_ids = nextParticipants.join(',');
        updatedFields.participant_ids = payload.participant_ids;
      }

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
            payload.progress = 90;
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
        fetchWorkspaceTasks();
      }
    } catch (err: any) {
      toast.error(t('Lỗi khi cập nhật công việc'));
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleToggleTaskStatus = async (taskId: number) => {
    try {
      await api.put(`/activities/${taskId}`, { status: 'done' });
      toast.success(t('Đã hoàn thành công việc'));
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      fetchPortalTasks();
    } catch (e) {
      toast.error(t('Lỗi khi cập nhật trạng thái công việc'));
    }
  };

  const loadCoopsPendingSign = async () => {
    if (!token) return;
    try {
      const res = await fetchAPI('cooperation-slips');
      if (res.success && Array.isArray(res.data)) {
        const pending = res.data.filter((c: any) => 
          (c.status === 'pending_signatures' || c.status === 'approved_pending_signatures') &&
          c.shareholders?.some((sh: any) => sh.user_id === user?.id && !sh.signed)
        );
        setPendingCoopsCount(pending.length);
      }
    } catch (e) {
      console.error("Error loading pending coops for signing:", e);
    }
  };

  const handleReleaseToDatabank = (leadId: number, contactId?: number) => {
    showConfirm({
      title: t('Nhả khách về Kho chung'),
      message: t('Bạn có chắc chắn muốn nhả khách hàng này về Kho chung (Databank)? Việc này sẽ thu hồi quyền sở hữu của các tư vấn viên hiện tại.'),
      confirmText: t('Nhả về Kho chung'),
      cancelText: t('Hủy'),
      isDanger: true,
      onConfirm: async () => {
        setIsReleasingLead(true);
        try {
          let res;
          if (contactId) {
            res = await fetchAPI(`contacts/${contactId}/release-databank`, {
              method: 'POST'
            });
            if (res && !res.hasOwnProperty('success')) {
              res = { success: true, message: res.message || t('Đã nhả về Kho chung thành công!') };
            }
          } else {
            res = await fetchAPI('release_to_databank', {
              method: 'POST',
              body: JSON.stringify({ lead_id: leadId })
            });
          }
          if (res.success || res.action) {
            toast.success(res.message || t('Đã nhả về Kho chung thành công!'));
            setDetailModalOpen(false);
            setActiveDetailLead(null);
            loadPortalData();
          } else {
            toast.error(res.message || t('Lỗi khi nhả về Kho chung.'));
          }
        } catch (e: any) {
          toast.error(t('Lỗi kết nối') + ': ' + e.message);
        } finally {
          setIsReleasingLead(false);
        }
      }
    });
  };

  // Fetch portal data when token is valid
  const loadPortalData = async () => {
    if (!token || !['sale', 'superadmin', 'admin', 'assistant', 'viewer'].includes(user?.role || '')) return;
    setLoading(true);
    fetchPortalTasks();
    fetchPortalCoops();
    loadCoopsPendingSign();


    loadCheckInStatus();
    loadNightShiftStatus();
    try {
      let query = `get_sale_portal_data&search=${encodeURIComponent(search)}&round_id=${roundId}&date_mode=${dateMode}&sale_id=${saleIdFilter}`;
      if (dateMode === 'custom') {
        query += `&start_date=${startDate}&end_date=${endDate}`;
      }
      const json = await fetchAPI(query);
      if (json.success) {
        setData(json);
        if (json.vacation_mode !== undefined) setPortalVacationMode(Boolean(Number(json.vacation_mode)));
      } else {
        toast.error(json.message || t('Không thể tải dữ liệu'));
      }
    } catch (err: any) {
      if (err.message !== 'Unauthorized') {
        toast.error(t('Lỗi tải dữ liệu: ') + err.message);
      }
    }
    setLoading(false);
  };

  const handleTogglePortalVacation = async () => {
    try {
      const json = await fetchAPI('toggle_consultant_vacation', {
        method: 'POST',
        body: JSON.stringify({ id: displayUser?.consultant_id })
      });
      if (json.success) {
        toast.success(t('Đã thay đổi trạng thái Tạm ngưng'));
        const nextMode = Boolean(Number(json.vacation_mode));
        setPortalVacationMode(nextMode);
        window.dispatchEvent(new CustomEvent('vacation-status-changed', { detail: nextMode }));
      } else {
        toast.error(json.message || t('Lỗi thay đổi trạng thái'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    }
  };

  const loadCheckInStatus = async () => {
    if (!token) return;
    try {
      const res = await fetchAPI('check-ins&today_only=1');
      if (res.success) {
        setTodayCheckIn(res.data);
        window.dispatchEvent(new CustomEvent('checkin-status-changed'));
      }
    } catch (err) {
      console.error("Error loading check-in status:", err);
    }
  };

  const loadNightShiftStatus = async () => {
    if (!token) return;
    setNightShiftLoading(true);
    try {
      const res = await fetchAPI('get_night_shift_status');
      if (res.success) {
        setNightShiftRegistered(res.registered);
        setNightShiftCanToggle(res.can_toggle);
        setNightShiftDate(res.shift_date);
      }
    } catch (e) {
      console.error("Error loading night shift status:", e);
    } finally {
      setNightShiftLoading(false);
    }
  };

  const handleToggleNightShift = async () => {
    if (togglingNightShift) return;
    setTogglingNightShift(true);
    try {
      const res = await fetchAPI('register_night_shift', {
        method: 'POST',
        body: JSON.stringify({ register: !nightShiftRegistered })
      });
      if (res.success) {
        toast.success(res.message);
        setNightShiftRegistered(!nightShiftRegistered);
      } else {
        toast.error(res.message);
      }
    } catch (e: any) {
      toast.error(t('Lỗi đăng ký: ') + e.message);
    } finally {
      setTogglingNightShift(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setCapturedImage(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(t('Không thể truy cập camera. Vui lòng cấp quyền hoặc tải ảnh lên thay thế.'));
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const checkIsLate = () => {
    const workStart = impersonatedSale
      ? (impersonatedSale.work_start_time || '08:00')
      : (data.consultant_profile?.work_start_time || '08:00');
    const now = new Date();
    const curHM = now.toTimeString().substring(0, 5); 
    return curHM > workStart;
  };
  const isLate = checkIsLate();

  const fetchPublicLeads = async () => {
    setPublicLoading(true);
    setDatabankPage(1);
    try {
      const res = await fetchAPI('get_public_leads');
      if (res.success) {
        setPublicLeads(res.data || []);
        if (res.quota) {
          setPublicQuota(res.quota);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPublicLoading(false);
    }
  };

  const handleClaimLead = (personId: number, personName?: string) => {
    setClaimLeadPerson({ id: personId, name: personName || t('Khách hàng này') });
    setClaimLeadConfirmOpen(true);
  };

  const handleExecuteClaimLead = async () => {
    if (!claimLeadPerson) return;
    const personId = claimLeadPerson.id;
    setIsClaimingLeadId(personId);
    try {
      const json = await fetchAPI('claim_public_lead', {
        method: 'POST',
        body: JSON.stringify({ person_id: personId })
      });
      if (json.success) {
        toast.success(json.message || t('Nhận data thành công!'));
        setClaimLeadConfirmOpen(false);
        fetchPublicLeads();
        loadPortalData();
        if (json.contact_id) {
          navigate('/contacts?open_contact_id=' + json.contact_id);
        }
      } else {
        toast.error(json.message || t('Nhận data thất bại'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    } finally {
      setIsClaimingLeadId(null);
    }
  };



  useEffect(() => {
    if (activeTab === 'databank') {
      fetchPublicLeads();
    }
  }, [activeTab]);

  const handleSubmitCheckIn = async (fileToUpload?: File) => {
    setCheckInSubmitting(true);
    try {
      let selfieUrl = '';
      
      if (fileToUpload) {
        const compressedFile = await compressToWebP(fileToUpload);
        const formData = new FormData();
        formData.append('file', compressedFile);
        const uploadRes = await fetchAPI('upload', {
          method: 'POST',
          body: formData
        });
        if (uploadRes.success && uploadRes.data?.url) {
          selfieUrl = uploadRes.data.url;
        } else {
          toast.error(uploadRes.message || t('Lỗi tải ảnh lên'));
          setCheckInSubmitting(false);
          return;
        }
      } else if (capturedImage) {
        const compressToWebP = (dataUrl: string): Promise<Blob> => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((b) => {
                  if (b) resolve(b);
                  else reject(new Error('WebP conversion failed'));
                }, 'image/webp', 0.8); // 80% quality compression
              } else {
                reject(new Error('Canvas context error'));
              }
            };
            img.onerror = () => reject(new Error('Image loading error'));
          });
        };

        const webpBlob = await compressToWebP(capturedImage);
        const file = new File([webpBlob], 'selfie.webp', { type: 'image/webp' });
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetchAPI('upload', {
          method: 'POST',
          body: formData
        });
        if (uploadRes.success && uploadRes.data?.url) {
          selfieUrl = uploadRes.data.url;
        } else {
          toast.error(uploadRes.message || t('Lỗi tải ảnh lên'));
          setCheckInSubmitting(false);
          return;
        }
      } else {
        toast.error(t('Vui lòng chụp hình selfie hoặc tải ảnh lên.'));
        setCheckInSubmitting(false);
        return;
      }

      if (isLate && !checkInReason.trim()) {
        toast.error(t('Bạn đi trễ. Vui lòng điền lý do để quản lý duyệt.'));
        setCheckInSubmitting(false);
        return;
      }

      const res = await fetchAPI('check-ins', {
        method: 'POST',
        body: JSON.stringify({
          selfie_url: selfieUrl,
          reason: isLate ? checkInReason : null
        })
      });

      if (res.success) {
        toast.success(res.message || t('Check-in thành công!'));
        setCheckInModalOpen(false);
        setCapturedImage(null);
        setCheckInReason('');
        loadCheckInStatus();
        loadPortalData();
      } else {
        toast.error(res.message || t('Check-in thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi check-in: ') + err.message);
    }
    setCheckInSubmitting(false);
  };

  useEffect(() => {
    if (checkInModalOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [checkInModalOpen]);

  useEffect(() => {
    const handleTriggerCheckIn = () => {
      setCheckInModalOpen(true);
    };
    window.addEventListener('trigger-checkin-modal', handleTriggerCheckIn);
    
    // Check localStorage flag
    if (localStorage.getItem('trigger_checkin') === '1') {
      localStorage.removeItem('trigger_checkin');
      setCheckInModalOpen(true);
    }

    return () => {
      window.removeEventListener('trigger-checkin-modal', handleTriggerCheckIn);
    };
  }, []);

  useEffect(() => {
    const handleVacationChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setPortalVacationMode(customEvent.detail);
    };
    window.addEventListener('vacation-status-changed', handleVacationChange);
    return () => {
      window.removeEventListener('vacation-status-changed', handleVacationChange);
    };
  }, []);

  const handleOpenContactProfile = async (contactId: number, tab: string = 'info') => {
    if (!contactId) return;
    setProfileDrawerTab(tab);
    try {
      const res = await api.get(`/contacts/${contactId}`);
      if (res.data.success && res.data.data) {
        setProfileContact(res.data.data);
      } else {
        toast.error(t('Không thể lấy chi tiết liên hệ'));
      }
    } catch (e: any) {
      console.error(e);
      toast.error(t('Lỗi khi tải thông tin khách hàng'));
    }
  };

  const handleAcceptLead = async (leadId: number) => {
    try {
      const json = await fetchAPI('accept_lead', {
        method: 'POST',
        body: JSON.stringify({ lead_id: leadId })
      });
      if (json.success) {
        toast.success(t('Tiếp nhận lead thành công!'));
        loadPortalData();
      } else {
        toast.error(json.message || t('Lỗi tiếp nhận lead'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    }
  };

  useEffect(() => {
    if (data.consultant_profile) {
      setEditName(data.consultant_profile.name || '');
      setEditAvatar(data.consultant_profile.avatar || '');
      setEditWorkStartTime(data.consultant_profile.work_start_time || '08:00');
      setEditWorkEndTime(data.consultant_profile.work_end_time || '17:30');
      setEditDob(data.consultant_profile.dob || '');
      setEditGender(data.consultant_profile.gender || '');
      setEditCitizenId(data.consultant_profile.citizen_id || '');
      
      const rawAddress = data.consultant_profile.address || '';
      if (rawAddress.startsWith('{"erp_profile":')) {
        try {
          const parsed = JSON.parse(rawAddress);
          const erp = parsed.erp_profile || {};
          setEditAddress(erp.address_text || '');
          setEditEmployeeId(erp.employee_id || '');
          setEditDepartment(erp.department || '');
          setEditJobTitle(erp.job_title || '');
          setEditContractType(erp.contract_type || 'official');
          setEditDateJoined(erp.date_joined || '');
          setEditDirectManager(erp.direct_manager || '');
          setEditWorkplace(erp.workplace || '');
          setEditPersonalPhone(erp.personal_phone || '');
          setEditExtNumber(erp.ext_number || '');
          setEditEmergencyName(erp.emergency_contact_name || '');
          setEditEmergencyRelation(erp.emergency_contact_relationship || '');
          setEditEmergencyPhone(erp.emergency_contact_phone || '');
          setEditTaxId(erp.tax_id || '');
          setEditInsuranceId(erp.insurance_id || '');
          setEditBrokerLicense(erp.broker_license || '');
          setEditDegree(erp.degree || '');
          setEditNationality(erp.nationality || '');
          setEditMaritalStatus(erp.marital_status || '');
          setEditPersonalEmail(erp.personal_email || '');
          setEditHometown(erp.hometown || '');
          setEditBankBranch(erp.bank_branch || '');
        } catch (e) {
          setEditAddress(rawAddress);
        }
      } else {
        setEditAddress(rawAddress);
        setEditEmployeeId('');
        setEditDepartment('');
        setEditJobTitle('');
        setEditContractType('official');
        setEditDateJoined('');
        setEditDirectManager('');
        setEditWorkplace('');
        setEditPersonalPhone('');
        setEditExtNumber('');
        setEditEmergencyName('');
        setEditEmergencyRelation('');
        setEditEmergencyPhone('');
        setEditTaxId('');
        setEditInsuranceId('');
        setEditBrokerLicense('');
        setEditDegree('');
        setEditNationality('');
        setEditMaritalStatus('');
        setEditPersonalEmail('');
        setEditHometown('');
        setEditBankBranch('');
      }

      setEditBankName(data.consultant_profile.bank_name || '');
      setEditBankAccount(data.consultant_profile.bank_account || '');
      setEditLeaveStart(data.consultant_profile.leave_start || '');
      setEditLeaveEnd(data.consultant_profile.leave_end || '');

      const schedule = data.consultant_profile.work_schedule;
      if (schedule && Object.keys(schedule).length > 0) {
        setEditWorkSchedule(schedule);
        setScheduleMode('custom');
      } else {
        setEditWorkSchedule(DEFAULT_SCHEDULE);
        setScheduleMode('daily');
      }
    }
  }, [data.consultant_profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const compressedFile = await compressToWebP(file);
      const fd = new FormData();
      fd.append('avatar', compressedFile);

      const oldAvatar = editAvatar || '';
      const query = `upload_avatar&old_avatar=${encodeURIComponent(oldAvatar)}`;

      const res = await fetchAPI(query, {
        method: 'POST',
        body: fd
      });

      if (res.success && res.url) {
        setEditAvatar(res.url);
        toast.success(t('Tải lên ảnh đại diện thành công!'));
      } else {
        toast.error(res.message || t('Lỗi tải ảnh đại diện lên'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối tải ảnh: ') + err.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast.error(t('Tên không được để trống.'));
      return;
    }
    setSavingProfile(true);
    try {
      const addressPayload = JSON.stringify({
        erp_profile: {
          address_text: editAddress,
          employee_id: editEmployeeId,
          department: editDepartment,
          job_title: editJobTitle,
          contract_type: editContractType,
          date_joined: editDateJoined,
          direct_manager: editDirectManager,
          workplace: editWorkplace,
          personal_phone: editPersonalPhone,
          ext_number: editExtNumber,
          emergency_contact_name: editEmergencyName,
          emergency_contact_relationship: editEmergencyRelation,
          emergency_contact_phone: editEmergencyPhone,
          tax_id: editTaxId,
          insurance_id: editInsuranceId,
          broker_license: editBrokerLicense,
          degree: editDegree,
          nationality: editNationality,
          marital_status: editMaritalStatus,
          personal_email: editPersonalEmail,
          hometown: editHometown,
          bank_branch: editBankBranch
        }
      });

      const payload = {
        consultant_id: displayUser?.role === 'sale' ? displayUser?.consultant_id : (data.consultant_profile?.id || null),
        name: editName.trim(),
        avatar: editAvatar,
        work_start_time: editWorkStartTime,
        work_end_time: editWorkEndTime,
        work_schedule: scheduleMode === 'custom' ? editWorkSchedule : null,
        dob: editDob,
        gender: editGender,
        citizen_id: editCitizenId,
        address: addressPayload,
        bank_name: editBankName,
        bank_account: editBankAccount,
        leave_start: editLeaveStart || null,
        leave_end: editLeaveEnd || null
      };

      const res = await fetchAPI('update_consultant_self_profile', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        toast.success(t('Cập nhật thông tin tài khoản thành công!'));
        loadPortalData();
      } else {
        toast.error(res.message || t('Lỗi lưu cài đặt tài khoản'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối lưu thiết lập: ') + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const fetchLeaveHistory = async () => {
    setLoadingLeaves(true);
    try {
      const saleId = displayUser?.role === 'sale' ? displayUser?.consultant_id : (data.consultant_profile?.id || null);
      const query = saleId ? `get_consultant_leaves&consultant_id=${saleId}` : 'get_consultant_leaves';
      const res = await fetchAPI(query);
      if (res.success) {
        setLeaveHistory(res.data || []);
      }
    } catch (err) {
      /* silent */
    } finally {
      setLoadingLeaves(false);
    }
  };

  const [submittingTask, setSubmittingTask] = useState(false);

  const handleCreatePortalTask = async () => {
    if (!taskForm.title.trim()) {
      toast.error(t('Vui lòng nhập tên công việc.'));
      return;
    }
    setSubmittingTask(true);

    let tagsPayload = '';
    if (taskTypeTab === 'personal') {
      tagsPayload = 'personal_task';
    } else if (taskTypeTab === 'team') {
      tagsPayload = `internal_${taskForm.internal_type || 'task'}`;
    }

    const additionalContactIds = (taskForm.related_contact_ids || [])
      .filter((id: any) => id !== 'all' && id !== '')
      .map(Number);

    // Always structure body as JSON to support Checklist, Links, and Recurrence
    const erpPayload = {
      erp_task: {
        description: taskForm.description.trim(),
        internal_type: taskTypeTab === 'team' ? (taskForm.internal_type || 'task') : 'task',
        scope: taskTypeTab === 'team' ? (taskForm.scope || 'team') : 'personal',
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

    const bodyPayload = JSON.stringify(erpPayload);

    try {
      await api.post('/activities', {
        subject: taskForm.title,
        type: 'task',
        priority: taskForm.priority,
        due_date: taskForm.due_date,
        related_type: (taskTypeTab === 'customer' && taskForm.related_id) ? 'contact' : null,
        related_id: (taskTypeTab === 'customer' && taskForm.related_id) ? Number(taskForm.related_id) : null,
        user_id: taskForm.user_id ? Number(taskForm.user_id) : currentUser?.id,
        body: bodyPayload,
        status: 'planned',
        progress: Number(taskForm.progress || 0),
        require_approval: Number(taskForm.require_approval || 0),
        approver_id: taskForm.approver_id ? Number(taskForm.approver_id) : null,
        tags: tagsPayload || null,
        participant_ids: participantIdsString || null
      });
      setShowTaskModal(false);
      setTaskForm({
        title: '',
        priority: 'medium',
        due_date: new Date().toISOString().slice(0, 10),
        description: '',
        link: '',
        related_id: '',
        user_id: '',
        progress: 0,
        require_approval: 0,
        approver_id: '',
        internal_type: 'task',
        scope: 'team',
        recurrence_pattern: 'none',
        recurrence_weekly_days: [],
        recurrence_monthly_day: 1,
        participant_ids: [] as string[],
        related_contact_ids: [] as string[],
        checklist: [] as any[]
      });
      fetchPortalTasks();
      fetchWorkspaceTasks();
      toast.success(t('Đã tạo công việc mới'));
    } catch (e) {
      toast.error(t('Lỗi khi tạo công việc'));
    } finally {
      setSubmittingTask(false);
    }
  };


  const [savingLeave, setSavingLeave] = useState(false);
  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLeaveStart || !editLeaveEnd) {
      toast.error(t('Vui lòng chọn đầy đủ Từ ngày và Đến ngày.'));
      return;
    }
    if (editLeaveStart > editLeaveEnd) {
      toast.error(t('Ngày bắt đầu không được lớn hơn ngày kết thúc.'));
      return;
    }
    setSavingLeave(true);
    try {
      const saleId = displayUser?.role === 'sale' ? displayUser?.consultant_id : (data.consultant_profile?.id || null);
      const payload = {
        consultant_id: saleId,
        start_date: editLeaveStart,
        end_date: editLeaveEnd
      };
      const res = await fetchAPI('add_consultant_leave', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        toast.success(t('Đăng ký nghỉ phép thành công!'));
        setEditLeaveStart('');
        setEditLeaveEnd('');
        fetchLeaveHistory();
        loadPortalData();
      } else {
        toast.error(res.message || t('Lỗi đăng ký nghỉ phép'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setSavingLeave(false);
    }
  };

  const handleDeleteLeave = (leaveId: number) => {
    showConfirm({
      title: t('Xác nhận xóa nghỉ phép'),
      message: t('Bạn có chắc chắn muốn xóa đăng ký nghỉ phép này không?'),
      confirmText: t('Xóa'),
      cancelText: t('Hủy'),
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI('delete_consultant_leave', {
            method: 'POST',
            body: JSON.stringify({ id: leaveId })
          });
          if (res.success) {
            toast.success(t('Đã xóa đăng ký nghỉ phép thành công!'));
            fetchLeaveHistory();
            loadPortalData();
          } else {
            toast.error(res.message || t('Lỗi khi xóa'));
          }
        } catch (err: any) {
          toast.error(t('Lỗi kết nối: ') + err.message);
        }
      }
    });
  };

  useEffect(() => {
    if (token && user?.id) {
      fetchLeaveHistory();
    }
  }, [token, user?.id, saleIdFilter, data.consultant_profile?.id]);

  useEffect(() => {
    loadPortalData();
  }, [token, user?.id, user?.role, roundId, dateMode, saleIdFilter, search, startDate, endDate]);



  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const uId = params.get('sale_id') || '';
    if (uId !== saleIdFilter) {
      setSaleIdFilter(uId);
    }
  }, [loc.search]);

  const handleExitImpersonation = () => {
    setSaleIdFilter('');
    const params = new URLSearchParams(loc.search);
    params.delete('sale_id');
    navigate(`/${params.toString() ? '?' + params.toString() : ''}`);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

  useEffect(() => {
    const handleLeadAdded = () => {
      loadPortalData();
    };
    window.addEventListener('lead-added', handleLeadAdded);
    return () => window.removeEventListener('lead-added', handleLeadAdded);
  }, [token, user, roundId, dateMode, saleIdFilter, startDate, endDate]);

  // Calendar stats fetch
  const fetchCalendarStats = async () => {
    if (!token) return;
    setCalendarLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      let consultantParam = '';
      if (displayUser?.role === 'sale') {
        consultantParam = displayUser.name;
      }
      const json = await fetchAPI(`get_calendar_stats&year=${year}&month=${month}&consultant=${encodeURIComponent(consultantParam)}`);
      if (json.success) {
        setCalendarData(json.data || {});
      }
    } catch (e: any) {
      console.error('Lỗi tải thống kê lịch biểu: ', e.message);
    }
    setCalendarLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'calendar') {
      fetchCalendarStats();
    }
  }, [activeTab, currentDate, saleIdFilter, token]);

  const handleDateClick = async (dateStr: string) => {
    setSelectedCalendarDate(dateStr);
    setDayDetailsLoading(true);
    setDayDetails(null);
    try {
      let consultantParam = '';
      if (displayUser?.role === 'sale') {
        consultantParam = displayUser.name;
      }
      const json = await fetchAPI(`get_calendar_day_details&date=${dateStr}&consultant=${encodeURIComponent(consultantParam)}`);
      if (json.success) {
        setDayDetails(json.data);
      }
    } catch (e: any) {
      toast.error(t('Lỗi tải chi tiết ngày: ') + e.message);
    }
    setDayDetailsLoading(false);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [data.leads]);

  // Load timeline for selected lead in modal
  useEffect(() => {
    if (activeDetailLead?.lead_id && detailModalOpen && token) {
      setLoadingTimeline(true);
      fetchAPI(`get_sale_lead_timeline&lead_id=${activeDetailLead.lead_id}`)
        .then((json) => {
          if (json.success) {
            setTimeline(json.timeline || []);
          } else {
            toast.error(json.message || 'Không thể tải lịch sử nhắc lại');
            setTimeline([]);
          }
        })
        .catch((err) => {
          console.error(err);
          setTimeline([]);
        })
        .finally(() => {
          setLoadingTimeline(false);
        });
    } else {
      setTimeline([]);
    }
  }, [activeDetailLead, detailModalOpen, token]);

  // Handle manual apply for Custom date and search button
  const handleApplyFilters = () => {
    setSearch(searchInput);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setSearch(searchInput);
    }
  };

  const handleDateModeChange = (val: string) => {
    setDateMode(val);
    if (val === 'custom') {
      setShowCustomDate(true);
    } else {
      setShowCustomDate(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success(t('Đã đăng xuất tài khoản.'));
  };

  const getReasonsList = (): { reason: string; note: string }[] => {
    return data.report_error_reasons || [
      { reason: 'Sai số điện thoại / Số ảo', note: 'Data có số điện thoại sai, không đúng, thiếu số, hoặc gọi thì báo không phải tên của khách hàng.' },
      { reason: 'Trùng của tôi', note: 'Data bị trùng, đã check CRCM mà thấy data có lần tương tác cuối cùng > {n} tháng nghĩa là giao đúng; hoặc data < {n} tháng mà giao thì báo cáo trùng; hoặc nhập data không được (tùy trường hợp sẽ xét).' },
      { reason: 'Trùng của người khác', note: 'Data bị trùng, đã check CRCM mà thấy data có lần tương tác cuối cùng > {n} tháng nghĩa là giao đúng; hoặc data < {n} tháng mà giao thì báo cáo trùng; hoặc nhập data không được (tùy trường hợp sẽ xét).' },
      { reason: 'Spam ảo / Junk lead', note: 'Data mà vừa giao gọi cuộc 1 đã báo hết nhu cầu rồi, không có đăng kí, cháu chắt phá, hoặc đăng kí cho vui.' },
      { reason: 'Khác', note: 'Là data Unqualified. Mọi data như đăng kí khác chuyên ngành như Luật/NNA, data mới cấp 3, không có tiếng anh (được ghi chú từ đầu bởi thông báo của MKT), là những data được định nghĩa Unqualified như trên Misa thì cứ báo cáo và ghi lý do ở dưới. Tạm thời c vẫn sẽ bù vòng.' }
    ];
  };

  // Submit quick ticket
  const handleOpenReportModal = (lead: any) => {
    setSelectedLead(lead);
    const rList = getReasonsList();
    setReportReasonType(rList[0]?.reason || '');
    setReportDetails('');
    setReportModalOpen(true);
  };

  const handleSubmitReport = async () => {
    if (!selectedLead) return;
    const isOtherReason = reportReasonType.toLowerCase().includes('khác') || reportReasonType.toLowerCase().includes('other');
    if (isOtherReason && !reportDetails.trim()) {
      toast.error(t('Vui lòng nhập mô tả chi tiết lý do lỗi.'));
      return;
    }
    setSubmittingReport(true);
    try {
      const finalReason = isOtherReason
        ? `${reportReasonType}: ${reportDetails.trim()}`
        : (reportDetails.trim() ? `${reportReasonType} (Ghi chú: ${reportDetails.trim()})` : reportReasonType);
      const payload = {
        lead_id: selectedLead.lead_id,
        sale_id: displayUser?.role === 'sale' ? displayUser?.consultant_id : selectedLead.assigned_to,
        round_id: selectedLead.round_id,
        reason: finalReason
      };

      const json = await fetchAPI('submit_report', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (json.success) {
        if (json.auto_approved) {
          toast.success(t('Báo cáo lỗi đã được HỆ THỐNG TỰ ĐỘNG PHÊ DUYỆT & ĐỀN BÙ thành công!'), { duration: 6000 });
        } else {
          toast.success(t('Gửi báo lỗi data thành công! Đang chờ admin duyệt bù.'));
        }
        setReportModalOpen(false);
        loadPortalData();
      } else {
        toast.error(json.message || t('Gửi báo lỗi thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Không thể kết nối máy chủ gửi báo lỗi') + (err.message ? ': ' + err.message : ''));
    }
    setSubmittingReport(false);
  };

  // Prepare chart data for Recharts (Hourly distribution)
  const hourlyChartData = data.by_hour.map((count: number, hr: number) => ({
    time: `${String(hr).padStart(2, '0')}:00`,
    volume: count
  }));

  const getDailyChartData = () => {
    const dailyMap: { [key: string]: number } = {};
    if (data.leads && Array.isArray(data.leads)) {
      data.leads.filter((l: any) => l.status !== 'reminder').forEach((lead: any) => {
        if (lead.received_at) {
          const dateStr = lead.received_at.split(' ')[0]; // "YYYY-MM-DD"
          dailyMap[dateStr] = (dailyMap[dateStr] || 0) + 1;
        }
      });
    }

    const sortedDates = Object.keys(dailyMap).sort();
    return sortedDates.map(dateStr => {
      const parts = dateStr.split('-'); // ["2026", "05", "28"]
      const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
      return {
        date: label,
        volume: dailyMap[dateStr]
      };
    });
  };

  const activeChartData = flowViewMode === 'day' ? getDailyChartData() : hourlyChartData;

  const [statusFilter, setStatusFilter] = useState(() => {
    const params = new URLSearchParams(loc.search);
    return params.get('status') || 'all';
  });

  const uncontactedCount = useMemo(() => {
    return (data.leads || []).filter((l: any) => 
      Number(l.is_accepted) === 1 && 
      l.contact_id && 
      !l.contact_last_contact && 
      l.status !== 'reminder'
    ).length;
  }, [data.leads]);

  useEffect(() => {
    sessionStorage.setItem('sale-uncontacted-count', String(uncontactedCount));
    window.dispatchEvent(new CustomEvent('uncontacted-count-changed', { detail: uncontactedCount }));
  }, [uncontactedCount]);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const statusParam = params.get('status');
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, [loc.search]);

  const getStatusBadge = (status: string, reportStatus?: string, aiScreenerStatus?: string, createdAt?: string, takers?: any[]) => {
    if (status === 'assigned' && reportStatus === 'pending') {
      return <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#4338ca', border: '1px solid rgba(99, 102, 241, 0.2)' }}>{t('Ticket Review')}</span>;
    }
    if (reportStatus === 'approved_no_comp') {
      return <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8', border: '1px solid rgba(59, 130, 246, 0.2)' }}>{t('Lỗi không bù')}</span>;
    }
    if (status === 'error' && reportStatus === 'approved') {
      return <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{t('Ticket')}</span>;
    }
    if (status === 'pending_approval' && aiScreenerStatus === 'pending') {
      const nowTime = new Date();
      const created = createdAt ? parseServerDate(createdAt) : nowTime;
      const diffMins = (nowTime.getTime() - created.getTime()) / 60000;
      if (diffMins >= -2 && diffMins < 5) {
        return <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#be185d', border: '1px solid rgba(236, 72, 153, 0.2)' }}>{t('Chờ AI đánh giá')}</span>;
      }
    }
    switch (status) {
      case 'assigned': return <span className="badge" style={{ background: 'rgba(13, 148, 136, 0.1)', color: '#0f766e', border: '1px solid rgba(13, 148, 136, 0.2)' }}>{t('Đã chia')}</span>;
      case 'compensation': return <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#6d28d9', border: '1px solid rgba(139, 92, 246, 0.2)' }}>{t('Data Bù')}</span>;
      case 'pending_work_hours': return <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.2)' }}>{t('Chờ giờ làm')}</span>;
      case 'error': return <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#be123c', border: '1px solid rgba(244, 63, 94, 0.2)' }}>{t('Ticket')}</span>;
      case 'pending': return <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#a16207', border: '1px solid rgba(234, 179, 8, 0.2)' }}>{t('Chờ chia')}</span>;
      case 'reminder': return <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#be185d', border: '1px solid rgba(236, 72, 153, 0.2)' }}>{t('Nhắc lại')}</span>;
      case 'duplicate': return <span className="badge" style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#991b1b', border: '1px solid rgba(220, 38, 38, 0.2)' }}>{t('Trùng lặp')}</span>;
      case 'rule_6_month': return <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8', border: '1px solid rgba(59, 130, 246, 0.2)' }}>{t('Quy định 6 tháng')}</span>;
      case 'silent': return <span className="badge" style={{ background: 'rgba(79, 70, 229, 0.1)', color: '#3730a3', border: '1px solid rgba(79, 70, 229, 0.2)' }}>{t('Chỉ đồng bộ')}</span>;
      case 'blacklisted': return <span className="badge" style={{ background: 'rgba(31, 41, 55, 0.1)', color: '#111827', border: '1px solid rgba(31, 41, 55, 0.2)' }}>{t('Blacklist')}</span>;
      case 'pending_approval': return <span className="badge" style={{ background: 'rgba(234, 88, 12, 0.1)', color: '#c2410c', border: '1px solid rgba(234, 88, 12, 0.2)' }}>{t('Tạm giữ')}</span>;
      case 'rejected': return <span className="badge" style={{ background: 'rgba(120, 53, 4, 0.1)', color: '#78350f', border: '1px solid rgba(120, 53, 4, 0.2)' }}>{t('Dưới chuẩn')}</span>;
      case 'fallback': return <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.2)' }}>{t('Fallback')}</span>;
      case 'databank_claim': return <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.2)' }}>{t('Đã nhận (Kho)')}</span>;
      case 'released_to_kho':
      case 'databank': {
        const cnt = takers && takers.length ? takers.length : 0;
        if (cnt === 0) {
          return <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#047857', border: '1px solid rgba(16,185,129,0.2)' }}>{t('Public (2/2)')}</span>;
        } else if (cnt >= 2) {
          return <span className="badge" style={{ background: 'rgba(107, 114, 128, 0.1)', color: '#4b5563', border: '1px solid rgba(107, 114, 128, 0.2)' }}>{t('Giới hạn (0/2)')}</span>;
        } else {
          return <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.2)' }}>{t(`Public (1/2)`)}</span>;
        }
      }
      default: return null;
    }
  };

  const filteredLeads = data.leads.filter((lead: any) => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'assigned') {
        if (!['assigned', 'rule_6_month', 'pending_work_hours', 'fallback', 'databank_claim'].includes(lead.status) || lead.report_status) return false;
      } else if (statusFilter === 'databank_claim') {
        if (lead.status !== 'databank_claim' || lead.report_status) return false;
      } else if (statusFilter === 'compensation') {
        if (lead.status !== 'compensation' || lead.report_status) return false;
      } else if (statusFilter === 'reminder') {
        if (lead.status !== 'reminder') return false;
      } else if (statusFilter === 'pending_ticket') {
        if (lead.report_status !== 'pending') return false;
      } else if (statusFilter === 'approved_ticket') {
        if (lead.report_status !== 'approved') return false;
      } else if (statusFilter === 'approved_no_comp_ticket') {
        if (lead.report_status !== 'approved_no_comp') return false;
      } else if (statusFilter === 'not_contacted') {
        if (lead.contact_last_contact) return false;
      } else if (statusFilter === 'rejected_ticket') {
        if (lead.report_status !== 'rejected') return false;
      }
    }
    return true;
  });

  const ITEMS_PER_PAGE = 10;
  const totalCount = filteredLeads.length;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Render Login Layout if not authorized
  if (!token || !['sale', 'superadmin', 'admin', 'assistant', 'viewer'].includes(user?.role || '')) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        position: 'relative',
        overflow: 'hidden',
        padding: '2rem'
      }}>
        {/* Animated Background Elements */}
        <div style={{
          position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, rgba(163, 20, 34,0.15) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%', filter: 'blur(60px)', animation: 'float 12s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%', width: '60vw', height: '60vw',
          background: 'radial-gradient(circle, rgba(189, 29, 45,0.15) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%', filter: 'blur(80px)', animation: 'float 15s ease-in-out infinite reverse'
        }} />

        <div style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 450,
          background: theme === 'dark' ? 'var(--color-surface)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          boxShadow: theme === 'dark' ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.05) inset' : '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
          padding: '3rem 2rem',
          textAlign: 'center',
          border: theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : 'none'
        }}>
          {/* Header/Logo */}
          <div style={{
            width: 64, height: 64, margin: '0 auto 1.5rem', borderRadius: '50%',
            background: 'linear-gradient(135deg, #a31422 0%, #8a0f1b 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(163, 20, 34,0.3)', overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.9)'
          }}>
            <img
              src="/LOGO.jpg"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo"
            />
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: theme === 'dark' ? '#f8fafc' : '#0f172a', letterSpacing: '-0.5px' }}>
            {t('CỔNG TƯ VẤN VIÊN')}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.925rem', marginTop: 6, lineHeight: 1.5 }}>
            {t('Vui lòng đăng nhập bằng tài khoản Google nhận mail để tra cứu danh sách khách hàng và quản lý tickets.')}
          </p>

          <div style={{ margin: '2rem 0' }}>
            {isAdminMsg ? (
              <div style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                padding: '1.25rem', borderRadius: '16px', color: '#b45309', fontSize: '0.9rem',
                lineHeight: 1.6, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontWeight: 700 }}>
                  <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                  <span>{t('Cảnh báo quản trị')}</span>
                </div>
                <span>{isAdminMsg}</span>
                <button
                  onClick={() => navigate('/')}
                  style={{
                    background: '#d97706', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '8px 16px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = '#b45309')}
                  onMouseOut={(e) => (e.currentTarget.style.background = '#d97706')}
                >
                  {t('Vào trang Quản trị')} <ArrowUpRight size={14} />
                </button>
              </div>
            ) : user && !['sale', 'superadmin', 'admin', 'assistant', 'viewer'].includes(user.role) ? (
              <div style={{
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                padding: '1.25rem', borderRadius: '16px', color: '#b45309', fontSize: '0.9rem',
                lineHeight: 1.6, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontWeight: 700 }}>
                  <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                  <span>{t('Quyền truy cập bị từ chối')}</span>
                </div>
                <span>{t('Tài khoản hiện tại của bạn không có vai trò Tư vấn viên. Vui lòng chuyển sang tài khoản Gmail của Sale hoặc đăng xuất.')}</span>
                <button
                  onClick={handleLogout}
                  style={{
                    background: '#d97706', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '8px 16px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
                  }}
                >
                  {t('Đăng xuất tài khoản')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                <div ref={googleBtnRef} style={{ minHeight: 44 }}></div>

                {localStorage.getItem('RICH LAND_DEMO_MODE') === 'true' && (
                  <button
                    onClick={() => {
                      setGoogleLoading(true);
                      setTimeout(() => {
                        login('demo_token_sale_1', {
                          username: 'haidang',
                          email: 'haidang@richland.net',
                          name: 'Hải Đăng',
                          role: 'sale',
                          consultant_id: 1,
                          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150'
                        });
                        toast.success(t('Chào mừng Hải Đăng quay trở lại!'));
                        setGoogleLoading(false);
                      }, 500);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px 24px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                      transition: 'all 0.2s',
                      width: 300,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                    onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <LogIn size={16} /> {t('Đăng nhập Demo (Tư vấn viên)')}
                  </button>
                )}

                {googleLoading && <div style={{ fontSize: '0.85rem', color: '#BD1D2D' }}>{t('Đang kết nối Google API...')}</div>}

                {googleError && (
                  <div style={{
                    padding: '0.75rem 1rem', background: 'var(--color-danger-light)', border: '1px solid var(--color-danger-light)',
                    color: 'var(--color-danger)', borderRadius: '12px', fontSize: '0.825rem', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: '6px', width: '100%', textAlign: 'left'
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{googleError}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
            {t('Hệ thống Quản lý Rich Land DATA')} &copy; 2026
          </div>
        </div>
        <style>{`
          @keyframes float {
            0% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-20px) scale(1.03); }
            100% { transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    );
  }

  // Active Sale Portal View
  const renderWorkspaceView = () => {
    const currentUser = user;
    const isAdminOrManager = ['admin', 'superadmin', 'super_admin', 'manager'].includes(String(user?.role || displayUser?.role || '').toLowerCase());
    const teamOptions = [
      { value: '', label: t('Tất cả Nhóm') },
      ...teamsList.map((t: any) => ({ value: String(t.id), label: t.name }))
    ];

    const consultantOptions = [
      { value: '', label: t('Tất cả Nhân viên') },
      ...users.map((u: any) => ({ value: String(u.id), label: u.full_name || u.username, avatar: u.avatar || u.avatar_url }))
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: wsViewMode === 'focus' ? '0' : '1.25rem' }}>
        {wsViewMode !== 'focus' && (
          <>
            {/* Workspace Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">{t("Bàn làm việc")}</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              {t("Quản lý toàn bộ công việc cần thực hiện, lọc chi tiết theo tiến độ và độ ưu tiên.")}
            </p>
          </div>
          <button 
            className="btn primary" 
            onClick={() => {
              setTaskForm({
                title: '',
                priority: 'medium',
                due_date: new Date().toISOString().slice(0, 10),
                description: '',
                link: '',
                related_id: '',
                user_id: '',
                progress: 0,
                require_approval: 0,
                approver_id: '',
                internal_type: 'task',
                scope: 'team',
                recurrence_pattern: 'none',
                recurrence_weekly_days: [],
                recurrence_monthly_day: 1,
                participant_ids: [] as string[],
                related_contact_ids: [] as string[],
                checklist: [] as any[]
              });
              setTaskTypeTab(wsSubTab);
              setShowTaskModal(true);
            }}
          >
            <Plus size={16} /> {t('Tạo công việc')}
          </button>
        </div>

        {/* Main Subtabs Selection (iOS Segmented Control style) */}
        <div style={{
          display: 'flex',
          background: 'rgba(15, 23, 42, 0.05)',
          padding: '4px',
          borderRadius: '12px',
          gap: '4px',
          width: 'fit-content',
          position: 'relative',
          border: '1px solid var(--color-border-light)'
        }}>
          {/* Sliding Pill Background Indicator */}
          <div style={{
            position: 'absolute',
            top: '4px',
            bottom: '4px',
            width: '210px',
            borderRadius: '10px',
            background: 'var(--color-surface)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: `translateX(${
              wsSubTab === 'customer' ? '0px' : 
              wsSubTab === 'team' ? '214px' : '428px'
            })`,
            zIndex: 1
          }} />

          {[
            { id: 'customer', label: t('Công việc khách hàng'), count: wsTasks.filter(task => task.related_type && ['contact', 'deal', 'company'].includes(task.related_type)).length },
            { id: 'team', label: t('Công việc nội bộ team'), count: wsTasks.filter(task => {
                const isClient = task.related_type && ['contact', 'deal', 'company'].includes(task.related_type);
                const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
                return !isClient && !tagsList.includes('personal_task');
              }).length
            },
            { id: 'personal', label: t('Công việc cá nhân'), count: wsTasks.filter(task => {
                const tagsList = task.tags ? task.tags.split(',').map((t: string) => t.trim()) : [];
                return tagsList.includes('personal_task');
              }).length
            }
          ].map(tab => {
            const isSelected = wsSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setWsSubTab(tab.id as any);
                  setWsTeamSubFilter('all');
                }}
                style={{
                  width: '210px',
                  height: '38px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  position: 'relative',
                  zIndex: 2,
                  transition: 'color 0.25s ease'
                }}
                className={isSelected ? "" : "hover-lift"}
              >
                <span>{tab.label}</span>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: isSelected ? 'var(--color-primary-light)' : 'rgba(15, 23, 42, 0.05)',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: 800,
                  transition: 'background 0.25s ease, color 0.25s ease'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Team sub-filters */}
        {wsSubTab === 'team' && (
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-light)',
            padding: '8px 12px',
            borderRadius: '12px'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', marginRight: '6px' }}>
              {t('Phân loại nội bộ:')}
            </span>
            {[
              { id: 'all', label: t('Tất cả'), color: 'var(--color-text-light)' },
              { id: 'task', label: t('Nhiệm vụ'), color: 'var(--color-success)' },
              { id: 'announcement', label: t('Thông báo'), color: 'var(--color-primary)' },
              { id: 'campaign', label: t('Chiến dịch'), color: '#db2777' },
              { id: 'policy', label: t('Chính sách'), color: '#ea580c' }
            ].map(sub => {
              const isSelected = wsTeamSubFilter === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setWsTeamSubFilter(sub.id as any)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: isSelected ? sub.color : 'rgba(0,0,0,0.03)',
                    color: isSelected ? 'white' : 'var(--color-text-light)'
                  }}
                  className="hover-lift"
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        )}

        {uncontactedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '16px',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 20px -6px rgba(239, 68, 68, 0.08)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            whileHover={{ 
              scale: 1.005, 
              borderColor: 'rgba(239, 68, 68, 0.45)',
              boxShadow: '0 8px 30px -6px rgba(239, 68, 68, 0.15)'
            }}
            onClick={() => {
              navigate('/data?status=not_contacted');
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                width: 44,
                height: 44,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: 'inset 0 2px 4px rgba(239, 68, 68, 0.06)'
              }}>
                <AlertCircle size={24} className="animate-pulse" />
              </div>
              <div>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-text)', display: 'block', letterSpacing: '-0.01em' }}>
                  Yêu cầu liên hệ khách hàng mới
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                  Bạn đang có <strong style={{ color: '#ef4444', fontSize: '0.95rem', fontWeight: 800 }}>{uncontactedCount}</strong> data khách hàng chưa liên hệ. Vui lòng kiểm tra và liên hệ ngay.
                </span>
              </div>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              color: '#ef4444', 
              fontWeight: 800, 
              fontSize: '0.875rem',
              background: 'rgba(239, 68, 68, 0.08)',
              padding: '8px 16px',
              borderRadius: '10px',
              transition: 'background 0.2s'
            }}>
              <span>Xem ngay</span>
              <ChevronRight size={16} />
            </div>
          </motion.div>
        )}

        {pendingCoopsCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '16px',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              cursor: 'pointer',
              boxShadow: '0 4px 20px -6px rgba(16, 185, 129, 0.08)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              marginBottom: '0.75rem'
            }}
            whileHover={{ 
              scale: 1.005, 
              borderColor: 'rgba(16, 185, 129, 0.45)',
              boxShadow: '0 8px 30px -6px rgba(16, 185, 129, 0.15)'
            }}
            onClick={() => {
              navigate('/cooperation-slips');
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                width: 44,
                height: 44,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: 'inset 0 2px 4px rgba(16, 185, 129, 0.06)'
              }}>
                <Scale size={24} className="animate-pulse" />
              </div>
              <div>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-text)', display: 'block', letterSpacing: '-0.01em' }}>
                  Yêu cầu ký phiếu hợp tác chia hoa hồng
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                  Bạn đang có <strong style={{ color: '#10b981', fontSize: '0.95rem', fontWeight: 800 }}>{pendingCoopsCount}</strong> phiếu hợp tác hoa hồng đang chờ ký xác nhận. Vui lòng ký ngay.
                </span>
              </div>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              color: '#10b981', 
              fontWeight: 800, 
              fontSize: '0.875rem',
              background: 'rgba(16, 185, 129, 0.08)',
              padding: '8px 16px',
              borderRadius: '10px',
              transition: 'background 0.2s'
            }}>
              <span>Ký ngay</span>
              <ChevronRight size={16} />
            </div>
          </motion.div>
        )}

        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '16px',
          padding: '0.75rem 1rem',
          boxShadow: '0 4px 20px -8px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          {/* Main Controls Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            width: '100%'
          }}>
            {/* Left side: Search & Advanced Filters Trigger */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '280px', maxWidth: isMobile ? '100%' : '500px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tìm theo tên, mô tả..."
                  value={wsSearch}
                  onChange={e => setWsSearch(e.target.value)}
                  style={{ height: '38px', fontSize: '0.85rem', padding: '8px 36px 8px 12px', borderRadius: '10px', width: '100%' }}
                />
              </div>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                style={{
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: showAdvancedFilters ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: showAdvancedFilters ? 'var(--color-primary-light)' : 'transparent',
                  color: showAdvancedFilters ? 'var(--color-primary)' : 'var(--color-text)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                <Filter size={14} />
                <span>{t('Bộ lọc')}</span>
                {(() => {
                  let count = 0;
                  if (wsPriority) count++;
                  if (wsStatus && wsStatus !== 'planned') count++;
                  if (wsDatePreset && wsDatePreset !== 'all') count++;
                  if (wsTeamId) count++;
                  if (wsUserId) count++;
                  return count > 0 ? (
                    <span style={{
                      background: 'var(--color-primary)',
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
            </div>

            {/* Right side: Role filters & View Mode switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
              {/* Completed Calls Count Pill */}
              <div 
                onClick={handleOpenCallsModal}
                className="hover-lift"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#10b981',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <Phone size={13} style={{ flexShrink: 0 }} />
                <span>
                  {t('Đã gọi:')} <strong>{completedCallsCount}</strong> {t('cuộc')}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '4px', background: 'rgba(15, 23, 42, 0.05)', padding: '4px', borderRadius: '10px', width: 'fit-content', position: 'relative', border: '1px solid var(--color-border-light)' }}>
                {/* Sliding Pill Background Indicator */}
                {(() => {
                  const tabs = [
                    { value: 'all', label: t('Tất cả') },
                    { value: 'assigned_to_me', label: t('Tôi thực hiện') },
                    currentUser && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'vp', 'leader', 'assistant'].includes(String(currentUser.role).toLowerCase()) && { value: 'approve_by_me', label: t('Tôi duyệt') },
                    { value: 'collaborator', label: t('Tôi liên quan') }
                  ].filter(Boolean) as any[];
                  const activeIndex = tabs.findIndex(t => t.value === wsTaskFilter);
                  const safeIndex = activeIndex === -1 ? 0 : activeIndex;
                  return (
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      bottom: '4px',
                      width: '110px',
                      borderRadius: '7px',
                      background: 'var(--color-surface)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: `translateX(${safeIndex * 114}px)`,
                      zIndex: 1
                    }} />
                  );
                })()}

                {[
                  { value: 'all', label: t('Tất cả') },
                  { value: 'assigned_to_me', label: t('Tôi thực hiện') },
                  currentUser && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'vp', 'leader', 'assistant'].includes(String(currentUser.role).toLowerCase()) && { value: 'approve_by_me', label: t('Tôi duyệt') },
                  { value: 'collaborator', label: t('Tôi liên quan') }
                ].filter((tab): tab is { value: string; label: string } => !!tab).map(tab => {
                  const isSelected = wsTaskFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setWsTaskFilter(tab.value as any)}
                      style={{
                        width: '110px',
                        height: '28px',
                        borderRadius: '7px',
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: 'transparent',
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        zIndex: 2,
                        transition: 'color 0.25s ease'
                      }}
                      className={isSelected ? "" : "hover-lift"}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div style={{
                display: 'flex',
                background: 'var(--color-border-light)',
                padding: '4px',
                borderRadius: '10px',
                gap: '4px'
              }}>
                <button
                  onClick={() => setWsViewMode('grid')}
                  title={t('Dạng lưới')}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '7px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: wsViewMode === 'grid' ? 'var(--color-surface)' : 'transparent',
                    color: wsViewMode === 'grid' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: wsViewMode === 'grid' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transform: 'none'
                  }}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setWsViewMode('kanban')}
                  title={t('Dạng Kanban')}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '7px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: wsViewMode === 'kanban' ? 'var(--color-surface)' : 'transparent',
                    color: wsViewMode === 'kanban' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: wsViewMode === 'kanban' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transform: 'none'
                  }}
                >
                  <Layers size={16} />
                </button>
                <button
                  onClick={() => setWsViewMode('focus')}
                  title={t('Chế độ Focus')}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '7px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: (wsViewMode as string) === 'focus' ? 'var(--color-surface)' : 'transparent',
                    color: (wsViewMode as string) === 'focus' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: (wsViewMode as string) === 'focus' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transform: 'none'
                  }}
                >
                  <Monitor size={16} />
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
                style={{ overflow: showAdvancedFilters ? 'visible' : 'hidden' }}
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
                        { value: 'done', label: t('Đã hoàn thành') }
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
                  {['admin', 'superadmin', 'super_admin', 'manager'].includes(currentUser?.role || '') && (
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
                  {['admin', 'superadmin', 'super_admin', 'manager'].includes(currentUser?.role || '') && (
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
                      <input
                        type="date"
                        className="form-input"
                        value={wsStartDate}
                        onChange={e => setWsStartDate(e.target.value)}
                        style={{ height: '36px', width: '140px', padding: '4px 8px', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Đến ngày:')}</span>
                      <input
                        type="date"
                        className="form-input"
                        value={wsEndDate}
                        onChange={e => setWsEndDate(e.target.value)}
                        style={{ height: '36px', width: '140px', padding: '4px 8px', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                )}

                {/* Clear Filter Toolbar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px dashed var(--color-border-light)',
                  gap: '8px'
                }}>
                  <button
                    type="button"
                    className="btn outline sm"
                    onClick={() => {
                      setWsPriority('');
                      setWsStatus('planned');
                      setWsDatePreset('all');
                      setWsStartDate('');
                      setWsEndDate('');
                      setWsTeamId('');
                      setWsUserId('');
                      setWsActivityType('task');
                      setWsRelatedType('');
                      setWsSearch('');
                      toast.success(t('Đã reset toàn bộ bộ lọc'));
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
        </>)}

        {/* Task Grid */}
        {isAdminOrManager && !wsTeamId && wsSubTab !== 'personal' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              {t('Vui lòng chọn một Nhóm để xem chi tiết công việc:')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
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
                  <div style={{ padding: '10px', background: 'rgba(189, 29, 45, 0.08)', borderRadius: '10px', color: 'var(--color-primary)', display: 'flex' }}>
                    <Layers size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-text)', margin: 0 }}>
                      {t('Tất cả các Nhóm')}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                      {t('Xem toàn bộ công việc hệ thống')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Individual Team Cards */}
              {teamsList.map(team => (
                <div
                  key={team.id}
                  onClick={() => setWsTeamId(String(team.id))}
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
                    <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '10px', color: '#2563eb', display: 'flex' }}>
                      <Users size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-text)', margin: 0 }}>
                        {team.name}
                      </h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                        {t('Bấm để xem công việc của nhóm')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Back button when inside a team view */}
            {isAdminOrManager && wsTeamId && wsSubTab !== 'personal' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem', background: 'var(--color-surface)', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                <button
                  onClick={() => setWsTeamId('')}
                  style={{
                    height: 32,
                    borderRadius: '8px',
                    border: '1px solid var(--color-primary)',
                    background: 'transparent',
                    color: 'var(--color-primary)',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 12px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                  className="hover-lift"
                >
                  <ArrowLeft size={14} /> {t('Quay lại danh sách nhóm')}
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {t('Đang xem nhóm:')} <strong style={{ color: 'var(--color-primary)' }}>{wsTeamId === 'all_teams_bypass' ? t('Tất cả các Nhóm') : (teamsList.find(t => String(t.id) === wsTeamId)?.name || wsTeamId)}</strong>
                </span>
              </div>
            )}

            {wsViewMode !== 'focus' && loadingWsTasks ? (
          <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
            <RefreshCw className="spin" size={24} style={{ color: 'var(--color-primary)', marginBottom: 8 }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Đang tải danh sách công việc...</div>
          </div>
        ) : wsViewMode !== 'focus' && filteredWsTasks.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)' }}>
            <CheckSquare size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>Không tìm thấy công việc nào phù hợp với bộ lọc.</p>
          </div>
        ) : wsViewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {filteredWsTasks.map(task => {
              const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0));
              const isToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();
              
              let dateBadgeColor = 'var(--color-text-muted)';
              let dateBadgeBg = 'var(--color-bg)';
              if (isOverdue) {
                dateBadgeColor = 'var(--color-danger)';
                dateBadgeBg = 'rgba(239, 68, 68, 0.08)';
              } else if (isToday) {
                dateBadgeColor = 'var(--color-warning)';
                dateBadgeBg = 'rgba(245, 158, 11, 0.08)';
              }

              const link = task.body && !task.body.startsWith('{"erp_task":') 
                ? (task.body.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m)?.[1]?.trim() || '') 
                : '';
              
              let description = '';
              if (task.body) {
                if (task.body.startsWith('{"erp_task":')) {
                  try {
                    const parsed = JSON.parse(task.body);
                    description = parsed.erp_task?.description || '';
                  } catch (e) {
                    description = task.body;
                  }
                } else {
                  description = task.body.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim();
                }
              }
              
              const progressVal = task.progress || 0;

              return (
                <div 
                  key={task.id} 
                  style={{
                    padding: '1.25rem',
                    background: 'var(--color-surface)',
                    border: isOverdue && task.status !== 'done' ? '1.5px solid var(--color-danger)' : '1px solid var(--color-border-light)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.875rem',
                    boxShadow: isOverdue && task.status !== 'done' ? 'var(--shadow-md), 0 0 12px rgba(239, 68, 68, 0.08)' : 'var(--shadow-sm)',
                    transition: 'all var(--transition-fluid)',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  className="hover-lift active-press"
                  onClick={() => {
                    const parsed = parseDescriptionAndChecklist(description);
                    const parsedTask = {
                      id: task.id,
                      title: task.subject,
                      done: task.status === 'done',
                      priority: task.priority,
                      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
                      link,
                      description: parsed.pureDescription,
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
                      related_id: task.related_id
                    };
                    setChecklist(parsed.checklist);
                    setSelectedTaskForDetails(parsedTask);
                  }}
                >
                  {/* Top Tags & Priority */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {task.tags && task.tags.split(',').filter(Boolean).map((tag: string) => {
                        return (
                          <span 
                            key={tag} 
                            style={{ 
                              fontSize: '0.68rem', 
                              padding: '2px 8px', 
                              borderRadius: '20px', 
                              background: 'var(--color-bg)', 
                              color: 'var(--color-text-light)', 
                              fontWeight: 700 
                            }}
                          >
                            #{tag.trim()}
                          </span>
                        );
                      })}
                    </div>
                    {task.priority === 'high' && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '20px', background: 'var(--color-danger-light)', color: 'var(--color-danger)', flexShrink: 0 }}>
                        {t('Khẩn cấp')}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0, lineHeight: 1.35 }}>
                      {task.subject}
                    </h3>
                    {description && (
                      <p style={{
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                        margin: 0,
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {description}
                      </p>
                    )}
                  </div>

                  {/* Progress Bar indicator */}
                  <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Tiến độ:</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: progressVal === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>{progressVal}%</span>
                    </div>
                    <div style={{ width: '100%', height: '12px', background: 'var(--color-border-light)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${progressVal}%`, 
                          height: '100%', 
                          background: progressVal === 100 
                            ? 'var(--color-success)' 
                            : 'linear-gradient(90deg, #BD1D2D, #F97316)', 
                          borderRadius: '99px',
                          transition: 'width 0.4s var(--transition-fluid)' 
                        }} 
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border-light)', margin: '4px 0' }} />

                  {/* Footer metadata */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {task.due_date && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', color: dateBadgeColor, background: dateBadgeBg, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} /> {getDueDateLabel(task.due_date, task.status === 'done', t)}
                          {isOverdue && task.status !== 'done' && <ShieldAlert size={10} style={{ marginLeft: 2 }} />}
                        </span>
                      )}
                      
                      {task.related_type === 'contact' && task.related_id && (
                        <span
                          style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
                            color: 'var(--color-primary)', background: 'var(--color-primary-light)', display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenContactProfile(Number(task.related_id));
                          }}
                        >
                          <Avatar name={task.contact_name || t('Khách hàng')} size={14} />
                          {task.contact_name || t('Khách hàng')}
                        </span>
                      )}
                    </div>

                    {(() => {
                      const assigneeUser = users.find((u: any) => String(u.id) === String(task.user_id));
                      const approverUser = task.approver_id ? users.find((u: any) => String(u.id) === String(task.approver_id)) : null;
                      const participantIds = task.participant_ids ? task.participant_ids.split(',').filter(Boolean) : [];
                      const participantUsers = participantIds.map((id: string) => users.find((u: any) => String(u.id) === String(id))).filter(Boolean);

                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => {
                          if (participantUsers.length > 0) {
                            e.stopPropagation();
                            setSelectedTaskParticipants(participantUsers);
                            setParticipantsModalOpen(true);
                          }
                        }}>
                          {/* Assignee Avatar */}
                          {assigneeUser && (
                            <div title={`Chịu trách nhiệm: ${assigneeUser.full_name}`} style={{ position: 'relative', display: 'flex' }}>
                              <Avatar src={assigneeUser.avatar_url || assigneeUser.avatar} name={assigneeUser.full_name} size={24} />
                              <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--color-primary)', borderRadius: '50%', width: 10, height: 10, border: '1.5px solid var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                            </div>
                          )}

                          {/* Approver Avatar */}
                          {approverUser && (
                            <div title={`Người duyệt: ${approverUser.full_name}`} style={{ position: 'relative', display: 'flex' }}>
                              <Avatar src={approverUser.avatar_url || approverUser.avatar} name={approverUser.full_name} size={24} />
                              <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--color-warning)', borderRadius: '50%', width: 10, height: 10, border: '1.5px solid var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
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
                                    marginLeft: pIdx > 0 ? '-8px' : '0px',
                                    border: '1.5px solid var(--color-surface)',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    zIndex: 10 - pIdx,
                                    display: 'flex'
                                  }}
                                >
                                  <Avatar src={pUser.avatar_url || pUser.avatar} name={pUser.full_name} size={22} />
                                </div>
                              ))}
                              {participantUsers.length > 3 && (
                                <div
                                  style={{
                                    marginLeft: '-8px',
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '50%',
                                    background: 'var(--color-border)',
                                    color: 'var(--color-text-muted)',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1.5px solid var(--color-surface)',
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
          </div>
        ) : wsViewMode === 'kanban' ? (
          /* Kanban View */
          <>
            {(() => {
              const todoTasks = filteredWsTasks.filter(t => t.status !== 'done' && (!t.progress || t.progress === 0));
              const inProgressTasks = filteredWsTasks.filter(t => t.status !== 'done' && t.progress > 0 && t.progress < 100);
              const doneTasks = filteredWsTasks.filter(t => t.status === 'done' || t.progress === 100);

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
                      minHeight: '450px',
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1, overflowY: 'auto', maxHeight: '600px' }}>
                      {columnTasks.map(task => {
                        const isOverdue = task.due_date && new Date(task.due_date) < new Date(new Date().setHours(0,0,0,0));
                        const isToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();
                        
                        let dateBadgeColor = 'var(--color-text-muted)';
                        let dateBadgeBg = 'var(--color-bg)';
                        if (isOverdue) {
                          dateBadgeColor = 'var(--color-danger)';
                          dateBadgeBg = 'rgba(239, 68, 68, 0.08)';
                        } else if (isToday) {
                          dateBadgeColor = 'var(--color-warning)';
                          dateBadgeBg = 'rgba(245, 158, 11, 0.08)';
                        }

                        const link = task.body && !task.body.startsWith('{"erp_task":') 
                          ? (task.body.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m)?.[1]?.trim() || '') 
                          : '';
                        
                        let description = '';
                        if (task.body) {
                          if (task.body.startsWith('{"erp_task":')) {
                            try {
                              const parsed = JSON.parse(task.body);
                              description = parsed.erp_task?.description || '';
                            } catch (e) {
                              description = task.body;
                            }
                          } else {
                            description = task.body.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim();
                          }
                        }
                        
                        const progressVal = task.progress || 0;

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => setDraggedTaskId(task.id)}
                            onDragEnd={() => setDraggedTaskId(null)}
                            onClick={() => {
                              const parsed = parseDescriptionAndChecklist(description);
                              const parsedTask = {
                                id: task.id,
                                title: task.subject,
                                done: task.status === 'done',
                                priority: task.priority,
                                due_date: task.due_date ? task.due_date.slice(0, 10) : '',
                                link,
                                description: parsed.pureDescription,
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
                                related_id: task.related_id
                              };
                              setChecklist(parsed.checklist);
                              setSelectedTaskForDetails(parsedTask);
                            }}
                            style={{
                              background: 'var(--color-surface)',
                              border: isOverdue && task.status !== 'done' ? '1.5px solid var(--color-danger)' : '1px solid var(--color-border-light)',
                              borderRadius: '12px',
                              padding: '0.875rem',
                              cursor: 'grab',
                              opacity: task.status === 'done' ? 0.7 : 1,
                              boxShadow: 'var(--shadow-sm)',
                              transition: 'all 0.2s',
                              position: 'relative'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = isOverdue && task.status !== 'done' ? 'var(--color-danger)' : 'var(--color-primary)';
                              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = isOverdue && task.status !== 'done' ? 'var(--color-danger)' : 'var(--color-border-light)';
                              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                            }}
                          >
                            {/* Drag handle & header info */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '4px' }}>
                              <span className={`badge ${task.priority === 'high' ? 'danger' : 'warning'}`} style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                                {task.priority === 'high' ? 'Cao' : 'Trung bình'}
                              </span>
                            </div>

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
                            {description && (
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
                                {description}
                              </p>
                            )}

                            {/* Attachment Link */}
                            {link && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '6px' }} onClick={e => e.stopPropagation()}>
                                <Paperclip size={11} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                                <a 
                                  href={link} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                  {link.includes('uploads/') ? link.split('/').pop().replace(/^\d+_/, '') : link}
                                </a>
                              </div>
                            )}

                            {/* Related Entity Badge */}
                            {task.related_type === 'contact' && task.related_id && (
                              <div style={{ marginBottom: '6px' }} onClick={e => e.stopPropagation()}>
                                <span
                                  style={{
                                    fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px',
                                    color: 'var(--color-primary)', background: 'var(--color-primary-light)', display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => handleOpenContactProfile(Number(task.related_id))}
                                >
                                  <Avatar name={task.contact_name || t('Khách hàng')} size={12} />
                                  {task.contact_name || t('Khách hàng')}
                                </span>
                              </div>
                            )}

                            {/* Tags */}
                            {task.tags && (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                {task.tags.split(',').filter(Boolean).map((tag: string) => (
                                  <span 
                                    key={tag} 
                                    style={{ 
                                      fontSize: '0.65rem', 
                                      padding: '2px 8px', 
                                      borderRadius: '20px', 
                                      background: 'var(--color-bg)', 
                                      color: 'var(--color-text-light)', 
                                      fontWeight: 700 
                                    }}
                                  >
                                    #{tag.trim()}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Progress Bar indicator */}
                            <div style={{ marginTop: '0.375rem', paddingTop: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Tiến độ:</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: progressVal === 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>{progressVal}%</span>
                              </div>
                              <div style={{ width: '100%', height: '12px', background: 'var(--color-border-light)', borderRadius: '99px', overflow: 'hidden' }}>
                                <div style={{ width: `${progressVal}%`, height: '100%', background: progressVal === 100 ? 'var(--color-success)' : 'linear-gradient(90deg, #BD1D2D, #F97316)', borderRadius: '99px', transition: 'width 0.4s var(--transition-fluid)' }} />
                              </div>
                            </div>

                            {/* Footer info (Due Date & Progress & Avatars) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '0.5rem', paddingTop: '0.375rem', borderTop: '1px solid var(--color-border-light)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  color: isOverdue && task.status !== 'done' ? 'var(--color-danger)' : 'var(--color-text-muted)', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '3px',
                                  fontWeight: isOverdue && task.status !== 'done' ? 600 : 'normal'
                                }}>
                                  <Clock size={10} />
                                  {getDueDateLabel(task.due_date, task.status === 'done', t)}
                                </span>
                                
                                {colId === 'in_progress' && (
                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)' }}>
                                    {progressVal}%
                                  </span>
                                )}
                              </div>

                              {/* Assignee & Participants Avatars */}
                              {(() => {
                                const assigneeUser = users.find((u: any) => String(u.id) === String(task.user_id));
                                const approverUser = task.approver_id ? users.find((u: any) => String(u.id) === String(task.approver_id)) : null;
                                const participantIds = task.participant_ids ? task.participant_ids.split(',').filter(Boolean) : [];
                                const participantUsers = participantIds.map((id: string) => users.find((u: any) => String(u.id) === String(id))).filter(Boolean);

                                if (!assigneeUser && !approverUser && participantUsers.length === 0) return null;

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
                                        <span style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--color-primary)', borderRadius: '50%', width: 8, height: 8, border: '1.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
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
                    </div>
                  </div>
                );
              };

              return (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem', alignItems: 'start', width: '100%' }}>
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
            gridTemplateColumns: isMobile ? '1fr' : '360px 1fr',
            overflow: 'hidden',
            height: isMobile ? 'auto' : 'calc(100vh - 120px)',
            minHeight: '600px',
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                    {t('CHẾ ĐỘ TẬP TRUNG')}
                  </span>
                  <button 
                    onClick={() => setWsViewMode('grid')}
                    style={{
                      border: 'none',
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: 'var(--color-danger)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    className="hover-lift"
                  >
                    <X size={12} />
                    {t('Thoát')}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  <span>{t('DANH SÁCH CÔNG VIỆC')} ({filteredWsTasks.length})</span>
                </div>
              </div>
              {/* Gamification Progress Bar */}
              {(filteredWsTasks.length > 0 || completedCallsCount > 0) && (
                <div style={{ padding: '0.65rem 1rem 0.8rem', borderBottom: '1px solid var(--color-border-light)', background: 'var(--color-bg-light)' }}>
                  {filteredWsTasks.length > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                        <span>{t('Tiến độ công việc')}</span>
                        <span>
                          {filteredWsTasks.filter(t => t.status === 'done').length}/{filteredWsTasks.length} ({
                            Math.round((filteredWsTasks.filter(t => t.status === 'done').length / filteredWsTasks.length) * 100)
                          }%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--color-border-light)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                        <div style={{
                          width: `${(filteredWsTasks.filter(t => t.status === 'done').length / filteredWsTasks.length) * 100}%`,
                          height: '100%',
                          background: 'var(--color-success)',
                          borderRadius: '3px',
                          transition: 'width 0.4s ease-in-out'
                        }} />
                      </div>
                    </>
                  )}
                  {/* Call Stats with dynamic preset label */}
                  <div 
                    onClick={handleOpenCallsModal}
                    className="hover-lift"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.72rem',
                      color: 'var(--color-text-muted)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: 'rgba(16, 185, 129, 0.06)',
                      padding: '5px 10px',
                      borderRadius: '8px',
                      marginTop: '2px',
                      border: '1px solid rgba(16, 185, 129, 0.12)'
                    }}
                  >
                    <Phone size={12} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                    <span>
                      {t('Đã thực hiện:')} <strong style={{ color: 'var(--color-success)', fontSize: '0.8rem' }}>{completedCallsCount}</strong> {t('cuộc gọi')} {
                        wsDatePreset === 'today' ? t('hôm nay') :
                        wsDatePreset === 'yesterday' ? t('hôm qua') :
                        wsDatePreset === 'week' ? t('tuần này') :
                        wsDatePreset === '7_days' ? t('7 ngày qua') :
                        wsDatePreset === '30_days' ? t('30 ngày qua') :
                        wsDatePreset === 'this_month' ? t('tháng này') :
                        wsDatePreset === 'last_month' ? t('tháng trước') :
                        wsDatePreset === 'tomorrow' ? t('ngày mai') :
                        wsDatePreset === 'overdue' ? t('quá hạn') :
                        t('từ trước tới nay')
                      }
                    </span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', gap: '0.5rem' }}>
                {filteredWsTasks.map(task => {
                  const isSelected = selectedTaskForDetails?.id === task.id;
                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        const link = task.body && !task.body.startsWith('{"erp_task":') 
                          ? (task.body.match(/Tài liệu\/Link đính kèm:\s*(.*)$/m)?.[1]?.trim() || '') 
                          : '';
                        
                        let description = '';
                        if (task.body) {
                          if (task.body.startsWith('{"erp_task":')) {
                            try {
                              const parsed = JSON.parse(task.body);
                              description = parsed.erp_task?.description || '';
                            } catch (e) {
                              description = task.body;
                            }
                          } else {
                            description = task.body.replace(/Tài liệu\/Link đính kèm:\s*.*$/m, '').trim();
                          }
                        }
                        const parsed = parseDescriptionAndChecklist(description);
                        const parsedTask = {
                          id: task.id,
                          title: task.subject,
                          done: task.status === 'done',
                          priority: task.priority,
                          due_date: task.due_date ? task.due_date.slice(0, 10) : '',
                          link,
                          description: parsed.pureDescription,
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
                          related_id: task.related_id
                        };
                        setChecklist(parsed.checklist);
                        setSelectedTaskForDetails(parsedTask);
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                        background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                      className="hover-lift"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '220px'
                        }}>
                          {task.subject}
                        </span>
                        {task.priority === 'high' && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 4px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                            {t('Gấp')}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        <span>
                          {task.due_date ? getDueDateLabel(task.due_date, task.status === 'done', t) : ''}
                        </span>
                        <span style={{ fontWeight: 600 }}>{task.progress || 0}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Task Detail Embed */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-bg)', flex: 1, overflow: 'hidden' }}>
              {selectedTaskForDetails ? (
                <div style={{ height: '100%', overflowY: 'auto' }}>
                  <WorkspaceTaskDrawer
                    isOpen={true}
                    onClose={() => setSelectedTaskForDetails(null)}
                    task={selectedTaskForDetails}
                    onUpdate={() => {
                      fetchPortalTasks();
                      fetchWorkspaceTasks();
                    }}
                    users={users}
                    embedMode={true}
                    onOpenContact={(contactId) => {
                      handleOpenContactProfile(contactId);
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', gap: '1rem', padding: '2rem', flex: 1 }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
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
        </>
        )}

        {/* Task Details Modal moved to root level */}
      </div>
    );
  };

  const renderDashboardView = () => {
    const kpis = [
      { 
        id: 'total',
        key: 'data', 
        status: 'all', 
        label: t('DATA KHÁCH HÀNG'), 
        value: data.stats.total_received, 
        color: '#a31422', 
        bg: 'rgba(163, 20, 34, 0.08)', 
        icon: FileText,
        change: '+100%', 
        up: true,
        bullets: [
          { text: t('Tổng nhận được bàn giao'), color: '#a31422' }
        ]
      },
      { 
        id: 'tickets',
        key: 'tickets', 
        status: 'pending', 
        label: t('TICKET BÁO LỖI'), 
        value: data.stats.tickets_total, 
        color: '#f59e0b', 
        bg: 'rgba(245, 158, 11, 0.08)', 
        icon: AlertCircle,
        change: '0%', 
        up: true,
        bullets: [
          { text: `${data.stats.tickets_pending} ${t('đang chờ duyệt')}`, color: '#f59e0b' }
        ]
      },
      { 
        id: 'approved',
        key: 'data', 
        status: 'approved_ticket', 
        label: t('ĐÃ DUYỆT BÙ'), 
        value: data.stats.tickets_approved, 
        color: '#10b981', 
        bg: 'rgba(16, 185, 129, 0.08)', 
        icon: CheckCircle2,
        change: '0%', 
        up: true,
        bullets: [
          { text: t('Hợp lệ & Đã được bù'), color: '#10b981' }
        ]
      },
      { 
        id: 'rejected',
        key: 'data', 
        status: 'rejected_ticket', 
        label: t('TỪ CHỐI BÙ'), 
        value: data.stats.tickets_rejected, 
        color: '#ef4444', 
        bg: 'rgba(239, 68, 68, 0.08)', 
        icon: XCircle,
        change: '0%', 
        up: false,
        bullets: [
          { text: t('Bị từ chối / Không đền bù'), color: '#ef4444' }
        ]
      }
    ];

    const recentLeads = data.leads.slice(0, 5);

    return (
      <>
        <style>{`
          .stat-card {
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .stat-card.total-card:hover {
            box-shadow: 0 6px 16px rgba(163, 20, 34, 0.15) !important;
            border-color: #a31422 !important;
          }
          .stat-card.tickets-card:hover {
            box-shadow: 0 6px 16px rgba(245, 158, 11, 0.15) !important;
            border-color: #f59e0b !important;
          }
          .stat-card.approved-card:hover {
            box-shadow: 0 6px 16px rgba(16, 185, 129, 0.15) !important;
            border-color: #10b981 !important;
          }
          .stat-card.rejected-card:hover {
            box-shadow: 0 6px 16px rgba(239, 68, 68, 0.15) !important;
            border-color: #ef4444 !important;
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Dashboard header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 className="page-title">{t("Tổng quan Phân bổ Data")}</h1>
              <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>{t("Phân tích hiệu suất giao data theo thời gian thực — Hệ thống đang hoạt động trơn tru.")}</p>
            </div>
            <div className="mobile-w-full" style={{ display: 'flex', gap: '8px', alignItems: 'center', width: 'auto', flexWrap: 'wrap' }}>
              <div className="mobile-flex-1" style={{ position: 'relative', zIndex: 100, width: 200 }}>
                <CustomSelect
                  options={[
                    { value: 'all', label: t('Tất cả thời gian'), icon: <Clock size={16} /> },
                    { value: 'today', label: t('Hôm nay') },
                    { value: 'yesterday', label: t('Hôm qua') },
                    { value: 'this_week', label: t('Tuần này') },
                    { value: 'last_week', label: t('Tuần trước') },
                    { value: 'two_weeks_ago', label: t('Tuần trước nữa') },
                    { value: '7_days', label: t('7 ngày qua') },
                    { value: '30_days', label: t('30 ngày qua') },
                    { value: 'this_month', label: t('Tháng này') },
                    { value: 'last_month', label: t('Tháng trước') },
                    { value: 'this_year', label: t('Năm nay') },
                    { value: 'custom', label: t('Tùy chọn ngày...') }
                  ]}
                  value={dateMode}
                  onChange={(val) => {
                    if (val === 'custom') {
                      setShowCustomDate(true);
                    } else {
                      handleDateModeChange(String(val));
                    }
                  }}
                  width="100%"
                />
              </div>
              {/* Button to open Connection Health Modal */}
              <button
                className="btn outline"
                onClick={() => { }}
                title={t("Kiểm tra kết nối hệ thống")}
                style={{ width: 38, height: 38, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', color: 'var(--color-text-light)', cursor: 'default' }}
              >
                <Server size={16} />
              </button>
              <button
                className="btn outline"
                onClick={() => loadPortalData()}
                disabled={loading}
                title={t("Làm mới dữ liệu")}
                style={{ width: 38, height: 38, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-surface)', color: 'var(--color-text-light)', cursor: 'pointer' }}
              >
                <RefreshCw size={16} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {showCustomDate && (
            <div className="portal-filters-row" style={{
              display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px',
              padding: '1rem 1.5rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)', marginTop: '-0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Từ ngày')}:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)',
                    fontSize: '0.85rem', outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)', height: 38
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Đến ngày')}:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)',
                    fontSize: '0.85rem', outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)', height: 38
                  }}
                />
              </div>
              <button
                onClick={loadPortalData}
                className="btn sm primary"
                style={{ height: 38, padding: '0 15px', borderRadius: '10px' }}
              >
                {t('Áp dụng')}
              </button>
            </div>
          )}

        {/* KPI Cards Grid */}
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? '0.75rem' : '1.25rem' }}>
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className={`stat-card hover-lift ${kpi.id}-card`}
                style={{
                  minHeight: isMobile ? '105px' : '140px',
                  padding: isMobile ? '12px' : '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (kpi.key === 'data') {
                    navigate('/data?status=' + kpi.status);
                  } else if (kpi.key === 'tickets') {
                    navigate('/tickets?status=' + kpi.status);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? '6px' : '12px' }}>
                  <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: isMobile ? '0.625rem' : '0.7rem' }}>{kpi.label}</span>
                  <div className="stat-icon" style={{
                    color: kpi.color,
                    background: kpi.bg,
                    width: isMobile ? '28px' : '36px',
                    height: isMobile ? '28px' : '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={isMobile ? 15 : 18} />
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: isMobile ? '1.5rem' : '2.25rem', lineHeight: 1.1 }}>{kpi.value}</div>
                  
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {kpi.bullets.map((b, bIdx) => (
                      <span key={bIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.color, display: 'inline-block', flexShrink: 0 }} />
                        <span>{b.text}</span>
                      </span>
                    ))}
                  </div>

                  {(() => {
                    const isIncrease = kpi.change.startsWith('+');
                    const isZero = kpi.change === '0%';
                    const changeColor = isZero ? 'var(--color-text-light)' : (kpi.up ? 'var(--color-success)' : 'var(--color-danger)');
                    return (
                      <div className="stat-change" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: changeColor, fontWeight: 700, fontSize: '0.75rem' }}>
                        {!isZero && (
                          isIncrease ? (
                            <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                              <path d="M12 5l9 14H3z" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                              <path d="M12 19L3 5h18z" />
                            </svg>
                          )
                        )}
                        {kpi.change}
                        <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>
                          {t('so với kỳ trước')}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>



        {/* Row 1: Charts & Recent Leads feed */}
        <div className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '6fr 4fr', gap: '1.25rem' }}>
          {/* Chart Left (Performance) */}
          <div className="card" style={{ padding: '1.25rem', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock3 size={18} color="var(--color-primary)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  {flowViewMode === 'day' ? t('LƯU LƯỢNG NHẬN DATA THEO NGÀY') : t('LƯU LƯỢNG NHẬN DATA THEO KHUNG GIỜ')}
                </h3>
              </div>
              <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                <button
                  onClick={() => setFlowViewMode('day')}
                  style={{
                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: flowViewMode === 'day' ? 'var(--color-surface)' : 'transparent',
                    color: flowViewMode === 'day' ? 'var(--color-primary)' : 'var(--color-text-muted)'
                  }}
                >
                  {t('Theo ngày')}
                </button>
                <button
                  onClick={() => setFlowViewMode('hour')}
                  style={{
                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: flowViewMode === 'hour' ? 'var(--color-surface)' : 'transparent',
                    color: flowViewMode === 'hour' ? 'var(--color-primary)' : 'var(--color-text-muted)'
                  }}
                >
                  {t('Theo giờ')}
                </button>
              </div>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={activeChartData} margin={{ left: -20, right: 5, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis dataKey={flowViewMode === 'day' ? 'date' : 'time'} tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: 'var(--color-surface)', padding: '8px 12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid var(--color-border)', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{label}</div>
                          <div style={{ color: 'var(--color-primary)', marginTop: 2 }}>{t('Số lượng data: ')}<span style={{ fontWeight: 800 }}>{payload[0].value}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="volume" fill="var(--color-primary)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={16} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Leads Feed (y như bên Lịch sử giao Data gần đây) */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{t('Data nhận gần đây')}</h3>
              <span
                style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setActiveTab('data')}
              >{t('Xem tất cả')}</span>
            </div>
            <div style={{ flex: 1, padding: '0.5rem 0.5rem 1.25rem 0.5rem', overflowY: 'auto', maxHeight: 280 }} className="custom-scrollbar">
              {recentLeads.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {recentLeads.map((lead: any) => (
                    <div key={lead.log_id} className="hover-lift" style={{
                      padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'background 0.2s',
                      borderBottom: '1px solid var(--color-border-light)'
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => {
                        if (lead.contact_id) {
                          handleOpenContactProfile(Number(lead.contact_id));
                        } else {
                          setActiveDetailLead(lead);
                          setDetailModalOpen(true);
                        }
                      }}
                    >
                      <Avatar name={lead.lead_name || t('Khách hàng')} size={32} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                          {lead.lead_name || t('Ẩn danh')}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {lead.phone} • {lead.round_name || t('Mặc định')} • {lead.received_at ? new Date(lead.received_at).toLocaleString('vi-VN') : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {getStatusBadge(lead.status, lead.report_status, lead.ai_screener_status, lead.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  {t('Chưa nhận được data nào.')}
                </div>
              )}
            </div>
          </div>
        </div>



        {/* PHIẾU HỢP TÁC CHỜ KÝ */}
        {pendingCoopSlips.length > 0 && (
          <div className="card animate-fade" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', marginBottom: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={18} color="var(--color-warning)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t('PHIẾU HỢP TÁC CHỜ KÝ')}
                  <span style={{
                    background: 'var(--color-warning)',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    lineHeight: 1
                  }}>
                    {pendingCoopSlips.length}
                  </span>
                </h3>
              </div>
              <button 
                className="btn outline warning sm" 
                onClick={() => navigate('/cooperation-slips')}
                style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}
              >
                {t('Xem tất cả phiếu')}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
              {pendingCoopSlips.map((slip: any) => {
                const myShare = slip.shareholders?.find((x: any) => String(x.user_id) === String(displayUser?.id));
                const percentage = myShare ? myShare.percentage : 0;
                
                return (
                  <div 
                    key={slip.id} 
                    style={{
                      padding: '1rem', 
                      background: 'var(--color-surface)', 
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '12px', 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: 'var(--shadow-sm)', 
                      transition: 'all 0.2s'
                    }}
                    className="hover-lift"
                  >
                    <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.08)',
                        color: 'var(--color-warning)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Scale size={18} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {slip.customer_name || t('Khách hàng')}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {slip.project_name || t('Dự án')} • {t('Căn')}: {slip.unit_code}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '8px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-warning)' }}>
                          {percentage}%
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                          {t('Tỷ lệ chia')}
                        </div>
                      </div>
                      <button 
                        className="btn sm" 
                        style={{ background: 'var(--color-warning)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                        onClick={() => navigate('/cooperation-slips')}
                      >
                        {t('Ký ngay')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 2: Round distribution card & Source Ratio PieChart */}

        <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
          {/* Card 1: Tỷ lệ theo Vòng Phân Bổ */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <GitBranch size={18} color="var(--color-primary)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('Tỷ lệ theo Vòng Phân Bổ')}
              </h3>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
              {data.by_round && data.by_round.length > 0 ? (
                data.by_round.map((r: any, idx: number) => {
                  const percentage = data.stats.total_received > 0
                    ? ((r.count / data.stats.total_received) * 100).toFixed(1)
                    : '0.0';
                  const colors = ['#BD1D2D', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#BD1D2D'];
                  const themeColor = colors[idx % colors.length];

                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: themeColor }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>{r.round_name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{percentage}% tổng data</span>
                        </div>
                      </div>
                      <span style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '1rem' }}>{r.count}</span>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                  {t('Chưa có dữ liệu phân bổ vòng chia')}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Tỷ lệ Nguồn Data */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '8px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)', margin: 0 }}>
                <GitBranch size={18} color="#BD1D2D" /> {t('Tỷ lệ Nguồn Data')}
              </h3>
              <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '3px', borderRadius: '8px', border: '1px solid var(--color-border-light)', flexShrink: 0 }}>
                <button
                  onClick={() => setSourceViewMode('connection')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: sourceViewMode === 'connection' ? 'var(--color-surface)' : 'transparent',
                    color: sourceViewMode === 'connection' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: sourceViewMode === 'connection' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  {t('Theo Kết nối')}
                </button>
                <button
                  onClick={() => setSourceViewMode('lead')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: sourceViewMode === 'lead' ? 'var(--color-surface)' : 'transparent',
                    color: sourceViewMode === 'lead' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: sourceViewMode === 'lead' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  {t('Theo Nguồn Lead')}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {(() => {
                const getSourceStats = () => {
                  const counts: Record<string, number> = {};
                  data.leads.filter((l: any) => l.status !== 'reminder').forEach((lead: any) => {
                    const name = lead.connection_name || t('Nhập tay');
                    counts[name] = (counts[name] || 0) + 1;
                  });
                  const colors = ['#BD1D2D', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#BD1D2D', '#06b6d4'];
                  return Object.entries(counts)
                    .map(([name, value], idx) => ({
                      name,
                      value,
                      color: colors[idx % colors.length]
                    }))
                    .sort((a, b) => b.value - a.value);
                };

                const getLeadSourceStats = () => {
                  const counts: Record<string, number> = {};
                  data.leads.filter((l: any) => l.status !== 'reminder').forEach((lead: any) => {
                    const name = lead.source?.trim() || t('Không xác định');
                    counts[name] = (counts[name] || 0) + 1;
                  });
                  const colors = ['#BD1D2D', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#BD1D2D', '#06b6d4'];
                  return Object.entries(counts)
                    .map(([name, value], idx) => ({
                      name,
                      value,
                      color: colors[idx % colors.length]
                    }))
                    .sort((a, b) => b.value - a.value);
                };

                const activeSourceData = sourceViewMode === 'connection' ? getSourceStats() : getLeadSourceStats();

                return activeSourceData && activeSourceData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie
                          data={activeSourceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={55}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {activeSourceData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Legend list */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '6px 12px',
                      width: '100%',
                      marginTop: '10px',
                      fontSize: '0.75rem',
                      color: 'var(--color-text-light)'
                    }}>
                      {activeSourceData.map((entry: any, index: number) => (
                        <div
                          key={index}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}
                          title={`${entry.name}: ${entry.value}`}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {entry.name}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 500, flexShrink: 0 }}>
                            {entry.value} data
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Chưa có dữ liệu thống kê')}</div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

  const renderDataView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Consolidated Filters Row */}
        <div className="portal-filters-row" style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '0.5rem',
          flexShrink: 0,
          flexWrap: 'wrap',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
        }}>
          {/* Search Input */}
          <div className="responsive-filter-item" style={{ position: 'relative', width: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--color-text-muted)' }} />
            <input
              className="form-input"
              placeholder={t("Tìm theo tên, SĐT, email...")}
              style={{ paddingLeft: 36, width: '100%', height: 38, fontSize: '0.875rem' }}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyPress={handleSearchKeyPress}
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                }}
                style={{
                  position: 'absolute', right: 10, top: 10, background: 'none', border: 'none',
                  color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center'
                }}
              >
                <XCircle size={14} />
              </button>
            )}
          </div>

          {/* Date Select Filter */}
          <div className="responsive-filter-item">
            <CustomSelect
              options={[
                { value: 'all', label: t('Tất cả thời gian'), icon: <Clock size={16} /> },
                { value: 'today', label: t('Hôm nay') },
                { value: 'yesterday', label: t('Hôm qua') },
                { value: 'this_week', label: t('Tuần này') },
                { value: 'last_week', label: t('Tuần trước') },
                { value: 'two_weeks_ago', label: t('Tuần trước nữa') },
                { value: '7_days', label: t('7 ngày qua') },
                { value: '30_days', label: t('30 ngày qua') },
                { value: 'this_month', label: t('Tháng này') },
                { value: 'last_month', label: t('Tháng trước') },
                { value: 'this_year', label: t('Năm nay') },
                { value: 'custom', label: t('Tùy chọn ngày...') }
              ]}
              value={dateMode}
              onChange={(val) => handleDateModeChange(String(val))}
              width={160}
            />
          </div>

          {/* Custom Date Inputs */}
          {showCustomDate && (
            <div className="portal-filter-custom-date" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)',
                  fontSize: '0.85rem', outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)',
                  height: 38
                }}
              />
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{t('đến')}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--color-border)',
                  fontSize: '0.85rem', outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)',
                  height: 38
                }}
              />
            </div>
          )}

          {/* Status Select Filter */}
          <div className="responsive-filter-item">
            <CustomSelect
              options={[
                { value: 'all', label: t('Tất cả trạng thái'), icon: <Filter size={16} /> },
                { value: 'assigned', label: t('Đã chia') },
                { value: 'compensation', label: t('Data Bù') },
                { value: 'databank_claim', label: 'Databank Claim' },
                { value: 'reminder', label: t('Nhắc lại') },
                { value: 'pending_ticket', label: t('Ticket chờ duyệt') },
                { value: 'approved_ticket', label: t('Ticket đã bù') },
                { value: 'approved_no_comp_ticket', label: t('Lỗi không bù') },
                { value: 'not_contacted', label: t('Chưa liên hệ'), icon: <AlertCircle size={16} /> },
                { value: 'rejected_ticket', label: t('Ticket bị từ chối') }
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(String(val))}
              width={170}
            />
          </div>

          {/* Round Select Filter */}
          <div className="responsive-filter-item">
            <CustomSelect
              options={[
                { value: '', label: t('Tất cả vòng'), icon: <Tag size={16} /> },
                ...data.rounds.map((r: any) => ({ value: r.id, label: r.round_name }))
              ]}
              value={roundId}
              onChange={(val) => setRoundId(String(val))}
              width={160}
            />
          </div>

          <button
            onClick={handleApplyFilters}
            className="btn sm primary"
            style={{ height: 38 }}
          >
            <Filter size={14} /> {t('Áp dụng')}
          </button>

          <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            {t('Tổng cộng:')} <strong style={{ color: 'var(--color-text)' }}>{filteredLeads.length}</strong> {t('data')}
          </div>
        </div>

        {/* Bảng Dữ Liệu */}
        <div className="card mobile-flat-container" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              {t('DANH SÁCH DỮ LIỆU ĐƯỢC PHÂN BỔ')}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', background: 'var(--color-border-light)', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
              {t('Đang hiển thị')} {paginatedLeads.length} / {totalCount} {t('dòng')}
            </span>
          </div>

          <div className="table-wrap responsive-table-wrap mobile-card-table" style={{
            overflowX: isMobile ? 'visible' : 'auto',
            maxHeight: isMobile ? 'none' : '520px',
            overflowY: isMobile ? 'visible' : 'auto'
          }}>
            {loading ? (
              <TableSkeleton cols={7} rows={6} />
            ) : filteredLeads.length > 0 ? (
              isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0 5rem 0' }}>
                  {paginatedLeads.map((lead: any) => (
                    <div
                      key={lead.log_id}
                      onClick={() => {
                        if (lead.contact_id) {
                          handleOpenContactProfile(Number(lead.contact_id));
                        } else {
                          setActiveDetailLead(lead);
                          setDetailModalOpen(true);
                        }
                      }}
                      style={{
                        padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                        borderRadius: '12px', background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                          <Avatar name={lead.lead_name || t('Khách hàng')} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {lead.lead_name || t('Chưa cập nhật')}
                              </span>
                              {effectiveRole === 'sale' && Number(lead.is_accepted) === 1 && Number(lead.lead_recall_minutes) > 0 && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 6px', borderRadius: '8px',
                                  background: '#e6f4ea', color: '#137333', fontSize: '0.65rem', fontWeight: 700
                                }}>
                                  <CheckCircle2 size={10} /> {t('Đã tiếp nhận')}
                                </span>
                              )}
                              {getStatusBadge(lead.status, lead.report_status)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '1px' }}>
                              <span style={{ color: 'var(--color-text)', fontWeight: 700, fontSize: '0.75rem' }}>{lead.phone}</span>
                              {lead.lead_email && (
                                <>
                                  <span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>•</span>
                                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                                    {lead.lead_email}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: '8px', background: '#ffe3e8', color: '#8a0f1b', fontSize: '0.675rem', fontWeight: 700 }}>
                            {lead.round_name || t('Mặc định')}
                          </span>
                          {lead.status === 'compensation' && (
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#d1fae5', color: '#065f46', fontSize: '0.625rem', fontWeight: 700 }}>
                              {t('Data bù')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px dotted var(--color-border-light)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>{t('Nguồn')}: </span>
                            <span>{lead.source || 'N/A'}</span>
                            {lead.type && <span style={{ color: '#94a3b8' }}> ({lead.type})</span>}
                          </div>
                          {lead.sale_name && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>{t('Phân bổ')}: </span>
                              <Avatar src={lead.sale_avatar} name={lead.sale_name} size={18} />
                              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{lead.sale_name}</span>
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', color: '#64748b' }}>
                          {lead.received_at ? new Date(lead.received_at).toLocaleString('vi-VN') : '—'}
                        </div>
                      </div>

                      {((effectiveRole === 'sale' && !Number(lead.is_accepted) && Number(lead.lead_recall_minutes) > 0) || lead.report_status || (isAllowedToReport &&
                        (!data.below_standard_fallback_round_ids || !data.below_standard_fallback_round_ids.includes(Number(lead.round_id))) &&
                        (!data.below_standard_fallback_round_id || Number(lead.round_id) !== Number(data.below_standard_fallback_round_id)))) && (
                          <div onClick={e => e.stopPropagation()} style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                            {effectiveRole === 'sale' && !Number(lead.is_accepted) && Number(lead.lead_recall_minutes) > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {(() => {
                                  const leadRecallMins = Number(lead.lead_recall_minutes) || 0;
                                  const limitMs = leadRecallMins * 60 * 1000;
                                  const elapsedMs = now - new Date(lead.last_interaction_date).getTime();
                                  const remainingMs = limitMs - elapsedMs;

                                  if (leadRecallMins > 0 && remainingMs <= 0) {
                                    return <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>{t('Quá hạn')}</span>;
                                  }

                                  const formatTime = (ms: number) => {
                                    const totalSecs = Math.max(0, Math.floor(ms / 1000));
                                    const mins = Math.floor(totalSecs / 60);
                                    const secs = totalSecs % 60;
                                    return `${mins}:${String(secs).padStart(2, '0')}`;
                                  };

                                  return (
                                    <>
                                      {leadRecallMins > 0 && (
                                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <Clock size={12} /> {formatTime(remainingMs)}
                                        </span>
                                      )}
                                      <button onClick={() => handleAcceptLead(lead.lead_id)} className="btn sm primary" style={{ height: 30, padding: '0 10px' }}>
                                        {t('Tiếp nhận')}
                                      </button>
                                    </>
                                  );
                                })()}
                              </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {lead.report_status === 'pending' && (
                                <span className="badge warning" title={t("Ticket chờ duyệt (Bấm để xem chi tiết)")} onClick={() => { setActiveDetailLead(lead); setDetailModalOpen(true); }}>
                                  {t('Chờ duyệt')}
                                </span>
                              )}
                              {lead.report_status === 'approved' && (
                                <span className="badge success" title={t("Ticket đã duyệt bù (Bấm để xem chi tiết)")} onClick={() => { setActiveDetailLead(lead); setDetailModalOpen(true); }}>
                                  {t('Đã bù')}
                                </span>
                              )}
                              {lead.report_status === 'approved_no_comp' && (
                                <span className="badge" style={{ background: '#dbeafe', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.2)', cursor: 'pointer' }} title={t("Ticket duyệt lỗi không bù (Bấm để xem chi tiết)")} onClick={() => { setActiveDetailLead(lead); setDetailModalOpen(true); }}>
                                  {t('Lỗi không bù')}
                                </span>
                              )}
                              {lead.report_status === 'rejected' && (
                                <span className="badge danger" title={t("Từ chối")} onClick={() => { setActiveDetailLead(lead); setDetailModalOpen(true); }}>
                                  {t('Từ chối')}
                                </span>
                              )}
                              {(!lead.report_status || lead.report_status === 'rejected') && isAllowedToReport && lead.status !== 'reminder' && lead.status !== 'databank_claim' &&
                                (!data.below_standard_fallback_round_ids || !data.below_standard_fallback_round_ids.includes(Number(lead.round_id))) &&
                                (!data.below_standard_fallback_round_id || Number(lead.round_id) !== Number(data.below_standard_fallback_round_id)) && (
                                  <button onClick={() => handleOpenReportModal(lead)} className="btn sm danger" style={{ height: 30, padding: '0 10px' }}>
                                    <AlertCircle size={12} /> {t('Báo lỗi')}
                                  </button>
                                )}
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              ) : (
                <table style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('KHÁCH HÀNG')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('LIÊN HỆ')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('TRẠNG THÁI')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('PHÂN BỔ CHO')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('NGUỒN / PHÂN LOẠI')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('THỜI GIAN NHẬN')}</th>
                      <th style={{ padding: '1rem', color: 'var(--color-text-light)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>{t('TICKET')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLeads.map((lead: any) => (
                      <tr
                        key={lead.log_id}
                        onClick={() => {
                          if (lead.contact_id) {
                            handleOpenContactProfile(Number(lead.contact_id));
                          } else {
                            setActiveDetailLead(lead);
                            setDetailModalOpen(true);
                          }
                        }}
                        className="table-row-hover"
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Avatar name={lead.lead_name || t('Khách hàng')} size={32} />
                              <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>
                                {lead.lead_name || t('Chưa cập nhật')}
                              </span>
                            </div>

                            {effectiveRole === 'sale' && !Number(lead.is_accepted) && Number(lead.lead_recall_minutes) > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                {(() => {
                                  const leadRecallMins = Number(lead.lead_recall_minutes) || 0;
                                  const limitMs = leadRecallMins * 60 * 1000;
                                  const elapsedMs = now - new Date(lead.last_interaction_date).getTime();
                                  const remainingMs = limitMs - elapsedMs;

                                  if (leadRecallMins > 0 && remainingMs <= 0) {
                                    return <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>{t('Quá hạn')}</span>;
                                  }

                                  const formatTime = (ms: number) => {
                                    const totalSecs = Math.max(0, Math.floor(ms / 1000));
                                    const mins = Math.floor(totalSecs / 60);
                                    const secs = totalSecs % 60;
                                    return `${mins}:${String(secs).padStart(2, '0')}`;
                                  };

                                  return (
                                    <>
                                      {leadRecallMins > 0 && (
                                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <Clock size={12} /> {formatTime(remainingMs)}
                                        </span>
                                      )}
                                      <button onClick={() => handleAcceptLead(lead.lead_id)} className="btn sm primary" style={{ height: 30 }}>
                                        {t('Tiếp nhận')}
                                      </button>
                                    </>
                                  );
                                })()}
                              </div>
                            )}

                            {effectiveRole === 'sale' && Number(lead.is_accepted) === 1 && Number(lead.lead_recall_minutes) > 0 && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: '12px',
                                background: '#e6f4ea', color: '#137333', fontSize: '0.725rem', fontWeight: 700
                              }}>
                                <CheckCircle2 size={12} /> {t('Đã tiếp nhận')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{lead.phone}</span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{lead.lead_email || '—'}</span>
                          </div>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          {getStatusBadge(lead.status, lead.report_status)}
                        </td>

                        <td style={{ padding: '1rem' }}>
                          {lead.sale_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Avatar src={lead.sale_avatar} name={lead.sale_name} size={32} />
                              <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{lead.sale_name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                  {(lead.status === 'reminder' && (!lead.round_name || lead.round_name === '-')) ? 'Reminder' : (lead.round_name || 'Form')}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                          )}
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ color: 'var(--color-text-light)', fontSize: '0.8rem', fontWeight: 500 }}>{lead.source || 'N/A'}</span>
                            {lead.type && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{lead.type}</span>}
                          </div>
                        </td>

                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            <span>{lead.received_at ? new Date(lead.received_at).toLocaleString('vi-VN') : '—'}</span>
                            {lead.status === 'compensation' && (
                              <span style={{ alignSelf: 'flex-start', padding: '2px 6px', borderRadius: '4px', background: '#d1fae5', color: '#065f46', fontSize: '0.7rem', fontWeight: 700 }}>
                                {t('Data bù')}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                            {lead.report_status === 'pending' && (
                              <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: '#fef3c7', color: '#d97706' }} title={t("Ticket chờ duyệt")}>
                                <Clock size={16} />
                              </div>
                            )}
                            {lead.report_status === 'approved' && (
                              <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'var(--color-success-light)', color: 'var(--color-success)' }} title={t("Ticket đã duyệt bù")}>
                                <CheckCircle2 size={16} />
                              </div>
                            )}
                            {lead.report_status === 'approved_no_comp' && (
                              <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb' }} title={t("Ticket duyệt lỗi không bù")}>
                                <Info size={16} />
                              </div>
                            )}
                            {lead.report_status === 'rejected' && (
                              <div style={{ display: 'inline-flex', padding: '6px', borderRadius: '50%', background: 'var(--color-danger-light)', color: 'var(--color-danger)' }} title={t("Từ chối")}>
                                <XCircle size={16} />
                              </div>
                            )}
                            {(!lead.report_status || lead.report_status === 'rejected') && isAllowedToReport && lead.status !== 'reminder' && lead.status !== 'databank_claim' &&
                              (!data.below_standard_fallback_round_ids || !data.below_standard_fallback_round_ids.includes(Number(lead.round_id))) &&
                              (!data.below_standard_fallback_round_id || Number(lead.round_id) !== Number(data.below_standard_fallback_round_id)) && (
                                <button
                                  onClick={() => handleOpenReportModal(lead)}
                                  className="btn sm danger"
                                  style={{ borderRadius: '50%', width: 32, height: 32, padding: 0 }}
                                >
                                  <AlertCircle size={16} />
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
                <span>{t('Không tìm thấy dữ liệu nào.')}</span>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {t('Hiển thị')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</span> {t('trên')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{totalCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
                  <ChevronLeft size={16} />
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let startPage = 1;
                    if (totalPages > 5) {
                      if (currentPage > 3) {
                        startPage = currentPage - 2;
                        if (startPage + 4 > totalPages) {
                          startPage = totalPages - 4;
                        }
                      }
                    }
                    const pageNum = startPage + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          width: 32, height: 32, borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                          border: currentPage === pageNum ? 'none' : '1px solid var(--color-border)',
                          background: currentPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: currentPage === pageNum ? 'white' : 'var(--color-text)',
                          cursor: 'pointer'
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDatabankView = () => {
    const DATABANK_ITEMS_PER_PAGE = 10;
    const databankTotalPages = Math.ceil(publicLeads.length / DATABANK_ITEMS_PER_PAGE);
    const paginatedPublicLeads = publicLeads.slice((databankPage - 1) * DATABANK_ITEMS_PER_PAGE, databankPage * DATABANK_ITEMS_PER_PAGE);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header Block */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1rem 1.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
        }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              {t('KHO DATA CHUNG (DATABANK)')}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
              {t('Danh sách các khách hàng tiềm năng đã công khai. Bấm "Nhận Data" để trực tiếp nhận chăm sóc.')}
            </p>
          </div>
          <button
            onClick={fetchPublicLeads}
            disabled={publicLoading}
            className="btn outline sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', fontSize: '0.8125rem' }}
          >
            <RefreshCw size={14} className={publicLoading ? 'animate-spin' : ''} />
            {t('Làm mới')}
          </button>
        </div>

        {publicQuota && (
          <div style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '1rem',
            width: '100%'
          }}>
            {[
              {
                label: t('Hạn mức giờ'),
                value: publicQuota.claims_hour,
                limit: publicQuota.limit_hour,
                icon: <Clock size={14} />,
                color: 'var(--color-primary)',
                bg: 'rgba(189, 29, 45, 0.05)',
                border: 'rgba(189, 29, 45, 0.15)'
              },
              {
                label: t('Hạn mức ngày'),
                value: publicQuota.claims_day,
                limit: publicQuota.limit_day,
                icon: <Calendar size={14} />,
                color: '#d97706',
                bg: 'rgba(245, 158, 11, 0.06)',
                border: 'rgba(245, 158, 11, 0.15)'
              },
              {
                label: t('Hạn mức tháng'),
                value: publicQuota.claims_month,
                limit: publicQuota.limit_month,
                icon: <Layers size={14} />,
                color: '#2563eb',
                bg: 'rgba(37, 99, 235, 0.06)',
                border: 'rgba(37, 99, 235, 0.15)'
              }
            ].map((q, idx) => {
              const percent = Math.min(100, (q.value / q.limit) * 100);
              return (
                <div key={idx} style={{
                  flex: '1 1 200px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '3px',
                    width: `${percent}%`,
                    background: q.color,
                    transition: 'width 0.4s ease'
                  }} />

                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '12px',
                    background: q.bg,
                    border: `1px solid ${q.border}`,
                    color: q.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {q.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{q.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                      <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-text)' }}>{q.value}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>/ {q.limit} lead</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {publicLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div className="animate-spin" style={{ width: '2rem', height: '2rem', border: '3px solid rgba(189,29,45,0.2)', borderTopColor: '#BD1D2D', borderRadius: '50%' }}></div>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{t('Đang tải danh sách kho chung...')}</span>
            </div>
          </div>
        ) : publicLeads.length === 0 ? (
          <EmptyCard
            icon={<Database size={48} />}
            title={t("Kho chung trống")}
            description={t("Hiện tại không có khách hàng tiềm năng nào được công khai để nhận.")}
          />
        ) : (
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
          }}>
            <div style={{
              overflowX: isMobile ? 'visible' : 'auto',
              maxHeight: isMobile ? 'none' : '520px',
              overflowY: isMobile ? 'visible' : 'auto'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    <th style={{ padding: '1rem', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Khách hàng')}</th>
                    <th style={{ padding: '1rem', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Liên hệ')}</th>
                    <th style={{ padding: '1rem', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Trạng thái')}</th>
                    <th style={{ padding: '1rem', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('Thời gian ra kho')}</th>
                    <th style={{ padding: '1rem', width: 140 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPublicLeads.map((lead) => {
                    const hasClaimed = lead.takers && lead.takers.some((t: any) => Number(t.id) === Number(displayUser?.id) || Number(t.id) === Number(displayUser?.consultant_id));
                    const isFull = lead.takers && lead.takers.length >= 2;
                    const isAdminOrManager = ['admin', 'superadmin', 'super_admin', 'manager'].includes(String(user?.role || displayUser?.role || '').toLowerCase());
                    const canClaim = !hasClaimed && !isFull && isClaimingLeadId === null && !isAdminOrManager;

                    return (
                      <tr 
                        key={lead.id} 
                        className="table-row-hover" 
                        onClick={() => {
                          if (canClaim) {
                            handleClaimLead(lead.id, lead.full_name || lead.name);
                          }
                        }}
                        style={{ 
                          borderBottom: '1px solid var(--color-border-light)', 
                          color: 'var(--color-text)', 
                          transition: 'background 0.2s',
                          cursor: canClaim ? 'pointer' : 'default'
                        }}
                      >
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar name={lead.full_name || t('Khách hàng')} size={32} />
                            <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>{lead.full_name || t('Khách hàng')}</span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                            {lead.phone || '-'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{lead.email || '-'}</div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {getStatusBadge('databank', undefined, undefined, undefined, lead.takers)}
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                          {lead.released_to_kho_at ? new Date(lead.released_to_kho_at).toLocaleString('vi-VN') : '-'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClaimLead(lead.id, lead.full_name || lead.name);
                            }}

                            disabled={isClaimingLeadId !== null || hasClaimed || isFull || isAdminOrManager}
                            className={isFull ? "btn outline sm" : (hasClaimed ? "btn success sm" : "btn primary sm")}
                            style={{
                              height: 32,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0 10px',
                              background: isAdminOrManager ? 'rgba(0,0,0,0.04)' : (hasClaimed ? 'rgba(16,185,129,0.12)' : (isFull ? 'transparent' : '#BD1D2D')),
                              color: isAdminOrManager ? 'var(--color-text-muted)' : (hasClaimed ? '#10b981' : (isFull ? 'var(--color-text-muted)' : '#ffffff')),
                              border: isAdminOrManager ? '1px solid var(--color-border-light)' : (hasClaimed ? '1px solid rgba(16,185,129,0.2)' : (isFull ? '1px solid var(--color-border)' : 'none')),
                              borderRadius: '16px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: (hasClaimed || isFull || isAdminOrManager) ? 'none' : '0 4px 12px rgba(189,29,45,0.15)',
                              cursor: isAdminOrManager ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {isClaimingLeadId === lead.id 
                              ? t('Đang nhận...') 
                              : (hasClaimed ? t('Đã nhận') : (isFull ? t('Hết lượt') : (isAdminOrManager ? t('Chỉ dành cho Sales') : t('Nhận Data'))))}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {databankTotalPages > 1 && (
              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {t('Hiển thị')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(databankPage - 1) * DATABANK_ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(databankPage * DATABANK_ITEMS_PER_PAGE, publicLeads.length)}</span> {t('trên')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{publicLeads.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => setDatabankPage(prev => Math.max(prev - 1, 1))} disabled={databankPage === 1} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: Math.min(5, databankTotalPages) }, (_, i) => {
                      let startPage = 1;
                      if (databankTotalPages > 5) {
                        if (databankPage > 3) {
                          startPage = databankPage - 2;
                          if (startPage + 4 > databankTotalPages) {
                            startPage = databankTotalPages - 4;
                          }
                        }
                      }
                      const pageNum = startPage + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setDatabankPage(pageNum)}
                          style={{
                            width: 32, height: 32, borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                            border: databankPage === pageNum ? 'none' : '1px solid var(--color-border)',
                            background: databankPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: databankPage === pageNum ? 'white' : 'var(--color-text)',
                            cursor: 'pointer'
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setDatabankPage(prev => Math.min(prev + 1, databankTotalPages))} disabled={databankPage === databankTotalPages || databankTotalPages === 0} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTicketsView = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Ticket Filters Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1rem 1.5rem'
        }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{t('DANH SÁCH BÁO CÁO LỖI')}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>{t('Theo dõi tình trạng phê duyệt đền bù data lỗi từ Admin.')}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TRẠNG THÁI:')}</span>
              <CustomSelect
                options={[
                  { value: 'all', label: t('Tất cả trạng thái') },
                  { value: 'pending', label: t('Chờ xử lý') },
                  { value: 'approved', label: t('Đã bù') },
                  { value: 'rejected', label: t('Từ chối') }
                ]}
                value={ticketStatusFilter}
                onChange={(val) => {
                  setTicketStatusFilter(String(val));
                  setTicketPage(1);
                }}
                width={160}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('THỜI GIAN:')}</span>
              <CustomSelect
                options={[
                  { value: 'Tất cả', label: t('Tất cả thời gian') },
                  { value: 'Hôm nay', label: t('Hôm nay') },
                  { value: 'Hôm qua', label: t('Hôm qua') },
                  { value: 'Tuần này', label: t('Tuần này') },
                  { value: 'Tháng này', label: t('Tháng này') },
                  { value: 'Tháng trước', label: t('Tháng trước') }
                ]}
                value={ticketDateFilter}
                onChange={(val) => {
                  setTicketDateFilter(String(val));
                  setTicketPage(1);
                }}
                width={160}
              />
            </div>

            <button
              onClick={loadTicketsData}
              disabled={ticketsLoading}
              className="btn sm secondary"
              style={{ height: 38 }}
            >
              <RefreshCw size={14} style={{ animation: ticketsLoading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Tickets Table / List */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              {t('CHI TIẾT TICKETS')}
            </h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', background: 'var(--color-border-light)', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
              {t('Đang hiển thị')} {tickets.length} / {ticketTotalCount} {t('dòng')}
            </span>
          </div>

          <div className="table-wrap responsive-table-wrap mobile-card-table" style={{
            overflowX: isMobile ? 'visible' : 'auto',
            maxHeight: isMobile ? 'none' : '520px',
            overflowY: isMobile ? 'visible' : 'auto'
          }}>
            {ticketsLoading ? (
              <TableSkeleton cols={5} rows={6} />
            ) : tickets.length > 0 ? (
              <table style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('KHÁCH HÀNG')}</th>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('TƯ VẤN VIÊN')}</th>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700, textAlign: 'center' }}>{t('TRẠNG THÁI')}</th>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('PHẢN HỒI TỪ ADMIN')}</th>
                    <th style={{ padding: '1rem 1.25rem', color: 'var(--color-text-light)', fontWeight: 700 }}>{t('THỜI GIAN BÁO')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket: any) => {
                    let statusColor = '#d97706';
                    let statusBg = '#fef3c7';
                    let statusText = t('Chờ duyệt');
                    if (ticket.status === 'approved') {
                      statusColor = 'var(--color-success)';
                      statusBg = 'var(--color-success-light)';
                      statusText = t('Đã bù');
                    } else if (ticket.status === 'rejected') {
                      statusColor = 'var(--color-danger)';
                      statusBg = 'var(--color-danger-light)';
                      statusText = t('Từ chối');
                    }

                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => {
                          setSelectedDetailTicket(ticket);
                          setTicketModalOpen(true);
                        }}
                        style={{
                          borderBottom: '1px solid var(--color-border-light)',
                          background: 'var(--color-surface)',
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar name={ticket.lead_name || t('Khách hàng')} size={32} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{ticket.lead_name || t('Ẩn danh')}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{ticket.lead_phone}</span>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar src={ticket.consultant_avatar} name={ticket.consultant_name} size={32} />
                            <div>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{ticket.consultant_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                {ticket.round_name || t('Mặc định')}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                            background: statusBg, color: statusColor, display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            {ticket.status === 'pending' && <Clock size={12} />}
                            {ticket.status === 'approved' && <CheckCircle2 size={12} />}
                            {ticket.status === 'rejected' && <XCircle size={12} />}
                            {statusText}
                          </span>
                        </td>

                        <td style={{ padding: '1rem 1.25rem' }}>
                          {ticket.status === 'pending' ? (
                            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>{t('Đang xử lý...')}</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Avatar src={ticket.resolved_by_avatar} name={ticket.resolved_by || t('Hệ thống')} size={32} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                                  {ticket.resolved_by || t('Hệ thống')}
                                </span>
                                {ticket.status === 'approved' && (
                                  <span style={{ color: 'var(--color-success)', fontWeight: 500 }}>
                                    {ticket.approval_reason ? ticket.approval_reason : t('Chấp nhận đền bù')}
                                  </span>
                                )}
                                {ticket.status === 'rejected' && (
                                  <span style={{ color: 'var(--color-danger)', fontWeight: 500 }}>
                                    {ticket.reject_reason ? ticket.reject_reason : t('Không đền bù')}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '1rem 1.25rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                          {ticket.created_at ? new Date(ticket.created_at).toLocaleString('vi-VN') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
                <span>{t('Không tìm thấy ticket nào.')}</span>
              </div>
            )}
          </div>

          {/* Ticket Pagination */}
          {ticketTotalPages > 1 && (
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {t('Hiển thị')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{(ticketPage - 1) * TICKET_ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{Math.min(ticketPage * TICKET_ITEMS_PER_PAGE, ticketTotalCount)}</span> {t('trên')} <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{ticketTotalCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => setTicketPage(prev => Math.max(prev - 1, 1))} disabled={ticketPage === 1} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
                  <ChevronLeft size={16} />
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: Math.min(5, ticketTotalPages) }, (_, i) => {
                    let startPage = 1;
                    if (ticketTotalPages > 5) {
                      if (ticketPage > 3) {
                        startPage = ticketPage - 2;
                        if (startPage + 4 > ticketTotalPages) {
                          startPage = ticketTotalPages - 4;
                        }
                      }
                    }
                    const pageNum = startPage + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setTicketPage(pageNum)}
                        style={{
                          width: 32, height: 32, borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                          border: ticketPage === pageNum ? 'none' : '1px solid var(--color-border)',
                          background: ticketPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: ticketPage === pageNum ? 'white' : 'var(--color-text)',
                          cursor: 'pointer'
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setTicketPage(prev => Math.min(prev + 1, ticketTotalPages))} disabled={ticketPage === ticketTotalPages || ticketTotalPages === 0} className="btn sm secondary" style={{ height: 32, width: 32, padding: 0 }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCalendarView = () => {
    const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const monthName = new Intl.DateTimeFormat(
      language === 'vi' ? 'vi-VN' : language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : 'en-US',
      { month: 'long' }
    ).format(currentDate);

    const days = [];
    const totalDays = daysInMonth(y, m);
    const startOffset = (firstDayOfMonth(y, m) + 6) % 7;

    // Padding for start of month
    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-start-${i}`} style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', opacity: 0.3 }}></div>);
    }

    // Days of month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = calendarData[dateStr] || { distributed: 0, blacklist: 0, reminder: 0, error: 0, ticket_total: 0 };
      const isToday = new Date().toDateString() === new Date(y, m, d).toDateString();
      const dayOfWeek = (startOffset + d - 1) % 7;
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

      days.push(
        <div
          key={d}
          onClick={() => handleDateClick(dateStr)}
          style={{
            borderRight: '1px solid var(--color-border)',
            borderBottom: '1px solid var(--color-border)',
            padding: '0.625rem',
            minHeight: '110px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.2s',
            backgroundColor: isToday
              ? 'rgba(189, 29, 45, 0.08)'
              : isWeekend
                ? 'var(--color-calendar-weekend)'
                : 'var(--color-surface)',
            cursor: 'pointer',
            position: 'relative'
          }}
          className="calendar-day-cell"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: isToday ? 'var(--color-primary)' : 'transparent',
              color: isToday ? 'white' : 'var(--color-text-light)'
            }}>{d}</span>
            {isToday && <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-primary)' }}>{t('Hôm nay')}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px', alignContent: 'end' }}>
            {dayData.distributed > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '2px 4px',
                borderRadius: '4px',
                background: 'var(--color-success-light)',
                color: 'var(--color-success)',
                fontSize: '0.6875rem',
                fontWeight: 600
              }} title={t("Đã chia")}>
                <span>{t('Chia')}:</span>
                <strong>{dayData.distributed}</strong>
              </div>
            )}
            {dayData.ticket_total > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '2px 4px',
                borderRadius: '4px',
                background: theme === 'dark' ? 'var(--color-primary-light)' : '#fff5f6',
                color: theme === 'dark' ? 'var(--color-primary)' : '#a31422',
                fontSize: '0.6875rem',
                fontWeight: 600,
                border: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid #ddd6fe'
              }} title={t("Ticket lỗi")}>
                <span>{t('Ticket')}:</span>
                <strong>{dayData.ticket_total}</strong>
              </div>
            )}
            {dayData.reminder > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '2px 4px',
                borderRadius: '4px',
                background: theme === 'dark' ? 'rgba(236, 72, 153, 0.15)' : '#fce7f3',
                color: theme === 'dark' ? '#f472b6' : '#db2777',
                fontSize: '0.6875rem',
                fontWeight: 600,
                border: theme === 'dark' ? '1px solid rgba(236, 72, 153, 0.25)' : 'none'
              }} title={t("Nhắc lại")}>
                <span>{t('Nhắc')}:</span>
                <strong>{dayData.reminder}</strong>
              </div>
            )}
          </div>
        </div>
      );
    }

    const totalCells = startOffset + totalDays;
    const rowsCount = Math.ceil(totalCells / 7);
    const targetTotalCells = rowsCount * 7;
    const endOffset = targetTotalCells - totalCells;
    for (let i = 0; i < endOffset; i++) {
      days.push(<div key={`empty-end-${i}`} style={{ background: 'var(--color-bg)', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', opacity: 0.3 }}></div>);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} className="fade-in-view">
        {/* Calendar Header / Control */}
        <div className="mobile-stack" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          marginBottom: '1rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
          flexShrink: 0,
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--color-bg)', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '2px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-icon"
                onClick={prevMonth}
                style={{ width: 34, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', textTransform: 'capitalize', minWidth: 140, justifyContent: 'center' }}>
                {monthName} {y}
              </span>
              <button
                type="button"
                className="btn-icon"
                onClick={nextMonth}
                style={{ width: 34, height: 34, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <button
              type="button"
              className="btn outline"
              onClick={() => setCurrentDate(new Date())}
              style={{ height: 36, padding: '0 0.85rem', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {t('Hôm nay')}
            </button>
          </div>

          {/* Calendar Legend */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', fontWeight: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }}></span>
              <span style={{ color: 'var(--color-text-muted)' }}>{t('Đã chia')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a31422' }}></span>
              <span style={{ color: 'var(--color-text-muted)' }}>{t('Ticket lỗi')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#db2777' }}></span>
              <span style={{ color: 'var(--color-text-muted)' }}>{t('Nhắc lại')}</span>
            </div>
          </div>
        </div>

        {/* Calendar Body */}
        <div className="responsive-table-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, minWidth: 700, overflow: 'hidden' }}>
            {/* Calendar Grid Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              background: 'var(--color-border-light)',
              borderBottom: '1px solid var(--color-border)',
              padding: '8px 0',
              flexShrink: 0
            }}>
              {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map(wd => (
                <div key={wd} style={{ padding: '4px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 800, color: wd === 'CN' ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                  <span className="hide-on-mobile">{t(wd)}</span>
                  <span className="mobile-only">{wd === 'CN' ? t('CN') : t(wd.replace('Thứ ', 'T'))}</span>
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gridAutoRows: 'minmax(110px, 1fr)',
              overflowY: 'auto'
            }} className="custom-scrollbar">
              {calendarLoading ? (
                <div style={{ gridColumn: 'span 7' }}>
                  <CalendarSkeleton />
                </div>
              ) : days}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderScheduleView = () => {
    const profile = data.consultant_profile;
    if (!profile) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          {t('Đang tải thông tin lịch làm việc...')}
        </div>
      );
    }

    const onLeave = isCurrentlyOnLeave(profile);

    const handleDayActiveToggle = (dayKey: string, active: boolean) => {
      setEditWorkSchedule((prev: any) => ({
        ...prev,
        [dayKey]: {
          ...(prev[dayKey] || { active: true, start: editWorkStartTime, end: editWorkEndTime }),
          active
        }
      }));
    };

    const handleDayTimeChange = (dayKey: string, field: 'start' | 'end', value: string) => {
      setEditWorkSchedule((prev: any) => ({
        ...prev,
        [dayKey]: {
          ...(prev[dayKey] || { active: true, start: editWorkStartTime, end: editWorkEndTime }),
          [field]: value
        }
      }));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1.5rem 0' }}>
        {/* Header Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
            {t('QUẢN LÝ TÀI KHOẢN')}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-light)', margin: 0 }}>
            {t('Cấu hình thông tin cá nhân, ảnh đại diện và thời gian trực nhận lead tự động.')}
          </p>
        </div>

        {/* 2-Column Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.45fr 1fr', gap: '2rem' }}>

          {/* LEFT COLUMN: Profile Card & Action Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Profile Detail Settings Card */}
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 1.5rem 0', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={20} color="var(--color-primary)" />
                {t('THÔNG TIN CÁ NHÂN')}
              </h3>

              {/* Avatar Section */}
              <div style={{ position: 'relative', display: 'inline-flex', marginBottom: '1.5rem' }}>
                <div style={{
                  border: '3px solid var(--color-primary-light)',
                  borderRadius: '50%',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--color-surface)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                }}>
                  <Avatar src={editAvatar} name={editName} size={110} />
                </div>

                {/* Upload Trigger Input */}
                <label style={{
                  position: 'absolute', bottom: 4, right: 4,
                  background: 'var(--color-primary)', color: 'white',
                  width: 34, height: 34, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(163, 20, 34, 0.3)',
                  transition: 'all 0.2s', border: '2px solid var(--color-surface)'
                }} className="hover-lift active-press" title={t('Tải lên ảnh đại diện mới')}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                </label>

                {isUploadingAvatar && (
                  <div style={{
                    position: 'absolute', inset: 4, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(2px)'
                  }}>
                    <RefreshCw className="spin" size={24} color="white" />
                  </div>
                )}
              </div>

              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem', textAlign: 'center' }}>
                {t('Chấp nhận ảnh JPG, PNG, GIF, WEBP. Tối đa 5MB.')}
              </span>

              {/* Form Input fields */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* SECTION 1: PERSONAL INFO */}
                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Info size={14} /> {t('Thông tin cá nhân')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>{t('Họ và tên')}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t('Nhập tên đầy đủ')}
                        style={{ fontWeight: 600 }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Ngày sinh')}</label>
                        <input
                          type="date"
                          className="form-input"
                          value={editDob}
                          onChange={(e) => setEditDob(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Giới tính')}</label>
                        <CustomSelect
                          options={[
                            { value: '', label: `-- ${t('Chọn giới tính')} --` },
                            { value: 'male', label: t('Nam') },
                            { value: 'female', label: t('Nữ') },
                            { value: 'other', label: t('Khác') }
                          ]}
                          value={editGender}
                          onChange={val => setEditGender(String(val))}
                          placeholder={t('Chọn giới tính...')}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>{t('Số CMND/CCCD')}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editCitizenId}
                        onChange={(e) => setEditCitizenId(e.target.value)}
                        placeholder={t('Nhập số CMND hoặc CCCD')}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Quê quán / Quê hương')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editHometown}
                          onChange={(e) => setEditHometown(e.target.value)}
                          placeholder={t('VD: Hà Nội, Việt Nam')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Quốc tịch')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editNationality}
                          onChange={(e) => setEditNationality(e.target.value)}
                          placeholder={t('VD: Việt Nam')}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Tình trạng hôn nhân')}</label>
                        <CustomSelect
                          options={[
                            { value: '', label: `-- ${t('Chọn tình trạng')} --` },
                            { value: 'single', label: t('Độc thân') },
                            { value: 'married', label: t('Đã kết hôn') },
                            { value: 'divorced', label: t('Đã ly hôn') },
                            { value: 'other', label: t('Khác') }
                          ]}
                          value={editMaritalStatus}
                          onChange={val => setEditMaritalStatus(String(val))}
                          placeholder={t('Chọn tình trạng...')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Email cá nhân')}</label>
                        <input
                          type="email"
                          className="form-input"
                          value={editPersonalEmail}
                          onChange={(e) => setEditPersonalEmail(e.target.value)}
                          placeholder={t('VD: email@gmail.com')}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: WORKPLACE & ERP */}
                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={14} /> {t('Thông tin nhân sự & ERP')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Mã nhân viên')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editEmployeeId}
                          onChange={(e) => setEditEmployeeId(e.target.value)}
                          placeholder="VD: RL-2026-089"
                          style={{ fontWeight: 600, color: 'var(--color-primary)' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Bộ phận / Phòng ban')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editDepartment}
                          onChange={(e) => setEditDepartment(e.target.value)}
                          placeholder="VD: Phòng Kinh doanh 1"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Chức danh / Vị trí')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editJobTitle}
                          onChange={(e) => setEditJobTitle(e.target.value)}
                          placeholder="VD: Chuyên viên Tư vấn"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Loại hợp đồng')}</label>
                        <CustomSelect
                          options={[
                            { value: 'official', label: t('Chính thức') },
                            { value: 'probation', label: t('Thử việc') },
                            { value: 'internship', label: t('Học việc / Thực tập') },
                            { value: 'collaborator', label: t('Cộng tác viên') },
                            { value: 'other', label: t('Khác') }
                          ]}
                          value={editContractType}
                          onChange={val => setEditContractType(String(val))}
                          placeholder={t('Chọn loại hợp đồng...')}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Ngày vào làm')}</label>
                        <input
                          type="date"
                          className="form-input"
                          value={editDateJoined}
                          onChange={(e) => setEditDateJoined(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Người quản lý trực tiếp')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editDirectManager}
                          onChange={(e) => setEditDirectManager(e.target.value)}
                          placeholder="Họ tên người quản lý"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>{t('Địa điểm làm việc')}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editWorkplace}
                        onChange={(e) => setEditWorkplace(e.target.value)}
                        placeholder="VD: Trụ sở chính TP.HCM"
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Chứng chỉ môi giới')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editBrokerLicense}
                          onChange={(e) => setEditBrokerLicense(e.target.value)}
                          placeholder="Mã số chứng chỉ (nếu có)"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Trình độ học vấn')}</label>
                        <CustomSelect
                          options={[
                            { value: 'undergraduate', label: t('Trung cấp / Cao đẳng') },
                            { value: 'graduate', label: t('Đại học') },
                            { value: 'postgraduate', label: t('Thạc sĩ / Tiến sĩ') },
                            { value: 'other', label: t('Khác') }
                          ]}
                          value={editDegree}
                          onChange={val => setEditDegree(String(val))}
                          placeholder={t('Chọn trình độ...')}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: CONTACT & ACCOUNT */}
                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Server size={14} /> {t('Liên hệ & Tài khoản')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Email đăng nhập')}</label>
                      <input
                        type="email"
                        className="form-input"
                        value={profile.email || ''}
                        disabled
                        style={{
                          opacity: 0.7,
                          cursor: 'not-allowed',
                          background: 'var(--color-bg)',
                          borderColor: 'var(--color-border-light)'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Số điện thoại cá nhân')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editPersonalPhone}
                          onChange={(e) => setEditPersonalPhone(e.target.value)}
                          placeholder="Nhập SĐT cá nhân"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Số điện thoại nội bộ')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editExtNumber}
                          onChange={(e) => setEditExtNumber(e.target.value)}
                          placeholder="VD: 104"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>{t('Địa chỉ thường trú')}</label>
                      <textarea
                        className="form-input"
                        rows={2}
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder={t('Nhập địa chỉ của bạn')}
                        style={{ minHeight: '60px', padding: '10px 14px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 4: PAYMENT & TAXES */}
                <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Receipt size={14} /> {t('Thanh toán & Thuế')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Tên ngân hàng')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editBankName}
                          onChange={(e) => setEditBankName(e.target.value)}
                          placeholder={t('VD: Vietcombank')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Số tài khoản')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editBankAccount}
                          onChange={(e) => setEditBankAccount(e.target.value)}
                          placeholder={t('Nhập số tài khoản')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Chi nhánh ngân hàng')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editBankBranch}
                          onChange={(e) => setEditBankBranch(e.target.value)}
                          placeholder={t('Nhập chi nhánh')}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Mã số thuế cá nhân')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editTaxId}
                          onChange={(e) => setEditTaxId(e.target.value)}
                          placeholder="Mã số thuế"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Số sổ BHXH')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editInsuranceId}
                          onChange={(e) => setEditInsuranceId(e.target.value)}
                          placeholder="Mã số BHXH"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 5: EMERGENCY CONTACT */}
                <div style={{ paddingBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Scale size={14} /> {t('Liên hệ khẩn cấp')}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Người liên hệ')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editEmergencyName}
                          onChange={(e) => setEditEmergencyName(e.target.value)}
                          placeholder="Họ tên người liên hệ"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Mối quan hệ')}</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editEmergencyRelation}
                          onChange={(e) => setEditEmergencyRelation(e.target.value)}
                          placeholder="VD: Bố, Mẹ, Vợ, Chồng..."
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>{t('Số điện thoại khẩn cấp')}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editEmergencyPhone}
                        onChange={(e) => setEditEmergencyPhone(e.target.value)}
                        placeholder="SĐT người liên hệ"
                      />
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  className="btn primary"
                  style={{ width: '100%', marginTop: '1rem', height: '46px' }}
                  onClick={handleSaveProfile}
                  disabled={savingProfile || isUploadingAvatar}
                >
                  {savingProfile ? (
                    <>
                      <RefreshCw size={18} className="spin" />
                      {t('Đang lưu thiết lập...')}
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      {t('Lưu thiết lập')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Vacation Toggle & Work Hour Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Vacation Status Card */}
            <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock3 size={20} color="var(--color-primary)" />
                    {t('TRẠNG THÁI NHẬN DATA')}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
                    {t('Khi kích hoạt: Nhận khách hàng mới theo vòng chia. Khi tắt (Nghỉ/Tạm ngưng): Dừng nhận khách hàng mới, nhưng khách hàng cũ đăng ký lại VẪN sẽ tự động chuyển và gửi tin nhắn Nhắc trùng cho bạn chăm sóc.')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    fontSize: '0.9rem', fontWeight: 800,
                    color: !portalVacationMode && !onLeave ? 'var(--color-success)' : 'var(--color-warning)'
                  }}>
                    {!portalVacationMode && !onLeave ? t('Sẵn sàng') :
                      onLeave ? t('Nghỉ phép') : t('Tạm ngưng')}
                  </span>
                  {effectiveRole === 'sale' && (
                    <div style={{ pointerEvents: onLeave ? 'none' : 'auto', opacity: onLeave ? 0.5 : 1 }}>
                      <ToggleSwitch
                        checked={!portalVacationMode}
                        onChange={() => {
                          if (!portalVacationMode) {
                            setVacationConfirmOpen(true);
                          } else {
                            handleTogglePortalVacation();
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {onLeave && (
                <div style={{
                  background: 'var(--color-warning-light)', color: 'var(--color-warning)', padding: '12px 16px',
                  borderRadius: '10px', border: '1px solid currentColor', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <AlertTriangle size={16} />
                  <span>{t('Bạn hiện đang trong thời gian nghỉ phép. Hệ thống tự động khóa chế độ nhận data cho đến khi kết thúc kỳ nghỉ.')}</span>
                </div>
              )}
            </div>

            {/* Night Shift Registration Card */}
            <div className="card" style={{ padding: '1.5rem', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldAlert size={18} color="var(--color-primary)" />
                    {t('ĐĂNG KÝ TRỰC CA ĐÊM (18h-6h)')}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
                    {t('Nhận lead tự động trong ca đêm. Danh sách đăng ký tự reset vào lúc 6:00 sáng hôm sau.')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    fontSize: '0.875rem', fontWeight: 700,
                    color: nightShiftRegistered ? 'var(--color-success)' : 'var(--color-text-muted)'
                  }}>
                    {nightShiftRegistered ? t('Đã đăng ký trực') : t('Chưa đăng ký')}
                  </span>
                  {effectiveRole === 'sale' && (
                    <div style={{ opacity: nightShiftCanToggle ? 1 : 0.5, pointerEvents: nightShiftCanToggle ? 'auto' : 'none' }}>
                      <ToggleSwitch
                        checked={nightShiftRegistered}
                        onChange={handleToggleNightShift}
                      />
                    </div>
                  )}
                </div>
              </div>

              {!nightShiftCanToggle && (
                <div style={{
                  background: 'var(--color-warning-light)', color: 'var(--color-warning)', padding: '10px 14px',
                  borderRadius: '8px', border: '1px solid currentColor', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <Info size={14} />
                  <span>{t('Đã quá 18:00. Bạn không thể thay đổi đăng ký trực ca đêm hôm nay.')}</span>
                </div>
              )}
            </div>

            {/* Leave (Nghỉ phép) registration card */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="var(--color-warning)" />
                {t('ĐĂNG KÝ NGHỈ PHÉP (LEAVE)')}
              </h3>

              {onLeave && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8, textAlign: 'center', fontWeight: 700, fontSize: '0.8rem',
                  background: 'var(--color-warning-light)', color: 'var(--color-warning)', marginBottom: '0.5rem'
                }}>
                  {t('ĐANG TRONG KỲ NGHỈ PHÉP')}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Từ ngày')}</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editLeaveStart}
                    onChange={(e) => setEditLeaveStart(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>{t('Đến ngày')}</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editLeaveEnd}
                    onChange={(e) => setEditLeaveEnd(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn primary"
                style={{ width: '100%', marginTop: '0.25rem', height: '40px' }}
                onClick={handleAddLeave}
                disabled={savingLeave}
              >
                {savingLeave ? (
                  <>
                    <RefreshCw size={18} className="spin" style={{ marginRight: 6 }} />
                    {t('Đang đăng ký...')}
                  </>
                ) : (
                  t('Đăng ký nghỉ')
                )}
              </button>

              {/* Lịch sử đăng ký nghỉ phép */}
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t('LỊCH SỬ NGHỈ PHÉP')}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                    ({leaveHistory.length})
                  </span>
                </h4>

                {loadingLeaves ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    <RefreshCw className="spin" size={16} style={{ marginRight: 6 }} />
                    {t('Đang tải lịch sử...')}
                  </div>
                ) : leaveHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                    {t('Chưa có đăng ký nghỉ phép nào.')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                    {leaveHistory.map((leave) => {
                      const todayStr = new Date().toISOString().split('T')[0];
                      const isPast = leave.end_date < todayStr;
                      const isCurrent = todayStr >= leave.start_date && todayStr <= leave.end_date;

                      return (
                        <div
                          key={leave.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            background: isCurrent ? 'var(--color-warning-light)' : (isPast ? 'var(--color-bg)' : 'var(--color-surface)'),
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '8px',
                            opacity: isPast ? 0.6 : 1
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
                              {new Date(leave.start_date).toLocaleDateString('vi-VN')} → {new Date(leave.end_date).toLocaleDateString('vi-VN')}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: isCurrent ? 'var(--color-warning)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                              {isCurrent ? t('Đang diễn ra') : (isPast ? t('Đã qua') : t('Sắp tới'))}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteLeave(leave.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-danger)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background 0.2s'
                            }}
                            className="hover-bg-danger-light"
                            title={t('Xóa lịch nghỉ')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Combined Work Hours & Schedule Card */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={18} color="var(--color-primary)" />
                  {t('GIỜ LÀM VIỆC & LỊCH TRÌNH')}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4, marginBottom: 0 }}>
                  {t('Thiết lập thời gian nhận lead cố định hàng ngày hoặc lịch trình tùy chỉnh theo từng thứ.')}
                </p>
              </div>

              {/* Segmented Control for Schedule Mode */}
              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-bg)', padding: '4px', borderRadius: '12px' }}>
                <button
                  type="button"
                  onClick={() => setScheduleMode('daily')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem',
                    background: scheduleMode === 'daily' ? (theme === 'dark' ? 'var(--color-surface)' : 'white') : 'transparent',
                    color: scheduleMode === 'daily' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: scheduleMode === 'daily' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                  }}
                >{t('Cố định hàng ngày')}</button>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleMode('custom');
                    if (!editWorkSchedule) {
                      setEditWorkSchedule(DEFAULT_SCHEDULE);
                    }
                  }}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem',
                    background: scheduleMode === 'custom' ? (theme === 'dark' ? 'var(--color-surface)' : 'white') : 'transparent',
                    color: scheduleMode === 'custom' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: scheduleMode === 'custom' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.2s', border: 'none', cursor: 'pointer'
                  }}
                >{t('Tùy chỉnh (Thứ 2 - CN)')}</button>
              </div>

              {scheduleMode === 'daily' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'slideUp 0.15s ease-out' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                        {t('Bắt đầu làm việc')}
                      </label>
                      <input
                        type="time"
                        className="form-input"
                        value={editWorkStartTime}
                        onChange={(e) => setEditWorkStartTime(e.target.value)}
                        style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', letterSpacing: '0.05em' }}
                      />
                    </div>
                    <div style={{ fontSize: '1.5rem', color: 'var(--color-text-muted)', paddingTop: '20px' }}>→</div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                        {t('Kết thúc làm việc')}
                      </label>
                      <input
                        type="time"
                        className="form-input"
                        value={editWorkEndTime}
                        onChange={(e) => setEditWorkEndTime(e.target.value)}
                        style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', letterSpacing: '0.05em' }}
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                    💡 {t('Lưu ý: Lead mới sẽ chỉ được phân bổ tự động cho bạn trong khoảng thời gian làm việc đã thiết lập.')}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', animation: 'slideUp 0.15s ease-out' }}>
                  {Object.entries(DAY_LABELS).map(([dayKey, dayLabel]) => {
                    const config = editWorkSchedule[dayKey] || { active: true, start: editWorkStartTime, end: editWorkEndTime };
                    const isActive = config.active;

                    return (
                      <div
                        key={dayKey}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--color-border-light)',
                          background: isActive ? 'var(--color-surface)' : 'var(--color-bg)',
                          transition: 'all 0.2s',
                          boxShadow: isActive ? 'var(--shadow-xs)' : 'none'
                        }}
                      >
                        {/* Day Label with custom checkbox */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0, userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            className="custom-checkbox"
                            checked={isActive}
                            onChange={(e) => handleDayActiveToggle(dayKey, e.target.checked)}
                          />
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                            {t(dayLabel)}
                          </span>
                        </label>

                        {/* Day Hour Inputs / Offline badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {isActive ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="time"
                                className="form-input"
                                style={{ width: '92px', height: '34px', fontSize: '0.8rem', padding: '0 6px', textAlign: 'center', borderRadius: '6px' }}
                                value={config.start || editWorkStartTime}
                                onChange={(e) => handleDayTimeChange(dayKey, 'start', e.target.value)}
                              />
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>-</span>
                              <input
                                type="time"
                                className="form-input"
                                style={{ width: '92px', height: '34px', fontSize: '0.8rem', padding: '0 6px', textAlign: 'center', borderRadius: '6px' }}
                                value={config.end || editWorkEndTime}
                                onChange={(e) => handleDayTimeChange(dayKey, 'end', e.target.value)}
                              />
                            </div>
                          ) : (
                            <span style={{
                              padding: '2px 8px', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700,
                              background: 'var(--color-danger-light)',
                              color: 'var(--color-danger)'
                            }}>
                              {t('Nghỉ')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* TÀI LIỆU & HỢP ĐỒNG NHÂN SỰ */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={18} color="var(--color-primary)" />
                  {t('HỒ SƠ & TÀI LIỆU NHÂN SỰ')}
                </h3>
                {/* Admin/Manager upload button */}
                {(['admin', 'superadmin', 'manager', 'assistant'].includes(user?.role as any)) && (
                  <label style={{
                    background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                    padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', margin: 0
                  }}>
                    <Plus size={14} />
                    {t('Tải lên')}
                    <input type="file" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !targetConsultantId) return;
                      setUploadingDoc(true);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('name', file.name);
                        formData.append('category', `consultant_${targetConsultantId}`);
                        formData.append('visibility', 'shared');
                        
                        const uploadRes = await api.post('/cloud-files', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        if (uploadRes.data && uploadRes.data.success) {
                          toast.success(t('Đã tải tài liệu lên thành công!'));
                          fetchConsultantDocs();
                        } else {
                          toast.error(uploadRes.data.message || t('Lỗi tải tài liệu lên'));
                        }
                      } catch (err: any) {
                        toast.error(t('Lỗi kết nối tải tài liệu: ') + err.message);
                      } finally {
                        setUploadingDoc(false);
                      }
                    }} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
                {t('Danh sách tài liệu hợp đồng, quyết định khen thưởng/kỷ luật hoặc hồ sơ nhân sự.')}
              </p>

              {uploadingDoc && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  <RefreshCw className="spin" size={14} />
                  {t('Đang tải tài liệu lên...')}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.5rem' }}>
                {consultantDocs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic', background: 'var(--color-bg)', borderRadius: '8px' }}>
                    {t('Chưa có tài liệu nào được tải lên.')}
                  </div>
                ) : (
                  consultantDocs.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        background: 'var(--color-bg)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginRight: '8px' }}>
                        <a
                          href={resolveAttachmentUrl(doc.file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden'
                          }}
                          className="hover-underline"
                        >
                          {doc.name}
                        </a>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          {t('Tải lên bởi')} {doc.uploader_name || t('Hệ thống')} • {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        {/* Download link */}
                        <a
                          href={resolveAttachmentUrl(doc.file_path)}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-primary)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          className="hover-bg-primary-light"
                          title={t('Tải xuống')}
                        >
                          <ArrowUpRight size={15} />
                        </a>

                        {/* Admin/Manager delete button */}
                        {(['admin', 'superadmin', 'manager', 'assistant'].includes(user?.role as any)) && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(t('Bạn có chắc chắn muốn xóa tài liệu này?'))) return;
                              try {
                                const res = await api.delete(`/cloud-files/${doc.id}`);
                                if (res.data && res.data.success) {
                                  toast.success(t('Đã xóa tài liệu thành công!'));
                                  fetchConsultantDocs();
                                } else {
                                  toast.error(res.data.message || t('Lỗi khi xóa tài liệu'));
                                }
                              } catch (err: any) {
                                  toast.error(t('Lỗi kết nối xóa tài liệu: ') + err.message);
                              }
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-danger)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            className="hover-bg-danger-light"
                            title={t('Xóa tài liệu')}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    );
  };

  // Active Sale Portal View
  return (
    <div style={embedMode ? { width: '100%' } : { height: '100vh', width: '100vw', background: 'var(--color-bg)', display: 'flex', overflow: 'hidden' }}>

      {/* Mobile Sidebar overlay */}
      {!embedMode && isMobileSidebarOpen && (
        <div
          className="responsive-sidebar-overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      {!embedMode && (
        <aside
        className={`responsive-sidebar ${isMobileSidebarOpen ? 'responsive-sidebar-open' : ''}`}
        style={{
          width: isCollapsed ? 72 : 260,
          background: 'var(--sidebar-bg, #161d31)',
          color: '#dadada',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 50,
          boxShadow: '4px 0 24px rgba(0,0,0,0.12)'
        }}
      >
        {/* Logo Area */}
        <div style={{
          height: 92,
          display: 'flex',
          alignItems: 'center',
          padding: isCollapsed ? '20px 0 0 0' : '20px 1.25rem 0 1.25rem',
          gap: '0.875rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          overflow: 'hidden'
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(192, 132, 252, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            border: '2px solid rgba(192, 132, 252, 0.8)'
          }}>
            <img src="/LOGO.jpg" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              alt="logo" />
          </div>

          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 900, whiteSpace: 'nowrap', color: 'white', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                RICH LAND
              </span>
              <span style={{
                fontSize: '0.625rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #f45b69 0%, #e63946 50%, #BD1D2D 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginTop: '4px',
                whiteSpace: 'nowrap'
              }}>
                / SALE PORTAL
              </span>
            </div>
          )}
        </div>

        {/* Quick Action Button */}
        <div style={{ padding: isCollapsed ? '0.75rem 0.5rem' : '1.25rem 1rem', display: 'flex', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {isCollapsed ? (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
                setIsMobileSidebarOpen(false);
              }}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(189, 29, 45, 0.4)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              title={t("Thêm data nhanh")}
            >
              <Plus size={20} />
            </button>
          ) : (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
                setIsMobileSidebarOpen(false);
              }}
              style={{
                width: '100%', height: 44, borderRadius: '12px',
                background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(189, 29, 45, 0.4)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(189, 29, 45, 0.5)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(189, 29, 45, 0.4)';
              }}
            >
              <Plus size={18} /> {t("Thêm data nhanh")}
            </button>
          )}
        </div>

        {/* Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="responsive-hide-mobile"
          style={{
            position: 'absolute', right: -12, top: 36, transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%', background: 'var(--color-surface)', color: 'var(--color-text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 200, border: '1px solid var(--color-border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'all 0.2s',
          }}
        >
          <ChevronLeft size={14} style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
        </button>

        {/* Navigation list */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none' }}>
          <div ref={navContainerRef} style={{ position: 'relative', padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>

            {/* Sliding Active Indicator */}
            {sliderStyle.height > 0 && (
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 4,
                height: sliderStyle.height,
                background: 'var(--color-primary)',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: `translateY(${sliderStyle.top}px)`,
                borderRadius: '0 2px 2px 0',
                pointerEvents: 'none',
                zIndex: 10
              }} />
            )}

            {(() => {
              const PORTAL_SIDEBAR_GROUPS = [
                {
                  title: 'TỔNG QUAN',
                  items: [
                    { name: 'Tổng quan', key: 'dashboard', icon: LayoutDashboard },
                    { name: 'Bàn làm việc', key: 'workspace', icon: CheckSquare },
                    { name: 'Kho Databank', key: 'databank', icon: Layers }
                  ]
                },
                {
                  title: 'KHÁCH HÀNG',
                  items: [
                    { name: 'Nhật ký Data', key: 'data', icon: Database },
                    { name: 'Khách hàng CRM', key: 'crm-contacts', icon: Users, route: '/contacts' },
                    { name: 'Lịch biểu', key: 'calendar', icon: Calendar },
                    { name: 'Đối soát công bằng', key: 'fair-share', icon: Scale },
                    { name: 'Ticket Lỗi Data', key: 'tickets', icon: Ticket, badgeCount: data.stats.tickets_pending },
                    { name: 'Ticket Hỗ Trợ', key: 'support-tickets', icon: LifeBuoy, route: '/support-tickets' }
                  ]
                },
                {
                  title: 'DỰ ÁN',
                  items: [
                    { name: 'Dự án', key: 'projects', icon: Building2 },
                    { name: 'Tài liệu', key: 'files', icon: FileText }
                  ]
                },
                {
                  title: 'NHÂN SỰ',
                  items: [
                    { name: 'Tư vấn viên', key: 'consultants', icon: Users }
                  ]
                },
                {
                  title: 'TÀI CHÍNH',
                  items: [
                    { name: 'Hóa đơn', key: 'invoices', icon: Receipt },
                    { name: 'Phiếu hợp tác', key: 'cooperation-slips', icon: Scale, route: '/cooperation-slips' }
                  ]
                },
                {
                  title: 'CÀI ĐẶT TÀI KHOẢN',
                  items: [
                    { name: 'Quản lý tài khoản', key: 'schedule', icon: Settings }
                  ]
                }
              ];

              return PORTAL_SIDEBAR_GROUPS.map((group, groupIdx) => (
                <React.Fragment key={groupIdx}>
                  {!isCollapsed && (
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
                      padding: '0.5rem 1.5rem', whiteSpace: 'nowrap',
                      display: 'block',
                      marginTop: groupIdx > 0 ? '1.25rem' : '0.5rem',
                      marginBottom: '0.25rem'
                    }}>{t(group.title)}</span>
                  )}
                  {group.items.map(({ name, key, icon: Icon, badgeCount, route }) => {
                    const isActive = activeTab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          if (route) {
                            navigate(route);
                          } else {
                            setActiveTab(key as any);
                          }
                          setIsMobileSidebarOpen(false);
                        }}
                        data-active={isActive ? "true" : "false"}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.875rem',
                          padding: isCollapsed ? '0.75rem 0' : '0.75rem 1.5rem',
                          justifyContent: isCollapsed ? 'center' : 'flex-start',
                          color: isActive ? '#dadada' : 'rgba(255,255,255,0.5)',
                          border: 'none', background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                          fontSize: '0.9375rem', cursor: 'pointer', width: '100%',
                          fontWeight: isActive ? 700 : 500, transition: 'all 0.2s ease',
                          position: 'relative', textAlign: 'left', outline: 'none'
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.2s', position: 'relative'
                        }}>
                          <Icon size={18} color={isActive ? '#dadada' : 'rgba(255,255,255,0.5)'} />
                          {isCollapsed && badgeCount !== undefined && badgeCount > 0 && (
                            <span style={{
                              position: 'absolute', top: 4, right: 4,
                              width: 8, height: 8, borderRadius: '50%',
                              background: '#ef4444',
                              boxShadow: '0 0 0 2px var(--sidebar-bg, #161d31)'
                            }} />
                          )}
                        </div>

                        {!isCollapsed && (
                          <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            {t(name)}
                            {badgeCount !== undefined && badgeCount > 0 && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 800,
                                height: 20, minWidth: 20, padding: '0 6px', borderRadius: '9999px'
                              }}>
                                {badgeCount}
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              ));
            })()}
          </div>
        </div>
      </aside>
      )}

      {/* Right Side Content Panel */}
      <div style={embedMode ? { width: '100%' } : { flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Top Header Navigation */}
        {!embedMode && (
          <header className="portal-header" style={{
          height: 66,
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Mobile Hamburger menu toggle */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              style={{
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                cursor: 'pointer',
                color: 'var(--color-text)'
              }}
              className="mobile-menu-btn"
            >
              <Menu size={20} />
            </button>

            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '0.5px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>RICH LAND PORTAL</span>
                <span style={{ fontSize: '0.725rem', padding: '2px 8px', borderRadius: 20, background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 700 }}>
                  SALE
                </span>
              </h1>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {t('Nhân viên: {name}').replace('{name}', displayUser?.name || '')}
                {(user?.role === 'admin' || user?.role === 'superadmin') && saleIdFilter && (
                  <button 
                    onClick={handleExitImpersonation}
                    style={{
                      background: 'var(--color-danger-light)',
                      color: 'var(--color-danger)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--color-danger-light)'}
                  >
                    {t('Thoát đóng vai')}
                  </button>
                )}
              </span>
            </div>
          </div>

          <div className="portal-header-user" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            {/* Switch to CRM Button */}
            <button 
              onClick={() => navigate('/contacts')}
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                transition: 'all 0.2s',
                marginRight: '0.5rem',
                outline: 'none'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Users size={14} />
              {t('Tru cập CRM')}
            </button>

            {/* Quick Vacation Toggle for Sale */}
            {displayUser?.role === 'sale' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '6px 12px',
                marginRight: '0.5rem'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: !portalVacationMode ? '#10b981' : '#f59e0b' }}>
                  {!portalVacationMode ? t('Nhận data') : t('Tạm ngưng')}
                </span>
                <ToggleSwitch
                  checked={!portalVacationMode}
                  onChange={() => {
                    if (!portalVacationMode) {
                      setVacationConfirmOpen(true);
                    } else {
                      handleTogglePortalVacation();
                    }
                  }}
                />
              </div>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-light)',
                borderRadius: 8,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none'
              }}
              title={theme === 'light' ? t("Chuyển sang giao diện tối") : t("Chuyển sang giao diện sáng")}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--color-bg)';
                e.currentTarget.style.color = 'var(--color-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--color-text-light)';
              }}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} style={{ color: '#fbbf24' }} />}
            </button>

            {/* Language Selector Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLangOpen(!isLangOpen);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'var(--color-bg)',
                  border: `1px solid ${isLangOpen ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: '6px',
                  padding: '3px 6px',
                  cursor: 'pointer',
                  color: 'var(--color-text)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                  height: 30,
                  outline: 'none',
                  boxShadow: 'none',
                }}
                title={t('Chọn ngôn ngữ')}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isLangOpen ? 'var(--color-primary)' : 'var(--color-border)';
                }}
              >
                <img
                  src={languagesList.find(l => l.code === language)?.flag || vnFlag}
                  style={{
                    width: 24,
                    height: 16,
                    borderRadius: '1.5px',
                    objectFit: 'cover',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    display: 'block'
                  }}
                  alt={t(languagesList.find(l => l.code === language)?.name || 'Tiếng Việt')}
                />
                <ChevronDown
                  size={12}
                  style={{
                    color: 'var(--color-text-muted)',
                    transform: isLangOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s'
                  }}
                />
              </button>

              {isLangOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: '135px',
                  zIndex: 50
                }}>
                  {languagesList.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsLangOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '8px 10px',
                        border: 'none',
                        background: language === lang.code ? 'var(--color-bg)' : 'transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: 'var(--color-text)',
                        fontSize: '0.8125rem',
                        fontWeight: language === lang.code ? 600 : 400,
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => {
                        if (language !== lang.code) e.currentTarget.style.background = 'var(--color-bg)';
                      }}
                      onMouseLeave={e => {
                        if (language !== lang.code) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <img
                        src={lang.flag}
                        style={{ width: 20, height: 14, borderRadius: '1.5px', objectFit: 'cover', border: '1px solid rgba(0, 0, 0, 0.08)' }}
                        alt={lang.name}
                      />
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Check-in Button */}
            {displayUser?.role === 'sale' && (
              <div style={{ marginRight: '0.75rem', display: 'flex', alignItems: 'center' }}>
                {todayCheckIn ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: todayCheckIn.status === 'rejected' ? 'pointer' : 'default',
                      border: '1px solid',
                      backgroundColor: 
                        todayCheckIn.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' :
                        todayCheckIn.status === 'pending_approval' ? 'rgba(245, 158, 11, 0.1)' :
                        'rgba(239, 68, 68, 0.1)',
                      color: 
                        todayCheckIn.status === 'approved' ? 'var(--color-success)' :
                        todayCheckIn.status === 'pending_approval' ? 'var(--color-warning)' :
                        'var(--color-danger)',
                      borderColor: 
                        todayCheckIn.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' :
                        todayCheckIn.status === 'pending_approval' ? 'rgba(245, 158, 11, 0.2)' :
                        'rgba(239, 68, 68, 0.2)',
                    }}
                    onClick={() => {
                      if (todayCheckIn.status === 'rejected') {
                        setCheckInModalOpen(true);
                      }
                    }}
                    title={
                      todayCheckIn.status === 'approved' ? t('Đã chấm công thành công') :
                      todayCheckIn.status === 'pending_approval' ? t('Đang chờ quản lý phê duyệt đi trễ') :
                      t('Bị từ chối chấm công. Click để thử lại.')
                    }
                  >
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 
                        todayCheckIn.status === 'approved' ? 'var(--color-success)' :
                        todayCheckIn.status === 'pending_approval' ? 'var(--color-warning)' :
                        'var(--color-danger)',
                    }} />
                    {todayCheckIn.status === 'approved' && `${t('Đã Check-in')} (${todayCheckIn.check_in_time.substring(0, 5)})`}
                    {todayCheckIn.status === 'pending_approval' && `${t('Chờ duyệt trễ')} (${todayCheckIn.check_in_time.substring(0, 5)})`}
                    {todayCheckIn.status === 'rejected' && t('Chấm công bị từ chối')}
                  </div>
                ) : (
                  <button
                    className="btn primary sm"
                    style={{
                      borderRadius: '20px',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: 'auto',
                      backgroundColor: '#BD1D2D',
                    }}
                    onClick={() => setCheckInModalOpen(true)}
                  >
                    <Camera size={14} />
                    {t('Chấm công')}
                  </button>
                )}
              </div>
            )}

            {/* Hoverable Profile Dropdown */}
            <div
              onMouseEnter={() => setIsProfileMenuOpen(true)}
              onMouseLeave={() => setIsProfileMenuOpen(false)}
              style={{ position: 'relative' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  paddingLeft: '0.875rem',
                  borderLeft: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'background 0.2s',
                  background: isProfileMenuOpen ? 'var(--color-bg)' : 'transparent'
                }}
              >
                <Avatar src={displayUser?.avatar} name={displayUser?.name} size={32} />
                <div className="responsive-hide-mobile" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{displayUser?.name || 'User'}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{displayUser?.email}</span>
                </div>
              </div>

              {isProfileMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '4px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: '160px',
                  zIndex: 50
                }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '8px 10px',
                      color: 'var(--color-text)',
                      fontSize: '0.75rem',
                      borderBottom: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      borderRadius: '6px 6px 0 0'
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{displayUser?.name}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.65rem' }}>{displayUser?.email}</span>
                  </div>

                  <a
                    href="https://zalo.me/0378859736"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--color-text)',
                      fontSize: '0.8125rem',
                      textAlign: 'left',
                      textDecoration: 'none',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} />
                    {t('Báo lỗi')}
                  </a>

                  {currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin' && (
                    <>
                      <button
                        onClick={() => {
                          setActiveTab('schedule');
                          setIsProfileMenuOpen(false);
                          toast.success(t('Đang mở trang Thông tin cá nhân'));
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '8px 10px',
                          border: 'none',
                          background: 'transparent',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          fontSize: '0.8125rem',
                          textAlign: 'left',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <User size={14} style={{ color: 'var(--color-primary)' }} />
                        {t('Thông tin cá nhân')}
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('consultants');
                          setIsProfileMenuOpen(false);
                          toast.success(t('Đang mở trang Thông tin Team'));
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '8px 10px',
                          border: 'none',
                          background: 'transparent',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          fontSize: '0.8125rem',
                          textAlign: 'left',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Users size={14} style={{ color: 'var(--color-primary)' }} />
                        {t('Thông tin Team')}
                      </button>
                    </>
                  )}

                  <div style={{ borderBottom: '1px solid var(--color-border)', margin: '4px 0' }} />

                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 10px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: 'var(--color-danger)',
                      fontSize: '0.8125rem',
                      textAlign: 'left',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <LogOut size={14} />
                    {t('Đăng xuất')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        )}

        {/* Scrollable View Area */}
        <main className={embedMode ? "" : "no-scrollbar responsive-main portal-main-content"} style={embedMode ? { width: '100%' } : { flex: 1, padding: '2rem 3rem', width: '100%', overflowY: 'auto' }}>
          <div style={{ width: '100%' }}>
            {/* Admin Switch Sale View warning/dropdown */}
            {(user?.role === 'admin' || user?.role === 'superadmin') && data.consultants && !saleIdFilter && (
              <div className="portal-filters-row" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px',
                padding: '1rem 1.5rem'
              }}>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={16} color="var(--color-warning)" />
                    {t('GÓC QUẢN TRỊ VIÊN')}
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                    {t('Đang xem dữ liệu với vai trò của nhân viên được chọn dưới đây.')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('ĐÓNG VAI SALE:')}</span>
                  <CustomSelect
                    options={[
                      { value: '', label: t('Chọn tư vấn viên...') },
                      ...(data.consultants || []).map((c: any) => ({ value: c.id, label: c.name, avatar: c.avatar }))
                    ]}
                    value={saleIdFilter}
                    onChange={(val) => {
                      setSaleIdFilter(String(val));
                      setCurrentPage(1);
                    }}
                    width={220}
                    showAvatars={true}
                    searchable={true}
                    align="right"
                  />
                </div>
              </div>
            )}

            {/* Render views based on activeTab */}
            <div key={activeTab} className="subtab-enter-active">
              {activeTab === 'dashboard' && renderDashboardView()}
              {activeTab === 'workspace' && renderWorkspaceView()}
              {activeTab === 'data' && renderDataView()}
              {activeTab === 'databank' && renderDatabankView()}
              {activeTab === 'calendar' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Title & Sub-tabs header row */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    width: '100%'
                  }}>
                    <div>
                      <h1 className="page-title" style={{ margin: 0 }}>{t('Lịch biểu & Chấm công')}</h1>
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      background: 'var(--color-bg)',
                      padding: '4px',
                      borderRadius: '8px'
                    }}>
                      <button
                        onClick={() => setCalendarSubTab('calendar')}
                        style={{
                          padding: '6px 16px',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          background: calendarSubTab === 'calendar' ? 'var(--color-surface)' : 'transparent',
                          color: calendarSubTab === 'calendar' ? 'var(--color-primary)' : 'var(--color-text-light)',
                          boxShadow: calendarSubTab === 'calendar' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Calendar size={14} style={{ color: calendarSubTab === 'calendar' ? 'var(--color-primary)' : 'var(--color-text-light)' }} />
                        {t('Lịch biểu')}
                      </button>
                      <button
                        onClick={() => setCalendarSubTab('attendance')}
                        style={{
                          padding: '6px 16px',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          background: calendarSubTab === 'attendance' ? 'var(--color-surface)' : 'transparent',
                          color: calendarSubTab === 'attendance' ? 'var(--color-primary)' : 'var(--color-text-light)',
                          boxShadow: calendarSubTab === 'attendance' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Clock size={14} style={{ color: calendarSubTab === 'attendance' ? 'var(--color-primary)' : 'var(--color-text-light)' }} />
                        {t('Chấm công')}
                      </button>
                    </div>
                  </div>

                  {/* View body */}
                  <div style={{ flex: 1 }}>
                    {calendarSubTab === 'calendar' ? renderCalendarView() : <AttendancePage embedMode={true} />}
                  </div>
                </div>
              )}
              {activeTab === 'fair-share' && <FairShareAudit forceActive={true} />}
              {activeTab === 'tickets' && renderTicketsView()}
              {activeTab === 'schedule' && renderScheduleView()}
              {activeTab === 'invoices' && <InvoicesPage />}
              {activeTab === 'projects' && <ProjectsPage />}
              {activeTab === 'files' && <FilesPage />}
              {activeTab === 'consultants' && <Consultants />}
            </div>
          </div>
        </main>
      </div>

      {/* Check-in Modal */}
      {checkInModalOpen && (
        <CustomModal
          isOpen={checkInModalOpen}
          onClose={() => setCheckInModalOpen(false)}
          title={t("CHẤM CÔNG HÀNG NGÀY")}
          width="500px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {t('Vui lòng chụp ảnh selfie khuôn mặt của bạn để thực hiện chấm công và nhận data hôm nay.')}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid var(--color-border)'
              }}>
                {t('Giờ vào làm quy định:')} <span style={{ color: '#BD1D2D' }}>{impersonatedSale ? (impersonatedSale.work_start_time || '08:00') : (data.consultant_profile?.work_start_time || '08:00')}</span>
              </div>
            </div>

            <div style={{
              position: 'relative',
              width: '260px',
              height: '260px',
              backgroundColor: '#000',
              borderRadius: '50%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px solid var(--color-border)',
              margin: '0 auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
            }}>
              {capturedImage ? (
                <img
                  src={capturedImage}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  alt="Captured Selfie"
                />
              ) : isCameraActive ? (
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  playsInline
                  muted
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#fff', padding: '20px', textAlign: 'center' }}>
                  <Camera size={40} style={{ opacity: 0.5 }} />
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                    {cameraError || t('Camera chưa được kích hoạt')}
                  </span>
                  <button
                    type="button"
                    className="btn primary sm"
                    onClick={startCamera}
                    style={{ backgroundColor: '#BD1D2D', border: 'none' }}
                  >
                    {t('Kích hoạt Camera')}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {isCameraActive && !capturedImage && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={capturePhoto}
                  style={{
                    backgroundColor: '#BD1D2D',
                    color: '#fff',
                    borderRadius: '20px',
                    padding: '8px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Camera size={16} />
                  {t('Chụp ảnh selfie')}
                </button>
              )}
              {capturedImage && (
                <button
                  type="button"
                  className="btn outline"
                  onClick={startCamera}
                  style={{
                    borderRadius: '20px',
                    padding: '8px 20px'
                  }}
                >
                  {t('Chụp lại')}
                </button>
              )}
            </div>

            {isLate && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--color-danger)', fontSize: '0.8125rem', fontWeight: 700 }}>
                  <AlertTriangle size={16} />
                  {t('Bạn đã trễ giờ làm việc!')}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', margin: 0 }}>
                  {t('Vui lòng gửi lý do "Xin nhận lead hôm nay" để Quản lý duyệt mở cổng nhận data.')}
                </p>
                <textarea
                  className="form-control"
                  style={{
                    width: '100%',
                    height: '70px',
                    fontSize: '0.8125rem',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    resize: 'none'
                  }}
                  placeholder={t('Ví dụ: Kẹt xe tại ngã tư Thủ Đức, hỏng xe...')}
                  value={checkInReason}
                  onChange={(e) => setCheckInReason(e.target.value)}
                  required
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '4px' }}>
              <button
                type="button"
                className="btn secondary sm"
                onClick={() => setCheckInModalOpen(false)}
              >
                {t('Đóng')}
              </button>
              <button
                type="button"
                className="btn primary sm"
                disabled={checkInSubmitting || !capturedImage || (isLate && !checkInReason.trim())}
                onClick={() => handleSubmitCheckIn()}
                style={{
                  backgroundColor: '#BD1D2D',
                  color: '#fff',
                }}
              >
                {checkInSubmitting ? t('Đang gửi...') : t('Xác nhận Chấm công')}
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {/* Vacation Confirm Modal */}
      {vacationConfirmOpen && (
        <CustomModal
          isOpen={vacationConfirmOpen}
          onClose={() => setVacationConfirmOpen(false)}
          title={t("CẢNH BÁO TẠM NGƯNG NHẬN DATA")}
          width="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', color: 'var(--color-danger)' }}>
              <AlertTriangle size={24} style={{ flexShrink: 0 }} />
              <div>
                <h4 style={{ fontWeight: 800, margin: 0, fontSize: '0.95rem' }}>{t('Bạn có chắc chắn muốn TẠM NGƯNG nhận data mới?')}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '8px', lineHeight: 1.5 }}>
                  {t('Hệ thống sẽ tạm ngưng phân bổ khách hàng mới cho bạn. Khách hàng cũ của bạn đăng ký lại VẪN sẽ tự động chuyển và gửi tin nhắn Nhắc trùng cho bạn chăm sóc bình thường. Thông báo tạm ngưng này sẽ được gửi trực tiếp đến Zalo của Ban quản trị (Admin).')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                onClick={() => setVacationConfirmOpen(false)}
                className="btn sm secondary"
              >
                {t('Hủy bỏ')}
              </button>
              <button
                onClick={() => {
                  handleTogglePortalVacation();
                  setVacationConfirmOpen(false);
                }}
                className="btn sm danger"
              >
                {t('Xác nhận tạm ngưng')}
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {/* Modal 1: Quick Report / Submit Ticket */}
      {reportModalOpen && selectedLead && (
        <CustomModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          title={t("BÁO CÁO LỖI DỮ LIỆU")}
        >
          {(() => {
            const isOtherReason = reportReasonType.toLowerCase().includes('khác') || reportReasonType.toLowerCase().includes('other');
            const rList = getReasonsList();
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: 'var(--color-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <strong>{t('Tên Khách hàng:')}</strong> {selectedLead.lead_name}
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <strong>{t('Số điện thoại:')}</strong> <span style={{ color: '#d97706', fontWeight: 700 }}>{selectedLead.phone}</span>
                  </div>
                  <div>
                    <strong>{t('Vòng chia:')}</strong> {selectedLead.round_name || t('Mặc định')}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-light)', marginBottom: '6px' }}>
                    {t('Lý do báo lỗi (Chọn mẫu có sẵn)')}
                  </label>
                  <select
                    value={reportReasonType}
                    onChange={(e) => setReportReasonType(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '10px',
                      border: '1px solid var(--color-border)', fontSize: '0.875rem', background: 'var(--color-surface)',
                      color: 'var(--color-text)', outline: 'none', cursor: 'pointer'
                    }}
                  >
                    {rList.map((r: any) => (
                      <option key={r.reason} value={r.reason}>{t(r.reason)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-light)', marginBottom: '6px' }}>
                    {isOtherReason ? t('Mô tả chi tiết lỗi (Bắt buộc)') : t('Mô tả chi tiết lỗi (Không bắt buộc)')}
                  </label>
                  <textarea
                    placeholder={isOtherReason ? t('Nhập chi tiết lý do lỗi (bắt buộc)...') : t('Nhập thêm chi tiết lỗi hoặc dẫn chứng trùng lặp (tùy chọn)...')}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    style={{
                      width: '100%', height: 100, padding: '10px 12px', borderRadius: '10px',
                      border: '1px solid var(--color-border)', fontSize: '0.875rem', outline: 'none',
                      resize: 'none', fontFamily: 'inherit', color: 'var(--color-text)', background: 'var(--color-surface)'
                    }}
                  />
                </div>

                <details style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}>
                  <summary style={{ fontWeight: 700, color: 'var(--color-text-light)', outline: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>💡 {t("Xem hướng dẫn quy định báo cáo lỗi")}</span>
                  </summary>
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'default' }}>
                    {rList.map((item: any, idx: number) => {
                      const borderColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#BD1D2D'];
                      const borderColor = borderColors[idx % borderColors.length];
                      const cleanNote = (item.note || '').replace(/{n}/g, String(data.duplicate_check_months || 6));
                      if (!cleanNote) return null;
                      return (
                        <div key={idx} style={{ fontSize: '0.78rem', lineHeight: 1.4, borderLeft: `3px solid ${borderColor}`, paddingLeft: 8 }}>
                          <strong style={{ color: borderColor }}>{t(item.reason).toUpperCase()}:</strong> {t(cleanNote)}
                        </div>
                      );
                    })}
                  </div>
                </details>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    onClick={() => setReportModalOpen(false)}
                    style={{
                      background: 'var(--color-border-light)', color: 'var(--color-text-light)', border: 'none', borderRadius: '8px',
                      padding: '10px 20px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer'
                    }}
                  >
                    {t('Hủy bỏ')}
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    disabled={submittingReport}
                    style={{
                      background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px',
                      padding: '10px 20px', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Send size={16} /> {submittingReport ? t('Đang gửi...') : t('Gửi báo cáo lỗi')}
                  </button>
                </div>
              </div>
            );
          })()}
        </CustomModal>
      )}

      {/* Modal 2: View Details */}
      {detailModalOpen && activeDetailLead && (
        <CustomModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={t("CHI TIẾT THÔNG TIN KHÁCH HÀNG")}
          width="900px"
        >
          <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem', fontSize: '0.9rem', minHeight: '380px' }}>
            {/* Cột trái: Thông tin khách hàng & Ghi chú */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Họ và tên:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{activeDetailLead.lead_name || t('Chưa cập nhật')}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Số điện thoại:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--score-warm)' }}>{activeDetailLead.phone}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Email:')}</span>
                <span style={{ color: 'var(--color-text)' }}>{activeDetailLead.lead_email || '—'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Vòng chia:')}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{activeDetailLead.round_name || t('Mặc định')}</span>
                  {activeDetailLead.status === 'compensation' && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'var(--color-success-light)',
                      color: 'var(--color-success)',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      marginTop: '2px'
                    }}>
                      {t('Data bù')}
                    </span>
                  )}
                </div>
              </div>

              {displayUser?.role !== 'sale' && (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Tư vấn viên:')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar src={activeDetailLead.sale_avatar} name={activeDetailLead.sale_name || t('Chưa nhận')} size="sm" />
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{activeDetailLead.sale_name || t('Chưa nhận')}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Nguồn khách:')}</span>
                <span style={{ color: 'var(--color-text)' }}>{activeDetailLead.source || 'N/A'}</span>
              </div>

              {activeDetailLead.type && (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Phân loại:')}</span>
                  <span style={{ color: 'var(--color-text)' }}>{activeDetailLead.type}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('Nhận lúc:')}</span>
                <span style={{ color: 'var(--color-text-light)' }}>
                  {activeDetailLead.received_at ? new Date(activeDetailLead.received_at).toLocaleString('vi-VN') : 'N/A'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--color-bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)', marginTop: '4px' }}>
                <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{t('Ghi chú đính kèm:')}</span>
                <span style={{ color: 'var(--color-text)', whiteSpace: 'pre-line', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {activeDetailLead.note
                    ? activeDetailLead.note
                      .replace(/\\n/g, '\n')
                      .split('\n')
                      .filter((line: string) => !/^(?:Nhập dữ liệu cũ|Nhap du lieu cu)\s*(?:\(Silent\))?$/i.test(line.trim()))
                      .join('\n')
                      .trim() || t('Không có ghi chú.')
                    : t('Không có ghi chú.')}
                </span>
              </div>
            </div>

            {/* Cột phải: Đánh giá AI & Lịch sử bàn giao & Nhắc lại */}
            <div className="portal-detail-right" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '1px solid var(--color-border)', paddingLeft: '1.5rem' }}>
              {/* Đánh giá AI */}
              {activeDetailLead.ai_screener_status && activeDetailLead.ai_screener_status !== 'not_screened' && (
                <div style={{
                  background: activeDetailLead.ai_screener_status === 'passed'
                    ? 'var(--color-success-light)'
                    : (activeDetailLead.ai_screener_status === 'failed' ? 'var(--color-danger-light)' : 'var(--color-warning-light)'),
                  border: '1px solid',
                  borderColor: activeDetailLead.ai_screener_status === 'passed'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : (activeDetailLead.ai_screener_status === 'failed' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'),
                  padding: '12px',
                  borderRadius: '12px',
                  marginBottom: '8px',
                  fontSize: '0.825rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #a31422 0%, #a31422 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 800, fontSize: '0.65rem'
                    }}>
                      AI
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{t('Đánh giá AI:')}</span>
                    <span style={{
                      marginLeft: 'auto',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: activeDetailLead.ai_screener_status === 'passed'
                        ? 'var(--color-success)'
                        : (activeDetailLead.ai_screener_status === 'failed' ? 'var(--color-danger)' : 'var(--color-warning)'),
                      color: 'white'
                    }}>
                      {activeDetailLead.ai_screener_status === 'passed'
                        ? t('ĐẠT CHUẨN')
                        : (activeDetailLead.ai_screener_status === 'failed' ? t('KHÔNG ĐẠT') : t('ĐANG XỬ LÝ'))}
                    </span>
                  </div>
                  <div style={{ color: 'var(--color-text-light)', lineHeight: 1.4 }}>
                    {activeDetailLead.ai_evaluation || t('Không có đánh giá chi tiết.')}
                  </div>
                </div>
              )}

              <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '8px' }}>{t('Lịch sử bàn giao & Nhắc lại:')}</span>

              {loadingTimeline ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                  <StatRowSkeleton />
                </div>
              ) : timeline && timeline.length > 0 ? (
                <div className="timeline" style={{ marginTop: '4px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                  {timeline.map((item: any, idx: number) => {
                    if (item.is_ticket === 1) {
                      let dotColor = '#ef4444'; // default rejected/red
                      if (item.ticket_status === 'approved') dotColor = '#10b981';
                      if (item.ticket_status === 'approved_no_comp') dotColor = '#2563eb';
                      if (item.ticket_status === 'pending') dotColor = '#f59e0b';

                      let statusLabel = t('Báo cáo lỗi (Đã bị từ chối)');
                      if (item.ticket_status === 'approved') statusLabel = t('Báo cáo lỗi (Đã duyệt bù)');
                      if (item.ticket_status === 'approved_no_comp') statusLabel = t('Báo cáo lỗi (Duyệt không bù)');
                      if (item.ticket_status === 'pending') statusLabel = t('Báo cáo lỗi (Chờ duyệt)');

                      return (
                        <div key={idx} className="timeline-item" style={{ marginBottom: '1.25rem' }}>
                          <div className="timeline-icon" style={{ backgroundColor: dotColor, left: '-1.85rem', width: '1rem', height: '1rem', border: '3px solid var(--color-surface)', boxShadow: '0 0 0 1px var(--color-border)' }} />
                          <div className="timeline-content" style={{
                            background: item.ticket_status === 'approved' ? 'var(--color-success-light)' : item.ticket_status === 'approved_no_comp' ? '#dbeafe' : item.ticket_status === 'pending' ? 'var(--color-warning-light)' : 'var(--color-danger-light)',
                            color: item.ticket_status === 'approved' ? 'var(--color-success)' : item.ticket_status === 'approved_no_comp' ? '#2563eb' : item.ticket_status === 'pending' ? 'var(--color-warning)' : 'var(--color-danger)',
                            padding: '10px 14px', borderRadius: '12px', border: '1px solid currentColor'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertCircle size={14} />
                                {statusLabel}
                              </span>
                              {item.received_at && (
                                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                  {new Date(item.received_at).toLocaleString('vi-VN')}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                              <strong>{t('Lý do gửi:')}</strong> {item.ticket_reason || '—'}
                            </div>
                            {item.ticket_status === 'rejected' && (
                              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                                <strong>{t('Lý do từ chối:')}</strong> {item.ticket_reject_reason || t('Không cung cấp lý do.')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    let dotColor = '#94a3b8';
                    if (item.status === 'Đã bàn giao') dotColor = '#3b82f6';
                    if (item.status === 'Nhắc trùng') dotColor = '#f59e0b';
                    if (item.status === 'Bù lượt') dotColor = '#10b981';

                    return (
                      <div key={idx} className="timeline-item" style={{ marginBottom: '1.25rem' }}>
                        <div className="timeline-icon" style={{ backgroundColor: dotColor, left: '-1.85rem', width: '1rem', height: '1rem', border: '3px solid var(--color-surface)', boxShadow: '0 0 0 1px var(--color-border)' }} />
                        <div className="timeline-content" style={{ background: 'var(--color-bg)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.85rem' }}>
                              {t(item.status)} {item.round_name ? `(${item.round_name})` : ''}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {new Date(item.received_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <Avatar src={item.consultant_avatar} name={item.consultant_name} size={16} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                              <strong>{t('Nhận bởi:')}</strong> {item.consultant_name || t('Chưa rõ')}
                            </span>
                          </div>
                          {item.message && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                              &ldquo;{item.message}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', padding: '8px' }}>
                  {t('Không có lịch sử nhắc lại trước đó.')}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            {(() => {
              const myTaker = activeDetailLead.takers && activeDetailLead.takers.find((t: any) => Number(t.id) === Number(user?.id) || Number(t.id) === Number(user?.consultant_id));
              const isAssignee = Number(activeDetailLead.assigned_to) === Number(user?.consultant_id) || Number(activeDetailLead.assigned_to) === Number(user?.id);
              const isClaimer = !!myTaker || isAssignee;
              const canRelease = isClaimer && activeDetailLead.status !== 'databank' && activeDetailLead.status !== 'released_to_kho' && activeDetailLead.is_public !== 1 && Number(activeDetailLead.is_public) !== 1;

              return canRelease ? (
                <button
                  onClick={() => handleReleaseToDatabank(activeDetailLead.lead_id || activeDetailLead.id, myTaker?.contact_id)}
                  disabled={isReleasingLead}
                  title={t("Nhả về Kho chung (Databank)")}
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.05)',
                    borderRadius: '8px',
                    padding: '8px 20px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={14} className={isReleasingLead ? 'spin' : ''} />
                  {isReleasingLead ? t('Đang nhả...') : t('Nhả Kho')}
                </button>
              ) : null;
            })()}
            <button
              onClick={() => setDetailModalOpen(false)}
              style={{
                background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px',
                padding: '8px 24px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              {t('Đóng lại')}
            </button>
          </div>
        </CustomModal>
      )}

      {/* Modal 4: View Ticket Details */}
      {ticketModalOpen && selectedDetailTicket && (
        <CustomModal
          isOpen={ticketModalOpen}
          onClose={() => {
            setTicketModalOpen(false);
            setSelectedDetailTicket(null);
          }}
          title={t("CHI TIẾT VẤN ĐỀ / TICKET LỖI")}
          width="700px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.9rem' }}>

            {/* Lead & Ticket Metadata Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'var(--color-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-primary)', fontSize: '0.95rem' }}>
                  {t('Thông tin Khách hàng')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Họ và tên')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{selectedDetailTicket.lead_name || t('Ẩn danh')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Số điện thoại')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--score-warm)' }}>{selectedDetailTicket.lead_phone || '—'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-primary)', fontSize: '0.95rem' }}>
                  {t('Thông tin Báo cáo')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Tư vấn viên báo')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Avatar src={selectedDetailTicket.consultant_avatar} name={selectedDetailTicket.consultant_name} size={18} />
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{selectedDetailTicket.consultant_name}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{t('Vòng chia')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{selectedDetailTicket.round_name || t('Mặc định')}</span>
                </div>
              </div>
            </div>

            {/* Ticket Reason / Issue details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '12px', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
              <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{t('Lý do báo lỗi chi tiết:')}</span>
              <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {selectedDetailTicket.reason || t('Chưa có thông tin lý do lỗi.')}
              </span>
            </div>

            {/* Admin Resolution & Feedback details */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '12px', borderRadius: '12px', border: '1px solid',
              background: selectedDetailTicket.status === 'approved' ? 'var(--color-success-light)' : selectedDetailTicket.status === 'approved_no_comp' ? '#dbeafe' : selectedDetailTicket.status === 'pending' ? '#fef3c7' : 'var(--color-danger-light)',
              borderColor: selectedDetailTicket.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : selectedDetailTicket.status === 'approved_no_comp' ? 'rgba(37, 99, 235, 0.2)' : selectedDetailTicket.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: selectedDetailTicket.status === 'approved' ? 'var(--color-success)' : selectedDetailTicket.status === 'approved_no_comp' ? '#2563eb' : selectedDetailTicket.status === 'pending' ? '#d97706' : 'var(--color-danger)'
            }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                {selectedDetailTicket.status === 'pending' && <Clock size={16} />}
                {selectedDetailTicket.status === 'approved' && <CheckCircle2 size={16} />}
                {selectedDetailTicket.status === 'approved_no_comp' && <Info size={16} />}
                {selectedDetailTicket.status === 'rejected' && <XCircle size={16} />}
                <span>
                  {t('Trạng thái Ticket: ')}{selectedDetailTicket.status === 'approved' ? t('Đã duyệt đền bù') : selectedDetailTicket.status === 'approved_no_comp' ? t('Duyệt không bù') : selectedDetailTicket.status === 'pending' ? t('Đang chờ phê duyệt') : t('Đã bị từ chối')}
                </span>
              </div>

              {selectedDetailTicket.status !== 'pending' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid currentColor', paddingTop: '8px', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar src={selectedDetailTicket.resolved_by_avatar} name={selectedDetailTicket.resolved_by || t('Hệ thống')} size={24} />
                    <span style={{ fontSize: '0.825rem', fontWeight: 700 }}>
                      {t('Người duyệt:')} <span style={{ color: 'var(--color-text)' }}>{selectedDetailTicket.resolved_by || t('Hệ thống')}</span>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--color-text-light)' }}>
                    <strong>{t('Ý kiến phản hồi:')}</strong>{' '}
                    {selectedDetailTicket.status === 'approved'
                      ? (selectedDetailTicket.approval_reason || t('Hợp lệ & Đã được đền bù lượt chia mới.'))
                      : selectedDetailTicket.status === 'approved_no_comp'
                      ? (selectedDetailTicket.approval_reason || t('Hợp lệ nhưng không đền bù.'))
                      : (selectedDetailTicket.reject_reason || t('Không đủ điều kiện đền bù data lỗi.'))
                    }
                  </div>
                </div>
              )}

              {selectedDetailTicket.created_at && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', textAlign: 'right' }}>
                  {t('Ngày gửi báo cáo: ')}{new Date(selectedDetailTicket.created_at).toLocaleString('vi-VN')}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
              <button
                onClick={() => {
                  setTicketModalOpen(false);
                  setSelectedDetailTicket(null);
                }}
                style={{
                  background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px',
                  padding: '8px 24px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                {t('Đóng lại')}
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {/* Modal 3: View Calendar Day Details */}
      {selectedCalendarDate && (
        <CustomModal
          isOpen={!!selectedCalendarDate}
          onClose={() => {
            setSelectedCalendarDate(null);
            setDayDetails(null);
            setActiveCalendarModalTab('sales');
          }}
          title={`${t('Chi tiết hoạt động ngày')} ${selectedCalendarDate ? new Date(selectedCalendarDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}`}
          width="900px"
        >
          {dayDetailsLoading ? (
            <div style={{ padding: '1rem' }}>
              <TableSkeleton rows={5} cols={4} />
            </div>
          ) : dayDetails ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '580px', margin: '-1.5rem', overflow: 'hidden' }}>
              {/* Modal Tabs */}
              <div style={{
                display: 'flex',
                background: 'var(--color-border-light)',
                borderRadius: '12px',
                padding: '4px',
                gap: '4px',
                flexShrink: 0,
                margin: '1.5rem 1.5rem 1rem 1.5rem',
                height: '40px',
                alignItems: 'center'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveCalendarModalTab('sales')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '8px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeCalendarModalTab === 'sales' ? 'var(--color-surface)' : 'transparent',
                    color: activeCalendarModalTab === 'sales' ? 'var(--color-primary)' : 'var(--color-text-light)',
                    boxShadow: activeCalendarModalTab === 'sales' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '32px',
                    flex: 1
                  }}
                  className={activeCalendarModalTab === 'sales' ? '' : 'hover-lift'}
                >
                  <span>{t('Dữ liệu nhận (Phân bổ)')}</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: activeCalendarModalTab === 'sales' ? 'rgba(189, 29, 45, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: activeCalendarModalTab === 'sales' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    padding: '1px 6px',
                    borderRadius: '5px',
                    transition: 'all 0.2s'
                  }}>
                    {dayDetails.sales?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCalendarModalTab('tickets')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '8px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeCalendarModalTab === 'tickets' ? 'var(--color-surface)' : 'transparent',
                    color: activeCalendarModalTab === 'tickets' ? 'var(--color-primary)' : 'var(--color-text-light)',
                    boxShadow: activeCalendarModalTab === 'tickets' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '32px',
                    flex: 1
                  }}
                  className={activeCalendarModalTab === 'tickets' ? '' : 'hover-lift'}
                >
                  <span>{t('Ticket lỗi')}</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: activeCalendarModalTab === 'tickets' ? 'rgba(189, 29, 45, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: activeCalendarModalTab === 'tickets' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    padding: '1px 6px',
                    borderRadius: '5px',
                    transition: 'all 0.2s'
                  }}>
                    {dayDetails.tickets?.length || 0}
                  </span>
                </button>
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem 1.5rem' }}>
                {activeCalendarModalTab === 'sales' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {dayDetails.sales && dayDetails.sales.length > 0 ? (
                      dayDetails.sales.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setActiveDetailLead(item);
                            setDetailModalOpen(true);
                          }}
                          style={{
                            padding: '12px 16px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          className="hover-lift"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Avatar name={item.lead_name} size={36} />
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {item.lead_name || t('Ẩn danh')}
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}>
                                  ID: {item.lead_id}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600 }}>{item.phone || t('SĐT đã ẩn')}</span>
                                <span>•</span>
                                <span>Nguồn: <strong>{item.source || t('Chưa rõ')}</strong></span>
                                <span>•</span>
                                <span>Vòng: <strong style={{ color: 'var(--color-primary)' }}>{item.round_name || t('Ngoài vòng')}</strong></span>
                                {item.type && (
                                  <>
                                    <span>•</span>
                                    <span style={{ padding: '0 4px', background: 'rgba(37, 99, 235, 0.06)', color: '#2563eb', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>{item.type}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                              {item.received_at ? new Date(item.received_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                            {getStatusBadge(item.status, item.report_status)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                        {t('Không có dữ liệu phân bổ nào trong ngày.')}
                      </div>
                    )}
                  </div>
                )}

                {activeCalendarModalTab === 'tickets' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {dayDetails.tickets && dayDetails.tickets.length > 0 ? (
                      dayDetails.tickets.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            padding: '12px 14px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Avatar name={item.lead_name} size={28} />
                              <div>
                                <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.85rem' }}>
                                  {item.lead_name || t('Ẩn danh')}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 8 }}>
                                  {item.lead_phone}
                                </span>
                              </div>
                            </div>
                            <span style={{
                              padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700,
                              background: item.status === 'approved' ? 'var(--color-success-light)' : item.status === 'approved_no_comp' ? '#dbeafe' : item.status === 'pending' ? '#fef3c7' : 'var(--color-danger-light)',
                              color: item.status === 'approved' ? 'var(--color-success)' : item.status === 'approved_no_comp' ? '#2563eb' : item.status === 'pending' ? '#d97706' : 'var(--color-danger)'
                            }}>
                              {item.status === 'approved' ? t('Đã bù') : item.status === 'approved_no_comp' ? t('Không bù') : item.status === 'pending' ? t('Chờ duyệt') : t('Từ chối')}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', borderLeft: '2px solid var(--color-border)', paddingLeft: 8, fontStyle: 'italic' }}>
                            <strong>{t('Lý do báo lỗi:')}</strong> {item.reason}
                          </div>
                          {item.resolved_by && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Avatar src={item.resolved_by_avatar} name={item.resolved_by} size={16} />
                              <span>
                                <strong>Admin {item.resolved_by}:</strong> {item.reject_reason || item.approval_reason || (item.status === 'approved_no_comp' ? t('Đã duyệt không bù') : t('Đã duyệt đền bù'))}
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                        {t('Không có ticket lỗi nào được báo cáo trong ngày.')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </CustomModal>
      )}

      {showWarRoom && (
        <WarRoomFlightDeck
          isOpen={showWarRoom}
          onClose={() => setShowWarRoom(false)}
          stats={null}
          recentLogs={[]}
        />
      )}


      <CustomerProfileDrawer
        isOpen={!!profileContact}
        onClose={() => {
          setProfileContact(null);
          loadPortalData();
          fetchWorkspaceTasks();
        }}
        contact={profileContact}
        initialTab={profileDrawerTab}
        onUpdate={updated => {
          if (updated === null) {
            setProfileContact(null);
            setData((prev: any) => {
              if (!prev) return prev;
              const next = { ...prev };
              if (next.contacts) {
                next.contacts = next.contacts.filter((c: any) => c.id !== profileContact?.id);
              }
              return next;
            });
            loadPortalData();
            fetchWorkspaceTasks();
            return;
          }
          setProfileContact(updated);
          loadPortalData();
          fetchWorkspaceTasks();
        }}
      />

      <CustomModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title={taskTypeTab === 'personal' ? t('Tạo công việc cá nhân') : taskTypeTab === 'team' ? t('Tạo công việc nội bộ team') : t('Tạo công việc khách hàng')}
        width="960px"
      >
        <div style={{ padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Loại công việc Switcher (iOS Segmented Control style) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="form-label" style={{ fontWeight: 750, marginBottom: 2 }}>{t('Phân loại công việc')}</label>
            <div style={{
              display: 'flex',
              background: 'var(--color-bg-light)',
              border: '1px solid var(--color-border-light)',
              padding: '4px',
              borderRadius: '12px',
              gap: '4px',
              width: 'fit-content'
            }}>
              {[
                { key: 'customer', label: t('Khách hàng') },
                { key: 'team', label: t('Nội bộ Team') },
                { key: 'personal', label: t('Cá nhân') }
              ].map(tab => {
                const isActive = taskTypeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTaskTypeTab(tab.key as any)}
                    style={{
                      padding: '6px 18px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      background: isActive ? 'var(--color-surface)' : 'transparent',
                      color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    className={isActive ? '' : 'hover-lift'}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personal Task Warning Banner */}
          {taskTypeTab === 'personal' && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px', color: '#d97706', fontSize: '0.75rem' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{t('Chú ý: Nhiệm vụ cá nhân này chỉ hiển thị với bạn và quản lý trực tiếp của bạn (Manager), các đồng nghiệp khác không thể xem.')}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>{t('Tên công việc *')}</label>
                <input
                  className="form-input"
                  placeholder={t('VD: Gọi điện tư vấn, Gửi bảng giá...')}
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>{t('Mô tả chi tiết công việc')}</label>
                <textarea
                  className="form-input"
                  placeholder={t('Mô tả chi tiết nội dung cần làm...')}
                  value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                  style={{ minHeight: 120, resize: 'vertical' }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>{t('Tài liệu hoặc Link đính kèm (Tùy chọn)')}</label>
                <input
                  className="form-input"
                  placeholder={t('Link tài liệu hoặc ghi chú nhanh...')}
                  value={taskForm.link || ''}
                  onChange={e => setTaskForm({ ...taskForm, link: e.target.value })}
                />
              </div>

              {/* Công việc con (Checklist) */}
              <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label className="form-label" style={{ fontWeight: 800, marginBottom: '2px' }}>📋 {t('Công việc con (Checklist)')}</label>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '0.5rem', alignItems: 'start' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('Tên việc con')}</label>
                    <input
                      className="form-input"
                      placeholder={t('VD: Gửi file pdf, Gọi lại...')}
                      value={subTaskTitle}
                      onChange={e => setSubTaskTitle(e.target.value)}
                      style={{ height: '38px', fontSize: '0.8125rem' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('Giao cho')}</label>
                    <CustomSelect
                      showAvatars={true}
                      searchable={true}
                      options={[
                        { value: '', label: t('Người nhận...') },
                        ...users.map(u => ({
                          value: String(u.id),
                          label: u.full_name,
                          avatar: u.avatar_url || undefined
                        }))
                      ]}
                      value={subTaskAssignee}
                      onChange={val => setSubTaskAssignee(val.toString())}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, visibility: 'hidden' }}>{'\u00A0'}</label>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => {
                        if (!subTaskTitle.trim()) {
                          toast.error(t('Vui lòng nhập tên công việc con'));
                          return;
                        }
                        const newItem = {
                          id: 'sub_' + Date.now(),
                          title: subTaskTitle.trim(),
                          assignee_id: subTaskAssignee ? Number(subTaskAssignee) : null,
                          done: false
                        };
                        setTaskForm(prev => ({
                          ...prev,
                          checklist: [...(prev.checklist || []), newItem]
                        }));
                        setSubTaskTitle('');
                        setSubTaskAssignee('');
                        toast.success(t('Đã thêm việc con'));
                      }}
                      style={{ height: '38px', width: '38px', minWidth: '38px', padding: 0, border: 'none', margin: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxSizing: 'border-box' }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Subtasks List */}
                {taskForm.checklist && taskForm.checklist.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 12px', background: 'var(--color-bg-light)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                    {taskForm.checklist.map((item) => {
                      const assigneeUser = users.find(u => Number(u.id) === Number(item.assignee_id));
                      return (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'var(--color-text)' }}>• {item.title}</span>
                            {assigneeUser && (
                              <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.72rem' }}>({assigneeUser.full_name})</span>
                            )}
                          </div>
                          <button 
                            type="button" 
                            className="btn-icon sm" 
                            onClick={() => setTaskForm(prev => ({
                              ...prev,
                              checklist: prev.checklist.filter(x => x.id !== item.id)
                            }))}
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Render related contact only for Customer Tab */}
              {taskTypeTab === 'customer' && (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>{t('Khách hàng chính *')}</label>
                    <CustomSelect
                      showAvatars={true}
                      searchable={true}
                      options={[
                        { value: '', label: t('Chọn khách hàng chính...') },
                        ...(data.leads || []).map((l: any) => ({
                          value: String(l.contact_id || ''),
                          label: `${l.lead_name || t('Không tên')} (${l.phone || ''})`,
                          avatar: l.avatar_url || undefined
                        }))
                      ]}
                      value={taskForm.related_id}
                      onChange={val => setTaskForm({ ...taskForm, related_id: val.toString() })}
                      width="100%"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>{t('Khách hàng liên kết thêm (Tùy chọn)')}</label>
                    <CustomSelect
                      multiple={true}
                      showAvatars={true}
                      align="right"
                      options={[
                        { value: 'all', label: t('Không có khách hàng khác') },
                        ...(data.leads || [])
                          .filter((l: any) => l.contact_id && String(l.contact_id) !== String(taskForm.related_id))
                          .map((l: any) => ({
                            value: String(l.contact_id),
                            label: `${l.lead_name || t('Không tên')} (${l.phone || ''})`,
                            avatar: l.avatar_url || undefined
                          }))
                      ]}
                      value={taskForm.related_contact_ids || ['all']}
                      onChange={val => setTaskForm({ ...taskForm, related_contact_ids: val })}
                      width="100%"
                    />
                  </div>
                </>
              )}

              {/* Render Team options only for Team Tab */}
              {taskTypeTab === 'team' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>{t('Loại công việc nội bộ')}</label>
                    <CustomSelect
                      options={[
                        { value: 'task', label: t('Nhiệm vụ') },
                        { value: 'announcement', label: t('Thông báo') },
                        { value: 'campaign', label: t('Chiến dịch thi đua') },
                        { value: 'policy', label: t('Chính sách ưu đãi') }
                      ]}
                      value={taskForm.internal_type}
                      onChange={val => setTaskForm({ ...taskForm, internal_type: val.toString() })}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>{t('Phạm vi áp dụng')}</label>
                    <CustomSelect
                      options={[
                        { value: 'team', label: t('Nội bộ Team') },
                        { value: 'global', label: t('Toàn hệ thống') }
                      ]}
                      value={taskForm.scope}
                      onChange={val => setTaskForm({ ...taskForm, scope: val.toString() })}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 750 }}>{t('Người thực hiện')}</label>
                  <CustomSelect
                    showAvatars={true}
                    searchable={true}
                    options={[
                      { value: '', label: t('Chưa giao cho ai') },
                      ...users.map(u => ({
                        value: String(u.id),
                        label: u.full_name,
                        avatar: u.avatar_url || undefined
                      }))
                    ]}
                    value={taskForm.user_id}
                    onChange={val => setTaskForm({ ...taskForm, user_id: val.toString() })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 750 }}>{t('Người liên quan (Tùy chọn)')}</label>
                  <CustomSelect
                    multiple={true}
                    showAvatars={true}
                    align="right"
                    searchable={true}
                    options={[
                      { value: 'all', label: t('Không có người liên quan') },
                      ...users.filter(u => String(u.id) !== String(taskForm.user_id)).map(u => ({
                        value: String(u.id),
                        label: u.full_name,
                        avatar: u.avatar_url || undefined
                      }))
                    ]}
                    value={taskForm.participant_ids || ['all']}
                    onChange={val => setTaskForm({ ...taskForm, participant_ids: val })}
                  />
                </div>
              </div>

              {/* Progress Slider */}
              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0 }}>{t('Tiến độ công việc')}</label>
                  <span style={{ fontSize: '0.825rem', fontWeight: 750, color: 'var(--color-primary)' }}>{taskForm.progress || 0}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={taskForm.progress || 0}
                  onChange={e => setTaskForm({ ...taskForm, progress: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    cursor: 'pointer',
                    accentColor: 'var(--color-primary)',
                    height: '6px',
                    borderRadius: '3px',
                    background: '#e5e7eb'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Approval Row (Toggle & Approver) */}
              <div style={{ display: 'grid', gridTemplateColumns: taskForm.require_approval === 1 ? '1.2fr 1.8fr' : '1fr', gap: '1rem', alignItems: 'end' }}>
                {/* Approval Toggle */}
                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg)', padding: '6px 10px', borderRadius: '10px', border: '1px solid var(--color-border-light)', height: '38px' }}>
                    <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)' }}>{t('Cần duyệt')}</span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                      <div 
                        style={{
                          width: 34,
                          height: 18,
                          borderRadius: 9,
                          background: taskForm.require_approval === 1 ? 'var(--color-success)' : '#e5e7eb',
                          position: 'relative',
                          transition: 'background 0.2s'
                        }}
                        onClick={() => {
                          const next = taskForm.require_approval === 1 ? 0 : 1;
                          setTaskForm({ ...taskForm, require_approval: next });
                        }}
                      >
                        <div 
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: 'white',
                            position: 'absolute',
                            top: 2,
                            left: taskForm.require_approval === 1 ? 18 : 2,
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                          }}
                        />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Approver Select */}
                {taskForm.require_approval === 1 && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <CustomSelect
                      showAvatars={true}
                      searchable={true}
                      direction="up"
                      align="right"
                      options={[
                        { value: '', label: t('Chọn người duyệt...') },
                        ...users.map(u => ({
                          value: String(u.id),
                          label: `${u.full_name} (${u.role})`,
                          avatar: u.avatar_url || undefined
                        }))
                      ]}
                      value={taskForm.approver_id}
                      onChange={val => setTaskForm({ ...taskForm, approver_id: val.toString() })}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>{t('Mức độ ưu tiên')}</label>
                  <CustomSelect
                    direction="up"
                    options={[
                      { value: 'low', label: t('Thấp') },
                      { value: 'medium', label: t('Trung bình') },
                      { value: 'high', label: t('Cao') }
                    ]}
                    value={taskForm.priority}
                    onChange={val => setTaskForm({ ...taskForm, priority: val.toString() })}
                    width="100%"
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>{t('Hạn hoàn thành')}</label>
                  <input
                    className="form-input"
                    type="date"
                    value={taskForm.due_date}
                    onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Recurrence Settings Block */}
              <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <label className="form-label" style={{ fontWeight: 800, marginBottom: '6px' }}>🔄 {t('Lặp lại định kỳ')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1rem', alignItems: 'center' }}>
                  <CustomSelect
                    direction="up"
                    options={[
                      { value: 'none', label: t('Không lặp lại') },
                      { value: 'daily', label: t('Hàng ngày') },
                      { value: 'weekly', label: t('Hàng tuần') },
                      { value: 'monthly', label: t('Hàng tháng') }
                    ]}
                    value={taskForm.recurrence_pattern}
                    onChange={val => setTaskForm({ ...taskForm, recurrence_pattern: val.toString() })}
                  />

                  {taskForm.recurrence_pattern === 'weekly' && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {[
                        { key: 1, label: 'T2' }, { key: 2, label: 'T3' }, { key: 3, label: 'T4' },
                        { key: 4, label: 'T5' }, { key: 5, label: 'T6' }, { key: 6, label: 'T7' },
                        { key: 0, label: 'CN' }
                      ].map(day => {
                        const isSelected = taskForm.recurrence_weekly_days.includes(day.key);
                        return (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => {
                              let newDays = [...taskForm.recurrence_weekly_days];
                              if (newDays.includes(day.key)) {
                                newDays = newDays.filter(d => d !== day.key);
                              } else {
                                newDays.push(day.key);
                              }
                              setTaskForm({ ...taskForm, recurrence_weekly_days: newDays });
                            }}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
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

                  {taskForm.recurrence_pattern === 'monthly' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('Vào ngày:')}</span>
                      <input
                        type="number"
                        className="form-input"
                        min={1}
                        max={31}
                        value={taskForm.recurrence_monthly_day}
                        onChange={e => setTaskForm({ ...taskForm, recurrence_monthly_day: Math.min(31, Math.max(1, Number(e.target.value))) })}
                        style={{ width: '60px', height: '32px', textAlign: 'center', padding: 0 }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '1.5rem',
            borderTop: '1px solid var(--color-border-light)',
            position: 'sticky',
            bottom: '-24px',
            background: 'var(--color-surface)',
            zIndex: 10,
            margin: '1.5rem -24px -24px -24px',
            padding: '16px 24px 24px 24px'
          }}>
            <button className="btn outline" type="button" onClick={() => setShowTaskModal(false)}>{t('Hủy')}</button>
            <button className="btn primary" type="button" onClick={handleCreatePortalTask} disabled={submittingTask}>
              {submittingTask ? t('Đang lưu...') : t('Tạo công việc')}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Task Details Drawer */}
      <WorkspaceTaskDrawer
        isOpen={!!selectedTaskForDetails && wsViewMode !== 'focus'}
        onClose={() => setSelectedTaskForDetails(null)}
        task={selectedTaskForDetails}
        onUpdate={() => {
          fetchPortalTasks();
          fetchWorkspaceTasks();
        }}
        users={users}
        onOpenContact={(contactId) => {
          setSelectedTaskForDetails(null);
          handleOpenContactProfile(contactId);
        }}
      />

      {/* 2-Minute Lead Offer Countdown Modal */}
      {activeIncomingOffer && (
        <CustomModal
          isOpen={true}
          onClose={() => {}}
          title={t('🚨 CÓ LEAD MỚI ĐƯỢC PHÂN BỔ!')}
          width="400px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '1rem 0' }}>
            <div style={{ position: 'relative', width: '100px', height: '100px' }}>
              <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="var(--color-border-light)"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="var(--color-danger)"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 44}
                  strokeDashoffset={
                    (2 * Math.PI * 44) * 
                    (1 - Math.max(0, activeIncomingOffer.remainingMs) / (Number(activeIncomingOffer.lead.lead_recall_minutes) * 60 * 1000))
                  }
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--color-danger)',
              }}>
                {(() => {
                  const totalSecs = Math.max(0, Math.floor(activeIncomingOffer.remainingMs / 1000));
                  const mins = Math.floor(totalSecs / 60);
                  const secs = totalSecs % 60;
                  return `${mins}:${String(secs).padStart(2, '0')}`;
                })()}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                {activeIncomingOffer.lead.full_name || t('Khách hàng mới')}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                Nguồn: <strong style={{ color: 'var(--color-primary)' }}>{activeIncomingOffer.lead.source || 'Facebook CAPI'}</strong>
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <AlertTriangle size={12} /> {t('Vui lòng tiếp nhận ngay. Lead sẽ bị thu hồi khi hết giờ!')}
              </p>
            </div>

            <button
              onClick={() => handleAcceptLead(activeIncomingOffer.lead.lead_id)}
              className="btn danger pulsing"
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '22px',
                fontSize: '0.9rem',
                fontWeight: 800,
                boxShadow: '0 4px 15px rgba(189,29,45,0.3)',
              }}
            >
              {t('TIẾP NHẬN LEAD NGAY')}
            </button>
          </div>
        </CustomModal>
      )}

      {/* Task Participants List Modal */}
      {participantsModalOpen && (
        <CustomModal
          isOpen={participantsModalOpen}
          onClose={() => setParticipantsModalOpen(false)}
          title={t('Người liên quan (Participants)')}
          width="400px"
        >
          <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }} className="custom-scrollbar">
              {selectedTaskParticipants.map((pUser) => (
                <div key={pUser.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: '10px' }}>
                  <Avatar src={pUser.avatar_url || pUser.avatar} name={pUser.full_name} size={28} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>{pUser.full_name}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{pUser.email}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button className="btn primary" onClick={() => setParticipantsModalOpen(false)}>{t('Đóng')}</button>
            </div>
          </div>
        </CustomModal>
      )}

      {claimLeadConfirmOpen && (
        <CustomModal
          isOpen={claimLeadConfirmOpen}
          onClose={() => !isClaimingLeadId && setClaimLeadConfirmOpen(false)}
          title={t('Nhận Khách hàng từ Databank')}
          width="460px"
        >
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', textAlign: 'center' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '24px',
              background: 'var(--color-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
              boxShadow: '0 8px 20px rgba(189, 29, 45, 0.15)',
              marginBottom: '0.5rem'
            }}>
              <Database size={32} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.01em', margin: 0 }}>
                {t('Xác nhận nhận khách hàng')}
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-light)', lineHeight: 1.5, margin: 0 }}>
                {t('Bạn có chắc chắn muốn nhận khách hàng')} <strong style={{ color: 'var(--color-primary)', fontSize: '0.95rem' }}>{claimLeadPerson?.name}</strong> {t('từ Kho Databank về danh sách quản lý cá nhân của mình?')}
              </p>
            </div>

            <div style={{
              width: '100%',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '14px',
              padding: '1rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('Nguồn dữ liệu:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>Kho chung Databank</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('Người nhận:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{currentUser?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{t('Mức trừ hạn mức:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>1 lượt nhận</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
              <button
                className="btn outline"
                onClick={() => setClaimLeadConfirmOpen(false)}
                disabled={!!isClaimingLeadId}
                style={{ flex: 1, height: '42px', fontWeight: 700 }}
              >
                {t('Hủy bỏ')}
              </button>
              <button
                className="btn primary"
                onClick={handleExecuteClaimLead}
                disabled={!!isClaimingLeadId}
                style={{
                  flex: 1,
                  height: '42px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, #d32f2f 100%)',
                  boxShadow: '0 4px 12px rgba(189, 29, 45, 0.25)'
                }}
              >
                {isClaimingLeadId ? t('Đang xử lý...') : t('Nhận Khách')}
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {showCallsModal && (
        <CustomModal
          isOpen={showCallsModal}
          onClose={() => setShowCallsModal(false)}
          title={`${t('Danh sách cuộc gọi')} (${modalCalls.length})`}
          width="680px"
        >
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '550px', overflowY: 'auto' }}>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                style={{ paddingLeft: '2.25rem', height: '38px', borderRadius: '10px' }}
                value={callsSearch}
                onChange={e => setCallsSearch(e.target.value)}
                placeholder={t('Tìm theo tên khách hàng, nội dung cuộc gọi...')}
              />
              <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            </div>

            {loadingModalCalls ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <StatRowSkeleton />
                <StatRowSkeleton />
                <StatRowSkeleton />
              </div>
            ) : (
              (() => {
                const filteredCalls = modalCalls.filter(c => {
                  const s = callsSearch.toLowerCase();
                  return (
                    (c.subject || '').toLowerCase().includes(s) ||
                    (c.body || '').toLowerCase().includes(s) ||
                    (c.contact_name || '').toLowerCase().includes(s)
                  );
                });

                if (filteredCalls.length === 0) {
                  return (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      <Phone size={36} style={{ marginBottom: '8px', opacity: 0.5, marginLeft: 'auto', marginRight: 'auto' }} />
                      <p>{t('Không tìm thấy cuộc gọi nào phù hợp.')}</p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredCalls.map(call => (
                      <div 
                        key={call.id}
                        style={{
                          padding: '1rem',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '12px',
                          background: 'var(--color-surface)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: 'var(--color-success)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Phone size={14} />
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                              {call.subject || t('Cuộc gọi')}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            {call.due_date ? new Date(call.due_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                          </span>
                        </div>

                        {call.body && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', margin: '4px 0', background: 'var(--color-bg-light)', padding: '8px 10px', borderRadius: '8px', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                            {call.body}
                          </p>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginTop: '2px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            {t('Người thực hiện:')} <strong style={{ color: 'var(--color-text)' }}>{call.user_name || currentUser?.name || t('Tư vấn viên')}</strong>
                          </span>
                          {call.related_type === 'contact' && (
                            <button
                              onClick={() => {
                                setShowCallsModal(false);
                                handleOpenContactProfile(call.related_id);
                              }}
                              style={{
                                border: 'none',
                                background: 'none',
                                padding: 0,
                                color: 'var(--color-primary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Users size={12} />
                              {call.contact_name || t('Xem khách hàng')}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </CustomModal>
      )}
    </div>
  );
};

export const SalePortal = SalePortalInner;
