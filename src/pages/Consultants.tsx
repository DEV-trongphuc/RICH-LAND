import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { withRouterFreezer } from '../components/RouterFreezer';
import { Users, Plus, Trash2, Mail, MessageCircle, Shield, UserX, Clock, X, Link2Off, User, Send, Check, RefreshCw, BarChart2, Calendar, Scale, Eye, CheckCircle, AlertTriangle, AlertCircle, Building2, ChevronLeft, ChevronRight, Search, Phone, Info, TrendingUp, Paperclip, Link2, File as FileIcon, Folder, Download, MapPin, MoreHorizontal, Database, UserPlus, ExternalLink, Copy, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Avatar } from '../components/ui/Avatar';
import { fetchAPI } from '../utils/api';
import api from '../api/axios';
import { AccountDetailDrawer } from '../components/AccountDetailDrawer';
import { MentionInput } from '../components/ui/MentionInput';
import styles from './EntityDrawer.module.css';
import { compressToWebP } from '../utils/imageCompress';
import { useUploadProgress } from '../contexts/UploadProgressContext';
import { TableRowSkeleton, KpiCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { CustomSelect } from '../components/ui/CustomSelect';
import { AddressSelect } from '../components/ui/AddressSelect';
import cityData from '../assets/ctiy.json';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CopyButton } from '../components/ui/CopyButton';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LabelList
} from 'recharts';
import { QRCodeCanvas } from 'qrcode.react';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'inactive';
  telegram_id: string | null;
  zalo_chat_id: string | null;
  telegram_chat_id: string | null;
  created_at: string;
}

const DEFAULT_SCHEDULE = {
  "1": { active: true, start: "08:00", end: "17:30" },
  "2": { active: true, start: "08:00", end: "17:30" },
  "3": { active: true, start: "08:00", end: "17:30" },
  "4": { active: true, start: "08:00", end: "17:30" },
  "5": { active: true, start: "08:00", end: "17:30" },
  "6": { active: true, start: "08:00", end: "17:30" },
  "7": { active: true, start: "08:00", end: "17:30" }
};

const dayNames: { [key: string]: string } = {
  "1": "Thứ 2",
  "2": "Thứ 3",
  "3": "Thứ 4",
  "4": "Thứ 5",
  "5": "Thứ 6",
  "6": "Thứ 7",
  "7": "Chủ Nhật"
};

const formatScheduleTooltip = (schedule: any, t: any): string => {
  if (!schedule) return '';
  return Object.entries(dayNames).map(([dayKey, dayLabel]) => {
    const config = schedule[dayKey];
    if (!config) return `${t(dayLabel)}: ${t('Không hoạt động')}`;
    if (!config.active) return `${t(dayLabel)}: ${t('Nghỉ')}`;
    return `${t(dayLabel)}: ${config.start} - ${config.end}`;
  }).join('\n');
};

const getCleanCityName = (name: string) => {
  const match = name.match(/\[(.*?)\]/);
  return match ? match[1] : name.replace(/\s*\(.*?\)\s*/g, '').trim();
};

const getCityFromAddress = (address: string, defaultVal: string) => {
  if (!address) return defaultVal;
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 1) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.toLowerCase() === 'việt nam' && parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return lastPart;
  }
  return defaultVal;
};

const cityOptions = ((cityData as any).cities || []).map((c: any) => {
  const cleanName = getCleanCityName(c.name);
  return { value: cleanName, label: cleanName };
});

const ConsultantsInner = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role;
  const isSale = userRole === 'sale';
  const isWriteAuthorized = ['admin', 'superadmin', 'super_admin', 'director', 'manager'].includes(userRole || '');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allSystemUsers, setAllSystemUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMobileTabMenu, setShowMobileTabMenu] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [unlinkId, setUnlinkId] = useState<number | null>(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);

  // Quick message state
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [quickMessageTarget, setQuickMessageTarget] = useState<any>(null);
  const [quickMessageText, setQuickMessageText] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  // Consultant stats state
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsConsultant, setStatsConsultant] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [statsDateMode, setStatsDateMode] = useState<string>('this_month');
  const [statsStartDate, setStatsStartDate] = useState<string>('');
  const [statsEndDate, setStatsEndDate] = useState<string>('');

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const showAllTabs = ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'sale', 'sales'].includes(userRole || '');
  const activeTabRaw = queryParams.get('tab') || 'consultants';
  const activeTab = showAllTabs ? activeTabRaw : 'consultants';

  const uploadProgress = useUploadProgress();
  const startUpload = uploadProgress?.startUpload;
  const updateProgress = uploadProgress?.updateProgress;
  const finishUpload = uploadProgress?.finishUpload;

  const [teams, setTeams] = useState<any[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [isUploadingTeamAvatar, setIsUploadingTeamAvatar] = useState(false);
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    avatar_url: '',
    branch: '',
    leader_id: '',
    co_leader_ids: [] as string[],
    description: '',
    kpi_target: '',
    max_members: '',
    focus_projects: [] as string[],
    member_ids: [] as string[]
  });

  const handleUploadTeamAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploadingTeamAvatar(true);
    const taskId = startUpload ? startUpload(file.name) : null;
    try {
      if (taskId && updateProgress) updateProgress(taskId, 15, 'compressing');
      const compressedFile = await compressToWebP(file);
      if (taskId && updateProgress) updateProgress(taskId, 40, 'uploading');

      const fd = new FormData();
      fd.append('file', compressedFile);
      if (teamFormData.avatar_url) {
        fd.append('previous_url', teamFormData.avatar_url);
      }

      const res = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total && taskId && updateProgress) {
            const pct = Math.round(40 + (evt.loaded / evt.total) * 50);
            updateProgress(taskId, pct, 'uploading');
          }
        }
      });

      const fileUrl = res.data?.url || res.data?.file_url || res.data?.path || res.data?.data?.url;
      if (fileUrl) {
        if (taskId && finishUpload) finishUpload(taskId, true);
        setTeamFormData(prev => ({ ...prev, avatar_url: fileUrl }));
        toast.success(t('Đã tải lên avatar nhóm thành công!'));
      } else {
        throw new Error(res.data?.message || 'Upload failed');
      }
    } catch (err: any) {
      if (taskId && finishUpload) finishUpload(taskId, false, err.message || 'Upload error');
      toast.error(t('Lỗi tải ảnh avatar: ') + (err.message || err));
    } finally {
      setIsUploadingTeamAvatar(false);
    }
  };
  const [searchLeader, setSearchLeader] = useState('');
  const [searchCoLeader, setSearchCoLeader] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [showLeaderDropdown, setShowLeaderDropdown] = useState(false);
  const [showCoLeaderDropdown, setShowCoLeaderDropdown] = useState(false);
  const leaderDropdownRef = useRef<HTMLDivElement>(null);
  const coLeaderDropdownRef = useRef<HTMLDivElement>(null);
  const [showAddMemberDropdown, setShowAddMemberDropdown] = useState(false);
  const addMemberDropdownRef = useRef<HTMLDivElement>(null);
  const [confirmDeleteTeamOpen, setConfirmDeleteTeamOpen] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<number | null>(null);
  const [confirmLeaveTeamOpen, setConfirmLeaveTeamOpen] = useState(false);
  const [isLeavingTeam, setIsLeavingTeam] = useState(false);
  const [teamDrawerTab, setTeamDrawerTab] = useState<'info' | 'members' | 'comments'>('info');
  const [teamComments, setTeamComments] = useState<any[]>([]);
  const [loadingTeamComments, setLoadingTeamComments] = useState(false);
  const [newTeamCommentText, setNewTeamCommentText] = useState('');
  const [isSubmittingTeamComment, setIsSubmittingTeamComment] = useState(false);
  const [teamReplyTo, setTeamReplyTo] = useState<{ id: number; userName: string } | null>(null);
  const [teamCommentAttachments, setTeamCommentAttachments] = useState<any[]>([]);
  const [isUploadingCommentFile, setIsUploadingCommentFile] = useState(false);
  
  const [consultantsPage, setConsultantsPage] = useState(1);
  const [teamsPage, setTeamsPage] = useState(1);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const ITEMS_PER_PAGE = 8;

  const [zaloBotLink, setZaloBotLink] = useState<string>('');
  const [telegramBotUsername, setTelegramBotUsername] = useState<string>('');
  const [isZaloModalOpen, setIsZaloModalOpen] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  useEffect(() => {
    fetchAPI('notifications/settings')
      .then(res => {
        if (res && res.success && res.data?.user_info) {
          if (res.data.user_info.zalo_bot_link) setZaloBotLink(res.data.user_info.zalo_bot_link);
          if (res.data.user_info.telegram_bot_username) setTelegramBotUsername(res.data.user_info.telegram_bot_username);
        }
      })
      .catch(() => {});
  }, []);

  const handleConnectZalo = () => {
    const link = zaloBotLink.trim();
    if (!link) {
      toast.error('Hệ thống chưa setup nhận thông báo qua Zalobot');
      return;
    }
    setIsZaloModalOpen(true);
  };

  const handleConnectTelegram = (userId: number) => {
    const username = telegramBotUsername.trim();
    if (!username) {
      toast.error('Hệ thống chưa setup nhận thông báo qua Telegram Bot');
      return;
    }
    window.open(`https://t.me/${username}?start=connect_${userId}`, '_blank');
  };

  const [scheduleMode, setScheduleMode] = useState<'daily' | 'custom'>('daily');
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    status: string;
    leave_start: string;
    leave_end: string;
    zalo_chat_id: string;
    telegram_chat_id: string;
    work_start_time: string;
    work_end_time: string;
    work_schedule: any;
    avatar: string;
    team_id: string;
    dob: string;
    gender: string;
    citizen_id: string;
    address: string;
    bank_name: string;
    bank_account: string;
  }>({
    name: '',
    email: '',
    phone: '',
    status: 'active',
    leave_start: '',
    leave_end: '',
    zalo_chat_id: '',
    telegram_chat_id: '',
    work_start_time: '00:00',
    work_end_time: '23:59',
    work_schedule: null,
    avatar: '',
    team_id: '',
    dob: '',
    gender: '',
    citizen_id: '',
    address: '',
    bank_name: '',
    bank_account: ''
  });

  const handleDayChange = (dayKey: string, field: 'active' | 'start' | 'end', value: any) => {
    setFormData(prev => {
      const currentSchedule = prev.work_schedule || DEFAULT_SCHEDULE;
      const updatedDayConfig = {
        ...currentSchedule[dayKey],
        [field]: value
      };
      return {
        ...prev,
        work_schedule: {
          ...currentSchedule,
          [dayKey]: updatedDayConfig
        }
      };
    });
  };

  const fetchTeams = async () => {
    setTeamsLoading(true);
    try {
      const json = await fetchAPI('teams');
      if (json.success) setTeams(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      toast.error(t('Không thể tải danh sách nhóm: ') + e.message);
    }
    setTeamsLoading(false);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const json = await fetchAPI('get_consultants');
      if (json.success) setUsers(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      toast.error(t('Không thể tải dữ liệu: ') + e.message);
    }
    setLoading(false);
  };

  const fetchAllSystemUsers = async () => {
    try {
      const json = await fetchAPI('get_accounts');
      if (json && json.success && Array.isArray(json.data)) {
        setAllSystemUsers(json.data);
      }
    } catch (e: any) {
      console.error('Failed to fetch system users:', e);
    }
  };

  const fetchProjects = async () => {
    try {
      const json = await fetchAPI('projects');
      if (json && json.success && Array.isArray(json.data)) {
        setProjects(json.data);
      } else if (json && Array.isArray(json)) {
        setProjects(json);
      }
    } catch (e: any) {
      console.error('Failed to fetch projects:', e);
    }
  };

  const fetchTeamComments = async (teamId: number) => {
    setLoadingTeamComments(true);
    try {
      const res = await api.get(`/teams/${teamId}/comments`);
      const list = res.data?.data || res.data || [];
      setTeamComments(Array.isArray(list) ? list : []);
    } catch (e: any) {
      console.error('Failed to fetch team comments:', e);
      toast.error(t('Không thể tải bình luận nhóm'));
    } finally {
      setLoadingTeamComments(false);
    }
  };

  const addLocalTeamCommentAttachment = (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('Dung lượng tệp đính kèm không được vượt quá 10MB'));
      return;
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setTeamCommentAttachments(prev => [...prev, { file, name: file.name, previewUrl }]);
    toast.success(t('Đã thêm tệp đính kèm!'));
  };

  const handleAttachCommentFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addLocalTeamCommentAttachment(file);
    e.target.value = '';
  };

  const removeTeamCommentAttachment = (index: number) => {
    setTeamCommentAttachments(prev => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handlePostTeamComment = async (teamId: number) => {
    if (!newTeamCommentText.trim() && teamCommentAttachments.length === 0) return;
    setIsSubmittingTeamComment(true);
    setIsUploadingCommentFile(true);

    try {
      const processedAttachments: { name: string; url: string }[] = [];
      for (const att of teamCommentAttachments) {
        if (att.url) {
          processedAttachments.push({ name: att.name, url: att.url });
        } else if (att.file) {
          const fd = new FormData();
          fd.append('file', att.file);
          const res = await api.post('/upload', fd);
          const fileUrl = res.data?.data?.url || res.data?.url || res.data?.data?.file_path || res.data?.file_path;
          if (fileUrl) {
            processedAttachments.push({ name: att.name, url: fileUrl });
            if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
          } else {
            throw new Error(t('Không nhận được đường dẫn tệp tải lên'));
          }
        }
      }

      let finalBody = newTeamCommentText.trim();
      if (processedAttachments.length > 0) {
        const attachmentLines = processedAttachments.map(att => `📎 [${att.name}](${att.url})`).join('\n');
        finalBody = finalBody ? `${finalBody}\n${attachmentLines}` : attachmentLines;
      }

      await api.post(`/teams/${teamId}/comments`, {
        body: finalBody,
        parent_id: teamReplyTo ? teamReplyTo.id : null
      });

      setNewTeamCommentText('');
      setTeamReplyTo(null);
      setTeamCommentAttachments([]);
      toast.success(t('Đã gửi bình luận thành công'));
      fetchTeamComments(teamId);
    } catch (e: any) {
      console.error('Failed to post team comment:', e);
      toast.error(e.response?.data?.message || e.message || t('Lỗi khi gửi bình luận'));
    } finally {
      setIsSubmittingTeamComment(false);
      setIsUploadingCommentFile(false);
    }
  };

  const handleAttachCommentLink = () => {
    const url = prompt(t('Nhập địa chỉ liên kết (URL):'), 'https://');
    if (!url || url.trim() === 'https://' || !url.trim()) return;
    const title = prompt(t('Nhập tên hiển thị của liên kết (để trống sẽ dùng URL):'), '');
    const displayTitle = title?.trim() || url;
    setTeamCommentAttachments(prev => [...prev, { name: displayTitle, url: url.trim() }]);
  };

  const handleToggleVacation = async (id: number) => {
    try {
      const json = await fetchAPI('toggle_consultant_vacation', {
        method: 'POST',
        body: JSON.stringify({ id })
      });
      if (json.success) {
        toast.success(t('Đã thay đổi trạng thái Tạm ngưng'));
        setUsers(prev => prev.map(u => u.id === id ? { ...u, vacation_mode: json.vacation_mode } : u));
      } else {
        toast.error(json.message || t('Lỗi thay đổi trạng thái'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (leaderDropdownRef.current && !leaderDropdownRef.current.contains(event.target as Node)) {
        setShowLeaderDropdown(false);
      }
      if (coLeaderDropdownRef.current && !coLeaderDropdownRef.current.contains(event.target as Node)) {
        setShowCoLeaderDropdown(false);
      }
      if (addMemberDropdownRef.current && !addMemberDropdownRef.current.contains(event.target as Node)) {
        setShowAddMemberDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTeams();
    fetchAllSystemUsers();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (editingTeam?.id && teamDrawerTab === 'comments') {
      fetchTeamComments(editingTeam.id);
    }
  }, [editingTeam, teamDrawerTab]);

  const openAddModal = () => {
    setEditingUser(null);
    setScheduleMode('daily');
    setFormData({
      name: '',
      email: '',
      phone: '',
      status: 'active',
      leave_start: '',
      leave_end: '',
      zalo_chat_id: '',
      telegram_chat_id: '',
      work_start_time: '00:00',
      work_end_time: '23:59',
      work_schedule: null,
      avatar: '',
      team_id: '',
      dob: '',
      gender: '',
      citizen_id: '',
      address: '',
      bank_name: '',
      bank_account: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    const hasCustomSchedule = !!user.work_schedule;
    setScheduleMode(hasCustomSchedule ? 'custom' : 'daily');
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      status: user.status,
      leave_start: user.leave_start || '',
      leave_end: user.leave_end || '',
      zalo_chat_id: user.zalo_chat_id || '',
      telegram_chat_id: user.telegram_chat_id || '',
      work_start_time: user.work_start_time || '00:00',
      work_end_time: user.work_end_time || '23:59',
      work_schedule: user.work_schedule || null,
      avatar: user.avatar || '',
      team_id: user.team_id || '',
      dob: user.dob || '',
      gender: user.gender || '',
      citizen_id: user.citizen_id || '',
      address: user.address || '',
      bank_name: user.bank_name || '',
      bank_account: user.bank_account || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return toast.error(t('Vui lòng điền đầy đủ thông tin'));
    if (isSaving) return;

    setIsSaving(true);
    try {
      const action = editingUser ? 'edit_consultant' : 'add_consultant';
      const payload = {
        ...formData,
        id: editingUser?.id,
        work_schedule: scheduleMode === 'custom' ? formData.work_schedule : null
      };
      const json = await fetchAPI(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (json.success) {
        toast.success(editingUser ? t('Cập nhật thành công!') : t('Thêm mới thành công!'));
        fetchUsers();
        setModalOpen(false);
      } else {
        toast.error(json.message || t('Lỗi khi lưu'));
      }
    } catch (e: any) { toast.error(t('Lỗi: ') + e.message); }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      const json = await fetchAPI(`delete_consultant&id=${deleteId}`);
      if (json.success) {
        toast.success(t('Đã xóa thành công!'));
        fetchUsers();
      } else {
        toast.error(json.message || t('Lỗi khi xóa'));
      }
    } catch (e: any) { toast.error(t('Lỗi: ') + e.message); }
    setIsDeleting(false);
    setConfirmDeleteOpen(false);
  };

  const openAddTeamModal = () => {
    setEditingTeam(null);
    setTeamFormData({
      name: '',
      avatar_url: '',
      branch: '',
      leader_id: '',
      co_leader_ids: [],
      description: '',
      kpi_target: '',
      max_members: '',
      focus_projects: [],
      member_ids: []
    });
    setSearchLeader('');
    setSearchCoLeader('');
    setShowLeaderDropdown(false);
    setShowCoLeaderDropdown(false);
    setTeamModalOpen(true);
  };

  const openEditTeamModal = async (team: any) => {
    try {
      const res = await fetchAPI(`teams/${team.id}`);
      if (res && res.success && res.data) {
        const data = res.data;
        setEditingTeam(data);
        const memberIds = Array.isArray(data.members) ? data.members.map((m: any) => String(m.id)) : [];
        const focusProjects = data.focus_project ? data.focus_project.split(',').map((p: any) => p.trim()).filter(Boolean) : [];
        const coLeaderIds = data.co_leader_ids ? (Array.isArray(data.co_leader_ids) ? data.co_leader_ids.map(String) : (typeof data.co_leader_ids === 'string' && data.co_leader_ids.startsWith('[') ? JSON.parse(data.co_leader_ids).map(String) : String(data.co_leader_ids).split(',').map((id: any) => id.trim()).filter(Boolean))) : [];
        setTeamFormData({
          name: data.name,
          avatar_url: data.avatar_url || data.avatar || '',
          branch: data.branch || '',
          leader_id: data.leader_id || '',
          co_leader_ids: coLeaderIds,
          description: data.description || '',
          kpi_target: data.kpi_target !== null && data.kpi_target !== undefined ? String(data.kpi_target) : '',
          max_members: data.max_members !== null && data.max_members !== undefined ? String(data.max_members) : '',
          focus_projects: focusProjects,
          member_ids: memberIds
        });
        const leaderUser = allSystemUsers.find(u => Number(u.id) === Number(data.leader_id));
        setSearchLeader(leaderUser ? (leaderUser.full_name || leaderUser.name) : '');
        setSearchCoLeader('');
        setShowLeaderDropdown(false);
        setShowCoLeaderDropdown(false);
        setTeamModalOpen(true);
      } else {
        toast.error(res ? res.message : t('Lỗi không xác định khi tải dữ liệu'));
      }
    } catch (e: any) {
      toast.error(t('Không thể tải thông tin nhóm: ') + e.message);
    }
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamFormData.name) return toast.error(t('Vui lòng nhập tên nhóm'));
    
    setIsSaving(true);
    try {
      const isEdit = !!editingTeam;
      const url = isEdit ? `teams/${editingTeam.id}` : 'teams';
      const method = isEdit ? 'PUT' : 'POST';
      
      const payload = {
        name: teamFormData.name,
        avatar_url: teamFormData.avatar_url,
        branch: teamFormData.branch,
        leader_id: teamFormData.leader_id,
        co_leader_ids: teamFormData.co_leader_ids,
        description: teamFormData.description,
        kpi_target: teamFormData.kpi_target,
        max_members: teamFormData.max_members,
        focus_project: teamFormData.focus_projects.join(', '),
        member_ids: teamFormData.member_ids
      };

      const res = await fetchAPI(url, {
        method,
        body: JSON.stringify(payload)
      });
      
      if (res.success) {
        toast.success(isEdit ? t('Cập nhật nhóm thành công!') : t('Tạo nhóm mới thành công!'));
        fetchTeams();
        fetchUsers();
        setTeamModalOpen(false);
      } else {
        toast.error(res.message || t('Lỗi khi lưu nhóm'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsSaving(false);
  };

  const handleDeleteTeam = async () => {
    if (!deleteTeamId) return;
    setIsDeleting(true);
    try {
      const res = await fetchAPI(`teams/${deleteTeamId}`, { method: 'DELETE' });
      if (res.success) {
        toast.success(t('Đã xóa nhóm thành công!'));
        fetchTeams();
        fetchUsers();
      } else {
        toast.error(res.message || t('Lỗi khi xóa nhóm'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsDeleting(false);
    setConfirmDeleteTeamOpen(false);
    setDeleteTeamId(null);
  };

  const handleLeaveTeam = async () => {
    setIsLeavingTeam(true);
    try {
      const res = await fetchAPI('teams/leave', { method: 'POST' });
      if (res.success) {
        toast.success(t('Bạn đã rời khỏi nhóm thành công!'));
        fetchTeams();
        fetchUsers();
        setTeamModalOpen(false);
      } else {
        toast.error(res.message || t('Lỗi khi rời khỏi nhóm'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsLeavingTeam(false);
    setConfirmLeaveTeamOpen(false);
  };

  const confirmUnlinkZalo = (id: number) => {
    setUnlinkId(id);
    setUnlinkConfirmOpen(true);
  };

  const handleUnlinkZalo = async () => {
    if (!unlinkId) return;
    try {
      const json = await fetchAPI('unlink_zalo', {
        method: 'POST',
        body: JSON.stringify({ id: unlinkId, type: 'consultant' })
      });
      if (json.success) {
        toast.success(t('Đã hủy liên kết Zalo thành công!'));
        fetchUsers();
        setFormData(prev => ({ ...prev, zalo_chat_id: '' }));
        setEditingUser((prev: any) => prev ? { ...prev, zalo_chat_id: null } : null);
      } else {
        toast.error(json.message || t('Lỗi khi hủy liên kết'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setUnlinkConfirmOpen(false);
    setUnlinkId(null);
  };
  const [zaloRemindingId, setZaloRemindingId] = useState<number | null>(null);
  const [zaloRemindedId, setZaloRemindedId] = useState<number | null>(null);

  const [tgRemindingId, setTgRemindingId] = useState<number | null>(null);
  const [tgRemindedId, setTgRemindedId] = useState<number | null>(null);

  const handleResendTelegramVerify = async (consId: number) => {
    setTgRemindingId(consId);
    try {
      const json = await fetchAPI('resend_telegram_verify_consultant', {
        method: 'POST',
        body: JSON.stringify({ id: consId })
      });
      if (json.success) {
        toast.success(t('Đã gửi email nhắc liên kết Telegram.'));
        setTgRemindedId(consId);
        setTimeout(() => setTgRemindedId(null), 5000);
      } else {
        toast.error(json.message || t('Lỗi khi gửi email'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setTgRemindingId(null);
  };

  const handleResendZaloVerify = async (consId: number) => {
    setZaloRemindingId(consId);
    try {
      const json = await fetchAPI('resend_zalo_verify_consultant', {
        method: 'POST',
        body: JSON.stringify({ id: consId })
      });
      if (json.success) {
        toast.success(t('Đã gửi lại email nhắc xác thực Zalo.'));
        setZaloRemindedId(consId);
        setTimeout(() => setZaloRemindedId(null), 5000);
      } else {
        toast.error(json.message || t('Lỗi khi gửi email'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setZaloRemindingId(null);
  };

  const handleSendQuickMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMessageText.trim() || !quickMessageTarget) return;
    setIsSendingMsg(true);
    try {
      const res = await fetchAPI('send_quick_zalo_message', {
        method: 'POST',
        body: JSON.stringify({ consultant_id: quickMessageTarget.id, message: quickMessageText })
      });
      if (res.success) {
        toast.success(res.message || t('Đã gửi tin nhắn thành công!'));
        setQuickMessageOpen(false);
        setQuickMessageText('');
      } else {
        toast.error(res.message || t('Lỗi khi gửi tin'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsSendingMsg(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('Vui lòng chọn file hình ảnh hợp lệ.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('Kích thước ảnh không được vượt quá 5MB.'));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const compressedFile = await compressToWebP(file);
      const fd = new FormData();
      fd.append('avatar', compressedFile);

      const oldAvatar = formData.avatar || '';
      const query = `upload_avatar&old_avatar=${encodeURIComponent(oldAvatar)}`;
      const res = await fetchAPI(query, {
        method: 'POST',
        body: fd
      });

      if (res.success && res.url) {
        setFormData(prev => ({ ...prev, avatar: res.url }));
        toast.success(t('Tải ảnh đại diện lên thành công!'));
      } else {
        toast.error(res.message || t('Lỗi khi tải ảnh lên'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchConsultantStats = async (consId: number, mode: string, start?: string, end?: string) => {
    setStatsLoading(true);
    try {
      let query = `get_consultant_stats&consultant_id=${consId}&date_mode=${mode}`;
      if (mode === 'custom' && start && end) {
        query += `&start_date=${start}&end_date=${end}`;
      }
      const json = await fetchAPI(query);
      if (json.success) {
        setStatsData(json);
      } else {
        toast.error(json.message || t('Lỗi khi tải báo cáo thống kê'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setStatsLoading(false);
  };

  useEffect(() => {
    if (statsModalOpen && statsConsultant) {
      if (statsDateMode !== 'custom' || (statsStartDate && statsEndDate)) {
        fetchConsultantStats(statsConsultant.id, statsDateMode, statsStartDate, statsEndDate);
      }
    }
  }, [statsModalOpen, statsConsultant, statsDateMode, statsStartDate, statsEndDate]);

  const activeCount = users.filter(u => u.status === 'active').length;
  const leaveCount = users.filter(u => u.status === 'leave').length;
  const inactiveCount = users.filter(u => u.status === 'inactive').length;

  const filteredUsers = React.useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return users;
    return users.filter(u => 
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query)) ||
      (u.phone && u.phone.toLowerCase().includes(query))
    );
  }, [users, searchQuery]);

  const paginatedUsers = React.useMemo(() => {
    const startIndex = (consultantsPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUsers, consultantsPage, ITEMS_PER_PAGE]);

  const consultantsTotalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

  const paginatedTeams = React.useMemo(() => {
    const startIndex = (teamsPage - 1) * ITEMS_PER_PAGE;
    return teams.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [teams, teamsPage, ITEMS_PER_PAGE]);

  const teamsTotalPages = Math.ceil(teams.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setConsultantsPage(1);
  }, [users.length]);

  useEffect(() => {
    setTeamsPage(1);
  }, [teams.length]);

  return (
    <div className="anim-fade-up">
      {/* Header */}
      <div className={isMobile ? "" : "page-header"} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '16px', marginBottom: '1.5rem', position: 'relative', zIndex: 50 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: isMobile ? '1.25rem' : '1.75rem', flexWrap: 'wrap' }}>
            {activeTab === 'teams' ? t('Quản lý Nhóm (Team)') : activeTab === 'branches' ? t('Chi nhánh Kinh doanh') : t('Quản lý Tư vấn viên')}
            <button
              onClick={() => setShowInfoModal(true)}
              style={{
                background: 'rgba(0, 0, 0, 0.02)',
                border: '1px solid var(--color-border)',
                padding: '3px 8px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'all 0.2s',
                height: '24px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--color-primary)';
                e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                e.currentTarget.style.background = 'var(--color-primary-light)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)';
              }}
              title={t("Xem hướng dẫn thiết lập nhân sự, team và dự án trọng điểm")}
            >
              <Info size={12} style={{ marginTop: 1 }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{t("Cơ chế")}</span>
            </button>
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>
            {activeTab === 'teams'
              ? t('Danh sách nhóm phân chia công việc và chỉ tiêu dự án')
              : activeTab === 'branches'
              ? t('Cơ cấu chi nhánh văn phòng của công ty')
              : t('Danh sách nhân sự tiếp nhận và xử lý data từ hệ thống')}
          </p>
        </div>

        {isMobile ? (
          /* Mobile Plus Button on the right of title row */
          <div style={{ flexShrink: 0 }}>
            {isWriteAuthorized && activeTab === 'teams' ? (
              <button 
                onClick={openAddTeamModal} 
                className="btn primary"
                style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', height: '36px', width: '36px', minWidth: '36px' }}
              >
                <Plus size={18} />
              </button>
            ) : activeTab === 'branches' ? null : isWriteAuthorized ? (
              <button 
                onClick={openAddModal} 
                className="btn primary"
                style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', height: '36px', width: '36px', minWidth: '36px' }}
              >
                <Plus size={18} />
              </button>
            ) : null}
          </div>
        ) : (
          /* Desktop layout: Subtabs and Add Button side by side */
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', width: 'auto', justifyContent: 'flex-end' }}>
            {/* Tab bar (desktop only) */}
            {showAllTabs && (
              <div className="segmented-control-wrapper" style={{ margin: 0 }}>
                <div style={{
                  display: 'flex',
                  background: 'var(--color-border-light)',
                  border: '1px solid var(--color-border)',
                  padding: '2px',
                  borderRadius: '8px',
                  gap: '2px',
                  width: 'fit-content',
                  position: 'relative'
                }}>
                  {/* Sliding Pill Background Indicator */}
                  <div style={{
                    position: 'absolute',
                    top: '2px',
                    bottom: '2px',
                    width: '120px',
                    borderRadius: '6px',
                    background: 'var(--color-surface)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: `translateX(${
                      activeTab === 'consultants' ? '0px' : 
                      activeTab === 'teams' ? '122px' : '244px'
                    })`,
                    zIndex: 1
                  }} />

                  {[
                    { id: 'consultants', label: t('Tư vấn viên'), icon: <User size={14} /> },
                    { id: 'teams', label: t('Nhóm (Team)'), icon: <Users size={14} /> },
                    { id: 'branches', label: t('Chi nhánh'), icon: <Building2 size={14} /> }
                  ].map(tab => {
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => navigate(`/consultants?tab=${tab.id}`)}
                        style={{
                          width: '120px',
                          height: '32px',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: 'transparent',
                          color: isSelected ? 'var(--color-text)' : 'var(--color-text-light)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          position: 'relative',
                          outline: 'none',
                          boxShadow: 'none',
                          zIndex: 2,
                          transition: 'color 0.2s ease'
                        }}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Button */}
            {isWriteAuthorized && activeTab === 'teams' ? (
              <button 
                onClick={openAddTeamModal} 
                className="btn primary"
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px', height: '36px', flexShrink: 0 }}
              >
                <Plus size={16} />
                <span>{t('Thêm Nhóm')}</span>
              </button>
            ) : activeTab === 'branches' ? null : isWriteAuthorized ? (
              <button 
                onClick={openAddModal} 
                className="btn primary"
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px', height: '36px', flexShrink: 0 }}
              >
                <Plus size={16} />
                <span>{t('Thêm TVV')}</span>
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Tab Panels with Enter Animation */}
      <div key={activeTab} className="subtab-enter-active" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Summary Cards */}
        {activeTab === 'consultants' && (
        <div className="responsive-grid-4" style={{ display: isMobile ? 'none' : 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          {/* Card 1: Tổng TVV */}
          <div className="stat-card total-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', minHeight: '130px', boxShadow: '0 4px 12px rgba(0,0,0,0.015)', position: 'relative', overflow: 'hidden' }}>
            <div className="decor-svg" style={{ color: '#64748b' }}>
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <circle cx="50" cy="35" r="15" stroke="currentColor" strokeWidth="2" />
                <path d="M15 80 C 15 60, 31 48, 50 48 C 69 48, 85 60, 85 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="stat-label" style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Tổng TVV')}</span>
              <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.08)', color: '#64748b', flexShrink: 0 }}>
                <Users size={16} />
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {loading ? (
                <div style={{ height: '28px', width: '48px', background: 'var(--color-border-light)', borderRadius: '4px' }} className="animate-pulse" />
              ) : (
                <span className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{users.length}</span>
              )}
            </div>
          </div>

          {/* Card 2: Đang nhận Data */}
          <div className="stat-card distributed-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', minHeight: '130px', boxShadow: '0 4px 12px rgba(0,0,0,0.015)', position: 'relative', overflow: 'hidden' }}>
            <div className="decor-svg" style={{ color: 'var(--color-success)' }}>
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" />
                <path d="M35 50 L 45 60 L 65 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="stat-label" style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Đang nhận Data')}</span>
              <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--color-success)', flexShrink: 0 }}>
                <CheckCircle size={16} />
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {loading ? (
                <div style={{ height: '28px', width: '48px', background: 'var(--color-border-light)', borderRadius: '4px' }} className="animate-pulse" />
              ) : (
                <span className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-success)', lineHeight: 1.1 }}>{activeCount}</span>
              )}
            </div>
          </div>

          {/* Card 3: Đang nghỉ phép */}
          <div className="stat-card duplicates-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', minHeight: '130px', boxShadow: '0 4px 12px rgba(0,0,0,0.015)', position: 'relative', overflow: 'hidden' }}>
            <div className="decor-svg" style={{ color: 'var(--color-warning)' }}>
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <rect x="20" y="25" width="60" height="55" rx="5" stroke="currentColor" strokeWidth="2" />
                <path d="M20 40 H 80 M 35 15 V 25 M 65 15 V 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="stat-label" style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Đang nghỉ phép')}</span>
              <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-warning)', flexShrink: 0 }}>
                <Calendar size={16} />
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {loading ? (
                <div style={{ height: '28px', width: '48px', background: 'var(--color-border-light)', borderRadius: '4px' }} className="animate-pulse" />
              ) : (
                <span className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-warning)', lineHeight: 1.1 }}>{leaveCount}</span>
              )}
            </div>
          </div>

          {/* Card 4: Ngừng hoạt động */}
          <div className="stat-card errors-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', minHeight: '130px', boxShadow: '0 4px 12px rgba(0,0,0,0.015)', position: 'relative', overflow: 'hidden' }}>
            <div className="decor-svg" style={{ color: 'var(--color-danger)' }}>
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <circle cx="45" cy="35" r="15" stroke="currentColor" strokeWidth="2" />
                <path d="M15 75 C 15 60, 27 50, 45 50 C 53 50, 60 54, 65 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M75 55 L 90 70 M 90 55 L 75 70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="stat-label" style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Ngừng hoạt động')}</span>
              <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', color: 'var(--color-danger)', flexShrink: 0 }}>
                <UserX size={16} />
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {loading ? (
                <div style={{ height: '28px', width: '48px', background: 'var(--color-border-light)', borderRadius: '4px' }} className="animate-pulse" />
              ) : (
                <span className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-danger)', lineHeight: 1.1 }}>{inactiveCount}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'consultants' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{
            padding: isMobile ? '0.75rem 1rem' : '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-surface)',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: isMobile ? '100%' : '480px', maxWidth: isMobile ? '100%' : '480px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <input
                  type="text"
                  placeholder={t('Tìm kiếm tên, email, điện thoại...')}
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setConsultantsPage(1);
                  }}
                  className="form-input"
                  style={{
                    paddingLeft: '12px',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    width: '100%',
                    height: '38px'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setConsultantsPage(1);
                    }}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Mobile Tab Selector ... Button */}
              {isMobile && (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <button
                    onClick={() => setShowMobileTabMenu(!showMobileTabMenu)}
                    style={{
                      height: '38px',
                      width: '38px',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '10px',
                      border: '1px solid var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text)'
                    }}
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {showMobileTabMenu && (
                    <>
                      <div 
                        onClick={() => setShowMobileTabMenu(false)}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                      />
                      <div style={{
                        position: 'absolute',
                        top: '44px',
                        right: 0,
                        width: '160px',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '12px',
                        boxShadow: 'var(--shadow-lg)',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        zIndex: 1000
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', padding: '2px 8px', textTransform: 'uppercase' }}>
                          {t('Chuyển Tab')}
                        </div>
                        {[
                          { id: 'consultants', label: t('Tư vấn viên') },
                          { id: 'teams', label: t('Nhóm (Team)') },
                          { id: 'branches', label: t('Chi nhánh') }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => {
                              navigate(`/consultants?tab=${tab.id}`);
                              setShowMobileTabMenu(false);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 10px',
                              fontSize: '0.825rem',
                              borderRadius: '8px',
                              border: 'none',
                              cursor: 'pointer',
                              background: activeTab === tab.id ? 'var(--color-primary-light)' : 'transparent',
                              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text)',
                              fontWeight: activeTab === tab.id ? 700 : 500
                            }}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t('Tổng số')}: <strong style={{ color: 'var(--color-text)' }}>{filteredUsers.length}</strong> / {users.length} {t('tư vấn viên')}
            </div>
          </div>
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
              {paginatedUsers.map(u => (
                <div
                  key={u.id}
                  onClick={() => openEditModal(u)}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{ flexShrink: 0 }}>
                      <Avatar
                        src={u.avatar}
                        name={u.name}
                        size={42}
                        style={{
                          filter: (u.status === 'inactive' || u.status === 'leave' || Number(u.vacation_mode) === 1) ? 'grayscale(1)' : 'none',
                          opacity: (u.status === 'inactive' || u.status === 'leave' || Number(u.vacation_mode) === 1) ? 0.5 : 1
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: 1.2 }}>
                        {u.name}
                      </span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {t('Điện thoại:')} {u.phone || '—'}
                      </span>
                    </div>
                  </div>
                  {isWriteAuthorized && (
                    <div style={{ color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <ChevronRight size={18} />
                    </div>
                  )}
                </div>
              ))}
              {paginatedUsers.length === 0 && (
                <div style={{ padding: '3rem 2rem', textAlign: 'center', background: 'var(--color-surface)', borderRadius: 12 }}>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('Chưa có Tư vấn viên')}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="table-wrap mobile-card-table custom-scrollbar" style={{ border: 'none', borderRadius: 0, maxHeight: '480px', overflowY: 'auto' }}>
              <table className="mobile-table-compact">
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>{t('Tên TVV')}</th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>{t('Thông tin liên hệ')}</th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>{t('Zalo Bot')}</th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>{t('Telegram Bot')}</th>
                    <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>{t('Trạng thái')}</th>
                    {isWriteAuthorized && <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>{t('Thao tác')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => <TableRowSkeleton key={i} cols={isWriteAuthorized ? 6 : 5} />)
                  ) : users.length === 0 ? (
                    <tr className="empty-state-row">
                      <td colSpan={isWriteAuthorized ? 6 : 5}>
                      <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: 'var(--shadow-sm)' }}>
                          <Users size={32} color="var(--color-text-muted)" />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.5rem' }}>{t('Chưa có Tư vấn viên')}</h3>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto 1.5rem' }}>{t('Thêm tư vấn viên đầu tiên để bắt đầu chia số tự động.')}</p>
                        {isWriteAuthorized && <button className="btn primary" onClick={openAddModal}><Plus size={18} /> {t('Thêm Tư vấn viên')}</button>}
                      </div>
                    </td>
                  </tr>
                ) : paginatedUsers.map((u) => {
                  return (
                    <tr
                      key={u.id}
                      className="group table-row-hover"
                      style={{ cursor: 'pointer' }}
                      onClick={() => openEditModal(u)}
                      title={t("Nhấp để xem chi tiết")}
                    >
                      <td data-label={t('Tên TVV')}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar
                            src={u.avatar}
                            name={u.name}
                            size={32}
                            style={{
                              filter: (u.status === 'inactive' || u.status === 'leave' || Number(u.vacation_mode) === 1) ? 'grayscale(1)' : 'none',
                              opacity: (u.status === 'inactive' || u.status === 'leave' || Number(u.vacation_mode) === 1) ? 0.5 : 1
                            }}
                          />
                          <div>
                            <div
                              style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)', transition: 'color 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-primary)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text)'}
                            >
                              {u.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 2 }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>ID: {u.id}</span>
                              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--color-text-muted)' }} />
                              {u.work_schedule ? (
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    color: '#0ea5e9',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    cursor: 'help',
                                    borderBottom: '1px dotted #0ea5e9'
                                  }}
                                  title={formatScheduleTooltip(u.work_schedule, t)}
                                >
                                  <Clock size={12} /> {t('Lịch tuần')}
                                </span>
                              ) : (
                                (u.work_start_time === '00:00' && u.work_end_time === '23:59') || (!u.work_start_time && !u.work_end_time) ? (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }} title={t("Nhận data 24/24")}>
                                    <Clock size={12} /> 24/24
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }} title={`${t('Nhận data từ')} ${u.work_start_time} ${t('đến')} ${u.work_end_time}`}>
                                    <Clock size={12} /> {u.work_start_time} - {u.work_end_time}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td data-label={t('Thông tin liên hệ')} style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png" alt="Gmail" style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0 }} />
                            <span>{u.email}</span>
                          </div>
                          {u.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text)' }}>
                              <Phone size={12} style={{ color: 'var(--color-primary)' }} />
                              <span>{u.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td data-label={t('Zalo Bot')} onClick={e => e.stopPropagation()}>
                        {u.zalo_chat_id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '4px 10px', borderRadius: 20,
                              background: '#e5f0ff', color: '#0068ff', fontSize: '0.75rem', fontWeight: 600
                            }}>
                              <img src="https://stc-zpl.zdn.vn/favicon.ico" alt="Zalo" style={{ width: 14, height: 14, borderRadius: '2px' }} /> {t('Đã liên kết')}
                            </span>
                            <CopyButton text={u.zalo_chat_id} />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '4px 10px', borderRadius: 20,
                              background: 'var(--color-bg)', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 500
                            }}>
                              {t('Chưa liên kết')}
                            </span>
                            {u.email && u.email.toLowerCase() === user?.email?.toLowerCase() ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleConnectZalo(); }}
                                style={{
                                  fontSize: '0.725rem', padding: '3px 8px', borderRadius: '6px',
                                  background: '#0068ff', color: 'white', border: 'none',
                                  display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, cursor: 'pointer'
                                }}
                              >
                                {t('Liên kết')} <ExternalLink size={12} />
                              </button>
                            ) : (
                              u.email && (
                                zaloRemindedId === u.id ? (
                                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                    <Check size={12} /> {t('Đã nhắc')}
                                  </span>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); handleResendZaloVerify(u.id); }} className="btn ghost" style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }} title={t("Gửi email nhắc xác thực Zalo")} disabled={zaloRemindingId === u.id}>
                                    {zaloRemindingId === u.id ? <RefreshCw size={12} className="spin" /> : <Send size={12} />} {zaloRemindingId === u.id ? t('Đang gửi...') : t('Nhắc')}
                                  </button>
                                )
                              )
                            )}
                          </div>
                        )}
                        </td>
                        <td data-label={t('Telegram Bot')} onClick={e => e.stopPropagation()}>
                          {u.telegram_chat_id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '4px 10px', borderRadius: 20,
                                background: '#e8f4fd', color: '#0088cc', fontSize: '0.75rem', fontWeight: 600
                              }}>
                                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/3840px-Telegram_logo.svg.png" alt="Telegram" style={{ width: 14, height: 14, borderRadius: '50%' }} /> {t('Đã liên kết')}
                              </span>
                              <CopyButton text={u.telegram_chat_id} />
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '4px 10px', borderRadius: 20,
                                background: 'var(--color-bg)', color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 500
                              }}>
                                {t('Chưa liên kết')}
                              </span>
                              {u.email && u.email.toLowerCase() === user?.email?.toLowerCase() ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleConnectTelegram(u.id); }}
                                  style={{
                                    fontSize: '0.725rem', padding: '3px 8px', borderRadius: '6px',
                                    background: '#0284c7', color: 'white', border: 'none',
                                    display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, cursor: 'pointer'
                                  }}
                                >
                                  {t('Liên kết')} <ExternalLink size={12} />
                                </button>
                              ) : (
                                u.email && (
                                  tgRemindedId === u.id ? (
                                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                      <Check size={12} /> {t('Đã nhắc')}
                                    </span>
                                  ) : (
                                    <button onClick={(e) => { e.stopPropagation(); handleResendTelegramVerify(u.id); }} className="btn ghost" style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }} title={t("Gửi email nhắc liên kết Telegram")} disabled={tgRemindingId === u.id}>
                                      {tgRemindingId === u.id ? <RefreshCw size={12} className="spin" /> : <Send size={12} />} {tgRemindingId === u.id ? t('Đang gửi...') : t('Nhắc')}
                                    </button>
                                  )
                                )
                              )}
                            </div>
                          )}
                        </td>
                        <td data-label={t('Trạng thái')} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {u.status === 'active' ? (
                            Number(u.vacation_mode) ? (
                              <span className="badge warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                                {t('Tạm ngưng')}
                              </span>
                            ) : (
                              <span className="badge success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                                {t('Đang nhận Data')}
                              </span>
                            )
                          ) : u.status === 'leave' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span className="badge warning" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                                <Clock size={12} /> {t('Nghỉ phép')}
                              </span>
                              {(u.leave_start || u.leave_end) && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                  {u.leave_start ? new Date(u.leave_start).toLocaleDateString('vi-VN') : '...'} - {u.leave_end ? new Date(u.leave_end).toLocaleDateString('vi-VN') : '...'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="badge danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
                              <UserX size={12} /> {t('Ngừng HĐ')}
                            </span>
                          )}
                        </div>
                      </td>
                      {isWriteAuthorized && (
                        <td className="col-actions" data-label={t('Thao tác')} style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div className="row-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', opacity: 0, transition: 'opacity 0.15s' }}>
                            <button
                              onClick={() => {
                                setStatsConsultant(u);
                                setStatsDateMode('this_month');
                                setStatsStartDate('');
                                setStatsEndDate('');
                                setStatsModalOpen(true);
                              }}
                              className="btn ghost sm"
                              style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: 'var(--color-primary)' }}
                              title={t("Thống kê hiệu suất")}
                            >
                              <BarChart2 size={14} />
                            </button>
                            <button onClick={() => { setDeleteId(u.id); setConfirmDeleteOpen(true); }} className="btn ghost sm" style={{ width: 32, height: 32, padding: 0, borderRadius: 8, color: 'var(--color-danger)' }} title={t("Xóa nhân sự")}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

        {/* Consultants Pagination */}
        {consultantsTotalPages > 1 && (
          <div style={{ 
            padding: '1rem 1.25rem', 
            borderTop: '1px solid var(--color-border-light)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            background: 'var(--color-surface)',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px'
          }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Hiển thị <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{(consultantsPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{Math.min(consultantsPage * ITEMS_PER_PAGE, users.length)}</span> trên <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{users.length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button 
                onClick={() => setConsultantsPage(prev => Math.max(prev - 1, 1))} 
                disabled={consultantsPage === 1} 
                className="btn sm outline" 
                style={{ height: 32, width: 32, padding: 0, minWidth: 32, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: consultantsPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={16} />
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                {(() => {
                  const maxVisible = 5;
                  let start = Math.max(1, consultantsPage - Math.floor(maxVisible / 2));
                  let end = Math.min(consultantsTotalPages, start + maxVisible - 1);
                  if (end - start + 1 < maxVisible) {
                    start = Math.max(1, end - maxVisible + 1);
                  }
                  const pageNumbers = [];
                  for (let p = start; p <= end; p++) {
                    pageNumbers.push(p);
                  }
                  return pageNumbers.map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setConsultantsPage(pageNum)}
                      style={{
                        width: 32, height: 32, borderRadius: 8, fontSize: '0.8125rem', fontWeight: 700,
                        border: consultantsPage === pageNum ? 'none' : '1px solid var(--color-border-light)',
                        background: consultantsPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: consultantsPage === pageNum ? 'white' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      className={consultantsPage === pageNum ? '' : 'hover-lift'}
                    >
                      {pageNum}
                    </button>
                  ));
                })()}
              </div>
              <button 
                onClick={() => setConsultantsPage(prev => Math.min(prev + 1, consultantsTotalPages))} 
                disabled={consultantsPage === consultantsTotalPages} 
                className="btn sm outline" 
                style={{ height: 32, width: 32, padding: 0, minWidth: 32, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: consultantsPage === consultantsTotalPages ? 'not-allowed' : 'pointer' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      ) : activeTab === 'teams' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? '1rem' : '1.5rem', padding: '0.25rem' }}>
            {teamsLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="card animate-pulse" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '200px' }}>
                  <div style={{ height: '24px', width: '60%', background: 'var(--color-border-light)', borderRadius: '4px' }} />
                  <div style={{ height: '16px', width: '40%', background: 'var(--color-border-light)', borderRadius: '4px' }} />
                  <div style={{ height: '40px', width: '100%', background: 'var(--color-border-light)', borderRadius: '8px', marginTop: 'auto' }} />
                </div>
              ))
            ) : teams.length === 0 ? (
              <div className="card" style={{ gridColumn: '1 / -1', padding: '4rem 2rem', textAlign: 'center' }}>
                <Users size={48} color="var(--color-text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Chưa có Nhóm')}</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>{t('Nhấp thêm nhóm để bắt đầu quản lý phân cấp thành viên.')}</p>
              </div>
            ) : paginatedTeams.map((team) => {
                const leader = allSystemUsers.find(u => Number(u.id) === Number(team.leader_id));
                return (
                  <div 
                    key={team.id} 
                    className="card card-hover" 
                    onClick={() => openEditTeamModal(team)}
                    style={{ 
                      cursor: 'pointer', 
                      padding: '1.25rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '1rem',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '16px',
                      background: 'var(--color-surface)',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'transform 0.25s, box-shadow 0.25s, border-color 0.25s'
                    }}
                  >
                    {/* Header Row */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ 
                        width: '42px', 
                        height: '42px', 
                        borderRadius: '50%', 
                        overflow: 'hidden',
                        border: '1.5px solid var(--color-border-light)',
                        background: (team.avatar_url || team.avatar) ? 'transparent' : 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '1rem',
                        flexShrink: 0
                      }}>
                        {(team.avatar_url || team.avatar) ? (
                          <img src={team.avatar_url || team.avatar} alt={team.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          team.name?.[0] || 'T'
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {team.name}
                        </h3>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '2px', alignItems: 'center' }}>
                          <span className="badge info sm" style={{ fontWeight: 700, fontSize: '0.6875rem', padding: '2px 6px' }}>
                            {team.member_count} {t('nhân viên')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Slogan / Description */}
                    {team.description && (
                      <div style={{ 
                        fontSize: '0.8125rem', 
                        color: 'var(--color-text-light)', 
                        fontStyle: 'italic', 
                        background: 'var(--color-bg)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        borderLeft: '3px solid var(--color-primary)',
                        lineHeight: 1.4
                      }}>
                        "{team.description}"
                      </div>
                    )}

                    {/* Details Panel */}
                    <div style={{ 
                      background: 'rgba(0, 0, 0, 0.01)', 
                      border: '1px solid var(--color-border-light)', 
                      borderRadius: '12px', 
                      padding: '12px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '10px' 
                    }}>
                      {/* Trưởng nhóm */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}>
                          <User size={14} />
                          <span>{t('Trưởng nhóm')}:</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {team.leader_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Avatar src={leader?.avatar_url || leader?.avatar} name={team.leader_name} size={18} />
                                {(() => {
                                  const coLeaderIds = team.co_leader_ids ? (Array.isArray(team.co_leader_ids) ? team.co_leader_ids.map(String) : (typeof team.co_leader_ids === 'string' && team.co_leader_ids.startsWith('[') ? JSON.parse(team.co_leader_ids).map(String) : String(team.co_leader_ids).split(',').map((id: any) => id.trim()).filter(Boolean))) : [];
                                  const coLeaders = coLeaderIds.map((id: string) => allSystemUsers.find(u => String(u.id) === id)).filter(Boolean);
                                  return (
                                    <>
                                      {coLeaders.slice(0, 3).map((cl: any) => (
                                        <div key={cl.id} style={{ marginLeft: '-5px', border: '1.5px solid var(--color-surface)', borderRadius: '50%', overflow: 'hidden', display: 'flex' }}>
                                          <Avatar src={cl.avatar_url || cl.avatar} name={cl.full_name || cl.name} size={16} />
                                        </div>
                                      ))}
                                      {coLeaders.length > 3 && (
                                        <div style={{ marginLeft: '-5px', width: 16, height: 16, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-surface)' }}>
                                          +{coLeaderIds.length - 3}
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>
                                {team.leader_name}
                                {(() => {
                                  const coLeaderIds = team.co_leader_ids ? (Array.isArray(team.co_leader_ids) ? team.co_leader_ids.map(String) : (typeof team.co_leader_ids === 'string' && team.co_leader_ids.startsWith('[') ? JSON.parse(team.co_leader_ids).map(String) : String(team.co_leader_ids).split(',').map((id: any) => id.trim()).filter(Boolean))) : [];
                                  return coLeaderIds.length > 0 ? ` (+${coLeaderIds.length})` : '';
                                })()}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Chưa gán')}</span>
                          )}
                        </div>
                      </div>

                      {/* Chi nhánh */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}>
                          <Building2 size={14} />
                          <span>{t('Chi nhánh')}:</span>
                        </div>
                        <span style={{ color: 'var(--color-text)', fontWeight: team.branch ? 600 : 400 }}>
                          {team.branch || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Chưa gán')}</span>}
                        </span>
                      </div>

                      {/* Thành viên (Avatars) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}>
                          <Users size={14} />
                          <span>{t('Thành viên')}:</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {(() => {
                            const members = allSystemUsers.filter(u => String(u.team_id) === String(team.id));
                            return (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', marginRight: '6px' }}>
                                  {members.slice(0, 5).map((m: any, idx: number) => (
                                    <div key={m.id} style={{ 
                                      marginLeft: idx > 0 ? '-8px' : '0', 
                                      border: '1.5px solid var(--color-surface)', 
                                      borderRadius: '50%', 
                                      overflow: 'hidden', 
                                      display: 'flex',
                                      boxShadow: 'var(--shadow-sm)'
                                    }}>
                                      <Avatar src={m.avatar_url || m.avatar} name={m.full_name || m.name || 'User'} size={20} />
                                    </div>
                                  ))}
                                </div>
                                {members.length > 5 ? (
                                  <span className="badge info sm" style={{ fontWeight: 800, fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px' }}>
                                    +{members.length - 5}
                                  </span>
                                ) : (
                                  members.length === 0 && <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Trống')}</span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Dự án */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-muted)' }}>
                          <CheckCircle size={14} />
                          <span>{t('Dự án trọng điểm')}:</span>
                        </div>
                        {team.focus_project ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end', maxWidth: '70%' }}>
                            {team.focus_project.split(',').map((p: string) => p.trim()).filter(Boolean).map((projName: string) => {
                              const projObj = projects.find((p: any) => p.name === projName);
                              return (
                                <span 
                                  key={projName} 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (projObj) {
                                      navigate(`/projects?project_id=${projObj.id}`);
                                    } else {
                                      navigate('/projects');
                                    }
                                  }}
                                  className="badge sm" 
                                  style={{ 
                                    fontWeight: 700, 
                                    fontSize: '0.7rem',
                                    background: 'var(--color-bg-alt)',
                                    color: 'var(--color-text-muted)',
                                    border: '1px solid var(--color-border-light)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    userSelect: 'none'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = 'var(--color-border-light)';
                                    e.currentTarget.style.color = 'var(--color-text)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'var(--color-bg-alt)';
                                    e.currentTarget.style.color = 'var(--color-text-muted)';
                                  }}
                                >
                                  {projName}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Chưa gán')}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {isWriteAuthorized && (
                      <div 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'flex-end', 
                          gap: '0.5rem', 
                          marginTop: 'auto',
                          paddingTop: '8px'
                        }} 
                        onClick={e => e.stopPropagation()}
                      >
                        <button 
                          className="btn sm outline" 
                          onClick={() => openEditTeamModal(team)}
                          style={{ borderRadius: '8px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          {t('Sửa')}
                        </button>
                        <button
                          className="btn sm"
                          style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: 'none', borderRadius: '8px', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600 }}
                          onClick={() => {
                            setDeleteTeamId(team.id);
                            setConfirmDeleteTeamOpen(true);
                          }}
                        >
                          {t('Xóa')}
                        </button>
                      </div>
                    )}
                  </div>
                );
            })}
          </div>

          {/* Teams Pagination */}
          {teamsTotalPages > 1 && (
            <div style={{ 
              padding: '1rem 1.25rem', 
              borderTop: '1px solid var(--color-border-light)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              background: 'var(--color-surface)',
              borderRadius: '16px',
              border: '1px solid var(--color-border-light)'
            }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Hiển thị <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{(teamsPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{Math.min(teamsPage * ITEMS_PER_PAGE, teams.length)}</span> trên <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{teams.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button 
                  onClick={() => setTeamsPage(prev => Math.max(prev - 1, 1))} 
                  disabled={teamsPage === 1} 
                  className="btn sm outline" 
                  style={{ height: 32, width: 32, padding: 0, minWidth: 32, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: teamsPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(() => {
                    const maxVisible = 5;
                    let start = Math.max(1, teamsPage - Math.floor(maxVisible / 2));
                    let end = Math.min(teamsTotalPages, start + maxVisible - 1);
                    if (end - start + 1 < maxVisible) {
                      start = Math.max(1, end - maxVisible + 1);
                    }
                    const pageNumbers = [];
                    for (let p = start; p <= end; p++) {
                      pageNumbers.push(p);
                    }
                    return pageNumbers.map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setTeamsPage(pageNum)}
                        style={{
                          width: 32, height: 32, borderRadius: 8, fontSize: '0.8125rem', fontWeight: 700,
                          border: teamsPage === pageNum ? 'none' : '1px solid var(--color-border-light)',
                          background: teamsPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: teamsPage === pageNum ? 'white' : 'var(--color-text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        className={teamsPage === pageNum ? '' : 'hover-lift'}
                      >
                        {pageNum}
                      </button>
                    ));
                  })()}
                </div>
                <button 
                  onClick={() => setTeamsPage(prev => Math.min(prev + 1, teamsTotalPages))} 
                  disabled={teamsPage === teamsTotalPages} 
                  className="btn sm outline" 
                  style={{ height: 32, width: 32, padding: 0, minWidth: 32, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: teamsPage === teamsTotalPages ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', textAlign: 'left' }}>
          {teamsLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? '1rem' : '1.5rem', padding: '0.25rem' }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card animate-pulse" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '200px' }}>
                  <div style={{ height: '24px', width: '65%', background: 'var(--color-border-light)', borderRadius: '4px' }} />
                  <div style={{ height: '16px', width: '45%', background: 'var(--color-border-light)', borderRadius: '4px' }} />
                  <div style={{ height: '40px', width: '100%', background: 'var(--color-border-light)', borderRadius: '8px', marginTop: 'auto' }} />
                </div>
              ))}
            </div>
          ) : (() => {
            const branchMap: Record<string, any[]> = {};
            teams.forEach(team => {
              const fullAddress = team.branch || '';
              const bName = fullAddress ? getCityFromAddress(fullAddress, t('Không thuộc chi nhánh nào')) : t('Không thuộc chi nhánh nào');
              if (!branchMap[bName]) branchMap[bName] = [];
              branchMap[bName].push(team);
            });
            const branchList = Object.entries(branchMap);
            if (branchList.length === 0) {
              return (
                <div className="card" style={{ 
                  flex: 1,
                  padding: '5rem 2rem', 
                  textAlign: 'center', 
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--color-surface)',
                  borderRadius: '16px',
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid var(--color-border-light)'
                }}>
                  <Building2 size={48} color="var(--color-text-muted)" style={{ marginBottom: '1.5rem', opacity: 0.4 }} />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>
                    {t('Chưa có chi nhánh nào')}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '320px', margin: '0 auto' }}>
                    {t('Hãy liên kết các Nhóm (Team) vào các chi nhánh văn phòng tương ứng để hiển thị cấu trúc sơ đồ tổ chức tại đây.')}
                  </p>
                </div>
              );
            }

            const filteredBranches = selectedBranch
              ? branchList.filter(([bName]) => bName === selectedBranch)
              : branchList;

            return (
              <>
                {/* Branch Search Input */}
                <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '480px', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      placeholder={t('Tìm kiếm chi nhánh, nhóm...')}
                      value={branchSearchQuery}
                      onChange={e => setBranchSearchQuery(e.target.value)}
                      className="form-input"
                      style={{
                        paddingLeft: '12px',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        width: '100%',
                        height: '38px'
                      }}
                    />
                    {branchSearchQuery && (
                      <button
                        onClick={() => setBranchSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0
                        }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Branch Top Filter Chip Bar */}
                <div className="no-scrollbar" style={{
                  display: 'flex',
                  gap: '0.5rem',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                  width: '100%'
                }}>
                  {/* "Tất cả" Chip */}
                  <button
                    onClick={() => setSelectedBranch('')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '30px',
                      border: '1px solid ' + (selectedBranch === '' ? 'var(--color-primary)' : 'var(--color-border-light)'),
                      background: selectedBranch === '' ? 'rgba(189, 29, 45, 0.08)' : 'var(--color-surface)',
                      color: selectedBranch === '' ? 'var(--color-primary)' : 'var(--color-text-light)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Building2 size={14} />
                    {t('Tất cả')} ({teams.length})
                  </button>

                  {/* Individual Branch Chips */}
                  {branchList.map(([bName, bTeams]) => {
                    const isSelected = selectedBranch === bName;
                    return (
                      <button
                        key={bName}
                        onClick={() => setSelectedBranch(bName)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '30px',
                          border: '1px solid ' + (isSelected ? 'var(--color-primary)' : 'var(--color-border-light)'),
                          background: isSelected ? 'rgba(189, 29, 45, 0.08)' : 'var(--color-surface)',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-light)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <MapPin size={14} />
                        {bName} ({bTeams.length})
                      </button>
                    );
                  })}
                </div>

                {/* List of Branches with their respective teams */}
                {filteredBranches.map(([bName, bTeams]) => {
                  const totalM = bTeams.reduce((sum, team) => sum + Number(team.member_count), 0);
                  return (
                    <div 
                      key={bName} 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '1.25rem',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '20px',
                        padding: '1.5rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {/* Branch Header Row */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--color-border-light)',
                        paddingBottom: '1rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'rgba(189, 29, 45, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-primary)'
                          }}>
                            <Building2 size={18} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                              {bName}
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {t('Hệ thống quản lý')} {bTeams.length} {t('nhóm')} • {totalM} {t('nhân sự')}
                            </span>
                          </div>
                        </div>

                        {/* Stats pill on the right */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            background: 'var(--color-bg-light)',
                            border: '1px solid var(--color-border-light)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--color-text)'
                          }}>
                            {bTeams.length} {t('Nhóm')}
                          </span>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            background: 'var(--color-bg-light)',
                            border: '1px solid var(--color-border-light)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--color-text)'
                          }}>
                            {totalM} {t('Nhân sự')}
                          </span>
                        </div>
                      </div>

                      {/* Teams Grid */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
                        gap: '1.25rem' 
                      }}>
                        {bTeams.map(team => {
                          const leader = allSystemUsers.find(u => Number(u.id) === Number(team.leader_id));
                          const coLeaderIds = team.co_leader_ids ? (Array.isArray(team.co_leader_ids) ? team.co_leader_ids.map(String) : (typeof team.co_leader_ids === 'string' && team.co_leader_ids.startsWith('[') ? JSON.parse(team.co_leader_ids).map(String) : String(team.co_leader_ids).split(',').map((id: any) => id.trim()).filter(Boolean))) : [];
                          const coLeaders = coLeaderIds.map((id: string) => allSystemUsers.find(u => String(u.id) === id)).filter(Boolean);

                          return (
                            <div 
                              key={team.id} 
                              onClick={() => {
                                if (isWriteAuthorized) {
                                  openEditTeamModal(team);
                                }
                              }}
                              style={{ 
                                padding: '1.5rem', 
                                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'var(--color-bg-light)', 
                                borderRadius: '16px', 
                                border: '1px solid var(--color-border-light)', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '1rem',
                                cursor: isWriteAuthorized ? 'pointer' : 'default',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: 'var(--shadow-xs)',
                                position: 'relative',
                                overflow: 'hidden'
                              }}
                              className="hover-lift hover-shadow"
                            >
                              {/* Card Top Header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                <div style={{ textAlign: 'left' }}>
                                  <h4 style={{ 
                                    fontSize: '1rem', 
                                    color: 'var(--color-text)', 
                                    margin: 0,
                                    fontWeight: 800,
                                    lineHeight: 1.3
                                  }}>
                                    {team.name}
                                  </h4>
                                  <span style={{ 
                                    fontSize: '0.7rem', 
                                    color: 'var(--color-text-light)',
                                    display: 'block',
                                    marginTop: '2px'
                                  }}>
                                    {team.branch || t('Chưa thiết lập địa chỉ')}
                                  </span>
                                </div>
                                
                                <span style={{ 
                                  fontWeight: 800, 
                                  fontSize: '0.68rem', 
                                  padding: '4px 10px', 
                                  borderRadius: '20px', 
                                  flexShrink: 0,
                                  background: 'var(--color-primary-light)',
                                  color: 'var(--color-primary)',
                                  border: '1px solid rgba(189, 29, 45, 0.1)'
                                }}>
                                  {team.member_count} sales
                                </span>
                              </div>

                              {team.description && (
                                <p style={{ 
                                  margin: 0, 
                                  fontSize: '0.75rem', 
                                  color: 'var(--color-text-muted)', 
                                  fontStyle: 'italic', 
                                  display: '-webkit-box', 
                                  WebkitLineClamp: 2, 
                                  WebkitBoxOrient: 'vertical', 
                                  overflow: 'hidden', 
                                  lineHeight: 1.45, 
                                  textAlign: 'left',
                                  borderLeft: '2px solid var(--color-border)',
                                  paddingLeft: '8px'
                                }}>
                                  "{team.description}"
                                </p>
                              )}

                              {/* Leader & Co-leaders profile card */}
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '10px', 
                                background: 'var(--color-surface)', 
                                padding: '12px 14px', 
                                borderRadius: '14px', 
                                border: '1px solid var(--color-border-light)' 
                              }}>
                                {/* Manager section */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600 }}>{t('Trưởng nhóm')}:</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      {leader && (
                                        <Avatar src={leader.avatar_url || leader.avatar} name={team.leader_name} size={22} />
                                      )}
                                      {coLeaders.slice(0, 3).map((cl: any) => (
                                        <div key={cl.id} style={{ marginLeft: '-6px', border: '1.5px solid var(--color-surface)', borderRadius: '50%', overflow: 'hidden', display: 'flex' }}>
                                          <Avatar src={cl.avatar_url || cl.avatar} name={cl.full_name || cl.name} size={20} />
                                        </div>
                                      ))}
                                      {coLeaders.length > 3 && (
                                        <div style={{ 
                                          marginLeft: '-6px', 
                                          width: 20, 
                                          height: 20, 
                                          borderRadius: '50%', 
                                          background: 'var(--color-primary-light)', 
                                          color: 'var(--color-primary)', 
                                          fontSize: '0.625rem', 
                                          fontWeight: 800, 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center', 
                                          border: '1.5px solid var(--color-surface)' 
                                        }}>
                                          +{coLeaders.length - 3}
                                        </div>
                                      )}
                                    </div>
                                    <span style={{ color: 'var(--color-text)', fontWeight: 800, fontSize: '0.8rem' }}>
                                      {team.leader_name || t('Chưa gán')}
                                    </span>
                                  </div>
                                </div>

                                {/* KPI target row */}
                                {team.kpi_target && (
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    borderTop: '1px dashed var(--color-border)', 
                                    paddingTop: '8px', 
                                    marginTop: '4px' 
                                  }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 600 }}>{t('Chỉ tiêu Doanh thu')}:</span>
                                    <span style={{ 
                                      color: 'var(--color-primary)', 
                                      fontWeight: 900, 
                                      fontSize: '0.875rem',
                                      fontFamily: 'monospace'
                                    }}>
                                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(team.kpi_target)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}
      </div>

      <AccountDetailDrawer
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        account={editingUser}
        onSaveSuccess={fetchUsers}
        readOnly={!isWriteAuthorized}
      />


      {/* Inline style for modal animation */}
      <style>{`
        @keyframes slideUp {
          0% {
            opacity: 0;
            transform: translateY(30px);
          }
          60% {
            transform: translateY(-6px);
          }
          85% {
            transform: translateY(2px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Quick Message Modal */}
      {quickMessageOpen && quickMessageTarget && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setQuickMessageOpen(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 400, maxHeight: '90vh', display: 'flex', flexDirection: 'column', animation: 'modalSpring 0.4s cubic-bezier(0.34, 1.18, 0.64, 1) both' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src="https://stc-zpl.zdn.vn/favicon.ico" alt="Zalo" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                {t('Nhắn tin cho')} {quickMessageTarget.name}
              </h3>
              <button type="button" onClick={() => setQuickMessageOpen(false)} style={{ color: 'var(--color-text-muted)', padding: 4, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSendQuickMessage} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
                <div className="form-group">
                  <label className="form-label">{t('Nội dung tin nhắn')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <textarea
                    className="form-input"
                    placeholder={t('Nhập nội dung cần thông báo cho Sale...')}
                    value={quickMessageText}
                    onChange={e => setQuickMessageText(e.target.value)}
                    required
                    autoFocus
                    style={{ minHeight: 100, resize: 'vertical' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>{t('Tin nhắn sẽ được tự động gửi qua Zalo Bot (nếu có) và Email với tiêu đề [ TIN NHẮN TỪ QUẢN TRỊ VIÊN ]')}</p>
                </div>
              </div>
              <div style={{ padding: '1.25rem', background: theme === 'dark' ? 'var(--color-surface)' : 'var(--color-bg)', borderTop: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
                <button type="button" className="btn ghost" onClick={() => setQuickMessageOpen(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn primary" disabled={isSendingMsg} style={{ background: '#0068ff', borderColor: '#0068ff' }}>
                  {isSendingMsg ? t('Đang gửi...') : t('Gửi tin nhắn')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* Statistics Modal */}
      {statsModalOpen && statsConsultant && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop stats-modal-backdrop" onClick={() => setStatsModalOpen(false)} style={{ zIndex: 999999999 }}>
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 900,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              animation: 'modalSpring 0.4s cubic-bezier(0.34, 1.18, 0.64, 1) both'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="stats-header-container" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                <Avatar
                  src={statsConsultant.avatar}
                  name={statsConsultant.name}
                  size={44}
                  style={{
                    filter: (statsConsultant.status === 'inactive' || statsConsultant.status === 'leave' || Number(statsConsultant.vacation_mode) === 1) ? 'grayscale(1)' : 'none',
                    opacity: (statsConsultant.status === 'inactive' || statsConsultant.status === 'leave' || Number(statsConsultant.vacation_mode) === 1) ? 0.5 : 1
                  }}
                />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Báo cáo hiệu suất TVV')}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <strong>{statsConsultant.name}</strong> • ID: {statsConsultant.id} • <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}><img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png" alt="Gmail" style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0 }} /> {statsConsultant.email}</span>
                  </p>
                </div>
              </div>

              {/* Timeframe Filter Dropdown in Header */}
              <div className="stats-header-filters">
                <Calendar size={18} color="var(--color-text-light)" style={{ display: 'flex', alignItems: 'center' }} />
                <div style={{ position: 'relative', zIndex: 100 }}>
                  <CustomSelect
                    options={[
                      { value: 'this_month', label: t('Tháng này') },
                      { value: 'today', label: t('Hôm nay') },
                      { value: 'yesterday', label: t('Hôm qua') },
                      { value: '7_days', label: t('7 ngày qua') },
                      { value: '30_days', label: t('30 ngày qua') },
                      { value: 'last_month', label: t('Tháng trước') },
                      { value: 'all', label: t('Tất cả thời gian') },
                      { value: 'custom', label: t('Tự chọn ngày...') }
                    ]}
                    value={statsDateMode}
                    onChange={val => setStatsDateMode(String(val))}
                    width={180}
                  />
                </div>

                {statsDateMode === 'custom' && (
                  <div className="stats-custom-dates" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', animation: 'slideUp 0.15s ease-out', flexShrink: 0 }}>
                    <input
                      type="date"
                      className="form-input"
                      style={{ padding: '4px 10px', fontSize: '0.8125rem', height: 32, width: 130 }}
                      value={statsStartDate}
                      onChange={e => setStatsStartDate(e.target.value)}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('đến')}</span>
                    <input
                      type="date"
                      className="form-input"
                      style={{ padding: '4px 10px', fontSize: '0.8125rem', height: 32, width: 130 }}
                      value={statsEndDate}
                      onChange={e => setStatsEndDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.25rem 3rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
              {statsLoading && !statsData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1rem' }}>
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                  </div>
                  <ChartSkeleton height={260} />
                </div>
              ) : !statsData ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                  {t('Không có dữ liệu thống kê.')}
                </div>
              ) : (
                <>
                  {/* Subtle Loading overlay if reloading in background */}
                  {statsLoading && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--color-primary-light)', zIndex: 10, overflow: 'hidden' }}>
                      <div style={{ width: '30%', height: '100%', background: 'var(--color-primary)', borderRadius: 'inherit', animation: 'loadingBar 1.5s infinite ease-in-out' }} />
                    </div>
                  )}
                  <style>{`
                    @keyframes loadingBar {
                      0% { transform: translateX(-100%); }
                      100% { transform: translateX(330%); }
                    }
                  `}</style>

                  {/* Visual Breakdown explanation */}
                  <div style={{
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.6)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: 12,
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {t('Tổng data TVV này tiếp nhận:')} <strong style={{ fontSize: '1.05rem', color: 'var(--color-text)' }}>{statsData.summary.total_received || 0}</strong> lead
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        * {t('Các nhóm độc lập hoàn toàn, không cộng dồn/chồng chéo')}
                      </span>
                    </div>

                    {/* Stacked Percentage Bar */}
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--color-border-light)', position: 'relative' }}>
                      {((statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)) > 0 && (
                        <div
                          style={{
                            width: `${(((statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)) / Math.max(1, statsData.summary.total_received)) * 100}%`,
                            background: 'linear-gradient(90deg, #3b82f6, #007af5)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Được chia')}: ${(statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)}`}
                        />
                      )}
                      {(statsData.summary.databank_count || 0) > 0 && (
                        <div
                          style={{
                            width: `${((statsData.summary.databank_count || 0) / Math.max(1, statsData.summary.total_received)) * 100}%`,
                            background: 'linear-gradient(90deg, #34c759, #10b981)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Từ Databank')}: ${statsData.summary.databank_count}`}
                        />
                      )}
                      {(statsData.summary.self_count || 0) > 0 && (
                        <div
                          style={{
                            width: `${((statsData.summary.self_count || 0) / Math.max(1, statsData.summary.total_received)) * 100}%`,
                            background: 'linear-gradient(90deg, #fcd34d, #f59e0b)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Tự nhập')}: ${statsData.summary.self_count}`}
                        />
                      )}
                    </div>

                    {/* Legend explaining the numbers */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#007af5' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Được chia')}: <strong style={{ color: '#007af5' }}>{(statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)}</strong> ({statsData.summary.total_received > 0 ? Math.round((((statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)) / statsData.summary.total_received) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#34c759' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Từ Databank')}: <strong style={{ color: '#34c759' }}>{statsData.summary.databank_count || 0}</strong> ({statsData.summary.total_received > 0 ? Math.round(((statsData.summary.databank_count || 0) / statsData.summary.total_received) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Tự nhập')}: <strong style={{ color: '#f59e0b' }}>{statsData.summary.self_count || 0}</strong> ({statsData.summary.total_received > 0 ? Math.round(((statsData.summary.self_count || 0) / statsData.summary.total_received) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: 'auto', paddingLeft: '1rem', borderLeft: '1px solid var(--color-border)' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Nhắc lại')}: <strong style={{ color: 'var(--color-warning)' }}>{statsData.summary.reminder || 0}</strong> | {t('Lỗi/Trùng')}: <strong style={{ color: 'var(--color-danger)' }}>{statsData.summary.error_ticket_count || 0}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* KPI Cards Row (4 Columns) */}
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    {/* Card 1: Tổng data */}
                    <div className="stat-card hover-lift total-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px', borderRadius: '12px', border: '1px solid var(--color-border-light)', position: 'relative', overflow: 'hidden' }}>
                      <div className="decor-svg" style={{ color: '#a31422' }}>
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                          <circle cx="30" cy="50" r="10" stroke="currentColor" strokeWidth="2" />
                          <circle cx="70" cy="30" r="10" stroke="currentColor" strokeWidth="2" />
                          <circle cx="70" cy="70" r="10" stroke="currentColor" strokeWidth="2" />
                          <path d="M40 50 H 55 V 30 H 60 M 55 50 V 70 H 60" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Tổng data')}</span>
                        <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(163, 20, 34, 0.08)', color: '#a31422', flexShrink: 0 }}><Users size={16} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                          {statsData.summary.total_received || 0}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a31422', display: 'inline-block' }} />
                            {t('Tổng data đang chăm sóc')}: {statsData.summary.total_received || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Được chia */}
                    <div className="stat-card hover-lift distributed-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px', borderRadius: '12px', border: '1px solid var(--color-border-light)', position: 'relative', overflow: 'hidden' }}>
                      <div className="decor-svg" style={{ color: '#007af5' }}>
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                          <circle cx="45" cy="35" r="15" stroke="currentColor" strokeWidth="2" />
                          <path d="M20 75 C 20 60, 31 50, 45 50 C 59 50, 70 60, 70 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M75 35 H 89 M 82 28 V 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Được chia')}</span>
                        <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 122, 245, 0.08)', color: '#007af5', flexShrink: 0 }}><Send size={16} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                          {(statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#007af5', display: 'inline-block' }} />
                            {t('Chia tự động')}: {statsData.summary.distributed_count || 0}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
                            {t('Hợp tác (co.op)')}: {statsData.summary.coop_count || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Data cá nhân */}
                    <div className="stat-card hover-lift fair_share_equity-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px', borderRadius: '12px', border: '1px solid var(--color-border-light)', position: 'relative', overflow: 'hidden' }}>
                      <div className="decor-svg" style={{ color: '#34c759' }}>
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                          <rect x="20" y="20" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.6" />
                          <rect x="20" y="42" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.4" />
                          <rect x="20" y="64" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.2" />
                        </svg>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Data cá nhân')}</span>
                        <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(52, 199, 89, 0.08)', color: '#34c759', flexShrink: 0 }}><User size={16} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                          {(statsData.summary.self_count || 0) + (statsData.summary.databank_count || 0)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                            {t('Tự nhập')}: {statsData.summary.self_count || 0}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34c759', display: 'inline-block' }} />
                            {t('Claim từ Databank')}: {statsData.summary.databank_count || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Data lỗi & Ticket */}
                    <div className="stat-card hover-lift out_of_hours-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px', borderRadius: '12px', border: '1px solid var(--color-border-light)', position: 'relative', overflow: 'hidden' }}>
                      <div className="decor-svg" style={{ color: '#ef4444' }}>
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                          <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
                          <path d="M50 35 V 65 M35 50 H 65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Data lỗi & Ticket')}</span>
                        <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', flexShrink: 0 }}><AlertCircle size={16} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                          {statsData.summary.error_ticket_count || 0}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                            {t('Data lỗi / trùng')}: {statsData.summary.error_ticket_count || 0}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a31422', display: 'inline-block' }} />
                            {t('Số Ticket lỗi')}: {statsData.summary.error || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 1: Daily trend bar chart (Full Width) */}
                  <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', width: '100%' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Lưu lượng nhận Data theo Ngày')}</h4>
                    {statsData.by_date && statsData.by_date.length > 0 ? (
                      <div style={{ height: 180, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={statsData.by_date} margin={{ left: -10, right: 5, top: 20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="statsDateGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#e63946" stopOpacity={1} />
                                <stop offset="100%" stopColor="#a31422" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, (max: number) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                            <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                            <Bar dataKey="count" fill="url(#statsDateGradient)" radius={[4, 4, 0, 0]} maxBarSize={30} name={t("Data thành công")}>
                              <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text)', fontSize: 10, fontWeight: 700 }} offset={6} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                        {t('Không có dữ liệu phân bổ theo ngày')}
                      </div>
                    )}
                  </div>

                  {/* Row 2: Status Ratio (Donut) & Rounds Breakdown */}
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
                    {/* Donut chart for status ratio */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Tỷ lệ Trạng thái Data')}</h4>
                      {(() => {
                        const statusChartData = [
                          { name: t('Thành công'), value: statsData.summary.successful, color: '#a31422' },
                          { name: t('Nhắc lại'), value: statsData.summary.reminder, color: '#f59e0b' },
                          { name: t('Lỗi'), value: statsData.summary.error, color: '#ef4444' }
                        ].filter(item => item.value > 0);

                        return statsData.summary.total > 0 && statusChartData.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', justifyContent: 'center' }}>
                            <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={statusChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={35}
                                    outerRadius={55}
                                    paddingAngle={4}
                                    dataKey="value"
                                  >
                                    {statusChartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.75rem' }}>
                              {statusChartData.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                    {item.name}: <strong style={{ fontSize: '0.8125rem' }}>{item.value}</strong> ({Math.round(item.value / statsData.summary.total * 100)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2rem 0' }}>
                            {t('Không có dữ liệu lưu lượng')}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Rounds breakdown chart */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Phân bổ theo Vòng (Round)')}</h4>
                      {statsData.rounds.length > 0 ? (
                        <div style={{ height: 160, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={statsData.rounds} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-light)" />
                              <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis dataKey="round_name" type="category" width={90} tick={{ fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                              <Bar dataKey="successful_count" stackId="a" fill="#a31422" radius={[0, 0, 0, 0]} barSize={12} name={t("Thành công")} />
                              <Bar dataKey="reminder_count" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={12} name={t("Nhắc lại")} />
                              <Bar dataKey="error_count" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={12} name={t("Lỗi")} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2rem 0' }}>
                          {t('Không có dữ liệu chia số theo vòng')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Marketing Sources & Tickets Reports */}
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
                    {/* Source breakdown list */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Tỷ lệ Nguồn Data (Chi tiết)')}</h4>
                      {statsData.by_source && statsData.by_source.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto', paddingRight: 4 }}>
                          {statsData.by_source.map((src: any, idx: number) => {
                            const sourcePercent = statsData.summary.successful > 0
                              ? Math.round((src.count / statsData.summary.successful) * 100)
                              : 0;
                            return (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{src.source}</span>
                                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{src.count} {t('data')} ({sourcePercent}%)</span>
                                </div>
                                <div style={{ width: '100%', height: 4, background: 'var(--color-border-light)', borderRadius: 2 }}>
                                  <div style={{ width: `${sourcePercent}%`, height: '100%', background: '#BD1D2D', borderRadius: 2 }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '1.5rem 0' }}>
                          {t('Không có dữ liệu nguồn data')}
                        </div>
                      )}
                    </div>

                    {/* Tickets Reports statistics */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Thống kê Ticket báo lỗi Data')}</h4>
                      {statsData.tickets ? (
                        <>
                          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                            <div style={{ background: 'var(--color-bg)', padding: '6px', borderRadius: 8, border: '1px solid var(--color-border-light)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>{t('GỬI ĐI')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{statsData.tickets.total}</div>
                            </div>
                            <div style={{ background: 'var(--color-success-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-success)', fontWeight: 700 }}>{t('ĐÃ BÙ')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-success)', marginTop: 2 }}>{statsData.tickets.approved}</div>
                            </div>
                            <div style={{ background: 'var(--color-warning-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-warning)', fontWeight: 700 }}>{t('ĐANG CHỜ')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: 2 }}>{statsData.tickets.pending}</div>
                            </div>
                            <div style={{ background: 'var(--color-danger-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-danger)', fontWeight: 700 }}>{t('TỪ CHỐI')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: 2 }}>{statsData.tickets.rejected}</div>
                            </div>
                          </div>
                          <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', fontWeight: 500 }}>
                            {t('Tổng nhận bù:')} <strong style={{ color: 'var(--color-success)' }}>{statsData.tickets.approved + (statsData.active_compensation || 0) + (statsData.blacklist_compensation || 0)}</strong> {t('data')} (Ticket: {statsData.tickets.approved}, Blacklist: {statsData.blacklist_compensation || 0}, {t('Chủ động')}: {statsData.active_compensation || 0})
                          </div>
                          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                            <button
                              onClick={() => {
                                setStatsModalOpen(false);
                                navigate(`/fair-share?open_comp_id=${statsConsultant.id}&date_mode=${statsDateMode}`);
                              }}
                              className="btn outline sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', padding: '6px 12px', height: 'auto', borderRadius: 8 }}
                            >
                              <Scale size={13} /> {t('Xem chi tiết data bù')}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '1rem 0' }}>
                          {t('Không có dữ liệu ticket')}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.25rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
              <button type="button" className="btn primary sm" onClick={() => setStatsModalOpen(false)}>{t('Đóng')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t("Cảnh báo Xóa Tư vấn viên")}
        message={t("Bạn có chắc chắn muốn xóa tư vấn viên này không? CHÚ Ý: Nếu TVV này đã từng nhận Data, việc xóa sẽ làm hỏng báo cáo thống kê. Thay vào đó, bạn nên chuyển trạng thái của TVV sang 'Ngừng hoạt động' hoặc 'Nghỉ phép'.")}
        confirmText={t("Xóa vĩnh viễn")}
      />

      <ConfirmModal
        isOpen={unlinkConfirmOpen}
        onClose={() => setUnlinkConfirmOpen(false)}
        onConfirm={handleUnlinkZalo}
        title={t("Hủy liên kết Zalo Bot")}
        message={t("Bạn có chắc chắn muốn hủy liên kết Zalo của tư vấn viên này không? Hệ thống sẽ ngừng gửi data và mọi thông báo qua Zalo cho tài khoản này ngay lập tức.")}
        confirmText={t("Hủy liên kết")}
      />

      {/* Team Add/Edit Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {teamModalOpen && (
            <>
              {/* Backdrop */}
              <div
                className="drawer-backdrop"
                onClick={() => setTeamModalOpen(false)}
                style={{
                  zIndex: 1000,
                  opacity: 1,
                  pointerEvents: 'auto'
                }}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.3 }}
                className={styles.drawer}
                style={{
                  zIndex: 10600
                }}
              >
                {/* Header */}
                <div className={styles.header}>
                  <div className={styles.headerProfile}>
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '2px solid var(--color-border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: teamFormData.avatar_url ? 'transparent' : 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '1.25rem',
                      flexShrink: 0
                    }}>
                      {teamFormData.avatar_url ? (
                        <img src={teamFormData.avatar_url} alt="Team Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        teamFormData.name?.[0] || 'T'
                      )}
                    </div>
                    <div>
                      <h2 className={styles.title}>{teamFormData.name || t('Tên Nhóm')}</h2>
                      <p className={styles.subtitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={14} /> {t('Quy mô')}: {teamFormData.member_ids.length} sales · KPI: {teamFormData.kpi_target ? Number(teamFormData.kpi_target).toLocaleString('vi-VN') : '0'} VND
                      </p>
                    </div>
                  </div>
                  <div className={styles.headerActions} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isWriteAuthorized ? (
                      <button 
                        type="submit"
                        form="team-drawer-form"
                        className="btn primary sm" 
                        disabled={isSaving}
                        style={{ 
                          background: 'var(--color-primary)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 6,
                          padding: '6px 14px',
                          fontSize: '0.8rem',
                          height: '32px'
                        }}
                      >
                        {isSaving ? t('Đang lưu...') : t('Lưu thay đổi')}
                      </button>
                    ) : (
                      <button type="button" className="btn primary sm" onClick={() => setTeamModalOpen(false)}>
                        {t('Đóng')}
                      </button>
                    )}
                    <button type="button" className={styles.closeBtn} onClick={() => setTeamModalOpen(false)} style={{ marginLeft: '4px' }}><X size={20} /></button>
                  </div>
                </div>

                <form id="team-drawer-form" onSubmit={handleSaveTeam} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {/* Layout Split: Left Sidebar & Content */}
                  <div className={styles.drawerBody}>
                    
                    {/* Sidebar Tabs */}
                    <div className={styles.sidebarTabs}>
                      <button 
                        type="button" 
                        className={`${styles.sidebarTabBtn} ${teamDrawerTab === 'info' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setTeamDrawerTab('info')}
                      >
                        <Building2 size={16} /> {t('Thông tin')}
                      </button>
                      <button 
                        type="button" 
                        className={`${styles.sidebarTabBtn} ${teamDrawerTab === 'members' ? styles.sidebarTabActive : ''}`}
                        onClick={() => setTeamDrawerTab('members')}
                      >
                        <Users size={16} /> {t('Nhân sự')}
                      </button>
                      {editingTeam && (
                        <button 
                          type="button" 
                          className={`${styles.sidebarTabBtn} ${teamDrawerTab === 'comments' ? styles.sidebarTabActive : ''}`}
                          onClick={() => setTeamDrawerTab('comments')}
                        >
                          <MessageCircle size={16} /> {t('Bình luận')}
                        </button>
                      )}
                    </div>

                    {/* Content Area */}
                    <div className={styles.contentArea}>
                      
                      {/* TAB 1: THÔNG TIN CƠ BẢN */}
                      {teamDrawerTab === 'info' && (
                        <div className="card-panel animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem' }}>
                            <h4 className="panel-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Thông tin nhóm')}</h4>
                          </div>

                          <div className="grid grid-2" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem' }}>
                            {/* Avatar Nhóm Upload */}
                            <div className="form-group" style={{ gridColumn: 'span 2', textAlign: 'left' }}>
                              <label className="form-label" style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' }}>
                                {t('Avatar nhóm')}
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                  width: '54px',
                                  height: '54px',
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  border: '2px solid var(--color-border-light)',
                                  boxShadow: 'var(--shadow-sm)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: teamFormData.avatar_url ? 'transparent' : 'var(--color-primary-light, rgba(189, 29, 45, 0.1))',
                                  color: 'var(--color-primary)',
                                  flexShrink: 0
                                }}>
                                  {teamFormData.avatar_url ? (
                                    <img src={teamFormData.avatar_url} alt="Team Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <Avatar name={teamFormData.name || 'Team'} size={54} />
                                  )}
                                </div>
                                {isWriteAuthorized && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label
                                      className="btn sm outline"
                                      style={{
                                        borderRadius: '8px',
                                        padding: '6px 14px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: isUploadingTeamAvatar ? 'not-allowed' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        userSelect: 'none'
                                      }}
                                    >
                                      <Paperclip size={14} />
                                      {isUploadingTeamAvatar ? t('Đang xử lý...') : t('Tải ảnh avatar nhóm')}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleUploadTeamAvatar}
                                        disabled={isUploadingTeamAvatar}
                                        style={{ display: 'none' }}
                                      />
                                    </label>
                                    {teamFormData.avatar_url && (
                                      <button
                                        type="button"
                                        onClick={() => setTeamFormData(prev => ({ ...prev, avatar_url: '' }))}
                                        style={{
                                          background: 'transparent',
                                          color: 'var(--color-danger)',
                                          border: 'none',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          padding: 0,
                                          textAlign: 'left',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {t('Gỡ bỏ avatar')}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="form-group" style={{ gridColumn: 'span 2', textAlign: 'left' }}>
                              <label className="form-label" style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' }}>{t('Tên nhóm')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                              <input 
                                className="form-input"
                                value={teamFormData.name} 
                                onChange={e => setTeamFormData({ ...teamFormData, name: e.target.value })} 
                                required 
                                disabled={!isWriteAuthorized}
                                placeholder={t('Nhập tên nhóm...')}
                                style={{ width: '100%' }}
                              />
                            </div>

                            <div className="form-group" ref={leaderDropdownRef} style={{ position: 'relative', textAlign: 'left' }}>
                              <label className="form-label" style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' }}>{t('Manager')}</label>
                              
                              {/* Search Input Box */}
                              <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                                {(() => {
                                  const selectedLeader = allSystemUsers.find(u => String(u.id) === String(teamFormData.leader_id));
                                  if (!selectedLeader) return null;
                                  const leaderName = selectedLeader.full_name || selectedLeader.name || '';
                                  return (
                                    <div style={{ position: 'absolute', left: '10px', pointerEvents: 'none', display: 'flex', alignItems: 'center', zIndex: 2 }}>
                                      <Avatar src={selectedLeader.avatar_url || selectedLeader.avatar} name={leaderName} size={24} />
                                    </div>
                                  );
                                })()}
                                <input
                                  className={`form-input ${teamFormData.leader_id ? 'form-input-with-avatar' : ''}`}
                                  style={{ 
                                    background: 'var(--color-bg)', 
                                    border: '1px solid var(--color-border-light)', 
                                    width: '100%',
                                    paddingLeft: teamFormData.leader_id ? '42px' : '12px',
                                    paddingRight: '32px'
                                  }}
                                  placeholder={t("Tìm kiếm và chọn Manager...")}
                                  value={searchLeader}
                                  onChange={e => {
                                    if (!isWriteAuthorized) return;
                                    setSearchLeader(e.target.value);
                                    setShowLeaderDropdown(true);
                                    if (!e.target.value.trim()) {
                                      setTeamFormData({ ...teamFormData, leader_id: '' });
                                    }
                                  }}
                                  onFocus={() => isWriteAuthorized && setShowLeaderDropdown(true)}
                                  disabled={!isWriteAuthorized}
                                />
                                {isWriteAuthorized && teamFormData.leader_id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTeamFormData({ ...teamFormData, leader_id: '' });
                                      setSearchLeader('');
                                    }}
                                    style={{
                                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)',
                                      background: 'transparent', border: 'none', cursor: 'pointer', padding: 0
                                    }}
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>

                              {/* Dropdown Options */}
                              {showLeaderDropdown && (
                                <div style={{
                                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 1200,
                                  background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '8px',
                                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', maxHeight: 220, overflowY: 'auto'
                                }}>
                                  {allSystemUsers.filter(u => (u.full_name || u.name || '').toLowerCase().includes(searchLeader.toLowerCase())).map(u => {
                                    const uName = u.full_name || u.name || '';
                                    const isSelected = String(teamFormData.leader_id) === String(u.id);
                                    return (
                                      <div
                                        key={u.id}
                                        onClick={() => {
                                          setTeamFormData({ ...teamFormData, leader_id: String(u.id) });
                                          setSearchLeader(uName);
                                          setShowLeaderDropdown(false);
                                        }}
                                        style={{
                                          padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                                          cursor: 'pointer',
                                          background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                                          transition: 'background 0.1s'
                                        }}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-bg)'; }}
                                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                      >
                                        <Avatar src={u.avatar_url || u.avatar} name={uName} size={28} />
                                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                          <p style={{ fontSize: '0.8125rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uName}</p>
                                          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                                        </div>
                                        {isSelected && <Check size={16} color="var(--color-primary)" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Co-Managers */}
                            <div className="form-group" ref={coLeaderDropdownRef} style={{ position: 'relative', textAlign: 'left' }}>
                              <label className="form-label" style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' }}>
                                {t('Manager đồng hành (Co-Managers)')} ({teamFormData.co_leader_ids.length})
                              </label>
                              
                              {/* Selected tags */}
                              {teamFormData.co_leader_ids.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                                  {teamFormData.co_leader_ids.map(id => {
                                    const user = allSystemUsers.find(u => String(u.id) === String(id));
                                    if (!user) return null;
                                    const uName = user.full_name || user.name || '';
                                    return (
                                      <div 
                                        key={id} 
                                        style={{ 
                                          display: 'inline-flex', 
                                          alignItems: 'center', 
                                          gap: '4px', 
                                          background: 'rgba(189, 29, 45, 0.05)', 
                                          border: '1px solid rgba(189, 29, 45, 0.15)', 
                                          padding: '2px 8px 2px 4px', 
                                          borderRadius: '16px', 
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          color: 'var(--color-primary)'
                                        }}
                                      >
                                        <Avatar src={user.avatar_url || user.avatar} name={uName} size={16} />
                                        <span>{uName}</span>
                                        {isWriteAuthorized && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setTeamFormData({
                                                ...teamFormData,
                                                co_leader_ids: teamFormData.co_leader_ids.filter(cid => String(cid) !== String(id))
                                              });
                                            }}
                                            style={{
                                              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                                              color: 'var(--color-primary)', display: 'flex', alignItems: 'center', marginLeft: 2
                                            }}
                                          >
                                            <X size={12} />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <div style={{ position: 'relative', width: '100%' }}>
                                <input
                                  className="form-input"
                                  style={{ 
                                    background: 'var(--color-bg)', 
                                    border: '1px solid var(--color-border-light)', 
                                    width: '100%'
                                  }}
                                  placeholder={t("Chọn thêm Manager đồng hành...")}
                                  value={searchCoLeader}
                                  onChange={e => {
                                    if (!isWriteAuthorized) return;
                                    setSearchCoLeader(e.target.value);
                                    setShowCoLeaderDropdown(true);
                                  }}
                                  onFocus={() => isWriteAuthorized && setShowCoLeaderDropdown(true)}
                                  disabled={!isWriteAuthorized}
                                />
                              </div>

                              {showCoLeaderDropdown && (
                                <div style={{
                                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 1200,
                                  background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '8px',
                                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', maxHeight: 200, overflowY: 'auto'
                                }}>
                                  {allSystemUsers
                                    .filter(u => {
                                      const uName = u.full_name || u.name || '';
                                      const matchesSearch = uName.toLowerCase().includes(searchCoLeader.toLowerCase());
                                      const isPrimaryLeader = String(teamFormData.leader_id) === String(u.id);
                                      const isAlreadyCoLeader = teamFormData.co_leader_ids.some(cid => String(cid) === String(u.id));
                                      return matchesSearch && !isPrimaryLeader && !isAlreadyCoLeader;
                                    })
                                    .map(u => {
                                      const uName = u.full_name || u.name || '';
                                      return (
                                        <div
                                          key={u.id}
                                          onClick={() => {
                                            setTeamFormData({
                                              ...teamFormData,
                                              co_leader_ids: [...teamFormData.co_leader_ids, String(u.id)]
                                            });
                                            setSearchCoLeader('');
                                            setShowCoLeaderDropdown(false);
                                          }}
                                          style={{
                                            padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                                            cursor: 'pointer', transition: 'background 0.1s'
                                          }}
                                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg)'; }}
                                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                        >
                                          <Avatar src={u.avatar_url || u.avatar} name={uName} size={28} />
                                          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                            <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uName}</p>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              )}
                            </div>

                            <div className="form-group" style={{ textAlign: 'left' }}>
                              <label className="form-label" style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' }}>{t('Mục tiêu KPI (Doanh số)')}</label>
                              <input
                                type="number"
                                className="form-input"
                                value={teamFormData.kpi_target} 
                                onChange={e => setTeamFormData({ ...teamFormData, kpi_target: e.target.value })} 
                                disabled={!isWriteAuthorized}
                                placeholder="0"
                                style={{ width: '100%' }}
                              />
                            </div>

                            <div className="form-group" style={{ textAlign: 'left' }}>
                              <label className="form-label" style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' }}>{t('Số lượng thành viên tối đa')}</label>
                              <input 
                                type="number"
                                className="form-input"
                                value={teamFormData.max_members} 
                                onChange={e => setTeamFormData({ ...teamFormData, max_members: e.target.value })} 
                                disabled={!isWriteAuthorized}
                                min={1}
                                placeholder="10"
                                style={{ width: '100%' }}
                              />
                            </div>

                            <div className="form-group" style={{ gridColumn: 'span 2', textAlign: 'left' }}>
                              <label className="form-label" style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' }}>{t('Địa chỉ chi nhánh (Dùng để nhận diện Tỉnh/Thành chi nhánh)')}</label>
                              <AddressSelect
                                value={teamFormData.branch || ''}
                                onChange={val => setTeamFormData({ ...teamFormData, branch: val })}
                                disabled={!isWriteAuthorized}
                                placeholder={t('Chọn địa chỉ chi nhánh để phân loại tự động...')}
                              />
                            </div>

                            <div className="form-group" style={{ gridColumn: 'span 2', textAlign: 'left' }}>
                              <label className="form-label" style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' }}>
                                {t('Dự án trọng điểm')} ({teamFormData.focus_projects.length})
                              </label>
                              {teamFormData.focus_projects.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                                  {teamFormData.focus_projects.map(projName => (
                                    <span 
                                      key={projName} 
                                      style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.25rem', 
                                        background: 'var(--color-primary-light)', 
                                        color: 'var(--color-primary)', 
                                        padding: '2px 8px', 
                                        borderRadius: '12px', 
                                        fontSize: '0.75rem',
                                        fontWeight: 600
                                      }}
                                    >
                                      {projName}
                                      {isWriteAuthorized && (
                                        <button 
                                          type="button" 
                                          onClick={() => setTeamFormData({ ...teamFormData, focus_projects: teamFormData.focus_projects.filter(p => p !== projName) })}
                                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center' }}
                                        >
                                          <X size={12} />
                                        </button>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="custom-scrollbar" style={{ 
                                border: '1px solid var(--color-border-light)', 
                                borderRadius: '8px', 
                                maxHeight: '120px', 
                                overflowY: 'auto',
                                background: 'var(--color-bg)',
                                padding: '4px'
                              }}>
                                {projects.length === 0 ? (
                                  <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                    {t('Không có dự án nào trên hệ thống')}
                                  </div>
                                ) : (
                                  projects.map(p => {
                                    const isChecked = teamFormData.focus_projects.includes(p.name);
                                    return (
                                      <div
                                        key={p.id}
                                        onClick={() => {
                                          if (!isWriteAuthorized) return;
                                          const current = [...teamFormData.focus_projects];
                                          if (isChecked) {
                                            setTeamFormData({ ...teamFormData, focus_projects: current.filter(name => name !== p.name) });
                                          } else {
                                            setTeamFormData({ ...teamFormData, focus_projects: [...current, p.name] });
                                          }
                                        }}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.5rem',
                                          padding: '0.375rem 0.5rem',
                                          cursor: isWriteAuthorized ? 'pointer' : 'default',
                                          borderRadius: '4px',
                                          fontSize: '0.8125rem',
                                          background: isChecked ? 'rgba(163, 20, 34, 0.05)' : 'transparent'
                                        }}
                                        onMouseEnter={e => { if (!isChecked && isWriteAuthorized) e.currentTarget.style.background = 'var(--color-surface)'; }}
                                        onMouseLeave={e => { if (!isChecked && isWriteAuthorized) e.currentTarget.style.background = 'transparent'; }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {}}
                                          style={{ cursor: isWriteAuthorized ? 'pointer' : 'default' }}
                                          disabled={!isWriteAuthorized}
                                        />
                                        <span style={{ color: 'var(--color-text)', fontWeight: isChecked ? 600 : 400 }}>{p.name}</span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            <div className="form-group" style={{ gridColumn: 'span 2', textAlign: 'left' }}>
                              <label className="form-label" style={{ fontWeight: 650, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 6, display: 'block' }}>{t('Mô tả nhóm')}</label>
                              <textarea 
                                className="form-input"
                                value={teamFormData.description} 
                                onChange={e => setTeamFormData({ ...teamFormData, description: e.target.value })} 
                                disabled={!isWriteAuthorized}
                                placeholder={t('Mô tả ngắn gọn về nhóm...')}
                                rows={3}
                                style={{ width: '100%', resize: 'vertical' }}
                              />
                            </div>

                            {/* Leave team button if user is in team and not manager/admin */}
                            {!isWriteAuthorized && editingTeam && teamFormData.member_ids.includes(String(user?.id)) && (
                              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-start', marginTop: '1rem' }}>
                                <button 
                                  type="button" 
                                  className="btn outline"
                                  style={{ 
                                    color: 'var(--color-danger)', 
                                    borderColor: 'rgba(189, 29, 45, 0.3)', 
                                    background: 'rgba(189, 29, 45, 0.05)',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onClick={() => setConfirmLeaveTeamOpen(true)}
                                  disabled={isLeavingTeam}
                                >
                                  <UserX size={15} />
                                  {isLeavingTeam ? t('Đang rời nhóm...') : t('Rời khỏi nhóm')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* TAB 2: THÀNH VIÊN TRONG NHÓM */}
                      {teamDrawerTab === 'members' && (
                        <div className="card-panel animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem' }}>
                            <div>
                              <h4 className="panel-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                                {t('Thành viên nhóm')} ({teamFormData.member_ids.length})
                              </h4>
                              {teamFormData.max_members && (
                                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                                  {t('Giới hạn tối đa:')} {teamFormData.max_members} {t('nhân sự')}
                                </p>
                              )}
                            </div>

                            {/* Add Member Dropdown Trigger */}
                            {isWriteAuthorized && (
                              <div ref={addMemberDropdownRef} style={{ position: 'relative' }}>
                                <button
                                  type="button"
                                  onClick={() => setShowAddMemberDropdown(!showAddMemberDropdown)}
                                  className="btn primary sm"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 14px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    borderRadius: '8px',
                                    background: 'var(--color-primary)',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <span>+ {t('Thêm nhân sự')}</span>
                                </button>

                                {showAddMemberDropdown && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '6px',
                                    width: '320px',
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '12px',
                                    boxShadow: 'var(--shadow-lg)',
                                    zIndex: 1000,
                                    padding: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                  }}>
                                    <div style={{ position: 'relative' }}>
                                      <Search size={13} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                                      <input
                                        type="text"
                                        className="form-input"
                                        placeholder={t('Tìm nhân sự mới...')}
                                        value={memberSearch}
                                        onChange={e => setMemberSearch(e.target.value)}
                                        style={{ width: '100%', fontSize: '0.78rem', padding: '6px 28px 6px 10px', height: '32px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                      />
                                    </div>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }} className="custom-scrollbar">
                                      {(() => {
                                        const systemSales = allSystemUsers.filter(u => u.role === 'sales' || u.role === 'sale');
                                        const nonMembers = systemSales.filter(u => !teamFormData.member_ids.includes(String(u.id)));
                                        const filtered = nonMembers.filter(u => 
                                          (u.full_name || u.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
                                          (u.email || '').toLowerCase().includes(memberSearch.toLowerCase())
                                        );

                                        if (filtered.length === 0) {
                                          return (
                                            <div style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                              {t('Không có nhân sự khả dụng')}
                                            </div>
                                          );
                                        }

                                        return filtered.map(u => {
                                          const belongsToOtherTeam = u.team_id && String(u.team_id) !== String(editingTeam?.id);
                                          const otherTeam = teams.find(t => String(t.id) === String(u.team_id));
                                          
                                          return (
                                            <div
                                              key={u.id}
                                              onClick={() => {
                                                setTeamFormData(prev => ({
                                                  ...prev,
                                                  member_ids: [...prev.member_ids, String(u.id)]
                                                }));
                                                setShowAddMemberDropdown(false);
                                                setMemberSearch('');
                                                toast.success(`${t('Đã thêm')} ${u.full_name || u.name}`);
                                              }}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '6px 8px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                background: 'transparent',
                                                transition: 'background 0.15s'
                                              }}
                                              className="hover-bg-light"
                                            >
                                              <Avatar src={u.avatar_url || u.avatar} name={u.full_name || u.name || ''} size={22} />
                                              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  {u.full_name || u.name}
                                                </div>
                                                {belongsToOtherTeam && (
                                                  <div style={{ fontSize: '0.65rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                                                    {t('Nhóm hiện tại')}: {otherTeam ? otherTeam.name : 'Khác'}
                                                  </div>
                                                )}
                                              </div>
                                              <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 800 }}>+ Add</span>
                                            </div>
                                          );
                                        });
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Current Members List */}
                          <div style={{ 
                            border: '1px solid var(--color-border-light)', 
                            borderRadius: '8px', 
                            maxHeight: '350px', 
                            overflowY: 'auto',
                            background: 'var(--color-bg)',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '10px',
                            padding: '12px'
                          }}>
                            {(() => {
                              const currentMembers = allSystemUsers.filter(u => teamFormData.member_ids.includes(String(u.id)));

                              if (currentMembers.length === 0) {
                                return (
                                  <div style={{ gridColumn: '1 / -1', padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                                    {t('Nhóm hiện chưa có thành viên nào. Hãy nhấn nút "+ Thêm nhân sự" phía trên.')}
                                  </div>
                                );
                              }

                              return currentMembers.map(sale => {
                                return (
                                  <div
                                    key={sale.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.75rem',
                                      padding: '0.625rem 0.75rem',
                                      border: '1px solid var(--color-border-light)',
                                      borderRadius: '8px',
                                      background: 'var(--color-surface)',
                                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                                    }}
                                  >
                                    <Avatar src={sale.avatar_url || sale.avatar} name={sale.full_name || sale.name || ''} size={24} />
                                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {sale.full_name || sale.name}
                                      </p>
                                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {sale.email}
                                      </p>
                                    </div>
                                    
                                    {isWriteAuthorized && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTeamFormData(prev => ({
                                            ...prev,
                                            member_ids: prev.member_ids.filter(id => id !== String(sale.id))
                                          }));
                                          toast.success(`${t('Đã xóa')} ${sale.full_name || sale.name}`);
                                        }}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: 'var(--color-danger)',
                                          cursor: 'pointer',
                                          padding: '4px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          borderRadius: '4px'
                                        }}
                                        title={t('Xóa khỏi nhóm')}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      {/* TAB 3: THẢO LUẬN & BÌNH LUẬN NHÓM */}
                      {editingTeam && teamDrawerTab === 'comments' && (() => {
                        const rootComments = teamComments.filter((c: any) => !c.parent_id);
                        const getReplies = (parentId: number) => {
                          return teamComments
                            .filter((c: any) => Number(c.parent_id) === Number(parentId))
                            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                        };

                        const parseCommentAttachments = (bodyText: string) => {
                          const attachmentsList: {name: string, url: string}[] = [];
                          const cleanBodyLines: string[] = [];
                          const lines = (bodyText || '').split("\n");
                          
                          lines.forEach(line => {
                            const match = line.match(/^📎\s*\[(.*?)\]\((.*?)\)$/);
                            if (match) {
                              attachmentsList.push({ name: match[1], url: match[2] });
                            } else {
                              cleanBodyLines.push(line);
                            }
                          });
                          
                          return {
                            cleanBody: cleanBodyLines.join("\n").trim(),
                            attachments: attachmentsList
                          };
                        };

                        const getAttachmentIcon = (att: {name: string, url: string}) => {
                          const url = att.url.toLowerCase();
                          const name = att.name.toLowerCase();
                          
                          if (url.includes('drive.google.com') || url.includes('dropbox.com') || name.includes('folder') || name.includes('thư mục') || name.includes('kho')) {
                            return <Folder size={14} style={{ color: '#d97706' }} />;
                          }
                          if (url.startsWith('http') && !url.includes('/uploads/')) {
                            return <Link2 size={14} style={{ color: 'var(--color-primary)' }} />;
                          }
                          return <FileIcon size={14} style={{ color: '#2563eb' }} />;
                        };

                        const renderSingleCommentNode = (comment: any, isReply: boolean = false) => {
                          const { cleanBody, attachments: atts } = parseCommentAttachments(comment.body);
                          return (
                            <div key={comment.id} id={`team-comment-${comment.id}`} style={{ display: 'flex', gap: '8px', fontSize: '0.8125rem', paddingLeft: isReply ? '12px' : '0', borderLeft: isReply ? '2px solid var(--color-border-light)' : undefined, marginTop: isReply ? '6px' : '0' }}>
                              <Avatar name={comment.user_name || 'User'} src={comment.avatar_url || undefined} size={isReply ? 20 : 24} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: isReply ? 'transparent' : 'var(--color-bg-light)', border: isReply ? 'none' : '1px solid var(--color-border-light)', padding: isReply ? '2px 0' : '8px 12px', borderRadius: isReply ? '0' : '12px', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 800, color: 'var(--color-text)', textAlign: 'left' }}>{comment.user_name || 'Thành viên'}</span>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{comment.created_at ? new Date(comment.created_at).toLocaleString('vi-VN') : ''}</span>
                                </div>
                                <p style={{ margin: 0, color: 'var(--color-text-light)', whiteSpace: 'pre-wrap', lineHeight: '1.4', textAlign: 'left' }}>
                                  {cleanBody}
                                </p>
                                
                                {/* Attachments rendering */}
                                {atts.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                                    {atts.map((att, attIdx) => (
                                      <a 
                                        key={attIdx}
                                        href={att.url.startsWith('http') ? att.url : `${import.meta.env.VITE_API_URL || '/backend'}/${att.url}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '4px 10px',
                                          background: 'var(--color-surface)',
                                          border: '1px solid var(--color-border-light)',
                                          borderRadius: '6px',
                                          textDecoration: 'none',
                                          color: 'var(--color-primary)',
                                          fontSize: '0.75rem',
                                          fontWeight: 650
                                        }}
                                      >
                                        {getAttachmentIcon(att)}
                                        <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                                        <Download size={11} style={{ opacity: 0.6 }} />
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {!isReply && (
                                  <button
                                    type="button"
                                    onClick={() => setTeamReplyTo({ id: comment.id, userName: comment.user_name || 'Thành viên' })}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.7rem', padding: '4px 0 0 0', cursor: 'pointer', fontWeight: 700, textAlign: 'left', width: 'fit-content' }}
                                    className="hover-lift"
                                  >
                                    Phản hồi
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
                            
                            {/* Post Comment Section */}
                            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {teamReplyTo && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(163, 20, 34, 0.06)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                                  <span>Đang trả lời {teamReplyTo.userName}</span>
                                  <button type="button" onClick={() => setTeamReplyTo(null)} style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' }}>×</button>
                                </div>
                              )}
                              
                              <div style={{ position: 'relative' }}>
                                <MentionInput
                                  value={newTeamCommentText}
                                  onChange={e => setNewTeamCommentText(e.target.value)}
                                  onImagePaste={addLocalTeamCommentAttachment}
                                  onFilePaste={addLocalTeamCommentAttachment}
                                  placeholder="Nhập nội dung trao đổi... (Dán ảnh trực tiếp Ctrl+V)"
                                  style={{ minHeight: '65px', fontSize: '0.85rem', paddingRight: '40px' }}
                                  disabled={isSubmittingTeamComment || isUploadingCommentFile}
                                />
                                <label style={{ position: 'absolute', right: '10px', bottom: '10px', cursor: (isUploadingCommentFile || isSubmittingTeamComment) ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('Đính kèm tệp')}>
                                  <input type="file" onChange={handleAttachCommentFile} style={{ display: 'none' }} disabled={isUploadingCommentFile || isSubmittingTeamComment} />
                                  {isUploadingCommentFile ? <RefreshCw className="spin" size={18} /> : <Paperclip size={18} />}
                                </label>
                              </div>

                              {/* Attachments Preview Row */}
                              {teamCommentAttachments.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '4px 0' }}>
                                  {teamCommentAttachments.map((att: any, idx: number) => (
                                    <span 
                                      key={idx} 
                                      style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '4px', 
                                        background: 'var(--color-bg-light)', 
                                        border: '1px solid var(--color-border-light)', 
                                        padding: '2px 8px', 
                                        borderRadius: '6px', 
                                        fontSize: '0.72rem',
                                        fontWeight: 600
                                      }}
                                    >
                                      {att.previewUrl ? (
                                        <img src={att.previewUrl} alt="preview" style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover' }} />
                                      ) : (
                                        <Paperclip size={10} style={{ opacity: 0.6 }} />
                                      )}
                                      <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                                      <button 
                                        type="button" 
                                        onClick={() => removeTeamCommentAttachment(idx)}
                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '0.9rem', padding: '0 2px' }}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Toolbar Buttons */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', paddingTop: '10px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {/* File Upload Button */}
                                  <label 
                                    htmlFor="team-comment-file-input"
                                    style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      padding: '4px 10px', 
                                      borderRadius: '6px', 
                                      border: '1px solid var(--color-border-light)', 
                                      fontSize: '0.75rem', 
                                      cursor: 'pointer', 
                                      background: 'var(--color-bg-light)',
                                      color: 'var(--color-text-muted)',
                                      fontWeight: 600
                                    }}
                                    className="hover-lift"
                                  >
                                    <Paperclip size={12} />
                                    <span>{isUploadingCommentFile ? t('Đang tải...') : t('Đính kèm tệp')}</span>
                                  </label>
                                  <input 
                                    id="team-comment-file-input"
                                    type="file"
                                    onChange={handleAttachCommentFile}
                                    style={{ display: 'none' }}
                                    disabled={isUploadingCommentFile}
                                  />

                                  {/* Link Attach Button */}
                                  <button
                                    type="button"
                                    onClick={handleAttachCommentLink}
                                    style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      padding: '4px 10px', 
                                      borderRadius: '6px', 
                                      border: '1px solid var(--color-border-light)', 
                                      fontSize: '0.75rem', 
                                      cursor: 'pointer', 
                                      background: 'var(--color-bg-light)',
                                      color: 'var(--color-text-muted)',
                                      fontWeight: 600
                                    }}
                                    className="hover-lift"
                                  >
                                    <Link2 size={12} />
                                    <span>{t('Đính kèm Link')}</span>
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handlePostTeamComment(editingTeam.id)}
                                  disabled={isSubmittingTeamComment}
                                  className="btn primary sm"
                                  style={{ padding: '6px 16px', fontSize: '0.75rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Send size={11} />
                                  <span>{isSubmittingTeamComment ? t('Đang gửi...') : t('Gửi')}</span>
                                </button>
                              </div>
                            </div>

                            {/* Comments List Feed */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '16px', maxHeight: '350px' }} className="custom-scrollbar">
                              {loadingTeamComments ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                                  <RefreshCw className="spin" size={18} color="var(--color-text-muted)" />
                                </div>
                              ) : teamComments.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                  {t('Chưa có bình luận nào. Nhóm hãy bình luận trao đổi thông tin tại đây!')}
                                </div>
                              ) : (
                                rootComments.map((rootComment: any) => {
                                  const replies = getReplies(rootComment.id);
                                  return (
                                    <div key={rootComment.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {renderSingleCommentNode(rootComment, false)}
                                      {replies.length > 0 && (
                                        <div style={{ marginLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1px solid var(--color-border-light)', paddingLeft: '8px', marginTop: '4px' }}>
                                          {replies.map((reply: any) => renderSingleCommentNode(reply, true))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                          </div>
                        );
                      })()}

                    </div>
                  </div>
                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      <ConfirmModal
        isOpen={confirmDeleteTeamOpen}
        onClose={() => setConfirmDeleteTeamOpen(false)}
        onConfirm={handleDeleteTeam}
        title={t("Xóa Nhóm")}
        message={t("Bạn có chắc chắn muốn xóa nhóm này không? Các thành viên trong nhóm sẽ được đưa về trạng thái tự do (không thuộc nhóm nào).")}
        confirmText={t("Xóa nhóm")}
      />

      <ConfirmModal
        isOpen={confirmLeaveTeamOpen}
        onClose={() => setConfirmLeaveTeamOpen(false)}
        onConfirm={handleLeaveTeam}
        title={t("Rời khỏi nhóm")}
        message={t("Bạn có chắc chắn muốn rời khỏi nhóm này không? Bạn sẽ không còn thuộc nhóm này và hệ thống phân bổ data sẽ được cập nhật tương ứng.")}
        confirmText={t("Rời nhóm")}
      />

      {/* Consultants & Teams Guide Modal */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={t("Hướng dẫn thiết lập Cơ cấu Nhân sự & Nhóm (Team)")}
        width="760px"
      >
        <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '0.875rem 1rem', 
            background: 'var(--color-primary-light)', 
            border: '1px solid rgba(163, 20, 34, 0.15)', 
            borderRadius: 12 
          }}>
            <Info size={24} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              {t("Cơ cấu nhân sự là nền tảng để vận hành thuật toán phân chia data và kiểm soát hiệu suất. Hệ thống hỗ trợ quản lý 3 cấp độ:")}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Chi nhánh & Nhóm */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(59, 130, 246, 0.04)' : 'rgba(59, 130, 246, 0.02)', 
              borderLeft: '4px solid #3b82f6', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Building2 size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("1. Chi nhánh & Nhóm (Branches & Teams)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  • <strong>Chi nhánh (Branch)</strong>: Phân chia văn phòng làm việc vật lý (vd: Chi nhánh miền Nam, miền Bắc).<br />
                  • <strong>Nhóm (Team)</strong>: Các tổ chức bán hàng độc lập có Trưởng nhóm (Leader) phụ trách. Mỗi nhóm có thể cài đặt <strong>Dự án trọng điểm</strong> để phối hợp nhận lead tự động từ hệ thống khi có rule định tuyến khớp dự án đó.<br />
                  • <strong>Cơ chế tự động phân loại chi nhánh</strong>: Chi nhánh được liên kết tự động dựa trên Tỉnh/Thành phố được định cấu hình trong trường <strong>Địa chỉ chi nhánh</strong> của từng Nhóm. Để điều chỉnh chi nhánh hoặc cập nhật Trưởng nhóm, quản trị viên chỉ cần nhấp trực tiếp vào thẻ Nhóm tương ứng ở tab Nhóm (Team) hoặc tab Chi nhánh để mở form cấu hình.
                </p>
              </div>
            </div>

            {/* Trạng thái hoạt động */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.02)', 
              borderLeft: '4px solid #10b981', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Users size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("2. Quản lý TVV & Chế độ Nghỉ phép (Vacation Mode)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  • <strong>Tài khoản TVV</strong>: Cấu hình ca làm việc, thời gian hoạt động và quyền hạn.<br />
                  • <strong>Chế độ nghỉ phép (Vacation Mode)</strong>: Khi bật chế độ này cho một TVV, hệ thống sẽ <strong>tạm thời bỏ qua (bypass)</strong> TVV đó trong hàng đợi chia số của vòng phân bổ (Round-Robin). Lead sẽ tự động chuyển sang người tiếp theo để tránh trễ hạn phản hồi khách hàng.
                </p>
              </div>
            </div>

            {/* Chỉ tiêu KPI */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: theme === 'dark' ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.02)', 
              borderLeft: '4px solid #f59e0b', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <TrendingUp size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("3. Thiết lập KPI & Giới hạn thành viên (KPI Targets & Capacity)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  • <strong>KPI Target</strong>: Thiết lập mục tiêu doanh số của nhóm dùng cho các báo cáo so sánh hiệu suất nhóm.<br />
                  • <strong>Max Members</strong>: Giới hạn số lượng nhân sự tối đa trong nhóm để kiểm soát quy mô và hiệu quả quản trị của Trưởng nhóm.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowInfoModal(false)} style={{ minWidth: 100 }}>{t("Đồng ý")}</button>
        </div>
      </CustomModal>

      {/* Zalo Bot Connect Modal */}
      {isZaloModalOpen && (
      <CustomModal
          isOpen={isZaloModalOpen}
          onClose={() => setIsZaloModalOpen(false)}
          title="Kết Nối Zalo Bot Nhận Thông Báo"
          width={640}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '6px 2px' }}>
            {/* Header banner */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '14px 16px',
              borderRadius: '12px'
            }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0068ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src="https://stc-zpl.zdn.vn/favicon.ico" style={{ width: 22, height: 22 }} alt="Zalo" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e3a8a' }}>
                  Xác Thực Tài Khoản Zalo Cá Nhân
                </div>
                <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: 2 }}>
                  Gửi mã kết nối bên dưới đến Zalo Bot để hoàn tất liên kết
                </div>
              </div>
            </div>

            {/* 2-column layout */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>

              {/* Left: Steps */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Bước 1 */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0068ff', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>1</span>
                    Nhấn liên kết mở Zalo Bot:
                  </div>
                  <a
                    href={zaloBotLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 18px',
                      background: '#0068ff',
                      color: 'white',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      textDecoration: 'none',
                      boxShadow: '0 3px 8px rgba(0,104,255,0.25)'
                    }}
                  >
                    Mở Zalo Bot Trực Tiếp <ExternalLink size={14} />
                  </a>
                </div>

                {/* Bước 2 */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0068ff', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>2</span>
                    Gửi mã kết nối cho Zalo Bot:
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      flex: 1,
                      background: '#0f172a',
                      color: '#38bdf8',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      letterSpacing: '1px',
                      textAlign: 'center',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                      {user?.id}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const code = `CONNECT ${user?.id || ''}`;
                        navigator.clipboard.writeText(code);
                        setCopiedCode(true);
                        toast.success('Đã sao chép mã kết nối Zalo Bot!');
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      style={{
                        padding: '10px 16px',
                        background: copiedCode ? '#16a34a' : '#0068ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                        transition: 'all 0.2s'
                      }}
                    >
                      {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                      {copiedCode ? 'Đã sao chép' : 'Sao chép mã'}
                    </button>
                  </div>
                </div>

              </div>

              {/* Right: QR Code */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                minWidth: 160
              }}>
                <div style={{
                  background: '#fff',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {zaloBotLink ? (
                    <QRCodeCanvas
                      value={zaloBotLink}
                      size={120}
                      level="H"
                      includeMargin={false}
                    />
                  ) : (
                    <div style={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                      <Smartphone size={40} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                  <Smartphone size={13} /> Quét bằng điện thoại
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', textAlign: 'center', lineHeight: 1.4 }}>
                  Mở camera để quét &amp; chat trực tiếp
                </div>
              </div>

            </div>

            <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: 2 }}>
              ✨ Ngay khi nhắn mã thành công, Zalo Bot sẽ tự động phản hồi xác nhận liên kết tài khoản của bạn!
            </div>
          </div>
        </CustomModal>
      )}
    </div>
  );
};

export const Consultants = withRouterFreezer(ConsultantsInner, '/consultants');
