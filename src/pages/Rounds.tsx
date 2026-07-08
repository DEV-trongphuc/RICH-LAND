import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { withRouterFreezer } from '../components/RouterFreezer';
import { Plus, Users, Zap, X, Shield, Check, LayoutGrid, List, Trash2, Search, AlertCircle, Clock, Scale, Info, Layers, HelpCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { fetchAPI, getDefaultDateFilter } from '../utils/api';
import toast from 'react-hot-toast';
import { RoundCardSkeleton } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';
import { useLanguage } from '../contexts/LanguageContext';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { EmptyCard } from '../components/ui/EmptyCard';
import { useAuthStore } from '../store/authStore';
import { Pagination } from '../components/ui/Pagination';

const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#0ea5e9',
  '#3b82f6', '#BD1D2D', '#d946ef', '#ec4899', '#14b8a6', '#BD1D2D'
];

const getColorForName = (name: string) => {
  if (!name || name === '-') return '#94a3b8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const RoundsInner = ({ isActive }: { isActive: boolean }) => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const isReadOnly = user?.role === 'director';
  const { t } = useLanguage();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  const translateReason = (reasonStr: string) => {
    if (!reasonStr) return reasonStr;
    const match = reasonStr.match(/^([^(]+)(\s*\(Ghi chú:\s*.*\))?$/);
    if (match) {
      const base = match[1].trim();
      const note = match[2] ? match[2] : '';
      if (note) {
        const noteText = note.replace(/^\s*\(Ghi chú:\s*/, '').replace(/\)\s*$/, '');
        return `${t(base)} (${t('Ghi chú')}: ${noteText})`;
      }
      return t(base);
    }
    return t(reasonStr);
  };

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  const [rounds, setRounds] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [dateFilter, setDateFilter] = useState(() => {
    return localStorage.getItem('richland_global_date') || getDefaultDateFilter();
  });
  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleUpdateDateFilter = (val: string) => {
    setDateFilter(val);
    localStorage.setItem('richland_global_date', val);
    window.dispatchEvent(new CustomEvent('global-date-change', { detail: val }));
  };

  const getDisplayDateFilterText = (val: string) => {
    if (val.includes(' đến ')) {
      const parts = val.split(' đến ');
      if (parts.length === 2) {
        return `${parts[0]} - ${parts[1]}`;
      }
    }
    return t(val);
  };

  const dateOptions = [
    { value: 'Hôm nay', label: t('Hôm nay') },
    { value: 'Hôm qua', label: t('Hôm qua') },
    { value: 'Tuần này', label: t('Tuần này') },
    { value: 'Tuần trước', label: t('Tuần trước') },
    { value: 'Tuần trước nữa', label: t('Tuần trước nữa') },
    { value: '7 ngày qua', label: t('7 ngày qua') },
    { value: '30 ngày qua', label: t('30 ngày qua') },
    { value: 'Tháng này', label: t('Tháng này') },
    { value: 'Tháng trước', label: t('Tháng trước') }
  ];

  if (dateFilter && !dateOptions.some(o => o.value === dateFilter) && dateFilter !== 'Tùy chỉnh') {
    dateOptions.push({ value: dateFilter, label: getDisplayDateFilterText(dateFilter) });
  }

  dateOptions.push({ value: 'Tùy chỉnh', label: t('Tùy chỉnh...') });

  const handleCustomDateSubmit = () => {
    if (!startDate || !endDate) return toast.error(t("Vui lòng chọn đầy đủ Từ ngày và Đến ngày"));
    if (new Date(startDate) > new Date(endDate)) return toast.error(t("Từ ngày không được lớn hơn Đến ngày"));
    const label = `${startDate} đến ${endDate}`;
    handleUpdateDateFilter(label);
    setShowDateModal(false);
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingRound, setEditingRound] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActioning, setIsActioning] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    round_name: '',
    is_active: 1,
    cc_emails: '',
    selected_users: [] as number[],
    starting_consultant_id: null as number | null,
    ratios: {} as Record<string, number>,
    data_per_turns: {} as Record<string, number>,
    compensations: {} as Record<string, number>,
    is_fallback: false
  });

  const [searchUser, setSearchUser] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showStartSaleDropdown, setShowStartSaleDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const startSaleDropdownRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'config' | 'reports' | 'active_logs'>('config');
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [activeLogs, setActiveLogs] = useState<any[]>([]);
  const [loadingActiveLogs, setLoadingActiveLogs] = useState(false);

  // Compensation Modal State
  const [compModalOpen, setCompModalOpen] = useState(false);

  // Pagination States
  const [roundsPage, setRoundsPage] = useState(1);
  const [roundsPageSize] = useState(6);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsPageSize] = useState(5);
  const [activeLogsPage, setActiveLogsPage] = useState(1);
  const [activeLogsPageSize] = useState(5);

  // CC config states
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [enableExternalCc, setEnableExternalCc] = useState(false);
  const [externalCcEmails, setExternalCcEmails] = useState('');
  const [compRound, setCompRound] = useState<any>(null);
  const [compData, setCompData] = useState<Record<number, number>>({});
  const [compReasons, setCompReasons] = useState<Record<number, string>>({});
  const [isSavingComp, setIsSavingComp] = useState(false);

  const getFairnessColor = (index: number) => {
    if (index >= 90) return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' };
    if (index >= 75) return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' };
    return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)' };
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (startSaleDropdownRef.current && !startSaleDropdownRef.current.contains(event.target as Node)) {
        setShowStartSaleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchConsultants = async () => {
    try {
      const json = await fetchAPI('get_consultants');
      if (json.success) setConsultants(json.data);
    } catch (e: any) {
      console.error(t('Không thể tải tư vấn viên:'), e.message);
    }
  };

  const fetchRounds = async () => {
    try {
      const json = await fetchAPI(`get_rounds&date=${encodeURIComponent(dateFilter)}`);
      if (json.success) setRounds(json.data);
    } catch (e: any) {
      toast.error(t('Không thể tải dữ liệu: ') + e.message);
    }
    setLoading(false);
  };

  const fetchAccounts = async () => {
    try {
      const json = await fetchAPI('get_accounts');
      if (json.success) setAccounts(json.data || []);
    } catch (e: any) {
      console.error(t('Không thể tải tài khoản:'), e.message);
    }
  };

  useEffect(() => {
    if (isActive) {
      setRoundsPage(1);
      fetchRounds();
    }
  }, [dateFilter, isActive]);

  useEffect(() => {
    fetchConsultants();
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (isActive) {
      const saved = localStorage.getItem('richland_global_date');
      if (saved && saved !== dateFilter) {
        setDateFilter(saved);
      }
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const handleGlobalDate = (e: any) => {
      if (e.detail && e.detail !== dateFilter) {
        setDateFilter(e.detail);
      }
    };
    window.addEventListener('global-date-change', handleGlobalDate);
    return () => window.removeEventListener('global-date-change', handleGlobalDate);
  }, [dateFilter, isActive]);

  useEffect(() => {
    if (!isActive) return;
    const handleLeadAdded = () => {
      fetchRounds();
    };
    window.addEventListener('lead-added', handleLeadAdded);
    return () => window.removeEventListener('lead-added', handleLeadAdded);
  }, [dateFilter, isActive]);

  const openAddModal = () => {
    setEditingRound(null);
    setFormData({ round_name: '', is_active: 1, cc_emails: '', selected_users: [], starting_consultant_id: null, ratios: {}, data_per_turns: {}, compensations: {}, is_fallback: false });
    setSelectedAdmins([]);
    setEnableExternalCc(false);
    setExternalCcEmails('');
    setModalOpen(true);
  };

  const openCompModal = (r: any) => {
    setCompRound(r);
    setCompData(r.compensations || {});
    setCompReasons({});
    setCompModalOpen(true);
  };

  const handleSaveComp = async () => {
    if (!compRound || isSavingComp) return;
    setIsSavingComp(true);
    try {
      const payload = {
        round_id: compRound.id,
        compensations: compData,
        reasons: compReasons
      };
      const res = await fetchAPI('update_compensations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.success) {
        toast.success(t('Đã cập nhật Bù Data!'));
        fetchRounds();
        setCompModalOpen(false);
      } else {
        toast.error(res.message || t('Có lỗi xảy ra'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsSavingComp(false);
  };

  const openEditModal = (r: any) => {
    setEditingRound(r);
    setActiveTab('config');
    let matchedIds: number[] = [];
    if (r.consultant_ids) {
      matchedIds = r.consultant_ids.split(',').map((id: string) => parseInt(id, 10));
    }

    setFormData({
      round_name: r.round_name,
      is_active: Number(r.is_active),
      cc_emails: r.cc_emails || '',
      selected_users: matchedIds,
      starting_consultant_id: r.next_consultant_id ? parseInt(r.next_consultant_id) : null,
      ratios: r.ratios || {},
      data_per_turns: r.data_per_turns || {},
      compensations: r.compensations || {},
      is_fallback: !!r.is_fallback
    });

    // Parse cc_emails into selected admins and external emails
    const emailsList = r.cc_emails
      ? r.cc_emails.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];
    const adminEmails = accounts
      .filter(a => (a.role === 'admin' || a.role === 'superadmin' || Number(a.id) === 1) && a.email)
      .map(a => a.email.trim().toLowerCase());
    
    const matchedAdmins = emailsList.filter((e: string) => adminEmails.includes(e.toLowerCase()));
    const externalEmails = emailsList.filter((e: string) => !adminEmails.includes(e.toLowerCase()));

    setSelectedAdmins(matchedAdmins);
    setEnableExternalCc(externalEmails.length > 0);
    setExternalCcEmails(externalEmails.join(', '));

    setModalOpen(true);
    fetchReports(r.id);
    fetchActiveLogs(r.id);
  };

  const fetchActiveLogs = async (roundId: number) => {
    setLoadingActiveLogs(true);
    try {
      const res = await fetchAPI(`get_active_compensation_logs&round_id=${roundId}`);
      if (res.success) setActiveLogs(res.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoadingActiveLogs(false);
  };

  const fetchReports = async (roundId: number) => {
    setLoadingReports(true);
    try {
      const res = await fetchAPI(`get_reports&round_id=${roundId}`);
      if (res.success) setReports(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoadingReports(false);
  };

  const handleReportAction = async (reportId: number, action: 'approve' | 'reject') => {
    if (isActioning) return;
    setIsActioning(reportId);
    try {
      const endpoint = action === 'approve' ? 'approve_report' : 'reject_report';
      const res = await fetchAPI(endpoint, {
        method: 'POST',
        body: JSON.stringify({ id: reportId })
      });
      if (res.success) {
        toast.success(action === 'approve' ? t('Đã duyệt đền bù Data!') : t('Đã từ chối báo cáo!'));
        fetchReports(editingRound.id);
        fetchRounds(); // Refresh to get updated compensations count
      } else {
        toast.error(res.message || t('Có lỗi xảy ra'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsActioning(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.round_name) return toast.error(t("Vui lòng nhập tên vòng"));
    if (isSaving) return;

    setIsSaving(true);
    try {
      const action = editingRound ? 'edit_round' : 'add_round';

      // Combine selected admin emails and external emails
      const adminsPart = selectedAdmins;
      const externalPart = enableExternalCc
        ? externalCcEmails.split(',').map((e: string) => e.trim()).filter(Boolean)
        : [];
      const combinedCcEmails = [...adminsPart, ...externalPart].join(', ');

      const payload = { 
        ...formData, 
        cc_emails: combinedCcEmails,
        id: editingRound?.id, 
        consultants: formData.selected_users 
      };

      const json = await fetchAPI(action, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (json.success) {
        toast.success(editingRound ? t('Cập nhật thành công!') : t('Thêm mới thành công!'));
        fetchRounds();
        setModalOpen(false);
      } else {
        toast.error(json.message || t('Lỗi khi lưu'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsSaving(false);
  };

  const toggleUserSelection = (userId: number | string) => {
    const id = Number(userId);
    setFormData(prev => ({
      ...prev,
      selected_users: prev.selected_users.includes(id)
        ? prev.selected_users.filter(x => x !== id)
        : [...prev.selected_users, id]
    }));
  };

  const handleDelete = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      const json = await fetchAPI(`delete_round&id=${deleteId}`);
      if (json.success) {
        toast.success(t('Đã xóa thành công!'));
        fetchRounds();
      } else {
        toast.error(json.message || t('Lỗi khi xóa'));
      }
    } catch (e: any) {
      toast.error(t('Lỗi: ') + e.message);
    }
    setIsDeleting(false);
    setConfirmDeleteOpen(false);
  };

  const removeUser = (userId: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = Number(userId);
    setFormData(prev => ({
      ...prev,
      selected_users: prev.selected_users.filter(x => x !== id)
    }));
  };

  const ROUND_COLORS = ['var(--color-primary)', '#3b82f6', '#BD1D2D', '#10b981'];

  return (
    <div className="fade-in-view">
      <style>{`
        .rounds-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)) !important;
          gap: 1.25rem;
        }
        @media (min-width: 1200px) {
          .rounds-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        .compensation-report-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border: 1px solid var(--color-border-light);
          border-radius: 12px;
          background: var(--color-surface);
          box-shadow: var(--shadow-sm);
          gap: 1rem;
          flex-wrap: nowrap;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: default;
        }
        .compensation-report-row:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--color-border);
        }
        .report-left-details {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
          min-width: 0;
          flex-wrap: nowrap;
        }
        .report-right-actions {
          flex: 0 0 240px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          min-width: 0;
        }
        @media (max-width: 768px) {
          .compensation-report-row {
            flex-wrap: wrap;
            align-items: flex-start;
          }
          .report-left-details {
            flex-wrap: wrap;
          }
          .report-right-actions {
            flex: 1 1 100%;
            justify-content: flex-start;
            margin-top: 0.5rem;
          }
          .mobile-ml-0 {
            margin-left: 0 !important;
            border-left: none !important;
            padding-left: 0 !important;
          }
        }
      `}</style>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={24} color="var(--color-primary)" />
            {t("Vòng Phân Bổ")}
            <button
              onClick={() => setShowInfoModal(true)}
              style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                border: '1px solid var(--color-border)',
                padding: '4px 10px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'all 0.2s',
                marginLeft: '8px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--color-primary)';
                e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                e.currentTarget.style.background = 'var(--color-primary-light)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
              }}
              title={t("Xem chi tiết cơ chế hoạt động chia số")}
            >
              <Info size={14} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
            </button>
          </h1>
          <p className="page-subtitle">
            {t("Quản lý vòng xoay Round-Robin và điều phối Tư vấn viên")}
          </p>
        </div>

        <div className="mobile-flex-wrap" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Date Filter Dropdown */}
          <div className="responsive-filter-item" style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 180 }}>
            <CustomSelect
              options={dateOptions}
              value={dateFilter}
              onChange={val => {
                if (val === 'Tùy chỉnh') {
                  setShowDateModal(true);
                  return;
                }
                handleUpdateDateFilter(val.toString());
              }}
              width="100%"
            />
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '3px 4px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            height: '38px'
          }}>
            {/* View Mode Toggle Buttons */}
            <div style={{
              display: 'flex',
              background: 'transparent',
              borderRadius: '8px',
              padding: '0',
              height: '32px',
              alignItems: 'center'
            }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'grid' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'grid' ? 'white' : 'var(--color-text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '28px'
                }}
              >
                <LayoutGrid size={13} /> <span className="hide-on-mobile">{t("Lưới")}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: viewMode === 'list' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'list' ? 'white' : 'var(--color-text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '28px'
                }}
              >
                <List size={13} /> <span className="hide-on-mobile">{t("Danh sách")}</span>
              </button>
            </div>

            {/* Separator line */}
            <div style={{ width: '1px', height: '16px', background: 'var(--color-border)', margin: '0 6px' }} />

            {/* Đối soát công bằng Button */}
            <button
              type="button"
              onClick={() => navigate('/fair-share')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 10px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-primary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: '28px'
              }}
            >
              <Scale size={13} /> <span>{t("Đối soát")}<span className="hide-on-mobile"> {t("công bằng")}</span></span>
            </button>

            {/* Separator line */}
            <div style={{ width: '1px', height: '16px', background: 'var(--color-border)', margin: '0 6px' }} />

            {/* Thêm Vòng Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={openAddModal}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-primary)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: '28px'
                }}
              >
                <Plus size={13} /> <span>{t("Thêm")}<span className="hide-on-mobile"> {t("Vòng")}</span></span>
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounds-grid">
          {[1, 2, 3].map(i => <RoundCardSkeleton key={i} />)}
        </div>
      ) : (
        <div
          className={viewMode === 'grid' ? 'rounds-grid' : ''}
          style={viewMode === 'grid' ? {} : {
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
          {rounds.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', width: '100%' }}>
              <EmptyCard
                icon={<Zap size={48} />}
                title={t("Chưa có Vòng Phân Bổ")}
                description={t("Bắt đầu bằng cách thêm mới vòng phân bổ đầu tiên của bạn để chia số cho Sale.")}
                actionText={t("Thêm Vòng ngay")}
                onAction={openAddModal}
              />
            </div>
          ) : rounds.slice((roundsPage - 1) * roundsPageSize, roundsPage * roundsPageSize).map((r, idx) => {
            const consList = r.consultants ? r.consultants.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
            const consIds = r.consultant_ids ? r.consultant_ids.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
            const compensatedConsultants = [];
            for (let i = 0; i < consIds.length; i++) {
              const cId = consIds[i];
              const compCount = r.compensations ? (r.compensations[cId] || 0) : 0;
              if (compCount > 0) {
                compensatedConsultants.push({
                  id: cId,
                  name: consList[i],
                  count: compCount
                });
              }
            }
            const color = ROUND_COLORS[idx % ROUND_COLORS.length];
            const nextCons = consultants.find(x => x.name === r.next_assigned_name);

            return viewMode === 'grid' ? (
              <div key={r.id} className="card hover-glow" style={{ 
                overflow: 'hidden', 
                display: 'flex', 
                flexDirection: 'column',
                borderRadius: '12px',
                borderTop: `4px solid ${color}`,
                borderLeft: Number(r.is_active) !== 1 ? '1px solid var(--color-border)' : undefined,
                borderRight: Number(r.is_active) !== 1 ? '1px solid var(--color-border)' : undefined,
                borderBottom: Number(r.is_active) !== 1 ? '1px solid var(--color-border)' : undefined,
                opacity: Number(r.is_active) !== 1 ? 0.75 : 1,
                filter: Number(r.is_active) !== 1 ? 'grayscale(0.95)' : 'none',
                background: Number(r.is_active) !== 1 ? (theme === 'dark' ? '#1f2937' : '#f9fafb') : undefined
              }}>
                <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Zap size={18} color={color} />
                      </div>
                      <div>
                        <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {r.round_name}
                          {r.is_fallback && (
                            <span className="badge danger" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                              {t("Mặc định")}
                            </span>
                          )}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span 
                            className={`pulse-dot ${Number(r.is_active) === 1 ? 'active' : 'inactive'}`} 
                            style={{ width: 6, height: 6, display: 'inline-block' }} 
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            {Number(r.is_active) === 1 ? t('Đang hoạt động') : t('Tạm dừng')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Fairness score badge */}
                    {r.fairness_index !== undefined && (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/fair-share?round_id=${r.id}`);
                        }}
                        style={{ 
                          cursor: 'pointer', 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 2 
                        }}
                        title={t("Click để xem chi tiết đối soát công bằng")}
                      >
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          color: 'var(--color-text-muted)', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em' 
                        }}>
                          {t("Điểm đối soát")}
                        </span>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 4, 
                          padding: '3px 8px', 
                          borderRadius: 8, 
                          background: getFairnessColor(r.fairness_index).bg,
                          color: getFairnessColor(r.fairness_index).color,
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          border: `1px solid ${getFairnessColor(r.fairness_index).color}25`,
                          transition: 'all 0.2s ease-out'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        >
                          <Scale size={12} />
                          {r.fairness_index}%
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', margin: 0, minWidth: 95 }}>
                          {t('{count} Thành viên').replace('{count}', String(consList.length))}
                        </p>
                        {consList.length > 0 ? (
                          <div className="avatar-stack" style={{ display: 'flex', alignItems: 'center' }}>
                            {consList.slice(0, 4).map((c: string, i: number) => {
                              const matchedCons = consultants.find(x => x.name === c);
                              return (
                                <span
                                  key={i}
                                  className="avatar-stack-item"
                                  data-tooltip={(() => {
                                    const cId = consIds[consList.indexOf(c)];
                                    const leadCount = (cId && r.consultant_lead_counts) ? (r.consultant_lead_counts[cId] || 0) : 0;
                                    return `${c} • ${leadCount}`;
                                  })()}
                                  style={{
                                    marginLeft: i === 0 ? 0 : -8,
                                    position: 'relative',
                                    zIndex: 10 - i,
                                    display: 'inline-block',
                                    borderRadius: '50%'
                                  }}
                                >
                                  <Avatar
                                    src={matchedCons?.avatar}
                                    name={c}
                                    size={32}
                                    style={{
                                      border: '2px solid var(--color-surface)',
                                      boxShadow: 'var(--shadow-sm)',
                                      filter: (matchedCons?.status === 'inactive' || matchedCons?.status === 'leave' || Number(matchedCons?.vacation_mode) === 1) ? 'grayscale(1)' : 'none',
                                      opacity: (matchedCons?.status === 'inactive' || matchedCons?.status === 'leave' || Number(matchedCons?.vacation_mode) === 1) ? 0.5 : 1
                                    }}
                                  />
                                </span>
                              );
                            })}
                            {consList.length > 4 && (
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%', background: 'var(--color-bg)',
                                color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 700, border: '2px solid var(--color-surface)',
                                marginLeft: -8, position: 'relative', zIndex: 5, boxShadow: 'var(--shadow-sm)'
                              }}>
                                +{consList.length - 4}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>{t("Chưa có")}</p>
                        )}
                      </div>

                      {/* Total Leads count */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600, 
                        color: 'var(--color-text-light)',
                        background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border-light)'
                      }}>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{t("Tổng data:")}</span>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>{r.total_leads || 0}</span>
                      </div>
                    </div>

                    {compensatedConsultants.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        <div style={{ padding: '0.5rem', background: 'var(--color-warning-light)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Zap size={14} color="var(--color-warning)" style={{ fill: 'var(--color-warning)', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, lineHeight: 1.4 }}>
                            {t('Đang bù data:')}{' '}
                            <span 
                              style={{ 
                                fontWeight: 700, 
                                cursor: 'help' 
                              }} 
                              title={t('Đang được bù ưu tiên tiếp theo')}
                            >
                              {compensatedConsultants[0].name}
                            </span>
                            {compensatedConsultants.length > 1 && (
                              <>
                                {' '}{t('và')}{' '}
                                <span 
                                  style={{ 
                                    fontWeight: 700, 
                                    borderBottom: '1px dashed currentColor', 
                                    cursor: 'help' 
                                  }} 
                                  title={compensatedConsultants.slice(1).map(c => c.name).join('\n')}
                                >
                                  {t('{count} người khác').replace('{count}', String(compensatedConsultants.length - 1))}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                        {r.next_assigned_name && (
                          <div style={{ paddingLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {t('Lượt xoay tiếp theo:')}
                              <Avatar src={nextCons?.avatar} name={r.next_assigned_name} size={16} />
                              <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>{r.next_assigned_name}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      r.next_assigned_name && (
                        <div style={{ padding: '0.5rem', background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Zap size={14} color="var(--color-primary)" />
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-dark)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {t('Sale lượt tới:')}
                            <Avatar src={nextCons?.avatar} name={r.next_assigned_name} size={18} />
                            <span style={{ fontWeight: 700 }}>{r.next_assigned_name}</span>
                          </span>
                        </div>
                      )
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                    <button className="btn outline sm" onClick={() => openEditModal(r)} style={{ flex: 1, padding: '0.5rem' }}>
                      <Info size={13} /> {isReadOnly ? t("Xem chi tiết") : t("Chi tiết")}
                    </button>
                    {!isReadOnly && (
                      <button className="btn primary sm" onClick={() => openCompModal(r)} style={{ flex: 1, padding: '0.5rem' }}>
                        <Zap size={13} /> {t("Bù Data")}
                      </button>
                    )}
                    {!isReadOnly && (
                      <button className="btn outline sm" onClick={() => { setDeleteId(r.id); setConfirmDeleteOpen(true); }} style={{ padding: '0 0.75rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger-light)' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div key={r.id} className="card hover-glow responsive-flex-row responsive-height-auto" style={{
                display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 1.5rem',
                borderRadius: '12px',
                borderLeft: `4px solid ${Number(r.is_active) !== 1 ? '#9ca3af' : color}`,
                opacity: Number(r.is_active) !== 1 ? 0.75 : 1,
                filter: Number(r.is_active) !== 1 ? 'grayscale(0.95)' : 'none',
                background: Number(r.is_active) !== 1 ? (theme === 'dark' ? '#1f2937' : '#f9fafb') : undefined
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={20} color={color} />
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {r.round_name}
                    {r.is_fallback && (
                      <span className="badge danger" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                        {t("Mặc định")}
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span 
                      className={`pulse-dot ${Number(r.is_active) === 1 ? 'active' : 'inactive'}`} 
                      style={{ width: 8, height: 8, display: 'inline-block' }} 
                    />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      {Number(r.is_active) === 1 ? t('Đang hoạt động') : t('Tạm dừng')}
                    </span>
                  </div>
                </div>

                {/* Fairness Score Badge for List View */}
                {r.fairness_index !== undefined && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/fair-share?round_id=${r.id}`);
                    }}
                    style={{ 
                      cursor: 'pointer', 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      minWidth: 100,
                      flexShrink: 0
                    }}
                    title={t("Click để xem chi tiết đối soát công bằng")}
                  >
                    <span style={{ 
                      fontSize: '0.65rem', 
                      fontWeight: 700, 
                      color: 'var(--color-text-muted)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em' 
                    }}>
                      {t("Đối soát")}
                    </span>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 4, 
                      padding: '3px 8px', 
                      borderRadius: 8, 
                      background: getFairnessColor(r.fairness_index).bg,
                      color: getFairnessColor(r.fairness_index).color,
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      border: `1px solid ${getFairnessColor(r.fairness_index).color}25`,
                      transition: 'all 0.2s ease-out'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    >
                      <Scale size={11} />
                      {r.fairness_index}%
                    </div>
                  </div>
                )}

                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="avatar-stack" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginRight: '0.5rem', minWidth: 90 }}>
                      {t('{count} Thành viên').replace('{count}', String(consList.length))}
                    </p>
                    {consList.slice(0, 4).map((c: string, i: number) => {
                      const matchedCons = consultants.find(cons => cons.name === c);
                      return (
                        <span
                          key={i}
                          className="avatar-stack-item"
                          data-tooltip={(() => {
                            const cId = consIds[consList.indexOf(c)];
                            const leadCount = (cId && r.consultant_lead_counts) ? (r.consultant_lead_counts[cId] || 0) : 0;
                            return `${c} • ${leadCount}`;
                          })()}
                          style={{
                            marginLeft: i > 0 ? -12 : 0,
                            position: 'relative',
                            zIndex: 10 - i,
                            display: 'inline-block',
                            borderRadius: '50%'
                          }}
                        >
                          <Avatar
                            src={matchedCons?.avatar}
                            name={c}
                            size={32}
                            style={{
                              border: '2px solid var(--color-surface)',
                              boxShadow: 'var(--shadow-sm)',
                              filter: (matchedCons?.status === 'inactive' || matchedCons?.status === 'leave' || Number(matchedCons?.vacation_mode) === 1) ? 'grayscale(1)' : 'none',
                              opacity: (matchedCons?.status === 'inactive' || matchedCons?.status === 'leave' || Number(matchedCons?.vacation_mode) === 1) ? 0.5 : 1
                            }}
                          />
                        </span>
                      );
                    })}
                    {consList.length > 4 && (
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: 'var(--color-bg)', color: 'var(--color-text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
                        border: '2px solid var(--color-surface)', marginLeft: -12, boxShadow: 'var(--shadow-sm)'
                      }}>
                        +{consList.length - 4}
                      </div>
                    )}

                    {/* Total Leads count */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      fontSize: '0.7rem', 
                      fontWeight: 600, 
                      color: 'var(--color-text-light)',
                      background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border-light)',
                      marginLeft: 'auto'
                    }}>
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{t("Tổng data:")}</span>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>{r.total_leads || 0}</span>
                    </div>
                  </div>

                  {compensatedConsultants.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={12} color="var(--color-warning)" style={{ fill: 'var(--color-warning)', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, lineHeight: 1.4 }}>
                          {t('Đang bù data:')}{' '}
                          <span 
                            style={{ 
                              fontWeight: 700, 
                              cursor: 'help' 
                            }} 
                            title={t('Đang được bù ưu tiên tiếp theo')}
                          >
                            {compensatedConsultants[0].name}
                          </span>
                          {compensatedConsultants.length > 1 && (
                            <>
                              {' '}{t('và')}{' '}
                              <span 
                                style={{ 
                                  fontWeight: 700, 
                                  borderBottom: '1px dashed currentColor', 
                                  cursor: 'help' 
                                }} 
                                title={compensatedConsultants.slice(1).map(c => c.name).join('\n')}
                              >
                                {t('{count} người khác').replace('{count}', String(compensatedConsultants.length - 1))}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                      {r.next_assigned_name && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500, paddingLeft: 16, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {t('Lượt xoay tiếp theo:')}
                          <Avatar src={nextCons?.avatar} name={r.next_assigned_name} size={14} />
                          <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>{r.next_assigned_name}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    r.next_assigned_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={12} color="var(--color-primary)" />
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-primary-dark)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {t('Sale lượt tới:')}
                          <Avatar src={nextCons?.avatar} name={r.next_assigned_name} size={16} />
                          <span style={{ fontWeight: 700 }}>{r.next_assigned_name}</span>
                        </span>
                      </div>
                    )
                  )}
                </div>

                <div className="mobile-round-actions" style={{ padding: '1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => openEditModal(r)} className="btn outline" style={{ flex: 1, padding: '0.625rem' }}>
                    <Info size={16} /> {isReadOnly ? t("Xem chi tiết") : t("Chi tiết")}
                  </button>
                  {!isReadOnly && (
                    <button onClick={() => openCompModal(r)} className="btn primary" style={{ flex: 1, padding: '0.625rem' }}>
                      <Zap size={16} /> {t("Bù Data")}
                    </button>
                  )}
                  {!isReadOnly && (
                    <button onClick={() => { setDeleteId(r.id); setConfirmDeleteOpen(true); }} className="btn outline danger" style={{ padding: '0.625rem', width: 42, flexShrink: 0, justifyContent: 'center' }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rounds.length > roundsPageSize && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', paddingRight: '0.5rem' }}>
          <Pagination
            total={rounds.length}
            page={roundsPage}
            pageSize={roundsPageSize}
            onChange={setRoundsPage}
          />
        </div>
      )}

      {/* MODAL */}
      {modalOpen && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => { setModalOpen(false); setShowDropdown(false); }}>
          <div
            className="card"
            style={{ width: '100%', maxWidth: 1000, minHeight: 500, maxHeight: '90vh', animation: 'slideUp 0.2s ease-out', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                {editingRound ? t('Cập nhật Vòng Phân Bổ') : t('Thêm Vòng Phân Bổ mới')}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ color: 'var(--color-text-muted)', padding: 4, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <X size={20} />
              </button>
            </div>

            {editingRound && (
              <div style={{ display: 'flex', background: 'var(--color-border-light)', borderRadius: '12px', padding: '4px', alignSelf: 'flex-start', margin: '0.75rem 1.25rem', width: 'fit-content', gap: '4px' }}>
                <button type="button" onClick={() => setActiveTab('config')} style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, border: 'none', background: activeTab === 'config' ? 'var(--color-surface)' : 'transparent', color: activeTab === 'config' ? 'var(--color-primary)' : 'var(--color-text-light)', boxShadow: activeTab === 'config' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}>{t("Cấu hình chung")}</button>
                <button type="button" onClick={() => setActiveTab('reports')} style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, border: 'none', background: activeTab === 'reports' ? 'var(--color-surface)' : 'transparent', color: activeTab === 'reports' ? 'var(--color-primary)' : 'var(--color-text-light)', boxShadow: activeTab === 'reports' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t("Data Lỗi & Đền Bù")}
                  {reports.filter(r => r.status === 'pending').length > 0 && (
                    <span style={{ background: 'var(--color-danger)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 10 }}>{reports.filter(r => r.status === 'pending').length}</span>
                  )}
                </button>
                <button type="button" onClick={() => setActiveTab('active_logs')} style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, border: 'none', background: activeTab === 'active_logs' ? 'var(--color-surface)' : 'transparent', color: activeTab === 'active_logs' ? 'var(--color-primary)' : 'var(--color-text-light)', boxShadow: activeTab === 'active_logs' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                  {t("Log bù chủ động")}
                </button>
              </div>
            )}

            {activeTab === 'config' ? (
              <form onSubmit={handleSave} className="subtab-enter-active" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'visible' }}>
                <fieldset disabled={isReadOnly} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'visible' }}>
                  <div className="responsive-grid-1-1 modal-form-body" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', flex: 1, overflow: 'visible', minHeight: 0 }}>

                  {/* LEFT COLUMN */}
                  <div className="custom-scrollbar modal-form-col" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '4px' }}>
                    <div className="form-group">
                      <label className="form-label">{t("Tên Vòng")} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                      <input
                        className="form-input"
                        placeholder={t("VD: Vòng 1 — Form Đăng Ký")}
                        value={formData.round_name}
                        onChange={e => setFormData({ ...formData, round_name: e.target.value })}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={14} /> {t("Chọn Admin nhận CC khi chia Data")}
                      </label>
                      {(() => {
                        const admins = accounts.filter(a => (a.role === 'admin' || a.role === 'superadmin' || Number(a.id) === 1) && a.email);
                        if (admins.length === 0) {
                          return (
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: '4px 0 12px' }}>
                              {t("Không có tài khoản Admin nào có email")}
                            </p>
                          );
                        }
                        return (
                          <div className="custom-scrollbar" style={{
                            maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem',
                            border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.5rem', background: 'var(--color-bg)'
                          }}>
                            {admins.map(admin => {
                              const isSelected = selectedAdmins.includes(admin.email);
                              return (
                                <div
                                  key={admin.id}
                                  onClick={() => {
                                    setSelectedAdmins(prev => 
                                      prev.includes(admin.email) 
                                        ? prev.filter(e => e !== admin.email) 
                                        : [...prev, admin.email]
                                    );
                                  }}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.5rem',
                                    borderRadius: '6px', cursor: 'pointer', background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                                    border: '1px solid ' + (isSelected ? 'var(--color-primary-light)' : 'var(--color-border-light)'),
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={e => {
                                    if (!isSelected) e.currentTarget.style.background = 'var(--color-bg)';
                                  }}
                                  onMouseLeave={e => {
                                    if (!isSelected) e.currentTarget.style.background = 'var(--color-surface)';
                                  }}
                                >
                                  <Avatar src={admin.avatar} name={admin.name} size={24} />
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: '0.75rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)', margin: 0 }}>
                                      {admin.name}
                                    </p>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                      {admin.email}
                                    </p>
                                  </div>
                                  <div style={{
                                    width: 16, height: 16, borderRadius: '4px', border: '1px solid ' + (isSelected ? 'var(--color-primary)' : 'var(--color-border)'),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'var(--color-primary)' : 'transparent',
                                    transition: 'all 0.15s ease'
                                  }}>
                                    {isSelected && <Check size={10} color="white" strokeWidth={3} />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="form-group" style={{ marginTop: '-0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                          {t("Nhận thêm CC email ngoài hệ thống")}
                        </label>
                        <ToggleSwitch
                          checked={enableExternalCc}
                          onChange={(checked) => setEnableExternalCc(checked)}
                        />
                      </div>
                    </div>

                    {enableExternalCc && (
                      <div className="form-group" style={{ 
                        marginTop: '-0.25rem',
                        animation: 'fadeIn 0.2s ease-out'
                      }}>
                        <label className="form-label">{t("Nhập CC email ngoài hệ thống")}</label>
                        <input
                          className="form-input"
                          placeholder={t("VD: giamdoc@richland.vn, quanly@richland.vn")}
                          value={externalCcEmails}
                          onChange={e => setExternalCcEmails(e.target.value)}
                        />
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          {t("Phân tách các email bằng dấu phẩy (,).")}
                        </p>
                      </div>
                    )}

                    <div className="form-group">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                          <Shield size={14} /> {t("Trạng thái Vòng")}
                        </label>
                        <ToggleSwitch
                          checked={formData.is_active === 1}
                          onChange={(checked) => setFormData({ ...formData, is_active: checked ? 1 : 0 })}
                        />
                      </div>
                    </div>

                    {formData.selected_users.length > 0 && (
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={14} /> {t("Chọn Sale bắt đầu / kế tiếp (Tuỳ chọn)")}</label>
                        <div ref={startSaleDropdownRef} style={{ position: 'relative' }}>
                          <div
                            className="form-input"
                            onClick={() => setShowStartSaleDropdown(!showStartSaleDropdown)}
                            style={{ padding: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-bg)' }}
                          >
                            {formData.starting_consultant_id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {(() => {
                                  const c = consultants.find(x => Number(x.id) === formData.starting_consultant_id);
                                  if (!c) return t('-- Mặc định (Theo thứ tự thêm vào) --');
                                  return (
                                    <>
                                      <Avatar src={c.avatar} name={c.name} size={20} />
                                      <span style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--color-text)' }}>{c.name}</span>
                                    </>
                                  )
                                })()}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('-- Mặc định (Theo thứ tự thêm vào) --')}</span>
                            )}
                            <span style={{ transform: showStartSaleDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--color-text-muted)', display: 'inline-block', fontSize: '0.75rem' }}>▼</span>
                          </div>

                          {showStartSaleDropdown && (
                            <div style={{
                              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50,
                              background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', maxHeight: 150, overflowY: 'auto'
                            }}>
                              <div
                                onClick={() => { setFormData({ ...formData, starting_consultant_id: null }); setShowStartSaleDropdown(false); }}
                                style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)', fontSize: '0.875rem', background: formData.starting_consultant_id === null ? 'var(--color-bg)' : 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                                onMouseLeave={e => e.currentTarget.style.background = formData.starting_consultant_id === null ? 'var(--color-bg)' : 'transparent'}
                              >
                                {t('-- Mặc định (Theo thứ tự thêm vào) --')}
                              </div>
                              {formData.selected_users.map(id => {
                                const c = consultants.find(x => Number(x.id) === Number(id));
                                if (!c) return null;
                                const isSelected = formData.starting_consultant_id === id;
                                return (
                                  <div
                                    key={id}
                                    onClick={() => { setFormData({ ...formData, starting_consultant_id: id }); setShowStartSaleDropdown(false); }}
                                    style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', background: isSelected ? 'var(--color-primary-light)' : 'transparent', transition: 'background 0.1s' }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-bg)'; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                  >
                                    <Avatar src={c.avatar} name={c.name} size={24} />
                                    <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>
                                      {c.name}
                                    </div>
                                    {isSelected && <Check size={14} color="var(--color-primary)" />}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                          {t("Người được chọn sẽ là người nhận Data tiếp theo của vòng này.")}
                        </p>
                      </div>
                    )}

                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                          <Zap size={14} color="var(--color-primary)" /> {t("Đặt làm Vòng phân bổ mặc định (Fallback)")}
                        </label>
                        <div
                          className={`custom-toggle ${formData.is_fallback ? 'active' : ''}`}
                          onClick={() => setFormData({ ...formData, is_fallback: !formData.is_fallback })}
                        />
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {t("Nếu dữ liệu mới không khớp bất kỳ quy luật chia nào, hệ thống sẽ tự động phân phối vào vòng này. Chỉ có duy nhất 1 vòng được đặt làm mặc định.")}
                      </p>
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: 0, flex: 1 }}>
                    {/* Custom Multi-Select with Avatars */}
                    <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> {t("Chọn Tư vấn viên vào vòng này")}</label>

                      {/* Search Input Box */}
                      <div style={{ position: 'relative' }}>
                        <input
                          className="form-input"
                          style={{ paddingLeft: '2.5rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                          placeholder={t("Tìm kiếm và chọn Tư vấn viên...")}
                          value={searchUser}
                          onChange={e => setSearchUser(e.target.value)}
                          onFocus={() => setShowDropdown(true)}
                        />
                        <div style={{ position: 'absolute', left: 12, top: 10, color: '#94a3b8' }}><Search size={16} /></div>
                      </div>

                      {/* Dropdown Options */}
                      {showDropdown && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50,
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', maxHeight: 220, overflowY: 'auto'
                        }}>
                          {consultants.filter(c => c.name.toLowerCase().includes(searchUser.toLowerCase())).map(user => {
                            const isSelected = formData.selected_users.includes(Number(user.id));

                            return (
                              <div
                                key={user.id}
                                onClick={() => {
                                  if (user.status !== 'active') {
                                    toast.error(t('Sale không hoạt động'));
                                    return;
                                  }
                                  toggleUserSelection(user.id);
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                                  cursor: user.status === 'active' ? 'pointer' : 'not-allowed',
                                  background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                                  transition: 'background 0.1s',
                                  opacity: user.status === 'active' ? 1 : 0.55,
                                  filter: user.status === 'active' ? 'none' : 'grayscale(1)'
                                }}
                                onMouseEnter={e => { if (user.status === 'active' && !isSelected) e.currentTarget.style.background = 'var(--color-bg)'; }}
                                onMouseLeave={e => { if (user.status === 'active' && !isSelected) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <Avatar src={user.avatar} name={user.name} size={28} />
                                 <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: '0.875rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)', margin: 0 }}>{user.name}</p>
                                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                                    {user.email && (
                                      <img
                                        src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png"
                                        alt="Gmail"
                                        style={{ width: 13, height: 10, objectFit: 'contain', flexShrink: 0 }}
                                      />
                                    )}
                                    <span>{user.email} • {user.status === 'active' ? t('Đang nhận data') : t('Không nhận data')}</span>
                                  </p>
                                </div>
                                {isSelected && <Check size={16} color="var(--color-primary)" />}
                              </div>
                            );
                          })}
                          {consultants.filter(c => c.name.toLowerCase().includes(searchUser.toLowerCase())).length === 0 && (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                              {t("Không tìm thấy tư vấn viên nào")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Consultants List Block */}
                    {formData.selected_users.length > 0 && (
                      <div className="custom-scrollbar modal-form-selected-list" style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 0 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{t("Tư vấn viên đã chọn ({count}):").replace('{count}', String(formData.selected_users.length))}</div>
                        {formData.selected_users.map(userId => {
                          const user = consultants.find(c => Number(c.id) === userId);
                          if (!user) return null;
                          return (
                            <div key={user.id} style={{
                              display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem',
                              background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10,
                              transition: 'all 0.2s'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Avatar src={user.avatar} name={user.name} size={28} style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.12)' }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center' }}>
                                    {user.name}
                                    {editingRound?.compensations?.[user.id] > 0 && (
                                      <span className="badge danger" style={{ marginLeft: 8, fontSize: '0.65rem', padding: '2px 6px' }}>
                                        {t("Nợ bù: {count}").replace('{count}', String(editingRound.compensations[user.id]))}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {user.email && (
                                      <>
                                        <img
                                          src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png"
                                          alt="Gmail"
                                          style={{ width: 13, height: 10, objectFit: 'contain', flexShrink: 0 }}
                                        />
                                        <span>{user.email}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => removeUser(user.id, e)}
                                  style={{
                                    color: 'var(--color-text-muted)', padding: 4, borderRadius: 6,
                                    border: 'none', background: 'transparent', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'var(--color-danger-light)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              {/* Special Rule: Ratio + Data Per Turn */}
                              <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                {/* Row 1: Data per turn */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t("Nhận")}</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={formData.data_per_turns[user.id] || 1}
                                    onChange={e => setFormData({ ...formData, data_per_turns: { ...formData.data_per_turns, [user.id]: Math.max(1, parseInt(e.target.value) || 1) } })}
                                    style={{ width: 44, border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center', outline: 'none', color: theme === 'dark' ? '#34d399' : '#059669', fontWeight: 700, background: theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5' }}
                                  />
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t("Data liên tiếp mỗi lượt, sau mỗi")}</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={formData.ratios[user.id] || 1}
                                    onChange={e => setFormData({ ...formData, ratios: { ...formData.ratios, [user.id]: Math.max(1, parseInt(e.target.value) || 1) } })}
                                    style={{ width: 44, border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px', fontSize: '0.75rem', textAlign: 'center', outline: 'none', color: 'var(--color-primary)', fontWeight: 700, background: 'var(--color-bg)' }}
                                  />
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t("vòng")}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ padding: '1.25rem', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)', marginTop: 'auto' }}>
                  <button type="button" className="btn outline" onClick={() => { setModalOpen(false); setShowDropdown(false); }}>{isReadOnly ? t("Đóng") : t("Hủy bỏ")}</button>
                  {!isReadOnly && (
                    <button type="submit" className="btn primary" disabled={isSaving}>
                      {isSaving ? t('Đang lưu...') : (editingRound ? t('Cập nhật') : t('Thêm mới'))}
                    </button>
                  )}
                </div>
                </fieldset>
              </form>
            ) : activeTab === 'reports' ? (
              <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }} className="custom-scrollbar subtab-enter-active">
                {loadingReports ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>{t("Đang tải dữ liệu báo cáo...")}</div>
                ) : reports.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: 12 }}>
                    <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>{t("Chưa có báo cáo lỗi nào")}</p>
                    <p style={{ fontSize: '0.875rem' }}>{t("Các BÁO CÁO DATA của vòng này sẽ xuất hiện tại đây.")}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {reports.slice((reportsPage - 1) * reportsPageSize, reportsPage * reportsPageSize).map(r => {
                      const initials = r.lead_name ? r.lead_name.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase() : '?';
                      return (
                        <div key={r.id} className="compensation-report-row">
                          {/* Left Details */}
                          <div className="report-left-details">
                            <div style={{
                              width: 38, height: 38, borderRadius: '50%',
                              background: getColorForName(r.lead_name), color: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.8rem', fontWeight: 800, flexShrink: 0,
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                            }}>
                              {initials}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '0 0 220px', minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9375rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.lead_name}>
                                {r.lead_name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Avatar src={r.consultant_avatar} name={r.consultant_name} size={18} />
                                <span>{t('Sale:')} <strong style={{ color: 'var(--color-text)' }}>{r.consultant_name}</strong></span>
                              </div>
                            </div>

                            <div style={{
                              flex: 1,
                              minWidth: 220,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              borderLeft: '1px solid var(--color-border-light)',
                              paddingLeft: '1rem',
                              marginLeft: '0.5rem'
                            }} className="mobile-ml-0">
                              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text)' }}>
                                <span style={{
                                  fontWeight: 800,
                                  fontSize: '0.7rem',
                                  textTransform: 'uppercase',
                                  color: 'var(--color-danger)',
                                  background: 'var(--color-danger-light)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  marginRight: '8px',
                                  display: 'inline-block'
                                }}>{t('Lý do')}</span>
                                <span style={{ color: 'var(--color-text-light)' }}>{translateReason(r.reason)}</span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={12} style={{ opacity: 0.6 }} />
                                <span>{t('Báo cáo:')} {new Date(r.created_at).toLocaleString('vi-VN')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Actions / Status */}
                          <div className="report-right-actions">
                            {r.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                                <button
                                  onClick={() => handleReportAction(r.id, 'approve')}
                                  disabled={isActioning === r.id}
                                  className="btn primary sm hover-lift active-press"
                                  style={{
                                    background: 'linear-gradient(135deg, var(--color-success) 0%, oklch(75% 0.17 166) 100%)',
                                    borderColor: 'transparent',
                                    padding: '8px 16px',
                                    fontSize: '0.8125rem',
                                    fontWeight: 700,
                                    height: '36px',
                                    borderRadius: '8px',
                                    color: 'white',
                                    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  {isActioning === r.id ? t('Đang xử lý...') : t('Duyệt & Đền Bù')}
                                </button>
                                <button
                                  onClick={() => handleReportAction(r.id, 'reject')}
                                  disabled={isActioning === r.id}
                                  className="btn secondary sm hover-lift active-press"
                                  style={{
                                    color: 'var(--color-danger)',
                                    borderColor: 'var(--color-danger)',
                                    padding: '8px 16px',
                                    fontSize: '0.8125rem',
                                    fontWeight: 700,
                                    height: '36px',
                                    borderRadius: '8px',
                                    background: 'var(--color-surface)',
                                    boxShadow: 'none'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = 'var(--color-danger-light)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'var(--color-surface)';
                                  }}
                                >
                                  {t('Từ chối')}
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <div style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: r.status === 'approved' ? (theme === 'dark' ? '#34d399' : '#10b981') : 'var(--color-text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: r.status === 'approved' ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7') : (theme === 'dark' ? 'var(--color-bg)' : '#f1f5f9'),
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: r.status === 'approved' ? (theme === 'dark' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #bbf7d0') : (theme === 'dark' ? '1px solid var(--color-border)' : '1px solid #cbd5e1')
                                }}>
                                  {r.status === 'approved' ? <><Check size={12} /> {t('Đã duyệt đền bù')}</> : <><X size={12} /> {t('Đã từ chối')}</>}
                                </div>
                                {r.resolved_by && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                    <Avatar src={r.resolved_by_avatar} name={r.resolved_by} size={16} />
                                    <span>
                                      {r.resolved_by} • {(() => {
                                        const d = new Date(r.resolved_at);
                                        const pad = (n: number) => n.toString().padStart(2, '0');
                                        return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                                      })()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {reports.length > reportsPageSize && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', paddingRight: '0.25rem' }}>
                        <Pagination
                          total={reports.length}
                          page={reportsPage}
                          pageSize={reportsPageSize}
                          onChange={setReportsPage}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }} className="custom-scrollbar subtab-enter-active">
                {loadingActiveLogs ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>{t("Đang tải dữ liệu log...")}</div>
                ) : activeLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', borderRadius: 12 }}>
                    <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>{t("Chưa có log bù chủ động nào")}</p>
                    <p style={{ fontSize: '0.875rem' }}>{t("Lịch sử bù data thủ công của vòng này sẽ xuất hiện tại đây.")}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {activeLogs.slice((activeLogsPage - 1) * activeLogsPageSize, activeLogsPage * activeLogsPageSize).map(log => {
                      return (
                        <div 
                          key={log.id} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 18px',
                            border: '1px solid var(--color-border-light)',
                            borderRadius: '12px',
                            background: theme === 'dark' ? 'rgba(59, 130, 246, 0.02)' : 'rgba(59, 130, 246, 0.01)',
                            boxShadow: 'var(--shadow-sm)',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--color-border-light)';
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--color-border-light)' }}>
                              <Avatar src={log.admin_avatar} name={log.admin_name} size={20} />
                              <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.8125rem' }}>{log.admin_name}</span>
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{t('đã bù')}</span>
                              <span style={{ 
                                background: 'var(--color-primary-light)', 
                                color: 'var(--color-primary)', 
                                padding: '2px 8px', 
                                borderRadius: '6px', 
                                fontWeight: 800, 
                                fontSize: '0.875rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                boxShadow: 'inset 0 0 0 1px rgba(59, 130, 246, 0.1)'
                              }}>
                                +{log.amount}
                              </span>
                              <span>{t('data cho Sale')}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--color-border-light)' }}>
                              <Avatar src={log.consultant_avatar} name={log.consultant_name} size={20} />
                              <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.8125rem' }}>{log.consultant_name}</span>
                            </div>
                            {log.reason && (
                              <div style={{ 
                                fontSize: '0.775rem', 
                                color: 'var(--color-text-muted)', 
                                borderLeft: '2px solid var(--color-border)', 
                                paddingLeft: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                <span style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>{t('Lý do:')}</span> 
                                <span style={{ fontStyle: 'italic' }}>{translateReason(log.reason)}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ 
                            fontSize: '0.725rem', 
                            color: 'var(--color-text-muted)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            flexShrink: 0,
                            background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border-light)'
                          }}>
                            <Clock size={11} style={{ opacity: 0.7 }} />
                            <span>{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                          </div>
                        </div>
                      );
                    })}
                    {activeLogs.length > activeLogsPageSize && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', paddingRight: '0.25rem' }}>
                        <Pagination
                          total={activeLogs.length}
                          page={activeLogsPage}
                          pageSize={activeLogsPageSize}
                          onChange={setActiveLogsPage}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>, document.body
      )}

      {compModalOpen && compRound && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop" onClick={() => setCompModalOpen(false)}>
          <div
            className="modal-container custom-scrollbar"
            onClick={e => e.stopPropagation()}
            style={{ width: '90%', maxWidth: '550px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-2xl)', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', overflow: 'hidden', boxShadow: 'var(--shadow-xl)' }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg)' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={20} color="var(--color-primary)" /> {t("Quản lý Bù Data")}
                </h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{t("Vòng:")} <strong>{compRound.round_name}</strong></div>
              </div>
              <button onClick={() => setCompModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 8, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: 'transparent' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{t("Danh sách Tư vấn viên trong vòng")}</div>
                {compRound.consultant_ids ? compRound.consultant_ids.split(',').map((idStr: string) => {
                  const id = parseInt(idStr, 10);
                  const user = consultants.find(c => Number(c.id) === id);
                  if (!user) return null;
                  const currentComp = compData[id] || 0;
                  
                  return (
                    <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', background: currentComp > 0 ? 'var(--color-warning-light)' : 'var(--color-bg)', border: `1px solid ${currentComp > 0 ? 'var(--color-warning)' : 'var(--color-border)'}`, borderRadius: 12, transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar src={user.avatar} name={user.name} size={36} style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>{user.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{user.email}</div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button 
                            type="button"
                            onClick={() => setCompData({ ...compData, [id]: Math.max(0, currentComp - 1) })}
                            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                          >
                            -
                          </button>
                          <div style={{ width: 40, textAlign: 'center', fontSize: '1rem', fontWeight: 800, color: currentComp > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>
                            {currentComp}
                          </div>
                          <button 
                            type="button"
                            onClick={() => setCompData({ ...compData, [id]: currentComp + 1 })}
                            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      {currentComp > (compRound.compensations?.[id] || 0) && (
                        <div style={{ marginTop: '0.5rem', width: '100%', animation: 'slideUp 0.15s ease-out' }}>
                          <input
                            type="text"
                            placeholder={t("Nhập lý do bù chủ động (tùy chọn)...")}
                            value={compReasons[id] || ''}
                            onChange={(e) => setCompReasons({ ...compReasons, [id]: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '0.8125rem',
                              border: '1px solid var(--color-border)',
                              borderRadius: '8px',
                              background: 'var(--color-bg)',
                              color: 'var(--color-text)',
                              outline: 'none',
                              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                    {t("Chưa có thành viên nào trong vòng này")}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1.25rem', background: theme === 'dark' ? 'var(--color-bg)' : '#f8fafc', borderTop: theme === 'dark' ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn outline" onClick={() => setCompModalOpen(false)}>{t("Hủy bỏ")}</button>
              <button type="button" className="btn primary" onClick={handleSaveComp} disabled={isSavingComp}>
                {isSavingComp ? t('Đang lưu...') : t('Cập nhật Bù Data')}
              </button>
            </div>
          </div>
        </div>, document.body
      )}

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

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t("Cảnh báo Xóa Vòng Phân Bổ")}
        message={t("Bạn có chắc chắn muốn xóa vòng này không? Lưu ý: Việc xóa vòng phân bổ sẽ ảnh hưởng trực tiếp đến các Rule định tuyến đang trỏ đến vòng này!")}
        confirmText={t("Xóa vĩnh viễn")}
      />

      {/* Date Picker Modal */}
      <CustomModal
        isOpen={showDateModal}
        onClose={() => setShowDateModal(false)}
        title={t("Tùy chỉnh thời gian")}
        width="400px"
      >
        {showDateModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
            <div>
              <label className="form-label">{t('Từ ngày')}</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">{t('Đến ngày')}</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn outline" onClick={() => setShowDateModal(false)}>{t('Hủy')}</button>
              <button className="btn primary" onClick={handleCustomDateSubmit}>{t('Áp dụng')}</button>
            </div>
          </div>
        )}
      </CustomModal>

      {/* Mechanism Info Help Modal */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={t("Cơ chế & Thuật toán Phân bổ Data")}
        width="800px"
      >
        <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '1rem', 
            background: 'var(--color-primary-light)', 
            border: '1px solid rgba(163, 20, 34, 0.15)', 
            borderRadius: 12 
          }}>
            <HelpCircle size={28} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
              {t("Hệ thống phân phối data (Lead Routing) hoạt động tự động dựa trên thuật toán Round-Robin nâng cao, kết hợp nhiều lớp quy tắc và độ ưu tiên để đảm bảo tính tối ưu, công bằng và liên tục.")}
            </p>
          </div>

          {/* Section 1: Lead Priority Layers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} color="var(--color-primary)" />
              {t("1. Độ ưu tiên chia số (Lead Priority)")}
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {t("Khi một lead mới được đẩy vào, hệ thống quét danh sách Sale theo thứ tự ưu tiên từ trên xuống dưới:")}
            </p>
            
            {/* Visual Queue Layers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 4 }}>
              {/* Layer 1 */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                padding: '0.875rem', 
                background: theme === 'dark' ? 'rgba(239, 68, 68, 0.04)' : 'rgba(239, 68, 68, 0.02)', 
                borderLeft: '4px solid #ef4444', 
                borderTop: '1px solid var(--color-border-light)',
                borderRight: '1px solid var(--color-border-light)',
                borderBottom: '1px solid var(--color-border-light)',
                borderRadius: '0 8px 8px 0' 
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#ef4444' }}>
                  <RefreshCw size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {t("Mức 1: Bù nợ (Compensation)")}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {t("Bù data lỗi/Junk lead (tài khoản nợ bù > 0). Đây là mức có độ ưu tiên tuyệt đối để trả nợ cho Sale.")}
                  </div>
                </div>
              </div>

              {/* Layer 2 */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                padding: '0.875rem', 
                background: theme === 'dark' ? 'rgba(236, 72, 153, 0.04)' : 'rgba(236, 72, 153, 0.02)', 
                borderLeft: '4px solid #ec4899', 
                borderTop: '1px solid var(--color-border-light)',
                borderRight: '1px solid var(--color-border-light)',
                borderBottom: '1px solid var(--color-border-light)',
                borderRadius: '0 8px 8px 0' 
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#ec4899' }}>
                  <Clock size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {t("Mức 2: Bỏ lỡ (Starvation Prevention)")}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {t("Bù lượt bỏ lỡ ngoài giờ làm việc (nếu tính năng tự động bù lượt bỏ lỡ được bật).")}
                  </div>
                </div>
              </div>

              {/* Layer 3 */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                padding: '0.875rem', 
                background: theme === 'dark' ? 'rgba(189, 29, 45, 0.04)' : 'rgba(189, 29, 45, 0.02)', 
                borderLeft: '4px solid #BD1D2D', 
                borderTop: '1px solid var(--color-border-light)',
                borderRight: '1px solid var(--color-border-light)',
                borderBottom: '1px solid var(--color-border-light)',
                borderRadius: '0 8px 8px 0' 
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(189, 29, 45, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#BD1D2D' }}>
                  <Zap size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {t("Mức 3: Lượt kép (Mid-turn Continuity)")}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {t("Giao nốt lượt dở dang đối với Sale có cấu hình nhận nhiều lead liên tiếp trong một vòng (data_per_turn > 1).")}
                  </div>
                </div>
              </div>

              {/* Layer 4 */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                padding: '0.875rem', 
                background: theme === 'dark' ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.02)', 
                borderLeft: '4px solid #10b981', 
                borderTop: '1px solid var(--color-border-light)',
                borderRight: '1px solid var(--color-border-light)',
                borderBottom: '1px solid var(--color-border-light)',
                borderRadius: '0 8px 8px 0' 
              }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#10b981' }}>
                  <Scale size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    {t("Mức 4: Xoay vòng (Standard Round-Robin)")}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {t("Chia số tự động luân phiên tiêu chuẩn dựa trên tỷ lệ (receive_ratio) đã thiết lập cho mỗi Sale.")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Alternating Compensation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={18} color="#d97706" />
              {t("2. Cơ chế Đền bù xen kẽ (Tránh dồn dập)")}
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {t("Để Sale kịp gọi data cũ trước khi nhận data bù tiếp theo, hệ thống tự động giãn cách lượt bù:")}
            </p>

            {/* Visual Workflow Steps */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'stretch', 
              gap: 8, 
              marginTop: 6,
              flexWrap: 'wrap'
            }}>
              {/* Step 1 */}
              <div style={{ 
                flex: 1, 
                minWidth: 180,
                background: theme === 'dark' ? 'rgba(245, 158, 11, 0.05)' : '#fffbeb', 
                border: '1px solid rgba(245, 158, 11, 0.2)', 
                borderRadius: 10,
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#f59e0b', color: 'white', padding: '1px 5px', borderRadius: 4 }}>LEAD 1</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309' }}>{t("GIAO BÙ")}</span>
                </div>
                <p style={{ fontSize: '0.725rem', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>
                  {t("Giao bù cho Sale A.")}
                </p>
                <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t("Số nợ bù của A giảm đi 1.")}
                </p>
              </div>

              {/* Arrow */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }} className="hide-on-mobile">
                <ArrowRight size={16} color="var(--color-text-muted)" />
              </div>

              {/* Step 2 */}
              <div style={{ 
                flex: 1, 
                minWidth: 180,
                background: 'var(--color-bg)', 
                border: '1px solid var(--color-border)', 
                borderRadius: 10,
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, background: 'var(--color-text-muted)', color: 'white', padding: '1px 5px', borderRadius: 4 }}>LEAD 2</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t("XEN KẼ")}</span>
                </div>
                <p style={{ fontSize: '0.725rem', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>
                  {t("Tạm hoãn bù A ➔ Giao Sale B.")}
                </p>
                <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t("A vừa nhận lead nên được giảng cách.")}
                </p>
              </div>

              {/* Arrow */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }} className="hide-on-mobile">
                <ArrowRight size={16} color="var(--color-text-muted)" />
              </div>

              {/* Step 3 */}
              <div style={{ 
                flex: 1, 
                minWidth: 180,
                background: theme === 'dark' ? 'rgba(245, 158, 11, 0.05)' : '#fffbeb', 
                border: '1px solid rgba(245, 158, 11, 0.2)', 
                borderRadius: 10,
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#f59e0b', color: 'white', padding: '1px 5px', borderRadius: 4 }}>LEAD 3</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b45309' }}>{t("TIẾP TỤC BÙ")}</span>
                </div>
                <p style={{ fontSize: '0.725rem', color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>
                  {t("Giao bù tiếp cho Sale A.")}
                </p>
                <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t("Đủ khoảng cách xen kẽ an toàn.")}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Double assignment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Scale size={18} color="#10b981" />
              {t("3. Vì sao Sale nhận được 2 lead liên tiếp?")}
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {t("Hiện tượng một Sale nhận 2 data liên tiếp không phải lỗi hệ thống, mà là kết quả của sự giao thoa giữa hàng đợi Bù và hàng đợi Xoay vòng:")}
            </p>

            {/* Split timeline boxes */}
            <div style={{ 
              background: 'var(--color-bg)', 
              border: '1px solid var(--color-border)', 
              borderRadius: 12, 
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ 
                  width: 20, 
                  height: 20, 
                  borderRadius: '50%', 
                  background: '#f59e0b', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '0.7rem', 
                  fontWeight: 800,
                  flexShrink: 0,
                  marginTop: 2
                }}>1</div>
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>{t("Lượt 1: Nhận data Bù nợ (Ưu tiên Mức 1)")}</strong>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                    {t("Hệ thống thấy Sale A còn nợ bù ➔ kích hoạt đền bù để trả nợ. Giao xong, nợ của A về 0.")}
                  </p>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--color-border-light)' }} />

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ 
                  width: 20, 
                  height: 20, 
                  borderRadius: '50%', 
                  background: '#10b981', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '0.7rem', 
                  fontWeight: 800,
                  flexShrink: 0,
                  marginTop: 2
                }}>2</div>
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>{t("Lượt 2: Nhận data Xoay vòng thật (Standard Mức 4)")}</strong>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                    {t("Lượt tiếp theo về, hàng đợi Bù nợ trống. Hệ thống chuyển sang xoay vòng Standard. Vòng xoay tự động tình cờ đang tới lượt của Sale A ➔ tiếp tục giao cho Sale A.")}
                  </p>
                </div>
              </div>
            </div>
            
            <p style={{ fontSize: '0.725rem', fontStyle: 'italic', color: 'var(--color-text-muted)', margin: '4px 0 0 0', display: 'flex', gap: 4, alignItems: 'center' }}>
              <AlertCircle size={12} style={{ flexShrink: 0 }} />
              {t("Lưu ý: Cơ chế bù xen kẽ chỉ chặn \"bù liên tiếp\", không chặn lượt xoay vòng tự nhiên khi vòng xoay đến hàng của Sale.")}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
          <button className="btn primary" onClick={() => setShowInfoModal(false)} style={{ minWidth: 100 }}>{t("Đồng ý")}</button>
        </div>
      </CustomModal>
    </div>
  );
};

export const Rounds = withRouterFreezer(RoundsInner, '/rounds');
