import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { withRouterFreezer } from '../components/RouterFreezer';
import { Users, Plus, Trash2, Mail, MessageCircle, Shield, UserX, Clock, X, Link2Off, User, Send, Check, RefreshCw, BarChart2, Calendar, Scale, Eye, CheckCircle, AlertTriangle, Building2, ChevronLeft, ChevronRight, Search, Phone, Info, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Avatar } from '../components/ui/Avatar';
import { fetchAPI } from '../utils/api';
import { AccountDetailDrawer } from '../components/AccountDetailDrawer';
import { compressToWebP } from '../utils/imageCompress';
import { TableRowSkeleton, KpiCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { CustomSelect } from '../components/ui/CustomSelect';
import { AddressSelect } from '../components/ui/AddressSelect';
import cityData from '../assets/ctiy.json';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LabelList
} from 'recharts';

interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'inactive';
  telegram_id: string | null;
  zalo_chat_id: string | null;
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

  const [teams, setTeams] = useState<any[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    branch: '',
    leader_id: '',
    description: '',
    kpi_target: '',
    max_members: '',
    focus_projects: [] as string[],
    member_ids: [] as string[]
  });
  const [searchLeader, setSearchLeader] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [showLeaderDropdown, setShowLeaderDropdown] = useState(false);
  const leaderDropdownRef = useRef<HTMLDivElement>(null);
  const [confirmDeleteTeamOpen, setConfirmDeleteTeamOpen] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<number | null>(null);
  
  const [consultantsPage, setConsultantsPage] = useState(1);
  const [teamsPage, setTeamsPage] = useState(1);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const ITEMS_PER_PAGE = 8;

  const [scheduleMode, setScheduleMode] = useState<'daily' | 'custom'>('daily');
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    status: string;
    leave_start: string;
    leave_end: string;
    zalo_chat_id: string;
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
      if (json && Array.isArray(json)) setProjects(json);
    } catch (e: any) {
      console.error('Failed to fetch projects:', e);
    }
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
      branch: '',
      leader_id: '',
      description: '',
      kpi_target: '',
      max_members: '',
      focus_projects: [],
      member_ids: []
    });
    setSearchLeader('');
    setShowLeaderDropdown(false);
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
        setTeamFormData({
          name: data.name,
          branch: data.branch || '',
          leader_id: data.leader_id || '',
          description: data.description || '',
          kpi_target: data.kpi_target !== null && data.kpi_target !== undefined ? String(data.kpi_target) : '',
          max_members: data.max_members !== null && data.max_members !== undefined ? String(data.max_members) : '',
          focus_projects: focusProjects,
          member_ids: memberIds
        });
        const leaderUser = allSystemUsers.find(u => Number(u.id) === Number(data.leader_id));
        setSearchLeader(leaderUser ? (leaderUser.full_name || leaderUser.name) : '');
        setShowLeaderDropdown(false);
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
        branch: teamFormData.branch,
        leader_id: teamFormData.leader_id,
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
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
            </button>
          </h1>
          <p className="page-subtitle">
            {activeTab === 'teams'
              ? t('Danh sách nhóm phân chia công việc và chỉ tiêu dự án')
              : activeTab === 'branches'
              ? t('Cơ cấu chi nhánh văn phòng của công ty')
              : t('Danh sách nhân sự tiếp nhận và xử lý data từ hệ thống')}
          </p>
        </div>
        {isWriteAuthorized && activeTab === 'teams' ? (
          <button onClick={openAddTeamModal} className="btn primary responsive-btn-full">
            <Plus size={16} /> {t('Thêm Nhóm')}
          </button>
        ) : activeTab === 'branches' ? null : isWriteAuthorized ? (
          <button onClick={openAddModal} className="btn primary responsive-btn-full">
            <Plus size={16} /> {t('Thêm TVV')}
          </button>
        ) : null}
      </div>

      {/* Tab bar */}
      {showAllTabs && (
        <div className="segmented-control-wrapper" style={{ marginBottom: '1.5rem' }}>
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
              width: '160px',
              borderRadius: '6px',
              background: 'var(--color-surface)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: `translateX(${
                activeTab === 'consultants' ? '0px' : 
                activeTab === 'teams' ? '162px' : '324px'
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
                    width: '160px',
                    height: '32px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.85rem',
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
                  className=""
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Panels with Enter Animation */}
      <div key={activeTab} className="subtab-enter-active" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Summary Cards */}
        {activeTab === 'consultants' && (
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="stat-card hover-lift">
            <div className="stat-label">{t('Tổng TVV')}</div>
            <div className="stat-value">{users.length}</div>
          </div>
          <div className="stat-card hover-lift">
            <div className="stat-label" style={{ color: 'var(--color-success)' }}>{t('Đang nhận Data')}</div>
            <div className="stat-value" style={{ color: 'var(--color-success)' }}>{activeCount}</div>
          </div>
          <div className="stat-card hover-lift">
            <div className="stat-label" style={{ color: 'var(--color-warning)' }}>{t('Đang nghỉ phép')}</div>
            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{leaveCount}</div>
          </div>
          <div className="stat-card hover-lift">
            <div className="stat-label" style={{ color: 'var(--color-danger)' }}>{t('Ngừng hoạt động')}</div>
            <div className="stat-value" style={{ color: 'var(--color-danger)' }}>{inactiveCount}</div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'consultants' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-surface)',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
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
                  width: '100%'
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
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {t('Tổng số')}: <strong style={{ color: 'var(--color-text)' }}>{filteredUsers.length}</strong> / {users.length} {t('tư vấn viên')}
            </div>
          </div>
          <div className="table-wrap mobile-card-table custom-scrollbar" style={{ border: 'none', borderRadius: 0, maxHeight: '480px', overflowY: 'auto' }}>
            <table className="mobile-table-compact">
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>{t('Tên TVV')}</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>{t('Thông tin liên hệ')}</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>{t('Nhóm (Team)')}</th>
                  <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10, borderBottom: '1px solid var(--color-border)' }}>{t('Zalo Bot')}</th>
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
                    className={`group ${isWriteAuthorized ? 'table-row-hover' : ''}`}
                    style={{ cursor: isWriteAuthorized ? 'pointer' : 'default' }}
                    onClick={() => isWriteAuthorized && openEditModal(u)}
                    title={isWriteAuthorized ? t("Nhấp để chỉnh sửa thông tin") : undefined}
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
                    <td data-label={t('Nhóm (Team)')} style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--color-text)' }}>
                      {u.team_name ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.team_name}</div>
                          {u.team_branch && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{u.team_branch}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td data-label={t('Zalo Bot')}>
                      {u.zalo_chat_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 10px', borderRadius: 20,
                            background: '#e5f0ff', color: '#0068ff', fontSize: '0.75rem', fontWeight: 600
                          }}>
                            <img src="https://stc-zpl.zdn.vn/favicon.ico" alt="Zalo" style={{ width: 14, height: 14, borderRadius: '2px' }} /> {t('Đã liên kết')}
                          </span>
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
                          {u.email && u.email.toLowerCase() !== user?.email?.toLowerCase() && (
                            zaloRemindedId === u.id ? (
                              <span style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                                <Check size={12} /> {t('Đã nhắc')}
                              </span>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); handleResendZaloVerify(u.id); }} className="btn ghost" style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }} title={t("Gửi email nhắc xác thực Zalo")} disabled={zaloRemindingId === u.id}>
                                {zaloRemindingId === u.id ? <RefreshCw size={12} className="spin" /> : <Send size={12} />} {zaloRemindingId === u.id ? t('Đang gửi...') : t('Nhắc')}
                              </button>
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
                    {!isSale && (
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', padding: '0.25rem' }}>
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
                      padding: '1.5rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '1.25rem',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '16px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: 'var(--color-surface)',
                      boxShadow: 'var(--shadow-sm)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Top line indicator */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, var(--color-primary), #3b82f6)' }} />

                    {/* Card Header: Title & Member Count */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-text)', lineHeight: 1.3 }}>{team.name}</h3>
                        {team.branch && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Building2 size={12} /> {team.branch}
                          </span>
                        )}
                      </div>
                      <span className="badge info" style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '12px', fontWeight: 700, flexShrink: 0 }}>
                        {team.member_count} {t('nhành viên')}
                      </span>
                    </div>

                    {/* Slogan / Description */}
                    {team.description ? (
                      <p style={{ 
                        fontSize: '0.8125rem', 
                        color: 'var(--color-text-light)', 
                        fontStyle: 'italic', 
                        lineHeight: 1.4,
                        margin: 0,
                        background: 'var(--color-bg)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        borderLeft: '3px solid var(--color-primary)'
                      }}>
                        "{team.description}"
                      </p>
                    ) : (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0, fontStyle: 'italic' }}>
                        {t('Chưa có mô tả nhóm / Slogan...')}
                      </p>
                    )}

                    {/* Team Details Grid: Leader / Focus project / KPI */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px dashed var(--color-border-light)', paddingTop: '1rem', marginTop: 'auto' }}>
                      {/* Leader info */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{t('Trưởng nhóm')}:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {team.leader_name ? (
                            <>
                              <Avatar src={leader?.avatar_url || leader?.avatar} name={team.leader_name} size={18} />
                              <strong style={{ color: 'var(--color-text)', fontWeight: 700 }}>{team.leader_name}</strong>
                            </>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('Chưa gán')}</span>
                          )}
                        </div>
                      </div>

                      {/* Focus project info */}
                      {team.focus_project && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{t('Dự án trọng điểm')}:</span>
                          <span className="badge success" style={{ fontWeight: 700, fontSize: '0.75rem' }}>{team.focus_project}</span>
                        </div>
                      )}

                      {/* KPI Target */}
                      {team.kpi_target !== null && team.kpi_target !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{t('KPI doanh thu tháng')}:</span>
                          <strong style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(team.kpi_target)}
                          </strong>
                        </div>
                      )}
                    </div>

                    {/* Actions (If admin) */}
                    {isWriteAuthorized && (
                      <div 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'flex-end', 
                          gap: '0.5rem', 
                          borderTop: '1px solid var(--color-border-light)', 
                          paddingTop: '1rem', 
                          marginTop: '0.25rem' 
                        }} 
                        onClick={e => e.stopPropagation()}
                      >
                        <button 
                          className="btn sm outline" 
                          onClick={() => openEditTeamModal(team)}
                          style={{ borderRadius: '8px', fontWeight: 700 }}
                        >
                          {t('Sửa')}
                        </button>
                        <button
                          className="btn sm"
                          style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: 'none', borderRadius: '8px', fontWeight: 700 }}
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
        <div style={{ display: 'flex', gap: '1.5rem', width: '100%', minHeight: '500px', alignItems: 'stretch' }}>
          {(() => {
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

            // Determine active selected branch
            const activeBName = selectedBranch && branchMap[selectedBranch] ? selectedBranch : branchList[0][0];
            const activeBTeams = branchMap[activeBName] || [];
            const activeBTotalMembers = activeBTeams.reduce((sum, tObj) => sum + Number(tObj.member_count), 0);

            return (
              <>
                {/* Left Side: Master Branch List */}
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Danh sách chi nhánh ({branchList.length})</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', maxHeight: '70vh' }}>
                    {branchList.map(([bName, bTeams]) => {
                      const totalM = bTeams.reduce((sum, team) => sum + Number(team.member_count), 0);
                      const isSelected = activeBName === bName;
                      return (
                        <div
                          key={bName}
                          onClick={() => setSelectedBranch(bName)}
                          style={{
                            padding: '1rem',
                            borderRadius: '12px',
                            border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                            background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <Building2 size={16} color={isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                            <strong style={{ fontSize: '0.875rem', color: isSelected ? 'var(--color-primary)' : 'var(--color-text)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {bName}
                            </strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            <span>{bTeams.length} nhóm</span>
                            <span>•</span>
                            <span>{totalM} nhân sự</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side: Detailed Teams Grid */}
                <div className="card" style={{ flex: 1, padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{activeBName}</h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>Tổng cộng {activeBTeams.length} nhóm và {activeBTotalMembers} nhân sự phân phối</p>
                    </div>
                  </div>

                  {/* Branch Config/Setting Info Banner */}
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--color-primary-light)',
                    border: '1px solid rgba(189, 29, 45, 0.15)',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    color: 'var(--color-primary)',
                    lineHeight: '1.45',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>💡</span>
                    <div>
                      <strong>Cơ chế tự động:</strong> Chi nhánh được phân loại tự động dựa trên tỉnh/thành phố trong phần <strong>Địa chỉ chi nhánh</strong> của từng Nhóm.
                      {isWriteAuthorized ? (
                        <span> Để đổi chi nhánh hoặc cập nhật Trưởng nhóm, bạn chỉ cần <strong>nhấp vào thẻ Nhóm bên dưới</strong> để chỉnh sửa.</span>
                      ) : (
                        <span> Vui lòng liên hệ Admin/Manager để cập nhật thông tin địa chỉ hoặc trưởng nhóm.</span>
                      )}
                    </div>
                  </div>

                  <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', paddingRight: '4px', alignContent: 'start' }}>
                    {activeBTeams.map(team => (
                      <div 
                        key={team.id} 
                        onClick={() => {
                          if (isWriteAuthorized) {
                            openEditTeamModal(team);
                          }
                        }}
                        style={{ 
                          padding: '1rem', 
                          background: 'var(--color-bg)', 
                          borderRadius: '12px', 
                          border: '1px solid var(--color-border-light)', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          justifyContent: 'space-between', 
                          gap: '0.75rem',
                          cursor: isWriteAuthorized ? 'pointer' : 'default',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border-light)'}
                      >
                        <div>
                          <strong style={{ fontSize: '0.875rem', color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>{team.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            Manager: <strong style={{ color: 'var(--color-text)' }}>{team.leader_name || 'Chưa gán'}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dotted var(--color-border)', paddingTop: '0.5rem', fontSize: '0.75rem' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Quy mô:</span>
                          <span className="badge info" style={{ fontWeight: 700 }}>{team.member_count} sales</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                <MessageCircle size={20} fill="#0068ff" color="white" />
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
        <div className="overlay-backdrop" onClick={() => setStatsModalOpen(false)}>
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
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
              {statsLoading && !statsData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
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
                        {t('Tổng data hệ thống tiếp nhận cho TVV này:')} <strong style={{ fontSize: '1.05rem', color: 'var(--color-text)' }}>{statsData.summary.total}</strong> lead
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        * {t('Các nhóm độc lập hoàn toàn, không cộng dồn/chồng chéo')}
                      </span>
                    </div>

                    {/* Stacked Percentage Bar */}
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--color-border-light)', position: 'relative' }}>
                      {statsData.summary.successful > 0 && (
                        <div
                          style={{
                            width: `${(statsData.summary.successful / Math.max(1, statsData.summary.total)) * 100}%`,
                            background: 'linear-gradient(90deg, #a78bfa, #a31422)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Thành công')}: ${statsData.summary.successful}`}
                        />
                      )}
                      {(statsData.summary.reminder || 0) > 0 && (
                        <div
                          style={{
                            width: `${((statsData.summary.reminder || 0) / Math.max(1, statsData.summary.total)) * 100}%`,
                            background: 'linear-gradient(90deg, #fcd34d, #f59e0b)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Nhắc lại')}: ${statsData.summary.reminder}`}
                        />
                      )}
                      {(statsData.summary.error || 0) > 0 && (
                        <div
                          style={{
                            width: `${((statsData.summary.error || 0) / Math.max(1, statsData.summary.total)) * 100}%`,
                            background: 'linear-gradient(90deg, #fca5a5, #ef4444)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Lỗi')}: ${statsData.summary.error}`}
                        />
                      )}
                    </div>

                    {/* Legend explaining the numbers */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Thành công (Bàn giao thực tế)')}: <strong style={{ color: 'var(--color-primary)' }}>{statsData.summary.successful}</strong> ({statsData.summary.total > 0 ? Math.round((statsData.summary.successful / statsData.summary.total) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Nhắc lại (Khách cũ gọi lại)')}: <strong style={{ color: 'var(--color-warning)' }}>{statsData.summary.reminder || 0}</strong> ({statsData.summary.total > 0 ? Math.round(((statsData.summary.reminder || 0) / statsData.summary.total) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--color-danger)' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Lỗi / Trùng (Đã lọc bỏ)')}: <strong style={{ color: 'var(--color-danger)' }}>{statsData.summary.error || 0}</strong> ({statsData.summary.total > 0 ? Math.round(((statsData.summary.error || 0) / statsData.summary.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* KPI Cards Row (4 Columns) */}
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    <div className="stat-card hover-lift" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Thành công')}</span>
                        <div className="stat-icon" style={{ color: 'var(--color-primary)', opacity: 0.8 }}><CheckCircle size={18} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)' }}>
                          {statsData.summary.successful}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>{t('Data gán mới thành công')}</div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: 2 }}>{t('(Không bao gồm Nhắc lại & Lỗi)')}</div>
                      </div>
                    </div>

                    <div className="stat-card hover-lift" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Nhắc lại')}</span>
                        <div className="stat-icon" style={{ color: 'var(--color-warning)', opacity: 0.8 }}><Clock size={18} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)' }}>
                          {statsData.summary.reminder || 0}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>{t('Yêu cầu gọi lại')}</div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-warning)', fontWeight: 600, marginTop: 2 }}>{t('(Tính riêng biệt, không cộng dồn)')}</div>
                      </div>
                    </div>

                    <div className="stat-card hover-lift" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Lỗi')}</span>
                        <div className="stat-icon" style={{ color: 'var(--color-danger)', opacity: 0.8 }}><AlertTriangle size={18} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)' }}>
                          {statsData.summary.error || 0}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>{t('Trùng lặp / Lỗi chia')}</div>
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-danger)', fontWeight: 600, marginTop: 2 }}>{t('(Đã loại bỏ khỏi Thành công)')}</div>
                      </div>
                    </div>

                    <div className="stat-card hover-lift" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Tỷ lệ')}</span>
                        <div className="stat-icon" style={{ color: 'var(--color-success)', opacity: 0.8 }}><BarChart2 size={18} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)' }}>
                          {statsData.summary.system_total_successful > 0
                            ? Math.round((statsData.summary.successful / statsData.summary.system_total_successful) * 100)
                            : 0}%
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>{t('Thành công / Tổng của tất cả saleperson')}</div>
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
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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
                          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
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
      {teamModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setTeamModalOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1100 }}>
          <div
            className="card"
            style={{ width: '100%', maxWidth: 960, maxHeight: '92vh', display: 'flex', flexDirection: 'column', animation: 'modalSpring 0.4s cubic-bezier(0.34, 1.18, 0.64, 1) both', margin: 'auto', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                {editingTeam ? (isWriteAuthorized ? t('Cập nhật Nhóm (Team)') : t('Chi tiết Nhóm (Team)')) : t('Thêm Nhóm mới')}
              </h3>
              <button type="button" onClick={() => setTeamModalOpen(false)} style={{ color: 'var(--color-text-muted)', padding: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

                  {/* Cột 1: Thông tin cơ bản & Quản trị */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>{t('Tên Nhóm')} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <input
                        className="form-input"
                        placeholder={t('VD: Team Chiến Binh')}
                        value={teamFormData.name}
                        onChange={e => setTeamFormData({ ...teamFormData, name: e.target.value })}
                        required
                        autoFocus
                        disabled={!isWriteAuthorized}
                      />
                    </div>

                    <div className="form-group" ref={leaderDropdownRef} style={{ position: 'relative' }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>{t('Manager')}</label>
                      
                      {/* Search Input Box */}
                      <div style={{ position: 'relative', width: '100%' }}>
                        <input
                          className="form-input"
                          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', width: '100%' }}
                          placeholder={t("Tìm kiếm và chọn Manager...")}
                          value={searchLeader}
                          onChange={e => {
                            if (!isWriteAuthorized) return;
                            setSearchLeader(e.target.value);
                            setShowLeaderDropdown(true);
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
                              position: 'absolute', right: 12, top: 10, color: 'var(--color-text-muted)',
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
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
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
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: '0.875rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)', margin: 0 }}>{uName}</p>
                                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                                    {u.email && (
                                      <img
                                        src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png"
                                        alt="Gmail"
                                        style={{ width: 13, height: 10, objectFit: 'contain', flexShrink: 0 }}
                                      />
                                    )}
                                    <span>{u.email}</span>
                                    {u.role && (
                                      <span style={{ fontSize: '0.65rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4, marginLeft: 'auto', fontWeight: 600 }}>
                                        {t(u.role)}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                {isSelected && <Check size={16} color="var(--color-primary)" />}
                              </div>
                            );
                          })}
                          {allSystemUsers.filter(u => (u.full_name || u.name || '').toLowerCase().includes(searchLeader.toLowerCase())).length === 0 && (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                              {t("Không tìm thấy nhân sự nào")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('KPI doanh thu tháng (VND)')}</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="VD: 100000000"
                          value={teamFormData.kpi_target}
                          onChange={e => setTeamFormData({ ...teamFormData, kpi_target: e.target.value })}
                          disabled={!isWriteAuthorized}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>{t('Số TV tối đa')}</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="VD: 10"
                          value={teamFormData.max_members}
                          onChange={e => setTeamFormData({ ...teamFormData, max_members: e.target.value })}
                          disabled={!isWriteAuthorized}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>{t('Mô tả nhóm / Slogan')}</label>
                      <textarea
                        className="form-input"
                        rows={3}
                        placeholder={t('Nhập mô tả hoạt động hoặc slogan của nhóm...')}
                        value={teamFormData.description}
                        onChange={e => setTeamFormData({ ...teamFormData, description: e.target.value })}
                        style={{ resize: 'vertical' }}
                        disabled={!isWriteAuthorized}
                      />
                    </div>
                  </div>

                  {/* Cột 2: Địa chỉ & Dự án & Quản lý Thành viên */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                      <AddressSelect
                        label={t('Địa chỉ chi nhánh')}
                        value={teamFormData.branch}
                        onChange={val => setTeamFormData({ ...teamFormData, branch: val })}
                        disabled={!isWriteAuthorized}
                      />
                    </div>

                    {/* Dự án trọng điểm (Multi-select) */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 600 }}>{t('Dự án trọng điểm')} ({teamFormData.focus_projects.length})</label>
                      
                      {/* Selected projects tags */}
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

                      {/* Projects checklist */}
                      <div className="custom-scrollbar" style={{ 
                        border: '1px solid var(--color-border)', 
                        borderRadius: 'var(--radius-md)', 
                        maxHeight: '120px', 
                        overflowY: 'auto',
                        background: 'var(--color-bg)',
                        padding: '0.25rem'
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
                                  background: isChecked ? 'var(--color-primary-light)' : 'transparent'
                                }}
                                onMouseEnter={e => { if (!isChecked && isWriteAuthorized) e.currentTarget.style.background = 'var(--color-surface)'; }}
                                onMouseLeave={e => { if (!isChecked && isWriteAuthorized) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}} // handled by click parent
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

                    {/* Quản lý Thành viên Team */}
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{t('Thành viên nhóm')} ({teamFormData.member_ids.length})</span>
                        {teamFormData.max_members && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {t('Tối đa')}: {teamFormData.max_members}
                          </span>
                        )}
                      </label>

                      {/* Selected members avatars list */}
                      {teamFormData.member_ids.length > 0 && (
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '0.5rem', 
                          marginBottom: '0.75rem',
                          padding: '0.5rem',
                          background: 'var(--color-bg)',
                          border: '1px dashed var(--color-border)',
                          borderRadius: 'var(--radius-md)'
                        }}>
                          {teamFormData.member_ids.map(id => {
                            const member = allSystemUsers.find(u => String(u.id) === String(id));
                            if (!member) return null;
                            const mName = member.full_name || member.name || '';
                            return (
                              <div 
                                key={id} 
                                style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '0.375rem', 
                                  background: 'var(--color-surface)', 
                                  border: '1px solid var(--color-border-light)', 
                                  padding: '2px 8px 2px 4px', 
                                  borderRadius: '12px',
                                  fontSize: '0.75rem' 
                                }}
                              >
                                <Avatar src={member.avatar_url || member.avatar} name={mName} size={16} />
                                <span style={{ fontWeight: 600, color: 'var(--color-text)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mName}</span>
                                {isWriteAuthorized && (
                                  <button 
                                    type="button" 
                                    onClick={() => setTeamFormData({ ...teamFormData, member_ids: teamFormData.member_ids.filter(mid => mid !== id) })}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', color: 'var(--color-text-muted)' }}
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Search box for members */}
                      <div style={{ marginBottom: '0.5rem', position: 'relative', width: '100%' }}>
                        <input
                          className="form-input sm"
                          style={{ height: '32px', fontSize: '0.8125rem', width: '100%', paddingRight: '2rem' }}
                          placeholder={t('Tìm kiếm TVV để xem/thêm vào nhóm...')}
                          value={memberSearch}
                          onChange={e => setMemberSearch(e.target.value)}
                        />
                        {memberSearch && (
                          <button
                            type="button"
                            onClick={() => setMemberSearch('')}
                            style={{ position: 'absolute', right: 8, top: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Members Checklist */}
                      <div className="custom-scrollbar" style={{ 
                        border: '1px solid var(--color-border)', 
                        borderRadius: 'var(--radius-md)', 
                        maxHeight: '220px', 
                        overflowY: 'auto',
                        background: 'var(--color-bg)'
                      }}>
                        {(() => {
                          const systemSales = allSystemUsers.filter(u => u.role === 'sales' || u.role === 'sale');
                          const filteredSales = systemSales.filter(u => 
                            (u.full_name || u.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
                            (u.email || '').toLowerCase().includes(memberSearch.toLowerCase())
                          );

                          if (filteredSales.length === 0) {
                            return (
                              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                                {t('Không tìm thấy tư vấn viên nào')}
                              </div>
                            );
                          }

                          return filteredSales.map(sale => {
                            const isChecked = teamFormData.member_ids.includes(String(sale.id));
                            const belongsToOtherTeam = sale.team_id && String(sale.team_id) !== String(editingTeam?.id);
                            const otherTeam = teams.find(t => String(t.id) === String(sale.team_id));
                            
                            return (
                              <div
                                key={sale.id}
                                onClick={() => {
                                  if (!isWriteAuthorized) return;
                                  const currentIds = [...teamFormData.member_ids];
                                  if (isChecked) {
                                    setTeamFormData({ ...teamFormData, member_ids: currentIds.filter(id => id !== String(sale.id)) });
                                  } else {
                                    setTeamFormData({ ...teamFormData, member_ids: [...currentIds, String(sale.id)] });
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.75rem',
                                  padding: '0.5rem 0.75rem',
                                  borderBottom: '1px solid var(--color-border-light)',
                                  cursor: isWriteAuthorized ? 'pointer' : 'default',
                                  transition: 'background 0.1s',
                                  background: isChecked ? 'var(--color-primary-light)' : 'transparent'
                                }}
                                onMouseEnter={e => { if (!isChecked && isWriteAuthorized) e.currentTarget.style.background = 'var(--color-surface)'; }}
                                onMouseLeave={e => { if (!isChecked && isWriteAuthorized) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}} // handled by outer div click
                                  style={{ cursor: isWriteAuthorized ? 'pointer' : 'default' }}
                                  disabled={!isWriteAuthorized}
                                />
                                <Avatar src={sale.avatar_url || sale.avatar} name={sale.full_name || sale.name || ''} size={24} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {sale.full_name || sale.name}
                                  </p>
                                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {sale.email}
                                  </p>
                                </div>
                                {sale.team_id && (
                                  <span style={{ 
                                    fontSize: '0.65rem', 
                                    background: belongsToOtherTeam ? 'var(--color-danger-light)' : 'var(--color-primary-light)', 
                                    color: belongsToOtherTeam ? 'var(--color-danger)' : 'var(--color-primary)', 
                                    padding: '2px 6px', 
                                    borderRadius: 4, 
                                    fontWeight: 600 
                                  }}>
                                    {belongsToOtherTeam ? `${t('Nhóm')}: ${otherTeam ? otherTeam.name : 'Khác'}` : t('Đang trong nhóm')}
                                  </span>
                                )}
                                {!sale.team_id && (
                                  <span style={{ fontSize: '0.65rem', background: 'var(--color-bg)', color: 'var(--color-text-muted)', padding: '2px 6px', borderRadius: 4 }}>
                                    {t('Tự do')}
                                  </span>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div style={{ padding: '1.25rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
                <button type="button" className="btn outline" onClick={() => setTeamModalOpen(false)}>{t('Hủy')}</button>
                {isWriteAuthorized ? (
                  <button type="submit" className="btn primary" disabled={isSaving}>
                    {isSaving ? t('Đang lưu...') : t('Lưu lại')}
                  </button>
                ) : (
                  <button type="button" className="btn primary" onClick={() => setTeamModalOpen(false)}>
                    {t('Đóng')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>,
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
                  • <strong>Nhóm (Team)</strong>: Các tổ chức bán hàng độc lập có Trưởng nhóm (Leader) phụ trách. Mỗi nhóm có thể cài đặt <strong>Dự án trọng điểm</strong> để phối hợp nhận lead tự động từ hệ thống khi có rule định tuyến khớp dự án đó.
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
    </div>
  );
};

export const Consultants = withRouterFreezer(ConsultantsInner, '/consultants');
