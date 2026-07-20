import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { withRouterFreezer } from '../components/RouterFreezer';
import { fetchAPI } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Clock, Calendar, Check, X, Trash2, Eye, ShieldAlert, AlertCircle, CheckCircle, Info, Download, Lightbulb, Upload, ChevronLeft, ChevronRight, Camera, Image, FileText, Zap, RefreshCw, Moon } from 'lucide-react';
import toast from 'react-hot-toast';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import { useUIStore } from '../store/uiStore';
import type { Period, DateRange } from '../components/ui/PeriodFilter';

const resolveAttachmentUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const baseClean = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const pathClean = path.startsWith('/') ? path : '/' + path;
  return `${baseClean}${pathClean}`;
};

export const AttendancePageInner = ({ embedMode = false }: { embedMode?: boolean }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showConfirm } = useUIStore();
  const location = useLocation();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [sysSettings, setSysSettings] = useState<any>(null);
  const managerBehaviorMode = user?.manager_behavior_mode || 'combined';
  const isSales = user?.role === 'sale' || (user?.role === 'manager' && managerBehaviorMode === 'combined');
  const canSelectUser = ['admin', 'superadmin', 'super_admin', 'director', 'assistant', 'manager'].includes(user?.role || '');
  const canApprove = ['admin', 'superadmin', 'super_admin', 'director', 'assistant'].includes(user?.role || '') || (user?.role === 'manager' && managerBehaviorMode === 'pure');
  useEffect(() => {
    fetchAPI('get_settings').then(res => {
      if (res && res.success) {
        setSysSettings(res.data);
      }
    });
  }, []);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get('date') || params.get('open_date');
    const viewParam = params.get('view');

    if (viewParam === 'calendar') {
      setViewMode('calendar');
    } else if (viewParam === 'list') {
      setViewMode('list');
    }

    if (dateParam) {
      const parts = dateParam.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        if (!isNaN(year) && !isNaN(month)) {
          setCurrentYear(year);
          setCurrentMonth(month);
        }
      }
      setSelectedDateForDetail(dateParam);
      setModalTab('checkin');
    }
  }, [location.search]);

  const [loading, setLoading] = useState(true);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [consultants, setConsultants] = useState<any[]>([]);

  // View mode switcher: list or calendar (default to calendar for quick overview, list for embed mode)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(() => {
    return 'calendar';
  });
  const [currentMonth, setCurrentMonth] = useState<number>(7); // July 2026 default
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [calendarCheckIns, setCalendarCheckIns] = useState<any[]>([]);
  const [calendarShifts, setCalendarShifts] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Theme support
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  // Filter states
  const [period, setPeriod] = useState<Period>('7d');
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    // Default range (last 7 days from July 1, 2026 for demo integrity)
    return { from: '2026-06-25', to: '2026-07-01' };
  });
  const [filterUser, setFilterUser] = useState<string>(isSales ? String(user?.id) : 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Selected date for detail modal
  const [selectedDateForDetail, setSelectedDateForDetail] = useState<string | null>(null);
  const hasCheckIn = selectedDateForDetail ? calendarCheckIns.some(c => c.check_in_date === selectedDateForDetail) : false;
  const [modalTab, setModalTab] = useState<'checkin' | 'fingerprint' | 'night_duty'>('checkin');

  // Shift registration approval states
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [filterRegType, setFilterRegType] = useState<string>('all');
  const [filterRegStatus, setFilterRegStatus] = useState<string>('all');
  const [actioningRegId, setActioningRegId] = useState<number | null>(null);

  // Supplementary check-in states
  const [suppTime, setSuppTime] = useState('08:00');
  const [suppReason, setSuppReason] = useState('');
  const [suppSubmitting, setSuppSubmitting] = useState(false);

  // Preview Image Modal state
  const [previewCheckIn, setPreviewCheckIn] = useState<any | null>(null);

  // Confirm delete states
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action submitting state
  const [actionSubmittingId, setActionSubmittingId] = useState<number | null>(null);

  const downloadDayExcel = (date: string) => {
    const dayCheckIns = calendarCheckIns.filter(c => c.check_in_date === date);
    const headers = 'STT,Nhân viên,Email,Giờ quy định,Giờ check-in,Trạng thái,Lý do trễ\n';
    const rows = dayCheckIns.map((c, i) => {
      const statusText = c.status === 'approved' ? 'Hợp lệ/Đúng giờ' : (c.status === 'pending_approval' ? 'Chờ duyệt đi trễ' : 'Từ chối');
      return `${i + 1},${c.user_name},${c.user_email},${c.work_start_time || '08:00'},${c.check_in_time},${statusText},"${c.reason || ''}"`;
    }).join('\n');
    
    const csvContent = '\uFEFF' + headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cham_cong_rich_land_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('Đã xuất file chấm công ngày ') + date);
  };

  const handleGoToToday = () => {
    setCurrentMonth(7);
    setCurrentYear(2026);
    toast.success(t('Đã chuyển về tháng hiện tại'));
  };

  const fetchConsultantsList = async () => {
    try {
      const res = await fetchAPI('get_consultants');
      if (res.success) {
        setConsultants(res.data || []);
      }
    } catch (e: any) {
      console.error('Error fetching consultants list:', e);
    }
  };

  const fetchCheckInsList = async () => {
    setLoading(true);
    try {
      const range = period === 'custom' ? customRange : getDateRange(period);
      const query = `check-ins&from=${range.from}&to=${range.to}&status=${filterStatus}&user_id=${filterUser}`;
      const res = await fetchAPI(query);
      if (res.success) {
        setCheckIns(res.data || []);
      } else {
        toast.error(res.message || t('Lỗi khi tải danh sách chấm công'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarCheckIns = async () => {
    setCalendarLoading(true);
    try {
      const query = `check-ins&year=${currentYear}&month=${currentMonth}&status=${filterStatus}&user_id=${filterUser}&include_shifts=1`;
      const res = await fetchAPI(query);
      if (res.success) {
        if (res.data && res.data.check_ins) {
          setCalendarCheckIns(res.data.check_ins || []);
          setCalendarShifts(res.data.shifts || []);
        } else {
          setCalendarCheckIns(res.data || []);
          setCalendarShifts([]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching calendar check-ins:', err);
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultantsList();
  }, []);

  useEffect(() => {
    fetchCheckInsList();
    setCurrentPage(1);
  }, [period, customRange, filterUser, filterStatus]);

  useEffect(() => {
    if (viewMode === 'calendar') {
      fetchCalendarCheckIns();
    } else if ((viewMode as string) === 'registrations') {
      fetchRegistrations();
    }
  }, [viewMode, currentMonth, currentYear, filterUser, filterStatus]);

  const fetchRegistrations = async () => {
    if (!canApprove) return;
    setRegistrationsLoading(true);
    try {
      const res = await fetchAPI('get_shift_registrations_admin');
      if (res.success) {
        setRegistrations(res.registrations || []);
      } else {
        toast.error(res.message || t('Lỗi tải danh sách đăng ký trực ca'));
      }
    } catch (err: any) {
      console.error(err);
      toast.error(t('Lỗi kết nối máy chủ'));
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const handleApproveRegistration = async (id: number, shiftType: string) => {
    setActioningRegId(id);
    try {
      const res = await fetchAPI('approve_shift_registration', {
        method: 'POST',
        body: JSON.stringify({ id, shift_type: shiftType })
      });
      if (res.success) {
        toast.success(t('Phê duyệt đăng ký ca thành công!'));
        fetchRegistrations();
      } else {
        toast.error(res.message || t('Phê duyệt thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi: ') + err.message);
    } finally {
      setActioningRegId(null);
    }
  };

  const handleRejectRegistration = async (id: number, shiftType: string) => {
    setActioningRegId(id);
    try {
      const res = await fetchAPI('reject_shift_registration', {
        method: 'POST',
        body: JSON.stringify({ id, shift_type: shiftType })
      });
      if (res.success) {
        toast.success(t('Từ chối đăng ký ca thành công!'));
        fetchRegistrations();
      } else {
        toast.error(res.message || t('Từ chối thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi: ') + err.message);
    } finally {
      setActioningRegId(null);
    }
  };

  const handleUpdateStatus = async (id: number, status: 'approved' | 'rejected', reason?: string) => {
    setActionSubmittingId(id);
    try {
      const res = await fetchAPI(`check-ins/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, reason })
      });
      if (res.success) {
        toast.success(status === 'approved' ? t('Đã duyệt chấm công thành công') : t('Đã từ chối chấm công'));
        fetchCheckInsList();
        if (viewMode === 'calendar') {
          fetchCalendarCheckIns();
        }
      } else {
        toast.error(res.message || t('Cập nhật trạng thái thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi: ') + err.message);
    } finally {
      setActionSubmittingId(null);
    }
  };

  const openDeleteConfirm = (id: number) => {
    setDeleteId(id);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteCheckIn = async () => {
    if (!deleteId || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetchAPI(`check-ins/${deleteId}`, {
        method: 'DELETE'
      });
      if (res.success) {
        toast.success(t('Đã xóa bản ghi chấm công thành công!'));
        setConfirmDeleteOpen(false);
        fetchCheckInsList();
        if (viewMode === 'calendar') {
          fetchCalendarCheckIns();
        }
      } else {
        toast.error(res.message || t('Lỗi khi xóa bản ghi'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi kết nối: ') + err.message);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleSubSupplementary = async () => {
    if (!suppReason.trim()) {
      toast.error(t('Vui lòng điền lý do/ghi chú bổ sung'));
      return;
    }
    setSuppSubmitting(true);
    try {
      const res = await fetchAPI('check-ins', {
        method: 'POST',
        body: JSON.stringify({
          check_in_date: selectedDateForDetail,
          check_in_time: `${suppTime}:00`,
          reason: suppReason
        })
      });
      if (res.success) {
        toast.success(t('Đã gửi yêu cầu chấm công bổ sung thành công! Đang chờ admin duyệt.'));
        setSuppReason('');
        fetchCalendarCheckIns();
        fetchCheckInsList();
      } else {
        toast.error(res.message || t('Gửi yêu cầu thất bại'));
      }
    } catch (err: any) {
      toast.error(t('Lỗi: ') + err.message);
    } finally {
      setSuppSubmitting(false);
    }
  };

  // Stats calculation
  const totalCount = checkIns.length;
  const approvedCount = checkIns.filter(c => c.status === 'approved').length;
  const pendingCount = checkIns.filter(c => c.status === 'pending_approval').length;
  const rejectedCount = checkIns.filter(c => c.status === 'rejected').length;

  const renderCalendarView = () => {
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();
    const adjustedFirstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    
    const cells: any[] = [];
    
    for (let i = adjustedFirstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        dateStr: ''
      });
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        isCurrentMonth: true,
        dateStr
      });
    }
    
    const totalCellsNeeded = 42;
    const nextMonthPadding = totalCellsNeeded - cells.length;
    for (let i = 1; i <= nextMonthPadding; i++) {
      cells.push({
        day: i,
        isCurrentMonth: false,
        dateStr: ''
      });
    }
    
    const weekDays = [t('Thứ 2'), t('Thứ 3'), t('Thứ 4'), t('Thứ 5'), t('Thứ 6'), t('Thứ 7'), t('CN')];

    const getCellData = (dateStr: string) => {
      if (!dateStr) return null;
      return calendarCheckIns.filter(c => c.check_in_date === dateStr);
    };

    const getCellShifts = (dateStr: string) => {
      if (!dateStr) return [];
      return calendarShifts.filter(s => s.shift_date === dateStr);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Unified month switcher */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '2px 8px',
              height: '38px',
              overflow: 'hidden'
            }}>
              <button
                type="button"
                onClick={() => {
                  if (currentMonth === 1) {
                    setCurrentMonth(12);
                    setCurrentYear(prev => prev - 1);
                  } else {
                    setCurrentMonth(prev => prev - 1);
                  }
                }}
                className="btn ghost sm"
                style={{ padding: '0 8px', height: '100%', borderRadius: '50%', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeft size={16} />
              </button>
              
              <span style={{ fontSize: '0.875rem', fontWeight: 700, padding: '0 12px', minWidth: '120px', textAlign: 'center', color: 'var(--color-text)' }}>
                {t('Tháng {month} / {year}').replace('{month}', String(currentMonth)).replace('{year}', String(currentYear))}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (currentMonth === 12) {
                    setCurrentMonth(1);
                    setCurrentYear(prev => prev + 1);
                  } else {
                    setCurrentMonth(prev => prev + 1);
                  }
                }}
                className="btn ghost sm"
                style={{ padding: '0 8px', height: '100%', borderRadius: '50%', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Today Button */}
            <button
              type="button"
              onClick={handleGoToToday}
              className="btn outline"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                borderRadius: 'var(--radius-md)',
                height: '38px',
                padding: '0 16px',
                fontWeight: 600,
                fontSize: '0.8125rem',
                background: 'var(--color-surface)'
              }}
            >
              {t('Hôm nay')}
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', flexWrap: isMobile ? 'nowrap' : 'wrap', width: isMobile ? '100%' : 'auto' }}>
            {/* User Select */}
            {canSelectUser && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: isMobile ? '1 1 0%' : 'none', minWidth: isMobile ? '0' : '180px' }}>
                <label style={{ fontSize: isMobile ? '0.625rem' : '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: isMobile ? '2px' : 0 }}>{t('Nhân viên')}</label>
                <CustomSelect
                  options={[
                    { value: 'all', label: t('Tất cả nhân viên') },
                    ...consultants.map(c => ({ 
                      value: String(c.id), 
                      label: c.name,
                      avatar: resolveAttachmentUrl(c.avatar_url || c.avatar)
                    }))
                  ]}
                  value={filterUser}
                  onChange={(val) => setFilterUser(String(val))}
                  width="100%"
                  searchable={true}
                  showAvatars={true}
                />
              </div>
            )}

            {/* Status Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: isMobile ? '1 1 0%' : 'none', minWidth: isMobile ? '0' : '180px' }}>
              <label style={{ fontSize: isMobile ? '0.625rem' : '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: isMobile ? '2px' : 0 }}>{t('Trạng thái duyệt')}</label>
              <CustomSelect
                options={[
                  { value: 'all', label: t('Tất cả trạng thái') },
                  { value: 'approved', label: t('Đã duyệt / Đúng giờ') },
                  { value: 'pending_approval', label: t('Chờ duyệt đi trễ') },
                  { value: 'rejected', label: t('Đã từ chối') }
                ]}
                value={filterStatus}
                onChange={(val) => setFilterStatus(String(val))}
                width="100%"
              />
            </div>

            <button
              onClick={() => {
                setPeriod('7d');
                setCustomRange({ from: '2026-06-25', to: '2026-07-01' });
                setCurrentMonth(7);
                setCurrentYear(2026);
                setFilterUser(isSales ? String(user?.id) : 'all');
                setFilterStatus('all');
              }}
              className="btn outline"
              style={{ 
                height: isMobile ? '34px' : '38px', 
                borderRadius: 'var(--radius-md)', 
                fontSize: isMobile ? '0.7rem' : '0.8125rem', 
                padding: isMobile ? '0 10px' : '0 16px',
                alignSelf: 'flex-end',
                flexShrink: 0
              }}
            >
              {isMobile ? t('Đặt lại') : t('Đặt lại bộ lọc')}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', width: '100%', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-light)' }} className="custom-scrollbar">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
            backgroundColor: 'var(--color-border-light)',
            overflow: 'hidden',
            minWidth: isMobile ? '700px' : 'auto'
          }}>
          {weekDays.map((day, idx) => (
            <div key={idx} style={{
              backgroundColor: 'var(--color-surface)',
              padding: '12px 4px',
              textAlign: 'center',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: idx === 6 ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: '2px solid var(--color-border-light)'
            }}>
              {day}
            </div>
          ))}

          {cells.map((cell, idx) => {
            const dayCheckIns = getCellData(cell.dateStr);
            const dayShifts = getCellShifts(cell.dateStr) || [];
            const isWeekend = (idx % 7 === 5 || idx % 7 === 6);

            const approved = dayCheckIns ? dayCheckIns.filter(c => c.status === 'approved') : [];
            const pending = dayCheckIns ? dayCheckIns.filter(c => c.status === 'pending_approval') : [];
            const rejected = dayCheckIns ? dayCheckIns.filter(c => c.status === 'rejected') : [];
            const isToday = cell.dateStr && new Date().toDateString() === new Date(cell.dateStr).toDateString();
            const hasPending = cell.dateStr && (pending.length > 0 || dayShifts.some(s => Number(s.approved) === 0));

            return (
              <div
                key={idx}
                onClick={() => {
                  if (cell.dateStr) {
                    setSelectedDateForDetail(cell.dateStr);
                  }
                }}
                style={{
                  backgroundColor: cell.isCurrentMonth
                    ? isWeekend
                      ? 'rgba(142, 142, 147, 0.02)'
                      : 'var(--color-surface)'
                    : 'rgba(142, 142, 147, 0.05)',
                  minHeight: '96px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: cell.dateStr ? 'pointer' : 'default',
                  opacity: cell.isCurrentMonth ? 1 : 0.4,
                  position: 'relative',
                  border: cell.dateStr
                    ? hasPending
                      ? '2px solid var(--color-warning, #f59e0b)'
                      : isToday
                        ? '2px solid var(--color-danger, #ef4444)'
                        : '2px solid transparent'
                    : 'none',
                  boxSizing: 'border-box'
                }}
                className={cell.dateStr ? 'calendar-day-cell' : ''}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: isToday ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))' : 'transparent',
                    color: isToday ? 'white' : cell.isCurrentMonth ? 'var(--color-text)' : 'var(--color-text-muted)',
                    boxShadow: isToday ? '0 2px 6px rgba(189, 29, 45, 0.3)' : 'none'
                  }}>{cell.day}</span>
                  {isToday && (
                    <span style={{ 
                      width: '6px', 
                      height: '6px', 
                      borderRadius: '50%', 
                      backgroundColor: 'var(--color-primary)', 
                      display: 'inline-block' 
                    }} title={t('Hôm nay')} />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  {calendarLoading && cell.isCurrentMonth ? (
                    <div style={{ height: '4px', backgroundColor: 'var(--color-border-light)', borderRadius: '2px', animation: 'pulse 1.5s infinite' }} />
                  ) : cell.dateStr ? (
                    <>
                      {/* 1. Render Check-ins */}
                      {dayCheckIns && dayCheckIns.length > 0 && (
                        filterUser === 'all' ? (
                          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '4px', marginTop: '2px' }}>
                            {dayCheckIns.slice(0, 5).map((c: any, index: number) => {
                              const statusColor = 
                                c.status === 'approved' ? 'var(--color-success)' :
                                c.status === 'pending_approval' ? 'var(--color-warning)' :
                                'var(--color-danger)';
                              return (
                                <div 
                                  key={c.id} 
                                  style={{ 
                                    position: 'relative', 
                                    display: 'inline-block',
                                    marginLeft: index === 0 ? 0 : '-8px',
                                    zIndex: 5 - index
                                  }} 
                                  className="calendar-avatar-item"
                                  title={`${c.user_name} (${c.check_in_time})`}
                                >
                                  <Avatar 
                                    src={resolveAttachmentUrl(c.user_avatar)} 
                                    name={c.user_name} 
                                    size={24} 
                                    style={{ border: '2px solid var(--color-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                                  />
                                  <span style={{
                                    position: 'absolute',
                                    bottom: '0px',
                                    right: '0px',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: statusColor,
                                    border: '1px solid var(--color-surface)',
                                  }} />
                                </div>
                              );
                            })}
                            {dayCheckIns.length > 5 && (
                              <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--color-bg-light)',
                                border: '2px solid var(--color-surface)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                color: 'var(--color-text-muted)',
                                marginLeft: '-8px',
                                zIndex: 1,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                              }}>
                                {dayCheckIns.length}
                              </div>
                            )}
                          </div>
                        ) : (
                          dayCheckIns.map(c => {
                            const checkInLate = c.check_in_time > (c.work_start_time || '08:00');
                            const isApproved = c.status === 'approved';
                            const isPending = c.status === 'pending_approval';
                            return (
                              <div
                                key={c.id}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  padding: '5px 8px',
                                  borderRadius: '8px',
                                  border: '1px solid',
                                  backgroundColor: 
                                    isApproved 
                                      ? (checkInLate ? 'rgba(0, 122, 255, 0.06)' : 'rgba(16, 185, 129, 0.08)') 
                                      : isPending ? 'rgba(245, 158, 11, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                                  borderColor: 
                                    isApproved 
                                      ? (checkInLate ? 'rgba(0, 122, 255, 0.15)' : 'rgba(16, 185, 129, 0.15)') 
                                      : isPending ? 'rgba(245, 158, 11, 0.2)' :
                                      'rgba(239, 68, 68, 0.2)',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                }}
                                className="single-checkin-tag"
                              >
                                <div style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  color: 
                                    isApproved 
                                      ? (checkInLate ? '#007aff' : '#10b981') 
                                      : isPending ? '#d97706' :
                                      '#ef4444',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '4px'
                                }}>
                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                                    {isSales ? t('Check-in') : c.user_name}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>{c.check_in_time.substring(0, 5)}</span>
                                    {c.selfie_url && <Camera size={10} style={{ opacity: 0.8 }} />}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )
                      )}

                      {/* 2. Render Shift Registrations */}
                      {dayShifts.length > 0 && (
                        filterUser === 'all' ? (
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px', paddingLeft: '4px' }}>
                            {(() => {
                              const nights = dayShifts.filter(s => s.shift_type === 'night');
                              const weekends = dayShifts.filter(s => s.shift_type === 'weekend');
                              const holidays = dayShifts.filter(s => s.shift_type === 'holiday');
                              return (
                                <>
                                  {nights.length > 0 && (
                                    <span 
                                      style={{ fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontWeight: 700 }}
                                      title={t('Trực đêm: ') + nights.map(n => n.user_name).join(', ')}
                                    >
                                      🌙 {nights.length}
                                    </span>
                                  )}
                                  {weekends.length > 0 && (
                                    <span 
                                      style={{ fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)', fontWeight: 700 }}
                                      title={t('Cuối tuần: ') + weekends.map(w => w.user_name).join(', ')}
                                    >
                                      📅 {weekends.length}
                                    </span>
                                  )}
                                  {holidays.length > 0 && (
                                    <span 
                                      style={{ fontSize: '0.65rem', padding: '2px 5px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 700 }}
                                      title={t('Ngày lễ: ') + holidays.map(h => h.user_name).join(', ')}
                                    >
                                      🎉 {holidays.length}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                            {dayShifts.map(s => {
                              let label = t('Trực đêm');
                              let bg = 'rgba(245, 158, 11, 0.05)';
                              let border = 'rgba(245, 158, 11, 0.2)';
                              let text = '#d97706';
                              if (s.shift_type === 'weekend') {
                                label = t('Cuối tuần');
                                bg = 'rgba(99, 102, 241, 0.05)';
                                border = 'rgba(99, 102, 241, 0.2)';
                                text = 'var(--color-primary)';
                              } else if (s.shift_type === 'holiday') {
                                label = s.holiday_name ? `${t('Lễ')} (${s.holiday_name})` : t('Ngày lễ');
                                bg = 'rgba(239, 68, 68, 0.05)';
                                border = 'rgba(239, 68, 68, 0.2)';
                                text = '#ef4444';
                              }

                              const isAppr = Number(s.approved) === 1;

                              return (
                                <div key={`${s.shift_type}-${s.id}`} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '0.68rem',
                                  padding: '3px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid ' + border,
                                  backgroundColor: bg,
                                  color: text,
                                  fontWeight: 600
                                }} title={`${label} (${isAppr ? t('Đã duyệt') : t('Chờ duyệt')})`}>
                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                                    {label}
                                  </span>
                                  <span style={{ fontSize: '0.625rem', opacity: 0.8, fontWeight: 800 }}>
                                    {isAppr ? '✓' : '?'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
          </div>
        </div>

        <style>{`
          .hover-bg-muted:hover {
            background-color: var(--color-bg) !important;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }
          .calendar-day-cell {
            transition: all 0.2s ease-in-out;
          }
          .calendar-day-cell:hover {
            background-color: var(--color-bg-light) !important;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            z-index: 2;
          }
          .calendar-avatar-item {
            transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }
          .calendar-avatar-item:hover {
            transform: scale(1.25) translateY(-3px);
            z-index: 20 !important;
          }
          .single-checkin-tag {
            transition: all 0.2s ease;
          }
          .single-checkin-tag:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
        `}</style>
      </div>
    );
  };

  const renderRegistrationsView = () => {
    // Filter registrations
    const filteredRegs = registrations.filter(r => {
      const matchType = filterRegType === 'all' || r.shift_type === filterRegType;
      const matchStatus = filterRegStatus === 'all' || 
        (filterRegStatus === 'pending' && Number(r.approved) === 0) ||
        (filterRegStatus === 'approved' && Number(r.approved) === 1);
      return matchType && matchStatus;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Filters bar */}
        <div style={{
          display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
          background: 'var(--color-surface)', padding: '12px 16px', borderRadius: '12px',
          border: '1px solid var(--color-border)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
            <label className="form-label" style={{ fontSize: '0.725rem', marginBottom: 0 }}>{t('Loại ca trực')}</label>
            <select
              className="form-select"
              value={filterRegType}
              onChange={e => setFilterRegType(e.target.value)}
              style={{ height: '36px', fontSize: '0.8rem' }}
            >
              <option value="all">{t('Tất cả các ca')}</option>
              <option value="night">{t('Ca đêm')}</option>
              <option value="weekend">{t('Cuối tuần')}</option>
              <option value="holiday">{t('Ngày lễ')}</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
            <label className="form-label" style={{ fontSize: '0.725rem', marginBottom: 0 }}>{t('Trạng thái')}</label>
            <select
              className="form-select"
              value={filterRegStatus}
              onChange={e => setFilterRegStatus(e.target.value)}
              style={{ height: '36px', fontSize: '0.8rem' }}
            >
              <option value="all">{t('Tất cả trạng thái')}</option>
              <option value="pending">{t('Chờ duyệt')}</option>
              <option value="approved">{t('Đã duyệt')}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={fetchRegistrations}
            className="btn outline icon-only"
            disabled={registrationsLoading}
            style={{ height: '36px', width: '36px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
            title={t('Tải lại danh sách')}
          >
            <RefreshCw size={14} className={registrationsLoading ? 'spin' : ''} />
          </button>
        </div>

        {/* Table representation */}
        <div className="card" style={{ padding: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: '600px', overflowY: 'auto' }}>
            <table className="mobile-table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', background: 'var(--color-bg)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('NHÂN VIÊN')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('LOẠI CA')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('NGÀY ĐĂNG KÝ TRỰC')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('THỜI GIAN ĐĂNG KÝ')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TRẠNG THÁI')}</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'right' }}>{t('HÀNH ĐỘNG')}</th>
                </tr>
              </thead>
              <tbody>
                {registrationsLoading ? (
                  [...Array(4)].map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                ) : filteredRegs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      <Info size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                      {t('Không có yêu cầu đăng ký trực ca nào.')}
                    </td>
                  </tr>
                ) : (
                  filteredRegs.map((row) => {
                    let typeBadgeColor = 'rgba(99, 102, 241, 0.1)';
                    let typeTextColor = 'var(--color-primary)';
                    let typeLabel = t('Cuối tuần');
                    if (row.shift_type === 'night') {
                      typeBadgeColor = 'rgba(245, 158, 11, 0.1)';
                      typeTextColor = 'var(--color-warning)';
                      typeLabel = t('Ca đêm');
                    } else if (row.shift_type === 'holiday') {
                      typeBadgeColor = 'rgba(239, 68, 68, 0.1)';
                      typeTextColor = 'var(--color-danger)';
                      typeLabel = row.holiday_name ? `${t('Nghỉ lễ')} (${row.holiday_name})` : t('Ngày lễ');
                    }

                    const isApproved = Number(row.approved) === 1;

                    return (
                      <tr key={`${row.shift_type}-${row.id}`} style={{ borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem' }} className="group table-row-hover">
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src="" name={row.user_name} size={32} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.user_name}</span>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '0.725rem',
                            background: typeBadgeColor, color: typeTextColor
                          }}>
                            {typeLabel}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-text)' }}>
                          {row.shift_date}
                        </td>

                        <td style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
                          {row.created_at ? new Date(row.created_at.replace(' ', 'T') + '+07:00').toLocaleString('vi-VN') : '—'}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          {isApproved ? (
                            <span style={{
                              padding: '4px 8px', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700,
                              background: 'var(--color-success-light)', color: 'var(--color-success)'
                            }}>
                              {t('Đã duyệt')}
                            </span>
                          ) : (
                            <span style={{
                              padding: '4px 8px', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700,
                              background: 'var(--color-warning-light)', color: 'var(--color-warning)'
                            }}>
                              {t('Chờ duyệt')}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            {!isApproved ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveRegistration(row.id, row.shift_type)}
                                  disabled={actioningRegId === row.id}
                                  className="btn success sm icon-only"
                                  title={t('Phê duyệt')}
                                  style={{ width: 28, height: 28, padding: 0, borderRadius: '6px' }}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    showConfirm({
                                      title: t('Từ chối đăng ký'),
                                      message: t('Bạn chắc chắn muốn từ chối yêu cầu đăng ký trực ca của {name}?').replace('{name}', row.user_name),
                                      onConfirm: () => handleRejectRegistration(row.id, row.shift_type)
                                    });
                                  }}
                                  disabled={actioningRegId === row.id}
                                  className="btn danger sm icon-only"
                                  title={t('Từ chối')}
                                  style={{ width: 28, height: 28, padding: 0, borderRadius: '6px' }}
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  showConfirm({
                                    title: t('Huỷ phê duyệt'),
                                    message: t('Bạn chắc chắn muốn huỷ phê duyệt đăng ký trực ca này? (Hệ thống sẽ xoá bản ghi đăng ký của nhân viên)'),
                                    onConfirm: () => handleRejectRegistration(row.id, row.shift_type)
                                  });
                                }}
                                disabled={actioningRegId === row.id}
                                className="btn outline sm danger icon-only"
                                title={t('Huỷ phê duyệt')}
                                style={{ width: 28, height: 28, padding: 0, borderRadius: '6px', border: '1px solid var(--color-border)' }}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      {!embedMode && (
        <div className="page-header flex-col-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {t('Quản lý Chấm công')}
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
                title={t("Xem hướng dẫn cơ chế chấm công & khóa phân phối lead")}
              >
                <Info size={12} style={{ marginTop: 1 }} />
                <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
              </button>
            </h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              {t('Kiểm duyệt ảnh selfie chấm công hàng ngày và phê duyệt đi trễ của nhân viên.')}
            </p>
          </div>

          {/* View Mode Switcher */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--color-border-light)',
            border: '1px solid var(--color-border)',
            padding: '2px',
            borderRadius: '8px',
            gap: '2px',
            width: 'fit-content'
          }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                height: '30px',
                padding: '0 16px',
                fontSize: '0.85rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: viewMode === 'list' ? 'var(--color-surface)' : 'transparent',
                color: viewMode === 'list' ? 'var(--color-text)' : 'var(--color-text-light)',
                boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              <Clock size={14} />
              {t('Danh sách')}
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              style={{
                height: '30px',
                padding: '0 16px',
                fontSize: '0.85rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: viewMode === 'calendar' ? 'var(--color-surface)' : 'transparent',
                color: viewMode === 'calendar' ? 'var(--color-text)' : 'var(--color-text-light)',
                boxShadow: viewMode === 'calendar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              <Calendar size={14} />
              {t('Lịch biểu')}
            </button>
            {canApprove && (
              <button
                onClick={() => setViewMode('registrations' as any)}
                style={{
                  height: '30px',
                  padding: '0 16px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: (viewMode as string) === 'registrations' ? 'var(--color-surface)' : 'transparent',
                  color: (viewMode as string) === 'registrations' ? 'var(--color-text)' : 'var(--color-text-light)',
                  boxShadow: (viewMode as string) === 'registrations' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                <Zap size={14} />
                {t('Duyệt đăng ký ca')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {/* Card 1: Total */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          padding: '0.875rem 1.125rem',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          transition: 'all 0.2s ease'
        }}>
          <div className="decor-svg" style={{ color: 'var(--color-text-muted)' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <rect x="25" y="25" width="50" height="50" rx="5" stroke="currentColor" strokeWidth="2" />
              <path d="M25 40 H 75 M 40 20 V 30 M 60 20 V 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
              {t('TỔNG BẢN GHI')}
            </span>
            <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-light)', color: 'var(--color-text-muted)' }}>
              <Calendar size={14} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px', lineHeight: 1.1 }}>
            {totalCount}
          </div>
          <div style={{
            marginTop: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            fontSize: '0.7rem',
            color: 'var(--color-text-muted)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-text-muted)' }} />
              {t('Ghi nhận từ các TVV')}
            </span>
          </div>
        </div>

        {/* Card 2: Approved */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          padding: '0.875rem 1.125rem',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          transition: 'all 0.2s ease'
        }}>
          <div className="decor-svg" style={{ color: '#10b981' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <path d="M30 50 L 45 65 L 75 35" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, letterSpacing: '0.05em' }}>
              {t('ĐÃ DUYỆT / HỢP LỆ')}
            </span>
            <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <CheckCircle size={14} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.625rem', fontWeight: 800, color: '#10b981', marginTop: '4px', lineHeight: 1.1 }}>
            {approvedCount}
          </div>
          <div style={{
            marginTop: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            fontSize: '0.7rem',
            color: 'var(--color-text-muted)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              {t('Đúng giờ & đi trễ hợp lệ')}
            </span>
          </div>
        </div>

        {/* Card 3: Pending */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          padding: '0.875rem 1.125rem',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          transition: 'all 0.2s ease'
        }}>
          <div className="decor-svg" style={{ color: '#f59e0b' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
              <path d="M50 30 V 50 H 65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, letterSpacing: '0.05em' }}>
              {t('ĐANG CHỜ DUYỆT')}
            </span>
            <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <Clock size={14} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.625rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px', lineHeight: 1.1 }}>
            {pendingCount}
          </div>
          <div style={{
            marginTop: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            fontSize: '0.7rem',
            color: 'var(--color-text-muted)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              {t('Yêu cầu phê duyệt đi trễ')}
            </span>
          </div>
        </div>

        {/* Card 4: Rejected */}
        <div className="stat-card hover-lift" style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          padding: '0.875rem 1.125rem',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          transition: 'all 0.2s ease'
        }}>
          <div className="decor-svg" style={{ color: '#ef4444' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
              <path d="M35 35 L 65 65 M 65 35 L 35 65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, letterSpacing: '0.05em' }}>
              {t('BỊ TỪ CHỐI')}
            </span>
            <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              <AlertCircle size={14} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.625rem', fontWeight: 800, color: '#ef4444', marginTop: '4px', lineHeight: 1.1 }}>
            {rejectedCount}
          </div>
          <div style={{
            marginTop: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            fontSize: '0.7rem',
            color: 'var(--color-text-muted)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              {t('Không được phê duyệt')}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      {viewMode === 'list' && (
        <div className="card" style={{ padding: '1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Period Filter (List View only) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Khoảng thời gian')}</label>
              <PeriodFilter
                value={period}
                onChange={(p, r) => {
                  setPeriod(p);
                  if (p !== 'custom') {
                    setCustomRange(r);
                  }
                }}
                customRange={customRange}
                onCustomRange={(r) => {
                  setCustomRange(r);
                }}
              />
            </div>

            {/* User Select */}
            {canSelectUser && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: isMobile ? '1 1 0%' : 'none', minWidth: isMobile ? '0' : '200px' }}>
                <label style={{ fontSize: isMobile ? '0.625rem' : '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: isMobile ? '2px' : 0 }}>{t('Nhân viên')}</label>
                <CustomSelect
                  options={[
                    { value: 'all', label: t('Tất cả nhân viên') },
                    ...consultants.map(c => ({ 
                      value: String(c.id), 
                      label: c.name,
                      avatar: resolveAttachmentUrl(c.avatar_url || c.avatar)
                    }))
                  ]}
                  value={filterUser}
                  onChange={(val) => setFilterUser(String(val))}
                  width="100%"
                  searchable={true}
                  showAvatars={true}
                />
              </div>
            )}

            {/* Status Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
              <label style={{ fontSize: isMobile ? '0.625rem' : '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: isMobile ? '2px' : 0 }}>{t('Trạng thái duyệt')}</label>
              <CustomSelect
                options={[
                  { value: 'all', label: t('Tất cả trạng thái') },
                  { value: 'approved', label: t('Đã duyệt / Đúng giờ') },
                  { value: 'pending_approval', label: t('Chờ duyệt đi trễ') },
                  { value: 'rejected', label: t('Đã từ chối') }
                ]}
                value={filterStatus}
                onChange={(val) => setFilterStatus(String(val))}
                width="100%"
              />
            </div>

            <button
              onClick={() => {
                setPeriod('7d');
                setCustomRange({ from: '2026-06-25', to: '2026-07-01' });
                setCurrentMonth(7);
                setCurrentYear(2026);
                setFilterUser(isSales ? String(user?.id) : 'all');
                setFilterStatus('all');
              }}
              className="btn outline"
              style={{ 
                height: isMobile ? '34px' : '38px', 
                borderRadius: 'var(--radius-md)', 
                fontSize: isMobile ? '0.7rem' : '0.8125rem', 
                padding: isMobile ? '0 10px' : '0 16px',
                alignSelf: 'flex-end',
                flexShrink: 0
              }}
            >
              {isMobile ? t('Đặt lại') : t('Đặt lại bộ lọc')}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {viewMode === 'list' ? (() => {
        const totalPages = Math.ceil(checkIns.length / ITEMS_PER_PAGE);
        const paginatedCheckIns = checkIns.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
        return (
          <div className="card" style={{ padding: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: '600px', overflowY: 'auto' }}>
              <table className="mobile-table-compact" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)' }}>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', background: 'var(--color-bg)' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('NHÂN VIÊN')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('GIỜ CHECK-IN')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'center' }}>{t('ẢNH SELFIE')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('LÝ DO TRỄ / GHI CHÚ')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{t('TRẠNG THÁI')}</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textAlign: 'right' }}>{t('HÀNH ĐỘNG')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(4)].map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                  ) : checkIns.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        <Info size={24} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.5 }} />
                        {t('Không tìm thấy dữ liệu chấm công cho ngày đã chọn.')}
                      </td>
                    </tr>
                  ) : (
                    paginatedCheckIns.map((row) => {
                      const isLate = row.check_in_time > (row.work_start_time || '08:00');
                      return (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem' }} className="group table-row-hover">
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Avatar src={resolveAttachmentUrl(row.user_avatar)} name={row.user_name} size={32} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.user_name}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>{row.user_email}</span>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px', fontWeight: 600, color: isLate ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={14} />
                              {row.check_in_time}
                              {isLate && (
                                <span style={{ fontSize: '0.65rem', fontWeight: 500, backgroundColor: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>
                                  {t('Trễ')}
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {row.selfie_url ? (
                              <a
                                onClick={() => setPreviewCheckIn(row)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: 'var(--color-primary)',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  textDecoration: 'underline',
                                  cursor: 'pointer'
                                }}
                              >
                                <Camera size={14} />
                                {t('Ảnh selfie')}
                              </a>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>N/A</span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px', color: 'var(--color-text)', maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {row.reason ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                <ShieldAlert size={14} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
                                <span>{row.reason}</span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-light)', fontStyle: 'italic' }}>{t('Không có')}</span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              backgroundColor:
                                row.status === 'approved' ? (
                                  isLate ? 'rgba(0, 122, 255, 0.08)' : 'var(--color-success-light)'
                                ) :
                                row.status === 'pending_approval' ? 'var(--color-warning-light)' :
                                'var(--color-danger-light)',
                              color:
                                row.status === 'approved' ? (
                                  isLate ? '#007aff' : 'var(--color-success)'
                                ) :
                                row.status === 'pending_approval' ? 'var(--color-warning)' :
                                'var(--color-danger)',
                            }}>
                              {row.status === 'approved' && <CheckCircle size={12} />}
                              {row.status === 'pending_approval' && <AlertCircle size={12} />}
                              {row.status === 'rejected' && <X size={12} />}
                              {row.status === 'approved' ? (
                                isLate ? t('Đã duyệt') : t('Đúng giờ')
                              ) :
                               row.status === 'pending_approval' ? t('Chờ duyệt đi trễ') :
                               t('Bị từ chối')}
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {row.status === 'pending_approval' && canApprove && (
                                <>
                                  <button
                                    onClick={() => {
                                      showConfirm({
                                        title: t('Phê duyệt đi trễ'),
                                        message: t('Bạn có chắc chắn muốn phê duyệt yêu cầu đi trễ này?'),
                                        optionalPromptInput: true,
                                        promptPlaceholder: t('Nhập lưu ý/nội dung phê duyệt (tùy chọn)...'),
                                        confirmText: t('Phê duyệt'),
                                        cancelText: t('Hủy'),
                                        onConfirm: (reason) => {
                                          handleUpdateStatus(row.id, 'approved', reason ? reason.trim() : undefined);
                                        }
                                      });
                                    }}
                                    disabled={actionSubmittingId === row.id}
                                    className="btn success sm icon-only"
                                    title={t('Duyệt đi trễ')}
                                    style={{ width: 28, height: 28, padding: 0, borderRadius: '6px' }}
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      showConfirm({
                                        title: t('Từ chối chấm công'),
                                        message: t('Vui lòng nhập lý do từ chối chấm công này:'),
                                        requirePromptInput: true,
                                        promptPlaceholder: t('Nhập lý do từ chối...'),
                                        confirmText: t('Từ chối'),
                                        cancelText: t('Hủy'),
                                        isDanger: true,
                                        onConfirm: (reason) => {
                                          if (reason && reason.trim()) {
                                            handleUpdateStatus(row.id, 'rejected', reason.trim());
                                          } else {
                                            toast.error(t('Lý do từ chối là bắt buộc'));
                                          }
                                        }
                                      });
                                    }}
                                    disabled={actionSubmittingId === row.id}
                                    className="btn danger sm icon-only"
                                    title={t('Từ chối nhận lead')}
                                    style={{ width: 28, height: 28, padding: 0, borderRadius: '6px' }}
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => openDeleteConfirm(row.id)}
                                className="btn outline sm danger icon-only"
                                title={t('Xóa bản ghi')}
                                style={{ width: 28, height: 28, padding: 0, borderRadius: '6px', border: '1px solid var(--color-border)' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderTop: '1px solid var(--color-border-light)',
                background: 'var(--color-surface)',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {t('Hiển thị')} <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{Math.min(currentPage * ITEMS_PER_PAGE, checkIns.length)}</span> {t('trên')} <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{checkIns.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                    disabled={currentPage === 1} 
                    className="btn sm outline" 
                    style={{ height: 32, width: 32, padding: 0, minWidth: 32, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(() => {
                      const maxVisible = 5;
                      let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                      let end = Math.min(totalPages, start + maxVisible - 1);
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
                          onClick={() => setCurrentPage(pageNum)}
                          style={{
                            width: 32, height: 32, borderRadius: 8, fontSize: '0.8125rem', fontWeight: 700,
                            border: currentPage === pageNum ? 'none' : '1px solid var(--color-border-light)',
                            background: currentPage === pageNum ? 'var(--color-primary)' : 'var(--color-surface)',
                            color: currentPage === pageNum ? 'white' : 'var(--color-text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          className={currentPage === pageNum ? '' : 'hover-lift'}
                        >
                          {pageNum}
                        </button>
                      ));
                    })()}
                  </div>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                    disabled={currentPage === totalPages} 
                    className="btn sm outline" 
                    style={{ height: 32, width: 32, padding: 0, minWidth: 32, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })() : (viewMode as string) === 'registrations' ? (
        renderRegistrationsView()
      ) : (
        renderCalendarView()
      )}

      {/* Selfie Lightbox Preview Modal */}
      {previewCheckIn && (
        <CustomModal
          isOpen={!!previewCheckIn}
          onClose={() => setPreviewCheckIn(null)}
          title={t('Ảnh selfie check-in')}
          width="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <img
              src={resolveAttachmentUrl(previewCheckIn.selfie_url)}
              style={{ width: '100%', maxHeight: '450px', borderRadius: '8px', objectFit: 'contain', backgroundColor: '#000' }}
              alt="Selfie phóng to"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar src={resolveAttachmentUrl(previewCheckIn.user_avatar)} name={previewCheckIn.user_name} size={32} />
                <span style={{ fontWeight: 650, fontSize: '0.875rem', color: 'var(--color-text)' }}>{previewCheckIn.user_name}</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={14} style={{ color: 'var(--color-primary)' }} />
                <strong>
                  {previewCheckIn.check_in_time}
                  {previewCheckIn.check_in_date && ` - ${previewCheckIn.check_in_date.split('-').reverse().join('/')}`}
                </strong>
              </div>
            </div>
          </div>
        </CustomModal>
      )}

      {selectedDateForDetail && (
        <CustomModal
          isOpen={!!selectedDateForDetail}
          onClose={() => {
            setSelectedDateForDetail(null);
            setModalTab('checkin');
          }}
          title={`${t('Chi tiết chấm công ngày')} ${selectedDateForDetail}`}
          width="800px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: isMobile ? '520px' : '450px' }}>
            {/* Sub-tab headers */}
            <div style={{ 
              display: 'flex', 
              borderBottom: '1px solid var(--color-border-light)', 
              marginBottom: '1.25rem', 
              gap: isMobile ? '0.25rem' : '1.5rem',
              justifyContent: isMobile ? 'space-between' : 'flex-start'
            }}>
              <button
                onClick={() => setModalTab('checkin')}
                style={{
                  padding: isMobile ? '8px 2px 10px 2px' : '8px 4px 12px 4px',
                  fontSize: isMobile ? '0.72rem' : '0.875rem',
                  fontWeight: 700,
                  color: modalTab === 'checkin' ? 'var(--color-primary)' : 'var(--color-text-light)',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: modalTab === 'checkin' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '3px' : '6px'
                }}
              >
                <Clock size={isMobile ? 13 : 16} />
                {t('Nhật ký')}
                <span style={{
                  fontSize: '0.625rem',
                  padding: isMobile ? '1px 4px' : '2px 6px',
                  borderRadius: '10px',
                  background: modalTab === 'checkin' ? 'var(--color-primary-light)' : 'var(--color-bg)',
                  color: modalTab === 'checkin' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: 600
                }}>
                  {calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).length}
                </span>
              </button>

              <button
                onClick={() => setModalTab('fingerprint')}
                style={{
                  padding: isMobile ? '8px 2px 10px 2px' : '8px 4px 12px 4px',
                  fontSize: isMobile ? '0.72rem' : '0.875rem',
                  fontWeight: 700,
                  color: modalTab === 'fingerprint' ? 'var(--color-primary)' : 'var(--color-text-light)',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: modalTab === 'fingerprint' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '3px' : '6px'
                }}
              >
                <FileText size={isMobile ? 13 : 16} />
                {isSales ? t('Yêu cầu') : t('Bảng công')}
              </button>

              <button
                onClick={() => setModalTab('night_duty')}
                style={{
                  padding: isMobile ? '8px 2px 10px 2px' : '8px 4px 12px 4px',
                  fontSize: isMobile ? '0.72rem' : '0.875rem',
                  fontWeight: 700,
                  color: modalTab === 'night_duty' ? 'var(--color-primary)' : 'var(--color-text-light)',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: modalTab === 'night_duty' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '3px' : '6px'
                }}
              >
                <Moon size={isMobile ? 13 : 16} />
                {t('Trực đêm')}
                <span style={{
                  fontSize: '0.625rem',
                  padding: isMobile ? '1px 4px' : '2px 6px',
                  borderRadius: '10px',
                  background: modalTab === 'night_duty' ? 'var(--color-primary-light)' : 'var(--color-bg)',
                  color: modalTab === 'night_duty' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: 600
                }}>
                  {calendarShifts.filter(s => s.shift_date === selectedDateForDetail && s.shift_type === 'night').length}
                </span>
              </button>
            </div>

            {/* Tab content body */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {modalTab === 'checkin' ? (
                /* Sub-tab 1: Real-time Check-ins list */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                    {calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
                        <Info size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                        <p style={{ fontSize: '0.8125rem' }}>{t('Không có lượt check-in nào trong ngày này.')}</p>
                      </div>
                    ) : (
                      calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).map((row) => {
                        const isLate = row.check_in_time > (row.work_start_time || '08:00');
                        return (
                          <div key={row.id} style={{
                            padding: '12px',
                            background: 'var(--color-bg-light)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Avatar src={resolveAttachmentUrl(row.user_avatar)} name={row.user_name} size={28} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text)' }}>{row.user_name}</span>
                                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)' }}>{row.user_email}</span>
                                </div>
                              </div>
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '20px',
                                backgroundColor:
                                  row.status === 'approved' 
                                    ? (isLate ? 'rgba(16, 185, 129, 0.1)' : 'var(--color-success-light)') 
                                    : row.status === 'pending_approval' ? 'var(--color-warning-light)' : 'var(--color-danger-light)',
                                color:
                                  row.status === 'approved'
                                    ? (isLate ? '#10b981' : 'var(--color-success)')
                                    : row.status === 'pending_approval' ? 'var(--color-warning)' : 'var(--color-danger)',
                                border: row.status === 'approved' && isLate ? '1px solid rgba(16, 185, 129, 0.2)' : 'none',
                              }}>
                                {row.status === 'approved' 
                                  ? (isLate ? t('Hợp lệ') : t('Đúng giờ')) 
                                  : row.status === 'pending_approval' ? t('Chờ duyệt') : t('Bị từ chối')}
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                                <span>{t('Thời gian:')} <strong>{row.check_in_time}</strong></span>
                                {isLate && <span style={{ color: 'var(--color-danger)', marginLeft: '6px', fontWeight: 600 }}>({t('Trễ')})</span>}
                              </div>
                              {row.selfie_url && (
                                <a
                                  onClick={() => setPreviewCheckIn(row)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: 'var(--color-primary)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    textDecoration: 'underline',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Camera size={14} />
                                  {t('Ảnh selfie')}
                                </a>
                              )}
                            </div>

                            {row.reason && (
                              <div style={{ fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)', padding: '6px 8px', borderRadius: '6px', color: 'var(--color-text-muted)' }}>
                                <strong>{t('Lý do trễ:')}</strong> {row.reason}
                              </div>
                            )}

                            {row.status === 'pending_approval' && canApprove && (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                <button
                                  onClick={() => {
                                    showConfirm({
                                      title: t('Phê duyệt đi trễ'),
                                      message: t('Bạn có chắc chắn muốn phê duyệt yêu cầu đi trễ này?'),
                                      optionalPromptInput: true,
                                      promptPlaceholder: t('Nhập lưu ý/nội dung phê duyệt (tùy chọn)...'),
                                      confirmText: t('Phê duyệt'),
                                      cancelText: t('Hủy'),
                                      onConfirm: (reason) => {
                                        handleUpdateStatus(row.id, 'approved', reason ? reason.trim() : undefined);
                                      }
                                    });
                                  }}
                                  className="btn success sm"
                                  style={{ padding: '3px 10px', fontSize: '0.7rem', height: 'auto', borderRadius: '6px' }}
                                >
                                  <Check size={12} /> {t('Phê duyệt')}
                                </button>
                                <button
                                  onClick={() => {
                                    showConfirm({
                                      title: t('Từ chối chấm công'),
                                      message: t('Vui lòng nhập lý do từ chối chấm công này:'),
                                      requirePromptInput: true,
                                      promptPlaceholder: t('Nhập lý do từ chối...'),
                                      confirmText: t('Từ chối'),
                                      cancelText: t('Hủy'),
                                      isDanger: true,
                                      onConfirm: (reason) => {
                                        if (reason && reason.trim()) {
                                          handleUpdateStatus(row.id, 'rejected', reason.trim());
                                        } else {
                                          toast.error(t('Lý do từ chối là bắt buộc'));
                                        }
                                      }
                                    });
                                  }}
                                  className="btn danger sm"
                                  style={{ padding: '3px 10px', fontSize: '0.7rem', height: 'auto', borderRadius: '6px' }}
                                >
                                  <X size={12} /> {t('Từ chối')}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : modalTab === 'fingerprint' ? (
                /* Sub-tab 2: Fingerprint Excel / Supplementary Form */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {isSales ? (
                    // Sales supplementary request form
                    hasCheckIn ? (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        background: 'rgba(107, 114, 128, 0.03)',
                        border: '1px solid var(--color-border-light)',
                        padding: '2.5rem 1.5rem',
                        borderRadius: '12px',
                        textAlign: 'center',
                        height: '100%',
                        minHeight: '220px'
                      }}>
                        <CheckCircle size={36} color="var(--color-success)" />
                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0 }}>
                          {t('Đã Chấm Công')}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: '220px' }}>
                          {t('Bạn đã có dữ liệu chấm công cho ngày này. Không cần gửi thêm yêu cầu.')}
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--color-bg-light)', border: '1px solid var(--color-border)', padding: '1.25rem', borderRadius: '12px' }}>
                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0 }}>
                          📝 {t('Yêu Cầu Chấm Công Bổ Sung')}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                          {t('Gửi yêu cầu chấm công bổ sung cho ngày ')}{selectedDateForDetail}{t('. Quản trị viên sẽ phê duyệt yêu cầu này.')}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Giờ check-in bổ sung')}</label>
                          <input
                            type="time"
                            className="input"
                            value={suppTime}
                            onChange={(e) => setSuppTime(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-surface)',
                              color: 'var(--color-text)',
                              fontSize: '0.8125rem'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t('Lý do bổ sung (Quên check-in, đi gặp khách...)')}</label>
                          <textarea
                            className="input"
                            value={suppReason}
                            onChange={(e) => setSuppReason(e.target.value)}
                            rows={3}
                            placeholder={t('Ví dụ: Quên check-in do đi gặp khách hàng sớm tại dự án...')}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-surface)',
                              color: 'var(--color-text)',
                              fontSize: '0.8125rem',
                              resize: 'none'
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleSubSupplementary}
                          disabled={suppSubmitting}
                          className="btn primary"
                          style={{
                            width: '100%',
                            borderRadius: '8px',
                            padding: '10px',
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            marginTop: '6px'
                          }}
                        >
                          {suppSubmitting ? t('Đang gửi yêu cầu...') : t('Gửi yêu cầu chấm công')}
                        </button>
                      </div>
                    )
                  ) : (
                    // Admin/Manager official log upload & sheet preview
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', margin: 0 }}>
                          📄 {t('File Chấm Công')}
                        </h4>
                        <button
                          type="button"
                          onClick={() => downloadDayExcel(selectedDateForDetail)}
                          disabled={calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).length === 0}
                          className="btn success sm"
                          style={{
                            fontSize: '0.75rem',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Download size={12} />
                          <span>{t('Xuất file Excel')}</span>
                        </button>
                      </div>

                      {/* Simulated Spreadsheet File Sheet Grid */}
                      <div style={{
                        background: 'var(--color-bg-light)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '10px',
                        padding: '0.75rem',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-muted)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--color-text)', fontWeight: 600 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '50%', width: '18px', height: '18px' }}>✓</span>
                          <span>{t('Bản xem trước File Excel sẽ xuất')}</span>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.6875rem' }}>
                            <thead>
                              <tr style={{ background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', color: 'var(--color-text-muted)' }}>
                                <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '0.625rem' }}>{t('STT')}</th>
                                <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '0.625rem' }}>{t('Nhân viên')}</th>
                                <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '0.625rem' }}>{t('Giờ Check-in')}</th>
                                <th style={{ padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '0.625rem' }}>{t('Trạng thái')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).length === 0 ? (
                                <tr>
                                  <td colSpan={4} style={{ textAlign: 'center', padding: '12px', fontStyle: 'italic', fontSize: '0.65rem' }}>
                                    {t('Trống')}
                                  </td>
                                </tr>
                              ) : (
                                calendarCheckIns.filter(c => c.check_in_date === selectedDateForDetail).map((c, i) => (
                                  <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '6px 8px', fontSize: '0.625rem' }}>{i + 1}</td>
                                    <td style={{ padding: '6px 8px', fontSize: '0.625rem', color: 'var(--color-text)', fontWeight: 500 }}>{c.user_name}</td>
                                    <td style={{ padding: '6px 8px', fontSize: '0.625rem', fontFamily: 'monospace' }}>{c.check_in_time}</td>
                                    <td style={{ padding: '6px 8px', fontSize: '0.625rem' }}>
                                      <span style={{
                                        color: c.status === 'approved' ? 'var(--color-success)' : (c.status === 'pending_approval' ? 'var(--color-warning)' : 'var(--color-danger)'),
                                        fontWeight: 600
                                      }}>{c.status === 'approved' ? t('Hợp lệ') : (c.status === 'pending_approval' ? t('Chờ duyệt') : t('Từ chối'))}</span>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Upload finger-print official log zone */}
                      <div style={{
                        border: '2px dashed var(--color-border)',
                        borderRadius: '10px',
                        padding: '1rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'var(--color-surface)',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => {
                        toast.success(t('Đã đồng bộ file chấm công vân tay / Excel của CĐT thành công!'));
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                      >
                        <Upload size={24} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px', opacity: 0.6 }} />
                        <h5 style={{ fontWeight: 600, fontSize: '0.8125rem', margin: '0 0 4px', color: 'var(--color-text)' }}>
                          {t('Đồng bộ File Chấm Công Vân Tay')}
                        </h5>
                        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', margin: 0 }}>
                          {t('Click để chọn hoặc kéo thả file Excel kết quả chấm công từ CĐT')}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Sub-tab 3: Night Duty Log */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                    {(() => {
                      const nightShifts = calendarShifts.filter(s => s.shift_date === selectedDateForDetail && s.shift_type === 'night');
                      if (nightShifts.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
                            <Moon size={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                            <p style={{ fontSize: '0.8125rem' }}>{t('Không có nhân sự nào được phân công trực đêm trong ngày này.')}</p>
                          </div>
                        );
                      }
                      return nightShifts.map((row) => (
                        <div key={row.id} style={{
                          padding: '12px',
                          background: 'var(--color-bg-light)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Avatar src={resolveAttachmentUrl(row.user_avatar)} name={row.user_name} size={28} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text)' }}>{row.user_name}</span>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)' }}>{row.user_email || '—'}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                              🌙 {row.shift_date ? row.shift_date.split('-').reverse().join('/') : ''} ({sysSettings?.night_shift_start_time || '18:00'} - {sysSettings?.night_shift_end_time || '06:00'})
                            </span>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '20px',
                              backgroundColor: Number(row.approved) === 1 ? 'var(--color-success-light)' : 'var(--color-warning-light)',
                              color: Number(row.approved) === 1 ? 'var(--color-success)' : 'var(--color-warning)',
                              whiteSpace: 'nowrap'
                            }}>
                              {Number(row.approved) === 1 ? t('Đã duyệt') : t('Chờ duyệt')}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CustomModal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteCheckIn}
        title={t('Cảnh báo Xóa Bản ghi Chấm công')}
        message={t('Bạn có chắc chắn muốn xóa vĩnh viễn bản ghi chấm công này không? Hành động này không thể hoàn tác.')}
        confirmText={t('Xóa vĩnh viễn')}
      />

      {/* Attendance & Lead Allocation Guide Modal */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={t("Hướng dẫn cơ chế Chấm công & Phân chia Lead")}
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
              {t("Chấm công không chỉ ghi nhận ngày công mà còn trực tiếp điều khiển thuật toán chia số (Round-Robin). Hệ thống hoạt động theo nguyên tắc sau:")}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Rule 1 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(59, 130, 246, 0.02)', 
              borderLeft: '4px solid #3b82f6', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <CheckCircle size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("1. Chấm công Selfie & Xác thực GPS")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Mỗi ca làm việc, TVV thực hiện Check-in / Check-out kèm hình ảnh khuôn mặt thực tế và định vị GPS. Điều này giúp ngăn ngừa gian lận chấm công hộ và đảm bảo nhân sự có mặt tại khu vực bán hàng quy định.")}
                </p>
              </div>
            </div>

            {/* Rule 2 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(239, 68, 68, 0.02)', 
              borderLeft: '4px solid #ef4444', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("2. Khóa phân phối Lead tự động (Routing Lock)")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("• Chưa Check-in hoặc đã Check-out: Hệ thống sẽ tự động BỎ QUA TVV khỏi danh sách chia số của các Vòng phân bổ. TVV chỉ được chia số khi đang trong trạng thái Check-in hoạt động.")}
                  <br />
                  {t("• Chế độ Vacation/Vắng mặt: Admin có thể chủ động ngắt chia lead cho từng cá nhân nếu nghỉ dài ngày.")}
                </p>
              </div>
            </div>

            {/* Rule 3 */}
            <div style={{ 
              display: 'flex', 
              gap: 12, 
              padding: '1rem', 
              background: 'rgba(245, 158, 11, 0.02)', 
              borderLeft: '4px solid #f59e0b', 
              borderTop: '1px solid var(--color-border-light)',
              borderRight: '1px solid var(--color-border-light)',
              borderBottom: '1px solid var(--color-border-light)',
              borderRadius: '0 8px 8px 0'
            }}>
              <Clock size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                  {t("3. Duyệt đi trễ & Thời gian xử lý SLA")}
                </h5>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {t("Khi TVV check-in trễ giờ quy định, hệ thống sẽ yêu cầu viết lý do. Người quản lý (Manager/Admin) có nghĩa vụ kiểm duyệt ảnh selfie và lý do đi trễ để phê duyệt trong thời gian SLA tối đa là ")}
                  <strong>{sysSettings?.checkin_approval_sla_minutes || 60} {t("phút")}</strong>.
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

export const AttendancePage = withRouterFreezer(AttendancePageInner, '/attendance');
export default AttendancePage;
